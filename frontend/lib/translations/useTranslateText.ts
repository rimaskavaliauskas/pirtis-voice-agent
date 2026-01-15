'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from './context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

// Cache translated texts to avoid re-translating
const translationCache = new Map<string, string>();

export function useTranslateText() {
  const { language } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);

  const translateText = useCallback(async (
    text: string,
    targetLang?: 'en' | 'ru'
  ): Promise<string> => {
    const target = targetLang || (language === 'lt' ? null : language);

    // No translation needed for Lithuanian (source language)
    if (!target) return text;

    // Check cache first
    const cacheKey = `${target}:${text.slice(0, 100)}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language: target }),
      });

      if (!response.ok) throw new Error('Translation failed');

      const { translated_text } = await response.json();
      translationCache.set(cacheKey, translated_text);
      return translated_text;
    } finally {
      setIsTranslating(false);
    }
  }, [language]);

  // Clear cache if needed
  const clearCache = useCallback(() => {
    translationCache.clear();
  }, []);

  return { translateText, isTranslating, language, clearCache };
}
