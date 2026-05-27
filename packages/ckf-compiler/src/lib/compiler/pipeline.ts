// CKF Compiler v1.2 — canonical post-extraction pipeline.
//
// v1.2 adds (vs v1.1):
//   - Preflight source profiling (caller decides target language with strong
//     PT-default when source is Portuguese).
//   - Source manifest propagation (metadata.source_manifest).
//   - Schema-stable coverage pass (retrieval_chunks / qa_pairs / atomic_units
//     guaranteed per SourceSpan in `complete` mode).
//   - Numeric guards (Brazilian R$ / dates / percentages preserved literally,
//     with auto-repair of truncated prefixes).
//   - Sanitizer language recovery (>20% language_mismatch rejects with PT
//     source ⇒ relabel metadata.language and re-run once).
//   - Enriched traceability (extracted_item_path, source_record_id, line/char
//     offsets, source_basis, confidence) using the manifest.

import { reduce, type Partial as CkfPartial, type ChunkRef } from "./reduce";
import { promoteAtomicsAndChunks } from "./promote";
import {
  sanitizeMergedPackage,
  ensureIds,
  rebuildSourceTraceability,
  type SanitizerReport,
} from "./packageSanitizer";
import { computeQuality, type QualityReport } from "./quality";
import type { SourceSpan, SourceManifestEntry } from "./sourceSegmenter";
import type { SourceProfile } from "./sourceProfiler";
import { applyCoveragePass, type CoverageMode, type CoverageReport } from "./coveragePass";
import { validateAndRepair, type NumericIntegrityReport } from "./numericGuards";

export const COMPILER_VERSION = "v1.2" as const;

export type PipelineOptions = {
  chunks: ChunkRef[];
  filename?: string;
  targetLanguage?: string;
  sourceText?: string;
  disablePromotion?: boolean;
  /** v1.2 — Preflight profile produced by `profileSource`. */
  profile?: SourceProfile;
  /** v1.2 — Source spans produced by `segmentSource`. */
  spans?: SourceSpan[];
  /** v1.2 — Manifest derived from spans (also stored on metadata). */
  sourceManifest?: SourceManifestEntry[];
  /** v1.2 — Coverage mode. Default depends on detected format. */
  coverageMode?: CoverageMode;
};

export type PipelineResult = {
  pkg: ReturnType<typeof reduce>;
  quality: QualityReport;
  promotion: { promoted: number; rejected: number };
  sanitizer: SanitizerReport & {
    restored_count?: number;
    language_recovery_applied?: boolean;
  };
  warnings: string[];
  compilerVersion: typeof COMPILER_VERSION;
  /** v1.2 — Schema-stable coverage report. */
  coverage?: CoverageReport;
  /** v1.2 — Numeric integrity report. */
  numericIntegrity?: NumericIntegrityReport;
};

