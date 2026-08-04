-- A triagem INCERTA é o dado de treino mais valioso, e era a única que não
-- deixava rastro.
--
-- `triage_events` tinha ZERO linhas em 04/ago. A gravação dependia do card
-- visual, que só é emitido com praga identificada E confiança não-baixa — regra
-- de PRODUTO (não mostrar veredito fraco com cara de firme), que virou regra de
-- DADO sem ninguém decidir isso. O comentário no pipeline descreve um moat que
-- "compounds"; o moat estava vazio.
--
-- `pest` passa a aceitar null: a linha significa "uma foto foi triada, e eis o
-- que se concluiu — possivelmente nada". Sem isto o caso mais informativo (não
-- consegui identificar) continua impossível de registrar.
--
-- Ninguém lê esta tabela ainda além do insert, então não há consumidor para
-- quebrar. Quando houver, `pest is null` quer dizer "triada, sem identificação".

alter table public.triage_events
  alter column pest drop not null;

comment on column public.triage_events.pest is
  'Praga/doença identificada, ou NULL quando a triagem não concluiu. NULL é dado, não ausência de dado.';
