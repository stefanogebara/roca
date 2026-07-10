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

-- First partner: Michel Silva (Gaia Tech), validated 2026-07-09; coverage
-- confirmed 2026-07-10 as "Espera Feliz e região" (Caparaó / Zona da Mata MG).
insert into public.partners (name, phone, coverage_label, lat, lon, radius_km, crops)
values ('Michel Silva (Gaia Tech)', '+5532998003160', 'Espera Feliz e região (Caparaó/Zona da Mata)', -20.6504, -41.9086, 60, array['café'])
on conflict (phone) do nothing;
