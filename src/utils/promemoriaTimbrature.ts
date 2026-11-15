import { TurnoSedeOperativa, TimbraturaVolontario, CorsoFormazione } from '../types/adminTypes';
import { addDaysISODate, formatISODateItaly, parseItalianDateTimeMs } from './italianTime';

export type TipoEventoPromemoriaTimb = 'turno' | 'corso';
export type FasePromemoriaTimb = 'entry_before' | 'entry_after' | 'exit_before' | 'exit_after';

export interface PromemoriaTimbraturaDue {
  dedupKey: string;
  eventId: string;
  tipo: TipoEventoPromemoriaTimb;
  fase: FasePromemoriaTimb;
  azioneRichiesta: 'entrata' | 'uscita';
  isRitardo: boolean; // false = -10 min (notifica standard device), true = +10 min (notifica diversa non sirena)
  titolo: string;
  messaggio: string;
  dettaglioOrario: string;
  luogo: string;
  corsoId?: string;
}

const STORAGE_FIRED_KEY = 'CROCE_ORO_PROMEMORIA_TIMBRATURE_INVIATI';

function normalizzaNome(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toLocalISODate(d: Date): string {
  return formatISODateItaly(d);
}

function parseTimeParts(timeStr?: string): { hours: number; minutes: number; seconds: number } | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  if (isNaN(hours) || isNaN(minutes) || hours > 24 || minutes > 59) return null;
  return { hours, minutes, seconds };
}

function parseLocalDateTimeMs(dateISO: string, timeStr?: string): number | null {
  return parseItalianDateTimeMs(dateISO, timeStr);
}

function resolveSessionBounds(dateISO: string, startStr?: string, endStr?: string): { startMs: number; endMs: number } | null {
  const startParts = parseTimeParts(startStr);
  const endParts = parseTimeParts(endStr);
  if (!startParts || !endParts) return null;

  const startMs = parseLocalDateTimeMs(dateISO, startStr);
  let endMs = parseLocalDateTimeMs(dateISO, endStr);
  if (startMs === null || endMs === null) return null;

  if (endMs <= startMs) {
    // Turno/lezione notturna o fino a mezzanotte
    endMs += 24 * 60 * 60 * 1000;
  }
  return { startMs, endMs };
}

function isVolontarioAssegnatoATurno(turno: TurnoSedeOperativa, volId: string, volNomeNorm: string): boolean {
  const matchSlot = (slot?: { id?: string; nome?: string }) => {
    if (!slot) return false;
    if (volId && slot.id && slot.id === volId) return true;
    if (volNomeNorm && slot.nome && normalizzaNome(slot.nome) === volNomeNorm) return true;
    return false;
  };

  if (
    matchSlot(turno.autista) ||
    matchSlot(turno.caposervizio) ||
    matchSlot(turno.soccorritore2) ||
    matchSlot(turno.terzoSoccorritore) ||
    matchSlot(turno.operatoreCentrale) ||
    matchSlot(turno.centralinista) ||
    matchSlot(turno.osservatore)
  ) {
    return true;
  }

  if (Array.isArray(turno.richiesteIscrizione)) {
    const approved = turno.richiesteIscrizione.some(
      (r) =>
        r.stato === 'Approvato' &&
        ((volId && r.volontarioId === volId) ||
          (volNomeNorm && r.volontarioNome && normalizzaNome(r.volontarioNome) === volNomeNorm))
    );
    if (approved) return true;
  }

  return false;
}

function isTimbraturaDelVolontario(t: TimbraturaVolontario, volId: string, volNomeNorm: string): boolean {
  if (volId && t.volontarioId === volId) return true;
  if (volNomeNorm && t.volontarioNome && normalizzaNome(t.volontarioNome) === volNomeNorm) return true;
  return false;
}

