import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Award,
  Navigation,
  Check,
  X,
  Building2,
  Users,
  Compass,
  Sparkles,
  Info,
  CalendarDays
} from 'lucide-react';
import { CorsoFormazione, PartecipanteCorso, LezioneCorso } from '../types/adminTypes';
import { Volontario } from './DatabaseVolontariModal';
import { formatISODateItaly } from '../utils/italianTime';

interface ModalCorsoVolontarioProps {
  corso: CorsoFormazione;
  volontario: Volontario;
  isOpen: boolean;
  onClose: () => void;
  onIscriviti: (corsoId: string, volontario: Volontario) => void;
  onTimbraPresenzaGPS: (
    corsoId: string,
    volontario: Volontario,
    tipo: 'entrata' | 'uscita',
    coords: { lat: number; lng: number },
    distanzaMetri: number,
    lezioneId?: string
  ) => void;
}

// Calcolo distanza Haversine in metri tra due coordinate geografiche
function calcolaDistanzaMetri(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // raggio terrestre in metri
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const ModalCorsoVolontario: React.FC<ModalCorsoVolontarioProps> = ({
  corso,
  volontario,
  isOpen,
  onClose,
  onIscriviti,
  onTimbraPresenzaGPS
}) => {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState<{ tipo: 'success' | 'warning' | 'error'; messaggio: string } | null>(null);
  const [distanzaRilevata, setDistanzaRilevata] = useState<number | null>(null);

  // Selezione della lezione corrente (fino a 20 lezioni in sedi diverse)
  const lezioni = corso.lezioni && corso.lezioni.length > 0 ? corso.lezioni : [];
  const oggiStr = formatISODateItaly();

  // Trova di default la lezione di oggi o la prima disponibile
  const lezioneIniziale = lezioni.find(l => l.data === oggiStr) || lezioni[0];
  const [selectedLezioneId, setSelectedLezioneId] = useState<string>(lezioneIniziale ? lezioneIniziale.id : '');

  useEffect(() => {
    if (lezioni.length > 0 && !lezioni.some(l => l.id === selectedLezioneId)) {
      const match = lezioni.find(l => l.data === oggiStr) || lezioni[0];
      if (match) setSelectedLezioneId(match.id);
    }
  }, [corso.id, lezioni]);

  if (!isOpen) return null;

  const partecipante = corso.iscritti.find(p => p.volontarioId === volontario.id);
  const isIscritto = Boolean(partecipante);

  // Dati della lezione selezionata (se presente)
  const lezioneCorrente = lezioni.find(l => l.id === selectedLezioneId);

  // Coordinate di riferimento: DEVE essere il luogo della singola lezione!
  const coordTarget = lezioneCorrente?.coordinate || corso.coordinate || { lat: 43.99419, lng: 10.12367 };
  const sedeTargetNome = lezioneCorrente?.sedeNome || corso.sedeCorso;
  const indirizzoTarget = lezioneCorrente?.indirizzoCompleto || corso.indirizzoCompleto || 'Massa Carrara';

  // Verifica timbrature specifiche per la lezione selezionata
  const timbraturaLezione = partecipante?.timbratureLezioni?.find(t => t.lezioneId === selectedLezioneId);

  const haTimbratoEntrata = Boolean(
    timbraturaLezione
      ? (typeof timbraturaLezione.timbraturaEntrata === 'object' ? timbraturaLezione.timbraturaEntrata?.confermata : timbraturaLezione.timbraturaEntrata)
      : (typeof partecipante?.timbraturaEntrata === 'object' ? partecipante.timbraturaEntrata?.confermata : partecipante?.timbraturaEntrata)
  );

  const haTimbratoUscita = Boolean(
    timbraturaLezione
      ? (typeof timbraturaLezione.timbraturaUscita === 'object' ? timbraturaLezione.timbraturaUscita?.confermata : timbraturaLezione.timbraturaUscita)
      : (typeof partecipante?.timbraturaUscita === 'object' ? partecipante.timbraturaUscita?.confermata : partecipante?.timbraturaUscita)
  );

  const entrataInfo = timbraturaLezione
    ? (typeof timbraturaLezione.timbraturaEntrata === 'object' ? timbraturaLezione.timbraturaEntrata : null)
    : (typeof partecipante?.timbraturaEntrata === 'object' ? partecipante.timbraturaEntrata : null);

  const uscitaInfo = timbraturaLezione
    ? (typeof timbraturaLezione.timbraturaUscita === 'object' ? timbraturaLezione.timbraturaUscita : null)
    : (typeof partecipante?.timbraturaUscita === 'object' ? partecipante.timbraturaUscita : null);

  const eseguiTimbratura = (tipoForzato?: 'entrata' | 'uscita') => {
    setGpsLoading(true);
    setGpsFeedback(null);

    const proseguiConCoordinate = (lat: number, lng: number) => {
      const dist = calcolaDistanzaMetri(lat, lng, coordTarget.lat, coordTarget.lng);
      setDistanzaRilevata(dist);

      const tipo = tipoForzato || (!haTimbratoEntrata ? 'entrata' : 'uscita');
      const RAGGIO_MAX = 500; // metri di tolleranza

      if (dist <= RAGGIO_MAX) {
        onTimbraPresenzaGPS(corso.id, volontario, tipo, { lat, lng }, dist, selectedLezioneId || undefined);
        setGpsFeedback({
          tipo: 'success',
          messaggio: `✅ TIMBRATURA ${tipo.toUpperCase()} CONFERMATA CON SUCCESSO! Rilevato a ${dist}m dalla sede della lezione (${sedeTargetNome}). Presenza certificata nel registro presenze.`
        });
      } else {
        setGpsFeedback({
          tipo: 'warning',
          messaggio: `⚠️ ATTENZIONE: Ti trovi a ${dist} metri dalla sede di questa lezione (raggio consentito entro 500m). In conformità con le direttive, la timbratura deve essere effettuata presso "${sedeTargetNome}" (${indirizzoTarget}), luogo effettivo di svolgimento della lezione.`
        });
      }
      setGpsLoading(false);
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          proseguiConCoordinate(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          setGpsLoading(false);
          setGpsFeedback({
            tipo: 'warning',
            messaggio: `⛔ Impossibile verificare la posizione GPS (${err.message}). La timbratura in entrata e uscita è consentita esclusivamente nelle posizioni autorizzate con GPS attivo.`
          });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setGpsLoading(false);
      setGpsFeedback({
        tipo: 'warning',
        messaggio: '⛔ Geolocalizzazione non supportata su questo dispositivo. Impossibile verificare la posizione autorizzata.'
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[150] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4 my-auto max-h-[92vh] overflow-y-auto">
        
        {/* Header Modale */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-2xl font-black shrink-0 shadow-lg shadow-amber-500/20">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  {corso.codiceCorso}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {corso.tipologia}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                  corso.stato === 'Programmato'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : corso.stato === 'In Corso'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {corso.stato}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase mt-1 leading-snug">
                {corso.titolo}
              </h3>
              {corso.sottotitolo && (
                <p className="text-xs font-semibold text-amber-300 italic">
                  {corso.sottotitolo}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Destinatari Sezioni Operative */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-indigo-500/40 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-black text-indigo-300 uppercase text-[11px]">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>Destinatari del Corso • Sezioni Operative Territoriali:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {corso.sezioniDestinatarieNomi && corso.sezioniDestinatarieNomi.length > 0 ? (
              corso.sezioniDestinatarieNomi.map((sNome, i) => (
                <span key={i} className="px-2.5 py-1 rounded-xl bg-indigo-600/30 text-indigo-200 border border-indigo-400/50 font-bold text-[11px] shadow-sm">
                  🏢 {sNome}
                </span>
              ))
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-600/30 text-indigo-200 border border-indigo-400/50 font-bold text-[11px]">
                🌐 Tutte le Sezioni Territoriali dell'Associazione
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            La comunicazione è visibile a tutti i volontari delle sezioni specificate.
          </p>
        </div>

        {/* Dettagli Didattici, Docente, Orari e Frequenza Minima */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Docente / Formatore</span>
            <span className="font-bold text-white text-xs block mt-0.5 truncate">{corso.docenteFormatore}</span>
            <span className="text-[9.5px] text-amber-400 block truncate">{corso.enteAccreditato}</span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Date & Calendario</span>
            <span className="font-bold text-white text-xs block mt-0.5">
              {corso.dataInizio === corso.dataFine ? corso.dataInizio : `${corso.dataInizio} → ${corso.dataFine}`}
            </span>
            <span className="text-[9.5px] text-slate-400 block">
              {lezioni.length > 0 ? `${lezioni.length} Incontri calendarizzati` : 'Sessione singola'}
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Ore Totali Corso</span>
            <span className="font-black text-amber-400 text-sm block mt-0.5 font-mono">
              {corso.oreTotali}h
            </span>
            <span className="text-[9.5px] text-slate-400 block">Monte ore certificato</span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/40">
            <span className="text-[9.5px] uppercase font-bold text-amber-300 block">Frequenza Minima *</span>
            <span className="font-black text-emerald-400 text-sm block mt-0.5 font-mono">
              {corso.percentualeMinimaPresenza || 80}% ({corso.oreMinimeFrequenza}h)
            </span>
            <span className="text-[9.5px] text-slate-400 block">
              {corso.tipologia === 'Seminario PSV' || corso.tipologia === 'Seminario Autisti'
                ? 'Per attestato partecipazione'
                : 'Obbligatoria per brevetto'}
            </span>
          </div>
        </div>

        {/* PROGRAMMA LEZIONI / INCONTRI (SE PRESENTE: FINO A 20 INCONTRI IN SEDI DIVERSE) */}
        {lezioni.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/50 space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-black uppercase text-amber-300 text-xs">
                <CalendarDays className="w-4 h-4 text-amber-400" />
                <span>Programma Incontri del Corso ({lezioni.length} Lezioni in sedi diverse):</span>
              </div>
              <span className="text-[10px] text-indigo-300 font-bold bg-indigo-900/60 px-2 py-0.5 rounded-full border border-indigo-700/60">
                Seleziona la lezione da timbrare
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-tight">
              💡 <strong>Regola di presenza:</strong> La timbratura GPS deve essere effettuata sul posto presso la sede specifica della singola lezione che stai frequentando oggi.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
              {lezioni.map((lez) => {
                const isSelected = lez.id === selectedLezioneId;
                const isOggi = lez.data === oggiStr;
                const timbLez = partecipante?.timbratureLezioni?.find(t => t.lezioneId === lez.id);
                const hasEntrata = Boolean(timbLez?.timbraturaEntrata);
                const hasUscita = Boolean(timbLez?.timbraturaUscita);

                return (
                  <div
                    key={lez.id}
                    onClick={() => setSelectedLezioneId(lez.id)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/30 border-amber-400 shadow-md ring-2 ring-amber-400/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-black text-amber-300 text-[11px]">
                        Incontro #{lez.numero}
                      </span>
                      {isOggi && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase animate-pulse">
                          Oggi
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white text-xs truncate">
                      {lez.titolo || `Lezione ${lez.numero}`}
                    </div>
                    <div className="text-[10.5px] text-slate-300 font-mono mt-0.5">
                      📅 {lez.data} • {lez.orarioInizio}-{lez.orarioFine} ({lez.ore}h)
                    </div>
                    <div className="text-[10px] text-indigo-300 truncate mt-1 flex items-center gap-1 font-semibold">
                      <MapPin className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                      <span className="truncate">{lez.sedeNome}</span>
                    </div>

                    {/* Stato presenza timbrata su questa lezione */}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9.5px]">
                      {hasEntrata && hasUscita ? (
                        <div className="flex flex-col">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            ✓ Presenza Conclusa
                          </span>
                          <span className="text-emerald-300 font-mono text-[9px] font-bold">
                            ⏱️ {timbLez?.oreEMinutiTesto || `${timbLez?.oreFrequentate || lez.ore}h`}
                          </span>
                        </div>
                      ) : hasEntrata ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          ⏱️ Entrata Registrata
                        </span>
                      ) : (
                        <span className="text-slate-500">Non ancora timbrata</span>
                      )}
                      <span className="font-mono text-slate-400">{lez.ore} Ore previste</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sede e Indirizzo Geolocalizzato per la Timbratura GPS della lezione selezionata */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>
                {lezioneCorrente
                  ? `Sede della Lezione #${lezioneCorrente.numero} per Timbratura GPS:`
                  : 'Sede di Svolgimento per Timbratura GPS:'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-bold">
              GPS Certificato: {coordTarget.lat.toFixed(4)}°, {coordTarget.lng.toFixed(4)}°
            </span>
          </div>
          
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-white font-bold block text-sm">📍 {sedeTargetNome}</span>
              <span className="text-slate-400 text-[11px] block">{indirizzoTarget}</span>
            </div>
            <div className="text-[10px] text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto shrink-0 font-medium">
              Raggio tolleranza: 500m
            </div>
          </div>
        </div>

        {/* Descrizione del corso */}
        {corso.descrizione && (
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Programma & Finalità:</span>
            <p>{corso.descrizione}</p>
          </div>
        )}

        {/* STATO ISCRIZIONE E TIMBRATURE GPS VOLONTARIO */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/30 border-2 border-amber-500/50 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">👤</span>
              <div>
                <span className="font-black uppercase text-xs text-white block">
                  Il tuo stato: {volontario.nome} {volontario.cognome}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Matricola: {volontario.matricola || 'N/D'} • Qualifica: {volontario.qualifica}
                </span>
              </div>
            </div>

            {isIscritto ? (
              <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md">
                <Check className="w-3.5 h-3.5" />
                <span>Iscritto ({partecipante?.esito || 'In Frequenza'})</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold text-xs uppercase">
                Non ancora iscritto
              </span>
            )}
          </div>

          {/* Dettagli presenze e timbrature se iscritto */}
          {isIscritto && partecipante && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 flex-wrap gap-1">
                <span className="text-slate-400">Ore Frequentate Rilevate nel Corso:</span>
                <div className="flex flex-col items-end">
                  <span className="font-black font-mono text-amber-400 text-sm">
                    {partecipante.oreFrequentate} / {corso.oreTotali}h ({Math.round(((partecipante.oreFrequentate || 0) / (corso.oreTotali || 1)) * 100)}%)
                  </span>
                  {partecipante.oreEMinutiTesto && (
                    <span className="text-[10.5px] text-emerald-300 font-mono font-bold">
                      ⏱️ Tempo effettivo: {partecipante.oreEMinutiTesto}
                    </span>
                  )}
                </div>
              </div>

              {/* Attestato se rilasciato */}
              {partecipante.numeroAttestato && (
                <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-black text-white text-xs">
                        Attestato Rilasciato con Successo!
                      </div>
                      <div className="text-[10px] text-emerald-300 font-mono">
                        {corso.tipologia === 'Seminario PSV' ? 'Matricola GEV:' : 'Protocollo:'} <strong>{partecipante.numeroAttestato}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Registro Timbrature GPS Entrata e Uscita per la lezione selezionata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className={`p-2.5 rounded-xl border ${
                  haTimbratoEntrata
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] uppercase">
                      1. Timbratura Entrata {lezioneCorrente ? `(#${lezioneCorrente.numero})` : ''}
                    </span>
                    {haTimbratoEntrata && <span className="text-emerald-400 font-bold text-[10px]">✓ Convalidata</span>}
                  </div>
                  {haTimbratoEntrata ? (
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      <div className="font-bold text-white">
                        Ore {entrataInfo?.orario || String(timbraturaLezione?.timbraturaEntrata || partecipante?.timbraturaEntrata)} {entrataInfo?.data ? `(${entrataInfo.data})` : ''}
                      </div>
                      {entrataInfo?.distanzaMetri !== undefined && (
                        <div className="text-[10px] text-emerald-300 font-mono">Distanza dalla sede lezione: ±{entrataInfo.distanzaMetri}m</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10.5px] text-slate-500 mt-1">Non ancora timbrata</div>
                  )}
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  haTimbratoUscita
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] uppercase">
                      2. Timbratura Uscita {lezioneCorrente ? `(#${lezioneCorrente.numero})` : ''}
                    </span>
                    {haTimbratoUscita && <span className="text-emerald-400 font-bold text-[10px]">✓ Convalidata</span>}
                  </div>
                  {haTimbratoUscita ? (
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      <div className="font-bold text-white">
                        Ore {uscitaInfo?.orario || String(timbraturaLezione?.timbraturaUscita || partecipante?.timbraturaUscita)} {uscitaInfo?.data ? `(${uscitaInfo.data})` : ''}
                      </div>
                      {uscitaInfo?.distanzaMetri !== undefined && (
                        <div className="text-[10px] text-emerald-300 font-mono">Distanza dalla sede lezione: ±{uscitaInfo.distanzaMetri}m</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10.5px] text-slate-500 mt-1">
                      {haTimbratoEntrata ? 'Da timbrare al termine di questa lezione' : 'In attesa di entrata'}
                    </div>
                  )}
                </div>
              </div>

              {/* Box riepilogo calcolo effettivo del tempo trascorso tra entrata e uscita */}
              {haTimbratoEntrata && haTimbratoUscita && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-between text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold text-white text-xs block">
                        Presenza Lezione Calcolata (Entrata ➔ Uscita):
                      </span>
                      <span className="text-[11px] text-emerald-300 font-mono">
                        {timbraturaLezione?.oreEMinutiTesto
                          ? `Durata effettiva: ${timbraturaLezione.oreEMinutiTesto} (${timbraturaLezione.oreFrequentate} ore accreditate)`
                          : `Durata: ${timbraturaLezione?.oreFrequentate || 0} ore`}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase shrink-0">
                    GPS Validato
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Feedback GPS */}
          {gpsFeedback && (
            <div className={`p-3 rounded-xl border text-xs leading-snug animate-in fade-in ${
              gpsFeedback.tipo === 'success'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-amber-950/80 border-amber-500 text-amber-200'
            }`}>
              {gpsFeedback.messaggio}
            </div>
          )}

          {/* AZIONI: ISCRIVITI / TIMBRA GPS */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {!isIscritto ? (
              <button
                type="button"
                onClick={() => {
                  onIscriviti(corso.id, volontario);
                  setGpsFeedback({
                    tipo: 'success',
                    messaggio: `✅ Iscrizione a "${corso.titolo}" confermata con successo!`
                  });
                }}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>ISCRIVITI A QUESTO CORSO</span>
              </button>
            ) : null}

            {/* PULSANTE TIMBRATURA GPS (ENTRATA O USCITA SULLA LEZIONE ATTIVA) */}
            <button
              type="button"
              disabled={gpsLoading || haTimbratoUscita}
              onClick={() => eseguiTimbratura()}
              className={`w-full ${!isIscritto ? 'sm:w-1/2' : 'sm:w-full'} py-3 px-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-all border ${
                haTimbratoUscita
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                  : !haTimbratoEntrata
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400 active:scale-95 cursor-pointer'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-cyan-400 active:scale-95 cursor-pointer'
              }`}
            >
              <Navigation className="w-4 h-4 text-white" />
              <span>
                {gpsLoading
                  ? 'RILEVAZIONE COORDINATE GPS SUL POSTO...'
                  : haTimbratoUscita
                  ? `✓ TIMBRATURE COMPLETATE ${lezioneCorrente ? `(#${lezioneCorrente.numero})` : ''}`
                  : !haTimbratoEntrata
                  ? `📍 TIMBRA ENTRATA LEZIONE ${lezioneCorrente ? `(#${lezioneCorrente.numero})` : ''} (GPS)`
                  : `🏁 TIMBRA USCITA LEZIONE ${lezioneCorrente ? `(#${lezioneCorrente.numero})` : ''} (GPS)`}
              </span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            💡 <strong>Regola di presenza:</strong> Timbra l'entrata e l'uscita presso la sede della singola lezione. La presenza e le ore vengono verificate e conteggiate automaticamente nel registro formativo.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Chiudi Scheda
          </button>
        </div>

      </div>
    </div>
  );
};
