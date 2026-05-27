// CKF v1.0 — Plano A, Tarefa 2.
// Pure post-processor: scans atomic_units + retrieval_chunks and DUPLICATES
// eligible knowledge into the richer structured sections (principles,
// decision_rules, procedures, anti_patterns, exceptions, playbooks, qa_pairs).
//
// Hard contract:
//   - never removes or reduces atomic_units / retrieval_chunks
//   - never invents facts — uses the source statement verbatim or splits it
//   - every promoted item inherits source_refs, source_excerpts, source_basis
//     and confidence (confidence may be docked by at most 0.05 when a splitter
//     heuristic was needed; never raised)
//   - downstream fuzzy dedup in reduce.ts collapses duplicates.

import type {
  MergedPackage,
  PartialAtomicUnit,
  PartialPrinciple,
  PartialDecisionRule,
  PartialProcedure,
  PartialAntiPattern,
} from "./reduce";
import {
  isLanguageConsistent,
  isCompleteProposition,
  isNearDuplicate,
  detectConditionalClaim,
  containsProceduralLanguage,
  looksTruncated,
} from "./text-filters";

type Trace = {
  source_basis?: string;
  confidence?: number;
  source_refs?: string[];
  source_excerpts?: string[];
};

// ── helpers ────────────────────────────────────────────────
const trim = (s: string) => s.replace(/\s+/g, " ").trim();
const lc = (s: string) => s.toLowerCase();

function inherit<T extends object>(src: Trace, extra: T, conf_penalty = 0): T & Trace {
  const conf = typeof src.confidence === "number" ? Math.max(0, src.confidence - conf_penalty) : 0.6;
  return {
    source_basis: src.source_basis ?? "inferred",
    confidence: conf,
    source_refs: [...(src.source_refs ?? [])],
    source_excerpts: [...(src.source_excerpts ?? [])],
    ...extra,
  } as T & Trace;
}

const RE_NEGATION = /\b(is\s+not|isn['’]t|are\s+not|aren['’]t|does\s+not\s+replace|is\s+not\s+a\s+replacement\s+for|not\s+a\s+replacement)\b/i;
const RE_CONTRAST = /\b(rather\s+than|instead\s+of|whereas|while\s+\w+|but\s+not|vs\.?|versus|composes?\s+with)\b/i;
const RE_CONDITIONAL = /\b(if|when|under|in\s+cases?\s+where|whenever)\b/i;
const RE_EXCEPTION = /\b(except|unless|does\s+not\s+apply|outside\s+of)\b/i;
const RE_PROCEDURAL = /\b(pipeline|steps?|workflow|process|sequence|first[\s,].*\b(then|next|finally)\b)\b/i;
const RE_ENUMERATED = /(\b1[\.\)]\s+.+?\b2[\.\)]\s+.+)|(\bfirst\b.+?\bthen\b.+?(\bfinally\b|\blast\b)?)/i;
const RE_PLAYBOOK_AGENT = /\b(an?\s+agent|the\s+agent|a\s+team|the\s+team|an?\s+engineer|the\s+engineer|practitioners?)\s+(should|must|can|may)\b/i;

// "X subject Y" → "X subject" (used as antipattern.name)
function extractSubject(statement: string): string {
  const s = trim(statement);
  // e.g. "CKF is not a vector database" → "Treating CKF as a vector database"
  const m = s.match(/^(.+?)\s+(is|are|does|do)\s+not\s+(?:a\s+|an\s+)?(.+?)\.?$/i);
  if (m) return `Treating ${m[1]} as ${m[3]}`.slice(0, 120);
  return s.slice(0, 120);
}

function splitOn(statement: string, re: RegExp): [string, string] | null {
  const m = statement.match(re);
  if (!m || m.index == null) return null;
  const left = trim(statement.slice(0, m.index));
  const right = trim(statement.slice(m.index + m[0].length));
  if (!left || !right) return null;
  return [left, right];
}

