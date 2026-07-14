-- Growth loops (flight plan S1):
--  - users.source: acquisition attribution captured from the first message's
--    "vim pelo <nome>"/#token — splits every cohort into vouchado vs orgânico
--    (the scorecard's gate variable). First-wins; never overwritten.
--  - users.referral_prompted_at: last time the farmer got the referral nudge
--    (≥14-day cooldown enforced in code).
alter table public.users add column if not exists source text;
alter table public.users add column if not exists referral_prompted_at timestamptz;
