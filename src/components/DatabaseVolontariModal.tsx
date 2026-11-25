import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Phone,
  ShieldAlert,
  Car,
  Clock,
  Download,
  RotateCcw,
  Radio,
  Mail,
  Send,
  Lock,
  Unlock,
  AlertTriangle,
  Upload,
  PenTool,
  Sparkles,
  Camera,
  FileText,
  Shirt,
  Calendar,
  Award,
  CheckSquare,
  Square,
  FileDown,
  MapPin,
  Globe,
  Receipt,
  CreditCard,
  FileCheck,
  ArrowUpCircle,
  ArrowDownCircle,
  Shield,
  Building2,
  Layers,
  Filter,
  PlusCircle,
  RefreshCw,
  Save,
  Copy
} from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import { SignaturePad } from './SignaturePad';
import { isAccessoDaWeb } from '../utils/accessoWeb';
import { UploadFirmaTrasparente } from './UploadFirmaTrasparente';
import { ModalAccessoWeb } from './ModalAccessoWeb';
import { MacroCategoriaId, PulsanteStrumentiId } from '../constants/macroCategorie';
import { PasskeyRecord, getNotificationEmailForVolontario } from '../utils/passkeyAuth';
import { inviaNotificaModificaAdmin } from '../utils/notificaModificaAdmin';
import { formatDateItaly, formatDateTimeItaly, formatISODateItaly, getCurrentYearItaly } from '../utils/italianTime';
import { mergeVolontariListsSafe } from '../utils/volontariMerge';
import {
  creaTicketResetPinFirestore,
  generaTokenResetPinSicuro,
  syncPinResetProfilesFirestore
} from '../services/firebase';
import { realtime } from '../services/realtime';
import {
  buildPublicResetUrl,
  getConfiguredPublicUrl,
  scaricaPaginaHtmlResetPinPubblica
} from '../utils/publicUrl';
import {
  getMansioniCatalogo,
  creaNuovaMansione,
  eliminaMansioneCatalogo,
  modificaMansioneCatalogo,
  ripristinaMansioniDefault,
  aggiornaVolontariDopoModificaMansione,
  aggiornaVolontariDopoEliminazioneMansione,
  getMansioniVolontario,
  getMansionePrincipale,
  MansioneOperativa,
  CategoriaMansione,
  getStileMansione,
  getCategorieMansioni,
  creaCategoriaMansione,
  modificaCategoriaMansione,
  eliminaCategoriaMansione,
  ripristinaCategorieMansioniDefault,
  getDescendantMansioneIds,
  getDescendantCategoriaIds,
  emettiRinominaMansioneGlobale,
  CategoriaMansioneItem
} from '../utils/mansioniVolontari';
import { aggiornaTipiTurnoDopoModificaMansione } from '../utils/tipiTurno';
import { formatIconaPerTesto } from '../utils/emojiIconsArchive';
import { IconaEmoji } from './IconaEmoji';
import { EmojiIconPicker } from './EmojiIconPicker';
import { useTitoloDatabase } from '../hooks/useNomiDatabase';
import {
  TagliaVestiario,
  TAGLIE_DISPONIBILI,
  PezzoTShirt,
  CapoVestiario,
  DotazioneVestiario,
  DocumentoFirmatoArchiviato,
  DocumentoIdentitaVolontario,
  PatenteGuidaVolontario,
  creaDotazioneVuota,
  calcolaStatoScadenzaPatente,
  applicaEvidenziazioneUltimaConsegna,
  CAUZIONE_PANTALONI,
  CAUZIONE_GIUBBETTO,
  calcolaCauzioneTotale,
  RiconsegnaVestiarioStoricoItem
} from '../data/vestiarioDocumenti';
import { scaricaSchedaVestiarioPDF } from '../utils/pdfSchedaVestiario';
import { scaricaPDFRestituzioneDivisa, CapoRestituzioneDettaglio } from '../utils/pdfRestituzioneDivisa';
import {
  CaricaConsiglioDirettivo,
  CARICHE_DIRETTIVO_DISPONIBILI,
  QUOTA_TESSERA_VOLONTARIO,
  QUOTA_TESSERA_OPERATORE,
  DICITURA_ESENZIONE_BOLLO,
  RicevutaTesseramento,
  DatiTesseramento,
  haIscrizioneOttNovDicAnnoPrecedente,
  calcolaImportoDovutoTesseramento,
  calcolaStatoPeriodoRinnovo,
  calcolaProssimoNumeroRicevuta,
  formattaNumeroRicevuta,
  isPeriodoInserimentoManualeTessere,
  calcolaProssimoNumeroTessera,
  DATA_LIMITE_MANUALE_TESSERE
} from '../data/tesseramento';
import { scaricaRicevutaTesseramentoPDF, stampaEInviaRicevutaTesseramento } from '../utils/pdfRicevutaTesseramento';
import { ModalCompilaDomandaIscrizione } from './ModalCompilaDomandaIscrizione';
import { scaricaPDFDomandaIscrizione } from '../utils/pdfDomandaIscrizione';
import { MappaGeolocalizzazioneResidenza, DatiResidenzaMultiCampo } from './MappaGeolocalizzazioneResidenza';
import { calcolaCodiceFiscale, decodificaCodiceFiscale } from '../utils/codiceFiscale';
import {
  TimbraturaVolontario,
  ArticoloVestiarioMagazzino,
  MovimentoMagazzino,
  ChiaveVestiarioAccount
} from '../types/adminTypes';
import {
  isTimbraturaAttualmentePresente,
  isTimbraturaConUscitaValida,
  isTimbraturaNfcScaduta24h
} from '../utils/raspberryDisplayConfig';
export const SEDI_TURNI_DISPONIBILI = [
  { id: 'sede-massa-ronchi', codice: 'SEDE-01-RONCHI', nome: 'Sede Legale & Direzione Generale Massa (Ronchi)', icona: '🏛️' },
  { id: 'sede-massa-lejare', codice: 'SEDE-02-LEJARE', nome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)', icona: '🚑' },
  { id: 'sede-carrara-fossone', codice: 'SEDE-03-FOSSONE', nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)', icona: '🏥' },
  { id: 'sede-pietrasanta', codice: 'SEDE-04-PIETRASANTA', nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)', icona: '🏖️' },
  { id: 'sede-lunigiana', codice: 'SEDE-05-LUNIGIANA', nome: 'Sezione Territoriale Lunigiana (Aulla)', icona: '⛰️' },
];

export interface Volontario {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale?: string; // Codice Fiscale (16 caratteri)
  indirizzoResidenza?: string; // Indirizzo di residenza formattato (Via/Piazza, Civico, CAP Comune Prov)
  dettaglioResidenza?: DatiResidenzaMultiCampo; // Dati dettagliati e coordinate GPS
  dataNascita?: string; // Data di nascita (YYYY-MM-DD)
  sesso?: 'M' | 'F'; // Sesso per calcolo CF
  comuneNascita?: string; // Comune di nascita
  provinciaNascita?: string; // Sigla provincia di nascita (es. MS)
  matricola?: string;
  qualifica: 'Autista' | 'Soccorritore' | 'Operatore Centrale' | string;
  mansione?: string; // Mansione principale del volontario (nuova nomenclatura)
  mansioni?: string[]; // Mansioni multiple assegnate contemporaneamente
  mansioniIds?: string[]; // ID immutabili delle mansioni assegnate (resistenti a rinomine consecutive)
  caricaConsiglioDirettivo?: CaricaConsiglioDirettivo; // Carica nel Consiglio Direttivo
  tesseramento?: DatiTesseramento; // Tesseramento, rinnovo, ricevuta sequenziale e timbro cartaceo
  telefono: string;
  email: string; // Indirizzo email obbligatorio (anagrafica Gestione Volontari)
  emailNotifiche?: string; // Indirizzo email alternativo per ricevere le notifiche (non altera l'email anagrafica)
  passkeys?: PasskeyRecord[]; // Elenco Passkey (Impronta Digitale / Face ID) registrate dall'account
  pin: string; // 4 cifre
  pinHash?: string; // Hash SHA-256 del PIN per verifica sicura su terminali non autenticati Google
  pinIsEmergency?: boolean; // True se il PIN attuale è il codice di emergenza 0000 (roster pubblico zero-PII)
  hasFirma?: boolean; // True se il volontario ha già una firma digitale salvata (roster pubblico zero-PII)
  isPublicRosterOnly?: boolean; // True se il record proviene dal roster pubblico zero-PII
  pinProvvisorio?: boolean; // Se true, generato provvisororiamente dal sistema
  resetToken?: string; // Token univoco per reimpostazione autonoma da pagina web dedicata
  dataInvioInvitoReset?: string; // Data e ora invio email con PIN provvisorio e link
  dataRegistrazione: string;
  ultimoAccesso?: string;
  loggato?: boolean;
  loggatoUpdatedAt?: number;
  inTurno: boolean;
  mezzoAttivo?: string;
  ruoloTurno?: string;
  profiloCentrale?: boolean;
  approvato?: boolean;
  dataRichiestaApprovazione?: string;
  richiedeResetPassword?: boolean;
  dataRichiestaResetPassword?: string;
  tentativiErrati?: number; // Contatore tentativi PIN errati (max 3)
  bloccatoPerTentativi?: boolean; // True se ha raggiunto 3 errori
  dataBlocco?: string; // Data e ora del blocco di sicurezza
  firmaBase64?: string; // Firma autografa digitale acquisita sullo schermo del device
  fotoBase64?: string; // Foto della persona caricata dall'amministratore
  documentoIdentita?: DocumentoIdentitaVolontario; // Tipo doc, numero, scadenza
  patente?: PatenteGuidaVolontario; // Patente di guida con alert scadenza
  vestiario?: DotazioneVestiario; // Capi consegnati con taglie XXS-XXL e date
  domandaIscrizioneFirmata?: DocumentoFirmatoArchiviato; // Upload della Domanda di Iscrizione stampata e firmata dall'amministratore e dal socio
  domandaIscrizioneDati?: any; // Dati completi della Domanda di Iscrizione (sanitari, tutore minorenne, consensi)
  esenteQuotaAssociativa?: boolean; // Se true, non riceve la quota associativa
  motivoEsenzioneQuota?: 'Benemerito' | 'Giovane' | 'LPU / MAP' | 'Onorario' | string;
  macroCategorieAbilitate?: MacroCategoriaId[]; // Macro categorie a cui l'utente ha accesso delegato (visualizzazione, inserimento e modifica)
  sottosezioniAbilitate?: Record<string, string[]>; // Sottosezioni specifiche abilitate per ciascun database (se assente: tutte)
  pulsantiStrumentiAbilitati?: PulsanteStrumentiId[]; // Pulsanti barra strumenti riservati ad Admin/Presidente delegati a questo account (Database, Web PC, 10 GB, Rinomina DB, Rinomina SUB)
  sediTurniAbilitate?: string[]; // Sedi/sezioni autorizzate per visualizzare il tabellone turni (modificabile da centrale)
  sezioneAppartenenzaId?: string; // Sezione territoriale di appartenenza dell'associazione
  sezioneAppartenenzaNome?: string; // Nome della sezione territoriale di appartenenza
  isDipendente?: boolean; // True se dipendente associativo (può essere nascosto ai volontari nel calendario turni)
}

export interface DatabaseVolontariModalInitialAction {
  mode: 'nuovo' | 'fascicolo';
  volontario?: Volontario;
  tab?: 'anagrafica' | 'tesseramento' | 'documenti' | 'vestiario' | 'domanda_iscrizione';
  directOnly?: boolean;
}

interface DatabaseVolontariModalProps {
  isOpen: boolean;
  onClose: () => void;
  volontari: Volontario[];
  onAggiornaVolontari: (nuoviVolontari: Volontario[]) => void;
  onEliminaVolontario?: (id: string) => void;
  onNotificaRadio: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  isAdmin?: boolean;
  canDelete?: boolean; // Se false, eliminazione inibita e riservata all'amministratore
  operatoreCorrente?: string;
  timbrature?: TimbraturaVolontario[];
  magazzinoVestiario?: ArticoloVestiarioMagazzino[];
  onAggiornaMagazzinoVestiario?: (nuovi: ArticoloVestiarioMagazzino[]) => void;
  movimentiMagazzino?: MovimentoMagazzino[];
  onAggiornaMovimentiMagazzino?: (nuovi: MovimentoMagazzino[]) => void;
  initialAction?: DatabaseVolontariModalInitialAction | null;
}