function questionFromStatement(statement: string): string | null {
  const s = trim(statement);
  // "X is not Y" → "Is X a Y?"
  let m = s.match(/^(.+?)\s+is\s+not\s+(?:a\s+|an\s+)?(.+?)\.?$/i);
  if (m) return `Is ${m[1]} a ${m[2]}?`;
  // "X does not replace Y" → "Does X replace Y?"
  m = s.match(/^(.+?)\s+does\s+not\s+replace\s+(.+?)\.?$/i);
  if (m) return `Does ${m[1]} replace ${m[2]}?`;
  return null;
}

// ── promotion ─────────────────────────────────────────────
type SourceItem = Trace & { statement: string; origin: "atomic" | "retrieval" };

function gatherSources(pkg: MergedPackage): SourceItem[] {
  const out: SourceItem[] = [];
  for (const a of pkg.atomic_units ?? []) {
    if (a.statement) out.push({ ...a, statement: a.statement, origin: "atomic" });
  }
  for (const r of pkg.retrieval_chunks ?? []) {
    const title = (r as { title?: string }).title ?? "";
    const compressed = (r as { compressed_knowledge?: string }).compressed_knowledge ?? "";
    const ctx = (r as { standalone_context?: string }).standalone_context ?? "";
    // split compressed_knowledge into sentences to give promoter material to work with
    const text = [title, ctx, compressed].filter(Boolean).join(". ");
    if (!text) continue;
    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(trim)
      .filter((s) => s.length > 12);
    for (const s of sentences.slice(0, 6)) {
      out.push({
        statement: s,
        origin: "retrieval",
        source_basis: (r as Trace).source_basis,
        confidence: (r as Trace).confidence,
        source_refs: (r as Trace).source_refs,
        source_excerpts: (r as Trace).source_excerpts,
      });
    }
  }
  return out;
}