function resolveTurnoOrariFallback(turno: TurnoSedeOperativa): { start: string; end: string } | null {
  if (turno.orarioInizio && turno.orarioFine) {
    return { start: turno.orarioInizio, end: turno.orarioFine };
  }
  const fascia = (turno.fasciaOraria || '').toLowerCase();
  if (fascia.includes('mattin')) return { start: '08:00', end: '14:00' };
  if (fascia.includes('pomerigg')) return { start: '14:00', end: '20:00' };
  if (fascia.includes('nott')) return { start: '20:00', end: '08:00' };
  if (fascia.includes('h24')) return { start: '08:00', end: '08:00' };
  return null;
}

export function caricaMappaPromemoriaInviati(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const cleaned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && ts >= cutoff) {
        cleaned[k] = ts;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function salvaPromemoriaInviato(dedupKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = caricaMappaPromemoriaInviati();
    current[dedupKey] = Date.now();
    localStorage.setItem(STORAGE_FIRED_KEY, JSON.stringify(current));
  } catch {}
}

export interface ValutaPromemoriaParams {
  nowMs?: number;
  volontarioId: string;
  volontarioNome: string;
  turni: TurnoSedeOperativa[];
  corsi: CorsoFormazione[];
  timbrature: TimbraturaVolontario[];
}

const TEN_MIN_MS = 10 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const ENTRY_MATCH_EARLY_MS = 3 * 60 * 60 * 1000;

/**
 * Calcola tutti i promemoria timbratura attivi nell'istante corrente per il volontario:
 * - Turni di servizio: -10m entrata, +10m entrata se non timbrato, -10m uscita se entrata aperta, +10m uscita se ancora aperta
 * - Corsi/Formazione (lezioni o sessione singola): stesse finestre e notifiche
 */
