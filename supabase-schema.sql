create table if not exists public.profiles (
  wallet_address text primary key,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz default now()
);

create table if not exists public.activity_events (
  id bigserial primary key,
  wallet_address text,
  event_type text not null,
  page text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.portfolio_cache (
  wallet_address text primary key,
  positions jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.watchlists (
  wallet_address text not null,
  market_id integer not null,
  created_at timestamptz default now(),
  primary key (wallet_address, market_id)
);

alter table public.profiles enable row level security;
alter table public.activity_events enable row level security;
alter table public.portfolio_cache enable row level security;
alter table public.watchlists enable row level security;

create policy "Public profiles can be upserted"
  on public.profiles for insert
  with check (true);

create policy "Public profiles can be updated"
  on public.profiles for update
  using (true)
  with check (true);

create policy "Activity events can be inserted"
  on public.activity_events for insert
  with check (true);

create policy "Portfolio cache can be read"
  on public.portfolio_cache for select
  using (true);

create policy "Portfolio cache can be upserted"
  on public.portfolio_cache for insert
  with check (true);

create policy "Portfolio cache can be updated"
  on public.portfolio_cache for update
  using (true)
  with check (true);

create policy "Watchlists can be read"
  on public.watchlists for select
  using (true);

create policy "Watchlists can be inserted"
  on public.watchlists for insert
  with check (true);

create policy "Watchlists can be deleted"
  on public.watchlists for delete
  using (true);
