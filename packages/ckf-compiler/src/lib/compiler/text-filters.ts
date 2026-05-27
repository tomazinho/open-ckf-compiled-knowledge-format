// CKF Compiler v1.02 B — text filters used by the promotion module.
// Centralizes: language detection / consistency, completeness, truncation,
// near-duplicate detection, and conditional/procedural language detection.

import { franc } from "franc-min";

const LANG_MAP: Record<string, string> = {
  eng: "en",
  por: "pt",
  spa: "es",
  fra: "fr",
  deu: "de",
  ita: "it",
  nld: "nl",
  jpn: "ja",
  cmn: "zh",
  rus: "ru",
};

/** Detect ISO 2-letter language code; returns null for short / undetected. */
export function detectLanguage(text: string): string | null {
  if (!text || text.length < 30) return null;
  const detected = franc(text, { minLength: 30 });
  if (detected === "und") return null;
  return LANG_MAP[detected] ?? null;
}

// ── v1.04 short-string language signals ─────────────────────────────────
// `franc-min` (used in detectLanguage) gives up on texts < 30 chars and
// `isLanguageConsistent` short-circuits at < 50 chars to avoid false rejects.
// That gap lets short PT labels ("Camada Operacional", "Fidelidade Visual")
// survive inside an EN package. The signals below fill that gap for the
// common EN ↔ PT case the project actually ships.

// High-confidence PT tokens: characters that don't appear in English at all,
// plus PT stopwords that almost never appear in EN technical writing.
const PT_ACCENT_RE = /[ãõçáéíóúâêôà]/i;
const PT_STOPWORDS = [
  "não", "são", "está", "estão", "também", "então", "porque",
  "para", "pelo", "pela", "pelos", "pelas", "uma", "umas", "uns",
  "com", "sem", "mas", "ser", "ter", "fazer", "deve", "pode",
  "que", "como", "quando", "onde", "isso", "essa", "esse",
  "muito", "mesmo", "sobre", "entre", "depois", "antes",
  "camada", "fidelidade", "operacional", "conhecimento",
];
const PT_STOPWORD_RE = new RegExp(
  `\\b(?:${PT_STOPWORDS.join("|")})\\b`,
  "i",
);

// EN stopwords used as a counter-signal so we don't flag PT inside an EN
// quote like "the Camada Operacional layer" (which is mostly English).
const EN_STOPWORDS = [
  "the", "and", "with", "that", "from", "this", "these", "those",
  "into", "must", "should", "would", "could", "have", "been",
  "when", "where", "which", "while", "what", "such", "than",
];
const EN_STOPWORD_RE = new RegExp(
  `\\b(?:${EN_STOPWORDS.join("|")})\\b`,
  "i",
);

export function containsPortugueseSignals(text: string): boolean {
  if (!text) return false;
  if (PT_ACCENT_RE.test(text)) return true;
  const matches = text.match(new RegExp(PT_STOPWORD_RE.source, "gi"));
  return !!matches && matches.length >= 1;
}

export function containsEnglishSignals(text: string): boolean {
  if (!text) return false;
  const matches = text.match(new RegExp(EN_STOPWORD_RE.source, "gi"));
  return !!matches && matches.length >= 1;
}

/**
 * Catch wrong-language items that `isLanguageConsistent` misses on short
 * strings. Conservative: only flags when the OPPOSITE language has clear
 * positive signals AND the expected language has none (with accented chars
 * as a hard PT marker that EN never produces).
 */
export function isLikelyWrongLanguage(
  text: string,
  expectedLang: string | undefined,
): boolean {
  if (!text || !expectedLang) return false;
  const t = text.trim();
  if (t.length < 12) return false;

  const lang = expectedLang.toLowerCase();
  const isEn = lang === "en" || lang.startsWith("en-");
  const isPt = lang === "pt" || lang.startsWith("pt-") || lang === "por";

  if (isEn) {
    if (PT_ACCENT_RE.test(t)) return true; // accented chars never appear in EN
    if (!containsPortugueseSignals(t)) return false;
    return !containsEnglishSignals(t);
  }

  if (isPt) {
    if (!containsEnglishSignals(t)) return false;
    return !containsPortugueseSignals(t);
  }

  return false;
}

/** Texts < 50 chars accepted by default to avoid false rejects. */
export function isLanguageConsistent(
  text: string,
  packageLang: string | undefined,
): boolean {
  if (!packageLang) return true;
  if (!text || text.length < 50) return true;
  const detected = detectLanguage(text);
  if (!detected) return true;
  // Normalize expected lang for franc's ISO short codes.
  const expected = packageLang.toLowerCase().split("-")[0];
  return detected === expected;
}

