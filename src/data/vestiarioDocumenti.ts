import { formatDateTimeItaly, formatISODateItaly } from '../utils/italianTime';

export type TagliaVestiario = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL';

export const TAGLIE_DISPONIBILI: TagliaVestiario[] = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '3XL',
  '4XL'
];

// Cauzioni obbligatorie da versare alla consegna dei capi (rimborsate alla restituzione)
export const CAUZIONE_PANTALONI = 30.0; // € 30,00 per il pantalone
export const CAUZIONE_GIUBBETTO = 45.0; // € 45,00 per il giubbetto

export function calcolaCauzioneTotale(vestiario?: DotazioneVestiario): {
  cauzionePantaloni: number;
  cauzioneGiubbetto: number;
  totale: number;
} {
  const cauzionePantaloni = vestiario?.pantaloni?.consegnato ? CAUZIONE_PANTALONI : 0;
  const cauzioneGiubbetto = vestiario?.giubbetto?.consegnato ? CAUZIONE_GIUBBETTO : 0;
  return {
    cauzionePantaloni,
    cauzioneGiubbetto,
    totale: cauzionePantaloni + cauzioneGiubbetto
  };
}

export interface PezzoTShirt {
  id: number; // 1, 2, 3
  consegnato: boolean;
  taglia?: TagliaVestiario;
  dataConsegna?: string; // YYYY-MM-DD
  isUltimaConsegna?: boolean; // Contrassegnato all'ultimo salvataggio per evidenziazione stampa
}

export interface CapoVestiario {
  consegnato: boolean;
  taglia?: TagliaVestiario;
  dataConsegna?: string; // YYYY-MM-DD
  isUltimaConsegna?: boolean; // Contrassegnato all'ultimo salvataggio per evidenziazione stampa
}

export interface DocumentoFirmatoArchiviato {
  fileBase64: string; // PDF o immagine in formato Data URL
  nomeFile: string;
  dataUpload: string; // YYYY-MM-DD o stringa leggibile
  dimensione?: string; // es. '1.2 MB'
}

export interface DotazioneVestiario {
  tshirt: PezzoTShirt[]; // max 3 pezzi
  felpa: CapoVestiario;
  pile: CapoVestiario;
  pantaloni: CapoVestiario;
  giubbetto: CapoVestiario;
  giubbottoInvernale: CapoVestiario;
  dataUltimoAggiornamento?: string;
  ibanRestituzioneCauzione?: string; // IBAN per bonifico rimborso cauzione DPI
  documentoFirmato?: DocumentoFirmatoArchiviato; // Upload della Scheda Vestiario & DPI stampata e firmata
}

export interface DocumentoIdentitaVolontario {
  tipo: string; // 'Carta d\'Identità' | 'Passaporto' | 'Altro'
  numero: string;
  dataScadenza: string; // YYYY-MM-DD
}

export interface PatenteGuidaVolontario {
  inPossesso: boolean;
  categoria?: string; // es. B, C, C1, D, CQC
  numero?: string;
  dataScadenza?: string; // YYYY-MM-DD
}

export function creaDotazioneVuota(): DotazioneVestiario {
  return {
    tshirt: [
      { id: 1, consegnato: false },
      { id: 2, consegnato: false },
      { id: 3, consegnato: false }
    ],
    felpa: { consegnato: false },
    pile: { consegnato: false },
    pantaloni: { consegnato: false },
    giubbetto: { consegnato: false },
    giubbottoInvernale: { consegnato: false }
  };
}

/**
 * Calcola i giorni rimanenti prima della scadenza della patente
 * e se è in scadenza entro i 7 giorni richiesti (o già scaduta).
 */
