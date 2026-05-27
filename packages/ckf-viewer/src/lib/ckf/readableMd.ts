// Parses the human-readable Markdown format emitted by
// `src/lib/compiler/reduce.ts → serializeMarkdown`. Returns a partial
// CKF-shaped object suitable for merging into EMPTY_PKG in `parse.ts`.
//
// Layout (kept in sync with serializeMarkdown):
//   # <title>
//   > Compiled with **<provider>** - model `<model>` - CKF v1.0
//
//   ## 1. Core intent           — **Primary purpose:** ... etc.
//   ## 2. Domain map            — **Main domain:** / **Subdomains:** / **Adjacent:**
//   ## 3. Entities (N)          — ### name _(type)_ _[trace]_ + body + _Aliases:_ + _Relations:_
//   ## 4. Concepts (N)          — ### label _[trace]_ + body
//   ## 5. Principles            — - statement _[trace]_
//   ## 6. Heuristics            — - **When** X -> **do** Y | _avoid:_ Z _[trace]_
//   ## 7. Decision rules        — - IF X THEN Y _(reason)_ _[trace]_
//   ## 8. Procedures            — ### name _[trace]_ + _Objective:_ + 1. step
//   ## 9. Patterns              — - **name** — observed_when _[trace]_
//   ## 10. Anti-patterns        — - **name** - description _(fails because ...)_ _[trace]_
//   ## 11. Causal chains        — - cause -> effect (mechanism) _[trace]_
//   ## 12. Contextual triggers  — - _When_ `ctx` -> action _[trace]_
//   ## 13. IF-THEN rules        — - IF X THEN Y _(because)_ _[trace]_
//   ## 14. Exceptions           — - _Rule:_ R | _Exception:_ E _[trace]_
//   ## 15. Mental models        — - **name** - description _[trace]_
//   ## 16. Operational playbooks— ### name _[trace]_ + _Objective:_ + 1. step
//   ## 17. Q&A pairs            — - **Q:** q\n  **A:** a _[trace]_
//   ## 18. Retrieval chunks (N) — ### title _[trace]_ + body
//   ## 19. Atomic units (N)     — - _[type]_ statement _[trace]_
//   ## 20. Agent instructions   — **Behavior rules** + - item ...
//   ## 21. Knowledge limits     — **Missing context** + - item ...

export type ReadableMdResult = Record<string, unknown>;

type Trace = {
  id?: string;
  source_basis?: string;
  confidence?: number;
  source_refs?: string[];
};

// Match the LAST `_[...]_` on the line that looks like a trace tag.
// Trace tags contain pipes OR an id pattern like `e_001` / `c_010`.
function stripTrace(line: string): { rest: string; trace: Trace } {
  const re = /_\[([^\]]+)\]_\s*$/;
  const m = line.match(re);
  if (!m) return { rest: line, trace: {} };
  const inner = m[1].trim();
  // Filter: must contain `|` or look like an id (`xx_123`).
  if (!inner.includes("|") && !/^[a-z]+_\d+$/i.test(inner)) {
    return { rest: line, trace: {} };
  }
  const trace = parseTraceInner(inner);
  return { rest: line.slice(0, m.index).trimEnd(), trace };
}

