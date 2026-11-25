import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Search,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Car,
  MapPin,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserMinus,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  Printer,
  Sparkles,
  ShieldAlert,
  Headphones,
  Lock,
  Copy,
  ExternalLink,
  Repeat,
  Layers,
  Eye,
  Phone,
  BellRing,
  CalendarDays,
  CheckSquare,
  Square,
  Filter,
  Info,
  Sun,
  Flame,
  Award,
  Star,
  Sliders,
  ArrowLeftRight
} from 'lucide-react';
import { TurnoSedeOperativa, SedeAssociativaCompleta, RuoloTurno, CandidaturaTurno, MezzoFlotta, PropostaScambioTurno } from '../../types/adminTypes';
import { MEZZI_FLOTTA_INIZIALI } from '../../data/adminMockData';
import { MezzoFuoriServizio } from '../../data/suggerimentiMezzi';
import { Volontario } from '../DatabaseVolontariModal';
import { TabelloneTurniSettimanale } from '../TabelloneTurniSettimanale';
import { useTitoloDatabase, useNomiSottosezioniCustom } from '../../hooks/useNomiDatabase';
import { getTitoloSottosezione } from '../../constants/macroCategorie';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import {
  isGiornoFestivo,
  isGiornoPrefestivo,
  getDettaglioTipoGiorno
} from '../../utils/festivitaItaliane';
import {
  puoCoprireRuoloTurno,
  getMansioniVolontario,
  getMansioniCatalogo,
  getLabelRuoloEquipaggioLive
} from '../../utils/mansioniVolontari';
import {
  useTipiTurno,
  calcolaCoperturaTurno,
  getCapoServizioTurno,
  getVolontariAssegnatiTurno,
  risolviMansioniTipoTurnoLive,
  getRegoleStrumentiPerTurno,
  inviaNotificaStrumentiTurniEmail
} from '../../utils/tipiTurno';
import { IconaEmoji } from '../IconaEmoji';
import { formatIconaPerTesto } from '../../utils/emojiIconsArchive';
import { PannelloTipiTurno } from './PannelloTipiTurno';
import { PannelloStrumentiTurni } from './PannelloStrumentiTurni';
import { SelectVolontarioAffinita, StelleAffinita } from './SelectVolontarioAffinita';
import { addDaysISODate, formatDateItaly, formatISODateItaly, formatTimeItaly } from '../../utils/italianTime';

const addMonthsISODate = (iso: string, months: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return formatISODateItaly();
  return new Date(Date.UTC(y, m - 1 + months, d, 12, 0, 0)).toISOString().slice(0, 10);
};

const getDayOfWeekISO = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 1;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
};

const getEndOfMonthISO = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return formatISODateItaly();
  return new Date(Date.UTC(y, m, 0, 12, 0, 0)).toISOString().slice(0, 10);
};

const diffDaysISODate = (fromIso: string, toIso: string): number => {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const t2 = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);
  return Math.round((t2 - t1) / 86400000);
};

interface SezioneTurniProps {
  turni: TurnoSedeOperativa[];
  onAggiornaTurni: (turni: TurnoSedeOperativa[]) => void;
  sedi: SedeAssociativaCompleta[];
  volontari: Volontario[];
  mezzi?: MezzoFlotta[];
  mezziFuoriServizio?: Record<string, MezzoFuoriServizio>;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  puoGestireStrumentiTurni?: boolean; // Solo Presidente, Amministratore e Segretario
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  allowedSubtabs?: string[] | null;
}

