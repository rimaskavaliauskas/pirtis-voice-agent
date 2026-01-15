# Brain Contract — „Pirties projektavimo interviu“ agento išmanumo sluoksnis (v1)

Šis dokumentas apibrėžia **agent brain** kontraktą: kokius duomenis renkam, kaip laikom sesijos būseną, kaip aptinkam rizikas, ir kaip **deterministiškai** parenkam kitus 3 klausimus pagal **konfigūruojamą YAML → Postgres** konfigūraciją.

Tikslas: per **3 raundus × 3 klausimus** surinkti maksimaliai naudingą informaciją, kad galima būtų:
- sugeneruoti **individualizuoto pirties pasiūlymo** kryptį (ne brėžinį),
- pateikti **aiškų patikslinimų sąrašą** (checklist),
- išsaugoti sesiją ilgalaikiam darbui (PostgreSQL).

> Pastaba: **RAG šiame etape nenaudojamas.** Agentas remiasi statinėmis pirties projektavimo taisyklėmis (system prompt / knowledge pack) ir kliento atsakymais. RAG paliekamas vėlesniam etapui, kai dokumentų kiekis išaugs.

---

## 1. Architektūrinis principas

**Frontend (Vercel/Next.js)** yra „kūnas“:
- įrašo balsą,
- siunčia audio į backend,
- rodo transkripciją (preview/confirm),
- rodo 3 klausimus kiekviename raunde,
- rodo galutinę MD ataskaitą.

**Backend (Hetzner VPS/FastAPI)** yra „nervų sistema“:
- Whisper STT (lokalus) → tekstas,
- LLM (lokalus arba per API) → **slot extraction / summary / report**,
- deterministinis **question scoring** (be LLM) → top 3 klausimai,
- saugo sesijas Postgres’e (ilgalaikė atmintis) + optional Redis (runtime cache).

**LLM** yra „kalbos analizatorius“, bet **ne valdiklis**:
- LLM pildo struktūrą (slotai + confidence),
- LLM rašo santrauką,
- LLM rašo galutinę ataskaitą,
- **klausimų parinkimą** daro backend’as pagal scoring (konfigūruojama).

---

## 2. Duomenų modelis (State)

Sesijos būsena laikoma kaip vienas JSON objektas (Postgres’e, optionally Redis’e).

### 2.1. `AgentState` (JSON)

```json
{
  "session_id": "uuid",
  "language": "lt",
  "round": 1,
  "history": [
    {"role":"agent","question_id":"Q_R1_PURPOSE","text":"...","round":1},
    {"role":"user","text":"...","round":1}
  ],
  "slots": {
    "purpose": {"value": null, "confidence": 0},
    "users": {"value": null, "confidence": 0},
    "ritual": {"value": null, "confidence": 0},
    "location": {"value": null, "confidence": 0},
    "infrastructure": {"value": null, "confidence": 0},
    "stove_type": {"value": null, "confidence": 0},
    "fuel_type": {"value": null, "confidence": 0},
    "microclimate": {"value": null, "confidence": 0},
    "size_direction": {"value": null, "confidence": 0},
    "room_program": {"value": null, "confidence": 0},
    "budget": {"value": null, "confidence": 0},
    "timeline": {"value": null, "confidence": 0}
  },
  "unknown_slots": ["purpose","users","ritual"],
  "risk_flags": [
    {"code":"RISK_SOFT_STEAM_CONFLICT","severity":"medium","note":"...","evidence":["ritual","stove_type"]}
  ],
  "round_summary": null,
  "asked_question_ids": ["Q_R1_PURPOSE","Q_R1_USERS","Q_R1_RITUAL"],
  "next_questions": []
}
```

### 2.2. `confidence` taisyklė
- `confidence` yra 0–1.
- Jei `confidence < 0.55`, slotas laikomas „neužpildytu“ (į `unknown_slots`).

---

## 3. Konfigūruojamas „Brain backend“ (YAML → Postgres)

### 3.1. Konfigo idėja
Agentas neklausia iš kodo įhardcodintų 9 klausimų. Vietoje to:
- klausimų bankas (20+) yra YAML,
- YAML importuojamas į Postgres,
- runtime’e backend’as parenka **top 3** kiekvienam raundui pagal scoring.