function parseTraceInner(inner: string): Trace {
  const parts = inner.split("|").map((s) => s.trim()).filter(Boolean);
  const out: Trace = {};
  for (const p of parts) {
    if (/^[a-z]+_\d+$/i.test(p) && !out.id) {
      out.id = p;
      continue;
    }
    const cMatch = p.match(/^c\s*=\s*([\d.]+)$/i);
    if (cMatch) {
      const n = Number(cMatch[1]);
      if (!Number.isNaN(n)) out.confidence = n;
      continue;
    }
    if (/^(explicit|inferred|synthesized|author_opinion|uncertain)$/i.test(p) && !out.source_basis) {
      out.source_basis = p.toLowerCase();
      continue;
    }
    // Otherwise treat as comma-separated source refs.
    if (/^[a-z]+_\d+(?:\s*,\s*[a-z]+_\d+)*$/i.test(p)) {
      out.source_refs = (out.source_refs ?? []).concat(p.split(",").map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

function attach<T extends Record<string, unknown>>(obj: T, trace: Trace): T {
  if (trace.id) (obj as any).id = trace.id;
  if (trace.source_basis) (obj as any).source_basis = trace.source_basis;
  if (typeof trace.confidence === "number") (obj as any).confidence = trace.confidence;
  if (trace.source_refs?.length) (obj as any).source_refs = trace.source_refs;
  return obj;
}

function normalizeSectionKey(title: string): string | null {
  const t = title
    .replace(/\(\s*\d+\s*\)\s*$/, "")
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    "core intent": "core_intent",
    "domain map": "domain_map",
    "entities": "entities",
    "entity graph": "entities",
    "concepts": "concepts",
    "concept graph": "concepts",
    "principles": "principles",
    "heuristics": "heuristics",
    "decision rules": "decision_rules",
    "procedures": "procedures",
    "patterns": "patterns",
    "anti-patterns": "anti_patterns",
    "antipatterns": "anti_patterns",
    "causal chains": "causal_chains",
    "contextual triggers": "contextual_triggers",
    "if-then rules": "if_then_rules",
    "if then rules": "if_then_rules",
    "exceptions": "exceptions",
    "exceptions and edge cases": "exceptions",
    "mental models": "mental_models",
    "operational playbooks": "playbooks",
    "playbooks": "playbooks",
    "q&a pairs": "qa_pairs",
    "qa pairs": "qa_pairs",
    "question-answer pairs for agents": "qa_pairs",
    "retrieval chunks": "retrieval_chunks",
    "atomic units": "atomic_units",
    "embedding-ready atomic units": "atomic_units",
    "agent instructions": "agent_instructions",
    "knowledge limits": "knowledge_limits",
    "source traceability": "source_traceability",
  };
  return map[t] ?? null;
}

// Group bullet lines: `- ...` continuing on indented or `  **A:**` lines.
function collectBullets(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let cur: string[] | null = null;
  for (const raw of lines) {
    if (/^\s*-\s+/.test(raw)) {
      if (cur) out.push(cur.join("\n"));
      cur = [raw.replace(/^\s*-\s+/, "")];
    } else if (cur && /^\s{2,}\S/.test(raw)) {
      cur.push(raw.trim());
    } else if (cur && raw.trim() === "") {
      // blank line ends the current bullet
      out.push(cur.join("\n"));
      cur = null;
    }
  }
  if (cur) out.push(cur.join("\n"));
  return out;
}

// Group `### Heading` items: heading + everything until next ### or end.
function collectSubsections(body: string): Array<{ heading: string; body: string }> {
  const lines = body.split(/\r?\n/);
  const out: Array<{ heading: string; body: string }> = [];
  let cur: { heading: string; body: string[] } | null = null;
  for (const raw of lines) {
    const m = raw.match(/^###\s+(.+?)\s*$/);
    if (m) {
      if (cur) out.push({ heading: cur.heading, body: cur.body.join("\n").trim() });
      cur = { heading: m[1], body: [] };
    } else if (cur) {
      cur.body.push(raw);
    }
  }
  if (cur) out.push({ heading: cur.heading, body: cur.body.join("\n").trim() });
  return out;
}

// ───────────────────────── per-section parsers ─────────────────────────

function parseCoreIntent(body: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Array<[RegExp, string]> = [
    [/\*\*Primary purpose:\*\*\s*(.+)/i, "primary_purpose"],
    [/\*\*Intended user:\*\*\s*(.+)/i, "intended_user"],
    [/\*\*Transformation goal:\*\*\s*(.+)/i, "transformation_goal"],
    [/\*\*Key value:\*\*\s*(.+)/i, "key_value"],
  ];
  for (const [re, key] of map) {
    const m = body.match(re);
    if (m) out[key] = m[1].trim();
  }
  // intended_agent_use as list
  const idx = body.search(/\*\*Intended agent use:\*\*/i);
  if (idx >= 0) {
    const rest = body.slice(idx);
    const items: string[] = [];
    for (const raw of rest.split(/\r?\n/).slice(1)) {
      const m = raw.match(/^\s*-\s+(.+)/);
      if (m) items.push(m[1].trim());
      else if (raw.trim().startsWith("##")) break;
      else if (raw.trim() === "" && items.length) continue;
    }
    if (items.length) out.intended_agent_use = items;
  }
  return out;
}

function parseDomainMap(body: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const main = body.match(/\*\*Main domain:\*\*\s*(.+)/i);
  if (main) out.main_domain = main[1].trim();
  const sub = body.match(/\*\*Subdomains:\*\*\s*(.+)/i);
  if (sub) {
    out.subdomains = csv(sub[1]).map((name) => ({ name, relevance: 1, related_concepts: [] }));
  }
  const adj = body.match(/\*\*Adjacent:\*\*\s*(.+)/i);
  if (adj) out.adjacent_domains = csv(adj[1]);
  const exc = body.match(/\*\*Excluded:\*\*\s*(.+)/i);
  if (exc) out.excluded_domains = csv(exc[1]);
  return out;
}

function parseEntities(body: string): unknown[] {
  return collectSubsections(body).map(({ heading, body }) => {
    const { rest, trace } = stripTrace(heading);
    const m = rest.match(/^(.+?)\s*_\((.+?)\)_\s*$/);
    const name = m ? m[1].trim() : rest.trim();
    const type = m ? m[2].trim() : "";
    const lines = body.split(/\r?\n/);
    let description = "";
    const aliases: string[] = [];
    const related: Array<{ relation: string; name: string }> = [];
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) continue;
      const al = l.match(/_Aliases:_\s*(.+)$/i);
      if (al) {
        aliases.push(...al[1].split(",").map((s) => s.trim()).filter(Boolean));
        continue;
      }
      const rel = l.match(/_Relations:_\s*(.+)$/i);
      if (rel) {
        for (const piece of rel[1].split(",")) {
          const rm = piece.match(/^\s*(.+?)\s*->\s*\*\*(.+?)\*\*\s*$/);
          if (rm) related.push({ relation: rm[1].trim(), name: rm[2].trim() });
        }
        continue;
      }
      if (!description) description = l;
      else description += " " + l;
    }
    return attach({ name, type, description, aliases, related }, trace);
  });
}

function parseConcepts(body: string): unknown[] {
  return collectSubsections(body).map(({ heading, body }) => {
    const { rest, trace } = stripTrace(heading);
    return attach({ label: rest.trim(), definition: body.trim() }, trace);
  });
}

function parseBulletsWithTrace(body: string): Array<{ text: string; trace: Trace }> {
  return collectBullets(body).map((raw) => {
    const { rest, trace } = stripTrace(raw.replace(/\s+$/, ""));
    return { text: rest.trim(), trace };
  });
}

function parsePrinciples(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => attach({ statement: text }, trace));
}

function parseHeuristics(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/^\*\*When\*\*\s+(.+?)\s+->\s+\*\*do\*\*\s+(.+?)(?:\s*\|\s*_avoid:_\s*(.+))?$/i);
    if (!m) return attach({ trigger: text, recommended_action: "" }, trace);
    return attach(
      {
        trigger: m[1].trim(),
        interpretation: "",
        recommended_action: m[2].trim(),
        avoid: m[3]?.trim() ?? "",
      },
      trace,
    );
  });
}

