// Client-side PDF renderer for the Inspection Report (Basic + optional Advanced).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BasicReport } from "./inspectionBasic";

export type AdvancedSections = {
  model: string;
  provider: string;
  language: string;
  executive_summary?: string;
  consistency_findings?: Array<{
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
    refs: string[];
  }>;
  composition_risks?: Array<{
    risk: string;
    rules_involved: string[];
    test_suggestion: string;
  }>;
  coverage_gaps?: Array<{ topic: string; evidence: string }>;
  suggestions?: Array<{
    section: string;
    severity: "low" | "medium" | "high";
    action: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function pdfSafe(s: string): string {
  return String(s ?? "")
    .replace(/[★☆✦✧]/g, "*")
    .replace(/[→➔➜]/g, "->")
    .replace(/[←]/g, "<-")
    .replace(/[—–−]/g, "-")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[≠]/g, "!=")
    .replace(/[≈]/g, "~")
    .replace(/[•]/g, "-")
    .replace(/[…]/g, "...")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xFF]/g, "");
}

function wrap(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split("\n")) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

export async function renderInspectionPdf(
  report: BasicReport,
  advanced: AdvancedSections | null,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const MARGIN = 50;
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MAX_W = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 60;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 60;
  };

  const draw = (
    text: string,
    opts?: {
      font?: typeof font;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
    },
  ) => {
    const f = opts?.font ?? font;
    const size = opts?.size ?? 10;
    const color = opts?.color ?? rgb(0.12, 0.12, 0.12);
    const indent = opts?.indent ?? 0;
    const lines = wrap(pdfSafe(text), f, size, MAX_W - indent);
    for (const line of lines) {
      if (y < 60) newPage();
      page.drawText(line, { x: MARGIN + indent, y, size, font: f, color });
      y -= size + 4;
    }
  };
  const space = (n = 6) => {
    y -= n;
  };
  const h1 = (t: string) => {
    space(8);
    draw(t, { font: bold, size: 16, color: rgb(0.05, 0.05, 0.05) });
    space(2);
  };
  const h2 = (t: string) => {
    space(6);
    draw(t, { font: bold, size: 12, color: rgb(0.1, 0.1, 0.1) });
    space(2);
  };
  const muted = (t: string) => draw(t, { size: 9, color: rgb(0.45, 0.45, 0.45) });
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  // ---------- Cover ----------
  draw("CKF Inspection Report", { font: bold, size: 22 });
  space(4);
  draw(report.cover.title, { font: bold, size: 14 });
  muted(
    `${report.cover.domain} · ${report.cover.language} · CKF v${report.cover.protocolVersion} · ${report.cover.compression}`,
  );
  muted(`Author: ${report.cover.author}`);
  muted(`Package: ${report.pkgFileName ?? "—"}  ·  package_id: ${report.cover.packageId}`);
  if (report.sourceFileName) muted(`Source linked: ${report.sourceFileName}`);
  muted(`Generated: ${report.generatedAt}`);
  space();
  draw(
    advanced
      ? "Two-tier report: heuristic structural analysis + AI-derived insights."
      : "Heuristic structural analysis. AI insights not included (zero-config, schema-stable).",
    { size: 10, color: rgb(0.3, 0.3, 0.3) },
  );

  // ---------- 1. Package inventory ----------
  h1("1. Package inventory");
  draw(`Total items across 22 sections: ${report.inventory.totalItems}`);
  space(2);
  for (const s of report.inventory.sections) {
    draw(`  ${s.label.padEnd(24)} ${String(s.count).padStart(5)}`, { font: mono, size: 9 });
  }
  if (report.inventory.emptySections.length) {
    space(4);
    draw(`Empty sections: ${report.inventory.emptySections.join(", ")}`, {
      size: 9,
      color: rgb(0.55, 0.35, 0.05),
    });
  }
  if (Object.keys(report.inventory.atomicTypeDist).length) {
    space(4);
    draw("Atomic units by type:", { font: bold, size: 10 });
    for (const [t, n] of Object.entries(report.inventory.atomicTypeDist)) {
      draw(`  ${t}: ${n}`, { font: mono, size: 9 });
    }
  }

  // ---------- 2. Quality card ----------
  h1("2. Quality card");
  draw(
    `human_readability: ${report.quality.humanReadability}/10   ai_utility_score: ${report.quality.aiUtility}/10   compression: ${report.quality.compression}`,
  );
  space(4);
  draw("Confidence distribution (across all items with `confidence`):", { font: bold, size: 10 });
  for (const b of report.quality.confidenceBuckets) {
    draw(`  ${b.range.padEnd(10)} ${b.count}`, { font: mono, size: 9 });
  }
  if (report.quality.confidenceMean !== null) {
    muted(`mean confidence = ${report.quality.confidenceMean.toFixed(3)}`);
  }

  // ---------- 3. Traceability ----------
  h1("3. Traceability coverage");
  draw(
    `${report.traceability.itemsWithTrace} of ${report.traceability.itemsTotal} items carry source_excerpts or source_refs (${pct(report.traceability.overallPct)}).`,
  );
  space(4);
  draw("Worst-covered sections:", { font: bold, size: 10 });
  for (const r of report.traceability.worstSections) {
    draw(
      `  ${r.section.padEnd(24)} ${pct(r.pct).padStart(7)}   (${r.withTrace}/${r.total})`,
      { font: mono, size: 9 },
    );
  }
  space(4);
  draw(`Orphan items (no trace): ${report.traceability.orphanCount}`, { font: bold, size: 10 });
  if (report.traceability.orphans.length) {
    for (const o of report.traceability.orphans) {
      draw(`  [${o.section}] ${o.id}${o.title ? "  -  " + o.title : ""}`, {
        font: mono,
        size: 8,
        color: rgb(0.35, 0.35, 0.35),
      });
    }
    if (report.traceability.orphanCount > report.traceability.orphans.length) {
      muted(
        `  ...and ${report.traceability.orphanCount - report.traceability.orphans.length} more`,
      );
    }
  }

  // ---------- 4. Source coverage ----------
  h1("4. Source coverage");
  if (!report.sourceCoverage.available) {
    muted("No source file linked. Link the original document in the viewer to enable this section.");
  } else {
    draw(
      `${report.sourceCoverage.locatedExcerpts} of ${report.sourceCoverage.totalExcerpts} excerpts located in the source text (${pct(report.sourceCoverage.pct)}).`,
    );
    if (report.sourceCoverage.failures.length) {
      space(4);
      draw("Sample of unlocated excerpts:", { font: bold, size: 10 });
      for (const f of report.sourceCoverage.failures) {
        draw(`  [${f.section}] ${f.id}`, { font: mono, size: 8, color: rgb(0.4, 0.4, 0.4) });
        draw(`    "${f.excerpt}"`, { size: 9, color: rgb(0.35, 0.35, 0.35), indent: 8 });
      }
    }
  }

  // ---------- 5. Compression ----------
  h1("5. Compression diff");
  if (!report.compression) {
    muted("Requires a linked source file.");
  } else {
    const c = report.compression;
    draw(`Source: ${c.sourceBytes.toLocaleString()} bytes  (~${c.sourceTokensEst.toLocaleString()} tokens est.)`);
    draw(`CKF:    ${c.ckfBytes.toLocaleString()} bytes  (~${c.ckfTokensEst.toLocaleString()} tokens est.)`);
    draw(
      `Ratio:  ${c.ratio.toFixed(3)}  (reduction: ${c.reductionPct >= 0 ? "-" : "+"}${Math.abs(c.reductionPct).toFixed(1)}%)`,
      { font: bold },
    );
    muted("Token counts use a chars/4 heuristic; treat as order-of-magnitude.");
  }

  // ---------- 6. Rules catalog ----------
  h1("6. Executable rules");
  draw(
    `if_then=${report.rules.if_then_rules}  decision=${report.rules.decision_rules}  exceptions=${report.rules.exceptions}  contextual_triggers=${report.rules.contextual_triggers}  heuristics=${report.rules.heuristics}`,
    { font: mono, size: 9 },
  );
  if (report.rules.samples.if_then.length) {
    space(4);
    draw("Sample IF-THEN rules:", { font: bold, size: 10 });
    for (const r of report.rules.samples.if_then) {
      draw(`  ${r.id}`, { font: mono, size: 8, color: rgb(0.45, 0.45, 0.45) });
      draw(`    IF ${r.if}`, { size: 9, indent: 8 });
      draw(`    THEN ${r.then}`, { size: 9, indent: 8 });
    }
  }
  if (report.rules.samples.exceptions.length) {
    space(4);
    draw("Sample exceptions:", { font: bold, size: 10 });
    for (const r of report.rules.samples.exceptions) {
      draw(`  ${r.id}`, { font: mono, size: 8, color: rgb(0.45, 0.45, 0.45) });
      draw(`    CASE: ${r.case}`, { size: 9, indent: 8 });
      draw(`    ACTION: ${r.modified}`, { size: 9, indent: 8 });
    }
  }

  // ---------- 7. Limits & anti-patterns ----------
  h1("7. Knowledge limits & anti-patterns");
  const limitsBlock = (label: string, items: string[]) => {
    if (!items.length) return;
    draw(label + ":", { font: bold, size: 10 });
    for (const i of items) draw(`  - ${i}`, { size: 9, color: rgb(0.3, 0.3, 0.3) });
    space(2);
  };
  limitsBlock("Missing context", report.limits.missing_context);
  limitsBlock("Weakly supported claims", report.limits.weakly_supported_claims);
  limitsBlock("Assumptions detected", report.limits.assumptions_detected);
  limitsBlock("Possible biases", report.limits.possible_biases);
  limitsBlock("Outdated sections", report.limits.outdated_sections);
  limitsBlock("Needs human review", report.limits.needs_human_review);
  if (report.antiPatterns.length) {
    draw("Anti-patterns:", { font: bold, size: 10 });
    for (const a of report.antiPatterns) {
      draw(`  - ${a.name}`, { size: 9 });
      draw(`    ${a.description}`, { size: 9, color: rgb(0.4, 0.4, 0.4), indent: 4 });
    }
  }

  // ---------- 8. Advanced (LLM) sections ----------
  if (advanced) {
    newPage();
    draw("Advanced AI Inspection", { font: bold, size: 18 });
    muted(
      `Model: ${advanced.model}  ·  Provider: ${advanced.provider}  ·  Language: ${advanced.language}`,
    );
    if (advanced.usage) {
      muted(
        `tokens_in=${advanced.usage.prompt_tokens ?? "—"}  tokens_out=${advanced.usage.completion_tokens ?? "—"}`,
      );
    }
    space(4);

    if (advanced.executive_summary) {
      h2("A. Executive summary");
      draw(advanced.executive_summary);
    }

    if (advanced.consistency_findings?.length) {
      h2("B. Consistency analysis");
      for (const f of advanced.consistency_findings) {
        draw(`[${f.severity.toUpperCase()}] ${f.title}`, { font: bold, size: 10 });
        draw(f.detail, { size: 9, color: rgb(0.3, 0.3, 0.3) });
        if (f.refs?.length)
          draw(`refs: ${f.refs.join(", ")}`, { font: mono, size: 8, color: rgb(0.45, 0.45, 0.45) });
        space(3);
      }
    }

    if (advanced.composition_risks?.length) {
      h2("C. Composition-hallucination risk");
      for (const r of advanced.composition_risks) {
        draw(`- ${r.risk}`, { size: 10 });
        if (r.rules_involved?.length)
          draw(`  rules: ${r.rules_involved.join(", ")}`, {
            font: mono,
            size: 8,
            color: rgb(0.45, 0.45, 0.45),
          });
        if (r.test_suggestion) draw(`  test: ${r.test_suggestion}`, { size: 9, color: rgb(0.3, 0.3, 0.3) });
        space(2);
      }
    }

    if (advanced.coverage_gaps?.length) {
      h2("D. Coverage gaps vs source");
      for (const g of advanced.coverage_gaps) {
        draw(`- ${g.topic}`, { size: 10 });
        if (g.evidence) draw(`  ${g.evidence}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
      }
    }

    if (advanced.suggestions?.length) {
      h2("E. Suggested improvements");
      for (const s of advanced.suggestions) {
        draw(`[${s.severity.toUpperCase()}] (${s.section}) ${s.action}`, { size: 10 });
      }
    }
  }

  // ---------- Footer ----------
  space(10);
  muted("Generated by compiledknowledgeformat.org · Heuristic sections are schema-stable and reproducible.");

  const bytes = await pdf.save();
  const base = (report.pkgFileName ?? "ckf")
    .replace(/\.(ckf|json|yaml|yml|md)$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  const filename = `inspection-${base || "report"}${advanced ? "-advanced" : ""}.pdf`;
  return { bytes, filename };
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
