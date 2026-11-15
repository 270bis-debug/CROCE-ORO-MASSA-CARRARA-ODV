import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Compass,
  Search,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  Building2,
  Copy,
  ClipboardPaste,
  Layers
} from 'lucide-react';

interface GeolocalizzazioneMappaSedeProps {
  lat: number;
  lng: number;
  indirizzo?: string;
  comune?: string;
  cap?: string;
  nomeSede?: string;
  onChange: (coordinate: { lat: number; lng: number }) => void;
}

// Coordinate di default (Massa Centro / Le Jare, Toscana)
const DEFAULT_LAT = 44.01700;
const DEFAULT_LNG = 10.15121;

// Preset coordinate sedi associative territoriali note della Croce Oro
const PRESET_SEDI_NOTE = [
  { nome: 'Massa Le Jare', lat: 44.01700, lng: 10.15121, desc: 'Sede Operativa H24 & Centrale' },
  { nome: 'Massa Ronchi', lat: 43.99419, lng: 10.12367, desc: 'Sede Legale & Territoriale' },
  { nome: 'Carrara Fossone', lat: 44.06672, lng: 10.04921, desc: 'Sezione Territoriale Fossone' },
  { nome: 'Avenza Stazione FS', lat: 44.04120, lng: 10.06740, desc: 'Presidio Territoriale Avenza' }
];

