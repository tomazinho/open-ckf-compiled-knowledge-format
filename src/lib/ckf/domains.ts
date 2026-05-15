import type { Domain } from "./types";

const KEYWORDS: Record<Exclude<Domain, "general knowledge">, string[]> = {
  "education / learning science": [
    "learn", "learning", "memory", "study", "studying", "education", "student", "teacher",
    "tutor", "course", "lesson", "knowledge", "retrieval practice", "spaced", "cognition",
    "curriculum", "skill", "aprendizado", "aluno", "professor", "estudo", "memória",
  ],
  business: [
    "business", "sales", "customer", "revenue", "market", "marketing", "strategy",
    "company", "startup", "growth", "product", "pricing", "roi", "brand",
    "vendas", "cliente", "receita", "estratégia", "empresa",
  ],
  legal: [
    "law", "legal", "regulation", "court", "contract", "statute", "judge", "compliance",
    "lei", "jurídico", "contrato", "regulação", "tribunal",
  ],
  healthcare: [
    "health", "patient", "clinical", "medicine", "medical", "treatment", "diagnosis",
    "therapy", "doctor", "nurse", "saúde", "paciente", "clínico", "tratamento",
  ],
  software: [
    "software", "code", "api", "function", "class", "module", "library", "framework",
    "deploy", "server", "database", "frontend", "backend", "typescript", "python",
    "javascript", "agent", "llm", "rag", "embedding", "retrieval",
  ],
  science: [
    "experiment", "hypothesis", "research", "theory", "physics", "chemistry", "biology",
    "data", "statistics", "model", "evidence", "study found", "estudo", "pesquisa",
  ],
};

export function detectDomain(text: string): Domain {
  const lower = text.toLowerCase();
  let best: { d: Domain; score: number } = { d: "general knowledge", score: 0 };
  (Object.keys(KEYWORDS) as Array<keyof typeof KEYWORDS>).forEach((domain) => {
    const score = KEYWORDS[domain].reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > best.score) best = { d: domain, score };
  });
  return best.d;
}

export function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  const ptHits = (lower.match(/\b(que|para|com|não|uma|dos|das|por|mais|este|esta|você|também|porque)\b/g) || []).length;
  const enHits = (lower.match(/\b(the|and|with|that|this|from|have|been|because|when|while|should|must)\b/g) || []).length;
  return ptHits > enHits ? "pt" : "en";
}
