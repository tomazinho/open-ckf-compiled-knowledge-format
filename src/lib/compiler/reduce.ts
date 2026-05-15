// Map-reduce merger: combines per-chunk KCP partials into one canonical package.

export type Partial = {
  core_intent?: { primary_purpose?: string; intended_agent_use?: string[] };
  domain_map?: string[];
  entities?: Array<{ name: string; type: string; description: string; aliases?: string[]; related?: { name: string; relation: string }[]; confidence?: number }>;
  concepts?: Array<{ label: string; definition: string; depends_on?: string[]; supports?: string[]; contradicts?: string[]; confidence?: number }>;
  principles?: string[];
  heuristics?: Array<{ trigger: string; recommended_action: string; avoid?: string }>;
  decision_rules?: Array<{ if: string; then: string; because?: string; confidence?: number }>;
  procedures?: Array<{ name: string; steps: string[] }>;
  anti_patterns?: string[];
  causal_chains?: Array<{ cause: string; effect: string; mechanism?: string }>;
  knowledge_limits?: string[];
  atomic_units?: Array<{ statement: string; kind: string }>;
};

export type MergedPackage = Required<Omit<Partial, "core_intent">> & {
  core_intent: { primary_purpose: string; intended_agent_use: string[] };
};

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

export function reduce(partials: Partial[]): MergedPackage {
  const purposes = partials.map((p) => p.core_intent?.primary_purpose).filter(Boolean) as string[];
  const intents = uniq(partials.flatMap((p) => p.core_intent?.intended_agent_use ?? []));

  const entityMap = new Map<string, MergedPackage["entities"][number]>();
  for (const p of partials) {
    for (const e of p.entities ?? []) {
      const key = norm(e.name);
      const prev = entityMap.get(key);
      if (!prev) {
        entityMap.set(key, { name: e.name, type: e.type, description: e.description, aliases: e.aliases ?? [], related: e.related ?? [], confidence: e.confidence ?? 0.6 });
      } else {
        prev.aliases = uniq([...(prev.aliases ?? []), ...(e.aliases ?? [])]);
        prev.related = mergeRelations([...(prev.related ?? []), ...(e.related ?? [])]);
        prev.confidence = Math.max(prev.confidence ?? 0, e.confidence ?? 0);
        if (e.description.length > prev.description.length) prev.description = e.description;
      }
    }
  }

  const conceptMap = new Map<string, MergedPackage["concepts"][number]>();
  for (const p of partials) {
    for (const c of p.concepts ?? []) {
      const key = norm(c.label);
      const prev = conceptMap.get(key);
      if (!prev) {
        conceptMap.set(key, { label: c.label, definition: c.definition, depends_on: c.depends_on ?? [], supports: c.supports ?? [], contradicts: c.contradicts ?? [], confidence: c.confidence ?? 0.6 });
      } else {
        prev.depends_on = uniq([...(prev.depends_on ?? []), ...(c.depends_on ?? [])]);
        prev.supports = uniq([...(prev.supports ?? []), ...(c.supports ?? [])]);
        prev.contradicts = uniq([...(prev.contradicts ?? []), ...(c.contradicts ?? [])]);
        prev.confidence = Math.max(prev.confidence ?? 0, c.confidence ?? 0);
        if (c.definition.length > prev.definition.length) prev.definition = c.definition;
      }
    }
  }

  return {
    core_intent: { primary_purpose: purposes.sort((a, b) => b.length - a.length)[0] ?? "", intended_agent_use: intents },
    domain_map: uniq(partials.flatMap((p) => p.domain_map ?? [])),
    entities: Array.from(entityMap.values()),
    concepts: Array.from(conceptMap.values()),
    principles: uniq(partials.flatMap((p) => p.principles ?? [])),
    heuristics: dedupBy(partials.flatMap((p) => p.heuristics ?? []), (h) => norm(h.trigger + h.recommended_action)),
    decision_rules: dedupBy(partials.flatMap((p) => p.decision_rules ?? []), (r) => norm(r.if + r.then)),
    procedures: dedupBy(partials.flatMap((p) => p.procedures ?? []), (pr) => norm(pr.name)),
    anti_patterns: uniq(partials.flatMap((p) => p.anti_patterns ?? [])),
    causal_chains: dedupBy(partials.flatMap((p) => p.causal_chains ?? []), (c) => norm(c.cause + c.effect)),
    knowledge_limits: uniq(partials.flatMap((p) => p.knowledge_limits ?? [])),
    atomic_units: dedupBy(partials.flatMap((p) => p.atomic_units ?? []), (a) => norm(a.statement)),
  };
}

