import { useEffect, useMemo, useState } from "react";
import { dict, type Lang } from "./i18n/dict";
import { PROVIDERS, callProvider, SchemaTooComplexError, type ProviderId } from "./lib/compiler/providers";
import { chunkSemantically } from "./lib/compiler/chunker";
import { CKF_PARTIAL_SCHEMA, CKF_SYSTEM_PROMPT, CKF_TOOL_DESCRIPTION, CKF_TOOL_NAME, toGeminiSchema } from "./lib/compiler/schema";
import { runCkfPipeline } from "./lib/compiler/pipeline";
import { serializeMarkdown, type Partial as CkfPartial } from "./lib/compiler/reduce";
import { compileHeuristic } from "./lib/compiler/heuristic";

type Mode = "heuristic" | "byok";

function pickLang(): Lang {
  if (typeof navigator !== "undefined" && /^pt/i.test(navigator.language)) return "pt";
  return "en";
}

export default function App() {
  const [lang, setLang] = useState<Lang>(pickLang());
  const t = dict[lang];

  const [mode, setMode] = useState<Mode>("heuristic");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState<string>(PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(true);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | undefined>();
  const [targetLang, setTargetLang] = useState<"auto" | "en" | "pt">("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputJson, setOutputJson] = useState<unknown>(null);
  const [outputMd, setOutputMd] = useState<string>("");

  // Load remembered key
  useEffect(() => {
    const k = localStorage.getItem(`ckf-byok-${provider}`);
    if (k) setApiKey(k);
    else setApiKey("");
    setModel(PROVIDERS[provider].defaultModel);
  }, [provider]);

  const providerConfig = PROVIDERS[provider];

  const canCompile = useMemo(() => {
    if (!text.trim() || text.trim().length < 20) return false;
    if (mode === "byok") return providerConfig.keyRegex.test(apiKey);
    return true;
  }, [text, mode, apiKey, providerConfig]);

  async function onFile(f: File) {
    const buf = await f.text();
    setText(buf);
    setFilename(f.name);
  }

  async function compile() {
    setBusy(true);
    setError(null);
    setOutputJson(null);
    setOutputMd("");
    try {
      if (mode === "heuristic") {
        const pkg = compileHeuristic(text, {
          filename,
          language: targetLang === "auto" ? undefined : targetLang,
        });
        setOutputJson(pkg);
        setOutputMd(serializeMarkdown(pkg as any, { title: filename ?? "Document", provider: "Heuristic", model: "offline" }));
      } else {
        if (remember) localStorage.setItem(`ckf-byok-${provider}`, apiKey);
        const chunks = chunkSemantically(text, { maxChars: 6000 });
        if (chunks.length > 40) throw new Error(`Source too large: ${chunks.length} chunks. Split it before compiling.`);
        const lockLang = targetLang === "auto" ? undefined : targetLang;
        const langDirective = lockLang
          ? `TARGET LANGUAGE: ${lockLang === "pt" ? "pt (Portuguese)" : "en (English)"}.\nEvery generated field MUST be written in ${lockLang === "pt" ? "Portuguese" : "English"}.\nSet metadata.language = "${lockLang}".\nThe ONLY exception is source_excerpts: keep them verbatim.\n\n`
          : "";

        const partials: CkfPartial[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const ch = chunks[i];
          const userMsg = `${langDirective}Span id for this chunk: ${ch.spanId}\nPath: ${ch.path}\nUse source_refs: ["${ch.spanId}"] for items extracted from this chunk.\n\n<<<SOURCE>>>\n${ch.text}\n<<<END SOURCE>>>`;
          try {
            const res = await callProvider(provider, model, apiKey, {
              system: CKF_SYSTEM_PROMPT,
              user: userMsg,
              toolName: CKF_TOOL_NAME,
              toolDescription: CKF_TOOL_DESCRIPTION,
              toolSchema: CKF_PARTIAL_SCHEMA,
            });
            partials.push(res.data as CkfPartial);
          } catch (e) {
            if (e instanceof SchemaTooComplexError) {
              const res = await callProvider(provider, model, apiKey, {
                system: CKF_SYSTEM_PROMPT,
                user: userMsg,
                toolName: CKF_TOOL_NAME,
                toolDescription: CKF_TOOL_DESCRIPTION,
                toolSchema: toGeminiSchema(CKF_PARTIAL_SCHEMA) as Record<string, unknown>,
              });
              partials.push(res.data as CkfPartial);
            } else {
              throw e;
            }
          }
        }
        const pipe = runCkfPipeline(partials, {
          chunks: chunks.map((c) => ({ spanId: c.spanId, path: c.path, text: c.text })),
          filename,
          targetLanguage: lockLang,
        });
        setOutputJson(pipe.pkg);
        setOutputMd(serializeMarkdown(pipe.pkg, { title: filename ?? pipe.pkg.metadata.source_title, provider: providerConfig.label, model }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function download(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>{t.title}</h1>
        <div>
          <button className="btn-secondary btn" onClick={() => setLang(lang === "en" ? "pt" : "en")}>
            {lang === "en" ? "PT" : "EN"}
          </button>
        </div>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{t.subtitle}</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>{t.mode}</label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label><input type="radio" checked={mode === "heuristic"} onChange={() => setMode("heuristic")} /> {t.heuristic}</label>
          <label><input type="radio" checked={mode === "byok"} onChange={() => setMode("byok")} /> {t.byok}</label>
        </div>

        {mode === "byok" && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label>{t.provider}</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
                  {Object.values(PROVIDERS).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label>{t.model}</label>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  {providerConfig.models.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label>{t.apiKey}</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={providerConfig.keyPlaceholder} />
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>{providerConfig.keyHint}</p>
            </div>
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t.rememberKey}
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{t.keyStored}</p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{t.privacy}</p>
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>{t.source}</label>
          <label className="btn btn-secondary" style={{ fontSize: 12 }}>
            {t.uploadFile}
            <input type="file" accept=".txt,.md,.vtt,.srt" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        </div>
        <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.sourcePlaceholder} />
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>{t.language}</label>
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value as "auto" | "en" | "pt")} style={{ width: "auto" }}>
            <option value="auto">{t.autoDetect}</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
          <button className="btn" disabled={!canCompile || busy} onClick={compile} style={{ marginLeft: "auto" }}>
            {busy ? t.compiling : t.compile}
          </button>
        </div>
      </section>

      {error && (
        <section className="card" style={{ borderColor: "#ff5c5c", marginBottom: 16 }}>
          <strong>{t.error}:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{error}</span>
        </section>
      )}

      {outputJson != null && (
        <section className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, flex: 1 }}>{t.output}</h3>
            <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(JSON.stringify(outputJson, null, 2))}>{t.copyJson}</button>
            <button className="btn btn-secondary" onClick={() => download((filename ?? "package") + ".ckf.json", JSON.stringify(outputJson, null, 2), "application/json")}>{t.download}</button>
            <button className="btn btn-secondary" onClick={() => download((filename ?? "package") + ".ckf.md", outputMd, "text/markdown")}>{t.downloadMd}</button>
          </div>
          <pre style={{ maxHeight: 500 }}>{JSON.stringify(outputJson, null, 2)}</pre>
        </section>
      )}

      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
        {t.footer}
      </footer>
    </div>
  );
}
