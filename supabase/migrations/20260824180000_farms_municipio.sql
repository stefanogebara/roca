-- Município da lavoura.
--
-- A Portaria SDA/MAPA do vazio sanitário subdivide 7 UFs por REGIÃO, e cada
-- região é definida por lista de municípios. Sem o município, o alerta proativo
-- só sabe dizer o envelope da UF ("varia por região, confirme"); com ele, sabe
-- a data daquele produtor e o dia certo de avisar.
--
-- O dado JÁ era capturado e descartado: `resolveStatedLocation` devolve
-- `{ lat, lon, city, uf }` e o pipeline persistia só lat/lon/UF. Quem manda pin
-- de GPS não passa por ali, e para esses a Stevi pergunta uma vez.
--
-- Nullable de propósito: produtor sem município cai no hedge, que é o
-- comportamento seguro e o que já está no ar.
alter table public.farms
  add column if not exists municipio text;

comment on column public.farms.municipio is
  'Município da lavoura, como o produtor disse ou como o geocoding resolveu. '
  'Alimenta a região do vazio sanitário (knowledge/vazio-regioes-2026.json). '
  'NULL = desconhecido: o alerta hedgeia em vez de cravar data.';

-- Só as UFs que a portaria subdivide precisam disso; índice parcial para não
-- pagar por linha que nunca será consultada por município.
create index if not exists farms_municipio_idx
  on public.farms (municipio)
  where municipio is not null;
