# Brain Handoff — konfigūruojamas „Pirties projektavimo interviu“ agento protas (v1)

Šitas failas yra **pagrindinis „handoff“ dokumentas programuotojui**. Jame:
- trumpai aprašyta architektūra ir „išmanumo“ logika,
- pateiktas failų sąrašas ir **kur ką rasti**,
- pateiktas minimalus įgyvendinimo planas (MVP → optional Admin UI).

---

## 0) Failų žemėlapis — kur ką žiūrėti

### Kontekstas / specifikacija
- **`brain-contract.md`** — pilnas „Brain Contract“: state schema, scoring, risk rules, runtime flow, endpoint’ai, DoD.  
  Path: `/mnt/data/brain-contract.md`

- **`brain-prompts.md`** — visi LLM promptai (JSON-only): system, extraction, final report, optional risk explanations, optional question rewording.  
  Path: `/mnt/data/brain-prompts.md`

- **`brain-backend-config.md`** — YAML→Postgres konfigūravimas + Admin UI (optional) koncepcija.  
  Path: `/mnt/data/brain-backend-config.md`

### Konfigūracija (YAML)
- **`brain_config.seed.yaml`** — startinis klausimų bankas + slotai + risk rules + scoring weights (LT).  
  Path: `/mnt/data/brain_config.seed.yaml`

### DB migracija
- **`migrations/001_brain_tables.sql`** — Postgres lentelės „agent brain“ konfigui (slots/questions/risk_rules/scoring).  
  Path: `/mnt/data/migrations/001_brain_tables.sql`

### Import skriptas (YAML → Postgres)
- **`scripts/import_brain_config.py`** — upsert importas į Postgres.  
  Path: `/mnt/data/scripts/import_brain_config.py`

### Admin UI (optional mini CMS)
- **`admin-ui/`** — minimalus Next.js page scaffold: YAML editor + Validate/Import/Export mygtukai.  
  Path: `/mnt/data/admin-ui/`  
  - `admin-ui/app/page.tsx` — UI puslapis
  - `admin-ui/README.md` — paleidimas ir apsauga
  - `admin-ui/.env.example` — env pavyzdys

### Papildomas projekto kontekstas
- **`checklist-agent-architecture.updated.md`** — atnaujintas checklistas su VPS + Postgres/Redis + „išmanumo“ sluoksniu.  
  Path: `/mnt/data/checklist-agent-architecture.updated.md`

---

## 1) Vieno sakinio produkto apibrėžimas

Balso interviu agentas, kuris per **3 raundus × 3 klausimus** surenka kliento pirties poreikius, **adaptuoja klausimų seką** pagal atsakymus (slot filling + scoring), o pabaigoje sugeneruoja **Markdown ataskaitą** ir išsaugo viską Postgres’e ilgalaikiam darbui.

---

## 2) Sistemos architektūra (deploy)

### Frontend (Vercel / Next.js)
- Įrašo audio, siunčia backend’ui.
- Parodo transkripciją (preview/confirm).
- Rodo 3 klausimus raunde.
- Parodo final MD ataskaitą.

### Backend (Hetzner VPS / FastAPI)
- Whisper STT lokaliai (Whisper Flow arba analogiškai).
- LLM kvietimai:
  - **Extraction**: slotai + confidence + round summary + unknown slots (JSON-only).
  - **Final report**: final_markdown (JSON-only).
  - (optional) risk explanations / question rewording.
- Deterministinė logika (be LLM):
  - risk rules vykdymas iš DB (rule_json),
  - scoring (svoriai iš DB),
  - top-3 klausimų parinkimas kiekvienam raundui.

### Atmintis
- **PostgreSQL** (ilgalaikė): sesijos, žinutės, slotai, risk flags, report’ai, brain konfigas.
- **Redis (optional)**: runtime cache + TTL aktyvioms sesijoms (galima pridėti vėliau).

---

## 3) „Išmanumo“ logikos esmė (be RAG)

Šiame etape nėra RAG. „Išmanumas“ kyla iš trijų dalykų:

