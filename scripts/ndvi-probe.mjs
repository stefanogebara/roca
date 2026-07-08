/** Probe the free NDVI path: Earth Search STAC → latest low-cloud S2 scene →
 * titiler point (handles reprojection) for red(B04)+nir(B08) → NDVI. */
const lat = -12.545, lon = -55.721;
const STAC = 'https://earth-search.aws.element84.com/v1/search';
const TITILER = 'https://titiler.xyz/cog/point';

const since = new Date(Date.now() - 75 * 86400000).toISOString().slice(0, 10);
const body = {
  collections: ['sentinel-2-l2a'],
  bbox: [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02],
  datetime: `${since}T00:00:00Z/..`,
  query: { 'eo:cloud_cover': { lt: 40 } },
  sortby: [{ field: 'properties.eo:cloud_cover', direction: 'asc' }],
  limit: 1,
};
const r = await fetch(STAC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
console.log('STAC status', r.status);
const j = await r.json();
const item = j.features?.[0];
if (!item) { console.log('no scene'); process.exit(0); }
console.log('scene', item.id, 'date', item.properties.datetime, 'cloud', item.properties['eo:cloud_cover']);
const red = item.assets.red?.href, nir = item.assets.nir?.href;
console.log('red asset', red?.slice(0, 70));
async function pt(url) {
  const u = `${TITILER}/${lon},${lat}?url=${encodeURIComponent(url)}`;
  const res = await fetch(u);
  const jj = await res.json();
  return jj.values?.[0];
}
const [rv, nv] = await Promise.all([pt(red), pt(nir)]);
console.log('red', rv, 'nir', nv);
const ndvi = (nv - rv) / (nv + rv);
console.log('NDVI', ndvi.toFixed(3));
