// Loading messages for different processing stages in LT/EN/RU

export type Language = 'lt' | 'en' | 'ru';
export type ProcessingType = 'transcription' | 'analysis' | 'report';

interface StageMessages {
  stages: string[];
  title: string;
}

type MessagesMap = Record<ProcessingType, Record<Language, StageMessages>>;

export const loadingMessages: MessagesMap = {
  transcription: {
    lt: {
      title: 'Apdorojamas jūsų atsakymas',
      stages: [
        'Siunčiamas garso įrašas...',
        'Atpažįstama kalba...',
        'Apdorojamas tekstas...',
        'Baigiama...',
      ],
    },
    en: {
      title: 'Processing your answer',
      stages: [
        'Uploading audio...',
        'Recognizing speech...',
        'Processing text...',
        'Finishing...',
      ],
    },
    ru: {
      title: 'Обработка вашего ответа',
      stages: [
        'Загрузка аудио...',
        'Распознавание речи...',
        'Обработка текста...',
        'Завершение...',
      ],
    },
  },
  analysis: {
    lt: {
      title: 'Analizuojami atsakymai',
      stages: [
        'Analizuojami atsakymai...',
        'Išskiriama informacija...',
        'Ruošiami klausimai...',
        'Baigiama...',
      ],
    },
    en: {
      title: 'Analyzing answers',
      stages: [
        'Analyzing answers...',
        'Extracting information...',
        'Preparing questions...',
        'Finishing...',
      ],
    },
    ru: {
      title: 'Анализ ответов',
      stages: [
        'Анализ ответов...',
        'Извлечение информации...',
        'Подготовка вопросов...',
        'Завершение...',
      ],
    },
  },
  report: {
    lt: {
      title: 'Generuojama ataskaita',
      stages: [
        'Analizuojama sesija...',
        'Generuojamos rekomendacijos...',
        'Ruošiama ataskaita...',
        'Formatuojama...',
      ],
    },
    en: {
      title: 'Generating report',
      stages: [
        'Analyzing session...',
        'Generating recommendations...',
        'Preparing report...',
        'Formatting...',
      ],
    },
    ru: {
      title: 'Генерация отчёта',
      stages: [
        'Анализ сессии...',
        'Генерация рекомендаций...',
        'Подготовка отчёта...',
        'Форматирование...',
      ],
    },
  },
};

export function getMessages(type: ProcessingType, language: Language): StageMessages {
  return loadingMessages[type][language] || loadingMessages[type].en;
}

export function getLanguageFromStorage(): Language {
  if (typeof window === 'undefined') return 'lt';
  const stored = localStorage.getItem('pirtis-language');
  if (stored === 'lt' || stored === 'en' || stored === 'ru') {
    return stored;
  }
  return 'lt';
}
