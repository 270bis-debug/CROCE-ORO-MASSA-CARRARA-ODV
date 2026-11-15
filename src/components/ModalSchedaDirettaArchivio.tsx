import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  FolderArchive,
  Save,
  Truck,
  Clock,
  User,
  Phone,
  MapPin,
  Navigation,
  FileText,
  AlertTriangle,
  Stethoscope,
  Shield,
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
  Users
} from 'lucide-react';
import {
  TIPOLOGIE_PROTEZIONE_CIVILE,
  TIPOLOGIE_SERVIZIO_ISTITUTO,
  TIPOLOGIE_SERVIZIO_VETERINARIO
} from '../data/tipologieServizio';
import { LISTA_ANIMALI_DIFFUSI } from '../data/animali';
import { IndirizzoCollezionato } from '../types/adminTypes';
import { IndirizzoAutocompleteInput, RisultatoSelezioneIndirizzo } from './IndirizzoAutocompleteInput';
import { formatDateItaly, formatISODateItaly, formatTimeItaly, getCurrentYearItaly } from '../utils/italianTime';

export interface MembroEquipaggioSchedaDiretta {
  volontarioId?: string;
  nome: string;
  ruolo: string;
  telefono?: string;
}

interface RigaEquipaggioForm {
  idRiga: string;
  volontarioId: string;
  nomeLibero: string;
  ruolo: string;
}

const RUOLI_EQUIPAGGIO_DIRETTA = [
  'Autista Soccorritore',
  'Caposervizio / Soccorritore Avanzato',
  'Soccorritore',
  '2° Soccorritore',
  '3° Soccorritore',
  'Operatore Centrale / Sala Radio',
  'Centralinista',
  'Operatore Protezione Civile',
  'Tirocinante / Osservatore'
];

