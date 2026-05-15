import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { FileSearch, Upload, X, Link as LinkIcon } from "lucide-react";
import { Shell } from "@/components/Shell";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCkf } from "@/lib/ckf/parse";
import type { CkfPackage } from "@/lib/ckf/types";
import { readFileAsText } from "@/lib/ckf/fileReader";
import { toast } from "sonner";

export const Route = createFileRoute("/viewer")({
  head: () => ({
    meta: [
      { title: "Open CKF — Viewer" },
      { name: "description", content: "Inspect any .ckf package — sections, search, and source traceability." },
      { property: "og:title", content: "Open CKF — Viewer" },
      { property: "og:description", content: "Inspect any .ckf package locally." },
      { property: "og:url", content: "https://open.compiledknowledgeformat.org/viewer" },
    ],
    links: [{ rel: "canonical", href: "https://open.compiledknowledgeformat.org/viewer" }],
  }),
  component: ViewerPage,
});

type Loaded = { pkg: CkfPackage; filename: string; format: string };

const SECTIONS: { key: keyof CkfPackage; label: string }[] = [
  { key: "core_intent", label: "Core intent" },
  { key: "domain_map", label: "Domain map" },
  { key: "entities", label: "Entities" },
  { key: "concepts", label: "Concepts" },
  { key: "principles", label: "Principles" },
  { key: "heuristics", label: "Heuristics" },
  { key: "decision_rules", label: "Decision rules" },
  { key: "procedures", label: "Procedures" },
  { key: "patterns", label: "Patterns" },
  { key: "anti_patterns", label: "Anti-patterns" },
  { key: "causal_chains", label: "Causal chains" },
  { key: "contextual_triggers", label: "Contextual triggers" },
  { key: "if_then_rules", label: "IF-THEN rules" },
  { key: "exceptions", label: "Exceptions" },
  { key: "mental_models", label: "Mental models" },
  { key: "playbooks", label: "Playbooks" },
  { key: "qa_pairs", label: "Q&A pairs" },
  { key: "retrieval_chunks", label: "Retrieval chunks" },
  { key: "atomic_units", label: "Atomic units" },
  { key: "agent_instructions", label: "Agent instructions" },
  { key: "knowledge_limits", label: "Knowledge limits" },
  { key: "source_traceability", label: "Source traceability" },
];