export function valutaPromemoriaTimbratureAttivi(params: ValutaPromemoriaParams): PromemoriaTimbraturaDue[] {
  const { volontarioId, volontarioNome, turni, corsi, timbrature } = params;
  const volId = (volontarioId || '').trim();
  const volNomeNorm = normalizzaNome(volontarioNome);

  if ((!volId && !volNomeNorm) || volId === 'vol-admin') {
    return [];
  }

  const nowMs = params.nowMs ?? Date.now();
  const nowDate = new Date(nowMs);
  const todayStr = formatISODateItaly(nowDate);
  const yesterdayStr = addDaysISODate(todayStr, -1);

  const mieiTimb = (timbrature || []).filter((t) => isTimbraturaDelVolontario(t, volId, volNomeNorm));
  const risultati: PromemoriaTimbraturaDue[] = [];

  // -------------------------------------------------------------------------
  // 1. VALUTAZIONE TURNI DI SERVIZIO
  // -------------------------------------------------------------------------
  for (const turno of turni || []) {
    if (!turno || !turno.data) continue;
    if (turno.data !== todayStr && turno.data !== yesterdayStr) continue;
    if (!isVolontarioAssegnatoATurno(turno, volId, volNomeNorm)) continue;

    const orari = resolveTurnoOrariFallback(turno);
    if (!orari) continue;
    const bounds = resolveSessionBounds(turno.data, orari.start, orari.end);
    if (!bounds) continue;

    const { startMs, endMs } = bounds;
    const sedeLabel = turno.sedeNome || 'Sede Operativa';
    const fasciaLabel = `${orari.start} - ${orari.end}`;

    // Verifica timbrature di servizio (!t.corsoId) pertinenti a questo turno
    const timbServizioCorrispondenti = mieiTimb.filter((t) => {
      if (t.corsoId) return false;
      const tEntryMs = parseLocalDateTimeMs(t.data, t.orarioIngresso);
      if (tEntryMs !== null) {
        if (tEntryMs >= startMs - ENTRY_MATCH_EARLY_MS && tEntryMs <= endMs + 15 * 60 * 1000) {
          return true;
        }
      }
      // In alternativa timbratura aperta sullo stesso giorno del turno
      return !t.orarioUscita && (t.data === turno.data || t.data === todayStr);
    });

    const haTimbratoEntrata = timbServizioCorrispondenti.length > 0;
    const timbApertaUscita = timbServizioCorrispondenti.find((t) => !t.orarioUscita || t.orarioUscita.trim() === '');

    // A) 10 min prima inizio turno (entrata mancante) -> Notifica standard device
    if (!haTimbratoEntrata && nowMs >= startMs - TEN_MIN_MS && nowMs < startMs) {
      risultati.push({
        dedupKey: `turno:${turno.id}:${turno.data}:entry_before:${volId || volNomeNorm}`,
        eventId: turno.id,
        tipo: 'turno',
        fase: 'entry_before',
        azioneRichiesta: 'entrata',
        isRitardo: false,
        titolo: '🕒 Promemoria Timbratura Ingresso (-10 min)',
        messaggio: `Tra meno di 10 minuti inizia il tuo turno (${fasciaLabel}) presso ${sedeLabel}. Ricorda di effettuare la timbratura GPS in entrata.`,
        dettaglioOrario: fasciaLabel,
        luogo: sedeLabel
      });
    }

    // B) 10 min dopo inizio turno (entrata ancora mancante) -> Notifica diversa (NO sirena)
    if (!haTimbratoEntrata && nowMs >= startMs + TEN_MIN_MS && nowMs < endMs) {
      risultati.push({
        dedupKey: `turno:${turno.id}:${turno.data}:entry_after:${volId || volNomeNorm}`,
        eventId: turno.id,
        tipo: 'turno',
        fase: 'entry_after',
        azioneRichiesta: 'entrata',
        isRitardo: true,
        titolo: '⚠️ Timbratura Ingresso Non Ancora Effettuata',
        messaggio: `Sono passati oltre 10 minuti dall'inizio del turno (${orari.start}) presso ${sedeLabel} ma non risulta la timbratura in entrata. Effettua subito la timbratura GPS.`,
        dettaglioOrario: fasciaLabel,
        luogo: sedeLabel
      });
    }

    // C) 10 min prima fine turno (entrata aperta senza uscita) -> Notifica standard device
    if (timbApertaUscita && nowMs >= endMs - TEN_MIN_MS && nowMs < endMs) {
      risultati.push({
        dedupKey: `turno:${turno.id}:${turno.data}:exit_before:${volId || volNomeNorm}`,
        eventId: turno.id,
        tipo: 'turno',
        fase: 'exit_before',
        azioneRichiesta: 'uscita',
        isRitardo: false,
        titolo: '🏁 Promemoria Timbratura Uscita (-10 min)',
        messaggio: `Tra meno di 10 minuti termina il tuo turno (${orari.end}) presso ${sedeLabel}. Ricorda di effettuare la timbratura GPS in uscita in una postazione autorizzata.`,
        dettaglioOrario: fasciaLabel,
        luogo: sedeLabel
      });
    }

    // D) 10 min dopo fine turno (entrata ancora aperta senza uscita) -> Notifica diversa (NO sirena)
    if (timbApertaUscita && nowMs >= endMs + TEN_MIN_MS && nowMs <= endMs + FOUR_HOURS_MS) {
      risultati.push({
        dedupKey: `turno:${turno.id}:${turno.data}:exit_after:${volId || volNomeNorm}`,
        eventId: turno.id,
        tipo: 'turno',
        fase: 'exit_after',
        azioneRichiesta: 'uscita',
        isRitardo: true,
        titolo: '🔔 Timbratura Uscita Non Effettuata (+10 min)',
        messaggio: `Il turno presso ${sedeLabel} è terminato da oltre 10 minuti (fine ore ${orari.end}) e la tua timbratura è ancora aperta. Ricorda di timbrare l'uscita.`,
        dettaglioOrario: fasciaLabel,
        luogo: sedeLabel
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. VALUTAZIONE CORSI / FORMAZIONE
  // -------------------------------------------------------------------------
  for (const corso of corsi || []) {
    if (!corso || corso.stato === 'Concluso' || corso.stato === 'Annullato') continue;

    const iscritto = (corso.iscritti || []).find(
      (p) =>
        (volId && p.volontarioId === volId) ||
        (volNomeNorm && p.volontarioNome && normalizzaNome(p.volontarioNome) === volNomeNorm)
    );
    if (!iscritto) continue;

    type SessioneCorsoItem = {
      sessionId: string;
      lezioneId?: string;
      data: string;
      orarioInizio: string;
      orarioFine: string;
      luogo: string;
      label: string;
    };

    const sessioni: SessioneCorsoItem[] = [];
    if (Array.isArray(corso.lezioni) && corso.lezioni.length > 0) {
      for (const lez of corso.lezioni) {
        if (!lez.data || (lez.data !== todayStr && lez.data !== yesterdayStr)) continue;
        if (!lez.orarioInizio || !lez.orarioFine) continue;
        sessioni.push({
          sessionId: `lez-${lez.id}`,
          lezioneId: lez.id,
          data: lez.data,
          orarioInizio: lez.orarioInizio,
          orarioFine: lez.orarioFine,
          luogo: lez.sedeNome || corso.sedeCorso || 'Sede didattica',
          label: `${corso.titolo} (Lez. #${lez.numero})`
        });
      }
    } else if (corso.orarioInizioLezione && corso.orarioFineLezione) {
      const dataInizio = (corso.dataInizio || '').trim();
      const dataFine = (corso.dataFine || dataInizio).trim();
      const validaOggi = dataInizio && dataInizio <= todayStr && todayStr <= dataFine;
      const validaIeri = dataInizio && dataInizio <= yesterdayStr && yesterdayStr <= dataFine;
      const dataTarget = validaOggi ? todayStr : validaIeri ? yesterdayStr : '';
      if (dataTarget) {
        sessioni.push({
          sessionId: `corso-${dataTarget}`,
          data: dataTarget,
          orarioInizio: corso.orarioInizioLezione,
          orarioFine: corso.orarioFineLezione,
          luogo: corso.sedeCorso || 'Sede didattica',
          label: corso.titolo
        });
      }
    }

    for (const sess of sessioni) {
      const bounds = resolveSessionBounds(sess.data, sess.orarioInizio, sess.orarioFine);
      if (!bounds) continue;
      const { startMs, endMs } = bounds;
      const fasciaLabel = `${sess.orarioInizio} - ${sess.orarioFine}`;

      // Stato timbrature sul record del partecipante nel corso
      const timbLezPartecipante = sess.lezioneId
        ? iscritto.timbratureLezioni?.find((tl) => tl.lezioneId === sess.lezioneId)
        : undefined;

      const entrataCorsoConfermata = Boolean(
        sess.lezioneId
          ? (typeof timbLezPartecipante?.timbraturaEntrata === 'object'
              ? timbLezPartecipante.timbraturaEntrata?.confermata
              : timbLezPartecipante?.timbraturaEntrata)
          : (typeof iscritto.timbraturaEntrata === 'object'
              ? iscritto.timbraturaEntrata?.confermata
              : iscritto.timbraturaEntrata)
      );

      const uscitaCorsoConfermata = Boolean(
        sess.lezioneId
          ? (typeof timbLezPartecipante?.timbraturaUscita === 'object'
              ? timbLezPartecipante.timbraturaUscita?.confermata
              : timbLezPartecipante?.timbraturaUscita)
          : (typeof iscritto.timbraturaUscita === 'object'
              ? iscritto.timbraturaUscita?.confermata
              : iscritto.timbraturaUscita)
      );

      // Stato timbrature anche dal registro generale TimbratureVolontari collegato al corso
      const timbRegistroCorso = mieiTimb.filter((t) => {
        if (t.corsoId !== corso.id) return false;
        if (sess.lezioneId && t.lezioneId && t.lezioneId !== sess.lezioneId) return false;
        const tEntryMs = parseLocalDateTimeMs(t.data, t.orarioIngresso);
        if (tEntryMs !== null && tEntryMs >= startMs - ENTRY_MATCH_EARLY_MS && tEntryMs <= endMs + 15 * 60 * 1000) {
          return true;
        }
        return t.data === sess.data;
      });

      const haEntrataCorso = entrataCorsoConfermata || timbRegistroCorso.length > 0;
      const haUscitaCorso =
        uscitaCorsoConfermata ||
        (timbRegistroCorso.length > 0 && timbRegistroCorso.every((t) => Boolean(t.orarioUscita && t.orarioUscita.trim())));
      const entrataApertaCorso = haEntrataCorso && !haUscitaCorso;

      // A) -10 min inizio corso/lezione -> Notifica standard device
      if (!haEntrataCorso && nowMs >= startMs - TEN_MIN_MS && nowMs < startMs) {
        risultati.push({
          dedupKey: `corso:${corso.id}:${sess.sessionId}:${sess.data}:entry_before:${volId || volNomeNorm}`,
          eventId: corso.id,
          tipo: 'corso',
          fase: 'entry_before',
          azioneRichiesta: 'entrata',
          isRitardo: false,
          titolo: '🎓 Promemoria Timbratura Corso (-10 min)',
          messaggio: `Tra meno di 10 minuti inizia "${sess.label}" (${fasciaLabel}) presso ${sess.luogo}. Ricorda di effettuare la timbratura in entrata.`,
          dettaglioOrario: fasciaLabel,
          luogo: sess.luogo,
          corsoId: corso.id
        });
      }

      // B) +10 min inizio corso/lezione -> Notifica diversa (NO sirena)
      if (!haEntrataCorso && nowMs >= startMs + TEN_MIN_MS && nowMs < endMs) {
        risultati.push({
          dedupKey: `corso:${corso.id}:${sess.sessionId}:${sess.data}:entry_after:${volId || volNomeNorm}`,
          eventId: corso.id,
          tipo: 'corso',
          fase: 'entry_after',
          azioneRichiesta: 'entrata',
          isRitardo: true,
          titolo: '⚠️ Timbratura Ingresso Corso Mancante (+10 min)',
          messaggio: `"${sess.label}" è iniziato da oltre 10 minuti (ore ${sess.orarioInizio}) presso ${sess.luogo} ma non risulta la timbratura in entrata. Timbra ora la presenza.`,
          dettaglioOrario: fasciaLabel,
          luogo: sess.luogo,
          corsoId: corso.id
        });
      }

      // C) -10 min fine corso/lezione -> Notifica standard device
      if (entrataApertaCorso && nowMs >= endMs - TEN_MIN_MS && nowMs < endMs) {
        risultati.push({
          dedupKey: `corso:${corso.id}:${sess.sessionId}:${sess.data}:exit_before:${volId || volNomeNorm}`,
          eventId: corso.id,
          tipo: 'corso',
          fase: 'exit_before',
          azioneRichiesta: 'uscita',
          isRitardo: false,
          titolo: '🎓 Promemoria Timbratura Uscita Corso (-10 min)',
          messaggio: `Tra meno di 10 minuti termina "${sess.label}" (ore ${sess.orarioFine}) presso ${sess.luogo}. Ricorda di timbrare l'uscita per convalidare le ore formative.`,
          dettaglioOrario: fasciaLabel,
          luogo: sess.luogo,
          corsoId: corso.id
        });
      }

      // D) +10 min fine corso/lezione -> Notifica diversa (NO sirena)
      if (entrataApertaCorso && nowMs >= endMs + TEN_MIN_MS && nowMs <= endMs + FOUR_HOURS_MS) {
        risultati.push({
          dedupKey: `corso:${corso.id}:${sess.sessionId}:${sess.data}:exit_after:${volId || volNomeNorm}`,
          eventId: corso.id,
          tipo: 'corso',
          fase: 'exit_after',
          azioneRichiesta: 'uscita',
          isRitardo: true,
          titolo: '🔔 Timbratura Uscita Corso Non Effettuata (+10 min)',
          messaggio: `La lezione "${sess.label}" presso ${sess.luogo} è terminata da oltre 10 minuti (fine ore ${sess.orarioFine}) ma non risulta ancora la timbratura in uscita.`,
          dettaglioOrario: fasciaLabel,
          luogo: sess.luogo,
          corsoId: corso.id
        });
      }
    }
  }

  return risultati;
}
