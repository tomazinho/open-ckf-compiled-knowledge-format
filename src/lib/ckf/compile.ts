// Heuristic, client-side KCP compiler (no LLM).
import type {
  AgentInstructions, AntiPattern, AtomicUnit, CausalChain, CompileOptions, CompileResult,
  Concept, ContextualTrigger, CoreIntent, DecisionRule, Domain, DomainMap, Entity,
  Exception, Heuristic, IfThenRule, CkfMetadata, CkfPackage, KnowledgeLimits, MentalModel,
  Pattern, Playbook, Principle, Procedure, QAPair, RetrievalChunk, SourceBasis, SourceTraceItem,
} from "./types";
import { detectDomain, detectLanguage } from "./domains";

const STOPWORDS_EN = new Set("a,an,and,are,as,at,be,but,by,for,from,has,have,he,her,his,i,if,in,into,is,it,its,of,on,or,our,she,so,that,the,their,them,then,there,these,they,this,to,was,we,were,what,when,which,while,who,why,will,with,would,you,your".split(","));
const STOPWORDS_PT = new Set("a,o,os,as,um,uma,uns,umas,de,do,da,dos,das,que,e,em,no,na,nos,nas,por,para,com,se,seu,sua,seus,suas,como,mas,ou,ao,à,também,quando,porque,deve,devem,evita,evitar,mais,menos,muito,muitos,todos,toda,todas,sobre,entre,onde,quem,este,esta,estes,estas,isso,isto".split(","));

function tokenize(text: string): string[] { return text.toLowerCase().match(/[\p{L}][\p{L}\-]+/gu) ?? []; }
function sentenceSplit(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“(])/g).map((s) => s.trim()).filter((s) => s.length > 8);
}
function topNouns(text: string, lang: string, max = 12) {
  const stop = lang === "pt" ? STOPWORDS_PT : STOPWORDS_EN;
  const tokens = tokenize(text).filter((t) => t.length > 3 && !stop.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([term, count]) => ({ term, count }));
}
function findCapitalizedPhrases(text: string): string[] {
  const matches = text.match(/\b([A-Z][a-zA-Zà-ÿ]+(?:\s+[A-Z][a-zA-Zà-ÿ]+){0,3})\b/g) ?? [];
  const seen = new Set<string>(); const out: string[] = [];
  for (const m of matches) { if (m.length < 4) continue; const k = m.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(m); } }
  return out.slice(0, 8);
}
function ratePerLevel(level: CompileOptions["compressionLevel"], base: number): number {
  switch (level) { case "light": return Math.max(2, Math.round(base * 0.5)); case "standard": return base; case "dense": return Math.round(base * 1.4); case "agentic": return Math.round(base * 1.8); }
}
function utilityScore(level: CompileOptions["compressionLevel"]): number { return ({ light: 0.72, standard: 0.81, dense: 0.88, agentic: 0.93 } as const)[level]; }
function readability(level: CompileOptions["compressionLevel"]): number { return ({ light: 0.9, standard: 0.7, dense: 0.45, agentic: 0.3 } as const)[level]; }
const ID = (prefix: string, n: number) => `${prefix}_${String(n).padStart(3, "0")}`;

