// Dati iniziali realistici e completi per il Portale Gestionale Amministratore Croce Oro Massa Carrara OdV
import {
  TimbraturaVolontario,
  LuogoTimbratura,
  MezzoFlotta,
  InterventoManutenzione,
  DotazioneMagazzinoMezzo,
  TesseraAssociativa,
  NotaDiDebito,
  CorsoFormazione,
  ArticoloVestiarioMagazzino,
  AttrezzaturaOperativa,
  MovimentoMagazzino,
  SedeAssociativaCompleta,
  ContoCorrenteSede,
  TurnoSedeOperativa,
  ComunicazioneBacheca,
  TariffaCostoServizio
} from '../types/adminTypes';
import { addDaysISODate, formatISODateItaly } from '../utils/italianTime';

const OGGI_ISO = formatISODateItaly();

// ---------------------------------------------------------------------------
// 1. REGISTRO TIMBRATURE INIZIALI & LUOGHI DI TIMBRATURA GPS CONFIGURABILI
// ---------------------------------------------------------------------------
export const LUOGHI_TIMBRATURA_DEFAULT: LuogoTimbratura[] = [
  {
    id: 'luogo-lejare',
    codice: 'TIMB-01-LEJARE',
    nome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)',
    indirizzo: 'Via Delle Jare, 9, 54100 Massa (MS)',
    coordinate: { lat: 44.01700, lng: 10.15121 },
    raggioMetri: 35,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Sede operativa principale H24, autoparco ambulanze e sala operativa'
  },
  {
    id: 'luogo-ronchi',
    codice: 'TIMB-02-RONCHI',
    nome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    indirizzo: 'Via Como, 12 Località Ronchi, 54100 Marina di Massa (MS)',
    coordinate: { lat: 43.99419, lng: 10.12367 },
    raggioMetri: 30,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Direzione generale, uffici amministrativi e aula formazione'
  },
  {
    id: 'luogo-fossone',
    codice: 'TIMB-03-FOSSONE',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    indirizzo: 'Strada Comunale di Monteverde, 49 Località Fossone, 54033 Carrara (MS)',
    coordinate: { lat: 44.066716, lng: 10.049207 },
    raggioMetri: 30,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Postazione territoriale ambulanze e presidio Carrara'
  },
  {
    id: 'luogo-pietrasanta',
    codice: 'TIMB-04-PIETRASANTA',
    nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)',
    indirizzo: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta, 55045 Pietrasanta (LU)',
    coordinate: { lat: 43.92771, lng: 10.20194 },
    raggioMetri: 25,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Presidio estivo e servizi secondari Versilia'
  },
  {
    id: 'luogo-aulla',
    codice: 'TIMB-05-AULLA',
    nome: 'Sezione Territoriale Lunigiana (Aulla)',
    indirizzo: 'Piazza Cavour / Piazza della Vittoria, 54011 Aulla (MS)',
    coordinate: { lat: 44.21455, lng: 9.96779 },
    raggioMetri: 30,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Distaccamento operativo protezione civile e trasporti sanitari Lunigiana'
  },
  {
    id: 'luogo-noa',
    codice: 'TIMB-06-NOA',
    nome: 'Presidio Ospedaliero NOA (Nuovo Ospedale Apuane)',
    indirizzo: 'Via Enrico Mattei 21, 54100 Massa (MS)',
    coordinate: { lat: 44.0258, lng: 10.1250 },
    raggioMetri: 80,
    tipo: 'presidio_sanitario',
    attivo: true,
    descrizione: 'Presidio ospedaliero e camera calda pronto soccorso'
  },
  {
    id: 'luogo-carrarafiere',
    codice: 'TIMB-07-CARRARAFIERE',
    nome: 'Complesso Fieristico CarraraFiere (Grandi Eventi)',
    indirizzo: 'Viale Maestri del Marmo, 54033 Marina di Carrara (MS)',
    coordinate: { lat: 44.0415, lng: 10.0380 },
    raggioMetri: 120,
    tipo: 'evento_manifestazione',
    attivo: true,
    descrizione: 'Postazione eventi fieristici, concerti e manifestazioni pubbliche'
  }
];

export const TIMBRATURE_INIZIALI: TimbraturaVolontario[] = [
  {
    id: 'timb-001',
    volontarioId: 'vol-156',
    volontarioNome: 'Claudio Simonini',
    qualifica: 'Autista Soccorritore',
    data: OGGI_ISO,
    orarioIngresso: '07:00',
    orarioUscita: '13:30',
    oreTotali: 6.5,
    sede: 'Sede Operativa Massa (Le Jare)',
    modificataDaAdmin: false,
    note: 'Turno mattutino completato regolarmente'
  },
  {
    id: 'timb-002',
    volontarioId: 'vol-104',
    volontarioNome: 'Sara Ferretti',
    qualifica: 'Soccorritore Avanzato (BLSD)',
    data: OGGI_ISO,
    orarioIngresso: '07:00',
    orarioUscita: '13:00',
    oreTotali: 6.0,
    sede: 'Sede Operativa Massa (Le Jare)',
    modificataDaAdmin: false,
    note: 'Caposervizio equipaggio in servizio'
  },
  {
    id: 'timb-003',
    volontarioId: 'vol-318',
    volontarioNome: 'Mattia Vignali',
    qualifica: 'Operatore Centrale Radio',
    data: OGGI_ISO,
    orarioIngresso: '08:00',
    orarioUscita: '14:00',
    oreTotali: 6.0,
    sede: 'Centrale Operativa Massa Ronchi',
    modificataDaAdmin: false,
    note: 'Presidio sala radio e dispatch emergenze'
  },
  {
    id: 'timb-004',
    volontarioId: 'vol-004',
    volontarioNome: 'Alessandro Conti',
    qualifica: 'Autista 4x4 Protezione Civile',
    data: '2026-10-19',
    orarioIngresso: '14:00',
    orarioUscita: '20:30',
    oreTotali: 6.5,
    sede: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    modificataDaAdmin: true,
    dataUltimaModifica: '2026-10-19 21:00',
    operatoreModifica: 'Amministratore',
    note: 'Orario uscita corretto da amministratore su richiesta del volontario (+30min recupero post-intervento)'
  },
  {
    id: 'timb-005',
    volontarioId: 'vol-005',
    volontarioNome: 'Francesca Esposito',
    qualifica: 'Soccorritore Base',
    data: '2026-10-19',
    orarioIngresso: '19:00',
    orarioUscita: '07:00',
    oreTotali: 12.0,
    sede: 'Sede Operativa Massa (Le Jare)',
    modificataDaAdmin: false,
    note: 'Turno di notte H24'
  }
];

