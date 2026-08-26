-- Normaliza `users.wa_id` para a forma canônica: só dígitos, com código do país,
-- sem `+`.
--
-- O Twilio entrega `whatsapp:+5511…` (o adapter tira o prefixo e sobra `+5511…`)
-- e a Meta entrega `5511…`. Como `upsertUser` gravava o valor cru, o MESMO
-- produtor viraria DUAS linhas dependendo do transporte, com histórico,
-- culturas, fazenda e consentimento LGPD divididos entre elas — e quem voltasse
-- num rollback apareceria como usuário novo, sem consentimento registrado.
--
-- Medido antes de rodar (03/ago/2026): 19 linhas, 6 com `+` (era Twilio), 13 sem
-- (Cloud), e ZERO colisões após normalizar. Por isso este UPDATE não precisa de
-- merge de linhas nem decidir qual consentimento vence — nenhum par se encontra.
--
-- As tabelas filhas referenciam `users.id` (uuid), não o wa_id, então nada é
-- órfão por esta mudança.
--
-- Sem CHECK constraint de propósito: uma restrição rígida aqui transformaria um
-- formato inesperado em upsert recusado, e `upsertUser` devolvendo null faz o
-- pipeline responder a desculpa ao produtor. Trocar número torto por resposta
-- que não chega é o mau negócio que este repo já aprendeu a não fazer. A
-- garantia vive em canonicalWaId() (api/_lib/db.ts), com teste.

update public.users
set wa_id = regexp_replace(wa_id, '\D', '', 'g')
where wa_id <> regexp_replace(wa_id, '\D', '', 'g');
