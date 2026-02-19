# Pirtis Voice Agent

AI-powered voice interview system for personalized sauna (pirtis) design recommendations.

## Quick Reference

| What | Where |
|------|-------|
| **Frontend URL** | https://pirtis-voice-agent.vercel.app |
| **Admin Panel** | https://pirtis-voice-agent.vercel.app/admin |
| **Backend API** | http://65.108.246.252:8000 |
| **SSH to VPS** | `ssh -i /home/rimas/ai-projects/svarbus/SSHKEY/id_ed25519 -o IdentitiesOnly=yes root@65.108.246.252` |
| **Restart Backend** | `systemctl restart agent-brain` |
| **View Logs** | `journalctl -u agent-brain -f` |

## Architecture

```
Frontend (Vercel)              Backend (Hetzner VPS 65.108.246.252)
Next.js 16 + shadcn/ui    -->  FastAPI + Uvicorn
                               |
                               +-- PostgreSQL (Docker)
                               +-- Whisper STT (small model)
                               +-- Gemini API (primary LLM)
                               +-- Claude API (fallback LLM)
```

## Services

- **LLM**: Google Gemini + Anthropic Claude (fallback on quota errors)
- **STT**: OpenAI Whisper (small model, local on VPS)
- **Database**: PostgreSQL 16 (Docker)
- **Frontend**: Next.js 16 on Vercel
- **Backend**: FastAPI on Hetzner VPS

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with language selector (LT/EN/RU) |
| `/session/[id]` | Interview session (iterative single-question flow) |
| `/results/[id]` | Final report with translation buttons |
| `/admin` | Brain configuration management |

## Backend Endpoints

```
# Session
POST /session/start              - Create session (quick or precise mode)
POST /session/{id}/transcribe    - Whisper STT
POST /session/{id}/answer        - LLM slot extraction, next questions
POST /session/{id}/finalize      - Generate report
POST /session/{id}/translate     - Translate report (EN/RU)
GET  /session/{id}/download      - Download markdown

# Brain config
GET  /brain/config/export        - Export YAML config
POST /brain/config/import        - Import YAML config

# Skill evolution (X-Admin-Key header required)
GET  /admin/skill/versions       - List skill versions
POST /admin/skill/rules/generate - Generate rules from expert feedback
POST /admin/skill/versions/create - Create new skill version from approved rules
```

## Key Files

### Frontend (`frontend/`)
- `lib/api.ts` - API client with retry logic
- `lib/types.ts` - TypeScript interfaces
- `app/page.tsx` - Landing page
- `app/session/[id]/page.tsx` - Interview UI
- `app/results/[id]/page.tsx` - Results + translation
- `app/admin/page.tsx` - Brain config admin

### Backend (VPS `/opt/agent-brain/`)
- `app/main.py` - FastAPI app + CORS
- `app/routers/session.py` - Session endpoints
- `app/routers/admin.py` - Admin + expert review endpoints
- `app/routers/skill_admin.py` - Skill evolution endpoints
- `app/services/llm.py` - Gemini + Claude fallback (model: `gemini-2.0-flash`)
- `app/services/quick_policy.py` - Quick mode stop conditions + scoring adjustments
- `app/services/skill.py` - Skill version CRUD + caching
- `app/services/skill_evolution.py` - Rule generation from expert feedback
- `app/services/whisper.py` - STT transcription
- `app/prompts/templates.py` - LLM prompts

## User Flow