function parseDecisionRules(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    let reasoning = "";
    let core = text;
    const reasonM = text.match(/_\(([^)]+)\)_\s*$/);
    if (reasonM) {
      reasoning = reasonM[1].trim();
      core = text.slice(0, reasonM.index).trim();
    }
    const m = core.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);
    if (!m) return attach({ condition: core, decision: "", reasoning }, trace);
    return attach({ condition: m[1].trim(), decision: m[2].trim(), reasoning }, trace);
  });
}

function parseProcedures(body: string): unknown[] {
  return collectSubsections(body).map(({ heading, body }) => {
    const { rest, trace } = stripTrace(heading);
    const name = rest.trim();
    let objective = "";
    const steps: string[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const l = raw.trim();
      if (!l) continue;
      const o = l.match(/_Objective:_\s*(.+)$/i);
      if (o) {
        objective = o[1].trim();
        continue;
      }
      const s = l.match(/^\d+\.\s+(.+)$/);
      if (s) steps.push(s[1].trim());
    }
    return attach({ name, objective, steps }, trace);
  });
}

function parsePatterns(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/^\*\*(.+?)\*\*\s*[—-]\s*(.*)$/);
    if (!m) return attach({ name: text, observed_when: "" }, trace);
    return attach({ name: m[1].trim(), observed_when: m[2].trim() }, trace);
  });
}

