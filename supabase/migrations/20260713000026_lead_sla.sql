-- Lead SLA + outcome loop (flight plan S1):
--  - sla_alerted_at: a lead whose partner was notified >24h ago with no reply
--    pages the founder ONCE (the stamp is the dedup).
--  - outcome / lead_grade: the partner's read on each handed-off lead
--    ("atendido", "fechado", "não respondeu" / "bom", "fraco") — Michel's
--    grading loop; feeds the paid-ask evidence.
alter table public.referral_requests add column if not exists sla_alerted_at timestamptz;
alter table public.referral_requests add column if not exists outcome text;
alter table public.referral_requests add column if not exists lead_grade text;
