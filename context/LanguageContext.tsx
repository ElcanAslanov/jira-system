"use client";

import { createContext, useContext, useEffect, useState } from "react";

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
  const [lang, setLang] = useState<Lang>("az");

  // 🔥 load saved language
  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved) {
      setLang(saved);
    }
  }, []);

  // 🔥 save language when changed
  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);