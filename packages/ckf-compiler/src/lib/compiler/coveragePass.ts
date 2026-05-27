// CKF Compiler v1.2 — Coverage pass.
//
// Schema-stable insertion of retrieval_chunks, qa_pairs and atomic_units
// directly from SourceSpan[] to guarantee a minimum coverage floor. Designed
// to complement (not replace) LLM extraction: it only adds items when the
// LLM under-covered the corpus and never overwrites existing extracted
// content. All inserted items carry source_basis "explicit" or "normalized".

import type { SourceSpan } from "./sourceSegmenter";
import type { MergedPackage } from "./reduce";
import { extractNumericFacts } from "./numericGuards";

export type CoverageMode = "summary" | "balanced" | "complete";

export type CoverageReport = {
  mode: CoverageMode;
  inserted_retrieval_chunks: number;
  inserted_qa_pairs: number;
  inserted_atomic_units: number;
  spans_total: number;
  spans_covered: number;
  source_record_coverage: number; // 0..1
};

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

export function applyCoveragePass(
  pkg: MergedPackage,
  spans: SourceSpan[],
  mode: CoverageMode,
  opts?: { detectedFormat?: string },
): CoverageReport {
  const report: CoverageReport = {
    mode,
    inserted_retrieval_chunks: 0,
    inserted_qa_pairs: 0,
    inserted_atomic_units: 0,
    spans_total: spans.length,
    spans_covered: 0,
    source_record_coverage: 0,
  };

  if (mode === "summary" || spans.length === 0) {
    report.spans_covered = countCoveredSpans(pkg, spans);
    report.source_record_coverage = report.spans_covered / Math.max(1, spans.length);
    return report;
  }

  // Index spans already covered by existing retrieval_chunks via source_refs.
  const coveredSpanIds = new Set<string>();
  for (const rc of pkg.retrieval_chunks ?? []) {
    for (const ref of rc.source_refs ?? []) coveredSpanIds.add(ref);
  }
  const existingChunkTitles = new Set((pkg.retrieval_chunks ?? []).map((rc) => norm(rc.title)));
  const existingQaQuestions = new Set((pkg.qa_pairs ?? []).map((q) => norm(q.question)));
  const existingAtomicStatements = new Set((pkg.atomic_units ?? []).map((a) => norm(a.statement)));

  const llmChunkCount = pkg.retrieval_chunks?.length ?? 0;
  const coverageRatio = llmChunkCount / Math.max(1, spans.length);
  const shouldInsertRetrieval =
    mode === "complete" || (mode === "balanced" && coverageRatio < 0.6);

  const isFaqLike = opts?.detectedFormat === "jsonl_records" ||
                    opts?.detectedFormat === "json_array_records" ||
                    opts?.detectedFormat === "faq";

  for (const span of spans) {
    const spanCovered = coveredSpanIds.has(span.spanId);
    const text = span.text.trim();
    if (!text) continue;
    if (text.length < 80 && mode === "balanced") continue;

    // 1) Retrieval chunk.
    if (shouldInsertRetrieval && !spanCovered) {
      const title = (span.title || span.heading || span.sourceRecordId || makePathTitle(span.path)).trim().slice(0, 120);
      if (!existingChunkTitles.has(norm(title))) {
        pkg.retrieval_chunks.push({
          title,
          standalone_context: span.heading ?? span.title ?? span.sourceRecordId ?? "",
          compressed_knowledge: text.length > 1200 ? text.slice(0, 1200) + "…" : text,
          activation_queries: [],
          related_rules: [],
          related_entities: [],
          related_concepts: [],
          source_refs: [span.spanId],
          source_excerpts: [text.slice(0, 600)],
          source_basis: "explicit",
          confidence: 1,
        });
        existingChunkTitles.add(norm(title));
        report.inserted_retrieval_chunks++;
      }
    }

    // 2) QA pair for FAQ/JSONL structured sources in complete mode.
    if (mode === "complete" && isFaqLike) {
      const question = synthesizeQuestion(span);
      if (question && !existingQaQuestions.has(norm(question))) {
        const answer = text.length > 1500 ? text.slice(0, 1500) + "…" : text;
        pkg.qa_pairs.push({
          question,
          ideal_answer: answer,
          source_concepts: [],
          difficulty: "medium",
          answer_type: "factual",
          source_refs: [span.spanId],
          source_excerpts: [text.slice(0, 600)],
          source_basis: "explicit",
          confidence: 1,
        });
        existingQaQuestions.add(norm(question));
        report.inserted_qa_pairs++;
      }
    }

    // 3) Atomic units for numeric facts + modal verbs.
    if (mode === "complete" || mode === "balanced") {
      const numericFacts = extractNumericFacts(text, span.spanId);
      for (const nf of numericFacts.slice(0, 8)) {
        const statement = `${nf.context_excerpt}`.trim();
        if (statement.length < 20) continue;
        if (existingAtomicStatements.has(norm(statement))) continue;
        pkg.atomic_units.push({
          statement,
          type: "numeric_fact",
          tags: [nf.kind],
          source_refs: [span.spanId],
          source_excerpts: [nf.value_text],
          source_basis: "explicit",
          confidence: 1,
        });
        existingAtomicStatements.add(norm(statement));
        report.inserted_atomic_units++;
      }

      if (mode === "complete") {
        const modalUnits = extractModalAtomicUnits(text, span.spanId);
        for (const mu of modalUnits) {
          if (existingAtomicStatements.has(norm(mu.statement))) continue;
          pkg.atomic_units.push({
            statement: mu.statement,
            type: mu.type,
            source_refs: [span.spanId],
            source_excerpts: [mu.excerpt],
            source_basis: "explicit",
            confidence: 1,
          });
          existingAtomicStatements.add(norm(mu.statement));
          report.inserted_atomic_units++;
        }
      }
    }
  }

  report.spans_covered = countCoveredSpans(pkg, spans);
  report.source_record_coverage = report.spans_covered / Math.max(1, spans.length);
  return report;
}