// ---------------------------------------------------------------------------
// 2. DATABASE MEZZI, MANUTENZIONI E MAGAZZINO MEZZI
// ---------------------------------------------------------------------------
export const MEZZI_FLOTTA_INIZIALI: MezzoFlotta[] = [
  {
    id: 'mezzo-t4606',
    sigla: 'T4606',
    targa: 'FW186MS',
    modello: 'Peugeot Boxer 2.0 BlueHDi Ambulanza',
    annoImmatricolazione: 2021,
    tipo: 'Ambulanza Emergenza',
    flotta: 'vet',
    stato: 'Operativo',
    chilometraggioAttuale: 112480,
    sedeStazionamento: 'Massa (Le Jare)',
    scadenzaRevisione: '2026-11-20',
    scadenzaAssicurazione: '2026-12-31',
    scadenzaBollo: '2027-03-31',
    note: 'Ambulanza soccorso ordinario e trasferimenti'
  },
  {
    id: 'mezzo-t4607',
    sigla: 'T4607',
    targa: 'EY707MS',
    modello: 'Ford Ranger 4x4 Pick-Up con verricello e cassone',
    annoImmatricolazione: 2020,
    tipo: 'Fuoristrada 4x4',
    flotta: 'pc',
    stato: 'Operativo',
    chilometraggioAttuale: 95300,
    sedeStazionamento: 'Massa (Le Jare)',
    scadenzaRevisione: '2027-03-12',
    scadenzaAssicurazione: '2027-01-20',
    scadenzaBollo: '2027-04-30',
    note: 'Mezzo cassonato per taglio rami, rimozione ostacoli e fango'
  },
  {
    id: 'mezzo-t4608',
    sigla: 'T4608',
    targa: 'EV908CO',
    modello: 'Fiat Doblò 1.6 Multijet Combi Giallo Oro',
    annoImmatricolazione: 2019,
    tipo: 'Automedica',
    flotta: 'vet',
    stato: 'Operativo',
    chilometraggioAttuale: 138600,
    sedeStazionamento: 'Carrara (Fossone / Monteverde)',
    scadenzaRevisione: '2026-12-05',
    scadenzaAssicurazione: '2027-02-28',
    scadenzaBollo: '2027-04-30',
    note: 'Veicolo agile per borghi montani di Massa e Carrara (Colonnata, Torano)'
  },
  {
    id: 'mezzo-t4609',
    sigla: 'T4609',
    targa: 'FX469CO',
    modello: 'Fiat Ducato 2.3 JTD Soccorso Avanzato',
    annoImmatricolazione: 2022,
    tipo: 'Ambulanza Emergenza',
    flotta: 'vet',
    stato: 'Operativo',
    chilometraggioAttuale: 74250,
    sedeStazionamento: 'Massa (Le Jare)',
    scadenzaRevisione: '2027-04-15',
    scadenzaAssicurazione: '2027-01-31',
    scadenzaBollo: '2027-05-31',
    note: 'Ambulanza principale codici rossi e urgenze H24'
  },
  {
    id: 'mezzo-t4611',
    sigla: 'T4611',
    targa: 'GK811PC',
    modello: 'Renault Master Minibus 9 Posti con Pedana Disabili',
    annoImmatricolazione: 2023,
    tipo: 'Pulmino Disabili',
    flotta: 'pc',
    stato: 'Operativo',
    chilometraggioAttuale: 36150,
    sedeStazionamento: 'Massa (Ronchi)',
    scadenzaRevisione: '2027-10-15',
    scadenzaAssicurazione: '2027-04-01',
    scadenzaBollo: '2027-07-31',
    note: 'Trasporto squadre operative ed evacuazione sfollati / disabili'
  },
  {
    id: 'mezzo-t4613',
    sigla: 'T4613',
    targa: 'FZ513PC',
    modello: 'Kia Sportage 2.0 CRDi 4WD Allestimento PC',
    annoImmatricolazione: 2022,
    tipo: 'Fuoristrada 4x4',
    flotta: 'pc',
    stato: 'Operativo',
    chilometraggioAttuale: 62400,
    sedeStazionamento: 'Carrara (Fossone / Monteverde)',
    scadenzaRevisione: '2027-06-20',
    scadenzaAssicurazione: '2027-05-10',
    scadenzaBollo: '2027-08-31',
    note: 'Pattugliamento fiumi e interventi fuoristrada Protezione Civile'
  },
  {
    id: 'mezzo-t4614',
    sigla: 'T4614',
    targa: 'GA320MS',
    modello: 'Mercedes-Benz Sprinter 316 CDI',
    annoImmatricolazione: 2023,
    tipo: 'Ambulanza Trasporto',
    flotta: 'vet',
    stato: 'Operativo',
    chilometraggioAttuale: 48900,
    sedeStazionamento: 'Massa (Ronchi)',
    scadenzaRevisione: '2027-09-10',
    scadenzaAssicurazione: '2027-03-15',
    scadenzaBollo: '2027-06-30',
    note: 'Ambulanza allestita per lunghe percorrenze autostradali (Pisa, Firenze)'
  },
  {
    id: 'mezzo-t4615',
    sigla: 'T4615',
    targa: 'FT615LG',
    modello: 'Iveco Daily 35C15 Furgone Gran Volume',
    annoImmatricolazione: 2021,
    tipo: 'Furgone Logistico',
    flotta: 'pc',
    stato: 'In Manutenzione',
    chilometraggioAttuale: 128400,
    sedeStazionamento: 'Massa (Le Jare)',
    scadenzaRevisione: '2026-11-30',
    scadenzaAssicurazione: '2026-12-15',
    scadenzaBollo: '2027-03-31',
    motivoFuoriServizio: 'Sostituzione pastiglie e dischi freno anteriori programmata',
    operatoreSegnalazione: 'Amministratore',
    dataSegnalazione: '2026-10-18',
    note: 'Unità logistica mobile per tende e motopompe di emergenza'
  }
];

