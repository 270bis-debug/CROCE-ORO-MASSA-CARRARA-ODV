import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Heart,
  CreditCard,
  FileText,
  Search,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  X,
  Save,
  Check,
  Ban,
  Printer,
  Sparkles,
  Building,
  UserCheck,
  Trash2,
  Mail,
  CheckSquare,
  Square,
  Building2,
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  Tag,
  Edit3,
  Link2,
  Percent,
  SlidersHorizontal,
  Landmark,
  Copy,
  Send,
  CalendarClock
} from 'lucide-react';
import { useTitoloDatabase, useNomiSottosezioniCustom } from '../../hooks/useNomiDatabase';
import { getTitoloSottosezione } from '../../constants/macroCategorie';
import {
  TesseraAssociativa,
  NotaDiDebito,
  RicevutaContabile,
  ContattoEsterno,
  InterventoManutenzione,
  SedeAssociativaCompleta,
  CategoriaCostoServizio,
  TariffaCostoServizio,
  VoceNotaDiDebito,
  ProprietarioImmobileData,
  MovimentoAltreEntrateUscite,
  VoceCostoGestione
} from '../../types/adminTypes';
import {
  useCategorieCostiServizio,
  salvaCategorieCostiServizio,
  getNomeCategoriaCosto
} from '../../utils/categorieCostiServizioStore';
import { TARIFFE_COSTI_SERVIZIO_INIZIALI } from '../../data/adminMockData';
import { DICITURA_ESENZIONE_BOLLO } from '../../data/tesseramento';
import { Volontario } from '../DatabaseVolontariModal';
import { realtime } from '../../services/realtime';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import {
  stampaEInviaRicevutaTesseramento,
  preparaVolontarioDaTessera,
  getTesoriereAttivo,
  generaRicevutaTesseramentoPDF
} from '../../utils/pdfRicevutaTesseramento';
import { scaricaNotaDiDebitoPDF, generaNotaDiDebitoPDF } from '../../utils/pdfNotaDiDebito';
import { scaricaRicevutaContabilePDF, generaRicevutaContabilePDF } from '../../utils/pdfRicevutaContabile';
import { PdfAnteprimaWorkflowModal } from './PdfAnteprimaWorkflowModal';
import { generaBytesDaJsPDF, scaricaBytesPDF, scaricaOStampaMultipliPDF, PdfBatchItem } from '../../utils/pdfWorkflowUtils';
import { getDatiCartaIntestata } from '../../utils/cartaIntestataStore';
import {
  calcolaProspettoCommercialista,
  scaricaProspettoCommercialistaCSV,
  ProspettoAnnualeCommercialista,
  RigaProspettoMensile
} from '../../utils/prospettoCommercialista';
import { RIFORNIMENTI_INIZIALI } from '../../data/rifornimentiMockData';
import { RifornimentoCarburante } from '../../types/consumiTypes';
import { getRifornimentiMezzi, RIFORNIMENTI_UPDATED_EVENT } from '../../utils/rifornimentiStore';
import { addDaysISODate, formatISODateItaly, getCurrentYearItaly } from '../../utils/italianTime';
import { useMetodiPagamentoCustom, formattaEtichettaMetodoPagamento } from '../../utils/metodiPagamentoStore';
import { GestioneMetodiPagamentoCustomPanel } from './GestioneMetodiPagamentoCustomPanel';
import { PannelloScadenzeFiscaliOdv } from './PannelloScadenzeFiscaliOdv';
import { useScadenzeFiscaliOdv } from '../../utils/scadenzeFiscaliOdv';

interface SezioneContabilitaProps {
  serviziArchivio: any[];
  onAggiornaServizioArchivio?: (servizioAggiornato: any) => void;
  tessere: TesseraAssociativa[];
  onAggiornaTessere: (tessere: TesseraAssociativa[]) => void;
  noteDiDebito: NotaDiDebito[];
  onAggiornaNoteDiDebito: (note: NotaDiDebito[]) => void;
  costiServizio?: TariffaCostoServizio[];
  onAggiornaCostiServizio?: (tariffe: TariffaCostoServizio[]) => void;
  altreEntrateUscite?: MovimentoAltreEntrateUscite[];
  onAggiornaAltreEntrateUscite?: (voci: MovimentoAltreEntrateUscite[]) => void;
  costiGestione?: VoceCostoGestione[];
  onAggiornaCostiGestione?: (voci: VoceCostoGestione[]) => void;
  ricevuteContabilita?: RicevutaContabile[];
  onAggiornaRicevuteContabilita?: (ricevute: RicevutaContabile[]) => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  volontari?: Volontario[];
  contatti?: ContattoEsterno[];
  onAggiungiContatto?: (contatto: ContattoEsterno) => void;
  manutenzioni?: InterventoManutenzione[];
  rifornimenti?: RifornimentoCarburante[];
  sedi?: SedeAssociativaCompleta[];
  allowedSubtabs?: string[] | null;
  puoModificarePreavvisoFiscale?: boolean;
}

