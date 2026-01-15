# Documentation Index

Welcome to the Pirtis Voice Agent documentation. Start here to understand the project.

## Getting Started

1. **[Project Overview](./PROJECT-OVERVIEW.md)** - Start here. Architecture, tech stack, key features.

2. **[Backend Architecture](./BACKEND-ARCHITECTURE.md)** - API endpoints, services, database schema.

3. **[Skill Evolution System](./SKILL-EVOLUTION-SYSTEM.md)** - Expert review workflow, rule generation, skill updates.

4. **[Deployment Guide](./DEPLOYMENT-GUIDE.md)** - VPS access, deployment commands, troubleshooting.

## Quick Links

| Resource | Link |
|----------|------|
| Frontend | https://pirtis-voice-agent.vercel.app |
| Admin Panel | https://pirtis-voice-agent.vercel.app/admin |
| Backend API | http://65.108.246.252:8000 |
| SSH Command | `ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252` |

## Changelog

Recent changes and fixes:

- **[2026-01-15 Backend Fixes](./CHANGELOG-2026-01-15.md)** - Database schema fixes, migration sync

## Archived Documentation

Historical planning documents from December 2025 are in `./archive-2025-12/`. These describe the initial vision but are outdated - the system has been fully implemented and evolved since then.

## For New Developers

If you're taking over this project:

1. Read [Project Overview](./PROJECT-OVERVIEW.md) first
2. Set up VPS access per [Deployment Guide](./DEPLOYMENT-GUIDE.md)
3. Review [Backend Architecture](./BACKEND-ARCHITECTURE.md) for endpoint reference
4. Check `CLAUDE.md` files in root and frontend folders for AI assistant context

## Project Structure

```
voice-agent/
├── frontend/           # Next.js (Vercel)
│   ├── CLAUDE.md       # Frontend-specific AI context
│   └── ...
├── backend/            # FastAPI (VPS)
│   └── ...
├── readme/             # Documentation (you are here)
│   ├── README.md       # This file
│   ├── PROJECT-OVERVIEW.md
│   ├── BACKEND-ARCHITECTURE.md
│   ├── SKILL-EVOLUTION-SYSTEM.md
│   ├── DEPLOYMENT-GUIDE.md
│   └── archive-2025-12/  # Old planning docs
└── CLAUDE.md           # Root AI context
```
