-- Area-mean NDVI: field-health now samples a grid of pixels around the pin, so
-- we cache the spread (uniformity signal) and how many pixels resolved alongside
-- the mean. Additive + nullable — old cached rows keep working (read as a plain
-- point read, samples treated as 1).
alter table public.farm_derived add column if not exists ndvi_std numeric;
alter table public.farm_derived add column if not exists ndvi_samples int;
