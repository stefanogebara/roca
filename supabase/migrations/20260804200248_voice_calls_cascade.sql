-- `voice_calls.prospect_id` nasceu NO ACTION. Duas coisas quebravam por isso, e
-- as duas em silêncio até a primeira ligação com prospect existir:
--
-- 1. LGPD. `deleteProspectByPhone` (o conserto de 04/ago para "apaga meus
--    dados") faria DELETE na mãe e tomaria violação de FK. O titular pediria
--    exclusão, a função devolveria false — e a TRANSCRIÇÃO da ligação dele
--    ficaria na base. É o mesmo defeito que o conserto daquele dia existia para
--    resolver, reaberto por outra porta.
--
-- 2. Retenção. O purge de `prospects` (achado #6) falharia inteiro no primeiro
--    prospect com ligação: um DELETE com filtro é uma operação só, e uma linha
--    presa derruba o lote.
--
-- Estava latente porque `voice_calls` tinha zero linhas quando isto foi escrito
-- — a integração de voz é de 04/ago. Latente, não inofensivo: o webhook está no
-- ar e liga a chamada ao prospect pelo telefone.
--
-- CASCADE e não SET NULL: a alternativa deixaria a transcrição órfã na base,
-- sem dono e sem como achar de novo — o pior dos dois mundos para um dado que a
-- pessoa pediu para apagar.

alter table public.voice_calls
  drop constraint if exists voice_calls_prospect_id_fkey;

alter table public.voice_calls
  add constraint voice_calls_prospect_id_fkey
  foreign key (prospect_id) references public.prospects(id) on delete cascade;