function uniq<T extends string>(arr: T[]): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const x of arr) { const k = norm(x); if (k && !seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}
function dedupBy<T>(arr: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const x of arr) { const k = keyFn(x); if (k && !seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}
function mergeRelations(rels: { name: string; relation: string }[]) {
  const seen = new Set<string>(); const out: { name: string; relation: string }[] = [];
  for (const r of rels) { const k = norm(r.name) + "|" + norm(r.relation); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

export function serializeMarkdown(pkg: MergedPackage, meta: { title: string; provider: string; model: string }): string {
  const L: string[] = [];
  L.push(`# ${meta.title}`); L.push("");
  L.push(`> Compiled with **${meta.provider}** · model \`${meta.model}\` · KCP protocol v0.2`); L.push("");
  if (pkg.core_intent.primary_purpose) {
    L.push("## Core intent"); L.push(pkg.core_intent.primary_purpose);
    if (pkg.core_intent.intended_agent_use.length) {
      L.push(""); L.push("**Intended agent use:**");
      pkg.core_intent.intended_agent_use.forEach((s) => L.push(`- ${s}`));
    }
    L.push("");
  }
  if (pkg.domain_map.length) { L.push("## Domain map"); pkg.domain_map.forEach((s) => L.push(`- ${s}`)); L.push(""); }
  if (pkg.entities.length) {
    L.push(`## Entities (${pkg.entities.length})`);
    pkg.entities.forEach((e) => {
      L.push(`### ${e.name} _(${e.type})_`); L.push(e.description);
      if (e.related?.length) L.push(`Relations: ${e.related.map((r) => `${r.relation} → **${r.name}**`).join(", ")}`);
      L.push("");
    });
  }
  if (pkg.concepts.length) {
    L.push(`## Concepts (${pkg.concepts.length})`);
    pkg.concepts.forEach((c) => { L.push(`### ${c.label}`); L.push(c.definition); L.push(""); });
  }
  if (pkg.principles.length) { L.push("## Principles"); pkg.principles.forEach((p) => L.push(`- ${p}`)); L.push(""); }
  if (pkg.heuristics.length) {
    L.push("## Heuristics");
    pkg.heuristics.forEach((h) => L.push(`- **When** ${h.trigger} → **do** ${h.recommended_action}${h.avoid ? ` · _avoid:_ ${h.avoid}` : ""}`));
    L.push("");
  }
  if (pkg.decision_rules.length) {
    L.push("## Decision rules");
    pkg.decision_rules.forEach((r) => L.push(`- IF ${r.if} THEN ${r.then}${r.because ? ` _(${r.because})_` : ""}`));
    L.push("");
  }
  if (pkg.procedures.length) {
    L.push("## Procedures");
    pkg.procedures.forEach((p) => { L.push(`### ${p.name}`); p.steps.forEach((s, i) => L.push(`${i + 1}. ${s}`)); L.push(""); });
  }
  if (pkg.anti_patterns.length) { L.push("## Anti-patterns"); pkg.anti_patterns.forEach((a) => L.push(`- ${a}`)); L.push(""); }
  if (pkg.causal_chains.length) {
    L.push("## Causal chains");
    pkg.causal_chains.forEach((c) => L.push(`- ${c.cause} → ${c.effect}${c.mechanism ? ` (${c.mechanism})` : ""}`));
    L.push("");
  }
  if (pkg.knowledge_limits.length) { L.push("## Knowledge limits"); pkg.knowledge_limits.forEach((k) => L.push(`- ${k}`)); L.push(""); }
  if (pkg.atomic_units.length) {
    L.push(`## Atomic units (${pkg.atomic_units.length})`);
    pkg.atomic_units.forEach((a) => L.push(`- _[${a.kind}]_ ${a.statement}`));
    L.push("");
  }
  return L.join("\n");
}
