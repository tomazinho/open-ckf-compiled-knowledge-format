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
    const stored = typeof window !== "undefined" ? (localStorage.getItem("openkcp-lang") as Lang | null) : null;
    if (stored === "en" || stored === "pt-BR") setLangState(stored);
    else if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) {
      setLangState("pt-BR");
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("openkcp-lang", l);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