### 3.2. Lentelės (DB)
- `brain_slots` — slotų aprašai ir svoriai
- `brain_questions` — klausimų šablonai + coverage (slotai / rizikos)
- `brain_risk_rules` — deterministinės rizikos taisyklės (JSON logika)
- `brain_scoring_config` — scoring svoriai (tuning be deploy)

Migracija: `migrations/001_brain_tables.sql`  
Importas: `scripts/import_brain_config.py`  
Seed YAML: `brain_config.seed.yaml`

---

## 4. Rizikų (risk_flags) logika

`risk_rules.rule_json` yra deterministinė schema. Minimaliai palaikomi operatoriai (MVP):
- `contains_any: [..]`
- `not_contains_any: [..]`
- `eq_any: [..]` (jei slotas turi normalizuotą reikšmę)
- `all: [ ... ]` (AND)
- (optional v2) `any: [ ... ]` (OR)

Backend’as vykdo taisykles prieš `state.slots[*].value` (string/JSON).

---

## 5. Klausimų parinkimo logika (scoring)

### 5.1. Kandidatų filtravimas
- imami tik `brain_questions.enabled = true`
- pašalinami jau klausti `asked_question_ids` (nebent specialus clarifier su rizika)

### 5.2. Score formulė (deterministinė)
Kiekvienas klausimas gauna taškus:

- `base_priority * w_base_priority`
- `covered_missing_slots * w_missing_slot`
- `covered_active_risks * w_risk`
- `round_match_bonus * w_round_fit`
- `asked_penalty` (neigiamas), jei jau klausta
- `required_slot_bonus`, jei klausimas dengia `is_required=true` slotus

**Covered missing slots** = `len(slot_coverage ∩ missing_slots)`  
**Covered active risks** = `len(risk_coverage ∩ active_risks)`

### 5.3. Top 3
Backend’as parenka `top 3` pagal score ir grąžina frontend’ui.

> Svarbu: LLM gali perrašyti klausimo formuluotę tik kosmetiškai, bet neturi pakeisti semantikos/coverage.

---

## 6. Runtime darbo eiga (vienas raundas)

1) Frontend siunčia audio → backend
2) Backend (Whisper) → transkripcija
3) Frontend parodo transkripciją → user confirm
4) Backend kviečia LLM (Extraction Prompt) ir atnaujina `state.slots`, `round_summary`, `unknown_slots`
5) Backend vykdo risk rules → `risk_flags`
6) Backend vykdo scoring → `next_questions[3]`
7) Backend išsaugo sesiją Postgres’e
8) Frontend rodo kitus 3 klausimus

Po 3 raundų backend kviečia LLM (Final Report Prompt) ir sukuria MD ataskaitą.

---

## 7. Minimalūs endpoint’ai (rekomendacija)

### Runtime
- `POST /session/start` → sukuria session (grąžina `session_id`)
- `POST /session/{id}/transcribe` → audio → transcript (Whisper)
- `POST /session/{id}/answer` → confirmed transcript → update state → return next_questions
- `GET  /session/{id}/state` → debug
- `POST /session/{id}/finalize` → generuoja MD report

### Brain config (admin)
- `GET  /brain/config/export` → YAML iš DB
- `POST /brain/config/validate` → validuoja YAML (be įrašymo)
- `POST /brain/config/import` → importuoja YAML į DB (upsert)

Admin UI (optional): mini Next.js puslapis, kuris kviečia šiuos endpoint’us.

---

## 8. Pastabos dėl saugumo ir privatumo

- Audio failų ilgai nelaikyti (nebent aiškiai sutarta). Laikyti tik transkripcijas.
- Admin endpoint’us apsaugoti: Caddy Basic Auth + `X-Admin-Key`.
- Postgres/Redis neturėtų būti atviri į internetą (bind į localhost / vidinis docker network).

---

## 9. Kas yra „done“ (Definition of Done)

- YAML importas suveikia → Postgres lentelėse yra slots/questions/rules/weights.
- Sesija per 3×3 klausimus veikia end-to-end.
- Kitas klausimų raundas parenkamas deterministiškai pagal scoring.
- Galutinis MD report’as sugeneruojamas ir išsaugomas DB.
- (Optional) Admin UI leidžia redaguoti YAML ir importuoti į DB.