function ViewerPage() {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [active, setActive] = useState<keyof CkfPackage>("entities");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<{ name: string; text: string } | null>(null);
  const [trace, setTrace] = useState<{ id: string; excerpt?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);

  async function onLoad(f: File) {
    try {
      const txt = await f.text();
      const r = parseCkf(txt, f.name);
      setLoaded({ pkg: r.pkg, filename: f.name, format: r.format });
      toast.success(`Loaded ${f.name}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function onSource(f: File) {
    try {
      const txt = await readFileAsText(f);
      setSource({ name: f.name, text: txt });
      toast.success(`Source linked: ${f.name}`);
    } catch (e) { toast.error(String(e)); }
  }

  function onTrace(id: string) {
    if (!loaded) return;
    const item = loaded.pkg.source_traceability.find((s) => s.extracted_item_id === id);
    setTrace({ id, excerpt: item?.source_excerpt });
  }

  const sourceExcerpt = useMemo(() => {
    if (!trace || !source) return null;
    if (!trace.excerpt) return null;
    const idx = source.text.toLowerCase().indexOf(trace.excerpt.toLowerCase().slice(0, Math.min(80, trace.excerpt.length)));
    if (idx < 0) return null;
    const start = Math.max(0, idx - 200);
    const end = Math.min(source.text.length, idx + trace.excerpt.length + 200);
    return { before: source.text.slice(start, idx), match: source.text.slice(idx, idx + trace.excerpt.length), after: source.text.slice(idx + trace.excerpt.length, end) };
  }, [trace, source]);

  if (!loaded) {
    return (
      <Shell>
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="mb-8 flex items-start gap-3">
            <FileSearch className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t.viewer.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.viewer.subtitle}</p>
            </div>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onLoad(f); }}
            className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-16 text-center"
          >
            <p className="font-display text-xl font-semibold">{t.viewer.dropTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t.viewer.dropHint}</p>
            <input ref={fileRef} type="file" accept=".ckf,.json,.yaml,.yml,.md,.markdown" hidden onChange={(e) => e.target.files?.[0] && onLoad(e.target.files[0])} />
            <Button className="mt-6" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{t.viewer.browse}</Button>
            <p className="mt-4 text-xs text-muted-foreground">{t.viewer.alsoCompiler} <Link to="/compiler" className="text-primary underline">{t.compiler.title}</Link>.</p>
          </div>
        </div>
      </Shell>
    );
  }

  const value = loaded.pkg[active];
  const items = Array.isArray(value) ? value : [value];
  const filtered = search
    ? items.filter((it) => JSON.stringify(it).toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Shell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{loaded.format.toUpperCase()} · {loaded.filename}</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{loaded.pkg.metadata.source_title || "Untitled"}</h1>
            <p className="text-xs text-muted-foreground">{loaded.pkg.metadata.domain} · {loaded.pkg.metadata.compression_level}</p>
          </div>
          <div className="flex gap-2">
            <input ref={sourceRef} type="file" accept=".pdf,.txt,.md,.docx" hidden onChange={(e) => e.target.files?.[0] && onSource(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => sourceRef.current?.click()}>
              <LinkIcon className="mr-2 h-3.5 w-3.5" />{source ? t.viewer.changeSource : t.viewer.linkSource}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setLoaded(null); setSource(null); setTrace(null); }}>
              <X className="mr-2 h-3.5 w-3.5" />{t.viewer.close}
            </Button>
          </div>
        </div>

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.viewer.searchPlaceholder} className="mb-4" />

        <div className="grid gap-4 md:grid-cols-[220px_1fr_320px]">
          <aside className="rounded-xl border border-border/60 bg-card p-2 md:max-h-[70vh] md:overflow-auto">
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => {
                const v = loaded.pkg[s.key];
                const count = Array.isArray(v) ? v.length : 1;
                return (
                  <li key={s.key as string}>
                    <button
                      onClick={() => setActive(s.key)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent ${active === s.key ? "bg-accent text-accent-foreground" : ""}`}
                    >
                      <span>{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="rounded-xl border border-border/60 bg-card p-4 md:max-h-[70vh] md:overflow-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.viewer.empty}</p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((it, i) => {
                  const id = (it as { id?: string })?.id;
                  return (
                    <li key={i} className="rounded-lg border border-border bg-background p-3 text-xs">
                      <div className="mb-2 flex items-center justify-between">
                        {id && <code className="font-mono text-[10px] text-muted-foreground">{id}</code>}
                        {id && <Button size="sm" variant="ghost" onClick={() => onTrace(id)}>{t.viewer.trace}</Button>}
                      </div>
                      <pre className="overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{JSON.stringify(it, null, 2)}</pre>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="rounded-xl border border-border/60 bg-card p-4 md:max-h-[70vh] md:overflow-auto">
            <h3 className="mb-2 text-sm font-medium">{t.viewer.sourcePanel}</h3>
            {!trace ? (
              <p className="text-xs text-muted-foreground">{t.viewer.tracePrompt}</p>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="text-muted-foreground">Item: <code className="font-mono">{trace.id}</code></p>
                {trace.excerpt ? (
                  <blockquote className="rounded border-l-2 border-primary bg-muted/30 p-2 italic">{trace.excerpt}</blockquote>
                ) : (
                  <p className="text-muted-foreground">No excerpt recorded for this item.</p>
                )}
                {sourceExcerpt ? (
                  <div className="mt-3 rounded border border-border bg-background p-2 leading-relaxed">
                    <span className="text-muted-foreground">…{sourceExcerpt.before}</span>
                    <mark className="bg-primary/30 px-0.5 text-foreground">{sourceExcerpt.match}</mark>
                    <span className="text-muted-foreground">{sourceExcerpt.after}…</span>
                  </div>
                ) : trace.excerpt && !source ? (
                  <p className="text-muted-foreground">{t.viewer.noSourceHint}</p>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
