// Map-reduce merger: combines per-chunk CKF v1.0 partials into one canonical package.
// Phase 1: accepts the richer v1.0 item shapes; deeper merging of new sections
// (patterns, playbooks, qa_pairs, retrieval_chunks, etc.) ships in Phase 2.

import { promoteAtomicUnitsToStructuredSections } from "./promote";

type TraceFields = {
  id?: string;
  source_basis?: string;
  confidence?: number;
  source_refs?: string[];
  source_excerpts?: string[];
};

export type PartialMetadata = {
  source_title?: string;
  source_type?: string;
  source_author?: string;
  language?: string;
  suggested_domain?: string;
  suggested_subdomains?: string[];
};

export type PartialEntity = TraceFields & {
  name: string;
  type: string;
  description: string;
  aliases?: string[];
  attributes?: string[];
  related?: { name: string; relation: string }[];
};

export type PartialConcept = TraceFields & {
  label: string;
  definition: string;
  depends_on?: string[];
  supports?: string[];
  contradicts?: string[];
  enables?: string[];
  risks?: string[];
};

export type PartialPrinciple = TraceFields & {
  statement: string;
  applies_when?: string;
  does_not_apply_when?: string;
  rationale?: string;
  operational_use?: string;
};

export type PartialHeuristic = TraceFields & {
  trigger: string;
  recommended_action: string;
  interpretation?: string;
  avoid?: string;
};

export type PartialDecisionRule = TraceFields & {
  condition: string;
  decision: string;
  reasoning?: string;
  required_context?: string;
  output_action?: string;
  failure_mode?: string;
};

export type PartialProcedure = TraceFields & {
  name: string;
  objective?: string;
  steps: Array<{ step?: number; action: string; input_required?: string; output_expected?: string } | string>;
  success_criteria?: string;
  failure_criteria?: string;
};

export type PartialCausalChain = TraceFields & {
  cause: string;
  effect: string;
  mechanism?: string;
  secondary_effects?: string[];
  intervention_points?: string[];
};

export type PartialAntiPattern = TraceFields & {
  name: string;
  description: string;
  why_it_fails?: string;
  warning_signals?: string;
  replacement_behavior?: string;
};

export type PartialAtomicUnit = TraceFields & {
  statement: string;
  type?: string;
  tags?: string[];
  dependencies?: string[];
};

export type Partial = {
  metadata?: PartialMetadata;
  core_intent?: TraceFields & {
    primary_purpose?: string;
    intended_user?: string;
    intended_agent_use?: string[];
    transformation_goal?: string;
    key_value?: string;
  };
  domain_map?:
    | { main_domain?: string; subdomains?: string[]; adjacent_domains?: string[]; excluded_domains?: string[] }
    | string[];
  entities?: PartialEntity[];
  concepts?: PartialConcept[];
  principles?: PartialPrinciple[];
  heuristics?: PartialHeuristic[];
  decision_rules?: PartialDecisionRule[];
  procedures?: PartialProcedure[];
  patterns?: Array<TraceFields & { name: string; observed_when?: string; signal?: string; underlying_mechanism?: string; response_strategy?: string }>;
  anti_patterns?: PartialAntiPattern[];
  causal_chains?: PartialCausalChain[];
  contextual_triggers?: Array<TraceFields & { if_user_says_or_context_contains: string; activate_knowledge?: string[]; agent_should?: string; agent_should_not?: string }>;
  if_then_rules?: Array<TraceFields & { if: string; then: string; because?: string }>;
  exceptions?: Array<TraceFields & { general_rule: string; exception_case: string; modified_action?: string; explanation?: string }>;
  mental_models?: Array<TraceFields & { name: string; description: string; use_when?: string; do_not_use_when?: string; input_needed?: string; output_generated?: string }>;
  playbooks?: Array<TraceFields & { name: string; objective?: string; activation_context?: string; steps: string[]; agent_tone?: string; tools_needed?: string[]; expected_output?: string; failure_modes?: string[] }>;
  qa_pairs?: Array<TraceFields & { question: string; ideal_answer: string; source_concepts?: string[]; difficulty?: string; answer_type?: string }>;
  retrieval_chunks?: Array<TraceFields & { title: string; standalone_context?: string; compressed_knowledge: string; activation_queries?: string[]; related_rules?: string[]; related_entities?: string[]; related_concepts?: string[] }>;
  atomic_units?: PartialAtomicUnit[];
  agent_instructions?: {
    behavior_rules?: string[];
    reasoning_rules?: string[];
    response_rules?: string[];
    forbidden_behaviors?: string[];
    preferred_questions?: string[];
    tool_usage_guidance?: string[];
  };
  knowledge_limits?:
    | string[]
    | {
        missing_context?: string[];
        weakly_supported_claims?: string[];
        assumptions_detected?: string[];
        possible_biases?: string[];
        outdated_sections?: string[];
        needs_human_review?: string[];
      };
};

