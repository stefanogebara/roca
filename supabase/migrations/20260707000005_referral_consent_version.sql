-- Store which consent-copy version the farmer opted into, so the opt-in is
-- provable (LGPD accountability). Recommended by the referral legal review.
alter table public.referral_requests add column if not exists consent_version text;