function parseAntiPatterns(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    let why = "";
    let core = text;
    const wm = text.match(/_\(fails because\s+([^)]+)\)_\s*$/i);
    if (wm) {
      why = wm[1].trim();
      core = text.slice(0, wm.index).trim();
    }
    const m = core.match(/^\*\*(.+?)\*\*\s*-\s*(.+)$/);
    if (!m) return attach({ name: text, description: "", why_it_fails: why }, trace);
    return attach({ name: m[1].trim(), description: m[2].trim(), why_it_fails: why }, trace);
  });
}

function parseCausalChains(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    let mech = "";
    let core = text;
    const mm = text.match(/\(([^)]+)\)\s*$/);
    if (mm) {
      mech = mm[1].trim();
      core = text.slice(0, mm.index).trim();
    }
    const m = core.match(/^(.+?)\s*->\s*(.+)$/);
    if (!m) return attach({ cause: core, effect: "", mechanism: mech }, trace);
    return attach({ cause: m[1].trim(), effect: m[2].trim(), mechanism: mech }, trace);
  });
}

function parseContextualTriggers(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/_When_\s+`([^`]+)`\s*->\s*(.*)$/i);
    if (!m) return attach({ if_user_says_or_context_contains: text, agent_should: "" }, trace);
    return attach({ if_user_says_or_context_contains: m[1].trim(), agent_should: m[2].trim() }, trace);
  });
}

function parseIfThen(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    let because = "";
    let core = text;
    const bm = text.match(/_\(([^)]+)\)_\s*$/);
    if (bm) {
      because = bm[1].trim();
      core = text.slice(0, bm.index).trim();
    }
    const m = core.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);
    if (!m) return attach({ if: core, then: "", because }, trace);
    return attach({ if: m[1].trim(), then: m[2].trim(), because }, trace);
  });
}

function parseExceptions(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/_Rule:_\s+(.+?)\s*\|\s*_Exception:_\s+(.+)$/i);
    if (!m) return attach({ general_rule: text, exception_case: "", modified_action: "" }, trace);
    return attach({ general_rule: m[1].trim(), exception_case: m[2].trim(), modified_action: "" }, trace);
  });
}

function parseMentalModels(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/^\*\*(.+?)\*\*\s*-\s*(.+)$/);
    if (!m) return attach({ name: text, description: "" }, trace);
    return attach({ name: m[1].trim(), description: m[2].trim() }, trace);
  });
}

function parsePlaybooks(body: string): unknown[] {
  return parseProcedures(body); // identical layout
}

function parseQaPairs(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/^\*\*Q:\*\*\s*(.+?)\s*\n\s*\*\*A:\*\*\s*(.+)$/s);
    if (!m) {
      // Fallback: single line with both
      const m2 = text.match(/^\*\*Q:\*\*\s*(.+?)\s*\*\*A:\*\*\s*(.+)$/s);
      if (!m2) return attach({ question: text, ideal_answer: "" }, trace);
      return attach({ question: m2[1].trim(), ideal_answer: m2[2].trim() }, trace);
    }
    return attach({ question: m[1].trim(), ideal_answer: m[2].trim() }, trace);
  });
}

function parseRetrievalChunks(body: string): unknown[] {
  return collectSubsections(body).map(({ heading, body }) => {
    const { rest, trace } = stripTrace(heading);
    return attach({ title: rest.trim(), compressed_knowledge: body.trim() }, trace);
  });
}

function parseAtomicUnits(body: string): unknown[] {
  return parseBulletsWithTrace(body).map(({ text, trace }) => {
    const m = text.match(/_\[([^\]]+)\]_\s*(.+)$/);
    if (!m) return attach({ type: "fact", statement: text }, trace);
    return attach({ type: m[1].trim(), statement: m[2].trim() }, trace);
  });
}

function parseGroupedBlocks(body: string): Record<string, string[]> {
  // **Group label**\n - item\n - item\n**Group label**...
  const out: Record<string, string[]> = {};
  let cur: string[] | null = null;
  let curKey: string | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const h = raw.match(/^\*\*(.+?)\*\*\s*$/);
    if (h) {
      if (curKey && cur) out[curKey] = cur;
      curKey = h[1].trim().toLowerCase().replace(/\s+/g, "_");
      cur = [];
      continue;
    }
    const it = raw.match(/^\s*-\s+(.+)$/);
    if (it && cur) cur.push(it[1].trim());
  }
  if (curKey && cur) out[curKey] = cur;
  return out;
}

function parseAgentInstructions(body: string): Record<string, unknown> {
  const groups = parseGroupedBlocks(body);
  return {
    behavior_rules: groups["behavior_rules"] ?? [],
    reasoning_rules: groups["reasoning_rules"] ?? [],
    response_rules: groups["response_rules"] ?? [],
    forbidden_behaviors: groups["forbidden_behaviors"] ?? [],
    preferred_questions: groups["preferred_questions"] ?? [],
    tool_usage_guidance: groups["tool_usage"] ?? groups["tool_usage_guidance"] ?? [],
  };
}

function parseKnowledgeLimits(body: string): Record<string, unknown> {
  const groups = parseGroupedBlocks(body);
  return {
    missing_context: groups["missing_context"] ?? [],
    weakly_supported_claims: groups["weakly_supported_claims"] ?? [],
    assumptions_detected: groups["assumptions_detected"] ?? [],
    possible_biases: groups["possible_biases"] ?? [],
    outdated_sections: groups["outdated_sections"] ?? [],
    needs_human_review: groups["needs_human_review"] ?? [],
  };
}

// `## 22. Source traceability` — repeated `### <id> — <location>` blocks
// followed by a blockquote with the verbatim excerpt.
function parseSourceTraceability(body: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const { heading, body: sub } of collectSubsections(body)) {
    const m = heading.match(/^([a-z]+_\d+)\s*[—-]\s*(.+)$/i);
    const id = (m ? m[1] : heading.trim()).trim();
    const location = m ? m[2].trim() : "document";
    const excerpt = sub
      .split(/\r?\n/)
      .filter((ln) => /^\s*>/.test(ln))
      .map((ln) => ln.replace(/^\s*>\s?/, ""))
      .join("\n")
      .trim();
    if (!id || !excerpt) continue;
    out.push({
      extracted_item_id: id,
      source_location: location,
      source_excerpt: excerpt,
      extraction_type: "uncertain",
    });
  }
  return out;
}

