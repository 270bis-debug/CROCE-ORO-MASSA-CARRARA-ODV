import React, { useState } from 'react';
import {
  X,
  Save,
  Truck,
  Clock,
  User,
  Phone,
  MapPin,
  AlertTriangle,
  Stethoscope,
  HeartHandshake,
  CheckCircle2,
  Check,
  Banknote,
  CreditCard,
  FileText,
  Lock,
  RotateCcw
} from 'lucide-react';
import { TIPOLOGIE_SERVIZIO_ISTITUTO, TIPOLOGIE_PROTEZIONE_CIVILE } from '../data/tipologieServizio';
import { isServizioVeterinario } from '../utils/pdfGenerator';
import { formatTimeItaly, getCurrentYearItaly } from '../utils/italianTime';
import { useMetodiPagamentoCustom, formattaEtichettaMetodoPagamento } from '../utils/metodiPagamentoStore';

export interface OperativeTimes {
  partenza?: string;
  sulPosto?: string;
  partenzaObiettivo?: string;
  arrivoDestinazione?: string;
  fineMissione?: string;
  rientro?: string;
  coordinateSulPosto?: {
    lat: number;
    lng: number;
    accuracy?: number;
    time?: string;
  };
  coordinateDestinazione?: {
    lat: number;
    lng: number;
    accuracy?: number;
    time?: string;
  };
}

export interface DatiProprietarioCentrale {
  nome: string;
  cognome: string;
  indirizzo: string;
  comune: string;
  provincia: string;
  cap: string;
  telefono: string;
  codiceFiscale?: string;
  dataNascita?: string;
  note?: string;
  email?: string;
  nonHaEmail?: boolean;
  regioneTipo?: 'TOSCANA' | 'ALTRO' | '';
  regioneAltro?: string;
  regione?: string;
}

export interface ModificaFoglioViaggioItem {
  id: string;
  codice: string;
  anno: number;
  mezzo: string;
  data: string;
  kmInizio: number;
  kmFine: number;
  kmTotali: number;
  inAttesaKm: boolean;
  tempi: OperativeTimes;
  testoCompleto: string;
  indirizzoIntervento?: string;
  destinazione?: string;
  chiamante?: string;
  telefono?: string;
  enteIstituzionale?: string;
  urgenza?: string;
  ambito?: string;
  sottoAmbitoVet?: string;
  noteCritiche?: string;
  volontarioNome?: string;
  volontarioTelefono?: string;
  qualificaTurno?: string;
  tipoAnimale?: string;
  tipoAnimaleAltro?: string;
  nonDiProprieta?: boolean;
  microchip?: string;
  noMicrochip?: boolean;
  datiProprietarioCentrale?: DatiProprietarioCentrale;
  datiDestinazione?: any;
  manovreEffettuatePatologie?: string;
  operatoreMittenteId?: string;
  operatoreMittenteNome?: string;
  annullata?: boolean;
  motivoAnnullamento?: string;
  richiedenteAnnullamento?: string;
  orarioAnnullamento?: string;
  firmaVolontario?: string;
  firmaOperatoreCentrale?: string;
  operatoreCentraleNome?: string;
  dataFirmaCentrale?: string;
  visionatoDaCentrale?: boolean;
  numeroSegreteriaSoupRt?: string;
  allertaMeteo?: string;
}

interface ModalModificaFoglioViaggioProps {
  isOpen: boolean;
  item: ModificaFoglioViaggioItem | null;
  operatoreLoggatoNome: string;
  operatoreLoggatoId?: string;
  isAdminCentrale: boolean;
  flottaMezzi?: string[];
  onClose: () => void;
  onSave: (itemAggiornato: ModificaFoglioViaggioItem) => void;
}

const FLOTTA_DEFAULT = [
  "T4609",
  "T4606",
  "T4614",
  "T4608",
  "T4613",
  "T4611",
  "T4607",
  "T4615"
];

const ENTI_ISTITUZIONALI_LIST = [
  { id: '', label: 'Nessuno / Chiamata da Privato' },
  { id: 'Polizia di Stato', label: 'Polizia di Stato' },
  { id: 'Carabinieri', label: 'Carabinieri' },
  { id: 'Polizia Locale', label: 'Polizia Locale / Municipale' },
  { id: 'Vigili del Fuoco', label: 'Vigili del Fuoco' },
  { id: 'NUE112', label: 'NUE112' },
  { id: 'Capitaneria di Porto', label: 'Capitaneria di Porto' },
  { id: 'Carabinieri Forestali', label: 'Carabinieri Forestali' },
  { id: 'Guardia di Finanza', label: 'Guardia di Finanza' },
  { id: 'Guardie Zoofile EkoClub', label: 'Guardie Zoofile EkoClub' },
  { id: 'Vab Carrara', label: 'Vab Carrara' },
  { id: 'Vab Massa', label: 'Vab Massa' },
  { id: 'ASL Sanità Animale', label: 'ASL Sanità Animale' }
];

