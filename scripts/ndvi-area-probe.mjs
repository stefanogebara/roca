/**
 * Live probe for the area-mean NDVI path (mirrors api/_lib/tools/ndvi.ts
 * fetchFieldNdvi). Finds the latest low-cloud S2 scene, samples a 3×3 grid of
 * independent pixels ~30 m apart, and aggregates to mean + population std +
 * resolved-pixel count. Prints the per-pixel grid so you can eyeball spread.
 *
 *   node scripts/ndvi-area-probe.mjs [lat] [lon]
 */
const lat = Number(process.argv[2] ?? -12.545);
const lon = Number(process.argv[3] ?? -55.721);

const STAC = 'https://earth-search.aws.element84.com/v1/search';
const TITILER = 'https://titiler.xyz/cog/point';
const SPACING_M = 30;
const RING = 1;
const CONCURRENCY = 5;

function gridPoints(lat, lon, spacingM, ring) {
  const dLat = spacingM / 111_320;
  const dLon = spacingM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const pts = [];
  for (let i = -ring; i <= ring; i++)
    for (let j = -ring; j <= ring; j++) pts.push([lat + i * dLat, lon + j * dLon]);
  return pts;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function pointValue(url, la, lo) {
  const res = await fetch(`${TITILER}/${lo},${la}?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const jj = await res.json();
  const v = jj.values?.[0];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const since = new Date(Date.now() - 75 * 86400000).toISOString().slice(0, 10);
const r = await fetch(STAC, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    collections: ['sentinel-2-l2a'],
    bbox: [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02],
    datetime: `${since}T00:00:00Z/..`,
    query: { 'eo:cloud_cover': { lt: 40 } },
    sortby: [{ field: 'properties.eo:cloud_cover', direction: 'asc' }],
    limit: 1,
  }),
});
const j = await r.json();
const item = j.features?.[0];
if (!item) {
  console.log('no scene');
  process.exit(0);
}
console.log(`scene ${item.id}  ${item.properties.datetime.slice(0, 10)}  cloud ${item.properties['eo:cloud_cover']}%`);
const red = item.assets.red?.href,
  nir = item.assets.nir?.href;

const pts = gridPoints(lat, lon, SPACING_M, RING);
const values = await mapWithConcurrency(pts, CONCURRENCY, async ([la, lo]) => {
  const [rv, nv] = await Promise.all([pointValue(red, la, lo), pointValue(nir, la, lo)]);
  if (rv == null || nv == null || rv + nv === 0) return null;
  return (nv - rv) / (nv + rv);
});

console.log('grid NDVI:', values.map((v) => (v == null ? ' — ' : v.toFixed(2))).join('  '));
const valid = values.filter((x) => x != null);
if (!valid.length) {
  console.log('no pixels resolved');
  process.exit(0);
}
const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
const std = Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length);
console.log(`area NDVI ~${mean.toFixed(2)}  std ${std.toFixed(3)}  samples ${valid.length}/${pts.length}`);
