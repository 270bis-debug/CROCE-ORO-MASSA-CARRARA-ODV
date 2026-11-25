import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Search,
  PlusCircle,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  Users,
  AlertTriangle,
  FileCheck2,
  Edit2,
  Trash2,
  UserPlus,
  BookOpen,
  MapPin,
  Sparkles,
  Save,
  X,
  Check,
  ShieldCheck,
  ShieldAlert,
  Building2,
  CheckSquare,
  Square,
  Navigation,
  Crosshair,
  Sliders,
  Eye,
  AlertCircle,
  Download,
  ListPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Share2,
  Mail,
  Send,
  FileUp,
  Hash,
  Printer,
  Link2,
  Copy,
  Phone,
  Power
} from 'lucide-react';
import { useTitoloDatabase, useNomiSottosezioniCustom } from '../../hooks/useNomiDatabase';
import { getTitoloSottosezione } from '../../constants/macroCategorie';
import { formatIconaPerTesto } from '../../utils/emojiIconsArchive';
import {
  CorsoFormazione,
  PartecipanteCorso,
  TipologiaCorso,
  LezioneCorso,
  SedeAssociativaCompleta
} from '../../types/adminTypes';
import { Volontario } from '../DatabaseVolontariModal';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import {
  isCorsoVisibileInBacheca,
  formatDataItalianaCorso,
  getDataInizioEffettivaCorso
} from '../../utils/bachecaCorsi';
import {
  getMansioniCatalogo,
  volontarioHaMansione,
  assegnaMansioneAVolontario,
  getStileMansione
} from '../../utils/mansioniVolontari';
import {
  scaricaAttestatoPDF,
  avviaDownloadAttestatoUniversale,
  condividiAttestatoPDF,
  generaNumeroAttestato,
  determinaCittaPrevalenteCorso,
  formattaIntervalloDateItaliano,
  formattaDataSlash
} from '../../utils/pdfAttestatoCorso';
import {
  consumaProssimaMatricolaCategoria,
  getModelloPerTipologia,
  EVENTO_MODELLI_ATTESTATI_UPDATED
} from '../../utils/modelliAttestatiStore';
import { realtime } from '../../services/realtime';
import { PannelloModelliAttestatiPdf } from './PannelloModelliAttestatiPdf';
import { PannelloAuleFormazione } from './PannelloAuleFormazione';
import {
  useAuleFormazione,
  generaTokenLinkTimbraturaEsterni,
  buildLinkTimbraturaCorsoEsterno,
  risolviTargetAulaDidattica
} from '../../utils/auleFormazione';
import { PdfAnteprimaWorkflowModal } from './PdfAnteprimaWorkflowModal';
import { scaricaOStampaMultipliPDF, PdfBatchItem } from '../../utils/pdfWorkflowUtils';
import { addDaysISODate, formatDateTimeItaly, formatISODateItaly, getCurrentYearItaly } from '../../utils/italianTime';

export const TIPOLOGIE_CORSO_CONSENTITE: TipologiaCorso[] = [
  'Seminario PSV',
  'Formazione PSV',
  'Seminario Autisti',
  'BLSD',
  'Protezione Civile Corso 0',
  'Protezione Civile Corso Base'
];

export const SEDI_TERRITORIALI_GPS = [
  {
    id: 'sede-massa-ronchi',
    codice: 'SEDE-01-RONCHI',
    nome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    indirizzo: 'Via Como, 12 Località Ronchi, 54100 Marina di Massa (MS)',
    lat: 43.99419,
    lng: 10.12367
  },
  {
    id: 'sede-massa-lejare',
    codice: 'SEDE-02-LEJARE',
    nome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)',
    indirizzo: 'Via Delle Jare, 9, 54100 Massa (MS)',
    lat: 44.01700,
    lng: 10.15121
  },
  {
    id: 'sede-carrara-fossone',
    codice: 'SEDE-03-FOSSONE',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    indirizzo: 'Strada Comunale di Monteverde, 49 Località Fossone, 54033 Carrara (MS)',
    lat: 44.066716,
    lng: 10.049207
  },
  {
    id: 'sede-pietrasanta',
    codice: 'SEDE-04-PIETRASANTA',
    nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)',
    indirizzo: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta, 55045 Pietrasanta (LU)',
    lat: 43.92771,
    lng: 10.20194
  },
  {
    id: 'sede-lunigiana',
    codice: 'SEDE-05-LUNIGIANA',
    nome: 'Sezione Territoriale Lunigiana (Aulla)',
    indirizzo: 'Piazza Cavour / Piazza della Vittoria, 54011 Aulla (MS)',
    lat: 44.21455,
    lng: 9.96779
  }
];

interface SezioneFormazioneProps {
  corsi: CorsoFormazione[];
  onAggiornaCorsi: (corsi: CorsoFormazione[]) => void;
  volontari: Volontario[];
  onAggiornaVolontari?: (volontari: Volontario[]) => void;
  sedi?: SedeAssociativaCompleta[];
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  allowedSubtabs?: string[] | null;
}

