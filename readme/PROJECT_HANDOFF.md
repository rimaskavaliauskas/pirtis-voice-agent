# PROJECT_HANDOFF.md

**Agent Brain / Voice Agent Infrastructure – Project Handoff**

## 1. Projekto tikslas (kontekstas)

Šis projektas yra **balsu valdomas LLM agentas**, skirtas:

- išklausinėti klientą apie **pirties (saunos) poreikius**,
- daryti tai **kelių raundų, adaptyviu interviu** principu,
- saugoti sesijas ir agento „sampratą“ ilgalaikėje atmintyje (Postgres),
- naudoti Redis trumpalaikei (sesijų) atminčiai,
- ateityje plėstis į RAG (kol kas nenaudojama).

Šiuo metu **pagrindinis fokusas – backend architektūra ir „agent brain“ logika**, ne frontend.

------

## 2. Serverio informacija

### VPS

- **Provider:** Hetzner Cloud
- **Architektūra:** ARM64 (Ampere / aarch64)
- **OS:** Ubuntu 22.04.5 LTS
- **RAM:** 16 GB
- **Disk:** ~160 GB
- **IP:** `65.108.246.252`

### Serverio būsena

- Serveris pilnai veikiantis
- Docker įdiegtas ir veikia
- Slaptažodinis SSH login **paliktas aktyvus**, bet pagrindinis prisijungimas – per SSH key

------

## 3. Prisijungimas prie serverio (LABAI SVARBU)

### SSH autentifikacija

Naudojamas **SSH raktas (ed25519)**.

#### Privatus raktas (lokaliai):

```

D:\AI\aleksandro kursas\SSHKEY\id_ed25519
```

#### Prisijungimo komanda:

```

ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252
```

> Pastaba: **SSH host key keitimai jau buvo sutvarkyti**, `known_hosts` problemų nebėra.

### VS Code (rekomenduojama)

Naudoti **VS Code Remote – SSH**:

**SSH Host config (VS Code):**

```

Host agent-brain-vps
    HostName 65.108.246.252
    User root
    IdentityFile D:/AI/aleksandro kursas/SSHKEY/id_ed25519
```

Po to:

- VS Code → Remote-SSH → Connect to Host → `agent-brain-vps`

Tai leidžia:

- redaguoti failus tiesiogiai serveryje,
- naudoti terminalą be copy–paste chaoso,
- dirbti kaip normaliame projekte.

------

## 4. Programinė aplinka (kas jau įdiegta)

### Docker

```

docker --version
# Docker version 29.1.3
```

### Docker Compose

Jei reikia:

```

docker compose version
```

(arba įdiegti `docker-compose-plugin`, jei nebūtų)

------

## 5. Projekto katalogų struktūra

Pagrindinis katalogas:

```

/opt/agent-brain
```

Rekomenduojama struktūra:

```

/opt/agent-brain
├── docker-compose.yml
├── config/
│   ├── brain/
│   │   ├── questions.yaml
│   │   ├── slots.yaml
│   │   └── rules.yaml
├── postgres/
│   └── init/
├── redis/
├── logs/
└── README.md
```

------

## 6. Docker Compose (Postgres + Redis)

Minimalus `docker-compose.yml` (jau naudotas):

```

services:
  postgres:
    image: postgres:16-alpine
    container_name: agent_postgres
    environment:
      POSTGRES_DB: agentbrain
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: STRONG_PASSWORD_HERE
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: agent_redis
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

Paleidimas:

```

docker compose up -d
```

------

## 7. „Agent Brain“ koncepcija (esminė dalis)

### Pagrindinė idėja

Agentas **NETURI hardcodintų klausimų**.

Vietoj to:

- klausimai, jų prioritetai ir sąlygos laikomi **YAML failuose**,
- agentas:
  1. užduoda klausimus (Round 1),
  2. analizuoja atsakymus,
  3. adaptuoja Round 2 ir Round 3 klausimus pagal:
     - jau užpildytus „slots“,
     - taisykles (`rules`),
     - prioritetus.

### Atmintis

- **Redis** – aktyvi sesija (kas jau žinoma šio pokalbio metu)
- **Postgres** – ilgalaikė:
  - sesijų istorija,
  - kliento poreikių „profilis“,
  - agento interpretacijos (sampratų santraukos)

### RAG

- ŠIUO METU **nenaudojamas**
- Architektūra paruošta ateičiai

------

## 8. Kalbos ir STT (kontekstas)

- STT planuojamas per **Whisper / Whisper-like modelį**
- Modeliai bus **open-source**
- Kalbos:
  - lietuvių
  - anglų
  - rusų
- Vartotojas **nekaitalioja kalbos sesijos metu**

------

## 9. Kas jau padaryta (statusas)

✅ VPS paruoštas
 ✅ SSH prieiga per raktą veikia
 ✅ Docker veikia
 ✅ Infrastruktūriniai blokai sutvarkyti
 ⏳ „Agent Brain“ logikos implementacija – **dar nepradėta**
 ⏳ YAML → Postgres importas – **sekantis žingsnis**

------

## 10. Ką reikia daryti toliau (agentui)

1. Perimti projektą per **VS Code Remote-SSH**
2. Užfiksuoti `docker-compose.yml`
3. Suprojektuoti:
   - Postgres schemą (`sessions`, `answers`, `slots`, `summaries`)
4. Aprašyti YAML formatą:
   - `questions.yaml`
   - `rules.yaml`
5. Parašyti „Brain Engine“:
   - gauna kontekstą + atsakymus
   - grąžina **kitus klausimus**
6. Tik vėliau:
   - STT integracija
   - Admin UI (mini CMS)

------

## 11. Svarbi pastaba agentui

Tai **ne demo projektas**.
 Tai infrastruktūra, kuri bus naudojama **realiems klientams**, todėl:

- aiški struktūra svarbiau už greitį,
- duomenų modelis svarbiau už UI,
- agento klausimų logika – projekto šerdis.
------

## Naujausi pakeitimai (2025-12-27)

- Backend: agento klausimai fiksuojami istorijoje ir sked_question_ids kai tik pateikiami; atsakymu kombinacija itraukia klausimo teksta LLM ekstrakcijai; prideti /session/{id}/download ir /session/{id}/translate.
- Backend: STT turi dydzio riba (MAX_AUDIO_BYTES), Whisper/Claude kvietimai vykdomi threaduose, Claude modelis konfiguruojamas per ANTHROPIC_MODEL.
- Frontend: rezultatu puslapis neberodo maketo ataskaitos klaidos atveju � rodo klaida.
- Aplinka: atnaujintas ackend/.env.example su ANTHROPIC_MODEL ir MAX_AUDIO_BYTES; sinchronizuokite savo .env.
