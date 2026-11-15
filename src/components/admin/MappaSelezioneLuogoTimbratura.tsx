import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Search, Check, RefreshCw, Crosshair, Layers, Compass } from 'lucide-react';

interface MappaSelezioneLuogoTimbraturaProps {
  lat: number;
  lng: number;
  raggioMetri: number;
  nomeLuogo?: string;
  indirizzoAttuale?: string;
  onPosizioneChange: (nuoveCoordinate: { lat: number; lng: number; indirizzo?: string }) => void;
}

export const MappaSelezioneLuogoTimbratura: React.FC<MappaSelezioneLuogoTimbraturaProps> = ({
  lat,
  lng,
  raggioMetri,
  nomeLuogo,
  indirizzoAttuale,
  onPosizioneChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [queryRicerca, setQueryRicerca] = useState('');
  const [inRicerca, setInRicerca] = useState(false);
  const [inGPS, setInGPS] = useState(false);
  const [indirizzoRilevato, setIndirizzoRilevato] = useState<string | null>(null);
  const [messaggioStato, setMessaggioStato] = useState<string | null>(null);
  const [tipoMessaggio, setTipoMessaggio] = useState<'info' | 'success' | 'warning'>('info');
  const [layerMappa, setLayerMappa] = useState<'osm' | 'satellite'>('osm');

  // Icona personalizzata per il PIN interattivo
  const creaIconaPin = useCallback(() => {
    return L.divIcon({
      className: 'custom-timbratura-pin',
      html: `
        <div style="
          position: relative;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6));
        ">
          <!-- Anello pulsante -->
          <div style="
            position: absolute;
            width: 42px;
            height: 42px;
            background: rgba(20, 184, 166, 0.35);
            border-radius: 50%;
            animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          
          <!-- Corpo PIN a goccia -->
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
            border: 2.5px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(13,148,136,0.5);
          ">
            <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: #ffffff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 38],
      popupAnchor: [0, -36]
    });
  }, []);

  // Reverse Geocoding via Nominatim
  const eseguiReverseGeocoding = useCallback(async (newLat: number, newLng: number) => {
    try {
      setInRicerca(true);
      setMessaggioStato('Rilevamento indirizzo della nuova posizione...');
      setTipoMessaggio('info');

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&addressdetails=1&zoom=18`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'it-IT,it;q=0.9',
          'User-Agent': 'CroceOroMassaCarrara-App/1.0'
        }
      });

      if (!res.ok) throw new Error('Risposta di rete non valida');
      const data = await res.json();

      let indFinale = '';
      if (data && data.address) {
        const addr = data.address;
        const via = addr.road || addr.pedestrian || addr.street || addr.neighbourhood || '';
        const civico = addr.house_number || '';
        const comune = addr.city || addr.town || addr.village || addr.municipality || 'Massa';
        const cap = addr.postcode || '';
        const prov = addr.county_code ? addr.county_code.toUpperCase() : 'MS';

        const parti = [];
        if (via) parti.push(civico ? `${via} ${civico}` : via);
        if (cap || comune) parti.push(`${cap} ${comune}`.trim());
        if (prov) parti.push(`(${prov})`);
        indFinale = parti.join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || '';
      } else if (data && data.display_name) {
        indFinale = data.display_name.split(',').slice(0, 3).join(',');
      }

      setIndirizzoRilevato(indFinale || null);
      setMessaggioStato(indFinale ? `📍 Posizione: ${indFinale}` : `📍 Coordinate impostate: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}`);
      setTipoMessaggio('success');

      onPosizioneChange({
        lat: Number(newLat.toFixed(6)),
        lng: Number(newLng.toFixed(6)),
        indirizzo: indFinale || undefined
      });
    } catch {
      setMessaggioStato(`📍 Coordinate salvate: ${newLat.toFixed(5)}, ${newLng.toFixed(5)}`);
      setTipoMessaggio('info');
      onPosizioneChange({
        lat: Number(newLat.toFixed(6)),
        lng: Number(newLng.toFixed(6))
      });
    } finally {
      setInRicerca(false);
    }
  }, [onPosizioneChange]);

  // Cerca un indirizzo o toponimo (Forward Geocoding)
  const handleCercaIndirizzo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryRicerca.trim()) return;

    try {
      setInRicerca(true);
      setMessaggioStato(`Ricerca "${queryRicerca}" in corso...`);
      setTipoMessaggio('info');

      // Privilegia Massa Carrara / Toscana
      let queryCompleta = queryRicerca.trim();
      if (!queryCompleta.toLowerCase().includes('massa') && !queryCompleta.toLowerCase().includes('carrara') && !queryCompleta.toLowerCase().includes('toscana')) {
        queryCompleta += ', Massa Carrara';
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryCompleta)}&limit=1&addressdetails=1`;
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

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          mapInstanceRef.current.flyTo([newLat, newLng], 17, { duration: 1 });
          markerRef.current.setLatLng([newLat, newLng]);
          circleRef.current.setLatLng([newLat, newLng]);
        }

        const displayInd = item.display_name?.split(',').slice(0, 3).join(',') || queryRicerca;
        setIndirizzoRilevato(displayInd);
        setMessaggioStato(`✓ Luogo trovato: ${displayInd}`);
        setTipoMessaggio('success');

        onPosizioneChange({
          lat: Number(newLat.toFixed(6)),
          lng: Number(newLng.toFixed(6)),
          indirizzo: displayInd
        });
      } else {
        setMessaggioStato('⚠️ Nessun risultato trovato. Trascina direttamente il PIN sulla mappa.');
        setTipoMessaggio('warning');
      }
    } catch {
      setMessaggioStato('⚠️ Errore di connessione cartografica. Puoi spostare il PIN manualmente.');
      setTipoMessaggio('warning');
    } finally {
      setInRicerca(false);
    }
  };

  // Geolocalizzazione con GPS reale del dispositivo
  const handleGPSDispositivo = () => {
    if (!navigator.geolocation) {
      setMessaggioStato('⚠️ GPS non supportato dal browser.');
      setTipoMessaggio('warning');
      return;
    }

    setInGPS(true);
    setMessaggioStato('Rilevamento GPS del tuo dispositivo...');
    setTipoMessaggio('info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInGPS(false);
        const myLat = pos.coords.latitude;
        const myLng = pos.coords.longitude;

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          mapInstanceRef.current.flyTo([myLat, myLng], 18, { duration: 1 });
          markerRef.current.setLatLng([myLat, myLng]);
          circleRef.current.setLatLng([myLat, myLng]);
        }

        eseguiReverseGeocoding(myLat, myLng);
      },
      (err) => {
        setInGPS(false);
        setMessaggioStato(`⚠️ Errore GPS: ${err.message}. Puoi trascinare il PIN sulla mappa.`);
        setTipoMessaggio('warning');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Centra mappa e sposta PIN su coordinate arbitrarie
  const spostaPinSuCoordinate = (targetLat: number, targetLng: number, zoom = 17) => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.flyTo([targetLat, targetLng], zoom, { duration: 0.8 });
      markerRef.current.setLatLng([targetLat, targetLng]);
      circleRef.current.setLatLng([targetLat, targetLng]);
    }
    eseguiReverseGeocoding(targetLat, targetLng);
  };

  // Inizializzazione Mappa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const latInit = Number(lat) || 44.0365;
    const lngInit = Number(lng) || 10.1415;
    const raggioInit = Math.max(5, Number(raggioMetri) || 20);

    // Se esiste già un'istanza, la rimuoviamo prima di ricrearla
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch {
        // ignora
      }
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latInit, lngInit],
      zoom: 17,
      zoomControl: true,
      attributionControl: false
    });

    const tileLayerOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Marker Draggable con PIN animato
    const marker = L.marker([latInit, lngInit], {
      icon: creaIconaPin(),
      draggable: true,
      autoPan: true
    }).addTo(map);

    // Cerchio del Raggio di Validità Timbratura
    const circle = L.circle([latInit, lngInit], {
      radius: raggioInit,
      color: '#0d9488',
      weight: 2,
      opacity: 0.85,
      fillColor: '#14b8a6',
      fillOpacity: 0.22,
      dashArray: '4, 4'
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 11px; text-align: center; color: #0f172a; min-width: 160px;">
        <strong style="color: #0d9488; font-size: 12px; display: block; margin-bottom: 3px;">📍 ${nomeLuogo || 'Nuovo Luogo Timbratura'}</strong>
        <span style="font-weight: 600; color: #334155; display: block;">Raggio di Validità: <strong>${raggioInit}m</strong></span>
        <span style="font-size: 10px; color: #64748b; margin-top: 4px; display: block;">
          Trascina questo PIN o clicca su un punto della mappa per riposizionarlo.
        </span>
      </div>
    `);

    // Gestione Evento Drag del Marker
    marker.on('drag', () => {
      const pos = marker.getLatLng();
      circle.setLatLng(pos);
    });

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      circle.setLatLng(pos);
      eseguiReverseGeocoding(pos.lat, pos.lng);
    });

    // Gestione Evento Click sulla Mappa: sposta il PIN al punto cliccato
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      marker.setLatLng([clickLat, clickLng]);
      circle.setLatLng([clickLat, clickLng]);
      eseguiReverseGeocoding(clickLat, clickLng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Invalida dimensioni dopo il rendering del DOM
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      try {
        map.remove();
      } catch {
        // ignora
      }
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [creaIconaPin]); // Inizializza al mount

  // Aggiorna posizione Marker & Cerchio se cambiano da props esterne (es. preset cliccato da fuori)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    const curMarkerPos = markerRef.current.getLatLng();
    const diffLat = Math.abs(curMarkerPos.lat - lat);
    const diffLng = Math.abs(curMarkerPos.lng - lng);

    // Solo se la differenza è significativa (non dovuta a drag interno)
    if (diffLat > 0.00005 || diffLng > 0.00005) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng]);
    }
  }, [lat, lng]);

  // Aggiorna dinamicamente il Raggio del cerchio quando cambia lo slider / input
  useEffect(() => {
    if (circleRef.current) {
      const r = Math.max(5, Number(raggioMetri) || 20);
      circleRef.current.setRadius(r);
    }
  }, [raggioMetri]);

  return (
    <div className="space-y-2 bg-slate-950 p-3 sm:p-3.5 rounded-2xl border-2 border-teal-500/40 shadow-inner">
      {/* Header Mappa con Toolbar Ricerca e Strumenti */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold border border-teal-500/40">
            <Compass className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
              <span>Geolocalizzazione PIN su Mappa</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono text-[10px]">
                Raggio: {raggioMetri}m
              </span>
            </span>
            <span className="text-[10px] text-slate-400 block">
              Trascina il PIN o clicca ovunque sulla mappa per posizionare il punto di timbratura
            </span>
          </div>
        </div>

        {/* Pulsanti Rapidi Posizione */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <button
            type="button"
            onClick={handleGPSDispositivo}
            disabled={inGPS}
            className="px-2.5 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-600/50 text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm"
            title="Sposta il PIN sulle coordinate GPS del tuo smartphone o computer"
          >
            <Navigation className={`w-3.5 h-3.5 text-blue-400 ${inGPS ? 'animate-spin' : ''}`} />
            <span>{inGPS ? 'Rilevamento...' : 'Mio GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current && markerRef.current) {
                mapInstanceRef.current.setView(markerRef.current.getLatLng(), 18);
              }
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Centra vista sul PIN"
          >
            <Crosshair className="w-3.5 h-3.5 text-teal-400" />
          </button>
        </div>
      </div>

      {/* Barra di Ricerca Indirizzo / Luogo */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={queryRicerca}
            onChange={(e) => setQueryRicerca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCercaIndirizzo();
              }
            }}
            placeholder="Cerca via, piazza o edificio (es. Ospedale NOA, Piazza Betti, Viale Roma...)"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400 font-medium"
          />
        </div>
        <button
          type="button"
          onClick={() => handleCercaIndirizzo()}
          disabled={inRicerca || !queryRicerca.trim()}
          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs uppercase flex items-center gap-1 transition-all cursor-pointer shrink-0"
        >
          <Search className="w-3 h-3" />
          <span>Trova</span>
        </button>
      </div>

      {/* Contenitore Mappa Leaflet */}
      <div className="relative rounded-2xl overflow-hidden border border-teal-500/30 shadow-lg bg-slate-900">
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '310px' }}
          className="z-0"
        />

        {/* Badge Flottante in sovraimpressione con Istruzioni */}
        <div className="absolute top-2 left-2 z-[400] pointer-events-none">
          <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-teal-500/40 text-[10.5px] font-bold text-teal-300 shadow-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block"></span>
            <span>📍 Clicca o trascina il PIN per posizionare</span>
          </div>
        </div>

        {/* Legenda Cerchio Raggio */}
        <div className="absolute bottom-2 right-2 z-[400] pointer-events-none">
          <div className="bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 shadow-md flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-teal-400 bg-teal-500/30 inline-block"></span>
            <span>Raggio Timbratura: <strong>{raggioMetri}m</strong></span>
          </div>
        </div>
      </div>

      {/* Info Posizione Rilevata e Coordinate Live */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span className="truncate">
            {indirizzoRilevato || indirizzoAttuale || 'Indirizzo rilevato dalle coordinate del PIN'}
          </span>
          {indirizzoRilevato && indirizzoRilevato !== indirizzoAttuale && (
            <button
              type="button"
              onClick={() => {
                onPosizioneChange({
                  lat: Number(lat.toFixed(6)),
                  lng: Number(lng.toFixed(6)),
                  indirizzo: indirizzoRilevato
                });
                setMessaggioStato('✓ Indirizzo applicato al modulo!');
                setTipoMessaggio('success');
              }}
              className="ml-1 px-2 py-0.5 rounded-lg bg-teal-900/60 hover:bg-teal-800 text-teal-200 border border-teal-600/40 font-bold text-[10px] cursor-pointer shrink-0"
              title="Copia questo indirizzo nel campo 'Indirizzo Completo'"
            >
              Applica Indirizzo
            </button>
          )}
        </div>

        <div className="text-[10px] font-mono text-slate-400 shrink-0 self-end sm:self-center">
          Lat: <strong className="text-white">{Number(lat).toFixed(6)}</strong> • Lng: <strong className="text-white">{Number(lng).toFixed(6)}</strong>
        </div>
      </div>

      {/* Stato o Feedback */}
      {messaggioStato && (
        <div className={`p-2 rounded-xl text-[10.5px] font-semibold flex items-center justify-between gap-2 ${
          tipoMessaggio === 'success' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200' :
          tipoMessaggio === 'warning' ? 'bg-amber-950/60 border border-amber-500/40 text-amber-200' :
          'bg-slate-900 border border-slate-700 text-slate-300'
        }`}>
          <span>{messaggioStato}</span>
          <button
            type="button"
            onClick={() => setMessaggioStato(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottoni Rapidi Centra su Luoghi Noti del Territorio */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] text-slate-400">
        <span className="font-bold text-slate-500">Centra PIN su:</span>
        {[
          { nome: 'Massa Sede', lat: 44.0365, lng: 10.1415 },
          { nome: 'Ospedale NOA', lat: 44.0289, lng: 10.1264 },
          { nome: 'Marina di Massa', lat: 44.0042, lng: 10.1118 },
          { nome: 'Carrara Centro', lat: 44.0789, lng: 10.1015 },
          { nome: 'CarraraFiere', lat: 44.0456, lng: 10.0412 },
          { nome: 'Forte dei Marmi', lat: 43.9575, lng: 10.1742 },
          { nome: 'Aulla', lat: 44.2128, lng: 9.9678 }
        ].map((p) => (
          <button
            key={p.nome}
            type="button"
            onClick={() => spostaPinSuCoordinate(p.lat, p.lng)}
            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
          >
            {p.nome}
          </button>
        ))}
      </div>
    </div>
  );
};
