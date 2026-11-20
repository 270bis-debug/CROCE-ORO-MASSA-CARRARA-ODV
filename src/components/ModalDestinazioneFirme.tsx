import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  User,
  Phone,
  Mail,
  Home,
  HeartHandshake,
  Stethoscope,
  Building,
  CheckCircle2,
  Check,
  X,
  Search,
  AlertTriangle,
  CreditCard,
  Banknote,
  Navigation,
  Lock,
  QrCode,
  Calendar,
  FileBadge,
  Camera,
  Trash2,
  Eye
} from 'lucide-react';
import { SignaturePad } from './SignaturePad';
import { PROVINCE_ITALIANE } from '../data/provinceItaliane';
import { LISTA_ANIMALI_VOLONTARIO, DatiProprietarioCentrale, FotoDocumentoIdentita } from '../data/animali';
import { formatDateTimeItaly, formatTimeItaly } from '../utils/italianTime';
import { useMetodiPagamentoCustom, formattaEtichettaMetodoPagamento } from '../utils/metodiPagamentoStore';

export interface ComuneItaliano {
  nome: string;
  sigla: string;
  cap: string;
}

export interface DatiDestinazione {
  animale?: {
    tipo: string;
    tipoAltro?: string;
    microchip?: string;
    noMicrochip?: boolean;
    nonDiProprieta?: boolean;
    anagrafeRegione?: 'TOSCANA' | 'LIGURIA' | 'ALTRA REGIONE' | string;
    anagrafeAltraRegione?: string;
  };
  proprietario: {
    nome: string;
    cognome: string;
    indirizzo: string;
    cap: string;
    comune: string;
    provincia: string;
    telefono: string;
    email: string;
    nonHaEmail?: boolean;
    codiceFiscale?: string;
    dataNascita?: string;
    regioneTipo?: 'TOSCANA' | 'ALTRO' | '';
    regioneAltro?: string;
    regione?: string;
    note?: string;
    coincideConChiamante?: boolean;
  };
  fotoDocumento?: FotoDocumentoIdentita;
  donazione: {
    ricevuta: boolean;
    somma: number;
    metodo: string;
    tipoDonatore?: 'proprietario' | 'chiamante' | 'altra_persona';
    donatoreAltro?: {
      nome?: string;
      cognome?: string;
      codiceFiscale?: string;
      telefono?: string;
      indirizzo?: string;
    };
  };
  firmaProprietario: string | null;
  strutturaVeterinaria: {
    isVeterinario: boolean;
    nomeStrutturaOVeterinario: string;
    nomeVeterinario?: string;
    firmaVeterinario: string | null;
    tipoRuolo?: 'partenza' | 'destinazione' | 'entrambe';
    partenza?: {
      nomeStruttura: string;
      nomeVeterinario?: string;
      firmaVeterinario: string | null;
    };
    destinazione?: {
      nomeStruttura: string;
      nomeVeterinario?: string;
      firmaVeterinario: string | null;
    };
  };
  coordinateCertificazione?: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: string;
  };
  manovreEffettuatePatologie?: string;
}

interface ModalDestinazioneFirmeProps {
  isOpen: boolean;
  onClose: () => void;
  codiceMissione: string;
  destinazioneAssegnata?: string;
  ambitoMissione?: string;
  coordinateDestinazione?: { lat: number; lng: number; accuracy?: number; time?: string } | null;
  initialDati?: DatiDestinazione | null;
  initialManovre?: string;
  onSalva: (dati: DatiDestinazione) => void;
  isArrivatoDestinazione?: boolean;
  chiamanteMissione?: {
    nome?: string;
    telefono?: string;
    indirizzo?: string;
    enteIstituzionale?: string;
  };
  animaleMissione?: {
    tipo?: string;
    tipoAltro?: string;
    nonDiProprieta?: boolean;
    microchip?: string;
    noMicrochip?: boolean;
    impostoDaCentrale?: boolean;
  };
  datiProprietarioCentrale?: DatiProprietarioCentrale | null;
  fotoDocumento?: FotoDocumentoIdentita;
  onSalvaFotoDocumento?: (tipo: 'fronte' | 'retro', base64: string) => void;
  onRimuoviFotoDocumento?: (tipo: 'fronte' | 'retro') => void;
  isStrutturaVeterinariaCentrale?: boolean;
  indirizzoPartenza?: string;
  isStrutturaVeterinariaPartenza?: boolean;
  isSulPosto?: boolean;
  isCapoServizio?: boolean;
  capoServizioNome?: string;
}

let cacheComuni: ComuneItaliano[] | null = null;

