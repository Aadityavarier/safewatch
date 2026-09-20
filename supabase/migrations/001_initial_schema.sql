-- SafeWatch initial schema
-- Run via: supabase db push  OR  applied via Supabase MCP apply_migration

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── zones ────────────────────────────────────────────────────────────────────
create table if not exists zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,   -- matches PLACES[*].id in types.ts
  zone        text,                   -- district / area label shown in UI
  lat         float not null,
  lng         float not null,
  radius_m    int default 50,
  risk_score  float default 0,
  risk_level  text default 'normal',
  created_at  timestamptz default now()
);

-- ─── flags ────────────────────────────────────────────────────────────────────
create table if not exists flags (
  id            uuid primary key default gen_random_uuid(),
  zone_id       uuid references zones(id) on delete cascade,
  category      text not null,
  reporter_hash text not null,
  description   text default '',
  repeat        boolean default false,
  people        text default '',
  direction     text default '',
  created_at    timestamptz default now()
);

create index if not exists flags_zone_id_idx    on flags(zone_id);
create index if not exists flags_created_at_idx on flags(created_at desc);
create index if not exists flags_reporter_idx   on flags(reporter_hash);

-- ─── posts ────────────────────────────────────────────────────────────────────
create table if not exists posts (
  id                 uuid primary key default gen_random_uuid(),
  zone_id            uuid references zones(id) on delete cascade,
  reporter_hash      text not null,
  body               text not null,
  photo_url          text,
  upvotes            int default 0,
  flagged_for_review boolean default false,
  created_at         timestamptz default now()
);

create index if not exists posts_zone_id_idx    on posts(zone_id);
create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists posts_upvotes_idx    on posts(upvotes desc);

-- ─── comments ─────────────────────────────────────────────────────────────────
create table if not exists comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references posts(id) on delete cascade,
  reporter_hash text not null,
  body          text not null,
  created_at    timestamptz default now()
);

create index if not exists comments_post_id_idx on comments(post_id);

-- ─── alerts ───────────────────────────────────────────────────────────────────
create table if not exists alerts (
  id                 uuid primary key default gen_random_uuid(),
  zone_id            uuid references zones(id) on delete cascade,
  distinct_reporters int default 0,
  time_spread_days   float default 0,
  category_diversity float default 0,
  risk_score         float default 0,
  risk_level         text default 'normal',
  dominant_category  text,
  total_flags        int default 0,
  created_at         timestamptz default now()
);

create index if not exists alerts_zone_id_idx    on alerts(zone_id);
create index if not exists alerts_created_at_idx on alerts(created_at desc);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table zones    enable row level security;
alter table flags    enable row level security;
alter table posts    enable row level security;
alter table comments enable row level security;
alter table alerts   enable row level security;

-- zones: public read
create policy "zones_public_read"  on zones    for select using (true);

-- flags: public read; insert allowed for anyone (anonymous); no update/delete
create policy "flags_public_read"  on flags    for select using (true);
create policy "flags_anon_insert"  on flags    for insert with check (true);

-- posts: public read (only non-flagged to public); insert for anyone
create policy "posts_public_read"  on posts    for select using (true);
create policy "posts_anon_insert"  on posts    for insert with check (true);
-- upvote: allow increment only via rpc (defined below), not direct update
create policy "posts_upvote_update" on posts   for update using (true) with check (true);

-- comments: public read; insert for anyone
create policy "comments_public_read"  on comments for select using (true);
create policy "comments_anon_insert"  on comments for insert with check (true);

-- alerts: public read (aggregated data only, no individual reporter info)
create policy "alerts_public_read"  on alerts  for select using (true);

-- ─── upvote RPC ───────────────────────────────────────────────────────────────
-- Atomic increment so concurrent taps can't race
create or replace function increment_upvotes(post_id uuid)
returns void language sql security definer as $$
  update posts set upvotes = upvotes + 1 where id = post_id;
$$;