export const DatabaseVolontariModal: React.FC<DatabaseVolontariModalProps> = ({
  isOpen,
  onClose,
  volontari,
  onAggiornaVolontari,
  onEliminaVolontario,
  onNotificaRadio,
  isAdmin = true,
  canDelete,
  operatoreCorrente = 'Amministratore',
  timbrature = [],
  magazzinoVestiario = [],
  onAggiornaMagazzinoVestiario,
  movimentiMagazzino = [],
  onAggiornaMovimentiMagazzino,
  initialAction = null
}) => {
  const [adminSbloccato, setAdminSbloccato] = useState(false);
  const [pinAdminInput, setPinAdminInput] = useState('');
  const [errorePinAdmin, setErrorePinAdmin] = useState<string | null>(null);
  const isWeb = isAccessoDaWeb();
  const isAdminEffettivo = isAdmin || adminSbloccato;
  // Se canDelete è esplicitamente passato (false per utenti con accesso delegato), ha la precedenza
  const canDeleteEffettivo = canDelete !== undefined ? canDelete : isAdminEffettivo;

  // Calcolo automatico delle ore di servizio timbrate nell'anno solare (2026) per ciascun volontario
  const calcolaOreAnnoVolontario = (vol: Volontario, anno = '2026') => {
    const list = (timbrature || []).filter(t => {
      if (isTimbraturaNfcScaduta24h(t) || !isTimbraturaConUscitaValida(t)) return false;
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

  // Helper per verificare se un volontario ha una timbratura di ingresso attiva (esclude NFC >24h auto-chiuse)
  const getTimbraturaAttiva = (vol: Volontario) => {
    return (timbrature || []).find(t => {
      if (!isTimbraturaAttualmentePresente(t)) return false;
      const matchId = vol.id && t.volontarioId === vol.id;
      const matchNome = (vol.nome || vol.cognome) && t.volontarioNome && (
        t.volontarioNome.trim().toLowerCase() === `${vol.nome} ${vol.cognome}`.trim().toLowerCase() ||
        t.volontarioNome.trim().toLowerCase() === `${vol.cognome} ${vol.nome}`.trim().toLowerCase()
      );
      return Boolean(matchId || matchNome);
    });
  };

  // Somma totale di tutte le ore timbrate da tutti i volontari nell'anno solare (2026)
  const totaleOreTuttiVolontariAnno = React.useMemo(() => {
    const anno = '2026';
    const timbAnno = (timbrature || []).filter(
      t => !isTimbraturaNfcScaduta24h(t) && isTimbraturaConUscitaValida(t) && t.data && t.data.startsWith(anno) && typeof t.oreTotali === 'number'
    );
    const sum = timbAnno.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0);
    return Math.round(sum * 10) / 10;
  }, [timbrature]);

  const [ricerca, setRicerca] = useState('');
  const [filtroLivello, setFiltroLivello] = useState<'tutti' | 'volontari' | 'operatori' | 'attesa' | 'bloccati' | 'patenti-scadenza' | 'timbro-tessera' | 'tessera-scaduta'>('tutti');
  const [mostraTuttiPIN, setMostraTuttiPIN] = useState(false);
  const [pinVisibili, setPinVisibili] = useState<Record<string, boolean>>({});
  
  // Modale Aggiungi / Modifica
  const [modaleEditAperta, setModaleEditAperta] = useState(false);
  const [volontarioInModifica, setVolontarioInModifica] = useState<Volontario | null>(null);
  const [tabModaleEdit, setTabModaleEdit] = useState<'anagrafica' | 'tesseramento' | 'documenti' | 'vestiario' | 'domanda_iscrizione'>('anagrafica');
  const [formMacroCategorie, setFormMacroCategorie] = useState<MacroCategoriaId[]>([]);
  const [formDomandaIscrizioneDati, setFormDomandaIscrizioneDati] = useState<any>(undefined);
  const [formDomandaIscrizioneFirmata, setFormDomandaIscrizioneFirmata] = useState<DocumentoFirmatoArchiviato | undefined>(undefined);

  // Modale Conferma Eliminazione Account
  const [accountDaEliminare, setAccountDaEliminare] = useState<Volontario | null>(null);

  // Modale Accesso Web PC da qualsiasi Browser
  const [modalAccessoWebAperta, setModalAccessoWebAperta] = useState(false);

  // Form Nuovo / Edit Volontario - Anagrafica & Credenziali
  const [formNome, setFormNome] = useState('');
  const [formCognome, setFormCognome] = useState('');
  const [formCodiceFiscale, setFormCodiceFiscale] = useState('');
  const [formIndirizzoResidenza, setFormIndirizzoResidenza] = useState('');

  // Campi Dettagliati Residenza (Indirizzo, Comune, CAP, Provincia e Mappa/GPS)
  const [formResidenza, setFormResidenza] = useState<DatiResidenzaMultiCampo>({
    indirizzo: '',
    comune: 'Massa',
    cap: '54100',
    provincia: 'MS'
  });

  // Campi Nascita (Data, Sesso, Comune e Sigla Provincia)
  const [formDataNascita, setFormDataNascita] = useState('');
  const [formSesso, setFormSesso] = useState<'M' | 'F'>('M');
  const [formComuneNascita, setFormComuneNascita] = useState('Massa');
  const [formProvinciaNascita, setFormProvinciaNascita] = useState('MS');
  const [feedbackCF, setFeedbackCF] = useState<{ tipo: 'success' | 'error'; testo: string } | null>(null);

  const [formMatricola, setFormMatricola] = useState('');
  const [formQualifica, setFormQualifica] = useState<Volontario['qualifica']>('Autista');
  // Mansioni multiple assegnate contemporaneamente (nuova gestione dinamica)
  const [formMansioni, setFormMansioni] = useState<string[]>(['Autista Soccorritore 118']);
  const titoloDbVolontari = useTitoloDatabase('volontari', 'Database Volontari & Operatori');
  const [catalogoMansioni, setCatalogoMansioni] = useState<MansioneOperativa[]>(() => getMansioniCatalogo());
  const [categorieMansioni, setCategorieMansioni] = useState<CategoriaMansioneItem[]>(() => getCategorieMansioni());
  const [mostraCreaMansioneRapida, setMostraCreaMansioneRapida] = useState(false);
  const [nuovaMansioneNomeRapida, setNuovaMansioneNomeRapida] = useState('');
  // Vista Principale Database: 'profili' (Anagrafiche e PIN) oppure 'mansioni' (Catalogo e Assegnazione Multipla)
  const [vistaDatabaseModal, setVistaDatabaseModal] = useState<'profili' | 'mansioni'>('profili');
  const [selectedVolontariMansioniModalIds, setSelectedVolontariMansioniModalIds] = useState<string[]>([]);
  const [selectedMansioniNomiModal, setSelectedMansioniNomiModal] = useState<string[]>([]);
  const [modalCreaNuovaMansioneInModal, setModalCreaNuovaMansioneInModal] = useState(false);
  const [mansioneInModificaModal, setMansioneInModificaModal] = useState<MansioneOperativa | null>(null);
  const [nuovaMansioneNomeModal, setNuovaMansioneNomeModal] = useState('');
  const [nuovaMansioneCategoriaModal, setNuovaMansioneCategoriaModal] = useState<CategoriaMansione>('Emergenza 118');
  const [nuovaMansioneEmojiModal, setNuovaMansioneEmojiModal] = useState('🎖️');
  const [nuovaMansioneDescrizioneModal, setNuovaMansioneDescrizioneModal] = useState('');
  const [nuovaMansioneParentIdModal, setNuovaMansioneParentIdModal] = useState<string>('');
  const [nuovaMansioneIncluseModal, setNuovaMansioneIncluseModal] = useState<string[]>(['Volontario']);
  const [filtroCategoriaMansioneModal, setFiltroCategoriaMansioneModal] = useState('tutte');
  const [ricercaMansioniModal, setRicercaMansioniModal] = useState('');
  // Gestione Categorie Mansioni & Genitorialità
  const [modalCategoriaModalAperta, setModalCategoriaModalAperta] = useState(false);
  const [categoriaInModificaModal, setCategoriaInModificaModal] = useState<CategoriaMansioneItem | null>(null);
  const [formCategoriaNomeModal, setFormCategoriaNomeModal] = useState('');
  const [formCategoriaEmojiModal, setFormCategoriaEmojiModal] = useState('📁');
  const [formCategoriaParentIdModal, setFormCategoriaParentIdModal] = useState('');

  useEffect(() => {
    const syncHandler = () => {
      setCatalogoMansioni(getMansioniCatalogo());
      setCategorieMansioni(getCategorieMansioni());
    };
    window.addEventListener('croceoro_mansioni_updated', syncHandler);
    return () => window.removeEventListener('croceoro_mansioni_updated', syncHandler);
  }, []);
  const [formCaricaDirettivo, setFormCaricaDirettivo] = useState<CaricaConsiglioDirettivo>('Nessuna');
  const [formTelefono, setFormTelefono] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPIN, setFormPIN] = useState('');
  const [formProfiloCentrale, setFormProfiloCentrale] = useState(false);
  const [formApprovato, setFormApprovato] = useState(true);
  const [formFirmaBase64, setFormFirmaBase64] = useState<string | null>(null);
  const [formSezioneAppartenenzaId, setFormSezioneAppartenenzaId] = useState<string>('sede-massa-ronchi');

  // Tesseramento & Quote Sociali
  const [formNumeroTessera, setFormNumeroTessera] = useState('');
  const [formForzaNumeroTessera, setFormForzaNumeroTessera] = useState(false);
  const [formDataPrimaIscrizione, setFormDataPrimaIscrizione] = useState('');
  const [formTesseraRinnovata, setFormTesseraRinnovata] = useState(false);
  const [formDataRinnovoTessera, setFormDataRinnovoTessera] = useState('');
  const [formNumeroRicevuta, setFormNumeroRicevuta] = useState<number | undefined>(undefined);
  const [formNumeroRicevutaFormattato, setFormNumeroRicevutaFormattato] = useState('');
  const [formQuotaVersata, setFormQuotaVersata] = useState<number>(5.0);
  const [formTimbroCartaceoEseguito, setFormTimbroCartaceoEseguito] = useState(false);
  const [formNoteTesseramento, setFormNoteTesseramento] = useState('');
  const [formEsenteQuota, setFormEsenteQuota] = useState(false);
  const [formMotivoEsenzioneQuota, setFormMotivoEsenzioneQuota] = useState<'Benemerito' | 'Giovane' | 'LPU / MAP' | 'Onorario'>('Benemerito');

  // Foto della persona
  const [formFotoBase64, setFormFotoBase64] = useState<string | null>(null);
  const fileInputFotoRef = useRef<HTMLInputElement>(null);

  // Documento d'Identità
  const [formDocTipo, setFormDocTipo] = useState<string>('Carta d\'Identità');
  const [formDocNumero, setFormDocNumero] = useState<string>('');
  const [formDocScadenza, setFormDocScadenza] = useState<string>('');

  // Patente di Guida
  const [formPatenteInPossesso, setFormPatenteInPossesso] = useState<boolean>(false);
  const [formPatenteCategoria, setFormPatenteCategoria] = useState<string>('B');
  const [formPatenteNumero, setFormPatenteNumero] = useState<string>('');
  const [formPatenteScadenza, setFormPatenteScadenza] = useState<string>('');

  // Dotazione Vestiario & DPI
  const [formVestiario, setFormVestiario] = useState<DotazioneVestiario>(() => creaDotazioneVuota());
  const [cauzioneDrafts, setCauzioneDrafts] = useState<Record<string, string>>({});
  // Riconsegna Vestiario & DPI
  const [riconsegnaAperta, setRiconsegnaAperta] = useState(false);
  const [riconsegnaSelezionati, setRiconsegnaSelezionati] = useState<Record<string, boolean>>({});
  const [riconsegnaData, setRiconsegnaData] = useState<string>(() => formatISODateItaly());
  const [riconsegnaRimborsoStr, setRiconsegnaRimborsoStr] = useState<string>('0');
  const [riconsegnaNote, setRiconsegnaNote] = useState<string>('');

  const [erroreForm, setErroreForm] = useState('');

  // Notifica temporanea Invito Reset Password inviato
  const [notificaResetInviata, setNotificaResetInviata] = useState<{
    nome: string;
    email: string;
    resetUrl?: string;
    pinProvvisorio?: string;
    isProtectedHost?: boolean;
  } | null>(null);
  const [publicPortalUrlInput, setPublicPortalUrlInput] = useState(() => realtime.getPublicAppUrl() || getConfiguredPublicUrl());
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [avvisoTemporaneo, setAvvisoTemporaneo] = useState<string | null>(null);
  const [confermaAzioneModal, setConfermaAzioneModal] = useState<{
    titolo: string;
    messaggio: string;
    labelConferma?: string;
    variante?: 'danger' | 'warning' | 'info';
    onConferma: () => void;
  } | null>(null);

  // Modale Rapida Carica/Aggiorna Firma Trasparente (per account attivi o in secondo momento)
  const [volontarioPerFirmaRapida, setVolontarioPerFirmaRapida] = useState<Volontario | null>(null);
  const [firmaRapidaTemp, setFirmaRapidaTemp] = useState<string | null>(null);

  const apriGestioneFirmaRapida = (v: Volontario) => {
    setVolontarioPerFirmaRapida(v);
    setFirmaRapidaTemp(v.firmaBase64 || null);
  };

  // Modale Compilazione Domanda Iscrizione Socio / Volontario (con Anagrafica, Documenti, Dati Sanitari, Privacy e Delibera)
  const [volontarioPerDomandaIscrizione, setVolontarioPerDomandaIscrizione] = useState<Volontario | null>(null);
  const [modaleDomandaIscrizioneAperta, setModaleDomandaIscrizioneAperta] = useState(false);

  const apriCompilazioneDomandaIscrizione = (v: Volontario) => {
    setVolontarioPerDomandaIscrizione(v);
    setModaleDomandaIscrizioneAperta(true);
  };

  const buildVolontarioLiveDaForm = (): Volontario => {
    const vestiarioAggiornato = applicaEvidenziazioneUltimaConsegna(
      formVestiario,
      volontarioInModifica?.vestiario
    );
    const docIdentita: DocumentoIdentitaVolontario = {
      tipo: formDocTipo,
      numero: formDocNumero.trim(),
      dataScadenza: formDocScadenza
    };
    const patGuida: PatenteGuidaVolontario = {
      inPossesso: formPatenteInPossesso,
      categoria: formPatenteInPossesso ? formPatenteCategoria : undefined,
      numero: formPatenteInPossesso ? formPatenteNumero.trim() : undefined,
      dataScadenza: formPatenteInPossesso ? formPatenteScadenza : undefined
    };
    const indirizzoComp = formResidenza.indirizzo.trim()
      ? `${formResidenza.indirizzo.trim()}, ${formResidenza.cap.trim() ? formResidenza.cap.trim() + ' ' : ''}${formResidenza.comune.trim()}${formResidenza.provincia.trim() ? ' (' + formResidenza.provincia.trim().toUpperCase() + ')' : ''}`
      : (formIndirizzoResidenza.trim() || undefined);

    return {
      ...(volontarioInModifica || {}),
      id: volontarioInModifica?.id || 'draft-domanda-iscrizione',
      nome: formNome.trim() || 'Nuovo',
      cognome: formCognome.trim() || 'Richiedente',
      codiceFiscale: formCodiceFiscale.trim().toUpperCase() || undefined,
      indirizzoResidenza: indirizzoComp,
      dettaglioResidenza: formResidenza.indirizzo.trim() ? formResidenza : undefined,
      dataNascita: formDataNascita || undefined,
      sesso: formSesso,
      comuneNascita: formComuneNascita.trim() || undefined,
      provinciaNascita: formProvinciaNascita.trim().toUpperCase() || undefined,
      matricola: formMatricola.trim() || (formProfiloCentrale ? 'OP' : 'VOL'),
      qualifica: formQualifica,
      mansione: formQualifica,
      mansioni: formMansioni.length > 0 ? formMansioni : [formQualifica],
      caricaConsiglioDirettivo: formCaricaDirettivo !== 'Nessuna' ? formCaricaDirettivo : undefined,
      telefono: formTelefono.trim(),
      email: formEmail.trim(),
      pin: formPIN || '0000',
      dataRegistrazione: volontarioInModifica?.dataRegistrazione || formatDateItaly(),
      inTurno: volontarioInModifica?.inTurno || false,
      profiloCentrale: formProfiloCentrale || formQualifica === 'Operatore Centrale',
      approvato: formApprovato,
      firmaBase64: formFirmaBase64 || volontarioInModifica?.firmaBase64 || undefined,
      fotoBase64: formFotoBase64 || undefined,
      documentoIdentita: formDocNumero.trim() ? docIdentita : undefined,
      patente: formPatenteInPossesso ? patGuida : undefined,
      vestiario: vestiarioAggiornato,
      esenteQuotaAssociativa: formEsenteQuota,
      motivoEsenzioneQuota: formEsenteQuota ? formMotivoEsenzioneQuota : undefined,
      domandaIscrizioneDati: formDomandaIscrizioneDati ?? volontarioInModifica?.domandaIscrizioneDati,
      domandaIscrizioneFirmata: formDomandaIscrizioneFirmata ?? volontarioInModifica?.domandaIscrizioneFirmata,
      tesseramento: {
        ...(volontarioInModifica?.tesseramento || {
          annoRiferimento: getCurrentYearItaly(),
          rinnovata: formTesseraRinnovata
        }),
        numeroTessera: formNumeroTessera.trim() || volontarioInModifica?.tesseramento?.numeroTessera || formMatricola.trim(),
        importoVersato: formEsenteQuota ? 0 : formQuotaVersata
      }
    };
  };

  const handleSalvaDaTabDomanda = (vAgg: Volontario) => {
    setFormDomandaIscrizioneDati(vAgg.domandaIscrizioneDati);
    setFormDomandaIscrizioneFirmata(vAgg.domandaIscrizioneFirmata);
    if (vAgg.esenteQuotaAssociativa !== undefined) {
      setFormEsenteQuota(Boolean(vAgg.esenteQuotaAssociativa));
    }
    if (vAgg.motivoEsenzioneQuota) {
      setFormMotivoEsenzioneQuota(vAgg.motivoEsenzioneQuota as any);
    }
    if (vAgg.tesseramento?.numeroTessera) {
      setFormNumeroTessera(vAgg.tesseramento.numeroTessera);
    }
    if (vAgg.tesseramento?.importoVersato !== undefined) {
      setFormQuotaVersata(vAgg.tesseramento.importoVersato);
    }

    if (volontarioInModifica) {
      const aggiornati = volontari.map((v) => (v.id === volontarioInModifica.id ? { ...v, ...vAgg, id: v.id } : v));
      onAggiornaVolontari(aggiornati);
      setVolontarioInModifica((prev) => (prev ? { ...prev, ...vAgg, id: prev.id } : prev));
    }
  };

  // Operatori Centrale (fino a 10 slot oltre all'amministratore con 4451)
  const operatoriCentrale = volontari.filter(v => v.profiloCentrale || v.qualifica === 'Operatore Centrale');
  const slotLiberiCentrale = Math.max(0, 10 - operatoriCentrale.length);
  const inAttesaCount = operatoriCentrale.filter(v => !v.approvato).length;
  const bloccatiCount = volontari.filter(v => v.bloccatoPerTentativi || (v.tentativiErrati && v.tentativiErrati >= 3)).length;

  // Alert Patenti di guida in scadenza (7 giorni prima o già scadute)
  const patentiInScadenza = volontari.filter(v => {
    if (!v.patente?.inPossesso || !v.patente?.dataScadenza) return false;
    const st = calcolaStatoScadenzaPatente(v.patente.dataScadenza);
    return !!(st?.inScadenza7Giorni || st?.scaduta);
  });

  const annoCorrente = getCurrentYearItaly();

  // Soci iscritti a Ott/Nov/Dic dell'anno precedente a cui fare il timbro cartaceo senza richiedere la somma
  const iscrittiAutunnoAnnoPrecDaVidimare = volontari.filter((v) =>
    haIscrizioneOttNovDicAnnoPrecedente(v.tesseramento?.dataPrimaIscrizione, annoCorrente) &&
    !v.tesseramento?.timbroCartaceoEseguito
  );

  // Soci con tessera da rinnovare (finestra gen-apr o scaduta)
  const tessereDaRinnovareCount = volontari.filter((v) => {
    const st = calcolaStatoPeriodoRinnovo(v.tesseramento, annoCorrente);
    return !v.tesseramento?.rinnovata && st.stato !== 'non_iscritta';
  }).length;

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 400;
        const maxH = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setFormFotoBase64(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRimuoviFoto = () => {
    setFormFotoBase64(null);
    if (fileInputFotoRef.current) {
      fileInputFotoRef.current.value = '';
    }
  };

  const handleScaricaSchedaVestiario = (v: Volontario) => {
    try {
      const nomeFile = scaricaSchedaVestiarioPDF(v);
      onNotificaRadio(`📄 PDF Scheda Vestiario & DPI generata per ${v.nome} ${v.cognome} (${nomeFile})`, 'centrale');
      setAvvisoTemporaneo(`✅ Scheda Vestiario & DPI di ${v.nome} ${v.cognome} scaricata (${nomeFile})! Da stampare e firmare.`);
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
    } catch (err) {
      console.error('Errore generazione Scheda Vestiario PDF:', err);
      setErroreForm('Errore durante la generazione del PDF della Scheda Vestiario.');
    }
  };

  const handleScaricaRicevuta = async (v: Volontario) => {
    try {
      const res = await stampaEInviaRicevutaTesseramento(v, v.tesseramento?.ricevutaAttuale, volontari);
      onNotificaRadio(`🧾 Ricevuta Tesseramento PDF generata per ${v.nome} ${v.cognome} a firma automatica del Tesoriere ${res.emailInviata ? `e inviata a ${res.destinatarioEmail}` : ''}`, 'centrale');
      setAvvisoTemporaneo(`✅ Ricevuta Tesseramento PDF stampata con successo a firma del Tesoriere ${res.emailInviata ? `ed inviata via email a ${res.destinatarioEmail}!` : '!'}`);
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
    } catch (err) {
      console.error('Errore generazione Ricevuta PDF:', err);
      setErroreForm('Errore durante la generazione del PDF della Ricevuta di Tesseramento.');
    }
  };

  const handleSegnaTimbroEseguito = (volontario: Volontario) => {
    const aggiornati = volontari.map((v) => {
      if (v.id === volontario.id) {
        const tess = v.tesseramento || {
          annoRiferimento: annoCorrente,
          rinnovata: true
        };
        return {
          ...v,
          tesseramento: {
            ...tess,
            rinnovata: true,
            copertaDaIscrizioneFineAnnoPrec: true,
            importoVersato: 0,
            timbroCartaceoEseguito: true,
            dataTimbroCartaceo: formatISODateItaly()
          }
        };
      }
      return v;
    });
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(`🏷️ CENTRALE: Registrato timbro cartaceo per ${volontario.nome} ${volontario.cognome} (quota ${annoCorrente} assolta)`, 'centrale');
    setAvvisoTemporaneo(`✅ Timbro cartaceo registrato per ${volontario.nome} ${volontario.cognome} senza richiesta di somma.`);
    setTimeout(() => setAvvisoTemporaneo(null), 4000);
  };

  const handleRinnovoTesseraToggle = (checked: boolean) => {
    setFormTesseraRinnovata(checked);
    const annoCorrente = getCurrentYearItaly();
    if (checked) {
      if (!formDataRinnovoTessera) {
        setFormDataRinnovoTessera(formatISODateItaly());
      }
      if (!formNumeroRicevuta) {
        const proxNum = calcolaProssimoNumeroRicevuta(volontari, annoCorrente);
        setFormNumeroRicevuta(proxNum);
        setFormNumeroRicevutaFormattato(formattaNumeroRicevuta(proxNum, annoCorrente));
      }
      const isOp = formProfiloCentrale || formQualifica === 'Operatore Centrale';
      const calcolo = calcolaImportoDovutoTesseramento(isOp, formDataPrimaIscrizione, annoCorrente);
      setFormQuotaVersata(calcolo.importo);
    }
  };

  const handleDataPrimaIscrizioneChange = (dataVal: string) => {
    setFormDataPrimaIscrizione(dataVal);
    const annoCorrente = getCurrentYearItaly();
    const isOp = formProfiloCentrale || formQualifica === 'Operatore Centrale';
    const calcolo = calcolaImportoDovutoTesseramento(isOp, dataVal, annoCorrente);
    setFormQuotaVersata(calcolo.importo);
  };

  // Helper per collegamento Magazzino Vestiario <-> Account Vestiario & Cauzioni
  const getDefaultCauzioneChiave = (chiave: ChiaveVestiarioAccount): number => {
    if (chiave === 'pantaloni') return CAUZIONE_PANTALONI;
    if (chiave === 'giubbetto') return CAUZIONE_GIUBBETTO;
    return 0;
  };

  const trovaArticoloMagazzinoPerCapo = (
    chiave: ChiaveVestiarioAccount,
    taglia?: string,
    preferId?: string
  ): ArticoloVestiarioMagazzino | undefined => {
    if (!magazzinoVestiario || magazzinoVestiario.length === 0) return undefined;
    if (preferId) {
      const exactId = magazzinoVestiario.find(a => a.id === preferId);
      if (exactId) return exactId;
    }
    const kwMap: Record<ChiaveVestiarioAccount, string[]> = {
      tshirt: ['t-shirt', 'tshirt', 'polo'],
      felpa: ['felpa'],
      pile: ['pile'],
      pantaloni: ['pantalon'],
      giubbetto: ['giubbet', 'gilet'],
      giubbottoInvernale: ['giubbot', 'invernale', 'giacca'],
      dpi: ['dpi', 'casco', 'guanti']
    };
    const kws = kwMap[chiave] || [];
    const candidati = magazzinoVestiario.filter(a => {
      if (a.chiaveVestiarioAccount) return a.chiaveVestiarioAccount === chiave;
      const nm = `${a.nome || ''} ${a.categoria || ''}`.toLowerCase();
      return kws.some(k => nm.includes(k));
    });
    if (candidati.length === 0) return undefined;
    if (taglia) {
      const exactTaglia = candidati.find(
        c => String(c.taglia || '').toUpperCase() === String(taglia).toUpperCase()
      );
      if (exactTaglia) return exactTaglia;
    }
    return candidati[0];
  };

  const getCauzionePrecaricataCapo = (
    chiave: ChiaveVestiarioAccount,
    taglia?: string,
    preferId?: string
  ): { cauzione: number; articolo?: ArticoloVestiarioMagazzino } => {
    const articolo = trovaArticoloMagazzinoPerCapo(chiave, taglia, preferId);
    if (articolo && typeof articolo.cauzione === 'number' && !Number.isNaN(articolo.cauzione)) {
      return { cauzione: Math.max(0, articolo.cauzione), articolo };
    }
    return { cauzione: getDefaultCauzioneChiave(chiave), articolo };
  };

  const notificaForzaturaCauzione = (params: {
    capoNome: string;
    dettaglio: string;
    importoPrecedente: number;
    nuovoImporto: number;
    esente?: boolean;
  }) => {
    const volNome = `${formNome.trim()} ${formCognome.trim()}`.trim() || 'Nuovo Account';
    const opNome = operatoreCorrente || 'Amministratore';
    const testoAllarme = `⚠️ FORZATURA CAUZIONE VESTIARIO (Avviso Presidente & Tesoriere): ${opNome} ha modificato "${params.capoNome}" per ${volNome} da € ${params.importoPrecedente.toFixed(2)} a ${
      params.esente ? 'ESENTE CAUZIONE (€ 0,00)' : `€ ${params.nuovoImporto.toFixed(2)}`
    }. ${params.dettaglio}`;
    onNotificaRadio(testoAllarme, 'allarme');

    fetch(`${realtime.getApiBaseUrl()}/api/notifica-forzatura-cauzione`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        volontarioId: volontarioInModifica?.id || 'nuovo-account',
        volontarioNome: volNome,
        operatore: opNome,
        capoNome: params.capoNome,
        dettaglio: params.dettaglio,
        importoPrecedente: params.importoPrecedente,
        nuovoImporto: params.nuovoImporto,
        esente: Boolean(params.esente),
        volontari
      })
    }).catch(() => {});
  };

  const applicaModificaCauzioneConForzatura = (params: {
    capoNome: string;
    importoAttesoPrecaricato: number;
    nuovoImporto: number;
    esente: boolean;
    onApplica: () => void;
  }) => {
    const diffImporto = Math.abs(params.nuovoImporto - params.importoAttesoPrecaricato) > 0.009;
    const isForzatura = (params.esente && params.importoAttesoPrecaricato > 0) || (!params.esente && diffImporto);
    if (!isForzatura) {
      params.onApplica();
      return;
    }
    setConfermaAzioneModal({
      titolo: 'Forzatura Importo Cauzione',
      messaggio:
        `Sei davvero sicuro di forzare l'importo?\n\n` +
        `Voce: ${params.capoNome}\n` +
        `Importo precaricato dal sistema/magazzino: € ${params.importoAttesoPrecaricato.toFixed(2).replace('.', ',')}\n` +
        `Nuovo importo richiesto: ${params.esente ? 'ESENTE (€ 0,00)' : `€ ${params.nuovoImporto.toFixed(2).replace('.', ',')}`}\n\n` +
        `Confermando, verrà inviata immediatamente una notifica ed una email ufficiale al Presidente e al Tesoriere.`,
      labelConferma: 'Sì, Forza Importo e Avvisa',
      variante: 'warning',
      onConferma: () => {
        params.onApplica();
        notificaForzaturaCauzione({
          capoNome: params.capoNome,
          dettaglio: 'Forzatura manuale nella dotazione Vestiario & DPI account.',
          importoPrecedente: params.importoAttesoPrecaricato,
          nuovoImporto: params.esente ? 0 : params.nuovoImporto,
          esente: params.esente
        });
        setAvvisoTemporaneo('✅ Importo cauzione aggiornato e segnalato a Presidente e Tesoriere.');
        setTimeout(() => setAvvisoTemporaneo(null), 5000);
      }
    });
  };

  const calcolaElencoCapiConsegnati = (vest: DotazioneVestiario): Array<{
    key: string;
    nome: string;
    taglia?: string;
    cauzione: number;
    esente: boolean;
    articoloMagazzinoId?: string;
    chiaveAccount: ChiaveVestiarioAccount;
    tshirtIdx?: number;
  }> => {
    const list: Array<{
      key: string;
      nome: string;
      taglia?: string;
      cauzione: number;
      esente: boolean;
      articoloMagazzinoId?: string;
      chiaveAccount: ChiaveVestiarioAccount;
      tshirtIdx?: number;
    }> = [];
    (vest.tshirt || []).forEach((t, idx) => {
      if (t?.consegnato) {
        const pre = getCauzionePrecaricataCapo('tshirt', t.taglia, t.articoloMagazzinoId).cauzione;
        const c = t.esenteCauzione ? 0 : (typeof t.cauzioneApplicata === 'number' ? t.cauzioneApplicata : pre);
        list.push({
          key: `tshirt-${idx}`,
          nome: `T-Shirt Istituzionale #${idx + 1}`,
          taglia: t.taglia,
          cauzione: c,
          esente: Boolean(t.esenteCauzione),
          articoloMagazzinoId: t.articoloMagazzinoId,
          chiaveAccount: 'tshirt',
          tshirtIdx: idx
        });
      }
    });
    const singoli: Array<{ chiave: 'felpa' | 'pile' | 'pantaloni' | 'giubbetto' | 'giubbottoInvernale'; nome: string }> = [
      { chiave: 'felpa', nome: 'Felpa con Zip' },
      { chiave: 'pile', nome: 'Pile' },
      { chiave: 'pantaloni', nome: 'Pantaloni Operativi' },
      { chiave: 'giubbetto', nome: 'Giubbetto Operativo' },
      { chiave: 'giubbottoInvernale', nome: 'Giubbotto Invernale' }
    ];
    singoli.forEach(({ chiave, nome }) => {
      const capo = vest[chiave];
      if (capo?.consegnato) {
        const pre = getCauzionePrecaricataCapo(chiave, capo.taglia, capo.articoloMagazzinoId).cauzione;
        const c = capo.esenteCauzione ? 0 : (typeof capo.cauzioneApplicata === 'number' ? capo.cauzioneApplicata : pre);
        list.push({
          key: chiave,
          nome,
          taglia: capo.taglia,
          cauzione: c,
          esente: Boolean(capo.esenteCauzione),
          articoloMagazzinoId: capo.articoloMagazzinoId,
          chiaveAccount: chiave
        });
      }
    });
    return list;
  };

  // Helper per gestione stato Vestiario nel form
  const toggleTShirtConsegnato = (idx: number, consegnato: boolean) => {
    const oggiIso = formatISODateItaly();
    const tagliaCorr = formVestiario.tshirt?.[idx]?.taglia || 'L';
    const { cauzione, articolo } = getCauzionePrecaricataCapo('tshirt', tagliaCorr, formVestiario.tshirt?.[idx]?.articoloMagazzinoId);
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      if (!copia.tshirt || copia.tshirt.length < 3) {
        copia.tshirt = [
          { id: 1, consegnato: false },
          { id: 2, consegnato: false },
          { id: 3, consegnato: false }
        ];
      }
      copia.tshirt[idx].consegnato = consegnato;
      if (consegnato) {
        if (!copia.tshirt[idx].dataConsegna) copia.tshirt[idx].dataConsegna = oggiIso;
        if (!copia.tshirt[idx].taglia) copia.tshirt[idx].taglia = tagliaCorr;
        if (copia.tshirt[idx].cauzioneApplicata === undefined) {
          copia.tshirt[idx].cauzioneApplicata = cauzione;
        }
        if (articolo && !copia.tshirt[idx].articoloMagazzinoId) {
          copia.tshirt[idx].articoloMagazzinoId = articolo.id;
        }
      }
      return copia;
    });
    if (consegnato) {
      setCauzioneDrafts(prev => ({
        ...prev,
        [`tshirt-${idx}`]: prev[`tshirt-${idx}`] ?? String(cauzione)
      }));
    }
  };

  const setTShirtTaglia = (idx: number, taglia: TagliaVestiario) => {
    const articolo = trovaArticoloMagazzinoPerCapo('tshirt', taglia);
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      copia.tshirt[idx].taglia = taglia;
      if (articolo) copia.tshirt[idx].articoloMagazzinoId = articolo.id;
      return copia;
    });
  };

  const setTShirtData = (idx: number, data: string) => {
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      copia.tshirt[idx].dataConsegna = data;
      return copia;
    });
  };

  const toggleCapoConsegnato = (
    chiave: 'felpa' | 'pile' | 'pantaloni' | 'giubbetto' | 'giubbottoInvernale',
    consegnato: boolean
  ) => {
    const oggiIso = formatISODateItaly();
    const tagliaCorr = formVestiario[chiave]?.taglia || 'L';
    const { cauzione, articolo } = getCauzionePrecaricataCapo(chiave, tagliaCorr, formVestiario[chiave]?.articoloMagazzinoId);
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      if (!copia[chiave]) copia[chiave] = { consegnato: false };
      copia[chiave].consegnato = consegnato;
      if (consegnato) {
        if (!copia[chiave].dataConsegna) copia[chiave].dataConsegna = oggiIso;
        if (!copia[chiave].taglia) copia[chiave].taglia = tagliaCorr;
        if (copia[chiave].cauzioneApplicata === undefined) {
          copia[chiave].cauzioneApplicata = cauzione;
        }
        if (articolo && !copia[chiave].articoloMagazzinoId) {
          copia[chiave].articoloMagazzinoId = articolo.id;
        }
      }
      return copia;
    });
    if (consegnato) {
      setCauzioneDrafts(prev => ({
        ...prev,
        [chiave]: prev[chiave] ?? String(cauzione)
      }));
    }
  };

  const setCapoTaglia = (
    chiave: 'felpa' | 'pile' | 'pantaloni' | 'giubbetto' | 'giubbottoInvernale',
    taglia: TagliaVestiario
  ) => {
    const articolo = trovaArticoloMagazzinoPerCapo(chiave, taglia);
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      copia[chiave].taglia = taglia;
      if (articolo) copia[chiave].articoloMagazzinoId = articolo.id;
      return copia;
    });
  };

  const setCapoData = (
    chiave: 'felpa' | 'pile' | 'pantaloni' | 'giubbetto' | 'giubbottoInvernale',
    data: string
  ) => {
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      copia[chiave].dataConsegna = data;
      return copia;
    });
  };

  const setVestiarioIban = (iban: string) => {
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      copia.ibanRestituzioneCauzione = iban.toUpperCase().replace(/\s/g, '');
      return copia;
    });
  };

  const eseguiRiconsegnaConfermata = (importoFinale: number, importoCalcolato: number, capiDaRestituire: ReturnType<typeof calcolaElencoCapiConsegnati>) => {
    const dataRest = riconsegnaData || formatISODateItaly();
    const volTarget = buildVolontarioLiveDaForm();
    const capiDettaglio: CapoRestituzioneDettaglio[] = capiDaRestituire.map(c => ({
      nome: c.nome,
      taglia: c.taglia,
      quantita: 1,
      restituito: true,
      cauzioneUnitaria: c.esente ? 0 : c.cauzione,
      esenteCauzione: c.esente,
      importoRimborso: c.esente ? 0 : c.cauzione
    }));
    const storicoVoce: RiconsegnaVestiarioStoricoItem = {
      id: `ric-vest-${Date.now()}`,
      dataRestituzione: dataRest,
      capiRestituiti: capiDaRestituire.map(c => `${c.nome}${c.taglia ? ` (Tg. ${c.taglia})` : ''}`),
      importoRimborsoCalcolato: importoCalcolato,
      importoRimborsoFinale: importoFinale,
      forzatoManualmente: Math.abs(importoFinale - importoCalcolato) > 0.009,
      ibanBonifico: formVestiario.ibanRestituzioneCauzione || '',
      operatore: operatoreCorrente || 'Amministratore',
      annotazioni: riconsegnaNote.trim() || undefined
    };

    // 1. Aggiorna formVestiario (segna come non consegnato e salva storico)
    const copiaVest = JSON.parse(JSON.stringify(formVestiario)) as DotazioneVestiario;
    capiDaRestituire.forEach(c => {
      if (c.tshirtIdx !== undefined && copiaVest.tshirt?.[c.tshirtIdx]) {
        copiaVest.tshirt[c.tshirtIdx].consegnato = false;
        copiaVest.tshirt[c.tshirtIdx].isUltimaConsegna = false;
      } else if (c.chiaveAccount !== 'tshirt' && c.chiaveAccount !== 'dpi') {
        const k = c.chiaveAccount;
        if (copiaVest[k]) {
          copiaVest[k].consegnato = false;
          copiaVest[k].isUltimaConsegna = false;
        }
      }
    });
    copiaVest.storicoRiconsegne = [storicoVoce, ...(copiaVest.storicoRiconsegne || [])];
    setFormVestiario(copiaVest);

    // 2. Ripristina giacenza (+1) in Magazzino e registra movimento 'Reso a Magazzino'
    if (onAggiornaMagazzinoVestiario && magazzinoVestiario.length > 0) {
      let nextMag = [...magazzinoVestiario];
      const nuoviMov: MovimentoMagazzino[] = [];
      const oraMov = formatDateTimeItaly(undefined, false).slice(0, 16);
      capiDaRestituire.forEach((c, idxMov) => {
        const art = trovaArticoloMagazzinoPerCapo(c.chiaveAccount, c.taglia, c.articoloMagazzinoId);
        if (art) {
          nextMag = nextMag.map(item =>
            item.id === art.id ? { ...item, giacenzaAttuale: (item.giacenzaAttuale || 0) + 1 } : item
          );
          nuoviMov.push({
            id: `mov-reso-${Date.now()}-${idxMov}`,
            data: oraMov,
            tipo: 'Reso a Magazzino',
            articoloNome: `${art.nome}${c.taglia ? ` (Tg. ${c.taglia})` : ''}`,
            quantita: 1,
            destinatarioOOrigine: `${volTarget.cognome} ${volTarget.nome}`.trim(),
            operatore: operatoreCorrente || 'Amministratore',
            note: `Riconsegna Vestiario & DPI — Rimborso € ${importoFinale.toFixed(2)}`
          });
        }
      });
      onAggiornaMagazzinoVestiario(nextMag);
      if (onAggiornaMovimentiMagazzino && nuoviMov.length > 0) {
        onAggiornaMovimentiMagazzino([...nuoviMov, ...movimentiMagazzino]);
      }
    }

    // 3. Se stiamo modificando un volontario esistente, persisti subito i dati aggiornati
    if (volontarioInModifica) {
      const aggiornati = volontari.map(v =>
        v.id === volontarioInModifica.id ? { ...v, vestiario: copiaVest } : v
      );
      onAggiornaVolontari(aggiornati);
      setVolontarioInModifica(prev => (prev ? { ...prev, vestiario: copiaVest } : prev));
    }

    // 4. Genera e scarica il PDF Verbale di Restituzione Divisa precompilato
    scaricaPDFRestituzioneDivisa(
      { ...volTarget, vestiario: copiaVest },
      {
        dataRestituzione: dataRest,
        ibanBonifico: formVestiario.ibanRestituzioneCauzione || '',
        intestatarioBonifico: `${volTarget.cognome} ${volTarget.nome}`.trim(),
        restituitoPantaloni: capiDaRestituire.some(c => c.chiaveAccount === 'pantaloni'),
        restituitoGiubbetto: capiDaRestituire.some(c => c.chiaveAccount === 'giubbetto'),
        altriCapiRestituiti: capiDaRestituire
          .filter(c => c.chiaveAccount !== 'pantaloni' && c.chiaveAccount !== 'giubbetto')
          .map(c => `${c.nome}${c.taglia ? ` (${c.taglia})` : ''}`),
        capiDettaglio,
        cifraRimborsoTotale: importoFinale,
        annotazioniAdmin: riconsegnaNote.trim() || undefined,
        amministratoreNome: operatoreCorrente || 'Amministratore'
      }
    );

    onNotificaRadio(
      `📦 RICONSEGNA VESTIARIO & DPI: ${volTarget.nome} ${volTarget.cognome} ha riconsegnato ${capiDaRestituire.length} capi. Rimborso cauzione: € ${importoFinale.toFixed(2)}.`,
      'centrale'
    );
    setAvvisoTemporaneo(`✅ Riconsegna completata per ${volTarget.nome} ${volTarget.cognome}, magazzino aggiornato e Verbale PDF scaricato!`);
    setTimeout(() => setAvvisoTemporaneo(null), 5000);
    setRiconsegnaSelezionati({});
    setRiconsegnaNote('');
    setRiconsegnaAperta(false);
  };

  const handleConfermaRiconsegnaVestiario = () => {
    const capiConsegnati = calcolaElencoCapiConsegnati(formVestiario);
    const capiDaRestituire = capiConsegnati.filter(c => riconsegnaSelezionati[c.key]);
    if (capiDaRestituire.length === 0) {
      setAvvisoTemporaneo('⚠️ Seleziona almeno un capo o DPI consegnato da riconsegnare.');
      setTimeout(() => setAvvisoTemporaneo(null), 4000);
      return;
    }
    const importoCalcolato = capiDaRestituire.reduce((s, c) => s + (c.esente ? 0 : c.cauzione), 0);
    const parsedFinale = Number(String(riconsegnaRimborsoStr).replace(',', '.'));
    const importoFinale = Number.isNaN(parsedFinale) ? importoCalcolato : Math.max(0, parsedFinale);
    const forzato = Math.abs(importoFinale - importoCalcolato) > 0.009;

    if (forzato) {
      setConfermaAzioneModal({
        titolo: 'Forzatura Importo Restituzione Cauzione',
        messaggio:
          `Sei davvero sicuro di forzare l'importo?\n\n` +
          `Rimborso calcolato automaticamente dai capi riconsegnati: € ${importoCalcolato.toFixed(2).replace('.', ',')}\n` +
          `Importo forzato inserito: € ${importoFinale.toFixed(2).replace('.', ',')}\n\n` +
          `Confermando, verrà inviata notifica ed email ufficiale al Presidente e al Tesoriere e verrà generato il Verbale PDF di restituzione.`,
        labelConferma: 'Sì, Forza Importo & Genera PDF',
        variante: 'warning',
        onConferma: () => {
          notificaForzaturaCauzione({
            capoNome: `Restituzione Divisa (${capiDaRestituire.length} capi)`,
            dettaglio: `Forzatura importo rimborso alla riconsegna (${capiDaRestituire.map(c => c.nome).join(', ')}).`,
            importoPrecedente: importoCalcolato,
            nuovoImporto: importoFinale,
            esente: importoFinale === 0
          });
          eseguiRiconsegnaConfermata(importoFinale, importoCalcolato, capiDaRestituire);
        }
      });
      return;
    }

    eseguiRiconsegnaConfermata(importoFinale, importoCalcolato, capiDaRestituire);
  };

  const handleUploadDocumentoFirmatoForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErroreForm("Il file selezionato supera i 15MB. Carica un file PDF o immagine più compatto.");
      setAvvisoTemporaneo("⚠️ Il file selezionato supera i 15MB. Carica un file PDF o immagine più compatto.");
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const dimensioneStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      setFormVestiario(prev => {
        const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
        copia.documentoFirmato = {
          fileBase64: base64,
          nomeFile: file.name,
          dataUpload: `${formatDateItaly()} ore ${formatDateTimeItaly(undefined, false).split(' ')[1]}`,
          dimensione: dimensioneStr
        };
        return copia;
      });

      setAvvisoTemporaneo(`✅ Documento stampato e firmato "${file.name}" caricato! Ricorda di salvare per confermare.`);
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const rimuoviDocumentoFirmatoForm = () => {
    setFormVestiario(prev => {
      const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
      copia.documentoFirmato = undefined;
      return copia;
    });
    setAvvisoTemporaneo('Documento firmato rimosso dal form. Salva per confermare.');
    setTimeout(() => setAvvisoTemporaneo(null), 4000);
  };

  const scaricaDocumentoFirmato = (fileBase64: string, nomeFile: string) => {
    const link = document.createElement('a');
    link.href = fileBase64;
    link.download = nomeFile || 'Scheda_Vestiario_Firmata.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const azzeraSbagliESblocca = (v: Volontario) => {
    const aggiornati = volontari.map(item =>
      item.id === v.id
        ? { ...item, tentativiErrati: 0, bloccatoPerTentativi: false, dataBlocco: undefined }
        : item
    );
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(
      `✅ SBLOCCO SICUREZZA: L'Amministratore ha azzerato gli errori e sbloccato l'account di ${v.nome} ${v.cognome} (${v.qualifica}).`,
      'centrale'
    );
    setAvvisoTemporaneo(`✅ Errori PIN azzerati con successo! L'account ${v.nome} ${v.cognome} è stato sbloccato.`);
    setTimeout(() => setAvvisoTemporaneo(null), 5000);
  };

  const azzeraESpedisciInvitoReset = (v: Volontario) => {
    const dataOra = formatDateTimeItaly(undefined, false);
    
    // 1. Azzeramento errori, sblocco e impostazione richiesta reset password
    const aggiornati = volontari.map(item =>
      item.id === v.id
        ? {
            ...item,
            tentativiErrati: 0,
            bloccatoPerTentativi: false,
            dataBlocco: undefined,
            richiedeResetPassword: true,
            dataRichiestaResetPassword: dataOra
          }
        : item
    );
    onAggiornaVolontari(aggiornati);

    // 2. Notifica radio
    onNotificaRadio(
      `🔐 SBLOCCO & RESET: L'Amministratore ha sbloccato ${v.nome} ${v.cognome} e avviato l'invito al reset della password/PIN.`,
      'centrale'
    );

    // 3. Prepara e invia email se presente (usa emailNotifiche se impostata dal profilo, altrimenti email anagrafica)
    const destinatarioEmail = getNotificationEmailForVolontario(v);
    if (destinatarioEmail && destinatarioEmail.includes('@')) {
      const oggetto = encodeURIComponent(`Croce Oro Massa Carrara - Sblocco Account e Invito al Reset della Password / PIN (${v.nome} ${v.cognome})`);
      const corpo = encodeURIComponent(
        `Gentile ${v.nome} ${v.cognome},\n\n` +
        `A seguito del blocco di sicurezza per 3 tentativi PIN errati, l'Amministratore ha sbloccato il tuo account e ti invita a reimpostare il tuo codice PIN personale.\n\n` +
        `Dettagli Account:\n` +
        `• Nominativo: ${v.nome} ${v.cognome}\n` +
        `• Ruolo: ${v.qualifica}\n` +
        `• Matricola: ${v.matricola || 'N/D'}\n` +
        `• Data operazione: ${dataOra}\n\n` +
        `Come reimpostare il tuo PIN:\n` +
        `1. Apri l'app Croce Oro Massa Carrara\n` +
        `2. Clicca su "Hai ricevuto un invito a resettare la password/PIN?"\n` +
        `3. Inserisci il tuo recapito e imposta il tuo nuovo codice a 4 cifre.\n\n` +
        `Cordiali saluti,\nCentrale Operativa • Croce Oro Massa Carrara OdV`
      );
      try {
        const a = document.createElement('a');
        a.href = `mailto:${destinatarioEmail}?subject=${oggetto}&body=${corpo}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {}
    }

    setNotificaResetInviata({
      nome: `${v.nome} ${v.cognome}`,
      email: destinatarioEmail || 'Email non registrata'
    });
    setTimeout(() => setNotificaResetInviata(null), 6000);
  };

  const approvaOperatoreCentrale = (operatore: Volontario) => {
    const aggiornati = volontari.map(v => v.id === operatore.id ? { ...v, approvato: true } : v);
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(`✅ APPROVAZIONE CENTRALE: Operatore ${operatore.nome} ${operatore.cognome} approvato dall'Amministratore ed abilitato all'accesso.`, 'centrale');
  };

  const sospendiOperatoreCentrale = (operatore: Volontario) => {
    const aggiornati = volontari.map(v => v.id === operatore.id ? { ...v, approvato: false } : v);
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(`⚠️ ACCESSO SOSPESO: L'operatore ${operatore.nome} ${operatore.cognome} è stato sospeso dall'accesso alla Centrale.`, 'allarme');
  };

  /**
   * Modifica la carica nel Consiglio Direttivo dell'operatore centrale in qualsiasi momento.
   * Cariche ammesse: Presidente / Legale Rappresentante, Vicepresidente, Tesoriere, Segretario, Consigliere.
   * Possono esserci più persone con lo stesso ruolo.
   */
  const cambiaCaricaConsiglioDirettivo = (operatore: Volontario, nuovaCarica: CaricaConsiglioDirettivo) => {
    const caricaEffettiva = nuovaCarica !== 'Nessuna' ? nuovaCarica : undefined;
    const aggiornati = volontari.map(v =>
      v.id === operatore.id
        ? { ...v, caricaConsiglioDirettivo: caricaEffettiva }
        : v
    );
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(
      `CONSIGLIO DIRETTIVO: ${operatore.nome} ${operatore.cognome} -> Carica assegnata: "${nuovaCarica}"`,
      'centrale'
    );
  };

  /**
   * Eleva un volontario a Operatore di Centrale (e abilita l'assegnazione nel Consiglio Direttivo).
   */
  const elevaAOperatoreCentrale = (volontario: Volontario) => {
    const aggiornati = volontari.map(v =>
      v.id === volontario.id
        ? {
            ...v,
            profiloCentrale: true,
            qualifica: 'Operatore Centrale',
            approvato: true,
            caricaConsiglioDirettivo: v.caricaConsiglioDirettivo || 'Consigliere'
          }
        : v
    );
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(
      `⭐ PROMOZIONE: ${volontario.nome} ${volontario.cognome} è stato ELEVATO ad OPERATORE CENTRALE ed inserito nel Consiglio Direttivo!`,
      'centrale'
    );
  };

  /**
   * Retrocede un operatore di centrale a volontario operativo.
   * In caso di retrocessione dell'operatore centrale, NON fa più parte del consiglio direttivo!
   */
  const retrocediAVolontario = (operatore: Volontario) => {
    const aggiornati = volontari.map(v =>
      v.id === operatore.id
        ? {
            ...v,
            profiloCentrale: false,
            qualifica: 'Soccorritore',
            caricaConsiglioDirettivo: undefined // non fa più parte del consiglio direttivo
          }
        : v
    );
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(
      `⬇️ RETROCESSIONE: ${operatore.nome} ${operatore.cognome} è stato retrocesso a Volontario Soccorso e rimosso dal Consiglio Direttivo.`,
      'centrale'
    );
  };

  const invitaAResettarePassword = async (v: Volontario) => {
    const destinatarioEmail = getNotificationEmailForVolontario(v);
    if (!destinatarioEmail || !destinatarioEmail.includes('@')) {
      setAvvisoTemporaneo(`Impossibile inviare l'invito: l'account ${v.nome} ${v.cognome} non ha un indirizzo email valido registrato.`);
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
      return;
    }

    const dataOra = formatDateTimeItaly(undefined, false);
    const pinProvv = v.pinProvvisorio && v.pin && /^\d{4}$/.test(String(v.pin))
      ? String(v.pin)
      : String(Math.floor(1000 + Math.random() * 9000));
    const token = generaTokenResetPinSicuro();

    const updatedVol: Volontario = {
      ...v,
      pin: pinProvv,
      pinProvvisorio: true,
      richiedeResetPassword: true,
      resetToken: token,
      dataRichiestaResetPassword: dataOra,
      dataInvioInvitoReset: dataOra
    };

    // 1. Aggiorna lo stato nel database con il flag di richiesta reset password/PIN e nuovo token univoco
    const aggiornati = volontari.map(item =>
      item.id === v.id ? updatedVol : item
    );
    onAggiornaVolontari(aggiornati);

    // 2. Crea ticket zero-PII & aggiorna indice hash verifica profilo su Cloud Firestore (nessun account Google richiesto)
    creaTicketResetPinFirestore({
      tokenId: token,
      volunteerId: v.id,
      displayName: `${v.nome} ${v.cognome}`.trim(),
      qualifica: v.qualifica || 'Operatore',
      pinProvvisorio: pinProvv,
    }).catch((err) => {
      console.warn('[ResetPIN] Creazione ticket Firestore non riuscita (verrà usato backend/locale):', err?.message || err);
    });
    syncPinResetProfilesFirestore([updatedVol]).catch(() => {});

    const publicBaseUrl = realtime.getPublicAppUrl() || getConfiguredPublicUrl();
    const { url: linkLocaleFallback, isPublicNonGoogle } = buildPublicResetUrl({
      id: v.id,
      token,
      baseUrlOverride: publicBaseUrl
    });

    let resetUrlFinale = isPublicNonGoogle ? linkLocaleFallback : '';
    let resolvedProtectedHost = !isPublicNonGoogle;

    // 3. Invia email automatica via server con mittente ufficiale sistemiautomatizzati@croceoro.org + allegato HTML autonomo
    try {
      const res = await fetch('/api/invia-email-invito-reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: v.id,
          nome: v.nome,
          cognome: v.cognome,
          qualifica: v.qualifica,
          email: destinatarioEmail,
          pinProvvisorio: pinProvv,
          token: token,
          origin: window.location.origin,
          publicBaseUrl
        })
      });
      const data = await res.json();
      if (typeof data?.isProtectedHost === 'boolean') {
        resolvedProtectedHost = data.isProtectedHost;
      }
      if (!resolvedProtectedHost && data?.resetUrl) {
        resetUrlFinale = data.resetUrl;
      } else if (resolvedProtectedHost) {
        resetUrlFinale = '';
      }
      if (data.success) {
        onNotificaRadio(
          `📧 INVITO RESET: Inviata email con PIN provvisorio e attivazione senza account Google a ${v.nome} ${v.cognome} (${destinatarioEmail}) da sistemiautomatizzati@croceoro.org.`,
          'centrale'
        );
        setAvvisoTemporaneo(`✅ Email con PIN provvisorio e istruzioni senza Google inviata con successo a ${destinatarioEmail}!`);
      } else {
        setAvvisoTemporaneo(`⚠️ Invito generato per ${v.nome} ${v.cognome}.`);
      }
    } catch {
      setAvvisoTemporaneo(`✅ Invito Cloud generato con successo per ${v.nome} ${v.cognome}.`);
    }

    setNotificaResetInviata({
      nome: `${v.nome} ${v.cognome}`,
      email: destinatarioEmail,
      resetUrl: resetUrlFinale,
      pinProvvisorio: pinProvv,
      isProtectedHost: resolvedProtectedHost
    });
    setLinkCopiato(false);

    setTimeout(() => {
      setAvvisoTemporaneo(null);
    }, 6000);
  };

  const calcolaProssimaMatricola = (isOperatoreCentrale: boolean): string => {
    const usate = new Set(
      volontari
        .map((v) => String(v.matricola || '').trim().toUpperCase())
        .filter(Boolean)
    );
    if (isOperatoreCentrale) {
      for (let n = 1; n <= 99; n++) {
        const cand = n < 10 ? `OP-0${n}` : `OP-${n}`;
        if (!usate.has(cand)) return cand;
      }
      return `OP-${Date.now().toString().slice(-3)}`;
    }
    for (let tent = 0; tent < 50; tent++) {
      const cand = `VOL-${Math.floor(100 + Math.random() * 900)}`;
      if (!usate.has(cand)) return cand;
    }
    return `VOL-${Date.now().toString().slice(-4)}`;
  };

  const apriAggiungiOperatoreCentrale = () => {
    if (operatoriCentrale.length >= 10) {
      setAvvisoTemporaneo("Tutti i 10 slot per Operatori Centrale sono già occupati. Elimina un operatore esistente per liberare uno slot.");
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
      return;
    }
    setVolontarioInModifica(null);
    setFormNome('');
    setFormCognome('');
    setFormMatricola(calcolaProssimaMatricola(true));
    setFormQualifica('Operatore Centrale');
    setFormTelefono('');
    setFormEmail('');
    setFormPIN(String(Math.floor(1000 + Math.random() * 9000)));
    setFormProfiloCentrale(true);
    setFormApprovato(true);
    setFormFirmaBase64(null);
    setFormMacroCategorie(['centrale']);
    setFormSezioneAppartenenzaId('sede-massa-ronchi');
    setFormVestiario(creaDotazioneVuota());
    setCauzioneDrafts({});
    setRiconsegnaAperta(false);
    setRiconsegnaSelezionati({});
    setRiconsegnaData(formatISODateItaly());
    setRiconsegnaRimborsoStr('0');
    setRiconsegnaNote('');

    // Tesseramento operatore: progressivo calcolato
    const infoTessOp = calcolaProssimoNumeroTessera(volontari, true);
    setFormNumeroTessera(infoTessOp.prossimoNumeroTessera);
    setFormForzaNumeroTessera(false);

    setErroreForm('');
    setModaleEditAperta(true);
  };

  useEffect(() => {
    if (!isOpen) {
      setModaleEditAperta(false);
      return;
    }
    if (!initialAction) return;
    if (initialAction.mode === 'nuovo') {
      apriAggiungiVolontario();
      if (initialAction.tab) {
        setTabModaleEdit(initialAction.tab);
      }
    } else if (initialAction.mode === 'fascicolo' && initialAction.volontario) {
      const target =
        volontari.find((v) => v.id === initialAction.volontario?.id) || initialAction.volontario;
      apriModificaVolontario(target);
      if (initialAction.tab) {
        setTabModaleEdit(initialAction.tab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialAction]);

  const chiudiModaleEdit = () => {
    setModaleEditAperta(false);
    if (initialAction?.directOnly) {
      onClose();
    }
  };

  if (!isOpen) return null;

  if (!isAdminEffettivo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div
          className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 text-center text-white max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200"
        >
          <div
            className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400"
          >
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-amber-400">{titoloDbVolontari}</h3>
            <p className="text-xs mt-1 leading-relaxed text-slate-300">
              Gestione Account, PIN e Tesseramento riservati ad <strong>Amministratore e Presidente</strong> (stessi privilegi ed autorizzazioni).
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pinInserito = pinAdminInput.trim();
              const pres = volontari.find(
                v => (v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
                     (v.qualifica && v.qualifica.toLowerCase().includes('presidente'))
              );
              const isPinPres = Boolean(pres && pres.pin === pinInserito);

              if (pinInserito === '4451' || isPinPres) {
                setAdminSbloccato(true);
                setErrorePinAdmin(null);
                setPinAdminInput('');
                onNotificaRadio(
                  isPinPres
                    ? `🔓 SBLOCCO: Database sbloccato dal Presidente (${pres?.nome} ${pres?.cognome}).`
                    : '🔓 SBLOCCO: Database sbloccato con credenziali di Amministrazione.',
                  'centrale'
                );
              } else {
                setErrorePinAdmin('PIN non corretto. Inserisci il codice riservato Amministratore o Presidente.');
                setPinAdminInput('');
              }
            }}
            autoComplete="off"
            className="space-y-3 pt-2 text-left"
          >
            <div>
              <label className="block text-[11px] font-black uppercase mb-1 text-slate-300">
                Digita PIN Riservato (Amministratore o Presidente)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoFocus
                autoComplete="one-time-code"
                name="codice_sicurezza_sblocco_db"
                id="codice_sicurezza_sblocco_db"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                value={pinAdminInput}
                onChange={(e) => {
                  setPinAdminInput(e.target.value);
                  setErrorePinAdmin(null);
                }}
                placeholder="••••"
                style={{
                  WebkitTextSecurity: 'disc',
                  MozTextSecurity: 'disc',
                  backgroundColor: '#020617',
                  color: '#ffffff',
                  borderColor: '#334155'
                } as React.CSSProperties}
                className="w-full p-2.5 rounded-xl font-mono text-center text-base tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-950 border border-slate-700 text-white"
              />
            </div>

            {errorePinAdmin && (
              <p className="text-xs font-bold text-red-300 bg-red-950/80 p-2 rounded-xl border border-red-500/50 text-center">
                {errorePinAdmin}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 text-xs font-bold rounded-xl uppercase transition-all cursor-pointer border bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl uppercase shadow-md active:scale-95 transition-all cursor-pointer border-2 border-amber-700"
                style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
              >
                Sblocca ed Entra
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Filtro volontari con ricerca testuale e filtro per livello/categoria
  const volontariFiltrati = volontari.filter((v) => {
    const q = ricerca.toLowerCase().trim();
    const matchText = !q || (
      v.nome.toLowerCase().includes(q) ||
      v.cognome.toLowerCase().includes(q) ||
      v.qualifica.toLowerCase().includes(q) ||
      (v.matricola && v.matricola.toLowerCase().includes(q)) ||
      (Array.isArray(v.mansioni) && v.mansioni.some(m => m.toLowerCase().includes(q))) ||
      (v.mansione && v.mansione.toLowerCase().includes(q)) ||
      v.telefono.includes(q) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      v.pin.includes(q)
    );
    if (!matchText) return false;

    if (filtroLivello === 'volontari') {
      return !v.profiloCentrale && v.qualifica !== 'Operatore Centrale';
    }
    if (filtroLivello === 'operatori') {
      return v.profiloCentrale || v.qualifica === 'Operatore Centrale';
    }
    if (filtroLivello === 'attesa') {
      return !v.approvato;
    }
    if (filtroLivello === 'bloccati') {
      return !!(v.bloccatoPerTentativi || (v.tentativiErrati && v.tentativiErrati >= 3));
    }
    if (filtroLivello === 'patenti-scadenza') {
      if (!v.patente?.inPossesso || !v.patente?.dataScadenza) return false;
      const st = calcolaStatoScadenzaPatente(v.patente.dataScadenza);
      return !!(st?.inScadenza7Giorni || st?.scaduta);
    }
    if (filtroLivello === 'timbro-tessera') {
      const annoCorrente = getCurrentYearItaly();
      return haIscrizioneOttNovDicAnnoPrecedente(v.tesseramento?.dataPrimaIscrizione, annoCorrente) && !v.tesseramento?.timbroCartaceoEseguito;
    }
    if (filtroLivello === 'tessera-scaduta') {
      const annoCorrente = getCurrentYearItaly();
      const st = calcolaStatoPeriodoRinnovo(v.tesseramento, annoCorrente);
      return st.stato === 'scaduta' || (st.stato === 'in_corso' && !v.tesseramento?.rinnovata);
    }
    return true;
  });

  const togglePinSingolo = (id: string) => {
    setPinVisibili((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleApriCreaCategoriaModal = () => {
    setCategoriaInModificaModal(null);
    setFormCategoriaNomeModal('');
    setFormCategoriaEmojiModal('📁');
    setFormCategoriaParentIdModal('');
    setModalCategoriaModalAperta(true);
  };

  const handleApriModificaCategoriaModal = (cat: CategoriaMansioneItem) => {
    setCategoriaInModificaModal(cat);
    setFormCategoriaNomeModal(cat.nome);
    setFormCategoriaEmojiModal(cat.badgeEmoji || '📁');
    setFormCategoriaParentIdModal(cat.parentCategoriaId || '');
    setModalCategoriaModalAperta(true);
  };

  const handleSalvaCategoriaModal = () => {
    const cleanNome = formCategoriaNomeModal.trim();
    if (!cleanNome) return;
    if (categoriaInModificaModal) {
      const res = modificaCategoriaMansione(categoriaInModificaModal.id, {
        nome: cleanNome,
        badgeEmoji: formCategoriaEmojiModal.trim() || '📁',
        parentCategoriaId: formCategoriaParentIdModal || null
      });
      setCategorieMansioni(res.categorie);
      setCatalogoMansioni(res.catalogo);
      realtime.syncMansioniConfig(res.catalogo, res.categorie);
      onNotificaRadio(`📂 CATEGORIE MANSIONI: Modificata categoria "${cleanNome}"`, 'centrale');
      setAvvisoTemporaneo(`✅ Categoria "${cleanNome}" aggiornata su tutti i dispositivi.`);
    } else {
      const aggiornate = creaCategoriaMansione({
        nome: cleanNome,
        badgeEmoji: formCategoriaEmojiModal.trim() || '📁',
        parentCategoriaId: formCategoriaParentIdModal || undefined
      });
      const catCorr = getMansioniCatalogo();
      setCategorieMansioni(aggiornate);
      realtime.syncMansioniConfig(catCorr, aggiornate);
      onNotificaRadio(`📂 CATEGORIE MANSIONI: Creata nuova categoria "${cleanNome}"`, 'centrale');
      setAvvisoTemporaneo(`✅ Nuova categoria "${cleanNome}" aggiunta su tutti i dispositivi.`);
    }
    setTimeout(() => setAvvisoTemporaneo(null), 4000);
    setModalCategoriaModalAperta(false);
    setCategoriaInModificaModal(null);
  };

  const handleEliminaCategoriaModal = (cat: CategoriaMansioneItem) => {
    setConfermaAzioneModal({
      titolo: 'Elimina Categoria Mansioni',
      messaggio: `Sei sicuro di voler eliminare la categoria "${cat.nome}"?\n\nLe mansioni attualmente collegate a questa categoria verranno spostate nella prima categoria disponibile.`,
      labelConferma: 'Elimina Categoria',
      variante: 'danger',
      onConferma: () => {
        const res = eliminaCategoriaMansione(cat.id);
        setCategorieMansioni(res.categorie);
        setCatalogoMansioni(res.catalogo);
        if (filtroCategoriaMansioneModal === cat.nome) {
          setFiltroCategoriaMansioneModal('tutte');
        }
        realtime.syncMansioniConfig(res.catalogo, res.categorie);
        onNotificaRadio(`🗑️ CATEGORIE MANSIONI: Eliminata categoria "${cat.nome}"`, 'centrale');
        setAvvisoTemporaneo(`Categoria "${cat.nome}" eliminata.`);
        setTimeout(() => setAvvisoTemporaneo(null), 4000);
      }
    });
  };

  const handleRipristinaCategorieDefaultModal = () => {
    setConfermaAzioneModal({
      titolo: 'Ripristina Categorie Predefinite',
      messaggio: 'Vuoi ripristinare le categorie predefinite di sistema? Tutte le categorie standard verranno reintegrate e sincronizzate su tutti i dispositivi.',
      labelConferma: 'Ripristina Categorie',
      variante: 'warning',
      onConferma: () => {
        const defCats = ripristinaCategorieMansioniDefault();
        setCategorieMansioni(defCats);
        realtime.syncMansioniConfig(getMansioniCatalogo(), defCats);
        setAvvisoTemporaneo('✓ Categorie mansioni predefinite ripristinate.');
        setTimeout(() => setAvvisoTemporaneo(null), 4000);
      }
    });
  };

  const handleApriCreaMansioneModal = () => {
    setMansioneInModificaModal(null);
    setNuovaMansioneNomeModal('');
    setNuovaMansioneDescrizioneModal('');
    setNuovaMansioneCategoriaModal(categorieMansioni[0]?.nome || 'Emergenza 118');
    setNuovaMansioneEmojiModal('🎖️');
    setNuovaMansioneParentIdModal('');
    setNuovaMansioneIncluseModal(['Volontario']);
    setModalCreaNuovaMansioneInModal(true);
  };

  const handleApriModificaMansioneModal = (m: MansioneOperativa) => {
    setMansioneInModificaModal(m);
    setNuovaMansioneNomeModal(m.nome);
    setNuovaMansioneDescrizioneModal(m.descrizione || '');
    setNuovaMansioneCategoriaModal(m.categoria);
    setNuovaMansioneEmojiModal(m.badgeEmoji || '🎖️');
    setNuovaMansioneParentIdModal(m.parentMansioneId || '');
    setNuovaMansioneIncluseModal(Array.isArray(m.mansioniIncluse) && m.mansioniIncluse.length > 0 ? [...m.mansioniIncluse] : ['Volontario']);
    setModalCreaNuovaMansioneInModal(true);
  };

  const handleSalvaMansioneModal = () => {
    if (!nuovaMansioneNomeModal.trim()) return;

    if (mansioneInModificaModal) {
      // Modifica mansione esistente nel catalogo
      const vecchioNome = mansioneInModificaModal.nome;
      const nuovoNome = nuovaMansioneNomeModal.trim();
      const aggiornato = modificaMansioneCatalogo(mansioneInModificaModal.id, {
        nome: nuovoNome,
        descrizione: nuovaMansioneDescrizioneModal.trim() || undefined,
        categoria: nuovaMansioneCategoriaModal,
        badgeEmoji: nuovaMansioneEmojiModal || '🎖️',
        parentMansioneId: nuovaMansioneParentIdModal ? nuovaMansioneParentIdModal : null,
        mansioniIncluse: nuovaMansioneIncluseModal
      });
      setCatalogoMansioni(aggiornato);
      realtime.syncMansioniConfig(aggiornato, categorieMansioni);

      // Aggiornamento a cascata di tutti i volontari che avevano la mansione
      if (vecchioNome !== nuovoNome) {
        const volontariAggiornati = aggiornaVolontariDopoModificaMansione(
          volontari,
          vecchioNome,
          nuovoNome,
          mansioneInModificaModal.id
        );
        onAggiornaVolontari(volontariAggiornati);
      }

      const tipiRes = aggiornaTipiTurnoDopoModificaMansione(
        vecchioNome,
        nuovoNome,
        mansioneInModificaModal.id,
        nuovaMansioneEmojiModal || '🎖️',
        nuovaMansioneCategoriaModal
      );
      if (tipiRes.modificato) {
        realtime.syncTipiTurno(tipiRes.aggiornati);
      }
      emettiRinominaMansioneGlobale({
        mansioneId: mansioneInModificaModal.id,
        vecchioNome,
        nuovoNome,
        nuovaEmoji: nuovaMansioneEmojiModal || '🎖️',
        nuovaCategoria: nuovaMansioneCategoriaModal,
      });

      setMansioneInModificaModal(null);
      setNuovaMansioneNomeModal('');
      setNuovaMansioneDescrizioneModal('');
      setNuovaMansioneParentIdModal('');
      setNuovaMansioneIncluseModal(['Volontario']);
      setModalCreaNuovaMansioneInModal(false);

      onNotificaRadio(`🎖️ MANSIONI: Modificata mansione "${vecchioNome}" in "${nuovoNome}" (${nuovaMansioneCategoriaModal})`, 'centrale');
      setAvvisoTemporaneo(`✅ Mansione "${nuovoNome}" aggiornata automaticamente in tutto il gestionale!`);
      setTimeout(() => setAvvisoTemporaneo(null), 4000);
    } else {
      // Creazione nuova mansione
      const creata = creaNuovaMansione({
        nome: nuovaMansioneNomeModal.trim(),
        descrizione: nuovaMansioneDescrizioneModal.trim(),
        categoria: nuovaMansioneCategoriaModal,
        badgeEmoji: nuovaMansioneEmojiModal || '🎖️',
        parentMansioneId: nuovaMansioneParentIdModal || undefined,
        mansioniIncluse: nuovaMansioneIncluseModal
      });
      const agg = getMansioniCatalogo();
      setCatalogoMansioni(agg);
      realtime.syncMansioniConfig(agg, categorieMansioni);
      setNuovaMansioneNomeModal('');
      setNuovaMansioneDescrizioneModal('');
      setNuovaMansioneParentIdModal('');
      setNuovaMansioneIncluseModal(['Volontario']);
      setModalCreaNuovaMansioneInModal(false);
      onNotificaRadio(`🎖️ MANSIONI: Creata nuova mansione "${creata.nome}" (${creata.categoria})`, 'centrale');
      setAvvisoTemporaneo(`✅ Nuova mansione "${creata.nome}" aggiunta e sincronizzata su tutti i dispositivi!`);
      setTimeout(() => setAvvisoTemporaneo(null), 4000);
    }
  };

  const handleEliminaMansioneModal = (id: string, nome?: string) => {
    const nomeDaMostrare = nome || 'selezionata';
    const numVolontariConMansione = volontari.filter(v => getMansioniVolontario(v).includes(nomeDaMostrare)).length;
    const msgConferma = numVolontariConMansione > 0
      ? `Sei sicuro di voler eliminare la mansione "${nomeDaMostrare}" dal catalogo?\n\nAttenzione: è attualmente assegnata a ${numVolontariConMansione} volontari e verrà rimossa dai loro fascicoli.`
      : `Sei sicuro di voler eliminare la mansione "${nomeDaMostrare}" dal catalogo?`;

    setConfermaAzioneModal({
      titolo: 'Elimina Mansione dal Catalogo',
      messaggio: msgConferma,
      labelConferma: 'Elimina Mansione',
      variante: 'danger',
      onConferma: () => {
        const aggiornato = eliminaMansioneCatalogo(id);
        setCatalogoMansioni(aggiornato);
        realtime.syncMansioniConfig(aggiornato, categorieMansioni);

        // Aggiornamento in cascata: rimozione mansione da tutti i volontari che la possedevano
        if (nome) {
          const volontariAggiornati = aggiornaVolontariDopoEliminazioneMansione(volontari, nome);
          onAggiornaVolontari(volontariAggiornati);
        }

        onNotificaRadio(`🗑️ MANSIONI: Eliminata mansione "${nomeDaMostrare}" dal catalogo`, 'centrale');
        setAvvisoTemporaneo(`Mansione "${nomeDaMostrare}" eliminata dal catalogo.`);
        setTimeout(() => setAvvisoTemporaneo(null), 4000);
      }
    });
  };

  const handleRipristinaMansioniDefaultModal = () => {
    setConfermaAzioneModal({
      titolo: 'Ripristina Mansioni Predefinite',
      messaggio: 'Vuoi ripristinare il catalogo iniziale delle mansioni predefinite della Croce Oro? Tutte le mansioni standard verranno reintegrate su tutti i dispositivi.',
      labelConferma: 'Ripristina Predefinite',
      variante: 'warning',
      onConferma: () => {
        const defaultMansioni = ripristinaMansioniDefault();
        setCatalogoMansioni(defaultMansioni);
        realtime.syncMansioniConfig(defaultMansioni, categorieMansioni);
        setAvvisoTemporaneo('✓ Catalogo mansioni predefinite ripristinato con successo.');
        setTimeout(() => setAvvisoTemporaneo(null), 4000);
      }
    });
  };

  const handleAssegnaMansioniMassiveModal = (azione: 'aggiungi' | 'sostituisci' | 'rimuovi') => {
    if (selectedVolontariMansioniModalIds.length === 0) {
      setAvvisoTemporaneo('Seleziona almeno un volontario a cui assegnare o modificare le mansioni.');
      setTimeout(() => setAvvisoTemporaneo(null), 4000);
      return;
    }
    if (selectedMansioniNomiModal.length === 0) {
      setAvvisoTemporaneo('Seleziona almeno una mansione dal catalogo da applicare.');
      setTimeout(() => setAvvisoTemporaneo(null), 4000);
      return;
    }

    const aggiornati = volontari.map((v) => {
      if (!selectedVolontariMansioniModalIds.includes(v.id)) return v;

      const mansioniAttuali = getMansioniVolontario(v);
      let nuoveMansioni: string[] = [];

      if (azione === 'aggiungi') {
        nuoveMansioni = Array.from(new Set([...mansioniAttuali, ...selectedMansioniNomiModal]));
      } else if (azione === 'sostituisci') {
        nuoveMansioni = [...selectedMansioniNomiModal];
      } else if (azione === 'rimuovi') {
        nuoveMansioni = mansioniAttuali.filter((m) => !selectedMansioniNomiModal.includes(m));
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

    onNotificaRadio(
      `🎖️ MANSIONI: Mansioni [${selectedMansioniNomiModal.join(', ')}] ${azioneTesto} a ${selectedVolontariMansioniModalIds.length} volontari`,
      'centrale'
    );
    setAvvisoTemporaneo(
      `✅ Mansioni ${azioneTesto} con successo a ${selectedVolontariMansioniModalIds.length} volontari contemporaneamente.`
    );
    setTimeout(() => setAvvisoTemporaneo(null), 5000);
    setSelectedMansioniNomiModal([]);
  };

  const apriAggiungiVolontario = () => {
    setVolontarioInModifica(null);
    setFormNome('');
    setFormCognome('');
    setFormCodiceFiscale('');
    setFormIndirizzoResidenza('');

    // Dati Residenza Dettagliata
    setFormResidenza({
      indirizzo: '',
      comune: 'Massa',
      cap: '54100',
      provincia: 'MS',
      lat: 44.0365,
      lng: 10.1423
    });

    // Dati Nascita
    setFormDataNascita('');
    setFormSesso('M');
    setFormComuneNascita('Massa');
    setFormProvinciaNascita('MS');
    setFeedbackCF(null);

    setFormMatricola(`VOL-${Math.floor(100 + Math.random() * 900)}`);
    setFormQualifica('Autista');
    setFormCaricaDirettivo('Nessuna');
    setFormTelefono('');
    setFormEmail('');
    setFormPIN(String(Math.floor(1000 + Math.random() * 9000)));
    setFormProfiloCentrale(false);
    setFormApprovato(true);
    setFormFirmaBase64(null);
    setFormFotoBase64(null);
    setFormSezioneAppartenenzaId('sede-massa-ronchi');

    // Tesseramento & Quote: calcolo del progressivo (+1 dall'ultima emessa)
    const annoCorrente = getCurrentYearItaly();
    const infoTessVol = calcolaProssimoNumeroTessera(volontari, false);
    setFormNumeroTessera(infoTessVol.prossimoNumeroTessera);
    setFormForzaNumeroTessera(false);
    setFormDataPrimaIscrizione(formatISODateItaly());
    setFormTesseraRinnovata(true);
    setFormDataRinnovoTessera(formatISODateItaly());
    const proxNum = calcolaProssimoNumeroRicevuta(volontari, annoCorrente);
    setFormNumeroRicevuta(proxNum);
    setFormNumeroRicevutaFormattato(formattaNumeroRicevuta(proxNum, annoCorrente));
    setFormQuotaVersata(QUOTA_TESSERA_VOLONTARIO);
    setFormTimbroCartaceoEseguito(false);
    setFormNoteTesseramento('');
    setFormEsenteQuota(false);
    setFormMotivoEsenzioneQuota('Benemerito');
    setFormMacroCategorie([]);

    setFormDocTipo('Carta d\'Identità');
    setFormDocNumero('');
    setFormDocScadenza('');
    setFormPatenteInPossesso(false);
    setFormPatenteCategoria('B');
    setFormPatenteNumero('');
    setFormPatenteScadenza('');
    setFormVestiario(creaDotazioneVuota());
    setCauzioneDrafts({});
    setRiconsegnaAperta(false);
    setRiconsegnaSelezionati({});
    setRiconsegnaData(formatISODateItaly());
    setRiconsegnaRimborsoStr('0');
    setRiconsegnaNote('');
    setFormDomandaIscrizioneDati(undefined);
    setFormDomandaIscrizioneFirmata(undefined);
    setTabModaleEdit('anagrafica');
    setErroreForm('');
    setModaleEditAperta(true);
  };

  const apriModificaVolontario = (volontario: Volontario) => {
    setVolontarioInModifica(volontario);
    setFormNome(volontario.nome);
    setFormCognome(volontario.cognome);
    setFormCodiceFiscale(volontario.codiceFiscale || '');
    setFormIndirizzoResidenza(volontario.indirizzoResidenza || '');

    // Inizializzazione Residenza Dettagliata
    if (volontario.dettaglioResidenza) {
      setFormResidenza({
        indirizzo: volontario.dettaglioResidenza.indirizzo || '',
        comune: volontario.dettaglioResidenza.comune || 'Massa',
        cap: volontario.dettaglioResidenza.cap || '54100',
        provincia: volontario.dettaglioResidenza.provincia || 'MS',
        lat: volontario.dettaglioResidenza.lat,
        lng: volontario.dettaglioResidenza.lng
      });
    } else if (volontario.indirizzoResidenza) {
      const match = volontario.indirizzoResidenza.match(/^(.*?)(?:,\s*(\d{5}))?\s*([^(,]+)?(?:\s*\(([A-Z]{2})\))?$/i);
      if (match) {
        setFormResidenza({
          indirizzo: (match[1] || '').trim(),
          cap: match[2] || '54100',
          comune: (match[3] || 'Massa').trim(),
          provincia: match[4] || 'MS'
        });
      } else {
        setFormResidenza({
          indirizzo: volontario.indirizzoResidenza,
          comune: 'Massa',
          cap: '54100',
          provincia: 'MS'
        });
      }
    } else {
      setFormResidenza({
        indirizzo: '',
        comune: 'Massa',
        cap: '54100',
        provincia: 'MS'
      });
    }

    // Inizializzazione Dati Nascita
    setFormDataNascita(volontario.dataNascita || '');
    setFormSesso(volontario.sesso || 'M');
    setFormComuneNascita(volontario.comuneNascita || 'Massa');
    setFormProvinciaNascita(volontario.provinciaNascita || 'MS');
    setFeedbackCF(null);

    // Se ci sono campi mancanti ma c'è il codice fiscale, decodifica preventiva automatica
    if (volontario.codiceFiscale && (!volontario.dataNascita || !volontario.comuneNascita)) {
      const dec = decodificaCodiceFiscale(volontario.codiceFiscale);
      if (dec.valido) {
        if (dec.dataNascita && !volontario.dataNascita) setFormDataNascita(dec.dataNascita);
        if (dec.sesso && !volontario.sesso) setFormSesso(dec.sesso);
        if (dec.comuneNascita && !volontario.comuneNascita) setFormComuneNascita(dec.comuneNascita);
        if (dec.provinciaNascita && !volontario.provinciaNascita) setFormProvinciaNascita(dec.provinciaNascita);
      }
    }

    setFormMatricola(volontario.matricola || '');
    const mList = getMansioniVolontario(volontario);
    setFormMansioni(mList);
    setFormQualifica(volontario.mansione || mList[0] || volontario.qualifica || 'Autista');
    setFormCaricaDirettivo(volontario.caricaConsiglioDirettivo || 'Nessuna');
    setFormTelefono(volontario.telefono || '');
    setFormEmail(volontario.email || '');
    setFormPIN(volontario.pin);
    setFormProfiloCentrale(!!volontario.profiloCentrale || volontario.qualifica === 'Operatore Centrale');
    setFormApprovato(volontario.approvato !== undefined ? volontario.approvato : true);
    setFormFirmaBase64(volontario.firmaBase64 || null);
    setFormFotoBase64(volontario.fotoBase64 || null);

    // Tesseramento
    const tess = volontario.tesseramento;
    const annoCorrente = getCurrentYearItaly();
    setFormNumeroTessera(tess?.numeroTessera || volontario.matricola || '');
    setFormForzaNumeroTessera(false);
    setFormDataPrimaIscrizione(tess?.dataPrimaIscrizione || '');
    const isRinnovataOggi = !!(tess?.rinnovata && tess?.annoRiferimento === annoCorrente);
    setFormTesseraRinnovata(isRinnovataOggi);
    setFormDataRinnovoTessera(tess?.dataRinnovo || (isRinnovataOggi ? formatISODateItaly() : ''));
    setFormNumeroRicevuta(tess?.numeroRicevuta);
    setFormNumeroRicevutaFormattato(tess?.numeroRicevutaFormattato || (tess?.numeroRicevuta ? formattaNumeroRicevuta(tess.numeroRicevuta, annoCorrente) : ''));
    const isOp = !!volontario.profiloCentrale || volontario.qualifica === 'Operatore Centrale';
    setFormQuotaVersata(tess?.importoVersato !== undefined ? tess.importoVersato : (isOp ? QUOTA_TESSERA_OPERATORE : QUOTA_TESSERA_VOLONTARIO));
    setFormTimbroCartaceoEseguito(!!tess?.timbroCartaceoEseguito);
    setFormNoteTesseramento(tess?.note || '');
    setFormEsenteQuota(Boolean(volontario.esenteQuotaAssociativa));
    setFormMotivoEsenzioneQuota((volontario.motivoEsenzioneQuota as any) || 'Benemerito');
    
    // Documento
    setFormDocTipo(volontario.documentoIdentita?.tipo || 'Carta d\'Identità');
    setFormDocNumero(volontario.documentoIdentita?.numero || '');
    setFormDocScadenza(volontario.documentoIdentita?.dataScadenza || '');

    // Patente
    setFormPatenteInPossesso(!!volontario.patente?.inPossesso);
    setFormPatenteCategoria(volontario.patente?.categoria || 'B');
    setFormPatenteNumero(volontario.patente?.numero || '');
    setFormPatenteScadenza(volontario.patente?.dataScadenza || '');

    // Vestiario
    if (volontario.vestiario) {
      setFormVestiario(JSON.parse(JSON.stringify(volontario.vestiario)));
    } else {
      setFormVestiario(creaDotazioneVuota());
    }
    setCauzioneDrafts({});
    setRiconsegnaAperta(false);
    setRiconsegnaSelezionati({});
    setRiconsegnaData(formatISODateItaly());
    setRiconsegnaRimborsoStr('0');
    setRiconsegnaNote('');

    setFormMacroCategorie(volontario.macroCategorieAbilitate || (volontario.profiloCentrale ? ['centrale'] : []));
    setFormSezioneAppartenenzaId(volontario.sezioneAppartenenzaId || 'sede-massa-ronchi');
    setFormDomandaIscrizioneDati(volontario.domandaIscrizioneDati);
    setFormDomandaIscrizioneFirmata(volontario.domandaIscrizioneFirmata);
    setTabModaleEdit('anagrafica');
    setErroreForm('');
    setModaleEditAperta(true);
  };

  // 1. CALCOLA IL CODICE FISCALE IN AUTOMATICO
  const handleCalcolaCodiceFiscale = () => {
    setFeedbackCF(null);
    if (!formNome.trim() || !formCognome.trim()) {
      setFeedbackCF({ tipo: 'error', testo: 'Compila prima Nome e Cognome per poter generare il Codice Fiscale.' });
      return;
    }
    if (!formDataNascita) {
      setFeedbackCF({ tipo: 'error', testo: 'Inserisci la Data di Nascita per il calcolo.' });
      return;
    }
    if (!formComuneNascita.trim()) {
      setFeedbackCF({ tipo: 'error', testo: 'Inserisci il Comune di Nascita.' });
      return;
    }

    const res = calcolaCodiceFiscale({
      nome: formNome.trim(),
      cognome: formCognome.trim(),
      dataNascita: formDataNascita,
      sesso: formSesso,
      comuneNascita: formComuneNascita.trim(),
      provinciaNascita: formProvinciaNascita.trim()
    });

    if (res.errore || !res.codiceFiscale) {
      setFeedbackCF({ tipo: 'error', testo: res.errore || 'Errore durante la generazione del Codice Fiscale.' });
    } else {
      setFormCodiceFiscale(res.codiceFiscale);
      setFeedbackCF({ tipo: 'success', testo: `✓ Codice Fiscale calcolato correttamente: ${res.codiceFiscale}` });
    }
  };

  // 2. RIEMPI CAMPI NASCITA DA CODICE FISCALE
  const handleRiempiDaCodiceFiscale = () => {
    setFeedbackCF(null);
    const cf = formCodiceFiscale.trim().toUpperCase();
    if (!cf) {
      setFeedbackCF({ tipo: 'error', testo: 'Digita prima il Codice Fiscale a 16 caratteri.' });
      return;
    }

    const res = decodificaCodiceFiscale(cf);
    if (!res.valido) {
      setFeedbackCF({ tipo: 'error', testo: res.errore || 'Codice Fiscale non valido.' });
      return;
    }

    if (res.nome && !formNome.trim()) setFormNome(res.nome);
    else if (res.nome) setFormNome(res.nome);
    if (res.cognome && !formCognome.trim()) setFormCognome(res.cognome);
    else if (res.cognome) setFormCognome(res.cognome);
    if (res.dataNascita) setFormDataNascita(res.dataNascita);
    if (res.sesso) setFormSesso(res.sesso);
    if (res.comuneNascita) setFormComuneNascita(res.comuneNascita);
    if (res.provinciaNascita) setFormProvinciaNascita(res.provinciaNascita);

    setFeedbackCF({
      tipo: 'success',
      testo: `✓ Dati acquisiti dal Codice Fiscale: ${res.nome || ''} ${res.cognome || ''} — Nato il ${res.dataNascita ? res.dataNascita.split('-').reverse().join('/') : ''} (${res.sesso}) a ${res.comuneNascita}${res.provinciaNascita ? ' (' + res.provinciaNascita + ')' : ''}`
    });
  };

  const salvaVolontario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formCognome.trim()) {
      setErroreForm('Nome e Cognome sono obbligatori.');
      return;
    }
    if (!formTelefono.trim() || formTelefono.trim().length < 6) {
      setErroreForm('Il numero di telefono cellulare è obbligatorio.');
      return;
    }
    const emailPulita = formEmail.trim().toLowerCase();
    if (!emailPulita || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPulita)) {
      setErroreForm('L\'indirizzo email è obbligatorio e deve essere valido (es. nome@dominio.it).');
      return;
    }
    if (!/^\d{4}$/.test(formPIN)) {
      setErroreForm('Il PIN deve essere esattamente di 4 cifre numeriche (es. 1234).');
      return;
    }
    if (formPIN === '4451') {
      setErroreForm('Il PIN 4451 è riservato all\'Account Amministratore della Centrale. Scegli un altro codice.');
      return;
    }

    const cfPulito = formCodiceFiscale.trim().toUpperCase();
    if (cfPulito && cfPulito.length !== 16) {
      setErroreForm('Il Codice Fiscale deve contenere esattamente 16 caratteri alfanumerici (es. RSSMRC80A01E625T).');
      return;
    }

    const vestiarioAggiornato = applicaEvidenziazioneUltimaConsegna(
      formVestiario,
      volontarioInModifica?.vestiario
    );

    const docIdentita: DocumentoIdentitaVolontario = {
      tipo: formDocTipo,
      numero: formDocNumero.trim(),
      dataScadenza: formDocScadenza
    };

    const patGuida: PatenteGuidaVolontario = {
      inPossesso: formPatenteInPossesso,
      categoria: formPatenteInPossesso ? formPatenteCategoria : undefined,
      numero: formPatenteInPossesso ? formPatenteNumero.trim() : undefined,
      dataScadenza: formPatenteInPossesso ? formPatenteScadenza : undefined
    };

    const annoCorrente = getCurrentYearItaly();
    const isOp = formProfiloCentrale || formQualifica === 'Operatore Centrale';
    const isOttNovDic = haIscrizioneOttNovDicAnnoPrecedente(formDataPrimaIscrizione, annoCorrente);

    let tesseramentoFinale: DatiTesseramento | undefined = undefined;
    if (formNumeroTessera.trim() || formDataPrimaIscrizione || formTesseraRinnovata || volontarioInModifica?.tesseramento) {
      const numProg = formTesseraRinnovata
        ? (formNumeroRicevuta || volontarioInModifica?.tesseramento?.numeroRicevuta || calcolaProssimoNumeroRicevuta(volontari, annoCorrente))
        : undefined;
      const numFmt = numProg ? (formNumeroRicevutaFormattato || formattaNumeroRicevuta(numProg, annoCorrente)) : undefined;
      const importoEffettivo = formTesseraRinnovata
        ? (formEsenteQuota || isOttNovDic ? 0 : (isOp ? QUOTA_TESSERA_OPERATORE : QUOTA_TESSERA_VOLONTARIO))
        : undefined;

      const tesoriera = volontari.find(
        (op) => (op.profiloCentrale || op.qualifica === 'Operatore Centrale') &&
               (op.caricaConsiglioDirettivo === 'Tesoriera' || op.caricaConsiglioDirettivo === 'Tesoriere')
      );

      const indComp = formResidenza.indirizzo.trim();
      const comComp = formResidenza.comune.trim();
      const capComp = formResidenza.cap.trim();
      const provComp = formResidenza.provincia.trim().toUpperCase();

      const indirizzoCompleto = indComp
        ? `${indComp}, ${capComp ? capComp + ' ' : ''}${comComp}${provComp ? ' (' + provComp + ')' : ''}`
        : (formIndirizzoResidenza.trim() || undefined);

      const dettaglioResidenzaSalvato: DatiResidenzaMultiCampo | undefined = indComp ? {
        indirizzo: indComp,
        comune: comComp,
        cap: capComp,
        provincia: provComp,
        lat: formResidenza.lat,
        lng: formResidenza.lng
      } : undefined;

      const ricevutaAttuale: RicevutaTesseramento | undefined = formTesseraRinnovata && numProg ? {
        id: `ric-${volontarioInModifica?.id || Date.now()}-${annoCorrente}`,
        numeroProgressivo: numProg,
        annoRiferimento: annoCorrente,
        numeroRicevutaFormattato: numFmt || `${numProg}/${annoCorrente}`,
        dataEmissione: formDataRinnovoTessera || formatISODateItaly(),
        importo: importoEffettivo ?? 0,
        esenteQuotaPrimoAnno: isOttNovDic,
        dicituraFiscale: DICITURA_ESENZIONE_BOLLO,
        socioId: volontarioInModifica?.id || '',
        nomeSocio: formNome.trim(),
        cognomeSocio: formCognome.trim(),
        codiceFiscaleSocio: cfPulito || undefined,
        indirizzoResidenzaSocio: indirizzoCompleto || undefined,
        qualificaSocio: formQualifica,
        caricaDirettivoSocio: formCaricaDirettivo !== 'Nessuna' ? formCaricaDirettivo : undefined,
        numeroTessera: formNumeroTessera.trim() || formMatricola.trim() || undefined,
        tesorieraNome: tesoriera ? `${tesoriera.cognome} ${tesoriera.nome}` : undefined,
        tesorieraCarica: tesoriera?.caricaConsiglioDirettivo || 'Tesoriera',
        tesorieraFirmaBase64: tesoriera?.firmaBase64
      } : undefined;

      tesseramentoFinale = {
        numeroTessera: formNumeroTessera.trim() || formMatricola.trim() || (isOp ? `TO-${formMatricola || '01'}` : `TV-${formMatricola || '101'}`),
        dataPrimaIscrizione: formDataPrimaIscrizione || undefined,
        annoRiferimento: annoCorrente,
        rinnovata: formTesseraRinnovata,
        dataRinnovo: formTesseraRinnovata ? (formDataRinnovoTessera || formatISODateItaly()) : undefined,
        numeroRicevuta: numProg,
        numeroRicevutaFormattato: numFmt,
        importoVersato: importoEffettivo,
        copertaDaIscrizioneFineAnnoPrec: isOttNovDic,
        timbroCartaceoEseguito: formTimbroCartaceoEseguito,
        dataTimbroCartaceo: formTimbroCartaceoEseguito ? (volontarioInModifica?.tesseramento?.dataTimbroCartaceo || formatISODateItaly()) : undefined,
        note: formNoteTesseramento.trim() || undefined,
        ricevutaAttuale,
        storicoRicevute: ricevutaAttuale
          ? [ricevutaAttuale, ...(volontarioInModifica?.tesseramento?.storicoRicevute?.filter(r => r.annoRiferimento !== annoCorrente) || [])]
          : volontarioInModifica?.tesseramento?.storicoRicevute
      };
    }

    const indComp = formResidenza.indirizzo.trim();
    const comComp = formResidenza.comune.trim();
    const capComp = formResidenza.cap.trim();
    const provComp = formResidenza.provincia.trim().toUpperCase();

    const indirizzoCompleto = indComp
      ? `${indComp}, ${capComp ? capComp + ' ' : ''}${comComp}${provComp ? ' (' + provComp + ')' : ''}`
      : (formIndirizzoResidenza.trim() || undefined);

    const dettaglioResidenzaSalvato: DatiResidenzaMultiCampo | undefined = indComp ? {
      indirizzo: indComp,
      comune: comComp,
      cap: capComp,
      provincia: provComp,
      lat: formResidenza.lat,
      lng: formResidenza.lng
    } : undefined;

    if (volontarioInModifica) {
      // Modifica esistente
      const aggiornati = volontari.map((v) =>
        v.id === volontarioInModifica.id
          ? {
              ...v,
              nome: formNome.trim(),
              cognome: formCognome.trim(),
              codiceFiscale: cfPulito || undefined,
              indirizzoResidenza: indirizzoCompleto,
              dettaglioResidenza: dettaglioResidenzaSalvato,
              dataNascita: formDataNascita || undefined,
              sesso: formSesso,
              comuneNascita: formComuneNascita.trim() || undefined,
              provinciaNascita: formProvinciaNascita.trim().toUpperCase() || undefined,
              matricola: formMatricola.trim(),
              qualifica: formQualifica,
              mansione: formQualifica,
              mansioni: formMansioni.length > 0 ? formMansioni : [formQualifica],
              caricaConsiglioDirettivo: formCaricaDirettivo !== 'Nessuna' ? formCaricaDirettivo : undefined,
              tesseramento: tesseramentoFinale,
              telefono: formTelefono.trim(),
              email: emailPulita,
              pin: formPIN,
              profiloCentrale: formProfiloCentrale || formQualifica === 'Operatore Centrale',
              approvato: formApprovato,
              firmaBase64: formFirmaBase64 || v.firmaBase64,
              fotoBase64: formFotoBase64 || undefined,
              documentoIdentita: formDocNumero.trim() ? docIdentita : undefined,
              patente: formPatenteInPossesso ? patGuida : undefined,
              vestiario: vestiarioAggiornato,
              domandaIscrizioneDati: formDomandaIscrizioneDati ?? v.domandaIscrizioneDati,
              domandaIscrizioneFirmata: formDomandaIscrizioneFirmata,
              esenteQuotaAssociativa: formEsenteQuota,
              motivoEsenzioneQuota: formEsenteQuota ? formMotivoEsenzioneQuota : undefined,
              macroCategorieAbilitate: formMacroCategorie,
              sezioneAppartenenzaId: formSezioneAppartenenzaId,
              sezioneAppartenenzaNome: SEDI_TURNI_DISPONIBILI.find(s => s.id === formSezioneAppartenenzaId)?.nome || 'Sede Associativa',
              sediTurniAbilitate: (v.sediTurniAbilitate && v.sediTurniAbilitate.length > 0)
                ? (v.sediTurniAbilitate.includes(formSezioneAppartenenzaId) ? v.sediTurniAbilitate : [...v.sediTurniAbilitate, formSezioneAppartenenzaId])
                : [formSezioneAppartenenzaId]
            }
          : v
      );
      onAggiornaVolontari(aggiornati);
      onNotificaRadio(`CENTRALE: Profilo, tesseramento, documenti e vestiario aggiornati per ${formNome} ${formCognome}`, 'centrale');
      if (!canDeleteEffettivo) {
        inviaNotificaModificaAdmin({
          operatoreNome: operatoreCorrente || 'Operatore Delegato',
          operatoreRuolo: 'Accesso Delegato',
          macroCategoria: 'Database Volontari',
          azione: 'Modifica Scheda Volontario',
          dettaglio: `Aggiornato profilo di ${formNome.trim()} ${formCognome.trim()} (${formQualifica}). Sezione: ${SEDI_TURNI_DISPONIBILI.find(s => s.id === formSezioneAppartenenzaId)?.nome || formSezioneAppartenenzaId}. Macro categorie abilitate: [${formMacroCategorie.join(', ') || 'Nessuna'}].`,
          elementoNome: `${formNome.trim()} ${formCognome.trim()}`
        });
      }
    } else {
      // Generazione automatica PIN provvisorio e token univoco ad alta entropia per il reset
      const pinProvvisorio = formPIN && /^\d{4}$/.test(formPIN) && formPIN !== '4451'
        ? formPIN
        : String(Math.floor(1000 + Math.random() * 9000));
      const resetTokenGenerato = generaTokenResetPinSicuro();
      const dataOra = formatDateTimeItaly();

      // Nuovo volontario o operatore
      const nuovo: Volontario = {
        id: formProfiloCentrale ? `op-centrale-${Date.now()}` : `vol-${Date.now()}`,
        nome: formNome.trim(),
        cognome: formCognome.trim(),
        codiceFiscale: cfPulito || undefined,
        indirizzoResidenza: indirizzoCompleto,
        dettaglioResidenza: dettaglioResidenzaSalvato,
        dataNascita: formDataNascita || undefined,
        sesso: formSesso,
        comuneNascita: formComuneNascita.trim() || undefined,
        provinciaNascita: formProvinciaNascita.trim().toUpperCase() || undefined,
        matricola: formMatricola.trim() || calcolaProssimaMatricola(formProfiloCentrale),
        qualifica: formQualifica,
        mansione: formQualifica,
        mansioni: formMansioni.length > 0 ? formMansioni : [formQualifica],
        caricaConsiglioDirettivo: formCaricaDirettivo !== 'Nessuna' ? formCaricaDirettivo : undefined,
        tesseramento: tesseramentoFinale,
        telefono: formTelefono.trim(),
        email: emailPulita,
        pin: pinProvvisorio,
        pinProvvisorio: true,
        richiedeResetPassword: true,
        resetToken: resetTokenGenerato,
        dataRichiestaResetPassword: dataOra,
        dataInvioInvitoReset: emailPulita ? dataOra : undefined,
        dataRegistrazione: formatDateItaly(),
        inTurno: false,
        profiloCentrale: formProfiloCentrale || formQualifica === 'Operatore Centrale',
        approvato: formApprovato,
        firmaBase64: formFirmaBase64 || undefined,
        fotoBase64: formFotoBase64 || undefined,
        documentoIdentita: formDocNumero.trim() ? docIdentita : undefined,
        patente: formPatenteInPossesso ? patGuida : undefined,
        vestiario: vestiarioAggiornato,
        domandaIscrizioneDati: formDomandaIscrizioneDati,
        domandaIscrizioneFirmata: formDomandaIscrizioneFirmata,
        esenteQuotaAssociativa: formEsenteQuota,
        motivoEsenzioneQuota: formEsenteQuota ? formMotivoEsenzioneQuota : undefined,
        macroCategorieAbilitate: formMacroCategorie,
        sezioneAppartenenzaId: formSezioneAppartenenzaId,
        sezioneAppartenenzaNome: SEDI_TURNI_DISPONIBILI.find(s => s.id === formSezioneAppartenenzaId)?.nome || 'Sede Associativa',
        sediTurniAbilitate: [formSezioneAppartenenzaId]
      };
      onAggiornaVolontari([nuovo, ...volontari]);
      onNotificaRadio(`CENTRALE: Inserito nuovo ${nuovo.profiloCentrale ? 'Operatore Centrale' : 'volontario'} ${nuovo.nome} ${nuovo.cognome} con PIN provvisorio assegnato`, 'centrale');
      if (!canDeleteEffettivo) {
        inviaNotificaModificaAdmin({
          operatoreNome: operatoreCorrente || 'Operatore Delegato',
          operatoreRuolo: 'Accesso Delegato',
          macroCategoria: 'Database Volontari',
          azione: 'Nuovo Inserimento Volontario',
          dettaglio: `Registrato nuovo profilo per ${formNome.trim()} ${formCognome.trim()} (${formQualifica}). Macro categorie abilitate: [${formMacroCategorie.join(', ') || 'Nessuna'}].`,
          elementoNome: `${formNome.trim()} ${formCognome.trim()}`
        });
      }

      // Crea ticket Cloud Firestore per attivazione autonoma senza Google / AI Studio
      creaTicketResetPinFirestore({
        tokenId: resetTokenGenerato,
        volunteerId: nuovo.id,
        displayName: `${nuovo.nome} ${nuovo.cognome}`.trim(),
        qualifica: nuovo.qualifica,
        pinProvvisorio,
      }).catch(() => {});

      const publicBaseUrl = realtime.getPublicAppUrl() || getConfiguredPublicUrl();

      // Invio automatico email con PIN temporaneo e pulsante/allegato autonomo per impostare il nuovo PIN
      if (emailPulita && emailPulita.includes('@')) {
        fetch('/api/invia-email-invito-reset-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: nuovo.id,
            nome: nuovo.nome,
            cognome: nuovo.cognome,
            qualifica: nuovo.qualifica,
            email: emailPulita,
            pinProvvisorio: pinProvvisorio,
            token: resetTokenGenerato,
            origin: window.location.origin,
            publicBaseUrl
          })
        })
          .then(r => r.json())
          .then(res => {
            if (res.success) {
              onNotificaRadio(
                `📧 EMAIL ATTIVAZIONE: Inviata email con PIN provvisorio (${pinProvvisorio}) e portale reset autonomo a ${emailPulita} da sistemiautomatizzati@croceoro.org`,
                'sistema'
              );
            }
          })
          .catch(() => {});
      }

      // Carica automaticamente i dati immessi in Sezione 1 (Anagrafica & Foto) e Sezione 2 (Documenti & Patente) nella Domanda di Iscrizione PDF
      setVolontarioPerDomandaIscrizione(nuovo);
      setModaleDomandaIscrizioneAperta(true);
      setAvvisoTemporaneo(`📄 Domanda di Iscrizione compilata e pronta per ${nuovo.nome} ${nuovo.cognome}! Email di attivazione inviata.`);
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
    }

    // Scalo automatico giacenze Magazzino Vestiario & DPI per i nuovi capi consegnati
    if (onAggiornaMagazzinoVestiario && magazzinoVestiario.length > 0) {
      const prevVest = volontarioInModifica?.vestiario;
      const nuoviScarichi: Array<{ chiave: ChiaveVestiarioAccount; nome: string; taglia?: string; prefId?: string }> = [];
      (vestiarioAggiornato.tshirt || []).forEach((p, idx) => {
        const was = Boolean(prevVest?.tshirt?.[idx]?.consegnato);
        if (p?.consegnato && !was) {
          nuoviScarichi.push({
            chiave: 'tshirt',
            nome: `T-Shirt #${idx + 1}`,
            taglia: p.taglia,
            prefId: p.articoloMagazzinoId
          });
        }
      });
      (['felpa', 'pile', 'pantaloni', 'giubbetto', 'giubbottoInvernale'] as const).forEach(chiave => {
        const now = vestiarioAggiornato[chiave];
        const was = Boolean(prevVest?.[chiave]?.consegnato);
        if (now?.consegnato && !was) {
          nuoviScarichi.push({
            chiave,
            nome: chiave,
            taglia: now.taglia,
            prefId: now.articoloMagazzinoId
          });
        }
      });
      if (nuoviScarichi.length > 0) {
        let nextMag = [...magazzinoVestiario];
        const nuoviMov: MovimentoMagazzino[] = [];
        const oraMov = formatDateTimeItaly(undefined, false).slice(0, 16);
        const destNome = `${formNome.trim()} ${formCognome.trim()}`.trim();
        nuoviScarichi.forEach((sc, i) => {
          const art = trovaArticoloMagazzinoPerCapo(sc.chiave, sc.taglia, sc.prefId);
          if (art) {
            nextMag = nextMag.map(item =>
              item.id === art.id
                ? { ...item, giacenzaAttuale: Math.max(0, (item.giacenzaAttuale || 0) - 1) }
                : item
            );
            nuoviMov.push({
              id: `mov-scarico-${Date.now()}-${i}`,
              data: oraMov,
              tipo: 'Scarico / Assegnazione',
              articoloNome: `${art.nome}${sc.taglia ? ` (Tg. ${sc.taglia})` : ''}`,
              quantita: 1,
              destinatarioOOrigine: destNome,
              operatore: operatoreCorrente || 'Amministratore',
              note: 'Assegnazione automatica da Scheda Account Vestiario & DPI'
            });
          }
        });
        if (nuoviMov.length > 0) {
          onAggiornaMagazzinoVestiario(nextMag);
          if (onAggiornaMovimentiMagazzino) {
            onAggiornaMovimentiMagazzino([...nuoviMov, ...movimentiMagazzino]);
          }
        }
      }
    }

    chiudiModaleEdit();
  };

  const confermaEliminaAccount = () => {
    if (!accountDaEliminare) return;
    if (!canDeleteEffettivo) {
      setAvvisoTemporaneo("Operazione non consentita: il tuo profilo dispone dei permessi di inserimento e modifica, ma l'eliminazione è riservata all'Amministratore.");
      setTimeout(() => setAvvisoTemporaneo(null), 5000);
      setAccountDaEliminare(null);
      return;
    }
    const eliminatoNome = `${accountDaEliminare.nome} ${accountDaEliminare.cognome} (${accountDaEliminare.qualifica})`;
    const eliminatoId = accountDaEliminare.id;
    if (onEliminaVolontario) {
      onEliminaVolontario(eliminatoId);
    } else {
      const aggiornati = volontari.filter((v) => v.id !== eliminatoId);
      onAggiornaVolontari(aggiornati);
    }
    const stavaModificandoEliminato = volontarioInModifica?.id === eliminatoId;
    if (stavaModificandoEliminato) {
      setVolontarioInModifica(null);
      chiudiModaleEdit();
    }
    onNotificaRadio(`🗑️ CENTRALE: Rimosso account ${eliminatoNome} dal database`, 'centrale');
    setAvvisoTemporaneo(`🗑️ Account ${accountDaEliminare.nome} ${accountDaEliminare.cognome} eliminato definitivamente.`);
    setTimeout(() => setAvvisoTemporaneo(null), 4000);
    setAccountDaEliminare(null);
  };

  const resettaPinaZero = (volontario: Volontario) => {
    const nuovoPIN = '0000';
    const aggiornati = volontari.map((v) =>
      v.id === volontario.id ? { ...v, pin: nuovoPIN } : v
    );
    onAggiornaVolontari(aggiornati);
    onNotificaRadio(`CENTRALE: PIN del volontario ${volontario.nome} ${volontario.cognome} reimpostato dall'Amministratore (PIN riservato)`, 'allarme');
  };

  const esportaJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(volontari, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Database_Volontari_Croce_Oro_${formatISODateItaly()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importaJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setAvvisoTemporaneo('⚠️ Il file selezionato non contiene un backup volontari JSON valido.');
          setTimeout(() => setAvvisoTemporaneo(null), 5000);
          return;
        }
        const validItems = listRaw.filter(
          (item: any) =>
            item &&
            typeof item === 'object' &&
            (typeof item.nome === 'string' || typeof item.cognome === 'string' || typeof item.id === 'string')
        ) as Volontario[];
        if (validItems.length === 0) {
          setAvvisoTemporaneo('⚠️ Nessun profilo valido trovato nel file di backup.');
          setTimeout(() => setAvvisoTemporaneo(null), 5000);
          return;
        }
        const merged = mergeVolontariListsSafe(volontari, validItems);
        onAggiornaVolontari(merged);
        onNotificaRadio(
          `📥 CENTRALE: Importato backup volontari JSON (${validItems.length} profili letti, totale ${merged.length} in archivio)`,
          'centrale'
        );
        setAvvisoTemporaneo(`✅ Importati/aggiornati ${validItems.length} profili dal backup JSON! Ora in archivio: ${merged.length} profili.`);
        setTimeout(() => setAvvisoTemporaneo(null), 5500);
      } catch {
        setAvvisoTemporaneo('⚠️ Errore lettura file JSON: verifica che il file non sia danneggiato.');
        setTimeout(() => setAvvisoTemporaneo(null), 5000);
      }
    };
    reader.readAsText(file);
  };

  const inTurnoCount = volontari.filter((v) => Boolean(getTimbraturaAttiva(v))).length;
  const loggatiCount = volontari.filter((v) => Boolean(v.loggato)).length;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-start sm:justify-center p-1 sm:p-2.5 overflow-y-auto">
      {!(initialAction?.directOnly && modaleEditAperta) && (
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-[98vw] max-w-[99vw] 2xl:max-w-[1720px] my-auto max-h-[96dvh] md:max-h-[95vh] flex flex-col shadow-2xl overflow-y-auto md:overflow-hidden overscroll-contain touch-pan-y text-slate-100"
      >
        
        {/* Intestazione Fissa Modale Database Profili */}
        <div
          className="bg-slate-950 p-3 sm:p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-30"
        >
          <div className="flex items-center gap-2.5">
            <CroceOroLogo size="md" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wide text-white">
                  {titoloDbVolontari} • Profili &amp; Gestione PIN
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/40" title="Account con timbratura di ingresso attiva">
                  {inTurnoCount} In Turno
                </span>
                {loggatiCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-sky-500/20 text-sky-300 border-sky-500/40" title="Account attualmente loggati nell'app">
                    {loggatiCount} Loggat{loggatiCount === 1 ? 'o' : 'i'}
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/40">
                  {volontari.length} Totali
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Archivio autorizzato: Account Amministratore, Operatori di Centrale e Volontari
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalAccessoWebAperta(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border-sky-500/30"
              title="Indirizzo Web e Guida per accedere da qualsiasi computer fisso o portatile tramite browser"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Accesso Web PC</span>
              <span className="sm:hidden">Web PC</span>
            </button>
            <button
              onClick={apriAggiungiVolontario}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border-2 border-amber-700"
              style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuovo Account</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer border bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700"
              title="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra di Selezione Sotto-Sezione Database (Anagrafiche vs Mansioni) */}
        <div className="bg-slate-950 px-3 sm:px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setVistaDatabaseModal('profili')}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                vistaDatabaseModal === 'profili'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. Elenco Profili ({volontari.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setVistaDatabaseModal('mansioni')}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                vistaDatabaseModal === 'mansioni'
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Award className="w-4 h-4 text-blue-400" />
              <span>2. Mansioni & Competenze ({catalogoMansioni.length})</span>
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-200 font-mono">
                Catalogo & Assegnazione
              </span>
            </button>
          </div>

          {vistaDatabaseModal === 'mansioni' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRipristinaMansioniDefaultModal}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-md"
                title="Ripristina le mansioni predefinite standard della Croce Oro"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Ripristina Predefinite</span>
              </button>
              <button
                type="button"
                onClick={handleApriCreaMansioneModal}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Crea Nuova Mansione</span>
              </button>
            </div>
          )}
        </div>

        {/* CORPO SCORRIBILE UNICO (Su mobile scorre insieme all'intestazione; su desktop resta ancorato al centro) */}
        <div className="shrink-0 md:shrink md:flex-1 md:overflow-y-auto md:min-h-0 md:overscroll-contain touch-pan-y divide-y divide-slate-800/80 bg-slate-900">
          {avvisoTemporaneo && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 md:sticky md:top-0 z-30 backdrop-blur-md">
              <span className="font-semibold">{avvisoTemporaneo}</span>
              <button
                type="button"
                onClick={() => setAvvisoTemporaneo(null)}
                className="text-amber-300 hover:text-white cursor-pointer ml-2 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {vistaDatabaseModal === 'mansioni' ? (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Header Sezione Mansioni */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/60 border border-blue-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    🎖️
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Catalogo Mansioni Operative & Competenze</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-mono">
                        {catalogoMansioni.length} Mansioni
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Crea e modifica mansioni, categorie e relative genitorialità: ogni aggiornamento è attivo subito su tutti i dispositivi.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleApriCreaCategoriaModal}
                    className="px-3 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 border border-purple-500/40 active:scale-95 transition-all cursor-pointer shadow-md"
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-300" />
                    <span>+ Nuova Categoria</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRipristinaMansioniDefaultModal}
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-md"
                    title="Ripristina le mansioni predefinite standard della Croce Oro"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ripristina Predefinite</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApriCreaMansioneModal}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-blue-900/30 active:scale-95 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Crea Nuova Mansione</span>
                  </button>
                </div>
              </div>

              {/* Riquadro Categorie Mansioni & Genitorialità */}
              <div className="bg-slate-950/90 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-purple-200 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>Gestione Categorie Mansioni & Genitorialità ({categorieMansioni.length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Modifica il nome, l'icona o la categoria genitore. Le modifiche vengono propagate immediatamente a tutti i dispositivi connessi.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRipristinaCategorieDefaultModal}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-amber-400" />
                      <span>Ripristina Categorie</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApriCreaCategoriaModal}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Categoria</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {categorieMansioni.map(cat => {
                    const parentCat = cat.parentCategoriaId
                      ? categorieMansioni.find(p => p.id === cat.parentCategoriaId)
                      : undefined;
                    const countMans = catalogoMansioni.filter(m => m.categoria === cat.nome).length;
                    return (
                      <div
                        key={cat.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0 inline-flex items-center justify-center">
                            <IconaEmoji value={cat.badgeEmoji} fallback="📁" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{cat.nome}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                              <span>{countMans} mansioni</span>
                              {parentCat && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold inline-flex items-center gap-1">
                                  <span>Genitore:</span>
                                  <IconaEmoji value={parentCat.badgeEmoji} fallback="" />
                                  <span>{parentCat.nome}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApriModificaCategoriaModal(cat)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 cursor-pointer"
                            title="Modifica categoria e genitorialità"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {categorieMansioni.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleEliminaCategoriaModal(cat)}
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

              {/* Riquadro 1: Catalogo Mansioni Infinite */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-400" />
                      <span>Catalogo Mansioni Disponibili ({catalogoMansioni.filter(m => filtroCategoriaMansioneModal === 'tutte' || m.categoria === filtroCategoriaMansioneModal).length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tutte le mansioni attive dell'associazione utilizzabili per turni, schede e fascicoli personali.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={filtroCategoriaMansioneModal}
                      onChange={(e) => setFiltroCategoriaMansioneModal(e.target.value)}
                      className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="tutte">Tutte le Categorie</option>
                      {categorieMansioni.map(cat => {
                        const icoTxt = formatIconaPerTesto(cat.badgeEmoji, '📁');
                        return (
                          <option key={cat.id} value={cat.nome}>
                            {icoTxt ? `${icoTxt} ` : ''}{cat.nome}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Card Mansioni */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {catalogoMansioni
                    .filter(m => filtroCategoriaMansioneModal === 'tutte' || m.categoria === filtroCategoriaMansioneModal)
                    .map((m) => {
                      const countVol = volontari.filter(v => getMansioniVolontario(v).includes(m.nome)).length;
                      const parentMansione = m.parentMansioneId
                        ? catalogoMansioni.find(pm => pm.id === m.parentMansioneId)
                        : undefined;

                      return (
                        <div
                          key={m.id}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-md group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-2xl p-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0 inline-flex items-center justify-center w-10 h-10">
                                  <IconaEmoji value={m.badgeEmoji} fallback="🏷️" />
                                </span>
                                <div className="min-w-0">
                                  <h5 className="font-bold text-white text-xs truncate leading-snug" title={m.nome}>
                                    {m.nome}
                                  </h5>
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {m.categoria}
                                  </span>
                                  {parentMansione && (
                                    <span className="text-[9.5px] text-amber-300 font-semibold inline-flex items-center gap-1 truncate mt-0.5">
                                      <span>↳ Genitore:</span>
                                      <IconaEmoji value={parentMansione.badgeEmoji} fallback="" />
                                      <span>{parentMansione.nome}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleApriModificaMansioneModal(m)}
                                  className="text-slate-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-950/40 transition-colors cursor-pointer"
                                  title="Modifica mansione (nome, categoria, genitorialità, emoji, requisiti)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEliminaMansioneModal(m.id, m.nome)}
                                  className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/40 transition-colors cursor-pointer"
                                  title="Elimina mansione dal catalogo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {m.descrizione && (
                              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                                {m.descrizione}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.coloreBg} ${m.coloreTesto} ${m.coloreBorder}`}>
                              Badge Anteprima
                            </span>
                            <span className="text-slate-400 font-mono flex items-center gap-1 font-semibold">
                              <Users className="w-3 h-3 text-blue-400" />
                              <span>{countVol} {countVol === 1 ? 'volontario' : 'volontari'}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Riquadro 2: Assegnazione Contemporanea Multipla & Massiva */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Assegnazione Multipla & Contemporanea Mansioni</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Seleziona una o più mansioni dal catalogo, seleziona uno o più volontari e applica l'azione con un clic.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5">
                  {/* Step 1: Mansioni */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                        <span>Seleziona le Mansioni da Assegnare Contemporaneamente:</span>
                      </label>
                      {selectedMansioniNomiModal.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedMansioniNomiModal([])}
                          className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          Deseleziona Mansioni ({selectedMansioniNomiModal.length})
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                      {catalogoMansioni.map((m) => {
                        const isSel = selectedMansioniNomiModal.includes(m.nome);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (isSel) {
                                setSelectedMansioniNomiModal(selectedMansioniNomiModal.filter(nome => nome !== m.nome));
                              } else {
                                setSelectedMansioniNomiModal([...selectedMansioniNomiModal, m.nome]);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                              isSel
                                ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-1 ring-blue-300'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
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
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                    <div className="text-xs text-slate-300 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                      <span>
                        Applicazione a <strong>{selectedVolontariMansioniModalIds.length}</strong> volontari con <strong>{selectedMansioniNomiModal.length}</strong> mansioni scelte:
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={selectedVolontariMansioniModalIds.length === 0 || selectedMansioniNomiModal.length === 0}
                        onClick={() => handleAssegnaMansioniMassiveModal('aggiungi')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md ${
                          selectedVolontariMansioniModalIds.length > 0 && selectedMansioniNomiModal.length > 0
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
                        disabled={selectedVolontariMansioniModalIds.length === 0 || selectedMansioniNomiModal.length === 0}
                        onClick={() => handleAssegnaMansioniMassiveModal('sostituisci')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md ${
                          selectedVolontariMansioniModalIds.length > 0 && selectedMansioniNomiModal.length > 0
                            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                        title="Sostituisci esattamente: imposta solo queste mansioni"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Sostituisci Esattamente (=)</span>
                      </button>

                      <button
                        type="button"
                        disabled={selectedVolontariMansioniModalIds.length === 0 || selectedMansioniNomiModal.length === 0}
                        onClick={() => handleAssegnaMansioniMassiveModal('rimuovi')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md ${
                          selectedVolontariMansioniModalIds.length > 0 && selectedMansioniNomiModal.length > 0
                            ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                        title="Rimuovi le mansioni selezionate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Rimuovi Mansioni (-)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabella Selezione Volontari */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedVolontariMansioniModalIds.length === volontari.length) {
                            setSelectedVolontariMansioniModalIds([]);
                          } else {
                            setSelectedVolontariMansioniModalIds(volontari.map(v => v.id));
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        {selectedVolontariMansioniModalIds.length === volontari.length && volontari.length > 0 ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                            <span>Deseleziona Tutti ({selectedVolontariMansioniModalIds.length})</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>Seleziona Tutti ({volontari.length})</span>
                          </>
                        )}
                      </button>
                      {selectedVolontariMansioniModalIds.length > 0 && (
                        <span className="text-xs text-blue-300 font-bold">
                          {selectedVolontariMansioniModalIds.length} selezionati
                        </span>
                      )}
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={ricercaMansioniModal}
                        onChange={(e) => setRicercaMansioniModal(e.target.value)}
                        placeholder="Filtra volontario o matricola..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-950 text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">Sel.</th>
                            <th className="py-2.5 px-3">Volontario</th>
                            <th className="py-2.5 px-3">Mansione Principale</th>
                            <th className="py-2.5 px-3">Tutte le Mansioni Assegnate Contemporaneamente</th>
                            <th className="py-2.5 px-3 text-right">Fascicolo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {volontari
                            .filter(v => {
                              if (!ricercaMansioniModal.trim()) return true;
                              const q = ricercaMansioniModal.toLowerCase();
                              return `${v.nome} ${v.cognome}`.toLowerCase().includes(q) || (v.matricola && v.matricola.toLowerCase().includes(q));
                            })
                            .map((v) => {
                              const isSel = selectedVolontariMansioniModalIds.includes(v.id);
                              const mansioni = getMansioniVolontario(v);
                              const mansionePrinc = getMansionePrincipale(v);
                              const stilePrinc = getStileMansione(mansionePrinc, catalogoMansioni);

                              return (
                                <tr key={v.id} className={`hover:bg-slate-800/40 transition-colors ${isSel ? 'bg-blue-950/20' : ''}`}>
                                  <td className="py-2.5 px-3 text-center align-middle">
                                    <input
                                      type="checkbox"
                                      checked={isSel}
                                      onChange={() => {
                                        if (isSel) {
                                          setSelectedVolontariMansioniModalIds(selectedVolontariMansioniModalIds.filter(id => id !== v.id));
                                        } else {
                                          setSelectedVolontariMansioniModalIds([...selectedVolontariMansioniModalIds, v.id]);
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 align-middle">
                                    <div className="font-bold text-white text-xs">{v.nome} {v.cognome}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">Matr: {v.matricola || 'N/D'}</div>
                                  </td>
                                  <td className="py-2.5 px-3 align-middle">
                                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${stilePrinc.coloreBg} ${stilePrinc.coloreTesto} ${stilePrinc.coloreBorder}`}>
                                      <IconaEmoji value={stilePrinc.badgeEmoji} fallback="🏷️" />
                                      <span>{mansionePrinc}</span>
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 align-middle">
                                    <div className="flex flex-wrap gap-1">
                                      {mansioni.map((mNome, idx) => {
                                        const stile = getStileMansione(mNome, catalogoMansioni);
                                        const isP = mNome === mansionePrinc;
                                        return (
                                          <span
                                            key={idx}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                                              isP ? `${stile.coloreBg} ${stile.coloreTesto} ${stile.coloreBorder}` : 'bg-slate-950 text-slate-300 border-slate-700'
                                            }`}
                                          >
                                            <IconaEmoji value={stile.badgeEmoji} fallback="🏷️" />
                                            <span>{mNome}</span>
                                            {isP && <span className="text-[8px] opacity-75">★</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right align-middle">
                                    <button
                                      type="button"
                                      onClick={() => apriModificaVolontario(v)}
                                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3 text-blue-400" />
                                      <span>Fascicolo</span>
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
              </div>
            </div>
          ) : (
            <>
              {/* VISTA 1: ELENCO PROFILI & ANAGRAFICHE */}
              {/* Barra Ricerca e Strumenti Sticky */}
              <div
                className="md:sticky md:top-0 p-2.5 sm:p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs z-20"
              >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca nome, telefono, email, qualifica, matricola o PIN..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setMostraTuttiPIN(!mostraTuttiPIN)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Mostra o nascondi tutti i PIN nel database"
              >
                {mostraTuttiPIN ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
                <span className="hidden sm:inline">{mostraTuttiPIN ? 'Nascondi PIN' : 'Mostra Tutti i PIN'}</span>
                <span className="sm:hidden">{mostraTuttiPIN ? 'Nascondi' : 'Mostra PIN'}</span>
              </button>

              <button
                type="button"
                onClick={esportaJSON}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Esporta database in formato JSON di backup"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Esporta Backup</span>
                <span className="sm:hidden">Backup</span>
              </button>

              {isAdminEffettivo && (
                <label
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Importa un file JSON esportato da un altro PC/browser per ricaricare i profili mancanti"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Importa Backup</span>
                  <span className="sm:hidden">Importa</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={importaJSON}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Sezione Operatori Centrale (1 Amministratore + 4 Operatori) */}
          <div className="bg-slate-950/80 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Radio className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  Profili di Accesso Centrale (1 Amministratore + 10 Operatori)
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {operatoriCentrale.length}/10 Slot Occupati
                </span>
                {inAttesaCount > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                    🚨 {inAttesaCount} In Attesa Approvazione
                  </span>
                )}
              </div>

              {slotLiberiCentrale > 0 && (
                <button
                  type="button"
                  onClick={apriAggiungiOperatoreCentrale}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Operatore ({slotLiberiCentrale} liberi)</span>
                </button>
              )}
            </div>

            {/* Griglia Slot Accesso Centrale Compatta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 text-xs">
              
              {/* Slot 1: Account Amministratore */}
              <div className="bg-slate-900 border-2 border-amber-500/70 p-2.5 rounded-2xl flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                      Slot 1 • Admin
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400">● Attivo</span>
                  </div>
                  <div className="font-black text-white text-xs" style={{ color: '#ffffff' }}>Amministratore</div>
                  <div className="text-[10px] text-slate-400 font-mono">Centrale Principale</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-400 text-[10px]">PIN Admin:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-amber-300 bg-black/60 px-1.5 py-0.5 rounded border border-slate-700">
                      {mostraTuttiPIN || pinVisibili['admin-slot-1'] ? '4451' : '••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePinSingolo('admin-slot-1')}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                      title={mostraTuttiPIN || pinVisibili['admin-slot-1'] ? 'Nascondi PIN' : 'Mostra PIN'}
                    >
                      {mostraTuttiPIN || pinVisibili['admin-slot-1'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Slot 2..11: Operatori Centrale (10 slot) */}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((slotIdx) => {
                const op = operatoriCentrale[slotIdx];
                const slotNumero = slotIdx + 2;

                if (op) {
                  const isApproved = !!op.approvato;
                  const isPinVis = mostraTuttiPIN || pinVisibili[op.id];

                  return (
                    <div
                      key={op.id}
                      className={`bg-slate-900 border p-2.5 rounded-2xl flex flex-col justify-between shadow-md transition-all ${
                        !isApproved
                          ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-950/25'
                          : 'border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1 gap-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded truncate">
                            Slot {slotNumero} • Op.
                          </span>
                          {!isApproved ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 animate-pulse">
                              In Attivazione
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-400">● Abilitato</span>
                          )}
                        </div>
                        <div className="font-bold text-white text-xs truncate" style={{ color: '#ffffff' }}>
                          {op.nome} {op.cognome}
                        </div>
                        {/* Carica Consiglio Direttivo (Modificabile in qualsiasi momento) */}
                        <div className="mt-1">
                          <select
                            value={op.caricaConsiglioDirettivo || 'Nessuna'}
                            onChange={(e) => cambiaCaricaConsiglioDirettivo(op, e.target.value as CaricaConsiglioDirettivo)}
                            className="w-full text-[9px] font-bold py-0.5 px-1 rounded bg-slate-950 border border-amber-500/40 text-amber-300 focus:outline-none"
                            title="Indica il ruolo all'interno del Consiglio Direttivo"
                          >
                            <option value="Nessuna">Nessuna Carica Direttivo</option>
                            <option value="Presidente / Legale Rappresentante">Presidente / Legale Rappresentante</option>
                            <option value="Vicepresidente">Vicepresidente</option>
                            <option value="Tesoriere">Tesoriere</option>
                            <option value="Segretario">Segretario</option>
                            <option value="Consigliere">Consigliere</option>
                          </select>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {op.matricola || `OP-0${slotIdx + 1}`} • {op.telefono || 'No tel'}
                        </div>
                        {op.email && (
                          <div className="text-[10px] text-amber-300/90 font-mono truncate flex items-center gap-1 mt-0.5">
                            <Mail className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span className="truncate">{op.email}</span>
                          </div>
                        )}
                        {op.richiedeResetPassword && (
                          <div className="mt-1">
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Reset Richiesto
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-slate-400 text-[10px]">PIN:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-amber-300 bg-black/60 px-1.5 py-0.5 rounded border border-slate-700">
                              {isPinVis ? op.pin : '••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePinSingolo(op.id)}
                              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                              title={isPinVis ? 'Nascondi PIN' : 'Mostra PIN'}
                            >
                              {isPinVis ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Indicatore Firma Digitale con Trasparenza */}
                        <div className="flex items-center justify-between text-[10px] bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400 flex items-center gap-1 font-mono">
                            <PenTool className="w-2.5 h-2.5 text-amber-400" /> Firma:
                          </span>
                          {op.firmaBase64 ? (
                            <button
                              type="button"
                              onClick={() => apriGestioneFirmaRapida(op)}
                              className="text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                              title="Firma trasparente registrata. Clicca per visualizzare o aggiornare con rimozione sfondo bianco."
                            >
                              <span>Trasparente ✓</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => apriGestioneFirmaRapida(op)}
                              className="text-amber-300 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                              title="Nessuna firma. Clicca per caricare un'immagine con rimozione automatica sfondo bianco."
                            >
                              <Upload className="w-2.5 h-2.5 text-amber-400" />
                              <span>Carica Firma</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 pt-0.5">
                          {!isApproved ? (
                            <button
                              type="button"
                              onClick={() => approvaOperatoreCentrale(op)}
                              className="flex-1 py-1 px-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                              title="Approva operatore ed abilita l'accesso alla Centrale"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approva</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => sospendiOperatoreCentrale(op)}
                              className="flex-1 py-1 px-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[9px] uppercase rounded-lg transition-all text-center cursor-pointer"
                              title="Sospendi temporaneamente l'accesso"
                            >
                              Sospendi
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => apriModificaVolontario(op)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Modifica anagrafica, foto, documenti, patente e vestiario di ${op.nome}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => retrocediAVolontario(op)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Retrocedi ${op.nome} a Volontario Soccorso (rimuove da Operatore Centrale e dal Consiglio Direttivo)`}
                          >
                            <ArrowDownCircle className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScaricaSchedaVestiario(op)}
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Scarica Scheda Vestiario & DPI (PDF) per ${op.nome}`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScaricaRicevuta(op)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Scarica Ricevuta Tesseramento & Quota Associativa (PDF a firma Tesoriera) per ${op.nome}`}
                          >
                            <Receipt className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => apriCompilazioneDomandaIscrizione(op)}
                            className="p-1 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Compila e scarica Domanda di Iscrizione Socio / Operatore (PDF) per ${op.nome}`}
                          >
                            <FileDown className="w-3.5 h-3.5 text-sky-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => invitaAResettarePassword(op)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title={`Invia invito via email a ${op.nome} per resettare la password/PIN`}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          {canDeleteEffettivo && (
                            <button
                              type="button"
                              onClick={() => setAccountDaEliminare(op)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Elimina operatore e libera lo slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Slot libero
                return (
                  <div
                    key={`slot-empty-${slotNumero}`}
                    onClick={apriAggiungiOperatoreCentrale}
                    className="bg-slate-900/40 border-2 border-dashed border-slate-800 hover:border-amber-500/60 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-850/60 min-h-[95px]"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded mb-1">
                      Slot {slotNumero}
                    </span>
                    <UserPlus className="w-4 h-4 text-slate-600 my-1 group-hover:text-amber-400" />
                    <span className="text-[11px] font-bold text-slate-400">Slot Libero</span>
                    <span className="text-[9px] text-slate-500">+ Assegna PIN</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notifica Invito Reset Password o Avvisi */}
          {notificaResetInviata && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 text-xs text-amber-200 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>
                      Invito di reset PIN inviato a <strong>{notificaResetInviata.nome}</strong> ({notificaResetInviata.email}) &bull; PIN provvisorio:{' '}
                      <span className="font-mono font-black text-amber-300">{notificaResetInviata.pinProvvisorio}</span>
                    </div>
                    {notificaResetInviata.resetUrl && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <code className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] text-cyan-300 max-w-md truncate">
                          {notificaResetInviata.resetUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (notificaResetInviata.resetUrl) {
                              navigator.clipboard?.writeText(notificaResetInviata.resetUrl).catch(() => {});
                              setLinkCopiato(true);
                              setTimeout(() => setLinkCopiato(false), 2500);
                            }
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{linkCopiato ? 'Copiato!' : 'Copia Link'}</span>
                        </button>
                      </div>
                    )}
                    {notificaResetInviata.isProtectedHost && (
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-amber-500/40 text-[11px] text-amber-200 space-y-1.5 mt-1">
                        <div>
                          ℹ️ L&apos;email allega automaticamente <strong>Attivazione_PIN_Croce_Oro.html</strong> (funziona senza account Google / AI Studio). Per far aprire anche il collegamento web diretto su smartphone senza login Google, imposta il dominio pubblico (Vercel o <span className="font-mono">https://www.croceoro.org/reset-pin.html</span>):
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="url"
                            value={publicPortalUrlInput}
                            onChange={(e) => setPublicPortalUrlInput(e.target.value)}
                            placeholder="https://www.croceoro.org/reset-pin.html"
                            className="flex-1 min-w-[200px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px] font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const saved = realtime.syncPublicAppUrl(publicPortalUrlInput);
                              setPublicPortalUrlInput(saved);
                              setAvvisoTemporaneo(
                                saved
                                  ? `✅ URL Pubblico salvato (${saved}): i prossimi link email non richiederanno account Google!`
                                  : 'URL pubblico rimosso.'
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase cursor-pointer"
                          >
                            Salva URL Pubblico
                          </button>
                          <button
                            type="button"
                            onClick={() => scaricaPaginaHtmlResetPinPubblica()}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] cursor-pointer"
                            title="Scarica il file HTML autonomo da caricare su https://www.croceoro.org/reset-pin.html"
                          >
                            Scarica reset-pin.html per croceoro.org
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setNotificaResetInviata(null)}
                  className="text-amber-400 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* BANNER ALLERTA PATENTI DI GUIDA IN SCADENZA (≤ 7 GIORNI) PER AMMINISTRATORE */}
          {patentiInScadenza.length > 0 && (
            <div className="mx-3 sm:mx-4 mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-red-950/95 via-slate-900 to-rose-950/95 border-2 border-red-500 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <strong className="block text-red-100 font-black uppercase tracking-wide">
                    ⚠️ ALERT SCADENZA PATENTI: {patentiInScadenza.length} {patentiInScadenza.length === 1 ? 'patente in scadenza' : 'patenti in scadenza'} nei prossimi 7 giorni!
                  </strong>
                  <p className="text-[11px] text-red-300 truncate">
                    {patentiInScadenza.map(v => `${v.nome} ${v.cognome} (${v.patente?.categoria || 'B'}: scadenza ${v.patente?.dataScadenza})`).join(' • ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFiltroLivello('patenti-scadenza')}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs uppercase shrink-0 cursor-pointer shadow active:scale-95 transition-all"
              >
                Filtra Patenti in Scadenza
              </button>
            </div>
          )}

          {/* BANNER PROMEMORIA TIMBRO CARTACEO PER ISCRITTI A FINE ANNO PRECEDENTE (QUOTA GIÀ COMPRESA) */}
          {iscrittiAutunnoAnnoPrecDaVidimare.length > 0 && (
            <div className="mx-3 sm:mx-4 mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-950/95 via-slate-900 to-yellow-950/95 border-2 border-amber-400 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <Receipt className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <strong className="block text-amber-100 font-black uppercase tracking-wide">
                    🔔 PROMEMORIA TIMBRO TESSERA: {iscrittiAutunnoAnnoPrecDaVidimare.length} {iscrittiAutunnoAnnoPrecDaVidimare.length === 1 ? 'socio iscritto' : 'soci iscritti'} a fine {annoCorrente - 1} (Ott/Nov/Dic)
                  </strong>
                  <p className="text-[11px] text-amber-300">
                    Come da regolamento, la quota per il {annoCorrente} è <strong>già assolta (€ 0,00)</strong>: apponi il timbro sulla loro tessera cartacea senza richiedere la somma del rinnovo.
                  </p>
                  <p className="text-[10px] text-amber-400/90 font-mono mt-0.5 truncate">
                    Soci da vidimare: {iscrittiAutunnoAnnoPrecDaVidimare.map(v => `${v.nome} ${v.cognome} (Iscritto il ${v.tesseramento?.dataPrimaIscrizione || v.dataRegistrazione})`).join(' • ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFiltroLivello('timbro-tessera')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase shrink-0 cursor-pointer shadow active:scale-95 transition-all whitespace-nowrap"
              >
                Filtra Timbri da Fare ({iscrittiAutunnoAnnoPrecDaVidimare.length})
              </button>
            </div>
          )}

          {/* Barra Filtri Categoria / Livello Profilo Sticky */}
          <div className="md:sticky md:top-[52px] bg-slate-950/95 backdrop-blur-md px-3 sm:px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs z-10">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Filtra:</span>
              <button
                type="button"
                onClick={() => setFiltroLivello('tutti')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  filtroLivello === 'tutti'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Tutti i Profili ({volontari.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroLivello('volontari')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  filtroLivello === 'volontari'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Volontari Soccorso ({volontari.filter(v => !v.profiloCentrale && v.qualifica !== 'Operatore Centrale').length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroLivello('operatori')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  filtroLivello === 'operatori'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-slate-800 text-purple-300 hover:bg-slate-700'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>Operatori Centrale ({operatoriCentrale.length})</span>
              </button>
              {inAttesaCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroLivello('attesa')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    filtroLivello === 'attesa'
                      ? 'bg-amber-500 text-slate-950 shadow-sm animate-pulse'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-500/40 hover:bg-amber-900/80'
                  }`}
                >
                  <span>⏳ In Attesa ({inAttesaCount})</span>
                </button>
              )}
              {bloccatiCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroLivello('bloccati')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    filtroLivello === 'bloccati'
                      ? 'bg-red-500 text-white shadow-sm animate-pulse ring-2 ring-red-400'
                      : 'bg-red-950/90 text-red-300 border border-red-500/50 hover:bg-red-900/90'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                  <span>🚨 Bloccati ({bloccatiCount})</span>
                </button>
              )}
              {patentiInScadenza.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroLivello('patenti-scadenza')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    filtroLivello === 'patenti-scadenza'
                      ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400 animate-pulse'
                      : 'bg-rose-950/90 text-rose-300 border border-rose-500/50 hover:bg-rose-900/90'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>⚠️ Patenti Scadenza ({patentiInScadenza.length})</span>
                </button>
              )}
              {iscrittiAutunnoAnnoPrecDaVidimare.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroLivello('timbro-tessera')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    filtroLivello === 'timbro-tessera'
                      ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400'
                      : 'bg-amber-950/90 text-amber-300 border border-amber-500/50 hover:bg-amber-900/90 animate-pulse'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-400" />
                  <span>🏷️ Timbro Tessera ({iscrittiAutunnoAnnoPrecDaVidimare.length})</span>
                </button>
              )}
              {tessereDaRinnovareCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroLivello('tessera-scaduta')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    filtroLivello === 'tessera-scaduta'
                      ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                      : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                  }`}
                >
                  <span>⏳ Da Rinnovare ({tessereDaRinnovareCount})</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span>Visualizzati: <strong className="text-white">{volontariFiltrati.length}</strong> profili</span>
              <span className="hidden md:inline text-slate-600">•</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                <Clock className="w-3 h-3 text-emerald-400" />
                Ore Totali Timbrate Anno 2026: <strong>{totaleOreTuttiVolontariAnno} h</strong>
              </span>
            </div>
          </div>

          {/* LISTA ACCOUNT (Sia Volontari che Operatori di Centrale) */}
          <div className="p-3 sm:p-4">
            {volontariFiltrati.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                Nessun account trovato con i criteri selezionati.
              </div>
            ) : (
              <>
                {/* 1. VISTA SCHEDE TOUCH PER SMARTPHONE / ANDROID (< sm) */}
                <div className="block sm:hidden space-y-3">
                  {volontariFiltrati.map((v) => {
                    const isPinVisible = mostraTuttiPIN || pinVisibili[v.id];
                    const isOperatore = v.profiloCentrale || v.qualifica === 'Operatore Centrale';
                    const oreVol = calcolaOreAnnoVolontario(v);
                    return (
                      <div
                        key={v.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isOperatore
                            ? 'bg-slate-900/90 border-purple-500/40 shadow-md'
                            : 'bg-slate-900/70 border-slate-800'
                        }`}
                      >
                        {/* Intestazione Card: Foto Avatar, Nome e Badge Ruolo */}
                        <div className="flex items-start justify-between gap-2.5 mb-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {/* Avatar o Foto */}
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner">
                              {v.fotoBase64 ? (
                                <img src={v.fotoBase64} alt={v.nome} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-black text-xs text-amber-400">
                                  {v.nome[0]}{v.cognome[0]}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap" style={{ color: '#ffffff' }}>
                                <span className="font-bold text-white" style={{ color: '#ffffff' }}>{v.nome} {v.cognome}</span>
                                {v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo !== 'Nessuna' && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    ★ {v.caricaConsiglioDirettivo}
                                  </span>
                                )}
                                {(() => {
                                  const mansioni = getMansioniVolontario(v);
                                  const mansionePrinc = getMansionePrincipale(v);
                                  const secondarie = mansioni.filter(m => m !== mansionePrinc);
                                  const stilePrinc = getStileMansione(mansionePrinc, catalogoMansioni);

                                  return (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${stilePrinc.coloreBg} ${stilePrinc.coloreTesto} ${stilePrinc.coloreBorder}`}>
                                        <IconaEmoji value={stilePrinc.badgeEmoji} fallback="🏷️" />
                                        <span>{mansionePrinc}</span>
                                      </span>
                                      {secondarie.map((sec, idx) => {
                                        const stileSec = getStileMansione(sec, catalogoMansioni);
                                        return (
                                          <span
                                            key={idx}
                                            className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-900 text-slate-300 border border-slate-700 inline-flex items-center gap-0.5"
                                          >
                                            <IconaEmoji value={stileSec.badgeEmoji} fallback="🏷️" />
                                            <span>{sec}</span>
                                          </span>
                                        );
                                      })}
                                      {isOperatore && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                          <Radio className="w-2.5 h-2.5 text-purple-400" />
                                          CENTRALE
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Matr: {v.matricola || 'N/D'}</span>
                                {(() => {
                                  const tess = v.tesseramento;
                                  const isOttNovDic = haIscrizioneOttNovDicAnnoPrecedente(tess?.dataPrimaIscrizione, annoCorrente);
                                  if (isOttNovDic && !tess?.timbroCartaceoEseguito) {
                                    return (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded text-[9px] animate-pulse flex items-center gap-0.5">
                                          <Receipt className="w-2.5 h-2.5" />
                                          Timbro Da Fare (Quota Assolta)
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleSegnaTimbroEseguito(v)}
                                          className="px-1.5 py-0.2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[8px] rounded cursor-pointer"
                                        >
                                          Apposto ✓
                                        </button>
                                      </div>
                                    );
                                  }
                                  const st = calcolaStatoPeriodoRinnovo(tess, annoCorrente);
                                  return (
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      st.stato === 'rinnovata'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : st.stato === 'in_corso'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : st.stato === 'scaduta'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}>
                                      {st.label} {tess?.numeroRicevutaFormattato ? `• Ric. ${tess.numeroRicevutaFormattato}` : ''}
                                    </span>
                                  );
                                })()}
                                {v.patente?.inPossesso && v.patente?.dataScadenza && (() => {
                                  const st = calcolaStatoScadenzaPatente(v.patente.dataScadenza);
                                  if (!st) return null;
                                  if (st.inScadenza7Giorni || st.scaduta) {
                                    return (
                                      <span className="px-1.5 py-0.2 bg-red-600/90 text-white rounded text-[9px] font-black animate-pulse">
                                        ⚠️ Patente {st.label}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px]">
                                      Patente {v.patente.categoria || 'B'}
                                    </span>
                                  );
                                })()}
                                {v.vestiario && (() => {
                                  let count = 0;
                                  if (v.vestiario.tshirt?.some(p => p.consegnato)) count += v.vestiario.tshirt.filter(p => p.consegnato).length;
                                  if (v.vestiario.felpa?.consegnato) count++;
                                  if (v.vestiario.pile?.consegnato) count++;
                                  if (v.vestiario.pantaloni?.consegnato) count++;
                                  if (v.vestiario.giubbetto?.consegnato) count++;
                                  if (v.vestiario.giubbottoInvernale?.consegnato) count++;
                                  return count > 0 ? (
                                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-bold">
                                      🦺 Vestiario ({count} pz)
                                    </span>
                                  ) : null;
                                })()}
                                {/* Badge Ore Timbrate Anno 2026 */}
                                <span className="px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-[9px] font-bold flex items-center gap-1 shadow-sm font-mono" title="Ore di servizio timbrate nel 2026">
                                  <Clock className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>{oreVol.ore} h ({oreVol.turni} t)</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stato */}
                          <div className="shrink-0 text-right">
                            {(() => {
                              const timbAttiva = getTimbraturaAttiva(v);
                              const isDiTurno = Boolean(timbAttiva);
                              const isLoggato = Boolean(v.loggato);

                              if (isOperatore && !v.approvato) {
                                return (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950 animate-pulse">
                                    In Attivazione
                                  </span>
                                );
                              }

                              if (isDiTurno && timbAttiva) {
                                return (
                                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      IN TURNO
                                    </span>
                                    <span
                                      className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1"
                                      title={`Timbratura di ingresso registrata alle ${timbAttiva.orarioIngresso}${timbAttiva.sede ? ` (${timbAttiva.sede})` : ''}`}
                                    >
                                      <Clock className="w-2.5 h-2.5 text-cyan-400" />
                                      ⏱️ {timbAttiva.orarioIngresso}
                                    </span>
                                    {isLoggato && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                        ● Loggato
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (isLoggato) {
                                return (
                                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                      LOGGATO
                                    </span>
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                      title="Account loggato ma non ancora di turno: non ha effettuato la timbratura"
                                    >
                                      Non timbrato
                                    </span>
                                  </div>
                                );
                              }

                              if (isOperatore) {
                                return (
                                  <span className="text-[9px] font-bold text-emerald-400">
                                    ● Abilitato
                                  </span>
                                );
                              }

                              return (
                                <span className="text-[9px] text-slate-500">
                                  Fuori Turno
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Recapiti Obbligatori: Telefono ed Email */}
                        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 text-xs font-mono my-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Telefono:</span>
                            {v.telefono ? (
                              <a href={`tel:${v.telefono}`} className="text-amber-300 hover:underline flex items-center gap-1 font-bold">
                                <Phone className="w-3 h-3 text-amber-400" />
                                <span>{v.telefono}</span>
                              </a>
                            ) : (
                              <span className="text-red-400 text-[10px] italic">Non presente</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Email:</span>
                            {v.email ? (
                              <a href={`mailto:${v.email}`} className="text-slate-300 hover:text-amber-300 flex items-center gap-1 truncate max-w-[200px]">
                                <Mail className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{v.email}</span>
                              </a>
                            ) : (
                              <span className="text-red-400 text-[10px] italic">Non presente</span>
                            )}
                          </div>

                          {v.codiceFiscale && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">Cod. Fiscale:</span>
                              <span className="text-amber-300 font-bold font-mono text-[11px]">{v.codiceFiscale}</span>
                            </div>
                          )}

                          {v.indirizzoResidenza && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] text-slate-400 shrink-0">Residenza:</span>
                              <span className="text-slate-300 text-[10px] text-right font-sans truncate">{v.indirizzoResidenza}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-[10px] text-slate-400">PIN Personale:</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold font-mono tracking-widest ${isPinVisible ? 'text-amber-300' : 'text-slate-500'}`}>
                                {isPinVisible ? v.pin : '••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePinSingolo(v.id)}
                                className="p-1 text-slate-400 hover:text-white"
                                title={isPinVisible ? 'Nascondi PIN' : 'Mostra PIN'}
                              >
                                {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Firma Digitale con Rimozione Sfondo Bianco */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <PenTool className="w-3 h-3 text-amber-400" />
                              <span>Firma Digitale:</span>
                            </span>
                            {v.firmaBase64 ? (
                              <button
                                type="button"
                                onClick={() => apriGestioneFirmaRapida(v)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold hover:bg-emerald-900 transition-colors cursor-pointer"
                                title="Firma con sfondo trasparente presente. Clicca per visualizzare o aggiornare."
                              >
                                <div
                                  className="w-10 h-4 rounded bg-white p-0.5 border border-slate-400 flex items-center justify-center overflow-hidden shrink-0"
                                  style={{
                                    backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
                                    backgroundSize: '6px 6px'
                                  }}
                                >
                                  <img src={v.firmaBase64} alt="Firma" className="max-h-full max-w-full object-contain" />
                                </div>
                                <span>Trasparente ✓</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => apriGestioneFirmaRapida(v)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Nessuna firma. Clicca per caricare un'immagine: il bianco verrà rimosso automaticamente."
                              >
                                <Upload className="w-2.5 h-2.5 text-amber-400" />
                                <span>Carica Firma</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sezione Speciale: Decisione Amministratore per Blocco 3 Tentativi PIN */}
                        {(v.bloccatoPerTentativi || (v.tentativiErrati && v.tentativiErrati >= 3)) && (
                          <div className="mb-3 p-3 rounded-2xl bg-red-950/70 border-2 border-red-500/70 text-xs text-red-200 space-y-2 shadow-md">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-red-400 flex items-center gap-1.5 uppercase text-[11px]">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                                Bloccato per 3 Errori PIN
                              </span>
                              {v.dataBlocco && <span className="text-[10px] font-mono text-red-300">{v.dataBlocco}</span>}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-tight">
                              Decidi l'azione per questo account: azzera gli sbagli per consentire l'accesso o invia l'invito per reimpostare la password/PIN.
                            </p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => azzeraSbagliESblocca(v)}
                                className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow"
                                title="Azzera il conteggio degli errori e sblocca l'account"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Azzera Sbagli</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => azzeraESpedisciInvitoReset(v)}
                                className="py-2 px-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-[11px] rounded-xl flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow"
                                title="Azzera errori, sblocca e invia invito email per reimpostare il PIN"
                              >
                                <Mail className="w-3.5 h-3.5 text-slate-950" />
                                <span>Azzera & Invita</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Avviso reset se richiesto */}
                        {v.richiedeResetPassword && (
                          <div className="mb-2.5 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 flex items-center gap-1.5">
                            <KeyRound className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Richiesta reimpostazione password inviata</span>
                          </div>
                        )}

                        {/* Barra Azioni Amministratore (Pulsanti Touch Grandi e Protetti da Overflow) */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-800/80">
                          {isOperatore && !v.approvato && (
                            <button
                              type="button"
                              onClick={() => approvaOperatoreCentrale(v)}
                              className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approva</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => invitaAResettarePassword(v)}
                            className="flex-1 min-w-[130px] py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer truncate"
                            title={`Invia invito via email a ${v.nome} per resettare la password/PIN`}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">Invita al Reset</span>
                          </button>

                          {/* Scarica Scheda Vestiario & DPI PDF */}
                          <button
                            type="button"
                            onClick={() => handleScaricaSchedaVestiario(v)}
                            className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 active:scale-95 shadow-sm"
                            title={`Scarica Scheda Vestiario, Documenti e DPI (PDF) per ${v.nome} ${v.cognome}`}
                          >
                            <FileDown className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Scheda</span>
                          </button>

                          {/* Scarica Ricevuta Tesseramento (PDF a firma Tesoriera) */}
                          <button
                            type="button"
                            onClick={() => handleScaricaRicevuta(v)}
                            className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 active:scale-95 shadow-sm"
                            title={`Scarica Ricevuta Tesseramento & Quota Associativa (PDF a firma Tesoriera) per ${v.nome} ${v.cognome}`}
                          >
                            <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Ricevuta</span>
                          </button>

                          {/* Scarica / Compila Domanda Iscrizione (PDF) */}
                          <button
                            type="button"
                            onClick={() => apriCompilazioneDomandaIscrizione(v)}
                            className="p-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 active:scale-95 shadow-sm"
                            title={`Compila e scarica Domanda di Iscrizione Socio / Volontario (PDF) per ${v.nome} ${v.cognome}`}
                          >
                            <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                            <span>Domanda</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => apriModificaVolontario(v)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer shrink-0"
                            title="Modifica anagrafica e PIN"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => resettaPinaZero(v)}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition-all cursor-pointer shrink-0"
                            title="Resetta PIN di emergenza a 0000"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>

                          {canDeleteEffettivo && (
                            <button
                              type="button"
                              onClick={() => setAccountDaEliminare(v)}
                              className="p-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
                              title={`Rimuovi definitivamente l'account di ${v.nome} ${v.cognome}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. VISTA TABELLARE PER SCHERMI GRANDI (>= sm) */}
                <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
                  <table className="w-full min-w-[920px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[10.5px] uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-3 w-[26%] min-w-[190px]">Account Profilo</th>
                        <th className="py-3.5 px-2.5 min-w-[140px]">Mansione & Competenze</th>
                        <th className="py-3.5 px-2.5 w-[19%] min-w-[150px]">Recapiti Obbligatori</th>
                        <th className="py-3.5 px-2 w-[11%] min-w-[90px] text-center">Firma Digitale</th>
                        <th className="py-3.5 px-2 w-[9%] min-w-[85px] text-center">PIN Personale</th>
                        <th className="py-3.5 px-2 w-[10%] min-w-[90px]">Stato Account</th>
                        <th className="py-3.5 px-2.5 w-[220px] min-w-[210px] max-w-[230px] text-right border-l border-slate-800">
                          Azioni Amministratore
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {volontariFiltrati.map((v) => {
                        const isPinVisible = mostraTuttiPIN || pinVisibili[v.id];
                        const isOperatore = v.profiloCentrale || v.qualifica === 'Operatore Centrale';

                        return (
                          <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                            
                            {/* Nome, Cognome, Matricola, Foto Avatar */}
                            <td className="py-4.5 sm:py-5 px-3 w-[26%] min-w-[190px] align-middle">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner">
                                  {v.fotoBase64 ? (
                                    <img src={v.fotoBase64} alt={v.nome} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-black text-xs text-amber-400 font-mono">
                                      {v.nome[0]}{v.cognome[0]}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap" style={{ color: '#ffffff' }}>
                                    <span className="font-bold text-white" style={{ color: '#ffffff' }}>{v.nome} {v.cognome}</span>
                                    {v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo !== 'Nessuna' && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        ★ {v.caricaConsiglioDirettivo}
                                      </span>
                                    )}
                                    {isOperatore && (
                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                        Centrale
                                      </span>
                                    )}
                                    {v.domandaIscrizioneFirmata && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const a = document.createElement('a');
                                          a.href = v.domandaIscrizioneFirmata!.fileBase64;
                                          a.download = v.domandaIscrizioneFirmata!.nomeFile;
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                        }}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1 hover:underline cursor-pointer"
                                        title={`Domanda di Iscrizione firmata archiviata: ${v.domandaIscrizioneFirmata.nomeFile} (${v.domandaIscrizioneFirmata.dataUpload})`}
                                      >
                                        <FileCheck className="w-2.5 h-2.5 text-teal-400" />
                                        <span>Domanda Firmata ✓</span>
                                      </button>
                                    )}
                                  </div>
                                  {isOperatore && (
                                    <div className="mt-1 flex items-center gap-1.5">
                                      <span className="text-[9px] text-slate-400 font-semibold">Direttivo:</span>
                                      <select
                                        value={v.caricaConsiglioDirettivo || 'Nessuna'}
                                        onChange={(e) => cambiaCaricaConsiglioDirettivo(v, e.target.value as CaricaConsiglioDirettivo)}
                                        className="text-[9px] font-bold py-0.5 px-1.5 rounded bg-slate-950 border border-amber-500/40 text-amber-300 focus:outline-none"
                                        title="Modifica in qualsiasi momento la carica nel Consiglio Direttivo"
                                      >
                                        <option value="Nessuna">Nessuna Carica</option>
                                        <option value="Presidente / Legale Rappresentante">Presidente / Legale Rappresentante</option>
                                        <option value="Vicepresidente">Vicepresidente</option>
                                        <option value="Tesoriere">Tesoriere</option>
                                        <option value="Segretario">Segretario</option>
                                        <option value="Consigliere">Consigliere</option>
                                      </select>
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span>Matr: {v.matricola || 'N/D'}</span>
                                    {(() => {
                                      const tess = v.tesseramento;
                                      const isOttNovDic = haIscrizioneOttNovDicAnnoPrecedente(tess?.dataPrimaIscrizione, annoCorrente);
                                      if (isOttNovDic && !tess?.timbroCartaceoEseguito) {
                                        return (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded text-[9px] animate-pulse flex items-center gap-0.5">
                                              <Receipt className="w-2.5 h-2.5" />
                                              Timbro Da Fare (Quota Compresa)
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleSegnaTimbroEseguito(v)}
                                              className="px-1.5 py-0.2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[8px] cursor-pointer"
                                              title="Conferma apposizione timbro cartaceo"
                                            >
                                              Apposto ✓
                                            </button>
                                          </div>
                                        );
                                      }
                                      const st = calcolaStatoPeriodoRinnovo(tess, annoCorrente);
                                      return (
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          st.stato === 'rinnovata'
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                            : st.stato === 'in_corso'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            : st.stato === 'scaduta'
                                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                            : 'bg-slate-800 text-slate-400'
                                        }`}>
                                          {st.label} {tess?.numeroRicevutaFormattato ? `• Ric. ${tess.numeroRicevutaFormattato}` : ''}
                                        </span>
                                      );
                                    })()}
                                    {v.codiceFiscale && (
                                      <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-950/60 px-1 py-0.2 rounded border border-amber-500/30">
                                        CF: {v.codiceFiscale}
                                      </span>
                                    )}
                                    {v.patente?.inPossesso && v.patente?.dataScadenza && (() => {
                                      const st = calcolaStatoScadenzaPatente(v.patente.dataScadenza);
                                      if (!st) return null;
                                      if (st.inScadenza7Giorni || st.scaduta) {
                                        return (
                                          <span className="px-1.5 py-0.2 bg-red-600/90 text-white rounded text-[9px] font-black animate-pulse">
                                            ⚠️ Patente {st.label}
                                          </span>
                                        );
                                      }
                                      return (
                                        <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px]">
                                          Patente {v.patente.categoria || 'B'}
                                        </span>
                                      );
                                    })()}
                                    {v.vestiario && (() => {
                                      let count = 0;
                                      if (v.vestiario.tshirt?.some(p => p.consegnato)) count += v.vestiario.tshirt.filter(p => p.consegnato).length;
                                      if (v.vestiario.felpa?.consegnato) count++;
                                      if (v.vestiario.pile?.consegnato) count++;
                                      if (v.vestiario.pantaloni?.consegnato) count++;
                                      if (v.vestiario.giubbetto?.consegnato) count++;
                                      if (v.vestiario.giubbottoInvernale?.consegnato) count++;
                                      return count > 0 ? (
                                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-bold">
                                          🦺 Vestiario ({count} pz)
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Mansione & Competenze */}
                            <td className="py-4.5 sm:py-5 px-2.5 min-w-[140px] align-middle">
                              {(() => {
                                const mansioni = getMansioniVolontario(v);
                                const mansionePrinc = getMansionePrincipale(v);
                                const secondarie = mansioni.filter(m => m !== mansionePrinc);
                                const stilePrinc = getStileMansione(mansionePrinc, catalogoMansioni);

                                return (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border inline-flex items-center gap-1 shadow-sm ${stilePrinc.coloreBg} ${stilePrinc.coloreTesto} ${stilePrinc.coloreBorder}`}>
                                      <IconaEmoji value={stilePrinc.badgeEmoji} fallback="🏷️" />
                                      <span className="truncate max-w-[150px]">{mansionePrinc}</span>
                                    </span>
                                    {secondarie.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {secondarie.map((sec, idx) => {
                                          const stileSec = getStileMansione(sec, catalogoMansioni);
                                          return (
                                            <span
                                              key={idx}
                                              className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-slate-900 text-slate-300 border border-slate-700 inline-flex items-center gap-1"
                                              title={`Mansione secondaria: ${sec}`}
                                            >
                                              <IconaEmoji value={stileSec.badgeEmoji} fallback="🏷️" />
                                              <span className="truncate max-w-[120px]">{sec}</span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {isOperatore && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                          📻 Centrale
                                        </span>
                                        {!v.approvato ? (
                                          <span className="text-[9px] font-black text-amber-400 bg-amber-950/40 px-1 py-0.2 rounded border border-amber-500/30 animate-pulse">
                                            In Attivazione
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-emerald-400">
                                            ● Abilitato
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Ore di servizio timbrate anno 2026 */}
                              <div className="mt-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 font-mono text-[9px] font-bold shadow-sm" title="Ore di servizio timbrate nell'anno 2026">
                                  <Clock className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>{calcolaOreAnnoVolontario(v).ore} h</span>
                                  <span className="text-slate-400 font-normal">({calcolaOreAnnoVolontario(v).turni} t)</span>
                                </span>
                              </div>
                            </td>

                            {/* Contatto (Telefono, Email, Residenza) */}
                            <td className="py-4.5 sm:py-5 px-2.5 w-[19%] min-w-[150px] font-mono text-slate-300 text-xs align-middle">
                              <div className="space-y-1">
                                {v.telefono ? (
                                  <a href={`tel:${v.telefono}`} className="hover:text-amber-400 flex items-center gap-1 font-bold">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{v.telefono}</span>
                                  </a>
                                ) : (
                                  <span className="text-red-400 text-[10px] italic">No Telefono</span>
                                )}
                                {v.email ? (
                                  <a href={`mailto:${v.email}`} className="hover:text-amber-300 text-slate-400 text-[11px] flex items-center gap-1 font-sans">
                                    <Mail className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="truncate max-w-[170px]">{v.email}</span>
                                  </a>
                                ) : (
                                  <span className="text-red-400 text-[10px] italic">No Email</span>
                                )}
                                {v.indirizzoResidenza && (
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 font-sans truncate max-w-[180px]" title={v.indirizzoResidenza}>
                                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{v.indirizzoResidenza}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Firma Digitale con Rimozione Sfondo Bianco - Layout Verticale Ottimizzato */}
                            <td className="py-4.5 sm:py-5 px-2 w-[11%] min-w-[90px] text-center align-middle">
                              {v.firmaBase64 ? (
                                <button
                                  type="button"
                                  onClick={() => apriGestioneFirmaRapida(v)}
                                  className="inline-flex flex-col items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer group"
                                  title="Firma trasparente registrata. Clicca per visualizzare o aggiornare."
                                >
                                  <div
                                    className="w-14 h-7 rounded bg-white p-0.5 border border-slate-400 flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
                                    style={{
                                      backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
                                      backgroundSize: '6px 6px'
                                    }}
                                  >
                                    <img src={v.firmaBase64} alt="Firma" className="max-h-full max-w-full object-contain" />
                                  </div>
                                  <span className="text-[9.5px] font-bold text-emerald-400 group-hover:underline">
                                    Trasparente ✓
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => apriGestioneFirmaRapida(v)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
                                  title="Carica un file immagine della firma: il colore bianco verrà rimosso automaticamente."
                                >
                                  <Upload className="w-3 h-3 text-amber-400" />
                                  <span>Carica</span>
                                </button>
                              )}
                            </td>

                            {/* PIN a 4 Cifre con occhietto */}
                            <td className="py-4.5 sm:py-5 px-2 w-[9%] min-w-[85px] text-center align-middle">
                              <div className="inline-flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 font-mono text-xs font-bold">
                                <KeyRound className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className={isPinVisible ? 'text-amber-300 tracking-wider' : 'text-slate-500 tracking-wider'}>
                                  {isPinVisible ? v.pin : '••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePinSingolo(v.id)}
                                  className="text-slate-500 hover:text-white p-0.5 ml-0.5 transition-colors cursor-pointer"
                                  title={isPinVisible ? 'Nascondi PIN' : 'Mostra PIN'}
                                >
                                  {isPinVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>

                            {/* Stato Turno Attivo */}
                            <td className="py-4.5 sm:py-5 px-2 w-[10%] min-w-[90px] align-middle">
                              {(() => {
                                const timbAttiva = getTimbraturaAttiva(v);
                                const isDiTurno = Boolean(timbAttiva);
                                const isLoggato = Boolean(v.loggato);
                                if (isDiTurno && timbAttiva) {
                                  return (
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                          IN TURNO
                                        </span>
                                        <span
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-[9px]"
                                          title={`Timbratura di ingresso alle ore ${timbAttiva.orarioIngresso} presso ${timbAttiva.sede || 'Sede'}`}
                                        >
                                          <Clock className="w-2.5 h-2.5 text-cyan-400" />
                                          ⏱️ {timbAttiva.orarioIngresso}
                                        </span>
                                        {isLoggato && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[9px]">
                                            ● Loggato
                                          </span>
                                        )}
                                      </div>
                                      {v.mezzoAttivo && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                          Mezzo: <strong className="text-white">{v.mezzoAttivo}</strong>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                if (isLoggato) {
                                  return (
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-[10px]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                          LOGGATO
                                        </span>
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[9px]"
                                          title="Account loggato ma non di turno (in attesa di timbratura)"
                                        >
                                          Non timbrato
                                        </span>
                                      </div>
                                      {v.mezzoAttivo && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                          Mezzo: <strong className="text-white">{v.mezzoAttivo}</strong>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                                    Fuori Servizio
                                  </span>
                                );
                              })()}
                              {(v.bloccatoPerTentativi || (v.tentativiErrati && v.tentativiErrati >= 3)) && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/50 font-black text-[9px] animate-pulse">
                                    <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                                    BLOCCATO
                                  </span>
                                  {v.dataBlocco && (
                                    <div className="text-[8px] font-mono text-red-400 mt-0.5">{v.dataBlocco}</div>
                                  )}
                                </div>
                              )}
                              {v.richiedeResetPassword && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[9px]">
                                    <KeyRound className="w-2.5 h-2.5 text-amber-400" />
                                    Reset Richiesto
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Azioni Amministratore - Layout su 2 Livelli per entrare sempre nello schermo senza scroll orizzontale */}
                            <td className="py-4 sm:py-4.5 px-2.5 w-[220px] min-w-[210px] max-w-[230px] border-l border-slate-800/80 align-middle bg-slate-900/60">
                              <div className="flex flex-col items-end gap-1.5 w-full">
                                
                                {/* Livello 1: Documenti e Schede PDF - Griglia fissa a 3 colonne perfettamente allineata */}
                                <div className="grid grid-cols-3 gap-1 w-full">
                                  {/* Scarica Scheda Vestiario & DPI (PDF) */}
                                  <button
                                    type="button"
                                    onClick={() => handleScaricaSchedaVestiario(v)}
                                    className="py-1.5 px-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 text-center w-full"
                                    title={`Genera e scarica Scheda Personale, Documenti & Ricevuta Vestiario (PDF) per ${v.nome} ${v.cognome}`}
                                  >
                                    <FileDown className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="truncate">Scheda</span>
                                  </button>

                                  {/* Scarica Ricevuta Tesseramento & Quota Associativa (PDF a firma Tesoriera) */}
                                  <button
                                    type="button"
                                    onClick={() => handleScaricaRicevuta(v)}
                                    className="py-1.5 px-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 text-center w-full"
                                    title={`Genera e scarica Ricevuta Ufficiale Quota Sociale (PDF a firma Tesoriera) per ${v.nome} ${v.cognome}`}
                                  >
                                    <Receipt className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span className="truncate">Ricevuta</span>
                                  </button>

                                  {/* Scarica / Compila Domanda Iscrizione (PDF) */}
                                  <button
                                    type="button"
                                    onClick={() => apriCompilazioneDomandaIscrizione(v)}
                                    className="py-1.5 px-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 text-center w-full"
                                    title={`Genera e scarica Domanda di Iscrizione Socio / Volontario (PDF con Anagrafica, Documenti, Dati Sanitari e Privacy) per ${v.nome} ${v.cognome}`}
                                  >
                                    <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                                    <span className="truncate">Domanda</span>
                                  </button>
                                </div>

                                {/* Livello 2: Gestione Operativa & Modifica Account */}
                                <div className="flex items-center gap-1 justify-end w-full">
                                  {/* Modifica account */}
                                  <button
                                    type="button"
                                    onClick={() => apriModificaVolontario(v)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                                    title="Modifica Anagrafica, Recapiti e PIN"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Invita al Reset della Password / PIN */}
                                  <button
                                    type="button"
                                    onClick={() => invitaAResettarePassword(v)}
                                    className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer shrink-0"
                                    title={`Invia invito via email a ${v.nome} ${v.cognome} per reimpostare la password/PIN`}
                                  >
                                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                                  </button>

                                  {/* Resetta PIN a 0000 */}
                                  <button
                                    type="button"
                                    onClick={() => resettaPinaZero(v)}
                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors cursor-pointer shrink-0"
                                    title="Resetta PIN di emergenza a 0000"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Promozione a Operatore Centrale o Retrocessione a Volontario */}
                                  {isOperatore ? (
                                    <button
                                      type="button"
                                      onClick={() => retrocediAVolontario(v)}
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                                      title={`Retrocedi ${v.nome} a Volontario Soccorso (rimuove da Operatore Centrale e dal Consiglio Direttivo)`}
                                    >
                                      <ArrowDownCircle className="w-3.5 h-3.5 text-amber-400" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => elevaAOperatoreCentrale(v)}
                                      className="p-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer shrink-0"
                                      title={`Eleva ${v.nome} ad Operatore Centrale ed inserisci nel Consiglio Direttivo`}
                                    >
                                      <ArrowUpCircle className="w-3.5 h-3.5 text-purple-400" />
                                    </button>
                                  )}

                                  {/* Rimuovi account di QUALSIASI livello (Solo per Amministratore) */}
                                  {canDeleteEffettivo && (
                                    <button
                                      type="button"
                                      onClick={() => setAccountDaEliminare(v)}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer shrink-0 active:scale-95"
                                      title={`Rimuovi definitivamente l'account di ${v.nome} ${v.cognome}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                {/* Condizioni Speciali: Account Bloccato o In Attivazione */}
                                {((v.bloccatoPerTentativi || (v.tentativiErrati && v.tentativiErrati >= 3)) || (isOperatore && !v.approvato)) && (
                                  <div className="flex items-center gap-1 justify-end w-full pt-0.5">
                                    {(v.bloccatoPerTentativi || (v.tentativiErrati && v.tentativiErrati >= 3)) && (
                                      <div className="flex items-center gap-1 bg-red-950/80 p-0.5 rounded-lg border border-red-500/50">
                                        <button
                                          type="button"
                                          onClick={() => azzeraSbagliESblocca(v)}
                                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/50 rounded text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer shadow-sm active:scale-95"
                                          title="Azzera gli errori e sblocca l'accesso con il PIN attuale"
                                        >
                                          <RotateCcw className="w-2.5 h-2.5 text-emerald-400" />
                                          <span>Sblocca</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => azzeraESpedisciInvitoReset(v)}
                                          className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black rounded text-[9.5px] flex items-center gap-0.5 cursor-pointer shadow-sm active:scale-95"
                                          title="Azzera errori, sblocca e invia invito email per reimpostare la password/PIN"
                                        >
                                          <Mail className="w-2.5 h-2.5 text-slate-950" />
                                          <span>Reset</span>
                                        </button>
                                      </div>
                                    )}

                                    {isOperatore && !v.approvato && (
                                      <button
                                        type="button"
                                        onClick={() => approvaOperatoreCentrale(v)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                        title="Approva questo operatore di centrale"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Approva</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
            </>
          )}
        </div>

        {/* MODALE CREAZIONE NUOVA MANSIONE NEL CATALOGO (DENTRO MODALE DATABASE) */}
        {modalCreaNuovaMansioneInModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
              {/* Header Fisso */}
              <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-lg shrink-0">
                    <IconaEmoji value={nuovaMansioneEmojiModal || mansioneInModificaModal?.badgeEmoji} fallback={mansioneInModificaModal ? '✏️' : '🎖️'} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-white text-sm truncate">
                      {mansioneInModificaModal ? 'Modifica Mansione Esistente' : 'Crea Nuova Mansione'}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {mansioneInModificaModal ? 'Aggiorna nome, categoria, icona o requisiti della mansione' : 'Aggiungi una mansione al catalogo permanente'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalCreaNuovaMansioneInModal(false);
                    setMansioneInModificaModal(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                  title="Chiudi senza salvare"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Corpo Scrollabile */}
              <div className="p-4 sm:p-5 space-y-3.5 flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nome della Mansione *
                  </label>
                  <input
                    type="text"
                    value={nuovaMansioneNomeModal}
                    onChange={(e) => setNuovaMansioneNomeModal(e.target.value)}
                    placeholder="Es. Addetto Trasporto Dialisi, Formatore DAE..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  {mansioneInModificaModal && (
                    <p className="text-[10px] text-cyan-400/90 mt-1">
                      ℹ️ Rinominando questa mansione, il nuovo nome verrà aggiornato in automatico in tutto il gestionale (volontari, ruoli equipaggio, tipi di turno, turni, formazione e timbrature).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={nuovaMansioneCategoriaModal}
                    onChange={(e) => setNuovaMansioneCategoriaModal(e.target.value as CategoriaMansione)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    {categorieMansioni.map(cat => {
                      const icoTxt = formatIconaPerTesto(cat.badgeEmoji, '');
                      return (
                        <option key={cat.id} value={cat.nome}>
                          {icoTxt ? `${icoTxt} ` : ''}{cat.nome}
                        </option>
                      );
                    })}
                    {!categorieMansioni.some(c => c.nome === nuovaMansioneCategoriaModal) && nuovaMansioneCategoriaModal && (
                      <option value={nuovaMansioneCategoriaModal}>{nuovaMansioneCategoriaModal}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Icona Emoji / Archivio Icone
                  </label>
                  <EmojiIconPicker
                    value={nuovaMansioneEmojiModal}
                    onChange={setNuovaMansioneEmojiModal}
                    fallback="🎖️"
                    accent="blue"
                    allowIcoUpload
                    onCustomIconsChanged={(icons) => realtime.syncCustomEmojiIcons(icons)}
                    compact
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Genitorialità (Mansione Genitore Opzionale)
                  </label>
                  <select
                    value={nuovaMansioneParentIdModal}
                    onChange={(e) => setNuovaMansioneParentIdModal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Nessuna mansione genitore (Livello principale)</option>
                    {(() => {
                      const excludedIds = mansioneInModificaModal
                        ? new Set([mansioneInModificaModal.id, ...getDescendantMansioneIds(mansioneInModificaModal.id, catalogoMansioni)])
                        : new Set<string>();
                      return catalogoMansioni
                        .filter(m => !excludedIds.has(m.id))
                        .map(m => {
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
                    value={nuovaMansioneDescrizioneModal}
                    onChange={(e) => setNuovaMansioneDescrizioneModal(e.target.value)}
                    placeholder="Descrivi requisiti, corsi o abilitazioni previste per questa mansione..."
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
                      {nuovaMansioneIncluseModal.length} incluse
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-tight">
                    Chi possiede questa mansione includerà automaticamente le mansioni selezionate qui sotto (la mansione più alta include quelle più in basso):
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-900/60 rounded-lg border border-slate-800">
                    {catalogoMansioni
                      .filter((m) => !mansioneInModificaModal || m.id !== mansioneInModificaModal.id)
                      .map((m) => {
                        const isChecked = nuovaMansioneIncluseModal.includes(m.nome);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setNuovaMansioneIncluseModal((prev) => prev.filter((nome) => nome !== m.nome));
                              } else {
                                setNuovaMansioneIncluseModal((prev) => [...prev, m.nome]);
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

              {/* Footer Fisso */}
              <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setModalCreaNuovaMansioneInModal(false);
                    setMansioneInModificaModal(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSalvaMansioneModal}
                  disabled={!nuovaMansioneNomeModal.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md ${
                    nuovaMansioneNomeModal.trim()
                      ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{mansioneInModificaModal ? 'Aggiorna Mansione' : 'Salva nel Catalogo'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Fisso */}
        <div className="bg-slate-950 p-3 px-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 shrink-0 z-30">
          <div>
            Totale Profili: <strong className="text-white">{volontari.length}</strong>{' '}
            (<span className="text-purple-300">{operatoriCentrale.length} Operatori Centrale</span>,{' '}
            <span className="text-amber-300">{volontari.length - operatoriCentrale.length} Volontari</span>)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            Chiudi Gestione
          </button>
        </div>

      </div>
      )}

      {/* SOTTO-MODALE AGGIUNGI / MODIFICA VOLONTARIO */}
      {modaleEditAperta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={salvaVolontario}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all"
          >
            {/* Header Modale */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  {tabModaleEdit === 'anagrafica' ? (
                    <Users className="w-5 h-5 text-amber-400" />
                  ) : tabModaleEdit === 'documenti' || tabModaleEdit === 'domanda_iscrizione' ? (
                    <FileText className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Shirt className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>
                      {volontarioInModifica
                        ? `Modifica Profilo: ${volontarioInModifica.nome} ${volontarioInModifica.cognome}`
                        : 'Nuovo Account nel Database'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Gestione anagrafica, credenziali, documenti, patente e vestiario DPI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={chiudiModaleEdit}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Navigation Sticky */}
            <div className="flex flex-wrap items-center border-b border-slate-800 bg-slate-950 px-3 sm:px-4 pt-2 pb-1 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setTabModaleEdit('anagrafica')}
                className={`px-3.5 py-2 font-bold text-xs rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  tabModaleEdit === 'anagrafica'
                    ? 'border-amber-400 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. Anagrafica & Foto</span>
              </button>

              <button
                type="button"
                onClick={() => setTabModaleEdit('documenti')}
                className={`px-3.5 py-2 font-bold text-xs rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  tabModaleEdit === 'documenti'
                    ? 'border-amber-400 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>2. Documenti & Patente</span>
                {formPatenteInPossesso && formPatenteScadenza && (() => {
                  const st = calcolaStatoScadenzaPatente(formPatenteScadenza);
                  return (st?.inScadenza7Giorni || st?.scaduta) ? (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping ml-1" />
                  ) : null;
                })()}
              </button>

              <button
                type="button"
                onClick={() => setTabModaleEdit('vestiario')}
                className={`px-3.5 py-2 font-bold text-xs rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  tabModaleEdit === 'vestiario'
                    ? 'border-amber-400 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>3. Vestiario & DPI</span>
                {(() => {
                  let count = 0;
                  if (formVestiario.tshirt?.some(p => p.consegnato)) count += formVestiario.tshirt.filter(p => p.consegnato).length;
                  if (formVestiario.felpa?.consegnato) count++;
                  if (formVestiario.pile?.consegnato) count++;
                  if (formVestiario.pantaloni?.consegnato) count++;
                  if (formVestiario.giubbetto?.consegnato) count++;
                  if (formVestiario.giubbottoInvernale?.consegnato) count++;
                  return count > 0 ? (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full text-[10px]">
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>

              <button
                type="button"
                onClick={() => setTabModaleEdit('domanda_iscrizione')}
                className={`px-3.5 py-2 font-bold text-xs rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  tabModaleEdit === 'domanda_iscrizione'
                    ? 'border-amber-400 text-amber-300 bg-slate-900/90'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Domanda Iscrizione</span>
              </button>
            </div>

            {/* Contenuto Scrollabile dei Tab */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {erroreForm && (
                <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{erroreForm}</span>
                </div>
              )}

              {/* TAB 1: ANAGRAFICA, CREDENZIALI & FOTO DELLA PERSONA */}
              {tabModaleEdit === 'anagrafica' && (
                <div className="space-y-4">
                  {/* SEZIONE FOTO DELLA PERSONA */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <label className="block text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>Foto della Persona (Caricata dall'Amministratore)</span>
                    </label>

                    <input
                      type="file"
                      ref={fileInputFotoRef}
                      onChange={handleFotoUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Anteprima Fototessera */}
                      <div className="w-24 h-28 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 flex items-center justify-center shrink-0 shadow-lg relative group">
                        {formFotoBase64 ? (
                          <>
                            <img
                              src={formFotoBase64}
                              alt="Foto Profilo"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">Foto OK</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-2 text-slate-500">
                            <Camera className="w-7 h-7 mx-auto mb-1 text-slate-600" />
                            <span className="text-[9px] block">Nessuna foto</span>
                          </div>
                        )}
                      </div>

                      {/* Azioni Upload Foto */}
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <p className="text-xs text-slate-300">
                          Carica una fototessera o scatto della persona. Verrà inclusa automaticamente nella <strong>Scheda Personale PDF</strong> ufficiale.
                        </p>
                        <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                          <button
                            type="button"
                            onClick={() => fileInputFotoRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{formFotoBase64 ? 'Sostituisci Foto' : 'Carica Foto Persona'}</span>
                          </button>
                          {formFotoBase64 && (
                            <button
                              type="button"
                              onClick={handleRimuoviFoto}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 text-xs font-semibold transition-all cursor-pointer"
                            >
                              Rimuovi Foto
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Formati supportati: JPEG, PNG, WEBP.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nome e Cognome */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nome *</label>
                      <input
                        type="text"
                        required
                        value={formNome}
                        onChange={(e) => setFormNome(e.target.value)}
                        placeholder="Es: Marco"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cognome *</label>
                      <input
                        type="text"
                        required
                        value={formCognome}
                        onChange={(e) => setFormCognome(e.target.value)}
                        placeholder="Es: Rossi"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* SEZIONE 1: Dati di Nascita */}
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 uppercase flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        Dati di Nascita
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Necessari per calcolo automatico CF e anagrafica
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      {/* Data di Nascita */}
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Data di Nascita *
                        </label>
                        <input
                          type="date"
                          value={formDataNascita}
                          onChange={(e) => setFormDataNascita(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* Sesso */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Sesso *
                        </label>
                        <select
                          value={formSesso}
                          onChange={(e) => setFormSesso(e.target.value as 'M' | 'F')}
                          className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-xs font-bold text-center focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="M">M (Uomo)</option>
                          <option value="F">F (Donna)</option>
                        </select>
                      </div>

                      {/* Comune di Nascita */}
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Comune di Nascita *
                        </label>
                        <input
                          type="text"
                          value={formComuneNascita}
                          onChange={(e) => setFormComuneNascita(e.target.value)}
                          placeholder="Es: Massa / Carrara"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* Sigla Provincia di Nascita */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Prov. Nascita *
                        </label>
                        <input
                          type="text"
                          maxLength={2}
                          value={formProvinciaNascita}
                          onChange={(e) => setFormProvinciaNascita(e.target.value.toUpperCase().slice(0, 2))}
                          placeholder="MS"
                          className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-xs font-mono uppercase text-center font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEZIONE 2: Codice Fiscale con Automazioni */}
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/20 border border-amber-500/40 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Codice Fiscale</span>
                        {formCodiceFiscale.length === 16 && (
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">✓ 16 car.</span>
                        )}
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Usa i pulsanti per calcolare il CF o estrarre i dati
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        maxLength={16}
                        value={formCodiceFiscale}
                        onChange={(e) => setFormCodiceFiscale(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="Es: RSSMRC80A01E625T"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 text-sm font-mono uppercase tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />

                      {/* Pulsante 1: Crea in automatico il Codice Fiscale */}
                      <button
                        type="button"
                        onClick={handleCalcolaCodiceFiscale}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Calcola in automatico il codice fiscale a 16 caratteri dai campi Nome, Cognome, Data, Sesso e Comune di nascita"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Calcola Codice Fiscale</span>
                      </button>

                      {/* Pulsante 2: Riempi in automatico da Codice Fiscale */}
                      <button
                        type="button"
                        onClick={handleRiempiDaCodiceFiscale}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-amber-500/50 font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                        title="Decodifica il Codice Fiscale e compila automaticamente Data, Sesso, Comune e Sigla Provincia di nascita"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Compila da CF</span>
                      </button>
                    </div>

                    {feedbackCF && (
                      <div className={`p-2 rounded-xl text-[11px] font-medium flex items-center gap-1.5 ${
                        feedbackCF.tipo === 'success'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-950/80 text-red-300 border border-red-500/40'
                      }`}>
                        {feedbackCF.tipo === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                        <span>{feedbackCF.testo}</span>
                      </div>
                    )}
                  </div>

                  {/* SEZIONE 3: Indirizzo di Residenza Multi-Campo e Geolocalizzazione su Mappa */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                      <span className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        Indirizzo di Residenza & Geolocalizzazione Mappa
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Indirizzo, Comune, CAP, Sigla Provincia e Pin Mappa
                      </span>
                    </div>

                    <MappaGeolocalizzazioneResidenza
                      dati={formResidenza}
                      onChange={setFormResidenza}
                    />
                  </div>

                  {/* Mansione & Matricola (Nuova Gestione Dinamica Mansioni Multiple) */}
                  <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            <span>Mansione Principale</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setMostraCreaMansioneRapida(!mostraCreaMansioneRapida)}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          >
                            {mostraCreaMansioneRapida ? 'Annulla' : '+ Nuova Mansione'}
                          </button>
                        </div>
                        <select
                          value={formQualifica}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormQualifica(val as any);
                            if (!formMansioni.includes(val)) {
                              setFormMansioni([...formMansioni, val]);
                            }
                            if (val.toLowerCase().includes('centrale')) {
                              setFormProfiloCentrale(true);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          {catalogoMansioni.map((m) => {
                            const icoTxt = formatIconaPerTesto(m.badgeEmoji, '🏷️');
                            return (
                              <option key={m.id} value={m.nome}>
                                {icoTxt ? `${icoTxt} ` : ''}{m.nome} ({m.categoria})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Matricola / Codice</label>
                        <input
                          type="text"
                          value={formMatricola}
                          onChange={(e) => setFormMatricola(e.target.value)}
                          placeholder="VOL-101 o OP-01"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Modulo Rapido per Creare una Nuova Mansione direttamente nel Fascicolo */}
                    {mostraCreaMansioneRapida && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-blue-500/40 space-y-2 animate-in fade-in">
                        <span className="text-[10px] font-black uppercase text-blue-300 block">
                          Crea e Aggiungi Nuova Mansione al Catalogo:
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Es. Addetto Logistica Sanitaria, Guida Sicura..."
                            value={nuovaMansioneNomeRapida}
                            onChange={(e) => setNuovaMansioneNomeRapida(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!nuovaMansioneNomeRapida.trim()) return;
                              const creata = creaNuovaMansione({
                                nome: nuovaMansioneNomeRapida.trim(),
                                categoria: categorieMansioni[0]?.nome || 'Altro',
                                badgeEmoji: '⭐'
                              });
                              const aggCat = getMansioniCatalogo();
                              setCatalogoMansioni(aggCat);
                              realtime.syncMansioniConfig(aggCat, categorieMansioni);
                              setFormQualifica(creata.nome);
                              if (!formMansioni.includes(creata.nome)) {
                                setFormMansioni([...formMansioni, creata.nome]);
                              }
                              setNuovaMansioneNomeRapida('');
                              setMostraCreaMansioneRapida(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase cursor-pointer"
                          >
                            Crea & Assegna
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Assegnazione Multipla: Tutte le Mansioni Assegnate Contemporaneamente */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <label className="text-[10.5px] font-bold text-slate-300">
                          Mansioni Assegnate Contemporaneamente a questo Volontario ({formMansioni.length}):
                        </label>
                        <span className="text-[9.5px] text-slate-400">Clicca per abilitare / disabilitare</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {catalogoMansioni.map((m) => {
                          const attiva = formMansioni.includes(m.nome);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                if (attiva) {
                                  if (formMansioni.length === 1) return; // mantieni almeno 1 mansione
                                  const rimosse = formMansioni.filter((item) => item !== m.nome);
                                  setFormMansioni(rimosse);
                                  if (formQualifica === m.nome && rimosse[0]) {
                                    setFormQualifica(rimosse[0]);
                                  }
                                } else {
                                  setFormMansioni([...formMansioni, m.nome]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                                attiva
                                  ? `${m.coloreBg} ${m.coloreTesto} ${m.coloreBorder} shadow-sm ring-1 ring-amber-400/50`
                                  : 'bg-slate-950/70 text-slate-500 border-slate-800 hover:text-slate-300'
                              }`}
                            >
                              <IconaEmoji value={m.badgeEmoji} fallback="🏷️" />
                              <span>{m.nome}</span>
                              <span className="text-[9px] font-mono opacity-80">{attiva ? '✓' : '+'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Sezione Territoriale di Appartenenza dell'Associazione (Obbligatoria) */}
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                    <label className="block text-[11px] font-bold text-amber-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sezione Territoriale di Appartenenza * (Obbligatoria)</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Assegnazione account a sede dell'associazione
                      </span>
                    </label>
                    <select
                      value={formSezioneAppartenenzaId}
                      onChange={(e) => setFormSezioneAppartenenzaId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      {SEDI_TURNI_DISPONIBILI.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icona} {s.nome} [{s.codice}]
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Ogni volontario appartiene a una sezione dell'associazione e visualizzerà solo ed esclusivamente i tabelloni e i corsi formativi delle sezioni autorizzate.
                    </p>
                  </div>

                  {/* TESSERA DEL SOCIO / OPERATORE (GESTIONE DELIBERA E SOCI APPROVATI) */}
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        <span>Numero di Tessera del Volontario / Operatore *</span>
                      </label>
                      {isPeriodoInserimentoManualeTessere() ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Inserimento Manuale Libero (Attivo fino al 31/10/2026)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1 w-fit">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>Progressivo Automatico (+1)</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                      <div>
                        <input
                          type="text"
                          disabled={!isPeriodoInserimentoManualeTessere() && !formForzaNumeroTessera}
                          value={formNumeroTessera}
                          onChange={(e) => setFormNumeroTessera(e.target.value.toUpperCase())}
                          placeholder={formProfiloCentrale ? "Es. TO-01" : "Es. TV-101"}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                            !isPeriodoInserimentoManualeTessere() && !formForzaNumeroTessera
                              ? 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-slate-900 border border-slate-700 text-amber-300'
                          }`}
                        />
                      </div>

                      {/* Checkbox di forzatura manuale */}
                      <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                        <input
                          type="checkbox"
                          id="forceTesseraAdmin"
                          checked={formForzaNumeroTessera}
                          onChange={(e) => setFormForzaNumeroTessera(e.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="forceTesseraAdmin" className="text-[10px] text-slate-300 cursor-pointer select-none leading-tight">
                          <span className="font-bold text-white block">Forza inserimento manuale numero</span>
                          <span className="text-slate-400 text-[9px]">
                            {isPeriodoInserimentoManualeTessere()
                              ? "Abilita la personalizzazione del numero."
                              : "Sblocca l'input per digitare forzatamente un numero di tessera manuale."}
                          </span>
                        </label>
                      </div>
                    </div>

                    <p className="text-[9.5px] text-slate-400 leading-tight italic">
                      {isPeriodoInserimentoManualeTessere()
                        ? "Fino al 31/10/2026 i volontari inseriti a sistema sono soci già approvati: l'amministratore può digitare liberamente il loro numero di tessera."
                        : `Dopo il 31/10/2026 il numero aumenta di 1 dall'ultimo progressivo emesso (Ultima tessera rilevata: ${calcolaProssimoNumeroTessera(volontari, formProfiloCentrale).ultimaTesseraEmessa}). Puoi forzarlo spuntando la casella.`}
                    </p>
                  </div>

                  {/* Telefono ed Email Obbligatori */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Telefono Cellulare * (Obbligatorio)
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          required
                          value={formTelefono}
                          onChange={(e) => setFormTelefono(e.target.value)}
                          placeholder="333 1234567"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Indirizzo Email * (Obbligatorio)
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="email"
                          required
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="nome.cognome@croceoromassacarrara.it"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PIN a 4 Cifre */}
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <label className="block text-[11px] font-bold text-amber-300 mb-1 flex items-center justify-between">
                      <span>PIN Personale a 4 Cifre</span>
                      <span className="text-[10px] text-slate-400 font-normal">Usato dal volontario per fare login</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-amber-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={formPIN}
                        onChange={(e) => {
                          const soloCifre = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setFormPIN(soloCifre);
                        }}
                        placeholder="1234"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-amber-500/50 text-amber-300 font-mono font-bold text-base tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Firma Digitale Autografa */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold text-amber-300">
                        Firma Digitale Autografa (Facoltativa per l'Amministratore)
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        Obbligatoria per il Volontario al 1° accesso
                      </span>
                    </div>
                    <UploadFirmaTrasparente
                      label="Firma Digitale Autografa (Carica Immagine o Disegna sullo schermo)"
                      sottotitolo="L'amministratore può non inserirla qui: se non viene caricata adesso, il volontario o l'operatore al suo primo accesso sul proprio device sarà bloccato finché non traccia obbligatoriamente la propria firma digitale sul display prima di iniziare il turno."
                      valoreIniziale={formFirmaBase64}
                      onFirmaCambiata={(dataUrl) => setFormFirmaBase64(dataUrl)}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: DOCUMENTI D'IDENTITÀ & PATENTE DI GUIDA */}
              {tabModaleEdit === 'documenti' && (
                <div className="space-y-4">
                  {/* BOX DOCUMENTO D'IDENTITÀ */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-white font-bold text-xs pb-1 border-b border-slate-800">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Documento di Identità</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Tipo Documento
                        </label>
                        <select
                          value={formDocTipo}
                          onChange={(e) => setFormDocTipo(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="Carta d'Identità Elettronica (CIE)">Carta d'Identità Elettronica</option>
                          <option value="Carta d'Identità Cartacea">Carta d'Identità Cartacea</option>
                          <option value="Passaporto">Passaporto</option>
                          <option value="Altro Documento">Altro Documento</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Numero Documento
                        </label>
                        <input
                          type="text"
                          value={formDocNumero}
                          onChange={(e) => setFormDocNumero(e.target.value.toUpperCase())}
                          placeholder="Es: CA12345AA"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Data di Scadenza
                        </label>
                        <input
                          type="date"
                          value={formDocScadenza}
                          onChange={(e) => setFormDocScadenza(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BOX PATENTE DI GUIDA */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <div className="flex items-center gap-2 text-white font-bold text-xs">
                        <Car className="w-4 h-4 text-amber-400" />
                        <span>Patente di Guida</span>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPatenteInPossesso}
                          onChange={(e) => setFormPatenteInPossesso(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                        />
                        <span>In possesso di patente di guida</span>
                      </label>
                    </div>

                    {formPatenteInPossesso ? (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Categoria Patente
                            </label>
                            <select
                              value={formPatenteCategoria}
                              onChange={(e) => setFormPatenteCategoria(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            >
                              <option value="B">B (Autovetture / Ambulanze)</option>
                              <option value="C">C (Mezzi pesanti)</option>
                              <option value="C1">C1</option>
                              <option value="D">D</option>
                              <option value="CQC">CQC Persone</option>
                              <option value="B + C">B + C</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Numero Patente
                            </label>
                            <input
                              type="text"
                              value={formPatenteNumero}
                              onChange={(e) => setFormPatenteNumero(e.target.value.toUpperCase())}
                              placeholder="Es: U12345678X"
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Data Scadenza Patente *
                            </label>
                            <input
                              type="date"
                              required={formPatenteInPossesso}
                              value={formPatenteScadenza}
                              onChange={(e) => setFormPatenteScadenza(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Alert / Stato Scadenza Patente con notifica 7 giorni prima */}
                        {formPatenteScadenza && (() => {
                          const st = calcolaStatoScadenzaPatente(formPatenteScadenza);
                          if (!st) return null;
                          if (st.scaduta) {
                            return (
                              <div className="p-3 rounded-xl bg-red-950/80 border-2 border-red-500 text-red-200 text-xs font-bold flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
                                <div>
                                  <strong className="block text-red-100 uppercase">🚨 Patente Scaduta!</strong>
                                  <span className="text-[11px] text-red-300 font-normal">
                                    Il documento è scaduto da {Math.abs(st.giorniMancanti)} giorni. Non può guidare mezzi operativi di soccorso.
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          if (st.inScadenza7Giorni) {
                            return (
                              <div className="p-3 rounded-xl bg-amber-950/80 border-2 border-amber-400 text-amber-200 text-xs font-bold flex items-center gap-2 animate-pulse">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                                <div>
                                  <strong className="block text-amber-100 uppercase">
                                    ⚠️ ALERT SCADENZA: {st.label.toUpperCase()}!
                                  </strong>
                                  <span className="text-[11px] text-amber-300 font-normal">
                                    La patente è in scadenza entro i 7 giorni. L'amministratore riceverà avviso prioritario automatico a sistema.
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span>Patente valida: {st.label} (Scadenza il {formPatenteScadenza})</span>
                            </div>
                          );
                        })()}

                        <p className="text-[11px] text-slate-400 italic">
                          ℹ️ Regola di sicurezza: Il sistema allerta l'amministratore <strong>7 giorni prima</strong> della scadenza della patente con alert in primo piano.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">
                        Seleziona la casella sopra se la persona è in possesso di patente di guida.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DOTAZIONE VESTIARIO & DPI CON TAGLIE DA XXS A XXL, MAGAZZINO, CAUZIONI E RICONSEGNA */}
              {tabModaleEdit === 'vestiario' && (() => {
                const riepilogoCauzioni = calcolaCauzioneTotale(formVestiario);
                const capiAttualmenteConsegnati = calcolaElencoCapiConsegnati(formVestiario);

                return (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                    <strong className="block text-amber-300 uppercase font-black mb-0.5">
                      🦺 Registro Consegna Vestiario & D.P.I. (Collegato al Magazzino)
                    </strong>
                    Spunta i capi consegnati, la taglia assegnata (<strong>da XXS a 4XL</strong>) e la data di consegna.
                    Le cauzioni previste in Magazzino vengono precaricate in automatico e al salvataggio il capo viene scalato dalla giacenza. Puoi prevedere esenzioni o modificare la cauzione di ciascun articolo.
                  </div>

                  {/* 1. T-SHIRT (MAX 3 PEZZI) */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2 text-white font-bold text-xs">
                        <Shirt className="w-4 h-4 text-amber-400" />
                        <span className="uppercase tracking-wide">T-Shirt Istituzionale (Max 3 Pezzi)</span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                        {formVestiario.tshirt?.filter(p => p.consegnato).length || 0} / 3 consegnate
                      </span>
                    </div>

                    <div className="space-y-3">
                      {[0, 1, 2].map((idx) => {
                        const pezzo = formVestiario.tshirt?.[idx] || { id: idx + 1, consegnato: false };
                        const isConsegnato = !!pezzo.consegnato;
                        const { cauzione: preCauzioneTshirt, articolo: artTshirt } = getCauzionePrecaricataCapo(
                          'tshirt',
                          pezzo.taglia,
                          pezzo.articoloMagazzinoId
                        );
                        const cauzioneEffettiva = pezzo.esenteCauzione
                          ? 0
                          : (typeof pezzo.cauzioneApplicata === 'number' ? pezzo.cauzioneApplicata : preCauzioneTshirt);
                        const draftKey = `tshirt-${idx}`;
                        const draftVal = cauzioneDrafts[draftKey] ?? String(cauzioneEffettiva);

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border transition-all space-y-2 ${
                              isConsegnato
                                ? 'bg-slate-900 border-amber-500/40 shadow-sm'
                                : 'bg-slate-900/40 border-slate-800/80'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              {/* Checkbox Consegnato */}
                              <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={isConsegnato}
                                    onChange={(e) => toggleTShirtConsegnato(idx, e.target.checked)}
                                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                                  />
                                  <span className={isConsegnato ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                                    T-shirt #{idx + 1}
                                  </span>
                                </label>
                                {artTshirt && (
                                  <span className="text-[10px] text-slate-400 pl-6 block">
                                    Magazzino: {artTshirt.nome} — Giacenza: <strong className={artTshirt.giacenzaAttuale <= artTshirt.scortaMinima ? 'text-red-400' : 'text-emerald-400'}>{artTshirt.giacenzaAttuale}</strong>
                                  </span>
                                )}
                              </div>

                              {/* Caselle Taglia XXS -> 4XL */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Taglia:</span>
                                {TAGLIE_DISPONIBILI.map((taglia) => {
                                  const isSelezionata = pezzo.taglia === taglia;
                                  return (
                                    <button
                                      key={taglia}
                                      type="button"
                                      disabled={!isConsegnato}
                                      onClick={() => setTShirtTaglia(idx, taglia)}
                                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                                        !isConsegnato
                                          ? 'opacity-40 bg-slate-800 text-slate-500 cursor-not-allowed'
                                          : isSelezionata
                                          ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-1 ring-amber-300'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer'
                                      }`}
                                    >
                                      {taglia}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Data Consegna */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-400">Data:</span>
                                <input
                                  type="date"
                                  disabled={!isConsegnato}
                                  value={pezzo.dataConsegna || ''}
                                  onChange={(e) => setTShirtData(idx, e.target.value)}
                                  className={`px-2 py-1 rounded-lg text-xs bg-slate-950 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                                    !isConsegnato ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                />
                              </div>
                            </div>

                            {isConsegnato && (
                              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300 font-semibold">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(pezzo.esenteCauzione)}
                                    onChange={(e) => {
                                      const nextEsente = e.target.checked;
                                      applicaModificaCauzioneConForzatura({
                                        capoNome: `T-Shirt #${idx + 1}`,
                                        importoAttesoPrecaricato: preCauzioneTshirt,
                                        nuovoImporto: nextEsente ? 0 : preCauzioneTshirt,
                                        esente: nextEsente,
                                        onApplica: () => {
                                          setFormVestiario(prev => {
                                            const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
                                            copia.tshirt[idx].esenteCauzione = nextEsente;
                                            if (nextEsente) copia.tshirt[idx].cauzioneApplicata = 0;
                                            else copia.tshirt[idx].cauzioneApplicata = preCauzioneTshirt;
                                            return copia;
                                          });
                                          setCauzioneDrafts(prev => ({
                                            ...prev,
                                            [draftKey]: nextEsente ? '0' : String(preCauzioneTshirt)
                                          }));
                                        }
                                      });
                                    }}
                                    className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                                  />
                                  <span>Esente cauzione</span>
                                </label>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400">Cauzione (€):</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    disabled={Boolean(pezzo.esenteCauzione)}
                                    value={pezzo.esenteCauzione ? '0' : draftVal}
                                    onChange={(e) => setCauzioneDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                    className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs disabled:opacity-40"
                                  />
                                  {!pezzo.esenteCauzione && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const valNum = Number(String(draftVal).replace(',', '.'));
                                        const sicuro = Number.isNaN(valNum) ? preCauzioneTshirt : Math.max(0, valNum);
                                        applicaModificaCauzioneConForzatura({
                                          capoNome: `T-Shirt #${idx + 1}`,
                                          importoAttesoPrecaricato: preCauzioneTshirt,
                                          nuovoImporto: sicuro,
                                          esente: false,
                                          onApplica: () => {
                                            setFormVestiario(prev => {
                                              const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
                                              copia.tshirt[idx].esenteCauzione = false;
                                              copia.tshirt[idx].cauzioneApplicata = sicuro;
                                              return copia;
                                            });
                                          }
                                        });
                                      }}
                                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10px] cursor-pointer"
                                    >
                                      Applica
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. CAPI SINGOLI: FELPA, PILE, PANTALONI, GIUBBETTO, GIUBBOTTO INVERNALE */}
                  {[
                    { chiave: 'felpa' as const, nome: 'Felpa con Zip', descr: 'Felpa con ricami istituzionali' },
                    { chiave: 'pile' as const, nome: 'Pile', descr: 'Pile termico alta visibilità' },
                    { chiave: 'pantaloni' as const, nome: 'Pantaloni', descr: 'Pantaloni operativi con bande rifrangenti' },
                    { chiave: 'giubbetto' as const, nome: 'Giubbetto', descr: 'Giubbetto mezza stagione / gilet' },
                    { chiave: 'giubbottoInvernale' as const, nome: 'Giubbotto invernale', descr: 'Giubbotto termico invernale impermeabile' }
                  ].map(({ chiave, nome, descr }) => {
                    const capo = formVestiario[chiave] || { consegnato: false };
                    const isConsegnato = !!capo.consegnato;
                    const { cauzione: preCauzioneCapo, articolo: artMag } = getCauzionePrecaricataCapo(
                      chiave,
                      capo.taglia,
                      capo.articoloMagazzinoId
                    );
                    const cauzioneEffettiva = capo.esenteCauzione
                      ? 0
                      : (typeof capo.cauzioneApplicata === 'number' ? capo.cauzioneApplicata : preCauzioneCapo);
                    const draftVal = cauzioneDrafts[chiave] ?? String(cauzioneEffettiva);

                    return (
                      <div
                        key={chiave}
                        className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                          isConsegnato
                            ? 'bg-slate-950/90 border-amber-500/40 shadow-sm'
                            : 'bg-slate-950/50 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Nome e Toggle Consegnato */}
                          <div className="min-w-0">
                            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isConsegnato}
                                onChange={(e) => toggleCapoConsegnato(chiave, e.target.checked)}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                              />
                              <span className={isConsegnato ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                                {nome}
                              </span>
                              {preCauzioneCapo > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                                  Cauzione: € {preCauzioneCapo.toFixed(2).replace('.', ',')}
                                </span>
                              )}
                            </label>
                            <span className="text-[10px] text-slate-500 block pl-6 mt-0.5">
                              {descr}
                              {artMag && (
                                <>
                                  {' • '}Magazzino: <strong className={artMag.giacenzaAttuale <= artMag.scortaMinima ? 'text-red-400' : 'text-emerald-400'}>{artMag.giacenzaAttuale} disp.</strong>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Caselle Taglia XXS -> 4XL */}
                          <div className="flex items-center gap-1 flex-wrap pl-6 sm:pl-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Taglia:</span>
                            {TAGLIE_DISPONIBILI.map((taglia) => {
                              const isSelezionata = capo.taglia === taglia;
                              return (
                                <button
                                  key={taglia}
                                  type="button"
                                  disabled={!isConsegnato}
                                  onClick={() => setCapoTaglia(chiave, taglia)}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                                    !isConsegnato
                                      ? 'opacity-40 bg-slate-800 text-slate-500 cursor-not-allowed'
                                      : isSelezionata
                                      ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-1 ring-amber-300'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer'
                                  }`}
                                >
                                  {taglia}
                                </button>
                              );
                            })}
                          </div>

                          {/* Data Consegna */}
                          <div className="flex items-center gap-1.5 shrink-0 pl-6 sm:pl-0">
                            <span className="text-[10px] text-slate-400">Data:</span>
                            <input
                              type="date"
                              disabled={!isConsegnato}
                              value={capo.dataConsegna || ''}
                              onChange={(e) => setCapoData(chiave, e.target.value)}
                              className={`px-2 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                                !isConsegnato ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            />
                          </div>
                        </div>

                        {isConsegnato && (
                          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] pl-6">
                            <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300 font-semibold">
                              <input
                                type="checkbox"
                                checked={Boolean(capo.esenteCauzione)}
                                onChange={(e) => {
                                  const nextEsente = e.target.checked;
                                  applicaModificaCauzioneConForzatura({
                                    capoNome: nome,
                                    importoAttesoPrecaricato: preCauzioneCapo,
                                    nuovoImporto: nextEsente ? 0 : preCauzioneCapo,
                                    esente: nextEsente,
                                    onApplica: () => {
                                      setFormVestiario(prev => {
                                        const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
                                        if (!copia[chiave]) copia[chiave] = { consegnato: true };
                                        copia[chiave].esenteCauzione = nextEsente;
                                        copia[chiave].cauzioneApplicata = nextEsente ? 0 : preCauzioneCapo;
                                        return copia;
                                      });
                                      setCauzioneDrafts(prev => ({
                                        ...prev,
                                        [chiave]: nextEsente ? '0' : String(preCauzioneCapo)
                                      }));
                                    }
                                  });
                                }}
                                className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                              />
                              <span>Esente cauzione</span>
                            </label>

                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Cauzione applicata (€):</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                disabled={Boolean(capo.esenteCauzione)}
                                value={capo.esenteCauzione ? '0' : draftVal}
                                onChange={(e) => setCauzioneDrafts(prev => ({ ...prev, [chiave]: e.target.value }))}
                                className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs disabled:opacity-40"
                              />
                              {!capo.esenteCauzione && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const valNum = Number(String(draftVal).replace(',', '.'));
                                    const sicuro = Number.isNaN(valNum) ? preCauzioneCapo : Math.max(0, valNum);
                                    applicaModificaCauzioneConForzatura({
                                      capoNome: nome,
                                      importoAttesoPrecaricato: preCauzioneCapo,
                                      nuovoImporto: sicuro,
                                      esente: false,
                                      onApplica: () => {
                                        setFormVestiario(prev => {
                                          const copia = JSON.parse(JSON.stringify(prev)) as DotazioneVestiario;
                                          if (!copia[chiave]) copia[chiave] = { consegnato: true };
                                          copia[chiave].esenteCauzione = false;
                                          copia[chiave].cauzioneApplicata = sicuro;
                                          return copia;
                                        });
                                      }
                                    });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10px] cursor-pointer"
                                >
                                  Applica
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 3. SEZIONE CAUZIONI DPI & RIGA DEDICATA IBAN PER IL RIMBORSO ALLA RESTITUZIONE */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30 space-y-3.5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                          Cauzioni DPI & Rimborso alla Restituzione
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">Cauzione Totale Custodita:</span>
                        <span className="text-xs font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40 font-mono">
                          € {riepilogoCauzioni.totale.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                      <div className={`p-2.5 rounded-xl border transition-all ${
                        formVestiario.pantaloni?.consegnato
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>Pantaloni Operativi:</span>
                          <span className="font-black">€ {riepilogoCauzioni.cauzionePantaloni.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {formVestiario.pantaloni?.consegnato
                            ? (formVestiario.pantaloni.esenteCauzione ? 'Esente cauzione' : '✓ Consegnati (cauzione applicata)')
                            : 'Non consegnati'}
                        </div>
                      </div>

                      <div className={`p-2.5 rounded-xl border transition-all ${
                        formVestiario.giubbetto?.consegnato
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>Giubbetto Operativo:</span>
                          <span className="font-black">€ {riepilogoCauzioni.cauzioneGiubbetto.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {formVestiario.giubbetto?.consegnato
                            ? (formVestiario.giubbetto.esenteCauzione ? 'Esente cauzione' : '✓ Consegnato (cauzione applicata)')
                            : 'Non consegnato'}
                        </div>
                      </div>

                      <div className={`p-2.5 rounded-xl border transition-all ${
                        riepilogoCauzioni.altreCauzioni > 0
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>Altri Capi / DPI:</span>
                          <span className="font-black">€ {riepilogoCauzioni.altreCauzioni.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="text-[10px] mt-0.5">
                          Cauzioni da articoli magazzino collegati
                        </div>
                      </div>
                    </div>

                    {/* RIGA DEDICATA DOVE L'AMMINISTRATORE SCRIVE L'IBAN */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-bold text-white flex items-center justify-between flex-wrap gap-1">
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <span>Coordinate Bancarie IBAN per Rimborso Cauzione *</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Per bonifico di restituzione cauzione alla riconsegna dei DPI
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formVestiario.ibanRestituzioneCauzione || ''}
                          onChange={(e) => setVestiarioIban(e.target.value)}
                          placeholder="IT60X0542811101000000123456"
                          maxLength={34}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs uppercase placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 tracking-wider font-semibold"
                        />
                        {formVestiario.ibanRestituzioneCauzione && (
                          <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                            {formVestiario.ibanRestituzioneCauzione.length} car.
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed italic">
                        L'amministratore indica qui l'IBAN del volontario. Questo codice viene inserito in automatico nella Scheda Vestiario & DPI stampata e nel Verbale di Restituzione quando la persona riconsegnerà i capi.
                      </p>
                    </div>
                  </div>

                  {/* 3B. CASELLA SPUNTABILE: RICONSEGNA VESTIARIO & DPI CON VERBALE PDF PRECOMPILATO */}
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-blue-500/30 space-y-3 shadow-sm">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={riconsegnaAperta}
                          onChange={(e) => {
                            const aperta = e.target.checked;
                            setRiconsegnaAperta(aperta);
                            if (aperta) {
                              const tutti = calcolaElencoCapiConsegnati(formVestiario);
                              const selInit: Record<string, boolean> = {};
                              tutti.forEach(c => { selInit[c.key] = true; });
                              setRiconsegnaSelezionati(selInit);
                              setRiconsegnaData(formatISODateItaly());
                              const rimbTot = tutti.reduce((s, c) => s + (c.esente ? 0 : c.cauzione), 0);
                              setRiconsegnaRimborsoStr(rimbTot.toFixed(2));
                            }
                          }}
                          className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-black text-blue-300 uppercase tracking-wide flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                            <span>Riconsegna Vestiario & DPI</span>
                          </span>
                          <span className="text-[10.5px] text-slate-400 block">
                            Spunta per registrare la restituzione dei capi, ripristinare il magazzino e generare il PDF precompilato di restituzione cauzione
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {capiAttualmenteConsegnati.length} consegnati
                      </span>
                    </label>

                    {riconsegnaAperta && (
                      <div className="pt-3 border-t border-slate-800 space-y-3 animate-in fade-in">
                        {capiAttualmenteConsegnati.length === 0 ? (
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                            Nessun capo o DPI risulta attualmente consegnato a questo account.
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-slate-300 block">
                                Seleziona i capi e DPI oggetto di riconsegna:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {capiAttualmenteConsegnati.map(capo => {
                                  const checked = Boolean(riconsegnaSelezionati[capo.key]);
                                  return (
                                    <label
                                      key={capo.key}
                                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer text-xs ${
                                        checked
                                          ? 'bg-blue-950/40 border-blue-500/50 text-white'
                                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            const nextMap = { ...riconsegnaSelezionati, [capo.key]: e.target.checked };
                                            setRiconsegnaSelezionati(nextMap);
                                            const rimb = capiAttualmenteConsegnati
                                              .filter(x => nextMap[x.key])
                                              .reduce((s, x) => s + (x.esente ? 0 : x.cauzione), 0);
                                            setRiconsegnaRimborsoStr(rimb.toFixed(2));
                                          }}
                                          className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                                        />
                                        <span className="truncate font-semibold">
                                          {capo.nome}{capo.taglia ? ` (Tg. ${capo.taglia})` : ''}
                                        </span>
                                      </div>
                                      <span className="font-mono text-[11px] font-bold text-amber-300 shrink-0">
                                        {capo.esente ? 'Esente' : `€ ${capo.cauzione.toFixed(2).replace('.', ',')}`}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                  Data Restituzione * (suggerita oggi)
                                </label>
                                <input
                                  type="date"
                                  value={riconsegnaData}
                                  onChange={(e) => setRiconsegnaData(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                  Importo Restituzione Cauzione (€)
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={riconsegnaRimborsoStr}
                                  onChange={(e) => setRiconsegnaRimborsoStr(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-blue-500"
                                />
                                {(() => {
                                  const calc = capiAttualmenteConsegnati
                                    .filter(c => riconsegnaSelezionati[c.key])
                                    .reduce((s, c) => s + (c.esente ? 0 : c.cauzione), 0);
                                  const ins = Number(String(riconsegnaRimborsoStr).replace(',', '.'));
                                  if (!Number.isNaN(ins) && Math.abs(ins - calc) > 0.009) {
                                    return (
                                      <span className="text-[10px] text-amber-400 font-bold block mt-1">
                                        ⚠️ Importo diverso dal calcolato (€ {calc.toFixed(2).replace('.', ',')}): alla conferma verrà richiesta verifica e saranno avvisati Presidente e Tesoriere.
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Note Verbale di Restituzione (Opzionale)
                              </label>
                              <input
                                type="text"
                                value={riconsegnaNote}
                                onChange={(e) => setRiconsegnaNote(e.target.value)}
                                placeholder="Es. Capi lavati e integri, restituzione tramite bonifico..."
                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleConfermaRiconsegnaVestiario}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg cursor-pointer active:scale-95"
                              >
                                <FileDown className="w-4 h-4" />
                                <span>Conferma Riconsegna & Scarica PDF Verbale</span>
                              </button>
                            </div>
                          </>
                        )}

                        {formVestiario.storicoRiconsegne && formVestiario.storicoRiconsegne.length > 0 && (
                          <div className="pt-2 border-t border-slate-800 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              Storico Riconsegne Registrate ({formVestiario.storicoRiconsegne.length})
                            </span>
                            {formVestiario.storicoRiconsegne.slice(0, 3).map(st => (
                              <div key={st.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10.5px] flex items-center justify-between gap-2">
                                <span className="text-slate-300 truncate">
                                  <strong>{st.dataRestituzione}</strong> — {st.capiRestituiti.join(', ')}
                                </span>
                                <span className="font-mono text-amber-300 font-bold shrink-0">
                                  € {st.importoRimborsoFinale.toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. SEZIONE ARCHIVIAZIONE DIGITALE: UPLOAD SCHEDA STAMPATA E FIRMATA */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2 text-white font-bold text-xs">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <span className="uppercase tracking-wide text-emerald-300">
                          Archiviazione Scheda Stampata & Firmata (Upload Scansione / PDF)
                        </span>
                      </div>
                      {formVestiario.documentoFirmato ? (
                        <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Firmato Agli Atti</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                          In attesa di firma
                        </span>
                      )}
                    </div>

                    {formVestiario.documentoFirmato ? (
                      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40 font-black text-xs">
                            PDF
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                              <span>{formVestiario.documentoFirmato.nomeFile}</span>
                              {formVestiario.documentoFirmato.dimensione && (
                                <span className="text-[10px] text-slate-400 font-mono">({formVestiario.documentoFirmato.dimensione})</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Archiviato il: {formVestiario.documentoFirmato.dataUpload}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => scaricaDocumentoFirmato(formVestiario.documentoFirmato!.fileBase64, formVestiario.documentoFirmato!.nomeFile)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
                            title="Scarica / Visualizza documento firmato"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Visualizza / Scarica</span>
                          </button>
                          
                          <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all cursor-pointer active:scale-95">
                            <Upload className="w-3.5 h-3.5 text-amber-400" />
                            <span>Sostituisci</span>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={handleUploadDocumentoFirmatoForm}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={rimuoviDocumentoFirmatoForm}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer active:scale-95"
                            title="Rimuovi file firmato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-dashed border-slate-700 text-center space-y-2">
                        <p className="text-xs text-slate-300">
                          Una volta stampato il PDF della Scheda Vestiario e raccolte le firme autografe, carica qui la scansione o il PDF firmato per conservarlo digitalmente nel fascicolo.
                        </p>
                        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-all shadow-md active:scale-95">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Carica Scheda Stampata & Firmata (PDF o Scansione)</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={handleUploadDocumentoFirmatoForm}
                            className="hidden"
                          />
                        </label>
                        <span className="block text-[10px] text-slate-500">Formati ammessi: PDF, PNG, JPG fino a 15MB</span>
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}
              {/* TAB 4: DOMANDA ISCRIZIONE */}
              {tabModaleEdit === 'domanda_iscrizione' && (
                <ModalCompilaDomandaIscrizione
                  embedded
                  isOpen={modaleEditAperta}
                  onClose={() => {}}
                  volontario={buildVolontarioLiveDaForm()}
                  volontari={volontari}
                  onDatiChange={(nuoviDati) => {
                    setFormDomandaIscrizioneDati(nuoviDati);
                    setFormEsenteQuota(Boolean(nuoviDati.esenteQuota));
                    if (nuoviDati.motivoEsenzione) {
                      setFormMotivoEsenzioneQuota(nuoviDati.motivoEsenzione as any);
                    }
                    if (nuoviDati.numeroTessera) {
                      setFormNumeroTessera(nuoviDati.numeroTessera);
                    }
                    if (nuoviDati.quotaVersata !== undefined) {
                      setFormQuotaVersata(nuoviDati.esenteQuota ? 0 : nuoviDati.quotaVersata);
                    }
                  }}
                  onSalvaVolontario={handleSalvaDaTabDomanda}
                  onNotificaRadio={onNotificaRadio}
                />
              )}
            </div>

            {/* Footer Modale Fisso su Riga Unica */}
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-slate-800 bg-slate-950 flex flex-nowrap items-center justify-between gap-2 shrink-0 overflow-x-auto">
              <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0">
                {volontarioInModifica && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleScaricaSchedaVestiario(volontarioInModifica)}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95"
                      title="Scarica la Scheda Vestiario & DPI in formato PDF da stampare e firmare"
                    >
                      <FileDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Scheda Vestiario</span>
                    </button>

                    {/* Carica Documento Stampato e Firmato dal Footer */}
                    <label
                      className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95 border ${
                        formVestiario.documentoFirmato
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                      }`}
                      title="Una volta stampato il PDF, carica qui la scansione o il PDF firmato"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>{formVestiario.documentoFirmato ? 'Doc. Firmato Agli Atti ✓' : 'Carica Doc. Firmato (PDF)'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleUploadDocumentoFirmatoForm}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                {volontarioInModifica && canDeleteEffettivo && (
                  <button
                    type="button"
                    onClick={() => setAccountDaEliminare(volontarioInModifica)}
                    className="py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/40 font-bold text-[11px] sm:text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95"
                    title="Elimina definitivamente questo account"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Elimina Account</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={chiudiModaleEdit}
                  className="py-1.5 sm:py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] sm:text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="py-1.5 sm:py-2 px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-[11px] sm:text-xs tracking-tight uppercase shadow-lg whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                >
                  {volontarioInModifica ? 'Salva Modifiche Profilo' : 'Registra Nuovo Profilo'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {/* SOTTO-MODALE CONFERMA ELIMINAZIONE ACCOUNT */}
      {accountDaEliminare && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h4 className="font-black text-sm uppercase">Conferma Eliminazione</h4>
                <p className="text-xs text-slate-400">Azione irreversibile</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Confermi di voler rimuovere dal database l'account di{' '}
              <strong className="text-white">{accountDaEliminare.nome} {accountDaEliminare.cognome}</strong>{' '}
              (<span className="text-amber-400">{accountDaEliminare.qualifica}</span>)?
              <br /><br />
              L'account verrà eliminato definitivamente da tutti i dispositivi e archivi.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={confermaEliminaAccount}
                className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
              >
                Elimina Definitivamente
              </button>
              <button
                type="button"
                onClick={() => setAccountDaEliminare(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SOTTO-MODALE RAPIDA: CARICAMENTO/GESTIONE FIRMA CON TRASPARENZA (PER ACCOUNT GIÀ ATTIVO) */}
      {volontarioPerFirmaRapida && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-lg w-full p-4 sm:p-6 text-white shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <PenTool className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase text-amber-400">
                    Firma Digitale con Trasparenza
                  </h4>
                  <p className="text-xs text-slate-300">
                    Account: <strong className="text-white">{volontarioPerFirmaRapida.nome} {volontarioPerFirmaRapida.cognome}</strong> ({volontarioPerFirmaRapida.qualifica})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVolontarioPerFirmaRapida(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
                title="Chiudi"
              >
                ✕
              </button>
            </div>

            <UploadFirmaTrasparente
              label={`Firma di ${volontarioPerFirmaRapida.nome} ${volontarioPerFirmaRapida.cognome}`}
              sottotitolo="Carica una foto o scansione della firma: il colore bianco verrà rimosso automaticamente rendendo la firma trasparente (PNG). Oppure disegnala sul display."
              valoreIniziale={firmaRapidaTemp}
              onFirmaCambiata={(nuovaFirma) => setFirmaRapidaTemp(nuovaFirma)}
            />

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const aggiornati = volontari.map(v =>
                    v.id === volontarioPerFirmaRapida.id
                      ? { ...v, firmaBase64: firmaRapidaTemp || undefined }
                      : v
                  );
                  onAggiornaVolontari(aggiornati);
                  onNotificaRadio(
                    `✍️ FIRMA AGGIORNATA: L'Amministratore ha ${firmaRapidaTemp ? 'caricato la firma trasparente' : 'rimosso la firma'} per ${volontarioPerFirmaRapida.nome} ${volontarioPerFirmaRapida.cognome}.`,
                    'centrale'
                  );
                  setAvvisoTemporaneo(`✅ Firma di ${volontarioPerFirmaRapida.nome} ${volontarioPerFirmaRapida.cognome} salvata con successo con sfondo trasparente!`);
                  setTimeout(() => setAvvisoTemporaneo(null), 4000);
                  setVolontarioPerFirmaRapida(null);
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Salva Firma Trasparente</span>
              </button>
              <button
                type="button"
                onClick={() => setVolontarioPerFirmaRapida(null)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE INFORMATIVA ACCESSO WEB PC DA QUALSIASI BROWSER */}
      <ModalAccessoWeb
        isOpen={modalAccessoWebAperta}
        onClose={() => setModalAccessoWebAperta(false)}
      />

      {/* MODALE COMPILAZIONE ED EXPORT DOMANDA ISCRIZIONE (PDF) */}
      <ModalCompilaDomandaIscrizione
        isOpen={modaleDomandaIscrizioneAperta}
        onClose={() => setModaleDomandaIscrizioneAperta(false)}
        volontario={volontarioPerDomandaIscrizione}
        volontari={volontari}
        onSalvaVolontario={(vAgg) => {
          const aggiornati = volontari.map((v) => (v.id === vAgg.id ? vAgg : v));
          onAggiornaVolontari(aggiornati);
          setVolontarioPerDomandaIscrizione(vAgg);
        }}
        onNotificaRadio={onNotificaRadio}
      />

      {/* MODALE CREAZIONE / MODIFICA CATEGORIA MANSIONI */}
      {modalCategoriaModalAperta && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl my-auto">
            {/* Header Fisso */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0 inline-flex items-center justify-center">
                  <IconaEmoji value={formCategoriaEmojiModal} fallback="📁" />
                </span>
                <div className="min-w-0">
                  <h4 className="font-black text-white text-sm truncate">
                    {categoriaInModificaModal ? 'Modifica Categoria Mansioni' : 'Nuova Categoria Mansioni'}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">Nome, icona (.ico o emoji) e genitorialità della categoria</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCategoriaModalAperta(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                title="Chiudi senza salvare"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo Scrollabile */}
            <div className="p-4 sm:p-5 space-y-3.5 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome Categoria *</label>
                <input
                  type="text"
                  value={formCategoriaNomeModal}
                  onChange={(e) => setFormCategoriaNomeModal(e.target.value)}
                  placeholder="Es. Emergenza 118, Sanitario Speciale..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Icona Emoji / Carica file .ico nell&apos;Archivio
                </label>
                <EmojiIconPicker
                  value={formCategoriaEmojiModal}
                  onChange={setFormCategoriaEmojiModal}
                  fallback="📁"
                  accent="purple"
                  allowIcoUpload
                  onCustomIconsChanged={(icons) => realtime.syncCustomEmojiIcons(icons)}
                  compact
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Genitorialità (Categoria Genitore Opzionale)
                </label>
                <select
                  value={formCategoriaParentIdModal}
                  onChange={(e) => setFormCategoriaParentIdModal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">Nessuna categoria genitore (Livello principale)</option>
                  {(() => {
                    const excludedCatIds = categoriaInModificaModal
                      ? new Set([categoriaInModificaModal.id, ...getDescendantCategoriaIds(categoriaInModificaModal.id, categorieMansioni)])
                      : new Set<string>();
                    return categorieMansioni
                      .filter(c => !excludedCatIds.has(c.id))
                      .map(c => {
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
                onClick={() => setModalCategoriaModalAperta(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSalvaCategoriaModal}
                disabled={!formCategoriaNomeModal.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 ${
                  formCategoriaNomeModal.trim()
                    ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salva Categoria</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA AZIONI / FORZATURE CAUZIONE */}
      {confermaAzioneModal && (
        <div className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`bg-slate-900 border-2 rounded-3xl max-w-md w-full p-5 sm:p-6 text-white shadow-2xl space-y-4 ${
              confermaAzioneModal.variante === 'danger'
                ? 'border-red-500/80'
                : confermaAzioneModal.variante === 'warning'
                ? 'border-amber-500/80'
                : 'border-blue-500/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confermaAzioneModal.variante === 'danger'
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : confermaAzioneModal.variante === 'warning'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-black text-sm uppercase">{confermaAzioneModal.titolo}</h4>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
              {confermaAzioneModal.messaggio}
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const fn = confermaAzioneModal.onConferma;
                  setConfermaAzioneModal(null);
                  fn();
                }}
                className={`flex-1 py-2.5 px-3 font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-md active:scale-95 ${
                  confermaAzioneModal.variante === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : confermaAzioneModal.variante === 'warning'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
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
    </div>
  );
};
