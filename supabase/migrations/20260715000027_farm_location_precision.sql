-- Location precision (decouple "where the farmer is" from "where the field is").
-- A dropped WhatsApp pin is exact ('pin'); a location set by naming a city
-- geocodes to a coarse municipal centroid ('city'). NDVI/field-health refuses on
-- 'city' precision (a centroid is the town, not the talhão) and asks for the pin.
-- Existing rows are dropped pins → default 'pin'.
alter table public.farms
  add column if not exists location_precision text not null default 'pin';
