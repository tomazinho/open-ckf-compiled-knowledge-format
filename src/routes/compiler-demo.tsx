import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Copy, Check, Upload, Trash2, Sparkles, FileInput, Cpu, Package, Bot, ArrowRight } from "lucide-react";
import { Shell } from "@/components/Shell";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { compileKcp } from "@/lib/kcp/compile";
import { toJson, toMarkdown, toYaml } from "@/lib/kcp/serialize";
import type { CompileOptions, OutputFormat } from "@/lib/kcp/types";
import { LEARNING_EXAMPLE, BUSINESS_EXAMPLE } from "@/lib/kcp/examples";
import { readFileAsText } from "@/lib/kcp/fileReader";
import { toast } from "sonner";

export const Route = createFileRoute("/compiler-demo")({
  head: () => ({
    meta: [
      { title: "Open KCP — Demo Compiler (no key required)" },
      { name: "description", content: "Heuristic, deterministic, in-browser KCP compiler. Paste text and see a structured .kcp package." },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { t, lang } = useI18n();
  const isPt = lang === "pt-BR";
  const [text, setText] = useState("");
  const [sourceType, setSourceType] = useState(t.compiler.sourceTypes[0]);
  const [compression, setCompression] = useState<CompileOptions["compressionLevel"]>("standard");
  const [output, setOutput] = useState<OutputFormat>("markdown");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof compileKcp> | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const serialized = useMemo(() => {
    if (!result) return "";
    if (output === "json") return toJson(result.pkg);
    if (output === "yaml") return toYaml(result.pkg);
    return toMarkdown(result.pkg);
  }, [result, output]);

  async function onCompile() {
    if (!text.trim()) return toast.error(t.compiler.empty);
    setRunning(true);
    try {
      const r = compileKcp(text, { sourceType, compressionLevel: compression, outputFormat: output });
      setResult(r);
      toast.success(t.compiler.success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function onUpload(f: File) {
    try { setText(await readFileAsText(f)); } catch (e) { toast.error(String(e)); }
  }

  function copy() {
    navigator.clipboard.writeText(serialized);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  function download() {
    const ext = output === "markdown" ? "md" : output;
    const blob = new Blob([serialized], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kcp-package.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-start gap-3">
          <Sparkles className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{t.compiler.title} · Demo</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.compiler.subtitle}</p>
            <p className="mt-1 text-xs text-muted-foreground/80">{t.compiler.disclaimer}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border/60 bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">{t.compiler.inputTitle}</h2>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-3.5 w-3.5" />{t.compiler.upload}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); }}><Trash2 className="mr-2 h-3.5 w-3.5" />{t.compiler.clear}</Button>
              </div>
            </div>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.compiler.pastePlaceholder} className="min-h-[280px] font-mono text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setText(LEARNING_EXAMPLE)}>{t.compiler.loadLearning}</Button>
              <Button size="sm" variant="secondary" onClick={() => setText(BUSINESS_EXAMPLE)}>{t.compiler.loadBusiness}</Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">{t.compiler.sourceType}</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {t.compiler.sourceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t.compiler.compression}</Label>
                <Select value={compression} onValueChange={(v) => setCompression(v as CompileOptions["compressionLevel"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {t.compiler.compressionLevels.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t.compiler.output}</Label>
                <Select value={output} onValueChange={(v) => setOutput(v as OutputFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="yaml">YAML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="mt-5 w-full" onClick={onCompile} disabled={running}>
              {running ? t.compiler.compiling : t.compiler.compile}
            </Button>
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
              <Tabs defaultValue="output">
                <TabsList>
                  <TabsTrigger value="output">{t.compiler.outputTitle}</TabsTrigger>
                  <TabsTrigger value="report">{t.compiler.reportTitle}</TabsTrigger>
                </TabsList>
                <TabsContent value="output">
                  <pre className="max-h-[520px] overflow-auto rounded-lg bg-[var(--code-bg)] p-4 text-xs leading-relaxed text-[var(--code-fg)]">{serialized}</pre>
                </TabsContent>
                <TabsContent value="report">
                  <Report pkg={result.pkg} warnings={result.warnings} />
                </TabsContent>
              </Tabs>
            )}
          </section>
        </div>

        {/* HOW IT WORKS */}
        <section className="mt-10 rounded-xl border border-border/60 bg-card p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-primary" />
            {isPt ? "COMO FUNCIONA" : "HOW IT WORKS"}
          </div>
          <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {isPt ? "Do arquivo humano ao agente de IA, em 4 passos" : "From human file to AI agent, in 4 steps"}
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isPt
              ? "O KCP traduz documentos pensados para humanos em conhecimento estruturado que agentes conseguem raciocinar, sem alucinar e com rastreabilidade."
              : "KCP translates human-oriented documents into structured knowledge that agents can reason over — without hallucinating and with full traceability."}
          </p>

          <div className="mt-6 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            <Step icon={<FileInput className="size-5" />} n="01"
              title={isPt ? "Arquivo humano" : "Human file"}
              desc={isPt ? "PDF, DOCX, MD, TXT, transcrições — qualquer texto que humanos leem." : "PDF, DOCX, MD, TXT, transcripts — anything humans read."} />
            <Arrow />
            <Step icon={<Cpu className="size-5" />} n="02"
              title={isPt ? "Compilador KCP" : "KCP Compiler"}
              desc={isPt ? "Extrai entidades, conceitos, regras, princípios e procedimentos em 23 seções padronizadas." : "Extracts entities, concepts, rules, principles and procedures into 23 canonical sections."}
              highlight />
            <Arrow />
            <Step icon={<Package className="size-5" />} n="03"
              title={isPt ? "Pacote .kcp" : ".kcp Package"}
              desc={isPt ? "Markdown / JSON / YAML — portátil, versionável, auditável e rastreável até a fonte." : "Markdown / JSON / YAML — portable, versionable, auditable, traceable to source."} />
            <Arrow />
            <Step icon={<Bot className="size-5" />} n="04"
              title={isPt ? "Agentes de IA" : "AI Agents"}
              desc={isPt ? "LLMs, RAG e agentes consomem conhecimento pré-compilado — menos tokens, menos alucinação, mais precisão." : "LLMs, RAG and agents consume pre-compiled knowledge — fewer tokens, less hallucination, higher precision."} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/viewer">{isPt ? "Abrir Viewer" : "Open Viewer"}</Link>
            </Button>
          </div>
        </section>

        <p className="mt-6 max-w-3xl text-xs italic text-muted-foreground">{t.compiler.disclaimer}</p>
      </div>
    </Shell>
  );
}

function Step({ icon, n, title, desc, highlight }: { icon: React.ReactNode; n: string; title: string; desc: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${highlight ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div className={`grid size-9 place-items-center rounded-md ${highlight ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {icon}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{n}</span>
      </div>
      <div className="font-display text-sm font-semibold">{title}</div>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden place-items-center text-muted-foreground md:grid">
      <ArrowRight className="size-4" />
    </div>
  );
}

function Report({ pkg, warnings }: { pkg: ReturnType<typeof compileKcp>["pkg"]; warnings: string[] }) {
  const { t } = useI18n();
  const stats: [string, string | number][] = [
    [t.compiler.detectedDomain, pkg.metadata.domain],
    [t.compiler.entities, pkg.entities.length],
    [t.compiler.concepts, pkg.concepts.length],
    [t.compiler.chunks, pkg.retrieval_chunks.length],
    [t.compiler.atomic, pkg.atomic_units.length],
    [t.compiler.utility, pkg.metadata.ai_utility_score.toFixed(2)],
    [t.compiler.traceability, pkg.source_traceability.length ? t.compiler.enabled : t.compiler.none],
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
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="mb-1 font-medium text-amber-600 dark:text-amber-400">{t.compiler.warnings}</p>
          <ul className="space-y-1 text-muted-foreground">{warnings.map((w, i) => <li key={i}>· {w}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
