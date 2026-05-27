// Minimal "pro-safe" extraction schema for Gemini 2.5 Pro (and any future
// model whose constrained-decoding backend rejects the full CKF_PARTIAL_SCHEMA
// with "too many states for serving").
//
// The full schema has 22 top-level sections, ~215 named properties and ~106
// required entries — enough to overflow Gemini 2.5 Pro's FSM compiler even
// after slimming. Instead, this schema flattens every CKF item into a single
// `items[]` array tagged with `section`, plus optional traceability fields.
// The server then converts the flat output back into a `Partial` matching the
// canonical pipeline.

import type { Partial as CkfPartial } from "./reduce";

export const PRO_SAFE_TOOL_NAME = "emit_ckf_items";
export const PRO_SAFE_TOOL_DESCRIPTION =
  "Emit a flat list of CKF items extracted from this chunk. Use `section` to tag the kind of item.";

/**
 * Stable section vocabulary the prompt asks the model to use. Kept as plain
 * strings (no `enum` in the schema) so Gemini's FSM stays small.
 */
export const PRO_SAFE_SECTIONS = [
  "entity",
  "concept",
  "principle",
  "heuristic",
  "decision_rule",
  "procedure",
  "pattern",
  "anti_pattern",
  "causal_chain",
  "contextual_trigger",
  "if_then_rule",
  "exception",
  "mental_model",
  "playbook",
  "qa_pair",
  "retrieval_chunk",
  "atomic_unit",
] as const;

export type ProSafeSection = (typeof PRO_SAFE_SECTIONS)[number];

export const PRO_SAFE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    language: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          name: { type: "string" },
          content: { type: "string" },
          extra: { type: "string" },
          source_basis: { type: "string" },
          confidence: { type: "number" },
          source_refs: { type: "array", items: { type: "string" } },
          source_excerpts: { type: "array", items: { type: "string" } },
        },
        required: ["section", "name", "content"],
      },
    },
  },
  required: ["items"],
};

export const PRO_SAFE_SYSTEM_SUFFIX = `\n\nOUTPUT MODE: pro-safe
You will call the tool \`${PRO_SAFE_TOOL_NAME}\` with a SINGLE flat array \`items[]\`.
For every extracted item, set:
- section: one of [${PRO_SAFE_SECTIONS.join(", ")}]
- name: short label (entity/concept/anti_pattern name, principle statement, etc.)
- content: the full body (definition, statement, action, anti_pattern description, ideal_answer, compressed_knowledge…)
- extra: optional. For procedures, list the steps (one per line). For decision_rules, write "IF <condition> THEN <decision>". For qa_pair, set name=question and content=ideal_answer. For if_then_rule, name="IF <if>" content="THEN <then>".
- source_basis, confidence, source_refs, source_excerpts: same rules as the canonical CKF schema.
Keep all faithfulness, language-lock and excerpt rules from the main prompt.`;

type FlatItem = {
  section: string;
  name?: string;
  content?: string;
  extra?: string;
  source_basis?: string;
  confidence?: number;
  source_refs?: string[];
  source_excerpts?: string[];
};

type FlatOutput = {
  title?: string;
  language?: string;
  items?: FlatItem[];
};

function trace(it: FlatItem) {
  return {
    source_basis: it.source_basis,
    confidence: typeof it.confidence === "number" ? it.confidence : undefined,
    source_refs: Array.isArray(it.source_refs) ? it.source_refs : undefined,
    source_excerpts: Array.isArray(it.source_excerpts) ? it.source_excerpts : undefined,
  };
}

function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}

/**
 * Convert the pro-safe flat output into the canonical CkfPartial shape, so the
 * rest of the pipeline (reduce → promote → sanitize → quality) does not need
 * to know which extraction surface produced it.
 */
