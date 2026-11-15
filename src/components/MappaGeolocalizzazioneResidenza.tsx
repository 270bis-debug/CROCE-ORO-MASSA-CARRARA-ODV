import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Search, Check, RefreshCw, AlertCircle, Compass } from 'lucide-react';

export interface DatiResidenzaMultiCampo {
  indirizzo: string; // Via / Piazza e numero civico
  comune: string;    // Comune
  cap: string;       // CAP (5 cifre)
  provincia: string; // Sigla provincia (2 lettere)
  lat?: number;
  lng?: number;
}

interface MappaGeolocalizzazioneResidenzaProps {
  dati: DatiResidenzaMultiCampo;
  onChange: (nuoviDati: DatiResidenzaMultiCampo) => void;
}

// Coordinate di default (Massa Centro, Toscana)
const DEFAULT_LAT = 44.0365;
const DEFAULT_LNG = 10.1423;

export const MappaGeolocalizzazioneResidenza: React.FC<MappaGeolocalizzazioneResidenzaProps> = ({
  dati,
  onChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [inRicerca, setInRicerca] = useState(false);
  const [inGPS, setInGPS] = useState(false);
  const [messaggioStato, setMessaggioStato] = useState<string | null>(null);
  const [tipoMessaggio, setTipoMessaggio] = useState<'info' | 'success' | 'warning'>('info');
  const [mostraMappa, setMostraMappa] = useState(false);

  // Icona personalizzata per il pin di geolocalizzazione abitazione volontario
  const creaIconaPin = useCallback(() => {
    return L.divIcon({
      className: 'custom-residenza-pin',
      html: `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <div style="
            position: absolute;
            width: 36px;
            height: 36px;
            background: rgba(245, 158, 11, 0.25);
            border-radius: 50%;
            animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            width: 30px;
            height: 30px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            border: 2px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg style="transform: rotate(45deg); width: 14px; height: 14px; color: #000000;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
      popupAnchor: [0, -32]
    });
  }, []);

  // Reverse Geocoding via Nominatim OpenStreetMap
  const eseguiReverseGeocoding = useCallback(async (lat: number, lng: number) => {
    try {
      setInRicerca(true);
      setMessaggioStato('Rilevamento indirizzo dalle coordinate GPS...');
      setTipoMessaggio('info');

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'it-IT,it;q=0.9',
          'User-Agent': 'CroceOroMassaCarrara-App/1.0'
        }
      });

      if (!res.ok) throw new Error('Risposta di rete non valida');
      const data = await res.json();

      if (data && data.address) {
        const addr = data.address;
        const via = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || '';
        const civico = addr.house_number || '';
        const indirizzoNuovo = via ? (civico ? `${via} ${civico}` : via) : dati.indirizzo;
        const comuneNuovo = addr.city || addr.town || addr.village || addr.municipality || dati.comune || 'Massa';
        const capNuovo = addr.postcode || dati.cap || '54100';
        const provNuovo = addr.county_code ? addr.county_code.toUpperCase() : (addr.state_district ? addr.state_district.slice(0, 2).toUpperCase() : (dati.provincia || 'MS'));

        onChange({
          indirizzo: indirizzoNuovo || dati.indirizzo,
          comune: comuneNuovo || dati.comune,
          cap: capNuovo || dati.cap,
          provincia: provNuovo || dati.provincia,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6))
        });

        setMessaggioStato(`📍 Indirizzo aggiornato dalla posizione: ${indirizzoNuovo}, ${comuneNuovo}`);
        setTipoMessaggio('success');
      } else {
        onChange({
          ...dati,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6))
        });
        setMessaggioStato(`📍 Posizione impostata: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`);
        setTipoMessaggio('info');
      }
    } catch {
      // In caso di rate limit o offline, mantieni le coordinate
      onChange({
        ...dati,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
      });
      setMessaggioStato(`📍 Coordinate salvate: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setTipoMessaggio('info');
    } finally {
      setInRicerca(false);
    }
  }, [dati, onChange]);

  // Geolocalizza l'indirizzo testuale (Forward Geocoding)
  const geolocalizzaIndirizzoTesto = async () => {
    const queryParts = [dati.indirizzo, dati.comune, dati.cap, dati.provincia, 'Italia'].filter(Boolean);
    const query = queryParts.join(', ');

    if (!dati.indirizzo.trim() && !dati.comune.trim()) {
      setMessaggioStato('⚠️ Compila almeno Indirizzo o Comune prima di geolocalizzare.');
      setTipoMessaggio('warning');
      return;
    }

    try {
      setInRicerca(true);
      setMessaggioStato('Ricerca coordinate dell\'indirizzo su OpenStreetMap...');
      setTipoMessaggio('info');

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'it-IT,it;q=0.9',
          'User-Agent': 'CroceOroMassaCarrara-App/1.0'
        }
      });

      if (!res.ok) throw new Error('Errore durante la ricerca');
      const results = await res.json();

      if (results && results.length > 0) {
        const item = results[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);

        const addr = item.address || {};
        const capRilevato = addr.postcode || dati.cap;
        const comuneRilevato = addr.city || addr.town || addr.village || dati.comune;
        const provRilevata = addr.county_code ? addr.county_code.toUpperCase() : dati.provincia;

        onChange({
          ...dati,
          cap: capRilevato || dati.cap,
          comune: comuneRilevato || dati.comune,
          provincia: provRilevata || dati.provincia,
          lat: Number(newLat.toFixed(6)),
          lng: Number(newLng.toFixed(6))
        });

        setMostraMappa(true);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 16);
          markerRef.current.setLatLng([newLat, newLng]);
        }

        setMessaggioStato(`✓ Indirizzo trovato e localizzato sulla mappa.`);
        setTipoMessaggio('success');
      } else {
        setMessaggioStato('⚠️ Indirizzo esatto non trovato. Prova a specificare civico o comune, oppure sposta manualmente il pin sulla mappa.');
        setTipoMessaggio('warning');
        setMostraMappa(true);
      }
    } catch {
      setMessaggioStato('⚠️ Impossibile contattare il servizio cartografico. Puoi posizionare il pin manualmente sulla mappa.');
      setTipoMessaggio('warning');
      setMostraMappa(true);
    } finally {
      setInRicerca(false);
    }
  };

  // Usa GPS reale del dispositivo
  const geolocalizzaGPSDispositivo = () => {
    if (!navigator.geolocation) {
      setMessaggioStato('⚠️ Geolocalizzazione GPS non supportata da questo browser.');
      setTipoMessaggio('warning');
      return;
    }

    setInGPS(true);
    setMessaggioStato('Rilevamento coordinate GPS in corso...');
    setTipoMessaggio('info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInGPS(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setMostraMappa(true);
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
        }

        eseguiReverseGeocoding(lat, lng);
      },
      (err) => {
        setInGPS(false);
        setMessaggioStato(`⚠️ Errore GPS: ${err.message || 'Permesso negato'}.`);
        setTipoMessaggio('warning');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Inizializzazione della mappa Leaflet
  useEffect(() => {
    if (!mostraMappa || !mapContainerRef.current) return;

    const latIniziale = dati.lat || DEFAULT_LAT;
    const lngIniziale = dati.lng || DEFAULT_LNG;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latIniziale, lngIniziale],
        zoom: dati.lat ? 16 : 13,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const marker = L.marker([latIniziale, lngIniziale], {
        icon: creaIconaPin(),
        draggable: true,
        autoPan: true
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; text-align: center; color: #1e293b;">
          <strong>Abitazione Volontario</strong><br/>
          <span>Trascina il pin per correggere la posizione precisa.</span>
        </div>
      `);

      // Gestione drag del pin
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        eseguiReverseGeocoding(pos.lat, pos.lng);
      });

      // Click sulla mappa sposta il pin
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        eseguiReverseGeocoding(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Invalida dimensioni per evitare tile grigie
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } else {
      if (dati.lat && dati.lng && markerRef.current) {
        markerRef.current.setLatLng([dati.lat, dati.lng]);
      }
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }

    return () => {
      // Pulizia eventuale su unmount del modal
    };
  }, [mostraMappa, creaIconaPin, eseguiReverseGeocoding, dati.lat, dati.lng]);

  return (
    <div className="space-y-3">
      {/* 4 Campi Separati di Residenza */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        {/* 1. Indirizzo (Via / Piazza e civico) */}
        <div className="sm:col-span-6">
          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Indirizzo di Residenza (Via/Piazza e civico) *</span>
          </label>
          <input
            type="text"
            required
            value={dati.indirizzo}
            onChange={(e) => onChange({ ...dati, indirizzo: e.target.value })}
            placeholder="Es: Via Roma 15 / Piazza Garibaldi 8"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* 2. Comune */}
        <div className="sm:col-span-3">
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Comune *
          </label>
          <input
            type="text"
            required
            value={dati.comune}
            onChange={(e) => onChange({ ...dati, comune: e.target.value })}
            placeholder="Es: Massa"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* 3. CAP */}
        <div className="sm:col-span-1.5 col-span-6">
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            CAP *
          </label>
          <input
            type="text"
            maxLength={5}
            value={dati.cap}
            onChange={(e) => onChange({ ...dati, cap: e.target.value.replace(/\D/g, '') })}
            placeholder="54100"
            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 text-xs font-mono text-center focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* 4. Sigla Provincia */}
        <div className="sm:col-span-1.5 col-span-6">
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Prov. *
          </label>
          <input
            type="text"
            maxLength={2}
            value={dati.provincia}
            onChange={(e) => onChange({ ...dati, provincia: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="MS"
            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 text-xs font-mono uppercase text-center focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
          />
        </div>
      </div>

      {/* Pulsanti Geolocalizzazione e Mappa */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tasto 1: Geolocalizza Indirizzo */}
          <button
            type="button"
            onClick={geolocalizzaIndirizzoTesto}
            disabled={inRicerca}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Localizza automaticamente l'indirizzo scritto sulla mappa satellitare"
          >
            {inRicerca ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Search className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Geolocalizza Indirizzo</span>
          </button>

          {/* Tasto 2: GPS del Dispositivo */}
          <button
            type="button"
            onClick={geolocalizzaGPSDispositivo}
            disabled={inGPS}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-white border border-sky-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Usa le coordinate GPS rilevate dal telefono o dal computer"
          >
            {inGPS ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>Usa GPS Dispositivo</span>
          </button>

          {/* Tasto 3: Mostra / Nascondi Mappa con Pin spostabile */}
          <button
            type="button"
            onClick={() => setMostraMappa(!mostraMappa)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>{mostraMappa ? 'Chiudi Mappa' : 'Apri Mappa & Sposta Pin'}</span>
          </button>
        </div>

        {/* Indicazione Coordinate Salve */}
        {dati.lat && dati.lng && (
          <div className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>GPS: {dati.lat.toFixed(5)}, {dati.lng.toFixed(5)}</span>
          </div>
        )}
      </div>

      {/* Messaggio di stato / feedback geolocalizzazione */}
      {messaggioStato && (
        <div className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
          tipoMessaggio === 'success'
            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
            : tipoMessaggio === 'warning'
            ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
            : 'bg-slate-950 border border-slate-800 text-slate-300'
        }`}>
          {tipoMessaggio === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="flex-1 text-[11px] leading-tight">{messaggioStato}</span>
        </div>
      )}

      {/* Contenitore Mappa Interattiva con Pin Spostabile */}
      {mostraMappa && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1 font-semibold text-amber-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Trascina il pin dorato o fai clic sulla mappa per perfezionare la posizione precisa
            </span>
            <span className="text-[10px] text-slate-500">OpenStreetMap</span>
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-56 sm:h-64 rounded-2xl border-2 border-amber-500/50 overflow-hidden shadow-inner bg-slate-950 relative z-10"
          />
        </div>
      )}
    </div>
  );
};
