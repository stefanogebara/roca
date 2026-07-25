-- The data-moat minimum (loop iteration 6, 25/jul): every table below is tied
-- to a named payer/user of the data — nothing captured "just in case".
--
-- LGPD: aggregates must survive a titular's erasure → user refs are
-- `on delete set null`; any published aggregate needs k>=5 rows per bucket.

-- 1. Pest-triage events — the #1 moat dataset (was being thrown away in a card
--    URL). Product: pressure by crop × region × date + obs→action→outcome
--    pairs (what Kynetec sells via expensive interviews). Buyer: input
--    industry / resistance committees; also anchors the golden set.
create table if not exists triage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  farm_id uuid references farms(id) on delete set null,
  crop text,
  pest text not null,
  confidence text,
  uf text,
  -- Outcome of the +48h "resolveu?" follow-up (retention loop writes this).
  outcome text check (outcome in ('resolveu', 'nao_resolveu', 'sem_resposta')),
  outcome_at timestamptz,
  created_at timestamptz not null default now()
);
alter table triage_events enable row level security;
create index if not exists triage_events_crop_pest_idx on triage_events (crop, pest, created_at);

-- 2. Spray verdicts — dated proof "Stevi said don't spray" with class only
--    (v1: parsed from the reply). User: Proagro/perícia evidence for the
--    farmer, not a data product.
create table if not exists spray_verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  verdict text not null check (verdict in ('pode', 'atencao', 'nao', 'indefinido')),
  created_at timestamptz not null default now()
);
alter table spray_verdicts enable row level security;

-- 3. NDVI time series — farm_derived is a 1-row cache that DESTROYED history
--    on every refresh; season-long vigor evolution is the input for
--    "sua lavoura caiu 15% vs mês passado".
create table if not exists ndvi_readings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  ndvi double precision not null,
  std numeric,
  samples integer,
  scene_date date,
  fetched_at timestamptz not null default now()
);
alter table ndvi_readings enable row level security;
create index if not exists ndvi_readings_farm_idx on ndvi_readings (farm_id, fetched_at);

-- 4. Caderno fields that turn a log into a DOCUMENT (INC 02/2018 wants the
--    recommendation ref; certifiers want field + responsible; EUDR wants the
--    parcel location). Nullable — filled as the conversation captures them.
alter table applications add column if not exists field_label text;
alter table applications add column if not exists lat double precision;
alter table applications add column if not exists lon double precision;
alter table applications add column if not exists responsible text;
alter table applications add column if not exists recommendation_ref text;

-- 5. Referral outcomes — the only R$/lead comp that will ever exist (there is
--    no public market price; Michel's R$50 test is the experiment and THIS is
--    its measuring instrument).
alter table referral_requests add column if not exists outcome_code text;
alter table referral_requests add column if not exists outcome_at timestamptz;
alter table referral_requests add column if not exists graded_by text;

-- 6. Conversation-state expiry: a "sim" three weeks after "qual sua cultura?"
--    must not hit the stale prompt.
alter table users add column if not exists awaiting_set_at timestamptz;

-- 7. Indexes the code's real queries need (audit quick win): Meta status
--    callbacks update by wamid; purge/overview scan messages by created_at;
--    hasRecentReferral filters by user_id.
create index if not exists prospects_wamid_idx on prospects (wamid) where wamid is not null;
create index if not exists messages_created_at_idx on messages (created_at);
create index if not exists referral_requests_user_idx on referral_requests (user_id);
