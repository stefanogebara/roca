-- Terceiro tipo de linha em `users`: TESTE.
--
-- A contagem de produtores reais (05/ago) revelou que dos 12 "produtores", seis
-- eram "Simulador Roca" (fixtures do simulate-inbound), um era a própria
-- Vitória e um era "WhatsApp Business". Ferramenta de teste apontada para o
-- banco de produção deixa rastro, e esse rastro estava dentro de WAU, retenção
-- e caderno — mesma classe do problema das empresas, com origem diferente.
--
-- 'teste' e não 'empresa' porque a semântica importa para o dossiê: empresa é
-- prospect da Vitória que vazou; teste é a gente mesmo. O digest não precisa
-- mudar: o filtro dele já é "kind <> 'produtor'", então qualquer kind novo sai
-- da métrica sozinho.

alter table public.users drop constraint if exists users_kind_check;
alter table public.users
  add constraint users_kind_check check (kind in ('produtor', 'empresa', 'teste'));