function generaSiglaTipologia(tipologia?: string): string {
  const clean = (tipologia || '').trim().toUpperCase();
  if (!clean) return 'GEN';
  if (clean.includes('SOCCORSO')) return 'SOC';
  if (clean.includes('RECUPERO')) return 'REC';
  if (clean.includes('TRASPORTO')) return 'TRA';

  const stopWords = new Set(['DI', 'A', 'E', 'O', 'EO', 'DEL', 'DELLA', 'DEI', 'DEGLI', 'DAL', 'IN', 'CON', 'PER', 'SU', 'RO']);
  const tokens = clean
    .replace(/[()/.,'"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w));

  if (tokens.length === 0) return 'SRV';
  if (tokens.length === 1) {
    return tokens[0].slice(0, 4);
  }
  const initials = tokens.map((t) => t[0]).join('').slice(0, 4);
  return initials.length >= 2 ? initials : tokens[0].slice(0, 3);
}

function estraiProgCodice(codice?: string | null, anno: number = getCurrentYearItaly()): number | null {
  if (!codice || typeof codice !== 'string') return null;
  const yearPattern = new RegExp(`[\\-_]${anno}[\\-_](\\d+)`);
  const matchYear = codice.match(yearPattern);
  if (matchYear && matchYear[1]) {
    const num = parseInt(matchYear[1], 10);
    if (!isNaN(num)) return num;
  }
  const matchEnd = codice.match(/-(\d+)$/);
  if (matchEnd && matchEnd[1]) {
    const num = parseInt(matchEnd[1], 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

export interface DatiInizialiSchedaDiretta {
  urgenza?: 'ROSSO' | 'GIALLO' | 'VERDE' | 'BIANCO';
  chiamante?: string;
  telefono?: string;
  enteIstituzionale?: string;
  indirizzo?: string;
  destinazione?: string;
  isStrutturaVeterinaria?: boolean;
  isStrutturaVeterinariaPartenza?: boolean;
  ambito?: 'SERVIZIO VETERINARIO' | 'PROTEZIONE CIVILE' | "SERVIZIO D'ISTITUTO";
  sottoAmbitoVet?: string;
  tipologiaServizio?: string;
  numeroSegreteriaSoupRt?: string;
  allertaMeteo?: 'Rossa' | 'Arancione' | 'Giallo' | 'Verde' | 'Nessuna';
  tipoAnimale?: string;
  tipoAnimaleAltro?: string;
  nonDiProprieta?: boolean;
  specifiche?: string;
  sintesi?: string;
  noteCritiche?: string;
  mezzo?: string;
  datiProprietarioCentrale?: any;
  resetFormCentrale?: boolean;
}

export interface PayloadSalvataggioSchedaDiretta {
  codice: string;
  anno: number;
  data: string;
  urgenza: 'ROSSO' | 'GIALLO' | 'VERDE' | 'BIANCO';
  mezzo: string;
  chiamante: string;
  telefono: string;
  enteIstituzionale?: string;
  indirizzoIntervento: string;
  destinazione?: string;
  isStrutturaVeterinaria: boolean;
  isStrutturaVeterinariaPartenza: boolean;
  ambito: string;
  ambitoBase: 'SERVIZIO VETERINARIO' | 'PROTEZIONE CIVILE' | "SERVIZIO D'ISTITUTO";
  sottoAmbitoVet?: string;
  tipologiaServizio?: string;
  numeroSegreteriaSoupRt?: string;
  allertaMeteo?: string;
  tipoAnimale?: string;
  tipoAnimaleAltro?: string;
  nonDiProprieta: boolean;
  microchip?: string;
  noMicrochip?: boolean;
  datiProprietarioCentrale?: any;
  specifiche: string;
  sintesi: string;
  noteCritiche: string;
  volontarioNome: string;
  volontarioId?: string;
  volontarioTelefono?: string;
  qualificaTurno?: string;
  equipaggioDettaglio?: MembroEquipaggioSchedaDiretta[];
  tempi: {
    partenza?: string;
    sulPosto?: string;
    partenzaObiettivo?: string;
    arrivoDestinazione?: string;
    fineMissione?: string;
    rientro?: string;
  };
  kmInizio: number;
  kmFine: number;
  kmTotali: number;
  inAttesaKm: boolean;
  datiDestinazione?: any;
  svuotaFormCentrale: boolean;
}

interface ModalSchedaDirettaArchivioProps {
  isOpen: boolean;
  initialData?: DatiInizialiSchedaDiretta | null;
  prossimoProgressivo: number;
  archivioEsistente?: Array<{ codice: string; anno?: number }>;
  flottaMezzi: string[];
  volontari: Array<{ id: string; nome: string; cognome: string; telefono?: string }>;
  knownAddresses: IndirizzoCollezionato[];
  vetStructures: Array<{
    id: string;
    nome: string;
    indirizzoCompleto: string;
    comune?: string;
    h24?: boolean;
  }>;
  sediCroceOro: Array<{
    id: string;
    nome: string;
    sezione?: string;
    indirizzoCompleto: string;
    coordinate?: { lat: number; lng: number };
  }>;
  operatoreCorrente: string;
  onSaveAddressInfo?: (
    rawIndirizzo: string,
    origine: 'partenza' | 'destinazione',
    extra?: { nome?: string; lat?: number; lng?: number; placeId?: string; googleMapsUri?: string }
  ) => void;
  onClose: () => void;
  onSave: (payload: PayloadSalvataggioSchedaDiretta) => void;
}

export const ModalSchedaDirettaArchivio: React.FC<ModalSchedaDirettaArchivioProps> = ({
  isOpen,
  initialData,
  prossimoProgressivo,
  archivioEsistente,
  flottaMezzi,
  volontari,
  knownAddresses,
  vetStructures,
  sediCroceOro,
  operatoreCorrente,
  onSaveAddressInfo,
  onClose,
  onSave
}) => {
  const oggiIso = formatISODateItaly();
  const oraAttuale = formatTimeItaly(undefined, false);

  const [urgenza, setUrgenza] = useState<'ROSSO' | 'GIALLO' | 'VERDE' | 'BIANCO'>('VERDE');
  const [dataIso, setDataIso] = useState<string>(oggiIso);
  const [oraChiamata, setOraChiamata] = useState<string>(oraAttuale);
  const [mezzo, setMezzo] = useState<string>(flottaMezzi[0] || 'T4606');
  const [codiceScheda, setCodiceScheda] = useState<string>('');
  const [codiceModificatoManualmente, setCodiceModificatoManualmente] = useState<boolean>(false);

  const [chiamante, setChiamante] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [indirizzo, setIndirizzo] = useState<string>('');
  const [destinazione, setDestinazione] = useState<string>('');
  const [isVetPartenza, setIsVetPartenza] = useState<boolean>(false);
  const [isVetDestinazione, setIsVetDestinazione] = useState<boolean>(false);

  const [ambito, setAmbito] = useState<'SERVIZIO VETERINARIO' | 'PROTEZIONE CIVILE' | "SERVIZIO D'ISTITUTO">('SERVIZIO VETERINARIO');
  const [sottoAmbitoVet, setSottoAmbitoVet] = useState<string>(TIPOLOGIE_SERVIZIO_VETERINARIO[0] || 'SOCCORSO VETERINARIO');
  const [tipologiaServizio, setTipologiaServizio] = useState<string>(TIPOLOGIE_PROTEZIONE_CIVILE[0]);
  const [soupRt, setSoupRt] = useState<string>('');
  const [allertaMeteo, setAllertaMeteo] = useState<'Rossa' | 'Arancione' | 'Giallo' | 'Verde' | 'Nessuna'>('Nessuna');

  const [tipoAnimale, setTipoAnimale] = useState<string>('Cane');
  const [tipoAnimaleAltro, setTipoAnimaleAltro] = useState<string>('');
  const [nonDiProprieta, setNonDiProprieta] = useState<boolean>(false);
  const [microchip, setMicrochip] = useState<string>('');

  const [specifiche, setSpecifiche] = useState<string>('');
  const [sintesi, setSintesi] = useState<string>('');
  const [noteCritiche, setNoteCritiche] = useState<string>('');

  const [equipaggioRighe, setEquipaggioRighe] = useState<RigaEquipaggioForm[]>([
    { idRiga: 'eq-init-1', volontarioId: '', nomeLibero: '', ruolo: RUOLI_EQUIPAGGIO_DIRETTA[0] }
  ]);

  const [oraPartenza, setOraPartenza] = useState<string>('');
  const [oraSulPosto, setOraSulPosto] = useState<string>('');
  const [oraPartenzaObiettivo, setOraPartenzaObiettivo] = useState<string>('');
  const [oraArrivoDest, setOraArrivoDest] = useState<string>('');
  const [oraFineMissione, setOraFineMissione] = useState<string>('');
  const [oraRientro, setOraRientro] = useState<string>('');

  const [kmInizio, setKmInizio] = useState<string>('');
  const [kmFine, setKmFine] = useState<string>('');
  const [svuotaFormCentrale, setSvuotaFormCentrale] = useState<boolean>(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dIso = formatISODateItaly();
    const oStr = formatTimeItaly(undefined, false);

    setUrgenza(initialData?.urgenza || 'VERDE');
    setDataIso(dIso);
    setOraChiamata(oStr);
    setMezzo(initialData?.mezzo || flottaMezzi[0] || 'T4606');
    setCodiceModificatoManualmente(false);
    setChiamante(initialData?.chiamante || '');
    setTelefono(initialData?.telefono || '');
    setIndirizzo(initialData?.indirizzo || '');
    setDestinazione(initialData?.destinazione || '');
    setIsVetPartenza(Boolean(initialData?.isStrutturaVeterinariaPartenza));
    setIsVetDestinazione(Boolean(initialData?.isStrutturaVeterinaria));

    const initAmbito = initialData?.ambito || 'SERVIZIO VETERINARIO';
    setAmbito(initAmbito);
    setSottoAmbitoVet(initialData?.sottoAmbitoVet || TIPOLOGIE_SERVIZIO_VETERINARIO[0] || 'SOCCORSO VETERINARIO');
    if (initAmbito === 'PROTEZIONE CIVILE') {
      setTipologiaServizio(initialData?.tipologiaServizio || TIPOLOGIE_PROTEZIONE_CIVILE[0]);
    } else if (initAmbito === "SERVIZIO D'ISTITUTO") {
      setTipologiaServizio(initialData?.tipologiaServizio || TIPOLOGIE_SERVIZIO_ISTITUTO[0]);
    } else {
      setTipologiaServizio(TIPOLOGIE_PROTEZIONE_CIVILE[0]);
    }

    setSoupRt(initialData?.numeroSegreteriaSoupRt || '');
    setAllertaMeteo(initialData?.allertaMeteo || 'Nessuna');
    setTipoAnimale(initialData?.tipoAnimale || 'Cane');
    setTipoAnimaleAltro(initialData?.tipoAnimaleAltro || '');
    setNonDiProprieta(Boolean(initialData?.nonDiProprieta));
    setMicrochip('');
    setSpecifiche(initialData?.specifiche || '');
    setSintesi(initialData?.sintesi || '');
    setNoteCritiche(initialData?.noteCritiche || '');
    setEquipaggioRighe([
      { idRiga: `eq-${Date.now()}-1`, volontarioId: '', nomeLibero: '', ruolo: RUOLI_EQUIPAGGIO_DIRETTA[0] }
    ]);
    setOraPartenza('');
    setOraSulPosto('');
    setOraPartenzaObiettivo('');
    setOraArrivoDest('');
    setOraFineMissione('');
    setOraRientro('');
    setKmInizio('');
    setKmFine('');
    setSvuotaFormCentrale(Boolean(initialData?.resetFormCentrale));
    setErrore(null);
  }, [isOpen, initialData, flottaMezzi]);

  const annoScelto = useMemo(() => {
    const y = parseInt((dataIso || '').slice(0, 4), 10);
    return Number.isFinite(y) && y > 2000 ? y : getCurrentYearItaly();
  }, [dataIso]);

  const progressivoCalcolato = useMemo(() => {
    const currentYear = getCurrentYearItaly();
    if (annoScelto === currentYear) {
      return Math.max(1, prossimoProgressivo);
    }
    if (Array.isArray(archivioEsistente) && archivioEsistente.length > 0) {
      let maxP = 0;
      for (const s of archivioEsistente) {
        if (s.anno && s.anno !== annoScelto) continue;
        const p = estraiProgCodice(s.codice, annoScelto);
        if (p !== null && p > maxP) maxP = p;
      }
      return maxP + 1;
    }
    return Math.max(1, prossimoProgressivo);
  }, [annoScelto, prossimoProgressivo, archivioEsistente]);

  const codiceAutomatico = useMemo(() => {
    const siglaAmbito = ambito === 'SERVIZIO VETERINARIO' ? 'VET' : ambito === 'PROTEZIONE CIVILE' ? 'PC' : 'IST';
    const tipologiaAttiva = ambito === 'SERVIZIO VETERINARIO' ? sottoAmbitoVet : tipologiaServizio;
    const siglaTipo = generaSiglaTipologia(tipologiaAttiva);
    return `CO-${siglaAmbito}-${siglaTipo}-${urgenza}-${annoScelto}-${String(progressivoCalcolato).padStart(3, '0')}`;
  }, [ambito, sottoAmbitoVet, tipologiaServizio, urgenza, annoScelto, progressivoCalcolato]);

  // Compila automaticamente il Codice Scheda man mano che cambiano Urgenza, Ambito, Tipologia di Servizio e anno/progressivo
  // salvo modifica manuale esplicita da parte dell'operatore
  useEffect(() => {
    if (!codiceModificatoManualmente) {
      setCodiceScheda(codiceAutomatico);
    }
  }, [codiceAutomatico, codiceModificatoManualmente]);

  const codiceFinale = (codiceScheda || '').trim().toUpperCase() || codiceAutomatico;

  if (!isOpen) return null;

  const handleSelectAddress = (origine: 'partenza' | 'destinazione') => (info: RisultatoSelezioneIndirizzo) => {
    onSaveAddressInfo?.(info.indirizzo, origine, {
      nome: info.nome,
      lat: info.lat,
      lng: info.lng,
      placeId: info.placeId,
      googleMapsUri: info.googleMapsUri
    });
  };

  const handleAggiungiVolontarioRiga = () => {
    setEquipaggioRighe((prev) => {
      const nextIdx = prev.length;
      const ruoloSuggerito = RUOLI_EQUIPAGGIO_DIRETTA[Math.min(nextIdx, RUOLI_EQUIPAGGIO_DIRETTA.length - 1)] || 'Soccorritore';
      return [
        ...prev,
        {
          idRiga: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          volontarioId: '',
          nomeLibero: '',
          ruolo: ruoloSuggerito
        }
      ];
    });
  };

  const handleRimuoviVolontarioRiga = (idRiga: string) => {
    setEquipaggioRighe((prev) => (prev.length > 1 ? prev.filter((r) => r.idRiga !== idRiga) : [{ ...prev[0], volontarioId: '', nomeLibero: '' }]));
  };

  const handleAggiornaRigaEquipaggio = (idRiga: string, patch: Partial<RigaEquipaggioForm>) => {
    setEquipaggioRighe((prev) => prev.map((r) => (r.idRiga === idRiga ? { ...r, ...patch } : r)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);

    if (!chiamante.trim() && !indirizzo.trim()) {
      setErrore('Inserisci almeno il nominativo Chiamante/Ente oppure l\'Indirizzo dell\'intervento.');
      return;
    }

    const iniVal = kmInizio.trim() ? parseFloat(kmInizio) : 0;
    const finVal = kmFine.trim() ? parseFloat(kmFine) : 0;
    if ((kmInizio.trim() || kmFine.trim()) && (!Number.isFinite(iniVal) || !Number.isFinite(finVal))) {
      setErrore('I valori KM devono essere numerici validi.');
      return;
    }
    if (finVal > 0 && iniVal > 0 && finVal < iniVal) {
      setErrore(`I KM finali (${finVal}) non possono essere inferiori ai KM iniziali (${iniVal}).`);
      return;
    }

    const inAttesaKm = !(finVal > 0 && finVal >= iniVal);
    const kmTotali = inAttesaKm ? 0 : Math.max(0, Math.round((finVal - iniVal) * 10) / 10);

    const [yyyy, mm, dd] = (dataIso || oggiIso).split('-');
    const dataIt = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : formatDateItaly();
    const dataCompleta = `${dataIt}, ${oraChiamata || oraAttuale}:00`;

    // Elaborazione equipaggio multi-volontario con ruoli
    const equipaggioDettaglio: MembroEquipaggioSchedaDiretta[] = [];
    for (const r of equipaggioRighe) {
      const volSelezionato = r.volontarioId ? volontari.find((v) => v.id === r.volontarioId) : undefined;
      const nome = volSelezionato
        ? `${volSelezionato.nome} ${volSelezionato.cognome}`.trim()
        : r.nomeLibero.trim();
      if (!nome) continue;
      equipaggioDettaglio.push({
        volontarioId: volSelezionato?.id,
        nome,
        ruolo: (r.ruolo || 'Soccorritore').trim(),
        telefono: volSelezionato?.telefono
      });
    }

    const volNomeFinale =
      equipaggioDettaglio.length > 0
        ? equipaggioDettaglio.map((m) => `${m.nome} (${m.ruolo})`).join(', ')
        : 'Archivio Diretto Centrale (Non inviata)';

    const primoVol = equipaggioDettaglio.find((m) => m.volontarioId) || equipaggioDettaglio[0];
    const ruoliConcat = equipaggioDettaglio.length > 0 ? equipaggioDettaglio.map((m) => m.ruolo).join(', ') : undefined;

    const isVet = ambito === 'SERVIZIO VETERINARIO';
    const isPc = ambito === 'PROTEZIONE CIVILE';
    const ambitoDesc = isVet ? `${ambito} (${sottoAmbitoVet})` : `${ambito} (${tipologiaServizio})`;

    const finalIndirizzo = indirizzo.trim() || 'Massa Carrara';
    const finalDestinazione = destinazione.trim() || undefined;

    if (finalIndirizzo !== 'Massa Carrara') {
      onSaveAddressInfo?.(finalIndirizzo, 'partenza');
    }
    if (finalDestinazione) {
      onSaveAddressInfo?.(finalDestinazione, 'destinazione');
    }

    onSave({
      codice: codiceFinale,
      anno: annoScelto,
      data: dataCompleta,
      urgenza,
      mezzo,
      chiamante: chiamante.trim() || 'Inserimento Diretto Centrale',
      telefono: telefono.trim() || '-',
      enteIstituzionale: initialData?.enteIstituzionale,
      indirizzoIntervento: finalIndirizzo,
      destinazione: finalDestinazione,
      isStrutturaVeterinaria: isVetDestinazione,
      isStrutturaVeterinariaPartenza: isVetPartenza,
      ambito: ambitoDesc,
      ambitoBase: ambito,
      sottoAmbitoVet: isVet ? sottoAmbitoVet : tipologiaServizio,
      tipologiaServizio: isVet ? sottoAmbitoVet : tipologiaServizio,
      numeroSegreteriaSoupRt: isPc ? (soupRt.trim() || undefined) : undefined,
      allertaMeteo: isPc ? allertaMeteo : undefined,
      tipoAnimale: isVet ? tipoAnimale : undefined,
      tipoAnimaleAltro: isVet && tipoAnimale === 'Altro' ? (tipoAnimaleAltro.trim() || undefined) : undefined,
      nonDiProprieta: isVet ? nonDiProprieta : false,
      microchip: isVet ? (microchip.trim() || undefined) : undefined,
      noMicrochip: isVet ? !microchip.trim() : undefined,
      datiProprietarioCentrale: isVet ? initialData?.datiProprietarioCentrale : undefined,
      specifiche: specifiche.trim() || (isVet ? sottoAmbitoVet : tipologiaServizio),
      sintesi: sintesi.trim() || 'Scheda registrata direttamente dalla Centrale Operativa in archivio senza invio a terminale volontario.',
      noteCritiche: noteCritiche.trim() || '-',
      volontarioNome: volNomeFinale,
      volontarioId: primoVol?.volontarioId,
      volontarioTelefono: primoVol?.telefono,
      qualificaTurno: ruoliConcat,
      equipaggioDettaglio,
      tempi: {
        partenza: oraPartenza.trim() || undefined,
        sulPosto: oraSulPosto.trim() || undefined,
        partenzaObiettivo: oraPartenzaObiettivo.trim() || undefined,
        arrivoDestinazione: oraArrivoDest.trim() || undefined,
        fineMissione: oraFineMissione.trim() || undefined,
        rientro: oraRientro.trim() || undefined
      },
      kmInizio: inAttesaKm ? 0 : iniVal,
      kmFine: inAttesaKm ? 0 : finVal,
      kmTotali,
      inAttesaKm,
      svuotaFormCentrale: Boolean(initialData?.resetFormCentrale) && svuotaFormCentrale
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <FolderArchive className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                Inserimento Diretto Scheda in Archivio (Senza Invio a Volontari)
              </h2>
              <p className="text-[11px] text-cyan-200/80 leading-snug">
                Operatore: <strong>{operatoreCorrente}</strong> • Salva direttamente in <em>Archivio Fogli di Viaggio &amp; Database Servizi</em>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Avviso Nessun Invio */}
          <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs text-cyan-100 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-cyan-300">Modalità Archivio Diretto:</strong> questa scheda{' '}
              <strong>non verrà inviata a nessun volontario né suonerà sui terminali di bordo</strong>, e verrà salvata direttamente nel database storico dell&apos;archivio.
            </div>
          </div>

          {errore && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errore}</span>
            </div>
          )}

          {/* Riga 1: Codice Scheda (Auto Live + Modificabile), Urgenza, Data, Mezzo */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="col-span-2 sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Codice Scheda {codiceModificatoManualmente ? '(Modifica manuale)' : '(Auto)'}
                </label>
                {codiceModificatoManualmente && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodiceModificatoManualmente(false);
                      setCodiceScheda(codiceAutomatico);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    title="Ripristina compilazione automatica progressiva"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Auto</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={codiceScheda}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setCodiceScheda(val);
                  setCodiceModificatoManualmente(val.trim().length > 0 && val !== codiceAutomatico);
                }}
                placeholder={codiceAutomatico}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Urgenza</label>
              <select
                value={urgenza}
                onChange={(e) => setUrgenza(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                <option value="ROSSO">ROSSO</option>
                <option value="GIALLO">GIALLO</option>
                <option value="VERDE">VERDE</option>
                <option value="BIANCO">BIANCO</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Servizio</label>
              <input
                type="date"
                value={dataIso}
                onChange={(e) => setDataIso(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mezzo</label>
              <select
                value={mezzo}
                onChange={(e) => setMezzo(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono font-bold text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                {flottaMezzi.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="N/D">N/D (Nessun mezzo)</option>
              </select>
            </div>
          </div>

          {/* Riga 2: Chiamante & Telefono & Ora Chiamata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-cyan-400" />
                <span>Chiamante / Ente Segnalante *</span>
              </label>
              <input
                type="text"
                value={chiamante}
                onChange={(e) => setChiamante(e.target.value)}
                placeholder="Es. Mario Rossi / Polizia Locale..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-cyan-400" />
                <span>Telefono Segnalante</span>
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Es. 333 1234567"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Ora Chiamata</span>
              </label>
              <input
                type="time"
                value={oraChiamata}
                onChange={(e) => setOraChiamata(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Riga 3: Ambito & Sottocategoria / Tipologia di Servizio */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ambito d&apos;Intervento</label>
                <select
                  value={ambito}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    setAmbito(v);
                    if (v === 'PROTEZIONE CIVILE') setTipologiaServizio(TIPOLOGIE_PROTEZIONE_CIVILE[0]);
                    if (v === "SERVIZIO D'ISTITUTO") setTipologiaServizio(TIPOLOGIE_SERVIZIO_ISTITUTO[0]);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                >
                  <option value="SERVIZIO VETERINARIO">SERVIZIO VETERINARIO</option>
                  <option value="PROTEZIONE CIVILE">PROTEZIONE CIVILE</option>
                  <option value="SERVIZIO D'ISTITUTO">SERVIZIO D'ISTITUTO</option>
                </select>
              </div>

              {ambito === 'SERVIZIO VETERINARIO' ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Sottocategoria / Tipologia di Servizio
                  </label>
                  <select
                    value={sottoAmbitoVet}
                    onChange={(e) => setSottoAmbitoVet(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  >
                    {TIPOLOGIE_SERVIZIO_VETERINARIO.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipologia di Servizio</label>
                  <select
                    value={tipologiaServizio}
                    onChange={(e) => setTipologiaServizio(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  >
                    {(ambito === 'PROTEZIONE CIVILE' ? TIPOLOGIE_PROTEZIONE_CIVILE : TIPOLOGIE_SERVIZIO_ISTITUTO).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {ambito === 'SERVIZIO VETERINARIO' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo Animale</label>
                  <select
                    value={tipoAnimale}
                    onChange={(e) => setTipoAnimale(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    {LISTA_ANIMALI_DIFFUSI.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                {tipoAnimale === 'Altro' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Specifica Animale</label>
                    <input
                      type="text"
                      value={tipoAnimaleAltro}
                      onChange={(e) => setTipoAnimaleAltro(e.target.value)}
                      placeholder="Specifica..."
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Microchip (opz.)</label>
                  <input
                    type="text"
                    value={microchip}
                    onChange={(e) => setMicrochip(e.target.value)}
                    placeholder="Es. 380260..."
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={nonDiProprieta}
                      onChange={(e) => setNonDiProprieta(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span className="font-bold">Animale non di proprietà</span>
                  </label>
                </div>
              </div>
            )}

            {ambito === 'PROTEZIONE CIVILE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>Numero di Segreteria Soup_RT</span>
                  </label>
                  <input
                    type="text"
                    value={soupRt}
                    onChange={(e) => setSoupRt(e.target.value)}
                    placeholder="Es. SOUP-2026-001"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Eventuale allerta meteo in corso:
                  </label>
                  <select
                    value={allertaMeteo}
                    onChange={(e) => setAllertaMeteo(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold"
                  >
                    <option value="Rossa">Rossa</option>
                    <option value="Arancione">Arancione</option>
                    <option value="Giallo">Giallo</option>
                    <option value="Verde">Verde</option>
                    <option value="Nessuna">Nessuna</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Riga 4: Indirizzo Partenza & Destinazione con autocomplete */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-500/30 space-y-2">
              <label className="text-[10px] font-bold text-sky-300 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>Indirizzo Intervento / Obiettivo di Partenza *</span>
              </label>
              <IndirizzoAutocompleteInput
                value={indirizzo}
                onChange={setIndirizzo}
                onSelectAddress={handleSelectAddress('partenza')}
                knownAddresses={knownAddresses}
                vetStructures={vetStructures}
                sediCroceOro={sediCroceOro}
                accentTheme="sky"
                leftIcon="pin"
                hasClearButton={true}
                placeholder="Digita indirizzo noto o cerca online con CREA..."
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={isVetPartenza}
                  onChange={(e) => setIsVetPartenza(e.target.checked)}
                  className="w-3.5 h-3.5 accent-cyan-500 rounded"
                />
                <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
                <span>Partenza è Struttura Veterinaria</span>
              </label>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <label className="text-[10px] font-bold text-emerald-300 uppercase flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Destinazione Mezzo: Clinica / Ambulatorio / Sede</span>
              </label>
              <IndirizzoAutocompleteInput
                value={destinazione}
                onChange={setDestinazione}
                onSelectAddress={handleSelectAddress('destinazione')}
                knownAddresses={knownAddresses}
                vetStructures={vetStructures}
                sediCroceOro={sediCroceOro}
                accentTheme="emerald"
                leftIcon="nav"
                hasClearButton={true}
                placeholder="Digita destinazione o cerca online con CREA..."
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={isVetDestinazione}
                  onChange={(e) => setIsVetDestinazione(e.target.checked)}
                  className="w-3.5 h-3.5 accent-cyan-500 rounded"
                />
                <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
                <span>Destinazione è Struttura Veterinaria</span>
              </label>
            </div>
          </div>

          {/* Riga 5: Equipaggio Multi-Volontario con Ruolo + Chilometraggio */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Equipaggio / Volontari &amp; Ruoli (Solo Annotazione, nessun invio)</span>
              </label>
              <button
                type="button"
                onClick={handleAggiungiVolontarioRiga}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Aggiungi Volontario</span>
              </button>
            </div>

            <div className="space-y-2">
              {equipaggioRighe.map((riga, idx) => (
                <div key={riga.idRiga} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-900/70 p-2 rounded-xl border border-slate-800">
                  <div className="sm:col-span-5 flex gap-1.5">
                    <select
                      value={riga.volontarioId}
                      onChange={(e) => handleAggiornaRigaEquipaggio(riga.idRiga, { volontarioId: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    >
                      <option value="">-- Volontario #{idx + 1} / Testo libero --</option>
                      {volontari.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome} {v.cognome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!riga.volontarioId ? (
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={riga.nomeLibero}
                        onChange={(e) => handleAggiornaRigaEquipaggio(riga.idRiga, { nomeLibero: e.target.value })}
                        placeholder="Nome libero (opz.)..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  ) : (
                    <div className="sm:col-span-3 text-[11px] text-emerald-300 font-semibold px-2 truncate">
                      Selezionato da DB Volontari
                    </div>
                  )}

                  <div className="sm:col-span-3">
                    <select
                      value={riga.ruolo}
                      onChange={(e) => handleAggiornaRigaEquipaggio(riga.idRiga, { ruolo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs"
                    >
                      {RUOLI_EQUIPAGGIO_DIRETTA.map((ruolo) => (
                        <option key={ruolo} value={ruolo}>
                          {ruolo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRimuoviVolontarioRiga(riga.idRiga)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/70 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                      title={equipaggioRighe.length > 1 ? 'Rimuovi membro equipaggio' : 'Svuota riga'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-800/70">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">KM Inizio (opz.)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={kmInizio}
                  onChange={(e) => setKmInizio(e.target.value)}
                  placeholder="Es. 12450"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">KM Fine (opz.)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={kmFine}
                  onChange={(e) => setKmFine(e.target.value)}
                  placeholder="Es. 12472"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Riga 6: Orari Operativi opzionali */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Orari Operativi (Opzionali)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {[
                ['Partenza', oraPartenza, setOraPartenza],
                ['Sul Posto', oraSulPosto, setOraSulPosto],
                ['Part. Obiettivo', oraPartenzaObiettivo, setOraPartenzaObiettivo],
                ['Arrivo Dest.', oraArrivoDest, setOraArrivoDest],
                ['Fine Missione', oraFineMissione, setOraFineMissione],
                ['Rientro Sede', oraRientro, setOraRientro]
              ].map(([lbl, val, setter]: any) => (
                <div key={lbl}>
                  <label className="block text-[9.5px] text-slate-400 mb-0.5">{lbl}</label>
                  <input
                    type="time"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Riga 7: Specifiche, Sintesi e Note Critiche */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Truck className="w-3 h-3 text-slate-400" />
                <span>Specifiche Intervento</span>
              </label>
              <textarea
                rows={2}
                value={specifiche}
                onChange={(e) => setSpecifiche(e.target.value)}
                placeholder="Dettagli animale/servizio..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-400" />
                <span>Sintesi</span>
              </label>
              <textarea
                rows={2}
                value={sintesi}
                onChange={(e) => setSintesi(e.target.value)}
                placeholder="Descrizione sintetica del servizio..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Note Critiche / Annotazioni</label>
              <textarea
                rows={2}
                value={noteCritiche}
                onChange={(e) => setNoteCritiche(e.target.value)}
                placeholder="Eventuali note..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {initialData?.resetFormCentrale && (
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={svuotaFormCentrale}
                onChange={(e) => setSvuotaFormCentrale(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
              <span>Svuota i campi del modulo Centrale dopo il salvataggio in archivio</span>
            </label>
          )}

          {/* Footer Pulsanti */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salva Direttamente in Archivio ({codiceFinale})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