// ───────────────────────── orchestrator ─────────────────────────

/** Heuristic: true if text looks like the readable Markdown report. */
export function looksLikeReadableMarkdown(text: string): boolean {
  // No YAML fences AND has at least one numbered `## N. <name>` heading.
  if (/```ya?ml\s*\n/.test(text)) return false;
  return /(^|\n)##\s+\d+\.\s+\S/.test(text);
}

export function parseReadableMarkdown(text: string): ReadableMdResult {
  const out: ReadableMdResult = {};
  const meta: Record<string, unknown> = {};

  // Title (# Title) — first H1.
  const titleM = text.match(/^#\s+(.+?)\s*$/m);
  if (titleM) meta.source_title = titleM[1].trim();

  // Banner: > Compiled with **<provider>** - model `<model>` - CKF v<ver>
  const banner = text.match(/^>\s*Compiled with\s+\*\*([^*]+)\*\*\s*-\s*model\s+`([^`]+)`\s*-\s*CKF\s+v?([\d.]+)/im);
  if (banner) {
    meta.compiled_with_provider = banner[1].trim();
    meta.compiled_with_model = banner[2].trim();
    meta.protocol_version = `ckf-${banner[3].trim()}`;
  } else {
    meta.protocol_version = "ckf-1.0";
  }

  if (Object.keys(meta).length > 0) out.metadata = meta;

  // Split by `## N. Title` headings (numbered only, to skip subheadings).
  const re = /^##\s+\d+\.\s+(.+?)\s*$/gm;
  const matches: Array<{ key: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  const headingStarts: Array<{ rawTitle: string; index: number; afterHeader: number }> = [];
  while ((m = re.exec(text)) !== null) {
    headingStarts.push({ rawTitle: m[1], index: m.index, afterHeader: m.index + m[0].length });
  }
  for (let i = 0; i < headingStarts.length; i++) {
    const h = headingStarts[i];
    const key = normalizeSectionKey(h.rawTitle);
    if (!key) continue;
    const end = i + 1 < headingStarts.length ? headingStarts[i + 1].index : text.length;
    matches.push({ key, start: h.afterHeader, end });
  }

  for (const { key, start, end } of matches) {
    const body = text.slice(start, end).trim();
    switch (key) {
      case "core_intent":
        out.core_intent = parseCoreIntent(body);
        break;
      case "domain_map":
        out.domain_map = parseDomainMap(body);
        break;
      case "entities":
        out.entities = parseEntities(body);
        break;
      case "concepts":
        out.concepts = parseConcepts(body);
        break;
      case "principles":
        out.principles = parsePrinciples(body);
        break;
      case "heuristics":
        out.heuristics = parseHeuristics(body);
        break;
      case "decision_rules":
        out.decision_rules = parseDecisionRules(body);
        break;
      case "procedures":
        out.procedures = parseProcedures(body);
        break;
      case "patterns":
        out.patterns = parsePatterns(body);
        break;
      case "anti_patterns":
        out.anti_patterns = parseAntiPatterns(body);
        break;
      case "causal_chains":
        out.causal_chains = parseCausalChains(body);
        break;
      case "contextual_triggers":
        out.contextual_triggers = parseContextualTriggers(body);
        break;
      case "if_then_rules":
        out.if_then_rules = parseIfThen(body);
        break;
      case "exceptions":
        out.exceptions = parseExceptions(body);
        break;
      case "mental_models":
        out.mental_models = parseMentalModels(body);
        break;
      case "playbooks":
        out.playbooks = parsePlaybooks(body);
        break;
      case "qa_pairs":
        out.qa_pairs = parseQaPairs(body);
        break;
      case "retrieval_chunks":
        out.retrieval_chunks = parseRetrievalChunks(body);
        break;
      case "atomic_units":
        out.atomic_units = parseAtomicUnits(body);
        break;
      case "agent_instructions":
        out.agent_instructions = parseAgentInstructions(body);
        break;
      case "knowledge_limits":
        out.knowledge_limits = parseKnowledgeLimits(body);
        break;
      case "source_traceability":
        out.source_traceability = parseSourceTraceability(body);
        break;
    }
  }

  // Back-fill `source_excerpts` on each traceable item from the parsed
  // source_traceability so /viewer's right panel can show the verbatim
  // text and "Rastrear" can locate it in the linked source. Without this,
  // parse.ts would synthesize an empty source_traceability fallback.
  const trace = (out.source_traceability as Array<Record<string, unknown>> | undefined) ?? [];
  if (trace.length > 0) {
    const excerptById = new Map<string, string>();
    for (const t of trace) {
      const id = t.extracted_item_id as string | undefined;
      const ex = t.source_excerpt as string | undefined;
      if (id && ex) excerptById.set(id, ex);
    }
    const sectionKeys = [
      "entities", "concepts", "principles", "heuristics", "decision_rules",
      "procedures", "patterns", "anti_patterns", "causal_chains",
      "contextual_triggers", "if_then_rules", "exceptions", "mental_models",
      "playbooks", "qa_pairs", "retrieval_chunks", "atomic_units",
    ] as const;
    for (const k of sectionKeys) {
      const arr = out[k] as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        const id = item.id as string | undefined;
        if (!id) continue;
        const ex = excerptById.get(id);
        if (!ex) continue;
        const existing = Array.isArray(item.source_excerpts)
          ? (item.source_excerpts as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          : [];
        if (existing.length === 0) item.source_excerpts = [ex];
      }
    }
  }

  return out;
}