export const GeolocalizzazioneMappaSede: React.FC<GeolocalizzazioneMappaSedeProps> = ({
  lat,
  lng,
  indirizzo = '',
  comune = 'Massa',
  cap = '54100',
  nomeSede = 'Sede Associativa',
  onChange
}) => {
  // Modalità scelta dall'amministratore: 'mappa' (geolocalizzazione interattiva) oppure 'manuale' (coordinate manuali)
  const [metodoScelto, setMetodoScelto] = useState<'mappa' | 'manuale'>('mappa');
  const [tipoMappa, setTipoMappa] = useState<'stradale' | 'satellite'>('stradale');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [inRicercaIndirizzo, setInRicercaIndirizzo] = useState(false);
  const [inRilevamentoGps, setInRilevamentoGps] = useState(false);
  const [messaggioStato, setMessaggioStato] = useState<string | null>(null);
  const [tipoMessaggio, setTipoMessaggio] = useState<'info' | 'success' | 'warning'>('info');

  // Input testuale per incollare coordinate in formato "lat, lng"
  const [incollaInput, setIncollaInput] = useState('');
  const [mostraIncolla, setMostraIncolla] = useState(false);

  // Icona personalizzata con badge e pin fluorescente Croce Oro
  const creaIconaSede = useCallback((nome: string) => {
    return L.divIcon({
      className: 'custom-sede-map-pin',
      html: `
        <div style="
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            background: rgba(225, 29, 72, 0.35);
            border-radius: 50%;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            width: 34px;
            height: 34px;
            background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
            border: 2.5px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 6px 16px rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg style="transform: rotate(45deg); width: 17px; height: 17px; color: #ffffff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
              <path d="M10 6h4"></path>
              <path d="M10 10h4"></path>
              <path d="M10 14h4"></path>
              <path d="M10 18h4"></path>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 40],
      popupAnchor: [0, -38]
    });
  }, []);

  // Aggiorna posizione marker e stato coordinate
  const aggiornaPosizioneMarker = useCallback((nuovaLat: number, nuovaLng: number, zoom?: number) => {
    const latArrotondata = Number(nuovaLat.toFixed(6));
    const lngArrotondata = Number(nuovaLng.toFixed(6));

    onChange({ lat: latArrotondata, lng: lngArrotondata });

    if (mapInstanceRef.current) {
      if (typeof zoom === 'number') {
        mapInstanceRef.current.setView([latArrotondata, lngArrotondata], zoom);
      } else {
        mapInstanceRef.current.panTo([latArrotondata, lngArrotondata]);
      }
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([latArrotondata, lngArrotondata]);
      markerRef.current.setPopupContent(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px; text-align: center; color: #0f172a; padding: 3px;">
          <strong style="color: #be123c; font-size: 12px; display: block; margin-bottom: 3px;">🏢 ${nomeSede || 'Sede Territoriale'}</strong>
          <span>Coordinate: <code>${latArrotondata.toFixed(5)}, ${lngArrotondata.toFixed(5)}</code></span><br/>
          <span style="font-size: 10px; color: #64748b;">Trascina il pin o clicca altrove sulla mappa per correggere.</span>
        </div>
      `);
    }
  }, [onChange, nomeSede]);

  // Inizializzazione della mappa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const latIniziale = lat && !isNaN(lat) && lat !== 0 ? lat : DEFAULT_LAT;
    const lngIniziale = lng && !isNaN(lng) && lng !== 0 ? lng : DEFAULT_LNG;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latIniziale, lngIniziale],
        zoom: 16,
        zoomControl: true,
        attributionControl: false
      });

      const initialLayer = L.tileLayer(
        tipoMappa === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19 }
      ).addTo(map);

      tileLayerRef.current = initialLayer;

      const marker = L.marker([latIniziale, lngIniziale], {
        icon: creaIconaSede(nomeSede),
        draggable: true,
        autoPan: true
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 11px; text-align: center; color: #0f172a; padding: 3px;">
          <strong style="color: #be123c; font-size: 12px; display: block; margin-bottom: 3px;">🏢 ${nomeSede || 'Sede Territoriale'}</strong>
          <span>Coordinate: <code>${latIniziale.toFixed(5)}, ${lngIniziale.toFixed(5)}</code></span><br/>
          <span style="font-size: 10px; color: #64748b;">Trascina il pin o clicca altrove sulla mappa per correggere.</span>
        </div>
      `);

      // Drag del marker sulla mappa
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        aggiornaPosizioneMarker(pos.lat, pos.lng);
        setMessaggioStato(`✓ Nuova posizione impostata: [${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}]`);
        setTipoMessaggio('success');
      });

      // Click sulla mappa per posizionare il marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        aggiornaPosizioneMarker(e.latlng.lat, e.latlng.lng);
        setMessaggioStato(`✓ Pin spostato sulla posizione cliccata: [${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}]`);
        setTipoMessaggio('success');
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      const t1 = setTimeout(() => {
        map.invalidateSize();
      }, 150);
      const t2 = setTimeout(() => {
        map.invalidateSize();
      }, 400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    return () => {
      // Pulizia al disaccoppiamento del componente
    };
  }, [creaIconaSede, nomeSede, aggiornaPosizioneMarker, lat, lng, tipoMappa]);

  // Gestione cambio tipo mappa (stradale vs satellite)
  useEffect(() => {
    if (mapInstanceRef.current && tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      const newLayer = L.tileLayer(
        tipoMappa === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19 }
      ).addTo(mapInstanceRef.current);
      tileLayerRef.current = newLayer;
    }
  }, [tipoMappa]);

  // Se l'amministratore passa al tab 'mappa', ricalcola dimensioni Leaflet
  useEffect(() => {
    if (metodoScelto === 'mappa' && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          mapInstanceRef.current?.setView([lat, lng], 16);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [metodoScelto, lat, lng]);

  // Cleanup alla distruzione del componente
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Sincronizza coordinate nel marker se modificate dall'esterno o dalla modalità manuale
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const cur = markerRef.current.getLatLng();
      if (Math.abs(cur.lat - lat) > 0.00001 || Math.abs(cur.lng - lng) > 0.00001) {
        markerRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.panTo([lat, lng]);
      }
    }
  }, [lat, lng]);

  // Forward Geocoding da Indirizzo Civico (OpenStreetMap Nominatim)
  const geolocalizzaIndirizzo = async () => {
    const queryParts = [indirizzo, comune, cap, 'Toscana', 'Italia'].filter(Boolean);
    const query = queryParts.join(', ');

    if (!indirizzo.trim() && !comune.trim()) {
      setMessaggioStato('⚠️ Inserisci prima l\'Indirizzo o il Comune per calcolare le coordinate.');
      setTipoMessaggio('warning');
      return;
    }

    try {
      setInRicercaIndirizzo(true);
      setMessaggioStato('Geocoding in corso dall\'indirizzo inserito...');
      setTipoMessaggio('info');

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'it-IT,it;q=0.9',
          'User-Agent': 'CroceOroMassaCarrara-SediTerritoriali/1.0'
        }
      });

      if (!res.ok) throw new Error('Errore durante la ricerca cartografica');
      const results = await res.json();

      if (results && results.length > 0) {
        const item = results[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);

        aggiornaPosizioneMarker(newLat, newLng, 17);
        setMessaggioStato(`✓ Sede geolocalizzata su mappa: [${newLat.toFixed(5)}, ${newLng.toFixed(5)}]`);
        setTipoMessaggio('success');
      } else {
        setMessaggioStato('⚠️ Indirizzo civico esatto non trovato. Clicca sulla mappa nel punto esatto o inserisci le coordinate.');
        setTipoMessaggio('warning');
      }
    } catch {
      setMessaggioStato('⚠️ Servizio cartografico non raggiungibile. Puoi posizionare il pin manualmente cliccando sulla mappa.');
      setTipoMessaggio('warning');
    } finally {
      setInRicercaIndirizzo(false);
    }
  };

  // Rileva posizione GPS reale dal dispositivo dell'amministratore
  const rilevaPosizioneGPSDispositivo = () => {
    if (!navigator.geolocation) {
      setMessaggioStato('⚠️ Geolocalizzazione GPS non supportata da questo browser.');
      setTipoMessaggio('warning');
      return;
    }

    setInRilevamentoGps(true);
    setMessaggioStato('Rilevamento coordinate GPS attuali del dispositivo in corso...');
    setTipoMessaggio('info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInRilevamentoGps(false);
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        aggiornaPosizioneMarker(newLat, newLng, 17);
        setMessaggioStato(`✓ Posizione GPS del dispositivo rilevata: [${newLat.toFixed(5)}, ${newLng.toFixed(5)}] (Accuratezza: ±${Math.round(pos.coords.accuracy)}m)`);
        setTipoMessaggio('success');
      },
      (err) => {
        setInRilevamentoGps(false);
        setMessaggioStato(`⚠️ Errore GPS: ${err.message || 'Permesso di posizione negato'}.`);
        setTipoMessaggio('warning');
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  };

  // Incolla coordinate da stringa
  const handleApplicaCoordinateIncollate = () => {
    const pulite = incollaInput.trim();
    if (!pulite) return;

    const parti = pulite.split(/[,;\s]+/).filter(Boolean);
    if (parti.length >= 2) {
      const pLat = parseFloat(parti[0]);
      const pLng = parseFloat(parti[1]);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
        aggiornaPosizioneMarker(pLat, pLng, 16);
        setMessaggioStato(`✓ Coordinate applicate: [${pLat.toFixed(5)}, ${pLng.toFixed(5)}]`);
        setTipoMessaggio('success');
        setIncollaInput('');
        setMostraIncolla(false);
        return;
      }
    }
    setMessaggioStato('⚠️ Formato coordinate non riconosciuto. Esempio valido: "44.01700, 10.15121"');
    setTipoMessaggio('warning');
  };

  return (
    <div className="space-y-3 bg-slate-950/80 p-3.5 sm:p-4 rounded-2xl border border-slate-800">
      
      {/* Intestazione e Scelta del Metodo Preferito */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-white text-xs uppercase tracking-wider">
              Posizione Geografica Sede Territoriale
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Scegli il metodo che preferisci per localizzare la sede:
          </p>
        </div>

        {/* Pulsanti di scelta: Mappa Interattiva vs Coordinate Manuali */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-700 rounded-xl text-xs shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMetodoScelto('mappa')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              metodoScelto === 'mappa'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Geolocalizza su Mappa</span>
          </button>

          <button
            type="button"
            onClick={() => setMetodoScelto('manuale')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              metodoScelto === 'manuale'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Coordinate Manuali</span>
          </button>
        </div>
      </div>

      {/* Messaggi di stato o conferma geocoding */}
      {messaggioStato && (
        <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
          tipoMessaggio === 'success'
            ? 'bg-emerald-950/70 border border-emerald-500/60 text-emerald-200'
            : tipoMessaggio === 'warning'
            ? 'bg-amber-950/70 border border-amber-500/60 text-amber-200'
            : 'bg-blue-950/70 border border-blue-500/60 text-blue-200'
        }`}>
          {tipoMessaggio === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : tipoMessaggio === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
          )}
          <span className="leading-snug">{messaggioStato}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* METODO 1: GEOLOCALIZZAZIONE SU MAPPA INTERATTIVA               */}
      {/* ------------------------------------------------------------- */}
      <div className={metodoScelto === 'mappa' ? 'space-y-2.5 block animate-in fade-in duration-200' : 'hidden'}>
        {/* Barra Strumenti della Mappa: Calcola da indirizzo, GPS attuale, Presets, Tipo Mappa */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={geolocalizzaIndirizzo}
              disabled={inRicercaIndirizzo}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
              title="Trova le coordinate dell'indirizzo e posiziona automaticamente il pin sulla mappa"
            >
              <Search className={`w-3.5 h-3.5 text-rose-400 ${inRicercaIndirizzo ? 'animate-spin' : ''}`} />
              <span>{inRicercaIndirizzo ? 'Ricerca...' : 'Calcola da Indirizzo'}</span>
            </button>

            <button
              type="button"
              onClick={rilevaPosizioneGPSDispositivo}
              disabled={inRilevamentoGps}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
              title="Rileva e applica le coordinate GPS attuali del dispositivo"
            >
              <Navigation className={`w-3.5 h-3.5 text-amber-400 ${inRilevamentoGps ? 'animate-spin' : ''}`} />
              <span>{inRilevamentoGps ? 'GPS...' : 'Usa Posizione Dispositivo'}</span>
            </button>

            {/* Toggle Tipo Mappa (Stradale / Satellite) */}
            <button
              type="button"
              onClick={() => setTipoMappa(tipoMappa === 'stradale' ? 'satellite' : 'stradale')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Alterna tra mappa stradale e mappa satellitare"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{tipoMappa === 'stradale' ? 'Vista Satellitare' : 'Vista Stradale'}</span>
            </button>
          </div>

          {/* Coordinate attive correnti con feedback */}
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Lat: <strong>{Number(lat || 0).toFixed(5)}</strong></span>
            <span>•</span>
            <span>Lng: <strong>{Number(lng || 0).toFixed(5)}</strong></span>
          </div>
        </div>

        {/* Container Mappa Leaflet */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-900">
          <div
            ref={mapContainerRef}
            className="h-64 sm:h-72 w-full z-10"
            style={{ minHeight: '260px' }}
          />

          {/* Overlay Istruzioni Mappa */}
          <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none flex justify-center">
            <span className="px-3 py-1 rounded-full bg-slate-950/90 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-semibold shadow-lg text-center">
              👉 Clicca su qualsiasi punto della mappa o trascina il puntatore rosso per posizionare la sede
            </span>
          </div>
        </div>

        {/* Preset Rapidi Sedi Territoriali Croce Oro */}
        <div className="pt-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-500" />
            <span>Oppure seleziona un presidio territoriale noto:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {PRESET_SEDI_NOTE.map((preset) => (
              <button
                key={preset.nome}
                type="button"
                onClick={() => {
                  aggiornaPosizioneMarker(preset.lat, preset.lng, 17);
                  setMessaggioStato(`✓ Mappa posizionata su: ${preset.nome}`);
                  setTipoMessaggio('success');
                }}
                className="p-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-left transition-all cursor-pointer group"
              >
                <span className="block text-[11px] font-bold text-white group-hover:text-rose-400 truncate">
                  {preset.nome}
                </span>
                <span className="block text-[9px] text-slate-500 font-mono">
                  {preset.lat.toFixed(4)}, {preset.lng.toFixed(4)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* METODO 2: INSERIMENTO MANUALE DELLE COORDINATE GPS            */}
      {/* ------------------------------------------------------------- */}
      {metodoScelto === 'manuale' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between text-xs">
                <span>Latitudine GPS *</span>
                <span className="text-[10px] text-slate-500 font-mono">Range: -90.0 .. +90.0</span>
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={lat}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onChange({ lat: val, lng });
                }}
                placeholder="es. 44.01700"
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between text-xs">
                <span>Longitudine GPS *</span>
                <span className="text-[10px] text-slate-500 font-mono">Range: -180.0 .. +180.0</span>
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={lng}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onChange({ lat, lng: val });
                }}
                placeholder="es. 10.15121"
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Strumenti per coordinate manuali: Incolla o Copia */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMostraIncolla(!mostraIncolla)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-rose-400" />
                <span>Incolla Stringa Coordinate (Lat, Lng)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    setMessaggioStato(`✓ Coordinate ${lat.toFixed(6)}, ${lng.toFixed(6)} copiate negli appunti!`);
                    setTipoMessaggio('success');
                    setTimeout(() => setMessaggioStato(null), 3000);
                  }
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer text-[11px]"
                title="Copia coordinate negli appunti"
              >
                <Copy className="w-3 h-3" />
                <span>Copia</span>
              </button>
            </div>

            {/* Link di verifica esterna su Google Maps */}
            {lat && lng && (
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px] underline"
                title="Verifica posizione inserita su Google Maps"
              >
                <span>Verifica punto su Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Form Incolla Rapido */}
          {mostraIncolla && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-2 animate-in fade-in">
              <input
                type="text"
                value={incollaInput}
                onChange={(e) => setIncollaInput(e.target.value)}
                placeholder="Incolla qui es: 44.01700, 10.15121"
                className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplicaCoordinateIncollate}
                className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase cursor-pointer"
              >
                Applica
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