export const MANUTENZIONI_INIZIALI: InterventoManutenzione[] = [
  {
    id: 'manut-001',
    mezzoSigla: 'T4606',
    dataIntervento: '2026-09-12',
    tipoIntervento: 'Tagliando Ordinario',
    chilometraggioAlTagliando: 110000,
    officinaEsecutrice: 'Officina Autorizzata AutoMassa Srl',
    costoTotale: 420.0,
    descrizione: 'Cambio olio motore 5W30 sintetico, filtro olio, filtro gasolio, filtro antipolline abitacolo e rabbocco liquido radiatore.',
    fatturaNumero: 'FT-2026/891',
    eseguitoDa: 'Capo Meccanico Gianni',
    scadenzaProssimoInterventoKm: 130000,
    scadenzaProssimaData: '2027-09-12'
  },
  {
    id: 'manut-002',
    mezzoSigla: 'T4609',
    dataIntervento: '2026-08-04',
    tipoIntervento: 'Pneumatici',
    chilometraggioAlTagliando: 71500,
    officinaEsecutrice: 'Pneus Service Carrara',
    costoTotale: 680.0,
    descrizione: 'Installazione treno 4 pneumatici 4 stagioni Michelin Agilis CrossClimate rinforzati per ambulanza, bilanciatura e convergenza laser.',
    fatturaNumero: 'FT-2026/412',
    eseguitoDa: 'Pneus Service',
    scadenzaProssimoInterventoKm: 110000,
    scadenzaProssimaData: '2027-11-01'
  },
  {
    id: 'manut-003',
    mezzoSigla: 'T4613',
    dataIntervento: '2026-07-18',
    tipoIntervento: 'Allestimento Sanitario',
    chilometraggioAlTagliando: 58000,
    officinaEsecutrice: 'Allestimenti Emergenza Toscana',
    costoTotale: 350.0,
    descrizione: 'Revisione barra lampeggiante LED blu, sirena bitonale omologata e cablaggio antenna radio VHF sul tetto.',
    fatturaNumero: 'FT-2026/194',
    eseguitoDa: 'Tecnico Elettrauto Marco'
  }
];

export const MAGAZZINO_MEZZI_INIZIALE: DotazioneMagazzinoMezzo[] = [];

// ---------------------------------------------------------------------------
// 3. CONTABILITÀ: TESSERAMENTO & NOTE DI DEBITO
// ---------------------------------------------------------------------------
export const TESSERE_INIZIALI: TesseraAssociativa[] = [
  {
    id: 'tess-001',
    numeroTessera: 'VOL-387',
    annoSociale: 2026,
    socioNome: 'Mattia',
    socioCognome: 'Vignali',
    socioCodiceFiscale: 'VGNMTT10A30F023X',
    qualifica: 'Volontario Soccorritore',
    quotaVersata: 5.0,
    dataEmissione: '2026-10-18',
    dataScadenza: '2026-12-31',
    stato: 'Rinnovata',
    ricevutaNumero: '01/2026',
    timbroCartaceo: true
  },
  {
    id: 'tess-002',
    numeroTessera: 'VOL-156',
    annoSociale: 2026,
    socioNome: 'Claudio',
    socioCognome: 'Simonini',
    socioCodiceFiscale: 'SMNCLD72H14E625U',
    qualifica: 'Volontario Soccorritore',
    quotaVersata: 5.0,
    dataEmissione: '2026-01-10',
    dataScadenza: '2026-12-31',
    stato: 'Rinnovata',
    ricevutaNumero: '02/2026',
    timbroCartaceo: true
  },
  {
    id: 'tess-003',
    numeroTessera: 'VOL-104',
    annoSociale: 2026,
    socioNome: 'Sara',
    socioCognome: 'Ferretti',
    socioCodiceFiscale: 'FRRSRA92D50E625K',
    qualifica: 'Volontario Soccorritore',
    quotaVersata: 5.0,
    dataEmissione: '2026-01-15',
    dataScadenza: '2026-12-31',
    stato: 'Rinnovata',
    ricevutaNumero: '03/2026',
    timbroCartaceo: true
  },
  {
    id: 'tess-004',
    numeroTessera: 'VOL-108',
    annoSociale: 2026,
    socioNome: 'Alessandro',
    socioCognome: 'Conti',
    socioCodiceFiscale: 'CNTLSN88C12E625M',
    qualifica: 'Volontario Soccorritore',
    quotaVersata: 5.0,
    dataEmissione: '2026-02-01',
    dataScadenza: '2026-12-31',
    stato: 'Attiva',
    ricevutaNumero: '04/2026',
    timbroCartaceo: true
  }
];