function buildEntities(text: string, lang: string): Entity[] {
  const noun = topNouns(text, lang, 10).map((n) => n.term);
  const proper = findCapitalizedPhrases(text);
  const all = [...new Set([...proper, ...noun.map((n) => n[0].toUpperCase() + n.slice(1))])].slice(0, 8);
  return all.map((name, i) => ({
    id: ID("ENT", i + 1), name,
    type: /^[A-Z]/.test(name) && proper.includes(name) ? "named_entity" : "concept_term",
    description: "Recurring term/entity surfaced from the source.",
    aliases: [], attributes: [],
    related_entities: i > 0 ? [{ entity_id: ID("ENT", 1), relation_type: "co_occurs_with", confidence: 0.6 }] : [],
    source_basis: "explicit" as SourceBasis,
  }));
}
function buildConcepts(text: string, domain: Domain, lang: string): Concept[] {
  const sentences = sentenceSplit(text).slice(0, ratePerLevel("standard", 6));
  const top = topNouns(text, lang, 6).map((n) => n.term);
  return sentences.slice(0, 6).map((s, i) => ({
    id: ID("CON", i + 1),
    label: top[i] ? top[i][0].toUpperCase() + top[i].slice(1) : `Concept ${i + 1}`,
    definition: s.length > 220 ? s.slice(0, 217) + "…" : s,
    domain, depends_on: i > 0 ? [ID("CON", i)] : [], contradicts: [],
    supports: i + 1 < sentences.length ? [ID("CON", i + 2)] : [],
    enables: [], risks: [], confidence: 0.78, source_basis: "explicit",
  }));
}
const HEUR = [
  { re: /\b(should|must|need to|importante|deve|devem|precisa)\b/i, kind: "obligation" },
  { re: /\b(avoid|do not|never|evita|evitar|não\s+deve)\b/i, kind: "avoidance" },
  { re: /\b(improve|increase|strengthen|melhora|aumenta|fortalece)\b/i, kind: "improvement" },
  { re: /\b(risk|reduce|weaken|harm|reduz|enfraquece|prejudica)\b/i, kind: "risk" },
];
function buildHeuristics(text: string): Heuristic[] {
  const out: Heuristic[] = [];
  for (const s of sentenceSplit(text)) {
    const hit = HEUR.find((p) => p.re.test(s));
    if (!hit) continue;
    out.push({
      id: ID("HEU", out.length + 1),
      trigger: hit.kind === "avoidance" ? "context contains a known failure mode" : "relevant decision context detected",
      interpretation: s.slice(0, 220),
      recommended_action: hit.kind === "avoidance" ? "Avoid the described action." : hit.kind === "improvement" ? "Apply the technique described." : hit.kind === "risk" ? "Mitigate the described risk." : "Follow the recommended practice.",
      avoid: hit.kind === "avoidance" ? s.slice(0, 160) : "—", confidence: 0.76,
    });
    if (out.length >= 5) break;
  }
  return out;
}
function buildIfThen(text: string): IfThenRule[] {
  const out: IfThenRule[] = [];
  const re = /\b(if|when|whenever|quando|se)\b\s+([^.,;]{6,120})[,.]?\s+(then|then\s+|,)?\s*([^.]{6,160})/i;
  for (const s of sentenceSplit(text)) {
    const m = s.match(re); if (!m) continue;
    out.push({ id: ID("IFTHEN", out.length + 1), if: m[2].trim(), then: m[4].trim(), because: "Inferred from source context.", confidence: 0.72 });
    if (out.length >= 4) break;
  }
  return out;
}
function buildDecisionRules(text: string): DecisionRule[] {
  return sentenceSplit(text).filter((s) => /(should|must|deve|precisa)/i.test(s)).slice(0, 3).map((s, i) => ({
    id: ID("RULE", i + 1), condition: "Operating context matches the rule's domain.",
    decision: s.slice(0, 200), reasoning: "Derived from a normative statement in the source.",
    required_context: "Domain-specific context as described in the source.", output_action: "Apply the recommended decision.",
    failure_mode: "Recommendation applied outside its valid context.", confidence: 0.74,
  }));
}
function buildProcedures(text: string): Procedure[] {
  const ordered = sentenceSplit(text).filter((s) => /(first|then|next|finally|primeiro|depois|em seguida|finalmente)/i.test(s));
  if (!ordered.length) return [];
  return [{
    id: ID("PROC", 1), name: "Source-derived procedure", objective: "Apply the sequence implied by the source text.",
    steps: ordered.slice(0, 5).map((s, i) => ({ step: i + 1, action: s.slice(0, 180), input_required: "—", output_expected: "—" })),
    success_criteria: "All steps applied in order.", failure_criteria: "Steps executed out of order.",
  }];
}
function buildPatterns(text: string): Pattern[] {
  return sentenceSplit(text).filter((s) => /(often|tends|usually|frequently|geralmente|tende)/i.test(s)).slice(0, 2).map((s, i) => ({
    id: ID("PAT", i + 1), name: `Recurring pattern ${i + 1}`, observed_when: "Source-described conditions are present.",
    signal: s.slice(0, 160), underlying_mechanism: "—", response_strategy: "Recognize and act according to source guidance.", confidence: 0.7,
  }));
}
function buildAntiPatterns(text: string): AntiPattern[] {
  return sentenceSplit(text).filter((s) => /(avoid|do not|never|evita|evitar|não\s+deve)/i.test(s)).slice(0, 2).map((s, i) => ({
    id: ID("ANTI", i + 1), name: `Anti-pattern ${i + 1}`, description: s.slice(0, 200),
    why_it_fails: "Identified by the source as ineffective or harmful.", warning_signals: "Behavior matches the failure mode.",
    replacement_behavior: "Use the recommended alternative from the source.",
  }));
}
function buildCausal(text: string): CausalChain[] {
  return sentenceSplit(text).filter((s) => /(because|leads to|causes|results in|porque|leva a|causa|resulta em)/i.test(s)).slice(0, 3).map((s, i) => ({
    id: ID("CAU", i + 1),
    cause: s.split(/(because|leads to|causes|results in|porque|leva a|causa|resulta em)/i)[0].trim().slice(0, 120),
    mechanism: "—",
    effect: s.split(/(because|leads to|causes|results in|porque|leva a|causa|resulta em)/i).slice(2).join("").trim().slice(0, 160),
    secondary_effects: [], intervention_points: [], confidence: 0.7,
  }));
}
function buildTriggers(_text: string, concepts: Concept[]): ContextualTrigger[] {
  return concepts.slice(0, 3).map((c, i) => ({
    id: ID("TRG", i + 1), if_user_says_or_context_contains: c.label,
    activate_knowledge: [c.id, ...c.supports],
    agent_should: `Recall the ${c.label} concept and apply related rules.`,
    agent_should_not: "Make claims beyond what the source supports.",
  }));
}
function buildExceptions(text: string): Exception[] {
  return sentenceSplit(text).filter((s) => /(however|except|unless|porém|exceto|salvo|a menos que)/i.test(s)).slice(0, 2).map((s, i) => ({
    id: ID("EXC", i + 1), general_rule: "—", exception_case: s.slice(0, 200),
    modified_action: "Adjust behavior according to the exception.", explanation: "Source explicitly notes this edge case.",
  }));
}
function buildModels(_text: string, concepts: Concept[]): MentalModel[] {
  return concepts.slice(0, 2).map((c, i) => ({
    id: ID("MM", i + 1), name: `${c.label} model`, description: c.definition,
    use_when: "The reasoning context maps to this concept.", do_not_use_when: "Context lies outside the source's scope.",
    input_needed: "Relevant facts about the situation.", output_generated: "A reasoned recommendation aligned with the source.",
  }));
}
function buildPlaybooks(domain: Domain, concepts: Concept[]): Playbook[] {
  return [{
    id: ID("PLAY", 1), name: `${domain} response playbook`, objective: "Apply the source's knowledge to a real interaction.",
    activation_context: `User asks about ${concepts[0]?.label ?? "the topic"}.`,
    steps: ["Identify the concept the question maps to.", "Recall related rules and heuristics.", "Cite the source-derived principle.", "Surface relevant exceptions or limits."],
    agent_tone: "Clear, sourced, non-overstating.", tools_needed: ["retrieval", "memory"],
    expected_output: "A grounded answer with traceable reasoning.", failure_modes: ["Hallucinating beyond source", "Ignoring exceptions"],
  }];
}
function buildQA(concepts: Concept[]): QAPair[] {
  return concepts.slice(0, 4).map((c, i) => ({
    id: ID("QA", i + 1), question: `What is ${c.label.toLowerCase()} and when does it apply?`,
    ideal_answer: c.definition, source_concepts: [c.id],
    difficulty: i === 0 ? "easy" : "medium", answer_type: "definition_with_context",
  }));
}
function buildChunks(text: string, level: CompileOptions["compressionLevel"]): RetrievalChunk[] {
  const sentences = sentenceSplit(text);
  const target = ratePerLevel(level, 4);
  const chunkSize = Math.max(1, Math.ceil(sentences.length / target));
  const out: RetrievalChunk[] = [];
  for (let i = 0; i < sentences.length && out.length < target; i += chunkSize) {
    const slice = sentences.slice(i, i + chunkSize).join(" ");
    if (slice.length < 20) continue;
    const top = topNouns(slice, "en", 4).map((n) => n.term);
    out.push({
      id: ID("CHUNK", out.length + 1), title: top[0] ? `Chunk on ${top[0]}` : `Chunk ${out.length + 1}`,
      standalone_context: "Self-contained passage extracted from the source.",
      compressed_knowledge: slice.length > 400 ? slice.slice(0, 397) + "…" : slice,
      activation_queries: top.slice(0, 3).map((t) => `What does the source say about ${t}?`),
      related_rules: [], related_entities: [], related_concepts: [],
    });
  }
  return out;
}
function buildAtoms(text: string, level: CompileOptions["compressionLevel"]): AtomicUnit[] {
  const target = ratePerLevel(level, 7);
  return sentenceSplit(text).slice(0, target).map((s, i) => ({
    id: ID("AU", i + 1), statement: s.length > 220 ? s.slice(0, 217) + "…" : s,
    type: /\b(should|must|avoid|deve|evita)\b/i.test(s) ? "rule" : /\b(is|are|means|é|são|significa)\b/i.test(s) ? "definition" : "fact",
    tags: topNouns(s, "en", 3).map((n) => n.term), dependencies: [], confidence: 0.78,
  }));
}
function buildAgentInstr(domain: Domain, hasRules: boolean): AgentInstructions {
  return {
    behavior_rules: ["Stay within the package's scope.", "Cite the source-derived chunk or rule when answering."],
    reasoning_rules: ["Use causal chains and IF-THEN rules before improvising.", "Combine concepts only when supports/depends_on relationships allow it."],
    response_rules: ["Be concise unless the user asks for depth.", "Surface confidence and source basis."],
    forbidden_behaviors: ["Fabricating sources.", "Restating the source as personal opinion.", hasRules ? "Ignoring decision rules in favor of fluency." : "Overstating certainty."],
    preferred_questions: ["What does the source say about …?", "Which rule applies to this situation?", "What are the limits of this knowledge?"],
    tool_usage_guidance: ["Use retrieval before generation.", `Domain: ${domain}.`],
  };
}
function buildLimits(_text: string): KnowledgeLimits {
  return {
    missing_context: ["Source date and authorship are not always provided."],
    weakly_supported_claims: [], assumptions_detected: ["Heuristic compilation assumes the input text is self-contained."],
    possible_biases: ["Single-source perspective."], outdated_sections: [],
    needs_human_review: ["Decision rules and exceptions before production use."],
  };
}
function buildTrace(items: { id: string; excerpt: string }[]): SourceTraceItem[] {
  return items.map((it) => ({
    extracted_item_id: it.id, source_location: "user_input",
    source_excerpt: it.excerpt.length > 200 ? it.excerpt.slice(0, 197) + "…" : it.excerpt,
    extraction_type: "explicit",
  }));
}

