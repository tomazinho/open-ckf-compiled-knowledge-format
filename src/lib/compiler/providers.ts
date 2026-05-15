// Browser-side provider adapters. All providers below support CORS for direct
// in-browser calls. Anthropic requires the anthropic-dangerous-direct-browser-access
// header. If your network blocks any of these, deploy a tiny CORS proxy and point
// the base URL at it.

import type { ProviderId } from "./providers-manifest";
import { KEY_REGEX, PROVIDER_MANIFEST } from "./providers-manifest";

export type ChatRequest = {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>;
  temperature?: number;
};

export type ChatResult = { data: unknown; tokens_in?: number; tokens_out?: number };

export async function callProvider(
  provider: ProviderId, model: string, apiKey: string, req: ChatRequest,
): Promise<ChatResult> {
  if (provider === "openai") return callOpenAICompat("https://api.openai.com/v1/chat/completions", apiKey, model, req);
  if (provider === "deepseek") return callOpenAICompat("https://api.deepseek.com/v1/chat/completions", apiKey, model, req);
  if (provider === "openrouter") return callOpenAICompat("https://openrouter.ai/api/v1/chat/completions", apiKey, model, req, {
    "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://github.com/", "X-Title": "Open KCP",
  });
  if (provider === "anthropic") return callAnthropic(apiKey, model, req);
  if (provider === "gemini") return callGemini(apiKey, model, req);
  throw new Error(`Unknown provider: ${provider}`);
}

async function callOpenAICompat(url: string, apiKey: string, model: string, req: ChatRequest, extraHeaders: Record<string, string> = {}): Promise<ChatResult> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({
      model, temperature: req.temperature ?? 0.2,
      messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
      tools: [{ type: "function", function: { name: req.toolName, description: req.toolDescription, parameters: req.toolSchema } }],
      tool_choice: { type: "function", function: { name: req.toolName } },
    }),
  });
  if (!resp.ok) await throwGatewayError(resp);
  const json = await resp.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("Provider did not return a structured tool call");
  return { data: JSON.parse(call.function.arguments), tokens_in: json?.usage?.prompt_tokens, tokens_out: json?.usage?.completion_tokens };
}

async function callAnthropic(apiKey: string, model: string, req: ChatRequest): Promise<ChatResult> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model, max_tokens: 4096, temperature: req.temperature ?? 0.2,
      system: req.system, messages: [{ role: "user", content: req.user }],
      tools: [{ name: req.toolName, description: req.toolDescription, input_schema: req.toolSchema }],
      tool_choice: { type: "tool", name: req.toolName },
    }),
  });
  if (!resp.ok) await throwGatewayError(resp);
  const json = await resp.json();
  const block = (json?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!block?.input) throw new Error("Anthropic did not return tool_use block");
  return { data: block.input, tokens_in: json?.usage?.input_tokens, tokens_out: json?.usage?.output_tokens };
}

async function callGemini(apiKey: string, model: string, req: ChatRequest): Promise<ChatResult> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        tools: [{ functionDeclarations: [{ name: req.toolName, description: req.toolDescription, parameters: stripUnsupported(req.toolSchema) }] }],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [req.toolName] } },
        generationConfig: { temperature: req.temperature ?? 0.2 },
      }),
    },
  );
  if (!resp.ok) await throwGatewayError(resp);
  const json = await resp.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall);
  if (!part?.functionCall?.args) throw new Error("Gemini did not return a function call");
  return { data: part.functionCall.args, tokens_in: json?.usageMetadata?.promptTokenCount, tokens_out: json?.usageMetadata?.candidatesTokenCount };
}

function stripUnsupported(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripUnsupported);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === "additionalProperties" || k === "$schema") continue;
      out[k] = stripUnsupported(v);
    }
    return out;
  }
  return schema;
}

async function throwGatewayError(resp: Response): Promise<never> {
  const text = await resp.text().catch(() => "");
  if (resp.status === 401 || resp.status === 403) throw new Error(`Provider rejected the API key (${resp.status}). Check the key and try again.`);
  if (resp.status === 429) throw new Error("Rate limit exceeded by the provider. Try again in a moment.");
  if (resp.status === 402) throw new Error("Provider says credits are exhausted. Top up your account.");
  throw new Error(`Provider error [${resp.status}]: ${text.slice(0, 300)}`);
}

export function validateKeyFormat(provider: ProviderId, key: string): boolean {
  return KEY_REGEX[provider].test(key);
}

export { PROVIDER_MANIFEST };
