-- prospects + prospect_optouts were the only two tables created without RLS
-- (migration 15) — and they hold the most sensitive third-party data in the
-- schema: scraped business names/phones and the opt-out blocklist. All app
-- access uses the service-role key (which bypasses RLS), so enabling it here
-- changes nothing for the code; it locks out the anon/publishable key,
-- matching every other table's posture (RLS on, zero policies).
alter table public.prospects enable row level security;
alter table public.prospect_optouts enable row level security;
