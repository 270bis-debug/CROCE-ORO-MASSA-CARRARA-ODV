import React, { useState, useEffect } from 'react';
import {
  Users,
  KeyRound,
  Lock,
  Unlock,
  UserCheck,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  X,
  Compass,
  Mail,
  AlertTriangle,
  PenTool,
  Calendar,
  Megaphone,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Bell,
  Paintbrush
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import { CroceOroLogo } from './CroceOroLogo';
import { ModalResetPassword } from './ModalResetPassword';
import {
  MezzoFuoriServizio,
  estraiSiglaDaEtichetta,
  MOTIVI_FUORI_SERVIZIO_LABELS
} from '../data/suggerimentiMezzi';
import { SignaturePad } from './SignaturePad';
import { UploadFirmaTrasparente } from './UploadFirmaTrasparente';
import { ModalChecklistInizioTurnoGuidata } from './ModalChecklistInizioTurnoGuidata';
import { ChecklistTemplate, ChecklistCompilataTurno, deduciTipoMezzoDaNome } from '../types/checklistTypes';
import { CHECKLIST_TEMPLATES_INIZIALI, trovaTemplatePerTipo } from '../data/checklistMockData';
import { MezzoFlotta } from '../types/adminTypes';
import { TurnoSedeOperativa, TimbraturaVolontario } from '../types/adminTypes';
import { verificaVolontarioInTurnoAdesso, hasTimbraturaApertaPerVolontario, EsitoVerificaTurno } from '../utils/turnoVerifica';
import { formatDateItaly, formatDateTimeItaly, getItalianDateParts } from '../utils/italianTime';

export interface SessioneTurno {
  attivo: boolean;
  volontarioId?: string;
  volontarioNome?: string;
  qualificaTurno?: string;
  mezzoScelto?: string;
  orarioInizio?: string;
}

interface SchermataTurnoVolontarioProps {
  sessione: SessioneTurno;
  volontari: Volontario[];
  flottaMezzi: string[];
  mezziFlotta?: MezzoFlotta[];
  mezziFuoriServizio?: Record<string, MezzoFuoriServizio>;
  onLogin: (volontario: Volontario, mezzo: string, ruolo: string) => void;
  onLogout?: () => void;
  onRegistraNuovoVolontario: (nuovo: Volontario) => void;
  onAggiornaVolontari?: (nuoviVolontari: Volontario[]) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onApriTabelloneTurni?: () => void;
  onApriBacheca?: () => void;
  conteggioBacheca?: number;
  onApriCentroNotifiche?: () => void;
  conteggioNotificheNonLette?: number;
  onApriTimbratura?: () => void;
  timbraturaAttiva?: boolean;
  checklistsTemplates?: ChecklistTemplate[];
  checklistsCompilate?: ChecklistCompilataTurno[];
  onSalvaChecklistCompilata?: (compilata: ChecklistCompilataTurno) => void;
  turni?: TurnoSedeOperativa[];
  timbrature?: TimbraturaVolontario[];
  missioneAttiva?: any;
  utenteCentraleAutenticato?: { id?: string; nome: string; cognome: string; pin?: string } | null;
  onAvviaFlussoTimbraturaPoiChecklist?: (
    volontario: Volontario,
    mezzo: string,
    ruolo: string,
    timbraturaGiaAperta: boolean
  ) => void;
  checklistCompilataOggi?: boolean;
  invitoAvvioDismissed?: boolean;
  onDismissInvitoAvvio?: () => void;
  onApriChecklistInCorso?: () => void;
}

export const SchermataTurnoVolontario: React.FC<SchermataTurnoVolontarioProps> = ({
  sessione,
  volontari,
  flottaMezzi,
  mezziFlotta = [],
  mezziFuoriServizio = {},
  onLogin,
  onRegistraNuovoVolontario,
  onAggiornaVolontari,
  onNotificaRadio,
  onApriTabelloneTurni,
  onApriBacheca,
  conteggioBacheca,
  onApriCentroNotifiche,
  conteggioNotificheNonLette = 0,
  onApriTimbratura,
  timbraturaAttiva = false,
  checklistsTemplates = CHECKLIST_TEMPLATES_INIZIALI,
  checklistsCompilate = [],
  onSalvaChecklistCompilata,
  turni = [],
  timbrature = [],
  missioneAttiva,
  utenteCentraleAutenticato = null,
  onAvviaFlussoTimbraturaPoiChecklist,
  checklistCompilataOggi = false,
  invitoAvvioDismissed = false,
  onDismissInvitoAvvio,
  onApriChecklistInCorso
}) => {
  const [volontarioSelezionatoId, setVolontarioSelezionatoId] = useState<string>(
    utenteCentraleAutenticato?.id && utenteCentraleAutenticato.id !== 'admin-centrale-root'
      ? utenteCentraleAutenticato.id
      : (volontari[0]?.id || '')
  );
  const [pinInput, setPinInput] = useState<string>('');
  const [ruoloSelezionato, setRuoloSelezionato] = useState<string>('Autista');
  const [errore, setErrore] = useState<string>('');

  // Modale Checklist Inizio Turno Guidata pre-operatività
  const [modaleChecklistAperta, setModaleChecklistAperta] = useState<boolean>(false);
  const [volontarioInAttesaChecklist, setVolontarioInAttesaChecklist] = useState<{
    vol: Volontario;
    mezzo: string;
    ruolo: string;
  } | null>(null);
  const [modaleVisualizzaChecklistAperta, setModaleVisualizzaChecklistAperta] = useState<boolean>(false);

  // Modale Registrazione Autonoma Nuovo Volontario
  const [modaleNuovoAperta, setModaleNuovoAperta] = useState<boolean>(false);
  const [nuovoNome, setNuovoNome] = useState('');
  const [nuovoCognome, setNuovoCognome] = useState('');
  const [nuovaQualifica, setNuovaQualifica] = useState<Volontario['qualifica']>('Autista');
  const [nuovoTelefono, setNuovoTelefono] = useState('');
  const [nuovaEmail, setNuovaEmail] = useState('');
  const [nuovoPIN, setNuovoPIN] = useState('');
  const [confermaPIN, setConfermaPIN] = useState('');
  const [nuovaFirma, setNuovaFirma] = useState<string | null>(null);
  const [erroreNuovo, setErroreNuovo] = useState('');

  // Modale Firma Mancante (per chi accede senza firma registrata sul device)
  const [modaleFirmaMancanteAperta, setModaleFirmaMancanteAperta] = useState(false);
  const [firmaVolontarioMancante, setFirmaVolontarioMancante] = useState<string | null>(null);
  const [volontarioDaFirmare, setVolontarioDaFirmare] = useState<Volontario | null>(null);
  const [erroreFirmaMancante, setErroreFirmaMancante] = useState('');

  // Modale Reset PIN / Password
  const [modaleResetAperta, setModaleResetAperta] = useState(false);

  // L'Amministratore non può entrare come volontario di bordo mezzo
  const volontariOperativi = React.useMemo(() => {
    return volontari
      .filter(v =>
        v.id !== 'vol-admin' &&
        v.pin !== '4451' &&
        !v.nome?.toLowerCase().includes('amministratore') &&
        !v.cognome?.toLowerCase().includes('amministratore')
      )
      .sort((a, b) => {
        const cogA = (a.cognome || '').trim();
        const cogB = (b.cognome || '').trim();
        const cmpCognome = cogA.localeCompare(cogB, 'it', { sensitivity: 'base' });
        if (cmpCognome !== 0) return cmpCognome;
        const nomA = (a.nome || '').trim();
        const nomB = (b.nome || '').trim();
        return nomA.localeCompare(nomB, 'it', { sensitivity: 'base' });
      });
  }, [volontari]);

  // Mantiene sempre selezionato un volontario valido (preferendo quello già autenticato in Centrale se presente)
  const preselectedCentraleRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const authId = utenteCentraleAutenticato?.id;
    if (
      authId &&
      authId !== 'admin-centrale-root' &&
      preselectedCentraleRef.current !== authId &&
      volontariOperativi.some(v => v.id === authId)
    ) {
      preselectedCentraleRef.current = authId;
      setVolontarioSelezionatoId(authId);
      return;
    }
    if ((!volontarioSelezionatoId || !volontariOperativi.some(v => v.id === volontarioSelezionatoId)) && volontariOperativi.length > 0) {
      setVolontarioSelezionatoId(volontariOperativi[0].id);
    }
  }, [volontariOperativi, volontarioSelezionatoId, utenteCentraleAutenticato?.id]);

  // Calcolo in tempo reale se il volontario selezionato è di turno in questo preciso momento
  const statoTurnoVolontario: EsitoVerificaTurno = React.useMemo(() => {
    const vSel = volontari.find(v => v.id === volontarioSelezionatoId) || volontariOperativi.find(v => v.id === volontarioSelezionatoId);
    if (!vSel) return { isDiTurno: false, motivo: 'Nessun volontario selezionato' };
    return verificaVolontarioInTurnoAdesso(vSel, turni, timbrature);
  }, [volontarioSelezionatoId, volontari, volontariOperativi, turni, timbrature]);

  // Calcolo promemoria se il volontario selezionato ha un turno programmato per domani
  const turnoDomani = React.useMemo(() => {
    const targetVolId = sessione.volontarioId || volontarioSelezionatoId;
    const targetVol = volontari.find(v => v.id === targetVolId) || volontariOperativi.find(v => v.id === targetVolId);
    if (!targetVol || !turni || turni.length === 0) return null;

    const itNow = getItalianDateParts();
    const tomorrowStr = itNow.tomorrowIsoDate;
    const [tomY, tomM, tomD] = tomorrowStr.split('-');

    const turniDomani = turni.filter(t => t && t.data === tomorrowStr);
    for (const t of turniDomani) {
      const slots = [
        { s: t.autista, r: 'Autista' },
        { s: t.caposervizio, r: 'Caposervizio' },
        { s: t.soccorritore2, r: 'Secondo Soccorritore' },
        { s: t.terzoSoccorritore, r: 'Terzo Soccorritore' },
        { s: t.operatoreCentrale, r: 'Operatore Centrale' },
        { s: t.centralinista, r: 'Centralinista' },
        { s: t.osservatore, r: 'Osservatore' }
      ];
      for (const slot of slots) {
        if (!slot.s) continue;
        if (slot.s.id === targetVol.id || (slot.s.nome && slot.s.nome.toLowerCase().trim() === `${targetVol.nome} ${targetVol.cognome}`.toLowerCase().trim())) {
          return {
            turno: t,
            ruolo: slot.r,
            dataFormatted: `${tomD}/${tomM}/${tomY}`,
            fascia: t.fasciaOraria || `${t.orarioInizio || '08:00'} - ${t.orarioFine || '14:00'}`,
            sede: t.sedeNome || 'Sede Operativa'
          };
        }
      }
    }
    return null;
  }, [sessione.volontarioId, volontarioSelezionatoId, volontari, volontariOperativi, turni]);

  // Se il turno programmato assegna un ruolo specifico, preimpostalo per comodità del volontario
  React.useEffect(() => {
    if (statoTurnoVolontario.isDiTurno && statoTurnoVolontario.dettaglioTurno?.ruoloAssegnato) {
      const r = statoTurnoVolontario.dettaglioTurno.ruoloAssegnato.toLowerCase();
      if (r.includes('autista')) setRuoloSelezionato('Autista');
      else if (r.includes('soccorritore')) setRuoloSelezionato('Soccorritore');
    }
  }, [statoTurnoVolontario]);

  // Se è presente una missione attiva (trasmessa da Centrale o locale), pre-seleziona prioritariamente il volontario assegnato
  React.useEffect(() => {
    if (missioneAttiva && !missioneAttiva.archiviata && !missioneAttiva.annullata) {
      if (missioneAttiva.volontarioAssegnatoEsclusivoId && volontariOperativi.some(v => v.id === missioneAttiva.volontarioAssegnatoEsclusivoId)) {
        setVolontarioSelezionatoId(missioneAttiva.volontarioAssegnatoEsclusivoId);
      } else if (missioneAttiva.destinatariVolontariIds && missioneAttiva.destinatariVolontariIds.length > 0) {
        const destTrovato = volontariOperativi.find(v => missioneAttiva.destinatariVolontariIds.includes(v.id));
        if (destTrovato) {
          setVolontarioSelezionatoId(destTrovato.id);
        }
      } else if (sessione.volontarioId && volontariOperativi.some(v => v.id === sessione.volontarioId)) {
        setVolontarioSelezionatoId(sessione.volontarioId);
      }
    }
  }, [missioneAttiva, volontariOperativi, sessione.volontarioId]);

  const handleTastierino = (cifra: string) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + cifra);
      setErrore('');
    }
  };

  const cancellaCifra = () => {
    setPinInput(prev => prev.slice(0, -1));
    setErrore('');
  };

  const effettuaLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Blocco assoluto per credenziali di amministrazione
    if (pinInput === '4451') {
      setErrore("⛔ L'Amministratore non può accedere come volontario di bordo mezzo. Utilizza la postazione di Centrale Operativa / Amministrazione.");
      setPinInput('');
      return;
    }

    const vol = volontariOperativi.find(v => v.id === volontarioSelezionatoId) || volontari.find(v => v.id === volontarioSelezionatoId);
    if (!vol) {
      setErrore('Seleziona il tuo nominativo.');
      return;
    }

    if (vol.id === 'vol-admin' || vol.pin === '4451' || vol.nome.toLowerCase().includes('amministratore')) {
      setErrore("⛔ L'Amministratore non può accedere come volontario di bordo mezzo. Utilizza la postazione di Centrale Operativa / Amministrazione.");
      setPinInput('');
      return;
    }

    if (vol.bloccatoPerTentativi || (vol.tentativiErrati && vol.tentativiErrati >= 3)) {
      setErrore(`🚨 Account bloccato per motivi di sicurezza dopo 3 tentativi errati (${vol.dataBlocco || 'Data non reg.'}). È stata inviata una notifica all'Amministratore per decidere lo sblocco o il reset.`);
      setPinInput('');
      return;
    }

    const isPinPreverificato = Boolean(
      utenteCentraleAutenticato?.id &&
      utenteCentraleAutenticato.id !== 'admin-centrale-root' &&
      utenteCentraleAutenticato.id === vol.id &&
      (!utenteCentraleAutenticato.pin || utenteCentraleAutenticato.pin === vol.pin)
    );
    const isPinCorretto = isPinPreverificato || pinInput === vol.pin;

    if (!isPinCorretto) {
      const nuoviSbagli = (vol.tentativiErrati || 0) + 1;
      const rimasti = Math.max(0, 3 - nuoviSbagli);
      setPinInput('');

      if (nuoviSbagli < 3) {
        setErrore(`❌ PIN errato! Ti rimangon${rimasti === 1 ? 'e' : 'o'} ${rimasti} tentativ${rimasti === 1 ? 'o' : 'i'} su 3 prima del blocco di sicurezza.`);
        if (onAggiornaVolontari) {
          const aggiornati = volontari.map(v => v.id === vol.id ? { ...v, tentativiErrati: nuoviSbagli } : v);
          onAggiornaVolontari(aggiornati);
        }
      } else {
        const dataOra = formatDateTimeItaly(undefined, false);
        setErrore(`🚨 ACCOUNT BLOCCATO! Hai inserito 3 volte il PIN errato. È stata inviata una notifica immediata all'Amministratore per decidere se azzerare gli sbagli o inviarti l'invito per il reset della password/PIN.`);
        if (onAggiornaVolontari) {
          const aggiornati = volontari.map(v => v.id === vol.id ? {
            ...v,
            tentativiErrati: 3,
            bloccatoPerTentativi: true,
            dataBlocco: dataOra
          } : v);
          onAggiornaVolontari(aggiornati);
        }
        if (onNotificaRadio) {
          onNotificaRadio(
            `🚨 ALLARME SICUREZZA: Il volontario ${vol.nome} ${vol.cognome} (${vol.qualifica}) ha inserito per 3 volte il PIN errato! Account BLOCCATO. Inviata notifica all'Amministratore per sblocco o invito al reset password/PIN.`,
            'allarme'
          );
        }
      }
      return;
    }

    // Successo PIN corretto: azzera eventuali sbagli precedenti se c'erano
    if (vol.tentativiErrati && vol.tentativiErrati > 0 && onAggiornaVolontari) {
      const aggiornati = volontari.map(v => v.id === vol.id ? { ...v, tentativiErrati: 0 } : v);
      onAggiornaVolontari(aggiornati);
    }

    // Obbligo tassativo Firma Digitale: finché non firma sul device non può entrare in turno
    if (!vol.firmaBase64) {
      setVolontarioDaFirmare(vol);
      setFirmaVolontarioMancante(null);
      setErroreFirmaMancante('');
      setModaleFirmaMancanteAperta(true);
      return;
    }

    // Al login NON si associa alcun mezzo al volontario e NON è ancora di turno finché non effettua la timbratura.
    // Il mezzo sarà scelto dal volontario all'avvio di un servizio autonomo o assegnato dalla Centrale in caso di servizio trasmesso.
    const verificaTurno = verificaVolontarioInTurnoAdesso(vol, turni, timbrature);
    const timbGiaAperta = Boolean(hasTimbraturaApertaPerVolontario(vol, timbrature));

    onLogin(vol, '', ruoloSelezionato);

    if (!timbGiaAperta && verificaTurno.haTurnoProgrammato && onAvviaFlussoTimbraturaPoiChecklist) {
      onAvviaFlussoTimbraturaPoiChecklist(vol, '', ruoloSelezionato, false);
    }

    setPinInput('');
    setErrore('');
    if (onNotificaRadio) {
      if (timbGiaAperta) {
        onNotificaRadio(
          `🟢 ACCESSO VOLONTARIO (IN TURNO - TIMBRATO): ${vol.nome} ${vol.cognome} (${ruoloSelezionato}) ha effettuato l'accesso (${verificaTurno.motivo}).`,
          'mezzo'
        );
      } else {
        onNotificaRadio(
          `🔵 ACCESSO VOLONTARIO (LOGGATO): ${vol.nome} ${vol.cognome} (${ruoloSelezionato}) ha effettuato il login al terminale. Effettuerà la timbratura per risultare in turno (nessun mezzo associato).`,
          'sistema'
        );
      }
    }
  };

  const handleConfermaChecklist = (compilata: ChecklistCompilataTurno) => {
    // 1. Salva la checklist compilata
    onSalvaChecklistCompilata?.(compilata);
    try {
      const esistenti: ChecklistCompilataTurno[] = JSON.parse(localStorage.getItem('CROCE_ORO_CHECKLIST_COMPILATE') || '[]');
      localStorage.setItem('CROCE_ORO_CHECKLIST_COMPILATE', JSON.stringify([compilata, ...esistenti]));
    } catch {}

    // 2. Invia notifica radio appropriata alla centrale
    if (!compilata.tuttoConforme || (compilata.anomalieRilevate && compilata.anomalieRilevate.length > 0)) {
      const descAnomalie = (compilata.anomalieRilevate || []).join(', ');
      onNotificaRadio?.(
        `⚠️ CHECKLIST ${compilata.mezzoSigla}: Inizio turno con anomalie da parte di ${compilata.volontarioNome}! Difetti riscontrati: ${descAnomalie}`,
        'allarme'
      );
    } else {
      onNotificaRadio?.(
        `✅ CHECKLIST ${compilata.mezzoSigla}: Controllo inizio turno completato regolarmente da ${compilata.volontarioNome}. Tutti i punti conformi! Mezzo operativo.`,
        'mezzo'
      );
    }

    // 3. Completa il login e attiva l'operatività verso la Centrale
    if (volontarioInAttesaChecklist) {
      onLogin(
        volontarioInAttesaChecklist.vol,
        volontarioInAttesaChecklist.mezzo,
        volontarioInAttesaChecklist.ruolo
      );
    }
    setModaleChecklistAperta(false);
    setVolontarioInAttesaChecklist(null);
  };

  const salvaNuovoVolontarioAutonomo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuovoNome.trim() || !nuovoCognome.trim()) {
      setErroreNuovo('Inserisci Nome e Cognome.');
      return;
    }
    if (!nuovoTelefono.trim() || nuovoTelefono.trim().length < 6) {
      setErroreNuovo('Il numero di telefono cellulare è obbligatorio.');
      return;
    }
    const emailPulita = nuovaEmail.trim().toLowerCase();
    if (!emailPulita || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPulita)) {
      setErroreNuovo("L'indirizzo email è obbligatorio e deve essere valido (es. nome@dominio.it).");
      return;
    }
    if (!/^\d{4}$/.test(nuovoPIN)) {
      setErroreNuovo('Il PIN deve essere esattamente di 4 cifre.');
      return;
    }
    if (nuovoPIN === '4451') {
      setErroreNuovo('Questo codice PIN è riservato. Scegli un codice diverso.');
      return;
    }
    if (nuovoPIN !== confermaPIN) {
      setErroreNuovo('I due PIN inseriti non coincidono.');
      return;
    }

    // Verifica obbligatorietà firma digitale sullo schermo del device
    if (!nuovaFirma || !nuovaFirma.trim()) {
      setErroreNuovo("Firma obbligatoria sullo schermo del dispositivo: devi tracciare la tua firma autografa per completare la registrazione. Finché non completi la firma non puoi entrare.");
      return;
    }

    const nuovo: Volontario = {
      id: `vol-${Date.now()}`,
      nome: nuovoNome.trim(),
      cognome: nuovoCognome.trim(),
      matricola: `VOL-${Math.floor(100 + Math.random() * 900)}`,
      qualifica: nuovaQualifica,
      telefono: nuovoTelefono.trim(),
      email: emailPulita,
      pin: nuovoPIN,
      dataRegistrazione: formatDateItaly(),
      inTurno: false,
      firmaBase64: nuovaFirma
    };

    onRegistraNuovoVolontario(nuovo);
    setVolontarioSelezionatoId(nuovo.id);
    setModaleNuovoAperta(false);
    setNuovoNome('');
    setNuovoCognome('');
    setNuovoTelefono('');
    setNuovaEmail('');
    setNuovoPIN('');
    setConfermaPIN('');
    setNuovaFirma(null);
    setErroreNuovo('');
    setErrore('');
  };

  const salvaFirmaMancanteEdEntra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmaVolontarioMancante || !firmaVolontarioMancante.trim()) {
      setErroreFirmaMancante("Firma obbligatoria sullo schermo: traccia la tua firma con il dito o pennino per completare l'accesso. Finché non completi la firma non puoi entrare.");
      return;
    }

    if (volontarioDaFirmare) {
      const aggiornato: Volontario = {
        ...volontarioDaFirmare,
        firmaBase64: firmaVolontarioMancante
      };

      if (onAggiornaVolontari) {
        const aggiornati = volontari.map(v => v.id === aggiornato.id ? aggiornato : v);
        onAggiornaVolontari(aggiornati);
      }

      setModaleFirmaMancanteAperta(false);
      const vTarget = aggiornato;
      setVolontarioDaFirmare(null);
      setFirmaVolontarioMancante(null);

      // Al login non si associa alcun mezzo al volontario; entra in turno solo quando effettua la timbratura
      const verificaTurno = verificaVolontarioInTurnoAdesso(vTarget, turni, timbrature);
      const timbGiaAperta = Boolean(hasTimbraturaApertaPerVolontario(vTarget, timbrature));
      onLogin(vTarget, '', ruoloSelezionato);
      if (!timbGiaAperta && verificaTurno.haTurnoProgrammato && onAvviaFlussoTimbraturaPoiChecklist) {
        onAvviaFlussoTimbraturaPoiChecklist(vTarget, '', ruoloSelezionato, false);
      }
      setPinInput('');
      setErrore('');
    }
  };

  // Se la sessione è attiva, mostra il badge riassuntivo in testa al terminale:
  // distingue chiaramente "LOGGATO" (senza timbratura) vs "DI TURNO" (con timbratura attiva)
  if (sessione.attivo) {
    const mostraInvitoAvvio = !timbraturaAttiva && !invitoAvvioDismissed;
    return (
      <div className="flex flex-col">
        <div className={`${
          timbraturaAttiva ? 'bg-emerald-950/80 border-emerald-500/40' : 'bg-sky-950/80 border-sky-500/40'
        } border-b px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-md`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              timbraturaAttiva ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'
            }`} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-white text-xs truncate">
                  {timbraturaAttiva ? '🟢' : '🔵'} {sessione.volontarioNome} • <span className={timbraturaAttiva ? 'text-emerald-300 font-semibold' : 'text-sky-300 font-semibold'}>{sessione.qualificaTurno}</span>
                </span>
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border ${
                  timbraturaAttiva
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    : 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                }`}>
                  {timbraturaAttiva ? 'Di Turno (Timbrato)' : 'Loggato (Non di Turno)'}
                </span>
              </div>
              <span className="text-[10px] text-slate-300 block truncate">
                {sessione.mezzoScelto ? (
                  <>
                    Mezzo in servizio: <strong className="text-amber-400">{sessione.mezzoScelto}</strong> •{' '}
                  </>
                ) : null}
                {timbraturaAttiva ? `In turno dalle ${sessione.orarioInizio}` : `Accesso dalle ${sessione.orarioInizio} • Timbra per entrare in turno`}
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 shrink-0">
            {onApriTimbratura && (
              <button
                type="button"
                onClick={onApriTimbratura}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer border ${
                  timbraturaAttiva
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 font-black'
                }`}
                title="Apri sezione Timbratura Presenza GPS & Ore di Servizio"
              >
                <Paintbrush className={`w-3.5 h-3.5 ${timbraturaAttiva ? 'text-white' : 'text-slate-950'}`} />
                <span>{timbraturaAttiva ? 'Timbrato (Uscita)' : 'Timbra Ingresso'}</span>
                {timbraturaAttiva && (
                  <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping shrink-0" />
                )}
              </button>
            )}

            {onApriCentroNotifiche && (
              <button
                type="button"
                onClick={onApriCentroNotifiche}
                className={`px-2.5 py-1 rounded-lg text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer border ${
                  conteggioNotificheNonLette > 0
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-400 animate-pulse'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="Centro Notifiche Ricevute (Archivio Permanente)"
              >
                <Bell className={`w-3.5 h-3.5 ${conteggioNotificheNonLette > 0 ? 'text-amber-300' : 'text-slate-300'}`} />
                <span className="hidden sm:inline">Notifiche</span>
                {conteggioNotificheNonLette > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-black border border-red-400">
                    {conteggioNotificheNonLette}
                  </span>
                )}
              </button>
            )}

            {onApriBacheca && (
              <button
                type="button"
                onClick={onApriBacheca}
                className="px-2.5 py-1 rounded-lg bg-violet-600/90 hover:bg-violet-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer"
                title="Apri Bacheca di Sezione e Comunicazioni Ufficiali"
              >
                <Megaphone className="w-3.5 h-3.5 text-violet-200" />
                <span className="hidden sm:inline">Bacheca</span>
                {typeof conteggioBacheca === 'number' && conteggioBacheca > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-violet-950 text-violet-200 text-[9px] font-black border border-violet-400/40">
                    {conteggioBacheca}
                  </span>
                )}
              </button>
            )}

            {onApriTabelloneTurni && (
              <button
                type="button"
                onClick={onApriTabelloneTurni}
                className="px-2.5 py-1 rounded-lg bg-teal-600/90 hover:bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer"
                title="Apri Tabellone Turni Settimanale Sezioni Territoriali"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-200" />
                <span className="hidden sm:inline">Tabellone Turni</span>
                <span className="sm:hidden">Turni</span>
              </button>
            )}

            {sessione.mezzoScelto && onApriChecklistInCorso && (
              <button
                type="button"
                onClick={() => onApriChecklistInCorso()}
                className="px-2.5 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer"
                title="Consulta o compila la Checklist Mezzo"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-200" />
                <span className="hidden sm:inline">Checklist Mezzo</span>
                <span className="sm:hidden">Checklist</span>
              </button>
            )}
          </div>
        </div>

        {/* Invito rapido per chi è loggato ma non ha ancora timbrato l'ingresso */}
        {mostraInvitoAvvio && (
          <div className="bg-amber-500/15 border-b border-amber-500/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-100">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold truncate">
                🔵 Sei loggato ma non ancora di turno: effettua la Timbratura di ingresso per entrare in turno
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onApriTimbratura && (
                <button
                  type="button"
                  onClick={onApriTimbratura}
                  className="px-2.5 py-1 rounded-lg font-black text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-all bg-amber-500 hover:bg-amber-400 text-slate-950 shadow"
                >
                  <span>Timbra Ora</span>
                </button>
              )}
              {onDismissInvitoAvvio && (
                <button
                  type="button"
                  onClick={onDismissInvitoAvvio}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Nascondi promemoria"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Schermata di blocco / Accesso Inizio Turno con PIN personale
  return (
    <div className="p-4 sm:p-5 flex flex-col flex-1 justify-center space-y-4 max-w-sm mx-auto w-full text-slate-800">
      
      {/* Header Accesso Account Volontario con Logo Ufficiale Croce Oro */}
      <div className="text-center space-y-1">
        <CroceOroLogo size="xl" className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-2 shadow-lg shadow-amber-500/10" />
        <h3 className="text-base font-black text-[#1d1a60] uppercase tracking-wide">
          Accesso Terminale Volontario
        </h3>
        <p className="text-xs text-slate-500">
          Seleziona il tuo nome e inserisci il tuo PIN a 4 cifre per effettuare il login (entrerai in turno dopo la timbratura)
        </p>
      </div>

      {errore && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errore}</span>
        </div>
      )}

      {/* BANNER NOTIFICA SERVIZIO ATTIVO IN CORSO: SE IL VOLONTARIO È USCITO INAVVERTITAMENTE */}
      {Boolean(missioneAttiva && !missioneAttiva.archiviata && !missioneAttiva.annullata) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500 shadow-xl text-slate-900 space-y-2.5 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shrink-0 shadow">
              🚨
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs uppercase text-amber-950 tracking-wide">
                  Servizio Attivo In Corso
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                  {missioneAttiva.codice}
                </span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase text-white ${
                  missioneAttiva.urgenza === 'ROSSO' ? 'bg-red-600' : missioneAttiva.urgenza === 'GIALLO' ? 'bg-amber-600' : 'bg-emerald-600'
                }`}>
                  {missioneAttiva.urgenza || 'VERDE'}
                </span>
              </div>
              <p className="text-[10.5px] text-amber-900 font-bold truncate">
                {missioneAttiva.ambito || 'Servizio di Soccorso'} • {missioneAttiva.sintesi || missioneAttiva.tipologiaServizio || 'Scheda operativa trasmessa dalla Centrale'}
              </p>
            </div>
          </div>

          <div className="bg-white/95 p-2.5 rounded-xl border border-amber-300 text-[11px] text-slate-800 space-y-1 shadow-sm">
            <div className="flex items-center gap-1 truncate">
              <span className="font-bold text-[#1d1a60]">📍 Obiettivo:</span>
              <span className="font-semibold text-slate-900 truncate">{missioneAttiva.indirizzo || 'Massa-Carrara'}</span>
            </div>
            {missioneAttiva.mezzoAssegnato && (
              <div className="flex items-center gap-1 truncate">
                <span className="font-bold text-[#1d1a60]">🚑 Mezzo Assegnato:</span>
                <span className="font-black text-amber-800">{missioneAttiva.mezzoAssegnato}</span>
              </div>
            )}
            {(missioneAttiva.dataArrivoRichiestaServizio || missioneAttiva.oraArrivoRichiestaServizio) && (
              <div className="flex items-center gap-1 flex-wrap text-[10.5px]">
                <span className="font-bold text-[#1d1a60]">📥 Arrivo Richiesta:</span>
                <span className="font-mono font-bold text-slate-900">
                  {missioneAttiva.dataArrivoRichiestaServizio || '-'} {missioneAttiva.oraArrivoRichiestaServizio || ''}
                </span>
              </div>
            )}
            {(missioneAttiva.dataInizioServizioSpecifico || missioneAttiva.oraInizioServizioSpecifico) && (
              <div className="flex items-center gap-1 flex-wrap text-[10.5px]">
                <span className="font-bold text-indigo-800">🗓️ Inizio Servizio Specifico:</span>
                <span className="font-mono font-bold text-indigo-950">
                  {missioneAttiva.dataInizioServizioSpecifico || '-'} {missioneAttiva.oraInizioServizioSpecifico || ''}
                </span>
              </div>
            )}
          </div>

          <div className="p-2 rounded-xl bg-amber-500/25 border border-amber-400 text-[11px] text-amber-950 font-bold flex items-center gap-1.5">
            <span>👉</span>
            <span>Inserisci il tuo PIN a 4 cifre per accedere subito e continuare a gestire questo servizio senza perdere i dati!</span>
          </div>
        </div>
      )}

      {/* Selezione Volontario */}
      <div className="space-y-1">
        <label className="block text-[11px] font-bold text-slate-700 uppercase">
          1. Seleziona il tuo Nominativo
        </label>
        <select
          value={volontarioSelezionatoId}
          onChange={(e) => {
            setVolontarioSelezionatoId(e.target.value);
            setPinInput('');
            setErrore('');
          }}
          className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          {volontariOperativi.map((v) => (
            <option key={v.id} value={v.id}>
              {v.cognome} {v.nome} ({v.qualifica}) {v.richiedeResetPassword ? '⚠️ Reset Richiesto' : ''}
            </option>
          ))}
        </select>
        
        {/* Badge Stato Turno / Timbratura del Volontario selezionato */}
        {statoTurnoVolontario.isDiTurno ? (
          <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-400/60 text-emerald-950 text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center font-black shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>Di Turno (Timbratura Attiva)</span>
                </div>
                <p className="text-[10px] text-emerald-900 truncate">
                  {statoTurnoVolontario.motivo}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider shrink-0 shadow-sm">
              Timbrato
            </span>
          </div>
        ) : statoTurnoVolontario.haTurnoProgrammato ? (
          <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center font-black shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-amber-900">
                  Turno Programmato (Da Timbrare)
                </div>
                <p className="text-[10px] text-amber-800 truncate">
                  {statoTurnoVolontario.motivo}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shrink-0">
              Solo Login
            </span>
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold text-slate-700">
                  Non di Turno • Solo Login
                </div>
                <p className="text-[9.5px] text-slate-500 truncate">
                  Nessun mezzo associato • Timbra per entrare in turno
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold text-[9px] uppercase tracking-wider shrink-0">
              Non Timbrato
            </span>
          </div>
        )}

        {/* Promemoria Turno per Domani (Notifica programmata alle ore 09:00 del giorno prima) */}
        {turnoDomani && (
          <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-700 flex items-center justify-center font-black shrink-0">
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-indigo-900 flex items-center gap-1.5">
                  <span>📅 Turno Domani ({turnoDomani.dataFormatted})</span>
                </div>
                <p className="text-[10px] text-indigo-700 truncate">
                  {turnoDomani.fascia} • {turnoDomani.sede} (Ruolo: {turnoDomani.ruolo})
                </p>
              </div>
            </div>
            {onApriTabelloneTurni && (
              <button
                type="button"
                onClick={onApriTabelloneTurni}
                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] uppercase shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm"
              >
                Tabellone
              </button>
            )}
          </div>
        )}

        {/* Tasto Registrazione Autonoma per chi non è ancora in elenco */}
        <div className="text-right pt-0.5">
          <button
            type="button"
            onClick={() => setModaleNuovoAperta(true)}
            className="text-[11px] text-amber-700 hover:text-amber-800 font-bold underline decoration-amber-500 cursor-pointer"
          >
            ➕ Non sei in elenco? Crea il tuo Profilo & PIN
          </button>
        </div>
      </div>

      {/* Banner se l'amministratore ha inviato l'invito a resettare il PIN */}
      {volontariOperativi.find(v => v.id === volontarioSelezionatoId)?.richiedeResetPassword && (
        <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs flex items-center justify-between gap-2 shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong className="block text-amber-950 font-black">Invito Reset Password/PIN Ricevuto</strong>
              <span className="text-[11px] text-amber-800">L'Amministratore ti invita a impostare un nuovo PIN personale.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModaleResetAperta(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase rounded-xl shadow transition-all shrink-0 cursor-pointer"
          >
            Reimposta PIN
          </button>
        </div>
      )}

      {/* Selezione Ruolo nel Turno */}
      <div>
        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
          Ruolo di Turno
        </label>
        <select
          value={ruoloSelezionato}
          onChange={(e) => setRuoloSelezionato(e.target.value)}
          className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="Autista">Autista</option>
          <option value="Soccorritore">Soccorritore</option>
        </select>
      </div>

      {/* Visualizzatore PIN a 4 cifre, Accesso Diretto già autenticato, o Banner Bloccato */}
      {(() => {
        const volCorrente = volontari.find(v => v.id === volontarioSelezionatoId);
        const isBloccato = !!(volCorrente?.bloccatoPerTentativi || (volCorrente?.tentativiErrati && volCorrente.tentativiErrati >= 3));
        const tentativiSbagliati = volCorrente?.tentativiErrati || 0;
        const tentativiRimasti = Math.max(0, 3 - tentativiSbagliati);
        const isPreverificatoCentrale = Boolean(
          volCorrente &&
          utenteCentraleAutenticato?.id &&
          utenteCentraleAutenticato.id !== 'admin-centrale-root' &&
          utenteCentraleAutenticato.id === volCorrente.id &&
          (!utenteCentraleAutenticato.pin || utenteCentraleAutenticato.pin === volCorrente.pin)
        );

        if (isBloccato) {
          return (
            <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-500 text-red-950 text-xs space-y-2 shadow-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 animate-bounce" />
                <div>
                  <strong className="block text-red-900 font-black text-sm uppercase">Account Bloccato per Sicurezza</strong>
                  <span className="text-[11px] text-red-700">Hai esaurito i 3 tentativi PIN a tua disposizione {volCorrente?.dataBlocco ? `(${volCorrente.dataBlocco})` : ''}.</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-red-200">
                È stata inviata una notifica all'Amministratore della Centrale, che deciderà se azzerare gli sbagli e permetterti di riprovare, oppure inviarti l'invito per reimpostare la tua password/PIN.
              </p>
              <button
                type="button"
                onClick={() => setModaleResetAperta(true)}
                className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <KeyRound className="w-4 h-4 text-slate-950" />
                <span>Hai ricevuto l'invito? Reimposta PIN</span>
              </button>
            </div>
          );
        }

        if (isPreverificatoCentrale) {
          return (
            <div className="space-y-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 text-xs flex items-center gap-2.5 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong className="block text-emerald-900 font-black uppercase text-[11px]">
                    PIN già verificato — Accesso Diretto
                  </strong>
                  <span className="text-[11px] text-emerald-800">
                    Sei già autenticato con il tuo account ({volCorrente?.nome} {volCorrente?.cognome}): puoi accedere subito senza reinserire il PIN.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => effettuaLogin()}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Entra come Volontario (Accesso Diretto)</span>
              </button>
            </div>
          );
        }

        return (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold px-1">
                <label className="text-slate-700 uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  2. Digita PIN (Hai 3 Tentativi)
                </label>
                {tentativiSbagliati > 0 ? (
                  <span className="text-red-600 bg-red-100/80 px-2 py-0.5 rounded-full border border-red-300 font-black animate-pulse text-[10px]">
                    ⚠️ Rimangon{tentativiRimasti === 1 ? 'e' : 'o'} {tentativiRimasti} tentativ{tentativiRimasti === 1 ? 'o' : 'i'} su 3
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                    3 tentativi rimanenti
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 py-2 bg-slate-100 rounded-2xl border border-slate-300">
                {[0, 1, 2, 3].map((idx) => {
                  const hasChar = pinInput.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-10 h-11 rounded-xl flex items-center justify-center font-mono text-xl font-black transition-all ${
                        hasChar
                          ? 'bg-[#1d1a60] text-amber-300 border-2 border-[#bfa353] shadow-md scale-105'
                          : 'bg-white text-slate-300 border border-slate-300'
                      }`}
                    >
                      {hasChar ? '•' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tastierino Numerico 0-9 Touch Friendly per Smartphone */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((cifra) => (
                <button
                  key={cifra}
                  type="button"
                  onClick={() => handleTastierino(cifra)}
                  className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-mono font-bold text-lg active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                >
                  {cifra}
                </button>
              ))}
              <button
                type="button"
                onClick={cancellaCifra}
                className="h-11 rounded-xl bg-red-100 hover:bg-red-200 border border-red-200 text-red-700 font-bold text-xs uppercase active:scale-95 transition-all flex items-center justify-center cursor-pointer"
              >
                Cancella
              </button>
              <button
                type="button"
                onClick={() => handleTastierino('0')}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-mono font-bold text-lg active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => effettuaLogin()}
                disabled={pinInput.length !== 4}
                className={`h-11 rounded-xl font-black text-xs uppercase active:scale-95 transition-all flex items-center justify-center shadow-md cursor-pointer ${
                  pinInput.length === 4
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-bounce'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Entra
              </button>
            </div>
          </>
        );
      })()}

      {/* Pulsante Reset PIN se l'utente ha ricevuto un invito dall'amministratore */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setModaleResetAperta(true)}
          className="text-[11px] text-slate-500 hover:text-amber-800 font-bold underline flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
          <span>Hai ricevuto un invito a resettare il PIN / password?</span>
        </button>
      </div>

      {/* SOTTO-MODALE REGISTRAZIONE AUTONOMA VOLONTARIO */}
      {modaleNuovoAperta && (
        <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
          <form
            onSubmit={salvaNuovoVolontarioAutonomo}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-3 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                <UserPlus className="w-4 h-4 text-amber-400" />
                Crea il tuo Profilo & PIN
              </h4>
              <button
                type="button"
                onClick={() => setModaleNuovoAperta(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {erroreNuovo && (
              <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                {erroreNuovo}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">Nome *</label>
                <input
                  type="text"
                  required
                  value={nuovoNome}
                  onChange={(e) => setNuovoNome(e.target.value)}
                  placeholder="Es: Marco"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">Cognome *</label>
                <input
                  type="text"
                  required
                  value={nuovoCognome}
                  onChange={(e) => setNuovoCognome(e.target.value)}
                  placeholder="Es: Rossi"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">Qualifica *</label>
              <select
                value={nuovaQualifica}
                onChange={(e) => setNuovaQualifica(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs"
              >
                <option value="Autista">Autista</option>
                <option value="Soccorritore">Soccorritore</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                  Cellulare * <span className="text-amber-400 font-bold">(Obbligatorio)</span>
                </label>
                <input
                  type="tel"
                  required
                  value={nuovoTelefono}
                  onChange={(e) => setNuovoTelefono(e.target.value)}
                  placeholder="Es: 333 1234567"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                  Email * <span className="text-amber-400 font-bold">(Obbligatoria)</span>
                </label>
                <input
                  type="email"
                  required
                  value={nuovaEmail}
                  onChange={(e) => setNuovaEmail(e.target.value)}
                  placeholder="Es: marco@email.it"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div>
                <label className="block text-[10px] text-amber-300 font-bold mb-0.5">Scegli PIN (4 cifre)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={nuovoPIN}
                  onChange={(e) => setNuovoPIN(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-mono text-center font-bold text-sm tracking-widest"
                />
              </div>
              <div>
                <label className="block text-[10px] text-amber-300 font-bold mb-0.5">Conferma PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confermaPIN}
                  onChange={(e) => setConfermaPIN(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-mono text-center font-bold text-sm tracking-widest"
                />
              </div>
            </div>

            {/* Sezione Firma Digitale Autografa Obbligatoria */}
            <div className="pt-1">
              <UploadFirmaTrasparente
                label="Firma Digitale Autografa (Carica Immagine o Disegna)"
                sottotitolo="Carica una foto/scansione della firma (lo sfondo bianco verrà rimosso automaticamente rendendola trasparente) oppure disegnala sul display."
                valoreIniziale={nuovaFirma}
                onFirmaCambiata={(dataUrl) => {
                  setNuovaFirma(dataUrl);
                  if (dataUrl) setErroreNuovo('');
                }}
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                Salva & Entra
              </button>
              <button
                type="button"
                onClick={() => setModaleNuovoAperta(false)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SOTTO-MODALE FIRMA MANCANTE PER VOLONTARIO ESISTENTE */}
      {modaleFirmaMancanteAperta && volontarioDaFirmare && (
        <div className="fixed inset-0 bg-black/85 z-60 flex items-center justify-center p-4">
          <form
            onSubmit={salvaFirmaMancanteEdEntra}
            className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl max-w-md w-full p-5 space-y-3.5 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                <PenTool className="w-4 h-4 text-amber-400" />
                Firma Digitale Obbligatoria per Entrare
              </h4>
              <button
                type="button"
                onClick={() => {
                  setModaleFirmaMancanteAperta(false);
                  setVolontarioDaFirmare(null);
                  setFirmaVolontarioMancante(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs">
              Ciao <strong className="text-amber-300">{volontarioDaFirmare.nome} {volontarioDaFirmare.cognome}</strong>! Per iniziare il turno e accedere al terminale di bordo, devi obbligatoriamente creare la tua firma autografa direttamente sullo schermo. Verrà apposta in automatico su tutti i fogli di viaggio e verbali PDF generati.
            </div>

            {erroreFirmaMancante && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold text-center">
                {erroreFirmaMancante}
              </div>
            )}

            <UploadFirmaTrasparente
              label="Firma Digitale Autografa (Carica Immagine o Disegna)"
              sottotitolo="Carica una foto/scansione della firma (il bianco verrà rimosso automaticamente rendendola trasparente) oppure disegnala sul display."
              valoreIniziale={firmaVolontarioMancante}
              onFirmaCambiata={(dataUrl) => {
                setFirmaVolontarioMancante(dataUrl);
                if (dataUrl) setErroreFirmaMancante('');
              }}
            />

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                Conferma Firma & Inizia Turno
              </button>
              <button
                type="button"
                onClick={() => {
                  setModaleFirmaMancanteAperta(false);
                  setVolontarioDaFirmare(null);
                  setFirmaVolontarioMancante(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE RESET PASSWORD / PIN */}
      <ModalResetPassword
        isOpen={modaleResetAperta}
        onClose={() => setModaleResetAperta(false)}
        volontari={volontari}
        volontarioPreselezionato={volontari.find(v => v.id === volontarioSelezionatoId) || null}
        onAggiornaVolontari={onAggiornaVolontari || (() => {})}
        onNotificaRadio={onNotificaRadio || (() => {})}
      />

      {/* MODALE CHECKLIST INIZIO TURNO GUIDATA (All'accesso del volontario prima dell'operatività) */}
      {modaleChecklistAperta && volontarioInAttesaChecklist && (
        <ModalChecklistInizioTurnoGuidata
          isOpen={modaleChecklistAperta}
          onClose={() => {
            setModaleChecklistAperta(false);
            setVolontarioInAttesaChecklist(null);
          }}
          mezzo={volontarioInAttesaChecklist.mezzo}
          flottaMezzi={flottaMezzi}
          mezziFlotta={mezziFlotta}
          volontario={volontarioInAttesaChecklist.vol}
          templates={checklistsTemplates}
          onConfermaOperativita={handleConfermaChecklist}
        />
      )}

      {/* MODALE VISUALIZZA / AGGIORNA CHECKLIST MEZZO IN CORSO DI TURNO */}
      {modaleVisualizzaChecklistAperta && sessione.volontarioNome && (
        <ModalChecklistInizioTurnoGuidata
          isOpen={modaleVisualizzaChecklistAperta}
          onClose={() => setModaleVisualizzaChecklistAperta(false)}
          mezzo={sessione.mezzoScelto || ''}
          flottaMezzi={flottaMezzi}
          mezziFlotta={mezziFlotta}
          volontario={
            volontari.find(v => v.id === sessione.volontarioId) || {
              id: sessione.volontarioId || 'vol-corrente',
              nome: sessione.volontarioNome,
              cognome: '',
              telefono: '',
              email: '',
              pin: '0000',
              dataRegistrazione: '',
              qualifica: (sessione.qualificaTurno as any) || 'Soccorritore',
              matricola: 'VOL',
              inTurno: true
            }
          }
          templates={checklistsTemplates}
          onConfermaOperativita={(comp: ChecklistCompilataTurno) => {
            handleConfermaChecklist(comp);
            setModaleVisualizzaChecklistAperta(false);
          }}
        />
      )}

    </div>
  );
};
