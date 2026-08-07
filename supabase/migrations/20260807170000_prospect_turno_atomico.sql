-- O direito de FALAR vira uma reivindicação atômica.
--
-- `MIN_GAP_MS` (20s) e `podeFalarDeNovo` existem desde que a Vitória mandou
-- mensagens em rajada: duas mensagens do prospect chegam com segundos de
-- diferença, o webhook roda DUAS VEZES em paralelo, e cada invocação
-- legitimamente reivindica seu próprio inbound (claimInbound é por
-- provider_message_id, então não vê a outra).
--
-- O freio, porém, era lê-e-depois-escreve: cada invocação lia a thread ANTES de
-- qualquer uma gravar sua saída, então as duas viam "a última fala nossa foi há
-- 40 minutos" e as duas falavam. Medido em 06/ago com a ACAFEG:
--
--   19:42:55.696 in  "Sim"
--   19:42:57.560 in  "Oi"
--   19:43:02.397 out "Que bom falar com vocês! Hoje como chega a vocês um..."
--   19:43:08.919 out "Que bom! Como costuma chegar cliente novo pra vocês..."
--
-- A mesma pergunta, duas vezes, para o lead que tinha acabado de dizer "sim".
--
-- Esta coluna é o registro da reivindicação: quem consegue o UPDATE condicional
-- fala, quem não consegue cala. Mesmo padrão de `claimProspectForSend`, que já
-- resolve a corrida equivalente no disparo ("whoever claims a row first owns
-- it, the other MUST skip").

alter table public.prospects
  add column if not exists last_agent_out_at timestamptz;

comment on column public.prospects.last_agent_out_at is
  'Quando a agente reivindicou o turno pela última vez. UPDATE condicional serializa invocações concorrentes do webhook; ver claimAgentTurn.';
