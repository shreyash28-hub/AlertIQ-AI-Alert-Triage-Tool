# AlertIQ frontend

React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui, TanStack Query, React Router.

See the [project blueprint](../docs/AlertIQ_Project_Blueprint.docx) and [PROGRESS.md](../PROGRESS.md) for the full design.

## Run locally

```bash
npm install
copy .env.example .env    # then fill in the Supabase + API values
npm run dev                # http://localhost:5173
```

The backend (`../backend`) must be running for the Dashboard and Metrics
pages to load data.

## Layout

```
src/
  main.tsx           app entry (providers: React Query, Auth, Tooltip, Router)
  App.tsx             routes
  lib/
    api.ts            FastAPI client (triage, briefs, metrics)
    supabase.ts        Supabase client (login, RLS-protected reads/writes)
    auth.tsx           session context
  types/index.ts        TypeScript types mirroring backend/models.py
  components/
    AppLayout.tsx, Sidebar.tsx, ProtectedRoute.tsx
    ui/                 shadcn/ui primitives
  pages/
    Login.tsx           functional Supabase Auth sign-in
    Dashboard.tsx        real incident list (Phase 6 adds charts/filters/decisions)
    IncidentDetail.tsx    single incident (Phase 6 adds attack chain/timeline)
    Metrics.tsx           summary numbers (Phase 6 adds charts)
```

Design system note: the blueprint's folder sketch names `tailwind.config.ts`,
but `npm install tailwindcss` resolved to v4, which configures via the
`@tailwindcss/vite` plugin and CSS `@theme` blocks (see `src/index.css`)
instead of a JS config file. Same dark SOC theme, cyan accent, and risk
color scale the blueprint specifies - just current tooling.
