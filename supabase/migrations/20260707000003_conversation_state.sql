-- Lightweight conversation state: what Stevi is waiting for from this user
-- (e.g. 'crop' right after the farm card asks what they grow). Null = idle.
alter table public.users add column if not exists awaiting text;
