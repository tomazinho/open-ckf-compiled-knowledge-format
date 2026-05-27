// Schema-stable CKF v1.0 stats. Pure, safe to import from any layer.

export type CkfV1Stats = {
  atomic_units: number;
  retrieval_chunks: number;
  entities: number;
  concepts: number;
  procedures: number;
  decisions: number;
  if_then_rules: number;
  heuristics: number;
  source_excerpts_total: number;
  items_with_trace: number;
  items_total: number;
  traceability_pct: number;
  has_metadata: boolean;
  has_core_intent: boolean;
  has_domain_map: boolean;
  language: string | null;
  source_title: string | null;
  source_author: string | null;
};

const len = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

const SECTIONS_WITH_TRACE = [
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
] as const;

export function ckfV1Stats(pkg: unknown): CkfV1Stats {
  const k = (pkg ?? {}) as Record<string, unknown>;
  const metadata = (k.metadata ?? null) as Record<string, unknown> | null;
  const coreIntent = (k.core_intent ?? null) as Record<string, unknown> | null;
  const domainMap = (k.domain_map ?? null) as Record<string, unknown> | null;

  let itemsTotal = 0;
  let itemsWithTrace = 0;
  let excerpts = 0;

  for (const section of SECTIONS_WITH_TRACE) {
    const arr = k[section];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      itemsTotal++;
      const it = item as Record<string, unknown>;
      const ex = Array.isArray(it.source_excerpts) ? (it.source_excerpts as unknown[]).length : 0;
      const refs = Array.isArray(it.source_refs) ? (it.source_refs as unknown[]).length : 0;
      excerpts += ex;
      if (ex > 0 || refs > 0) itemsWithTrace++;
    }
  }

  const traceability_pct = itemsTotal > 0 ? itemsWithTrace / itemsTotal : 0;

  const hasMetadata = !!metadata && Object.keys(metadata).length > 0;
  const hasCoreIntent =
    !!coreIntent &&
    typeof (coreIntent as { primary_purpose?: string }).primary_purpose === "string" &&
    ((coreIntent as { primary_purpose?: string }).primary_purpose ?? "").trim().length > 0;
  const hasDomainMap =
    !!domainMap &&
    typeof (domainMap as { main_domain?: string }).main_domain === "string" &&
    ((domainMap as { main_domain?: string }).main_domain ?? "").trim().length > 0;

  return {
    atomic_units: len(k.atomic_units),
    retrieval_chunks: len(k.retrieval_chunks),
    entities: len(k.entities),
    concepts: len(k.concepts),
    procedures: len(k.procedures),
    decisions: len(k.decision_rules),
    if_then_rules: len(k.if_then_rules),
    heuristics: len(k.heuristics),
    source_excerpts_total: excerpts,
    items_with_trace: itemsWithTrace,
    items_total: itemsTotal,
    traceability_pct,
    has_metadata: hasMetadata,
    has_core_intent: hasCoreIntent,
    has_domain_map: hasDomainMap,
    language: (metadata?.language as string | undefined) ?? null,
    source_title: (metadata?.source_title as string | undefined) ?? null,
    source_author: (metadata?.source_author as string | undefined) ?? null,
  };
}