const DANGLING_WORDS = new Set([
  // EN
  "and", "or", "but", "with", "of", "in", "on", "at", "to", "from", "by",
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "as", "if", "when", "while", "that", "which", "who", "vs",
  // PT
  "e", "ou", "mas", "com", "de", "em", "para", "por", "no", "na", "nos", "nas",
  "do", "da", "dos", "das", "que", "se", "quando", "como", "porque",
  "é", "são", "foi", "foram", "ser", "sendo",
  // ES
  "y", "pero", "con", "del", "si", "cuando",
]);

/** Reject syntactic fragments / headings / dangling clauses. */
export function isCompleteProposition(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length < 20) return false;
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÀÇa-z\d"'„«]/u.test(trimmed)) return false;
  if (!/[.!?…]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 4) return false;
  const lastWord = words[words.length - 1].replace(/[.!?…,;:]+$/, "").toLowerCase();
  if (DANGLING_WORDS.has(lastWord)) return false;
  const letterCount = (trimmed.match(/[\p{L}]/gu) ?? []).length;
  if (letterCount / trimmed.length < 0.6) return false;
  return true;
}

/** Heuristic truncation detector — catches "X vs.", "X:", "X -", "X /" etc. */
export function looksTruncated(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (t.length < 12) return true;
  if (/\b(vs|cf|etc|e\.g|i\.e)\.?$/i.test(t)) return true;
  if (/[:\-/–—,;]\s*$/.test(t)) return true;
  if (!/[.!?…]$/.test(t)) {
    // open-ended without terminal punctuation → likely truncated unless very short label
    if (t.split(/\s+/).length > 3) return true;
  }
  const words = t.split(/\s+/);
  const last = words[words.length - 1].replace(/[.!?…,;:]+$/, "").toLowerCase();
  if (DANGLING_WORDS.has(last)) return true;
  return false;
}

export type ConditionalParse = {
  isConditional: boolean;
  condition?: string;
  consequence?: string;
  exception?: string;
};

/** Parse "If/When/To/Se/Quando/Para/Si/Cuando ..., ..." conditionals. */
export function detectConditionalClaim(text: string): ConditionalParse {
  if (!text || text.length < 20) return { isConditional: false };
  const PATTERNS: RegExp[] = [
    /^If\s+(.+?),\s+then\s+(.+?)(?:\.|$)/i,
    /^If\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^When\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^In\s+case\s+of\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^To\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^Se\s+(.+?),\s+então\s+(.+?)(?:\.|$)/i,
    /^Se\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^Quando\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^Para\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^Em\s+caso\s+de\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^Si\s+(.+?),\s+(.+?)(?:\.|$)/i,
    /^Cuando\s+(.+?),\s+(.+?)(?:\.|$)/i,
  ];
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const condition = m[1].trim();
      const consequence = m[2].trim();
      if (condition.length >= 5 && consequence.length >= 5) {
        const exceptMatch = text.match(/\b(?:unless|except|exceto|excepto|salvo)\s+(.+?)(?:\.|$)/i);
        return { isConditional: true, condition, consequence, exception: exceptMatch?.[1]?.trim() };
      }
    }
  }
  return { isConditional: false };
}

const RE_CONDITIONAL = /\b(if|when|unless|otherwise|should|must|use\s+\w+\s+when|do\s+not\s+use|se|quando|deve|use\s+\w+\s+quando)\b/i;
const RE_PROCEDURAL = /\b(step\s*\d|first[\s,].+?(then|next|finally)|pipeline|workflow|process|sequence|procedure|playbook|primeiro[\s,].+?(depois|então|por\s+fim))\b/i;

export function containsConditionalLanguage(text: string): boolean {
  if (!text) return false;
  return RE_CONDITIONAL.test(text);
}

export function containsProceduralLanguage(text: string): boolean {
  if (!text) return false;
  return RE_PROCEDURAL.test(text);
}

/** Jaccard token similarity, letter/number tokens with length > 2. */
export function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  const union = ta.size + tb.size - intersect;
  return union > 0 ? intersect / union : 0;
}

export type DupeCandidate = {
  text?: string;
  statement?: string;
  label?: string;
  guideline?: string;
  name?: string;
  description?: string;
  if?: string;
  then?: string;
  condition?: string;
  decision?: string;
  question?: string;
};

export function isNearDuplicate(
  text: string,
  existing: DupeCandidate[],
  threshold: number = 0.85,
): boolean {
  for (const item of existing) {
    const candidate =
      item.text ?? item.statement ?? item.label ?? item.guideline ??
      item.name ?? item.description ?? item.question ??
      (item.if && item.then ? `${item.if} ${item.then}` : undefined) ??
      (item.condition && item.decision ? `${item.condition} ${item.decision}` : undefined) ??
      "";
    if (candidate && tokenSimilarity(text, candidate) >= threshold) return true;
  }
  return false;
}
