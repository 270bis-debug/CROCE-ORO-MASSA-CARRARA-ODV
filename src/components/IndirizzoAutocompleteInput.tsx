import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Navigation, Search, PlusCircle, RefreshCw, Compass } from 'lucide-react';
import { IndirizzoCollezionato } from '../types/adminTypes';
import { realtime } from '../services/realtime';

export interface RisultatoSelezioneIndirizzo {
  indirizzo: string;
  nome?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  googleMapsUri?: string;
  isNewOnline: boolean;
}

interface IndirizzoAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectAddress?: (info: RisultatoSelezioneIndirizzo) => void;
  onClear?: () => void;
  onBlurCommit?: (value: string) => void;
  knownAddresses: IndirizzoCollezionato[];
  vetStructures?: Array<{
    id: string;
    nome: string;
    indirizzoCompleto: string;
    comune?: string;
    h24?: boolean;
  }>;
  sediCroceOro?: Array<{
    id: string;
    nome: string;
    sezione?: string;
    indirizzoCompleto: string;
    coordinate?: { lat: number; lng: number };
  }>;
  placeholder?: string;
  accentTheme?: 'sky' | 'emerald';
  leftIcon?: 'pin' | 'nav';
  hasClearButton?: boolean;
}

interface OnlinePlaceResult {
  placeId?: string;
  displayName: string;
  formattedAddress: string;
  lat?: number;
  lng?: number;
  googleMapsUri?: string;
  typeLabel?: string;
  source: 'google_maps' | 'openstreetmap';
}