export function proSafeToPartial(out: unknown): CkfPartial {
  const partial: CkfPartial = {};
  if (!out || typeof out !== "object") return partial;
  const o = out as FlatOutput;

  if (o.title || o.language) {
    partial.metadata = {
      ...(o.title ? { source_title: o.title } : {}),
      ...(o.language ? { language: o.language } : {}),
    };
  }

  if (!Array.isArray(o.items)) return partial;

  const push = <K extends keyof CkfPartial>(key: K, value: unknown) => {
    const arr = (partial[key] as unknown[] | undefined) ?? [];
    arr.push(value);
    (partial as Record<string, unknown>)[key as string] = arr;
  };

  for (const raw of o.items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as FlatItem;
    const section = str(it.section).toLowerCase().trim();
    const name = str(it.name).trim();
    const content = str(it.content).trim();
    if (!section || (!name && !content)) continue;
    const t = trace(it);
    const extra = str(it.extra);

    switch (section) {
      case "entity":
        push("entities", { name, type: "entity", description: content, ...t });
        break;
      case "concept":
        push("concepts", { label: name, definition: content, ...t });
        break;
      case "principle":
        push("principles", { statement: name || content, rationale: name ? content : undefined, ...t });
        break;
      case "heuristic":
        push("heuristics", { trigger: name, recommended_action: content, ...t });
        break;
      case "decision_rule": {
        // Accept either explicit IF/THEN in `extra` or in `name/content`.
        const m = /IF\s+(.+?)\s+THEN\s+(.+)/i.exec(extra || `${name} ${content}`);
        const condition = m?.[1]?.trim() || name || content;
        const decision = m?.[2]?.trim() || content;
        push("decision_rules", { condition, decision, ...t });
        break;
      }
      case "procedure": {
        const steps = (extra || content)
          .split(/\r?\n|(?:^|\s)\d+[).]\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((action) => ({ action }));
        push("procedures", {
          name: name || "procedure",
          steps: steps.length > 0 ? steps : [{ action: content || name }],
          ...t,
        });
        break;
      }
      case "pattern":
        push("patterns", { name: name || content.slice(0, 60), observed_when: content, ...t });
        break;
      case "anti_pattern":
        push("anti_patterns", { name: name || content.slice(0, 60), description: content, ...t });
        break;
      case "causal_chain": {
        const m = /(.+?)\s*(?:->|→|causes|leads to)\s*(.+)/i.exec(`${name} ${content}`);
        push("causal_chains", {
          cause: m?.[1]?.trim() || name || content,
          effect: m?.[2]?.trim() || content,
          ...t,
        });
        break;
      }
      case "contextual_trigger":
        push("contextual_triggers", {
          if_user_says_or_context_contains: name || content,
          agent_should: content,
          ...t,
        });
        break;
      case "if_then_rule":
        push("if_then_rules", {
          if: name.replace(/^IF\s+/i, "") || content,
          then: content.replace(/^THEN\s+/i, ""),
          ...t,
        });
        break;
      case "exception":
        push("exceptions", {
          general_rule: name || content,
          exception_case: extra || content,
          ...t,
        });
        break;
      case "mental_model":
        push("mental_models", { name: name || content.slice(0, 60), description: content, ...t });
        break;
      case "playbook": {
        const steps = (extra || content).split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
        push("playbooks", {
          name: name || "playbook",
          steps: steps.length > 0 ? steps : [content],
          ...t,
        });
        break;
      }
      case "qa_pair":
        push("qa_pairs", { question: name, ideal_answer: content, ...t });
        break;
      case "retrieval_chunk":
        push("retrieval_chunks", { title: name || content.slice(0, 60), compressed_knowledge: content, ...t });
        break;
      case "atomic_unit":
        push("atomic_units", { statement: content || name, type: "fact", ...t });
        break;
      default:
        // Unknown sections fall through to atomic_units so they are not lost.
        push("atomic_units", { statement: content || name, type: "fact", ...t });
    }
  }

  return partial;
}
