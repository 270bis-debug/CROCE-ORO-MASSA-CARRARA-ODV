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
  SlidersHorizontal
} from 'lucide-react';
import { useTitoloDatabase } from '../../hooks/useNomiDatabase';
import {
  TesseraAssociativa,
  NotaDiDebito,
  ContattoEsterno,
  InterventoManutenzione,
  SedeAssociativaCompleta,
  TariffaCostoServizio,
  VoceNotaDiDebito,
  ProprietarioImmobileData
} from '../../types/adminTypes';
import { TARIFFE_COSTI_SERVIZIO_INIZIALI } from '../../data/adminMockData';
import { DICITURA_ESENZIONE_BOLLO } from '../../data/tesseramento';
import { Volontario } from '../DatabaseVolontariModal';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import {
  stampaEInviaRicevutaTesseramento,
  preparaVolontarioDaTessera,
  getTesoriereAttivo
} from '../../utils/pdfRicevutaTesseramento';
import { scaricaNotaDiDebitoPDF } from '../../utils/pdfNotaDiDebito';
import { getDatiCartaIntestata } from '../../utils/cartaIntestataStore';
import {
  calcolaProspettoCommercialista,
  scaricaProspettoCommercialistaCSV,
  ProspettoAnnualeCommercialista,
  RigaProspettoMensile
} from '../../utils/prospettoCommercialista';
import { RIFORNIMENTI_INIZIALI } from '../../data/rifornimentiMockData';
import { RifornimentoCarburante } from '../../types/consumiTypes';
import { addDaysISODate, formatISODateItaly, getCurrentYearItaly } from '../../utils/italianTime';

interface SezioneContabilitaProps {
  serviziArchivio: any[];
  tessere: TesseraAssociativa[];
  onAggiornaTessere: (tessere: TesseraAssociativa[]) => void;
  noteDiDebito: NotaDiDebito[];
  onAggiornaNoteDiDebito: (note: NotaDiDebito[]) => void;
  costiServizio?: TariffaCostoServizio[];
  onAggiornaCostiServizio?: (tariffe: TariffaCostoServizio[]) => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  volontari?: Volontario[];
  contatti?: ContattoEsterno[];
  onAggiungiContatto?: (contatto: ContattoEsterno) => void;
  manutenzioni?: InterventoManutenzione[];
  rifornimenti?: RifornimentoCarburante[];
  sedi?: SedeAssociativaCompleta[];
}

