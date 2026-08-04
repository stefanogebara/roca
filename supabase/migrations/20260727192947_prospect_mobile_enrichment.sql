-- Enriquecimento: o número que alguém CITOU como sendo de WhatsApp.
--
-- O `phone` vem do Places e é o telefone comercial do cadastro — muitas vezes
-- um fixo que ninguém atende no WhatsApp. Disparar para ele é palpite, e cada
-- palpite errado volta como 131026 (inalcançável), que é sinal negativo de
-- qualidade para a Meta NO MESMO número que atende produtor.
--
-- Estas duas colunas guardam a alternativa com prova: o número visto no site,
-- no Instagram ou num link wa.me, e a URL onde ele foi visto. A fonte é o que
-- separa "número confirmado" de "chute" — sem ela o número não é enviável (ver
-- `sendablePhone` em api/_lib/prospect/core.ts).
--
-- ── Sobre este arquivo ──────────────────────────────────────────────────────
-- Reconstruído em 04/ago a partir do schema real. A migration foi aplicada em
-- 27/jul direto pelo MCP (versão 20260727192947 no banco) e o arquivo nunca
-- chegou ao repo. Sem ele a cadeia QUEBRA num banco novo: o
-- 20260727194854_prospect_wa_phone.sql seguinte faz RENAME destas colunas, e
-- rename não tem o que renomear se o create nunca existiu.
--
-- Os nomes `mobile_*` são os originais e estão errados de propósito aqui: a
-- premissa da manhã de 27/jul era "só celular tem WhatsApp", desmentida no mesmo
-- dia (WhatsApp Business aceita fixo com verificação por voz — a coccamig
-- publica wa.me do próprio fixo). A migration seguinte corrige o nome. Manter o
-- erro aqui é o que faz o histórico bater; corrigir para trás faria o arquivo
-- mentir sobre o que rodou.

alter table public.prospects add column if not exists mobile_phone text;
alter table public.prospects add column if not exists mobile_source text;

create index if not exists prospects_mobile_idx
  on public.prospects (mobile_phone)
  where mobile_phone is not null;
