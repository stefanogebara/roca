-- Partner network: licensed agronomists who receive consented farmer leads.
-- Matching is geographic (farm pin within radius of the partner's coverage
-- centroid) + optional crop overlap. Seeded with the first validated partner.
create table if not exists public.partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text not null unique,          -- E.164
  coverage_label text,                          -- human-readable ("Espera Feliz e região")
  lat            double precision,
  lon            double precision,
  radius_km      double precision not null default 60,
  crops          text[],
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.partners enable row level security;

-- Handoff lifecycle on the lead itself (LGPD: the farmer's explicit consent to
-- SHARE with a third party is separate from the referral opt-in, and stamped).
alter table public.referral_requests add column if not exists partner_id uuid references public.partners(id);
alter table public.referral_requests add column if not exists share_consent_at timestamptz;
alter table public.referral_requests add column if not exists partner_notified_at timestamptz;
alter table public.referral_requests add column if not exists delivered_at timestamptz;

-- Partners are seeded operationally (SQL editor / future ops action), never in
-- schema history: a migration is forever in git, and partner rows carry a real
-- person's name + personal phone. (This file originally seeded the first
-- partner; the seed was removed after being applied — the prod row is
-- operational data now, and fresh environments start with an empty table.)