export function promoteAtomicUnitsToStructuredSections(pkg: MergedPackage): MergedPackage {
  const sources = gatherSources(pkg);

  const newPrinciples: PartialPrinciple[] = [];
  const newDecisionRules: PartialDecisionRule[] = [];
  const newAntiPatterns: PartialAntiPattern[] = [];
  const newExceptions: NonNullable<MergedPackage["exceptions"]> = [];
  const newProcedures: PartialProcedure[] = [];
  const newPlaybooks: NonNullable<MergedPackage["playbooks"]> = [];
  const newQaPairs: NonNullable<MergedPackage["qa_pairs"]> = [];

  for (const src of sources) {
    const s = src.statement;
    const lcs = lc(s);

    const negation = RE_NEGATION.test(lcs);
    const contrast = RE_CONTRAST.test(lcs);
    const conditional = RE_CONDITIONAL.test(lcs);
    const exceptionish = RE_EXCEPTION.test(lcs);
    const procedural = RE_PROCEDURAL.test(lcs);
    const playbookish = RE_PLAYBOOK_AGENT.test(lcs);

    // anti_pattern + exception for negation/non-substitution claims
    if (negation) {
      newAntiPatterns.push(
        inherit(src, {
          name: extractSubject(s),
          description: s,
          why_it_fails: s,
        }),
      );
      newExceptions.push(
        inherit(src, {
          general_rule: "Use the referenced concept for its stated purpose.",
          exception_case: s,
        }),
      );
      const q = questionFromStatement(s);
      if (q) {
        newQaPairs.push(
          inherit(src, {
            question: q,
            ideal_answer: s,
          }),
        );
      }
    }

    // principle for contrastive claims (only when not a pure negation, or in addition)
    if (contrast || negation) {
      newPrinciples.push(
        inherit(src, { statement: s }),
      );
    }

    // decision_rule for conditionals
    if (conditional && !exceptionish) {
      const split = splitOn(s, /\b(then|,\s*choose|,\s*use|,\s*prefer)\b/i) ?? splitOn(s, /\bif\b|\bwhen\b/i);
      if (split) {
        const [cond, dec] = split;
        newDecisionRules.push(
          inherit(src, { condition: cond, decision: dec }, 0.05),
        );
      } else {
        newDecisionRules.push(
          inherit(src, { condition: s, decision: s }, 0.05),
        );
      }
    }

    // exception for "except/unless/does not apply"
    if (exceptionish) {
      const split = splitOn(s, RE_EXCEPTION);
      if (split) {
        const [rule, exc] = split;
        newExceptions.push(
          inherit(src, { general_rule: rule, exception_case: exc }, 0.05),
        );
      }
    }

    // procedure for pipeline/sequence claims
    if (procedural) {
      const enumMatch = s.match(RE_ENUMERATED);
      const steps = enumMatch
        ? s
            .split(/\b\d[\.\)]\s+|\bfirst\b|\bthen\b|\bnext\b|\bfinally\b/i)
            .map(trim)
            .filter((t) => t.length > 4)
            .slice(0, 6)
            .map((action, i) => ({ step: i + 1, action }))
        : [{ step: 1, action: s }];
      newProcedures.push(
        inherit(src, {
          name: s.slice(0, 80),
          objective: s,
          steps,
        }, 0.05),
      );
    }

    // playbook for agent/team recipes
    if (playbookish) {
      newPlaybooks.push(
        inherit(src, {
          name: s.slice(0, 80),
          activation_context: s,
          steps: [s],
        }, 0.05),
      );
    }
  }

  // Append (do NOT replace). Downstream dedupFuzzy in reduce() collapses duplicates.
  pkg.principles = [...(pkg.principles ?? []), ...newPrinciples];
  pkg.decision_rules = [...(pkg.decision_rules ?? []), ...newDecisionRules];
  pkg.anti_patterns = [...(pkg.anti_patterns ?? []), ...newAntiPatterns];
  pkg.exceptions = [...(pkg.exceptions ?? []), ...newExceptions];
  pkg.procedures = [...(pkg.procedures ?? []), ...newProcedures];
  pkg.playbooks = [...(pkg.playbooks ?? []), ...newPlaybooks];
  pkg.qa_pairs = [...(pkg.qa_pairs ?? []), ...newQaPairs];

  // Do NOT touch atomic_units or retrieval_chunks — they remain the search surface.
  return pkg;
}

// Suppress unused param TS noise for PartialAtomicUnit (kept for type contract).
export type __PromoteAtomicAlias = PartialAtomicUnit;

// ─────────────────────────────────────────────────────────────────────────────
// CKF Compiler v1.02 B — filtered promotion entry point.
// New behavior layered ON TOP of `promoteAtomicUnitsToStructuredSections` (which
// runs inside reduce.ts and stays untouched). This pass:
//   1. Promotes additional conditional claims into `if_then_rules`
//   2. Promotes procedural claims into `playbooks`
//   3. Strengthens `anti_patterns` extraction (do-not-use / instead-of)
//   4. Applies three filters (language, completeness, near-duplicate) on every
//      promotion target, and writes a `promotion_audit` to the package.
// ─────────────────────────────────────────────────────────────────────────────

export type PromotionRejectReason =
  | "language_mismatch"
  | "incomplete_proposition"
  | "near_duplicate"
  | "truncated"
  | "no_pattern_match";

export type PromotionReject = {
  source_id: string;
  source_section: "atomic_units" | "retrieval_chunks";
  target_section: string;
  reason: PromotionRejectReason;
  text_preview: string;
};

export type PromotionAudit = {
  promoted_count: number;
  rejected_count: number;
  rejected_items: PromotionReject[];
};

export type PromoteOptions = {
  enabled?: boolean;
  languageFilter?: boolean;
  completenessFilter?: boolean;
  detectConditionals?: boolean;
};

