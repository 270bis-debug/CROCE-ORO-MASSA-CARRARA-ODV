import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Ambulance,
  Search,
  PlusCircle,
  Wrench,
  Package,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Gauge,
  ShieldAlert,
  Car,
  FileText,
  DollarSign,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  Save,
  X,
  Check,
  Flame,
  Activity,
  Building2,
  BarChart3,
  Fuel,
  Mail,
  Send,
  Coins,
  Download,
  ClipboardCheck
} from 'lucide-react';
import { MezzoFlotta, InterventoManutenzione, RicambioUtilizzatoManutenzione, DotazioneMagazzinoMezzo, SedeAssociativaCompleta, ArticoloMagazzinoMezzi, ContattoEsterno } from '../../types/adminTypes';
import { SEDI_ASSOCIATIVE_INIZIALI } from '../../data/adminMockData';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import {
  calcolaManutenzioniInScadenza,
  getEmailResponsabileMezzi,
  salvaEmailResponsabileMezzi,
  inviaEmailAvvisoManutenzione,
  generaReportCumulativoEmail,
  AlertManutenzioneProgrammata,
  EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT,
  EMAIL_RESPONSABILE_PARCO_MEZZI,
  EMAIL_PRESIDENZA_CROCE_ORO
} from '../../utils/avvisiManutenzioneMezzi';
import { MonitoraggioFlotta } from './MonitoraggioFlotta';
import { SezioneConsumiMezzi } from './SezioneConsumiMezzi';
import { RifornimentoCarburante } from '../../types/consumiTypes';
import { RIFORNIMENTI_INIZIALI } from '../../data/rifornimentiMockData';
import { GestioneChecklistMezzi } from './GestioneChecklistMezzi';
import { ChecklistTemplate, ChecklistCompilataTurno } from '../../types/checklistTypes';
import { CHECKLIST_TEMPLATES_INIZIALI, CHECKLIST_COMPILATE_INIZIALI } from '../../data/checklistMockData';
import { formatDateTimeItaly, formatISODateItaly, formatTimeItaly, getCurrentYearItaly } from '../../utils/italianTime';

export const ARTICOLI_MAGAZZINO_MEZZI_DEFAULT: ArticoloMagazzinoMezzi[] = [];

interface SezioneMezziProps {
  mezzi: MezzoFlotta[];
  onAggiornaMezzi: (nuoviMezzi: MezzoFlotta[]) => void;
  manutenzioni: InterventoManutenzione[];
  onAggiornaManutenzioni: (manutenzioni: InterventoManutenzione[]) => void;
  magazzinoMezzi: DotazioneMagazzinoMezzo[];
  onAggiornaMagazzinoMezzi: (magazzino: DotazioneMagazzinoMezzo[]) => void;
  magazzinoParti?: ArticoloMagazzinoMezzi[];
  onAggiornaMagazzinoParti?: (parti: ArticoloMagazzinoMezzi[]) => void;
  sedi?: SedeAssociativaCompleta[];
  onAggiornaSedi?: (sedi: SedeAssociativaCompleta[]) => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  contatti?: ContattoEsterno[];
  serviziArchivio?: any[];
  checklistsTemplates?: ChecklistTemplate[];
  onAggiornaChecklistsTemplates?: (templates: ChecklistTemplate[]) => void;
  checklistsCompilate?: ChecklistCompilataTurno[];
  onAggiornaChecklistsCompilate?: (compilate: ChecklistCompilataTurno[]) => void;
}

