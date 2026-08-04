-- Experimento PAREADO da Vitória: duas configurações rodando o mesmo caso.
--
-- O gym normal (`prospect_gym_runs`) mede uma configuração contra um juiz e
-- devolve nota. Isso responde "está bom?", não responde "esta mudança melhorou?"
-- — para isso é preciso comparar duas rodadas sobre os MESMOS casos, senão a
-- variação do sorteio de casos vira "melhora".
--
-- Foi este pareamento que desmentiu, em 29/jul, a justificativa de duas
-- tentativas do porteiro: a conversa que INSISTIA repetindo a mesma mensagem
-- perdeu para a que cessava. `run_a` e `run_b` apontam para as duas rodadas
-- comparadas; `placar` guarda o resultado agregado e `resultados` o caso a caso.
--
-- ── Sobre este arquivo ──────────────────────────────────────────────────────
-- Reconstruído em 04/ago a partir do schema real (colunas, tipos, defaults,
-- índice, RLS, FKs). A migration foi aplicada em 30/jul direto pelo MCP (versão
-- 20260730201006 no banco) e o arquivo nunca chegou ao repo.
--
-- As FKs ficam como estão no banco: sem ON DELETE. Uma rodada pareada não faz
-- sentido sem as rodadas que ela compara, então impedir o delete da rodada-filha
-- é o comportamento certo aqui — o oposto do que vale para `prospects`, onde
-- apagar é obrigação legal e nada pode bloquear.

create table if not exists public.prospect_gym_paired_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  run_a uuid not null references public.prospect_gym_runs(id),
  run_b uuid not null references public.prospect_gym_runs(id),
  placar jsonb not null,
  resultados jsonb not null default '[]'::jsonb
);

create index if not exists idx_gym_paired_ran_at
  on public.prospect_gym_paired_runs (ran_at desc);

alter table public.prospect_gym_paired_runs enable row level security;
