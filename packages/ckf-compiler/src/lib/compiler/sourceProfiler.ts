// CKF Compiler v1.2 — Preflight / source profiling.
//
// Runs BEFORE chunking and LLM calls. Detects language, format, record count
// and surfaces blocking warnings when the input has no extractable content
// (e.g. only a filename or sha256 hash). Output drives:
//   - segmenter routing (JSONL vs markdown vs plain text)
//   - chunker maxChars heuristic
//   - language lock (prevents PT being mislabeled as EN)
//   - UI preflight panel

import { containsPortugueseSignals, containsEnglishSignals, detectLanguage } from "./text-filters";

export type DetectedFormat =
  | "jsonl_records"
  | "json_array_records"
  | "faq"
  | "markdown"
  | "plain_text"
  | "transcript"
  | "html_text"
  | "legal_norm"
  | "technical_docs"
  | "manual"
  | "unknown";

export type DetectedLanguage = "pt" | "pt-BR" | "en" | "es" | "unknown";

export type SourceProfile = {
  sourceCharCount: number;
  sourceWordCount: number;
  detectedLanguage: DetectedLanguage;
  detectedFormat: DetectedFormat;
  recordCount: number;
  estimatedChunks: number;
  hasStructuredRecords: boolean;
  extractionLooksValid: boolean;
  warnings: string[];
  /** Hard error — caller must abort compilation if true. */
  blocked: boolean;
  blockedReason?: string;
};

const SHA_HEX_RE = /^[a-f0-9]{40,64}(\.[a-z0-9]{1,8})?$/i;
const FILENAME_ONLY_RE = /^[\w\-./\\]+\.(txt|md|json|jsonl|pdf|docx|html?|yaml|yml|csv)$/i;

function isFilenameOrHashOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const firstLine = t.split(/\r?\n/)[0].trim();
  if (SHA_HEX_RE.test(firstLine) && t.length === firstLine.length) return true;
  if (FILENAME_ONLY_RE.test(firstLine) && t.length === firstLine.length) return true;
  return false;
}

function detectLanguageRobust(text: string): DetectedLanguage {
  const sample = text.length > 4000 ? text.slice(0, 4000) : text;
  // 1) Hard PT signals (accents/stopwords) override everything else.
  const ptHits = countPortugueseHits(sample);
  const enHits = countEnglishHits(sample);
  if (ptHits >= 3 && ptHits > enHits) return "pt-BR";
  // 2) Fall back to franc.
  const detected = detectLanguage(sample);
  if (detected === "pt") return "pt-BR";
  if (detected === "en") return "en";
  if (detected === "es") return "es";
  // 3) Soft heuristics.
  if (ptHits > enHits && ptHits >= 1) return "pt-BR";
  if (enHits > 0) return "en";
  return "unknown";
}

function countPortugueseHits(text: string): number {
  let n = 0;
  if (/[ãõçáéíóúâêô]/i.test(text)) n += 2;
  if (containsPortugueseSignals(text)) n += 1;
  const stopwords = text.match(/\b(não|são|está|também|para|com|que|quando|deve|sobre|uma|pelo|pela|porque|isso|essa|esse|este|esta)\b/gi);
  if (stopwords) n += Math.min(5, Math.floor(stopwords.length / 3));
  return n;
}

function countEnglishHits(text: string): number {
  let n = 0;
  if (containsEnglishSignals(text)) n += 1;
  const stopwords = text.match(/\b(the|and|with|that|from|this|these|those|should|when|where|which|while|what)\b/gi);
  if (stopwords) n += Math.min(5, Math.floor(stopwords.length / 5));
  return n;
}

