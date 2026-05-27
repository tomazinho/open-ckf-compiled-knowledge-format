// CKF Compiler v1.2 — Source segmenter.
//
// Emits one SourceSpan per logical record/section of the input. Spans carry
// stable IDs (s_001…), record IDs (when the source provides them, e.g. JSONL
// `_id`), line/char offsets, and text SHA-256 fingerprints so downstream
// stages (chunker, reduce, traceability) can preserve precise provenance.

import type { SourceProfile } from "./sourceProfiler";
import { sha256 } from "./chunker";

export type SourceSpan = {
  spanId: string;
  sourceType: string;
  sourceRecordId?: string;
  sourceFile?: string;
  path: string;
  heading?: string | null;
  title?: string | null;
  text: string;
  lineStart?: number;
  lineEnd?: number;
  charStart?: number;
  charEnd?: number;
  textSha256?: string;
};

export type SourceManifestEntry = {
  source_id: string;
  source_type: string;
  source_record_id?: string;
  source_file?: string;
  path: string;
  heading?: string | null;
  title?: string | null;
  line_start?: number;
  line_end?: number;
  char_start?: number;
  char_end?: number;
  text_sha256?: string;
  text_preview: string;
};

const pad3 = (n: number) => String(n).padStart(3, "0");

export async function segmentSource(
  text: string,
  profile: SourceProfile,
  opts?: { filename?: string },
): Promise<SourceSpan[]> {
  const sourceFile = opts?.filename;
  switch (profile.detectedFormat) {
    case "jsonl_records":
      return await segmentJsonl(text, sourceFile);
    case "json_array_records":
      return await segmentJsonArray(text, sourceFile);
    case "markdown":
      return await segmentMarkdown(text, sourceFile);
    case "legal_norm":
      return await segmentLegalNorm(text, sourceFile);
    case "faq":
      return await segmentFaq(text, sourceFile);
    // transcript, html_text, plain_text and unknown all fall back to plain.
    default:
      return await segmentPlain(text, sourceFile);
  }
}

function makeSpanId(i: number): string {
  return `s_${pad3(i + 1)}`;
}

async function segmentJsonl(text: string, sourceFile?: string): Promise<SourceSpan[]> {
  const out: SourceSpan[] = [];
  const lines = text.split(/\r?\n/);
  let charCursor = 0;
  let spanIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for \n
    if (!line.trim()) {
      charCursor += lineLength;
      continue;
    }
    let obj: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      // Skip non-JSON lines.
    }
    if (!obj) {
      charCursor += lineLength;
      continue;
    }
    const rawText =
      (typeof obj.text === "string" && obj.text) ||
      (typeof obj.content === "string" && obj.content) ||
      (typeof obj.body === "string" && obj.body) ||
      (typeof obj.answer === "string" && obj.answer) ||
      (typeof obj.resposta === "string" && obj.resposta) ||
      "";
    if (!rawText.trim()) {
      charCursor += lineLength;
      continue;
    }
    const recordId =
      (typeof obj._id === "string" && obj._id) ||
      (typeof obj.id === "string" && obj.id) ||
      (typeof obj.question === "string" && obj.question) ||
      (typeof obj.title === "string" && obj.title) ||
      undefined;
    const title = (typeof obj.title === "string" && obj.title) || undefined;
    const charEnd = charCursor + line.length;
    out.push({
      spanId: makeSpanId(spanIdx++),
      sourceType: "jsonl_record",
      sourceRecordId: recordId,
      sourceFile,
      path: recordId ?? `record[${spanIdx - 1}]`,
      heading: null,
      title: title ?? null,
      text: rawText,
      lineStart: i + 1,
      lineEnd: i + 1,
      charStart: charCursor,
      charEnd,
      textSha256: await sha256(rawText),
    });
    charCursor += lineLength;
  }
  return out;
}

async function segmentJsonArray(text: string, sourceFile?: string): Promise<SourceSpan[]> {
  let arr: unknown[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) arr = parsed;
  } catch {
    return segmentPlain(text, sourceFile);
  }
  const out: SourceSpan[] = [];
  let spanIdx = 0;
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const rawText =
      (typeof obj.text === "string" && obj.text) ||
      (typeof obj.content === "string" && obj.content) ||
      (typeof obj.body === "string" && obj.body) ||
      (typeof obj.answer === "string" && obj.answer) ||
      "";
    if (!rawText.trim()) continue;
    const recordId =
      (typeof obj._id === "string" && obj._id) ||
      (typeof obj.id === "string" && obj.id) ||
      undefined;
    const title = (typeof obj.title === "string" && obj.title) || undefined;
    out.push({
      spanId: makeSpanId(spanIdx++),
      sourceType: "json_array_record",
      sourceRecordId: recordId,
      sourceFile,
      path: recordId ?? `array[${spanIdx - 1}]`,
      heading: null,
      title: title ?? null,
      text: rawText,
      textSha256: await sha256(rawText),
    });
  }
  return out;
}

