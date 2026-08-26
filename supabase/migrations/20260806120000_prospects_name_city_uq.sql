-- RECONSTRUÍDA a partir do banco em 2026-08-24, não do original.
--
-- Esta migration foi aplicada em produção e o arquivo nunca chegou ao repo — a
-- mesma falha que a 20260803192238 documenta e que o 8c88ea9 consertou em
-- 04/ago ("as migrations voltam a descrever o banco — e um banco novo volta a
-- subir"). Ela voltou a acontecer três vezes desde então.
--
-- A definição abaixo é a que o catálogo do Postgres reporta hoje, copiada
-- verbatim de pg_indexes. Idempotente: rodar num banco que já a tem é no-op.
create unique index if not exists prospects_name_city_uq
  on public.prospects using btree (lower(name), lower(coalesce(city, ''::text)));
