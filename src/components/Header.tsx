import { Link } from "@tanstack/react-router";
import { Github, Moon, Sun, Globe } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const GH_URL = "https://github.com/tomazinho/open-kcp-knowledge-context-protocol";
const SITE_URL = "https://knowledgecontextprotocol.org";

export function Header() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-violet to-blue" />
          Open KCP
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <Link to="/compiler" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">{t.nav.compiler}</Link>
          <Link to="/compiler-demo" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">{t.nav.demo}</Link>
          <Link to="/viewer" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">{t.nav.viewer}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-block">
            {t.nav.site}
          </a>
          <a href={GH_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
            <Button variant="ghost" size="icon"><Github className="h-4 w-4" /></Button>
          </a>
          <Button variant="ghost" size="icon" onClick={() => setLang(lang === "en" ? "pt-BR" : "en")} aria-label="Toggle language">
            <Globe className="h-4 w-4" />
            <span className="ml-1 text-[10px] font-medium uppercase">{lang === "en" ? "en" : "pt"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