export const IndirizzoAutocompleteInput: React.FC<IndirizzoAutocompleteInputProps> = ({
  value,
  onChange,
  onSelectAddress,
  onClear,
  onBlurCommit,
  knownAddresses,
  vetStructures = [],
  sediCroceOro = [],
  placeholder = 'Digita indirizzo o nome struttura...',
  accentTheme = 'sky',
  leftIcon = 'pin',
  hasClearButton = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [aperto, setAperto] = useState(false);
  const [cercaOnlineForzato, setCercaOnlineForzato] = useState(false);
  const [inRicercaOnline, setInRicercaOnline] = useState(false);
  const [risultatiOnline, setRisultatiOnline] = useState<OnlinePlaceResult[]>([]);
  const lastQueriedRef = useRef<string>('');

  const query = value.trim();

  // Chiudi dropdown al clic esterno
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAperto(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Suggerimenti da indirizzi noti (Indirizzi Collezionati, Strutture Vet, Sedi Croce Oro)
  const suggerimentiNoti = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    const out: Array<{
      key: string;
      titolo: string;
      indirizzo: string;
      categoria: string;
      lat?: number;
      lng?: number;
      placeId?: string;
      googleMapsUri?: string;
    }> = [];

    for (const item of knownAddresses || []) {
      const ind = (item.indirizzo || '').trim();
      const nom = (item.nome || '').trim();
      if (!ind) continue;
      if (ind.toLowerCase().includes(q) || (nom && nom.toLowerCase().includes(q))) {
        const keyNorm = ind.toLowerCase();
        if (!seen.has(keyNorm)) {
          seen.add(keyNorm);
          out.push({
            key: `col-${item.id}`,
            titolo: nom || ind,
            indirizzo: ind,
            categoria: 'Indirizzo Collezionato',
            lat: item.lat,
            lng: item.lng,
            placeId: item.placeId,
            googleMapsUri: item.googleMapsUri
          });
        }
      }
    }

    for (const s of sediCroceOro || []) {
      const full = `${s.nome}, ${s.indirizzoCompleto}`;
      if (
        s.nome.toLowerCase().includes(q) ||
        (s.sezione && s.sezione.toLowerCase().includes(q)) ||
        s.indirizzoCompleto.toLowerCase().includes(q)
      ) {
        const keyNorm = full.toLowerCase();
        if (!seen.has(keyNorm)) {
          seen.add(keyNorm);
          out.push({
            key: `sede-${s.id}`,
            titolo: s.nome,
            indirizzo: full,
            categoria: 'Sede Croce Oro',
            lat: s.coordinate?.lat,
            lng: s.coordinate?.lng
          });
        }
      }
    }

    for (const v of vetStructures || []) {
      const full = `${v.nome}, ${v.indirizzoCompleto}`;
      if (
        v.nome.toLowerCase().includes(q) ||
        v.indirizzoCompleto.toLowerCase().includes(q) ||
        (v.comune && v.comune.toLowerCase().includes(q))
      ) {
        const keyNorm = full.toLowerCase();
        if (!seen.has(keyNorm)) {
          seen.add(keyNorm);
          out.push({
            key: `vet-${v.id}`,
            titolo: v.nome,
            indirizzo: full,
            categoria: v.h24 ? 'Struttura Vet H24' : 'Struttura Veterinaria'
          });
        }
      }
    }

    return out.slice(0, 8);
  }, [query, knownAddresses, vetStructures, sediCroceOro]);

  // Ricerca automatica su Internet / Google Maps quando non ci sono corrispondenze note (o se forzata)
  useEffect(() => {
    const shouldSearchOnline =
      aperto &&
      query.length >= 2 &&
      (suggerimentiNoti.length === 0 || cercaOnlineForzato);

    if (!shouldSearchOnline) {
      if (suggerimentiNoti.length > 0 && !cercaOnlineForzato) {
        setRisultatiOnline([]);
        lastQueriedRef.current = '';
      }
      return;
    }

    if (lastQueriedRef.current === query) return;

    const timer = setTimeout(async () => {
      lastQueriedRef.current = query;
      setInRicercaOnline(true);
      try {
        const baseUrl = realtime.getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/maps/search-places`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const data = await res.json().catch(() => ({}));
        if (data?.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        const list = Array.isArray(data?.results) ? data.results : [];
        setRisultatiOnline(list);
      } catch {
        setRisultatiOnline([]);
      } finally {
        setInRicercaOnline(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [aperto, query, suggerimentiNoti.length, cercaOnlineForzato]);

  const borderRingClass =
    accentTheme === 'emerald'
      ? 'border-emerald-500/30 focus:ring-emerald-500'
      : 'border-sky-500/30 focus:ring-sky-500';

  const handleSelectKnown = (item: (typeof suggerimentiNoti)[number]) => {
    onChange(item.indirizzo);
    onSelectAddress?.({
      indirizzo: item.indirizzo,
      nome: item.titolo !== item.indirizzo ? item.titolo : undefined,
      lat: item.lat,
      lng: item.lng,
      placeId: item.placeId,
      googleMapsUri: item.googleMapsUri,
      isNewOnline: false
    });
    setAperto(false);
    setCercaOnlineForzato(false);
  };

  const handleSelectOnlineCrea = (place?: OnlinePlaceResult) => {
    const chosenAddress = place ? place.formattedAddress : query;
    const chosenName =
      place && place.displayName && place.displayName.toLowerCase() !== chosenAddress.toLowerCase()
        ? place.displayName
        : undefined;
    const finalText = chosenName && !chosenAddress.toLowerCase().includes(chosenName.toLowerCase())
      ? `${chosenName}, ${chosenAddress}`
      : chosenAddress;

    onChange(finalText);
    onSelectAddress?.({
      indirizzo: finalText,
      nome: chosenName,
      lat: place?.lat,
      lng: place?.lng,
      placeId: place?.placeId,
      googleMapsUri: place?.googleMapsUri,
      isNewOnline: true
    });
    setAperto(false);
    setCercaOnlineForzato(false);
  };

  const mostraDropdown = aperto && query.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      {leftIcon === 'nav' ? (
        <Navigation
          className={`w-4 h-4 ${accentTheme === 'emerald' ? 'text-emerald-400' : 'text-sky-400'} absolute left-3 top-3 pointer-events-none`}
        />
      ) : (
        <MapPin
          className={`w-4 h-4 ${accentTheme === 'emerald' ? 'text-emerald-400' : 'text-sky-400'} absolute left-3 top-3 pointer-events-none`}
        />
      )}

      <input
        type="text"
        value={value}
        onFocus={() => setAperto(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setAperto(true);
          setCercaOnlineForzato(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setAperto(false);
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            if (containerRef.current && containerRef.current.contains(document.activeElement)) return;
            if (value.trim()) {
              onBlurCommit?.(value.trim());
            }
          }, 180);
        }}
        placeholder={placeholder}
        className={`w-full pl-9 ${hasClearButton && value ? 'pr-24' : 'pr-3'} py-2.5 rounded-xl bg-slate-950 border ${borderRingClass} text-slate-100 text-xs focus:ring-2 focus:outline-none placeholder:text-slate-500`}
      />

      {hasClearButton && value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
            setRisultatiOnline([]);
            lastQueriedRef.current = '';
          }}
          className="absolute right-2 top-2 text-[10px] px-2.5 py-1 rounded-md bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/50 transition-colors cursor-pointer"
        >
          ✕ Cancella
        </button>
      )}

      {mostraDropdown && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {suggerimentiNoti.length > 0 && !cercaOnlineForzato && (
            <div>
              <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                <span>Indirizzi Già Noti</span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCercaOnlineForzato(true);
                  }}
                  className="text-[11px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                >
                  Cerca altro da Internet (CREA)
                </button>
              </div>
              <div className="divide-y divide-slate-800/80">
                {suggerimentiNoti.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectKnown(item);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-800/90 transition-colors cursor-pointer flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {item.titolo}
                      </div>
                      {item.titolo !== item.indirizzo && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.indirizzo}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 tabular-nums">
                        <span>{item.categoria}</span>
                        {typeof item.lat === 'number' && typeof item.lng === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400 font-mono">
                              GPS {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Compass className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(suggerimentiNoti.length === 0 || cercaOnlineForzato) && (
            <div>
              <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-[11px] font-semibold text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Ricerca Online / Google Maps (CREA nuovo indirizzo)</span>
                </span>
                {cercaOnlineForzato && suggerimentiNoti.length > 0 && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCercaOnlineForzato(false);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Torna ai noti
                  </button>
                )}
              </div>

              {inRicercaOnline && (
                <div className="px-3 py-2.5 text-xs text-slate-300 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Ricerca indirizzo o attività su internet in corso...</span>
                </div>
              )}

              <div className="divide-y divide-slate-800/80">
                {risultatiOnline.map((place, idx) => (
                  <button
                    key={`${place.placeId || idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectOnlineCrea(place);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-950/30 transition-colors cursor-pointer flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">
                        <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] tracking-wide">
                          CREA
                        </span>
                        <span>{place.formattedAddress}</span>
                      </div>
                      {place.displayName && place.displayName.toLowerCase() !== place.formattedAddress.toLowerCase() && (
                        <div className="text-[11px] text-slate-300 mt-0.5 truncate">
                          {place.displayName}
                          {place.typeLabel ? ` · ${place.typeLabel}` : ''}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 tabular-nums">
                        <span>{place.source === 'google_maps' ? 'Google Maps' : 'OpenStreetMap'}</span>
                        {typeof place.lat === 'number' && typeof place.lng === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-emerald-400">
                              {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <PlusCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  </button>
                ))}

                {/* Opzione diretta CREA <testo digitato> sempre disponibile */}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectOnlineCrea(undefined);
                  }}
                  className="w-full text-left px-3 py-2.5 bg-slate-950/60 hover:bg-amber-950/40 transition-colors cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="text-xs text-amber-200 font-semibold truncate">
                    <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                      CREA
                    </span>
                    <span>{query}</span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-semibold whitespace-nowrap shrink-0">
                    Salva così
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