export function calcolaStatoScadenzaPatente(dataScadenzaStr?: string): {
  giorniMancanti: number;
  inScadenza7Giorni: boolean;
  scaduta: boolean;
  label: string;
} | null {
  if (!dataScadenzaStr) return null;
  const match = dataScadenzaStr.trim();
  if (!match) return null;

  const dataScadenza = new Date(match);
  if (isNaN(dataScadenza.getTime())) return null;

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  dataScadenza.setHours(0, 0, 0, 0);

  const diffMs = dataScadenza.getTime() - oggi.getTime();
  const giorniMancanti = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const scaduta = giorniMancanti < 0;
  const inScadenza7Giorni = giorniMancanti >= 0 && giorniMancanti <= 7;

  let label = '';
  if (scaduta) {
    label = `SCADUTA da ${Math.abs(giorniMancanti)} ${Math.abs(giorniMancanti) === 1 ? 'giorno' : 'giorni'}`;
  } else if (giorniMancanti === 0) {
    label = 'SCADE OGGI';
  } else if (inScadenza7Giorni) {
    label = `Scade tra ${giorniMancanti} ${giorniMancanti === 1 ? 'giorno' : 'giorni'}`;
  } else {
    label = `Valida (${giorniMancanti} giorni)`;
  }

  return {
    giorniMancanti,
    inScadenza7Giorni,
    scaduta,
    label
  };
}

/**
 * Confronta la precedente dotazione con la nuova per contrassegnare come `isUltimaConsegna`
 * esclusivamente i capi consegnati o variati in questa sessione.
 */
export function applicaEvidenziazioneUltimaConsegna(
  nuova: DotazioneVestiario,
  precedente?: DotazioneVestiario
): DotazioneVestiario {
  const oggiIso = formatISODateItaly();
  const dataOraAggiornamento = formatDateTimeItaly(undefined, false);

  const copiaNuova: DotazioneVestiario = JSON.parse(JSON.stringify(nuova));
  copiaNuova.dataUltimoAggiornamento = dataOraAggiornamento;

  // 1. T-shirt (3 pezzi)
  copiaNuova.tshirt = copiaNuova.tshirt.map((pezzoNuovo, idx) => {
    const pezzoVecchio = precedente?.tshirt?.[idx];
    const appenaConsegnato = pezzoNuovo.consegnato && (!pezzoVecchio?.consegnato || pezzoVecchio.taglia !== pezzoNuovo.taglia || pezzoVecchio.dataConsegna !== pezzoNuovo.dataConsegna);
    return {
      ...pezzoNuovo,
      dataConsegna: pezzoNuovo.consegnato ? (pezzoNuovo.dataConsegna || oggiIso) : undefined,
      isUltimaConsegna: appenaConsegnato
    };
  });

  // Helper per capi singoli
  const controllaCapo = (chiave: 'felpa' | 'pile' | 'pantaloni' | 'giubbetto' | 'giubbottoInvernale'): CapoVestiario => {
    const capoNuovo = copiaNuova[chiave];
    const capoVecchio = precedente?.[chiave];
    const appenaConsegnato = capoNuovo.consegnato && (!capoVecchio?.consegnato || capoVecchio.taglia !== capoNuovo.taglia || capoVecchio.dataConsegna !== capoNuovo.dataConsegna);
    return {
      ...capoNuovo,
      dataConsegna: capoNuovo.consegnato ? (capoNuovo.dataConsegna || oggiIso) : undefined,
      isUltimaConsegna: appenaConsegnato
    };
  };

  copiaNuova.felpa = controllaCapo('felpa');
  copiaNuova.pile = controllaCapo('pile');
  copiaNuova.pantaloni = controllaCapo('pantaloni');
  copiaNuova.giubbetto = controllaCapo('giubbetto');
  copiaNuova.giubbottoInvernale = controllaCapo('giubbottoInvernale');

  copiaNuova.ibanRestituzioneCauzione = nuova.ibanRestituzioneCauzione !== undefined ? nuova.ibanRestituzioneCauzione : precedente?.ibanRestituzioneCauzione;
  copiaNuova.documentoFirmato = nuova.documentoFirmato || precedente?.documentoFirmato;

  return copiaNuova;
}
