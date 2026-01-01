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
| `/admin` | Brain configuration management |

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
```

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
- `app/routers/admin.py` - Admin endpoints
- `app/services/llm.py` - Gemini + Claude fallback
- `app/services/whisper.py` - STT transcription
- `app/prompts/templates.py` - LLM prompts

## User Flow

1. **Landing** - Select language (LT/EN/RU) -> Start Interview
2. **Session** - 3 rounds x 3 questions -> Voice recording -> Transcription -> Confirm
3. **Results** - View report -> Translate (EN/RU) -> Download

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
- **LLM fallback**: Gemini -> Claude on 429 errors
- **Whisper model**: "small" for speed (was "medium")
- **Reports**: Stored in Lithuanian, translated on demand
- **Admin key**: Stored in localStorage on frontend
- **CORS**: Allows Vercel frontend + localhost:3000

## Documentation

- **Admin Guide**: See `docs/admin-guide.md` for detailed explanation of brain configuration (slots, questions, risk rules, scoring)

## Gotchas

- **API URL fallback**: Use `/api/backend` (not `localhost:8000`) as fallback in `lib/api.ts` - `.env.local` isn't deployed to Vercel
- **Test assertions**: Drift when UI text changes - update `__tests__/` assertions to match component implementation
- Run `npm test` before deploying to catch assertion mismatches

## i18n Translation Patterns

- **Static UI text**: Use `lib/translations/` files + `useTranslation()` hook with `t('key.path')`
- **Dynamic content** (questions, summaries): Call `POST /translate` endpoint, cache results
- **React state for translations**: Use `Record<string, string>` NOT `Map` - React doesn't detect Map changes properly
- **Prevent wrong language flash**: Clear translation state immediately when content changes, show skeleton until translation completes
- **Language storage**: `localStorage.getItem('pirtis-language')` - used by both LanguageProvider and loading-messages.ts