export const NOTE_DI_DEBITO_INIZIALI: NotaDiDebito[] = [
  {
    id: 'nd-001',
    numeroProgressivo: 'ND-2026/001',
    dataEmissione: '2026-10-05',
    debitoreIntestatario: 'Azienda USL Toscana Nord Ovest',
    partitaIvaCodiceFiscale: '02198590503',
    indirizzoDebitore: 'Via Monterotondo 49, 57128 Livorno (LI)',
    causale: 'Convenzione Trasporto Sanitario Ordinario Pazienti Nefropatici Dialisi Mese Settembre 2026',
    codiceServizioRiferimento: 'CONV-DIALISI-SETT26',
    importoTotale: 1840.50,
    scadenzaPagamento: '2026-11-30',
    metodoPagamento: 'Bonifico Bancario - Credit Agricole (IBAN: IT79M0623024500000046980317)',
    contoAccredito: 'Credit Agricole',
    ibanAccredito: 'IT79M0623024500000046980317',
    stato: 'Emessa',
    operatoreEmissione: 'Tesoriera Croce Oro',
    note: 'Fatturazione elettronica SDI inviata con codice univoco UFX912'
  },
  {
    id: 'nd-002',
    numeroProgressivo: 'ND-2026/002',
    dataEmissione: '2026-10-10',
    debitoreIntestatario: 'Clinica San Camillo Srl',
    partitaIvaCodiceFiscale: '00349810452',
    indirizzoDebitore: 'Via Poggioletto 14, 54100 Massa (MS)',
    causale: 'Trasporto Protetto con Ambulanza T4614 per trasferimento paziente a Ospedale Cisanello Pisa',
    codiceServizioRiferimento: 'SERV-TRAS-2026-1008',
    importoTotale: 280.00,
    scadenzaPagamento: '2026-11-10',
    metodoPagamento: 'Bonifico Bancario - Credit Agricole (IBAN: IT79M0623024500000046980317)',
    contoAccredito: 'Credit Agricole',
    ibanAccredito: 'IT79M0623024500000046980317',
    stato: 'Saldata',
    dataIncasso: '2026-10-18',
    operatoreEmissione: 'Amministrazione',
    note: 'Incasso pervenuto con bonifico su c/c Crédit Agricole'
  },
  {
    id: 'nd-003',
    numeroProgressivo: 'ND-2026/003',
    dataEmissione: '2026-10-15',
    debitoreIntestatario: 'Comitato Organizzatore Gran Fondo Alpi Apuane',
    partitaIvaCodiceFiscale: '92049180459',
    indirizzoDebitore: 'Piazza Aranci, 54100 Massa (MS)',
    causale: 'Presidio Sanitario con 2 Ambulanze e Squadra Soccorritori a terra per manifestazione ciclistica',
    codiceServizioRiferimento: 'EVENTO-GF-APUANE-2026',
    importoTotale: 650.00,
    scadenzaPagamento: '2026-10-31',
    metodoPagamento: 'Bonifico Bancario / Postale - Poste Italiane (IBAN: IT40P0760113600001007035676)',
    contoAccredito: 'Poste Italiane',
    ibanAccredito: 'IT40P0760113600001007035676',
    ccPostaleAccredito: '00001007035676',
    stato: 'Emessa',
    operatoreEmissione: 'Responsabile Operativo',
    note: 'Richiesta liquidazione entro fine mese'
  }
];

// ---------------------------------------------------------------------------
// 4. FORMAZIONE / CORSI (Nessun corso precaricato a sistema)
// ---------------------------------------------------------------------------
export const LEGACY_MOCK_CORSI_IDS: string[] = [
  'corso-psv-01',
  'corso-aut-01',
  'corso-blsd-01',
  'corso-pc0-01',
  'corso-pcbase-01',
  'corso-form-psv-01'
];

export const CORSI_FORMAZIONE_INIZIALI: CorsoFormazione[] = [];

// ---------------------------------------------------------------------------
// 5. GESTIONE MAGAZZINO VESTIARIO ED ATTREZZATURE
// ---------------------------------------------------------------------------
export const MAGAZZINO_VESTIARIO_INIZIALE: ArticoloVestiarioMagazzino[] = [
  {
    id: 'vest-001',
    codiceArticolo: 'GIAC-INV-M',
    nome: 'Giubbotto Invernale Termico Impermeabile Alta Visibilità',
    categoria: 'Giacche & Giubbotti',
    taglia: 'M',
    giacenzaAttuale: 12,
    scortaMinima: 5,
    prezzoUnitarioFornitore: 85.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'giubbottoInvernale',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 2'
  },
  {
    id: 'vest-002',
    codiceArticolo: 'GIAC-INV-L',
    nome: 'Giubbotto Invernale Termico Impermeabile Alta Visibilità',
    categoria: 'Giacche & Giubbotti',
    taglia: 'L',
    giacenzaAttuale: 15,
    scortaMinima: 6,
    prezzoUnitarioFornitore: 85.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'giubbottoInvernale',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 3'
  },
  {
    id: 'vest-003',
    codiceArticolo: 'GIUB-OP-M',
    nome: 'Giubbetto Operativo / Gilet Mezza Stagione',
    categoria: 'Giacche & Giubbotti',
    taglia: 'M',
    giacenzaAttuale: 10,
    scortaMinima: 4,
    prezzoUnitarioFornitore: 48.0,
    cauzione: 45.0,
    chiaveVestiarioAccount: 'giubbetto',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 4'
  },
  {
    id: 'vest-003b',
    codiceArticolo: 'GIUB-OP-L',
    nome: 'Giubbetto Operativo / Gilet Mezza Stagione',
    categoria: 'Giacche & Giubbotti',
    taglia: 'L',
    giacenzaAttuale: 12,
    scortaMinima: 4,
    prezzoUnitarioFornitore: 48.0,
    cauzione: 45.0,
    chiaveVestiarioAccount: 'giubbetto',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 4'
  },
  {
    id: 'vest-004',
    codiceArticolo: 'PANT-SOCC-M',
    nome: 'Pantaloni Operativi Soccorso con Bande Rifrangenti',
    categoria: 'Pantaloni Soccorso',
    taglia: 'M',
    giacenzaAttuale: 18,
    scortaMinima: 8,
    prezzoUnitarioFornitore: 52.0,
    cauzione: 30.0,
    chiaveVestiarioAccount: 'pantaloni',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio B2 - Ripiano 1'
  },
  {
    id: 'vest-005',
    codiceArticolo: 'PANT-SOCC-L',
    nome: 'Pantaloni Operativi Soccorso con Bande Rifrangenti',
    categoria: 'Pantaloni Soccorso',
    taglia: 'L',
    giacenzaAttuale: 14,
    scortaMinima: 8,
    prezzoUnitarioFornitore: 52.0,
    cauzione: 30.0,
    chiaveVestiarioAccount: 'pantaloni',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio B2 - Ripiano 2'
  },
  {
    id: 'vest-006',
    codiceArticolo: 'TSHIRT-CROCE-M',
    nome: 'T-Shirt / Polo Istituzionale Giallo Fluo / Blu Navy',
    categoria: 'Polo & T-Shirt',
    taglia: 'M',
    giacenzaAttuale: 25,
    scortaMinima: 10,
    prezzoUnitarioFornitore: 22.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'tshirt',
    fornitore: 'Confezioni Toscane',
    ubicazioneScaffale: 'Scatolone C3'
  },
  {
    id: 'vest-007',
    codiceArticolo: 'TSHIRT-CROCE-L',
    nome: 'T-Shirt / Polo Istituzionale Giallo Fluo / Blu Navy',
    categoria: 'Polo & T-Shirt',
    taglia: 'L',
    giacenzaAttuale: 30,
    scortaMinima: 10,
    prezzoUnitarioFornitore: 22.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'tshirt',
    fornitore: 'Confezioni Toscane',
    ubicazioneScaffale: 'Scatolone C3'
  },
  {
    id: 'vest-010',
    codiceArticolo: 'FELPA-ZIP-M',
    nome: 'Felpa con Zip Istituzionale Ricamata',
    categoria: 'Felpe & Pile',
    taglia: 'M',
    giacenzaAttuale: 16,
    scortaMinima: 5,
    prezzoUnitarioFornitore: 34.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'felpa',
    fornitore: 'Confezioni Toscane',
    ubicazioneScaffale: 'Armadio C1 - Ripiano 1'
  },
  {
    id: 'vest-011',
    codiceArticolo: 'FELPA-ZIP-L',
    nome: 'Felpa con Zip Istituzionale Ricamata',
    categoria: 'Felpe & Pile',
    taglia: 'L',
    giacenzaAttuale: 16,
    scortaMinima: 5,
    prezzoUnitarioFornitore: 34.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'felpa',
    fornitore: 'Confezioni Toscane',
    ubicazioneScaffale: 'Armadio C1 - Ripiano 2'
  },
  {
    id: 'vest-012',
    codiceArticolo: 'PILE-AV-M',
    nome: 'Pile Termico Alta Visibilità',
    categoria: 'Felpe & Pile',
    taglia: 'M',
    giacenzaAttuale: 12,
    scortaMinima: 4,
    prezzoUnitarioFornitore: 29.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'pile',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio C2 - Ripiano 1'
  },
  {
    id: 'vest-013',
    codiceArticolo: 'PILE-AV-L',
    nome: 'Pile Termico Alta Visibilità',
    categoria: 'Felpe & Pile',
    taglia: 'L',
    giacenzaAttuale: 14,
    scortaMinima: 4,
    prezzoUnitarioFornitore: 29.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'pile',
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio C2 - Ripiano 2'
  },
  {
    id: 'vest-008',
    codiceArticolo: 'SCARP-S3-42',
    nome: 'Scarpe Antinfortunistiche Soccorso S3 SRC Puntale Composito',
    categoria: 'Calzature Antinfortunistiche',
    taglia: '42',
    giacenzaAttuale: 8,
    scortaMinima: 4,
    prezzoUnitarioFornitore: 78.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'dpi',
    fornitore: 'Base Protection',
    ubicazioneScaffale: 'Scarpiera Magazzino Basso'
  },
  {
    id: 'vest-009',
    codiceArticolo: 'SCARP-S3-43',
    nome: 'Scarpe Antinfortunistiche Soccorso S3 SRC Puntale Composito',
    categoria: 'Calzature Antinfortunistiche',
    taglia: '43',
    giacenzaAttuale: 7,
    scortaMinima: 4,
    prezzoUnitarioFornitore: 78.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'dpi',
    fornitore: 'Base Protection',
    ubicazioneScaffale: 'Scarpiera Magazzino Basso'
  },
  {
    id: 'vest-014',
    codiceArticolo: 'DPI-CASCO-UNI',
    nome: 'Casco & Kit DPI Operativi (Guanti + Occhiali + Maschera)',
    categoria: 'DPI & Caschi',
    taglia: 'Unica',
    giacenzaAttuale: 15,
    scortaMinima: 5,
    prezzoUnitarioFornitore: 42.0,
    cauzione: 0,
    chiaveVestiarioAccount: 'dpi',
    fornitore: 'Base Protection',
    ubicazioneScaffale: 'Armadio DPI D1'
  }
];

