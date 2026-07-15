-- Caderno de aplicações — a structured record of what the farmer DECLARES they
-- already applied. Past-tense, farmer-owned data; this is a record, never a
-- prescription (product/dose choice stays with the agrônomo via receituário).
-- Feeds the application report (rastreabilidade). Values are stored AS DECLARED
-- — `dose_text` is verbatim and never normalized or recomputed — because a
-- record must reflect what the farmer said, not what the system thinks is right.
create table if not exists public.applications (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  farm_id            uuid references public.farms(id) on delete set null,
  applied_on         date not null,
  crop               text,            -- canonical key when resolvable, else as declared
  product_name       text,            -- brand, as declared
  active_ingredient  text,
  dose_text          text,            -- verbatim, e.g. '0,3 L/ha'
  area_ha            numeric,
  target             text,            -- pest/disease/weed named
  source             text not null,   -- 'declared_text' | 'declared_voice'
  raw_text           text,            -- original message, for audit + reparse
  created_at         timestamptz not null default now()
);

create index if not exists applications_user_applied_idx
  on public.applications (user_id, applied_on desc);

-- Service-role-only, like every other farmer-data table (RLS on, no public policy).
alter table public.applications enable row level security;
