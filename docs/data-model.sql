create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists founders (
  id uuid primary key default gen_random_uuid(),
  identity_key text unique not null,
  name text,
  source text check (source in ('inbound', 'outbound_github', 'outbound_tavily', 'voice_intake')),
  founder_score numeric,
  founder_score_trend text check (founder_score_trend in ('improving', 'stable', 'declining')),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid references founders(id) on delete cascade,
  claim text not null,
  source_url text,
  source_snippet text,
  trust_score numeric check (trust_score >= 0 and trust_score <= 1),
  evidence_type text check (evidence_type in ('known_signal', 'statistical_association', 'no_signal')),
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid references founders(id) on delete cascade,
  axis text not null check (axis in ('founder', 'market', 'idea_vs_market')),
  score numeric check (score >= 0 and score <= 100),
  trend text,
  rationale text,
  created_at timestamptz default now()
);

create table if not exists contradictions (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid references founders(id) on delete cascade,
  claim_a text not null,
  claim_b text not null,
  explanation text not null,
  status text not null default 'unresolved' check (status in ('unresolved', 'resolved')),
  created_at timestamptz default now()
);

create table if not exists trace_events (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  agent text not null,
  step text not null,
  message text not null,
  evidence_ref text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  ts timestamptz default now()
);

create index if not exists founders_identity_key_idx on founders(identity_key);
create index if not exists evidence_founder_id_idx on evidence(founder_id);
create index if not exists scores_founder_id_idx on scores(founder_id);
create index if not exists contradictions_founder_id_idx on contradictions(founder_id);
create index if not exists trace_events_run_id_idx on trace_events(run_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists founders_set_updated_at on founders;
create trigger founders_set_updated_at
before update on founders
for each row execute function set_updated_at();

-- Manual dashboard step:
-- In Supabase, enable Realtime for public.trace_events and public.founders
-- from Database -> Replication.
