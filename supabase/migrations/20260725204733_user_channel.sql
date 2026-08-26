-- Which transport the farmer actually talks to Stevi on ('twilio' | 'cloud').
-- Stamped on every inbound. Proactive alerts MUST route through this channel:
-- the audit found crons hard-coding TwilioAdapter, so a Cloud-acquired farmer
-- got alerts from a different number (identity break) or nothing at all.
-- NULL = legacy row from before stamping → falls back to Twilio (sandbox era).
alter table users add column if not exists channel text;
