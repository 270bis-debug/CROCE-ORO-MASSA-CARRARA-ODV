import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Car,
  Users,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  UserCheck,
  UserPlus,
  X,
  PlusCircle,
  Eye,
  Sparkles,
  ArrowLeft,
  Copy,
  Repeat,
  RefreshCw,
  Headphones,
  PhoneCall,
  Check,
  Send,
  AlertCircle
} from 'lucide-react';
import { TurnoSedeOperativa, SedeAssociativaCompleta, MezzoFlotta, RuoloTurno, CandidaturaTurno } from '../types/adminTypes';
import { Volontario } from './DatabaseVolontariModal';
import { CroceOroLogo } from './CroceOroLogo';
import { realtime } from '../services/realtime';
import { puoCoprireRuoloTurno, getMansioniVolontario } from '../utils/mansioniVolontari';
import { addDaysISODate, formatDateItaly, formatISODateItaly, formatTimeItaly, getItalianDateParts } from '../utils/italianTime';

interface TabelloneTurniSettimanaleProps {
  turni: TurnoSedeOperativa[];
  sedi: SedeAssociativaCompleta[];
  volontari?: Volontario[];
  mezzi?: MezzoFlotta[];
  volontarioLoggatoNome?: string;
  volontarioLoggatoId?: string;
  isAdmin?: boolean;
  isStandalone?: boolean;
  onChiudi?: () => void;
  onModificaTurno?: (turno: TurnoSedeOperativa) => void;
  onNuovoTurno?: (sedeId?: string, data?: string) => void;
  onDuplicaTurno?: (turno: TurnoSedeOperativa) => void;
  onApriTurniRipetuti?: () => void;
  onAggiornaTurni?: (turni: TurnoSedeOperativa[]) => void;
  onRefreshAutomatico?: () => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

// Funzione helper per ottenere il lunedì della settimana contenente una data ISO YYYY-MM-DD
function getLunediSettimanaStr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysISODate(isoDate, diff);
}

// Formatta data YYYY-MM-DD in ora ufficiale italiana (Europe/Rome)
function formatYYYYMMDD(d: Date): string {
  return formatISODateItaly(d);
}

