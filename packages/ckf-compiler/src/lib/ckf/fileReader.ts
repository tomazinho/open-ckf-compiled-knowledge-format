// mammoth is dynamically imported inside readFileAsText to keep it out of the initial bundle.

export type ExtractionProgress = {
  stage: "start" | "loading" | "parsing" | "page" | "done";
  message: string;
  percent?: number; // 0..100
  current?: number;
  total?: number;
};

export type ProgressFn = (p: ExtractionProgress) => void;

/**
 * Structure-preserving PDF extractor (v1.1).
 *
 * Earlier versions joined all `content.items` with " ", collapsing every page
 * into a single line with no paragraph breaks. The CKF chunker depends on
 * `\n\n` and heading detection to split semantically — flat text produced 1–2
 * giant chunks regardless of document size, which starved the LLM extraction
 * pass (compare 3 retrieval_chunks vs. 18 in the v1.03.1 study for the same
 * source).
 *
 * The new extractor:
 *  1. Groups items by Y coordinate (`transform[5]`) so each visual line is
 *     reconstructed (items on the same line joined with " ", line break
 *     inserted between groups).
 *  2. Detects paragraph breaks when Δy between consecutive lines exceeds
 *     ~1.6× the median line gap → emits `\n\n`.
 *  3. Strips per-page headers/footers (lines that appear on >60% of pages,
 *     short, near the top/bottom edge of the page).
 *  4. Promotes likely headings to Markdown `## ` so the chunker's heading
 *     pass picks them up. Heuristics: short (< 90 chars), no terminal
 *     punctuation, larger font (height > 1.15× body), and not pure digits.
 *  5. Joins pages with `\n\n` so cross-page paragraphs still break cleanly.
 *
 * Falls back to the flat (space-joined) extraction if the structured pass
 * produces fewer paragraph breaks than the flat version (defensive: weird
 * two-column or rasterized PDFs may not benefit).
 */
type PdfItem = {
  str: string;
  height: number;
  width: number;
  x: number;
  y: number;
};

type PdfLine = {
  text: string;
  y: number;
  maxHeight: number;
};

function extractItems(content: { items: unknown[] }): PdfItem[] {
  const items: PdfItem[] = [];
  for (const raw of content.items as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== "object" || typeof raw.str !== "string") continue;
    const str = (raw.str as string);
    if (!str) continue;
    const transform = (raw.transform as number[]) ?? [];
    const height = typeof raw.height === "number" ? (raw.height as number) : (transform[3] ?? 10);
    const width = typeof raw.width === "number" ? (raw.width as number) : 0;
    const x = transform[4] ?? 0;
    const y = transform[5] ?? 0;
    items.push({ str, height, width, x, y });
  }
  return items;
}

function itemsToLines(items: PdfItem[]): PdfLine[] {
  if (items.length === 0) return [];
  // Sort top-to-bottom (y descends in PDF coords), then left-to-right.
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: PdfLine[] = [];
  const Y_TOLERANCE = 2; // points
  let current: { items: PdfItem[]; y: number } | null = null;
  for (const it of sorted) {
    if (current && Math.abs(current.y - it.y) <= Y_TOLERANCE) {
      current.items.push(it);
    } else {
      if (current) lines.push(finalizeLine(current.items, current.y));
      current = { items: [it], y: it.y };
    }
  }
  if (current) lines.push(finalizeLine(current.items, current.y));
  return lines;
}

function finalizeLine(items: PdfItem[], y: number): PdfLine {
  const sorted = items.sort((a, b) => a.x - b.x);
  let out = "";
  let lastX = -Infinity;
  let lastWidth = 0;
  for (const it of sorted) {
    const gap = it.x - (lastX + lastWidth);
    if (out && gap > 1) out += " ";
    out += it.str;
    lastX = it.x;
    lastWidth = it.width;
  }
  return {
    text: out.replace(/\s+/g, " ").trim(),
    y,
    maxHeight: Math.max(...sorted.map((s) => s.height)),
  };
}

function detectRepeatedRunningText(pageLines: PdfLine[][]): Set<string> {
  // Lines that appear (after normalization) on more than 60% of pages and
  // are short → treat as header/footer chrome.
  const counts = new Map<string, number>();
  for (const lines of pageLines) {
    const seen = new Set<string>();
    for (const ln of lines) {
      const key = ln.text.toLowerCase().replace(/\d+/g, "#").trim();
      if (key.length === 0 || key.length > 100) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pageLines.length * 0.6));
  const drop = new Set<string>();
  for (const [k, n] of counts) {
    if (n >= threshold) drop.add(k);
  }
  return drop;
}

