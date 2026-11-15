import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Patch di sicurezza preventiva globale per Leaflet contro TypeError reading '_leaflet_pos'
if (typeof window !== 'undefined') {
  try {
    if (L.DomUtil) {
      const origGetPos = L.DomUtil.getPosition;
      L.DomUtil.getPosition = function (el: any) {
        if (!el || typeof el !== 'object') {
          return new L.Point(0, 0);
        }
        try {
          return origGetPos.call(this, el) || new L.Point(0, 0);
        } catch {
          return (el && el._leaflet_pos) || new L.Point(0, 0);
        }
      };

      const origSetPos = L.DomUtil.setPosition;
      L.DomUtil.setPosition = function (el: any, point: any) {
        if (!el || typeof el !== 'object') {
          return;
        }
        try {
          origSetPos.call(this, el, point);
        } catch {
          if (el) el._leaflet_pos = point;
        }
      };
    }

    if (L.PosAnimation && L.PosAnimation.prototype) {
      const origRun = L.PosAnimation.prototype.run;
      L.PosAnimation.prototype.run = function (el: any, newPos: any, duration: any, easeLinearity: any) {
        if (!el) {
          return this;
        }
        try {
          return origRun.call(this, el, newPos, duration, easeLinearity);
        } catch {
          return this;
        }
      };
    }

    if (L.Popup && L.Popup.prototype) {
      const origAdjustPan = (L.Popup.prototype as any)._adjustPan;
      (L.Popup.prototype as any)._adjustPan = function () {
        if (!this._map || !this._container) {
          return;
        }
        try {
          return origAdjustPan.call(this);
        } catch {
          return;
        }
      };
    }

    if (L.Map && L.Map.prototype) {
      const origGetMapPanePos = (L.Map.prototype as any)._getMapPanePos;
      (L.Map.prototype as any)._getMapPanePos = function () {
        if (!this._mapPane) {
          return new L.Point(0, 0);
        }
        try {
          return origGetMapPanePos.call(this) || new L.Point(0, 0);
        } catch {
          return new L.Point(0, 0);
        }
      };
    }

    if (L.Marker && L.Marker.prototype) {
      const origSetPos = (L.Marker.prototype as any)._setPos;
      (L.Marker.prototype as any)._setPos = function (pos: any) {
        if (!this._icon) {
          return;
        }
        try {
          return origSetPos.call(this, pos);
        } catch {
          return;
        }
      };
    }
  } catch (err) {
    console.warn('[Leaflet Safeguard] Inizializzazione protezioni:', err);
  }
}
import {
  Navigation,
  Locate,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  Radio,
  RefreshCw,
  Play,
  Pause,
  Gauge,
  Layers,
  Crosshair,
  Share2,
  Building2,
  Phone,
  Lock,
  History,
  Rewind,
  FastForward,
  RotateCcw,
  Download,
  Route,
  X
} from 'lucide-react';
import { SEDI_CROCE_ORO, SedeCroceOro } from '../data/sediCroceOro';
import { formatISODateItaly, formatTimeItaly } from '../utils/italianTime';

export interface PosizioneGPS {
  lat: number;
  lng: number;
  accuratezza?: number;
  velocita?: number | null;
  orario: string;
  indirizzoRilevato?: string;
  heading?: number;
}

export interface PuntoCronologiaGPS {
  id: string;
  lat: number;
  lng: number;
  orario: string;
  velocita: number;
  heading: number;
  accuratezza?: number;
  timestamp: number;
}

interface MappaOperativaProps {
  posizioneMezzo: PosizioneGPS;
  indirizzoObiettivo?: string;
  coordinateObiettivo?: { lat: number; lng: number };
  indirizzoDestinazione?: string;
  coordinateDestinazione?: { lat: number; lng: number };
  nomeMezzo?: string;
  codiceMissione?: string;
  statoMissione?: string;
  onAggiornaPosizione?: () => void;
  onAggiornaCoordinate?: (nuovaPos: PosizioneGPS) => void;
  onCondividiPosizione?: () => void;
  haDichiaratoPartenza?: boolean;
  autoMovimento?: boolean;
}

// Coordinate waypoint stradali realistiche attorno a Massa Carrara e Litorale
const WAYPOINTS_MASSA_CARRARA = [
  { lat: 44.0357, lng: 10.1415 }, // Sede Croce Oro Massa
  { lat: 44.0372, lng: 10.1340 }, // Viale Roma
  { lat: 44.0321, lng: 10.1190 }, // Direzione Mare
  { lat: 44.0245, lng: 10.1080 }, // Incrocio Aurelia
  { lat: 44.0150, lng: 10.0910 }, // Verso Marina di Massa
  { lat: 44.0085, lng: 10.0750 }, // Lungomare Vespucci
  { lat: 44.0130, lng: 10.0620 }, // Litoranea Marina di Massa
  { lat: 44.0280, lng: 10.0540 }, // Viale Colombo
  { lat: 44.0430, lng: 10.0520 }, // Marina di Carrara Porto
  { lat: 44.0480, lng: 10.0720 }, // Viale XX Settembre
  { lat: 44.0440, lng: 10.1050 }, // Rientro Carrara-Massa
  { lat: 44.0380, lng: 10.1320 }, // Centro Massa
];

