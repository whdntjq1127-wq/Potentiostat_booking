'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isLanguage,
  translations,
  type Language,
  type TranslationCopy,
} from '../lib/i18n';

const STORAGE_KEY = 'potentiostat-language';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  copy: TranslationCopy;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);

    if (isLanguage(storedLanguage)) {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      copy: translations[language],
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