export const ModalDestinazioneFirme: React.FC<ModalDestinazioneFirmeProps> = ({
  isOpen,
  onClose,
  codiceMissione,
  destinazioneAssegnata = '',
  ambitoMissione = '',
  coordinateDestinazione,
  initialDati,
  initialManovre,
  onSalva,
  isArrivatoDestinazione = false,
  chiamanteMissione,
  animaleMissione,
  datiProprietarioCentrale,
  fotoDocumento,
  onSalvaFotoDocumento,
  onRimuoviFotoDocumento,
  isStrutturaVeterinariaCentrale,
  indirizzoPartenza = '',
  isStrutturaVeterinariaPartenza,
  isSulPosto = false,
  isCapoServizio = false,
  capoServizioNome = ''
}) => {
  // Lista Comuni Italiani caricata da /data/comuni_italiani.json
  const [listaComuni, setListaComuni] = useState<ComuneItaliano[]>(cacheComuni || []);
  const [comuneSearch, setComuneSearch] = useState('');
  const [menuComuneAperto, setMenuComuneAperto] = useState(false);
  const containerComuneRef = useRef<HTMLDivElement | null>(null);

  // --- SEZIONE 1: ANIMALE RECUPERATO ---
  const tipoDaCentrale = Boolean(animaleMissione?.impostoDaCentrale && animaleMissione?.tipo);
  const [tipoAnimale, setTipoAnimale] = useState<string>(
    initialDati?.animale?.tipo || animaleMissione?.tipo || 'Cane'
  );
  const [tipoAnimaleAltro, setTipoAnimaleAltro] = useState<string>(
    initialDati?.animale?.tipoAltro || animaleMissione?.tipoAltro || ''
  );
  const [microchip, setMicrochip] = useState<string>(
    initialDati?.animale?.microchip || animaleMissione?.microchip || ''
  );
  const [noMicrochip, setNoMicrochip] = useState<boolean>(
    initialDati?.animale?.noMicrochip ?? (animaleMissione?.noMicrochip || false)
  );
  const [nonDiProprieta, setNonDiProprieta] = useState<boolean>(
    initialDati?.animale?.nonDiProprieta ?? (animaleMissione?.nonDiProprieta || false)
  );

  // --- SEZIONE 2: PROPRIETARIO / INTESTATARIO MICROCHIP ---
  const [coincideConChiamante, setCoincideConChiamante] = useState<boolean>(
    initialDati?.proprietario?.coincideConChiamante || false
  );
  const [nome, setNome] = useState(initialDati?.proprietario?.nome || datiProprietarioCentrale?.nome || '');
  const [cognome, setCognome] = useState(initialDati?.proprietario?.cognome || datiProprietarioCentrale?.cognome || '');
  const [indirizzo, setIndirizzo] = useState(initialDati?.proprietario?.indirizzo || datiProprietarioCentrale?.indirizzo || '');
  const [cap, setCap] = useState(initialDati?.proprietario?.cap || datiProprietarioCentrale?.cap || '');
  const [comune, setComune] = useState(initialDati?.proprietario?.comune || datiProprietarioCentrale?.comune || '');
  const [provincia, setProvincia] = useState(initialDati?.proprietario?.provincia || datiProprietarioCentrale?.provincia || 'MS');
  const [telefono, setTelefono] = useState(initialDati?.proprietario?.telefono || datiProprietarioCentrale?.telefono || '');
  const [codiceFiscale, setCodiceFiscale] = useState(initialDati?.proprietario?.codiceFiscale || datiProprietarioCentrale?.codiceFiscale || '');
  const [dataNascita, setDataNascita] = useState(initialDati?.proprietario?.dataNascita || datiProprietarioCentrale?.dataNascita || '');
  const [email, setEmail] = useState(
    initialDati?.proprietario?.email && initialDati.proprietario.email !== 'Non presente'
      ? initialDati.proprietario.email
      : (datiProprietarioCentrale?.email || '')
  );
  const [nonHaEmail, setNonHaEmail] = useState<boolean>(
    Boolean(
      initialDati?.proprietario?.nonHaEmail ||
      initialDati?.proprietario?.email === 'Non presente' ||
      datiProprietarioCentrale?.nonHaEmail
    )
  );
  const [noteProprietario, setNoteProprietario] = useState<string>(
    initialDati?.proprietario?.note || datiProprietarioCentrale?.note || ''
  );
  const [regioneTipo, setRegioneTipo] = useState<'TOSCANA' | 'ALTRO' | ''>(() => {
    if (initialDati?.proprietario?.regioneTipo) return initialDati.proprietario.regioneTipo;
    if (initialDati?.proprietario?.regione === 'TOSCANA') return 'TOSCANA';
    if (initialDati?.proprietario?.regione) return 'ALTRO';
    if (datiProprietarioCentrale?.regioneTipo) return datiProprietarioCentrale.regioneTipo;
    if (datiProprietarioCentrale?.regione === 'TOSCANA') return 'TOSCANA';
    if (datiProprietarioCentrale?.regione) return 'ALTRO';
    return '';
  });
  const [regioneAltro, setRegioneAltro] = useState<string>(() => {
    if (initialDati?.proprietario?.regioneAltro) return initialDati.proprietario.regioneAltro;
    if (initialDati?.proprietario?.regione && initialDati.proprietario.regione !== 'TOSCANA') return initialDati.proprietario.regione;
    if (datiProprietarioCentrale?.regioneAltro) return datiProprietarioCentrale.regioneAltro;
    if (datiProprietarioCentrale?.regione && datiProprietarioCentrale.regione !== 'TOSCANA') return datiProprietarioCentrale.regione;
    return '';
  });
  const [manovreEffettuatePatologie, setManovreEffettuatePatologie] = useState<string>(
    initialDati?.manovreEffettuatePatologie || initialManovre || ''
  );

  // --- FOTO DOCUMENTO DI IDENTITÀ INTESTATARIO (FRONTE E RETRO) ---
  const [fotoDocFronte, setFotoDocFronte] = useState<string | undefined>(
    initialDati?.fotoDocumento?.fronte || fotoDocumento?.fronte || datiProprietarioCentrale?.fotoDocumento?.fronte
  );
  const [fotoDocRetro, setFotoDocRetro] = useState<string | undefined>(
    initialDati?.fotoDocumento?.retro || fotoDocumento?.retro || datiProprietarioCentrale?.fotoDocumento?.retro
  );
  const [dataAcquisizioneDoc, setDataAcquisizioneDoc] = useState<string | undefined>(
    initialDati?.fotoDocumento?.dataAcquisizione || fotoDocumento?.dataAcquisizione || datiProprietarioCentrale?.fotoDocumento?.dataAcquisizione
  );
  const [fotoDocPreviewModal, setFotoDocPreviewModal] = useState<{ url: string; titolo: string } | null>(null);

  const metodiPagamentoCustom = useMetodiPagamentoCustom();
  const metodiDonazioneCustom = useMemo(
    () => metodiPagamentoCustom.filter((m) => m.attivo && (m.tipo === 'entrambi' || m.tipo === 'donazioni')),
    [metodiPagamentoCustom]
  );

  // --- SEZIONE 3: DONAZIONE ---
  const [haDonazione, setHaDonazione] = useState<boolean>(initialDati?.donazione?.ricevuta || false);
  const [sommaDonata, setSommaDonata] = useState<string>(
    initialDati?.donazione?.somma ? String(initialDati.donazione.somma) : ''
  );
  const [metodoDonazione, setMetodoDonazione] = useState<string>(
    initialDati?.donazione?.metodo || ''
  );
  const [tipoDonatore, setTipoDonatore] = useState<'proprietario' | 'chiamante' | 'altra_persona'>(
    initialDati?.donazione?.tipoDonatore || 'proprietario'
  );
  const [donatoreAltroNome, setDonatoreAltroNome] = useState(initialDati?.donazione?.donatoreAltro?.nome || '');
  const [donatoreAltroCognome, setDonatoreAltroCognome] = useState(initialDati?.donazione?.donatoreAltro?.cognome || '');
  const [donatoreAltroCF, setDonatoreAltroCF] = useState(initialDati?.donazione?.donatoreAltro?.codiceFiscale || '');
  const [donatoreAltroTelefono, setDonatoreAltroTelefono] = useState(initialDati?.donazione?.donatoreAltro?.telefono || '');
  const [donatoreAltroIndirizzo, setDonatoreAltroIndirizzo] = useState(initialDati?.donazione?.donatoreAltro?.indirizzo || '');

  // --- SEZIONE 4: FIRME & DESTINAZIONE / PARTENZA ---
  const [firmaProprietario, setFirmaProprietario] = useState<string | null>(
    initialDati?.firmaProprietario || null
  );

  // Rilevamento se veterinario per destinazione
  const sembraVeterinarioDestinazione = useMemo(() => {
    const text = `${destinazioneAssegnata} ${ambitoMissione}`.toLowerCase();
    return (
      text.includes('vet') ||
      text.includes('clinica') ||
      text.includes('ambulatorio') ||
      text.includes('dott') ||
      text.includes('dr.') ||
      text.includes('dr ') ||
      text.includes('medico') ||
      text.includes('ospedale')
    );
  }, [destinazioneAssegnata, ambitoMissione]);

  // Rilevamento se veterinario per obiettivo di partenza
  const sembraVeterinarioPartenza = useMemo(() => {
    const text = `${indirizzoPartenza || ''}`.toLowerCase();
    return (
      text.includes('vet') ||
      text.includes('clinica') ||
      text.includes('ambulatorio') ||
      text.includes('dott') ||
      text.includes('dr.') ||
      text.includes('dr ') ||
      text.includes('medico') ||
      text.includes('ospedale')
    );
  }, [indirizzoPartenza]);

  // Verifica blocchi imposti dalla Centrale per Destinazione e per Partenza
  const isDestinazioneVetBloccata = useMemo(() => {
    if (isStrutturaVeterinariaCentrale === true) return true;
    if (isStrutturaVeterinariaCentrale === false) return false;
    return Boolean(destinazioneAssegnata && sembraVeterinarioDestinazione);
  }, [isStrutturaVeterinariaCentrale, destinazioneAssegnata, sembraVeterinarioDestinazione]);

  const isPartenzaVetBloccata = useMemo(() => {
    if (isStrutturaVeterinariaPartenza === true) return true;
    if (isStrutturaVeterinariaPartenza === false) return false;
    return Boolean(indirizzoPartenza && sembraVeterinarioPartenza);
  }, [isStrutturaVeterinariaPartenza, indirizzoPartenza, sembraVeterinarioPartenza]);

  const isPartenzaVet = isPartenzaVetBloccata || isStrutturaVeterinariaPartenza === true;
  const isDestinazioneVet = isDestinazioneVetBloccata || isStrutturaVeterinariaCentrale === true;
  const isEntrambeVet = isPartenzaVet && isDestinazioneVet;
  const isSoloPartenzaVet = isPartenzaVet && !isDestinazioneVet;

  // Ruolo attivo: se l'obiettivo di partenza è un veterinario, le regole cambiano la parola destinazione con partenza
  const ruoloVeterinario: 'partenza' | 'destinazione' | 'entrambe' = useMemo(() => {
    if (isEntrambeVet) return 'entrambe';
    if (isSoloPartenzaVet) return 'partenza';
    if (isDestinazioneVet) return 'destinazione';
    if (sembraVeterinarioPartenza && !sembraVeterinarioDestinazione) return 'partenza';
    return 'destinazione';
  }, [isEntrambeVet, isSoloPartenzaVet, isDestinazioneVet, sembraVeterinarioPartenza, sembraVeterinarioDestinazione]);

  // Se la centrale indica una Clinica/Ambulatorio/Dottore (sia partenza che destinazione):
  // il pulsante struttura veterinaria è già selezionato di default e NON deselezionabile dal volontario.
  const isStrutturaVeterinariaBloccata = useMemo(() => {
    if (ruoloVeterinario === 'partenza') return isPartenzaVetBloccata;
    if (ruoloVeterinario === 'entrambe') return isPartenzaVetBloccata || isDestinazioneVetBloccata;
    return isDestinazioneVetBloccata;
  }, [ruoloVeterinario, isPartenzaVetBloccata, isDestinazioneVetBloccata]);

  const isDefaultVet = useMemo(() => {
    if (isStrutturaVeterinariaCentrale === true || isStrutturaVeterinariaPartenza === true) return true;
    if (isStrutturaVeterinariaCentrale === false && isStrutturaVeterinariaPartenza === false) return false;
    if (initialDati?.strutturaVeterinaria?.isVeterinario !== undefined) {
      return initialDati.strutturaVeterinaria.isVeterinario;
    }
    return Boolean(sembraVeterinarioDestinazione || sembraVeterinarioPartenza);
  }, [isStrutturaVeterinariaCentrale, isStrutturaVeterinariaPartenza, initialDati?.strutturaVeterinaria?.isVeterinario, sembraVeterinarioDestinazione, sembraVeterinarioPartenza]);

  const [isVeterinario, setIsVeterinario] = useState<boolean>(isDefaultVet);

  // Dati Struttura Veterinaria (Generale / Unificata o Partenza)
  const [nomeStrutturaOVeterinario, setNomeStrutturaOVeterinario] = useState<string>(
    (ruoloVeterinario === 'partenza' ? indirizzoPartenza : destinazioneAssegnata) ||
    initialDati?.strutturaVeterinaria?.nomeStrutturaOVeterinario || ''
  );
  const [nomeVeterinario, setNomeVeterinario] = useState<string>(
    initialDati?.strutturaVeterinaria?.nomeVeterinario || ''
  );
  const [firmaVeterinario, setFirmaVeterinario] = useState<string | null>(
    initialDati?.strutturaVeterinaria?.firmaVeterinario || null
  );

  // Dati specifici distinti nel caso di sia Partenza che Destinazione contemporaneamente
  const [nomeVeterinarioPartenza, setNomeVeterinarioPartenza] = useState<string>(
    initialDati?.strutturaVeterinaria?.partenza?.nomeVeterinario ||
    (isSoloPartenzaVet ? initialDati?.strutturaVeterinaria?.nomeVeterinario : '') || ''
  );
  const [firmaVeterinarioPartenza, setFirmaVeterinarioPartenza] = useState<string | null>(
    initialDati?.strutturaVeterinaria?.partenza?.firmaVeterinario ||
    (isSoloPartenzaVet ? initialDati?.strutturaVeterinaria?.firmaVeterinario : null) || null
  );

  const [nomeVeterinarioDest, setNomeVeterinarioDest] = useState<string>(
    initialDati?.strutturaVeterinaria?.destinazione?.nomeVeterinario ||
    (!isSoloPartenzaVet ? initialDati?.strutturaVeterinaria?.nomeVeterinario : '') || ''
  );
  const [firmaVeterinarioDest, setFirmaVeterinarioDest] = useState<string | null>(
    initialDati?.strutturaVeterinaria?.destinazione?.firmaVeterinario ||
    (!isSoloPartenzaVet ? initialDati?.strutturaVeterinaria?.firmaVeterinario : null) || null
  );

  const [notificaModificaCentrale, setNotificaModificaCentrale] = useState<string | null>(null);
  const prevDestRef = useRef<string>(destinazioneAssegnata || '');
  const prevVetFlagRef = useRef<boolean | undefined>(isStrutturaVeterinariaCentrale);
  const prevPartenzaRef = useRef<string>(indirizzoPartenza || '');
  const prevVetPartenzaFlagRef = useRef<boolean | undefined>(isStrutturaVeterinariaPartenza);

  // Aggiornamento in tempo reale se la Centrale Operativa reinvia/modifica destinazione o obiettivo di partenza
  // o toglie/mette i rispettivi flag Struttura Veterinaria
  // IMPORTANTE: Aggiorna SOLO la struttura e il vincolo veterinario SENZA resettare né perdere nessun dato, orario, firma o documento inserito dal volontario!
  useEffect(() => {
    if (ruoloVeterinario === 'partenza') {
      if (indirizzoPartenza) setNomeStrutturaOVeterinario(indirizzoPartenza);
    } else {
      if (destinazioneAssegnata) setNomeStrutturaOVeterinario(destinazioneAssegnata);
    }

    // Se la centrale forza o revoca il flag di partenza o destinazione
    if (isStrutturaVeterinariaCentrale === true || isStrutturaVeterinariaPartenza === true) {
      setIsVeterinario(true);
    } else if (isStrutturaVeterinariaCentrale === false && isStrutturaVeterinariaPartenza === false) {
      setIsVeterinario(false);
    } else if (ruoloVeterinario === 'partenza') {
      if (isStrutturaVeterinariaPartenza === false) setIsVeterinario(false);
      else if (indirizzoPartenza) setIsVeterinario(sembraVeterinarioPartenza);
    } else {
      if (isStrutturaVeterinariaCentrale === false) setIsVeterinario(false);
      else if (destinazioneAssegnata) setIsVeterinario(sembraVeterinarioDestinazione);
    }

    // Rileva modifiche alla destinazione da Centrale
    const destCambiata = prevDestRef.current && prevDestRef.current !== destinazioneAssegnata;
    const flagCambiato = prevVetFlagRef.current !== undefined && prevVetFlagRef.current !== isStrutturaVeterinariaCentrale;
    if (destCambiata || flagCambiato) {
      const statoVet = isStrutturaVeterinariaCentrale === true
        ? 'Struttura Veterinaria obbligatoria (bloccata)'
        : isStrutturaVeterinariaCentrale === false
        ? 'Struttura Veterinaria rimossa/sbloccata'
        : (sembraVeterinarioDestinazione ? 'Struttura Veterinaria' : 'Altra Destinazione');
      setNotificaModificaCentrale(
        `Centrale Operativa ha aggiornato la destinazione: "${destinazioneAssegnata || 'Non indicata'}" (${statoVet}). Tutti i tuoi dati e orari già inseriti sono stati mantenuti!`
      );
    }

    // Rileva modifiche all'obiettivo di partenza da Centrale
    const partCambiata = prevPartenzaRef.current && prevPartenzaRef.current !== indirizzoPartenza;
    const flagPartCambiato = prevVetPartenzaFlagRef.current !== undefined && prevVetPartenzaFlagRef.current !== isStrutturaVeterinariaPartenza;
    if (partCambiata || flagPartCambiato) {
      const statoVetPart = isStrutturaVeterinariaPartenza === true
        ? 'Struttura Veterinaria di Partenza obbligatoria (bloccata)'
        : isStrutturaVeterinariaPartenza === false
        ? 'Struttura Veterinaria di Partenza rimossa/sbloccata'
        : (sembraVeterinarioPartenza ? 'Struttura Veterinaria di Partenza' : 'Altro Luogo di Partenza');
      setNotificaModificaCentrale(
        `Centrale Operativa ha aggiornato l'obiettivo di partenza: "${indirizzoPartenza || 'Non indicato'}" (${statoVetPart}). Tutti i tuoi dati e orari già inseriti sono stati mantenuti!`
      );
    }

    prevDestRef.current = destinazioneAssegnata || '';
    prevVetFlagRef.current = isStrutturaVeterinariaCentrale;
    prevPartenzaRef.current = indirizzoPartenza || '';
    prevVetPartenzaFlagRef.current = isStrutturaVeterinariaPartenza;
  }, [destinazioneAssegnata, isStrutturaVeterinariaCentrale, sembraVeterinarioDestinazione, indirizzoPartenza, isStrutturaVeterinariaPartenza, sembraVeterinarioPartenza, ruoloVeterinario]);

  const [erroreValidazione, setErroreValidazione] = useState<string | null>(null);

  // Caricamento dei comuni da file JSON se non già in cache
  useEffect(() => {
    if (cacheComuni && cacheComuni.length > 0) {
      setListaComuni(cacheComuni);
      return;
    }

    fetch('/data/comuni_italiani.json')
      .then((res) => res.json())
      .then((data: ComuneItaliano[]) => {
        cacheComuni = data;
        setListaComuni(data);
      })
      .catch((err) => {
        console.warn('Impossibile caricare /data/comuni_italiani.json:', err);
      });
  }, []);

  // Aggiorna valori se cambiano initialDati o datiProprietarioCentrale o animaleMissione
  useEffect(() => {
    if (initialDati) {
      if (initialDati.animale) {
        setTipoAnimale(initialDati.animale.tipo || animaleMissione?.tipo || 'Cane');
        setTipoAnimaleAltro(initialDati.animale.tipoAltro || animaleMissione?.tipoAltro || '');
        setMicrochip(initialDati.animale.microchip || animaleMissione?.microchip || '');
        setNoMicrochip(Boolean(initialDati.animale.noMicrochip ?? animaleMissione?.noMicrochip));
        setNonDiProprieta(Boolean(initialDati.animale.nonDiProprieta ?? animaleMissione?.nonDiProprieta));
      } else if (animaleMissione) {
        if (animaleMissione.tipo) setTipoAnimale(animaleMissione.tipo);
        if (animaleMissione.tipoAltro) setTipoAnimaleAltro(animaleMissione.tipoAltro);
        if (animaleMissione.microchip) setMicrochip(animaleMissione.microchip);
        if (animaleMissione.noMicrochip) setNoMicrochip(true);
        if (animaleMissione.nonDiProprieta) setNonDiProprieta(true);
      }
      setNome(initialDati.proprietario.nome || datiProprietarioCentrale?.nome || '');
      setCognome(initialDati.proprietario.cognome || datiProprietarioCentrale?.cognome || '');
      setIndirizzo(initialDati.proprietario.indirizzo || datiProprietarioCentrale?.indirizzo || '');
      setCap(initialDati.proprietario.cap || datiProprietarioCentrale?.cap || '');
      setComune(initialDati.proprietario.comune || datiProprietarioCentrale?.comune || '');
      setProvincia(initialDati.proprietario.provincia || datiProprietarioCentrale?.provincia || 'MS');
      setTelefono(initialDati.proprietario.telefono || datiProprietarioCentrale?.telefono || '');
      setCodiceFiscale(initialDati.proprietario.codiceFiscale || datiProprietarioCentrale?.codiceFiscale || '');
      setDataNascita(initialDati.proprietario.dataNascita || datiProprietarioCentrale?.dataNascita || '');
      setNoteProprietario(initialDati.proprietario.note || datiProprietarioCentrale?.note || '');
      setCoincideConChiamante(Boolean(initialDati.proprietario.coincideConChiamante));

      const regT = initialDati.proprietario.regioneTipo ||
        (initialDati.proprietario.regione === 'TOSCANA' ? 'TOSCANA' : (initialDati.proprietario.regione ? 'ALTRO' : '')) ||
        datiProprietarioCentrale?.regioneTipo ||
        (datiProprietarioCentrale?.regione === 'TOSCANA' ? 'TOSCANA' : (datiProprietarioCentrale?.regione ? 'ALTRO' : '')) ||
        '';
      setRegioneTipo(regT as any);
      setRegioneAltro(
        initialDati.proprietario.regioneAltro ||
        (initialDati.proprietario.regione && initialDati.proprietario.regione !== 'TOSCANA' ? initialDati.proprietario.regione : '') ||
        datiProprietarioCentrale?.regioneAltro ||
        (datiProprietarioCentrale?.regione && datiProprietarioCentrale.regione !== 'TOSCANA' ? datiProprietarioCentrale.regione : '') ||
        ''
      );

      const privoEmail = Boolean(
        initialDati.proprietario.nonHaEmail ||
        initialDati.proprietario.email === 'Non presente' ||
        datiProprietarioCentrale?.nonHaEmail
      );
      setNonHaEmail(privoEmail);
      setEmail(privoEmail ? '' : (initialDati.proprietario.email || datiProprietarioCentrale?.email || ''));
      setHaDonazione(Boolean(initialDati.donazione?.ricevuta));
      setSommaDonata(initialDati.donazione?.somma ? String(initialDati.donazione.somma) : '');
      setMetodoDonazione(initialDati.donazione?.metodo || '');
      setTipoDonatore(initialDati.donazione?.tipoDonatore || 'proprietario');
      if (initialDati.donazione?.donatoreAltro) {
        setDonatoreAltroNome(initialDati.donazione.donatoreAltro.nome || '');
        setDonatoreAltroCognome(initialDati.donazione.donatoreAltro.cognome || '');
        setDonatoreAltroCF(initialDati.donazione.donatoreAltro.codiceFiscale || '');
        setDonatoreAltroTelefono(initialDati.donazione.donatoreAltro.telefono || '');
        setDonatoreAltroIndirizzo(initialDati.donazione.donatoreAltro.indirizzo || '');
      }
      setFirmaProprietario(initialDati.firmaProprietario || null);
      if (isStrutturaVeterinariaCentrale === undefined && isStrutturaVeterinariaPartenza === undefined) {
        setIsVeterinario(initialDati.strutturaVeterinaria?.isVeterinario ?? (sembraVeterinarioDestinazione || sembraVeterinarioPartenza));
      }
      if (!destinazioneAssegnata && !indirizzoPartenza) {
        setNomeStrutturaOVeterinario(initialDati.strutturaVeterinaria?.nomeStrutturaOVeterinario || '');
      }
      setNomeVeterinario(initialDati.strutturaVeterinaria?.nomeVeterinario || '');
      setFirmaVeterinario(initialDati.strutturaVeterinaria?.firmaVeterinario || null);
      if (initialDati.strutturaVeterinaria?.partenza) {
        setNomeVeterinarioPartenza(initialDati.strutturaVeterinaria.partenza.nomeVeterinario || '');
        setFirmaVeterinarioPartenza(initialDati.strutturaVeterinaria.partenza.firmaVeterinario || null);
      }
      if (initialDati.strutturaVeterinaria?.destinazione) {
        setNomeVeterinarioDest(initialDati.strutturaVeterinaria.destinazione.nomeVeterinario || '');
        setFirmaVeterinarioDest(initialDati.strutturaVeterinaria.destinazione.firmaVeterinario || null);
      }
      if (initialDati.manovreEffettuatePatologie) {
        setManovreEffettuatePatologie(initialDati.manovreEffettuatePatologie);
      } else if (initialManovre) {
        setManovreEffettuatePatologie(initialManovre);
      }
    } else {
      // Se la centrale ha passato dati anagrafici del proprietario del microchip, precaricali!
      if (datiProprietarioCentrale) {
        if (datiProprietarioCentrale.nome) setNome(datiProprietarioCentrale.nome);
        if (datiProprietarioCentrale.cognome) setCognome(datiProprietarioCentrale.cognome);
        if (datiProprietarioCentrale.indirizzo) setIndirizzo(datiProprietarioCentrale.indirizzo);
        if (datiProprietarioCentrale.comune) setComune(datiProprietarioCentrale.comune);
        if (datiProprietarioCentrale.provincia) setProvincia(datiProprietarioCentrale.provincia);
        if (datiProprietarioCentrale.cap) setCap(datiProprietarioCentrale.cap);
        if (datiProprietarioCentrale.telefono) setTelefono(datiProprietarioCentrale.telefono);
        if (datiProprietarioCentrale.codiceFiscale) setCodiceFiscale(datiProprietarioCentrale.codiceFiscale);
        if (datiProprietarioCentrale.dataNascita) setDataNascita(datiProprietarioCentrale.dataNascita);
        if (datiProprietarioCentrale.email) setEmail(datiProprietarioCentrale.email);
        if (datiProprietarioCentrale.nonHaEmail) setNonHaEmail(true);
        if (datiProprietarioCentrale.note) setNoteProprietario(datiProprietarioCentrale.note);
        if (datiProprietarioCentrale.regioneTipo) setRegioneTipo(datiProprietarioCentrale.regioneTipo);
        else if (datiProprietarioCentrale.regione === 'TOSCANA') setRegioneTipo('TOSCANA');
        else if (datiProprietarioCentrale.regione) {
          setRegioneTipo('ALTRO');
          setRegioneAltro(datiProprietarioCentrale.regione);
        }
        if (datiProprietarioCentrale.regioneAltro) setRegioneAltro(datiProprietarioCentrale.regioneAltro);
      }
      if (animaleMissione) {
        if (animaleMissione.tipo) setTipoAnimale(animaleMissione.tipo);
        if (animaleMissione.tipoAltro) setTipoAnimaleAltro(animaleMissione.tipoAltro);
        if (animaleMissione.microchip) setMicrochip(animaleMissione.microchip);
        if (animaleMissione.noMicrochip) setNoMicrochip(true);
        if (animaleMissione.nonDiProprieta) setNonDiProprieta(true);
      }
    }
  }, [initialDati, datiProprietarioCentrale, animaleMissione, initialManovre]);

  useEffect(() => {
    const srcDoc = initialDati?.fotoDocumento || fotoDocumento || datiProprietarioCentrale?.fotoDocumento;
    if (srcDoc) {
      if (srcDoc.fronte) setFotoDocFronte(srcDoc.fronte);
      if (srcDoc.retro) setFotoDocRetro(srcDoc.retro);
      if (srcDoc.dataAcquisizione) setDataAcquisizioneDoc(srcDoc.dataAcquisizione);
    }
  }, [initialDati, fotoDocumento, datiProprietarioCentrale]);

  const handleCaricaFotoDocModal = (tipo: 'fronte' | 'retro', file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        const nowStr = formatDateTimeItaly();

        if (tipo === 'fronte') {
          setFotoDocFronte(compressedBase64);
        } else {
          setFotoDocRetro(compressedBase64);
        }
        setDataAcquisizioneDoc(nowStr);

        if (onSalvaFotoDocumento) {
          onSalvaFotoDocumento(tipo, compressedBase64);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleRimuoviFotoDocModal = (tipo: 'fronte' | 'retro') => {
    if (tipo === 'fronte') {
      setFotoDocFronte(undefined);
    } else {
      setFotoDocRetro(undefined);
    }
    if (onRimuoviFotoDocumento) {
      onRimuoviFotoDocumento(tipo);
    }
  };

  // Gestione checkbox "Il chiamante è il proprietario"
  const handleToggleCoincideConChiamante = (checked: boolean) => {
    setCoincideConChiamante(checked);
    if (checked && chiamanteMissione) {
      if (chiamanteMissione.nome) {
        const parts = chiamanteMissione.nome.trim().split(/\s+/);
        if (parts.length > 1) {
          setNome(parts[0]);
          setCognome(parts.slice(1).join(' '));
        } else {
          setNome(chiamanteMissione.nome);
        }
      }
      if (chiamanteMissione.telefono && (!telefono || telefono === '-')) {
        setTelefono(chiamanteMissione.telefono);
      }
      if (chiamanteMissione.indirizzo && (!indirizzo || indirizzo.includes('Massa Carrara'))) {
        setIndirizzo(chiamanteMissione.indirizzo);
      }
    }
  };

  // Chiudi dropdown comuni quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerComuneRef.current && !containerComuneRef.current.contains(e.target as Node)) {
        setMenuComuneAperto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtra i comuni in base alla ricerca (minimo 1 lettera)
  const comuniFiltrati = useMemo(() => {
    const q = (comuneSearch || comune || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      if (provincia) {
        return listaComuni.filter((c) => c.sigla === provincia).slice(0, 30);
      }
      return listaComuni.slice(0, 20);
    }
    return listaComuni
      .filter((c) => c.nome.toLowerCase().includes(q))
      .slice(0, 35);
  }, [listaComuni, comuneSearch, comune, provincia]);

  if (!isOpen) return null;

  const handleSelezionaComune = (item: ComuneItaliano) => {
    setComune(item.nome);
    setComuneSearch(item.nome);
    setProvincia(item.sigla);
    if (item.cap && !cap) {
      setCap(item.cap);
    }
    setMenuComuneAperto(false);
  };

  const handleImportaDatiInDonatoreAltro = () => {
    // Importa i dati già presenti (dal proprietario o chiamante)
    if (nome || cognome) {
      setDonatoreAltroNome(nome);
      setDonatoreAltroCognome(cognome);
      setDonatoreAltroCF(codiceFiscale);
      setDonatoreAltroTelefono(telefono);
      setDonatoreAltroIndirizzo(indirizzo);
    } else if (chiamanteMissione?.nome) {
      const parts = chiamanteMissione.nome.trim().split(/\s+/);
      setDonatoreAltroNome(parts[0] || '');
      setDonatoreAltroCognome(parts.slice(1).join(' ') || '');
      setDonatoreAltroTelefono(chiamanteMissione.telefono || '');
    }
  };

  const handleSalvaScheda = () => {
    setErroreValidazione(null);

    // 1. Validazione Tipo Animale (Obbligatorio)
    const effTipoAnimale = tipoDaCentrale ? (animaleMissione?.tipo || tipoAnimale) : tipoAnimale;
    if (!effTipoAnimale || !effTipoAnimale.trim()) {
      setErroreValidazione("Il tipo di animale recuperato è un dato obbligatorio!");
      return;
    }
    if (effTipoAnimale === 'Altro' && (!tipoAnimaleAltro || !tipoAnimaleAltro.trim())) {
      setErroreValidazione("Hai selezionato 'Altro': specifica il tipo di animale recuperato!");
      return;
    }

    // Se è Cane o Gatto: verifica microchip o casella NO MICROCHIP
    const isCaneOGatto = effTipoAnimale.toLowerCase().includes('cane') || effTipoAnimale.toLowerCase().includes('gatto');
    if (isCaneOGatto) {
      if (!noMicrochip && (!microchip || !microchip.trim())) {
        setErroreValidazione("Per Cane o Gatto devi inserire il numero di microchip oppure flaggare la casella 'NO MICROCHIP'!");
        return;
      }
    }

    // 2. Validazione Dati Proprietario / Intestatario
    if (!nome.trim()) {
      setErroreValidazione("Il campo Nome del proprietario/intestatario è obbligatorio!");
      return;
    }
    if (!cognome.trim()) {
      setErroreValidazione("Il campo Cognome del proprietario/intestatario è obbligatorio!");
      return;
    }
    if (!indirizzo.trim()) {
      setErroreValidazione("Il campo Indirizzo di residenza del proprietario è obbligatorio!");
      return;
    }
    if (!comune.trim()) {
      setErroreValidazione("Il campo Comune di residenza del proprietario è obbligatorio!");
      return;
    }
    if (!provincia.trim()) {
      setErroreValidazione("Il campo Sigla Provincia del proprietario è obbligatorio!");
      return;
    }
    if (!cap.trim() || cap.trim().length !== 5 || !/^\d{5}$/.test(cap.trim())) {
      setErroreValidazione("Il campo CAP è obbligatorio e deve contenere 5 cifre numeriche!");
      return;
    }
    if (!telefono.trim() || telefono.trim().length < 6) {
      setErroreValidazione("Il campo Numero di Telefono del proprietario è obbligatorio!");
      return;
    }

    if (!nonHaEmail) {
      if (!email.trim()) {
        setErroreValidazione("Il campo Indirizzo Email è obbligatorio, oppure spunta la casella 'Non ha email'!");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErroreValidazione("Inserisci un Indirizzo Email valido (es. nome@dominio.it), oppure spunta la casella 'Non ha email'!");
        return;
      }
    }

    if (!firmaProprietario) {
      setErroreValidazione("È obbligatorio far apporre la firma al proprietario/intestatario sul display!");
      return;
    }

    // Validazione Regione Microchip (se flaggato ALTRO, il volontario deve scrivere la regione)
    if (regioneTipo === 'ALTRO' && (!regioneAltro || !regioneAltro.trim())) {
      setErroreValidazione("Hai selezionato 'ALTRO' per la regione dell'anagrafe microchip: specifica la regione!");
      return;
    }

    // Validazione Destinazione / Partenza & Firma Clinica se sul posto o arrivato a destinazione
    if (isVeterinario) {
      if (ruoloVeterinario === 'partenza') {
        const strutturaEffettivaPartenza = (indirizzoPartenza || nomeStrutturaOVeterinario || '').trim();
        if ((isSulPosto || isArrivatoDestinazione) && isPartenzaVetBloccata) {
          if (!strutturaEffettivaPartenza) {
            setErroreValidazione("Sei sul posto: nessuna struttura veterinaria di partenza risulta assegnata dalla Centrale Operativa!");
            return;
          }
          const firmaPartenza = firmaVeterinarioPartenza || firmaVeterinario;
          if (!firmaPartenza) {
            setErroreValidazione("È obbligatorio far apporre la firma al veterinario della struttura di partenza!");
            return;
          }
        }
      } else if (ruoloVeterinario === 'destinazione') {
        const strutturaEffettivaDest = (destinazioneAssegnata || nomeStrutturaOVeterinario || '').trim();
        if (isArrivatoDestinazione && isDestinazioneVetBloccata) {
          if (!strutturaEffettivaDest) {
            setErroreValidazione("Sei arrivato a destinazione: nessuna struttura veterinaria risulta assegnata dalla Centrale Operativa!");
            return;
          }
          const firmaDest = firmaVeterinarioDest || firmaVeterinario;
          if (!firmaDest) {
            setErroreValidazione("Sei arrivato a destinazione: è obbligatorio far apporre la firma al veterinario ricevente prima di Fine Missione!");
            return;
          }
        }
      } else {
        // entrambe
        if ((isSulPosto || isArrivatoDestinazione) && isPartenzaVetBloccata && !firmaVeterinarioPartenza && !firmaVeterinario) {
          setErroreValidazione("È obbligatorio far apporre la firma al veterinario della struttura di partenza!");
          return;
        }
        if (isArrivatoDestinazione && isDestinazioneVetBloccata && !firmaVeterinarioDest && !firmaVeterinario) {
          setErroreValidazione("Sei arrivato a destinazione: è obbligatorio far apporre la firma al veterinario ricevente prima di Fine Missione!");
          return;
        }
      }
    }

    // Validazione donazione: se viene inserito l'importo della donazione dal volontario, è OBBLIGATORIO dichiarare se in Contanti o con POS
    const importoDonazioneNum = parseFloat(sommaDonata) || 0;
    if (haDonazione || importoDonazioneNum > 0) {
      if (importoDonazioneNum <= 0) {
        setErroreValidazione("Hai selezionato 'Donazione Ricevuta': inserisci la somma donata in Euro (es. € 20, € 50)!");
        return;
      }
      if (!metodoDonazione || !metodoDonazione.trim()) {
        setErroreValidazione(
          `Hai inserito un importo di donazione di € ${importoDonazioneNum.toFixed(2)}: devi obbligatoriamente dichiarare il metodo di donazione (Contanti, POS o altro metodo configurato) spuntando una delle apposite caselle!`
        );
        return;
      }
    }

    // Validazione donatore se altra persona
    if (haDonazione && tipoDonatore === 'altra_persona') {
      if (!donatoreAltroNome.trim() || !donatoreAltroCognome.trim()) {
        setErroreValidazione("Hai selezionato 'Altra persona' come donatore: inserisci almeno Nome e Cognome del donatore!");
        return;
      }
    }

    // Regola collaborativa: i dati già compilati da altri volontari possono essere modificati SOLO dal Capo Servizio.
    // Un volontario non Capo Servizio può compilare tutti i campi ancora vuoti ma non sovrascrivere quelli già inseriti.
    const preserveText = (existing: string | undefined, nextVal: string): string => {
      if (!isCapoServizio && existing && existing.trim() !== '') {
        return existing;
      }
      return nextVal;
    };
    const preserveOptText = (existing: string | undefined, nextVal: string | undefined): string | undefined => {
      if (!isCapoServizio && existing && existing.trim() !== '') {
        return existing;
      }
      return nextVal;
    };
    const preserveSig = (existing: string | null | undefined, nextVal: string | null): string | null => {
      if (!isCapoServizio && existing) {
        return existing;
      }
      return nextVal;
    };

    const existingProp = initialDati?.proprietario;
    const existingAnim = initialDati?.animale;
    const existingDon = initialDati?.donazione;
    const existingVet = initialDati?.strutturaVeterinaria;

    const finalDonazione =
      !isCapoServizio && existingDon && (existingDon.ricevuta || (existingDon.somma && existingDon.somma > 0))
        ? existingDon
        : {
            ricevuta: haDonazione && (parseFloat(sommaDonata) > 0),
            somma: (haDonazione && parseFloat(sommaDonata) > 0) ? (parseFloat(sommaDonata) || 0) : 0,
            metodo: (haDonazione && parseFloat(sommaDonata) > 0) ? (metodoDonazione || '') : '',
            tipoDonatore: (haDonazione && parseFloat(sommaDonata) > 0) ? tipoDonatore : undefined,
            donatoreAltro: (haDonazione && parseFloat(sommaDonata) > 0 && tipoDonatore === 'altra_persona')
              ? {
                  nome: donatoreAltroNome.trim(),
                  cognome: donatoreAltroCognome.trim(),
                  codiceFiscale: donatoreAltroCF.trim() || undefined,
                  telefono: donatoreAltroTelefono.trim() || undefined,
                  indirizzo: donatoreAltroIndirizzo.trim() || undefined
                }
              : undefined
          };

    const payload: DatiDestinazione = {
      animale: {
        tipo: preserveText(existingAnim?.tipo, effTipoAnimale),
        tipoAltro: preserveOptText(existingAnim?.tipoAltro, effTipoAnimale === 'Altro' ? tipoAnimaleAltro.trim() : undefined),
        microchip: preserveText(existingAnim?.microchip, noMicrochip ? 'NO MICROCHIP' : microchip.trim()),
        noMicrochip: !isCapoServizio && existingAnim?.microchip ? Boolean(existingAnim.noMicrochip) : noMicrochip,
        nonDiProprieta: !isCapoServizio && existingAnim?.nonDiProprieta !== undefined ? existingAnim.nonDiProprieta : nonDiProprieta,
        anagrafeRegione: preserveOptText(
          existingAnim?.anagrafeRegione,
          regioneTipo === 'TOSCANA' ? 'TOSCANA' : (regioneTipo === 'ALTRO' ? (regioneAltro.trim() || 'ALTRA REGIONE') : undefined)
        ),
        anagrafeAltraRegione: preserveOptText(existingAnim?.anagrafeAltraRegione, regioneTipo === 'ALTRO' ? regioneAltro.trim() : undefined)
      },
      proprietario: {
        nome: preserveText(existingProp?.nome, nome.trim()),
        cognome: preserveText(existingProp?.cognome, cognome.trim()),
        indirizzo: preserveText(existingProp?.indirizzo, indirizzo.trim()),
        cap: preserveText(existingProp?.cap, cap.trim()),
        comune: preserveText(existingProp?.comune, comune.trim()),
        provincia: preserveText(existingProp?.provincia, provincia.trim()),
        telefono: preserveText(existingProp?.telefono, telefono.trim()),
        email: preserveText(existingProp?.email, nonHaEmail ? 'Non presente' : email.trim()),
        nonHaEmail: !isCapoServizio && existingProp?.email ? Boolean(existingProp.nonHaEmail) : nonHaEmail,
        codiceFiscale: preserveOptText(existingProp?.codiceFiscale, codiceFiscale.trim() || undefined),
        dataNascita: preserveOptText(existingProp?.dataNascita, dataNascita.trim() || undefined),
        regioneTipo: (!isCapoServizio && existingProp?.regioneTipo ? existingProp.regioneTipo : (regioneTipo || undefined)) as any,
        regioneAltro: preserveOptText(existingProp?.regioneAltro, regioneTipo === 'ALTRO' ? regioneAltro.trim() : undefined),
        regione: preserveOptText(
          existingProp?.regione,
          regioneTipo === 'TOSCANA' ? 'TOSCANA' : (regioneTipo === 'ALTRO' ? (regioneAltro.trim() || 'ALTRO') : undefined)
        ),
        note: preserveOptText(existingProp?.note, noteProprietario.trim() || undefined),
        coincideConChiamante: !isCapoServizio && existingProp?.coincideConChiamante !== undefined ? existingProp.coincideConChiamante : coincideConChiamante
      },
      fotoDocumento: (fotoDocFronte || fotoDocRetro) ? {
        fronte: preserveOptText(initialDati?.fotoDocumento?.fronte, fotoDocFronte),
        retro: preserveOptText(initialDati?.fotoDocumento?.retro, fotoDocRetro),
        dataAcquisizione: initialDati?.fotoDocumento?.dataAcquisizione || dataAcquisizioneDoc || formatDateTimeItaly()
      } : initialDati?.fotoDocumento,
      donazione: finalDonazione,
      firmaProprietario: preserveSig(initialDati?.firmaProprietario, firmaProprietario),
      strutturaVeterinaria: {
        isVeterinario,
        nomeStrutturaOVeterinario: isVeterinario
          ? (ruoloVeterinario === 'partenza' ? (indirizzoPartenza || nomeStrutturaOVeterinario) : (destinazioneAssegnata || nomeStrutturaOVeterinario))
          : '',
        nomeVeterinario: preserveText(
          existingVet?.nomeVeterinario,
          (ruoloVeterinario === 'partenza' ? (nomeVeterinarioPartenza || nomeVeterinario) : (nomeVeterinarioDest || nomeVeterinario)).trim()
        ),
        firmaVeterinario: isVeterinario
          ? preserveSig(
              existingVet?.firmaVeterinario,
              ruoloVeterinario === 'partenza' ? (firmaVeterinarioPartenza || firmaVeterinario) : (firmaVeterinarioDest || firmaVeterinario)
            )
          : null,
        tipoRuolo: ruoloVeterinario,
        partenza: isPartenzaVet ? {
          nomeStruttura: indirizzoPartenza || '',
          nomeVeterinario: preserveText(existingVet?.partenza?.nomeVeterinario, (nomeVeterinarioPartenza || nomeVeterinario).trim()),
          firmaVeterinario: preserveSig(existingVet?.partenza?.firmaVeterinario, firmaVeterinarioPartenza || firmaVeterinario)
        } : undefined,
        destinazione: isDestinazioneVet ? {
          nomeStruttura: destinazioneAssegnata || '',
          nomeVeterinario: preserveText(existingVet?.destinazione?.nomeVeterinario, (nomeVeterinarioDest || nomeVeterinario).trim()),
          firmaVeterinario: preserveSig(existingVet?.destinazione?.firmaVeterinario, firmaVeterinarioDest || firmaVeterinario)
        } : undefined
      },
      coordinateCertificazione: coordinateDestinazione
        ? {
            lat: coordinateDestinazione.lat,
            lng: coordinateDestinazione.lng,
            accuracy: coordinateDestinazione.accuracy,
            timestamp: coordinateDestinazione.time || formatTimeItaly()
          }
        : initialDati?.coordinateCertificazione,
      manovreEffettuatePatologie: preserveOptText(initialDati?.manovreEffettuatePatologie, manovreEffettuatePatologie.trim() || undefined)
    };

    onSalva(payload);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modale */}
        <div className="p-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm uppercase tracking-wide text-white">
                  {isArrivatoDestinazione ? 'Arrivo a Destinazione - Scheda Consegna Animale & Firme' : 'Arrivo Sul Posto - Dati Animale, Proprietario, Donazione & Firma'}
                </h2>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded">
                  {codiceMissione}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isArrivatoDestinazione
                  ? 'Firme proprietario e clinica/veterinario obbligatorie prima di Fine Missione'
                  : 'Rilevamento dati animale, intestatario, donazione e firma in attesa di destinazione da Centrale'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Indicatore di Fase Operativa */}
        <div className={`mx-4 mt-3 p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
          isArrivatoDestinazione
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
            : 'bg-blue-950/40 border-blue-500/50 text-blue-200'
        }`}>
          <span className="text-base shrink-0">{isArrivatoDestinazione ? '🏥' : '📍'}</span>
          <div>
            <strong>{isArrivatoDestinazione ? 'Fase: Arrivo a Destinazione / Clinica Ricevente' : 'Fase: Sul Posto (In attesa invio Destinazione da Centrale)'}</strong>
            <p className="opacity-90 mt-0.5 leading-snug">
              {isArrivatoDestinazione
                ? 'La firma del proprietario e la firma del veterinario/clinica sono entrambe OBBLIGATORIE per poter completare la missione.'
                : 'Inserisci i dati dell\'animale, i dati del proprietario/intestatario (anche recuperabili dal chiamante), eventuale donazione e fai apporre la firma sul display.'}
            </p>
          </div>
        </div>

        {/* Banner Permessi Collaborativi Equipaggio / Capo Servizio */}
        <div
          className={`mx-4 mt-2 p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
            isCapoServizio
              ? 'bg-amber-950/50 border-amber-400/60 text-amber-100'
              : 'bg-indigo-950/50 border-indigo-500/50 text-indigo-100'
          }`}
        >
          <Lock className={`w-4 h-4 shrink-0 ${isCapoServizio ? 'text-amber-400' : 'text-indigo-400'}`} />
          <span>
            {isCapoServizio ? (
              <>
                <strong>⭐ Capo Servizio ({capoServizioNome || 'Tu'}):</strong> puoi compilare e modificare tutti i dati della scheda (i tuoi aggiornamenti si sincronizzano automaticamente su tutti i dispositivi dell'equipaggio).
              </>
            ) : (
              <>
                <strong>Compilazione Collaborativa Live:</strong> puoi compilare tutti i campi ancora vuoti. I campi già compilati da altri volontari sono sincronizzati in tempo reale e possono essere modificati <strong>solo dal Capo Servizio</strong>
                {capoServizioNome ? ` (${capoServizioNome})` : ''}.
              </>
            )}
          </span>
        </div>

        {/* Banner Dati Precaricati da Centrale */}
        {datiProprietarioCentrale?.nome && (
          <div className="mx-4 mt-2 p-2 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 text-xs flex items-center gap-2">
            <span className="text-base">📋</span>
            <span>
              <strong>Dati anagrafici intestatario microchip precaricati dalla Centrale Operativa:</strong> i campi anagrafici sono stati compilati automaticamente dall'anagrafe. Integra solo i dati mancanti.
            </span>
          </div>
        )}

        {/* Coordinate GPS Certificate Banner */}
        {coordinateDestinazione && (
          <div className="bg-emerald-950/70 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 shrink-0">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>
                <strong>Certificazione GPS Arrivo:</strong> Lat {coordinateDestinazione.lat.toFixed(5)}°, Lng {coordinateDestinazione.lng.toFixed(5)}°
                {coordinateDestinazione.accuracy && ` (±${coordinateDestinazione.accuracy}m)`}
              </span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-300">
              {coordinateDestinazione.time || 'Certificato'}
            </span>
          </div>
        )}

        {/* Corpo Scrollabile */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-200">
          {erroreValidazione && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-semibold">{erroreValidazione}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEZIONE 1: DATI DELL'ANIMALE RECUPERATO E TRASPORTATO    */}
          {/* ======================================================== */}
          <div className="bg-slate-950/80 border-2 border-amber-500/60 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🐾</span>
                <h3 className="font-black uppercase tracking-wide text-amber-300 text-xs">
                  1. Dati dell'Animale Recuperato e Trasportato
                </h3>
              </div>

              {nonDiProprieta ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                  Animale NON di Proprietà
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 border border-emerald-700">
                  Animale di Proprietà
                </span>
              )}
            </div>

            {/* Scelta Tipo Animale (Bloccato se la centrale lo ha indicato) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-slate-300 flex items-center gap-1">
                  Tipo di Animale <span className="text-red-400">*</span>
                </label>
                {tipoDaCentrale ? (
                  <span className="text-[9.5px] font-bold text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-700/60 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-cyan-400" />
                    Indicato dalla Centrale (Non modificabile)
                  </span>
                ) : (
                  <span className="text-[9.5px] text-amber-400 font-semibold">
                    Obbligatorio
                  </span>
                )}
              </div>

              {tipoDaCentrale ? (
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white font-bold flex items-center justify-between">
                  <span>{tipoAnimale} {tipoAnimaleAltro ? `(${tipoAnimaleAltro})` : ''}</span>
                  <span className="text-slate-400 text-[10px] font-normal italic">Trasmesso da Centrale</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {LISTA_ANIMALI_VOLONTARIO.map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setTipoAnimale(tipo)}
                        className={`py-2 px-2 rounded-xl font-black text-xs border transition-all text-center ${
                          tipoAnimale === tipo
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {tipo === 'Cane' ? '🐶 Cane' : tipo === 'Gatto' ? '🐱 Gatto' : '🐾 Altro'}
                      </button>
                    ))}
                  </div>

                  {tipoAnimale === 'Altro' && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Specifica tipo di animale <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Furetto, Coniglio, Volatile, ecc."
                        value={tipoAnimaleAltro}
                        onChange={(e) => setTipoAnimaleAltro(e.target.value)}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rilevazione Microchip o Flag NO MICROCHIP (Se Cane o Gatto) */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-slate-300 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Numero Microchip (15 cifre ISO)</span>
                  {(tipoAnimale.toLowerCase().includes('cane') || tipoAnimale.toLowerCase().includes('gatto')) && (
                    <span className="text-red-400">*</span>
                  )}
                </label>
                <span className="text-[9.5px] text-slate-400 font-mono">Transponder sottocutaneo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  disabled={noMicrochip}
                  placeholder={noMicrochip ? "Nessun microchip presente" : "Es. 380260042819231"}
                  value={noMicrochip ? "" : microchip}
                  onChange={(e) => setMicrochip(e.target.value.replace(/\s+/g, ''))}
                  className={`w-full p-2 rounded-lg border font-mono text-xs transition-all ${
                    noMicrochip
                      ? 'bg-slate-950/60 border-slate-800 text-slate-500 cursor-not-allowed italic'
                      : 'bg-slate-900 border-slate-700 text-amber-300 font-bold focus:ring-1 focus:ring-amber-500'
                  }`}
                />

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={noMicrochip}
                    onChange={(e) => {
                      setNoMicrochip(e.target.checked);
                      if (e.target.checked) setMicrochip('');
                    }}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer accent-amber-500"
                  />
                  <span className="font-bold text-amber-300 text-xs">
                    🚫 NO MICROCHIP
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SEZIONE 2: DATI DEL PROPRIETARIO / INTESTATARIO MICROCHIP */}
          {/* ======================================================== */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                <h3 className="font-black uppercase tracking-wide text-white text-xs">
                  2. Dati del Proprietario / Intestatario Microchip
                </h3>
              </div>

              {/* Casella "Il chiamante è il proprietario" - solo per cittadini privati */}
              {chiamanteMissione?.nome && !chiamanteMissione?.enteIstituzionale && !['Polizia di Stato', 'Carabinieri', 'Polizia Locale', 'Vigili del Fuoco', 'NUE112', 'Capitaneria di Porto', 'Carabinieri Forestali', 'Guardia di Finanza', 'Guardie Zoofile EkoClub', 'Vab Carrara', 'Vab Massa'].includes(chiamanteMissione.nome) ? (
                <label className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10.5px] cursor-pointer select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={coincideConChiamante}
                    onChange={(e) => handleToggleCoincideConChiamante(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-amber-500 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer accent-amber-500"
                  />
                  <span className="font-bold">
                    🔄 Il chiamante è il proprietario ({chiamanteMissione.nome})
                  </span>
                </label>
              ) : (chiamanteMissione?.enteIstituzionale || (chiamanteMissione?.nome && ['Polizia di Stato', 'Carabinieri', 'Polizia Locale', 'Vigili del Fuoco', 'NUE112', 'Capitaneria di Porto', 'Carabinieri Forestali', 'Guardia di Finanza', 'Guardie Zoofile EkoClub', 'Vab Carrara', 'Vab Massa'].includes(chiamanteMissione.nome))) ? (
                <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-300 text-[10.5px]">
                  <span className="text-xs">🛡️</span>
                  <span>Chiamata da: <strong>{chiamanteMissione.enteIstituzionale || chiamanteMissione.nome}</strong> (Ente Istituzionale)</span>
                </div>
              ) : null}
            </div>

            {/* Selezione Regione Anagrafe Microchip: TOSCANA / ALTRO */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                  <span>🏛️ Regione Anagrafe Microchip</span>
                </label>
                <span className="text-[9.5px] text-slate-400 font-mono">Banca Dati Territoriale</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Casella flaggabile TOSCANA */}
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all ${
                  regioneTipo === 'TOSCANA'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-sm shadow-amber-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={regioneTipo === 'TOSCANA'}
                    onChange={() => {
                      if (regioneTipo === 'TOSCANA') {
                        setRegioneTipo('');
                      } else {
                        setRegioneTipo('TOSCANA');
                        setRegioneAltro('');
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer accent-amber-500"
                  />
                  <span className="text-xs font-bold uppercase tracking-wide">TOSCANA</span>
                </label>

                {/* Casella flaggabile ALTRO */}
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all ${
                  regioneTipo === 'ALTRO'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-sm shadow-amber-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={regioneTipo === 'ALTRO'}
                    onChange={() => {
                      if (regioneTipo === 'ALTRO') {
                        setRegioneTipo('');
                      } else {
                        setRegioneTipo('ALTRO');
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900 cursor-pointer accent-amber-500"
                  />
                  <span className="text-xs font-bold uppercase tracking-wide">ALTRO</span>
                </label>
              </div>

              {/* Se selezionato ALTRO: il volontario dovrà scrivere la regione */}
              {regioneTipo === 'ALTRO' && (
                <div className="pt-1">
                  <label className="text-[10px] font-bold uppercase text-slate-300 block mb-1">
                    Specifica Regione <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Scrivi la regione (es. Liguria, Emilia-Romagna, Lombardia...)"
                    value={regioneAltro}
                    onChange={(e) => setRegioneAltro(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-950 border border-amber-500/70 text-amber-200 placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Es. Mario"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Cognome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Es. Rossi"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Codice Fiscale & Data di Nascita */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <FileBadge className="w-3 h-3 text-slate-400" /> Codice Fiscale
                </label>
                <input
                  type="text"
                  placeholder="Es. RSSMRA80A01E625X"
                  value={codiceFiscale}
                  onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  maxLength={16}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono uppercase placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Data di Nascita
                </label>
                <input
                  type="text"
                  placeholder="GG/MM/AAAA (es. 15/05/1980)"
                  value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                <Home className="w-3 h-3 text-slate-400" /> Indirizzo di Residenza <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Es. Via Roma, 15"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Comune con Ricerca dinamica + Sigla Provincia (107 province) + CAP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Menu a tendina Comune */}
              <div className="relative sm:col-span-1" ref={containerComuneRef}>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <Search className="w-3 h-3 text-slate-400" /> Comune <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cerca comune (es. Massa)..."
                    value={comuneSearch || comune}
                    onChange={(e) => {
                      setComuneSearch(e.target.value);
                      setComune(e.target.value);
                      setMenuComuneAperto(true);
                    }}
                    onFocus={() => setMenuComuneAperto(true)}
                    className="w-full p-2 pr-7 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                  />
                  {comune && (
                    <button
                      type="button"
                      onClick={() => {
                        setComune('');
                        setComuneSearch('');
                      }}
                      className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Comuni */}
                {menuComuneAperto && comuniFiltrati.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-800">
                    {comuniFiltrati.map((item, idx) => (
                      <button
                        key={`${item.nome}-${item.sigla}-${idx}`}
                        type="button"
                        onClick={() => handleSelezionaComune(item)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 transition-colors flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-white">{item.nome}</span>
                        <span className="text-[10px] font-mono text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {item.sigla} {item.cap ? `(${item.cap})` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sigla Provincia */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Sigla Provincia <span className="text-red-400">*</span>
                </label>
                <select
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                >
                  <option value="">-- Seleziona --</option>
                  {PROVINCE_ITALIANE.map((p) => (
                    <option key={p.sigla} value={p.sigla}>
                      {p.sigla} - {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* CAP */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  CAP <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="Es. 54100"
                  value={cap}
                  onChange={(e) => setCap(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Telefono ed Email con casella 'Non ha email' */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> Numero di Telefono <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="Es. 333 1234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" /> Indirizzo Email <span className="text-red-400">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-amber-300 hover:text-amber-200 select-none bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700">
                    <input
                      type="checkbox"
                      checked={nonHaEmail}
                      onChange={(e) => {
                        setNonHaEmail(e.target.checked);
                        if (e.target.checked) setEmail('');
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950 cursor-pointer"
                    />
                    <span className="font-semibold">Non ha email</span>
                  </label>
                </div>
                <input
                  type="email"
                  disabled={nonHaEmail}
                  placeholder={nonHaEmail ? "Dichiara di non possedere email" : "Es. nome@example.com"}
                  value={nonHaEmail ? "" : email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs transition-all ${
                    nonHaEmail
                      ? 'bg-slate-950/80 border-slate-800 text-amber-400/80 cursor-not-allowed italic'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                />
              </div>
            </div>

            {/* Note Intestatario / Recapiti aggiuntivi */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Eventuali Note Intestatario / Recapiti Aggiuntivi
              </label>
              <input
                type="text"
                placeholder="Es. Reperibile solo nel pomeriggio, citofono scala B, indicazioni del veterinario..."
                value={noteProprietario}
                onChange={(e) => setNoteProprietario(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              />
            </div>

            {/* SEZIONE FOTO DOCUMENTO DI IDENTITÀ ESIBITO (DAVANTI E RETRO) */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-700/80">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 uppercase tracking-wide">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Foto Documento di Identità Esibito (Davanti e Retro)</span>
                </div>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Consigliato (Non Obbligatorio)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Se l'intestatario o chi per esso esibisce il documento di identità (carta d'identità, patente, passaporto), il volontario può scattare una foto del <strong>davanti</strong> e una del <strong>retro</strong>. Verranno salvate e allegate al PDF per la Centrale.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. FRONTE (DAVANTI) */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300 flex items-center gap-1">
                      <span>🪪</span> Davanti (Fronte)
                    </span>
                    {fotoDocFronte && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                        Acquisito
                      </span>
                    )}
                  </div>

                  {fotoDocFronte ? (
                    <div className="space-y-2">
                      <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-black/60 max-h-36 flex items-center justify-center">
                        <img
                          src={fotoDocFronte}
                          alt="Fronte Documento"
                          className="w-full h-32 object-cover rounded-lg cursor-pointer transition-transform hover:scale-105"
                          onClick={() => setFotoDocPreviewModal({ url: fotoDocFronte, titolo: "Davanti del Documento di Identità (Fronte)" })}
                        />
                        <button
                          type="button"
                          onClick={() => setFotoDocPreviewModal({ url: fotoDocFronte, titolo: "Davanti del Documento di Identità (Fronte)" })}
                          className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-black text-white text-[10px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-amber-300" />
                          <span>Ingrandisci</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold text-center cursor-pointer border border-slate-700 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCaricaFotoDocModal('fronte', file);
                              e.target.value = '';
                            }}
                          />
                          <span>Sostituisci</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRimuoviFotoDocModal('fronte')}
                          className="py-1.5 px-2 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-600/50 text-red-300 text-[10.5px] font-bold flex items-center gap-1 transition-colors"
                          title="Elimina foto fronte"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Elimina</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.99]">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCaricaFotoDocModal('fronte', file);
                            e.target.value = '';
                          }}
                        />
                        <Camera className="w-5 h-5 text-amber-400" />
                        <span>Scatta / Carica Davanti</span>
                        <span className="text-[9.5px] text-slate-400 font-normal">Fronte documento esibito</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. RETRO (DIETRO) */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300 flex items-center gap-1">
                      <span>🪪</span> Dietro (Retro)
                    </span>
                    {fotoDocRetro && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                        Acquisito
                      </span>
                    )}
                  </div>

                  {fotoDocRetro ? (
                    <div className="space-y-2">
                      <div className="relative group rounded-lg overflow-hidden border border-slate-700 bg-black/60 max-h-36 flex items-center justify-center">
                        <img
                          src={fotoDocRetro}
                          alt="Retro Documento"
                          className="w-full h-32 object-cover rounded-lg cursor-pointer transition-transform hover:scale-105"
                          onClick={() => setFotoDocPreviewModal({ url: fotoDocRetro, titolo: "Dietro del Documento di Identità (Retro)" })}
                        />
                        <button
                          type="button"
                          onClick={() => setFotoDocPreviewModal({ url: fotoDocRetro, titolo: "Dietro del Documento di Identità (Retro)" })}
                          className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-black text-white text-[10px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-amber-300" />
                          <span>Ingrandisci</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold text-center cursor-pointer border border-slate-700 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCaricaFotoDocModal('retro', file);
                              e.target.value = '';
                            }}
                          />
                          <span>Sostituisci</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRimuoviFotoDocModal('retro')}
                          className="py-1.5 px-2 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-600/50 text-red-300 text-[10.5px] font-bold flex items-center gap-1 transition-colors"
                          title="Elimina foto retro"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Elimina</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.99]">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCaricaFotoDocModal('retro', file);
                            e.target.value = '';
                          }}
                        />
                        <Camera className="w-5 h-5 text-amber-400" />
                        <span>Scatta / Carica Retro</span>
                        <span className="text-[9.5px] text-slate-400 font-normal">Dietro documento esibito</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {(fotoDocFronte || fotoDocRetro) && (
                <div className="text-[10px] text-emerald-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800">
                  <span>✓ Foto salvate per il download PDF nel database</span>
                  {dataAcquisizioneDoc && <span>⏱️ {dataAcquisizioneDoc}</span>}
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* MANOVRE EFFETTUATE / PATOLOGIE (COMPILAZIONE AUTONOMA)    */}
          {/* ======================================================== */}
          <div className="bg-slate-950/70 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🩺</span>
                <h3 className="font-black uppercase tracking-wide text-amber-300 text-xs">
                  MANOVRE EFFETTUATE / PATOLOGIE
                </h3>
              </div>
              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Non Obbligatorio
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Note operative e cliniche sul servizio effettuato (es. manovre sanitarie/di soccorso effettuate, patologie riscontrate, parametri). Se compilato, questo campo viene incluso anche sul file PDF della scheda generata.
            </p>
            <textarea
              rows={2}
              value={manovreEffettuatePatologie}
              onChange={(e) => setManovreEffettuatePatologie(e.target.value)}
              placeholder="Inserisci eventuali manovre sanitarie, patologie riscontrate o note sul servizio effettuato (facoltativo)..."
              className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
            />
          </div>

          {/* ======================================================== */}
          {/* SEZIONE 3: EVENTUALE DONAZIONE RICEVUTA & DONATORE       */}
          {/* ======================================================== */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-400" />
                <h3 className="font-black uppercase tracking-wide text-white text-xs">
                  3. Eventuale Donazione Ricevuta
                </h3>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={haDonazione}
                  onChange={(e) => setHaDonazione(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2 text-xs font-bold text-slate-300">
                  {haDonazione ? 'Donazione Ricevuta' : 'Nessuna Donazione'}
                </span>
              </label>
            </div>

            {haDonazione ? (
              <div className="space-y-3.5 pt-1">
                {/* Importo Somma Donata */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Somma Donata (€ Euro) <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">€</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0.00"
                        value={sommaDonata}
                        onChange={(e) => {
                          setSommaDonata(e.target.value);
                          if (e.target.value && !haDonazione) {
                            setHaDonazione(true);
                          }
                        }}
                        className="w-full p-2 pl-7 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    {/* Pulsanti rapidi importo */}
                    {[10, 20, 50, 100].map((imp) => (
                      <button
                        key={imp}
                        type="button"
                        onClick={() => {
                          setSommaDonata(String(imp));
                          if (!haDonazione) setHaDonazione(true);
                        }}
                        className={`px-2.5 py-2 rounded-lg font-bold text-xs border transition-all ${
                          sommaDonata === String(imp)
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        €{imp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DICHIARAZIONE OBBLIGATORIA DEL METODO DI DONAZIONE (DUE CASELLE DIFFERENTI DA FREGARE) */}
                <div className={`p-3 rounded-2xl border-2 transition-all ${
                  (parseFloat(sommaDonata) > 0 && !metodoDonazione)
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <label className="text-xs font-black uppercase text-amber-300">
                        Dichiarazione Metodo Donazione <span className="text-red-400">*</span>
                      </label>
                    </div>

                    {parseFloat(sommaDonata) > 0 && !metodoDonazione ? (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/50 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span>Spunta obbligatoria: scegli un metodo</span>
                      </span>
                    ) : metodoDonazione ? (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Dichiarato: <strong>{metodoDonazione === 'contanti' ? 'Contanti' : metodoDonazione === 'pos' ? 'POS Elettronico' : metodoDonazione}</strong></span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Spunta una casella
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-300 mb-2.5 leading-snug">
                    Seleziona obbligatoriamente come è stata versata l'offerta spuntando una delle caselle sottostanti:
                  </p>

                  {/* CASELLE METODO DONAZIONE (CONTANTI, POS E ULTERIORI METODI CONFIGURATI) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* CASELLA 1: CONTANTI */}
                    <div
                      onClick={() => setMetodoDonazione(prev => prev === 'contanti' ? '' : 'contanti')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer select-none flex items-start gap-3 transition-all ${
                        metodoDonazione === 'contanti'
                          ? 'bg-emerald-950/60 border-emerald-400 shadow-md ring-2 ring-emerald-500/40 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={metodoDonazione === 'contanti'}
                          onChange={() => {}} // gestito da onClick sul contenitore
                          className="w-5 h-5 rounded-md text-emerald-500 bg-slate-900 border-slate-600 focus:ring-emerald-400 cursor-pointer accent-emerald-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Contanti</span>
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                          Denaro contante ricevuto direttamente a bordo mezzo (ricevuta manuale/cartacea).
                        </div>
                      </div>
                    </div>

                    {/* CASELLA 2: POS */}
                    <div
                      onClick={() => setMetodoDonazione(prev => prev === 'pos' ? '' : 'pos')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer select-none flex items-start gap-3 transition-all ${
                        metodoDonazione === 'pos'
                          ? 'bg-blue-950/60 border-blue-400 shadow-md ring-2 ring-blue-500/40 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={metodoDonazione === 'pos'}
                          onChange={() => {}} // gestito da onClick sul contenitore
                          className="w-5 h-5 rounded-md text-blue-500 bg-slate-900 border-slate-600 focus:ring-blue-400 cursor-pointer accent-blue-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 font-black text-sm text-white">
                          <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>POS Elettronico</span>
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                          Transazione elettronica eseguita con carta o bancomat su terminale POS di bordo.
                        </div>
                      </div>
                    </div>

                    {metodiDonazioneCustom.map((m) => {
                      const val = formattaEtichettaMetodoPagamento(m);
                      const isSel = metodoDonazione === val;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setMetodoDonazione((prev) => (prev === val ? '' : val))}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer select-none flex items-start gap-3 transition-all ${
                            isSel
                              ? 'bg-purple-950/60 border-purple-400 shadow-md ring-2 ring-purple-500/40 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => {}}
                              className="w-5 h-5 rounded-md text-purple-500 bg-slate-900 border-slate-600 focus:ring-purple-400 cursor-pointer accent-purple-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 font-black text-sm text-white">
                              <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
                              <span className="truncate">{m.nome}</span>
                            </div>
                            <div className="text-[10.5px] text-slate-400 mt-1 leading-snug break-all">
                              {m.coordinateODettagli || m.note || 'Metodo personalizzato configurato in Coordinate Bancarie'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Messaggio di Alert esplicito quando manca la scelta */}
                  {parseFloat(sommaDonata) > 0 && !metodoDonazione && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs font-bold flex items-center gap-2 animate-pulse">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>
                        Dichiarazione obbligatoria: hai inserito una donazione di € {parseFloat(sommaDonata).toFixed(2)}. Spunta uno dei metodi disponibili per proseguire e salvare!
                      </span>
                    </div>
                  )}
                </div>

                {/* Scelta Intestatario / Soggetto Donatore */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <label className="text-[11px] font-black uppercase text-amber-300 block">
                    Soggetto Donatore / Intestatario Quietanza:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`p-2 rounded-xl border cursor-pointer select-none flex items-center gap-2 transition-all ${
                      tipoDonatore === 'proprietario'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}>
                      <input
                        type="radio"
                        name="tipoDonatore"
                        value="proprietario"
                        checked={tipoDonatore === 'proprietario'}
                        onChange={() => setTipoDonatore('proprietario')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span className="font-bold text-xs">Coincide con Proprietario</span>
                    </label>

                    <label className={`p-2 rounded-xl border cursor-pointer select-none flex items-center gap-2 transition-all ${
                      tipoDonatore === 'chiamante'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}>
                      <input
                        type="radio"
                        name="tipoDonatore"
                        value="chiamante"
                        checked={tipoDonatore === 'chiamante'}
                        onChange={() => setTipoDonatore('chiamante')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span className="font-bold text-xs">Coincide con Chiamante</span>
                    </label>

                    <label className={`p-2 rounded-xl border cursor-pointer select-none flex items-center gap-2 transition-all ${
                      tipoDonatore === 'altra_persona'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}>
                      <input
                        type="radio"
                        name="tipoDonatore"
                        value="altra_persona"
                        checked={tipoDonatore === 'altra_persona'}
                        onChange={() => setTipoDonatore('altra_persona')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span className="font-bold text-xs">Altra Persona</span>
                    </label>
                  </div>

                  {/* Informazioni o Campi per Altra Persona */}
                  {tipoDonatore === 'proprietario' && (
                    <div className="text-[10.5px] text-slate-300 bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span>Donatore: <strong>{nome} {cognome}</strong> (CF: {codiceFiscale || 'Non specificato'})</span>
                      <span className="text-amber-400 font-mono">Dati Proprietario</span>
                    </div>
                  )}

                  {tipoDonatore === 'chiamante' && (
                    <div className="text-[10.5px] text-slate-300 bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span>Donatore: <strong>{chiamanteMissione?.nome || 'Segnalante'}</strong> (Tel: {chiamanteMissione?.telefono || '-'})</span>
                      <span className="text-amber-400 font-mono">Dati Chiamante</span>
                    </div>
                  )}

                  {tipoDonatore === 'altra_persona' && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Dati Anagrafici Altro Donatore
                        </span>
                        <button
                          type="button"
                          onClick={handleImportaDatiInDonatoreAltro}
                          className="text-[9.5px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
                        >
                          📥 Importa dati già immessi
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nome Donatore *"
                          value={donatoreAltroNome}
                          onChange={(e) => setDonatoreAltroNome(e.target.value)}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Cognome Donatore *"
                          value={donatoreAltroCognome}
                          onChange={(e) => setDonatoreAltroCognome(e.target.value)}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Codice Fiscale Donatore"
                          value={donatoreAltroCF}
                          onChange={(e) => setDonatoreAltroCF(e.target.value.toUpperCase())}
                          maxLength={16}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                        />
                        <input
                          type="tel"
                          placeholder="Telefono Donatore"
                          value={donatoreAltroTelefono}
                          onChange={(e) => setDonatoreAltroTelefono(e.target.value)}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Nessuna donazione economica registrata per questo trasporto.
              </p>
            )}
          </div>

          {/* ======================================================== */}
          {/* SEZIONE 4: FIRMA PROPRIETARIO SUL DISPLAY               */}
          {/* ======================================================== */}
          <div className="space-y-2">
            <SignaturePad
              label="4. Firma del Proprietario / Intestatario dell'Animale"
              sottotitolo="Chiedi al proprietario di apporre la firma passando il dito o pennino sul display"
              valoreIniziale={firmaProprietario || undefined}
              onFirmaCambiata={(dataUrl) => setFirmaProprietario(dataUrl)}
              altezza={140}
            />
          </div>

          {/* ======================================================== */}
          {/* SEZIONE 5: STRUTTURA VETERINARIA (DESTINAZIONE O PARTENZA) */}
          {/* ======================================================== */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
            {notificaModificaCentrale && (
              <div className="p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/80 text-cyan-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-semibold">{notificaModificaCentrale}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificaModificaCentrale(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-cyan-400" />
                <h3 className="font-black uppercase tracking-wide text-white text-xs">
                  {ruoloVeterinario === 'partenza'
                    ? '5. Partenza Clinica Veterinaria / Ambulatorio'
                    : ruoloVeterinario === 'entrambe'
                    ? '5. Strutture Veterinarie di Partenza e di Destinazione'
                    : '5. Destinazione Clinica Veterinaria / Ambulatorio Ricevente'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {isStrutturaVeterinariaBloccata && (
                  <span className="text-[9.5px] font-black text-amber-300 bg-amber-950/90 px-2 py-0.5 rounded border border-amber-600/60 shadow-inner flex items-center gap-1">
                    🔒 Imposto dalla Centrale (Non deselezionabile)
                  </span>
                )}
                <label
                  className={`relative inline-flex items-center select-none ${
                    isStrutturaVeterinariaBloccata ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                  }`}
                  title={
                    isStrutturaVeterinariaBloccata
                      ? (ruoloVeterinario === 'partenza'
                          ? 'La Centrale Operativa ha indicato una Clinica o Ambulatorio veterinario come obiettivo di partenza: l\'opzione è obbligatoria e non deselezionabile dal volontario'
                          : 'La Centrale Operativa ha indicato una Clinica o Ambulatorio veterinario: l\'opzione è obbligatoria e non deselezionabile dal volontario')
                      : (ruoloVeterinario === 'partenza'
                          ? 'Seleziona per indicare se l\'obiettivo di partenza è una clinica veterinaria'
                          : 'Seleziona per indicare se la destinazione è una clinica veterinaria')
                  }
                >
                  <input
                    type="checkbox"
                    checked={isVeterinario}
                    disabled={isStrutturaVeterinariaBloccata}
                    onChange={(e) => {
                      if (isStrutturaVeterinariaBloccata) return;
                      setIsVeterinario(e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    isStrutturaVeterinariaBloccata ? 'peer-checked:bg-amber-600 ring-1 ring-amber-400' : 'peer-checked:bg-cyan-600'
                  }`}></div>
                  <span className="ml-2 text-xs font-bold text-slate-300">
                    {isVeterinario
                      ? (ruoloVeterinario === 'partenza'
                          ? 'Struttura Veterinaria di Partenza'
                          : ruoloVeterinario === 'entrambe'
                          ? 'Strutture Veterinarie'
                          : 'Struttura Veterinaria')
                      : (ruoloVeterinario === 'partenza'
                          ? 'Altro Luogo di Partenza'
                          : 'Altra Destinazione')}
                  </span>
                </label>
              </div>
            </div>

            {isVeterinario ? (
              <div className="space-y-4 pt-1">
                {/* CASO A: VETERINARIO È SOLO LA PARTENZA */}
                {ruoloVeterinario === 'partenza' && (
                  <div className="space-y-3">
                    {/* Nome Struttura di Partenza (Trasmessa dalla Centrale) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                          <Building className="w-3 h-3 text-cyan-400" />
                          Struttura Veterinaria di Partenza (Da Centrale) <span className="text-red-400">*</span>
                        </label>
                        <span className="text-[9.5px] font-bold text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-700/60 shadow-inner">
                          🔒 Non modificabile
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={indirizzoPartenza || nomeStrutturaOVeterinario || 'In attesa di obiettivo di partenza da Centrale'}
                        className="w-full p-2.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-cyan-200 font-semibold cursor-not-allowed select-none text-xs shadow-inner"
                        title="Struttura di partenza impostata e trasmessa dalla Centrale Operativa (non modificabile)"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                        Recuperato in automatico dai dati inviati come obiettivo di partenza dalla Centrale Operativa.
                      </p>
                    </div>

                    {/* Campo Facoltativo: Nome e Cognome del Veterinario di Partenza che Firma */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        Nome e Cognome Medico Veterinario di Partenza <span className="text-slate-500 font-normal">(Facoltativo)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Dott. Marco Rossi (Facoltativo)"
                        value={nomeVeterinarioPartenza || nomeVeterinario}
                        onChange={(e) => {
                          setNomeVeterinarioPartenza(e.target.value);
                          setNomeVeterinario(e.target.value);
                        }}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                      />
                    </div>

                    {/* Firma del Veterinario / Struttura di Partenza */}
                    <SignaturePad
                      label="Firma Medico Veterinario / Clinica di Partenza"
                      sottotitolo="Firma di avvenuta presa in carico / dimissione sanitaria dell'animale presso la struttura di partenza"
                      valoreIniziale={firmaVeterinarioPartenza || firmaVeterinario || undefined}
                      onFirmaCambiata={(dataUrl) => {
                        setFirmaVeterinarioPartenza(dataUrl);
                        setFirmaVeterinario(dataUrl);
                      }}
                      altezza={130}
                    />
                  </div>
                )}

                {/* CASO B: VETERINARIO È SOLO LA DESTINAZIONE */}
                {ruoloVeterinario === 'destinazione' && (
                  <div className="space-y-3">
                    {/* Nome Struttura di Destinazione (Trasmessa dalla Centrale) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                          <Building className="w-3 h-3 text-cyan-400" />
                          Struttura Veterinaria di Destinazione (Da Centrale) <span className="text-red-400">*</span>
                        </label>
                        <span className="text-[9.5px] font-bold text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-700/60 shadow-inner">
                          🔒 Non modificabile
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={destinazioneAssegnata || nomeStrutturaOVeterinario || 'In attesa di assegnazione destinazione da Centrale'}
                        className="w-full p-2.5 rounded-lg bg-slate-950/80 border border-slate-700/80 text-cyan-200 font-semibold cursor-not-allowed select-none text-xs shadow-inner"
                        title="Struttura di destinazione impostata e trasmessa dalla Centrale Operativa (non modificabile)"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                        Recuperato in automatico dai dati inviati come destinazione dalla Centrale Operativa.
                      </p>
                    </div>

                    {/* Campo Facoltativo: Nome e Cognome del Veterinario Ricevente */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        Nome e Cognome Medico Veterinario Ricevente <span className="text-slate-500 font-normal">(Facoltativo)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Dott. Marco Rossi (Facoltativo)"
                        value={nomeVeterinarioDest || nomeVeterinario}
                        onChange={(e) => {
                          setNomeVeterinarioDest(e.target.value);
                          setNomeVeterinario(e.target.value);
                        }}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
                      />
                    </div>

                    {/* Firma del Veterinario / Clinica Ricevente */}
                    <SignaturePad
                      label="Firma Medico Veterinario / Clinica Ricevente"
                      sottotitolo="Firma di avvenuta presa in carico sanitaria dell'animale presso la struttura"
                      valoreIniziale={firmaVeterinarioDest || firmaVeterinario || undefined}
                      onFirmaCambiata={(dataUrl) => {
                        setFirmaVeterinarioDest(dataUrl);
                        setFirmaVeterinario(dataUrl);
                      }}
                      altezza={130}
                    />
                  </div>
                )}

                {/* CASO C: ENTRAMBE (SIA PARTENZA CHE DESTINAZIONE SONO STRUTTURE VETERINARIE) */}
                {ruoloVeterinario === 'entrambe' && (
                  <div className="space-y-4">
                    {/* Blocco Partenza */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-cyan-800/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-cyan-300 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-cyan-400" />
                          <span>5A. Struttura Veterinaria di Partenza</span>
                        </h4>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                          Partenza
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={indirizzoPartenza || 'Obiettivo di partenza non specificato'}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-200 text-xs font-semibold cursor-not-allowed select-none"
                      />
                      <input
                        type="text"
                        placeholder="Nome Medico Veterinario di Partenza (Facoltativo)"
                        value={nomeVeterinarioPartenza}
                        onChange={(e) => setNomeVeterinarioPartenza(e.target.value)}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500"
                      />
                      <SignaturePad
                        label="Firma Medico Veterinario di Partenza"
                        sottotitolo="Presa in carico / dimissione alla partenza"
                        valoreIniziale={firmaVeterinarioPartenza || undefined}
                        onFirmaCambiata={(dataUrl) => setFirmaVeterinarioPartenza(dataUrl)}
                        altezza={110}
                      />
                    </div>

                    {/* Blocco Destinazione */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-teal-800/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-teal-300 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-teal-400" />
                          <span>5B. Struttura Veterinaria di Destinazione (Ricevente)</span>
                        </h4>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700/50">
                          Destinazione
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={destinazioneAssegnata || 'Destinazione non specificata'}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-teal-200 text-xs font-semibold cursor-not-allowed select-none"
                      />
                      <input
                        type="text"
                        placeholder="Nome Medico Veterinario Ricevente (Facoltativo)"
                        value={nomeVeterinarioDest}
                        onChange={(e) => setNomeVeterinarioDest(e.target.value)}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500"
                      />
                      <SignaturePad
                        label="Firma Medico Veterinario Ricevente"
                        sottotitolo="Presa in consegna sanitaria a destinazione"
                        valoreIniziale={firmaVeterinarioDest || undefined}
                        onFirmaCambiata={(dataUrl) => setFirmaVeterinarioDest(dataUrl)}
                        altezza={110}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                {ruoloVeterinario === 'partenza'
                  ? 'Non contrassegnato come veterinario o clinica di partenza.'
                  : 'Non contrassegnato come veterinario o clinica (consegna a domicilio privato o rientro).'}
              </p>
            )}
          </div>
        </div>

        {/* Footer con Azioni */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-colors"
          >
            Chiudi
          </button>

          <button
            type="button"
            onClick={handleSalvaScheda}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase shadow-lg shadow-emerald-950/50 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>💾 Salva Dati Animale, Destinazione & Firme</span>
          </button>
        </div>
      </div>

      {/* MODALE INGRANDIMENTO FOTO DOCUMENTO */}
      {fotoDocPreviewModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-3">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl space-y-2 p-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-300 uppercase flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>{fotoDocPreviewModal.titolo}</span>
              </span>
              <button
                type="button"
                onClick={() => setFotoDocPreviewModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-black/50 rounded-xl p-2">
              <img
                src={fotoDocPreviewModal.url}
                alt={fotoDocPreviewModal.titolo}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setFotoDocPreviewModal(null)}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase"
              >
                Chiudi Anteprima
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
