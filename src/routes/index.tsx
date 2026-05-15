import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Github, Sparkles, FileSearch, Wrench } from "lucide-react";
import { Shell } from "@/components/Shell";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Open CKF — Compile any document into a Knowledge Context Package" },
      { name: "description", content: "Open-source reference implementation of the Knowledge Context Protocol. Client-side compiler and viewer, BYOK." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useI18n();
  return (
    <Shell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="absolute inset-0 -z-10 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--violet) 25%, transparent) 0%, transparent 60%), radial-gradient(50% 50% at 80% 80%, color-mix(in oklab, var(--blue) 22%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t.home.eyebrow}</p>
          <h1 className="font-display text-5xl font-semibold tracking-tight md:text-7xl">
            <span className="text-gradient">{t.home.title}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">{t.home.subtitle}</p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground/90">{t.home.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/compiler"><Button size="lg">{t.home.ctaPro} <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link to="/compiler-demo"><Button size="lg" variant="secondary">{t.home.ctaDemo}</Button></Link>
            <Link to="/viewer"><Button size="lg" variant="ghost">{t.home.ctaViewer}</Button></Link>
            <a href="https://github.com/tomazinho/open-ckf-compiled-knowledge-format" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline"><Github className="mr-2 h-4 w-4" /> GitHub</Button>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          <Card icon={<Sparkles className="h-5 w-5" />} to="/compiler" title={t.home.cardProTitle} body={t.home.cardProBody} />
          <Card icon={<Wrench className="h-5 w-5" />} to="/compiler-demo" title={t.home.cardDemoTitle} body={t.home.cardDemoBody} />
          <Card icon={<FileSearch className="h-5 w-5" />} to="/viewer" title={t.home.cardViewerTitle} body={t.home.cardViewerBody} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-border/60 bg-card p-8 md:p-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t.home.officialTitle}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t.home.officialBody}</p>
          <a
            href="https://compiledknowledgeformat.org"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            {t.home.officialLink} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </Shell>
  );
}

function Card({ icon, to, title, body }: { icon: React.ReactNode; to: "/compiler" | "/compiler-demo" | "/viewer"; title: string; body: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">{icon}</div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-80 group-hover:opacity-100">
        Open <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
