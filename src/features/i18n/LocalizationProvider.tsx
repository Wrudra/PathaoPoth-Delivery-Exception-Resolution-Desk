"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { blocksClient } from "@/lib/blocks/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useStoredPreference } from "@/lib/hooks";
import { LOCAL_DICTIONARIES, en, type TranslationKey } from "./dictionary";

export type Language = { code: string; name: string; isDefault: boolean };

type LocalizationValue = {
  language: string;
  languages: Language[];
  setLanguage: (code: string) => void;
  t: (key: TranslationKey, fallback?: string) => string;
};

const LocalizationContext = createContext<LocalizationValue | undefined>(undefined);
const LANGUAGE_KEY = "pathaopoth:language";
const MODULE = "common";

// Languages the desk ships local strings for. The project also has de-DE
// configured in Blocks localization; it appears only once translations for it
// are pushed with `blocks localization push`.
const FALLBACK_LANGUAGES: Language[] = [
  { code: "en-US", name: "English", isDefault: true },
  { code: "bn-BD", name: "বাংলা", isDefault: false }
];

function normalize(raw: Record<string, unknown>): Language {
  const code = String(raw.languageCode ?? raw.code ?? "en-US");
  return { code, name: String(raw.languageName ?? raw.name ?? code), isDefault: Boolean(raw.isDefault) };
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [override, setOverride] = useStoredPreference(LANGUAGE_KEY, "");

  const languagesQuery = useQuery({
    queryKey: ["i18n", "languages"],
    queryFn: () => blocksClient.localization.languages(),
    enabled: status === "authenticated",
    staleTime: 10 * 60_000
  });

  const languages = useMemo<Language[]>(() => {
    const cloud = (languagesQuery.data ?? []).map((raw) => normalize(raw as Record<string, unknown>));
    const known = cloud.filter((entry) => entry.code in LOCAL_DICTIONARIES || entry.code.startsWith("en") || entry.code.startsWith("bn"));
    return known.length ? known : FALLBACK_LANGUAGES;
  }, [languagesQuery.data]);

  const language = override || languages.find((entry) => entry.isDefault)?.code || "en-US";

  const cloudDictionary = useQuery({
    queryKey: ["i18n", "translations", language, MODULE],
    queryFn: () => blocksClient.localization.translations(MODULE, language),
    enabled: status === "authenticated",
    staleTime: 10 * 60_000,
    retry: false
  });

  const value = useMemo<LocalizationValue>(() => {
    const local = LOCAL_DICTIONARIES[language] ?? LOCAL_DICTIONARIES[language.split("-")[0] ?? ""] ?? {};
    const cloud = (cloudDictionary.data ?? {}) as Record<string, string>;
    return {
      language,
      languages,
      setLanguage: (code) => setOverride(code),
      t: (key, fallback) => cloud[key] ?? local[key] ?? en[key] ?? fallback ?? key
    };
  }, [cloudDictionary.data, language, languages, setOverride]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useT(): LocalizationValue {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error("useT must be used within LocalizationProvider");
  return context;
}
