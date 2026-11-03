import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Search, Loader2, MapPin, AlertTriangle, ExternalLink } from 'lucide-react';
import { HOUSEHOLD_DROPOFFS } from '../data/householdDropoffs';
import {
  DropoffCategory,
  DropoffPlace,
  DropoffServiceError,
  fetchDropoffs,
  geocode,
} from '../utils/dropoffSearch';

interface DropoffMapProps {
  /** A drop-off id from the guide; when it names a category the map starts on it. */
  initialCategory?: string | null;
}

type Status = 'idle' | 'locating' | 'loading' | 'done' | 'error';

interface Origin {
  lat: number;
  lon: number;
  label: string;
}

const CATEGORIES: DropoffCategory[] = ['clothing', 'ewaste', 'softplastics'];
const isCategory = (id: string | null | undefined): id is DropoffCategory => !!id && (CATEGORIES as string[]).includes(id);

// Australia, until the person shares or searches a location.
const DEFAULT_CENTER: L.LatLngTuple = [-25.3, 133.8];
const DEFAULT_ZOOM = 4;
const LIST_LIMIT = 8;

const directionsUrl = (p: DropoffPlace) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

function popupContent(place: DropoffPlace): HTMLElement {
  const root = document.createElement('div');
  root.style.minWidth = '160px';
  const add = (tag: string, text: string, style?: string) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (style) el.setAttribute('style', style);
    root.appendChild(el);
    return el;
  };
  add('strong', place.name, 'display:block;font-size:14px');
  add('span', place.kind, 'display:block;color:#57534e;font-size:12px');
  if (place.address) add('span', place.address, 'display:block;margin-top:4px;font-size:12px');
  if (place.hours) add('span', `Hours: ${place.hours}`, 'display:block;margin-top:4px;font-size:12px');

  const links = document.createElement('div');
  links.style.marginTop = '6px';
  links.style.fontSize = '12px';
  const link = (href: string, text: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.marginRight = '10px';
    links.appendChild(a);
  };
  link(directionsUrl(place), 'Directions');
  if (place.website) link(place.website, 'Website');
  root.appendChild(links);
  return root;
}

