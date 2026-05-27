// Standalone provider adapters for the open-source CKF Compiler.
// All calls go directly from the browser to provider APIs using a BYOK key
// stored in localStorage. No server, no proxy.
//
// CORS notes:
//   - OpenAI: enabled by default
//   - Anthropic: requires header `anthropic-dangerous-direct-browser-access: true`
//   - Google Gemini: enabled by default
//   - OpenRouter / DeepSeek: enabled by default

import { toGeminiSchema } from "./schema";

export class SchemaTooComplexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaTooComplexError";
  }
}

export type ProviderId = "openai" | "anthropic" | "gemini" | "deepseek" | "openrouter";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  defaultModel: string;
  models: { value: string; label: string }[];
  keyPlaceholder: string;
  keyHint: string;
  keyRegex: RegExp;
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5-mini",
    models: [
      { value: "gpt-5", label: "GPT-5" },
      { value: "gpt-5-mini", label: "GPT-5 mini" },
      { value: "gpt-5-nano", label: "GPT-5 nano" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
    keyPlaceholder: "sk-...",
    keyHint: "OpenAI API key — platform.openai.com/api-keys",
    keyRegex: /^sk-[A-Za-z0-9_\-]{20,}$/,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    models: [
      { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
      { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
    keyPlaceholder: "sk-ant-...",
    keyHint: "Anthropic API key — console.anthropic.com",
    keyRegex: /^sk-ant-[A-Za-z0-9_\-]{20,}$/,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
    keyPlaceholder: "AIza...",
    keyHint: "Google AI Studio key (free tier) — aistudio.google.com/apikey",
    keyRegex: /^[A-Za-z0-9_\-]{30,}$/,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek Chat" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
    keyPlaceholder: "sk-...",
    keyHint: "DeepSeek API key — platform.deepseek.com",
    keyRegex: /^sk-[A-Za-z0-9]{20,}$/,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemini-2.5-flash",
    models: [
      { value: "openai/gpt-5", label: "OpenAI GPT-5 (via OpenRouter)" },
      { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 (via OpenRouter)" },
      { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (via OpenRouter)" },
      { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (via OpenRouter)" },
    ],
    keyPlaceholder: "sk-or-...",
    keyHint: "OpenRouter key — openrouter.ai/keys (one key, all models)",
    keyRegex: /^sk-or-[A-Za-z0-9_\-]{20,}$/,
  },
};

export type ChatRequest = {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>;
  temperature?: number;
};

export type ChatResult = {
  data: unknown;
  tokens_in?: number;
  tokens_out?: number;
};

function isGpt5(model: string) {
  return /^(openai\/)?gpt-5(?!-(mini|nano))/i.test(model);
}

function temperatureForModel(model: string, requested: number): number | undefined {
  if (isGpt5(model)) return undefined;
  return requested;
}

export async function callProvider(
  provider: ProviderId,
  model: string,
  apiKey: string,
  req: ChatRequest,
  opts: { timeoutMs?: number } = {},
): Promise<ChatResult> {
  const ctrl = new AbortController();
  const isHeavy = /pro|opus|reasoning|deep-research|gpt-5(?!-(mini|nano))/i.test(model);
  const timeoutMs = opts.timeoutMs ?? (isHeavy ? 180_000 : 90_000);
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (provider === "openai")
      return await callOpenAICompat("https://api.openai.com/v1/chat/completions", apiKey, model, req, {}, ctrl.signal);
    if (provider === "deepseek")
      return await callOpenAICompat("https://api.deepseek.com/v1/chat/completions", apiKey, model, req, {}, ctrl.signal);
    if (provider === "openrouter")
      return await callOpenAICompat(
        "https://openrouter.ai/api/v1/chat/completions",
        apiKey,
        model,
        req,
        { "HTTP-Referer": "https://compiledknowledgeformat.org", "X-Title": "Open CKF Compiler" },
        ctrl.signal,
      );
    if (provider === "anthropic") return await callAnthropic(apiKey, model, req, ctrl.signal);
    if (provider === "gemini") return await callGemini(apiKey, model, req, ctrl.signal);
    throw new Error(`Unknown provider: ${provider}`);
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new Error(`Provider call timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  req: ChatRequest,
  extraHeaders: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<ChatResult> {
  const tempValue = temperatureForModel(model, req.temperature ?? 0.2);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    tools: [{ type: "function", function: { name: req.toolName, description: req.toolDescription, parameters: req.toolSchema } }],
    tool_choice: { type: "function", function: { name: req.toolName } },
  };
  if (typeof tempValue === "number") body.temperature = tempValue;
  const resp = await fetch(url, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!resp.ok) await throwGatewayError(resp);
  const json = await resp.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("Provider did not return a structured tool call");
  return {
    data: JSON.parse(call.function.arguments),
    tokens_in: json?.usage?.prompt_tokens,
    tokens_out: json?.usage?.completion_tokens,
  };
}

async function callAnthropic(apiKey: string, model: string, req: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: req.temperature ?? 0.2,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
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

async function callGemini(apiKey: string, model: string, req: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        tools: [{ functionDeclarations: [{ name: req.toolName, description: req.toolDescription, parameters: toGeminiSchema(req.toolSchema) }] }],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [req.toolName] } },
        generationConfig: { temperature: req.temperature ?? 0.2 },
      }),
    },
  );
  if (!resp.ok) await throwGatewayError(resp);
  const json = await resp.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall);
  if (!part?.functionCall?.args) throw new Error("Gemini did not return a function call");
  return {
    data: part.functionCall.args,
    tokens_in: json?.usageMetadata?.promptTokenCount,
    tokens_out: json?.usageMetadata?.candidatesTokenCount,
  };
}

async function throwGatewayError(resp: Response): Promise<never> {
  const text = await resp.text().catch(() => "");
  if (resp.status === 401 || resp.status === 403)
    throw new Error(`Provider rejected the API key (${resp.status}). Check the key and try again.`);
  if (resp.status === 429) throw new Error("Rate limit exceeded by the provider. Try again in a moment.");
  if (resp.status === 402) throw new Error("Provider says credits are exhausted. Top up your account.");
  if (
    resp.status === 400 &&
    /too many states for serving|states for serving|schema with lots of|property is not defined|unknown name|invalid (json )?schema/i.test(text)
  ) {
    throw new SchemaTooComplexError(`Provider rejected tool schema: ${text.slice(0, 200)}`);
  }
  throw new Error(`Provider error [${resp.status}]: ${text.slice(0, 300)}`);
}