export const MappaOperativa: React.FC<MappaOperativaProps> = ({
  posizioneMezzo,
  coordinateObiettivo = { lat: 44.0430, lng: 10.0520 },
  indirizzoObiettivo = 'Marina di Massa / Carrara',
  indirizzoDestinazione,
  coordinateDestinazione,
  nomeMezzo = 'T4606 AMBULANZA',
  codiceMissione,
  statoMissione = 'IN SERVIZIO',
  onAggiornaPosizione,
  onAggiornaCoordinate,
  onCondividiPosizione,
  haDichiaratoPartenza = false,
  autoMovimento = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mezzoMarkerRef = useRef<L.Marker | null>(null);
  const accuratezzaCircleRef = useRef<L.Circle | null>(null);
  const obiettivoMarkerRef = useRef<L.Marker | null>(null);
  const destinazioneMarkerRef = useRef<L.Marker | null>(null);
  const sediMarkersRef = useRef<L.Marker[]>([]);
  const rottaLineRef = useRef<L.Polyline | null>(null);
  const rottaDestinazioneLineRef = useRef<L.Polyline | null>(null);
  const sciaTracciatoRef = useRef<L.Polyline | null>(null);
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const replayLineRef = useRef<L.Polyline | null>(null);
  const replayWaypointMarkersRef = useRef<L.Marker[]>([]);

  const [currentZoom, setCurrentZoom] = useState<number>(15);
  const [tipoMappa, setTipoMappa] = useState<'streets' | 'satellite'>('streets');
  const [seguiMezzoContinuo, setSeguiMezzoContinuo] = useState<boolean>(true);
  const [movimentoLiveAttivo, setMovimentoLiveAttivo] = useState<boolean>(Boolean(autoMovimento));
  const [velocitaIstantanea, setVelocitaIstantanea] = useState<number>(45);
  const [angoloPrua, setAngoloPrua] = useState<number>(285);
  const [tracciaPosizioni, setTracciaPosizioni] = useState<[number, number][]>([]);

  // Cronologia GPS del mezzo per revisione percorso missione
  const [cronologiaGPS, setCronologiaGPS] = useState<PuntoCronologiaGPS[]>(() => {
    try {
      const key = `croceoro_gps_history_${codiceMissione || 'corrente'}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    // Punti iniziali realistici basati sul percorso di partenza dalla Sede verso il litorale
    const baseTime = Date.now() - 12 * 60 * 1000;
    return WAYPOINTS_MASSA_CARRARA.slice(0, 5).map((wp, idx) => ({
      id: `pt-init-${idx}`,
      lat: wp.lat,
      lng: wp.lng,
      orario: formatTimeItaly(baseTime + idx * 2.2 * 60 * 1000, true),
      velocita: 40 + (idx % 3) * 9,
      heading: 265 + idx * 12,
      accuratezza: 8,
      timestamp: baseTime + idx * 2.2 * 60 * 1000
    }));
  });

  // Modalità Revisione Cronologia Percorso GPS
  const [modalitaRivediPercorso, setModalitaRivediPercorso] = useState<boolean>(false);
  const [indiceReplay, setIndiceReplay] = useState<number>(0);
  const [inRiproduzioneReplay, setInRiproduzioneReplay] = useState<boolean>(false);
  const [velocitaReplay, setVelocitaReplay] = useState<number>(1);
  const [mostraTuttiPuntiWaypoint, setMostraTuttiPuntiWaypoint] = useState<boolean>(false);

  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const waypointIndexRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lng: number }>({ lat: posizioneMezzo.lat, lng: posizioneMezzo.lng });

  // Calcolo direzione prua / angolo di marcia in gradi tra due coordinate
  const calcolaBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  };

  // Creazione grafica SVG personalizzata in base al modello di veicolo effettivo in turno
  const creaIconaMezzoSVG = (siglaMezzo: string, headingDeg: number, isMoving: boolean) => {
    const deg = Math.round(headingDeg);
    const upper = (siglaMezzo || '').toUpperCase();

    // 1. T4607 & T4613: Fuoristrada 4x4 Protezione Civile
    const isFuoristradaPC = upper.includes('T4607') || upper.includes('T4613');
    // 2. T4608: Fiat Doblò Giallo
    const isDobloGiallo = upper.includes('T4608');
    // 3. T4615: Furgone Bianco
    const isFurgoneBianco = upper.includes('T4615');
    // 4. T4611: Pullman Piccolo
    const isPullmanPiccolo = upper.includes('T4611');

    let vehicleSVG = '';
    let badgeText = '';

    if (isFuoristradaPC) {
      badgeText = `🚙 ${siglaMezzo.split(' ')[0]} PC 4x4`;
      vehicleSVG = `
        <svg width="48" height="26" viewBox="0 0 52 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Ombra sotto scocca fuoristrada -->
          <rect x="2" y="3" width="48" height="22" rx="5" fill="#090d16" opacity="0.4"/>
          <!-- 4 Ruote Tassellate larghe da Fuoristrada 4x4 -->
          <rect x="7" y="0.5" width="9" height="4.5" rx="1.5" fill="#0f172a" stroke="#475569" stroke-width="0.8"/>
          <rect x="35" y="0.5" width="9" height="4.5" rx="1.5" fill="#0f172a" stroke="#475569" stroke-width="0.8"/>
          <rect x="7" y="23" width="9" height="4.5" rx="1.5" fill="#0f172a" stroke="#475569" stroke-width="0.8"/>
          <rect x="35" y="23" width="9" height="4.5" rx="1.5" fill="#0f172a" stroke="#475569" stroke-width="0.8"/>

          <!-- Scocca Fuoristrada Blu Navy Protezione Civile -->
          <rect x="4" y="3.5" width="44" height="21" rx="4" fill="#0a327d" stroke="#f59e0b" stroke-width="1.2"/>
          
          <!-- Cofano robusto e parabrezza squadrato -->
          <path d="M37 5 C41 5, 45 7, 47 14 C45 21, 41 23, 37 23 Z" fill="#1e3a8a"/>
          <path d="M35 7.5 L42 8 L42 20 L35 20.5 Z" fill="#020617"/>

          <!-- Fasce laterali Arancio Alta Visibilità Protezione Civile -->
          <rect x="10" y="4" width="24" height="2.5" fill="#f97316"/>
          <rect x="10" y="21.5" width="24" height="2.5" fill="#f97316"/>

          <!-- Stemma Protezione Civile sul Tetto (Cerchio Blu + Triangolo Arancione) -->
          <circle cx="22" cy="14" r="5" fill="#ffffff" stroke="#0a327d" stroke-width="0.8"/>
          <polygon points="22,10 25.5,16.5 18.5,16.5" fill="#f97316"/>

          <!-- Barre portapacchi / roll-bar tetto -->
          <line x1="12" y1="9" x2="33" y2="9" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="12" y1="19" x2="33" y2="19" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>

          <!-- Lampeggianti LED Blu d'Emergenza sul Tetto -->
          <circle cx="31" cy="8" r="2.2" fill="#38bdf8"/>
          <circle cx="31" cy="20" r="2.2" fill="#2563eb"/>
        </svg>
      `;
    } else if (isDobloGiallo) {
      badgeText = `🚐 ${siglaMezzo.split(' ')[0]} Doblò Giallo`;
      vehicleSVG = `
        <svg width="46" height="24" viewBox="0 0 50 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Ombra -->
          <rect x="2" y="2.5" width="46" height="21" rx="5" fill="#090d16" opacity="0.4"/>
          <!-- 4 Ruote -->
          <rect x="8" y="1" width="7" height="3" rx="1" fill="#1e293b"/>
          <rect x="34" y="1" width="7" height="3" rx="1" fill="#1e293b"/>
          <rect x="8" y="22" width="7" height="3" rx="1" fill="#1e293b"/>
          <rect x="34" y="22" width="7" height="3" rx="1" fill="#1e293b"/>

          <!-- Carrozzeria Fiat Doblò Giallo Oro Ufficiale -->
          <rect x="5" y="3" width="40" height="20" rx="4.5" fill="#facc15" stroke="#ca8a04" stroke-width="1.2"/>
          
          <!-- Parabrezza Anteriore Arrotondato Doblò -->
          <path d="M35 4.5 C39 4.5, 42 6.5, 43 13 C42 19.5, 39 21.5, 35 21.5 Z" fill="#fef08a"/>
          <path d="M33 6.5 C36 6.5, 39 8.5, 40 13 C39 17.5, 36 19.5, 33 19.5 Z" fill="#0f172a"/>

          <!-- Fasce Blu Croce Oro sui bordi -->
          <rect x="10" y="3.5" width="22" height="2" fill="#0a327d"/>
          <rect x="10" y="20.5" width="22" height="2" fill="#0a327d"/>

          <!-- Stemma Croce Oro sul Tetto del Doblò -->
          <circle cx="21" cy="13" r="4.5" fill="#ffffff" stroke="#0a327d" stroke-width="0.8"/>
          <path d="M21 10.5 V15.5 M18.5 13 H23.5" stroke="#eab308" stroke-width="1.8" stroke-linecap="round"/>

          <!-- Lampeggiante sul tetto -->
          <circle cx="29" cy="8.5" r="2" fill="#38bdf8"/>
          <circle cx="29" cy="17.5" r="2" fill="#2563eb"/>
        </svg>
      `;
    } else if (isFurgoneBianco) {
      badgeText = `🚐 ${siglaMezzo.split(' ')[0]} Furgone Bianco`;
      vehicleSVG = `
        <svg width="48" height="24" viewBox="0 0 54 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Ombra sotto scocca -->
          <rect x="2" y="2.5" width="50" height="21" rx="4" fill="#090d16" opacity="0.4"/>
          <!-- 4 Ruote -->
          <rect x="9" y="1" width="7" height="3" rx="1" fill="#1e293b"/>
          <rect x="38" y="1" width="7" height="3" rx="1" fill="#1e293b"/>
          <rect x="9" y="22" width="7" height="3" rx="1" fill="#1e293b"/>
          <rect x="38" y="22" width="7" height="3" rx="1" fill="#1e293b"/>

          <!-- Carrozzeria Furgone Bianco Ducato/Transit pulito -->
          <rect x="4" y="3" width="46" height="20" rx="3.5" fill="#ffffff" stroke="#94a3b8" stroke-width="1.2"/>
          
          <!-- Parabrezza Anteriore Furgone -->
          <path d="M40 4.5 C44 4.5, 47 6.5, 48 13 C47 19.5, 44 21.5, 40 21.5 Z" fill="#e2e8f0"/>
          <path d="M38 6.5 C41 6.5, 44 8.5, 45 13 C44 17.5, 41 19.5, 38 19.5 Z" fill="#0f172a"/>

          <!-- Listello di protezione laterale nero -->
          <rect x="8" y="3.5" width="28" height="1.2" fill="#475569"/>
          <rect x="8" y="21.3" width="28" height="1.2" fill="#475569"/>

          <!-- Targa / Sigla sul tetto -->
          <rect x="18" y="9" width="13" height="8" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8"/>
          <text x="24.5" y="15" font-size="6.5" font-weight="900" fill="#0a327d" text-anchor="middle" font-family="sans-serif">T4615</text>

          <!-- Lampeggiante sul tetto -->
          <circle cx="34" cy="8" r="2" fill="#38bdf8"/>
          <circle cx="34" cy="18" r="2" fill="#2563eb"/>
        </svg>
      `;
    } else if (isPullmanPiccolo) {
      badgeText = `🚌 ${siglaMezzo.split(' ')[0]} Pullman Piccolo`;
      vehicleSVG = `
        <svg width="52" height="24" viewBox="0 0 58 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Ombra -->
          <rect x="2" y="2.5" width="54" height="21" rx="3" fill="#090d16" opacity="0.4"/>
          <!-- 4 Ruote Minibus -->
          <rect x="10" y="1" width="8" height="3" rx="1" fill="#1e293b"/>
          <rect x="42" y="1" width="8" height="3" rx="1" fill="#1e293b"/>
          <rect x="10" y="22" width="8" height="3" rx="1" fill="#1e293b"/>
          <rect x="42" y="22" width="8" height="3" rx="1" fill="#1e293b"/>

          <!-- Carrozzeria Allungata Minibus Pullman Piccolo -->
          <rect x="4" y="3" width="50" height="20" rx="3" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
          
          <!-- Parabrezza Panoramico da Pullman -->
          <path d="M46 4.5 C49 4.5, 51 6.5, 52 13 C51 19.5, 49 21.5, 46 21.5 Z" fill="#e0f2fe"/>
          <path d="M44 6 C47 6, 49 8, 50 13 C49 18, 47 20, 44 20 Z" fill="#0f172a"/>

          <!-- Grandi Finestrini Passeggeri Laterali Pullman -->
          <rect x="9" y="3.5" width="32" height="2" fill="#38bdf8"/>
          <rect x="9" y="20.5" width="32" height="2" fill="#38bdf8"/>

          <!-- Condizionatore d'aria sul tetto del Pullman -->
          <rect x="20" y="8" width="16" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
          <line x1="24" y1="10" x2="24" y2="16" stroke="#64748b" stroke-width="1"/>
          <line x1="28" y1="10" x2="28" y2="16" stroke="#64748b" stroke-width="1"/>
          <line x1="32" y1="10" x2="32" y2="16" stroke="#64748b" stroke-width="1"/>

          <!-- Lampeggianti -->
          <circle cx="42" cy="7.5" r="2" fill="#fbbf24"/>
          <circle cx="42" cy="18.5" r="2" fill="#fbbf24"/>
        </svg>
      `;
    } else {
      // 5. Default: Ambulanza di Soccorso con livrea ad alta visibilità
      badgeText = `🚑 ${siglaMezzo.split(' ')[0]}`;
      vehicleSVG = `
        <svg width="44" height="24" viewBox="0 0 52 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Ombra sotto scocca -->
          <rect x="2" y="3" width="48" height="22" rx="6" fill="#090d16" opacity="0.4"/>
          
          <!-- 4 Ruote dell'Ambulanza -->
          <rect x="8" y="1" width="8" height="3.5" rx="1.5" fill="#1e293b"/>
          <rect x="36" y="1" width="8" height="3.5" rx="1.5" fill="#1e293b"/>
          <rect x="8" y="23.5" width="8" height="3.5" rx="1.5" fill="#1e293b"/>
          <rect x="36" y="23.5" width="8" height="3.5" rx="1.5" fill="#1e293b"/>

          <!-- Corpo Principale Ambulanza (Bianco Soccorso con Profilo Arrotondato) -->
          <rect x="4" y="3" width="44" height="22" rx="5" fill="#ffffff" stroke="#bfa353" stroke-width="1.2"/>
          
          <!-- Cofano e Parabrezza Anteriore (Fronte Mezzo verso destra a 0°) -->
          <path d="M38 4.5 C42 4.5, 46 6.5, 47 14 C46 21.5, 42 23.5, 38 23.5 Z" fill="#f8fafc"/>
          <path d="M36 7 C39 7, 42 9, 43 14 C42 19, 39 21, 36 21 Z" fill="#0f172a"/>
          
          <!-- Specchietti retrovisori -->
          <rect x="35" y="1.5" width="2" height="2" rx="0.5" fill="#ffffff"/>
          <rect x="35" y="24.5" width="2" height="2" rx="0.5" fill="#ffffff"/>

          <!-- Livrea Battenburg d'emergenza Giallo Alta Visibilità & Arancione -->
          <rect x="10" y="3.5" width="26" height="3.5" fill="#facc15"/>
          <rect x="10" y="21" width="26" height="3.5" fill="#facc15"/>
          <rect x="14" y="3.5" width="5" height="3.5" fill="#ea580c"/>
          <rect x="24" y="3.5" width="5" height="3.5" fill="#ea580c"/>
          <rect x="14" y="21" width="5" height="3.5" fill="#ea580c"/>
          <rect x="24" y="21" width="5" height="3.5" fill="#ea580c"/>

          <!-- Croce Rossa / Stemma di Soccorso sul Tetto -->
          <rect x="20" y="9.5" width="10" height="9" rx="2" fill="#1d1a60" stroke="#bfa353" stroke-width="0.8"/>
          <path d="M25 11 V17 M22 14 H28" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/>

          <!-- Lampeggianti LED Blu d'Emergenza sul Tetto -->
          <circle cx="32" cy="7.5" r="2.2" fill="#38bdf8"/>
          <circle cx="32" cy="20.5" r="2.2" fill="#2563eb"/>
          
          <!-- Lampeggianti Posteriori -->
          <circle cx="6.5" cy="7" r="1.5" fill="#ef4444"/>
          <circle cx="6.5" cy="21" r="1.5" fill="#ef4444"/>
        </svg>
      `;
    }

    return L.divIcon({
      className: 'custom-vehicle-pin',
      html: `
        <div style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
          <!-- Radar beacon pulse a onde concentriche sotto le ruote del veicolo -->
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background: radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0) 70%); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          
          <!-- Raggio di proiezione fari anteriori (orientato con la prua) -->
          <div style="position: absolute; transform: rotate(${deg}deg); transform-origin: center center; width: 64px; height: 64px; pointer-events: none; transition: transform 0.6s ease-out;">
            <div style="position: absolute; top: -6px; left: 16px; width: 32px; height: 24px; background: linear-gradient(to top, rgba(254, 240, 138, 0.45), rgba(254, 240, 138, 0)); clip-path: polygon(30% 100%, 70% 100%, 100% 0%, 0% 0%);"></div>
          </div>

          <!-- Modello Sagoma Veicolo orientata con la prua di marcia -->
          <div style="transform: rotate(${deg}deg); transform-origin: center center; transition: transform 0.5s ease-out; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));">
            ${vehicleSVG}
          </div>

          <!-- Badge fluttuante identificativo mezzo -->
          <div style="position: absolute; bottom: -8px; background: rgba(15,23,42,0.95); border: 1px solid #bfa353; border-radius: 6px; padding: 1px 5px; font-family: monospace; font-size: 9px; font-weight: 900; color: #facc15; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
            ${badgeText}
          </div>
        </div>
      `,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
      popupAnchor: [0, -28]
    });
  };

  // Inizializzazione Mappa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [posizioneMezzo.lat, posizioneMezzo.lng],
        zoom: 15,
        zoomControl: false,
        scrollWheelZoom: false
      });

      // Layer Stradale OpenStreetMap con rendering veloce
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        updateWhenIdle: false,
        updateWhenZooming: true
      }).addTo(map);

      // Protezione totale da errori interni Leaflet: se _rawPanBy viene chiamato prima che _mapPane sia posizionato o dopo lo smontaggio
      const origRawPanBy = (map as any)._rawPanBy;
      if (typeof origRawPanBy === 'function') {
        (map as any)._rawPanBy = function(offset: any) {
          if (!this._mapPane) return;
          try {
            origRawPanBy.call(this, offset);
          } catch {}
        };
      }

      tileLayerRef.current = streetLayer;
      mapInstanceRef.current = map;

      // Invalida dimensione per assicurare rendering perfetto e centratura esatta (con controllo sicuro _mapPane)
      const safeInvalidateSize = () => {
        const m = mapInstanceRef.current;
        if (!m) return;
        try {
          const mAny = m as any;
          if (mAny._loaded && mAny._mapPane && mapContainerRef.current?.isConnected) {
            m.invalidateSize({ pan: false });
          }
        } catch {}
      };

      const timer = setTimeout(() => {
        safeInvalidateSize();
      }, 300);

      const handleResize = () => {
        safeInvalidateSize();
      };
      window.addEventListener('resize', handleResize);

      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      // Se l'utente trascina manualmente la mappa o zooma, sospendiamo l'autofollow finché non ricentra
      map.on('dragstart', () => {
        setSeguiMezzoContinuo(false);
      });
      map.on('zoomstart', () => {
        setSeguiMezzoContinuo(false);
      });

      // Disegna SEMPRE le Sedi Ufficiali dell'Associazione (Massa, Carrara, Pietrasanta, Lunigiana) con pin dorato e blu navy ad alta visibilità
      SEDI_CROCE_ORO.forEach(sede => {
        const sedeIcon = L.divIcon({
          className: 'custom-sede-pin',
          html: `
            <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <!-- Alone dorato attorno alla Sede -->
              <div style="position: absolute; inset: -4px; border-radius: 50%; background: radial-gradient(circle, rgba(250,204,21,0.5) 0%, rgba(250,204,21,0) 70%);"></div>
              <div style="width: 38px; height: 38px; background: #1d1a60; border: 3px solid #facc15; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.7);">
                <span style="font-size: 20px;">🏛️</span>
              </div>
              <div style="position: absolute; bottom: -13px; background: #1d1a60; border: 1.5px solid #facc15; border-radius: 6px; padding: 1px 5px; font-family: sans-serif; font-size: 9px; font-weight: 900; color: #facc15; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6); text-transform: uppercase;">
                🏛️ Sede ${sede.sezione}
              </div>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -24]
        });

        const marker = L.marker([sede.coordinate.lat, sede.coordinate.lng], {
          icon: sedeIcon,
          zIndexOffset: 600
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a; min-width: 220px;">
              <div style="font-weight: 900; color: #1d1a60; text-transform: uppercase; font-size: 13px;">
                🏛️ ${sede.nome}
              </div>
              <div style="color: #b45309; font-weight: 700; font-size: 11px; margin-top: 1px;">
                Sezione Territoriale di ${sede.sezione}
              </div>
              <div style="margin-top: 4px; font-size: 11px; color: #334155;">
                📍 <strong>${sede.indirizzoCompleto}</strong>
              </div>
              ${sede.telefono ? `
                <div style="margin-top: 3px; font-size: 11px;">
                  📞 <a href="tel:${sede.telefono.replace(/\s+/g, '')}" style="color: #059669; font-weight: 700; text-decoration: none;">${sede.telefono}</a>
                </div>
              ` : ''}
              <div style="margin-top: 4px; font-size: 10px; color: #64748b;">
                Servizi: ${sede.servizi.join(' • ')}
              </div>
              <div style="margin-top: 6px; padding-top: 5px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                <a href="${sede.googleMapsUrl || `https://www.google.com/maps?q=${sede.coordinate.lat},${sede.coordinate.lng}`}" target="_blank" rel="noreferrer" style="display: inline-flex; align-items: center; gap: 4px; background: #1d4ed8; color: #ffffff; padding: 3px 8px; border-radius: 6px; text-decoration: none; font-size: 10px; font-weight: bold;">
                  🗺️ Apri su Google Maps
                </a>
                <span style="font-size: 9px; font-family: monospace; color: #64748b;">${sede.coordinate.lat.toFixed(5)}, ${sede.coordinate.lng.toFixed(5)}</span>
              </div>
            </div>
          `, { autoPan: false });
        sediMarkersRef.current.push(marker);
      });

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
        if (mapInstanceRef.current) {
          try {
            (mapInstanceRef.current as any)._stop?.();
            mapInstanceRef.current.off();
            mapInstanceRef.current.remove();
          } catch {}
          mapInstanceRef.current = null;
        }
        mezzoMarkerRef.current = null;
        accuratezzaCircleRef.current = null;
        obiettivoMarkerRef.current = null;
        destinazioneMarkerRef.current = null;
        sediMarkersRef.current = [];
        rottaLineRef.current = null;
        rottaDestinazioneLineRef.current = null;
        sciaTracciatoRef.current = null;
      };
    }
  }, []);

  // Cambio tipo mappa (Stradale / Satellite ad alta risoluzione)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (tipoMappa === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri Satellite',
          maxZoom: 18
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(map);
    }
  }, [tipoMappa]);

  // Aggiornamento Fluido della Posizione dell'Ambulanza, Scia e Rotta
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const posMezzo = [posizioneMezzo.lat, posizioneMezzo.lng] as L.LatLngExpression;

    // Calcolo bearing reale se c'è stato spostamento
    let bearing = angoloPrua;
    if (lastPosRef.current.lat !== posizioneMezzo.lat || lastPosRef.current.lng !== posizioneMezzo.lng) {
      bearing = calcolaBearing(
        lastPosRef.current.lat,
        lastPosRef.current.lng,
        posizioneMezzo.lat,
        posizioneMezzo.lng
      );
      setAngoloPrua(bearing);
      lastPosRef.current = { lat: posizioneMezzo.lat, lng: posizioneMezzo.lng };
    }

    // Aggiungi punto alla scia di percorrenza e alla cronologia GPS completa della missione
    setTracciaPosizioni(prev => {
      const nuovoPunto: [number, number] = [posizioneMezzo.lat, posizioneMezzo.lng];
      if (prev.length === 0) return [nuovoPunto];
      const ultimo = prev[prev.length - 1];
      if (Math.abs(ultimo[0] - nuovoPunto[0]) > 0.00008 || Math.abs(ultimo[1] - nuovoPunto[1]) > 0.00008) {
        return [...prev.slice(-60), nuovoPunto];
      }
      return prev;
    });

    // Registra punto nella cronologia tracciamento GPS persistente
    setCronologiaGPS(prev => {
      const ultimo = prev[prev.length - 1];
      if (
        ultimo &&
        Math.abs(ultimo.lat - posizioneMezzo.lat) < 0.00008 &&
        Math.abs(ultimo.lng - posizioneMezzo.lng) < 0.00008
      ) {
        return prev;
      }
      const pt: PuntoCronologiaGPS = {
        id: `pt-${Date.now()}-${prev.length}`,
        lat: posizioneMezzo.lat,
        lng: posizioneMezzo.lng,
        orario: posizioneMezzo.orario || formatTimeItaly(undefined, true),
        velocita: Math.round(posizioneMezzo.velocita ?? velocitaIstantanea ?? 45),
        heading: Math.round(bearing),
        accuratezza: Math.round(posizioneMezzo.accuratezza || 10),
        timestamp: Date.now()
      };
      const aggiornata = [...prev, pt];
      try {
        localStorage.setItem(`croceoro_gps_history_${codiceMissione || 'corrente'}`, JSON.stringify(aggiornata));
      } catch {}
      return aggiornata;
    });

    // 1. Aggiorna o crea il marker del veicolo con la grafica specifica (Fuoristrada PC, Doblò Giallo, Furgone Bianco, Pullman Piccolo o Ambulanza)
    const vehicleIcon = creaIconaMezzoSVG(nomeMezzo, bearing, true);

    const isFuoristradaPC = (nomeMezzo || '').toUpperCase().includes('T4607') || (nomeMezzo || '').toUpperCase().includes('T4613');
    const isDobloGiallo = (nomeMezzo || '').toUpperCase().includes('T4608');
    const isFurgoneBianco = (nomeMezzo || '').toUpperCase().includes('T4615');
    const isPullmanPiccolo = (nomeMezzo || '').toUpperCase().includes('T4611');
    const tipoVeicoloNome = isFuoristradaPC ? 'Fuoristrada 4x4 Protezione Civile' : isDobloGiallo ? 'Fiat Doblò Giallo' : isFurgoneBianco ? 'Furgone Bianco' : isPullmanPiccolo ? 'Pullman Piccolo' : 'Ambulanza di Soccorso';
    const iconaVeicoloEmoji = isFuoristradaPC ? '🚙' : isDobloGiallo ? '🚐' : isFurgoneBianco ? '🚐' : isPullmanPiccolo ? '🚌' : '🚑';

    if (mezzoMarkerRef.current && (mezzoMarkerRef.current as any)._map) {
      // Movimento fluido verso le nuove coordinate
      try {
        mezzoMarkerRef.current.setLatLng(posMezzo);
        mezzoMarkerRef.current.setIcon(vehicleIcon);
      } catch {}
    } else {
      try {
        mezzoMarkerRef.current = L.marker(posMezzo, { icon: vehicleIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a; min-width: 180px;">
              <div style="font-weight: 900; color: #1d1a60; text-transform: uppercase; font-size: 13px;">
                ${iconaVeicoloEmoji} ${nomeMezzo}
              </div>
              <div style="color: #4338ca; font-weight: 700; font-size: 11px;">
                ${tipoVeicoloNome}
              </div>
              <div style="color: #059669; font-weight: 800; font-size: 11px; margin-top: 2px;">
                Stato Mezzo: ${statoMissione}
              </div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #475569;">
                <strong>Velocità:</strong> ${velocitaIstantanea} km/h<br/>
                <strong>Prua:</strong> ${Math.round(bearing)}°<br/>
                <strong>Coordinate:</strong> ${posizioneMezzo.lat.toFixed(5)}, ${posizioneMezzo.lng.toFixed(5)}<br/>
                <strong>Ultimo Fix:</strong> ${posizioneMezzo.orario}
              </div>
            </div>
          `, { autoPan: false });
      } catch {}
    }

    // Cerchio di accuratezza segnale GPS
    if (accuratezzaCircleRef.current) {
      accuratezzaCircleRef.current.setLatLng(posMezzo);
      accuratezzaCircleRef.current.setRadius(posizioneMezzo.accuratezza || 18);
    } else {
      accuratezzaCircleRef.current = L.circle(posMezzo, {
        radius: posizioneMezzo.accuratezza || 18,
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '3, 6'
      }).addTo(map);
    }

    // 2. Disegna la scia di percorso effettivamente percorsa dall'ambulanza
    if (tracciaPosizioni.length > 1) {
      if (sciaTracciatoRef.current) {
        sciaTracciatoRef.current.setLatLngs(tracciaPosizioni);
      } else {
        sciaTracciatoRef.current = L.polyline(tracciaPosizioni, {
          color: '#10b981',
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);
      }
    }

    // 3. Icona Obiettivo Intervento (SEMPRE visibile sulla mappa della Centrale con grafica rossa ad alta visibilità)
    const effCoordinateObiettivo = coordinateObiettivo || { lat: 44.0430, lng: 10.0520 };
    const effIndirizzoObiettivo = (indirizzoObiettivo && indirizzoObiettivo.trim()) || 'Marina di Massa (Piazza Betti / Litorale)';
    const posObiettivo = [effCoordinateObiettivo.lat, effCoordinateObiettivo.lng] as L.LatLngExpression;

    const targetIcon = L.divIcon({
      className: 'custom-target-pin',
      html: `
        <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; inset: -4px; background: #ef4444; border-radius: 50%; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 38px; height: 38px; background: #dc2626; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(220,38,38,0.7);">
            <span style="font-size: 20px;">🎯</span>
          </div>
          <div style="position: absolute; bottom: -13px; background: #991b1b; border: 1.5px solid #f87171; border-radius: 6px; padding: 1px 6px; font-family: sans-serif; font-size: 8.5px; font-weight: 900; color: #ffffff; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6); text-transform: uppercase;">
            🎯 OBIETTIVO
          </div>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
      popupAnchor: [0, -25]
    });

    if (obiettivoMarkerRef.current && (obiettivoMarkerRef.current as any)._map) {
      try {
        obiettivoMarkerRef.current.setLatLng(posObiettivo);
        obiettivoMarkerRef.current.setIcon(targetIcon);
      } catch {}
    } else {
      try {
        obiettivoMarkerRef.current = L.marker(posObiettivo, { icon: targetIcon, zIndexOffset: 800 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a; min-width: 200px;">
              <div style="font-weight: 900; color: #dc2626; text-transform: uppercase;">🎯 LUOGO DI OBIETTIVO</div>
              <div style="font-weight: 700; font-size: 11px; margin-top: 2px;">${effIndirizzoObiettivo}</div>
              ${codiceMissione ? `<div style="font-size: 10px; color: #2563eb; font-weight: 800; margin-top: 2px;">Missione: ${codiceMissione}</div>` : ''}
              <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Coordinate: ${effCoordinateObiettivo.lat.toFixed(5)}, ${effCoordinateObiettivo.lng.toFixed(5)}</div>
            </div>
          `, { autoPan: false });
      } catch {}
    }

    // Linea di Rotta / Congiungente Mezzo -> Obiettivo
    if (rottaLineRef.current) {
      rottaLineRef.current.setLatLngs([posMezzo, posObiettivo]);
    } else {
      rottaLineRef.current = L.polyline([posMezzo, posObiettivo], {
        color: '#ef4444',
        weight: 3,
        opacity: 0.75,
        dashArray: '6, 8'
      }).addTo(map);
    }

    // 4. Icona Luogo di Destinazione / Clinica / Ospedale (SEMPRE visibile sulla mappa della Centrale con grafica verde smeraldo)
    let posDestinazione: [number, number] = [44.0205, 10.1250]; // Default Ospedale delle Apuane (NOA) Massa
    let nomeDestinazioneEffettivo = (indirizzoDestinazione && indirizzoDestinazione.trim()) || 'Ospedale delle Apuane (NOA Massa)';

    if (coordinateDestinazione) {
      posDestinazione = [coordinateDestinazione.lat, coordinateDestinazione.lng];
    } else if (indirizzoDestinazione && indirizzoDestinazione.trim()) {
      const dLower = indirizzoDestinazione.toLowerCase();
      if (dLower.includes('monteverde') || dLower.includes('fossone') || dLower.includes('carrara')) {
        posDestinazione = [44.066716, 10.049207]; // Sede Carrara (Fossone)
      } else if (dLower.includes('como') || dLower.includes('ronchi')) {
        posDestinazione = [43.99419, 10.12367]; // Sede Legale Massa (Ronchi)
      } else if (dLower.includes('jare') || dLower.includes('massa')) {
        posDestinazione = [44.01700, 10.15121]; // Sede Operativa Massa (Le Jare)
      } else if (dLower.includes('pietrasanta') || dLower.includes('villeparisis')) {
        posDestinazione = [43.92771, 10.20194]; // Sede Pietrasanta
      } else if (dLower.includes('aulla') || dLower.includes('lunigiana')) {
        posDestinazione = [44.21455, 9.96779]; // Sede Lunigiana
      } else if (dLower.includes('haziel') || dLower.includes('santo stefano')) {
        posDestinazione = [44.1500, 9.9200]; // Clinica Haziel
      } else if (dLower.includes('ospedale') || dLower.includes('noa')) {
        posDestinazione = [44.0205, 10.1250]; // Ospedale NOA Massa
      } else {
        posDestinazione = [44.0205, 10.1250]; // Default Ospedale NOA Massa
      }
    }

    const destIcon = L.divIcon({
      className: 'custom-dest-pin',
      html: `
        <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; inset: -4px; background: #10b981; border-radius: 50%; opacity: 0.35; animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 38px; height: 38px; background: #059669; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(5,150,105,0.7);">
            <span style="font-size: 20px;">🏥</span>
          </div>
          <div style="position: absolute; bottom: -13px; background: #064e3b; border: 1.5px solid #34d399; border-radius: 6px; padding: 1px 6px; font-family: sans-serif; font-size: 8.5px; font-weight: 900; color: #6ee7b7; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6); text-transform: uppercase;">
            🏥 DESTINAZIONE
          </div>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
      popupAnchor: [0, -25]
    });

    if (destinazioneMarkerRef.current && (destinazioneMarkerRef.current as any)._map) {
      try {
        destinazioneMarkerRef.current.setLatLng(posDestinazione);
        destinazioneMarkerRef.current.setIcon(destIcon);
      } catch {}
    } else {
      try {
        destinazioneMarkerRef.current = L.marker(posDestinazione, { icon: destIcon, zIndexOffset: 750 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a; min-width: 200px;">
              <div style="font-weight: 900; color: #059669; text-transform: uppercase;">🏥 LUOGO DI DESTINAZIONE</div>
              <div style="font-weight: 700; font-size: 11px; margin-top: 2px;">${nomeDestinazioneEffettivo}</div>
              ${codiceMissione ? `<div style="font-size: 10px; color: #2563eb; font-weight: 800; margin-top: 2px;">Missione: ${codiceMissione}</div>` : ''}
              <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Coordinate: ${posDestinazione[0].toFixed(5)}, ${posDestinazione[1].toFixed(5)}</div>
            </div>
          `, { autoPan: false });
      } catch {}
    }

    // Linea congiungente Obiettivo -> Destinazione
    if (rottaDestinazioneLineRef.current) {
      rottaDestinazioneLineRef.current.setLatLngs([posObiettivo, posDestinazione]);
    } else {
      rottaDestinazioneLineRef.current = L.polyline([posObiettivo, posDestinazione], {
        color: '#10b981',
        weight: 3,
        opacity: 0.75,
        dashArray: '4, 6'
      }).addTo(map);
    }

    // Auto-centering: la mappa della centrale deve essere SEMPRE centrata sul mezzo sia che sia fermo sia che sia in movimento a meno che la centrale non la sposta
    if (seguiMezzoContinuo && map && (map as any)._loaded && (map as any)._mapPane && mapContainerRef.current?.isConnected) {
      try {
        (map as any)._stop?.();
        map.panTo([posizioneMezzo.lat, posizioneMezzo.lng], {
          animate: false
        });
      } catch {}
    }
  }, [
    posizioneMezzo,
    coordinateObiettivo,
    indirizzoObiettivo,
    coordinateDestinazione,
    indirizzoDestinazione,
    nomeMezzo,
    codiceMissione,
    statoMissione,
    seguiMezzoContinuo,
    velocitaIstantanea,
    angoloPrua,
    tracciaPosizioni
  ]);

  useEffect(() => {
    if (autoMovimento) {
      setMovimentoLiveAttivo(true);
    }
  }, [autoMovimento]);

  // SIMULATORE MOVIMENTO CONTINUO MEZZO IN TEMPO REALE (VELOCE E COSTANTE)
  useEffect(() => {
    if (!movimentoLiveAttivo) return;

    const interval = setInterval(() => {
      waypointIndexRef.current = (waypointIndexRef.current + 1) % WAYPOINTS_MASSA_CARRARA.length;
      const targetWaypoint = WAYPOINTS_MASSA_CARRARA[waypointIndexRef.current];

      // Step progressivo con piccolo jitter realistico per sembrare traffico reale
      const jitterLat = (Math.random() - 0.5) * 0.0006;
      const jitterLng = (Math.random() - 0.5) * 0.0006;
      const newLat = targetWaypoint.lat + jitterLat;
      const newLng = targetWaypoint.lng + jitterLng;

      const nuovaVel = 40 + Math.floor(Math.random() * 28); // 40-68 km/h
      setVelocitaIstantanea(nuovaVel);

      const nuovaPos: PosizioneGPS = {
        lat: newLat,
        lng: newLng,
        accuratezza: 6 + Math.floor(Math.random() * 6),
        velocita: nuovaVel,
        orario: formatTimeItaly(undefined, true)
      };

      if (onAggiornaCoordinate) {
        onAggiornaCoordinate(nuovaPos);
      }
    }, 1400); // Aggiornamento ogni 1.4 secondi per massima fluidità

    return () => clearInterval(interval);
  }, [movimentoLiveAttivo, onAggiornaCoordinate]);

  const centraSuMezzo = () => {
    if (mapInstanceRef.current && (mapInstanceRef.current as any)._mapPane) {
      try {
        (mapInstanceRef.current as any)._stop?.();
        mapInstanceRef.current.setView([posizioneMezzo.lat, posizioneMezzo.lng], 16, { animate: false });
        if (mezzoMarkerRef.current && (mezzoMarkerRef.current as any)._map) {
          mezzoMarkerRef.current.openPopup();
        }
      } catch {}
    }
  };

  const centraSuObiettivo = () => {
    if (mapInstanceRef.current && (mapInstanceRef.current as any)._mapPane) {
      try {
        (mapInstanceRef.current as any)._stop?.();
        mapInstanceRef.current.setView([coordinateObiettivo.lat, coordinateObiettivo.lng], 16, { animate: false });
        if (obiettivoMarkerRef.current && (obiettivoMarkerRef.current as any)._map) {
          obiettivoMarkerRef.current.openPopup();
        }
      } catch {}
    }
  };

  const adattaVistaGlobale = () => {
    if (mapInstanceRef.current && (mapInstanceRef.current as any)._mapPane) {
      try {
        (mapInstanceRef.current as any)._stop?.();
        const bounds = L.latLngBounds([
          [posizioneMezzo.lat, posizioneMezzo.lng],
          [coordinateObiettivo.lat, coordinateObiettivo.lng]
        ]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], animate: false });
      } catch {}
    }
  };

  // Gestione layer Leaflet per la modalità Revisione Percorso GPS (Replay)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!modalitaRivediPercorso) {
      if (replayMarkerRef.current) {
        try { map.removeLayer(replayMarkerRef.current); } catch {}
        replayMarkerRef.current = null;
      }
      if (replayLineRef.current) {
        try { map.removeLayer(replayLineRef.current); } catch {}
        replayLineRef.current = null;
      }
      replayWaypointMarkersRef.current.forEach((m) => {
        try { map.removeLayer(m); } catch {}
      });
      replayWaypointMarkersRef.current = [];
      return;
    }

    // Modalità Revisione Attiva: Disegna la linea dell'intero percorso della missione
    const latLngs = cronologiaGPS.map((p) => [p.lat, p.lng] as [number, number]);
    if (latLngs.length > 0) {
      if (replayLineRef.current) {
        replayLineRef.current.setLatLngs(latLngs);
      } else {
        replayLineRef.current = L.polyline(latLngs, {
          color: '#06b6d4',
          weight: 5,
          opacity: 0.9,
          dashArray: '8, 8',
          lineJoin: 'round'
        }).addTo(map);
      }

      // Marker waypoint numerati se attivo
      replayWaypointMarkersRef.current.forEach((m) => {
        try { map.removeLayer(m); } catch {}
      });
      replayWaypointMarkersRef.current = [];

      if (mostraTuttiPuntiWaypoint) {
        cronologiaGPS.forEach((pt, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === cronologiaGPS.length - 1;
          const pinColor = isFirst ? '#10b981' : isLast ? '#ef4444' : '#0284c7';
          const pinIcon = L.divIcon({
            className: 'replay-wpt-pin',
            html: `
              <div style="background: ${pinColor}; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
                ${idx + 1}
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          const m = L.marker([pt.lat, pt.lng], { icon: pinIcon })
            .addTo(map)
            .bindPopup(`
              <div style="font-family: sans-serif; font-size: 11px; min-width: 160px;">
                <div style="font-weight: 900; color: #0f172a;">📍 Waypoint #${idx + 1} ${isFirst ? '(Partenza)' : isLast ? '(Arrivo)' : ''}</div>
                <div>Orario: <strong>${pt.orario}</strong></div>
                <div>Velocità: <strong>${pt.velocita} km/h</strong></div>
                <div>Prua: <strong>${pt.heading}°</strong></div>
                <div style="font-size: 9px; color: #64748b; font-family: monospace;">${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}</div>
              </div>
            `);
          replayWaypointMarkersRef.current.push(m);
        });
      }

      // Posiziona il marker del Replay al punto indiceReplay
      const puntoCorrente = cronologiaGPS[Math.min(indiceReplay, cronologiaGPS.length - 1)];
      if (puntoCorrente) {
        const replayPos: [number, number] = [puntoCorrente.lat, puntoCorrente.lng];
        const replayIcon = L.divIcon({
          className: 'replay-vehicle-pin',
          html: `
            <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; inset: -4px; border-radius: 50%; background: #06b6d4; opacity: 0.45; animation: ping 1.5s infinite;"></div>
              <div style="width: 38px; height: 38px; border-radius: 50%; background: #0891b2; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">
                <span style="font-size: 20px;">🚑</span>
              </div>
              <div style="position: absolute; bottom: -14px; background: #0e7490; border: 1.5px solid #67e8f9; border-radius: 5px; padding: 1px 5px; font-family: sans-serif; font-size: 8.5px; font-weight: 900; color: #ffffff; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                ${puntoCorrente.orario} • ${puntoCorrente.velocita} km/h
              </div>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });

        if (replayMarkerRef.current) {
          replayMarkerRef.current.setLatLng(replayPos);
          replayMarkerRef.current.setIcon(replayIcon);
        } else {
          replayMarkerRef.current = L.marker(replayPos, { icon: replayIcon, zIndexOffset: 1200 }).addTo(map);
        }

        // Segui il punto di replay sulla mappa se esce dalla visuale
        if (!map.getBounds().contains(replayPos)) {
          map.panTo(replayPos, { animate: true });
        }
      }
    }
  }, [modalitaRivediPercorso, cronologiaGPS, indiceReplay, mostraTuttiPuntiWaypoint]);

  // Timer per la riproduzione automatica del percorso
  useEffect(() => {
    if (!modalitaRivediPercorso || !inRiproduzioneReplay) return;
    if (cronologiaGPS.length === 0) return;

    const intervalTime = Math.max(200, Math.floor(1000 / velocitaReplay));
    const timer = setInterval(() => {
      setIndiceReplay((prev) => {
        if (prev >= cronologiaGPS.length - 1) {
          setInRiproduzioneReplay(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [modalitaRivediPercorso, inRiproduzioneReplay, velocitaReplay, cronologiaGPS.length]);

  // Esportazione della cronologia del percorso in formato CSV
  const esportaTracciaGPSCsv = () => {
    if (cronologiaGPS.length === 0) return;
    const headers = ['Punto', 'Orario', 'Latitudine', 'Longitudine', 'Velocita (km/h)', 'Prua (deg)', 'Accuratezza (m)'];
    const rows = cronologiaGPS.map((pt, idx) =>
      `${idx + 1};"${pt.orario}";${pt.lat.toFixed(6)};${pt.lng.toFixed(6)};${pt.velocita};${pt.heading};${pt.accuratezza ?? 10}`
    );
    const content = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traccia_gps_${(nomeMezzo || 'mezzo').replace(/\s+/g, '_')}_${(codiceMissione || 'missione').replace(/\s+/g, '_')}_${formatISODateItaly()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Azzeramento cronologia con conferma
  const svuotaCronologiaGPS = () => {
    if (window.confirm('Confermi di voler azzerare la cronologia delle posizioni GPS per questa missione?')) {
      setCronologiaGPS([]);
      setIndiceReplay(0);
      setInRiproduzioneReplay(false);
      try {
        localStorage.removeItem(`croceoro_gps_history_${codiceMissione || 'corrente'}`);
      } catch {}
    }
  };

  const puntoSelezionatoReplay = cronologiaGPS[Math.min(indiceReplay, cronologiaGPS.length - 1)];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
      
      {/* Intestazione Mappa con Indicatori Live & Tasto Rivedi Percorso GPS */}
      <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 tracking-wide">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Mappa Operativa Real-Time & Tracciamento Ambulanza
          </span>

          {/* Tasto Attiva / Disattiva Cronologia e Revisione Percorso GPS */}
          <button
            type="button"
            onClick={() => {
              const nuovoStato = !modalitaRivediPercorso;
              setModalitaRivediPercorso(nuovoStato);
              if (nuovoStato) {
                setIndiceReplay(0);
                setInRiproduzioneReplay(false);
                setSeguiMezzoContinuo(false);
                // Centra sul primo punto della cronologia se disponibile
                if (cronologiaGPS.length > 0 && mapInstanceRef.current) {
                  try {
                    mapInstanceRef.current.setView([cronologiaGPS[0].lat, cronologiaGPS[0].lng], 15);
                  } catch {}
                }
              } else {
                setSeguiMezzoContinuo(true);
              }
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
              modalitaRivediPercorso
                ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 font-extrabold'
                : 'bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/40 hover:bg-cyan-950/60'
            }`}
            title="Traccia e visualizza la cronologia delle posizioni GPS per rivedere il percorso della missione"
          >
            <History className="w-3.5 h-3.5" />
            <span>Cronologia Percorso ({cronologiaGPS.length} pt)</span>
          </button>
        </div>

        {/* Informazioni Telemetria Live Bordo Mezzo */}
        <div className="flex items-center flex-wrap gap-2 text-[10px] text-slate-300 font-mono">
          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-emerald-400 font-bold flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            {velocitaIstantanea} KM/H
          </span>
          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-amber-300 font-bold">
            LAT: {posizioneMezzo.lat.toFixed(4)} | LNG: {posizioneMezzo.lng.toFixed(4)}
          </span>
          <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
            {posizioneMezzo.orario}
          </span>
        </div>
      </div>

      {/* PANNELLO REVISIONE PERCORSO GPS (REPLAY & CRONOLOGIA) */}
      {modalitaRivediPercorso && (
        <div className="bg-slate-950/95 border-b border-cyan-500/40 p-3 text-slate-200 space-y-2.5 animate-in slide-in-from-top duration-200 z-20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-black uppercase text-cyan-300 tracking-wide flex items-center gap-1.5">
                <Route className="w-4 h-4 text-cyan-400" />
                Revisione Percorso GPS Effettuato
              </span>
              {codiceMissione && (
                <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-amber-300 font-mono border border-slate-700">
                  Missione: {codiceMissione}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={esportaTracciaGPSCsv}
                className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Esporta tutta la cronologia GPS in formato CSV per gli atti di missione"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Esporta CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setMostraTuttiPuntiWaypoint(!mostraTuttiPuntiWaypoint)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  mostraTuttiPuntiWaypoint
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {mostraTuttiPuntiWaypoint ? 'Nascondi Pin Waypoint' : 'Mostra Pin Waypoint'}
              </button>

              <button
                type="button"
                onClick={svuotaCronologiaGPS}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-700 text-[10px] font-bold"
                title="Azzera la cronologia salvata per questa missione"
              >
                Azzera
              </button>

              <button
                type="button"
                onClick={() => setModalitaRivediPercorso(false)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                title="Chiudi revisione percorso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrubber / Barra Temporale del Replay */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="text-cyan-400 font-bold">
                  Punto {cronologiaGPS.length > 0 ? indiceReplay + 1 : 0} di {cronologiaGPS.length}
                </span>
                {puntoSelezionatoReplay && (
                  <span className="text-white font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    🕒 {puntoSelezionatoReplay.orario}
                  </span>
                )}
              </span>

              {puntoSelezionatoReplay && (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">
                    🚀 {puntoSelezionatoReplay.velocita} km/h
                  </span>
                  <span className="text-amber-300 font-bold">
                    🧭 {puntoSelezionatoReplay.heading}°
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Lat: {puntoSelezionatoReplay.lat.toFixed(4)} | Lng: {puntoSelezionatoReplay.lng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={Math.max(0, cronologiaGPS.length - 1)}
                value={indiceReplay}
                onChange={(e) => {
                  setIndiceReplay(parseInt(e.target.value, 10));
                  setInRiproduzioneReplay(false);
                }}
                disabled={cronologiaGPS.length <= 1}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Controlli di Play / Pausa / Step e Velocità */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              {/* Salto all'inizio */}
              <button
                type="button"
                onClick={() => {
                  setIndiceReplay(0);
                  setInRiproduzioneReplay(false);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                title="Torna alla partenza del viaggio"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Step indietro */}
              <button
                type="button"
                onClick={() => {
                  setIndiceReplay((p) => Math.max(0, p - 1));
                  setInRiproduzioneReplay(false);
                }}
                disabled={indiceReplay <= 0}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                title="Punto precedente"
              >
                <Rewind className="w-3.5 h-3.5" />
              </button>

              {/* Tasto Play / Pausa Replay */}
              <button
                type="button"
                onClick={() => {
                  if (indiceReplay >= cronologiaGPS.length - 1) {
                    setIndiceReplay(0);
                  }
                  setInRiproduzioneReplay(!inRiproduzioneReplay);
                }}
                className={`px-3 py-1 rounded-lg font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
                  inRiproduzioneReplay
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {inRiproduzioneReplay ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-slate-950" />
                    <span>Pausa Replay</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-white" />
                    <span>Riproduci Percorso</span>
                  </>
                )}
              </button>

              {/* Step avanti */}
              <button
                type="button"
                onClick={() => {
                  setIndiceReplay((p) => Math.min(cronologiaGPS.length - 1, p + 1));
                  setInRiproduzioneReplay(false);
                }}
                disabled={indiceReplay >= cronologiaGPS.length - 1}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                title="Punto successivo"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Moltiplicatore di velocità replay */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
              {[1, 2, 4].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVelocitaReplay(v)}
                  className={`px-2 py-0.5 rounded ${
                    velocitaReplay === v
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Area Mappa Leaflet Interattiva */}
      <div className="relative w-full h-[340px] sm:h-[400px]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Pulsante Fluttuante Ricentra su Mezzo Live (appare quando l'operatore sposta la mappa) */}
        {!seguiMezzoContinuo && (
          <button
            type="button"
            onClick={() => {
              setSeguiMezzoContinuo(true);
              if (mapInstanceRef.current && (mapInstanceRef.current as any)._mapPane) {
                try {
                  (mapInstanceRef.current as any)._stop?.();
                  mapInstanceRef.current.setView([posizioneMezzo.lat, posizioneMezzo.lng], mapInstanceRef.current.getZoom(), { animate: false });
                  if (mezzoMarkerRef.current && (mezzoMarkerRef.current as any)._map) {
                    mezzoMarkerRef.current.openPopup();
                  }
                } catch {}
              }
            }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-2xl border-2 border-white animate-bounce active:scale-95 transition-all cursor-pointer ring-4 ring-emerald-500/30"
          >
            <Crosshair className="w-4 h-4 text-white" />
            <span>🎯 Ricentra su Mezzo Live</span>
          </button>
        )}

        {/* HUD Telemetria Fluttuante in Alto a Sinistra */}
        <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-2xl flex flex-col gap-1 text-[11px]">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="text-sm">🚑</span>
            <span className="text-amber-400 uppercase tracking-wide">{nomeMezzo}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-300">
            <span>Stato: <strong className="text-emerald-400">{statoMissione}</strong></span>
            <span>Velocità: <strong className="text-white font-mono">{velocitaIstantanea} km/h</strong></span>
          </div>
          <div className="text-[9px] text-slate-400 font-mono">
            Prua: {Math.round(angoloPrua)}° | Fix GPS Continuo
          </div>
        </div>

        {/* Controlli Overlay sulla Mappa in Alto a Destra */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-[400]">
          {/* Zoom In */}
          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current && (mapInstanceRef.current as any)._mapPane) {
                try { mapInstanceRef.current.zoomIn(); } catch {}
              }
            }}
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Zoom Avanti (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current && (mapInstanceRef.current as any)._mapPane) {
                try { mapInstanceRef.current.zoomOut(); } catch {}
              }
            }}
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Zoom Indietro (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Centra su Ambulanza */}
          <button
            type="button"
            onClick={centraSuMezzo}
            className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform mt-1"
            title="Centra sull'Ambulanza"
          >
            <Locate className="w-4 h-4" />
          </button>

          {/* Toggle Segui Mezzo Continuo (Auto-Center) */}
          <button
            type="button"
            onClick={() => setSeguiMezzoContinuo(!seguiMezzoContinuo)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all ${
              seguiMezzoContinuo
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 font-black'
                : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700'
            }`}
            title={seguiMezzoContinuo ? 'Auto-Centramento Mezzo ATTIVO' : 'Attiva Segui Mezzo Continuo'}
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Centra su Obiettivo */}
          <button
            type="button"
            onClick={centraSuObiettivo}
            className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Centra sull'Obiettivo d'Intervento"
          >
            <MapPin className="w-4 h-4" />
          </button>

          {/* Vista Globale */}
          <button
            type="button"
            onClick={adattaVistaGlobale}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Mostra sia Mezzo che Obiettivo"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Selettore Layer Mappa (In basso a sinistra) */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-[400] bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-lg text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setTipoMappa('streets')}
            className={`px-2 py-1 rounded-lg transition-colors ${
              tipoMappa === 'streets' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
            }`}
          >
            Stradale
          </button>
          <button
            type="button"
            onClick={() => setTipoMappa('satellite')}
            className={`px-2 py-1 rounded-lg transition-colors ${
              tipoMappa === 'satellite' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Controlli Movimento Continuo & Navigatore (In basso a destra) */}
        <div className="absolute bottom-3 right-3 z-[400] flex flex-wrap items-center gap-2">
          
          {/* Tasto Start / Stop Movimento Live Continuo */}
          <button
            type="button"
            onClick={() => setMovimentoLiveAttivo(!movimentoLiveAttivo)}
            className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase flex items-center gap-1.5 shadow-xl transition-all active:scale-95 ${
              movimentoLiveAttivo
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title="Avvia o metti in pausa il movimento continuo dell'ambulanza in mappa"
          >
            {movimentoLiveAttivo ? (
              <>
                <Pause className="w-3.5 h-3.5 text-white" />
                <span>Pausa Movimento</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-white" />
                <span>Movimento Mezzo Live</span>
              </>
            )}
          </button>

          {/* Tasto Condividi Posizione Live Mezzo per 1 Ora */}
          {onCondividiPosizione && (
            <button
              type="button"
              onClick={onCondividiPosizione}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 shadow-xl active:scale-95 transition-all border ${
                haDichiaratoPartenza
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
              }`}
              title={
                haDichiaratoPartenza
                  ? "Condividi posizione live (1h) con il chiamante via WhatsApp Business (0585625410)"
                  : "Condivisione posizione disponibile solo dopo che il volontario ha dichiarato la PARTENZA a bordo"
              }
            >
              {haDichiaratoPartenza ? (
                <Share2 className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Condividi Posizione (1 Ora)</span>
              {!haDichiaratoPartenza && (
                <span className="text-[8px] bg-slate-900/90 text-amber-400/90 px-1 py-0.2 rounded font-mono font-normal">
                  In attesa Partenza
                </span>
              )}
            </button>
          )}

          {/* Navigatore Percorso Veloce */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(indirizzoObiettivo)}&travelmode=driving&dir_action=navigate`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Navigatore GPS</span>
          </a>
        </div>
      </div>

      {/* Footer Barra Stato Mappa Operativa con Legenda Pin Distinguibili */}
      <div className="bg-slate-950 px-3.5 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            Tracciamento continuo mezzo: <strong className="text-white">{nomeMezzo}</strong>
          </span>
          {movimentoLiveAttivo && (
            <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.2 rounded font-bold uppercase animate-pulse">
              In Marcia Live
            </span>
          )}
        </div>

        {/* Legenda Pin Grafici Distinguibili */}
        <div className="flex items-center gap-2.5 text-[10px] flex-wrap">
          <span className="flex items-center gap-1 text-amber-300 font-semibold">
            <span>🏛️</span> Sedi Associazione
          </span>
          <span className="flex items-center gap-1 text-emerald-300 font-semibold">
            <span>🚑</span> Mezzo Live
          </span>
          <span className="flex items-center gap-1 text-red-400 font-semibold">
            <span>🎯</span> Obiettivo
          </span>
          {indirizzoDestinazione && (
            <span className="flex items-center gap-1 text-cyan-300 font-semibold">
              <span>🏥</span> Destinazione
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>Precisione: ±{Math.round(posizioneMezzo.accuratezza || 15)}m</span>
          <span className="text-amber-400 font-bold">Zoom: {currentZoom}x</span>
        </div>
      </div>
    </div>
  );
};
