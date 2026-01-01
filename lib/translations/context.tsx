'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { lt } from './lt';
import { ru } from './ru';

export type Language = 'lt' | 'en' | 'ru';
type Translations = typeof en;

const translations: Record<Language, Translations> = { en, lt, ru };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('lt');

  useEffect(() => {
    const stored = localStorage.getItem('pirtis-language') as Language;
    if (stored && ['lt', 'en', 'ru'].includes(stored)) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('pirtis-language', lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];

    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }

    let result = (typeof value === 'string' ? value : key);

    // Replace {param} placeholders
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }

    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used within LanguageProvider');
  return context;
}
