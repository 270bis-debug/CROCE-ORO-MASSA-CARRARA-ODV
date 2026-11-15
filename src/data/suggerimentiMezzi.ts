export interface SuggerimentoMezzo {
  sigla: string;
  titolo: string;
  nomeEsteso: string;
  flotta: 'vet' | 'pc';
  flottaTitolo: string;
  icona: string;
  tipologia: string;
  impiegoOperativo: string;
  etichettaVolontario: string;
}

export const FLOTTA_SUGGERIMENTI: SuggerimentoMezzo[] = [
  {
    sigla: 'T4606',
    titolo: '🚑 T4606 — Ambulanza di Soccorso Ordinario / Servizi Istituzionali',
    nomeEsteso: 'Ambulanza di Soccorso Ordinario / Servizi Istituzionali',
    flotta: 'vet',
    flottaTitolo: '🐾 1. Flotta Servizio Veterinario & Emergenza (4 Mezzi)',
    icona: '🚑',
    tipologia: 'Ambulanza di soccorso.',
    impiegoOperativo: 'Servizi secondari, trasporti ordinari, codici Gialli/Verdi/Bianchi e presidio istituzionale di sede.',
    etichettaVolontario: 'T4606 (Ambulanza)'
  },
  {
    sigla: 'T4607',
    titolo: '🚙 T4607 — Fuoristrada Pickup 4x4 Cassonato',
    nomeEsteso: 'Fuoristrada Pickup 4x4 Cassonato',
    flotta: 'pc',
    flottaTitolo: '🌲 2. Flotta Protezione Civile (4 Mezzi)',
    icona: '🚙',
    tipologia: 'Pickup 4x4 con cassone attrezzato.',
    impiegoOperativo: 'Interventi montani, sgombero strade, taglio e rimozione rami o alberi caduti, frane e trasporto motoseghe.',
    etichettaVolontario: 'T4607 (Fuoristrada PickUp)'
  },
  {
    sigla: 'T4608',
    titolo: '🚐 T4608 — Fiat Doblò Giallo Oro Ufficiale',
    nomeEsteso: 'Fiat Doblò Giallo Oro Ufficiale',
    flotta: 'vet',
    flottaTitolo: '🐾 1. Flotta Servizio Veterinario & Emergenza (4 Mezzi)',
    icona: '🚐',
    tipologia: 'Veicolo compatto multispazio con stemma ufficiale Croce Oro.',
    impiegoOperativo: 'Recupero animali non feriti, manovre nei vicoli stretti e borghi a monte di Massa e Carrara (Colonnata, Miseglia, Torano, Forno).',
    etichettaVolontario: 'T4608 (Trasporto Animali)'
  },
  {
    sigla: 'T4609',
    titolo: '🚑 T4609 — Ambulanza di Soccorso Veterinario d\'Emergenza',
    nomeEsteso: 'Ambulanza di Soccorso Veterinario d\'Emergenza',
    flotta: 'vet',
    flottaTitolo: '🐾 1. Flotta Servizio Veterinario & Emergenza (4 Mezzi)',
    icona: '🚑',
    tipologia: 'Ambulanza con livrea ad alta visibilità e dotazioni di soccorso rapido.',
    impiegoOperativo: 'Codici Rossi, urgenze tempo-dipendenti, traumi gravi, animali investiti, emorragie o stati d\'incoscienza.',
    etichettaVolontario: 'T4609 (Ambulanza)'
  },
  {
    sigla: 'T4611',
    titolo: '🚌 T4611 — Pullman / Minibus 9 Posti',
    nomeEsteso: 'Pullman / Minibus 9 Posti',
    flotta: 'pc',
    flottaTitolo: '🌲 2. Flotta Protezione Civile (4 Mezzi)',
    icona: '🚌',
    tipologia: 'Minibus per trasporto persone.',
    impiegoOperativo: 'Spostamento rapido delle squadre di volontari verso gli scenari d\'intervento ed evacuazione sfollati.',
    etichettaVolontario: 'T4611 (Pulmino 9 posti)'
  },
  {
    sigla: 'T4613',
    titolo: '🚙 T4613 — Fuoristrada 4x4 Operativo Protezione Civile',
    nomeEsteso: 'Fuoristrada 4x4 Operativo Protezione Civile',
    flotta: 'pc',
    flottaTitolo: '🌲 2. Flotta Protezione Civile (4 Mezzi)',
    icona: '🚙',
    tipologia: 'Fuoristrada 4x4 con livrea blu navy/fasce arancioni e lampeggianti LED.',
    impiegoOperativo: 'Interventi operativi rapidi su qualsiasi terreno, monitoraggio corsi d\'acqua e ricognizione.',
    etichettaVolontario: 'T4613 (Kia Sportage 4x4)'
  },
  {
    sigla: 'T4614',
    titolo: '🚑 T4614 — Ambulanza per Trasferimenti a Lungo Raggio',
    nomeEsteso: 'Ambulanza per Trasferimenti a Lungo Raggio',
    flotta: 'vet',
    flottaTitolo: '🐾 1. Flotta Servizio Veterinario & Emergenza (4 Mezzi)',
    icona: '🚑',
    tipologia: 'Ambulanza allestita per percorsi extraurbani e autostradali.',
    impiegoOperativo: 'Trasferimenti a lungo raggio (>30 km) verso cliniche universitarie ed extraprovinciali (Pisa, Firenze, Lucca).',
    etichettaVolontario: 'T4614 (Ambulanza)'
  },
  {
    sigla: 'T4615',
    titolo: '🚐 T4615 — Furgone Bianco — Unità Logistica Mobile',
    nomeEsteso: 'Furgone Bianco — Unità Logistica Mobile',
    flotta: 'pc',
    flottaTitolo: '🌲 2. Flotta Protezione Civile (4 Mezzi)',
    icona: '🚐',
    tipologia: 'Furgone capiente (Ducato/Transit).',
    impiegoOperativo: 'Logistica pesante, allagamenti, trasporto idrovore, motopompe, tende pneumatiche, sacchi di sabbia e officina da campo.',
    etichettaVolontario: 'T4615 (Unità Logistica)'
  }
];