export const SezioneContabilita: React.FC<SezioneContabilitaProps> = ({
  serviziArchivio,
  onAggiornaServizioArchivio,
  tessere,
  onAggiornaTessere,
  noteDiDebito,
  onAggiornaNoteDiDebito,
  costiServizio: costiServizioProp,
  onAggiornaCostiServizio,
  altreEntrateUscite: altreEntrateUsciteProp,
  onAggiornaAltreEntrateUscite,
  costiGestione: costiGestioneProp,
  onAggiornaCostiGestione,
  ricevuteContabilita: ricevuteContabilitaProp,
  onAggiornaRicevuteContabilita,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  volontari = [],
  contatti = [],
  onAggiungiContatto,
  manutenzioni = [],
  rifornimenti: rifornimentiProp,
  sedi = [],
  allowedSubtabs = null,
  puoModificarePreavvisoFiscale = false
}) => {
  const nomiSubCustom = useNomiSottosezioniCustom();
  const { scadenze: scadenzeFiscaliOdvLista } = useScadenzeFiscaliOdv();
  const [sottoTab, setSottoTab] = useState<'donazioni' | 'tesseramento' | 'noteDebito' | 'commercialista' | 'costiServizio' | 'contiCorrenti' | 'altreEntrateUscite' | 'costiGestione' | 'ricevute' | 'scadenzeFiscali'>('donazioni');
  const canShowSubtab = (id: string) => {
    if (!allowedSubtabs) return true;
    if (id === 'scadenzeFiscali') return allowedSubtabs.includes('scadenzeFiscali') || allowedSubtabs.length > 0;
    return allowedSubtabs.includes(id);
  };

  useEffect(() => {
    if (!canShowSubtab(sottoTab)) {
      const ordine = ['donazioni', 'tesseramento', 'noteDebito', 'commercialista', 'costiServizio', 'contiCorrenti', 'altreEntrateUscite', 'costiGestione', 'ricevute', 'scadenzeFiscali'] as const;
      const prima = ordine.find((t) => canShowSubtab(t));
      if (prima) setSottoTab(prima);
    }
  }, [sottoTab, allowedSubtabs]);
  const [annoProspetto, setAnnoProspetto] = useState<number>(() => getCurrentYearItaly());
  const [meseDettaglioSelezionato, setMeseDettaglioSelezionato] = useState<RigaProspettoMensile | null>(null);

  // Coordinate Bancarie e Postali ufficiali sincronizzate dal Database Anagrafiche Sedi Associative
  const sedeRiferimento = (sedi && sedi.length > 0) ? sedi[0] : null;
  const infoCartaIntestata = getDatiCartaIntestata();

  const intestatarioUfficiale = sedeRiferimento?.intestatarioConti || infoCartaIntestata.intestatarioConti || 'CROCE ORO MASSA CARRARA ODV';
  const ibanCreditAgricole = sedeRiferimento?.ibanBanca || infoCartaIntestata.ibanBanca || 'IT79M0623024500000046980317';
  const bancaCreditAgricole = sedeRiferimento?.bancaAppoggio || infoCartaIntestata.bancaAppoggio || 'Credit Agricole';
  const ibanPoste = sedeRiferimento?.ibanPoste || infoCartaIntestata.ibanPoste || 'IT40P0760113600001007035676';
  const bancaPoste = sedeRiferimento?.bancaPoste || infoCartaIntestata.bancaPoste || 'POSTE ITALIANE';
  const ccPostale = sedeRiferimento?.ccPostale || infoCartaIntestata.ccPostale || '00001007035676';

  const defaultMetodoNota = `Bonifico Bancario - ${bancaCreditAgricole} (IBAN: ${ibanCreditAgricole})`;
  const [ibanCopiatoFeedback, setIbanCopiatoFeedback] = useState<string | null>(null);

  const metodiPagamentoCustom = useMetodiPagamentoCustom();
  const metodiPerDonazioni = React.useMemo(
    () => metodiPagamentoCustom.filter((m) => m.attivo && (m.tipo === 'entrambi' || m.tipo === 'donazioni')),
    [metodiPagamentoCustom]
  );
  const metodiPerPagamenti = React.useMemo(
    () => metodiPagamentoCustom.filter((m) => m.attivo && (m.tipo === 'entrambi' || m.tipo === 'pagamenti')),
    [metodiPagamentoCustom]
  );

  // Rifornimenti per calcolo uscite carburante (aggiornati in tempo reale su nuovi rifornimenti e cloud sync)
  const [rifornimentiLocali, setRifornimentiLocali] = useState<RifornimentoCarburante[]>(() =>
    getRifornimentiMezzi()
  );
  React.useEffect(() => {
    const aggiorna = () => setRifornimentiLocali(getRifornimentiMezzi());
    window.addEventListener(RIFORNIMENTI_UPDATED_EVENT, aggiorna);
    return () => window.removeEventListener(RIFORNIMENTI_UPDATED_EVENT, aggiorna);
  }, []);

  const rifornimentiCarburante: RifornimentoCarburante[] = React.useMemo(() => {
    if (rifornimentiProp && rifornimentiProp.length > 0) return rifornimentiProp;
    return rifornimentiLocali;
  }, [rifornimentiProp, rifornimentiLocali]);

  // Ricerca e filtri
  const [ricerca, setRicerca] = useState('');
  const [filtroMese, setFiltroMese] = useState('');
  const [filtroStatoTessera, setFiltroStatoTessera] = useState('tutti');
  const [filtroStatoNota, setFiltroStatoNota] = useState('tutti');

  // Modale Nuova Tessera
  const [modaleNuovaTesseraAperta, setModaleNuovaTesseraAperta] = useState(false);
  const [formTessNome, setFormTessNome] = useState('');
  const [formTessCognome, setFormTessCognome] = useState('');
  const [formTessCF, setFormTessCF] = useState('');
  const [formTessQualifica, setFormTessQualifica] = useState<TesseraAssociativa['qualifica']>('Volontario Soccorritore');
  const [formTessQuota, setFormTessQuota] = useState(5.0);
  const [formTessNumero, setFormTessNumero] = useState(`TO-${getCurrentYearItaly()}/${String(tessere.length + 1).padStart(3, '0')}`);

  // Modale Annulla Tessera
  const [tesseraDaAnnullare, setTesseraDaAnnullare] = useState<TesseraAssociativa | null>(null);
  const [motivoAnnullamentoTessera, setMotivoAnnullamentoTessera] = useState('Dimissioni volontarie del socio');

  // Modale Nuova Nota di Debito (con servizio collegato, voci editabili e scontistiche)
  const [modaleNuovaNotaAperta, setModaleNuovaNotaAperta] = useState(false);
  const [formNotaDebitore, setFormNotaDebitore] = useState('Azienda USL Toscana Nord Ovest');
  const [formNotaPiva, setFormNotaPiva] = useState('02198590503');
  const [formNotaIndirizzo, setFormNotaIndirizzo] = useState('Via Monterotondo 49, Livorno (LI)');
  const [formNotaEmail, setFormNotaEmail] = useState('');
  const [formNotaEmailNonDisponibile, setFormNotaEmailNonDisponibile] = useState(false);
  const [formNotaPec, setFormNotaPec] = useState('');
  const [formNotaPecNonDisponibile, setFormNotaPecNonDisponibile] = useState(false);
  const [formNotaCausale, setFormNotaCausale] = useState('Trasporto Sanitario Paziente');
  const [formNotaImporto, setFormNotaImporto] = useState(250.0);
  const [formNotaScadenza, setFormNotaScadenza] = useState(
    addDaysISODate(formatISODateItaly(), 30)
  );
  const [formNotaMetodo, setFormNotaMetodo] = useState<string>(defaultMetodoNota);
  const [formNotaRiferimento, setFormNotaRiferimento] = useState('');
  const [formServizioCollegatoId, setFormServizioCollegatoId] = useState<string>('');
  const [formKmPercorsiServizio, setFormKmPercorsiServizio] = useState<number>(0);
  const [formOreImpiegoServizio, setFormOreImpiegoServizio] = useState<number>(0);
  const [formProprietarioImmobile, setFormProprietarioImmobile] = useState<ProprietarioImmobileData>({
    nomeCognome: '',
    codiceFiscale: '',
    indirizzoResidenza: ''
  });
  const [mostraSezioneProprietario, setMostraSezioneProprietario] = useState(false);
  const [formVociDettaglio, setFormVociDettaglio] = useState<VoceNotaDiDebito[]>([]);
  const [formScontoTipo, setFormScontoTipo] = useState<'nessuno' | 'percentuale' | 'fisso'>('nessuno');
  const [formScontoValore, setFormScontoValore] = useState<number>(0);
  const [formScontoDescrizione, setFormScontoDescrizione] = useState<string>('');

  // Stato Costi di Servizio (Sotto-sezione 5)
  const [costiServizioLocali, setCostiServizioLocali] = useState<TariffaCostoServizio[]>(() => {
    try {
      const saved = localStorage.getItem('croceoro_costi_servizio_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return TARIFFE_COSTI_SERVIZIO_INIZIALI;
  });
  const tariffeCostiServizio: TariffaCostoServizio[] = React.useMemo(() => {
    if (costiServizioProp && costiServizioProp.length > 0) return costiServizioProp;
    return costiServizioLocali;
  }, [costiServizioProp, costiServizioLocali]);

  const salvaTariffeCostiServizio = (nuove: TariffaCostoServizio[]) => {
    setCostiServizioLocali(nuove);
    try {
      localStorage.setItem('croceoro_costi_servizio_v1', JSON.stringify(nuove));
    } catch {}
    onAggiornaCostiServizio?.(nuove);
  };

  const categorieCostiServizio = useCategorieCostiServizio();
  const [mostraGestioneCategorieCosti, setMostraGestioneCategorieCosti] = useState(false);
  const [nuovaCatCostoNome, setNuovaCatCostoNome] = useState('');
  const [nuovaCatCostoUnita, setNuovaCatCostoUnita] = useState('servizio');
  const [nuovaCatCostoDesc, setNuovaCatCostoDesc] = useState('');
  const [editingCatCostoId, setEditingCatCostoId] = useState<string | null>(null);
  const [editingCatCostoNome, setEditingCatCostoNome] = useState('');
  const [editingCatCostoUnita, setEditingCatCostoUnita] = useState('');
  const [editingCatCostoDesc, setEditingCatCostoDesc] = useState('');
  const [confermaEliminaCatCostoId, setConfermaEliminaCatCostoId] = useState<string | null>(null);

  const [filtroCategoriaTariffa, setFiltroCategoriaTariffa] = useState<string>('tutti');
  const [editingTariffaId, setEditingTariffaId] = useState<string | null>(null);
  const [formTariffaCategoria, setFormTariffaCategoria] = useState<string>('mezzo_km');
  const [formTariffaSigla, setFormTariffaSigla] = useState('');
  const [formTariffaDescrizioneSigla, setFormTariffaDescrizioneSigla] = useState('');
  const [formTariffaNome, setFormTariffaNome] = useState('');
  const [formTariffaImporto, setFormTariffaImporto] = useState('0');
  const [formTariffaUnita, setFormTariffaUnita] = useState('km');
  const [formTariffaNote, setFormTariffaNote] = useState('');
  const [confermaEliminaTariffaId, setConfermaEliminaTariffaId] = useState<string | null>(null);

  useEffect(() => {
    if (categorieCostiServizio.length > 0 && !categorieCostiServizio.some((c) => c.id === formTariffaCategoria)) {
      setFormTariffaCategoria(categorieCostiServizio[0].id);
    }
    if (filtroCategoriaTariffa !== 'tutti' && !categorieCostiServizio.some((c) => c.id === filtroCategoriaTariffa)) {
      setFiltroCategoriaTariffa('tutti');
    }
  }, [categorieCostiServizio, formTariffaCategoria, filtroCategoriaTariffa]);

  // Modale Anteprima Documento per Stampa (Tessera, Nota di Debito o Ricevuta)
  const [documentoPerStampa, setDocumentoPerStampa] = useState<{ tipo: 'tessera' | 'nota' | 'ricevuta'; data: any } | null>(null);
  const [inviandoEmailStampa, setInviandoEmailStampa] = useState(false);

  // Workflow Anteprima / Stampa / Salva / Torna alla Modifica prima della generazione PDF
  const [bozzaPdfWorkflow, setBozzaPdfWorkflow] = useState<{
    tipo: 'tessera' | 'nota' | 'ricevuta';
    data: any;
    salvato: boolean;
  } | null>(null);

  // Selezione multipla PDF per sottosezione (Tessere, Note di Debito, Ricevute)
  const [selectedTessereIds, setSelectedTessereIds] = useState<string[]>([]);
  const [selectedRicevuteIds, setSelectedRicevuteIds] = useState<string[]>([]);
  const [batchPdfInCorso, setBatchPdfInCorso] = useState(false);

  // Selezione multipla e rimozione Note di Debito dall'archivio con notifica email
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [modaleConfermaEliminaNoteAperta, setModaleConfermaEliminaNoteAperta] = useState(false);
  const [noteDaEliminare, setNoteDaEliminare] = useState<NotaDiDebito[]>([]);
  const [motivoEliminazioneNota, setMotivoEliminazioneNota] = useState('');
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);

  // Notifiche
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Modale Nuova Donazione & Validazione Limiti (€ > 0 e <= 10.000)
  const [modaleNuovaDonazioneAperta, setModaleNuovaDonazioneAperta] = useState(false);
  const [formDonazioneServizioCollegatoId, setFormDonazioneServizioCollegatoId] = useState<string>('');
  const [ricercaServizioDonazione, setRicercaServizioDonazione] = useState<string>('');
  const [formDonazioneCodice, setFormDonazioneCodice] = useState('');
  const [formDonazionePaziente, setFormDonazionePaziente] = useState('');
  const [formDonazioneData, setFormDonazioneData] = useState(() => formatISODateItaly());
  const [formDonazioneImporto, setFormDonazioneImporto] = useState('');
  const [formDonazioneMetodo, setFormDonazioneMetodo] = useState<string>('Contanti');
  const [formDonazioneRicevuta, setFormDonazioneRicevuta] = useState('');
  const [formDonazioneCfPiva, setFormDonazioneCfPiva] = useState('');
  const [formDonazioneNote, setFormDonazioneNote] = useState('');
  const [donazioniExtra, setDonazioniExtra] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('croceoro_donazioni_extra_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Stato Altre Entrate / Uscite (Sotto-sezione 7)
  const [altreEntrateUsciteLocali, setAltreEntrateUsciteLocali] = useState<MovimentoAltreEntrateUscite[]>(() => {
    try {
      const saved = localStorage.getItem('croceoro_altre_entrate_uscite_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const listaAltreEntrateUscite: MovimentoAltreEntrateUscite[] = React.useMemo(
    () => (altreEntrateUsciteProp !== undefined ? altreEntrateUsciteProp : altreEntrateUsciteLocali),
    [altreEntrateUsciteProp, altreEntrateUsciteLocali]
  );
  const salvaAltreEntrateUscite = (nuove: MovimentoAltreEntrateUscite[]) => {
    setAltreEntrateUsciteLocali(nuove);
    try {
      localStorage.setItem('croceoro_altre_entrate_uscite_v1', JSON.stringify(nuove));
    } catch {}
    onAggiornaAltreEntrateUscite?.(nuove);
  };
  const [filtroAltreTipo, setFiltroAltreTipo] = useState<'tutti' | 'entrata' | 'uscita'>('tutti');
  const [filtroAltreMese, setFiltroAltreMese] = useState<string>('');
  const [ricercaAltre, setRicercaAltre] = useState<string>('');
  const [editingAltraId, setEditingAltraId] = useState<string | null>(null);
  const [formAltraData, setFormAltraData] = useState<string>(() => formatISODateItaly());
  const [formAltraTipo, setFormAltraTipo] = useState<'entrata' | 'uscita'>('entrata');
  const [formAltraDescrizione, setFormAltraDescrizione] = useState<string>('');
  const [formAltraCategoria, setFormAltraCategoria] = useState<string>('Contributo / Rimborso');
  const [formAltraImporto, setFormAltraImporto] = useState<string>('');
  const [formAltraMetodo, setFormAltraMetodo] = useState<string>('Contanti');
  const [formAltraControparte, setFormAltraControparte] = useState<string>('');
  const [formAltraRifDoc, setFormAltraRifDoc] = useState<string>('');
  const [formAltraNote, setFormAltraNote] = useState<string>('');
  const [confermaEliminaAltraId, setConfermaEliminaAltraId] = useState<string | null>(null);

  // Stato Costi di Gestione (Sotto-sezione 8)
  const CATEGORIE_COSTI_GESTIONE = [
    'Carburante Flotta',
    'Utenze (Luce, Gas, Acqua)',
    'Affitto & Spese Sede',
    'Assicurazioni & Polizze',
    'Telefonia, Internet & Software',
    'Cancelleria & Materiale Ufficio',
    'Consulenze & Commercialista',
    'Materiale Sanitario & DPI',
    'Pulizie & Manutenzione Sede',
    'Tasse, Bolli & Imposte',
    'Spese Bancarie & POS',
    'Altro Costo di Gestione'
  ];
  const [costiGestioneLocali, setCostiGestioneLocali] = useState<VoceCostoGestione[]>(() => {
    try {
      const saved = localStorage.getItem('croceoro_costi_gestione_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const listaCostiGestione: VoceCostoGestione[] = React.useMemo(
    () => (costiGestioneProp !== undefined ? costiGestioneProp : costiGestioneLocali),
    [costiGestioneProp, costiGestioneLocali]
  );
  const salvaCostiGestione = (nuove: VoceCostoGestione[]) => {
    setCostiGestioneLocali(nuove);
    try {
      localStorage.setItem('croceoro_costi_gestione_v1', JSON.stringify(nuove));
    } catch {}
    onAggiornaCostiGestione?.(nuove);
  };
  const [filtroGestioneTipo, setFiltroGestioneTipo] = useState<'tutti' | 'uscita' | 'entrata'>('tutti');
  const [filtroGestioneCategoria, setFiltroGestioneCategoria] = useState<string>('tutte');
  const [filtroGestioneMese, setFiltroGestioneMese] = useState<string>('');
  const [ricercaGestione, setRicercaGestione] = useState<string>('');
  const [editingGestioneId, setEditingGestioneId] = useState<string | null>(null);
  const [formGestioneData, setFormGestioneData] = useState<string>(() => formatISODateItaly());
  const [formGestioneTipo, setFormGestioneTipo] = useState<'uscita' | 'entrata'>('uscita');
  const [formGestioneDescrizione, setFormGestioneDescrizione] = useState<string>('');
  const [formGestioneCategoria, setFormGestioneCategoria] = useState<string>('Utenze (Luce, Gas, Acqua)');
  const [formGestioneImporto, setFormGestioneImporto] = useState<string>('');
  const [formGestioneMetodo, setFormGestioneMetodo] = useState<string>(defaultMetodoNota);
  const [formGestioneFornitore, setFormGestioneFornitore] = useState<string>('');
  const [formGestioneNumDoc, setFormGestioneNumDoc] = useState<string>('');
  const [formGestioneNote, setFormGestioneNote] = useState<string>('');
  const [confermaEliminaGestioneId, setConfermaEliminaGestioneId] = useState<string | null>(null);

  // Stato Emissione Ricevute (Sotto-sezione 9)
  const [ricevuteLocali, setRicevuteLocali] = useState<RicevutaContabile[]>(() => {
    try {
      const saved = localStorage.getItem('CROCE_ORO_RICEVUTE_CONTABILITA');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const listaRicevute: RicevutaContabile[] = React.useMemo(
    () => (ricevuteContabilitaProp !== undefined ? ricevuteContabilitaProp : ricevuteLocali),
    [ricevuteContabilitaProp, ricevuteLocali]
  );
  const salvaRicevuteContabilita = (nuove: RicevutaContabile[]) => {
    setRicevuteLocali(nuove);
    try {
      localStorage.setItem('CROCE_ORO_RICEVUTE_CONTABILITA', JSON.stringify(nuove));
    } catch {}
    onAggiornaRicevuteContabilita?.(nuove);
  };
  const [ricercaRicevute, setRicercaRicevute] = useState('');
  const [filtroStatoRicevuta, setFiltroStatoRicevuta] = useState<'tutte' | 'Emessa' | 'Annullata'>('tutte');
  const [modaleNuovaRicevutaAperta, setModaleNuovaRicevutaAperta] = useState(false);
  const [formRicTipologia, setFormRicTipologia] = useState<RicevutaContabile['tipologia']>('Erogazione Liberale / Donazione');
  const [formRicData, setFormRicData] = useState<string>(() => formatISODateItaly());
  const [formRicIntestatario, setFormRicIntestatario] = useState('');
  const [formRicCfPiva, setFormRicCfPiva] = useState('');
  const [formRicIndirizzo, setFormRicIndirizzo] = useState('');
  const [formRicEmail, setFormRicEmail] = useState('');
  const [formRicEmailNonDisponibile, setFormRicEmailNonDisponibile] = useState(false);
  const [formRicPec, setFormRicPec] = useState('');
  const [formRicPecNonDisponibile, setFormRicPecNonDisponibile] = useState(false);
  const [formRicCausale, setFormRicCausale] = useState('');
  const [formRicRiferimento, setFormRicRiferimento] = useState('');
  const [formRicImporto, setFormRicImporto] = useState<string>('');
  const [formRicMetodo, setFormRicMetodo] = useState<string>('Contanti');
  const [formRicNote, setFormRicNote] = useState('');
  const [ricevutaDaAnnullare, setRicevutaDaAnnullare] = useState<RicevutaContabile | null>(null);
  const [motivoAnnullamentoRicevuta, setMotivoAnnullamentoRicevuta] = useState('Errore di compilazione / emissione duplicata');
  const [confermaEliminaRicevutaId, setConfermaEliminaRicevutaId] = useState<string | null>(null);

  // Chiusura accessibile dei modali con tasto ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modaleNuovaNotaAperta) setModaleNuovaNotaAperta(false);
        if (modaleNuovaDonazioneAperta) setModaleNuovaDonazioneAperta(false);
        if (modaleNuovaTesseraAperta) setModaleNuovaTesseraAperta(false);
        if (modaleNuovaRicevutaAperta) setModaleNuovaRicevutaAperta(false);
        if (ricevutaDaAnnullare) setRicevutaDaAnnullare(null);
        if (tesseraDaAnnullare) setTesseraDaAnnullare(null);
        if (meseDettaglioSelezionato) setMeseDettaglioSelezionato(null);
        if (modaleConfermaEliminaNoteAperta) setModaleConfermaEliminaNoteAperta(false);
        if (documentoPerStampa) setDocumentoPerStampa(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    modaleNuovaNotaAperta,
    modaleNuovaDonazioneAperta,
    modaleNuovaTesseraAperta,
    modaleNuovaRicevutaAperta,
    ricevutaDaAnnullare,
    tesseraDaAnnullare,
    meseDettaglioSelezionato,
    modaleConfermaEliminaNoteAperta,
    documentoPerStampa
  ]);

  // Validazione dell'importo donazione: non deve essere <= 0 e non deve superare la soglia preventiva di € 10.000
  const importoNumerico = parseFloat((formDonazioneImporto || '').replace(',', '.'));
  const erroreImportoDonazione = React.useMemo(() => {
    if (!formDonazioneImporto.trim()) return null;
    if (isNaN(importoNumerico) || importoNumerico <= 0) {
      return 'L\'importo della donazione deve essere strettamente superiore a € 0,00.';
    }
    if (importoNumerico > 10000) {
      return 'Attenzione: la soglia massima consentita per singola donazione è di € 10.000,00 per prevenire errori di battitura.';
    }
    return null;
  }, [formDonazioneImporto, importoNumerico]);

  const toISODateOnly = (raw?: string): string => {
    const str = (raw || '').trim();
    if (!str) return formatISODateItaly();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const mIt = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
    if (mIt) return `${mIt[3]}-${mIt[2]}-${mIt[1]}`;
    return formatISODateItaly();
  };

  const estraiImportoDonazione = (s: any): number => {
    if (!s) return 0;
    const raw =
      s.donazioneLibera ||
      s.importoDonazione ||
      s.offertaLibera ||
      (s.donazione && (s.donazione.somma ?? s.donazione.importo)) ||
      (s.datiDestinazione && s.datiDestinazione.donazione && s.datiDestinazione.donazione.somma) ||
      '0';
    const val = parseFloat(String(raw).replace(',', '.'));
    return isNaN(val) ? 0 : val;
  };

  const estraiNomeDonatore = (s: any): string => {
    if (!s) return 'Richiedente Privato';
    const donAltro = s.datiDestinazione?.donazione?.tipoDonatore === 'altro' && s.datiDestinazione?.donazione?.donatoreAltro
      ? `${s.datiDestinazione.donazione.donatoreAltro.nome || ''} ${s.datiDestinazione.donazione.donatoreAltro.cognome || ''}`.trim()
      : '';
    const propDest = s.datiDestinazione?.proprietario
      ? `${s.datiDestinazione.proprietario.nome || ''} ${s.datiDestinazione.proprietario.cognome || ''}`.trim()
      : '';
    return (
      s.donatore ||
      donAltro ||
      s.paziente ||
      s.richiedente ||
      propDest ||
      s.proprietarioImmobile?.nomeCognome ||
      s.chiamante ||
      'Richiedente Privato'
    );
  };

  const estraiCfPivaDonatore = (s: any): string => {
    if (!s) return '';
    const isAltroDonatore = s.datiDestinazione?.donazione?.tipoDonatore === 'altro';
    const cfAltro = (s.datiDestinazione?.donazione?.donatoreAltro?.codiceFiscale || '').trim();
    const cfPropDest = (s.datiDestinazione?.proprietario?.codiceFiscale || '').trim();
    const cfPropCentrale = (s.datiProprietarioCentrale?.codiceFiscale || '').trim();
    const cfPropImmobile = (s.proprietarioImmobile?.codiceFiscale || '').trim();
    const cfDiretto = (
      s.codiceFiscaleDonatore ||
      s.partitaIvaCodiceFiscale ||
      s.donazione?.codiceFiscale ||
      s.codiceFiscale ||
      ''
    ).trim();
    if (cfDiretto) return cfDiretto.toUpperCase();
    if (isAltroDonatore && cfAltro) return cfAltro.toUpperCase();
    return (cfAltro || cfPropDest || cfPropCentrale || cfPropImmobile || '').toUpperCase();
  };

  const serviziArchivioOrdinatiPerDonazione = React.useMemo(() => {
    const q = ricercaServizioDonazione.trim().toLowerCase();
    return (serviziArchivio || []).filter((s) => {
      if (!q) return true;
      const hay = [
        s.codice,
        s.id,
        s.data,
        s.mezzo,
        s.ambito,
        s.tipoServizio,
        s.chiamante,
        s.paziente,
        s.indirizzoIntervento,
        s.destinazione,
        s.volontarioNome,
        estraiCfPivaDonatore(s)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [serviziArchivio, ricercaServizioDonazione]);

  const servizioCollegatoSelezionato = React.useMemo(() => {
    if (!formDonazioneServizioCollegatoId) return null;
    return (serviziArchivio || []).find((s) => (s.id || s.codice) === formDonazioneServizioCollegatoId) || null;
  }, [serviziArchivio, formDonazioneServizioCollegatoId]);

  const handleSelezionaServizioPerDonazione = (servizioId: string) => {
    setFormDonazioneServizioCollegatoId(servizioId);
    if (!servizioId) {
      setFormDonazioneCodice('');
      setFormDonazioneData(formatISODateItaly());
      setFormDonazionePaziente('');
      setFormDonazioneCfPiva('');
      setFormDonazioneNote('');
      return;
    }
    const srv = (serviziArchivio || []).find((s) => (s.id || s.codice) === servizioId);
    if (!srv) return;

    setFormDonazioneCodice(srv.codice || servizioId);
    setFormDonazioneData(toISODateOnly(srv.dataInizioServizioSpecifico || srv.data || srv.dataServizio));
    const donatoreSuggerito = estraiNomeDonatore(srv);
    setFormDonazionePaziente(donatoreSuggerito === 'Richiedente Privato' ? '' : donatoreSuggerito);
    // Ripesca in automatico il C.F. / P.Iva compilato dal volontario nella sezione donazione o sul servizio (resta editabile)
    setFormDonazioneCfPiva(estraiCfPivaDonatore(srv));

    const tratta = [srv.indirizzoIntervento, srv.destinazione].filter(Boolean).join(' -> ');
    const tipo = srv.tipoServizio || srv.ambito || 'Servizio Operativo';
    setFormDonazioneNote(
      `Erogazione liberale collegata a servizio ${srv.codice || servizioId} (${tipo})${tratta ? ` - ${tratta}` : ''}`
    );

    const impEsistente = estraiImportoDonazione(srv);
    if (impEsistente > 0 && !formDonazioneImporto.trim()) {
      setFormDonazioneImporto(impEsistente.toFixed(2));
    }
  };

  // Lista unificata di donazioni: servizi archivio + donazioni extra registrate (senza duplicati se già aggiornato nell'archivio)
  const tuttiServiziDonazioni = React.useMemo(() => {
    const chiaviArchivioConDonazione = new Set<string>();
    (serviziArchivio || []).forEach((s) => {
      if (estraiImportoDonazione(s) > 0 || s.donazioneRicevuta || s.ricevutaDonazione || s.datiDestinazione?.donazione?.ricevuta) {
        if (s.id) chiaviArchivioConDonazione.add(String(s.id));
        if (s.codice) chiaviArchivioConDonazione.add(String(s.codice));
      }
    });
    const extraFiltrate = (donazioniExtra || []).filter((d) => {
      const collId = d.servizioCollegatoId ? String(d.servizioCollegatoId) : '';
      const cod = d.codice ? String(d.codice) : '';
      if (collId && chiaviArchivioConDonazione.has(collId)) return false;
      if (d.servizioCollegato && cod && chiaviArchivioConDonazione.has(cod)) return false;
      return true;
    });
    return [...extraFiltrate, ...(serviziArchivio || [])];
  }, [donazioniExtra, serviziArchivio]);

  // =========================================================================
  // 1. FILTRO ESCLUSIVO: SOLO SERVIZI CON DONAZIONI
  // =========================================================================
  const serviziConDonazioni = tuttiServiziDonazioni.filter((s) => {
    const importo = estraiImportoDonazione(s);
    const haDonazione = Boolean(
      importo > 0 ||
      (s.donazioneRicevuta && s.donazioneRicevuta !== '0' && s.donazioneRicevuta !== '') ||
      (s.ricevutaDonazione && s.ricevutaDonazione !== '') ||
      s.datiDestinazione?.donazione?.ricevuta
    );
    if (!haDonazione) return false;

    const nomeDon = estraiNomeDonatore(s);
    const matchRicerca =
      !ricerca.trim() ||
      (s.codice && s.codice.toLowerCase().includes(ricerca.toLowerCase())) ||
      nomeDon.toLowerCase().includes(ricerca.toLowerCase()) ||
      (s.mezzo && s.mezzo.toLowerCase().includes(ricerca.toLowerCase())) ||
      (s.destinazione && s.destinazione.toLowerCase().includes(ricerca.toLowerCase())) ||
      (s.indirizzoIntervento && s.indirizzoIntervento.toLowerCase().includes(ricerca.toLowerCase()));

    const dataIso = toISODateOnly(s.dataDonazione || s.data || s.dataServizio);
    const matchMese = !filtroMese || dataIso.startsWith(filtroMese);

    return matchRicerca && matchMese;
  });

  const totaleDonazioniIncassate = serviziConDonazioni.reduce((acc, curr) => {
    return acc + estraiImportoDonazione(curr);
  }, 0);

  // Esportazione in formato CSV di tutte le donazioni per la Tesoreria
  const esportaDonazioniCsv = () => {
    if (serviziConDonazioni.length === 0) {
      mostraAvviso('Nessuna donazione da esportare con i filtri correnti.');
      return;
    }

    const headers = [
      'Data',
      'Codice Missione',
      'Importo (€)',
      'Metodo Donazione',
      'Paziente / Donatore',
      'C.F. / P.Iva',
      'N. Ricevuta Fiscale',
      'Volontario / Operatore',
      'Note / Destinazione'
    ];

    const righe = serviziConDonazioni.map((s) => {
      const imp = estraiImportoDonazione(s);
      const metodo =
        s.metodoDonazione ||
        s.metodoPagamento ||
        s.donazioneMetodo ||
        s.donazione?.modalita ||
        (s.datiDestinazione?.donazione?.metodo === 'pos' ? 'POS Elettronico' : s.datiDestinazione?.donazione?.metodo === 'contanti' ? 'Contanti' : (s.datiDestinazione?.donazione?.metodo || '')) ||
        (s.ricevutaDonazione ? 'Ricevuta Fiscale' : 'Contanti');
      const paziente = estraiNomeDonatore(s).replace(/"/g, '""');
      const codice = (s.codice || '').replace(/"/g, '""');
      const cfPiva = estraiCfPivaDonatore(s).replace(/"/g, '""');
      const ricevuta = (s.ricevutaDonazione || 'Art. 82 D.Lgs 117/2017').replace(/"/g, '""');
      const volontario = (s.volontarioNome || 'Equipaggio').replace(/"/g, '""');
      const note = (s.noteDonazione || s.destinazione || s.indirizzoIntervento || s.luogoIntervento || s.note || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');

      return `"${s.dataDonazione || s.data || ''}";"${codice}";"${imp.toFixed(2)}";"${metodo}";"${paziente}";"${cfPiva}";"${ricevuta}";"${volontario}";"${note}"`;
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...righe].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donazioni_croce_oro_${formatISODateItaly()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostraAvviso(`Esportate ${serviziConDonazioni.length} donazioni in formato CSV per la Tesoreria!`);
    onNotificaRadio?.(`📥 TESORERIA: Esportato report CSV donazioni (${serviziConDonazioni.length} record)`, 'sistema');
  };

  // Registrazione nuova donazione con validazione soglie e collegamento opzionale a servizio in archivio
  const handleRegistraNuovaDonazione = (e: React.FormEvent) => {
    e.preventDefault();
    if (erroreImportoDonazione || isNaN(importoNumerico) || importoNumerico <= 0 || importoNumerico > 10000) {
      mostraAvviso('Importo non valido: controlla i parametri di inserimento.');
      return;
    }

    const annoCorr = getCurrentYearItaly();
    const numRicevuta = formDonazioneRicevuta.trim() || `DON-${annoCorr}/${String(serviziConDonazioni.length + 1).padStart(3, '0')}`;
    const donatoreNome = formDonazionePaziente.trim() || 'Donatore Anonimo';
    const dataDonazione = formDonazioneData || formatISODateItaly();
    const noteDonazione = formDonazioneNote.trim() || 'Erogazione liberale a sostegno delle attività istituzionali';
    const codiceFinale = formDonazioneCodice.trim() || `MIS-${annoCorr}-${String(Date.now()).slice(-4)}`;

    const servizioArchivioCollegato = formDonazioneServizioCollegatoId
      ? (serviziArchivio || []).find((s) => (s.id || s.codice) === formDonazioneServizioCollegatoId)
      : null;

    if (servizioArchivioCollegato && onAggiornaServizioArchivio) {
      const metodoBreve: string =
        formDonazioneMetodo === 'POS / Carta'
          ? 'pos'
          : formDonazioneMetodo === 'Contanti'
            ? 'contanti'
            : formDonazioneMetodo;
      const baseDatiDest = servizioArchivioCollegato.datiDestinazione || {
        proprietario: {
          nome: '',
          cognome: '',
          indirizzo: '',
          cap: '',
          comune: '',
          provincia: '',
          telefono: '',
          email: ''
        },
        firmaProprietario: null,
        strutturaVeterinaria: {
          isVeterinario: false,
          nomeStrutturaOVeterinario: '',
          firmaVeterinario: null
        }
      };

      const cfPivaPulito = formDonazioneCfPiva.trim().toUpperCase();
      const prevDonDest = baseDatiDest.donazione || {};
      const servizioAggiornato = {
        ...servizioArchivioCollegato,
        donazioneLibera: importoNumerico.toFixed(2),
        importoDonazione: importoNumerico.toFixed(2),
        metodoDonazione: formDonazioneMetodo,
        metodoPagamento: formDonazioneMetodo,
        ricevutaDonazione: numRicevuta,
        donatore: donatoreNome,
        codiceFiscaleDonatore: cfPivaPulito || undefined,
        partitaIvaCodiceFiscale: cfPivaPulito || servizioArchivioCollegato.partitaIvaCodiceFiscale || undefined,
        paziente: servizioArchivioCollegato.paziente || donatoreNome,
        noteDonazione,
        dataDonazione,
        donazione: {
          importo: importoNumerico,
          somma: importoNumerico,
          modalita: formDonazioneMetodo,
          codiceFiscale: cfPivaPulito || undefined,
          note: noteDonazione,
          ricevente: operatoreCorrente
        },
        datiDestinazione: {
          ...baseDatiDest,
          proprietario: {
            ...(baseDatiDest.proprietario || {}),
            ...(cfPivaPulito && prevDonDest.tipoDonatore !== 'altro' ? { codiceFiscale: cfPivaPulito } : {})
          },
          donazione: {
            ...prevDonDest,
            ricevuta: true,
            somma: importoNumerico,
            metodo: metodoBreve,
            ...(prevDonDest.tipoDonatore === 'altro' && cfPivaPulito
              ? {
                  donatoreAltro: {
                    ...(prevDonDest.donatoreAltro || {}),
                    codiceFiscale: cfPivaPulito
                  }
                }
              : {})
          }
        }
      };

      onAggiornaServizioArchivio(servizioAggiornato);

      // Rimuove eventuali record duplicati in donazioniExtra riferiti allo stesso servizio
      const chiaveColl = String(servizioArchivioCollegato.id || servizioArchivioCollegato.codice);
      const extraRipulite = donazioniExtra.filter(
        (d) => String(d.servizioCollegatoId || '') !== chiaveColl && String(d.codice || '') !== String(servizioArchivioCollegato.codice || '')
      );
      if (extraRipulite.length !== donazioniExtra.length) {
        setDonazioniExtra(extraRipulite);
        try {
          localStorage.setItem('croceoro_donazioni_extra_v1', JSON.stringify(extraRipulite));
        } catch {}
      }

      setModaleNuovaDonazioneAperta(false);
      mostraAvviso(
        `Donazione di € ${importoNumerico.toFixed(2)} registrata e collegata al servizio ${servizioArchivioCollegato.codice || chiaveColl} (Ricevuta: ${numRicevuta}).`
      );
      onNotificaRadio?.(
        `💖 CONTABILITÀ: Donazione di € ${importoNumerico.toFixed(2)} (${formDonazioneMetodo}) collegata al servizio ${servizioArchivioCollegato.codice || codiceFinale}`,
        'sistema'
      );
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'contabilita',
          'Donazione collegata a servizio in archivio',
          `Registrata donazione di € ${importoNumerico.toFixed(2)} (${formDonazioneMetodo}) collegata al servizio ${servizioArchivioCollegato.codice || codiceFinale}`,
          operatoreCorrente
        );
      }
      return;
    }

    const cfPivaPulito = formDonazioneCfPiva.trim().toUpperCase();
    const nuovaDonazione = {
      id: `don-${Date.now()}`,
      servizioCollegatoId: servizioArchivioCollegato ? (servizioArchivioCollegato.id || servizioArchivioCollegato.codice) : undefined,
      servizioCollegato: Boolean(servizioArchivioCollegato),
      codice: codiceFinale,
      data: dataDonazione,
      dataDonazione,
      paziente: donatoreNome,
      donatore: donatoreNome,
      codiceFiscaleDonatore: cfPivaPulito || undefined,
      partitaIvaCodiceFiscale: cfPivaPulito || undefined,
      donazioneLibera: importoNumerico.toFixed(2),
      importoDonazione: importoNumerico.toFixed(2),
      metodoDonazione: formDonazioneMetodo,
      metodoPagamento: formDonazioneMetodo,
      ricevutaDonazione: numRicevuta,
      mezzo: servizioArchivioCollegato?.mezzo || 'N/D',
      indirizzoIntervento: servizioArchivioCollegato?.indirizzoIntervento,
      destinazione: servizioArchivioCollegato
        ? [servizioArchivioCollegato.indirizzoIntervento, servizioArchivioCollegato.destinazione].filter(Boolean).join(' -> ') || noteDonazione
        : noteDonazione,
      noteDonazione,
      volontarioNome: servizioArchivioCollegato?.volontarioNome || operatoreCorrente,
      tipoServizio: servizioArchivioCollegato?.tipoServizio || servizioArchivioCollegato?.ambito || 'Donazione Volontaria'
    };

    const aggiornate = [nuovaDonazione, ...donazioniExtra];
    setDonazioniExtra(aggiornate);
    try {
      localStorage.setItem('croceoro_donazioni_extra_v1', JSON.stringify(aggiornate));
    } catch {}

    setModaleNuovaDonazioneAperta(false);
    mostraAvviso(`Donazione di € ${importoNumerico.toFixed(2)} registrata con successo (Ricevuta: ${nuovaDonazione.ricevutaDonazione}).`);
    onNotificaRadio?.(`💖 CONTABILITÀ: Registrata donazione di € ${importoNumerico.toFixed(2)} (${nuovaDonazione.metodoDonazione}) per ${nuovaDonazione.codice}`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nuova donazione registrata',
        `Registrata donazione di € ${importoNumerico.toFixed(2)} (${nuovaDonazione.metodoDonazione}) - Rif. ${nuovaDonazione.codice}`,
        operatoreCorrente
      );
    }
  };

  // =========================================================================
  // 2. GESTIONE TESSERAMENTO
  // =========================================================================
  const salvaBozzaTesseraInArchivio = (nuova: TesseraAssociativa) => {
    if (tessere.some((t) => t.id === nuova.id)) return;
    onAggiornaTessere([nuova, ...tessere]);
    onNotificaRadio?.(`💳 TESSERAMENTO: Emessa nuova tessera ${nuova.numeroTessera} per ${nuova.socioNome} ${nuova.socioCognome}`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nuova tessera socio emessa',
        `Emessa tessera socio ${nuova.numeroTessera} per ${nuova.socioNome} ${nuova.socioCognome} (quota: € ${nuova.quotaVersata})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Nuova tessera ${nuova.numeroTessera} salvata in archivio per ${nuova.socioNome} ${nuova.socioCognome}.`);
  };

  const handleEmettiTessera = (e: React.FormEvent) => {
    e.preventDefault();
    const annoCorr = getCurrentYearItaly();
    const nuova: TesseraAssociativa = {
      id: `tess-${Date.now()}`,
      numeroTessera: formTessNumero.trim() || `TO-${annoCorr}/${String(tessere.length + 1).padStart(3, '0')}`,
      annoSociale: annoCorr,
      socioNome: formTessNome.trim(),
      socioCognome: formTessCognome.trim(),
      socioCodiceFiscale: formTessCF.trim().toUpperCase(),
      qualifica: formTessQualifica,
      quotaVersata: Number(formTessQuota),
      dataEmissione: formatISODateItaly(),
      dataScadenza: `${annoCorr}-12-31`,
      stato: 'Attiva',
      ricevutaNumero: `${String(tessere.length + 1).padStart(2, '0')}/${annoCorr}`,
      timbroCartaceo: true
    };

    setModaleNuovaTesseraAperta(false);
    setBozzaPdfWorkflow({ tipo: 'tessera', data: nuova, salvato: false });
  };

  const handleRinnovaTessera = (tess: TesseraAssociativa) => {
    const aggiornate = tessere.map((t) => {
      if (t.id === tess.id) {
        return {
          ...t,
          stato: 'Rinnovata' as const,
          dataScadenza: '2026-12-31',
          timbroCartaceo: true
        };
      }
      return t;
    });

    onAggiornaTessere(aggiornate);
    onNotificaRadio?.(`💳 TESSERAMENTO: Rinnovata tessera ${tess.numeroTessera} per ${tess.socioNome} ${tess.socioCognome}`, 'sistema');
    mostraAvviso(`Tessera ${tess.numeroTessera} rinnovata per l'anno sociale 2026.`);
  };

  const handleConfermaAnnullaTessera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tesseraDaAnnullare) return;

    const aggiornate = tessere.map((t) => {
      if (t.id === tesseraDaAnnullare.id) {
        return {
          ...t,
          stato: 'Annullata' as const,
          motivoAnnullamento: motivoAnnullamentoTessera
        };
      }
      return t;
    });

    onAggiornaTessere(aggiornate);
    onNotificaRadio?.(`⚠️ TESSERAMENTO: Annullata tessera ${tesseraDaAnnullare.numeroTessera} (${motivoAnnullamentoTessera})`, 'sistema');
    mostraAvviso(`Tessera ${tesseraDaAnnullare.numeroTessera} annullata.`);
    setTesseraDaAnnullare(null);
  };

  // =========================================================================
  // 3. GESTIONE NOTE DI DEBITO + CALCOLI SERVIZIO & SCONTISTICHE
  // =========================================================================
  const calcolaOreServizio = (servizio: any): number => {
    const startStr = (servizio?.tempi?.partenza || servizio?.oraInizioServizioSpecifico || '').trim();
    const endStr = (servizio?.tempi?.rientro || servizio?.tempi?.fineMissione || '').trim();
    const parseMins = (t: string): number | null => {
      const m = /^(\d{1,2}):(\d{2})/.exec(t);
      if (!m) return null;
      return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    };
    const sMin = parseMins(startStr);
    const eMin = parseMins(endStr);
    if (sMin !== null && eMin !== null) {
      let diff = eMin - sMin;
      if (diff < 0) diff += 24 * 60;
      return Math.round((diff / 60) * 100) / 100;
    }
    return 1;
  };

  const calcoliNotaCorrente = React.useMemo(() => {
    const round2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
    const hasVoci = formVociDettaglio.length > 0;
    const imponibileLordo = hasVoci
      ? round2(formVociDettaglio.reduce((acc, v) => acc + (Number(v.totaleRiga) || 0), 0))
      : round2(Number(formNotaImporto) || 0);
    const scontoVal = Math.max(0, Number(formScontoValore) || 0);
    let scontoCalcolato = 0;
    if (formScontoTipo === 'percentuale') {
      scontoCalcolato = round2((imponibileLordo * Math.min(100, scontoVal)) / 100);
    } else if (formScontoTipo === 'fisso') {
      scontoCalcolato = round2(Math.min(imponibileLordo, scontoVal));
    }
    const totaleNetto = Math.max(0, round2(imponibileLordo - scontoCalcolato));
    return {
      hasVoci,
      imponibileLordo,
      scontoCalcolato,
      totaleNetto
    };
  }, [formVociDettaglio, formNotaImporto, formScontoTipo, formScontoValore]);

  const handleSelezionaServizioPerNota = (servizioId: string) => {
    setFormServizioCollegatoId(servizioId);
    if (!servizioId) {
      setFormKmPercorsiServizio(0);
      setFormOreImpiegoServizio(0);
      return;
    }
    const srv = serviziArchivio.find((s) => (s.id || s.codice) === servizioId);
    if (!srv) return;

    const kmSrv = srv.kmTotali != null
      ? Number(srv.kmTotali)
      : (srv.kmFine != null && srv.kmInizio != null ? Math.max(0, Number(srv.kmFine) - Number(srv.kmInizio)) : 0);
    const oreSrv = calcolaOreServizio(srv);

    setFormNotaRiferimento(srv.codice || servizioId);
    setFormKmPercorsiServizio(isNaN(kmSrv) ? 0 : kmSrv);
    setFormOreImpiegoServizio(isNaN(oreSrv) ? 0 : oreSrv);

    const descServ = [
      srv.tipoServizio || 'Servizio Operativo',
      srv.codice ? `Rif. ${srv.codice}` : '',
      srv.data ? `del ${srv.data}` : '',
      srv.mezzo ? `Mezzo ${srv.mezzo}` : '',
      srv.indirizzoIntervento ? `(${srv.indirizzoIntervento})` : ''
    ].filter(Boolean).join(' ');
    setFormNotaCausale(descServ);

    if (srv.proprietarioImmobile && (srv.proprietarioImmobile.nomeCognome || srv.proprietarioImmobile.codiceFiscale || srv.proprietarioImmobile.indirizzoResidenza)) {
      setFormProprietarioImmobile({
        nomeCognome: srv.proprietarioImmobile.nomeCognome || '',
        codiceFiscale: srv.proprietarioImmobile.codiceFiscale || '',
        indirizzoResidenza: srv.proprietarioImmobile.indirizzoResidenza || ''
      });
      setMostraSezioneProprietario(true);
      if (srv.proprietarioImmobile.nomeCognome) setFormNotaDebitore(srv.proprietarioImmobile.nomeCognome);
      if (srv.proprietarioImmobile.codiceFiscale) setFormNotaPiva(srv.proprietarioImmobile.codiceFiscale);
      if (srv.proprietarioImmobile.indirizzoResidenza) setFormNotaIndirizzo(srv.proprietarioImmobile.indirizzoResidenza);
    }
  };

  const handleAggiungiTariffaANota = (t: TariffaCostoServizio) => {
    const cat = t.categoria || t.tipoVoce;
    const qta = cat === 'mezzo_km'
      ? (formKmPercorsiServizio > 0 ? formKmPercorsiServizio : 1)
      : cat === 'operatore'
      ? (formOreImpiegoServizio > 0 ? formOreImpiegoServizio : 1)
      : 1;
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const tot = round2(qta * t.importoUnitario);
    const nuovaVoce: VoceNotaDiDebito = {
      id: `voce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      siglaBreve: t.siglaBreve,
      descrizioneSigla: t.descrizioneSigla,
      descrizioneVoce: t.nomeVoce,
      descrizione: t.nomeVoce,
      quantita: qta,
      unitaMisura: t.unitaMisura,
      prezzoUnitario: t.importoUnitario,
      subtotale: tot,
      totaleRiga: tot,
      editabile: true,
      modificabile: true,
      tariffaId: t.id
    };
    setFormVociDettaglio((prev) => [...prev, nuovaVoce]);
  };

  const handleAggiungiVoceEditabileNota = () => {
    const nuovaVoce: VoceNotaDiDebito = {
      id: `voce-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      siglaBreve: 'EXTRA',
      descrizioneSigla: 'Voce personalizzata editabile',
      descrizioneVoce: 'Descrizione prestazione o rimborso spese',
      descrizione: 'Descrizione prestazione o rimborso spese',
      quantita: 1,
      unitaMisura: 'servizio',
      prezzoUnitario: 0,
      subtotale: 0,
      totaleRiga: 0,
      editabile: true,
      modificabile: true,
      completamenteEditabile: true
    };
    setFormVociDettaglio((prev) => [...prev, nuovaVoce]);
  };

  const handleAggiornaVoceNota = (id: string, patch: Partial<VoceNotaDiDebito>) => {
    setFormVociDettaglio((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const merged = { ...v, ...patch };
        if (patch.descrizioneVoce !== undefined) merged.descrizione = patch.descrizioneVoce;
        const qta = Number(merged.quantita) || 0;
        const pu = Number(merged.prezzoUnitario) || 0;
        const tot = Math.round(qta * pu * 100) / 100;
        merged.totaleRiga = tot;
        merged.subtotale = tot;
        return merged;
      })
    );
  };

  const handleSalvaTariffaCosto = (e: React.FormEvent) => {
    e.preventDefault();
    const imp = parseFloat((formTariffaImporto || '0').replace(',', '.'));
    if (!formTariffaSigla.trim() || !formTariffaDescrizioneSigla.trim() || !formTariffaNome.trim() || isNaN(imp) || imp < 0) {
      mostraAvviso('Compila sigla breve, descrizione sigla, nome voce ed un importo valido (>= 0).');
      return;
    }

    if (editingTariffaId) {
      const aggiornate = tariffeCostiServizio.map((t) =>
        t.id === editingTariffaId
          ? {
              ...t,
              tipoVoce: formTariffaCategoria,
              categoria: formTariffaCategoria,
              siglaBreve: formTariffaSigla.trim().toUpperCase(),
              descrizioneSigla: formTariffaDescrizioneSigla.trim(),
              nomeVoce: formTariffaNome.trim(),
              importoUnitario: Math.round(imp * 100) / 100,
              unitaMisura: formTariffaUnita.trim() || 'cad',
              note: formTariffaNote.trim() || undefined
            }
          : t
      );
      salvaTariffeCostiServizio(aggiornate);
      mostraAvviso(`Voce tariffaria ${formTariffaSigla.trim().toUpperCase()} aggiornata.`);
    } else {
      const nuova: TariffaCostoServizio = {
        id: `tar-${Date.now()}`,
        tipoVoce: formTariffaCategoria,
        categoria: formTariffaCategoria,
        siglaBreve: formTariffaSigla.trim().toUpperCase(),
        descrizioneSigla: formTariffaDescrizioneSigla.trim(),
        nomeVoce: formTariffaNome.trim(),
        importoUnitario: Math.round(imp * 100) / 100,
        unitaMisura: formTariffaUnita.trim() || 'cad',
        attivo: true,
        attiva: true,
        note: formTariffaNote.trim() || undefined
      };
      salvaTariffeCostiServizio([...tariffeCostiServizio, nuova]);
      mostraAvviso(`Nuova voce tariffaria ${nuova.siglaBreve} aggiunta in Costi di Servizio.`);
    }

    setEditingTariffaId(null);
    setFormTariffaSigla('');
    setFormTariffaDescrizioneSigla('');
    setFormTariffaNome('');
    setFormTariffaImporto('0');
    const defCat = categorieCostiServizio.find((c) => c.id === formTariffaCategoria) || categorieCostiServizio[0];
    setFormTariffaUnita(defCat?.unitaDefault || 'servizio');
    setFormTariffaNote('');
  };

  const handleCreaCategoriaCosto = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = nuovaCatCostoNome.trim();
    if (!nome) {
      mostraAvviso('Inserisci il nome della nuova categoria di costo.');
      return;
    }
    if (categorieCostiServizio.some((c) => c.nome.trim().toLowerCase() === nome.toLowerCase())) {
      mostraAvviso(`Esiste già una categoria di costo chiamata "${nome}".`);
      return;
    }
    const slug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28);
    const id = slug && !categorieCostiServizio.some((c) => c.id === slug) ? slug : `cat_costo_${Date.now()}`;
    const nuova: CategoriaCostoServizio = {
      id,
      nome,
      unitaDefault: nuovaCatCostoUnita.trim() || 'servizio',
      descrizione: nuovaCatCostoDesc.trim() || undefined,
      predefinita: false
    };
    const aggiornate = salvaCategorieCostiServizio([...categorieCostiServizio, nuova]);
    realtime.send('UPDATE_CATEGORIE_COSTI_SERVIZIO', { categorie: aggiornate, updatedAt: Date.now() });
    setNuovaCatCostoNome('');
    setNuovaCatCostoUnita('servizio');
    setNuovaCatCostoDesc('');
    setFormTariffaCategoria(nuova.id);
    if (!editingTariffaId) {
      setFormTariffaUnita(nuova.unitaDefault || 'servizio');
    }
    mostraAvviso(`Categoria di costo "${nome}" creata e salvata.`);
  };

  const handleSalvaModificaCategoriaCosto = (catId: string) => {
    const nome = editingCatCostoNome.trim();
    if (!nome) {
      mostraAvviso('Il nome della categoria di costo non può essere vuoto.');
      return;
    }
    if (categorieCostiServizio.some((c) => c.id !== catId && c.nome.trim().toLowerCase() === nome.toLowerCase())) {
      mostraAvviso(`Esiste già un'altra categoria di costo chiamata "${nome}".`);
      return;
    }
    const aggiornate = salvaCategorieCostiServizio(
      categorieCostiServizio.map((c) =>
        c.id === catId
          ? {
              ...c,
              nome,
              unitaDefault: editingCatCostoUnita.trim() || c.unitaDefault || 'servizio',
              descrizione: editingCatCostoDesc.trim() || undefined
            }
          : c
      )
    );
    realtime.send('UPDATE_CATEGORIE_COSTI_SERVIZIO', { categorie: aggiornate, updatedAt: Date.now() });
    setEditingCatCostoId(null);
    setEditingCatCostoNome('');
    setEditingCatCostoUnita('');
    setEditingCatCostoDesc('');
    mostraAvviso(`Categoria di costo aggiornata in "${nome}".`);
  };

  const handleEliminaCategoriaCosto = (catId: string) => {
    if (categorieCostiServizio.length <= 1) {
      mostraAvviso('Deve rimanere almeno una categoria di costo attiva nel tariffario.');
      setConfermaEliminaCatCostoId(null);
      return;
    }
    const target = categorieCostiServizio.find((c) => c.id === catId);
    const rimanenti = categorieCostiServizio.filter((c) => c.id !== catId);
    const fallbackCat = rimanenti[0];

    const aggiornateCat = salvaCategorieCostiServizio(rimanenti);
    realtime.send('UPDATE_CATEGORIE_COSTI_SERVIZIO', { categorie: aggiornateCat, updatedAt: Date.now() });

    // Riassegna in modo sicuro eventuali voci tariffarie che usavano la categoria eliminata
    const vociDaSpostare = tariffeCostiServizio.filter((t) => (t.categoria || t.tipoVoce) === catId);
    if (vociDaSpostare.length > 0 && fallbackCat) {
      salvaTariffeCostiServizio(
        tariffeCostiServizio.map((t) =>
          (t.categoria || t.tipoVoce) === catId
            ? { ...t, categoria: fallbackCat.id, tipoVoce: fallbackCat.id }
            : t
        )
      );
    }

    if (filtroCategoriaTariffa === catId) {
      setFiltroCategoriaTariffa('tutti');
    }
    if (formTariffaCategoria === catId && fallbackCat) {
      setFormTariffaCategoria(fallbackCat.id);
    }
    if (editingCatCostoId === catId) {
      setEditingCatCostoId(null);
    }
    setConfermaEliminaCatCostoId(null);
    mostraAvviso(
      vociDaSpostare.length > 0 && fallbackCat
        ? `Categoria "${target?.nome || catId}" eliminata. ${vociDaSpostare.length} voci spostate in "${fallbackCat.nome}".`
        : `Categoria di costo "${target?.nome || catId}" eliminata.`
    );
  };

  const handleEmettiNotaDiDebito = (e: React.FormEvent) => {
    e.preventDefault();
    const emailPulita = formNotaEmail.trim();
    const pecPulita = formNotaPec.trim();
    if (!formNotaEmailNonDisponibile && (!emailPulita || !emailPulita.includes('@'))) {
      mostraAvviso('Inserisci un indirizzo Email valido oppure spunta la casella "Non in possesso dell\'indirizzo Email".');
      return;
    }
    if (!formNotaPecNonDisponibile && (!pecPulita || !pecPulita.includes('@'))) {
      mostraAvviso('Inserisci un indirizzo PEC valido oppure spunta la casella "Non in possesso dell\'indirizzo PEC".');
      return;
    }

    const metodoCustomSel = metodiPerPagamenti.find((m) => formattaEtichettaMetodoPagamento(m) === formNotaMetodo);
    const isPoste = !metodoCustomSel && (formNotaMetodo.includes('Poste') || formNotaMetodo.includes('00001007035676') || formNotaMetodo.includes('C/C Postale'));
    const isCredit = !metodoCustomSel && (formNotaMetodo.includes('Credit Agricole') || formNotaMetodo.includes('Agricole') || (!isPoste && formNotaMetodo.includes('Bonifico')));

    const contoAccredito = metodoCustomSel
      ? metodoCustomSel.nome
      : isPoste
        ? 'Poste Italiane'
        : isCredit
          ? 'Credit Agricole'
          : 'Altro';
    const ibanAccredito = metodoCustomSel?.coordinateODettagli || (isPoste ? ibanPoste : isCredit ? ibanCreditAgricole : undefined);
    const ccPostaleAccredito = isPoste ? ccPostale : undefined;

    const haPropImmobile = Boolean(
      formProprietarioImmobile.nomeCognome.trim() ||
      formProprietarioImmobile.codiceFiscale.trim() ||
      formProprietarioImmobile.indirizzoResidenza.trim()
    );

    const nuovaNota: NotaDiDebito = {
      id: `nd-${Date.now()}`,
      numeroProgressivo: `ND-${getCurrentYearItaly()}/${String(noteDiDebito.length + 1).padStart(3, '0')}`,
      dataEmissione: formatISODateItaly(),
      debitoreIntestatario: formNotaDebitore.trim(),
      partitaIvaCodiceFiscale: formNotaPiva.trim(),
      indirizzoDebitore: formNotaIndirizzo.trim(),
      emailDestinatario: formNotaEmailNonDisponibile ? undefined : emailPulita,
      emailNonDisponibile: formNotaEmailNonDisponibile,
      pecDestinatario: formNotaPecNonDisponibile ? undefined : pecPulita,
      pecNonDisponibile: formNotaPecNonDisponibile,
      causale: formNotaCausale.trim(),
      codiceServizioRiferimento: formNotaRiferimento.trim() || undefined,
      servizioCollegatoId: formServizioCollegatoId || undefined,
      kmPercorsiServizio: formServizioCollegatoId || formKmPercorsiServizio > 0 ? Number(formKmPercorsiServizio) : undefined,
      oreImpiegoServizio: formServizioCollegatoId || formOreImpiegoServizio > 0 ? Number(formOreImpiegoServizio) : undefined,
      proprietarioImmobile: haPropImmobile
        ? {
            nomeCognome: formProprietarioImmobile.nomeCognome.trim(),
            codiceFiscale: formProprietarioImmobile.codiceFiscale.trim().toUpperCase(),
            indirizzoResidenza: formProprietarioImmobile.indirizzoResidenza.trim()
          }
        : undefined,
      vociDettaglio: formVociDettaglio.length > 0 ? formVociDettaglio : undefined,
      imponibileLordo: calcoliNotaCorrente.imponibileLordo,
      scontoTipo: formScontoTipo !== 'nessuno' ? formScontoTipo : undefined,
      scontoValore: formScontoTipo !== 'nessuno' ? Number(formScontoValore) || 0 : undefined,
      scontoDescrizione: formScontoTipo !== 'nessuno' ? (formScontoDescrizione.trim() || 'Scontistica applicata') : undefined,
      scontoImportoCalcolato: calcoliNotaCorrente.scontoCalcolato > 0 ? calcoliNotaCorrente.scontoCalcolato : undefined,
      importoTotale: calcoliNotaCorrente.totaleNetto,
      scadenzaPagamento: formNotaScadenza,
      metodoPagamento: formNotaMetodo,
      contoAccredito,
      ibanAccredito,
      ccPostaleAccredito,
      stato: 'Emessa',
      operatoreEmissione: operatoreCorrente
    };

    setModaleNuovaNotaAperta(false);
    setBozzaPdfWorkflow({ tipo: 'nota', data: nuovaNota, salvato: false });
  };

  const salvaBozzaNotaInArchivio = (nuovaNota: NotaDiDebito) => {
    if (noteDiDebito.some((n) => n.id === nuovaNota.id)) return;
    onAggiornaNoteDiDebito([nuovaNota, ...noteDiDebito]);
    onNotificaRadio?.(`📑 NOTA DI DEBITO: Emessa nuova nota ${nuovaNota.numeroProgressivo} di € ${nuovaNota.importoTotale.toFixed(2)} a ${nuovaNota.debitoreIntestatario}`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nuova nota di debito emessa',
        `Emessa nota di debito ${nuovaNota.numeroProgressivo} a ${nuovaNota.debitoreIntestatario} (€ ${nuovaNota.importoTotale.toFixed(2)} - causale: ${nuovaNota.causale})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Nota di Debito ${nuovaNota.numeroProgressivo} salvata in archivio con successo.`);
  };

  // Emissione, Annullamento e Rimozione Ricevute Contabili (Sotto-sezione 9)
  const apriModaleNuovaRicevuta = () => {
    setFormRicTipologia('Erogazione Liberale / Donazione');
    setFormRicData(formatISODateItaly());
    setFormRicIntestatario('');
    setFormRicCfPiva('');
    setFormRicIndirizzo('');
    setFormRicEmail('');
    setFormRicEmailNonDisponibile(false);
    setFormRicPec('');
    setFormRicPecNonDisponibile(false);
    setFormRicCausale('');
    setFormRicRiferimento('');
    setFormRicImporto('');
    setFormRicMetodo('Contanti');
    setFormRicNote('');
    setModaleNuovaRicevutaAperta(true);
  };

  const handleEmettiRicevutaContabile = (e: React.FormEvent) => {
    e.preventDefault();
    const intestatario = formRicIntestatario.trim();
    const causale = formRicCausale.trim();
    const importoNum = parseFloat((formRicImporto || '').replace(',', '.'));
    const emailPulita = formRicEmail.trim();
    const pecPulita = formRicPec.trim();

    if (!intestatario) {
      mostraAvviso('Inserisci il nominativo o la ragione sociale dell\'intestatario della ricevuta.');
      return;
    }
    if (!causale) {
      mostraAvviso('Inserisci la causale della ricevuta.');
      return;
    }
    if (isNaN(importoNum) || importoNum <= 0) {
      mostraAvviso('Inserisci un importo valido superiore a € 0,00.');
      return;
    }
    if (!formRicEmailNonDisponibile && (!emailPulita || !emailPulita.includes('@'))) {
      mostraAvviso('Inserisci un indirizzo Email valido oppure spunta la casella "Non in possesso dell\'indirizzo Email".');
      return;
    }
    if (!formRicPecNonDisponibile && (!pecPulita || !pecPulita.includes('@'))) {
      mostraAvviso('Inserisci un indirizzo PEC valido oppure spunta la casella "Non in possesso dell\'indirizzo PEC".');
      return;
    }

    const annoCorrente = getCurrentYearItaly();
    const maxProg = listaRicevute.reduce((acc, r) => {
      const m = (r.numeroProgressivo || '').match(new RegExp(`RIC-${annoCorrente}/(\\d+)`));
      const num = m ? parseInt(m[1], 10) : 0;
      return num > acc ? num : acc;
    }, 0);
    const numeroProgressivo = `RIC-${annoCorrente}/${String(maxProg + 1).padStart(3, '0')}`;

    const metodoCustomSel = metodiPerPagamenti.find((m) => formattaEtichettaMetodoPagamento(m) === formRicMetodo);
    const isPoste = !metodoCustomSel && (formRicMetodo.includes('Poste') || formRicMetodo.includes('00001007035676') || formRicMetodo.includes('C/C Postale'));
    const isCredit = !metodoCustomSel && (formRicMetodo.includes('Credit Agricole') || formRicMetodo.includes('Agricole') || (!isPoste && formRicMetodo.includes('Bonifico')));

    const contoAccredito = metodoCustomSel
      ? metodoCustomSel.nome
      : isPoste
        ? 'Poste Italiane'
        : isCredit
          ? 'Credit Agricole'
          : formRicMetodo;
    const ibanAccredito = metodoCustomSel?.coordinateODettagli || (isPoste ? ibanPoste : isCredit ? ibanCreditAgricole : undefined);
    const ccPostaleAccredito = isPoste ? ccPostale : undefined;

    const nuovaRicevuta: RicevutaContabile = {
      id: `ric-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      numeroProgressivo,
      dataEmissione: formRicData || formatISODateItaly(),
      tipologia: formRicTipologia,
      intestatario,
      codiceFiscalePartitaIva: formRicCfPiva.trim().toUpperCase(),
      indirizzoIntestatario: formRicIndirizzo.trim(),
      emailDestinatario: formRicEmailNonDisponibile ? undefined : emailPulita,
      emailNonDisponibile: formRicEmailNonDisponibile,
      pecDestinatario: formRicPecNonDisponibile ? undefined : pecPulita,
      pecNonDisponibile: formRicPecNonDisponibile,
      causale,
      codiceServizioRiferimento: formRicRiferimento.trim() || undefined,
      importoTotale: Math.round(importoNum * 100) / 100,
      metodoPagamento: formRicMetodo,
      contoAccredito,
      ibanAccredito,
      ccPostaleAccredito,
      stato: 'Emessa',
      operatoreEmissione: operatoreCorrente,
      note: formRicNote.trim() || undefined,
      createdAt: Date.now()
    };

    setModaleNuovaRicevutaAperta(false);
    setBozzaPdfWorkflow({ tipo: 'ricevuta', data: nuovaRicevuta, salvato: false });
  };

  const salvaBozzaRicevutaInArchivio = (nuovaRicevuta: RicevutaContabile) => {
    if (listaRicevute.some((r) => r.id === nuovaRicevuta.id)) return;
    salvaRicevuteContabilita([nuovaRicevuta, ...listaRicevute]);
    onNotificaRadio?.(
      `🧾 RICEVUTA CONTABILE: Emessa ricevuta ${nuovaRicevuta.numeroProgressivo} di € ${nuovaRicevuta.importoTotale.toFixed(2)} a ${nuovaRicevuta.intestatario}`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nuova ricevuta emessa',
        `Emessa ricevuta ${nuovaRicevuta.numeroProgressivo} (${nuovaRicevuta.tipologia}) a ${nuovaRicevuta.intestatario} per € ${nuovaRicevuta.importoTotale.toFixed(2)}`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Ricevuta ${nuovaRicevuta.numeroProgressivo} salvata in archivio con successo.`);
  };

  const handleConfermaAnnullaRicevuta = () => {
    if (!ricevutaDaAnnullare) return;
    const aggiornate = listaRicevute.map((r) =>
      r.id === ricevutaDaAnnullare.id
        ? {
            ...r,
            stato: 'Annullata' as const,
            motivoAnnullamento: motivoAnnullamentoRicevuta.trim() || 'Annullata manualmente'
          }
        : r
    );
    salvaRicevuteContabilita(aggiornate);
    onNotificaRadio?.(
      `🚫 RICEVUTA ANNULLATA: Annullata ricevuta ${ricevutaDaAnnullare.numeroProgressivo} (${ricevutaDaAnnullare.intestatario})`,
      'sistema'
    );
    mostraAvviso(`Ricevuta ${ricevutaDaAnnullare.numeroProgressivo} contrassegnata come ANNULLATA.`);
    setRicevutaDaAnnullare(null);
  };

  const handleEliminaRicevuta = (id: string) => {
    const target = listaRicevute.find((r) => r.id === id);
    salvaRicevuteContabilita(listaRicevute.filter((r) => r.id !== id));
    setConfermaEliminaRicevutaId(null);
    if (target) {
      mostraAvviso(`Ricevuta ${target.numeroProgressivo} rimossa dall'archivio.`);
    }
  };

  const handleSegnaSaldata = (nota: NotaDiDebito) => {
    const aggiornate = noteDiDebito.map((n) => {
      if (n.id === nota.id) {
        return {
          ...n,
          stato: 'Saldata' as const,
          dataIncasso: formatISODateItaly()
        };
      }
      return n;
    });

    onAggiornaNoteDiDebito(aggiornate);
    onNotificaRadio?.(`💰 NOTA DI DEBITO INCASSATA: Saldata la nota ${nota.numeroProgressivo} (€ ${nota.importoTotale.toFixed(2)}) da ${nota.debitoreIntestatario}`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nota di debito saldata',
        `Registrato pagamento nota ${nota.numeroProgressivo} da ${nota.debitoreIntestatario} per € ${nota.importoTotale.toFixed(2)}`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Nota di Debito ${nota.numeroProgressivo} registrata come SALDATA / INCASSATA.`);
  };

  const handleSollecitaPagamento = (nota: NotaDiDebito) => {
    const aggiornate = noteDiDebito.map((n) => {
      if (n.id === nota.id) {
        return { ...n, stato: 'Sollecitata' as const };
      }
      return n;
    });
    onAggiornaNoteDiDebito(aggiornate);
    mostraAvviso(`Sollecito di pagamento registrato per ${nota.numeroProgressivo}.`);
  };

  const toggleSelezionaNota = (id: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelezionaTutteNote = (filtroIds: string[]) => {
    if (filtroIds.length > 0 && filtroIds.every(id => selectedNoteIds.includes(id))) {
      setSelectedNoteIds(prev => prev.filter(id => !filtroIds.includes(id)));
    } else {
      setSelectedNoteIds(prev => Array.from(new Set([...prev, ...filtroIds])));
    }
  };

  const toggleSelezionaTessera = (id: string) => {
    setSelectedTessereIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelezionaTutteTessere = (filtroIds: string[]) => {
    if (filtroIds.length > 0 && filtroIds.every((id) => selectedTessereIds.includes(id))) {
      setSelectedTessereIds((prev) => prev.filter((id) => !filtroIds.includes(id)));
    } else {
      setSelectedTessereIds((prev) => Array.from(new Set([...prev, ...filtroIds])));
    }
  };

  const toggleSelezionaRicevuta = (id: string) => {
    setSelectedRicevuteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelezionaTutteRicevute = (filtroIds: string[]) => {
    if (filtroIds.length > 0 && filtroIds.every((id) => selectedRicevuteIds.includes(id))) {
      setSelectedRicevuteIds((prev) => prev.filter((id) => !filtroIds.includes(id)));
    } else {
      setSelectedRicevuteIds((prev) => Array.from(new Set([...prev, ...filtroIds])));
    }
  };

  const handleBatchPdfTessere = async (azione: 'download' | 'print', sorgente: TesseraAssociativa[]) => {
    const scelte = sorgente.filter((t) => selectedTessereIds.includes(t.id));
    if (scelte.length === 0) return;
    setBatchPdfInCorso(true);
    try {
      const tesoriere = getTesoriereAttivo(volontari);
      const items: PdfBatchItem[] = scelte.map((t) => {
        const vol = preparaVolontarioDaTessera(t, volontari);
        const doc = generaRicevutaTesseramentoPDF(vol, undefined, tesoriere);
        const safeNum = (t.numeroTessera || t.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
          nomeFile: `Ricevuta_Tesseramento_${safeNum}.pdf`,
          bytes: generaBytesDaJsPDF(doc)
        };
      });
      await scaricaOStampaMultipliPDF(items, azione, `Tessere_Associative_${formatISODateItaly()}`);
      mostraAvviso(
        azione === 'print'
          ? `Avviata stampa per ${scelte.length} ricevuta/e di tesseramento.`
          : `Scaricati ${scelte.length} PDF di tesseramento.`
      );
    } catch (err: any) {
      console.error('Errore batch PDF tessere:', err);
      mostraAvviso(`Errore nella generazione batch PDF tessere: ${err?.message || 'Errore'}`);
    } finally {
      setBatchPdfInCorso(false);
    }
  };

  const handleBatchPdfNote = async (azione: 'download' | 'print') => {
    const scelte = noteDiDebito.filter((n) => selectedNoteIds.includes(n.id));
    if (scelte.length === 0) return;
    setBatchPdfInCorso(true);
    try {
      const tesoriere = getTesoriereAttivo(volontari);
      const items: PdfBatchItem[] = scelte.map((n) => {
        const doc = generaNotaDiDebitoPDF(n, tesoriere);
        const safeNum = (n.numeroProgressivo || n.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
          nomeFile: `Nota_Di_Debito_${safeNum}.pdf`,
          bytes: generaBytesDaJsPDF(doc)
        };
      });
      await scaricaOStampaMultipliPDF(items, azione, `Note_Di_Debito_${formatISODateItaly()}`);
      mostraAvviso(
        azione === 'print'
          ? `Avviata stampa per ${scelte.length} nota/e di debito.`
          : `Scaricati ${scelte.length} PDF di note di debito.`
      );
    } catch (err: any) {
      console.error('Errore batch PDF note di debito:', err);
      mostraAvviso(`Errore nella generazione batch PDF note di debito: ${err?.message || 'Errore'}`);
    } finally {
      setBatchPdfInCorso(false);
    }
  };

  const handleBatchPdfRicevute = async (azione: 'download' | 'print') => {
    const scelte = listaRicevute.filter((r) => selectedRicevuteIds.includes(r.id));
    if (scelte.length === 0) return;
    setBatchPdfInCorso(true);
    try {
      const tesoriere = getTesoriereAttivo(volontari);
      const items: PdfBatchItem[] = scelte.map((r) => {
        const doc = generaRicevutaContabilePDF(r, tesoriere);
        const safeNum = (r.numeroProgressivo || r.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
          nomeFile: `Ricevuta_${safeNum}.pdf`,
          bytes: generaBytesDaJsPDF(doc)
        };
      });
      await scaricaOStampaMultipliPDF(items, azione, `Ricevute_Contabilita_${formatISODateItaly()}`);
      mostraAvviso(
        azione === 'print'
          ? `Avviata stampa per ${scelte.length} ricevuta/e contabile/i.`
          : `Scaricati ${scelte.length} PDF di ricevute.`
      );
    } catch (err: any) {
      console.error('Errore batch PDF ricevute:', err);
      mostraAvviso(`Errore nella generazione batch PDF ricevute: ${err?.message || 'Errore'}`);
    } finally {
      setBatchPdfInCorso(false);
    }
  };

  const apriEliminaSingolaNota = (nota: NotaDiDebito) => {
    setNoteDaEliminare([nota]);
    setMotivoEliminazioneNota('');
    setModaleConfermaEliminaNoteAperta(true);
  };

  const apriEliminaNoteSelezionate = () => {
    const toDelete = noteDiDebito.filter(n => selectedNoteIds.includes(n.id));
    if (toDelete.length === 0) return;
    setNoteDaEliminare(toDelete);
    setMotivoEliminazioneNota('');
    setModaleConfermaEliminaNoteAperta(true);
  };

  const confermaEliminazioneNote = async () => {
    if (noteDaEliminare.length === 0) return;
    setEliminazioneInCorso(true);
    const deleteIds = new Set(noteDaEliminare.map(n => n.id));
    const rimaste = noteDiDebito.filter(n => !deleteIds.has(n.id));

    // Invio notifica email sia a presidenza@croceoro.org che a tesoreria@croceoro.org
    try {
      await fetch('/api/elimina-note-debito-notifica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteEliminate: noteDaEliminare,
          operatore: operatoreCorrente,
          motivazione: motivoEliminazioneNota.trim() || 'Cancellazione manuale da archivio contabilità'
        })
      });
    } catch (e) {
      console.warn('Errore notifica email cancellazione note debito:', e);
    }

    onAggiornaNoteDiDebito(rimaste);
    setSelectedNoteIds(prev => prev.filter(id => !deleteIds.has(id)));
    onNotificaRadio?.(
      `🗑️ NOTE DI DEBITO: Rimosse ${noteDaEliminare.length} note dall'archivio da parte di ${operatoreCorrente}. Notifica inviata a presidenza@croceoro.org e a tesoreria@croceoro.org`,
      'sistema'
    );
    mostraAvviso(`Rimosse ${noteDaEliminare.length} note di debito. Notifica inviata a presidenza@croceoro.org e a tesoreria@croceoro.org.`);
    setModaleConfermaEliminaNoteAperta(false);
    setNoteDaEliminare([]);
    setEliminazioneInCorso(false);
  };

  const bytesToPdfBase64DataUri = (bytes: Uint8Array): string => {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...slice);
    }
    return `data:application/pdf;base64,${btoa(binary)}`;
  };

  const inviaDocumentoContabileViaEmail = async (
    tipo: 'nota' | 'ricevuta',
    docData: NotaDiDebito | RicevutaContabile,
    pdfBytesOverride?: Uint8Array
  ): Promise<boolean> => {
    const emailOrd = (!docData.emailNonDisponibile ? (docData.emailDestinatario || '') : '').trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailOrd);
    if (!emailValid) {
      mostraAvviso(
        'Impossibile inviare: manca un indirizzo email ordinario (non PEC) valido per il destinatario.'
      );
      return false;
    }

    const tesoriere = getTesoriereAttivo(volontari);
    const ccEmail = (tesoriere.email || 'tesoreria@croceoro.org').trim();
    const tesoriereNomeCompleto = `${tesoriere.nome} ${tesoriere.cognome}`.trim();

    const isNota = tipo === 'nota';
    const nota = isNota ? (docData as NotaDiDebito) : null;
    const ric = !isNota ? (docData as RicevutaContabile) : null;

    const numeroProgressivo = docData.numeroProgressivo || (isNota ? 'ND-2026' : 'RIC-2026');
    const destinatarioNome = isNota
      ? nota!.debitoreIntestatario
      : ric!.intestatario;
    const nomeFile = `${isNota ? 'Nota_Di_Debito' : 'Ricevuta'}_${numeroProgressivo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    const bytes =
      pdfBytesOverride ||
      generaBytesDaJsPDF(
        isNota
          ? generaNotaDiDebitoPDF(nota!, tesoriere)
          : generaRicevutaContabilePDF(ric!, tesoriere)
      );
    const pdfBase64 = bytesToPdfBase64DataUri(bytes);

    setInviandoEmailStampa(true);
    try {
      const res = await fetch('/api/invia-email-documento-contabile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDocumento: isNota ? 'nota_debito' : 'ricevuta',
          numeroProgressivo,
          dataEmissione: docData.dataEmissione,
          destinatarioNome,
          destinatarioEmail: emailOrd,
          tesoriereEmail: ccEmail,
          tesoriereNome: tesoriereNomeCompleto,
          importoTotale: Number(docData.importoTotale || 0),
          causale: docData.causale,
          scadenzaPagamento: isNota ? nota!.scadenzaPagamento : undefined,
          metodoPagamento: docData.metodoPagamento,
          tipologia: !isNota ? ric!.tipologia : undefined,
          pdfBase64,
          nomeFile
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        mostraAvviso(data?.error || 'Errore durante l\'invio dell\'email.');
        return false;
      }

      const etichetta = isNota ? 'Nota di Debito' : 'Ricevuta';
      const ccEffettivo = data.ccTesoriere || ccEmail;

      if (data.speditoViaSmtp) {
        mostraAvviso(
          `${etichetta} ${numeroProgressivo} inviata via email a ${emailOrd} (in copia CC: ${ccEffettivo}) con allegato PDF!`
        );
      } else {
        // Fallback operativo se SMTP non è attivo sul server: scarica il PDF e apre la bozza mailto con CC Tesoriere
        await scaricaBytesPDF(bytes, nomeFile);
        const subject = encodeURIComponent(
          `[${etichetta.toUpperCase()} ${numeroProgressivo}] ${destinatarioNome}`
        );
        const body = encodeURIComponent(
          `Gentile ${destinatarioNome},\n\n` +
          `si trasmette in allegato il documento ufficiale (${etichetta} n. ${numeroProgressivo} del ${docData.dataEmissione}) per l'importo di € ${Number(docData.importoTotale || 0).toFixed(2)}.\n` +
          `Causale: ${docData.causale || '-'}\n\n` +
          `Il file PDF (${nomeFile}) è stato scaricato sul dispositivo per essere allegato alla presente email.\n\n` +
          `Cordiali saluti,\nUfficio Tesoreria (${tesoriereNomeCompleto})`
        );
        const ccPart =
          ccEffettivo && ccEffettivo.toLowerCase() !== emailOrd.toLowerCase()
            ? `cc=${encodeURIComponent(ccEffettivo)}&`
            : '';
        const a = document.createElement('a');
        a.href = `mailto:${encodeURIComponent(emailOrd)}?${ccPart}subject=${subject}&body=${body}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        mostraAvviso(
          `${etichetta} ${numeroProgressivo} salvata! Email predisposta verso ${emailOrd} (CC Tesoriere: ${ccEffettivo}) e PDF scaricato per l'allegato.`
        );
      }

      onNotificaRadio?.(
        `📧 ${etichetta.toUpperCase()} ${numeroProgressivo}: inviata via email a ${emailOrd} con CC automatico al Tesoriere (${ccEffettivo})`,
        'centrale'
      );
      return true;
    } catch (err: any) {
      console.error('Errore invio email documento contabile:', err);
      mostraAvviso(`Errore durante l'invio email: ${err?.message || 'Errore di rete'}`);
      return false;
    } finally {
      setInviandoEmailStampa(false);
    }
  };

  // Stampa Documento con Firma Automatica del Tesoriere e Invio Email con Allegato PDF
  const handleStampaDocumento = async () => {
    if (!documentoPerStampa) return;
    const tesoriere = getTesoriereAttivo(volontari);
    if (documentoPerStampa.tipo === 'tessera') {
      setInviandoEmailStampa(true);
      try {
        const vol = preparaVolontarioDaTessera(documentoPerStampa.data, volontari);
        const res = await stampaEInviaRicevutaTesseramento(vol, undefined, volontari);
        mostraAvviso(
          `Ricevuta stampata a firma del Tesoriere ${tesoriere.nome} ${tesoriere.cognome} ed inviata via email a ${res.destinatarioEmail}!`
        );
        onNotificaRadio?.(
          `🧾 RICEVUTA TESSERAMENTO: Stampata a firma automatica del Tesoriere per ${documentoPerStampa.data.socioNome} ${documentoPerStampa.data.socioCognome} e trasmessa via email a ${res.destinatarioEmail}`,
          'centrale'
        );
        setDocumentoPerStampa(null);
      } catch (err: any) {
        console.error('Errore stampa e invio ricevuta:', err);
        mostraAvviso(`Errore nella stampa o trasmissione email: ${err?.message || 'Errore'}`);
      } finally {
        setInviandoEmailStampa(false);
      }
    } else if (documentoPerStampa.tipo === 'nota') {
      try {
        scaricaNotaDiDebitoPDF(documentoPerStampa.data, tesoriere);
        mostraAvviso(`Nota di Debito ${documentoPerStampa.data.numeroProgressivo} stampata a firma del Tesoriere ${tesoriere.nome} ${tesoriere.cognome}!`);
        onNotificaRadio?.(
          `📄 NOTA DI DEBITO: Stampato documento ufficiale PDF per la nota n. ${documentoPerStampa.data.numeroProgressivo} intestata a ${documentoPerStampa.data.debitoreIntestatario}`,
          'centrale'
        );
        setDocumentoPerStampa(null);
      } catch (err: any) {
        console.error('Errore generazione PDF nota di debito:', err);
        mostraAvviso(`Errore nella stampa della nota di debito: ${err?.message || 'Errore'}`);
      }
    } else if (documentoPerStampa.tipo === 'ricevuta') {
      try {
        scaricaRicevutaContabilePDF(documentoPerStampa.data, tesoriere);
        mostraAvviso(`Ricevuta ${documentoPerStampa.data.numeroProgressivo} generata a firma del Tesoriere ${tesoriere.nome} ${tesoriere.cognome}!`);
        onNotificaRadio?.(
          `🧾 RICEVUTA CONTABILE: Stampato documento ufficiale PDF per la ricevuta n. ${documentoPerStampa.data.numeroProgressivo} intestata a ${documentoPerStampa.data.intestatario}`,
          'centrale'
        );
        setDocumentoPerStampa(null);
      } catch (err: any) {
        console.error('Errore generazione PDF ricevuta:', err);
        mostraAvviso(`Errore nella stampa della ricevuta: ${err?.message || 'Errore'}`);
      }
    } else {
      const nomeFile = scaricaProspettoCommercialistaCSV(prospettoCommercialista);
      mostraAvviso(`Prospetto esportato: ${nomeFile}`);
    }
  };

  // Combina le tessere emesse con tutti i volontari approvati con delibera (auto-inclusione automatica)
  const tessereComplete: (TesseraAssociativa & { esente?: boolean; motivoEsenzione?: string })[] = [
    ...tessere.map((t) => {
      const matchVol = (volontari || []).find(
        (v) =>
          (v.codiceFiscale && t.socioCodiceFiscale && v.codiceFiscale.toUpperCase() === t.socioCodiceFiscale.toUpperCase()) ||
          (`${v.nome} ${v.cognome}`).toLowerCase() === `${t.socioNome} ${t.socioCognome}`.toLowerCase()
      );
      if (matchVol?.esenteQuotaAssociativa) {
        return {
          ...t,
          quotaVersata: 0,
          esente: true,
          motivoEsenzione: matchVol.motivoEsenzioneQuota || 'Esenzione Regolamentare'
        };
      }
      return t;
    })
  ];

  // Aggiunge automaticamente i volontari approvati non ancora presenti nella tabella tessere
  (volontari || []).filter((v) => v.approvato).forEach((v) => {
    const giaPresente = tessereComplete.some(
      (t) =>
        (v.codiceFiscale && t.socioCodiceFiscale && t.socioCodiceFiscale.toUpperCase() === v.codiceFiscale.toUpperCase()) ||
        `${t.socioNome} ${t.socioCognome}`.toLowerCase() === `${v.nome} ${v.cognome}`.toLowerCase()
    );

    if (!giaPresente) {
      const annoCorrente = getCurrentYearItaly();
      const isOp = Boolean(v.profiloCentrale || v.qualifica === 'Operatore Centrale');
      const isEsente = Boolean(v.esenteQuotaAssociativa);
      tessereComplete.push({
        id: `tess-vol-${v.id}`,
        numeroTessera: v.tesseramento?.numeroTessera || v.matricola || `TO-${v.id.slice(-4)}`,
        socioNome: v.nome,
        socioCognome: v.cognome,
        socioCodiceFiscale: v.codiceFiscale || 'CF ARCHIVIATO',
        qualifica: (v.qualifica as any) || 'Volontario Soccorritore',
        annoSociale: annoCorrente,
        dataEmissione: v.tesseramento?.dataPrimaIscrizione || v.dataRegistrazione || formatISODateItaly(),
        dataScadenza: `${annoCorrente}-12-31`,
        quotaVersata: isEsente ? 0 : (isOp ? 10.0 : 5.0),
        stato: 'Attiva',
        ricevutaNumero: v.tesseramento?.numeroRicevutaFormattato || 'DELIBERA RUNTS',
        esente: isEsente,
        motivoEsenzione: v.motivoEsenzioneQuota
      });
    }
  });

  // Tessere filtrate
  const tessereFiltrate = tessereComplete.filter((t) => {
    const matchTesto =
      !ricerca.trim() ||
      `${t.socioNome} ${t.socioCognome}`.toLowerCase().includes(ricerca.toLowerCase()) ||
      t.numeroTessera.toLowerCase().includes(ricerca.toLowerCase()) ||
      t.socioCodiceFiscale.toLowerCase().includes(ricerca.toLowerCase());

    const matchStato = filtroStatoTessera === 'tutti' || t.stato === filtroStatoTessera;
    return matchTesto && matchStato;
  });

  // Note di debito filtrate
  const noteFiltrate = noteDiDebito.filter((n) => {
    const matchTesto =
      !ricerca.trim() ||
      n.numeroProgressivo.toLowerCase().includes(ricerca.toLowerCase()) ||
      n.debitoreIntestatario.toLowerCase().includes(ricerca.toLowerCase()) ||
      n.causale.toLowerCase().includes(ricerca.toLowerCase());

    const matchStato = filtroStatoNota === 'tutti' || n.stato === filtroStatoNota;
    return matchTesto && matchStato;
  });

  const totaleNoteIncassate = noteDiDebito
    .filter((n) => n.stato === 'Saldata')
    .reduce((acc, curr) => acc + curr.importoTotale, 0);

  const totaleNoteInAttesa = noteDiDebito
    .filter((n) => n.stato === 'Emessa' || n.stato === 'Sollecitata')
    .reduce((acc, curr) => acc + curr.importoTotale, 0);

  // Prospetto Annuale e Mensile per il Commercialista (include Altre Entrate/Uscite e Costi di Gestione)
  const prospettoCommercialista: ProspettoAnnualeCommercialista = React.useMemo(() => {
    return calcolaProspettoCommercialista(
      annoProspetto,
      tuttiServiziDonazioni,
      tessereComplete,
      noteDiDebito,
      manutenzioni,
      rifornimentiCarburante,
      listaAltreEntrateUscite,
      listaCostiGestione
    );
  }, [
    annoProspetto,
    tuttiServiziDonazioni,
    tessereComplete,
    noteDiDebito,
    manutenzioni,
    rifornimentiCarburante,
    listaAltreEntrateUscite,
    listaCostiGestione
  ]);

  // Handler CRUD Altre Entrate / Uscite (Sotto-sezione 7)
  const resetFormAltreEntrateUscite = () => {
    setEditingAltraId(null);
    setFormAltraData(formatISODateItaly());
    setFormAltraTipo('entrata');
    setFormAltraDescrizione('');
    setFormAltraCategoria('Contributo / Rimborso');
    setFormAltraImporto('');
    setFormAltraMetodo('Contanti');
    setFormAltraControparte('');
    setFormAltraRifDoc('');
    setFormAltraNote('');
  };

  const handleSalvaAltraEntrataUscita = (e: React.FormEvent) => {
    e.preventDefault();
    const imp = parseFloat((formAltraImporto || '').replace(',', '.'));
    if (!formAltraDescrizione.trim() || isNaN(imp) || imp <= 0) {
      mostraAvviso('Inserisci una descrizione valida e un importo superiore a € 0,00.');
      return;
    }
    const nuovaVoce: MovimentoAltreEntrateUscite = {
      id: editingAltraId || `aeu-${Date.now()}`,
      data: formAltraData || formatISODateItaly(),
      tipo: formAltraTipo,
      descrizione: formAltraDescrizione.trim(),
      categoria: formAltraCategoria.trim() || 'Generale',
      importo: Math.round(imp * 100) / 100,
      metodoPagamento: formAltraMetodo || 'Contanti',
      controparte: formAltraControparte.trim() || undefined,
      riferimentoDocumento: formAltraRifDoc.trim() || undefined,
      note: formAltraNote.trim() || undefined,
      operatoreRegistrazione: operatoreCorrente,
      createdAt: Date.now()
    };
    const aggiornate = editingAltraId
      ? listaAltreEntrateUscite.map((v) => (v.id === editingAltraId ? nuovaVoce : v))
      : [nuovaVoce, ...listaAltreEntrateUscite];
    salvaAltreEntrateUscite(aggiornate);
    mostraAvviso(
      editingAltraId
        ? `Voce "${nuovaVoce.descrizione}" aggiornata e riflessa nel Prospetto Commercialista.`
        : `${nuovaVoce.tipo === 'entrata' ? 'Entrata' : 'Uscita'} di € ${nuovaVoce.importo.toFixed(2)} registrata e inclusa nel Prospetto Commercialista.`
    );
    onNotificaRadio?.(
      `💶 ALTRE ENTRATE/USCITE: ${nuovaVoce.tipo === 'entrata' ? '+' : '-'}€ ${nuovaVoce.importo.toFixed(2)} — ${nuovaVoce.descrizione} (${operatoreCorrente})`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        editingAltraId ? 'Modifica Altre Entrate/Uscite' : 'Nuova voce Altre Entrate/Uscite',
        `${nuovaVoce.tipo.toUpperCase()} € ${nuovaVoce.importo.toFixed(2)} — ${nuovaVoce.descrizione}`,
        operatoreCorrente
      );
    }
    resetFormAltreEntrateUscite();
  };

  const handleEliminaAltraEntrataUscita = (id: string) => {
    const voce = listaAltreEntrateUscite.find((v) => v.id === id);
    const aggiornate = listaAltreEntrateUscite.filter((v) => v.id !== id);
    salvaAltreEntrateUscite(aggiornate);
    setConfermaEliminaAltraId(null);
    if (editingAltraId === id) resetFormAltreEntrateUscite();
    mostraAvviso(`Voce "${voce?.descrizione || ''}" eliminata da Altre Entrate/Uscite.`);
  };

  // Handler CRUD Costi di Gestione (Sotto-sezione 8)
  const resetFormCostiGestione = () => {
    setEditingGestioneId(null);
    setFormGestioneData(formatISODateItaly());
    setFormGestioneTipo('uscita');
    setFormGestioneDescrizione('');
    setFormGestioneCategoria('Utenze (Luce, Gas, Acqua)');
    setFormGestioneImporto('');
    setFormGestioneMetodo(defaultMetodoNota);
    setFormGestioneFornitore('');
    setFormGestioneNumDoc('');
    setFormGestioneNote('');
  };

  const handleSalvaCostoGestione = (e: React.FormEvent) => {
    e.preventDefault();
    const imp = parseFloat((formGestioneImporto || '').replace(',', '.'));
    if (!formGestioneDescrizione.trim() || isNaN(imp) || imp <= 0) {
      mostraAvviso('Inserisci una descrizione valida e un importo superiore a € 0,00.');
      return;
    }
    const nuovaVoce: VoceCostoGestione = {
      id: editingGestioneId || `cgest-${Date.now()}`,
      data: formGestioneData || formatISODateItaly(),
      tipo: formGestioneTipo,
      descrizione: formGestioneDescrizione.trim(),
      categoria: formGestioneCategoria || 'Altro Costo di Gestione',
      importo: Math.round(imp * 100) / 100,
      metodoPagamento: formGestioneMetodo || defaultMetodoNota,
      fornitore: formGestioneFornitore.trim() || undefined,
      numeroDocumento: formGestioneNumDoc.trim() || undefined,
      note: formGestioneNote.trim() || undefined,
      operatoreRegistrazione: operatoreCorrente,
      createdAt: Date.now()
    };
    const aggiornate = editingGestioneId
      ? listaCostiGestione.map((v) => (v.id === editingGestioneId ? nuovaVoce : v))
      : [nuovaVoce, ...listaCostiGestione];
    salvaCostiGestione(aggiornate);
    mostraAvviso(
      editingGestioneId
        ? `Costo di gestione "${nuovaVoce.descrizione}" aggiornato e riflesso nel Prospetto Commercialista.`
        : `${nuovaVoce.tipo === 'uscita' ? 'Costo di gestione' : 'Rimborso/Entrata gestione'} di € ${nuovaVoce.importo.toFixed(2)} registrato e incluso nel Prospetto Commercialista.`
    );
    onNotificaRadio?.(
      `🏢 COSTI DI GESTIONE: ${nuovaVoce.tipo === 'entrata' ? '+' : '-'}€ ${nuovaVoce.importo.toFixed(2)} — ${nuovaVoce.descrizione} (${nuovaVoce.categoria})`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        editingGestioneId ? 'Modifica Costi di Gestione' : 'Nuova voce Costi di Gestione',
        `${nuovaVoce.tipo.toUpperCase()} € ${nuovaVoce.importo.toFixed(2)} — ${nuovaVoce.descrizione} (${nuovaVoce.categoria})`,
        operatoreCorrente
      );
    }
    resetFormCostiGestione();
  };

  const handleEliminaCostoGestione = (id: string) => {
    const voce = listaCostiGestione.find((v) => v.id === id);
    const aggiornate = listaCostiGestione.filter((v) => v.id !== id);
    salvaCostiGestione(aggiornate);
    setConfermaEliminaGestioneId(null);
    if (editingGestioneId === id) resetFormCostiGestione();
    mostraAvviso(`Voce "${voce?.descrizione || ''}" eliminata da Costi di Gestione.`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 4 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/10">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50">
                Macro Categoria 4
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {useTitoloDatabase('contabilita', 'Database Contabilità, Tesseramento & Note di Debito')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Visualizzazione esclusiva servizi con donazioni registrate, rinnovi, annullamenti ed emissione tessere associative, gestione ed emissione note di debito.
            </p>
          </div>
        </div>
      </div>

      {/* Alert Notifica */}
      {avviso && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{avviso}</span>
        </div>
      )}

      {/* Barra Navigazione Sotto-Categorie (a griglia adattiva, senza scroll orizzontale) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 pb-2 border-b border-slate-800">
        {canShowSubtab('donazioni') && (
        <button
          type="button"
          onClick={() => setSottoTab('donazioni')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'donazioni'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 shrink-0" />
          <span className="break-words">1. {getTitoloSottosezione('contabilita', 'donazioni', 'Servizi con Donazioni', nomiSubCustom)} ({serviziConDonazioni.length})</span>
        </button>
        )}

        {canShowSubtab('tesseramento') && (
        <button
          type="button"
          onClick={() => setSottoTab('tesseramento')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'tesseramento'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">2. {getTitoloSottosezione('contabilita', 'tesseramento', 'Tesseramento & Soci', nomiSubCustom)} ({tessere.length})</span>
        </button>
        )}

        {canShowSubtab('noteDebito') && (
        <button
          type="button"
          onClick={() => setSottoTab('noteDebito')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'noteDebito'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">3. {getTitoloSottosezione('contabilita', 'noteDebito', 'Note di Debito', nomiSubCustom)} ({noteDiDebito.length})</span>
        </button>
        )}

        {canShowSubtab('commercialista') && (
        <button
          type="button"
          onClick={() => setSottoTab('commercialista')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'commercialista'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          <span className="break-words">4. {getTitoloSottosezione('contabilita', 'commercialista', 'Prospetto Commercialista', nomiSubCustom)}</span>
        </button>
        )}

        {canShowSubtab('costiServizio') && (
        <button
          type="button"
          onClick={() => setSottoTab('costiServizio')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'costiServizio'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
          <span className="break-words">5. {getTitoloSottosezione('contabilita', 'costiServizio', 'Costi di Servizio', nomiSubCustom)} ({tariffeCostiServizio.length})</span>
        </button>
        )}

        {canShowSubtab('contiCorrenti') && (
        <button
          type="button"
          onClick={() => setSottoTab('contiCorrenti')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'contiCorrenti'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
          <span className="break-words">6. {getTitoloSottosezione('contabilita', 'contiCorrenti', 'Coordinate Bancarie & Postali', nomiSubCustom)} ({2 + metodiPagamentoCustom.filter((m) => m.attivo).length})</span>
        </button>
        )}

        {canShowSubtab('altreEntrateUscite') && (
        <button
          type="button"
          onClick={() => setSottoTab('altreEntrateUscite')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'altreEntrateUscite'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
          <span className="break-words">7. {getTitoloSottosezione('contabilita', 'altreEntrateUscite', 'Altre Entrate / Uscite', nomiSubCustom)} ({listaAltreEntrateUscite.length})</span>
        </button>
        )}

        {canShowSubtab('costiGestione') && (
        <button
          type="button"
          onClick={() => setSottoTab('costiGestione')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'costiGestione'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
          <span className="break-words">8. {getTitoloSottosezione('contabilita', 'costiGestione', 'Costi di Gestione', nomiSubCustom)} ({listaCostiGestione.length})</span>
        </button>
        )}

        {canShowSubtab('ricevute') && (
        <button
          type="button"
          onClick={() => setSottoTab('ricevute')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'ricevute'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          <span className="break-words">9. {getTitoloSottosezione('contabilita', 'ricevute', 'Emissione Ricevute', nomiSubCustom)} ({listaRicevute.length})</span>
        </button>
        )}

        {canShowSubtab('scadenzeFiscali') && (
        <button
          type="button"
          onClick={() => setSottoTab('scadenzeFiscali')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'scadenzeFiscali'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-300 font-black'
              : 'bg-slate-900 text-amber-300/90 hover:text-amber-200 border border-amber-500/30'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">10. {getTitoloSottosezione('contabilita', 'scadenzeFiscali', 'Scadenze Fiscali ODV', nomiSubCustom)} ({scadenzeFiscaliOdvLista.filter((s) => s.attiva && s.stato === 'Aperta').length})</span>
        </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: VISUALIZZAZIONE ESCLUSIVA SERVIZI CON DONAZIONI         */}
      {/* ===================================================================== */}
      {sottoTab === 'donazioni' && (
        <div className="space-y-4">
          {/* KPI Donazioni */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Totale Donazioni Incassate</span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  € {totaleDonazioniIncassate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-500" />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Servizi con Donazione</span>
                <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
                  {serviziConDonazioni.length} Servizi
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Donazione Media</span>
                <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                  € {serviziConDonazioni.length > 0 ? (totaleDonazioniIncassate / serviziConDonazioni.length).toFixed(2) : '0,00'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filtro Donazioni */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca codice servizio, richiedente, mezzo..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={filtroMese}
                onChange={(e) => setFiltroMese(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                title="Filtra per mese"
              />

              {/* Pulsante Esporta CSV Donazioni per la Tesoreria */}
              <button
                type="button"
                onClick={esportaDonazioniCsv}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer transition-all"
                title="Esporta elenco completo donazioni in formato CSV per la Tesoreria"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Esporta CSV Donazioni</span>
              </button>

              {/* Pulsante Registra Nuova Donazione */}
              <button
                type="button"
                onClick={() => {
                  setFormDonazioneServizioCollegatoId('');
                  setRicercaServizioDonazione('');
                  setFormDonazioneImporto('');
                  setFormDonazioneCodice('');
                  setFormDonazionePaziente('');
                  setFormDonazioneMetodo('Contanti');
                  setFormDonazioneRicevuta(`DON-${getCurrentYearItaly()}/${String(serviziConDonazioni.length + 1).padStart(3, '0')}`);
                  setFormDonazioneCfPiva('');
                  setFormDonazioneNote('');
                  setFormDonazioneData(formatISODateItaly());
                  setModaleNuovaDonazioneAperta(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer transition-all"
                title="Registra una nuova donazione con verifica importo e collegamento opzionale a servizio in archivio"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Registra Donazione</span>
              </button>
            </div>
          </div>

          {/* Tabella Solo Servizi con Donazione */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Codice & Data</th>
                    <th className="py-3 px-4">Paziente / Donatore</th>
                    <th className="py-3 px-4">C.F. / P.Iva & Dettaglio</th>
                    <th className="py-3 px-4 font-mono">Importo Donazione</th>
                    <th className="py-3 px-4">Ricevuta Fiscale</th>
                    <th className="py-3 px-4 text-right">Riepilogo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {serviziConDonazioni.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nessun servizio con donazione economica registrata nell'archivio.
                      </td>
                    </tr>
                  ) : (
                    serviziConDonazioni.map((s) => {
                      const imp = estraiImportoDonazione(s);
                      const nomeDonatore = estraiNomeDonatore(s);
                      const cfPivaDon = estraiCfPivaDonatore(s);
                      const isCollegatoArchivio = Boolean(
                        s.servizioCollegato ||
                        s.servizioCollegatoId ||
                        (serviziArchivio || []).some((arch) => (arch.id || arch.codice) === (s.id || s.codice))
                      );
                      const metodoDisplay =
                        s.metodoDonazione ||
                        s.metodoPagamento ||
                        s.donazione?.modalita ||
                        (s.datiDestinazione?.donazione?.metodo === 'pos' ? 'POS' : s.datiDestinazione?.donazione?.metodo === 'contanti' ? 'Contanti' : (s.datiDestinazione?.donazione?.metodo || ''));
                      return (
                        <tr key={s.id || s.codice} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                {s.codice}
                              </span>
                              {isCollegatoArchivio && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[9px] font-bold uppercase"
                                  title="Collegata a servizio svolto in archivio"
                                >
                                  <Link2 className="w-2.5 h-2.5" />
                                  Servizio
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">{s.dataDonazione || s.data}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm">{nomeDonatore}</div>
                            <div className="text-[11px] text-slate-400">{s.tipoServizio || s.ambito || 'Trasporto Sanitario'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-cyan-300 font-mono font-bold text-[11px]">
                              {cfPivaDon || <span className="text-slate-500 font-sans font-normal italic">C.F. / P.Iva non indicato</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {s.destinazione || s.indirizzoIntervento || s.luogoIntervento || s.noteDonazione}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-black text-emerald-400 text-sm">
                              € {imp.toFixed(2)}
                            </div>
                            {metodoDisplay && (
                              <div className="text-[10px] text-slate-400 font-semibold">{metodoDisplay}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700/50 text-[10px] font-bold">
                              {s.ricevutaDonazione || 'Emessa Art. 82'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[11px] text-slate-400 font-mono">
                              Volontario: {s.volontarioNome || 'Equipaggio'}
                            </span>
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
      )}

      {/* ===================================================================== */}
      {/* 2. SOTTO-TAB: TESSERAMENTO & SOCI (RINNOVI, ANNULLAMENTI, EMISSIONE)   */}
      {/* ===================================================================== */}
      {sottoTab === 'tesseramento' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-400" />
                <span>Libro Soci & Tessere Associative Annuali</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Emissione nuove tessere, rinnovi annuali (€5 volontari / €10 operatori) con esenzione imposta di bollo (D.Lgs. 117/2017) e annullamenti.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormTessNome('');
                setFormTessCognome('');
                setFormTessCF('');
                setFormTessQualifica('Volontario Soccorritore');
                setFormTessQuota(5.0);
                setFormTessNumero(`TO-2026/${String(tessere.length + 1).padStart(3, '0')}`);
                setModaleNuovaTesseraAperta(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Emetti Nuova Tessera</span>
            </button>
          </div>

          {/* Filtri Tessere */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca numero tessera, nome socio o CF..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroStatoTessera}
                onChange={(e) => setFiltroStatoTessera(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutti gli Stati</option>
                <option value="Attiva">Attive</option>
                <option value="Rinnovata">Rinnovate</option>
                <option value="Annullata">Annullate</option>
              </select>
            </div>
          </div>

          {/* Barra Azioni Selezione Multipla PDF Tessere */}
          {selectedTessereIds.length > 0 && (
            <div className="bg-indigo-950/60 border-2 border-indigo-500/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
                <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>{selectedTessereIds.length}</strong> ricevuta/e tessera selezionata/e
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTessereIds([])}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Deseleziona
                </button>
                <button
                  type="button"
                  disabled={batchPdfInCorso}
                  onClick={() => handleBatchPdfTessere('download', tessereComplete)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica PDF ({selectedTessereIds.length})</span>
                </button>
                <button
                  type="button"
                  disabled={batchPdfInCorso}
                  onClick={() => handleBatchPdfTessere('print', tessereComplete)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa PDF ({selectedTessereIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Tabella Tessere */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelezionaTutteTessere(tessereFiltrate.map((t) => t.id))}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        title="Seleziona tutte le ricevute visibili per download/stampa PDF"
                      >
                        {tessereFiltrate.length > 0 && tessereFiltrate.every((t) => selectedTessereIds.includes(t.id)) ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Numero Tessera</th>
                    <th className="py-3 px-4">Socio & Codice Fiscale</th>
                    <th className="py-3 px-4">Qualifica</th>
                    <th className="py-3 px-4 font-mono">Quota Versata</th>
                    <th className="py-3 px-4">Data Scadenza</th>
                    <th className="py-3 px-4">Stato</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tessereFiltrate.map((t) => {
                    const isAttiva = t.stato === 'Attiva' || t.stato === 'Rinnovata';
                    const isAnnullata = t.stato === 'Annullata';
                    const isSelected = selectedTessereIds.includes(t.id);

                    return (
                      <tr key={t.id} className={`transition-colors ${isSelected ? 'bg-indigo-950/25' : 'hover:bg-slate-900/50'}`}>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelezionaTessera(t.id)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                            title="Seleziona tessera per download/stampa PDF"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-amber-400">
                          {t.numeroTessera}
                          <div className="text-[10px] text-slate-500 font-normal">Anno {t.annoSociale}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{t.socioNome} {t.socioCognome}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{t.socioCodiceFiscale}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {t.qualifica}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-purple-400">
                          {t.quotaVersata > 0 ? (
                            `€ ${t.quotaVersata.toFixed(2)}`
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-emerald-400 font-bold">€ 0,00</span>
                              <span className="text-[9.5px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40 w-fit mt-0.5">
                                Esente: {t.motivoEsenzione || 'Quota Assolta'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {t.dataScadenza}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            isAnnullata
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                          }`}>
                            {t.stato}
                          </span>
                          {t.motivoAnnullamento && (
                            <div className="text-[10px] text-red-400 italic mt-0.5 max-w-xs">{t.motivoAnnullamento}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAttiva && (
                              <button
                                type="button"
                                onClick={() => handleRinnovaTessera(t)}
                                className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-bold text-[11px] cursor-pointer"
                                title="Rinnova per l'Anno in Corso"
                              >
                                Rinnova
                              </button>
                            )}

                            {isAttiva && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTesseraDaAnnullare(t);
                                  setMotivoAnnullamentoTessera('Dimissioni volontarie del socio');
                                }}
                                className="px-2 py-1 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold text-[11px] cursor-pointer"
                                title="Annulla Tessera"
                              >
                                Annulla
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDocumentoPerStampa({ tipo: 'tessera', data: t })}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              title="Stampa Ricevuta / Tessera"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
      {/* 3. SOTTO-TAB: NOTE DI DEBITO (GESTIONE ED EMISSIONE)                   */}
      {/* ===================================================================== */}
      {sottoTab === 'noteDebito' && (
        <div className="space-y-4">
          {/* KPI Note di Debito */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Note Saldate (Incassate)</span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  € {totaleNoteIncassate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Note in Sospeso / Attesa</span>
                <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                  € {totaleNoteInAttesa.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Note Emesse Totali</span>
                <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
                  {noteDiDebito.length} Documenti
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Registro Note di Debito per Enti, Cliniche e Privati</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Fatturazione e note di debito per trasporti sanitari, convenzioni ASL e presidi sanitari per eventi.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setFormNotaDebitore('Azienda USL Toscana Nord Ovest');
                setFormNotaPiva('02198590503');
                setFormNotaIndirizzo('Via Monterotondo 49, Livorno (LI)');
                setFormNotaEmail('');
                setFormNotaEmailNonDisponibile(false);
                setFormNotaPec('');
                setFormNotaPecNonDisponibile(false);
                setFormNotaCausale('Convenzione Trasporto Sanitario');
                setFormNotaImporto(300.0);
                setFormNotaScadenza(addDaysISODate(formatISODateItaly(), 30));
                setFormNotaMetodo(defaultMetodoNota);
                setFormNotaRiferimento('');
                setFormServizioCollegatoId('');
                setFormKmPercorsiServizio(0);
                setFormOreImpiegoServizio(0);
                setFormProprietarioImmobile({ nomeCognome: '', codiceFiscale: '', indirizzoResidenza: '' });
                setMostraSezioneProprietario(false);
                setFormVociDettaglio([]);
                setFormScontoTipo('nessuno');
                setFormScontoValore(0);
                setFormScontoDescrizione('');
                setModaleNuovaNotaAperta(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Emetti Nota di Debito</span>
            </button>
          </div>

          {/* Barra Azioni Selezione Multipla (Scarica PDF, Stampa PDF, Rimuovi) */}
          {selectedNoteIds.length > 0 && (
            <div className="bg-indigo-950/60 border-2 border-indigo-500/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-indigo-100">
                <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>{selectedNoteIds.length}</strong> nota/e di debito selezionata/e dall'archivio
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNoteIds([])}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Deseleziona
                </button>
                <button
                  type="button"
                  disabled={batchPdfInCorso}
                  onClick={() => handleBatchPdfNote('download')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica PDF ({selectedNoteIds.length})</span>
                </button>
                <button
                  type="button"
                  disabled={batchPdfInCorso}
                  onClick={() => handleBatchPdfNote('print')}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa PDF ({selectedNoteIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={apriEliminaNoteSelezionate}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Rimuovi ({selectedNoteIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Tabella Note di Debito */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelezionaTutteNote(noteFiltrate.map(n => n.id))}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        title="Seleziona tutte le note visibili"
                      >
                        {noteFiltrate.length > 0 && noteFiltrate.every(n => selectedNoteIds.includes(n.id)) ? (
                          <CheckSquare className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Numero & Data</th>
                    <th className="py-3 px-4">Debitore / Ente</th>
                    <th className="py-3 px-4">Causale Prestazione</th>
                    <th className="py-3 px-4 font-mono">Importo (€)</th>
                    <th className="py-3 px-4">Scadenza</th>
                    <th className="py-3 px-4">Conto / IBAN Accredito</th>
                    <th className="py-3 px-4">Stato Pagamento</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {noteFiltrate.map((n) => {
                    const isSaldata = n.stato === 'Saldata';
                    const isSollecitata = n.stato === 'Sollecitata';
                    const isSelected = selectedNoteIds.includes(n.id);

                    const isPoste = n.contoAccredito === 'Poste Italiane' || (n.metodoPagamento && (n.metodoPagamento.includes('Poste') || n.metodoPagamento.includes('C/C Postale') || n.metodoPagamento.includes('00001007035676')));
                    const isCredit = n.contoAccredito === 'Credit Agricole' || (n.metodoPagamento && (n.metodoPagamento.includes('Credit Agricole') || n.metodoPagamento.includes('Agricole') || (!isPoste && n.metodoPagamento.includes('Bonifico'))));

                    return (
                      <tr key={n.id} className={`transition-colors ${isSelected ? 'bg-red-950/20' : 'hover:bg-slate-900/50'}`}>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelezionaNota(n.id)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                            title="Seleziona nota"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-amber-400">
                          {n.numeroProgressivo}
                          <div className="text-[10px] text-slate-500 font-normal">{n.dataEmissione}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm">{n.debitoreIntestatario}</div>
                          <div className="text-[11px] text-slate-400 font-mono">P.IVA/CF: {n.partitaIvaCodiceFiscale}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                            {n.emailNonDisponibile ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                                Email: Non in possesso
                              </span>
                            ) : n.emailDestinatario ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                                ✉ {n.emailDestinatario}
                              </span>
                            ) : null}
                            {n.pecNonDisponibile ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                                PEC: Non in possesso
                              </span>
                            ) : n.pecDestinatario ? (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-600/50 text-indigo-300 font-mono">
                                PEC: {n.pecDestinatario}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs">
                          {n.causale}
                          {n.codiceServizioRiferimento && (
                            <div className="text-[10px] text-purple-300 font-mono mt-0.5">Rif: {n.codiceServizioRiferimento}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-purple-400 text-sm">
                          € {n.importoTotale.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {n.scadenzaPagamento}
                        </td>
                        <td className="py-3 px-4">
                          {isCredit ? (
                            <div className="space-y-0.5 min-w-[200px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-600/70 shadow-sm">
                                🏦 {bancaCreditAgricole}
                              </span>
                              <div className="text-[11px] font-mono text-emerald-400 font-bold select-all tracking-tight">
                                {n.ibanAccredito || ibanCreditAgricole}
                              </div>
                            </div>
                          ) : isPoste ? (
                            <div className="space-y-0.5 min-w-[200px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-600/70 shadow-sm">
                                🟡 {bancaPoste}
                              </span>
                              <div className="text-[11px] font-mono text-amber-400 font-bold select-all tracking-tight">
                                {n.ibanAccredito || ibanPoste}
                              </div>
                              <div className="text-[10px] font-mono text-amber-300/80 font-semibold">
                                C/c Postale: {n.ccPostaleAccredito || ccPostale}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {n.metodoPagamento || 'Altro'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            isSaldata
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                              : isSollecitata
                              ? 'bg-amber-950 text-amber-300 border-amber-700/50 animate-pulse'
                              : 'bg-blue-950 text-blue-300 border-blue-700/50'
                          }`}>
                            {n.stato}
                          </span>
                          {n.dataIncasso && (
                            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Incassato: {n.dataIncasso}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isSaldata && (
                              <button
                                type="button"
                                onClick={() => handleSegnaSaldata(n)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer shadow-sm"
                                title="Segna come Incassata"
                              >
                                Incassata
                              </button>
                            )}

                            {!isSaldata && !isSollecitata && (
                              <button
                                type="button"
                                onClick={() => handleSollecitaPagamento(n)}
                                className="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 font-bold text-[11px] cursor-pointer"
                                title="Sollecita Pagamento"
                              >
                                Sollecita
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDocumentoPerStampa({ tipo: 'nota', data: n })}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              title="Stampa / Visualizza Documento"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => apriEliminaSingolaNota(n)}
                              className="p-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-400 hover:text-white border border-red-800/60 cursor-pointer"
                              title="Rimuovi nota dall'archivio (notifica automatica a presidenza e tesoreria)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
      {/* 4. SOTTO-TAB: PROSPETTO MENSILE PER IL COMMERCIALISTA (BILANCIO)      */}
      {/* ===================================================================== */}
      {sottoTab === 'commercialista' && (
        <div className="space-y-4">
          {/* Header Prospetto Commercialista */}
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                  Rendicontazione & Bilancio d'Esercizio
                </span>
                <span className="text-xs font-mono font-bold text-amber-300">
                  Croce Oro Massa Carrara OdV • ETS
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center gap-2 mt-1">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Prospetto Contabile Mensile per il Commercialista (Anno {annoProspetto})</span>
              </h3>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                Riepilogo ordinato mese per mese di tutte le entrate (donazioni da trasporti sanitari, offerte liberali, quote associative dei volontari e note di debito USL) e uscite di gestione flotta (manutenzioni, tagliandi e carburante) per agevolare la chiusura del bilancio d'esercizio e i controlli RUNTS.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
              {/* Selettore Anno */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                <Calendar className="w-4 h-4 text-amber-400 ml-1.5" />
                <select
                  value={annoProspetto}
                  onChange={(e) => setAnnoProspetto(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-white px-2 py-1 focus:outline-none cursor-pointer"
                >
                  <option value={2026} className="bg-slate-900">Esercizio 2026</option>
                  <option value={2025} className="bg-slate-900">Esercizio 2025</option>
                  <option value={2024} className="bg-slate-900">Esercizio 2024</option>
                </select>
              </div>

              {/* Tasto Esporta CSV per Excel */}
              <button
                type="button"
                onClick={() => {
                  const nomeFile = scaricaProspettoCommercialistaCSV(prospettoCommercialista);
                  onNotificaRadio?.(`📊 PROSPETTO COMMERCIALISTA ESPORTATO: Salvato ${nomeFile} per l'anno ${annoProspetto}`, 'sistema');
                  mostraAvviso(`Prospetto per il commercialista salvato con successo: ${nomeFile}`);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer"
                title="Scarica il prospetto mensile completo in formato CSV compatibile Microsoft Excel"
              >
                <Download className="w-4 h-4" />
                <span>Esporta CSV (Excel)</span>
              </button>

              {/* Tasto Stampa / Esporta Prospetto Commercialista */}
              <button
                type="button"
                onClick={() => {
                  const nomeFile = scaricaProspettoCommercialistaCSV(prospettoCommercialista);
                  onNotificaRadio?.(`📊 PROSPETTO COMMERCIALISTA ESPORTATO: Salvato ${nomeFile} per l'anno ${annoProspetto}`, 'sistema');
                  mostraAvviso(`Prospetto contabile ${annoProspetto} scaricato (${nomeFile}) pronto per stampa o importazione.`);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-black text-xs uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Esporta il prospetto contabile mensile per il commercialista"
              >
                <Printer className="w-4 h-4 text-purple-400" />
                <span>Stampa / Esporta</span>
              </button>
            </div>
          </div>

          {/* 4 CARDS KPI ANNUALI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Totale Entrate Annuali */}
            <div className="bg-slate-950 p-4 rounded-2xl border-2 border-emerald-500/40 shadow-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Totale Entrate {annoProspetto}</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                € {prospettoCommercialista.totali.totaleEntrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Donazioni + Tessere + Note</span>
                <span className="text-emerald-400 font-bold">Incassi ETS</span>
              </div>
            </div>

            {/* Totale Donazioni */}
            <div className="bg-slate-950 p-4 rounded-2xl border-2 border-pink-500/40 shadow-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Donazioni Raccolte</span>
              <div className="text-xl sm:text-2xl font-black text-pink-400 font-mono">
                € {prospettoCommercialista.totali.totaleDonazioni.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{prospettoCommercialista.totali.conteggioDonazioni} erogazioni liberali</span>
                <span className="text-pink-400 font-bold">Art. 82 CTS</span>
              </div>
            </div>

            {/* Totale Uscite Flotta (Manutenzioni + Carburante) */}
            <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40 shadow-lg">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Uscite Esercizio Flotta</span>
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                € {prospettoCommercialista.totali.totaleUscite.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Manutenzione + Carburante</span>
                <span className="text-amber-400 font-bold">Costi Autoparco</span>
              </div>
            </div>

            {/* Saldo Netto Esercizio */}
            <div className={`p-4 rounded-2xl border-2 shadow-lg ${
              prospettoCommercialista.totali.saldoNettoEsercizio >= 0
                ? 'bg-emerald-950/40 border-emerald-500'
                : 'bg-rose-950/40 border-rose-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Saldo Netto d'Esercizio</span>
              <div className={`text-xl sm:text-2xl font-black font-mono ${
                prospettoCommercialista.totali.saldoNettoEsercizio >= 0 ? 'text-emerald-300' : 'text-rose-400'
              }`}>
                € {prospettoCommercialista.totali.saldoNettoEsercizio.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Differenza Entrate - Uscite</span>
                <span className={`font-bold ${prospettoCommercialista.totali.saldoNettoEsercizio >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {prospettoCommercialista.totali.saldoNettoEsercizio >= 0 ? 'Avanzo Gestione' : 'Disavanzo'}
                </span>
              </div>
            </div>
          </div>

          {/* TABELLA PROSPETTO MENSILE (12 MESI) */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/95 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-3">Mese ({annoProspetto})</th>
                    <th className="py-3 px-3 font-mono text-pink-400">Donazioni</th>
                    <th className="py-3 px-3 font-mono text-blue-400">Tessere</th>
                    <th className="py-3 px-3 font-mono text-purple-400">Note Debito</th>
                    <th className="py-3 px-3 font-mono text-cyan-400">Altre Entrate</th>
                    <th className="py-3 px-3 font-mono text-emerald-400 font-black">Tot. Entrate</th>
                    <th className="py-3 px-3 font-mono text-slate-300">Manutenz.</th>
                    <th className="py-3 px-3 font-mono text-amber-400">Carburante</th>
                    <th className="py-3 px-3 font-mono text-orange-400">Altre Uscite</th>
                    <th className="py-3 px-3 font-mono text-rose-300">Costi Gestione</th>
                    <th className="py-3 px-3 font-mono text-rose-400 font-black">Tot. Uscite</th>
                    <th className="py-3 px-3 font-mono text-center">Saldo Netto</th>
                    <th className="py-3 px-3 text-right">Dettagli</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {prospettoCommercialista.mesi.map((m) => {
                    const isPositivo = m.saldoNetto >= 0;
                    const haMovimenti = m.totaleEntrate > 0 || m.totaleUscite > 0;
                    const altreEntrateTotMese = m.totaleAltreEntrate + m.totaleCostiGestioneEntrate;
                    const altreEntrateCntMese = m.conteggioAltreEntrate + m.conteggioCostiGestioneEntrate;
                    return (
                      <tr key={m.meseNumero} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-3 font-black text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-center font-mono text-slate-400">
                              {m.meseNumero}
                            </span>
                            <span>{m.nomeMese}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-pink-300">€ {m.totaleDonazioni.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioDonazioni} don.</div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-blue-300">€ {m.totaleTessere.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioTessere} tess.</div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-purple-300">€ {m.totaleNoteDebito.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioNoteDebito} note</div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-cyan-300">€ {altreEntrateTotMese.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{altreEntrateCntMese} voci</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-emerald-400 text-sm bg-emerald-950/10">
                          € {m.totaleEntrate.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          <div>€ {m.totaleManutenzioni.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioManutenzioni} int.</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-amber-300">
                          <div>€ {m.totaleCarburante.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioRifornimenti} pieni</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-orange-300">
                          <div>€ {m.totaleAltreUscite.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioAltreUscite} voci</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-rose-300">
                          <div>€ {m.totaleCostiGestioneUscite.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioCostiGestioneUscite} costi</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-rose-400 text-sm bg-rose-950/10">
                          € {m.totaleUscite.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-mono text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs ${
                            !haMovimenti
                              ? 'bg-slate-900 text-slate-500'
                              : isPositivo
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                              : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                          }`}>
                            {isPositivo ? '+' : ''}€ {m.saldoNetto.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            disabled={!haMovimenti}
                            onClick={() => setMeseDettaglioSelezionato(m)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-purple-300 hover:text-white border border-purple-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Vedi Voci
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* RIGA TOTALI ANNUALI */}
                <tfoot>
                  <tr className="bg-slate-900 border-t-2 border-slate-700 font-black text-xs">
                    <td className="py-4 px-3 text-white uppercase tracking-wider">
                      TOTALE {annoProspetto}
                    </td>
                    <td className="py-4 px-3 font-mono text-pink-400">
                      € {prospettoCommercialista.totali.totaleDonazioni.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-blue-400">
                      € {prospettoCommercialista.totali.totaleTessere.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-purple-400">
                      € {prospettoCommercialista.totali.totaleNoteDebito.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-cyan-400">
                      € {(prospettoCommercialista.totali.totaleAltreEntrate + prospettoCommercialista.totali.totaleCostiGestioneEntrate).toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-emerald-400 text-base bg-emerald-950/30">
                      € {prospettoCommercialista.totali.totaleEntrate.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-slate-300">
                      € {prospettoCommercialista.totali.totaleManutenzioni.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-amber-400">
                      € {prospettoCommercialista.totali.totaleCarburante.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-orange-400">
                      € {prospettoCommercialista.totali.totaleAltreUscite.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-rose-300">
                      € {prospettoCommercialista.totali.totaleCostiGestioneUscite.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-rose-400 text-base bg-rose-950/30">
                      € {prospettoCommercialista.totali.totaleUscite.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-center">
                      <span className={`inline-block px-3 py-1 rounded-xl font-black text-sm shadow ${
                        prospettoCommercialista.totali.saldoNettoEsercizio >= 0
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-rose-600 text-white font-black'
                      }`}>
                        {prospettoCommercialista.totali.saldoNettoEsercizio >= 0 ? '+' : ''}€ {prospettoCommercialista.totali.saldoNettoEsercizio.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right text-slate-500 font-mono text-[10px]">
                      Chiusura RUNTS
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* NOTE FISCALI & DETTAGLI PER IL COMMERCIALISTA */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 text-amber-400 font-black uppercase text-[11px]">
              <Sparkles className="w-4 h-4" />
              <span>Note per lo Studio Commercialistico & Rendicontazione Terzo Settore (D.Lgs. 117/2017):</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              • Le <strong className="text-white">Donazioni</strong> registrate comprendono le erogazioni liberali da privati cittadini raccolte durante i trasporti sanitari ordinari/118 e le donazioni dirette, tutte intestate alla Croce Oro Massa Carrara OdV.
            </p>
            <p className="text-slate-400 text-[11px]">
              • Il <strong className="text-white">Tesseramento</strong> include le quote annuali versate dai soci volontari soccorritori ed operatori, deliberate dall'Assemblea dei Soci e registrate nel Libro Soci RUNTS.
            </p>
            <p className="text-slate-400 text-[11px]">
              • Le <strong className="text-white">Note di Debito</strong> rappresentano i rimborsi spese istituzionali per convenzioni sanitarie emessi verso Aziende USL e Pubbliche Amministrazioni.
            </p>
            <p className="text-slate-400 text-[11px]">
              • Le <strong className="text-white">Uscite Flotta</strong> includono fatture di officine convenzionate per manutenzioni ordinarie/straordinarie e acquisti di carburante documentati con carte carburante elettroniche tracciate.
            </p>
          </div>
        </div>
      )}

      {/* MODALE DETTAGLI VOCI DEL SINGOLO MESE PER IL COMMERCIALISTA */}
      {meseDettaglioSelezionato && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-purple-500/60 rounded-3xl max-w-2xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">
                    Dettaglio Movimenti: {meseDettaglioSelezionato.nomeMese} {annoProspetto}
                  </h3>
                  <p className="text-xs text-slate-400">Ripartizione dettagliata delle entrate e delle uscite registrate nel mese</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMeseDettaglioSelezionato(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Riepilogo Veloce */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40">
                <span className="text-[10px] text-slate-400 font-sans block">Entrate Mese</span>
                <span className="text-base font-black text-emerald-400">€ {meseDettaglioSelezionato.totaleEntrate.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40">
                <span className="text-[10px] text-slate-400 font-sans block">Uscite Mese</span>
                <span className="text-base font-black text-rose-400">€ {meseDettaglioSelezionato.totaleUscite.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-sans block">Saldo Netto Mese</span>
                <span className={`text-base font-black ${meseDettaglioSelezionato.saldoNetto >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                  {meseDettaglioSelezionato.saldoNetto >= 0 ? '+' : ''}€ {meseDettaglioSelezionato.saldoNetto.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Voci di Dettaglio */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between">
                  <span>💖 Donazioni da Servizi & Erogazioni Liberali</span>
                  <span className="text-pink-400 font-mono">€ {meseDettaglioSelezionato.totaleDonazioni.toFixed(2)} ({meseDettaglioSelezionato.conteggioDonazioni} rec)</span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Totale donazioni incassate dai volontari durante i trasporti sanitari e rilasciate con ricevuta dell'ente.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between">
                  <span>💳 Quote Tesseramento Soci & Volontari</span>
                  <span className="text-blue-400 font-mono">€ {meseDettaglioSelezionato.totaleTessere.toFixed(2)} ({meseDettaglioSelezionato.conteggioTessere} tessere)</span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Quote associative versate all'atto dell'iscrizione o del rinnovo annuale nel registro soci.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between">
                  <span>📄 Note di Debito / Rimborsi Sanità Pubblica</span>
                  <span className="text-purple-400 font-mono">€ {meseDettaglioSelezionato.totaleNoteDebito.toFixed(2)} ({meseDettaglioSelezionato.conteggioNoteDebito} fatture)</span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Prestazioni e trasporti sanitari fatturati verso USL, Enti Ospedalieri o privati.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between">
                  <span>🔧 Manutenzioni, Tagliandi & Riparazioni Mezzi</span>
                  <span className="text-slate-300 font-mono">€ {meseDettaglioSelezionato.totaleManutenzioni.toFixed(2)} ({meseDettaglioSelezionato.conteggioManutenzioni} interventi)</span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Spese sostenute presso officine autorizzate per collaudi, revisioni ministeriali, tagliandi motore e pneumatici.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between">
                  <span>⛽ Carburante Flotta Mezzi di Soccorso</span>
                  <span className="text-amber-400 font-mono">€ {meseDettaglioSelezionato.totaleCarburante.toFixed(2)} ({meseDettaglioSelezionato.conteggioRifornimenti} rifornimenti)</span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Gasolio e additivi acquistati con carte carburante elettroniche aziendali per i mezzi in turno.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-500/30 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between gap-2 flex-wrap">
                  <span>💶 Altre Entrate / Uscite (Inserimento Manuale)</span>
                  <span className="font-mono flex items-center gap-3">
                    <span className="text-cyan-400">+€ {meseDettaglioSelezionato.totaleAltreEntrate.toFixed(2)} ({meseDettaglioSelezionato.conteggioAltreEntrate})</span>
                    <span className="text-orange-400">-€ {meseDettaglioSelezionato.totaleAltreUscite.toFixed(2)} ({meseDettaglioSelezionato.conteggioAltreUscite})</span>
                  </span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Movimenti contabili manuali registrati nella sottosezione Altre Entrate/Uscite per {meseDettaglioSelezionato.nomeMese} {annoProspetto}.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/30 space-y-2">
                <h4 className="font-black text-white uppercase text-[11px] flex items-center justify-between gap-2 flex-wrap">
                  <span>🏢 Costi di Gestione (Sede, Utenze, Assicurazioni, Ecc.)</span>
                  <span className="font-mono flex items-center gap-3">
                    <span className="text-rose-400">-€ {meseDettaglioSelezionato.totaleCostiGestioneUscite.toFixed(2)} ({meseDettaglioSelezionato.conteggioCostiGestioneUscite})</span>
                    {meseDettaglioSelezionato.totaleCostiGestioneEntrate > 0 && (
                      <span className="text-emerald-400">+€ {meseDettaglioSelezionato.totaleCostiGestioneEntrate.toFixed(2)} ({meseDettaglioSelezionato.conteggioCostiGestioneEntrate})</span>
                    )}
                  </span>
                </h4>
                <div className="text-slate-400 text-[11px]">
                  Spese e rimborsi operativi di gestione registrati nella sottosezione Costi di Gestione per {meseDettaglioSelezionato.nomeMese} {annoProspetto}.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setMeseDettaglioSelezionato(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. SOTTO-TAB: COSTI DI SERVIZIO (TARIFFARIO, SIGLE & DESCRIZIONI)      */}
      {/* ===================================================================== */}
      {sottoTab === 'costiServizio' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                  Tariffario Ufficiale Servizi
                </span>
                <span className="text-xs font-mono text-purple-300 font-bold">
                  Sigla Breve + Descrizione Affiancate
                </span>
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2 mt-1">
                <Tag className="w-5 h-5 text-amber-400" />
                <span>Costi di Servizio (Mezzo/KM, Uscita Mezzo, Operatori & Voci Editabili)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                Configura i parametri tariffari e le sigle brevi con relativa descrizione. Le voci saranno richiamabili automaticamente in fase di emissione Nota di Debito.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setMostraGestioneCategorieCosti((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase cursor-pointer border transition-all flex items-center gap-1.5 ${
                  mostraGestioneCategorieCosti
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                    : 'bg-amber-950/60 text-amber-300 border-amber-500/50 hover:bg-amber-900/70'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{mostraGestioneCategorieCosti ? 'Chiudi Categorie' : `Gestisci Categorie (${categorieCostiServizio.length})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setFiltroCategoriaTariffa('tutti')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase cursor-pointer border transition-all ${
                  filtroCategoriaTariffa === 'tutti'
                    ? 'bg-purple-600 text-white border-purple-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Tutte
              </button>
              {categorieCostiServizio.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFiltroCategoriaTariffa(cat.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase cursor-pointer border transition-all ${
                    filtroCategoriaTariffa === cat.id
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {cat.nome}
                </button>
              ))}
            </div>
          </div>

          {/* Pannello Gestione Categorie di Costo (Crea, Modifica, Cancella) */}
          {mostraGestioneCategorieCosti && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div>
                  <h4 className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
                    <Tag className="w-4 h-4" />
                    <span>Gestione Categorie di Costo</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Crea nuove categorie, rinomina o modifica quelle esistenti oppure eliminale. Le modifiche si applicano subito al tariffario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostraGestioneCategorieCosti(false)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Chiudi pannello categorie"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form creazione nuova categoria */}
              <form onSubmit={handleCreaCategoriaCosto} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-amber-300 uppercase mb-1">Nome Nuova Categoria *</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="es. Materiale Sanitario, Presidio Evento..."
                    value={nuovaCatCostoNome}
                    onChange={(e) => setNuovaCatCostoNome(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unità Predefinita</label>
                  <input
                    type="text"
                    maxLength={24}
                    placeholder="servizio / ora / km"
                    value={nuovaCatCostoUnita}
                    onChange={(e) => setNuovaCatCostoUnita(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrizione (opzionale)</label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="Breve nota sulla categoria"
                    value={nuovaCatCostoDesc}
                    onChange={(e) => setNuovaCatCostoDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Crea</span>
                  </button>
                </div>
              </form>

              {/* Elenco categorie esistenti con Modifica ed Elimina */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {categorieCostiServizio.map((cat) => {
                  const countVoci = tariffeCostiServizio.filter((t) => (t.categoria || t.tipoVoce) === cat.id).length;
                  const isEditing = editingCatCostoId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-7">
                              <label className="block text-[10px] font-bold text-amber-300 uppercase mb-0.5">Nome Categoria *</label>
                              <input
                                type="text"
                                value={editingCatCostoNome}
                                onChange={(e) => setEditingCatCostoNome(e.target.value)}
                                className="w-full p-2 rounded-lg bg-slate-950 border border-amber-500/60 text-white focus:outline-none"
                              />
                            </div>
                            <div className="sm:col-span-5">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Unità Default</label>
                              <input
                                type="text"
                                value={editingCatCostoUnita}
                                onChange={(e) => setEditingCatCostoUnita(e.target.value)}
                                className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Descrizione</label>
                            <input
                              type="text"
                              value={editingCatCostoDesc}
                              onChange={(e) => setEditingCatCostoDesc(e.target.value)}
                              placeholder="Opzionale"
                              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingCatCostoId(null)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                            >
                              Annulla
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSalvaModificaCategoriaCosto(cat.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Salva</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-white truncate">{cat.nome}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-amber-300">
                                / {cat.unitaDefault || 'servizio'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-700/50 text-[10px] font-bold text-purple-300">
                                {countVoci} {countVoci === 1 ? 'voce' : 'voci'}
                              </span>
                            </div>
                            {cat.descrizione && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{cat.descrizione}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatCostoId(cat.id);
                                setEditingCatCostoNome(cat.nome);
                                setEditingCatCostoUnita(cat.unitaDefault || 'servizio');
                                setEditingCatCostoDesc(cat.descrizione || '');
                                setConfermaEliminaCatCostoId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Modifica categoria"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Modifica</span>
                            </button>
                            {confermaEliminaCatCostoId === cat.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEliminaCategoriaCosto(cat.id)}
                                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  Elimina
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfermaEliminaCatCostoId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px] cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={categorieCostiServizio.length <= 1}
                                onClick={() => setConfermaEliminaCatCostoId(cat.id)}
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  categorieCostiServizio.length <= 1
                                    ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                    : 'bg-red-950/70 hover:bg-red-900 text-red-400 hover:text-white border-red-800/60'
                                }`}
                                title={categorieCostiServizio.length <= 1 ? 'Deve rimanere almeno una categoria' : 'Elimina categoria'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          )}

          {/* Form Aggiunta / Modifica Voce Tariffaria */}
          <form onSubmit={handleSalvaTariffaCosto} className="bg-slate-950 p-4 rounded-2xl border border-purple-500/40 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <span>{editingTariffaId ? 'Modifica Voce Tariffaria Selezionata' : 'Aggiungi Nuova Voce / Tariffa di Servizio'}</span>
              </span>
              {editingTariffaId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTariffaId(null);
                    setFormTariffaSigla('');
                    setFormTariffaDescrizioneSigla('');
                    setFormTariffaNome('');
                    setFormTariffaImporto('0');
                    const defCat = categorieCostiServizio.find((c) => c.id === formTariffaCategoria) || categorieCostiServizio[0];
                    setFormTariffaUnita(defCat?.unitaDefault || 'servizio');
                    setFormTariffaNote('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Annulla modifica
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria Costo *</label>
                <select
                  value={formTariffaCategoria}
                  onChange={(e) => {
                    const c = e.target.value;
                    setFormTariffaCategoria(c);
                    if (!editingTariffaId) {
                      const catObj = categorieCostiServizio.find((item) => item.id === c);
                      setFormTariffaUnita(catObj?.unitaDefault || 'servizio');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-500 focus:outline-none"
                >
                  {categorieCostiServizio.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campi affiancati: Sigla breve + Descrizione della sigla */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-amber-300 uppercase mb-1">Sigla Breve *</label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="es. KM-AMB"
                  value={formTariffaSigla}
                  onChange={(e) => setFormTariffaSigla(e.target.value.toUpperCase())}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 font-mono font-black uppercase focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[10px] font-bold text-amber-300 uppercase mb-1">Descrizione della Sigla *</label>
                <input
                  type="text"
                  required
                  placeholder="es. Tariffa chilometrica percorrenza ambulanza"
                  value={formTariffaDescrizioneSigla}
                  onChange={(e) => setFormTariffaDescrizioneSigla(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Voce in Tabella *</label>
                <input
                  type="text"
                  required
                  placeholder="es. Costo Mezzo al KM"
                  value={formTariffaNome}
                  onChange={(e) => setFormTariffaNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Importo Unitario (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formTariffaImporto}
                  onChange={(e) => setFormTariffaImporto(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unità Misura *</label>
                <input
                  type="text"
                  required
                  placeholder="km / ora / uscita"
                  value={formTariffaUnita}
                  onChange={(e) => setFormTariffaUnita(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Note Applicative (opzionale)</label>
                <input
                  type="text"
                  placeholder="Eventuali annotazioni contrattuali"
                  value={formTariffaNote}
                  onChange={(e) => setFormTariffaNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingTariffaId ? 'Aggiorna Voce' : 'Salva Voce Costo'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Tabella Costi di Servizio */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Sigla Breve &rarr; Descrizione della Sigla</th>
                    <th className="py-3 px-4">Nome Voce</th>
                    <th className="py-3 px-4 font-mono">Importo / Unità</th>
                    <th className="py-3 px-4">Stato</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tariffeCostiServizio
                    .filter((t) => filtroCategoriaTariffa === 'tutti' || (t.categoria || t.tipoVoce) === filtroCategoriaTariffa)
                    .map((t) => {
                      const catEff = t.categoria || t.tipoVoce || 'editabile';
                      const isAct = t.attiva ?? t.attivo ?? true;
                      return (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-bold uppercase text-purple-300">
                            {getNomeCategoriaCosto(catEff, categorieCostiServizio)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                              {t.siglaBreve}
                            </span>
                            <span className="text-slate-200 font-medium">{t.descrizioneSigla}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{t.nomeVoce}</div>
                          {t.note && <div className="text-[10px] text-slate-400 italic">{t.note}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-emerald-400">
                          € {t.importoUnitario.toFixed(2)} <span className="text-slate-400 text-[10px]">/ {t.unitaMisura}</span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              salvaTariffeCostiServizio(
                                tariffeCostiServizio.map((x) => (x.id === t.id ? { ...x, attiva: !isAct, attivo: !isAct } : x))
                              )
                            }
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase cursor-pointer border ${
                              isAct
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                                : 'bg-slate-900 text-slate-500 border-slate-700'
                            }`}
                          >
                            {isAct ? 'Attiva' : 'Disattivata'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTariffaId(t.id);
                                setFormTariffaCategoria(catEff);
                                setFormTariffaSigla(t.siglaBreve);
                                setFormTariffaDescrizioneSigla(t.descrizioneSigla);
                                setFormTariffaNome(t.nomeVoce);
                                setFormTariffaImporto(String(t.importoUnitario));
                                setFormTariffaUnita(t.unitaMisura);
                                setFormTariffaNote(t.note || '');
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Modifica</span>
                            </button>

                            {confermaEliminaTariffaId === t.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    salvaTariffeCostiServizio(tariffeCostiServizio.filter((x) => x.id !== t.id));
                                    setConfermaEliminaTariffaId(null);
                                    mostraAvviso(`Voce ${t.siglaBreve} rimossa.`);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  Conferma
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfermaEliminaTariffaId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px] cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfermaEliminaTariffaId(t.id)}
                                className="p-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-400 hover:text-white border border-red-800/60 cursor-pointer"
                                title="Elimina voce tariffaria"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
      {/* 6. SOTTO-TAB: COORDINATE BANCARIE & POSTALI + ULTERIORI METODI        */}
      {/* ===================================================================== */}
      {sottoTab === 'contiCorrenti' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-slate-900 p-5 rounded-3xl border border-yellow-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-yellow-500 text-slate-950">
                  Tesoreria Ufficiale Ente ETS
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  C.F. 92035360459 • Collegati a Note di Debito & Donazioni
                </span>
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                <Landmark className="w-5 h-5 text-yellow-400" />
                <span>Coordinate Bancarie, Postali & Metodi di Ricezione</span>
              </h3>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                Riferimenti ufficiali dell'Organizzazione di Volontariato e configurazione centralizzata di ulteriori metodi di ricezione donazioni e pagamenti collegati a tutto il gestionale.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* CONTO 1: POSTE ITALIANE */}
            <div className="bg-slate-950 rounded-3xl border-2 border-yellow-500/50 p-5 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-lg">
                    🟡
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                      Conto Corrente Postale
                    </span>
                    <h4 className="text-lg font-black text-white">{bancaPoste}</h4>
                    <span className="text-xs text-slate-400">BancoPosta Impresa • Circuito Postale & SEPA</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold text-yellow-300 bg-yellow-950/70 px-2.5 py-1 rounded-xl border border-yellow-600/40 font-mono">
                  Attivo
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 font-bold block">Intestatario Ufficiale:</span>
                  <span className="text-sm font-black text-white">{intestatarioUfficiale}</span>
                </div>

                <div className="p-3 rounded-2xl bg-yellow-950/30 border border-yellow-500/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-300 font-bold uppercase text-[11px]">Numero C/C Postale:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(ccPostale).catch(() => {});
                        setIbanCopiatoFeedback(ccPostale);
                        mostraAvviso(`Copiato C/C Postale: ${ccPostale}`);
                        setTimeout(() => setIbanCopiatoFeedback(null), 2500);
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-yellow-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{ibanCopiatoFeedback === ccPostale ? 'Copiato!' : 'Copia C/C'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-base font-black text-yellow-400 select-all">{ccPostale}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900 border-2 border-yellow-500/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold uppercase text-[11px]">Codice IBAN Ufficiale:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(ibanPoste).catch(() => {});
                        setIbanCopiatoFeedback(ibanPoste);
                        mostraAvviso(`Copiato IBAN Poste Italiane: ${ibanPoste}`);
                        setTimeout(() => setIbanCopiatoFeedback(null), 2500);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{ibanCopiatoFeedback === ibanPoste ? 'Copiato!' : 'Copia IBAN'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-sm font-black text-white bg-slate-950 p-2.5 rounded-xl border border-slate-800 select-all break-all text-center">
                    {ibanPoste}
                  </div>
                </div>
              </div>
            </div>

            {/* CONTO 2: CREDIT AGRICOLE */}
            <div className="bg-slate-950 rounded-3xl border-2 border-emerald-500/50 p-5 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-lg">
                    🏛️
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                      Conto Corrente Bancario
                    </span>
                    <h4 className="text-lg font-black text-white">{bancaCreditAgricole}</h4>
                    <span className="text-xs text-slate-400">Circuito Bancario SEPA • Tesoreria Centrale</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-950/70 px-2.5 py-1 rounded-xl border border-emerald-700/50 font-mono">
                  Attivo
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 font-bold block">Intestatario Ufficiale:</span>
                  <span className="text-sm font-black text-white">{intestatarioUfficiale}</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-slate-300 leading-relaxed">
                  Conto bancario principale per bonifici SEPA, convenzioni sanitarie ASL, contributi enti e donazioni liberali.
                </div>

                <div className="p-3 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold uppercase text-[11px]">Codice IBAN Ufficiale:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(ibanCreditAgricole).catch(() => {});
                        setIbanCopiatoFeedback(ibanCreditAgricole);
                        mostraAvviso(`Copiato IBAN Credit Agricole: ${ibanCreditAgricole}`);
                        setTimeout(() => setIbanCopiatoFeedback(null), 2500);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{ibanCopiatoFeedback === ibanCreditAgricole ? 'Copiato!' : 'Copia IBAN'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-sm font-black text-white bg-slate-950 p-2.5 rounded-xl border border-slate-800 select-all break-all text-center">
                    {ibanCreditAgricole}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <GestioneMetodiPagamentoCustomPanel
            operatoreCorrente={operatoreCorrente}
            isAdmin={isAdmin}
            onNotificaRadio={onNotificaRadio}
            onAvviso={mostraAvviso}
            intestatarioDefault={intestatarioUfficiale}
            fonteSezione="Contabilità — Coordinate Bancarie & Postali"
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. SOTTO-TAB: ALTRE ENTRATE / USCITE                                  */}
      {/* ===================================================================== */}
      {sottoTab === 'altreEntrateUscite' && (() => {
        const vociFiltrate = listaAltreEntrateUscite
          .filter((v) => {
            if (filtroAltreTipo !== 'tutti' && v.tipo !== filtroAltreTipo) return false;
            if (filtroAltreMese && !String(v.data || '').startsWith(filtroAltreMese)) return false;
            if (ricercaAltre.trim()) {
              const q = ricercaAltre.trim().toLowerCase();
              const hay = [v.descrizione, v.categoria, v.controparte, v.riferimentoDocumento, v.metodoPagamento, v.note, v.data]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          })
          .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

        const totEntrateAltre = vociFiltrate.filter((v) => v.tipo === 'entrata').reduce((s, v) => s + (Number(v.importo) || 0), 0);
        const totUsciteAltre = vociFiltrate.filter((v) => v.tipo === 'uscita').reduce((s, v) => s + (Number(v.importo) || 0), 0);
        const saldoAltre = totEntrateAltre - totUsciteAltre;

        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-slate-400">Totale Altre Entrate</span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">+€ {totEntrateAltre.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Incluse nel Prospetto Mensile Commercialista</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/30">
                <span className="text-[10px] uppercase font-bold text-slate-400">Totale Altre Uscite</span>
                <div className="text-xl font-black text-rose-400 font-mono mt-0.5">-€ {totUsciteAltre.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Incluse nel Prospetto Mensile Commercialista</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Netto Sezione</span>
                <div className={`text-xl font-black font-mono mt-0.5 ${saldoAltre >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                  {saldoAltre >= 0 ? '+' : ''}€ {saldoAltre.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">{vociFiltrate.length} movimenti visualizzati</span>
              </div>
            </div>

            {/* Form Inserimento / Modifica Manuale */}
            <form onSubmit={handleSalvaAltraEntrataUscita} className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-cyan-500/40 space-y-3.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-black text-white uppercase">
                    {editingAltraId ? 'Modifica Voce — Altre Entrate / Uscite' : 'Nuova Voce — Altre Entrate / Uscite'}
                  </h3>
                </div>
                {editingAltraId && (
                  <button
                    type="button"
                    onClick={resetFormAltreEntrateUscite}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                  >
                    Annulla Modifica
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipologia *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormAltraTipo('entrata')}
                      className={`py-2 rounded-xl font-black text-[11px] uppercase border cursor-pointer transition-all ${
                        formAltraTipo === 'entrata'
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      + Entrata
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAltraTipo('uscita')}
                      className={`py-2 rounded-xl font-black text-[11px] uppercase border cursor-pointer transition-all ${
                        formAltraTipo === 'uscita'
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      - Uscita
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={formAltraData}
                    onChange={(e) => setFormAltraData(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Importo (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formAltraImporto}
                    onChange={(e) => setFormAltraImporto(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria</label>
                  <input
                    type="text"
                    placeholder="es. 5x1000, Contributo, Rimborso..."
                    value={formAltraCategoria}
                    onChange={(e) => setFormAltraCategoria(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrizione Voce *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Contributo Comune, Rimborso spese evento, Acquisto attrezzatura straordinaria..."
                    value={formAltraDescrizione}
                    onChange={(e) => setFormAltraDescrizione(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Metodo Pagamento / Incasso</label>
                  <select
                    value={formAltraMetodo}
                    onChange={(e) => setFormAltraMetodo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Contanti">Contanti (Cassa Sede)</option>
                    <option value="POS / Carta">POS / Carta di Credito</option>
                    <option value={defaultMetodoNota}>Bonifico Bancario ({bancaCreditAgricole})</option>
                    <option value={`Bonifico Postale - ${bancaPoste} (IBAN: ${ibanPoste})`}>Conto Postale ({bancaPoste})</option>
                    {metodiPagamentoCustom.filter((m) => m.attivo).map((m) => {
                      const label = formattaEtichettaMetodoPagamento(m);
                      return <option key={m.id} value={label}>{label}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Soggetto / Controparte (Opzionale)</label>
                  <input
                    type="text"
                    placeholder="Ente, azienda o nominativo"
                    value={formAltraControparte}
                    onChange={(e) => setFormAltraControparte(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rif. Documento / Ricevuta</label>
                  <input
                    type="text"
                    placeholder="es. Fatt. 12/2026 o Delibera..."
                    value={formAltraRifDoc}
                    onChange={(e) => setFormAltraRifDoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Note</label>
                  <input
                    type="text"
                    placeholder="Eventuali annotazioni contabili..."
                    value={formAltraNote}
                    onChange={(e) => setFormAltraNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingAltraId ? 'Salva Modifiche' : 'Registra Movimento'}</span>
                </button>
              </div>
            </form>

            {/* Filtri e Tabella Altre Entrate / Uscite */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={ricercaAltre}
                  onChange={(e) => setRicercaAltre(e.target.value)}
                  placeholder="Cerca descrizione, categoria, controparte..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <input
                type="month"
                value={filtroAltreMese}
                onChange={(e) => setFiltroAltreMese(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              />
              <select
                value={filtroAltreTipo}
                onChange={(e) => setFiltroAltreTipo(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              >
                <option value="tutti">Tutte (Entrate & Uscite)</option>
                <option value="entrata">Solo Entrate</option>
                <option value="uscita">Solo Uscite</option>
              </select>
              {(filtroAltreMese || filtroAltreTipo !== 'tutti' || ricercaAltre) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroAltreMese('');
                    setFiltroAltreTipo('tutti');
                    setRicercaAltre('');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Azzera Filtri
                </button>
              )}
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                      <th className="py-3 px-4">Data & Tipo</th>
                      <th className="py-3 px-4">Descrizione & Categoria</th>
                      <th className="py-3 px-4">Controparte / Doc</th>
                      <th className="py-3 px-4">Metodo</th>
                      <th className="py-3 px-4 font-mono">Importo</th>
                      <th className="py-3 px-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {vociFiltrate.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Nessuna voce registrata in Altre Entrate / Uscite. Usa il modulo sopra per inserire entrate o uscite manuali.
                        </td>
                      </tr>
                    ) : (
                      vociFiltrate.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-white">{v.data}</div>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              v.tipo === 'entrata'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            }`}>
                              {v.tipo === 'entrata' ? '+ Entrata' : '- Uscita'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{v.descrizione}</div>
                            <div className="text-[11px] text-cyan-300">{v.categoria || 'Generale'}</div>
                            {v.note && <div className="text-[10px] text-slate-400 mt-0.5">{v.note}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-200">{v.controparte || '-'}</div>
                            {v.riferimentoDocumento && <div className="text-[10px] text-slate-400 font-mono">Doc: {v.riferimentoDocumento}</div>}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate">{v.metodoPagamento}</td>
                          <td className={`py-3 px-4 font-mono font-black text-sm ${v.tipo === 'entrata' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {v.tipo === 'entrata' ? '+' : '-'}€ {Number(v.importo || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAltraId(v.id);
                                  setFormAltraData(v.data);
                                  setFormAltraTipo(v.tipo);
                                  setFormAltraDescrizione(v.descrizione);
                                  setFormAltraCategoria(v.categoria || '');
                                  setFormAltraImporto(String(v.importo));
                                  setFormAltraMetodo(v.metodoPagamento || 'Contanti');
                                  setFormAltraControparte(v.controparte || '');
                                  setFormAltraRifDoc(v.riferimentoDocumento || '');
                                  setFormAltraNote(v.note || '');
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                                title="Modifica voce"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {confermaEliminaAltraId === v.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEliminaAltraEntrataUscita(v.id)}
                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                  >
                                    Conferma
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfermaEliminaAltraId(null)}
                                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfermaEliminaAltraId(v.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 cursor-pointer"
                                  title="Elimina voce"
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
        );
      })()}

      {/* ===================================================================== */}
      {/* 8. SOTTO-TAB: COSTI DI GESTIONE                                       */}
      {/* ===================================================================== */}
      {sottoTab === 'costiGestione' && (() => {
        const vociFiltrate = listaCostiGestione
          .filter((v) => {
            if (filtroGestioneTipo !== 'tutti' && v.tipo !== filtroGestioneTipo) return false;
            if (filtroGestioneCategoria !== 'tutte' && v.categoria !== filtroGestioneCategoria) return false;
            if (filtroGestioneMese && !String(v.data || '').startsWith(filtroGestioneMese)) return false;
            if (ricercaGestione.trim()) {
              const q = ricercaGestione.trim().toLowerCase();
              const hay = [v.descrizione, v.categoria, v.fornitore, v.numeroDocumento, v.metodoPagamento, v.note, v.data]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          })
          .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

        const totUsciteGestione = vociFiltrate.filter((v) => v.tipo !== 'entrata').reduce((s, v) => s + (Number(v.importo) || 0), 0);
        const totEntrateGestione = vociFiltrate.filter((v) => v.tipo === 'entrata').reduce((s, v) => s + (Number(v.importo) || 0), 0);
        const nettoGestione = totEntrateGestione - totUsciteGestione;

        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/30">
                <span className="text-[10px] uppercase font-bold text-slate-400">Totale Costi di Gestione (Uscite)</span>
                <div className="text-xl font-black text-rose-400 font-mono mt-0.5">-€ {totUsciteGestione.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Inclusi nel Prospetto Mensile Commercialista</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-slate-400">Rimborsi / Storni / Entrate Gestione</span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">+€ {totEntrateGestione.toFixed(2)}</div>
                <span className="text-[10px] text-slate-500">Inclusi nel Prospetto Mensile Commercialista</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Impatto Netto Gestione</span>
                <div className={`text-xl font-black font-mono mt-0.5 ${nettoGestione >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {nettoGestione >= 0 ? '+' : ''}€ {nettoGestione.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">{vociFiltrate.length} voci visualizzate</span>
              </div>
            </div>

            {/* Form Inserimento / Modifica Manuale Costo di Gestione */}
            <form onSubmit={handleSalvaCostoGestione} className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-rose-500/40 space-y-3.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-black text-white uppercase">
                    {editingGestioneId ? 'Modifica Voce — Costi di Gestione' : 'Nuova Voce — Costi di Gestione'}
                  </h3>
                </div>
                {editingGestioneId && (
                  <button
                    type="button"
                    onClick={resetFormCostiGestione}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                  >
                    Annulla Modifica
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipologia *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormGestioneTipo('uscita')}
                      className={`py-2 rounded-xl font-black text-[11px] uppercase border cursor-pointer transition-all ${
                        formGestioneTipo === 'uscita'
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      - Costo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormGestioneTipo('entrata')}
                      className={`py-2 rounded-xl font-black text-[11px] uppercase border cursor-pointer transition-all ${
                        formGestioneTipo === 'entrata'
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      + Entrata
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={formGestioneData}
                    onChange={(e) => setFormGestioneData(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Importo (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formGestioneImporto}
                    onChange={(e) => setFormGestioneImporto(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria Costo *</label>
                  <select
                    value={formGestioneCategoria}
                    onChange={(e) => setFormGestioneCategoria(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    {CATEGORIE_COSTI_GESTIONE.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrizione *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Bolletta energia elettrica sede Massa, Polizza RC Volontari, Canone POS..."
                    value={formGestioneDescrizione}
                    onChange={(e) => setFormGestioneDescrizione(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Metodo di Pagamento</label>
                  <select
                    value={formGestioneMetodo}
                    onChange={(e) => setFormGestioneMetodo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value={defaultMetodoNota}>Bonifico Bancario ({bancaCreditAgricole})</option>
                    <option value={`Bonifico Postale - ${bancaPoste} (IBAN: ${ibanPoste})`}>Conto Postale ({bancaPoste})</option>
                    <option value="Contanti">Contanti (Cassa Sede)</option>
                    <option value="POS / Carta">Carta / Addebito SDD</option>
                    {metodiPagamentoCustom.filter((m) => m.attivo).map((m) => {
                      const label = formattaEtichettaMetodoPagamento(m);
                      return <option key={m.id} value={label}>{label}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fornitore / Ente (Opzionale)</label>
                  <input
                    type="text"
                    placeholder="es. Enel, TIM, UnipolSai..."
                    value={formGestioneFornitore}
                    onChange={(e) => setFormGestioneFornitore(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">N. Fattura / Documento</label>
                  <input
                    type="text"
                    placeholder="es. FT-2026-045"
                    value={formGestioneNumDoc}
                    onChange={(e) => setFormGestioneNumDoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Note</label>
                  <input
                    type="text"
                    placeholder="Dettagli o periodo di riferimento..."
                    value={formGestioneNote}
                    onChange={(e) => setFormGestioneNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingGestioneId ? 'Salva Modifiche' : 'Registra Costo di Gestione'}</span>
                </button>
              </div>
            </form>

            {/* Filtri e Tabella Costi di Gestione */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={ricercaGestione}
                  onChange={(e) => setRicercaGestione(e.target.value)}
                  placeholder="Cerca descrizione, fornitore, documento..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <input
                type="month"
                value={filtroGestioneMese}
                onChange={(e) => setFiltroGestioneMese(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              />
              <select
                value={filtroGestioneCategoria}
                onChange={(e) => setFiltroGestioneCategoria(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              >
                <option value="tutte">Tutte le Categorie</option>
                {CATEGORIE_COSTI_GESTIONE.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={filtroGestioneTipo}
                onChange={(e) => setFiltroGestioneTipo(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
              >
                <option value="tutti">Costi & Rimborsi</option>
                <option value="uscita">Solo Costi (Uscite)</option>
                <option value="entrata">Solo Entrate / Rimborsi</option>
              </select>
              {(filtroGestioneMese || filtroGestioneCategoria !== 'tutte' || filtroGestioneTipo !== 'tutti' || ricercaGestione) && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroGestioneMese('');
                    setFiltroGestioneCategoria('tutte');
                    setFiltroGestioneTipo('tutti');
                    setRicercaGestione('');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Azzera Filtri
                </button>
              )}
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                      <th className="py-3 px-4">Data & Tipo</th>
                      <th className="py-3 px-4">Descrizione & Categoria</th>
                      <th className="py-3 px-4">Fornitore / Fattura</th>
                      <th className="py-3 px-4">Metodo</th>
                      <th className="py-3 px-4 font-mono">Importo</th>
                      <th className="py-3 px-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {vociFiltrate.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Nessuna voce registrata in Costi di Gestione. Usa il modulo sopra per inserire i costi associativi.
                        </td>
                      </tr>
                    ) : (
                      vociFiltrate.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-white">{v.data}</div>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              v.tipo === 'entrata'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            }`}>
                              {v.tipo === 'entrata' ? '+ Entrata' : '- Costo'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-white">{v.descrizione}</span>
                              {(v.rifornimentoId || v.origineAutomatica === 'rifornimento_carburante') && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9.5px] font-black uppercase"
                                  title="Registrato automaticamente dal modulo Rifornimenti Carburante (contabilizzato una sola volta nella colonna Carburante del Prospetto Commercialista)"
                                >
                                  ⛽ Auto da Rifornimento
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-rose-300">{v.categoria}</div>
                            {v.note && <div className="text-[10px] text-slate-400 mt-0.5">{v.note}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-200">{v.fornitore || '-'}</div>
                            {v.numeroDocumento && <div className="text-[10px] text-slate-400 font-mono">Doc: {v.numeroDocumento}</div>}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate">{v.metodoPagamento}</td>
                          <td className={`py-3 px-4 font-mono font-black text-sm ${v.tipo === 'entrata' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {v.tipo === 'entrata' ? '+' : '-'}€ {Number(v.importo || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGestioneId(v.id);
                                  setFormGestioneData(v.data);
                                  setFormGestioneTipo(v.tipo || 'uscita');
                                  setFormGestioneDescrizione(v.descrizione);
                                  setFormGestioneCategoria(v.categoria || 'Altro Costo di Gestione');
                                  setFormGestioneImporto(String(v.importo));
                                  setFormGestioneMetodo(v.metodoPagamento || defaultMetodoNota);
                                  setFormGestioneFornitore(v.fornitore || '');
                                  setFormGestioneNumDoc(v.numeroDocumento || '');
                                  setFormGestioneNote(v.note || '');
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                                title="Modifica voce"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {confermaEliminaGestioneId === v.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEliminaCostoGestione(v.id)}
                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                  >
                                    Conferma
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfermaEliminaGestioneId(null)}
                                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfermaEliminaGestioneId(v.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 cursor-pointer"
                                  title="Elimina voce"
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
        );
      })()}

      {/* ===================================================================== */}
      {/* 9. SOTTO-TAB: EMISSIONE RICEVUTE                                      */}
      {/* ===================================================================== */}
      {sottoTab === 'ricevute' && (() => {
        const ricevuteValide = listaRicevute.filter((r) => r.stato !== 'Annullata');
        const ricevuteAnnullate = listaRicevute.filter((r) => r.stato === 'Annullata');
        const totaleRicevuteValide = ricevuteValide.reduce((acc, r) => acc + Number(r.importoTotale || 0), 0);

        const q = ricercaRicevute.trim().toLowerCase();
        const ricevuteFiltrate = listaRicevute.filter((r) => {
          if (filtroStatoRicevuta !== 'tutte' && r.stato !== filtroStatoRicevuta) return false;
          if (!q) return true;
          return (
            (r.numeroProgressivo || '').toLowerCase().includes(q) ||
            (r.intestatario || '').toLowerCase().includes(q) ||
            (r.codiceFiscalePartitaIva || '').toLowerCase().includes(q) ||
            (r.emailDestinatario || '').toLowerCase().includes(q) ||
            (r.pecDestinatario || '').toLowerCase().includes(q) ||
            (r.causale || '').toLowerCase().includes(q) ||
            (r.tipologia || '').toLowerCase().includes(q) ||
            (r.codiceServizioRiferimento || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-4">
            {/* KPI Ricevute */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Totale Ricevute Emesse (Valide)</span>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                    € {totaleRicevuteValide.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Ricevute Valide in Archivio</span>
                  <div className="text-xl font-black text-white font-mono mt-0.5">{ricevuteValide.length}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Ricevute Annullate</span>
                  <div className="text-xl font-black text-rose-400 font-mono mt-0.5">{ricevuteAnnullate.length}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Header & Pulsante Nuova Ricevuta */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Registro Emissione Ricevute Ufficiali</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Emissione ricevute numerate per erogazioni liberali, rimborsi spese, contributi associativi e quietanze (con acquisizione obbligatoria di Email e PEC o dichiarazione di non possesso).
                </p>
              </div>

              <button
                type="button"
                onClick={apriModaleNuovaRicevuta}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Emetti Nuova Ricevuta</span>
              </button>
            </div>

            {/* Ricerca e Filtri */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ricercaRicevute}
                  onChange={(e) => setRicercaRicevute(e.target.value)}
                  placeholder="Cerca per numero, intestatario, CF/P.IVA, Email, PEC o causale..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {(['tutte', 'Emessa', 'Annullata'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFiltroStatoRicevuta(st)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase cursor-pointer border transition-colors ${
                      filtroStatoRicevuta === st
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {st === 'tutte' ? 'Tutte' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Barra Selezione Multipla PDF Ricevute */}
            {selectedRicevuteIds.length > 0 && (
              <div className="bg-indigo-950/60 border-2 border-indigo-500/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
                  <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    <strong>{selectedRicevuteIds.length}</strong> ricevuta/e selezionata/e
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRicevuteIds([])}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Deseleziona
                  </button>
                  <button
                    type="button"
                    disabled={batchPdfInCorso}
                    onClick={() => handleBatchPdfRicevute('download')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Scarica PDF ({selectedRicevuteIds.length})</span>
                  </button>
                  <button
                    type="button"
                    disabled={batchPdfInCorso}
                    onClick={() => handleBatchPdfRicevute('print')}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Stampa PDF ({selectedRicevuteIds.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tabella Ricevute Emesse */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                      <th className="py-3 px-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelezionaTutteRicevute(ricevuteFiltrate.map((r) => r.id))}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          title="Seleziona tutte le ricevute visibili per download/stampa PDF"
                        >
                          {ricevuteFiltrate.length > 0 && ricevuteFiltrate.every((r) => selectedRicevuteIds.includes(r.id)) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Numero & Data</th>
                      <th className="py-3 px-4">Tipologia</th>
                      <th className="py-3 px-4">Intestatario, Email & PEC</th>
                      <th className="py-3 px-4">Causale</th>
                      <th className="py-3 px-4 font-mono">Importo (€)</th>
                      <th className="py-3 px-4">Incasso</th>
                      <th className="py-3 px-4">Stato</th>
                      <th className="py-3 px-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {ricevuteFiltrate.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-500 text-xs">
                          Nessuna ricevuta emessa corrispondente ai filtri selezionati. Clicca su <strong>Emetti Nuova Ricevuta</strong> per iniziare.
                        </td>
                      </tr>
                    ) : (
                      ricevuteFiltrate.map((r) => {
                        const isAnnullata = r.stato === 'Annullata';
                        const isSelected = selectedRicevuteIds.includes(r.id);
                        return (
                          <tr key={r.id} className={`transition-colors ${isSelected ? 'bg-indigo-950/25' : isAnnullata ? 'bg-rose-950/15 opacity-75' : 'hover:bg-slate-900/50'}`}>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSelezionaRicevuta(r.id)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                                title="Seleziona ricevuta per download/stampa PDF"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 font-mono font-black text-amber-400 whitespace-nowrap">
                              <div className={isAnnullata ? 'line-through text-rose-400' : ''}>{r.numeroProgressivo}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{r.dataEmissione}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-bold">
                                {r.tipologia}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-white text-sm">{r.intestatario}</div>
                              {r.codiceFiscalePartitaIva && (
                                <div className="text-[11px] text-slate-400 font-mono">CF/P.IVA: {r.codiceFiscalePartitaIva}</div>
                              )}
                              {r.indirizzoIntestatario && (
                                <div className="text-[10px] text-slate-500">{r.indirizzoIntestatario}</div>
                              )}
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                                {r.emailNonDisponibile ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                                    Email: Non in possesso
                                  </span>
                                ) : r.emailDestinatario ? (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                                    ✉ {r.emailDestinatario}
                                  </span>
                                ) : null}
                                {r.pecNonDisponibile ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/50 text-amber-300 font-semibold">
                                    PEC: Non in possesso
                                  </span>
                                ) : r.pecDestinatario ? (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-600/50 text-indigo-300 font-mono">
                                    PEC: {r.pecDestinatario}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-300 max-w-xs">
                              <div>{r.causale}</div>
                              {r.codiceServizioRiferimento && (
                                <div className="text-[10px] text-purple-300 font-mono mt-0.5">Rif: {r.codiceServizioRiferimento}</div>
                              )}
                            </td>
                            <td className={`py-3 px-4 font-mono font-black text-sm whitespace-nowrap ${isAnnullata ? 'text-rose-400 line-through' : 'text-emerald-400'}`}>
                              € {Number(r.importoTotale || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-slate-300 text-[11px] max-w-[180px]">
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-semibold">
                                {r.metodoPagamento}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                isAnnullata
                                  ? 'bg-rose-950 text-rose-300 border-rose-700/60'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                              }`}>
                                {r.stato}
                              </span>
                              {isAnnullata && r.motivoAnnullamento && (
                                <div className="text-[10px] text-rose-300/80 mt-0.5 max-w-[160px]">{r.motivoAnnullamento}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDocumentoPerStampa({ tipo: 'ricevuta', data: r })}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-purple-700 text-slate-200 hover:text-white font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Anteprima e Stampa Ricevuta PDF"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Stampa</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    scaricaRicevutaContabilePDF(r, getTesoriereAttivo(volontari));
                                    mostraAvviso(`PDF Ricevuta ${r.numeroProgressivo} scaricato.`);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-700 text-emerald-400 hover:text-white cursor-pointer transition-colors"
                                  title="Scarica subito PDF Ricevuta"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                {!isAnnullata && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRicevutaDaAnnullare(r);
                                      setMotivoAnnullamentoRicevuta('Errore di compilazione / emissione duplicata');
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-700 text-amber-400 hover:text-white cursor-pointer transition-colors"
                                    title="Annulla Ricevuta"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {confermaEliminaRicevutaId === r.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEliminaRicevuta(r.id)}
                                      className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase cursor-pointer"
                                    >
                                      Conferma
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfermaEliminaRicevutaId(null)}
                                      className="px-1.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfermaEliminaRicevutaId(r.id)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 cursor-pointer transition-colors"
                                    title="Elimina ricevuta dall'archivio"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
        );
      })()}

      {/* ===================================================================== */}
      {/* 10. SOTTO-TAB: SCADENZE FISCALI ODV & NOTIFICHE AUTOMATICHE           */}
      {/* ===================================================================== */}
      {sottoTab === 'scadenzeFiscali' && canShowSubtab('scadenzeFiscali') && (
        <PannelloScadenzeFiscaliOdv
          volontari={volontari}
          puoModificarePreavviso={Boolean(puoModificarePreavvisoFiscale || isAdmin)}
          isAdmin={isAdmin}
          operatoreNome={operatoreCorrente}
          onNotificaRadio={(msg) => onNotificaRadio?.(msg, 'sistema')}
        />
      )}

      {/* MODALE EMISSIONE NUOVA RICEVUTA CONTABILE */}
      {modaleNuovaRicevutaAperta && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModaleNuovaRicevutaAperta(false);
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fisso */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/50 text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                    Emetti Nuova Ricevuta Ufficiale
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Compila i dati dell'intestatario inclusi Email e PEC (o dichiara il non possesso)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaRicevutaAperta(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi finestra (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Scrollabile */}
            <form onSubmit={handleEmettiRicevutaContabile} className="flex flex-col flex-1 min-h-0 mt-3">
              <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3.5 text-xs py-1 overscroll-contain">
                {/* Tipologia, Data e Importo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Tipologia Ricevuta *</label>
                    <select
                      value={formRicTipologia}
                      onChange={(e) => setFormRicTipologia(e.target.value as RicevutaContabile['tipologia'])}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Erogazione Liberale / Donazione">Erogazione Liberale / Donazione</option>
                      <option value="Rimborso Spese">Rimborso Spese</option>
                      <option value="Contributo Associativo / Evento">Contributo Associativo / Evento</option>
                      <option value="Quietanza di Pagamento">Quietanza di Pagamento</option>
                      <option value="Altra Ricevuta">Altra Ricevuta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Data Emissione *</label>
                    <input
                      type="date"
                      required
                      value={formRicData}
                      onChange={(e) => setFormRicData(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Importo (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formRicImporto}
                      onChange={(e) => setFormRicImporto(e.target.value)}
                      placeholder="es. 50.00"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-black focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Auto-compilazione da Contatti */}
                {contatti && contatti.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-300 mb-1 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Auto-compila da Rubrica Contatti (Opzionale)</span>
                    </label>
                    <select
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (!cid) return;
                        const sel = contatti.find((c) => c.id === cid);
                        if (sel) {
                          setFormRicIntestatario(sel.ragioneSociale);
                          setFormRicCfPiva(sel.partitaIvaCodiceFiscale || '');
                          setFormRicIndirizzo(`${sel.indirizzo || ''}, ${sel.cap || ''} ${sel.citta || ''} (${sel.provincia || ''})`.replace(/^,\s*/, '').replace(/\(\)/g, '').trim());
                          setFormRicEmail(sel.email || '');
                          setFormRicEmailNonDisponibile(false);
                          setFormRicPec(sel.pec || '');
                          setFormRicPecNonDisponibile(false);
                        }
                      }}
                      className="w-full p-2 rounded-xl bg-emerald-950/35 border border-emerald-500/45 text-emerald-200 text-xs font-semibold focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="">⚡ Seleziona da Contatti Fornitori / Clienti / Enti...</option>
                      {contatti.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.tipo.toUpperCase()}] {c.ragioneSociale} — CF/P.IVA: {c.partitaIvaCodiceFiscale || 'N/D'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Intestatario & CF/P.IVA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Intestatario / Destinatario *</label>
                    <input
                      type="text"
                      required
                      value={formRicIntestatario}
                      onChange={(e) => setFormRicIntestatario(e.target.value)}
                      placeholder="Nome Cognome o Ragione Sociale"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Codice Fiscale / Partita IVA *</label>
                    <input
                      type="text"
                      required
                      value={formRicCfPiva}
                      onChange={(e) => setFormRicCfPiva(e.target.value.toUpperCase())}
                      placeholder="es. RSSMRA80A01F023K / 01234567890"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Indirizzo Residenza / Sede *</label>
                  <input
                    type="text"
                    required
                    value={formRicIndirizzo}
                    onChange={(e) => setFormRicIndirizzo(e.target.value)}
                    placeholder="Via, Civico, CAP, Comune e Provincia"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* RECAPITI OBBLIGATORI: EMAIL & PEC CON DICHIARAZIONE DI NON POSSESSO */}
                <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-3.5 space-y-3">
                  <div className="text-[11px] font-black uppercase text-emerald-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recapiti Elettronici Obbligatori (Email & PEC)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Indirizzo Email */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold">
                        Indirizzo Email {!formRicEmailNonDisponibile && <span className="text-rose-400">*</span>}
                      </label>
                      <input
                        type="email"
                        required={!formRicEmailNonDisponibile}
                        disabled={formRicEmailNonDisponibile}
                        value={formRicEmailNonDisponibile ? '' : formRicEmail}
                        onChange={(e) => setFormRicEmail(e.target.value)}
                        placeholder={formRicEmailNonDisponibile ? 'Dichiarato non in possesso' : 'es. nome@dominio.it'}
                        className={`w-full p-2.5 rounded-xl border text-white font-mono focus:outline-none ${
                          formRicEmailNonDisponibile
                            ? 'bg-slate-900/60 border-amber-500/40 text-amber-300/70 italic cursor-not-allowed'
                            : 'bg-slate-900 border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      <label className="flex items-start gap-2 cursor-pointer select-none p-2 rounded-xl bg-amber-950/25 border border-amber-500/35 hover:border-amber-400/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={formRicEmailNonDisponibile}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormRicEmailNonDisponibile(checked);
                            if (checked) setFormRicEmail('');
                          }}
                          className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-amber-200 leading-snug font-semibold">
                          Dichiaro di non essere in possesso dell'indirizzo Email al momento dell'emissione
                        </span>
                      </label>
                    </div>

                    {/* Indirizzo PEC */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold">
                        Indirizzo PEC {!formRicPecNonDisponibile && <span className="text-rose-400">*</span>}
                      </label>
                      <input
                        type="email"
                        required={!formRicPecNonDisponibile}
                        disabled={formRicPecNonDisponibile}
                        value={formRicPecNonDisponibile ? '' : formRicPec}
                        onChange={(e) => setFormRicPec(e.target.value)}
                        placeholder={formRicPecNonDisponibile ? 'Dichiarato non in possesso' : 'es. destinatario@pec.it'}
                        className={`w-full p-2.5 rounded-xl border text-white font-mono focus:outline-none ${
                          formRicPecNonDisponibile
                            ? 'bg-slate-900/60 border-amber-500/40 text-amber-300/70 italic cursor-not-allowed'
                            : 'bg-slate-900 border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      <label className="flex items-start gap-2 cursor-pointer select-none p-2 rounded-xl bg-amber-950/25 border border-amber-500/35 hover:border-amber-400/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={formRicPecNonDisponibile}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormRicPecNonDisponibile(checked);
                            if (checked) setFormRicPec('');
                          }}
                          className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-amber-200 leading-snug font-semibold">
                          Dichiaro di non essere in possesso dell'indirizzo PEC al momento dell'emissione
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Causale */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Causale / Descrizione Ricevuta *</label>
                  <textarea
                    rows={2}
                    required
                    value={formRicCausale}
                    onChange={(e) => setFormRicCausale(e.target.value)}
                    placeholder="es. Erogazione liberale a sostegno delle attività istituzionali di pubblica assistenza"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Metodo Pagamento & Rif. Servizio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Modalità di Incasso / Pagamento *</label>
                    <select
                      value={formRicMetodo}
                      onChange={(e) => setFormRicMetodo(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Contanti">Contanti (Brevi Manu)</option>
                      <option value={`Bonifico Bancario - ${bancaCreditAgricole} (IBAN: ${ibanCreditAgricole})`}>
                        Bonifico - {bancaCreditAgricole} ({ibanCreditAgricole})
                      </option>
                      <option value={`Bonifico / C/C Postale - ${bancaPoste} (IBAN: ${ibanPoste} / C/C ${ccPostale})`}>
                        Bonifico / C/C Postale - {bancaPoste} ({ibanPoste})
                      </option>
                      <option value="POS / Carta di Credito / Bancomat">POS / Carta / Bancomat</option>
                      <option value="Assegno Bancario / Circolare">Assegno Bancario / Circolare</option>
                      {metodiPerPagamenti.map((m) => {
                        const label = formattaEtichettaMetodoPagamento(m);
                        return (
                          <option key={m.id} value={label}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Riferimento Servizio (Opzionale)</label>
                    <input
                      type="text"
                      value={formRicRiferimento}
                      onChange={(e) => setFormRicRiferimento(e.target.value)}
                      placeholder="es. SRV-2026-042"
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Note Aggiuntive (Opzionale)</label>
                  <input
                    type="text"
                    value={formRicNote}
                    onChange={(e) => setFormRicNote(e.target.value)}
                    placeholder="Eventuali annotazioni riportate sulla ricevuta..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Footer Fisso */}
              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setModaleNuovaRicevutaAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Emetti & Registra Ricevuta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ANNULLAMENTO RICEVUTA CONTABILE */}
      {ricevutaDaAnnullare && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRicevutaDaAnnullare(null);
          }}
        >
          <div
            className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase">
                <Ban className="w-5 h-5" />
                <span>Annulla Ricevuta {ricevutaDaAnnullare.numeroProgressivo}</span>
              </div>
              <button
                type="button"
                onClick={() => setRicevutaDaAnnullare(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              La ricevuta intestata a <strong>{ricevutaDaAnnullare.intestatario}</strong> (€ {Number(ricevutaDaAnnullare.importoTotale || 0).toFixed(2)}) resterà in archivio con dicitura <strong>ANNULLATA</strong>.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Motivazione Annullamento</label>
              <input
                type="text"
                value={motivoAnnullamentoRicevuta}
                onChange={(e) => setMotivoAnnullamentoRicevuta(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRicevutaDaAnnullare(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={handleConfermaAnnullaRicevuta}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase cursor-pointer"
              >
                Conferma Annullamento
              </button>
            </div>
          </div>
        </div>
      )}

      {modaleNuovaDonazioneAperta && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModaleNuovaDonazioneAperta(false);
          }}
        >
          <div
            className="bg-slate-900 border-2 border-purple-500/50 rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400" />
                <h3 className="text-base font-black text-white uppercase tracking-wide">
                  Registra Donazione Economica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaDonazioneAperta(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi finestra (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegistraNuovaDonazione} className="flex flex-col flex-1 min-h-0 mt-3">
              <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3.5 text-xs py-1 overscroll-contain">
              {/* COLLEGAMENTO OPZIONALE A SERVIZIO GIÀ SVOLTO IN ARCHIVIO */}
              <div className="bg-slate-950/90 border border-purple-500/40 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase text-purple-300 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Collega a Servizio Svolto in Archivio (Opzionale)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {(serviziArchivio || []).length} in archivio
                  </span>
                </div>

                {(serviziArchivio || []).length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={ricercaServizioDonazione}
                      onChange={(e) => setRicercaServizioDonazione(e.target.value)}
                      placeholder="Filtra servizi in archivio per codice, data, mezzo, indirizzo o chiamante..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-[11px] placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                <select
                  value={formDonazioneServizioCollegatoId}
                  onChange={(e) => handleSelezionaServizioPerDonazione(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs cursor-pointer focus:border-purple-500 focus:outline-none"
                >
                  <option value="">-- Nessun servizio collegato (Donazione libera / manuale) --</option>
                  {serviziArchivioOrdinatiPerDonazione.map((s) => {
                    const sid = s.id || s.codice;
                    const impEs = estraiImportoDonazione(s);
                    const labelPersona = s.paziente || s.chiamante || s.proprietarioImmobile?.nomeCognome || '';
                    const labelTipo = s.tipoServizio || s.ambito || 'Servizio';
                    return (
                      <option key={sid} value={sid}>
                        [{s.codice || sid}] {s.data || ''} • {labelTipo} ({s.mezzo || 'N/D'})
                        {labelPersona ? ` • ${labelPersona}` : ''}
                        {impEs > 0 ? ` [Già con donazione €${impEs.toFixed(2)}]` : ''}
                      </option>
                    );
                  })}
                </select>

                {servizioCollegatoSelezionato && (
                  <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-1 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-purple-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Servizio collegato: {servizioCollegatoSelezionato.codice || servizioCollegatoSelezionato.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelezionaServizioPerDonazione('')}
                        className="text-[10px] font-bold text-slate-300 hover:text-white underline cursor-pointer"
                      >
                        Scollega
                      </button>
                    </div>
                    <div className="text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Data: <strong className="text-white">{servizioCollegatoSelezionato.data || '-'}</strong></span>
                      <span>Mezzo: <strong className="text-amber-300 font-mono">{servizioCollegatoSelezionato.mezzo || 'N/D'}</strong></span>
                      {servizioCollegatoSelezionato.volontarioNome && (
                        <span>Equipaggio: <strong className="text-cyan-300">{servizioCollegatoSelezionato.volontarioNome}</strong></span>
                      )}
                    </div>
                    {(servizioCollegatoSelezionato.indirizzoIntervento || servizioCollegatoSelezionato.destinazione) && (
                      <div className="text-slate-400 truncate">
                        Tratta: {[servizioCollegatoSelezionato.indirizzoIntervento, servizioCollegatoSelezionato.destinazione].filter(Boolean).join(' → ')}
                      </div>
                    )}
                    {estraiImportoDonazione(servizioCollegatoSelezionato) > 0 && (
                      <div className="text-amber-300 font-bold flex items-center gap-1 pt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Questo servizio ha già una donazione di € {estraiImportoDonazione(servizioCollegatoSelezionato).toFixed(2)}: confermando verrà aggiornata.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Codice Missione Associato *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. MIS-2026-088"
                    value={formDonazioneCodice}
                    onChange={(e) => setFormDonazioneCodice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Data Ricezione *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDonazioneData}
                    onChange={(e) => setFormDonazioneData(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Donatore / Paziente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome e Cognome o Ragione Sociale"
                    value={formDonazionePaziente}
                    onChange={(e) => setFormDonazionePaziente(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between gap-1">
                    <span>C.F. / P.Iva</span>
                    {servizioCollegatoSelezionato && estraiCfPivaDonatore(servizioCollegatoSelezionato) && (
                      <span className="text-[9px] text-emerald-400 font-semibold normal-case">Compilato dal servizio</span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="es. RSSMRA80A01F023X o P.Iva"
                    value={formDonazioneCfPiva}
                    onChange={(e) => setFormDonazioneCfPiva(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Importo Donazione con Validazione Limiti */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                  <span>Importo Donazione (€) *</span>
                  <span className="text-[10px] text-amber-400 font-mono">Min &gt; €0 | Max €10.000</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="10000"
                    required
                    placeholder="0.00"
                    value={formDonazioneImporto}
                    onChange={(e) => setFormDonazioneImporto(e.target.value)}
                    className={`w-full pl-8 pr-4 py-2 rounded-xl bg-slate-950 border font-mono font-bold text-sm text-white focus:outline-none ${
                      erroreImportoDonazione
                        ? 'border-red-500 focus:border-red-500 bg-red-950/20'
                        : 'border-slate-700 focus:border-purple-500'
                    }`}
                  />
                </div>

                {/* Banner di Avviso / Errore Validazione */}
                {erroreImportoDonazione && (
                  <div className="mt-1.5 p-2 rounded-xl bg-red-950/80 border border-red-500/60 text-red-300 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{erroreImportoDonazione}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Metodo di Pagamento *
                  </label>
                  <select
                    value={formDonazioneMetodo}
                    onChange={(e) => setFormDonazioneMetodo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="Contanti">Contanti (Cassa Sede)</option>
                    <option value="Bonifico Bancario IBAN">Bonifico Bancario IBAN ({bancaCreditAgricole})</option>
                    <option value={`Bonifico Postale - ${bancaPoste} (IBAN: ${ibanPoste})`}>
                      Bonifico / Bollettino {bancaPoste} (C/C {ccPostale})
                    </option>
                    <option value="POS / Carta">POS / Carta di Credito</option>
                    <option value="Assegno Bancario">Assegno Bancario</option>
                    {metodiPerDonazioni.length > 0 && (
                      <optgroup label="Ulteriori Metodi Configurati">
                        {metodiPerDonazioni.map((m) => {
                          const val = formattaEtichettaMetodoPagamento(m);
                          return (
                            <option key={m.id} value={val}>
                              {val}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    N. Ricevuta Fiscale
                  </label>
                  <input
                    type="text"
                    placeholder="es. DON-2026/012"
                    value={formDonazioneRicevuta}
                    onChange={(e) => setFormDonazioneRicevuta(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {(() => {
                const customDonSel = metodiPerDonazioni.find((m) => formattaEtichettaMetodoPagamento(m) === formDonazioneMetodo);
                if (!customDonSel) return null;
                return (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/40 text-[11px] space-y-1">
                    <div className="font-black text-purple-300">
                      Metodo selezionato: {customDonSel.nome}
                    </div>
                    {customDonSel.coordinateODettagli && (
                      <div className="font-mono text-amber-300 select-all break-all">
                        Riferimento / Coordinate: {customDonSel.coordinateODettagli}
                      </div>
                    )}
                    {customDonSel.note && <div className="text-slate-400 italic">{customDonSel.note}</div>}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Note / Causale Donazione
                </label>
                <input
                  type="text"
                  placeholder="Erogazione liberale a sostegno delle attività istituzionali"
                  value={formDonazioneNote}
                  onChange={(e) => setFormDonazioneNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[10px] text-purple-300">
                ℹ️ Le erogazioni liberali sono soggette a registrazione ai sensi dell'Art. 82 D.Lgs 117/2017 (Codice del Terzo Settore). I dati verranno inseriti nell'estrazione CSV per la Tesoreria.
              </div>

              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setModaleNuovaDonazioneAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={Boolean(erroreImportoDonazione) || !formDonazioneImporto || !formDonazioneCodice || !formDonazionePaziente}
                  className={`px-5 py-2.5 rounded-xl font-black uppercase flex items-center gap-1.5 shadow-lg text-xs ${
                    Boolean(erroreImportoDonazione) || !formDonazioneImporto || !formDonazioneCodice || !formDonazionePaziente
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95 transition-all'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Donazione</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE EMISSIONE NUOVA TESSERA */}
      {modaleNuovaTesseraAperta && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModaleNuovaTesseraAperta(false);
          }}
        >
          <div
            className="bg-slate-900 border-2 border-purple-500/50 rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-black text-white uppercase tracking-wide">
                  Emetti Nuova Tessera Associativa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaTesseraAperta(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi finestra (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmettiTessera} className="flex flex-col flex-1 min-h-0 mt-3">
              <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3 text-xs py-1 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Nome Socio *</label>
                    <input
                      type="text"
                      required
                      value={formTessNome}
                      onChange={(e) => setFormTessNome(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                      placeholder="Nome"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Cognome Socio *</label>
                    <input
                      type="text"
                      required
                      value={formTessCognome}
                      onChange={(e) => setFormTessCognome(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                      placeholder="Cognome"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Fiscale Socio *</label>
                  <input
                    type="text"
                    required
                    value={formTessCF}
                    onChange={(e) => setFormTessCF(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                    placeholder="es. RSSMRA80A01F023K"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Qualifica Socio</label>
                    <select
                      value={formTessQualifica}
                      onChange={(e) => {
                        const q = e.target.value as any;
                        setFormTessQualifica(q);
                        setFormTessQuota(q === 'Operatore Centrale' ? 10.0 : 5.0);
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="Volontario Soccorritore">Volontario Soccorritore (€5,00)</option>
                      <option value="Operatore Centrale">Operatore Centrale (€10,00)</option>
                      <option value="Socio Sostenitore">Socio Sostenitore</option>
                      <option value="Socio Onorario">Socio Onorario</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Quota Sociale (€) *</label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={formTessQuota}
                      onChange={(e) => setFormTessQuota(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-purple-400 font-mono font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Numero Tessera Formattato</label>
                  <input
                    type="text"
                    required
                    value={formTessNumero}
                    onChange={(e) => setFormTessNumero(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-black focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 italic">
                  {DICITURA_ESENZIONE_BOLLO}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setModaleNuovaTesseraAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer text-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Conferma Emissione Tessera</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ANNULLAMENTO TESSERA */}
      {tesseraDaAnnullare && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-black text-white uppercase">
                  Annulla Tessera: {tesseraDaAnnullare.numeroTessera}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTesseraDaAnnullare(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfermaAnnullaTessera} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200">
                Sei sicuro di voler annullare la tessera di <strong className="text-white">{tesseraDaAnnullare.socioNome} {tesseraDaAnnullare.socioCognome}</strong>? L'operazione rimarrà tracciata nel libro soci dell'associazione.
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Motivazione Annullamento</label>
                <select
                  value={motivoAnnullamentoTessera}
                  onChange={(e) => setMotivoAnnullamentoTessera(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Dimissioni volontarie del socio">Dimissioni volontarie del socio</option>
                  <option value="Decadenza per mancato versamento quota">Decadenza per mancato versamento quota</option>
                  <option value="Provvedimento disciplinare Consiglio Direttivo">Provvedimento disciplinare Consiglio Direttivo</option>
                  <option value="Errore materiale di emissione duplicato">Errore materiale di emissione duplicato</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTesseraDaAnnullare(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Indietro
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Ban className="w-4 h-4" />
                  <span>Annulla Definitivamente Tessera</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA NOTA DI DEBITO (COMPLETAMENTE SCROLLABILE SU PC E SMARTPHONE) */}
      {modaleNuovaNotaAperta && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModaleNuovaNotaAperta(false);
          }}
        >
          <div
            className="bg-slate-900 border-2 border-purple-500/60 rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fisso in Alto */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-black text-white uppercase tracking-wide">
                  Emetti Nuova Nota di Debito
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaNotaAperta(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi finestra (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form con corpo scrollabile su PC e Mobile */}
            <form onSubmit={handleEmettiNotaDiDebito} className="flex flex-col flex-1 min-h-0 mt-3">
              <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3.5 text-xs py-1 overscroll-contain">
                {/* COLLEGAMENTO A SERVIZIO SVOLTO IN ARCHIVIO */}
                <div className="bg-slate-950/90 border border-purple-500/40 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-purple-300 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Collega Servizio Svolto (Recupera KM, Ore & Proprietario)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setMostraSezioneProprietario((v) => !v)}
                      className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    >
                      {mostraSezioneProprietario ? 'Nascondi Proprietario Immobile' : '+ Dati Proprietario Immobile'}
                    </button>
                  </div>

                  <select
                    value={formServizioCollegatoId}
                    onChange={(e) => handleSelezionaServizioPerNota(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs cursor-pointer focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">-- Nessun servizio collegato (Compilazione manuale) --</option>
                    {(serviziArchivio || []).map((s) => {
                      const sid = s.id || s.codice;
                      const km = s.kmTotali != null ? Number(s.kmTotali) : (s.kmFine != null && s.kmInizio != null ? Math.max(0, Number(s.kmFine) - Number(s.kmInizio)) : 0);
                      return (
                        <option key={sid} value={sid}>
                          [{s.codice || sid}] {s.data || ''} - {s.tipoServizio || 'Servizio'} ({s.mezzo || 'N/D'}) • {km} km
                        </option>
                      );
                    })}
                  </select>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Codice Servizio</label>
                      <input
                        type="text"
                        value={formNotaRiferimento}
                        onChange={(e) => setFormNotaRiferimento(e.target.value)}
                        placeholder="es. SRV-2026-01"
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">KM Percorsi (Modificabili)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formKmPercorsiServizio}
                        onChange={(e) => setFormKmPercorsiServizio(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ore Impiego (Modificabili)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formOreImpiegoServizio}
                        onChange={(e) => setFormOreImpiegoServizio(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {mostraSezioneProprietario && (
                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                      <div className="text-[10px] font-black uppercase text-amber-300">
                        Dati Proprietario Immobile (Atto Esecutivo)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nome e Cognome Proprietario"
                          value={formProprietarioImmobile.nomeCognome}
                          onChange={(e) => setFormProprietarioImmobile((p) => ({ ...p, nomeCognome: e.target.value }))}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                        />
                        <input
                          type="text"
                          placeholder="Codice Fiscale Proprietario"
                          value={formProprietarioImmobile.codiceFiscale}
                          onChange={(e) => setFormProprietarioImmobile((p) => ({ ...p, codiceFiscale: e.target.value.toUpperCase() }))}
                          className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono uppercase"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Indirizzo di Residenza Proprietario"
                        value={formProprietarioImmobile.indirizzoResidenza}
                        onChange={(e) => setFormProprietarioImmobile((p) => ({ ...p, indirizzoResidenza: e.target.value }))}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400 font-bold">Debitore / Ente Intestatario *</label>
                    {contatti && contatti.length > 0 && (
                      <span className="text-[10px] text-purple-300 font-semibold flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-purple-400" />
                        <span>Selezionabile da Contatti</span>
                      </span>
                    )}
                  </div>

                  {/* Tendina Selezione Rapida da Anagrafiche Contatti */}
                  {contatti && contatti.length > 0 && (
                    <div className="mb-2">
                      <select
                        onChange={(e) => {
                          const cid = e.target.value;
                          if (!cid) return;
                          const sel = contatti.find(c => c.id === cid);
                          if (sel) {
                            setFormNotaDebitore(sel.ragioneSociale);
                            setFormNotaPiva(sel.partitaIvaCodiceFiscale || '');
                            setFormNotaIndirizzo(`${sel.indirizzo}, ${sel.cap} ${sel.citta} (${sel.provincia})`.replace(/,\s*,/g, ','));
                            setFormNotaEmail(sel.email || '');
                            setFormNotaEmailNonDisponibile(false);
                            setFormNotaPec(sel.pec || '');
                            setFormNotaPecNonDisponibile(false);
                          }
                        }}
                        className="w-full p-2 rounded-xl bg-purple-950/40 border border-purple-500/50 text-purple-200 text-xs font-semibold focus:ring-1 focus:ring-purple-400 focus:outline-none mb-1.5 cursor-pointer"
                      >
                        <option value="">⚡ Seleziona da Contatti Fornitori / Clienti / Enti (Auto-compilazione)...</option>
                        {contatti.map((c) => (
                          <option key={c.id} value={c.id}>
                            [{c.tipo.toUpperCase()}] {c.ragioneSociale} — P.IVA/CF: {c.partitaIvaCodiceFiscale}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <input
                    type="text"
                    required
                    value={formNotaDebitore}
                    onChange={(e) => setFormNotaDebitore(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    placeholder="es. Azienda USL Toscana Nord Ovest"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">P.IVA / Codice Fiscale *</label>
                    <input
                      type="text"
                      required
                      value={formNotaPiva}
                      onChange={(e) => setFormNotaPiva(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-purple-500"
                      placeholder="Auto-compilato dal contatto"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {calcoliNotaCorrente.hasVoci ? 'Totale Calcolato Netto (€)' : 'Importo Base (€) *'}
                    </label>
                    {calcoliNotaCorrente.hasVoci ? (
                      <div className="w-full p-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-emerald-400 font-mono font-black">
                        € {calcoliNotaCorrente.totaleNetto.toFixed(2)}
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formNotaImporto}
                        onChange={(e) => setFormNotaImporto(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-purple-400 font-mono font-bold focus:outline-none focus:border-purple-500"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Indirizzo Sede / Residenza Debitore *</label>
                  <input
                    type="text"
                    required
                    value={formNotaIndirizzo}
                    onChange={(e) => setFormNotaIndirizzo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    placeholder="Via, Civico, CAP, Comune e Provincia (Auto-compilato)"
                  />
                </div>

                {/* RECAPITI OBBLIGATORI: EMAIL & PEC CON DICHIARAZIONE DI NON POSSESSO */}
                <div className="bg-slate-950/90 border border-purple-500/40 rounded-2xl p-3.5 space-y-3">
                  <div className="text-[11px] font-black uppercase text-purple-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>Recapiti Elettronici Obbligatori Destinatario (Email & PEC)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Indirizzo Email */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold">
                        Indirizzo Email {!formNotaEmailNonDisponibile && <span className="text-rose-400">*</span>}
                      </label>
                      <input
                        type="email"
                        required={!formNotaEmailNonDisponibile}
                        disabled={formNotaEmailNonDisponibile}
                        value={formNotaEmailNonDisponibile ? '' : formNotaEmail}
                        onChange={(e) => setFormNotaEmail(e.target.value)}
                        placeholder={formNotaEmailNonDisponibile ? 'Dichiarato non in possesso' : 'es. amministrazione@ente.it'}
                        className={`w-full p-2.5 rounded-xl border text-white font-mono focus:outline-none ${
                          formNotaEmailNonDisponibile
                            ? 'bg-slate-900/60 border-amber-500/40 text-amber-300/70 italic cursor-not-allowed'
                            : 'bg-slate-900 border-slate-700 focus:border-purple-500'
                        }`}
                      />
                      <label className="flex items-start gap-2 cursor-pointer select-none p-2 rounded-xl bg-amber-950/25 border border-amber-500/35 hover:border-amber-400/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={formNotaEmailNonDisponibile}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormNotaEmailNonDisponibile(checked);
                            if (checked) setFormNotaEmail('');
                          }}
                          className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-amber-200 leading-snug font-semibold">
                          Dichiaro di non essere in possesso dell'indirizzo Email al momento dell'emissione
                        </span>
                      </label>
                    </div>

                    {/* Indirizzo PEC */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-bold">
                        Indirizzo PEC {!formNotaPecNonDisponibile && <span className="text-rose-400">*</span>}
                      </label>
                      <input
                        type="email"
                        required={!formNotaPecNonDisponibile}
                        disabled={formNotaPecNonDisponibile}
                        value={formNotaPecNonDisponibile ? '' : formNotaPec}
                        onChange={(e) => setFormNotaPec(e.target.value)}
                        placeholder={formNotaPecNonDisponibile ? 'Dichiarato non in possesso' : 'es. protocollo@pec.ente.it'}
                        className={`w-full p-2.5 rounded-xl border text-white font-mono focus:outline-none ${
                          formNotaPecNonDisponibile
                            ? 'bg-slate-900/60 border-amber-500/40 text-amber-300/70 italic cursor-not-allowed'
                            : 'bg-slate-900 border-slate-700 focus:border-purple-500'
                        }`}
                      />
                      <label className="flex items-start gap-2 cursor-pointer select-none p-2 rounded-xl bg-amber-950/25 border border-amber-500/35 hover:border-amber-400/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={formNotaPecNonDisponibile}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormNotaPecNonDisponibile(checked);
                            if (checked) setFormNotaPec('');
                          }}
                          className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-amber-200 leading-snug font-semibold">
                          Dichiaro di non essere in possesso dell'indirizzo PEC al momento dell'emissione
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Causale Prestazione *</label>
                  <textarea
                    rows={2}
                    required
                    value={formNotaCausale}
                    onChange={(e) => setFormNotaCausale(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                    placeholder="es. Convenzione Trasporto Sanitario Ordinario Dialisi"
                  />
                </div>

                {/* VOCI TARIFFARIE & VOCI COMPLETAMENTE EDITABILI */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Voci Nota di Debito (Da Costi di Servizio o Editabili)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAggiungiVoceEditabileNota}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase cursor-pointer"
                    >
                      + Voce Completamente Editabile
                    </button>
                  </div>

                  {/* Pulsanti Rapidi da Tariffario Costi di Servizio */}
                  <div className="flex flex-wrap gap-1.5">
                    {tariffeCostiServizio.filter((t) => (t.attiva ?? t.attivo ?? true)).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleAggiungiTariffaANota(t)}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-purple-950 border border-slate-700 hover:border-purple-500 text-[10px] text-slate-200 cursor-pointer flex items-center gap-1"
                        title={t.descrizioneSigla}
                      >
                        <span className="font-mono font-black text-amber-300">{t.siglaBreve}</span>
                        <span>{t.nomeVoce}</span>
                        <span className="text-emerald-400 font-mono">€{t.importoUnitario.toFixed(2)}/{t.unitaMisura}</span>
                      </button>
                    ))}
                  </div>

                  {formVociDettaglio.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {formVociDettaglio.map((v) => (
                        <div key={v.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                          <div className="grid grid-cols-12 gap-1.5 items-center">
                            <input
                              type="text"
                              value={v.siglaBreve || ''}
                              onChange={(e) => handleAggiornaVoceNota(v.id, { siglaBreve: e.target.value.toUpperCase() })}
                              placeholder="Sigla"
                              className="col-span-3 p-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300 font-mono font-bold text-[11px] uppercase"
                            />
                            <input
                              type="text"
                              value={v.descrizioneSigla || ''}
                              onChange={(e) => handleAggiornaVoceNota(v.id, { descrizioneSigla: e.target.value })}
                              placeholder="Descrizione sigla"
                              className="col-span-8 p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => setFormVociDettaglio((prev) => prev.filter((x) => x.id !== v.id))}
                              className="col-span-1 p-1.5 rounded-lg bg-red-950 text-red-400 hover:text-white flex items-center justify-center cursor-pointer"
                              title="Rimuovi riga"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-12 gap-1.5 items-center">
                            <input
                              type="text"
                              value={v.descrizioneVoce || v.descrizione || ''}
                              onChange={(e) => handleAggiornaVoceNota(v.id, { descrizioneVoce: e.target.value })}
                              placeholder="Descrizione voce prestazione"
                              className="col-span-5 p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[11px]"
                            />
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={v.quantita}
                              onChange={(e) => handleAggiornaVoceNota(v.id, { quantita: Number(e.target.value) || 0 })}
                              className="col-span-2 p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-[11px]"
                              title="Quantità"
                            />
                            <input
                              type="text"
                              value={v.unitaMisura || ''}
                              onChange={(e) => handleAggiornaVoceNota(v.id, { unitaMisura: e.target.value })}
                              className="col-span-2 p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 font-mono text-[11px]"
                              placeholder="u.m."
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={v.prezzoUnitario}
                              onChange={(e) => handleAggiornaVoceNota(v.id, { prezzoUnitario: Number(e.target.value) || 0 })}
                              className="col-span-3 p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold text-[11px]"
                              title="Prezzo Unitario €"
                            />
                          </div>
                          <div className="text-right text-[10px] font-mono text-emerald-400 font-bold">
                            Totale Riga: € {Number(v.totaleRiga ?? v.subtotale ?? 0).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SCONTISTICHE */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="text-[10px] font-black uppercase text-pink-300 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      <span>Scontistiche & Convenzioni Applicabili</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={formScontoTipo}
                        onChange={(e) => setFormScontoTipo(e.target.value as any)}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      >
                        <option value="nessuno">Nessuno sconto</option>
                        <option value="percentuale">Sconto Percentuale (%)</option>
                        <option value="fisso">Sconto Importo Fisso (€)</option>
                      </select>
                      {formScontoTipo !== 'nessuno' && (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formScontoValore}
                            onChange={(e) => setFormScontoValore(Math.max(0, Number(e.target.value) || 0))}
                            placeholder={formScontoTipo === 'percentuale' ? '% Sconto' : '€ Sconto'}
                            className="p-2 rounded-xl bg-slate-900 border border-pink-500/50 text-pink-300 font-mono font-bold"
                          />
                          <input
                            type="text"
                            value={formScontoDescrizione}
                            onChange={(e) => setFormScontoDescrizione(e.target.value)}
                            placeholder="Motivazione sconto"
                            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Lordo: € {calcoliNotaCorrente.imponibileLordo.toFixed(2)}</span>
                      <span className="text-pink-400">Sconto: -€ {calcoliNotaCorrente.scontoCalcolato.toFixed(2)}</span>
                      <span className="text-emerald-400 font-black">Netto Nota: € {calcoliNotaCorrente.totaleNetto.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Scadenza Pagamento *</label>
                    <input
                      type="date"
                      required
                      value={formNotaScadenza}
                      onChange={(e) => setFormNotaScadenza(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Conto di Riferimento Rapido</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormNotaMetodo(`Bonifico Bancario - ${bancaCreditAgricole} (IBAN: ${ibanCreditAgricole})`)}
                        className={`p-2 rounded-xl text-[11px] font-bold border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                          formNotaMetodo.includes('Credit Agricole') || formNotaMetodo.includes('Agricole') || (formNotaMetodo.includes('Bonifico') && !formNotaMetodo.includes('Poste'))
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1 font-black">
                          <span>🏦</span> {bancaCreditAgricole}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400/90 truncate max-w-full">
                          ...{ibanCreditAgricole.slice(-8)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormNotaMetodo(`Bonifico Bancario / Postale - ${bancaPoste} (IBAN: ${ibanPoste})`)}
                        className={`p-2 rounded-xl text-[11px] font-bold border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                          formNotaMetodo.includes('Poste') || formNotaMetodo.includes('00001007035676')
                            ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-1 font-black">
                          <span>🟡</span> {bancaPoste}
                        </span>
                        <span className="text-[9px] font-mono text-amber-400/90 truncate max-w-full">
                          ...{ibanPoste.slice(-8)}
                        </span>
                      </button>
                      {metodiPerPagamenti.map((m) => {
                        const val = formattaEtichettaMetodoPagamento(m);
                        const active = formNotaMetodo === val;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setFormNotaMetodo(val)}
                            className={`p-2 rounded-xl text-[11px] font-bold border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                              active
                                ? 'bg-purple-950/80 border-purple-500 text-purple-200 ring-2 ring-purple-500/40 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            <span className="flex items-center gap-1 font-black truncate max-w-full">
                              <span>💳</span> {m.nome}
                            </span>
                            <span className="text-[9px] font-mono text-purple-300/90 truncate max-w-full">
                              {m.coordinateODettagli || 'Metodo personalizzato'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Menù a Tendina Metodo di Pagamento con IBAN Esplicito */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                      <span>Metodo di Pagamento & Conto IBAN Destinazione *</span>
                    </label>
                    <span className="text-[10px] text-purple-300 font-mono font-semibold">
                      {2 + metodiPerPagamenti.length} Metodi Attivi
                    </span>
                  </div>

                  <select
                    value={formNotaMetodo}
                    onChange={(e) => setFormNotaMetodo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border-2 border-purple-500/50 text-white text-xs font-semibold focus:border-purple-400 focus:outline-none cursor-pointer"
                  >
                    <optgroup label="🏦 Conto Bancario — Credit Agricole (Ordinario)">
                      <option value={`Bonifico Bancario - ${bancaCreditAgricole} (IBAN: ${ibanCreditAgricole})`}>
                        🏦 Bonifico Bancario su Credit Agricole (IBAN: {ibanCreditAgricole})
                      </option>
                      <option value={`RiBa 30gg - ${bancaCreditAgricole} (IBAN: ${ibanCreditAgricole})`}>
                        📄 RiBa 30gg Ricevuta Bancaria su Credit Agricole (IBAN: {ibanCreditAgricole})
                      </option>
                    </optgroup>

                    <optgroup label="🟡 Conto Postale — Poste Italiane (BancoPosta)">
                      <option value={`Bonifico Bancario / Postale - ${bancaPoste} (IBAN: ${ibanPoste})`}>
                        🟡 Bonifico Bancario / Postale su Poste Italiane (IBAN: {ibanPoste})
                      </option>
                      <option value={`Bollettino C/C Postale - ${bancaPoste} (C/C: ${ccPostale})`}>
                        📮 Bollettino C/C Postale su Poste Italiane (C/C: {ccPostale} - IBAN: {ibanPoste})
                      </option>
                    </optgroup>

                    <optgroup label="💶 Altre Modalità di Incasso">
                      <option value={`Assegno Bancario / Circolare (intestato a ${intestatarioUfficiale})`}>
                        ✉️ Assegno Bancario / Circolare (intestato a {intestatarioUfficiale})
                      </option>
                      <option value="Contanti / Cassa (con rilascio quietanza)">
                        💵 Contanti / Cassa di Sede (con rilascio quietanza numerata)
                      </option>
                    </optgroup>

                    {metodiPerPagamenti.length > 0 && (
                      <optgroup label="✨ Ulteriori Metodi Configurati (Coordinate Bancarie & Postali)">
                        {metodiPerPagamenti.map((m) => {
                          const val = formattaEtichettaMetodoPagamento(m);
                          return (
                            <option key={m.id} value={val}>
                              💳 {val}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Riquadro Dettaglio Coordinate e Verifica IBAN Sedi Associative */}
                {(() => {
                  const customNotaSel = metodiPerPagamenti.find((m) => formattaEtichettaMetodoPagamento(m) === formNotaMetodo);
                  if (customNotaSel) {
                    return (
                      <div className="p-3 rounded-2xl border-2 bg-purple-950/30 border-purple-500/60 text-purple-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wide">
                            <span>💳</span>
                            <span>Metodo Selezionato: <strong>{customNotaSel.nome}</strong></span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
                            Personalizzato
                          </span>
                        </div>

                        <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
                          {customNotaSel.coordinateODettagli && (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Coordinate / Riferimento:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(customNotaSel.coordinateODettagli);
                                    setIbanCopiatoFeedback(customNotaSel.coordinateODettagli);
                                    setTimeout(() => setIbanCopiatoFeedback(null), 2500);
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition-colors"
                                >
                                  {ibanCopiatoFeedback === customNotaSel.coordinateODettagli ? '✓ Copiato!' : 'Copia'}
                                </button>
                              </div>
                              <div className="font-mono font-black text-xs tracking-wider text-white select-all break-all">
                                {customNotaSel.coordinateODettagli}
                              </div>
                            </>
                          )}
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            Intestatario: <strong className="text-slate-200">{customNotaSel.intestatario || intestatarioUfficiale}</strong>
                          </div>
                          {customNotaSel.note && (
                            <div className="text-[10px] text-purple-300 italic">{customNotaSel.note}</div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const isPosteSel = formNotaMetodo.includes('Poste') || formNotaMetodo.includes('00001007035676') || formNotaMetodo.includes('C/C Postale');
                  const isCreditSel = formNotaMetodo.includes('Credit Agricole') || formNotaMetodo.includes('Agricole') || (!isPosteSel && formNotaMetodo.includes('Bonifico'));
                  const activeIban = isPosteSel ? ibanPoste : isCreditSel ? ibanCreditAgricole : null;
                  const activeBanca = isPosteSel ? bancaPoste : isCreditSel ? bancaCreditAgricole : null;

                  if (!activeIban) return null;

                  return (
                    <div className={`p-3 rounded-2xl border-2 transition-all space-y-2 ${
                      isPosteSel
                        ? 'bg-amber-950/30 border-amber-500/60 text-amber-200'
                        : 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wide">
                          {isPosteSel ? <span>🟡</span> : <span>🏦</span>}
                          <span>Conto Designato per il Pagamento: <strong>{activeBanca}</strong></span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
                          {isPosteSel ? 'BancoPosta' : 'C/C Bancario'}
                        </span>
                      </div>

                      <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">IBAN Ufficiale:</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeIban);
                              setIbanCopiatoFeedback(activeIban);
                              setTimeout(() => setIbanCopiatoFeedback(null), 2500);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition-colors"
                          >
                            {ibanCopiatoFeedback === activeIban ? '✓ Copiato!' : 'Copia IBAN'}
                          </button>
                        </div>
                        <div className="font-mono font-black text-xs tracking-wider text-white select-all break-all">
                          {activeIban}
                        </div>

                        {isPosteSel && ccPostale && (
                          <div className="text-[11px] font-mono text-amber-300 font-semibold pt-0.5 border-t border-slate-800/80 mt-1">
                            Numero C/C Postale: <strong className="text-white">{ccPostale}</strong>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 pt-0.5">
                          Intestatario: <strong className="text-slate-200">{intestatarioUfficiale}</strong>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>✓ Coordinate ufficiali dal Database Anagrafiche Sedi</span>
                        <span className="text-[9px] text-emerald-400 font-semibold">Riportato automaticamente sul PDF</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer Fisso in Basso */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setModaleNuovaNotaAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer text-xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Emetti Nota di Debito</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA RIMOZIONE NOTE DI DEBITO DALL'ARCHIVIO */}
      {modaleConfermaEliminaNoteAperta && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModaleConfermaEliminaNoteAperta(false);
          }}
        >
          <div
            className="bg-slate-900 border-2 border-red-500/70 rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl text-slate-200 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Conferma Rimozione Note di Debito
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleConfermaEliminaNoteAperta(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-950/40 border border-red-500/50 rounded-2xl p-3.5 space-y-2 text-xs text-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-300">
                    Stai per rimuovere definitivamente dall'archivio <strong>{noteDaEliminare.length} nota/e di debito</strong>.
                  </p>
                  <p className="text-[11px] text-red-200/90 leading-relaxed">
                    📧 <strong>Invio email automatico:</strong> Questa cancellazione viene tracciata nei registri e trasmetterà immediatamente una notifica email certificata contenente tutti i dettagli sia a <strong>presidenza@croceoro.org</strong> che a <strong>tesoreria@croceoro.org</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Elenco sintetico delle note da eliminare */}
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {noteDaEliminare.map(n => (
                <div key={n.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div>
                    <span className="font-mono font-bold text-amber-400">{n.numeroProgressivo}</span>
                    <span className="text-slate-400 ml-2 font-bold">{n.debitoreIntestatario}</span>
                  </div>
                  <span className="font-mono font-black text-purple-400">€ {n.importoTotale.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-slate-400 font-bold text-xs mb-1">
                Motivazione della rimozione (inclusa nell'email di notifica)
              </label>
              <textarea
                rows={2}
                value={motivoEliminazioneNota}
                onChange={(e) => setMotivoEliminazioneNota(e.target.value)}
                placeholder="es. Annullamento d'ufficio per errore materiale di fatturazione / concordato con il debitore"
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={eliminazioneInCorso}
                onClick={() => setModaleConfermaEliminaNoteAperta(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={eliminazioneInCorso}
                onClick={confermaEliminazioneNote}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{eliminazioneInCorso ? 'Cancellazione & Invio Email...' : 'Conferma Rimozione & Invia Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE VISUALIZZAZIONE / STAMPA DOCUMENTO */}
      {documentoPerStampa && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDocumentoPerStampa(null);
          }}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 shrink-0">
              <div className="text-left">
                <div className="text-xs uppercase font-black text-slate-500">Croce Oro Massa Carrara OdV • Carta Intestata</div>
                <div className="text-lg font-black text-[#1d1a60] uppercase">
                  {documentoPerStampa.tipo === 'tessera'
                    ? 'Ricevuta Tesseramento & Quota Sociale'
                    : documentoPerStampa.tipo === 'ricevuta'
                      ? 'Ricevuta Contabile Ufficiale'
                      : 'Nota di Debito Ufficiale'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDocumentoPerStampa(null)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
                title="Chiudi (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3 text-xs py-1 mt-2 overscroll-contain">
              {documentoPerStampa.tipo === 'tessera' && (() => {
                const tesoriere = getTesoriereAttivo(volontari);
                return (
                  <div className="space-y-3 text-xs">
                    {/* Intestazione Istituzionale Carta Intestata */}
                    {(() => {
                      const cInfo = getDatiCartaIntestata();
                      return (
                        <div className="bg-gradient-to-r from-slate-900 to-[#1d1a60] text-white p-3 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="font-black text-sm uppercase tracking-wide text-amber-300">
                              {cInfo.denominazione}
                            </div>
                            <div className="text-[10px] text-slate-300">
                              Sede Legale: {cInfo.sedeLegale} • Sede Massa: {cInfo.sedeMassa} • Sede Carrara: {cInfo.sedeCarrara} • Sede Pietrasanta: {cInfo.sedePietrasanta}
                            </div>
                            <div className="text-[10px] text-slate-300">
                              Centrale Tel: {cInfo.centraleTel} • CF: {cInfo.codiceFiscale} • {cInfo.sitoWeb}
                            </div>
                            <div className="text-[10px] text-slate-300">
                              Email: {cInfo.email} • Pec: {cInfo.pec}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                              1 Pagina A4
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex justify-between font-mono font-bold">
                        <span className="text-[#1d1a60]">Ricevuta N.: {documentoPerStampa.data.ricevutaNumero || '01/2026'}</span>
                        <span>Data: {documentoPerStampa.data.dataEmissione}</span>
                      </div>
                      <div>Socio Intestatario: <strong>{documentoPerStampa.data.socioNome} {documentoPerStampa.data.socioCognome}</strong></div>
                      <div>Codice Fiscale: <strong className="font-mono">{documentoPerStampa.data.socioCodiceFiscale}</strong></div>
                      <div>Numero Tessera: <strong className="font-mono text-[#bfa353]">{documentoPerStampa.data.numeroTessera}</strong></div>
                      <div>Qualifica: <strong>{documentoPerStampa.data.qualifica}</strong></div>
                      <div className="text-base font-black text-emerald-700 pt-1 flex justify-between items-center border-t border-slate-200 mt-2">
                        <span>Quota Sociale Versata:</span>
                        <span>€ {documentoPerStampa.data.quotaVersata.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Box Firma Obbligatoria del Tesoriere */}
                    <div className="bg-amber-50/80 border border-amber-300 p-3 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Firma Obbligatoria del Tesoriere (Inclusa sul PDF)</span>
                        </span>
                        <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded">
                          Automatica
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        Tesoriere in Carica: <strong>{tesoriere.nome} {tesoriere.cognome}</strong> ({tesoriere.carica})
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>
                          Cliccando <strong>STAMPA DOCUMENTO</strong> verrà inviata una mail a <strong>{tesoriere.email}</strong> con allegato il documento stampato.
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 italic">
                      {DICITURA_ESENZIONE_BOLLO}
                    </div>
                  </div>
                );
              })()}

              {documentoPerStampa.tipo === 'nota' && (
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex justify-between font-mono font-bold">
                      <span>Documento: {documentoPerStampa.data.numeroProgressivo}</span>
                      <span>Data: {documentoPerStampa.data.dataEmissione}</span>
                    </div>
                    <div>Spett.le: <strong>{documentoPerStampa.data.debitoreIntestatario}</strong></div>
                    {documentoPerStampa.data.partitaIvaCodiceFiscale && (
                      <div>P.IVA / CF: <strong className="font-mono">{documentoPerStampa.data.partitaIvaCodiceFiscale}</strong></div>
                    )}
                    {documentoPerStampa.data.indirizzoDebitore && (
                      <div>Indirizzo: {documentoPerStampa.data.indirizzoDebitore}</div>
                    )}
                    <div>
                      Email:{' '}
                      {documentoPerStampa.data.emailNonDisponibile ? (
                        <span className="italic text-amber-700 font-semibold">Non disponibile (dichiarato non in possesso all'emissione)</span>
                      ) : (
                        <strong className="font-mono">{documentoPerStampa.data.emailDestinatario || 'Non indicata'}</strong>
                      )}
                    </div>
                    <div>
                      PEC:{' '}
                      {documentoPerStampa.data.pecNonDisponibile ? (
                        <span className="italic text-amber-700 font-semibold">Non disponibile (dichiarato non in possesso all'emissione)</span>
                      ) : (
                        <strong className="font-mono">{documentoPerStampa.data.pecDestinatario || 'Non indicata'}</strong>
                      )}
                    </div>
                    {documentoPerStampa.data.proprietarioImmobile && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-0.5">
                        <div className="font-bold text-[11px] uppercase">Dati Proprietario Immobile (Atto Esecutivo)</div>
                        <div>Nome e Cognome: <strong>{documentoPerStampa.data.proprietarioImmobile.nomeCognome}</strong></div>
                        {documentoPerStampa.data.proprietarioImmobile.codiceFiscale && (
                          <div>Codice Fiscale: <strong className="font-mono">{documentoPerStampa.data.proprietarioImmobile.codiceFiscale}</strong></div>
                        )}
                        {documentoPerStampa.data.proprietarioImmobile.indirizzoResidenza && (
                          <div>Residenza: {documentoPerStampa.data.proprietarioImmobile.indirizzoResidenza}</div>
                        )}
                      </div>
                    )}
                    {documentoPerStampa.data.codiceServizioRiferimento && (
                      <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 font-mono text-[11px] flex flex-wrap gap-3">
                        <span>Servizio Collegato: <strong>{documentoPerStampa.data.codiceServizioRiferimento}</strong></span>
                        {documentoPerStampa.data.kmPercorsiServizio !== undefined && (
                          <span>KM: <strong>{documentoPerStampa.data.kmPercorsiServizio}</strong></span>
                        )}
                        {documentoPerStampa.data.oreImpiegoServizio !== undefined && (
                          <span>Ore Impiego: <strong>{documentoPerStampa.data.oreImpiegoServizio}</strong></span>
                        )}
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-bold">Causale prestazione:</span>
                      <p className="mt-0.5">{documentoPerStampa.data.causale}</p>
                    </div>
                    {Array.isArray(documentoPerStampa.data.vociDettaglio) && documentoPerStampa.data.vociDettaglio.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 space-y-1">
                        <span className="font-bold block text-[11px] uppercase text-slate-600">Dettaglio Voci Addebitate:</span>
                        <div className="space-y-1">
                          {documentoPerStampa.data.vociDettaglio.map((voce: VoceNotaDiDebito) => (
                            <div key={voce.id} className="flex items-center justify-between gap-2 text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                              <div className="min-w-0">
                                {(voce.siglaBreve || voce.sigla) && (
                                  <span className="font-mono font-bold text-indigo-700 mr-1.5">[{voce.siglaBreve || voce.sigla}]</span>
                                )}
                                <span className="font-semibold text-slate-800">{voce.descrizioneVoce || voce.descrizione}</span>
                                <span className="text-slate-500 ml-1 font-mono">
                                  ({voce.quantita} {voce.unitaMisura || voce.unita || 'pz'} × € {Number(voce.prezzoUnitario || 0).toFixed(2)})
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-900 shrink-0">
                                € {Number(voce.totaleRiga ?? voce.subtotale ?? 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Number(documentoPerStampa.data.scontoImportoCalcolato || 0) > 0 && (
                      <div className="flex items-center justify-between text-emerald-700 font-bold text-[11px] pt-1">
                        <span>Scontistica applicata {documentoPerStampa.data.scontoDescrizione ? `(${documentoPerStampa.data.scontoDescrizione})` : ''}:</span>
                        <span className="font-mono">- € {Number(documentoPerStampa.data.scontoImportoCalcolato).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="text-base font-black text-purple-900 pt-2 flex justify-between border-t border-slate-200">
                      <span>Totale da Liquidare:</span>
                      <span>€ {documentoPerStampa.data.importoTotale.toFixed(2)}</span>
                    </div>
                    <div className="text-slate-600 font-mono text-[11px]">
                      Pagamento entro: {documentoPerStampa.data.scadenzaPagamento} ({documentoPerStampa.data.metodoPagamento})
                    </div>
                  </div>
                </div>
              )}

              {documentoPerStampa.tipo === 'ricevuta' && (
                <div className="space-y-3 text-xs">
                  {documentoPerStampa.data.stato === 'Annullata' && (
                    <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 font-black uppercase text-center">
                      Documento Annullato {documentoPerStampa.data.motivoAnnullamento ? `— ${documentoPerStampa.data.motivoAnnullamento}` : ''}
                    </div>
                  )}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex justify-between font-mono font-bold text-[#1d1a60]">
                      <span>Ricevuta N.: {documentoPerStampa.data.numeroProgressivo}</span>
                      <span>Data: {documentoPerStampa.data.dataEmissione}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-600 uppercase">
                      Tipologia: {documentoPerStampa.data.tipologia}
                    </div>
                    <div>Intestatario: <strong>{documentoPerStampa.data.intestatario}</strong></div>
                    {documentoPerStampa.data.codiceFiscalePartitaIva && (
                      <div>CF / P.IVA: <strong className="font-mono">{documentoPerStampa.data.codiceFiscalePartitaIva}</strong></div>
                    )}
                    {documentoPerStampa.data.indirizzoIntestatario && (
                      <div>Indirizzo: {documentoPerStampa.data.indirizzoIntestatario}</div>
                    )}
                    <div>
                      Email:{' '}
                      {documentoPerStampa.data.emailNonDisponibile ? (
                        <span className="italic text-amber-700 font-semibold">Non disponibile (dichiarato non in possesso all'emissione)</span>
                      ) : (
                        <strong className="font-mono">{documentoPerStampa.data.emailDestinatario || 'Non indicata'}</strong>
                      )}
                    </div>
                    <div>
                      PEC:{' '}
                      {documentoPerStampa.data.pecNonDisponibile ? (
                        <span className="italic text-amber-700 font-semibold">Non disponibile (dichiarato non in possesso all'emissione)</span>
                      ) : (
                        <strong className="font-mono">{documentoPerStampa.data.pecDestinatario || 'Non indicata'}</strong>
                      )}
                    </div>
                    {documentoPerStampa.data.codiceServizioRiferimento && (
                      <div>Rif. Servizio: <strong className="font-mono">{documentoPerStampa.data.codiceServizioRiferimento}</strong></div>
                    )}
                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-bold">Causale:</span>
                      <p className="mt-0.5">{documentoPerStampa.data.causale}</p>
                    </div>
                    {documentoPerStampa.data.note && (
                      <div className="text-[11px] text-slate-600">
                        <span className="font-bold">Note:</span> {documentoPerStampa.data.note}
                      </div>
                    )}
                    <div className="text-base font-black text-emerald-700 pt-2 flex justify-between border-t border-slate-200">
                      <span>Importo Quietanzato:</span>
                      <span>€ {Number(documentoPerStampa.data.importoTotale || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-slate-600 font-mono text-[11px]">
                      Modalità Incasso: {documentoPerStampa.data.metodoPagamento}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 italic">
                    {DICITURA_ESENZIONE_BOLLO}
                  </div>
                </div>
              )}
              {(documentoPerStampa.tipo === 'nota' || documentoPerStampa.tipo === 'ricevuta') && (() => {
                const tesoriere = getTesoriereAttivo(volontari);
                return (
                  <div className="bg-amber-50/90 border border-amber-300 p-3 rounded-2xl space-y-1 mt-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                        <span>Firma Ufficiale del Tesoriere (Inclusa sul PDF)</span>
                      </span>
                      <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded">
                        {tesoriere.firmaBase64 ? 'Autografa' : 'Automatica'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Tesoriere in Carica: <strong>{tesoriere.nome} {tesoriere.cognome}</strong> ({tesoriere.carica})
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-amber-700 shrink-0" />
                      <span>
                        In copia email (CC) automatica: <strong className="font-mono">{tesoriere.email}</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0 mt-2">
              {(documentoPerStampa.tipo === 'nota' || documentoPerStampa.tipo === 'ricevuta') && (() => {
                const emailOrd = !documentoPerStampa.data.emailNonDisponibile
                  ? (documentoPerStampa.data.emailDestinatario || '').trim()
                  : '';
                const hasEmailOrd = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailOrd);
                return (
                  <button
                    type="button"
                    disabled={inviandoEmailStampa || !hasEmailOrd}
                    title={
                      hasEmailOrd
                        ? `Invia PDF a ${emailOrd} con CC automatico al Tesoriere`
                        : 'Email ordinaria (non PEC) non presente per questo destinatario'
                    }
                    onClick={async () => {
                      const ok = await inviaDocumentoContabileViaEmail(
                        documentoPerStampa.tipo === 'nota' ? 'nota' : 'ricevuta',
                        documentoPerStampa.data
                      );
                      if (ok) setDocumentoPerStampa(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>{inviandoEmailStampa ? 'Invio in corso...' : 'Invia Email (CC Tesoriere)'}</span>
                  </button>
                );
              })()}
              <button
                type="button"
                disabled={inviandoEmailStampa}
                onClick={handleStampaDocumento}
                className="px-5 py-2.5 rounded-xl bg-[#1d1a60] hover:bg-[#141245] text-white font-black text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>{inviandoEmailStampa ? 'Elaborazione in corso...' : 'Stampa Documento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE WORKFLOW PRE-GENERAZIONE PDF (Anteprima / Anteprima & Stampa / Salva in Archivio / Salva & Invia / Torna alla Modifica) */}
      {bozzaPdfWorkflow && (() => {
        const tesoriereAttivo = getTesoriereAttivo(volontari);
        const isNotaORicevuta = bozzaPdfWorkflow.tipo === 'nota' || bozzaPdfWorkflow.tipo === 'ricevuta';
        const emailDestOrd = isNotaORicevuta && !bozzaPdfWorkflow.data.emailNonDisponibile
          ? (bozzaPdfWorkflow.data.emailDestinatario || '').trim()
          : '';
        const hasValidEmailOrd = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailDestOrd);

        return (
          <PdfAnteprimaWorkflowModal
            aperto={true}
            titoloDocumento={
              bozzaPdfWorkflow.tipo === 'tessera'
                ? `Ricevuta Tesseramento ${bozzaPdfWorkflow.data.numeroTessera}`
                : bozzaPdfWorkflow.tipo === 'nota'
                  ? `Nota di Debito ${bozzaPdfWorkflow.data.numeroProgressivo}`
                  : `Ricevuta Contabile ${bozzaPdfWorkflow.data.numeroProgressivo}`
            }
            sottotitolo={
              bozzaPdfWorkflow.tipo === 'tessera'
                ? `${bozzaPdfWorkflow.data.socioNome} ${bozzaPdfWorkflow.data.socioCognome} • € ${Number(bozzaPdfWorkflow.data.quotaVersata || 0).toFixed(2)}`
                : bozzaPdfWorkflow.tipo === 'nota'
                  ? `${bozzaPdfWorkflow.data.debitoreIntestatario} • € ${Number(bozzaPdfWorkflow.data.importoTotale || 0).toFixed(2)}`
                  : `${bozzaPdfWorkflow.data.intestatario} • € ${Number(bozzaPdfWorkflow.data.importoTotale || 0).toFixed(2)}`
            }
            nomeFile={
              bozzaPdfWorkflow.tipo === 'tessera'
                ? `Ricevuta_Tesseramento_${String(bozzaPdfWorkflow.data.numeroTessera || 'tessera').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
                : bozzaPdfWorkflow.tipo === 'nota'
                  ? `Nota_Di_Debito_${String(bozzaPdfWorkflow.data.numeroProgressivo || 'nota').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
                  : `Ricevuta_${String(bozzaPdfWorkflow.data.numeroProgressivo || 'ricevuta').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
            }
            giaSalvatoInArchivio={bozzaPdfWorkflow.salvato}
            generaPdfBytes={() => {
              if (bozzaPdfWorkflow.tipo === 'tessera') {
                const vol = preparaVolontarioDaTessera(bozzaPdfWorkflow.data, volontari);
                return generaBytesDaJsPDF(generaRicevutaTesseramentoPDF(vol, undefined, tesoriereAttivo));
              }
              if (bozzaPdfWorkflow.tipo === 'nota') {
                return generaBytesDaJsPDF(generaNotaDiDebitoPDF(bozzaPdfWorkflow.data, tesoriereAttivo));
              }
              return generaBytesDaJsPDF(generaRicevutaContabilePDF(bozzaPdfWorkflow.data, tesoriereAttivo));
            }}
            riepilogoContenuto={
              bozzaPdfWorkflow.tipo === 'tessera' ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-mono font-bold text-[#1d1a60]">
                    <span>Tessera N.: {bozzaPdfWorkflow.data.numeroTessera}</span>
                    <span>Data: {bozzaPdfWorkflow.data.dataEmissione}</span>
                  </div>
                  <div>Socio: <strong>{bozzaPdfWorkflow.data.socioNome} {bozzaPdfWorkflow.data.socioCognome}</strong></div>
                  <div>Codice Fiscale: <strong className="font-mono">{bozzaPdfWorkflow.data.socioCodiceFiscale}</strong></div>
                  <div>Qualifica: <strong>{bozzaPdfWorkflow.data.qualifica}</strong></div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-emerald-700 text-sm">
                    <span>Quota Associativa:</span>
                    <span>€ {Number(bozzaPdfWorkflow.data.quotaVersata || 0).toFixed(2)}</span>
                  </div>
                </div>
              ) : bozzaPdfWorkflow.tipo === 'nota' ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-mono font-bold text-[#1d1a60]">
                    <span>Nota di Debito: {bozzaPdfWorkflow.data.numeroProgressivo}</span>
                    <span>Data: {bozzaPdfWorkflow.data.dataEmissione}</span>
                  </div>
                  <div>Debitore: <strong>{bozzaPdfWorkflow.data.debitoreIntestatario}</strong></div>
                  {bozzaPdfWorkflow.data.partitaIvaCodiceFiscale && (
                    <div>P.IVA / CF: <strong className="font-mono">{bozzaPdfWorkflow.data.partitaIvaCodiceFiscale}</strong></div>
                  )}
                  <div>
                    Email: {bozzaPdfWorkflow.data.emailNonDisponibile ? <em className="text-amber-700">Non in possesso</em> : <strong className="font-mono">{bozzaPdfWorkflow.data.emailDestinatario}</strong>}
                  </div>
                  <div>
                    PEC: {bozzaPdfWorkflow.data.pecNonDisponibile ? <em className="text-amber-700">Non in possesso</em> : <strong className="font-mono">{bozzaPdfWorkflow.data.pecDestinatario}</strong>}
                  </div>
                  <div className="pt-1 border-t border-slate-200">
                    <strong>Causale:</strong> {bozzaPdfWorkflow.data.causale}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-purple-900 text-sm">
                    <span>Totale da Liquidare:</span>
                    <span>€ {Number(bozzaPdfWorkflow.data.importoTotale || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    Scadenza: {bozzaPdfWorkflow.data.scadenzaPagamento} • {bozzaPdfWorkflow.data.metodoPagamento}
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    Firma sul PDF: <strong>{tesoriereAttivo.nome} {tesoriereAttivo.cognome}</strong> ({tesoriereAttivo.carica})
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-mono font-bold text-[#1d1a60]">
                    <span>Ricevuta N.: {bozzaPdfWorkflow.data.numeroProgressivo}</span>
                    <span>Data: {bozzaPdfWorkflow.data.dataEmissione}</span>
                  </div>
                  <div className="text-[11px] uppercase font-bold text-slate-600">Tipologia: {bozzaPdfWorkflow.data.tipologia}</div>
                  <div>Intestatario: <strong>{bozzaPdfWorkflow.data.intestatario}</strong></div>
                  {bozzaPdfWorkflow.data.codiceFiscalePartitaIva && (
                    <div>CF / P.IVA: <strong className="font-mono">{bozzaPdfWorkflow.data.codiceFiscalePartitaIva}</strong></div>
                  )}
                  <div>
                    Email: {bozzaPdfWorkflow.data.emailNonDisponibile ? <em className="text-amber-700">Non in possesso</em> : <strong className="font-mono">{bozzaPdfWorkflow.data.emailDestinatario}</strong>}
                  </div>
                  <div>
                    PEC: {bozzaPdfWorkflow.data.pecNonDisponibile ? <em className="text-amber-700">Non in possesso</em> : <strong className="font-mono">{bozzaPdfWorkflow.data.pecDestinatario}</strong>}
                  </div>
                  <div className="pt-1 border-t border-slate-200">
                    <strong>Causale:</strong> {bozzaPdfWorkflow.data.causale}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-emerald-700 text-sm">
                    <span>Importo Quietanzato:</span>
                    <span>€ {Number(bozzaPdfWorkflow.data.importoTotale || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    Incasso: {bozzaPdfWorkflow.data.metodoPagamento}
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    Firma sul PDF: <strong>{tesoriereAttivo.nome} {tesoriereAttivo.cognome}</strong> ({tesoriereAttivo.carica})
                  </div>
                </div>
              )
            }
            infoInvioEmail={
              isNotaORicevuta ? (
                hasValidEmailOrd ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-100">
                    <span className="inline-flex items-center gap-1 font-black uppercase text-amber-300">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Salva & Invia:</span>
                    </span>
                    <span>
                      Destinatario: <strong className="font-mono text-white">{emailDestOrd}</strong>
                    </span>
                    <span className="text-amber-200/90">
                      • In copia (CC) Tesoriere: <strong className="font-mono text-amber-300">{tesoriereAttivo.email}</strong> ({tesoriereAttivo.nome} {tesoriereAttivo.cognome})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-[11px] text-slate-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Email ordinaria (non PEC) non indicata per il destinatario: il tasto <strong>Salva & Invia</strong> è disabilitato. Puoi comunque usare <strong>Salva in Archivio</strong> o tornare indietro per inserirla.
                    </span>
                  </div>
                )
              ) : undefined
            }
            salvaEInviaDisabilitato={isNotaORicevuta ? !hasValidEmailOrd : undefined}
            onSalvaEInvia={
              isNotaORicevuta
                ? async (pdfBytes) => {
                    if (!bozzaPdfWorkflow.salvato) {
                      if (bozzaPdfWorkflow.tipo === 'nota') {
                        salvaBozzaNotaInArchivio(bozzaPdfWorkflow.data);
                      } else {
                        salvaBozzaRicevutaInArchivio(bozzaPdfWorkflow.data);
                      }
                      setBozzaPdfWorkflow((prev) => (prev ? { ...prev, salvato: true } : null));
                    }
                    return await inviaDocumentoContabileViaEmail(
                      bozzaPdfWorkflow.tipo === 'nota' ? 'nota' : 'ricevuta',
                      bozzaPdfWorkflow.data,
                      pdfBytes
                    );
                  }
                : undefined
            }
            onSalvaInArchivio={() => {
              if (bozzaPdfWorkflow.tipo === 'tessera') {
                salvaBozzaTesseraInArchivio(bozzaPdfWorkflow.data);
              } else if (bozzaPdfWorkflow.tipo === 'nota') {
                salvaBozzaNotaInArchivio(bozzaPdfWorkflow.data);
              } else {
                salvaBozzaRicevutaInArchivio(bozzaPdfWorkflow.data);
              }
              setBozzaPdfWorkflow((prev) => (prev ? { ...prev, salvato: true } : null));
            }}
            onTornaAllaModifica={() => {
              const tipo = bozzaPdfWorkflow.tipo;
              setBozzaPdfWorkflow(null);
              if (tipo === 'tessera') setModaleNuovaTesseraAperta(true);
              else if (tipo === 'nota') setModaleNuovaNotaAperta(true);
              else setModaleNuovaRicevutaAperta(true);
            }}
            onChiudi={() => setBozzaPdfWorkflow(null)}
            onFeedback={(msg) => mostraAvviso(msg)}
          />
        );
      })()}
    </div>
  );
};
