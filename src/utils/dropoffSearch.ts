export type DropoffCategory = 'clothing' | 'ewaste' | 'softplastics';

export interface DropoffPlace {
  id: string;
  lat: number;
  lon: number;
  name: string;
  kind: string;
  address?: string;
  hours?: string;
  website?: string;
  distanceKm: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Public Overpass servers are volunteer run and often busy, so try them in turn.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const ATTEMPT_TIMEOUT_MS = 10000;

const RECYCLING_TAGS: Record<DropoffCategory, string[]> = {
  clothing: ['recycling:clothes'],
  ewaste: [
    'recycling:batteries',
    'recycling:electrical_appliances',
    'recycling:small_appliances',
    'recycling:computers',
    'recycling:mobile_phones',
  ],
  softplastics: ['recycling:plastic_bags', 'recycling:soft_plastics', 'recycling:plastic_film'],
};

/** Charity shops take clothes even when nobody has mapped a donation bin. */
const EXTRA_SELECTORS: Record<DropoffCategory, string[]> = {
  clothing: ['["shop"="charity"]'],
  ewaste: [],
  softplastics: [],
};

export function buildQuery(category: DropoffCategory, lat: number, lon: number, radiusM: number): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const selectors = [
    ...RECYCLING_TAGS[category].map(tag => `["amenity"="recycling"]["${tag}"="yes"]`),
    ...EXTRA_SELECTORS[category],
  ];
  return `[out:json][timeout:25];(${selectors.map(s => `nwr${s}${around};`).join('')});out center tags 120;`;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function describeKind(tags: Record<string, string>, category: DropoffCategory): string {
  if (tags.shop === 'charity') return 'Charity shop';
  if (tags.recycling_type === 'centre') return 'Recycling centre';
  if (tags.recycling_type === 'container') return 'Drop-off bin';
  return category === 'clothing' ? 'Clothing bin' : category === 'ewaste' ? 'E-waste / battery drop-off' : 'Soft plastics drop-off';
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [street, tags['addr:suburb'] || tags['addr:city']].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Only ever link to http(s) URLs: OSM tags are user-entered. */
function safeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeElements(
  elements: OverpassElement[],
  category: DropoffCategory,
  origin: { lat: number; lon: number }
): DropoffPlace[] {
  const seen = new Set<string>();
  const places: DropoffPlace[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tags = el.tags ?? {};
    const kind = describeKind(tags, category);
    places.push({
      id: key,
      lat,
      lon,
      name: tags.name || tags.operator || tags.brand || kind,
      kind,
      address: formatAddress(tags),
      hours: tags.opening_hours,
      website: safeUrl(tags.website || tags['contact:website']),
      distanceKm: haversineKm(origin.lat, origin.lon, lat, lon),
    });
  }
  return places.sort((a, b) => a.distanceKm - b.distanceKm);
}

export class DropoffServiceError extends Error {}

export async function fetchDropoffs(
  category: DropoffCategory,
  origin: { lat: number; lon: number },
  radiusKm: number,
  signal?: AbortSignal
): Promise<DropoffPlace[]> {
  const query = buildQuery(category, origin.lat, origin.lon, radiusKm * 1000);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener('abort', onOuterAbort);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data?.elements)) continue;
      return normalizeElements(data.elements, category, origin);
    } catch (err: any) {
      if (signal?.aborted) throw err;
      // timeout, network error or bad JSON: fall through to the next server
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onOuterAbort);
    }
  }
  throw new DropoffServiceError('The map data service is busy right now.');
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

/** Looks a suburb, postcode or address up with OpenStreetMap's Nominatim (one request per user search). */
export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new DropoffServiceError('Place search is unavailable right now.');
  const rows = await res.json();
  const first = Array.isArray(rows) ? rows[0] : null;
  if (!first) return null;
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, label: String(first.display_name || query) };
}
