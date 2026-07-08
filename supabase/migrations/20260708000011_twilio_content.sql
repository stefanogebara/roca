-- Cache of Twilio Content API template SIDs, keyed by a hash of the button-set.
-- Quick-reply buttons on Twilio require a content template; in-session (24h
-- window) templates need no approval. We create each distinct button-set once
-- and reuse its SID forever (body text travels as a template variable).
create table if not exists public.twilio_content (
  hash        text primary key,
  content_sid text not null,
  buttons     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.twilio_content enable row level security;
