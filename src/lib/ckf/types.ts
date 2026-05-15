// Canonical TypeScript types for a KCP package.

export type CompressionLevel = "light" | "standard" | "dense" | "agentic";
export type OutputFormat = "markdown" | "json" | "yaml";
export type SourceBasis = "explicit" | "inferred" | "synthesized" | "author_opinion" | "uncertain";

export type Domain =
  | "education / learning science"
  | "business"
  | "legal"
  | "healthcare"
  | "software"
  | "science"
  | "general knowledge";

export interface CkfMetadata {
  package_id: string;
  protocol_version: string;
  source_type: string;
  source_title: string;
  source_author: string;
  domain: Domain;
  subdomains: string[];
  language: string;
  created_at: string;
  compression_level: CompressionLevel;
  human_readability: number;
  ai_utility_score: number;
}

export interface CoreIntent {
  primary_purpose: string;
  intended_user: string;
  intended_agent_use: string;
  transformation_goal: string;
  key_value: string;
}

export interface DomainMap {
  main_domain: Domain;
  subdomains: { name: string; relevance: number; related_concepts: string[] }[];
  adjacent_domains: string[];
  excluded_domains: string[];
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  aliases: string[];
  attributes: string[];
  related_entities: { entity_id: string; relation_type: string; confidence: number }[];
  source_basis: SourceBasis;
}

export interface Concept {
  id: string;
  label: string;
  definition: string;
  domain: Domain;
  depends_on: string[];
  contradicts: string[];
  supports: string[];
  enables: string[];
  risks: string[];
  confidence: number;
  source_basis: SourceBasis;
}

export interface Principle {
  id: string;
  statement: string;
  applies_when: string;
  does_not_apply_when: string;
  rationale: string;
  operational_use: string;
  confidence: number;
}

export interface Heuristic {
  id: string;
  trigger: string;
  interpretation: string;
  recommended_action: string;
  avoid: string;
  confidence: number;
}

export interface DecisionRule {
  id: string;
  condition: string;
  decision: string;
  reasoning: string;
  required_context: string;
  output_action: string;
  failure_mode: string;
  confidence: number;
}

export interface Procedure {
  id: string;
  name: string;
  objective: string;
  steps: { step: number; action: string; input_required: string; output_expected: string }[];
  success_criteria: string;
  failure_criteria: string;
}

export interface Pattern {
  id: string;
  name: string;
  observed_when: string;
  signal: string;
  underlying_mechanism: string;
  response_strategy: string;
  confidence: number;
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  why_it_fails: string;
  warning_signals: string;
  replacement_behavior: string;
}

export interface CausalChain {
  id: string;
  cause: string;
  mechanism: string;
  effect: string;
  secondary_effects: string[];
  intervention_points: string[];
  confidence: number;
}

export interface ContextualTrigger {
  id: string;
  if_user_says_or_context_contains: string;
  activate_knowledge: string[];
  agent_should: string;
  agent_should_not: string;
}

export interface IfThenRule {
  id: string;
  if: string;
  then: string;
  because: string;
  confidence: number;
}

export interface Exception {
  id: string;
  general_rule: string;
  exception_case: string;
  modified_action: string;
  explanation: string;
}

export interface MentalModel {
  id: string;
  name: string;
  description: string;
  use_when: string;
  do_not_use_when: string;
  input_needed: string;
  output_generated: string;
}

export interface Playbook {
  id: string;
  name: string;
  objective: string;
  activation_context: string;
  steps: string[];
  agent_tone: string;
  tools_needed: string[];
  expected_output: string;
  failure_modes: string[];
}

export interface QAPair {
  id: string;
  question: string;
  ideal_answer: string;
  source_concepts: string[];
  difficulty: "easy" | "medium" | "hard";
  answer_type: string;
}

export interface RetrievalChunk {
  id: string;
  title: string;
  standalone_context: string;
  compressed_knowledge: string;
  activation_queries: string[];
  related_rules: string[];
  related_entities: string[];
  related_concepts: string[];
}

export interface AtomicUnit {
  id: string;
  statement: string;
  type: "fact" | "rule" | "definition" | "claim" | "heuristic";
  tags: string[];
  dependencies: string[];
  confidence: number;
}

export interface AgentInstructions {
  behavior_rules: string[];
  reasoning_rules: string[];
  response_rules: string[];
  forbidden_behaviors: string[];
  preferred_questions: string[];
  tool_usage_guidance: string[];
}

export interface KnowledgeLimits {
  missing_context: string[];
  weakly_supported_claims: string[];
  assumptions_detected: string[];
  possible_biases: string[];
  outdated_sections: string[];
  needs_human_review: string[];
}

export interface SourceTraceItem {
  extracted_item_id: string;
  source_location: string;
  source_excerpt: string;
  extraction_type: SourceBasis;
}

export interface CkfPackage {
  metadata: CkfMetadata;
  core_intent: CoreIntent;
  domain_map: DomainMap;
  entities: Entity[];
  concepts: Concept[];
  principles: Principle[];
  heuristics: Heuristic[];
  decision_rules: DecisionRule[];
  procedures: Procedure[];
  patterns: Pattern[];
  anti_patterns: AntiPattern[];
  causal_chains: CausalChain[];
  contextual_triggers: ContextualTrigger[];
  if_then_rules: IfThenRule[];
  exceptions: Exception[];
  mental_models: MentalModel[];
  playbooks: Playbook[];
  qa_pairs: QAPair[];
  retrieval_chunks: RetrievalChunk[];
  atomic_units: AtomicUnit[];
  agent_instructions: AgentInstructions;
  knowledge_limits: KnowledgeLimits;
  source_traceability: SourceTraceItem[];
}

export interface CompileOptions {
  sourceType: string;
  compressionLevel: CompressionLevel;
  outputFormat: OutputFormat;
  language?: string;
}

export interface CompileResult {
  pkg: CkfPackage;
  warnings: string[];
}