export type MergedMetadata = {
  package_id: string;
  protocol_version: string;
  source_type: string;
  source_title: string;
  source_author: string;
  domain: string;
  subdomains: string[];
  language: string;
  created_at: string;
  compression_level: string;
  human_readability: number;
  ai_utility_score: number;
};

export type MergedSourceTrace = {
  extracted_item_id: string;
  source_location: string;
  source_excerpt: string;
  extraction_type: string;
};

export type MergedPackage = {
  metadata: MergedMetadata;
  core_intent: {
    primary_purpose: string;
    intended_user: string;
    intended_agent_use: string[];
    transformation_goal: string;
    key_value: string;
  };
  domain_map: { main_domain: string; subdomains: string[]; adjacent_domains: string[]; excluded_domains: string[] };
  entities: PartialEntity[];
  concepts: PartialConcept[];
  principles: PartialPrinciple[];
  heuristics: PartialHeuristic[];
  decision_rules: PartialDecisionRule[];
  procedures: PartialProcedure[];
  patterns: NonNullable<Partial["patterns"]>;
  anti_patterns: PartialAntiPattern[];
  causal_chains: PartialCausalChain[];
  contextual_triggers: NonNullable<Partial["contextual_triggers"]>;
  if_then_rules: NonNullable<Partial["if_then_rules"]>;
  exceptions: NonNullable<Partial["exceptions"]>;
  mental_models: NonNullable<Partial["mental_models"]>;
  playbooks: NonNullable<Partial["playbooks"]>;
  qa_pairs: NonNullable<Partial["qa_pairs"]>;
  retrieval_chunks: NonNullable<Partial["retrieval_chunks"]>;
  atomic_units: PartialAtomicUnit[];
  agent_instructions: {
    behavior_rules: string[];
    reasoning_rules: string[];
    response_rules: string[];
    forbidden_behaviors: string[];
    preferred_questions: string[];
    tool_usage_guidance: string[];
  };
  knowledge_limits: {
    missing_context: string[];
    weakly_supported_claims: string[];
    assumptions_detected: string[];
    possible_biases: string[];
    outdated_sections: string[];
    needs_human_review: string[];
  };
  source_traceability: MergedSourceTrace[];
};

export type ChunkRef = { spanId: string; path: string; text: string };

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

const STOPWORDS = new Set([
  "the","a","an","of","to","in","on","for","and","or","is","are","be","with","as","at","by","from","that","this","it","its","their","our","your","you","we","they",
  "o","a","os","as","de","da","do","das","dos","em","no","na","nos","nas","para","por","com","e","ou","é","ser","um","uma","uns","umas","que","se","seu","sua","seus","suas","isso","isto","ele","ela","eles","elas",
]);
function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  const uni = a.size + b.size - inter;
  return inter / uni;
}
/** Find an existing key in `keys` whose label is fuzzy-similar to `label`. */
function findFuzzy(label: string, aliases: string[], keys: { key: string; aliases: string[] }[], threshold = 0.6): string | null {
  const target = tokens(label);
  const aliasToks = aliases.map(tokens);
  for (const k of keys) {
    if (k.key === norm(label)) return k.key;
    if (aliases.some((a) => norm(a) === k.key)) return k.key;
    if (k.aliases.some((a) => norm(a) === norm(label))) return k.key;
    const cand = tokens(k.key);
    if (jaccard(target, cand) >= threshold) return k.key;
    for (const at of aliasToks) {
      if (jaccard(at, cand) >= threshold) return k.key;
    }
  }
  return null;
}