1. **Landing** - Select language (LT/EN/RU) -> Start Interview
2. **Session** - Iterative Q&A (1 question at a time) -> Voice recording -> Transcription -> Confirm
3. **Results** - View report -> Translate (EN/RU) -> Download

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev        # localhost:3000
npm run build      # Build for production
cd .. && npx vercel --prod  # Deploy from monorepo root (Vercel Root Directory = frontend)
```

### Backend (on VPS)
```bash
ssh -i /home/rimas/ai-projects/svarbus/SSHKEY/id_ed25519 -o IdentitiesOnly=yes root@65.108.246.252
cd /opt/agent-brain
source venv/bin/activate
systemctl restart agent-brain
journalctl -u agent-brain -f
```

## Important Notes

- Backend uses LLM fallback: Gemini -> Claude on 429/503 errors
- Whisper model is "medium" on VPS (CPU only, no GPU)
- Reports are stored in Lithuanian, translated on demand via LLM before email
- Admin key stored in localStorage on frontend
- CORS allows Vercel frontend + localhost:3000

## Gemini API Gotchas

- **Model alias**: `models/gemini-flash-latest` is extremely slow (~30-60s). Always use explicit `gemini-2.0-flash` (~0.5s)
- **Free tier**: Throttles every request to 30-60s. Must use Tier 1+ (pay-as-you-go) for production
- **Tier check**: Google AI Studio → API Keys → check "Pricing plan" column

## LLM Slot Extraction — UNKNOWN Sentinel

When LLM can't extract a slot value, it returns `"UNKNOWN"` (string), NOT `None`. Any code checking `value is None` will treat UNKNOWN as filled. Always use a helper:
```python
def _has_real_value(slot_data):
    value = slot_data.get("value")
    if value is None: return False
    if isinstance(value, str) and value.strip().upper() == "UNKNOWN": return False
    return True
```
This pattern applies in: `quick_policy.py`, `session.py` (progress calc, slot status, stop conditions).

## Theme System (Frontend)

- **Default**: Dark theme via `className="dark"` on `<html>` in `layout.tsx`
- **Admin pages**: Manage own theme, remove/add `.dark` class based on `localStorage.admin_theme`
- **Cleanup pattern**: Admin pages restore `.dark` on unmount so frontend stays dark
- **Tailwind**: Uses standard `.dark` class, NOT custom `.light` class

## SQLAlchemy + asyncpg Patterns (Backend)

| Issue | Wrong | Correct |
|-------|-------|---------|
| Type casting | `:param::jsonb` | `CAST(:param AS jsonb)` |
| Array params | `ANY(:ids)` | `ANY(CAST(:ids AS int[]))` |
| jsonb columns | `json.loads(row[n])` | Check `isinstance(row[n], dict)` first |
| Same param twice | `CASE WHEN :p ... :p` | Calculate in Python, pass separate params |
| Date intervals | `f"INTERVAL '{days} days'"` | `make_interval(days => :days)` |

**Why**: SQLAlchemy `:name` conflicts with PostgreSQL `::` cast. asyncpg returns jsonb as dicts.

## VPS Database Access

```bash
# Container: agent_postgres, User: agent, Database: agentbrain
cat migration.sql | docker exec -i agent_postgres psql -U agent -d agentbrain
```

## i18n Pattern (Email/Reports)

- **Reports**: Generated in Lithuanian, translated via LLM if user language != 'lt'
- **Email localization**: Use dictionary pattern for static text (greeting, footer)
```python
email_texts = {"lt": {...}, "en": {...}, "ru": {...}}
texts = email_texts.get(language, email_texts["lt"])
```
- **Attachment filenames**: Also localized (`sauna-report-xxx.md` for EN)

## Skill Evolution States

Rules flow: `pending` → `approved` → `applied`
- **pending**: Newly generated, awaiting review
- **approved**: Ready for skill creation (`metadata->>'incorporated_in_skill' IS NULL`)
- **applied**: Incorporated into skill version (`metadata->>'incorporated_in_skill'` set)

## Interview Modes

- **Quick**: Iterative 1-question loop, stops on: all critical slots filled / max 8 questions / 2 low-info answers. Uses `quick_policy.py` + `scoring.py` (no LLM for question selection)
- **Precise**: AI-generated follow-up questions via LLM, stops on: progress ≥ 95% + min 8 questions / max 12 questions
- Both modes use same frontend component (`PreciseModeFlow`), backend drives differences
- Config: `modes.quick` in `brain_config` DB table, critical slots with min_confidence thresholds

## Question System

Two separate systems - see `readme/QUESTION-SYSTEM.md` for full docs:
- **Brain Config (YAML)**: Predefined question pool, selected by scoring algorithm
- **Skill Document**: AI guidelines for follow-ups in precise mode, report formatting

## Protected Files (DO NOT MODIFY)

- `frontend/lib/api.ts`, `frontend/lib/types.ts`, `frontend/lib/audio-utils.ts` — backend integration, changes break the app
- Multi-agent handoff docs: `frontend/DESIGN_AGENT_INSTRUCTIONS.md`, `frontend/FRONTEND_TECHNICAL_SPEC.md`
