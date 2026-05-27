import { useMemo, useState } from "react";
import { dict, type Lang } from "./i18n/dict";
import { parseCkf } from "./lib/ckf/parse";
import type { CkfPackage } from "./lib/ckf/types";
import { ckfV1Stats } from "./lib/ckf/stats";

function pickLang(): Lang {
  if (typeof navigator !== "undefined" && /^pt/i.test(navigator.language)) return "pt";
  return "en";
}

const SAMPLE: CkfPackage = {
  metadata: {
    source_title: "Sample CKF Package",
    language: "en",
    created_at: new Date().toISOString(),
    compiler: "sample",
    status: "experimental",
  },
  concepts: [{ id: "c1", name: "Compiled Knowledge Format", description: "A structured representation of a document optimized for LLM inference." }],
  entities: [],
  definitions: [
    { id: "d1", term: "Schema-stable", definition: "A representation where the same input always produces the same structural shape.", source_refs: ["s1"] },
  ],
  statements: [
    { id: "st1", claim: "CKF makes inference more reliable than raw PDF + RAG.", source_refs: ["s1"] },
  ],
  rules: [
    { id: "r1", statement: "Definitions MUST include a source_refs array linking to a source excerpt.", source_refs: ["s1"] },
  ],
  procedures: [],
  qa_pairs: [],
  examples: [],
  source_excerpts: [
    { id: "s1", text: "CKF is a schema-stable, structured knowledge container.", location: "intro" },
  ],
  source_traceability: [],
} as unknown as CkfPackage;

export default function App() {
  const [lang, setLang] = useState<Lang>(pickLang());
  const t = dict[lang];
  const [pkg, setPkg] = useState<CkfPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function onFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCkf(text);
      setPkg(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const stats = useMemo(() => (pkg ? ckfV1Stats(pkg) : null), [pkg]);

  function highlight(s: string) {
    if (!query) return s;
    const idx = s.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return s;
    return (
      <>
        {s.slice(0, idx)}
        <mark style={{ background: "var(--accent)", color: "#000" }}>{s.slice(idx, idx + query.length)}</mark>
        {s.slice(idx + query.length)}
      </>
    );
  }

  const filterFn = (s: string) => !query || s.toLowerCase().includes(query.toLowerCase());

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>{t.title}</h1>
        <button className="btn btn-secondary" onClick={() => setLang(lang === "en" ? "pt" : "en")}>{lang === "en" ? "PT" : "EN"}</button>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{t.subtitle}</p>

      {!pkg && (
        <section className="card" style={{ textAlign: "center", padding: 40 }}>
          <label className="btn" style={{ display: "inline-block", marginBottom: 12 }}>
            {t.dropCkf}
            <input type="file" accept=".ckf,.json,.ckf.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <div>
            <button className="btn btn-secondary" onClick={() => setPkg(SAMPLE)}>{t.loadSample}</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 16 }}>{t.privacy}</p>
        </section>
      )}

      {error && (
        <section className="card" style={{ borderColor: "#ff5c5c", marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </section>
      )}

      {pkg && (
        <>
          <section className="card" style={{ marginBottom: 16 }}>
            <strong>{pkg.metadata.source_title}</strong>{" "}
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              · {pkg.metadata.language} · {(pkg.metadata as any).compiler ?? "?"}
            </span>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
              {stats && Object.entries(stats).map(([k, v]) => <span key={k} style={{ marginRight: 12 }}>{k}: <b style={{ color: "var(--fg)" }}>{String(v)}</b></span>)}
            </div>
            <div style={{ marginTop: 12 }}>
              <input type="text" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setPkg(null)}>← Reset</button>
            </div>
          </section>

          <Section title={t.definitions} items={(pkg as any).definitions} render={(d: any) => <div><b>{highlight(d.term)}</b> — {highlight(d.definition)}</div>} filter={(d: any) => filterFn(d.term + " " + d.definition)} />
          <Section title={t.rules} items={(pkg as any).rules} render={(r: any) => <div>{highlight(r.statement)}</div>} filter={(r: any) => filterFn(r.statement)} />
          <Section title={t.statements} items={(pkg as any).statements} render={(s: any) => <div>{highlight(s.claim)}</div>} filter={(s: any) => filterFn(s.claim)} />
          <Section title={t.procedures} items={(pkg as any).procedures} render={(p: any) => (
            <div><b>{highlight(p.name ?? "")}</b><ol>{(p.steps ?? []).map((s: any, i: number) => <li key={i}>{highlight(s.instruction ?? "")}</li>)}</ol></div>
          )} filter={(p: any) => filterFn(p.name ?? "")} />
          <Section title={t.concepts} items={(pkg as any).concepts} render={(c: any) => <div><b>{highlight(c.name)}</b> — {highlight(c.description ?? "")}</div>} filter={(c: any) => filterFn(c.name + " " + (c.description ?? ""))} />
          <Section title={t.qa} items={(pkg as any).qa_pairs} render={(q: any) => <div><b>Q:</b> {highlight(q.question ?? "")}<br /><b>A:</b> {highlight(q.answer ?? "")}</div>} filter={(q: any) => filterFn((q.question ?? "") + " " + (q.answer ?? ""))} />
          <Section title={t.sources} items={(pkg as any).source_excerpts} render={(s: any) => <div><code style={{ color: "var(--muted)" }}>{s.id}</code> · {highlight(s.text)}</div>} filter={(s: any) => filterFn(s.text)} />
        </>
      )}

      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
        {t.footer}
      </footer>
    </div>
  );
}

function Section<T>({ title, items, render, filter }: { title: string; items: T[] | undefined; render: (x: T) => React.ReactNode; filter: (x: T) => boolean }) {
  if (!items || items.length === 0) return null;
  const visible = items.filter(filter);
  if (visible.length === 0) return null;
  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>{title} <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 400 }}>({visible.length})</span></h3>
      <div style={{ display: "grid", gap: 8 }}>
        {visible.map((it, i) => <div key={i} style={{ paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>{render(it)}</div>)}
      </div>
    </section>
  );
}
