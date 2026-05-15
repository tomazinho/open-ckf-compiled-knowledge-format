// Client-safe BYOK provider manifest. No "Lovable AI" mode.
export type ProviderId = "openai" | "anthropic" | "gemini" | "deepseek" | "openrouter";

export const PROVIDER_MANIFEST: Record<ProviderId, {
  id: ProviderId;
  label: string;
  defaultModel: string;
  models: { value: string; label: string }[];
  keyPlaceholder: string;
  keyHint: string;
  signupUrl: string;
  corsNote?: string;
}> = {
  openai: {
    id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini",
    models: [
      { value: "gpt-4o-mini", label: "gpt-4o-mini (fast, cheap)" },
      { value: "gpt-4o", label: "gpt-4o (balanced)" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { value: "gpt-4.1", label: "gpt-4.1 (deep)" },
    ],
    keyPlaceholder: "sk-...", keyHint: "OpenAI API key.",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (fast)" },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4 (deep)" },
    ],
    keyPlaceholder: "sk-ant-...", keyHint: "Anthropic API key. Browser calls require the anthropic-dangerous-direct-browser-access header (sent automatically).",
    signupUrl: "https://console.anthropic.com/settings/keys",
    corsNote: "Anthropic supports browser calls when the dangerous-direct-browser-access header is sent.",
  },
  gemini: {
    id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    keyPlaceholder: "AIza...", keyHint: "Google AI Studio API key (free tier available).",
    signupUrl: "https://aistudio.google.com/app/apikey",
  },
  deepseek: {
    id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek Chat" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
    keyPlaceholder: "sk-...", keyHint: "DeepSeek API key.",
    signupUrl: "https://platform.deepseek.com/api_keys",
  },
  openrouter: {
    id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o-mini",
    models: [
      { value: "openai/gpt-4o-mini", label: "OpenAI · gpt-4o-mini" },
      { value: "anthropic/claude-3.5-sonnet", label: "Anthropic · Claude 3.5 Sonnet" },
      { value: "google/gemini-2.0-flash-001", label: "Google · Gemini 2.0 Flash" },
      { value: "meta-llama/llama-3.3-70b-instruct", label: "Meta · Llama 3.3 70B" },
      { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    ],
    keyPlaceholder: "sk-or-...", keyHint: "OpenRouter API key — access many models via one key.",
    signupUrl: "https://openrouter.ai/keys",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_MANIFEST) as ProviderId[];

export const KEY_REGEX: Record<ProviderId, RegExp> = {
  openai: /^sk-[A-Za-z0-9_\-]{20,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_\-]{20,}$/,
  gemini: /^[A-Za-z0-9_\-]{30,}$/,
  deepseek: /^sk-[A-Za-z0-9]{20,}$/,
  openrouter: /^sk-or-[A-Za-z0-9_\-]{20,}$/,
};

const STORAGE_KEY = "openckf.byok.v1";
type Store = { session: Partial<Record<ProviderId, string>>; persistent: Partial<Record<ProviderId, string>> };

function readStore(persistent: boolean): Partial<Record<ProviderId, string>> {
  if (typeof window === "undefined") return {};
  const storage = persistent ? window.localStorage : window.sessionStorage;
  try { const raw = storage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function writeStore(persistent: boolean, val: Partial<Record<ProviderId, string>>) {
  if (typeof window === "undefined") return;
  const storage = persistent ? window.localStorage : window.sessionStorage;
  storage.setItem(STORAGE_KEY, JSON.stringify(val));
}

export function loadByokKeys(): Partial<Record<ProviderId, string>> {
  // Persistent overrides session, since "remember" is an explicit user choice.
  return { ...readStore(false), ...readStore(true) };
}

export function saveByokKey(provider: ProviderId, key: string, persistent = false) {
  const store = readStore(persistent);
  store[provider] = key;
  writeStore(persistent, store);
  // Also remove from the other store to avoid stale duplicates.
  const other = readStore(!persistent);
  if (other[provider]) { delete other[provider]; writeStore(!persistent, other); }
}

export function clearByokKey(provider: ProviderId) {
  for (const persistent of [false, true]) {
    const s = readStore(persistent);
    if (s[provider]) { delete s[provider]; writeStore(persistent, s); }
  }
}
