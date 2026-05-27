// Semantic chunker for the CKF Compiler.
// v1.0 — multi-format heading detection (markdown, plain "Capítulo N", uppercase
// title lines, horizontal separators). Each chunk carries a stable `spanId`
// (s_NNN) so extracted items can reference it, plus the raw chunk text so the
// reducer can rebuild source_traceability without re-reading the source.

export type Chunk = {
  id: string;
  spanId: string;        // CKF source span id, e.g. "s_001"
  path: string;          // breadcrumb, e.g. "Capítulo 3 > 3.2"
  heading: string | null;
  text: string;
  charStart: number;
  charEnd: number;
};

const pad3 = (n: number) => String(n).padStart(3, "0");

// Tune-able ceiling per chunk. ~6k chars ≈ 1.5k tokens.
// Smaller chunks → finer-grained extraction (more atomic_units / retrieval_chunks)
// at the cost of more LLM calls. v1.03.1 study used ~5–6k. Override via opts.maxChars.
const APPROX_CHARS_PER_CHUNK = 6_000;

export function chunkSemantically(rawText: string, opts?: { maxChars?: number }): Chunk[] {
  const maxChars = opts?.maxChars ?? APPROX_CHARS_PER_CHUNK;
  // Normalize newlines and trim. Keep separator lines so heading detection
  // can use them as soft section breaks.
  const text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!text) return [];

  // 1) Split by recognized headings (markdown, "Capítulo", uppercase, etc.).
  const sections = splitByHeadings(text);

  // 2) Sub-split oversized sections by paragraph, with sliding overlap.
  const chunks: Chunk[] = [];
  let cursor = 0;
  let id = 0;
  const push = (path: string, heading: string | null, body: string) => {
    const n = id++;
    const trimmed = body.trim();
    if (!trimmed) return;
    chunks.push({
      id: `c${n}`,
      spanId: `s_${pad3(n + 1)}`,
      path,
      heading,
      text: trimmed,
      charStart: cursor,
      charEnd: cursor + trimmed.length,
    });
    cursor += trimmed.length;
  };

  for (const sec of sections) {
    if (sec.text.length <= maxChars) {
      push(sec.path, sec.heading, sec.text);
      continue;
    }
    const paragraphs = sec.text.split(/\n\n+/);
    let buf = "";
    let partIdx = 1;
    for (const p of paragraphs) {
      if ((buf + "\n\n" + p).length > maxChars && buf) {
        push(`${sec.path} · part ${partIdx++}`, sec.heading, buf);
        buf = p;
      } else {
        buf = buf ? buf + "\n\n" + p : p;
      }
    }
    if (buf) push(partIdx > 1 ? `${sec.path} · part ${partIdx}` : sec.path, sec.heading, buf);
  }

  return chunks;
}

// ── Heading detection ──────────────────────────────────────────────────────

type RawSection = { path: string; heading: string | null; text: string };

const HEADING_PATTERNS: { depth: number; re: RegExp }[] = [
  // Markdown — depth from #-count.
  { depth: 0, re: /^(#{1,6})\s+(.+?)\s*$/ },
  // PT / EN / ES top-level book divisions.
  { depth: 1, re: /^(parte|part|parte\s+\d+|part\s+\d+)\b[:\s].*$/i },
  { depth: 2, re: /^(cap[íi]tulo|chapter|cap[íi]tulo|cap[íi]tulo\s+\d+|chapter\s+\d+|cap\.\s*\d+)\b.*$/i },
  // Numbered section ("1. Introduction", "1.2 Foo").
  { depth: 3, re: /^\d+(\.\d+)*\.?\s+\S.{2,}$/ },
  // Decorative / horizontal rule — used as a soft break only.
  { depth: 4, re: /^[_\-=]{3,}\s*$/ },
];

function detectHeading(line: string): { depth: number; title: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Markdown explicit
  const md = trimmed.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (md) return { depth: md[1].length, title: md[2].trim() };

  // Plain "Capítulo N — …" / "Chapter N: …"
  if (/^(cap[íi]tulo|chapter|cap\.)\s+\d+([\s:.\-—–].*)?$/i.test(trimmed)) {
    return { depth: 2, title: trimmed };
  }
  // "Parte N"
  if (/^(parte|part)\s+[ivxlcdm0-9]+([\s:.\-—–].*)?$/i.test(trimmed)) {
    return { depth: 1, title: trimmed };
  }
  // Numbered "1.2.3 Title"
  if (/^\d+(\.\d+){0,3}\.?\s+\S.{2,80}$/.test(trimmed) && !/[.!?]$/.test(trimmed)) {
    const depth = 3 + (trimmed.match(/\./g)?.length ?? 0);
    return { depth: Math.min(depth, 6), title: trimmed };
  }
  // Decorative separator — treat as soft break (depth 7 ≈ flush only).
  if (/^[_\-=]{3,}$/.test(trimmed)) {
    return { depth: 7, title: "" };
  }
  // ALL-CAPS title line (≥3 words, no terminal punctuation, short-ish).
  const noPunct = trimmed.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const letters = noPunct.replace(/[^\p{L}]/gu, "");
  if (
    letters.length >= 6 &&
    letters.length <= 80 &&
    noPunct.split(/\s+/).length >= 2 &&
    noPunct === noPunct.toUpperCase() &&
    !/[.!?]$/.test(trimmed)
  ) {
    return { depth: 2, title: trimmed };
  }
  return null;
}

function splitByHeadings(text: string): RawSection[] {
  const lines = text.split("\n");
  const sections: RawSection[] = [];
  let stack: string[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (body) {
      sections.push({
        path: stack.length ? stack.join(" > ") : "document",
        heading: currentHeading,
        text: body,
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const h = detectHeading(line);
    if (h) {
      // Soft separator: just flush without changing breadcrumb.
      if (h.depth === 7) {
        flush();
        continue;
      }
      flush();
      const depth = Math.max(1, Math.min(h.depth, 6));
      stack = stack.slice(0, depth - 1);
      while (stack.length < depth - 1) stack.push("…");
      stack.push(h.title);
      currentHeading = h.title;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections.length ? sections : [{ path: "document", heading: null, text }];
}

export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
