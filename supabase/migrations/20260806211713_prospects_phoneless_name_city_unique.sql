-- RECONSTRUÍDA a partir do banco em 2026-08-24, não do original.
-- Ver a nota em 20260806120000_prospects_name_city_uq.sql.
--
-- Atenção ao nome: a migration no histórico chama-se
-- `prospects_phoneless_name_city_unique`, mas o índice que ela criou é
-- `prospects_phoneless_name_city_uniq` (sem o "ue"). Mantido como está no banco.
create unique index if not exists prospects_phoneless_name_city_uniq
  on public.prospects using btree (lower(name), lower(coalesce(city, ''::text)))
  where phone is null;