1) **Slot filling**: LLM iš atsakymo ištraukia struktūrą (slotų reikšmės + confidence).  
2) **Risk rules**: backend’as deterministiškai aptinka konfliktus pagal slotus (pvz., nuoma be nuotekų, žiema be vandens plano).  
3) **Scoring**: backend’as parenka kitus 3 klausimus pagal konfigūruojamą formulę:  
   - daugiau taškų už klausimus, kurie užpildo trūkstamus slotus,
   - daugiau taškų už klausimus, kurie sprendžia aktyvias rizikas,
   - „round fit“ bonusas,
   - „asked penalty“ jei klausimas kartojamas.

Klausimų bankas didesnis nei 9 (20+), todėl scoring turi realų pasirinkimą, o ne „sekantį numerį“.

---

## 4) Brain backend konfigūracija (YAML → Postgres)

### Kodėl YAML?
- paprasta iteruoti (redaguoji failą),
- galima importuoti į DB (upsert) ir keisti elgesį be redeploy,
- vėliau galima pereiti į Admin UI „mini CMS“.

### Importo srautas
1) Paleisti DB migraciją: `migrations/001_brain_tables.sql`
2) Importuoti YAML: `scripts/import_brain_config.py brain_config.seed.yaml`
3) Runtime’e backend’as skaito `brain_slots / brain_questions / brain_risk_rules / brain_scoring_config` iš DB.

---

## 5) Minimalus endpoint’ų rinkinys (rekomenduojamas)

### Runtime
- `POST /session/start` → sukuria session, grąžina `session_id`.
- `POST /session/{id}/transcribe` → audio → transcript (Whisper).
- `POST /session/{id}/answer` → confirmed transcript → LLM extraction → update state → risk rules → scoring → grąžina `next_questions[3]`.
- `POST /session/{id}/finalize` → LLM final report → grąžina `final_markdown`.

### Admin (brain config)
- `GET  /brain/config/export` → YAML iš DB (optional, bet patogu).
- `POST /brain/config/validate` → validuoja YAML (be įrašymo).
- `POST /brain/config/import` → YAML importas (upsert).

Admin endpoint’us apsaugoti:
- reverse proxy Basic Auth (Caddy) + backend `X-Admin-Key`.

---

## 6) LLM promptai (JSON-only)

Žiūrėti: `brain-prompts.md`.

Naudojami minimaliai 2 promptai:
- **System** (bendros taisyklės + pirties gairės)
- **Extraction Prompt** (delta slotai + round summary + unknown slots; JSON-only)
- **Final Report Prompt** (final_markdown; JSON-only)

Svarbu:
- LLM nėra „controller“. Controller yra backend scoring logika.
- LLM neformuoja „kito klausimų raundo“ iš savęs; jis tik pildo struktūrą. Klausimus parenka scoring.

---

## 7) Admin UI (optional mini CMS)

Žiūrėti: `admin-ui/README.md` ir `admin-ui/app/page.tsx`.

MVP UI:
- textarea su YAML
- mygtukai: Export / Validate / Import
- env: `NEXT_PUBLIC_API_BASE`, optional `NEXT_PUBLIC_ADMIN_KEY`

Rekomenduojama apsauga:
- Caddy Basic Auth prieš UI
- `X-Admin-Key` backend’e

---

## 8) MVP įgyvendinimo planas (greitas)

1) **DB**
   - paleisti Postgres (native arba Docker)
   - vykdyti `001_brain_tables.sql`

2) **Brain config**
   - importuoti `brain_config.seed.yaml` per `import_brain_config.py`

3) **Backend**
   - implementuoti session state (Postgres) + `history`, `slots`, `asked_question_ids`
   - implementuoti risk evaluation pagal `brain_risk_rules.rule_json`
   - implementuoti scoring pagal `brain_scoring_config.weights`
   - integruoti LLM extraction (promptai iš `brain-prompts.md`)

4) **Frontend**
   - audio record → transcribe → confirm → answer
   - atvaizduoti 3 klausimus raunde
   - pabaigoje atvaizduoti `final_markdown`

5) **Optional**
   - Admin UI paleidimas + /brain/config/* endpoint’ai

---

## 9) Definition of Done (DoD)

- YAML importas veikia (DB užpildyta slots/questions/rules/weights).
- Sesija veikia per 3×3 klausimus (e2e).
- Kitas klausimų raundas parenkamas deterministiškai (scoring).
- Final MD report’as sugeneruojamas ir išsaugomas DB.
- (Optional) Admin UI leidžia redaguoti YAML ir importuoti į DB.
