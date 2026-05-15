import { useI18n } from "@/i18n/context";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-base font-semibold">Open KCP</p>
            <p className="text-muted-foreground">{t.footer.tagline}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.footer.note}</p>
          </div>
          <div className="flex flex-col gap-1 text-muted-foreground sm:items-end">
            <a href="https://knowledgecontextprotocol.org" target="_blank" rel="noreferrer" className="hover:text-foreground">
              {t.footer.official}
            </a>
            <a href="https://github.com/tomazinho/open-kcp-knowledge-context-protocol" target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </a>
            <span className="text-xs">© {new Date().getFullYear()} · {t.footer.rights}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
