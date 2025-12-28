# Pirtis Voice Agent

AI-powered voice interview system for personalized sauna (pirtis) design recommendations.

## Quick Reference

| What | Where |
|------|-------|
| **Frontend URL** | https://pirtis-voice-agent.vercel.app |
| **Admin Panel** | https://pirtis-voice-agent.vercel.app/admin |
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
GET  /brain/config/export        - Export YAML config
POST /brain/config/import        - Import YAML config
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
npm run build      # Build for production
npx vercel --prod  # Deploy to Vercel
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

- Backend uses LLM fallback: Gemini -> Claude on 429 errors
- Whisper model is "small" for speed (was "medium")
- Reports are stored in Lithuanian, translated on demand
- Admin key stored in localStorage on frontend
- CORS allows Vercel frontend + localhost:3000

## Recent Updates (voice agent review)

- Backend: added context-rich history (agent questions logged) and combined answers include question text to improve LLM extraction; asked_question_ids now set when questions are served.
- Backend: added /session/{id}/download and /session/{id}/translate endpoints; audio uploads now size-limited via MAX_AUDIO_BYTES; Whisper/Claude calls run in threads to avoid blocking async loop; Claude model is configurable via ANTHROPIC_MODEL.
- Frontend: results page no longer shows mock report on failure—surfaces error instead; download/translate buttons now hit real endpoints.
- Env: new vars in backend/.env.example `ANTHROPIC_MODEL`, `MAX_AUDIO_BYTES`; adjust your .env accordingly.
