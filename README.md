# AlertIQ — AI Alert Triage Tool

Turns ~3,000 noisy security alerts a day into ~40 ranked incidents, each with a short AI-written brief, so one analyst can triage a shift in under 2 hours instead of 50.

Microsoft Hackathon, Advanced #25 — "3,000 Alerts, One Analyst".

Full design: [docs/AlertIQ_Project_Blueprint.docx](docs/AlertIQ_Project_Blueprint.docx)

## Stack

- **Backend:** Python, FastAPI, pandas (triage engine)
- **Database and login:** Supabase (PostgreSQL, Auth, Realtime)
- **AI:** Microsoft Phi-4-mini, running locally through Ollama
- **Frontend:** React, TypeScript, Vite, Tailwind, shadcn/ui, Motion
- **Hosting:** Azure Static Web Apps (frontend), Azure App Service (backend)

## Layout

```
backend/     Python triage engine + FastAPI
frontend/    React dashboard (created in Phase 5)
supabase/    Database schema and security rules
docs/        Project blueprint
```

## Run locally

```bash
# One-time: AI model
ollama pull phi4-mini

# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env    # then fill in the Supabase values
uvicorn main:app --reload # http://localhost:8000
```
