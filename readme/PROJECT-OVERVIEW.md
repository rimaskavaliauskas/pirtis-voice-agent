# Pirtis Voice Agent - Project Overview

AI-powered voice interview system for personalized sauna (pirtis) design recommendations.

## What It Does

Conducts voice interviews with clients to gather sauna design requirements through:
- **3 rounds x 3 questions** (Quick mode) or single-question follow-ups (Precise mode)
- **Slot extraction** - structured data from natural language responses
- **Risk detection** - identifies conflicts (e.g., winter use without water plan)
- **Report generation** - personalized markdown report with recommendations

## Architecture

```
Frontend (Vercel)                    Backend (Hetzner VPS 65.108.246.252)
Next.js 16 + shadcn/ui          -->  FastAPI + Uvicorn
                                     |
                                     +-- PostgreSQL 16 (Docker)
                                     +-- Whisper STT (small model, local)
                                     +-- Gemini API (primary LLM)
                                     +-- Claude API (fallback LLM)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React, TypeScript, Tailwind, shadcn/ui |
| Backend | FastAPI, Python 3.11, asyncpg |
| Database | PostgreSQL 16 (Docker container) |
| STT | OpenAI Whisper (small model, runs locally on VPS) |
| LLM | Google Gemini (primary) + Anthropic Claude (fallback) |
| Hosting | Vercel (frontend), Hetzner VPS (backend) |

## Key Features

### 1. Interview Modes
- **Quick Mode**: 3 rounds x 3 questions (~5 min)
- **Precise Mode**: Single question with AI-generated follow-ups (~10 min)

### 2. Skill Evolution System
LLM-driven continuous improvement from expert feedback:
1. Expert reviews completed sessions
2. LLM generates improvement rules from feedback patterns
3. Admin approves/rejects generated rules
4. LLM integrates approved rules into skill document
5. New skill version activated for future interviews

### 3. Brain Configuration
YAML-based configuration for:
- Interview slots (what data to collect)
- Question bank (20+ questions with priorities)
- Risk rules (conflict detection)
- Scoring weights (question selection algorithm)

## Repository Structure

```
voice-agent/
├── frontend/                 # Next.js frontend (deployed to Vercel)
│   ├── app/                  # Next.js app router pages
│   ├── components/           # React components
│   └── lib/                  # API client, types, utilities
│
├── backend/                  # FastAPI backend (deployed to VPS)
│   ├── app/
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # Business logic
│   │   └── prompts/          # LLM prompt templates
│   └── migrations/           # PostgreSQL migrations
│
└── readme/                   # Documentation (you are here)
```

## URLs

| What | Where |
|------|-------|
| Frontend | https://pirtis-voice-agent.vercel.app |
| Admin Panel | https://pirtis-voice-agent.vercel.app/admin |
| Backend API | http://65.108.246.252:8000 |

## Related Documentation

- [Backend Architecture](./BACKEND-ARCHITECTURE.md) - API endpoints and services
- [Skill Evolution System](./SKILL-EVOLUTION-SYSTEM.md) - Expert review workflow
- [Deployment Guide](./DEPLOYMENT-GUIDE.md) - VPS access and deployment

## Historical Documentation

Original planning documents from December 2025 are archived in `./archive-2025-12/`. These describe the initial vision but are outdated - refer to current documentation instead.
