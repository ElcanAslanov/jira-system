"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";

type Lang = "az" | "en" | "tr" | "ru";

type LangContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

const LanguageContext = createContext<LangContextType>({
  lang: "az",
  setLang: () => {},
});

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lang") as Lang | null;
      if (saved) return saved;
    }
    return "az";
  });

  // save language
  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  // 🔥 prevent unnecessary rerenders
  const value = useMemo(() => ({ lang, setLang }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);