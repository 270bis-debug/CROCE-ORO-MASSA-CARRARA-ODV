export interface RifornimentoCarburante {
  id: string;
  mezzoSigla: string;
  data: string; // YYYY-MM-DD
  orario?: string;
  litri: number;
  costoTotale: number; // in euro
  prezzoAlLitro?: number; // in euro/litro
  chilometraggio: number;
  distributore?: string;
  volontarioNome?: string;
  metodoPagamento?: 'Carta Carburante Q8' | 'Carta Carburante Eni' | 'Cassa Contanti' | 'Bancomat' | 'Altro';
  tipoCarburante?: 'Gasolio / Diesel' | 'Benzina Verde' | 'AdBlue';
  note?: string;
}

export interface StatisticheConsumoMezzo {
  mezzoSigla: string;
  targa?: string;
  modello?: string;
  tipo?: string;
  flotta?: 'vet' | 'pc';
  kmTotaliRegistrati: number;
  kmServiziPercorsi: number;
  litriTotaliRiforniti: number;
  spesaCarburanteTotale: number;
  spesaManutenzioniTotale: number;
  spesaTotaleEsercizio: number;
  numeroRifornimenti: number;
  consumoMedioKmL: number; // km / litro
  consumoMedioL100Km: number; // litri per 100 km
  costoCarburanteAlKm: number; // € per km (carburante)
  costoTotaleAlKm: number; // € per km (carburante + manutenzioni)
  efficienza: 'ottima' | 'media' | 'bassa';
  ultimoRifornimento?: RifornimentoCarburante;
}

export interface StatisticheConsumoFlottaGlobale {
  kmTotaliFlotta: number;
  litriTotaliFlotta: number;
  spesaCarburanteTotaleFlotta: number;
  spesaManutenzioniTotaleFlotta: number;
  spesaTotaleEsercizioFlotta: number;
  consumoMedioFlottaKmL: number;
  consumoMedioFlottaL100Km: number;
  costoMedioCarburanteAlKm: number;
  costoMedioTotaleAlKm: number;
  mezziAnalizzati: number;
  numeroTotaleRifornimenti: number;
}
