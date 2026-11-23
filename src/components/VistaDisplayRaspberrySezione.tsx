import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone,
  Building2,
  Users,
  Clock,
  Pin,
  AlertTriangle,
  LogIn,
  LogOut,
  RefreshCw,
  X,
  Radio,
  Sparkles,
  CheckCircle2,
  Monitor,
  Car,
  Smartphone,
  Nfc,
  Calendar,
} from 'lucide-react';
import {
  ComunicazioneBacheca,
  SedeAssociativaCompleta,
  TimbraturaVolontario,
} from '../types/adminTypes';
import { CroceOroLogo } from './CroceOroLogo';
import {
  RaspberryDisplayConfig,
  calcolaDurataLiveDaIngresso,
  formatGiornoDataBreveIt,
  formatOraBreve,
  inferDataUscitaTimbratura,
  isComunicazioneAssociativaCentrale,
  isTimbraturaAttualmentePresente,
  isTimbraturaConUscitaValida,
  isTimbraturaNfc,
  matchesComunicazioneSezione,
  matchesSedeTimbratura,
} from '../utils/raspberryDisplayConfig';
import { formatISODateItaly, formatTimeItaly } from '../utils/italianTime';

interface VistaDisplayRaspberrySezioneProps {
  sedi: SedeAssociativaCompleta[];
  sezioneSelezionataId: string;
  onCambiaSezione?: (sedeId: string) => void;
  comunicazioni: ComunicazioneBacheca[];
  timbrature: TimbraturaVolontario[];
  config: RaspberryDisplayConfig;
  isPreview?: boolean;
  onChiudiPreview?: () => void;
  onRefreshManuale?: () => void;
  ultimoAggiornamento?: Date | null;
}

/**
 * Hook riutilizzabile di auto-scroll verticale dolce per monitor TV/Raspberry:
 * Pausa in alto -> scorrimento fluido fino in fondo -> pausa in basso -> ritorno in alto.
 * Si mette automaticamente in pausa se l'utente passa il mouse o tocca la colonna.
 */
function useAutoScrollColumn(
  ref: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  velocita: RaspberryDisplayConfig['velocitaScroll'],
  depKey: string
) {
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const handleEnter = () => {
      pausedRef.current = true;
    };
    const handleLeave = () => {
      pausedRef.current = false;
    };

    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    el.addEventListener('touchstart', handleEnter, { passive: true });
    el.addEventListener('touchend', handleLeave, { passive: true });

    let phase: 'pause_top' | 'scrolling_down' | 'pause_bottom' = 'pause_top';
    let phaseTimerMs = 0;
    const PAUSE_MS = 6500;
    const stepPx = velocita === 'veloce' ? 1.4 : velocita === 'medio' ? 0.9 : 0.55;
    let exactTop = el.scrollTop;

    const interval = window.setInterval(() => {
      if (pausedRef.current) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 12) {
        if (el.scrollTop !== 0) el.scrollTop = 0;
        phase = 'pause_top';
        phaseTimerMs = 0;
        exactTop = 0;
        return;
      }

      if (phase === 'pause_top') {
        phaseTimerMs += 40;
        if (phaseTimerMs >= PAUSE_MS) {
          phase = 'scrolling_down';
          phaseTimerMs = 0;
          exactTop = el.scrollTop;
        }
      } else if (phase === 'scrolling_down') {
        exactTop += stepPx;
        el.scrollTop = exactTop;
        if (el.scrollTop >= maxScroll - 2) {
          phase = 'pause_bottom';
          phaseTimerMs = 0;
        }
      } else if (phase === 'pause_bottom') {
        phaseTimerMs += 40;
        if (phaseTimerMs >= PAUSE_MS) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
          exactTop = 0;
          phase = 'pause_top';
          phaseTimerMs = 0;
        }
      }
    }, 40);

    return () => {
      window.clearInterval(interval);
      el.removeEventListener('mouseenter', handleEnter);
      el.removeEventListener('mouseleave', handleLeave);
      el.removeEventListener('touchstart', handleEnter);
      el.removeEventListener('touchend', handleLeave);
    };
  }, [ref, enabled, velocita, depKey]);
}

