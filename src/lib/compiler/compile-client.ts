// Pure client-side compile-to-KCP pipeline (Pro). Replaces the original
// server function. Same shape, same outputs — but runs entirely in the browser
// with the user's BYOK key.

import type { ProviderId } from "./providers-manifest";
import { PROVIDER_MANIFEST } from "./providers-manifest";
import { callProvider, validateKeyFormat } from "./providers";
import { chunkSemantically, sha256 } from "./chunker";
import { CKF_PARTIAL_SCHEMA, CKF_SYSTEM_PROMPT, CKF_TOOL_DESCRIPTION, CKF_TOOL_NAME } from "./schema";
import { reduce, serializeMarkdown, type Partial as CkfPartial, type MergedPackage } from "./reduce";

export type CompileInput = {
  text: string;
  filename?: string;
  provider: ProviderId;
  model: string;
  byokKey: string;
};

export type CompileMetrics = {
  chunks: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  failedChunks: number;
};

export type CompileResult = {
  jobId: string;
  pkg: MergedPackage;
  pkgMd: string;
  warnings: string[];
  metrics: CompileMetrics;
  provider: ProviderId;
  model: string;
  sourceSha256: string;
  sourceChars: number;
  filename?: string;
};

export type CompileProgress = (e:
  | { stage: "chunked"; chunks: number }
  | { stage: "chunk-start"; index: number; total: number; path: string }
  | { stage: "chunk-done"; index: number; total: number; tokens?: { in?: number; out?: number } }
  | { stage: "chunk-error"; index: number; total: number; error: string }
  | { stage: "reducing" }
) => void;

export async function pingByokKey(provider: ProviderId, model: string, byokKey: string): Promise<void> {
  if (!validateKeyFormat(provider, byokKey)) throw new Error("Key format does not match this provider.");
  await callProvider(provider, model, byokKey, {
    system: "Reply via the function call.",
    user: "Echo the word ok.",
    toolName: "echo",
    toolDescription: "Echo a single word.",
    toolSchema: { type: "object", properties: { word: { type: "string" } }, required: ["word"] },
  });
}

export async function compileToCkf(input: CompileInput, onProgress?: CompileProgress): Promise<CompileResult> {
  if (!input.byokKey) throw new Error(`A ${PROVIDER_MANIFEST[input.provider].label} API key is required.`);
  if (!validateKeyFormat(input.provider, input.byokKey)) throw new Error("API key format does not match this provider.");

  const startedAt = Date.now();
  const jobId = `job_${startedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const hash = await sha256(input.text);

  const chunks = chunkSemantically(input.text);
  if (chunks.length === 0) throw new Error("Source text is empty after preprocessing.");
  if (chunks.length > 80) throw new Error(`Source too large: ${chunks.length} chunks. Split it before compiling (max ~960k chars).`);
  onProgress?.({ stage: "chunked", chunks: chunks.length });

  const partials: CkfPartial[] = [];
  const warnings: string[] = [];
  let tokensIn = 0, tokensOut = 0, failed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    onProgress?.({ stage: "chunk-start", index: i, total: chunks.length, path: ch.path });
    try {
      const r = await callProvider(input.provider, input.model, input.byokKey, {
        system: CKF_SYSTEM_PROMPT,
        user: `Path: ${ch.path}\n\n<<<SOURCE>>>\n${ch.text}\n<<<END SOURCE>>>`,
        toolName: CKF_TOOL_NAME,
        toolDescription: CKF_TOOL_DESCRIPTION,
        toolSchema: CKF_PARTIAL_SCHEMA,
      });
      partials.push(r.data as CkfPartial);
      tokensIn += r.tokens_in ?? 0;
      tokensOut += r.tokens_out ?? 0;
      onProgress?.({ stage: "chunk-done", index: i, total: chunks.length, tokens: { in: r.tokens_in, out: r.tokens_out } });
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Chunk ${i + 1}/${chunks.length} (${ch.path}) failed: ${msg}`);
      onProgress?.({ stage: "chunk-error", index: i, total: chunks.length, error: msg });
    }
  }

  if (partials.length === 0) throw new Error("All chunks failed. Check API key and provider quota.");

  onProgress?.({ stage: "reducing" });
  const merged = reduce(partials);
  const md = serializeMarkdown(merged, {
    title: input.filename ?? "Knowledge Package",
    provider: PROVIDER_MANIFEST[input.provider].label,
    model: input.model,
  });

  return {
    jobId, pkg: merged, pkgMd: md, warnings,
    metrics: { chunks: chunks.length, tokensIn, tokensOut, durationMs: Date.now() - startedAt, failedChunks: failed },
    provider: input.provider, model: input.model,
    sourceSha256: hash, sourceChars: input.text.length, filename: input.filename,
  };
}
