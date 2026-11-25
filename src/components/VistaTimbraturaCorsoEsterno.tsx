import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  MapPin,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  User,
  Clock,
  Navigation,
} from 'lucide-react';
import { realtime } from '../services/realtime';
import { PublicCourseDoc } from '../services/firebase';
import { ottieniPosizioneGpsAffidabile } from '../utils/smartGps';
import { calcolaDistanzaMetri } from './PannelloTimbraturaVolontario';
import { formatDateTimeItaly, formatISODateItaly } from '../utils/italianTime';

interface VistaTimbraturaCorsoEsternoProps {
  token: string;
}

const GUEST_STORAGE_KEY = 'CROCE_ORO_GUEST_COURSE_PROFILE';

export const VistaTimbraturaCorsoEsterno: React.FC<VistaTimbraturaCorsoEsternoProps> = ({
  token,
}) => {
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<PublicCourseDoc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [selectedLezioneId, setSelectedLezioneId] = useState('');

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<{
    lat: number;
    lng: number;
    accuratezza: number;
    distanzaMetri: number;
    dentroRaggio: boolean;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<'entrata' | 'uscita' | null>(null);
  const [esitoMsg, setEsitoMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [storicoLocale, setStoricoLocale] = useState<
    Array<{ tipo: 'entrata' | 'uscita'; dataOra: string; aula: string }>
  >([]);

  // Ripristina dati anagrafici ospite da localStorage per comodità tra entrata e uscita
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nome) setNome(String(parsed.nome));
        if (parsed.cognome) setCognome(String(parsed.cognome));
        if (parsed.telefono) setTelefono(String(parsed.telefono));
      }
      const hist = localStorage.getItem(`${GUEST_STORAGE_KEY}_HIST_${token}`);
      if (hist) {
        const parsedH = JSON.parse(hist);
        if (Array.isArray(parsedH)) setStoricoLocale(parsedH);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const data = await realtime.readPublicCourse(token);
      if (!active) return;
      if (!data) {
        setLoadError(
          'Link di timbratura non trovato, scaduto o non ancora sincronizzato. Chiedi al docente del corso di verificare il link.'
        );
        setCourse(null);
      } else if (!data.attivo) {
        setLoadError('La timbratura tramite link esterno per questo corso è attualmente disattivata.');
        setCourse(data);
      } else {
        setCourse(data);
        const oggi = formatISODateItaly();
        const lezOggi = (data.lezioni || []).find((l) => l.data === oggi);
        if (lezOggi) setSelectedLezioneId(lezOggi.id);
        else if (data.lezioni && data.lezioni.length > 0) setSelectedLezioneId(data.lezioni[0].id);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [token]);

  const targetAula = useMemo(() => {
    if (!course) return null;
    const lez = (course.lezioni || []).find((l) => l.id === selectedLezioneId);
    if (lez && lez.coordinate) {
      return {
        nome: lez.aulaNome || course.aulaNome,
        indirizzo: lez.aulaIndirizzo || course.aulaIndirizzo,
        coordinate: lez.coordinate,
        raggioMetri: lez.raggioMetri || course.raggioMetri || 150,
      };
    }
    return {
      nome: course.aulaNome,
      indirizzo: course.aulaIndirizzo,
      coordinate: course.coordinate,
      raggioMetri: course.raggioMetri || 150,
    };
  }, [course, selectedLezioneId]);

  const verificaPosizioneGps = async (): Promise<{
    ok: boolean;
    distanzaMetri: number;
    dentroRaggio: boolean;
  }> => {
    if (!targetAula) return { ok: false, distanzaMetri: 99999, dentroRaggio: false };
    setGpsLoading(true);
    setGpsError(null);
    const res = await ottieniPosizioneGpsAffidabile({ desiredAccuracyMeters: 40 });
    setGpsLoading(false);
    if (!res.ok) {
      setGpsError(res.error);
      setGpsStatus(null);
      return { ok: false, distanzaMetri: 99999, dentroRaggio: false };
    }
    const dist = Math.round(
      calcolaDistanzaMetri(
        res.posizione.lat,
        res.posizione.lng,
        targetAula.coordinate.lat,
        targetAula.coordinate.lng
      )
    );
    const margineTolleranza = Math.min(80, Math.round((res.posizione.accuratezza || 0) * 0.5));
    const dentro = dist <= targetAula.raggioMetri + margineTolleranza;
    setGpsStatus({
      lat: res.posizione.lat,
      lng: res.posizione.lng,
      accuratezza: Math.round(res.posizione.accuratezza || 0),
      distanzaMetri: dist,
      dentroRaggio: dentro,
    });
    if (!dentro) {
      setGpsError(
        `Sei a ${dist}m dall'Aula Didattica "${targetAula.nome}" (raggio consentito: ${targetAula.raggioMetri}m). Avvicinati all'aula per timbrare.`
      );
    }
    return { ok: true, distanzaMetri: dist, dentroRaggio: dentro };
  };

  const handleTimbra = async (tipo: 'entrata' | 'uscita') => {
    setEsitoMsg(null);
    if (!course || !course.attivo || !targetAula) return;

    const cleanNome = nome.trim();
    const cleanCognome = cognome.trim();
    const cleanTel = telefono.trim();
    if (!cleanNome || !cleanCognome) {
      setEsitoMsg({ ok: false, testo: 'Inserisci Nome e Cognome prima di timbrare.' });
      return;
    }
    if (cleanTel.replace(/\D/g, '').length < 6) {
      setEsitoMsg({ ok: false, testo: 'Inserisci un numero di telefono valido (almeno 6 cifre).' });
      return;
    }

    try {
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ nome: cleanNome, cognome: cleanCognome, telefono: cleanTel })
      );
    } catch {}

    setSubmitting(tipo);
    const gps = await verificaPosizioneGps();
    if (!gps.ok || !gps.dentroRaggio) {
      setSubmitting(null);
      if (!gps.ok) {
        setEsitoMsg({
          ok: false,
          testo: 'Posizione GPS obbligatoria per timbrare nell\'Aula Didattica. Attiva la geolocalizzazione e riprova.',
        });
      }
      return;
    }

    const nowStr = formatDateTimeItaly();
    const result = await realtime.submitCourseGuestCheckin({
      tokenId: course.tokenId,
      corsoId: course.corsoId,
      lezioneId: selectedLezioneId || '',
      nome: cleanNome,
      cognome: cleanCognome,
      telefono: cleanTel,
      tipo,
      dataOra: nowStr,
      aulaNome: targetAula.nome,
      distanzaMetri: gps.distanzaMetri,
    });
    setSubmitting(null);

    if (result.ok) {
      const nextHist = [{ tipo, dataOra: nowStr, aula: targetAula.nome }, ...storicoLocale].slice(0, 10);
      setStoricoLocale(nextHist);
      try {
        localStorage.setItem(`${GUEST_STORAGE_KEY}_HIST_${token}`, JSON.stringify(nextHist));
      } catch {}
      setEsitoMsg({
        ok: true,
        testo:
          tipo === 'entrata'
            ? `Timbratura di ENTRATA registrata alle ${nowStr} presso "${targetAula.nome}". Le tue ore saranno conteggiate nel registro presenze del corso.`
            : `Timbratura di USCITA registrata alle ${nowStr} presso "${targetAula.nome}". Presenza aggiornata nel registro del corso.`,
      });
    } else {
      setEsitoMsg({
        ok: false,
        testo: result.error || 'Errore durante l\'invio della timbratura. Riprova tra qualche secondo.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1f] text-white flex flex-col items-center justify-start p-3 sm:p-6">
      <div className="w-full max-w-lg space-y-4">
        {/* Intestazione Associazione */}
        <div className="bg-gradient-to-br from-[#1d1a60] via-[#171a4a] to-slate-900 border border-purple-400/40 rounded-2xl p-5 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-8 h-8 text-purple-300" />
          </div>
          <div className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
            Croce Oro Massa Carrara OdV • Formazione
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white mt-1">
            Timbratura Corso Partecipanti Esterni
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Registra la tua entrata e uscita in aula didattica senza registrazione account.
          </p>
        </div>

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <RefreshCw className="w-7 h-7 text-purple-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-300 font-bold">Caricamento dati del corso...</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="bg-rose-950/60 border border-rose-500/50 rounded-2xl p-5 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-rose-200">{loadError}</p>
          </div>
        )}

        {!loading && course && course.attivo && targetAula && (
          <>
            {/* Scheda Corso & Aula Didattica */}
            <div className="bg-slate-900 border border-purple-500/35 rounded-2xl p-4 space-y-3">
              <div>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase">
                  {course.categoria}
                </span>
                <h2 className="text-base sm:text-lg font-black text-white mt-1.5">
                  {course.titolo}
                </h2>
                <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Inizio: {course.dataInizio}</span>
                  {course.dataFine && <span>Fine: {course.dataFine}</span>}
                  {course.oreTotaliRichieste > 0 && (
                    <span>Monte ore richiesto: {course.oreTotaliRichieste}h</span>
                  )}
                </div>
              </div>

              {course.lezioni && course.lezioni.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                    Lezione / Giornata di Corso
                  </label>
                  <select
                    value={selectedLezioneId}
                    onChange={(e) => setSelectedLezioneId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  >
                    {course.lezioni.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.data} ({l.orarioInizio}–{l.orarioFine}) — {l.argomento || 'Lezione'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-purple-950/40 border border-purple-500/35 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-purple-200 uppercase">
                  <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                  Aula Didattica Abilitata: {targetAula.nome}
                </div>
                {targetAula.indirizzo && (
                  <div className="text-[11px] text-slate-300 pl-5">{targetAula.indirizzo}</div>
                )}
                <div className="text-[10px] text-purple-300/80 pl-5">
                  Verifica GPS richiesta entro {targetAula.raggioMetri} metri dall&apos;aula.
                </div>
              </div>
            </div>

            {/* Modulo Dati Partecipante Esterno */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-black text-white uppercase tracking-wide">
                Inserisci i tuoi dati per la presenza
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Nome *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Es. Mario"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Cognome *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cognome}
                      onChange={(e) => setCognome(e.target.value)}
                      placeholder="Es. Rossi"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Numero di Telefono *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Es. 333 1234567"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Usa sempre lo stesso numero di telefono tra entrata e uscita così il sistema calcolerà correttamente il monte ore del corso.
                </p>
              </div>

              {/* Verifica GPS */}
              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={() => verificaPosizioneGps()}
                  disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
                >
                  <Navigation className={`w-3.5 h-3.5 text-purple-400 ${gpsLoading ? 'animate-spin' : ''}`} />
                  {gpsLoading ? 'Rilevamento GPS in corso...' : 'Verifica Posizione GPS in Aula'}
                </button>

                {gpsStatus && (
                  <div
                    className={`rounded-xl px-3 py-2 text-xs font-bold border ${
                      gpsStatus.dentroRaggio
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {gpsStatus.dentroRaggio
                      ? `✅ Posizione confermata nell'Aula Didattica (${gpsStatus.distanzaMetri}m — precisione ±${gpsStatus.accuratezza}m)`
                      : `⚠️ Distanza dall'aula: ${gpsStatus.distanzaMetri}m (massimo consentito ${targetAula.raggioMetri}m)`}
                  </div>
                )}

                {gpsError && (
                  <div className="rounded-xl px-3 py-2 text-xs font-bold bg-rose-950/60 border border-rose-500/50 text-rose-200">
                    {gpsError}
                  </div>
                )}
              </div>

              {/* Pulsanti Entrata & Uscita */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleTimbra('entrata')}
                  disabled={submitting !== null}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  <LogIn className="w-5 h-5" />
                  {submitting === 'entrata' ? 'Registrazione...' : 'Timbra ENTRATA'}
                </button>

                <button
                  type="button"
                  onClick={() => handleTimbra('uscita')}
                  disabled={submitting !== null}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
                >
                  <LogOut className="w-5 h-5" />
                  {submitting === 'uscita' ? 'Registrazione...' : 'Timbra USCITA'}
                </button>
              </div>

              {esitoMsg && (
                <div
                  className={`rounded-xl p-3.5 text-xs font-bold border flex items-start gap-2 ${
                    esitoMsg.ok
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                  }`}
                >
                  {esitoMsg.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{esitoMsg.testo}</span>
                </div>
              )}
            </div>

            {/* Storico Timbrature del Dispositivo */}
            {storicoLocale.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-[11px] font-black text-purple-300 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Le tue timbrature registrate
                </div>
                <div className="space-y-1.5">
                  {storicoLocale.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2"
                    >
                      <span
                        className={`font-black uppercase ${
                          h.tipo === 'entrata' ? 'text-emerald-400' : 'text-purple-400'
                        }`}
                      >
                        {h.tipo === 'entrata' ? '🟢 ENTRATA' : '🟣 USCITA'}
                      </span>
                      <span className="text-slate-300 font-mono">{h.dataOra}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