export function runCkfPipeline(partials: CkfPartial[], opts: PipelineOptions): PipelineResult {
  const warnings: string[] = [];

  // Resolve effective target language: caller > profile > "en".
  const profileLang = opts.profile?.detectedLanguage;
  const effectiveTarget =
    opts.targetLanguage ??
    (profileLang === "pt-BR" || profileLang === "pt" ? "pt" : undefined);

  // 1) Reduce.
  const pkg = reduce(partials, {
    chunks: opts.chunks,
    filename: opts.filename,
    targetLanguage: effectiveTarget,
  });

  // v1.2 — attach source_manifest on metadata so downstream surfaces
  // (viewer trace, MCP, recompile) get rich provenance.
  if (opts.sourceManifest && opts.sourceManifest.length > 0) {
    (pkg.metadata as unknown as Record<string, unknown>).source_manifest = opts.sourceManifest;
  }
  // Honour the resolved target language on the package metadata. Guards
  // against the LLM declaring `metadata.language = "en"` when the preflight
  // strongly detected a different language (e.g. pt-BR, es) — universal,
  // not tied to any specific source language.
  const detectedShort = profileLang ? profileLang.toLowerCase().split("-")[0] : undefined;
  if (
    detectedShort &&
    detectedShort !== "unknown" &&
    pkg.metadata.language !== detectedShort &&
    !opts.targetLanguage
  ) {
    pkg.metadata.language = detectedShort;
    warnings.push(`Pipeline v1.2: metadata.language corrigido para ${detectedShort} (preflight detectou ${profileLang}).`);
  }

  // 2) Promotion.
  const promotionResult = promoteAtomicsAndChunks(pkg, {
    enabled: !opts.disablePromotion,
    languageFilter: true,
    completenessFilter: true,
    detectConditionals: true,
  });
  warnings.push(
    opts.disablePromotion
      ? "Promotion module disabled (ablation mode)."
      : `Promotion ${COMPILER_VERSION}: ${promotionResult.promoted} promoted, ${promotionResult.rejected.length} rejected.`,
  );

  // 3) Coverage pass (BEFORE sanitizer so deterministic items are filtered
  // by the same rules as LLM output).
  let coverage: CoverageReport | undefined;
  if (opts.spans && opts.spans.length > 0) {
    const mode = opts.coverageMode ?? defaultCoverageMode(opts.profile?.detectedFormat);
    coverage = applyCoveragePass(pkg, opts.spans, mode, {
      detectedFormat: opts.profile?.detectedFormat,
    });
    warnings.push(
      `Coverage ${COMPILER_VERSION} (${mode}): +${coverage.inserted_retrieval_chunks} chunks, +${coverage.inserted_qa_pairs} qa, +${coverage.inserted_atomic_units} atomic.`,
    );
  }

  // 4) Sanitize.
  let sanitizer = sanitizeMergedPackage(pkg, {
    action: "remove",
    languageFilter: true,
    completenessFilter: true,
    truncationFilter: true,
    deduplicateRichSections: true,
    allowSourceExcerptLanguageMismatch: true,
  }) as SanitizerReport & { restored_count?: number; language_recovery_applied?: boolean };

  // v1.2 — language recovery: if >20% of rejects are language_mismatch and
  // the preflight strongly disagrees with metadata.language (in ANY direction
  // — pt, en, es, etc.), relabel metadata.language and re-run the sanitizer.
  const totalItems = countTraceableItems(pkg) + sanitizer.removed_count;
  if (
    totalItems > 0 &&
    detectedShort &&
    detectedShort !== "unknown" &&
    pkg.metadata.language !== detectedShort
  ) {
    const langMismatches = sanitizer.rejected_items.filter((r) => r.reason === "language_mismatch").length;
    if (langMismatches / Math.max(1, sanitizer.rejected_items.length) > 0.2 && langMismatches >= 3) {
      pkg.metadata.language = detectedShort;
      warnings.push(
        `Sanitizer ${COMPILER_VERSION}: language recovery aplicada → ${detectedShort} (${langMismatches} language_mismatch + preflight=${profileLang}).`,
      );
      sanitizer = sanitizeMergedPackage(pkg, {
        action: "remove",
        languageFilter: true,
        completenessFilter: true,
        truncationFilter: true,
        deduplicateRichSections: true,
        allowSourceExcerptLanguageMismatch: true,
      }) as typeof sanitizer;
      sanitizer.language_recovery_applied = true;
      sanitizer.restored_count = langMismatches;
    }
  }
  warnings.push(
    `Sanitizer ${COMPILER_VERSION}: ${sanitizer.removed_count} removed, ${sanitizer.quarantined_count} quarantined, ${sanitizer.deduplicated_count} deduplicated.`,
  );

  // 5) Ids + traceability refresh.
  ensureIds(pkg);
  rebuildSourceTraceability(pkg);

  // v1.2 — enrich traceability rows with source_manifest data.
  if (opts.sourceManifest && opts.sourceManifest.length > 0) {
    enrichTraceability(pkg, opts.sourceManifest);
  }

  // 6) Numeric guards (post-LLM validation + auto-repair).
  let numericIntegrity: NumericIntegrityReport | undefined;
  if (opts.spans && opts.spans.length > 0) {
    const spanText = new Map<string, string>();
    for (const s of opts.spans) spanText.set(s.spanId, s.text);
    numericIntegrity = validateAndRepair(pkg, spanText);
    if (numericIntegrity.corrected > 0) {
      warnings.push(
        `NumericGuards ${COMPILER_VERSION}: ${numericIntegrity.corrected} truncated value(s) auto-corrigidos.`,
      );
    }
  }

  // 7) Quality + metadata calibration.
  const sourceText = opts.sourceText ?? opts.chunks.map((c) => c.text).join("\n\n");
  const quality = computeQuality(pkg, opts.chunks.length, sourceText);
  pkg.metadata.human_readability = quality.human_readability;
  pkg.metadata.ai_utility_score = quality.ai_utility_score;

  // v1.2 — empty-package guard.
  const finalCount = countTraceableItems(pkg);
  if (sourceText.length > 1000 && finalCount === 0) {
    throw new Error(
      "CKF Compiler v1.2: source has >1000 chars but extracted 0 items. Aborting empty package.",
    );
  }

  return {
    pkg,
    quality,
    promotion: { promoted: promotionResult.promoted, rejected: promotionResult.rejected.length },
    sanitizer,
    warnings,
    compilerVersion: COMPILER_VERSION,
    coverage,
    numericIntegrity,
  };
}

function defaultCoverageMode(format?: string): CoverageMode {
  if (format === "jsonl_records" || format === "json_array_records" ||
      format === "faq" || format === "legal_norm") return "complete";
  return "balanced";
}

function countTraceableItems(pkg: ReturnType<typeof reduce>): number {
  const sections = [
    "entities", "concepts", "principles", "heuristics", "decision_rules",
    "procedures", "patterns", "anti_patterns", "causal_chains",
    "contextual_triggers", "if_then_rules", "exceptions", "mental_models",
    "playbooks", "qa_pairs", "retrieval_chunks", "atomic_units",
  ];
  let n = 0;
  for (const k of sections) {
    const arr = (pkg as unknown as Record<string, unknown[]>)[k];
    if (Array.isArray(arr)) n += arr.length;
  }
  return n;
}

function enrichTraceability(
  pkg: ReturnType<typeof reduce>,
  manifest: SourceManifestEntry[],
): void {
  const byId = new Map(manifest.map((m) => [m.source_id, m]));
  const traces = pkg.source_traceability as Array<Record<string, unknown>>;
  for (const trace of traces) {
    const loc = String(trace.source_location ?? "");
    const m = byId.get(loc);
    if (!m) continue;
    trace.source_record_id = m.source_record_id;
    trace.source_file = m.source_file;
    trace.source_path = m.path;
    trace.source_line_start = m.line_start;
    trace.source_line_end = m.line_end;
    trace.source_char_start = m.char_start;
    trace.source_char_end = m.char_end;
    if (!trace.source_basis) trace.source_basis = "explicit";
    if (typeof trace.confidence !== "number") trace.confidence = 1;
  }
}