export const SezioneFormazione: React.FC<SezioneFormazioneProps> = ({
  corsi,
  onAggiornaCorsi,
  volontari,
  onAggiornaVolontari,
  sedi = [],
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  allowedSubtabs = null
}) => {
  const nomiSubCustom = useNomiSottosezioniCustom();
  const auleFormazione = useAuleFormazione();
  const auleFormazioneAttive = auleFormazione.filter((a) => a.attiva);
  const [sottoTab, setSottoTab] = useState<'corsi' | 'iscritti' | 'scadenziario' | 'modelli_pdf' | 'aule'>('corsi');
  // Chiunque abbia accesso al database Corsi & Formazione può gestire PDF prestampati, matricole e Aule Formazione
  const canShowSubtab = (id: string) => {
    if (!allowedSubtabs) return true;
    if (id === 'modelli_pdf' || id === 'aule') return allowedSubtabs.includes(id) || allowedSubtabs.length > 0;
    return allowedSubtabs.includes(id);
  };
  const [, setModelliVersionTick] = useState(0);

  useEffect(() => {
    const onModelliUpdated = () => setModelliVersionTick((v) => v + 1);
    window.addEventListener(EVENTO_MODELLI_ATTESTATI_UPDATED, onModelliUpdated);
    return () => window.removeEventListener(EVENTO_MODELLI_ATTESTATI_UPDATED, onModelliUpdated);
  }, []);

  useEffect(() => {
    if (!canShowSubtab(sottoTab)) {
      const ordine = ['corsi', 'iscritti', 'scadenziario', 'modelli_pdf', 'aule'] as const;
      const prima = ordine.find((t) => canShowSubtab(t));
      if (prima) setSottoTab(prima);
    }
  }, [sottoTab, allowedSubtabs]);

  // Ricerca e filtri
  const [ricerca, setRicerca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti');
  const [filtroStato, setFiltroStato] = useState('tutti');

  // Modale Nuovo / Modifica Corso
  const [modaleCorsoAperta, setModaleCorsoAperta] = useState(false);
  const [corsoInModifica, setCorsoInModifica] = useState<CorsoFormazione | null>(null);
  const [formCodice, setFormCodice] = useState(`CORSO-${getCurrentYearItaly()}-${String(corsi.length + 1).padStart(2, '0')}`);
  const [formTitolo, setFormTitolo] = useState('');
  const [formSottotitolo, setFormSottotitolo] = useState('');
  const [formTipologia, setFormTipologia] = useState<TipologiaCorso>('Seminario PSV');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formDocente, setFormDocente] = useState('');
  const [formEnte, setFormEnte] = useState('Regione Toscana — Formazione Continua');
  const [formSede, setFormSede] = useState('Sede Legale & Direzione Generale Massa (Ronchi) — Aula Magna');
  const [formDataInizio, setFormDataInizio] = useState(() => formatISODateItaly());
  const [formDataFine, setFormDataFine] = useState(() => addDaysISODate(formatISODateItaly(), 7));
  const [formOreTotali, setFormOreTotali] = useState(12);
  const [formOreMinime, setFormOreMinime] = useState(10);
  const [formMaxPartecipanti, setFormMaxPartecipanti] = useState(25);
  const [formStato, setFormStato] = useState<CorsoFormazione['stato']>('Programmato');

  // Mansioni collegate al percorso formativo
  const [formMansioneRilasciata, setFormMansioneRilasciata] = useState<string>('');
  const [formPrevedeEsame, setFormPrevedeEsame] = useState<boolean>(false);
  const [formMansionePrerequisito, setFormMansionePrerequisito] = useState<string>('');

  // Programma lezioni (fino a 20)
  const [formLezioni, setFormLezioni] = useState<LezioneCorso[]>([]);
  const [mostraDettaglioLezioniCorsoId, setMostraDettaglioLezioniCorsoId] = useState<string | null>(null);

  // Destinatari per Sezione Territoriale Operativa (NO singoli volontari)
  const [formSezioniDestinatarieIds, setFormSezioniDestinatarieIds] = useState<string[]>(['TUTTE']);

  // Sede di svolgimento & GPS (Sezione salvata, Aula Formazione o ALTRO con pin regolabile)
  const [formSedeTipo, setFormSedeTipo] = useState<string>('sede-massa-ronchi');
  const [formAulaFormazioneId, setFormAulaFormazioneId] = useState<string>('');
  const [formRaggioMetriTimbratura, setFormRaggioMetriTimbratura] = useState<number>(150);
  const [formNomePosizioneAltro, setFormNomePosizioneAltro] = useState('');
  const [formIndirizzoAltro, setFormIndirizzoAltro] = useState('');
  const [formCoordinate, setFormCoordinate] = useState<{ lat: number; lng: number }>({ lat: 43.99419, lng: 10.12367 });

  // Link Timbratura Esterni (senza account) segnalato all'operatore
  const [linkEsternoSegnalato, setLinkEsternoSegnalato] = useState<{
    corsoId: string;
    corsoTitolo: string;
    aulaNome: string;
    url: string;
    attivo: boolean;
  } | null>(null);
  const [linkCopiatoToast, setLinkCopiatoToast] = useState(false);

  // Percentuale Minima Presenza e Orari
  const [formPercentualeMinima, setFormPercentualeMinima] = useState<number>(80);
  const [formOrarioInizioLezione, setFormOrarioInizioLezione] = useState('09:00');
  const [formOrarioFineLezione, setFormOrarioFineLezione] = useState('13:00');

  // Modale Iscrizione Volontari a un Corso
  const [corsoPerIscrizioni, setCorsoPerIscrizioni] = useState<CorsoFormazione | null>(null);
  const [volontarioDaIscrivereId, setVolontarioDaIscrivereId] = useState('');

  // Modale Rilascio Attestato / Stampa + campi modificabili in anteprima
  const [attestatoPerStampa, setAttestatoPerStampa] = useState<{
    corso: CorsoFormazione;
    partecipante: PartecipanteCorso;
  } | null>(null);
  const [editAttestatoMatricola, setEditAttestatoMatricola] = useState('');
  const [editAttestatoData, setEditAttestatoData] = useState('');
  const [editAttestatoLuogo, setEditAttestatoLuogo] = useState('');
  const [anteprimaWorkflowAttestatoAperta, setAnteprimaWorkflowAttestatoAperta] = useState(false);

  // Selezione multipla PDF per sottosezione (Iscritti & Scadenziario)
  const [selectedIscrittiPdfIds, setSelectedIscrittiPdfIds] = useState<string[]>([]);
  const [selectedScadenziarioKeys, setSelectedScadenziarioKeys] = useState<string[]>([]);
  const [batchPdfInCorso, setBatchPdfInCorso] = useState(false);

  useEffect(() => {
    setSelectedIscrittiPdfIds([]);
  }, [corsoPerIscrizioni?.id]);

  useEffect(() => {
    setAnteprimaWorkflowAttestatoAperta(false);
    if (attestatoPerStampa) {
      const modCat = getModelloPerTipologia(attestatoPerStampa.corso.tipologia);
      setEditAttestatoMatricola(
        (attestatoPerStampa.partecipante.numeroAttestato || generaNumeroAttestato(attestatoPerStampa.corso.tipologia, corsi)).trim()
      );
      setEditAttestatoData(
        attestatoPerStampa.partecipante.dataRilascioAttestato || formatISODateItaly()
      );
      setEditAttestatoLuogo(
        (attestatoPerStampa.partecipante.luogoRilascioAttestato || '').trim() ||
          (modCat.luogoRilascioDefault || '').trim() ||
          determinaCittaPrevalenteCorso(attestatoPerStampa.corso)
      );
    }
  }, [attestatoPerStampa?.corso.id, attestatoPerStampa?.partecipante.volontarioId]);

  const handleSalvaDatiAttestatoSingolo = () => {
    if (!attestatoPerStampa) return;
    const { corso, partecipante } = attestatoPerStampa;
    const nuovaMatricola = editAttestatoMatricola.trim() || partecipante.numeroAttestato;
    const nuovaData = editAttestatoData.trim() || partecipante.dataRilascioAttestato || formatISODateItaly();
    const nuovoLuogo = editAttestatoLuogo.trim();

    const aggiornati = corsi.map((c) => {
      if (c.id !== corso.id) return c;
      return {
        ...c,
        iscritti: c.iscritti.map((p) => {
          if (p.volontarioId !== partecipante.volontarioId) return p;
          return {
            ...p,
            numeroAttestato: nuovaMatricola,
            dataRilascioAttestato: nuovaData,
            luogoRilascioAttestato: nuovoLuogo || undefined
          };
        })
      };
    });

    onAggiornaCorsi(aggiornati);
    const corsoAgg = aggiornati.find((c) => c.id === corso.id);
    const partAgg = corsoAgg?.iscritti.find((p) => p.volontarioId === partecipante.volontarioId);
    if (corsoAgg && partAgg) {
      setAttestatoPerStampa({ corso: corsoAgg, partecipante: partAgg });
      if (corsoPerIscrizioni?.id === corsoAgg.id) {
        setCorsoPerIscrizioni(corsoAgg);
      }
    }
    mostraAvviso(`Dati attestato aggiornati (Matricola: ${nuovaMatricola || '—'}, Luogo: ${nuovoLuogo || 'auto'}).`);
  };

  // Notifica
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Stato operazione attestato per prevenire click ripetuti
  const [operazioneAttestatoInCorso, setOperazioneAttestatoInCorso] = useState(false);

  const handleScaricaAttestato = async (corso: CorsoFormazione, partecipante: PartecipanteCorso) => {
    if (operazioneAttestatoInCorso) return;
    setOperazioneAttestatoInCorso(true);
    try {
      await avviaDownloadAttestatoUniversale(corso, partecipante, {
        apiBaseUrl: realtime.getApiBaseUrl(),
        luogoRilascio: partecipante.luogoRilascioAttestato,
        dataRilascio: partecipante.dataRilascioAttestato
      });
      mostraAvviso(`Download avviato per ${partecipante.volontarioNome || 'partecipante'}.`);
    } catch (err: any) {
      console.error('Errore download attestato:', err);
      mostraAvviso(`Errore durante il download: ${err?.message || 'verifica il browser'}`);
    } finally {
      setTimeout(() => {
        setOperazioneAttestatoInCorso(false);
      }, 600);
    }
  };

  const handleCondividiAttestato = async (corso: CorsoFormazione, partecipante: PartecipanteCorso) => {
    if (operazioneAttestatoInCorso) return;
    setOperazioneAttestatoInCorso(true);
    try {
      const opz = {
        apiBaseUrl: realtime.getApiBaseUrl(),
        luogoRilascio: partecipante.luogoRilascioAttestato,
        dataRilascio: partecipante.dataRilascioAttestato
      };
      const ok = await condividiAttestatoPDF(corso, partecipante, opz);
      if (ok) {
        mostraAvviso('Apertura menu di condivisione e salvataggio...');
      } else {
        await avviaDownloadAttestatoUniversale(corso, partecipante, opz);
        mostraAvviso('Attestato inviato al download del dispositivo.');
      }
    } catch (err: any) {
      console.error('Errore condivisione attestato:', err);
      mostraAvviso(`Errore: ${err?.message || 'non supportato'}`);
    } finally {
      setTimeout(() => {
        setOperazioneAttestatoInCorso(false);
      }, 600);
    }
  };

  const toggleSelezionaIscrittoPdf = (volontarioId: string) => {
    setSelectedIscrittiPdfIds((prev) =>
      prev.includes(volontarioId) ? prev.filter((x) => x !== volontarioId) : [...prev, volontarioId]
    );
  };

  const toggleSelezionaTuttiIscrittiPdf = (ids: string[]) => {
    if (ids.length > 0 && ids.every((id) => selectedIscrittiPdfIds.includes(id))) {
      setSelectedIscrittiPdfIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIscrittiPdfIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const toggleSelezionaScadenziario = (key: string) => {
    setSelectedScadenziarioKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const toggleSelezionaTuttiScadenziario = (keys: string[]) => {
    if (keys.length > 0 && keys.every((k) => selectedScadenziarioKeys.includes(k))) {
      setSelectedScadenziarioKeys((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setSelectedScadenziarioKeys((prev) => Array.from(new Set([...prev, ...keys])));
    }
  };

  const handleBatchPdfAttestati = async (
    lista: Array<{ corso: CorsoFormazione; partecipante: PartecipanteCorso }>,
    azione: 'download' | 'print',
    nomeBundle: string
  ) => {
    if (lista.length === 0) return;
    setBatchPdfInCorso(true);
    try {
      const items: PdfBatchItem[] = [];
      for (const { corso, partecipante } of lista) {
        const bytes = await scaricaAttestatoPDF(corso, partecipante, {
          downloadImmediato: false,
          apiBaseUrl: realtime.getApiBaseUrl(),
          luogoRilascio: partecipante.luogoRilascioAttestato,
          dataRilascio: partecipante.dataRilascioAttestato
        });
        const safeMat = (partecipante.numeroAttestato || 'ATTESTATO').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeNome = (partecipante.volontarioNome || 'Partecipante').replace(/[^a-zA-Z0-9_-]/g, '_');
        items.push({
          nomeFile: `Attestato_${safeMat}_${safeNome}.pdf`,
          bytes
        });
      }
      await scaricaOStampaMultipliPDF(items, azione, nomeBundle);
      mostraAvviso(
        azione === 'print'
          ? `Avviata stampa per ${items.length} attestato/i selezionato/i.`
          : `Scaricati ${items.length} PDF di attestati selezionati.`
      );
    } catch (err: any) {
      console.error('Errore batch PDF attestati:', err);
      mostraAvviso(`Errore nella generazione batch PDF: ${err?.message || 'Errore'}`);
    } finally {
      setBatchPdfInCorso(false);
    }
  };

  // Apertura modale nuovo corso con valori iniziali geolocalizzati
  const apriNuovoCorso = () => {
    setCorsoInModifica(null);
    setFormCodice(`CORSO-${getCurrentYearItaly()}-${String(corsi.length + 1).padStart(2, '0')}`);
    setFormTitolo('TUTELA, SOCCORSO E BENESSERE ANIMALE');
    setFormSottotitolo('“Dal Soccorso alla tutela degli animali”');
    setFormTipologia('Seminario PSV');
    setFormDescrizione('Seminario formativo teorico-pratico sulle procedure di primo intervento, messa in sicurezza, etologia e soccorso degli animali d\'affezione e fauna selvatica.');
    setFormDocente('Dott.ssa Valentina Moriconi (Formatore IRC / Veterinario)');
    setFormEnte('Regione Toscana — Centrale 118 Alta Toscana');
    setFormSedeTipo('sede-massa-ronchi');
    const primaAula = auleFormazioneAttive[0];
    setFormAulaFormazioneId(primaAula ? primaAula.id : '');
    setFormRaggioMetriTimbratura(primaAula ? primaAula.raggioMetri : 150);
    const primaSede = SEDI_TERRITORIALI_GPS[0];
    setFormSede(primaAula ? primaAula.nome : primaSede.nome);
    setFormCoordinate(primaAula ? primaAula.coordinate : { lat: primaSede.lat, lng: primaSede.lng });
    setFormNomePosizioneAltro('');
    setFormIndirizzoAltro('');
    setFormSezioniDestinatarieIds(['TUTTE']);
    setFormPercentualeMinima(80);
    setFormMansioneRilasciata('');
    setFormPrevedeEsame(false);
    setFormMansionePrerequisito('');
    const dataOggi = formatISODateItaly();
    setFormDataInizio(dataOggi);
    setFormDataFine(addDaysISODate(dataOggi, 14));
    setFormOreTotali(12);
    setFormOreMinime(10);
    setFormOrarioInizioLezione('09:00');
    setFormOrarioFineLezione('13:00');
    setFormMaxPartecipanti(25);
    setFormStato('Programmato');
    // Pre-imposta 3 lezioni in sedi diverse per Seminario PSV
    setFormLezioni([
      {
        id: `lez-${Date.now()}-1`,
        numero: 1,
        titolo: 'Modulo 1: Quadro Normativo, Benessere Animale e Approccio in Sicurezza',
        data: dataOggi,
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeNome: SEDI_TERRITORIALI_GPS[0].nome,
        indirizzoCompleto: SEDI_TERRITORIALI_GPS[0].indirizzo,
        coordinate: { lat: SEDI_TERRITORIALI_GPS[0].lat, lng: SEDI_TERRITORIALI_GPS[0].lng },
        docente: 'Dott.ssa Valentina Moriconi'
      },
      {
        id: `lez-${Date.now()}-2`,
        numero: 2,
        titolo: 'Modulo 2: Primo Soccorso Veterinario e Gestione Urgenze Traumatiche',
        data: addDaysISODate(dataOggi, 7),
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeNome: SEDI_TERRITORIALI_GPS[2].nome, // Carrara Fossone
        indirizzoCompleto: SEDI_TERRITORIALI_GPS[2].indirizzo,
        coordinate: { lat: SEDI_TERRITORIALI_GPS[2].lat, lng: SEDI_TERRITORIALI_GPS[2].lng },
        docente: 'Dott.ssa Valentina Moriconi'
      },
      {
        id: `lez-${Date.now()}-3`,
        numero: 3,
        titolo: 'Modulo 3: Allestimento Ambulanze Veterinarie ed Esercitazione Pratica',
        data: addDaysISODate(dataOggi, 14),
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeNome: SEDI_TERRITORIALI_GPS[1].nome, // Massa Le Jare
        indirizzoCompleto: SEDI_TERRITORIALI_GPS[1].indirizzo,
        coordinate: { lat: SEDI_TERRITORIALI_GPS[1].lat, lng: SEDI_TERRITORIALI_GPS[1].lng },
        docente: 'Istruttori Soccorso Croce Oro'
      }
    ]);
    setModaleCorsoAperta(true);
  };

  // Apertura modale modifica corso
  const apriModificaCorso = (c: CorsoFormazione) => {
    setCorsoInModifica(c);
    setFormCodice(c.codiceCorso);
    setFormTitolo(c.titolo);
    setFormSottotitolo(c.sottotitolo || '');
    setFormTipologia(c.tipologia);
    setFormDescrizione(c.descrizione);
    setFormDocente(c.docenteFormatore);
    setFormEnte(c.enteAccreditato);
    setFormSede(c.sedeCorso);
    setFormDataInizio(c.dataInizio);
    setFormDataFine(c.dataFine);
    setFormOreTotali(c.oreTotali);
    setFormOreMinime(c.oreMinimeFrequenza);
    setFormPercentualeMinima(c.percentualeMinimaPresenza || Math.round((c.oreMinimeFrequenza / c.oreTotali) * 100) || 75);
    setFormMaxPartecipanti(c.massimoPartecipanti);
    setFormStato(c.stato);
    setFormMansioneRilasciata(c.mansioneRilasciata || '');
    setFormPrevedeEsame(Boolean(c.prevedeEsame));
    setFormMansionePrerequisito(c.mansionePrerequisito || '');
    setFormLezioni(c.lezioni && c.lezioni.length > 0 ? [...c.lezioni] : []);
    setFormSezioniDestinatarieIds(c.sezioniDestinatarieIds && c.sezioniDestinatarieIds.length > 0 ? c.sezioniDestinatarieIds : ['TUTTE']);
    setFormAulaFormazioneId(c.aulaFormazioneId || '');
    setFormRaggioMetriTimbratura(c.raggioMetriTimbratura || 150);
    if (c.sedeSvolgimentoTipo === 'altro') {
      setFormSedeTipo('ALTRO');
      setFormNomePosizioneAltro(c.sedeCorso || '');
      setFormIndirizzoAltro(c.indirizzoCompleto || '');
    } else if (c.sedeSvolgimentoSedeId) {
      setFormSedeTipo(c.sedeSvolgimentoSedeId);
    } else {
      setFormSedeTipo('sede-massa-ronchi');
    }
    if (c.coordinate) {
      setFormCoordinate(c.coordinate);
    }
    setFormOrarioInizioLezione(c.orarioInizioLezione || '09:00');
    setFormOrarioFineLezione(c.orarioFineLezione || '13:00');
    setModaleCorsoAperta(true);
  };

  // Genera / attiva / mostra il link di timbratura per partecipanti esterni senza account
  const handleGeneraOCondividiLinkEsterni = async (corsoTarget: CorsoFormazione, rigeneraToken = false) => {
    const token =
      !rigeneraToken && corsoTarget.linkTimbraturaEsterniToken
        ? corsoTarget.linkTimbraturaEsterniToken
        : generaTokenLinkTimbraturaEsterni(corsoTarget.id);

    const corsoAggiornato: CorsoFormazione = {
      ...corsoTarget,
      linkTimbraturaEsterniToken: token,
      linkTimbraturaEsterniAttivo: true
    };
    const aggiornati = corsi.map((c) => (c.id === corsoTarget.id ? corsoAggiornato : c));
    onAggiornaCorsi(aggiornati);
    if (corsoPerIscrizioni && corsoPerIscrizioni.id === corsoTarget.id) {
      setCorsoPerIscrizioni(corsoAggiornato);
    }
    const targetAula = risolviTargetAulaDidattica(corsoAggiornato, corsoAggiornato.lezioni?.[0] || null, auleFormazione);
    const url = buildLinkTimbraturaCorsoEsterno(token);
    await realtime.publishPublicCourse(corsoAggiornato, auleFormazione).catch(() => false);
    setLinkEsternoSegnalato({
      corsoId: corsoAggiornato.id,
      corsoTitolo: corsoAggiornato.titolo,
      aulaNome: targetAula.nome,
      url,
      attivo: true
    });
    mostraAvviso(`Link timbratura esterni pronto per "${corsoAggiornato.titolo}": condividilo con i partecipanti senza account.`);
  };

  const handleToggleAttivoLinkEsterni = async (corsoTarget: CorsoFormazione) => {
    if (!corsoTarget.linkTimbraturaEsterniToken) return;
    const nuovoStato = corsoTarget.linkTimbraturaEsterniAttivo === false;
    const corsoAggiornato: CorsoFormazione = {
      ...corsoTarget,
      linkTimbraturaEsterniAttivo: nuovoStato
    };
    const aggiornati = corsi.map((c) => (c.id === corsoTarget.id ? corsoAggiornato : c));
    onAggiornaCorsi(aggiornati);
    if (corsoPerIscrizioni && corsoPerIscrizioni.id === corsoTarget.id) {
      setCorsoPerIscrizioni(corsoAggiornato);
    }
    await realtime.publishPublicCourse(corsoAggiornato, auleFormazione).catch(() => false);
    setLinkEsternoSegnalato((prev) =>
      prev && prev.corsoId === corsoTarget.id ? { ...prev, attivo: nuovoStato } : prev
    );
    mostraAvviso(
      nuovoStato
        ? `Link timbratura esterni RIATTIVATO per "${corsoTarget.titolo}".`
        : `Link timbratura esterni DISATTIVATO per "${corsoTarget.titolo}".`
    );
  };

  const handleCopiaLinkEsterno = (url: string) => {
    try {
      navigator.clipboard.writeText(url);
      setLinkCopiatoToast(true);
      setTimeout(() => setLinkCopiatoToast(false), 2500);
    } catch {
      mostraAvviso('Copia manualmente il link dal riquadro viola.');
    }
  };

  // Salva Corso con destinatari a sezioni, Aula Formazione geolocalizzata e fino a 20 lezioni
  const handleSalvaCorso = (e: React.FormEvent) => {
    e.preventDefault();

    const aulaSelezionata = formAulaFormazioneId
      ? auleFormazione.find((a) => a.id === formAulaFormazioneId)
      : undefined;

    let sedeNome = formSede;
    let indirizzo = '';
    let coordinate = formCoordinate;
    let raggioMetri = formRaggioMetriTimbratura || 150;

    if (aulaSelezionata) {
      sedeNome = aulaSelezionata.nome;
      indirizzo = aulaSelezionata.indirizzo;
      coordinate = { lat: aulaSelezionata.coordinate.lat, lng: aulaSelezionata.coordinate.lng };
      raggioMetri = aulaSelezionata.raggioMetri || 150;
    } else if (formSedeTipo === 'ALTRO') {
      sedeNome = formNomePosizioneAltro.trim() || 'Sede Esterna Formativa';
      indirizzo = formIndirizzoAltro.trim();
    } else {
      const sedeSelezionata = SEDI_TERRITORIALI_GPS.find((s) => s.id === formSedeTipo);
      if (sedeSelezionata) {
        sedeNome = sedeSelezionata.nome;
        indirizzo = sedeSelezionata.indirizzo;
        coordinate = { lat: sedeSelezionata.lat, lng: sedeSelezionata.lng };
      }
    }

    // Sezioni Destinatarie Nomi (NO singoli volontari)
    let sezioniNomi: string[] = [];
    if (formSezioniDestinatarieIds.includes('TUTTE')) {
      sezioniNomi = ['Tutte le Sezioni dell\'Associazione'];
    } else {
      sezioniNomi = formSezioniDestinatarieIds
        .map((id) => SEDI_TERRITORIALI_GPS.find((s) => s.id === id)?.nome)
        .filter(Boolean) as string[];
    }

    // Se ci sono lezioni, ricalcola ore totali e date
    let oreTot = Number(formOreTotali);
    if (formLezioni.length > 0) {
      const sommaOreLezioni = formLezioni.reduce((sum, l) => sum + (Number(l.ore) || 0), 0);
      if (sommaOreLezioni > 0) oreTot = sommaOreLezioni;
    }
    const percMin = Number(formPercentualeMinima);
    const oreMin = Math.round((oreTot * percMin) / 100);

    const lezioniOrdinate = [...formLezioni].map((lez, idx) => ({
      ...lez,
      numero: idx + 1
    }));

    const datiCorsoAggiornato: Partial<CorsoFormazione> = {
      codiceCorso: formCodice.trim().toUpperCase(),
      titolo: formTitolo.trim(),
      sottotitolo: formSottotitolo.trim() || undefined,
      tipologia: formTipologia,
      descrizione: formDescrizione.trim(),
      docenteFormatore: formDocente.trim(),
      enteAccreditato: formEnte.trim(),
      sedeCorso: sedeNome,
      sedeSvolgimentoTipo: formSedeTipo === 'ALTRO' && !aulaSelezionata ? 'altro' : 'sezione_salvata',
      sedeSvolgimentoSedeId: aulaSelezionata?.sedeRiferimentoId || (formSedeTipo === 'ALTRO' ? undefined : formSedeTipo),
      aulaFormazioneId: aulaSelezionata?.id || undefined,
      aulaFormazioneNome: aulaSelezionata?.nome || undefined,
      raggioMetriTimbratura: raggioMetri,
      indirizzoCompleto: indirizzo,
      coordinate: coordinate,
      orarioInizioLezione: formOrarioInizioLezione,
      orarioFineLezione: formOrarioFineLezione,
      sezioniDestinatarieIds: formSezioniDestinatarieIds,
      sezioniDestinatarieNomi: sezioniNomi,
      percentualeMinimaPresenza: percMin,
      dataInizio: formDataInizio,
      dataFine: formDataFine,
      oreTotali: oreTot,
      oreMinimeFrequenza: oreMin,
      massimoPartecipanti: Number(formMaxPartecipanti),
      stato: formStato,
      mansioneRilasciata: formMansioneRilasciata.trim() || undefined,
      prevedeEsame: formPrevedeEsame,
      mansionePrerequisito: formMansionePrerequisito.trim() || undefined,
      lezioni: lezioniOrdinate
    };

    if (corsoInModifica) {
      const corsoAggiornato = { ...corsoInModifica, ...datiCorsoAggiornato } as CorsoFormazione;
      const aggiornati = corsi.map((c) =>
        c.id === corsoInModifica.id ? corsoAggiornato : c
      );
      onAggiornaCorsi(aggiornati);
      if (corsoAggiornato.linkTimbraturaEsterniToken) {
        realtime.publishPublicCourse(corsoAggiornato, auleFormazione).catch(() => {});
      }

      // Se il corso non era in bacheca (es. era annullato/concluso o data passata) ed ora entra in bacheca, invia notifica solo in-app a tutti gli account
      if (!isCorsoVisibileInBacheca(corsoInModifica) && isCorsoVisibileInBacheca(corsoAggiornato)) {
        const dataInizioEff = getDataInizioEffettivaCorso(corsoAggiornato);
        realtime.sendNotificaBacheca({
          id: `bacheca-corso-${corsoAggiornato.id}-${Date.now()}`,
          tipo: 'nuovo_corso',
          postId: corsoAggiornato.id,
          postTitolo: corsoAggiornato.titolo,
          autoreCommento: operatoreCorrente || 'Formazione',
          dataInizio: dataInizioEff,
          tipologia: corsoAggiornato.tipologia,
          sedeCorso: corsoAggiornato.sedeCorso,
          soloInApp: true,
          createdAt: Date.now(),
          messaggio: `Nuovo corso/formazione in bacheca: "${corsoAggiornato.titolo}" (${corsoAggiornato.tipologia}) • Inizio il ${formatDataItalianaCorso(dataInizioEff)}${corsoAggiornato.sedeCorso ? ` — ${corsoAggiornato.sedeCorso}` : ''}`
        });
      }

      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'formazione',
          'Modifica corso formazione',
          `Modificato corso "${formTitolo}" (${formCodice}, docente: ${formDocente}, sede: ${sedeNome}, ${lezioniOrdinate.length} lezioni)`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Corso "${formTitolo}" aggiornato con successo (${lezioniOrdinate.length} incontri programmati).`);
    } else {
      const nuovo: CorsoFormazione = {
        ...(datiCorsoAggiornato as CorsoFormazione),
        id: `corso-${Date.now()}`,
        iscritti: []
      };
      onAggiornaCorsi([...corsi, nuovo]);

      // Se il nuovo corso/formazione è visibile in bacheca (in programma fino al giorno di inizio), invia notifica solo in-app a tutti gli account con il titolo
      if (isCorsoVisibileInBacheca(nuovo)) {
        const dataInizioEff = getDataInizioEffettivaCorso(nuovo);
        realtime.sendNotificaBacheca({
          id: `bacheca-corso-${nuovo.id}-${Date.now()}`,
          tipo: 'nuovo_corso',
          postId: nuovo.id,
          postTitolo: nuovo.titolo,
          autoreCommento: operatoreCorrente || 'Formazione',
          dataInizio: dataInizioEff,
          tipologia: nuovo.tipologia,
          sedeCorso: nuovo.sedeCorso,
          soloInApp: true,
          createdAt: Date.now(),
          messaggio: `Nuovo corso/formazione in bacheca: "${nuovo.titolo}" (${nuovo.tipologia}) • Inizio il ${formatDataItalianaCorso(dataInizioEff)}${nuovo.sedeCorso ? ` — ${nuovo.sedeCorso}` : ''}`
        });
      }

      onNotificaRadio?.(`🎓 FORMAZIONE: Programmato nuovo corso "${nuovo.titolo}" per ${sezioniNomi.join(', ')} (${lezioniOrdinate.length} lezioni)`, 'sistema');
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'formazione',
          'Nuovo corso formazione programmato',
          `Programmato corso "${nuovo.titolo}" (${nuovo.codiceCorso}, tipologia: ${nuovo.tipologia}, ${lezioniOrdinate.length} lezioni in sedi diverse)`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Nuovo corso "${nuovo.titolo}" programmato (${lezioniOrdinate.length} incontri).`);
    }
    setModaleCorsoAperta(false);
    setCorsoInModifica(null);
  };

  // Iscrivi volontario al corso
  const handleIscriviVolontario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!corsoPerIscrizioni || !volontarioDaIscrivereId) return;

    const vol = volontari.find((v) => v.id === volontarioDaIscrivereId);
    if (!vol) return;

    // Controllo prerequisito mansione (diretta o ereditata gerarchicamente)
    if (corsoPerIscrizioni.mansionePrerequisito && corsoPerIscrizioni.mansionePrerequisito.trim()) {
      const haPrerequisito = volontarioHaMansione(vol, corsoPerIscrizioni.mansionePrerequisito);
      if (!haPrerequisito) {
        mostraAvviso(
          `Accesso negato: per "${corsoPerIscrizioni.titolo}" è richiesta la mansione "${corsoPerIscrizioni.mansionePrerequisito}". ${vol.nome} ${vol.cognome} non la possiede.`
        );
        return;
      }
    }

    // Verifica se già iscritto
    if (corsoPerIscrizioni.iscritti.some((i) => i.volontarioId === vol.id)) {
      mostraAvviso('Il volontario risulta già iscritto a questo corso.');
      return;
    }

    const nuovoIscritto: PartecipanteCorso = {
      volontarioId: vol.id,
      volontarioNome: `${vol.nome} ${vol.cognome}`,
      qualifica: vol.qualifica || 'Volontario',
      oreFrequentate: 0,
      esito: 'Iscritto',
      esitoEsame: corsoPerIscrizioni.prevedeEsame ? 'In Attesa Esame' : 'Non Previsto',
      tipoAttestato: (corsoPerIscrizioni.tipologia === 'Seminario PSV' || corsoPerIscrizioni.tipologia === 'Seminario Autisti')
        ? 'partecipazione'
        : 'idoneita'
    };

    const aggiornati = corsi.map((c) => {
      if (c.id === corsoPerIscrizioni.id) {
        return {
          ...c,
          iscritti: [...c.iscritti, nuovoIscritto]
        };
      }
      return c;
    });

    onAggiornaCorsi(aggiornati);
    setCorsoPerIscrizioni(aggiornati.find((c) => c.id === corsoPerIscrizioni.id) || null);
    setVolontarioDaIscrivereId('');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'formazione',
        'Iscrizione volontario a corso',
        `Iscritto ${vol.nome} ${vol.cognome} al corso "${corsoPerIscrizioni.titolo}" (${corsoPerIscrizioni.codiceCorso})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`${vol.nome} ${vol.cognome} iscritto al corso con successo.`);
  };

  // Aggiorna esito partecipante (Idoneo, superato, rilascio attestato e assegnazione automatica mansione)
  const handleAggiornaEsito = (
    corsoId: string,
    volontarioId: string,
    nuovoEsito: PartecipanteCorso['esito'],
    ore: number
  ) => {
    const dataOggi = formatISODateItaly();
    const scadenza = addDaysISODate(dataOggi, 2 * 365); // +2 anni per BLSD

    let mansioneDaAssegnare: string | undefined = undefined;
    let matricolaEmessaMsg: string | null = null;

    const aggiornati = corsi.map((c) => {
      if (c.id === corsoId) {
        return {
          ...c,
          iscritti: c.iscritti.map((p) => {
            if (p.volontarioId === volontarioId) {
              const idoneo = nuovoEsito === 'Idoneo / Superato';
              const isSeminarioPSV = c.tipologia === 'Seminario PSV';
              const isSeminarioAutisti = c.tipologia === 'Seminario Autisti';
              const isPartecipazione = isSeminarioPSV || isSeminarioAutisti;

              let numAtt = p.numeroAttestato;
              let luogoRilascio = p.luogoRilascioAttestato;
              if (idoneo && !numAtt) {
                const consumed = consumaProssimaMatricolaCategoria(c.tipologia, corsi, operatoreCorrente);
                numAtt = consumed.matricola;
                matricolaEmessaMsg = consumed.matricola;
                realtime.syncModelliAttestatiCategoria(consumed.mappaAggiornata, consumed.updatedAt);
                if (!luogoRilascio && consumed.modelloAggiornato.luogoRilascioDefault) {
                  luogoRilascio = consumed.modelloAggiornato.luogoRilascioDefault;
                }
              }

              // Se il corso riconosce una mansione al superamento (o esame previsto superato)
              let mansioneAssegnata = p.mansioneAssegnataAutomatica;
              if (idoneo && c.mansioneRilasciata) {
                mansioneAssegnata = true;
                mansioneDaAssegnare = c.mansioneRilasciata;
              }

              return {
                ...p,
                esito: nuovoEsito,
                esitoEsame: (c.prevedeEsame ? (idoneo ? 'Superato' : 'Non Superato') : 'Non Previsto') as PartecipanteCorso['esitoEsame'],
                mansioneAssegnataAutomatica: mansioneAssegnata,
                oreFrequentate: ore,
                tipoAttestato: (isPartecipazione ? 'partecipazione' : 'idoneita') as 'partecipazione' | 'idoneita',
                numeroAttestato: idoneo ? numAtt : undefined,
                dataRilascioAttestato: idoneo ? (p.dataRilascioAttestato || dataOggi) : undefined,
                luogoRilascioAttestato: idoneo ? luogoRilascio : undefined,
                scadenzaBrevetto: idoneo ? (isPartecipazione ? undefined : scadenza) : undefined
              };
            }
            return p;
          })
        };
      }
      return c;
    });

    onAggiornaCorsi(aggiornati);
    if (corsoPerIscrizioni) {
      setCorsoPerIscrizioni(aggiornati.find((c) => c.id === corsoPerIscrizioni.id) || null);
    }

    // Se è stata conseguita una nuova mansione, aggiorna automaticamente l'anagrafica del volontario
    if (mansioneDaAssegnare) {
      const volTarget = volontari.find((v) => v.id === volontarioId);
      if (volTarget) {
        const volontariAggiornati = volontari.map((v) =>
          v.id === volontarioId ? assegnaMansioneAVolontario(v, mansioneDaAssegnare!) : v
        );
        onAggiornaVolontari?.(volontariAggiornati);
        onNotificaRadio?.(
          `🎖️ MANSIONE ACQUISITA: ${volTarget.nome} ${volTarget.cognome} ha superato il corso/esame ed ha acquisito automaticamente la mansione "${mansioneDaAssegnare}"!`,
          'sistema'
        );
      }
    }

    mostraAvviso(
      `Esito formativo e attestato aggiornati${matricolaEmessaMsg ? ` (Matricola progressiva: ${matricolaEmessaMsg})` : ''}.${mansioneDaAssegnare ? ` Mansione "${mansioneDaAssegnare}" assegnata in automatico!` : ''}`
    );
  };

  // Corsi filtrati
  const corsiFiltrati = corsi.filter((c) => {
    const matchTesto =
      !ricerca.trim() ||
      c.titolo.toLowerCase().includes(ricerca.toLowerCase()) ||
      c.codiceCorso.toLowerCase().includes(ricerca.toLowerCase()) ||
      c.docenteFormatore.toLowerCase().includes(ricerca.toLowerCase()) ||
      c.sedeCorso.toLowerCase().includes(ricerca.toLowerCase());

    const matchTipo = filtroTipo === 'tutti' || c.tipologia === filtroTipo;
    const matchStato = filtroStato === 'tutti' || c.stato === filtroStato;

    return matchTesto && matchTipo && matchStato;
  });

  // Elenco complessivo di tutti gli attestati e brevetti emessi
  const tuttiGliAttestati = corsi.flatMap((c) =>
    c.iscritti
      .filter((i) => i.numeroAttestato && i.esito === 'Idoneo / Superato')
      .map((i) => ({ corso: c, partecipante: i }))
  );

  // Calcolo scadenze brevetti & attestati (preavviso 30 giorni e 15 giorni prima della data limite)
  const attestatiConScadenza = React.useMemo(() => {
    const oggiMs = Date.now();
    const msGiorno = 1000 * 60 * 60 * 24;
    return tuttiGliAttestati
      .filter(({ partecipante }) => Boolean(partecipante.scadenzaBrevetto))
      .map(({ corso, partecipante }) => {
        const scadMs = new Date(partecipante.scadenzaBrevetto!).getTime();
        const diffGg = Math.ceil((scadMs - oggiMs) / msGiorno);
        let scaglione: '30_giorni' | '15_giorni' | 'scaduto' | 'regolare' = 'regolare';
        if (diffGg <= 0) scaglione = 'scaduto';
        else if (diffGg <= 15) scaglione = '15_giorni';
        else if (diffGg <= 30) scaglione = '30_giorni';

        return {
          corso,
          partecipante,
          scadenzaBrevetto: partecipante.scadenzaBrevetto!,
          giorniRimanenti: diffGg,
          scaglione
        };
      })
      .sort((a, b) => a.giorniRimanenti - b.giorniRimanenti);
  }, [tuttiGliAttestati]);

  // Attestati in scadenza entro 30 giorni (inclusi quelli a 15 giorni e scaduti)
  const attestatiInScadenza30Gg = React.useMemo(() => {
    return attestatiConScadenza.filter((a) => a.scaglione !== 'regolare');
  }, [attestatiConScadenza]);

  // Attestati urgenti (entro 15 giorni o scaduti)
  const attestatiUrgenti15Gg = React.useMemo(() => {
    return attestatiConScadenza.filter((a) => a.scaglione === '15_giorni' || a.scaglione === 'scaduto');
  }, [attestatiConScadenza]);

  // Registro in memoria delle scadenze attestati/brevetti già notificate per scaglione
  const ultimoStatoNotificaAttestatiRef = useRef<Record<string, string>>({});
  const [invioEmailAttestatiInCorso, setInvioEmailAttestatiInCorso] = useState(false);

  // Invia notifica email automatica a formazione@croceoro.oeg (e formazione@croceoro.org) e presidenza@croceoro.org
  const inviaEmailScadenzeAttestatiAutomatico = async (
    items: Array<{ corso: CorsoFormazione; partecipante: PartecipanteCorso; scadenzaBrevetto: string; giorniRimanenti: number; scaglione: string }>,
    causale: string = 'Preavviso scadenza attestati/brevetti formativi (30 gg e 15 gg)',
    force: boolean = false
  ) => {
    if (!items || items.length === 0) return;

    const payload = items.map((i) => ({
      volontarioId: i.partecipante.volontarioId,
      volontarioNome: i.partecipante.volontarioNome,
      qualifica: i.partecipante.qualifica,
      corsoTitolo: i.corso.titolo,
      tipologia: i.corso.tipologia,
      codiceCorso: i.corso.codiceCorso,
      numeroAttestato: i.partecipante.numeroAttestato,
      dataRilascioAttestato: i.partecipante.dataRilascioAttestato,
      scadenzaBrevetto: i.scadenzaBrevetto,
      giorniRimanenti: i.giorniRimanenti,
      scaglione: i.scaglione
    }));

    const daInviare = force
      ? payload
      : payload.filter((p) => {
          const key = `${p.volontarioId}_${p.numeroAttestato || p.codiceCorso}_${p.scadenzaBrevetto}_${p.scaglione}`;
          return !ultimoStatoNotificaAttestatiRef.current[key];
        });

    if (daInviare.length === 0) return;

    daInviare.forEach((p) => {
      const key = `${p.volontarioId}_${p.numeroAttestato || p.codiceCorso}_${p.scadenzaBrevetto}_${p.scaglione}`;
      ultimoStatoNotificaAttestatiRef.current[key] = new Date().toISOString();
    });

    try {
      setInvioEmailAttestatiInCorso(true);
      const res = await fetch('/api/notifica-scadenza-attestati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attestati: daInviare,
          causale,
          operatore: operatoreCorrente || 'Ufficio Formazione & Didattica',
          dataOra: formatDateTimeItaly(),
          force
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.count > 0) {
          const elenco = daInviare.map((a) => `${a.volontarioNome} (${a.tipologia || 'Brevetto'}: ${a.scadenzaBrevetto})`).join(', ');
          onNotificaRadio?.(
            `📧 NOTIFICA SCADENZA BREVETTI INVIATA: Email trasmessa a formazione@croceoro.oeg e presidenza@croceoro.org per: ${elenco}.`,
            'allarme'
          );
        }
      }
    } catch (err) {
      console.warn('[SezioneFormazione] Errore invio email scadenze attestati:', err);
    } finally {
      setInvioEmailAttestatiInCorso(false);
    }
  };

  // Controllo automatico delle scadenze brevetti (30 giorni e 15 giorni prima) all'avvio
  useEffect(() => {
    if (attestatiInScadenza30Gg.length > 0) {
      inviaEmailScadenzeAttestatiAutomatico(
        attestatiInScadenza30Gg,
        'Verifica automatica programmata scadenze attestati/brevetti (preavviso 30 gg e 15 gg)'
      );
    }
  }, [attestatiInScadenza30Gg]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 5 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                Macro Categoria 5
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {useTitoloDatabase('formazione', 'Database Formazione, Corsi & Brevetti')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Pianificazione percorsi formativi (BLSD, Soccorso Avanzato, Guida Sicura, Protezione Civile, Soccorso Veterinario), registri presenze e scadenziario abilitazioni.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canShowSubtab('modelli_pdf') && (
            <button
              type="button"
              onClick={() => setSottoTab('modelli_pdf')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer border ${
                sottoTab === 'modelli_pdf'
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Modelli PDF &amp; Matricole</span>
            </button>
          )}
          <button
            type="button"
            onClick={apriNuovoCorso}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuovo Corso Formativo</span>
          </button>
        </div>
      </div>

      {/* Alert Notifica */}
      {avviso && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{avviso}</span>
        </div>
      )}

      {/* Banner Link Timbratura Esterni (Segnalato all'operatore per condivisione immediata) */}
      {linkEsternoSegnalato && (
        <div className="bg-purple-950/80 border-2 border-purple-500/70 rounded-2xl p-4 space-y-2.5 shadow-xl animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-black uppercase">
                  🔗 Link Timbratura Esterni (Senza Account)
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                  linkEsternoSegnalato.attivo
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {linkEsternoSegnalato.attivo ? 'Attivo' : 'Disattivato'}
                </span>
              </div>
              <h4 className="text-sm font-black text-white mt-1">{linkEsternoSegnalato.corsoTitolo}</h4>
              <p className="text-[11px] text-purple-200/90 mt-0.5">
                Aula Didattica: <strong>{linkEsternoSegnalato.aulaNome}</strong> • I partecipanti esterni potranno inserire <strong>Nome, Cognome e Telefono</strong> e timbrare entrata/uscita senza registrarsi. Le presenze appariranno evidenziate in <strong>viola</strong> nel Registro Presenze.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLinkEsternoSegnalato(null)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Chiudi riquadro link"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={linkEsternoSegnalato.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/50 text-purple-200 font-mono text-[11px]"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleCopiaLinkEsterno(linkEsternoSegnalato.url)}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{linkCopiatoToast ? 'Copiato!' : 'Copia Link'}</span>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Timbratura presenze corso "${linkEsternoSegnalato.corsoTitolo}" (${linkEsternoSegnalato.aulaNome}) — Croce Oro Massa Carrara OdV. Apri il link (nessun account richiesto): ${linkEsternoSegnalato.url}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Barra Navigazione Sotto-Categorie (a griglia adattiva, senza scroll orizzontale) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5 sm:gap-2 pb-2 border-b border-slate-800">
        {canShowSubtab('corsi') && (
        <button
          type="button"
          onClick={() => setSottoTab('corsi')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'corsi'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">1. {getTitoloSottosezione('formazione', 'corsi', 'Catalogo Corsi & Piano Formativo', nomiSubCustom)} ({corsi.length})</span>
        </button>
        )}

        {canShowSubtab('iscritti') && (
        <button
          type="button"
          onClick={() => setSottoTab('iscritti')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'iscritti'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">2. {getTitoloSottosezione('formazione', 'iscritti', 'Iscrizioni & Registro Presenze', nomiSubCustom)}</span>
        </button>
        )}

        {canShowSubtab('scadenziario') && (
        <button
          type="button"
          onClick={() => setSottoTab('scadenziario')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'scadenziario'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">3. {getTitoloSottosezione('formazione', 'scadenziario', 'Scadenziario Brevetti & Attestati', nomiSubCustom)} ({tuttiGliAttestati.length})</span>
        </button>
        )}

        {canShowSubtab('modelli_pdf') && (
        <button
          type="button"
          onClick={() => setSottoTab('modelli_pdf')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'modelli_pdf'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-300'
              : 'bg-slate-900 text-amber-300/90 hover:text-amber-200 border border-amber-500/30'
          }`}
        >
          <FileUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">4. {getTitoloSottosezione('formazione', 'modelli_pdf', 'Modelli PDF Prestampati & Matricole', nomiSubCustom)}</span>
        </button>
        )}

        {canShowSubtab('aule') && (
        <button
          type="button"
          onClick={() => setSottoTab('aule')}
          className={`w-full px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 text-center leading-tight transition-all cursor-pointer ${
            sottoTab === 'aule'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400'
              : 'bg-slate-900 text-purple-300 hover:text-purple-200 border border-purple-500/30'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="break-words">5. {getTitoloSottosezione('formazione', 'aule', 'Aule Formazione', nomiSubCustom)} ({auleFormazioneAttive.length})</span>
        </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: CATALOGO CORSI                                          */}
      {/* ===================================================================== */}
      {sottoTab === 'corsi' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca titolo corso, codice, docente..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutte le Tipologie</option>
                {TIPOLOGIE_CORSO_CONSENTITE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutti gli Stati</option>
                <option value="Programmato">Programmati</option>
                <option value="In Corso">In Corso</option>
                <option value="Concluso">Conclusi</option>
              </select>
            </div>
          </div>

          {/* Grid Corsi */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corsiFiltrati.map((c) => {
              const isProgrammato = c.stato === 'Programmato';
              const isInCorso = c.stato === 'In Corso';
              const numLezioni = c.lezioni?.length || 0;
              const isMostraDettagli = mostraDettaglioLezioniCorsoId === c.id;

              return (
                <div
                  key={c.id}
                  className="bg-slate-950 rounded-2xl border border-slate-800 hover:border-indigo-500/50 p-4 shadow-xl flex flex-col justify-between gap-3 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-xs text-indigo-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {c.codiceCorso}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isInCorso
                          ? 'bg-amber-950 text-amber-300 border-amber-700/50 animate-pulse'
                          : isProgrammato
                          ? 'bg-blue-950 text-blue-300 border-blue-700/50'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                      }`}>
                        {c.stato}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-white text-sm leading-snug">{c.titolo}</h4>
                      {c.sottotitolo && (
                        <p className="text-[11px] font-semibold text-amber-300 italic">{c.sottotitolo}</p>
                      )}
                      <span className="text-[10px] font-bold text-indigo-300 uppercase block mt-0.5">{c.tipologia}</span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2">{c.descrizione}</p>

                    <div className="space-y-1 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{c.oreTotali} Ore Totali • Minimo {c.oreMinimeFrequenza}h</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{c.dataInizio} ➔ {c.dataFine}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{c.sedeCorso}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span><strong>{c.iscritti.length}</strong> / {c.massimoPartecipanti} Iscritti</span>
                      </div>
                    </div>

                    {/* Programma Lezioni (fino a 20 incontri) */}
                    {numLezioni > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setMostraDettaglioLezioniCorsoId(isMostraDettagli ? null : c.id)}
                          className="w-full p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-left text-xs flex items-center justify-between text-indigo-300 cursor-pointer"
                        >
                          <span className="font-bold flex items-center gap-1.5">
                            <span>📅 {numLezioni} Incontri in Sedi Diverse</span>
                          </span>
                          {isMostraDettagli ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isMostraDettagli && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 animate-in fade-in">
                            {c.lezioni?.map((lez) => (
                              <div key={lez.id} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] space-y-0.5">
                                <div className="flex items-center justify-between font-bold text-slate-200">
                                  <span>#{lez.numero} {lez.titolo || 'Lezione'}</span>
                                  <span className="text-amber-400 font-mono">{lez.ore}h</span>
                                </div>
                                <div className="text-slate-400 flex items-center justify-between text-[9.5px]">
                                  <span>📆 {lez.data} ({lez.orarioInizio}-{lez.orarioFine})</span>
                                </div>
                                <div className="text-emerald-300 text-[9.5px] truncate flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{lez.sedeNome}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setCorsoPerIscrizioni(c);
                        setSottoTab('iscritti');
                      }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Gestisci Iscritti ({c.iscritti.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGeneraOCondividiLinkEsterni(c)}
                      className="py-1.5 px-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 border border-purple-500/40 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Genera o condividi il link di timbratura per partecipanti esterni senza account"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Link Esterni</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => apriModificaCorso(c)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      title="Modifica Corso"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SOTTO-TAB: ISCRITTI & REGISTRO PRESENZE                            */}
      {/* ===================================================================== */}
      {sottoTab === 'iscritti' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Gestione Iscrizioni & Registro Presenze Corso</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleziona un corso per visualizzare i partecipanti, registrare le ore frequentate ed emettere il brevetto di idoneità.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-bold">Corso:</label>
              <select
                value={corsoPerIscrizioni?.id || ''}
                onChange={(e) => {
                  const sel = corsi.find((c) => c.id === e.target.value) || null;
                  setCorsoPerIscrizioni(sel);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-indigo-300 font-bold focus:outline-none"
              >
                <option value="">-- Seleziona un Corso --</option>
                {corsi.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codiceCorso} — {c.titolo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {corsoPerIscrizioni ? (
            <div className="space-y-4">
              {/* Box Info Corso & Form Aggiungi Iscritto */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-indigo-400 font-bold">{corsoPerIscrizioni.codiceCorso}</span>
                    {corsoPerIscrizioni.mansioneRilasciata && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/50 text-[10px] font-bold">
                        🎖️ Rilascia: {corsoPerIscrizioni.mansioneRilasciata}
                        {corsoPerIscrizioni.prevedeEsame && (
                          <span className="bg-amber-800/60 text-white px-1 py-0.2 rounded text-[9px] ml-1">Con Esame</span>
                        )}
                      </span>
                    )}
                    {corsoPerIscrizioni.mansionePrerequisito && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 border border-rose-500/50 text-[10px] font-bold">
                        🔒 Prerequisito: {corsoPerIscrizioni.mansionePrerequisito}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white mt-1">{corsoPerIscrizioni.titolo}</h4>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Docente: <strong className="text-slate-200">{corsoPerIscrizioni.docenteFormatore}</strong> • {corsoPerIscrizioni.oreTotali}h totali
                  </div>
                </div>

                <form onSubmit={handleIscriviVolontario} className="flex items-center gap-2 w-full lg:w-auto">
                  <select
                    required
                    value={volontarioDaIscrivereId}
                    onChange={(e) => setVolontarioDaIscrivereId(e.target.value)}
                    className="flex-1 lg:w-64 p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="">-- Seleziona Volontario --</option>
                    {volontari
                      .filter((v) => !corsoPerIscrizioni.iscritti.some((i) => i.volontarioId === v.id))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome} {v.cognome} ({v.qualifica || 'Volontario'})
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shrink-0 shadow-md active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Iscrivi al Corso</span>
                  </button>
                </form>
              </div>

              {/* Box Link Timbratura Esterni Senza Account per il Corso Selezionato */}
              <div className="bg-purple-950/35 border border-purple-500/40 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-purple-200 uppercase flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-purple-400" />
                      <span>Link Timbratura Esterni (Senza Account)</span>
                    </span>
                    {corsoPerIscrizioni.linkTimbraturaEsterniToken && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                        corsoPerIscrizioni.linkTimbraturaEsterniAttivo !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {corsoPerIscrizioni.linkTimbraturaEsterniAttivo !== false ? 'Link Attivo' : 'Link Disattivato'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-200/80">
                    Condividi un link dedicato per far timbrare in Aula Didattica persone non registrate (inserendo Nome, Cognome e Telefono). Le loro presenze e ore compaiono qui sotto evidenziate in <strong className="text-purple-300">viola</strong>.
                  </p>
                  {corsoPerIscrizioni.linkTimbraturaEsterniToken && (
                    <div className="pt-1 font-mono text-[11px] text-purple-300 break-all">
                      {buildLinkTimbraturaCorsoEsterno(corsoPerIscrizioni.linkTimbraturaEsterniToken)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => handleGeneraOCondividiLinkEsterni(corsoPerIscrizioni, false)}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{corsoPerIscrizioni.linkTimbraturaEsterniToken ? 'Mostra / Condividi Link' : 'Genera Link Esterni'}</span>
                  </button>
                  {corsoPerIscrizioni.linkTimbraturaEsterniToken && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopiaLinkEsterno(buildLinkTimbraturaCorsoEsterno(corsoPerIscrizioni.linkTimbraturaEsterniToken!))}
                        className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAttivoLinkEsterni(corsoPerIscrizioni)}
                        className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Attiva o disattiva questo link esterno"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{corsoPerIscrizioni.linkTimbraturaEsterniAttivo !== false ? 'Disattiva' : 'Riattiva'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Barra Selezione Multipla PDF Attestati Iscritti */}
              {selectedIscrittiPdfIds.length > 0 && (() => {
                const idoneiSelezionati = corsoPerIscrizioni.iscritti
                  .filter((p) => p.esito === 'Idoneo / Superato' && selectedIscrittiPdfIds.includes(p.volontarioId))
                  .map((partecipante) => ({ corso: corsoPerIscrizioni, partecipante }));
                if (idoneiSelezionati.length === 0) return null;
                return (
                  <div className="bg-indigo-950/60 border-2 border-indigo-500/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-100">
                      <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>
                        <strong>{idoneiSelezionati.length}</strong> attestato/i selezionato/i per questo corso
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedIscrittiPdfIds([])}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Deseleziona
                      </button>
                      <button
                        type="button"
                        disabled={batchPdfInCorso}
                        onClick={() =>
                          handleBatchPdfAttestati(
                            idoneiSelezionati,
                            'download',
                            `Attestati_${(corsoPerIscrizioni.codiceCorso || 'Corso').replace(/[^a-zA-Z0-9_-]/g, '_')}`
                          )
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scarica PDF ({idoneiSelezionati.length})</span>
                      </button>
                      <button
                        type="button"
                        disabled={batchPdfInCorso}
                        onClick={() =>
                          handleBatchPdfAttestati(
                            idoneiSelezionati,
                            'print',
                            `Attestati_${(corsoPerIscrizioni.codiceCorso || 'Corso').replace(/[^a-zA-Z0-9_-]/g, '_')}`
                          )
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Stampa PDF ({idoneiSelezionati.length})</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Tabella Iscritti al Corso */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                        <th className="py-3 px-3 w-10 text-center">
                          {(() => {
                            const idoneiIds = corsoPerIscrizioni.iscritti
                              .filter((x) => x.esito === 'Idoneo / Superato')
                              .map((x) => x.volontarioId);
                            const allSel = idoneiIds.length > 0 && idoneiIds.every((id) => selectedIscrittiPdfIds.includes(id));
                            return (
                              <button
                                type="button"
                                disabled={idoneiIds.length === 0}
                                onClick={() => toggleSelezionaTuttiIscrittiPdf(idoneiIds)}
                                className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                title="Seleziona tutti gli attestati idonei per download/stampa PDF"
                              >
                                {allSel ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                              </button>
                            );
                          })()}
                        </th>
                        <th className="py-3 px-4">Volontario</th>
                        <th className="py-3 px-4">Qualifica</th>
                        <th className="py-3 px-4">Timbratura GPS (Entrata / Uscita)</th>
                        <th className="py-3 px-4">Ore Frequentate</th>
                        <th className="py-3 px-4">Esito Finale</th>
                        <th className="py-3 px-4">Attestato / Brevetto</th>
                        <th className="py-3 px-4 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {corsoPerIscrizioni.iscritti.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            Nessun volontario ancora iscritto a questo corso. Utilizza il selettore sopra per aggiungere iscritti.
                          </td>
                        </tr>
                      ) : (
                        corsoPerIscrizioni.iscritti.map((p) => {
                          const isEsterno = Boolean(p.isEsterno || p.volontarioId?.startsWith('ext-'));
                          const isIdoneo = p.esito === 'Idoneo / Superato';
                          const isSelPdf = isIdoneo && selectedIscrittiPdfIds.includes(p.volontarioId);
                          const oreMinime = corsoPerIscrizioni.oreMinimeFrequenza || Math.round((corsoPerIscrizioni.oreTotali * (corsoPerIscrizioni.percentualeMinimaPresenza || 75)) / 100);
                          const raggiuntoMinimo = p.oreFrequentate >= oreMinime;
                          const percentualeEffettiva = Math.round((p.oreFrequentate / corsoPerIscrizioni.oreTotali) * 100);

                          return (
                            <tr
                              key={p.volontarioId}
                              className={`transition-colors ${
                                isEsterno
                                  ? 'bg-purple-950/60 hover:bg-purple-900/50 border-l-4 border-l-purple-500'
                                  : isSelPdf
                                  ? 'bg-indigo-950/25'
                                  : 'hover:bg-slate-900/50'
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                {isIdoneo ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleSelezionaIscrittoPdf(p.volontarioId)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                    title="Seleziona attestato PDF"
                                  >
                                    {isSelPdf ? (
                                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                                    ) : (
                                      <Square className="w-4 h-4" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-slate-700">—</span>
                                )}
                              </td>
                              <td className={`py-3 px-4 font-bold text-sm ${isEsterno ? 'text-purple-100' : 'text-white'}`}>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{p.volontarioNome}</span>
                                  {isEsterno && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white text-[9.5px] font-black uppercase">
                                      Esterno (Link)
                                    </span>
                                  )}
                                </div>
                                {isEsterno && p.telefonoEsterno && (
                                  <div className="text-[11px] font-mono text-purple-300 flex items-center gap-1 mt-0.5">
                                    <Phone className="w-3 h-3" />
                                    <span>{p.telefonoEsterno}</span>
                                  </div>
                                )}
                              </td>
                              <td className={`py-3 px-4 ${isEsterno ? 'text-purple-200 font-semibold' : 'text-slate-300'}`}>
                                {isEsterno ? 'Partecipante Esterno (Senza Account)' : p.qualifica}
                              </td>

                              {/* Timbratura GPS Entrata / Uscita */}
                              <td className="py-3 px-4 text-[11px] font-mono">
                                {p.timbraturaEntrata || p.timbraturaUscita || (p.timbratureLezioni && p.timbratureLezioni.length > 0) ? (
                                  <div className="space-y-1">
                                    {p.timbraturaEntrata && (
                                      <div className="text-emerald-400 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                        <span>
                                          Entr: {typeof p.timbraturaEntrata === 'object'
                                            ? `${p.timbraturaEntrata.orario} (${p.timbraturaEntrata.distanzaMetri !== undefined ? `±${p.timbraturaEntrata.distanzaMetri}m` : 'GPS'})`
                                            : p.timbraturaEntrata}
                                        </span>
                                      </div>
                                    )}
                                    {p.timbraturaUscita ? (
                                      <div className="text-sky-400 flex items-center gap-1">
                                        <span>
                                          🏁 Usc: {typeof p.timbraturaUscita === 'object'
                                            ? `${p.timbraturaUscita.orario} (${p.timbraturaUscita.distanzaMetri !== undefined ? `±${p.timbraturaUscita.distanzaMetri}m` : 'GPS'})`
                                            : p.timbraturaUscita}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-amber-400 text-[10px] italic">
                                        In attesa timbratura uscita GPS
                                      </div>
                                    )}

                                    {p.oreEMinutiTesto && (
                                      <div className="text-amber-300 font-bold text-[10px] flex items-center gap-1 pt-0.5">
                                        ⏱️ Presenza calcolata: {p.oreEMinutiTesto}
                                      </div>
                                    )}

                                    {p.timbratureLezioni && p.timbratureLezioni.length > 0 && (
                                      <div className="pt-1 mt-1 border-t border-slate-800 text-[9.5px] space-y-0.5">
                                        <div className="text-slate-400 font-semibold">
                                          Incontri svolti ({p.timbratureLezioni.length}):
                                        </div>
                                        {p.timbratureLezioni.map((tl, i) => (
                                          <div key={i} className="flex items-center justify-between text-slate-400 font-mono gap-1">
                                            <span className="truncate">Lez #{tl.lezioneNumero}: {typeof tl.timbraturaEntrata === 'object' ? tl.timbraturaEntrata.orario : '✓'}➔{typeof tl.timbraturaUscita === 'object' ? tl.timbraturaUscita.orario : '...'}</span>
                                            <span className="text-emerald-400 font-bold shrink-0">{tl.oreEMinutiTesto || `${tl.oreFrequentate}h`}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">Nessuna timbratura GPS</span>
                                )}
                              </td>

                              {/* Ore Frequentate (aggiornate via GPS o modificabili manualmente dall'operatore autorizzato) */}
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      max={corsoPerIscrizioni.oreTotali}
                                      value={p.oreFrequentate}
                                      onChange={(e) =>
                                        handleAggiornaEsito(
                                          corsoPerIscrizioni.id,
                                          p.volontarioId,
                                          p.esito,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="w-16 p-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-center font-bold"
                                      title="Ore frequentate: aggiornate da timbratura GPS o inseribili manualmente"
                                    />
                                    <span className="text-slate-400 text-xs font-mono">/ {corsoPerIscrizioni.oreTotali}h</span>
                                    {p.oreEMinutiTesto && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[9.5px] font-bold">
                                        {p.oreEMinutiTesto}
                                      </span>
                                    )}
                                  </div>

                                  <div>
                                    {raggiuntoMinimo ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9.5px] font-bold">
                                        ✓ Minimo {corsoPerIscrizioni.percentualeMinimaPresenza || 75}% ({percentualeEffettiva}%)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9.5px] font-bold">
                                        Mancano {Math.max(0, oreMinime - p.oreFrequentate)}h ({percentualeEffettiva}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <select
                                  value={p.esito}
                                  onChange={(e) =>
                                    handleAggiornaEsito(
                                      corsoPerIscrizioni.id,
                                      p.volontarioId,
                                      e.target.value as any,
                                      p.oreFrequentate
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                    isIdoneo
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                                      : p.esito === 'Non Idoneo'
                                      ? 'bg-red-950 text-red-300 border-red-800'
                                      : 'bg-slate-900 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  <option value="Iscritto">Iscritto</option>
                                  <option value="In Frequenza">In Frequenza</option>
                                  <option value="Idoneo / Superato">Idoneo / Superato</option>
                                  <option value="Non Idoneo">Non Idoneo</option>
                                  <option value="Ritirato">Ritirato</option>
                                </select>
                                {corsoPerIscrizioni.mansioneRilasciata && (
                                  <div className="mt-1">
                                    {isIdoneo ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                                        🎖️ {corsoPerIscrizioni.mansioneRilasciata} (Acquisita)
                                      </span>
                                    ) : (
                                      <span className="text-[9.5px] text-amber-300/80 block">
                                        Riconosce: {corsoPerIscrizioni.mansioneRilasciata} {corsoPerIscrizioni.prevedeEsame ? '(esame)' : ''}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono">
                                {p.numeroAttestato ? (
                                  <div>
                                    <span className={`font-bold inline-block ${
                                      p.numeroAttestato.startsWith('GEV-')
                                        ? 'text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-600/50'
                                        : 'text-amber-400'
                                    }`}>
                                      {p.numeroAttestato}
                                    </span>
                                    {p.scadenzaBrevetto && (
                                      <div className="text-[10px] text-slate-400">Scad: {p.scadenzaBrevetto}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isIdoneo ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={operazioneAttestatoInCorso}
                                        onClick={() => handleScaricaAttestato(corsoPerIscrizioni, p)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 disabled:opacity-50 text-emerald-300 border border-emerald-600/50 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                                        title={corsoPerIscrizioni.tipologia === 'Seminario PSV' ? 'Scarica Attestato Ufficiale GEV (PDF)' : 'Scarica Attestato Ufficiale PDF'}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Scarica PDF</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAttestatoPerStampa({ corso: corsoPerIscrizioni, partecipante: p })}
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                                        title="Anteprima Scheda Attestato"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Anteprima</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAggiornaEsito(
                                          corsoPerIscrizioni.id,
                                          p.volontarioId,
                                          'Idoneo / Superato',
                                          p.oreFrequentate || corsoPerIscrizioni.oreTotali
                                        )
                                      }
                                      className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                                      title="Rilascia Attestato Ufficiale e assegna matricola progressiva"
                                    >
                                      <Award className="w-3.5 h-3.5" />
                                      <span>Rilascia Attestato</span>
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
          ) : (
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
              Seleziona un corso dal menu a tendina sopra per visualizzare o inserire gli iscritti.
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SOTTO-TAB: SCADENZIARIO BREVETTI & ABILITAZIONI                    */}
      {/* ===================================================================== */}
      {sottoTab === 'scadenziario' && (
        <div className="space-y-4">
          {/* Header e Banner Avviso Automatico Scadenze Attestati & Brevetti (30gg e 15gg) */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Scadenziario Brevetti & Retraining Obbligatorio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitora la validità dei brevetti formativi (BLSD biennale, Guida Sicura, Protezione Civile, Soccorso Veterinario). Notifiche automatiche a <strong>30 giorni</strong> e <strong>15 giorni</strong> prima della data limite.
              </p>
            </div>

            <button
              type="button"
              disabled={invioEmailAttestatiInCorso || attestatiInScadenza30Gg.length === 0}
              onClick={async () => {
                await inviaEmailScadenzeAttestatiAutomatico(
                  attestatiInScadenza30Gg,
                  `Invio manuale riepilogo scadenziario attestati e brevetti (${attestatiInScadenza30Gg.length} nominativi)`,
                  true
                );
                mostraAvviso(`✓ Notifica scadenze inviata con successo a formazione@croceoro.oeg e presidenza@croceoro.org (${attestatiInScadenza30Gg.length} brevetti).`);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{invioEmailAttestatiInCorso ? 'Invio in corso...' : 'Invia Email Scadenziario (formazione@ & presidenza@)'}</span>
            </button>
          </div>

          {/* Banner Stato Notifiche Email */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-bold">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Destinatari Notifiche Scadenza (Preavviso 30gg e 15gg prima):</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono text-[11px] font-bold">
                Ufficio Formazione: formazione@croceoro.oeg
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-700/60 text-purple-300 font-mono text-[11px] font-bold">
                Presidenza: presidenza@croceoro.org
              </span>
              {attestatiUrgenti15Gg.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold animate-pulse">
                  {attestatiUrgenti15Gg.length} urgenti (≤ 15 gg o scaduti)
                </span>
              )}
            </div>
          </div>

          {/* Barra Selezione Multipla PDF Attestati Scadenziario */}
          {selectedScadenziarioKeys.length > 0 && (() => {
            const scelti = tuttiGliAttestati.filter(({ corso, partecipante }) =>
              selectedScadenziarioKeys.includes(`${corso.id}::${partecipante.volontarioId}`)
            );
            if (scelti.length === 0) return null;
            return (
              <div className="bg-indigo-950/60 border-2 border-indigo-500/60 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-100">
                  <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    <strong>{scelti.length}</strong> brevetto/i & attestato/i selezionato/i
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedScadenziarioKeys([])}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Deseleziona
                  </button>
                  <button
                    type="button"
                    disabled={batchPdfInCorso}
                    onClick={() =>
                      handleBatchPdfAttestati(scelti, 'download', `Scadenziario_Attestati_${formatISODateItaly()}`)
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Scarica PDF ({scelti.length})</span>
                  </button>
                  <button
                    type="button"
                    disabled={batchPdfInCorso}
                    onClick={() =>
                      handleBatchPdfAttestati(scelti, 'print', `Scadenziario_Attestati_${formatISODateItaly()}`)
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Stampa PDF ({scelti.length})</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Tabella Elenco Brevetti e Stato Preavviso */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-3 w-10 text-center">
                      {(() => {
                        const allKeys = tuttiGliAttestati.map(({ corso, partecipante }) => `${corso.id}::${partecipante.volontarioId}`);
                        const allSel = allKeys.length > 0 && allKeys.every((k) => selectedScadenziarioKeys.includes(k));
                        return (
                          <button
                            type="button"
                            disabled={allKeys.length === 0}
                            onClick={() => toggleSelezionaTuttiScadenziario(allKeys)}
                            className="text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Seleziona tutti gli attestati per download/stampa PDF"
                          >
                            {allSel ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        );
                      })()}
                    </th>
                    <th className="py-3 px-4">Volontario</th>
                    <th className="py-3 px-4">Brevetto / Abilitazione</th>
                    <th className="py-3 px-4">Numero Attestato</th>
                    <th className="py-3 px-4 font-mono">Data Conseguimento</th>
                    <th className="py-3 px-4 font-mono">Data Scadenza</th>
                    <th className="py-3 px-4">Stato Preavviso / Validità</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tuttiGliAttestati.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nessun attestato ancora rilasciato nel registro corsi.
                      </td>
                    </tr>
                  ) : (
                    tuttiGliAttestati.map(({ corso, partecipante }) => {
                      const rowKey = `${corso.id}::${partecipante.volontarioId}`;
                      const isSel = selectedScadenziarioKeys.includes(rowKey);
                      const oggiMs = Date.now();
                      const msGiorno = 1000 * 60 * 60 * 24;
                      const hasScadenza = Boolean(partecipante.scadenzaBrevetto);
                      const scadMs = hasScadenza ? new Date(partecipante.scadenzaBrevetto!).getTime() : null;
                      const diffGg = scadMs ? Math.ceil((scadMs - oggiMs) / msGiorno) : null;

                      let scaglione: '30_giorni' | '15_giorni' | 'scaduto' | 'regolare' = 'regolare';
                      if (diffGg !== null) {
                        if (diffGg <= 0) scaglione = 'scaduto';
                        else if (diffGg <= 15) scaglione = '15_giorni';
                        else if (diffGg <= 30) scaglione = '30_giorni';
                      }

                      return (
                        <tr key={`${corso.id}-${partecipante.volontarioId}`} className={`transition-colors ${isSel ? 'bg-indigo-950/25' : 'hover:bg-slate-900/50'}`}>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelezionaScadenziario(rowKey)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                              title="Seleziona attestato per download/stampa PDF"
                            >
                              {isSel ? (
                                <CheckSquare className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-bold text-white text-sm">
                            {partecipante.volontarioNome}
                            {partecipante.qualifica && (
                              <div className="text-[10px] text-slate-400 font-normal">{partecipante.qualifica}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div className="font-bold">{corso.titolo}</div>
                            <div className="text-[10px] text-indigo-400 font-mono">{corso.tipologia}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {partecipante.numeroAttestato || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {partecipante.dataRilascioAttestato || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {partecipante.scadenzaBrevetto || 'Permanente'}
                          </td>
                          <td className="py-3 px-4">
                            {scaglione === 'scaduto' ? (
                              <span className="px-2.5 py-1 rounded-full bg-red-950 text-red-300 border border-red-700 text-[10px] font-black flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-red-400" />
                                Scaduto ({Math.abs(diffGg!)} gg fa)
                              </span>
                            ) : scaglione === '15_giorni' ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-black flex items-center gap-1 w-fit animate-pulse">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Preavviso 15 gg ({diffGg} gg rimasti)
                              </span>
                            ) : scaglione === '30_giorni' ? (
                              <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-600 text-[10px] font-black flex items-center gap-1 w-fit">
                                <Clock className="w-3 h-3 text-blue-400" />
                                Preavviso 30 gg ({diffGg} gg rimasti)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                In Corso di Validità
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasScadenza && (
                                <button
                                  type="button"
                                  disabled={invioEmailAttestatiInCorso}
                                  onClick={async () => {
                                    await inviaEmailScadenzeAttestatiAutomatico(
                                      [{
                                        corso,
                                        partecipante,
                                        scadenzaBrevetto: partecipante.scadenzaBrevetto!,
                                        giorniRimanenti: diffGg || 0,
                                        scaglione: scaglione === 'regolare' ? '30_giorni' : scaglione
                                      }],
                                      `Avviso scadenza attestato per ${partecipante.volontarioNome}`,
                                      true
                                    );
                                    mostraAvviso(`✓ Notifica inviata a formazione@croceoro.oeg e presidenza@croceoro.org per ${partecipante.volontarioNome}.`);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 text-indigo-300 border border-indigo-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Invia email di avviso scadenza a formazione@croceoro.oeg e presidenza@croceoro.org"
                                >
                                  <Mail className="w-3 h-3 text-indigo-400" />
                                  <span>Invia Email</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setAttestatoPerStampa({ corso, partecipante })}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                                title="Visualizza Scheda / Scarica PDF"
                              >
                                <Eye className="w-3.5 h-3.5" />
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
      )}

      {/* ===================================================================== */}
      {/* 4. SOTTO-TAB: MODELLI PDF PRESTAMPATI & MATRICOLE PROGRESSIVE         */}
      {/* ===================================================================== */}
      {sottoTab === 'modelli_pdf' && canShowSubtab('modelli_pdf') && (
        <PannelloModelliAttestatiPdf
          corsi={corsi}
          operatoreCorrente={operatoreCorrente}
          onNotificaRadio={onNotificaRadio}
          onAvviso={mostraAvviso}
        />
      )}

      {/* ===================================================================== */}
      {/* 5. SOTTO-TAB: AULE FORMAZIONE GEOLOCALIZZATE                          */}
      {/* ===================================================================== */}
      {sottoTab === 'aule' && canShowSubtab('aule') && (
        <PannelloAuleFormazione
          sedi={sedi}
          isAdmin={isAdmin}
          operatoreNome={operatoreCorrente}
        />
      )}

      {/* MODALE NUOVO / MODIFICA CORSO */}
      {modaleCorsoAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl max-w-2xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {corsoInModifica ? `Modifica Corso: ${corsoInModifica.codiceCorso}` : 'Programma Nuovo Corso Formativo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleCorsoAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaCorso} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Corso</label>
                  <input
                    type="text"
                    required
                    value={formCodice}
                    onChange={(e) => setFormCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-indigo-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipologia Corso *</label>
                  <select
                    value={formTipologia}
                    onChange={(e) => {
                      const val = e.target.value as TipologiaCorso;
                      setFormTipologia(val);
                      if (val === 'Seminario PSV') {
                        setFormTitolo('TUTELA, SOCCORSO E BENESSERE ANIMALE');
                        setFormSottotitolo('“Dal Soccorso alla tutela degli animali”');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    {TIPOLOGIE_CORSO_CONSENTITE.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Titolo del Percorso Formativo *</label>
                  <input
                    type="text"
                    required
                    value={formTitolo}
                    onChange={(e) => setFormTitolo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    placeholder="es. TUTELA, SOCCORSO E BENESSERE ANIMALE"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sottotitolo Ufficiale</label>
                  <input
                    type="text"
                    value={formSottotitolo}
                    onChange={(e) => setFormSottotitolo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-semibold"
                    placeholder="es. “Dal Soccorso alla tutela degli animali”"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Descrizione & Programma Formativo</label>
                <textarea
                  rows={2}
                  required
                  value={formDescrizione}
                  onChange={(e) => setFormDescrizione(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Dettagli didattici e argomenti trattati..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Docente / Formatore Accreditato</label>
                  <input
                    type="text"
                    required
                    value={formDocente}
                    onChange={(e) => setFormDocente(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="es. Dott.ssa Valentina Moriconi (Formatore IRC)"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ente Accreditato / Riconoscimento</label>
                  <input
                    type="text"
                    required
                    value={formEnte}
                    onChange={(e) => setFormEnte(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* MANSIONI OPERATIVE & ESAMI FINALI COLLEGATI AL CORSO */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border-2 border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="font-black text-xs uppercase text-amber-200">
                      Riconoscimento Mansioni & Esame Finale (Database Mansioni)
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Assegnazione Automatica
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mansione Rilasciata al Superamento */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      🎖️ Mansione Acquisita al Superamento del Corso
                    </label>
                    <select
                      value={formMansioneRilasciata}
                      onChange={(e) => setFormMansioneRilasciata(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                    >
                      <option value="">-- Nessuna mansione rilasciata in automatico --</option>
                      {getMansioniCatalogo().map((m) => {
                        const ico = formatIconaPerTesto(m.badgeEmoji, '🎖️');
                        return (
                          <option key={m.id} value={m.nome}>
                            {ico ? `${ico} ` : ''}{m.nome} ({m.categoria})
                          </option>
                        );
                      })}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Viene assegnata in automatico all'anagrafica del volontario quando il corso/esame risulta superato.
                    </span>
                  </div>

                  {/* Mansione Prerequisito Obbligatoria per Iscrizione */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      🔒 Mansione Prerequisito Obbligatoria per Accedere
                    </label>
                    <select
                      value={formMansionePrerequisito}
                      onChange={(e) => setFormMansionePrerequisito(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-300 font-bold"
                    >
                      <option value="">-- Nessun prerequisito (Aperto a tutti i volontari) --</option>
                      {getMansioniCatalogo().map((m) => {
                        const ico = formatIconaPerTesto(m.badgeEmoji, '🔒');
                        return (
                          <option key={m.id} value={m.nome}>
                            {ico ? `${ico} ` : ''}{m.nome}
                          </option>
                        );
                      })}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Il volontario deve possedere questa mansione (o una superiore che la include) per potersi iscrivere.
                    </span>
                  </div>
                </div>

                {/* Checkbox Prevede Esame Finale */}
                <div className="pt-1 border-t border-amber-900/40">
                  <label className="flex items-center gap-2.5 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={formPrevedeEsame}
                      onChange={(e) => setFormPrevedeEsame(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs font-bold text-white">
                      Questo corso prevede un <u>esame finale di valutazione</u> obbligatorio per conseguire la mansione
                    </span>
                  </label>
                  <span className="text-[10.5px] text-slate-400 block ml-6">
                    Se selezionato, la mansione viene rilasciata solo previo superamento dell'esame abilitante.
                  </span>
                </div>
              </div>

              {/* SELEZIONE DESTINATARI DEL CORSO PER SEZIONI OPERATIVE (NO SINGOLI NOMI) */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-black text-xs uppercase text-indigo-200">
                      Destinatari del Corso per Sezione Territoriale *
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Visibili solo le sezioni, non i singoli nomi
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Seleziona le sezioni operative destinatarie: tutti i volontari assegnati alle sezioni scelte visualizzeranno la comunicazione al login e potranno iscriversi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {/* Opzione TUTTE LE SEZIONI */}
                  <div
                    onClick={() => {
                      if (formSezioniDestinatarieIds.includes('TUTTE')) {
                        setFormSezioniDestinatarieIds([]);
                      } else {
                        setFormSezioniDestinatarieIds(['TUTTE', ...SEDI_TERRITORIALI_GPS.map(s => s.id)]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      formSezioniDestinatarieIds.includes('TUTTE')
                        ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm font-bold'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏢</span>
                      <span className="text-xs">TUTTE le Sezioni dell'Associazione</span>
                    </div>
                    {formSezioniDestinatarieIds.includes('TUTTE') ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                  </div>

                  {/* Singole Sezioni */}
                  {SEDI_TERRITORIALI_GPS.map((s) => {
                    const isSelezionata = formSezioniDestinatarieIds.includes(s.id) || formSezioniDestinatarieIds.includes('TUTTE');
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          let nuove: string[];
                          if (formSezioniDestinatarieIds.includes('TUTTE')) {
                            // Se era selezionato TUTTE, rimuoviamo TUTTE e lasciamo le altre tranne questa
                            nuove = SEDI_TERRITORIALI_GPS.map(item => item.id).filter(id => id !== s.id);
                          } else if (formSezioniDestinatarieIds.includes(s.id)) {
                            nuove = formSezioniDestinatarieIds.filter(id => id !== s.id);
                          } else {
                            nuove = [...formSezioniDestinatarieIds, s.id];
                            if (nuove.length === SEDI_TERRITORIALI_GPS.length) {
                              nuove = ['TUTTE', ...nuove];
                            }
                          }
                          setFormSezioniDestinatarieIds(nuove);
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelezionata
                            ? 'bg-indigo-950/60 border-indigo-400 text-white font-bold'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-xs truncate">{s.nome}</span>
                        </div>
                        {isSelezionata ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEDE DI SVOLGIMENTO & GEOLOCALIZZAZIONE GPS PER TIMBRATURA */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-xs uppercase text-white">
                      Sede di Svolgimento & Coordinate GPS per Timbratura *
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    GPS: {formCoordinate.lat.toFixed(4)}, {formCoordinate.lng.toFixed(4)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-950/35 border border-purple-500/40 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="block text-purple-200 font-black text-[11px] uppercase">
                      🎓 Aula Formazione Didattica (Timbratura Esclusiva GPS)
                    </label>
                    <span className="text-[10px] text-purple-300 font-mono">
                      Raggio: {formRaggioMetriTimbratura}m
                    </span>
                  </div>
                  <select
                    value={formAulaFormazioneId}
                    onChange={(e) => {
                      const aulaId = e.target.value;
                      setFormAulaFormazioneId(aulaId);
                      if (aulaId) {
                        const aula = auleFormazione.find((a) => a.id === aulaId);
                        if (aula) {
                          setFormSede(aula.nome);
                          setFormCoordinate({ lat: aula.coordinate.lat, lng: aula.coordinate.lng });
                          setFormRaggioMetriTimbratura(aula.raggioMetri || 150);
                          if (aula.sedeRiferimentoId) {
                            setFormSedeTipo(aula.sedeRiferimentoId);
                          }
                        }
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-purple-500/50 text-purple-200 font-bold text-xs focus:ring-1 focus:ring-purple-400"
                  >
                    <option value="">-- Nessuna aula dedicata (usa la sede/coordinate sotto) --</option>
                    {auleFormazioneAttive.map((aula) => (
                      <option key={aula.id} value={aula.id}>
                        🎓 {aula.codice ? `[${aula.codice}] ` : ''}{aula.nome} — {aula.indirizzo} (raggio {aula.raggioMetri}m)
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-purple-200/80 leading-snug">
                    Chi è iscritto al corso timbrerà entrata e uscita sempre e solo nell'Aula Didattica indicata, anche se nello stesso edificio è presente un altro luogo timbratura. Gestisci le aule dalla scheda <strong>5. Aule Formazione</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Seleziona Sede / Sezione</label>
                    <select
                      value={formSedeTipo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormSedeTipo(val);
                        setFormAulaFormazioneId('');
                        if (val !== 'ALTRO') {
                          const s = SEDI_TERRITORIALI_GPS.find(item => item.id === val);
                          if (s) {
                            setFormSede(s.nome);
                            setFormCoordinate({ lat: s.lat, lng: s.lng });
                          }
                        }
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-indigo-500"
                    >
                      {SEDI_TERRITORIALI_GPS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome} ({s.indirizzo})
                        </option>
                      ))}
                      <option value="ALTRO">📍 ALTRO (Sede esterna con indirizzo manuale e mappa)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Stato Corso</label>
                    <select
                      value={formStato}
                      onChange={(e) => setFormStato(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                    >
                      <option value="Programmato">Programmato</option>
                      <option value="In Corso">In Corso</option>
                      <option value="Concluso">Concluso</option>
                      <option value="Annullato">Annullato</option>
                    </select>
                  </div>
                </div>

                {/* Se ALTRO: Inserimento manuale di nome, indirizzo completo e cartina interattiva per regolazione pin */}
                {formSedeTipo === 'ALTRO' && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Nome Posizione / Struttura Esterna *</label>
                        <input
                          type="text"
                          required
                          value={formNomePosizioneAltro}
                          onChange={(e) => setFormNomePosizioneAltro(e.target.value)}
                          placeholder="es. Ospedale delle Apuane (NOA) — Polo Didattico"
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Indirizzo Completo *</label>
                        <input
                          type="text"
                          required
                          value={formIndirizzoAltro}
                          onChange={(e) => setFormIndirizzoAltro(e.target.value)}
                          placeholder="es. Via Enrico Mattei 1, 54100 Massa (MS)"
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Cartina Interattiva con Pin Regolabile Senza Modificare l'Indirizzo */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                          <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                          <span>Cartina Regolazione Pin GPS (Non modifica l'indirizzo scritto)</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Clicca sulla mappa o usa i tasti micro-regolazione
                        </span>
                      </div>

                      {/* Canvas Mappa Interattiva */}
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = (e.clientX - rect.left) / rect.width;
                          const y = (e.clientY - rect.top) / rect.height;
                          // Regola leggermente latitudine e longitudine
                          const newLat = 44.000 + (1 - y) * 0.100;
                          const newLng = 10.050 + x * 0.150;
                          setFormCoordinate({ lat: Number(newLat.toFixed(5)), lng: Number(newLng.toFixed(5)) });
                        }}
                        className="relative w-full h-36 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden cursor-crosshair select-none shadow-inner"
                        style={{
                          backgroundImage: `radial-gradient(circle at center, #1e293b 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
                          backgroundSize: '20px 20px'
                        }}
                      >
                        {/* Strade e griglia schematica */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                          <div className="w-full h-1 bg-amber-500/40 rotate-12 absolute" />
                          <div className="h-full w-1 bg-sky-500/40 -rotate-12 absolute" />
                          <div className="w-3/4 h-3/4 rounded-full border border-dashed border-slate-600 absolute" />
                        </div>

                        {/* Pin Mappa Posizionato */}
                        <div
                          className="absolute transform -translate-x-1/2 -translate-y-full transition-all pointer-events-none"
                          style={{
                            left: `${Math.max(10, Math.min(90, ((formCoordinate.lng - 10.050) / 0.150) * 100))}%`,
                            top: `${Math.max(15, Math.min(85, (1 - ((formCoordinate.lat - 44.000) / 0.100)) * 100))}%`
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] shadow whitespace-nowrap mb-0.5">
                              {formNomePosizioneAltro || 'Sede Corso'}
                            </span>
                            <MapPin className="w-7 h-7 text-red-500 fill-red-500 filter drop-shadow-md animate-bounce" />
                          </div>
                        </div>

                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-950/80 rounded border border-slate-800 text-[10px] text-slate-300 font-mono">
                          Lat: {formCoordinate.lat.toFixed(5)} • Lng: {formCoordinate.lng.toFixed(5)}
                        </div>
                      </div>

                      {/* Tasti Micro-Regolazione Fine del Pin */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Micro-Spostamento Pin:</span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lat: Number((prev.lat + 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Nord"
                          >
                            Nord ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lat: Number((prev.lat - 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Sud"
                          >
                            Sud ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lng: Number((prev.lng - 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Ovest"
                          >
                            Ovest ←
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lng: Number((prev.lng + 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Est"
                          >
                            Est →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DATE, ORARI LEZIONE E PERCENTUALE MINIMA DI FREQUENZA */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Data Inizio *</label>
                    <input
                      type="date"
                      required
                      value={formDataInizio}
                      onChange={(e) => setFormDataInizio(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Data Fine *</label>
                    <input
                      type="date"
                      required
                      value={formDataFine}
                      onChange={(e) => setFormDataFine(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Orario Inizio *</label>
                    <input
                      type="time"
                      required
                      value={formOrarioInizioLezione}
                      onChange={(e) => setFormOrarioInizioLezione(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Orario Fine *</label>
                    <input
                      type="time"
                      required
                      value={formOrarioFineLezione}
                      onChange={(e) => setFormOrarioFineLezione(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Ore Totali del Corso *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formOreTotali}
                      onChange={(e) => setFormOreTotali(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Minimo Presenza Obbligatoria (%) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={formPercentualeMinima}
                        onChange={(e) => setFormPercentualeMinima(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium block mt-1">
                      Equivalente a: <strong>{Math.round((Number(formOreTotali) * Number(formPercentualeMinima)) / 100)} ore minime</strong>
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Max Partecipanti *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formMaxPartecipanti}
                      onChange={(e) => setFormMaxPartecipanti(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* PROGRAMMA LEZIONI / INCONTRI (FINO A 20 INCONTRI IN SEDI E ORARI DIVERSI) */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border-2 border-indigo-500/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span className="font-black text-xs uppercase text-white">
                        Programma Incontri & Lezioni Formative ({formLezioni.length} / 20)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Il corso può prevedere fino a 20 lezioni in giorni, orari e sedi diverse. La presenza dei volontari verrà timbrata via GPS nella sede specifica di ciascuna lezione.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={formLezioni.length >= 20}
                    onClick={() => {
                      if (formLezioni.length >= 20) return;
                      const num = formLezioni.length + 1;
                      const primaSede = SEDI_TERRITORIALI_GPS[(num - 1) % SEDI_TERRITORIALI_GPS.length];
                      const nuovaLezione: LezioneCorso = {
                        id: `lez-${Date.now()}-${num}`,
                        numero: num,
                        titolo: `Incontro ${num}`,
                        data: formDataInizio,
                        orarioInizio: formOrarioInizioLezione || '09:00',
                        orarioFine: formOrarioFineLezione || '13:00',
                        ore: 4,
                        sedeNome: primaSede.nome,
                        indirizzoCompleto: primaSede.indirizzo,
                        coordinate: { lat: primaSede.lat, lng: primaSede.lng },
                        docente: formDocente || 'Docente Formatore'
                      };
                      const agg = [...formLezioni, nuovaLezione];
                      setFormLezioni(agg);
                      const somma = agg.reduce((s, l) => s + (Number(l.ore) || 0), 0);
                      if (somma > 0) setFormOreTotali(somma);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition-all ${
                      formLezioni.length >= 20
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer active:scale-95'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Aggiungi Incontro / Lezione (Max 20)</span>
                  </button>
                </div>

                {/* Lista Lezioni */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {formLezioni.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                      Nessun singolo incontro impostato. Clicca sul pulsante sopra per aggiungere fino a 20 lezioni in sedi e orari diversi.
                    </div>
                  ) : (
                    formLezioni.map((lez, idx) => (
                      <div key={lez.id || idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                          <span className="font-black text-amber-400">
                            Lezione #{idx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-400 font-mono">
                              GPS: {lez.coordinate?.lat?.toFixed(4)}, {lez.coordinate?.lng?.toFixed(4)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const agg = formLezioni.filter((_, i) => i !== idx).map((item, i) => ({ ...item, numero: i + 1 }));
                                setFormLezioni(agg);
                                const somma = agg.reduce((s, l) => s + (Number(l.ore) || 0), 0);
                                if (somma > 0) setFormOreTotali(somma);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-white"
                              title="Rimuovi lezione"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Argomento / Titolo Lezione</label>
                            <input
                              type="text"
                              value={lez.titolo || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, titolo: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                              placeholder={`Argomento lezione ${idx + 1}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Docente</label>
                            <input
                              type="text"
                              value={lez.docente || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, docente: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                              placeholder="Docente"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Data Lezione</label>
                            <input
                              type="date"
                              value={lez.data}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, data: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Orario Inizio</label>
                            <input
                              type="time"
                              value={lez.orarioInizio}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, orarioInizio: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Orario Fine</label>
                            <input
                              type="time"
                              value={lez.orarioFine}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, orarioFine: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Ore Durata</label>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={lez.ore}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setFormLezioni(prev => {
                                  const agg = prev.map((item, i) => i === idx ? { ...item, ore: val } : item);
                                  const somma = agg.reduce((s, l) => s + (Number(l.ore) || 0), 0);
                                  if (somma > 0) setFormOreTotali(somma);
                                  return agg;
                                });
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-xs font-bold"
                            />
                          </div>
                        </div>

                        {/* Sede / Aula specifica per questa lezione con coordinate GPS per timbratura */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-purple-300 font-bold mb-0.5">
                              🎓 Aula Formazione di QUESTA Lezione
                            </label>
                            <select
                              value={lez.aulaFormazioneId || ''}
                              onChange={(e) => {
                                const aulaId = e.target.value;
                                const aula = auleFormazione.find((a) => a.id === aulaId);
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  aulaFormazioneId: aula?.id || undefined,
                                  aulaFormazioneNome: aula?.nome || undefined,
                                  raggioMetriTimbratura: aula?.raggioMetri || item.raggioMetriTimbratura,
                                  ...(aula ? {
                                    sedeNome: aula.nome,
                                    indirizzoCompleto: aula.indirizzo,
                                    coordinate: { lat: aula.coordinate.lat, lng: aula.coordinate.lng }
                                  } : {})
                                } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-purple-500/40 text-purple-200 text-xs font-bold"
                            >
                              <option value="">-- Usa aula del corso / sede sotto --</option>
                              {auleFormazioneAttive.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nome} ({a.raggioMetri}m)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">
                              📍 Sede di Svolgimento di QUESTA Lezione
                            </label>
                            <select
                              value={lez.sedeNome}
                              onChange={(e) => {
                                const sel = SEDI_TERRITORIALI_GPS.find(s => s.nome === e.target.value);
                                if (sel) {
                                  setFormLezioni(prev => prev.map((item, i) => i === idx ? {
                                    ...item,
                                    aulaFormazioneId: undefined,
                                    aulaFormazioneNome: undefined,
                                    sedeNome: sel.nome,
                                    indirizzoCompleto: sel.indirizzo,
                                    coordinate: { lat: sel.lat, lng: sel.lng }
                                  } : item));
                                }
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-200 text-xs font-bold"
                            >
                              {!SEDI_TERRITORIALI_GPS.some(s => s.nome === lez.sedeNome) && (
                                <option value={lez.sedeNome}>{lez.sedeNome}</option>
                              )}
                              {SEDI_TERRITORIALI_GPS.map((s) => (
                                <option key={s.id} value={s.nome}>
                                  {s.nome} ({s.indirizzo})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleCorsoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Corso Formativo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ANTEPRIMA & STAMPA ATTESTATO UFFICIALE */}
      {attestatoPerStampa && (() => {
        const isPSV = attestatoPerStampa.corso.tipologia === 'Seminario PSV';
        const isSeminario = attestatoPerStampa.corso.tipologia.toLowerCase().includes('seminario');
        const modelloCat = getModelloPerTipologia(attestatoPerStampa.corso.tipologia);
        const usaPrestampato = Boolean(modelloCat.attivo && modelloCat.hasPdfFile);
        const cittaPrevalente =
          editAttestatoLuogo.trim() ||
          (attestatoPerStampa.partecipante.luogoRilascioAttestato || '').trim() ||
          (modelloCat.luogoRilascioDefault || '').trim() ||
          determinaCittaPrevalenteCorso(attestatoPerStampa.corso);
        const intervalloDate = formattaIntervalloDateItaliano(attestatoPerStampa.corso.dataInizio, attestatoPerStampa.corso.dataFine);
        const dataStampa = formattaDataSlash(editAttestatoData || attestatoPerStampa.partecipante.dataRilascioAttestato || formatISODateItaly());

        let numAttestato = (editAttestatoMatricola || attestatoPerStampa.partecipante.numeroAttestato || '').trim();
        if (!numAttestato) {
          numAttestato = generaNumeroAttestato(attestatoPerStampa.corso.tipologia, corsi);
        }

        const titoloMostrato = isPSV
          ? 'TUTELA, SOCCORSO E BENESSERE ANIMALE'
          : (attestatoPerStampa.corso.titolo || attestatoPerStampa.corso.tipologia || 'CORSO DI FORMAZIONE').toUpperCase();

        const sottotitoloMostrato = isPSV
          ? '“Dal Soccorso alla tutela degli animali”'
          : (attestatoPerStampa.corso.sottotitolo || '');

        const partecipanteConModifiche: PartecipanteCorso = {
          ...attestatoPerStampa.partecipante,
          numeroAttestato: numAttestato,
          dataRilascioAttestato: editAttestatoData || attestatoPerStampa.partecipante.dataRilascioAttestato,
          luogoRilascioAttestato: cittaPrevalente
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border-4 border-[#bfa353] max-h-[92vh] overflow-y-auto">
              <div className="text-center space-y-1">
                <div className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  {usaPrestampato
                    ? `PDF Prestampato Categoria "${attestatoPerStampa.corso.tipologia}" Attivo`
                    : 'Croce Oro Massa Carrara OdV • Layout Regionale A4 Ufficiale'}
                </div>
                <h2 className="text-xl font-black text-[#1d1a60] uppercase">
                  Attestato di Partecipazione
                </h2>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-300">
                    Matricola: <strong>{numAttestato}</strong>
                  </span>
                  {usaPrestampato && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">
                      📄 Prestampato: {modelloCat.fileName || 'PDF personalizzato'}
                    </span>
                  )}
                </div>
              </div>

              {/* Controllo & Modifica rapida dei 3 campi stampati (Matricola, Data, Luogo) */}
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3.5 space-y-2.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    <span>Verifica / Modifica Dati Attestato</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSalvaDatiAttestatoSingolo}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Salva Dati</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      Numero di Matricola
                    </label>
                    <input
                      type="text"
                      value={editAttestatoMatricola}
                      onChange={(e) => setEditAttestatoMatricola(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-slate-900 font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      Luogo di Rilascio
                    </label>
                    <input
                      type="text"
                      value={editAttestatoLuogo}
                      onChange={(e) => setEditAttestatoLuogo(e.target.value)}
                      placeholder="es. Massa"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-slate-900 font-semibold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                      Data di Rilascio
                    </label>
                    <input
                      type="date"
                      value={editAttestatoData}
                      onChange={(e) => setEditAttestatoData(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-slate-900 font-semibold text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* ANTEPRIMA RIEPILOGATIVA */}
              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 text-center space-y-3.5">
                {usaPrestampato && (
                  <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    Al download verrà utilizzato il tuo PDF prestampato di categoria compilando <strong>solamente</strong>: Nome e Cognome, Data e Luogo di rilascio e Numero di Matricola.
                  </div>
                )}

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {isSeminario ? 'Seminario Formativo Regionale:' : 'Corso Formativo Regionale:'}
                </div>
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 space-y-0.5">
                  <div className="text-lg font-black text-[#1d1a60] uppercase tracking-wide">
                    {titoloMostrato}
                  </div>
                  {sottotitoloMostrato && (
                    <div className="text-xs font-semibold text-amber-800 italic">
                      {sottotitoloMostrato}
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-600 pt-1">
                  {isSeminario ? 'Ha frequentato con assiduità il Seminario:' : 'Ha frequentato con assiduità il Corso Formativo:'}
                </div>
                <div className="text-2xl font-black text-[#1d1a60] tracking-wide pb-1 border-b-2 border-slate-900 mx-6">
                  {(attestatoPerStampa.partecipante.volontarioNome || 'PARTECIPANTE').toUpperCase()}
                </div>

                <div className="text-xs text-slate-700 leading-relaxed font-semibold pt-1">
                  Organizzato da <strong>Croce Oro Massa Carrara OdV</strong> presso la sede operativa di{' '}
                  <strong className="text-indigo-900 underline">{cittaPrevalente}</strong> {intervalloDate}.
                </div>

                <div className="flex items-center justify-between text-xs pt-3 px-2 border-t border-slate-200 text-slate-600">
                  <div className="text-left font-mono">
                    <div>
                      <span>Matricola: </span>
                      <strong className="text-indigo-950 font-bold">{numAttestato}</strong>
                    </div>
                    <div>
                      <span>Rilascio: </span>
                      <strong className="text-slate-800">
                        {modelloCat.formatoDataLuogo === 'virgola'
                          ? `${cittaPrevalente}, ${dataStampa}`
                          : `${cittaPrevalente}, lì ${dataStampa}`}
                      </strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Il Presidente Croce Oro Massa Carrara</div>
                    <div className="font-bold text-slate-900">Claudio Simonini</div>
                    <span className="text-[10px] text-emerald-600 font-mono">✓ Firma Digitale Autografa Apposta</span>
                  </div>
                </div>
              </div>

              {/* AZIONI PRE-GENERAZIONE PDF (Anteprima / Stampa / Salva in Archivio / Torna alla Modifica) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAttestatoPerStampa(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Chiudi Scheda
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
                    <button
                      type="button"
                      disabled={operazioneAttestatoInCorso}
                      onClick={() => handleCondividiAttestato(attestatoPerStampa.corso, partecipanteConModifiche)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer transition-all"
                      title="Salva in File / Invia su WhatsApp o Drive"
                    >
                      <Share2 className="w-4 h-4 text-emerald-200" />
                      <span>Condividi / Salva App</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={operazioneAttestatoInCorso}
                    onClick={() => setAnteprimaWorkflowAttestatoAperta(true)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1d1a60] hover:bg-[#2b2787] disabled:opacity-50 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer transition-all"
                  >
                    <Eye className="w-4 h-4 text-amber-300" />
                    <span>{usaPrestampato ? 'Anteprima, Stampa o Salva PDF Prestampato' : 'Anteprima, Stampa o Salva PDF'}</span>
                  </button>
                </div>
              </div>
            </div>

            {anteprimaWorkflowAttestatoAperta && (
              <PdfAnteprimaWorkflowModal
                aperto={true}
                titoloDocumento={`Attestato ${numAttestato}`}
                sottotitolo={`${partecipanteConModifiche.volontarioNome || 'Partecipante'} • ${attestatoPerStampa.corso.titolo}`}
                nomeFile={`Attestato_${numAttestato.replace(/[^a-zA-Z0-9_-]/g, '_')}_${(partecipanteConModifiche.volontarioNome || 'Partecipante').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
                generaPdfBytes={() =>
                  scaricaAttestatoPDF(attestatoPerStampa.corso, partecipanteConModifiche, {
                    downloadImmediato: false,
                    apiBaseUrl: realtime.getApiBaseUrl(),
                    luogoRilascio: partecipanteConModifiche.luogoRilascioAttestato,
                    dataRilascio: partecipanteConModifiche.dataRilascioAttestato
                  })
                }
                riepilogoContenuto={
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-mono font-bold text-[#1d1a60]">
                      <span>Matricola: {numAttestato}</span>
                      <span>Rilascio: {cittaPrevalente}, {dataStampa}</span>
                    </div>
                    <div>Partecipante: <strong>{(partecipanteConModifiche.volontarioNome || 'PARTECIPANTE').toUpperCase()}</strong></div>
                    <div>Corso / Seminario: <strong>{titoloMostrato}</strong></div>
                    <div>Tipologia: <strong>{attestatoPerStampa.corso.tipologia}</strong></div>
                    <div>Periodo: <strong>{intervalloDate}</strong></div>
                  </div>
                }
                testoSalvaInArchivio="Salva Dati in Archivio"
                onSalvaInArchivio={() => {
                  handleSalvaDatiAttestatoSingolo();
                }}
                onTornaAllaModifica={() => setAnteprimaWorkflowAttestatoAperta(false)}
                onChiudi={() => setAnteprimaWorkflowAttestatoAperta(false)}
                onFeedback={(msg) => mostraAvviso(msg)}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
};
