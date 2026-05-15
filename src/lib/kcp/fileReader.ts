import mammoth from "mammoth";

export type ExtractionProgress = {
  stage: "start" | "loading" | "parsing" | "page" | "done";
  message: string;
  percent?: number;
  current?: number;
  total?: number;
};

export type ProgressFn = (p: ExtractionProgress) => void;

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

  const parts: string[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    parts.push(text);
    const percent = 18 + Math.round((i / total) * 80);
    onProgress?.({
      stage: "page",
      message: `Extracted page ${i} / ${total} (${text.length} chars).`,
      percent,
      current: i,
      total,
    });
  }
  return parts.join("\n\n");
}

export async function readFileAsText(file: File, onProgress?: ProgressFn): Promise<string> {
  const name = file.name.toLowerCase();
  onProgress?.({ stage: "start", message: `Opening ${file.name}…`, percent: 0 });

  if (name.endsWith(".docx")) {
    onProgress?.({ stage: "loading", message: "Reading .docx bytes…", percent: 20 });
    const buf = await file.arrayBuffer();
    onProgress?.({ stage: "parsing", message: "Extracting text from Word…", percent: 60 });
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    onProgress?.({ stage: "done", message: `Extracted ${result.value.length} characters.`, percent: 100 });
    return result.value;
  }
  if (name.endsWith(".pdf")) {
    const txt = await readPdf(file, onProgress);
    onProgress?.({ stage: "done", message: `Extracted ${txt.length} characters from PDF.`, percent: 100 });
    return txt;
  }
  onProgress?.({ stage: "loading", message: "Reading text file…", percent: 50 });
  const txt = await file.text();
  onProgress?.({ stage: "done", message: `Loaded ${txt.length} characters.`, percent: 100 });
  return txt;
}