const DropoffMap: React.FC<DropoffMapProps> = ({ initialCategory }) => {
  const [category, setCategory] = useState<DropoffCategory>(isCategory(initialCategory) ? initialCategory : 'clothing');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [placeQuery, setPlaceQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [places, setPlaces] = useState<DropoffPlace[]>([]);
  const [retryTick, setRetryTick] = useState(0);
  // Only a failed map lookup can be retried; location and place-search errors need a new input.
  const [retryable, setRetryable] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const markersById = useRef<Map<string, L.Marker>>(new Map());
  const cache = useRef<Map<string, DropoffPlace[]>>(new Map());

  // Follow the guide when a search result points at a different drop-off.
  useEffect(() => {
    if (isCategory(initialCategory)) setCategory(initialCategory);
  }, [initialCategory]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markerLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerLayer.current = null;
      markersById.current.clear();
    };
  }, []);

  // Look up places whenever the area or category changes.
  useEffect(() => {
    if (!origin) return;
    const key = `${category}|${origin.lat.toFixed(3)}|${origin.lon.toFixed(3)}|${radiusKm}`;
    const cached = cache.current.get(key);
    if (cached) {
      setPlaces(cached);
      setStatus('done');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setMessage('');
    setRetryable(false);
    fetchDropoffs(category, origin, radiusKm, controller.signal)
      .then(found => {
        cache.current.set(key, found);
        setPlaces(found);
        setStatus('done');
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setPlaces([]);
        setStatus('error');
        setRetryable(true);
        setMessage(
          err instanceof DropoffServiceError
            ? 'The map data service is busy right now. Please try again in a moment.'
            : 'Could not load drop-off locations. Check your connection and try again.'
        );
      });
    return () => controller.abort();
  }, [origin, category, radiusKm, retryTick]);

  // Draw the places on the map.
  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersById.current.clear();

    const emoji = HOUSEHOLD_DROPOFFS.find(d => d.id === category)?.emoji ?? '📍';
    const icon = L.divIcon({
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -14],
      html: `<div style="width:34px;height:34px;border-radius:9999px;background:#fff;border:2px solid #0f766e;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 1px 4px rgba(0,0,0,.35)">${emoji}</div>`,
    });

    const points: L.LatLngTuple[] = [];
    for (const place of places) {
      const marker = L.marker([place.lat, place.lon], { icon, title: place.name }).bindPopup(popupContent(place));
      marker.addTo(layer);
      markersById.current.set(place.id, marker);
      points.push([place.lat, place.lon]);
    }

    if (origin) {
      L.circleMarker([origin.lat, origin.lon], {
        radius: 8,
        color: '#1d4ed8',
        fillColor: '#3b82f6',
        fillOpacity: 0.9,
        weight: 3,
      })
        .bindTooltip('Your search area')
        .addTo(layer);
      points.push([origin.lat, origin.lon]);
    }

    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
    else if (origin) map.setView([origin.lat, origin.lon], 13);
  }, [places, origin, category]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Your browser cannot share its location. Search for a suburb or postcode instead.');
      return;
    }
    setStatus('locating');
    setMessage('');
    setRetryable(false);
    navigator.geolocation.getCurrentPosition(
      pos => setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' }),
      err => {
        setStatus('error');
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Search for a suburb or postcode instead.'
            : 'Could not get your location. Search for a suburb or postcode instead.'
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  }, []);

  const searchPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = placeQuery.trim();
    if (!q) return;
    setStatus('locating');
    setMessage('');
    setRetryable(false);
    try {
      const hit = await geocode(q);
      if (!hit) {
        setStatus('error');
        setMessage(`No place found for "${q}". Try a suburb name or postcode.`);
        return;
      }
      setOrigin({ lat: hit.lat, lon: hit.lon, label: hit.label });
    } catch {
      setStatus('error');
      setMessage('Place search is unavailable right now. Try again, or use your location.');
    }
  };

  const focusPlace = (place: DropoffPlace) => {
    const map = mapRef.current;
    const marker = markersById.current.get(place.id);
    if (!map || !marker) return;
    map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
    marker.openPopup();
    containerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const active = HOUSEHOLD_DROPOFFS.find(d => d.id === category);
  const busy = status === 'locating' || status === 'loading';

  return (
    <div id="dropoff-map-section" className="mt-8 rounded-3xl border border-stone-200 bg-white/75 p-5 sm:p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-xl font-extrabold text-stone-900">
          <MapPin className="w-5 h-5 text-teal-700" />
          Find a drop-off near you
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          Locations come from OpenStreetMap, which volunteers keep up to date. Coverage varies, so check opening hours
          and what is accepted before you go.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Drop-off type">
        {HOUSEHOLD_DROPOFFS.map(d => (
          <button
            key={d.id}
            id={`dropoff-cat-${d.id}`}
            type="button"
            aria-pressed={category === d.id}
            onClick={() => setCategory(d.id as DropoffCategory)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-colors ${
              category === d.id
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white/80 text-stone-800 border-stone-300 hover:bg-white'
            }`}
          >
            <span aria-hidden="true">{d.emoji}</span>
            {d.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <button
          id="dropoff-locate"
          type="button"
          onClick={locate}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold cursor-pointer transition-colors"
        >
          {status === 'locating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          Use my location
        </button>
        <form onSubmit={searchPlace} className="flex flex-1 gap-2">
          <input
            id="dropoff-place-input"
            type="text"
            value={placeQuery}
            onChange={e => setPlaceQuery(e.target.value)}
            placeholder="Or search a suburb or postcode"
            aria-label="Suburb or postcode"
            className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-stone-300 bg-white/90 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            id="dropoff-place-btn"
            type="submit"
            disabled={busy || !placeQuery.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white border border-stone-300 text-stone-800 font-semibold disabled:opacity-60 cursor-pointer transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
        <select
          id="dropoff-radius"
          value={radiusKm}
          onChange={e => setRadiusKm(Number(e.target.value))}
          aria-label="Search distance"
          className="px-3 py-2.5 rounded-xl border border-stone-300 bg-white/90 text-stone-800 font-semibold cursor-pointer"
        >
          <option value={5}>Within 5 km</option>
          <option value={10}>Within 10 km</option>
          <option value={25}>Within 25 km</option>
        </select>
      </div>
      <p className="text-xs text-stone-500 mb-3">
        Your location stays in your browser. Only the search area is sent to OpenStreetMap services to find places.
      </p>

      <div aria-live="polite" id="dropoff-status" className="min-h-[1.5rem] mb-2 text-sm">
        {busy && (
          <p className="flex items-center gap-2 text-stone-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            {status === 'locating' ? 'Finding your area…' : `Looking for ${active?.name.toLowerCase()} drop-offs…`}
          </p>
        )}
        {status === 'error' && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-red-900 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {message}
            </span>
            {origin && retryable && (
              <button
                id="dropoff-retry"
                type="button"
                onClick={() => setRetryTick(t => t + 1)}
                className="font-bold underline cursor-pointer"
              >
                Try again
              </button>
            )}
          </p>
        )}
        {status === 'done' && origin && (
          <p className="text-stone-700">
            {places.length > 0
              ? `${places.length} ${active?.name.toLowerCase()} location${places.length === 1 ? '' : 's'} within ${radiusKm} km of ${
                  origin.label === 'Your location' ? 'you' : origin.label.split(',').slice(0, 2).join(',')
                }.`
              : `No ${active?.name.toLowerCase()} locations are mapped within ${radiusKm} km.`}
          </p>
        )}
      </div>

      <div
        id="dropoff-map"
        ref={containerRef}
        role="application"
        aria-label="Map of drop-off locations"
        className="h-80 sm:h-96 w-full rounded-2xl border border-stone-300 overflow-hidden z-0"
      />

      {status === 'done' && places.length === 0 && (
        <div className="mt-3 text-sm text-stone-700 space-y-2" id="dropoff-empty">
          <p>
            OpenStreetMap may simply not have this mapped yet
            {category === 'softplastics' ? ', which is common for soft plastics drop-offs' : ''}. You can:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {radiusKm < 25 && (
              <li>
                <button
                  type="button"
                  onClick={() => setRadiusKm(radiusKm < 10 ? 10 : 25)}
                  className="font-semibold underline cursor-pointer"
                >
                  Search a wider area
                </button>
              </li>
            )}
            {category === 'softplastics' && <li>Check the entrance of a large supermarket near you for a collection bin.</li>}
            {category === 'ewaste' && <li>Ask your council about its resource recovery centre or tip.</li>}
            {category === 'clothing' && <li>Look for charity bins at op shops and shopping centres.</li>}
          </ul>
        </div>
      )}

      {places.length > 0 && (
        <ol id="dropoff-results" className="mt-4 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white/70">
          {places.slice(0, LIST_LIMIT).map(place => (
            <li key={place.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => focusPlace(place)}
                className="flex-1 min-w-0 text-left cursor-pointer"
                aria-label={`Show ${place.name} on the map`}
              >
                <span className="block font-semibold text-stone-900 truncate">{place.name}</span>
                <span className="block text-xs text-stone-600 truncate">
                  {place.kind}
                  {place.address ? ` · ${place.address}` : ''}
                </span>
              </button>
              <span className="text-sm font-semibold text-stone-700 whitespace-nowrap">
                {place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`}
              </span>
              <a
                href={directionsUrl(place)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                Directions
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default DropoffMap;
