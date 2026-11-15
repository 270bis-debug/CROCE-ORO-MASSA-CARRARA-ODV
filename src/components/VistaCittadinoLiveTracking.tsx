import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MappaOperativa, PosizioneGPS } from './MappaOperativa';
import { realtime } from '../services/realtime';
import { formatTimeItaly } from '../utils/italianTime';
import {
  Navigation,
  Clock,
  ShieldCheck,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Radio,
  PhoneCall,
  AlertTriangle,
  RefreshCw,
  Gauge,
  Compass,
  CheckCircle2
} from 'lucide-react';

interface MissioneTrackInfo {
  codice?: string;
  mezzoAssegnato?: string;
  indirizzo?: string;
  coordinate?: { lat: number; lng: number };
  destinazione?: string;
  coordinateDestinazione?: { lat: number; lng: number };
  datiDestinazione?: any;
  urgenza?: string;
  ambito?: string;
}

const formattaSecondiCountdown = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
};

export const VistaCittadinoLiveTracking: React.FC = () => {
  // Estrazione token dalla query string (?track=live&token=...) o dal percorso URL (/track/:token)
  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const searchParams = new URLSearchParams(window.location.search);
    const qToken = searchParams.get('token') || searchParams.get('t') || searchParams.get('trk');
    if (qToken && qToken.startsWith('trk-')) return qToken;
    if (qToken && qToken.length >= 6) return qToken;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const trackIdx = pathParts.indexOf('track');
    if (trackIdx !== -1 && pathParts[trackIdx + 1]) {
      return pathParts[trackIdx + 1];
    }
    return qToken || '';
  }, []);

  const [sessionStatus, setSessionStatus] = useState<'loading' | 'valid' | 'expired'>('loading');
  const [messaggioScadenza, setMessaggioScadenza] = useState<string>('');
  const [secondiRimanenti, setSecondiRimanenti] = useState<number>(3600); // 1 ora di default (3600s)

  const [posizione, setPosizione] = useState<PosizioneGPS>({
    lat: 44.0357,
    lng: 10.1415,
    accuratezza: 8,
    velocita: 48,
    orario: formatTimeItaly()
  });

  const [missioneInfo, setMissioneInfo] = useState<MissioneTrackInfo | null>(null);
  const [orarioScadenzaStr, setOrarioScadenzaStr] = useState<string>('');
  const [ultimoAggiornamentoTimestamp, setUltimoAggiornamentoTimestamp] = useState<number>(Date.now());

  // Recupera i dati della sessione o GPS dal server
  const ricaricaDatiSessione = async () => {
    try {
      if (token) {
        const res = await fetch(`/api/track/session/${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.expired || !data.valid) {
            setSessionStatus('expired');
            setMessaggioScadenza(data.message || 'La sessione di tracciamento live è scaduta (durata massima 1 ora superata).');
            return;
          }

          setSessionStatus('valid');
          if (typeof data.remainingSeconds === 'number') {
            setSecondiRimanenti(data.remainingSeconds);
          }
          if (data.session?.orarioScadenza) {
            setOrarioScadenzaStr(data.session.orarioScadenza);
          }

          if (data.position && typeof data.position.lat === 'number' && typeof data.position.lng === 'number') {
            setPosizione(prev => ({
              lat: data.position.lat,
              lng: data.position.lng,
              accuratezza: data.position.accuratezza || prev.accuratezza || 10,
              velocita: data.position.velocita !== undefined ? data.position.velocita : prev.velocita,
              orario: data.position.orario || formatTimeItaly()
            }));
            setUltimoAggiornamentoTimestamp(Date.now());
          }

          if (data.activeMission) {
            setMissioneInfo(data.activeMission);
          } else if (data.session) {
            setMissioneInfo(prev => ({
              ...prev,
              mezzoAssegnato: data.session.mezzo || prev?.mezzoAssegnato,
              codice: data.session.codiceMissione || prev?.codice,
              indirizzo: data.session.indirizzo || prev?.indirizzo,
              coordinate: data.session.coordinate || prev?.coordinate,
              destinazione: data.session.destinazione || prev?.destinazione,
              urgenza: data.session.urgenza || prev?.urgenza
            }));
          }
          return;
        }
      }

      // Fallback senza token esplicito: lettura GPS globale e missione attiva
      const resGps = await fetch('/api/gps');
      if (resGps.ok) {
        const data = await resGps.json();
        setSessionStatus('valid');
        if (data.position && typeof data.position.lat === 'number' && typeof data.position.lng === 'number') {
          setPosizione(prev => ({
            lat: data.position.lat,
            lng: data.position.lng,
            accuratezza: data.position.accuratezza || prev.accuratezza || 10,
            velocita: data.position.velocita !== undefined ? data.position.velocita : prev.velocita,
            orario: data.position.orario || formatTimeItaly()
          }));
          setUltimoAggiornamentoTimestamp(Date.now());
        }
        if (data.activeMission) {
          setMissioneInfo(data.activeMission);
        }
      }
    } catch (err) {
      console.error('[LiveTracking] Errore sincronizzazione sessione:', err);
    }
  };

  // Caricamento iniziale e polling continuo ogni 2.5 secondi
  useEffect(() => {
    ricaricaDatiSessione();
    const interval = setInterval(ricaricaDatiSessione, 2500);

    // Ascolto in tempo reale via WebSocket
    const unsubGps = realtime.on('GPS_UPDATED', (payload: any) => {
      if (payload?.position && typeof payload.position.lat === 'number') {
        setPosizione(prev => ({
          lat: payload.position.lat,
          lng: payload.position.lng,
          accuratezza: payload.position.accuratezza || prev.accuratezza || 8,
          velocita: payload.position.velocita !== undefined ? payload.position.velocita : prev.velocita,
          orario: payload.position.orario || formatTimeItaly()
        }));
        setUltimoAggiornamentoTimestamp(Date.now());
      }
    });

    const unsubMission = realtime.on('DISPATCH_MISSION', (payload: any) => {
      if (payload) {
        setMissioneInfo(payload);
      }
    });

    return () => {
      clearInterval(interval);
      if (unsubGps) unsubGps();
      if (unsubMission) unsubMission();
    };
  }, [token]);

  // Timer di countdown preciso al secondo (1 Ora Massima)
  useEffect(() => {
    if (sessionStatus !== 'valid') return;

    const timer = setInterval(() => {
      setSecondiRimanenti(prev => {
        if (prev <= 1) {
          setSessionStatus('expired');
          setMessaggioScadenza('La durata massima di 1 Ora concessa per il tracciamento satellitare del mezzo è terminata.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStatus]);

  const googleMapsUrl = useMemo(() => {
    return `https://www.google.com/maps?q=${posizione.lat.toFixed(5)},${posizione.lng.toFixed(5)}`;
  }, [posizione.lat, posizione.lng]);

  const nomeMezzo = missioneInfo?.mezzoAssegnato || 'T4606 AMBULANZA';
  const indirizzoObiettivo = missioneInfo?.indirizzo || 'Luogo Intervento / Soccorso';
  const indirizzoDestinazione = missioneInfo?.destinazione || 'Ospedale delle Apuane (NOA Massa)';

  // -----------------------------------------------------------------
  // SCHERMATA: SESSIONE SCADUTA (DOPO 1 ORA MASSIMA)
  // -----------------------------------------------------------------
  if (sessionStatus === 'expired') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
        <header className="bg-gradient-to-r from-[#1d1a60] via-slate-900 to-[#1d1a60] border-b border-amber-500/40 p-3 sm:p-4 shadow-xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl shadow-md shrink-0">
                🚑
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wide">
                  Croce Oro Massa Carrara OdV
                </h1>
                <p className="text-xs text-slate-300">
                  Centrale Operativa Soccorsi &bull; Comunicazione di Servizio
                </p>
              </div>
            </div>
            <a
              href="tel:0585625410"
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>0585 625410</span>
            </a>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl mx-auto text-amber-400 shadow-xl shadow-amber-500/20 animate-pulse">
              ⏱️
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-red-500/20 text-red-300 border border-red-500/40 inline-block mb-2">
                Collegamento Scaduto (1 Ora Superata)
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Tracciamento Satellitare Non Più Attivo
              </h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {messaggioScadenza || 'Per motivi di riservatezza, sicurezza operativa e normativa sul soccorso, ogni collegamento di visualizzazione live della posizione ha una validità massima garantita di 60 minuti.'}
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm border-b border-slate-800 pb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Hai bisogno di assistenza o aggiornamenti?</span>
              </div>
              <p className="leading-relaxed">
                Il mezzo di soccorso è regolarmente coordinato via ponte radio dalla nostra Centrale Operativa. Per qualsiasi necessità urgente o per parlare direttamente con l'operatore di turno:
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href="tel:0585625410"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Chiama Centrale (0585 625410)</span>
                </a>
                <button
                  type="button"
                  onClick={ricaricaDatiSessione}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs uppercase flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Verifica Stato</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <p>Croce Oro Massa Carrara OdV &bull; Sede Legale Via Como 12, Massa</p>
              <button
                type="button"
                onClick={() => { window.location.href = window.location.origin; }}
                className="mt-2 text-amber-400 hover:text-amber-300 underline font-bold"
              >
                Torna al Portale Operativo
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // SCHERMATA: TRACCIAMENTO LIVE ATTIVO (IN TEMPO REALE)
  // -----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Top Banner Istituzionale & Contatti Emergenza */}
      <header className="bg-gradient-to-r from-[#1d1a60] via-slate-900 to-[#1d1a60] border-b border-amber-500/40 p-3 sm:p-4 shadow-xl">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl shadow-md shrink-0">
              🚑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wide">
                  Croce Oro Massa Carrara OdV
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Mappa Live in Movimento
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Tracciamento Satellitare Ambulanza in Tempo Reale</span>
                <span className="text-slate-500">&bull;</span>
                <span className="text-amber-300 font-mono font-bold">Centrale Operativa 0585 625410</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Countdown 1H Ben Visibile */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-mono font-black text-amber-300 flex items-center gap-1.5 shadow-md">
              <Clock className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Link Valido: <strong>{formattaSecondiCountdown(secondiRimanenti)}</strong></span>
            </div>

            <a
              href="tel:0585625410"
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
              title="Chiama la Centrale Operativa Croce Oro"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Chiama Centrale</span>
            </a>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors shadow-sm"
              title="Visualizza punto su Google Maps esterno"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Maps</span>
            </a>
          </div>
        </div>
      </header>

      {/* Barra Telemetria Operativa Mezzo */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-3 py-2 text-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Mezzo in Servizio:</span>
            <span className="font-black text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1.5 shadow-inner">
              <span className="text-sm">🚑</span>
              <span>{nomeMezzo}</span>
            </span>
            {missioneInfo?.codice && (
              <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {missioneInfo.codice}
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3 text-emerald-400" />
              {posizione.velocita || 48} KM/H
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-300 flex-wrap">
            <div className="flex items-center gap-1 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate max-w-[280px]">Obiettivo: <strong className="text-white">{indirizzoObiettivo}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Fix Satellitare: {posizione.orario}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenuto Principale: Mappa Operativa Interattiva Real-Time con Mezzo in Movimento */}
      <main className="flex-1 p-2 sm:p-4 max-w-6xl w-full mx-auto flex flex-col">
        <div className="flex-1 bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[460px]">
          <MappaOperativa
            posizioneMezzo={posizione}
            indirizzoObiettivo={indirizzoObiettivo}
            coordinateObiettivo={missioneInfo?.coordinate}
            indirizzoDestinazione={indirizzoDestinazione}
            coordinateDestinazione={missioneInfo?.coordinateDestinazione}
            nomeMezzo={nomeMezzo}
            codiceMissione={missioneInfo?.codice}
            statoMissione="IN MOVIMENTO (TRACCIAMENTO SATELLITARE ATTIVO)"
            haDichiaratoPartenza={true}
            autoMovimento={true}
            onAggiornaCoordinate={(nuovaPos) => {
              setPosizione(nuovaPos);
              realtime.updateGps(nuovaPos);
            }}
          />
        </div>

        {/* Note e Assistenza Telefonica Emergenza */}
        <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Tracciamento in tempo reale attivo:</strong> La mappa mostra lo spostamento dinamico continuo dell'ambulanza lungo la viabilità stradale.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-400">Centrale Operativa OdV:</span>
            <a
              href="tel:0585625410"
              className="font-bold text-amber-300 hover:underline flex items-center gap-1"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>0585 625410</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
