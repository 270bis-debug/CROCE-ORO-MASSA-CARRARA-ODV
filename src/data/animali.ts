export const LISTA_ANIMALI_DIFFUSI = [
  'Cane',
  'Gatto',
  'Furetto',
  'Coniglio',
  'Cavallo / Equino',
  'Pappagallo / Volatile',
  'Tartaruga',
  'Altro'
] as const;

export type TipoAnimaleDiffuso = typeof LISTA_ANIMALI_DIFFUSI[number];

export const LISTA_ANIMALI_VOLONTARIO = [
  'Cane',
  'Gatto',
  'Altro'
] as const;

export interface DatiAnimaleMissione {
  tipo: string;
  tipoAltro?: string;
  nonDiProprieta?: boolean;
  microchip?: string;
  noMicrochip?: boolean;
  microchipInviatoCentrale?: boolean;
  dataRilevazioneMicrochip?: string;
  impostoDaCentrale?: boolean;
}

export interface FotoDocumentoIdentita {
  fronte?: string;
  retro?: string;
  dataAcquisizione?: string;
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
  email?: string;
  nonHaEmail?: boolean;
  regioneTipo?: 'TOSCANA' | 'ALTRO' | '';
  regioneAltro?: string;
  regione?: string;
  note?: string;
  fotoDocumento?: FotoDocumentoIdentita;
}