async function segmentMarkdown(text: string, sourceFile?: string): Promise<SourceSpan[]> {
  const out: SourceSpan[] = [];
  const lines = text.split(/\r?\n/);
  type Section = {
    heading: string | null;
    headingDepth: number;
    body: string[];
    lineStart: number;
    pathStack: string[];
  };
  const sections: Section[] = [];
  let stack: string[] = [];
  let current: Section = { heading: null, headingDepth: 0, body: [], lineStart: 1, pathStack: [] };

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      if (current.body.length || current.heading) sections.push(current);
      const depth = m[1].length;
      const title = m[2].trim();
      stack = stack.slice(0, depth - 1);
      while (stack.length < depth - 1) stack.push("…");
      stack.push(title);
      current = { heading: title, headingDepth: depth, body: [], lineStart: i + 1, pathStack: [...stack] };
    } else {
      current.body.push(lines[i]);
    }
  }
  sections.push(current);

  let spanIdx = 0;
  for (const sec of sections) {
    const body = sec.body.join("\n").trim();
    if (!body && !sec.heading) continue;
    const text = sec.heading ? `${sec.heading}\n\n${body}`.trim() : body;
    out.push({
      spanId: makeSpanId(spanIdx++),
      sourceType: "markdown_section",
      sourceFile,
      path: sec.pathStack.length ? sec.pathStack.join(" > ") : "document",
      heading: sec.heading,
      title: sec.heading,
      text,
      lineStart: sec.lineStart,
      textSha256: await sha256(text),
    });
  }
  return out.length ? out : segmentPlain(text, sourceFile);
}

async function segmentLegalNorm(text: string, sourceFile?: string): Promise<SourceSpan[]> {
  const out: SourceSpan[] = [];
  // Split on "Art. N" markers preserving them.
  const parts = text.split(/(?=^\s*Art\.\s*\d+)/m);
  let spanIdx = 0;
  for (const part of parts) {
    const body = part.trim();
    if (!body) continue;
    const m = body.match(/^Art\.\s*(\d+\w*)/);
    const recordId = m ? `Art. ${m[1]}` : undefined;
    out.push({
      spanId: makeSpanId(spanIdx++),
      sourceType: "legal_article",
      sourceRecordId: recordId,
      sourceFile,
      path: recordId ?? `section[${spanIdx - 1}]`,
      heading: recordId,
      title: recordId,
      text: body,
      textSha256: await sha256(body),
    });
  }
  return out.length ? out : segmentPlain(text, sourceFile);
}

async function segmentFaq(text: string, sourceFile?: string): Promise<SourceSpan[]> {
  const out: SourceSpan[] = [];
  // Split on "Q:" / "Pergunta:" boundaries.
  const blocks = text.split(/(?=^\s*(?:Q:|P:|Pergunta\s*[:\-—]|Question\s*[:\-—]))/im);
  let spanIdx = 0;
  for (const block of blocks) {
    const body = block.trim();
    if (!body) continue;
    const qMatch = body.match(/^(?:Q:|P:|Pergunta\s*[:\-—]|Question\s*[:\-—])\s*(.+?)(?:\n|$)/i);
    const title = qMatch ? qMatch[1].trim().slice(0, 200) : undefined;
    out.push({
      spanId: makeSpanId(spanIdx++),
      sourceType: "faq_pair",
      sourceFile,
      path: title ?? `qa[${spanIdx - 1}]`,
      heading: null,
      title: title ?? null,
      text: body,
      textSha256: await sha256(body),
    });
  }
  return out.length ? out : segmentPlain(text, sourceFile);
}

async function segmentPlain(text: string, sourceFile?: string): Promise<SourceSpan[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // One span covering the full doc; the chunker will sub-divide.
  return [
    {
      spanId: makeSpanId(0),
      sourceType: "document",
      sourceFile,
      path: "document",
      heading: null,
      title: null,
      text: trimmed,
      charStart: 0,
      charEnd: trimmed.length,
      lineStart: 1,
      lineEnd: trimmed.split(/\r?\n/).length,
      textSha256: await sha256(trimmed),
    },
  ];
}

/** Convert spans to a metadata-friendly manifest (text_preview only, no full body). */
export function buildSourceManifest(spans: SourceSpan[]): SourceManifestEntry[] {
  return spans.map((s) => ({
    source_id: s.spanId,
    source_type: s.sourceType,
    source_record_id: s.sourceRecordId,
    source_file: s.sourceFile,
    path: s.path,
    heading: s.heading ?? null,
    title: s.title ?? null,
    line_start: s.lineStart,
    line_end: s.lineEnd,
    char_start: s.charStart,
    char_end: s.charEnd,
    text_sha256: s.textSha256,
    text_preview: s.text.replace(/\s+/g, " ").trim().slice(0, 200),
  }));
}
