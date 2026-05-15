import { stringify as yamlStringify } from "yaml";
import type { CkfPackage } from "./types";

export function toJson(pkg: CkfPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function toYaml(pkg: CkfPackage): string {
  return yamlStringify(pkg, { lineWidth: 0 });
}

function yamlBlock(value: unknown): string {
  return yamlStringify(value, { lineWidth: 0 }).trimEnd();
}

function section(num: number, title: string, key: string, value: unknown, note?: string): string {
  const empty = Array.isArray(value) && value.length === 0;
  const body = empty
    ? `${key}: []  # none extracted`
    : `${key}:\n${yamlBlock(value).split("\n").map((l) => "  " + l).join("\n")}`;
  return `## ${num}. ${title}\n\n${note ? `<!-- ${note} -->\n\n` : ""}\`\`\`yaml\n${body}\n\`\`\`\n`;
}

export function toMarkdown(pkg: CkfPackage): string {
  const m = pkg.metadata;
  const header = `# KCP — KNOWLEDGE CONTEXT PACKAGE

package_id: ${m.package_id}
protocol_version: ${m.protocol_version}
source_type: ${m.source_type}
source_title: ${m.source_title}
source_author: ${m.source_author}
domain: ${m.domain}
subdomains: [${m.subdomains.join(", ")}]
language: ${m.language}
created_at: ${m.created_at}
compression_level: ${m.compression_level}
human_readability: ${m.human_readability}
ai_utility_score: ${m.ai_utility_score}

---
`;

  const sections: string[] = [
    section(1, "CORE INTENT", "core_intent", pkg.core_intent),
    section(2, "DOMAIN MAP", "domain_map", pkg.domain_map),
    section(3, "ENTITY GRAPH", "entities", pkg.entities),
    section(4, "CONCEPT GRAPH", "concepts", pkg.concepts),
    section(5, "PRINCIPLES", "principles", pkg.principles),
    section(6, "HEURISTICS", "heuristics", pkg.heuristics),
    section(7, "DECISION RULES", "decision_rules", pkg.decision_rules),
    section(8, "PROCEDURES", "procedures", pkg.procedures),
    section(9, "PATTERNS", "patterns", pkg.patterns),
    section(10, "ANTI-PATTERNS", "anti_patterns", pkg.anti_patterns),
    section(11, "CAUSAL CHAINS", "causal_chains", pkg.causal_chains),
    section(12, "CONTEXTUAL TRIGGERS", "contextual_triggers", pkg.contextual_triggers),
    section(13, "IF-THEN RULES", "if_then_rules", pkg.if_then_rules),
    section(14, "EXCEPTIONS AND EDGE CASES", "exceptions", pkg.exceptions),
    section(15, "MENTAL MODELS", "mental_models", pkg.mental_models),
    section(16, "OPERATIONAL PLAYBOOKS", "playbooks", pkg.playbooks),
    section(17, "QUESTION-ANSWER PAIRS FOR AGENTS", "qa_pairs", pkg.qa_pairs),
    section(18, "RETRIEVAL CHUNKS", "retrieval_chunks", pkg.retrieval_chunks),
    section(19, "EMBEDDING-READY ATOMIC UNITS", "atomic_units", pkg.atomic_units),
    section(20, "AGENT INSTRUCTIONS", "agent_instructions", pkg.agent_instructions),
    section(21, "KNOWLEDGE LIMITS", "knowledge_limits", pkg.knowledge_limits),
    section(22, "SOURCE TRACEABILITY", "source_traceability", pkg.source_traceability),
  ];

  return header + "\n" + sections.join("\n");
}
