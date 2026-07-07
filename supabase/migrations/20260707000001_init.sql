-- Roça — initial schema (dossier Part 6.5).
-- Minimal, LGPD-conscious: store only what earns its keep. Precise coordinates
-- are sensitive; keep access to the service role only.

create extension if not exists "pgcrypto";

-- Farmers, keyed by WhatsApp id.
create table if not exists public.users (
  id               uuid primary key default gen_random_uuid(),
  wa_id            text not null unique,
  name             text,
  state            text,                       -- UF, e.g. 'MT'
  consent_lgpd_at  timestamptz,                -- set when consent is confirmed
  created_at       timestamptz not null default now()
);

-- One farm per user for v1 (point location; polygon later).
create table if not exists public.farms (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  lat            double precision,
  lon            double precision,
  crop           text[],                       -- ['soja','milho','pastagem']
  irrigated      boolean,
  planting_date  date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id)
);

-- Cached derived data (soil/climate change slowly). Never block a reply on a
-- refresh; read cache, refill on TTL.
create table if not exists public.farm_derived (
  farm_id              uuid primary key references public.farms(id) on delete cascade,
  soil_json            jsonb,
  climate_normals_json jsonb,
  latest_ndvi          double precision,
  fetched_at           timestamptz not null default now()
);

-- Message log. Stateful-in-DB so compute stays stateless per message.
create table if not exists public.messages (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.users(id) on delete cascade,
  direction            text not null check (direction in ('in','out')),
  kind                 text not null,          -- text|voice|image|location
  raw                  text,
  transcript           text,
  intent               text,
  provider_message_id  text,
  created_at           timestamptz not null default now()
);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

-- Keep farms.updated_at fresh on upsert.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists farms_touch_updated_at on public.farms;
create trigger farms_touch_updated_at
  before update on public.farms
  for each row execute function public.touch_updated_at();

-- RLS: all access is via the service role (server-only) for now. Enable RLS with
-- no public policies so the anon key can't read farmer data.
alter table public.users        enable row level security;
alter table public.farms        enable row level security;
alter table public.farm_derived enable row level security;
alter table public.messages     enable row level security;
