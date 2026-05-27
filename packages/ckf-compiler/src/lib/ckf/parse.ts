import { parse as yamlParse } from "yaml";
import type { CkfPackage } from "./types";
import { looksLikeReadableMarkdown, parseReadableMarkdown } from "./readableMd";

export type CkfFormat = "json" | "yaml" | "markdown";

export type ParseResult = {
  pkg: CkfPackage;
  format: CkfFormat;
};

function detectFormat(text: string, filename?: string): CkfFormat {
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".ckf.md")) return "markdown";
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) return "json";
  if (trimmed.startsWith("#") || trimmed.includes("```yaml")) return "markdown";
  return "yaml";
}

function parseMarkdown(text: string): Record<string, unknown> {
  // Readable report format (no YAML fences, numbered headings like `## 3. Entities`).
  if (looksLikeReadableMarkdown(text)) return parseReadableMarkdown(text);

  const merged: Record<string, unknown> = {};

  // Header `key: value` block before the first `---` separator.
  const headerEnd = text.indexOf("\n---");
  if (headerEnd > 0) {
    const header = text.slice(0, headerEnd);
    const meta: Record<string, unknown> = {};
    for (const raw of header.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (!m) continue;
      let value: unknown = m[2];
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
      meta[m[1]] = value;
    }
    if (Object.keys(meta).length > 0) merged.metadata = meta;
  }

  // Each ```yaml fenced block contains one top-level section.
  const fence = /```ya?ml\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const body = match[1];
    try {
      const obj = yamlParse(body) as Record<string, unknown> | null;
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) merged[k] = v;
      }
    } catch {
      // skip bad block
    }
  }
  return merged;
}

const EMPTY_PKG: CkfPackage = {
  metadata: {
    package_id: "unknown",
    protocol_version: "ckf-0.1",
    source_type: "Unknown",
    source_title: "Untitled",
    source_author: "Unknown",
    domain: "general knowledge",
    subdomains: [],
    language: "en",
    created_at: new Date().toISOString(),
    compression_level: "standard",
    human_readability: 0,
    ai_utility_score: 0,
  },
  core_intent: {
    primary_purpose: "",
    intended_user: "",
    intended_agent_use: "",
    transformation_goal: "",
    key_value: "",
  },
  domain_map: { main_domain: "general knowledge", subdomains: [], adjacent_domains: [], excluded_domains: [] },
  entities: [],
  concepts: [],
  principles: [],
  heuristics: [],
  decision_rules: [],
  procedures: [],
  patterns: [],
  anti_patterns: [],
  causal_chains: [],
  contextual_triggers: [],
  if_then_rules: [],
  exceptions: [],
  mental_models: [],
  playbooks: [],
  qa_pairs: [],
  retrieval_chunks: [],
  atomic_units: [],
  agent_instructions: {
    behavior_rules: [],
    reasoning_rules: [],
    response_rules: [],
    forbidden_behaviors: [],
    preferred_questions: [],
    tool_usage_guidance: [],
  },
  knowledge_limits: {
    missing_context: [],
    weakly_supported_claims: [],
    assumptions_detected: [],
    possible_biases: [],
    outdated_sections: [],
    needs_human_review: [],
  },
  source_traceability: [],
};

export function parseCkf(text: string, filename?: string): ParseResult {
  const format = detectFormat(text, filename);
  let raw: Record<string, unknown>;
  if (format === "json") {
    raw = JSON.parse(text);
  } else if (format === "yaml") {
    raw = (yamlParse(text) ?? {}) as Record<string, unknown>;
  } else {
    raw = parseMarkdown(text);
  }
  const pkg = { ...EMPTY_PKG, ...raw } as CkfPackage;
  // Merge nested defaults so downstream code never crashes on missing fields.
  pkg.metadata = { ...EMPTY_PKG.metadata, ...(pkg.metadata ?? {}) };
  pkg.core_intent = { ...EMPTY_PKG.core_intent, ...(pkg.core_intent ?? {}) };
  pkg.domain_map = { ...EMPTY_PKG.domain_map, ...(pkg.domain_map ?? {}) };
  pkg.agent_instructions = { ...EMPTY_PKG.agent_instructions, ...(pkg.agent_instructions ?? {}) };
  pkg.knowledge_limits = { ...EMPTY_PKG.knowledge_limits, ...(pkg.knowledge_limits ?? {}) };
  for (const k of [
    "entities","concepts","principles","heuristics","decision_rules","procedures","patterns",
    "anti_patterns","causal_chains","contextual_triggers","if_then_rules","exceptions",
    "mental_models","playbooks","qa_pairs","retrieval_chunks","atomic_units","source_traceability",
  ] as const) {
    if (!Array.isArray(pkg[k])) (pkg as any)[k] = [];
  }

  // Synthesize source_traceability when missing — use per-item source_excerpts
  // (CKF v1.0) or fall back to source_refs / source_location.
  if (pkg.source_traceability.length === 0) {
    const traceableSections = ([
      pkg.entities, pkg.concepts, pkg.principles, pkg.heuristics, pkg.decision_rules,
      pkg.procedures, pkg.patterns, pkg.anti_patterns, pkg.causal_chains,
      pkg.contextual_triggers, pkg.if_then_rules, pkg.exceptions, pkg.mental_models,
      pkg.playbooks, pkg.qa_pairs, pkg.retrieval_chunks, pkg.atomic_units,
    ] as unknown) as Array<Array<Record<string, unknown>>>;
    const synth: any[] = [];
    for (const section of traceableSections) {
      for (const item of section ?? []) {
        const id = item.id as string | undefined;
        if (!id) continue;
        const excerpts = (item.source_excerpts as string[] | undefined) ?? [];
        const refs = (item.source_refs as string[] | undefined) ?? [];
        const excerpt = excerpts.find((e) => e && e.trim().length > 0) ?? "";
        if (!excerpt && refs.length === 0) continue;
        synth.push({
          extracted_item_id: id,
          source_location: refs[0] ?? "document",
          source_excerpt: excerpt,
          extraction_type: (item.source_basis as string | undefined) ?? "uncertain",
        });
      }
    }
    pkg.source_traceability = synth;
  }
  return { pkg, format };
}
