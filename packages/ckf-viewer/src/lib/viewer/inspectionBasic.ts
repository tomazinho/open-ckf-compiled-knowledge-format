// Heuristic, schema-stable Inspection Report builder.
// Pure, runs anywhere (browser or server). No network calls.
import type { CkfPackage } from "../ckf/types";
import { ckfV1Stats } from "../ckf/stats";

export type SectionCount = { key: string; label: string; count: number };

export type TraceCoverageRow = { section: string; total: number; withTrace: number; pct: number };

export type OrphanItem = { section: string; id: string; title?: string };

export type SourceCoverageRow = {
  section: string;
  id: string;
  excerpt: string;
  located: boolean;
  method: "exact" | "case_insensitive" | "whitespace" | "none";
};

export type CompressionDiff = {
  sourceBytes: number;
  ckfBytes: number;
  ratio: number; // ckfBytes / sourceBytes
  reductionPct: number; // 1 - ratio (as percent)
  sourceTokensEst: number;
  ckfTokensEst: number;
};

export type RulesCatalog = {
  if_then_rules: number;
  decision_rules: number;
  exceptions: number;
  contextual_triggers: number;
  heuristics: number;
  samples: {
    if_then: { id: string; if: string; then: string }[];
    decision: { id: string; condition: string; decision: string }[];
    exceptions: { id: string; case: string; modified: string }[];
  };
};

export type BasicReport = {
  generatedAt: string;
  pkgFileName: string | null;
  sourceFileName: string | null;
  cover: {
    title: string;
    author: string;
    domain: string;
    language: string;
    protocolVersion: string;
    packageId: string;
    compression: string;
    humanReadability: number;
    aiUtility: number;
  };
  inventory: {
    sections: SectionCount[];
    emptySections: string[];
    atomicTypeDist: Record<string, number>;
    totalItems: number;
  };
  quality: {
    humanReadability: number;
    aiUtility: number;
    compression: string;
    confidenceBuckets: { range: string; count: number }[];
    confidenceMean: number | null;
  };
  traceability: {
    overallPct: number;
    itemsTotal: number;
    itemsWithTrace: number;
    worstSections: TraceCoverageRow[];
    orphans: OrphanItem[]; // capped
    orphanCount: number;
  };
  sourceCoverage: {
    available: boolean;
    totalExcerpts: number;
    locatedExcerpts: number;
    pct: number;
    failures: SourceCoverageRow[]; // capped sample
  };
  compression: CompressionDiff | null;
  rules: RulesCatalog;
  limits: {
    missing_context: string[];
    weakly_supported_claims: string[];
    assumptions_detected: string[];
    possible_biases: string[];
    outdated_sections: string[];
    needs_human_review: string[];
  };
  antiPatterns: { id: string; name: string; description: string }[];
};

const SECTION_DEFS: { key: keyof CkfPackage; label: string }[] = [
  { key: "entities", label: "Entities" },
  { key: "concepts", label: "Concepts" },
  { key: "principles", label: "Principles" },
  { key: "heuristics", label: "Heuristics" },
  { key: "decision_rules", label: "Decision Rules" },
  { key: "procedures", label: "Procedures" },
  { key: "patterns", label: "Patterns" },
  { key: "anti_patterns", label: "Anti-patterns" },
  { key: "causal_chains", label: "Causal Chains" },
  { key: "contextual_triggers", label: "Contextual Triggers" },
  { key: "if_then_rules", label: "IF-THEN Rules" },
  { key: "exceptions", label: "Exceptions" },
  { key: "mental_models", label: "Mental Models" },
  { key: "playbooks", label: "Playbooks" },
  { key: "qa_pairs", label: "Q&A Pairs" },
  { key: "retrieval_chunks", label: "Retrieval Chunks" },
  { key: "atomic_units", label: "Atomic Units" },
  { key: "source_traceability", label: "Source Traceability" },
];

const TRACE_SECTIONS = SECTION_DEFS.filter(
  (s) => s.key !== "source_traceability",
).map((s) => s.key);

function arr(p: CkfPackage, k: keyof CkfPackage): unknown[] {
  const v = p[k];
  return Array.isArray(v) ? (v as unknown[]) : [];
}