const NOMI_GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export const TabelloneTurniSettimanale: React.FC<TabelloneTurniSettimanaleProps> = ({
  turni,
  sedi,
  volontari = [],
  mezzi = [],
  volontarioLoggatoNome,
  volontarioLoggatoId,
  isAdmin = false,
  isStandalone = false,
  onChiudi,
  onModificaTurno,
  onNuovoTurno,
  onDuplicaTurno,
  onApriTurniRipetuti,
  onAggiornaTurni,
  onRefreshAutomatico,
  onNotificaRadio
}) => {
  // Data di riferimento per i 7 giorni visualizzati (default oggi in Italia)
  const [dataRiferimentoStr, setDataRiferimentoStr] = useState<string>(() => formatISODateItaly());
  const [filtroSedeId, setFiltroSedeId] = useState<string>('tutte');
  const [filtroSoloMieiTurni, setFiltroSoloMieiTurni] = useState<boolean>(false);
  const [filtroFascia, setFiltroFascia] = useState<string>('tutte');
  const [ricercaVolontario, setRicercaVolontario] = useState<string>('');

  // Identificazione volontario per autorizzazioni specifiche di centrale
  const [volontarioFiltroId, setVolontarioFiltroId] = useState<string>(volontarioLoggatoId || '');

  useEffect(() => {
    if (volontarioLoggatoId) {
      setVolontarioFiltroId(volontarioLoggatoId);
    }
  }, [volontarioLoggatoId]);

  const volontarioAttivo = useMemo(() => {
    if (volontarioFiltroId) {
      return volontari.find((v) => v.id === volontarioFiltroId) || null;
    }
    if (volontarioLoggatoId) {
      return volontari.find((v) => v.id === volontarioLoggatoId) || null;
    }
    if (volontarioLoggatoNome) {
      const vNorm = volontarioLoggatoNome.toLowerCase().trim();
      return volontari.find((v) => `${v.nome} ${v.cognome}`.toLowerCase().trim() === vNorm) || null;
    }
    return null;
  }, [volontari, volontarioFiltroId, volontarioLoggatoId, volontarioLoggatoNome]);

  const isOperatoreCentraleOAdmin = isAdmin || Boolean(
    volontarioAttivo?.profiloCentrale ||
    volontarioAttivo?.qualifica === 'Operatore Centrale' ||
    (volontarioAttivo?.qualifica && volontarioAttivo.qualifica.toLowerCase().includes('centrale'))
  );

  // Escludi l'account tecnico di amministrazione dalla lista candidati
  const volontariCandidabili = useMemo(() => {
    return (volontari || []).filter((v) => v.id !== 'vol-admin' && v.pin !== '4451');
  }, [volontari]);

  // Sedi autorizzate per la visualizzazione dei tabelloni turni:
  // Ogni volontario visualizza SOLO ed ESCLUSIVAMENTE i tabelloni consentiti da qualsiasi operatore di centrale
  const sediAutorizzate = useMemo(() => {
    if (isOperatoreCentraleOAdmin) return sedi;
    if (!volontarioAttivo) return sedi;

    if (volontarioAttivo.sediTurniAbilitate && volontarioAttivo.sediTurniAbilitate.length > 0) {
      const permesse = sedi.filter((s) => volontarioAttivo.sediTurniAbilitate!.includes(s.id));
      if (permesse.length > 0) return permesse;
    }
    return sedi;
  }, [sedi, volontarioAttivo, isOperatoreCentraleOAdmin]);

  // Se la sede selezionata non è più tra quelle autorizzate, seleziona la prima autorizzata
  useEffect(() => {
    if (filtroSedeId !== 'tutte' && sediAutorizzate.length > 0) {
      const esiste = sediAutorizzate.some((s) => s.id === filtroSedeId);
      if (!esiste) {
        setFiltroSedeId(sediAutorizzate[0].id);
      }
    }
  }, [sediAutorizzate, filtroSedeId]);

  // ---------------------------------------------------------------------------
  // GESTIONE CANDIDATURA AUTONOMA VOLONTARIO & APPROVAZIONE CENTRALE
  // ---------------------------------------------------------------------------
  const [modaleCandidaturaAperta, setModaleCandidaturaAperta] = useState(false);
  const [turnoPerCandidatura, setTurnoPerCandidatura] = useState<TurnoSedeOperativa | null>(null);
  const [candVolontarioId, setCandVolontarioId] = useState<string>('');
  const [candVolontarioNome, setCandVolontarioNome] = useState<string>('');
  const [candQualifica, setCandQualifica] = useState<string>('');
  const [candRuolo, setCandRuolo] = useState<RuoloTurno>('soccorritore2');
  const [candNote, setCandNote] = useState<string>('');
  const [candErrore, setCandErrore] = useState<string | null>(null);
  const [avvisoFeedback, setAvvisoFeedback] = useState<string | null>(null);

  const mostraAvviso = (msg: string) => {
    setAvvisoFeedback(msg);
    setTimeout(() => setAvvisoFeedback(null), 5000);
  };

  const getEtichettaRuolo = (ruolo: RuoloTurno): string => {
    switch (ruolo) {
      case 'autista': return '🚑 Autista Soccorritore';
      case 'caposervizio': return '👨‍⚕️ Caposervizio';
      case 'soccorritore2': return '🧑‍⚕️ 2° Soccorritore';
      case 'terzoSoccorritore': return '🧑‍⚕️ 3° Soccorritore';
      case 'operatoreCentrale': return '🎧 Operatore Centrale';
      case 'centralinista': return '📞 Centralinista';
      case 'osservatore': return '👁️ Osservatore';
      default: return ruolo;
    }
  };

  const getMigliorRuoloIdoneo = (
    vol: Volontario | null | undefined,
    turno: TurnoSedeOperativa,
    preferred?: RuoloTurno
  ): RuoloTurno => {
    const ruoliOrdine: Array<{ id: RuoloTurno; occupato: boolean }> = [
      { id: 'autista', occupato: Boolean(turno.autista) },
      { id: 'caposervizio', occupato: Boolean(turno.caposervizio) },
      { id: 'soccorritore2', occupato: Boolean(turno.soccorritore2) },
      { id: 'terzoSoccorritore', occupato: Boolean(turno.terzoSoccorritore) },
      { id: 'operatoreCentrale', occupato: Boolean(turno.operatoreCentrale) },
      { id: 'centralinista', occupato: Boolean(turno.centralinista) },
      { id: 'osservatore', occupato: Boolean(turno.osservatore) }
    ];

    if (!vol) return preferred || 'soccorritore2';

    if (preferred && puoCoprireRuoloTurno(vol, preferred).idoneo) {
      return preferred;
    }

    const idonei = ruoliOrdine.filter((r) => puoCoprireRuoloTurno(vol, r.id).idoneo);
    const liberoIdoneo = idonei.find((r) => !r.occupato);
    if (liberoIdoneo) return liberoIdoneo.id;
    if (idonei.length > 0) return idonei[0].id;
    return preferred || 'soccorritore2';
  };

  const apriModaleCandidatura = (t: TurnoSedeOperativa, ruoloDefault?: RuoloTurno) => {
    setTurnoPerCandidatura(t);
    setCandErrore(null);

    let volSelezionato: Volontario | null = null;
    if (volontarioLoggatoNome || volontarioLoggatoId) {
      volSelezionato =
        volontariCandidabili.find(
          (v) =>
            (volontarioLoggatoId && v.id === volontarioLoggatoId) ||
            (volontarioLoggatoNome && `${v.nome} ${v.cognome}`.toLowerCase().trim() === volontarioLoggatoNome.toLowerCase().trim())
        ) || null;
      setCandVolontarioId(volSelezionato?.id || volontarioLoggatoId || `vol-${Date.now()}`);
      setCandVolontarioNome(
        volSelezionato ? `${volSelezionato.nome} ${volSelezionato.cognome}` : (volontarioLoggatoNome || '')
      );
      setCandQualifica(volSelezionato?.qualifica || 'Volontario');
    } else if (volontarioAttivo && volontarioAttivo.id !== 'vol-admin' && volontarioAttivo.pin !== '4451') {
      volSelezionato = volontarioAttivo;
      setCandVolontarioId(volontarioAttivo.id);
      setCandVolontarioNome(`${volontarioAttivo.nome} ${volontarioAttivo.cognome}`);
      setCandQualifica(volontarioAttivo.qualifica || 'Volontario');
    } else {
      volSelezionato = volontariCandidabili[0] || null;
      setCandVolontarioId(volSelezionato?.id || '');
      setCandVolontarioNome(volSelezionato ? `${volSelezionato.nome} ${volSelezionato.cognome}` : '');
      setCandQualifica(volSelezionato?.qualifica || 'Volontario');
    }

    setCandRuolo(getMigliorRuoloIdoneo(volSelezionato, t, ruoloDefault));
    setCandNote('');
    setModaleCandidaturaAperta(true);
  };

  const handleInviaCandidatura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoPerCandidatura) return;
    setCandErrore(null);

    const nomeFinale = candVolontarioNome.trim();
    if (!nomeFinale) {
      setCandErrore('Inserisci o seleziona il nominativo del volontario prima di inviare.');
      return;
    }

    const volTrovato = (volontari || []).find(
      (v) => (candVolontarioId && v.id === candVolontarioId) ||
             (nomeFinale && `${v.nome} ${v.cognome}`.toLowerCase().trim() === nomeFinale.toLowerCase().trim())
    );

    // Controllo abilitazione mansione: ogni volontario può iscriversi solo nelle mansioni assegnate
    if (volTrovato) {
      const verifica = puoCoprireRuoloTurno(volTrovato, candRuolo);
      if (!verifica.idoneo) {
        setCandErrore(
          `Non puoi iscriverti per il ruolo "${getEtichettaRuolo(candRuolo)}". ${verifica.motivo}`
        );
        return;
      }
    }

    const nomeNorm = nomeFinale.toLowerCase().trim();
    const duplicatoInAttesa = (turnoPerCandidatura.richiesteIscrizione || []).some(
      (r) =>
        r.stato === 'In Attesa' &&
        r.ruoloRichiesto === candRuolo &&
        ((candVolontarioId && r.volontarioId === candVolontarioId) ||
          r.volontarioNome.toLowerCase().trim() === nomeNorm)
    );
    if (duplicatoInAttesa) {
      setCandErrore(`Esiste già una candidatura in attesa per "${nomeFinale}" come ${getEtichettaRuolo(candRuolo)} in questo turno.`);
      return;
    }

    const nuovaCandidatura: CandidaturaTurno = {
      id: `cand-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      volontarioId: candVolontarioId || (volTrovato ? volTrovato.id : `vol-est-${Date.now()}`),
      volontarioNome: nomeFinale,
      qualificaVolontario: candQualifica || volTrovato?.qualifica || 'Volontario',
      ruoloRichiesto: candRuolo,
      stato: 'In Attesa',
      dataRichiesta: formatTimeItaly(undefined, false) + ' del ' + formatDateItaly(),
      note: candNote.trim() || undefined
    };

    const aggiornati = turni.map((t) => {
      if (t.id === turnoPerCandidatura.id) {
        const esistenti = t.richiesteIscrizione || [];
        return {
          ...t,
          richiesteIscrizione: [...esistenti, nuovaCandidatura]
        };
      }
      return t;
    });

    if (onAggiornaTurni) {
      onAggiornaTurni(aggiornati);
    } else {
      realtime.syncTurni(aggiornati);
    }

    // Invio diretto anche sul canale dedicato (server WebSocket + Cloud Firestore shift_signups) per persistenza senza auth
    try {
      realtime.submitCandidaturaTurno(turnoPerCandidatura, nuovaCandidatura);
    } catch {}

    // Notifica immediata a chi ha accesso al database turni
    onNotificaRadio?.(
      `📅 DISPONIBILITÀ TURNO: Il volontario ${nuovaCandidatura.volontarioNome} (${nuovaCandidatura.qualificaVolontario || 'Volontario'}) si è reso disponibile per il ruolo di ${getEtichettaRuolo(nuovaCandidatura.ruoloRichiesto)} per il turno del ${turnoPerCandidatura.data} (${turnoPerCandidatura.sedeNome}). Richiesta in attesa di approvazione da chi ha accesso al database turni.`,
      'centrale'
    );

    try {
      realtime.send('NOTIFICA_DISPONIBILITA_TURNO', {
        tipo: 'disponibilita_turno',
        turnoId: turnoPerCandidatura.id,
        volontarioNome: nuovaCandidatura.volontarioNome,
        ruolo: nuovaCandidatura.ruoloRichiesto,
        data: turnoPerCandidatura.data,
        sede: turnoPerCandidatura.sedeNome,
        timestamp: Date.now()
      });
    } catch {}

    mostraAvviso(`✓ Disponibilità inviata con successo per ${getEtichettaRuolo(candRuolo)}! In attesa di approvazione.`);
    setModaleCandidaturaAperta(false);
    setTurnoPerCandidatura(null);
    setCandErrore(null);
  };

  const handleRitiraCandidatura = (turnoId: string, candId: string) => {
    const aggiornati = turni.map((t) => {
      if (t.id === turnoId) {
        return {
          ...t,
          richiesteIscrizione: (t.richiesteIscrizione || []).filter((c) => c.id !== candId)
        };
      }
      return t;
    });
    if (onAggiornaTurni) {
      onAggiornaTurni(aggiornati);
    } else {
      realtime.syncTurni(aggiornati);
    }
    mostraAvviso('Candidatura in attesa ritirata.');
  };

  const handleApprovaCandidatura = (turnoId: string, candId: string) => {
    const targetTurno = turni.find((t) => t.id === turnoId);
    if (!targetTurno) return;
    const cand = (targetTurno.richiesteIscrizione || []).find((c) => c.id === candId);
    if (!cand) return;

    const operatore = volontarioLoggatoNome || (isAdmin ? 'Amministratore' : 'Operatore Centrale');

    const aggiornati = turni.map((t) => {
      if (t.id === turnoId) {
        const nuoveRichieste = (t.richiesteIscrizione || []).map((c) =>
          c.id === candId
            ? {
                ...c,
                stato: 'Approvato' as const,
                approvatoDa: operatore,
                dataDecisione: formatTimeItaly() + ' del ' + formatDateItaly()
              }
            : c
        );

        const assegnato = { id: cand.volontarioId, nome: cand.volontarioNome };
        let { autista, caposervizio, soccorritore2, terzoSoccorritore, operatoreCentrale, centralinista, osservatore } = t;

        if (cand.ruoloRichiesto === 'autista') {
          autista = assegnato;
          if (!caposervizio) {
            caposervizio = { id: assegnato.id, nome: assegnato.nome };
          }
        }
        else if (cand.ruoloRichiesto === 'caposervizio') caposervizio = assegnato;
        else if (cand.ruoloRichiesto === 'soccorritore2') soccorritore2 = assegnato;
        else if (cand.ruoloRichiesto === 'terzoSoccorritore') terzoSoccorritore = assegnato;
        else if (cand.ruoloRichiesto === 'operatoreCentrale') operatoreCentrale = assegnato;
        else if (cand.ruoloRichiesto === 'centralinista') centralinista = assegnato;
        else if (cand.ruoloRichiesto === 'osservatore') osservatore = assegnato;

        const effettivoCapo = caposervizio || autista;
        const statoCopertura: TurnoSedeOperativa['statoCopertura'] =
          autista && effettivoCapo && soccorritore2 ? 'Coperto' : (autista || effettivoCapo || soccorritore2 ? 'Parziale' : 'Scoperto');

        return {
          ...t,
          autista,
          caposervizio,
          soccorritore2,
          terzoSoccorritore,
          operatoreCentrale,
          centralinista,
          osservatore,
          statoCopertura,
          richiesteIscrizione: nuoveRichieste
        };
      }
      return t;
    });

    if (onAggiornaTurni) {
      onAggiornaTurni(aggiornati);
    } else {
      realtime.syncTurni(aggiornati);
    }

    onNotificaRadio?.(
      `✅ CANDIDATURA APPROVATA: ${cand.volontarioNome} confermato come ${getEtichettaRuolo(cand.ruoloRichiesto)} per ${targetTurno.sedeNome} in data ${targetTurno.data} da ${operatore}.`,
      'centrale'
    );
    mostraAvviso(`✓ Candidatura di ${cand.volontarioNome} approvata con successo! Assegnato al turno.`);
  };

  const handleRifiutaCandidatura = (turnoId: string, candId: string) => {
    const operatore = volontarioLoggatoNome || (isAdmin ? 'Amministratore' : 'Operatore Centrale');
    const aggiornati = turni.map((t) => {
      if (t.id === turnoId) {
        const nuoveRichieste = (t.richiesteIscrizione || []).map((c) =>
          c.id === candId
            ? {
                ...c,
                stato: 'Rifiutato' as const,
                approvatoDa: operatore,
                dataDecisione: formatTimeItaly() + ' del ' + formatDateItaly()
              }
            : c
        );
        return {
          ...t,
          richiesteIscrizione: nuoveRichieste
        };
      }
      return t;
    });

    if (onAggiornaTurni) {
      onAggiornaTurni(aggiornati);
    } else {
      realtime.syncTurni(aggiornati);
    }
    mostraAvviso(`Candidatura contrassegnata come rifiutata.`);
  };

  // ---------------------------------------------------------------------------
  // AGGIORNAMENTO AUTOMATICO OGNI MINUTO (SENZA INTERFERENZE UMANE)
  // ---------------------------------------------------------------------------
  const [secondiAlProssimoRefresh, setSecondiAlProssimoRefresh] = useState<number>(60);
  const [ultimoAggiornamento, setUltimoAggiornamento] = useState<string>(() => formatTimeItaly());

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondiAlProssimoRefresh((prev) => {
        if (prev <= 1) {
          setUltimoAggiornamento(formatTimeItaly());
          onRefreshAutomatico?.();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefreshAutomatico]);

  // Se una sezione è selezionata oppure se la visualizzazione è standalone (tramite link diretto),
  // mostra la giornata in corso (oggi) più i 6 giorni successivi (totale 7 giorni continui).
  const isVistaOggiPiu6 = (filtroSedeId !== 'tutte') || isStandalone;

  // Calcola i 7 giorni visualizzati in ora ufficiale italiana (Europe/Rome)
  const giorniSettimana = useMemo(() => {
    const oggiStr = getItalianDateParts().isoDate;
    const startStr = isVistaOggiPiu6
      ? dataRiferimentoStr
      : getLunediSettimanaStr(dataRiferimentoStr);

    const arr: { giornoNome: string; dataStr: string; dataObj: Date; isOggi: boolean }[] = [];

    for (let i = 0; i < 7; i++) {
      const str = addDaysISODate(startStr, i);
      const [yy, mm, dd] = str.split('-').map(Number);
      const g = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
      const nomeGiorno = g.toLocaleDateString('it-IT', { weekday: 'long', timeZone: 'Europe/Rome' });
      const giornoCapitalized = nomeGiorno.charAt(0).toUpperCase() + nomeGiorno.slice(1);

      arr.push({
        giornoNome: giornoCapitalized,
        dataStr: str,
        dataObj: g,
        isOggi: str === oggiStr
      });
    }
    return arr;
  }, [dataRiferimentoStr, isVistaOggiPiu6]);

  const primoGiornoStr = giorniSettimana[0].dataStr;
  const ultimoGiornoStr = giorniSettimana[6].dataStr;

  // Navigazione settimane o blocchi da 7 giorni
  const navigaSettimana = (deltaSettimane: number) => {
    setDataRiferimentoStr((prev) => addDaysISODate(prev, deltaSettimane * 7));
  };

  const vaiAOggi = () => {
    setDataRiferimentoStr(formatISODateItaly());
  };

  // Mappa dei turni per data
  const turniSettimana = useMemo(() => {
    return turni.filter((t) => {
      // Filtro data compresa nei 7 giorni visualizzati
      if (t.data < primoGiornoStr || t.data > ultimoGiornoStr) return false;

      // Filtro autorizzazioni sede: ogni volontario visualizza SOLO ed ESCLUSIVAMENTE i tabelloni abilitati dalla centrale
      if (!isOperatoreCentraleOAdmin && volontarioAttivo && sediAutorizzate.length > 0) {
        const sedeConsentita = sediAutorizzate.some((s) => s.id === t.sedeId);
        if (!sedeConsentita) return false;
      }

      // Filtro sede
      if (filtroSedeId !== 'tutte' && t.sedeId !== filtroSedeId) return false;

      // Filtro fascia oraria
      if (filtroFascia !== 'tutte' && !t.fasciaOraria.toLowerCase().includes(filtroFascia.toLowerCase())) {
        return false;
      }

      // Filtro solo miei turni
      if (filtroSoloMieiTurni && volontarioLoggatoNome) {
        const nomeNorm = volontarioLoggatoNome.toLowerCase().trim();
        const autista = t.autista?.nome.toLowerCase() || '';
        const capo = t.caposervizio?.nome.toLowerCase() || '';
        const s2 = t.soccorritore2?.nome.toLowerCase() || '';
        const s3 = t.terzoSoccorritore?.nome.toLowerCase() || '';
        const cent = t.operatoreCentrale?.nome.toLowerCase() || '';
        const trovato = [autista, capo, s2, s3, cent].some((n) => n.includes(nomeNorm));
        if (!trovato) return false;
      }

      // Ricerca libera volontario
      if (ricercaVolontario.trim()) {
        const q = ricercaVolontario.toLowerCase().trim();
        const autista = t.autista?.nome.toLowerCase() || '';
        const capo = t.caposervizio?.nome.toLowerCase() || '';
        const s2 = t.soccorritore2?.nome.toLowerCase() || '';
        const s3 = t.terzoSoccorritore?.nome.toLowerCase() || '';
        const cent = t.operatoreCentrale?.nome.toLowerCase() || '';
        const mezzo = t.mezzoAssegnato?.toLowerCase() || '';
        const sedeN = t.sedeNome?.toLowerCase() || '';
        const match = [autista, capo, s2, s3, cent, mezzo, sedeN].some((n) => n.includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [turni, primoGiornoStr, ultimoGiornoStr, filtroSedeId, filtroFascia, filtroSoloMieiTurni, volontarioLoggatoNome, ricercaVolontario, isOperatoreCentraleOAdmin, volontarioAttivo, sediAutorizzate]);

  // Raggruppa i turni per giorno
  const turniPerGiorno = useMemo(() => {
    const map: Record<string, TurnoSedeOperativa[]> = {};
    giorniSettimana.forEach((g) => {
      map[g.dataStr] = [];
    });
    turniSettimana.forEach((t) => {
      if (map[t.data]) {
        map[t.data].push(t);
      }
    });
    // Ordina i turni del giorno per orario di inizio
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.orarioInizio.localeCompare(b.orarioInizio));
    });
    return map;
  }, [turniSettimana, giorniSettimana]);

  // Statistiche settimana
  const statsSettimana = useMemo(() => {
    const totali = turniSettimana.length;
    const coperti = turniSettimana.filter((t) => t.statoCopertura === 'Coperto').length;
    const parziali = turniSettimana.filter((t) => t.statoCopertura === 'Parziale').length;
    const scoperti = turniSettimana.filter((t) => t.statoCopertura === 'Scoperto').length;
    return { totali, coperti, parziali, scoperti };
  }, [turniSettimana]);

  // Verifica se un turno include il volontario loggato
  const includeVolontarioLoggato = (t: TurnoSedeOperativa): boolean => {
    if (!volontarioLoggatoNome) return false;
    const norm = volontarioLoggatoNome.toLowerCase().trim();
    const nomi = [
      t.autista?.nome,
      t.caposervizio?.nome,
      t.soccorritore2?.nome,
      t.terzoSoccorritore?.nome,
      t.operatoreCentrale?.nome,
      t.centralinista?.nome,
      t.osservatore?.nome
    ].filter(Boolean) as string[];
    const inCrew = nomi.some((n) => n.toLowerCase().includes(norm));
    if (inCrew) return true;
    return (t.richiesteIscrizione || []).some(
      (c) =>
        (volontarioLoggatoId && c.volontarioId === volontarioLoggatoId) ||
        c.volontarioNome.toLowerCase().includes(norm)
    );
  };

  // Funzione di stampa
  const stampaTabellone = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const sedeAttiva = sedi.find((s) => s.id === filtroSedeId);

  return (
    <div className={`w-full ${isStandalone ? 'min-h-screen bg-slate-950 text-slate-100 p-1 sm:p-2.5 space-y-2.5' : 'bg-slate-950 text-slate-100 p-2 sm:p-4 rounded-3xl border-2 border-indigo-500/40 shadow-2xl space-y-3'}`}>
      
      {/* ------------------------------------------------------------- */}
      {/* HEADER TABELLONE TURNI: ALLARGATO E PORTATO SUBITO IN ALTO     */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="shrink-0 flex items-center justify-center">
            <CroceOroLogo size="md" className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-md" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                Pianificazione Settimanale Sedi
              </span>
              {isStandalone && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Accesso Diretto H24</span>
                </span>
              )}
              {volontarioAttivo && !isOperatoreCentraleOAdmin && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/50 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>{sediAutorizzate.length} Sezion{sediAutorizzate.length === 1 ? 'e' : 'i'} autorizzat{sediAutorizzate.length === 1 ? 'a' : 'e'} da Centrale</span>
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide flex items-center gap-2 mt-0.5">
              <span>Tabellone Turni per Sezione Territoriale</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizzazione equipaggi, autisti, soccorritori e mezzi operativi assegnati per ciascuna sede della Croce Oro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {/* Selettore profilo per visualizzare le sedi autorizzate dalla Centrale */}
          {volontari && volontari.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <label htmlFor="select-volontario-tabellone" className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">
                Profilo:
              </label>
              <select
                id="select-volontario-tabellone"
                value={volontarioFiltroId}
                onChange={(e) => setVolontarioFiltroId(e.target.value)}
                className="bg-transparent text-xs text-amber-300 font-bold focus:outline-none cursor-pointer max-w-[170px] sm:max-w-[220px] truncate"
                title="Seleziona il volontario per visualizzare solo ed esclusivamente i tabelloni autorizzati dalla centrale"
              >
                <option value="" className="bg-slate-900 text-slate-300">
                  Tutti / Centrale (Tutte le Sedi)
                </option>
                {volontari.map((v) => {
                  const haRestrizioni = v.sediTurniAbilitate && v.sediTurniAbilitate.length > 0;
                  return (
                    <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                      {v.nome} {v.cognome} ({v.qualifica}){haRestrizioni ? ` • ${v.sediTurniAbilitate!.length} sedi` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={stampaTabellone}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Stampa il tabellone turni settimanale"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Stampa Tabellone</span>
          </button>

          {isAdmin && onApriTurniRipetuti && (
            <button
              type="button"
              onClick={onApriTurniRipetuti}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Programma una serie di turni ripetuti sui giorni della settimana fino a una data"
            >
              <Repeat className="w-4 h-4 text-teal-200" />
              <span>Turni Ripetuti</span>
            </button>
          )}

          {isAdmin && onNuovoTurno && (
            <button
              type="button"
              onClick={() => onNuovoTurno(filtroSedeId !== 'tutte' ? filtroSedeId : undefined)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuovo Turno</span>
            </button>
          )}

          {onChiudi && !isStandalone && (
            <button
              type="button"
              onClick={onChiudi}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Chiudi tabellone turni"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA CONTROLLI: SEZIONE, SETTIMANA, FILTRI                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/70 p-3 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
        
        {/* RIGA 1: SELETTORE SEZIONE TERRITORIALE & NAVIGAZIONE SETTIMANA */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Selettore Sezione Territoriale */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5 shrink-0">
              <Building2 className="w-4 h-4 text-rose-400" />
              <span>Sezione:</span>
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
              {sediAutorizzate.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFiltroSedeId('tutte')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filtroSedeId === 'tutte'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  Tutte le Sedi Autorizzate ({sediAutorizzate.length})
                </button>
              )}
              {sediAutorizzate.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFiltroSedeId(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    filtroSedeId === s.id
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  <span>{s.nome}</span>
                  {s.mezziAssegnati.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/60 font-mono text-amber-300">
                      🚑 {s.mezziAssegnati.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Navigatore Settimana */}
          <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => navigaSettimana(-1)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Settimana precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center px-2">
              <span className="text-xs font-black text-indigo-300 block">
                {giorniSettimana[0].dataObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', timeZone: 'Europe/Rome' })} — {giorniSettimana[6].dataObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' })}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {primoGiornoStr} al {ultimoGiornoStr}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigaSettimana(1)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Settimana successiva"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={vaiAOggi}
              className="px-2.5 py-1 rounded-lg bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 text-[11px] font-bold border border-indigo-700/50 cursor-pointer ml-1"
            >
              Oggi
            </button>
          </div>
        </div>

        {/* RIGA 2: FILTRI RAPIDI & STATISTICHE COPERTURA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Ricerca per nominativo o mezzo */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ricercaVolontario}
                onChange={(e) => setRicercaVolontario(e.target.value)}
                placeholder="Cerca volontario o mezzo..."
                className="w-full pl-8 pr-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              {ricercaVolontario && (
                <button
                  type="button"
                  onClick={() => setRicercaVolontario('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro per fascia oraria */}
            <select
              value={filtroFascia}
              onChange={(e) => setFiltroFascia(e.target.value)}
              className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold"
            >
              <option value="tutte">Tutte le Fasce Orarie</option>
              <option value="mattina">Solo Mattina (08:00 - 14:00)</option>
              <option value="pomeriggio">Solo Pomeriggio (14:00 - 20:00)</option>
              <option value="notte">Solo Notte (20:00 - 08:00)</option>
              <option value="reperibilit">Reperibilità H24</option>
            </select>

            {/* Toggle "I Miei Turni" se volontario loggato */}
            {volontarioLoggatoNome && (
              <button
                type="button"
                onClick={() => setFiltroSoloMieiTurni(!filtroSoloMieiTurni)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filtroSoloMieiTurni
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>⭐ Solo i Miei Turni ({volontarioLoggatoNome.split(' ')[0]})</span>
              </button>
            )}
          </div>

          {/* Badge indicatori copertura settimana */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
              Totale Turni: <strong>{statsSettimana.totali}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800">
              🟢 {statsSettimana.coperti}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-800">
              🟡 {statsSettimana.parziali}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-red-950 text-red-300 border border-red-800">
              🔴 {statsSettimana.scoperti}
            </span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* BANNER AGGIORNAMENTO AUTOMATICO OGNI MINUTO (SENZA INTERFERENZE) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 px-4 py-2 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">
              Aggiornamento automatico ogni 60 secondi
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-black uppercase">
              Attivo H24
            </span>
          </div>
          <span className="text-slate-500 hidden md:inline">•</span>
          <span className="text-emerald-400 font-mono text-[11px] bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
            Prossimo sync tra <strong>{secondiAlProssimoRefresh}s</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>Ultimo aggiornamento: <strong className="text-slate-200">{ultimoAggiornamento}</strong></span>
          <button
            type="button"
            onClick={() => {
              setUltimoAggiornamento(formatTimeItaly());
              setSecondiAlProssimoRefresh(60);
              onRefreshAutomatico?.();
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            title="Forza aggiornamento immediato dati"
          >
            <RefreshCw className="w-3 h-3 text-indigo-400" />
            <span>Sincronizza ora</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* GRIGLIA DEI 7 GIORNI (OGGI + 6 GIORNI SUCCESSIVI) A TUTTO SCHERMO */}
      {/* Si adatta al 100% dello schermo visualizzando tutti i 7 giorni  */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 xl:gap-2.5 w-full">
          {giorniSettimana.map((giorno) => {
            const turniDelGiorno = turniPerGiorno[giorno.dataStr] || [];

          return (
            <div
              key={giorno.dataStr}
              className={`rounded-2xl border flex flex-col transition-all overflow-hidden ${
                giorno.isOggi
                  ? 'bg-slate-900 border-indigo-400 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Intestazione Colonna Giorno */}
              <div
                className={`p-2.5 text-center border-b ${
                  giorno.isOggi
                    ? 'bg-gradient-to-r from-indigo-900/80 to-blue-900/80 border-indigo-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${giorno.isOggi ? 'text-amber-300' : 'text-slate-400'}`}>
                    {giorno.giornoNome}
                  </span>
                  {giorno.isOggi && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                      Oggi
                    </span>
                  )}
                </div>
                <div className="text-sm font-black text-white mt-0.5">
                  {giorno.dataObj.getUTCDate()} {giorno.dataObj.toLocaleDateString('it-IT', { month: 'short', timeZone: 'Europe/Rome' })}
                </div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  {turniDelGiorno.length} {turniDelGiorno.length === 1 ? 'Turno' : 'Turni'}
                </span>
              </div>

              {/* Elenco Turni del Giorno */}
              <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[600px]">
                {turniDelGiorno.length === 0 ? (
                  <div className="p-4 text-center text-slate-600 text-xs italic space-y-1">
                    <span>Nessun turno programmato</span>
                    {isAdmin && onNuovoTurno && (
                      <button
                        type="button"
                        onClick={() => onNuovoTurno(filtroSedeId !== 'tutte' ? filtroSedeId : undefined, giorno.dataStr)}
                        className="block w-full text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline mt-1 cursor-pointer"
                      >
                        + Aggiungi turno
                      </button>
                    )}
                  </div>
                ) : (
                  turniDelGiorno.map((turno) => {
                    const isMioTurno = includeVolontarioLoggato(turno);
                    const isCoperto = turno.statoCopertura === 'Coperto';
                    const isParziale = turno.statoCopertura === 'Parziale';

                    return (
                      <div
                        key={turno.id}
                        onClick={() => {
                          if (isAdmin && onModificaTurno) {
                            onModificaTurno(turno);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs space-y-2 transition-all ${
                          isMioTurno
                            ? 'bg-amber-950/40 border-amber-500/80 shadow-md shadow-amber-950/50 ring-1 ring-amber-400'
                            : isCoperto
                            ? 'bg-slate-950/80 border-slate-700 hover:border-slate-600'
                            : isParziale
                            ? 'bg-amber-950/20 border-amber-700/60 hover:border-amber-600'
                            : 'bg-red-950/20 border-red-700/60 hover:border-red-600'
                        } ${isAdmin ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
                      >
                        {/* Sezione e Orario */}
                        <div className="flex items-start justify-between gap-1 border-b border-slate-800 pb-1.5">
                          <div>
                            <span className="font-black text-white text-[11px] block truncate" title={turno.sedeNome}>
                              🏢 {turno.sedeNome.replace('Sede Operativa ', '').replace('Sezione Territoriale ', '')}
                            </span>
                            {turno.nomeTurno && (
                              <div className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-indigo-900/60 border border-indigo-500/40 text-[9.5px] font-bold text-indigo-200 truncate max-w-[140px]" title={turno.nomeTurno}>
                                🏷️ {turno.nomeTurno}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-indigo-300 font-mono mt-0.5">
                              <Clock className="w-3 h-3 text-indigo-400" />
                              <span>{turno.orarioInizio} - {turno.orarioFine}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border shrink-0 ${
                                isCoperto
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                                  : isParziale
                                  ? 'bg-amber-950 text-amber-300 border-amber-700/50'
                                  : 'bg-red-950 text-red-300 border-red-700/50'
                              }`}
                            >
                              {turno.statoCopertura}
                            </span>
                            {isMioTurno && (
                              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[8.5px] font-black uppercase shrink-0">
                                Tuo Turno
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mezzo Assegnato */}
                        {turno.mezzoAssegnato && (
                          <div className="flex items-center justify-between text-[10px] bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 font-mono">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Car className="w-3 h-3 text-amber-400" /> Mezzo:
                            </span>
                            <strong className="text-amber-300">{turno.mezzoAssegnato}</strong>
                          </div>
                        )}

                        {/* Equipaggio del Turno */}
                        <div className="space-y-1 text-[10.5px]">
                          {/* Autista */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-slate-400 text-[10px] shrink-0">Autista:</span>
                            {turno.autista ? (
                              <span className={`font-bold truncate max-w-[165px] text-right ${turno.autista.nome.toLowerCase().includes(volontarioLoggatoNome?.toLowerCase() || '---') ? 'text-amber-400 font-black' : 'text-slate-100'}`} title={turno.autista.nome}>
                                🚑 {turno.autista.nome}
                              </span>
                            ) : (
                              <span className="text-red-400 font-bold italic text-[10px]">Da Assegnare</span>
                            )}
                          </div>

                          {/* Caposervizio */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-slate-400 text-[10px] shrink-0">Caposervizio:</span>
                            {turno.caposervizio ? (
                              <span className={`font-bold truncate max-w-[165px] text-right ${turno.caposervizio.nome.toLowerCase().includes(volontarioLoggatoNome?.toLowerCase() || '---') ? 'text-amber-400 font-black' : 'text-slate-100'}`} title={turno.caposervizio.nome}>
                                👨‍⚕️ {turno.caposervizio.nome}
                              </span>
                            ) : (
                              <span className="text-amber-400/90 font-bold italic text-[10px]">Da Assegnare</span>
                            )}
                          </div>

                          {/* 2° Soccorritore */}
                          {turno.soccorritore2 && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 text-[10px] shrink-0">2° Socc.:</span>
                              <span className={`truncate max-w-[165px] text-right ${turno.soccorritore2.nome.toLowerCase().includes(volontarioLoggatoNome?.toLowerCase() || '---') ? 'text-amber-400 font-black' : 'text-slate-200'}`} title={turno.soccorritore2.nome}>
                                🧑‍⚕️ {turno.soccorritore2.nome}
                              </span>
                            </div>
                          )}

                          {/* 3° Soccorritore */}
                          {turno.terzoSoccorritore && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 text-[10px] shrink-0">3° Socc.:</span>
                              <span className={`truncate max-w-[165px] text-right ${turno.terzoSoccorritore.nome.toLowerCase().includes(volontarioLoggatoNome?.toLowerCase() || '---') ? 'text-amber-400 font-black' : 'text-slate-200'}`} title={turno.terzoSoccorritore.nome}>
                                🧑‍⚕️ {turno.terzoSoccorritore.nome}
                              </span>
                            </div>
                          )}

                          {/* Operatore Centrale */}
                          {turno.operatoreCentrale && (
                            <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-slate-800/80">
                              <span className="text-slate-400 text-[10px] shrink-0">Centrale:</span>
                              <span className="text-slate-300 text-[10px] truncate max-w-[165px] text-right" title={turno.operatoreCentrale.nome}>
                                🎧 {turno.operatoreCentrale.nome}
                              </span>
                            </div>
                          )}

                          {/* Centralinista */}
                          {turno.centralinista ? (
                            <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-slate-800/80">
                              <span className="text-slate-400 text-[10px] shrink-0">Centralinista:</span>
                              <span className={`font-bold truncate max-w-[165px] text-right ${turno.centralinista.nome.toLowerCase().includes(volontarioLoggatoNome?.toLowerCase() || '---') ? 'text-amber-400 font-black' : 'text-slate-200'}`} title={turno.centralinista.nome}>
                                📞 {turno.centralinista.nome}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 pt-0.5 border-t border-slate-800/40">
                              <span className="text-slate-400 text-[10px] shrink-0">Centralinista:</span>
                              <span className="italic text-slate-500 text-[9.5px]">Disponibile</span>
                            </div>
                          )}

                          {/* Osservatore */}
                          {turno.osservatore ? (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 text-[10px] shrink-0">Osservatore:</span>
                              <span className={`font-bold truncate max-w-[165px] text-right ${turno.osservatore.nome.toLowerCase().includes(volontarioLoggatoNome?.toLowerCase() || '---') ? 'text-amber-400 font-black' : 'text-slate-200'}`} title={turno.osservatore.nome}>
                                👁️ {turno.osservatore.nome}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500">
                              <span className="text-slate-400 text-[10px] shrink-0">Osservatore:</span>
                              <span className="italic text-slate-500 text-[9.5px]">Disponibile</span>
                            </div>
                          )}
                        </div>

                        {turno.note && (
                          <div className="text-[9.5px] text-slate-400 italic bg-slate-900/50 p-1 rounded border border-slate-800/60 truncate" title={turno.note}>
                            💬 {turno.note}
                          </div>
                        )}

                        {/* SEZIONE CANDIDATURE & STATO APPROVAZIONE */}
                        {(() => {
                          const richiesteInAttesa = (turno.richiesteIscrizione || []).filter((r) => r.stato === 'In Attesa');
                          const miaCandidatura = (turno.richiesteIscrizione || []).find(
                            (r) =>
                              (volontarioLoggatoId && r.volontarioId === volontarioLoggatoId) ||
                              (volontarioLoggatoNome && r.volontarioNome.toLowerCase().includes(volontarioLoggatoNome.toLowerCase().trim()))
                          );

                          return (
                            <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                              {/* Candidatura personale del volontario */}
                              {miaCandidatura && (
                                <div className={`p-1.5 rounded-lg border text-[10px] flex items-center justify-between gap-1 ${
                                  miaCandidatura.stato === 'Approvato'
                                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                                    : miaCandidatura.stato === 'In Attesa'
                                    ? 'bg-amber-950/80 border-amber-500/70 text-amber-200'
                                    : 'bg-red-950/70 border-red-500/60 text-red-300'
                                }`}>
                                  <div className="flex items-center gap-1 min-w-0">
                                    {miaCandidatura.stato === 'Approvato' ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    ) : miaCandidatura.stato === 'In Attesa' ? (
                                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-spin" />
                                    ) : (
                                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    )}
                                    <span className="truncate">
                                      Tua cand.: <strong>{getEtichettaRuolo(miaCandidatura.ruoloRichiesto)}</strong>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="px-1.5 py-0.2 rounded font-black text-[9px] uppercase bg-slate-950/70">
                                      {miaCandidatura.stato === 'In Attesa' ? '⏳ In Attesa' : miaCandidatura.stato}
                                    </span>
                                    {miaCandidatura.stato === 'In Attesa' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRitiraCandidatura(turno.id, miaCandidatura.id);
                                        }}
                                        className="px-1.5 py-0.2 rounded bg-slate-900 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-700 font-bold text-[8.5px] uppercase cursor-pointer"
                                        title="Ritira questa candidatura in attesa"
                                      >
                                        Ritira
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Box Candidature in Attesa con approvazione da operatore di centrale o admin */}
                              {richiesteInAttesa.length > 0 && (
                                <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9.5px] font-black uppercase text-amber-300 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-400" />
                                      <span>Richieste in Attesa ({richiesteInAttesa.length}):</span>
                                    </span>
                                  </div>

                                  {richiesteInAttesa.map((req) => (
                                    <div key={req.id} className="p-1.5 rounded-lg bg-slate-900/95 border border-slate-700/80 text-[10px] space-y-1">
                                      <div className="flex items-start justify-between gap-1">
                                        <div className="min-w-0">
                                          <strong className="text-white block truncate">{req.volontarioNome}</strong>
                                          <span className="text-amber-400 font-bold block text-[9.5px]">
                                            {getEtichettaRuolo(req.ruoloRichiesto)}
                                          </span>
                                          <span className="text-slate-400 text-[8.5px] font-mono">{req.dataRichiesta}</span>
                                        </div>
                                      </div>

                                      {/* Azioni di Approvazione riservate a Operatore di Centrale / Admin */}
                                      {isOperatoreCentraleOAdmin && (
                                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-800">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleApprovaCandidatura(turno.id, req.id);
                                            }}
                                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                                            title="Approva la candidatura e inserisci il volontario nel turno"
                                          >
                                            <Check className="w-3 h-3 text-emerald-200" />
                                            <span>Approva</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRifiutaCandidatura(turno.id, req.id);
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-700 font-bold text-[9px] uppercase active:scale-95 cursor-pointer"
                                            title="Rifiuta candidatura"
                                          >
                                            <X className="w-3 h-3" />
                                            <span>Rifiuta</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Pulsante per il volontario di candidarsi al turno */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  apriModaleCandidatura(turno);
                                }}
                                className="w-full py-1.5 px-2 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/40 active:scale-95 transition-all cursor-pointer border border-teal-400/40"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-teal-200" />
                                <span>Segnati a questo Turno</span>
                              </button>
                            </div>
                          );
                        })()}

                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-slate-800/80">
                            {onDuplicaTurno && (
                              <button
                                type="button"
                                onClick={() => onDuplicaTurno(turno)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-bold text-[9.5px] flex items-center gap-1 transition-all cursor-pointer border border-amber-500/30"
                                title="Duplica questo turno (con o senza disponibilità volontari)"
                              >
                                <Copy className="w-3 h-3 text-amber-400" />
                                <span>Duplica</span>
                              </button>
                            )}
                            {onModificaTurno && (
                              <button
                                type="button"
                                onClick={() => onModificaTurno(turno)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 font-bold text-[9.5px] flex items-center gap-1 transition-all cursor-pointer border border-teal-500/30"
                                title="Modifica orari o volontari"
                              >
                                <Clock className="w-3 h-3 text-teal-400" />
                                <span>Modifica</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Avviso Notifica Feedback (Portal su document.body) */}
      {typeof document !== 'undefined' && avvisoFeedback && createPortal(
        <div className="fixed bottom-4 right-4 z-[9996] px-4 py-3 rounded-2xl bg-teal-950 border-2 border-teal-400 text-teal-100 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <span>{avvisoFeedback}</span>
        </div>,
        document.body
      )}

      {/* Footer Riepilogo e Informazioni Operative */}
      <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <CroceOroLogo size="sm" className="w-5 h-5 shrink-0" />
          <span>
            Croce Oro Massa Carrara OdV • Tabellone Ufficiale Turni Operativi H24
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Equipaggio Completo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Parziale
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Scoperto
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODALE CANDIDATURA / ISCRIZIONE VOLONTARIO AL TURNO (PORTAL) */}
      {/* ------------------------------------------------------------- */}
      {typeof document !== 'undefined' && modaleCandidaturaAperta && turnoPerCandidatura && createPortal(
        <div
          className="fixed inset-0 z-[9995] bg-slate-950/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModaleCandidaturaAperta(false);
              setCandErrore(null);
            }
          }}
        >
          <div className="bg-slate-900 border-2 border-teal-500/60 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4 my-auto">
            {/* Header Modale */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/40">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    Candidati per questo Turno
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Scegli il tuo ruolo • Richiede approvazione da Operatore di Centrale
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModaleCandidaturaAperta(false);
                  setCandErrore(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Riepilogo Turno Selezionato */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Sede:</span>
                <strong className="text-white">{turnoPerCandidatura.sedeNome}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Data e Orario:</span>
                <strong className="text-indigo-300">{turnoPerCandidatura.data} ({turnoPerCandidatura.orarioInizio} - {turnoPerCandidatura.orarioFine})</strong>
              </div>
              {turnoPerCandidatura.mezzoAssegnato && (
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Mezzo Assegnato:</span>
                  <strong className="text-amber-300">🚑 {turnoPerCandidatura.mezzoAssegnato}</strong>
                </div>
              )}
            </div>

            <form onSubmit={handleInviaCandidatura} className="space-y-3.5 text-xs">
              {/* Selezione Volontario */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nominativo Volontario:
                </label>
                {volontariCandidabili.length > 0 ? (
                  <select
                    value={candVolontarioId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setCandVolontarioId(selId);
                      setCandErrore(null);
                      const trovato = volontariCandidabili.find((v) => v.id === selId) || null;
                      if (trovato) {
                        setCandVolontarioNome(`${trovato.nome} ${trovato.cognome}`);
                        setCandQualifica(trovato.qualifica || 'Volontario');
                        setCandRuolo(getMigliorRuoloIdoneo(trovato, turnoPerCandidatura, candRuolo));
                      } else {
                        setCandVolontarioNome('');
                        setCandQualifica('Volontario');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="">-- Seleziona Volontario --</option>
                    {volontariCandidabili.map((v) => {
                      const isAutista = v.qualifica?.toLowerCase().includes('autista');
                      return (
                        <option key={v.id} value={v.id}>
                          {v.nome} {v.cognome} ({isAutista ? 'Autista • Idoneo Soccorritore' : (v.qualifica || 'Volontario')})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={candVolontarioNome}
                    onChange={(e) => {
                      setCandVolontarioNome(e.target.value);
                      if (candErrore) setCandErrore(null);
                    }}
                    placeholder="Nome e Cognome..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    required
                  />
                )}
              </div>

              {/* Informazione Idoneità Flessibile per Autista */}
              {candQualifica.toLowerCase().includes('autista') && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-[11px] text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-emerald-300 font-bold">Qualifica Autista Riconosciuta</strong>
                    <span>Puoi candidarti per il ruolo di <strong>Autista</strong> oppure anche come <strong>Soccorritore</strong>, <strong>Centralinista</strong> o <strong>Osservatore</strong>.</span>
                  </div>
                </div>
              )}

              {/* Scelta Ruolo Richiesto con controllo rigoroso delle mansioni assegnate */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block text-slate-300 font-bold">
                    Ruolo che desideri ricoprire in questo turno:
                  </label>
                  {(() => {
                    const volAttivo = (volontari || []).find(
                      (v) => (candVolontarioId && v.id === candVolontarioId) ||
                             (candVolontarioNome && `${v.nome} ${v.cognome}`.toLowerCase() === candVolontarioNome.trim().toLowerCase())
                    );
                    const mansioni = volAttivo ? getMansioniVolontario(volAttivo) : [];
                    return (
                      <span className="text-[10px] text-indigo-300 font-mono">
                        Mansioni: <strong>{mansioni.join(', ') || 'Volontario'}</strong>
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    { id: 'autista', label: '🚑 Autista Soccorritore', occupato: Boolean(turnoPerCandidatura.autista) },
                    { id: 'caposervizio', label: '👨‍⚕️ Caposervizio', occupato: Boolean(turnoPerCandidatura.caposervizio) },
                    { id: 'soccorritore2', label: '🧑‍⚕️ 2° Soccorritore', occupato: Boolean(turnoPerCandidatura.soccorritore2) },
                    { id: 'terzoSoccorritore', label: '🧑‍⚕️ 3° Soccorritore', occupato: Boolean(turnoPerCandidatura.terzoSoccorritore) },
                    { id: 'operatoreCentrale', label: '🎧 Sala Radio / Centrale', occupato: Boolean(turnoPerCandidatura.operatoreCentrale) },
                    { id: 'centralinista', label: '📞 Centralinista', occupato: Boolean(turnoPerCandidatura.centralinista) },
                    { id: 'osservatore', label: '👁️ Osservatore', occupato: Boolean(turnoPerCandidatura.osservatore) }
                  ] as { id: RuoloTurno; label: string; occupato: boolean }[]).map((r) => {
                    const volAttivo = (volontari || []).find(
                      (v) => (candVolontarioId && v.id === candVolontarioId) ||
                             (candVolontarioNome && `${v.nome} ${v.cognome}`.toLowerCase() === candVolontarioNome.trim().toLowerCase())
                    );
                    const idoneita = volAttivo ? puoCoprireRuoloTurno(volAttivo, r.id) : { idoneo: true, mansioniRichieste: [] };
                    const nonIdoneo = !idoneita.idoneo;

                    return (
                      <label
                        key={r.id}
                        title={nonIdoneo ? `Non abilitato: richiede mansione ${idoneita.mansioniRichieste.join(' o ')}` : undefined}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          nonIdoneo
                            ? 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                            : candRuolo === r.id
                            ? 'bg-teal-950/70 border-teal-400 text-white shadow-md shadow-teal-950/40 ring-1 ring-teal-400 cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="ruoloCandidatura"
                            value={r.id}
                            disabled={nonIdoneo}
                            checked={candRuolo === r.id}
                            onChange={() => !nonIdoneo && setCandRuolo(r.id)}
                            className="accent-teal-500"
                          />
                          <div>
                            <span className={`font-bold text-[11px] block ${nonIdoneo ? 'line-through text-slate-500' : ''}`}>
                              {r.label}
                            </span>
                            {nonIdoneo && (
                              <span className="text-[9px] text-rose-400 font-normal">
                                Richiede: {idoneita.mansioniRichieste[0] || 'Mansione specifica'}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase shrink-0 ${
                          nonIdoneo
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            : r.occupato
                            ? 'bg-amber-950/70 text-amber-400'
                            : 'bg-emerald-950/70 text-emerald-400'
                        }`}>
                          {nonIdoneo ? 'Non Idoneo' : r.occupato ? 'Occupato' : 'Libero'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Note / Disponibilità */}
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Note aggiuntive per la Centrale (opzionale):
                </label>
                <textarea
                  rows={2}
                  value={candNote}
                  onChange={(e) => setCandNote(e.target.value)}
                  placeholder="Es. arrivo 10 minuti prima, disponibilità parziale, ecc..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs"
                />
              </div>

              {/* Avviso Regolamento Centrale */}
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-[11px] text-amber-200/90 space-y-1">
                <div className="font-black flex items-center gap-1.5 text-amber-300 uppercase text-[10px]">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Approvazione Centrale Operativa Obbligatoria</span>
                </div>
                <p className="text-[10.5px] leading-relaxed">
                  L'inserimento ufficiale nel turno avverrà solo dopo la verifica e l'approvazione da parte di un Operatore di Centrale o dell'Amministratore. Riceverai la conferma non appena convalidata.
                </p>
              </div>

              {/* Messaggio di Errore Inline */}
              {candErrore && (
                <div className="p-3 rounded-2xl bg-red-950/70 border border-red-500/70 text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-snug">{candErrore}</span>
                </div>
              )}

              {/* Bottoni Azione */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModaleCandidaturaAperta(false);
                    setCandErrore(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-teal-600/30 active:scale-95 transition-all cursor-pointer border border-teal-400/50"
                >
                  <Send className="w-4 h-4 text-teal-200" />
                  <span>Invia Candidatura alla Centrale</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
