// Definizione tipi di dati per il Portale Gestionale Amministratore (8 Macro Categorie)
// Croce Oro Massa Carrara OdV

import { TagliaVestiario } from '../data/vestiarioDocumenti';

// ---------------------------------------------------------------------------
// 1. MACRO CATEGORIA 2: REGISTRO TIMBRATURE & PRESENZE VOLONTARI
// ---------------------------------------------------------------------------
export interface TimbraturaVolontario {
  id: string;
  volontarioId: string;
  volontarioNome: string;
  qualifica: string;
  data: string; // YYYY-MM-DD
  orarioIngresso: string; // HH:mm:ss
  orarioUscita?: string; // HH:mm:ss
  oreTotali?: number; // es. 6.5
  mezzoAssegnato?: string; // es. T4606
  sede: string; // Luogo autorizzato di timbratura ingresso (es. Sede Operativa Le Jare)
  sedeUscita?: string; // Luogo autorizzato di timbratura uscita (può essere diverso dalla sede di entrata)
  coordinateIngresso?: { lat: number; lng: number };
  coordinateUscita?: { lat: number; lng: number };
  modificataDaAdmin: boolean;
  dataUltimaModifica?: string;
  operatoreModifica?: string;
  corsoId?: string;
  lezioneId?: string;
  oreEMinuti?: string; // es. "2h 30m 15s"
  attivitaSvolta?: string; // Cosa sta facendo il volontario/operatore (turno, corso o descrizione manuale)
  tipoAttivita?: 'turno' | 'corso' | 'manuale';
  note?: string;
}

export type TipoLuogoTimbratura =
  | 'sede_operativa'
  | 'presidio_sanitario'
  | 'evento_manifestazione'
  | 'postazione_esterna'
  | 'sede'
  | 'presidio'
  | 'ospedale'
  | 'evento'
  | 'postazione_estiva'
  | 'corso_formazione'
  | 'altro';

export interface LuogoTimbratura {
  id: string;
  nome: string; // es. Sede Operativa Le Jare, Presidio Ospedaliero NOA, Stadio, Piazza Eventi, etc.
  codice?: string; // es. TIMB-01
  indirizzo?: string;
  coordinate: {
    lat: number;
    lng: number;
  };
  raggioMetri: number; // Raggio di ampiezza di validità della timbratura a discrezione dell'operatore (es. 20, 50, 100, 200, 500m)
  tipo?: TipoLuogoTimbratura;
  attivo: boolean;
  descrizione?: string;
  creatoDa?: string;
  dataCreazione?: string;
}

// ---------------------------------------------------------------------------
// 2. MACRO CATEGORIA 3: DATABASE MEZZI, MANUTENZIONE & MAGAZZINO MEZZI
// ---------------------------------------------------------------------------
export interface MezzoFlotta {
  id: string;
  sigla: string; // es. T4606, T4609, T4613...
  targa: string; // es. FX829AB
  modello: string; // es. Fiat Ducato Maxi 2.3 Multijet
  annoImmatricolazione: number;
  tipo: 'Ambulanza Emergenza' | 'Ambulanza Trasporto' | 'Fuoristrada 4x4' | 'Pulmino Disabili' | 'Furgone Logistico' | 'Automedica';
  flotta: 'vet' | 'pc'; // Veterinario / Emergenza o Protezione Civile
  stato: 'Operativo' | 'Fuori Servizio' | 'In Manutenzione' | 'In Sanificazione';
  chilometraggioAttuale: number;
  sedeStazionamento: string; // es. Massa (Le Jare)
  scadenzaRevisione: string; // YYYY-MM-DD
  scadenzaAssicurazione: string; // YYYY-MM-DD
  scadenzaBollo: string; // YYYY-MM-DD
  motivoFuoriServizio?: string;
  operatoreSegnalazione?: string;
  dataSegnalazione?: string;
  note?: string;
}

export interface RicambioUtilizzatoManutenzione {
  articoloId: string;
  articoloCodice: string;
  articoloNome: string;
  quantita: number;
  unitaMisura: string;
  costoUnitario?: number;
  subtotale?: number;
}

