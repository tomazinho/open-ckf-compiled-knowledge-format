// v1.2 smoke tests for the new compiler modules.

import { describe, expect, it } from "vitest";
import { profileSource } from "../sourceProfiler";
import { segmentSource, buildSourceManifest } from "../sourceSegmenter";
import { extractNumericFacts } from "../numericGuards";

const IRPF_JSONL = [
  `{"_id":"RESPOSTA_001","text":"Está obrigada a apresentar a DAA 2024 a pessoa física residente no Brasil que recebeu rendimentos tributáveis superiores a R$ 30.639,90 em 2023."}`,
  `{"_id":"RESPOSTA_002","text":"O prazo de entrega vai de 15 de março a 31/05/2024. Fica vedada a entrega após esse prazo sem multa."}`,
  `{"_id":"RESPOSTA_003","text":"O limite de isenção é R$ 200.000,00. Salvo se houver ganho de capital, o contribuinte está dispensado."}`,
].join("\n");

describe("v1.2 sourceProfiler", () => {
  it("detecta JSONL pt-BR e bloqueia hash-only", () => {
    const p = profileSource(IRPF_JSONL);
    expect(p.detectedFormat).toBe("jsonl_records");
    expect(p.detectedLanguage).toBe("pt-BR");
    expect(p.recordCount).toBe(3);
    expect(p.blocked).toBe(false);

    const bad = profileSource("633f797f8ff95dd03e53f60e12cf04730a56c74e3c138bd58d199df3d0a622b6.txt");
    expect(bad.blocked).toBe(true);
  });
});

describe("v1.2 sourceSegmenter", () => {
  it("emite um span por registro JSONL com source_record_id", async () => {
    const profile = profileSource(IRPF_JSONL);
    const spans = await segmentSource(IRPF_JSONL, profile);
    expect(spans.length).toBe(3);
    expect(spans[0].sourceRecordId).toBe("RESPOSTA_001");
    expect(spans[1].sourceRecordId).toBe("RESPOSTA_002");
    expect(spans[2].sourceRecordId).toBe("RESPOSTA_003");
    const manifest = buildSourceManifest(spans);
    expect(manifest[0].source_record_id).toBe("RESPOSTA_001");
    expect(manifest[0].text_preview.length).toBeLessThanOrEqual(200);
  });
});

describe("v1.2 numericGuards", () => {
  it("extrai R$ 200.000,00 e datas BR sem truncar", () => {
    const facts = extractNumericFacts(
      "limite de R$ 200.000,00 e prazo até 31/05/2024 com 20% de multa, Lei nº 14.754",
      "s_001",
    );
    const monies = facts.filter((f) => f.kind === "money").map((f) => f.value_text);
    expect(monies).toContain("R$ 200.000,00");
    expect(monies).not.toContain("R$ 200");
    expect(facts.some((f) => f.kind === "date" && f.value_text === "31/05/2024")).toBe(true);
    expect(facts.some((f) => f.kind === "percent" && f.value_text.startsWith("20"))).toBe(true);
    expect(facts.some((f) => f.kind === "citation_reference")).toBe(true);
  });
});
