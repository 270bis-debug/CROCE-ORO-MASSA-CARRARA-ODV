import { TurnoSedeOperativa, TimbraturaVolontario, CorsoFormazione } from '../types/adminTypes';
import { Volontario } from '../components/DatabaseVolontariModal';
import { addDaysISODate, getItalianDateParts, parseItalianDateTimeMs } from './italianTime';

export interface EsitoVerificaTurno {
  isDiTurno: boolean;
  motivo: string;
  dettaglioTurno?: {
    sedeNome?: string;
    nomeTurno?: string;
    fasciaOraria?: string;
    orarioInizio?: string;
    orarioFine?: string;
    ruoloAssegnato?: string;
    mezzoAssegnato?: string;
  };
}

export interface AttivitaRilevataTimbratura {
  trovata: boolean;
  tipo: 'turno' | 'corso' | null;
  titolo: string;
  mezzoAssegnato?: string;
  turnoId?: string;
}

const ANTICIPO_INGRESSO_MS = 30 * 60 * 1000;
const ESTENSIONE_USCITA_MS = 120 * 60 * 1000;

/**
 * Normalizza date in "YYYY-MM-DD".
 */
function normalizzaDataIsoSemplice(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

/**
 * Normalizza il nome completo per confronti case-insensitive e spazi multipli.
 */
function normalizzaNome(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveOrariTurno(t: TurnoSedeOperativa): { start: string; end: string; isH24: boolean } | null {
  const fascia = (t.fasciaOraria || '').toLowerCase();
  const isH24 = fascia.includes('h24') || fascia.includes('reperibilit');
  if (t.orarioInizio && t.orarioFine) {
    return { start: t.orarioInizio, end: t.orarioFine, isH24 };
  }
  if (fascia.includes('mattin')) return { start: '08:00', end: '14:00', isH24: false };
  if (fascia.includes('pomerigg')) return { start: '14:00', end: '20:00', isH24: false };
  if (fascia.includes('nott')) return { start: '20:00', end: '08:00', isH24: false };
  if (isH24) return { start: '00:00', end: '24:00', isH24: true };
  return null;
}

function resolveBoundsTurnoMs(t: TurnoSedeOperativa): { startMs: number; endMs: number; isH24: boolean } | null {
  const dataNorm = normalizzaDataIsoSemplice(t.data);
  if (!dataNorm) return null;
  const orari = resolveOrariTurno(t);
  if (!orari) return null;

  const startMs = parseItalianDateTimeMs(dataNorm, orari.start);
  let endMs = parseItalianDateTimeMs(dataNorm, orari.end);
  if (startMs === null || endMs === null) return null;

  if (endMs <= startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }
  return { startMs, endMs, isH24: orari.isH24 };
}

function loadTurniFallback(listaTurni?: TurnoSedeOperativa[]): TurnoSedeOperativa[] {
  if (listaTurni && Array.isArray(listaTurni) && listaTurni.length > 0) {
    return listaTurni;
  }
  try {
    const raw = localStorage.getItem('CROCE_ORO_TURNI_SEDI');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Verifica se un volontario (per id o nome completo) è assegnato a un determinato turno di sede.
 */
function trovaAssegnazioneVolontario(
  turno: TurnoSedeOperativa,
  volId?: string,
  volNomeCompleto?: string
): string | null {
  const normNome = normalizzaNome(volNomeCompleto);

  const check = (slot?: { id?: string; nome?: string }): boolean => {
    if (!slot) return false;
    if (volId && slot.id && slot.id === volId) return true;
    if (normNome && slot.nome && normalizzaNome(slot.nome) === normNome) return true;
    return false;
  };

  if (check(turno.autista)) return 'Autista';
  if (check(turno.caposervizio)) return 'Caposervizio';
  if (check(turno.soccorritore2)) return 'Secondo Soccorritore';
  if (check(turno.terzoSoccorritore)) return 'Terzo Soccorritore';
  if (check(turno.operatoreCentrale)) return 'Operatore Centrale';
  if (check(turno.centralinista)) return 'Centralinista';
  if (check(turno.osservatore)) return 'Osservatore';

  if (turno.richiesteIscrizione && turno.richiesteIscrizione.length > 0) {
    const approvata = turno.richiesteIscrizione.find(r =>
      r.stato === 'Approvato' &&
      ((volId && r.volontarioId === volId) || (normNome && normalizzaNome(r.volontarioNome) === normNome))
    );
    if (approvata) {
      return approvata.ruoloRichiesto ? String(approvata.ruoloRichiesto) : 'Soccorritore';
    }
  }

  return null;
}

/**
 * Cerca nel calendario Turni di tutte le sedi operative un turno attivo adesso per il volontario.
 */
function trovaTurnoAttivoNeiTabelloni(
  volId: string | undefined,
  volNomeCompleto: string,
  listaTurni: TurnoSedeOperativa[]
): { turno: TurnoSedeOperativa; ruoloAssegnato: string; motivo: string } | null {
  const nowMs = Date.now();
  const nowItaly = getItalianDateParts(nowMs);
  const oggiStr = nowItaly.isoDate;
  const ieriStr = nowItaly.yesterdayIsoDate;
  const domaniStr = nowItaly.tomorrowIsoDate;

  const turni = loadTurniFallback(listaTurni);
  if (turni.length === 0) return null;

  for (const t of turni) {
    const ruoloAssegnato = trovaAssegnazioneVolontario(t, volId, volNomeCompleto);
    if (!ruoloAssegnato) continue;

    const turnoDataStr = normalizzaDataIsoSemplice(t.data);
    const isOggi = turnoDataStr === oggiStr;
    const isIeri = turnoDataStr === ieriStr;
    const isDomani = turnoDataStr === domaniStr;

    if (!isOggi && !isIeri && !isDomani) continue;

    const bounds = resolveBoundsTurnoMs(t);
    if (bounds) {
      const { startMs, endMs, isH24 } = bounds;
      if (nowMs >= startMs - ANTICIPO_INGRESSO_MS && nowMs <= endMs + ESTENSIONE_USCITA_MS) {
        if (isH24 && isOggi) {
          return {
            turno: t,
            ruoloAssegnato,
            motivo: `Turno Reperibilità H24 attivo oggi (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`
          };
        }
        if (isIeri && endMs > startMs) {
          return {
            turno: t,
            ruoloAssegnato,
            motivo: `Turno in corso iniziato ieri (${t.sedeNome}, ${t.orarioInizio || ''} - ${t.orarioFine || ''}) - Ruolo: ${ruoloAssegnato}`
          };
        }
        return {
          turno: t,
          ruoloAssegnato,
          motivo: `Turno in corso adesso (${t.sedeNome}, ${t.orarioInizio || ''} - ${t.orarioFine || ''}) - Ruolo: ${ruoloAssegnato}`
        };
      }
    } else if (isOggi) {
      return {
        turno: t,
        ruoloAssegnato,
        motivo: `Turno programmato per la giornata di oggi (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`
      };
    }
  }

  return null;
}

/**
 * Formatta il nome leggibile di un turno per "Cosa stai facendo?" nella timbratura.
 */
function formatNomeTurnoPerTimbratura(t: TurnoSedeOperativa): string {
  const orario = t.orarioInizio && t.orarioFine
    ? `${t.orarioInizio}-${t.orarioFine}`
    : (t.fasciaOraria || '');
  const mezzoStr = t.mezzoAssegnato ? ` • ${t.mezzoAssegnato}` : '';
  if (t.nomeTurno && t.nomeTurno.trim()) {
    return `${t.nomeTurno.trim()} — ${t.sedeNome}${orario ? ` (${orario})` : ''}${mezzoStr}`;
  }
  return `Turno ${t.sedeNome}${orario ? ` (${orario})` : ''}${mezzoStr}`;
}

export interface EsitoFinestraTimbratura {
  consentita: boolean;
  motivo?: string;
  turnoAssociato?: TurnoSedeOperativa;
}

/**
 * Verifica silenziosa delle regole temporali di sistema per timbratura entrata/uscita turno.
 */
export function verificaFinestraTimbraturaTurno(params: {
  tipo: 'entrata' | 'uscita';
  volontarioId?: string;
  volontarioNome?: string;
  turni?: TurnoSedeOperativa[];
  timbraturaAperta?: TimbraturaVolontario | null;
  nowMs?: number;
}): EsitoFinestraTimbratura {
  const {
    tipo,
    volontarioId,
    volontarioNome = '',
    turni: turniParam,
    timbraturaAperta,
    nowMs = Date.now()
  } = params;

  const turni = loadTurniFallback(turniParam);
  if (turni.length === 0) {
    return { consentita: true };
  }

  const nowItaly = getItalianDateParts(nowMs);
  const oggiStr = nowItaly.isoDate;
  const ieriStr = nowItaly.yesterdayIsoDate;
  const domaniStr = nowItaly.tomorrowIsoDate;

  if (tipo === 'entrata') {
    const turniCandidati: Array<{ turno: TurnoSedeOperativa; startMs: number; endMs: number }> = [];

    for (const t of turni) {
      if (!trovaAssegnazioneVolontario(t, volontarioId, volontarioNome)) continue;
      const dataNorm = normalizzaDataIsoSemplice(t.data);
      if (dataNorm !== oggiStr && dataNorm !== ieriStr && dataNorm !== domaniStr) continue;
      const bounds = resolveBoundsTurnoMs(t);
      if (!bounds) continue;
      turniCandidati.push({ turno: t, startMs: bounds.startMs, endMs: bounds.endMs });
    }

    if (turniCandidati.length === 0) {
      return { consentita: true };
    }

    // 1. Se esiste un turno attualmente nella finestra ammessa per l'ingresso (o in corso fino al termine turno)
    const turnoAttivoIngresso = turniCandidati.find(
      c => nowMs >= c.startMs - ANTICIPO_INGRESSO_MS && nowMs <= c.endMs
    );
    if (turnoAttivoIngresso) {
      return { consentita: true, turnoAssociato: turnoAttivoIngresso.turno };
    }

    // 2. Se esiste un turno programmato per oggi (o in arrivo) il cui ingresso non è ancora aperto
    const turnoOggiNonAperto = turniCandidati
      .filter(c => {
        const d = normalizzaDataIsoSemplice(c.turno.data);
        return (d === oggiStr || (d === domaniStr && nowMs < c.startMs)) && nowMs < c.startMs - ANTICIPO_INGRESSO_MS;
      })
      .sort((a, b) => a.startMs - b.startMs)[0];

    if (turnoOggiNonAperto) {
      return {
        consentita: false,
        turnoAssociato: turnoOggiNonAperto.turno,
        motivo: '⛔ Timbratura di ingresso non ancora disponibile per questo turno.'
      };
    }

    // 3. Se esiste solo un turno odierno già concluso
    const turnoGiaTerminato = turniCandidati
      .filter(c => normalizzaDataIsoSemplice(c.turno.data) === oggiStr && nowMs > c.endMs)
      .sort((a, b) => b.endMs - a.endMs)[0];

    if (turnoGiaTerminato) {
      return {
        consentita: false,
        turnoAssociato: turnoGiaTerminato.turno,
        motivo: '⛔ Timbratura di ingresso non disponibile: questo turno risulta già concluso.'
      };
    }

    return { consentita: true };
  }

  // USCITA
  if (!timbraturaAperta) {
    return { consentita: true };
  }
  if (timbraturaAperta.corsoId || timbraturaAperta.tipoAttivita === 'manuale') {
    return { consentita: true };
  }

  // Ricerca turno associato alla timbratura aperta
  let turnoMatch: TurnoSedeOperativa | undefined;
  if (timbraturaAperta.turnoId) {
    turnoMatch = turni.find(t => t.id === timbraturaAperta.turnoId);
  }

  if (!turnoMatch) {
    const dataTimbNorm = normalizzaDataIsoSemplice(timbraturaAperta.data) || oggiStr;
    const giornoPrecTimb = addDaysISODate(dataTimbNorm, -1);
    const giornoSuccTimb = addDaysISODate(dataTimbNorm, 1);
    const entryMs = parseItalianDateTimeMs(dataTimbNorm, timbraturaAperta.orarioIngresso);

    const turniDelVolontario = turni.filter(t => {
      if (!trovaAssegnazioneVolontario(t, volontarioId, volontarioNome)) return false;
      const d = normalizzaDataIsoSemplice(t.data);
      return d === dataTimbNorm || d === giornoPrecTimb || d === giornoSuccTimb || d === oggiStr || d === ieriStr;
    });

    if (turniDelVolontario.length === 1) {
      turnoMatch = turniDelVolontario[0];
    } else if (turniDelVolontario.length > 1) {
      if (timbraturaAperta.attivitaSvolta) {
        turnoMatch = turniDelVolontario.find(
          t => formatNomeTurnoPerTimbratura(t) === timbraturaAperta.attivitaSvolta
        );
      }
      if (!turnoMatch && entryMs !== null) {
        turnoMatch = turniDelVolontario.find(t => {
          const b = resolveBoundsTurnoMs(t);
          return b ? entryMs >= b.startMs - 60 * 60 * 1000 && entryMs <= b.endMs : false;
        });
      }
      if (!turnoMatch) {
        turnoMatch = turniDelVolontario[0];
      }
    }
  }

  if (!turnoMatch) {
    return { consentita: true };
  }

  const bounds = resolveBoundsTurnoMs(turnoMatch);
  if (!bounds) {
    return { consentita: true, turnoAssociato: turnoMatch };
  }

  if (nowMs > bounds.endMs + ESTENSIONE_USCITA_MS) {
    return {
      consentita: false,
      turnoAssociato: turnoMatch,
      motivo: '⛔ Timbratura di uscita non più disponibile: il turno è già terminato. Contatta la Centrale Operativa.'
    };
  }

  return { consentita: true, turnoAssociato: turnoMatch };
}

/**
 * Determina se il volontario specificato è di turno in questo preciso momento.
 */
export function verificaVolontarioInTurnoAdesso(
  vol: Volontario,
  listaTurni: TurnoSedeOperativa[] = [],
  listaTimbrature: TimbraturaVolontario[] = []
): EsitoVerificaTurno {
  if (!vol) {
    return { isDiTurno: false, motivo: 'Nessun nominativo selezionato' };
  }

  const now = new Date();
  const nowItaly = getItalianDateParts(now);
  const oggiStr = nowItaly.isoDate;
  const volNomeCompleto = `${vol.nome} ${vol.cognome}`.trim();
  const matchTabellone = trovaTurnoAttivoNeiTabelloni(vol.id, volNomeCompleto, listaTurni);

  const dettaglioDaTabellone = matchTabellone
    ? {
        sedeNome: matchTabellone.turno.sedeNome,
        nomeTurno: matchTabellone.turno.nomeTurno,
        fasciaOraria: matchTabellone.turno.fasciaOraria,
        orarioInizio: matchTabellone.turno.orarioInizio || '00:00',
        orarioFine: matchTabellone.turno.orarioFine || '24:00',
        ruoloAssegnato: matchTabellone.ruoloAssegnato,
        mezzoAssegnato: matchTabellone.turno.mezzoAssegnato
      }
    : undefined;

  // 1. Controllo timbrature di presenza del volontario (se ha timbrato l'ingresso e non ancora l'uscita)
  if (listaTimbrature && listaTimbrature.length > 0) {
    const volNorm = normalizzaNome(volNomeCompleto);
    const timbraturaAperta = listaTimbrature.find(t => {
      const matchId = t.volontarioId === vol.id;
      const matchNome = t.volontarioNome && normalizzaNome(t.volontarioNome) === volNorm;
      return (matchId || matchNome) && !t.orarioUscita && (t.data === oggiStr || !t.data);
    });

    if (timbraturaAperta) {
      return {
        isDiTurno: true,
        motivo: `Timbratura ingresso attiva dalle ore ${timbraturaAperta.orarioIngresso || 'inizio servizio'} presso ${timbraturaAperta.sede || 'la sede operativa'}`,
        dettaglioTurno: dettaglioDaTabellone || (vol.mezzoAttivo ? { mezzoAssegnato: vol.mezzoAttivo } : undefined)
      };
    }
  }

  // 2. Controllo flag inTurno sul profilo volontario
  if (vol.inTurno) {
    return {
      isDiTurno: true,
      motivo: 'Stato di servizio "In Turno" attivo sul profilo',
      dettaglioTurno: dettaglioDaTabellone || (vol.mezzoAttivo ? { mezzoAssegnato: vol.mezzoAttivo } : undefined)
    };
  }

  // 3. Controllo nel Calendario Turni di tutte le sedi operative
  if (matchTabellone && dettaglioDaTabellone) {
    return {
      isDiTurno: true,
      motivo: matchTabellone.motivo,
      dettaglioTurno: dettaglioDaTabellone
    };
  }

  return {
    isDiTurno: false,
    motivo: 'Nessun turno operativo programmato per questo volontario al momento'
  };
}

/**
 * Rileva automaticamente l'attività ("Cosa stai facendo?") per la timbratura del volontario/operatore:
 * - Turno in cui è segnato in app (su qualsiasi tabellone attivo ora o programmato oggi)
 * - Oppure Corso / Formazione a cui è iscritto in app (lezione di oggi o corso attivo / punto GPS corso)
 * - Altrimenti restituisce { trovata: false } per mostrare il campo editabile manuale.
 */
export function rilevaAttivitaProgrammataPerTimbratura(params: {
  volontarioId?: string;
  volontarioNome?: string;
  turni?: TurnoSedeOperativa[];
  corsiFormazione?: CorsoFormazione[];
  targetCorsoId?: string;
  targetLezioneId?: string;
}): AttivitaRilevataTimbratura {
  const {
    volontarioId,
    volontarioNome = '',
    turni: turniParam,
    corsiFormazione = [],
    targetCorsoId,
    targetLezioneId
  } = params;

  const nowMs = Date.now();
  const nowItaly = getItalianDateParts(nowMs);
  const oggiStr = nowItaly.isoDate;
  const volNorm = normalizzaNome(volontarioNome);

  // 0. Se il punto GPS validato corrisponde direttamente a un corso formativo
  if (targetCorsoId && corsiFormazione.length > 0) {
    const corsoGps = corsiFormazione.find(c => c.id === targetCorsoId);
    if (corsoGps) {
      const lezGps = targetLezioneId
        ? corsoGps.lezioni?.find(l => l.id === targetLezioneId)
        : corsoGps.lezioni?.find(l => normalizzaDataIsoSemplice(l.data) === oggiStr);
      const lezDesc = lezGps
        ? ` — Lez. #${lezGps.numero}${lezGps.titolo ? `: ${lezGps.titolo}` : ''}`
        : '';
      return {
        trovata: true,
        tipo: 'corso',
        titolo: `Corso: ${corsoGps.titolo}${lezDesc}`
      };
    }
  }

  // 1. Ricerca su tutti i tabelloni turni in app
  const turni = loadTurniFallback(turniParam);

  if (turni.length > 0) {
    // A) Priorità al turno attivo in questa fascia oraria (inclusi notturni e anticipo pre-turno)
    const turnoAttivoAdesso = trovaTurnoAttivoNeiTabelloni(volontarioId, volontarioNome, turni);
    if (turnoAttivoAdesso) {
      return {
        trovata: true,
        tipo: 'turno',
        titolo: formatNomeTurnoPerTimbratura(turnoAttivoAdesso.turno),
        mezzoAssegnato: turnoAttivoAdesso.turno.mezzoAssegnato,
        turnoId: turnoAttivoAdesso.turno.id
      };
    }

    // B) Eventuale altro turno programmato per la data di oggi su qualsiasi tabellone (preferendo quello non ancora concluso o più vicino)
    const turniOggi = turni
      .filter(t => {
        const dataNorm = normalizzaDataIsoSemplice(t.data);
        if (dataNorm !== oggiStr) return false;
        return Boolean(trovaAssegnazioneVolontario(t, volontarioId, volontarioNome));
      })
      .sort((a, b) => {
        const ba = resolveBoundsTurnoMs(a);
        const bb = resolveBoundsTurnoMs(b);
        const aFuture = ba && ba.endMs >= nowMs ? 0 : 1;
        const bFuture = bb && bb.endMs >= nowMs ? 0 : 1;
        if (aFuture !== bFuture) return aFuture - bFuture;
        if (ba && bb) return Math.abs(ba.startMs - nowMs) - Math.abs(bb.startMs - nowMs);
        return 0;
      });

    const turnoOggi = turniOggi[0];
    if (turnoOggi) {
      return {
        trovata: true,
        tipo: 'turno',
        titolo: formatNomeTurnoPerTimbratura(turnoOggi),
        mezzoAssegnato: turnoOggi.mezzoAssegnato,
        turnoId: turnoOggi.id
      };
    }
  }

  // 2. Ricerca nei Corsi / Formazione dove il volontario è iscritto
  if (corsiFormazione && corsiFormazione.length > 0) {
    const corsiIscritto = corsiFormazione.filter(c =>
      c.stato !== 'Annullato' &&
      c.stato !== 'Concluso' &&
      Array.isArray(c.iscritti) &&
      c.iscritti.some(p =>
        (volontarioId && p.volontarioId === volontarioId) ||
        (volNorm && p.volontarioNome && normalizzaNome(p.volontarioNome) === volNorm)
      )
    );

    // A) Corso con lezione in programma nella data odierna
    for (const c of corsiIscritto) {
      const lezOggi = c.lezioni?.find(l => normalizzaDataIsoSemplice(l.data) === oggiStr);
      if (lezOggi) {
        const orarioLez = lezOggi.orarioInizio && lezOggi.orarioFine ? ` (${lezOggi.orarioInizio}-${lezOggi.orarioFine})` : '';
        return {
          trovata: true,
          tipo: 'corso',
          titolo: `Corso: ${c.titolo} — Lez. #${lezOggi.numero}${lezOggi.titolo ? `: ${lezOggi.titolo}` : ''}${orarioLez}`
        };
      }
    }

    // B) Corso "In Corso" o il cui intervallo date comprende oggi
    const corsoAttivoOggi = corsiIscritto.find(c => {
      const di = normalizzaDataIsoSemplice(c.dataInizio);
      const df = normalizzaDataIsoSemplice(c.dataFine);
      return c.stato === 'In Corso' || (di && df && oggiStr >= di && oggiStr <= df);
    });
    if (corsoAttivoOggi) {
      return {
        trovata: true,
        tipo: 'corso',
        titolo: `Corso: ${corsoAttivoOggi.titolo}${corsoAttivoOggi.tipologia ? ` (${corsoAttivoOggi.tipologia})` : ''}`
      };
    }
  }

  // 3. Nessun turno o corso trovato -> campo editabile libero
  return {
    trovata: false,
    tipo: null,
    titolo: ''
  };
}
