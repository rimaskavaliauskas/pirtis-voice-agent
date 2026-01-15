# Deployment Guide

## Infrastructure

| Component | Location | Access |
|-----------|----------|--------|
| Frontend | Vercel | Auto-deploys from GitHub |
| Backend | Hetzner VPS | SSH + systemd service |
| Database | VPS (Docker) | PostgreSQL 16 |

## VPS Access

### SSH Connection

```bash
ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252
```

### VS Code Remote SSH

Add to `~/.ssh/config`:
```
Host agent-brain-vps
    HostName 65.108.246.252
    User root
    IdentityFile D:/AI/aleksandro kursas/SSHKEY/id_ed25519
```

Then: VS Code > Remote-SSH > Connect to Host > `agent-brain-vps`

## Backend Deployment

### Service Management

```bash
# Restart backend
systemctl restart agent-brain

# Check status
systemctl status agent-brain

# View logs (live)
journalctl -u agent-brain -f

# View recent logs
journalctl -u agent-brain --since "10 minutes ago"
```

### File Locations (VPS)

```
/opt/agent-brain/
├── app/
│   ├── main.py
│   ├── routers/
│   ├── services/
│   └── prompts/
├── migrations/
├── venv/
└── .env
```

### Deploy Code Changes

```bash
# From local machine - upload file
scp -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" backend/app/services/llm.py root@65.108.246.252:/opt/agent-brain/app/services/

# Then restart service
ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252 "systemctl restart agent-brain"

# Verify
ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252 "journalctl -u agent-brain -f"
```

### Verify Syntax After Upload

```bash
# On VPS - check Python syntax
cd /opt/agent-brain
source venv/bin/activate
python3 -c 'from app.services.llm import call_llm; print("OK")'
```

## Database Management

### PostgreSQL Container

```bash
# Container name: agent_postgres
# User: agent
# Database: agentbrain

# Check container status
docker ps | grep postgres

# Connect to database
docker exec -it agent_postgres psql -U agent -d agentbrain

# Run SQL file
cat migration.sql | docker exec -i agent_postgres psql -U agent -d agentbrain

# Backup database
docker exec agent_postgres pg_dump -U agent agentbrain > backup.sql
```

### Run Migrations

```bash
# Upload migration
scp -i "KEY" backend/migrations/003_missing_schema.sql root@65.108.246.252:/opt/agent-brain/migrations/

# Run migration
ssh -i "KEY" root@65.108.246.252 "cat /opt/agent-brain/migrations/003_missing_schema.sql | docker exec -i agent_postgres psql -U agent -d agentbrain"
```

### Common Queries

```sql
-- List all tables
\dt

-- Check skill versions
SELECT id, version, name, is_active, created_at FROM skill_versions ORDER BY created_at DESC;

-- Check pending rules
SELECT id, rule_type, confidence_score, approved FROM skill_learned_rules WHERE approved = FALSE;

-- Count expert reviews
SELECT COUNT(*) FROM expert_reviews;

-- Recent sessions
SELECT session_id, language, mode, created_at FROM sessions ORDER BY created_at DESC LIMIT 10;
```

## Frontend Deployment

### Automatic Deployment

Frontend auto-deploys when pushing to `master` branch:

```bash
cd frontend
git add .
git commit -m "description"
git push origin master
# Vercel deploys automatically
```

### Manual Deployment

```bash
cd frontend
npx vercel --prod
```

### Environment Variables (Vercel)

Set in Vercel project settings:
- `NEXT_PUBLIC_API_URL` - Backend URL (optional, defaults to proxy)

### Backend Proxy

`vercel.json` rewrites `/api/backend/*` to `http://65.108.246.252:8000/*`:

```json
{
  "rewrites": [
    { "source": "/api/backend/:path*", "destination": "http://65.108.246.252:8000/:path*" }
  ]
}
```

## Troubleshooting

### Backend Won't Start

```bash
# Check logs for errors
journalctl -u agent-brain -n 100

# Check if port is in use
lsof -i :8000

# Check Python environment
cd /opt/agent-brain
source venv/bin/activate
python -c "import fastapi; print('OK')"
```

### Database Connection Issues

```bash
# Check if container is running
docker ps | grep postgres

# Restart container
docker restart agent_postgres

# Check container logs
docker logs agent_postgres --tail 50
```

### LLM Quota Errors

If seeing 429 errors from Gemini:
1. Check quota in Google Cloud Console
2. Claude fallback should handle automatically
3. If both fail, wait for quota reset

### Frontend Build Errors

```bash
cd frontend
npm run build  # Check for TypeScript errors locally first
```

## Code Sync Workflow

**VPS is source of truth for backend**. When making changes:

1. Edit on VPS (via VS Code Remote or direct SSH)
2. Test changes (`systemctl restart agent-brain`)
3. Sync back to local:
   ```bash
   scp -i "KEY" root@65.108.246.252:/opt/agent-brain/app/services/file.py backend/app/services/
   ```
4. Commit locally:
   ```bash
   cd backend
   git add .
   git commit -m "Sync from VPS: description"
   ```

## Quick Reference

| Task | Command |
|------|---------|
| SSH to VPS | `ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252` |
| Restart backend | `systemctl restart agent-brain` |
| View logs | `journalctl -u agent-brain -f` |
| Upload file | `scp -i "KEY" local remote:/path` |
| DB shell | `docker exec -it agent_postgres psql -U agent -d agentbrain` |
| Deploy frontend | `git push origin master` (auto) or `npx vercel --prod` |
