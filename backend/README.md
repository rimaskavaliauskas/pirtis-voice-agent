# Voice Agent Backend

FastAPI backend for the Sauna Design Interview Voice Agent.

## Quick Start

### 1. Set up environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your settings
# Required: ANTHROPIC_API_KEY
```

### 2. Start services

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Wait for healthy status
docker compose ps
```

### 3. Run migrations

```bash
# Connect to PostgreSQL and run migrations
docker exec -i agent_postgres psql -U agent -d agentbrain < migrations/001_brain_tables.sql
docker exec -i agent_postgres psql -U agent -d agentbrain < migrations/002_session_tables.sql
```

### 4. Import brain config

```bash
# Set environment variables
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=agentbrain
export PGUSER=agent
export PGPASSWORD=agentbrain_secure_2024

# Import YAML config
python scripts/import_brain_config.py config/brain_config.seed.yaml
```

### 5. Install Python dependencies

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

### 6. Run the server

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/session/start` | Start new interview session |
| POST | `/session/{id}/transcribe` | Transcribe audio to text |
| POST | `/session/{id}/answer` | Submit confirmed answers |
| POST | `/session/{id}/finalize` | Generate final report |
| GET | `/session/{id}/state` | Get session state (debug) |
| GET | `/session/{id}/results` | Get completed session results |

### Admin (Brain Config)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/brain/config/export` | Export config as YAML |
| POST | `/brain/config/validate` | Validate YAML config |
| POST | `/brain/config/import` | Import YAML config |

**Note:** Admin endpoints require `X-Admin-Key` header.

## VPS Deployment

### Copy files to VPS

```bash
# From your local machine
scp -r -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" \
  backend/ root@65.108.246.252:/opt/agent-brain/
```

### On VPS

```bash
# SSH to VPS
ssh -i "D:\AI\aleksandro kursas\SSHKEY\id_ed25519" root@65.108.246.252

# Install Python 3.11
apt update
apt install python3.11 python3.11-venv python3.11-dev ffmpeg -y

# Set up
cd /opt/agent-brain
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env from example
cp .env.example .env
nano .env  # Add your ANTHROPIC_API_KEY
```

### Systemd Service

Create `/etc/systemd/system/agent-brain.service`:

```ini
[Unit]
Description=Agent Brain FastAPI
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/agent-brain
Environment="PATH=/opt/agent-brain/venv/bin"
EnvironmentFile=/opt/agent-brain/.env
ExecStart=/opt/agent-brain/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable agent-brain
systemctl start agent-brain
systemctl status agent-brain
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings
│   ├── database.py          # DB connection
│   ├── models.py            # Pydantic models
│   ├── routers/
│   │   ├── session.py       # /session/* endpoints
│   │   └── admin.py         # /brain/config/* endpoints
│   ├── services/
│   │   ├── whisper.py       # Speech-to-text
│   │   ├── llm.py           # Claude API
│   │   ├── scoring.py       # Question selection
│   │   ├── risk.py          # Risk detection
│   │   └── brain.py         # Config loader
│   └── prompts/
│       └── templates.py     # LLM prompts
├── config/
│   └── brain_config.seed.yaml
├── migrations/
│   ├── 001_brain_tables.sql
│   └── 002_session_tables.sql
├── scripts/
│   └── import_brain_config.py
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `ANTHROPIC_API_KEY` | Claude API key | *required* |
| `ADMIN_API_KEY` | Admin endpoint protection | `change-this` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:3000` |
| `WHISPER_MODEL` | Whisper model size | `medium` |
