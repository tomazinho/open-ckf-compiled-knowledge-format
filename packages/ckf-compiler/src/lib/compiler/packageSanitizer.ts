// CKF Compiler v1.03.1 — field-aware global post-reduce sanitizer.
//
// v1.03.1 patches the v1.03 over-sanitization regression: the previous version
// applied `isCompleteProposition()` to every text field of every section,
// which deleted valid retrieval_chunks, procedures, playbooks, anti_patterns,
// concepts, entities and atomic_units whose `title`/`name`/`label`/`tags` are
// short or label-like by design. v1.03.1 differentiates field ROLES — labels,
// names, titles and tags only get language + obvious-truncation checks; only
// substantive body fields get the full completeness check. Retrieval chunks
// get a special-case preserve-and-repair path. After sanitation, IDs are
// ensured and `source_traceability` is rebuilt to drop orphan entries.
//
// Protocol stays ckf-1.0. Provenance preserved on kept items. Source excerpts
// are exempt from language filtering (verbatim quotes by design).

import type { MergedPackage, MergedSourceTrace } from "./reduce";
import {
  isLanguageConsistent,
  isLikelyWrongLanguage,
  isCompleteProposition,
  looksTruncated,
  isNearDuplicate,
} from "./text-filters";

export type SanitizerAction = "remove" | "quarantine";

export type SanitizerRejectReason =
  | "language_mismatch"
  | "truncated"
  | "incomplete_proposition"
  | "near_duplicate";

export type SanitizerReject = {
  section: string;
  item_id?: string;
  reason: SanitizerRejectReason;
  field?: string;
  text_preview: string;
};

export type SanitizerReport = {
  removed_count: number;
  quarantined_count: number;
  deduplicated_count: number;
  rejected_items: SanitizerReject[];
};

export type SanitizerOptions = {
  action?: SanitizerAction;
  languageFilter?: boolean;
  completenessFilter?: boolean;
  truncationFilter?: boolean;
  deduplicateRichSections?: boolean;
  allowSourceExcerptLanguageMismatch?: boolean;
};

const DEFAULT_OPTIONS: Required<SanitizerOptions> = {
  action: "remove",
  languageFilter: true,
  completenessFilter: true,
  truncationFilter: true,
  deduplicateRichSections: true,
  allowSourceExcerptLanguageMismatch: true,
};

const PREVIEW = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 120);

// ── v1.03.1: field role taxonomy ────────────────────────────────────────
type FieldRole = "label" | "title" | "name" | "tag" | "substantive" | "source_excerpt";
type FieldSpec = { field: string; role: FieldRole };

const SECTION_FIELD_SPECS: Record<string, FieldSpec[]> = {
  entities: [
    { field: "name", role: "name" },
    { field: "type", role: "label" },
    { field: "description", role: "substantive" },
    { field: "aliases", role: "label" },
    { field: "attributes", role: "label" },
  ],
  concepts: [
    { field: "label", role: "label" },
    { field: "definition", role: "substantive" },
  ],
  principles: [
    { field: "statement", role: "substantive" },
    { field: "rationale", role: "substantive" },
    { field: "applies_when", role: "substantive" },
    { field: "does_not_apply_when", role: "substantive" },
    { field: "operational_use", role: "substantive" },
  ],
  decision_rules: [
    { field: "condition", role: "substantive" },
    { field: "decision", role: "substantive" },
    { field: "reasoning", role: "substantive" },
    { field: "required_context", role: "substantive" },
    { field: "output_action", role: "substantive" },
    { field: "failure_mode", role: "substantive" },
  ],
  procedures: [
    { field: "name", role: "name" },
    { field: "objective", role: "substantive" },
    { field: "steps", role: "substantive" },
    { field: "success_criteria", role: "substantive" },
    { field: "failure_criteria", role: "substantive" },
  ],
  anti_patterns: [
    { field: "name", role: "name" },
    { field: "description", role: "substantive" },
    { field: "why_it_fails", role: "substantive" },
    { field: "warning_signals", role: "substantive" },
    { field: "replacement_behavior", role: "substantive" },
  ],
  exceptions: [
    { field: "general_rule", role: "substantive" },
    { field: "exception_case", role: "substantive" },
    { field: "modified_action", role: "substantive" },
    { field: "explanation", role: "substantive" },
  ],
  if_then_rules: [
    { field: "if", role: "substantive" },
    { field: "then", role: "substantive" },
    { field: "because", role: "substantive" },
  ],
  mental_models: [
    { field: "name", role: "name" },
    { field: "description", role: "substantive" },
    { field: "use_when", role: "substantive" },
    { field: "do_not_use_when", role: "substantive" },
    { field: "input_needed", role: "label" },
    { field: "output_generated", role: "label" },
  ],
  playbooks: [
    { field: "name", role: "name" },
    { field: "objective", role: "substantive" },
    { field: "activation_context", role: "substantive" },
    { field: "steps", role: "substantive" },
    { field: "expected_output", role: "substantive" },
    { field: "failure_modes", role: "substantive" },
  ],
  qa_pairs: [
    { field: "question", role: "substantive" },
    { field: "ideal_answer", role: "substantive" },
  ],
  retrieval_chunks: [
    { field: "title", role: "title" },
    { field: "standalone_context", role: "substantive" },
    { field: "compressed_knowledge", role: "substantive" },
    { field: "activation_queries", role: "label" },
  ],
  atomic_units: [
    { field: "statement", role: "substantive" },
    { field: "tags", role: "tag" },
  ],
};

