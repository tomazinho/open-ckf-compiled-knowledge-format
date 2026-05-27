// Quality gates for compiled CKF v1.0 packages.
// Plano A — Tarefa 4: adds section_allocation_quality to the 4 existing scores
// to detect when knowledge collapses into atomic_units / retrieval_chunks
// while the richer normative/operational sections sit empty.

import type { MergedPackage } from "./reduce";

export type SectionAllocationSignals = {
  atomic_share: number;
  contrastive_terms_in_source: boolean;
  procedural_terms_in_source: boolean;
  conditional_terms_in_source: boolean;
  long_doc: boolean;
  source_word_count: number | null; // null when sourceText unavailable
  penalties: string[];
};

export type QualityReport = {
  coverage: number;
  density: number;
  traceability: number;
  schema_completeness: number;
  section_allocation_quality: number;

  totalItems: number;
  itemsWithRefs: number;
  itemsWithConfidence: number;
  meanConfidence: number;
  sectionsPopulated: number;
  sectionsTotal: number;
  chunks: number;
  section_allocation_signals: SectionAllocationSignals;

  // v1.02 B additions
  human_readability: number;
  ai_utility_score: number;
  section_allocation_score: number;
  language_fidelity: number;
  promotion_acceptance_rate?: number;

  overall: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const COUNTED_SECTIONS = [
  "entities", "concepts", "principles", "heuristics", "decision_rules",
  "procedures", "patterns", "anti_patterns", "causal_chains",
  "contextual_triggers", "if_then_rules", "exceptions", "mental_models",
  "playbooks", "qa_pairs", "retrieval_chunks", "atomic_units",
] as const;

const FOUNDATIONAL = ["entities", "concepts", "principles", "decision_rules", "procedures"] as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ── Plano A — Tarefa 4 ─────────────────────────────────────
const RE_CONTRAST = /\b(not|does\s+not\s+replace|instead\s+of|rather\s+than|composes?\s+with)\b/i;
const RE_PROCEDURAL = /\b(pipeline|steps?|workflow|process|sequence)\b/i;
const RE_CONDITIONAL = /\b(if|when|unless|except|does\s+not\s+apply)\b/i;

function sectionAllocationScore(pkg: MergedPackage, sourceText?: string): {
  score: number;
  signals: SectionAllocationSignals;
} {
  const penalties: string[] = [];

  const counts: Record<(typeof COUNTED_SECTIONS)[number], number> = {} as never;
  for (const k of COUNTED_SECTIONS) {
    counts[k] = ((pkg as unknown as Record<string, unknown[]>)[k] ?? []).length;
  }
  const nonTraceTotal = COUNTED_SECTIONS.reduce((acc, k) => acc + counts[k], 0);
  const atomicShare = nonTraceTotal > 0
    ? (counts.atomic_units + counts.retrieval_chunks) / nonTraceTotal
    : 0;

  let score = 1.0;

  // Rule 2: too much weight on atomic/retrieval
  if (atomicShare > 0.8) {
    score -= 0.20;
    penalties.push(`atomic+retrieval share ${(atomicShare * 100).toFixed(0)}% > 80%`);
  }

  const src = sourceText ?? "";
  const hasSrc = src.length > 0;
  const contrastive = hasSrc && RE_CONTRAST.test(src);
  const procedural = hasSrc && RE_PROCEDURAL.test(src);
  const conditional = hasSrc && RE_CONDITIONAL.test(src);
  const wordCount = hasSrc ? src.split(/\s+/).filter(Boolean).length : 0;
  const longDoc = wordCount > 1000;

  if (contrastive && counts.anti_patterns === 0 && counts.decision_rules === 0) {
    score -= 0.20;
    penalties.push("source has contrastive terms but anti_patterns + decision_rules are empty");
  }
  if (procedural && counts.procedures === 0 && counts.playbooks === 0) {
    score -= 0.15;
    penalties.push("source has procedural markers but procedures + playbooks are empty");
  }
  if (conditional && counts.exceptions === 0 && counts.if_then_rules === 0) {
    score -= 0.15;
    penalties.push("source has conditional markers but exceptions + if_then_rules are empty");
  }
  if (longDoc && counts.qa_pairs === 0) {
    score -= 0.10;
    penalties.push("document > 1000 words but qa_pairs is empty");
  }

  return {
    score: clamp01(score),
    signals: {
      atomic_share: Number(atomicShare.toFixed(3)),
      contrastive_terms_in_source: contrastive,
      procedural_terms_in_source: procedural,
      conditional_terms_in_source: conditional,
      long_doc: longDoc,
      source_word_count: hasSrc ? wordCount : null,
      penalties,
    },
  };
}

export function computeQuality(
  pkg: MergedPackage,
  chunks: number,
  sourceText?: string,
): QualityReport {
  let total = 0;
  let withRefs = 0;
  let withConf = 0;
  let confSum = 0;

  for (const k of COUNTED_SECTIONS) {
    const arr = (pkg as unknown as Record<string, Array<{ source_refs?: string[]; confidence?: number }>>)[k] ?? [];
    for (const item of arr) {
      total++;
      if (item.source_refs && item.source_refs.length > 0) withRefs++;
      if (typeof item.confidence === "number") {
        withConf++;
        confSum += item.confidence;
      }
    }
  }

  const meanConfidence = withConf > 0 ? confSum / withConf : 0;

  const foundationFilled = FOUNDATIONAL.reduce((acc, k) => {
    const arr = (pkg as unknown as Record<string, unknown[]>)[k] ?? [];
    return acc + (arr.length > 0 ? 1 : 0);
  }, 0);
  const intentScore =
    (pkg.core_intent?.primary_purpose ? 0.5 : 0) +
    (pkg.core_intent?.intended_agent_use?.length ? 0.5 : 0);
  const coverage = clamp01((foundationFilled / FOUNDATIONAL.length) * 0.8 + intentScore * 0.2);

  const perChunk = chunks > 0 ? total / chunks : 0;
  const density = clamp01(perChunk / 6);

  const refRatio = total > 0 ? withRefs / total : 0;
  const confRatio = total > 0 ? withConf / total : 0;
  const traceability = clamp01(refRatio * 0.6 + confRatio * 0.3 + meanConfidence * 0.1);

  const sectionsPopulated =
    COUNTED_SECTIONS.reduce(
      (acc, k) => acc + ((pkg as unknown as Record<string, unknown[]>)[k]?.length ? 1 : 0),
      0,
    ) +
    (pkg.core_intent?.primary_purpose ? 1 : 0) +
    (pkg.domain_map?.main_domain ? 1 : 0) +
    (pkg.agent_instructions?.behavior_rules?.length ? 1 : 0) +
    (Object.values(pkg.knowledge_limits ?? {}).some((v) => Array.isArray(v) && v.length) ? 1 : 0);
  const sectionsTotal = COUNTED_SECTIONS.length + 4;
  const schema_completeness = clamp01(sectionsPopulated / sectionsTotal);

  const { score: section_allocation_quality, signals: section_allocation_signals } =
    sectionAllocationScore(pkg, sourceText);

  // ── v1.02 B: metadata calibration + extra signals ──────────────────────
  const human_readability = round2(coverage * 0.40 + schema_completeness * 0.60);
  const ai_utility_score = round2(traceability * 0.50 + density * 0.30 + coverage * 0.20);

  const richCount =
    (pkg.principles?.length ?? 0) +
    (pkg.decision_rules?.length ?? 0) +
    (pkg.procedures?.length ?? 0) +
    (pkg.anti_patterns?.length ?? 0) +
    (pkg.exceptions?.length ?? 0) +
    (pkg.if_then_rules?.length ?? 0) +
    (pkg.playbooks?.length ?? 0) +
    (pkg.heuristics?.length ?? 0);
  const flatCount = (pkg.atomic_units?.length ?? 0) + (pkg.retrieval_chunks?.length ?? 0);
  const totalCount = richCount + flatCount;
  const section_allocation_score = totalCount > 0
    ? Math.min(1, (richCount / totalCount) / 0.30)
    : 0;

  const promoAudit = (pkg as unknown as {
    promotion_audit?: {
      promoted_count: number;
      rejected_count: number;
      rejected_items: Array<{ reason: string }>;
    };
  }).promotion_audit;
  let language_fidelity = 1.0;
  let promotion_acceptance_rate: number | undefined;
  if (promoAudit) {
    const totalAttempted = promoAudit.promoted_count + promoAudit.rejected_count;
    const langMismatches = promoAudit.rejected_items.filter((r) => r.reason === "language_mismatch").length;
    const incompletes = promoAudit.rejected_items.filter((r) => r.reason === "incomplete_proposition").length;
    language_fidelity = totalAttempted > 0 ? 1 - langMismatches / totalAttempted : 1;
    promotion_acceptance_rate = totalAttempted > 0 ? promoAudit.promoted_count / totalAttempted : undefined;

    // Extend section_allocation_quality with v1.02 penalties
    let adjusted = section_allocation_quality;
    if (language_fidelity < 0.9) {
      adjusted -= 0.10;
      section_allocation_signals.penalties.push(`language_fidelity ${(language_fidelity * 100).toFixed(0)}% < 90%`);
    }
    if (totalAttempted > 0 && incompletes / totalAttempted > 0.25) {
      adjusted -= 0.10;
      section_allocation_signals.penalties.push(`incomplete_proposition rejections ${(incompletes / totalAttempted * 100).toFixed(0)}% > 25%`);
    }
    (pkg as unknown as { __saq?: number }).__saq = clamp01(adjusted);
  }

  // v1.03 — sanitizer-aware adjustment. If the global sanitizer removed
  // language-mismatched / truncated items, the final package is cleaner;
  // penalize fidelity proportionally to how much had to be removed.
  const sanitizerAudit = (pkg as unknown as {
    sanitizer_audit?: { rejected_items: Array<{ reason: string }> };
  }).sanitizer_audit;
  if (sanitizerAudit?.rejected_items?.length) {
    const sanitizerPenalty = Math.min(0.5, sanitizerAudit.rejected_items.length / 50);
    language_fidelity = Math.max(0, language_fidelity - sanitizerPenalty);
  }
  const adjustedSAQ = (pkg as unknown as { __saq?: number }).__saq ?? section_allocation_quality;

  const overall =
    (coverage + density + traceability + schema_completeness + adjustedSAQ) / 5;

  return {
    coverage,
    density,
    traceability,
    schema_completeness,
    section_allocation_quality: adjustedSAQ,
    totalItems: total,
    itemsWithRefs: withRefs,
    itemsWithConfidence: withConf,
    meanConfidence,
    sectionsPopulated,
    sectionsTotal,
    chunks,
    section_allocation_signals,
    human_readability,
    ai_utility_score,
    section_allocation_score: round2(section_allocation_score),
    language_fidelity: round2(language_fidelity),
    promotion_acceptance_rate: promotion_acceptance_rate !== undefined ? round2(promotion_acceptance_rate) : undefined,
    overall,
  };
}
