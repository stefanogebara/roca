-- Quando o enriquecimento TENTOU este prospect — não quando achou.
--
-- Sem esta marca, o enriquecimento não tem como distinguir "ainda não olhei"
-- de "olhei e não achou número citado". As duas situações têm `wa_phone` nulo,
-- então toda rodada varria a base inteira de novo e gastava requisição
-- rebuscando os mesmos contatos que já haviam falhado — enquanto os realmente
-- novos esperavam atrás deles.
--
-- Nulo quer dizer "nunca tentado". Carimbar na TENTATIVA e não no sucesso é o
-- ponto: é o fracasso que precisa ser lembrado.
--
-- ── Sobre este arquivo ──────────────────────────────────────────────────────
-- Reconstruído em 04/ago a partir do schema real. A migration foi aplicada em
-- 31/jul direto pelo MCP (versão 20260731195546 no banco) e o arquivo nunca
-- chegou ao repo.

alter table public.prospects add column if not exists enrich_tried_at timestamptz;

comment on column public.prospects.enrich_tried_at is
  'Quando o enriquecimento tentou este prospect (mesmo sem achar). NULL = nunca tentado.';
