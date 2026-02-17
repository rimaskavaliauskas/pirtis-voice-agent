# Smart Interview Improvements - Design Plan

## Goal
Improve interview accuracy by adding confidence-based clarification questions, with user control over interview depth.

## Research Summary

From analyzing smart interview systems (TheySaid, Paradox, adaptive hiring platforms), key patterns identified:

| Pattern | Description | Applicable? |
|---------|-------------|-------------|
| Confidence-based probing | Ask follow-ups when extraction confidence is low | Yes - core feature |
| User-selectable modes | Let users choose interview depth | Yes - core feature |
| Skip logic | Skip irrelevant questions | Future |
| Dynamic slot generation | Create new slots on-the-fly | Future |

## Proposed Feature: Interview Mode Selection

### User Experience

**Landing Page** - User selects interview mode alongside language:

```
[Language: LT / EN / RU]

[Interview Style:]
  ( ) Quick & Easy - Faster, fewer questions (~5 min)
  (x) Precise - Thorough consultation, better recommendations (~10 min)

[Start Interview]
```

### Mode Behaviors

| Aspect | Quick Mode | Precise Mode |
|--------|-----------|--------------|
| Question presentation | All 3 at once (current) | One-by-one conversational |
| Clarification questions | Never | When confidence < 0.6 |
| Vague answer handling | Accept as-is | Ask for specifics |
| Required slots | Must fill | Must fill with high confidence |
| Optional slots | Skip if vague | Probe for details |
| Round structure | Fixed 3 questions | 3 main + clarifications as needed |
| Progress visualization | Round indicator only | Full interview fulfillment meter |
| **Skip logic** | **Yes - skip irrelevant Qs** | **Yes - skip irrelevant Qs** |

### Precise Mode: One-by-One Question Flow

```
Round Start
    ↓
Show Question 1 (single question, not 3)
    ↓
User records & confirms answer
    ↓
LLM extracts slots with confidence scores
    ↓
If any slot confidence < 0.6:
    ├─→ Generate clarification question
    ├─→ User answers clarification
    └─→ Re-extract with new context
    ↓
Update fulfillment visualization
    ↓
Show Question 2 (single)
    ↓
... repeat until 3 main questions done ...
    ↓
Round Complete → Next Round
```

### Skip Logic (Both Modes)

Skip irrelevant questions based on already-collected slot values:

**Example Skip Rules:**

| If slot has value | Skip questions about |
|-------------------|---------------------|
| `purpose` = "personal/family" | Rental infrastructure, business permits |
| `fuel_type` = "electric" | Wood storage, chimney, wood delivery |
| `location` = "apartment" | Outdoor installation, garden placement |
| `stove_type` = "continuous" | Periodic heating rituals, heat-up time |
| `budget` < 5000€ | Premium features, custom designs |

**Skip Rule YAML Format:**

```yaml
skip_rules:
  - id: SKIP_RENTAL_FOR_PERSONAL
    condition:
      slot: purpose
      not_contains_any: ["nuoma", "rental", "verslas", "business"]
    skip_questions:
      - Q_CLARIFY_INFRASTRUCTURE_RENTAL
      - Q_BUSINESS_PERMITS

  - id: SKIP_WOOD_FOR_ELECTRIC
    condition:
      slot: fuel_type
      contains_any: ["elektrinė", "electric"]
    skip_questions:
      - Q_WOOD_STORAGE
      - Q_CHIMNEY_REQUIREMENTS

  - id: SKIP_OUTDOOR_FOR_APARTMENT
    condition:
      slot: location
      contains_any: ["butas", "apartment", "daugiabutis"]
    skip_questions:
      - Q_OUTDOOR_PLACEMENT
      - Q_GARDEN_ACCESS
```

**How it works:**
1. Before selecting next question, evaluate all skip rules
2. Build list of questions to exclude
3. Remove excluded questions from scoring pool
4. Select best question from remaining pool

**Benefits:**
- Shorter interviews (fewer irrelevant questions)
- Better user experience (no confusing questions)
- Works in both Quick and Precise modes

### Interview Fulfillment Visualization (Precise Mode)

Shows user their progress in real-time:

```
┌─────────────────────────────────────────────────┐
│  Interview Progress                              │
│  ████████████░░░░░░░░░░░░░░░░░░  42%            │
│                                                  │
│  ✓ Purpose      ✓ Ritual       ○ Infrastructure │
│  ○ Users        ○ Stove type   ○ Budget         │
│  ○ Size         ○ Timeline     ○ Location       │
└─────────────────────────────────────────────────┘
```

**Components:**
1. **Progress bar** - Overall completion percentage based on slots filled
2. **Slot status indicators** - Shows which information has been collected:
   - ✓ Filled (high confidence)
   - ◐ Partially filled (low confidence)
   - ○ Not yet collected
3. **Round indicator** - "Round 2 of 3"

**Calculation:**
- Required slots (4) = 60% weight
- Optional slots (8) = 40% weight
- Confidence affects fill status (>0.7 = filled, 0.4-0.7 = partial, <0.4 = empty)

