import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  KeyRound,
  Shirt,
  Clock,
  FileText,
  Shield,
  ShieldAlert,
  Edit2,
  Trash2,
  Check,
  X,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  Lock,
  Unlock,
  Download,
  Filter,
  Eye,
  EyeOff,
  Copy,
  PlusCircle,
  FileCheck2,
  Sparkles,
  Save,
  CheckCircle2,
  Printer,
  RefreshCw,
  Building2,
  CheckSquare,
  Square,
  Layers,
  Award,
  MapPin,
  Crosshair,
  Navigation,
  Sliders,
  RotateCcw,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Upload
} from 'lucide-react';
import { DatabaseVolontariModal, DatabaseVolontariModalInitialAction, Volontario, SEDI_TURNI_DISPONIBILI } from '../DatabaseVolontariModal';
import { isFirmaMancante, isPinEmergenza } from '../ModalObbligoFirmaEPin';
import {
  TimbraturaVolontario,
  LuogoTimbratura,
  TipoLuogoTimbratura,
  ArticoloVestiarioMagazzino,
  MovimentoMagazzino
} from '../../types/adminTypes';
import { SEDI_ASSOCIATIVE_INIZIALI, LUOGHI_TIMBRATURA_DEFAULT } from '../../data/adminMockData';
import {
  MacroCategoriaId,
  LISTA_MACRO_CATEGORIE,
  TUTTE_LE_MACRO_CATEGORIE,
  PulsanteStrumentiId,
  LISTA_PULSANTI_STRUMENTI_RISERVATI,
  getSottosezioniDelegabili,
  getNomiDatabaseCustom,
  getTitoloDatabase,
  getTitoloSottosezione
} from '../../constants/macroCategorie';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { MappaSelezioneLuogoTimbratura } from './MappaSelezioneLuogoTimbratura';
import { mergeVolontariListsSafe } from '../../utils/volontariMerge';
import { normalizzaNomeCarraraTesto, normalizzaListaLuoghiTimbratura } from '../../utils/sediNormalize';
import { calcolaCauzioneTotale } from '../../data/vestiarioDocumenti';
import { realtime } from '../../services/realtime';
import {
  ModalitaPeriodoTimbrature,
  formatLocalISODate,
  normalizzaDataISO,
  formatDataItaliana,
  getGiornoSettimanaIt,
  calcolaIntervalloSettimanaISO,
  esportaReportTimbratureCSV,
  esportaReportTimbratureExcel,
  calcolaDurataTimbratura,
  formatDurataTimbratura
} from '../../utils/exportTimbrature';
import {
  getMansioniCatalogo,
  creaNuovaMansione,
  eliminaMansioneCatalogo,
  modificaMansioneCatalogo,
  ripristinaMansioniDefault,
  getCategorieMansioni,
  creaCategoriaMansione,
  modificaCategoriaMansione,
  eliminaCategoriaMansione,
  ripristinaCategorieMansioniDefault,
  aggiornaVolontariDopoModificaMansione,
  aggiornaVolontariDopoEliminazioneMansione,
  getMansioniVolontario,
  getMansioniEffettiveVolontario,
  getMansionePrincipale,
  getStileMansione,
  getDescendantMansioneIds,
  getDescendantCategoriaIds,
  emettiRinominaMansioneGlobale,
  MansioneOperativa,
  CategoriaMansione,
  CategoriaMansioneItem
} from '../../utils/mansioniVolontari';
import { aggiornaTipiTurnoDopoModificaMansione } from '../../utils/tipiTurno';
import { formatIconaPerTesto } from '../../utils/emojiIconsArchive';
import { IconaEmoji } from '../IconaEmoji';
import { EmojiIconPicker } from '../EmojiIconPicker';
import { addDaysISODate, formatDateItaly, formatISODateItaly, formatTimeItaly } from '../../utils/italianTime';
import { useTitoloDatabase, useNomiSottosezioniCustom } from '../../hooks/useNomiDatabase';

interface SezioneVolontariProps {
  volontari: Volontario[];
  onAggiornaVolontari: (nuoviVolontari: Volontario[]) => void;
  onEliminaVolontario?: (id: string) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  operatoreCorrente?: string;
  isPresidente?: boolean;
  isAdmin?: boolean;
  allowedSubtabs?: string[] | null;
  timbrature: TimbraturaVolontario[];
  onAggiornaTimbrature: (timbrature: TimbraturaVolontario[]) => void;
  luoghiTimbratura?: LuogoTimbratura[];
  onAggiornaLuoghiTimbratura?: (luoghi: LuogoTimbratura[]) => void;
  magazzinoVestiario?: ArticoloVestiarioMagazzino[];
  onAggiornaMagazzinoVestiario?: (nuovi: ArticoloVestiarioMagazzino[]) => void;
  movimentiMagazzino?: MovimentoMagazzino[];
  onAggiornaMovimentiMagazzino?: (nuovi: MovimentoMagazzino[]) => void;
}