export function compileCkf(rawText: string, options: CompileOptions): CompileResult {
  const text = rawText.trim();
  const warnings: string[] = [];
  if (text.length < 100) warnings.push("Input is short; extraction quality may be limited.");
  if (text.length > 50_000) warnings.push("Input is large; only the first ~50k characters are processed reliably in demo mode.");

  const lang = options.language ?? detectLanguage(text);
  const domain = detectDomain(text);
  const created_at = new Date().toISOString();

  const entities = buildEntities(text, lang);
  const concepts = buildConcepts(text, domain, lang);
  const heuristics = buildHeuristics(text);
  const ifThen = buildIfThen(text);
  const decisionRules = buildDecisionRules(text);
  const procedures = buildProcedures(text);
  const patterns = buildPatterns(text);
  const antiPatterns = buildAntiPatterns(text);
  const causal = buildCausal(text);
  const triggers = buildTriggers(text, concepts);
  const exceptions = buildExceptions(text);
  const mentalModels = buildModels(text, concepts);
  const playbooks = buildPlaybooks(domain, concepts);
  const qa = buildQA(concepts);
  const chunks = buildChunks(text, options.compressionLevel);
  const atoms = buildAtoms(text, options.compressionLevel);
  const agentInstr = buildAgentInstr(domain, decisionRules.length > 0);
  const limits = buildLimits(text);

  const traceItems = [
    ...concepts.map((c) => ({ id: c.id, excerpt: c.definition })),
    ...heuristics.map((h) => ({ id: h.id, excerpt: h.interpretation })),
    ...ifThen.map((r) => ({ id: r.id, excerpt: `IF ${r.if} THEN ${r.then}` })),
  ];
  const traceability = buildTrace(traceItems);

  const subdomains = topNouns(text, lang, 4).map((n, i) => ({
    name: n.term, relevance: Math.max(0.4, 1 - i * 0.15), related_concepts: [n.term],
  }));

  const metadata: CkfMetadata = {
    package_id: `kcp_demo_${Date.now()}`, protocol_version: "0.1",
    source_type: options.sourceType, source_title: "Untitled source", source_author: "Unknown",
    domain, subdomains: subdomains.map((s) => s.name), language: lang, created_at,
    compression_level: options.compressionLevel,
    human_readability: readability(options.compressionLevel),
    ai_utility_score: utilityScore(options.compressionLevel),
  };

  const coreIntent: CoreIntent = {
    primary_purpose: "Capture and structure the knowledge expressed in the source.",
    intended_user: "Developers, researchers and agents consuming structured knowledge.",
    intended_agent_use: "Retrieval, reasoning, tutoring, decision support.",
    transformation_goal: "Convert prose into structured, agent-usable cognition.",
    key_value: "Portable, traceable, reusable knowledge package.",
  };

  const domainMap: DomainMap = { main_domain: domain, subdomains, adjacent_domains: [], excluded_domains: [] };

  const principles: Principle[] = [];

  const pkg: CkfPackage = {
    metadata, core_intent: coreIntent, domain_map: domainMap,
    entities, concepts, principles, heuristics,
    decision_rules: decisionRules, procedures, patterns,
    anti_patterns: antiPatterns, causal_chains: causal,
    contextual_triggers: triggers, if_then_rules: ifThen, exceptions,
    mental_models: mentalModels, playbooks, qa_pairs: qa,
    retrieval_chunks: chunks, atomic_units: atoms,
    agent_instructions: agentInstr, knowledge_limits: limits,
    source_traceability: traceability,
  };
  return { pkg, warnings };
}
