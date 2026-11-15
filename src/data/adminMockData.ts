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
  ComunicazioneBacheca
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
    nome: 'Sede Operativa H24 & Autoparco Massa (Le Jare)',
    indirizzo: 'Via Le Jare 45, 54100 Massa (MS)',
    coordinate: { lat: 44.0321, lng: 10.1345 },
    raggioMetri: 35,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Sede operativa principale H24, autoparco ambulanze e sala operativa'
  },
  {
    id: 'luogo-ronchi',
    codice: 'TIMB-02-RONCHI',
    nome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    indirizzo: 'Via Como 12, Località Ronchi, 54100 Massa (MS)',
    coordinate: { lat: 44.0185, lng: 10.1062 },
    raggioMetri: 30,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Direzione generale, uffici amministrativi e aula formazione'
  },
  {
    id: 'luogo-fossone',
    codice: 'TIMB-03-FOSSONE',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    indirizzo: 'Viale Galilei 150 / Strada Monteverde 49, 54033 Carrara (MS)',
    coordinate: { lat: 44.0532, lng: 10.0612 },
    raggioMetri: 30,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Postazione territoriale ambulanze e presidio Carrara'
  },
  {
    id: 'luogo-pietrasanta',
    codice: 'TIMB-04-PIETRASANTA',
    nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)',
    indirizzo: 'Piazza Villeparisis 14, 55045 Marina di Pietrasanta (LU)',
    coordinate: { lat: 43.9572, lng: 10.2312 },
    raggioMetri: 25,
    tipo: 'sede_operativa',
    attivo: true,
    descrizione: 'Presidio estivo e servizi secondari Versilia'
  },
  {
    id: 'luogo-aulla',
    codice: 'TIMB-05-AULLA',
    nome: 'Sezione Territoriale Lunigiana (Aulla)',
    indirizzo: 'Piazza Cavour 4, 54011 Aulla (MS)',
    coordinate: { lat: 44.2145, lng: 9.9682 },
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
    sede: 'Sezione Territoriale Carrara (Fossone)',
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
    sedeStazionamento: 'Carrara (Fossone)',
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
    sedeStazionamento: 'Carrara (Fossone)',
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
// 4. FORMAZIONE / CORSI
// ---------------------------------------------------------------------------
export const CORSI_FORMAZIONE_INIZIALI: CorsoFormazione[] = [
  {
    id: 'corso-psv-01',
    codiceCorso: 'PSV-2026-01',
    titolo: 'TUTELA, SOCCORSO E BENESSERE ANIMALE',
    sottotitolo: '“Dal Soccorso alla tutela degli animali”',
    tipologia: 'Seminario PSV',
    descrizione: 'Seminario formativo teorico-pratico su pronto soccorso veterinario, legislazione sulla tutela animale, avvicinamento in sicurezza e trasporto protetto in ambulanza veterinaria.',
    docenteFormatore: 'Dott.ssa Valentina Moriconi (Formatore Croce Oro)',
    enteAccreditato: 'Croce Oro Massa Carrara ODV — Servizio Tutela Animale GEV',
    sedeCorso: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    sedeSvolgimentoTipo: 'sezione_salvata',
    sedeSvolgimentoSedeId: 'sede-massa-ronchi',
    indirizzoCompleto: 'Via Ronchi 12, 54100 Massa (MS)',
    coordinate: { lat: 44.0185, lng: 10.1062 },
    orarioInizioLezione: '09:00',
    orarioFineLezione: '13:00',
    sezioniDestinatarieIds: ['sede-massa-ronchi', 'sede-massa-lejare', 'sede-carrara-fossone', 'sede-pietrasanta', 'sede-lunigiana'],
    sezioniDestinatarieNomi: ['Tutte le Sezioni dell\'Associazione'],
    percentualeMinimaPresenza: 80,
    dataInizio: '2026-11-07',
    dataFine: '2026-11-21',
    oreTotali: 12,
    oreMinimeFrequenza: 10,
    massimoPartecipanti: 25,
    stato: 'In Corso',
    // Programma articolato in più incontri con date, orari e sedi diverse (fino a 20 lezioni)
    lezioni: [
      {
        id: 'lez-psv-01',
        numero: 1,
        titolo: 'Modulo 1: Quadro normativo, benessere animale e deontologia delle Guardie GEV',
        data: '2026-11-07',
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeSvolgimentoTipo: 'sezione_salvata',
        sedeSvolgimentoSedeId: 'sede-massa-ronchi',
        sedeNome: 'Sede Legale Massa (Ronchi) — Aula Magna',
        indirizzoCompleto: 'Via Ronchi 12, 54100 Massa (MS)',
        coordinate: { lat: 44.0185, lng: 10.1062 },
        docente: 'Dott.ssa Valentina Moriconi'
      },
      {
        id: 'lez-psv-02',
        numero: 2,
        titolo: 'Modulo 2: Tecniche di avvicinamento e primo soccorso su trauma animale',
        data: '2026-11-14',
        orarioInizio: '14:30',
        orarioFine: '18:30',
        ore: 4,
        sedeSvolgimentoTipo: 'sezione_salvata',
        sedeSvolgimentoSedeId: 'sede-carrara-fossone',
        sedeNome: 'Sezione Territoriale Carrara (Fossone) — Sala Didattica',
        indirizzoCompleto: 'Viale Galilei 150, 54033 Fossone, Carrara (MS)',
        coordinate: { lat: 44.0532, lng: 10.0612 },
        docente: 'Dott. Medico Veterinario Enrico Landi'
      },
      {
        id: 'lez-psv-03',
        numero: 3,
        titolo: 'Modulo 3: Addestramento operativo e trasporto in ambulanza veterinaria',
        data: '2026-11-21',
        orarioInizio: '09:30',
        orarioFine: '13:30',
        ore: 4,
        sedeSvolgimentoTipo: 'sezione_salvata',
        sedeSvolgimentoSedeId: 'sede-massa-lejare',
        sedeNome: 'Sede Operativa H24 & Autoparco Massa (Le Jare)',
        indirizzoCompleto: 'Via Le Jare 45, 54100 Massa (MS)',
        coordinate: { lat: 44.0321, lng: 10.1345 },
        docente: 'Istruttore Soccorso Animale GEV'
      }
    ],
    iscritti: [
      {
        volontarioId: 'vol-156',
        volontarioNome: 'Claudio Simonini',
        qualifica: 'Autista',
        oreFrequentate: 12,
        esito: 'Idoneo / Superato',
        tipoAttestato: 'partecipazione',
        numeroAttestato: 'GEV-099', // Inizia da 099 per Seminario PSV
        dataRilascioAttestato: '2026-11-21',
        timbraturaEntrata: '2026-11-07 08:55 (GPS Confermato Lezione 1 Ronchi)',
        timbraturaUscita: '2026-11-21 13:32 (GPS Confermato Lezione 3 Le Jare)',
        timbratureLezioni: [
          {
            lezioneId: 'lez-psv-01',
            lezioneNumero: 1,
            data: '2026-11-07',
            sedeLezioneNome: 'Sede Legale Massa (Ronchi)',
            oreFrequentate: 4,
            confermata: true,
            distanzaEntrataMetri: 18
          },
          {
            lezioneId: 'lez-psv-02',
            lezioneNumero: 2,
            data: '2026-11-14',
            sedeLezioneNome: 'Sezione Territoriale Carrara (Fossone)',
            oreFrequentate: 4,
            confermata: true,
            distanzaEntrataMetri: 24
          },
          {
            lezioneId: 'lez-psv-03',
            lezioneNumero: 3,
            data: '2026-11-21',
            sedeLezioneNome: 'Sede Operativa H24 Massa (Le Jare)',
            oreFrequentate: 4,
            confermata: true,
            distanzaEntrataMetri: 12
          }
        ]
      },
      {
        volontarioId: 'vol-005',
        volontarioNome: 'Francesca Esposito',
        qualifica: 'Soccorritore Base',
        oreFrequentate: 8,
        esito: 'In Frequenza',
        tipoAttestato: 'partecipazione',
        timbratureLezioni: [
          {
            lezioneId: 'lez-psv-01',
            lezioneNumero: 1,
            data: '2026-11-07',
            sedeLezioneNome: 'Sede Legale Massa (Ronchi)',
            oreFrequentate: 4,
            confermata: true,
            distanzaEntrataMetri: 22
          },
          {
            lezioneId: 'lez-psv-02',
            lezioneNumero: 2,
            data: '2026-11-14',
            sedeLezioneNome: 'Sezione Territoriale Carrara (Fossone)',
            oreFrequentate: 4,
            confermata: true,
            distanzaEntrataMetri: 15
          }
        ]
      }
    ]
  },
  {
    id: 'corso-aut-01',
    codiceCorso: 'AUT-2026-01',
    titolo: 'Seminario Autisti — Guida Operativa Mezzi di Soccorso',
    sottotitolo: 'Tecniche di guida difensiva e sicurezza stradale in emergenza',
    tipologia: 'Seminario Autisti',
    descrizione: 'Seminario avanzato per conducenti di ambulanza e pulmini disabili: frenata di emergenza, guida con segnali acustici e visivi accesi, gestione del fondo bagnato.',
    docenteFormatore: 'Istruttore Roberto Vieri',
    enteAccreditato: 'Scuola Guida Sicura ACI / Croce Oro OdV',
    sedeCorso: 'Piazzale Autoparco Massa (Le Jare)',
    sedeSvolgimentoTipo: 'sezione_salvata',
    sedeSvolgimentoSedeId: 'sede-massa-lejare',
    indirizzoCompleto: 'Via Le Jare 45, 54100 Massa (MS)',
    coordinate: { lat: 44.0321, lng: 10.1345 },
    orarioInizioLezione: '09:00',
    orarioFineLezione: '17:00',
    sezioniDestinatarieIds: ['sede-massa-ronchi', 'sede-massa-lejare', 'sede-carrara-fossone'],
    sezioniDestinatarieNomi: ['Massa (Ronchi)', 'Massa (Le Jare)', 'Carrara (Fossone)'],
    percentualeMinimaPresenza: 80,
    dataInizio: '2026-11-22',
    dataFine: '2026-11-23',
    oreTotali: 16,
    oreMinimeFrequenza: 14,
    massimoPartecipanti: 14,
    stato: 'Programmato',
    lezioni: [
      {
        id: 'lez-aut-01',
        numero: 1,
        titolo: 'Sessione Teorica: Dinamica del veicolo e codice della strada in emergenza',
        data: '2026-11-22',
        orarioInizio: '09:00',
        orarioFine: '17:00',
        ore: 8,
        sedeSvolgimentoTipo: 'sezione_salvata',
        sedeSvolgimentoSedeId: 'sede-massa-ronchi',
        sedeNome: 'Sede Legale Massa (Ronchi) — Aula Formazione',
        indirizzoCompleto: 'Via Ronchi 12, 54100 Massa (MS)',
        coordinate: { lat: 44.0185, lng: 10.1062 }
      },
      {
        id: 'lez-aut-02',
        numero: 2,
        titolo: 'Sessione Pratica: Prove di skid car e frenata con ostacolo improvviso',
        data: '2026-11-23',
        orarioInizio: '09:00',
        orarioFine: '17:00',
        ore: 8,
        sedeSvolgimentoTipo: 'sezione_salvata',
        sedeSvolgimentoSedeId: 'sede-massa-lejare',
        sedeNome: 'Piazzale Autoparco Massa (Le Jare)',
        indirizzoCompleto: 'Via Le Jare 45, 54100 Massa (MS)',
        coordinate: { lat: 44.0321, lng: 10.1345 }
      }
    ],
    iscritti: [
      {
        volontarioId: 'vol-156',
        volontarioNome: 'Claudio Simonini',
        qualifica: 'Autista',
        oreFrequentate: 0,
        esito: 'Iscritto',
        tipoAttestato: 'partecipazione'
      },
      {
        volontarioId: 'vol-004',
        volontarioNome: 'Alessandro Conti',
        qualifica: 'Autista 4x4',
        oreFrequentate: 0,
        esito: 'Iscritto',
        tipoAttestato: 'partecipazione'
      }
    ]
  },
  {
    id: 'corso-blsd-01',
    codiceCorso: 'BLSD-2026-01',
    titolo: 'Corso Esecutore BLSD / DAE Adulto e Pediatrico',
    sottotitolo: 'Rianimazione Cardiopolmonare e Defibrillazione Precoce',
    tipologia: 'BLSD',
    descrizione: 'Formazione teorico-pratica con manichini QCPR su rianimazione cardiopolmonare, manovre di disostruzione e uso del defibrillatore semiautomatico esterno.',
    docenteFormatore: 'Dott.ssa Valentina Moriconi (Formatore IRC / 118)',
    enteAccreditato: 'Regione Toscana — Centrale 118 Alta Toscana',
    sedeCorso: 'Sede Legale & Direzione Generale Massa (Ronchi) — Aula Magna',
    sedeSvolgimentoTipo: 'sezione_salvata',
    sedeSvolgimentoSedeId: 'sede-massa-ronchi',
    indirizzoCompleto: 'Via Ronchi 12, 54100 Massa (MS)',
    coordinate: { lat: 44.0185, lng: 10.1062 },
    orarioInizioLezione: '08:30',
    orarioFineLezione: '12:30',
    sezioniDestinatarieIds: ['sede-massa-ronchi', 'sede-massa-lejare', 'sede-carrara-fossone', 'sede-pietrasanta', 'sede-lunigiana'],
    sezioniDestinatarieNomi: ['Tutte le Sezioni dell\'Associazione'],
    percentualeMinimaPresenza: 100,
    dataInizio: '2026-11-08',
    dataFine: '2026-11-09',
    oreTotali: 8,
    oreMinimeFrequenza: 8,
    massimoPartecipanti: 16,
    stato: 'Concluso',
    iscritti: [
      {
        volontarioId: 'vol-156',
        volontarioNome: 'Claudio Simonini',
        qualifica: 'Autista',
        oreFrequentate: 8,
        esito: 'Idoneo / Superato',
        tipoAttestato: 'idoneita',
        timbraturaEntrata: '2026-11-08 08:28 (GPS Confermato)',
        timbraturaUscita: '2026-11-09 12:34 (GPS Confermato)',
        numeroAttestato: 'ATT-BLSD-2026-041',
        dataRilascioAttestato: '2026-11-09',
        scadenzaBrevetto: '2028-11-09'
      },
      {
        volontarioId: 'vol-102',
        volontarioNome: 'Marco Bernardini',
        qualifica: 'Soccorritore',
        oreFrequentate: 8,
        esito: 'Idoneo / Superato',
        tipoAttestato: 'idoneita',
        numeroAttestato: 'ATT-BLSD-2024-089',
        dataRilascioAttestato: '2024-11-18',
        scadenzaBrevetto: '2026-11-18' // In scadenza entro 15 giorni (Retraining urgente)
      },
      {
        volontarioId: 'vol-103',
        volontarioNome: 'Elena Ricci',
        qualifica: 'Autista Soccorritore',
        oreFrequentate: 8,
        esito: 'Idoneo / Superato',
        tipoAttestato: 'idoneita',
        numeroAttestato: 'ATT-BLSD-2024-112',
        dataRilascioAttestato: '2024-11-28',
        scadenzaBrevetto: '2026-11-28' // In scadenza entro 30 giorni (Preavviso rinnovo)
      }
    ]
  },
  {
    id: 'corso-pc0-01',
    codiceCorso: 'PC-0-2026',
    titolo: 'Protezione Civile Corso 0 — Avviamento al Servizio di Emergenza',
    tipologia: 'Protezione Civile Corso 0',
    descrizione: 'Corso propedeutico di ingresso per volontari operativi: catena di comando, sicurezza e DPI, radio comunicazioni DMR.',
    docenteFormatore: 'Geom. Marco Vivaldi (Formatore PC)',
    enteAccreditato: 'Dipartimento Protezione Civile — Regione Toscana',
    sedeCorso: 'Sede Operativa H24 Massa (Le Jare)',
    sedeSvolgimentoTipo: 'sezione_salvata',
    sedeSvolgimentoSedeId: 'sede-massa-lejare',
    indirizzoCompleto: 'Via Le Jare 45, 54100 Massa (MS)',
    coordinate: { lat: 44.0321, lng: 10.1345 },
    orarioInizioLezione: '20:30',
    orarioFineLezione: '23:00',
    sezioniDestinatarieIds: ['sede-massa-ronchi', 'sede-massa-lejare'],
    sezioniDestinatarieNomi: ['Massa (Ronchi)', 'Massa (Le Jare)'],
    percentualeMinimaPresenza: 100,
    dataInizio: '2026-11-18',
    dataFine: '2026-11-19',
    oreTotali: 5,
    oreMinimeFrequenza: 5,
    massimoPartecipanti: 25,
    stato: 'Programmato',
    iscritti: []
  },
  {
    id: 'corso-pcbase-01',
    codiceCorso: 'PC-BASE-2026',
    titolo: 'Protezione Civile Corso Base — Antincendio Boschivo & Rischio Idrogeologico',
    tipologia: 'Protezione Civile Corso Base',
    descrizione: 'Formazione operativa per interventi su alluvioni, uso motopompe e idrovore carrellate, motoseghe e presidio del territorio.',
    docenteFormatore: 'Caposquadra AIB Regione Toscana',
    enteAccreditato: 'Regione Toscana / Croce Oro OdV',
    sedeCorso: 'Sezione Territoriale Carrara (Fossone)',
    sedeSvolgimentoTipo: 'sezione_salvata',
    sedeSvolgimentoSedeId: 'sede-carrara-fossone',
    indirizzoCompleto: 'Viale Galilei 150, 54033 Fossone, Carrara (MS)',
    coordinate: { lat: 44.0532, lng: 10.0612 },
    orarioInizioLezione: '08:30',
    orarioFineLezione: '17:30',
    sezioniDestinatarieIds: ['sede-carrara-fossone', 'sede-lunigiana'],
    sezioniDestinatarieNomi: ['Carrara (Fossone)', 'Lunigiana (Aulla)'],
    percentualeMinimaPresenza: 85,
    dataInizio: '2026-12-12',
    dataFine: '2026-12-13',
    oreTotali: 16,
    oreMinimeFrequenza: 14,
    massimoPartecipanti: 20,
    stato: 'Programmato',
    iscritti: []
  },
  {
    id: 'corso-form-psv-01',
    codiceCorso: 'FORMAZ-PSV-2026',
    titolo: 'Formazione PSV — Tecniche Avanzate Soccorso Sanitario Veterinario',
    tipologia: 'Formazione PSV',
    descrizione: 'Percorso formativo completo per operatori ambulanza veterinaria: gestione emergenze respiratorie, emorragie, immobilizzazione e coordinamento 24h.',
    docenteFormatore: 'Dott.ssa Valentina Moriconi & Dott. Enrico Landi',
    enteAccreditato: 'Ordine Medici Veterinari Massa-Carrara',
    sedeCorso: 'Sede Legale Massa (Ronchi)',
    sedeSvolgimentoTipo: 'sezione_salvata',
    sedeSvolgimentoSedeId: 'sede-massa-ronchi',
    indirizzoCompleto: 'Via Ronchi 12, 54100 Massa (MS)',
    coordinate: { lat: 44.0185, lng: 10.1062 },
    orarioInizioLezione: '09:00',
    orarioFineLezione: '13:00',
    sezioniDestinatarieIds: ['sede-massa-ronchi', 'sede-massa-lejare', 'sede-carrara-fossone'],
    sezioniDestinatarieNomi: ['Tutte le sezioni'],
    percentualeMinimaPresenza: 80,
    dataInizio: '2026-12-19',
    dataFine: '2026-12-20',
    oreTotali: 8,
    oreMinimeFrequenza: 8,
    massimoPartecipanti: 18,
    stato: 'Programmato',
    iscritti: []
  }
];

// ---------------------------------------------------------------------------
// 5. GESTIONE MAGAZZINO VESTIARIO ED ATTREZZATURE
// ---------------------------------------------------------------------------
export const MAGAZZINO_VESTIARIO_INIZIALE: ArticoloVestiarioMagazzino[] = [
  {
    id: 'vest-001',
    codiceArticolo: 'GIACCA-AV-M',
    nome: 'Giacca Alta Visibilità 4 Stagioni EN ISO 20471',
    categoria: 'Giacche & Giubbotti',
    taglia: 'M',
    giacenzaAttuale: 12,
    scortaMinima: 5,
    prezzoUnitarioFornitore: 85.0,
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 2'
  },
  {
    id: 'vest-002',
    codiceArticolo: 'GIACCA-AV-L',
    nome: 'Giacca Alta Visibilità 4 Stagioni EN ISO 20471',
    categoria: 'Giacche & Giubbotti',
    taglia: 'L',
    giacenzaAttuale: 15,
    scortaMinima: 6,
    prezzoUnitarioFornitore: 85.0,
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 3'
  },
  {
    id: 'vest-003',
    codiceArticolo: 'GIACCA-AV-XL',
    nome: 'Giacca Alta Visibilità 4 Stagioni EN ISO 20471',
    categoria: 'Giacche & Giubbotti',
    taglia: 'XL',
    giacenzaAttuale: 4,
    scortaMinima: 5,
    prezzoUnitarioFornitore: 85.0,
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio A1 - Ripiano 4'
  },
  {
    id: 'vest-004',
    codiceArticolo: 'PANT-SOCC-M',
    nome: 'Pantaloni Soccorso Bielastici con Ginocchiere Rinforzate',
    categoria: 'Pantaloni Soccorso',
    taglia: 'M',
    giacenzaAttuale: 18,
    scortaMinima: 8,
    prezzoUnitarioFornitore: 52.0,
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio B2 - Ripiano 1'
  },
  {
    id: 'vest-005',
    codiceArticolo: 'PANT-SOCC-L',
    nome: 'Pantaloni Soccorso Bielastici con Ginocchiere Rinforzate',
    categoria: 'Pantaloni Soccorso',
    taglia: 'L',
    giacenzaAttuale: 14,
    scortaMinima: 8,
    prezzoUnitarioFornitore: 52.0,
    fornitore: 'Siggi Group SpA',
    ubicazioneScaffale: 'Armadio B2 - Ripiano 2'
  },
  {
    id: 'vest-006',
    codiceArticolo: 'POLO-CROCE-M',
    nome: 'Polo Tecnica Estiva Manica Corta Giallo Fluo / Blu Navy',
    categoria: 'Polo & T-Shirt',
    taglia: 'M',
    giacenzaAttuale: 25,
    scortaMinima: 10,
    prezzoUnitarioFornitore: 22.0,
    fornitore: 'Confezioni Toscane',
    ubicazioneScaffale: 'Scatolone C3'
  },
  {
    id: 'vest-007',
    codiceArticolo: 'POLO-CROCE-L',
    nome: 'Polo Tecnica Estiva Manica Corta Giallo Fluo / Blu Navy',
    categoria: 'Polo & T-Shirt',
    taglia: 'L',
    giacenzaAttuale: 30,
    scortaMinima: 10,
    prezzoUnitarioFornitore: 22.0,
    fornitore: 'Confezioni Toscane',
    ubicazioneScaffale: 'Scatolone C3'
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
    fornitore: 'Base Protection',
    ubicazioneScaffale: 'Scarpiera Magazzino Basso'
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
    sedeNome: 'Sezione Territoriale Carrara (Fossone)',
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
    sedeNome: 'Sezione Territoriale Carrara (Fossone)',
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
    contenuto: 'Completata la revisione del materiale di bordo e l\'aggiornamento delle dotazioni per i mezzi assegnati alle sezioni di Massa (Le Jare) e Carrara (Fossone). Si prega ogni caposervizio di verificare la checklist a inizio turno prima di mettersi in marcia.',
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
    titolo: 'Copertura Turni Festivi e Reperibilità Sezione Carrara Fossone',
    contenuto: 'È aperta la raccolta straordinaria delle disponibilità per i turni del weekend e per il presidio della Sezione Territoriale di Carrara Fossone. I volontari disponibili possono segnalarlo al coordinatore o direttamente tramite il gestionale turni.',
    sezioneTargetId: 'sede-carrara-fossone',
    sezioneTargetNome: 'Sezione Territoriale Carrara (Fossone)',
    priorita: 'Urgente',
    categoria: 'Turni & Reperibilità',
    dataPubblicazione: OGGI_ISO,
    oraPubblicazione: '11:15',
    autore: 'Coordinamento Turni Carrara',
    attiva: true,
    evidenziata: true
  }
];

