import { TurnoSedeOperativa, TimbraturaVolontario, CorsoFormazione } from '../types/adminTypes';
import { Volontario } from '../components/DatabaseVolontariModal';
import { formatISODateItaly, getItalianDateParts } from './italianTime';

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
}

/**
 * Converte una stringa oraria "HH:mm" in minuti totali trascorsi dalla mezzanotte.
 */
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

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
  const now = new Date();
  const nowItaly = getItalianDateParts(now);
  const oggiStr = nowItaly.isoDate;
  const ieriStr = nowItaly.yesterdayIsoDate;
  const nowMinutes = nowItaly.hour * 60 + nowItaly.minute;

  const GRACE_BEFORE_MIN = 45;
  const GRACE_AFTER_MIN = 30;

  let turni: TurnoSedeOperativa[] = listaTurni;
  if (!turni || turni.length === 0) {
    try {
      const raw = localStorage.getItem('CROCE_ORO_TURNI_SEDI');
      if (raw) turni = JSON.parse(raw);
    } catch {}
  }

  if (!turni || !Array.isArray(turni) || turni.length === 0) return null;

  for (const t of turni) {
    const ruoloAssegnato = trovaAssegnazioneVolontario(t, volId, volNomeCompleto);
    if (!ruoloAssegnato) continue;

    const turnoDataStr = normalizzaDataIsoSemplice(t.data);
    const isOggi = turnoDataStr === oggiStr;
    const isIeri = turnoDataStr === ieriStr;

    if (!isOggi && !isIeri) continue;

    const fascia = (t.fasciaOraria || '').toLowerCase();
    const isH24 = fascia.includes('h24') || fascia.includes('reperibilit');

    if (isH24 && isOggi) {
      return {
        turno: t,
        ruoloAssegnato,
        motivo: `Turno Reperibilità H24 attivo oggi (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`
      };
    }

    const startMin = parseTimeToMinutes(t.orarioInizio);
    const endMin = parseTimeToMinutes(t.orarioFine);

    if (startMin !== null && endMin !== null) {
      if (endMin < startMin) {
        if (isIeri && nowMinutes <= endMin + GRACE_AFTER_MIN) {
          return {
            turno: t,
            ruoloAssegnato,
            motivo: `Turno notturno in corso iniziato ieri sera (${t.sedeNome}, ${t.orarioInizio} - ${t.orarioFine}) - Ruolo: ${ruoloAssegnato}`
          };
        }
        if (isOggi && nowMinutes >= Math.max(0, startMin - GRACE_BEFORE_MIN)) {
          return {
            turno: t,
            ruoloAssegnato,
            motivo: `Turno notturno in corso stasera (${t.sedeNome}, ${t.orarioInizio} - ${t.orarioFine}) - Ruolo: ${ruoloAssegnato}`
          };
        }
      } else if (isOggi) {
        const finestraInizio = Math.max(0, startMin - GRACE_BEFORE_MIN);
        const finestraFine = Math.min(24 * 60 - 1, endMin + GRACE_AFTER_MIN);
        if (nowMinutes >= finestraInizio && nowMinutes <= finestraFine) {
          return {
            turno: t,
            ruoloAssegnato,
            motivo: `Turno in corso adesso (${t.sedeNome}, ${t.orarioInizio} - ${t.orarioFine}) - Ruolo: ${ruoloAssegnato}`
          };
        }
      }
    } else {
      if (isOggi) {
        if (fascia.includes('mattina')) {
          if (nowMinutes >= 7 * 60 + 15 && nowMinutes <= 14 * 60 + 30) {
            return { turno: t, ruoloAssegnato, motivo: `Turno Mattina in corso (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}` };
          }
        } else if (fascia.includes('pomeriggio')) {
          if (nowMinutes >= 13 * 60 + 15 && nowMinutes <= 20 * 60 + 30) {
            return { turno: t, ruoloAssegnato, motivo: `Turno Pomeriggio in corso (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}` };
          }
        } else if (fascia.includes('notte')) {
          if (nowMinutes >= 19 * 60 + 15) {
            return { turno: t, ruoloAssegnato, motivo: `Turno Notte in corso stasera (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}` };
          }
        } else {
          return { turno: t, ruoloAssegnato, motivo: `Turno programmato per la giornata di oggi (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}` };
        }
      } else if (isIeri && fascia.includes('notte') && nowMinutes <= 8 * 60 + 30) {
        return { turno: t, ruoloAssegnato, motivo: `Turno Notte iniziato ieri sera in corso stamattina (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}` };
      }
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
 * - Turno in cui è segnato in app (su qualsiasi tabellone oggi / attivo ora)
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

  const nowItaly = getItalianDateParts(new Date());
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
  let turni: TurnoSedeOperativa[] = turniParam || [];
  if (!turni || turni.length === 0) {
    try {
      const raw = localStorage.getItem('CROCE_ORO_TURNI_SEDI');
      if (raw) turni = JSON.parse(raw);
    } catch {}
  }

  if (turni && turni.length > 0) {
    // A) Priorità al turno attivo in questa fascia oraria (inclusi notturni)
    const turnoAttivoAdesso = trovaTurnoAttivoNeiTabelloni(volontarioId, volontarioNome, turni);
    if (turnoAttivoAdesso) {
      return {
        trovata: true,
        tipo: 'turno',
        titolo: formatNomeTurnoPerTimbratura(turnoAttivoAdesso.turno),
        mezzoAssegnato: turnoAttivoAdesso.turno.mezzoAssegnato
      };
    }

    // B) Eventuale altro turno programmato per la data di oggi su qualsiasi tabellone
    const turnoOggi = turni.find(t => {
      const dataNorm = normalizzaDataIsoSemplice(t.data);
      if (dataNorm !== oggiStr) return false;
      return Boolean(trovaAssegnazioneVolontario(t, volontarioId, volontarioNome));
    });
    if (turnoOggi) {
      return {
        trovata: true,
        tipo: 'turno',
        titolo: formatNomeTurnoPerTimbratura(turnoOggi),
        mezzoAssegnato: turnoOggi.mezzoAssegnato
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

