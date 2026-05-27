// CKF Compiler v1.2 — Numeric guards (domain-agnostic).
//
// Generic post-LLM validation of numeric / temporal / citation tokens for ANY
// domain (finance, science, software, education, healthcare, law, etc.) and
// ANY language. Prevents truncation-class hallucinations (e.g. "$1,250,000.00"
// → "$1,250" or "R$ 200.000,00" → "R$ 200") by:
//   1. Extracting NumericFacts per span BEFORE the LLM call (rich set of
//      patterns spanning multiple currencies, date locales, durations,
//      percentages, and citation references such as DOI / ISBN / RFC / ISO /
//      § / Section / Chapter / Art. / Lei / Decreto).
//   2. After extraction, scanning every extracted item's text for numeric
//      tokens and verifying each one matches a literal occurrence in the
//      span(s) referenced by the item's source_refs.
//   3. Auto-correcting truncated prefixes to the literal source form when the
//      shorter token is unambiguously a prefix of a longer source token.

export type NumericKind =
  | "money"
  | "percent"
  | "date"
  | "time"
  | "duration"
  | "citation_reference"
  | "quantity";

export type NumericFact = {
  value_text: string;
  normalized_value?: number;
  kind: NumericKind;
  source_ref: string;
  context_excerpt: string;
};

// ── Patterns ───────────────────────────────────────────────────────────────
// Designed to greedily capture the FULL token so the validator never produces
// truncated prefixes itself. Supports both `1,234.56` (US/UK) and `1.234,56`
// (BR/EU) numeric conventions.

// Currencies: symbol-prefix (R$, US$, $, US$, CA$, A$, €, £, ¥) and ISO codes
// (USD, BRL, EUR, GBP, JPY, CHF, CAD, AUD) suffix or prefix.
const RE_MONEY_SYMBOL =
  /(?:R\$|US\$|CA\$|A\$|HK\$|S\$|NZ\$|\$|€|£|¥|₹|₽|₩)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,4})?/g;
const RE_MONEY_ISO =
  /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,4})?\s?(?:USD|BRL|EUR|GBP|JPY|CHF|CAD|AUD|MXN|CNY|INR|RUB|KRW)\b/g;

const RE_PERCENT = /\d{1,3}(?:[.,]\d+)?\s?%/g;

// Dates: ISO, US (M/D/YYYY), BR/EU (D/M/YYYY), long forms in EN / PT / ES.
const RE_DATE_ISO = /\b\d{4}-\d{2}-\d{2}\b/g;
const RE_DATE_SLASH = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
const RE_DATE_DASH = /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g;
const RE_DATE_LONG_EN =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{2,4}\b/gi;
const RE_DATE_LONG_PT_ES =
  /\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+\d{2,4})?\b/gi;

// Time: 24h ("14:30", "14:30:15"), 12h ("2:30pm"), BR shorthand ("14h30").
const RE_TIME_HMS = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:am|pm|AM|PM))?\b/g;
const RE_TIME_BR = /\b\d{1,2}h(?:\d{1,2}(?:min(?:\d{1,2}s?)?)?)?\b/g;

// Durations in PT / EN / ES.
const RE_DURATION =
  /\b\d+\s?(?:dias?|meses?|anos?|horas?|minutos?|segundos?|semanas?|quotas?|days?|weeks?|months?|years?|hours?|minutes?|seconds?|días?|semanas?|años?)\b/gi;

// Citation references — broad: legal norms, scientific identifiers, sections,
// chapters, articles, paragraphs across languages.
const RE_LEGAL_LATAM =
  /\b(?:Lei|Decreto|Instru[çc][ãa]o\s+Normativa|Portaria|Medida\s+Provis[óo]ria|Resolu[çc][ãa]o|Ley|Decreto|Reglamento)\b(?:\s+(?:Federal|Estadual|Municipal|RFB|complementar))?\s+(?:nº|n\.?|No\.?)?\s*[\d.\/-]+/gi;
const RE_ARTICLE =
  /\b(?:art\.?|artigo|article|art[íi]culo|§)\s*\d+[\dºªo°-]*/gi;
const RE_SECTION_CHAPTER =
  /\b(?:Section|Chapter|Cap[íi]tulo|Cap[íi]tulo|Sec[çc][ãa]o|Cap\.|Sec\.)\s+\d+(?:\.\d+)*/gi;
const RE_STANDARD =
  /\b(?:RFC|ISO|IEC|IEEE|ANSI|NIST|W3C|ITU)[\s-]*\d{1,6}(?:-\d+)?(?::\d{4})?\b/g;
const RE_DOI = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
const RE_ISBN = /\bISBN(?:-1[03])?:?\s*(?:97[89][-\s]?)?(?:\d[-\s]?){9}[\dXx]\b/gi;

// Quantity (with thousand separators — protects from being mis-parsed as money).
const RE_QUANTITY = /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\b/g;

