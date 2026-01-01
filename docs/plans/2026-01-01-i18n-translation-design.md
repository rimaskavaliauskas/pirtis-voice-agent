# Internationalization (i18n) Design Plan

**Date:** 2026-01-01
**Status:** Approved
**Languages:** Lithuanian (primary), English, Russian

## Overview

Implement full UI translation support for the Pirtis Voice Agent frontend. The backend generates all AI responses in Lithuanian; the frontend handles translation to EN/RU on demand.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│  LanguageContext (React Context)                            │
│    └── language: 'lt' | 'en' | 'ru'                         │
│    └── setLanguage()                                        │
│    └── persisted to localStorage ('pirtis-language')        │
├─────────────────────────────────────────────────────────────┤
│  lib/translations/                                          │
│    ├── index.ts        (exports hook and types)             │
│    ├── context.tsx     (LanguageProvider + useTranslation)  │
│    ├── useTranslateText.ts (dynamic AI translation hook)    │
│    ├── lt.ts           (Lithuanian strings)                 │
│    ├── en.ts           (English strings)                    │
│    └── ru.ts           (Russian strings)                    │
├─────────────────────────────────────────────────────────────┤
│  useTranslation() hook                                      │
│    └── const { t, language, setLanguage } = useTranslation()│
│    └── t('landing.title') → "Pirtis Design Interview"       │
│    └── t('session.question', { number: 2 }) → "Question 2"  │
├─────────────────────────────────────────────────────────────┤
│  useTranslateText() hook (for dynamic AI content)           │
│    └── calls POST /translate endpoint                       │
│    └── caches results to avoid re-translating               │
└─────────────────────────────────────────────────────────────┘
```

## Translation File Structure

```typescript
// lib/translations/en.ts (same structure for lt.ts, ru.ts)
export const en = {
  landing: {
    title: "Pirtis Design Interview",
    subtitle: "Your personal AI architect for the perfect sauna experience.",
    tagline: "Voice-powered • Personalized • Professional",
    selectLanguage: "Select Language",
    startButton: "Start",
    initializing: "Initializing...",
    steps: {
      share: "Share your needs",
      discuss: "Discuss details",
      plan: "Get specific plan"
    }
  },
  session: {
    title: "Pirtis Design Interview",
    roundSummary: "Previous round summary:",
    question: "Question {number}",
    submitRound: "Submit Round {number}",
    finishInterview: "Finish Interview",
    error: "Error",
    goHome: "Go Home"
  },
  questionCard: {
    pending: "Pending",
    recording: "Recording",
    processing: "Processing",
    review: "Review",
    done: "Done"
  },
  transcript: {
    yourAnswer: "Your answer to:",
    editPlaceholder: "Edit your transcript...",
    cancel: "Cancel",
    save: "Save",
    confirm: "Confirm Answer",
    reRecord: "Re-record",
    edited: "Transcript manually edited",
    noTranscript: "No transcript available"
  },
  results: {
    complete: "Interview Complete!",
    reportReady: "Your personalized sauna design report is ready",
    translateLabel: "Translate report:",
    showTranslation: "Show Translation",
    showOriginal: "Show Original",
    downloadTranslation: "Download Translation",
    loading: "Loading your report...",
    sessionId: "Session ID: {id}"
  },
  report: {
    title: "Interview Report",
    copy: "Copy",
    download: "Download",
    startNew: "Start New Interview"
  },
  round: {
    label: "Round {number}",
    progress: "Question {answered}/{total}",
    done: "% DONE"
  },
  audio: {
    processing: "Processing audio...",
    captured: "Recording captured"
  }
};
```

## Language Context Implementation

```typescript
// lib/translations/context.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { lt } from './lt';
import { ru } from './ru';

type Language = 'lt' | 'en' | 'ru';
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
```

## Dynamic Translation Hook

```typescript
// lib/translations/useTranslateText.ts
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from './context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

const translationCache = new Map<string, string>();

