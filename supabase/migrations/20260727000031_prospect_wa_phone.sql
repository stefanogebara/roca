-- prospects: o número CONFIRMADO no WhatsApp (não necessariamente um celular).
--
-- Nasceu como `mobile_phone` na manhã de 27/jul, sob a premissa de que só
-- celular tem WhatsApp. Falso: WhatsApp Business aceita linha fixa (verificação
-- por chamada de voz). A evidência veio no mesmo dia — o site da coccamig
-- publica wa.me/553532142166, que é exatamente o "fixo" que tínhamos, e o
-- envio para ele NÃO voltou 131026 (inalcançável) e sim 131042 (cobrança).
--
-- O nome novo diz a verdade: é o número que temos motivo POSITIVO para crer
-- que recebe WhatsApp, seja celular ou fixo com wa.me publicado. A prova mora
-- em wa_phone_source e é obrigatória — sem fonte citada, o número não é usado.
alter table public.prospects rename column mobile_phone to wa_phone;
alter table public.prospects rename column mobile_source to wa_phone_source;
alter index if exists public.prospects_mobile_idx rename to prospects_wa_phone_idx;

comment on column public.prospects.wa_phone is
  'Número confirmado no WhatsApp (celular OU fixo com wa.me publicado). Preferido ao phone do Places no disparo.';
comment on column public.prospects.wa_phone_source is
  'URL/evidência de onde o wa_phone foi visto. Obrigatório — sem fonte, o número não é enviável.';
