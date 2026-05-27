// v1.2 multi-domain smoke tests — verify preflight + segmentation + numeric
// guards behave correctly across different languages, domains, and formats.
// No domain-specific assertions; just structural invariants.

import { describe, expect, it } from "vitest";
import { profileSource } from "../sourceProfiler";
import { segmentSource, buildSourceManifest } from "../sourceSegmenter";
import { extractNumericFacts } from "../numericGuards";

// 1) EN — JSONL API documentation records
const EN_API_JSONL = [
  `{"_id":"ep_users_create","text":"POST /v1/users creates a user. Rate limit: 100 requests per minute. Returns HTTP 201 on success."}`,
  `{"_id":"ep_users_get","text":"GET /v1/users/{id} retrieves a user. Cache TTL is 60 seconds. See RFC 7231 for caching semantics."}`,
  `{"_id":"ep_billing","text":"POST /v1/billing/charge accepts amounts up to US$ 10,000.00. Idempotency keys are required (ISO 8601 timestamps)."}`,
].join("\n");

// 2) PT-BR — Educational article (prose, no records)
const PT_EDUCATION_PROSE = `
# Fotossíntese e o ciclo do carbono

A fotossíntese é o processo pelo qual plantas convertem dióxido de carbono e água em glicose,
utilizando energia luminosa. A equação geral pode ser representada como 6 CO2 + 6 H2O → C6H12O6 + 6 O2.

Em condições ideais, uma folha pode capturar até 5% da energia solar incidente. O processo ocorre
nos cloroplastos, organelas que contêm clorofila. A descoberta foi consolidada por volta de 1779
quando Jan Ingenhousz publicou seus experimentos.
`.trim();

// 3) EN — SaaS FAQ
const EN_FAQ = [
  `{"_id":"faq_pricing","text":"How much does the Pro plan cost? The Pro plan is US$ 29 per month, billed monthly, or US$ 290 per year (saving 17%)."}`,
  `{"_id":"faq_trial","text":"Is there a free trial? Yes — a 14-day trial with no credit card required. Cancel any time before day 14 to avoid charges."}`,
  `{"_id":"faq_refund","text":"What is your refund policy? Refunds are issued within 30 days of purchase per § 3 of our terms (see ISO 9001 compliance)."}`,
].join("\n");

describe("v1.2 preflight — multi-domain language and format detection", () => {
  it("EN JSONL API doc — detects English + jsonl_records", () => {
    const p = profileSource(EN_API_JSONL);
    expect(p.detectedFormat).toBe("jsonl_records");
    expect(p.detectedLanguage).toBe("en");
    expect(p.recordCount).toBe(3);
    expect(p.blocked).toBe(false);
  });

  it("PT-BR prose — detects pt-BR + non-record format", () => {
    const p = profileSource(PT_EDUCATION_PROSE);
    expect(p.detectedLanguage).toBe("pt-BR");
    expect(p.detectedFormat).not.toBe("jsonl_records");
    expect(p.blocked).toBe(false);
    expect(p.sourceCharCount).toBeGreaterThan(200);
  });

  it("EN FAQ JSONL — detects English + jsonl_records", () => {
    const p = profileSource(EN_FAQ);
    expect(p.detectedFormat).toBe("jsonl_records");
    expect(p.detectedLanguage).toBe("en");
    expect(p.recordCount).toBe(3);
  });
});

describe("v1.2 segmentation — record IDs and manifest", () => {
  it("EN JSONL produces one span per record with stable ids", async () => {
    const profile = profileSource(EN_API_JSONL);
    const spans = await segmentSource(EN_API_JSONL, profile);
    expect(spans.length).toBe(3);
    expect(spans.map((s) => s.sourceRecordId)).toEqual([
      "ep_users_create",
      "ep_users_get",
      "ep_billing",
    ]);
    const manifest = buildSourceManifest(spans);
    expect(manifest).toHaveLength(3);
    for (const m of manifest) {
      expect(m.text_preview.length).toBeLessThanOrEqual(200);
      expect(m.source_record_id).toBeTruthy();
    }
  });

  it("PT-BR prose still segments into at least one span", async () => {
    const profile = profileSource(PT_EDUCATION_PROSE);
    const spans = await segmentSource(PT_EDUCATION_PROSE, profile);
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });
});

describe("v1.2 numericGuards — international currencies, dates, citations", () => {
  it("extracts USD currency, percent, and RFC/ISO citations from EN text", () => {
    const facts = extractNumericFacts(
      "Rate limit is 100 requests per minute. Charge up to US$ 10,000.00 with 17% discount. See RFC 7231 and ISO 8601.",
      "s_en_01",
    );
    const monies = facts.filter((f) => f.kind === "money").map((f) => f.value_text);
    expect(monies.some((m) => m.includes("10,000"))).toBe(true);
    expect(facts.some((f) => f.kind === "percent" && f.value_text.startsWith("17"))).toBe(true);
    expect(facts.some((f) => f.kind === "citation_reference")).toBe(true);
  });

  it("extracts ISO dates and EN durations", () => {
    const facts = extractNumericFacts(
      "Trial lasts 14 days. Effective 2024-05-31. Cache TTL is 60 seconds.",
      "s_en_02",
    );
    expect(facts.some((f) => f.kind === "date" && f.value_text.includes("2024-05-31"))).toBe(true);
    expect(facts.some((f) => f.kind === "duration")).toBe(true);
  });

  it("extracts EUR / GBP currencies", () => {
    const facts = extractNumericFacts(
      "Price is €1.234,56 in Germany or £999.00 in the UK.",
      "s_intl_01",
    );
    const monies = facts.filter((f) => f.kind === "money").map((f) => f.value_text);
    expect(monies.some((m) => m.includes("€"))).toBe(true);
    expect(monies.some((m) => m.includes("£"))).toBe(true);
  });

  it("does not invent domain-specific tags — only generic kinds", () => {
    const facts = extractNumericFacts(
      "The procedure costs US$ 50.00 and references § 12 of the manual.",
      "s_generic",
    );
    const kinds = new Set(facts.map((f) => f.kind));
    // Allowed kinds (domain-agnostic):
    const allowed = new Set(["money", "percent", "date", "duration", "citation_reference", "number"]);
    for (const k of kinds) expect(allowed.has(k)).toBe(true);
  });
});
