# Frontend Design Agent Instructions

You are working on the **Pirtis Voice Agent** - an AI-powered voice interview system for personalized sauna design recommendations. Your task is to improve the **visual design and UX** without breaking functionality.

## CRITICAL: Read This First

Another developer will continue working on this project after you. **DO NOT break the frontend-backend integration.** If you're unsure whether a change is safe, **don't make it**.

---

## Project Overview

| Item | Details |
|------|---------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend API | FastAPI on `http://65.108.246.252:8000` |
| Deployment | Vercel |

### User Flow
1. **Landing** (`/`) - Select language (LT/EN/RU) -> Start Interview
2. **Session** (`/session/[id]`) - 3 rounds x 3 questions with voice recording
3. **Results** (`/results/[id]`) - View report, translate, download

---

## PROTECTED FILES - DO NOT MODIFY

These files handle backend communication. **DO NOT CHANGE THEM:**

```
lib/api.ts          # API client - ALL backend calls
lib/types.ts        # TypeScript interfaces matching backend
lib/audio-utils.ts  # Audio processing utilities
```

### Why These Are Protected
- `api.ts` contains retry logic, error handling, and exact API contracts
- `types.ts` defines interfaces that match the Python backend exactly
- Changing these breaks the app silently (works locally, fails in production)

---

## SAFE TO MODIFY

### Visual Components (styling, layout, animations)
```
components/ui/*.tsx           # shadcn/ui base components
components/audio-recorder.tsx # Recording button visuals
components/question-card.tsx  # Question display card
components/round-indicator.tsx # Progress indicator
components/report-preview.tsx  # Report display
components/steam-animation.tsx # Decorative animation
components/processing-overlay.tsx # Loading overlay
components/transcript-preview.tsx # Transcript display
components/session-skeleton.tsx   # Loading skeleton
```

### Page Layouts (visual structure only)
```
app/page.tsx              # Landing page layout
app/session/[id]/page.tsx # Session page layout
app/results/[id]/page.tsx # Results page layout
app/admin/page.tsx        # Admin page layout
app/layout.tsx            # Root layout
app/globals.css           # Global styles
```

### What You CAN Change in Pages
- CSS classes and Tailwind utilities
- Component arrangement and layout
- Colors, typography, spacing
- Animations and transitions
- Icons and visual elements
- Responsive breakpoints
- Loading states appearance

### What You CANNOT Change in Pages
- API function calls (startSession, submitAnswers, etc.)
- State management logic (useState, useEffect with API calls)
- Data flow between components
- Props passed to components that come from API
- Navigation logic (router.push, redirects)
- Error handling that shows API errors

---

## MODIFICATION RULES

### Rule 1: Preserve All Imports from lib/
```tsx
// NEVER remove or modify these imports
import { startSession, submitAnswers, ... } from '@/lib/api';
import type { Question, AnswerResponse, ... } from '@/lib/types';
```

### Rule 2: Preserve All API Calls
```tsx
// NEVER modify the structure of API calls
const response = await startSession(language);  // Keep exact params
const result = await submitAnswers(sessionId, { transcripts }); // Keep exact structure
```

### Rule 3: Preserve State That Holds API Data
```tsx
// These states hold backend data - don't change their types
const [questions, setQuestions] = useState<Question[]>([]);
const [sessionId, setSessionId] = useState<string>('');
```

### Rule 4: You CAN Add Visual-Only State
```tsx
// Safe to add for animations, UI toggles, etc.
const [isAnimating, setIsAnimating] = useState(false);
const [showTooltip, setShowTooltip] = useState(false);
```

### Rule 5: You CAN Add New Visual Components
```tsx
// Safe to create new decorative/visual components
components/decorative-background.tsx
components/animated-button.tsx
components/fancy-loader.tsx
```

---

## TESTING CHECKLIST

Before considering your work complete, verify:

### Functionality Tests
- [ ] Landing page loads and language buttons work
- [ ] Clicking "Start Interview" creates session and navigates to `/session/[id]`
- [ ] Recording button starts/stops audio recording
- [ ] Transcription appears after recording
- [ ] "Confirm" button works for each question
- [ ] "Submit Round" advances to next round
- [ ] After 3 rounds, navigates to results page
- [ ] Results page shows the report
- [ ] Download button downloads markdown file
- [ ] Translate buttons work (EN/RU)

### Visual Regression
- [ ] No JavaScript errors in browser console
- [ ] No TypeScript errors on build (`npm run build`)
- [ ] Mobile responsive (test at 375px width)
- [ ] Loading states are visible
- [ ] Error states display properly

---

## COMMON MISTAKES TO AVOID

### 1. Don't Rename Props That Come From API
```tsx
// BAD - breaks data flow
<QuestionCard question={q.questionText} />  // API returns 'text', not 'questionText'

// GOOD - matches API
<QuestionCard question={q.text} />
```

### 2. Don't Change Component Props Interface If Used With API Data
```tsx
// BAD - breaks type safety
interface QuestionCardProps {
  questionContent: string;  // Changed from 'question'
}

// GOOD - keep original if it maps to API
interface QuestionCardProps {
  question: Question;  // Matches lib/types.ts
}
```

### 3. Don't Add Required Props to Components Without Updating All Usages
```tsx
// BAD - will break parent components
interface Props {
  theme: 'light' | 'dark';  // New required prop
}

// GOOD - make it optional with default
interface Props {
  theme?: 'light' | 'dark';  // Optional with default
}
```

### 4. Don't Modify useEffect Dependencies That Trigger API Calls
```tsx
// NEVER change this pattern
useEffect(() => {
  fetchData();
}, [sessionId]);  // Don't modify these dependencies
```

---

## FILE STRUCTURE REFERENCE

```
frontend/
├── app/
│   ├── globals.css          # Global styles - SAFE
│   ├── layout.tsx           # Root layout - SAFE (visual only)
│   ├── page.tsx             # Landing - SAFE (visual only)
│   ├── admin/page.tsx       # Admin - SAFE (visual only)
│   ├── session/[id]/page.tsx # Session - CAREFUL
│   └── results/[id]/page.tsx # Results - CAREFUL
├── components/
│   ├── ui/                  # shadcn base - SAFE
│   └── *.tsx                # Custom components - MOSTLY SAFE
├── lib/
│   ├── api.ts               # API CLIENT - DO NOT TOUCH
│   ├── types.ts             # TYPE DEFS - DO NOT TOUCH
│   ├── audio-utils.ts       # Audio utils - DO NOT TOUCH
│   ├── utils.ts             # Tailwind utils - SAFE
│   └── *.ts                 # Other utils - CHECK FIRST
└── public/                  # Static assets - SAFE
```

---

## WHEN IN DOUBT

1. **Don't modify files in `lib/`**
2. **Don't change function signatures of API calls**
3. **Don't modify state that holds API response data**
4. **Test the full user flow after changes**
5. **Run `npm run build` before finishing**

---

## HANDOFF NOTES

When you're done, document:
1. What visual changes were made
2. Any new components created
3. Any new dependencies added (`npm install ...`)
4. Any issues encountered

Create a file `DESIGN_CHANGES.md` with this information.
