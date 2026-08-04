-- The Meta status callback carries the real reason a send failed (#131049
-- per-user marketing cap, #130497 cross-border, template paused...). The parser
-- already extracted it; nothing persisted it. On 21/jul, 16/16 sends failed
-- post-accept and the post-mortem could not name the cause six days later,
-- because the only copy of the error lived in a webhook we threw away.
alter table prospects add column if not exists wa_error text;

-- Failure forensics query the tail: last failures first.
create index if not exists prospects_wa_error_idx
  on prospects (updated_at desc)
  where wa_error is not null;