export const SezioneMezzi: React.FC<SezioneMezziProps> = ({
  mezzi,
  onAggiornaMezzi,
  manutenzioni,
  onAggiornaManutenzioni,
  magazzinoMezzi,
  onAggiornaMagazzinoMezzi,
  magazzinoParti: magazzinoPartiProp,
  onAggiornaMagazzinoParti,
  sedi = [],
  onAggiornaSedi,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  contatti = [],
  serviziArchivio = [],
  checklistsTemplates,
  onAggiornaChecklistsTemplates,
  checklistsCompilate,
  onAggiornaChecklistsCompilate
}) => {
  // Lista sicura di tutte le sezioni associative territoriali (fallback completo se sedi non ancora caricate)
  const listaSedi = (sedi && sedi.length > 0) ? sedi : SEDI_ASSOCIATIVE_INIZIALI;

  const [sottoTab, setSottoTab] = useState<'flotta' | 'manutenzione' | 'consumi' | 'dotazione' | 'magazzinoMezzi' | 'monitoraggio' | 'checklist'>('flotta');

  // Stato Checklist Inizio Turno Guidata (Templates e Storico Verifiche)
  const [templatesChecklist, setTemplatesChecklist] = useState<ChecklistTemplate[]>(() => {
    if (checklistsTemplates && checklistsTemplates.length > 0) return checklistsTemplates;
    try {
      const s = localStorage.getItem('CROCE_ORO_CHECKLIST_TEMPLATES');
      if (s) return JSON.parse(s);
    } catch {}
    return CHECKLIST_TEMPLATES_INIZIALI;
  });

  const [compilateChecklist, setCompilateChecklist] = useState<ChecklistCompilataTurno[]>(() => {
    if (checklistsCompilate && checklistsCompilate.length > 0) return checklistsCompilate;
    try {
      const s = localStorage.getItem('CROCE_ORO_CHECKLIST_COMPILATE');
      if (s) return JSON.parse(s);
    } catch {}
    return CHECKLIST_COMPILATE_INIZIALI;
  });

  // Sincronizza con props se fornite
  React.useEffect(() => {
    if (checklistsTemplates && checklistsTemplates.length > 0) {
      setTemplatesChecklist(checklistsTemplates);
    }
  }, [checklistsTemplates]);

  React.useEffect(() => {
    if (checklistsCompilate && checklistsCompilate.length > 0) {
      setCompilateChecklist(checklistsCompilate);
    }
  }, [checklistsCompilate]);

  // Configurazione Email Responsabile Parco Mezzi per Notifiche Automatiche
  const [emailResponsabileMezzi, setEmailResponsabileMezzi] = useState<string>(() => getEmailResponsabileMezzi());
  const [filtroUrgenza15Gg, setFiltroUrgenza15Gg] = useState<boolean>(false);
  const [salvataggioEmailConfermato, setSalvataggioEmailConfermato] = useState(false);

  // Registro Rifornimenti Carburante (persiste in localStorage)
  const [rifornimenti, setRifornimenti] = useState<RifornimentoCarburante[]>(() => {
    try {
      const s = localStorage.getItem('CROCE_ORO_RIFORNIMENTI_MEZZI');
      if (s) return JSON.parse(s);
    } catch {}
    return RIFORNIMENTI_INIZIALI;
  });

  const handleAggiungiRifornimento = (nuovo: RifornimentoCarburante) => {
    setRifornimenti(prev => {
      const agg = [nuovo, ...prev];
      try {
        localStorage.setItem('CROCE_ORO_RIFORNIMENTI_MEZZI', JSON.stringify(agg));
      } catch {}
      return agg;
    });
    // Aggiorna anche il chilometraggio del mezzo se superiore
    const mezzoTarget = mezzi.find(m => m.sigla === nuovo.mezzoSigla);
    if (mezzoTarget && nuovo.chilometraggio > mezzoTarget.chilometraggioAttuale) {
      const mezziAggiornati = mezzi.map(m =>
        m.sigla === nuovo.mezzoSigla ? { ...m, chilometraggioAttuale: nuovo.chilometraggio } : m
      );
      onAggiornaMezzi(mezziAggiornati);
    }
  };

  const handleEliminaRifornimento = (id: string) => {
    setRifornimenti(prev => {
      const agg = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('CROCE_ORO_RIFORNIMENTI_MEZZI', JSON.stringify(agg));
      } catch {}
      return agg;
    });
  };

  const handleSalvaEmailResponsabile = () => {
    salvaEmailResponsabileMezzi(emailResponsabileMezzi);
    setSalvataggioEmailConfermato(true);
    setTimeout(() => setSalvataggioEmailConfermato(false), 3000);
    onNotificaRadio?.(`📧 EMAIL PARCO MEZZI AGGIORNATA: ${emailResponsabileMezzi}`, 'sistema');
  };

  const handleRipristinaEmailPredefinite = () => {
    setEmailResponsabileMezzi(EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT);
    salvaEmailResponsabileMezzi(EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT);
    setSalvataggioEmailConfermato(true);
    setTimeout(() => setSalvataggioEmailConfermato(false), 3000);
    onNotificaRadio?.(`📧 EMAIL PARCO MEZZI RIPRISTINATE: ${EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT}`, 'sistema');
    avvisa(`Indirizzi ripristinati: ${EMAIL_RESPONSABILE_PARCO_MEZZI} e ${EMAIL_PRESIDENZA_CROCE_ORO}`);
  };

  // Calcolo automatico avvisi interventi manutenzione e scadenze entro 30 giorni (incluse dotazioni e bombole O2)
  const avvisiManutenzione = React.useMemo(() => {
    return calcolaManutenzioniInScadenza(mezzi, manutenzioni, 30, new Date(), magazzinoMezzi);
  }, [mezzi, manutenzioni, magazzinoMezzi]);

  // Avvisi urgenti entro 15 giorni
  const avvisiUrgenti15Gg = React.useMemo(() => {
    return avvisiManutenzione.filter(a => a.giorniRimanenti <= 15);
  }, [avvisiManutenzione]);

  // Registro in memoria delle scadenze dei mezzi già notificate per evitare duplicati ravvicinati
  const ultimoStatoScadenzeNotificateRef = useRef<Record<string, string>>({});
  const [invioEmailScadenzeInCorso, setInvioEmailScadenzeInCorso] = useState(false);

  // Invia notifica email automatica a mezzi@croceoro.org e presidenza@croceoro.org per qualsiasi scadenza inerente a ogni tipo di mezzo
  const inviaEmailScadenzeAutomatico = async (
    scadenze: AlertManutenzioneProgrammata[],
    causale: string = 'Rilevazione scadenze flotta veicolare (Assicurazione / Tagliando / Bollo / Revisione)',
    force: boolean = false
  ) => {
    if (!scadenze || scadenze.length === 0) return;

    // Filtra quelle scadute o entro 30 giorni
    const daNotificare = force
      ? scadenze
      : scadenze.filter((s) => {
          const key = `${s.id}_${s.dataScadenza}`;
          return !ultimoStatoScadenzeNotificateRef.current[key];
        });

    if (daNotificare.length === 0) return;

    // Aggiorna registro in memoria
    daNotificare.forEach((s) => {
      const key = `${s.id}_${s.dataScadenza}`;
      ultimoStatoScadenzeNotificateRef.current[key] = new Date().toISOString();
    });

    try {
      setInvioEmailScadenzeInCorso(true);
      const res = await fetch('/api/notifica-scadenze-mezzi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alerts: daNotificare,
          causale,
          operatore: operatoreCorrente || 'Ufficio Mezzi & Autoparco',
          dataOra: formatDateTimeItaly(),
          force
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.count > 0) {
          const elenco = daNotificare.map((s) => `${s.mezzoSigla} (${s.tipo}: ${s.dataScadenza})`).join(', ');
          onNotificaRadio?.(
            `📧 NOTIFICA SCADENZE MEZZI INVIATA: Email trasmessa a mezzi@croceoro.org e presidenza@croceoro.org per: ${elenco}.`,
            'allarme'
          );
        }
      }
    } catch (err) {
      console.warn('[SezioneMezzi] Errore invio notifica scadenze email:', err);
    } finally {
      setInvioEmailScadenzeInCorso(false);
    }
  };

  // Controllo automatico delle scadenze flotta urgenti (entro 15 giorni o scadute)
  useEffect(() => {
    if (avvisiUrgenti15Gg.length > 0) {
      inviaEmailScadenzeAutomatico(
        avvisiUrgenti15Gg,
        'Verifica automatica scadenze flotta veicoli urgenti (≤ 15 giorni o scadute)'
      );
    }
  }, [avvisiUrgenti15Gg]);

  // Magazzino Parti Mezzi (Ricambi, tagliandi, lubrificanti, lampadine, pastiglie freni, ecc.)
  const isDemoParteId = (id?: string) => /^part-0(0[1-9]|1[0-2])$/.test(String(id || ''));

  const [magazzinoParti, setMagazzinoParti] = useState<ArticoloMagazzinoMezzi[]>(() => {
    if (Array.isArray(magazzinoPartiProp) && magazzinoPartiProp.length > 0) {
      return magazzinoPartiProp.filter((p: any) => p && !isDemoParteId(p.id));
    }
    try {
      const recuperati = new Map<string, ArticoloMagazzinoMezzi>();
      const s = localStorage.getItem('CROCE_ORO_MAGAZZINO_PARTI_MEZZI');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: any) => {
            if (p && p.id && !isDemoParteId(p.id)) {
              recuperati.set(p.id, p);
            }
          });
        }
      }
      // Recupera eventuali articoli finiti erroneamente nella chiave dotazioni nelle versioni precedenti
      const rawDotazioni = localStorage.getItem('CROCE_ORO_MAGAZZINO_MEZZI');
      if (rawDotazioni) {
        const parsedDot = JSON.parse(rawDotazioni);
        if (Array.isArray(parsedDot)) {
          parsedDot.forEach((p: any) => {
            if (p && p.id && !isDemoParteId(p.id) && p.giacenza !== undefined && p.scortaMinima !== undefined && !recuperati.has(p.id)) {
              recuperati.set(p.id, p);
            }
          });
        }
      }
      if (recuperati.size > 0) {
        return Array.from(recuperati.values());
      }
    } catch {}
    return ARTICOLI_MAGAZZINO_MEZZI_DEFAULT;
  });

  // Sincronizza con lo stato centralizzato (server + WebSocket) passato da App.tsx
  useEffect(() => {
    if (Array.isArray(magazzinoPartiProp)) {
      setMagazzinoParti(magazzinoPartiProp.filter((p: any) => p && !isDemoParteId(p.id)));
    }
  }, [magazzinoPartiProp]);

  // Registro in memoria degli articoli già notificati con la medesima giacenza per evitare invii duplicati ravvicinati
  const ultimoStatoNotificatoRef = useRef<Record<string, number>>({});
  const [invioEmailSottoscortaInCorso, setInvioEmailSottoscortaInCorso] = useState(false);

  // Invia notifica email automatica a mezzi@croceoro.org e presidenza@croceoro.org quando un articolo è <= scortaMinima
  const inviaEmailSottoscortaAutomatico = async (
    articoli: ArticoloMagazzinoMezzi[],
    causale: string = 'Rilevata scorta minima o sottoscorta magazzino ricambi mezzi',
    force: boolean = false
  ) => {
    // Filtra solo gli articoli la cui giacenza è uguale o inferiore alla scorta minima (se scortaMinima > 0)
    const sottoScorta = articoli.filter(a => Number(a.scortaMinima) > 0 && Number(a.giacenza) <= Number(a.scortaMinima));
    if (sottoScorta.length === 0) return;

    // Se non forzato, notifica solo se non è mai stato notificato o se la giacenza è ulteriormente diminuita
    const daNotificare = force
      ? sottoScorta
      : sottoScorta.filter(a => ultimoStatoNotificatoRef.current[a.id] === undefined || a.giacenza < ultimoStatoNotificatoRef.current[a.id]);

    if (daNotificare.length === 0) return;

    // Aggiorna registro in memoria
    daNotificare.forEach(a => {
      ultimoStatoNotificatoRef.current[a.id] = a.giacenza;
    });

    try {
      setInvioEmailSottoscortaInCorso(true);
      const res = await fetch('/api/notifica-sottoscorta-mezzi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articoli: daNotificare,
          causale,
          operatore: operatoreCorrente || 'Personale Officina Mezzi',
          dataOra: formatDateTimeItaly(),
          force
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.count > 0) {
          const nomi = daNotificare.map(a => `${a.nome} (${a.giacenza}/${a.scortaMinima} ${a.unitaMisura})`).join(', ');
          onNotificaRadio?.(
            `📧 ALLERTA SOTTOSCORTA MAGAZZINO MEZZI: Inviata email a mezzi@croceoro.org e presidenza@croceoro.org per: ${nomi}.`,
            'allarme'
          );
        }
      }
    } catch (err) {
      console.warn('[SezioneMezzi] Errore invio notifica sottoscorta email:', err);
    } finally {
      setInvioEmailSottoscortaInCorso(false);
    }
  };

  const salvaMagazzinoParti = (nuovi: ArticoloMagazzinoMezzi[], causale?: string, forceNotifica: boolean = false) => {
    const filtrati = nuovi.filter((p: any) => p && !isDemoParteId(p.id));
    setMagazzinoParti(filtrati);
    try {
      localStorage.setItem('CROCE_ORO_MAGAZZINO_PARTI_MEZZI', JSON.stringify(filtrati));
    } catch {}
    onAggiornaMagazzinoParti?.(filtrati);

    // Verifica immediata: invia email automatica a mezzi@croceoro.org e presidenza@croceoro.org per tutti gli articoli <= scortaMinima
    inviaEmailSottoscortaAutomatico(filtrati, causale || 'Aggiornamento giacenza magazzino mezzi', forceNotifica);
  };

  // Filtri Magazzino Mezzi
  const [ricercaParti, setRicercaParti] = useState('');
  const [filtroCategoriaParti, setFiltroCategoriaParti] = useState<string>('tutte');

  // Modale Nuovo / Modifica Articolo Magazzino Mezzi
  const [modaleParteAperta, setModaleParteAperta] = useState(false);
  const [parteInModifica, setParteInModifica] = useState<ArticoloMagazzinoMezzi | null>(null);
  const [formParteCodice, setFormParteCodice] = useState('');
  const [formParteNome, setFormParteNome] = useState('');
  const [formParteCategoria, setFormParteCategoria] = useState<ArticoloMagazzinoMezzi['categoria']>('Lubrificanti & Olio');
  const [formParteCompatibilita, setFormParteCompatibilita] = useState('');
  const [formParteGiacenza, setFormParteGiacenza] = useState<number>(0);
  const [formParteUnita, setFormParteUnita] = useState<ArticoloMagazzinoMezzi['unitaMisura']>('Pezzi');
  const [formParteScortaMin, setFormParteScortaMin] = useState<number>(0);
  const [formParteCosto, setFormParteCosto] = useState<number>(0);
  const [formParteFornitore, setFormParteFornitore] = useState('');
  const [formParteUbicazione, setFormParteUbicazione] = useState('');
  const [formParteNote, setFormParteNote] = useState('');

  // Filtri Flotta
  const [ricerca, setRicerca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [filtroStato, setFiltroStato] = useState('tutti');
  const [filtroFlotta, setFiltroFlotta] = useState('tutti');

  // Modale Metti Fuori Servizio
  const [mezzoDaMettereFuoriServizio, setMezzoDaMettereFuoriServizio] = useState<MezzoFlotta | null>(null);
  const [motivoFuoriServizio, setMotivoFuoriServizio] = useState('Guasto Meccanico');
  const [dettaglioFuoriServizio, setDettaglioFuoriServizio] = useState('');

  // Modale Nuovo / Modifica Mezzo
  const [modaleMezzoAperta, setModaleMezzoAperta] = useState(false);
  const [mezzoInModifica, setMezzoInModifica] = useState<MezzoFlotta | null>(null);
  const [formSigla, setFormSigla] = useState('T4616');
  const [formTarga, setFormTarga] = useState('');
  const [formModello, setFormModello] = useState('');
  const [formAnno, setFormAnno] = useState(2023);
  const [formTipo, setFormTipo] = useState<MezzoFlotta['tipo']>('Ambulanza Emergenza');
  const [formFlotta, setFormFlotta] = useState<'vet' | 'pc'>('vet');
  const [formKm, setFormKm] = useState(50000);
  const [formSede, setFormSede] = useState('Massa (Le Jare)');
  const [formScadRevisione, setFormScadRevisione] = useState('2027-06-30');
  const [formScadAssicurazione, setFormScadAssicurazione] = useState('2027-01-31');
  const [formScadBollo, setFormScadBollo] = useState('2027-04-30');
  const [formNoteMezzo, setFormNoteMezzo] = useState('');

  // Modale Assegnazione Singolo Mezzo a Sezione Territoriale
  const [modaleAssegnaSedeAperta, setModaleAssegnaSedeAperta] = useState(false);
  const [mezzoPerAssegnazioneSede, setMezzoPerAssegnazioneSede] = useState<MezzoFlotta | null>(null);
  const [sedeSceltaSingola, setSedeSceltaSingola] = useState<string>('');

  // Modale Assegnazione Multipla di Mezzi a Sezione Territoriale
  const [modaleAssegnazioneMultiplaAperta, setModaleAssegnazioneMultiplaAperta] = useState(false);
  const [sedeTargetMultipla, setSedeTargetMultipla] = useState<string>(sedi[0]?.nome || 'Massa (Le Jare)');
  const [mezziSelezionatiMultipli, setMezziSelezionatiMultipli] = useState<string[]>([]);

  // Modale Nuovo Intervento Manutenzione
  const [modaleNuovaManutenzioneAperta, setModaleNuovaManutenzioneAperta] = useState(false);
  const [formManutMezzoSigla, setFormManutMezzoSigla] = useState('T4606');
  const [formManutTipo, setFormManutTipo] = useState<InterventoManutenzione['tipoIntervento']>('Tagliando Ordinario');
  const [formManutData, setFormManutData] = useState(() => formatISODateItaly());
  const [formManutKm, setFormManutKm] = useState(115000);
  const [formManutInSede, setFormManutInSede] = useState(false);
  const [formManutSede, setFormManutSede] = useState<string>('Sede Operativa H24 & Autoparco Massa (Le Jare)');
  const [formManutOfficina, setFormManutOfficina] = useState('Officina AutoMassa Srl');
  const [formManutCosto, setFormManutCosto] = useState(350);
  const [formManutDescrizione, setFormManutDescrizione] = useState('');
  const [formManutFattura, setFormManutFattura] = useState('');
  const [formManutRicambi, setFormManutRicambi] = useState<RicambioUtilizzatoManutenzione[]>([]);
  const [parteSelezionataId, setParteSelezionataId] = useState<string>('');
  const [quantitaParteDaUsare, setQuantitaParteDaUsare] = useState<number>(1);

  // Modale Nuova Dotazione Magazzino Mezzi
  const [modaleNuovaDotazioneAperta, setModaleNuovaDotazioneAperta] = useState(false);
  const [formDotMezzoSigla, setFormDotMezzoSigla] = useState('T4609');
  const [formDotNome, setFormDotNome] = useState('');
  const [formDotCategoria, setFormDotCategoria] = useState<DotazioneMagazzinoMezzo['categoria']>('Ossigeno & Respirazione');
  const [formDotMatricola, setFormDotMatricola] = useState('');
  const [formDotQuantita, setFormDotQuantita] = useState(1);
  const [formDotBar, setFormDotBar] = useState<number | undefined>(200);
  const [formDotScadenza, setFormDotScadenza] = useState('2028-12-31');
  const [formDotStato, setFormDotStato] = useState<DotazioneMagazzinoMezzo['stato']>('Pronto all\'Uso');
  const [formDotNote, setFormDotNote] = useState('');

  // Notifica temporanea
  const [notifica, setNotifica] = useState<string | null>(null);
  const avvisa = (msg: string) => {
    setNotifica(msg);
    setTimeout(() => setNotifica(null), 4000);
  };

  // Helper per riconoscere le unità di misura in litri (le uniche che ammettono decimali)
  const isUnitaLitri = (unita?: string) => {
    if (!unita) return false;
    const u = unita.trim().toLowerCase();
    return u === 'l' || u === 'lt' || u === 'litri' || u === 'litro' || u.includes('litr');
  };

  // Aggiornamento automatico in tempo reale di "Costo Totale Complessivo (€)" per interventi in sede:
  // Man mano che si selezionano gli articoli dal magazzino ricambi e le unità usate,
  // oppure vengono aggiunti/rimossi articoli, aggiorna in tempo reale il costo totale.
  useEffect(() => {
    if (formManutInSede && modaleNuovaManutenzioneAperta) {
      const totGiaInseriti = formManutRicambi.reduce((acc, r) => acc + (r.subtotale || 0), 0);
      const artCorrente = magazzinoParti.find((a) => a.id === parteSelezionataId);
      const costoCorrenteInCorso = artCorrente ? (artCorrente.costoUnitario || 0) * (quantitaParteDaUsare || 0) : 0;
      const totaleCalcolato = Number((totGiaInseriti + costoCorrenteInCorso).toFixed(2));
      setFormManutCosto(totaleCalcolato);
    }
  }, [formManutInSede, formManutRicambi, parteSelezionataId, quantitaParteDaUsare, modaleNuovaManutenzioneAperta]);

  // Assegna uno o più mezzi ad una sede territoriale con sincronizzazione bidirezionale
  const eseguiAssegnazioneMezziASede = (sigleDaAssegnare: string[], nomeSedeDestinazione: string) => {
    if (sigleDaAssegnare.length === 0 || !nomeSedeDestinazione) return;

    // 1. Aggiorna flotta mezzi
    const nuoviMezzi = mezzi.map((m) => {
      if (sigleDaAssegnare.includes(m.sigla)) {
        return { ...m, sedeStazionamento: nomeSedeDestinazione };
      }
      return m;
    });
    onAggiornaMezzi(nuoviMezzi);

    // 2. Se presenti le sedi associative, sincronizza mezziAssegnati
    if (sedi.length > 0 && onAggiornaSedi) {
      const nuoveSedi = sedi.map((s) => {
        const isTarget = s.nome.toLowerCase().trim() === nomeSedeDestinazione.toLowerCase().trim();
        if (isTarget) {
          const setNuovo = new Set([...s.mezziAssegnati, ...sigleDaAssegnare]);
          return { ...s, mezziAssegnati: Array.from(setNuovo) };
        } else {
          // Rimuovi i mezzi da altre sedi dove erano precedentemente stazionati
          return {
            ...s,
            mezziAssegnati: s.mezziAssegnati.filter((sigla) => !sigleDaAssegnare.includes(sigla))
          };
        }
      });
      onAggiornaSedi(nuoveSedi);
    }

    onNotificaRadio?.(
      `🏢 ASSEGNAZIONE MEZZI: Assegnati ${sigleDaAssegnare.join(', ')} alla sede territoriale "${nomeSedeDestinazione}"`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'mezzi',
        'Assegnazione sede mezzi',
        `Assegnati ${sigleDaAssegnare.length} mezzi (${sigleDaAssegnare.join(', ')}) alla sede ${nomeSedeDestinazione}`,
        operatoreCorrente
      );
    }
    avvisa(`✓ Mezzi [${sigleDaAssegnare.join(', ')}] assegnati con successo alla sede "${nomeSedeDestinazione}".`);
  };

  // Metti Fuori Servizio
  const confermaFuoriServizio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mezzoDaMettereFuoriServizio) return;

    const motivoCompleto = dettaglioFuoriServizio
      ? `${motivoFuoriServizio}: ${dettaglioFuoriServizio}`
      : motivoFuoriServizio;

    const aggiornati = mezzi.map((m) => {
      if (m.id === mezzoDaMettereFuoriServizio.id) {
        return {
          ...m,
          stato: 'Fuori Servizio' as const,
          motivoFuoriServizio: motivoCompleto,
          operatoreSegnalazione: operatoreCorrente,
          dataSegnalazione: `${formatISODateItaly()} ${formatTimeItaly(undefined, false)}`
        };
      }
      return m;
    });

    onAggiornaMezzi(aggiornati);
    onNotificaRadio?.(`🚨 FLOTTA MEZZI: Il mezzo ${mezzoDaMettereFuoriServizio.sigla} è stato messo FUORI SERVIZIO da ${operatoreCorrente} (${motivoCompleto})`, 'allarme');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'mezzi',
        'Messa fuori servizio veicolo',
        `Il mezzo ${mezzoDaMettereFuoriServizio.sigla} è stato posto FUORI SERVIZIO. Motivo: ${motivoCompleto}`,
        operatoreCorrente
      );
    }
    avvisa(`Mezzo ${mezzoDaMettereFuoriServizio.sigla} messo fuori servizio.`);
    setMezzoDaMettereFuoriServizio(null);
  };

  // Reintegra Mezzo
  const reintegraMezzo = (mezzo: MezzoFlotta) => {
    const aggiornati = mezzi.map((m) => {
      if (m.id === mezzo.id) {
        return {
          ...m,
          stato: 'Operativo' as const,
          motivoFuoriServizio: undefined,
          operatoreSegnalazione: undefined,
          dataSegnalazione: undefined
        };
      }
      return m;
    });

    onAggiornaMezzi(aggiornati);
    onNotificaRadio?.(`✅ FLOTTA MEZZI: Il mezzo ${mezzo.sigla} è tornato REGOLARMENTE OPERATIVO in servizio!`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'mezzi',
        'Reintegro mezzo in flotta',
        `Il mezzo ${mezzo.sigla} è stato reintegrato come REGOLARMENTE OPERATIVO in servizio.`,
        operatoreCorrente
      );
    }
    avvisa(`Mezzo ${mezzo.sigla} reintegrato con successo in flotta.`);
  };

  // Salva Mezzo (Nuovo o Modifica)
  const handleSalvaMezzo = (e: React.FormEvent) => {
    e.preventDefault();
    if (mezzoInModifica) {
      // Modifica
      const aggiornati = mezzi.map((m) => {
        if (m.id === mezzoInModifica.id) {
          return {
            ...m,
            sigla: formSigla.trim().toUpperCase(),
            targa: formTarga.trim().toUpperCase(),
            modello: formModello.trim(),
            annoImmatricolazione: Number(formAnno),
            tipo: formTipo,
            flotta: formFlotta,
            chilometraggioAttuale: Number(formKm),
            sedeStazionamento: formSede,
            scadenzaRevisione: formScadRevisione,
            scadenzaAssicurazione: formScadAssicurazione,
            scadenzaBollo: formScadBollo,
            note: formNoteMezzo
          };
        }
        return m;
      });
      onAggiornaMezzi(aggiornati);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'mezzi',
          'Modifica scheda veicolo',
          `Modificati dati mezzo ${formSigla} (targa: ${formTarga}, modello: ${formModello}, km: ${formKm}, sede: ${formSede})`,
          operatoreCorrente
        );
      }
      avvisa(`Dati del mezzo ${formSigla} aggiornati con successo.`);
    } else {
      // Nuovo
      const nuovo: MezzoFlotta = {
        id: `mezzo-${Date.now()}`,
        sigla: formSigla.trim().toUpperCase(),
        targa: formTarga.trim().toUpperCase(),
        modello: formModello.trim(),
        annoImmatricolazione: Number(formAnno),
        tipo: formTipo,
        flotta: formFlotta,
        stato: 'Operativo',
        chilometraggioAttuale: Number(formKm),
        sedeStazionamento: formSede,
        scadenzaRevisione: formScadRevisione,
        scadenzaAssicurazione: formScadAssicurazione,
        scadenzaBollo: formScadBollo,
        note: formNoteMezzo
      };
      onAggiornaMezzi([...mezzi, nuovo]);
      onNotificaRadio?.(`🚑 NUOVO MEZZO: Inserito nuovo veicolo ${nuovo.sigla} (${nuovo.targa}) nel database flotta`, 'sistema');
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'mezzi',
          'Nuovo mezzo inserito in flotta',
          `Inserito nuovo mezzo ${nuovo.sigla} (targa: ${nuovo.targa}, modello: ${nuovo.modello}, flotta: ${nuovo.flotta}, sede: ${nuovo.sedeStazionamento})`,
          operatoreCorrente
        );
      }
      avvisa(`Nuovo mezzo ${nuovo.sigla} aggiunto al database.`);
    }

    // Sincronizzazione automatica con le Sedi Territoriali
    if (sedi.length > 0 && onAggiornaSedi) {
      const siglaMezzo = formSigla.trim().toUpperCase();
      const nuovaSedeNome = formSede;
      const nuoveSedi = sedi.map((s) => {
        const isTarget = s.nome.toLowerCase().trim() === nuovaSedeNome.toLowerCase().trim();
        if (isTarget) {
          return {
            ...s,
            mezziAssegnati: Array.from(new Set([...s.mezziAssegnati, siglaMezzo]))
          };
        } else {
          return {
            ...s,
            mezziAssegnati: s.mezziAssegnati.filter((mSig) => mSig !== siglaMezzo)
          };
        }
      });
      onAggiornaSedi(nuoveSedi);
    }

    // Controllo immediato scadenze mezzo appena salvato (Assicurazione, Tagliando, Bollo, Revisione)
    const mezzoDaVerificare: MezzoFlotta = {
      id: mezzoInModifica ? mezzoInModifica.id : `mezzo-${Date.now()}`,
      sigla: formSigla.trim().toUpperCase(),
      targa: formTarga.trim().toUpperCase(),
      modello: formModello.trim(),
      annoImmatricolazione: Number(formAnno),
      tipo: formTipo,
      flotta: formFlotta,
      stato: mezzoInModifica ? mezzoInModifica.stato : 'Operativo',
      chilometraggioAttuale: Number(formKm),
      sedeStazionamento: formSede,
      scadenzaRevisione: formScadRevisione,
      scadenzaAssicurazione: formScadAssicurazione,
      scadenzaBollo: formScadBollo,
      note: formNoteMezzo
    };
    const scadenzeRilevate = calcolaManutenzioniInScadenza([mezzoDaVerificare], [], 30, new Date(), []);
    if (scadenzeRilevate.length > 0) {
      inviaEmailScadenzeAutomatico(
        scadenzeRilevate,
        `Salvataggio anagrafica mezzo ${mezzoDaVerificare.sigla} (${mezzoDaVerificare.targa}) con scadenze attive (≤ 30 gg o scadute)`,
        true
      );
    }

    setModaleMezzoAperta(false);
    setMezzoInModifica(null);
  };

  // Salva Manutenzione
  const handleSalvaManutenzione = (e: React.FormEvent) => {
    e.preventDefault();

    const esecutoreEffettivo = formManutInSede
      ? `In Sede (${formManutSede})`
      : formManutOfficina.trim();

    // Se sono stati usati ricambi di magazzino, genera il riepilogo nella descrizione
    let descCompleta = formManutDescrizione.trim();
    if (formManutRicambi.length > 0) {
      const summaryRicambi = formManutRicambi
        .map((r) => `${r.quantita} ${r.unitaMisura} ${r.articoloNome} (${r.articoloCodice})`)
        .join(', ');
      if (!descCompleta.includes('[Ricambi usati:')) {
        descCompleta = descCompleta
          ? `${descCompleta}\n[Ricambi magazzino usati: ${summaryRicambi}]`
          : `Ricambi magazzino usati: ${summaryRicambi}`;
      }
    }

    const nuova: InterventoManutenzione = {
      id: `manut-${Date.now()}`,
      mezzoSigla: formManutMezzoSigla,
      dataIntervento: formManutData,
      tipoIntervento: formManutTipo,
      chilometraggioAlTagliando: Number(formManutKm),
      officinaEsecutrice: esecutoreEffettivo,
      costoTotale: Number(formManutCosto),
      descrizione: descCompleta,
      fatturaNumero: formManutInSede ? (formManutFattura || 'INTERNO-ODV') : formManutFattura,
      eseguitoDa: operatoreCorrente,
      eseguitaInSede: formManutInSede,
      sedeEsecuzione: formManutInSede ? formManutSede : undefined,
      ricambiUtilizzati: formManutRicambi.length > 0 ? formManutRicambi : undefined
    };

    onAggiornaManutenzioni([nuova, ...manutenzioni]);

    // 1. SCALATURA AUTOMATICA MAGAZZINO RICAMBI MEZZI
    if (formManutRicambi.length > 0) {
      const nuovoMagazzino = magazzinoParti.map((art) => {
        const usato = formManutRicambi.find((r) => r.articoloId === art.id);
        if (usato) {
          const nuovaGiacenza = Math.max(0, Number((art.giacenza - usato.quantita).toFixed(2)));
          return { ...art, giacenza: nuovaGiacenza };
        }
        return art;
      });
      salvaMagazzinoParti(nuovoMagazzino, `Scarico ricambi per intervento ${nuova.tipoIntervento} su mezzo ${nuova.mezzoSigla}`);
    }

    // 2. Aggiorna anche il km attuale del mezzo se maggiore
    const mezziAgg = mezzi.map((m) => {
      if (m.sigla === formManutMezzoSigla && nuova.chilometraggioAlTagliando > m.chilometraggioAttuale) {
        return { ...m, chilometraggioAttuale: nuova.chilometraggioAlTagliando };
      }
      return m;
    });
    onAggiornaMezzi(mezziAgg);

    setModaleNuovaManutenzioneAperta(false);

    const msgNotifica = formManutInSede
      ? `🔧 MANUTENZIONE IN SEDE: Registrato ${nuova.tipoIntervento} su ${nuova.mezzoSigla} presso ${formManutSede}${formManutRicambi.length > 0 ? ` (${formManutRicambi.length} ricambi scalati da magazzino)` : ''}`
      : `🔧 MANUTENZIONE ESTERNA: Registrato ${nuova.tipoIntervento} per ${nuova.mezzoSigla} c/o ${nuova.officinaEsecutrice} (€ ${nuova.costoTotale})`;

    onNotificaRadio?.(msgNotifica, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'mezzi',
        'Nuova manutenzione registrata',
        msgNotifica,
        operatoreCorrente
      );
    }

    if (formManutRicambi.length > 0) {
      avvisa(`✓ Manutenzione salvata! Scalati dal magazzino ${formManutRicambi.length} articoli per il mezzo ${nuova.mezzoSigla}.`);
    } else {
      avvisa(`Intervento di manutenzione registrato per ${nuova.mezzoSigla}.`);
    }
  };

  // Salva Dotazione Magazzino Mezzi
  const handleSalvaDotazione = (e: React.FormEvent) => {
    e.preventDefault();
    const nuovaDotazione: DotazioneMagazzinoMezzo = {
      id: `dot-${Date.now()}`,
      mezzoSigla: formDotMezzoSigla,
      nomeOggetto: formDotNome,
      categoria: formDotCategoria,
      matricola: formDotMatricola,
      quantita: Number(formDotQuantita),
      pressioneBar: formDotBar ? Number(formDotBar) : undefined,
      dataScadenzaRevisione: formDotScadenza,
      stato: formDotStato,
      note: formDotNote
    };

    onAggiornaMagazzinoMezzi([nuovaDotazione, ...magazzinoMezzi]);

    // Verifica immediata scadenza dotazione mezzo (bombole O2, estintori, collaudi)
    if (nuovaDotazione.dataScadenzaRevisione) {
      const dMs = new Date(nuovaDotazione.dataScadenzaRevisione).getTime();
      const diffGg = Math.ceil((dMs - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffGg <= 30) {
        const mezzoMatch = mezzi.find((m) => m.sigla === nuovaDotazione.mezzoSigla);
        const isBombola = nuovaDotazione.categoria === 'Ossigeno & Respirazione' || nuovaDotazione.nomeOggetto.toLowerCase().includes('bombola');
        const isEstintore = nuovaDotazione.categoria === 'Antincendio' || nuovaDotazione.nomeOggetto.toLowerCase().includes('estintore');
        const alertDot: AlertManutenzioneProgrammata = {
          id: `dot-alert-${nuovaDotazione.id}`,
          mezzoSigla: nuovaDotazione.mezzoSigla,
          modello: mezzoMatch?.modello,
          targa: mezzoMatch?.targa,
          tipo: isBombola ? 'Revisione Bombola Ossigeno' : (isEstintore ? 'Controllo Estintore / Dotazione' : 'Altra Scadenza Mezzo'),
          dataScadenza: nuovaDotazione.dataScadenzaRevisione,
          giorniRimanenti: diffGg,
          scaduta: diffGg < 0,
          dettagli: `${nuovaDotazione.nomeOggetto}${nuovaDotazione.matricola ? ` (Matr: ${nuovaDotazione.matricola})` : ''} - Scadenza collaudo/revisione dotazione mezzo`,
          sedeStazionamento: mezzoMatch?.sedeStazionamento
        };
        inviaEmailScadenzeAutomatico([alertDot], `Inserimento dotazione con scadenza su ${nuovaDotazione.mezzoSigla}`, true);
      }
    }

    setModaleNuovaDotazioneAperta(false);
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'mezzi',
        'Aggiornamento dotazioni mezzo',
        `Aggiunta dotazione ${nuovaDotazione.nomeOggetto} (${nuovaDotazione.quantita} pz) su mezzo ${nuovaDotazione.mezzoSigla}`,
        operatoreCorrente
      );
    }
    avvisa(`Dotazione "${nuovaDotazione.nomeOggetto}" aggiunta a ${nuovaDotazione.mezzoSigla}.`);
  };

  // Mezzi sempre ordinati in ordine alfanumerico A-Z e numerico crescente
  const mezziOrdinati: MezzoFlotta[] = useMemo(() => {
    return [...mezzi].sort((a: MezzoFlotta, b: MezzoFlotta) => a.sigla.localeCompare(b.sigla, 'it', { numeric: true, sensitivity: 'base' }));
  }, [mezzi]);

  // Mezzi filtrati (in ordine alfanumerico A-Z e numerico crescente)
  const mezziFiltrati: MezzoFlotta[] = mezziOrdinati.filter((m: MezzoFlotta) => {
    const matchTesto =
      !ricerca.trim() ||
      m.sigla.toLowerCase().includes(ricerca.toLowerCase()) ||
      m.targa.toLowerCase().includes(ricerca.toLowerCase()) ||
      m.modello.toLowerCase().includes(ricerca.toLowerCase()) ||
      m.sedeStazionamento.toLowerCase().includes(ricerca.toLowerCase());

    const matchTipo = filtroTipo === 'tutti' || m.tipo === filtroTipo;
    const matchStato = filtroStato === 'tutti' || m.stato === filtroStato;
    const matchFlotta = filtroFlotta === 'tutti' || m.flotta === filtroFlotta;

    return matchTesto && matchTipo && matchStato && matchFlotta;
  });

  // Calcolo KPI Manutenzioni
  const totaleSpeseManutenzione = manutenzioni.reduce((acc, curr) => acc + (curr.costoTotale || 0), 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 3 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
            <Ambulance className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50">
                Macro Categoria 3
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                Database Mezzi, Flotta & Manutenzione
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Gestione completa parco veicoli, inserimento, modifiche, messa fuori servizio con storico causali, manutenzioni periodiche e magazzino dotazioni di bordo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const defaultSede = sedi[0]?.nome || 'Massa (Le Jare)';
              setSedeTargetMultipla(defaultSede);
              const giaAssegnati = mezzi.filter((m) => m.sedeStazionamento === defaultSede).map((m) => m.sigla);
              setMezziSelezionatiMultipli(giaAssegnati);
              setModaleAssegnazioneMultiplaAperta(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-500/50 font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
            title="Assegna uno o più mezzi della flotta a una sezione territoriale"
          >
            <Building2 className="w-4 h-4 text-rose-400" />
            <span>Assegna Mezzi a Sezione Territoriale</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMezzoInModifica(null);
              setFormSigla(`T46${Math.floor(16 + Math.random() * 20)}`);
              setFormTarga('');
              setFormModello('');
              setFormAnno(getCurrentYearItaly());
              setFormTipo('Ambulanza Emergenza');
              setFormFlotta('vet');
              setFormKm(40000);
              setFormSede(sedi[0]?.nome || 'Massa (Le Jare)');
              setFormScadRevisione('2027-06-30');
              setFormScadAssicurazione('2027-01-31');
              setFormScadBollo('2027-04-30');
              setFormNoteMezzo('');
              setModaleMezzoAperta(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuovo Mezzo Associativo</span>
          </button>
        </div>
      </div>

      {/* Alert Notifica */}
      {notifica && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notifica}</span>
        </div>
      )}

      {/* Sotto-Schede Sezione 3 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
        <button
          type="button"
          onClick={() => setSottoTab('flotta')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'flotta'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Ambulance className="w-4 h-4" />
          <span>1. Flotta Mezzi ({mezzi.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('manutenzione')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'manutenzione'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>2. Manutenzione Mezzi & Tagliandi ({manutenzioni.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('dotazione')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'dotazione'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>3. Dotazione Mezzi ({magazzinoMezzi.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('magazzinoMezzi')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'magazzinoMezzi'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>4. Magazzino Mezzi ({magazzinoParti.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('consumi')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'consumi'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Fuel className="w-4 h-4 text-amber-400" />
          <span>5. Consumi & Costo KM ({rifornimenti.length} rifornimenti)</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('checklist')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'checklist'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-400 font-black'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-amber-400" />
          <span>6. Checklist Inizio Turno ({templatesChecklist.length} Modelli)</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: FLOTTA MEZZI & STATO OPERATIVO                           */}
      {/* ===================================================================== */}
      {sottoTab === 'flotta' && (
        <div className="space-y-4">
          {/* Banner Scadenze Flotta Imminenti o Scadute (Assicurazione, Tagliando, Bollo, Revisione) */}
          {avvisiManutenzione.length > 0 && (
            <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
              avvisiUrgenti15Gg.length > 0
                ? 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                : 'bg-amber-950/30 border-amber-500/50 text-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                <ShieldAlert className={`w-5 h-5 shrink-0 ${avvisiUrgenti15Gg.length > 0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                <div>
                  <div className="text-xs font-black uppercase text-white flex items-center gap-2">
                    <span>Scadenze Flotta Rilevate: {avvisiManutenzione.length} totali</span>
                    {avvisiUrgenti15Gg.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold">
                        {avvisiUrgenti15Gg.length} urgenti (≤ 15 gg o scadute)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Assicurazioni RCA, tagliandi, collaudi ministeriali e bolli per i mezzi di soccorso. Email automatica indirizzata a <strong>mezzi@croceoro.org</strong> e <strong>presidenza@croceoro.org</strong>.
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={invioEmailScadenzeInCorso}
                onClick={async () => {
                  await inviaEmailScadenzeAutomatico(
                    avvisiManutenzione,
                    `Sollecito manuale scadenze flotta veicolare da tab Flotta (${avvisiManutenzione.length} scadenze)`,
                    true
                  );
                  avvisa(`✓ Notifica scadenze inviata con successo a mezzi@croceoro.org e presidenza@croceoro.org (${avvisiManutenzione.length} scadenze).`);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{invioEmailScadenzeInCorso ? 'Invio in corso...' : 'Invia Email Scadenze (mezzi@ & presidenza@)'}</span>
              </button>
            </div>
          )}

          {/* Filtri */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca sigla (es. T4606), targa, modello..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={filtroFlotta}
                onChange={(e) => setFiltroFlotta(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutte le Flotte</option>
                <option value="vet">🐾 Emergenza & Veterinario</option>
                <option value="pc">🌲 Protezione Civile</option>
              </select>

              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutti gli Stati</option>
                <option value="Operativo">Solo Operativi</option>
                <option value="Fuori Servizio">Fuori Servizio</option>
                <option value="In Manutenzione">In Manutenzione</option>
              </select>
            </div>
          </div>

          {/* Elenco Card Mezzi */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mezziFiltrati.map((m) => {
              const isOperativo = m.stato === 'Operativo';
              const isFuori = m.stato === 'Fuori Servizio' || m.stato === 'In Manutenzione';

              return (
                <div
                  key={m.id}
                  className={`bg-slate-950 rounded-2xl border p-4 shadow-xl flex flex-col justify-between gap-3 transition-all ${
                    isFuori
                      ? 'border-red-500/50 bg-red-950/10'
                      : 'border-slate-800 hover:border-amber-500/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-lg text-amber-400 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700">
                        {m.sigla}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isOperativo
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                          : 'bg-red-950 text-red-300 border-red-700/50 animate-pulse'
                      }`}>
                        {m.stato}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-black text-white">{m.modello}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Targa: {m.targa} • Anno {m.annoImmatricolazione}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{m.tipo}</div>
                    </div>

                    {isFuori && m.motivoFuoriServizio && (
                      <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-[11px] text-red-200">
                        <div className="font-black text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Motivo Fuori Servizio:
                        </div>
                        <div className="mt-0.5">{m.motivoFuoriServizio}</div>
                        {m.dataSegnalazione && (
                          <div className="text-[9px] text-red-300/70 mt-1">
                            Segnalato da {m.operatoreSegnalazione || 'Centrale'} il {m.dataSegnalazione}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><Gauge className="w-3 h-3 text-amber-400" /> Km Attuali:</span>
                        <strong className="text-white font-mono">{m.chilometraggioAttuale.toLocaleString('it-IT')} km</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-rose-400" /> Sede:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMezzoPerAssegnazioneSede(m);
                            setSedeSceltaSingola(m.sedeStazionamento || (sedi[0]?.nome ?? 'Massa (Le Jare)'));
                            setModaleAssegnaSedeAperta(true);
                          }}
                          className="text-rose-300 hover:text-white font-bold underline decoration-rose-500/50 truncate max-w-[130px] cursor-pointer text-right"
                          title="Clicca per assegnare questo mezzo a una sezione territoriale diversa"
                        >
                          {m.sedeStazionamento || 'Non Assegnata'} ✏️
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-emerald-400" /> Revisione:</span>
                        <span className="text-slate-300 font-mono">{m.scadenzaRevisione}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pulsanti Azioni */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                    {isOperativo ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMezzoDaMettereFuoriServizio(m);
                          setMotivoFuoriServizio('Guasto Meccanico');
                          setDettaglioFuoriServizio('');
                        }}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Segnala Mezzo Fuori Servizio"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Fuori Servizio</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => reintegraMezzo(m)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md transition-colors cursor-pointer"
                        title="Reintegra Mezzo Operativo"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reintegra</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setMezzoPerAssegnazioneSede(m);
                        setSedeSceltaSingola(m.sedeStazionamento || (sedi[0]?.nome ?? 'Massa (Le Jare)'));
                        setModaleAssegnaSedeAperta(true);
                      }}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition-colors cursor-pointer"
                      title="Assegna a Sezione Territoriale"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMezzoInModifica(m);
                        setFormSigla(m.sigla);
                        setFormTarga(m.targa);
                        setFormModello(m.modello);
                        setFormAnno(m.annoImmatricolazione);
                        setFormTipo(m.tipo);
                        setFormFlotta(m.flotta);
                        setFormKm(m.chilometraggioAttuale);
                        setFormSede(m.sedeStazionamento);
                        setFormScadRevisione(m.scadenzaRevisione);
                        setFormScadAssicurazione(m.scadenzaAssicurazione);
                        setFormScadBollo(m.scadenzaBollo);
                        setFormNoteMezzo(m.note || '');
                        setModaleMezzoAperta(true);
                      }}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      title="Modifica Dati Mezzo"
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
      {/* 2. SOTTO-TAB: MANUTENZIONE MEZZI & TAGLIANDI                           */}
      {/* ===================================================================== */}
      {sottoTab === 'manutenzione' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Registro Storico Manutenzioni & Tagliandi</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Archivio degli interventi di officina, tagliandi ordinari, revisioni ministeriali, sostituzione pneumatici e spese sostenute.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Totale Spese Manutenzione</span>
                <span className="text-sm font-black text-amber-400 font-mono">€ {totaleSpeseManutenzione.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormManutMezzoSigla(mezzi[0]?.sigla || 'T4606');
                  setFormManutTipo('Tagliando Ordinario');
                  setFormManutData(formatISODateItaly());
                  setFormManutKm(110000);
                  setFormManutInSede(false);
                  setFormManutSede(sedi[0]?.nome || 'Sede Operativa H24 & Autoparco Massa (Le Jare)');
                  setFormManutOfficina('Officina AutoMassa Srl');
                  setFormManutCosto(380);
                  setFormManutDescrizione('');
                  setFormManutFattura('');
                  setFormManutRicambi([]);
                  setParteSelezionataId('');
                  setQuantitaParteDaUsare(1);
                  setModaleNuovaManutenzioneAperta(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Registra Intervento</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SCADENZARIO REVISIONI, TAGLIANDI & ASSICURAZIONI (CON AVVISO EMAIL 15 GG) */}
          {/* ========================================================================= */}
          <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border-2 border-amber-500/40 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                    Scadenzario Programmato Flotta
                  </span>
                  <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                    avvisiUrgenti15Gg.length > 0
                      ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                  }`}>
                    {avvisiUrgenti15Gg.length} {avvisiUrgenti15Gg.length === 1 ? 'scadenza urgente' : 'scadenze urgenti'} (≤ 15 giorni)
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Totale scadenze a 30 gg: <strong className="text-white">{avvisiManutenzione.length}</strong>
                  </span>
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wide">
                  Revisioni Ministeriali, Tagliandi & Polizze in Scadenza con Notifica Email Automatica
                </h4>
              </div>

              {/* Azioni Rapide Email & Filtro Urgenza */}
              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setFiltroUrgenza15Gg(!filtroUrgenza15Gg)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    filtroUrgenza15Gg
                      ? 'bg-rose-500 text-slate-950 border-rose-400 font-black'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {filtroUrgenza15Gg ? 'Mostra Tutte (≤ 30 gg)' : 'Filtra Solo Urgenti (≤ 15 gg)'}
                </button>

                <button
                  type="button"
                  disabled={invioEmailScadenzeInCorso || avvisiManutenzione.length === 0}
                  onClick={async () => {
                    const elenco = filtroUrgenza15Gg ? avvisiUrgenti15Gg : avvisiManutenzione;
                    if (elenco.length === 0) {
                      avvisa('Nessuna scadenza presente da inviare.');
                      return;
                    }
                    await inviaEmailScadenzeAutomatico(
                      elenco,
                      `Invio manuale riepilogo scadenze flotta veicoli (${elenco.length} veicoli)`,
                      true
                    );
                    avvisa(`✓ Report scadenze flotta inviato a mezzi@croceoro.org e presidenza@croceoro.org (${elenco.length} scadenze).`);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
                  title="Invia automaticamente per email a mezzi@croceoro.org e presidenza@croceoro.org il riepilogo di tutti i veicoli in scadenza o scaduti"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{invioEmailScadenzeInCorso ? 'Invio in corso...' : 'Invia Email Scadenze a mezzi@ & presidenza@'}</span>
                </button>
              </div>
            </div>

            {/* Box Configurazione Email Responsabile Parco Mezzi & Presidenza */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-200 font-bold">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Destinatari Avviso Automatico Parco Mezzi & Scadenze:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 border border-blue-600/50 text-blue-300 font-mono text-[11px] font-bold">
                    Responsabile Mezzi: mezzi@croceoro.org
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-600/50 text-purple-300 font-mono text-[11px] font-bold">
                    Presidenza: presidenza@croceoro.org
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400">
                  Gli avvisi singoli e cumulativi per scadenze entro 15 giorni vengono inviati contemporaneamente a entrambi i referenti associativi.
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={emailResponsabileMezzi}
                    onChange={(e) => setEmailResponsabileMezzi(e.target.value)}
                    placeholder="nicodemimarmi@gmail.com, presidenza@croceoro.org"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400 w-full sm:w-80"
                    title="Indirizzi email destinatari (separati da virgola)"
                  />
                  <button
                    type="button"
                    onClick={handleSalvaEmailResponsabile}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase transition-colors shrink-0 cursor-pointer"
                  >
                    {salvataggioEmailConfermato ? 'Salvato!' : 'Salva'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRipristinaEmailPredefinite}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
                    title="Ripristina a nicodemimarmi@gmail.com e presidenza@croceoro.org"
                  >
                    Ripristina
                  </button>
                </div>
              </div>
            </div>

            {/* Griglia Card Scadenze */}
            {(() => {
              const elencoVisualizzato = filtroUrgenza15Gg ? avvisiUrgenti15Gg : avvisiManutenzione;
              if (elencoVisualizzato.length === 0) {
                return (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    Nessun intervento di manutenzione, tagliando o revisione in scadenza {filtroUrgenza15Gg ? 'entro i prossimi 15 giorni' : 'entro i prossimi 30 giorni'}. Tutti i mezzi risultano in regola.
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {elencoVisualizzato.map((a) => {
                    const isUrgentissima = a.giorniRimanenti <= 15;
                    return (
                      <div
                        key={a.id}
                        className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between gap-2.5 transition-all shadow-md ${
                          a.scaduta
                            ? 'bg-rose-950/60 border-rose-600'
                            : isUrgentissima
                            ? 'bg-amber-950/50 border-amber-500'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-sm text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                              🚑 {a.mezzoSigla}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                              a.scaduta
                                ? 'bg-rose-600 text-white animate-pulse'
                                : a.giorniRimanenti <= 7
                                ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                                : isUrgentissima
                                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {a.scaduta ? 'SCADUTA' : `${a.giorniRimanenti} gg rimasti`}
                            </span>
                          </div>

                          <div className="text-xs font-black text-white">{a.tipo}</div>
                          <div className="text-[11px] text-slate-400">
                            Scadenza: <strong className="text-slate-200 font-mono">{a.dataScadenza}</strong>
                            {a.targa && <span className="ml-1 text-slate-500 font-mono">({a.targa})</span>}
                          </div>
                          <div className="text-[11px] text-slate-300 line-clamp-2">{a.dettagli}</div>
                          {a.sedeStazionamento && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{a.sedeStazionamento}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                            {a.officina || 'Da prenotare'}
                          </span>

                          <button
                            type="button"
                            disabled={invioEmailScadenzeInCorso}
                            onClick={async () => {
                              await inviaEmailScadenzeAutomatico(
                                [a],
                                `Avviso scadenza ${a.tipo} per il veicolo ${a.mezzoSigla} (${a.targa || 'N.D.'})`,
                                true
                              );
                              avvisa(`✓ Email per ${a.mezzoSigla} (${a.tipo}) inviata a mezzi@croceoro.org e presidenza@croceoro.org`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 disabled:opacity-50 text-blue-200 border border-blue-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title="Invia avviso immediato a mezzi@croceoro.org e presidenza@croceoro.org"
                          >
                            <Mail className="w-3 h-3 text-blue-400" />
                            <span>Invia Email</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Tabella Manutenzioni */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Mezzo</th>
                    <th className="py-3 px-4">Data & Km</th>
                    <th className="py-3 px-4">Tipologia Intervento</th>
                    <th className="py-3 px-4">Officina Esecutrice</th>
                    <th className="py-3 px-4">Descrizione Lavori</th>
                    <th className="py-3 px-4 font-mono">Costo (€)</th>
                    <th className="py-3 px-4 text-right">Fattura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {manutenzioni.map((man) => (
                    <tr key={man.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          {man.mezzoSigla}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{man.dataIntervento}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{man.chilometraggioAlTagliando.toLocaleString('it-IT')} km</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                          {man.tipoIntervento}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-semibold">
                        {man.eseguitaInSede ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                              <Building2 className="w-3 h-3 text-emerald-400" />
                              <span>In Sede OdV</span>
                            </span>
                            <div className="text-[11px] text-slate-400">{man.sedeEsecuzione || man.officinaEsecutrice}</div>
                            {man.ricambiUtilizzati && man.ricambiUtilizzati.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-950/50 text-amber-300 border border-amber-800/50 text-[9px] font-mono font-bold">
                                <Package className="w-2.5 h-2.5 text-amber-400" />
                                <span>{man.ricambiUtilizzati.length} ricambi magazzino</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-slate-200">{man.officinaEsecutrice}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Officina Esterna</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs">
                        {man.descrizione}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-amber-400 text-sm">
                        € {man.costoTotale.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {man.fatturaNumero || 'Ricevuta'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SOTTO-TAB: DOTAZIONE MEZZI                                          */}
      {/* ===================================================================== */}
      {sottoTab === 'dotazione' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Dotazione Mezzi & Presidi di Bordo</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoraggio bombole ossigeno terapeutico di bordo, estintori omologati, catene da neve, kit attrezzi e presidi di emergenza dei singoli mezzi.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {magazzinoMezzi.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Sei sicuro di voler eliminare tutte le dotazioni registrate per i mezzi?')) {
                      onAggiornaMagazzinoMezzi([]);
                      avvisa('Tutte le dotazioni mezzi sono state rimosse.');
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Svuota Dotazioni</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormDotMezzoSigla(mezzi[0]?.sigla || 'T4609');
                  setFormDotNome('');
                  setFormDotCategoria('Ossigeno & Respirazione');
                  setFormDotMatricola('');
                  setFormDotQuantita(1);
                  setFormDotBar(200);
                  setFormDotScadenza('2028-12-31');
                  setFormDotStato('Pronto all\'Uso');
                  setFormDotNote('');
                  setModaleNuovaDotazioneAperta(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuova Dotazione Bordo</span>
              </button>
            </div>
          </div>

          {magazzinoMezzi.length === 0 ? (
            <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center text-slate-400">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">Nessuna dotazione presente nei mezzi</p>
              <p className="text-xs text-slate-500 mt-1">Clicca su &quot;Nuova Dotazione Bordo&quot; per registrare bombole ossigeno, estintori o attrezzature di bordo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {magazzinoMezzi.map((dot) => (
                <div
                  key={dot.id}
                  className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-black text-xs text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          Mezzo {dot.mezzoSigla}
                        </span>
                        <h4 className="font-black text-white text-sm mt-1.5">{dot.nomeOggetto}</h4>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">{dot.categoria}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">
                          {dot.stato}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Rimuovere "${dot.nomeOggetto}" dal mezzo ${dot.mezzoSigla}?`)) {
                              onAggiornaMagazzinoMezzi(magazzinoMezzi.filter(d => d.id !== dot.id));
                              avvisa('Dotazione rimossa.');
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white transition-colors"
                          title="Elimina dotazione"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      {dot.matricola && <div>Matricola: <span className="font-mono text-white">{dot.matricola}</span></div>}
                      {dot.pressioneBar !== undefined && (
                        <div className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                          <Gauge className="w-3.5 h-3.5" /> Pressione: {dot.pressioneBar} BAR
                        </div>
                      )}
                      {dot.dataScadenzaRevisione && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3 h-3 text-amber-400" /> Scadenza Revisione: {dot.dataScadenzaRevisione}
                        </div>
                      )}
                      {dot.note && <div className="text-[11px] text-slate-400 italic mt-1">{dot.note}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. SOTTO-TAB: MAGAZZINO MEZZI (TAGLIANDI, RIPARAZIONI, RICAMBI)         */}
      {/* ===================================================================== */}
      {sottoTab === 'magazzinoMezzi' && (() => {
        const partiFiltrate = magazzinoParti.filter((p) => {
          const matchTesto = !ricercaParti.trim() ||
            p.nome.toLowerCase().includes(ricercaParti.toLowerCase()) ||
            p.codice.toLowerCase().includes(ricercaParti.toLowerCase()) ||
            (p.compatibilitaMezzi && p.compatibilitaMezzi.toLowerCase().includes(ricercaParti.toLowerCase())) ||
            (p.fornitore && p.fornitore.toLowerCase().includes(ricercaParti.toLowerCase()));
          const matchCat = filtroCategoriaParti === 'tutte' || p.categoria === filtroCategoriaParti;
          return matchTesto && matchCat;
        });

        const sottoScorta = magazzinoParti.filter((p) => Number(p.scortaMinima) > 0 && Number(p.giacenza) <= Number(p.scortaMinima));
        const valoreTotale = magazzinoParti.reduce((acc, p) => acc + (p.giacenza * (p.costoUnitario || 0)), 0);

        const modificaGiacenzaRapida = (id: string, delta: number) => {
          let artNome = '';
          const aggiornati = magazzinoParti.map((p) => {
            if (p.id === id) {
              artNome = p.nome;
              const nuovaGiacenza = Math.max(0, Number((p.giacenza + delta).toFixed(2)));
              return { ...p, giacenza: nuovaGiacenza };
            }
            return p;
          });
          salvaMagazzinoParti(aggiornati, `Rettifica rapida giacenza (${delta > 0 ? `+${delta}` : delta}) per ${artNome}`);
        };

        const eliminaParte = (id: string) => {
          if (confirm('Sei sicuro di voler eliminare questo articolo dal magazzino mezzi?')) {
            const filtrati = magazzinoParti.filter((p) => p.id !== id);
            salvaMagazzinoParti(filtrati, 'Eliminazione articolo magazzino mezzi');
            avvisa('Articolo rimosso dal magazzino.');
          }
        };

        return (
          <div className="space-y-4">
            {/* Header Magazzino Mezzi */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>Magazzino Mezzi (Ricambi, Tagliandi, Lampadine, Oli & Liquidi)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Magazzino dedicato per materiale di tagliando, riparazioni e sostituzioni: olio motore, liquido refrigerante, liquido freni, filtri, pastiglie, lampadine fari, fusibili e tergicristalli.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {magazzinoParti.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Sei sicuro di voler eliminare TUTTI gli articoli presenti nel magazzino mezzi? Questa operazione cancellerà tutte le giacenze memorizzate.')) {
                        salvaMagazzinoParti([], 'Svuotamento totale magazzino mezzi');
                        avvisa('Tutti gli articoli del magazzino mezzi sono stati eliminati.');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    title="Elimina tutti gli articoli presenti a magazzino"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Svuota Magazzino</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setParteInModifica(null);
                    setFormParteCodice(`RIC-${Math.floor(100 + Math.random() * 900)}`);
                    setFormParteNome('');
                    setFormParteCategoria('Lubrificanti & Olio');
                    setFormParteCompatibilita('Flotta Mezzi');
                    setFormParteGiacenza(0);
                    setFormParteUnita('Pezzi');
                    setFormParteScortaMin(0);
                    setFormParteCosto(0);
                    setFormParteFornitore('');
                    setFormParteUbicazione('');
                    setFormParteNote('');
                    setModaleParteAperta(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Nuovo Articolo Magazzino Mezzi</span>
                </button>
              </div>
            </div>

            {/* KPI Magazzino Mezzi */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Articoli a Magazzino</span>
                  <div className="text-lg font-black text-white font-mono">{magazzinoParti.length} Tipologie</div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                sottoScorta.length > 0
                  ? 'bg-red-950/30 border-red-500/50 text-red-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold block">Articoli Sotto Scorta Minima</span>
                    <div className={`text-lg font-black font-mono ${sottoScorta.length > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                      {sottoScorta.length} Da Riordinare
                    </div>
                  </div>
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold ${
                    sottoScorta.length > 0 ? 'bg-red-900/40 border-red-700 text-red-400' : 'bg-slate-900 border-slate-700 text-emerald-400'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                {sottoScorta.length > 0 && (
                  <button
                    type="button"
                    disabled={invioEmailSottoscortaInCorso}
                    onClick={() => {
                      inviaEmailSottoscortaAutomatico(sottoScorta, 'Richiesta manuale sollecito riordino magazzino mezzi', true);
                    }}
                    className="mt-2 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                    title="Invia subito la notifica email a mezzi@croceoro.org e presidenza@croceoro.org per tutti gli articoli sotto scorta minima"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{invioEmailSottoscortaInCorso ? 'Invio in corso...' : 'Invia Email Riordino (mezzi@ & presidenza@)'}</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Valore Stimato Giacenze</span>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    € {valoreTotale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Barra Filtri e Ricerca */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca ricambio, codice (es. LUB-5W30), mezzo..."
                  value={ricercaParti}
                  onChange={(e) => setRicercaParti(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <select
                  value={filtroCategoriaParti}
                  onChange={(e) => setFiltroCategoriaParti(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="tutte">Tutte le Categorie Ricambi</option>
                  <option value="Lubrificanti & Olio">🛢️ Lubrificanti & Olio</option>
                  <option value="Liquidi & Refrigeranti">❄️ Liquidi & Refrigeranti</option>
                  <option value="Lampadine & Fusibili">💡 Lampadine & Fusibili</option>
                  <option value="Filtri & Candele">⚙️ Filtri & Candele</option>
                  <option value="Freni & Pastiglie">🛑 Freni & Pastiglie</option>
                  <option value="Tergicristalli & Spazzole">🌧️ Tergicristalli & Spazzole</option>
                  <option value="Batterie & Elettrico">🔋 Batterie & Elettrico</option>
                  <option value="Varie Riparazioni">🔧 Varie Riparazioni</option>
                </select>
              </div>
            </div>

            {/* Griglia Articoli Magazzino Mezzi */}
            {magazzinoParti.length === 0 ? (
              <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center text-slate-400">
                <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">Nessun articolo presente nel Magazzino Mezzi</p>
                <p className="text-xs text-slate-500 mt-1">Il magazzino è attualmente vuoto. Clicca su &quot;Nuovo Articolo Magazzino Mezzi&quot; in alto per registrare i ricambi e materiali di tagliando.</p>
              </div>
            ) : partiFiltrate.length === 0 ? (
              <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center text-slate-400">
                <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">Nessun articolo trovato con i filtri selezionati</p>
                <p className="text-xs text-slate-500 mt-1">Modifica i termini di ricerca o la categoria selezionata.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {partiFiltrate.map((p) => {
                  const isSottoScorta = Number(p.scortaMinima) > 0 && Number(p.giacenza) <= Number(p.scortaMinima);
                  return (
                    <div
                      key={p.id}
                      className={`bg-slate-950 p-4 rounded-2xl border shadow-md space-y-3 flex flex-col justify-between transition-all ${
                        isSottoScorta
                          ? 'border-red-500/50 bg-red-950/10'
                          : 'border-slate-800 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-black text-xs text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {p.codice}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isSottoScorta
                              ? 'bg-red-950 text-red-300 border-red-700/60 animate-pulse'
                              : p.giacenza === 0
                              ? 'bg-slate-800 text-slate-300 border-slate-700'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                          }`}>
                            {isSottoScorta ? '⚠️ Sotto Scorta' : p.giacenza === 0 ? '0 In Giacenza' : '✓ Disponibile'}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-black text-white text-sm leading-snug">{p.nome}</h4>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                            {p.categoria}
                          </span>
                        </div>

                        {p.compatibilitaMezzi && (
                          <div className="text-[11px] text-teal-300 bg-teal-950/40 border border-teal-800/60 p-2 rounded-xl">
                            <strong>Compatibilità:</strong> {p.compatibilitaMezzi}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Giacenza Attuale:</span>
                            <span className={`font-mono font-black text-base ${isSottoScorta ? 'text-red-400' : 'text-emerald-400'}`}>
                              {p.giacenza} <span className="text-xs font-normal text-slate-400">{p.unitaMisura}</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Scorta Minima:</span>
                            <span className="font-mono text-slate-300 font-bold">
                              {Number(p.scortaMinima) === 0 ? '0 (Nessuna)' : `${p.scortaMinima} ${p.unitaMisura}`}
                            </span>
                          </div>
                          {p.costoUnitario !== undefined && (
                            <div className="col-span-2 pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Costo Unit.: € {p.costoUnitario.toFixed(2)}</span>
                              <span className="text-slate-400">Tot: € {(p.giacenza * p.costoUnitario).toFixed(2)}</span>
                            </div>
                          )}
                          {p.ubicazioneScaffale && (
                            <div className="col-span-2 text-[10px] text-slate-400">
                              📍 <strong>Ubicazione:</strong> {p.ubicazioneScaffale}
                            </div>
                          )}
                          {p.fornitore && (
                            <div className="col-span-2 text-[10px] text-slate-400 truncate">
                              🏢 <strong>Fornitore:</strong> {p.fornitore}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Azioni rapide di magazzino */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => modificaGiacenzaRapida(p.id, -1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-xs"
                            title="Scarica 1 unità per utilizzo / riparazione mezzo"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => modificaGiacenzaRapida(p.id, 1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono font-bold text-xs"
                            title="Carica 1 unità a magazzino"
                          >
                            +1
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setParteInModifica(p);
                              setFormParteCodice(p.codice);
                              setFormParteNome(p.nome);
                              setFormParteCategoria(p.categoria);
                              setFormParteCompatibilita(p.compatibilitaMezzi || '');
                              setFormParteGiacenza(p.giacenza);
                              setFormParteUnita(p.unitaMisura);
                              setFormParteScortaMin(p.scortaMinima);
                              setFormParteCosto(p.costoUnitario || 0);
                              setFormParteFornitore(p.fornitore || '');
                              setFormParteUbicazione(p.ubicazioneScaffale || '');
                              setFormParteNote(p.note || '');
                              setModaleParteAperta(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Modifica Scheda Articolo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => eliminaParte(p.id)}
                              className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/80"
                              title="Elimina Articolo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* 5. SOTTO-TAB: CONSUMI CARBURANTE & COSTO AL CHILOMETRO (€/KM)          */}
      {/* ===================================================================== */}
      {sottoTab === 'consumi' && (
        <SezioneConsumiMezzi
          mezzi={mezzi}
          manutenzioni={manutenzioni}
          serviziArchivio={serviziArchivio}
          rifornimenti={rifornimenti}
          onAggiungiRifornimento={handleAggiungiRifornimento}
          onEliminaRifornimento={handleEliminaRifornimento}
          operatoreCorrente={operatoreCorrente}
          onNotificaRadio={onNotificaRadio}
        />
      )}

      {/* ===================================================================== */}
      {/* 6. SOTTO-TAB: MONITORAGGIO FLOTTA & GRAFICI KM                          */}
      {/* ===================================================================== */}
      {sottoTab === 'monitoraggio' && (
        <MonitoraggioFlotta
          mezzi={mezzi}
          manutenzioni={manutenzioni}
          onSelezionaMezzo={(sigla) => {
            setRicerca(sigla || '');
            setSottoTab('flotta');
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* 6. SOTTO-TAB: CHECKLIST INIZIO TURNO GUIDATA MEZZI                  */}
      {/* ===================================================================== */}
      {sottoTab === 'checklist' && (
        <GestioneChecklistMezzi
          templates={templatesChecklist}
          onAggiornaTemplates={(newTemplates: ChecklistTemplate[]) => {
            setTemplatesChecklist(newTemplates);
            try {
              localStorage.setItem('CROCE_ORO_CHECKLIST_TEMPLATES', JSON.stringify(newTemplates));
            } catch {}
            onAggiornaChecklistsTemplates?.(newTemplates);
          }}
          compilate={compilateChecklist}
          onAggiornaCompilate={(newList: ChecklistCompilataTurno[]) => {
            setCompilateChecklist(newList);
            try {
              localStorage.setItem('CROCE_ORO_CHECKLIST_COMPILATE', JSON.stringify(newList));
            } catch {}
            onAggiornaChecklistsCompilate?.(newList);
          }}
          mezzi={mezzi}
          operatoreCorrente={operatoreCorrente}
          isAdmin={isAdmin}
          onNotificaRadio={onNotificaRadio}
        />
      )}

      {/* MODALE METTI FUORI SERVIZIO */}
      {mezzoDaMettereFuoriServizio && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-black text-white uppercase">
                  Metti Fuori Servizio: {mezzoDaMettereFuoriServizio.sigla}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMezzoDaMettereFuoriServizio(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={confermaFuoriServizio} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200">
                Attenzione: mettendo il mezzo <strong className="text-white">{mezzoDaMettereFuoriServizio.sigla} ({mezzoDaMettereFuoriServizio.modello})</strong> fuori servizio, non sarà più assegnabile a nuovi servizi d'emergenza finché non verrà reintegrato.
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Causale Fuori Servizio</label>
                <select
                  value={motivoFuoriServizio}
                  onChange={(e) => setMotivoFuoriServizio(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Guasto Meccanico">Guasto Meccanico (Motore, Frizione, Freni)</option>
                  <option value="Sinistro / Incidente Stradale">Sinistro / Incidente Stradale</option>
                  <option value="Sanificazione Straordinaria">Sanificazione Straordinaria Bordo Mezzo</option>
                  <option value="Revisione Ministeriale / Tagliando">Revisione Ministeriale / Tagliando in Officina</option>
                  <option value="Allestimento Sanitario / Impianto O2">Allestimento Sanitario / Impianto Ossigeno</option>
                  <option value="Pneumatici Forati / Da Sostituire">Pneumatici Forati / Da Sostituire</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Dettagli Guasto / Note Operative</label>
                <textarea
                  rows={3}
                  required
                  value={dettaglioFuoriServizio}
                  onChange={(e) => setDettaglioFuoriServizio(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Descrivi l'anomalia riscontrata, officina di destinazione o data prevista di rientro..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setMezzoDaMettereFuoriServizio(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Conferma Messa Fuori Servizio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVO / MODIFICA MEZZO */}
      {modaleMezzoAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-2xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ambulance className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {mezzoInModifica ? `Modifica Mezzo: ${mezzoInModifica.sigla}` : 'Inserisci Nuovo Mezzo Associativo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleMezzoAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaMezzo} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sigla Radio Mezzo</label>
                  <input
                    type="text"
                    required
                    value={formSigla}
                    onChange={(e) => setFormSigla(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-black"
                    placeholder="es. T4606"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Targa Automezzo</label>
                  <input
                    type="text"
                    required
                    value={formTarga}
                    onChange={(e) => setFormTarga(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                    placeholder="es. FX829AB"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Anno Immatricolazione</label>
                  <input
                    type="number"
                    required
                    value={formAnno}
                    onChange={(e) => setFormAnno(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Marca & Modello Mezzo</label>
                  <input
                    type="text"
                    required
                    value={formModello}
                    onChange={(e) => setFormModello(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="es. Fiat Ducato Maxi 2.3 Multijet"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipologia Mezzo</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Ambulanza Emergenza">Ambulanza Soccorso / Emergenza</option>
                    <option value="Ambulanza Trasporto">Ambulanza Trasporto / Lungo Raggio</option>
                    <option value="Fuoristrada 4x4">Fuoristrada 4x4 Protezione Civile</option>
                    <option value="Pulmino Disabili">Pulmino 9 Posti Disabili</option>
                    <option value="Furgone Logistico">Furgone Logistico</option>
                    <option value="Automedica">Automedica / Doblò</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Flotta Operativa</label>
                  <select
                    value={formFlotta}
                    onChange={(e) => setFormFlotta(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="vet">🐾 Emergenza & Veterinario</option>
                    <option value="pc">🌲 Protezione Civile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Chilometri Attuali (Km)</label>
                  <input
                    type="number"
                    required
                    value={formKm}
                    onChange={(e) => setFormKm(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sede di Stazionamento</label>
                  <select
                    value={formSede}
                    onChange={(e) => setFormSede(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-300 font-bold"
                  >
                    {listaSedi.map((s) => (
                      <option key={s.id} value={s.nome}>
                        🏢 {s.nome} ({s.comune})
                      </option>
                    ))}
                    {!listaSedi.some((s) => s.nome === formSede) && (
                      <option value={formSede}>{formSede}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Scadenza Revisione</label>
                  <input
                    type="date"
                    required
                    value={formScadRevisione}
                    onChange={(e) => setFormScadRevisione(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Scadenza Assicurazione</label>
                  <input
                    type="date"
                    required
                    value={formScadAssicurazione}
                    onChange={(e) => setFormScadAssicurazione(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Scadenza Bollo</label>
                  <input
                    type="date"
                    required
                    value={formScadBollo}
                    onChange={(e) => setFormScadBollo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note & Dotazioni Speciali Mezzo</label>
                <textarea
                  rows={2}
                  value={formNoteMezzo}
                  onChange={(e) => setFormNoteMezzo(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Note aggiuntive sull'allestimento..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleMezzoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Scheda Mezzo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA MANUTENZIONE */}
      {modaleNuovaManutenzioneAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase tracking-wide">
                  Registra Intervento Manutenzione
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaManutenzioneAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaManutenzione} className="space-y-4 text-xs">
              {/* 1. SELEZIONE MEZZO E TIPOLOGIA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Mezzo Interessato</label>
                  <select
                    value={formManutMezzoSigla}
                    onChange={(e) => setFormManutMezzoSigla(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold"
                  >
                    {mezziOrdinati.map((m) => (
                      <option key={m.id} value={m.sigla}>
                        {m.sigla} — {m.modello} ({m.sedeStazionamento || 'Sede'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipologia Intervento</label>
                  <select
                    value={formManutTipo}
                    onChange={(e) => setFormManutTipo(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                  >
                    <option value="Tagliando Ordinario">Tagliando Ordinario</option>
                    <option value="Revisione Ministeriale">Revisione Ministeriale</option>
                    <option value="Freni / Dischi">Freni / Dischi</option>
                    <option value="Pneumatici">Pneumatici (Sostituzione/Inversione)</option>
                    <option value="Riparazione Meccanica">Riparazione Meccanica</option>
                    <option value="Allestimento Sanitario">Allestimento Sanitario / Luci</option>
                    <option value="Sanificazione Straordinaria">Sanificazione Straordinaria</option>
                    <option value="Altro">Altro Intervento Straordinario</option>
                  </select>
                </div>
              </div>

              {/* 2. DATA E CHILOMETRAGGIO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Data Intervento</label>
                  <input
                    type="date"
                    required
                    value={formManutData}
                    onChange={(e) => setFormManutData(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Km al Tagliando / Intervento</label>
                  <input
                    type="number"
                    required
                    value={formManutKm}
                    onChange={(e) => setFormManutKm(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* 3. MODALITÀ ESECUZIONE: IN SEDE vs OFFICINA ESTERNA */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <div>
                  <label className="block text-slate-300 font-bold text-xs uppercase tracking-wider">
                    Luogo & Modalità di Esecuzione
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormManutInSede(true);
                      setFormManutOfficina(`In Sede (${formManutSede})`);
                      const totGiaInseriti = formManutRicambi.reduce((acc, r) => acc + (r.subtotale || 0), 0);
                      setFormManutCosto(Number(totGiaInseriti.toFixed(2)));
                    }}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                      formManutInSede
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className={`w-5 h-5 shrink-0 ${formManutInSede ? 'text-amber-400' : 'text-slate-500'}`} />
                    <div>
                      <div className="text-xs font-bold leading-tight">🏠 Eseguita in Sede OdV</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Officina interna / Personale dell'Associazione</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormManutInSede(false);
                      const primaOfficina = contatti.find(c => c.tipo === 'officina')?.ragioneSociale || 'Officina AutoMassa Srl';
                      setFormManutOfficina(primaOfficina);
                    }}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                      !formManutInSede
                        ? 'bg-blue-500/15 border-blue-500 text-blue-300 font-bold shadow-md ring-1 ring-blue-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Wrench className={`w-5 h-5 shrink-0 ${!formManutInSede ? 'text-blue-400' : 'text-slate-500'}`} />
                    <div>
                      <div className="text-xs font-bold leading-tight">🏭 Officina Esterna</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Concessionaria, carrozzeria o gommista</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 4. CAMPI SPECIFICI IN BASE AL LUOGO DI ESECUZIONE */}
              {formManutInSede ? (
                /* CASO A: ESEGUITA IN SEDE */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Sede Associativa di Esecuzione</label>
                      <select
                        value={formManutSede}
                        onChange={(e) => {
                          setFormManutSede(e.target.value);
                          setFormManutOfficina(`In Sede (${e.target.value})`);
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-semibold"
                      >
                        {sedi.map((s) => (
                          <option key={s.id} value={s.nome}>
                            {s.nome}
                          </option>
                        ))}
                        <option value="Sede Operativa H24 Massa (Le Jare)">Sede Operativa H24 Massa (Le Jare)</option>
                        <option value="Sezione Territoriale Carrara (Fossone)">Sezione Territoriale Carrara (Fossone)</option>
                        <option value="Sede Legale Massa (Ronchi)">Sede Legale Massa (Ronchi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Esecutore Manutenzione / Operatore OdV</label>
                      <input
                        type="text"
                        value={`${operatoreCorrente} (Personale Tecnico OdV)`}
                        disabled
                        className="w-full p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 font-semibold cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* 5. GESTIONE ARTICOLI E RICAMBI MAGAZZINO UTILIZZATI CON SCARICO AUTOMATICO */}
                  <div className="bg-slate-950 p-3.5 rounded-2xl border-2 border-amber-500/40 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 pb-1 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-400" />
                        <span className="font-black text-white text-xs uppercase">
                          Articoli & Ricambi Magazzino Mezzi Utilizzati
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-700/60 font-semibold">
                        ⚡ Scarico automatico scorte al salvataggio
                      </span>
                    </div>

                    {/* Elenco articoli già aggiunti all'intervento */}
                    {formManutRicambi.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {formManutRicambi.map((r, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-amber-400 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700">
                                  {r.articoloCodice}
                                </span>
                                <span>{r.articoloNome}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>
                                  Quantità: <strong className="text-amber-300 font-mono text-xs">{r.quantita} {r.unitaMisura}</strong>
                                </span>
                                {r.costoUnitario !== undefined && (
                                  <span className="text-slate-500 font-mono">
                                    (€ {r.costoUnitario.toFixed(2)}/u.m. • Subtot: € {(r.subtotale || 0).toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormManutRicambi(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="Rimuovi ricambio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center text-slate-400 text-[11px]">
                        Nessun articolo di magazzino aggiunto finora. Seleziona qui sotto i ricambi usati (es. Olio 5W30, filtri, pastiglie, lampadine...) per scalare le scorte.
                      </div>
                    )}

                    {/* Riga di inserimento nuovo ricambio */}
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <PlusCircle className="w-3 h-3 text-amber-400" />
                        <span>Seleziona articolo dal magazzino ricambi:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-7">
                          <select
                            value={parteSelezionataId}
                            onChange={(e) => {
                              const newId = e.target.value;
                              setParteSelezionataId(newId);
                              const art = magazzinoParti.find(a => a.id === newId);
                              const litri = isUnitaLitri(art?.unitaMisura);
                              if (!litri) {
                                setQuantitaParteDaUsare(prev => Math.max(1, Math.round(prev || 1)));
                              } else {
                                setQuantitaParteDaUsare(prev => (prev > 0 ? prev : 1));
                              }
                            }}
                            className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                          >
                            <option value="">-- Scegli Articolo da Magazzino Mezzi --</option>
                            {magazzinoParti.map((art) => (
                              <option key={art.id} value={art.id}>
                                [{art.codice}] {art.nome} — Giacenza: {art.giacenza} {art.unitaMisura} {art.costoUnitario ? `(€ ${art.costoUnitario.toFixed(2)}/u.m.)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {(() => {
                          const artCorrente = magazzinoParti.find(a => a.id === parteSelezionataId);
                          const eLitri = isUnitaLitri(artCorrente?.unitaMisura);
                          return (
                            <>
                              <div className="sm:col-span-3 flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={eLitri ? "0.1" : "1"}
                                  step={eLitri ? "0.1" : "1"}
                                  value={quantitaParteDaUsare === 0 ? '' : quantitaParteDaUsare}
                                  onKeyDown={(e) => {
                                    // I numeri con decimali sono ammessi ESCLUSIVAMENTE per le unità in Litri
                                    if (!eLitri && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E')) {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      setQuantitaParteDaUsare(0);
                                      return;
                                    }
                                    const val = parseFloat(raw);
                                    if (isNaN(val)) {
                                      setQuantitaParteDaUsare(0);
                                      return;
                                    }
                                    if (eLitri) {
                                      setQuantitaParteDaUsare(Math.max(0.1, Number(val.toFixed(2))));
                                    } else {
                                      // Solo numeri interi (senza decimali)
                                      setQuantitaParteDaUsare(Math.max(1, Math.round(val)));
                                    }
                                  }}
                                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs font-bold text-center"
                                  placeholder={eLitri ? "Litri" : "Intero"}
                                />
                                <span
                                  className={`text-[11px] font-bold whitespace-nowrap min-w-[45px] text-center px-1 py-0.5 rounded ${
                                    eLitri ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-800/40' : 'text-slate-300 bg-slate-900 border border-slate-800'
                                  }`}
                                  title={eLitri ? "Unità in Litri: ammessi decimali" : "Unità intera: solo numeri interi senza decimali"}
                                >
                                  {artCorrente?.unitaMisura || 'Unità'}
                                </span>
                              </div>

                              <div className="sm:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!artCorrente) return;
                                    const rawQ = quantitaParteDaUsare;
                                    if (rawQ <= 0) return;
                                    const q = eLitri ? Number(rawQ.toFixed(2)) : Math.round(rawQ);

                                    const existingIdx = formManutRicambi.findIndex(r => r.articoloId === artCorrente.id);
                                    if (existingIdx !== -1) {
                                      const updated = [...formManutRicambi];
                                      const nuovaQ = eLitri
                                        ? Number((updated[existingIdx].quantita + q).toFixed(2))
                                        : Math.round(updated[existingIdx].quantita + q);
                                      updated[existingIdx].quantita = nuovaQ;
                                      updated[existingIdx].subtotale = nuovaQ * (artCorrente.costoUnitario || 0);
                                      setFormManutRicambi(updated);
                                    } else {
                                      setFormManutRicambi(prev => [
                                        ...prev,
                                        {
                                          articoloId: artCorrente.id,
                                          articoloCodice: artCorrente.codice,
                                          articoloNome: artCorrente.nome,
                                          quantita: q,
                                          unitaMisura: artCorrente.unitaMisura,
                                          costoUnitario: artCorrente.costoUnitario,
                                          subtotale: q * (artCorrente.costoUnitario || 0)
                                        }
                                      ]);
                                    }
                                    setParteSelezionataId('');
                                    setQuantitaParteDaUsare(1);
                                  }}
                                  disabled={!parteSelezionataId}
                                  className={`w-full p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                                    parteSelezionataId
                                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow'
                                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                  }`}
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>Aggiungi</span>
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {formManutRicambi.length > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                          <span className="text-slate-400">
                            Totale valore ricambi impiegati: <strong className="text-amber-300 font-mono">€ {formManutRicambi.reduce((acc, r) => acc + (r.subtotale || 0), 0).toFixed(2)}</strong>
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                            ✓ Applicato automaticamente al Costo Totale
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* CASO B: OFFICINA ESTERNA (RISOLUZIONE MENÙ A TENDINA SPAGINATO) */
                <div className="space-y-2 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                  <label className="block text-slate-300 font-bold mb-1">
                    Officina / Fornitore Esecutore Esterno
                  </label>
                  {contatti.filter(c => c.tipo === 'officina' || c.tipo === 'fornitore').length > 0 && (
                    <div className="space-y-1">
                      <select
                        onChange={(e) => {
                          if (e.target.value) setFormManutOfficina(e.target.value);
                        }}
                        value=""
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 text-xs cursor-pointer"
                      >
                        <option value="">-- Seleziona rapidamente da Rubrica Contatti / Officine --</option>
                        {contatti.filter(c => c.tipo === 'officina' || c.tipo === 'fornitore').map(c => (
                          <option key={c.id} value={c.ragioneSociale}>
                            {c.ragioneSociale} ({c.citta ? `${c.citta} - ` : ''}{c.tipo})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    value={formManutOfficina}
                    onChange={(e) => setFormManutOfficina(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="es. Officina AutoMassa Srl, Concessionaria Ford, Carrozzeria..."
                  />
                </div>
              )}

              {/* 6. COSTO E FATTURA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 font-bold">Costo Totale Complessivo (€)</label>
                    {formManutInSede && (
                      <span className="text-[10px] text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-700/60 font-mono font-bold">
                        ⚡ Calcolato da ricambi
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formManutCosto}
                    onChange={(e) => setFormManutCosto(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {formManutInSede ? 'Rif. Scheda / Rapporto Interno (Opzionale)' : 'Numero Fattura / Ricevuta Fiscale (Opzionale)'}
                  </label>
                  <input
                    type="text"
                    value={formManutFattura}
                    onChange={(e) => setFormManutFattura(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder={formManutInSede ? 'es. RAP-INT-2026/04' : 'es. FT-2026/102'}
                  />
                </div>
              </div>

              {/* 7. DESCRIZIONE LAVORI ESEGUITI */}
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descrizione Lavori Eseguiti</label>
                <textarea
                  rows={2}
                  required
                  value={formManutDescrizione}
                  onChange={(e) => setFormManutDescrizione(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Es. Sostituzione olio motore e filtro, controllo livello liquidi e pressione gomme..."
                />
              </div>

              {/* PULSANTI ANNULLA E SALVA */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleNuovaManutenzioneAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Manutenzione</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA DOTAZIONE MAGAZZINO MEZZI */}
      {modaleNuovaDotazioneAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Nuova Dotazione Bordo Mezzo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleNuovaDotazioneAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaDotazione} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Mezzo Assegnato</label>
                  <select
                    value={formDotMezzoSigla}
                    onChange={(e) => setFormDotMezzoSigla(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold"
                  >
                    {mezziOrdinati.map((m) => (
                      <option key={m.id} value={m.sigla}>
                        {m.sigla} — {m.modello}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Categoria Dotazione</label>
                  <select
                    value={formDotCategoria}
                    onChange={(e) => setFormDotCategoria(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Ossigeno & Respirazione">Ossigeno & Respirazione</option>
                    <option value="Antincendio">Antincendio (Estintori)</option>
                    <option value="Emergenza Stradale">Emergenza Stradale (Catene/Triangoli)</option>
                    <option value="Attrezzi Bordo">Attrezzi Bordo & Binda</option>
                    <option value="Sanitario Bordo">Sanitario Bordo (Aspiratori/Zaini)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome Oggetto / Dispositivo</label>
                <input
                  type="text"
                  required
                  value={formDotNome}
                  onChange={(e) => setFormDotNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="es. Bombola Ossigeno 10 Litri O2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Matricola</label>
                  <input
                    type="text"
                    value={formDotMatricola}
                    onChange={(e) => setFormDotMatricola(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    placeholder="es. O2-491"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Pressione (BAR)</label>
                  <input
                    type="number"
                    value={formDotBar || ''}
                    onChange={(e) => setFormDotBar(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    placeholder="es. 200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Scad. Revisione</label>
                  <input
                    type="date"
                    value={formDotScadenza}
                    onChange={(e) => setFormDotScadenza(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleNuovaDotazioneAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Aggiungi Dotazione</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ASSEGNAZIONE SINGOLO MEZZO A SEZIONE TERRITORIALE */}
      {modaleAssegnaSedeAperta && mezzoPerAssegnazioneSede && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl max-w-md w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Assegna Mezzo {mezzoPerAssegnazioneSede.sigla}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleAssegnaSedeAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Veicolo:</span>
                  <span className="font-mono font-black text-amber-400 text-sm">{mezzoPerAssegnazioneSede.sigla}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Modello:</span>
                  <span className="text-white font-semibold">{mezzoPerAssegnazioneSede.modello}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Attuale Stazionamento:</span>
                  <span className="text-rose-300 font-bold">{mezzoPerAssegnazioneSede.sedeStazionamento || 'Nessuna'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wide">
                  Seleziona Nuova Sezione Territoriale di Destinazione:
                </label>
                <select
                  value={sedeSceltaSingola}
                  onChange={(e) => setSedeSceltaSingola(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border-2 border-rose-500/60 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {listaSedi.map((s) => (
                    <option key={s.id} value={s.nome}>
                      🏢 {s.nome} ({s.comune})
                    </option>
                  ))}
                  {!listaSedi.some((s) => s.nome === sedeSceltaSingola) && sedeSceltaSingola && (
                    <option value={sedeSceltaSingola}>{sedeSceltaSingola}</option>
                  )}
                </select>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                ℹ️ L'assegnazione aggiornerà in tempo reale sia la scheda del mezzo che l'anagrafica della sezione territoriale, sincronizzando l'autoparco stazionato.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleAssegnaSedeAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    eseguiAssegnazioneMezziASede([mezzoPerAssegnazioneSede.sigla], sedeSceltaSingola);
                    setModaleAssegnaSedeAperta(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Conferma Assegnazione</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE ASSEGNAZIONE MULTIPLA DI MEZZI A SEZIONE TERRITORIALE */}
      {modaleAssegnazioneMultiplaAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl max-w-2xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Assegna Mezzi a Sezione Territoriale
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleAssegnazioneMultiplaAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 uppercase tracking-wide">
                  1. Seleziona la Sezione Territoriale di Destinazione:
                </label>
                <select
                  value={sedeTargetMultipla}
                  onChange={(e) => {
                    const nuovaSede = e.target.value;
                    setSedeTargetMultipla(nuovaSede);
                    // Pre-seleziona i mezzi che già appartengono a questa sede
                    const gia = mezzi.filter((m) => m.sedeStazionamento === nuovaSede).map((m) => m.sigla);
                    setMezziSelezionatiMultipli(gia);
                  }}
                  className="w-full p-3 rounded-xl bg-slate-950 border-2 border-rose-500/60 text-rose-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {listaSedi.map((s) => (
                    <option key={s.id} value={s.nome}>
                      🏢 {s.nome} ({s.comune})
                    </option>
                  ))}
                  {!listaSedi.some((s) => s.nome === sedeTargetMultipla) && sedeTargetMultipla && (
                    <option value={sedeTargetMultipla}>{sedeTargetMultipla}</option>
                  )}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-300 font-bold uppercase tracking-wide">
                    2. Seleziona uno o più Mezzi da Assegnare a questa Sede:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMezziSelezionatiMultipli(mezziOrdinati.map((m) => m.sigla))}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                    >
                      Seleziona Tutti
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setMezziSelezionatiMultipli([])}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Deseleziona Tutti
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 bg-slate-950/70 rounded-2xl border border-slate-800">
                  {mezziOrdinati.map((m) => {
                    const isSelezionato = mezziSelezionatiMultipli.includes(m.sigla);
                    const isGiaInQuestaSede = m.sedeStazionamento === sedeTargetMultipla;

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (isSelezionato) {
                            setMezziSelezionatiMultipli(mezziSelezionatiMultipli.filter((s) => s !== m.sigla));
                          } else {
                            setMezziSelezionatiMultipli([...mezziSelezionatiMultipli, m.sigla]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelezionato
                            ? 'bg-rose-950/50 border-rose-500 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <input
                            type="checkbox"
                            checked={isSelezionato}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer pointer-events-none"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-amber-400 text-xs">{m.sigla}</span>
                              <span className="text-[10px] text-slate-400 truncate">{m.modello}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Attuale: <strong className={isGiaInQuestaSede ? 'text-emerald-400' : 'text-slate-300'}>{m.sedeStazionamento}</strong>
                            </span>
                          </div>
                        </div>

                        {isGiaInQuestaSede && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold uppercase shrink-0">
                            Presente
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Mezzi selezionati per <strong>{sedeTargetMultipla}</strong>:
                </span>
                <span className="font-mono font-black text-rose-400 text-sm">
                  {mezziSelezionatiMultipli.length} Mezzi
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleAssegnazioneMultiplaAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    eseguiAssegnazioneMezziASede(mezziSelezionatiMultipli, sedeTargetMultipla);
                    setModaleAssegnazioneMultiplaAperta(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Conferma Assegnazione ({mezziSelezionatiMultipli.length} Mezzi)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NUOVO / MODIFICA ARTICOLO MAGAZZINO MEZZI */}
      {modaleParteAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {parteInModifica ? `Modifica Articolo: ${parteInModifica.codice}` : 'Nuovo Articolo Magazzino Mezzi'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleParteAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const nuovaParte: ArticoloMagazzinoMezzi = {
                  id: parteInModifica ? parteInModifica.id : `part-${Date.now()}`,
                  codice: formParteCodice.trim().toUpperCase(),
                  nome: formParteNome.trim(),
                  categoria: formParteCategoria,
                  compatibilitaMezzi: formParteCompatibilita.trim(),
                  giacenza: Number(formParteGiacenza),
                  unitaMisura: formParteUnita,
                  scortaMinima: Number(formParteScortaMin),
                  costoUnitario: Number(formParteCosto),
                  fornitore: formParteFornitore.trim(),
                  ubicazioneScaffale: formParteUbicazione.trim(),
                  note: formParteNote.trim()
                };

                let aggiornati: ArticoloMagazzinoMezzi[];
                if (parteInModifica) {
                  aggiornati = magazzinoParti.map((p) => (p.id === parteInModifica.id ? nuovaParte : p));
                } else {
                  aggiornati = [nuovaParte, ...magazzinoParti];
                }
                salvaMagazzinoParti(
                  aggiornati,
                  parteInModifica
                    ? `Modifica articolo e giacenza: ${nuovaParte.nome} (${nuovaParte.codice})`
                    : `Nuovo inserimento articolo: ${nuovaParte.nome} (${nuovaParte.codice})`
                );
                setModaleParteAperta(false);
                avvisa(`Articolo "${nuovaParte.nome}" salvato a magazzino.`);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Articolo</label>
                  <input
                    type="text"
                    required
                    value={formParteCodice}
                    onChange={(e) => setFormParteCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold"
                    placeholder="es. LUB-5W30"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Categoria Ricambio</label>
                  <select
                    value={formParteCategoria}
                    onChange={(e) => setFormParteCategoria(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="Lubrificanti & Olio">Lubrificanti & Olio</option>
                    <option value="Liquidi & Refrigeranti">Liquidi & Refrigeranti</option>
                    <option value="Lampadine & Fusibili">Lampadine & Fusibili</option>
                    <option value="Filtri & Candele">Filtri & Candele</option>
                    <option value="Freni & Pastiglie">Freni & Pastiglie</option>
                    <option value="Tergicristalli & Spazzole">Tergicristalli & Spazzole</option>
                    <option value="Batterie & Elettrico">Batterie & Elettrico</option>
                    <option value="Varie Riparazioni">Varie Riparazioni</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome Articolo / Ricambio</label>
                <input
                  type="text"
                  required
                  value={formParteNome}
                  onChange={(e) => setFormParteNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="es. Olio Motore 5W-30 Sintetico LongLife"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Compatibilità Automezzi</label>
                <input
                  type="text"
                  value={formParteCompatibilita}
                  onChange={(e) => setFormParteCompatibilita(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-teal-300"
                  placeholder="es. Fiat Ducato T4606/T4609, Iveco Daily T4615..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Giacenza Iniziale</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formParteGiacenza}
                    onChange={(e) => setFormParteGiacenza(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Unità di Misura</label>
                  <select
                    value={formParteUnita}
                    onChange={(e) => setFormParteUnita(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Litri">Litri</option>
                    <option value="Pezzi">Pezzi</option>
                    <option value="Kit">Kit</option>
                    <option value="Flaconi">Flaconi</option>
                    <option value="Coppie">Coppie</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 font-bold">Scorta Minima</label>
                    <span className="text-[10px] text-amber-400 font-mono">Anche 0</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formParteScortaMin}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                      setFormParteScortaMin(val);
                    }}
                    placeholder="0"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Imposta 0 se per questo articolo non è richiesta una scorta minima fissa.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Costo Unitario (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formParteCosto}
                    onChange={(e) => setFormParteCosto(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ubicazione Scaffale</label>
                  <input
                    type="text"
                    value={formParteUbicazione}
                    onChange={(e) => setFormParteUbicazione(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="es. Scaffale M1 - Ripiano 2"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-bold">Fornitore di Riferimento</label>
                  {contatti.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setFormParteFornitore(e.target.value);
                      }}
                      value=""
                      className="text-[10px] bg-slate-900 text-amber-300 border border-slate-700 rounded px-1.5 py-0.5 cursor-pointer"
                      title="Seleziona un fornitore dalla macrocategoria Contatti"
                    >
                      <option value="">Scegli da Contatti...</option>
                      {contatti.filter(c => c.tipo === 'fornitore' || c.tipo === 'officina').map(c => (
                        <option key={c.id} value={c.ragioneSociale}>
                          {c.ragioneSociale} ({c.citta || c.tipo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="text"
                  value={formParteFornitore}
                  onChange={(e) => setFormParteFornitore(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="es. Ricambi Auto Massa Srl"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note & Specifiche Tecniche</label>
                <textarea
                  rows={2}
                  value={formParteNote}
                  onChange={(e) => setFormParteNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Specifiche SAE, omologazioni, intervallo chilometrico..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleParteAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Scheda Articolo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