function stringsFrom(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsFrom);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(stringsFrom);
  return [];
}

function getId(item: unknown): string | undefined {
  if (item && typeof item === "object" && "id" in item) {
    const id = (item as { id?: unknown }).id;
    return id != null ? String(id) : undefined;
  }
  return undefined;
}

function shouldRejectText(
  text: string,
  _section: string,
  _field: string,
  role: FieldRole,
  packageLang: string | undefined,
  opts: Required<SanitizerOptions>,
): SanitizerRejectReason | null {
  const t = text.trim();
  if (!t) return null;

  if (opts.languageFilter) {
    if (isLikelyWrongLanguage(t, packageLang)) return "language_mismatch";
    if (!isLanguageConsistent(t, packageLang)) return "language_mismatch";
  }

  if (role === "source_excerpt") return null;

  // Labels / names / titles / tags: only language + obvious truncation.
  if (role === "label" || role === "name" || role === "title" || role === "tag") {
    if (opts.truncationFilter && /[:\-/–—]\s*$/.test(t)) return "truncated";
    if (opts.truncationFilter && /\b(vs|cf|etc|e\.g|i\.e)\.?$/i.test(t)) return "truncated";
    return null;
  }

  if (role === "substantive") {
    if (opts.truncationFilter && looksTruncated(t)) return "truncated";
    if (opts.completenessFilter && t.length > 20 && !isCompleteProposition(t)) {
      return "incomplete_proposition";
    }
  }

  return null;
}

// ── v1.03.1: retrieval-chunk preserve-and-repair ────────────────────────
function isValidRetrievalChunk(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;

  const compressed = typeof obj.compressed_knowledge === "string" ? obj.compressed_knowledge.trim() : "";
  const standalone = typeof obj.standalone_context === "string" ? obj.standalone_context.trim() : "";
  const sourceRefs = Array.isArray(obj.source_refs) ? obj.source_refs : [];
  const sourceExcerpts = Array.isArray(obj.source_excerpts) ? obj.source_excerpts : [];

  const compressedOk =
    compressed.length > 30 && !looksTruncated(compressed) && isCompleteProposition(compressed);
  const standaloneOk = !standalone || (standalone.length > 20 && !looksTruncated(standalone));

  return compressedOk && standaloneOk && sourceRefs.length > 0 && sourceExcerpts.length > 0;
}

function repairRetrievalChunkTitle(item: unknown): void {
  if (!item || typeof item !== "object") return;
  const obj = item as Record<string, unknown>;

  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const compressed = typeof obj.compressed_knowledge === "string" ? obj.compressed_knowledge.trim() : "";

  // Titles are label-like by design — apply only the obvious-truncation
  // signals used for the "title" role in shouldRejectText, NOT the full
  // proposition-grade `looksTruncated` (which would mis-flag valid titles
  // like "CKF vs. RAG Architecture" that omit terminal punctuation).
  const badTitle =
    !title ||
    /[:\-/–—]\s*$/.test(title) ||
    /\b(vs|cf|etc|e\.g|i\.e)\.?$/i.test(title);

  if (!badTitle) return;

  const fallback = compressed.split(/[.!?]/)[0].replace(/\s+/g, " ").trim().slice(0, 90);
  obj.title = fallback || "Retrieval chunk";
}

// Dedup keys per spec.
const DEDUP_KEY: Record<string, string[]> = {
  principles: ["statement"],
  decision_rules: ["condition", "decision"],
  procedures: ["name", "objective"],
  anti_patterns: ["name", "description"],
  exceptions: ["general_rule", "exception_case"],
  if_then_rules: ["if", "then"],
  playbooks: ["name", "activation_context"],
  qa_pairs: ["question", "ideal_answer"],
  retrieval_chunks: ["title", "compressed_knowledge"],
  atomic_units: ["statement"],
};