export const SezioneTurni: React.FC<SezioneTurniProps> = ({
  turni,
  onAggiornaTurni,
  sedi,
  volontari,
  mezzi,
  mezziFuoriServizio = {},
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  puoGestireStrumentiTurni = false,
  onNotificaRadio,
  allowedSubtabs = null
}) => {
  const nomiSubCustom = useNomiSottosezioniCustom();
  const canShowSubtab = (id: string) => {
    if (id === 'strumenti') return Boolean(puoGestireStrumentiTurni);
    return !allowedSubtabs || allowedSubtabs.includes(id);
  };
  const tipiTurno = useTipiTurno();
  const [catalogoMansioni, setCatalogoMansioni] = useState(() => getMansioniCatalogo());
  useEffect(() => {
    const syncMansioni = () => setCatalogoMansioni(getMansioniCatalogo());
    window.addEventListener('croceoro_mansioni_updated', syncMansioni);
    return () => window.removeEventListener('croceoro_mansioni_updated', syncMansioni);
  }, []);
  const [vistaSottosezione, setVistaSottosezione] = useState<'calendario' | 'candidature' | 'tipi_turno' | 'strumenti'>(() => {
    if (!allowedSubtabs || allowedSubtabs.includes('calendario')) return 'calendario';
    if (allowedSubtabs.includes('candidature')) return 'candidature';
    if (allowedSubtabs.includes('tipi_turno')) return 'tipi_turno';
    return 'calendario';
  });
  // Filtri
  const [dataSelezionata, setDataSelezionata] = useState(() => formatISODateItaly());
  const [filtroSedeId, setFiltroSedeId] = useState('tutte');
  const [filtroCopertura, setFiltroCopertura] = useState('tutti');

  // Modale Nuovo / Modifica Turno
  const [modaleTurnoAperta, setModaleTurnoAperta] = useState(false);
  const [turnoInModifica, setTurnoInModifica] = useState<TurnoSedeOperativa | null>(null);
  const [formSedeId, setFormSedeId] = useState(sedi[1]?.id || sedi[0]?.id || '');
  const [formData, setFormData] = useState(() => formatISODateItaly());
  const [formTipoTurnoId, setFormTipoTurnoId] = useState('');
  const [formNomeTurno, setFormNomeTurno] = useState('');
  const [formFascia, setFormFascia] = useState<TurnoSedeOperativa['fasciaOraria']>('Mattina (08:00 - 14:00)');
  const [formInizio, setFormInizio] = useState('08:00');
  const [formFine, setFormFine] = useState('14:00');
  const [formMezzo, setFormMezzo] = useState('T4609');
  const [formAutistaId, setFormAutistaId] = useState('');
  const [formCapoId, setFormCapoId] = useState('');
  const [formSoccorritore2Id, setFormSoccorritore2Id] = useState('');
  const [formTerzoSoccorritoreId, setFormTerzoSoccorritoreId] = useState('');
  const [formCentraleId, setFormCentraleId] = useState('');
  const [formCentralinistaId, setFormCentralinistaId] = useState('');
  const [formOsservatoreId, setFormOsservatoreId] = useState('');
  const [mostraModificaEquipaggioEsistente, setMostraModificaEquipaggioEsistente] = useState(false);
  const [formChecklistObbligatoria, setFormChecklistObbligatoria] = useState(true);
  const [formNote, setFormNote] = useState('');
  const [mostraPannelloCandidature, setMostraPannelloCandidature] = useState(true);
  const [modificaModalitaSerie, setModificaModalitaSerie] = useState<'singolo' | 'serie_futura'>('singolo');
  const [turnoAzioneModal, setTurnoAzioneModal] = useState<TurnoSedeOperativa | null>(null);
  const [modalAzioneTipo, setModalAzioneTipo] = useState<'elimina' | 'modifica'>('elimina');
  const [azioneMezzoScope, setAzioneMezzoScope] = useState<'singolo' | 'serie_futura' | null>(null);
  const [mezzoNuovoScelto, setMezzoNuovoScelto] = useState<string>('');

  // Elenco mezzi operativi (esclude tutti i mezzi in manutenzione, fuori servizio o in sanificazione)
  const { mezziOperativi, sigleInManutenzione } = useMemo(() => {
    const base = mezzi && mezzi.length > 0 ? mezzi : MEZZI_FLOTTA_INIZIALI;
    const nonDisponibili = new Set<string>();
    const operativi = base
      .filter((m) => {
        const siglaKey = m.sigla.trim().toUpperCase();
        const isStatoBloccato =
          m.stato === 'In Manutenzione' ||
          m.stato === 'Fuori Servizio' ||
          m.stato === 'In Sanificazione';
        const isFuoriCentrale = Boolean(mezziFuoriServizio?.[siglaKey]);
        if (isStatoBloccato || isFuoriCentrale) {
          nonDisponibili.add(siglaKey);
          return false;
        }
        return true;
      })
      .sort((a, b) => a.sigla.localeCompare(b.sigla, 'it', { numeric: true, sensitivity: 'base' }));

    Object.keys(mezziFuoriServizio || {}).forEach((siglaKey) => {
      if (siglaKey.trim()) nonDisponibili.add(siglaKey.trim().toUpperCase());
    });

    return { mezziOperativi: operativi, sigleInManutenzione: nonDisponibili };
  }, [mezzi, mezziFuoriServizio]);

  const getDefaultMezzoOperativo = (preferito?: string): string => {
    const pref = (preferito || '').trim();
    if (pref) {
      const trovato = mezziOperativi.find((m) => m.sigla.toUpperCase() === pref.toUpperCase());
      if (trovato) return trovato.sigla;
    }
    const t4609 = mezziOperativi.find((m) => m.sigla.toUpperCase() === 'T4609');
    if (t4609) return t4609.sigla;
    const t4606 = mezziOperativi.find((m) => m.sigla.toUpperCase() === 'T4606');
    if (t4606) return t4606.sigla;
    return mezziOperativi[0]?.sigla || '';
  };

  // Helper per etichette ruoli sincronizzato LIVE con Mansioni & Competenze
  const getEtichettaRuolo = (ruolo: RuoloTurno): string => {
    if (ruolo === 'caposervizio') return '⭐ Capo Servizio';
    const live = getLabelRuoloEquipaggioLive(ruolo, catalogoMansioni);
    const pref = formatIconaPerTesto(live.emoji, '🎖️');
    return `${pref ? `${pref} ` : ''}${live.nome}`;
  };

  // Tutte le candidature in attesa di approvazione della centrale
  const tutteCandidatureInAttesa = useMemo(() => {
    return turni.flatMap((t) =>
      (t.richiesteIscrizione || [])
        .filter((c) => c.stato === 'In Attesa')
        .map((c) => ({ turno: t, candidatura: c }))
    );
  }, [turni]);

  // Tutte le proposte di cessione/scambio già accettate dal collega in attesa di approvazione finale del responsabile
  const proposteScambioInAttesaResponsabile = useMemo(() => {
    return turni.flatMap((t) =>
      (t.proposteScambio || [])
        .filter((p) => p.stato === 'In Attesa Approvazione Responsabile')
        .map((p) => ({ turno: t, proposta: p }))
    );
  }, [turni]);

  const setSlotRuoloTurno = (
    turno: TurnoSedeOperativa,
    ruolo: RuoloTurno,
    valore: { id: string; nome: string } | undefined
  ): TurnoSedeOperativa => {
    const copy: TurnoSedeOperativa = { ...turno };
    if (ruolo === 'autista') copy.autista = valore;
    else if (ruolo === 'caposervizio') copy.capoServizioBadge = valore;
    else if (ruolo === 'soccorritore2') copy.soccorritore2 = valore;
    else if (ruolo === 'terzoSoccorritore') copy.terzoSoccorritore = valore;
    else if (ruolo === 'operatoreCentrale') copy.operatoreCentrale = valore;
    else if (ruolo === 'centralinista') copy.centralinista = valore;
    else if (ruolo === 'osservatore') copy.osservatore = valore;
    copy.statoCopertura = calcolaCoperturaTurno(copy);
    return copy;
  };

  const handleApprovaPropostaScambio = (turnoId: string, proposta: PropostaScambioTurno) => {
    const operatore = operatoreCorrente || (isAdmin ? 'Amministratore' : 'Responsabile Turni');
    const aggiornati = turni.map((t) => {
      let next = t;
      if (t.id === turnoId) {
        // Sostituisce il proponente con il destinatario sul turno di origine
        next = setSlotRuoloTurno(next, proposta.ruoloProponente || proposta.ruolo || 'soccorritore2', {
          id: proposta.destinatarioId,
          nome: proposta.destinatarioNome,
        });
        next = {
          ...next,
          proposteScambio: (next.proposteScambio || []).map((p) =>
            p.id === proposta.id
              ? {
                  ...p,
                  stato: 'Approvata' as const,
                  approvataDa: operatore,
                  dataApprovazione: formatTimeItaly(undefined, false) + ' del ' + formatDateItaly(),
                }
              : p
          ),
        };
      } else if (
        proposta.modalita === 'scambio' &&
        proposta.turnoDestinatarioId &&
        proposta.ruoloDestinatario &&
        t.id === proposta.turnoDestinatarioId
      ) {
        // Completa lo scambio bidirezionale assegnando il proponente al turno del destinatario
        next = setSlotRuoloTurno(next, proposta.ruoloDestinatario, {
          id: proposta.proponenteId,
          nome: proposta.proponenteNome,
        });
      }
      return next;
    });

    onAggiornaTurni(aggiornati);
    const emails = [proposta.proponenteId, proposta.destinatarioId]
      .map((id) => volontari.find((v) => v.id === id)?.email)
      .filter(Boolean) as string[];
    inviaNotificaStrumentiTurniEmail({
      evento: 'scambio_approvato',
      titolo: `${proposta.modalita === 'scambio' ? 'Scambio' : 'Cessione'} turno approvato`,
      messaggio: `${operatore} ha approvato ${proposta.modalita === 'scambio' ? 'lo scambio' : 'la cessione'} tra ${proposta.proponenteNome} e ${proposta.destinatarioNome}. Il calendario turni è stato aggiornato.`,
      destinatariEmails: emails,
    });
    onNotificaRadio?.(
      `🔄 ${proposta.modalita === 'scambio' ? 'SCAMBIO' : 'CESSIONE'} TURNO APPROVATO: ${proposta.proponenteNome} ↔ ${proposta.destinatarioNome} convalidato da ${operatore}.`,
      'sistema'
    );
    mostraAvviso(
      `✓ ${proposta.modalita === 'scambio' ? 'Scambio' : 'Cessione'} turno tra ${proposta.proponenteNome} e ${proposta.destinatarioNome} approvato e applicato!`
    );
  };

  const handleRifiutaPropostaScambio = (turnoId: string, proposta: PropostaScambioTurno) => {
    const operatore = operatoreCorrente || (isAdmin ? 'Amministratore' : 'Responsabile Turni');
    const aggiornati = turni.map((t) => {
      if (t.id !== turnoId) return t;
      return {
        ...t,
        proposteScambio: (t.proposteScambio || []).map((p) =>
          p.id === proposta.id
            ? {
                ...p,
                stato: 'Rifiutata Responsabile' as const,
                approvataDa: operatore,
                dataApprovazione: formatTimeItaly(undefined, false) + ' del ' + formatDateItaly(),
              }
            : p
        ),
      };
    });
    onAggiornaTurni(aggiornati);
    mostraAvviso(
      `Proposta di ${proposta.modalita} tra ${proposta.proponenteNome} e ${proposta.destinatarioNome} rifiutata.`
    );
  };

  // Approvazione candidatura da parte dell'Operatore di Centrale / Admin
  const handleApprovaCandidatura = (turnoId: string, candId: string) => {
    const targetTurno = turni.find((t) => t.id === turnoId);
    if (!targetTurno) return;
    const cand = (targetTurno.richiesteIscrizione || []).find((c) => c.id === candId);
    if (!cand) return;

    // Controllo abilitazione mansione: un volontario può essere inserito solo nelle mansioni assegnate
    const vol = volontari.find((v) => v.id === cand.volontarioId);
    if (vol) {
      const verifica = puoCoprireRuoloTurno(vol, cand.ruoloRichiesto);
      if (!verifica.idoneo) {
        mostraAvviso(
          `⛔ IMPOSSIBILE APPROVARE: Il volontario ${cand.volontarioNome} non possiede la mansione necessaria per ${getEtichettaRuolo(cand.ruoloRichiesto)}. ${verifica.motivo}`
        );
        return;
      }
    }

    const operatore = operatoreCorrente || (isAdmin ? 'Amministratore' : 'Operatore Centrale');

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
        let { autista, soccorritore2, terzoSoccorritore, operatoreCentrale, centralinista, osservatore } = t;

        if (cand.ruoloRichiesto === 'autista') autista = assegnato;
        else if (cand.ruoloRichiesto === 'soccorritore2') soccorritore2 = assegnato;
        else if (cand.ruoloRichiesto === 'terzoSoccorritore') terzoSoccorritore = assegnato;
        else if (cand.ruoloRichiesto === 'operatoreCentrale') operatoreCentrale = assegnato;
        else if (cand.ruoloRichiesto === 'centralinista') centralinista = assegnato;
        else if (cand.ruoloRichiesto === 'osservatore') osservatore = assegnato;

        const turnoAggiornatoBase: TurnoSedeOperativa = {
          ...t,
          autista,
          soccorritore2,
          terzoSoccorritore,
          operatoreCentrale,
          centralinista,
          osservatore,
          richiesteIscrizione: nuoveRichieste
        };
        const statoCopertura = calcolaCoperturaTurno(turnoAggiornatoBase);

        return {
          ...turnoAggiornatoBase,
          statoCopertura
        };
      }
      return t;
    });

    onAggiornaTurni(aggiornati);
    onNotificaRadio?.(
      `✅ CANDIDATURA APPROVATA: ${cand.volontarioNome} confermato come ${getEtichettaRuolo(cand.ruoloRichiesto)} per ${targetTurno.sedeNome} del ${targetTurno.data} da ${operatore}.`,
      'centrale'
    );
    mostraAvviso(`✓ Candidatura di ${cand.volontarioNome} approvata! Volontario assegnato al turno.`);
  };

  // Rifiuto candidatura
  const handleRifiutaCandidatura = (turnoId: string, candId: string) => {
    const operatore = operatoreCorrente || (isAdmin ? 'Amministratore' : 'Operatore Centrale');
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

    onAggiornaTurni(aggiornati);
    mostraAvviso(`Candidatura contrassegnata come rifiutata.`);
  };

  // Notifiche
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Modale Tabellone Settimanale Completo
  const [mostraTabelloneSettimanaleModal, setMostraTabelloneSettimanaleModal] = useState(false);
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [inviandoPromemoria, setInviandoPromemoria] = useState(false);

  const handleInviaPromemoriaDomani = async () => {
    setInviandoPromemoria(true);
    try {
      const res = await fetch('/api/promemoria-turni/invia-ora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forzaTutti: true })
      });
      const data = await res.json();
      if (data.success) {
        mostraAvviso(`🔔 ${data.messaggio || `Inviati ${data.countInviati} promemoria per i turni di domani!`}`);
      } else {
        mostraAvviso(`⚠️ Errore invio promemoria: ${data.error || 'Errore server'}`);
      }
    } catch {
      mostraAvviso('⚠️ Impossibile comunicare con il server per inviare i promemoria.');
    } finally {
      setInviandoPromemoria(false);
    }
  };

  const urlTabelloneSenzaLogin = typeof window !== 'undefined'
    ? `${window.location.origin}/?view=monitor-turni`
    : 'https://croce-oro-massa-carrarra.vercel.app/?view=monitor-turni';

  // Helper opzioni giorni della settimana
  const GIORNI_SETTIMANA = [
    { label: 'Lun', nome: 'Lunedì', valore: 1 },
    { label: 'Mar', nome: 'Martedì', valore: 2 },
    { label: 'Mer', nome: 'Mercoledì', valore: 3 },
    { label: 'Gio', nome: 'Giovedì', valore: 4 },
    { label: 'Ven', nome: 'Venerdì', valore: 5 },
    { label: 'Sab', nome: 'Sabato', valore: 6 },
    { label: 'Dom', nome: 'Domenica', valore: 0 }
  ];

  // ---------------------------------------------------------------------------
  // GESTIONE DUPLICAZIONE TURNO & DISPONIBILITA VOLONTARI (SINGOLO / SERIE RICORRENTE)
  // ---------------------------------------------------------------------------
  const [modaleDuplicaTurnoAperta, setModaleDuplicaTurnoAperta] = useState(false);
  const [turnoDaDuplicare, setTurnoDaDuplicare] = useState<TurnoSedeOperativa | null>(null);
  // Distinzione esplicita tra Duplica Turno (struttura turno) e Duplica Disponibilità (disponibilità volontari)
  const [tipoDuplicazione, setTipoDuplicazione] = useState<'turno' | 'disponibilita'>('turno');

  // Modalità di duplicazione: 'serie' (multi-giorno su calendario) oppure 'singola' (data specifica)
  const [modalitaDuplicazione, setModalitaDuplicazione] = useState<'serie' | 'singola'>('serie');

  // Per data singola
  const [dataDestinazioneDuplicazione, setDataDestinazioneDuplicazione] = useState('');

  // Per serie programmata
  const [duplicaDataInizio, setDuplicaDataInizio] = useState('');
  const [duplicaDataFine, setDuplicaDataFine] = useState('');
  // Giorni della settimana selezionati (1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab, 0=Dom)
  const [duplicaGiorniSettimana, setDuplicaGiorniSettimana] = useState<number[]>([1, 2, 3, 4, 5]);
  // Cadenza "ogni quanti giorni" (1 = ogni giorno valido, 2 = ogni 2 giorni, 3 = ogni 3 giorni, 7 = settimanale, 14 = bisettimanale...)
  const [duplicaOgniGiorni, setDuplicaOgniGiorni] = useState<number>(1);

  // Gestione Giorni Festivi e Prefestivi
  const [regolaFestivi, setRegolaFestivi] = useState<'includi' | 'escludi' | 'solo'>('includi');
  const [regolaPrefestivi, setRegolaPrefestivi] = useState<'includi' | 'escludi' | 'solo'>('includi');

  // Comportamento rispetto ai turni ripetuti / già esistenti sulle date di destinazione
  const [gestioneTurniEsistentiDuplicazione, setGestioneTurniEsistentiDuplicazione] = useState<
    'aggiorna_solo_esistenti' | 'aggiorna_o_crea' | 'salta_esistenti'
  >('aggiorna_o_crea');
  const [sovrascriviRuoliOccupati, setSovrascriviRuoliOccupati] = useState<boolean>(false);

  // SELEZIONE VOLONTARI DA DUPLICARE ("uno o più volontari del turno esistente")
  const [ruoliSelezionatiDuplicazione, setRuoliSelezionatiDuplicazione] = useState<{
    autista: boolean;
    caposervizio: boolean;
    soccorritore2: boolean;
    terzoSoccorritore: boolean;
    operatoreCentrale: boolean;
    centralinista: boolean;
    osservatore: boolean;
  }>({
    autista: true,
    caposervizio: true,
    soccorritore2: true,
    terzoSoccorritore: true,
    operatoreCentrale: true,
    centralinista: true,
    osservatore: true
  });

  const toggleRuoloDuplicazione = (ruolo: keyof typeof ruoliSelezionatiDuplicazione) => {
    setRuoliSelezionatiDuplicazione((prev) => ({
      ...prev,
      [ruolo]: !prev[ruolo]
    }));
  };

  const selezionaTuttiRuoli = () => {
    if (!turnoDaDuplicare) return;
    setRuoliSelezionatiDuplicazione({
      autista: Boolean(turnoDaDuplicare.autista),
      caposervizio: Boolean(turnoDaDuplicare.caposervizio),
      soccorritore2: Boolean(turnoDaDuplicare.soccorritore2),
      terzoSoccorritore: Boolean(turnoDaDuplicare.terzoSoccorritore),
      operatoreCentrale: Boolean(turnoDaDuplicare.operatoreCentrale),
      centralinista: Boolean(turnoDaDuplicare.centralinista),
      osservatore: Boolean(turnoDaDuplicare.osservatore)
    });
  };

  const deselezionaTuttiRuoli = () => {
    setRuoliSelezionatiDuplicazione({
      autista: false,
      caposervizio: false,
      soccorritore2: false,
      terzoSoccorritore: false,
      operatoreCentrale: false,
      centralinista: false,
      osservatore: false
    });
  };

  const toggleGiornoDuplicazione = (valore: number) => {
    if (duplicaGiorniSettimana.includes(valore)) {
      if (duplicaGiorniSettimana.length === 1) return; // Mantieni almeno un giorno selezionato
      setDuplicaGiorniSettimana(duplicaGiorniSettimana.filter((g) => g !== valore));
    } else {
      setDuplicaGiorniSettimana([...duplicaGiorniSettimana, valore].sort());
    }
  };

  const impostaCadenzaGiorni = (valoreRaw: number) => {
    const val = Math.max(1, Math.min(90, Math.floor(Number(valoreRaw) || 1)));
    setDuplicaOgniGiorni(val);
    // Se l'utente sceglie una cadenza non multipla di 7 (es. ogni 2, 3, 4 giorni) e aveva un solo giorno della settimana attivo,
    // abilita automaticamente tutti i giorni della settimana così la cadenza produce subito risultati visibili (può comunque escludere giorni dopo).
    if (val > 1 && val % 7 !== 0 && duplicaGiorniSettimana.length === 1) {
      setDuplicaGiorniSettimana([1, 2, 3, 4, 5, 6, 0]);
    }
  };

  const trovaTurnoCorrispondenteData = (
    origine: TurnoSedeOperativa,
    dataTarget: string,
    listaTurni: TurnoSedeOperativa[]
  ): TurnoSedeOperativa | undefined => {
    const turniDelGiorno = listaTurni.filter((x) => x.data === dataTarget && x.id !== origine.id);
    if (turniDelGiorno.length === 0) return undefined;

    if (origine.serieId) {
      const stessoSerieId = turniDelGiorno.find((x) => x.serieId === origine.serieId);
      if (stessoSerieId) return stessoSerieId;
    }

    const nomeOrigNorm = (origine.nomeTurno || '').trim().toLowerCase();
    const matchEsatto = turniDelGiorno.find(
      (x) =>
        x.sedeId === origine.sedeId &&
        x.fasciaOraria === origine.fasciaOraria &&
        x.orarioInizio === origine.orarioInizio &&
        x.orarioFine === origine.orarioFine &&
        (x.nomeTurno || '').trim().toLowerCase() === nomeOrigNorm
    );
    if (matchEsatto) return matchEsatto;

    return turniDelGiorno.find(
      (x) =>
        x.sedeId === origine.sedeId &&
        x.fasciaOraria === origine.fasciaOraria &&
        x.orarioInizio === origine.orarioInizio &&
        x.orarioFine === origine.orarioFine
    ) || turniDelGiorno.find(
      (x) => x.sedeId === origine.sedeId && x.fasciaOraria === origine.fasciaOraria
    );
  };

  const avviaDuplicazioneTurno = (
    t: TurnoSedeOperativa,
    tipo: 'turno' | 'disponibilita' = 'turno'
  ) => {
    setTurnoDaDuplicare(t);
    setTipoDuplicazione(tipo);
    setModalitaDuplicazione('serie');

    // Rileva se il turno fa parte di una serie ripetuta con turni futuri già in calendario
    const serieTurni = trovaTurniSerie(t, turni);
    const futuriSerie = serieTurni.filter((x) => x.data > t.data);
    const isTurnoRipetutoConFuturi = futuriSerie.length > 0;

    // Default per data singola
    try {
      setDataDestinazioneDuplicazione(
        isTurnoRipetutoConFuturi ? futuriSerie[0].data : addDaysISODate(t.data, 1)
      );
    } catch {
      setDataDestinazioneDuplicazione(t.data);
    }

    // Default per serie programmata (ancorato alla data del turno così "ogni N giorni" conta da questo turno)
    try {
      setDuplicaDataInizio(t.data);
      if (isTurnoRipetutoConFuturi) {
        setDuplicaDataFine(futuriSerie[futuriSerie.length - 1].data);
        setDuplicaGiorniSettimana([1, 2, 3, 4, 5, 6, 0]);
      } else {
        setDuplicaDataFine(addDaysISODate(t.data, 30));
        setDuplicaGiorniSettimana([getDayOfWeekISO(t.data)]);
      }
    } catch {
      const oggiIso = formatISODateItaly();
      setDuplicaDataInizio(oggiIso);
      setDuplicaDataFine(addDaysISODate(oggiIso, 30));
      setDuplicaGiorniSettimana([1, 2, 3, 4, 5]);
    }

    setDuplicaOgniGiorni(1);
    setRegolaFestivi('includi');
    setRegolaPrefestivi('includi');
    setGestioneTurniEsistentiDuplicazione(
      tipo === 'disponibilita'
        ? isTurnoRipetutoConFuturi
          ? 'aggiorna_solo_esistenti'
          : 'aggiorna_o_crea'
        : isTurnoRipetutoConFuturi
        ? 'salta_esistenti'
        : 'aggiorna_o_crea'
    );
    setSovrascriviRuoliOccupati(false);

    // Inizializza i ruoli da duplicare selezionando quelli effettivamente presenti nel turno modello
    setRuoliSelezionatiDuplicazione({
      autista: Boolean(t.autista),
      caposervizio: Boolean(t.caposervizio),
      soccorritore2: Boolean(t.soccorritore2),
      terzoSoccorritore: Boolean(t.terzoSoccorritore),
      operatoreCentrale: Boolean(t.operatoreCentrale),
      centralinista: Boolean(t.centralinista),
      osservatore: Boolean(t.osservatore)
    });

    setModaleDuplicaTurnoAperta(true);
  };

  // Calcolo dinamico date generate / turni ripetuti da aggiornare per la duplicazione
  const dateDuplicazionePreview = useMemo(() => {
    if (!turnoDaDuplicare) return [];

    type PreviewItem = {
      data: string;
      isFestivo: boolean;
      motivoFestivo?: string;
      isPrefestivo: boolean;
      motivoPrefestivo?: string;
      esisteGia: boolean;
      turnoEsistenteId?: string;
      azione: 'aggiorna' | 'crea' | 'salta';
    };

    if (modalitaDuplicazione === 'singola') {
      if (!dataDestinazioneDuplicazione || dataDestinazioneDuplicazione === turnoDaDuplicare.data) return [];
      const fest = isGiornoFestivo(dataDestinazioneDuplicazione);
      const prefest = isGiornoPrefestivo(dataDestinazioneDuplicazione);
      const esistente = trovaTurnoCorrispondenteData(turnoDaDuplicare, dataDestinazioneDuplicazione, turni);
      const azione: PreviewItem['azione'] = esistente
        ? gestioneTurniEsistentiDuplicazione === 'salta_esistenti'
          ? 'salta'
          : 'aggiorna'
        : gestioneTurniEsistentiDuplicazione === 'aggiorna_solo_esistenti'
        ? 'salta'
        : 'crea';
      return [{
        data: dataDestinazioneDuplicazione,
        isFestivo: fest.isFestivo,
        motivoFestivo: fest.motivo,
        isPrefestivo: prefest.isPrefestivo,
        motivoPrefestivo: prefest.motivo,
        esisteGia: Boolean(esistente),
        turnoEsistenteId: esistente?.id,
        azione
      }];
    }

    if (!duplicaDataInizio || !duplicaDataFine || duplicaDataFine < duplicaDataInizio) return [];

    const risultato: PreviewItem[] = [];
    const passoGiorni = Math.max(1, Math.min(90, Math.floor(duplicaOgniGiorni || 1)));

    let curStr = duplicaDataInizio;
    let count = 0;
    while (curStr <= duplicaDataFine && count < 366) {
      // Non ri-applicare sulla data stessa del turno sorgente
      if (curStr !== turnoDaDuplicare.data) {
        const diffFromStart = diffDaysISODate(duplicaDataInizio, curStr);
        const rispettaCadenza = passoGiorni <= 1 || (diffFromStart >= 0 && diffFromStart % passoGiorni === 0);

        if (rispettaCadenza) {
          const dayOfWeek = getDayOfWeekISO(curStr);
          const fest = isGiornoFestivo(curStr);
          const prefest = isGiornoPrefestivo(curStr);

          let includeGiorno = true;

          // 1. Controllo Festivi
          if (regolaFestivi === 'escludi' && fest.isFestivo) {
            includeGiorno = false;
          } else if (regolaFestivi === 'solo' && !fest.isFestivo) {
            includeGiorno = false;
          }

          // 2. Controllo Prefestivi
          if (regolaPrefestivi === 'escludi' && prefest.isPrefestivo) {
            includeGiorno = false;
          } else if (regolaPrefestivi === 'solo' && !prefest.isPrefestivo) {
            includeGiorno = false;
          }

          // 3. Controllo Giorni Settimana
          if (includeGiorno && !duplicaGiorniSettimana.includes(dayOfWeek)) {
            includeGiorno = false;
          }

          if (includeGiorno) {
            const esistente = trovaTurnoCorrispondenteData(turnoDaDuplicare, curStr, turni);

            if (gestioneTurniEsistentiDuplicazione === 'aggiorna_solo_esistenti') {
              if (esistente) {
                risultato.push({
                  data: curStr,
                  isFestivo: fest.isFestivo,
                  motivoFestivo: fest.motivo,
                  isPrefestivo: prefest.isPrefestivo,
                  motivoPrefestivo: prefest.motivo,
                  esisteGia: true,
                  turnoEsistenteId: esistente.id,
                  azione: 'aggiorna'
                });
              }
            } else {
              const azione: PreviewItem['azione'] = esistente
                ? gestioneTurniEsistentiDuplicazione === 'salta_esistenti'
                  ? 'salta'
                  : 'aggiorna'
                : 'crea';
              risultato.push({
                data: curStr,
                isFestivo: fest.isFestivo,
                motivoFestivo: fest.motivo,
                isPrefestivo: prefest.isPrefestivo,
                motivoPrefestivo: prefest.motivo,
                esisteGia: Boolean(esistente),
                turnoEsistenteId: esistente?.id,
                azione
              });
            }
          }
        }
      }

      curStr = addDaysISODate(curStr, 1);
      count++;
    }

    return risultato;
  }, [
    modalitaDuplicazione,
    dataDestinazioneDuplicazione,
    duplicaDataInizio,
    duplicaDataFine,
    duplicaGiorniSettimana,
    duplicaOgniGiorni,
    regolaFestivi,
    regolaPrefestivi,
    gestioneTurniEsistentiDuplicazione,
    turnoDaDuplicare,
    turni
  ]);

  const confermaDuplicazioneSingoloTurno = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoDaDuplicare) return;

    const itemDaAggiornare = dateDuplicazionePreview.filter((d) => d.azione === 'aggiorna' && d.turnoEsistenteId);
    const itemDaCreare = dateDuplicazionePreview.filter((d) => d.azione === 'crea');

    if (itemDaAggiornare.length === 0 && itemDaCreare.length === 0) {
      mostraAvviso('Nessuna data o turno ripetuto valido corrisponde ai filtri selezionati.');
      return;
    }

    const t = turnoDaDuplicare;

    // Duplicazione selettiva dell'equipaggio in base ai volontari selezionati
    const autistaEffettivo = ruoliSelezionatiDuplicazione.autista ? t.autista : undefined;
    const socc2Effettivo = ruoliSelezionatiDuplicazione.soccorritore2 ? t.soccorritore2 : undefined;
    const terzoEffettivo = ruoliSelezionatiDuplicazione.terzoSoccorritore ? t.terzoSoccorritore : undefined;
    const centraleEffettivo = ruoliSelezionatiDuplicazione.operatoreCentrale ? t.operatoreCentrale : undefined;
    const centralinistaEffettivo = ruoliSelezionatiDuplicazione.centralinista ? t.centralinista : undefined;
    const osservatoreEffettivo = ruoliSelezionatiDuplicazione.osservatore ? t.osservatore : undefined;

    const capoOriginale = getCapoServizioTurno(t);
    const volontariDuplicatiIds = new Set(
      [autistaEffettivo, socc2Effettivo, terzoEffettivo, centraleEffettivo, centralinistaEffettivo, osservatoreEffettivo]
        .filter(Boolean)
        .map((s) => s!.id)
    );
    const capoServizioBadgeEffettivo =
      capoOriginale && volontariDuplicatiIds.has(capoOriginale.id) ? capoOriginale : undefined;

    const ruoliSelezionatiCoppie: Array<{
      chiave: 'autista' | 'soccorritore2' | 'terzoSoccorritore' | 'operatoreCentrale' | 'centralinista' | 'osservatore';
      vol?: { id: string; nome: string };
    }> = [
      { chiave: 'autista', vol: autistaEffettivo },
      { chiave: 'soccorritore2', vol: socc2Effettivo },
      { chiave: 'terzoSoccorritore', vol: terzoEffettivo },
      { chiave: 'operatoreCentrale', vol: centraleEffettivo },
      { chiave: 'centralinista', vol: centralinistaEffettivo },
      { chiave: 'osservatore', vol: osservatoreEffettivo },
    ];

    const haAlmenoUnVolontarioSelezionato = ruoliSelezionatiCoppie.some((r) => Boolean(r.vol));
    if (tipoDuplicazione === 'disponibilita' && !haAlmenoUnVolontarioSelezionato) {
      mostraAvviso(
        '⚠️ Seleziona almeno un volontario di cui duplicare la disponibilità (se il turno non ha volontari assegnati, aggiungili prima da Modifica).'
      );
      return;
    }
    if (itemDaCreare.length === 0 && !haAlmenoUnVolontarioSelezionato) {
      mostraAvviso('⚠️ Seleziona almeno un volontario da duplicare nei turni ripetuti esistenti.');
      return;
    }

    // 1. Aggiorna i turni ripetuti / esistenti inserendo solo i volontari selezionati (preservando gli altri volontari già presenti)
    const idsDaAggiornare = new Set(itemDaAggiornare.map((d) => d.turnoEsistenteId!));
    let turniEffettivamenteAggiornati = 0;

    const turniBaseAggiornati = turni.map((ex) => {
      if (!idsDaAggiornare.has(ex.id)) return ex;
      const next: TurnoSedeOperativa = { ...ex };
      let cambiato = false;

      const presentiSuTarget = new Set(
        [next.autista, next.soccorritore2, next.terzoSoccorritore, next.operatoreCentrale, next.centralinista, next.osservatore]
          .filter(Boolean)
          .map((v) => v!.id)
      );

      for (const { chiave, vol } of ruoliSelezionatiCoppie) {
        if (!vol) continue;
        const corrente = next[chiave];
        if (corrente?.id === vol.id) continue;
        // Evita di duplicare lo stesso volontario su due ruoli diversi nello stesso turno
        if (presentiSuTarget.has(vol.id) && (!corrente || corrente.id !== vol.id)) continue;
        if (!corrente || sovrascriviRuoliOccupati) {
          if (corrente) presentiSuTarget.delete(corrente.id);
          next[chiave] = { ...vol };
          presentiSuTarget.add(vol.id);
          cambiato = true;
        }
      }

      if (capoServizioBadgeEffettivo && presentiSuTarget.has(capoServizioBadgeEffettivo.id)) {
        const capoCorrente = getCapoServizioTurno(next);
        if (!capoCorrente || sovrascriviRuoliOccupati) {
          next.capoServizioBadge = { ...capoServizioBadgeEffettivo };
          cambiato = true;
        }
      }

      if (cambiato) {
        next.statoCopertura = calcolaCoperturaTurno(next);
        turniEffettivamenteAggiornati++;
      }
      return next;
    });

    // 2. Crea eventuali nuovi turni per le date senza turno (se modalità aggiorna_o_crea / salta_esistenti)
    const statoCoperturaNuovi = calcolaCoperturaTurno({
      mansioniRichieste: t.mansioniRichieste,
      autista: autistaEffettivo,
      soccorritore2: socc2Effettivo,
      terzoSoccorritore: terzoEffettivo,
      operatoreCentrale: centraleEffettivo,
      centralinista: centralinistaEffettivo,
      osservatore: osservatoreEffettivo
    });

    const nuoviTurniGenerati: TurnoSedeOperativa[] = itemDaCreare.map((item, idx) => ({
      id: `turno-dupl-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      serieId: t.serieId,
      sedeId: t.sedeId,
      sedeNome: t.sedeNome,
      nomeTurno: t.nomeTurno, // Mezzo e nome rimangono esattamente lo stesso
      tipoTurnoId: t.tipoTurnoId,
      tipoTurnoNome: t.tipoTurnoNome,
      mansioniRichieste: t.mansioniRichieste ? t.mansioniRichieste.map((m) => ({ ...m })) : undefined,
      mezzoAssegnato: t.mezzoAssegnato, // Mezzo assegnato preservato
      data: item.data,
      fasciaOraria: t.fasciaOraria,
      orarioInizio: t.orarioInizio,
      orarioFine: t.orarioFine,
      statoCopertura: statoCoperturaNuovi,
      capoServizioBadge: capoServizioBadgeEffettivo,
      autista: autistaEffettivo,
      caposervizio: undefined,
      soccorritore2: socc2Effettivo,
      terzoSoccorritore: terzoEffettivo,
      operatoreCentrale: centraleEffettivo,
      centralinista: centralinistaEffettivo,
      osservatore: osservatoreEffettivo,
      checklistObbligatoria: t.checklistObbligatoria !== false,
      note: t.note
    }));

    onAggiornaTurni([...turniBaseAggiornati, ...nuoviTurniGenerati]);

    const volontariDuplicatiNomi = Array.from(
      new Set(
        [
          autistaEffettivo?.nome,
          socc2Effettivo?.nome,
          terzoEffettivo?.nome,
          centraleEffettivo?.nome,
          centralinistaEffettivo?.nome,
          osservatoreEffettivo?.nome
        ].filter(Boolean) as string[]
      )
    );

    const descVol = volontariDuplicatiNomi.length > 0
      ? `con ${volontariDuplicatiNomi.length} disponibilità (${volontariDuplicatiNomi.slice(0, 3).join(', ')}${volontariDuplicatiNomi.length > 3 ? '...' : ''})`
      : 'con equipaggio azzerato per nuove candidature';

    const descCadenza = duplicaOgniGiorni > 1 ? ` (ogni ${duplicaOgniGiorni} giorni)` : '';

    if (itemDaAggiornare.length > 0 && nuoviTurniGenerati.length > 0) {
      onNotificaRadio?.(
        `📋 DUPLICAZIONE DISPONIBILITÀ: Aggiornati ${turniEffettivamenteAggiornati} turni esistenti e creati ${nuoviTurniGenerati.length} nuovi turni${descCadenza} per ${t.sedeNome} ${descVol}`,
        'sistema'
      );
      mostraAvviso(
        `✓ Disponibilità duplicate${descCadenza}: aggiornati ${turniEffettivamenteAggiornati} turni ripetuti esistenti e creati ${nuoviTurniGenerati.length} nuovi turni.`
      );
    } else if (itemDaAggiornare.length > 0) {
      onNotificaRadio?.(
        `📋 DISPONIBILITÀ SU TURNI RIPETUTI: Inserite su ${turniEffettivamenteAggiornati} turni esistenti${descCadenza} (${t.nomeTurno || t.fasciaOraria}) per ${t.sedeNome} ${descVol}`,
        'sistema'
      );
      mostraAvviso(
        turniEffettivamenteAggiornati > 0
          ? `✓ Disponibilità di ${volontariDuplicatiNomi.join(', ')} duplicate su ${turniEffettivamenteAggiornati} turni ripetuti esistenti${descCadenza}.`
          : `ℹ️ Nessun turno modificato: i ruoli nei ${itemDaAggiornare.length} turni selezionati erano già occupati (attiva "Sostituisci ruoli già occupati" se desideri sovrascriverli).`
      );
    } else {
      onNotificaRadio?.(
        `📋 DUPLICAZIONE TURNI: Generati ${nuoviTurniGenerati.length} turni${descCadenza} (${t.nomeTurno || t.fasciaOraria}) Mezzo ${t.mezzoAssegnato || 'N/D'} per ${t.sedeNome} ${descVol}`,
        'sistema'
      );
      mostraAvviso(
        `✓ Generati con successo ${nuoviTurniGenerati.length} turni duplicati${descCadenza} per ${t.sedeNome} con Mezzo ${t.mezzoAssegnato || 'N/D'} e Nome Turno preservati.`
      );
    }

    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'turni',
        'Duplicazione disponibilità volontari',
        `Duplicati ${volontariDuplicatiNomi.join(', ') || 'turni vuoti'} su ${turniEffettivamenteAggiornati} turni esistenti e ${nuoviTurniGenerati.length} nuovi turni (${t.sedeNome})${descCadenza}`,
        operatoreCorrente
      );
    }

    setModaleDuplicaTurnoAperta(false);
    setTurnoDaDuplicare(null);
  };

  // ---------------------------------------------------------------------------
  // GESTIONE CREAZIONE TURNI RIPETUTI (RICORRENZA PROGRAMMATA)
  // ---------------------------------------------------------------------------
  const [modaleTurniRipetutiAperta, setModaleTurniRipetutiAperta] = useState(false);
  const [ripSedeId, setRipSedeId] = useState(sedi[0]?.id || '');
  const [ripTipoTurnoId, setRipTipoTurnoId] = useState('');
  const [ripNomeTurno, setRipNomeTurno] = useState('');
  const [ripFascia, setRipFascia] = useState<TurnoSedeOperativa['fasciaOraria']>('Mattina (08:00 - 14:00)');
  const [ripInizio, setRipInizio] = useState('08:00');
  const [ripFine, setRipFine] = useState('14:00');
  const [ripMezzo, setRipMezzo] = useState('T4606');
  const [ripDataInizio, setRipDataInizio] = useState(() => formatISODateItaly());
  const [ripDataFine, setRipDataFine] = useState(() => addDaysISODate(formatISODateItaly(), 30));
  // Giorni della settimana selezionati (1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab, 0=Dom)
  const [ripGiorniSettimana, setRipGiorniSettimana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [ripDuplicaDisponibilita, setRipDuplicaDisponibilita] = useState(false);
  const [ripAutistaId, setRipAutistaId] = useState('');
  const [ripCapoId, setRipCapoId] = useState('');
  const [ripSocc2Id, setRipSocc2Id] = useState('');
  const [ripTerzoId, setRipTerzoId] = useState('');
  const [ripCentraleId, setRipCentraleId] = useState('');
  const [ripCentralinistaId, setRipCentralinistaId] = useState('');
  const [ripOsservatoreId, setRipOsservatoreId] = useState('');
  const [ripChecklistObbligatoria, setRipChecklistObbligatoria] = useState(true);
  const [ripNote, setRipNote] = useState('');


  const toggleGiornoSettimana = (valore: number) => {
    if (ripGiorniSettimana.includes(valore)) {
      if (ripGiorniSettimana.length === 1) return; // Mantieni almeno un giorno selezionato
      setRipGiorniSettimana(ripGiorniSettimana.filter((g) => g !== valore));
    } else {
      setRipGiorniSettimana([...ripGiorniSettimana, valore].sort());
    }
  };

  // Calcolo delle date corrispondenti alla ripetizione
  const dateRipetutePreview = useMemo(() => {
    if (!ripDataInizio || !ripDataFine || ripGiorniSettimana.length === 0 || ripDataFine < ripDataInizio) return [];

    const risultato: string[] = [];
    let curStr = ripDataInizio;
    let count = 0;
    while (curStr <= ripDataFine && count < 366) {
      const dayOfWeek = getDayOfWeekISO(curStr);
      if (ripGiorniSettimana.includes(dayOfWeek)) {
        risultato.push(curStr);
      }
      curStr = addDaysISODate(curStr, 1);
      count++;
    }
    return risultato;
  }, [ripDataInizio, ripDataFine, ripGiorniSettimana]);

  const avviaProgrammazioneTurniRipetuti = (turnoBase?: TurnoSedeOperativa) => {
    if (turnoBase) {
      setRipSedeId(turnoBase.sedeId);
      setRipTipoTurnoId(turnoBase.tipoTurnoId || tipiTurno[0]?.id || '');
      setRipNomeTurno(turnoBase.nomeTurno || '');
      setRipFascia(turnoBase.fasciaOraria);
      setRipInizio(turnoBase.orarioInizio);
      setRipFine(turnoBase.orarioFine);
      setRipMezzo(getDefaultMezzoOperativo(turnoBase.mezzoAssegnato));
      setRipDataInizio(turnoBase.data);
      try {
        setRipDataFine(addDaysISODate(turnoBase.data, 30));
        setRipGiorniSettimana([getDayOfWeekISO(turnoBase.data)]);
      } catch {
        setRipDataFine(addDaysISODate(formatISODateItaly(), 30));
        setRipGiorniSettimana([1, 2, 3, 4, 5]);
      }
      setRipAutistaId('');
      setRipCapoId('');
      setRipSocc2Id('');
      setRipTerzoId('');
      setRipCentraleId('');
      setRipCentralinistaId('');
      setRipOsservatoreId('');
      setRipChecklistObbligatoria(turnoBase.checklistObbligatoria !== false);
      setRipNote(turnoBase.note || '');
      setRipDuplicaDisponibilita(false);
    } else {
      setRipSedeId(sedi[0]?.id || '');
      setRipTipoTurnoId(tipiTurno[0]?.id || '');
      setRipNomeTurno('');
      setRipFascia('Mattina (08:00 - 14:00)');
      setRipInizio('08:00');
      setRipFine('14:00');
      setRipMezzo(getDefaultMezzoOperativo('T4606'));
      setRipDataInizio(dataSelezionata);
      try {
        setRipDataFine(addDaysISODate(dataSelezionata, 30));
      } catch {
        setRipDataFine(addDaysISODate(formatISODateItaly(), 30));
      }
      setRipGiorniSettimana([1, 2, 3, 4, 5]);
      setRipAutistaId('');
      setRipCapoId('');
      setRipSocc2Id('');
      setRipTerzoId('');
      setRipCentraleId('');
      setRipCentralinistaId('');
      setRipOsservatoreId('');
      setRipChecklistObbligatoria(true);
      setRipNote('');
      setRipDuplicaDisponibilita(false);
    }
    setModaleTurniRipetutiAperta(true);
  };

  const handleConfermaTurniRipetuti = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTurnoPulito = ripNomeTurno.trim();
    if (!nomeTurnoPulito) {
      mostraAvviso('⚠️ Inserisci il Nome Turno (campo obbligatorio).');
      return;
    }
    const tipoSelezionato = tipiTurno.find((tp) => tp.id === ripTipoTurnoId);
    if (tipiTurno.length > 0 && !tipoSelezionato) {
      mostraAvviso('⚠️ Seleziona un Tipo di Turno prima di generare la serie.');
      return;
    }
    if (dateRipetutePreview.length === 0) {
      mostraAvviso('⚠️ Nessun giorno valido corrisponde ai criteri selezionati nel periodo.');
      return;
    }

    const sedeObj = sedi.find((s) => s.id === ripSedeId) || sedi[0];
    const mezzoValido = ripMezzo && !sigleInManutenzione.has(ripMezzo.trim().toUpperCase())
      ? ripMezzo.trim()
      : undefined;

    const serieIdCondiviso =
      dateRipetutePreview.length > 1
        ? `serie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : undefined;

    const mansioniSnapshot = tipoSelezionato
      ? tipoSelezionato.mansioniObbligatorie.map((m) => ({ ...m }))
      : undefined;

    const nuoviTurniGenerati: TurnoSedeOperativa[] = dateRipetutePreview.map((dStr, idx) => ({
      id: `turno-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      serieId: serieIdCondiviso,
      sedeId: sedeObj?.id || 'sede-massa-lejare',
      sedeNome: sedeObj?.nome || 'Sede Operativa Massa',
      nomeTurno: nomeTurnoPulito,
      tipoTurnoId: tipoSelezionato?.id,
      tipoTurnoNome: tipoSelezionato?.nome,
      mansioniRichieste: mansioniSnapshot,
      data: dStr,
      fasciaOraria: ripFascia,
      orarioInizio: ripInizio,
      orarioFine: ripFine,
      mezzoAssegnato: mezzoValido,
      statoCopertura: 'Scoperto',
      richiesteIscrizione: [],
      checklistObbligatoria: ripChecklistObbligatoria,
      note: ripNote
    }));

    onAggiornaTurni([...turni, ...nuoviTurniGenerati]);
    onNotificaRadio?.(
      `🔁 TURNI RIPETUTI: Generati ${nuoviTurniGenerati.length} turni ripetuti (${nomeTurnoPulito}${tipoSelezionato ? ` · ${tipoSelezionato.nome}` : ''}) per ${sedeObj?.nome} fino al ${ripDataFine}`,
      'sistema'
    );
    mostraAvviso(`✓ Generati con successo ${nuoviTurniGenerati.length} turni ripetuti fino al ${ripDataFine}.`);
    setModaleTurniRipetutiAperta(false);
  };

  // Individua tutti i turni appartenenti alla stessa serie (tramite serieId esplicito o fallback compatibile per turni ripetuti precedenti)
  const trovaTurniSerie = (turno: TurnoSedeOperativa, lista: TurnoSedeOperativa[]): TurnoSedeOperativa[] => {
    if (turno.serieId) {
      return lista
        .filter((t) => t.serieId === turno.serieId)
        .sort((a, b) => a.data.localeCompare(b.data));
    }
    const nomeNorm = (turno.nomeTurno || '').trim().toLowerCase();
    const simili = lista.filter(
      (t) =>
        t.sedeId === turno.sedeId &&
        t.fasciaOraria === turno.fasciaOraria &&
        t.orarioInizio === turno.orarioInizio &&
        t.orarioFine === turno.orarioFine &&
        (t.nomeTurno || '').trim().toLowerCase() === nomeNorm
    );
    const dateDistinte = new Set(simili.map((t) => t.data));
    if (dateDistinte.size >= 2) {
      return simili.sort((a, b) => a.data.localeCompare(b.data));
    }
    return [turno];
  };

  // Navigazione giorno precedente / successivo
  const cambiaGiorno = (delta: number) => {
    setDataSelezionata(addDaysISODate(dataSelezionata, delta));
  };

  // Assegnazione / revoca del badge di Capo Servizio a qualsiasi volontario assegnato al turno (indipendentemente dalla mansione)
  const handleAssegnaBadgeCapoServizio = (
    turnoId: string,
    volontarioTarget: { id: string; nome: string } | null
  ) => {
    const targetTurno = turni.find((t) => t.id === turnoId);
    if (!targetTurno) return;
    const aggiornati = turni.map((t) => {
      if (t.id !== turnoId) return t;
      return {
        ...t,
        capoServizioBadge: volontarioTarget ? { id: volontarioTarget.id, nome: volontarioTarget.nome } : undefined,
        caposervizio: undefined
      };
    });
    onAggiornaTurni(aggiornati);
    if (volontarioTarget) {
      onNotificaRadio?.(
        `⭐ CAPO SERVIZIO ASSEGNATO: ${volontarioTarget.nome} nominato Capo Servizio per il turno "${targetTurno.nomeTurno || targetTurno.fasciaOraria}" del ${formatDateItaly(targetTurno.data)} (${targetTurno.sedeNome}).`,
        'centrale'
      );
      mostraAvviso(`⭐ Badge Capo Servizio assegnato a ${volontarioTarget.nome} (la sua firma apparirà sui fogli di servizio).`);
    } else {
      mostraAvviso('Badge Capo Servizio rimosso dal turno.');
    }
  };

  // Salva Turno
  const handleSalvaTurno = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTurnoPulito = formNomeTurno.trim();
    if (!nomeTurnoPulito) {
      mostraAvviso('⚠️ Inserisci il Nome Turno (campo obbligatorio).');
      return;
    }

    const tipoSelezionato = tipiTurno.find((tp) => tp.id === formTipoTurnoId);
    if (!turnoInModifica && tipiTurno.length > 0 && !tipoSelezionato) {
      mostraAvviso('⚠️ Seleziona un Tipo di Turno prima di salvare.');
      return;
    }

    const sedeObj = sedi.find((s) => s.id === formSedeId) || sedi[0];
    const mezzoValido = formMezzo && !sigleInManutenzione.has(formMezzo.trim().toUpperCase())
      ? formMezzo.trim()
      : undefined;

    if (turnoInModifica) {
      const autistaObj = volontari.find((v) => v.id === formAutistaId);
      const socc2Obj = volontari.find((v) => v.id === formSoccorritore2Id);
      const terzoObj = volontari.find((v) => v.id === formTerzoSoccorritoreId);
      const centraleObj = volontari.find((v) => v.id === formCentraleId);
      const centralinistaObj = volontari.find((v) => v.id === formCentralinistaId);
      const osservatoreObj = volontari.find((v) => v.id === formOsservatoreId);

      if (autistaObj) {
        const vAut = puoCoprireRuoloTurno(autistaObj, 'autista');
        if (!vAut.idoneo) {
          mostraAvviso(`⛔ ${autistaObj.nome} ${autistaObj.cognome} non possiede la mansione di Autista.`);
          return;
        }
      }
      if (socc2Obj) {
        const vSocc2 = puoCoprireRuoloTurno(socc2Obj, 'soccorritore2');
        if (!vSocc2.idoneo) {
          mostraAvviso(`⛔ ${socc2Obj.nome} ${socc2Obj.cognome} non possiede la mansione di 2° Soccorritore.`);
          return;
        }
      }
      if (terzoObj) {
        const vTerzo = puoCoprireRuoloTurno(terzoObj, 'terzosoccorritore');
        if (!vTerzo.idoneo) {
          mostraAvviso(`⛔ ${terzoObj.nome} ${terzoObj.cognome} non possiede la mansione richiesta per 3° Soccorritore.`);
          return;
        }
      }
      if (centraleObj) {
        const vCent = puoCoprireRuoloTurno(centraleObj, 'operatorecentrale');
        if (!vCent.idoneo) {
          mostraAvviso(`⛔ ${centraleObj.nome} ${centraleObj.cognome} non possiede la mansione di Operatore Centrale.`);
          return;
        }
      }
      if (centralinistaObj) {
        const vCentr = puoCoprireRuoloTurno(centralinistaObj, 'centralinista');
        if (!vCentr.idoneo) {
          mostraAvviso(`⛔ ${centralinistaObj.nome} ${centralinistaObj.cognome} non possiede la mansione di Centralinista.`);
          return;
        }
      }

      const autistaSlot = autistaObj ? { id: autistaObj.id, nome: `${autistaObj.nome} ${autistaObj.cognome}` } : undefined;
      const socc2Slot = socc2Obj ? { id: socc2Obj.id, nome: `${socc2Obj.nome} ${socc2Obj.cognome}` } : undefined;
      const terzoSlot = terzoObj ? { id: terzoObj.id, nome: `${terzoObj.nome} ${terzoObj.cognome}` } : undefined;
      const centraleSlot = centraleObj ? { id: centraleObj.id, nome: `${centraleObj.nome} ${centraleObj.cognome}` } : undefined;
      const centralinistaSlot = centralinistaObj ? { id: centralinistaObj.id, nome: `${centralinistaObj.nome} ${centralinistaObj.cognome}` } : undefined;
      const osservatoreSlot = osservatoreObj ? { id: osservatoreObj.id, nome: `${osservatoreObj.nome} ${osservatoreObj.cognome}` } : undefined;

      // Il badge Capo Servizio può essere assegnato a qualsiasi volontario presente nel turno, indipendentemente dalla mansione
      const slotsAssegnati = [autistaSlot, socc2Slot, terzoSlot, centraleSlot, centralinistaSlot, osservatoreSlot].filter(Boolean) as Array<{ id: string; nome: string }>;
      const capoBadgeObj = formCapoId ? slotsAssegnati.find((s) => s.id === formCapoId) : undefined;

      const targetIds = new Set<string>([turnoInModifica.id]);
      if (modificaModalitaSerie === 'serie_futura') {
        const serieFutura = trovaTurniSerie(turnoInModifica, turni).filter(
          (t) => t.data >= turnoInModifica.data
        );
        serieFutura.forEach((t) => targetIds.add(t.id));
      }

      let turniConOrarioResettato = 0;
      const partecipantiDaReinvitare = new Map<string, { id: string; nome: string; email?: string; turniInfo: string[] }>();

      const aggiornati = turni.map((t) => {
        if (targetIds.has(t.id)) {
          const mansioniAggiornate = tipoSelezionato
            ? tipoSelezionato.mansioniObbligatorie.map((m) => ({ ...m }))
            : t.mansioniRichieste;
          const regoleTipo = getRegoleStrumentiPerTurno(
            {
              ...t,
              tipoTurnoId: tipoSelezionato ? tipoSelezionato.id : t.tipoTurnoId,
              tipoTurnoNome: tipoSelezionato ? tipoSelezionato.nome : t.tipoTurnoNome,
            },
            tipiTurno
          );
          const orarioCambiato = t.orarioInizio !== formInizio || t.orarioFine !== formFine;
          const deveAnnullareEReinvitare = Boolean(
            orarioCambiato && regoleTipo.annullaDisponibilitaSuModificaOrario
          );

          const exPartecipantiNomi: string[] = [];
          if (deveAnnullareEReinvitare) {
            const giaAssegnati = getVolontariAssegnatiTurno(t);
            const candidatiAttesa = (t.richiesteIscrizione || [])
              .filter((r) => r.stato === 'In Attesa')
              .map((r) => ({ id: r.volontarioId, nome: r.volontarioNome }));
            [...giaAssegnati, ...candidatiAttesa].forEach((p) => {
              if (!p?.id) return;
              if (!exPartecipantiNomi.includes(p.nome)) exPartecipantiNomi.push(p.nome);
              const vol = volontari.find((v) => v.id === p.id);
              const curr = partecipantiDaReinvitare.get(p.id) || {
                id: p.id,
                nome: p.nome,
                email: vol?.email,
                turniInfo: [],
              };
              const info = `${t.data} (${t.sedeNome}: ${t.orarioInizio}-${t.orarioFine} → ${formInizio}-${formFine})`;
              if (!curr.turniInfo.includes(info)) curr.turniInfo.push(info);
              partecipantiDaReinvitare.set(p.id, curr);
            });
            turniConOrarioResettato++;
          }

          const nextTurno: TurnoSedeOperativa = {
            ...t,
            sedeId: sedeObj?.id || t.sedeId,
            sedeNome: sedeObj?.nome || t.sedeNome,
            nomeTurno: nomeTurnoPulito,
            tipoTurnoId: tipoSelezionato ? tipoSelezionato.id : t.tipoTurnoId,
            tipoTurnoNome: tipoSelezionato ? tipoSelezionato.nome : t.tipoTurnoNome,
            mansioniRichieste: mansioniAggiornate,
            data: modificaModalitaSerie === 'serie_futura' && t.id !== turnoInModifica.id ? t.data : formData,
            fasciaOraria: formFascia,
            orarioInizio: formInizio,
            orarioFine: formFine,
            mezzoAssegnato: mezzoValido,
            capoServizioBadge: deveAnnullareEReinvitare ? undefined : capoBadgeObj,
            autista: deveAnnullareEReinvitare ? undefined : autistaSlot,
            caposervizio: undefined,
            soccorritore2: deveAnnullareEReinvitare ? undefined : socc2Slot,
            terzoSoccorritore: deveAnnullareEReinvitare ? undefined : terzoSlot,
            operatoreCentrale: deveAnnullareEReinvitare ? undefined : centraleSlot,
            centralinista: deveAnnullareEReinvitare ? undefined : centralinistaSlot,
            osservatore: deveAnnullareEReinvitare ? undefined : osservatoreSlot,
            richiesteIscrizione: deveAnnullareEReinvitare
              ? (t.richiesteIscrizione || []).map((r) =>
                  r.stato === 'In Attesa' ? { ...r, stato: 'Rifiutato' as const } : r
                )
              : t.richiesteIscrizione,
            visibileInModalitaMonitor: regoleTipo.visibileInModalitaMonitor,
            orarioModificatoAvviso: deveAnnullareEReinvitare
              ? {
                  vecchioOrario: `${t.orarioInizio}-${t.orarioFine}`,
                  nuovoOrario: `${formInizio}-${formFine}`,
                  dataModifica: formatTimeItaly(undefined, false) + ' del ' + formatDateItaly(),
                  exPartecipanti: exPartecipantiNomi,
                }
              : t.orarioModificatoAvviso,
            checklistObbligatoria: formChecklistObbligatoria,
            note: formNote,
            statoCopertura: 'Scoperto'
          };
          nextTurno.statoCopertura = calcolaCoperturaTurno(nextTurno);
          return nextTurno;
        }
        return t;
      });
      onAggiornaTurni(aggiornati);

      if (turniConOrarioResettato > 0 && partecipantiDaReinvitare.size > 0) {
        const destinatariEmails = Array.from(partecipantiDaReinvitare.values())
          .map((p) => p.email)
          .filter(Boolean) as string[];
        const elencoNomi = Array.from(partecipantiDaReinvitare.values())
          .map((p) => p.nome)
          .join(', ');
        inviaNotificaStrumentiTurniEmail({
          evento: 'modifica_orario_reinvito',
          titolo: `Orario modificato su "${nomeTurnoPulito}" — Disponibilità annullate, nuovo invito`,
          messaggio: `L'orario del turno "${nomeTurnoPulito}" presso ${sedeObj?.nome || 'Sede'} è stato modificato in ${formInizio}-${formFine}. Come previsto dalle regole del tipo di turno, le precedenti disponibilità di ${elencoNomi} sono state annullate: accedi al Calendario Turni per confermare nuovamente la tua disponibilità.`,
          tipoTurnoNome: tipoSelezionato?.nome,
          turnoRiepilogo: `${formData} • ${formInizio}-${formFine} • ${sedeObj?.nome || ''}`,
          destinatariEmails,
        });
        onNotificaRadio?.(
          `⏰ MODIFICA ORARIO TURNO "${nomeTurnoPulito}": disponibilità annullate su ${turniConOrarioResettato} turni e nuovo invito inviato a ${elencoNomi}.`,
          'sistema'
        );
      }

      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'turni',
          modificaModalitaSerie === 'serie_futura'
            ? `Modifica serie futura (${targetIds.size} turni)`
            : 'Modifica turno programmato',
          modificaModalitaSerie === 'serie_futura'
            ? `Modificati ${targetIds.size} turni della serie per sede "${sedeObj?.nome || 'Sede'}" dal ${turnoInModifica.data} (${formInizio}-${formFine})`
            : `Modificato turno per sede "${sedeObj?.nome || 'Sede'}" del ${formData} (${formInizio}-${formFine})`,
          operatoreCorrente
        );
      }
      mostraAvviso(
        turniConOrarioResettato > 0
          ? `⏰ Orario modificato: disponibilità annullate su ${turniConOrarioResettato} turni e partecipanti reinvitati automaticamente.`
          : modificaModalitaSerie === 'serie_futura'
            ? `✓ Aggiornati ${targetIds.size} turni della serie futura con successo.`
            : `Turno aggiornato con successo.`
      );
    } else {
      const regoleNuovo = getRegoleStrumentiPerTurno(
        { tipoTurnoId: tipoSelezionato?.id, tipoTurnoNome: tipoSelezionato?.nome },
        tipiTurno
      );
      const nuovo: TurnoSedeOperativa = {
        id: `turno-${Date.now()}`,
        sedeId: sedeObj?.id || 'sede-massa-lejare',
        sedeNome: sedeObj?.nome || 'Sede Operativa Massa',
        nomeTurno: nomeTurnoPulito,
        tipoTurnoId: tipoSelezionato?.id,
        tipoTurnoNome: tipoSelezionato?.nome,
        mansioniRichieste: tipoSelezionato
          ? tipoSelezionato.mansioniObbligatorie.map((m) => ({ ...m }))
          : undefined,
        data: formData,
        fasciaOraria: formFascia,
        orarioInizio: formInizio,
        orarioFine: formFine,
        mezzoAssegnato: mezzoValido,
        statoCopertura: 'Scoperto',
        richiesteIscrizione: [],
        visibileInModalitaMonitor: regoleNuovo.visibileInModalitaMonitor,
        checklistObbligatoria: formChecklistObbligatoria,
        note: formNote
      };
      onAggiornaTurni([...turni, nuovo]);
      onNotificaRadio?.(
        `📅 CALENDARIO TURNI: Inserito nuovo turno "${nomeTurnoPulito}"${tipoSelezionato ? ` (${tipoSelezionato.nome})` : ''} per ${nuovo.sedeNome} in data ${nuovo.data}`,
        'sistema'
      );
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'turni',
          'Nuovo turno programmato inserito',
          `Creato nuovo turno "${nomeTurnoPulito}" per sede "${nuovo.sedeNome}" del ${nuovo.data} (${nuovo.orarioInizio}-${nuovo.orarioFine})`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Nuovo turno "${nomeTurnoPulito}" programmato con successo.`);
    }
    setModaleTurnoAperta(false);
    setTurnoInModifica(null);
    setModificaModalitaSerie('singolo');
    setMostraModificaEquipaggioEsistente(false);
  };

  // Elimina Turno (apre modale dedicata di sola cancellazione, singola o serie futura)
  const handleEliminaTurno = (id: string) => {
    if (!isAdmin) {
      mostraAvviso("⛔ Operazione non autorizzata: solo l'Amministratore può eliminare turni dal calendario.");
      return;
    }
    const target = turni.find((t) => t.id === id);
    if (!target) return;
    setModalAzioneTipo('elimina');
    setTurnoAzioneModal(target);
    setAzioneMezzoScope(null);
    setMezzoNuovoScelto(target.mezzoAssegnato || getDefaultMezzoOperativo());
  };

  // Modifica Turno (se fa parte di una serie apre le 4 opzioni di modifica/cambio mezzo; altrimenti apre direttamente la scheda modifica)
  const handleModificaTurno = (turno: TurnoSedeOperativa) => {
    const serieCompleta = trovaTurniSerie(turno, turni);
    if (serieCompleta.length > 1) {
      setModalAzioneTipo('modifica');
      setTurnoAzioneModal(turno);
      setAzioneMezzoScope(null);
      setMezzoNuovoScelto(turno.mezzoAssegnato || getDefaultMezzoOperativo());
      return;
    }
    avviaModificaDaModalSerie(turno, 'singolo');
  };

  const eseguiEliminaSingoloTurno = (turno: TurnoSedeOperativa) => {
    const filtrati = turni.filter((t) => t.id !== turno.id);
    onAggiornaTurni(filtrati);
    setTurnoAzioneModal(null);
    setAzioneMezzoScope(null);
    mostraAvviso(`Turno del ${formatDateItaly(turno.data)} rimosso dal calendario.`);
  };

  const eseguiEliminaSerieFutura = (turno: TurnoSedeOperativa) => {
    const serieFutura = trovaTurniSerie(turno, turni).filter((t) => t.data >= turno.data);
    const idsDaEliminare = new Set(serieFutura.map((t) => t.id));
    const filtrati = turni.filter((t) => !idsDaEliminare.has(t.id));
    onAggiornaTurni(filtrati);
    onNotificaRadio?.(
      `🗑️ SERIE TURNI RIMOSSA: Eliminati ${idsDaEliminare.size} turni futuri dal ${formatDateItaly(turno.data)} (${turno.sedeNome}).`,
      'sistema'
    );
    setTurnoAzioneModal(null);
    setAzioneMezzoScope(null);
    mostraAvviso(`✓ Eliminati ${idsDaEliminare.size} turni futuri della serie a partire dal ${formatDateItaly(turno.data)}.`);
  };

  const avviaModificaDaModalSerie = (turno: TurnoSedeOperativa, scope: 'singolo' | 'serie_futura') => {
    setTurnoAzioneModal(null);
    setAzioneMezzoScope(null);
    setModificaModalitaSerie(scope);
    setTurnoInModifica(turno);
    setFormSedeId(turno.sedeId);
    setFormData(turno.data);
    setFormTipoTurnoId(turno.tipoTurnoId || '');
    setFormNomeTurno(turno.nomeTurno || '');
    setFormFascia(turno.fasciaOraria);
    setFormInizio(turno.orarioInizio);
    setFormFine(turno.orarioFine);
    setFormMezzo(turno.mezzoAssegnato || '');
    setFormAutistaId(turno.autista?.id || '');
    setFormCapoId(getCapoServizioTurno(turno)?.id || '');
    setFormSoccorritore2Id(turno.soccorritore2?.id || '');
    setFormTerzoSoccorritoreId(turno.terzoSoccorritore?.id || '');
    setFormCentraleId(turno.operatoreCentrale?.id || '');
    setFormCentralinistaId(turno.centralinista?.id || '');
    setFormOsservatoreId(turno.osservatore?.id || '');
    setMostraModificaEquipaggioEsistente(false);
    setFormChecklistObbligatoria(turno.checklistObbligatoria !== false);
    setFormNote(turno.note || '');
    setModaleTurnoAperta(true);
  };

  const eseguiCambioMezzoSerie = (
    turno: TurnoSedeOperativa,
    scope: 'singolo' | 'serie_futura',
    nuovoMezzo: string
  ) => {
    const mezzoPulito = nuovoMezzo.trim();
    const mezzoValido =
      mezzoPulito && !sigleInManutenzione.has(mezzoPulito.toUpperCase()) ? mezzoPulito : undefined;
    const targetIds = new Set<string>([turno.id]);
    if (scope === 'serie_futura') {
      trovaTurniSerie(turno, turni)
        .filter((t) => t.data >= turno.data)
        .forEach((t) => targetIds.add(t.id));
    }
    const aggiornati = turni.map((t) =>
      targetIds.has(t.id) ? { ...t, mezzoAssegnato: mezzoValido } : t
    );
    onAggiornaTurni(aggiornati);
    setTurnoAzioneModal(null);
    setAzioneMezzoScope(null);
    mostraAvviso(
      scope === 'serie_futura'
        ? `✓ Mezzo aggiornato a "${mezzoValido || 'Nessun mezzo'}" su ${targetIds.size} turni futuri della serie.`
        : `✓ Mezzo aggiornato a "${mezzoValido || 'Nessun mezzo'}" per il turno del ${formatDateItaly(turno.data)}.`
    );
  };

  // Assegnazione rapida
  const handleAssegnaRapido = (turno: TurnoSedeOperativa, ruolo: 'autista' | 'caposervizio' | 'soccorritore2', vol: Volontario) => {
    const aggiornati = turni.map((t) => {
      if (t.id === turno.id) {
        const autista = ruolo === 'autista' ? { id: vol.id, nome: `${vol.nome} ${vol.cognome}` } : t.autista;
        const soccorritore2 = ruolo === 'soccorritore2' ? { id: vol.id, nome: `${vol.nome} ${vol.cognome}` } : t.soccorritore2;
        const capoServizioBadge = ruolo === 'caposervizio' ? { id: vol.id, nome: `${vol.nome} ${vol.cognome}` } : t.capoServizioBadge;
        const nextTurno: TurnoSedeOperativa = { ...t, autista, soccorritore2, capoServizioBadge };
        nextTurno.statoCopertura = calcolaCoperturaTurno(nextTurno);
        return nextTurno;
      }
      return t;
    });
    onAggiornaTurni(aggiornati);
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'turni',
        'Assegnazione rapida turno',
        `Assegnato volontario ${vol.nome} ${vol.cognome} come ${ruolo} al turno del ${turno.data} (${turno.sedeNome})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`${vol.nome} ${vol.cognome} assegnato come ${ruolo}.`);
  };

  // Turni filtrati
  const turniFiltrati = turni.filter((t) => {
    const matchData = t.data === dataSelezionata;
    const matchSede = filtroSedeId === 'tutte' || t.sedeId === filtroSedeId;
    const coperturaReale = calcolaCoperturaTurno(t);
    const matchCopertura = filtroCopertura === 'tutti' || coperturaReale === filtroCopertura;
    return matchData && matchSede && matchCopertura;
  });

  // KPI Giornata
  const turniCopertiGiorno = turniFiltrati.filter((t) => calcolaCoperturaTurno(t) === 'Coperto').length;
  const turniParzialiGiorno = turniFiltrati.filter((t) => calcolaCoperturaTurno(t) === 'Parziale').length;
  const turniScopertiGiorno = turniFiltrati.filter((t) => calcolaCoperturaTurno(t) === 'Scoperto').length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 8 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/10">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-700/50">
                Macro Categoria 8
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {useTitoloDatabase('turni', 'Gestione Calendario Turni di Tutte le Sedi Operative')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Pianificazione orari e turni H24 per tutte le sedi operative della Croce Oro, composizione equipaggi (autista, capoturno, soccorritori) e monitoraggio coperture.
            </p>
          </div>
        </div>

        {canShowSubtab('calendario') && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setMostraTabelloneSettimanaleModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Tabellone Settimanale Sedi</span>
          </button>

          <button
            type="button"
            onClick={handleInviaPromemoriaDomani}
            disabled={inviandoPromemoria}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer border border-amber-400/40 disabled:opacity-50"
            title="Invia o testa subito l'avviso e notifica push per i turni in programma per domani (programmata automaticamente ogni giorno alle ore 09:00)"
          >
            <BellRing className={`w-4 h-4 text-amber-200 ${inviandoPromemoria ? 'animate-spin' : ''}`} />
            <span>{inviandoPromemoria ? 'Invio in corso...' : 'Avviso Turni Domani (Ore 9)'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Stampa Tabellone</span>
          </button>

          <button
            type="button"
            onClick={() => avviaProgrammazioneTurniRipetuti()}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer border border-teal-400/40"
            title="Programma una serie di turni ripetuti sui giorni della settimana fino a una data prefissata"
          >
            <Repeat className="w-4 h-4 text-teal-200" />
            <span>Turni Ripetuti (Serie)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTurnoInModifica(null);
              setFormSedeId(sedi[1]?.id || sedi[0]?.id || '');
              setFormData(dataSelezionata);
              setFormTipoTurnoId(tipiTurno[0]?.id || '');
              setFormNomeTurno('');
              setFormFascia('Mattina (08:00 - 14:00)');
              setFormInizio('08:00');
              setFormFine('14:00');
              setFormMezzo(getDefaultMezzoOperativo('T4609'));
              setFormAutistaId('');
              setFormCapoId('');
              setFormSoccorritore2Id('');
              setFormTerzoSoccorritoreId('');
              setFormCentraleId('');
              setFormCentralinistaId('');
              setFormOsservatoreId('');
              setMostraModificaEquipaggioEsistente(false);
              setFormChecklistObbligatoria(true);
              setFormNote('');
              setModaleTurnoAperta(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Aggiungi Nuovo Turno</span>
          </button>
        </div>
        )}
      </div>

      {/* Navigazione Sottosezioni Database Calendario Turni */}
      <div className={`grid grid-cols-2 ${puoGestireStrumentiTurni ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-1.5 sm:gap-2 pb-1`}>
        {canShowSubtab('calendario') && (
          <button
            type="button"
            onClick={() => setVistaSottosezione('calendario')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-black uppercase leading-tight text-center transition-all cursor-pointer active:scale-95 ${
              vistaSottosezione === 'calendario'
                ? 'bg-teal-500 text-slate-950 border-teal-300 shadow-md shadow-teal-500/20'
                : 'bg-teal-950/80 hover:bg-teal-900/80 border-teal-500/40 text-teal-200'
            }`}
          >
            <span className="break-words">1. {getTitoloSottosezione('turni', 'calendario', 'Calendario Turni & Equipaggi', nomiSubCustom)}</span>
          </button>
        )}
        {canShowSubtab('candidature') && (
          <button
            type="button"
            onClick={() => setVistaSottosezione('candidature')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-black uppercase leading-tight text-center transition-all cursor-pointer active:scale-95 ${
              vistaSottosezione === 'candidature'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                : 'bg-amber-950/80 hover:bg-amber-900/80 border-amber-500/40 text-amber-200'
            }`}
          >
            <span className="break-words">2. {getTitoloSottosezione('turni', 'candidature', 'Gestione Candidature Turni', nomiSubCustom)} ({tutteCandidatureInAttesa.length + proposteScambioInAttesaResponsabile.length})</span>
          </button>
        )}
        {canShowSubtab('tipi_turno') && (
          <button
            type="button"
            onClick={() => setVistaSottosezione('tipi_turno')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-black uppercase leading-tight transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
              vistaSottosezione === 'tipi_turno'
                ? 'bg-indigo-500 text-white border-indigo-300 shadow-md shadow-indigo-500/20'
                : 'bg-indigo-950/80 hover:bg-indigo-900/80 border-indigo-500/40 text-indigo-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="break-words">3. {getTitoloSottosezione('turni', 'tipi_turno', 'Tipi di Turni', nomiSubCustom)} ({tipiTurno.length})</span>
          </button>
        )}
        {canShowSubtab('strumenti') && (
          <button
            type="button"
            onClick={() => setVistaSottosezione('strumenti')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-black uppercase leading-tight transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
              vistaSottosezione === 'strumenti'
                ? 'bg-violet-500 text-white border-violet-300 shadow-md shadow-violet-500/20'
                : 'bg-violet-950/80 hover:bg-violet-900/80 border-violet-500/40 text-violet-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="break-words">4. {getTitoloSottosezione('turni', 'strumenti', 'Strumenti', nomiSubCustom)}</span>
          </button>
        )}
      </div>

      {/* Alert Notifica */}
      {avviso && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{avviso}</span>
        </div>
      )}

      {/* SOTTOSEZIONE 3: TIPI DI TURNI */}
      {vistaSottosezione === 'tipi_turno' && canShowSubtab('tipi_turno') && (
        <PannelloTipiTurno
          tipiTurno={tipiTurno}
          operatoreCorrente={operatoreCorrente}
          isAdmin={isAdmin}
          onAvviso={mostraAvviso}
        />
      )}

      {/* SOTTOSEZIONE 4: STRUMENTI (RISERVATA A PRESIDENTE, AMMINISTRATORE E SEGRETARIO) */}
      {vistaSottosezione === 'strumenti' && canShowSubtab('strumenti') && (
        <PannelloStrumentiTurni
          volontari={volontari}
          onNotificaRadio={(msg) => onNotificaRadio?.(msg, 'sistema')}
        />
      )}

      {/* SOTTOSEZIONE 2: GESTIONE CANDIDATURE E SCAMBI (VISTA DEDICATA) */}
      {vistaSottosezione === 'candidature' &&
        canShowSubtab('candidature') &&
        tutteCandidatureInAttesa.length === 0 &&
        proposteScambioInAttesaResponsabile.length === 0 && (
        <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="text-sm font-black text-white uppercase">Nessuna candidatura o proposta di scambio in attesa</div>
          <p className="text-xs text-slate-400">
            Tutte le richieste dei volontari e le proposte di cessione/scambio turno risultano già gestite.
          </p>
        </div>
      )}

      {/* PROPOSTE CESSIONE / SCAMBIO TURNO IN ATTESA APPROVAZIONE RESPONSABILE */}
      {vistaSottosezione !== 'tipi_turno' &&
        vistaSottosezione !== 'strumenti' &&
        canShowSubtab('candidature') &&
        proposteScambioInAttesaResponsabile.length > 0 && (
        <div className="bg-gradient-to-r from-violet-950/90 via-slate-900 to-violet-950/90 p-4 rounded-3xl border-2 border-violet-500 shadow-xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 text-violet-300 border border-violet-500/50 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h4 className="text-sm font-black text-violet-200 uppercase tracking-wide flex items-center gap-2">
                <span>Cessioni &amp; Scambi Turno Accettati dal Collega — Approvazione Responsabile</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-500 text-white font-black text-xs">
                  {proposteScambioInAttesaResponsabile.length}
                </span>
              </h4>
              <p className="text-xs text-slate-300">
                Il destinatario ha già accettato la proposta: lo scambio diventa effettivo sul calendario solo dopo la tua approvazione finale.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-violet-500/30">
            {proposteScambioInAttesaResponsabile.map(({ turno: tr, proposta: pr }) => {
              const turnoDest = pr.turnoDestinatarioId
                ? turni.find((x) => x.id === pr.turnoDestinatarioId)
                : undefined;
              return (
                <div key={pr.id} className="p-3 rounded-2xl bg-slate-950 border border-violet-500/35 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/40 text-violet-300 text-[10px] font-black uppercase">
                        {pr.modalita === 'scambio' ? '🔄 Scambio Turni' : '➡️ Cessione Turno'}
                      </span>
                      <div className="font-black text-white text-sm mt-1">
                        {pr.proponenteNome} → {pr.destinatarioNome}
                      </div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-0.5 font-mono">
                    <div className="text-slate-300">🏢 {tr.sedeNome}</div>
                    <div className="text-indigo-300">📅 {tr.data} ({tr.orarioInizio}-{tr.orarioFine})</div>
                    <div className="text-violet-300 font-bold">🎯 Ruolo: {getEtichettaRuolo(pr.ruoloProponente || pr.ruolo || 'soccorritore2')}</div>
                    {turnoDest && (
                      <div className="text-emerald-300 pt-1 border-t border-slate-800 mt-1">
                        ⇄ Contro-turno: {turnoDest.data} ({turnoDest.orarioInizio}-{turnoDest.orarioFine}) — {pr.ruoloDestinatario ? getEtichettaRuolo(pr.ruoloDestinatario) : ''}
                      </div>
                    )}
                    {pr.note && <div className="text-slate-400 italic text-[10px]">Note: &quot;{pr.note}&quot;</div>}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApprovaPropostaScambio(tr.id, pr)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approva Scambio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRifiutaPropostaScambio(tr.id, pr)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-700 font-bold text-xs uppercase cursor-pointer"
                    >
                      <span>Rifiuta</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOX ESCLUSIVO AMMINISTRATORE: LINK DIRETTO AL TABELLONE TURNI SENZA LOGIN */}
      {vistaSottosezione === 'calendario' && (
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 p-4 sm:p-5 rounded-3xl border-2 border-indigo-500/60 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                  Riservato Amministratore
                </span>
                <span className="text-sm font-bold text-white">
                  Link Diretto Modalità Monitor (Senza Login Obbligatorio)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Link dedicato per monitor di postazione e schermi TV: visualizza tutti i turni pubblicati di ogni sezione in Modalità Monitor (senza login, con scroll automatico e pulizia cache ogni 60s).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(urlTabelloneSenzaLogin);
                  setLinkCopiato(true);
                  setTimeout(() => setLinkCopiato(false), 3000);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              {linkCopiato ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{linkCopiato ? 'Link Copiato!' : 'Copia Link'}</span>
            </button>

            <a
              href={urlTabelloneSenzaLogin}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all"
              title="Apri la Modalità Monitor in una nuova scheda"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Apri Monitor</span>
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300">
          <span className="text-slate-500 select-none text-[10px] uppercase font-bold shrink-0">URL:</span>
          <input
            type="text"
            readOnly
            value={urlTabelloneSenzaLogin}
            className="bg-transparent border-none text-xs text-indigo-200 font-mono flex-1 focus:outline-none select-all truncate"
          />
        </div>
        <p className="text-[10.5px] text-amber-400/90 italic">
          🔒 Riservatezza: Questo link non è visibile nella schermata dei volontari né nei menu pubblici. È consultabile solo dall'amministratore per monitor di postazione o condivisione interna ai responsabili di sede.
        </p>
      </div>
      )}

      {/* BANNER NOTIFICA CANDIDATURE VOLONTARI IN ATTESA DI APPROVAZIONE */}
      {vistaSottosezione !== 'tipi_turno' && vistaSottosezione !== 'strumenti' && canShowSubtab('candidature') && tutteCandidatureInAttesa.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 p-4 rounded-3xl border-2 border-amber-500 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                  <span>Richieste Iscrizione Volontari in Attesa di Approvazione</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                    {tutteCandidatureInAttesa.length}
                  </span>
                </h4>
                <p className="text-xs text-slate-300">
                  Volontari che hanno scelto di coprire uno specifico turno. Un operatore di centrale o l'amministratore deve approvare per confermare l'equipaggio.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMostraPannelloCandidature(!mostraPannelloCandidature)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase transition-all cursor-pointer shadow-md shrink-0"
            >
              {mostraPannelloCandidature ? 'Nascondi Richieste' : `Visualizza Tutte (${tutteCandidatureInAttesa.length})`}
            </button>
          </div>

          {mostraPannelloCandidature && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-amber-500/30">
              {tutteCandidatureInAttesa.map(({ turno: tr, candidatura: cr }) => (
                <div key={cr.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-white text-sm block">{cr.volontarioNome}</strong>
                      <span className="text-[11px] text-slate-400 block">{cr.qualificaVolontario || 'Volontario'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-600/50 text-[10px] font-black uppercase">
                      In Attesa
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-0.5 font-mono">
                    <div className="text-slate-300">🏢 {tr.sedeNome}</div>
                    <div className="text-indigo-300">📅 {tr.data} ({tr.orarioInizio}-{tr.orarioFine})</div>
                    <div className="text-amber-300 font-bold">🎯 Ruolo Richiesto: {getEtichettaRuolo(cr.ruoloRichiesto)}</div>
                    {cr.note && <div className="text-slate-400 italic text-[10px]">Note: "{cr.note}"</div>}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApprovaCandidatura(tr.id, cr.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approva e Assegna</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRifiutaCandidatura(tr.id, cr.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-700 font-bold text-xs uppercase cursor-pointer"
                    >
                      <span>Rifiuta</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra Navigazione Calendario & Filtri */}
      {vistaSottosezione === 'calendario' && (
      <>
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigatore Data Giorno */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <button
            type="button"
            onClick={() => cambiaGiorno(-1)}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
            title="Giorno Precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <input
              type="date"
              value={dataSelezionata}
              onChange={(e) => setDataSelezionata(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs focus:outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={() => setDataSelezionata(formatISODateItaly())}
              className="px-2.5 py-1.5 rounded-xl bg-teal-950 text-teal-300 border border-teal-700/50 text-[11px] font-bold cursor-pointer hover:bg-teal-900"
            >
              Oggi
            </button>
          </div>

          <button
            type="button"
            onClick={() => cambiaGiorno(1)}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
            title="Giorno Successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Filtri Sede e Stato Copertura */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <select
            value={filtroSedeId}
            onChange={(e) => setFiltroSedeId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
          >
            <option value="tutte">Tutte le Sedi Operative</option>
            {sedi.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroCopertura}
            onChange={(e) => setFiltroCopertura(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
          >
            <option value="tutti">Tutti gli Stati Copertura</option>
            <option value="Coperto">🟢 Solo Coperti</option>
            <option value="Parziale">🟡 Parzialmente Coperti</option>
            <option value="Scoperto">🔴 Solo Scoperti (Allerta)</option>
          </select>
        </div>
      </div>

      {/* KPI Copertura Giornaliera */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Turni Coperti al 100%</span>
            <div className="text-lg font-black text-emerald-400 font-mono">{turniCopertiGiorno} Turni</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold">
            ✓
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Turni Parziali (Manca Personale)</span>
            <div className="text-lg font-black text-amber-400 font-mono">{turniParzialiGiorno} Turni</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center font-bold">
            !
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-red-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Turni Scoperti (Urgente Reperimento)</span>
            <div className="text-lg font-black text-red-400 font-mono">{turniScopertiGiorno} Turni</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-red-950 text-red-400 flex items-center justify-center font-bold">
            ✗
          </div>
        </div>
      </div>

      {/* Griglia Turni della Giornata */}
      {turniFiltrati.length === 0 ? (
        <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center text-slate-400 space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="font-bold text-white text-base">Nessun turno programmato per questa data</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Non risultano turni di servizio registrati per il giorno selezionato ({dataSelezionata}) con i filtri attuali.
          </p>
          <button
            type="button"
            onClick={() => {
              setTurnoInModifica(null);
              setFormSedeId(sedi[1]?.id || sedi[0]?.id || '');
              setFormData(dataSelezionata);
              setFormTipoTurnoId(tipiTurno[0]?.id || '');
              setFormNomeTurno('');
              setFormFascia('Mattina (08:00 - 14:00)');
              setFormInizio('08:00');
              setFormFine('14:00');
              setFormMezzo(getDefaultMezzoOperativo('T4609'));
              setFormAutistaId('');
              setFormCapoId('');
              setFormSoccorritore2Id('');
              setFormTerzoSoccorritoreId('');
              setFormCentraleId('');
              setFormCentralinistaId('');
              setFormOsservatoreId('');
              setMostraModificaEquipaggioEsistente(false);
              setFormChecklistObbligatoria(true);
              setFormNote('');
              setModaleTurnoAperta(true);
            }}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase inline-flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crea Turno per Oggi</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {turniFiltrati.map((t) => {
            const isCoperto = t.statoCopertura === 'Coperto';
            const isParziale = t.statoCopertura === 'Parziale';
            const isScoperto = t.statoCopertura === 'Scoperto';

            return (
              <div
                key={t.id}
                className={`bg-slate-950 rounded-2xl border p-4 shadow-xl flex flex-col justify-between gap-3 transition-all ${
                  isCoperto
                    ? 'border-emerald-500/40 hover:border-emerald-400'
                    : isParziale
                    ? 'border-amber-500/40 hover:border-amber-400'
                    : 'border-red-500/60 bg-red-950/10 hover:border-red-400'
                }`}
              >
                <div className="space-y-3">
                  {/* Intestazione Turno */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-teal-400">{t.sedeNome}</span>
                      {t.nomeTurno && (
                        <div className="text-xs font-black text-amber-300 font-sans tracking-wide mt-0.5 flex items-center gap-1">
                          <span>🏷️</span>
                          <span>{t.nomeTurno}</span>
                        </div>
                      )}
                      {t.tipoTurnoNome && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/90 border border-indigo-500/40 text-indigo-200 text-[10px] font-bold">
                          <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>Tipo: {t.tipoTurnoNome}</span>
                        </div>
                      )}
                      <h4 className="font-black text-white text-sm mt-0.5">{t.fasciaOraria}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{t.orarioInizio} — {t.orarioFine}</span>
                        {t.mezzoAssegnato && <span>• Mezzo: <strong className="text-amber-300">{t.mezzoAssegnato}</strong></span>}
                      </div>
                      {t.checklistObbligatoria === false && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/50 text-amber-200 text-[10px] font-bold">
                          <CheckSquare className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Checklist non obbligatoria</span>
                        </div>
                      )}
                      {Array.isArray(t.mansioniRichieste) && t.mansioniRichieste.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          {risolviMansioniTipoTurnoLive(t.mansioniRichieste, catalogoMansioni).map((mr) => (
                            <span
                              key={mr.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 font-semibold"
                            >
                              <IconaEmoji icona={mr.emoji} fallback="🎖️" size="xs" />
                              <span>{mr.nome}</span>
                              <span className="text-indigo-300 font-mono">
                                ({mr.minimo === 0 ? `Facolt. 0–${mr.massimo}` : mr.minimo === mr.massimo ? mr.minimo : `${mr.minimo}–${mr.massimo}`})
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {(() => {
                      const statoEffettivo = calcolaCoperturaTurno(t);
                      const effCoperto = statoEffettivo === 'Coperto';
                      const effParziale = statoEffettivo === 'Parziale';
                      return (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border shrink-0 ${
                          effCoperto
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                            : effParziale
                            ? 'bg-amber-950 text-amber-300 border-amber-700/50'
                            : 'bg-red-950 text-red-300 border-red-700/50 animate-pulse'
                        }`}>
                          {statoEffettivo}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Componenti Equipaggio & Badge Capo Servizio */}
                  {(() => {
                    const capoAttuale = getCapoServizioTurno(t);
                    const volontariNelTurno = getVolontariAssegnatiTurno(t);
                    const renderCapoBadgeBtn = (slot?: { id: string; nome: string }) => {
                      if (!slot) return null;
                      const isCapo = Boolean(
                        capoAttuale && (
                          (capoAttuale.id && capoAttuale.id === slot.id) ||
                          (capoAttuale.nome && capoAttuale.nome.trim().toLowerCase() === slot.nome.trim().toLowerCase())
                        )
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => handleAssegnaBadgeCapoServizio(t.id, isCapo ? null : slot)}
                          className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-black uppercase inline-flex items-center gap-1 transition-all cursor-pointer shrink-0 border ${
                            isCapo
                              ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-sm hover:bg-amber-500/35'
                              : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-amber-300 hover:border-amber-500/60'
                          }`}
                          title={
                            isCapo
                              ? 'Capo Servizio attuale (la sua firma appare sui fogli di servizio) — clicca per rimuovere'
                              : `Assegna il badge di Capo Servizio a ${slot.nome} (indipendentemente dalla mansione)`
                          }
                        >
                          <Star className={`w-2.5 h-2.5 ${isCapo ? 'fill-amber-400 text-amber-400' : ''}`} />
                          <span>{isCapo ? 'Capo Servizio' : 'Nomina CS'}</span>
                        </button>
                      );
                    };

                    return (
                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                        {/* Riepilogo Badge Capo Servizio del Turno */}
                        <div className={`flex items-center justify-between gap-2 pb-1.5 mb-1 border-b border-slate-800 text-[11px] ${
                          capoAttuale ? 'text-amber-300' : 'text-slate-400'
                        }`}>
                          <span className="font-black uppercase flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Badge Capo Servizio:</span>
                          </span>
                          {capoAttuale ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/60 text-amber-200 font-black truncate max-w-[180px]" title="La firma del Capo Servizio appare sui fogli di servizio">
                              ⭐ {capoAttuale.nome}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400/90 italic font-semibold">
                              {volontariNelTurno.length > 0 ? 'Clicca "Nomina CS" su un volontario' : 'Nessun volontario'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                            <Car className="w-3.5 h-3.5 text-amber-400" /> {getLabelRuoloEquipaggioLive('autista', catalogoMansioni).nome}:
                          </span>
                          {t.autista ? (
                            <div className="flex items-center justify-end min-w-0">
                              <strong className="text-white font-bold truncate">{t.autista.nome}</strong>
                              {renderCapoBadgeBtn(t.autista)}
                            </div>
                          ) : (
                            <span className="text-red-400 italic font-semibold">Da Assegnare</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                            <Users className="w-3.5 h-3.5 text-emerald-400" /> {getLabelRuoloEquipaggioLive('soccorritore2', catalogoMansioni).nome}:
                          </span>
                          {t.soccorritore2 ? (
                            <div className="flex items-center justify-end min-w-0">
                              <strong className="text-white font-bold truncate">{t.soccorritore2.nome}</strong>
                              {renderCapoBadgeBtn(t.soccorritore2)}
                            </div>
                          ) : (
                            <span className="text-amber-400 italic font-semibold">Mancante</span>
                          )}
                        </div>

                        {t.terzoSoccorritore && (
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                              <Users className="w-3.5 h-3.5 text-teal-400" /> {getLabelRuoloEquipaggioLive('terzoSoccorritore', catalogoMansioni).nome}:
                            </span>
                            <div className="flex items-center justify-end min-w-0">
                              <strong className="text-white font-bold truncate">{t.terzoSoccorritore.nome}</strong>
                              {renderCapoBadgeBtn(t.terzoSoccorritore)}
                            </div>
                          </div>
                        )}

                        {/* Centralinista */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                            <Users className="w-3.5 h-3.5 text-cyan-400" /> {getLabelRuoloEquipaggioLive('centralinista', catalogoMansioni).nome}:
                          </span>
                          {t.centralinista ? (
                            <div className="flex items-center justify-end min-w-0">
                              <strong className="text-cyan-300 font-bold truncate">{t.centralinista.nome}</strong>
                              {renderCapoBadgeBtn(t.centralinista)}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic font-semibold text-[11px]">Disponibile</span>
                          )}
                        </div>

                        {/* Osservatore */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                            <Eye className="w-3.5 h-3.5 text-amber-400" /> {getLabelRuoloEquipaggioLive('osservatore', catalogoMansioni).nome}:
                          </span>
                          {t.osservatore ? (
                            <div className="flex items-center justify-end min-w-0">
                              <strong className="text-amber-300 font-bold truncate">{t.osservatore.nome}</strong>
                              {renderCapoBadgeBtn(t.osservatore)}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic font-semibold text-[11px]">Disponibile</span>
                          )}
                        </div>

                        {t.operatoreCentrale && (
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800">
                            <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                              <Headphones className="w-3.5 h-3.5 text-purple-400" /> {getLabelRuoloEquipaggioLive('operatoreCentrale', catalogoMansioni).nome}:
                            </span>
                            <div className="flex items-center justify-end min-w-0">
                              <strong className="text-purple-300 font-bold truncate">{t.operatoreCentrale.nome}</strong>
                              {renderCapoBadgeBtn(t.operatoreCentrale)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Box Candidature Volontari in attesa su questo specifico turno */}
                  {(() => {
                    const pendenti = (t.richiesteIscrizione || []).filter((r) => r.stato === 'In Attesa');
                    if (pendenti.length === 0) return null;
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/60 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                            <span>Candidature in Attesa ({pendenti.length})</span>
                          </span>
                        </div>
                        {pendenti.map((req) => (
                          <div key={req.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">{req.volontarioNome}</span>
                              <span className="text-amber-400 font-bold text-[10px] block">{getEtichettaRuolo(req.ruoloRichiesto)}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleApprovaCandidatura(t.id, req.id)}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase shadow-sm cursor-pointer"
                                title="Approva e assegna"
                              >
                                ✓ Approva
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRifiutaCandidatura(t.id, req.id)}
                                className="px-1.5 py-1 rounded bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-700 font-bold text-[10px] cursor-pointer"
                                title="Rifiuta"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {t.note && (
                    <div className="text-[11px] text-slate-400 italic bg-slate-900/50 p-2 rounded-lg border border-slate-800/80">
                      Note: {t.note}
                    </div>
                  )}
                </div>

                {/* Azioni Turno */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => avviaDuplicazioneTurno(t, 'turno')}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1 border border-amber-500/40 cursor-pointer transition-all active:scale-95"
                    title="Duplica questo turno (sede, orario, mezzo e struttura) su altre date"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Duplica Turno</span>
                  </button>

                  {(() => {
                    const numVolontariAssegnati = [
                      t.autista,
                      t.soccorritore2,
                      t.terzoSoccorritore,
                      t.operatoreCentrale,
                      t.centralinista,
                      t.osservatore
                    ].filter(Boolean).length;
                    return (
                      <button
                        type="button"
                        onClick={() => avviaDuplicazioneTurno(t, 'disponibilita')}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1 border border-emerald-500/45 cursor-pointer transition-all active:scale-95"
                        title="Duplica la disponibilità di uno o più volontari di questo turno su altre date o turni ripetuti"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Duplica Disponibilità</span>
                        {numVolontariAssegnati > 0 && (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-200 font-mono text-[9.5px] font-black">
                            {numVolontariAssegnati}
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => avviaProgrammazioneTurniRipetuti(t)}
                    className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-[11px] flex items-center gap-1 border border-teal-500/40 cursor-pointer transition-all active:scale-95"
                    title="Crea serie di turni ripetuti sui giorni della settimana da questo modello"
                  >
                    <Repeat className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Ripeti</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModificaTurno(t)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 border border-slate-600 cursor-pointer transition-all active:scale-95"
                    title="Modifica Orari, Mezzo, Assegnazioni o Serie Turni"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Modifica</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleEliminaTurno(t.id)}
                      className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 cursor-pointer transition-all active:scale-95"
                      title="Elimina Turno"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* MODALE NUOVO / MODIFICA TURNO */}
      {modaleTurnoAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-teal-500/50 rounded-3xl max-w-xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-base font-black text-white uppercase">
                    {turnoInModifica
                      ? (modificaModalitaSerie === 'serie_futura'
                          ? 'Modifica Serie di Turni Futuri'
                          : 'Modifica Turno Operativo')
                      : 'Programma Nuovo Turno Sede'}
                  </h3>
                  {turnoInModifica && modificaModalitaSerie === 'serie_futura' && (
                    <p className="text-[11px] text-amber-300 font-bold">
                      Le modifiche saranno applicate a tutti i turni futuri della serie a partire dal {formatDateItaly(turnoInModifica.data)} (mantenendo le date originali).
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModaleTurnoAperta(false);
                  setModificaModalitaSerie('singolo');
                }}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaTurno} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sede Operativa</label>
                  <select
                    value={formSedeId}
                    onChange={(e) => setFormSedeId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Data Turno</label>
                  <input
                    type="date"
                    required
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Selezione Tipo di Turno */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-slate-300 font-bold">
                    Tipo di Turno {tipiTurno.length > 0 && <span className="text-red-400">*</span>}
                  </label>
                  {canShowSubtab('tipi_turno') && (
                    <button
                      type="button"
                      onClick={() => {
                        setModaleTurnoAperta(false);
                        setVistaSottosezione('tipi_turno');
                      }}
                      className="text-[10.5px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Gestisci Tipi di Turni
                    </button>
                  )}
                </div>
                <select
                  required={!turnoInModifica && tipiTurno.length > 0}
                  value={formTipoTurnoId}
                  onChange={(e) => setFormTipoTurnoId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-white font-bold focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">-- Seleziona Tipo di Turno --</option>
                  {tipiTurno.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {formatIconaPerTesto(tp.icona, '📅')} {tp.nome} ({tp.mansioniObbligatorie.length} mansioni)
                    </option>
                  ))}
                </select>

                {/* Riepilogo Mansioni Obbligatorie del Tipo di Turno selezionato */}
                {(() => {
                  const tipoSel = tipiTurno.find((tp) => tp.id === formTipoTurnoId);
                  if (!tipoSel || tipoSel.mansioniObbligatorie.length === 0) return null;
                  const mansioniLive = risolviMansioniTipoTurnoLive(tipoSel.mansioniObbligatorie, catalogoMansioni);
                  return (
                    <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-1.5">
                      <div className="text-[10px] font-black uppercase text-indigo-300">
                        Mansioni previste ({tipoSel.nome}):
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {mansioniLive.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-indigo-500/30 text-[10.5px] text-slate-200 font-semibold"
                          >
                            <IconaEmoji icona={m.emoji} fallback="🎖️" size="xs" />
                            <span>{m.nome}</span>
                            <strong className="text-indigo-300 font-mono">
                              (Min {m.minimo} – Max {m.massimo})
                            </strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nome Turno <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNomeTurno}
                  onChange={(e) => setFormNomeTurno(e.target.value)}
                  placeholder="es. Turno Emergenza 118, Servizio Manifestazione, Trasporto Dialisi..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-teal-300 font-bold placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fascia Oraria</label>
                  <select
                    value={formFascia}
                    onChange={(e) => {
                      const f = e.target.value as any;
                      setFormFascia(f);
                      if (f.includes('Mattina')) { setFormInizio('08:00'); setFormFine('14:00'); }
                      else if (f.includes('Pomeriggio')) { setFormInizio('14:00'); setFormFine('20:00'); }
                      else if (f.includes('Notte')) { setFormInizio('20:00'); setFormFine('08:00'); }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Mattina (08:00 - 14:00)">Mattina (08:00 - 14:00)</option>
                    <option value="Pomeriggio (14:00 - 20:00)">Pomeriggio (14:00 - 20:00)</option>
                    <option value="Notte (20:00 - 08:00)">Notte (20:00 - 08:00)</option>
                    <option value="Reperibilità H24">Reperibilità H24</option>
                    <option value="Servizio Ordinario Programmato">Servizio Ordinario</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ora Inizio</label>
                  <input
                    type="time"
                    required
                    value={formInizio}
                    onChange={(e) => setFormInizio(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ora Fine</label>
                  <input
                    type="time"
                    required
                    value={formFine}
                    onChange={(e) => setFormFine(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-slate-400 font-bold">Mezzo Assegnato al Turno</label>
                  {sigleInManutenzione.size > 0 && (
                    <span className="text-[10px] text-amber-400/90 font-semibold">
                      Esclusi {sigleInManutenzione.size} mezzi in manutenzione / fuori servizio
                    </span>
                  )}
                </div>
                <select
                  value={mezziOperativi.some((m) => m.sigla === formMezzo) ? formMezzo : ''}
                  onChange={(e) => setFormMezzo(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold focus:border-teal-500 focus:outline-none"
                >
                  <option value="">— Nessun Mezzo Assegnato —</option>
                  {mezziOperativi.map((m) => (
                    <option key={m.id} value={m.sigla}>
                      {m.sigla} — {m.modello} ({m.tipo})
                    </option>
                  ))}
                </select>
                {formMezzo && !mezziOperativi.some((m) => m.sigla === formMezzo) && (
                  <p className="mt-1 text-[10.5px] text-amber-300 bg-amber-950/50 border border-amber-600/40 rounded-lg px-2.5 py-1.5">
                    ⚠️ Il mezzo precedentemente indicato (<strong>{formMezzo}</strong>) risulta attualmente in manutenzione/fuori servizio o non operativo: seleziona un mezzo operativo dal menù a tendina.
                  </p>
                )}
              </div>

              {/* In modifica di un turno già esistente è possibile espandere le assegnazioni manuali; in creazione nuovo turno è completamente rimosso */}
              {turnoInModifica && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => setMostraModificaEquipaggioEsistente((v) => !v)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-[11px] flex items-center justify-between cursor-pointer"
                  >
                    <span>Modifica Volontari Assegnati al Turno</span>
                    <span className="text-teal-400">{mostraModificaEquipaggioEsistente ? 'Nascondi ▲' : 'Mostra ▼'}</span>
                  </button>
                  {mostraModificaEquipaggioEsistente && (() => {
                    const tipoSelAffinita = tipiTurno.find((tp) => tp.id === formTipoTurnoId);
                    const contestoAffinita = {
                      data: formData,
                      fasciaOraria: formFascia,
                      orarioInizio: formInizio,
                      tipoTurnoId: formTipoTurnoId || undefined,
                      tipoTurnoNome: tipoSelAffinita?.nome || turnoInModifica.tipoTurnoNome,
                      nomeTurno: formNomeTurno,
                      tipoTurnoObj: tipoSelAffinita,
                      excludeTurnoId: turnoInModifica.id,
                    };
                    return (
                      <div className="space-y-3 pt-1">
                        {/* Legenda sintetica affinità 5 stelline Blu -> Oro */}
                        <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                          <div className="text-slate-300 font-semibold">
                            Affinità per <span className="text-white font-bold">Tipo turno, Mansione, Fascia e Giorno</span>:
                          </div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-blue-300 font-mono">
                              <StelleAffinita percentuale={20} size="xs" mostraPercentuale={false} />
                              <span>20%/★</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="inline-flex items-center gap-1 text-amber-300 font-mono">
                              <StelleAffinita percentuale={70} size="xs" mostraPercentuale={false} />
                              <span>Blu → Oro</span>
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <SelectVolontarioAffinita
                            label="🚑 Autista Soccorritore"
                            value={formAutistaId}
                            onChange={setFormAutistaId}
                            volontari={volontari}
                            ruoloTarget="autista"
                            contestoTurno={contestoAffinita}
                            tuttiTurni={turni}
                          />

                          <div>
                            <label className="block text-amber-300 font-bold mb-1">⭐ Badge Capo Servizio (da equipaggio assegnato)</label>
                            <select
                              value={formCapoId}
                              onChange={(e) => setFormCapoId(e.target.value)}
                              className="w-full p-2 rounded-xl bg-slate-950 border border-amber-500/60 text-amber-200 font-bold text-xs"
                            >
                              <option value="">-- Nessun Capo Servizio --</option>
                              {Array.from(
                                new Set([
                                  formAutistaId,
                                  formSoccorritore2Id,
                                  formTerzoSoccorritoreId,
                                  formCentraleId,
                                  formCentralinistaId,
                                  formOsservatoreId
                                ].filter(Boolean))
                              ).map((vId) => {
                                const volObj = volontari.find((v) => v.id === vId);
                                if (!volObj) return null;
                                return (
                                  <option key={volObj.id} value={volObj.id}>
                                    ⭐ {volObj.nome} {volObj.cognome}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <SelectVolontarioAffinita
                            label="🧑‍⚕️ Secondo Soccorritore"
                            value={formSoccorritore2Id}
                            onChange={setFormSoccorritore2Id}
                            volontari={volontari}
                            ruoloTarget="soccorritore2"
                            contestoTurno={contestoAffinita}
                            tuttiTurni={turni}
                          />

                          <SelectVolontarioAffinita
                            label="🧑‍⚕️ Terzo Soccorritore"
                            value={formTerzoSoccorritoreId}
                            onChange={setFormTerzoSoccorritoreId}
                            volontari={volontari}
                            ruoloTarget="terzoSoccorritore"
                            contestoTurno={contestoAffinita}
                            tuttiTurni={turni}
                          />

                          <SelectVolontarioAffinita
                            label="🎧 Operatore Centrale"
                            value={formCentraleId}
                            onChange={setFormCentraleId}
                            volontari={volontari}
                            ruoloTarget="operatoreCentrale"
                            contestoTurno={contestoAffinita}
                            tuttiTurni={turni}
                          />

                          <SelectVolontarioAffinita
                            label="📞 Centralinista"
                            value={formCentralinistaId}
                            onChange={setFormCentralinistaId}
                            volontari={volontari}
                            ruoloTarget="centralinista"
                            contestoTurno={contestoAffinita}
                            tuttiTurni={turni}
                          />

                          <div className="sm:col-span-2">
                            <SelectVolontarioAffinita
                              label="👁️ Osservatore"
                              value={formOsservatoreId}
                              onChange={setFormOsservatoreId}
                              volontari={volontari}
                              ruoloTarget="osservatore"
                              contestoTurno={contestoAffinita}
                              tuttiTurni={turni}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Spunta per annullare l'obbligatorietà della checklist */}
              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                !formChecklistObbligatoria
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-100'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}>
                <input
                  type="checkbox"
                  checked={!formChecklistObbligatoria}
                  onChange={(e) => setFormChecklistObbligatoria(!e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-bold text-xs block text-white">
                    Annulla l&apos;obbligatorietà della checklist per questo turno
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    {formChecklistObbligatoria
                      ? 'Stato attuale: Checklist OBBLIGATORIA a inizio turno (impostazione predefinita).'
                      : 'Stato attuale: Checklist NON obbligatoria per questo turno (i volontari non saranno bloccati).'}
                  </span>
                </div>
              </label>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note Operative del Turno</label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Note operative o istruzioni speciali per l'equipaggio..."
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-teal-500/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Repeat className="w-4 h-4 text-teal-400 shrink-0" />
                  <span className="text-slate-300">
                    Vuoi programmare questo turno come serie ripetuta su più giorni della settimana?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const sedeObj = sedi.find((s) => s.id === formSedeId) || sedi[0];
                    const tipoSel = tipiTurno.find((tp) => tp.id === formTipoTurnoId);
                    const mockTurno: TurnoSedeOperativa = {
                      id: `temp-${Date.now()}`,
                      sedeId: formSedeId,
                      sedeNome: sedeObj?.nome || 'Sede',
                      nomeTurno: formNomeTurno.trim() || undefined,
                      tipoTurnoId: tipoSel?.id,
                      tipoTurnoNome: tipoSel?.nome,
                      mansioniRichieste: tipoSel?.mansioniObbligatorie.map((m) => ({ ...m })),
                      data: formData,
                      fasciaOraria: formFascia,
                      orarioInizio: formInizio,
                      orarioFine: formFine,
                      mezzoAssegnato: formMezzo,
                      statoCopertura: 'Scoperto',
                      checklistObbligatoria: formChecklistObbligatoria,
                      note: formNote
                    };
                    setModaleTurnoAperta(false);
                    avviaProgrammazioneTurniRipetuti(mockTurno);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-600/90 hover:bg-teal-500 text-white font-bold text-xs uppercase shrink-0 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Programma Serie</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setModaleTurnoAperta(false);
                    setModificaModalitaSerie('singolo');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{modificaModalitaSerie === 'serie_futura' ? 'Salva Serie Futura' : 'Salva Turno'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE SEPARATA: GESTIONE MODIFICA SERIE TURNI (4 OPZIONI) / CANCELLAZIONE TURNI (2 OPZIONI) */}
      {turnoAzioneModal && (() => {
        const serieCompleta = trovaTurniSerie(turnoAzioneModal, turni);
        const turniFuturiSerie = serieCompleta.filter((t) => t.data >= turnoAzioneModal.data);
        const isSerie = serieCompleta.length > 1;
        const isModificaMode = modalAzioneTipo === 'modifica';
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className={`bg-slate-900 border-2 ${isModificaMode ? 'border-sky-500/50' : 'border-red-500/50'} rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto`}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${isModificaMode ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
                    {isModificaMode ? <Edit2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">
                      {isModificaMode
                        ? 'Opzioni Modifica Serie Turni'
                        : isSerie
                          ? 'Gestione Cancellazione Serie Turni'
                          : 'Conferma Eliminazione Turno'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {turnoAzioneModal.sedeNome} • {formatDateItaly(turnoAzioneModal.data)} ({turnoAzioneModal.orarioInizio}-{turnoAzioneModal.orarioFine})
                      {turnoAzioneModal.mezzoAssegnato ? ` • Mezzo ${turnoAzioneModal.mezzoAssegnato}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTurnoAzioneModal(null);
                    setAzioneMezzoScope(null);
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isModificaMode ? (
                <>
                  <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/40 text-xs text-sky-200 flex items-start gap-2">
                    <Repeat className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      Questo turno fa parte di una <strong>serie di {serieCompleta.length} turni</strong> ({turniFuturiSerie.length} turni a partire dal {formatDateItaly(turnoAzioneModal.data)}). Scegli cosa modificare:
                    </div>
                  </div>

                  {azioneMezzoScope ? (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3">
                      <div className="text-xs font-black uppercase text-cyan-300 flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        <span>
                          {azioneMezzoScope === 'serie_futura'
                            ? `Cambia Mezzo su tutta la serie futura (${turniFuturiSerie.length} turni)`
                            : `Cambia Mezzo solo per il turno del ${formatDateItaly(turnoAzioneModal.data)}`}
                        </span>
                      </div>
                      <select
                        value={mezzoNuovoScelto}
                        onChange={(e) => setMezzoNuovoScelto(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold"
                      >
                        <option value="">-- Nessun Mezzo Assegnato --</option>
                        {mezziOperativi.map((m) => (
                          <option key={m.sigla} value={m.sigla}>
                            {m.sigla} — {m.modello} ({m.tipo || 'Operativo'})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setAzioneMezzoScope(null)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                        >
                          Indietro
                        </button>
                        <button
                          type="button"
                          onClick={() => eseguiCambioMezzoSerie(turnoAzioneModal, azioneMezzoScope, mezzoNuovoScelto)}
                          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>Conferma Cambio Mezzo</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <button
                        type="button"
                        onClick={() => avviaModificaDaModalSerie(turnoAzioneModal, 'singolo')}
                        className="w-full text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-white font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-teal-400 shrink-0" />
                          <span>1. Modifica il singolo turno ({formatDateItaly(turnoAzioneModal.data)})</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => avviaModificaDaModalSerie(turnoAzioneModal, 'serie_futura')}
                        className="w-full text-left p-3 rounded-xl bg-teal-950/60 hover:bg-teal-900/70 border border-teal-500/40 text-teal-100 font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Repeat className="w-4 h-4 text-teal-300 shrink-0" />
                          <span>2. Modifica tutta la serie di turni futuri ({turniFuturiSerie.length} turni)</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMezzoNuovoScelto(turnoAzioneModal.mezzoAssegnato || getDefaultMezzoOperativo());
                          setAzioneMezzoScope('singolo');
                        }}
                        className="w-full text-left p-3 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-100 font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>3. Modifica il mezzo assegnato per il singolo turno</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMezzoNuovoScelto(turnoAzioneModal.mezzoAssegnato || getDefaultMezzoOperativo());
                          setAzioneMezzoScope('serie_futura');
                        }}
                        className="w-full text-left p-3 rounded-xl bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-400/50 text-cyan-100 font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-cyan-300 shrink-0" />
                          <span>4. Modifica il mezzo assegnato per tutta la serie di turni futuri ({turniFuturiSerie.length} turni)</span>
                        </span>
                      </button>
                    </div>
                  )}
                </>
              ) : isSerie ? (
                <>
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                    <Repeat className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      Questo turno fa parte di una <strong>serie di {serieCompleta.length} turni</strong> ({turniFuturiSerie.length} turni a partire dal {formatDateItaly(turnoAzioneModal.data)}). Scegli quale cancellazione eseguire:
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <button
                      type="button"
                      onClick={() => eseguiEliminaSingoloTurno(turnoAzioneModal)}
                      className="w-full text-left p-3 rounded-xl bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-red-100 font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                        <span>1. Elimina il singolo turno ({formatDateItaly(turnoAzioneModal.data)})</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => eseguiEliminaSerieFutura(turnoAzioneModal)}
                      className="w-full text-left p-3 rounded-xl bg-red-900/50 hover:bg-red-800/70 border border-red-500/60 text-red-100 font-black flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-red-300 shrink-0" />
                        <span>2. Elimina tutta la serie di turni futuri ({turniFuturiSerie.length} turni)</span>
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Sei sicuro di voler eliminare questo turno programmato dal calendario?
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setTurnoAzioneModal(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={() => eseguiEliminaSingoloTurno(turnoAzioneModal)}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase cursor-pointer"
                    >
                      Elimina Turno
                    </button>
                  </div>
                </div>
              )}

              {(isModificaMode || isSerie) && !azioneMezzoScope && (
                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setTurnoAzioneModal(null);
                      setAzioneMezzoScope(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* MODALE TABELLONE SETTIMANALE */}
      {mostraTabelloneSettimanaleModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="max-w-7xl w-full my-auto">
            <TabelloneTurniSettimanale
              turni={turni}
              sedi={sedi}
              volontari={volontari}
              isAdmin={true}
              onAggiornaTurni={onAggiornaTurni}
              onChiudi={() => setMostraTabelloneSettimanaleModal(false)}
              onModificaTurno={(turno) => {
                setMostraTabelloneSettimanaleModal(false);
                handleModificaTurno(turno);
              }}
              onDuplicaTurno={(turno) => {
                setMostraTabelloneSettimanaleModal(false);
                avviaDuplicazioneTurno(turno);
              }}
              onApriTurniRipetuti={() => {
                setMostraTabelloneSettimanaleModal(false);
                avviaProgrammazioneTurniRipetuti();
              }}
              onNuovoTurno={(targetSedeId, targetData) => {
                setMostraTabelloneSettimanaleModal(false);
                setTurnoInModifica(null);
                setFormSedeId(targetSedeId || sedi[0]?.id || '');
                setFormData(targetData || dataSelezionata);
                setFormNomeTurno('');
                setFormFascia('Mattina (08:00 - 14:00)');
                setFormInizio('08:00');
                setFormFine('14:00');
                setFormMezzo(getDefaultMezzoOperativo('T4609'));
                setFormAutistaId('');
                setFormCapoId('');
                setFormSoccorritore2Id('');
                setFormTerzoSoccorritoreId('');
                setFormCentraleId('');
                setFormCentralinistaId('');
                setFormOsservatoreId('');
                setFormChecklistObbligatoria(true);
                setFormNote('');
                setModaleTurnoAperta(true);
              }}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALE DUPLICAZIONE TURNO & DISPONIBILITA VOLONTARI           */}
      {/* ------------------------------------------------------------- */}
      {modaleDuplicaTurnoAperta && turnoDaDuplicare && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div
            className={`bg-slate-900 border-2 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 space-y-4 max-h-[92vh] overflow-y-auto ${
              tipoDuplicazione === 'disponibilita' ? 'border-emerald-500/70' : 'border-amber-500/70'
            }`}
          >
            
            {/* Header Modale */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-md ${
                    tipoDuplicazione === 'disponibilita'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  }`}
                >
                  {tipoDuplicazione === 'disponibilita' ? (
                    <Users className="w-6 h-6" />
                  ) : (
                    <Copy className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center flex-wrap gap-2">
                    <span>
                      {tipoDuplicazione === 'disponibilita'
                        ? 'Duplica Disponibilità Volontari'
                        : 'Duplica Turno'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                        tipoDuplicazione === 'disponibilita'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {tipoDuplicazione === 'disponibilita'
                        ? 'Equipaggio & Volontari'
                        : 'Struttura Turno'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tipoDuplicazione === 'disponibilita'
                      ? 'Replica la disponibilità dei volontari selezionati su altre date o turni ripetuti (stesse scelte di Duplica Turno: fino a quale data, giorni della settimana, cadenza, festivi e prefestivi).'
                      : 'Crea copie di questo turno su altre date o serie programmata, mantenendo mezzo assegnato e nome turno.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModaleDuplicaTurnoAperta(false);
                  setTurnoDaDuplicare(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={confermaDuplicazioneSingoloTurno} className="space-y-4 text-xs">
              
              {/* SCHEDA RIEPILOGO TURNO DI ORIGINE (MODELLO) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Turno di Origine (Modello da Duplicare)</span>
                  </span>
                  <span className="font-mono text-slate-400 text-xs">
                    Data attuale: <strong className="text-white">{turnoDaDuplicare.data}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Sede Operativa</span>
                    <span className="font-black text-white text-xs truncate block">{turnoDaDuplicare.sedeNome}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Fascia & Orario</span>
                    <span className="font-bold text-amber-300 text-xs block">
                      {turnoDaDuplicare.orarioInizio} - {turnoDaDuplicare.orarioFine}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate block">{turnoDaDuplicare.fasciaOraria}</span>
                  </div>

                  {/* MEZZO ASSEGNATO - EVIDENZIATO E CONFERMATO */}
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 shadow-inner">
                    <span className="text-[10px] text-amber-300 uppercase font-black flex items-center gap-1">
                      <Car className="w-3 h-3 text-amber-400" />
                      <span>Mezzo Assegnato</span>
                    </span>
                    <span className="font-black text-amber-200 text-sm font-mono block">
                      {turnoDaDuplicare.mezzoAssegnato || 'Non assegnato'}
                    </span>
                    <span className="text-[9.5px] text-amber-400/80 font-bold block">
                      ✓ Mantenuto identico
                    </span>
                  </div>

                  {/* NOME TURNO - EVIDENZIATO E CONFERMATO */}
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/50 shadow-inner">
                    <span className="text-[10px] text-blue-300 uppercase font-black flex items-center gap-1">
                      <Layers className="w-3 h-3 text-blue-400" />
                      <span>Nome Turno</span>
                    </span>
                    <span className="font-black text-blue-200 text-xs truncate block">
                      {turnoDaDuplicare.nomeTurno || 'Turno Ordinario'}
                    </span>
                    <span className="text-[9.5px] text-blue-400/80 font-bold block">
                      ✓ Mantenuto identico
                    </span>
                  </div>
                </div>
              </div>

              {/* TABS SELETTORE MODALITÀ DUPLICAZIONE */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setModalitaDuplicazione('serie')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    modalitaDuplicazione === 'serie'
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                  <span>Serie Programmata (Giorni Settimana, Festivi & Prefestivi)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalitaDuplicazione('singola')}
                  className={`py-2 px-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    modalitaDuplicazione === 'singola'
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Data Singola</span>
                </button>
              </div>

              {/* SEZIONE 1: SELEZIONE SELETTIVA VOLONTARI ("uno o più volontari") */}
              <div
                className={`p-4 rounded-2xl bg-slate-950 border space-y-3 ${
                  tipoDuplicazione === 'disponibilita' ? 'border-emerald-500/60' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span
                      className={`text-[11px] font-black uppercase tracking-wide block ${
                        tipoDuplicazione === 'disponibilita' ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      1. Scegli le Disponibilità da Duplicare (Uno o Più Volontari):
                    </span>
                    <p className="text-[10.5px] text-slate-400">
                      {tipoDuplicazione === 'disponibilita'
                        ? 'Spunta i singoli volontari di cui replicare la disponibilità sui giorni scelti sotto.'
                        : 'Spunta i singoli volontari da confermare nei turni duplicati oppure azzera per creare turni aperti.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selezionaTuttiRuoli}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10.5px] cursor-pointer"
                    >
                      Seleziona Tutti
                    </button>
                    <button
                      type="button"
                      onClick={deselezionaTuttiRuoli}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[10.5px] cursor-pointer"
                    >
                      Deseleziona Tutti
                    </button>
                  </div>
                </div>

                {tipoDuplicazione === 'disponibilita' &&
                  !turnoDaDuplicare.autista &&
                  !turnoDaDuplicare.soccorritore2 &&
                  !turnoDaDuplicare.terzoSoccorritore &&
                  !turnoDaDuplicare.operatoreCentrale &&
                  !turnoDaDuplicare.centralinista &&
                  !turnoDaDuplicare.osservatore && (
                    <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/50 text-amber-200 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        In questo turno non risulta ancora alcun volontario assegnato. Assegna prima almeno un volontario tramite <strong>Modifica</strong>, oppure usa <strong>Duplica Turno</strong> per replicare solo la struttura del turno.
                      </span>
                    </div>
                  )}

                {/* Griglia Volontari Ruolo per Ruolo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                  {/* Autista */}
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none ${
                      !turnoDaDuplicare.autista
                        ? 'bg-slate-900/40 border-slate-850 opacity-60 cursor-not-allowed'
                        : ruoliSelezionatiDuplicazione.autista
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">🚑 Autista</span>
                      <strong className="text-white text-xs truncate block">
                        {turnoDaDuplicare.autista ? turnoDaDuplicare.autista.nome : '— Non Assegnato —'}
                      </strong>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!turnoDaDuplicare.autista}
                      checked={Boolean(turnoDaDuplicare.autista && ruoliSelezionatiDuplicazione.autista)}
                      onChange={() => toggleRuoloDuplicazione('autista')}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                    />
                  </label>

                  {/* 2° Soccorritore */}
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none ${
                      !turnoDaDuplicare.soccorritore2
                        ? 'bg-slate-900/40 border-slate-850 opacity-60 cursor-not-allowed'
                        : ruoliSelezionatiDuplicazione.soccorritore2
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">🧑‍⚕️ 2° Soccorritore</span>
                      <strong className="text-white text-xs truncate block">
                        {turnoDaDuplicare.soccorritore2 ? turnoDaDuplicare.soccorritore2.nome : '— Non Assegnato —'}
                      </strong>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!turnoDaDuplicare.soccorritore2}
                      checked={Boolean(turnoDaDuplicare.soccorritore2 && ruoliSelezionatiDuplicazione.soccorritore2)}
                      onChange={() => toggleRuoloDuplicazione('soccorritore2')}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                    />
                  </label>

                  {/* 3° Soccorritore */}
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none ${
                      !turnoDaDuplicare.terzoSoccorritore
                        ? 'bg-slate-900/40 border-slate-850 opacity-60 cursor-not-allowed'
                        : ruoliSelezionatiDuplicazione.terzoSoccorritore
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">🧑‍⚕️ 3° Soccorritore</span>
                      <strong className="text-white text-xs truncate block">
                        {turnoDaDuplicare.terzoSoccorritore ? turnoDaDuplicare.terzoSoccorritore.nome : '— Non Assegnato —'}
                      </strong>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!turnoDaDuplicare.terzoSoccorritore}
                      checked={Boolean(turnoDaDuplicare.terzoSoccorritore && ruoliSelezionatiDuplicazione.terzoSoccorritore)}
                      onChange={() => toggleRuoloDuplicazione('terzoSoccorritore')}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                    />
                  </label>

                  {/* Operatore Centrale */}
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none ${
                      !turnoDaDuplicare.operatoreCentrale
                        ? 'bg-slate-900/40 border-slate-850 opacity-60 cursor-not-allowed'
                        : ruoliSelezionatiDuplicazione.operatoreCentrale
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">🎧 Centrale</span>
                      <strong className="text-white text-xs truncate block">
                        {turnoDaDuplicare.operatoreCentrale ? turnoDaDuplicare.operatoreCentrale.nome : '— Non Assegnato —'}
                      </strong>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!turnoDaDuplicare.operatoreCentrale}
                      checked={Boolean(turnoDaDuplicare.operatoreCentrale && ruoliSelezionatiDuplicazione.operatoreCentrale)}
                      onChange={() => toggleRuoloDuplicazione('operatoreCentrale')}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                    />
                  </label>

                  {/* Centralinista / Telefono */}
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none ${
                      !turnoDaDuplicare.centralinista
                        ? 'bg-slate-900/40 border-slate-850 opacity-60 cursor-not-allowed'
                        : ruoliSelezionatiDuplicazione.centralinista
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">📞 Centralinista</span>
                      <strong className="text-white text-xs truncate block">
                        {turnoDaDuplicare.centralinista ? turnoDaDuplicare.centralinista.nome : '— Non Assegnato —'}
                      </strong>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!turnoDaDuplicare.centralinista}
                      checked={Boolean(turnoDaDuplicare.centralinista && ruoliSelezionatiDuplicazione.centralinista)}
                      onChange={() => toggleRuoloDuplicazione('centralinista')}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                    />
                  </label>

                  {/* Osservatore */}
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none ${
                      !turnoDaDuplicare.osservatore
                        ? 'bg-slate-900/40 border-slate-850 opacity-60 cursor-not-allowed'
                        : ruoliSelezionatiDuplicazione.osservatore
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-sm'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 uppercase font-black block">👁️ Osservatore</span>
                      <strong className="text-white text-xs truncate block">
                        {turnoDaDuplicare.osservatore ? turnoDaDuplicare.osservatore.nome : '— Non Assegnato —'}
                      </strong>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!turnoDaDuplicare.osservatore}
                      checked={Boolean(turnoDaDuplicare.osservatore && ruoliSelezionatiDuplicazione.osservatore)}
                      onChange={() => toggleRuoloDuplicazione('osservatore')}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Banner informativo se il turno fa parte di una serie ripetuta */}
                {(() => {
                  const serieInfo = trovaTurniSerie(turnoDaDuplicare, turni);
                  const futuriCount = serieInfo.filter((x) => x.data > turnoDaDuplicare.data).length;
                  if (futuriCount === 0) return null;
                  return (
                    <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-500/40 text-[11px] text-teal-200 flex items-start gap-2">
                      <Repeat className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Turno ripetuto rilevato ({futuriCount} turni futuri in calendario):</strong> puoi inserire la disponibilità dei volontari selezionati direttamente nei turni ripetuti già programmati scegliendo la data limite, i giorni della settimana e ogni quanti giorni.
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* SEZIONE 2: PIANIFICAZIONE CALENDARIO */}
              {modalitaDuplicazione === 'singola' ? (
                /* MODALITÀ DATA SINGOLA */
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <label className="block text-slate-300 font-bold uppercase text-[11px]">
                    2. Nuova Data di Destinazione del Turno Duplicato:
                  </label>
                  <input
                    type="date"
                    required
                    value={dataDestinazioneDuplicazione}
                    onChange={(e) => setDataDestinazioneDuplicazione(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
                  />

                  {/* Scorciatoie Data */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Scorciatoie:</span>
                    <button
                      type="button"
                      onClick={() => setDataDestinazioneDuplicazione(addDaysISODate(turnoDaDuplicare.data, 1))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                    >
                      +1 Giorno (Domani)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataDestinazioneDuplicazione(addDaysISODate(turnoDaDuplicare.data, 7))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                    >
                      +7 Giorni (Prossima Settimana)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataDestinazioneDuplicazione(addDaysISODate(turnoDaDuplicare.data, 14))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                    >
                      +14 Giorni
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataDestinazioneDuplicazione(addMonthsISODate(turnoDaDuplicare.data, 1))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                    >
                      +1 Mese
                    </button>
                  </div>

                  {dataDestinazioneDuplicazione && (() => {
                    const dett = getDettaglioTipoGiorno(dataDestinazioneDuplicazione);
                    return (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">Classificazione giorno:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${dett.badgeBg} ${dett.badgeText}`}>
                          {dett.etichetta} ({dett.descrizione})
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* MODALITÀ SERIE PROGRAMMATA: GIORNI DELLA SETTIMANA, DATA LIMITE, FESTIVI & PREFESTIVI */
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  
                  {/* Periodo di Duplicazione: Data Inizio e Data Fine ("fino a quale data") */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold uppercase text-[10.5px] mb-1">
                        Data di Inizio Duplicazione:
                      </label>
                      <input
                        type="date"
                        required
                        value={duplicaDataInizio}
                        onChange={(e) => setDuplicaDataInizio(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-black uppercase text-[10.5px] mb-1 text-amber-300 flex items-center justify-between">
                        <span>Fino a quale data (Data Limite):</span>
                      </label>
                      <input
                        type="date"
                        required
                        min={duplicaDataInizio}
                        value={duplicaDataFine}
                        onChange={(e) => setDuplicaDataFine(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border-2 border-amber-500/70 text-white font-mono text-xs focus:border-amber-400 focus:outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Scorciatoie Data Fine */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Durata:</span>
                    <button
                      type="button"
                      onClick={() => setDuplicaDataFine(addDaysISODate(duplicaDataInizio, 7))}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10.5px] border border-slate-800 cursor-pointer"
                    >
                      +1 Settimana
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicaDataFine(addDaysISODate(duplicaDataInizio, 14))}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10.5px] border border-slate-800 cursor-pointer"
                    >
                      +2 Settimane
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicaDataFine(addDaysISODate(duplicaDataInizio, 30))}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10.5px] border border-slate-800 cursor-pointer"
                    >
                      +1 Mese (30 gg)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicaDataFine(addDaysISODate(duplicaDataInizio, 60))}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10.5px] border border-slate-800 cursor-pointer"
                    >
                      +2 Mesi
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicaDataFine(addDaysISODate(duplicaDataInizio, 90))}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10.5px] border border-slate-800 cursor-pointer"
                    >
                      +3 Mesi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = duplicaDataInizio.slice(0, 4);
                        setDuplicaDataFine(`${y}-12-31`);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10.5px] border border-amber-500/30 cursor-pointer"
                    >
                      Fine Anno
                    </button>
                  </div>

                  {/* SELEZIONE / ESCLUSIONE GIORNI DELLA SETTIMANA */}
                  <div className="space-y-2 pt-1 border-t border-slate-850">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <label className="block text-slate-200 font-black uppercase text-[11px]">
                          Giorni della Settimana in cui Duplicare (Clicca per Includere / Escludere):
                        </label>
                        <p className="text-[10px] text-slate-400">
                          Seleziona i giorni in cui il turno deve ripetersi o disattivali per escluderli.
                        </p>
                      </div>

                      {/* Presets rapidi */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDuplicaGiorniSettimana([1, 2, 3, 4, 5, 6, 0])}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 cursor-pointer font-bold"
                        >
                          Tutti (Lun-Dom)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDuplicaGiorniSettimana([1, 2, 3, 4, 5])}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-blue-300 text-[10px] border border-slate-800 cursor-pointer font-bold"
                        >
                          Feriali (Lun-Ven)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDuplicaGiorniSettimana([6, 0])}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] border border-slate-800 cursor-pointer font-bold"
                        >
                          Weekend (Sab-Dom)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const gOrig = getDayOfWeekISO(turnoDaDuplicare.data);
                            setDuplicaGiorniSettimana([gOrig]);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 text-[10px] border border-slate-800 cursor-pointer font-bold"
                        >
                          Solo Stesso Giorno
                        </button>
                      </div>
                    </div>

                    {/* 7 Pulsanti Giorni */}
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {GIORNI_SETTIMANA.map((g) => {
                        const attivo = duplicaGiorniSettimana.includes(g.valore);
                        const isSabatoODom = g.valore === 6 || g.valore === 0;
                        return (
                          <button
                            key={g.valore}
                            type="button"
                            onClick={() => toggleGiornoDuplicazione(g.valore)}
                            className={`py-2 px-1 rounded-xl text-center font-black transition-all cursor-pointer flex flex-col items-center justify-center border ${
                              attivo
                                ? isSabatoODom
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                                  : 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
                                : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300 hover:bg-slate-900'
                            }`}
                          >
                            <span className="text-xs uppercase">{g.label}</span>
                            <span className="text-[9px] font-normal hidden sm:inline">{g.nome}</span>
                            <span className="text-[8.5px] mt-0.5 opacity-80 font-mono">
                              {attivo ? '✓ Attivo' : '✗ Escluso'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CADENZA: OGNI QUANTI GIORNI */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-teal-500/40 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block text-teal-300 font-black uppercase text-[11px]">
                          Ogni quanti giorni ripetere la disponibilità (Cadenza):
                        </label>
                        <p className="text-[10px] text-slate-400">
                          Imposta <strong>1</strong> per ogni giorno valido, <strong>2</strong> a giorni alterni, <strong>3</strong> ogni 3 giorni, <strong>7</strong> ogni settimana, <strong>14</strong> ogni 2 settimane, ecc.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-slate-300">Ogni</span>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={duplicaOgniGiorni}
                          onChange={(e) => impostaCadenzaGiorni(parseInt(e.target.value, 10))}
                          className="w-20 p-2 rounded-xl bg-slate-950 border-2 border-teal-500/70 text-white font-mono font-black text-center text-sm focus:border-teal-400 focus:outline-none"
                        />
                        <span className="text-[11px] font-bold text-slate-300">
                          {duplicaOgniGiorni === 1 ? 'giorno' : 'giorni'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { n: 1, label: 'Ogni giorno (1)' },
                        { n: 2, label: 'Ogni 2 gg' },
                        { n: 3, label: 'Ogni 3 gg' },
                        { n: 4, label: 'Ogni 4 gg' },
                        { n: 5, label: 'Ogni 5 gg' },
                        { n: 7, label: 'Ogni 7 gg (1 sett.)' },
                        { n: 14, label: 'Ogni 14 gg (2 sett.)' },
                        { n: 28, label: 'Ogni 28 gg' }
                      ].map((p) => (
                        <button
                          key={p.n}
                          type="button"
                          onClick={() => impostaCadenzaGiorni(p.n)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer ${
                            duplicaOgniGiorni === p.n
                              ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-sm'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SEZIONE SPECIALE: GESTIONE GIORNI FESTIVI E PREFESTIVI */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/40 space-y-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px] font-black uppercase text-amber-300 tracking-wide">
                        Gestione Giorni Festivi e Prefestivi:
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      {/* Controllo Festivi */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-white flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                            <span>Giorni Festivi</span>
                          </span>
                          <span className="text-[9.5px] text-slate-400">Domeniche e Feste Nazionali</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          (Capodanno, Epifania, Pasqua, Pasquetta, 25 Apr, 1 Mag, 2 Giu, Ferragosto, Tutti i Santi, Immacolata, Natale, S. Stefano, Patrono)
                        </p>
                        <select
                          value={regolaFestivi}
                          onChange={(e) => setRegolaFestivi(e.target.value as any)}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:border-amber-400 focus:outline-none"
                        >
                          <option value="includi">✓ Includi normalmente (se il giorno coincide)</option>
                          <option value="escludi">⛔ Escludi sempre tutti i giorni Festivi</option>
                          <option value="solo">⭐ Duplica ESCLUSIVAMENTE nei giorni Festivi</option>
                        </select>
                      </div>

                      {/* Controllo Prefestivi */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-white flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                            <span>Giorni Prefestivi</span>
                          </span>
                          <span className="text-[9.5px] text-slate-400">Sabati & Vigilie di Festività</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          (Tutti i sabati ordinari e i giorni precedenti le festività nazionali, es. 24 Dic, 31 Dic, 14 Ago)
                        </p>
                        <select
                          value={regolaPrefestivi}
                          onChange={(e) => setRegolaPrefestivi(e.target.value as any)}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:border-amber-400 focus:outline-none"
                        >
                          <option value="includi">✓ Includi normalmente (se il giorno coincide)</option>
                          <option value="escludi">⛔ Escludi sempre tutti i giorni Prefestivi</option>
                          <option value="solo">⭐ Duplica ESCLUSIVAMENTE nei giorni Prefestivi</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODALITÀ DI APPLICAZIONE SU TURNI RIPETUTI / ESISTENTI */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-[11px] font-black uppercase text-slate-200 tracking-wide">
                  Come applicare sui turni già presenti in calendario:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGestioneTurniEsistentiDuplicazione('aggiorna_solo_esistenti')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      gestioneTurniEsistentiDuplicazione === 'aggiorna_solo_esistenti'
                        ? 'bg-teal-950/60 border-teal-400 text-teal-100 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-black text-[11px] text-teal-300">Solo Turni Ripetuti Esistenti</div>
                    <div className="text-[10px] mt-0.5 leading-snug">
                      Inserisce i volontari nei turni già creati, senza aggiungere nuovi turni.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGestioneTurniEsistentiDuplicazione('aggiorna_o_crea')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      gestioneTurniEsistentiDuplicazione === 'aggiorna_o_crea'
                        ? 'bg-amber-950/60 border-amber-400 text-amber-100 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-black text-[11px] text-amber-300">Aggiorna Esistenti + Crea Mancanti</div>
                    <div className="text-[10px] mt-0.5 leading-snug">
                      Inserisce nei turni già esistenti e crea il turno se la data è vuota.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGestioneTurniEsistentiDuplicazione('salta_esistenti')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      gestioneTurniEsistentiDuplicazione === 'salta_esistenti'
                        ? 'bg-slate-800 border-slate-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-black text-[11px] text-slate-200">Crea Solo Nuovi Turni</div>
                    <div className="text-[10px] mt-0.5 leading-snug">
                      Salta le date dove esiste già un turno nella stessa sede e fascia.
                    </div>
                  </button>
                </div>

                {gestioneTurniEsistentiDuplicazione !== 'salta_esistenti' && (
                  <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-300 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sovrascriviRuoliOccupati}
                      onChange={(e) => setSovrascriviRuoliOccupati(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400"
                    />
                    <span>
                      Sostituisci anche se il ruolo nel turno esistente è già occupato da un altro volontario (se disattivo, riempie solo i ruoli liberi)
                    </span>
                  </label>
                )}
              </div>

              {/* SEZIONE 3: ANTEPRIMA DATE & TURNI CHE VERRANNO AGGIORNATI / CREATI */}
              {(() => {
                const countAggiorna = dateDuplicazionePreview.filter((d) => d.azione === 'aggiorna').length;
                const countCrea = dateDuplicazionePreview.filter((d) => d.azione === 'crea').length;
                const totaleOperazioni = countAggiorna + countCrea;
                return (
                  <>
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-black uppercase text-white">
                            Anteprima:{' '}
                            {countAggiorna > 0 && countCrea > 0
                              ? `${countAggiorna} Turni Esistenti da Aggiornare + ${countCrea} Nuovi Turni`
                              : countAggiorna > 0
                              ? `${countAggiorna} Turni Ripetuti Esistenti da Aggiornare`
                              : `${countCrea} Nuovi Turni da Creare`}
                          </span>
                          {duplicaOgniGiorni > 1 && modalitaDuplicazione === 'serie' && (
                            <span className="px-2 py-0.5 rounded-lg bg-teal-950 border border-teal-500/50 text-teal-300 text-[10px] font-black">
                              Ogni {duplicaOgniGiorni} giorni
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Mezzo: <strong className="text-amber-300">{turnoDaDuplicare.mezzoAssegnato || 'N/D'}</strong> • Nome: <strong className="text-blue-300">{turnoDaDuplicare.nomeTurno || 'Turno Ordinario'}</strong>
                        </div>
                      </div>

                      {dateDuplicazionePreview.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-900 text-center text-slate-400 text-xs">
                          Nessuna data o turno ripetuto soddisfa i criteri selezionati. Modifica il periodo, i giorni della settimana, la cadenza "ogni quanti giorni" o la modalità sui turni esistenti.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                            {dateDuplicazionePreview.slice(0, 30).map((d) => (
                              <span
                                key={d.data}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-mono font-bold flex items-center gap-1 border ${
                                  d.azione === 'salta'
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 line-through opacity-60'
                                    : d.azione === 'aggiorna'
                                    ? 'bg-teal-950/80 text-teal-200 border-teal-500/60'
                                    : d.isFestivo
                                    ? 'bg-red-950/80 text-red-300 border-red-500/50'
                                    : d.isPrefestivo
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                                    : 'bg-slate-950 text-slate-200 border-slate-800'
                                }`}
                                title={d.motivoFestivo || d.motivoPrefestivo || d.data}
                              >
                                <span>{formatDateItaly(d.data)}</span>
                                {d.azione === 'aggiorna' && (
                                  <span className="text-[8.5px] px-1 bg-teal-800/80 text-teal-100 rounded">Aggiorna</span>
                                )}
                                {d.azione === 'crea' && (
                                  <span className="text-[8.5px] px-1 bg-amber-900/70 text-amber-200 rounded">Nuovo</span>
                                )}
                                {d.isFestivo && <span className="text-[9px] px-1 bg-red-900/60 rounded">Festivo</span>}
                                {d.isPrefestivo && !d.isFestivo && <span className="text-[9px] px-1 bg-amber-900/60 rounded">Prefestivo</span>}
                                {d.azione === 'salta' && <span className="text-[8.5px] text-amber-400">Saltato</span>}
                              </span>
                            ))}
                            {dateDuplicazionePreview.length > 30 && (
                              <span className="px-2 py-1 rounded-lg text-[10px] bg-slate-800 text-slate-400 font-bold">
                                +{dateDuplicazionePreview.length - 30} altri giorni...
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BOTTONI FOOTER */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setModaleDuplicaTurnoAperta(false);
                          setTurnoDaDuplicare(null);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer transition-colors"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        disabled={totaleOperazioni === 0}
                        className={`px-5 py-2.5 rounded-xl disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer ${
                          tipoDuplicazione === 'disponibilita'
                            ? 'bg-emerald-500 hover:bg-emerald-400'
                            : 'bg-amber-500 hover:bg-amber-400'
                        }`}
                      >
                        {tipoDuplicazione === 'disponibilita' ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span>
                          {tipoDuplicazione === 'disponibilita'
                            ? countAggiorna > 0 && countCrea > 0
                              ? `Duplica Disponibilità (${countAggiorna} Aggiornati + ${countCrea} Nuovi)`
                              : countAggiorna > 0
                              ? `Duplica Disponibilità su ${countAggiorna} Turni`
                              : `Duplica Disponibilità (${countCrea} Turni)`
                            : countAggiorna > 0 && countCrea > 0
                            ? `Duplica Turno (${countAggiorna} Aggiornati + ${countCrea} Nuovi)`
                            : countAggiorna > 0
                            ? `Aggiorna ${countAggiorna} Turni`
                            : `Duplica Turno (${countCrea} Nuovi)`}
                        </span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALE CREAZIONE TURNI RIPETUTI (SERIE / RICORRENZA PROGRAMMATA) */}
      {/* ------------------------------------------------------------- */}
      {modaleTurniRipetutiAperta && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-teal-500/70 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center shrink-0">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    Programmazione Turni Ripetuti (Serie)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scegli i giorni della settimana e la data di termine per generare l'intera serie di turni
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleTurniRipetutiAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfermaTurniRipetuti} className="space-y-4 text-xs">
              
              {/* Sezione e Mezzo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sezione / Sede Territoriale</label>
                  <select
                    value={ripSedeId}
                    onChange={(e) => setRipSedeId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} ({s.comune})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-slate-400 font-bold">Mezzo Assegnato al Turno</label>
                    {sigleInManutenzione.size > 0 && (
                      <span className="text-[10px] text-amber-400/90 font-semibold">
                        Esclusi {sigleInManutenzione.size} in manut.
                      </span>
                    )}
                  </div>
                  <select
                    value={mezziOperativi.some((m) => m.sigla === ripMezzo) ? ripMezzo : ''}
                    onChange={(e) => setRipMezzo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">— Nessun Mezzo Assegnato —</option>
                    {mezziOperativi.map((m) => (
                      <option key={m.id} value={m.sigla}>
                        {m.sigla} — {m.modello} ({m.tipo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tipo di Turno + Nome Turno (obbligatorio e sempre editabile) */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-slate-300 font-bold">
                      Tipo di Turno {tipiTurno.length > 0 && <span className="text-red-400">*</span>}
                    </label>
                    {canShowSubtab('tipi_turno') && (
                      <button
                        type="button"
                        onClick={() => {
                          setModaleTurniRipetutiAperta(false);
                          setVistaSottosezione('tipi_turno');
                        }}
                        className="text-[10.5px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        Gestisci Tipi di Turni
                      </button>
                    )}
                  </div>
                  <select
                    required={tipiTurno.length > 0}
                    value={ripTipoTurnoId}
                    onChange={(e) => setRipTipoTurnoId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-white font-bold focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">-- Seleziona Tipo di Turno --</option>
                    {tipiTurno.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {formatIconaPerTesto(tp.icona, '📅')} {tp.nome} ({tp.mansioniObbligatorie.length} mansioni)
                      </option>
                    ))}
                  </select>

                  {(() => {
                    const tipoSel = tipiTurno.find((tp) => tp.id === ripTipoTurnoId);
                    if (!tipoSel || tipoSel.mansioniObbligatorie.length === 0) return null;
                    const mansioniLive = risolviMansioniTipoTurnoLive(tipoSel.mansioniObbligatorie, catalogoMansioni);
                    return (
                      <div className="mt-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-1.5">
                        <div className="text-[10px] font-black uppercase text-indigo-300">
                          Mansioni previste per ogni turno ({tipoSel.nome}):
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {mansioniLive.map((m) => (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-indigo-500/30 text-[10.5px] text-slate-200 font-semibold"
                            >
                              <IconaEmoji icona={m.emoji} fallback="🎖️" size="xs" />
                              <span>{m.nome}</span>
                              <strong className="text-indigo-300 font-mono">
                                (Min {m.minimo} – Max {m.massimo})
                              </strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Nome Turno <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ripNomeTurno}
                    onChange={(e) => setRipNomeTurno(e.target.value)}
                    placeholder="es. Turno Emergenza 118, Protezione Civile, Servizio Manifestazione, Trasporto Dialisi..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-teal-300 font-bold placeholder-slate-500 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Fascia Oraria e Orari */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fascia Oraria</label>
                  <select
                    value={ripFascia}
                    onChange={(e) => {
                      const f = e.target.value as TurnoSedeOperativa['fasciaOraria'];
                      setRipFascia(f);
                      if (f.includes('08:00 - 14:00') || f.includes('Mattina')) {
                        setRipInizio('08:00');
                        setRipFine('14:00');
                      } else if (f.includes('14:00 - 20:00') || f.includes('Pomeriggio')) {
                        setRipInizio('14:00');
                        setRipFine('20:00');
                      } else if (f.includes('20:00 - 08:00') || f.includes('Notte')) {
                        setRipInizio('20:00');
                        setRipFine('08:00');
                      } else if (f.includes('Reperibilità')) {
                        setRipInizio('00:00');
                        setRipFine('23:59');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-teal-300 font-bold"
                  >
                    <option value="Mattina (08:00 - 14:00)">Mattina (08:00 - 14:00)</option>
                    <option value="Pomeriggio (14:00 - 20:00)">Pomeriggio (14:00 - 20:00)</option>
                    <option value="Notte (20:00 - 08:00)">Notte (20:00 - 08:00)</option>
                    <option value="Reperibilità H24">Reperibilità H24</option>
                    <option value="Servizio Ordinario Programmato">Servizio Ordinario Programmato</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orario Inizio</label>
                  <input
                    type="time"
                    required
                    value={ripInizio}
                    onChange={(e) => setRipInizio(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orario Fine</label>
                  <input
                    type="time"
                    required
                    value={ripFine}
                    onChange={(e) => setRipFine(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* QUANDO LA RIPETIZIONE DEVE AVVENIRE: GIORNI DELLA SETTIMANA   */}
              {/* ------------------------------------------------------------- */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span>Giorni della Settimana in cui ripetere il turno:</span>
                  </label>
                  <span className="text-[10px] text-teal-400 font-mono font-bold">
                    {ripGiorniSettimana.length} giorni/settimana
                  </span>
                </div>

                {/* Preset Rapidi per i Giorni */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold">Preimposta:</span>
                  <button
                    type="button"
                    onClick={() => setRipGiorniSettimana([1, 2, 3, 4, 5, 6, 0])}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                  >
                    Tutti (7/7)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRipGiorniSettimana([1, 2, 3, 4, 5])}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                  >
                    Feriali (Lun-Ven)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRipGiorniSettimana([6, 0])}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                  >
                    Weekend (Sab-Dom)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRipGiorniSettimana([1, 3, 5])}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                  >
                    Lun - Mer - Ven
                  </button>
                  <button
                    type="button"
                    onClick={() => setRipGiorniSettimana([2, 4])}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                  >
                    Mar - Gio
                  </button>
                </div>

                {/* 7 Pulsanti Toggle dei Giorni della Settimana */}
                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {GIORNI_SETTIMANA.map((g) => {
                    const isAttivo = ripGiorniSettimana.includes(g.valore);
                    return (
                      <button
                        key={g.valore}
                        type="button"
                        onClick={() => toggleGiornoSettimana(g.valore)}
                        className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition-all cursor-pointer border ${
                          isAttivo
                            ? 'bg-teal-500 text-slate-950 font-black border-teal-300 shadow-md shadow-teal-500/20 scale-102'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                        title={g.nome}
                      >
                        <span className="block text-xs uppercase">{g.label}</span>
                        <span className="text-[9px] block opacity-80">{isAttivo ? '✓ Attivo' : '—'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* FINO A QUANDO LA RIPETIZIONE DEVE AVVENIRE (PERIODO)          */}
              {/* ------------------------------------------------------------- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Data Inizio Ripetizione</label>
                  <input
                    type="date"
                    required
                    value={ripDataInizio}
                    onChange={(e) => setRipDataInizio(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span className="uppercase text-[11px] text-teal-300 font-black">Fino a Quando (Data Fine):</span>
                    <span className="text-[10px] text-slate-400">Termine serie</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={ripDataFine}
                    onChange={(e) => setRipDataFine(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border-2 border-teal-500/70 text-white font-mono text-sm focus:outline-none"
                  />
                  
                  {/* Scorciatoie Data Fine */}
                  <div className="flex items-center gap-1 flex-wrap pt-1.5">
                    <button
                      type="button"
                      onClick={() => setRipDataFine(addDaysISODate(ripDataInizio, 14))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                    >
                      +2 Sett.
                    </button>
                    <button
                      type="button"
                      onClick={() => setRipDataFine(addMonthsISODate(ripDataInizio, 1))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                    >
                      +1 Mese
                    </button>
                    <button
                      type="button"
                      onClick={() => setRipDataFine(getEndOfMonthISO(ripDataInizio))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                    >
                      Fine Mese
                    </button>
                    <button
                      type="button"
                      onClick={() => setRipDataFine(addMonthsISODate(ripDataInizio, 3))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                    >
                      +3 Mesi
                    </button>
                    <button
                      type="button"
                      onClick={() => setRipDataFine(`${ripDataInizio.slice(0, 4)}-12-31`)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                    >
                      Fine Anno
                    </button>
                  </div>
                </div>
              </div>

              {/* Composizione equipaggio gestita tramite Tipo di Turno selezionato */}

              {/* ------------------------------------------------------------- */}
              {/* LIVE ANTEPRIMA DEL NUMERO DI TURNI GENERATI                   */}
              {/* ------------------------------------------------------------- */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-950/80 via-slate-950 to-indigo-950/80 border-2 border-teal-500/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-xs font-black text-teal-200 uppercase">
                      Anteprima Generazione Serie
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Dal <strong>{ripDataInizio}</strong> al <strong>{ripDataFine}</strong> nei giorni selezionati:
                  </p>
                  {dateRipetutePreview.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {dateRipetutePreview.slice(0, 6).map((d) => (
                        <span key={d} className="px-1.5 py-0.2 rounded bg-slate-900 border border-teal-500/30 text-teal-300 font-mono text-[9.5px]">
                          {d.slice(5)}
                        </span>
                      ))}
                      {dateRipetutePreview.length > 6 && (
                        <span className="text-[10px] text-slate-400 font-bold">
                          ... + altri {dateRipetutePreview.length - 6} turni
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Turni che saranno creati:</span>
                  <span className="text-2xl font-black font-mono text-teal-300">
                    {dateRipetutePreview.length} Turni
                  </span>
                </div>
              </div>

              {/* Spunta per annullare l'obbligatorietà della checklist sulla serie */}
              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                !ripChecklistObbligatoria
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-100'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}>
                <input
                  type="checkbox"
                  checked={!ripChecklistObbligatoria}
                  onChange={(e) => setRipChecklistObbligatoria(!e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-bold text-xs block text-white">
                    Annulla l&apos;obbligatorietà della checklist per tutti i turni della serie
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    {ripChecklistObbligatoria
                      ? 'Stato attuale: Checklist OBBLIGATORIA su tutti i turni generati (impostazione predefinita).'
                      : 'Stato attuale: Checklist NON obbligatoria sui turni di questa serie (modificabile anche sul singolo turno).'}
                  </span>
                </div>
              </label>

              {/* Note aggiuntive */}
              <div>
                <label className="block text-slate-400 font-bold mb-1 text-[11px]">Note / Istruzioni Operative per la Serie</label>
                <input
                  type="text"
                  value={ripNote}
                  onChange={(e) => setRipNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300"
                  placeholder="es. Turno programmato convenzione ordinaria 118"
                />
              </div>

              {/* Bottoni Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleTurniRipetutiAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={dateRipetutePreview.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer border border-teal-400/50"
                >
                  <Repeat className="w-4 h-4" />
                  <span>Genera {dateRipetutePreview.length} Turni Ripetuti</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
