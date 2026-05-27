// Heuristic compiler — extracts a CKF v0.2 package from raw text using only
// regex and structural rules. No LLM, no network, 100% offline.
//
// This is intentionally simple. It is meant to give users a usable starting
// point without needing any API key. For high-quality extraction, run the
// BYOK pipeline instead.

import type { CkfPackage } from "../ckf/types";

export function compileHeuristic(text: string, opts: { filename?: string; language?: "en" | "pt" } = {}): CkfPackage {
  const language = opts.language ?? (/[ãõçáéíóú]/i.test(text) ? "pt" : "en");
  const lines = text.split(/\r?\n/);
  const sectionRe = /^(?:#{1,6}\s+|[A-Z][A-Z\s]{4,}$)/;

  // Section split
  const sections: { title: string; body: string }[] = [];
  let current = { title: opts.filename ?? "Document", body: "" };
  for (const line of lines) {
    if (sectionRe.test(line) && line.trim().length < 120) {
      if (current.body.trim()) sections.push(current);
      current = { title: line.replace(/^#{1,6}\s+/, "").trim(), body: "" };
    } else {
      current.body += line + "\n";
    }
  }
  if (current.body.trim()) sections.push(current);

  const now = new Date().toISOString();
  const pkg: CkfPackage = {
    metadata: {
      source_title: opts.filename ?? sections[0]?.title ?? "Untitled",
      language,
      created_at: now,
      compiler: "open-ckf-heuristic@0.1",
      status: "experimental",
    },
    concepts: [],
    entities: [],
    definitions: [],
    statements: [],
    rules: [],
    procedures: [],
    qa_pairs: [],
    examples: [],
    source_excerpts: [],
    source_traceability: [],
  } as unknown as CkfPackage;

  // Extract definitions: "X is/are/means Y"
  const defRe = /^([A-Z][A-Za-zÀ-ÿ\s]{2,40})\s+(?:is|are|means|refers to|é|são|significa)\s+(.+)\.$/gm;
  let m: RegExpExecArray | null;
  let defId = 1;
  for (const sec of sections) {
    while ((m = defRe.exec(sec.body)) !== null) {
      (pkg as any).definitions.push({
        id: `def_${defId++}`,
        term: m[1].trim(),
        definition: m[2].trim(),
        source_refs: [],
      });
    }
  }

  // Extract rules: lines containing "must", "shall", "should not", "deve", "não deve"
  const ruleRe = /^.{10,300}(must|shall|should not|cannot|forbidden|required|deve|não deve|proibido)\b.+$/gim;
  let ruleId = 1;
  for (const sec of sections) {
    const matches = sec.body.match(ruleRe) ?? [];
    for (const r of matches.slice(0, 40)) {
      (pkg as any).rules.push({
        id: `rule_${ruleId++}`,
        statement: r.trim(),
        source_refs: [],
      });
    }
  }

  // Extract procedures: numbered lists
  const procStart = /^\s*1[.)]\s+(.+)$/gm;
  let procId = 1;
  for (const sec of sections) {
    if (procStart.test(sec.body)) {
      const steps: string[] = [];
      const stepRe = /^\s*\d+[.)]\s+(.+)$/gm;
      let s: RegExpExecArray | null;
      while ((s = stepRe.exec(sec.body)) !== null) steps.push(s[1].trim());
      if (steps.length >= 2) {
        (pkg as any).procedures.push({
          id: `proc_${procId++}`,
          name: sec.title,
          steps: steps.map((text, i) => ({ order: i + 1, instruction: text })),
          source_refs: [],
        });
      }
    }
  }

  // Statements: take first sentence of each section as a high-level claim
  let stId = 1;
  for (const sec of sections.slice(0, 30)) {
    const first = sec.body.trim().split(/(?<=[.!?])\s+/)[0];
    if (first && first.length > 20 && first.length < 400) {
      (pkg as any).statements.push({
        id: `stmt_${stId++}`,
        claim: first,
        source_refs: [],
      });
    }
  }

  // Source excerpts: one per section (verbatim, capped)
  let exId = 1;
  for (const sec of sections.slice(0, 50)) {
    (pkg as any).source_excerpts.push({
      id: `src_${exId++}`,
      text: sec.body.trim().slice(0, 600),
      location: sec.title,
    });
  }

  return pkg;
}