export const TARIFFE_COSTI_SERVIZIO_INIZIALI: TariffaCostoServizio[] = [
  {
    id: 'cost-km-01',
    categoria: 'mezzo_km',
    siglaBreve: 'KM',
    descrizioneSigla: 'Tariffa chilometrica percorrenza mezzo di soccorso / veterinario',
    nomeVoce: 'Costo Mezzo al KM',
    importoUnitario: 1.2,
    unitaMisura: '€/km',
    attivo: true
  },
  {
    id: 'cost-usc-01',
    categoria: 'uscita_mezzo',
    siglaBreve: 'USC',
    descrizioneSigla: 'Diritto fisso di uscita e approntamento mezzo operativo',
    nomeVoce: 'Costo Uscita Mezzo',
    importoUnitario: 35.0,
    unitaMisura: '€/uscita',
    attivo: true
  },
  {
    id: 'cost-op-01',
    categoria: 'operatore',
    siglaBreve: 'OP',
    descrizioneSigla: 'Impiego orario singolo operatore / soccorritore / autista in servizio',
    nomeVoce: 'Costo Operatore Orario',
    importoUnitario: 18.0,
    unitaMisura: '€/ora',
    attivo: true
  },
  {
    id: 'cost-ed-01',
    categoria: 'editabile',
    siglaBreve: 'ATT',
    descrizioneSigla: 'Intervento di assistenza ad atto esecutivo / ufficiale giudiziario',
    nomeVoce: 'Assistenza Atto Esecutivo',
    importoUnitario: 50.0,
    unitaMisura: '€/servizio',
    attivo: true
  }
];

