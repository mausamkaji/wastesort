import React, { useMemo, useRef, useState } from 'react';
import { Search, Bot, Camera, ImagePlus, Loader2, X, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { WASTE_ITEMS } from '../data/wasteItems';
import { BinType, InspectionResult } from '../types';
import { toHouseholdPlacement } from '../utils/householdMapping';

type ToolTab = 'search' | 'ai';

interface ResultView {
  itemName: string;
  emoji?: string;
  primaryBin: BinType;
  context: string;
  prepInstructions: string[];
  whyItGoesHere: string;
  warning?: string;
  photoDataUrl?: string;
  unclear?: string;
}

const EXAMPLES = ['pizza box', 'banana peel', 'glass jar', 'chip packet', 'grass clippings'];

/** Scores catalog items against the query: name hit > tag hit > word hit. */
function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter(w => w.length >= 2);
  return WASTE_ITEMS
    .map(item => {
      const name = item.name.toLowerCase();
      let score = 0;
      if (name.includes(q)) score += 5;
      if (item.tags.some(t => t.toLowerCase() === q)) score += 4;
      if (item.tags.some(t => t.length >= 3 && (t.toLowerCase().includes(q) || q.includes(t.toLowerCase())))) score += 2;
      for (const w of words) {
        if (name.includes(w)) score += 1;
        if (item.tags.some(t => t.toLowerCase().includes(w))) score += 0.5;
      }
      return { item, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(r => r.item);
}

/** Downscales large photos so the request stays small. */
function compressImage(dataUrl: string, maxDim = 1280): Promise<string> {
  return new Promise(resolve => {
    if (!dataUrl.startsWith('data:image') || dataUrl.length < 400000) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) return resolve(dataUrl);
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const ResultCard: React.FC<{ result: ResultView }> = ({ result }) => {
  const placement = toHouseholdPlacement(result.primaryBin, result.context);
  const bin = placement.bin;

  return (
    <div className={`rounded-2xl border overflow-hidden ${bin ? bin.border : 'border-stone-300'} bg-white/80`}>
      <div className={`${bin ? bin.lid : 'bg-stone-600'} text-white px-4 py-3 flex items-center gap-3`}>
        <span className="text-2xl" aria-hidden="true">{bin ? bin.emoji : '📍'}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/80">{result.itemName}</p>
          <p className="text-lg font-extrabold leading-tight" data-testid="household-result-bin">
            {bin ? `${bin.name} bin` : 'Special disposal'}
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3 text-sm text-stone-700">
        {result.photoDataUrl && (
          <img src={result.photoDataUrl} alt="Inspected item" className="w-full max-h-48 object-cover rounded-xl border border-stone-200" />
        )}
        {result.unclear && (
          <p className="flex gap-2 text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{result.unclear}</span>
          </p>
        )}
        {placement.note && (
          <p className="flex gap-2 text-stone-800 bg-stone-100 border border-stone-200 rounded-xl px-3 py-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{placement.note}</span>
          </p>
        )}
        <p>{result.whyItGoesHere}</p>
        {result.prepInstructions.length > 0 && (
          <div>
            <p className="font-bold text-stone-900 mb-1">Before you bin it</p>
            <ul className="space-y-1">
              {result.prepInstructions.slice(0, 4).map(step => (
                <li key={step} className="flex gap-2">
                  <span className="text-emerald-600 shrink-0">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.warning && (
          <p className="flex gap-2 text-red-900 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{result.warning}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export const HouseholdTools: React.FC = () => {
  const [tab, setTab] = useState<ToolTab>('search');

  // Search tab
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const matches = useMemo(() => searchCatalog(submittedQuery), [submittedQuery]);

  // AI tab
  const [aiText, setAiText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ResultView | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  const runSearch = (q: string) => {
    setQuery(q);
    setSubmittedQuery(q.trim());
  };

  const askAi = (q: string) => {
    setAiText(q);
    setTab('ai');
  };

  const toResultView = (data: InspectionResult, photoDataUrl?: string): ResultView => ({
    itemName: data.itemName,
    primaryBin: data.primaryBin,
    context: `${data.itemName} ${(data.detectedMaterials || []).join(' ')}`,
    prepInstructions: data.prepInstructions || [],
    whyItGoesHere: data.whyItGoesHere,
    warning: data.wishcyclingWarning,
    photoDataUrl,
    unclear: data.isUnclear ? data.unclearReason || 'The AI was not fully sure what this is, so double-check before binning.' : undefined,
  });

  const inspectText = async () => {
    const itemName = aiText.trim();
    if (!itemName) return;
    setLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const res = await fetch('/api/inspect-waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'The AI Inspector could not check that item.');
      }
      setAiResult(toResultView(await res.json()));
    } catch (err: any) {
      setError(err?.message || 'Unable to reach the AI Inspector. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inspectPhoto = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const imageBase64 = await compressImage(photo);
      const res = await fetch('/api/inspect-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, userNotes: photoNote.trim() || undefined, enableGoogleSearch: true }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'The AI Inspector could not read that photo.');
      }
      setAiResult(toResultView(await res.json(), imageBase64));
    } catch (err: any) {
      setError(err?.message || 'Unable to analyse that photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onPhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhoto(ev.target?.result as string);
      setAiResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const tabClass = (active: boolean) =>
    `flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
      active
        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md'
        : 'text-stone-600 hover:text-stone-900 hover:bg-white/70'
    }`;

  return (
    <section id="household-tools" className="glass-strong rounded-3xl p-5 sm:p-7 mb-10">
      <div className="flex gap-2 mb-5 p-1 bg-stone-900/5 rounded-2xl sm:w-fit">
        <button id="household-tab-search" type="button" className={tabClass(tab === 'search')} onClick={() => setTab('search')}>
          <Search className="w-4 h-4" />
          Search
        </button>
        <button id="household-tab-ai" type="button" className={tabClass(tab === 'ai')} onClick={() => setTab('ai')}>
          <Bot className="w-4 h-4" />
          AI Inspector
        </button>
      </div>

      {tab === 'search' && (
        <div>
          <form
            onSubmit={e => {
              e.preventDefault();
              runSearch(query);
            }}
            className="flex gap-2"
          >
            <input
              id="household-search-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Which bin does it go in? e.g. pizza box"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-stone-300 bg-white/90 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              id="household-search-btn"
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {!submittedQuery && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>Try:</span>
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => runSearch(ex)}
                  className="px-2.5 py-1 rounded-full bg-white/70 border border-stone-200 text-stone-700 hover:bg-white cursor-pointer"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {submittedQuery && (
            <div className="mt-5 space-y-4" id="household-search-results">
              {matches.length > 0 ? (
                matches.map(item => (
                  <ResultCard
                    key={item.id}
                    result={{
                      itemName: `${item.emoji} ${item.name}`,
                      primaryBin: item.bin,
                      context: `${item.name} ${item.tags.join(' ')}`,
                      prepInstructions: item.prepInstructions,
                      whyItGoesHere: item.whyItGoesHere,
                      warning: item.wishcyclingWarning,
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-stone-600">No match for "{submittedQuery}" in the guide.</p>
              )}
              <button
                id="household-ask-ai"
                type="button"
                onClick={() => askAi(submittedQuery)}
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-xl cursor-pointer transition-colors"
              >
                <Bot className="w-4 h-4" />
                Not what you meant? Ask the AI Inspector about "{submittedQuery}"
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-5">
          <form
            onSubmit={e => {
              e.preventDefault();
              setPhoto(null);
              inspectText();
            }}
            className="flex gap-2"
          >
            <input
              id="household-ai-input"
              type="text"
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              placeholder="Describe any item, e.g. old pizza box with grease"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-stone-300 bg-white/90 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              id="household-ai-btn"
              type="submit"
              disabled={loading || !aiText.trim()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold cursor-pointer transition-colors"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Inspect</span>
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs font-semibold text-stone-400">
            <span className="h-px flex-1 bg-stone-300/70" />
            or use a photo
            <span className="h-px flex-1 bg-stone-300/70" />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              id="household-take-photo"
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white border border-stone-300 text-sm font-semibold text-stone-800 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              Take photo
            </button>
            <button
              id="household-upload-photo"
              type="button"
              onClick={() => uploadInput.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white border border-stone-300 text-sm font-semibold text-stone-800 cursor-pointer transition-colors"
            >
              <ImagePlus className="w-4 h-4" />
              Upload photo
            </button>
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />
            <input ref={uploadInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
          </div>

          {photo && (
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="relative shrink-0">
                <img src={photo} alt="Selected item" className="w-40 h-40 object-cover rounded-2xl border border-stone-300" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => {
                    setPhoto(null);
                    setAiResult(null);
                  }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 w-full space-y-3">
                <input
                  id="household-photo-note"
                  type="text"
                  value={photoNote}
                  onChange={e => setPhotoNote(e.target.value)}
                  placeholder="Optional: what is it? e.g. yoghurt tub"
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white/90 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  id="household-inspect-photo"
                  type="button"
                  onClick={inspectPhoto}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold cursor-pointer transition-colors"
                >
                  <Bot className="w-4 h-4" />
                  Inspect photo
                </button>
              </div>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-sm text-stone-600" role="status">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking with the AI Inspector…
            </p>
          )}
          {error && (
            <p className="flex gap-2 text-sm text-red-900 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          {aiResult && <ResultCard result={aiResult} />}
          {!aiResult && !loading && !error && (
            <p className="flex gap-2 text-xs text-stone-500">
              <Lightbulb className="w-4 h-4 shrink-0" />
              Results are matched to your four household bins. Anything that needs special disposal (batteries, e-waste, sharps) is flagged instead.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