### Example Clarification

**Original question**: "Koks jūsų biudžetas pirčiai?"
**User answer**: "Na, nenoriu per daug išleisti, bet ir pigios nenorėčiau"
**Extracted**: `budget: "moderate"` (confidence: 0.4)

**Clarification question**: "Suprantu. Ar galėtumėte patikslinti orientacinę sumą? Pavyzdžiui, 5000-10000€, 10000-20000€, ar virš 20000€?"

---

### Contact Collection (End of Interview)

After all rounds complete, before generating report:

```
┌─────────────────────────────────────────────────┐
│  Almost done! Please share your contact info    │
│                                                  │
│  Name: [________________]                        │
│  Email: [________________]  (optional)           │
│  Phone: [________________]  (optional)           │
│                                                  │
│  [Generate My Report]                            │
└─────────────────────────────────────────────────┘
```

**Report Footer:**
- Contact info added to report header
- Admin-configurable footer text (company info, disclaimers)
- Footer configured in admin panel or YAML

**Report output:**
```markdown
# Pirtis Recommendation Report

**Client:** Jonas Jonaitis
**Contact:** jonas@email.com | +370 600 12345
**Date:** 2026-01-15

... report content ...

---
*Footer text configured by admin*
*© Pirtis Konsultacijos | www.pirtis.lt | +370 600 00000*
```

---

### Feedback System (After Report)

Voice-operated feedback with 5-star rating:

```
┌─────────────────────────────────────────────────┐
│  How was your experience?                        │
│                                                  │
│  ★ ★ ★ ★ ☆  (4/5 stars)                         │
│                                                  │
│  [🎤 Record Feedback]                            │
│                                                  │
│  Your feedback:                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ "The interview was very thorough and    │    │
│  │  helped me understand what I need..."   │    │
│  └─────────────────────────────────────────┘    │
│                                  [Edit] [Submit] │
└─────────────────────────────────────────────────┘
```

**Flow:**
1. User sees results page with report
2. Below report: feedback section
3. User selects 1-5 stars
4. User records voice feedback → transcribed → shown for confirmation
5. User can edit text if needed
6. Submit stores in database

**Database storage:**
```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Admin analytics:**
- Average rating across all sessions
- Feedback text searchable
- Export feedback report

## Implementation Changes

### Backend (VPS /opt/agent-brain/)

1. **Session Start** - Accept `interview_mode` parameter
   - File: `app/routers/session.py`
   - Store mode in session state

2. **Slot Extraction** - Return confidence scores
   - File: `app/services/llm.py`
   - Already returns confidence, ensure it's used

3. **Answer Processing** - Check confidence, generate clarification
   - File: `app/routers/session.py`
   - New logic: if mode=precise AND confidence<0.6, return clarification question
   - New response field: `clarification_question`

4. **Clarification Question Generation**
   - File: `app/prompts/templates.py`
   - New prompt template for generating natural clarification questions

5. **Skip Rule Evaluation** - Filter questions before scoring
   - File: `app/services/scoring.py`
   - Load skip_rules from brain config
   - Before scoring, evaluate each skip rule against current slots
   - Remove skipped questions from candidate pool
   - Then run normal scoring on remaining questions

6. **Brain Config** - Add skip_rules section
   - File: `app/services/brain.py`
   - Load skip_rules from database alongside slots, questions, risk_rules

7. **Contact & Report Footer**
   - File: `app/routers/session.py`
   - Accept contact_info (name, email, phone) in finalize request
   - File: `app/prompts/templates.py`
   - Update REPORT_PROMPT to include client info header and admin footer
   - Footer text from brain config (configurable via admin)

8. **Feedback Endpoints**
   - File: `app/routers/session.py` (or new `app/routers/feedback.py`)
   - `POST /session/{id}/feedback` - Submit rating + text
   - `GET /admin/feedback` - List all feedback (admin only)
   - `GET /admin/feedback/stats` - Average rating, count (admin only)

### Frontend (frontend/)

1. **Landing Page** - Add mode selector
   - File: `app/page.tsx`
   - Add radio buttons for interview mode (Quick / Precise)
   - Pass mode to `startSession()`

2. **API Client** - Update types
   - File: `lib/api.ts`, `lib/types.ts`
   - Add `interview_mode` to start request
   - Add `clarification_question` to answer response
   - Add `slot_status` (filled slots with confidence) to response

3. **Session Page** - Two different flows based on mode
   - File: `app/session/[id]/page.tsx`

   **Quick Mode**: Keep current behavior (3 questions shown at once)

   **Precise Mode**:
   - Show one question at a time
   - After answer, check for clarification question in response
   - Show clarification if needed, then next question
   - Display fulfillment visualization

4. **NEW: Interview Progress Component**
   - File: `components/interview-progress.tsx`
   - Progress bar with percentage
   - Slot status grid (✓ filled, ◐ partial, ○ empty)
   - Only shown in Precise mode
   - Updates after each answer

5. **NEW: Contact Form Component**
   - File: `components/contact-form.tsx`
   - Shown after all rounds complete, before report generation
   - Fields: Name (required), Email (optional), Phone (optional)
   - Submit triggers report generation with contact info

6. **NEW: Feedback Component**
   - File: `components/feedback-form.tsx`
   - 5-star rating selector
   - Voice recording for feedback (reuse AudioRecorderComponent)
   - Transcript preview with edit capability
   - Submit button
   - Shown on results page below report

7. **Results Page Updates**
   - File: `app/results/[id]/page.tsx`
   - Add feedback section below report
   - Show "Thank you" after feedback submitted

8. **Admin Page Updates**
   - File: `app/admin/page.tsx`
   - Add "Report Footer" text field (saved to brain config)
   - Add "Feedback" tab showing all feedback with ratings

### Database

1. **Add `feedback` table**
```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