export const ATTREZZATURE_INIZIALI: AttrezzaturaOperativa[] = [
  {
    id: 'attr-001',
    codice: 'RAD-DMR-01',
    nome: 'Radio Portatile DMR Motorola DP4800e con Microfono Parlatore',
    categoria: 'Telecomunicazioni & Radio',
    matricola: 'MOT-7849102',
    quantita: 1,
    ubicazione: 'Centrale Sala Radio Massa Ronchi',
    stato: 'Operativa al 100%',
    dataUltimaRevisione: '2026-09-01',
    dataProssimaScadenzaRevisione: '2027-09-01',
    note: 'Batteria Litio potenziata a lunga durata'
  },
  {
    id: 'attr-002',
    codice: 'RAD-DMR-02',
    nome: 'Radio Portatile DMR Motorola DP4800e con Cinghia Pettorale',
    categoria: 'Telecomunicazioni & Radio',
    matricola: 'MOT-7849103',
    quantita: 1,
    ubicazione: 'A Bordo Mezzo T4609',
    stato: 'In Uso',
    dataUltimaRevisione: '2026-09-01',
    dataProssimaScadenzaRevisione: '2027-09-01'
  },
  {
    id: 'attr-003',
    codice: 'CHIP-READER-01',
    nome: 'Lettore Universale Microchip ISO FDX-B / HDX con Bluetooth',
    categoria: 'Attrezzature Veterinarie',
    matricola: 'HAL-CHIP-9901',
    quantita: 1,
    ubicazione: 'A Bordo Mezzo T4606',
    stato: 'Operativa al 100%',
    dataUltimaRevisione: '2026-08-15',
    dataProssimaScadenzaRevisione: '2027-08-15',
    note: 'Testato con microchip felini e canini'
  },
  {
    id: 'attr-004',
    codice: 'ZAINO-EMERG-01',
    nome: 'Zaino Tecnico Soccorso Avanzato Rosso con 5 Borselli Modulari',
    categoria: 'Presidi Sanitari & Zaini',
    matricola: 'ZN-RED-442',
    quantita: 1,
    ubicazione: 'A Bordo Mezzo T4609',
    stato: 'Operativa al 100%',
    dataUltimaRevisione: '2026-10-01',
    dataProssimaScadenzaRevisione: '2027-04-01',
    note: 'Controllata scadenza garze sterili, deflussori e cannule'
  },
  {
    id: 'attr-005',
    codice: 'SPIN-ADULT-01',
    nome: 'Tavola Spinale Adulto in Polietilene Alta Densità con Cinghie Ragno e Fermacapo',
    categoria: 'Immobilizzazione (Spinali/Collari)',
    matricola: 'SP-FERNO-118',
    quantita: 1,
    ubicazione: 'A Bordo Mezzo T4606',
    stato: 'Operativa al 100%',
    dataUltimaRevisione: '2026-05-10',
    dataProssimaScadenzaRevisione: '2027-05-10'
  },
  {
    id: 'attr-006',
    codice: 'MOTOPOMPA-PC-01',
    nome: 'Motopompa Idrovora Carrellata Autoadescante 1200 L/min',
    categoria: 'Protezione Civile & Idrovore',
    matricola: 'IDRO-HONDA-55',
    quantita: 1,
    ubicazione: 'Magazzino Logistico Massa (Le Jare)',
    stato: 'Operativa al 100%',
    dataUltimaRevisione: '2026-09-20',
    dataProssimaScadenzaRevisione: '2027-03-20',
    note: 'Livello olio motore e tubo spiralato 4 pollici in perfette condizioni'
  }
];

export const MOVIMENTI_MAGAZZINO_INIZIALI: MovimentoMagazzino[] = [
  {
    id: 'mov-001',
    data: '2026-10-14 10:30',
    tipo: 'Carico Fornitore',
    articoloNome: 'Giacca Alta Visibilità 4 Stagioni EN ISO 20471 (Taglia L)',
    quantita: 10,
    destinatarioOOrigine: 'Fornitore Siggi Group SpA (DDT 8941/26)',
    operatore: 'Responsabile Magazzino',
    note: 'Consegna lotto invernale divise operative'
  },
  {
    id: 'mov-002',
    data: '2026-10-15 15:45',
    tipo: 'Scarico / Assegnazione',
    articoloNome: 'Pantaloni Soccorso Bielastici (Taglia M)',
    quantita: 1,
    destinatarioOOrigine: 'Volontario Claudio Simonini',
    operatore: 'Amministratore',
    note: 'Assegnazione dotazione con versamento cauzione regolamentare €30,00'
  }
];

// ---------------------------------------------------------------------------
// 6. ANAGRAFICHE SEDI ASSOCIATIVE
// ---------------------------------------------------------------------------
// Coordinate bancarie e postali ufficiali dell'Associazione Croce Oro Massa Carrara ODV
export const CONTI_CORRENTI_CROCE_ORO_DEFAULT: ContoCorrenteSede[] = [
  {
    id: 'cc-poste-italiane',
    banca: 'POSTE ITALIANE',
    iban: 'IT40P0760113600001007035676',
    intestatario: 'CROCE ORO MASSA CARRARA ODV',
    numeroConto: '00001007035676',
    tipo: 'postale',
    note: 'Conto Corrente Postale Ufficiale OdV (C/C n. 00001007035676)'
  },
  {
    id: 'cc-credit-agricole',
    banca: 'Credit Agricole',
    iban: 'IT79M0623024500000046980317',
    intestatario: 'CROCE ORO MASSA CARRARA ODV',
    tipo: 'bancario',
    note: 'Conto Corrente Bancario Istituzionale OdV'
  }
];