type Candidate = {
  id: string;
  text: string;
  section: "atomic_units" | "retrieval_chunks";
  source_basis?: string;
  confidence?: number;
  source_refs?: string[];
  source_excerpts?: string[];
};

function gatherCandidates(pkg: MergedPackage): Candidate[] {
  const out: Candidate[] = [];
  (pkg.atomic_units ?? []).forEach((a, i) => {
    if (a.statement) {
      out.push({
        id: a.id ?? `atomic_${i}`,
        text: a.statement,
        section: "atomic_units",
        source_basis: a.source_basis,
        confidence: a.confidence,
        source_refs: a.source_refs,
        source_excerpts: a.source_excerpts,
      });
    }
  });
  (pkg.retrieval_chunks ?? []).forEach((c, i) => {
    const title = (c as { title?: string }).title ?? "";
    const compressed = (c as { compressed_knowledge?: string }).compressed_knowledge ?? "";
    const ctx = (c as { standalone_context?: string }).standalone_context ?? "";
    const text = [title, ctx, compressed].filter(Boolean).join(". ");
    if (!text) return;
    text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12)
      .slice(0, 6)
      .forEach((sentence, j) => {
        out.push({
          id: `${(c as { id?: string }).id ?? `chunk_${i}`}_${j}`,
          text: sentence,
          section: "retrieval_chunks",
          source_basis: (c as Trace).source_basis,
          confidence: (c as Trace).confidence,
          source_refs: (c as Trace).source_refs,
          source_excerpts: (c as Trace).source_excerpts,
        });
      });
  });
  return out;
}