export const SezioneVolontari: React.FC<SezioneVolontariProps> = ({
  volontari,
  onAggiornaVolontari,
  onEliminaVolontario,
  onNotificaRadio,
  operatoreCorrente = 'Amministratore',
  isPresidente = false,
  isAdmin = false,
  allowedSubtabs = null,
  timbrature,
  onAggiornaTimbrature,
  luoghiTimbratura = LUOGHI_TIMBRATURA_DEFAULT,
  onAggiornaLuoghiTimbratura,
  magazzinoVestiario = [],
  onAggiornaMagazzinoVestiario,
  movimentiMagazzino = [],
  onAggiornaMovimentiMagazzino
}) => {
  // Privilegi effettivi amministrativi (condivisi tra Amministratore e Presidente)
  const isEffettivoAdmin = Boolean(isAdmin || isPresidente);

  // Sotto-schede della macro-categoria 2
  const [sottoTab, setSottoTab] = useState<'anagrafiche' | 'mansioni' | 'vestiario' | 'pin' | 'domande' | 'timbrature' | 'gruppi' | 'permessi_database'>('anagrafiche');

  // Stato per Gestione Mansioni, Categorie, Genitorialità e Assegnazione Multipla
  const [catalogoMansioni, setCatalogoMansioni] = useState<MansioneOperativa[]>(() => getMansioniCatalogo());
  const [categorieMansioni, setCategorieMansioni] = useState<CategoriaMansioneItem[]>(() => getCategorieMansioni());
  const [selectedVolontariMansioniIds, setSelectedVolontariMansioniIds] = useState<string[]>([]);
  const [selectedMansioniNomi, setSelectedMansioniNomi] = useState<string[]>([]);
  const [modalNuovaMansioneAperta, setModalNuovaMansioneAperta] = useState(false);
  const [mansioneInModifica, setMansioneInModifica] = useState<MansioneOperativa | null>(null);
  const [nuovaMansioneNome, setNuovaMansioneNome] = useState('');
  const [nuovaMansioneDescrizione, setNuovaMansioneDescrizione] = useState('');
  const [nuovaMansioneCategoria, setNuovaMansioneCategoria] = useState<CategoriaMansione>('Emergenza 118');
  const [nuovaMansioneEmoji, setNuovaMansioneEmoji] = useState('⭐');
  const [nuovaMansioneParentId, setNuovaMansioneParentId] = useState<string>('');
  const [nuovaMansioneIncluse, setNuovaMansioneIncluse] = useState<string[]>(['Volontario']);
  const [ricercaMansioniVolontari, setRicercaMansioniVolontari] = useState('');
  const [filtroCategoriaMansione, setFiltroCategoriaMansione] = useState('tutte');

  // Gestione Categorie Mansioni (CRUD + Genitorialità)
  const [modalCategoriaAperta, setModalCategoriaAperta] = useState(false);
  const [categoriaInModifica, setCategoriaInModifica] = useState<CategoriaMansioneItem | null>(null);
  const [formCategoriaNome, setFormCategoriaNome] = useState('');
  const [formCategoriaEmoji, setFormCategoriaEmoji] = useState('📁');
  const [formCategoriaParentId, setFormCategoriaParentId] = useState<string>('');

  // Nomi Database & Sottosezioni personalizzati (gestiti dal menù Strumenti -> Rinomina DB / Rinomina SUB)
  const titoloDbVolontari = useTitoloDatabase('volontari', 'Database Volontari & Personale Operativo');
  const nomiSubCustom = useNomiSottosezioniCustom();
  const [nomiDbCustom, setNomiDbCustom] = useState<Record<string, string>>(() => getNomiDatabaseCustom());

  // Modale di conferma in-app (sostituisce confirm() nativi)
  const [confermaAzioneModal, setConfermaAzioneModal] = useState<{
    titolo: string;
    messaggio: string;
    labelConferma?: string;
    onConfirm: () => void;
  } | null>(null);

  // Stato invio sollecito massivo Firma Digitale & Cambio PIN 0000
  const [invioSollecitoFirmaInCorso, setInvioSollecitoFirmaInCorso] = useState(false);
  const [esitoSollecitoFirma, setEsitoSollecitoFirma] = useState<{
    ok: boolean;
    testo: string;
    dettaglio?: string;
  } | null>(null);

  const volontariSenzaFirmaCount = React.useMemo(
    () => volontari.filter((v) => isFirmaMancante(v)).length,
    [volontari]
  );

  const volontariConPinEmergenzaCount = React.useMemo(
    () => volontari.filter((v) => isPinEmergenza(v)).length,
    [volontari]
  );

  const eseguiInvioSollecitoFirmaEPin = async () => {
    setInvioSollecitoFirmaInCorso(true);
    setEsitoSollecitoFirma(null);
    try {
      const resp = await fetch(`${realtime.getApiBaseUrl()}/api/invia-sollecito-firma-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volontari,
          operatoreNome: operatoreCorrente || 'Amministratore Centrale'
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'Errore durante invio sollecito');
      }
      if (data.campaign) {
        realtime.syncSollecitoFirmaPin(data.campaign);
      }
      const inviate = Array.isArray(data.emailsInviate) ? data.emailsInviate.length : 0;
      const saltate = Array.isArray(data.emailsSaltate) ? data.emailsSaltate.length : 0;
      const errori = Array.isArray(data.erroriSmtp) ? data.erroriSmtp.length : 0;
      const tot = Number(data.totaleSenzaFirma || 0);
      setEsitoSollecitoFirma({
        ok: errori === 0,
        testo: `Sollecito inviato: notifica in-app attiva per ${tot} account senza firma • ${inviate} email inviate${saltate > 0 ? ` • ${saltate} senza email valida` : ''}${errori > 0 ? ` • ${errori} errori SMTP` : ''}.`,
        dettaglio:
          saltate > 0
            ? `Email non inviate per indirizzo assente/segnaposto: ${(data.emailsSaltate || []).map((x: any) => `${x.nome} (${x.email})`).join(', ')}`
            : undefined
      });
      onNotificaRadio?.(
        `📢 SOLLECITO FIRMA & PIN: Inviata notifica in-app a ${tot} account senza firma e ${inviate} email ufficiali.`,
        'sistema'
      );
    } catch (err: any) {
      setEsitoSollecitoFirma({
        ok: false,
        testo: `Errore durante l'invio del sollecito: ${err?.message || 'impossibile contattare il server'}`
      });
    } finally {
      setInvioSollecitoFirmaInCorso(false);
    }
  };

  const richiediConfermaSollecitoFirmaEPin = () => {
    setConfermaAzioneModal({
      titolo: 'Invia Sollecito Firma & Cambio PIN 0000',
      messaggio:
        `Verrà inviata subito una notifica in-app e una email a tutti i ${volontariSenzaFirmaCount} account che non hanno ancora caricato la firma digitale, chiedendo di fare accesso (oppure Logout + Login se già loggati). Al login saranno obbligati a caricare la firma e a cambiare il PIN se hanno ancora 0000 (${volontariConPinEmergenzaCount} profili attuali con PIN 0000). Procedere?`,
      labelConferma: 'Invia Notifica & Email Ora',
      onConfirm: () => {
        setConfermaAzioneModal(null);
        eseguiInvioSollecitoFirmaEPin();
      }
    });
  };

  useEffect(() => {
    const onMansioniSync = () => {
      setCatalogoMansioni(getMansioniCatalogo());
      setCategorieMansioni(getCategorieMansioni());
    };
    const onNomiDbSync = () => {
      setNomiDbCustom(getNomiDatabaseCustom());
    };
    window.addEventListener('croceoro_mansioni_updated', onMansioniSync);
    window.addEventListener('croceoro_nomi_db_updated', onNomiDbSync);
    return () => {
      window.removeEventListener('croceoro_mansioni_updated', onMansioniSync);
      window.removeEventListener('croceoro_nomi_db_updated', onNomiDbSync);
    };
  }, []);

  // Stato per Sezione 8: Accesso ai Database & Sottosezioni (Assegnazione Singolo / Multi-Account)
  const [selectedVolontariPermessiIds, setSelectedVolontariPermessiIds] = useState<string[]>([]);
  const [selectedCategoriePermessi, setSelectedCategoriePermessi] = useState<MacroCategoriaId[]>([]);
  const [selectedSubPermessi, setSelectedSubPermessi] = useState<Record<string, string[]>>({});
  const [expandedDbConfigId, setExpandedDbConfigId] = useState<MacroCategoriaId | null>(null);
  const [accountDettaglioPermessiId, setAccountDettaglioPermessiId] = useState<string | null>(null);
  const [ricercaPermessiVolontari, setRicercaPermessiVolontari] = useState<string>('');
  const [filtroSezionePermessi, setFiltroSezionePermessi] = useState<string>('tutte');

  const canShowSubtab = (id: string) => {
    if (id === 'pin' || id === 'permessi_database') {
      return isEffettivoAdmin && (!allowedSubtabs || allowedSubtabs.includes(id));
    }
    if (!allowedSubtabs) return true;
    return allowedSubtabs.includes(id);
  };

  // Protezione di sicurezza: impedisci l'accesso alle sottosezioni non autorizzate
  useEffect(() => {
    if (!canShowSubtab(sottoTab)) {
      const ordine = ['anagrafiche', 'vestiario', 'pin', 'domande', 'timbrature', 'gruppi', 'mansioni', 'permessi_database'] as const;
      const prima = ordine.find((t) => canShowSubtab(t));
      if (prima) setSottoTab(prima);
    }
  }, [isEffettivoAdmin, sottoTab, allowedSubtabs]);

  // Stato per Gruppi Volontari
  const [selectedVolontariGruppoIds, setSelectedVolontariGruppoIds] = useState<string[]>([]);
  const [sezioniTargetGruppo, setSezioniTargetGruppo] = useState<string[]>(['sede-massa-ronchi']);
  const [sezioneAppartenenzaTarget, setSezioneAppartenenzaTarget] = useState<string>('mantieni');
  const [filtroGruppoSezione, setFiltroGruppoSezione] = useState<string>('tutte');
  const [ricercaGruppi, setRicercaGruppi] = useState<string>('');

  // Ricerca e filtri
  const [ricerca, setRicerca] = useState('');
  const [filtroQualifica, setFiltroQualifica] = useState('tutti');
  const [filtroStato, setFiltroStato] = useState<'tutti' | 'attivi' | 'attesa' | 'bloccati'>('tutti');

  // Stato modale DatabaseVolontari completa
  const [modalDatabaseCompletoAperta, setModalDatabaseCompletoAperta] = useState(false);
  const [modalDatabaseInitialAction, setModalDatabaseInitialAction] = useState<DatabaseVolontariModalInitialAction | null>(null);

  const apriListaCompletaVolontari = () => {
    setModalDatabaseInitialAction(null);
    setModalDatabaseCompletoAperta(true);
  };

  const apriNuovoVolontarioDiretto = () => {
    setModalDatabaseInitialAction({ mode: 'nuovo', directOnly: true });
    setModalDatabaseCompletoAperta(true);
  };

  const apriFascicoloVolontarioDiretto = (
    vol: Volontario,
    tab?: DatabaseVolontariModalInitialAction['tab']
  ) => {
    setModalDatabaseInitialAction({ mode: 'fascicolo', volontario: vol, tab, directOnly: true });
    setModalDatabaseCompletoAperta(true);
  };

  // Modale conferma eliminazione definitiva account/domanda
  const [volontarioDaEliminareSezione, setVolontarioDaEliminareSezione] = useState<{ vol: Volontario; modo: 'account' | 'domanda' } | null>(null);

  // Visibilità PIN globale
  const [mostraTuttiPin, setMostraTuttiPin] = useState(false);
  const [pinCopiatoId, setPinCopiatoId] = useState<string | null>(null);

  // Gestione Modifica Timbratura
  const [timbraturaInModifica, setTimbraturaInModifica] = useState<TimbraturaVolontario | null>(null);
  const [modaleNuovaTimbraturaAperta, setModaleNuovaTimbraturaAperta] = useState(false);

  // Form Timbratura
  const [formTimbVolontarioId, setFormTimbVolontarioId] = useState('');
  const [formTimbData, setFormTimbData] = useState(() => formatISODateItaly());
  const [formTimbIngresso, setFormTimbIngresso] = useState('08:00:00');
  const [formTimbUscita, setFormTimbUscita] = useState('14:00:00');
  const [formTimbSede, setFormTimbSede] = useState('Sede Operativa Massa (Le Jare)');
  const [formTimbSedeUscita, setFormTimbSedeUscita] = useState('');
  const [formTimbAttivita, setFormTimbAttivita] = useState('');
  const [formTimbNote, setFormTimbNote] = useState('');

  // Filtri Timbrature (Nominativo Volontario, Sede di timbratura, Filtro Temporale: Tutto / Giornaliero / Settimanale / Personalizzato)
  const [filtroTimbVolontario, setFiltroTimbVolontario] = useState('tutti');
  const [filtroTimbSede, setFiltroTimbSede] = useState('tutte');
  const [filtroTimbPeriodo, setFiltroTimbPeriodo] = useState<ModalitaPeriodoTimbrature>('tutto');
  const [filtroTimbGiorno, setFiltroTimbGiorno] = useState(() => formatLocalISODate());
  const [filtroTimbSettimanaRif, setFiltroTimbSettimanaRif] = useState(() => formatLocalISODate());
  const [filtroTimbDataInizio, setFiltroTimbDataInizio] = useState('');
  const [filtroTimbDataFine, setFiltroTimbDataFine] = useState('');
  const [filtroTimbMese, setFiltroTimbMese] = useState('');
  const [modaleStampaRegistroAperta, setModaleStampaRegistroAperta] = useState(false);

  // Gestione Luoghi di Timbratura GPS (a discrezione dell'operatore, effetto immediato)
  const [modaleGestioneLuoghiAperta, setModaleGestioneLuoghiAperta] = useState(false);
  const [modaleNuovoLuogoAperta, setModaleNuovoLuogoAperta] = useState(false);
  const [luogoInModifica, setLuogoInModifica] = useState<LuogoTimbratura | null>(null);

  // Form Nuovo Luogo / Modifica Luogo Timbratura
  const [formLuogoNome, setFormLuogoNome] = useState('');
  const [formLuogoCodice, setFormLuogoCodice] = useState('');
  const [formLuogoIndirizzo, setFormLuogoIndirizzo] = useState('');
  const [formLuogoTipo, setFormLuogoTipo] = useState<TipoLuogoTimbratura>('presidio');
  const [formLuogoLat, setFormLuogoLat] = useState<number>(44.0365);
  const [formLuogoLng, setFormLuogoLng] = useState<number>(10.1415);
  const [formLuogoRaggioMetri, setFormLuogoRaggioMetri] = useState<number>(50); // A discrezione operatore
  const [formLuogoDescrizione, setFormLuogoDescrizione] = useState('');
  const [rilevamentoGpsLuogoInCorso, setRilevamentoGpsLuogoInCorso] = useState(false);

  const apriModaleNuovoLuogo = () => {
    setLuogoInModifica(null);
    setFormLuogoNome('');
    setFormLuogoCodice(`LUOGO-${Math.floor(100 + Math.random() * 900)}`);
    setFormLuogoIndirizzo('');
    setFormLuogoTipo('presidio');
    setFormLuogoLat(44.0365);
    setFormLuogoLng(10.1415);
    setFormLuogoRaggioMetri(50);
    setFormLuogoDescrizione('');
    setModaleNuovoLuogoAperta(true);
  };

  const apriModaleModificaLuogo = (l: LuogoTimbratura) => {
    setLuogoInModifica(l);
    setFormLuogoNome(l.nome);
    setFormLuogoCodice(l.codice || '');
    setFormLuogoIndirizzo(l.indirizzo || '');
    setFormLuogoTipo(l.tipo || 'presidio');
    setFormLuogoLat(l.coordinate.lat);
    setFormLuogoLng(l.coordinate.lng);
    setFormLuogoRaggioMetri(l.raggioMetri || 50);
    setFormLuogoDescrizione(l.descrizione || '');
    setModaleNuovoLuogoAperta(true);
  };

  const rilevaGpsPerLuogo = () => {
    setRilevamentoGpsLuogoInCorso(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormLuogoLat(Number(pos.coords.latitude.toFixed(6)));
          setFormLuogoLng(Number(pos.coords.longitude.toFixed(6)));
          setRilevamentoGpsLuogoInCorso(false);
          mostraAvviso(`Coordinate GPS dispositivo acquisite: [${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}]`);
        },
        (err) => {
          setRilevamentoGpsLuogoInCorso(false);
          mostraAvviso(`Impossibile acquisire coordinate GPS: ${err.message}. Puoi inserirle manualmente.`);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setRilevamentoGpsLuogoInCorso(false);
      mostraAvviso('Geolocalizzazione non supportata su questo browser.');
    }
  };

  const handleSalvaLuogoTimbratura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLuogoNome.trim()) {
      mostraAvviso('Inserisci il nome del luogo o della postazione.');
      return;
    }

    const raggioFinale = Math.max(5, Number(formLuogoRaggioMetri) || 20);

    let aggiornati: LuogoTimbratura[];
    if (luogoInModifica) {
      aggiornati = (luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).map((l) =>
        l.id === luogoInModifica.id
          ? {
              ...l,
              nome: formLuogoNome.trim(),
              codice: formLuogoCodice.trim() || l.codice,
              indirizzo: formLuogoIndirizzo.trim() || 'Massa Carrara',
              tipo: formLuogoTipo,
              coordinate: { lat: Number(formLuogoLat), lng: Number(formLuogoLng) },
              raggioMetri: raggioFinale,
              descrizione: formLuogoDescrizione.trim()
            }
          : l
      );
    } else {
      const nuovo: LuogoTimbratura = {
        id: `luogo-${Date.now()}`,
        nome: formLuogoNome.trim(),
        codice: formLuogoCodice.trim() || `LUOGO-${Math.floor(100 + Math.random() * 900)}`,
        indirizzo: formLuogoIndirizzo.trim() || 'Massa Carrara',
        tipo: formLuogoTipo,
        coordinate: { lat: Number(formLuogoLat), lng: Number(formLuogoLng) },
        raggioMetri: raggioFinale,
        attivo: true,
        descrizione: formLuogoDescrizione.trim(),
        creatoDa: operatoreCorrente,
        dataCreazione: new Date().toISOString()
      };
      aggiornati = [nuovo, ...(luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT)];
    }

    onAggiornaLuoghiTimbratura?.(aggiornati);
    setModaleNuovoLuogoAperta(false);
    const azione = luogoInModifica ? 'Modificato luogo' : 'Creato nuovo luogo';
    onNotificaRadio?.(`📍 TIMBRATURE GPS: ${operatoreCorrente} ha ${luogoInModifica ? 'aggiornato' : 'creato'} "${formLuogoNome.trim()}" con raggio di validità di ${raggioFinale}m (Effetto immediato)`, 'sistema');
    mostraAvviso(`${azione} "${formLuogoNome.trim()}" con raggio di ${raggioFinale}m. Effetto immediato per le timbrature dei volontari.`);
  };

  const handleToggleAttivoLuogo = (id: string) => {
    const aggiornati = (luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).map((l) =>
      l.id === id ? { ...l, attivo: !l.attivo } : l
    );
    const target = aggiornati.find(l => l.id === id);
    onAggiornaLuoghiTimbratura?.(aggiornati);
    onNotificaRadio?.(`📍 TIMBRATURE GPS: Luogo "${target?.nome}" impostato su ${target?.attivo ? 'ATTIVO' : 'DISATTIVATO'} da ${operatoreCorrente}`, 'sistema');
    mostraAvviso(`Luogo "${target?.nome}" ${target?.attivo ? 'attivato' : 'disattivato'} con effetto immediato.`);
  };

  const handleEliminaLuogo = (id: string, nome: string) => {
    setConfermaAzioneModal({
      titolo: 'Elimina Luogo di Timbratura',
      messaggio: `Sei sicuro di voler eliminare il luogo di timbratura "${nome}"? I volontari non potranno più timbrare a questa postazione.`,
      labelConferma: 'Elimina Luogo',
      onConfirm: () => {
        const aggiornati = (luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).filter((l) => l.id !== id);
        onAggiornaLuoghiTimbratura?.(aggiornati);
        onNotificaRadio?.(`🗑️ TIMBRATURE GPS: Eliminato luogo di timbratura "${nome}" da ${operatoreCorrente}`, 'sistema');
        mostraAvviso(`Luogo "${nome}" eliminato con effetto immediato.`);
      }
    });
  };

  // Notifiche locali
  const [messaggioConferma, setMessaggioConferma] = useState<string | null>(null);

  const mostraAvviso = (msg: string) => {
    setMessaggioConferma(msg);
    setTimeout(() => setMessaggioConferma(null), 4000);
  };

  // Copia PIN negli appunti (solo Admin / Presidente)
  const copiaPin = (pin: string, id: string) => {
    if (!isEffettivoAdmin) return;
    navigator.clipboard?.writeText(pin);
    setPinCopiatoId(id);
    setTimeout(() => setPinCopiatoId(null), 2000);
    mostraAvviso(`PIN ${pin} copiato negli appunti.`);
  };

  // Rigenera PIN per un volontario (solo Admin / Presidente)
  const rigeneraPinVolontario = (volontarioId: string) => {
    if (!isEffettivoAdmin) return;
    const nuovoPin = Math.floor(1000 + Math.random() * 9000).toString();
    const aggiornati = volontari.map((v) => {
      if (v.id === volontarioId) {
        return { ...v, pin: nuovoPin };
      }
      return v;
    });
    onAggiornaVolontari(aggiornati);
    onNotificaRadio?.(`🔑 AMMINISTRAZIONE: Rigenerato PIN di accesso per volontario con ID ${volontarioId}`, 'sistema');
    mostraAvviso(`Nuovo PIN generato con successo: ${nuovoPin}`);
  };

  // Approvazione rapida domanda aspirante
  const approvaAspirante = (v: Volontario) => {
    const aggiornati = volontari.map((item) => {
      if (item.id === v.id) {
        return { ...item, approvato: true, bloccato: false };
      }
      return item;
    });
    onAggiornaVolontari(aggiornati);
    onNotificaRadio?.(`✅ AMMISSIONE SOCIO: Domanda approvata per ${v.nome} ${v.cognome}`, 'sistema');
    mostraAvviso(`Domanda approvata! ${v.nome} ${v.cognome} è ora un volontario attivo.`);
  };

  // Rifiuta o archivia domanda aspirante
  const rifiutaAspirante = (v: Volontario) => {
    setVolontarioDaEliminareSezione({ vol: v, modo: 'domanda' });
  };

  // Conferma eliminazione definitiva account o domanda aspirante
  const confermaEliminaVolontarioSezione = () => {
    if (!volontarioDaEliminareSezione) return;
    const { vol, modo } = volontarioDaEliminareSezione;
    if (onEliminaVolontario) {
      onEliminaVolontario(vol.id);
    } else {
      const aggiornati = volontari.filter((item) => item.id !== vol.id);
      onAggiornaVolontari(aggiornati);
    }
    if (modo === 'domanda') {
      onNotificaRadio?.(`❌ AMMISSIONE: Respinta ed eliminata domanda di iscrizione per ${vol.nome} ${vol.cognome}`, 'sistema');
      mostraAvviso(`Domanda di ${vol.nome} ${vol.cognome} respinta e rimossa definitivamente.`);
    } else {
      onNotificaRadio?.(`🗑️ CENTRALE: Rimosso account ${vol.nome} ${vol.cognome} (${vol.qualifica}) dal database`, 'centrale');
      mostraAvviso(`Account ${vol.nome} ${vol.cognome} eliminato definitivamente.`);
    }
    setVolontarioDaEliminareSezione(null);
  };

  // Esporta e Importa Backup JSON diretto dei profili volontari
  const handleEsportaBackupVolontariJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(volontari, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Database_Volontari_Croce_Oro_${formatLocalISODate()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    mostraAvviso(`Backup JSON esportato (${volontari.length} profili salvati).`);
  };

  const handleImportaBackupVolontariJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const listRaw = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.volontari)
          ? parsed.volontari
          : null;
        if (!listRaw) {
          mostraAvviso('⚠️ Il file selezionato non contiene un backup volontari JSON valido.');
          return;
        }
        const validItems = listRaw.filter(
          (item: any) =>
            item &&
            typeof item === 'object' &&
            (typeof item.nome === 'string' || typeof item.cognome === 'string' || typeof item.id === 'string')
        ) as Volontario[];
        if (validItems.length === 0) {
          mostraAvviso('⚠️ Nessun profilo valido trovato nel file di backup.');
          return;
        }
        const merged = mergeVolontariListsSafe(volontari, validItems);
        onAggiornaVolontari(merged);
        onNotificaRadio?.(
          `📥 CENTRALE: Importato backup volontari JSON (${validItems.length} profili letti, totale ${merged.length} in archivio)`,
          'centrale'
        );
        mostraAvviso(`Importati/aggiornati ${validItems.length} profili dal backup JSON! Totale archivio: ${merged.length}.`);
      } catch {
        mostraAvviso('⚠️ Errore lettura file JSON: verifica che il file non sia danneggiato.');
      }
    };
    reader.readAsText(file);
  };

  // Calcolo automatico delle ore di servizio timbrate nell'anno solare (2026) per ciascun volontario
  const calcolaOreAnnoVolontario = (vol: Volontario, anno = '2026') => {
    const list = (timbrature || []).filter((t) => {
      const matchId = vol.id && t.volontarioId === vol.id;
      const matchNome = (vol.nome || vol.cognome) && t.volontarioNome && (
        t.volontarioNome.trim().toLowerCase() === `${vol.nome} ${vol.cognome}`.trim().toLowerCase() ||
        t.volontarioNome.trim().toLowerCase() === `${vol.cognome} ${vol.nome}`.trim().toLowerCase()
      );
      const matchAnno = t.data && t.data.startsWith(anno);
      return (matchId || matchNome) && matchAnno && typeof t.oreTotali === 'number';
    });
    const oreTot = list.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0);
    return {
      ore: Math.round(oreTot * 10) / 10,
      turni: list.length
    };
  };

  // Statistiche globali delle timbrature dell'anno per la Centrale
  const statisticheOreAnno = React.useMemo(() => {
    const anno = '2026';
    const timbAnno = (timbrature || []).filter((t) => t.data && t.data.startsWith(anno) && typeof t.oreTotali === 'number');
    const totaleOre = Math.round(timbAnno.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0) * 10) / 10;
    const totaleTurni = timbAnno.length;
    
    // Volontari unici con almeno una timbratura
    const volontariUnici = new Set(timbAnno.map((t) => t.volontarioId || t.volontarioNome).filter(Boolean));
    const mediaOre = volontariUnici.size > 0 ? Math.round((totaleOre / volontariUnici.size) * 10) / 10 : 0;

    return {
      totaleOre,
      totaleTurni,
      volontariAttivi: volontariUnici.size,
      mediaOre
    };
  }, [timbrature]);

  // Salvataggio Modifica Timbratura da Amministratore
  const handleSalvaModificaTimbratura = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timbraturaInModifica) return;

    // Calcolo ore totali e durata esatta fino ai secondi
    let oreTotali = timbraturaInModifica.oreTotali || 0;
    let oreEMinuti = timbraturaInModifica.oreEMinuti;
    if (formTimbIngresso && formTimbUscita) {
      const durata = calcolaDurataTimbratura(formTimbIngresso, formTimbUscita);
      oreTotali = durata.oreDecimali;
      oreEMinuti = durata.durataTesto;
    }

    const aggiornate = timbrature.map((t) => {
      if (t.id === timbraturaInModifica.id) {
        return {
          ...t,
          data: formTimbData,
          orarioIngresso: formTimbIngresso,
          orarioUscita: formTimbUscita,
          oreTotali,
          oreEMinuti,
          sede: formTimbSede,
          sedeUscita: formTimbSedeUscita.trim() || formTimbSede,
          attivitaSvolta: formTimbAttivita.trim() || undefined,
          note: formTimbNote,
          modificataDaAdmin: true,
          dataUltimaModifica: `${formatISODateItaly()} ${formatTimeItaly(undefined, true)}`,
          operatoreModifica: operatoreCorrente
        };
      }
      return t;
    });

    onAggiornaTimbrature(aggiornate);
    setTimbraturaInModifica(null);
    onNotificaRadio?.(`🕒 REGISTRO TIMBRATURE: Modificata timbratura di ${timbraturaInModifica.volontarioNome} dall'amministratore ${operatoreCorrente}`, 'sistema');
    mostraAvviso(`Timbratura di ${timbraturaInModifica.volontarioNome} modificata con successo.`);
  };

  // Inserimento Nuova Timbratura Manuale da Amministratore
  const handleAggiungiNuovaTimbratura = (e: React.FormEvent) => {
    e.preventDefault();
    const vol = volontari.find((v) => v.id === formTimbVolontarioId);
    if (!vol) {
      mostraAvviso('Seleziona un volontario valido.');
      return;
    }

    let oreTotali = 0;
    let oreEMinuti = '0s';
    if (formTimbIngresso && formTimbUscita) {
      const durata = calcolaDurataTimbratura(formTimbIngresso, formTimbUscita);
      oreTotali = durata.oreDecimali;
      oreEMinuti = durata.durataTesto;
    }

    const nuovaTimb: TimbraturaVolontario = {
      id: `timb-${Date.now()}`,
      volontarioId: vol.id,
      volontarioNome: `${vol.nome} ${vol.cognome}`,
      qualifica: vol.qualifica || 'Volontario',
      data: formTimbData,
      orarioIngresso: formTimbIngresso,
      orarioUscita: formTimbUscita,
      oreTotali,
      oreEMinuti,
      sede: formTimbSede,
      sedeUscita: formTimbSedeUscita.trim() || formTimbSede,
      attivitaSvolta: formTimbAttivita.trim() || undefined,
      tipoAttivita: formTimbAttivita.trim() ? 'manuale' : undefined,
      modificataDaAdmin: true,
      dataUltimaModifica: `${formatISODateItaly()} ${formatTimeItaly(undefined, true)}`,
      operatoreModifica: operatoreCorrente,
      note: formTimbNote || 'Inserimento manuale registrato da Amministrazione'
    };

    onAggiornaTimbrature([nuovaTimb, ...timbrature]);
    setModaleNuovaTimbraturaAperta(false);
    onNotificaRadio?.(`🕒 TIMBRATURA MANUALE: Inserita presenza per ${nuovaTimb.volontarioNome} (${nuovaTimb.data})`, 'sistema');
    mostraAvviso(`Nuova timbratura registrata per ${nuovaTimb.volontarioNome}.`);
  };

  // Elimina Timbratura
  const handleEliminaTimbratura = (id: string, nome: string) => {
    setConfermaAzioneModal({
      titolo: 'Elimina Timbratura',
      messaggio: `Sei sicuro di voler eliminare definitivamente questa registrazione di timbratura per ${nome}?`,
      labelConferma: 'Elimina Timbratura',
      onConfirm: () => {
        const filtrate = timbrature.filter((t) => t.id !== id);
        onAggiornaTimbrature(filtrate);
        onNotificaRadio?.(`🗑️ TIMBRATURE: Rimossa registrazione timbratura per ${nome}`, 'sistema');
        mostraAvviso(`Timbratura eliminata con successo.`);
      }
    });
  };

  // Volontari filtrati per testo, mansione e stato
  const volontariFiltrati = volontari.filter((v) => {
    const mansioniVol = getMansioniVolontario(v);
    const matchTesto =
      !ricerca.trim() ||
      `${v.nome} ${v.cognome}`.toLowerCase().includes(ricerca.toLowerCase()) ||
      (v.codiceFiscale && v.codiceFiscale.toLowerCase().includes(ricerca.toLowerCase())) ||
      (v.matricola && v.matricola.toLowerCase().includes(ricerca.toLowerCase())) ||
      mansioniVol.some((m) => m.toLowerCase().includes(ricerca.toLowerCase())) ||
      (v.telefono && v.telefono.includes(ricerca)) ||
      (isEffettivoAdmin && v.pin && v.pin.includes(ricerca));

    const matchQualifica =
      filtroQualifica === 'tutti' ||
      mansioniVol.some((m) => m.toLowerCase() === filtroQualifica.toLowerCase()) ||
      v.qualifica === filtroQualifica;

    let matchStato = true;
    if (filtroStato === 'attivi') matchStato = Boolean(v.approvato && !v.bloccatoPerTentativi);
    if (filtroStato === 'attesa') matchStato = !v.approvato;
    if (filtroStato === 'bloccati') matchStato = Boolean(v.bloccatoPerTentativi);

    return matchTesto && matchQualifica && matchStato;
  });

  // Aspiranti volontari (domande di ammissione in attesa)
  const aspirantiInAttesa = volontari.filter((v) => !v.approvato);

  // Elenco unico delle sedi e luoghi presenti per il filtro
  const elencoSediTimbrature = Array.from(
    new Set([
      ...SEDI_ASSOCIATIVE_INIZIALI.map((s) => normalizzaNomeCarraraTesto(s.nome)),
      ...normalizzaListaLuoghiTimbratura(luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).map((l) =>
        normalizzaNomeCarraraTesto(l.nome)
      ),
      ...timbrature.map((t) => normalizzaNomeCarraraTesto(t.sede)).filter(Boolean)
    ])
  );

  // Intervallo temporale effettivo derivato dalla modalità scelta (Tutto / Giornaliero / Settimanale / Personalizzato)
  const intervalloTemporaleTimbrature = React.useMemo(() => {
    if (filtroTimbPeriodo === 'giornaliero') {
      const giorno = normalizzaDataISO(filtroTimbGiorno) || formatLocalISODate();
      return {
        dataInizio: giorno,
        dataFine: giorno,
        etichettaPeriodo: `Giornaliero (${getGiornoSettimanaIt(giorno)} ${formatDataItaliana(giorno)})`,
      };
    }
    if (filtroTimbPeriodo === 'settimanale') {
      const { inizio, fine } = calcolaIntervalloSettimanaISO(filtroTimbSettimanaRif);
      return {
        dataInizio: inizio,
        dataFine: fine,
        etichettaPeriodo: `Settimanale (Lun ${formatDataItaliana(inizio)} — Dom ${formatDataItaliana(fine)})`,
      };
    }
    if (filtroTimbPeriodo === 'personalizzato') {
      const da = normalizzaDataISO(filtroTimbDataInizio);
      const a = normalizzaDataISO(filtroTimbDataFine);
      return {
        dataInizio: da,
        dataFine: a,
        etichettaPeriodo:
          da || a
            ? `Personalizzato (${da ? formatDataItaliana(da) : 'Inizio'} ➔ ${a ? formatDataItaliana(a) : 'Oggi'})`
            : 'Personalizzato (Nessun limite di data)',
      };
    }
    return {
      dataInizio: '',
      dataFine: '',
      etichettaPeriodo: filtroTimbMese ? `Mese ${filtroTimbMese}` : "Tutto l'Archivio",
    };
  }, [filtroTimbPeriodo, filtroTimbGiorno, filtroTimbSettimanaRif, filtroTimbDataInizio, filtroTimbDataFine, filtroTimbMese]);

  const volontarioSelezionatoFiltro = React.useMemo(() => {
    if (filtroTimbVolontario === 'tutti') return null;
    return volontari.find((v) => v.id === filtroTimbVolontario) || null;
  }, [filtroTimbVolontario, volontari]);

  const etichettaVolontarioFiltro = volontarioSelezionatoFiltro
    ? `${volontarioSelezionatoFiltro.nome} ${volontarioSelezionatoFiltro.cognome}`.trim()
    : filtroTimbVolontario === 'tutti'
    ? 'Tutti i Volontari'
    : filtroTimbVolontario;

  // Timbrature filtrate (Nominativo Volontario + Sede + Filtro Temporale Giornaliero/Settimanale/Personalizzato + Ricerca)
  const timbratureFiltrate = timbrature
    .filter((t) => {
      // 1. Nominativo Volontario (opzionale) — corrispondenza per ID o nominativo completo
      let matchVol = filtroTimbVolontario === 'tutti';
      if (!matchVol) {
        if (t.volontarioId === filtroTimbVolontario) {
          matchVol = true;
        } else if (volontarioSelezionatoFiltro) {
          const nomRec = (t.volontarioNome || '').trim().toLowerCase();
          const full1 = `${volontarioSelezionatoFiltro.nome || ''} ${volontarioSelezionatoFiltro.cognome || ''}`.trim().toLowerCase();
          const full2 = `${volontarioSelezionatoFiltro.cognome || ''} ${volontarioSelezionatoFiltro.nome || ''}`.trim().toLowerCase();
          matchVol = Boolean(nomRec && (nomRec === full1 || nomRec === full2));
        } else {
          matchVol = (t.volontarioNome || '').toLowerCase().includes(filtroTimbVolontario.toLowerCase());
        }
      }

      // 2. Sede di timbratura (entrata o uscita, opzionale)
      const matchSede =
        filtroTimbSede === 'tutte' ||
        (t.sede || '').toLowerCase().includes(filtroTimbSede.toLowerCase()) ||
        (t.sedeUscita || '').toLowerCase().includes(filtroTimbSede.toLowerCase());

      // 3. Filtro temporale normalizzato YYYY-MM-DD (Giornaliero, Settimanale o Personalizzato)
      const dataNorm = normalizzaDataISO(t.data);
      const matchInizio = !intervalloTemporaleTimbrature.dataInizio || (dataNorm && dataNorm >= intervalloTemporaleTimbrature.dataInizio);
      const matchFine = !intervalloTemporaleTimbrature.dataFine || (dataNorm && dataNorm <= intervalloTemporaleTimbrature.dataFine);

      // Eventuale filtro mese rapido in modalità "Tutto"
      const matchMese =
        filtroTimbPeriodo !== 'tutto' ||
        !filtroTimbMese ||
        dataNorm.startsWith(filtroTimbMese);

      // Ricerca testuale libera
      const matchTesto =
        !ricerca.trim() ||
        (t.volontarioNome || '').toLowerCase().includes(ricerca.toLowerCase()) ||
        (t.sede || '').toLowerCase().includes(ricerca.toLowerCase()) ||
        (t.sedeUscita && t.sedeUscita.toLowerCase().includes(ricerca.toLowerCase())) ||
        (t.attivitaSvolta && t.attivitaSvolta.toLowerCase().includes(ricerca.toLowerCase())) ||
        (t.qualifica && t.qualifica.toLowerCase().includes(ricerca.toLowerCase())) ||
        (t.note && t.note.toLowerCase().includes(ricerca.toLowerCase()));

      return matchVol && matchSede && matchInizio && matchFine && matchMese && matchTesto;
    })
    .sort((a, b) => {
      const da = normalizzaDataISO(a.data);
      const db = normalizzaDataISO(b.data);
      const cmpData = db.localeCompare(da);
      if (cmpData !== 0) return cmpData;
      return (b.orarioIngresso || '').localeCompare(a.orarioIngresso || '');
    });

  const handleSpostaGiornoFiltro = (deltaGiorni: number) => {
    const base = normalizzaDataISO(filtroTimbGiorno) || formatLocalISODate();
    setFiltroTimbGiorno(addDaysISODate(base, deltaGiorni));
    setFiltroTimbPeriodo('giornaliero');
  };

  const handleSpostaSettimanaFiltro = (deltaSettimane: number) => {
    const base = normalizzaDataISO(filtroTimbSettimanaRif) || formatLocalISODate();
    setFiltroTimbSettimanaRif(addDaysISODate(base, deltaSettimane * 7));
    setFiltroTimbPeriodo('settimanale');
  };

  const handleEsportaReportCSV = () => {
    const nomeFile = esportaReportTimbratureCSV({
      timbrature: timbratureFiltrate,
      volontari,
      etichettaVolontario: etichettaVolontarioFiltro,
      etichettaPeriodo: intervalloTemporaleTimbrature.etichettaPeriodo,
      modalitaPeriodo: filtroTimbPeriodo,
      dataInizio: intervalloTemporaleTimbrature.dataInizio,
      dataFine: intervalloTemporaleTimbrature.dataFine,
      filtroSede: filtroTimbSede,
      filtroTesto: ricerca,
      singoloVolontarioId: filtroTimbVolontario !== 'tutti' ? filtroTimbVolontario : undefined,
    });
    onNotificaRadio?.(
      `📥 TIMBRATURE CSV: Esportato report (${timbratureFiltrate.length} record • ${etichettaVolontarioFiltro} • ${intervalloTemporaleTimbrature.etichettaPeriodo})`,
      'sistema'
    );
    mostraAvviso(`Report CSV esportato con successo: ${nomeFile} (${timbratureFiltrate.length} timbrature).`);
  };

  const handleEsportaReportExcel = () => {
    const nomeFile = esportaReportTimbratureExcel({
      timbrature: timbratureFiltrate,
      volontari,
      etichettaVolontario: etichettaVolontarioFiltro,
      etichettaPeriodo: intervalloTemporaleTimbrature.etichettaPeriodo,
      modalitaPeriodo: filtroTimbPeriodo,
      dataInizio: intervalloTemporaleTimbrature.dataInizio,
      dataFine: intervalloTemporaleTimbrature.dataFine,
      filtroSede: filtroTimbSede,
      filtroTesto: ricerca,
      singoloVolontarioId: filtroTimbVolontario !== 'tutti' ? filtroTimbVolontario : undefined,
    });
    onNotificaRadio?.(
      `📊 TIMBRATURE EXCEL: Esportato report (${timbratureFiltrate.length} record • ${etichettaVolontarioFiltro} • ${intervalloTemporaleTimbrature.etichettaPeriodo})`,
      'sistema'
    );
    mostraAvviso(`Report Excel (.xls) esportato con successo: ${nomeFile} (${timbratureFiltrate.length} timbrature).`);
  };

  // Gestione Mansioni: Creazione, Modifica di qualsiasi mansione esistente, Genitorialità ed Eliminazione con aggiornamento a cascata
  const handleApriCreaMansione = () => {
    setMansioneInModifica(null);
    setNuovaMansioneNome('');
    setNuovaMansioneDescrizione('');
    setNuovaMansioneCategoria(categorieMansioni[0]?.nome || 'Emergenza 118');
    setNuovaMansioneEmoji('🎖️');
    setNuovaMansioneParentId('');
    setNuovaMansioneIncluse(['Volontario']);
    setModalNuovaMansioneAperta(true);
  };

  const handleApriModificaMansione = (m: MansioneOperativa) => {
    setMansioneInModifica(m);
    setNuovaMansioneNome(m.nome);
    setNuovaMansioneDescrizione(m.descrizione || '');
    setNuovaMansioneCategoria(m.categoria);
    setNuovaMansioneEmoji(m.badgeEmoji || '🎖️');
    setNuovaMansioneParentId(m.parentMansioneId || '');
    setNuovaMansioneIncluse(Array.isArray(m.mansioniIncluse) && m.mansioniIncluse.length > 0 ? [...m.mansioniIncluse] : ['Volontario']);
    setModalNuovaMansioneAperta(true);
  };

  const handleSalvaMansione = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!nuovaMansioneNome.trim()) return;

    if (mansioneInModifica) {
      const vecchioNome = mansioneInModifica.nome;
      const nuovoNome = nuovaMansioneNome.trim();
      const aggiornato = modificaMansioneCatalogo(mansioneInModifica.id, {
        nome: nuovoNome,
        descrizione: nuovaMansioneDescrizione.trim() || undefined,
        categoria: nuovaMansioneCategoria,
        badgeEmoji: nuovaMansioneEmoji || '🎖️',
        parentMansioneId: nuovaMansioneParentId ? nuovaMansioneParentId : null,
        mansioniIncluse: nuovaMansioneIncluse
      });
      setCatalogoMansioni(aggiornato);
      realtime.syncMansioniConfig(aggiornato, getCategorieMansioni());

      if (vecchioNome !== nuovoNome) {
        const volontariAggiornati = aggiornaVolontariDopoModificaMansione(
          volontari,
          vecchioNome,
          nuovoNome,
          mansioneInModifica.id
        );
        onAggiornaVolontari(volontariAggiornati);
      }

      const tipiRes = aggiornaTipiTurnoDopoModificaMansione(
        vecchioNome,
        nuovoNome,
        mansioneInModifica.id,
        nuovaMansioneEmoji || '🎖️',
        nuovaMansioneCategoria
      );
      if (tipiRes.modificato) {
        realtime.syncTipiTurno(tipiRes.aggiornati);
      }
      emettiRinominaMansioneGlobale({
        mansioneId: mansioneInModifica.id,
        vecchioNome,
        nuovoNome,
        nuovaEmoji: nuovaMansioneEmoji || '🎖️',
        nuovaCategoria: nuovaMansioneCategoria,
      });

      setMansioneInModifica(null);
      setNuovaMansioneNome('');
      setNuovaMansioneDescrizione('');
      setNuovaMansioneParentId('');
      setNuovaMansioneIncluse(['Volontario']);
      setModalNuovaMansioneAperta(false);

      onNotificaRadio?.(`🏅 MANSIONI: Modificata mansione "${vecchioNome}" in "${nuovoNome}" (${nuovaMansioneCategoria})`, 'sistema');
      mostraAvviso(`✓ Mansione "${nuovoNome}" aggiornata automaticamente in tutto il gestionale e sincronizzata su tutti i dispositivi.`);
    } else {
      const creata = creaNuovaMansione({
        nome: nuovaMansioneNome.trim(),
        descrizione: nuovaMansioneDescrizione.trim() || undefined,
        categoria: nuovaMansioneCategoria,
        badgeEmoji: nuovaMansioneEmoji || '🎖️',
        parentMansioneId: nuovaMansioneParentId || undefined,
        mansioniIncluse: nuovaMansioneIncluse
      });
      const nuovoCat = getMansioniCatalogo();
      setCatalogoMansioni(nuovoCat);
      realtime.syncMansioniConfig(nuovoCat, getCategorieMansioni());
      setNuovaMansioneNome('');
      setNuovaMansioneDescrizione('');
      setNuovaMansioneParentId('');
      setNuovaMansioneIncluse(['Volontario']);
      setModalNuovaMansioneAperta(false);

      onNotificaRadio?.(`🏅 MANSIONI: Creata nuova mansione operativa "${creata.nome}" (${creata.categoria})`, 'sistema');
      mostraAvviso(`✓ Mansione "${creata.nome}" creata e sincronizzata su tutti i dispositivi.`);
    }
  };

  const handleEliminaMansione = (id: string, nome?: string) => {
    const nomeDaMostrare = nome || 'selezionata';
    const numVolontariConMansione = volontari.filter(v => getMansioniVolontario(v).includes(nomeDaMostrare)).length;
    const msgConferma = numVolontariConMansione > 0
      ? `Sei sicuro di voler eliminare la mansione "${nomeDaMostrare}" dal catalogo? Attualmente è assegnata a ${numVolontariConMansione} volontari e verrà rimossa dai loro fascicoli.`
      : `Sei sicuro di voler eliminare la mansione "${nomeDaMostrare}" dal catalogo?`;

    setConfermaAzioneModal({
      titolo: 'Elimina Mansione',
      messaggio: msgConferma,
      labelConferma: 'Elimina Mansione',
      onConfirm: () => {
        const aggiornato = eliminaMansioneCatalogo(id);
        setCatalogoMansioni(aggiornato);
        realtime.syncMansioniConfig(aggiornato, getCategorieMansioni());

        if (nome || id) {
          const volontariAggiornati = aggiornaVolontariDopoEliminazioneMansione(volontari, nome || '', id);
          onAggiornaVolontari(volontariAggiornati);
        }

        onNotificaRadio?.(`🗑️ MANSIONI: Rimossa mansione "${nomeDaMostrare}" dal catalogo`, 'sistema');
        mostraAvviso(`Mansione "${nomeDaMostrare}" eliminata e sincronizzata su tutti i dispositivi.`);
      }
    });
  };

  const handleRipristinaMansioniDefault = () => {
    setConfermaAzioneModal({
      titolo: 'Ripristina Mansioni Predefinite',
      messaggio: 'Vuoi ripristinare il catalogo iniziale delle mansioni predefinite della Croce Oro? Tutte le mansioni standard verranno reintegrate su tutti i dispositivi.',
      labelConferma: 'Ripristina Catalogo',
      onConfirm: () => {
        const defaultMansioni = ripristinaMansioniDefault();
        setCatalogoMansioni(defaultMansioni);
        realtime.syncMansioniConfig(defaultMansioni, getCategorieMansioni());
        mostraAvviso('✓ Catalogo mansioni predefinite ripristinato e sincronizzato su tutti i dispositivi.');
      }
    });
  };

  // Gestione Categorie Mansioni (Modifica, Creazione, Genitorialità, Eliminazione)
  const handleApriCreaCategoria = () => {
    setCategoriaInModifica(null);
    setFormCategoriaNome('');
    setFormCategoriaEmoji('📁');
    setFormCategoriaParentId('');
    setModalCategoriaAperta(true);
  };

  const handleApriModificaCategoria = (cat: CategoriaMansioneItem) => {
    setCategoriaInModifica(cat);
    setFormCategoriaNome(cat.nome);
    setFormCategoriaEmoji(cat.badgeEmoji || '📁');
    setFormCategoriaParentId(cat.parentCategoriaId || '');
    setModalCategoriaAperta(true);
  };

  const handleSalvaCategoria = (e?: React.FormEvent) => {
    e?.preventDefault();
    const nomePulito = formCategoriaNome.trim();
    if (!nomePulito) return;

    if (categoriaInModifica) {
      const res = modificaCategoriaMansione(categoriaInModifica.id, {
        nome: nomePulito,
        badgeEmoji: formCategoriaEmoji || '📁',
        parentCategoriaId: formCategoriaParentId ? formCategoriaParentId : null
      });
      setCategorieMansioni(res.categorie);
      setCatalogoMansioni(res.catalogo);
      if (filtroCategoriaMansione === res.vecchioNome && res.nuovoNome) {
        setFiltroCategoriaMansione(res.nuovoNome);
      }
      realtime.syncMansioniConfig(res.catalogo, res.categorie);
      onNotificaRadio?.(`📁 CATEGORIE MANSIONI: Modificata categoria "${res.vecchioNome}" in "${res.nuovoNome}" (effetto immediato globale)`, 'sistema');
      mostraAvviso(`✓ Categoria "${res.nuovoNome}" aggiornata su tutti i dispositivi.`);
    } else {
      const agg = creaCategoriaMansione({
        nome: nomePulito,
        badgeEmoji: formCategoriaEmoji || '📁',
        parentCategoriaId: formCategoriaParentId || undefined
      });
      setCategorieMansioni(agg);
      realtime.syncMansioniConfig(getMansioniCatalogo(), agg);
      onNotificaRadio?.(`📁 CATEGORIE MANSIONI: Creata categoria "${nomePulito}" (effetto immediato globale)`, 'sistema');
      mostraAvviso(`✓ Categoria "${nomePulito}" creata e sincronizzata su tutti i dispositivi.`);
    }

    setCategoriaInModifica(null);
    setFormCategoriaNome('');
    setFormCategoriaEmoji('📁');
    setFormCategoriaParentId('');
    setModalCategoriaAperta(false);
  };

  const handleEliminaCategoria = (cat: CategoriaMansioneItem) => {
    setConfermaAzioneModal({
      titolo: 'Elimina Categoria Mansioni',
      messaggio: `Sei sicuro di voler eliminare la categoria "${cat.nome}"? Le mansioni eventualmente collegate verranno riassegnate alla prima categoria disponibile.`,
      labelConferma: 'Elimina Categoria',
      onConfirm: () => {
        const res = eliminaCategoriaMansione(cat.id);
        setCategorieMansioni(res.categorie);
        setCatalogoMansioni(res.catalogo);
        if (filtroCategoriaMansione === cat.nome) {
          setFiltroCategoriaMansione('tutte');
        }
        realtime.syncMansioniConfig(res.catalogo, res.categorie);
        onNotificaRadio?.(`🗑️ CATEGORIE MANSIONI: Eliminata categoria "${cat.nome}"`, 'sistema');
        mostraAvviso(`Categoria "${cat.nome}" eliminata e sincronizzata su tutti i dispositivi.`);
      }
    });
  };

  const handleRipristinaCategorieDefault = () => {
    setConfermaAzioneModal({
      titolo: 'Ripristina Categorie Predefinite',
      messaggio: 'Vuoi ripristinare le categorie mansioni predefinite? La modifica sarà applicata immediatamente su tutti i dispositivi.',
      labelConferma: 'Ripristina Categorie',
      onConfirm: () => {
        const defCats = ripristinaCategorieMansioniDefault();
        setCategorieMansioni(defCats);
        setFiltroCategoriaMansione('tutte');
        realtime.syncMansioniConfig(getMansioniCatalogo(), defCats);
        mostraAvviso('✓ Categorie mansioni predefinite ripristinate su tutti i dispositivi.');
      }
    });
  };

  const handleAssegnaMansioniMassive = (azione: 'aggiungi' | 'sostituisci' | 'rimuovi') => {
    if (selectedVolontariMansioniIds.length === 0) {
      mostraAvviso('Seleziona almeno un volontario a cui assegnare o modificare le mansioni.');
      return;
    }
    if (selectedMansioniNomi.length === 0) {
      mostraAvviso('Seleziona almeno una mansione dal catalogo da applicare.');
      return;
    }

    const aggiornati = volontari.map((v) => {
      if (!selectedVolontariMansioniIds.includes(v.id)) return v;

      const mansioniAttuali = getMansioniVolontario(v);
      let nuoveMansioni: string[] = [];

      if (azione === 'aggiungi') {
        nuoveMansioni = Array.from(new Set([...mansioniAttuali, ...selectedMansioniNomi]));
      } else if (azione === 'sostituisci') {
        nuoveMansioni = [...selectedMansioniNomi];
      } else if (azione === 'rimuovi') {
        nuoveMansioni = mansioniAttuali.filter((m) => !selectedMansioniNomi.includes(m));
        if (nuoveMansioni.length === 0) nuoveMansioni = ['Volontario'];
      }

      const mansionePrincipale = nuoveMansioni[0] || 'Volontario';
      return {
        ...v,
        mansioni: nuoveMansioni,
        mansione: mansionePrincipale,
        qualifica: mansionePrincipale
      };
    });

    onAggiornaVolontari(aggiornati);

    const azioneTesto =
      azione === 'aggiungi' ? 'assegnate' : azione === 'sostituisci' ? 'impostate in esclusiva' : 'rimosse';

    onNotificaRadio?.(
      `🏅 MANSIONI AGGIORNATE: Mansioni [${selectedMansioniNomi.join(', ')}] ${azioneTesto} per ${selectedVolontariMansioniIds.length} volontari`,
      'sistema'
    );
    mostraAvviso(
      `✓ Mansioni ${azioneTesto} con successo a ${selectedVolontariMansioniIds.length} volontari contemporaneamente.`
    );
    setSelectedMansioniNomi([]);
  };

  const toggleVolontarioMansione = (id: string) => {
    if (selectedVolontariMansioniIds.includes(id)) {
      setSelectedVolontariMansioniIds(selectedVolontariMansioniIds.filter((item) => item !== id));
    } else {
      setSelectedVolontariMansioniIds([...selectedVolontariMansioniIds, id]);
    }
  };

  const selezionaTuttiVolontariMansioni = () => {
    if (selectedVolontariMansioniIds.length === volontari.length) {
      setSelectedVolontariMansioniIds([]);
    } else {
      setSelectedVolontariMansioniIds(volontari.map((v) => v.id));
    }
  };

  const toggleMansioneSelezionataPerAzione = (nome: string) => {
    if (selectedMansioniNomi.includes(nome)) {
      setSelectedMansioniNomi(selectedMansioniNomi.filter((item) => item !== nome));
    } else {
      setSelectedMansioniNomi([...selectedMansioniNomi, nome]);
    }
  };

  // Totale ore timbrate filtrate
  const totaleOreFiltrate = timbratureFiltrate.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 2 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/50">
                Macro Categoria 2
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {titoloDbVolontari}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Visualizza, inserisci e modifica anagrafiche, vestiario, PIN di sicurezza, domande di ammissione e modifica il registro timbrature di tutti gli account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canShowSubtab('mansioni') && (
            <button
              type="button"
              onClick={() => setSottoTab('mansioni')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                sottoTab === 'mansioni'
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
              }`}
              title="Vai subito alla sottosezione Mansioni & Competenze"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>7. {getTitoloSottosezione('volontari', 'mansioni', 'Mansioni & Competenze', nomiSubCustom)} ({catalogoMansioni.length})</span>
            </button>
          )}
          {canShowSubtab('anagrafiche') && (
            <button
              type="button"
              onClick={apriListaCompletaVolontari}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Apri Schede Anagrafiche Dettagliate</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert Notifica */}
      {messaggioConferma && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{messaggioConferma}</span>
        </div>
      )}

      {/* Barra Navigazione Sotto-Categorie: Griglia Responsiva Completa Visibile Senza Scorrimento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2 pb-2 border-b border-slate-800">
        {canShowSubtab('anagrafiche') && (
          <button
            type="button"
            onClick={() => setSottoTab('anagrafiche')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
              sottoTab === 'anagrafiche'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="break-words">1. {getTitoloSottosezione('volontari', 'anagrafiche', 'Anagrafiche', nomiSubCustom)} ({volontari.length})</span>
          </button>
        )}

        {canShowSubtab('vestiario') && (
          <button
            type="button"
            onClick={() => setSottoTab('vestiario')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
              sottoTab === 'vestiario'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Shirt className="w-4 h-4 shrink-0" />
            <span className="break-words">2. {getTitoloSottosezione('volontari', 'vestiario', 'Vestiario & DPI', nomiSubCustom)}</span>
          </button>
        )}

        {canShowSubtab('pin') && (
          <button
            type="button"
            onClick={() => setSottoTab('pin')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
              sottoTab === 'pin'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span className="break-words">3. {getTitoloSottosezione('volontari', 'pin', 'Gestione PIN', nomiSubCustom)}</span>
          </button>
        )}

        {canShowSubtab('domande') && (
          <button
            type="button"
            onClick={() => setSottoTab('domande')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer relative ${
              sottoTab === 'domande'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="break-words">4. {getTitoloSottosezione('volontari', 'domande', 'Domande Ammissione', nomiSubCustom)}</span>
            {aspirantiInAttesa.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center animate-pulse shrink-0">
                {aspirantiInAttesa.length}
              </span>
            )}
          </button>
        )}

        {canShowSubtab('timbrature') && (
          <button
            type="button"
            onClick={() => setSottoTab('timbrature')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
              sottoTab === 'timbrature'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="break-words">5. {getTitoloSottosezione('volontari', 'timbrature', 'Timbrature', nomiSubCustom)}</span>
          </button>
        )}

        {canShowSubtab('gruppi') && (
          <button
            type="button"
            onClick={() => setSottoTab('gruppi')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
              sottoTab === 'gruppi'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="break-words">6. {getTitoloSottosezione('volontari', 'gruppi', 'Gruppi', nomiSubCustom)}</span>
            {selectedVolontariGruppoIds.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0">
                {selectedVolontariGruppoIds.length}
              </span>
            )}
          </button>
        )}

        {canShowSubtab('mansioni') && (
          <button
            type="button"
            onClick={() => setSottoTab('mansioni')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer shadow-md ${
              sottoTab === 'mansioni'
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-amber-500/30'
                : 'bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border-2 border-amber-500/70'
            }`}
            title="7. Mansioni & Competenze Volontari"
          >
            <Award className={`w-4 h-4 shrink-0 ${sottoTab === 'mansioni' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span className="break-words">7. {getTitoloSottosezione('volontari', 'mansioni', 'Mansioni & Competenze', nomiSubCustom)} ({catalogoMansioni.length})</span>
            {selectedVolontariMansioniIds.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-300 font-black text-[10px] flex items-center justify-center shrink-0">
                {selectedVolontariMansioniIds.length}
              </span>
            )}
          </button>
        )}

        {canShowSubtab('permessi_database') && (
          <button
            type="button"
            onClick={() => setSottoTab('permessi_database')}
            className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer shadow-md ${
              sottoTab === 'permessi_database'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-300 border border-indigo-300'
                : 'bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-200 border-2 border-indigo-500/60'
            }`}
            title="8. Assegnazione Autorizzazioni Accesso ai Database & Sottosezioni"
          >
            <Shield className={`w-4 h-4 shrink-0 ${sottoTab === 'permessi_database' ? 'text-white' : 'text-indigo-400'}`} />
            <span className="break-words">8. {getTitoloSottosezione('volontari', 'permessi_database', 'Accesso Database', nomiSubCustom)}</span>
            {selectedVolontariPermessiIds.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0">
                {selectedVolontariPermessiIds.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: ANAGRAFICHE VOLONTARI                                   */}
      {/* ===================================================================== */}
      {sottoTab === 'anagrafiche' && (
        <div className="space-y-4">
          {/* KPI Riepilogo Monte Ore Anno 2026 Flotta Volontari */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Totale Ore Timbrate 2026</span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  {statisticheOreAnno.totaleOre.toLocaleString('it-IT')} h
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Turni Vidimati 2026</span>
                <div className="text-xl font-black text-blue-400 font-mono mt-0.5">
                  {statisticheOreAnno.totaleTurni} turni
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Volontari Attivi in Turno</span>
                <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                  {statisticheOreAnno.volontariAttivi} soci
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Media Ore / Volontario</span>
                <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
                  {statisticheOreAnno.mediaOre} h
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Barra Ricerca e Filtri */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca per nome, cognome, CF, matricola..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={filtroQualifica}
                onChange={(e) => setFiltroQualifica(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutte le Mansioni</option>
                {catalogoMansioni.map((m) => (
                  <option key={m.id} value={m.nome}>
                    {formatIconaPerTesto(m.badgeEmoji, '🏷️') ? `${formatIconaPerTesto(m.badgeEmoji, '🏷️')} ` : ''}{m.nome}
                  </option>
                ))}
              </select>

              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutti gli Stati</option>
                <option value="attivi">Solo Attivi</option>
                <option value="attesa">In Attesa Approvazione</option>
                <option value="bloccati">Sospesi / Bloccati</option>
              </select>

              <button
                type="button"
                onClick={handleEsportaBackupVolontariJSON}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                title="Esporta tutto l'elenco volontari in file JSON di backup"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Esporta Backup</span>
              </button>

              {isEffettivoAdmin && (
                <label
                  className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  title="Importa un file JSON esportato da un altro PC/browser per ricaricare profili mancanti"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Importa Backup</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportaBackupVolontariJSON}
                    className="hidden"
                  />
                </label>
              )}

              {isEffettivoAdmin && (
                <button
                  type="button"
                  disabled={invioSollecitoFirmaInCorso || volontariSenzaFirmaCount === 0}
                  onClick={richiediConfermaSollecitoFirmaEPin}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 text-amber-300 border border-amber-500/50 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  title="Invia notifica in-app ed email a tutti gli account senza firma caricata (con obbligo firma + cambio PIN 0000 al login)"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {invioSollecitoFirmaInCorso
                      ? 'Invio Sollecito...'
                      : `Sollecita Firma & PIN (${volontariSenzaFirmaCount})`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={apriNuovoVolontarioDiretto}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nuovo Volontario</span>
              </button>
            </div>
          </div>

          {esitoSollecitoFirma && (
            <div
              className={`rounded-xl px-4 py-3 border text-xs flex items-start justify-between gap-3 ${
                esitoSollecitoFirma.ok
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="space-y-1">
                <p className="font-bold">{esitoSollecitoFirma.testo}</p>
                {esitoSollecitoFirma.dettaglio && (
                  <p className="text-[11px] opacity-90">{esitoSollecitoFirma.dettaglio}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEsitoSollecitoFirma(null)}
                className="text-slate-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tabella Elenco Volontari */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Nominativo & Matricola</th>
                    <th className="py-3 px-4">Mansione & Competenze</th>
                    <th className="py-3 px-4 font-mono">Ore Timbrate 2026</th>
                    <th className="py-3 px-4">Recapiti</th>
                    {isEffettivoAdmin && <th className="py-3 px-4">PIN di Accesso</th>}
                    <th className="py-3 px-4">Stato Account</th>
                    <th className="py-3 px-4 text-right">Azioni Rapide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {volontariFiltrati.length === 0 ? (
                    <tr>
                      <td colSpan={isEffettivoAdmin ? 7 : 6} className="py-8 text-center text-slate-500">
                        Nessun volontario trovato con i criteri di ricerca specificati.
                      </td>
                    </tr>
                  ) : (
                    volontariFiltrati.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-black text-white text-sm">
                            {v.nome} {v.cognome}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                            <span>Matricola: <strong>{v.matricola || 'N/D'}</strong></span>
                            {v.codiceFiscale && <span>• CF: {v.codiceFiscale}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {(() => {
                            const mansioni = getMansioniVolontario(v);
                            const mansionePrinc = getMansionePrincipale(v);
                            const secondarie = mansioni.filter(m => m !== mansionePrinc);
                            const stilePrinc = getStileMansione(mansionePrinc, catalogoMansioni);

                            return (
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 shadow-sm ${stilePrinc.coloreBg} ${stilePrinc.coloreTesto} ${stilePrinc.coloreBorder}`}>
                                  <IconaEmoji value={stilePrinc.badgeEmoji} fallback="🏷️" />
                                  <span>{mansionePrinc}</span>
                                </span>
                                {secondarie.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {secondarie.map((sec, idx) => {
                                      const stileSec = getStileMansione(sec, catalogoMansioni);
                                      return (
                                        <span
                                          key={idx}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-1"
                                          title={`Mansione secondaria: ${sec}`}
                                        >
                                          <IconaEmoji value={stileSec.badgeEmoji} fallback="🏷️" />
                                          <span>{sec}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo !== 'Nessuna' && (
                                  <div className="text-[10px] text-amber-400 font-bold mt-0.5 flex items-center gap-1">
                                    <span>👑</span>
                                    <span>{v.caricaConsiglioDirettivo}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4">
                          {(() => {
                            const stat = calcolaOreAnnoVolontario(v);
                            return (
                              <div>
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 font-black font-mono text-xs inline-flex items-center gap-1 shadow-sm" title="Ore di servizio timbrate nel 2026">
                                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{stat.ore} h</span>
                                </span>
                                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                                  {stat.turni} turni nel 2026
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            {v.telefono && (
                              <span className="flex items-center gap-1 text-slate-300 font-mono">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                {v.telefono}
                              </span>
                            )}
                            {v.email && (
                              <span className="flex items-center gap-1 text-slate-400 truncate max-w-[180px]">
                                <Mail className="w-3 h-3 text-blue-400" />
                                {v.email}
                              </span>
                            )}
                          </div>
                        </td>
                        {isEffettivoAdmin && (
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-black tracking-widest border border-slate-700">
                                {mostraTuttiPin ? v.pin : '••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => copiaPin(v.pin, v.id)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Copia PIN"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => rigeneraPinVolontario(v.id)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                                title="Rigenera PIN"
                              >
                                <KeyRound className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          {!v.approvato ? (
                            <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                              In Attesa Approvazione
                            </span>
                          ) : v.bloccatoPerTentativi ? (
                            <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-black uppercase">
                              Account Sospeso
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Attivo & Idoneo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => apriFascicoloVolontarioDiretto(v)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-blue-400" />
                              <span>Gestisci Fascicolo</span>
                            </button>
                            {isEffettivoAdmin && (
                              <button
                                type="button"
                                onClick={() => setVolontarioDaEliminareSezione({ vol: v, modo: 'account' })}
                                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer active:scale-95"
                                title={`Elimina definitivamente l'account di ${v.nome} ${v.cognome}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SOTTO-TAB: VESTIARIO PERSONALE & DPI                                */}
      {/* ===================================================================== */}
      {sottoTab === 'vestiario' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase">Dotazione Vestiario & DPI Personale Assegnata</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Consulta le taglie, i capi consegnati e le cauzioni versate dai volontari (Giacca 4 Stagioni €45, Pantaloni soccorso €30).
              </p>
            </div>
            <button
              type="button"
              onClick={apriListaCompletaVolontari}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Shirt className="w-4 h-4" />
              <span>Consegna / Modifica Vestiario</span>
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Volontario</th>
                    <th className="py-3 px-4">Giacca 4S (€45)</th>
                    <th className="py-3 px-4">Pantaloni (€30)</th>
                    <th className="py-3 px-4">Felpa / Pile</th>
                    <th className="py-3 px-4">Polo / T-Shirt</th>
                    <th className="py-3 px-4">Cauzione Totale</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {volontari.map((v) => {
                    const vest = v.vestiario;
                    const giaccaConsegnata = vest?.giubbetto?.consegnato;
                    const pantConsegnati = vest?.pantaloni?.consegnato;
                    const cauzione = calcolaCauzioneTotale(vest).totale;

                    return (
                      <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{v.nome} {v.cognome}</div>
                          <div className="text-[11px] text-slate-400">{v.qualifica}</div>
                        </td>
                        <td className="py-3 px-4">
                          {giaccaConsegnata ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-bold text-[11px]">
                              Taglia {vest?.giubbetto?.taglia || 'L'}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Non Consegnata</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {pantConsegnati ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 font-bold text-[11px]">
                              Taglia {vest?.pantaloni?.taglia || 'L'}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Non Consegnati</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {vest?.pile?.consegnato ? (
                            <span className="text-emerald-400 font-bold">Pile ({vest.pile.taglia})</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {vest?.tshirt && vest.tshirt.some(t => t.consegnato) ? (
                            <span className="text-emerald-400 font-bold">
                              {vest.tshirt.filter(t => t.consegnato).length} Pezzi
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          {cauzione > 0 ? `€ ${cauzione.toFixed(2)}` : '€ 0,00'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => apriFascicoloVolontarioDiretto(v, 'vestiario')}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold text-xs cursor-pointer"
                          >
                            Dettagli Vestiario
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SOTTO-TAB: VISUALIZZAZIONE & GESTIONE PIN                           */}
      {/* ===================================================================== */}
      {sottoTab === 'pin' && (
        !isEffettivoAdmin ? (
          <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="inline-flex p-3.5 rounded-2xl bg-red-900/50 text-red-400 border border-red-700/60 shadow-lg shadow-red-950/50">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Accesso Riservato all'Amministratore</h3>
              <p className="text-xs text-red-200/80 max-w-lg mx-auto mt-1 leading-relaxed">
                La visualizzazione e gestione dei codici PIN dei volontari e del personale operativo è rigorosamente riservata all'Amministratore della Centrale Operativa. Nessun altro ruolo o operatore è autorizzato ad accedere a queste credenziali.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSottoTab('anagrafiche')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700 cursor-pointer shadow-md"
            >
              Torna alle Anagrafiche
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Tabella PIN di Sicurezza Personale Operativo</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  In qualità di amministratore puoi visualizzare, copiare negli appunti o rigenerare all'istante il PIN numerico a 4 cifre di qualunque volontario o operatore.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMostraTuttiPin(!mostraTuttiPin)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {mostraTuttiPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{mostraTuttiPin ? 'Nascondi Tutti i PIN' : 'Mostra Tutti i PIN'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {volontari.map((v) => (
                <div
                  key={v.id}
                  className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-md hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="font-black text-white text-sm">{v.nome} {v.cognome}</div>
                    <div className="text-[11px] text-slate-400">{v.qualifica || 'Volontario'} • Matricola: {v.matricola || 'N/D'}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">PIN Accesso:</span>
                      <span className="px-2.5 py-1 rounded bg-slate-900 text-amber-300 font-mono font-black text-sm tracking-widest border border-slate-700">
                        {mostraTuttiPin ? v.pin : '••••'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => copiaPin(v.pin, v.id)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                      title="Copia PIN"
                    >
                      <Copy className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rigeneraPinVolontario(v.id)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                      title="Genera Nuovo PIN Casuale"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ===================================================================== */}
      {/* 4. SOTTO-TAB: DOMANDE DI AMMISSIONE                                    */}
      {/* ===================================================================== */}
      {sottoTab === 'domande' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Domande di Iscrizione & Nuovi Aspiranti Volontari</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Esamina le richieste di associazione inviate dagli aspiranti soci, valuta i requisiti e approva o respingi le domande con rilascio PIN.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
              {aspirantiInAttesa.length} Domande in Attesa di Delibera
            </span>
          </div>

          {aspirantiInAttesa.length === 0 ? (
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="font-bold text-white text-sm">Nessuna Domanda in Attesa</div>
              <p className="text-xs text-slate-500">Tutte le domande di ammissione sono state valutate e deliberate dal Direttivo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aspirantiInAttesa.map((asp) => (
                <div key={asp.id} className="bg-slate-950 p-5 rounded-2xl border border-amber-500/40 shadow-xl space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">{asp.nome} {asp.cognome}</div>
                      <div className="text-xs text-slate-400">CF: {asp.codiceFiscale || 'Non fornito'}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                        <span>📞 {asp.telefono || 'N/D'}</span>
                        <span>✉️ {asp.email || 'N/D'}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-black uppercase">
                      In Attesa
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                    <div className="font-semibold text-slate-400">Residenza:</div>
                    <div>{asp.indirizzoResidenza || (asp.dettaglioResidenza ? `${asp.dettaglioResidenza.indirizzo}, ${asp.dettaglioResidenza.comune} (${asp.dettaglioResidenza.provincia})` : 'Massa (MS)')}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => approvaAspirante(asp)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approva Domanda Socio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rifiutaAspirante(asp)}
                      className="py-2 px-3 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Respingi</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. SOTTO-TAB: REGISTRO TIMBRATURE (MODIFICABILE DALL'AMMINISTRATORE)    */}
      {/* ===================================================================== */}
      {sottoTab === 'timbrature' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase">
                  Registro Timbrature & Presenze di Tutti gli Account
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualizza e <strong>modifica direttamente</strong> orari di ingresso, uscita e presenze registrate di tutti i volontari e operatori.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setModaleGestioneLuoghiAperta(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                title="Gestione Luoghi di Timbratura GPS e Raggio a discrezione operatore"
              >
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>📍 Luoghi GPS ({(luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).length})</span>
              </button>
              <button
                type="button"
                onClick={apriModaleNuovoLuogo}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                title="Crea nuovo luogo di timbratura (Effetto Immediato)"
              >
                <PlusCircle className="w-4 h-4" />
                <span>➕ Nuovo Luogo Timbratura</span>
              </button>
              <button
                type="button"
                onClick={handleEsportaReportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-emerald-400/50"
                title="Esporta in formato Microsoft Excel (.xls) tutte le timbrature filtrate per data e volontario"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Esporta Excel</span>
              </button>
              <button
                type="button"
                onClick={handleEsportaReportCSV}
                className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-cyan-400/50"
                title="Esporta in formato CSV compatibile Excel tutte le timbrature filtrate per data e volontario"
              >
                <Download className="w-4 h-4 text-cyan-200" />
                <span>Esporta CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setModaleStampaRegistroAperta(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa Registro</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormTimbVolontarioId(
                    filtroTimbVolontario !== 'tutti' ? filtroTimbVolontario : (volontari[0]?.id || '')
                  );
                  setFormTimbData(
                    filtroTimbPeriodo === 'giornaliero' && filtroTimbGiorno
                      ? filtroTimbGiorno
                      : formatLocalISODate()
                  );
                  setFormTimbIngresso('08:00:00');
                  setFormTimbUscita('14:00:00');
                  setFormTimbSede('Sede Operativa Massa (Le Jare)');
                  setFormTimbSedeUscita('');
                  setFormTimbNote('');
                  setModaleNuovaTimbraturaAperta(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuova Timbratura Manuale</span>
              </button>
            </div>
          </div>

          {/* Filtri Timbrature: Modalità Temporale (Tutto / Giornaliero / Settimanale / Personalizzato), Singolo Volontario, Sede e Report Excel/CSV */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-400" />
                Filtri Temporali & Ricerca Registro Timbrature
              </span>
              {(filtroTimbVolontario !== 'tutti' ||
                filtroTimbSede !== 'tutte' ||
                filtroTimbPeriodo !== 'tutto' ||
                filtroTimbDataInizio ||
                filtroTimbDataFine ||
                filtroTimbMese ||
                ricerca) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroTimbVolontario('tutti');
                    setFiltroTimbSede('tutte');
                    setFiltroTimbPeriodo('tutto');
                    setFiltroTimbGiorno(formatLocalISODate());
                    setFiltroTimbSettimanaRif(formatLocalISODate());
                    setFiltroTimbDataInizio('');
                    setFiltroTimbDataFine('');
                    setFiltroTimbMese('');
                    setRicerca('');
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Azzera Tutti i Filtri</span>
                </button>
              )}
            </div>

            {/* Riga 1: Selettore Temporale Rapido (Tutto / Giornaliero / Settimanale / Personalizzato) */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-black uppercase text-slate-300">
                    Filtro Temporale Log:
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1 max-w-2xl">
                  <button
                    type="button"
                    onClick={() => setFiltroTimbPeriodo('tutto')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer border ${
                      filtroTimbPeriodo === 'tutto'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    Tutto l'Archivio
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTimbPeriodo('giornaliero')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer border ${
                      filtroTimbPeriodo === 'giornaliero'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-slate-950 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    📅 Giornaliero
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTimbPeriodo('settimanale')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer border ${
                      filtroTimbPeriodo === 'settimanale'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md'
                        : 'bg-slate-950 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    🗓️ Settimanale
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTimbPeriodo('personalizzato')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer border ${
                      filtroTimbPeriodo === 'personalizzato'
                        ? 'bg-violet-500 text-white border-violet-300 shadow-md'
                        : 'bg-slate-950 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    ⚙️ Personalizzato
                  </button>
                </div>
              </div>

              {/* Controlli Contestuali per Modalità Temporale */}
              {filtroTimbPeriodo === 'giornaliero' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSpostaGiornoFiltro(-1)}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Giorno Precedente"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                      type="date"
                      value={filtroTimbGiorno}
                      onChange={(e) => setFiltroTimbGiorno(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/60 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleSpostaGiornoFiltro(1)}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Giorno Successivo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTimbGiorno(formatLocalISODate())}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer"
                    >
                      Oggi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTimbGiorno(addDaysISODate(formatISODateItaly(), -1));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      Ieri
                    </button>
                  </div>
                  <span className="text-xs font-bold text-amber-300">
                    {intervalloTemporaleTimbrature.etichettaPeriodo}
                  </span>
                </div>
              )}

              {filtroTimbPeriodo === 'settimanale' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSpostaSettimanaFiltro(-1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Settimana Precedente"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Sett. Prec.</span>
                    </button>
                    <input
                      type="date"
                      value={filtroTimbSettimanaRif}
                      onChange={(e) => setFiltroTimbSettimanaRif(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/60 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                      title="Scegli un giorno qualsiasi per visualizzare la relativa settimana (Lunedì-Domenica)"
                    />
                    <button
                      type="button"
                      onClick={() => handleSpostaSettimanaFiltro(1)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Settimana Successiva"
                    >
                      <span>Sett. Succ.</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTimbSettimanaRif(formatLocalISODate())}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold cursor-pointer"
                    >
                      Questa Settimana
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTimbSettimanaRif(addDaysISODate(formatISODateItaly(), -7));
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      Settimana Scorsa
                    </button>
                  </div>
                  <span className="text-xs font-bold text-emerald-300 font-mono">
                    {intervalloTemporaleTimbrature.etichettaPeriodo}
                  </span>
                </div>
              )}

              {filtroTimbPeriodo === 'personalizzato' && (
                <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Data Inizio (Da)
                      </label>
                      <input
                        type="date"
                        value={filtroTimbDataInizio}
                        onChange={(e) => setFiltroTimbDataInizio(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 border border-violet-500/60 text-xs font-bold text-white focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                        Data Fine (A)
                      </label>
                      <input
                        type="date"
                        value={filtroTimbDataFine}
                        onChange={(e) => setFiltroTimbDataFine(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 border border-violet-500/60 text-xs font-bold text-white focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const oggiIso = formatISODateItaly();
                        setFiltroTimbDataInizio(`${oggiIso.slice(0, 7)}-01`);
                        setFiltroTimbDataFine(oggiIso);
                      }}
                      className="px-2.5 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-[11px] font-bold cursor-pointer"
                    >
                      Mese Corrente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const oggiIso = formatISODateItaly();
                        setFiltroTimbDataInizio(addDaysISODate(oggiIso, -30));
                        setFiltroTimbDataFine(oggiIso);
                      }}
                      className="px-2.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      Ultimi 30 Giorni
                    </button>
                  </div>
                  <span className="text-xs font-bold text-violet-300 font-mono">
                    {intervalloTemporaleTimbrature.etichettaPeriodo}
                  </span>
                </div>
              )}
            </div>

            {/* Riga 2: Singolo Volontario, Sede Operativa, Mese Rapido (in modalità Tutto) e Ricerca Testo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Filtro 1: Singolo Volontario */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Singolo Volontario / Tutti
                </label>
                <select
                  value={filtroTimbVolontario}
                  onChange={(e) => setFiltroTimbVolontario(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="tutti">Tutti i Volontari ({volontari.length})</option>
                  {[...volontari]
                    .sort((a, b) =>
                      `${a.cognome || ''} ${a.nome || ''}`.localeCompare(`${b.cognome || ''} ${b.nome || ''}`, 'it')
                    )
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.cognome} {v.nome} ({v.matricola || 'N/D'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Filtro 2: Sede di timbratura */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Sede di Timbratura
                </label>
                <select
                  value={filtroTimbSede}
                  onChange={(e) => setFiltroTimbSede(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="tutte">Tutte le Sedi Operative</option>
                  {elencoSediTimbrature.map((sede) => (
                    <option key={sede} value={sede}>
                      {sede}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro 3: Mese Rapido (se in modalità Tutto) oppure Info Intervallo */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  {filtroTimbPeriodo === 'tutto' ? 'Filtro Mese Rapido (Opzionale)' : 'Intervallo Temporale Attivo'}
                </label>
                {filtroTimbPeriodo === 'tutto' ? (
                  <input
                    type="month"
                    value={filtroTimbMese}
                    onChange={(e) => setFiltroTimbMese(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs font-mono text-amber-300 truncate">
                    {intervalloTemporaleTimbrature.dataInizio
                      ? `${formatDataItaliana(intervalloTemporaleTimbrature.dataInizio)} ➔ ${formatDataItaliana(intervalloTemporaleTimbrature.dataFine || intervalloTemporaleTimbrature.dataInizio)}`
                      : 'Periodo libero'}
                  </div>
                )}
              </div>

              {/* Filtro 4: Ricerca testuale */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Ricerca Rapida
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca volontario, sede o note..."
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Banner Riepilogo Singolo Volontario (quando è filtrato un singolo volontario) */}
            {volontarioSelezionatoFiltro && (
              <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-500/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 font-black text-xs">
                    {volontarioSelezionatoFiltro.nome?.[0]}
                    {volontarioSelezionatoFiltro.cognome?.[0]}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-2">
                      <span>{volontarioSelezionatoFiltro.nome} {volontarioSelezionatoFiltro.cognome}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-700">
                        {volontarioSelezionatoFiltro.matricola || 'N/D'}
                      </span>
                    </div>
                    <div className="text-[11px] text-blue-200">
                      {volontarioSelezionatoFiltro.qualifica} • {intervalloTemporaleTimbrature.etichettaPeriodo}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Log nel Periodo</span>
                    <strong className="text-white text-sm">{timbratureFiltrate.length}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Ore Totali Periodo</span>
                    <strong className="text-amber-400 text-sm">{totaleOreFiltrate.toFixed(1)}h</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Barra KPI & Azioni Esportazione Rapida */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <span className="text-slate-400">
                  Timbrature trovate: <strong className="text-white font-bold">{timbratureFiltrate.length}</strong>
                </span>
                <span className="text-slate-400">
                  Totale Ore Filtrate: <strong className="text-amber-400 font-bold text-sm">{totaleOreFiltrate.toFixed(1)} Ore</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleEsportaReportExcel}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 text-white font-bold text-[11px] uppercase flex items-center gap-1.5 border border-emerald-400/40 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Report Excel (.xls)</span>
                </button>
                <button
                  type="button"
                  onClick={handleEsportaReportCSV}
                  className="px-3 py-1.5 rounded-xl bg-cyan-700/90 hover:bg-cyan-600 text-white font-bold text-[11px] uppercase flex items-center gap-1.5 border border-cyan-400/40 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Report CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabella Timbrature */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Volontario</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Ingresso — Uscita</th>
                    <th className="py-3 px-4">Ore Totali</th>
                    <th className="py-3 px-4">Sede / Postazione</th>
                    <th className="py-3 px-4">Cosa stai facendo / Attività</th>
                    <th className="py-3 px-4">Stato / Modifica</th>
                    <th className="py-3 px-4 text-right">Azioni Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {timbratureFiltrate.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nessuna timbratura registrata con i filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    timbratureFiltrate.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{t.volontarioNome}</div>
                          <div className="text-[11px] text-slate-400">{t.qualifica}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-300">
                          {t.data}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-emerald-400 font-bold">{t.orarioIngresso}</span>
                          <span className="text-slate-500 mx-1.5">➔</span>
                          <span className={t.orarioUscita ? 'text-amber-400 font-bold' : 'text-slate-500 italic'}>
                            {t.orarioUscita || 'In Turno...'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-amber-400 text-sm">
                          <div>{t.oreTotali !== undefined ? `${t.oreTotali}h` : '—'}</div>
                          {t.orarioUscita && (
                            <div className="text-[10px] font-normal text-slate-400">{formatDurataTimbratura(t)}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white font-bold">
                            {t.sedeUscita && t.sedeUscita !== t.sede ? `Entrata: ${t.sede}` : t.sede}
                          </div>
                          {t.sedeUscita && t.sedeUscita !== t.sede && (
                            <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
                              Uscita: {t.sedeUscita}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[230px]">
                          {t.attivitaSvolta ? (
                            <div className="text-xs font-semibold text-amber-200 break-words">
                              {t.attivitaSvolta}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {t.modificataDaAdmin ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50 text-[10px] font-bold block w-fit" title={`Modificato da ${t.operatoreModifica || 'Admin'} il ${t.dataUltimaModifica || ''}`}>
                              ✏️ Modificata da Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px] font-bold block w-fit">
                              Originale
                            </span>
                          )}
                          {t.note && <div className="text-[10px] text-slate-400 italic mt-0.5 max-w-[200px] truncate">{t.note}</div>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTimbraturaInModifica(t);
                                setFormTimbData(t.data);
                                setFormTimbIngresso(t.orarioIngresso);
                                setFormTimbUscita(t.orarioUscita || '13:00:00');
                                setFormTimbSede(t.sede || 'Sede Operativa Massa (Le Jare)');
                                setFormTimbSedeUscita(t.sedeUscita || '');
                                setFormTimbAttivita(t.attivitaSvolta || '');
                                setFormTimbNote(t.note || '');
                              }}
                              className="p-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 transition-colors"
                              title="Modifica Orari o Note Timbratura"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminaTimbratura(t.id, t.volontarioNome)}
                              className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 transition-colors"
                              title="Elimina Registrazione"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALE MODIFICA TIMBRATURA (AMMINISTRATORE) */}
      {timbraturaInModifica && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Modifica Timbratura Volontario
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTimbraturaInModifica(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaModificaTimbratura} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-white text-sm">{timbraturaInModifica.volontarioNome}</div>
                <div className="text-slate-400">{timbraturaInModifica.qualifica}</div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Data Servizio</label>
                <input
                  type="date"
                  required
                  value={formTimbData}
                  onChange={(e) => setFormTimbData(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orario Ingresso (HH:mm:ss)</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formTimbIngresso}
                    onChange={(e) => setFormTimbIngresso(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orario Uscita (HH:mm:ss)</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formTimbUscita}
                    onChange={(e) => setFormTimbUscita(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sede Operativa Entrata</label>
                  <input
                    type="text"
                    required
                    value={formTimbSede}
                    onChange={(e) => setFormTimbSede(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sede Uscita (opz. se diversa)</label>
                  <input
                    type="text"
                    value={formTimbSedeUscita}
                    onChange={(e) => setFormTimbSedeUscita(e.target.value)}
                    placeholder={formTimbSede || 'Uguale a sede entrata'}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Cosa stava facendo / Attività Svolta</label>
                <input
                  type="text"
                  value={formTimbAttivita}
                  onChange={(e) => setFormTimbAttivita(e.target.value)}
                  placeholder="Es. Turno Sede, Corso Formazione, Manutenzione..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Motivo della Modifica / Note Admin</label>
                <textarea
                  rows={2}
                  value={formTimbNote}
                  onChange={(e) => setFormTimbNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Es. Rettifica orario uscita su segnalazione capoturno"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTimbraturaInModifica(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Modifiche Timbratura</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA TIMBRATURA MANUALE */}
      {modaleNuovaTimbraturaAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Inserisci Nuova Timbratura Manuale
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaTimbraturaAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAggiungiNuovaTimbratura} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Seleziona Volontario</label>
                <select
                  required
                  value={formTimbVolontarioId}
                  onChange={(e) => setFormTimbVolontarioId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="">-- Seleziona un volontario --</option>
                  {volontari.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} {v.cognome} ({v.qualifica || 'Volontario'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Data Servizio</label>
                <input
                  type="date"
                  required
                  value={formTimbData}
                  onChange={(e) => setFormTimbData(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orario Ingresso (HH:mm:ss)</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formTimbIngresso}
                    onChange={(e) => setFormTimbIngresso(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orario Uscita (HH:mm:ss)</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formTimbUscita}
                    onChange={(e) => setFormTimbUscita(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sede Operativa Entrata</label>
                  <input
                    type="text"
                    required
                    value={formTimbSede}
                    onChange={(e) => setFormTimbSede(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sede Uscita (opz. se diversa)</label>
                  <input
                    type="text"
                    value={formTimbSedeUscita}
                    onChange={(e) => setFormTimbSedeUscita(e.target.value)}
                    placeholder={formTimbSede || 'Uguale a sede entrata'}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Cosa stava facendo / Attività Svolta</label>
                <input
                  type="text"
                  value={formTimbAttivita}
                  onChange={(e) => setFormTimbAttivita(e.target.value)}
                  placeholder="Es. Turno Sede, Corso Formazione, Manutenzione..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note Registrazione</label>
                <textarea
                  rows={2}
                  value={formTimbNote}
                  onChange={(e) => setFormTimbNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Inserisci eventuali note per la timbratura"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleNuovaTimbraturaAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Registra Timbratura</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALE GESTIONE LUOGHI DI TIMBRATURA GPS (A DISCREZIONE OPERATORE)     */}
      {/* ===================================================================== */}
      {modaleGestioneLuoghiAperta && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 space-y-4 my-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                    <span>Luoghi di Timbratura GPS & Raggio di Validità</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      Effetto Immediato
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chi ha accesso al database timbrature può creare nuovi luoghi e stabilire il raggio di ampiezza a propria discrezione.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleGestioneLuoghiAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Banner Effetto Immediato */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-950 to-amber-950/60 border border-amber-500/40 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-200">
                  <strong>⚡ Effetto Immediato:</strong> Ogni nuovo luogo creato o modifica al raggio di validità entra in vigore istantaneamente su tutti i dispositivi e app senza dover ricaricare la pagina.
                </span>
              </div>
              <button
                type="button"
                onClick={apriModaleNuovoLuogo}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shrink-0 shadow-lg active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuovo Luogo</span>
              </button>
            </div>

            {/* Tabella Luoghi di Timbratura */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                    <th className="py-2.5 px-3">Postazione / Luogo</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Coordinate GPS</th>
                    <th className="py-2.5 px-3 text-center">Raggio di Validità</th>
                    <th className="py-2.5 px-3 text-center">Stato</th>
                    <th className="py-2.5 px-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        Nessun luogo di timbratura configurato. Clicca su "Nuovo Luogo" per crearne uno.
                      </td>
                    </tr>
                  ) : (
                    (luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).map((luogo) => (
                      <tr key={luogo.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{luogo.nome}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{luogo.indirizzo}</div>
                          {luogo.descrizione && (
                            <div className="text-[9.5px] text-slate-500 italic truncate max-w-xs mt-0.5">
                              {luogo.descrizione}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-mono uppercase font-bold">
                            {luogo.tipo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                          <div>Lat: {luogo.coordinate.lat.toFixed(5)}</div>
                          <div>Lng: {luogo.coordinate.lng.toFixed(5)}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-black inline-block shadow-sm">
                            {luogo.raggioMetri} m
                          </span>
                          <span className="block text-[9px] text-slate-400 mt-0.5">
                            A discrezione operatore
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAttivoLuogo(luogo.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                              luogo.attivo
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/50 hover:bg-red-500/30'
                            }`}
                            title="Clicca per attivare/disattivare"
                          >
                            {luogo.attivo ? 'Attivo' : 'Disattivato'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => apriModaleModificaLuogo(luogo)}
                              className="px-2 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-700/60 transition-colors cursor-pointer flex items-center gap-1 text-[10.5px] font-bold"
                              title="Modifica raggio di validità o riposiziona il PIN su mappa"
                            >
                              <MapPin className="w-3 h-3 text-teal-400" />
                              <span>Mappa & PIN</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminaLuogo(luogo.id, luogo.nome)}
                              className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 transition-colors cursor-pointer"
                              title="Elimina postazione"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Totale postazioni: <strong>{(luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).length}</strong> ({(luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT).filter(l => l.attivo).length} attive)
              </span>
              <button
                type="button"
                onClick={() => setModaleGestioneLuoghiAperta(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALE NUOVO / MODIFICA LUOGO DI TIMBRATURA (CREAZIONE CON EFFETTO IMM.) */}
      {/* ===================================================================== */}
      {modaleNuovoLuogoAperta && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border-2 border-teal-500/50 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {luogoInModifica ? 'Modifica Luogo di Timbratura GPS' : 'Crea Nuovo Luogo di Timbratura GPS'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovoLuogoAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avviso Effetto Immediato */}
            <div className="p-3 bg-teal-950/60 border border-teal-500/50 rounded-xl text-xs text-teal-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-300 shrink-0" />
              <div>
                <strong>Effetto Immediato:</strong> La creazione o modifica è istantanea per tutti i volontari in turno su qualsiasi smartphone.
              </div>
            </div>

            <form onSubmit={handleSalvaLuogoTimbratura} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome del Luogo o Postazione</label>
                <input
                  type="text"
                  required
                  value={formLuogoNome}
                  onChange={(e) => setFormLuogoNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-sm"
                  placeholder="Es. Ospedale delle Apuane - NOA, Piazza Betti, Stand CarraraFiere..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Identificativo</label>
                  <input
                    type="text"
                    required
                    value={formLuogoCodice}
                    onChange={(e) => setFormLuogoCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono uppercase"
                    placeholder="Es. POST-NOA"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipologia Postazione</label>
                  <select
                    value={formLuogoTipo}
                    onChange={(e) => setFormLuogoTipo(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="presidio">Presidio Territoriale</option>
                    <option value="sede">Sede Ufficiale</option>
                    <option value="ospedale">Ospedale / Pronto Soccorso</option>
                    <option value="evento">Evento / Manifestazione / Fiera</option>
                    <option value="postazione_estiva">Postazione Estiva / Spiaggia</option>
                    <option value="altro">Altro Luogo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Indirizzo Completo</label>
                <input
                  type="text"
                  required
                  value={formLuogoIndirizzo}
                  onChange={(e) => setFormLuogoIndirizzo(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Es. Viale Mattei, Massa (MS)"
                />
              </div>

              {/* GEOLOCALIZZAZIONE INTERATTIVA PIN SU MAPPA */}
              <div className="pt-1">
                <MappaSelezioneLuogoTimbratura
                  lat={formLuogoLat}
                  lng={formLuogoLng}
                  raggioMetri={formLuogoRaggioMetri}
                  nomeLuogo={formLuogoNome}
                  indirizzoAttuale={formLuogoIndirizzo}
                  onPosizioneChange={({ lat, lng, indirizzo }) => {
                    setFormLuogoLat(lat);
                    setFormLuogoLng(lng);
                    if (indirizzo) {
                      setFormLuogoIndirizzo(indirizzo);
                    }
                  }}
                />
              </div>

              {/* Coordinate GPS con rilevamento sensore e preset */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold text-[11px] uppercase flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-blue-400" />
                    Coordinate GPS Centro Postazione
                  </span>
                  <button
                    type="button"
                    onClick={rilevaGpsPerLuogo}
                    disabled={rilevamentoGpsLuogoInCorso}
                    className="px-2.5 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Navigation className={`w-3 h-3 text-blue-400 ${rilevamentoGpsLuogoInCorso ? 'animate-spin' : ''}`} />
                    <span>Cattura GPS Dispositivo</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-mono mb-1">Latitudine</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={formLuogoLat}
                      onChange={(e) => setFormLuogoLat(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] font-mono mb-1">Longitudine</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={formLuogoLng}
                      onChange={(e) => setFormLuogoLng(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Preset territoriali rapidi */}
                <div className="pt-1 flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-slate-500 font-bold">Preset:</span>
                  <button
                    type="button"
                    onClick={() => { setFormLuogoLat(44.0365); setFormLuogoLng(10.1415); setFormLuogoIndirizzo('Via Dorsale 15, 54100 Massa (MS)'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Massa Sede
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormLuogoLat(44.0289); setFormLuogoLng(10.1264); setFormLuogoIndirizzo('Viale Mattei, 54100 Massa (MS)'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Ospedale NOA
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormLuogoLat(44.0042); setFormLuogoLng(10.1118); setFormLuogoIndirizzo('Piazza Betti, 54100 Marina di Massa (MS)'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Marina di Massa
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormLuogoLat(44.0789); setFormLuogoLng(10.1015); setFormLuogoIndirizzo('Piazza II Giugno, 54033 Carrara (MS)'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Carrara Centro
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormLuogoLat(44.0456); setFormLuogoLng(10.0412); setFormLuogoIndirizzo('Viale Galileo Galilei 133, 54033 Marina di Carrara (MS)'); }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    CarraraFiere
                  </button>
                </div>
              </div>

              {/* RAGGIO DI VALIDITÀ DELLA TIMBRATURA (A DISCREZIONE DELL'OPERATORE) */}
              <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-950 to-amber-950/40 rounded-2xl border-2 border-amber-500/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      Raggio di Validità Timbratura (Ampiezza GPS)
                    </label>
                    <span className="text-[10px] text-slate-400 block">
                      A discrezione dell'operatore • Effetto immediato
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={5}
                      max={2000}
                      step={1}
                      required
                      value={formLuogoRaggioMetri}
                      onChange={(e) => setFormLuogoRaggioMetri(Math.max(5, parseInt(e.target.value) || 20))}
                      className="w-20 p-1.5 text-center bg-slate-900 border-2 border-amber-400 rounded-xl text-amber-300 font-mono font-black text-sm"
                    />
                    <span className="text-xs font-black text-amber-400">Metri</span>
                  </div>
                </div>

                {/* Slider per regolazione comoda */}
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={5}
                  value={formLuogoRaggioMetri}
                  onChange={(e) => setFormLuogoRaggioMetri(parseInt(e.target.value) || 20)}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                {/* Preset rapidi di ampiezza */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
                  <span className="text-slate-400 font-bold">Preset ampiezza:</span>
                  {[
                    { label: '20m (Sede Standard)', val: 20 },
                    { label: '35m (Edificio Esteso)', val: 35 },
                    { label: '50m (Piazzale Mezzi)', val: 50 },
                    { label: '100m (Presidio/Ospedale)', val: 100 },
                    { label: '250m (Fiera/Manifestazione)', val: 250 },
                    { label: '500m (Area Territoriale)', val: 500 }
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setFormLuogoRaggioMetri(p.val)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        formLuogoRaggioMetri === p.val
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-slate-400 italic">
                  I volontari potranno convalidare la timbratura d'ingresso e uscita solo se si trovano entro questo raggio geodesico calcolato dal loro smartphone.
                </p>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note Operative / Descrizione (Opzionale)</label>
                <textarea
                  rows={2}
                  value={formLuogoDescrizione}
                  onChange={(e) => setFormLuogoDescrizione(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Es. Postazione attiva per turni estivi o manifestazioni fieristiche"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleNuovoLuogoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{luogoInModifica ? 'Salva Modifiche Luogo' : 'Crea Luogo con Effetto Immediato'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALE STAMPA REGISTRO TIMBRATURE & PRESENZE (CRITERI DI PRIVACY RIGIDI) */}
      {/* ===================================================================== */}
      {modaleStampaRegistroAperta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          {/* CSS dedicato per la stampa su carta / PDF */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #registro-timbrature-stampa, #registro-timbrature-stampa * {
                visibility: visible !important;
              }
              #registro-timbrature-stampa {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 15mm 15mm !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Header modale (non stampabile) */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Anteprima di Stampa — Registro Timbrature Ufficiale
                  </h3>
                  <p className="text-xs text-slate-400">
                    Documento formattato per la stampa cartacea o salvataggio in PDF. Conforme al D.Lgs. 117/2017.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleEsportaReportExcel}
                  className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Excel (.xls)</span>
                </button>
                <button
                  type="button"
                  onClick={handleEsportaReportCSV}
                  className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Stampa Ora / Salva in PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModaleStampaRegistroAperta(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Chiudi"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Foglio stampabile */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-800/40">
              <div
                id="registro-timbrature-stampa"
                className="bg-white text-slate-900 p-8 rounded-2xl shadow-xl border border-slate-300 font-sans mx-auto max-w-4xl text-xs"
              >
                {/* Intestazione Ufficiale ODV */}
                <div className="border-b-2 border-slate-900 pb-4 mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center border-2 border-slate-900">
                        CO
                      </div>
                      <div>
                        <h1 className="text-base font-black uppercase tracking-wider text-slate-950">
                          Croce Oro Massa Carrara OdV
                        </h1>
                        <p className="text-[11px] font-semibold text-slate-700">
                          Organizzazione di Volontariato • Iscr. RUNTS • Settore Emergenza, Sanità & Protezione Civile
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Sede Legale: Via Como 12, Ronchi (Massa) • Sede Operativa: Via Delle Jare 9, Massa • Tel: 0585 625410
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-[10px] uppercase rounded">
                        Registro Ufficiale Presenze
                      </span>
                      <div className="text-[10px] text-slate-600 mt-1">
                        Emesso il: {formatDateItaly()} alle ore {formatTimeItaly(undefined, false)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Titolo e Riepilogo Filtri Applicati */}
                <div className="mb-4 bg-slate-100 p-3 rounded-lg border border-slate-200">
                  <h2 className="text-sm font-black text-slate-950 uppercase tracking-wide mb-1.5 text-center">
                    Foglio Registro Timbrature & Servizi Svolti
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] pt-1 border-t border-slate-300">
                    <div>
                      <span className="font-bold text-slate-600 block uppercase">Filtro Volontario:</span>
                      <span className="font-black text-slate-900">
                        {etichettaVolontarioFiltro}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600 block uppercase">Filtro Sede:</span>
                      <span className="font-black text-slate-900">
                        {filtroTimbSede === 'tutte' ? 'Tutte le Sedi Operative' : filtroTimbSede}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600 block uppercase">Periodo Ricerca:</span>
                      <span className="font-black text-slate-900">
                        {intervalloTemporaleTimbrature.etichettaPeriodo}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-600 block uppercase">Totale Ore Certificate:</span>
                      <span className="font-black text-amber-700 font-mono text-xs">
                        {totaleOreFiltrate.toFixed(1)} Ore ({timbratureFiltrate.length} turni)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabella Ufficiale Timbrature: NESSUNA INDICAZIONE SU MODIFICA ADMIN */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-400 text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-black uppercase text-[9.5px] border-b border-slate-400">
                        <th className="py-1.5 px-2 border-r border-slate-400 text-center w-8">N°</th>
                        <th className="py-1.5 px-2 border-r border-slate-400 w-20">Data</th>
                        <th className="py-1.5 px-2 border-r border-slate-400">Nominativo Volontario</th>
                        <th className="py-1.5 px-2 border-r border-slate-400">Qualifica</th>
                        <th className="py-1.5 px-2 border-r border-slate-400">Sede di Timbratura</th>
                        <th className="py-1.5 px-2 border-r border-slate-400">Attività Svolta (Cosa stai facendo)</th>
                        <th className="py-1.5 px-2 border-r border-slate-400 text-center w-14">Ingresso</th>
                        <th className="py-1.5 px-2 border-r border-slate-400 text-center w-14">Uscita</th>
                        <th className="py-1.5 px-2 border-r border-slate-400 text-center w-14">Ore Tot.</th>
                        <th className="py-1.5 px-2 text-center w-28">Firma Volontario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {timbratureFiltrate.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-slate-500 italic">
                            Nessuna timbratura registrata con i criteri di ricerca specificati.
                          </td>
                        </tr>
                      ) : (
                        timbratureFiltrate.map((t, idx) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold text-slate-700">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono font-semibold whitespace-nowrap">
                              {t.data}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-bold text-slate-950">
                              {t.volontarioNome}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-slate-700">
                              {t.qualifica || 'Volontario'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-slate-800">
                              <div>{t.sedeUscita && t.sedeUscita !== t.sede ? `Entrata: ${t.sede}` : t.sede}</div>
                              {t.sedeUscita && t.sedeUscita !== t.sede && (
                                <div className="text-[10px] text-amber-800 font-semibold">Uscita: {t.sedeUscita}</div>
                              )}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-slate-900 font-medium">
                              {t.attivitaSvolta || '—'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold text-slate-900">
                              {t.orarioIngresso}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold text-slate-900">
                              {t.orarioUscita || '—'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-black text-slate-950">
                              <div>{t.oreTotali !== undefined ? `${t.oreTotali}h` : '—'}</div>
                              {t.orarioUscita && (
                                <div className="text-[9px] font-normal text-slate-600">{formatDurataTimbratura(t)}</div>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-300 font-mono">
                              ......................
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-slate-950">
                        <td colSpan={8} className="py-2 px-3 text-right uppercase tracking-wider text-[10px]">
                          Totale Ore di Volontariato Certificate nel Periodo:
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-xs text-amber-800">
                          {totaleOreFiltrate.toFixed(1)}h
                        </td>
                        <td className="py-2 px-2 text-center text-[9px] text-slate-600">
                          {timbratureFiltrate.length} Servizi
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Clausola di Conformità Legale e Firme Ufficiali */}
                <div className="mt-6 pt-4 border-t border-slate-300 text-[10px] text-slate-600">
                  <p className="italic mb-6 leading-relaxed">
                    Si attesta la conformità delle registrazioni sopra riportate alle effettive prestazioni di servizio svolte dai volontari dell'Associazione, ai fini assicurativi e per gli adempimenti previsti dall'art. 17 e 18 del D.Lgs. 117/2017 (Codice del Terzo Settore).
                  </p>
                  <div className="grid grid-cols-2 gap-12 pt-4">
                    <div className="text-center border-t border-dotted border-slate-500 pt-1">
                      <div className="font-bold uppercase text-slate-800">Il Responsabile Gestione Turni & Personale</div>
                      <div className="text-[9px] text-slate-500">Croce Oro Massa Carrara OdV</div>
                    </div>
                    <div className="text-center border-t border-dotted border-slate-500 pt-1">
                      <div className="font-bold uppercase text-slate-800">Il Presidente del Consiglio Direttivo</div>
                      <div className="text-[9px] text-slate-500">Firma e Timbro dell'Associazione</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. SOTTO-TAB: GRUPPI VOLONTARI & ASSEGNAZIONE SEZIONI TERRITORIALI   */}
      {/* ===================================================================== */}
      {sottoTab === 'gruppi' && (() => {
        // Volontari filtrati per la vista Gruppi
        const volontariGruppiFiltrati = volontari.filter((v) => {
          const matchSezione =
            filtroGruppoSezione === 'tutte' ||
            v.sezioneAppartenenzaId === filtroGruppoSezione ||
            (v.sediTurniAbilitate && v.sediTurniAbilitate.includes(filtroGruppoSezione));

          const q = ricercaGruppi.toLowerCase().trim();
          const matchTesto =
            !q ||
            `${v.nome} ${v.cognome}`.toLowerCase().includes(q) ||
            (v.matricola && v.matricola.toLowerCase().includes(q)) ||
            (v.qualifica && v.qualifica.toLowerCase().includes(q)) ||
            (v.sezioneAppartenenzaNome && v.sezioneAppartenenzaNome.toLowerCase().includes(q));

          return matchSezione && matchTesto;
        });

        const toggleSelezioneTutti = () => {
          if (selectedVolontariGruppoIds.length === volontariGruppiFiltrati.length) {
            setSelectedVolontariGruppoIds([]);
          } else {
            setSelectedVolontariGruppoIds(volontariGruppiFiltrati.map(v => v.id));
          }
        };

        const toggleSelezioneSingolo = (id: string) => {
          setSelectedVolontariGruppoIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        };

        const toggleSezioneTarget = (sezId: string) => {
          setSezioniTargetGruppo(prev =>
            prev.includes(sezId) ? prev.filter(x => x !== sezId) : [...prev, sezId]
          );
        };

        // Assegna / aggiunge sezioni ai volontari selezionati
        const applicaAssegnazioneSezioni = (modalita: 'aggiungi' | 'sostituisci' | 'rimuovi' | 'tutte') => {
          if (selectedVolontariGruppoIds.length === 0) {
            mostraAvviso('Seleziona almeno un volontario dalla lista prima di applicare le sezioni!');
            return;
          }

          if (modalita !== 'tutte' && sezioniTargetGruppo.length === 0) {
            mostraAvviso('Spunta almeno una sezione territoriale da assegnare!');
            return;
          }

          const targetIds = new Set(selectedVolontariGruppoIds);
          const aggiornati = volontari.map((v) => {
            if (!targetIds.has(v.id)) return v;

            let nuoveSedi: string[] = Array.isArray(v.sediTurniAbilitate) ? [...v.sediTurniAbilitate] : [];

            if (modalita === 'aggiungi') {
              sezioniTargetGruppo.forEach(s => {
                if (!nuoveSedi.includes(s)) nuoveSedi.push(s);
              });
            } else if (modalita === 'sostituisci') {
              nuoveSedi = [...sezioniTargetGruppo];
            } else if (modalita === 'rimuovi') {
              nuoveSedi = nuoveSedi.filter(s => !sezioniTargetGruppo.includes(s));
            } else if (modalita === 'tutte') {
              nuoveSedi = SEDI_TURNI_DISPONIBILI.map(s => s.id);
            }

            // Aggiornamento eventuale della sezione di appartenenza principale
            let nuovaSezioneId = v.sezioneAppartenenzaId;
            let nuovaSezioneNome = v.sezioneAppartenenzaNome;
            if (sezioneAppartenenzaTarget && sezioneAppartenenzaTarget !== 'mantieni') {
              nuovaSezioneId = sezioneAppartenenzaTarget;
              const matchInfo = SEDI_TURNI_DISPONIBILI.find(s => s.id === sezioneAppartenenzaTarget);
              nuovaSezioneNome = matchInfo?.nome;
              // Assicura che la sezione principale sia inclusa tra quelle abilitate
              if (!nuoveSedi.includes(sezioneAppartenenzaTarget)) {
                nuoveSedi.push(sezioneAppartenenzaTarget);
              }
            }

            return {
              ...v,
              sediTurniAbilitate: nuoveSedi,
              sezioneAppartenenzaId: nuovaSezioneId || 'sede-massa-ronchi',
              sezioneAppartenenzaNome: nuovaSezioneNome || 'Sede Legale & Direzione Generale Massa (Ronchi)'
            };
          });

          onAggiornaVolontari(aggiornati);
          const descrAzione =
            modalita === 'aggiungi'
              ? `Aggiunte ${sezioniTargetGruppo.length} sezioni`
              : modalita === 'sostituisci'
              ? `Assegnate esattamente ${sezioniTargetGruppo.length} sezioni`
              : modalita === 'rimuovi'
              ? `Rimosse ${sezioniTargetGruppo.length} sezioni`
              : 'Abilitate tutte le sezioni';

          onNotificaRadio?.(
            `👥 GRUPPI VOLONTARI: ${descrAzione} a ${selectedVolontariGruppoIds.length} volontari da ${operatoreCorrente}`,
            'sistema'
          );
          mostraAvviso(`${descrAzione} applicata a ${selectedVolontariGruppoIds.length} volontari con successo!`);
        };

        // Modifica rapida singola pill sezione per singolo volontario
        const toggleSingolaSezioneVolontario = (vol: Volontario, sezId: string) => {
          const sediAttuali = Array.isArray(vol.sediTurniAbilitate) ? [...vol.sediTurniAbilitate] : [];
          let nuoveSedi: string[];
          if (sediAttuali.includes(sezId)) {
            nuoveSedi = sediAttuali.filter(s => s !== sezId);
          } else {
            nuoveSedi = [...sediAttuali, sezId];
          }

          const aggiornati = volontari.map(v => v.id === vol.id ? { ...v, sediTurniAbilitate: nuoveSedi } : v);
          onAggiornaVolontari(aggiornati);
          mostraAvviso(`Autorizzazione tabellone turni aggiornata per ${vol.nome} ${vol.cognome}.`);
        };

        // Modifica rapida sezione principale di appartenenza per singolo volontario
        const cambiaSezioneAppartenenzaSingola = (vol: Volontario, sezId: string) => {
          const sezInfo = SEDI_TURNI_DISPONIBILI.find(s => s.id === sezId);
          const sediAttuali = Array.isArray(vol.sediTurniAbilitate) ? [...vol.sediTurniAbilitate] : [];
          if (!sediAttuali.includes(sezId)) {
            sediAttuali.push(sezId);
          }

          const aggiornati = volontari.map(v =>
            v.id === vol.id
              ? {
                  ...v,
                  sezioneAppartenenzaId: sezId,
                  sezioneAppartenenzaNome: sezInfo?.nome || 'Sede Associativa',
                  sediTurniAbilitate: sediAttuali
                }
              : v
          );
          onAggiornaVolontari(aggiornati);
          mostraAvviso(`Sezione di appartenenza di ${vol.nome} ${vol.cognome} impostata su: ${sezInfo?.nome}.`);
        };

        return (
          <div className="space-y-4 animate-in fade-in">
            {/* Banner Informativo costituzionale GRUPPI VOLONTARI */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-2 border-blue-500/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black text-2xl border border-blue-500/40 shrink-0">
                  <Building2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                    GRUPPI VOLONTARI • Assegnazione Sezioni Territoriali
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-0.5">
                    Assegna uno o più volontari simultaneamente alle sezioni territoriali dell'associazione.
                    <strong> Ogni volontario visualizzerà solo ed esclusivamente i tabelloni turni delle sezioni a cui viene assegnato.</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-blue-900/60 text-blue-200 border border-blue-500/40">
                  {selectedVolontariGruppoIds.length} Selezionati su {volontari.length}
                </span>
              </div>
            </div>

            {/* Pannello Operativo di Assegnazione Massiva (Batch Toolbar) */}
            <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 flex-wrap gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Pannello Operativo Assegnazione Massiva ({selectedVolontariGruppoIds.length} volontari selezionati)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelezioneTutti}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                  >
                    {selectedVolontariGruppoIds.length === volontariGruppiFiltrati.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
                  </button>
                  {selectedVolontariGruppoIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedVolontariGruppoIds([])}
                      className="px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-bold border border-red-500/30 transition-colors cursor-pointer"
                    >
                      Azzera Selezione
                    </button>
                  )}
                </div>
              </div>

              {/* Selezione Sezioni Territoriali Target da Assegnare */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  1. Seleziona le Sezioni Territoriali da Assegnare ai Volontari Spuntati:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {SEDI_TURNI_DISPONIBILI.map((s) => {
                    const isAttiva = sezioniTargetGruppo.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSezioneTarget(s.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isAttiva
                            ? 'bg-blue-600/30 border-blue-400 text-white shadow-md ring-1 ring-blue-400'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{s.icona}</span>
                          <div className="min-w-0">
                            <span className="font-bold text-xs block text-white truncate leading-tight">{s.nome}</span>
                            <span className="text-[9.5px] font-mono text-slate-400 block">{s.codice}</span>
                          </div>
                        </div>
                        <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ml-2 ${
                          isAttiva ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-700 bg-slate-900'
                        }`}>
                          {isAttiva && <Check className="w-3 h-3 text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Imposta eventuale Sezione di Appartenenza Principale */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    2. Sezione di Appartenenza Principale dell'Associazione (Opzionale):
                  </label>
                  <select
                    value={sezioneAppartenenzaTarget}
                    onChange={(e) => setSezioneAppartenenzaTarget(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-semibold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="mantieni">-- Mantieni l'attuale sezione di appartenenza di ciascuno --</option>
                    {SEDI_TURNI_DISPONIBILI.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icona} Imposta Sezione Principale: {s.nome} ({s.codice})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pulsanti di Azione Multipla */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => applicaAssegnazioneSezioni('aggiungi')}
                    disabled={selectedVolontariGruppoIds.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Aggiungi Sezioni Spuntate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applicaAssegnazioneSezioni('sostituisci')}
                    disabled={selectedVolontariGruppoIds.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sostituisci Esattamente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applicaAssegnazioneSezioni('tutte')}
                    disabled={selectedVolontariGruppoIds.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Abilita Tutte le Sezioni</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applicaAssegnazioneSezioni('rimuovi')}
                    disabled={selectedVolontariGruppoIds.length === 0}
                    className="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 disabled:opacity-50 text-red-200 border border-red-800/80 font-bold text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Rimuovi</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filtri & Ricerca per la Tabella Gruppi */}
            <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Filtra per Sezione:</span>
                <select
                  value={filtroGruppoSezione}
                  onChange={(e) => setFiltroGruppoSezione(e.target.value)}
                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="tutte">Tutte le Sezioni dell'Associazione</option>
                  {SEDI_TURNI_DISPONIBILI.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icona} {s.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={ricercaGruppi}
                  onChange={(e) => setRicercaGruppi(e.target.value)}
                  placeholder="Cerca volontario, matricola, qualifica..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Tabella di Assegnazione Volontari / Sezioni */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedVolontariGruppoIds.length === volontariGruppiFiltrati.length && volontariGruppiFiltrati.length > 0}
                          onChange={toggleSelezioneTutti}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">Volontario / Operatore</th>
                      <th className="py-3 px-3">Sezione Appartenenza Principale</th>
                      <th className="py-3 px-3">Sezioni Abilitate per Visualizzare Tabellone Turni</th>
                      <th className="py-3 px-3 text-center">Stato Tabellone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {volontariGruppiFiltrati.map((v) => {
                      const isSelected = selectedVolontariGruppoIds.includes(v.id);
                      const sediAbilitate = Array.isArray(v.sediTurniAbilitate) ? v.sediTurniAbilitate : [];
                      const sezAppId = v.sezioneAppartenenzaId || 'sede-massa-ronchi';

                      return (
                        <tr
                          key={v.id}
                          className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-blue-950/20' : ''}`}
                        >
                          {/* Checkbox di Selezione */}
                          <td className="py-3.5 px-3 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelezioneSingolo(v.id)}
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                          </td>

                          {/* Dati Volontario */}
                          <td className="py-3.5 px-3 align-middle">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                {v.fotoBase64 ? (
                                  <img src={v.fotoBase64} alt={v.nome} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-mono font-bold text-xs text-amber-400">
                                    {v.nome[0]}{v.cognome[0]}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                                  <span>{v.nome} {v.cognome}</span>
                                  {v.profiloCentrale && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-black uppercase">
                                      Centrale
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                  <span>Matr: {v.matricola || 'N/D'}</span>
                                  <span>•</span>
                                  <span>{v.qualifica}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Sezione Appartenenza Principale */}
                          <td className="py-3.5 px-3 align-middle min-w-[200px]">
                            <select
                              value={sezAppId}
                              onChange={(e) => cambiaSezioneAppartenenzaSingola(v, e.target.value)}
                              className="w-full text-[11px] font-bold p-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 focus:outline-none"
                              title="Sezione di appartenenza dell'associazione per questo account"
                            >
                              {SEDI_TURNI_DISPONIBILI.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.icona} {s.codice} — {s.nome.split('(')[0]}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Sezioni Abilitate per Tabellone Turni (Pills Interattive) */}
                          <td className="py-3.5 px-3 align-middle">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {SEDI_TURNI_DISPONIBILI.map((s) => {
                                const abilitata = sediAbilitate.includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => toggleSingolaSezioneVolontario(v, s.id)}
                                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                      abilitata
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                                        : 'bg-slate-950/60 text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-700'
                                    }`}
                                    title={`Clicca per abilitare/disabilitare la visualizzazione del tabellone turni della sede: ${s.nome}`}
                                  >
                                    <span>{s.icona}</span>
                                    <span>{s.codice.replace('SEDE-', '')}</span>
                                    {abilitata ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <span className="text-[9px] text-slate-600">✕</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Stato Tabellone */}
                          <td className="py-3.5 px-3 align-middle text-center">
                            {sediAbilitate.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-bold">
                                {sediAbilitate.length} {sediAbilitate.length === 1 ? 'Sezione' : 'Sezioni'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-mono text-[10px] font-bold">
                                Nessuna
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          7. SEZIONE MANSIONI & COMPETENZE (CATALOGO & ASSEGNAZIONE MULTIPLA)
         ======================================================== */}
      {sottoTab === 'mansioni' && (() => {
        // Volontari filtrati per ricerca locale mansioni
        const volontariFiltratiMansioni = volontari.filter((v) => {
          if (!ricercaMansioniVolontari.trim()) return true;
          const query = ricercaMansioniVolontari.toLowerCase();
          const nomeCompleto = `${v.nome} ${v.cognome}`.toLowerCase();
          const matricola = (v.matricola || '').toLowerCase();
          const mansioni = getMansioniVolontario(v).join(' ').toLowerCase();
          return nomeCompleto.includes(query) || matricola.includes(query) || mansioni.includes(query);
        });

        // Catalogo filtrato per categoria
        const mansioniFiltrateCatalogo = catalogoMansioni.filter((m) => {
          if (filtroCategoriaMansione === 'tutte') return true;
          return m.categoria === filtroCategoriaMansione;
        });

        // Categorie disponibili dinamiche (modificabili dall'utente con genitorialità)
        const categorieDisponibili: { key: string; label: string }[] = [
          { key: 'tutte', label: 'Tutte le Categorie' },
          ...categorieMansioni.map((c) => ({
            key: c.nome,
            label: `${formatIconaPerTesto(c.badgeEmoji, '📁') ? `${formatIconaPerTesto(c.badgeEmoji, '📁')} ` : ''}${c.nome}`
          }))
        ];

        return (
          <div className="space-y-6">
            {/* Banner Superiore */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/60 border border-blue-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  🎖️
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2 flex-wrap">
                    <span>7. Gestione Mansioni, Categorie & Competenze</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-mono">
                      {catalogoMansioni.length} Mansioni • {categorieMansioni.length} Categorie
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Crea e modifica mansioni, categorie e relazioni gerarchiche (genitorialità). Ogni modifica diventa efficace subito su tutti i dispositivi.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleRipristinaMansioniDefault}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-md"
                  title="Ripristina il catalogo standard delle mansioni predefinite della Croce Oro"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ripristina Predefinite</span>
                </button>
                <button
                  type="button"
                  onClick={handleApriCreaCategoria}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-black text-xs uppercase flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Nuova Categoria</span>
                </button>
                <button
                  type="button"
                  onClick={handleApriCreaMansione}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-blue-900/30 active:scale-95 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Crea Nuova Mansione</span>
                </button>
              </div>
            </div>

            {/* SEZIONE 0: GESTIONE CATEGORIE & GENITORIALITÀ */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Categorie Mansioni & Genitorialità ({categorieMansioni.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Modifica, aggiungi o elimina categorie e imposta la categoria genitore. Le modifiche sono sincronizzate istantaneamente su tutti i dispositivi.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRipristinaCategorieDefault}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Ripristina Categorie</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApriCreaCategoria}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Aggiungi Categoria</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {categorieMansioni.map((cat) => {
                  const parentCat = cat.parentCategoriaId
                    ? categorieMansioni.find((p) => p.id === cat.parentCategoriaId)
                    : undefined;
                  const mansioniInCat = catalogoMansioni.filter((m) => m.categoria === cat.nome).length;
                  return (
                    <div
                      key={cat.id}
                      className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg shrink-0 inline-flex items-center justify-center"><IconaEmoji value={cat.badgeEmoji} fallback="📁" /></span>
                          <span className="font-bold text-white text-xs truncate">{cat.nome}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{mansioniInCat} mansioni</span>
                          {parentCat && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 font-semibold">
                              Genitore: {parentCat.nome}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApriModificaCategoria(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 cursor-pointer"
                          title="Modifica nome, emoji e genitorialità categoria"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {categorieMansioni.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEliminaCategoria(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 cursor-pointer"
                            title="Elimina categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEZIONE A: CATALOGO MANSIONI */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-blue-400" />
                    <span>Catalogo Mansioni Operative ({mansioniFiltrateCatalogo.length})</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Mansioni disponibili per l'assegnazione nei turni, nei fascicoli personali e nelle schede operative.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={filtroCategoriaMansione}
                    onChange={(e) => setFiltroCategoriaMansione(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {categorieDisponibili.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Griglia Card Mansioni */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {mansioniFiltrateCatalogo.map((m) => {
                  // Conta quanti volontari hanno questa mansione
                  const volontariConMansione = volontari.filter(v => getMansioniVolontario(v).includes(m.nome));
                  const mansioneGenitore = m.parentMansioneId
                    ? catalogoMansioni.find((p) => p.id === m.parentMansioneId)
                    : undefined;

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-md group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-2xl p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 inline-flex items-center justify-center w-10 h-10">
                              <IconaEmoji value={m.badgeEmoji} fallback="🏷️" />
                            </span>
                            <div className="min-w-0">
                              <h5 className="font-bold text-white text-xs truncate leading-snug" title={m.nome}>
                                {m.nome}
                              </h5>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {m.categoria}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApriModificaMansione(m)}
                              className="text-slate-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-950/40 transition-colors cursor-pointer"
                              title="Modifica mansione (nome, categoria, genitorialità, emoji, requisiti)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminaMansione(m.id, m.nome)}
                              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Elimina mansione dal catalogo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {mansioneGenitore && (
                          <div className="mt-2">
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 font-semibold inline-block">
                              Genitore: {mansioneGenitore.nome}
                            </span>
                          </div>
                        )}

                        {m.descrizione && (
                          <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                            {m.descrizione}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.coloreBg} ${m.coloreTesto} ${m.coloreBorder}`}>
                          Badge Anteprima
                        </span>
                        <span className="text-slate-400 font-mono flex items-center gap-1 font-semibold">
                          <Users className="w-3 h-3 text-blue-400" />
                          <span>{volontariConMansione.length} {volontariConMansione.length === 1 ? 'volontario' : 'volontari'}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEZIONE B: ASSEGNAZIONE CONTEMPORANEA MULTIPLA & MASSIVA */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              <div className="border-b border-slate-800 pb-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Assegnazione Multipla & Contemporanea Mansioni</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Seleziona uno o più volontari, scegli le mansioni da assegnare contemporaneamente e applica l'azione con un clic.
                </p>
              </div>

              {/* Riquadro Azioni Massive */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                {/* Step 1: Mansioni Selezionate da Assegnare */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                      <span>Seleziona le Mansioni da Assegnare Contemporaneamente:</span>
                    </label>
                    {selectedMansioniNomi.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMansioniNomi([])}
                        className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                      >
                        Deseleziona Mansioni ({selectedMansioniNomi.length})
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                    {catalogoMansioni.map((m) => {
                      const isSel = selectedMansioniNomi.includes(m.nome);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMansioneSelezionataPerAzione(m.nome)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-1 ring-blue-300'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <IconaEmoji value={m.badgeEmoji} fallback="🏷️" />
                          <span>{m.nome}</span>
                          {isSel ? (
                            <Check className="w-3.5 h-3.5 text-white ml-0.5" />
                          ) : (
                            <span className="text-[10px] text-slate-500 ml-0.5">+</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Bottoni Azione */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-900">
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                    <span>
                      Applicazione a <strong>{selectedVolontariMansioniIds.length}</strong> volontari selezionati con <strong>{selectedMansioniNomi.length}</strong> mansioni scelte:
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={selectedVolontariMansioniIds.length === 0 || selectedMansioniNomi.length === 0}
                      onClick={() => handleAssegnaMansioniMassive('aggiungi')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md ${
                        selectedVolontariMansioniIds.length > 0 && selectedMansioniNomi.length > 0
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                      title="Aggiungi queste mansioni mantenendo quelle già possedute"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Aggiungi Mansioni (+)</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedVolontariMansioniIds.length === 0 || selectedMansioniNomi.length === 0}
                      onClick={() => handleAssegnaMansioniMassive('sostituisci')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md ${
                        selectedVolontariMansioniIds.length > 0 && selectedMansioniNomi.length > 0
                          ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                      title="Sostituisci esattamente: imposta solo queste mansioni per i volontari selezionati"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sostituisci Esattamente (=)</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedVolontariMansioniIds.length === 0 || selectedMansioniNomi.length === 0}
                      onClick={() => handleAssegnaMansioniMassive('rimuovi')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md ${
                        selectedVolontariMansioniIds.length > 0 && selectedMansioniNomi.length > 0
                          ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                      title="Rimuovi le mansioni selezionate dai volontari selezionati"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Rimuovi Mansioni (-)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Tabella Volontari con selezione e mansioni possedute */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selezionaTuttiVolontariMansioni}
                      className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      {selectedVolontariMansioniIds.length === volontariFiltratiMansioni.length && volontariFiltratiMansioni.length > 0 ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                          <span>Deseleziona Tutti ({selectedVolontariMansioniIds.length})</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                          <span>Seleziona Tutti ({volontariFiltratiMansioni.length})</span>
                        </>
                      )}
                    </button>
                    {selectedVolontariMansioniIds.length > 0 && (
                      <span className="text-xs text-blue-300 font-bold">
                        {selectedVolontariMansioniIds.length} volontari selezionati
                      </span>
                    )}
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={ricercaMansioniVolontari}
                      onChange={(e) => setRicercaMansioniVolontari(e.target.value)}
                      placeholder="Cerca volontario, matricola o mansione..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/90 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">
                          <th className="py-3 px-3 w-10 text-center">Sel.</th>
                          <th className="py-3 px-4">Volontario / Matricola</th>
                          <th className="py-3 px-4">Mansione Principale</th>
                          <th className="py-3 px-4">Tutte le Mansioni Assegnate Contemporaneamente</th>
                          <th className="py-3 px-4 text-right">Azioni Rapide</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {volontariFiltratiMansioni.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                              Nessun volontario trovato con i filtri correnti.
                            </td>
                          </tr>
                        ) : (
                          volontariFiltratiMansioni.map((v) => {
                            const isSelected = selectedVolontariMansioniIds.includes(v.id);
                            const mansioni = getMansioniVolontario(v);
                            const mansionePrinc = getMansionePrincipale(v);
                            const stilePrinc = getStileMansione(mansionePrinc, catalogoMansioni);

                            return (
                              <tr
                                key={v.id}
                                className={`hover:bg-slate-900/50 transition-colors ${
                                  isSelected ? 'bg-blue-950/25' : ''
                                }`}
                              >
                                <td className="py-3 px-3 text-center align-middle">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleVolontarioMansione(v.id)}
                                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                                  />
                                </td>
                                <td className="py-3 px-4 align-middle">
                                  <div className="font-bold text-white text-xs">
                                    {v.nome} {v.cognome}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Matricola: {v.matricola || 'N/D'}
                                  </div>
                                </td>
                                <td className="py-3 px-4 align-middle">
                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 shadow-sm ${stilePrinc.coloreBg} ${stilePrinc.coloreTesto} ${stilePrinc.coloreBorder}`}>
                                    <IconaEmoji value={stilePrinc.badgeEmoji} fallback="🏷️" />
                                    <span>{mansionePrinc}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-4 align-middle">
                                  <div className="flex flex-wrap gap-1">
                                    {mansioni.map((mNome, idx) => {
                                      const stile = getStileMansione(mNome, catalogoMansioni);
                                      const isPrinc = mNome === mansionePrinc;
                                      return (
                                        <span
                                          key={idx}
                                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${
                                            isPrinc
                                              ? `${stile.coloreBg} ${stile.coloreTesto} ${stile.coloreBorder}`
                                              : 'bg-slate-900 text-slate-300 border-slate-700'
                                          }`}
                                          title={isPrinc ? 'Mansione Principale' : 'Mansione Secondaria'}
                                        >
                                          <IconaEmoji value={stile.badgeEmoji} fallback="🏷️" />
                                          <span>{mNome}</span>
                                          {isPrinc && <span className="text-[8px] opacity-75">★</span>}
                                        </span>
                                      );
                                    })}
                                    {(() => {
                                      const effettive = getMansioniEffettiveVolontario(v, catalogoMansioni);
                                      const ereditate = effettive.filter((m) => !mansioni.includes(m));
                                      if (ereditate.length === 0) return null;
                                      return (
                                        <span
                                          className="px-1.5 py-0.5 rounded-lg text-[9.5px] font-bold bg-amber-950/60 text-amber-300 border border-amber-600/40 inline-flex items-center gap-1"
                                          title={`Mansioni incluse ed ereditate gerarchicamente: ${ereditate.join(', ')}`}
                                        >
                                          <span>🔗</span>
                                          <span>+{ereditate.length} gerarchiche</span>
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right align-middle">
                                  <button
                                    type="button"
                                    onClick={() => apriFascicoloVolontarioDiretto(v)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Apri fascicolo volontario completo per modificare le mansioni e tutti i dati"
                                  >
                                    <Edit2 className="w-3 h-3 text-blue-400" />
                                    <span>Fascicolo</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* 8. SOTTO-TAB: ACCESSO AI DATABASE & SOTTOSEZIONI (SINGOLO / MULTIPLO)  */}
      {/* ===================================================================== */}
      {canShowSubtab('permessi_database') && sottoTab === 'permessi_database' && (() => {
        const volontariPermessiFiltrati = volontari.filter((v) => {
          const matchSezione =
            filtroSezionePermessi === 'tutte' ||
            v.sezioneAppartenenzaId === filtroSezionePermessi ||
            (v.sediTurniAbilitate && v.sediTurniAbilitate.includes(filtroSezionePermessi));

          const q = ricercaPermessiVolontari.toLowerCase().trim();
          const matchTesto =
            !q ||
            `${v.nome} ${v.cognome}`.toLowerCase().includes(q) ||
            (v.matricola && v.matricola.toLowerCase().includes(q)) ||
            (v.qualifica && v.qualifica.toLowerCase().includes(q));

          return matchSezione && matchTesto;
        });

        const toggleSelezioneVolPermessi = (id: string) => {
          setSelectedVolontariPermessiIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          );
        };

        const toggleSelezionaTuttiPermessi = () => {
          const visibleIds = volontariPermessiFiltrati.map((v) => v.id);
          const allVisibleSelected =
            visibleIds.length > 0 && visibleIds.every((id) => selectedVolontariPermessiIds.includes(id));
          if (allVisibleSelected) {
            setSelectedVolontariPermessiIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
          } else {
            setSelectedVolontariPermessiIds(Array.from(new Set([...selectedVolontariPermessiIds, ...visibleIds])));
          }
        };

        const toggleCategoriaPermesso = (catId: MacroCategoriaId) => {
          const isCurrentlySelected = selectedCategoriePermessi.includes(catId);
          const subsDelegabili = getSottosezioniDelegabili(catId).map((s) => s.id);
          if (isCurrentlySelected) {
            setSelectedCategoriePermessi((prev) => prev.filter((id) => id !== catId));
            setSelectedSubPermessi((prev) => {
              const copy = { ...prev };
              delete copy[catId];
              return copy;
            });
          } else {
            setSelectedCategoriePermessi((prev) => [...prev, catId]);
            setSelectedSubPermessi((prev) => ({
              ...prev,
              [catId]: prev[catId] && prev[catId].length > 0 ? prev[catId] : subsDelegabili,
            }));
          }
        };

        const toggleSubPermessoNelPannello = (catId: MacroCategoriaId, subId: string) => {
          const allSubs = getSottosezioniDelegabili(catId).map((s) => s.id);
          const current = selectedSubPermessi[catId] ?? (selectedCategoriePermessi.includes(catId) ? allSubs : []);
          const next = current.includes(subId)
            ? current.filter((id) => id !== subId)
            : [...current, subId];

          setSelectedSubPermessi((prev) => ({
            ...prev,
            [catId]: next,
          }));
          if (next.length > 0) {
            setSelectedCategoriePermessi((prev) => (prev.includes(catId) ? prev : [...prev, catId]));
          } else {
            setSelectedCategoriePermessi((prev) => prev.filter((id) => id !== catId));
          }
        };

        const impostaTutteSubNelPannello = (catId: MacroCategoriaId, abilitaTutte: boolean) => {
          if (abilitaTutte) {
            const allSubs = getSottosezioniDelegabili(catId).map((s) => s.id);
            setSelectedSubPermessi((prev) => ({ ...prev, [catId]: allSubs }));
            setSelectedCategoriePermessi((prev) => (prev.includes(catId) ? prev : [...prev, catId]));
          } else {
            setSelectedSubPermessi((prev) => {
              const copy = { ...prev };
              delete copy[catId];
              return copy;
            });
            setSelectedCategoriePermessi((prev) => prev.filter((id) => id !== catId));
          }
        };

        const applicaPermessiDatabaseMassivi = (modalita: 'aggiungi' | 'sostituisci' | 'rimuovi' | 'revoca_tutti') => {
          if (selectedVolontariPermessiIds.length === 0) {
            mostraAvviso('Seleziona almeno un volontario/account dalla lista prima di applicare le autorizzazioni!');
            return;
          }
          if ((modalita === 'aggiungi' || modalita === 'rimuovi') && selectedCategoriePermessi.length === 0) {
            mostraAvviso('Seleziona almeno un database / sottosezione da applicare!');
            return;
          }

          const targetSet = new Set(selectedVolontariPermessiIds);
          const aggiornati = volontari.map((v) => {
            if (!targetSet.has(v.id)) return v;
            const attuali: MacroCategoriaId[] = Array.isArray(v.macroCategorieAbilitate)
              ? [...(v.macroCategorieAbilitate as MacroCategoriaId[])]
              : [];
            const prevSubsMap: Record<string, string[]> =
              v.sottosezioniAbilitate && typeof v.sottosezioniAbilitate === 'object'
                ? { ...v.sottosezioniAbilitate }
                : {};

            let nuovi: MacroCategoriaId[] = [...attuali];
            const nextSubsMap: Record<string, string[]> = { ...prevSubsMap };

            if (modalita === 'aggiungi') {
              selectedCategoriePermessi.forEach((cat) => {
                const allDeleg = getSottosezioniDelegabili(cat).map((s) => s.id);
                const chosenSubs = selectedSubPermessi[cat] && selectedSubPermessi[cat].length > 0
                  ? selectedSubPermessi[cat]
                  : allDeleg;
                const allSelectedForCat = chosenSubs.length >= allDeleg.length;
                const hadDb = nuovi.includes(cat);
                if (!hadDb) nuovi.push(cat);

                if (hadDb && nextSubsMap[cat] === undefined) {
                  // Aveva già accesso completo: mantienilo completo
                } else if (!allSelectedForCat) {
                  const base = Array.isArray(nextSubsMap[cat]) ? nextSubsMap[cat] : [];
                  nextSubsMap[cat] = Array.from(new Set([...base, ...chosenSubs]));
                } else {
                  delete nextSubsMap[cat];
                }
              });
            } else if (modalita === 'sostituisci') {
              nuovi = [...selectedCategoriePermessi];
              Object.keys(nextSubsMap).forEach((k) => {
                if (!nuovi.includes(k as MacroCategoriaId)) {
                  delete nextSubsMap[k];
                }
              });
              selectedCategoriePermessi.forEach((cat) => {
                const allDeleg = getSottosezioniDelegabili(cat).map((s) => s.id);
                const chosenSubs = selectedSubPermessi[cat] && selectedSubPermessi[cat].length > 0
                  ? selectedSubPermessi[cat]
                  : allDeleg;
                if (chosenSubs.length >= allDeleg.length) {
                  delete nextSubsMap[cat];
                } else {
                  nextSubsMap[cat] = [...chosenSubs];
                }
              });
            } else if (modalita === 'rimuovi') {
              selectedCategoriePermessi.forEach((cat) => {
                const allDeleg = getSottosezioniDelegabili(cat).map((s) => s.id);
                const chosenSubs = selectedSubPermessi[cat] && selectedSubPermessi[cat].length > 0
                  ? selectedSubPermessi[cat]
                  : allDeleg;
                if (chosenSubs.length >= allDeleg.length) {
                  nuovi = nuovi.filter((c) => c !== cat);
                  delete nextSubsMap[cat];
                } else {
                  const currentAccountSubs = Array.isArray(nextSubsMap[cat]) ? nextSubsMap[cat] : allDeleg;
                  const rimaste = currentAccountSubs.filter((id) => !chosenSubs.includes(id));
                  if (rimaste.length === 0) {
                    nuovi = nuovi.filter((c) => c !== cat);
                    delete nextSubsMap[cat];
                  } else {
                    nextSubsMap[cat] = rimaste;
                  }
                }
              });
            } else if (modalita === 'revoca_tutti') {
              nuovi = [];
              Object.keys(nextSubsMap).forEach((k) => delete nextSubsMap[k]);
            }

            return {
              ...v,
              macroCategorieAbilitate: nuovi,
              sottosezioniAbilitate: nextSubsMap,
            };
          });

          onAggiornaVolontari(aggiornati);
          const descr =
            modalita === 'aggiungi'
              ? `Aggiunte autorizzazioni (${selectedCategoriePermessi.length} database e relative sottosezioni)`
              : modalita === 'sostituisci'
              ? `Impostate esattamente ${selectedCategoriePermessi.length} autorizzazioni database & sottosezioni`
              : modalita === 'rimuovi'
              ? `Rimosse autorizzazioni selezionate (${selectedCategoriePermessi.length} database/sottosezioni)`
              : 'Revocati tutti gli accessi ai database e sottosezioni';

          onNotificaRadio?.(
            `🔐 AUTORIZZAZIONI DATABASE: ${descr} per ${selectedVolontariPermessiIds.length} account da ${operatoreCorrente}`,
            'sistema'
          );
          mostraAvviso(`${descr} per ${selectedVolontariPermessiIds.length} account!`);
        };

        const toggleSingoloDbAccount = (vol: Volontario, catId: MacroCategoriaId) => {
          const attuali: MacroCategoriaId[] = Array.isArray(vol.macroCategorieAbilitate)
            ? [...(vol.macroCategorieAbilitate as MacroCategoriaId[])]
            : [];
          const rimuovi = attuali.includes(catId);
          const nuovi = rimuovi
            ? attuali.filter((c) => c !== catId)
            : [...attuali, catId];
          const nextSubs: Record<string, string[]> = vol.sottosezioniAbilitate
            ? { ...vol.sottosezioniAbilitate }
            : {};
          // Sia in revoca sia in riattivazione completa del DB rimuove eventuali restrizioni parziali pregresse su quel DB
          delete nextSubs[catId];

          const aggiornati = volontari.map((v) =>
            v.id === vol.id
              ? {
                  ...v,
                  macroCategorieAbilitate: nuovi,
                  sottosezioniAbilitate: nextSubs,
                }
              : v
          );
          onAggiornaVolontari(aggiornati);
          const infoCat = LISTA_MACRO_CATEGORIE.find((c) => c.id === catId);
          const titoloDb = infoCat ? getTitoloDatabase(infoCat.id, infoCat.titolo, nomiDbCustom) : catId;
          mostraAvviso(
            `${nuovi.includes(catId) ? 'Abilitato' : 'Revocato'} accesso "${titoloDb}" per ${vol.nome} ${vol.cognome}.`
          );
        };

        const toggleSottosezioneSingoloAccount = (
          vol: Volontario,
          catId: MacroCategoriaId,
          subId: string
        ) => {
          const allDeleg = getSottosezioniDelegabili(catId).map((s) => s.id);
          const attualiDb: MacroCategoriaId[] = Array.isArray(vol.macroCategorieAbilitate)
            ? [...(vol.macroCategorieAbilitate as MacroCategoriaId[])]
            : [];
          const dbWasOn = attualiDb.includes(catId);
          const prevSubs: Record<string, string[]> = vol.sottosezioniAbilitate
            ? { ...vol.sottosezioniAbilitate }
            : {};
          const rawExistingSubs = Array.isArray(prevSubs[catId])
            ? prevSubs[catId].filter((id) => allDeleg.includes(id))
            : null;
          const currentSubs = dbWasOn
            ? (rawExistingSubs !== null ? rawExistingSubs : allDeleg)
            : (rawExistingSubs !== null ? rawExistingSubs : []);

          const nextSubsList = currentSubs.includes(subId)
            ? currentSubs.filter((id) => id !== subId)
            : [...currentSubs, subId];

          let nextDbList = [...attualiDb];
          if (nextSubsList.length === 0) {
            nextDbList = nextDbList.filter((c) => c !== catId);
            delete prevSubs[catId];
          } else {
            if (!nextDbList.includes(catId)) nextDbList.push(catId);
            if (nextSubsList.length >= allDeleg.length) {
              delete prevSubs[catId];
            } else {
              prevSubs[catId] = nextSubsList;
            }
          }

          const aggiornati = volontari.map((v) =>
            v.id === vol.id
              ? {
                  ...v,
                  macroCategorieAbilitate: nextDbList,
                  sottosezioniAbilitate: prevSubs,
                }
              : v
          );
          onAggiornaVolontari(aggiornati);
        };

        const togglePulsanteStrumentiAccount = (
          vol: Volontario,
          pulsanteId: PulsanteStrumentiId
        ) => {
          const attuali: PulsanteStrumentiId[] = Array.isArray(vol.pulsantiStrumentiAbilitati)
            ? [...vol.pulsantiStrumentiAbilitati]
            : [];
          const has = attuali.includes(pulsanteId);
          const nuovi = has
            ? attuali.filter((id) => id !== pulsanteId)
            : [...attuali, pulsanteId];
          const aggiornati = volontari.map((v) =>
            v.id === vol.id
              ? {
                  ...v,
                  pulsantiStrumentiAbilitati: nuovi,
                }
              : v
          );
          onAggiornaVolontari(aggiornati);
          const infoBtn = LISTA_PULSANTI_STRUMENTI_RISERVATI.find((b) => b.id === pulsanteId);
          mostraAvviso(
            `${nuovi.includes(pulsanteId) ? 'Abilitato' : 'Revocato'} pulsante "${infoBtn?.titolo || pulsanteId}" per ${vol.nome} ${vol.cognome}.`
          );
        };

        const accountInDettaglio = accountDettaglioPermessiId
          ? volontari.find((v) => v.id === accountDettaglioPermessiId) || null
          : null;

        return (
          <div className="space-y-4 animate-in fade-in">
            {/* Banner Informativo Autorizzazioni Singolo & Multi-Account */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-2 border-indigo-500/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/40 shrink-0">
                  <Shield className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                    8. Accesso ai Database & Singole Sottosezioni • Singolo o Multi-Account
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-0.5">
                    Concedi o revoca l&apos;accesso ad <strong>uno singolo account</strong> oppure a <strong>più account simultaneamente</strong>, scegliendo sia gli interi Database sia le <strong>singole sottosezioni</strong> al loro interno. I collegamenti e le funzioni continuano a funzionare anche dopo qualsiasi rinomina.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/notifica-compleanni', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ forzaInvio: true, volontari })
                      });
                      const data = await res.json();
                      if (data.festeggiati && data.festeggiati.length > 0) {
                        mostraAvviso(
                          `🎂 Email compleanni inviata a ${data.destinatari?.length || 0} destinatari (${data.destinatari?.join(', ')}) per: ${data.festeggiati.map((f: any) => f.nomeCompleto).join(', ')}.`
                        );
                      } else {
                        mostraAvviso(
                          `🎂 Nessun compleanno in data odierna. Destinatari configurati (Presidenza + DB Volontari): ${data.destinatari?.join(', ') || 'presidenza@croceoro.org'}`
                        );
                      }
                    } catch {
                      mostraAvviso('Errore durante la verifica/invio notifiche compleanni.');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-400/50 text-xs font-bold cursor-pointer transition-colors"
                  title="Verifica i compleanni di oggi e invia la notifica email a Presidenza e a tutti gli account con accesso al database Volontari"
                >
                  🎂 Verifica/Invia Compleanni Oggi
                </button>
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-indigo-900/70 text-indigo-100 border border-indigo-400/50">
                  {selectedVolontariPermessiIds.length} Account • {selectedCategoriePermessi.length} DB scelti
                </span>
              </div>
            </div>

            {/* Step 1 + Step 2: Scelta Autorizzazioni Database E Singole Sottosezioni */}
            <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                    Seleziona Database e/o Singole Sottosezioni ({selectedCategoriePermessi.length} DB scelti su {LISTA_MACRO_CATEGORIE.length})
                  </span>
                </div>

                {/* Preset rapidi */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoriePermessi([...TUTTE_LE_MACRO_CATEGORIE]);
                      const nextSubs: Record<string, string[]> = {};
                      TUTTE_LE_MACRO_CATEGORIE.forEach((db) => {
                        nextSubs[db] = getSottosezioniDelegabili(db).map((s) => s.id);
                      });
                      setSelectedSubPermessi(nextSubs);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[11px] font-bold cursor-pointer"
                  >
                    Tutte ({LISTA_MACRO_CATEGORIE.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoriePermessi([]);
                      setSelectedSubPermessi({});
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold cursor-pointer"
                  >
                    Nessuna
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoriePermessi(['turni']);
                      setSelectedSubPermessi({ turni: getSottosezioniDelegabili('turni').map((s) => s.id) });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-teal-600/25 hover:bg-teal-600/40 text-teal-200 border border-teal-500/40 text-[11px] font-bold cursor-pointer"
                  >
                    Solo Turni
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoriePermessi(['mezzi']);
                      setSelectedSubPermessi({ mezzi: getSottosezioniDelegabili('mezzi').map((s) => s.id) });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 text-amber-200 border border-amber-500/40 text-[11px] font-bold cursor-pointer"
                  >
                    Solo Mezzi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoriePermessi(['volontari']);
                      setSelectedSubPermessi({ volontari: getSottosezioniDelegabili('volontari').map((s) => s.id) });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 text-[11px] font-bold cursor-pointer"
                  >
                    Solo Volontari
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoriePermessi(['centrale']);
                      setSelectedSubPermessi({ centrale: getSottosezioniDelegabili('centrale').map((s) => s.id) });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold cursor-pointer"
                  >
                    Solo Centrale
                  </button>
                </div>
              </div>

              {/* Griglia Checkbox delle 10 Macro Categorie con espansione per Sottosezioni */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {LISTA_MACRO_CATEGORIE.map((cat) => {
                  const picked = selectedCategoriePermessi.includes(cat.id);
                  const titoloCorrente = getTitoloDatabase(cat.id, cat.titolo, nomiDbCustom);
                  const delegabili = getSottosezioniDelegabili(cat.id);
                  const subsChosen = selectedSubPermessi[cat.id] ?? (picked ? delegabili.map((s) => s.id) : []);
                  const isExpanded = expandedDbConfigId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                        picked
                          ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-md ring-1 ring-indigo-400/50'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategoriaPermesso(cat.id)}
                        className="text-left cursor-pointer flex items-start justify-between gap-2 w-full"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-black text-xs text-white">
                            <span>{cat.icona}</span>
                            <span className="truncate">{cat.numero}. {titoloCorrente}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{cat.sottotitolo}</div>
                        </div>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                            picked
                              ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                              : 'bg-slate-900 border-slate-600 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedDbConfigId(isExpanded ? null : cat.id)}
                        className={`w-full px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between border cursor-pointer transition-colors ${
                          isExpanded
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-slate-900/90 hover:bg-slate-800 text-indigo-200 border-slate-700'
                        }`}
                      >
                        <span>Sottosezioni ({picked ? `${subsChosen.length}/${delegabili.length}` : `0/${delegabili.length}`})</span>
                        <span>{isExpanded ? '▲ Chiudi' : '▼ Scegli'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Pannello Granulare Sottosezioni del DB Espanso */}
              {expandedDbConfigId && (() => {
                const catInfo = LISTA_MACRO_CATEGORIE.find((c) => c.id === expandedDbConfigId);
                if (!catInfo) return null;
                const delegabili = getSottosezioniDelegabili(expandedDbConfigId);
                const chosen = selectedSubPermessi[expandedDbConfigId] ?? (selectedCategoriePermessi.includes(expandedDbConfigId) ? delegabili.map((s) => s.id) : []);

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border-2 border-amber-500/50 space-y-3 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="text-xs font-black text-amber-300 uppercase flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>
                          Sottosezioni di {catInfo.icona} {catInfo.numero}. {getTitoloDatabase(catInfo.id, catInfo.titolo, nomiDbCustom)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => impostaTutteSubNelPannello(expandedDbConfigId, true)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-[10.5px] font-bold cursor-pointer"
                        >
                          Tutte ({delegabili.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => impostaTutteSubNelPannello(expandedDbConfigId, false)}
                          className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-500/40 text-[10.5px] font-bold cursor-pointer"
                        >
                          Nessuna
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedDbConfigId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10.5px] font-bold cursor-pointer"
                        >
                          Chiudi
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {delegabili.map((sub) => {
                        const subChecked = chosen.includes(sub.id);
                        const titoloSub = getTitoloSottosezione(expandedDbConfigId, sub.id, sub.titoloDefault, nomiSubCustom);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleSubPermessoNelPannello(expandedDbConfigId, sub.id)}
                            className={`p-2 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              subChecked
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span className="truncate">{sub.numero}. {titoloSub}</span>
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                subChecked
                                  ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                                  : 'bg-slate-950 border-slate-600 text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Pulsanti Azione sugli account selezionati (1 o N account) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                  <span>
                    Applica a <strong className="text-amber-300">{selectedVolontariPermessiIds.length}</strong> account selezionati ({selectedVolontariPermessiIds.length === 1 ? 'singolo' : 'simultaneamente'}) con <strong className="text-indigo-300">{selectedCategoriePermessi.length}</strong> DB/sottosezioni:
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={selectedVolontariPermessiIds.length === 0 || selectedCategoriePermessi.length === 0}
                    onClick={() => applicaPermessiDatabaseMassivi('aggiungi')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all ${
                      selectedVolontariPermessiIds.length > 0 && selectedCategoriePermessi.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-55'
                    }`}
                    title="Aggiunge i database e le sottosezioni selezionate mantenendo gli altri accessi già attivi"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Aggiungi Accessi (+)</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedVolontariPermessiIds.length === 0}
                    onClick={() => applicaPermessiDatabaseMassivi('sostituisci')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all ${
                      selectedVolontariPermessiIds.length > 0
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-55'
                    }`}
                    title="Imposta esattamente solo i database e sottosezioni spuntati sopra"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Imposta Esatti (=)</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedVolontariPermessiIds.length === 0 || selectedCategoriePermessi.length === 0}
                    onClick={() => applicaPermessiDatabaseMassivi('rimuovi')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all ${
                      selectedVolontariPermessiIds.length > 0 && selectedCategoriePermessi.length > 0
                        ? 'bg-amber-700 hover:bg-amber-600 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-55'
                    }`}
                    title="Rimuove i database o le sole sottosezioni selezionate sopra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Rimuovi Selezionati (-)</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedVolontariPermessiIds.length === 0}
                    onClick={() => applicaPermessiDatabaseMassivi('revoca_tutti')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all ${
                      selectedVolontariPermessiIds.length > 0
                        ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-55'
                    }`}
                    title="Rimuove tutte le autorizzazioni database e sottosezioni agli account selezionati"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Revoca Tutti</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Lista Singolo / Multi-Selezione Volontari & Modifica Istantanea */}
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={toggleSelezionaTuttiPermessi}
                    className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {volontariPermessiFiltrati.length > 0 &&
                    volontariPermessiFiltrati.every((v) => selectedVolontariPermessiIds.includes(v.id)) ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Deseleziona Visibili ({volontariPermessiFiltrati.length})</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        <span>Seleziona Tutti Visibili ({volontariPermessiFiltrati.length})</span>
                      </>
                    )}
                  </button>
                  {selectedVolontariPermessiIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedVolontariPermessiIds([])}
                      className="px-2.5 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-xs font-bold text-red-200 cursor-pointer"
                    >
                      Azzera ({selectedVolontariPermessiIds.length})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={filtroSezionePermessi}
                    onChange={(e) => setFiltroSezionePermessi(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                  >
                    <option value="tutte">Tutte le Sezioni Territoriali</option>
                    {SEDI_TURNI_DISPONIBILI.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icona} {s.nome}
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={ricercaPermessiVolontari}
                      onChange={(e) => setRicercaPermessiVolontari(e.target.value)}
                      placeholder="Cerca nome, matricola, qualifica..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800">
                        <th className="py-3 px-3 w-10 text-center">Sel.</th>
                        <th className="py-3 px-4">Account Volontario / Operatore</th>
                        <th className="py-3 px-3">Database & Sottosezioni Abilitati (Clic = Toggle DB, Dettaglio = Sottosezioni)</th>
                        <th className="py-3 px-3 text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {volontariPermessiFiltrati.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">
                            Nessun account trovato con i filtri selezionati.
                          </td>
                        </tr>
                      ) : (
                        volontariPermessiFiltrati.map((v) => {
                          const isSelected = selectedVolontariPermessiIds.includes(v.id);
                          const abilitati: MacroCategoriaId[] = Array.isArray(v.macroCategorieAbilitate)
                            ? (v.macroCategorieAbilitate as MacroCategoriaId[])
                            : [];
                          return (
                            <tr
                              key={v.id}
                              onClick={() => toggleSelezioneVolPermessi(v.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-950/35 hover:bg-indigo-950/50' : 'hover:bg-slate-900/60'
                              }`}
                            >
                              <td className="py-3 px-3 text-center align-middle">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelezioneVolPermessi(v.id);
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-4 align-middle min-w-[200px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white text-xs">
                                    {v.nome} {v.cognome}
                                  </span>
                                  {v.profiloCentrale && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black uppercase">
                                      Centrale
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {v.matricola || 'N/D'} • {v.qualifica}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-1.5">
                                  {LISTA_MACRO_CATEGORIE.map((cat) => {
                                    const on = abilitati.includes(cat.id);
                                    const titoloDb = getTitoloDatabase(cat.id, cat.titolo, nomiDbCustom);
                                    const delegabili = getSottosezioniDelegabili(cat.id);
                                    const customSubs = v.sottosezioniAbilitate?.[cat.id];
                                    const subCountLabel =
                                      on && Array.isArray(customSubs)
                                        ? ` (${customSubs.length}/${delegabili.length})`
                                        : '';
                                    return (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => toggleSingoloDbAccount(v, cat.id)}
                                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                          on
                                            ? Array.isArray(customSubs)
                                              ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 hover:bg-amber-500/30'
                                              : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/60 hover:bg-emerald-500/30'
                                            : 'bg-slate-900/70 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
                                        }`}
                                        title={`Clicca per ${on ? 'revocare' : 'concedere'} accesso "${titoloDb}" a ${v.nome} ${v.cognome}`}
                                      >
                                        <span>{cat.icona}</span>
                                        <span>{cat.numero}. {titoloDb.split(' ')[0]}{subCountLabel}</span>
                                        {on ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <span className="text-[9px] text-slate-600">✕</span>
                                        )}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Pulsanti barra strumenti riservati (Database, Web PC, 10 GB, Rinomina DB, Rinomina SUB) */}
                                  {(() => {
                                    const isPresOAdminVol = Boolean(
                                      (v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
                                      (v.qualifica && v.qualifica.toLowerCase().includes('presidente')) ||
                                      v.pin === '4451'
                                    );
                                    const pulsantiAttivi: PulsanteStrumentiId[] = Array.isArray(v.pulsantiStrumentiAbilitati)
                                      ? v.pulsantiStrumentiAbilitati
                                      : [];
                                    return (
                                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                                        <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-400/90 mr-0.5">
                                          Pulsanti Strumenti:
                                        </span>
                                        {isPresOAdminVol ? (
                                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                                            Tutti abilitati di default (Presidente / Admin)
                                          </span>
                                        ) : (
                                          LISTA_PULSANTI_STRUMENTI_RISERVATI.map((btn) => {
                                            const btnOn = pulsantiAttivi.includes(btn.id);
                                            return (
                                              <button
                                                key={`${v.id}-btn-${btn.id}`}
                                                type="button"
                                                onClick={() => togglePulsanteStrumentiAccount(v, btn.id)}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                                  btnOn
                                                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 hover:bg-amber-500/30'
                                                    : 'bg-slate-900/70 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
                                                }`}
                                                title={`${btnOn ? 'Nascondi' : 'Mostra'} pulsante "${btn.titolo}" a ${v.nome} ${v.cognome}`}
                                              >
                                                <span>{btn.icona}</span>
                                                <span>{btn.titolo}</span>
                                                {btnOn ? (
                                                  <Check className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                  <span className="text-[8.5px] text-slate-600">✕</span>
                                                )}
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                              <td className="py-3 px-3 align-middle text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-col items-center gap-1">
                                  {abilitati.length > 0 ? (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 font-mono text-[10px] font-bold">
                                      {abilitati.length}/{LISTA_MACRO_CATEGORIE.length} DB
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-500 border border-slate-800 font-mono text-[10px]">
                                      Solo App Bordo
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setAccountDettaglioPermessiId(v.id)}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase cursor-pointer shadow-sm"
                                    title={`Gestisci singole sottosezioni per ${v.nome} ${v.cognome}`}
                                  >
                                    Sottosezioni
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* MODALE DETTAGLIO PERMESSI SINGOLO ACCOUNT (DATABASE + SINGOLE SOTTOSEZIONI) */}
            {accountInDettaglio && (
              <div
                className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                onClick={() => setAccountDettaglioPermessiId(null)}
              >
                <div
                  className="bg-slate-900 border-2 border-indigo-500/70 rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase text-indigo-300">
                        Configurazione Accessi Singolo Account
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-white">
                        🔐 {accountInDettaglio.nome} {accountInDettaglio.cognome} ({accountInDettaglio.qualifica})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Spunta o revoca l&apos;intero Database oppure singole sottosezioni. Salvataggio e sincronizzazione immediati.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccountDettaglioPermessiId(null)}
                      className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                    {/* Sezione Pulsanti Barra Strumenti Riservati (Admin / Presidente -> delegabili a questo account) */}
                    {(() => {
                      const isPresOAdminDet = Boolean(
                        (accountInDettaglio.caricaConsiglioDirettivo &&
                          accountInDettaglio.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
                        (accountInDettaglio.qualifica &&
                          accountInDettaglio.qualifica.toLowerCase().includes('presidente')) ||
                        accountInDettaglio.pin === '4451'
                      );
                      const pulsantiAttiviDet: PulsanteStrumentiId[] = Array.isArray(
                        accountInDettaglio.pulsantiStrumentiAbilitati
                      )
                        ? accountInDettaglio.pulsantiStrumentiAbilitati
                        : [];
                      return (
                        <div className="md:col-span-2 p-3.5 rounded-2xl border bg-amber-950/20 border-amber-500/40 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-500/25">
                            <div>
                              <div className="text-xs font-black text-amber-300 uppercase tracking-wide">
                                🔐 Pulsanti Barra Strumenti Riservati (Database • Web PC • 10 GB • Rinomina DB • Rinomina SUB)
                              </div>
                              <div className="text-[10.5px] text-slate-300">
                                Visibili di default solo ad Amministratore e Presidente. Abilita qui quali pulsanti rendere visibili a questo account.
                              </div>
                            </div>
                            {isPresOAdminDet && (
                              <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[10px] font-black uppercase">
                                Inclusi di default (Presidente / Admin)
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                            {LISTA_PULSANTI_STRUMENTI_RISERVATI.map((btn) => {
                              const btnOn = isPresOAdminDet || pulsantiAttiviDet.includes(btn.id);
                              return (
                                <button
                                  key={`det-btn-${btn.id}`}
                                  type="button"
                                  disabled={isPresOAdminDet}
                                  onClick={() => togglePulsanteStrumentiAccount(accountInDettaglio, btn.id)}
                                  className={`px-2.5 py-2 rounded-xl border text-left text-[11px] font-bold flex items-center justify-between gap-1.5 transition-all ${
                                    isPresOAdminDet
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 cursor-default opacity-90'
                                      : btnOn
                                        ? 'bg-amber-500/25 border-amber-400 text-amber-100 cursor-pointer'
                                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 cursor-pointer'
                                  }`}
                                  title={btn.descrizione}
                                >
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span>{btn.icona}</span>
                                    <span className="truncate">{btn.titolo}</span>
                                  </span>
                                  <span
                                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                      btnOn
                                        ? 'bg-amber-400 border-amber-300 text-slate-950'
                                        : 'bg-slate-950 border-slate-600 text-transparent'
                                    }`}
                                  >
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {LISTA_MACRO_CATEGORIE.map((cat) => {
                      const abilitatiDb = Array.isArray(accountInDettaglio.macroCategorieAbilitate)
                        ? (accountInDettaglio.macroCategorieAbilitate as MacroCategoriaId[])
                        : [];
                      const dbOn = abilitatiDb.includes(cat.id);
                      const delegabili = getSottosezioniDelegabili(cat.id);
                      const subExplicit = accountInDettaglio.sottosezioniAbilitate?.[cat.id];
                      const activeSubs = dbOn
                        ? (Array.isArray(subExplicit) ? subExplicit : delegabili.map((s) => s.id))
                        : [];
                      const titoloDb = getTitoloDatabase(cat.id, cat.titolo, nomiDbCustom);

                      return (
                        <div
                          key={`acc-det-${cat.id}`}
                          className={`p-3.5 rounded-2xl border space-y-2.5 ${
                            dbOn
                              ? 'bg-slate-950 border-emerald-500/50'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">
                                {cat.icona} {cat.numero}. {titoloDb}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {dbOn ? `${activeSubs.length}/${delegabili.length} sottosezioni attive` : 'Accesso Disabilitato'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleSingoloDbAccount(accountInDettaglio, cat.id)}
                              className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black uppercase border cursor-pointer shrink-0 ${
                                dbOn
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {dbOn ? 'Tutte ON' : 'Abilita DB'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {delegabili.map((sub) => {
                              const subOn = activeSubs.includes(sub.id);
                              const titoloSub = getTitoloSottosezione(cat.id, sub.id, sub.titoloDefault, nomiSubCustom);
                              return (
                                <button
                                  key={`acc-sub-${cat.id}-${sub.id}`}
                                  type="button"
                                  onClick={() => toggleSottosezioneSingoloAccount(accountInDettaglio, cat.id, sub.id)}
                                  className={`px-2.5 py-1.5 rounded-xl border text-left text-[11px] font-bold flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                                    subOn
                                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  <span className="truncate">{sub.numero}. {titoloSub}</span>
                                  <span
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                                      subOn
                                        ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                                        : 'bg-slate-950 border-slate-600 text-transparent'
                                    }`}
                                  >
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setAccountDettaglioPermessiId(null)}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase cursor-pointer"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* MODALE CREAZIONE NUOVA MANSIONE NEL CATALOGO (INFINITE MANSIONI) */}
      {modalNuovaMansioneAperta && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Header Modale Fisso */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-lg shrink-0">
                  <IconaEmoji value={nuovaMansioneEmoji || mansioneInModifica?.badgeEmoji} fallback={mansioneInModifica ? '✏️' : '🎖️'} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-white text-sm truncate">
                    {mansioneInModifica ? 'Modifica Mansione Esistente' : 'Crea Nuova Mansione'}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {mansioneInModifica ? 'Aggiorna nome, categoria, icona o requisiti della mansione' : 'Aggiungi una mansione personalizzata al catalogo'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalNuovaMansioneAperta(false);
                  setMansioneInModifica(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                title="Chiudi senza salvare"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo Form Scrollabile su PC e Mobile */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome della Mansione *
                </label>
                <input
                  type="text"
                  value={nuovaMansioneNome}
                  onChange={(e) => setNuovaMansioneNome(e.target.value)}
                  placeholder="Es. Soccorritore Guida Sicura, Operatore DAE, ecc."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={nuovaMansioneCategoria}
                  onChange={(e) => setNuovaMansioneCategoria(e.target.value as CategoriaMansione)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  {categorieMansioni.map((c) => {
                    const icoTxt = formatIconaPerTesto(c.badgeEmoji, '');
                    return (
                      <option key={c.id} value={c.nome}>
                        {icoTxt ? `${icoTxt} ` : ''}{c.nome}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Icona Emoji / Archivio .ico
                </label>
                <EmojiIconPicker
                  value={nuovaMansioneEmoji}
                  onChange={setNuovaMansioneEmoji}
                  fallback="🎖️"
                  accent="blue"
                  allowIcoUpload
                  onCustomIconsChanged={(icons) => realtime.syncCustomEmojiIcons(icons)}
                  operatoreCorrente={operatoreCorrente}
                  compact
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Genitorialità (Mansione Genitore)
                </label>
                <select
                  value={nuovaMansioneParentId}
                  onChange={(e) => setNuovaMansioneParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Nessuna mansione genitore (livello principale)</option>
                  {(() => {
                    const excludedIds = mansioneInModifica
                      ? new Set([mansioneInModifica.id, ...getDescendantMansioneIds(mansioneInModifica.id, catalogoMansioni)])
                      : new Set<string>();
                    return catalogoMansioni
                      .filter((m) => !excludedIds.has(m.id))
                      .map((m) => {
                        const icoTxt = formatIconaPerTesto(m.badgeEmoji, '🏷️');
                        return (
                          <option key={m.id} value={m.id}>
                            {icoTxt ? `${icoTxt} ` : ''}{m.nome} ({m.categoria})
                          </option>
                        );
                      });
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Descrizione & Competenze Richieste
                </label>
                <textarea
                  value={nuovaMansioneDescrizione}
                  onChange={(e) => setNuovaMansioneDescrizione(e.target.value)}
                  placeholder="Descrivi brevemente requisiti, corsi o abilitazioni previste per questa mansione..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Gerarchia Mansioni: Mansioni Ereditate Automaticamente */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-amber-300">
                    🔗 Gerarchia: Mansioni Ereditate Automaticamente
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {nuovaMansioneIncluse.length} incluse
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-tight">
                  Chi possiede questa mansione includerà automaticamente le mansioni selezionate qui sotto (la mansione più alta include quelle più in basso):
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-900/60 rounded-lg border border-slate-800">
                  {catalogoMansioni
                    .filter((m) => !mansioneInModifica || m.id !== mansioneInModifica.id)
                    .map((m) => {
                      const isChecked = nuovaMansioneIncluse.includes(m.nome);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setNuovaMansioneIncluse((prev) => prev.filter((nome) => nome !== m.nome));
                            } else {
                              setNuovaMansioneIncluse((prev) => [...prev, m.nome]);
                            }
                          }}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                            isChecked
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <IconaEmoji value={m.badgeEmoji} fallback="🏷️" />
                          <span>{m.nome}</span>
                          {isChecked && <Check className="w-3 h-3 text-amber-400" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer Modale Fisso */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalNuovaMansioneAperta(false);
                  setMansioneInModifica(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSalvaMansione}
                disabled={!nuovaMansioneNome.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md ${
                  nuovaMansioneNome.trim()
                    ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{mansioneInModifica ? 'Aggiorna Mansione' : 'Salva nel Catalogo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE DEFINITIVA ACCOUNT / DOMANDA */}
      {volontarioDaEliminareSezione && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h4 className="font-black text-sm uppercase">
                  {volontarioDaEliminareSezione.modo === 'domanda' ? 'Respingi Domanda' : 'Elimina Account'}
                </h4>
                <p className="text-xs text-slate-400">Azione irreversibile</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {volontarioDaEliminareSezione.modo === 'domanda' ? (
                <>
                  Sei sicuro di voler respingere ed eliminare definitivamente la domanda di ammissione di{' '}
                  <strong className="text-white">
                    {volontarioDaEliminareSezione.vol.nome} {volontarioDaEliminareSezione.vol.cognome}
                  </strong>?
                </>
              ) : (
                <>
                  Confermi di voler eliminare definitivamente l&apos;account di{' '}
                  <strong className="text-white">
                    {volontarioDaEliminareSezione.vol.nome} {volontarioDaEliminareSezione.vol.cognome}
                  </strong>{' '}
                  (<span className="text-amber-400">{volontarioDaEliminareSezione.vol.qualifica}</span>)?
                  <br /><br />
                  L&apos;account verrà rimosso in modo permanente da tutti i dispositivi e dal database.
                </>
              )}
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={confermaEliminaVolontarioSezione}
                className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
              >
                {volontarioDaEliminareSezione.modo === 'domanda' ? 'Respingi e Rimuovi' : 'Elimina Definitivamente'}
              </button>
              <button
                type="button"
                onClick={() => setVolontarioDaEliminareSezione(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE GESTIONE CATEGORIA MANSIONI & GENITORIALITÀ */}
      {modalCategoriaAperta && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSalvaCategoria}
            className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl my-auto"
          >
            {/* Header Fisso */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0 inline-flex items-center justify-center">
                  <IconaEmoji value={formCategoriaEmoji} fallback="📁" />
                </span>
                <div className="min-w-0">
                  <h4 className="font-black text-white text-sm truncate">
                    {categoriaInModifica ? 'Modifica Categoria Mansioni' : 'Nuova Categoria Mansioni'}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    Modifica nome, icona (.ico o emoji) e categoria genitore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalCategoriaAperta(false);
                  setCategoriaInModifica(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                title="Chiudi senza salvare"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo Scrollabile */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formCategoriaNome}
                  onChange={(e) => setFormCategoriaNome(e.target.value)}
                  placeholder="Es. Emergenza 118, Protezione Civile..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Icona Emoji / Carica file .ico nell&apos;Archivio
                </label>
                <EmojiIconPicker
                  value={formCategoriaEmoji}
                  onChange={setFormCategoriaEmoji}
                  fallback="📁"
                  accent="amber"
                  allowIcoUpload
                  onCustomIconsChanged={(icons) => realtime.syncCustomEmojiIcons(icons)}
                  operatoreCorrente={operatoreCorrente}
                  compact
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Genitorialità (Categoria Genitore)
                </label>
                <select
                  value={formCategoriaParentId}
                  onChange={(e) => setFormCategoriaParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="">Nessuna categoria genitore (categoria principale)</option>
                  {(() => {
                    const excludedCatIds = categoriaInModifica
                      ? new Set([categoriaInModifica.id, ...getDescendantCategoriaIds(categoriaInModifica.id, categorieMansioni)])
                      : new Set<string>();
                    return categorieMansioni
                      .filter((c) => !excludedCatIds.has(c.id))
                      .map((c) => {
                        const icoTxt = formatIconaPerTesto(c.badgeEmoji, '📁');
                        return (
                          <option key={c.id} value={c.id}>
                            {icoTxt ? `${icoTxt} ` : ''}{c.nome}
                          </option>
                        );
                      });
                  })()}
                </select>
              </div>
            </div>

            {/* Footer Fisso */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalCategoriaAperta(false);
                  setCategoriaInModifica(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!formCategoriaNome.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{categoriaInModifica ? 'Aggiorna Categoria' : 'Salva Categoria'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE CONFERMA AZIONE GENERICA IN-APP */}
      {confermaAzioneModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <h4 className="font-black text-sm uppercase">{confermaAzioneModal.titolo}</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{confermaAzioneModal.messaggio}</p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const fn = confermaAzioneModal.onConfirm;
                  setConfermaAzioneModal(null);
                  fn();
                }}
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-md"
              >
                {confermaAzioneModal.labelConferma || 'Conferma'}
              </button>
              <button
                type="button"
                onClick={() => setConfermaAzioneModal(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DATABASE VOLONTARI COMPLETO */}
      <DatabaseVolontariModal
        isOpen={modalDatabaseCompletoAperta}
        onClose={() => {
          setModalDatabaseCompletoAperta(false);
          setModalDatabaseInitialAction(null);
        }}
        initialAction={modalDatabaseInitialAction}
        volontari={volontari}
        onAggiornaVolontari={onAggiornaVolontari}
        onEliminaVolontario={onEliminaVolontario}
        onNotificaRadio={(msg, tipo) => onNotificaRadio?.(msg, tipo)}
        isAdmin={isEffettivoAdmin}
        timbrature={timbrature}
        operatoreCorrente={operatoreCorrente}
        magazzinoVestiario={magazzinoVestiario}
        onAggiornaMagazzinoVestiario={onAggiornaMagazzinoVestiario}
        movimentiMagazzino={movimentiMagazzino}
        onAggiornaMovimentiMagazzino={onAggiornaMovimentiMagazzino}
      />
    </div>
  );
};