export const LISTA_MEZZI_VOLONTARIO: string[] = [
  'T4606 (Ambulanza)',
  'T4607 (Fuoristrada PickUp)',
  'T4608 (Trasporto Animali)',
  'T4609 (Ambulanza)',
  'T4611 (Pulmino 9 posti)',
  'T4613 (Kia Sportage 4x4)',
  'T4614 (Ambulanza)',
  'T4615 (Unità Logistica)'
];

export type MotivoFuoriServizio = 'riparazione' | 'manutenzione' | 'guasto' | 'revisione' | 'incidente' | 'altro';

export interface MezzoFuoriServizio {
  sigla: string; // es. 'T4609'
  motivo: MotivoFuoriServizio;
  note?: string;
  dataOra: string;
  operatore: string;
}

export const MOTIVI_FUORI_SERVIZIO_LABELS: Record<MotivoFuoriServizio, string> = {
  riparazione: 'Riparazione in Officina',
  manutenzione: 'Manutenzione Ordinaria / Straordinaria',
  guasto: 'Guasto Meccanico / Elettrico',
  revisione: 'Revisione Periodica / Collaudo',
  incidente: 'Incidente / Sinistro',
  altro: 'Altro / Fermo Tecnico'
};

export const CHIAVE_STORAGE_MEZZI_FUORI_SERVIZIO = 'croce_oro_mezzi_fuori_servizio_v1';

export function caricaMezziFuoriServizio(): Record<string, MezzoFuoriServizio> {
  try {
    const raw = localStorage.getItem(CHIAVE_STORAGE_MEZZI_FUORI_SERVIZIO);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function salvaMezziFuoriServizio(stato: Record<string, MezzoFuoriServizio>): void {
  try {
    localStorage.setItem(CHIAVE_STORAGE_MEZZI_FUORI_SERVIZIO, JSON.stringify(stato));
  } catch (e) {
    console.error('Errore nel salvataggio dei mezzi fuori servizio:', e);
  }
}

export function estraiSiglaDaEtichetta(etichetta?: string): string {
  if (!etichetta) return '';
  const match = etichetta.match(/^(T\d{4})/i);
  return match ? match[1].toUpperCase() : etichetta.split(' ')[0].toUpperCase();
}