export interface InterventoManutenzione {
  id: string;
  mezzoSigla: string;
  dataIntervento: string; // YYYY-MM-DD
  tipoIntervento: 'Tagliando Ordinario' | 'Revisione Ministeriale' | 'Freni / Dischi' | 'Pneumatici' | 'Riparazione Meccanica' | 'Allestimento Sanitario' | 'Sanificazione Straordinaria' | 'Altro';
  chilometraggioAlTagliando: number;
  officinaEsecutrice: string;
  costoTotale: number; // in euro
  descrizione: string;
  fatturaNumero?: string;
  eseguitoDa: string;
  scadenzaProssimoInterventoKm?: number;
  scadenzaProssimaData?: string;
  eseguitaInSede?: boolean;
  sedeEsecuzione?: string;
  ricambiUtilizzati?: RicambioUtilizzatoManutenzione[];
}

export interface DotazioneMagazzinoMezzo {
  id: string;
  mezzoSigla: string; // a quale mezzo è assegnato (oppure "Scorta Centrale")
  nomeOggetto: string; // es. "Bombola Ossigeno 5L", "Estintore Polvere 2kg", "Catene da Neve"
  categoria: 'Ossigeno & Respirazione' | 'Antincendio' | 'Emergenza Stradale' | 'Attrezzi Bordo' | 'Sanitario Bordo';
  matricola?: string;
  quantita: number;
  pressioneBar?: number; // per bombole O2
  dataScadenzaCollaudo?: string; // YYYY-MM-DD
  dataScadenzaRevisione?: string; // YYYY-MM-DD
  stato: 'Pronto all\'Uso' | 'Da Revisionare' | 'Scaricato' | 'In Collaudo';
  note?: string;
}

// Magazzino Mezzi: ricambi per tagliando, riparazioni, lampadine, olio motore, liquido refrigerante, ecc.
export interface ArticoloMagazzinoMezzi {
  id: string;
  codice: string;
  codiceArticolo?: string;
  nome: string; // es. "Olio Motore 5W-30 Sintetico", "Lampadina H7 12V 55W", "Liquido Refrigerante -35°C", "Filtro Olio Ducato"
  categoria:
    | 'Tagliando & Lubrificanti'
    | 'Illuminazione & Elettrico'
    | 'Freni & Sospensioni'
    | 'Filtri & Aria'
    | 'Liquidi & Additivi'
    | 'Riparazioni Varie'
    | 'Lubrificanti & Olio'
    | 'Liquidi & Refrigeranti'
    | 'Lampadine & Fusibili'
    | 'Filtri & Candele'
    | 'Freni & Pastiglie'
    | 'Tergicristalli & Spazzole'
    | 'Batterie & Elettrico';
  giacenza: number;
  quantitaGiacenza?: number;
  unitaMisura: 'Litri' | 'Pezzi' | 'Flaconi' | 'Kit' | 'Kg' | 'Coppie';
  scortaMinima: number;
  compatibilitaMezzi?: string;
  fornitore?: string;
  costoUnitario: number;
  prezzoUnitario?: number;
  ubicazioneScaffale?: string;
  note?: string;
  dataUltimoCarico?: string;
}

// ---------------------------------------------------------------------------
// 3. MACRO CATEGORIA 4: CONTABILITÀ, TESSERAMENTO & NOTE DI DEBITO
// ---------------------------------------------------------------------------
export interface TesseraAssociativa {
  id: string;
  numeroTessera: string; // es. "TO-2026/042"
  annoSociale: number;
  socioNome: string;
  socioCognome: string;
  socioCodiceFiscale: string;
  qualifica: 'Volontario Soccorritore' | 'Operatore Centrale' | 'Socio Sostenitore' | 'Socio Onorario';
  quotaVersata: number; // 5.00 o 10.00
  dataEmissione: string; // YYYY-MM-DD
  dataScadenza: string; // YYYY-MM-DD (es. 31/12/2026)
  stato: 'Attiva' | 'Rinnovata' | 'Annullata' | 'Scaduta';
  motivoAnnullamento?: string;
  ricevutaNumero?: string;
  timbroCartaceo?: boolean;
}

