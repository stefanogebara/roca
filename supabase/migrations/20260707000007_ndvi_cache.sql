-- Cache the latest Sentinel-2 NDVI per farm. latest_ndvi already exists on
-- farm_derived (reserved earlier); add the scene date and a fetch timestamp so
-- we can TTL the cache (NDVI changes over weeks, and satellite calls are slow).
alter table public.farm_derived add column if not exists ndvi_date date;
alter table public.farm_derived add column if not exists ndvi_fetched_at timestamptz;
