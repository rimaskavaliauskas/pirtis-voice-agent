# Pirtis Voice Agent

AI-powered voice interview system for personalized sauna (pirtis) design recommendations.

## Quick Reference

| What | Where |
|------|-------|
| **Frontend URL** | https://pirtis-voice-agent-hy5bwirdp-rimaskavs-projects.vercel.app |
| **GitHub Repo** | https://github.com/rimaskavaliauskas/pirtis-voice-agent |
| **Vercel Project** | https://vercel.com/rimaskavs-projects/pirtis-voice-agent-dev |
| **Backend API** | http://65.108.246.252:8000 |
| **SSH to VPS** | `ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252` |
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
| `/session/[id]` | Interview session (3 rounds x 3 questions) |
| `/results/[id]` | Final report with translation buttons |
| `/admin` | Admin panel (Config, Feedback, Review, Skill Evolution tabs) |
| `/admin/review/[id]` | Expert review form for specific session |

## Backend Endpoints

```
POST /session/start              - Create session, get first 3 questions
POST /session/{id}/transcribe    - Whisper STT
POST /session/{id}/answer        - LLM slot extraction, next questions
POST /session/{id}/finalize      - Generate report
POST /session/{id}/translate     - Translate report (EN/RU)
GET  /session/{id}/download      - Download markdown
POST /translate                  - Translate any text (for dynamic UI content)
GET  /brain/config/export        - Export YAML config
POST /brain/config/import        - Import YAML config

# Admin endpoints (require X-Admin-Key header)
GET  /admin/sessions             - List sessions for expert review
GET  /admin/sessions/{id}/review - Get session Q&A for review
POST /admin/sessions/{id}/review - Submit expert review
GET  /admin/skill/versions       - List skill versions
POST /admin/skill/rules/generate - Generate rules from expert feedback
```

## Repository Structure

| Repo | Path | Remote |
|------|------|--------|
| **Frontend** | `D:\AI\aleksandras-2-dalis\voice-agent\frontend` | GitHub (auto-deploys to Vercel) |
| **Backend** | `D:\AI\aleksandras-2-dalis\voice-agent\backend` | Local only (deploy via scp to VPS) |

**Backend sync workflow**: VPS is source of truth → sync to local with `scp` → commit locally

## Key Files

### Frontend (`frontend/`)
- `lib/api.ts` - API client with retry logic
- `lib/types.ts` - TypeScript interfaces
- `lib/translations/` - i18n: context.tsx (LanguageProvider), en.ts/lt.ts/ru.ts (static strings)
- `app/page.tsx` - Landing page
- `app/session/[id]/page.tsx` - Interview UI
- `app/results/[id]/page.tsx` - Results + translation
- `app/admin/page.tsx` - Brain config admin

### Backend (VPS `/opt/agent-brain/`)
- `app/main.py` - FastAPI app + CORS
- `app/routers/session.py` - Session endpoints
- `app/routers/admin.py` - Admin endpoints (sessions, reviews)
- `app/routers/skill_admin.py` - Skill evolution endpoints
- `app/services/llm.py` - Gemini + Claude fallback
- `app/services/skill_evolution.py` - Expert feedback → rule generation
- `app/services/whisper.py` - STT transcription
- `app/prompts/templates.py` - LLM prompts

## Interview Modes

| Mode | Flow | Questions | Use Case |
|------|------|-----------|----------|
| **Quick** | 3 rounds × 3 questions | Batch per round | Fast ~5 min interview |
| **Precise** | Single question at a time | AI-generated follow-ups | Thorough ~10 min consultation |

- Precise mode uses state machine: `idle → recording → processing → confirming → transitioning → idle`
- AI generates contextual follow-ups using full conversation history, falls back to predefined question bank

## Skill Evolution System

LLM-driven continuous improvement from expert feedback:
1. **Expert reviews sessions** → rates questions, suggests improvements
2. **Generate rules** → LLM analyzes feedback patterns, creates actionable rules
3. **Approve/reject rules** → admin curates generated rules
4. **Create skill version** → LLM integrates approved rules into skill document
5. **Activate version** → new skill used for future interviews

Tables: `skill_versions` (versioned skill content), `skill_learned_rules` (generated rules with approval status)

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev        # localhost:3000
npm test           # Run Jest tests
npm run build      # Build for production

# Deployment (auto-deploy enabled on git push)
git add . && git commit -m "message" && git push  # Auto-deploys to Vercel
npx vercel --prod  # Manual deployment (if needed)
```

### Backend (on VPS)
```bash
ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252
cd /opt/agent-brain
source venv/bin/activate
systemctl restart agent-brain
journalctl -u agent-brain -f
```

## Important Notes

- **Backend shared**: VPS serves multiple frontend projects via same API endpoints
- **Auto-deploy**: GitHub push to master triggers Vercel deployment automatically
- **Backend proxy**: Vercel rewrites `/api/backend/*` to `http://65.108.246.252:8000/*` (see vercel.json)
- **LLM fallback**: Gemini -> Claude on 429/503/UNAVAILABLE errors
- **Whisper model**: "small" for speed (was "medium")
- **Reports**: Stored in Lithuanian, translated on demand
- **Admin key**: Stored in localStorage, re-verified against backend on every page load (prevents stale/invalid keys)
- **CORS**: Allows Vercel frontend + localhost:3000

## Documentation

- **Admin Guide**: See `docs/admin-guide.md` for detailed explanation of brain configuration (slots, questions, risk rules, scoring)

## Gotchas

- **API URL fallback**: Use `/api/backend` (not `localhost:8000`) as fallback in `lib/api.ts` - `.env.local` isn't deployed to Vercel
- **Test assertions**: Drift when UI text changes - update `__tests__/` assertions to match component implementation
- **Backend file edits**: Use `scp` to upload Python scripts, then run remotely - avoids shell escaping issues with heredocs
- **Function evolution**: Use `_v2` suffix for backend function updates to avoid breaking existing callers during transition
- **Next.js SSR hydration**: `usePathname()` returns null on server - wrap conditional rendering with `const [mounted, setMounted] = useState(false)` pattern

## SQLAlchemy + asyncpg Patterns

These patterns are CRITICAL for backend PostgreSQL operations:

| Issue | Wrong | Correct |
|-------|-------|---------|
| Type casting | `:param::jsonb` | `CAST(:param AS jsonb)` |
| Array params | `ANY(:ids)` | `ANY(CAST(:ids AS int[]))` |
| jsonb columns | `json.loads(row[n])` | `row[n] if isinstance(row[n], dict) else json.loads(row[n])` |
| Same param twice | `CASE WHEN :p ... :p` | Calculate in Python, pass separate params |

**Why**: SQLAlchemy uses `:name` for params, conflicting with PostgreSQL's `::` cast. asyncpg returns jsonb as dicts and can't infer array types.

## i18n Translation Patterns

- **Static UI text**: Use `lib/translations/` files + `useTranslation()` hook with `t('key.path')`
- **Dynamic content** (questions, summaries): Call `POST /translate` endpoint, cache results
- **React state for translations**: Use `Record<string, string>` NOT `Map` - React doesn't detect Map changes properly
- **Async state coordination**: Use `pendingTransition` flag to wait for translation before state transitions (prevents skeleton flash)
- **Language storage**: `localStorage.getItem('pirtis-language')` - used by both LanguageProvider and loading-messages.ts