const ALL_PATTERNS: { re: RegExp; kind: NumericKind }[] = [
  { re: RE_MONEY_SYMBOL, kind: "money" },
  { re: RE_MONEY_ISO, kind: "money" },
  { re: RE_PERCENT, kind: "percent" },
  { re: RE_DATE_ISO, kind: "date" },
  { re: RE_DATE_SLASH, kind: "date" },
  { re: RE_DATE_DASH, kind: "date" },
  { re: RE_DATE_LONG_EN, kind: "date" },
  { re: RE_DATE_LONG_PT_ES, kind: "date" },
  { re: RE_TIME_HMS, kind: "time" },
  { re: RE_TIME_BR, kind: "time" },
  { re: RE_DURATION, kind: "duration" },
  { re: RE_LEGAL_LATAM, kind: "citation_reference" },
  { re: RE_ARTICLE, kind: "citation_reference" },
  { re: RE_SECTION_CHAPTER, kind: "citation_reference" },
  { re: RE_STANDARD, kind: "citation_reference" },
  { re: RE_DOI, kind: "citation_reference" },
  { re: RE_ISBN, kind: "citation_reference" },
  { re: RE_QUANTITY, kind: "quantity" },
];

export function extractNumericFacts(text: string, sourceRef: string): NumericFact[] {
  const facts: NumericFact[] = [];
  const seen = new Set<string>();
  for (const { re, kind } of ALL_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const value = m[0];
      const key = `${kind}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ctxStart = Math.max(0, m.index - 60);
      const ctxEnd = Math.min(text.length, m.index + value.length + 60);
      facts.push({
        value_text: value,
        kind,
        source_ref: sourceRef,
        context_excerpt: text.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return facts;
}

export type NumericIntegrityReport = {
  numeric_integrity_score: number; // 0..1
  total_values_checked: number;
  exact_matches: number;
  corrected: number;
  unverifiable: number;
  corrections: Array<{
    item_id?: string;
    field?: string;
    from: string;
    to: string;
    source_ref: string;
  }>;
};

/**
 * Scan an item's text for numeric tokens and verify each one against the
 * literal text of its source span(s). Truncated prefixes (e.g. "$1,250" or
 * "R$ 200") that match the start of a longer source value (e.g. "$1,250,000"
 * / "R$ 200.000,00") are auto-corrected to the literal form found in the
 * source. Works for any locale / domain — patterns cover US, EU, BR and
 * common citation conventions (DOI, ISBN, RFC, ISO, Section, Chapter, Art.).
 */
export function validateAndRepair(
  pkg: { source_traceability?: Array<{ extracted_item_id: string; source_location: string; source_excerpt: string }> } & Record<string, unknown>,
  spanTextById: Map<string, string>,
): NumericIntegrityReport {
  const corrections: NumericIntegrityReport["corrections"] = [];
  let total = 0;
  let matched = 0;
  let corrected = 0;
  let unverifiable = 0;

  const sections = [
    "principles", "decision_rules", "procedures", "anti_patterns", "exceptions",
    "if_then_rules", "playbooks", "qa_pairs", "retrieval_chunks", "atomic_units",
    "heuristics", "concepts", "entities",
  ];

  for (const section of sections) {
    const arr = (pkg as Record<string, unknown[]>)[section];
    if (!Array.isArray(arr)) continue;
    for (const rawItem of arr) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as Record<string, unknown>;
      const refs = Array.isArray(item.source_refs) ? (item.source_refs as string[]) : [];
      if (!refs.length) continue;
      const sourceText = refs.map((r) => spanTextById.get(r) ?? "").join("\n");
      if (!sourceText) continue;

      // Collect all string fields likely to carry value text.
      for (const [field, val] of Object.entries(item)) {
        if (typeof val !== "string" || !val) continue;
        if (field === "id" || field.startsWith("source_")) continue;

        let updated = val;
        const facts = extractNumericFacts(val, "item");
        for (const fact of facts) {
          total++;
          // Exact literal match in source?
          if (sourceText.includes(fact.value_text)) {
            matched++;
            continue;
          }
          // Truncated prefix? Find longer literal that starts with this value.
          const longer = findLongerLiteralMatch(fact.value_text, fact.kind, sourceText);
          if (longer) {
            corrected++;
            const escaped = fact.value_text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            updated = updated.replace(new RegExp(escaped + "(?![\\d.,])", "g"), longer);
            corrections.push({
              item_id: typeof item.id === "string" ? item.id : undefined,
              field,
              from: fact.value_text,
              to: longer,
              source_ref: refs[0] ?? "",
            });
          } else {
            unverifiable++;
          }
        }
        if (updated !== val) item[field] = updated;
      }
    }
  }

  const denom = total || 1;
  const numeric_integrity_score = Math.max(0, Math.min(1, (matched + corrected) / denom - unverifiable * 0.1));
  return {
    numeric_integrity_score: total === 0 ? 1 : numeric_integrity_score,
    total_values_checked: total,
    exact_matches: matched,
    corrected,
    unverifiable,
    corrections,
  };
}

function findLongerLiteralMatch(prefix: string, kind: NumericKind, source: string): string | null {
  // Only correct numeric-like prefixes — never autopatch dates or citation
  // references (too risky: "Art. 5" could legitimately differ from "Art. 50").
  if (kind === "date" || kind === "citation_reference") return null;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Look for the prefix followed by extra digits/separators that complete a
  // longer numeric token (covers both `1,234.56` and `1.234,56` conventions).
  const re = new RegExp(escaped + "[.,]\\d+(?:[.,]\\d+)?", "g");
  const m = re.exec(source);
  if (m) return m[0];
  // Or money with thousand separators: "$200" → "$200,000.00" or
  // "R$ 200" → "R$ 200.000,00".
  if (kind === "money") {
    const re2 = new RegExp(escaped + "[.,]\\d{3}(?:[.,]\\d{3})*(?:[.,]\\d{1,4})?", "g");
    const m2 = re2.exec(source);
    if (m2) return m2[0];
  }
  return null;
}