2. **Add `skip_rules` table** (or include in brain_config JSON)

3. **Add `contact_info` to sessions table** (or store in session state JSON)

4. **Add `report_footer` to brain_config**

### YAML Configuration

Add to scoring section:
```yaml
clarification:
  enabled_modes: ["precise"]
  confidence_threshold: 0.6
  max_clarifications_per_round: 2
  slots_to_clarify:
    - purpose
    - ritual
    - infrastructure
    - users
    - budget
    - size_direction
```

## UI Text Additions (i18n)

```typescript
// lib/translations/lt.ts
landing: {
  interviewMode: "Interviu stilius",
  quickMode: "Greitas",
  quickModeDesc: "Mažiau klausimų, ~5 min",
  preciseMode: "Tikslus",
  preciseModeDesc: "Išsami konsultacija, ~10 min"
}

session: {
  clarifying: "Patikslinkime...",
  interviewProgress: "Interviu progresas",
  slotFilled: "Surinkta",
  slotPartial: "Reikia patikslinti",
  slotEmpty: "Dar nesurinkta"
}

// Slot labels for progress display
slots: {
  purpose: "Paskirtis",
  ritual: "Ritualas",
  infrastructure: "Infrastruktūra",
  users: "Naudotojai",
  location: "Vieta",
  stove_type: "Krosnies tipas",
  fuel_type: "Kuras",
  microclimate: "Mikroklimatas",
  room_program: "Patalpos",
  size_direction: "Dydis",
  budget: "Biudžetas",
  timeline: "Terminai"
}

// Contact form
contact: {
  title: "Beveik baigta!",
  subtitle: "Nurodykite savo kontaktinę informaciją",
  name: "Vardas",
  email: "El. paštas (neprivaloma)",
  phone: "Telefonas (neprivaloma)",
  submit: "Generuoti ataskaitą"
}

// Feedback
feedback: {
  title: "Kaip įvertintumėte patirtį?",
  ratingLabel: "Įvertinimas",
  recordFeedback: "Įrašyti atsiliepimą",
  yourFeedback: "Jūsų atsiliepimas",
  edit: "Redaguoti",
  submit: "Pateikti",
  thankYou: "Ačiū už atsiliepimą!"
}
```

## Files to Modify

### Backend
- `/opt/agent-brain/app/routers/session.py` - Mode handling, clarification, contact info, feedback
- `/opt/agent-brain/app/routers/admin.py` - Feedback list/stats endpoints, report footer config
- `/opt/agent-brain/app/services/llm.py` - Clarification question generation
- `/opt/agent-brain/app/services/scoring.py` - Skip rule evaluation before question scoring
- `/opt/agent-brain/app/services/brain.py` - Load skip_rules, report_footer from database
- `/opt/agent-brain/app/prompts/templates.py` - Clarification prompt, report with contact+footer

### Database
- Add `feedback` table
- Add `skip_rules` table (or brain_config JSON)
- Add `report_footer` to brain_config
- Store `contact_info` in session

### Frontend
- `frontend/app/page.tsx` - Mode selector UI on landing page
- `frontend/app/session/[id]/page.tsx` - Two flows: Quick vs Precise (one-by-one)
- `frontend/app/results/[id]/page.tsx` - Add feedback section
- `frontend/app/admin/page.tsx` - Add report footer config, feedback tab
- `frontend/components/interview-progress.tsx` - **NEW** Progress visualization
- `frontend/components/contact-form.tsx` - **NEW** Contact collection form
- `frontend/components/feedback-form.tsx` - **NEW** Voice feedback with rating
- `frontend/lib/api.ts` - Updated API types, feedback endpoints
- `frontend/lib/types.ts` - New types (interview_mode, slot_status, feedback)
- `frontend/lib/translations/*.ts` - New UI strings

## Design Decisions (Confirmed)

1. **Clarifications are extra** - Don't count toward the 3 main questions per round
2. **Precise mode has visual indicator** - Progress visualization serves this purpose
3. **Mode not changeable mid-interview** - Selected once at start

## Success Metrics

- Slots with confidence > 0.7 increase by 30%+
- User satisfaction maintained (no complaints about "too many questions")
- Report quality improves (more specific recommendations)