function detectFormat(text: string): { format: DetectedFormat; recordCount: number; hasStructured: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { format: "unknown", recordCount: 0, hasStructured: false };

  // JSONL: every non-empty line is valid JSON with text-like field.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 2 && lines.length <= 100_000) {
    let parsed = 0;
    let textBearing = 0;
    const sample = lines.slice(0, Math.min(lines.length, 50));
    for (const line of sample) {
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === "object") {
          parsed++;
          if (typeof (obj as Record<string, unknown>).text === "string" ||
              typeof (obj as Record<string, unknown>).content === "string" ||
              typeof (obj as Record<string, unknown>).body === "string" ||
              typeof (obj as Record<string, unknown>).answer === "string" ||
              typeof (obj as Record<string, unknown>).resposta === "string") {
            textBearing++;
          }
        }
      } catch {
        // Not JSON.
      }
    }
    if (parsed >= sample.length * 0.9 && textBearing >= sample.length * 0.5) {
      return { format: "jsonl_records", recordCount: lines.length, hasStructured: true };
    }
  }

  // JSON array of records.
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object") {
        const textBearing = arr.filter((o) =>
          o && typeof o === "object" &&
          (typeof o.text === "string" || typeof o.content === "string" ||
           typeof o.body === "string" || typeof o.answer === "string"),
        ).length;
        if (textBearing >= arr.length * 0.5) {
          return { format: "json_array_records", recordCount: arr.length, hasStructured: true };
        }
      }
    } catch {
      // Not JSON.
    }
  }

  // FAQ.
  if (/^\s*(Q:|P:|Pergunta\s*[:\-—]|Question\s*[:\-—])/im.test(trimmed) &&
      /^\s*(A:|R:|Resposta\s*[:\-—]|Answer\s*[:\-—])/im.test(trimmed)) {
    const blocks = trimmed.split(/^\s*(?:Q:|P:|Pergunta|Question)\b/im).length - 1;
    return { format: "faq", recordCount: Math.max(1, blocks), hasStructured: true };
  }

  // Legal norm: many "Art. N" markers.
  const artMatches = trimmed.match(/^\s*Art\.\s*\d+/gim);
  if (artMatches && artMatches.length >= 5) {
    return { format: "legal_norm", recordCount: artMatches.length, hasStructured: true };
  }

  // Markdown: presence of headings.
  if (/^#{1,6}\s+\S/m.test(trimmed)) {
    const headings = trimmed.match(/^#{1,6}\s+\S/gm) ?? [];
    return { format: "markdown", recordCount: headings.length, hasStructured: false };
  }

  // Transcript: timestamps + speaker pattern.
  if (/^\s*\d{1,2}:\d{2}(:\d{2})?\b/m.test(trimmed) && /^[A-Z][a-z]+\s*:/m.test(trimmed)) {
    const turns = trimmed.match(/^[A-Z][a-z]+\s*:/gm) ?? [];
    return { format: "transcript", recordCount: turns.length, hasStructured: true };
  }

  return { format: "plain_text", recordCount: 0, hasStructured: false };
}

const APPROX_CHARS_PER_CHUNK = 6_000;

export function profileSource(text: string, opts?: { filename?: string }): SourceProfile {
  const warnings: string[] = [];
  const raw = text ?? "";
  const sourceCharCount = raw.length;
  const sourceWordCount = raw.split(/\s+/).filter(Boolean).length;

  // Block obvious garbage inputs (sha256 / filename-only).
  if (isFilenameOrHashOnly(raw)) {
    return {
      sourceCharCount,
      sourceWordCount,
      detectedLanguage: "unknown",
      detectedFormat: "unknown",
      recordCount: 0,
      estimatedChunks: 0,
      hasStructuredRecords: false,
      extractionLooksValid: false,
      warnings: ["Source contains only a filename or hash — no extractable content."],
      blocked: true,
      blockedReason: "ingestion_failed: source has no extractable content",
    };
  }

  if (sourceWordCount < 50) {
    warnings.push(`Source is very small (${sourceWordCount} words). Compilation may produce a sparse package.`);
  }
  if (opts?.filename) {
    const fnNoExt = opts.filename.replace(/\.[^.]+$/, "");
    if (SHA_HEX_RE.test(fnNoExt) && sourceWordCount < 200) {
      warnings.push(`Filename "${opts.filename}" looks like a hash and the source is small. Verify ingestion.`);
    }
  }

  const detectedLanguage = detectLanguageRobust(raw);
  const { format: detectedFormat, recordCount, hasStructured } = detectFormat(raw);
  const estimatedChunks = Math.max(1, Math.ceil(sourceCharCount / APPROX_CHARS_PER_CHUNK));

  // Soft warnings.
  if (detectedLanguage === "unknown" && sourceWordCount > 100) {
    warnings.push("Could not confidently detect source language. Defaulting target to English.");
  }

  return {
    sourceCharCount,
    sourceWordCount,
    detectedLanguage,
    detectedFormat,
    recordCount,
    estimatedChunks,
    hasStructuredRecords: hasStructured,
    extractionLooksValid: sourceWordCount >= 20,
    warnings,
    blocked: false,
  };
}
