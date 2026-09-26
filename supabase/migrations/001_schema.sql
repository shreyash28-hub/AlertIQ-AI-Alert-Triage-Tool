-- AlertIQ database schema: tables, indexes, RLS policies.
-- Run once in the Supabase project's SQL Editor (or via `supabase db push`).

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- Asset inventory ------------------------------------------------------------
create table assets (
  host text primary key,
  type text not null,
  owner text not null,
  criticality int not null check (criticality between 1 and 10)
);

-- One row per "Run triage" ----------------------------------------------------
create table triage_runs (
  run_id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  total_alerts int not null default 0,
  total_incidents int not null default 0,
  duration_ms int
);

-- Raw synthetic alerts ---------------------------------------------------------
create table alerts (
  alert_id text primary key,
  run_id uuid references triage_runs (run_id) on delete cascade,
  timestamp timestamptz not null,
  source text not null,
  alert_type text not null,
  severity int not null check (severity between 1 and 5),
  host text references assets (host),
  user_name text not null,
  src_ip inet,
  dest_ip inet,
  raw_message text,
  -- hidden ground-truth label, used only to measure detection accuracy
  -- (blueprint's data design flags this as a required field the original
  -- schema sketch was missing)
  is_true_positive boolean not null default false
);
create index idx_alerts_host_time on alerts (host, timestamp);
create index idx_alerts_user_time on alerts (user_name, timestamp);

-- Output of the triage engine ---------------------------------------------------
create table incidents (
  incident_id text primary key,
  run_id uuid references triage_runs (run_id) on delete cascade,
  -- title, alert_count, primary_user, start/end time and analyst_note were
  -- all missing from the blueprint's original table sketch; added here to
  -- match backend/models.py's Incident shape, which the app actually uses.
  title text not null,
  primary_host text references assets (host),
  primary_user text,
  alert_count int not null default 0,
  start_time timestamptz,
  end_time timestamptz,
  techniques text[] not null default '{}',
  tactics text[] not null default '{}',
  risk_score numeric(5, 1) not null,
  risk_level text not null check (risk_level in ('Critical', 'High', 'Medium', 'Low')),
  ai_brief text,
  status text not null default 'New'
    check (status in ('New', 'Confirmed', 'False positive', 'Escalated')),
  analyst_note text,
  decided_at timestamptz,
  -- demo-only ground truth (did this incident contain a planted attack
  -- alert?), used purely to compute the Metrics page's detection-accuracy
  -- numbers; a real deployment would not have this column
  contains_planted_attack boolean not null default false
);
create index idx_incidents_risk_score on incidents (risk_score desc);

-- Which alerts belong to which incident -------------------------------------------
create table incident_alerts (
  incident_id text references incidents (incident_id) on delete cascade,
  alert_id text references alerts (alert_id) on delete cascade,
  primary key (incident_id, alert_id)
);

-- Analyst display info --------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'analyst'
);

-- Human-in-the-loop audit trail -------------------------------------------------------
create table decisions (
  id uuid primary key default gen_random_uuid(),
  incident_id text references incidents (incident_id) on delete cascade,
  analyst_id uuid references auth.users (id),
  decision text not null check (decision in ('confirmed', 'false_positive', 'escalated')),
  note text,
  decided_at timestamptz not null default now()
);

-- Row Level Security ------------------------------------------------------------------
alter table assets enable row level security;
alter table alerts enable row level security;
alter table triage_runs enable row level security;
alter table incidents enable row level security;
alter table incident_alerts enable row level security;
alter table profiles enable row level security;
alter table decisions enable row level security;

-- Any logged-in analyst can read everything except other people's profiles.
create policy "read_authenticated" on assets for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on alerts for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on triage_runs for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on incidents for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on incident_alerts for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on decisions for select using (auth.role() = 'authenticated');
create policy "read_own_profile" on profiles for select using (auth.uid() = id);
create policy "update_own_profile" on profiles for update using (auth.uid() = id);

-- No insert/update policy exists for assets, alerts, triage_runs, incidents
-- or incident_alerts for the anon/authenticated roles, so an ordinary
-- logged-in analyst cannot write to them directly. Only the backend (using
-- the service_role key, which bypasses RLS entirely) writes those tables.

-- An analyst may record a decision, but only under their own user id.
create policy "insert_own_decision" on decisions for insert
  with check (auth.uid() = analyst_id);

-- Auto-create a profile row when a new analyst signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'analyst');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Gap fix: the frontend must move an incident to Confirmed / False positive
-- / Escalated the moment an analyst records a decision, but only the
-- backend's service key may write to `incidents` directly (see above).
-- Rather than opening a wider incidents-write policy for every analyst
-- -- which would let anyone edit any incident's score, brief, or anything
-- else -- a SECURITY DEFINER trigger on `decisions` performs the one
-- narrow update `incidents` actually needs, on the analyst's behalf.
create function public.apply_decision_to_incident()
returns trigger as $$
begin
  update public.incidents
  set
    status = case new.decision
      when 'confirmed' then 'Confirmed'
      when 'false_positive' then 'False positive'
      when 'escalated' then 'Escalated'
    end,
    analyst_note = new.note,
    decided_at = new.decided_at
  where incident_id = new.incident_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_decision_insert
  after insert on decisions
  for each row execute function public.apply_decision_to_incident();

-- Realtime: let the dashboard subscribe to live changes.
alter publication supabase_realtime add table incidents;
alter publication supabase_realtime add table decisions;
