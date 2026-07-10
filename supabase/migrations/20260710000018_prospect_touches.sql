-- Multi-touch cadence (Olímpia pattern, adapted): track how many outbound
-- touches a prospect has received. 0 = never contacted, 1 = intro template,
-- 2 = D+3 bump. Any inbound reply moves status to 'replied' and permanently
-- excludes the prospect from further touches.
alter table prospects add column if not exists touches int not null default 0;

-- Backfill: everyone already contacted got exactly the intro.
update prospects set touches = 1 where send_status = 'sent' and touches = 0;
