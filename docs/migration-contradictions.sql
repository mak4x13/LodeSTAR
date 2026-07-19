create table if not exists contradictions (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid references founders(id) on delete cascade,
  claim_a text not null,
  claim_b text not null,
  explanation text not null,
  status text not null default 'unresolved' check (status in ('unresolved', 'resolved')),
  created_at timestamptz default now()
);

create index if not exists contradictions_founder_id_idx on contradictions(founder_id);
