# Deployment Guide (Backend + Vercel)

This project deploys in two parts:

1. `backend/` (FastAPI + Supabase persistence) on Render
2. `papergraph-ai/` (Next.js frontend) on Vercel

## 1) Deploy Backend on Render

### A. Create service

1. Go to Render Dashboard.
2. Click **New +** -> **Blueprint**.
3. Connect this GitHub repo.
4. Render will detect [`render.yaml`](./render.yaml).
5. Create the service.

### B. Set backend env vars in Render

Set these in Render (for Production):

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3-flash-preview`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_STORAGE_BUCKET=papers`
- `CORS_ORIGINS=https://<your-vercel-domain>`

### C. Verify backend

After deploy, open:

`https://<your-render-service>.onrender.com/health`

Expected:

`{"status":"ok"}`

---

## 2) Deploy Frontend on Vercel

### A. Import project

1. Go to Vercel -> **Add New Project**.
2. Import this GitHub repo.
3. Set **Root Directory** to `papergraph-ai`.
4. Framework: Next.js (auto-detected).
5. Deploy once.

### B. Set Vercel environment variables

In Vercel -> Project -> **Settings -> Environment Variables**, set:

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3-flash-preview`
- `GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview`
- `BACKEND_URL=https://<your-render-service>.onrender.com`
- `APP_ORIGIN=https://<your-vercel-domain>`
- `ALLOWED_APP_ORIGINS=https://<your-vercel-domain>`

Apply to **Production** (and Preview if needed), then redeploy.

---

## 3) Supabase Checklist

Confirm in your Supabase project:

- Storage bucket `papers` exists
- Tables exist: `projects`, `documents`, `graphs`, `qa_logs`
- Service role key is used for backend (`SUPABASE_KEY`)

---

## 4) Final Smoke Test

1. Open Vercel app URL.
2. Upload 2 PDFs.
3. Click **Extract**.
4. Confirm graph appears.
5. Open **Explain and Listen** and confirm Live works.
6. Ask a question; confirm backend persistence in Supabase.