function locate(
  text: string,
  excerpt: string,
): { located: boolean; method: SourceCoverageRow["method"] } {
  if (!text || !excerpt) return { located: false, method: "none" };
  if (text.includes(excerpt)) return { located: true, method: "exact" };
  if (text.toLowerCase().includes(excerpt.toLowerCase()))
    return { located: true, method: "case_insensitive" };
  const norm = text.replace(/\s+/g, " ").toLowerCase();
  const ne = excerpt.replace(/\s+/g, " ").trim().toLowerCase();
  if (ne && norm.includes(ne)) return { located: true, method: "whitespace" };
  return { located: false, method: "none" };
}

export function buildBasicReport(opts: {
  pkg: CkfPackage;
  pkgFileName: string | null;
  sourceText: string | null;
  sourceFileName: string | null;
  pkgRawText?: string | null; // original .ckf text for byte counts
}): BasicReport {
  const { pkg, pkgFileName, sourceText, sourceFileName, pkgRawText } = opts;
  const stats = ckfV1Stats(pkg);

  // Inventory
  const sections: SectionCount[] = SECTION_DEFS.map((s) => ({
    key: String(s.key),
    label: s.label,
    count: arr(pkg, s.key).length,
  }));
  const emptySections = sections.filter((s) => s.count === 0).map((s) => s.label);
  const atomicTypeDist: Record<string, number> = {};
  for (const u of pkg.atomic_units ?? []) {
    const t = (u.type as string) || "unknown";
    atomicTypeDist[t] = (atomicTypeDist[t] ?? 0) + 1;
  }
  const totalItems = sections.reduce((a, s) => a + s.count, 0);

  // Confidence distribution
  const confValues: number[] = [];
  for (const key of TRACE_SECTIONS) {
    for (const it of arr(pkg, key) as Array<Record<string, unknown>>) {
      const c = it?.confidence;
      if (typeof c === "number") confValues.push(c);
    }
  }
  const buckets = [
    { range: "0.0–0.5", min: 0, max: 0.5 },
    { range: "0.5–0.7", min: 0.5, max: 0.7 },
    { range: "0.7–0.85", min: 0.7, max: 0.85 },
    { range: "0.85–1.0", min: 0.85, max: 1.0001 },
  ];
  const confidenceBuckets = buckets.map((b) => ({
    range: b.range,
    count: confValues.filter((v) => v >= b.min && v < b.max).length,
  }));
  const confidenceMean = confValues.length
    ? confValues.reduce((a, b) => a + b, 0) / confValues.length
    : null;

  // Traceability per section
  const worstRows: TraceCoverageRow[] = [];
  const orphans: OrphanItem[] = [];
  for (const key of TRACE_SECTIONS) {
    const items = arr(pkg, key) as Array<Record<string, unknown>>;
    if (items.length === 0) continue;
    let withTrace = 0;
    for (const it of items) {
      const ex = Array.isArray(it.source_excerpts) ? it.source_excerpts.length : 0;
      const refs = Array.isArray(it.source_refs) ? it.source_refs.length : 0;
      if (ex > 0 || refs > 0) withTrace++;
      else if (typeof it.id === "string") {
        orphans.push({
          section: String(key),
          id: it.id,
          title:
            (typeof it.name === "string" && it.name) ||
            (typeof it.label === "string" && it.label) ||
            (typeof it.statement === "string" && it.statement.slice(0, 80)) ||
            undefined,
        });
      }
    }
    worstRows.push({
      section: String(key),
      total: items.length,
      withTrace,
      pct: items.length ? withTrace / items.length : 1,
    });
  }
  worstRows.sort((a, b) => a.pct - b.pct);

  // Source coverage
  let sourceCoverage: BasicReport["sourceCoverage"] = {
    available: false,
    totalExcerpts: 0,
    locatedExcerpts: 0,
    pct: 0,
    failures: [],
  };
  if (sourceText && sourceText.length > 0) {
    const failures: SourceCoverageRow[] = [];
    let total = 0;
    let located = 0;
    for (const key of TRACE_SECTIONS) {
      for (const it of arr(pkg, key) as Array<Record<string, unknown>>) {
        if (!Array.isArray(it.source_excerpts)) continue;
        for (const exRaw of it.source_excerpts) {
          if (typeof exRaw !== "string" || !exRaw.trim()) continue;
          total++;
          const res = locate(sourceText, exRaw);
          if (res.located) {
            located++;
          } else if (failures.length < 10) {
            failures.push({
              section: String(key),
              id: typeof it.id === "string" ? it.id : "—",
              excerpt: exRaw.slice(0, 220),
              located: false,
              method: res.method,
            });
          }
        }
      }
    }
    sourceCoverage = {
      available: true,
      totalExcerpts: total,
      locatedExcerpts: located,
      pct: total ? located / total : 0,
      failures,
    };
  }

  // Compression diff
  let compression: CompressionDiff | null = null;
  if (sourceText && pkgRawText) {
    const sourceBytes = new TextEncoder().encode(sourceText).length;
    const ckfBytes = new TextEncoder().encode(pkgRawText).length;
    const ratio = sourceBytes > 0 ? ckfBytes / sourceBytes : 0;
    compression = {
      sourceBytes,
      ckfBytes,
      ratio,
      reductionPct: (1 - ratio) * 100,
      sourceTokensEst: Math.round(sourceText.length / 4),
      ckfTokensEst: Math.round(pkgRawText.length / 4),
    };
  }

  // Rules catalog samples
  const rules: RulesCatalog = {
    if_then_rules: pkg.if_then_rules?.length ?? 0,
    decision_rules: pkg.decision_rules?.length ?? 0,
    exceptions: pkg.exceptions?.length ?? 0,
    contextual_triggers: pkg.contextual_triggers?.length ?? 0,
    heuristics: pkg.heuristics?.length ?? 0,
    samples: {
      if_then: (pkg.if_then_rules ?? []).slice(0, 5).map((r) => ({
        id: r.id, if: r.if, then: r.then,
      })),
      decision: (pkg.decision_rules ?? []).slice(0, 5).map((r) => ({
        id: r.id, condition: r.condition, decision: r.decision,
      })),
      exceptions: (pkg.exceptions ?? []).slice(0, 5).map((r) => ({
        id: r.id, case: r.exception_case, modified: r.modified_action,
      })),
    },
  };

  return {
    generatedAt: new Date().toISOString(),
    pkgFileName,
    sourceFileName,
    cover: {
      title: pkg.metadata?.source_title ?? "(untitled)",
      author: pkg.metadata?.source_author ?? "—",
      domain: pkg.metadata?.domain ?? "—",
      language: pkg.metadata?.language ?? "—",
      protocolVersion: pkg.metadata?.protocol_version ?? "—",
      packageId: pkg.metadata?.package_id ?? "—",
      compression: pkg.metadata?.compression_level ?? "—",
      humanReadability: pkg.metadata?.human_readability ?? 0,
      aiUtility: pkg.metadata?.ai_utility_score ?? 0,
    },
    inventory: {
      sections,
      emptySections,
      atomicTypeDist,
      totalItems,
    },
    quality: {
      humanReadability: pkg.metadata?.human_readability ?? 0,
      aiUtility: pkg.metadata?.ai_utility_score ?? 0,
      compression: pkg.metadata?.compression_level ?? "—",
      confidenceBuckets,
      confidenceMean,
    },
    traceability: {
      overallPct: stats.traceability_pct,
      itemsTotal: stats.items_total,
      itemsWithTrace: stats.items_with_trace,
      worstSections: worstRows.slice(0, 5),
      orphans: orphans.slice(0, 25),
      orphanCount: orphans.length,
    },
    sourceCoverage,
    compression,
    rules,
    limits: {
      missing_context: pkg.knowledge_limits?.missing_context ?? [],
      weakly_supported_claims: pkg.knowledge_limits?.weakly_supported_claims ?? [],
      assumptions_detected: pkg.knowledge_limits?.assumptions_detected ?? [],
      possible_biases: pkg.knowledge_limits?.possible_biases ?? [],
      outdated_sections: pkg.knowledge_limits?.outdated_sections ?? [],
      needs_human_review: pkg.knowledge_limits?.needs_human_review ?? [],
    },
    antiPatterns: (pkg.anti_patterns ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
    })),
  };
}