function uniq<T extends string>(arr: (T | undefined | null)[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    if (!x) continue;
    const k = norm(x);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function dedupBy<T>(arr: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

/** Fuzzy dedup: merges items whose normalized key tokens are >= threshold similar. */
function dedupFuzzy<T>(arr: T[], keyFn: (t: T) => string, merger: (a: T, b: T) => T, threshold = 0.7): T[] {
  const out: { key: string; toks: Set<string>; item: T }[] = [];
  for (const x of arr) {
    const k = norm(keyFn(x));
    if (!k) continue;
    const toks = tokens(k);
    let merged = false;
    for (const o of out) {
      if (o.key === k || jaccard(o.toks, toks) >= threshold) {
        o.item = merger(o.item, x);
        merged = true;
        break;
      }
    }
    if (!merged) out.push({ key: k, toks, item: x });
  }
  return out.map((o) => o.item);
}

function mergeRelations(rels: { name: string; relation: string }[]): { name: string; relation: string }[] {
  const seen = new Set<string>();
  const out: { name: string; relation: string }[] = [];
  for (const r of rels) {
    const k = norm(r.name) + "|" + norm(r.relation);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

function mergeTrace<T extends TraceFields>(prev: T, next: TraceFields): T {
  prev.confidence = Math.max(prev.confidence ?? 0, next.confidence ?? 0);
  prev.source_refs = uniq([...(prev.source_refs ?? []), ...(next.source_refs ?? [])]);
  const order = ["explicit", "inferred", "synthesized", "author_opinion", "uncertain"];
  const a = order.indexOf(prev.source_basis ?? "uncertain");
  const b = order.indexOf(next.source_basis ?? "uncertain");
  if (b >= 0 && (a < 0 || b < a)) prev.source_basis = next.source_basis;
  return prev;
}

export type ReduceContext = {
  chunks?: ChunkRef[];
  filename?: string;
  /**
   * v1.04 — caller-authoritative target language. When provided, overrides any
   * per-chunk inference and `guessLanguage` fallback. Normalized to ISO-639-1
   * short code ("en", "pt"). Use to prevent PT chunks of an EN document (or
   * vice-versa) from contaminating the package's declared language and bypassing
   * the sanitizer's language filter.
   */
  targetLanguage?: string;
};

export function reduce(partials: Partial[], ctx: ReduceContext = {}): MergedPackage {
  // ── core_intent ────────────────────────────────────────────
  const intents = uniq(partials.flatMap((p) => p.core_intent?.intended_agent_use ?? []));
  const purposes = partials.map((p) => p.core_intent?.primary_purpose).filter(Boolean) as string[];
  const longest = (xs: (string | undefined)[]) => (xs.filter(Boolean) as string[]).sort((a, b) => b.length - a.length)[0] ?? "";

  // ── domain_map ─────────────────────────────────────────────
  const dm = partials.map((p) => p.domain_map).filter(Boolean);
  const isObj = (d: unknown): d is Exclude<Partial["domain_map"], string[] | undefined> => !!d && !Array.isArray(d);
  const domainMap = {
    main_domain: longest(dm.map((d) => (isObj(d) ? d.main_domain : undefined))),
    subdomains: uniq(dm.flatMap((d) => (isObj(d) ? d.subdomains ?? [] : (d as string[])))),
    adjacent_domains: uniq(dm.flatMap((d) => (isObj(d) ? d.adjacent_domains ?? [] : []))),
    excluded_domains: uniq(dm.flatMap((d) => (isObj(d) ? d.excluded_domains ?? [] : []))),
  };

  // ── entities (fuzzy: match by name + aliases with Jaccard fallback) ──
  const entityMap = new Map<string, PartialEntity>();
  const entityIndex: { key: string; aliases: string[] }[] = [];
  for (const p of partials) {
    for (const e of p.entities ?? []) {
      const aliases = e.aliases ?? [];
      const matched = findFuzzy(e.name, aliases, entityIndex, 0.7);
      if (!matched) {
        const key = norm(e.name);
        entityMap.set(key, { ...e, aliases, related: e.related ?? [], attributes: e.attributes ?? [] });
        entityIndex.push({ key, aliases });
      } else {
        const prev = entityMap.get(matched)!;
        prev.aliases = uniq([...(prev.aliases ?? []), ...aliases, e.name]);
        prev.attributes = uniq([...(prev.attributes ?? []), ...(e.attributes ?? [])]);
        prev.related = mergeRelations([...(prev.related ?? []), ...(e.related ?? [])]);
        if (e.description.length > prev.description.length) prev.description = e.description;
        mergeTrace(prev, e);
        const slot = entityIndex.find((x) => x.key === matched);
        if (slot) slot.aliases = prev.aliases ?? [];
      }
    }
  }

  // ── concepts (fuzzy on label) ──
  const conceptMap = new Map<string, PartialConcept>();
  const conceptIndex: { key: string; aliases: string[] }[] = [];
  for (const p of partials) {
    for (const c of p.concepts ?? []) {
      const matched = findFuzzy(c.label, [], conceptIndex, 0.75);
      if (!matched) {
        const key = norm(c.label);
        conceptMap.set(key, {
          ...c,
          depends_on: c.depends_on ?? [],
          supports: c.supports ?? [],
          contradicts: c.contradicts ?? [],
          enables: c.enables ?? [],
          risks: c.risks ?? [],
        });
        conceptIndex.push({ key, aliases: [] });
      } else {
        const prev = conceptMap.get(matched)!;
        prev.depends_on = uniq([...(prev.depends_on ?? []), ...(c.depends_on ?? [])]);
        prev.supports = uniq([...(prev.supports ?? []), ...(c.supports ?? [])]);
        prev.contradicts = uniq([...(prev.contradicts ?? []), ...(c.contradicts ?? [])]);
        prev.enables = uniq([...(prev.enables ?? []), ...(c.enables ?? [])]);
        prev.risks = uniq([...(prev.risks ?? []), ...(c.risks ?? [])]);
        if (c.definition.length > prev.definition.length) prev.definition = c.definition;
        mergeTrace(prev, c);
      }
    }
  }

  // ── agent_instructions ─────────────────────────────────────
  const ai = partials.map((p) => p.agent_instructions ?? {});
  const agent_instructions = {
    behavior_rules: uniq(ai.flatMap((x) => x.behavior_rules ?? [])),
    reasoning_rules: uniq(ai.flatMap((x) => x.reasoning_rules ?? [])),
    response_rules: uniq(ai.flatMap((x) => x.response_rules ?? [])),
    forbidden_behaviors: uniq(ai.flatMap((x) => x.forbidden_behaviors ?? [])),
    preferred_questions: uniq(ai.flatMap((x) => x.preferred_questions ?? [])),
    tool_usage_guidance: uniq(ai.flatMap((x) => x.tool_usage_guidance ?? [])),
  };

  // ── knowledge_limits ───────────────────────────────────────
  const kl = partials.map((p) => p.knowledge_limits).filter(Boolean);
  const klObj = (k: unknown): k is Exclude<Partial["knowledge_limits"], string[] | undefined> => !!k && !Array.isArray(k);
  const klStrings = kl.flatMap((k) => (Array.isArray(k) ? (k as string[]) : []));
  const knowledge_limits = {
    missing_context: uniq([...kl.flatMap((k) => (klObj(k) ? k.missing_context ?? [] : [])), ...klStrings]),
    weakly_supported_claims: uniq(kl.flatMap((k) => (klObj(k) ? k.weakly_supported_claims ?? [] : []))),
    assumptions_detected: uniq(kl.flatMap((k) => (klObj(k) ? k.assumptions_detected ?? [] : []))),
    possible_biases: uniq(kl.flatMap((k) => (klObj(k) ? k.possible_biases ?? [] : []))),
    outdated_sections: uniq(kl.flatMap((k) => (klObj(k) ? k.outdated_sections ?? [] : []))),
    needs_human_review: uniq(kl.flatMap((k) => (klObj(k) ? k.needs_human_review ?? [] : []))),
  };

  const fuseTrace = <T extends TraceFields>(a: T, b: T): T => {
    mergeTrace(a, b);
    // Also merge source_excerpts.
    a.source_excerpts = uniq([...(a.source_excerpts ?? []), ...(b.source_excerpts ?? [])]);
    return a;
  };

  // ── metadata (merge across partials + filename fallback) ───
  const metaPartials = partials.map((p) => p.metadata ?? {}) as PartialMetadata[];
  // v1.04 — caller's target language is authoritative. Normalize "pt-BR" → "pt".
  const normalizedTarget = ctx.targetLanguage
    ? ctx.targetLanguage.toLowerCase().split("-")[0]
    : undefined;
  const detectedLanguage =
    normalizedTarget ??
    metaPartials.map((m) => m.language).find(Boolean) ??
    guessLanguage(partials);
  const metadata: MergedMetadata = {
    package_id: `pkg_${Date.now().toString(36)}`,
    protocol_version: "ckf-1.0",
    source_type: longest(metaPartials.map((m) => m.source_type)) || "document",
    source_title:
      longest(metaPartials.map((m) => m.source_title)) ||
      (ctx.filename ? ctx.filename.replace(/\.[^.]+$/, "") : "Untitled"),
    source_author: longest(metaPartials.map((m) => m.source_author)) || "Unknown",
    domain:
      longest(metaPartials.map((m) => m.suggested_domain)) ||
      domainMap.main_domain ||
      "general knowledge",
    subdomains: uniq(metaPartials.flatMap((m) => m.suggested_subdomains ?? []).concat(domainMap.subdomains)),
    language: detectedLanguage || "en",
    created_at: new Date().toISOString(),
    compression_level: "standard",
    human_readability: 0,
    ai_utility_score: 0,
  };

  const merged: MergedPackage = {
    metadata,
    core_intent: {
      primary_purpose: purposes.sort((a, b) => b.length - a.length)[0] ?? "",
      intended_user: longest(partials.map((p) => p.core_intent?.intended_user)),
      intended_agent_use: intents,
      transformation_goal: longest(partials.map((p) => p.core_intent?.transformation_goal)),
      key_value: longest(partials.map((p) => p.core_intent?.key_value)),
    },
    domain_map: domainMap,
    entities: Array.from(entityMap.values()),
    concepts: Array.from(conceptMap.values()),
    principles: dedupFuzzy(partials.flatMap((p) => p.principles ?? []), (x) => x.statement, fuseTrace, 0.75),
    heuristics: dedupFuzzy(partials.flatMap((p) => p.heuristics ?? []), (h) => h.trigger + " " + h.recommended_action, fuseTrace, 0.75),
    decision_rules: dedupFuzzy(partials.flatMap((p) => p.decision_rules ?? []), (r) => r.condition + " " + r.decision, fuseTrace, 0.75),
    procedures: dedupFuzzy(
      partials.flatMap((p) => p.procedures ?? []),
      (pr) => (pr.objective ?? pr.name) + " " + (pr.steps ?? []).map((s) => (typeof s === "string" ? s : s.action ?? "")).join(" "),
      fuseTrace,
      0.7,
    ),
    patterns: dedupBy(partials.flatMap((p) => p.patterns ?? []), (x) => norm(x.name)),
    anti_patterns: dedupFuzzy(
      partials.flatMap((p) => p.anti_patterns ?? []),
      (x) => x.name + " " + (x.description ?? x.why_it_fails ?? ""),
      fuseTrace,
      0.75,
    ),
    causal_chains: dedupFuzzy(partials.flatMap((p) => p.causal_chains ?? []), (c) => c.cause + " " + c.effect, fuseTrace, 0.75),
    contextual_triggers: dedupFuzzy(partials.flatMap((p) => p.contextual_triggers ?? []), (x) => x.if_user_says_or_context_contains, fuseTrace, 0.75),
    if_then_rules: dedupFuzzy(partials.flatMap((p) => p.if_then_rules ?? []), (r) => r.if + " " + r.then, fuseTrace, 0.75),
    exceptions: dedupFuzzy(
      partials.flatMap((p) => p.exceptions ?? []),
      (e) => e.general_rule + " " + e.exception_case,
      fuseTrace,
      0.75,
    ),
    mental_models: dedupBy(partials.flatMap((p) => p.mental_models ?? []), (m) => norm(m.name)),
    playbooks: dedupFuzzy(
      partials.flatMap((p) => p.playbooks ?? []),
      (pb) => (pb.objective ?? pb.name) + " " + (pb.activation_context ?? ""),
      fuseTrace,
      0.7,
    ),
    qa_pairs: dedupFuzzy(partials.flatMap((p) => p.qa_pairs ?? []), (q) => q.question, fuseTrace, 0.8),
    retrieval_chunks: dedupBy(partials.flatMap((p) => p.retrieval_chunks ?? []), (rc) => norm(rc.title)),
    atomic_units: dedupFuzzy(partials.flatMap((p) => p.atomic_units ?? []), (a) => a.statement, fuseTrace, 0.8),
    agent_instructions,
    knowledge_limits,
    source_traceability: [],
  };

  // Plano A — Tarefa 2: promote eligible knowledge from atomic_units /
  // retrieval_chunks into the richer normative/operational sections.
  // Runs BEFORE id assignment and traceability so promoted items get ids
  // and a row in source_traceability.
  promoteAtomicUnitsToStructuredSections(merged);

  // Re-deduplicate the rich sections after promotion (promoted items may
  // collide with what the LLM already extracted).
  merged.principles = dedupFuzzy(merged.principles, (x) => x.statement, fuseTrace, 0.75);
  merged.decision_rules = dedupFuzzy(
    merged.decision_rules,
    (r) => r.condition + " " + r.decision,
    fuseTrace,
    0.75,
  );
  merged.anti_patterns = dedupFuzzy(
    merged.anti_patterns,
    (x) => x.name + " " + (x.description ?? x.why_it_fails ?? ""),
    fuseTrace,
    0.75,
  );
  merged.exceptions = dedupFuzzy(
    merged.exceptions,
    (e) => e.general_rule + " " + e.exception_case,
    fuseTrace,
    0.75,
  );
  merged.procedures = dedupFuzzy(
    merged.procedures,
    (pr) => (pr.objective ?? pr.name) + " " + (pr.steps ?? []).map((s) => (typeof s === "string" ? s : s.action ?? "")).join(" "),
    fuseTrace,
    0.7,
  );
  merged.playbooks = dedupFuzzy(
    merged.playbooks,
    (pb) => (pb.objective ?? pb.name) + " " + (pb.activation_context ?? ""),
    fuseTrace,
    0.7,
  );
  merged.qa_pairs = dedupFuzzy(merged.qa_pairs, (q) => q.question, fuseTrace, 0.8);

  assignStableIds(merged);
  merged.source_traceability = buildTraceability(merged, ctx.chunks ?? []);
  return merged;
}

// Build extracted_item_id → excerpt + location map.
function buildTraceability(pkg: MergedPackage, chunks: ChunkRef[]): MergedSourceTrace[] {
  const chunkBySpan = new Map<string, ChunkRef>();
  for (const c of chunks) chunkBySpan.set(c.spanId, c);

  const out: MergedSourceTrace[] = [];
  const sections: TraceFields[][] = [
    pkg.entities, pkg.concepts, pkg.principles, pkg.heuristics, pkg.decision_rules,
    pkg.procedures, pkg.patterns, pkg.anti_patterns, pkg.causal_chains,
    pkg.contextual_triggers, pkg.if_then_rules, pkg.exceptions, pkg.mental_models,
    pkg.playbooks, pkg.qa_pairs, pkg.retrieval_chunks, pkg.atomic_units,
  ];

  for (const section of sections) {
    for (const item of section) {
      if (!item.id) continue;
      const refs = item.source_refs ?? [];
      const firstChunk = refs.map((r) => chunkBySpan.get(r)).find(Boolean);
      const excerpts = item.source_excerpts ?? [];
      const excerpt =
        excerpts.find((e) => e && e.trim().length > 0) ??
        (firstChunk ? firstChunk.text.slice(0, 600) : "");
      out.push({
        extracted_item_id: item.id,
        source_location: firstChunk?.path ?? (refs[0] ?? "document"),
        source_excerpt: excerpt,
        extraction_type: item.source_basis ?? "uncertain",
      });
    }
  }
  return out;
}

// Cheap language guess based on common stopwords across all partials.
function guessLanguage(partials: Partial[]): string {
  const sample = partials
    .flatMap((p) => [
      ...(p.atomic_units ?? []).map((a) => a.statement),
      ...(p.concepts ?? []).map((c) => c.definition),
      ...(p.entities ?? []).map((e) => e.description),
    ])
    .join(" ")
    .toLowerCase();
  if (!sample) return "en";
  const pt = (sample.match(/\b(que|para|com|não|uma|este|essa|sobre|aluno|aula|professor)\b/g) ?? []).length;
  const es = (sample.match(/\b(que|para|con|una|este|esta|sobre|estudiante|clase|profesor)\b/g) ?? []).length;
  const en = (sample.match(/\b(the|that|with|this|about|student|class|teacher|knowledge)\b/g) ?? []).length;
  if (pt > en && pt > es) return "pt";
  if (es > en && es > pt) return "es";
  return "en";
}

const pad3 = (n: number) => String(n).padStart(3, "0");
function renumber<T extends TraceFields>(arr: T[], prefix: string): T[] {
  arr.forEach((x, i) => { x.id = `${prefix}_${pad3(i + 1)}`; });
  return arr;
}

/** Assign stable sequential IDs (e_001, c_001, …) across all sections. */
export function assignStableIds(pkg: MergedPackage): MergedPackage {
  renumber(pkg.entities, "e");
  renumber(pkg.concepts, "c");
  renumber(pkg.principles, "p");
  renumber(pkg.heuristics, "h");
  renumber(pkg.decision_rules, "dr");
  renumber(pkg.procedures, "pr");
  renumber(pkg.patterns, "pt");
  renumber(pkg.anti_patterns, "ap");
  renumber(pkg.causal_chains, "cc");
  renumber(pkg.contextual_triggers, "ct");
  renumber(pkg.if_then_rules, "it");
  renumber(pkg.exceptions, "ex");
  renumber(pkg.mental_models, "mm");
  renumber(pkg.playbooks, "pb");
  renumber(pkg.qa_pairs, "qa");
  renumber(pkg.retrieval_chunks, "rc");
  renumber(pkg.atomic_units, "au");
  return pkg;
}

// ── Markdown rendering ───────────────────────────────────────
export function serializeMarkdown(pkg: MergedPackage, meta: { title: string; provider: string; model: string }): string {
  const L: string[] = [];
  const traceTag = (t: TraceFields) => {
    const bits: string[] = [];
    if (t.id) bits.push(t.id);
    if (t.source_basis) bits.push(t.source_basis);
    if (typeof t.confidence === "number") bits.push(`c=${t.confidence.toFixed(2)}`);
    if (t.source_refs?.length) bits.push(t.source_refs.join(","));
    return bits.length ? ` _[${bits.join(" | ")}]_` : "";
  };

  L.push(`# ${meta.title}`, "");
  L.push(`> Compiled with **${meta.provider}** - model \`${meta.model}\` - CKF v1.0`, "");

  const ci = pkg.core_intent;
  if (ci.primary_purpose || ci.intended_user || ci.intended_agent_use.length) {
    L.push("## 1. Core intent");
    if (ci.primary_purpose) L.push(`**Primary purpose:** ${ci.primary_purpose}`);
    if (ci.intended_user) L.push(`**Intended user:** ${ci.intended_user}`);
    if (ci.transformation_goal) L.push(`**Transformation goal:** ${ci.transformation_goal}`);
    if (ci.key_value) L.push(`**Key value:** ${ci.key_value}`);
    if (ci.intended_agent_use.length) {
      L.push("**Intended agent use:**");
      ci.intended_agent_use.forEach((s) => L.push(`- ${s}`));
    }
    L.push("");
  }

  const dm = pkg.domain_map;
  if (dm.main_domain || dm.subdomains.length) {
    L.push("## 2. Domain map");
    if (dm.main_domain) L.push(`**Main domain:** ${dm.main_domain}`);
    if (dm.subdomains.length) L.push(`**Subdomains:** ${dm.subdomains.join(", ")}`);
    if (dm.adjacent_domains.length) L.push(`**Adjacent:** ${dm.adjacent_domains.join(", ")}`);
    if (dm.excluded_domains.length) L.push(`**Excluded:** ${dm.excluded_domains.join(", ")}`);
    L.push("");
  }

  if (pkg.entities.length) {
    L.push(`## 3. Entities (${pkg.entities.length})`);
    pkg.entities.forEach((e) => {
      L.push(`### ${e.name} _(${e.type})_${traceTag(e)}`);
      L.push(e.description);
      if (e.aliases?.length) L.push(`_Aliases:_ ${e.aliases.join(", ")}`);
      if (e.related?.length) L.push(`_Relations:_ ${e.related.map((r) => `${r.relation} -> **${r.name}**`).join(", ")}`);
      L.push("");
    });
  }
  if (pkg.concepts.length) {
    L.push(`## 4. Concepts (${pkg.concepts.length})`);
    pkg.concepts.forEach((c) => {
      L.push(`### ${c.label}${traceTag(c)}`);
      L.push(c.definition);
      L.push("");
    });
  }
  if (pkg.principles.length) {
    L.push("## 5. Principles");
    pkg.principles.forEach((p) => L.push(`- ${p.statement}${traceTag(p)}`));
    L.push("");
  }
  if (pkg.heuristics.length) {
    L.push("## 6. Heuristics");
    pkg.heuristics.forEach((h) =>
      L.push(`- **When** ${h.trigger} -> **do** ${h.recommended_action}${h.avoid ? ` | _avoid:_ ${h.avoid}` : ""}${traceTag(h)}`),
    );
    L.push("");
  }
  if (pkg.decision_rules.length) {
    L.push("## 7. Decision rules");
    pkg.decision_rules.forEach((r) =>
      L.push(`- IF ${r.condition} THEN ${r.decision}${r.reasoning ? ` _(${r.reasoning})_` : ""}${traceTag(r)}`),
    );
    L.push("");
  }
  if (pkg.procedures.length) {
    L.push("## 8. Procedures");
    pkg.procedures.forEach((p) => {
      L.push(`### ${p.name}${traceTag(p)}`);
      if (p.objective) L.push(`_Objective:_ ${p.objective}`);
      p.steps.forEach((s, i) => {
        const text = typeof s === "string" ? s : s.action;
        L.push(`${i + 1}. ${text}`);
      });
      L.push("");
    });
  }
  if (pkg.patterns.length) {
    L.push("## 9. Patterns");
    pkg.patterns.forEach((x) => L.push(`- **${x.name}** — ${x.observed_when ?? ""}${traceTag(x)}`));
    L.push("");
  }
  if (pkg.anti_patterns.length) {
    L.push("## 10. Anti-patterns");
    pkg.anti_patterns.forEach((a) => L.push(`- **${a.name}** - ${a.description}${a.why_it_fails ? ` _(fails because ${a.why_it_fails})_` : ""}${traceTag(a)}`));
    L.push("");
  }
  if (pkg.causal_chains.length) {
    L.push("## 11. Causal chains");
    pkg.causal_chains.forEach((c) => L.push(`- ${c.cause} -> ${c.effect}${c.mechanism ? ` (${c.mechanism})` : ""}${traceTag(c)}`));
    L.push("");
  }
  if (pkg.contextual_triggers.length) {
    L.push("## 12. Contextual triggers");
    pkg.contextual_triggers.forEach((t) => L.push(`- _When_ \`${t.if_user_says_or_context_contains}\` -> ${t.agent_should ?? ""}${traceTag(t)}`));
    L.push("");
  }
  if (pkg.if_then_rules.length) {
    L.push("## 13. IF-THEN rules");
    pkg.if_then_rules.forEach((r) => L.push(`- IF ${r.if} THEN ${r.then}${r.because ? ` _(${r.because})_` : ""}${traceTag(r)}`));
    L.push("");
  }
  if (pkg.exceptions.length) {
    L.push("## 14. Exceptions");
    pkg.exceptions.forEach((e) => L.push(`- _Rule:_ ${e.general_rule} | _Exception:_ ${e.exception_case}${traceTag(e)}`));
    L.push("");
  }
  if (pkg.mental_models.length) {
    L.push("## 15. Mental models");
    pkg.mental_models.forEach((m) => L.push(`- **${m.name}** - ${m.description}${traceTag(m)}`));
    L.push("");
  }
  if (pkg.playbooks.length) {
    L.push("## 16. Operational playbooks");
    pkg.playbooks.forEach((pb) => {
      L.push(`### ${pb.name}${traceTag(pb)}`);
      if (pb.objective) L.push(`_Objective:_ ${pb.objective}`);
      pb.steps.forEach((s, i) => L.push(`${i + 1}. ${s}`));
      L.push("");
    });
  }
  if (pkg.qa_pairs.length) {
    L.push("## 17. Q&A pairs");
    pkg.qa_pairs.forEach((q) => L.push(`- **Q:** ${q.question}\n  **A:** ${q.ideal_answer}${traceTag(q)}`));
    L.push("");
  }
  if (pkg.retrieval_chunks.length) {
    L.push(`## 18. Retrieval chunks (${pkg.retrieval_chunks.length})`);
    pkg.retrieval_chunks.forEach((rc) => {
      L.push(`### ${rc.title}${traceTag(rc)}`);
      L.push(rc.compressed_knowledge);
      L.push("");
    });
  }
  if (pkg.atomic_units.length) {
    L.push(`## 19. Atomic units (${pkg.atomic_units.length})`);
    pkg.atomic_units.forEach((a) => L.push(`- _[${a.type ?? "fact"}]_ ${a.statement}${traceTag(a)}`));
    L.push("");
  }
  const ag = pkg.agent_instructions;
  if (ag.behavior_rules.length || ag.reasoning_rules.length || ag.response_rules.length || ag.forbidden_behaviors.length) {
    L.push("## 20. Agent instructions");
    const block = (title: string, items: string[]) => {
      if (!items.length) return;
      L.push(`**${title}**`);
      items.forEach((s) => L.push(`- ${s}`));
    };
    block("Behavior rules", ag.behavior_rules);
    block("Reasoning rules", ag.reasoning_rules);
    block("Response rules", ag.response_rules);
    block("Forbidden behaviors", ag.forbidden_behaviors);
    block("Preferred questions", ag.preferred_questions);
    block("Tool usage", ag.tool_usage_guidance);
    L.push("");
  }
  const kl = pkg.knowledge_limits;
  if (kl.missing_context.length || kl.weakly_supported_claims.length || kl.assumptions_detected.length) {
    L.push("## 21. Knowledge limits");
    const block = (title: string, items: string[]) => {
      if (!items.length) return;
      L.push(`**${title}**`);
      items.forEach((s) => L.push(`- ${s}`));
    };
    block("Missing context", kl.missing_context);
    block("Weakly supported claims", kl.weakly_supported_claims);
    block("Assumptions detected", kl.assumptions_detected);
    block("Possible biases", kl.possible_biases);
    block("Outdated sections", kl.outdated_sections);
    block("Needs human review", kl.needs_human_review);
    L.push("");
  }

  // 22. Source traceability — verbatim excerpts keyed by extracted_item_id.
  // The viewer relies on this section to highlight the original passage in
  // the linked source file when the user clicks "Rastrear" (Trace).
  const trace = (pkg.source_traceability ?? []).filter(
    (t) => t.source_excerpt && t.source_excerpt.trim().length > 0,
  );
  if (trace.length) {
    L.push(`## 22. Source traceability (${trace.length})`);
    for (const t of trace) {
      const loc = t.source_location || "document";
      L.push(`### ${t.extracted_item_id} — ${loc}`);
      const lines = t.source_excerpt.split(/\r?\n/);
      for (const ln of lines) L.push(`> ${ln}`);
      L.push("");
    }
  }

  return L.join("\n");
}