export function useTranslateText() {
  const { language } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);

  const translateText = useCallback(async (
    text: string,
    targetLang?: 'en' | 'ru'
  ): Promise<string> => {
    const target = targetLang || (language === 'lt' ? null : language);

    if (!target || target === 'lt') return text;

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

  return { translateText, isTranslating, language };
}
```

## Implementation Checklist

### Phase 1: Create Translation Infrastructure

- [ ] Create `lib/translations/` directory
- [ ] Create `lib/translations/en.ts` with all English strings
- [ ] Create `lib/translations/lt.ts` with all Lithuanian strings
- [ ] Create `lib/translations/ru.ts` with all Russian strings
- [ ] Create `lib/translations/context.tsx` with LanguageProvider and useTranslation
- [ ] Create `lib/translations/useTranslateText.ts` for dynamic translation
- [ ] Create `lib/translations/index.ts` to export all

### Phase 2: Integrate into App

- [ ] Update `app/layout.tsx` - wrap with LanguageProvider
- [ ] Update `app/page.tsx` - replace hardcoded strings, update language selector
- [ ] Update `app/session/[id]/page.tsx` - replace hardcoded strings
- [ ] Update `app/results/[id]/page.tsx` - replace strings, add report translation

### Phase 3: Update Components

- [ ] Update `components/question-card.tsx` - status labels
- [ ] Update `components/transcript-preview.tsx` - buttons and labels
- [ ] Update `components/report-preview.tsx` - button text
- [ ] Update `components/audio-recorder.tsx` - status messages
- [ ] Update `components/round-indicator.tsx` - labels
- [ ] Update `components/processing-overlay.tsx` - integrate with new context

### Phase 4: Backend Extension

- [ ] Add `POST /translate` endpoint to backend
- [ ] Use existing Gemini/Claude fallback pattern
- [ ] Request: `{ "text": "...", "target_language": "en" | "ru" }`
- [ ] Response: `{ "translated_text": "..." }`

### Phase 5: Testing & Cleanup

- [ ] Test all three languages end-to-end
- [ ] Verify language persists across page navigation
- [ ] Verify dynamic translation works for AI responses
- [ ] Remove old `loading-messages.ts` or integrate with new system
- [ ] Update tests if needed

## Files Summary

### New Files (6)

| File | Purpose |
|------|---------|
| `lib/translations/index.ts` | Exports hook and types |
| `lib/translations/context.tsx` | LanguageProvider + useTranslation |
| `lib/translations/useTranslateText.ts` | Dynamic AI translation hook |
| `lib/translations/en.ts` | English strings (~60) |
| `lib/translations/lt.ts` | Lithuanian strings (~60) |
| `lib/translations/ru.ts` | Russian strings (~60) |

### Modified Files (10)

| File | Changes |
|------|---------|
| `app/layout.tsx` | Wrap with LanguageProvider |
| `app/page.tsx` | Replace hardcoded strings, update language selector |
| `app/session/[id]/page.tsx` | Replace hardcoded strings |
| `app/results/[id]/page.tsx` | Replace hardcoded strings, use translateText |
| `components/question-card.tsx` | Replace status labels |
| `components/transcript-preview.tsx` | Replace button/label text |
| `components/report-preview.tsx` | Replace button text |
| `components/audio-recorder.tsx` | Replace status messages |
| `components/round-indicator.tsx` | Replace labels |
| `components/processing-overlay.tsx` | Integrate with new context |

### Backend Addition (1)

| Endpoint | Purpose |
|----------|---------|
| `POST /translate` | Generic text translation using Gemini/Claude |

## Design Decisions

1. **No external i18n library** - Custom solution is sufficient for ~60 strings and 3 languages
2. **React Context for state** - Simple, works with Next.js App Router
3. **localStorage persistence** - Language choice survives page refreshes
4. **Parameter interpolation** - Supports `{param}` syntax for dynamic values
5. **Translation caching** - Avoids re-translating same AI content
6. **Backend translation** - Centralizes LLM usage, reuses Gemini/Claude fallback
