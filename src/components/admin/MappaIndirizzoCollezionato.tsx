import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Save,
  X,
  Crosshair,
  RefreshCw,
  Check,
  Navigation,
  Tag,
  FileText
} from 'lucide-react';
import { IndirizzoCollezionato } from '../../types/adminTypes';
import { realtime } from '../../services/realtime';

interface MappaIndirizzoCollezionatoProps {
  indirizzoIniziale: IndirizzoCollezionato | null;
  googleMapsApiKey?: string;
  mapsQuotaExceeded?: boolean;
  onSave: (entry: IndirizzoCollezionato) => void;
  onClose: () => void;
}

const DEFAULT_LAT = 44.0365;
const DEFAULT_LNG = 10.1415;

const MapCameraSync: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map) return;
    if (
      !prevRef.current ||
      Math.abs(prevRef.current.lat - lat) > 0.00001 ||
      Math.abs(prevRef.current.lng - lng) > 0.00001
    ) {
      map.panTo({ lat, lng });
      prevRef.current = { lat, lng };
    }
  }, [map, lat, lng]);

  return null;
};

export const MappaIndirizzoCollezionato: React.FC<MappaIndirizzoCollezionatoProps> = ({
  indirizzoIniziale,
  googleMapsApiKey = '',
  mapsQuotaExceeded = false,
  onSave,
  onClose
}) => {
  const [nome, setNome] = useState(indirizzoIniziale?.nome || '');
  const [indirizzo, setIndirizzo] = useState(indirizzoIniziale?.indirizzo || '');
  const [note, setNote] = useState(indirizzoIniziale?.note || '');
  const [lat, setLat] = useState<number>(
    typeof indirizzoIniziale?.lat === 'number' ? indirizzoIniziale.lat : DEFAULT_LAT
  );
  const [lng, setLng] = useState<number>(
    typeof indirizzoIniziale?.lng === 'number' ? indirizzoIniziale.lng : DEFAULT_LNG
  );
  const [placeId, setPlaceId] = useState<string | undefined>(indirizzoIniziale?.placeId);
  const [googleMapsUri, setGoogleMapsUri] = useState<string | undefined>(indirizzoIniziale?.googleMapsUri);

  const [queryMappa, setQueryMappa] = useState('');
  const [inRicerca, setInRicerca] = useState(false);
  const [inReverse, setInReverse] = useState(false);
  const [indirizzoRilevato, setIndirizzoRilevato] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [risultatiRicerca, setRisultatiRicerca] = useState<
    Array<{
      placeId?: string;
      displayName: string;
      formattedAddress: string;
      lat?: number;
      lng?: number;
      googleMapsUri?: string;
      typeLabel?: string;
    }>
  >([]);

  const usaGoogleMaps = Boolean(googleMapsApiKey && !mapsQuotaExceeded);

  // Refs fallback Leaflet quando Google Maps non ha chiave o quota esaurita
  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);

  const eseguiReverseGeocode = async (nuovaLat: number, nuovaLng: number) => {
    setInReverse(true);
    try {
      const baseUrl = realtime.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/maps/reverse-geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: nuovaLat, lng: nuovaLng })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      if (data?.result?.formattedAddress) {
        setIndirizzoRilevato(data.result.formattedAddress);
        if (data.result.placeId) setPlaceId(data.result.placeId);
        if (!indirizzo.trim()) {
          setIndirizzo(data.result.formattedAddress);
        }
      }
    } catch (err) {
      console.error('Errore reverse geocode:', err);
    } finally {
      setInReverse(false);
    }
  };

  // Se l'indirizzo iniziale non ha ancora coordinate GPS, esegue un geocode automatico all'apertura
  useEffect(() => {
    if (
      indirizzoIniziale &&
      typeof indirizzoIniziale.lat !== 'number' &&
      indirizzoIniziale.indirizzo?.trim()
    ) {
      cercaCoordinateDaTesto(indirizzoIniziale.indirizzo, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indirizzoIniziale?.id]);

  // Setup fallback Leaflet quando Google Maps JS non è disponibile
  useEffect(() => {
    if (usaGoogleMaps) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletMarkerRef.current = null;
      }
      return;
    }

    if (!leafletContainerRef.current) return;
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([lat, lng]);
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([lat, lng]);
      }
      return;
    }

    const map = L.map(leafletContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'indirizzo-collezionato-pin',
      html: `<div style="width:32px;height:32px;border-radius:50%;background:#6366f1;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;">📍</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setLat(pos.lat);
      setLng(pos.lng);
      setGoogleMapsUri(`https://www.google.com/maps?q=${pos.lat},${pos.lng}`);
      void eseguiReverseGeocode(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: cLat, lng: cLng } = e.latlng;
      marker.setLatLng([cLat, cLng]);
      setLat(cLat);
      setLng(cLng);
      setGoogleMapsUri(`https://www.google.com/maps?q=${cLat},${cLng}`);
      void eseguiReverseGeocode(cLat, cLng);
    });

    leafletMapRef.current = map;
    leafletMarkerRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      leafletMapRef.current = null;
      leafletMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usaGoogleMaps]);

  // Aggiorna marker Leaflet su cambi esterni di coordinate
  useEffect(() => {
    if (!usaGoogleMaps && leafletMapRef.current && leafletMarkerRef.current) {
      leafletMarkerRef.current.setLatLng([lat, lng]);
      leafletMapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng, usaGoogleMaps]);

  const cercaCoordinateDaTesto = async (testo: string, silenzioso = false) => {
    const q = testo.trim();
    if (!q) return;
    setInRicerca(true);
    if (!silenzioso) setMessaggio(null);
    try {
      const baseUrl = realtime.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/maps/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: q })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      if (data?.result && typeof data.result.lat === 'number' && typeof data.result.lng === 'number') {
        setLat(data.result.lat);
        setLng(data.result.lng);
        if (data.result.placeId) setPlaceId(data.result.placeId);
        setGoogleMapsUri(`https://www.google.com/maps?q=${data.result.lat},${data.result.lng}`);
        if (data.result.formattedAddress) setIndirizzoRilevato(data.result.formattedAddress);
        if (!silenzioso) {
          setMessaggio('Pin posizionato sulle coordinate rilevate per questo indirizzo.');
        }
      } else if (!silenzioso) {
        setMessaggio('Nessuna coordinata automatica trovata: puoi spostare manualmente il pin sulla mappa.');
      }
    } catch {
      if (!silenzioso) setMessaggio('Errore nella ricerca delle coordinate.');
    } finally {
      setInRicerca(false);
    }
  };

  const cercaSuMappa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = queryMappa.trim();
    if (q.length < 2) return;
    setInRicerca(true);
    setMessaggio(null);
    try {
      const baseUrl = realtime.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/maps/search-places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.quotaExceeded) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      const list = Array.isArray(data?.results) ? data.results : [];
      setRisultatiRicerca(list);
      if (list.length === 0) {
        setMessaggio('Nessun luogo trovato per la ricerca inserita.');
      }
    } catch {
      setMessaggio('Errore durante la ricerca online.');
    } finally {
      setInRicerca(false);
    }
  };

  const handleAggiornaPosizionePin = (nuovaLat: number, nuovaLng: number) => {
    setLat(nuovaLat);
    setLng(nuovaLng);
    setGoogleMapsUri(`https://www.google.com/maps?q=${nuovaLat},${nuovaLng}`);
    void eseguiReverseGeocode(nuovaLat, nuovaLng);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!indirizzo.trim()) {
      setMessaggio('Il testo dell\'indirizzo è obbligatorio.');
      return;
    }

    const nowIso = new Date().toISOString();
    const saved: IndirizzoCollezionato = {
      id: indirizzoIniziale?.id || `ind-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: nome.trim(),
      indirizzo: indirizzo.trim(),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      placeId,
      googleMapsUri: googleMapsUri || `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
      origine: indirizzoIniziale?.origine || 'manuale',
      note: note.trim() || undefined,
      dataCreazione: indirizzoIniziale?.dataCreazione || nowIso.slice(0, 10),
      dataUltimaModifica: nowIso.slice(0, 10),
      ultimoUtilizzo: indirizzoIniziale?.ultimoUtilizzo || nowIso,
      utilizzi: indirizzoIniziale?.utilizzi || 1
    };

    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md">
      <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/40 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {indirizzoIniziale ? 'Modifica Indirizzo Collezionato e Pin Mappa' : 'Nuovo Indirizzo Collezionato'}
              </h3>
              <p className="text-xs text-slate-400">
                Assegna un nome separato dall'indirizzo, correggi il testo o trascina il pin sulla mappa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 py-4 flex-1 text-xs pr-1">
          {/* Campi Nome (separato dall'indirizzo) & Testo Indirizzo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Nome Luogo / Etichetta (distinto dall'indirizzo)</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es: Casa Sig. Bianchi, Ambulatorio Centro, Parco..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>Testo Indirizzo *</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  placeholder="Via, numero civico, città..."
                  className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => cercaCoordinateDaTesto(indirizzo)}
                  disabled={inRicerca || !indirizzo.trim()}
                  className="px-3 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  title="Centra il pin sulla mappa partendo dal testo dell'indirizzo"
                >
                  {inRicerca ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                  <span>Posiziona Pin</span>
                </button>
              </div>
            </div>
          </div>

          {/* Barra ricerca luogo/attività su mappa */}
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={queryMappa}
                  onChange={(e) => setQueryMappa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void cercaSuMappa();
                    }
                  }}
                  placeholder="Cerca attività, ufficio o indirizzo su Google Maps per centrare il pin..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => cercaSuMappa()}
                disabled={inRicerca || queryMappa.trim().length < 2}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                Cerca su Mappa
              </button>
            </div>

            {risultatiRicerca.length > 0 && (
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
                {risultatiRicerca.map((item, idx) => (
                  <button
                    key={`${item.placeId || idx}`}
                    type="button"
                    onClick={() => {
                      if (typeof item.lat === 'number' && typeof item.lng === 'number') {
                        setLat(item.lat);
                        setLng(item.lng);
                      }
                      if (item.placeId) setPlaceId(item.placeId);
                      if (item.googleMapsUri) setGoogleMapsUri(item.googleMapsUri);
                      if (!nome.trim() && item.displayName && item.displayName !== item.formattedAddress) {
                        setNome(item.displayName);
                      }
                      setIndirizzo(item.formattedAddress);
                      setIndirizzoRilevato(item.formattedAddress);
                      setRisultatiRicerca([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-950/50 transition-colors cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{item.displayName}</div>
                      <div className="text-[11px] text-slate-400 truncate">{item.formattedAddress}</div>
                    </div>
                    <span className="text-[11px] text-indigo-300 font-semibold whitespace-nowrap shrink-0">
                      Applica
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Mappa interattiva visualizzabile (altezza fissa 320px per evitare collasso 0x0) */}
            <div className="rounded-xl overflow-hidden border border-slate-700 relative bg-slate-900" style={{ height: '320px' }}>
              {usaGoogleMaps ? (
                <APIProvider
                  apiKey={googleMapsApiKey}
                  libraries={['marker']}
                  language="it"
                  region="IT"
                >
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat, lng }}
                    defaultZoom={16}
                    gestureHandling="greedy"
                    style={{ width: '100%', height: '320px' }}
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    onClick={(e) => {
                      const ll = e.detail?.latLng;
                      if (ll) {
                        handleAggiornaPosizionePin(ll.lat, ll.lng);
                      }
                    }}
                  >
                    <MapCameraSync lat={lat} lng={lng} />
                    <AdvancedMarker
                      position={{ lat, lng }}
                      draggable={true}
                      title={nome || indirizzo || 'Posizione selezionata'}
                      onDragEnd={(e) => {
                        const ll = e.latLng;
                        if (ll) {
                          handleAggiornaPosizionePin(ll.lat(), ll.lng());
                        }
                      }}
                    >
                      <Pin
                        background="#4f46e5"
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                        scale={1.2}
                      />
                    </AdvancedMarker>
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div ref={leafletContainerRef} style={{ width: '100%', height: '320px' }} />
              )}
            </div>

            {/* Coordinate GPS precise & Reverse Geocode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300 font-mono tabular-nums">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Lat:</span>
                <input
                  type="number"
                  step="0.000001"
                  value={Number(lat.toFixed(6))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) setLat(v);
                  }}
                  className="w-28 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 text-[11px] font-mono tabular-nums"
                />
                <span>Lng:</span>
                <input
                  type="number"
                  step="0.000001"
                  value={Number(lng.toFixed(6))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) setLng(v);
                  }}
                  className="w-28 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 text-[11px] font-mono tabular-nums"
                />
              </div>
              <div className="text-[11px] text-slate-400">
                {inReverse ? 'Rilevamento indirizzo dal pin...' : 'Clicca sulla mappa o trascina il pin per aggiornare la posizione'}
              </div>
            </div>

            {indirizzoRilevato && indirizzoRilevato !== indirizzo.trim() && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-indigo-950/50 border border-indigo-500/40 text-indigo-200">
                <div className="min-w-0">
                  <span className="text-[11px] text-indigo-300 block">Indirizzo rilevato alla posizione del pin:</span>
                  <span className="font-semibold truncate block">{indirizzoRilevato}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIndirizzo(indirizzoRilevato)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Applica Testo</span>
                </button>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Note Operative (opzionale)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es: Citofono, accesso carrabile, piano, riferimenti utili..."
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {messaggio && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs">
              {messaggio}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salva Indirizzo e Geolocalizzazione</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