export const SEDI_ASSOCIATIVE_INIZIALI: SedeAssociativaCompleta[] = [
  {
    id: 'sede-massa-ronchi',
    codice: 'SEDE-01-RONCHI',
    nome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    tipologia: 'Sede Legale & Territoriale',
    indirizzoCompleto: 'Via Como, 12 Località Ronchi',
    comune: 'Massa',
    cap: '54100',
    provincia: 'MS',
    telefonoFisso: '0585 625410',
    cellulareEmergenza: '333 4455667',
    email: 'croceoromassacarrara@gmail.com',
    pec: 'croceoromassacarrara@pec.it',
    responsabileSede: 'Presidente del Consiglio Direttivo',
    telefonoResponsabile: '0585 625410',
    mezziAssegnati: ['T4611', 'T4614'],
    dotazioniLocali: [
      'Uffici Direzione & Presidenza',
      'Sala Riunioni Consiglio Direttivo',
      'Aula Corsi Formazione & BLSD',
      'Archivio Fiscale & Tesseramento',
      'Defibrillatore DAE Pubblico a Parete'
    ],
    orariOperativita: 'Uffici Lun-Ven 09:00 - 18:00 • Presidio 24/7',
    note: 'Sede Legale e Territoriale di Massa situata dietro il Parco della Comasca a Ronchi',
    coordinate: {
      lat: 43.99419,
      lng: 10.12367
    },
    intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
    bancaPoste: 'POSTE ITALIANE',
    ibanPoste: 'IT40P0760113600001007035676',
    ccPostale: '00001007035676',
    bancaAppoggio: 'Credit Agricole',
    ibanBanca: 'IT79M0623024500000046980317',
    contiCorrenti: CONTI_CORRENTI_CROCE_ORO_DEFAULT
  },
  {
    id: 'sede-massa-lejare',
    codice: 'SEDE-02-LEJARE',
    nome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)',
    tipologia: 'Sede Operativa H24 & Centrale',
    indirizzoCompleto: 'Via Delle Jare, 9',
    comune: 'Massa',
    cap: '54100',
    provincia: 'MS',
    telefonoFisso: '0585 625410',
    cellulareEmergenza: '333 4455668',
    email: 'centrale.operativa@croceoromassacarrara.it',
    responsabileSede: 'Coordinatore Operativo H24',
    telefonoResponsabile: '333 4455668',
    mezziAssegnati: ['T4606', 'T4607', 'T4609', 'T4615'],
    dotazioniLocali: [
      'Centrale Operativa Radio & Telecomunicazioni H24',
      'Autoparco Coperto con colonnine ricarica e ossigeno',
      'Locale Riposo Equipaggi con letti e spogliatoi',
      'Magazzino Farmaci, Presidi Sanitari e DPI',
      'Lavaggio e Sanificazione Mezzi con ozonizzatore'
    ],
    orariOperativita: 'Operativo H24 365 Giorni all\'Anno',
    note: 'Cuore operativo delle emergenze, autoparco ambulanze e base radio principale',
    coordinate: {
      lat: 44.01700,
      lng: 10.15121
    },
    intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
    bancaPoste: 'POSTE ITALIANE',
    ibanPoste: 'IT40P0760113600001007035676',
    ccPostale: '00001007035676',
    bancaAppoggio: 'Credit Agricole',
    ibanBanca: 'IT79M0623024500000046980317',
    contiCorrenti: CONTI_CORRENTI_CROCE_ORO_DEFAULT
  },
  {
    id: 'sede-carrara-fossone',
    codice: 'SEDE-03-FOSSONE',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    tipologia: 'Sezione Territoriale',
    indirizzoCompleto: 'Strada Comunale di Monteverde, 49 Località Fossone',
    comune: 'Carrara',
    cap: '54033',
    provincia: 'MS',
    telefonoFisso: '0585 625410',
    cellulareEmergenza: '333 4455669',
    email: 'carrara@croceoromassacarrara.it',
    responsabileSede: 'Referente Sezione Carrara',
    telefonoResponsabile: '333 4455669',
    mezziAssegnati: ['T4608', 'T4613'],
    dotazioniLocali: [
      'Presidio Territoriale di Soccorso',
      'Postazione Radio VHF Sincronizzata',
      'Gabbie Barellate per Ricovero Temporaneo Animali Feriti',
      'Locale Volontari e Accoglienza Cittadini'
    ],
    orariOperativita: 'Presidio Operativo H24',
    note: 'Presidio strategico per il territorio comunale di Carrara e borghi a monte',
    coordinate: {
      lat: 44.066716,
      lng: 10.049207
    },
    intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
    bancaPoste: 'POSTE ITALIANE',
    ibanPoste: 'IT40P0760113600001007035676',
    ccPostale: '00001007035676',
    bancaAppoggio: 'Credit Agricole',
    ibanBanca: 'IT79M0623024500000046980317',
    contiCorrenti: CONTI_CORRENTI_CROCE_ORO_DEFAULT
  },
  {
    id: 'sede-pietrasanta',
    codice: 'SEDE-04-PIETRASANTA',
    nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)',
    tipologia: 'Sezione Territoriale',
    indirizzoCompleto: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta',
    comune: 'Pietrasanta',
    cap: '55045',
    provincia: 'LU',
    telefonoFisso: '0585 625410',
    cellulareEmergenza: '333 4455670',
    email: 'versilia@croceoromassacarrara.it',
    responsabileSede: 'Delegato Territoriale Versilia',
    telefonoResponsabile: '333 4455670',
    mezziAssegnati: ['T4608'],
    dotazioniLocali: [
      'Postazione Operativa Territoriale',
      'Punto Informativo Iscrizioni e Protezione Civile'
    ],
    orariOperativita: 'Presidio stagionale ed emergenze convenzionate',
    coordinate: {
      lat: 43.92771,
      lng: 10.20194
    },
    intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
    bancaPoste: 'POSTE ITALIANE',
    ibanPoste: 'IT40P0760113600001007035676',
    ccPostale: '00001007035676',
    bancaAppoggio: 'Credit Agricole',
    ibanBanca: 'IT79M0623024500000046980317',
    contiCorrenti: CONTI_CORRENTI_CROCE_ORO_DEFAULT
  },
  {
    id: 'sede-lunigiana',
    codice: 'SEDE-05-LUNIGIANA',
    nome: 'Sezione Territoriale Lunigiana (Aulla)',
    tipologia: 'Sezione Territoriale',
    indirizzoCompleto: 'Piazza Cavour / Piazza della Vittoria',
    comune: 'Aulla',
    cap: '54011',
    provincia: 'MS',
    telefonoFisso: '0585 625410',
    cellulareEmergenza: '333 4455671',
    email: 'lunigiana@croceoromassacarrara.it',
    responsabileSede: 'Referente Zona Lunigiana',
    telefonoResponsabile: '333 4455671',
    mezziAssegnati: ['T4613'],
    dotazioniLocali: [
      'Presidio Protezione Civile & Monitoraggio Idraulico Magra'
    ],
    orariOperativita: 'Attivazione in allerta meteo e interventi programmati',
    coordinate: {
      lat: 44.21455,
      lng: 9.96779
    },
    intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
    bancaPoste: 'POSTE ITALIANE',
    ibanPoste: 'IT40P0760113600001007035676',
    ccPostale: '00001007035676',
    bancaAppoggio: 'Credit Agricole',
    ibanBanca: 'IT79M0623024500000046980317',
    contiCorrenti: CONTI_CORRENTI_CROCE_ORO_DEFAULT
  }
];

