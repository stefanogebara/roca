-- Chamadas de voz do agente Vitória (ElevenLabs).
--
-- Este arquivo foi escrito DEPOIS da migration já estar aplicada em produção:
-- ela foi aplicada direto pelo MCP em 04/ago e o arquivo nunca chegou ao repo.
-- Reconstruído a partir do schema real do banco (colunas, índices, RLS), para
-- que `supabase/migrations/` volte a descrever o que existe. Sem isto o teste
-- que confere alvos de retenção contra as migrations enxerga um banco menor do
-- que o real — e a única coisa pior que não ter trava é ter uma trava cega.
--
-- É a única fonte de dado de terceiro com TRANSCRIÇÃO. `phone`, `summary`,
-- `transcript` e `analysis` são PII de quem atendeu a ligação.

create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  el_agent_id text,
  el_conversation_id text not null unique,
  status text,
  phone text,
  -- ON DELETE CASCADE não é detalhe de performance: apagar o prospect é
  -- obrigação legal (LGPD Art. 18), e a transcrição da ligação dele tem que ir
  -- junto. Ver 20260804210000_voice_calls_cascade.sql — nasceu NO ACTION, o que
  -- fazia o delete do titular falhar por violação de FK.
  prospect_id uuid references public.prospects(id) on delete cascade,
  duration_secs integer,
  cost_credits numeric,
  summary text,
  transcript jsonb,
  analysis jsonb,
  failure_reason text
);

create index if not exists idx_voice_calls_created on public.voice_calls (created_at desc);
create index if not exists idx_voice_calls_prospect on public.voice_calls (prospect_id) where prospect_id is not null;
create index if not exists voice_calls_phone_idx on public.voice_calls (phone);

alter table public.voice_calls enable row level security;
