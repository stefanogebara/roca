-- Quantas vezes já tentamos furar o atendimento automático deste prospect.
-- Duas tentativas educadas, depois o lead é parqueado para um humano decidir.
-- O número 2 veio da evidência: em 28/jul o "1" mandado no menu da Agro.com
-- trouxe o Felipe Augusto, o primeiro humano da campanha. Desistir na primeira
-- resposta automática teria matado esse lead.
alter table public.prospects
  add column if not exists porteiro_tentativas integer not null default 0;

comment on column public.prospects.porteiro_tentativas is
  'Tentativas de furar atendimento automático. Ao atingir PORTEIRO_MAX o agente é desligado e o lead espera um humano.';