export const SezioneContabilita: React.FC<SezioneContabilitaProps> = ({
  serviziArchivio,
  tessere,
  onAggiornaTessere,
  noteDiDebito,
  onAggiornaNoteDiDebito,
  costiServizio: costiServizioProp,
  onAggiornaCostiServizio,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  volontari = [],
  contatti = [],
  onAggiungiContatto,
  manutenzioni = [],
  rifornimenti: rifornimentiProp,
  sedi = []
}) => {
  const [sottoTab, setSottoTab] = useState<'donazioni' | 'tesseramento' | 'noteDebito' | 'commercialista' | 'costiServizio'>('donazioni');
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

  // Rifornimenti per calcolo uscite carburante
  const rifornimentiCarburante: RifornimentoCarburante[] = React.useMemo(() => {
    if (rifornimentiProp && rifornimentiProp.length > 0) return rifornimentiProp;
    try {
      const s = localStorage.getItem('CROCE_ORO_RIFORNIMENTI_MEZZI');
      if (s) return JSON.parse(s);
    } catch {}
    return RIFORNIMENTI_INIZIALI;
  }, [rifornimentiProp]);

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

  const [filtroCategoriaTariffa, setFiltroCategoriaTariffa] = useState<'tutti' | NonNullable<TariffaCostoServizio['categoria']>>('tutti');
  const [editingTariffaId, setEditingTariffaId] = useState<string | null>(null);
  const [formTariffaCategoria, setFormTariffaCategoria] = useState<NonNullable<TariffaCostoServizio['categoria']>>('mezzo_km');
  const [formTariffaSigla, setFormTariffaSigla] = useState('');
  const [formTariffaDescrizioneSigla, setFormTariffaDescrizioneSigla] = useState('');
  const [formTariffaNome, setFormTariffaNome] = useState('');
  const [formTariffaImporto, setFormTariffaImporto] = useState('0');
  const [formTariffaUnita, setFormTariffaUnita] = useState('km');
  const [formTariffaNote, setFormTariffaNote] = useState('');
  const [confermaEliminaTariffaId, setConfermaEliminaTariffaId] = useState<string | null>(null);

  // Modale Anteprima Documento per Stampa (Tessera o Nota di Debito)
  const [documentoPerStampa, setDocumentoPerStampa] = useState<{ tipo: 'tessera' | 'nota'; data: any } | null>(null);
  const [inviandoEmailStampa, setInviandoEmailStampa] = useState(false);

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
  const [formDonazioneCodice, setFormDonazioneCodice] = useState('');
  const [formDonazionePaziente, setFormDonazionePaziente] = useState('');
  const [formDonazioneData, setFormDonazioneData] = useState(() => formatISODateItaly());
  const [formDonazioneImporto, setFormDonazioneImporto] = useState('');
  const [formDonazioneMetodo, setFormDonazioneMetodo] = useState<'Contanti' | 'Bonifico Bancario IBAN' | 'POS / Carta' | 'Assegno Bancario'>('Contanti');
  const [formDonazioneRicevuta, setFormDonazioneRicevuta] = useState('');
  const [formDonazioneMezzo, setFormDonazioneMezzo] = useState('T4606');
  const [formDonazioneNote, setFormDonazioneNote] = useState('');
  const [donazioniExtra, setDonazioniExtra] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('croceoro_donazioni_extra_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Chiusura accessibile dei modali con tasto ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modaleNuovaNotaAperta) setModaleNuovaNotaAperta(false);
        if (modaleNuovaDonazioneAperta) setModaleNuovaDonazioneAperta(false);
        if (modaleNuovaTesseraAperta) setModaleNuovaTesseraAperta(false);
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

  // Lista unificata di donazioni: servizi archivio + donazioni extra registrate
  const tuttiServiziDonazioni = React.useMemo(() => {
    return [...donazioniExtra, ...serviziArchivio];
  }, [donazioniExtra, serviziArchivio]);

  // =========================================================================
  // 1. FILTRO ESCLUSIVO: SOLO SERVIZI CON DONAZIONI
  // =========================================================================
  const serviziConDonazioni = tuttiServiziDonazioni.filter((s) => {
    const importo = parseFloat(s.donazioneLibera || s.importoDonazione || s.offertaLibera || (s.donazione && s.donazione.somma) || '0');
    const haDonazione = Boolean(
      (importo > 0) ||
      (s.donazioneRicevuta && s.donazioneRicevuta !== '0' && s.donazioneRicevuta !== '') ||
      (s.ricevutaDonazione && s.ricevutaDonazione !== '')
    );
    if (!haDonazione) return false;

    const matchRicerca =
      !ricerca.trim() ||
      (s.codice && s.codice.toLowerCase().includes(ricerca.toLowerCase())) ||
      (s.paziente && s.paziente.toLowerCase().includes(ricerca.toLowerCase())) ||
      (s.mezzo && s.mezzo.toLowerCase().includes(ricerca.toLowerCase())) ||
      (s.destinazione && s.destinazione.toLowerCase().includes(ricerca.toLowerCase()));

    const matchMese = !filtroMese || (s.data && s.data.startsWith(filtroMese));

    return matchRicerca && matchMese;
  });

  const totaleDonazioniIncassate = serviziConDonazioni.reduce((acc, curr) => {
    const val = parseFloat(curr.donazioneLibera || curr.importoDonazione || curr.offertaLibera || (curr.donazione && curr.donazione.somma) || '0') || 0;
    return acc + val;
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
      'Mezzo',
      'N. Ricevuta Fiscale',
      'Volontario / Operatore',
      'Note / Destinazione'
    ];

    const righe = serviziConDonazioni.map((s) => {
      const imp = parseFloat(s.donazioneLibera || s.importoDonazione || s.offertaLibera || (s.donazione && s.donazione.somma) || '0') || 0;
      const metodo = s.metodoDonazione || s.metodoPagamento || s.donazioneMetodo || (s.ricevutaDonazione ? 'Ricevuta Fiscale' : 'Contanti');
      const paziente = (s.paziente || s.richiedente || 'Anonimo').replace(/"/g, '""');
      const codice = (s.codice || '').replace(/"/g, '""');
      const mezzo = (s.mezzo || 'N/D').replace(/"/g, '""');
      const ricevuta = (s.ricevutaDonazione || 'Art. 82 D.Lgs 117/2017').replace(/"/g, '""');
      const volontario = (s.volontarioNome || 'Equipaggio').replace(/"/g, '""');
      const note = (s.destinazione || s.luogoIntervento || s.note || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');

      return `"${s.data || ''}";"${codice}";"${imp.toFixed(2)}";"${metodo}";"${paziente}";"${mezzo}";"${ricevuta}";"${volontario}";"${note}"`;
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

  // Registrazione nuova donazione con validazione soglie
  const handleRegistraNuovaDonazione = (e: React.FormEvent) => {
    e.preventDefault();
    if (erroreImportoDonazione || isNaN(importoNumerico) || importoNumerico <= 0 || importoNumerico > 10000) {
      mostraAvviso('Importo non valido: controlla i parametri di inserimento.');
      return;
    }

    const annoCorr = getCurrentYearItaly();
    const nuovaDonazione = {
      id: `don-${Date.now()}`,
      codice: formDonazioneCodice.trim() || `MIS-${annoCorr}-${String(Date.now()).slice(-4)}`,
      data: formDonazioneData || formatISODateItaly(),
      paziente: formDonazionePaziente.trim() || 'Donatore Anonimo',
      donazioneLibera: importoNumerico.toFixed(2),
      importoDonazione: importoNumerico.toFixed(2),
      metodoDonazione: formDonazioneMetodo,
      metodoPagamento: formDonazioneMetodo,
      ricevutaDonazione: formDonazioneRicevuta.trim() || `DON-${annoCorr}/${String(serviziConDonazioni.length + 1).padStart(3, '0')}`,
      mezzo: formDonazioneMezzo.trim() || 'T4606',
      destinazione: formDonazioneNote.trim() || 'Erogazione liberale a sostegno delle attività istituzionali',
      volontarioNome: operatoreCorrente,
      tipoServizio: 'Donazione Volontaria'
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

    onAggiornaTessere([nuova, ...tessere]);
    setModaleNuovaTesseraAperta(false);
    onNotificaRadio?.(`💳 TESSERAMENTO: Emessa nuova tessera ${nuova.numeroTessera} per ${nuova.socioNome} ${nuova.socioCognome}`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nuova tessera socio emessa',
        `Emessa tessera socio ${nuova.numeroTessera} per ${nuova.socioNome} ${nuova.socioCognome} (quota: € ${nuova.quotaVersata})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Nuova tessera ${nuova.numeroTessera} emessa con successo per ${nuova.socioNome} ${nuova.socioCognome}.`);
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
    setFormTariffaUnita('km');
    setFormTariffaNote('');
  };

  const handleEmettiNotaDiDebito = (e: React.FormEvent) => {
    e.preventDefault();
    const isPoste = formNotaMetodo.includes('Poste') || formNotaMetodo.includes('00001007035676') || formNotaMetodo.includes('C/C Postale');
    const isCredit = formNotaMetodo.includes('Credit Agricole') || formNotaMetodo.includes('Agricole') || (!isPoste && formNotaMetodo.includes('Bonifico'));

    const contoAccredito = isPoste ? 'Poste Italiane' : isCredit ? 'Credit Agricole' : 'Altro';
    const ibanAccredito = isPoste ? ibanPoste : isCredit ? ibanCreditAgricole : undefined;
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

    onAggiornaNoteDiDebito([nuovaNota, ...noteDiDebito]);
    setModaleNuovaNotaAperta(false);
    onNotificaRadio?.(`📑 NOTA DI DEBITO: Emessa nuova nota ${nuovaNota.numeroProgressivo} di € ${nuovaNota.importoTotale.toFixed(2)} a ${nuovaNota.debitoreIntestatario}`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        'Nuova nota di debito emessa',
        `Emessa nota di debito ${nuovaNota.numeroProgressivo} a ${nuovaNota.debitoreIntestatario} (€ ${nuovaNota.importoTotale.toFixed(2)} - causale: ${nuovaNota.causale})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Nota di Debito ${nuovaNota.numeroProgressivo} emessa con successo.`);
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

  // Stampa Documento con Firma Automatica del Tesoriere e Invio Email con Allegato PDF
  const handleStampaDocumento = async () => {
    if (!documentoPerStampa) return;
    if (documentoPerStampa.tipo === 'tessera') {
      setInviandoEmailStampa(true);
      try {
        const vol = preparaVolontarioDaTessera(documentoPerStampa.data, volontari);
        const res = await stampaEInviaRicevutaTesseramento(vol, undefined, volontari);
        const tesoriere = getTesoriereAttivo(volontari);
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
        scaricaNotaDiDebitoPDF(documentoPerStampa.data);
        mostraAvviso(`Nota di Debito ${documentoPerStampa.data.numeroProgressivo} stampata e generata con successo in PDF ufficiale!`);
        onNotificaRadio?.(
          `📄 NOTA DI DEBITO: Stampato documento ufficiale PDF per la nota n. ${documentoPerStampa.data.numeroProgressivo} intestata a ${documentoPerStampa.data.debitoreIntestatario}`,
          'centrale'
        );
        setDocumentoPerStampa(null);
      } catch (err: any) {
        console.error('Errore generazione PDF nota di debito:', err);
        mostraAvviso(`Errore nella stampa della nota di debito: ${err?.message || 'Errore'}`);
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

  // Prospetto Annuale e Mensile per il Commercialista
  const prospettoCommercialista: ProspettoAnnualeCommercialista = React.useMemo(() => {
    return calcolaProspettoCommercialista(
      annoProspetto,
      tuttiServiziDonazioni,
      tessereComplete,
      noteDiDebito,
      manutenzioni,
      rifornimentiCarburante
    );
  }, [annoProspetto, tuttiServiziDonazioni, tessereComplete, noteDiDebito, manutenzioni, rifornimentiCarburante]);

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

      {/* Barra Navigazione Sotto-Categorie */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
        <button
          type="button"
          onClick={() => setSottoTab('donazioni')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'donazioni'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Heart className="w-4 h-4 text-pink-400" />
          <span>1. Servizi con Donazioni ({serviziConDonazioni.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('tesseramento')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'tesseramento'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>2. Tesseramento & Soci ({tessere.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('noteDebito')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'noteDebito'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>3. Note di Debito ({noteDiDebito.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('commercialista')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            sottoTab === 'commercialista'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>4. Prospetto Mensile Commercialista</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('costiServizio')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            sottoTab === 'costiServizio'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Tag className="w-4 h-4 text-amber-400" />
          <span>5. Costi di Servizio ({tariffeCostiServizio.length})</span>
        </button>
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
                  setFormDonazioneImporto('');
                  setFormDonazioneCodice('');
                  setFormDonazionePaziente('');
                  setFormDonazioneMetodo('Contanti');
                  setFormDonazioneRicevuta(`DON-${getCurrentYearItaly()}/${String(serviziConDonazioni.length + 1).padStart(3, '0')}`);
                  setFormDonazioneMezzo('T4606');
                  setFormDonazioneNote('');
                  setFormDonazioneData(formatISODateItaly());
                  setModaleNuovaDonazioneAperta(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer transition-all"
                title="Registra una nuova donazione con verifica importo"
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
                    <th className="py-3 px-4">Paziente / Richiedente</th>
                    <th className="py-3 px-4">Mezzo & Tratta</th>
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
                      const imp = parseFloat(s.donazioneLibera || s.importoDonazione || s.offertaLibera || '0') || 0;
                      return (
                        <tr key={s.id || s.codice} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                              {s.codice}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-1">{s.data}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm">{s.paziente || 'Richiedente Privato'}</div>
                            <div className="text-[11px] text-slate-400">{s.tipoServizio || 'Trasporto Sanitario'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-300 font-bold">{s.mezzo || 'T4606'}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{s.destinazione || s.luogoIntervento}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                            € {imp.toFixed(2)}
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

          {/* Tabella Tessere */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
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

                    return (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
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

          {/* Barra Azioni Selezione Multipla */}
          {selectedNoteIds.length > 0 && (
            <div className="bg-red-950/50 border-2 border-red-500/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-red-200">
                <CheckSquare className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>{selectedNoteIds.length}</strong> nota/e di debito selezionata/e dall'archivio
                </span>
                <span className="text-[10px] text-red-300/80 bg-red-900/60 px-2 py-0.5 rounded-full border border-red-700/60">
                  Notifica via email a presidenza@croceoro.org e tesoreria@croceoro.org
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNoteIds([])}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Deseleziona
                </button>
                <button
                  type="button"
                  onClick={apriEliminaNoteSelezionate}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Rimuovi selezionate ({selectedNoteIds.length})</span>
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
                    <th className="py-3 px-4">Mese ({annoProspetto})</th>
                    <th className="py-3 px-4 font-mono text-pink-400">Donazioni (€)</th>
                    <th className="py-3 px-4 font-mono text-blue-400">Tesseramento (€)</th>
                    <th className="py-3 px-4 font-mono text-purple-400">Note Debito (€)</th>
                    <th className="py-3 px-4 font-mono text-emerald-400 font-black">Tot. Entrate (€)</th>
                    <th className="py-3 px-4 font-mono text-slate-300">Manutenzioni (€)</th>
                    <th className="py-3 px-4 font-mono text-amber-400">Carburante (€)</th>
                    <th className="py-3 px-4 font-mono text-rose-400 font-black">Tot. Uscite (€)</th>
                    <th className="py-3 px-4 font-mono text-center">Saldo Netto (€)</th>
                    <th className="py-3 px-4 text-right">Dettagli</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {prospettoCommercialista.mesi.map((m) => {
                    const isPositivo = m.saldoNetto >= 0;
                    const haMovimenti = m.totaleEntrate > 0 || m.totaleUscite > 0;
                    return (
                      <tr key={m.meseNumero} className="hover:bg-slate-900/50 transition-colors">
                        {/* Nome Mese */}
                        <td className="py-3 px-4 font-black text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-center font-mono text-slate-400">
                              {m.meseNumero}
                            </span>
                            <span>{m.nomeMese}</span>
                          </div>
                        </td>

                        {/* Donazioni */}
                        <td className="py-3 px-4 font-mono">
                          <div className="font-bold text-pink-300">€ {m.totaleDonazioni.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioDonazioni} donazioni</div>
                        </td>

                        {/* Tesseramento Soci */}
                        <td className="py-3 px-4 font-mono">
                          <div className="font-bold text-blue-300">€ {m.totaleTessere.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioTessere} tessere</div>
                        </td>

                        {/* Note di Debito */}
                        <td className="py-3 px-4 font-mono">
                          <div className="font-bold text-purple-300">€ {m.totaleNoteDebito.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioNoteDebito} fatture</div>
                        </td>

                        {/* TOTALE ENTRATE */}
                        <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm bg-emerald-950/10">
                          € {m.totaleEntrate.toFixed(2)}
                        </td>

                        {/* Manutenzioni */}
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div>€ {m.totaleManutenzioni.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioManutenzioni} interventi</div>
                        </td>

                        {/* Carburante */}
                        <td className="py-3 px-4 font-mono text-amber-300">
                          <div>€ {m.totaleCarburante.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-500">{m.conteggioRifornimenti} pieni</div>
                        </td>

                        {/* TOTALE USCITE */}
                        <td className="py-3 px-4 font-mono font-black text-rose-400 text-sm bg-rose-950/10">
                          € {m.totaleUscite.toFixed(2)}
                        </td>

                        {/* SALDO NETTO MENSILE */}
                        <td className="py-3 px-4 font-mono text-center">
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

                        {/* Azioni */}
                        <td className="py-3 px-4 text-right">
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
                    <td className="py-4 px-4 text-white uppercase tracking-wider">
                      TOTALE ESERCIZIO {annoProspetto}
                    </td>
                    <td className="py-4 px-4 font-mono text-pink-400">
                      € {prospettoCommercialista.totali.totaleDonazioni.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-blue-400">
                      € {prospettoCommercialista.totali.totaleTessere.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-purple-400">
                      € {prospettoCommercialista.totali.totaleNoteDebito.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-emerald-400 text-base bg-emerald-950/30">
                      € {prospettoCommercialista.totali.totaleEntrate.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      € {prospettoCommercialista.totali.totaleManutenzioni.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-amber-400">
                      € {prospettoCommercialista.totali.totaleCarburante.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-rose-400 text-base bg-rose-950/30">
                      € {prospettoCommercialista.totali.totaleUscite.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-center">
                      <span className={`inline-block px-3 py-1 rounded-xl font-black text-sm shadow ${
                        prospettoCommercialista.totali.saldoNettoEsercizio >= 0
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-rose-600 text-white font-black'
                      }`}>
                        {prospettoCommercialista.totali.saldoNettoEsercizio >= 0 ? '+' : ''}€ {prospettoCommercialista.totali.saldoNettoEsercizio.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-slate-500 font-mono text-[10px]">
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
              {(['tutti', 'mezzo_km', 'uscita_mezzo', 'operatore', 'editabile'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCategoriaTariffa(cat)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase cursor-pointer border transition-all ${
                    filtroCategoriaTariffa === cat
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {cat === 'tutti'
                    ? 'Tutte'
                    : cat === 'mezzo_km'
                    ? 'Mezzo al KM'
                    : cat === 'uscita_mezzo'
                    ? 'Uscita Mezzo'
                    : cat === 'operatore'
                    ? 'Operatori'
                    : 'Voci Editabili'}
                </button>
              ))}
            </div>
          </div>

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
                    setFormTariffaUnita('km');
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
                    const c = e.target.value as NonNullable<TariffaCostoServizio['categoria']>;
                    setFormTariffaCategoria(c);
                    if (!editingTariffaId) {
                      setFormTariffaUnita(c === 'mezzo_km' ? 'km' : c === 'operatore' ? 'ora' : c === 'uscita_mezzo' ? 'uscita' : 'servizio');
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="mezzo_km">Costo Mezzo al KM</option>
                  <option value="uscita_mezzo">Costo Uscita Mezzo</option>
                  <option value="operatore">Costo Operatori / Equipaggio</option>
                  <option value="editabile">Voce Editabile / Personalizzata</option>
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
                            {catEff === 'mezzo_km'
                              ? 'Mezzo/KM'
                              : catEff === 'uscita_mezzo'
                              ? 'Uscita Mezzo'
                              : catEff === 'operatore'
                              ? 'Operatore'
                              : 'Editabile'}
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
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Mezzo Operativo
                  </label>
                  <input
                    type="text"
                    placeholder="es. T4606 Ambulanza"
                    value={formDonazioneMezzo}
                    onChange={(e) => setFormDonazioneMezzo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-purple-500"
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
                    onChange={(e) => setFormDonazioneMetodo(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="Contanti">Contanti (Cassa Sede)</option>
                    <option value="Bonifico Bancario IBAN">Bonifico Bancario IBAN</option>
                    <option value="POS / Carta">POS / Carta di Credito</option>
                    <option value="Assegno Bancario">Assegno Bancario</option>
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
                      2 Conti Attivi
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
                  </select>
                </div>

                {/* Riquadro Dettaglio Coordinate e Verifica IBAN Sedi Associative */}
                {(() => {
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
                  {documentoPerStampa.tipo === 'tessera' ? 'Ricevuta Tesseramento & Quota Sociale' : 'Nota di Debito Ufficiale'}
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0 mt-2">
              <button
                type="button"
                disabled={inviandoEmailStampa}
                onClick={handleStampaDocumento}
                className="px-5 py-2.5 rounded-xl bg-[#1d1a60] hover:bg-[#141245] text-white font-black text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>{inviandoEmailStampa ? 'Stampa & Invio Email in corso...' : 'Stampa Documento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
