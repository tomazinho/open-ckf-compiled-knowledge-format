import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check, Download, KeyRound, Upload, Trash2, ExternalLink, History as HistoryIcon, Plug, Eye, EyeOff } from "lucide-react";
import { Shell } from "@/components/Shell";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PROVIDER_MANIFEST, PROVIDER_IDS, loadByokKeys, saveByokKey, clearByokKey, type ProviderId } from "@/lib/compiler/providers-manifest";
import { compileToCkf, pingByokKey, type CompileResult } from "@/lib/compiler/compile-client";
import { readFileAsText } from "@/lib/ckf/fileReader";
import { listJobs, saveJob, deleteJob, exportJobs, importJobs, clearJobs, type StoredJob } from "@/lib/history/local-jobs";
import { toast } from "sonner";

export const Route = createFileRoute("/compiler")({
  head: () => ({
    meta: [
      { title: "Open CKF — Pro Compiler (BYOK, client-side)" },
      { name: "description", content: "Industrial-strength KCP compiler. BYOK for OpenAI, Anthropic, Gemini, DeepSeek or OpenRouter. Runs entirely in your browser." },
    ],
  }),
  component: ProPage,
});

type Stage = { label: string; pct: number };

function ProPage() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | undefined>();
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState(PROVIDER_MANIFEST.openai.defaultModel);
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [persistKey, setPersistKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setKeys(loadByokKeys()); setJobs(listJobs()); }, []);
  useEffect(() => { setModel(PROVIDER_MANIFEST[provider].defaultModel); }, [provider]);

  const manifest = PROVIDER_MANIFEST[provider];
  const apiKey = keys[provider] ?? "";

  function setKey(value: string) {
    setKeys((prev) => ({ ...prev, [provider]: value }));
  }
  function persistCurrentKey() {
    if (!apiKey) return;
    saveByokKey(provider, apiKey, persistKey);
    toast.success(persistKey ? "Key saved (this browser)" : "Key kept for this session");
  }
  function forgetCurrentKey() {
    clearByokKey(provider);
    setKeys((prev) => { const n = { ...prev }; delete n[provider]; return n; });
    toast.success("Key cleared");
  }

  async function onPing() {
    if (!apiKey) return toast.error("Enter an API key first.");
    try { await pingByokKey(provider, model, apiKey); toast.success("Provider OK"); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function onUpload(f: File) {
    setFilename(f.name);
    try {
      const txt = await readFileAsText(f, (p) => setStage({ label: p.message, pct: p.percent ?? 0 }));
      setText(txt);
      setStage(null);
      toast.success(`Loaded ${f.name}`);
    } catch (e) {
      setStage(null);
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function onCompile() {
    if (!text.trim()) return toast.error("Paste or upload some text first.");
    if (!apiKey) return toast.error(`Enter your ${manifest.label} API key.`);
    setRunning(true); setResult(null);
    try {
      const r = await compileToCkf(
        { text, filename, provider, model, byokKey: apiKey },
        (e) => {
          if (e.stage === "chunked") setStage({ label: `Split into ${e.chunks} chunk(s)`, pct: 5 });
          else if (e.stage === "chunk-start") setStage({ label: `Chunk ${e.index + 1}/${e.total} · ${e.path}`, pct: 5 + Math.round(((e.index) / e.total) * 80) });
          else if (e.stage === "chunk-done") setStage({ label: `Chunk ${e.index + 1}/${e.total} done`, pct: 5 + Math.round(((e.index + 1) / e.total) * 80) });
          else if (e.stage === "chunk-error") setStage({ label: `Chunk ${e.index + 1}/${e.total} failed`, pct: 5 + Math.round(((e.index + 1) / e.total) * 80) });
          else if (e.stage === "reducing") setStage({ label: "Reducing…", pct: 92 });
        },
      );
      setResult(r);
      saveJob(r); setJobs(listJobs());
      setStage(null);
      toast.success(`Done in ${(r.metrics.durationMs / 1000).toFixed(1)}s`);
    } catch (e) {
      setStage(null);
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setRunning(false); }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result.pkgMd);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  function download() {
    if (!result) return;
    const blob = new Blob([result.pkgMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(filename ?? "kcp-package").replace(/\.[^.]+$/, "")}.kcp.md`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportAll() {
    const blob = new Blob([exportJobs()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `openckf-jobs-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t.history.exported.replace("{n}", String(jobs.length)));
  }
  async function onImport(f: File) {
    try {
      const text = await f.text();
      const { added } = importJobs(text);
      setJobs(listJobs());
      toast.success(t.history.imported.replace("{n}", String(added)));
    } catch (e) { toast.error(String(e)); }
  }

  const renderedMd = useMemo(() => result?.pkgMd ?? "", [result]);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t.compiler.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.compiler.subtitle}</p>

        <section className="mt-6 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="font-medium">Provider · BYOK</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_IDS.map((id) => <SelectItem key={id} value={id}>{PROVIDER_MANIFEST[id].label}</SelectItem>)}
                </SelectContent>
              </Select>
              {manifest.corsNote && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">⚠ {manifest.corsNote}</p>}
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {manifest.models.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={manifest.keyPlaceholder}
                  className="pr-9 font-mono text-sm"
                />
                <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={onPing}><Plug className="mr-2 h-3.5 w-3.5" />Ping</Button>
              <Button variant="outline" onClick={persistCurrentKey}>Save</Button>
              <Button variant="ghost" onClick={forgetCurrentKey}>Forget</Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{manifest.keyHint} · <a href={manifest.signupUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">Get a key <ExternalLink className="inline h-3 w-3" /></a></span>
              <label className="flex items-center gap-2">
                <Switch checked={persistKey} onCheckedChange={setPersistKey} />
                Remember in this browser (localStorage)
              </label>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border/60 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">{t.compiler.inputTitle}</h2>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-3.5 w-3.5" />{t.compiler.upload}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setText(""); setFilename(undefined); setResult(null); }}><Trash2 className="mr-2 h-3.5 w-3.5" />{t.compiler.clear}</Button>
              </div>
            </div>
            {filename && <p className="mb-2 text-xs text-muted-foreground">📎 {filename}</p>}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.compiler.pastePlaceholder} className="min-h-[320px] font-mono text-sm" />
            <p className="mt-2 text-[11px] text-muted-foreground">{text.length.toLocaleString()} chars</p>
            <Button className="mt-4 w-full" onClick={onCompile} disabled={running || !text.trim() || !apiKey}>
              {running ? t.compiler.compiling : t.compiler.compile}
            </Button>
            {stage && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div className="h-full bg-gradient-to-r from-violet to-blue transition-all" style={{ width: `${Math.min(100, stage.pct)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{stage.label}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">{t.compiler.outputTitle}</h2>
              {result && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copy}>
                    {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                    {copied ? t.compiler.copied : t.compiler.copy}
                  </Button>
                  <Button size="sm" variant="outline" onClick={download}><Download className="mr-2 h-3.5 w-3.5" />{t.compiler.download}</Button>
                </div>
              )}
            </div>

            {!result ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">{t.compiler.empty}</p>
            ) : (
              <Tabs defaultValue="md">
                <TabsList>
                  <TabsTrigger value="md">Markdown</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="report">{t.compiler.reportTitle}</TabsTrigger>
                </TabsList>
                <TabsContent value="md">
                  <pre className="max-h-[520px] overflow-auto rounded-lg bg-[var(--code-bg)] p-4 text-xs leading-relaxed text-[var(--code-fg)]">{renderedMd}</pre>
                </TabsContent>
                <TabsContent value="json">
                  <pre className="max-h-[520px] overflow-auto rounded-lg bg-[var(--code-bg)] p-4 text-xs leading-relaxed text-[var(--code-fg)]">{JSON.stringify(result.pkg, null, 2)}</pre>
                </TabsContent>
                <TabsContent value="report">
                  <ProReport result={result} />
                </TabsContent>
              </Tabs>
            )}
          </section>
        </div>

        <section className="mt-8 rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-medium"><HistoryIcon className="h-4 w-4" />{t.history.title}</h2>
            <div className="flex gap-2">
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
              <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>{t.history.import}</Button>
              <Button size="sm" variant="outline" onClick={exportAll} disabled={jobs.length === 0}>{t.history.export}</Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(t.history.confirmClear)) { clearJobs(); setJobs([]); } }} disabled={jobs.length === 0}>{t.history.clear}</Button>
            </div>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.history.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{j.filename ?? j.id}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(j.createdAt).toLocaleString()} · {j.provider}/{j.model} · {j.metrics.chunks} chunk(s) · {(j.metrics.durationMs / 1000).toFixed(1)}s</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setResult({
                        jobId: j.id, pkg: j.pkg, pkgMd: j.pkgMd, warnings: j.warnings,
                        metrics: j.metrics, provider: j.provider as ProviderId, model: j.model,
                        sourceSha256: j.sourceSha256, sourceChars: j.sourceChars, filename: j.filename,
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}>{t.history.open}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { deleteJob(j.id); setJobs(listJobs()); }}>{t.history.delete}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

function ProReport({ result }: { result: CompileResult }) {
  const { t } = useI18n();
  const stats: [string, string | number][] = [
    ["Chunks", result.metrics.chunks],
    ["Failed", result.metrics.failedChunks],
    ["Tokens in", result.metrics.tokensIn.toLocaleString()],
    ["Tokens out", result.metrics.tokensOut.toLocaleString()],
    ["Duration", `${(result.metrics.durationMs / 1000).toFixed(1)}s`],
    [t.compiler.entities, result.pkg.entities.length],
    [t.compiler.concepts, result.pkg.concepts.length],
    ["Decision rules", result.pkg.decision_rules.length],
    [t.compiler.atomic, result.pkg.atomic_units.length],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 font-display text-base font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="mb-1 font-medium text-amber-600 dark:text-amber-400">{t.compiler.warnings}</p>
          <ul className="space-y-1 text-muted-foreground">{result.warnings.map((w, i) => <li key={i}>· {w}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
