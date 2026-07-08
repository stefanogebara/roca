-- Agrônomo referral seed (the business-model seed). A farmer explicitly opts in
-- to be connected to a licensed agrônomo who can issue a receituário. LGPD:
-- captured only on explicit opt-in, minimized fields, consent timestamp stored.
create table if not exists public.referral_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  uf          text,                 -- state, for regional matching
  crop        text[],               -- what they grow
  topic       text,                 -- assunto/indício the farmer raised (never a "diagnosis")
  consent_at  timestamptz not null default now(),
  status      text not null default 'new',  -- new | contacted | closed
  created_at  timestamptz not null default now()
);

create index if not exists referral_requests_status_idx
  on public.referral_requests (status, created_at desc);

alter table public.referral_requests enable row level security;