// ---------------------------------------------------------------------------
// 7. CALENDARIO TURNI OPERATIVI DELLE SEDI
// ---------------------------------------------------------------------------
export const TURNI_SEDI_INIZIALI: TurnoSedeOperativa[] = [
  {
    id: 'turno-oggi-massa-mattina',
    sedeId: 'sede-massa-lejare',
    sedeNome: 'Sede Operativa Massa (Le Jare)',
    data: OGGI_ISO,
    fasciaOraria: 'Mattina (08:00 - 14:00)',
    orarioInizio: '08:00',
    orarioFine: '14:00',
    mezzoAssegnato: 'T4609',
    statoCopertura: 'Coperto',
    autista: { id: 'vol-156', nome: 'Claudio Simonini' },
    caposervizio: { id: 'vol-104', nome: 'Sara Ferretti' },
    soccorritore2: { id: 'vol-005', nome: 'Francesca Esposito' },
    operatoreCentrale: { id: 'vol-318', nome: 'Mattia Vignali' },
    note: 'Equipaggio pronto per emergenze primarie H24'
  },
  {
    id: 'turno-oggi-massa-pomeriggio',
    sedeId: 'sede-massa-lejare',
    sedeNome: 'Sede Operativa Massa (Le Jare)',
    data: OGGI_ISO,
    fasciaOraria: 'Pomeriggio (14:00 - 20:00)',
    orarioInizio: '14:00',
    orarioFine: '20:00',
    mezzoAssegnato: 'T4606',
    statoCopertura: 'Parziale',
    autista: { id: 'vol-004', nome: 'Alessandro Conti' },
    caposervizio: { id: 'vol-156', nome: 'Claudio Simonini' },
    soccorritore2: undefined, // Manca secondo soccorritore
    operatoreCentrale: { id: 'vol-318', nome: 'Mattia Vignali' },
    note: 'Necessario reperire secondo soccorritore per equipaggio completo'
  },
  {
    id: 'turno-oggi-massa-notte',
    sedeId: 'sede-massa-lejare',
    sedeNome: 'Sede Operativa Massa (Le Jare)',
    data: OGGI_ISO,
    fasciaOraria: 'Notte (20:00 - 08:00)',
    orarioInizio: '20:00',
    orarioFine: '08:00',
    mezzoAssegnato: 'T4609',
    statoCopertura: 'Coperto',
    autista: { id: 'vol-156', nome: 'Claudio Simonini' },
    caposervizio: { id: 'vol-104', nome: 'Sara Ferretti' },
    soccorritore2: { id: 'vol-005', nome: 'Francesca Esposito' },
    note: 'Turno notturno guardia attiva'
  },
  {
    id: 'turno-oggi-carrara-mattina',
    sedeId: 'sede-carrara-fossone',
    sedeNome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    data: OGGI_ISO,
    fasciaOraria: 'Mattina (08:00 - 14:00)',
    orarioInizio: '08:00',
    orarioFine: '14:00',
    mezzoAssegnato: 'T4608',
    statoCopertura: 'Coperto',
    autista: { id: 'vol-004', nome: 'Alessandro Conti' },
    caposervizio: { id: 'vol-104', nome: 'Sara Ferretti' },
    note: 'Presidio e ricognizione territorio di Carrara'
  },
  {
    id: 'turno-domani-carrara-pomeriggio',
    sedeId: 'sede-carrara-fossone',
    sedeNome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    data: addDaysISODate(OGGI_ISO, 1),
    fasciaOraria: 'Pomeriggio (14:00 - 20:00)',
    orarioInizio: '14:00',
    orarioFine: '20:00',
    mezzoAssegnato: 'T4613',
    statoCopertura: 'Scoperto',
    note: 'Turno programmato da assegnare urgentemente'
  }
];

// ---------------------------------------------------------------------------
// 8. COMUNICAZIONI BACHECA DI SEZIONE (DISPOSIZIONI & CIRCOLARI)
// ---------------------------------------------------------------------------
export const COMUNICAZIONI_BACHECA_INIZIALI: ComunicazioneBacheca[] = [
  {
    id: 'com-001',
    titolo: 'Nuova Suddivisione Oraria Ufficiale dei Turni di Servizio',
    contenuto: 'Si informano tutti i volontari e soccorritori che, a partire da oggi, la suddivisione ufficiale delle fasce orarie dei turni operativi è così articolata per tutte le sedi:\\n• Mattina: 08:00 - 14:00\\n• Pomeriggio: 14:00 - 20:00\\n• Notte: 20:00 - 08:00\\nSi raccomanda la massima puntualità nel passaggio consegne e la tempestiva timbratura GPS.',
    sezioneTargetId: 'tutte',
    sezioneTargetNome: 'Tutte le Sezioni Territoriali',
    priorita: 'Importante',
    categoria: 'Disposizioni Operative',
    dataPubblicazione: OGGI_ISO,
    oraPubblicazione: '08:00',
    autore: 'Presidenza & Direzione Operativa',
    attiva: true,
    evidenziata: true
  },
  {
    id: 'com-002',
    titolo: 'Assegnazione e Dislocazione Nuove Dotazioni Mezzi Territoriali',
    contenuto: 'Completata la revisione del materiale di bordo e l\'aggiornamento delle dotazioni per i mezzi assegnati alle sezioni di Massa (Le Jare) e Carrara (Fossone / Monteverde). Si prega ogni caposervizio di verificare la checklist a inizio turno prima di mettersi in marcia.',
    sezioneTargetId: 'tutte',
    sezioneTargetNome: 'Tutte le Sezioni Territoriali',
    priorita: 'Ordinaria',
    categoria: 'Mezzi & Dotazioni',
    dataPubblicazione: OGGI_ISO,
    oraPubblicazione: '09:30',
    autore: 'Responsabile Autoparco',
    attiva: true,
    evidenziata: false
  },
  {
    id: 'com-003',
    titolo: 'Copertura Turni Festivi e Reperibilità Sezione Carrara (Fossone / Monteverde)',
    contenuto: 'È aperta la raccolta straordinaria delle disponibilità per i turni del weekend e per il presidio della Sezione Territoriale Carrara (Fossone / Monteverde). I volontari disponibili possono segnalarlo al coordinatore o direttamente tramite il gestionale turni.',
    sezioneTargetId: 'sede-carrara-fossone',
    sezioneTargetNome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    priorita: 'Urgente',
    categoria: 'Turni & Reperibilità',
    dataPubblicazione: OGGI_ISO,
    oraPubblicazione: '11:15',
    autore: 'Coordinamento Turni Carrara',
    attiva: true,
    evidenziata: true
  }
];