function countCoveredSpans(pkg: MergedPackage, spans: SourceSpan[]): number {
  const covered = new Set<string>();
  const sections = [pkg.retrieval_chunks, pkg.qa_pairs, pkg.atomic_units, pkg.decision_rules, pkg.procedures];
  for (const section of sections) {
    for (const item of section as Array<{ source_refs?: string[] }>) {
      for (const ref of item.source_refs ?? []) covered.add(ref);
    }
  }
  return spans.filter((s) => covered.has(s.spanId)).length;
}

function makePathTitle(path: string): string {
  const parts = path.split(">").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function synthesizeQuestion(span: SourceSpan): string | null {
  // 1) Explicit FAQ marker.
  const q = span.text.match(/^(?:Q:|P:|Pergunta\s*[:\-—])\s*(.+?)(?:\n|$)/i);
  if (q) return q[1].trim().slice(0, 240);
  // 2) Use title/heading.
  if (span.title && /\?/.test(span.title)) return span.title.trim().slice(0, 240);
  if (span.title) return `O que estabelece "${span.title.trim().slice(0, 180)}"?`;
  if (span.heading) return `O que estabelece "${span.heading.trim().slice(0, 180)}"?`;
  // 3) First sentence of body as topic.
  const firstSentence = span.text.split(/[.!?\n]/)[0]?.trim();
  if (firstSentence && firstSentence.length > 20) {
    return `Sobre "${firstSentence.slice(0, 120)}"?`;
  }
  return null;
}

function extractModalAtomicUnits(
  text: string,
  _spanId: string,
): Array<{ statement: string; type: string; excerpt: string }> {
  const out: Array<{ statement: string; type: string; excerpt: string }> = [];
  const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 80);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length < 30 || trimmed.length > 320) continue;
    if (/\b(deve|deverá|está obrigad[oa]|é obrigatóri[oa]|obriga-se)\b/i.test(trimmed)) {
      out.push({ statement: trimmed, type: "obligation", excerpt: trimmed });
      continue;
    }
    if (/\b(é vedad[oa]|não pode|fica proibid[oa]|veda-se|proíbe-se)\b/i.test(trimmed)) {
      out.push({ statement: trimmed, type: "prohibition", excerpt: trimmed });
      continue;
    }
    if (/\b(exceto|salvo|fica dispensad[oa]|desde que|ressalvad[oa])\b/i.test(trimmed)) {
      out.push({ statement: trimmed, type: "exception", excerpt: trimmed });
    }
  }
  return out.slice(0, 6);
}
