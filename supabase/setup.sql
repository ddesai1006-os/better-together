-- Better Together storage table. Run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.bt_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock the table down: row-level security on with no policies means the public
-- (anon) key can't read or write it. The app uses the server-only service-role key.
alter table public.bt_kv enable row level security;