export const ModalModificaFoglioViaggio: React.FC<ModalModificaFoglioViaggioProps> = ({
  isOpen,
  item,
  operatoreLoggatoNome,
  operatoreLoggatoId,
  isAdminCentrale,
  flottaMezzi = FLOTTA_DEFAULT,
  onClose,
  onSave
}) => {
  if (!isOpen || !item) return null;

  // Verifica permessi operatore di centrale mittente
  const operatoreMittenteEffettivo = item.operatoreMittenteNome || 'Centrale Operativa';
  const puoModificare = Boolean(
    isAdminCentrale ||
    !item.operatoreMittenteNome ||
    (operatoreLoggatoNome && item.operatoreMittenteNome.trim().toLowerCase() === operatoreLoggatoNome.trim().toLowerCase()) ||
    (operatoreLoggatoId && item.operatoreMittenteId && item.operatoreMittenteId === operatoreLoggatoId)
  );

  // Stati locali modificabili (Campi compilati sia dalla centrale che dal volontario)
  // 1. Dati Generali & Dispatch (Centrale)
  const [codice, setCodice] = useState(item.codice || '');
  const [anno, setAnno] = useState<number>(item.anno || getCurrentYearItaly());
  const [dataOra, setDataOra] = useState(item.data || '');
  const [urgenza, setUrgenza] = useState(item.urgenza || 'VERDE');
  const [mezzo, setMezzo] = useState(item.mezzo || 'T4606');
  const [ambito, setAmbito] = useState(item.ambito || 'Emergenza Veterinaria');
  const [sottoAmbitoVet, setSottoAmbitoVet] = useState(item.sottoAmbitoVet || '');
  const [enteIstituzionale, setEnteIstituzionale] = useState(item.enteIstituzionale || '');
  const [chiamante, setChiamante] = useState(item.chiamante || '');
  const [telefonoChiamante, setTelefonoChiamante] = useState(item.telefono || '');
  const [indirizzoIntervento, setIndirizzoIntervento] = useState(item.indirizzoIntervento || '');
  const [destinazione, setDestinazione] = useState(item.destinazione || '');
  const [noteCritiche, setNoteCritiche] = useState(item.noteCritiche && item.noteCritiche !== '-' ? item.noteCritiche : '');
  const [numeroSegreteriaSoupRt, setNumeroSegreteriaSoupRt] = useState(item.numeroSegreteriaSoupRt || '');
  const [allertaMeteo, setAllertaMeteo] = useState<string>(item.allertaMeteo || 'Nessuna');

  // 1-bis. Annullamento Intervento (Centrale)
  const [annullata, setAnnullata] = useState<boolean>(Boolean(item.annullata));
  const [motivoAnnullamento, setMotivoAnnullamento] = useState<string>(item.motivoAnnullamento || '');
  const [richiedenteAnnullamento, setRichiedenteAnnullamento] = useState<string>(item.richiedenteAnnullamento || '');
  const [orarioAnnullamento, setOrarioAnnullamento] = useState<string>(item.orarioAnnullamento || '');

  // 2. Dati Animale & Intestatario Microchip (Centrale / Volontario)
  const [tipoAnimale, setTipoAnimale] = useState(item.tipoAnimale || 'Cane');
  const [tipoAnimaleAltro, setTipoAnimaleAltro] = useState(item.tipoAnimaleAltro || '');
  const [nonDiProprieta, setNonDiProprieta] = useState(Boolean(item.nonDiProprieta));
  const [microchip, setMicrochip] = useState(item.microchip || '');
  const [noMicrochip, setNoMicrochip] = useState(Boolean(item.noMicrochip));

  // Dati Proprietario Microchip
  const propInit = item.datiProprietarioCentrale || item.datiDestinazione?.proprietario || {};
  const [propNome, setPropNome] = useState(propInit.nome || '');
  const [propCognome, setPropCognome] = useState(propInit.cognome || '');
  const [propTelefono, setPropTelefono] = useState(propInit.telefono || '');
  const [propIndirizzo, setPropIndirizzo] = useState(propInit.indirizzo || '');
  const [propComune, setPropComune] = useState(propInit.comune || '');
  const [propProvincia, setPropProvincia] = useState(propInit.provincia || 'MS');
  const [propCap, setPropCap] = useState(propInit.cap || '');
  const [propCF, setPropCF] = useState(propInit.codiceFiscale || '');
  const [propEmail, setPropEmail] = useState(propInit.email || '');
  const [propRegioneTipo, setPropRegioneTipo] = useState<'TOSCANA' | 'ALTRO' | ''>(() => {
    if (propInit.regioneTipo) return propInit.regioneTipo;
    if (propInit.regione === 'TOSCANA') return 'TOSCANA';
    if (propInit.regione) return 'ALTRO';
    return '';
  });
  const [propRegioneAltro, setPropRegioneAltro] = useState<string>(() => {
    if (propInit.regioneAltro) return propInit.regioneAltro;
    if (propInit.regione && propInit.regione !== 'TOSCANA') return propInit.regione;
    return '';
  });

  // 3. Personale & Turno Bordo Mezzo (Volontario)
  const [volontarioNome, setVolontarioNome] = useState(item.volontarioNome || '');
  const [volontarioTelefono, setVolontarioTelefono] = useState(item.volontarioTelefono || '');
  const [qualificaTurno, setQualificaTurno] = useState(item.qualificaTurno || 'Capo Turno Soccorritore');

  // 4. Orari Operativi (Volontario)
  const tempiInit = item.tempi || {};
  const [orarioPartenza, setOrarioPartenza] = useState(tempiInit.partenza || '');
  const [orarioSulPosto, setOrarioSulPosto] = useState(tempiInit.sulPosto || '');
  const [orarioPartenzaObiettivo, setOrarioPartenzaObiettivo] = useState(tempiInit.partenzaObiettivo || '');
  const [orarioArrivoDestinazione, setOrarioArrivoDestinazione] = useState(tempiInit.arrivoDestinazione || '');
  const [orarioFineMissione, setOrarioFineMissione] = useState(tempiInit.fineMissione || '');
  const [orarioRientro, setOrarioRientro] = useState(tempiInit.rientro || '');

  // 5. Chilometri (Volontario / Centrale)
  const [kmInizio, setKmInizio] = useState<number>(Number(item.kmInizio) || 0);
  const [kmFine, setKmFine] = useState<number>(Number(item.kmFine) || 0);
  const [inAttesaKm, setInAttesaKm] = useState<boolean>(Boolean(item.inAttesaKm));

  // 6. Consegna, Clinica & Donazione (Volontario)
  const destInfo = item.datiDestinazione || {};
  const [strutturaRicevente, setStrutturaRicevente] = useState(
    destInfo?.strutturaVeterinaria?.nomeStrutturaOVeterinario || item.destinazione || ''
  );
  const [medicoVeterinario, setMedicoVeterinario] = useState(
    destInfo?.strutturaVeterinaria?.medicoVeterinarioDiTurno || ''
  );
  const [noteCliniche, setNoteCliniche] = useState(
    destInfo?.strutturaVeterinaria?.noteClinicheConsegna || ''
  );

  const metodiPagamentoCustom = useMetodiPagamentoCustom();
  const metodiDonazioneCustom = React.useMemo(
    () => metodiPagamentoCustom.filter((m) => m.attivo && (m.tipo === 'entrambi' || m.tipo === 'donazioni')),
    [metodiPagamentoCustom]
  );

  const donazioneInit = destInfo?.donazione || {};
  const [donazioneRicevuta, setDonazioneRicevuta] = useState(Boolean(donazioneInit.ricevuta || (donazioneInit.somma && donazioneInit.somma > 0)));
  const [donazioneSomma, setDonazioneSomma] = useState<number>(Number(donazioneInit.somma) || 0);
  const [donazioneMetodo, setDonazioneMetodo] = useState<string>(donazioneInit.metodo || '');

  // 7. MANOVRE EFFETTUATE / PATOLOGIE (Volontario)
  const [manovreEffettuatePatologie, setManovreEffettuatePatologie] = useState(
    item.manovreEffettuatePatologie || destInfo?.manovreEffettuatePatologie || ''
  );

  // Tab di navigazione interna per una compilazione ordinata ed efficace
  const [sezioneAttiva, setSezioneAttiva] = useState<'centrale' | 'animale' | 'volontario' | 'tempi_km' | 'note_manovre'>('centrale');

  // Verifica se la missione è a carattere veterinario o se è istituto / protezione civile
  const isVetMissione = isServizioVeterinario({ ambito, codice, sottoAmbitoVet, testoCompleto: item.testoCompleto });

  // Calcolo chilometri totali
  const kmTotaliCalcolati = kmFine >= kmInizio && kmInizio > 0 ? kmFine - kmInizio : 0;

  const handleSalva = () => {
    if (!puoModificare) return;

    // Se è presente un importo di donazione, la dichiarazione di Contanti o POS è strettamente obbligatoria
    if ((donazioneRicevuta || donazioneSomma > 0) && donazioneSomma > 0) {
      if (!donazioneMetodo) {
        alert(`Hai inserito una donazione di € ${donazioneSomma}: devi dichiarare obbligatoriamente se la donazione è stata effettuata in Contanti o con il POS spuntando la relativa casella!`);
        setSezioneAttiva('volontario');
        return;
      }
    }

    const kmInizioNum = Number(kmInizio) || 0;
    const kmFineNum = Number(kmFine) || 0;
    const kmTotaliFinali = kmFineNum >= kmInizioNum && kmInizioNum > 0 ? kmFineNum - kmInizioNum : (kmFineNum > 0 ? kmFineNum : 0);
    const inAttesaKmFinale = inAttesaKm && (kmInizioNum <= 0 || kmFineNum <= 0);

    const updatedTempi: OperativeTimes = {
      ...item.tempi,
      partenza: orarioPartenza.trim() || undefined,
      sulPosto: orarioSulPosto.trim() || undefined,
      partenzaObiettivo: orarioPartenzaObiettivo.trim() || undefined,
      arrivoDestinazione: orarioArrivoDestinazione.trim() || undefined,
      fineMissione: orarioFineMissione.trim() || undefined,
      rientro: orarioRientro.trim() || undefined
    };

    const updatedProprietario: DatiProprietarioCentrale | undefined = (
      propNome.trim() || propCognome.trim() || propTelefono.trim() || propIndirizzo.trim() || propRegioneTipo
    ) ? {
      nome: propNome.trim(),
      cognome: propCognome.trim(),
      telefono: propTelefono.trim(),
      indirizzo: propIndirizzo.trim(),
      comune: propComune.trim(),
      provincia: propProvincia.trim(),
      cap: propCap.trim(),
      codiceFiscale: propCF.trim() || undefined,
      email: propEmail.trim() || undefined,
      regioneTipo: propRegioneTipo || undefined,
      regioneAltro: propRegioneTipo === 'ALTRO' ? propRegioneAltro.trim() : undefined,
      regione: propRegioneTipo === 'TOSCANA' ? 'TOSCANA' : (propRegioneTipo === 'ALTRO' ? (propRegioneAltro.trim() || 'ALTRO') : undefined)
    } : item.datiProprietarioCentrale;

    const updatedDestInfo = {
      ...(item.datiDestinazione || {}),
      proprietario: updatedProprietario || item.datiDestinazione?.proprietario,
      strutturaVeterinaria: {
        ...(item.datiDestinazione?.strutturaVeterinaria || {}),
        isVeterinario: Boolean(strutturaRicevente.trim()),
        nomeStrutturaOVeterinario: strutturaRicevente.trim() || undefined,
        medicoVeterinarioDiTurno: medicoVeterinario.trim() || undefined,
        noteClinicheConsegna: noteCliniche.trim() || undefined
      },
      donazione: donazioneRicevuta ? {
        ricevuta: true,
        somma: donazioneSomma,
        metodo: donazioneMetodo
      } : undefined,
      manovreEffettuatePatologie: manovreEffettuatePatologie.trim() || undefined
    };

    // Ricostruzione pulita e completa del testo del foglio di viaggio
    // IMPORTANTE: Sui file che generi non scrivere da nessuna parte quali dati sono stati eventualmente modificati o corretti!
    let docTesto = `CROCE ORO MASSA CARRARA - FOGLIO DI VIAGGIO DIGITALE\n`;
    docTesto += `ID MISSIONE: ${codice.trim()}\n`;
    docTesto += `DATA: ${dataOra.trim()}\n`;
    docTesto += `URGENZA: ${urgenza}\n`;
    docTesto += `AMBITO: ${ambito.trim()}\n`;
    docTesto += `MEZZO UTILIZZATO: ${mezzo.trim()}\n`;
    const isProtezioneCivileDoc = Boolean(
      ambito.toUpperCase().includes('PROTEZIONE CIVILE') ||
      codice.toUpperCase().includes('-PC-') ||
      codice.toUpperCase().includes('PC-AUT')
    );
    if (isProtezioneCivileDoc || numeroSegreteriaSoupRt.trim() || (allertaMeteo && allertaMeteo !== 'Nessuna')) {
      docTesto += `NUMERO DI SEGRETERIA SOUP_RT: ${numeroSegreteriaSoupRt.trim() || 'Non indicato'}\n`;
      docTesto += `EVENTUALE ALLERTA METEO IN CORSO: ${allertaMeteo || 'Nessuna'}\n`;
    }
    docTesto += `INDIRIZZO INTERVENTO: ${indirizzoIntervento.trim() || '-'}\n`;
    if (destinazione.trim()) {
      docTesto += `DESTINAZIONE / OSPEDALE: ${destinazione.trim()}\n`;
    }
    docTesto += `SEGNALANTE: ${chiamante.trim() || '-'} (${telefonoChiamante.trim() || '-'})\n`;
    if (annullata) {
      docTesto += `STATO INTERVENTO: ANNULLATO DALLA CENTRALE\n`;
      docTesto += `MOTIVO ANNULLAMENTO: ${motivoAnnullamento.trim() || 'Intervento annullato'}\n`;
      docTesto += `RICHIESTO DA: ${richiedenteAnnullamento.trim() || 'Centrale'}${orarioAnnullamento ? ` (Ore ${orarioAnnullamento})` : ''}\n`;
    }
    docTesto += `--------------------------------------------------\n`;
    if (inAttesaKmFinale) {
      docTesto += `STATO PDF: IN ATTESA INSERIMENTO KM (PDF BLOCCATO FINCHÉ NON INSERITI)\n`;
      docTesto += `KM INIZIO: IN ATTESA | KM FINE: IN ATTESA\n`;
      docTesto += `KM TOTALI PERCORSI: IN ATTESA DI INSERIMENTO DA CENTRALE O VOLONTARIO\n`;
    } else {
      docTesto += `KM INIZIO: ${kmInizioNum} | KM FINE: ${kmFineNum}\n`;
      docTesto += `KM TOTALI PERCORSI: ${kmTotaliFinali} KM\n`;
    }
    docTesto += `--------------------------------------------------\n`;
    docTesto += `CRONISTORIA STATI OPERATIVI TEMPO:\n`;
    docTesto += `- Partenza da Sede: ${updatedTempi.partenza || '-'}\n`;
    if (annullata) {
      docTesto += `- Arrivo sul Posto: NON EFFETTUATO (INTERVENTO ANNULLATO)\n`;
      docTesto += `- Partenza da Obiettivo: NON EFFETTUATO (INTERVENTO ANNULLATO)\n`;
      docTesto += `- Arrivo a Destinazione: NON EFFETTUATO (INTERVENTO ANNULLATO)\n`;
    } else {
      docTesto += `- Arrivo sul Posto: ${updatedTempi.sulPosto || '-'}\n`;
      docTesto += `- Partenza da Obiettivo: ${updatedTempi.partenzaObiettivo || '-'}\n`;
      docTesto += `- Arrivo a Destinazione: ${updatedTempi.arrivoDestinazione || '-'}\n`;
    }
    docTesto += `- Fine Missione: ${updatedTempi.fineMissione || '-'}\n`;
    docTesto += `- Rientro in Sede: ${updatedTempi.rientro || '-'}\n`;
    if (isVetMissione && (updatedProprietario || donazioneRicevuta || strutturaRicevente.trim())) {
      docTesto += `--------------------------------------------------\n`;
      docTesto += `SCHEDA CONSEGNA DESTINAZIONE & FIRME:\n`;
      if (updatedProprietario) {
        docTesto += `PROPRIETARIO: ${updatedProprietario.nome} ${updatedProprietario.cognome}\n`;
        docTesto += `RESIDENZA: ${updatedProprietario.indirizzo || '-'}, ${updatedProprietario.comune || '-'} (${updatedProprietario.provincia || '-'}), CAP ${updatedProprietario.cap || '-'}\n`;
      }
      if (donazioneRicevuta) {
        const metodoLabel = donazioneMetodo === 'pos' ? 'POS Elettronico' : donazioneMetodo === 'contanti' ? 'Contanti' : (donazioneMetodo || 'Contanti');
        docTesto += `DONAZIONE RICEVUTA: € ${donazioneSomma} (${metodoLabel})\n`;
      }
      if (strutturaRicevente.trim()) {
        docTesto += `STRUTTURA RICEVENTE: ${strutturaRicevente.trim()}\n`;
      }
      docTesto += `FIRME DIGITALI: Acquisite a bordo mezzo su display\n`;
    }
    const manovreTesto = manovreEffettuatePatologie.trim();
    if (manovreTesto) {
      docTesto += `--------------------------------------------------\n`;
      docTesto += `MANOVRE EFFETTUATE/PATOLOGIE: ${manovreTesto}\n`;
    }
    if (noteCritiche.trim()) {
      docTesto += `--------------------------------------------------\n`;
      docTesto += `NOTE CRITICHE: ${noteCritiche.trim()}\n`;
    }

    const isVetMissioneDoc = isServizioVeterinario({ ambito, codice, sottoAmbitoVet, testoCompleto: docTesto });

    const itemAggiornato: ModificaFoglioViaggioItem = {
      ...item,
      codice: codice.trim(),
      anno: Number(anno) || item.anno,
      data: dataOra.trim(),
      urgenza,
      mezzo: mezzo.trim(),
      ambito: ambito.trim(),
      sottoAmbitoVet: sottoAmbitoVet.trim() || undefined,
      enteIstituzionale: enteIstituzionale.trim() || undefined,
      chiamante: chiamante.trim(),
      telefono: telefonoChiamante.trim(),
      indirizzoIntervento: indirizzoIntervento.trim(),
      destinazione: destinazione.trim() || undefined,
      noteCritiche: noteCritiche.trim() || '-',
      tipoAnimale: isVetMissione ? tipoAnimale : undefined,
      tipoAnimaleAltro: isVetMissione && tipoAnimale === 'Altro' ? tipoAnimaleAltro.trim() : undefined,
      nonDiProprieta: isVetMissione ? nonDiProprieta : false,
      microchip: isVetMissione && !noMicrochip ? microchip.trim() : undefined,
      noMicrochip: isVetMissione ? noMicrochip : undefined,
      datiProprietarioCentrale: isVetMissione ? updatedProprietario : undefined,
      volontarioNome: volontarioNome.trim(),
      volontarioTelefono: volontarioTelefono.trim(),
      qualificaTurno: qualificaTurno.trim(),
      tempi: updatedTempi,
      kmInizio: kmInizioNum,
      kmFine: kmFineNum,
      kmTotali: kmTotaliFinali,
      inAttesaKm: inAttesaKmFinale,
      datiDestinazione: isVetMissione ? updatedDestInfo : (updatedDestInfo ? { ...updatedDestInfo, animale: undefined, proprietario: undefined, strutturaVeterinaria: undefined } : undefined),
      manovreEffettuatePatologie: manovreTesto || undefined,
      testoCompleto: docTesto,
      annullata,
      motivoAnnullamento: annullata ? (motivoAnnullamento.trim() || item.motivoAnnullamento) : undefined,
      richiedenteAnnullamento: annullata ? (richiedenteAnnullamento.trim() || item.richiedenteAnnullamento) : undefined,
      orarioAnnullamento: annullata ? (orarioAnnullamento.trim() || item.orarioAnnullamento) : undefined,
      firmaVolontario: item.firmaVolontario,
      firmaOperatoreCentrale: item.firmaOperatoreCentrale,
      dataFirmaCentrale: item.dataFirmaCentrale,
      operatoreCentraleNome: item.operatoreCentraleNome,
      visionatoDaCentrale: item.visionatoDaCentrale,
      operatoreMittenteNome: item.operatoreMittenteNome || operatoreLoggatoNome,
      operatoreMittenteId: item.operatoreMittenteId || operatoreLoggatoId,
      numeroSegreteriaSoupRt: isProtezioneCivileDoc ? (numeroSegreteriaSoupRt.trim() || undefined) : undefined,
      allertaMeteo: isProtezioneCivileDoc ? (allertaMeteo || 'Nessuna') : undefined
    };

    onSave(itemAggiornato);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER MODALE */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {item.codice}
              </span>
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                Modifica Scheda Foglio di Viaggio
              </h3>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Mittente Scheda: <strong className="text-slate-200">{operatoreMittenteEffettivo}</strong></span>
              {puoModificare ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Operatore Mittente Autorizzato alla Modifica
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/30">
                  <Lock className="w-3 h-3" />
                  Modifica Riservata all&apos;Operatore Mittente ({operatoreMittenteEffettivo})
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Chiudi senza salvare"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BLOCCO DI AVVISO SE OPERATORE NON MITTENTE */}
        {!puoModificare && (
          <div className="p-4 bg-red-950/40 border-b border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Questo foglio di viaggio è stato inviato dall&apos;operatore di centrale <strong>{operatoreMittenteEffettivo}</strong>. Come da regolamento operativo, solo l&apos;operatore mittente che ha trasmesso la scheda (o l&apos;amministratore di centrale) può modificarne i dati in archivio.
            </span>
          </div>
        )}

        {/* BARRA TAB SEZIONI */}
        <div className="px-4 pt-3 border-b border-slate-800 bg-slate-900/90 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSezioneAttiva('centrale')}
            className={`px-3 py-2 rounded-t-lg font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              sezioneAttiva === 'centrale'
                ? 'border-amber-400 text-amber-300 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            1. Dati Centrale & Missione
          </button>
          {isVetMissione && (
            <button
              type="button"
              onClick={() => setSezioneAttiva('animale')}
              className={`px-3 py-2 rounded-t-lg font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                sezioneAttiva === 'animale'
                  ? 'border-amber-400 text-amber-300 bg-slate-800/80 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              2. Animale & Microchip
            </button>
          )}
          <button
            type="button"
            onClick={() => setSezioneAttiva('volontario')}
            className={`px-3 py-2 rounded-t-lg font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              sezioneAttiva === 'volontario'
                ? 'border-amber-400 text-amber-300 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            3. Volontario & Equipaggio
          </button>
          <button
            type="button"
            onClick={() => setSezioneAttiva('tempi_km')}
            className={`px-3 py-2 rounded-t-lg font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              sezioneAttiva === 'tempi_km'
                ? 'border-amber-400 text-amber-300 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            4. Orari, KM & Destinazione
          </button>
          <button
            type="button"
            onClick={() => setSezioneAttiva('note_manovre')}
            className={`px-3 py-2 rounded-t-lg font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              sezioneAttiva === 'note_manovre'
                ? 'border-emerald-400 text-emerald-300 bg-slate-800/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            5. Manovre & Patologie
          </button>
        </div>

        {/* CORPO DEL MODULO EDITABILE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-900/60">
          
          {/* SEZIONE 1: DATI CENTRALE & MISSIONE */}
          {sezioneAttiva === 'centrale' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Codice Missione
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={codice}
                    onChange={(e) => setCodice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Anno Servizio
                  </label>
                  <input
                    type="number"
                    disabled={!puoModificare}
                    value={anno}
                    onChange={(e) => setAnno(Number(e.target.value) || getCurrentYearItaly())}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Data e Orario Servizio
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={dataOra}
                    onChange={(e) => setDataOra(e.target.value)}
                    placeholder="DD/MM/YYYY, HH:mm"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Codice Urgenza
                  </label>
                  <select
                    disabled={!puoModificare}
                    value={urgenza}
                    onChange={(e) => setUrgenza(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    <option value="ROSSO">🔴 ROSSO (Emergenza Massima)</option>
                    <option value="GIALLO">🟡 GIALLO (Urgente)</option>
                    <option value="VERDE">🟢 VERDE (Ordinario / Non Critico)</option>
                    <option value="BIANCO">⚪ BIANCO (Programmato)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Mezzo Assegnato
                  </label>
                  <select
                    disabled={!puoModificare}
                    value={mezzo}
                    onChange={(e) => setMezzo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    {flottaMezzi.map((m) => (
                      <option key={m} value={m}>
                        🚑 {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Ente Istituzionale Chiamante
                  </label>
                  <select
                    disabled={!puoModificare}
                    value={enteIstituzionale}
                    onChange={(e) => setEnteIstituzionale(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    {ENTI_ISTITUZIONALI_LIST.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Ambito Intervento
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={ambito}
                    onChange={(e) => setAmbito(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Sotto-Ambito / Tipologia Servizio (Specifiche)
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={sottoAmbitoVet}
                    onChange={(e) => setSottoAmbitoVet(e.target.value)}
                    list="lista-tipologie-modifica-foglio"
                    placeholder="Seleziona o digita tipologia / specifiche..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                  <datalist id="lista-tipologie-modifica-foglio">
                    <option value="SOCCORSO VETERINARIO" />
                    <option value="RECUPERO ANIMALE" />
                    <option value="TRASPORTO ANIMALE" />
                    {TIPOLOGIE_PROTEZIONE_CIVILE.map((t) => (
                      <option key={t} value={t} />
                    ))}
                    {TIPOLOGIE_SERVIZIO_ISTITUTO.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>

              {(ambito.toUpperCase().includes('PROTEZIONE CIVILE') || codice.toUpperCase().includes('-PC-') || codice.toUpperCase().includes('PC-AUT')) && (
                <div className="bg-blue-950/30 border border-blue-500/40 rounded-xl p-3 space-y-2.5">
                  <div className="text-[11px] font-black uppercase text-blue-300 flex items-center justify-between gap-2">
                    <span>🛡️ Dati Protezione Civile (Compilazione Centrale Operativa)</span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                      Non modificabile dal volontario
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Numero di Segreteria Soup_RT
                      </label>
                      <input
                        type="text"
                        disabled={!puoModificare}
                        value={numeroSegreteriaSoupRt}
                        onChange={(e) => setNumeroSegreteriaSoupRt(e.target.value)}
                        placeholder="Inserisci numero segreteria Soup_RT..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Eventuale allerta meteo in corso:
                      </label>
                      <select
                        disabled={!puoModificare}
                        value={allertaMeteo}
                        onChange={(e) => setAllertaMeteo(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      >
                        <option value="Rossa">Rossa</option>
                        <option value="Arancione">Arancione</option>
                        <option value="Giallo">Giallo</option>
                        <option value="Verde">Verde</option>
                        <option value="Nessuna">Nessuna</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Segnalante / Chiamante
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={chiamante}
                    onChange={(e) => setChiamante(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Telefono Segnalante
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={telefonoChiamante}
                    onChange={(e) => setTelefonoChiamante(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>Indirizzo Intervento / Partenza</span>
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={indirizzoIntervento}
                    onChange={(e) => setIndirizzoIntervento(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Destinazione / Presidio Ricevente</span>
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={destinazione}
                    onChange={(e) => setDestinazione(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Note Critiche / Operative Centrale
                </label>
                <textarea
                  rows={2}
                  disabled={!puoModificare}
                  value={noteCritiche}
                  onChange={(e) => setNoteCritiche(e.target.value)}
                  placeholder="Eventuali note critiche trasmesse all'equipaggio..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>

              {/* STATO INTERVENTO & ANNULLAMENTO CENTRALE */}
              <div className="pt-3 border-t border-slate-800">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        disabled={!puoModificare}
                        checked={annullata}
                        onChange={(e) => {
                          setAnnullata(e.target.checked);
                          if (e.target.checked && !orarioAnnullamento) {
                            setOrarioAnnullamento(formatTimeItaly(undefined, false));
                          }
                          if (e.target.checked && !richiedenteAnnullamento) {
                            setRichiedenteAnnullamento(operatoreMittenteEffettivo || 'Centrale Operativa');
                          }
                        }}
                        className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700 accent-red-600 cursor-pointer"
                      />
                      <span className="text-xs font-black uppercase text-red-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span>Intervento Annullato dalla Centrale Operativa</span>
                      </span>
                    </label>

                    {annullata && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                        STATO: ANNULLATO
                      </span>
                    )}
                  </div>

                  {annullata && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60 animate-fadeIn">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                          Motivo dell'Annullamento
                        </label>
                        <input
                          type="text"
                          disabled={!puoModificare}
                          value={motivoAnnullamento}
                          onChange={(e) => setMotivoAnnullamento(e.target.value)}
                          placeholder="es. Richiesta annullata dal segnalante / Paziente non reperibile"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                          Richiesto da / Ente
                        </label>
                        <input
                          type="text"
                          disabled={!puoModificare}
                          value={richiedenteAnnullamento}
                          onChange={(e) => setRichiedenteAnnullamento(e.target.value)}
                          placeholder="es. Segnalante / NUE 112 / ASL"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                          Orario Annullamento
                        </label>
                        <input
                          type="text"
                          disabled={!puoModificare}
                          value={orarioAnnullamento}
                          onChange={(e) => setOrarioAnnullamento(e.target.value)}
                          placeholder="es. 14:30"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SEZIONE 2: ANIMALE & MICROCHIP & PROPRIETARIO */}
          {sezioneAttiva === 'animale' && isVetMissione && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Specie Animale
                  </label>
                  <select
                    disabled={!puoModificare}
                    value={tipoAnimale}
                    onChange={(e) => setTipoAnimale(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    <option value="Cane">🐕 Cane</option>
                    <option value="Gatto">🐈 Gatto</option>
                    <option value="Volatile">🦅 Volatile</option>
                    <option value="Selvatico">🦌 Selvatico</option>
                    <option value="Altro">🐾 Altro (Specificare)</option>
                  </select>
                </div>
                {tipoAnimale === 'Altro' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Specifica Altro Animale
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={tipoAnimaleAltro}
                      onChange={(e) => setTipoAnimaleAltro(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                )}
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      disabled={!puoModificare}
                      checked={nonDiProprieta}
                      onChange={(e) => setNonDiProprieta(e.target.checked)}
                      className="w-4 h-4 rounded text-red-500 bg-slate-800 border-slate-700 focus:ring-red-400"
                    />
                    <span>Animale Non di Proprietà / Randagio</span>
                  </label>
                </div>
              </div>

              {/* MICROCHIP */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-300">Identificazione Microchip</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-400">
                    <input
                      type="checkbox"
                      disabled={!puoModificare}
                      checked={noMicrochip}
                      onChange={(e) => setNoMicrochip(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-400"
                    />
                    <span>Nessun microchip rilevato</span>
                  </label>
                </div>
                {!noMicrochip && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Numero Microchip (15 cifre ISO)
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={microchip}
                      onChange={(e) => setMicrochip(e.target.value)}
                      placeholder="es. 380260000000000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* DATI PROPRIETARIO / INTESTATARIO */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 block">
                  Dati Proprietario / Intestatario Microchip
                </span>

                {/* Selezione Regione Anagrafe Microchip: TOSCANA / ALTRO */}
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <span>🏛️ Regione Anagrafe Microchip</span>
                    </label>
                    <span className="text-[9.5px] text-slate-400 font-mono">Banca Dati Territoriale</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                      propRegioneTipo === 'TOSCANA'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}>
                      <input
                        type="checkbox"
                        disabled={!puoModificare}
                        checked={propRegioneTipo === 'TOSCANA'}
                        onChange={() => {
                          if (propRegioneTipo === 'TOSCANA') {
                            setPropRegioneTipo('');
                          } else {
                            setPropRegioneTipo('TOSCANA');
                            setPropRegioneAltro('');
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer accent-amber-500"
                      />
                      <span className="text-xs font-bold uppercase tracking-wide">TOSCANA</span>
                    </label>

                    <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                      propRegioneTipo === 'ALTRO'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}>
                      <input
                        type="checkbox"
                        disabled={!puoModificare}
                        checked={propRegioneTipo === 'ALTRO'}
                        onChange={() => {
                          if (propRegioneTipo === 'ALTRO') {
                            setPropRegioneTipo('');
                          } else {
                            setPropRegioneTipo('ALTRO');
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer accent-amber-500"
                      />
                      <span className="text-xs font-bold uppercase tracking-wide">ALTRO</span>
                    </label>
                  </div>

                  {propRegioneTipo === 'ALTRO' && (
                    <div className="pt-1">
                      <label className="text-[10px] font-bold text-slate-300 uppercase block mb-1">
                        Specifica Regione
                      </label>
                      <input
                        type="text"
                        disabled={!puoModificare}
                        placeholder="Scrivi la regione (es. Liguria, Emilia-Romagna, Lombardia...)"
                        value={propRegioneAltro}
                        onChange={(e) => setPropRegioneAltro(e.target.value)}
                        className="w-full p-2 rounded-xl bg-slate-950 border border-amber-500/70 text-amber-200 placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={propNome}
                      onChange={(e) => setPropNome(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Cognome
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={propCognome}
                      onChange={(e) => setPropCognome(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Telefono
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={propTelefono}
                      onChange={(e) => setPropTelefono(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      disabled={!puoModificare}
                      value={propEmail}
                      onChange={(e) => setPropEmail(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Codice Fiscale
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={propCF}
                      onChange={(e) => setPropCF(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs uppercase focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Indirizzo Residenza
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={propIndirizzo}
                      onChange={(e) => setPropIndirizzo(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Comune
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={propComune}
                      onChange={(e) => setPropComune(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Provincia / CAP
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        disabled={!puoModificare}
                        value={propProvincia}
                        onChange={(e) => setPropProvincia(e.target.value)}
                        placeholder="MS"
                        className="w-14 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white font-mono text-xs text-center uppercase focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        disabled={!puoModificare}
                        value={propCap}
                        onChange={(e) => setPropCap(e.target.value)}
                        placeholder="54100"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEZIONE 3: VOLONTARIO & EQUIPAGGIO (BORDO MEZZO) */}
          {sezioneAttiva === 'volontario' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Nome Capo Turno / Volontario</span>
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={volontarioNome}
                    onChange={(e) => setVolontarioNome(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <span>Telefono Volontario</span>
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={volontarioTelefono}
                    onChange={(e) => setVolontarioTelefono(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Qualifica Turno
                  </label>
                  <input
                    type="text"
                    disabled={!puoModificare}
                    value={qualificaTurno}
                    onChange={(e) => setQualificaTurno(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SEZIONE 4: ORARI OPERATIVI, KM & DESTINAZIONE (VOLONTARIO) */}
          {sezioneAttiva === 'tempi_km' && (
            <div className="space-y-4 animate-fadeIn">
              {/* ORARI CRONOLOGICI OPERATIVI */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Cronologia Orari Operativi (Compilati dal Volontario a Bordo Mezzo)</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      1. Partenza Sede
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={orarioPartenza}
                      onChange={(e) => setOrarioPartenza(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      2. Sul Posto
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={orarioSulPosto}
                      onChange={(e) => setOrarioSulPosto(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      3. Part. Obiettivo
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={orarioPartenzaObiettivo}
                      onChange={(e) => setOrarioPartenzaObiettivo(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      4. A Destinazione
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={orarioArrivoDestinazione}
                      onChange={(e) => setOrarioArrivoDestinazione(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      5. Fine Missione
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={orarioFineMissione}
                      onChange={(e) => setOrarioFineMissione(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      6. Rientro Sede
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={orarioRientro}
                      onChange={(e) => setOrarioRientro(e.target.value)}
                      placeholder="HH:mm"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* CHILOMETRAGGIO MEZZO */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>Chilometraggio Mezzo</span>
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-amber-400">
                    <input
                      type="checkbox"
                      disabled={!puoModificare}
                      checked={inAttesaKm}
                      onChange={(e) => setInAttesaKm(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-400"
                    />
                    <span>Stato: In Attesa KM (Blocca PDF)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      KM Inizio Servizio
                    </label>
                    <input
                      type="number"
                      disabled={!puoModificare}
                      value={kmInizio}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setKmInizio(val);
                        if (val > 0 && kmFine > 0) setInAttesaKm(false);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      KM Fine Servizio
                    </label>
                    <input
                      type="number"
                      disabled={!puoModificare}
                      value={kmFine}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setKmFine(val);
                        if (val > 0 && kmInizio > 0) setInAttesaKm(false);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      KM Totali Percorsi
                    </label>
                    <div className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold text-xs flex items-center justify-between">
                      <span>{kmTotaliCalcolati} KM</span>
                      <span className="text-[10px] text-slate-500">Auto-calcolato</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONSEGNA CLINICA & DONAZIONE */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 block">
                  {isVetMissione ? 'Struttura Ricevente & Consegna Animale' : 'Destinazione & Consegna Servizio'}
                </span>
                {isVetMissione ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        Struttura / Clinica Veterinaria
                      </label>
                      <input
                        type="text"
                        disabled={!puoModificare}
                        value={strutturaRicevente}
                        onChange={(e) => setStrutturaRicevente(e.target.value)}
                        placeholder="es. Clinica Veterinaria Apuana..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        Medico Veterinario di Turno
                      </label>
                      <input
                        type="text"
                        disabled={!puoModificare}
                        value={medicoVeterinario}
                        onChange={(e) => setMedicoVeterinario(e.target.value)}
                        placeholder="Dott. / Dott.ssa..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        Ente / Presidio / Referente alla Destinazione
                      </label>
                      <input
                        type="text"
                        disabled={!puoModificare}
                        value={strutturaRicevente}
                        onChange={(e) => setStrutturaRicevente(e.target.value)}
                        placeholder="es. Sede COM, Magazzino Protezione Civile, Ospedale, Sala Operativa..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {isVetMissione && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Note Cliniche alla Consegna
                    </label>
                    <input
                      type="text"
                      disabled={!puoModificare}
                      value={noteCliniche}
                      onChange={(e) => setNoteCliniche(e.target.value)}
                      placeholder="Condizioni dell'animale al momento della presa in carico..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                )}

                {/* DONAZIONE */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-300">
                    <input
                      type="checkbox"
                      disabled={!puoModificare}
                      checked={donazioneRicevuta}
                      onChange={(e) => setDonazioneRicevuta(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700 focus:ring-purple-400"
                    />
                    <HeartHandshake className="w-4 h-4 text-purple-400" />
                    <span>Donazione Ricevuta a Bordo Mezzo</span>
                  </label>
                  {donazioneRicevuta && (
                    <div className="w-full space-y-3 pt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400 font-bold">€</span>
                          <input
                            type="number"
                            disabled={!puoModificare}
                            value={donazioneSomma || ''}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setDonazioneSomma(v);
                              if (v > 0 && !donazioneRicevuta) setDonazioneRicevuta(true);
                            }}
                            placeholder="Importo (€)..."
                            className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
                          />
                        </div>
                        {/* Importi precaricati a 1 clic */}
                        <div className="flex items-center gap-1">
                          {[10, 20, 50, 100].map((imp) => (
                            <button
                              key={imp}
                              type="button"
                              disabled={!puoModificare}
                              onClick={() => {
                                setDonazioneSomma(imp);
                                if (!donazioneRicevuta) setDonazioneRicevuta(true);
                              }}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                donazioneSomma === imp
                                  ? 'bg-purple-600 text-white border-purple-400'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              €{imp}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* LE DUE CASELLE DIFFERENTI DA FREGARE (CONTANTI / POS) */}
                      <div className={`p-3 rounded-xl border transition-all ${
                        (donazioneSomma > 0 && !donazioneMetodo)
                          ? 'bg-amber-950/40 border-amber-500/80'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}>
                        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 flex-wrap gap-1">
                          <label className="text-[11px] font-black uppercase text-amber-300 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                            <span>Dichiarazione Pagamento Donazione</span>
                            <span className="text-red-400">*</span>
                          </label>
                          {donazioneSomma > 0 && !donazioneMetodo ? (
                            <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                              ⚠️ Spunta obbligatoria
                            </span>
                          ) : donazioneMetodo ? (
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>{donazioneMetodo === 'contanti' ? 'Contanti' : donazioneMetodo === 'pos' ? 'POS Elettronico' : donazioneMetodo}</span>
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* CASELLA 1: CONTANTI */}
                          <div
                            onClick={() => {
                              if (!puoModificare) return;
                              setDonazioneMetodo(prev => prev === 'contanti' ? '' : 'contanti');
                            }}
                            className={`p-2.5 rounded-xl border cursor-pointer select-none flex items-center gap-2.5 transition-all ${
                              donazioneMetodo === 'contanti'
                                ? 'bg-emerald-950/60 border-emerald-400 shadow-sm ring-1 ring-emerald-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!puoModificare}
                              checked={donazioneMetodo === 'contanti'}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-400 cursor-pointer accent-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <Banknote className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Contanti</span>
                              </div>
                              <span className="text-[9.5px] text-slate-400 block truncate">Ricevuta cartacea di bordo</span>
                            </div>
                          </div>

                          {/* CASELLA 2: POS */}
                          <div
                            onClick={() => {
                              if (!puoModificare) return;
                              setDonazioneMetodo(prev => prev === 'pos' ? '' : 'pos');
                            }}
                            className={`p-2.5 rounded-xl border cursor-pointer select-none flex items-center gap-2.5 transition-all ${
                              donazioneMetodo === 'pos'
                                ? 'bg-blue-950/60 border-blue-400 shadow-sm ring-1 ring-blue-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!puoModificare}
                              checked={donazioneMetodo === 'pos'}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-400 cursor-pointer accent-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>POS Elettronico</span>
                              </div>
                              <span className="text-[9.5px] text-slate-400 block truncate">Terminale POS di bordo</span>
                            </div>
                          </div>

                          {metodiDonazioneCustom.map((m) => {
                            const val = formattaEtichettaMetodoPagamento(m);
                            const isSel = donazioneMetodo === val;
                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  if (!puoModificare) return;
                                  setDonazioneMetodo((prev) => (prev === val ? '' : val));
                                }}
                                className={`p-2.5 rounded-xl border cursor-pointer select-none flex items-center gap-2.5 transition-all ${
                                  isSel
                                    ? 'bg-purple-950/60 border-purple-400 shadow-sm ring-1 ring-purple-400 text-white'
                                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={!puoModificare}
                                  checked={isSel}
                                  onChange={() => {}}
                                  className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-400 cursor-pointer accent-purple-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                    <CreditCard className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <span className="truncate">{m.nome}</span>
                                  </div>
                                  <span className="text-[9.5px] text-slate-400 block truncate">
                                    {m.coordinateODettagli || 'Metodo personalizzato'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {donazioneSomma > 0 && !donazioneMetodo && (
                          <div className="mt-2 p-2 rounded-lg bg-red-950/60 border border-red-500/50 text-red-200 text-[10.5px] font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>È obbligatorio selezionare un metodo di pagamento donazione!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SEZIONE 5: MANOVRE EFFETTUATE / PATOLOGIE (COMPILATO DAL VOLONTARIO) */}
          {sezioneAttiva === 'note_manovre' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
                  <Stethoscope className="w-4 h-4" />
                  <span>MANOVRE EFFETTUATE / PATOLOGIE (NOTE OPERATIVE E CLINICHE SUL SERVIZIO)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Campo compilabile autonomamente dal volontario a bordo mezzo o modificabile dall&apos;operatore di centrale mittente se vi sono note integrative da riportare sul servizio effettuato (es. manovre sanitarie, patologie riscontrate, parametri vitali rilevati). Se compilato, questo campo viene incluso anche sul file PDF della scheda generata.
                </p>
                <textarea
                  rows={6}
                  disabled={!puoModificare}
                  value={manovreEffettuatePatologie}
                  onChange={(e) => setManovreEffettuatePatologie(e.target.value)}
                  placeholder="Inserisci eventuali manovre sanitarie effettuate, patologie riscontrate o note sul servizio effettuato..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs leading-relaxed focus:ring-2 focus:ring-emerald-400 focus:outline-none resize-y"
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER AZIONI */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Annulla
          </button>

          {puoModificare && (
            <button
              type="button"
              onClick={handleSalva}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salva Modifiche nel Database</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