const RE_ANTIPATTERN = /\b(do\s+not\s+use|don['’]t\s+use|should\s+not|is\s+not\s+a\s+replacement|instead\s+of|avoid\s+using|never\s+use)\b/i;

function inheritTrace(c: Candidate): {
  source_basis: string;
  confidence: number;
  source_refs: string[];
  source_excerpts: string[];
} {
  return {
    source_basis: c.source_basis ?? "inferred",
    confidence: typeof c.confidence === "number" ? c.confidence : 0.7,
    source_refs: [...(c.source_refs ?? [])],
    source_excerpts: [...(c.source_excerpts ?? [])],
  };
}

/**
 * v1.02 B filtered promotion. Runs AFTER reduce() in compiler.functions.ts.
 * Conservative: only DUPLICATES candidates; never removes atomic_units /
 * retrieval_chunks; never invents facts (statements copied verbatim or split
 * by regex on conditional patterns).
 */
export function promoteAtomicsAndChunks(
  pkg: MergedPackage,
  options?: PromoteOptions,
): { promoted: number; rejected: PromotionReject[] } {
  const opts = {
    enabled: true,
    languageFilter: true,
    completenessFilter: true,
    detectConditionals: true,
    ...options,
  };

  if (!opts.enabled) {
    (pkg as unknown as { promotion_audit: PromotionAudit }).promotion_audit = {
      promoted_count: 0,
      rejected_count: 0,
      rejected_items: [],
    };
    return { promoted: 0, rejected: [] };
  }

  const packageLang = pkg.metadata?.language;
  const rejected: PromotionReject[] = [];
  let promoted = 0;

  const candidates = gatherCandidates(pkg);

  const filterGate = (
    c: Candidate,
    target: string,
    existing: Parameters<typeof isNearDuplicate>[1],
    requireComplete: boolean,
  ): boolean => {
    if (opts.languageFilter && !isLanguageConsistent(c.text, packageLang)) {
      rejected.push({
        source_id: c.id,
        source_section: c.section,
        target_section: target,
        reason: "language_mismatch",
        text_preview: c.text.slice(0, 80),
      });
      return false;
    }
    if (looksTruncated(c.text)) {
      rejected.push({
        source_id: c.id,
        source_section: c.section,
        target_section: target,
        reason: "truncated",
        text_preview: c.text.slice(0, 80),
      });
      return false;
    }
    if (opts.completenessFilter && requireComplete && !isCompleteProposition(c.text)) {
      rejected.push({
        source_id: c.id,
        source_section: c.section,
        target_section: target,
        reason: "incomplete_proposition",
        text_preview: c.text.slice(0, 80),
      });
      return false;
    }
    if (isNearDuplicate(c.text, existing)) {
      rejected.push({
        source_id: c.id,
        source_section: c.section,
        target_section: target,
        reason: "near_duplicate",
        text_preview: c.text.slice(0, 80),
      });
      return false;
    }
    return true;
  };

  // ── Conditional → if_then_rules ─────────────────────────────────────────
  if (opts.detectConditionals) {
    for (const c of candidates) {
      const parsed = detectConditionalClaim(c.text);
      if (!parsed.isConditional || !parsed.condition || !parsed.consequence) continue;

      if (opts.languageFilter && !isLanguageConsistent(c.text, packageLang)) {
        rejected.push({
          source_id: c.id, source_section: c.section,
          target_section: "if_then_rules", reason: "language_mismatch",
          text_preview: c.text.slice(0, 80),
        });
        continue;
      }
      if (opts.completenessFilter && !isCompleteProposition(parsed.consequence + ".")) {
        rejected.push({
          source_id: c.id, source_section: c.section,
          target_section: "if_then_rules", reason: "incomplete_proposition",
          text_preview: c.text.slice(0, 80),
        });
        continue;
      }
      const synthetic = `${parsed.condition} ${parsed.consequence}`;
      if (isNearDuplicate(synthetic, pkg.if_then_rules ?? [])) {
        rejected.push({
          source_id: c.id, source_section: c.section,
          target_section: "if_then_rules", reason: "near_duplicate",
          text_preview: c.text.slice(0, 80),
        });
        continue;
      }
      const trace = inheritTrace(c);
      pkg.if_then_rules = [
        ...(pkg.if_then_rules ?? []),
        {
          if: parsed.condition,
          then: parsed.consequence,
          because: parsed.exception ? `Exception: ${parsed.exception}` : undefined,
          ...trace,
          confidence: trace.confidence * 0.85,
        },
      ];
      promoted++;
    }
  }

  // ── Procedural → playbooks ──────────────────────────────────────────────
  for (const c of candidates) {
    if (!containsProceduralLanguage(c.text)) continue;
    if (!filterGate(c, "playbooks", pkg.playbooks ?? [], true)) continue;

    const stepMatches = c.text
      .split(/\b\d[\.\)]\s+|\bfirst\b|\bthen\b|\bnext\b|\bfinally\b|\bprimeiro\b|\bdepois\b|\bpor\s+fim\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 4);
    const steps = stepMatches.length > 1 ? stepMatches.slice(0, 8) : [c.text];

    const trace = inheritTrace(c);
    pkg.playbooks = [
      ...(pkg.playbooks ?? []),
      {
        name: c.text.slice(0, 80),
        activation_context: c.text,
        steps,
        ...trace,
        confidence: trace.confidence * 0.85,
      },
    ];
    promoted++;
  }

  // ── "do not use" / "instead of" → anti_patterns ─────────────────────────
  for (const c of candidates) {
    if (!RE_ANTIPATTERN.test(c.text)) continue;
    if (!filterGate(c, "anti_patterns", pkg.anti_patterns ?? [], true)) continue;
    const trace = inheritTrace(c);
    pkg.anti_patterns = [
      ...(pkg.anti_patterns ?? []),
      {
        name: c.text.slice(0, 80),
        description: c.text,
        why_it_fails: c.text,
        ...trace,
      },
    ];
    promoted++;
  }

  const audit: PromotionAudit = {
    promoted_count: promoted,
    rejected_count: rejected.length,
    rejected_items: rejected,
  };
  (pkg as unknown as { promotion_audit: PromotionAudit }).promotion_audit = audit;

  return { promoted, rejected };
}

