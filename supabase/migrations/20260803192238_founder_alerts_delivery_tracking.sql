-- O alarme que sabe se tocou.
--
-- Em 03/ago descobrimos que o canal de alerta da empresa estava morto havia
-- SEMANAS e ninguém percebeu: a API de mensagem devolve "accepted" e falha
-- depois, de forma assíncrona. Incidente de webhook, canário, LLM caindo e lead
-- quente apontavam todos para o mesmo cano mudo. "Aceito" não é "entregue", e
-- até aqui essa diferença era só boa intenção — nenhum código a representava.
--
-- O mecanismo que esta tabela sustenta:
--   1. todo alerta enviado por WhatsApp grava o `wamid`;
--   2. o callback de status da Meta (que já chega no nosso webhook) carimba
--      `delivered_at` — ou `error_detail`, quando ele diz que falhou;
--   3. uma varredura no cron pega o que passou da janela sem confirmação e
--      ESCALA por outro canal, carimbando `escalated_at`.
--
-- `wamid` é UNIQUE porque a Meta reentrega callback e o carimbo tem que ser
-- idempotente. Nulo é permitido: alerta entregue por webhook ou e-mail confirma
-- na própria chamada e não tem wamid nenhum — e em Postgres vários NULLs
-- convivem sob UNIQUE, que é exatamente o que se quer aqui.
--
-- O índice parcial é a consulta da varredura, e só ela: pendentes de verdade
-- (sem entrega e sem escalada) por ordem de chegada. Parcial porque a tabela
-- inteira é ruído para essa pergunta — o que já foi entregue nunca mais
-- interessa a ela.
--
-- ── Sobre este arquivo ──────────────────────────────────────────────────────
-- Reconstruído em 04/ago a partir do schema real (colunas, tipos, defaults,
-- índices, constraint UNIQUE, RLS). A migration foi aplicada em 03/ago direto
-- pelo MCP (versão 20260803192238 no banco) e o arquivo nunca chegou ao repo.
--
-- Sem FK para `users`: quem recebe alerta é founder, não produtor. O destino
-- mora em env (FOUNDER_WA_NUMBERS), não em tabela.

create table if not exists public.founder_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Id da mensagem no provedor. UNIQUE para o callback ser idempotente; NULL
  -- quando o canal confirma na própria chamada (webhook, e-mail).
  wamid text unique,
  canal text not null,
  texto text not null,
  delivered_at timestamptz,
  escalated_at timestamptz,
  error_detail text
);

-- A consulta da varredura de escalada, e só ela.
create index if not exists idx_founder_alerts_pendentes
  on public.founder_alerts (created_at)
  where delivered_at is null and escalated_at is null;

alter table public.founder_alerts enable row level security;
