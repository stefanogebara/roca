-- A prova do pedido de opt-out.
--
-- `prospect_optouts.reason` guardava a string fixa 'inbound opt-out' — uma
-- CATEGORIA, não uma evidência. E o texto do prospect não sobrava em lugar
-- nenhum: o ramo do opt-out retorna antes de registrar a thread.
--
-- Para LGPD o que sustenta o registro é a evidência do pedido, nas palavras de
-- quem pediu. `reason` segue sendo a categoria (de onde veio: inbound, painel,
-- exclusão); `verbatim` passa a ser o que a pessoa escreveu.
--
-- Esta tabela nunca é podada, de propósito — ver PURGE_TARGETS em db.ts. É a
-- prova legal e o filtro de envio ao mesmo tempo, e sobrevive à exclusão da
-- linha em `prospects` (não há FK entre as duas, também de propósito: apagar o
-- cadastro não pode ressuscitar o contato).

alter table public.prospect_optouts
  add column if not exists verbatim text;

comment on column public.prospect_optouts.verbatim is
  'Texto exato da mensagem em que a pessoa pediu para sair. Evidência do pedido (LGPD); truncado em 500 chars.';
