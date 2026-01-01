# Pirtis Voice Agent - Administrator Guide

This guide explains how the AI brain works, how it decides which questions to ask, and how to customize it using the YAML configuration.

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [How Question Selection Works](#how-question-selection-works)
4. [Understanding Slots](#understanding-slots)
5. [How Slot Extraction Works](#how-slot-extraction-works)
6. [Risk Rules](#risk-rules)
7. [YAML Configuration Reference](#yaml-configuration-reference)
8. [Practical Examples](#practical-examples)
9. [Admin Interface](#admin-interface)

---

## Overview

The Pirtis Voice Agent conducts interviews to understand customer needs for sauna (pirtis) design. The system:

1. **Asks questions** - 3 questions per round, 3 rounds total (9 questions)
2. **Extracts information** - Uses AI to understand user answers and extract structured data
3. **Detects risks** - Identifies potential problems (budget too low, unrealistic expectations)
4. **Generates report** - Creates a detailed recommendation document

The "brain" is fully configurable via YAML files that define:
- What questions to ask
- What information to collect (slots)
- What problems to detect (risk rules)
- How to prioritize questions (scoring weights)

---

## Core Concepts

### What is a "Slot"?

A **slot** is a piece of information you want to collect from the customer. Think of it like a form field.

**Examples:**
- `sauna_purpose` - Why does the customer want a sauna? (relaxation, health, entertainment)
- `budget` - How much are they willing to spend?
- `user_count` - How many people will use it?
- `available_space` - What space do they have available?

Each slot has:
- **name** - Unique identifier (e.g., `budget`)
- **description** - What this slot represents
- **required** - Whether this must be filled to generate a report

### What is a "Question"?

A **question** is what the system asks the customer. Each question is designed to help fill one or more slots.

**Example:**
```
Question: "Kokio dydžio pirties ieškote?"
Translation: "What size sauna are you looking for?"
This question helps fill: sauna_size, user_count
```

### What is a "Risk Rule"?

A **risk rule** detects potential problems based on collected information.

**Example:**
```
If budget < 5000 AND sauna_size = "large"
Then: "Budget may be insufficient for large sauna" (HIGH severity)
```

---

## How Question Selection Works

### The Scoring Algorithm

Every time the system needs to choose questions, it **scores all available questions** and picks the top 3.

The score is calculated using this formula:

```
SCORE = (base_priority × 0.1)
      + (missing_slots_covered × 3.0)
      + (required_slots_covered × 2.0)
      + (risks_covered × 2.0)
      + (round_fit × 1.5)
      + (asked_penalty × -5.0)
```

Let me explain each component:

### 1. Base Priority (×0.1)

Each question has a `base_priority` number (1-10). Higher = more important.

**Example:**
- Question about budget: `base_priority: 8` (very important)
- Question about sauna color: `base_priority: 3` (less important)

**Contribution to score:** `8 × 0.1 = 0.8` points

### 2. Missing Slots Coverage (×3.0)

How many **unfilled** slots does this question help collect?

**Example:**
- Slots still empty: `budget`, `user_count`, `sauna_size`
- Question covers: `budget`, `user_count`
- Covered missing slots: 2

**Contribution to score:** `2 × 3.0 = 6.0` points

This is the **most important factor** - questions that fill empty slots get high scores.

### 3. Required Slots Bonus (×2.0)

If the question covers **required** slots (not optional ones), it gets extra points.

**Example:**
- Question covers: `budget` (required), `preferred_color` (optional)
- Required slots covered: 1

**Contribution to score:** `1 × 2.0 = 2.0` points

### 4. Risk Coverage (×2.0)

Some questions help detect risks. If a risk hasn't been evaluated yet, questions that help evaluate it get bonus points.

**Example:**
- Risk "budget_too_low" needs slots: `budget`, `sauna_size`
- We already have: `sauna_size`
- Question covers: `budget` (the missing slot for this risk)

**Contribution to score:** `1 × 2.0 = 2.0` points

### 5. Round Fit Bonus (×1.5)

Questions can have a `round_hint` suggesting which round they belong to:
- Round 1: Basic questions (purpose, budget, size)
- Round 2: Detailed questions (features, materials)
- Round 3: Clarification questions (specific preferences)

If a question's `round_hint` matches the current round, it gets bonus points.

**Example:**
- Current round: 1
- Question has: `round_hint: 1`

**Contribution to score:** `1 × 1.5 = 1.5` points

### 6. Asked Penalty (×-5.0)

If a question was already asked, it gets a **penalty** (negative score).

**Contribution to score:** `-5.0` points

This prevents asking the same question twice.

---

### Complete Scoring Example

Let's say we're in **Round 1** and need to pick questions. Here's how one question might score:

**Question:** "Koks jūsų biudžetas pirčiai?" (What's your budget for the sauna?)
- `base_priority: 8`
- `slot_coverage: [budget, payment_preference]`
- `round_hint: 1`
- Not asked yet

**Current state:**
- Missing required slots: `budget`, `sauna_size`, `purpose`
- Missing optional slots: `payment_preference`, `color`
- Unevaluated risk: `budget_too_low` (needs `budget`)

**Score calculation:**
```
base_priority:     8 × 0.1 = 0.8
missing_slots:     2 × 3.0 = 6.0   (budget + payment_preference)
required_slots:    1 × 2.0 = 2.0   (budget is required)
risk_coverage:     1 × 2.0 = 2.0   (helps evaluate budget_too_low)
round_fit:         1 × 1.5 = 1.5   (round_hint matches current round)
asked_penalty:     0 × -5.0 = 0.0  (not asked yet)
─────────────────────────────────
TOTAL SCORE:              12.3
```

The system calculates this for **all questions** and picks the **top 3 by score**.

### Currently Configured Questions (23 total)

The system has **23 questions** preconfigured across 3 rounds plus clarification questions:

#### Round 1 Questions (Basic Information)

| ID | Priority | Question (LT) | Covers Slots |
|----|----------|---------------|--------------|
| `Q_R1_PURPOSE` | 100 | Kokia būtų pagrindinė jūsų pirties paskirtis? Ar tai bus asmeniniam naudojimui, svečiams, ar galbūt nuomai? | `purpose` |
| `Q_R1_USERS` | 95 | Kas dažniausiai naudosis pirtimi? Kiek žmonių vienu metu planuojate priimti? | `users` |
| `Q_R1_RITUAL` | 90 | Kokį pirties ritualą labiausiai mėgstate? Gal minkšto garo, gal tradicinį su vantomis? | `ritual` |
| `Q_R1_LOCATION_BASIC` | 85 | Kur planuojate statyti pirtį? Ar tai bus mieste, kaime, prie vandens telkinio? | `location` |
| `Q_R1_EXPERIENCE` | 80 | Papasakokite apie savo pirties patirtį - kokiose pirtyse lankėtės ir kas jums patiko labiausiai? | `ritual`, `purpose` |

#### Round 2 Questions (Technical Details)

| ID | Priority | Question (LT) | Covers Slots |
|----|----------|---------------|--------------|
| `Q_R2_INFRASTRUCTURE` | 95 | Kokia infrastruktūra yra sklype? Ar yra vandentiekis, elektra, nuotekos? | `infrastructure` |
| `Q_R2_STOVE_PREFERENCE` | 90 | Ar turite pageidavimų dėl krosnies tipo? Malkinė ar elektrinė? Periodinio ar nuolatinio kūrenimo? | `stove_type`, `fuel_type` |
| `Q_R2_TEMPERATURE` | 85 | Kokią temperatūrą ir drėgmę pirtyje mėgstate? Ar mėgstate karštesnę pirtį, ar švelnesnius 60-70 laipsnių? | `microclimate` |
| `Q_R2_ROOMS` | 85 | Kokias patalpas norėtumėte turėti šalia garinės? Poilsio zona, dušai, baseinėlis? | `room_program` |
| `Q_R2_SIZE` | 80 | Koks apytikris pirties dydis jums atrodo tinkamas? Kompaktiška, vidutinė, ar erdvi pirtis? | `size_direction` |
| `Q_R2_SEASONS` | 75 | Ar planuojate naudotis pirtimi visus metus, ar tik tam tikru sezonu? | `infrastructure` |
| `Q_R2_WATER_PROCEDURES` | 75 | Ar svarbu turėti galimybę atsigaivinti vandeniu po pirties - dušas, kubilą? | `room_program`, `infrastructure` |

#### Round 3 Questions (Finalization)

| ID | Priority | Question (LT) | Covers Slots |
|----|----------|---------------|--------------|
| `Q_R3_BUDGET` | 90 | Kokį biudžetą esate numatę pirties projektui ir statyboms? | `budget` |
| `Q_R3_TIMELINE` | 85 | Kokie jūsų terminai? Kada norėtumėte turėti veikiančią pirtį? | `timeline` |
| `Q_R3_SPECIAL_NEEDS` | 80 | Ar yra kokių nors specialių poreikių ar apribojimų, apie kuriuos turėtume žinoti? | — |
| `Q_R3_MATERIALS` | 80 | Ar turite pageidavimų dėl medžiagų? Gal tam tikros medienos rūšys? | `microclimate` |
| `Q_R3_DESIGN_STYLE` | 75 | Ar turite vizijos apie pirties išvaizdą ir stilių? Tradicinis, modernus, skandinaviškas? | — |
| `Q_R3_ACCESSIBILITY` | 75 | Ar reikia atsižvelgti į prieinamumo reikalavimus - vyresnio amžiaus žmonėms ar žmonėms su negalia? | `users` |

#### Clarification Questions (No Fixed Round)

These are asked dynamically when a risk is detected:

| ID | Priority | Triggers For Risk | Question (LT) |
|----|----------|-------------------|---------------|
| `Q_CLARIFY_INFRASTRUCTURE_RENTAL` | 85 | `RISK_RENTAL_NO_INFRASTRUCTURE` | Kadangi planuojate nuomą, kaip ketinate spręsti nuotekų klausimą? |
| `Q_CLARIFY_WINTER_WATER` | 80 | `RISK_WINTER_NO_WATER` | Jei planuojate naudotis žiemą, kaip užtikrinsite vandens tiekimą šaltuoju metų laiku? |
| `Q_CLARIFY_ELECTRIC_SIZE` | 75 | `RISK_ELECTRIC_LARGE_SPACE` | Elektrinė krosnis gali būti ribota didelei erdvei. Ar svarstytumėte malkinę krosnį? |
| `Q_CLARIFY_STOVE_TYPE` | 70 | `RISK_SOFT_STEAM_CONFLICT` | Norint gauti minkštą garą, geriausia naudoti akumuliacinę krosnį. Ar tai jums priimtina? |
| `Q_CLARIFY_VENTILATION` | 70 | `RISK_CAPACITY_VENTILATION` | Didelei grupei žmonių svarbi gera ventiliacija. Ar esate galvoję apie oro cirkuliaciją? |

#### Question YAML Format

```yaml
questions:
- id: Q_R1_PURPOSE
  text_lt: Kokia būtų pagrindinė jūsų pirties paskirtis? Ar tai bus asmeniniam naudojimui, svečiams, ar galbūt nuomai?
  text_en: What would be the main purpose of your sauna? Personal use, guests, or rental?
  base_priority: 100
  round_hint: 1
  slot_coverage:
  - purpose
  risk_coverage: []

- id: Q_CLARIFY_INFRASTRUCTURE_RENTAL
  text_lt: Kadangi planuojate nuomą, kaip ketinate spręsti nuotekų klausimą?
  text_en: Since you plan rental, how will you handle sewage?
  base_priority: 85
  round_hint: null    # No fixed round - asked when risk detected
  slot_coverage:
  - infrastructure
  risk_coverage:
  - RISK_RENTAL_NO_INFRASTRUCTURE
```

---

## Understanding Slots

### Slot Definition

Each slot in the YAML configuration has:

```yaml
slots:
  - name: budget           # Unique identifier
    description: |         # What this slot represents
      Kliento biudžetas pirčiai eurais.
      Customer's budget for sauna in euros.
    required: true         # Must be filled for report generation
```

### Slot Values After Extraction

When the AI extracts information from user answers, it stores:

```json
{
  "budget": {
    "value": 15000,
    "confidence": 0.9
  }
}
```

- **value** - The extracted value (number, string, or list)
- **confidence** - How sure the AI is (0.0 to 1.0)

### Currently Configured Slots (12 total)

The system has **12 slots** preconfigured:

#### Required Slots (4)

These must be filled to generate a complete report:

| Slot Key | Label (LT) | Label (EN) | Description |
|----------|------------|------------|-------------|
| `purpose` | Pirties paskirtis | Sauna purpose | Main purpose: relaxation, health, social, business |
| `ritual` | Pirties ritualas | Sauna ritual | Preferred ritual: soft steam, traditional, with venik |
| `infrastructure` | Infrastruktūra | Infrastructure | Available: water, electricity, sewage |
| `users` | Naudotojai | Users | Who will use: family, friends, clients |

#### Optional Slots (8)

These provide additional detail but aren't required:

| Slot Key | Label (LT) | Label (EN) | Description |
|----------|------------|------------|-------------|
| `location` | Vieta | Location | Where: urban, rural, by water |
| `stove_type` | Krosnies tipas | Stove type | Periodic/mass or continuous heating |
| `fuel_type` | Kuras | Fuel type | Wood, electric, or gas |
| `microclimate` | Mikroklimatas | Microclimate | Preferred temperature/humidity (60-80°C typical) |
| `room_program` | Patalpų programa | Room program | Required rooms: steam, rest area, shower, pool |
| `size_direction` | Dydžio kryptis | Size direction | Compact, medium, or large |
| `budget` | Biudžetas | Budget | Budget range or constraints |
| `timeline` | Terminai | Timeline | Expected construction timeline |

#### Slot YAML Format

```yaml
slots:
- key: purpose
  label_lt: Pirties paskirtis
  label_en: Sauna purpose
  description: What is the main purpose of the sauna (relaxation, health, social, business)
  is_required: true
  priority_weight: 1.2

- key: budget
  label_lt: Biudžetas
  label_en: Budget
  description: Budget range or constraints
  is_required: false
  priority_weight: 0.7
```

---

## How Slot Extraction Works

### The Process

1. **User speaks** → Audio recorded
2. **Whisper transcribes** → Text created
3. **User confirms** → Text sent to AI
4. **AI extracts slots** → Structured data returned

### The Extraction Prompt

The AI receives a prompt like this:

```
You are a slot-filling assistant. Given:
- Current slots: {already collected data}
- User's answer: "I'm thinking about 15000 euros, for 4 people"

Extract slot values. Return JSON:
{
  "slots": {
    "budget": {"value": 15000, "confidence": 0.95},
    "user_count": {"value": 4, "confidence": 0.90}
  }
}
```

### Confidence Scores

The AI assigns confidence based on how clear the answer is:

| Confidence | Meaning | Example |
|------------|---------|---------|
| 0.9 - 1.0 | Very clear | "My budget is exactly 15,000 euros" |
| 0.7 - 0.9 | Fairly clear | "Around 15 thousand" |
| 0.5 - 0.7 | Somewhat unclear | "Not too expensive, maybe 10-20k" |
| < 0.5 | Uncertain | "I haven't decided yet" |

Low confidence slots may trigger follow-up questions.

---

## Risk Rules

### What Risk Rules Do

Risk rules **automatically detect problems** based on slot values.

### Risk Rule Structure

```yaml
risk_rules:
  - code: budget_too_low           # Unique identifier
    severity: high                  # low, medium, or high
    description: |
      Budget may be insufficient for desired sauna size
    condition:                      # When does this risk trigger?
      all:                          # ALL conditions must be true
        - slot: budget
          op: lt                    # less than
          value: 10000
        - slot: sauna_size
          op: eq                    # equals
          value: "large"
```

### Condition Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | equals | `budget eq 15000` |
| `ne` | not equals | `heating_type ne "electric"` |
| `lt` | less than | `budget lt 10000` |
| `gt` | greater than | `user_count gt 8` |
| `le` | less than or equal | `budget le 5000` |
| `ge` | greater than or equal | `user_count ge 2` |
| `contains` | contains substring | `purpose contains "health"` |
| `contains_any` | contains any of list | `features contains_any ["sauna","steam"]` |
| `in` | value is in list | `heating_type in ["electric","gas"]` |

### Logical Operators

**ALL (AND)** - Every condition must be true:
```yaml
condition:
  all:
    - slot: budget
      op: lt
      value: 5000
    - slot: sauna_size
      op: eq
      value: "large"
# True only if budget < 5000 AND size = "large"
```

**ANY (OR)** - At least one condition must be true:
```yaml
condition:
  any:
    - slot: budget
      op: lt
      value: 3000
    - slot: has_no_space
      op: eq
      value: true
# True if budget < 3000 OR has_no_space = true
```

### Nested Conditions

You can combine ALL and ANY:
```yaml
condition:
  all:
    - slot: budget
      op: lt
      value: 10000
    - any:
        - slot: sauna_size
          op: eq
          value: "large"
        - slot: user_count
          op: gt
          value: 6
# True if budget < 10000 AND (size = "large" OR users > 6)
```

### Currently Configured Risk Rules

The system has **5 risk rules** preconfigured:

#### 1. RISK_SOFT_STEAM_CONFLICT (Medium Severity)

**Problem:** Customer wants soft steam but chose continuous/electric stove (wrong combination).

**Triggers when:**
- `ritual` contains: "minkštas garas", "soft steam", "lengvas garas"
- AND `stove_type` contains: "nuolatinio kūrenimo", "continuous", "elektrinė"

**Warning:**
> Minkštas garas geriau gaunamas su periodinio (akumuliacinio) kūrenimo krosnimis. Nuolatinio kūrenimo krosnys duoda kitokį garą.

```yaml
- id: RISK_SOFT_STEAM_CONFLICT
  code: RISK_SOFT_STEAM_CONFLICT
  severity: medium
  rule_json:
    all:
    - slot: ritual
      contains_any:
      - minkštas garas
      - soft steam
      - lengvas garas
    - slot: stove_type
      contains_any:
      - nuolatinio kūrenimo
      - continuous
      - elektrinė
```

---

#### 2. RISK_RENTAL_NO_INFRASTRUCTURE (High Severity)

**Problem:** Rental/business sauna without proper sewage system (sanitary violation risk).

**Triggers when:**
- `purpose` contains: "nuoma", "rental", "verslas", "business"
- AND `infrastructure` does NOT contain: "nuotekos", "sewage", "kanalizacija"

**Warning:**
> Nuomai skirta pirtis be nuotekų sistemos gali sukelti problemų su sanitariniais reikalavimais.

```yaml
- id: RISK_RENTAL_NO_INFRASTRUCTURE
  code: RISK_RENTAL_NO_INFRASTRUCTURE
  severity: high
  rule_json:
    all:
    - slot: purpose
      contains_any:
      - nuoma
      - rental
      - verslas
      - business
    - slot: infrastructure
      not_contains_any:
      - nuotekos
      - sewage
      - kanalizacija
```

---

#### 3. RISK_WINTER_NO_WATER (Medium Severity)

**Problem:** Year-round/winter use without reliable water supply.

**Triggers when:**
- `users` contains: "žiema", "winter", "visus metus", "year-round"
- AND `infrastructure` does NOT contain: "vandentiekis", "water supply", "šulinys", "well"

**Warning:**
> Žiemą naudojama pirtis reikalauja patikimo vandens šaltinio, kuris neužšąla.

```yaml
- id: RISK_WINTER_NO_WATER
  code: RISK_WINTER_NO_WATER
  severity: medium
  rule_json:
    all:
    - slot: users
      contains_any:
      - žiema
      - winter
      - visus metus
      - year-round
    - slot: infrastructure
      not_contains_any:
      - vandentiekis
      - water supply
      - šulinys
      - well
```

---

#### 4. RISK_CAPACITY_VENTILATION (Low Severity)

**Problem:** Large group usage without mentioning ventilation.

**Triggers when:**
- `users` contains: "daug", "many", "grupė", "group", "10+", "didelis"
- AND `room_program` does NOT contain: "ventiliacija", "ventilation", "oro"

**Warning:**
> Didelei grupei žmonių būtina tinkamai suprojektuota ventiliacija.

```yaml
- id: RISK_CAPACITY_VENTILATION
  code: RISK_CAPACITY_VENTILATION
  severity: low
  rule_json:
    all:
    - slot: users
      contains_any:
      - daug
      - many
      - grupė
      - group
      - 10+
      - didelis
    - slot: room_program
      not_contains_any:
      - ventiliacija
      - ventilation
      - oro
```

---

#### 5. RISK_ELECTRIC_LARGE_SPACE (Medium Severity)

**Problem:** Electric stove may be insufficient for large sauna space.

**Triggers when:**
- `stove_type` contains: "elektrinė", "electric"
- AND `size_direction` contains: "didelė", "large", "erdvi", "spacious"

**Warning:**
> Elektrinė krosnis gali būti nepakankama didelei pirties erdvei. Svarstykite alternatyvas.

```yaml
- id: RISK_ELECTRIC_LARGE_SPACE
  code: RISK_ELECTRIC_LARGE_SPACE
  severity: medium
  rule_json:
    all:
    - slot: stove_type
      contains_any:
      - elektrinė
      - electric
    - slot: size_direction
      contains_any:
      - didelė
      - large
      - erdvi
      - spacious
```

---

#### Risk Rules Summary Table

| Code | Severity | Detects |
|------|----------|---------|
| `RISK_SOFT_STEAM_CONFLICT` | Medium | Wrong stove type for soft steam ritual |
| `RISK_RENTAL_NO_INFRASTRUCTURE` | **High** | Rental business without sewage |
| `RISK_WINTER_NO_WATER` | Medium | Winter use without water supply |
| `RISK_CAPACITY_VENTILATION` | Low | Large groups without ventilation |
| `RISK_ELECTRIC_LARGE_SPACE` | Medium | Electric stove for large space |

---

## YAML Configuration Reference

### Complete Structure

```yaml
# ================================================
# SLOTS - Information to collect
# ================================================
slots:
  - name: sauna_purpose
    description: |
      Pagrindinė priežastis, kodėl klientas nori pirties.
      Main reason why customer wants a sauna.
    required: true

  - name: budget
    description: |
      Biudžetas eurais.
      Budget in euros.
    required: true

  - name: special_features
    description: |
      Specialios funkcijos, kurių klientas nori.
      Special features the customer wants.
    required: false

# ================================================
# QUESTIONS - What to ask
# ================================================
questions:
  - id: q_purpose                    # Unique identifier
    text: |
      Papasakokite, kodėl norite įsirengti pirtį?
      Kas jums svarbiausia?
    slot_coverage:                   # What slots this helps fill
      - sauna_purpose
      - primary_motivation
    base_priority: 9                 # Importance (1-10)
    round_hint: 1                    # Suggested round (1, 2, or 3)

  - id: q_budget
    text: |
      Koks jūsų biudžetas pirčiai?
    slot_coverage:
      - budget
      - payment_preference
    base_priority: 8
    round_hint: 1

  - id: q_size_users
    text: |
      Kiek žmonių paprastai naudosis pirtimi?
      Kokio dydžio pirtis jums reikalinga?
    slot_coverage:
      - user_count
      - sauna_size
    base_priority: 8
    round_hint: 1

  - id: q_features
    text: |
      Ar yra kokių nors specialių funkcijų, kurių norėtumėte?
      Pvz., LED apšvietimas, garso sistema, aromaterapija?
    slot_coverage:
      - special_features
    base_priority: 5
    round_hint: 2

# ================================================
# RISK RULES - Problems to detect
# ================================================
risk_rules:
  - code: budget_too_low_for_size
    severity: high
    description: |
      Biudžetas gali būti nepakankamas pasirinktam dydžiui.
      Budget may be insufficient for selected size.
    condition:
      all:
        - slot: budget
          op: lt
          value: 10000
        - slot: sauna_size
          op: eq
          value: "large"

  - code: unrealistic_timeline
    severity: medium
    description: |
      Klientas nori pirties per trumpą laiką.
      Customer wants sauna in unrealistic timeframe.
    condition:
      all:
        - slot: desired_timeline
          op: lt
          value: 30
        - slot: sauna_size
          op: ne
          value: "small"

# ================================================
# SCORING WEIGHTS - How to prioritize questions
# ================================================
scoring_weights:
  base_priority: 0.1       # How much base_priority matters
  missing_slot: 3.0        # Points per unfilled slot covered
  required_slot_bonus: 2.0 # Extra points for required slots
  risk: 2.0                # Points for helping evaluate risks
  round_fit: 1.5           # Bonus for matching round_hint
  asked_penalty: -5.0      # Penalty for already-asked questions
```

---

## Practical Examples

### Example 1: Adding a New Slot

You want to track whether the customer has pets (affects material recommendations).

**Add to slots section:**
```yaml
slots:
  # ... existing slots ...

  - name: has_pets
    description: |
      Ar klientas turi naminių gyvūnų.
      Whether customer has pets.
    required: false
```

### Example 2: Adding a New Question

You want to ask about pets.

**Add to questions section:**
```yaml
questions:
  # ... existing questions ...

  - id: q_pets_family
    text: |
      Ar turite naminių gyvūnų ar mažų vaikų?
      Tai padės parinkti tinkamas medžiagas.
    slot_coverage:
      - has_pets
      - has_small_children
    base_priority: 4
    round_hint: 2
```

### Example 3: Adding a Risk Rule

You want to warn if someone with pets wants natural wood floors (maintenance issue).

**Add to risk_rules section:**
```yaml
risk_rules:
  # ... existing rules ...

  - code: pets_with_wood_floor
    severity: medium
    description: |
      Naminiai gyvūnai gali pažeisti natūralias medines grindis.
      Pets may damage natural wood floors.
    condition:
      all:
        - slot: has_pets
          op: eq
          value: true
        - slot: floor_material
          op: contains_any
          value: ["wood", "natural", "medinės"]
```

### Example 4: Adjusting Scoring Weights

You want the system to prioritize filling required slots more heavily.

**Modify scoring_weights:**
```yaml
scoring_weights:
  base_priority: 0.1
  missing_slot: 3.0
  required_slot_bonus: 4.0    # Increased from 2.0 to 4.0
  risk: 2.0
  round_fit: 1.5
  asked_penalty: -5.0
```

Now questions that cover required slots will get +4 points instead of +2.

### Example 5: Complex Risk Rule

Warn if customer wants outdoor sauna in apartment complex (likely not allowed).

```yaml
risk_rules:
  - code: outdoor_sauna_apartment
    severity: high
    description: |
      Lauko pirtis daugiabučiame name gali būti draudžiama.
      Outdoor sauna in apartment building may not be allowed.
    condition:
      all:
        - slot: location
          op: eq
          value: "outdoor"
        - any:
            - slot: building_type
              op: eq
              value: "apartment"
            - slot: building_type
              op: contains
              value: "daugiabutis"
```

---

## Admin Interface

### Accessing the Admin Page

URL: `https://pirtis-voice-agent-dev.vercel.app/admin`

### Authentication

You need an admin key. Enter it in the input field and click "Login".

The key is stored in your browser's localStorage, so you won't need to enter it again.

### Exporting Configuration

1. Click "Export Configuration"
2. The current YAML will appear in the editor
3. Copy it or download it for backup

### Importing Configuration

1. Modify the YAML in the editor
2. Click "Validate" to check for errors
3. If valid, click "Import" to save changes

### Validation Errors

Common errors and fixes:

| Error | Meaning | Fix |
|-------|---------|-----|
| "Unknown slot in question" | Question references slot that doesn't exist | Add the slot first, or fix the slot name |
| "Duplicate slot name" | Two slots have same name | Rename one of them |
| "Invalid round_hint" | round_hint must be 1, 2, or 3 | Fix the number |
| "Invalid operator" | Unknown condition operator | Use valid operator (eq, lt, gt, etc.) |

### Best Practices

1. **Export before editing** - Always backup current config before changes
2. **Validate before importing** - Use the validate button first
3. **Test after importing** - Start a new session to verify changes
4. **Keep backups** - Save YAML files locally with dates

---

## Troubleshooting

### Questions Not Appearing

**Symptom:** A question you added never gets asked.

**Possible causes:**
1. **Low base_priority** - Increase it (try 7-9 for important questions)
2. **Slots already filled** - If the slots this question covers are already known, it scores lower
3. **Wrong round_hint** - If round_hint is 3 but you're testing round 1, it won't score well
4. **Asked penalty** - If testing repeatedly, the question might be marked as asked

**Fix:** Increase `base_priority` and ensure `slot_coverage` includes slots that are commonly empty.

### Risk Not Triggering

**Symptom:** A risk rule you created never triggers.

**Possible causes:**
1. **Condition never met** - Check if slot values actually match your conditions
2. **Slots not extracted** - The AI might not be extracting the values you expect
3. **Wrong operator** - `eq` vs `contains` matters

**Debug:** Export current session state and check actual slot values.

### Slots Not Being Extracted

**Symptom:** Users answer clearly but slots remain empty.

**Possible causes:**
1. **Slot description unclear** - The AI uses this to understand what to extract
2. **Question not aligned** - Question asks something different than slot expects
3. **User answer ambiguous** - Low confidence extraction

**Fix:** Improve slot descriptions to be very clear about what values to expect.

---

## Summary

| Concept | What it does | Where to configure |
|---------|--------------|-------------------|
| **Slots** | Define what info to collect | `slots:` section |
| **Questions** | Define what to ask | `questions:` section |
| **Risk Rules** | Detect problems | `risk_rules:` section |
| **Scoring Weights** | Control question priority | `scoring_weights:` section |

The system automatically:
- Selects best questions based on scoring
- Extracts slot values using AI
- Evaluates risk rules when slots change
- Generates reports using all collected data

Configuration changes take effect immediately after import - no restart needed.
