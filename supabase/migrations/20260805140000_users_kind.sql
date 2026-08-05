-- `users` passa a distinguir PRODUTOR de EMPRESA.
--
-- Contexto (05/ago): o bug do nono dígito fazia a resposta de um prospect cair
-- no fluxo de produtor, criando linha em `users` para revenda, consultoria e
-- software de agro. Onze empresas entraram assim, e contavam em WAU, retenção
-- D7 e caderno como se fossem produtores. A Corpal Tratores sozinha responde por
-- 1672 mensagens (o loop de 03/ago).
--
-- Por que MARCAR e não apagar: as linhas são a evidência do próprio incidente, e
-- apagar histórico para consertar métrica troca um problema por outro. Marcado,
-- o dado continua auditável e some só de onde não devia estar.
--
-- Default 'produtor' porque é o que a esmagadora maioria é, e porque um default
-- que exigisse decisão em cada insert vira NULL na primeira pressa.
--
-- NÃO usar "wa_id de 12 dígitos" como critério de empresa: a Gaia Tech tem 12
-- dígitos e é INDICAÇÃO legítima (source='michel', "Oi! Vim pelo Michel"). O
-- tamanho do wa_id é o sintoma do WhatsApp antigo da pessoa, não a natureza
-- dela. O critério é ter sido contatada como prospect.

alter table public.users
  add column if not exists kind text not null default 'produtor';

alter table public.users
  drop constraint if exists users_kind_check;
alter table public.users
  add constraint users_kind_check check (kind in ('produtor', 'empresa'));

comment on column public.users.kind is
  'produtor = quem a Stevi atende. empresa = prospect da Vitória que caiu aqui por engano; fora de toda métrica de tração.';

create index if not exists users_kind_idx on public.users (kind) where kind <> 'produtor';
