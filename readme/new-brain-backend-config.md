# Brain Backend (YAML → Postgres) — konfigūravimas ir admin (v1)

Šis dokumentas aprašo, kaip konfigūruoti agento klausimus, slotus, rizikas ir scoring svorius per YAML, importuojamą į Postgres.

---

## 1. Konfigūracijos šaltinis: YAML

Failas: `brain_config.seed.yaml` (startinis).

YAML struktūra:
- `scoring.weights` — svoriai (tuning be kodo)
- `slots[]` — slotų sąrašas (what to collect)
- `risk_rules[]` — deterministinės rizikos taisyklės
- `questions[]` — klausimų bankas (20+), iš kurio runtime’e parenkami top 3

Praktika:
- klausimų banke turėti daugiau nei 9 klausimus, kad scoring turėtų pasirinkimų
- įtraukti „clarifier“ klausimus, kurie aktyvuojami pagal rizikas

---

## 2. Importas į Postgres

### 2.1. Migracija
`migrations/001_brain_tables.sql`

### 2.2. Import skriptas
`scripts/import_brain_config.py`

Reikalavimai:
```bash
pip install pyyaml psycopg2-binary
```

Vykdymas:
```bash
export PGHOST=127.0.0.1
export PGPORT=5432
export PGDATABASE=sauna_agent
export PGUSER=sauna
export PGPASSWORD='...'
python scripts/import_brain_config.py brain_config.seed.yaml
```

Importas daro **upsert** (atnaujina esančius įrašus pagal ID), todėl galima iteruoti be DB trynimo.

---

## 3. Admin UI (optional) — mini „CMS“

Tikslas: redaguoti YAML ir importuoti į DB per web UI.

Minimalus Next.js puslapis (karkasas): `admin-ui/`.
Rekomenduojama apsauga:
- Caddy Basic Auth prieš UI
- `X-Admin-Key` tikrinimas backend’e admin endpoint’ams

Backend endpoint’ai:
- `GET  /brain/config/export` — DB → YAML
- `POST /brain/config/validate` — YAML validacija
- `POST /brain/config/import` — YAML importas (upsert)

---

## 4. Kaip keisti agento elgesį be deploy

### 4.1. Keisti prioritetus
- pakelk klausimo `base_priority` → dažniau bus parenkamas
- `enabled: false` → klausimas dingsta iš parinkimo

### 4.2. Keisti strategiją
- pakelk `scoring.weights.risk` → agentas labiau „gaudo konfliktus“
- pakelk `scoring.weights.missing_slot` → agentas labiau „gaudo spragas“
- pakelk `required_slot_bonus` → labiau prioritetizuoja privalomus slotus

### 4.3. Keisti rizikų aptikimą
Pridėk/atnaujink `risk_rules`:
- `contains_any` / `not_contains_any` dirba su stringais
- v2 galima normalizuoti slotus į enums ir naudoti `eq_any`

---

## 5. Integracija su sesijomis (ilgalaikė atmintis)

Rekomendacija:
- Postgres: sesijos, žinutės, slotai, report’ai (ilgalaikis)
- Redis (optional): aktyvi runtime būsena su TTL (greitis)

MVP galima viską laikyti Postgres’e, o Redis pridėti vėliau, jei reikės greičio/skalės.