function ordinaComunicazioniDisplay(list: ComunicazioneBacheca[]): ComunicazioneBacheca[] {
  // Messaggi sempre ordinati dal più recente in alto
  return [...list].sort((a, b) => {
    const dtA = `${a.dataPubblicazione || ''} ${a.oraPubblicazione || ''}`.trim();
    const dtB = `${b.dataPubblicazione || ''} ${b.oraPubblicazione || ''}`.trim();
    const cmpDt = dtB.localeCompare(dtA);
    if (cmpDt !== 0) return cmpDt;
    const updA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
    const updB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
    return updB - updA;
  });
}

function formatDataItalianaEstesa(date: Date): string {
  try {
    const raw = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return date.toLocaleDateString('it-IT');
  }
}

function formatDataPubblicazioneBreve(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const VistaDisplayRaspberrySezione: React.FC<VistaDisplayRaspberrySezioneProps> = ({
  sedi,
  sezioneSelezionataId,
  onCambiaSezione,
  comunicazioni,
  timbrature,
  config,
  isPreview = false,
  onChiudiPreview,
  onRefreshManuale,
  ultimoAggiornamento,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const colAssociativaRef = useRef<HTMLDivElement | null>(null);
  const colSezioneRef = useRef<HTMLDivElement | null>(null);
  const colPresentiRef = useRef<HTMLDivElement | null>(null);
  const colUscitiRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sedeCorrente = useMemo<SedeAssociativaCompleta | null>(() => {
    if (!Array.isArray(sedi) || sedi.length === 0) return null;
    const direct = sedi.find((s) => s.id === sezioneSelezionataId);
    if (direct) return direct;
    const byCode = sedi.find(
      (s) => s.codice && s.codice.toLowerCase() === String(sezioneSelezionataId || '').toLowerCase()
    );
    if (byCode) return byCode;
    return sedi[0];
  }, [sedi, sezioneSelezionataId]);

  // 1. BACHECA ASSOCIATIVA (Sede Centrale)
  const comunicazioniAssociative = useMemo(() => {
    const base = (comunicazioni || []).filter((c) => {
      if (!c || c.attiva === false) return false;
      if (!isComunicazioneAssociativaCentrale(c)) return false;
      if (config.soloImportantiAssociativa) {
        return c.priorita === 'Urgente' || c.priorita === 'Importante' || Boolean(c.evidenziata);
      }
      return true;
    });
    return ordinaComunicazioniDisplay(base);
  }, [comunicazioni, config.soloImportantiAssociativa]);

  // 2. BACHECA DI SEZIONE (Singola Sezione)
  const comunicazioniSezione = useMemo(() => {
    if (!sedeCorrente) return [];
    const base = (comunicazioni || []).filter((c) => {
      if (!c || c.attiva === false) return false;
      if (!matchesComunicazioneSezione(c, sedeCorrente)) return false;
      if (config.soloImportantiSezione) {
        return c.priorita === 'Urgente' || c.priorita === 'Importante' || Boolean(c.evidenziata);
      }
      return true;
    });
    return ordinaComunicazioniDisplay(base);
  }, [comunicazioni, sedeCorrente, config.soloImportantiSezione]);

  // 3A. VOLONTARI PRESENTI DI TURNO IN SEZIONE (Badgiato Ingresso via NFC o App, esclude NFC >24h auto-chiuse)
  const volontariPresentiSezione = useMemo(() => {
    const list = (timbrature || []).filter((t) => {
      if (!isTimbraturaAttualmentePresente(t, now)) return false;
      return matchesSedeTimbratura(t, sedeCorrente);
    });
    return list.sort((a, b) => {
      const dtA = `${a.data || ''} ${a.orarioIngresso || ''}`;
      const dtB = `${b.data || ''} ${b.orarioIngresso || ''}`;
      return dtB.localeCompare(dtA);
    });
  }, [timbrature, sedeCorrente, now]);

  // 3B. ULTIMI 10 VOLONTARI USCITI DAL TURNO IN SEZIONE (con giorno, data e ora ingresso/uscita)
  const volontariUscitiSezione = useMemo(() => {
    const list = (timbrature || []).filter((t) => {
      if (!isTimbraturaConUscitaValida(t)) return false;
      return matchesSedeTimbratura(t, sedeCorrente);
    });
    return list
      .sort((a, b) => {
        const dOutA = inferDataUscitaTimbratura(a);
        const dOutB = inferDataUscitaTimbratura(b);
        const dtA = `${dOutA || a.data || ''} ${a.orarioUscita || a.orarioIngresso || ''}`;
        const dtB = `${dOutB || b.data || ''} ${b.orarioUscita || b.orarioIngresso || ''}`;
        return dtB.localeCompare(dtA);
      })
      .slice(0, 10);
  }, [timbrature, sedeCorrente]);

  useAutoScrollColumn(
    colAssociativaRef,
    config.autoScrollAttivo,
    config.velocitaScroll,
    `assoc-${comunicazioniAssociative.length}-${sedeCorrente?.id || ''}`
  );
  useAutoScrollColumn(
    colSezioneRef,
    config.autoScrollAttivo,
    config.velocitaScroll,
    `sez-${comunicazioniSezione.length}-${sedeCorrente?.id || ''}`
  );
  useAutoScrollColumn(
    colPresentiRef,
    config.autoScrollAttivo,
    config.velocitaScroll,
    `pres-${volontariPresentiSezione.length}-${sedeCorrente?.id || ''}`
  );
  useAutoScrollColumn(
    colUscitiRef,
    config.autoScrollAttivo,
    config.velocitaScroll,
    `usc-${volontariUscitiSezione.length}-${sedeCorrente?.id || ''}`
  );

  const visibleColumnsCount =
    (config.mostraBachecaAssociativa ? 1 : 0) +
    (config.mostraBachecaSezione ? 1 : 0) +
    (config.mostraPresenzeSezione ? 1 : 0);

  // Tutte e 3 le sezioni tematiche contestualmente e distintamente visibili sullo schermo del Raspberry (da md / 768px in su)
  const gridColsClass =
    visibleColumnsCount <= 1
      ? 'grid-cols-1'
      : visibleColumnsCount === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-3';

  const oraLiveStr = formatTimeItaly(now, true);
  const dataLiveStr = formatDataItalianaEstesa(now);
  const oggiIsoStr = formatISODateItaly(now);

  const handleManualRefresh = () => {
    if (!onRefreshManuale) return;
    setRefreshing(true);
    try {
      onRefreshManuale();
    } finally {
      window.setTimeout(() => setRefreshing(false), 700);
    }
  };

  const renderCardComunicazione = (
    com: ComunicazioneBacheca,
    theme: 'centrale' | 'sezione'
  ) => {
    const isUrgente = com.priorita === 'Urgente';
    const isImportante = com.priorita === 'Importante';
    const cardBorder = isUrgente
      ? 'border-rose-500/80 bg-rose-950/35'
      : isImportante
      ? 'border-amber-400/75 bg-amber-950/25'
      : theme === 'centrale'
      ? 'border-amber-400/35 bg-slate-900/90'
      : 'border-cyan-400/35 bg-slate-900/90';

    return (
      <article
        key={com.id}
        className={`rounded-2xl border-2 p-3.5 shadow-lg transition-all space-y-2 ${cardBorder}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {com.evidenziata && (
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Pin className="w-3 h-3" />
                In Evidenza
              </span>
            )}
            {isUrgente ? (
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                Urgente
              </span>
            ) : isImportante ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-200 border border-amber-400/60 text-[10px] font-black uppercase tracking-wider">
                Importante
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  theme === 'centrale'
                    ? 'bg-indigo-950/80 text-amber-200 border-amber-400/30'
                    : 'bg-cyan-950/80 text-cyan-200 border-cyan-400/30'
                }`}
              >
                {com.categoria || 'Comunicazione'}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-300">
            {formatDataPubblicazioneBreve(com.dataPubblicazione)}
            {com.oraPubblicazione ? ` • ${formatOraBreve(com.oraPubblicazione)}` : ''}
          </span>
        </div>

        <h3 className="text-base xl:text-[17px] font-black text-white leading-snug whitespace-normal break-words">
          {com.titolo}
        </h3>

        {com.contenuto && (
          <p className="text-xs xl:text-[13.5px] text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
            {com.contenuto}
          </p>
        )}

        <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="font-bold text-slate-300 truncate">
            {com.autore || (theme === 'centrale' ? 'Sede Centrale' : 'Referente Sezione')}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            {com.categoria}
          </span>
        </div>
      </article>
    );
  };

  return (
    <div className="h-[100dvh] w-full bg-[#060918] text-white flex flex-col overflow-hidden select-none">
      {/* Barra Anteprima (solo quando aperto dal pannello Gestione di Admin/Presidente/Segretario) */}
      {isPreview && (
        <div className="shrink-0 bg-gradient-to-r from-fuchsia-950 via-indigo-950 to-slate-950 border-b border-fuchsia-500/40 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <Monitor className="w-4 h-4 text-fuchsia-300 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider text-fuchsia-200">
              Anteprima Live Schermo Raspberry
            </span>
            {sedi.length > 1 && onCambiaSezione && (
              <select
                value={sedeCorrente?.id || ''}
                onChange={(e) => onCambiaSezione(e.target.value)}
                className="ml-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-fuchsia-400/50 text-xs font-bold text-white focus:outline-none cursor-pointer max-w-[260px]"
              >
                {sedi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefreshManuale && (
              <button
                type="button"
                onClick={handleManualRefresh}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Aggiorna Ora</span>
              </button>
            )}
            {onChiudiPreview && (
              <button
                type="button"
                onClick={onChiudiPreview}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow"
              >
                <X className="w-3.5 h-3.5" />
                <span>Chiudi Anteprima</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOP HEADER DISPLAY RASPBERRY */}
      <header className="shrink-0 bg-gradient-to-r from-[#14124a] via-[#0e1738] to-[#0a132c] border-b-2 border-[#bfa353] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <CroceOroLogo size="md" className="shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                Croce Oro Massa Carrara OdV • Display Sezione
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-black text-emerald-300 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <h1 className="text-base sm:text-xl xl:text-2xl font-black text-white leading-tight truncate">
              {sedeCorrente?.nome || 'Sezione Operativa'}
            </h1>
          </div>
        </div>

        {/* Contatori sintetici + Orologio Grande */}
        <div className="flex items-center gap-3 sm:gap-5 ml-auto">
          <div className="hidden md:flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/50 text-center">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">
                Sede Centrale
              </div>
              <div className="text-sm font-black font-mono text-white">
                {comunicazioniAssociative.length}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-center">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-cyan-300">
                Sezione
              </div>
              <div className="text-sm font-black font-mono text-white">
                {comunicazioniSezione.length}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-center">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-emerald-300">
                Presenti
              </div>
              <div className="text-sm font-black font-mono text-emerald-300">
                {volontariPresentiSezione.length}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-orange-500/15 border border-orange-400/50 text-center">
              <div className="text-[9.5px] font-black uppercase tracking-wider text-orange-300">
                Usciti
              </div>
              <div className="text-sm font-black font-mono text-orange-200">
                {volontariUscitiSezione.length}
              </div>
            </div>
          </div>

          <div className="text-right pl-3 border-l border-white/15">
            <div className="text-xl sm:text-3xl font-black font-mono tracking-wider text-amber-300 leading-none tabular-nums">
              {oraLiveStr}
            </div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-300 mt-1">
              {dataLiveStr}
            </div>
          </div>
        </div>
      </header>

      {/* CORPO PRINCIPALE — 3 SEZIONI TEMATICHE CONTESTUALI E DISTINTE SULLO SCHERMO */}
      <main className={`flex-1 min-h-0 p-2.5 sm:p-3 grid ${gridColsClass} gap-2.5 xl:gap-3 overflow-y-auto md:overflow-hidden`}>
        {/* ================================================================= */}
        {/* SEZIONE 1: BACHECA ASSOCIATIVA (COMUNICAZIONI DALLA SEDE CENTRALE) */}
        {/* ================================================================= */}
        {config.mostraBachecaAssociativa && (
          <section className="flex flex-col min-h-[300px] md:min-h-0 rounded-2xl border-2 border-amber-400/75 bg-gradient-to-b from-[#13123c]/95 via-slate-950/95 to-slate-950 shadow-2xl overflow-hidden">
            <div className="shrink-0 px-3.5 py-2.5 bg-gradient-to-r from-[#1d1a60] via-[#2c257a] to-amber-900/70 border-b-2 border-amber-400/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow">
                  <Megaphone className="w-4 h-4 xl:w-5 xl:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9.5px] font-black uppercase tracking-[0.16em] text-amber-300">
                    Sezione 1 • Sede Centrale
                  </div>
                  <h2 className="text-sm xl:text-base font-black text-white uppercase tracking-wide leading-tight truncate">
                    Bacheca Associativa
                  </h2>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-xl bg-amber-400/20 border border-amber-300/60 text-amber-200 font-mono font-black text-xs shrink-0">
                {comunicazioniAssociative.length}
              </span>
            </div>

            <div
              ref={colAssociativaRef}
              className="flex-1 min-h-0 overflow-y-auto p-2.5 xl:p-3 space-y-2.5"
            >
              {comunicazioniAssociative.length === 0 ? (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-4 text-slate-400 space-y-2">
                  <Megaphone className="w-10 h-10 text-amber-400/35" />
                  <p className="text-sm font-bold text-slate-300">
                    Nessuna comunicazione attiva dalla Sede Centrale
                  </p>
                  <p className="text-xs text-slate-500">
                    Le comunicazioni ufficiali pubblicate per tutta l&apos;associazione appariranno automaticamente qui (le più recenti in alto).
                  </p>
                </div>
              ) : (
                comunicazioniAssociative.map((com) => renderCardComunicazione(com, 'centrale'))
              )}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* SEZIONE 2: BACHECA DI SEZIONE (COMUNICAZIONI DELLA SINGOLA SEZIONE) */}
        {/* ================================================================= */}
        {config.mostraBachecaSezione && (
          <section className="flex flex-col min-h-[300px] md:min-h-0 rounded-2xl border-2 border-cyan-400/75 bg-gradient-to-b from-[#082538]/95 via-slate-950/95 to-slate-950 shadow-2xl overflow-hidden">
            <div className="shrink-0 px-3.5 py-2.5 bg-gradient-to-r from-cyan-950 via-sky-900/90 to-slate-900 border-b-2 border-cyan-400/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 shadow">
                  <Building2 className="w-4 h-4 xl:w-5 xl:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9.5px] font-black uppercase tracking-[0.16em] text-cyan-300 truncate">
                    Sezione 2 • {sedeCorrente?.comune || 'Sezione Locale'}
                  </div>
                  <h2 className="text-sm xl:text-base font-black text-white uppercase tracking-wide leading-tight truncate">
                    Bacheca di Sezione
                  </h2>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-xl bg-cyan-400/20 border border-cyan-300/60 text-cyan-200 font-mono font-black text-xs shrink-0">
                {comunicazioniSezione.length}
              </span>
            </div>

            <div
              ref={colSezioneRef}
              className="flex-1 min-h-0 overflow-y-auto p-2.5 xl:p-3 space-y-2.5"
            >
              {comunicazioniSezione.length === 0 ? (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-4 text-slate-400 space-y-2">
                  <Building2 className="w-10 h-10 text-cyan-400/35" />
                  <p className="text-sm font-bold text-slate-300">
                    Nessuna comunicazione specifica per questa sezione
                  </p>
                  <p className="text-xs text-slate-500">
                    Gli avvisi dedicati a <strong className="text-cyan-300">{sedeCorrente?.nome}</strong> verranno visualizzati qui (i più recenti in alto).
                  </p>
                </div>
              ) : (
                comunicazioniSezione.map((com) => renderCardComunicazione(com, 'sezione'))
              )}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* SEZIONE 3: PRESENZE & BADGE DI SEZIONE (PRESENTI + ULTIMI 10 USCITI) */}
        {/* ================================================================= */}
        {config.mostraPresenzeSezione && (
          <section className="flex flex-col min-h-[420px] md:min-h-0 rounded-2xl border-2 border-emerald-400/75 bg-gradient-to-b from-[#07261f]/95 via-slate-950/95 to-slate-950 shadow-2xl overflow-hidden">
            <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-emerald-950 via-teal-900/90 to-slate-900 border-b-2 border-emerald-400/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 shadow">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    Sezione 3 • Badge Ingresso / Uscita
                  </div>
                  <h2 className="text-sm sm:text-base xl:text-lg font-black text-white uppercase tracking-wide leading-tight truncate">
                    Presenze di Turno
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 font-mono font-black text-xs">
                  IN {volontariPresentiSezione.length}
                </span>
                <span className="px-2 py-1 rounded-lg bg-orange-500/25 border border-orange-400/60 text-orange-200 font-mono font-black text-xs">
                  OUT {volontariUscitiSezione.length}
                </span>
              </div>
            </div>

            {/* Divisione netta in 2 aree: PRESENTI (Verde) e USCITI (Arancio/Ambra) */}
            <div className="flex-1 min-h-0 flex flex-col divide-y-2 divide-slate-800">
              {/* AREA 3A: VOLONTARI PRESENTI DI TURNO IN SEZIONE (BADGIATO INGRESSO) */}
              <div className="flex-1 min-h-0 flex flex-col bg-emerald-950/15">
                <div className="shrink-0 px-3.5 py-2 bg-emerald-950/75 border-b border-emerald-500/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <LogIn className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      Presenti di Turno in Sezione
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-200">
                    {volontariPresentiSezione.length} in sede
                  </span>
                </div>

                <div
                  ref={colPresentiRef}
                  className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2"
                >
                  {volontariPresentiSezione.length === 0 ? (
                    <div className="h-full min-h-[90px] flex flex-col items-center justify-center text-center px-3 text-slate-400">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500/35 mb-1" />
                      <span className="text-xs font-bold text-slate-300">
                        Nessun volontario attualmente badgiato in sezione
                      </span>
                    </div>
                  ) : (
                    volontariPresentiSezione.map((t) => {
                      const durata = calcolaDurataLiveDaIngresso(t.data, t.orarioIngresso, now);
                      const isNfc = isTimbraturaNfc(t);
                      const ingressoAltroGiorno = Boolean(t.data && t.data !== oggiIsoStr);
                      return (
                        <div
                          key={t.id}
                          className="rounded-xl bg-emerald-950/45 border border-emerald-500/50 px-3 py-2 flex items-center justify-between gap-2 shadow-md"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="text-sm xl:text-[15px] font-black text-white truncate">
                                {t.volontarioNome}
                              </span>
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                  isNfc
                                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                                }`}
                              >
                                {isNfc ? <Nfc className="w-2.5 h-2.5" /> : <Smartphone className="w-2.5 h-2.5" />}
                                {isNfc ? 'NFC' : 'APP'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 pl-4">
                              <span className="text-[11px] font-bold text-emerald-200/90">
                                {t.qualifica || 'Volontario'}
                              </span>
                              {t.mezzoAssegnato && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-emerald-500/40 text-[10px] font-mono font-black text-amber-300">
                                  <Car className="w-3 h-3" />
                                  {t.mezzoAssegnato}
                                </span>
                              )}
                              {t.attivitaSvolta && (
                                <span className="text-[10.5px] text-slate-300 truncate max-w-[170px]">
                                  • {t.attivitaSvolta}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 pl-2 border-l border-emerald-500/30">
                            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                              {ingressoAltroGiorno ? formatGiornoDataBreveIt(t.data) : 'Ingresso'}
                            </div>
                            <div className="text-base xl:text-lg font-black font-mono text-white leading-tight tabular-nums">
                              {formatOraBreve(t.orarioIngresso)}
                            </div>
                            {durata && (
                              <div className="text-[10px] font-mono font-bold text-emerald-300/90 mt-0.5">
                                da {durata}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AREA 3B: ULTIMI 10 VOLONTARI USCITI (CON GIORNO, DATA E ORA INGRESSO + USCITA) */}
              <div className="flex-1 min-h-0 flex flex-col bg-orange-950/10">
                <div className="shrink-0 px-3.5 py-2 bg-slate-900/95 border-b border-orange-500/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-orange-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-orange-300">
                      Ultimi 10 Volontari Usciti
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-orange-200">
                    {volontariUscitiSezione.length} / 10
                  </span>
                </div>

                <div
                  ref={colUscitiRef}
                  className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2"
                >
                  {volontariUscitiSezione.length === 0 ? (
                    <div className="h-full min-h-[90px] flex flex-col items-center justify-center text-center px-3 text-slate-400">
                      <Clock className="w-7 h-7 text-orange-400/30 mb-1" />
                      <span className="text-xs font-bold text-slate-300">
                        Nessuna uscita registrata presso questa sezione
                      </span>
                    </div>
                  ) : (
                    volontariUscitiSezione.map((t) => {
                      const dataInLabel = formatGiornoDataBreveIt(t.data);
                      const dataOutIso = inferDataUscitaTimbratura(t);
                      const dataOutLabel = formatGiornoDataBreveIt(dataOutIso);
                      const cambioGiorno = Boolean(dataOutIso && t.data && dataOutIso !== t.data);
                      const isNfc = isTimbraturaNfc(t);

                      return (
                        <div
                          key={t.id}
                          className="rounded-xl bg-slate-900/90 border border-orange-400/40 px-3 py-2 space-y-1.5 shadow"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              <span className="text-sm font-black text-slate-100 truncate">
                                {t.volontarioNome}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase shrink-0 ${
                                  isNfc
                                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {isNfc ? 'NFC' : 'APP'}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-amber-200 shrink-0">
                              <Calendar className="w-3 h-3 text-amber-400" />
                              {dataInLabel}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400 min-w-0">
                              <span className="font-semibold text-slate-300 truncate">
                                {t.qualifica || 'Volontario'}
                              </span>
                              {(t.oreEMinuti || typeof t.oreTotali === 'number') && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[9.5px] font-bold">
                                  {t.oreEMinuti || `${Number(t.oreTotali).toFixed(1)}h`}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                              <div className="px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-center">
                                <div className="text-[8px] font-black uppercase text-emerald-300 leading-none">
                                  Entrata
                                </div>
                                <div className="text-xs font-black font-mono text-white mt-0.5 tabular-nums">
                                  {formatOraBreve(t.orarioIngresso)}
                                </div>
                              </div>
                              <span className="text-slate-500 font-black">→</span>
                              <div className="px-2 py-0.5 rounded-lg bg-orange-950/75 border border-orange-400/50 text-center">
                                <div className="text-[8px] font-black uppercase text-orange-300 leading-none">
                                  Uscita{cambioGiorno ? ` (${dataOutLabel.slice(0, 9)})` : ''}
                                </div>
                                <div className="text-xs font-black font-mono text-orange-100 mt-0.5 tabular-nums">
                                  {formatOraBreve(t.orarioUscita)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER / TICKER AVVISO SEDE CENTRALE */}
      <footer className="shrink-0 bg-[#0b1026] border-t border-slate-800 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        {config.tickerAvvisoCentrale ? (
          <div className="flex items-center gap-2 min-w-0 flex-1 text-amber-300 font-bold">
            <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span className="truncate">{config.tickerAvvisoCentrale}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-300">
              Aggiornamento automatico attivo ogni {config.refreshSecondi}s • Croce Oro Massa Carrara OdV
            </span>
          </div>
        )}
        <div className="font-mono text-[10.5px] text-slate-400 shrink-0">
          Ultimo sync: {ultimoAggiornamento ? formatTimeItaly(ultimoAggiornamento, true) : oraLiveStr}
        </div>
      </footer>
    </div>
  );
};
