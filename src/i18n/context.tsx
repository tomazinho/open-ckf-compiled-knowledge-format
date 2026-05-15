import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, type Lang, en } from "./dictionaries";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof en;
};

const I18nContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: en });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // One-shot migration from legacy openkcp-* key
    const legacy = localStorage.getItem("openkcp-lang");
    if (legacy && !localStorage.getItem("openckf-lang")) {
      localStorage.setItem("openckf-lang", legacy);
      localStorage.removeItem("openkcp-lang");
    }
    const stored = localStorage.getItem("openckf-lang") as Lang | null;
    if (stored === "en" || stored === "pt-BR") setLangState(stored);
    else if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) {
      setLangState("pt-BR");
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("openckf-lang", l);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