export interface NotaDiDebito {
  id: string;
  numeroProgressivo: string; // es. "ND-2026/001"
  dataEmissione: string; // YYYY-MM-DD
  debitoreIntestatario: string; // es. "Azienda USL Toscana Nord Ovest"
  partitaIvaCodiceFiscale: string;
  indirizzoDebitore: string;
  causale: string; // es. "Servizio Trasporto Paziente Dializzato codice ORO-412"
  codiceServizioRiferimento?: string;
  importoTotale: number; // in euro
  scadenzaPagamento: string; // YYYY-MM-DD
  metodoPagamento: string; // es. "Bonifico Bancario - Credit Agricole (IBAN: IT79M...)" o "Bonifico Bancario IBAN"
  contoAccredito?: 'Credit Agricole' | 'Poste Italiane' | 'Altro' | string;
  ibanAccredito?: string;
  ccPostaleAccredito?: string;
  stato: 'Emessa' | 'Sollecitata' | 'Saldata' | 'Annullata';
  dataIncasso?: string;
  operatoreEmissione: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// 4. MACRO CATEGORIA 5: DATABASE FORMAZIONE / CORSI
// ---------------------------------------------------------------------------
export type TipologiaCorso =
  | 'Seminario PSV'
  | 'Formazione PSV'
  | 'Seminario Autisti'
  | 'BLSD'
  | 'Protezione Civile Corso 0'
  | 'Protezione Civile Corso Base';

export interface LezioneCorso {
  id: string;
  numero: number; // 1 .. 20
  titolo?: string; // es. "Incontro 1: Principi generali e normativa benessere animale"
  data: string; // YYYY-MM-DD
  orarioInizio: string; // HH:mm
  orarioFine: string; // HH:mm
  ore: number; // Durata ore lezione
  sedeSvolgimentoTipo?: 'sezione_salvata' | 'altro';
  sedeSvolgimentoSedeId?: string;
  sedeNome: string; // es. "Sede Legale Ronchi - Aula Magna" o "Polo Didattico Carrara"
  indirizzoCompleto: string;
  coordinate: {
    lat: number;
    lng: number;
  };
  docente?: string;
  note?: string;
}

export interface CorsoFormazione {
  id: string;
  codiceCorso: string; // es. "PSV-2026-01" o "CORSO-BLSD-2026-01"
  titolo: string; // es. "TUTELA, SOCCORSO E BENESSERE ANIMALE"
  sottotitolo?: string; // es. "“Dal Soccorso alla tutela degli animali”"
  tipologia: TipologiaCorso;
  descrizione: string;
  docenteFormatore: string;
  enteAccreditato: string; // es. "Regione Toscana / ANPAS"
  sedeCorso: string; // Sede organizzatrice principale
  dataInizio: string; // YYYY-MM-DD
  dataFine: string; // YYYY-MM-DD
  orarioInizioLezione?: string; // HH:mm
  orarioFineLezione?: string; // HH:mm
  oreTotali: number;
  oreMinimeFrequenza: number;
  percentualeMinimaPresenza?: number; // es. 80 (%)
  massimoPartecipanti: number;
  stato: 'Programmato' | 'In Corso' | 'Concluso' | 'Annullato';
  // Destinatari del corso per sezioni operative territoriali
  sezioniDestinatarieIds?: string[];
  sezioniDestinatarieNomi?: string[];
  // Sede di svolgimento predefinita per timbratura GPS
  sedeSvolgimentoTipo?: 'sezione_salvata' | 'altro';
  sedeSvolgimentoSedeId?: string;
  indirizzoCompleto?: string;
  coordinate?: {
    lat: number;
    lng: number;
  };
  // Programma fino a 20 lezioni in giorni, orari e sedi diverse
  lezioni?: LezioneCorso[];
  // Mansione operativa rilasciata automaticamente al superamento del corso/esame
  mansioneRilasciata?: string;
  // Se è previsto un esame finale di valutazione
  prevedeEsame?: boolean;
  // Mansione prerequisito che il volontario deve già possedere per accedere al corso
  mansionePrerequisito?: string;
  iscritti: PartecipanteCorso[];
}

export interface DatiTimbraturaGPSCorso {
  orario: string; // HH:mm
  data: string; // YYYY-MM-DD
  coordinate?: { lat: number; lng: number };
  distanzaMetri?: number;
  confermata?: boolean;
}

export interface TimbraturaLezioneGPS {
  lezioneId: string;
  lezioneNumero: number;
  data: string;
  timbraturaEntrata?: DatiTimbraturaGPSCorso | string;
  timbraturaUscita?: DatiTimbraturaGPSCorso | string;
  sedeLezioneNome?: string;
  distanzaEntrataMetri?: number;
  distanzaUscitaMetri?: number;
  oreFrequentate?: number; // ore decimali, es. 2.5
  minutiFrequentati?: number; // minuti effettivi calcolati, es. 150
  oreEMinutiTesto?: string; // es. "2h 30m"
  confermata?: boolean;
}

export interface PartecipanteCorso {
  volontarioId: string;
  volontarioNome: string;
  qualifica: string;
  oreFrequentate: number; // ore totali calcolate
  minutiFrequentatiTotali?: number; // minuti totali calcolati
  oreEMinutiTesto?: string; // es. "5h 15m"
  esito: 'Iscritto' | 'In Frequenza' | 'Idoneo / Superato' | 'Non Idoneo' | 'Ritirato';
  // Esito esame specifico se il corso prevede esame finale
  esitoEsame?: 'Superato' | 'Non Superato' | 'In Attesa Esame' | 'Non Previsto';
  votoEsame?: string | number;
  mansioneAssegnataAutomatica?: boolean;
  tipoAttestato?: 'partecipazione' | 'idoneita';
  numeroAttestato?: string; // es. "GEV-099" per Seminario PSV, "AUT-PART-001" per Seminario Autisti
  dataRilascioAttestato?: string;
  scadenzaBrevetto?: string; // es. +2 anni per BLSD
  // Timbrature GPS presenza per singola lezione
  timbratureLezioni?: TimbraturaLezioneGPS[];
  // Timbrature generali o prima lezione
  timbraturaEntrata?: DatiTimbraturaGPSCorso | string;
  timbraturaUscita?: DatiTimbraturaGPSCorso | string;
}

// ---------------------------------------------------------------------------
// 5. MACRO CATEGORIA 6: GESTIONE MAGAZZINO VESTIARIO ED ATTREZZATURE
// ---------------------------------------------------------------------------
export interface ArticoloVestiarioMagazzino {
  id: string;
  codiceArticolo: string;
  nome: string; // es. "Giacca Alta Visibilità 4 Stagioni"
  categoria: 'Giacche & Giubbotti' | 'Pantaloni Soccorso' | 'Polo & T-Shirt' | 'Felpe & Pile' | 'Calzature Antinfortunistiche' | 'DPI & Caschi';
  taglia: TagliaVestiario | string;
  giacenzaAttuale: number;
  scortaMinima: number;
  prezzoUnitarioFornitore?: number;
  fornitore?: string;
  ubicazioneScaffale: string;
}

export interface AttrezzaturaOperativa {
  id: string;
  codice: string; // es. "ATTR-RAD-04"
  nome: string; // es. "Radio Ricetrasmittente DMR Motorola DP4800"
  categoria: 'Telecomunicazioni & Radio' | 'Presidi Sanitari & Zaini' | 'Immobilizzazione (Spinali/Collari)' | 'Attrezzature Veterinarie' | 'Protezione Civile & Idrovore' | 'Illuminazione & Gruppi Elettrogeni';
  matricola: string;
  quantita: number;
  ubicazione: string; // es. "Magazzino Centrale Massa", "Sede Carrara", "A Bordo Mezzo T4609"
  stato: 'Operativa al 100%' | 'In Uso' | 'In Manutenzione' | 'Da Revisionare' | 'Dismessa';
  dataUltimaRevisione?: string;
  dataProssimaScadenzaRevisione?: string;
  assegnataA?: string;
  note?: string;
}

export interface MovimentoMagazzino {
  id: string;
  data: string; // YYYY-MM-DD HH:mm
  tipo: 'Carico Fornitore' | 'Scarico / Assegnazione' | 'Reso a Magazzino' | 'Dismissione / Danneggiato';
  articoloNome: string;
  quantita: number;
  destinatarioOOrigine: string; // es. "Volontario In Servizio" o "Fornitore Siggi Group"
  operatore: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// 6. MACRO CATEGORIA 7: DATABASE ANAGRAFICHE SEDI ASSOCIATIVE
// ---------------------------------------------------------------------------
export interface ContoCorrenteSede {
  id: string;
  banca: string; // es. "POSTE ITALIANE" o "Credit Agricole"
  iban: string; // es. "IT40P0760113600001007035676" o "IT79M0623024500000046980317"
  intestatario: string; // "CROCE ORO MASSA CARRARA ODV"
  numeroConto?: string; // es. C/C postale "00001007035676"
  tipo?: 'postale' | 'bancario';
  note?: string;
}

export interface SedeAssociativaCompleta {
  id: string;
  codice: string; // es. "SEDE-MASSA-LEJARE"
  nome: string;
  tipologia: 'Sede Legale & Territoriale' | 'Sede Operativa H24 & Centrale' | 'Sezione Territoriale' | 'Polo Logistico & Magazzino' | 'Postazione Convenzionata 118';
  indirizzoCompleto: string;
  comune: string;
  cap: string;
  provincia: string;
  telefonoFisso: string;
  cellulareEmergenza: string;
  email: string;
  pec?: string;
  responsabileSede: string;
  telefonoResponsabile: string;
  mezziAssegnati: string[]; // es. ["T4606", "T4609", "T4613"]
  dotazioniLocali: string[]; // es. ["Centrale Radio Fissa", "Defibrillatore DAE", "Posto Riposo Equipaggi", "Box Coperto Ambulanze", "Locale Magazzino"]
  orariOperativita: string; // es. "H24 7 giorni su 7"
  note?: string;
  coordinate: {
    lat: number;
    lng: number;
  };
  // Coordinate Bancarie e Postali ufficiali dell'Associazione
  intestatarioConti?: string;
  bancaPoste?: string;
  ibanPoste?: string;
  ccPostale?: string;
  bancaAppoggio?: string;
  ibanBanca?: string;
  contiCorrenti?: ContoCorrenteSede[];
}

// ---------------------------------------------------------------------------
// 7. MACRO CATEGORIA 8: CALENDARIO TURNI DI TUTTE LE SEDI OPERATIVE
// ---------------------------------------------------------------------------
export type RuoloTurno =
  | 'autista'
  | 'caposervizio'
  | 'soccorritore2'
  | 'terzoSoccorritore'
  | 'operatoreCentrale'
  | 'centralinista'
  | 'osservatore';

export interface CandidaturaTurno {
  id: string;
  volontarioId: string;
  volontarioNome: string;
  qualificaVolontario?: string;
  ruoloRichiesto: RuoloTurno;
  stato: 'In Attesa' | 'Approvato' | 'Rifiutato';
  dataRichiesta: string; // ISO string o formato data ora
  approvatoDa?: string; // nome operatore di centrale o admin che ha validato
  dataDecisione?: string;
  note?: string;
}

export interface TurnoSedeOperativa {
  id: string;
  sedeId: string;
  sedeNome: string;
  nomeTurno?: string; // Campo libero per nome/tipo turno personalizzato
  data: string; // YYYY-MM-DD
  fasciaOraria: 'Mattina (08:00 - 14:00)' | 'Pomeriggio (14:00 - 20:00)' | 'Notte (20:00 - 08:00)' | 'Reperibilità H24' | 'Servizio Ordinario Programmato' | string;
  orarioInizio: string; // HH:mm
  orarioFine: string; // HH:mm
  mezzoAssegnato?: string; // es. T4606
  statoCopertura: 'Coperto' | 'Parziale' | 'Scoperto';
  autista?: { id: string; nome: string };
  caposervizio?: { id: string; nome: string };
  soccorritore2?: { id: string; nome: string };
  terzoSoccorritore?: { id: string; nome: string };
  operatoreCentrale?: { id: string; nome: string };
  centralinista?: { id: string; nome: string };
  osservatore?: { id: string; nome: string };
  richiesteIscrizione?: CandidaturaTurno[];
  note?: string;
}

// ---------------------------------------------------------------------------
// 8. MACRO CATEGORIA 9: BACHECA DI SEZIONE / COMUNICAZIONI AI VOLONTARI
// ---------------------------------------------------------------------------
export interface CommentoBacheca {
  id: string;
  postPadreId: string;
  rispostaACommentoId?: string; // ID del commento a cui si risponde (annidamento risposte)
  rispostaANominativo?: string; // Nome della persona a cui si risponde
  autoreId?: string;
  autoreNome: string;
  autoreRuolo?: string; // 'Amministratore', 'Presidente', 'Volontario'
  testo: string;
  dataOra: string; // HH:mm del DD/MM/YYYY
  timestamp: number;
  likes?: string[]; // Array di nominativi o ID degli utenti che hanno messo like al commento
}

export interface ComunicazioneBacheca {
  id: string;
  titolo: string;
  contenuto: string;
  sezioneTargetId: string; // 'tutte' oppure id della sede (es. 'sede-massa-lejare')
  sezioneTargetNome: string; // 'Tutte le Sezioni' oppure nome della sede
  priorita: 'Ordinaria' | 'Importante' | 'Urgente';
  categoria: 'Comunicazione Generale' | 'Disposizioni Operative' | 'Formazione & Eventi' | 'Turni & Reperibilità' | 'Mezzi & Dotazioni';
  dataPubblicazione: string; // YYYY-MM-DD
  oraPubblicazione: string; // HH:mm
  autore: string;
  autoreId?: string;
  attiva: boolean;
  evidenziata?: boolean;
  allegatoNome?: string;
  likes?: string[]; // Array di nominativi o ID degli utenti che hanno messo like al post
  commenti?: CommentoBacheca[]; // Elenco commenti e risposte al post
}

// ---------------------------------------------------------------------------
// 9. MACRO CATEGORIA 10: CONTATTI FORNITORI / CLIENTI / DONATORI / OFFICINE
// ---------------------------------------------------------------------------
export type TipoContattoEsterno =
  | 'fornitore'
  | 'officina'
  | 'cliente_ente'
  | 'donatore'
  | 'altro';

export interface ContattoEsterno {
  id: string;
  tipo: TipoContattoEsterno;
  ragioneSociale: string; // Ragione sociale ditta o Nome Cognome persona fisica
  referente?: string;
  partitaIvaCodiceFiscale: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  telefono: string;
  email: string;
  pec?: string;
  iban?: string;
  note?: string;
  // Dati donazione per persone che hanno effettuato una donazione all'associazione a seguito di intervento
  donazioneOrigineIntervento?: {
    codiceServizio?: string;
    dataIntervento: string;
    importo: number;
    metodoPagamento?: 'Contanti' | 'POS' | 'Bonifico' | string;
    mezzo?: string;
    note?: string;
  };
  dataCreazione: string;
}

export interface IndirizzoCollezionato {
  id: string;
  nome: string; // Nome assegnato all'indirizzo (campo distinto dal testo dell'indirizzo)
  indirizzo: string; // Testo completo dell'indirizzo
  lat?: number;
  lng?: number;
  placeId?: string;
  googleMapsUri?: string;
  origine?: 'partenza' | 'destinazione' | 'entrambi' | 'manuale';
  note?: string;
  dataCreazione: string;
  dataUltimaModifica?: string;
  ultimoUtilizzo?: string;
  utilizzi?: number;
}

// ---------------------------------------------------------------------------
// 10. NOTIFICHE RICEVUTE ARCHIVIATE DALL'ACCOUNT (ARCHIVIO PERMANENTE, MAI CANCELLATE)
// ---------------------------------------------------------------------------
export type CategoriaNotificaAccount =
  | 'servizio'
  | 'radio'
  | 'bacheca'
  | 'commento'
  | 'turno'
  | 'corso'
  | 'sistema';

export interface NotificaRicevutaAccount {
  id: string;
  categoria: CategoriaNotificaAccount;
  titolo: string;
  messaggio: string;
  dataOra: string;
  timestamp: number;
  letta: boolean; // false = nuova / non letta (evidenziata), true = già letta
  priorita?: 'Urgente' | 'Importante' | 'Ordinaria';
  linkAzione?: {
    tipo: 'bacheca' | 'turno' | 'servizio' | 'corso' | 'radio';
    idRiferimento?: string;
  };
}

// ---------------------------------------------------------------------------
// 11. GIORNALE DI BORDO & BROGLIACCIO DI CENTRALE OPERATIVA
// ---------------------------------------------------------------------------
export type CategoriaGiornaleBordo =
  | 'ordinaria'
  | 'comunicazione_118'
  | 'guasto_mezzo'
  | 'passaggio_consegne'
  | 'chiamata_servizio'
  | 'disposizione'
  | 'urgente';

export interface PresaVisioneConsegna {
  operatoreNome: string;
  data: string;
  ora: string;
  timestamp: number;
}

export interface VoceGiornaleBordo {
  id: string;
  data: string; // GG/MM/AAAA (es. "12/11/2026")
  ora: string; // HH:mm:ss (orario automatico non modificabile)
  timestamp: number;
  operatoreId?: string;
  operatoreNome: string;
  testo: string;
  categoria: CategoriaGiornaleBordo;
  consegnaTurno?: boolean; // Se evidenziato come passaggio consegne per il turno successivo
  presaVisioneDa?: PresaVisioneConsegna[];
  mezzoCoinvolto?: string;
  allegatoCodiceServizio?: string;
}