function linesToMarkdown(pageLines: PdfLine[][], chrome: Set<string>): string {
  const out: string[] = [];
  // Estimate body font height (median maxHeight across all non-chrome lines).
  const heights: number[] = [];
  for (const lines of pageLines) {
    for (const ln of lines) {
      const key = ln.text.toLowerCase().replace(/\d+/g, "#").trim();
      if (chrome.has(key)) continue;
      if (ln.maxHeight > 0) heights.push(ln.maxHeight);
    }
  }
  heights.sort((a, b) => a - b);
  const bodyH = heights[Math.floor(heights.length / 2)] ?? 10;

  for (const lines of pageLines) {
    const kept = lines.filter((ln) => {
      const key = ln.text.toLowerCase().replace(/\d+/g, "#").trim();
      return ln.text.length > 0 && !chrome.has(key);
    });
    if (kept.length === 0) continue;
    // Compute median Δy between consecutive lines on this page to find paragraph gaps.
    const gaps: number[] = [];
    for (let i = 1; i < kept.length; i++) {
      gaps.push(Math.max(0, kept[i - 1].y - kept[i].y));
    }
    const gapsSorted = [...gaps].sort((a, b) => a - b);
    const medianGap = gapsSorted[Math.floor(gapsSorted.length / 2)] ?? 0;
    const paraThreshold = Math.max(medianGap * 1.6, bodyH * 1.4);

    let prev: PdfLine | null = null;
    for (const ln of kept) {
      const isHeadingByFont = ln.maxHeight > bodyH * 1.15;
      const isHeadingByShape =
        ln.text.length > 0 &&
        ln.text.length <= 90 &&
        !/[.!?:;,]$/.test(ln.text) &&
        !/^\d+$/.test(ln.text) &&
        /\p{L}/u.test(ln.text);
      const looksLikeHeading = isHeadingByFont && isHeadingByShape;

      if (prev) {
        const dy = prev.y - ln.y;
        if (dy >= paraThreshold || looksLikeHeading) {
          out.push("");
        }
      }
      if (looksLikeHeading) {
        out.push(`## ${ln.text}`);
      } else {
        out.push(ln.text);
      }
      prev = ln;
    }
    // Page break → paragraph gap.
    out.push("");
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function readPdf(file: File, onProgress?: ProgressFn): Promise<string> {
  onProgress?.({ stage: "loading", message: "Loading PDF engine…", percent: 2 });
  // @ts-expect-error - no bundled types for the .mjs entry
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  onProgress?.({ stage: "loading", message: `Reading ${file.name} (${(file.size / 1024).toFixed(0)} KB)…`, percent: 8 });
  const buf = await file.arrayBuffer();

  onProgress?.({ stage: "parsing", message: "Parsing document structure…", percent: 14 });
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;
  onProgress?.({ stage: "parsing", message: `Detected ${total} page${total > 1 ? "s" : ""}.`, percent: 18 });

  const pageLines: PdfLine[][] = [];
  const flatParts: string[] = []; // fallback path
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = extractItems(content as { items: unknown[] });
    const lines = itemsToLines(items);
    pageLines.push(lines);
    flatParts.push(items.map((it) => it.str).join(" "));
    const percent = 18 + Math.round((i / total) * 75);
    onProgress?.({
      stage: "page",
      message: `Extracted page ${i} / ${total} (${lines.length} line${lines.length === 1 ? "" : "s"}).`,
      percent,
      current: i,
      total,
    });
  }

  onProgress?.({ stage: "parsing", message: "Detecting headers/footers and headings…", percent: 95 });
  const chrome = detectRepeatedRunningText(pageLines);
  const structured = linesToMarkdown(pageLines, chrome);
  const flat = flatParts.join("\n\n");

  // Defensive fallback: if structured pass somehow produced LESS paragraph
  // structure than the flat join, use flat (e.g. heavily rasterized PDFs).
  const structuredBreaks = (structured.match(/\n\n/g) ?? []).length;
  const flatBreaks = (flat.match(/\n\n/g) ?? []).length;
  if (structuredBreaks < flatBreaks) return flat;
  return structured;
}

export async function readFileAsText(file: File, onProgress?: ProgressFn): Promise<string> {
  const name = file.name.toLowerCase();
  onProgress?.({ stage: "start", message: `Opening ${file.name}…`, percent: 0 });

  if (name.endsWith(".docx")) {
    onProgress?.({ stage: "loading", message: "Loading Word engine…", percent: 10 });
    const { default: mammoth } = await import("mammoth");
    onProgress?.({ stage: "loading", message: "Reading .docx bytes…", percent: 30 });
    const buf = await file.arrayBuffer();
    onProgress?.({ stage: "parsing", message: "Extracting raw text from Word document…", percent: 60 });
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    onProgress?.({ stage: "done", message: `Extracted ${result.value.length} characters.`, percent: 100 });
    return result.value;
  }
  if (name.endsWith(".pdf")) {
    const txt = await readPdf(file, onProgress);
    onProgress?.({ stage: "done", message: `Extracted ${txt.length} characters from PDF.`, percent: 100 });
    return txt;
  }
  // .txt, .md, .ckf, .ckf.md, .yaml, .json — read as text
  onProgress?.({ stage: "loading", message: "Reading text file…", percent: 50 });
  const txt = await file.text();
  onProgress?.({ stage: "done", message: `Loaded ${txt.length} characters.`, percent: 100 });
  return txt;
}