function itemTextByFields(item: unknown, fields: string[]): string {
  if (!item || typeof item !== "object") return "";
  const obj = item as Record<string, unknown>;
  return fields.flatMap((f) => stringsFrom(obj[f])).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Sanitize the entire merged package in place. Field-aware: labels / names /
 * titles / tags only get language + obvious-truncation checks; substantive
 * body fields get the full completeness check. Retrieval chunks are
 * preserved-and-repaired when their compressed body + provenance are valid.
 */
export function sanitizeMergedPackage(
  pkg: MergedPackage,
  options?: SanitizerOptions,
): SanitizerReport {
  const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  const packageLang = pkg.metadata?.language;
  const rejected_items: SanitizerReject[] = [];
  let removed_count = 0;
  let quarantined_count = 0;
  let deduplicated_count = 0;

  // ── Phase 1: filter rich sections, field-aware ──
  for (const [section, specs] of Object.entries(SECTION_FIELD_SPECS)) {
    const arr = (pkg as unknown as Record<string, unknown[]>)[section];
    if (!Array.isArray(arr)) continue;

    const kept: unknown[] = [];

    for (const item of arr) {
      // v1.03.1: retrieval-chunk preserve-and-repair fast path.
      if (section === "retrieval_chunks" && isValidRetrievalChunk(item)) {
        repairRetrievalChunkTitle(item);
        kept.push(item);
        continue;
      }

      let reject: SanitizerReject | null = null;
      const obj = (item ?? {}) as Record<string, unknown>;

      for (const { field, role } of specs) {
        const texts = stringsFrom(obj[field]);
        for (const text of texts) {
          const reason = shouldRejectText(text, section, field, role, packageLang, opts);
          if (reason) {
            reject = {
              section,
              item_id: getId(item),
              reason,
              field,
              text_preview: PREVIEW(text),
            };
            break;
          }
        }
        if (reject) break;
      }

      if (reject) {
        rejected_items.push(reject);
        if (opts.action === "remove") {
          removed_count++;
          continue;
        }
        quarantined_count++;
      }

      kept.push(item);
    }

    (pkg as unknown as Record<string, unknown[]>)[section] = kept;
  }

  // ── Phase 2: dedup rich sections by section-specific key ──
  if (opts.deduplicateRichSections) {
    for (const [section, fields] of Object.entries(DEDUP_KEY)) {
      const arr = (pkg as unknown as Record<string, unknown[]>)[section];
      if (!Array.isArray(arr) || arr.length <= 1) continue;
      const kept: unknown[] = [];
      const keptDedupTexts: { text: string }[] = [];
      for (const item of arr) {
        const text = itemTextByFields(item, fields);
        if (text && isNearDuplicate(text, keptDedupTexts)) {
          deduplicated_count++;
          rejected_items.push({
            section,
            item_id: getId(item),
            reason: "near_duplicate",
            text_preview: PREVIEW(text),
          });
          continue;
        }
        kept.push(item);
        if (text) keptDedupTexts.push({ text });
      }
      (pkg as unknown as Record<string, unknown[]>)[section] = kept;
    }
  }

  const report: SanitizerReport = {
    removed_count,
    quarantined_count,
    deduplicated_count,
    rejected_items,
  };

  (pkg as unknown as { sanitizer_audit: SanitizerReport }).sanitizer_audit = report;
  return report;
}

// ── v1.03.1: ID assignment + traceability rebuild ───────────────────────

const TRACEABLE_SECTIONS = [
  "entities",
  "concepts",
  "principles",
  "heuristics",
  "decision_rules",
  "procedures",
  "patterns",
  "anti_patterns",
  "causal_chains",
  "contextual_triggers",
  "if_then_rules",
  "exceptions",
  "mental_models",
  "playbooks",
  "qa_pairs",
  "retrieval_chunks",
  "atomic_units",
];

/** Assign stable ids to any section item missing one. */
export function ensureIds(pkg: MergedPackage): void {
  for (const section of TRACEABLE_SECTIONS) {
    const arr = (pkg as unknown as Record<string, unknown[]>)[section];
    if (!Array.isArray(arr)) continue;
    arr.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const obj = item as Record<string, unknown>;
      if (!obj.id) {
        const prefix = section.split("_").map((p) => p[0]).join("");
        obj.id = `${prefix}_${String(index + 1).padStart(3, "0")}`;
      }
    });
  }
}

/**
 * Rebuild `pkg.source_traceability` from the current sections so it never
 * points to ids that the sanitizer removed.
 */
export function rebuildSourceTraceability(pkg: MergedPackage): void {
  const rebuilt: MergedSourceTrace[] = [];

  for (const section of TRACEABLE_SECTIONS) {
    const arr = (pkg as unknown as Record<string, unknown[]>)[section];
    if (!Array.isArray(arr)) continue;

    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : undefined;
      const refs = Array.isArray(obj.source_refs) ? obj.source_refs : [];
      const excerpts = Array.isArray(obj.source_excerpts) ? obj.source_excerpts : [];
      if (!id || refs.length === 0) continue;

      refs.forEach((ref, i) => {
        rebuilt.push({
          extracted_item_id: id,
          source_location: String(ref),
          source_excerpt: String(excerpts[i] ?? excerpts[0] ?? ""),
          extraction_type: section,
        });
      });
    }
  }

  pkg.source_traceability = rebuilt;
}
