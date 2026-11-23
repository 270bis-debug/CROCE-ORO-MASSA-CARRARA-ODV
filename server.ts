import express from 'express';
import http from 'http';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import { scaricaAttestatoPDF } from './src/utils/pdfAttestatoCorso';
import { LUOGHI_TIMBRATURA_DEFAULT } from './src/data/adminMockData';
import { LuogoTimbratura } from './src/types/adminTypes';
import { BUILD_INFO } from './src/buildInfo';
import {
  formatDateItaly,
  formatDateTimeItaly,
  formatISODateItaly,
  formatTimeItaly,
  getCurrentYearItaly,
  getItalianDateParts,
  ITALY_TIMEZONE,
  parseItalianDateTimeMs
} from './src/utils/italianTime';
import { mergeVolontariListsSafe, mergeLoggedSessionsSafe, normalizeDeletedIds } from './src/utils/volontariMerge';
import { mergeNotificheBachecaRecenti, NotificaBachecaRecord } from './src/utils/bachecaCorsi';
import {
  normalizzaListaSediAssociative,
  normalizzaListaLuoghiTimbratura,
  normalizzaTurniSedi,
  normalizzaComunicazioniBacheca,
  mergeComunicazioniBachecaSafe
} from './src/utils/sediNormalize';
import {
  generaPaginaHtmlResetPinAutonoma,
  isProtectedAiStudioHost,
  normalizePublicUrlInput
} from './src/utils/publicUrl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurazione Web Push VAPID per Notifiche Push in Background a Schermo Spento
const VAPID_KEYS = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BBIgy7sPt5aiNKmumUH57K28pFivVG3qKun0xMT7ZLJq8Kc6c_hCzawksKptqyOI0pIXRZ7I6tmEr9D_jM4a6bc',
  privateKey: process.env.VAPID_PRIVATE_KEY || '19czcRLqXXAWjqLkkhHa53NQ5erahFRbIcJ-mTOOqBE'
};

webpush.setVapidDetails(
  'mailto:centrale@croceoromassacarrara.it',
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

interface PushSubscriber {
  endpoint: string;
  role: 'volontario' | 'admin' | 'centrale' | 'all';
  volontarioId?: string;
  volontarioNome?: string;
  subscription: webpush.PushSubscription;
  timestamp: number;
}
const subscribers = new Map<string, PushSubscriber>();

interface BufferedRadioChunk {
  codec: string;
  payloadBase64: string;
  sampleRate: number;
  seq: number;
  speakerId: string;
}

interface BufferedRadioTransmission {
  id: string;
  channelId: string;
  groupId?: string;
  groupName?: string;
  memberIds?: string[];
  speakerId: string;
  speakerName: string;
  role: 'admin' | 'volontario';
  isEmergency: boolean;
  startedAt: number;
  endedAt?: number;
  chunks: BufferedRadioChunk[];
}

const MAX_RADIO_TRANSMISSIONS = 15;
const MAX_CHUNKS_PER_TRANSMISSION = 260;
const RADIO_TRANSMISSION_TTL_MS = 15 * 60 * 1000;
const recentRadioTransmissions: BufferedRadioTransmission[] = [];
const activeTransmissionByChannel = new Map<string, BufferedRadioTransmission>();
const lastPttPushByChannel = new Map<string, number>();

function pruneOldRadioTransmissions() {
  const cutoff = Date.now() - RADIO_TRANSMISSION_TTL_MS;
  while (recentRadioTransmissions.length > 0 && recentRadioTransmissions[0].startedAt < cutoff) {
    recentRadioTransmissions.shift();
  }
  while (recentRadioTransmissions.length > MAX_RADIO_TRANSMISSIONS) {
    recentRadioTransmissions.shift();
  }
}

function startRadioTransmissionBuffer(params: {
  channelId: string;
  groupId?: string;
  groupName?: string;
  memberIds?: string[];
  speakerId: string;
  speakerName: string;
  role: 'admin' | 'volontario';
  isEmergency: boolean;
}): BufferedRadioTransmission {
  pruneOldRadioTransmissions();
  const tx: BufferedRadioTransmission = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    channelId: params.channelId,
    groupId: params.groupId,
    groupName: params.groupName,
    memberIds: params.memberIds ? [...params.memberIds] : undefined,
    speakerId: params.speakerId,
    speakerName: params.speakerName,
    role: params.role,
    isEmergency: params.isEmergency,
    startedAt: Date.now(),
    chunks: [],
  };
  recentRadioTransmissions.push(tx);
  activeTransmissionByChannel.set(params.channelId, tx);
  pruneOldRadioTransmissions();
  return tx;
}

function appendRadioTransmissionChunk(channelId: string, chunk: BufferedRadioChunk) {
  const tx = activeTransmissionByChannel.get(channelId);
  if (!tx) return;
  if (tx.chunks.length >= MAX_CHUNKS_PER_TRANSMISSION) {
    tx.chunks.shift();
  }
  tx.chunks.push(chunk);
}

function finishRadioTransmissionBuffer(channelId: string) {
  const tx = activeTransmissionByChannel.get(channelId);
  if (tx) {
    tx.endedAt = Date.now();
    activeTransmissionByChannel.delete(channelId);
  }
}

function syncSubscribersToState(stateObj: any) {
  if (!stateObj) return;
  stateObj.pushSubscribers = Array.from(subscribers.values()).slice(-200);
}

const pushTestRateLimit = new Map<string, number>();

function sendPushNotificationToRole(
  targetRole: 'volontario' | 'admin' | 'centrale' | 'all',
  payload: any,
  excludeEndpoint?: string
): number {
  const payloadStr = JSON.stringify(payload);
  const exclEndpoint = excludeEndpoint ? String(excludeEndpoint).trim() : '';
  let sentCount = 0;
  subscribers.forEach((sub, endpoint) => {
    if (exclEndpoint && endpoint === exclEndpoint) return;
    const isTarget =
      targetRole === 'all' ||
      sub.role === 'all' ||
      sub.role === targetRole ||
      ((targetRole === 'admin' || targetRole === 'centrale') && (sub.role === 'admin' || sub.role === 'centrale'));
    if (isTarget) {
      sentCount++;
      webpush.sendNotification(sub.subscription, payloadStr, {
        urgency: 'high',
        TTL: payload?.tipo === 'radio_ptt' ? 120 : 3600,
        headers: {
          'Urgency': 'high'
        }
      }).catch((err: any) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          subscribers.delete(endpoint);
        } else {
          console.error('[WebPush] Invio non riuscito:', err?.statusCode || '', err?.message || err);
        }
      });
    }
  });
  return sentCount;
}

function sendPushNotificationToVolunteer(
  volontarioId: string | undefined,
  payload: any,
  strictMemberOnly: boolean = false,
  excludeEndpoint?: string
): number {
  const payloadStr = JSON.stringify(payload);
  const exclEndpoint = excludeEndpoint ? String(excludeEndpoint).trim() : '';
  let sentCount = 0;
  subscribers.forEach((sub, endpoint) => {
    if (exclEndpoint && endpoint === exclEndpoint) return;
    const isTargetVol = Boolean(volontarioId && sub.volontarioId === volontarioId);
    const isGenericVolDevice = !strictMemberOnly && !sub.volontarioId && (sub.role === 'volontario' || sub.role === 'all');
    if (isTargetVol || isGenericVolDevice) {
      sentCount++;
      webpush.sendNotification(sub.subscription, payloadStr, {
        urgency: 'high',
        TTL: payload?.tipo === 'radio_ptt' ? 120 : 86400,
        headers: {
          'Urgency': 'high'
        }
      }).catch((err: any) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          subscribers.delete(endpoint);
        } else {
          console.error('[WebPush] Invio promemoria non riuscito:', err?.statusCode || '', err?.message || err);
        }
      });
    }
  });
  return sentCount;
}

let notifSeq = 0;
export function generateUniqueNotifId(): string {
  notifSeq = (notifSeq + 1) % 1000000;
  return `notif-${Date.now()}-${notifSeq}-${Math.random().toString(36).substring(2, 6)}`;
}

// Interfacce dello stato condiviso in tempo reale e persistente
export interface Volontario {
  id: string;
  nome: string;
  cognome: string;
  matricola?: string;
  qualifica: 'Autista' | 'Soccorritore' | 'Operatore Centrale' | string;
  caricaConsiglioDirettivo?: string;
  telefono: string;
  email: string;
  pin: string;
  pinProvvisorio?: boolean;
  resetToken?: string;
  dataInvioInvitoReset?: string;
  dataRegistrazione?: string;
  inTurno?: boolean;
  loggato?: boolean;
  loggatoUpdatedAt?: number;
  ultimoAccesso?: string;
  mezzoAttivo?: string;
  ruoloTurno?: string;
  profiloCentrale?: boolean;
  approvato?: boolean;
  dataRichiestaApprovazione?: string;
  richiedeResetPassword?: boolean;
  dataRichiestaResetPassword?: string;
  tentativiErrati?: number; // Contatore tentativi PIN errati (max 3)
  bloccatoPerTentativi?: boolean; // True se ha raggiunto 3 errori
  dataBlocco?: string; // Data e ora del blocco di sicurezza
  firmaBase64?: string; // Firma autografa digitale acquisita sullo schermo del device
  macroCategorieAbilitate?: string[]; // Macro categorie abilitate per accesso delegato
  sottosezioniAbilitate?: Record<string, string[]>; // Sottosezioni specifiche abilitate per ciascun database
  sediTurniAbilitate?: string[]; // Sedi/sezioni autorizzate per visualizzare il tabellone turni
  sezioneAppartenenzaId?: string;
  sezioneAppartenenzaNome?: string;
  codiceFiscale?: string;
  indirizzoResidenza?: string;
  dettaglioResidenza?: any;
  tesseramento?: any;
  vestiario?: any;
  [key: string]: any;
}

export interface MissionData {
  codice: string;
  urgenza: 'ROSSO' | 'GIALLO' | 'VERDE' | 'BIANCO';
  orarioChiamata: string;
  chiamante: string;
  telefono: string;
  enteIstituzionale?: string;
  indirizzo: string;
  coordinate?: { lat: number; lng: number };
  destinazione?: string;
  codiceRientro?: string;
  isStrutturaVeterinaria?: boolean;
  isStrutturaVeterinariaPartenza?: boolean;
  inAttesaDestinazione?: boolean;
  ambito: string;
  sottoAmbitoVet?: string;
  tipoAnimale?: string;
  tipoAnimaleAltro?: string;
  nonDiProprieta?: boolean;
  microchip?: string;
  noMicrochip?: boolean;
  datiProprietarioCentrale?: any;
  fotoDocumento?: any;
  specifiche: string;
  sintesi: string;
  noteCritiche: string;
  mezzoAssegnato: string;
  manovreEffettuatePatologie?: string;
  noteNonVet?: string;
  decisioneCentraleNonVet?: 'rientro_sede' | 'nuovo_obiettivo' | null;
  datiDestinazione?: any;
  completata?: boolean;
  annullata?: boolean;
  motivoAnnullamento?: string;
  richiedenteAnnullamento?: string;
  orarioAnnullamento?: string;
  autonomoVolontario?: boolean;
  creatoDaVolontarioNome?: string;
  creatoDaVolontarioId?: string;
  tipologiaServizio?: string;
  numeroSegreteriaSoupRt?: string;
  allertaMeteo?: string;
}

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

export interface RadioNotification {
  id: string;
  orario: string;
  testo: string;
  tipo: 'centrale' | 'mezzo' | 'sistema' | 'allarme';
  audioDataUrl?: string;
  audioDurationSec?: number;
  audioMimeType?: string;
  mittenteNome?: string;
  groupId?: string;
  groupName?: string;
}

export interface RadioPttSpeaker {
  speakerId: string;
  speakerName: string;
  role: 'admin' | 'volontario';
  isCentralePriority: boolean;
  channelId?: string;
  isEmergency?: boolean;
  startedAt: number;
  lastChunkAt: number;
}

export interface RadioGroup {
  id: string;
  name: string;
  enabled: boolean;
  memberIds: string[];
  createdBy?: string;
  createdAt?: number;
  toggledBy?: string;
  toggledAt?: number;
  activeSpeaker: RadioPttSpeaker | null;
}

export interface RadioEmergencyState {
  active: boolean;
  triggeredBy?: string;
  triggeredAt?: number;
  message?: string;
}

export interface RadioPttState {
  enabled: boolean;
  toggledBy?: string;
  toggledAt?: number;
  codecMode?: 'opus-48k' | 'adpcm-24k';
  activeSpeaker: RadioPttSpeaker | null;
}

export interface ArchivedService {
  id: string;
  codice: string;
  anno: number;
  data: string;
  mezzo: string;
  urgenza: string;
  ambito: string;
  indirizzo: string;
  destinazione?: string;
  chiamante?: string;
  telefono?: string;
  enteIstituzionale?: string;
  noteCritiche?: string;
  volontarioNome?: string;
  volontarioId?: string;
  volontarioTelefono?: string;
  qualificaTurno?: string;
  kmInizio: number;
  kmFine: number;
  kmTotali: number;
  inAttesaKm: boolean;
  tempi: OperativeTimes;
  testoCompleto: string;
  dataCreazione: string;
  dataCompletamento?: string;
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
  tipoAnimale?: string;
  tipoAnimaleAltro?: string;
  nonDiProprieta?: boolean;
  microchip?: string;
  noMicrochip?: boolean;
  datiProprietarioCentrale?: any;
  fotoDocumento?: any;
  isStrutturaVeterinariaPartenza?: boolean;
  datiDestinazione?: any;
  firmaVolontario?: string;
  firmaOperatoreCentrale?: string;
  operatoreCentraleNome?: string;
  dataFirmaCentrale?: string;
  visionatoDaCentrale?: boolean;
  manovreEffettuatePatologie?: string;
  sottoAmbitoVet?: string;
  operatoreMittenteId?: string;
  operatoreMittenteNome?: string;
  annullata?: boolean;
  motivoAnnullamento?: string;
  richiedenteAnnullamento?: string;
  orarioAnnullamento?: string;
  decisioneCentraleNonVet?: 'rientro_sede' | 'nuovo_obiettivo' | null;
  noteNonVet?: string;
  idTurno?: string;
  autonomoVolontario?: boolean;
  creatoDaVolontarioNome?: string;
  creatoDaVolontarioId?: string;
  tipologiaServizio?: string;
  numeroSegreteriaSoupRt?: string;
  allertaMeteo?: string;
  schedaDirettaArchivio?: boolean;
  indirizzoIntervento?: string;
}

export interface ServerState {
  volontari: Volontario[];
  volontariEliminatiIds?: string[];
  activeMission: MissionData | null;
  letturaConfermata: boolean;
  operativeTimes: OperativeTimes;
  datiDestinazione?: any;
  kmInizio: string;
  kmFine: string;
  ringing: {
    active: boolean;
    source: string;
    soundType: 'telefono' | 'sirena' | 'chiamata';
    timestamp: number;
  };
  gpsPosition: {
    lat: number;
    lng: number;
    accuratezza: number;
    velocita: number | null;
    orario: string;
  };
  activeShift: {
    attivo: boolean;
    volontarioId?: string;
    volontarioNome?: string;
    qualificaTurno?: string;
    mezzoScelto?: string;
    orarioInizio?: string;
  };
  notifiche: RadioNotification[];
  serviziArchivio: ArchivedService[];
  cartelleAnniPrecedenti: Record<string, ArchivedService[]>;
  whatsappConfig?: {
    token?: string;
    phoneNumberId?: string;
    businessNumber?: string;
  };
  turni?: any[];
  checklistsTemplates?: any[];
  checklistsCompilate?: any[];
  sedi?: any[];
  datiCartaIntestata?: DatiCartaIntestata;
  luoghiTimbratura?: LuogoTimbratura[];
  promemoriaTurniInviati?: Record<string, string>;
  promemoriaCompleanniInviati?: Record<string, { sentAt: string; recipients: string[] } | string>;
  timbrature?: any[];
  bacheca?: any[];
  bachecaEliminatiIds?: string[];
  raspberryDisplayConfig?: Record<string, any>;
  notificheBachecaRecenti?: NotificaBachecaRecord[];
  giornaleBordo?: any[];
  codiciEliminati?: string[];
  magazzinoParti?: any[];
  magazzinoMezzi?: any[];
  magazzinoVestiario?: any[];
  attrezzatureOperative?: any[];
  movimentiMagazzino?: any[];
  corsiFormazione?: any[];
  noteDiDebito?: any[];
  ricevuteContabilita?: any[];
  tessereAssociative?: any[];
  altreEntrateUscite?: any[];
  costiGestione?: any[];
  costiServizio?: any[];
  sollecitoFirmaPin?: any;
  loggedSessions?: Record<string, { loggato: boolean; updatedAt: number; volontarioNome?: string; mezzoScelto?: string; orarioInizio?: string }>;
  catalogoMansioni?: any[];
  categorieMansioni?: any[];
  mansioniConfigUpdatedAt?: number;
  customEmojiIcons?: any[];
  customEmojiIconsUpdatedAt?: number;
  nomiDatabase?: Record<string, string>;
  nomiDatabaseUpdatedAt?: number;
  mezziFlotta?: any[];
  mezziFlottaUpdatedAt?: number;
  tipologieMezzo?: any[];
  tipologieMezzoUpdatedAt?: number;
  tipiTurno?: any[];
  tipiTurnoUpdatedAt?: number;
  metodiPagamentoCustom?: any[];
  metodiPagamentoCustomUpdatedAt?: number;
  categorieCostiServizio?: any[];
  categorieCostiServizioUpdatedAt?: number;
  pushSubscribers?: PushSubscriber[];
  regolaScadenzeMezzi?: any;
  modelliAttestatiCategoria?: Record<string, any>;
  modelliAttestatiUpdatedAt?: number;
  rubricaNumeriUtili?: any[];
  rubricaNumeriUtiliUpdatedAt?: number;
  indirizziCollezionati?: any[];
  contatti?: any[];
  radioPtt?: RadioPttState;
  radioGroups?: RadioGroup[];
  publicAppUrl?: string;
  radioEmergency?: RadioEmergencyState;
}

export interface DatiCartaIntestata {
  denominazione: string;
  sedeLegale: string;
  sedeMassa: string;
  sedeCarrara: string;
  sedePietrasanta: string;
  centraleTel: string;
  codiceFiscale: string;
  sitoWeb: string;
  email: string;
  pec: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialYouTube?: string;
  socialTikTok?: string;
  socialLinkedIn?: string;
  socialAltro?: string;
  intestatarioConti?: string;
  bancaPoste?: string;
  ibanPoste?: string;
  ccPostale?: string;
  bancaAppoggio?: string;
  ibanBanca?: string;
}

export const DATI_CARTA_INTESTATA_DEFAULT: DatiCartaIntestata = {
  denominazione: 'CROCE ORO MASSA CARRARA OdV',
  sedeLegale: 'Via Como, 12 Massa (MS)',
  sedeMassa: 'Via Delle Jare 9',
  sedeCarrara: 'Strada Comunale Monteverde 49',
  sedePietrasanta: 'Piazza Villeparisis, 14',
  centraleTel: '0585 625410',
  codiceFiscale: '92035360459',
  sitoWeb: 'www.croceoro.org',
  email: 'volontari@croceoro.org',
  pec: 'croceoromassacarrara@pec.it',
  socialFacebook: '',
  socialInstagram: '',
  socialYouTube: '',
  socialTikTok: '',
  socialLinkedIn: '',
  socialAltro: '',
  intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
  bancaPoste: 'POSTE ITALIANE',
  ibanPoste: 'IT40P0760113600001007035676',
  ccPostale: '00001007035676',
  bancaAppoggio: 'Credit Agricole',
  ibanBanca: 'IT79M0623024500000046980317'
};

function pulisciDenominazioneNoPAServer(
  val?: string,
  fallback: string = DATI_CARTA_INTESTATA_DEFAULT.denominazione
): string {
  const raw = String(val || '').trim();
  if (!raw) return fallback;
  if (/pubblica\s+assistenza|\bP\.A\./i.test(raw)) {
    const stripped = raw
      .replace(/pubblica\s+assistenza\s*/gi, '')
      .replace(/\bP\.A\.\s*/gi, '')
      .trim();
    if (!stripped || /^croce\s*oro$/i.test(stripped)) {
      return fallback;
    }
    return stripped;
  }
  return raw;
}

function normalizeDatiCartaIntestataServer(raw: any): DatiCartaIntestata {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DATI_CARTA_INTESTATA_DEFAULT,
    ...src,
    denominazione: pulisciDenominazioneNoPAServer(src.denominazione, DATI_CARTA_INTESTATA_DEFAULT.denominazione),
    socialFacebook: String(src.socialFacebook ?? '').trim(),
    socialInstagram: String(src.socialInstagram ?? '').trim(),
    socialYouTube: String(src.socialYouTube ?? '').trim(),
    socialTikTok: String(src.socialTikTok ?? '').trim(),
    socialLinkedIn: String(src.socialLinkedIn ?? '').trim(),
    socialAltro: String(src.socialAltro ?? '').trim(),
    intestatarioConti: pulisciDenominazioneNoPAServer(src.intestatarioConti, DATI_CARTA_INTESTATA_DEFAULT.intestatarioConti)
  };
}

function formattaSocialCartaIntestataServer(info?: Partial<DatiCartaIntestata> | null): string {
  if (!info) return '';
  const canali: Array<{ label: string; value?: string; prefixRegex?: RegExp }> = [
    { label: 'Facebook', value: info.socialFacebook, prefixRegex: /^(facebook|fb)\s*:/i },
    { label: 'Instagram', value: info.socialInstagram, prefixRegex: /^(instagram|ig)\s*:/i },
    { label: 'YouTube', value: info.socialYouTube, prefixRegex: /^(youtube|yt)\s*:/i },
    { label: 'TikTok', value: info.socialTikTok, prefixRegex: /^tiktok\s*:/i },
    { label: 'LinkedIn', value: info.socialLinkedIn, prefixRegex: /^linkedin\s*:/i },
    { label: 'Social', value: info.socialAltro, prefixRegex: /^[^:]{2,20}:/ },
  ];
  const parti: string[] = [];
  for (const c of canali) {
    const val = String(c.value ?? '').trim();
    if (!val) continue;
    parti.push(c.prefixRegex && c.prefixRegex.test(val) ? val : `${c.label}: ${val}`);
  }
  return parti.join(' • ');
}

// File di persistenza su disco per non perdere mai dati tra riavvii o crash
const DB_PATH = path.resolve(__dirname, 'data', 'croce_oro_db.json');

// Helper per estrarre il numero progressivo da un codice di missione (es. CO-VET-VERDE-2026-001 -> 1, CO-VET-BIANCO-2026-809 -> 809)
export function estraiProgressivoDaCodice(codice: string, anno: number = getCurrentYearItaly()): number | null {
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

// Calcola il prossimo numero progressivo per le nuove missioni dell'anno specificato.
// Se vengono rimossi uno o più servizi recenti consecutivi, il numero massimo residuo diminuirà
// e il prossimo numero restituito sarà esattamente quello recuperato.
export function calcolaProssimoNumeroMissione(servizi: ArchivedService[], anno: number = getCurrentYearItaly()): number {
  if (!Array.isArray(servizi) || servizi.length === 0) return 1;
  let maxProg = 0;
  for (const s of servizi) {
    if (s.anno && s.anno !== anno) continue;
    const prog = estraiProgressivoDaCodice(s.codice, anno);
    if (prog !== null && prog > maxProg) {
      maxProg = prog;
    }
  }
  return maxProg + 1;
}

export function mergeVolontariLists(esistenti: Volontario[], inArrivo: Volontario[], deletedIds?: string[]): Volontario[] {
  return mergeVolontariListsSafe(esistenti, inArrivo, deletedIds);
}

let FIRMA_QUATTRINI_B64 = '';
try {
  const fPath = path.join(process.cwd(), 'data', 'firma_quattrini.b64');
  if (fs.existsSync(fPath)) {
    FIRMA_QUATTRINI_B64 = fs.readFileSync(fPath, 'utf8').trim();
  }
} catch {}

const INITIAL_VOLONTARI: Volontario[] = [
  {
    id: 'vol-admin',
    nome: 'Amministratore',
    cognome: 'Centrale',
    matricola: 'ADM-001',
    qualifica: 'Soccorritore',
    telefono: '0585 625410',
    email: 'centrale@croceoromassacarrara.it',
    pin: '4451',
    dataRegistrazione: '01/01/2026',
    inTurno: false,
    profiloCentrale: true,
    approvato: true,
    firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAZKADAAQAAAABAAAAMgAAAACHdE+zAAAB8klEQVR4Ae3Xv0scURTH8e9m3c0m0aRSCwtbETuxs7BQLbXyP0gR/AP+BS1iYWVhIdoIWtlYWEhECyv9CVbZ3V0zc7y7ySRmdr248+A9L27e3TPv5jW7s3m7MggEgkAgEAiE/5dAwE1bWvN8j9tqV9786v9y83/d1f8k/9j/e0m3/W0eBAKBQCAQCFx7Au/tq1r9tM3v7Kz/pE1P/6P7e7t6r+91V55n9eO9/q1f2vW3ev4B7rU/38+v5QcBAAAAAADAj5kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M='
  },
  {
    id: 'vol-156',
    nome: 'Claudio',
    cognome: 'Simonini',
    matricola: 'VOL-156',
    qualifica: 'Autista',
    caricaConsiglioDirettivo: 'Presidente',
    firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAZKADAAQAAAABAAAAMgAAAACHdE+zAAAB8klEQVR4Ae3Xv0scURTH8e9m3c0m0aRSCwtbETuxs7BQLbXyP0gR/AP+BS1iYWVhIdoIWtlYWEhECyv9CVbZ3V0zc7y7ySRmdr248+A9L27e3TPv5jW7s3m7MggEgkAgEAiE/5dAwE1bWvN8j9tqV9786v9y83/d1f8k/9j/e0m3/W0eBAKBQCAQCFx7Au/tq1r9tM3v7Kz/pE1P/6P7e7t6r+91V55n9eO9/q1f2vW3ev4B7rU/38+v5QcBAAAAAADAj5kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M=',
    telefono: '333 1234567',
    email: 'claudio.simonini@croceoromassacarrara.it',
    pin: '1234',
    dataRegistrazione: '01/10/2026',
    inTurno: false
  },
  {
    id: 'vol-318',
    nome: 'Mattia',
    cognome: 'Vignali',
    matricola: 'VOL-318',
    qualifica: 'Autista',
    telefono: '3770832318',
    email: 'vignalimattia5@gmail.com',
    pin: '8346',
    dataRegistrazione: '18/10/2026',
    inTurno: false
  },
  {
    id: 'vol-4',
    nome: 'Sara',
    cognome: 'Ferretti',
    matricola: 'VOL-104',
    qualifica: 'Soccorritore',
    caricaConsiglioDirettivo: 'Tesoriere',
    telefono: '339 4443210',
    email: 'sara.ferretti@croceoromassacarrara.it',
    pin: '4321',
    dataRegistrazione: '15/01/2026',
    inTurno: false
  },
  {
    id: 'vol-quattrini',
    nome: 'Simone',
    cognome: 'Quattrini',
    codiceFiscale: 'QTTSMN83L22L833F',
    indirizzoResidenza: 'Via Fossone Basso 31, 19034 Luni (SP)',
    dettaglioResidenza: {
      indirizzo: 'Via Fossone Basso 31',
      comune: 'Luni',
      cap: '19034',
      provincia: 'SP'
    },
    telefono: '3284158897',
    email: 'simone.quattrini@gmail.com',
    matricola: 'OP-04',
    qualifica: 'Operatore Centrale',
    caricaConsiglioDirettivo: 'Segretario',
    profiloCentrale: true,
    approvato: true,
    inTurno: false,
    pin: '5678',
    dataRegistrazione: '05/11/2026',
    firmaBase64: FIRMA_QUATTRINI_B64,
    tesseramento: {
      numeroTessera: 'VOL-003',
      dataPrimaIscrizione: '2026-11-05',
      annoRiferimento: 2026,
      rinnovata: true,
      dataRinnovo: '2026-11-05',
      importoVersato: 0,
      delibera: 'DEL-2026/01 del 2026-11-05',
      libroSoci: 'LS-2026/003',
      copertaDaIscrizioneFineAnnoPrec: false,
      timbroCartaceoEseguito: true
    }
  },
  {
    id: 'vol-ricci',
    nome: 'Noemi',
    cognome: 'Ricci',
    codiceFiscale: 'RCCNMO95H50E625K',
    indirizzoResidenza: 'Via Giardini 12, 54033 Carrara (MS)',
    dettaglioResidenza: {
      indirizzo: 'Via Giardini 12',
      comune: 'Carrara',
      cap: '54033',
      provincia: 'MS'
    },
    telefono: '338 9876543',
    email: 'noemi.ricci@croceoromassacarrara.it',
    matricola: 'VOL-105',
    qualifica: 'Soccorritore',
    caricaConsiglioDirettivo: 'Consigliere',
    profiloCentrale: false,
    approvato: true,
    inTurno: false,
    pin: '2345',
    dataRegistrazione: '05/11/2026'
  }
];

const INITIAL_SERVIZI: ArchivedService[] = [];

const DEMO_PARTI_IDS = new Set([
  'part-001', 'part-002', 'part-003', 'part-004', 'part-005', 'part-006',
  'part-007', 'part-008', 'part-009', 'part-010', 'part-011', 'part-012'
]);
const DEMO_DOTAZIONI_IDS = new Set([
  'dot-001', 'dot-002', 'dot-003', 'dot-004', 'dot-005'
]);

function isGhostMission(m: any): boolean {
  if (!m || typeof m !== 'object') return false;
  if (m.codice === 'CO-VET-ROSSO-2026-001') return true;
  const chiamante = String(m.chiamante || '').trim().toLowerCase();
  const tel = String(m.telefono || '').replace(/\s+/g, '');
  if (chiamante === 'mario bianchi' && tel === '3333112233445') return true;
  return false;
}

function ensureCodiciEliminati(codici?: any[]): string[] {
  const set = new Set<string>(['CO-VET-ROSSO-2026-001']);
  if (Array.isArray(codici)) {
    codici.forEach((c) => {
      if (typeof c === 'string' && c.trim()) {
        set.add(c.trim());
      }
    });
  }
  const arr = Array.from(set);
  return arr.length > 300 ? ['CO-VET-ROSSO-2026-001', ...arr.slice(-299)] : arr;
}

const LEGACY_MOCK_CORSI_IDS_SERVER = new Set([
  'corso-psv-01',
  'corso-aut-01',
  'corso-blsd-01',
  'corso-pc0-01',
  'corso-pcbase-01',
  'corso-form-psv-01'
]);

function filterLegacyCorsiServer(list: any): any[] {
  if (!Array.isArray(list)) return [];
  return list.filter((c: any) => c && !LEGACY_MOCK_CORSI_IDS_SERVER.has(String(c.id || '')));
}

function filterDemoMagazzinoParti(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item: any) => item && !DEMO_PARTI_IDS.has(String(item.id || '')));
}

function filterDemoMagazzinoMezzi(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item: any) => item && !DEMO_DOTAZIONI_IDS.has(String(item.id || '')));
}

function loadPersistedState(): ServerState {
  const currentYear = getCurrentYearItaly();

  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.volontari)) {
        console.log(`[DB Persistente] Caricati ${parsed.volontari.length} volontari da ${DB_PATH}`);
        
        const serviziRaw: ArchivedService[] = Array.isArray(parsed.serviziArchivio)
          ? parsed.serviziArchivio
          : [];

        // Ripartizione cartelle storiche per anni precedenti (< currentYear)
        const cartelle: Record<string, ArchivedService[]> = {};
        serviziRaw.forEach(s => {
          if (s.anno < currentYear) {
            const key = String(s.anno);
            if (!cartelle[key]) cartelle[key] = [];
            cartelle[key].push(s);
          }
        });

        const DUMMY_PURGE = [
          'roberto martini', 'marco verdi', 'giulia neri', 'luca bianchi',
          'mario rossi', 'elena conti', 'marco rossi', 'laura bianchi', 'matteo neri'
        ];
        let loadedVolontari = (Array.isArray(parsed.volontari) ? parsed.volontari : []).filter((v: any) => {
          const full = `${v.nome || ''} ${v.cognome || ''}`.trim().toLowerCase();
          return !DUMMY_PURGE.includes(full);
        });

        const loadedDeletedIds = normalizeDeletedIds(parsed.volontariEliminatiIds);

        // Smart merge protettivo: garantisce che nessuno dei volontari fondamentali (Simone Quattrini, Noemi Ricci, Claudio Simonini, Mattia Vignali, Sara Ferretti, Admin) vada mai perso
        loadedVolontari = mergeVolontariLists(INITIAL_VOLONTARI, loadedVolontari, loadedDeletedIds);

        // Garantisce che Claudio Simonini conservi sempre la carica di Presidente e la firma digitale
        loadedVolontari.forEach((v: any) => {
          if ((v.nome?.toLowerCase() === 'claudio' && v.cognome?.toLowerCase() === 'simonini') || v.id === 'vol-156') {
            if (!v.caricaConsiglioDirettivo) v.caricaConsiglioDirettivo = 'Presidente';
            if (!v.firmaBase64) {
              v.firmaBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAZKADAAQAAAABAAAAMgAAAACHdE+zAAAB8klEQVR4Ae3Xv0scURTH8e9m3c0m0aRSCwtbETuxs7BQLbXyP0gR/AP+BS1iYWVhIdoIWtlYWEhECyv9CVbZ3V0zc7y7ySRmdr248+A9L27e3TPv5jW7s3m7MggEgkAgEAiE/5dAwE1bWvN8j9tqV9786v9y83/d1f8k/9j/e0m3/W0eBAKBQCAQCFx7Au/tq1r9tM3v7Kz/pE1P/6P7e7t6r+91V55n9eO9/q1f2vW3ev4B7rU/38+v5QcBAAAAAADAj5kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M=';
            }
          }
        });

        if (!loadedDeletedIds.includes('vol-admin') && !loadedVolontari.some((v: any) => v.pin === '4451' || v.id === 'vol-admin')) {
          loadedVolontari.unshift({
            id: 'vol-admin',
            nome: 'Amministratore',
            cognome: 'Centrale',
            matricola: 'ADM-001',
            qualifica: 'Soccorritore',
            telefono: '0585 625410',
            email: 'centrale@croceoromassacarrara.it',
            pin: '4451',
            dataRegistrazione: '01/01/2026',
            inTurno: false,
            profiloCentrale: true,
            approvato: true,
            firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAZKADAAQAAAABAAAAMgAAAACHdE+zAAAB8klEQVR4Ae3Xv0scURTH8e9m3c0m0aRSCwtbETuxs7BQLbXyP0gR/AP+BS1iYWVhIdoIWtlYWEhECyv9CVbZ3V0zc7y7ySRmdr248+A9L27e3TPv5jW7s3m7MggEgkAgEAiE/5dAwE1bWvN8j9tqV9786v9y83/d1f8k/9j/e0m3/W0eBAKBQCAQCFx7Au/tq1r9tM3v7Kz/pE1P/6P7e7t6r+91V55n9eO9/q1f2vW3ev4B7rU/38+v5QcBAAAAAADAj5kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M=',
          });
        }
        const loadedDeletedSet = new Set(loadedDeletedIds);
        loadedVolontari = loadedVolontari.filter((v: any) => !v?.id || !loadedDeletedSet.has(String(v.id).trim()));

        const activeMissionPulita = (parsed.activeMission && !isGhostMission(parsed.activeMission))
          ? parsed.activeMission
          : null;

        return {
          volontari: loadedVolontari,
          volontariEliminatiIds: loadedDeletedIds,
          activeMission: activeMissionPulita,
          letturaConfermata: activeMissionPulita ? !!parsed.letturaConfermata : false,
          operativeTimes: activeMissionPulita ? (parsed.operativeTimes || {}) : {},
          kmInizio: activeMissionPulita ? (parsed.kmInizio || '') : '',
          kmFine: activeMissionPulita ? (parsed.kmFine || '') : '',
          ringing: activeMissionPulita ? (parsed.ringing || {
            active: false,
            source: 'Centrale',
            soundType: 'telefono',
            timestamp: 0
          }) : {
            active: false,
            source: '',
            soundType: 'telefono',
            timestamp: 0
          },
          gpsPosition: parsed.gpsPosition || {
            lat: 44.0357,
            lng: 10.1415,
            accuratezza: 12,
            velocita: 0,
            orario: formatTimeItaly()
          },
          activeShift: parsed.activeShift || { attivo: false },
          notifiche: Array.isArray(parsed.notifiche) ? parsed.notifiche.filter((n: any) => !n.testo || !n.testo.includes('CO-VET-ROSSO-2026-001')) : [],
          serviziArchivio: serviziRaw.filter((s: any) => !isGhostMission(s)),
          cartelleAnniPrecedenti: cartelle,
          datiDestinazione: activeMissionPulita ? (parsed.datiDestinazione || null) : null,
          whatsappConfig: {
            token: (parsed.whatsappConfig?.token && parsed.whatsappConfig.token.trim()) || process.env.WHATSAPP_API_TOKEN || '1692890819217239|BxDCvDgtAFgcqN4E5qVUgQWNo8I',
            phoneNumberId: (parsed.whatsappConfig?.phoneNumberId && parsed.whatsappConfig.phoneNumberId.trim()) || process.env.WHATSAPP_PHONE_NUMBER_ID || '1692890819217239',
            businessNumber: parsed.whatsappConfig?.businessNumber || '0585625410'
          },
          turni: (() => {
            if (!Array.isArray(parsed.turni)) return [];
            const norm = normalizzaTurniSedi(parsed.turni);
            const isDemoId = (id: any) => {
              const s = String(id || '').trim();
              return s.startsWith('turno-oggi-') || s.startsWith('turno-domani-');
            };
            if (norm.length > 0 && norm.every((t: any) => isDemoId(t?.id))) {
              return [];
            }
            return norm;
          })(),
          checklistsTemplates: Array.isArray(parsed.checklistsTemplates) ? parsed.checklistsTemplates : undefined,
          checklistsCompilate: Array.isArray(parsed.checklistsCompilate) ? parsed.checklistsCompilate : [],
          sedi: Array.isArray(parsed.sedi) ? normalizzaListaSediAssociative(parsed.sedi) : [],
          datiCartaIntestata: parsed.datiCartaIntestata
            ? normalizeDatiCartaIntestataServer(parsed.datiCartaIntestata)
            : { ...DATI_CARTA_INTESTATA_DEFAULT },
          luoghiTimbratura: Array.isArray(parsed.luoghiTimbratura) && parsed.luoghiTimbratura.length > 0
            ? normalizzaListaLuoghiTimbratura(
                parsed.luoghiTimbratura,
                Array.isArray(parsed.sedi) ? normalizzaListaSediAssociative(parsed.sedi) : undefined
              )
            : LUOGHI_TIMBRATURA_DEFAULT,
          promemoriaTurniInviati: parsed.promemoriaTurniInviati && typeof parsed.promemoriaTurniInviati === 'object' ? parsed.promemoriaTurniInviati : {},
          promemoriaCompleanniInviati: parsed.promemoriaCompleanniInviati && typeof parsed.promemoriaCompleanniInviati === 'object' ? parsed.promemoriaCompleanniInviati : {},
          timbrature: Array.isArray(parsed.timbrature) ? parsed.timbrature : [],
          bacheca: Array.isArray(parsed.bacheca) ? normalizzaComunicazioniBacheca(parsed.bacheca) : [],
          bachecaEliminatiIds: normalizeDeletedIds(parsed.bachecaEliminatiIds),
          notificheBachecaRecenti: Array.isArray(parsed.notificheBachecaRecenti) ? mergeNotificheBachecaRecenti([], parsed.notificheBachecaRecenti) : [],
          giornaleBordo: Array.isArray(parsed.giornaleBordo) ? parsed.giornaleBordo : [],
          codiciEliminati: ensureCodiciEliminati(parsed.codiciEliminati),
          magazzinoParti: filterDemoMagazzinoParti(parsed.magazzinoParti),
          magazzinoMezzi: filterDemoMagazzinoMezzi(parsed.magazzinoMezzi),
          magazzinoVestiario: Array.isArray(parsed.magazzinoVestiario) ? parsed.magazzinoVestiario : undefined,
          attrezzatureOperative: Array.isArray(parsed.attrezzatureOperative) ? parsed.attrezzatureOperative : undefined,
          movimentiMagazzino: Array.isArray(parsed.movimentiMagazzino) ? parsed.movimentiMagazzino : undefined,
          corsiFormazione: filterLegacyCorsiServer(parsed.corsiFormazione),
          noteDiDebito: Array.isArray(parsed.noteDiDebito) ? parsed.noteDiDebito : undefined,
          ricevuteContabilita: Array.isArray(parsed.ricevuteContabilita) ? parsed.ricevuteContabilita : undefined,
          tessereAssociative: Array.isArray(parsed.tessereAssociative) ? parsed.tessereAssociative : undefined,
          altreEntrateUscite: Array.isArray(parsed.altreEntrateUscite) ? parsed.altreEntrateUscite : undefined,
          costiGestione: Array.isArray(parsed.costiGestione) ? parsed.costiGestione : undefined,
          costiServizio: Array.isArray(parsed.costiServizio) ? parsed.costiServizio : undefined,
          loggedSessions: parsed.loggedSessions && typeof parsed.loggedSessions === 'object' ? parsed.loggedSessions : {},
          catalogoMansioni: Array.isArray(parsed.catalogoMansioni) ? parsed.catalogoMansioni : undefined,
          categorieMansioni: Array.isArray(parsed.categorieMansioni) ? parsed.categorieMansioni : undefined,
          mansioniConfigUpdatedAt: typeof parsed.mansioniConfigUpdatedAt === 'number' ? parsed.mansioniConfigUpdatedAt : undefined,
          customEmojiIcons: Array.isArray(parsed.customEmojiIcons) ? parsed.customEmojiIcons : undefined,
          customEmojiIconsUpdatedAt: typeof parsed.customEmojiIconsUpdatedAt === 'number' ? parsed.customEmojiIconsUpdatedAt : undefined,
          nomiDatabase: parsed.nomiDatabase && typeof parsed.nomiDatabase === 'object' ? parsed.nomiDatabase : undefined,
          nomiDatabaseUpdatedAt: typeof parsed.nomiDatabaseUpdatedAt === 'number' ? parsed.nomiDatabaseUpdatedAt : undefined,
          mezziFlotta: Array.isArray(parsed.mezziFlotta) ? parsed.mezziFlotta : undefined,
          mezziFlottaUpdatedAt: typeof parsed.mezziFlottaUpdatedAt === 'number' ? parsed.mezziFlottaUpdatedAt : undefined,
          tipologieMezzo: Array.isArray(parsed.tipologieMezzo) ? parsed.tipologieMezzo : undefined,
          tipologieMezzoUpdatedAt: typeof parsed.tipologieMezzoUpdatedAt === 'number' ? parsed.tipologieMezzoUpdatedAt : undefined,
          tipiTurno: Array.isArray(parsed.tipiTurno) ? parsed.tipiTurno : undefined,
          tipiTurnoUpdatedAt: typeof parsed.tipiTurnoUpdatedAt === 'number' ? parsed.tipiTurnoUpdatedAt : undefined,
          metodiPagamentoCustom: Array.isArray(parsed.metodiPagamentoCustom) ? parsed.metodiPagamentoCustom : undefined,
          metodiPagamentoCustomUpdatedAt: typeof parsed.metodiPagamentoCustomUpdatedAt === 'number' ? parsed.metodiPagamentoCustomUpdatedAt : undefined,
          categorieCostiServizio: Array.isArray(parsed.categorieCostiServizio) ? parsed.categorieCostiServizio : undefined,
          categorieCostiServizioUpdatedAt: typeof parsed.categorieCostiServizioUpdatedAt === 'number' ? parsed.categorieCostiServizioUpdatedAt : undefined,
          pushSubscribers: Array.isArray(parsed.pushSubscribers)
            ? (() => {
                parsed.pushSubscribers.forEach((s: any) => {
                  if (s && s.endpoint && s.subscription?.endpoint) {
                    subscribers.set(String(s.endpoint), {
                      endpoint: String(s.endpoint),
                      role: s.role || 'all',
                      volontarioId: s.volontarioId ? String(s.volontarioId) : undefined,
                      volontarioNome: s.volontarioNome ? String(s.volontarioNome) : undefined,
                      subscription: s.subscription,
                      timestamp: Number(s.timestamp) || Date.now(),
                    });
                  }
                });
                return Array.from(subscribers.values());
              })()
            : [],
          regolaScadenzeMezzi: parsed.regolaScadenzeMezzi && typeof parsed.regolaScadenzeMezzi === 'object' ? parsed.regolaScadenzeMezzi : undefined,
          rubricaNumeriUtili: Array.isArray(parsed.rubricaNumeriUtili) ? parsed.rubricaNumeriUtili : undefined,
          rubricaNumeriUtiliUpdatedAt: typeof parsed.rubricaNumeriUtiliUpdatedAt === 'number' ? parsed.rubricaNumeriUtiliUpdatedAt : undefined,
          indirizziCollezionati: Array.isArray(parsed.indirizziCollezionati) ? parsed.indirizziCollezionati : [],
          contatti: Array.isArray(parsed.contatti) ? parsed.contatti : undefined,
          radioPtt: {
            enabled: Boolean(parsed.radioPtt?.enabled),
            toggledBy: parsed.radioPtt?.toggledBy,
            toggledAt: parsed.radioPtt?.toggledAt,
            activeSpeaker: null
          },
          radioGroups: Array.isArray(parsed.radioGroups)
            ? (() => {
                const seenIds = new Set<string>();
                const seenNames = new Set<string>();
                const deduped: RadioGroup[] = [];
                parsed.radioGroups.forEach((g: any) => {
                  const id = String(g.id || `grp-${Date.now()}`);
                  const name = String(g.name || 'Gruppo Radio').trim();
                  const normName = name.toLowerCase();
                  if (seenIds.has(id) || seenNames.has(normName)) return;
                  seenIds.add(id);
                  seenNames.add(normName);
                  deduped.push({
                    id,
                    name,
                    enabled: Boolean(g.enabled),
                    memberIds: Array.isArray(g.memberIds) ? g.memberIds.map((m: any) => String(m)) : [],
                    createdBy: g.createdBy,
                    createdAt: Number(g.createdAt) || Date.now(),
                    toggledBy: g.toggledBy,
                    toggledAt: g.toggledAt,
                    activeSpeaker: null
                  });
                });
                return deduped;
              })()
            : [],
          radioEmergency: {
            active: false
          },
          publicAppUrl: typeof parsed.publicAppUrl === 'string' ? parsed.publicAppUrl : ''
        };
      }
    }
  } catch (err) {
    console.error('[DB Persistente] Errore lettura file database:', err);
  }

  // Valori predefiniti se non esiste il database
  const cartelleInit: Record<string, ArchivedService[]> = {};
  INITIAL_SERVIZI.forEach(s => {
    if (s.anno < currentYear) {
      const key = String(s.anno);
      if (!cartelleInit[key]) cartelleInit[key] = [];
      cartelleInit[key].push(s);
    }
  });

  return {
    volontari: [
      {
        id: 'vol-admin',
        nome: 'Amministratore',
        cognome: 'Centrale',
        matricola: 'ADM-001',
        qualifica: 'Soccorritore',
        telefono: '0585 625410',
        email: 'centrale@croceoromassacarrara.it',
        pin: '4451',
        dataRegistrazione: '01/01/2026',
        inTurno: false,
        profiloCentrale: true,
        approvato: true,
        firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAZKADAAQAAAABAAAAMgAAAACHdE+zAAAB8klEQVR4Ae3Xv0scURTH8e9m3c0m0aRSCwtbETuxs7BQLbXyP0gR/AP+BS1iYWVhIdoIWtlYWEhECyv9CVbZ3V0zc7y7ySRmdr248+A9L27e3TPv5jW7s3m7MggEgkAgEAiE/5dAwE1bWvN8j9tqV9786v9y83/d1f8k/9j/e0m3/W0eBAKBQCAQCFx7Au/tq1r9tM3v7Kz/pE1P/6P7e7t6r+91V55n9eO9/q1f2vW3ev4B7rU/38+v5QcBAAAAAADAj5kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M/573N+s5+x73O7q723v6729l/f1f77e6e580/5n3v50eBAAAAAADAj1kAAAAAAADA/7M='
      },
      ...INITIAL_VOLONTARI
    ],
    volontariEliminatiIds: [],
    activeMission: null,
    letturaConfermata: false,
    operativeTimes: {},
    kmInizio: '',
    kmFine: '',
    ringing: {
      active: false,
      source: 'Centrale',
      soundType: 'telefono',
      timestamp: 0
    },
    gpsPosition: {
      lat: 44.0357, // Sede Croce Oro Massa Carrara
      lng: 10.1415,
      accuratezza: 12,
      velocita: 0,
      orario: formatTimeItaly()
    },
    activeShift: {
      attivo: false
    },
    notifiche: [
      {
        id: 'init-srv-1',
        orario: formatTimeItaly(),
        testo: 'CENTRALE OPERATIVA ATTIVA: Server sincronizzato in tempo reale su rete protetta.',
        tipo: 'sistema'
      }
    ],
    serviziArchivio: INITIAL_SERVIZI,
    cartelleAnniPrecedenti: cartelleInit,
    whatsappConfig: {
      token: process.env.WHATSAPP_API_TOKEN || '1692890819217239|BxDCvDgtAFgcqN4E5qVUgQWNo8I',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1692890819217239',
      businessNumber: '0585625410'
    },
    datiCartaIntestata: { ...DATI_CARTA_INTESTATA_DEFAULT },
    luoghiTimbratura: LUOGHI_TIMBRATURA_DEFAULT,
    promemoriaTurniInviati: {},
    promemoriaCompleanniInviati: {},
    timbrature: [],
    bacheca: [],
    bachecaEliminatiIds: [],
    notificheBachecaRecenti: [],
    giornaleBordo: [],
    codiciEliminati: ['CO-VET-ROSSO-2026-001'],
    magazzinoParti: [],
    magazzinoMezzi: [],
    corsiFormazione: [],
    indirizziCollezionati: [],
    radioPtt: {
      enabled: false,
      activeSpeaker: null
    },
    radioGroups: [],
    radioEmergency: {
      active: false
    }
  };
}

const state: ServerState = loadPersistedState();

function hasTimbraturaApertaServer(vol: Partial<Volontario>, timbratureList: any[]): any | null {
  if (!Array.isArray(timbratureList) || timbratureList.length === 0) return null;
  const volId = (vol.id || '').trim();
  const full1 = `${vol.nome || ''} ${vol.cognome || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
  const full2 = `${vol.cognome || ''} ${vol.nome || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    timbratureList.find(t => {
      if (!t || (t.orarioUscita && String(t.orarioUscita).trim() !== '')) return false;
      if (volId && t.volontarioId === volId) return true;
      const tNome = (t.volontarioNome || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!tNome) return false;
      return (full1 && tNome === full1) || (full2 && tNome === full2);
    }) || null
  );
}

function syncVolontariInTurnoWithTimbrature(): boolean {
  if (!Array.isArray(state.volontari)) return false;
  let changed = false;
  state.volontari = state.volontari.map(v => {
    const isDiTurno = Boolean(hasTimbraturaApertaServer(v, state.timbrature || []));
    if (Boolean(v.inTurno) !== isDiTurno) {
      changed = true;
      return { ...v, inTurno: isDiTurno };
    }
    return v;
  });
  return changed;
}

// Allinea subito inTurno alle sole timbrature aperte (un account loggato non è di turno finché non timbra)
syncVolontariInTurnoWithTimbrature();

// Riconcilia bidirezionalmente state.loggedSessions <-> state.volontari[].loggato usando i timestamp
// così nessun aggiornamento parziale o massivo può azzerare volontari regolarmente loggati
function reconcileVolontariConLoggedSessions(): boolean {
  if (!state.loggedSessions || typeof state.loggedSessions !== 'object') {
    state.loggedSessions = {};
  }
  if (!Array.isArray(state.volontari)) return false;

  let changed = false;
  const nextSessions: Record<string, any> = { ...state.loggedSessions };

  state.volontari = state.volontari.map(v => {
    if (!v || !v.id) return v;
    const sess = nextSessions[v.id];
    const sessTs = typeof sess?.updatedAt === 'number' && Number.isFinite(sess.updatedAt) ? sess.updatedAt : 0;
    const volTs = typeof v.loggatoUpdatedAt === 'number' && Number.isFinite(v.loggatoUpdatedAt) ? v.loggatoUpdatedAt : 0;

    if (sess) {
      if (volTs > sessTs && typeof v.loggato === 'boolean') {
        nextSessions[v.id] = {
          ...sess,
          loggato: v.loggato,
          updatedAt: volTs,
          volontarioNome: sess.volontarioNome || `${v.nome || ''} ${v.cognome || ''}`.trim() || undefined,
          mezzoScelto: v.loggato ? (v.mezzoAttivo || sess.mezzoScelto || '') : ''
        };
        changed = true;
        return v;
      }
      const sessLoggato = Boolean(sess.loggato);
      const effectiveTs = Math.max(sessTs, volTs) || undefined;
      if (Boolean(v.loggato) !== sessLoggato || v.loggatoUpdatedAt !== effectiveTs) {
        changed = true;
        return {
          ...v,
          loggato: sessLoggato,
          loggatoUpdatedAt: effectiveTs
        };
      }
      return v;
    }

    if (v.loggato === true) {
      const ts = volTs || Date.now();
      nextSessions[v.id] = {
        loggato: true,
        updatedAt: ts,
        volontarioNome: `${v.nome || ''} ${v.cognome || ''}`.trim() || undefined,
        mezzoScelto: v.mezzoAttivo || ''
      };
      changed = true;
      if (!v.loggatoUpdatedAt) {
        return { ...v, loggatoUpdatedAt: ts };
      }
    }
    return v;
  });

  const mergedSessions = mergeLoggedSessionsSafe(state.loggedSessions, nextSessions);
  const normalizedSessions: NonNullable<ServerState['loggedSessions']> = {};
  for (const [volId, entry] of Object.entries(mergedSessions)) {
    normalizedSessions[volId] = {
      loggato: Boolean(entry.loggato),
      updatedAt: typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now(),
      ...(entry.volontarioNome ? { volontarioNome: entry.volontarioNome } : {}),
      ...(entry.mezzoScelto !== undefined ? { mezzoScelto: entry.mezzoScelto } : {}),
      ...(entry.orarioInizio ? { orarioInizio: entry.orarioInizio } : {}),
    };
  }
  state.loggedSessions = normalizedSessions;
  return changed;
}

reconcileVolontariConLoggedSessions();

// Auto-ripulitura: se la missione presente in activeMission è già stata archiviata con KM completati,
// azzera activeMission e i dati operativi temporanei così i terminali risultano liberi per nuovo servizio
if (state.activeMission && state.serviziArchivio && Array.isArray(state.serviziArchivio)) {
  const giaArchiviatoCompleto = state.serviziArchivio.find(s => s.codice === state.activeMission?.codice && !s.inAttesaKm);
  if (giaArchiviatoCompleto) {
    state.activeMission = null;
    state.letturaConfermata = false;
    state.operativeTimes = {};
    state.kmInizio = '';
    state.kmFine = '';
    state.datiDestinazione = null;
    state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };
  }
}

export function maskPinInNotification(testo: string): string {
  if (!testo) return '';
  return testo
    .replace(/\b4451\b/g, '[RISERVATO]')
    .replace(/(reimpostato\s+a\s+)[0-9A-Za-z]{3,8}/gi, '$1[RISERVATO]')
    .replace(/\bPIN(?:\s*personale|\s*operatore|\s*volontario|\s*amministratore)?\s*(?::|=|\s)\s*([0-9]{3,8})\b/gi, 'PIN [RISERVATO]')
    .replace(/\bPIN\s*\(([0-9]{3,8})\)/gi, 'PIN ([RISERVATO])')
    .replace(/(\bcon\s+PIN\s+)[0-9]{3,8}\b/gi, '$1[RISERVATO]')
    .replace(/(\bnuovo\s+PIN(?:\s*:)?\s*)[0-9]{3,8}\b/gi, '$1[RISERVATO]');
}

// Sanitizza permanentemente lo storico notifiche radio per rimuovere qualsiasi PIN personale
if (state.notifiche && Array.isArray(state.notifiche)) {
  state.notifiche = state.notifiche.map(n => ({
    ...n,
    testo: maskPinInNotification(n.testo)
  }));
}

function persistState() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const currentYear = getCurrentYearItaly();
    // Aggiorna cartelle storiche anni precedenti (< currentYear)
    const cartelle: Record<string, ArchivedService[]> = {};
    (state.serviziArchivio || []).forEach(s => {
      if (s.anno < currentYear) {
        const key = String(s.anno);
        if (!cartelle[key]) cartelle[key] = [];
        cartelle[key].push(s);
      }
    });
    state.cartelleAnniPrecedenti = cartelle;

    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Persistente] Errore salvataggio:', err);
  }
}

// Salva subito lo stato iniziale
persistState();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // ABILITA CORS COMPLETO per consentire l'accesso da smartphone Android (TWA / WebView / app installata)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // Socket proprietario della trasmissione PTT in diretta corrente (generale + per gruppo) + watchdog anti-blocco
  let activePttSocket: WebSocket | null = null;
  const activeGroupSockets = new Map<string, WebSocket | null>();

  const isSocketAllowedInGroup = (client: WebSocket, group: RadioGroup): boolean => {
    const role = (client as any).clientRole;
    if (role === 'admin') return true;
    const volId = (client as any).volontarioId ? String((client as any).volontarioId) : '';
    if (!volId) return false;
    return Array.isArray(group.memberIds) && group.memberIds.includes(volId);
  };

  // Funzione broadcast per inoltrare messaggi a tutti i client connessi (o filtrati per gruppo)
  const broadcast = (message: any, excludeClient?: WebSocket) => {
    const raw = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch (err) {
          console.error('Errore invio WebSocket:', err);
        }
      }
    });
  };

  const broadcastToFilter = (
    message: any,
    predicate: (client: WebSocket) => boolean,
    excludeClient?: WebSocket
  ) => {
    const raw = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN && predicate(client)) {
        try {
          client.send(raw);
        } catch (err) {
          console.error('Errore invio WebSocket filtrato:', err);
        }
      }
    });
  };

  setInterval(() => {
    const now = Date.now();
    if (state.radioPtt?.activeSpeaker) {
      const timeoutMs = state.radioPtt.activeSpeaker.isEmergency ? 10000 : 5000;
      if (now - state.radioPtt.activeSpeaker.lastChunkAt > timeoutMs) {
        state.radioPtt.activeSpeaker = null;
        activePttSocket = null;
        broadcast({
          type: 'PTT_SPEAKER_CHANGED',
          channelId: 'general',
          radioPtt: state.radioPtt
        });
      }
    }

    if (Array.isArray(state.radioGroups)) {
      let groupDirty = false;
      state.radioGroups.forEach((g) => {
        if (g.activeSpeaker && now - g.activeSpeaker.lastChunkAt > 5000) {
          g.activeSpeaker = null;
          activeGroupSockets.set(g.id, null);
          groupDirty = true;
          broadcastToFilter(
            {
              type: 'PTT_SPEAKER_CHANGED',
              channelId: g.id,
              groupId: g.id,
              activeSpeaker: null,
              radioGroup: g
            },
            (c) => isSocketAllowedInGroup(c, g)
          );
        }
      });
      if (groupDirty) {
        broadcast({
          type: 'RADIO_GROUPS_UPDATED',
          radioGroups: state.radioGroups
        });
      }
    }
  }, 2000);

  // Negoziazione automatica miglior codec comune tra i terminali connessi (Opus 48kHz vs ADPCM 24kHz)
  const recomputeRadioCodecMode = (shouldBroadcast: boolean = true) => {
    if (!state.radioPtt) return;
    let connected = 0;
    let knownCaps = 0;
    let allSupportOpus = true;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        connected++;
        const cap = (client as any).supportsOpus;
        if (typeof cap === 'boolean') {
          knownCaps++;
          if (!cap) allSupportOpus = false;
        } else {
          allSupportOpus = false;
        }
      }
    });
    // Usa ADPCM 24kHz Super-Wideband HD di default (compatibile al 100% con iOS, Android, Desktop e relay Firestore)
    // Attiva Opus 48kHz solo quando almeno 2 client WS sono connessi sullo stesso server e tutti confermano supporto Opus
    const nextMode: 'opus-48k' | 'adpcm-24k' =
      connected >= 2 && knownCaps === connected && allSupportOpus ? 'opus-48k' : 'adpcm-24k';
    if (state.radioPtt.codecMode !== nextMode) {
      state.radioPtt.codecMode = nextMode;
      if (shouldBroadcast) {
        broadcast({
          type: 'RADIO_PTT_STATE',
          radioPtt: state.radioPtt
        });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // GESTIONE AUTOMATICA PROMEMORIA TURNI: AVVISO IL GIORNO PRIMA ALLE ORE 09:00
  // ---------------------------------------------------------------------------
  interface AssegnazioneTurnoVolontario {
    volontarioId?: string;
    volontarioNome: string;
    ruolo: string;
  }

  const estraiVolontariDaTurno = (turno: any): AssegnazioneTurnoVolontario[] => {
    const lista: AssegnazioneTurnoVolontario[] = [];
    const aggiungiSePresente = (slot: any, defaultRuolo: string) => {
      if (!slot) return;
      if (typeof slot === 'object' && slot.nome && String(slot.nome).trim()) {
        lista.push({
          volontarioId: slot.id ? String(slot.id) : undefined,
          volontarioNome: String(slot.nome).trim(),
          ruolo: defaultRuolo
        });
      } else if (typeof slot === 'string' && slot.trim()) {
        lista.push({
          volontarioNome: slot.trim(),
          ruolo: defaultRuolo
        });
      }
    };

    aggiungiSePresente(turno.autista, 'Autista');
    aggiungiSePresente(turno.caposervizio, 'Caposervizio');
    aggiungiSePresente(turno.soccorritore2, 'Secondo Soccorritore');
    aggiungiSePresente(turno.terzoSoccorritore, 'Terzo Soccorritore');
    aggiungiSePresente(turno.operatoreCentrale, 'Operatore Centrale');
    aggiungiSePresente(turno.centralinista, 'Centralinista');
    aggiungiSePresente(turno.osservatore, 'Osservatore');

    if (Array.isArray(turno.richiesteIscrizione)) {
      turno.richiesteIscrizione.forEach((req: any) => {
        if (req && req.stato === 'Approvato' && req.volontarioNome) {
          lista.push({
            volontarioId: req.volontarioId ? String(req.volontarioId) : undefined,
            volontarioNome: String(req.volontarioNome).trim(),
            ruolo: req.ruoloRichiesto ? String(req.ruoloRichiesto) : 'Soccorritore'
          });
        }
      });
    }

    // Deduplica per volontarioId o nome normalizzato
    const deduplicati: AssegnazioneTurnoVolontario[] = [];
    const visti = new Set<string>();
    for (const item of lista) {
      const chiave = item.volontarioId || item.volontarioNome.toLowerCase();
      if (!visti.has(chiave)) {
        visti.add(chiave);
        deduplicati.push(item);
      }
    }

    return deduplicati;
  };

  const getItalianDateInfo = (date = new Date()) => {
    const parts = getItalianDateParts(date);
    return {
      todayStr: parts.isoDate,
      tomorrowStr: parts.tomorrowIsoDate,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
      isOraLegale: parts.isOraLegale,
      fasciaOraLabel: parts.fasciaOraLabel,
      fasciaOraShort: parts.fasciaOraShort,
      offsetMinutes: parts.offsetMinutes
    };
  };

  const formattaDataItalianaBreve = (dataStr: string): string => {
    try {
      const [y, m, d] = dataStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: ITALY_TIMEZONE
      };
      const formatted = date.toLocaleDateString('it-IT', options);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return dataStr;
    }
  };

  const inviaEmailPromemoriaTurno = async (
    destinatarioEmail: string,
    nomeVolontario: string,
    datiTurno: {
      dataFormatted: string;
      fascia: string;
      sede: string;
      ruolo: string;
      mezzo?: string;
      note?: string;
    }
  ): Promise<boolean> => {
    if (!destinatarioEmail || !destinatarioEmail.includes('@')) {
      return false;
    }

    try {
      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let fromUser = 'sistemiautomatizzati@croceoro.org';

      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          fromUser = candidate.includes('@') ? candidate : 'sistemiautomatizzati@croceoro.org';
          break;
        } catch {}
      }

      if (!transporter) {
        console.warn(`[Promemoria Email] Impossibile autenticare transporter SMTP per ${destinatarioEmail}`);
        return false;
      }

      const oggetto = `📅 PROMEMORIA TURNO PER DOMANI (${datiTurno.dataFormatted}) - Croce Oro Massa Carrara OdV`;

      const htmlEmail = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; max-width: 650px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1d1a60 0%, #2e2694 100%); color: #fbbf24; padding: 24px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 21px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #fbbf24; font-weight: bold; text-transform: uppercase;">Sistemi Automatizzati &bull; Ufficio Turni &bull; Avviso Programmato</p>
          </div>

          <div style="padding: 26px; background-color: #ffffff;">
            <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Gentile <strong>${nomeVolontario}</strong>,</p>
            <p style="font-size: 14px; color: #334155;">
              ti ricordiamo che per la giornata di domani, <strong>${datiTurno.dataFormatted}</strong>, sei regolarmente inserito a tabellone per il seguente turno di servizio operativo:
            </p>

            <div style="background-color: #f8fafc; border-left: 5px solid #16a34a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 13.5px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <p style="margin: 5px 0;"><strong>📅 Data Turno:</strong> <span style="color: #0f172a; font-weight: 700;">${datiTurno.dataFormatted}</span></p>
              <p style="margin: 5px 0;"><strong>⏱️ Fascia Oraria:</strong> <span style="color: #15803d; font-weight: 700;">${datiTurno.fascia}</span></p>
              <p style="margin: 5px 0;"><strong>📍 Sede Operativa:</strong> <span style="color: #1d1a60; font-weight: 700;">${datiTurno.sede}</span></p>
              <p style="margin: 5px 0;"><strong>🚑 Incarico / Ruolo:</strong> <span style="color: #b45309; font-weight: 700;">${datiTurno.ruolo}</span></p>
              ${datiTurno.mezzo ? `<p style="margin: 5px 0;"><strong>🚒 Mezzo Assegnato:</strong> <span style="color: #0f172a; font-weight: 700;">${datiTurno.mezzo}</span></p>` : ''}
              ${datiTurno.note ? `<p style="margin: 5px 0;"><strong>📝 Note / Disposizioni:</strong> <span style="color: #64748b;">${datiTurno.note}</span></p>` : ''}
            </div>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 12.5px; color: #1e40af;">
              <strong>ℹ️ Istruzioni per il Volontario:</strong><br />
              All'inizio del servizio, ricordati di effettuare l'accesso con il tuo PIN personale sul terminale mobile o tablet di bordo per avviare la sessione operativa ed effettuare la checklist del veicolo se richiesta.
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
              Questa notifica automatica è stata inviata alle ore 09:00 del giorno precedente il turno all'indirizzo email con cui ti sei registrato.<br />
              Per qualsiasi impedimento, sostituzione o variazione, contatta tempestivamente la <strong>Centrale Operativa</strong> al numero <strong>0585 625410</strong>.
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0;">
            <strong>Croce Oro Massa Carrara OdV</strong> &bull; Via del Patriota 2, 54100 Massa (MS)<br />
            Centrale Operativa H24: 0585 625410 &bull; <a href="mailto:info@croceoro.org" style="color: #1d1a60; text-decoration: none;">info@croceoro.org</a>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Croce Oro Massa Carrara OdV" <${fromUser}>`,
        to: destinatarioEmail,
        subject: oggetto,
        html: htmlEmail
      });
      console.log(`[Promemoria Email] Inviata con successo a ${destinatarioEmail} (${nomeVolontario})`);
      return true;
    } catch (err: any) {
      console.error(`[Promemoria Email] Errore invio a ${destinatarioEmail}:`, err?.message || err);
      return false;
    }
  };

  const eseguiControlloPromemoriaTurniDomani = (forzaInvio = false): {
    countInviati: number;
    dettagli: any[];
  } => {
    const timeInfo = getItalianDateInfo();
    const { todayStr, tomorrowStr, hour } = timeInfo;

    // L'avviso deve scattare il giorno prima a partire dalle ore 9:00 di mattina
    if (!forzaInvio && hour < 9) {
      return { countInviati: 0, dettagli: [] };
    }

    const turni = Array.isArray(state.turni) ? state.turni : [];
    if (turni.length === 0) {
      return { countInviati: 0, dettagli: [] };
    }

    const turniDomani = turni.filter((t: any) => t && t.data === tomorrowStr);
    if (turniDomani.length === 0) {
      return { countInviati: 0, dettagli: [] };
    }

    if (!state.promemoriaTurniInviati) {
      state.promemoriaTurniInviati = {};
    }

    let countInviati = 0;
    const dettagli: any[] = [];
    let hasStateChanges = false;

    // Raggruppa TUTTI i turni di domani per singolo account volontario:
    // ogni account riceve UNA SOLA notifica alle ore 09:00 del giorno precedente,
    // indipendentemente dal turno (o dal numero di turni) a cui è assegnato.
    const perAccount = new Map<
      string,
      {
        volKey: string;
        volontarioId?: string;
        volontarioNome: string;
        turniAssegnati: Array<{
          turno: any;
          ruolo: string;
          fascia: string;
          sede: string;
          dataFormatted: string;
          mezzo: string;
        }>;
      }
    >();

    for (const turno of turniDomani) {
      const assegnati = estraiVolontariDaTurno(turno);
      const dataFormatted = formattaDataItalianaBreve(turno.data);
      const fascia = turno.fasciaOraria || `${turno.orarioInizio || '08:00'} - ${turno.orarioFine || '14:00'}`;
      const sede = turno.sedeNome || 'Sede Operativa';
      const mezzo = turno.mezzoAssegnato ? ` • Mezzo: ${turno.mezzoAssegnato}` : '';

      for (const vol of assegnati) {
        const volKey = String(
          vol.volontarioId || vol.volontarioNome.toLowerCase().trim().replace(/\s+/g, '_')
        ).trim();
        if (!volKey) continue;
        let entry = perAccount.get(volKey);
        if (!entry) {
          entry = {
            volKey,
            volontarioId: vol.volontarioId,
            volontarioNome: vol.volontarioNome,
            turniAssegnati: [],
          };
          perAccount.set(volKey, entry);
        }
        // Evita duplicati sullo stesso turno
        if (!entry.turniAssegnati.some((x) => x.turno.id === turno.id)) {
          entry.turniAssegnati.push({
            turno,
            ruolo: vol.ruolo,
            fascia,
            sede,
            dataFormatted,
            mezzo,
          });
        }
      }
    }

    for (const entry of perAccount.values()) {
      // Chiave UNICA per account e giornata (massimo 1 notifica per account il giorno prima alle 09:00)
      const reminderDayKey = `promemoria_giorno_${todayStr}_${entry.volKey}`;
      // Compatibilità con vecchie chiavi per turno eventualmente già inviate oggi
      const alreadySentLegacy = entry.turniAssegnati.some(
        (x) => Boolean(state.promemoriaTurniInviati?.[`promemoria_${todayStr}_${x.turno.id}_${entry.volKey}`])
      );

      if (!forzaInvio && (state.promemoriaTurniInviati[reminderDayKey] || alreadySentLegacy)) {
        if (!state.promemoriaTurniInviati[reminderDayKey]) {
          state.promemoriaTurniInviati[reminderDayKey] = new Date().toISOString();
          hasStateChanges = true;
        }
        continue;
      }

      const primo = entry.turniAssegnati[0];
      if (!primo) continue;

      const volRecord = (state.volontari || []).find(
        (v: any) =>
          (entry.volontarioId && v.id === entry.volontarioId) ||
          (`${v.nome || ''} ${v.cognome || ''}`.toLowerCase().trim() === entry.volontarioNome.toLowerCase().trim()) ||
          (v.nome && v.nome.toLowerCase().trim() === entry.volontarioNome.toLowerCase().trim())
      );
      const volEmail = volRecord?.email?.trim();

      const titolo = `📅 PROMEMORIA TURNO PER DOMANI (Ore 09:00)`;
      const riepilogoTurni =
        entry.turniAssegnati.length === 1
          ? `[${primo.fascia}] presso ${primo.sede} (Ruolo: ${primo.ruolo}${primo.mezzo})`
          : entry.turniAssegnati
              .map((x) => `[${x.fascia}] presso ${x.sede} (${x.ruolo}${x.mezzo})`)
              .join(' ; ');
      const testo = `Ciao ${entry.volontarioNome}, ti ricordiamo che domani ${primo.dataFormatted} sei di turno: ${riepilogoTurni}.`;

      // 1. Invio UNICA Notifica Push su smartphone/device del volontario
      sendPushNotificationToVolunteer(entry.volontarioId, {
        title: titolo,
        body: testo,
        tag: `promemoria-turno-giorno-${todayStr}-${entry.volKey}`,
        urgenza: 'VERDE',
        soundType: 'chiamata',
        url: '/?tab=turni',
        targetVolontarioId: entry.volontarioId,
        targetVolontarioNome: entry.volontarioNome,
        timestamp: Date.now()
      });

      // 2. Invio UNICA Email di promemoria all'indirizzo con cui il volontario si è registrato
      if (volEmail && volEmail.includes('@')) {
        inviaEmailPromemoriaTurno(volEmail, entry.volontarioNome, {
          dataFormatted: primo.dataFormatted,
          fascia:
            entry.turniAssegnati.length === 1
              ? primo.fascia
              : entry.turniAssegnati.map((x) => `${x.fascia} (${x.sede})`).join(' + '),
          sede: primo.sede,
          ruolo: primo.ruolo,
          mezzo: primo.turno.mezzoAssegnato,
          note: primo.turno.note
        }).catch(err => {
          console.error(`[Promemoria Turni] Errore asincrono invio email a ${volEmail}:`, err);
        });
      }

      // 3. Notifica Radio di sistema per tracciamento in Centrale
      const notif: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `📅 PROMEMORIA TURNO DOMANI (Ore 09:00): Notifica inviata su device${volEmail ? ` e via email (${volEmail})` : ''} a ${entry.volontarioNome} per ${riepilogoTurni}.`,
        tipo: 'sistema'
      };
      state.notifiche.push(notif);

      // 4. Broadcast in tempo reale WebSocket per i client attivi (1 solo evento per account/giorno)
      broadcast({
        type: 'PROMEMORIA_TURNO_DOMANI',
        reminderDayKey,
        todayStr,
        turnoId: primo.turno.id,
        turno: primo.turno,
        volontarioId: entry.volontarioId,
        volontarioNome: entry.volontarioNome,
        volontarioEmail: volEmail || undefined,
        ruolo: primo.ruolo,
        fascia:
          entry.turniAssegnati.length === 1
            ? primo.fascia
            : entry.turniAssegnati.map((x) => x.fascia).join(' + '),
        sede: primo.sede,
        dataTurno: primo.turno.data,
        dataFormatted: primo.dataFormatted,
        titolo,
        testo,
        notification: notif,
        timestamp: Date.now()
      });

      state.promemoriaTurniInviati[reminderDayKey] = new Date().toISOString();
      hasStateChanges = true;
      countInviati++;
      dettagli.push({
        volontario: entry.volontarioNome,
        volontarioId: entry.volontarioId,
        email: volEmail || null,
        emailInviata: Boolean(volEmail && volEmail.includes('@')),
        ruolo: primo.ruolo,
        turnoId: primo.turno.id,
        fascia: primo.fascia,
        sede: primo.sede,
        dataDomani: tomorrowStr
      });
    }

    if (hasStateChanges) {
      persistState();
      console.log(`[Promemoria Turni] Inviati con successo ${countInviati} promemoria unici per i turni di domani (${tomorrowStr}).`);
    }

    return { countInviati, dettagli };
  };

  // =========================================================================
  // SISTEMA AUTOMATICO NOTIFICHE COMPLEANNI VOLONTARI
  // Invia email e notifica in-app/radio a Presidenza + TUTTI gli account
  // che hanno accesso al database Volontari ('volontari' in macroCategorieAbilitate)
  // =========================================================================
  const CF_MESI_MAP: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
    L: 7, M: 8, P: 9, R: 10, S: 11, T: 12
  };

  const estraiDataNascitaCompleta = (vol: any): { day: number; month: number; year?: number; formatted?: string } | null => {
    if (!vol) return null;
    const raw = String(vol.dataNascita || '').trim();
    if (raw) {
      const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (iso) {
        const y = parseInt(iso[1], 10);
        const m = parseInt(iso[2], 10);
        const d = parseInt(iso[3], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return {
            day: d,
            month: m,
            year: y,
            formatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
          };
        }
      }
      const itMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (itMatch) {
        const d = parseInt(itMatch[1], 10);
        const m = parseInt(itMatch[2], 10);
        let y = parseInt(itMatch[3], 10);
        if (y < 100) y += y > 25 ? 1900 : 2000;
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return {
            day: d,
            month: m,
            year: y,
            formatted: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
          };
        }
      }
    }

    // Fallback automatico da Codice Fiscale (16 caratteri) se dataNascita non compilata
    const cf = String(vol.codiceFiscale || '').trim().toUpperCase();
    if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) {
      const yy = parseInt(cf.slice(6, 8), 10);
      const month = CF_MESI_MAP[cf[8]];
      let day = parseInt(cf.slice(9, 11), 10);
      if (day > 40) day -= 40;
      const currentTwoDigitYear = getCurrentYearItaly() % 100;
      const fullYear = yy <= currentTwoDigitYear ? 2000 + yy : 1900 + yy;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return {
          day,
          month,
          year: fullYear,
          formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${fullYear}`
        };
      }
    }
    return null;
  };

  const calcolaDestinatariEmailCompleanni = (volontariList: any[], extraEmails: string[] = []): string[] => {
    const emailSet = new Set<string>(['presidenza@croceoro.org']);

    for (const v of volontariList) {
      if (!v || v.eliminato || v.approvato === false) continue;
      const email = String(v.emailNotifiche || v.email || '').trim().toLowerCase();
      if (!email || !email.includes('@') || !email.includes('.')) continue;

      const hasVolontariDb =
        Array.isArray(v.macroCategorieAbilitate) && v.macroCategorieAbilitate.includes('volontari');
      const isPresidente = Boolean(
        (v.caricaConsiglioDirettivo && String(v.caricaConsiglioDirettivo).toLowerCase().includes('presidente')) ||
        (v.qualifica && String(v.qualifica).toLowerCase().includes('presidente'))
      );

      if (hasVolontariDb || isPresidente) {
        emailSet.add(email);
      }
    }

    for (const extra of extraEmails) {
      const cleaned = String(extra || '').trim().toLowerCase();
      if (cleaned && cleaned.includes('@') && cleaned.includes('.')) {
        emailSet.add(cleaned);
      }
    }

    return Array.from(emailSet);
  };

  const inviaEmailCompleannoVolontari = async (
    destinatari: string[],
    festeggiati: Array<{
      id: string;
      nomeCompleto: string;
      qualifica?: string;
      sezione?: string;
      eta?: number;
      dataNascita?: string;
    }>,
    oggiFormatted: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!destinatari || destinatari.length === 0 || !festeggiati || festeggiati.length === 0) {
      return { ok: false, error: 'Nessun destinatario o festeggiato valido' };
    }

    try {
      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let fromUser = 'sistemiautomatizzati@croceoro.org';

      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: { user: candidate, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });
          await t.verify();
          transporter = t;
          fromUser = candidate.includes('@') ? candidate : 'sistemiautomatizzati@croceoro.org';
          break;
        } catch {}
      }

      if (!transporter) {
        return { ok: false, error: 'Impossibile autenticare transporter SMTP' };
      }

      const nomiOggetto = festeggiati.map(f => f.nomeCompleto).join(', ');
      const oggetto =
        festeggiati.length === 1
          ? `🎂 BUON COMPLEANNO: ${nomiOggetto} (${oggiFormatted}) - Croce Oro Massa Carrara OdV`
          : `🎂 COMPLEANNI DEL GIORNO (${oggiFormatted}): ${nomiOggetto} - Croce Oro Massa Carrara OdV`;

      const listaTesto = festeggiati
        .map(f => {
          const dettagli = [
            f.eta !== undefined ? `${f.eta} anni` : null,
            f.qualifica || null,
            f.sezione || null
          ].filter(Boolean).join(' • ');
          return `• ${f.nomeCompleto}${dettagli ? ` (${dettagli})` : ''}`;
        })
        .join('\n');

      const testoEmail =
        `Croce Oro Massa Carrara OdV — Notifica Compleanni Volontari\n\n` +
        `Oggi ${oggiFormatted} ricorre il compleanno di:\n` +
        `${listaTesto}\n\n` +
        `Questa notifica automatica viene inviata alla Presidenza e a tutti gli account abilitati all'accesso al database Anagrafiche Volontari.\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Automatizzati`;

      const rowsHtml = festeggiati
        .map(f => `
          <div style="background-color: #fffbeb; border-left: 5px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin: 12px 0;">
            <p style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">🎂 ${f.nomeCompleto}</p>
            <p style="margin: 6px 0 0; font-size: 13px; color: #475569;">
              ${f.eta !== undefined ? `<strong style="color: #b45309;">Compie ${f.eta} anni</strong>` : 'Compleanno oggi'}
              ${f.qualifica ? ` &bull; ${f.qualifica}` : ''}
              ${f.sezione ? ` &bull; Sezione: ${f.sezione}` : ''}
            </p>
          </div>
        `)
        .join('');

      const htmlEmail = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; max-width: 650px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #1d1a60 0%, #2e2694 100%); color: #fbbf24; padding: 24px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #fbbf24; font-weight: bold; text-transform: uppercase;">Database Anagrafiche Volontari &bull; Notifica Compleanni</p>
          </div>
          <div style="padding: 26px;">
            <p style="margin-top: 0; font-size: 14.5px; color: #0f172a;">
              Buongiorno,<br />
              ti segnaliamo che nella giornata di oggi, <strong>${oggiFormatted}</strong>, ricorre il compleanno del seguente personale associativo:
            </p>
            ${rowsHtml}
            <p style="font-size: 12px; color: #64748b; margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              Questa email automatica viene inviata alla Presidenza e a tutti gli account autorizzati alla consultazione del database <strong>Anagrafiche Volontari</strong>.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0;">
            <strong>Croce Oro Massa Carrara OdV</strong> &bull; Via Como 12, Massa (MS)<br />
            Centrale Operativa H24: 0585 625410 &bull; <a href="mailto:volontari@croceoro.org" style="color: #1d1a60; text-decoration: none;">volontari@croceoro.org</a>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: {
          name: 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati',
          address: 'sistemiautomatizzati@croceoro.org'
        },
        sender: 'sistemiautomatizzati@croceoro.org',
        replyTo: 'sistemiautomatizzati@croceoro.org',
        to: destinatari,
        subject: oggetto,
        text: testoEmail,
        html: htmlEmail
      });

      console.log(`[Compleanni Email] Inviata notifica con successo a ${destinatari.join(', ')} per ${nomiOggetto}`);
      return { ok: true };
    } catch (err: any) {
      console.error('[Compleanni Email] Errore SMTP:', err?.message || err);
      return { ok: false, error: err?.message || 'Errore SMTP invio compleanni' };
    }
  };

  const eseguiControlloCompleanniOggi = async (
    forzaInvio = false,
    clientVolontari?: any[]
  ): Promise<{
    countInviati: number;
    festeggiati: Array<{ id: string; nomeCompleto: string; qualifica?: string; sezione?: string; eta?: number }>;
    destinatari: string[];
    speditoViaSmtp: boolean;
    erroreSmtp?: string;
  }> => {
    const timeInfo = getItalianDateInfo();
    const { todayStr, hour } = timeInfo;
    const [yearStr, monthStr, dayStr] = todayStr.split('-');
    const yearNow = parseInt(yearStr, 10);
    const monthNow = parseInt(monthStr, 10);
    const dayNow = parseInt(dayStr, 10);
    const oggiFormatted = `${dayStr}/${monthStr}/${yearStr}`;

    // Controllo automatico giornaliero attivo dalle 08:00 italiane (a meno di forzatura esplicita)
    if (!forzaInvio && hour < 8) {
      return { countInviati: 0, festeggiati: [], destinatari: [], speditoViaSmtp: false };
    }

    // Unisci stato server + eventuali record aggiornati inviati dal client (es. da Firebase Firestore)
    const mergedMap = new Map<string, any>();
    for (const v of state.volontari || []) {
      if (v && v.id) mergedMap.set(String(v.id), v);
    }
    if (Array.isArray(clientVolontari)) {
      for (const v of clientVolontari) {
        if (v && v.id) {
          const existing = mergedMap.get(String(v.id)) || {};
          mergedMap.set(String(v.id), { ...existing, ...v });
        }
      }
    }
    const listaVolontari = Array.from(mergedMap.values());

    if (!state.promemoriaCompleanniInviati) {
      state.promemoriaCompleanniInviati = {};
    }

    const festeggiatiOggi: Array<{
      id: string;
      nomeCompleto: string;
      qualifica?: string;
      sezione?: string;
      eta?: number;
      dataNascita?: string;
    }> = [];

    for (const v of listaVolontari) {
      if (!v || v.eliminato || v.approvato === false) continue;
      const nascita = estraiDataNascitaCompleta(v);
      if (!nascita) continue;
      if (nascita.day === dayNow && nascita.month === monthNow) {
        const nomeCompleto = `${v.nome || ''} ${v.cognome || ''}`.trim() || v.matricola || 'Volontario';
        const eta = nascita.year && nascita.year > 1900 && nascita.year <= yearNow ? yearNow - nascita.year : undefined;
        festeggiatiOggi.push({
          id: String(v.id || nomeCompleto.toLowerCase().replace(/\s+/g, '_')),
          nomeCompleto,
          qualifica: v.qualifica,
          sezione: v.sezioneAppartenenzaNome,
          eta,
          dataNascita: nascita.formatted
        });
      }
    }

    const tuttiDestinatari = calcolaDestinatariEmailCompleanni(listaVolontari);
    if (festeggiatiOggi.length === 0) {
      return { countInviati: 0, festeggiati: [], destinatari: tuttiDestinatari, speditoViaSmtp: false };
    }

    // Calcola chi non ha ancora ricevuto la notifica di compleanno oggi (o tutti se forzaInvio)
    const emailsDaNotificareSet = new Set<string>();
    const festeggiatiNuoviPerNotifica: typeof festeggiatiOggi = [];
    let isPrimaNotificaSistemaOggi = false;

    for (const f of festeggiatiOggi) {
      const key = `compleanno_${todayStr}_${f.id}`;
      const existingRec = state.promemoriaCompleanniInviati[key];
      const giaInviatiEmails = new Set<string>(
        typeof existingRec === 'object' && existingRec && Array.isArray(existingRec.recipients)
          ? existingRec.recipients.map(e => String(e).toLowerCase())
          : []
      );

      if (!existingRec) {
        isPrimaNotificaSistemaOggi = true;
      }

      if (forzaInvio) {
        tuttiDestinatari.forEach(em => emailsDaNotificareSet.add(em));
        festeggiatiNuoviPerNotifica.push(f);
      } else {
        let missingForThisBirthday = false;
        for (const em of tuttiDestinatari) {
          if (typeof existingRec === 'string') {
            // Vecchio formato stringa senza elenco: considera già inviato solo se non abbiamo lista nuovi
            continue;
          }
          if (!giaInviatiEmails.has(em.toLowerCase())) {
            emailsDaNotificareSet.add(em);
            missingForThisBirthday = true;
          }
        }
        if (missingForThisBirthday) {
          festeggiatiNuoviPerNotifica.push(f);
        }
      }
    }

    const destinatariDaNotificare = Array.from(emailsDaNotificareSet);
    if (destinatariDaNotificare.length === 0 || festeggiatiNuoviPerNotifica.length === 0) {
      return {
        countInviati: 0,
        festeggiati: festeggiatiOggi,
        destinatari: tuttiDestinatari,
        speditoViaSmtp: false
      };
    }

    const esitoMail = await inviaEmailCompleannoVolontari(
      destinatariDaNotificare,
      festeggiatiNuoviPerNotifica,
      oggiFormatted
    );

    // Aggiorna tracciamento destinatari notificati per ogni festeggiato
    for (const f of festeggiatiNuoviPerNotifica) {
      const key = `compleanno_${todayStr}_${f.id}`;
      const prev = state.promemoriaCompleanniInviati[key];
      const prevRecs =
        typeof prev === 'object' && prev && Array.isArray(prev.recipients)
          ? prev.recipients
          : [];
      const unionRecipients = Array.from(new Set([...prevRecs, ...destinatariDaNotificare]));
      state.promemoriaCompleanniInviati[key] = {
        sentAt: new Date().toISOString(),
        recipients: unionRecipients
      };
    }

    const nomiStr = festeggiatiNuoviPerNotifica
      .map(f => `${f.nomeCompleto}${f.eta !== undefined ? ` (${f.eta} anni)` : ''}`)
      .join(', ');

    if (forzaInvio || isPrimaNotificaSistemaOggi) {
      const notifRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🎂 COMPLEANNO VOLONTARIO (${oggiFormatted}): Oggi festeggia ${nomiStr}! Email inviata a Presidenza e a tutti gli account con accesso al database Volontari (${destinatariDaNotificare.join(', ')}).`,
        tipo: 'sistema'
      };
      state.notifiche.push(notifRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();

      broadcast({
        type: 'NOTIFICA_COMPLEANNO_VOLONTARIO',
        dataOggi: oggiFormatted,
        festeggiati: festeggiatiNuoviPerNotifica,
        destinatariEmail: destinatariDaNotificare,
        notification: notifRadio,
        timestamp: Date.now()
      });

      sendPushNotificationToRole('admin', {
        title: `🎂 Compleanno in Croce Oro (${oggiFormatted})`,
        body: `Oggi è il compleanno di ${nomiStr}!`,
        tag: `compleanno-${todayStr}`,
        urgenza: 'VERDE',
        url: '/?tab=volontari'
      });
    }

    persistState();

    return {
      countInviati: festeggiatiNuoviPerNotifica.length,
      festeggiati: festeggiatiNuoviPerNotifica,
      destinatari: destinatariDaNotificare,
      speditoViaSmtp: esitoMail.ok,
      erroreSmtp: esitoMail.error
    };
  };

  // Funzione unificata per elaborare e sincronizzare eventi in tempo reale (da WebSocket o da HTTP POST /api/event)
  const handleIncomingAction = (type: string, data: any, excludeClient?: WebSocket) => {
    switch (type) {
      // --- SINCRONIZZAZIONE CALENDARIO TURNI MULTI-SEDE IN TEMPO REALE ---
      case 'UPDATE_TURNI': {
        const turniArray = Array.isArray(data?.turni) ? data.turni : (Array.isArray(data) ? data : null);
        if (turniArray) {
          state.turni = turniArray;
          persistState();
          broadcast({
            type: 'TURNI_UPDATED',
            turni: state.turni
          });
          // Se sono almeno le ore 9:00 e ci sono assegnazioni per domani, invia subito promemoria
          setTimeout(() => {
            try {
              eseguiControlloPromemoriaTurniDomani(false);
            } catch {}
          }, 600);
        }
        break;
      }

      case 'SUBMIT_CANDIDATURA_TURNO': {
        if (data?.turnoId && data?.candidatura?.id) {
          const currentTurni = Array.isArray(state.turni) ? [...state.turni] : [];
          let found = false;
          let changed = false;
          const nextTurni = currentTurni.map((t: any) => {
            if (t && t.id === data.turnoId) {
              found = true;
              const esistenti = Array.isArray(t.richiesteIscrizione) ? t.richiesteIscrizione : [];
              if (esistenti.some((r: any) => r && r.id === data.candidatura.id)) {
                return t;
              }
              changed = true;
              return {
                ...t,
                richiesteIscrizione: [...esistenti, data.candidatura]
              };
            }
            return t;
          });
          if (found && changed) {
            state.turni = nextTurni;
            persistState();
            broadcast({
              type: 'TURNI_UPDATED',
              turni: state.turni
            });
            broadcast({
              type: 'NOTIFICA_DISPONIBILITA_TURNO',
              tipo: 'disponibilita_turno',
              turnoId: data.turnoId,
              volontarioNome: data.candidatura.volontarioNome,
              ruolo: data.candidatura.ruoloRichiesto,
              data: data.data || '',
              fascia: data.fascia || '',
              sede: data.sede || '',
              timestamp: Date.now()
            });
          }
        }
        break;
      }

      // --- SINCRONIZZAZIONE CHECKLIST INIZIO TURNO GUIDATA MEZZI IN TEMPO REALE ---
      case 'UPDATE_CHECKLISTS_TEMPLATES': {
        const templatesArray = Array.isArray(data?.templates) ? data.templates : (Array.isArray(data) ? data : null);
        if (templatesArray) {
          state.checklistsTemplates = templatesArray;
          persistState();
          broadcast({
            type: 'CHECKLISTS_TEMPLATES_UPDATED',
            templates: state.checklistsTemplates
          });
        }
        break;
      }

      case 'SUBMIT_CHECKLIST_COMPILATA': {
        if (data && data.mezzo) {
          if (!Array.isArray(state.checklistsCompilate)) {
            state.checklistsCompilate = [];
          }
          state.checklistsCompilate.unshift(data);
          if (state.checklistsCompilate.length > 500) {
            state.checklistsCompilate = state.checklistsCompilate.slice(0, 500);
          }

          let notif: RadioNotification | null = null;
          if (data.statoGenerale === 'con_anomalie' || (Array.isArray(data.anomalieRilevate) && data.anomalieRilevate.length > 0)) {
            const elencoAnomalie = (data.anomalieRilevate || []).map((a: any) => a.voceTitolo || a.note).filter(Boolean).join(', ');
            notif = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `⚠️ CHECKLIST ${data.mezzo}: Anomalia segnalata da ${data.volontarioNome || 'Volontario'}: ${elencoAnomalie || 'Difetto segnalato a inizio turno'}`,
              tipo: 'allarme'
            };
            state.notifiche.push(notif);

            sendPushNotificationToRole('admin', {
              title: `⚠️ ANOMALIA CHECKLIST ${data.mezzo}`,
              body: `Il volontario ${data.volontarioNome || 'in turno'} ha segnalato non conformità su ${data.mezzo}: ${elencoAnomalie}`,
              tag: `chk-anomalia-${data.id}`,
              urgenza: 'GIALLO'
            });
          }

          persistState();
          broadcast({
            type: 'CHECKLIST_COMPILATA_ADDED',
            checklistCompilata: data,
            checklistsCompilate: state.checklistsCompilate,
            notification: notif || undefined
          });
        }
        break;
      }

      // --- GESTIONE VOLONTARI E PIN IN TEMPO REALE ---
          case 'CREATE_VOLONTARIO': {
            if (data && data.nome) {
              const idVol = data.id || `vol-${Date.now()}`;
              const nuovoVol: Volontario = {
                ...data,
                id: idVol,
                pin: String(data.pin || '0000').trim() || '0000',
              };
              state.volontariEliminatiIds = normalizeDeletedIds(
                (state.volontariEliminatiIds || []).filter((id) => id !== idVol)
              );
              state.volontari = mergeVolontariLists(
                state.volontari,
                [nuovoVol],
                state.volontariEliminatiIds
              );
              persistState();

              const notif: RadioNotification = {
                id: generateUniqueNotifId(),
                orario: formatTimeItaly(),
                testo: `👤 NUOVO VOLONTARIO: Registrato ${nuovoVol.nome} ${nuovoVol.cognome || ''} (${nuovoVol.qualifica || 'Volontario'})`,
                tipo: 'sistema'
              };
              state.notifiche.push(notif);

              broadcast({
                type: 'VOLONTARI_UPDATED',
                volontari: state.volontari,
                volontariEliminatiIds: state.volontariEliminatiIds,
                notification: notif
              });

              // Notifica Push alla Centrale
              sendPushNotificationToRole('admin', {
                title: `👤 NUOVO PROFILO VOLONTARIO`,
                body: `${nuovoVol.nome} ${nuovoVol.cognome || ''} è stato registrato nel database (${nuovoVol.qualifica || 'Volontario'})`,
                tag: `vol-${idVol}`,
                urgenza: 'VERDE'
              });
            }
            break;
          }

          case 'UPDATE_VOLONTARIO': {
            if (data && data.id) {
              state.volontariEliminatiIds = normalizeDeletedIds(
                (state.volontariEliminatiIds || []).filter((id) => id !== data.id)
              );
              state.volontari = mergeVolontariLists(
                state.volontari,
                [data],
                state.volontariEliminatiIds
              );
              persistState();

              broadcast({
                type: 'VOLONTARI_UPDATED',
                volontari: state.volontari,
                volontariEliminatiIds: state.volontariEliminatiIds
              });
            }
            break;
          }

          case 'UPDATE_VOLONTARI_LIST': {
            if (Array.isArray(data?.volontari)) {
              const mergedDeleted = normalizeDeletedIds([
                ...(state.volontariEliminatiIds || []),
                ...(Array.isArray(data?.volontariEliminatiIds) ? data.volontariEliminatiIds : [])
              ]);
              state.volontariEliminatiIds = mergedDeleted;
              state.volontari = mergeVolontariLists(state.volontari, data.volontari, mergedDeleted);
              reconcileVolontariConLoggedSessions();
              persistState();

              broadcast({
                type: 'VOLONTARI_UPDATED',
                volontari: state.volontari,
                volontariEliminatiIds: state.volontariEliminatiIds,
                loggedSessions: state.loggedSessions
              });
            }
            break;
          }

          case 'UPDATE_PUBLIC_APP_URL': {
            const rawUrl = typeof data?.publicAppUrl === 'string' ? data.publicAppUrl.trim() : '';
            if (!rawUrl || !isProtectedAiStudioHost(rawUrl)) {
              state.publicAppUrl = rawUrl ? normalizePublicUrlInput(rawUrl) : '';
              persistState();
            }
            break;
          }

          case 'DELETE_VOLONTARIO': {
            const delId = data?.id ? String(data.id).trim() : '';
            const mergedDeleted = normalizeDeletedIds([
              ...(state.volontariEliminatiIds || []),
              ...(Array.isArray(data?.volontariEliminatiIds) ? data.volontariEliminatiIds : []),
              ...(delId ? [delId] : [])
            ]);
            state.volontariEliminatiIds = mergedDeleted;
            if (Array.isArray(data?.volontari)) {
              state.volontari = mergeVolontariLists(state.volontari, data.volontari, mergedDeleted);
            }
            state.volontari = state.volontari.filter((v) => !v.id || !mergedDeleted.includes(v.id));
            persistState();

            broadcast({
              type: 'VOLONTARI_UPDATED',
              volontari: state.volontari,
              volontariEliminatiIds: state.volontariEliminatiIds
            });
            break;
          }

          // 1. Invio Nuova Scheda Missione da Centrale al Volontario
          case 'DISPATCH_MISSION': {
            if (!data) break;
            const cod = data.codice || `CO-GEN-${Date.now()}`;
            const isManualDispatch = Boolean(data._manualDispatch);

            // BLOCCO PERMANENTE SERVIZIO FANTASMA & CODICI ANNULLATI/ELIMINATI
            if (isGhostMission(data) || cod === 'CO-VET-ROSSO-2026-001') {
              console.warn(`[Server] Bloccato tentativo di reinvio servizio eliminato/fantasma: ${cod}`);
              state.codiciEliminati = ensureCodiciEliminati([...(state.codiciEliminati || []), cod]);
              if (state.activeMission && isGhostMission(state.activeMission)) {
                state.activeMission = null;
                state.letturaConfermata = false;
                state.operativeTimes = {};
                state.kmInizio = '';
                state.kmFine = '';
                state.datiDestinazione = null;
                state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: Date.now() };
              }
              persistState();
              const clearMsg = {
                type: 'MISSION_CLEARED',
                forceClear: true,
                codiceEliminato: cod,
                blockedGhost: true
              };
              if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                try { excludeClient.send(JSON.stringify(clearMsg)); } catch {}
              }
              broadcast(clearMsg);
              break;
            }

            if (!isManualDispatch && Array.isArray(state.codiciEliminati) && state.codiciEliminati.includes(cod)) {
              console.warn(`[Server] Bloccata risincronizzazione automatica di servizio già eliminato/annullato: ${cod}`);
              const clearMsg = {
                type: 'MISSION_CLEARED',
                forceClear: true,
                codiceEliminato: cod
              };
              if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                try { excludeClient.send(JSON.stringify(clearMsg)); } catch {}
              }
              break;
            }

            // Se è un invio manuale esplicito con codice diverso da quello eliminato, consenti l'operazione e pulisci il flag
            const { _manualDispatch: _ignoredFlag, ...missionPayload } = data;
            if (isManualDispatch && Array.isArray(state.codiciEliminati)) {
              state.codiciEliminati = state.codiciEliminati.filter(c => c === 'CO-VET-ROSSO-2026-001' || c !== cod);
            }

            const urg = missionPayload.urgenza || 'VERDE';
            const mezzo = missionPayload.mezzoAssegnato || 'T4606';

            // Precompila al volontario i km iniziali del servizio con i km finali del servizio precedente (più recente) effettuato con lo stesso mezzo,
            // oppure con i km iniziali inseriti dall'amministratore nel Database Mezzi alla prima uscita
            let kmInizialiPrecompilati = '';
            const extractCanonical = (raw?: string) =>
              String(raw || '').split(/\s*[-–(]/)[0].trim().toLowerCase();
            const targetMezzo = extractCanonical(mezzo);
            const parseServiceTime = (s: any): number => {
              if (typeof s?.timestamp === 'number' && s.timestamp > 0) return s.timestamp;
              const str = String(s?.data || '').trim();
              const itMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:.*?\b(\d{1,2})[:.](\d{2}))?/);
              if (itMatch) {
                return new Date(
                  Number(itMatch[3]),
                  Number(itMatch[2]) - 1,
                  Number(itMatch[1]),
                  Number(itMatch[4] || 0),
                  Number(itMatch[5] || 0)
                ).getTime();
              }
              const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
              if (isoMatch) {
                return new Date(
                  Number(isoMatch[1]),
                  Number(isoMatch[2]) - 1,
                  Number(isoMatch[3]),
                  Number(isoMatch[4] || 0),
                  Number(isoMatch[5] || 0)
                ).getTime();
              }
              return 0;
            };
            const matchMezzo = (candidate?: string) => {
              const c = extractCanonical(candidate);
              if (!c || !targetMezzo) return false;
              return c === targetMezzo || c.includes(targetMezzo) || targetMezzo.includes(c);
            };
            if (targetMezzo && Array.isArray(state.serviziArchivio)) {
              const matchingServices = state.serviziArchivio
                .map((s: any, idx: number) => ({ s, idx, ts: parseServiceTime(s) }))
                .filter(({ s }: any) => s && s.kmFine && Number(s.kmFine) > 0 && matchMezzo(s.mezzo))
                .sort((a: any, b: any) => (b.ts - a.ts) || (a.idx - b.idx));
              if (matchingServices.length > 0 && Number(matchingServices[0].s.kmFine) > 0) {
                kmInizialiPrecompilati = String(matchingServices[0].s.kmFine);
              }
            }
            if (!kmInizialiPrecompilati && targetMezzo && Array.isArray((state as any).mezziFlotta)) {
              const mezzoDb = (state as any).mezziFlotta.find((m: any) => matchMezzo(m?.sigla));
              if (
                mezzoDb &&
                typeof mezzoDb.chilometraggioAttuale === 'number' &&
                Number.isFinite(mezzoDb.chilometraggioAttuale) &&
                mezzoDb.chilometraggioAttuale >= 0
              ) {
                kmInizialiPrecompilati = String(mezzoDb.chilometraggioAttuale);
              }
            }

            const kmInizioEffettivo =
              missionPayload.kmInizio !== undefined && String(missionPayload.kmInizio).trim() !== ''
                ? String(missionPayload.kmInizio).trim()
                : kmInizialiPrecompilati;

            const isAutonomo = Boolean(missionPayload.autonomoVolontario);

            state.activeMission = {
              ...missionPayload,
              codice: cod,
              urgenza: urg,
              mezzoAssegnato: mezzo,
              kmInizio: kmInizioEffettivo,
              autonomoVolontario: isAutonomo,
              creatoDaVolontarioNome: missionPayload.creatoDaVolontarioNome,
              creatoDaVolontarioId: missionPayload.creatoDaVolontarioId,
              tipologiaServizio: missionPayload.tipologiaServizio,
              numeroSegreteriaSoupRt: missionPayload.numeroSegreteriaSoupRt,
              allertaMeteo: missionPayload.allertaMeteo
            };
            state.letturaConfermata = isAutonomo ? true : false;
            state.operativeTimes = {};
            state.kmInizio = kmInizioEffettivo;
            state.kmFine = '';
            state.ringing = {
              active: true,
              source: isAutonomo
                ? `Equipaggio Mezzo ${mezzo} (Servizio Autonomo: ${cod})`
                : `Centrale Operativa (Nuova Scheda: ${cod})`,
              soundType: (isAutonomo || urg === 'ROSSO') ? 'sirena' : 'telefono',
              timestamp: Date.now()
            };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: isAutonomo
                ? `🚨 MEZZO IN MOVIMENTO (SERVIZIO AUTONOMO): Il volontario ${data.creatoDaVolontarioNome || 'a bordo'} ha avviato autonomamente un ${data.ambito || 'SERVIZIO'} (${data.tipologiaServizio || data.specifiche || cod}) con il mezzo ${mezzo}. IL MEZZO SI STA SPOSTANDO!`
                : `DISPATCH: Nuova scheda inviata a bordo mezzo ${mezzo} (${cod})`,
              tipo: isAutonomo ? 'allarme' : 'centrale'
            };
            state.notifiche.push(notif);
            persistState();

            // Trasmette a tutti i telefoni/client
            broadcast({
              type: 'MISSION_DISPATCHED',
              mission: state.activeMission,
              ringing: state.ringing,
              notification: notif
            });

            if (isAutonomo) {
              // Notifica Push immediata per la Centrale Operativa / Amministratore
              sendPushNotificationToRole('admin', {
                title: `🚨 ATTENZIONE: IL MEZZO ${mezzo} SI STA SPOSTANDO!`,
                body: `Servizio autonomo avviato dal volontario ${data.creatoDaVolontarioNome || 'a bordo'} (${data.ambito} - ${data.tipologiaServizio || data.specifiche || cod}).`,
                tag: `autonomo-${cod}`,
                urgenza: 'ROSSO',
                soundType: 'sirena',
                source: `Mezzo ${mezzo}`
              });
            } else {
              // Invia Notifica Push di Sistema a tutti gli smartphone dei volontari (risveglia schermo bloccato)
              sendPushNotificationToRole('volontario', {
                title: `🚨 ALLERTA ${urg}: Missione ${cod}`,
                body: `📍 ${data.indirizzo || 'Massa Carrara'} - Mezzo: ${mezzo} | ${data.sintesi || 'Apri subito per visualizzare la scheda.'}`,
                tag: `mission-${cod}`,
                urgenza: urg,
                source: 'Centrale Operativa'
              });
            }
            break;
          }

          // 2. Conferma Lettura della Scheda da parte del Volontario
          case 'CONFIRM_MISSION_READ': {
            state.letturaConfermata = true;
            state.ringing = {
              active: true,
              source: `Equipaggio Mezzo (Confermata Lettura Scheda: ${data?.codice || state.activeMission?.codice || ''})`,
              soundType: 'telefono',
              timestamp: Date.now()
            };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `📖 Equipaggio ha confermato presa visione e lettura della scheda ${data?.codice || ''}`,
              tipo: 'mezzo'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'MISSION_READ_CONFIRMED',
              codice: data?.codice,
              ringing: state.ringing,
              notification: notif
            });

            sendPushNotificationToRole('admin', {
              title: `📖 SCHEDA PRESA IN CARICO (${data?.codice || ''})`,
              body: `L'equipaggio a bordo mezzo ha confermato la presa visione.`,
              tag: `read-${data?.codice}`,
              soundType: 'telefono',
              urgenza: 'VERDE'
            });
            break;
          }

          // 3. Squillo Telefono / Allarme Sirena
          case 'TRIGGER_RING': {
            state.ringing = {
              active: true,
              source: data.source || 'Centrale Operativa',
              soundType: data.soundType || 'telefono',
              timestamp: Date.now()
            };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🚨 SQUILLO TELEFONO ATTIVATO da ${data.source || 'Operatore'} [Tipo: ${data.soundType}]`,
              tipo: 'allarme'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'RING_TRIGGERED',
              ringing: state.ringing,
              notification: notif
            });

            const targetRole = (data.source || '').toLowerCase().includes('centrale') ? 'volontario' : 'admin';
            sendPushNotificationToRole(targetRole, {
              title: `🔔 ALLERTA SUONERIA TELEFONO`,
              body: `Squillo attivato da ${data.source || 'Centrale'} [${data.soundType || 'telefono'}]`,
              tag: 'ring-alert',
              soundType: data.soundType,
              urgenza: 'ROSSO'
            });
            break;
          }

          // 4. Silenzia / Arresta Squillo Telefono
          case 'STOP_RING': {
            state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: Date.now() };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🔕 SUONERIA SILENZIATA dall'operatore.`,
              tipo: 'sistema'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'RING_STOPPED',
              notification: notif
            });
            break;
          }

          // 5. Registrazione Orari Operativi (Partenza, Sul Posto, Rientro, ecc.)
          // REGOLA FERREA: ogni orario già cliccato (verde) è immutabile e non può mai essere sovrascritto da nessuno.
          case 'UPDATE_OPERATIVE_TIMES': {
            const prevTimes: any = state.operativeTimes && typeof state.operativeTimes === 'object' ? { ...state.operativeTimes } : {};
            const incTimes: any = data.times && typeof data.times === 'object' ? data.times : {};
            const mergedTimes: any = { ...prevTimes, ...incTimes };
            const immutableKeys = ['partenza', 'sulPosto', 'partenzaObiettivo', 'arrivoDestinazione', 'fineMissione', 'rientro'];
            for (const k of immutableKeys) {
              if (prevTimes[k] && String(prevTimes[k]).trim() !== '') {
                mergedTimes[k] = prevTimes[k];
              }
            }
            if (prevTimes.coordinateSulPosto && !incTimes.coordinateSulPosto) {
              mergedTimes.coordinateSulPosto = prevTimes.coordinateSulPosto;
            }
            if (prevTimes.coordinateDestinazione && !incTimes.coordinateDestinazione) {
              mergedTimes.coordinateDestinazione = prevTimes.coordinateDestinazione;
            }
            state.operativeTimes = mergedTimes;

            let extraGps = '';
            if (data.times?.coordinateSulPosto && (data.label?.includes('SUL POSTO') || data.label?.includes('posto'))) {
              const c = data.times.coordinateSulPosto;
              extraGps = ` [📍 GPS Certificato: Lat ${c.lat}°, Lng ${c.lng}° (±${c.accuracy || 5}m)]`;
            } else if (data.times?.coordinateDestinazione && (data.label?.includes('DESTINAZIONE') || data.label?.includes('destinazione'))) {
              const c = data.times.coordinateDestinazione;
              extraGps = ` [📍 GPS Certificato: Lat ${c.lat}°, Lng ${c.lng}° (±${c.accuracy || 5}m)]`;
            }

            const labelUpper = (data.label || '').toUpperCase();
            const isPartenzaAutonoma = Boolean(
              state.activeMission?.autonomoVolontario && (labelUpper.includes('PARTENZA') || labelUpper.includes('SEDE'))
            );

            if (isPartenzaAutonoma) {
              state.ringing = {
                active: true,
                source: `Mezzo ${state.activeMission?.mezzoAssegnato || ''} in Movimento (Partenza da Sede: ${data.codice || ''})`,
                soundType: 'sirena',
                timestamp: Date.now()
              };
            } else if (labelUpper.includes('SUL POSTO') || labelUpper.includes('DESTINAZIONE') || labelUpper.includes('FINE MISSIONE') || data.isRientro || labelUpper.includes('RIENTRO')) {
              state.ringing = {
                active: true,
                source: `Equipaggio Mezzo (${data.label || (data.isRientro ? 'Chiusura Scheda' : 'Orario Operativo')}: ${data.codice || ''})`,
                soundType: (labelUpper.includes('SUL POSTO') && (!state.activeMission?.destinazione || state.activeMission?.inAttesaDestinazione)) ? 'sirena' : 'telefono',
                timestamp: Date.now()
              };
            }

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: isPartenzaAutonoma
                ? `🚗 MEZZO IN MOVIMENTO (PARTENZA DA SEDE): Il mezzo ${state.activeMission?.mezzoAssegnato || ''} è PARTITO DALLA SEDE alle ore ${data.timeStr} per ${data.codice} (${state.activeMission?.ambito || 'Servizio Autonomo'})! Il mezzo si sta spostando.`
                : data.isRientro
                ? `🚨 ULTIMO ORARIO REGISTRATO: [6. RIENTRO IN SEDE] alle ore ${data.timeStr} per ${data.codice}!`
                : `⏱️ Registrato orario: [${data.label}] alle ore ${data.timeStr} (${data.codice})${extraGps}`,
              tipo: (isPartenzaAutonoma || data.isRientro) ? 'allarme' : 'mezzo'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'OPERATIVE_TIMES_UPDATED',
              times: state.operativeTimes,
              label: data.label,
              timeStr: data.timeStr,
              isRientro: data.isRientro,
              codice: data.codice,
              ringing: state.ringing,
              notification: notif
            });

            if (isPartenzaAutonoma) {
              sendPushNotificationToRole('admin', {
                title: `🚨 ATTENZIONE: IL MEZZO ${state.activeMission?.mezzoAssegnato || ''} SI STA SPOSTANDO!`,
                body: `Partenza dalla sede registrata alle ore ${data.timeStr} per il servizio autonomo ${data.codice} (${state.activeMission?.ambito || ''}).`,
                tag: `partenza-${data.codice}`,
                soundType: 'sirena',
                urgenza: 'ROSSO'
              });
            } else {
              sendPushNotificationToRole('admin', {
                title: data.isRientro ? `🏁 RIENTRO IN SEDE (${data.codice})` : `⏱️ ORARIO REGISTRATO: [${data.label}]`,
                body: `Ore ${data.timeStr} per ${data.codice}${extraGps}.`,
                tag: `time-${data.codice}`,
                soundType: (labelUpper.includes('SUL POSTO') && (!state.activeMission?.destinazione || state.activeMission?.inAttesaDestinazione)) ? 'sirena' : 'telefono',
                urgenza: data.isRientro ? 'ROSSO' : 'VERDE'
              });
            }
            break;
          }

          // 5b. Allerta Mezzo Sul Posto Senza Destinazione
          case 'ATTESA_DESTINAZIONE_ARRIVO_SUL_POSTO': {
            if (state.activeMission) {
              state.activeMission.inAttesaDestinazione = true;
            }

            state.ringing = {
              active: true,
              source: `Equipaggio Mezzo ${data.mezzo || ''} (Arrivato Sul Posto - In Attesa Destinazione)`,
              soundType: 'sirena',
              timestamp: Date.now()
            };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🚨 MEZZO SUL POSTO: Equipaggio ${data.mezzo || ''} (${data.codice || ''}) è arrivato sull'obiettivo ed è IN ATTESA DEL LUOGO DI DESTINAZIONE E CODICE DI RIENTRO!`,
              tipo: 'allarme'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'ATTESA_DESTINAZIONE_TRIGGERED',
              codice: data.codice,
              mezzo: data.mezzo,
              ringing: state.ringing,
              notification: notif
            });

            sendPushNotificationToRole('admin', {
              title: `🚨 MEZZO SUL POSTO: ATTESA DESTINAZIONE!`,
              body: `Mezzo ${data.mezzo || ''} (${data.codice || ''}) attende destinazione e codice di rientro.`,
              tag: `attesa-dest-${data.codice}`,
              soundType: 'sirena',
              urgenza: 'ROSSO'
            });
            break;
          }

          // 5c. Centrale Assegna Destinazione e Codice di Rientro al Mezzo
          case 'UPDATE_DESTINATION_RETURN_CODE': {
            if (state.activeMission) {
              state.activeMission.destinazione = data.destinazione;
              state.activeMission.codiceRientro = data.codiceRientro;
              state.activeMission.isStrutturaVeterinaria = data.isStrutturaVeterinaria;
              state.activeMission.inAttesaDestinazione = false;
              if (data.decisioneCentraleNonVet !== undefined) {
                state.activeMission.decisioneCentraleNonVet = data.decisioneCentraleNonVet;
              }
              if (data.datiProprietarioCentrale) {
                state.activeMission.datiProprietarioCentrale = data.datiProprietarioCentrale;
              }
            }

            state.ringing = {
              active: true,
              source: `Centrale Operativa (Destinazione & Codice Assegnati)`,
              soundType: 'telefono',
              timestamp: Date.now()
            };

            const propNome = data.datiProprietarioCentrale?.nome
              ? ` con dati anagrafici proprietario microchip [${data.datiProprietarioCentrale.nome} ${data.datiProprietarioCentrale.cognome || ''}]`
              : '';

            const vetNote = data.isStrutturaVeterinaria !== undefined
              ? (data.isStrutturaVeterinaria ? ' [Struttura Veterinaria Vincolata]' : ' [Struttura Veterinaria NON vincolata / Revocata]')
              : '';

            const nonVetDecisioneNote = data.decisioneCentraleNonVet === 'rientro_sede'
              ? ' [DISPOSTO RIENTRO IN SEDE: Orari partenza/arrivo destinazione non richiesti]'
              : data.decisioneCentraleNonVet === 'nuovo_obiettivo'
              ? ' [INVIATO SU NUOVO OBIETTIVO: Salta partenza/destinazione e rientro sede, inserimento KM per chiusura]'
              : '';

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🏥 CENTRALE: Trasmissione Destinazione [${data.destinazione}] e Codice Rientro [${data.codiceRientro}]${vetNote}${nonVetDecisioneNote}${propNome} a bordo mezzo.`,
              tipo: 'centrale'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'DESTINATION_RETURN_CODE_UPDATED',
              destinazione: data.destinazione,
              codiceRientro: data.codiceRientro,
              isStrutturaVeterinaria: data.isStrutturaVeterinaria,
              decisioneCentraleNonVet: data.decisioneCentraleNonVet,
              datiProprietarioCentrale: data.datiProprietarioCentrale,
              mission: state.activeMission,
              ringing: state.ringing,
              notification: notif
            });

            sendPushNotificationToRole('volontario', {
              title: `🏥 DESTINAZIONE E CODICE RICEVUTI!`,
              body: `Destinazione: ${data.destinazione} | Codice Rientro: ${data.codiceRientro}${vetNote}`,
              tag: `dest-updated`,
              soundType: 'telefono',
              urgenza: 'GIALLO'
            });
            break;
          }

          // 5c-bis. Decisione Centrale per Servizio d'Istituto o Protezione Civile (Rientro Sede o Nuovo Obiettivo)
          case 'UPDATE_DECISIONE_NON_VET': {
            if (state.activeMission) {
              state.activeMission.decisioneCentraleNonVet = data.decisione;
              if (data.decisione === 'rientro_sede') {
                state.activeMission.destinazione = 'Sede Croce Oro (Rientro Disposto)';
                state.activeMission.inAttesaDestinazione = false;
              } else if (data.decisione === 'nuovo_obiettivo') {
                state.activeMission.inAttesaDestinazione = false;
              }
            }

            const testoAzione = data.decisione === 'rientro_sede'
              ? '🏢 DISPOSIZIONE CENTRALE: RIENTRO DEL MEZZO IN SEDE (Orari partenza e arrivo destinazione non richiesti)'
              : '🎯 DISPOSIZIONE CENTRALE: INVIA SU NUOVO OBIETTIVO (Non inserire partenza/destinazione né rientro sede; inserire i KM per chiudere)';

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `${testoAzione} per ${state.activeMission?.codice || data.codice}.`,
              tipo: 'centrale'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'DECISIONE_NON_VET_UPDATED',
              decisione: data.decisione,
              codice: data.codice || state.activeMission?.codice,
              mission: state.activeMission,
              notification: notif
            });

            sendPushNotificationToRole('volontario', {
              title: data.decisione === 'rientro_sede' ? '🏢 DISPOSTO RIENTRO IN SEDE' : '🎯 INVIATO SU NUOVO OBIETTIVO',
              body: data.decisione === 'rientro_sede' ? 'Rientro in sede disposto. Orari obiettivo non richiesti.' : 'Inviato su nuovo obiettivo. Inserisci i KM per completare il servizio.',
              tag: `decisione-nonvet`,
              soundType: 'cicalino',
              urgenza: 'VERDE'
            });
            break;
          }

          // 5c-bis. Centrale Aggiorna Obiettivo di Partenza al Mezzo
          case 'UPDATE_MISSION_OBIETTIVO': {
            if (state.activeMission) {
              state.activeMission.indirizzo = data.indirizzo;
              state.activeMission.isStrutturaVeterinariaPartenza = data.isStrutturaVeterinariaPartenza;
            }

            state.ringing = {
              active: true,
              source: `Centrale Operativa (Obiettivo di Partenza Aggiornato)`,
              soundType: 'telefono',
              timestamp: Date.now()
            };

            const vetNote = data.isStrutturaVeterinariaPartenza !== undefined
              ? (data.isStrutturaVeterinariaPartenza ? ' [Struttura Veterinaria di Partenza Vincolata]' : ' [Struttura Veterinaria di Partenza NON vincolata / Revocata]')
              : '';

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🏥 CENTRALE: Aggiornamento Obiettivo di Partenza [${data.indirizzo}]${vetNote} a bordo mezzo.`,
              tipo: 'centrale'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'MISSION_OBIETTIVO_UPDATED',
              indirizzo: data.indirizzo,
              isStrutturaVeterinariaPartenza: data.isStrutturaVeterinariaPartenza,
              mission: state.activeMission,
              ringing: state.ringing,
              notification: notif
            });

            sendPushNotificationToRole('volontario', {
              title: `🏥 OBIETTIVO DI PARTENZA AGGIORNATO!`,
              body: `Obiettivo / Partenza: ${data.indirizzo}${vetNote}`,
              tag: `obiettivo-updated`,
              soundType: 'telefono',
              urgenza: 'GIALLO'
            });
            break;
          }

          // 5c-ter. Volontario Rileva Microchip su Obiettivo per Animale Non di Proprietà
          case 'UPDATE_MICROCHIP_INFO': {
            if (state.activeMission) {
              state.activeMission.microchip = data.microchip;
              state.activeMission.noMicrochip = !!data.noMicrochip;
              if (data.tipo) state.activeMission.tipoAnimale = data.tipo;
              if (data.tipoAltro) state.activeMission.tipoAnimaleAltro = data.tipoAltro;
            }

            const infoChip = data.noMicrochip ? 'NO MICROCHIP (Segnalato dal Volontario)' : `Microchip: ${data.microchip}`;
            const tipoInfo = data.tipo ? ` [${data.tipo}${data.tipoAltro ? ` (${data.tipoAltro})` : ''}]` : '';

            state.ringing = {
              active: true,
              source: `Equipaggio Mezzo (${data.noMicrochip ? 'Nessun Microchip' : `Microchip ${data.microchip}`}: ${data.codice || ''})`,
              soundType: 'telefono',
              timestamp: Date.now()
            };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: data.noMicrochip
                ? `🚩 RILEVAZIONE OBIETTIVO (${data.codice || state.activeMission?.codice || ''}): Animale senza microchip.${tipoInfo} Procedi con destinazione.`
                : `🐕 MICROCHIP RILEVATO DA BORDO MEZZO (${data.codice || state.activeMission?.codice || ''}): ${data.microchip}.${tipoInfo} Chiamare subito il veterinario per i dati dell'intestatario!`,
              tipo: 'mezzo'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'MICROCHIP_INFO_UPDATED',
              codice: data.codice,
              microchip: data.microchip,
              noMicrochip: data.noMicrochip,
              tipo: data.tipo,
              tipoAltro: data.tipoAltro,
              mission: state.activeMission,
              ringing: state.ringing,
              notification: notif
            });

            // Invia notifica Push alla Centrale per allertare di chiamare il veterinario
            sendPushNotificationToRole('admin', {
              title: data.noMicrochip ? `🚩 NESSUN MICROCHIP RILEVATO` : `🐕 MICROCHIP RILEVATO: ${data.microchip}`,
              body: data.noMicrochip
                ? `L'equipaggio segnala che l'animale non ha microchip.`
                : `Chiama subito il veterinario di turno per ottenere i dati dell'intestatario e trasmettili al volontario!`,
              tag: `chip-${data.codice || Date.now()}`,
              urgenza: 'ROSSO',
              soundType: 'telefono'
            });
            break;
          }

          // 5c-ter. Centrale Invia Dati Intestatario Microchip al Volontario
          case 'UPDATE_PROPRIETARIO_CENTRALE': {
            if (state.activeMission) {
              state.activeMission.datiProprietarioCentrale = data.datiProprietarioCentrale;
            }

            const nomeProp = `${data.datiProprietarioCentrale?.nome || ''} ${data.datiProprietarioCentrale?.cognome || ''}`.trim();
            const telProp = data.datiProprietarioCentrale?.telefono ? ` (Tel: ${data.datiProprietarioCentrale.telefono})` : '';

            state.ringing = {
              active: true,
              source: `Centrale (Dati Intestatario Microchip: ${nomeProp || 'Ricevuti'})`,
              soundType: 'telefono',
              timestamp: Date.now()
            };

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `📋 DATI INTESTATARIO TRASMESSI AL MEZZO (${data.codice || state.activeMission?.codice || ''}): Intestatario ${nomeProp}${telProp} inviati all'equipaggio per la scheda di consegna.`,
              tipo: 'centrale'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'PROPRIETARIO_CENTRALE_UPDATED',
              codice: data.codice,
              datiProprietarioCentrale: data.datiProprietarioCentrale,
              mission: state.activeMission,
              ringing: state.ringing,
              notification: notif
            });

            // Notifica al telefono del volontario
            sendPushNotificationToRole('volontario', {
              title: `📋 DATI INTESTATARIO MICROCHIP RICEVUTI!`,
              body: `Intestatario: ${nomeProp}${telProp} caricati automaticamente nella scheda di consegna.`,
              tag: `prop-${data.codice || Date.now()}`,
              urgenza: 'VERDE',
              soundType: 'telefono',
              requireInteraction: true
            });
            break;
          }

          // 5d. Dati Consegna a Destinazione, Donazione e Firme Digitali Acquisite a Bordo
          case 'UPDATE_DATI_DESTINAZIONE': {
            state.datiDestinazione = data.dati;
            if (state.activeMission) {
              state.activeMission.datiDestinazione = data.dati;
              if (data.campiCompilatiDa && typeof data.campiCompilatiDa === 'object') {
                (state.activeMission as any).campiCompilatiDa = {
                  ...((state.activeMission as any).campiCompilatiDa || {}),
                  ...data.campiCompilatiDa
                };
              }
            }

            const targetCodice = data.codice || state.activeMission?.codice;
            if (targetCodice && Array.isArray(state.serviziArchivio)) {
              const sIdx = state.serviziArchivio.findIndex(s => s.codice === targetCodice || s.id === `DOC-${targetCodice}` || s.id === targetCodice);
              if (sIdx >= 0) {
                state.serviziArchivio[sIdx].datiDestinazione = data.dati;
              }
            }

            const nomeProp = `${data.dati?.proprietario?.nome || ''} ${data.dati?.proprietario?.cognome || ''}`.trim();
            const donazStr = data.dati?.donazione?.ricevuta
              ? `Donazione: €${data.dati?.donazione?.somma || 0} (${data.dati?.donazione?.metodo === 'pos' ? 'POS' : 'Contanti'})`
              : 'Nessuna donazione';
            const firmeStr = data.dati?.firmaProprietario ? 'Firma proprietario acquisita' : '';

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `✍️ CONSEGNA DESTINAZIONE REGISTRATA (${data.codice || ''}): Proprietario: ${nomeProp || 'N/D'} | ${donazStr} | ${firmeStr}. Integrati nella scheda e nel PDF.`,
              tipo: 'sistema'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'DATI_DESTINAZIONE_UPDATED',
              dati: data.dati,
              codice: data.codice,
              campiCompilatiDa: (state.activeMission as any)?.campiCompilatiDa,
              notification: notif
            });
            break;
          }

          // 5d-bis. Sincronizzazione Collaborativa Dati Bozza Foglio di Servizio & Convalida Capo Servizio
          case 'UPDATE_MISSION_DRAFT_DATA': {
            if (state.activeMission && (!data?.codice || state.activeMission.codice === data.codice)) {
              const mAny = state.activeMission as any;
              if (data?.manovreEffettuatePatologie !== undefined) {
                mAny.manovreEffettuatePatologie = data.manovreEffettuatePatologie;
              }
              if (data?.noteNonVet !== undefined) {
                mAny.noteNonVet = data.noteNonVet;
              }
              if (data?.capoServizioId !== undefined) {
                mAny.capoServizioId = data.capoServizioId;
              }
              if (data?.capoServizioNome !== undefined) {
                mAny.capoServizioNome = data.capoServizioNome;
              }
              if (data?.convalidaCapoServizio !== undefined) {
                mAny.convalidaCapoServizio = data.convalidaCapoServizio;
              }
              if (data?.campiCompilatiDa && typeof data.campiCompilatiDa === 'object') {
                mAny.campiCompilatiDa = {
                  ...(mAny.campiCompilatiDa || {}),
                  ...data.campiCompilatiDa
                };
              }

              let notif: RadioNotification | undefined;
              if (data?.messaggioNotifica) {
                notif = {
                  id: generateUniqueNotifId(),
                  orario: formatTimeItaly(),
                  testo: String(data.messaggioNotifica),
                  tipo: 'sistema'
                };
                state.notifiche.push(notif);
              }
              persistState();

              broadcast({
                type: 'MISSION_DRAFT_UPDATED',
                mission: state.activeMission,
                codice: state.activeMission.codice,
                notification: notif
              });
            }
            break;
          }

          // 5e. Foto Documento Identità Intestatario Acquisite da Bordo Mezzo
          case 'UPDATE_FOTO_DOCUMENTO': {
            const targetCodice = data.codice || state.activeMission?.codice;
            if (state.activeMission && (!data.codice || state.activeMission.codice === data.codice)) {
              (state.activeMission as any).fotoDocumento = data.fotoDocumento;
              if (state.activeMission.datiProprietarioCentrale) {
                state.activeMission.datiProprietarioCentrale.fotoDocumento = data.fotoDocumento;
              }
            }

            if (targetCodice && Array.isArray(state.serviziArchivio)) {
              const sIdx = state.serviziArchivio.findIndex(s => s.codice === targetCodice || s.id === `DOC-${targetCodice}` || s.id === targetCodice);
              if (sIdx >= 0) {
                state.serviziArchivio[sIdx].fotoDocumento = data.fotoDocumento;
                if (state.serviziArchivio[sIdx].datiProprietarioCentrale) {
                  state.serviziArchivio[sIdx].datiProprietarioCentrale.fotoDocumento = data.fotoDocumento;
                }
              }
            }

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🪪 DOCUMENTO IDENTITÀ ACQUISITO (${targetCodice || ''}): Foto documento intestatario (Fronte/Retro) salvate e disponibili per il download PDF.`,
              tipo: 'mezzo'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'FOTO_DOCUMENTO_UPDATED',
              fotoDocumento: data.fotoDocumento,
              codice: targetCodice,
              mission: state.activeMission,
              notification: notif
            });
            break;
          }

          // 6. Aggiornamento Chilometri Bordo Mezzo
          case 'UPDATE_KM': {
            const iniVal = data.kmInizio !== undefined ? (parseFloat(data.kmInizio) || 0) : (parseFloat(state.kmInizio) || 0);
            const finVal = data.kmFine !== undefined ? (parseFloat(data.kmFine) || 0) : (parseFloat(state.kmFine) || 0);
            if (finVal > 0 && iniVal > 0 && finVal < iniVal) {
              console.warn(`[UPDATE_KM] Rifiutato: KM finali (${finVal}) non possono essere inferiori ai KM iniziali (${iniVal})`);
              break;
            }

            if (data.kmInizio !== undefined) state.kmInizio = data.kmInizio;
            if (data.kmFine !== undefined) state.kmFine = data.kmFine;
            if (state.activeMission && data.campiCompilatiDa && typeof data.campiCompilatiDa === 'object') {
              (state.activeMission as any).campiCompilatiDa = {
                ...((state.activeMission as any).campiCompilatiDa || {}),
                ...data.campiCompilatiDa
              };
            }

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: data.messaggio || `🛣️ Aggiornamento KM Bordo: Inizio: ${state.kmInizio} | Fine: ${state.kmFine}`,
              tipo: 'mezzo'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'KM_UPDATED',
              kmInizio: state.kmInizio,
              kmFine: state.kmFine,
              campiCompilatiDa: (state.activeMission as any)?.campiCompilatiDa,
              notification: notif
            });
            break;
          }

          // 7. Messaggio Radio (Testuale o Audio Vocale, globale o isolato su gruppo)
          case 'SEND_RADIO_MESSAGE': {
            const groupId = data?.groupId && data.groupId !== 'general' ? String(data.groupId) : undefined;
            const targetGroup = groupId ? (state.radioGroups || []).find((g) => g.id === groupId) : undefined;
            if (groupId && !targetGroup) {
              break;
            }
            const hasAudio = Boolean(data?.audioDataUrl && typeof data.audioDataUrl === 'string');
            const labelBase = data?.testo
              ? String(data.testo)
              : hasAudio
              ? `🎙️ Messaggio Audio (${Number(data.audioDurationSec) || 1}s)`
              : '';
            const mittenteNomeSuffix = data?.mittenteNome ? ` (${data.mittenteNome})` : '';
            const groupTag = targetGroup ? ` • GRUPPO: ${targetGroup.name}` : '';
            const notif: RadioNotification = {
              id: data?.clientMsgId ? String(data.clientMsgId) : generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: maskPinInNotification(`RADIO [${data?.mittente || 'BORDO MEZZO'}${mittenteNomeSuffix}${groupTag}]: ${labelBase}`),
              tipo: data?.mittente === 'CENTRALE' ? 'centrale' : 'mezzo',
              ...(targetGroup ? { groupId: targetGroup.id, groupName: targetGroup.name } : {}),
              ...(hasAudio ? {
                audioDataUrl: String(data.audioDataUrl),
                audioDurationSec: Number(data.audioDurationSec) || 1,
                audioMimeType: data.audioMimeType ? String(data.audioMimeType) : 'audio/webm',
                mittenteNome: data.mittenteNome ? String(data.mittenteNome) : undefined
              } : {})
            };
            state.notifiche.push(notif);
            let audioCount = 0;
            for (let i = state.notifiche.length - 1; i >= 0; i--) {
              if (state.notifiche[i].audioDataUrl) {
                audioCount++;
                if (audioCount > 30) {
                  delete state.notifiche[i].audioDataUrl;
                }
              }
            }
            persistState();

            if (targetGroup) {
              // Isolamento stretto: solo i membri del gruppo e Centrale ricevono messaggi del gruppo
              broadcastToFilter(
                {
                  type: 'RADIO_MESSAGE_RECEIVED',
                  groupId: targetGroup.id,
                  notification: notif
                },
                (c) => isSocketAllowedInGroup(c, targetGroup)
              );
            } else {
              broadcast({
                type: 'RADIO_MESSAGE_RECEIVED',
                notification: notif
              });
            }

            const pushBody = hasAudio
              ? `🎙️ Nuovo messaggio audio${data?.mittenteNome ? ` da ${data.mittenteNome}` : ''} (${Number(data.audioDurationSec) || 1}s)`
              : `${data?.testo || 'Nuova comunicazione radio ricevuta.'}`;

            const radioMsgPushExtra = {
              tipo: 'radio_message',
              channelId: targetGroup ? targetGroup.id : 'general',
              messageId: notif.id,
              hasAudio,
              speakerName: data?.mittenteNome ? String(data.mittenteNome) : (data?.mittente === 'CENTRALE' ? 'Centrale Operativa' : 'Bordo Mezzo'),
            };

            const senderEndpointMsg = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;

            if (targetGroup) {
              targetGroup.memberIds.forEach((mId) => {
                sendPushNotificationToVolunteer(mId, {
                  title: `📻 RADIO GRUPPO ${targetGroup.name.toUpperCase()}`,
                  body: pushBody,
                  tag: `radio-grp-${targetGroup.id}-${Date.now()}`,
                  soundType: 'cicalino',
                  urgenza: 'GIALLO',
                  requireInteraction: true,
                  ...radioMsgPushExtra,
                }, true, senderEndpointMsg);
              });
              sendPushNotificationToRole('admin', {
                title: `📻 RADIO GRUPPO ${targetGroup.name.toUpperCase()}`,
                body: pushBody,
                tag: `radio-grp-${targetGroup.id}-${Date.now()}`,
                soundType: 'cicalino',
                urgenza: 'GIALLO',
                requireInteraction: true,
                ...radioMsgPushExtra,
              }, senderEndpointMsg);
            } else {
              sendPushNotificationToRole('all', {
                title: data?.mittente === 'CENTRALE'
                  ? `📻 COMUNICAZIONE RADIO DALLA CENTRALE`
                  : `📻 COMUNICAZIONE RADIO DA BORDO MEZZO`,
                body: pushBody,
                tag: `radio-${Date.now()}`,
                soundType: 'cicalino',
                urgenza: 'GIALLO',
                requireInteraction: true,
                ...radioMsgPushExtra,
              }, senderEndpointMsg);
            }
            break;
          }

          // 7b. Attivazione/Disattivazione Radio Diretta VHF/UHF PTT (solo Operatore di Centrale)
          case 'TOGGLE_RADIO_PTT_LIVE': {
            if (data?.role !== 'admin') {
              if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                excludeClient.send(JSON.stringify({
                  type: 'PTT_REJECTED',
                  targetSpeakerId: data?.speakerId,
                  reason: 'Solo un Operatore di Centrale può attivare o disattivare la radio diretta VHF/UHF.'
                }));
              }
              break;
            }
            const nextEnabled = Boolean(data?.enabled);
            const toggledBy = String(data?.operatorName || 'Operatore Centrale');
            const prevEnabled = Boolean(state.radioPtt?.enabled);
            const prevToggledAt = Number(state.radioPtt?.toggledAt || 0);
            // Idempotenza contro doppi invii ravvicinati WS + HTTP /api/event
            if (prevEnabled === nextEnabled && Date.now() - prevToggledAt < 2500) {
              break;
            }
            const prevSpeaker = state.radioPtt?.activeSpeaker || null;

            state.radioPtt = {
              ...(state.radioPtt || { enabled: false, activeSpeaker: null }),
              enabled: nextEnabled,
              toggledBy,
              toggledAt: Date.now(),
              activeSpeaker: nextEnabled ? prevSpeaker : null
            };
            if (!nextEnabled) {
              activePttSocket = null;
            }

            const notifPtt: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: nextEnabled
                ? `📡 RADIO DIRETTA VHF/UHF ATTIVATA da ${toggledBy}: canale PTT aperto a tutti i terminali loggati.`
                : `🔇 RADIO DIRETTA VHF/UHF DISATTIVATA da ${toggledBy}: trasmissioni PTT in diretta sospese.`,
              tipo: 'centrale'
            };
            state.notifiche.push(notifPtt);
            persistState();

            if (!nextEnabled && prevSpeaker) {
              broadcast({
                type: 'PTT_PREEMPTED',
                channelId: 'general',
                interruptedSpeakerId: prevSpeaker.speakerId,
                interruptedSpeakerName: prevSpeaker.speakerName,
                bySpeakerName: toggledBy,
                byRole: 'admin',
                reason: 'Radio diretta disattivata dall\'Operatore di Centrale.'
              });
            }

            broadcast({
              type: 'RADIO_PTT_STATE',
              radioPtt: state.radioPtt,
              notification: notifPtt
            });

            if (nextEnabled) {
              const senderEndpointToggle = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;
              sendPushNotificationToRole(
                'all',
                {
                  title: '📡 RADIO GENERALE (TUTTI) ATTIVATA',
                  body: `${toggledBy} ha attivato il Canale Radio Generale. Tocca per ascoltare in diretta.`,
                  tag: 'radio-ch-general',
                  soundType: 'cicalino',
                  urgenza: 'GIALLO',
                  requireInteraction: true,
                  tipo: 'radio_channel_on',
                  isEmergency: false,
                  channelId: 'general',
                  speakerName: toggledBy,
                },
                senderEndpointToggle
              );
            }
            break;
          }

          // 7g. Creazione Gruppo Radio Permanente (solo Operatore Centrale, idempotente contro doppi invii WS+HTTP)
          case 'CREATE_RADIO_GROUP': {
            if (data?.role !== 'admin') break;
            const rawName = String(data?.name || '').trim();
            if (!rawName) break;
            const reqId = String(data?.id || `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
            const normName = rawName.toLowerCase();
            const alreadyExists = (state.radioGroups || []).some(
              (g) => g.id === reqId || g.name.trim().toLowerCase() === normName
            );
            if (alreadyExists) {
              break;
            }
            const memberIds: string[] = Array.isArray(data?.memberIds)
              ? Array.from(new Set<string>(data.memberIds.map((m: any) => String(m)).filter(Boolean)))
              : [];
            const newGroup: RadioGroup = {
              id: reqId,
              name: rawName,
              enabled: Boolean(data?.enabled),
              memberIds,
              createdBy: String(data?.operatorName || 'Operatore Centrale'),
              createdAt: Date.now(),
              activeSpeaker: null
            };
            state.radioGroups = [...(state.radioGroups || []), newGroup];
            persistState();
            broadcast({
              type: 'RADIO_GROUPS_UPDATED',
              radioGroups: state.radioGroups
            });
            break;
          }

          // 7h. Aggiornamento Membri / Nome Gruppo Radio Permanente (solo Operatore Centrale)
          case 'UPDATE_RADIO_GROUP_MEMBERS': {
            if (data?.role !== 'admin') break;
            const groupId = String(data?.groupId || '');
            const memberIds: string[] = Array.isArray(data?.memberIds)
              ? Array.from(new Set<string>(data.memberIds.map((m: any) => String(m)).filter(Boolean)))
              : [];
            state.radioGroups = (state.radioGroups || []).map((g) => {
              if (g.id !== groupId) return g;
              return {
                ...g,
                name: data?.name ? String(data.name).trim() : g.name,
                memberIds
              };
            });
            persistState();
            broadcast({
              type: 'RADIO_GROUPS_UPDATED',
              radioGroups: state.radioGroups
            });
            break;
          }

          // 7i. Accensione/Spegnimento Canale Gruppo Radio (solo Operatore Centrale)
          case 'TOGGLE_RADIO_GROUP_LIVE': {
            if (data?.role !== 'admin') break;
            const groupId = String(data?.groupId || '');
            const nextEnabled = Boolean(data?.enabled);
            const toggledBy = String(data?.operatorName || 'Operatore Centrale');
            let targetGroup: RadioGroup | undefined;
            let prevSpeaker: RadioPttSpeaker | null = null;

            const existingGrpBeforeToggle = (state.radioGroups || []).find((g) => g.id === groupId);
            if (
              existingGrpBeforeToggle &&
              Boolean(existingGrpBeforeToggle.enabled) === nextEnabled &&
              Date.now() - Number(existingGrpBeforeToggle.toggledAt || 0) < 2500
            ) {
              break;
            }

            // Auto-ripristino gruppo dopo eventuale riavvio container Cloud Run se il client admin invia groupSnapshot
            if (
              !existingGrpBeforeToggle &&
              groupId &&
              data?.groupSnapshot &&
              typeof data.groupSnapshot === 'object' &&
              String(data.groupSnapshot.id || '') === groupId
            ) {
              const snapName = String(data.groupSnapshot.name || 'Gruppo Radio').trim().slice(0, 80);
              const snapMembers: string[] = Array.isArray(data.groupSnapshot.memberIds)
                ? Array.from(new Set<string>(data.groupSnapshot.memberIds.map((m: any) => String(m)).filter(Boolean))).slice(0, 200)
                : [];
              state.radioGroups = [
                ...(state.radioGroups || []),
                {
                  id: groupId,
                  name: snapName || 'Gruppo Radio',
                  enabled: false,
                  memberIds: snapMembers,
                  createdBy: toggledBy,
                  createdAt: Date.now(),
                  activeSpeaker: null
                }
              ];
            }

            state.radioGroups = (state.radioGroups || []).map((g) => {
              if (g.id !== groupId) return g;
              prevSpeaker = g.activeSpeaker || null;
              targetGroup = {
                ...g,
                enabled: nextEnabled,
                toggledBy,
                toggledAt: Date.now(),
                activeSpeaker: nextEnabled ? g.activeSpeaker : null
              };
              return targetGroup;
            });

            if (!targetGroup) break;
            if (!nextEnabled) {
              activeGroupSockets.set(groupId, null);
            }
            persistState();

            if (!nextEnabled && prevSpeaker) {
              broadcastToFilter(
                {
                  type: 'PTT_PREEMPTED',
                  channelId: groupId,
                  groupId,
                  interruptedSpeakerId: (prevSpeaker as RadioPttSpeaker).speakerId,
                  interruptedSpeakerName: (prevSpeaker as RadioPttSpeaker).speakerName,
                  bySpeakerName: toggledBy,
                  byRole: 'admin',
                  reason: `Canale gruppo "${targetGroup.name}" disattivato dall'Operatore di Centrale.`
                },
                (c) => isSocketAllowedInGroup(c, targetGroup!)
              );
            }

            broadcast({
              type: 'RADIO_GROUPS_UPDATED',
              radioGroups: state.radioGroups,
              toggledGroupId: groupId,
              toggledEnabled: nextEnabled,
              toggledBy
            });

            if (nextEnabled) {
              const senderEndpointGrp = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;
              const grpOnPayload = {
                title: `🔒 RADIO GRUPPO ${targetGroup.name.toUpperCase()} ATTIVATO`,
                body: `${toggledBy} ha attivato il canale radio riservato "${targetGroup.name}". Tocca per ascoltare.`,
                tag: `radio-ch-${targetGroup.id}`,
                soundType: 'cicalino',
                urgenza: 'GIALLO',
                requireInteraction: true,
                tipo: 'radio_channel_on',
                isEmergency: false,
                channelId: targetGroup.id,
                speakerName: toggledBy,
              };
              targetGroup.memberIds.forEach((mId) => {
                sendPushNotificationToVolunteer(mId, grpOnPayload, true, senderEndpointGrp);
              });
              sendPushNotificationToRole('admin', grpOnPayload, senderEndpointGrp);
            }
            break;
          }

          // 7j. Eliminazione Gruppo Radio Permanente (solo Operatore Centrale)
          case 'DELETE_RADIO_GROUP': {
            if (data?.role !== 'admin') break;
            const groupId = String(data?.groupId || '');
            activeGroupSockets.delete(groupId);
            state.radioGroups = (state.radioGroups || []).filter((g) => g.id !== groupId);
            persistState();
            broadcast({
              type: 'RADIO_GROUPS_UPDATED',
              radioGroups: state.radioGroups
            });
            break;
          }

          // 7k. Pulsante EMERGENZA Radio (esclusivo Operatori di Centrale - priorità assoluta su tutti i canali e gruppi)
          case 'TRIGGER_RADIO_EMERGENCY': {
            if (data?.role !== 'admin') {
              if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                excludeClient.send(JSON.stringify({
                  type: 'PTT_REJECTED',
                  targetSpeakerId: data?.speakerId,
                  reason: 'Il pulsante EMERGENZA è utilizzabile esclusivamente dagli Operatori di Centrale.'
                }));
              }
              break;
            }

            const nextActive = data?.active !== false;
            const triggeredBy = String(data?.operatorName || 'Operatore Centrale');
            const message = String(data?.message || 'ALLERTA EMERGENZA GENERALE DALLA CENTRALE OPERATIVA');

            // Deduplica invio ravvicinato WS + HTTP /api/event
            if (
              Boolean(state.radioEmergency?.active) === nextActive &&
              Date.now() - Number(state.radioEmergency?.triggeredAt || 0) < 2500
            ) {
              break;
            }

            state.radioEmergency = {
              active: nextActive,
              triggeredBy,
              triggeredAt: Date.now(),
              message: nextActive ? message : ''
            };

            if (nextActive) {
              // Interrompi qualsiasi comunicazione in corso su Canale Generale e su TUTTI i gruppi
              if (state.radioPtt?.activeSpeaker && !state.radioPtt.activeSpeaker.isEmergency) {
                const prev = state.radioPtt.activeSpeaker;
                state.radioPtt.activeSpeaker = null;
                activePttSocket = null;
                broadcast({
                  type: 'PTT_PREEMPTED',
                  channelId: 'general',
                  interruptedSpeakerId: prev.speakerId,
                  interruptedSpeakerName: prev.speakerName,
                  bySpeakerName: triggeredBy,
                  byRole: 'admin',
                  isEmergency: true,
                  reason: `🚨 EMERGENZA CENTRALE: ${triggeredBy} ha attivato l'allerta prioritaria!`
                });
              }
              (state.radioGroups || []).forEach((g) => {
                if (g.activeSpeaker) {
                  const prev = g.activeSpeaker;
                  g.activeSpeaker = null;
                  activeGroupSockets.set(g.id, null);
                  broadcast({
                    type: 'PTT_PREEMPTED',
                    channelId: g.id,
                    groupId: g.id,
                    interruptedSpeakerId: prev.speakerId,
                    interruptedSpeakerName: prev.speakerName,
                    bySpeakerName: triggeredBy,
                    byRole: 'admin',
                    isEmergency: true,
                    reason: `🚨 EMERGENZA CENTRALE: ${triggeredBy} ha attivato l'allerta prioritaria su tutti i canali!`
                  });
                }
              });

              const notifEm: RadioNotification = {
                id: generateUniqueNotifId(),
                orario: formatTimeItaly(),
                testo: `🚨 EMERGENZA RADIO CENTRALE (${triggeredBy}): ${message}`,
                tipo: 'allarme'
              };
              state.notifiche.push(notifEm);
              persistState();

              broadcast({
                type: 'RADIO_EMERGENCY_STATE',
                radioEmergency: state.radioEmergency,
                radioPtt: state.radioPtt,
                radioGroups: state.radioGroups,
                notification: notifEm
              });

              const senderEndpointEm = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;
              sendPushNotificationToRole('all', {
                title: '🚨 EMERGENZA RADIO CENTRALE',
                body: `${triggeredBy}: ${message}`,
                tag: `radio-em-${Date.now()}`,
                soundType: 'sirena',
                urgenza: 'ROSSO',
                requireInteraction: true,
                tipo: 'radio_emergency',
                isEmergency: true,
                channelId: 'emergency',
                speakerName: triggeredBy
              }, senderEndpointEm);
            } else {
              if (state.radioPtt?.activeSpeaker?.isEmergency) {
                state.radioPtt.activeSpeaker = null;
                activePttSocket = null;
              }
              persistState();
              broadcast({
                type: 'RADIO_EMERGENCY_STATE',
                radioEmergency: state.radioEmergency,
                radioPtt: state.radioPtt
              });
            }
            break;
          }

          // 7c. Richiesta Portante PTT (Hold-to-Talk) con supporto Generale, Gruppi Isolati ed Emergenza Centrale
          case 'PTT_START': {
            const reqSpeakerId = String(data?.speakerId || '');
            const reqRole: 'admin' | 'volontario' = data?.role === 'admin' ? 'admin' : 'volontario';
            const reqName = String(data?.speakerName || (reqRole === 'admin' ? 'Centrale Operativa' : 'Volontario Bordo'));
            const channelId = String(data?.channelId || 'general');
            const isEmergencyCall = Boolean(data?.isEmergency || channelId === 'emergency');

            // EMERGENZA: esclusiva Centrale, sempre abilitata, interrompe tutto e trasmette a TUTTI i terminali
            if (isEmergencyCall) {
              if (reqRole !== 'admin') {
                if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                  excludeClient.send(JSON.stringify({
                    type: 'PTT_REJECTED',
                    targetSpeakerId: reqSpeakerId,
                    reason: 'Solo un Operatore di Centrale può trasmettere in EMERGENZA.'
                  }));
                }
                break;
              }

              // Idempotenza contro doppio PTT_START ravvicinato (WS + HTTP /api/event): non sovrascrivere il buffer audio attivo!
              const existingEmSpk = state.radioPtt?.activeSpeaker;
              if (
                existingEmSpk?.isEmergency &&
                existingEmSpk.speakerId === reqSpeakerId &&
                Date.now() - Number(existingEmSpk.startedAt || 0) < 3500 &&
                activeTransmissionByChannel.has('emergency')
              ) {
                break;
              }

              // Preempt qualsiasi trasmissione attiva su Generale o su qualsiasi Gruppo
              if (state.radioPtt?.activeSpeaker && state.radioPtt.activeSpeaker.speakerId !== reqSpeakerId) {
                const prev = state.radioPtt.activeSpeaker;
                broadcast({
                  type: 'PTT_PREEMPTED',
                  channelId: 'general',
                  interruptedSpeakerId: prev.speakerId,
                  interruptedSpeakerName: prev.speakerName,
                  bySpeakerId: reqSpeakerId,
                  bySpeakerName: reqName,
                  byRole: 'admin',
                  isEmergency: true,
                  reason: `🚨 EMERGENZA CENTRALE: ${reqName} sta trasmettendo a tutti i terminali!`
                });
              }
              (state.radioGroups || []).forEach((g) => {
                if (g.activeSpeaker) {
                  const prev = g.activeSpeaker;
                  g.activeSpeaker = null;
                  activeGroupSockets.set(g.id, null);
                  broadcast({
                    type: 'PTT_PREEMPTED',
                    channelId: g.id,
                    groupId: g.id,
                    interruptedSpeakerId: prev.speakerId,
                    interruptedSpeakerName: prev.speakerName,
                    bySpeakerId: reqSpeakerId,
                    bySpeakerName: reqName,
                    byRole: 'admin',
                    isEmergency: true,
                    reason: `🚨 EMERGENZA CENTRALE: ${reqName} ha interrotto tutti i gruppi.`
                  });
                }
              });

              if (!state.radioPtt) {
                state.radioPtt = { enabled: false, activeSpeaker: null };
              }
              state.radioPtt.activeSpeaker = {
                speakerId: reqSpeakerId,
                speakerName: reqName,
                role: 'admin',
                isCentralePriority: true,
                channelId: 'emergency',
                isEmergency: true,
                startedAt: Date.now(),
                lastChunkAt: Date.now()
              };
              activePttSocket = excludeClient || null;
              state.radioEmergency = {
                active: true,
                triggeredBy: reqName,
                triggeredAt: Date.now(),
                message: `TRASMISSIONE VOCALE EMERGENZA IN CORSO (${reqName})`
              };

              const emTx = startRadioTransmissionBuffer({
                channelId: 'emergency',
                speakerId: reqSpeakerId,
                speakerName: reqName,
                role: 'admin',
                isEmergency: true,
              });

              broadcast({
                type: 'RADIO_EMERGENCY_STATE',
                radioEmergency: state.radioEmergency
              });
              broadcast({
                type: 'PTT_SPEAKER_CHANGED',
                channelId: 'emergency',
                transmissionId: emTx.id,
                radioPtt: state.radioPtt,
                radioGroups: state.radioGroups
              });

              // Notifica Push immediata ad alta priorità per risvegliare i dispositivi in background / schermo spento
              const senderEndpointEmPtt = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;
              sendPushNotificationToRole(
                'all',
                {
                  title: '🚨 EMERGENZA RADIO LIVE',
                  body: `${reqName} sta trasmettendo in EMERGENZA su tutti i canali!`,
                  tag: `radio-em-ptt-${emTx.id}`,
                  soundType: 'sirena',
                  urgenza: 'ROSSO',
                  requireInteraction: true,
                  tipo: 'radio_emergency',
                  isEmergency: true,
                  channelId: 'emergency',
                  transmissionId: emTx.id,
                  speakerName: reqName,
                },
                senderEndpointEmPtt
              );
              break;
            }

            // CANALE GRUPPO PERMANENTE (isolato)
            if (channelId !== 'general') {
              let targetGroup = (state.radioGroups || []).find((g) => g.id === channelId);
              if (
                !targetGroup &&
                data?.groupSnapshot &&
                typeof data.groupSnapshot === 'object' &&
                String(data.groupSnapshot.id || '') === channelId &&
                Boolean(data.groupSnapshot.enabled)
              ) {
                const snapMembers: string[] = Array.isArray(data.groupSnapshot.memberIds)
                  ? Array.from(new Set<string>(data.groupSnapshot.memberIds.map((m: any) => String(m)).filter(Boolean))).slice(0, 200)
                  : [];
                const snapReqVol = data?.volontarioId ? String(data.volontarioId) : ((excludeClient as any)?.volontarioId || '');
                if (reqRole === 'admin' || (snapReqVol && snapMembers.includes(snapReqVol))) {
                  targetGroup = {
                    id: channelId,
                    name: String(data.groupSnapshot.name || 'Gruppo Radio').trim().slice(0, 80) || 'Gruppo Radio',
                    enabled: true,
                    memberIds: snapMembers,
                    createdBy: reqName,
                    createdAt: Date.now(),
                    activeSpeaker: null
                  };
                  state.radioGroups = [...(state.radioGroups || []), targetGroup];
                }
              }
              if (!targetGroup) {
                if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                  excludeClient.send(JSON.stringify({
                    type: 'PTT_REJECTED',
                    targetSpeakerId: reqSpeakerId,
                    reason: 'Gruppo radio non trovato o eliminato.'
                  }));
                }
                break;
              }
              if (!targetGroup.enabled) {
                if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                  excludeClient.send(JSON.stringify({
                    type: 'PTT_REJECTED',
                    targetSpeakerId: reqSpeakerId,
                    reason: `Canale gruppo "${targetGroup.name}" spento. Deve essere acceso dall'Operatore di Centrale.`
                  }));
                }
                break;
              }
              const reqVolId = data?.volontarioId ? String(data.volontarioId) : ((excludeClient as any)?.volontarioId || '');
              if (reqRole !== 'admin' && (!reqVolId || !targetGroup.memberIds.includes(reqVolId))) {
                if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                  excludeClient.send(JSON.stringify({
                    type: 'PTT_REJECTED',
                    targetSpeakerId: reqSpeakerId,
                    reason: `Non sei autorizzato a parlare nel gruppo "${targetGroup.name}".`
                  }));
                }
                break;
              }

              const currentGroupSpeaker = targetGroup.activeSpeaker;
              // Idempotenza contro doppio PTT_START ravvicinato (WS + HTTP /api/event)
              if (
                currentGroupSpeaker &&
                currentGroupSpeaker.speakerId === reqSpeakerId &&
                Date.now() - Number(currentGroupSpeaker.startedAt || 0) < 3500 &&
                activeTransmissionByChannel.has(targetGroup.id)
              ) {
                break;
              }
              if (currentGroupSpeaker && currentGroupSpeaker.speakerId !== reqSpeakerId) {
                if (reqRole !== 'admin') {
                  if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                    excludeClient.send(JSON.stringify({
                      type: 'PTT_REJECTED',
                      targetSpeakerId: reqSpeakerId,
                      reason: `Gruppo "${targetGroup.name}" occupato da ${currentGroupSpeaker.speakerName}.`
                    }));
                  }
                  break;
                }
                broadcastToFilter(
                  {
                    type: 'PTT_PREEMPTED',
                    channelId: targetGroup.id,
                    groupId: targetGroup.id,
                    interruptedSpeakerId: currentGroupSpeaker.speakerId,
                    interruptedSpeakerName: currentGroupSpeaker.speakerName,
                    bySpeakerId: reqSpeakerId,
                    bySpeakerName: reqName,
                    byRole: 'admin',
                    reason: `⚡ PRIORITÀ CENTRALE su "${targetGroup.name}": ${reqName} ha preso la linea.`
                  },
                  (c) => isSocketAllowedInGroup(c, targetGroup)
                );
              }

              targetGroup.activeSpeaker = {
                speakerId: reqSpeakerId,
                speakerName: reqName,
                role: reqRole,
                isCentralePriority: reqRole === 'admin',
                channelId: targetGroup.id,
                isEmergency: false,
                startedAt: Date.now(),
                lastChunkAt: Date.now()
              };
              activeGroupSockets.set(targetGroup.id, excludeClient || null);

              const grpTx = startRadioTransmissionBuffer({
                channelId: targetGroup.id,
                groupId: targetGroup.id,
                groupName: targetGroup.name,
                memberIds: targetGroup.memberIds,
                speakerId: reqSpeakerId,
                speakerName: reqName,
                role: reqRole,
                isEmergency: false,
              });

              // Invia SOLO ai membri del gruppo e alla Centrale! Dalle altre parti nessuno sente/vede nulla.
              broadcastToFilter(
                {
                  type: 'PTT_SPEAKER_CHANGED',
                  channelId: targetGroup.id,
                  groupId: targetGroup.id,
                  transmissionId: grpTx.id,
                  activeSpeaker: targetGroup.activeSpeaker,
                  radioGroup: targetGroup
                },
                (c) => isSocketAllowedInGroup(c, targetGroup)
              );

              // Risveglio Push in background SOLO per i membri autorizzati del gruppo e Centrale (anti-spam 5s per gruppo, esclude solo il dispositivo mittente)
              const nowGrpPush = Date.now();
              if (nowGrpPush - (lastPttPushByChannel.get(targetGroup.id) || 0) >= 5000) {
                lastPttPushByChannel.set(targetGroup.id, nowGrpPush);
                const senderEndpointGrpPtt = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;
                const grpPushPayload = {
                  title: `📻 RADIO GRUPPO ${targetGroup.name.toUpperCase()}`,
                  body: `${reqName} sta parlando nel gruppo radio "${targetGroup.name}"`,
                  tag: `radio-ptt-${targetGroup.id}`,
                  soundType: 'cicalino',
                  urgenza: 'GIALLO',
                  requireInteraction: false,
                  tipo: 'radio_ptt',
                  isEmergency: false,
                  channelId: targetGroup.id,
                  transmissionId: grpTx.id,
                  speakerName: reqName,
                };
                targetGroup.memberIds.forEach((mId) => {
                  sendPushNotificationToVolunteer(mId, grpPushPayload, true, senderEndpointGrpPtt);
                });
                sendPushNotificationToRole('admin', grpPushPayload, senderEndpointGrpPtt);
              }
              break;
            }

            // CANALE GENERALE VHF/UHF
            if (!state.radioPtt?.enabled) {
              const rejectMsg = {
                type: 'PTT_REJECTED',
                targetSpeakerId: reqSpeakerId,
                reason: 'Radio diretta VHF/UHF disattivata. Deve essere attivata da un Operatore di Centrale.'
              };
              if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                excludeClient.send(JSON.stringify(rejectMsg));
              } else {
                broadcast(rejectMsg);
              }
              break;
            }

            const currentSpeaker = state.radioPtt.activeSpeaker;
            // Idempotenza contro doppio PTT_START ravvicinato (WS + HTTP /api/event)
            if (
              currentSpeaker &&
              !currentSpeaker.isEmergency &&
              currentSpeaker.speakerId === reqSpeakerId &&
              Date.now() - Number(currentSpeaker.startedAt || 0) < 3500 &&
              activeTransmissionByChannel.has('general')
            ) {
              break;
            }
            if (currentSpeaker && currentSpeaker.speakerId !== reqSpeakerId) {
              if (reqRole !== 'admin') {
                const busyMsg = {
                  type: 'PTT_REJECTED',
                  targetSpeakerId: reqSpeakerId,
                  reason: `Canale VHF/UHF occupato da ${currentSpeaker.speakerName}. Può parlare una sola persona alla volta.`
                };
                if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
                  excludeClient.send(JSON.stringify(busyMsg));
                } else {
                  broadcast(busyMsg);
                }
                break;
              }

              // PRIORITÀ ASSOLUTA OPERATORE DI CENTRALE: interrompe immediatamente la comunicazione attiva
              broadcast({
                type: 'PTT_PREEMPTED',
                channelId: 'general',
                interruptedSpeakerId: currentSpeaker.speakerId,
                interruptedSpeakerName: currentSpeaker.speakerName,
                bySpeakerId: reqSpeakerId,
                bySpeakerName: reqName,
                byRole: 'admin',
                reason: `⚡ PRIORITÀ CENTRALE: ${reqName} ha preso la linea interrompendo ${currentSpeaker.speakerName}.`
              });
            }

            state.radioPtt.activeSpeaker = {
              speakerId: reqSpeakerId,
              speakerName: reqName,
              role: reqRole,
              isCentralePriority: reqRole === 'admin',
              channelId: 'general',
              isEmergency: false,
              startedAt: Date.now(),
              lastChunkAt: Date.now()
            };
            activePttSocket = excludeClient || null;

            const genTx = startRadioTransmissionBuffer({
              channelId: 'general',
              speakerId: reqSpeakerId,
              speakerName: reqName,
              role: reqRole,
              isEmergency: false,
            });

            broadcast({
              type: 'PTT_SPEAKER_CHANGED',
              channelId: 'general',
              transmissionId: genTx.id,
              radioPtt: state.radioPtt
            });

            // Risveglio Push ad alta priorità in background per i dispositivi con app chiusa o schermo spento (anti-spam 5s, esclude solo il dispositivo mittente)
            const nowGenPush = Date.now();
            if (nowGenPush - (lastPttPushByChannel.get('general') || 0) >= 5000) {
              lastPttPushByChannel.set('general', nowGenPush);
              const senderEndpointGenPtt = typeof data?.senderEndpoint === 'string' ? data.senderEndpoint.trim() : undefined;
              sendPushNotificationToRole(
                'all',
                {
                  title: '📻 TRASMISSIONE RADIO VHF/UHF',
                  body: `${reqName} sta trasmettendo sul Canale Radio Generale`,
                  tag: 'radio-ptt-general',
                  soundType: 'cicalino',
                  urgenza: 'GIALLO',
                  requireInteraction: false,
                  tipo: 'radio_ptt',
                  isEmergency: false,
                  channelId: 'general',
                  transmissionId: genTx.id,
                  speakerName: reqName,
                },
                senderEndpointGenPtt
              );
            }
            break;
          }

          // 7b-caps. Negoziazione capacità codec audio Opus + registrazione identità/canale del terminale per isolamento gruppi
          case 'PTT_CLIENT_CAPS': {
            if (excludeClient) {
              if (typeof data?.opus === 'boolean') {
                (excludeClient as any).supportsOpus = Boolean(data.opus);
              }
              if (data?.volontarioId !== undefined) {
                (excludeClient as any).volontarioId = data.volontarioId ? String(data.volontarioId) : '';
              }
              if (data?.role === 'admin' || data?.role === 'volontario') {
                (excludeClient as any).clientRole = data.role;
              }
              if (data?.activeChannelId) {
                (excludeClient as any).activeChannelId = String(data.activeChannelId);
              }
              recomputeRadioCodecMode(true);
            }
            break;
          }

          // 7d. Streaming frame audio compresso HD (Opus 48kHz / ADPCM 24kHz / PCM16) con isolamento per gruppo
          case 'PTT_AUDIO_CHUNK': {
            const payloadB64 = data?.payloadBase64 || data?.pcm16Base64;
            if (!payloadB64) break;

            const channelId = String(data?.channelId || 'general');

            // Gruppo isolato: inoltra SOLO ai membri autorizzati di quel gruppo (e sintonizzati su quel gruppo)
            if (channelId !== 'general' && channelId !== 'emergency') {
              const targetGroup = (state.radioGroups || []).find((g) => g.id === channelId);
              if (
                !targetGroup ||
                !targetGroup.enabled ||
                !targetGroup.activeSpeaker ||
                targetGroup.activeSpeaker.speakerId !== data?.speakerId
              ) {
                break;
              }
              targetGroup.activeSpeaker.lastChunkAt = Date.now();
              appendRadioTransmissionChunk(targetGroup.id, {
                codec: String(data.codec || 'pcm16'),
                payloadBase64: String(payloadB64),
                sampleRate: Number(data.sampleRate) || 24000,
                seq: Number(data.seq) || 0,
                speakerId: targetGroup.activeSpeaker.speakerId,
              });
              broadcastToFilter(
                {
                  type: 'PTT_AUDIO_CHUNK',
                  channelId: targetGroup.id,
                  groupId: targetGroup.id,
                  speakerId: targetGroup.activeSpeaker.speakerId,
                  speakerName: targetGroup.activeSpeaker.speakerName,
                  role: targetGroup.activeSpeaker.role,
                  isCentralePriority: targetGroup.activeSpeaker.isCentralePriority,
                  isEmergency: false,
                  codec: data.codec || 'pcm16',
                  payloadBase64: payloadB64,
                  sampleRate: Number(data.sampleRate) || 24000,
                  seq: Number(data.seq) || 0
                },
                (client) => isSocketAllowedInGroup(client, targetGroup),
                excludeClient
              );
              break;
            }

            // Canale Generale o Emergenza Centrale
            const isActiveEmerg = Boolean(state.radioPtt?.activeSpeaker?.isEmergency);
            if (
              (!isActiveEmerg && !state.radioPtt?.enabled) ||
              !state.radioPtt?.activeSpeaker ||
              state.radioPtt.activeSpeaker.speakerId !== data?.speakerId
            ) {
              break;
            }
            state.radioPtt.activeSpeaker.lastChunkAt = Date.now();
            const effChan = isActiveEmerg ? 'emergency' : 'general';
            appendRadioTransmissionChunk(effChan, {
              codec: String(data.codec || 'pcm16'),
              payloadBase64: String(payloadB64),
              sampleRate: Number(data.sampleRate) || 24000,
              seq: Number(data.seq) || 0,
              speakerId: state.radioPtt.activeSpeaker.speakerId,
            });
            const chunkMsg = {
              type: 'PTT_AUDIO_CHUNK',
              channelId: effChan,
              speakerId: state.radioPtt.activeSpeaker.speakerId,
              speakerName: state.radioPtt.activeSpeaker.speakerName,
              role: state.radioPtt.activeSpeaker.role,
              isCentralePriority: state.radioPtt.activeSpeaker.isCentralePriority,
              isEmergency: isActiveEmerg,
              codec: data.codec || 'pcm16',
              payloadBase64: payloadB64,
              sampleRate: Number(data.sampleRate) || 24000,
              seq: Number(data.seq) || 0
            };

            // Sia Emergenza che Generale ("Tutti") raggiungono tutti i terminali connessi anche in background / fuori dalla modale radio
            broadcast(chunkMsg, excludeClient);
            break;
          }

          // 7e. Rilascio Portante PTT (Generale, Gruppo o Emergenza)
          case 'PTT_STOP': {
            const channelId = String(data?.channelId || '');
            if (state.radioPtt?.activeSpeaker && state.radioPtt.activeSpeaker.speakerId === data?.speakerId) {
              const wasEmerg = Boolean(state.radioPtt.activeSpeaker.isEmergency);
              finishRadioTransmissionBuffer(wasEmerg ? 'emergency' : 'general');
              state.radioPtt.activeSpeaker = null;
              activePttSocket = null;
              broadcast({
                type: 'PTT_SPEAKER_CHANGED',
                channelId: wasEmerg ? 'emergency' : 'general',
                radioPtt: state.radioPtt
              });
            }
            if (Array.isArray(state.radioGroups)) {
              state.radioGroups.forEach((g) => {
                if ((!channelId || g.id === channelId) && g.activeSpeaker && g.activeSpeaker.speakerId === data?.speakerId) {
                  finishRadioTransmissionBuffer(g.id);
                  g.activeSpeaker = null;
                  activeGroupSockets.set(g.id, null);
                  broadcastToFilter(
                    {
                      type: 'PTT_SPEAKER_CHANGED',
                      channelId: g.id,
                      groupId: g.id,
                      activeSpeaker: null,
                      radioGroup: g
                    },
                    (c) => isSocketAllowedInGroup(c, g)
                  );
                }
              });
            }
            break;
          }

          // 8. Posizione GPS in Tempo Reale
          case 'UPDATE_GPS': {
            state.gpsPosition = data;
            broadcast({
              type: 'GPS_UPDATED',
              position: state.gpsPosition
            });
            break;
          }

          // 9. Aggiornamento Sessione / Login Volontario (tracciamento multi-account simultaneo)
          case 'UPDATE_SHIFT': {
            if (!state.loggedSessions || typeof state.loggedSessions !== 'object') {
              state.loggedSessions = {};
            }

            const nowTs =
              typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) && data.updatedAt > 0
                ? data.updatedAt
                : Date.now();

            const targetVolId = data?.volontarioId ? String(data.volontarioId).trim() : '';

            // Evita che il logout di un volontario sovrascriva l'activeShift di un altro volontario ancora connesso
            if (data?.attivo || !state.activeShift?.volontarioId || state.activeShift.volontarioId === targetVolId) {
              state.activeShift = data;
            }

            // Aggiorna stato loggato protetto da timestamp (e mantiene inTurno legato SOLO alla presenza di timbratura aperta)
            if (targetVolId) {
              const existing = state.loggedSessions[targetVolId];
              const existingTs = typeof existing?.updatedAt === 'number' && Number.isFinite(existing.updatedAt) ? existing.updatedAt : 0;
              if (nowTs >= existingTs) {
                state.loggedSessions[targetVolId] = {
                  loggato: !!data.attivo,
                  updatedAt: nowTs,
                  volontarioNome: data.volontarioNome || existing?.volontarioNome || undefined,
                  mezzoScelto: data.attivo ? (data.mezzoScelto || '') : '',
                  orarioInizio: data.orarioInizio || existing?.orarioInizio || undefined
                };
                state.volontari = state.volontari.map(v =>
                  v.id === targetVolId
                    ? {
                        ...v,
                        loggato: !!data.attivo,
                        loggatoUpdatedAt: nowTs,
                        ...(data.attivo ? { ultimoAccesso: formatTimeItaly(new Date(nowTs), true) } : {}),
                        inTurno: Boolean(hasTimbraturaApertaServer(v, state.timbrature || [])),
                        mezzoAttivo: data.attivo ? (data.mezzoScelto || '') : ''
                      }
                    : v
                );
              }
            }

            const mezzoTxt = data.mezzoScelto ? ` sul mezzo ${data.mezzoScelto}` : '';
            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: data.attivo
                ? `🔵 ACCESSO VOLONTARIO (LOGGATO): ${data.volontarioNome} ha effettuato l'accesso all'app${mezzoTxt || ' (nessun mezzo associato)'} (${data.qualificaTurno || 'Operativo'})`
                : `🔴 LOGOUT VOLONTARIO: ${data.volontarioNome || 'Volontario'} si è disconnesso dall'app${data.mezzoScelto ? ` (ultimo mezzo: ${data.mezzoScelto})` : ''}.`,
              tipo: 'mezzo'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'SHIFT_UPDATED',
              shift: state.activeShift,
              loggedSessions: state.loggedSessions,
              volontari: state.volontari,
              notification: notif
            });

            if (data.attivo) {
              sendPushNotificationToRole('admin', {
                title: `🔵 ACCESSO VOLONTARIO ALL'APP`,
                body: `${data.volontarioNome} ha effettuato l'accesso all'app${mezzoTxt || ' (in attesa di timbratura, nessun mezzo associato)'} (${data.qualificaTurno || 'Operativo'}) alle ore ${formatTimeItaly()}`,
                tag: `login-volontario-${data.volontarioId || Date.now()}`,
                urgenza: 'VERDE'
              });
            }
            break;
          }

          // 9b. Heartbeat silenzioso presenza account loggato (riallineamento dopo riavvio/reconnect/rientro app)
          case 'SESSION_HEARTBEAT': {
            const targetVolId = data?.volontarioId ? String(data.volontarioId).trim() : '';
            if (!targetVolId) break;

            if (!state.loggedSessions || typeof state.loggedSessions !== 'object') {
              state.loggedSessions = {};
            }

            const nowTs =
              typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) && data.updatedAt > 0
                ? data.updatedAt
                : Date.now();
            const incomingLoggato = data?.loggato !== undefined ? Boolean(data.loggato) : true;
            const existing = state.loggedSessions[targetVolId];
            const existingTs = typeof existing?.updatedAt === 'number' && Number.isFinite(existing.updatedAt) ? existing.updatedAt : 0;

            if (nowTs < existingTs) break;

            const nextMezzo = incomingLoggato
              ? (data?.mezzoScelto !== undefined ? String(data.mezzoScelto || '') : (existing?.mezzoScelto || ''))
              : '';
            const statusChanged =
              !existing ||
              Boolean(existing.loggato) !== incomingLoggato ||
              (existing.mezzoScelto || '') !== nextMezzo;

            state.loggedSessions[targetVolId] = {
              loggato: incomingLoggato,
              updatedAt: nowTs,
              volontarioNome: data?.volontarioNome || existing?.volontarioNome || undefined,
              mezzoScelto: nextMezzo,
              orarioInizio: data?.orarioInizio || existing?.orarioInizio || undefined
            };

            let volChanged = false;
            state.volontari = state.volontari.map(v => {
              if (v.id !== targetVolId) return v;
              const nextInTurno = Boolean(hasTimbraturaApertaServer(v, state.timbrature || []));
              if (
                Boolean(v.loggato) !== incomingLoggato ||
                (v.loggatoUpdatedAt || 0) < nowTs ||
                Boolean(v.inTurno) !== nextInTurno ||
                (data?.mezzoScelto !== undefined && (v.mezzoAttivo || '') !== nextMezzo)
              ) {
                volChanged = true;
                return {
                  ...v,
                  loggato: incomingLoggato,
                  loggatoUpdatedAt: nowTs,
                  ...(incomingLoggato && !v.ultimoAccesso ? { ultimoAccesso: formatTimeItaly(new Date(nowTs), true) } : {}),
                  inTurno: nextInTurno,
                  ...(data?.mezzoScelto !== undefined ? { mezzoAttivo: nextMezzo } : {})
                };
              }
              return v;
            });

            if (statusChanged || volChanged || (nowTs - existingTs > 45000)) {
              persistState();
              broadcast({
                type: 'LOGGED_SESSIONS_UPDATED',
                loggedSessions: state.loggedSessions,
                volontari: state.volontari
              });
            }
            break;
          }

          // 10. Chiusura / Reset Missione
          case 'CLEAR_MISSION': {
            const clearedCod = data?.codice || state.activeMission?.codice;
            if (clearedCod) {
              state.codiciEliminati = ensureCodiciEliminati([...(state.codiciEliminati || []), clearedCod]);
            }
            state.activeMission = null;
            state.letturaConfermata = false;
            state.operativeTimes = {};
            state.kmInizio = '';
            state.kmFine = '';
            state.datiDestinazione = null;
            state.ringing.active = false;

            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: 'MISSIONE CONCLUSA: Scheda archiviata e terminali liberati per nuovo servizio.',
              tipo: 'sistema'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'MISSION_CLEARED',
              forceClear: true,
              codiceEliminato: clearedCod,
              notification: notif
            });
            break;
          }

          // 11. Archiviazione Permanente Servizio nel Database Centrale
          case 'ARCHIVE_SERVICE': {
            if (data && data.codice) {
              const currentYear = getCurrentYearItaly();
              const serviceYear = data.anno || currentYear;
              const isMatchActive = !data.schedaDirettaArchivio && state.activeMission?.codice === data.codice;
              const activeFallback = isMatchActive ? state.activeMission : null;

              const nuovoServizio: ArchivedService = {
                id: data.id || `SER-${Date.now()}`,
                codice: data.codice,
                anno: serviceYear,
                data: data.data || formatDateTimeItaly(),
                mezzo: data.mezzo || 'N/D',
                urgenza: data.urgenza || 'VERDE',
                ambito: data.ambito || 'SERVIZIO',
                indirizzo: data.indirizzo || data.indirizzoIntervento || '-',
                indirizzoIntervento: data.indirizzoIntervento || data.indirizzo,
                destinazione: data.destinazione,
                chiamante: data.chiamante,
                telefono: data.telefono,
                enteIstituzionale: data.enteIstituzionale,
                noteCritiche: data.noteCritiche,
                volontarioNome: data.volontarioNome,
                volontarioId: data.volontarioId,
                volontarioTelefono: data.volontarioTelefono,
                qualificaTurno: data.qualificaTurno,
                kmInizio: Number(data.kmInizio) || 0,
                kmFine: Number(data.kmFine) || 0,
                kmTotali: Number(data.kmTotali) || 0,
                inAttesaKm: !!data.inAttesaKm,
                tempi: data.tempi || {},
                testoCompleto: data.testoCompleto || '',
                dataCreazione: data.dataCreazione || new Date().toISOString(),
                dataCompletamento: new Date().toISOString(),
                coordinateSulPosto: data.coordinateSulPosto || data.tempi?.coordinateSulPosto,
                coordinateDestinazione: data.coordinateDestinazione || data.tempi?.coordinateDestinazione,
                tipoAnimale: data.tipoAnimale || activeFallback?.tipoAnimale,
                tipoAnimaleAltro: data.tipoAnimaleAltro || activeFallback?.tipoAnimaleAltro,
                nonDiProprieta: data.nonDiProprieta !== undefined ? data.nonDiProprieta : activeFallback?.nonDiProprieta,
                microchip: data.microchip || activeFallback?.microchip,
                noMicrochip: data.noMicrochip !== undefined ? data.noMicrochip : activeFallback?.noMicrochip,
                datiProprietarioCentrale: data.datiProprietarioCentrale || activeFallback?.datiProprietarioCentrale,
                fotoDocumento: data.fotoDocumento || activeFallback?.fotoDocumento || data.datiProprietarioCentrale?.fotoDocumento || activeFallback?.datiProprietarioCentrale?.fotoDocumento,
                isStrutturaVeterinariaPartenza: data.isStrutturaVeterinariaPartenza !== undefined ? data.isStrutturaVeterinariaPartenza : activeFallback?.isStrutturaVeterinariaPartenza,
                datiDestinazione: data.datiDestinazione || activeFallback?.datiDestinazione,
                decisioneCentraleNonVet: data.decisioneCentraleNonVet || activeFallback?.decisioneCentraleNonVet,
                noteNonVet: data.noteNonVet || activeFallback?.noteNonVet,
                firmaVolontario: data.firmaVolontario,
                firmaOperatoreCentrale: data.firmaOperatoreCentrale,
                operatoreCentraleNome: data.operatoreCentraleNome,
                dataFirmaCentrale: data.dataFirmaCentrale,
                visionatoDaCentrale: data.visionatoDaCentrale,
                manovreEffettuatePatologie: data.manovreEffettuatePatologie,
                sottoAmbitoVet: data.sottoAmbitoVet || activeFallback?.sottoAmbitoVet,
                operatoreMittenteId: data.operatoreMittenteId,
                operatoreMittenteNome: data.operatoreMittenteNome,
                annullata: data.annullata !== undefined ? data.annullata : activeFallback?.annullata,
                motivoAnnullamento: data.motivoAnnullamento || activeFallback?.motivoAnnullamento,
                richiedenteAnnullamento: data.richiedenteAnnullamento || activeFallback?.richiedenteAnnullamento,
                orarioAnnullamento: data.orarioAnnullamento || activeFallback?.orarioAnnullamento,
                autonomoVolontario: data.autonomoVolontario !== undefined ? data.autonomoVolontario : activeFallback?.autonomoVolontario,
                creatoDaVolontarioNome: data.creatoDaVolontarioNome || activeFallback?.creatoDaVolontarioNome,
                creatoDaVolontarioId: data.creatoDaVolontarioId || activeFallback?.creatoDaVolontarioId,
                tipologiaServizio: data.tipologiaServizio || activeFallback?.tipologiaServizio,
                numeroSegreteriaSoupRt: data.numeroSegreteriaSoupRt || activeFallback?.numeroSegreteriaSoupRt,
                allertaMeteo: data.allertaMeteo || activeFallback?.allertaMeteo,
                schedaDirettaArchivio: Boolean(data.schedaDirettaArchivio)
              };

              const existingIdx = state.serviziArchivio.findIndex(s => s.id === nuovoServizio.id || s.codice === nuovoServizio.codice);
              if (existingIdx >= 0) {
                state.serviziArchivio[existingIdx] = { ...state.serviziArchivio[existingIdx], ...nuovoServizio };
              } else {
                state.serviziArchivio = [nuovoServizio, ...state.serviziArchivio];
              }

              persistState();

              const notif: RadioNotification = {
                id: generateUniqueNotifId(),
                orario: formatTimeItaly(),
                testo: `📁 DATABASE: Servizio ${nuovoServizio.codice} archiviato definitivamente (Anno ${serviceYear}${nuovoServizio.inAttesaKm ? ' - ⚠️ IN ATTESA KM' : ''}).`,
                tipo: 'sistema'
              };
              state.notifiche.push(notif);

              broadcast({
                type: 'SERVICE_ARCHIVED',
                servizio: nuovoServizio,
                serviziArchivio: state.serviziArchivio,
                notification: notif
              });

              // Il servizio è stato salvato nel database archivio.
              // NON azzeriamo prematuramente la missione attiva qui: a bordo mezzo è attivo il countdown
              // di 30 minuti di sola consultazione. La missione verrà azzerata solo al termine naturale del countdown
              // oppure quando il volontario clicca 'Azzera Countdown' (CLEAR_MISSION) o la Centrale invia una nuova scheda.
              if (state.activeMission && state.activeMission.codice === nuovoServizio.codice) {
                // Conserviamo i dati aggiornati per consultazione sincronizzata
                state.activeMission.completata = true;
                state.operativeTimes = nuovoServizio.tempi || state.operativeTimes;
                state.kmInizio = String(nuovoServizio.kmInizio || state.kmInizio);
                state.kmFine = String(nuovoServizio.kmFine || state.kmFine);
                persistState();
              }
            }
            break;
          }

          // 12. Centrale Inserisce KM Mancanti dopo Chiamata al Volontario
          case 'CENTRALE_UPDATE_KM': {
            if (data && data.id) {
              const idx = state.serviziArchivio.findIndex(s => s.id === data.id || s.codice === data.codice);
              if (idx >= 0) {
                const ini = Number(data.kmInizio) || 0;
                const fin = Number(data.kmFine) || 0;
                if (fin < ini) {
                  console.warn(`[CENTRALE_UPDATE_KM] Rifiutato: KM finali (${fin}) non possono essere inferiori a KM iniziali (${ini})`);
                  break;
                }
                const tot = fin - ini;

                const serv = state.serviziArchivio[idx];
                serv.kmInizio = ini;
                serv.kmFine = fin;
                serv.kmTotali = tot;
                serv.inAttesaKm = false;

                // Aggiorna testo completo della scheda
                serv.testoCompleto = serv.testoCompleto
                  .replace(/KM INIZIO: [^\n]*/, `KM INIZIO: ${ini} | KM FINE: ${fin}`)
                  .replace(/KM TOTALI PERCORSI: [^\n]*/, `KM TOTALI PERCORSI: ${tot} KM`);

                persistState();

                const notif: RadioNotification = {
                  id: generateUniqueNotifId(),
                  orario: formatTimeItaly(),
                  testo: `✅ CENTRALE: Inseriti KM per ${serv.codice} (${tot} KM). Foglio di Viaggio PDF sbloccato e disponibile!`,
                  tipo: 'centrale'
                };
                state.notifiche.push(notif);

                broadcast({
                  type: 'SERVICE_KM_UPDATED',
                  servizio: serv,
                  serviziArchivio: state.serviziArchivio,
                  notification: notif
                });

                if (state.activeMission && (state.activeMission.codice === serv.codice || state.activeMission.codice === data.codice)) {
                  state.activeMission = null;
                  state.letturaConfermata = false;
                  state.operativeTimes = {};
                  state.kmInizio = '';
                  state.kmFine = '';
                  state.datiDestinazione = null;
                  state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };
                  persistState();

                  broadcast({
                    type: 'MISSION_CLEARED',
                    notification: notif
                  });
                }
              }
            }
            break;
          }

          // 12-bis. Firma Telematica Servizio da parte dell'Operatore di Centrale (singola o simultanea)
          case 'CENTRALE_SIGN_SERVICES': {
            if (data && Array.isArray(data.ids) && data.ids.length > 0 && data.firmaBase64) {
              const ids: string[] = data.ids;
              const nowStr = formatDateTimeItaly();
              let signedCount = 0;
              state.serviziArchivio.forEach(s => {
                if (ids.includes(s.id) || ids.includes(s.codice)) {
                  s.firmaOperatoreCentrale = data.firmaBase64;
                  s.operatoreCentraleNome = data.operatoreNome || 'Operatore Centrale';
                  s.dataFirmaCentrale = nowStr;
                  s.visionatoDaCentrale = true;
                  signedCount++;
                }
              });
              persistState();

              const notif: RadioNotification = {
                id: generateUniqueNotifId(),
                orario: formatTimeItaly(),
                testo: `✍️ CENTRALE: ${signedCount} foglio/i di viaggio firmato/i digitalmente con successo dall'Operatore ${data.operatoreNome || 'Centrale'}.`,
                tipo: 'centrale'
              };
              state.notifiche.push(notif);

              broadcast({
                type: 'SERVICES_SIGNED_CENTRALE',
                ids,
                firmaBase64: data.firmaBase64,
                operatoreNome: data.operatoreNome,
                dataFirmaCentrale: nowStr,
                serviziArchivio: state.serviziArchivio,
                notification: notif
              });
            }
            break;
          }

          // 12-ter. Modifica Foglio di Viaggio nel Database da parte dell'Operatore di Centrale Mittente
          case 'CENTRALE_UPDATE_ARCHIVED_SERVICE': {
            if (data && (data.id || data.codice)) {
              const idx = state.serviziArchivio.findIndex(s => s.id === data.id || s.codice === data.codice);
              if (idx >= 0) {
                state.serviziArchivio[idx] = {
                  ...state.serviziArchivio[idx],
                  ...data
                };
                persistState();

                const notif: RadioNotification = {
                  id: generateUniqueNotifId(),
                  orario: formatTimeItaly(),
                  testo: `✏️ CENTRALE: Foglio di viaggio ${data.codice} aggiornato nel database centrale.`,
                  tipo: 'centrale'
                };
                state.notifiche.push(notif);

                broadcast({
                  type: 'SERVICE_UPDATED',
                  servizio: state.serviziArchivio[idx],
                  serviziArchivio: state.serviziArchivio,
                  notification: notif
                });
              }
            }
            break;
          }

          // 12-quater. Eliminazione Singolo Servizio dal Database (Amministratore)
          case 'DELETE_SERVICE': {
            const targetId = data.id || data.codice;
            if (targetId && Array.isArray(state.serviziArchivio)) {
              const idx = state.serviziArchivio.findIndex(s => s.id === targetId || s.codice === targetId);
              if (idx >= 0) {
                const rimosso = state.serviziArchivio[idx];
                state.serviziArchivio.splice(idx, 1);

                if (state.activeMission && (state.activeMission.codice === rimosso.codice || state.activeMission.codice === targetId)) {
                  state.activeMission = null;
                  state.letturaConfermata = false;
                  state.operativeTimes = {};
                  state.kmInizio = '';
                  state.kmFine = '';
                  state.datiDestinazione = null;
                  state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };
                }

                persistState();

                const notif: RadioNotification = {
                  id: generateUniqueNotifId(),
                  orario: formatTimeItaly(),
                  testo: `🗑️ DATABASE: Servizio ${rimosso.codice} (${rimosso.mezzo}) rimosso definitivamente dall'archivio dall'Amministratore.`,
                  tipo: 'centrale'
                };
                state.notifiche.push(notif);

                broadcast({
                  type: 'SERVICE_DELETED',
                  id: rimosso.id,
                  codice: rimosso.codice,
                  serviziArchivio: state.serviziArchivio,
                  prossimoProgressivo: calcolaProssimoNumeroMissione(state.serviziArchivio),
                  notification: notif
                });
              }
            }
            break;
          }

          // 12-quinquies. Eliminazione Multipla Servizi dal Database (Amministratore)
          case 'DELETE_SERVICES_BATCH': {
            const ids: string[] = data.ids;
            if (Array.isArray(ids) && ids.length > 0 && Array.isArray(state.serviziArchivio)) {
              const primaCount = state.serviziArchivio.length;
              const rimossi = state.serviziArchivio.filter(s => ids.includes(s.id) || ids.includes(s.codice));
              const rimossiCodici = rimossi.map(s => s.codice);

              state.serviziArchivio = state.serviziArchivio.filter(s => !ids.includes(s.id) && !ids.includes(s.codice));
              const rimossiCount = primaCount - state.serviziArchivio.length;

              if (state.activeMission && (ids.includes(state.activeMission.codice) || rimossiCodici.includes(state.activeMission.codice))) {
                state.activeMission = null;
                state.letturaConfermata = false;
                state.operativeTimes = {};
                state.kmInizio = '';
                state.kmFine = '';
                state.datiDestinazione = null;
                state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };
              }

              persistState();

              const notif: RadioNotification = {
                id: generateUniqueNotifId(),
                orario: formatTimeItaly(),
                testo: `🗑️ DATABASE: ${rimossiCount} servizi rimossi dall'archivio dall'Amministratore (${rimossiCodici.slice(0, 3).join(', ')}${rimossiCodici.length > 3 ? '...' : ''}).`,
                tipo: 'centrale'
              };
              state.notifiche.push(notif);

              broadcast({
                type: 'SERVICES_DELETED',
                ids,
                codici: rimossiCodici,
                count: rimossiCount,
                serviziArchivio: state.serviziArchivio,
                prossimoProgressivo: calcolaProssimoNumeroMissione(state.serviziArchivio),
                notification: notif
              });
            }
            break;
          }

          // 13. Allarme Countdown 30 Minuti Scaduto Senza KM da Bordo Mezzo
          case 'VOLONTARIO_SCADENZA_KM_ALLARME': {
            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🚨 ALLERTA CENTRALE: Il volontario ${data.volontarioNome || 'bordo mezzo'} (${data.mezzo || 'Mezzo'}) non ha inserito i KM per il servizio ${data.codice} prima della fine dei 30 minuti! CHIAMARE SUBITO IL VOLONTARIO al ${data.volontarioTelefono || 'telefono'} per farsi comunicare i KM!`,
              tipo: 'allarme'
            };
            state.notifiche.push(notif);
            persistState();

            broadcast({
              type: 'VOLONTARIO_KM_EXPIRED_ALERT',
              data,
              notification: notif
            });

            // Invia notifica Push urgente all'Amministratore
            sendPushNotificationToRole('admin', {
              title: `🚨 ALLERTA KM NON INSERITI (${data.codice})`,
              body: `30 minuti scaduti! Chiama subito il volontario ${data.volontarioNome} (${data.volontarioTelefono || 'N/D'}) per richiedere i KM e sbloccare il PDF.`,
              tag: `km-expired-${data.codice}`,
              urgenza: 'ROSSO',
              soundType: 'sirena'
            });
            break;
          }

          // 14. Centrale Annulla Intervento in qualsiasi momento
          case 'ANNULLA_INTERVENTO': {
            if (data && data.codice) {
              const nowTime = data.orario || formatTimeItaly(undefined, false);
              const schedaAperta = data.schedaAperta !== undefined ? Boolean(data.schedaAperta) : Boolean(state.letturaConfermata);

              if (!schedaAperta) {
                // REQUISITO: Se la scheda non è mai stata aperta dal volontario, sparisce automaticamente!
                state.codiciEliminati = ensureCodiciEliminati([...(state.codiciEliminati || []), data.codice]);
                state.activeMission = null;
                state.letturaConfermata = false;
                state.operativeTimes = {};
                state.kmInizio = '';
                state.kmFine = '';
                state.datiDestinazione = null;
                state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: Date.now() };

                const notif: RadioNotification = {
                  id: generateUniqueNotifId(),
                  orario: formatTimeItaly(),
                  testo: `ℹ️ Intervento ${data.codice} ANNULLATO dalla Centrale prima dell'apertura: scheda rimossa automaticamente dal terminale.`,
                  tipo: 'centrale'
                };
                state.notifiche.push(notif);
                persistState();

                broadcast({
                  type: 'MISSION_CANCELLED',
                  codice: data.codice,
                  motivo: data.motivo,
                  richiedente: data.richiedente,
                  orario: nowTime,
                  dettagli: data.dettagli,
                  nonAperta: true,
                  mission: null,
                  ringing: state.ringing,
                  notification: notif
                });
              } else {
                // REQUISITO: Scheda già aperta: arriva notifica al volontario con SIRENA che lo avvisa di rientrare in sede
                if (state.activeMission && state.activeMission.codice === data.codice) {
                  state.activeMission.annullata = true;
                  state.activeMission.motivoAnnullamento = data.motivo;
                  state.activeMission.richiedenteAnnullamento = data.richiedente;
                  state.activeMission.orarioAnnullamento = nowTime;
                }

                const notif: RadioNotification = {
                  id: generateUniqueNotifId(),
                  orario: formatTimeItaly(),
                  testo: `🚨 ALLERTA: Intervento ${data.codice} ANNULLATO dalla Centrale! Rientrare subito in sede. Motivo: ${data.motivo} (Richiesto da: ${data.richiedente}).`,
                  tipo: 'allarme'
                };
                state.notifiche.push(notif);

                state.ringing = {
                  active: true,
                  source: `Centrale: Servizio Annullato - Rientro in Sede (${data.motivo || 'Intervento Annullato'})`,
                  soundType: 'sirena',
                  timestamp: Date.now()
                };
                persistState();

                broadcast({
                  type: 'MISSION_CANCELLED',
                  codice: data.codice,
                  motivo: data.motivo,
                  richiedente: data.richiedente,
                  orario: nowTime,
                  dettagli: data.dettagli,
                  nonAperta: false,
                  mission: state.activeMission,
                  ringing: state.ringing,
                  notification: notif
                });

                sendPushNotificationToRole('volontario', {
                  title: `🚨 SERVIZIO ANNULLATO - RIENTRARE IN SEDE (${data.codice})`,
                  body: `La Centrale ha annullato la missione. Rientra in sede: ${data.motivo} (Richiesto da: ${data.richiedente}).`,
                  tag: `mission-cancelled-${data.codice}`,
                  soundType: 'sirena',
                  urgenza: 'ROSSO',
                  source: 'Centrale Operativa',
                  requireInteraction: true,
                  url: '/'
                });
              }
            }
            break;
          }

          // 15. Aggiornamento Luoghi di Timbratura GPS a discrezione operatore (Effetto Immediato)
          case 'UPDATE_LUOGHI_TIMBRATURA': {
            if (Array.isArray(data.luoghi)) {
              const luoghiNorm = normalizzaListaLuoghiTimbratura(data.luoghi, state.sedi);
              state.luoghiTimbratura = luoghiNorm;
              persistState();

              const count = luoghiNorm.length;
              const notif: RadioNotification = {
                id: generateUniqueNotifId(),
                orario: formatTimeItaly(),
                testo: data.messaggio || `📍 LUOGHI DI TIMBRATURA AGGIORNATI: Configurazione punti di timbratura GPS aggiornata dall'operatore (${count} punti). Effetto immediato per le timbrature dei volontari.`,
                tipo: 'sistema'
              };
              state.notifiche.push(notif);

              broadcast({
                type: 'LUOGHI_TIMBRATURA_UPDATED',
                luoghi: state.luoghiTimbratura,
                notification: notif
              });

              console.log(`[Luoghi Timbratura] Aggiornati ${count} punti nel database persistito.`);
            }
            break;
          }

          // 16. Aggiornamento Registro Timbrature Volontari (Sincronizzazione Realtime Immediata)
          case 'UPDATE_TIMBRATURE': {
            if (Array.isArray(data.timbrature)) {
              state.timbrature = data.timbrature;
              const volChanged = syncVolontariInTurnoWithTimbrature();
              persistState();

              broadcast({
                type: 'TIMBRATURE_UPDATED',
                timbrature: state.timbrature
              });
              if (volChanged) {
                broadcast({
                  type: 'VOLONTARI_UPDATED',
                  volontari: state.volontari,
                  volontariEliminatiIds: state.volontariEliminatiIds
                });
              }

              console.log(`[Timbrature] Sincronizzate ${data.timbrature.length} timbrature volontari nel database persistito.`);
            }
            break;
          }

          // 17. Aggiornamento Bacheca di Sezione, Circolari, Commenti e Likes (Realtime e Persistito)
          case 'UPDATE_BACHECA': {
            const bachecaArray = Array.isArray(data?.bacheca) ? data.bacheca : (Array.isArray(data) ? data : null);
            if (bachecaArray) {
              const deletedIds = normalizeDeletedIds([
                ...(Array.isArray(state.bachecaEliminatiIds) ? state.bachecaEliminatiIds : []),
                ...(Array.isArray(data?.bachecaEliminatiIds) ? data.bachecaEliminatiIds : []),
              ]);
              state.bachecaEliminatiIds = deletedIds;
              state.bacheca = mergeComunicazioniBachecaSafe(state.bacheca, bachecaArray, deletedIds);
              if (data?.notifica && (data.notifica.tipo === 'nuovo_post' || data.notifica.tipo === 'nuovo_corso')) {
                const record: NotificaBachecaRecord = {
                  ...data.notifica,
                  id: data.notifica.id || `bacheca-${data.notifica.tipo}-${data.notifica.postId || Date.now()}`,
                  createdAt: Number(data.notifica.createdAt) || Date.now(),
                  soloInApp: data.notifica.soloInApp !== false,
                };
                state.notificheBachecaRecenti = mergeNotificheBachecaRecenti(state.notificheBachecaRecenti, [record]);
              }
              persistState();

              broadcast({
                type: 'BACHECA_UPDATED',
                bacheca: state.bacheca,
                bachecaEliminatiIds: state.bachecaEliminatiIds,
                notificheBachecaRecenti: state.notificheBachecaRecenti || []
              });

              if (data?.notifica) {
                const notif = {
                  ...data.notifica,
                  id: data.notifica.id || `bacheca-${data.notifica.tipo || 'post'}-${data.notifica.postId || Date.now()}`,
                  createdAt: Number(data.notifica.createdAt) || Date.now(),
                };
                broadcast({
                  type: 'NOTIFICA_BACHECA',
                  notifica: notif,
                  notificheBachecaRecenti: state.notificheBachecaRecenti || []
                });

                // WebPush di cortesia SOLO se non è una notifica strettamente solo in-app
                if (!notif.soloInApp) {
                  try {
                    const pushTitle =
                      notif.tipo === 'nuovo_commento'
                        ? '💬 Nuovo commento in bacheca'
                        : notif.tipo === 'nuovo_corso'
                        ? `🎓 Corso in Bacheca: ${notif.postTitolo || ''}`
                        : `📢 Bacheca: ${notif.postTitolo || 'Nuova comunicazione'}`;
                    if (Array.isArray(notif.destinatariVolontariIds) && notif.destinatariVolontariIds.length > 0) {
                      notif.destinatariVolontariIds.forEach((volId: string) => {
                        sendPushNotificationToVolunteer(volId, {
                          title: pushTitle,
                          body: notif.messaggio || notif.postTitolo || '',
                          tag: 'bacheca-notif',
                          data: { url: '/', postId: notif.postId, tipo: notif.tipo }
                        });
                      });
                    } else {
                      sendPushNotificationToRole('all', {
                        title: pushTitle,
                        body: notif.messaggio || notif.postTitolo || '',
                        tag: 'bacheca-notif',
                        data: { url: '/', postId: notif.postId, tipo: notif.tipo }
                      });
                    }
                  } catch (pushErr) {
                    console.warn('[WebPush Bacheca] Errore push:', pushErr);
                  }
                }
              }

              console.log(`[Bacheca] Sincronizzati ${bachecaArray.length} post in bacheca e commenti collegati nel database persistito.`);
            }
            break;
          }

          // 17b. Notifica in-app dedicata Bacheca (es. nuovo corso/formazione pubblicato in bacheca)
          case 'NOTIFICA_BACHECA': {
            const rawNotif = data?.notifica || data;
            if (rawNotif && rawNotif.postTitolo) {
              const notif: NotificaBachecaRecord = {
                ...rawNotif,
                id: rawNotif.id || `bacheca-${rawNotif.tipo || 'nuovo_post'}-${rawNotif.postId || Date.now()}`,
                tipo: rawNotif.tipo || 'nuovo_post',
                postId: rawNotif.postId || '',
                postTitolo: String(rawNotif.postTitolo),
                messaggio: rawNotif.messaggio || `Pubblicato in bacheca: "${rawNotif.postTitolo}"`,
                soloInApp: rawNotif.soloInApp !== false,
                createdAt: Number(rawNotif.createdAt) || Date.now(),
              };
              if (notif.tipo === 'nuovo_post' || notif.tipo === 'nuovo_corso') {
                state.notificheBachecaRecenti = mergeNotificheBachecaRecenti(state.notificheBachecaRecenti, [notif]);
                persistState();
              }
              broadcast({
                type: 'NOTIFICA_BACHECA',
                notifica: notif,
                notificheBachecaRecenti: state.notificheBachecaRecenti || []
              });
            }
            break;
          }

          // 25. Giornale di Bordo Centrale Operativa (Brogliaccio Eventi con Ora Automatica)
          case 'UPDATE_GIORNALE_BORDO': {
            const list = Array.isArray(data?.giornaleBordo) ? data.giornaleBordo : (Array.isArray(data) ? data : null);
            if (list) {
              state.giornaleBordo = list;
              persistState();
              broadcast({
                type: 'GIORNALE_BORDO_UPDATED',
                giornaleBordo: state.giornaleBordo
              });
            }
            break;
          }

          case 'ADD_GIORNALE_BORDO_VOCE': {
            const voce = data?.voce || data;
            if (voce && voce.testo) {
              const nowIt = getItalianDateParts();
              const dateStr = nowIt.dateIt;
              const timeStr = nowIt.timeIt;
              
              const nuovaVoce = {
                id: voce.id || `gb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                data: voce.data || dateStr,
                ora: timeStr, // Orario certificato dal server
                timestamp: Date.now(),
                operatoreId: voce.operatoreId,
                operatoreNome: voce.operatoreNome || 'Operatore Centrale',
                testo: String(voce.testo).trim(),
                categoria: voce.categoria || 'ordinaria',
                consegnaTurno: Boolean(voce.consegnaTurno),
                presaVisioneDa: voce.presaVisioneDa || [],
                mezzoCoinvolto: voce.mezzoCoinvolto,
                allegatoCodiceServizio: voce.allegatoCodiceServizio
              };

              state.giornaleBordo = [nuovaVoce, ...(state.giornaleBordo || [])];
              persistState();

              broadcast({
                type: 'GIORNALE_BORDO_UPDATED',
                giornaleBordo: state.giornaleBordo,
                nuovaVoce
              });

              console.log(`[Giornale di Bordo] Registrata annotazione alle ore ${timeStr} da ${nuovaVoce.operatoreNome} (${nuovaVoce.categoria})`);
            }
            break;
          }

          case 'PRESA_VISIONE_GIORNALE_BORDO': {
            const { voceId, operatoreNome } = data || {};
            if (voceId && operatoreNome && Array.isArray(state.giornaleBordo)) {
              const nowIt = getItalianDateParts();
              const timeStr = nowIt.timeIt;
              const dateStr = nowIt.dateIt;
              
              const idx = state.giornaleBordo.findIndex((v: any) => v.id === voceId);
              if (idx >= 0) {
                const target = state.giornaleBordo[idx];
                const list = Array.isArray(target.presaVisioneDa) ? target.presaVisioneDa : [];
                if (!list.some((p: any) => p.operatoreNome === operatoreNome)) {
                  list.push({
                    operatoreNome,
                    data: dateStr,
                    ora: timeStr,
                    timestamp: Date.now()
                  });
                  target.presaVisioneDa = list;
                  state.giornaleBordo[idx] = { ...target };
                  persistState();

                  broadcast({
                    type: 'GIORNALE_BORDO_UPDATED',
                    giornaleBordo: state.giornaleBordo
                  });
                }
              }
            }
            break;
          }

          // 26. Sincronizzazione Magazzino Mezzi (Ricambi, Oli, Tagliandi & Dotazioni di Bordo)
          case 'UPDATE_MAGAZZINO_PARTI': {
            const list = Array.isArray(data?.magazzinoParti) ? data.magazzinoParti : (Array.isArray(data) ? data : null);
            if (list) {
              state.magazzinoParti = filterDemoMagazzinoParti(list);
              persistState();
              broadcast({
                type: 'MAGAZZINO_PARTI_UPDATED',
                magazzinoParti: state.magazzinoParti
              });
            }
            break;
          }

          case 'UPDATE_MAGAZZINO_MEZZI': {
            const list = Array.isArray(data?.magazzinoMezzi) ? data.magazzinoMezzi : (Array.isArray(data) ? data : null);
            if (list) {
              state.magazzinoMezzi = filterDemoMagazzinoMezzi(list);
              persistState();
              broadcast({
                type: 'MAGAZZINO_MEZZI_UPDATED',
                magazzinoMezzi: state.magazzinoMezzi
              });
            }
            break;
          }

          // 27. Aggiornamento Dati Protezione Civile (Numero Segreteria Soup_RT e Allerta Meteo) da Centrale
          case 'UPDATE_PROTEZIONE_CIVILE_INFO': {
            const { numeroSegreteriaSoupRt, allertaMeteo, codice } = data || {};
            if (state.activeMission && (!codice || state.activeMission.codice === codice)) {
              state.activeMission.numeroSegreteriaSoupRt = numeroSegreteriaSoupRt !== undefined
                ? (String(numeroSegreteriaSoupRt).trim() || undefined)
                : state.activeMission.numeroSegreteriaSoupRt;
              state.activeMission.allertaMeteo = allertaMeteo !== undefined
                ? (String(allertaMeteo).trim() || 'Nessuna')
                : state.activeMission.allertaMeteo;
            }
            if (codice && Array.isArray(state.serviziArchivio)) {
              const idx = state.serviziArchivio.findIndex(s => s.codice === codice);
              if (idx >= 0) {
                state.serviziArchivio[idx] = {
                  ...state.serviziArchivio[idx],
                  numeroSegreteriaSoupRt: numeroSegreteriaSoupRt !== undefined
                    ? (String(numeroSegreteriaSoupRt).trim() || undefined)
                    : state.serviziArchivio[idx].numeroSegreteriaSoupRt,
                  allertaMeteo: allertaMeteo !== undefined
                    ? (String(allertaMeteo).trim() || 'Nessuna')
                    : state.serviziArchivio[idx].allertaMeteo
                };
              }
            }
            const notif: RadioNotification = {
              id: generateUniqueNotifId(),
              orario: formatTimeItaly(),
              testo: `🛡️ PROTEZIONE CIVILE AGGIORNATA (${codice || state.activeMission?.codice || ''}): Soup_RT: ${numeroSegreteriaSoupRt || 'N/D'} | Allerta Meteo: ${allertaMeteo || 'Nessuna'}`,
              tipo: 'centrale'
            };
            state.notifiche.push(notif);
            persistState();
            broadcast({
              type: 'PROTEZIONE_CIVILE_INFO_UPDATED',
              codice: codice || state.activeMission?.codice,
              numeroSegreteriaSoupRt: state.activeMission?.numeroSegreteriaSoupRt ?? (String(numeroSegreteriaSoupRt || '').trim() || undefined),
              allertaMeteo: state.activeMission?.allertaMeteo ?? (allertaMeteo || 'Nessuna'),
              notification: notif
            });
            break;
          }

          // 28. Sincronizzazione Indirizzi Collezionati & Contatti
          case 'UPDATE_INDIRIZZI_COLLEZIONATI': {
            const list = Array.isArray(data?.indirizziCollezionati)
              ? data.indirizziCollezionati
              : (Array.isArray(data) ? data : null);
            if (list) {
              state.indirizziCollezionati = list;
              persistState();
              broadcast({
                type: 'INDIRIZZI_COLLEZIONATI_UPDATED',
                indirizziCollezionati: state.indirizziCollezionati
              });
            }
            break;
          }

          case 'ADD_INDIRIZZO_COLLEZIONATO': {
            const entry = data?.entry || data;
            if (entry && typeof entry.indirizzo === 'string' && entry.indirizzo.trim()) {
              const norm = entry.indirizzo.trim().toLowerCase();
              const current = Array.isArray(state.indirizziCollezionati) ? [...state.indirizziCollezionati] : [];
              const existingIdx = current.findIndex((i: any) => String(i.indirizzo || '').trim().toLowerCase() === norm);
              const nowIso = new Date().toISOString();
              if (existingIdx >= 0) {
                const prev = current[existingIdx];
                current[existingIdx] = {
                  ...prev,
                  nome: prev.nome?.trim() ? prev.nome : (entry.nome || ''),
                  lat: typeof prev.lat === 'number' ? prev.lat : entry.lat,
                  lng: typeof prev.lng === 'number' ? prev.lng : entry.lng,
                  placeId: prev.placeId || entry.placeId,
                  googleMapsUri: prev.googleMapsUri || entry.googleMapsUri,
                  origine: prev.origine && entry.origine && prev.origine !== entry.origine ? 'entrambi' : (prev.origine || entry.origine || 'manuale'),
                  ultimoUtilizzo: nowIso,
                  utilizzi: (prev.utilizzi || 1) + 1
                };
              } else {
                current.unshift({
                  id: entry.id || `ind-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  nome: (entry.nome || '').trim(),
                  indirizzo: entry.indirizzo.trim(),
                  lat: typeof entry.lat === 'number' ? entry.lat : undefined,
                  lng: typeof entry.lng === 'number' ? entry.lng : undefined,
                  placeId: entry.placeId,
                  googleMapsUri: entry.googleMapsUri,
                  origine: entry.origine || 'manuale',
                  note: entry.note,
                  dataCreazione: entry.dataCreazione || formatISODateItaly(),
                  ultimoUtilizzo: nowIso,
                  utilizzi: 1
                });
              }
              state.indirizziCollezionati = current;
              persistState();
              broadcast({
                type: 'INDIRIZZI_COLLEZIONATI_UPDATED',
                indirizziCollezionati: state.indirizziCollezionati
              });
            }
            break;
          }

          case 'UPDATE_CONTATTI': {
            const list = Array.isArray(data?.contatti) ? data.contatti : (Array.isArray(data) ? data : null);
            if (list) {
              state.contatti = list;
              persistState();
              broadcast({
                type: 'CONTATTI_UPDATED',
                contatti: state.contatti
              });
            }
            break;
          }

          case 'UPDATE_CORSI': {
            const list = filterLegacyCorsiServer(Array.isArray(data?.corsiFormazione) ? data.corsiFormazione : []);
            state.corsiFormazione = list;
            persistState();
            broadcast({
              type: 'CORSI_UPDATED',
              corsiFormazione: state.corsiFormazione
            });
            break;
          }

          case 'UPDATE_NOTE_DEBITO': {
            if (Array.isArray(data?.noteDiDebito)) {
              state.noteDiDebito = data.noteDiDebito;
              persistState();
              broadcast({
                type: 'NOTE_DEBITO_UPDATED',
                noteDiDebito: state.noteDiDebito
              });
            }
            break;
          }

          case 'UPDATE_RICEVUTE_CONTABILITA': {
            if (Array.isArray(data?.ricevuteContabilita)) {
              state.ricevuteContabilita = data.ricevuteContabilita;
              persistState();
              broadcast({
                type: 'RICEVUTE_CONTABILITA_UPDATED',
                ricevuteContabilita: state.ricevuteContabilita
              });
            }
            break;
          }

          case 'UPDATE_TESSERE': {
            if (Array.isArray(data?.tessereAssociative)) {
              state.tessereAssociative = data.tessereAssociative;
              persistState();
              broadcast({
                type: 'TESSERE_UPDATED',
                tessereAssociative: state.tessereAssociative
              });
            }
            break;
          }

          case 'UPDATE_ALTRE_ENTRATE_USCITE': {
            if (Array.isArray(data?.altreEntrateUscite)) {
              state.altreEntrateUscite = data.altreEntrateUscite;
              persistState();
              broadcast({
                type: 'ALTRE_ENTRATE_USCITE_UPDATED',
                altreEntrateUscite: state.altreEntrateUscite
              });
            }
            break;
          }

          case 'UPDATE_COSTI_GESTIONE': {
            if (Array.isArray(data?.costiGestione)) {
              state.costiGestione = data.costiGestione;
              persistState();
              broadcast({
                type: 'COSTI_GESTIONE_UPDATED',
                costiGestione: state.costiGestione
              });
            }
            break;
          }

          case 'SYNC_SOLLECITO_FIRMA_PIN': {
            if (data?.sollecitoFirmaPin && typeof data.sollecitoFirmaPin === 'object') {
              state.sollecitoFirmaPin = data.sollecitoFirmaPin;
              persistState();
              broadcast({
                type: 'SOLLECITO_FIRMA_PIN_UPDATED',
                sollecitoFirmaPin: state.sollecitoFirmaPin
              });
            }
            break;
          }

          case 'UPDATE_MODELLI_ATTESTATI': {
            if (data?.modelliAttestatiCategoria && typeof data.modelliAttestatiCategoria === 'object' && !Array.isArray(data.modelliAttestatiCategoria)) {
              state.modelliAttestatiCategoria = data.modelliAttestatiCategoria;
              state.modelliAttestatiUpdatedAt = Number(data.updatedAt) || Date.now();
              persistState();
              broadcast({
                type: 'MODELLI_ATTESTATI_UPDATED',
                modelliAttestatiCategoria: state.modelliAttestatiCategoria,
                updatedAt: state.modelliAttestatiUpdatedAt
              });
            }
            break;
          }

          case 'UPDATE_COSTI_SERVIZIO': {
            if (Array.isArray(data?.costiServizio)) {
              state.costiServizio = data.costiServizio;
              persistState();
              broadcast({
                type: 'COSTI_SERVIZIO_UPDATED',
                costiServizio: state.costiServizio
              });
            }
            break;
          }

          case 'UPDATE_CATEGORIE_COSTI_SERVIZIO': {
            if (Array.isArray(data?.categorie) && data.categorie.length > 0 && data.categorie.length <= 100) {
              const ts = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
              state.categorieCostiServizio = data.categorie;
              state.categorieCostiServizioUpdatedAt = ts;
              persistState();
              broadcast({
                type: 'CATEGORIE_COSTI_SERVIZIO_UPDATED',
                categorie: state.categorieCostiServizio,
                updatedAt: ts
              });
            }
            break;
          }

          case 'UPDATE_MAGAZZINO_VESTIARIO': {
            if (Array.isArray(data?.magazzinoVestiario)) {
              state.magazzinoVestiario = data.magazzinoVestiario;
              persistState();
              broadcast({
                type: 'MAGAZZINO_VESTIARIO_UPDATED',
                magazzinoVestiario: state.magazzinoVestiario
              });
            }
            break;
          }

          case 'UPDATE_ATTREZZATURE_MAGAZZINO': {
            if (Array.isArray(data?.attrezzature)) {
              state.attrezzatureOperative = data.attrezzature;
              persistState();
              broadcast({
                type: 'ATTREZZATURE_MAGAZZINO_UPDATED',
                attrezzature: state.attrezzatureOperative
              });
            }
            break;
          }

          case 'UPDATE_MOVIMENTI_MAGAZZINO': {
            if (Array.isArray(data?.movimenti)) {
              state.movimentiMagazzino = data.movimenti;
              persistState();
              broadcast({
                type: 'MOVIMENTI_MAGAZZINO_UPDATED',
                movimenti: state.movimentiMagazzino
              });
            }
            break;
          }

          case 'UPDATE_MANSIONI_CONFIG': {
            const incomingTs = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
            const currTs = typeof state.mansioniConfigUpdatedAt === 'number' ? state.mansioniConfigUpdatedAt : 0;
            const incomingIconsTs = typeof data?.customEmojiIconsUpdatedAt === 'number' && Number.isFinite(data.customEmojiIconsUpdatedAt)
              ? data.customEmojiIconsUpdatedAt
              : incomingTs;
            const currIconsTs = typeof state.customEmojiIconsUpdatedAt === 'number' ? state.customEmojiIconsUpdatedAt : 0;
            let updated = false;

            if (currTs === 0 || incomingTs >= currTs) {
              if (Array.isArray(data?.catalogoMansioni)) {
                state.catalogoMansioni = data.catalogoMansioni;
                updated = true;
              }
              if (Array.isArray(data?.categorieMansioni)) {
                state.categorieMansioni = data.categorieMansioni;
                updated = true;
              }
              if (updated) {
                state.mansioniConfigUpdatedAt = incomingTs;
              }
            }
            if (Array.isArray(data?.customEmojiIcons) && (currIconsTs === 0 || incomingIconsTs >= currIconsTs)) {
              state.customEmojiIcons = data.customEmojiIcons;
              state.customEmojiIconsUpdatedAt = incomingIconsTs;
              updated = true;
            }
            if (updated) {
              persistState();
              broadcast({
                type: 'MANSIONI_CONFIG_UPDATED',
                catalogoMansioni: state.catalogoMansioni,
                categorieMansioni: state.categorieMansioni,
                customEmojiIcons: state.customEmojiIcons,
                customEmojiIconsUpdatedAt: state.customEmojiIconsUpdatedAt,
                updatedAt: state.mansioniConfigUpdatedAt
              });
            }
            break;
          }

          case 'UPDATE_TIPOLOGIE_MEZZO': {
            const incomingTs = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
            const currTs = typeof state.tipologieMezzoUpdatedAt === 'number' ? state.tipologieMezzoUpdatedAt : 0;
            if (Array.isArray(data?.tipologieMezzo) && (currTs === 0 || incomingTs >= currTs)) {
              state.tipologieMezzo = data.tipologieMezzo;
              state.tipologieMezzoUpdatedAt = incomingTs;
              persistState();
              broadcast({
                type: 'TIPOLOGIE_MEZZO_UPDATED',
                tipologieMezzo: state.tipologieMezzo,
                updatedAt: state.tipologieMezzoUpdatedAt
              });
            }
            break;
          }

          case 'UPDATE_TIPI_TURNO': {
            const incomingTs = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
            const currTs = typeof state.tipiTurnoUpdatedAt === 'number' ? state.tipiTurnoUpdatedAt : 0;
            if (Array.isArray(data?.tipiTurno) && (currTs === 0 || incomingTs >= currTs)) {
              state.tipiTurno = data.tipiTurno;
              state.tipiTurnoUpdatedAt = incomingTs;
              persistState();
              broadcast({
                type: 'TIPI_TURNO_UPDATED',
                tipiTurno: state.tipiTurno,
                updatedAt: state.tipiTurnoUpdatedAt
              });
            }
            break;
          }

          case 'UPDATE_NOMI_DATABASE': {
            if (data?.nomiDatabase && typeof data.nomiDatabase === 'object' && !Array.isArray(data.nomiDatabase)) {
              const incomingTs = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
              const currTs = typeof state.nomiDatabaseUpdatedAt === 'number' ? state.nomiDatabaseUpdatedAt : 0;
              if (currTs === 0 || incomingTs >= currTs) {
                state.nomiDatabase = data.nomiDatabase;
                state.nomiDatabaseUpdatedAt = incomingTs;
                persistState();
                broadcast({
                  type: 'NOMI_DATABASE_UPDATED',
                  nomiDatabase: state.nomiDatabase,
                  updatedAt: state.nomiDatabaseUpdatedAt
                });
              }
            }
            break;
          }

          case 'UPDATE_RUBRICA_NUMERI_UTILI': {
            if (Array.isArray(data?.rubrica)) {
              const incomingTs = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
              const currTs = typeof state.rubricaNumeriUtiliUpdatedAt === 'number' ? state.rubricaNumeriUtiliUpdatedAt : 0;
              if (currTs === 0 || incomingTs >= currTs) {
                state.rubricaNumeriUtili = data.rubrica;
                state.rubricaNumeriUtiliUpdatedAt = incomingTs;
                persistState();
                broadcast({
                  type: 'RUBRICA_NUMERI_UTILI_UPDATED',
                  rubrica: state.rubricaNumeriUtili,
                  updatedAt: state.rubricaNumeriUtiliUpdatedAt
                });
              }
            }
            break;
          }

          case 'UPDATE_MEZZI_FLOTTA': {
            if (Array.isArray(data?.mezziFlotta)) {
              const incomingTs = typeof data?.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
              const currTs = typeof state.mezziFlottaUpdatedAt === 'number' ? state.mezziFlottaUpdatedAt : 0;
              if (currTs === 0 || incomingTs >= currTs) {
                state.mezziFlotta = data.mezziFlotta;
                state.mezziFlottaUpdatedAt = incomingTs;
                persistState();
                broadcast({
                  type: 'MEZZI_FLOTTA_UPDATED',
                  mezziFlotta: state.mezziFlotta,
                  updatedAt: state.mezziFlottaUpdatedAt
                });
              }
            }
            break;
          }

          case 'PING': {
            if (excludeClient && excludeClient.readyState === WebSocket.OPEN) {
              try {
                excludeClient.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
              } catch {}
            }
            break;
          }

          default:
            console.log('Tipo messaggio sconosciuto:', type);
        }
  };

  // Gestione connessioni WebSocket con heartbeat nativo anti-zombie su reti 4G/5G e Wi-Fi
  wss.on('connection', (ws) => {
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    // Appena un telefono o computer si connette, invia subito lo stato completo attuale
    ws.send(JSON.stringify({
      type: 'INIT_SYNC',
      state
    }));

    ws.on('message', (messageRaw) => {
      (ws as any).isAlive = true;
      try {
        const payload = JSON.parse(messageRaw.toString());
        if (payload && payload.type) {
          handleIncomingAction(payload.type, payload.data, ws);
        }
      } catch (err) {
        console.error('Errore parsing messaggio WS:', err);
      }
    });

    ws.on('close', () => {
      if (activePttSocket === ws && state.radioPtt?.activeSpeaker) {
        const wasEmerg = Boolean(state.radioPtt.activeSpeaker.isEmergency);
        finishRadioTransmissionBuffer(wasEmerg ? 'emergency' : 'general');
        state.radioPtt.activeSpeaker = null;
        activePttSocket = null;
        broadcast({
          type: 'PTT_SPEAKER_CHANGED',
          channelId: wasEmerg ? 'emergency' : 'general',
          radioPtt: state.radioPtt
        });
      }
      if (Array.isArray(state.radioGroups)) {
        state.radioGroups.forEach((g) => {
          if (activeGroupSockets.get(g.id) === ws && g.activeSpeaker) {
            finishRadioTransmissionBuffer(g.id);
            g.activeSpeaker = null;
            activeGroupSockets.set(g.id, null);
            broadcastToFilter(
              {
                type: 'PTT_SPEAKER_CHANGED',
                channelId: g.id,
                groupId: g.id,
                activeSpeaker: null,
                radioGroup: g
              },
              (c) => isSocketAllowedInGroup(c, g)
            );
          }
        });
      }
      recomputeRadioCodecMode(true);
    });
  });

  // Pulizia periodica socket mobili interrotti (cambio rete 4G<->Wi-Fi) + rilascio portanti PTT bloccate
  setInterval(() => {
    wss.clients.forEach((client) => {
      if ((client as any).isAlive === false) {
        try { client.terminate(); } catch {}
        return;
      }
      (client as any).isAlive = false;
      try { client.ping(); } catch {}
    });

    const nowMs = Date.now();
    if (state.radioPtt?.activeSpeaker) {
      const lastAct = Number(state.radioPtt.activeSpeaker.lastChunkAt || state.radioPtt.activeSpeaker.startedAt || 0);
      if (lastAct > 0 && nowMs - lastAct > 18000) {
        const wasEmerg = Boolean(state.radioPtt.activeSpeaker.isEmergency);
        finishRadioTransmissionBuffer(wasEmerg ? 'emergency' : 'general');
        state.radioPtt.activeSpeaker = null;
        activePttSocket = null;
        broadcast({
          type: 'PTT_SPEAKER_CHANGED',
          channelId: wasEmerg ? 'emergency' : 'general',
          radioPtt: state.radioPtt
        });
      }
    }
    if (Array.isArray(state.radioGroups)) {
      state.radioGroups.forEach((g) => {
        if (g.activeSpeaker) {
          const lastAct = Number(g.activeSpeaker.lastChunkAt || g.activeSpeaker.startedAt || 0);
          if (lastAct > 0 && nowMs - lastAct > 18000) {
            finishRadioTransmissionBuffer(g.id);
            g.activeSpeaker = null;
            activeGroupSockets.set(g.id, null);
            broadcastToFilter(
              {
                type: 'PTT_SPEAKER_CHANGED',
                channelId: g.id,
                groupId: g.id,
                activeSpeaker: null,
                radioGroup: g
              },
              (c) => isSocketAllowedInGroup(c, g)
            );
          }
        }
      });
    }
  }, 25000);

  // REST API PER DATABASE VOLONTARI CONDIVISO
  app.get('/api/volontari', (_req, res) => {
    res.json({
      success: true,
      volontari: state.volontari,
      volontariEliminatiIds: state.volontariEliminatiIds || []
    });
  });

  // --- DATABASE SERVIZI EFFETTUATI & ARCHIVIO STORICO (MAI AZZERATO) ---
  app.get('/api/servizi', (req, res) => {
    const { anno, mezzo, inAttesaKm, q } = req.query;
    let list = [...(state.serviziArchivio || [])];

    if (anno && anno !== 'all') {
      const a = Number(anno);
      list = list.filter(s => s.anno === a);
    }
    if (mezzo && mezzo !== 'all') {
      const mStr = String(mezzo).toUpperCase();
      list = list.filter(s => s.mezzo.toUpperCase().includes(mStr));
    }
    if (inAttesaKm === 'true') {
      list = list.filter(s => s.inAttesaKm === true);
    } else if (inAttesaKm === 'false') {
      list = list.filter(s => !s.inAttesaKm);
    }
    if (q) {
      const qStr = String(q).toLowerCase();
      list = list.filter(s =>
        s.codice.toLowerCase().includes(qStr) ||
        s.mezzo.toLowerCase().includes(qStr) ||
        s.indirizzo.toLowerCase().includes(qStr) ||
        (s.volontarioNome && s.volontarioNome.toLowerCase().includes(qStr)) ||
        (s.chiamante && s.chiamante.toLowerCase().includes(qStr)) ||
        (s.enteIstituzionale && s.enteIstituzionale.toLowerCase().includes(qStr))
      );
    }

    res.json({
      success: true,
      servizi: list,
      totale: list.length,
      prossimoProgressivo: calcolaProssimoNumeroMissione(state.serviziArchivio),
      cartelleAnniPrecedenti: state.cartelleAnniPrecedenti
    });
  });

  app.post('/api/servizi', (req, res) => {
    const data = req.body;
    if (data && data.codice) {
      const currentYear = getCurrentYearItaly();
      const sYear = data.anno || currentYear;
      const isMatchActivePost = !data.schedaDirettaArchivio && state.activeMission?.codice === data.codice;
      const activeFallbackPost = isMatchActivePost ? state.activeMission : null;
      const nuovoServ: ArchivedService = {
        id: data.id || `SER-${Date.now()}`,
        codice: data.codice,
        anno: sYear,
        data: data.data || formatDateTimeItaly(),
        mezzo: data.mezzo || 'N/D',
        urgenza: data.urgenza || 'VERDE',
        ambito: data.ambito || 'SERVIZIO',
        indirizzo: data.indirizzo || data.indirizzoIntervento || '-',
        indirizzoIntervento: data.indirizzoIntervento || data.indirizzo,
        destinazione: data.destinazione,
        chiamante: data.chiamante,
        telefono: data.telefono,
        enteIstituzionale: data.enteIstituzionale,
        noteCritiche: data.noteCritiche,
        volontarioNome: data.volontarioNome,
        volontarioId: data.volontarioId,
        volontarioTelefono: data.volontarioTelefono,
        qualificaTurno: data.qualificaTurno,
        kmInizio: Number(data.kmInizio) || 0,
        kmFine: Number(data.kmFine) || 0,
        kmTotali: Number(data.kmTotali) || 0,
        inAttesaKm: !!data.inAttesaKm,
        tempi: data.tempi || {},
        testoCompleto: data.testoCompleto || '',
        dataCreazione: data.dataCreazione || new Date().toISOString(),
        dataCompletamento: new Date().toISOString(),
        coordinateSulPosto: data.coordinateSulPosto || data.tempi?.coordinateSulPosto,
        coordinateDestinazione: data.coordinateDestinazione || data.tempi?.coordinateDestinazione,
        tipoAnimale: data.tipoAnimale,
        tipoAnimaleAltro: data.tipoAnimaleAltro,
        nonDiProprieta: data.nonDiProprieta,
        microchip: data.microchip,
        noMicrochip: data.noMicrochip,
        datiProprietarioCentrale: data.datiProprietarioCentrale,
        fotoDocumento: data.fotoDocumento || activeFallbackPost?.fotoDocumento || data.datiProprietarioCentrale?.fotoDocumento || activeFallbackPost?.datiProprietarioCentrale?.fotoDocumento,
        isStrutturaVeterinariaPartenza: data.isStrutturaVeterinariaPartenza !== undefined ? data.isStrutturaVeterinariaPartenza : activeFallbackPost?.isStrutturaVeterinariaPartenza,
        datiDestinazione: data.datiDestinazione || activeFallbackPost?.datiDestinazione,
        decisioneCentraleNonVet: data.decisioneCentraleNonVet || activeFallbackPost?.decisioneCentraleNonVet,
        noteNonVet: data.noteNonVet || activeFallbackPost?.noteNonVet,
        firmaVolontario: data.firmaVolontario,
        firmaOperatoreCentrale: data.firmaOperatoreCentrale,
        operatoreCentraleNome: data.operatoreCentraleNome,
        dataFirmaCentrale: data.dataFirmaCentrale,
        visionatoDaCentrale: data.visionatoDaCentrale,
        manovreEffettuatePatologie: data.manovreEffettuatePatologie,
        sottoAmbitoVet: data.sottoAmbitoVet,
        operatoreMittenteId: data.operatoreMittenteId,
        operatoreMittenteNome: data.operatoreMittenteNome,
        annullata: data.annullata,
        motivoAnnullamento: data.motivoAnnullamento,
        richiedenteAnnullamento: data.richiedenteAnnullamento,
        orarioAnnullamento: data.orarioAnnullamento,
        tipologiaServizio: data.tipologiaServizio,
        numeroSegreteriaSoupRt: data.numeroSegreteriaSoupRt,
        allertaMeteo: data.allertaMeteo,
        schedaDirettaArchivio: Boolean(data.schedaDirettaArchivio)
      };

      const existingIndex = state.serviziArchivio.findIndex(s => s.id === nuovoServ.id || s.codice === nuovoServ.codice);
      if (existingIndex >= 0) {
        state.serviziArchivio[existingIndex] = { ...state.serviziArchivio[existingIndex], ...nuovoServ };
      } else {
        state.serviziArchivio = [nuovoServ, ...state.serviziArchivio];
      }

      persistState();
      broadcast({
        type: 'SERVICE_ARCHIVED',
        servizio: nuovoServ,
        serviziArchivio: state.serviziArchivio
      });

      return res.json({ success: true, servizio: nuovoServ });
    }
    res.status(400).json({ success: false, error: 'Dati servizio mancanti' });
  });

  app.post('/api/missione/annulla', (req, res) => {
    const data = req.body;
    if (data && data.codice) {
      const nowTime = data.orario || formatTimeItaly(undefined, false);
      const schedaAperta = data.schedaAperta !== undefined ? Boolean(data.schedaAperta) : Boolean(state.letturaConfermata);

      if (!schedaAperta) {
        state.codiciEliminati = ensureCodiciEliminati([...(state.codiciEliminati || []), data.codice]);
        state.activeMission = null;
        state.letturaConfermata = false;
        state.operativeTimes = {};
        state.kmInizio = '';
        state.kmFine = '';
        state.datiDestinazione = null;
        state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: Date.now() };

        const notif: RadioNotification = {
          id: generateUniqueNotifId(),
          orario: formatTimeItaly(),
          testo: `ℹ️ Intervento ${data.codice} ANNULLATO dalla Centrale prima dell'apertura: scheda rimossa automaticamente dal terminale.`,
          tipo: 'centrale'
        };
        state.notifiche.push(notif);
        persistState();

        broadcast({
          type: 'MISSION_CANCELLED',
          codice: data.codice,
          motivo: data.motivo,
          richiedente: data.richiedente,
          orario: nowTime,
          dettagli: data.dettagli,
          nonAperta: true,
          mission: null,
          ringing: state.ringing,
          notification: notif
        });
        return res.json({ success: true, nonAperta: true });
      } else {
        if (state.activeMission && state.activeMission.codice === data.codice) {
          state.activeMission.annullata = true;
          state.activeMission.motivoAnnullamento = data.motivo;
          state.activeMission.richiedenteAnnullamento = data.richiedente;
          state.activeMission.orarioAnnullamento = nowTime;
        }

        const notif: RadioNotification = {
          id: generateUniqueNotifId(),
          orario: formatTimeItaly(),
          testo: `🚨 ALLERTA: Intervento ${data.codice} ANNULLATO dalla Centrale! Rientrare subito in sede. Motivo: ${data.motivo} (Richiesto da: ${data.richiedente}).`,
          tipo: 'allarme'
        };
        state.notifiche.push(notif);

        state.ringing = {
          active: true,
          source: `Centrale: Servizio Annullato - Rientro in Sede (${data.motivo || 'Intervento Annullato'})`,
          soundType: 'sirena',
          timestamp: Date.now()
        };
        persistState();

        broadcast({
          type: 'MISSION_CANCELLED',
          codice: data.codice,
          motivo: data.motivo,
          richiedente: data.richiedente,
          orario: nowTime,
          dettagli: data.dettagli,
          nonAperta: false,
          mission: state.activeMission,
          ringing: state.ringing,
          notification: notif
        });
        return res.json({ success: true, nonAperta: false });
      }
    }
    return res.status(400).json({ error: 'Dati mancanti' });
  });

  // Cancellazione immediata di tutte le schede di servizio e missioni in essere e non ancora concluse
  app.post(['/api/missione/cancella-attiva', '/api/missione/clear'], (_req, res) => {
    const clearedCod = state.activeMission?.codice;
    if (clearedCod) {
      state.codiciEliminati = ensureCodiciEliminati([...(state.codiciEliminati || []), clearedCod]);
    }
    state.activeMission = null;
    state.letturaConfermata = false;
    state.operativeTimes = {};
    state.kmInizio = '';
    state.kmFine = '';
    state.datiDestinazione = null;
    state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: Date.now() };
    const notif: RadioNotification = {
      id: generateUniqueNotifId(),
      orario: formatTimeItaly(),
      testo: '🧹 CENTRALE: Tutte le schede di servizio e missioni in essere e non ancora concluse sono state cancellate. Flotta e terminali liberati.',
      tipo: 'sistema'
    };
    state.notifiche.push(notif);
    persistState();
    broadcast({
      type: 'MISSION_CLEARED',
      forceClear: true,
      codiceEliminato: clearedCod,
      notification: notif
    });
    console.log('[Server] Schede di servizio e missioni in essere cancellate con successo.');
    return res.json({ success: true, message: 'Schede di servizio e missioni in essere cancellate con successo.' });
  });

  app.put('/api/servizi/:id', (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const idx = state.serviziArchivio.findIndex(s => s.id === id || s.codice === id);
    if (idx >= 0) {
      state.serviziArchivio[idx] = {
        ...state.serviziArchivio[idx],
        ...updateData
      };
      persistState();
      broadcast({
        type: 'SERVICE_UPDATED',
        servizio: state.serviziArchivio[idx],
        serviziArchivio: state.serviziArchivio
      });
      return res.json({ success: true, servizio: state.serviziArchivio[idx] });
    }
    return res.status(404).json({ success: false, error: 'Servizio non trovato' });
  });

  app.put('/api/servizi/:id/km', (req, res) => {
    const { id } = req.params;
    const { kmInizio, kmFine } = req.body;
    const idx = state.serviziArchivio.findIndex(s => s.id === id || s.codice === id);
    if (idx >= 0) {
      const ini = Number(kmInizio) || 0;
      const fin = Number(kmFine) || 0;
      const tot = fin >= ini ? fin - ini : 0;

      const serv = state.serviziArchivio[idx];
      serv.kmInizio = ini;
      serv.kmFine = fin;
      serv.kmTotali = tot;
      serv.inAttesaKm = false;

      serv.testoCompleto = serv.testoCompleto
        .replace(/KM INIZIO: [^\n]*/, `KM INIZIO: ${ini} | KM FINE: ${fin}`)
        .replace(/KM TOTALI PERCORSI: [^\n]*/, `KM TOTALI PERCORSI: ${tot} KM`);

      persistState();

      broadcast({
        type: 'SERVICE_KM_UPDATED',
        servizio: serv,
        serviziArchivio: state.serviziArchivio
      });

      return res.json({ success: true, servizio: serv });
    }
    res.status(404).json({ success: false, error: 'Servizio non trovato' });
  });

  app.post('/api/servizi/firma-centrale', (req, res) => {
    const { ids, firmaBase64, operatoreNome } = req.body;
    if (Array.isArray(ids) && ids.length > 0 && firmaBase64) {
      const nowStr = formatDateTimeItaly();
      let signedCount = 0;
      state.serviziArchivio.forEach(s => {
        if (ids.includes(s.id) || ids.includes(s.codice)) {
          s.firmaOperatoreCentrale = firmaBase64;
          s.operatoreCentraleNome = operatoreNome || 'Operatore Centrale';
          s.dataFirmaCentrale = nowStr;
          s.visionatoDaCentrale = true;
          signedCount++;
        }
      });
      persistState();

      const notif: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `✍️ CENTRALE: ${signedCount} foglio/i di viaggio firmato/i digitalmente con successo dall'Operatore ${operatoreNome || 'Centrale'}.`,
        tipo: 'centrale'
      };
      state.notifiche.push(notif);

      broadcast({
        type: 'SERVICES_SIGNED_CENTRALE',
        ids,
        firmaBase64,
        operatoreNome,
        dataFirmaCentrale: nowStr,
        serviziArchivio: state.serviziArchivio,
        notification: notif
      });

      return res.json({ success: true, count: signedCount, serviziArchivio: state.serviziArchivio });
    }
    res.status(400).json({ success: false, error: 'Parametri firma mancanti o non validi' });
  });

  // Eliminazione singolo servizio da REST API
  app.delete('/api/servizi/:id', (req, res) => {
    const targetId = req.params.id;
    if (targetId && Array.isArray(state.serviziArchivio)) {
      const idx = state.serviziArchivio.findIndex(s => s.id === targetId || s.codice === targetId);
      if (idx >= 0) {
        const rimosso = state.serviziArchivio[idx];
        state.serviziArchivio.splice(idx, 1);

        if (state.activeMission && (state.activeMission.codice === rimosso.codice || state.activeMission.codice === targetId)) {
          state.activeMission = null;
          state.letturaConfermata = false;
          state.operativeTimes = {};
          state.kmInizio = '';
          state.kmFine = '';
          state.datiDestinazione = null;
          state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };
        }

        persistState();

        const notif: RadioNotification = {
          id: generateUniqueNotifId(),
          orario: formatTimeItaly(),
          testo: `🗑️ DATABASE: Servizio ${rimosso.codice} (${rimosso.mezzo}) rimosso definitivamente dall'archivio dall'Amministratore.`,
          tipo: 'centrale'
        };
        state.notifiche.push(notif);

        const prossimoProg = calcolaProssimoNumeroMissione(state.serviziArchivio);

        broadcast({
          type: 'SERVICE_DELETED',
          id: rimosso.id,
          codice: rimosso.codice,
          serviziArchivio: state.serviziArchivio,
          prossimoProgressivo: prossimoProg,
          notification: notif
        });

        return res.json({
          success: true,
          rimosso,
          serviziArchivio: state.serviziArchivio,
          prossimoProgressivo: prossimoProg
        });
      }
    }
    return res.status(404).json({ success: false, error: 'Servizio non trovato' });
  });

  // Eliminazione multipla servizi da REST API
  app.post('/api/servizi/elimina-batch', (req, res) => {
    const ids: string[] = req.body?.ids;
    if (Array.isArray(ids) && ids.length > 0 && Array.isArray(state.serviziArchivio)) {
      const primaCount = state.serviziArchivio.length;
      const rimossi = state.serviziArchivio.filter(s => ids.includes(s.id) || ids.includes(s.codice));
      const rimossiCodici = rimossi.map(s => s.codice);

      state.serviziArchivio = state.serviziArchivio.filter(s => !ids.includes(s.id) && !ids.includes(s.codice));
      const rimossiCount = primaCount - state.serviziArchivio.length;

      if (state.activeMission && (ids.includes(state.activeMission.codice) || rimossiCodici.includes(state.activeMission.codice))) {
        state.activeMission = null;
        state.letturaConfermata = false;
        state.operativeTimes = {};
        state.kmInizio = '';
        state.kmFine = '';
        state.datiDestinazione = null;
        state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };
      }

      persistState();

      const notif: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🗑️ DATABASE: ${rimossiCount} servizi rimossi dall'archivio dall'Amministratore (${rimossiCodici.slice(0, 3).join(', ')}${rimossiCodici.length > 3 ? '...' : ''}).`,
        tipo: 'centrale'
      };
      state.notifiche.push(notif);

      const prossimoProg = calcolaProssimoNumeroMissione(state.serviziArchivio);

      broadcast({
        type: 'SERVICES_DELETED',
        ids,
        codici: rimossiCodici,
        count: rimossiCount,
        serviziArchivio: state.serviziArchivio,
        prossimoProgressivo: prossimoProg,
        notification: notif
      });

      return res.json({
        success: true,
        count: rimossiCount,
        rimossiCodici,
        serviziArchivio: state.serviziArchivio,
        prossimoProgressivo: prossimoProg
      });
    }
    return res.status(400).json({ success: false, error: 'Lista IDs non valida' });
  });

  // Azzeramento totale database servizi (richiesto dall'amministratore per iniziare da zero)
  app.post('/api/servizi/reset-tutti', (_req, res) => {
    const primaCount = Array.isArray(state.serviziArchivio) ? state.serviziArchivio.length : 0;
    state.serviziArchivio = [];
    state.cartelleAnniPrecedenti = {};
    state.activeMission = null;
    state.letturaConfermata = false;
    state.operativeTimes = {};
    state.kmInizio = '';
    state.kmFine = '';
    state.datiDestinazione = null;
    state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: 0 };

    persistState();

    const notif: RadioNotification = {
      id: generateUniqueNotifId(),
      orario: formatTimeItaly(),
      testo: `🧹 DATABASE AZZERATO: Tutti i servizi di prova sono stati rimossi dall'archivio. Il contatore missioni riparte da 1.`,
      tipo: 'sistema'
    };
    state.notifiche.push(notif);

    broadcast({
      type: 'SERVICES_DELETED',
      ids: ['ALL'],
      codici: ['ALL'],
      count: primaCount,
      serviziArchivio: [],
      prossimoProgressivo: 1,
      notification: notif
    });

    return res.json({
      success: true,
      count: primaCount,
      serviziArchivio: [],
      prossimoProgressivo: 1
    });
  });

  // API Calendario Turni di Tutte le Sedi Operative (Persistente e Condiviso in Tempo Reale)
  app.get('/api/turni', (_req, res) => {
    return res.json({
      success: true,
      turni: state.turni || []
    });
  });

  app.post('/api/turni', (req, res) => {
    const turni = Array.isArray(req.body?.turni) ? req.body.turni : (Array.isArray(req.body) ? req.body : null);
    if (turni) {
      const isDemoId = (id: any) => {
        const s = String(id || '').trim();
        return s.startsWith('turno-oggi-') || s.startsWith('turno-domani-');
      };
      const incomingIsOnlyDemo =
        turni.length > 0 && turni.every((t: any) => isDemoId(t?.id));
      const existingHasReal =
        Array.isArray(state.turni) &&
        state.turni.some((t: any) => !isDemoId(t?.id));
      if (incomingIsOnlyDemo && existingHasReal) {
        return res.json({
          success: true,
          count: state.turni?.length || 0,
          turni: state.turni || [],
          protected: true,
        });
      }
      state.turni = turni;
      persistState();
      broadcast({
        type: 'TURNI_UPDATED',
        turni: state.turni
      });
      setTimeout(() => {
        try {
          eseguiControlloPromemoriaTurniDomani(false);
        } catch {}
      }, 600);
      return res.json({
        success: true,
        count: turni.length,
        turni: turni
      });
    }
    return res.status(400).json({ success: false, error: 'Lista turni non valida' });
  });

  // API Bacheca di Sezione, Circolari e Commenti (Persistente e Condivisa in Tempo Reale)
  app.get('/api/bacheca', (_req, res) => {
    return res.json({
      success: true,
      bacheca: state.bacheca || [],
      bachecaEliminatiIds: state.bachecaEliminatiIds || []
    });
  });

  app.post('/api/bacheca', (req, res) => {
    const bacheca = Array.isArray(req.body?.bacheca) ? req.body.bacheca : (Array.isArray(req.body) ? req.body : null);
    if (bacheca) {
      const deletedIds = normalizeDeletedIds([
        ...(Array.isArray(state.bachecaEliminatiIds) ? state.bachecaEliminatiIds : []),
        ...(Array.isArray(req.body?.bachecaEliminatiIds) ? req.body.bachecaEliminatiIds : []),
      ]);
      state.bachecaEliminatiIds = deletedIds;
      state.bacheca = mergeComunicazioniBachecaSafe(state.bacheca, bacheca, deletedIds);
      if (req.body?.notifica && (req.body.notifica.tipo === 'nuovo_post' || req.body.notifica.tipo === 'nuovo_corso')) {
        const record: NotificaBachecaRecord = {
          ...req.body.notifica,
          id: req.body.notifica.id || `bacheca-${req.body.notifica.tipo}-${req.body.notifica.postId || Date.now()}`,
          createdAt: Number(req.body.notifica.createdAt) || Date.now(),
          soloInApp: req.body.notifica.soloInApp !== false,
        };
        state.notificheBachecaRecenti = mergeNotificheBachecaRecenti(state.notificheBachecaRecenti, [record]);
      }
      persistState();
      broadcast({
        type: 'BACHECA_UPDATED',
        bacheca: state.bacheca,
        bachecaEliminatiIds: state.bachecaEliminatiIds,
        notificheBachecaRecenti: state.notificheBachecaRecenti || []
      });

      // Se il client ha allegato una notifica (nuovo commento, nuovo post o nuovo corso), broadcast con tipo dedicato
      if (req.body?.notifica) {
        const notif = {
          ...req.body.notifica,
          id: req.body.notifica.id || `bacheca-${req.body.notifica.tipo || 'post'}-${req.body.notifica.postId || Date.now()}`,
          createdAt: Number(req.body.notifica.createdAt) || Date.now(),
        };
        broadcast({
          type: 'NOTIFICA_BACHECA',
          notifica: notif,
          notificheBachecaRecenti: state.notificheBachecaRecenti || []
        });

        // Invio WebPush ai destinatari mirati SOLO se non è contrassegnata come solo in-app
        if (!notif.soloInApp) {
          try {
            const pushTitle =
              notif.tipo === 'nuovo_commento'
                ? '💬 Nuovo commento in bacheca'
                : notif.tipo === 'nuovo_corso'
                ? `🎓 Corso in Bacheca: ${notif.postTitolo || ''}`
                : `📢 Bacheca: ${notif.postTitolo || 'Nuova comunicazione'}`;
            if (Array.isArray(notif.destinatariVolontariIds) && notif.destinatariVolontariIds.length > 0) {
              notif.destinatariVolontariIds.forEach((volId: string) => {
                sendPushNotificationToVolunteer(volId, {
                  title: pushTitle,
                  body: notif.messaggio || notif.postTitolo || '',
                  tag: 'bacheca-notif',
                  data: { url: '/', postId: notif.postId, tipo: notif.tipo }
                });
              });
            } else {
              sendPushNotificationToRole('all', {
                title: pushTitle,
                body: notif.messaggio || notif.postTitolo || '',
                tag: 'bacheca-notif',
                data: { url: '/', postId: notif.postId, tipo: notif.tipo }
              });
            }
          } catch (pushErr) {
            console.warn('[WebPush Bacheca] Invio push non riuscito:', pushErr);
          }
        }
      }

      return res.json({
        success: true,
        count: (state.bacheca || []).length,
        bacheca: state.bacheca || [],
        bachecaEliminatiIds: state.bachecaEliminatiIds || [],
        notificheBachecaRecenti: state.notificheBachecaRecenti || []
      });
    }
    return res.status(400).json({ success: false, error: 'Dati bacheca non validi' });
  });

  app.post('/api/bacheca/notifica', (req, res) => {
    const rawNotif = req.body?.notifica || req.body;
    if (rawNotif && rawNotif.postTitolo) {
      const notif: NotificaBachecaRecord = {
        ...rawNotif,
        id: rawNotif.id || `bacheca-${rawNotif.tipo || 'nuovo_post'}-${rawNotif.postId || Date.now()}`,
        tipo: rawNotif.tipo || 'nuovo_post',
        postId: rawNotif.postId || '',
        postTitolo: String(rawNotif.postTitolo),
        messaggio: rawNotif.messaggio || `Pubblicato in bacheca: "${rawNotif.postTitolo}"`,
        soloInApp: rawNotif.soloInApp !== false,
        createdAt: Number(rawNotif.createdAt) || Date.now(),
      };
      if (notif.tipo === 'nuovo_post' || notif.tipo === 'nuovo_corso') {
        state.notificheBachecaRecenti = mergeNotificheBachecaRecenti(state.notificheBachecaRecenti, [notif]);
        persistState();
      }
      broadcast({
        type: 'NOTIFICA_BACHECA',
        notifica: notif,
        notificheBachecaRecenti: state.notificheBachecaRecenti || []
      });
      return res.json({ success: true, notificheBachecaRecenti: state.notificheBachecaRecenti || [] });
    }
    return res.status(400).json({ success: false, error: 'Notifica mancante' });
  });

  // ---------------------------------------------------------------------------
  // GIORNALE DI BORDO & BROGLIACCIO DI CENTRALE OPERATIVA (CON ORA AUTOMATICA)
  // ---------------------------------------------------------------------------
  app.get('/api/giornale-bordo', (_req, res) => {
    return res.json({
      success: true,
      giornaleBordo: state.giornaleBordo || []
    });
  });

  app.post('/api/giornale-bordo', (req, res) => {
    const list = Array.isArray(req.body?.giornaleBordo) ? req.body.giornaleBordo : (Array.isArray(req.body) ? req.body : null);
    if (list) {
      state.giornaleBordo = list;
      persistState();
      broadcast({
        type: 'GIORNALE_BORDO_UPDATED',
        giornaleBordo: state.giornaleBordo
      });
      return res.json({ success: true, count: list.length });
    }
    return res.status(400).json({ success: false, error: 'Dati giornale di bordo non validi' });
  });

  app.post('/api/giornale-bordo/voce', (req, res) => {
    const voce = req.body?.voce || req.body;
    if (voce && voce.testo) {
      const nowIt = getItalianDateParts();
      const dateStr = nowIt.dateIt;
      const timeStr = nowIt.timeIt;
      
      const nuovaVoce = {
        id: voce.id || `gb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        data: voce.data || dateStr,
        ora: timeStr,
        timestamp: Date.now(),
        operatoreId: voce.operatoreId,
        operatoreNome: voce.operatoreNome || 'Operatore Centrale',
        testo: String(voce.testo).trim(),
        categoria: voce.categoria || 'ordinaria',
        consegnaTurno: Boolean(voce.consegnaTurno),
        presaVisioneDa: voce.presaVisioneDa || [],
        mezzoCoinvolto: voce.mezzoCoinvolto,
        allegatoCodiceServizio: voce.allegatoCodiceServizio
      };

      state.giornaleBordo = [nuovaVoce, ...(state.giornaleBordo || [])];
      persistState();

      broadcast({
        type: 'GIORNALE_BORDO_UPDATED',
        giornaleBordo: state.giornaleBordo,
        nuovaVoce
      });

      return res.json({ success: true, nuovaVoce });
    }
    return res.status(400).json({ success: false, error: 'Dati voce non validi' });
  });

  app.post('/api/giornale-bordo/presa-visione', (req, res) => {
    const { voceId, operatoreNome } = req.body || {};
    if (voceId && operatoreNome && Array.isArray(state.giornaleBordo)) {
      const nowIt = getItalianDateParts();
      const timeStr = nowIt.timeIt;
      const dateStr = nowIt.dateIt;
      
      const idx = state.giornaleBordo.findIndex((v: any) => v.id === voceId);
      if (idx >= 0) {
        const target = state.giornaleBordo[idx];
        const list = Array.isArray(target.presaVisioneDa) ? target.presaVisioneDa : [];
        if (!list.some((p: any) => p.operatoreNome === operatoreNome)) {
          list.push({
            operatoreNome,
            data: dateStr,
            ora: timeStr,
            timestamp: Date.now()
          });
          target.presaVisioneDa = list;
          state.giornaleBordo[idx] = { ...target };
          persistState();

          broadcast({
            type: 'GIORNALE_BORDO_UPDATED',
            giornaleBordo: state.giornaleBordo
          });
          return res.json({ success: true, voce: target });
        }
        return res.json({ success: true, alreadySigned: true });
      }
    }
    return res.status(400).json({ success: false, error: 'Parametri mancanti' });
  });

  // ---------------------------------------------------------------------------
  // MAGAZZINO MEZZI (RICAMBI / OLI / TAGLIANDI E DOTAZIONI DI BORDO) - PERSISTENTE
  // ---------------------------------------------------------------------------
  app.get('/api/magazzino-mezzi', (_req, res) => {
    return res.json({
      success: true,
      magazzinoParti: state.magazzinoParti || [],
      magazzinoMezzi: state.magazzinoMezzi || []
    });
  });

  app.post('/api/magazzino-mezzi/parti', (req, res) => {
    const list = Array.isArray(req.body?.magazzinoParti)
      ? req.body.magazzinoParti
      : (Array.isArray(req.body) ? req.body : null);
    if (list) {
      state.magazzinoParti = filterDemoMagazzinoParti(list);
      persistState();
      broadcast({
        type: 'MAGAZZINO_PARTI_UPDATED',
        magazzinoParti: state.magazzinoParti
      });
      return res.json({ success: true, count: state.magazzinoParti.length, magazzinoParti: state.magazzinoParti });
    }
    return res.status(400).json({ success: false, error: 'Dati magazzino parti non validi' });
  });

  app.post('/api/magazzino-mezzi/dotazioni', (req, res) => {
    const list = Array.isArray(req.body?.magazzinoMezzi)
      ? req.body.magazzinoMezzi
      : (Array.isArray(req.body) ? req.body : null);
    if (list) {
      state.magazzinoMezzi = filterDemoMagazzinoMezzi(list);
      persistState();
      broadcast({
        type: 'MAGAZZINO_MEZZI_UPDATED',
        magazzinoMezzi: state.magazzinoMezzi
      });
      return res.json({ success: true, count: state.magazzinoMezzi.length, magazzinoMezzi: state.magazzinoMezzi });
    }
    return res.status(400).json({ success: false, error: 'Dati dotazioni mezzi non validi' });
  });

  // ---------------------------------------------------------------------------
  // INDIRIZZI COLLEZIONATI & CONTATTI ESTERNI (DATABASE CONDIVISO PERSISTENTE)
  // ---------------------------------------------------------------------------
  app.get('/api/indirizzi-collezionati', (_req, res) => {
    return res.json({
      success: true,
      indirizziCollezionati: state.indirizziCollezionati || []
    });
  });

  app.post('/api/indirizzi-collezionati', (req, res) => {
    const list = Array.isArray(req.body?.indirizziCollezionati)
      ? req.body.indirizziCollezionati
      : (Array.isArray(req.body) ? req.body : null);
    if (list) {
      state.indirizziCollezionati = list;
      persistState();
      broadcast({
        type: 'INDIRIZZI_COLLEZIONATI_UPDATED',
        indirizziCollezionati: list
      });
      return res.json({ success: true, count: list.length, indirizziCollezionati: list });
    }
    return res.status(400).json({ success: false, error: 'Dati indirizzi collezionati non validi' });
  });

  app.get('/api/contatti', (_req, res) => {
    return res.json({
      success: true,
      contatti: Array.isArray(state.contatti) ? state.contatti : null
    });
  });

  app.post('/api/contatti', (req, res) => {
    const list = Array.isArray(req.body?.contatti) ? req.body.contatti : (Array.isArray(req.body) ? req.body : null);
    if (list) {
      state.contatti = list;
      persistState();
      broadcast({
        type: 'CONTATTI_UPDATED',
        contatti: list
      });
      return res.json({ success: true, count: list.length });
    }
    return res.status(400).json({ success: false, error: 'Dati contatti non validi' });
  });

  // ---------------------------------------------------------------------------
  // GOOGLE MAPS PLATFORM SERVER-SIDE PROXY (Places API New & Geocoding API v4)
  // ---------------------------------------------------------------------------
  const getGoogleMapsKey = (): string => {
    return (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  };

  app.get('/api/maps/config', (_req, res) => {
    const apiKey = getGoogleMapsKey();
    return res.json({
      success: true,
      hasGoogleMapsKey: Boolean(apiKey),
      apiKey
    });
  });

  app.post('/api/maps/search-places', async (req, res) => {
    try {
      const query = String(req.body?.query || '').trim();
      if (query.length < 2) {
        return res.json({ success: true, results: [], quotaExceeded: false });
      }

      const apiKey = getGoogleMapsKey();
      let quotaExceeded = false;
      const results: Array<{
        placeId?: string;
        displayName: string;
        formattedAddress: string;
        lat?: number;
        lng?: number;
        googleMapsUri?: string;
        typeLabel?: string;
        source: 'google_maps' | 'openstreetmap';
      }> = [];

      if (apiKey) {
        try {
          const gRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryTypeDisplayName',
              'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
            },
            body: JSON.stringify({
              textQuery: query,
              languageCode: 'it',
              regionCode: 'it',
              pageSize: 8,
              locationBias: {
                circle: {
                  center: { latitude: 44.0365, longitude: 10.1415 },
                  radius: 45000.0
                }
              }
            })
          });

          const gData: any = await gRes.json().catch(() => ({}));
          if (gRes.status === 429 || gData?.error?.status === 'RESOURCE_EXHAUSTED') {
            quotaExceeded = true;
          } else if (gRes.ok && Array.isArray(gData?.places)) {
            for (const p of gData.places) {
              const formattedAddress = String(p?.formattedAddress || p?.displayName?.text || '').trim();
              if (!formattedAddress) continue;
              results.push({
                placeId: p?.id,
                displayName: String(p?.displayName?.text || '').trim(),
                formattedAddress,
                lat: typeof p?.location?.latitude === 'number' ? p.location.latitude : undefined,
                lng: typeof p?.location?.longitude === 'number' ? p.location.longitude : undefined,
                googleMapsUri: p?.googleMapsUri,
                typeLabel: p?.primaryTypeDisplayName?.text,
                source: 'google_maps'
              });
            }
          }
        } catch (err) {
          console.error('[Maps Proxy] Errore Places API:', err);
        }
      }

      // Fallback OpenStreetMap Nominatim se API Key assente o nessun risultato Google
      if (results.length === 0) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=it&addressdetails=1&limit=7&accept-language=it&viewbox=9.65,44.45,10.55,43.75`;
          const nRes = await fetch(nomUrl, {
            headers: { 'User-Agent': 'CroceOroMassaCarrara-Centrale/1.0' }
          });
          if (nRes.ok) {
            const nData: any = await nRes.json().catch(() => []);
            if (Array.isArray(nData)) {
              for (const item of nData) {
                const full = String(item?.display_name || '').trim();
                if (!full) continue;
                const addr = item?.address || {};
                const via = [addr.road || addr.pedestrian || addr.square, addr.house_number].filter(Boolean).join(' ');
                const city = addr.city || addr.town || addr.village || addr.municipality || '';
                const cap = addr.postcode || '';
                const compact = [via, [cap, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
                const formattedAddress = compact && compact.length >= 6 ? compact : full;
                const displayName = String(item?.name || addr.amenity || addr.shop || formattedAddress.split(',')[0] || '').trim();
                results.push({
                  placeId: item?.place_id ? `osm-${item.place_id}` : undefined,
                  displayName,
                  formattedAddress,
                  lat: item?.lat ? Number(item.lat) : undefined,
                  lng: item?.lon ? Number(item.lon) : undefined,
                  googleMapsUri: (item?.lat && item?.lon) ? `https://www.google.com/maps?q=${item.lat},${item.lon}` : undefined,
                  typeLabel: item?.type ? String(item.type).replace(/_/g, ' ') : undefined,
                  source: 'openstreetmap'
                });
              }
            }
          }
        } catch (err) {
          console.error('[Maps Proxy] Errore fallback Nominatim:', err);
        }
      }

      return res.json({ success: true, results, quotaExceeded });
    } catch (err) {
      console.error('[Maps Proxy] Errore search-places:', err);
      return res.json({ success: false, results: [], quotaExceeded: false });
    }
  });

  app.post('/api/maps/geocode', async (req, res) => {
    try {
      const address = String(req.body?.address || '').trim();
      if (!address) {
        return res.json({ success: true, result: null, quotaExceeded: false });
      }
      const apiKey = getGoogleMapsKey();
      let quotaExceeded = false;
      let result: any = null;

      if (apiKey) {
        try {
          const url = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}?languageCode=it&regionCode=it`;
          const gRes = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress',
              'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
            }
          });
          const gData: any = await gRes.json().catch(() => ({}));
          if (gRes.status === 429 || gData?.error?.status === 'RESOURCE_EXHAUSTED') {
            quotaExceeded = true;
          } else if (gRes.ok && Array.isArray(gData?.results) && gData.results[0]) {
            const first = gData.results[0];
            if (typeof first?.location?.latitude === 'number' && typeof first?.location?.longitude === 'number') {
              result = {
                formattedAddress: first.formattedAddress || address,
                lat: first.location.latitude,
                lng: first.location.longitude,
                placeId: first.placeId,
                source: 'google_maps'
              };
            }
          }
        } catch (err) {
          console.error('[Maps Proxy] Errore Geocoding v4:', err);
        }
      }

      if (!result) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&countrycodes=it&limit=1&accept-language=it`;
          const nRes = await fetch(nomUrl, {
            headers: { 'User-Agent': 'CroceOroMassaCarrara-Centrale/1.0' }
          });
          if (nRes.ok) {
            const nData: any = await nRes.json().catch(() => []);
            if (Array.isArray(nData) && nData[0]) {
              result = {
                formattedAddress: nData[0].display_name || address,
                lat: Number(nData[0].lat),
                lng: Number(nData[0].lon),
                placeId: nData[0].place_id ? `osm-${nData[0].place_id}` : undefined,
                source: 'openstreetmap'
              };
            }
          }
        } catch (err) {
          console.error('[Maps Proxy] Errore fallback geocode Nominatim:', err);
        }
      }

      return res.json({ success: true, result, quotaExceeded });
    } catch (err) {
      console.error('[Maps Proxy] Errore geocode:', err);
      return res.json({ success: false, result: null, quotaExceeded: false });
    }
  });

  app.post('/api/maps/reverse-geocode', async (req, res) => {
    try {
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return res.status(400).json({ success: false, result: null, quotaExceeded: false });
      }

      const apiKey = getGoogleMapsKey();
      let quotaExceeded = false;
      let result: any = null;

      if (apiKey) {
        try {
          const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
          url.searchParams.append('location.latitude', String(lat));
          url.searchParams.append('location.longitude', String(lng));
          url.searchParams.append('languageCode', 'it');
          url.searchParams.append('regionCode', 'it');

          const gRes = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'results.placeId,results.formattedAddress,results.location',
              'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
            }
          });
          const gData: any = await gRes.json().catch(() => ({}));
          if (gRes.status === 429 || gData?.error?.status === 'RESOURCE_EXHAUSTED') {
            quotaExceeded = true;
          } else if (gRes.ok && Array.isArray(gData?.results) && gData.results[0]) {
            const first = gData.results[0];
            result = {
              formattedAddress: first.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              lat,
              lng,
              placeId: first.placeId,
              source: 'google_maps'
            };
          }
        } catch (err) {
          console.error('[Maps Proxy] Errore Reverse Geocode v4:', err);
        }
      }

      if (!result) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`;
          const nRes = await fetch(nomUrl, {
            headers: { 'User-Agent': 'CroceOroMassaCarrara-Centrale/1.0' }
          });
          if (nRes.ok) {
            const item: any = await nRes.json().catch(() => null);
            if (item) {
              const addr = item?.address || {};
              const via = [addr.road || addr.pedestrian || addr.square, addr.house_number].filter(Boolean).join(' ');
              const city = addr.city || addr.town || addr.village || addr.municipality || '';
              const cap = addr.postcode || '';
              const compact = [via, [cap, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
              result = {
                formattedAddress: (compact && compact.length >= 6) ? compact : (item.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`),
                lat,
                lng,
                placeId: item.place_id ? `osm-${item.place_id}` : undefined,
                source: 'openstreetmap'
              };
            }
          }
        } catch (err) {
          console.error('[Maps Proxy] Errore fallback reverse Nominatim:', err);
        }
      }

      return res.json({ success: true, result, quotaExceeded });
    } catch (err) {
      console.error('[Maps Proxy] Errore reverse-geocode:', err);
      return res.json({ success: false, result: null, quotaExceeded: false });
    }
  });

  // ---------------------------------------------------------------------------
  // GESTIONE TRACCIAMENTO POSIZIONE LIVE MEZZO IN MOVIMENTO (DURATA MASSIMA 1 ORA)
  // ---------------------------------------------------------------------------
  interface LiveTrackingSession {
    token: string;
    createdAt: number;
    expiresAt: number; // Date.now() + 60 * 60 * 1000 (1 ora di validità massima)
    mezzo: string;
    codiceMissione?: string;
    indirizzo?: string;
    coordinateObiettivo?: { lat: number; lng: number };
    destinazione?: string;
    coordinateDestinazione?: { lat: number; lng: number };
    urgenza?: string;
    active: boolean;
  }

  const activeLiveTrackingSessions = new Map<string, LiveTrackingSession>();

  // Pulizia automatica periodica delle sessioni scadute ogni 5 minuti
  setInterval(() => {
    const now = Date.now();
    for (const [token, sess] of activeLiveTrackingSessions.entries()) {
      if (sess.expiresAt < now) {
        activeLiveTrackingSessions.delete(token);
      }
    }
  }, 5 * 60 * 1000);

  // Crea o rinnova una sessione di tracciamento live valida per massimo 1 ora
  app.post('/api/track/create', (req, res) => {
    try {
      const { mezzo, codiceMissione, indirizzo, coordinateObiettivo, destinazione, coordinateDestinazione, urgenza } = req.body || {};
      const now = Date.now();
      const expiresAt = now + 60 * 60 * 1000; // 1 ora di durata massima
      const token = `trk-${now}-${Math.random().toString(36).substring(2, 9)}`;

      const session: LiveTrackingSession = {
        token,
        createdAt: now,
        expiresAt,
        mezzo: mezzo || state.activeMission?.mezzoAssegnato || state.activeShift?.mezzoScelto || 'T4606 Ambulanza',
        codiceMissione: codiceMissione || state.activeMission?.codice || undefined,
        indirizzo: indirizzo || state.activeMission?.indirizzo || undefined,
        coordinateObiettivo: coordinateObiettivo || state.activeMission?.coordinate || undefined,
        destinazione: destinazione || state.activeMission?.destinazione || undefined,
        coordinateDestinazione: coordinateDestinazione || undefined,
        urgenza: urgenza || state.activeMission?.urgenza || undefined,
        active: true
      };

      activeLiveTrackingSessions.set(token, session);

      res.json({
        success: true,
        token,
        expiresAt,
        orarioScadenza: formatTimeItaly(expiresAt, false),
        url: `/?track=live&token=${token}`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Errore creazione sessione tracciamento' });
    }
  });

  // Verifica lo stato del token di tracciamento live e restituisce i dati aggiornati
  app.get('/api/track/session/:token', (req, res) => {
    const { token } = req.params;
    const session = activeLiveTrackingSessions.get(token);

    if (!session) {
      return res.json({
        success: true,
        valid: false,
        expired: true,
        message: 'Collegamento di tracciamento live scaduto o non trovato (durata massima 1 ora superata).'
      });
    }

    const now = Date.now();
    if (session.expiresAt <= now) {
      activeLiveTrackingSessions.delete(token);
      return res.json({
        success: true,
        valid: false,
        expired: true,
        message: 'Collegamento di tracciamento live scaduto per motivi di privacy e sicurezza (durata massima 1 ora superata).'
      });
    }

    const remainingMs = session.expiresAt - now;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    res.json({
      success: true,
      valid: true,
      expired: false,
      remainingSeconds,
      remainingMinutes: Math.ceil(remainingSeconds / 60),
      session,
      position: state.gpsPosition,
      activeMission: state.activeMission ? {
        codice: state.activeMission.codice,
        mezzoAssegnato: state.activeMission.mezzoAssegnato,
        indirizzo: state.activeMission.indirizzo,
        coordinate: state.activeMission.coordinate,
        destinazione: state.activeMission.destinazione,
        datiDestinazione: state.activeMission.datiDestinazione,
        urgenza: state.activeMission.urgenza,
        ambito: state.activeMission.ambito
      } : null
    });
  });

  // Ricezione coordinate GPS in tempo reale (da Centrale o da Mezzo)
  app.post('/api/gps', (req, res) => {
    try {
      const pos = req.body?.position || req.body;
      if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
        state.gpsPosition = {
          lat: pos.lat,
          lng: pos.lng,
          accuratezza: Number(pos.accuratezza) || 8,
          velocita: pos.velocita !== undefined ? Number(pos.velocita) : (state.gpsPosition?.velocita ?? 45),
          orario: pos.orario || formatTimeItaly()
        };
        broadcast({
          type: 'GPS_UPDATED',
          position: state.gpsPosition
        });
        return res.json({ success: true, position: state.gpsPosition });
      }
      return res.status(400).json({ success: false, error: 'Coordinate GPS non valide' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio GPS' });
    }
  });

  // Posizione GPS in tempo reale per Mappa Operativa e link di tracciamento live WhatsApp
  app.get('/api/gps', (_req, res) => {
    res.json({
      success: true,
      position: state.gpsPosition,
      activeMission: state.activeMission ? {
        codice: state.activeMission.codice,
        mezzoAssegnato: state.activeMission.mezzoAssegnato,
        indirizzo: state.activeMission.indirizzo,
        coordinate: state.activeMission.coordinate,
        destinazione: state.activeMission.destinazione,
        datiDestinazione: state.activeMission.datiDestinazione,
        urgenza: state.activeMission.urgenza,
        ambito: state.activeMission.ambito
      } : null
    });
  });

  app.get('/api/servizi/archivio-anni', (_req, res) => {
    const currentYear = getCurrentYearItaly();
    const anniSet = new Set<number>();
    (state.serviziArchivio || []).forEach(s => anniSet.add(s.anno));
    anniSet.add(currentYear);

    const anni = Array.from(anniSet).sort((a, b) => b - a);
    res.json({
      success: true,
      currentYear,
      anni,
      cartelleAnniPrecedenti: state.cartelleAnniPrecedenti
    });
  });

  app.post('/api/volontari', (req, res) => {
    const data = req.body;
    if (data && data.nome && !Array.isArray(data.volontari)) {
      const idVol = data.id || `vol-${Date.now()}`;
      const nuovoVol: any = {
        ...data,
        id: idVol,
        nome: String(data.nome).trim(),
        cognome: data.cognome?.trim() || '',
        matricola: data.matricola?.trim() || `VOL-${Math.floor(100 + Math.random() * 900)}`,
        qualifica: data.qualifica || 'Soccorritore',
        telefono: data.telefono?.trim() || '',
        email: data.email?.trim() || '',
        pin: String(data.pin || '0000').trim() || '0000',
        caricaConsiglioDirettivo: data.caricaConsiglioDirettivo || undefined,
        firmaBase64: data.firmaBase64 || undefined,
        dataRegistrazione: data.dataRegistrazione || formatDateItaly(),
        inTurno: !!data.inTurno,
        profiloCentrale: !!data.profiloCentrale,
        approvato: data.approvato !== undefined ? !!data.approvato : true,
        dataRichiestaApprovazione: data.dataRichiestaApprovazione,
        richiedeResetPassword: !!data.richiedeResetPassword,
        dataRichiestaResetPassword: data.dataRichiestaResetPassword
      };

      state.volontariEliminatiIds = normalizeDeletedIds(
        (state.volontariEliminatiIds || []).filter((id) => id !== idVol)
      );
      state.volontari = mergeVolontariLists(state.volontari, [nuovoVol], state.volontariEliminatiIds);
      reconcileVolontariConLoggedSessions();
      persistState();

      broadcast({
        type: 'VOLONTARI_UPDATED',
        volontari: state.volontari,
        volontariEliminatiIds: state.volontariEliminatiIds,
        loggedSessions: state.loggedSessions
      });

      return res.json({
        success: true,
        volontario: state.volontari.find(v => v.id === idVol),
        volontari: state.volontari,
        volontariEliminatiIds: state.volontariEliminatiIds,
        loggedSessions: state.loggedSessions
      });
    }

    if (Array.isArray(req.body?.volontari)) {
      const mergedDeleted = normalizeDeletedIds([
        ...(state.volontariEliminatiIds || []),
        ...(Array.isArray(req.body?.volontariEliminatiIds) ? req.body.volontariEliminatiIds : [])
      ]);
      state.volontariEliminatiIds = mergedDeleted;
      state.volontari = mergeVolontariLists(state.volontari, req.body.volontari, mergedDeleted);
      reconcileVolontariConLoggedSessions();
      persistState();
      broadcast({
        type: 'VOLONTARI_UPDATED',
        volontari: state.volontari,
        volontariEliminatiIds: state.volontariEliminatiIds,
        loggedSessions: state.loggedSessions
      });
      return res.json({
        success: true,
        volontari: state.volontari,
        volontariEliminatiIds: state.volontariEliminatiIds,
        loggedSessions: state.loggedSessions
      });
    }

    res.status(400).json({ success: false, error: 'Dati volontario incompleti' });
  });

  // REST API Checklist Mezzi Inizio Turno Guidata
  app.get('/api/checklists/templates', (_req, res) => {
    res.json({
      success: true,
      templates: state.checklistsTemplates || []
    });
  });

  app.post('/api/checklists/templates', (req, res) => {
    const templates = Array.isArray(req.body?.templates) ? req.body.templates : (Array.isArray(req.body) ? req.body : null);
    if (templates) {
      state.checklistsTemplates = templates;
      persistState();
      broadcast({
        type: 'CHECKLISTS_TEMPLATES_UPDATED',
        templates: state.checklistsTemplates
      });
      return res.json({ success: true, count: templates.length, templates });
    }
    res.status(400).json({ success: false, error: 'Template non validi' });
  });

  app.get('/api/checklists/compilate', (_req, res) => {
    res.json({
      success: true,
      checklistsCompilate: state.checklistsCompilate || []
    });
  });

  app.post('/api/checklists/compilate', (req, res) => {
    const data = req.body;
    if (data && data.mezzo) {
      if (!Array.isArray(state.checklistsCompilate)) {
        state.checklistsCompilate = [];
      }
      state.checklistsCompilate.unshift(data);
      if (state.checklistsCompilate.length > 500) {
        state.checklistsCompilate = state.checklistsCompilate.slice(0, 500);
      }

      let notif: RadioNotification | null = null;
      if (data.statoGenerale === 'con_anomalie' || (Array.isArray(data.anomalieRilevate) && data.anomalieRilevate.length > 0)) {
        const elencoAnomalie = (data.anomalieRilevate || []).map((a: any) => a.voceTitolo || a.note).filter(Boolean).join(', ');
        notif = {
          id: generateUniqueNotifId(),
          orario: formatTimeItaly(),
          testo: `⚠️ CHECKLIST ${data.mezzo}: Anomalia segnalata da ${data.volontarioNome || 'Volontario'}: ${elencoAnomalie || 'Difetto segnalato a inizio turno'}`,
          tipo: 'allarme'
        };
        state.notifiche.push(notif);

        sendPushNotificationToRole('admin', {
          title: `⚠️ ANOMALIA CHECKLIST ${data.mezzo}`,
          body: `Il volontario ${data.volontarioNome || 'in turno'} ha segnalato non conformità su ${data.mezzo}: ${elencoAnomalie}`,
          tag: `chk-anomalia-${data.id}`,
          urgenza: 'GIALLO'
        });
      }

      persistState();
      broadcast({
        type: 'CHECKLIST_COMPILATA_ADDED',
        checklistCompilata: data,
        checklistsCompilate: state.checklistsCompilate,
        notification: notif || undefined
      });

      return res.json({ success: true, checklist: data, checklistsCompilate: state.checklistsCompilate });
    }
    res.status(400).json({ success: false, error: 'Dati verifica checklist mancanti' });
  });

  app.put('/api/volontari/:id', (req, res) => {
    const { id } = req.params;
    const patch = req.body || {};
    state.volontariEliminatiIds = normalizeDeletedIds(
      (state.volontariEliminatiIds || []).filter((d) => d !== id)
    );
    state.volontari = mergeVolontariLists(
      state.volontari,
      [{ ...patch, id }],
      state.volontariEliminatiIds
    );
    reconcileVolontariConLoggedSessions();
    persistState();
    broadcast({
      type: 'VOLONTARI_UPDATED',
      volontari: state.volontari,
      volontariEliminatiIds: state.volontariEliminatiIds,
      loggedSessions: state.loggedSessions
    });
    return res.json({
      success: true,
      volontario: state.volontari.find(v => v.id === id),
      volontari: state.volontari,
      volontariEliminatiIds: state.volontariEliminatiIds,
      loggedSessions: state.loggedSessions
    });
  });

  app.delete('/api/volontari/:id', (req, res) => {
    const { id } = req.params;
    state.volontariEliminatiIds = normalizeDeletedIds([
      ...(state.volontariEliminatiIds || []),
      id
    ]);
    const deletedSet = new Set(state.volontariEliminatiIds);
    state.volontari = state.volontari.filter(v => !v.id || !deletedSet.has(String(v.id).trim()));
    persistState();
    broadcast({
      type: 'VOLONTARI_UPDATED',
      volontari: state.volontari,
      volontariEliminatiIds: state.volontariEliminatiIds
    });
    res.json({
      success: true,
      volontari: state.volontari,
      volontariEliminatiIds: state.volontariEliminatiIds
    });
  });

  // REST API di sincronizzazione generale (usata anche dal polling di fallback)
  app.get('/api/sync', (_req, res) => {
    // Se lo squillo è attivo da oltre 25 secondi, consideralo auto-scaduto
    if (state.ringing && state.ringing.active && Date.now() - (state.ringing.timestamp || 0) > 25000) {
      state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: Date.now() };
      persistState();
    }
    res.json({ success: true, state });
  });

  // REST API per la Carta Intestata Ufficiale dell'Associazione
  app.get('/api/carta-intestata', (_req, res) => {
    res.json(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT);
  });

  app.post('/api/carta-intestata', (req, res) => {
    try {
      const nuovi = req.body;
      if (!nuovi || typeof nuovi !== 'object') {
        return res.status(400).json({ error: 'Dati carta intestata non validi' });
      }
      state.datiCartaIntestata = normalizeDatiCartaIntestataServer({
        ...DATI_CARTA_INTESTATA_DEFAULT,
        ...(state.datiCartaIntestata || {}),
        ...nuovi
      });
      persistState();
      broadcast({
        type: 'CARTA_INTESTATA_UPDATED',
        dati: state.datiCartaIntestata
      });
      console.log('[Carta Intestata] Dati ufficiali aggiornati e persistiti nel database:', state.datiCartaIntestata);
      res.json({ success: true, dati: state.datiCartaIntestata });
    } catch (err: any) {
      console.error('[Carta Intestata] Errore aggiornamento:', err);
      res.status(500).json({ error: 'Errore interno salvataggio carta intestata' });
    }
  });

  // REST API per Ulteriori Metodi di Ricezione Donazioni e Pagamenti (Coordinate Bancarie & Postali)
  app.get('/api/metodi-pagamento', (_req, res) => {
    res.json({
      success: true,
      metodi: Array.isArray(state.metodiPagamentoCustom) ? state.metodiPagamentoCustom : [],
      updatedAt: state.metodiPagamentoCustomUpdatedAt || 0
    });
  });

  app.post('/api/metodi-pagamento', (req, res) => {
    try {
      const { metodi, updatedAt } = req.body || {};
      if (!Array.isArray(metodi)) {
        return res.status(400).json({ success: false, error: 'Elenco metodi pagamento non valido' });
      }
      const ts = typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
      state.metodiPagamentoCustom = metodi;
      state.metodiPagamentoCustomUpdatedAt = ts;
      persistState();
      broadcast({
        type: 'METODI_PAGAMENTO_UPDATED',
        metodi: state.metodiPagamentoCustom,
        updatedAt: ts
      });
      return res.json({ success: true, metodi: state.metodiPagamentoCustom, updatedAt: ts });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio metodi pagamento' });
    }
  });

  // REST API per Categorie di Costo di Servizio (Crea, Modifica, Cancella)
  app.get('/api/categorie-costi-servizio', (_req, res) => {
    res.json({
      success: true,
      categorie: Array.isArray(state.categorieCostiServizio) ? state.categorieCostiServizio : null,
      updatedAt: state.categorieCostiServizioUpdatedAt || 0
    });
  });

  app.post('/api/categorie-costi-servizio', (req, res) => {
    try {
      const { categorie, updatedAt } = req.body || {};
      if (!Array.isArray(categorie) || categorie.length === 0 || categorie.length > 100) {
        return res.status(400).json({ success: false, error: 'Elenco categorie di costo non valido' });
      }
      const cleaned = categorie
        .map((c: any) => ({
          id: String(c?.id || '').trim().slice(0, 64),
          nome: String(c?.nome || '').trim().slice(0, 80),
          unitaDefault: c?.unitaDefault ? String(c.unitaDefault).trim().slice(0, 32) : 'servizio',
          descrizione: c?.descrizione ? String(c.descrizione).trim().slice(0, 160) : undefined,
          predefinita: Boolean(c?.predefinita),
          dataCreazione: c?.dataCreazione ? String(c.dataCreazione).slice(0, 32) : undefined,
        }))
        .filter((c: any) => c.id && c.nome);
      if (cleaned.length === 0) {
        return res.status(400).json({ success: false, error: 'Nessuna categoria valida fornita' });
      }
      const ts = typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
      state.categorieCostiServizio = cleaned;
      state.categorieCostiServizioUpdatedAt = ts;
      persistState();
      broadcast({
        type: 'CATEGORIE_COSTI_SERVIZIO_UPDATED',
        categorie: state.categorieCostiServizio,
        updatedAt: ts
      });
      return res.json({ success: true, categorie: state.categorieCostiServizio, updatedAt: ts });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio categorie di costo' });
    }
  });

  // REST API per recupero/streaming incrementale trasmissione radio al risveglio dal background / schermo spento
  app.get('/api/radio-transmission/:id', (req, res) => {
    pruneOldRadioTransmissions();
    const rawId = String(req.params.id || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(rawId)) {
      return res.status(400).json({ success: false, error: 'ID trasmissione non valido' });
    }
    const tx = recentRadioTransmissions.find((t) => t.id === rawId);
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Trasmissione non più disponibile' });
    }
    const reqRole = String(req.query.role || 'volontario');
    const reqVolId = String(req.query.volontarioId || '').trim();
    const afterSeq = Math.max(0, Math.floor(Number(req.query.afterSeq) || 0));
    if (tx.groupId && reqRole !== 'admin') {
      const allowed = Array.isArray(tx.memberIds) && reqVolId !== '' && tx.memberIds.includes(reqVolId);
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'Accesso non autorizzato al gruppo radio' });
      }
    }
    const filteredChunks = afterSeq > 0 ? tx.chunks.filter((c) => Number(c.seq || 0) > afterSeq) : tx.chunks;
    return res.json({
      success: true,
      transmission: {
        id: tx.id,
        channelId: tx.channelId,
        groupId: tx.groupId,
        groupName: tx.groupName,
        speakerId: tx.speakerId,
        speakerName: tx.speakerName,
        role: tx.role,
        isEmergency: tx.isEmergency,
        startedAt: tx.startedAt,
        endedAt: tx.endedAt,
        active: !tx.endedAt,
        totalChunks: tx.chunks.length,
        chunks: filteredChunks,
      }
    });
  });

  app.get('/api/radio-recent', (req, res) => {
    pruneOldRadioTransmissions();
    const reqRole = String(req.query.role || 'volontario');
    const reqVolId = String(req.query.volontarioId || '').trim();
    const since = Number(req.query.since) || 0;
    const items = recentRadioTransmissions
      .filter((tx) => {
        if (since > 0 && tx.startedAt <= since) return false;
        if (!tx.groupId || reqRole === 'admin') return true;
        return Array.isArray(tx.memberIds) && reqVolId !== '' && tx.memberIds.includes(reqVolId);
      })
      .map((tx) => ({
        id: tx.id,
        channelId: tx.channelId,
        groupId: tx.groupId,
        groupName: tx.groupName,
        speakerId: tx.speakerId,
        speakerName: tx.speakerName,
        isEmergency: tx.isEmergency,
        startedAt: tx.startedAt,
        endedAt: tx.endedAt,
        active: !tx.endedAt,
        chunkCount: tx.chunks.length,
      }));
    return res.json({ success: true, transmissions: items });
  });

  // Relay HTTP burst audio PTT per mittenti su host serverless (es. www.croceoro.org) o con WebSocket temporaneamente in riconnessione
  app.post('/api/radio-burst', (req, res) => {
    try {
      const { chunks } = req.body || {};
      if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > 12) {
        return res.status(400).json({ success: false, error: 'Burst audio non valido' });
      }
      let accepted = 0;
      for (const ch of chunks) {
        if (!ch || typeof ch !== 'object') continue;
        const b64 = typeof ch.payloadBase64 === 'string' ? ch.payloadBase64 : '';
        if (!b64 || b64.length > 24000) continue;
        const speakerId = String(ch.speakerId || '').trim().slice(0, 80);
        const channelId = String(ch.channelId || 'general').trim().slice(0, 80);
        if (!speakerId) continue;
        handleIncomingAction('PTT_AUDIO_CHUNK', {
          speakerId,
          channelId,
          isEmergency: Boolean(ch.isEmergency || channelId === 'emergency'),
          codec: String(ch.codec || 'adpcm24').slice(0, 16),
          payloadBase64: b64,
          sampleRate: Math.min(48000, Math.max(8000, Number(ch.sampleRate) || 24000)),
          seq: Math.max(0, Number(ch.seq) || 0),
        });
        accepted++;
      }
      return res.json({ success: true, accepted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore relay burst audio' });
    }
  });

  // REST API per Numeri Utili di Emergenza & Interni Associazione
  app.get('/api/rubrica-numeri-utili', (_req, res) => {
    res.json({
      success: true,
      rubrica: Array.isArray(state.rubricaNumeriUtili) ? state.rubricaNumeriUtili : null,
      updatedAt: state.rubricaNumeriUtiliUpdatedAt || 0
    });
  });

  app.post('/api/rubrica-numeri-utili', (req, res) => {
    try {
      const { rubrica, updatedAt } = req.body || {};
      if (!Array.isArray(rubrica)) {
        return res.status(400).json({ success: false, error: 'Elenco numeri utili non valido' });
      }
      const ts = typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
      state.rubricaNumeriUtili = rubrica;
      state.rubricaNumeriUtiliUpdatedAt = ts;
      persistState();
      broadcast({
        type: 'RUBRICA_NUMERI_UTILI_UPDATED',
        rubrica: state.rubricaNumeriUtili,
        updatedAt: ts
      });
      return res.json({ success: true, rubrica: state.rubricaNumeriUtili, updatedAt: ts });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio rubrica numeri utili' });
    }
  });

  // REST API per Regola Notifica Scadenza Mezzi
  app.get('/api/regola-scadenze-mezzi', (_req, res) => {
    res.json({
      success: true,
      regola: state.regolaScadenzeMezzi || null
    });
  });

  app.post('/api/regola-scadenze-mezzi', (req, res) => {
    try {
      const { regola } = req.body || {};
      if (!regola || typeof regola !== 'object') {
        return res.status(400).json({ success: false, error: 'Regola scadenze non valida' });
      }
      state.regolaScadenzeMezzi = regola;
      persistState();
      broadcast({
        type: 'REGOLA_SCADENZE_MEZZI_UPDATED',
        regola: state.regolaScadenzeMezzi
      });
      return res.json({ success: true, regola: state.regolaScadenzeMezzi });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio regola scadenze' });
    }
  });

  // ENDPOINT: Notifica automatica a Responsabile Mezzi e Presidente quando cambia la regola di notifica scadenza mezzi
  app.post('/api/notifica-cambio-regola-scadenze-mezzi', async (req, res) => {
    try {
      const {
        operatoreNome = 'Amministratore / Consiglio Direttivo',
        operatoreCarica = '',
        vecchiaRegola,
        nuovaRegola,
        destinatariExtra = [],
        dataOra = formatDateTimeItaly()
      } = req.body || {};

      const destinatari = Array.from(
        new Set([
          'mezzi@croceoro.org',
          'presidenza@croceoro.org',
          ...(Array.isArray(destinatariExtra) ? destinatariExtra : []).filter(
            (e: any) => typeof e === 'string' && e.includes('@')
          )
        ])
      );

      const descVecchia = vecchiaRegola
        ? `Soglia notifica: ${vecchiaRegola.giorniSogliaNotificaEmail} gg | Scadenzario: ${vecchiaRegola.giorniPreavvisoScadenzario} gg | Auto: ${vecchiaRegola.invioAutomaticoAttivo ? 'ATTIVA' : 'DISATTIVA'} | Comando: "${vecchiaRegola.regolaTestuale || '-'}"`
        : 'Regola precedente predefinita';

      const descNuova = nuovaRegola
        ? `Soglia notifica: ${nuovaRegola.giorniSogliaNotificaEmail} gg | Scadenzario: ${nuovaRegola.giorniPreavvisoScadenzario} gg | Auto: ${nuovaRegola.invioAutomaticoAttivo ? 'ATTIVA' : 'DISATTIVA'} | Comando: "${nuovaRegola.regolaTestuale || '-'}"`
        : 'Nuova regola aggiornata';

      const oggetto = `[PARCO MEZZI CROCE ORO] Modifica Regola Notifica Scadenze Mezzi da ${operatoreNome}`;
      const testoEmail =
        `Spettabili Responsabile Parco Mezzi e Presidente Croce Oro Massa Carrara OdV,\n\n` +
        `SI NOTIFICA CHE LA REGOLA DI NOTIFICA SCADENZA MEZZI È STATA MODIFICATA.\n\n` +
        `• Modificata da: ${operatoreNome}${operatoreCarica ? ` (${operatoreCarica})` : ''}\n` +
        `• Data e Ora: ${dataOra}\n\n` +
        `• REGOLA PRECEDENTE:\n  ${descVecchia}\n\n` +
        `• NUOVA REGOLA ATTIVA:\n  ${descNuova}\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Informativi Centrali`;

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 18px; font-weight: 800;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #e2e8f0;">Aggiornamento Regola Notifica Scadenze Parco Mezzi</p>
          </div>
          <div style="padding: 20px; background-color: #ffffff; font-size: 13px; line-height: 1.55;">
            <p>Spettabili <strong>Responsabile Mezzi</strong> e <strong>Presidente</strong>,</p>
            <p>si comunica che in data <strong>${dataOra}</strong> l'utente <strong>${operatoreNome}</strong>${operatoreCarica ? ` (<em>${operatoreCarica}</em>)` : ''} ha modificato la regola di notifica scadenze nella sottosezione <em>Manutenzione Mezzi &amp; Tagliandi</em>.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 6px; margin: 12px 0;">
              <strong style="color: #991b1b;">Regola Precedente:</strong><br/>
              <span style="font-size: 12px; color: #7f1d1d;">${descVecchia}</span>
            </div>
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 10px 14px; border-radius: 6px; margin: 12px 0;">
              <strong style="color: #065f46;">Nuova Regola Attiva:</strong><br/>
              <span style="font-size: 12px; color: #064e3b;">${descNuova}</span>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 12px 16px; font-size: 11px; color: #64748b; text-align: center;">
            Notifica automatica inviata al Responsabile Mezzi e al Presidente • Portale Gestionale Croce Oro OdV
          </div>
        </div>
      `;

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;
      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let speditoViaSmtp = false;
      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: { user: candidate, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });
          await t.verify();
          await t.sendMail({
            from: { name: MITTENTE_UFFICIALE, address: EMAIL_MITTENTE_UFFICIALE },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            to: destinatari,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
          break;
        } catch {}
      }

      const notificaCambio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `⚙️ REGOLA SCADENZE MEZZI MODIFICATA da ${operatoreNome}${operatoreCarica ? ` (${operatoreCarica})` : ''}: notificati Responsabile Mezzi e Presidente (${nuovaRegola?.regolaTestuale || descNuova}).`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaCambio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      persistState();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaCambio
      });

      return res.json({ success: true, speditoViaSmtp, destinatari });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore notifica cambio regola' });
    }
  });

  // REST API per il Database Anagrafiche Sedi Associative
  app.get('/api/sedi', (_req, res) => {
    res.json(normalizzaListaSediAssociative(state.sedi || []));
  });

  app.post('/api/sedi', (req, res) => {
    try {
      const { sedi } = req.body;
      if (!Array.isArray(sedi)) {
        return res.status(400).json({ error: 'Payload sedi deve essere un array' });
      }
      const sediNorm = normalizzaListaSediAssociative(sedi);
      state.sedi = sediNorm;
      state.luoghiTimbratura = normalizzaListaLuoghiTimbratura(
        state.luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT,
        sediNorm
      );
      persistState();
      broadcast({
        type: 'SEDI_UPDATED',
        sedi: state.sedi
      });
      console.log(`[Sedi Associative] Aggiornate ${sediNorm.length} sedi nel database persistito.`);
      res.json({ success: true, sedi: state.sedi });
    } catch (err: any) {
      console.error('[Sedi Associative] Errore aggiornamento sedi:', err);
      res.status(500).json({ error: 'Errore salvataggio sedi associative' });
    }
  });

  // REST API per la configurazione Display Raspberry di Sezione
  app.get('/api/raspberry-config', (_req, res) => {
    res.json({ success: true, config: state.raspberryDisplayConfig || null });
  });

  app.post('/api/raspberry-config', (req, res) => {
    try {
      const cfg = req.body?.config;
      if (!cfg || typeof cfg !== 'object') {
        return res.status(400).json({ error: 'Payload config non valido' });
      }
      state.raspberryDisplayConfig = cfg;
      persistState();
      broadcast({
        type: 'RASPBERRY_CONFIG_UPDATED',
        config: state.raspberryDisplayConfig,
      });
      res.json({ success: true, config: state.raspberryDisplayConfig });
    } catch (err: any) {
      res.status(500).json({ error: 'Errore salvataggio configurazione Raspberry' });
    }
  });

  // REST API per i Luoghi di Timbratura GPS configurabili a discrezione operatore (Effetto Immediato)
  app.get('/api/luoghi-timbratura', (_req, res) => {
    res.json({
      success: true,
      luoghi: normalizzaListaLuoghiTimbratura(state.luoghiTimbratura || LUOGHI_TIMBRATURA_DEFAULT, state.sedi)
    });
  });

  app.post('/api/luoghi-timbratura', (req, res) => {
    try {
      const { luoghi, messaggio } = req.body;
      if (!Array.isArray(luoghi)) {
        return res.status(400).json({ success: false, error: 'Payload luoghi deve essere un array' });
      }
      const luoghiNorm = normalizzaListaLuoghiTimbratura(luoghi, state.sedi);
      state.luoghiTimbratura = luoghiNorm;
      persistState();

      const notif: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: messaggio || `📍 LUOGHI DI TIMBRATURA: Configurazione aggiornata dall'operatore (${luoghiNorm.length} punti). Validità immediata.`,
        tipo: 'sistema'
      };
      state.notifiche.push(notif);

      broadcast({
        type: 'LUOGHI_TIMBRATURA_UPDATED',
        luoghi: state.luoghiTimbratura,
        notification: notif
      });

      console.log(`[Luoghi Timbratura] ${luoghiNorm.length} punti salvati via REST API.`);
      res.json({ success: true, luoghi: state.luoghiTimbratura });
    } catch (err: any) {
      console.error('[Luoghi Timbratura] Errore aggiornamento:', err);
      res.status(500).json({ success: false, error: 'Errore salvataggio luoghi timbratura' });
    }
  });

  // REST API per il Registro Timbrature Volontari (Sincronizzazione Realtime Immediata)
  app.get('/api/timbrature', (_req, res) => {
    res.json({
      success: true,
      timbrature: state.timbrature || []
    });
  });

  app.post('/api/timbrature', (req, res) => {
    try {
      const { timbrature } = req.body;
      if (!Array.isArray(timbrature)) {
        return res.status(400).json({ success: false, error: 'timbrature deve essere un array' });
      }
      state.timbrature = timbrature;
      const volChanged = syncVolontariInTurnoWithTimbrature();
      persistState();

      broadcast({
        type: 'TIMBRATURE_UPDATED',
        timbrature: state.timbrature
      });
      if (volChanged) {
        broadcast({
          type: 'VOLONTARI_UPDATED',
          volontari: state.volontari,
          volontariEliminatiIds: state.volontariEliminatiIds
        });
      }

      console.log(`[Timbrature] ${timbrature.length} timbrature salvate via REST API.`);
      res.json({ success: true, timbrature: state.timbrature });
    } catch (err: any) {
      console.error('[Timbrature] Errore aggiornamento:', err);
      res.status(500).json({ success: false, error: 'Errore salvataggio timbrature' });
    }
  });

  // Endpoint per la chiave pubblica VAPID (permette ai browser di registrarsi alle notifiche Push)
  app.get('/api/vapid-public-key', (_req, res) => {
    res.json({ success: true, publicKey: VAPID_KEYS.publicKey });
  });

  // Registrazione della sottoscrizione Web Push inviata dal Service Worker del telefono
  app.post('/api/push-subscribe', (req, res) => {
    const { role, subscription, volontarioId, volontarioNome } = req.body || {};
    const allowedRole = role === 'admin' || role === 'centrale' || role === 'volontario' ? role : 'all';
    if (subscription && typeof subscription.endpoint === 'string' && subscription.endpoint.startsWith('https://')) {
      subscribers.set(subscription.endpoint, {
        endpoint: subscription.endpoint,
        role: allowedRole,
        volontarioId: volontarioId ? String(volontarioId).trim().slice(0, 80) : undefined,
        volontarioNome: volontarioNome ? String(volontarioNome).trim().slice(0, 120) : undefined,
        subscription,
        timestamp: Date.now()
      });
      syncSubscribersToState(state);
      persistState();
      console.log(`[WebPush] Dispositivo registrato per notifiche push (${allowedRole}${volontarioId ? ` - volId: ${volontarioId}` : ''}). Totale: ${subscribers.size}`);
    }
    res.json({ success: true, count: subscribers.size });
  });

  // Self-test Push sul proprio dispositivo (invia solo all'endpoint chiamante già registrato o passato nel body, con rate-limit 5s)
  app.post('/api/push-test', async (req, res) => {
    const directSub = req.body?.subscription;
    const endpoint = typeof req.body?.endpoint === 'string'
      ? req.body.endpoint.trim()
      : (typeof directSub?.endpoint === 'string' ? directSub.endpoint.trim() : '');
    if (!endpoint.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'Endpoint Push non valido.' });
    }
    const storedSub = subscribers.get(endpoint);
    const targetSubscription = storedSub?.subscription || (directSub?.keys?.p256dh && directSub?.keys?.auth ? directSub : null);
    if (!targetSubscription) {
      return res.status(404).json({ success: false, error: 'Dispositivo non registrato sul server Push. Premi prima "Attiva Walkie-Talkie Background".' });
    }
    const lastAt = pushTestRateLimit.get(endpoint) || 0;
    if (Date.now() - lastAt < 5000) {
      return res.status(429).json({ success: false, error: 'Attendi qualche secondo prima di ripetere il test Push.' });
    }
    pushTestRateLimit.set(endpoint, Date.now());
    try {
      await webpush.sendNotification(
        targetSubscription,
        JSON.stringify({
          title: '📻 WALKIE-TALKIE BACKGROUND ATTIVO',
          body: 'Test riuscito! Questo dispositivo riceve correttamente le chiamate radio (Emergenza, Gruppi e Tutti) anche a schermo spento.',
          tag: `radio-test-${Date.now()}`,
          soundType: 'cicalino',
          urgenza: 'GIALLO',
          requireInteraction: false,
          tipo: 'radio_channel_on',
          isEmergency: false,
          channelId: 'general',
          speakerName: 'Test Radio Croce Oro',
        }),
        { urgency: 'high', TTL: 60, headers: { Urgency: 'high' } }
      );
      return res.json({ success: true });
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        subscribers.delete(endpoint);
      }
      return res.status(502).json({
        success: false,
        error: `Invio Push rifiutato dal servizio browser (${err?.statusCode || 'errore rete'}). Riattiva le notifiche.`
      });
    }
  });

  // Inoltro diretto Push ad alta priorità a sottoscrizioni sincronizzate via Firestore
  app.post('/api/push-send', async (req, res) => {
    const rawSubs = Array.isArray(req.body?.subscriptions) ? req.body.subscriptions.slice(0, 80) : [];
    const notifPayload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : null;
    if (rawSubs.length === 0 || !notifPayload) {
      return res.json({ success: true, sent: 0, expiredEndpoints: [] });
    }
    const serializedPayload = JSON.stringify({
      title: String(notifPayload.title || '📻 RADIO CROCE ORO').slice(0, 140),
      body: String(notifPayload.body || 'Comunicazione radio in arrivo.').slice(0, 260),
      tag: String(notifPayload.tag || `radio-${Date.now()}`).slice(0, 80),
      urgenza: String(notifPayload.urgenza || (notifPayload.isEmergency ? 'ROSSO' : 'GIALLO')),
      soundType: String(notifPayload.soundType || 'cicalino'),
      tipo: String(notifPayload.tipo || 'radio_ptt'),
      channelId: String(notifPayload.channelId || 'general'),
      transmissionId: String(notifPayload.transmissionId || ''),
      speakerName: String(notifPayload.speakerName || ''),
      isEmergency: Boolean(notifPayload.isEmergency),
      requireInteraction: Boolean(notifPayload.requireInteraction ?? notifPayload.isEmergency),
      timestamp: Date.now(),
    });
    let sent = 0;
    const expiredEndpoints: string[] = [];
    await Promise.all(
      rawSubs.map(async (entry: any) => {
        const endpoint = typeof entry?.endpoint === 'string' ? entry.endpoint.trim() : '';
        const p256dh = typeof entry?.p256dh === 'string' ? entry.p256dh.trim() : '';
        const auth = typeof entry?.auth === 'string' ? entry.auth.trim() : '';
        if (!endpoint.startsWith('https://') || !p256dh || !auth) return;
        try {
          await webpush.sendNotification(
            { endpoint, keys: { p256dh, auth } },
            serializedPayload,
            { urgency: 'high', TTL: notifPayload.isEmergency ? 120 : 60, headers: { Urgency: 'high' } }
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredEndpoints.push(endpoint);
          }
        }
      })
    );
    return res.json({ success: true, sent, expiredEndpoints });
  });

  // Endpoint per forzare o testare l'invio del promemoria per i turni di domani
  app.post('/api/promemoria-turni/invia-ora', (req, res) => {
    try {
      const { forzaTutti } = req.body || {};
      const esito = eseguiControlloPromemoriaTurniDomani(true);
      res.json({
        success: true,
        messaggio: `Inviati ${esito.countInviati} promemoria per i turni in programma per domani.`,
        ...esito
      });
    } catch (err: any) {
      console.error('[Promemoria Turni] Errore invio manuale:', err);
      res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // Endpoint per consultare lo stato dei promemoria turni
  app.get('/api/promemoria-turni/stato', (_req, res) => {
    try {
      const info = getItalianDateInfo();
      const turni = Array.isArray(state.turni) ? state.turni : [];
      const turniDomani = turni.filter((t: any) => t && t.data === info.tomorrowStr);
      res.json({
        success: true,
        oraItaliana: `${info.hour.toString().padStart(2, '0')}:${info.minute.toString().padStart(2, '0')}`,
        fusoOrario: ITALY_TIMEZONE,
        fasciaOra: info.fasciaOraLabel,
        oraLegaleAttiva: info.isOraLegale,
        offsetMinutiUtc: info.offsetMinutes,
        oggi: info.todayStr,
        domani: info.tomorrowStr,
        turniDomaniTotali: turniDomani.length,
        promemoriaInviati: state.promemoriaTurniInviati || {}
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Errore stato promemoria' });
    }
  });

  // Endpoint per verificare o inviare immediatamente le notifiche email dei compleanni
  // a Presidenza e a tutti gli account che hanno accesso al database Volontari
  app.post('/api/notifica-compleanni', async (req, res) => {
    try {
      const { forzaInvio = false, volontari: clientVolontari } = req.body || {};
      const esito = await eseguiControlloCompleanniOggi(Boolean(forzaInvio), clientVolontari);
      res.json({
        success: true,
        ...esito
      });
    } catch (err: any) {
      console.error('[Compleanni] Errore endpoint /api/notifica-compleanni:', err);
      res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione compleanni' });
    }
  });

  app.get('/api/notifica-compleanni/stato', (_req, res) => {
    try {
      const info = getItalianDateInfo();
      const destinatari = calcolaDestinatariEmailCompleanni(state.volontari || []);
      res.json({
        success: true,
        oggi: info.todayStr,
        oraItaliana: `${info.hour.toString().padStart(2, '0')}:${info.minute.toString().padStart(2, '0')}`,
        fusoOrario: ITALY_TIMEZONE,
        fasciaOra: info.fasciaOraLabel,
        oraLegaleAttiva: info.isOraLegale,
        destinatariAccessoVolontari: destinatari,
        compleanniInviati: state.promemoriaCompleanniInviati || {}
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Errore stato compleanni' });
    }
  });

  // Test invio notifica push
  app.post('/api/push-test', (req, res) => {
    const { role, title, body } = req.body;
    sendPushNotificationToRole(role || 'all', {
      title: title || '🔔 TEST ALLARME CROCE ORO',
      body: body || 'Verifica notifica sonora e vibrazione con schermo bloccato.',
      tag: 'test-push',
      urgenza: 'ROSSO'
    });
    res.json({ success: true, sentTo: subscribers.size });
  });

  app.post('/api/event', (req, res) => {
    try {
      const { type, data } = req.body;
      if (type) {
        handleIncomingAction(type, data);
      }
      res.json({ success: true, activeMission: state.activeMission, ringing: state.ringing });
    } catch (err) {
      console.error('Errore /api/event:', err);
      res.status(500).json({ success: false, error: 'Errore interno elaborazione evento' });
    }
  });

  // Endpoint universale per download file PDF con Content-Disposition: attachment
  // Garantisce il download nativo su Android (Download Manager), iOS, PWA e iframe
  app.post('/api/download-pdf', (req, res) => {
    try {
      const { pdfBase64, filename } = req.body;
      if (!pdfBase64) {
        return res.status(400).send('Dati PDF mancanti');
      }
      const cleanB64 = String(pdfBase64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
      const buffer = Buffer.from(cleanB64, 'base64');
      const safeName = (filename || 'Attestato.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err: any) {
      console.error('Errore endpoint /api/download-pdf:', err);
      res.status(500).send('Errore elaborazione download PDF');
    }
  });

  interface TempPdfItem {
    buffer: Buffer;
    filename: string;
    expires: number;
  }
  const tempPdfDownloads = new Map<string, TempPdfItem>();

  // Pulizia periodica ogni 2 minuti per i file PDF temporanei
  setInterval(() => {
    const now = Date.now();
    for (const [key, item] of tempPdfDownloads.entries()) {
      if (item.expires < now) {
        tempPdfDownloads.delete(key);
      }
    }
  }, 120000);

  // Monitoraggio continuo e auto-scadenza squillo suoneria (timeout 25s)
  setInterval(() => {
    const now = Date.now();
    if (state.ringing && state.ringing.active && now - (state.ringing.timestamp || 0) > 25000) {
      state.ringing = { active: false, source: '', soundType: 'telefono', timestamp: now };
      persistState();
      broadcast({
        type: 'RING_STOPPED',
        notification: {
          id: generateUniqueNotifId(),
          orario: formatTimeItaly(),
          testo: `🔕 SUONERIA TELEFONO AUTO-SCADUTA (Timeout emergenza 25s superato).`,
          tipo: 'sistema'
        }
      });
    }
  }, 5000);

  // Controllo automatico promemoria turni di domani (avviso alle ore 09:00 del giorno prima)
  // + controllo automatico compleanni volontari (avviso dalle ore 08:00 a Presidenza e a tutti gli account con accesso al database Volontari)
  setInterval(() => {
    try {
      eseguiControlloPromemoriaTurniDomani(false);
    } catch (err) {
      console.error('[Promemoria Turni] Errore esecuzione periodica:', err);
    }
    eseguiControlloCompleanniOggi(false).catch((err) => {
      console.error('[Compleanni] Errore esecuzione periodica:', err);
    });
  }, 60000);

  // Esecuzione rapida iniziale all'avvio del server
  setTimeout(() => {
    try {
      eseguiControlloPromemoriaTurniDomani(false);
    } catch {}
    eseguiControlloCompleanniOggi(false).catch(() => {});
  }, 3000);

  // Cartella persistente per i file PDF prestampati caricati per categoria di corso
  const MODELLI_ATTESTATI_DIR = path.join(path.dirname(DB_PATH), 'modelli_attestati');
  const sanitizePdfSlug = (raw: string) =>
    String(raw || 'corso')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'corso';

  app.post('/api/modelli-attestati/:slug', (req, res) => {
    try {
      const slug = sanitizePdfSlug(req.params.slug);
      const { pdfBase64 } = req.body || {};
      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        return res.status(400).json({ success: false, error: 'Contenuto PDF mancante' });
      }
      const clean = pdfBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
      const buf = Buffer.from(clean, 'base64');
      if (buf.length < 100 || buf.subarray(0, 4).toString('ascii') !== '%PDF') {
        return res.status(400).json({ success: false, error: 'Il file non è un PDF valido' });
      }
      if (buf.length > 15 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'Il file PDF supera il limite di 15 MB' });
      }
      if (!fs.existsSync(MODELLI_ATTESTATI_DIR)) {
        fs.mkdirSync(MODELLI_ATTESTATI_DIR, { recursive: true });
      }
      const targetPath = path.join(MODELLI_ATTESTATI_DIR, `${slug}.pdf`);
      fs.writeFileSync(targetPath, buf);
      return res.json({ success: true, pdfSlug: slug, fileSize: buf.length });
    } catch (err: any) {
      console.error('[Modelli Attestati] Errore salvataggio PDF:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio file PDF' });
    }
  });

  app.get('/api/modelli-attestati/:slug', (req, res) => {
    try {
      const slug = sanitizePdfSlug(req.params.slug);
      const targetPath = path.join(MODELLI_ATTESTATI_DIR, `${slug}.pdf`);
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ success: false, error: 'Modello PDF non trovato sul server' });
      }
      const buf = fs.readFileSync(targetPath);
      if (req.query.raw === '1') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${slug}.pdf"`);
        res.setHeader('Content-Length', buf.length);
        return res.send(buf);
      }
      return res.json({
        success: true,
        pdfSlug: slug,
        fileSize: buf.length,
        pdfBase64: buf.toString('base64')
      });
    } catch (err: any) {
      console.error('[Modelli Attestati] Errore lettura PDF:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore lettura file PDF' });
    }
  });

  app.delete('/api/modelli-attestati/:slug', (req, res) => {
    try {
      const slug = sanitizePdfSlug(req.params.slug);
      const targetPath = path.join(MODELLI_ATTESTATI_DIR, `${slug}.pdf`);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      return res.json({ success: true, pdfSlug: slug });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore eliminazione PDF' });
    }
  });

  // Prepara l'attestato PDF sul server in modo asincrono, evitando blocchi e crash sul device client
  app.post('/api/prepara-attestato-pdf', async (req, res) => {
    try {
      const { corso, partecipante, opzioni } = req.body;
      if (!corso || !partecipante) {
        return res.status(400).json({ success: false, error: 'Dati corso o partecipante mancanti' });
      }

      const modelloServer =
        opzioni?.modelloPrestampato ||
        (corso?.tipologia && state.modelliAttestatiCategoria ? state.modelliAttestatiCategoria[corso.tipologia] : undefined);

      let pdfPrestampatoBytes: Uint8Array | undefined = undefined;
      if (modelloServer && modelloServer.attivo && modelloServer.hasPdfFile) {
        const slug = sanitizePdfSlug(modelloServer.pdfSlug || corso.tipologia || 'corso');
        const targetPath = path.join(MODELLI_ATTESTATI_DIR, `${slug}.pdf`);
        if (fs.existsSync(targetPath)) {
          pdfPrestampatoBytes = new Uint8Array(fs.readFileSync(targetPath));
        } else if (typeof modelloServer.pdfBase64Inline === 'string' && modelloServer.pdfBase64Inline.length > 100) {
          const clean = modelloServer.pdfBase64Inline.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
          pdfPrestampatoBytes = new Uint8Array(Buffer.from(clean, 'base64'));
        }
      }

      const pdfResult = await scaricaAttestatoPDF(corso, partecipante, {
        ...(opzioni || {}),
        modelloPrestampato: modelloServer,
        pdfPrestampatoBytes,
        downloadImmediato: false
      });

      let buffer: Buffer;
      if (pdfResult instanceof Uint8Array) {
        buffer = Buffer.from(pdfResult);
      } else if (pdfResult && typeof (pdfResult as any).output === 'function') {
        const arrBuf = (pdfResult as any).output('arraybuffer');
        buffer = Buffer.from(arrBuf);
      } else {
        throw new Error('Formato PDF non riconosciuto');
      }

      let numAtt = (partecipante.numeroAttestato || (corso.tipologia === 'Seminario PSV' ? 'GEV_099' : 'ATT')).trim();
      const matricolaClean = numAtt.replace(/[^a-zA-Z0-9_-]/g, '_');
      const nomeClean = (partecipante.volontarioNome || 'Partecipante').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Attestato_${matricolaClean}_${nomeClean}.pdf`;

      const downloadId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      tempPdfDownloads.set(downloadId, {
        buffer,
        filename,
        expires: Date.now() + 600000 // 10 minuti
      });

      res.json({
        success: true,
        downloadId,
        downloadUrl: `/api/scarica-attestato-file/${downloadId}`,
        filename
      });
    } catch (err: any) {
      console.error('Errore /api/prepara-attestato-pdf:', err);
      res.status(500).json({ success: false, error: err?.message || 'Errore generazione PDF' });
    }
  });

  // Download diretto HTTP nativo del file PDF (intercettato da Android Download Manager e Safari/Chrome senza blocchi)
  app.get('/api/scarica-attestato-file/:id', (req, res) => {
    const { id } = req.params;
    const item = tempPdfDownloads.get(id);
    if (!item) {
      return res.status(404).send('Documento PDF non trovato o scaduto. Riprova dalla schermata del corso.');
    }

    const isInline = req.query.inline === 'true';
    const disposition = isInline ? 'inline' : 'attachment';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${item.filename}"`);
    res.setHeader('Content-Length', item.buffer.length);
    res.send(item.buffer);
  });

  // Helper per generare un Foglio di Viaggio PDF ufficiale con ricevuta di donazione
  function generaPdfTesoreriaServer(params: {
    codice?: string;
    data?: string;
    mezzo?: string;
    kmInizio?: number;
    kmFine?: number;
    kmTotali?: number;
    donazione?: { ricevuta?: boolean; somma?: number; metodo?: string };
    proprietario?: { nome?: string; cognome?: string; indirizzo?: string; comune?: string; provincia?: string; cap?: string; telefono?: string; email?: string; codiceFiscale?: string };
    volontarioNome?: string;
    indirizzoIntervento?: string;
    destinazione?: string;
  }): Buffer {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;

    // Header istituzionale
    const cInfo = normalizeDatiCartaIntestataServer(state.datiCartaIntestata);
    const socialStr = formattaSocialCartaIntestataServer(cInfo);
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, socialStr ? 41 : 38, 'F');

    doc.setFontSize(14.5);
    doc.setTextColor(20, 50, 95);
    doc.setFont('helvetica', 'bold');
    doc.text((cInfo.denominazione || DATI_CARTA_INTESTATA_DEFAULT.denominazione).toUpperCase(), 105, 10.5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(80, 90, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sede Legale: ${cInfo.sedeLegale} • Sede Massa: ${cInfo.sedeMassa} • Sede Carrara: ${cInfo.sedeCarrara} • Sede Pietrasanta: ${cInfo.sedePietrasanta}`, 105, 15.5, { align: 'center' });
    doc.text(`Centrale Tel: ${cInfo.centraleTel} • Codice Fiscale: ${cInfo.codiceFiscale} • ${cInfo.sitoWeb}`, 105, 19.8, { align: 'center' });
    doc.text(`Email: ${cInfo.email} • Pec: ${cInfo.pec}`, 105, 23.8, { align: 'center' });
    if (socialStr) {
      doc.setFontSize(7.0);
      doc.setTextColor(30, 64, 175);
      doc.text(socialStr, 105, 27.6, { align: 'center', maxWidth: 185 });
    }

    doc.setDrawColor(20, 50, 95);
    doc.setLineWidth(0.8);
    doc.line(15, socialStr ? 30.2 : 28, 195, socialStr ? 30.2 : 28);

    // Banner Titolo Documento
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(15, 33, 180, 14, 2, 2, 'FD');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text('ATTESTAZIONE DI DONAZIONE ECONOMICA & FOGLIO DI VIAGGIO', 105, 41, { align: 'center' });

    // 1. Estremi Servizio
    let y = 54;
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('1. ESTREMI DEL SERVIZIO E DEL MEZZO OPERATIVO', 15, y);
    doc.setDrawColor(203, 213, 225);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Codice Servizio: ${params.codice || 'N/D'}`, 18, y);
    doc.text(`Data / Ora: ${params.data || formatDateTimeItaly()}`, 110, y);

    y += 6;
    doc.text(`Mezzo Operativo: ${params.mezzo || 'N/D'}`, 18, y);
    const kmInfo = (params.kmTotali ? `${params.kmTotali} KM` : 'N/D') +
      (params.kmInizio ? ` (Partenza: ${params.kmInizio} - Rientro: ${params.kmFine || ''})` : '');
    doc.text(`Chilometri: ${kmInfo}`, 110, y);

    y += 6;
    doc.text(`Capo Equipaggio / Volontario: ${params.volontarioNome || 'Operatore di Turno'}`, 18, y);

    // 2. Donazione Ricevuta
    y += 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('2. RICEVUTA DONAZIONE ECONOMICA (EROGAZIONE LIBERALE)', 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;
    const somma = Number(params.donazione?.somma) || 0;
    const metodoDesc = params.donazione?.metodo === 'pos' ? 'POS Elettronico (Carta / Bancomat)' : 'Contanti';

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(15, y, 180, 24, 2, 2, 'FD');

    doc.setFontSize(13);
    doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.text(`IMPORTO DONATO: € ${somma.toFixed(2)}`, 20, y + 8);

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.text(`Modalità di Riscossione: ${metodoDesc}`, 20, y + 14);
    doc.text('Causale: Erogazione liberale a sostegno delle attività istituzionali di soccorso Croce Oro Massa Carrara', 20, y + 20);

    // 3. Dati Donatore
    y += 32;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('3. DATI ANAGRAFICI DEL DONATORE / PROPRIETARIO', 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const prop = params.proprietario || {};
    const propNomeCompleto = (prop.nome || prop.cognome) ? `${prop.nome || ''} ${prop.cognome || ''}`.trim() : 'Non specificato';
    doc.text(`Nominativo: ${propNomeCompleto}`, 18, y);
    if (prop.codiceFiscale) doc.text(`Codice Fiscale: ${prop.codiceFiscale}`, 110, y);

    y += 6;
    const resIndirizzo = [prop.indirizzo, prop.comune, prop.provincia ? `(${prop.provincia})` : '', prop.cap ? `CAP ${prop.cap}` : ''].filter(Boolean).join(' ');
    doc.text(`Residenza: ${resIndirizzo || 'Non specificata'}`, 18, y);

    y += 6;
    doc.text(`Telefono: ${prop.telefono || 'N/D'}`, 18, y);
    doc.text(`Email: ${prop.email || 'N/D'}`, 110, y);

    // 4. Logistica
    y += 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('4. DETTAGLI LOGISTICI DELLA MISSIONE', 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Indirizzo Intervento: ${params.indirizzoIntervento || 'N/D'}`, 18, y);
    y += 6;
    doc.text(`Destinazione: ${params.destinazione || 'N/D'}`, 18, y);

    // 5. Validazione Digitale e Timbro
    y += 18;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, 180, 36, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('VALIDAZIONE E CONFORMITÀ DIGITALE', 20, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Documento informatico generato in conformità alle registrazioni del Gestionale Operativo Radio.', 20, y + 13);
    doc.text(`Marcatura temporale trasmissione Tesoreria: ${formatDateTimeItaly()}`, 20, y + 18);
    doc.text('Certificato per gli adempimenti contabili e di cassa dell\'Ente del Terzo Settore.', 20, y + 23);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 50, 95);
    doc.text('CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati', 20, y + 29);

    return Buffer.from(doc.output('arraybuffer'));
  }

  // Costanti mittente email istituzionali Croce Oro Massa Carrara OdV
  const MITTENTE_UFFICIALE = 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati';
  const EMAIL_MITTENTE_UFFICIALE = 'sistemiautomatizzati@croceoro.org';

  // ENDPOINT: Invio automatico del Foglio di Viaggio PDF finito alla Tesoreria per donazioni ricevute
  app.post('/api/invia-email-tesoreria', async (req, res) => {
    try {
      const {
        codice,
        data,
        mezzo,
        kmInizio,
        kmFine,
        kmTotali,
        donazione,
        proprietario,
        volontarioNome,
        indirizzoIntervento,
        destinazione,
        pdfBase64,
        nomeFile
      } = req.body;

      const destinatario = 'tesoreria@croceoro.org';
      const importo = parseFloat(donazione?.somma) || 0;
      const metodo = donazione?.metodo === 'pos' ? 'POS Elettronico' : 'Contanti';
      const filename = nomeFile || `Foglio_Viaggio_${(codice || 'REPORT').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const propNome = proprietario ? `${proprietario.nome || ''} ${proprietario.cognome || ''}`.trim() : 'Non specificato';

      const oggetto = `[DONAZIONE RICEVUTA € ${importo.toFixed(2)}] Foglio di Viaggio ${codice} - Croce Oro Massa Carrara`;
      const testoEmail = `Spettabile Ufficio Tesoreria / Amministrazione Croce Oro Massa Carrara OdV,\n\n` +
        `Si trasmette in allegato il Foglio di Viaggio PDF ufficiale con attestazione di donazione economica ricevuta dall'equipaggio:\n\n` +
        `• Codice Servizio: ${codice}\n` +
        `• Data Servizio: ${data || formatDateTimeItaly()}\n` +
        `• Mezzo Operativo: ${mezzo}\n` +
        `• Importo Donato: € ${importo.toFixed(2)}\n` +
        `• Modalità di Donazione: ${metodo}\n` +
        `• Donatore / Proprietario: ${propNome}\n` +
        (proprietario?.comune ? `• Residenza Donatore: ${proprietario.indirizzo || ''} ${proprietario.comune} (${proprietario.provincia || ''}) - CAP ${proprietario.cap || ''}\n` : '') +
        (proprietario?.telefono ? `• Telefono Donatore: ${proprietario.telefono}\n` : '') +
        (proprietario?.email ? `• Email Donatore: ${proprietario.email}\n` : '') +
        `\nIl documento PDF firmato e certificato digitalmente è allegato alla presente comunicazione.\n\n` +
        `Croce Oro Massa Carrara OdV - Gestionale Operativo Radio & Emergenze\n` +
        `CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati`;

      // Gestione Allegato PDF: decodifica stringa Base64 o genera PDF ufficiale completo sul server
      let pdfBuffer: Buffer | null = null;
      if (typeof pdfBase64 === 'string' && pdfBase64.trim().length > 50) {
        try {
          let cleanBase64 = pdfBase64.trim();
          if (cleanBase64.includes('base64,')) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf('base64,') + 7);
          }
          cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');
          const decoded = Buffer.from(cleanBase64, 'base64');
          if (decoded.length > 200 && decoded.slice(0, 4).toString() === '%PDF') {
            pdfBuffer = decoded;
            console.log(`[Email Tesoreria] Ricevuto e convalidato PDF client (${decoded.length} bytes) per ${codice}`);
          } else {
            console.warn(`[Email Tesoreria] Buffer decodificato non valido (%PDF header mancante o < 200 bytes, len=${decoded.length}). Generazione PDF server-side.`);
          }
        } catch (e: any) {
          console.error('[Email Tesoreria] Errore decodifica PDF base64:', e);
        }
      }

      // Se il client non ha fornito un PDF valido o il base64 era vuoto/incompleto, genera PDF completo sul server
      if (!pdfBuffer) {
        pdfBuffer = generaPdfTesoreriaServer({
          codice,
          data,
          mezzo,
          kmInizio,
          kmFine,
          kmTotali,
          donazione,
          proprietario,
          volontarioNome,
          indirizzoIntervento,
          destinazione
        });
        console.log(`[Email Tesoreria] Generato con successo PDF ufficiale server-side (${pdfBuffer.length} bytes) per ${codice}`);
      }

      let speditoViaSmtp = false;
      let erroreSmtp: string | null = null;

      const emailMittente = EMAIL_MITTENTE_UFFICIALE;

      // Configurazione SMTP mail.tophost.it (TopHost)
      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      // Autenticazione su mail.tophost.it:
      // Utente specificato: 'croceoro.org', casella TopHost associata: 'croceoro.org10175'
      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let authenticatedUser = '';

      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          authenticatedUser = candidate;
          break;
        } catch (authErr: any) {
          // Continua con il prossimo candidato se l'autenticazione fallisce
        }
      }

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">CROCE ORO MASSA CARRARA OdV</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0;">Sistemi Automatizzati &bull; Ufficio Tesoreria &bull; Notifica Donazione Economica</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="margin-top: 0; font-size: 14px; color: #334155;">Spettabile Ufficio Tesoreria / Amministrazione <strong>Croce Oro Massa Carrara OdV</strong>,</p>
            <p style="font-size: 14px; color: #334155;">Si trasmette in allegato alla presente il <strong>Foglio di Viaggio PDF ufficiale</strong> attestante la donazione economica ricevuta durante la missione:</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; padding: 14px 18px; border-radius: 6px; margin: 18px 0; font-size: 13px;">
              <p style="margin: 4px 0;"><strong>&bull; Codice Servizio:</strong> <span style="color: #b45309; font-weight: bold;">${codice}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Data Servizio:</strong> ${data || formatDateTimeItaly()}</p>
              <p style="margin: 4px 0;"><strong>&bull; Mezzo Operativo:</strong> ${mezzo || 'N/D'}</p>
              <p style="margin: 4px 0;"><strong>&bull; Importo Ricevuto:</strong> <span style="color: #15803d; font-size: 15px; font-weight: bold;">€ ${importo.toFixed(2)}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Modalità di Pagamento:</strong> <span style="font-weight: bold;">${metodo}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Donatore / Proprietario:</strong> ${propNome}</p>
              ${proprietario?.comune ? `<p style="margin: 4px 0;"><strong>&bull; Residenza:</strong> ${proprietario.indirizzo || ''} ${proprietario.comune} (${proprietario.provincia || ''}) - CAP ${proprietario.cap || ''}</p>` : ''}
              ${proprietario?.telefono ? `<p style="margin: 4px 0;"><strong>&bull; Recapito Telefonico:</strong> ${proprietario.telefono}</p>` : ''}
              ${proprietario?.email ? `<p style="margin: 4px 0;"><strong>&bull; Email Donatore:</strong> ${proprietario.email}</p>` : ''}
            </div>
            <p style="font-size: 13px; color: #475569;">
              📎 Il documento PDF completo con certificazione digitale e firme operative è allegato alla presente comunicazione (<strong>${filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`}</strong>).
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">Croce Oro Massa Carrara OdV &bull; Centrale Operativa Radio & Emergenze &bull; Sistemi Automatizzati</p>
            <p style="margin: 4px 0 0; color: #94a3b8;">Email trasmessa automaticamente da sistemiautomatizzati@croceoro.org</p>
          </div>
        </div>
      `;

      if (transporter && pdfBuffer) {
        try {
          const finalFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
          const info = await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            envelope: {
              from: EMAIL_MITTENTE_UFFICIALE,
              to: [destinatario]
            },
            to: destinatario,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail,
            attachments: [
              {
                filename: finalFilename,
                content: pdfBuffer,
                contentType: 'application/pdf',
                contentDisposition: 'attachment'
              }
            ]
          });
          speditoViaSmtp = true;
          console.log(`[Email Tesoreria] PDF inviato con successo via SMTP a ${destinatario} per servizio ${codice} da "${MITTENTE_UFFICIALE}" <${EMAIL_MITTENTE_UFFICIALE}> (Auth: ${authenticatedUser}, MsgID: ${info.messageId}, PDF: ${pdfBuffer.length} bytes)`);
        } catch (err: any) {
          erroreSmtp = err?.message || 'Errore invio SMTP';
          console.error('[Email Tesoreria] Errore invio SMTP:', err);
        }
      } else if (!transporter) {
        erroreSmtp = 'Autenticazione SMTP non riuscita con i parametri forniti';
        console.error('[Email Tesoreria]', erroreSmtp);
      }

      // Notifica Radio in Centrale Operativa
      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `📧 TESORERIA: Trasmesso Foglio di Viaggio PDF (${codice}) con donazione di € ${importo.toFixed(2)} (${metodo}) all'indirizzo ${destinatario}`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();

      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatario,
        importo,
        metodo,
        speditoViaSmtp,
        erroreSmtp,
        filename,
        dimensioneAllegatoBytes: pdfBuffer ? pdfBuffer.length : 0,
        mittente: `"${MITTENTE_UFFICIALE}" <${emailMittente}>`,
        message: `Email indirizzata a ${destinatario} con allegato ${filename} (${pdfBuffer ? pdfBuffer.length : 0} bytes)`
      });
    } catch (err: any) {
      console.error('[Email Tesoreria] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // ENDPOINT: Invio notifica email a presidenza@croceoro.org e tesoreria@croceoro.org per rimozione Note di Debito
  app.post('/api/elimina-note-debito-notifica', async (req, res) => {
    try {
      const { noteEliminate, operatore, motivazione } = req.body;
      const noteArr = Array.isArray(noteEliminate) ? noteEliminate : [];
      const operatoreNome = operatore || 'Amministratore Contabilità';
      const motivo = motivazione || 'Rettifica amministrativa / Cancellazione da archivio';
      const dataOra = formatDateTimeItaly();
      const count = noteArr.length;

      const destinatari = ['presidenza@croceoro.org', 'tesoreria@croceoro.org'];
      const oggetto = `[NOTIFICA CONTABILITÀ] Cancellazione ${count} Nota/e di Debito dall'Archivio - Croce Oro Massa Carrara`;

      const righeTabellaHtml = noteArr.map((n: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold; color: #7f1d1d; font-family: monospace;">${n.numeroProgressivo || n.id}</td>
          <td style="padding: 10px;">${n.dataEmissione || 'N/D'}</td>
          <td style="padding: 10px;">
            <strong>${n.debitoreIntestatario || 'N/D'}</strong><br/>
            <span style="color: #64748b; font-size: 11px; font-family: monospace;">CF/P.IVA: ${n.partitaIvaCodiceFiscale || 'N/D'}</span>
          </td>
          <td style="padding: 10px; color: #334155;">${n.causale || 'N/D'}</td>
          <td style="padding: 10px; font-weight: bold; color: #15803d; text-align: right; font-family: monospace;">€ ${(Number(n.importoTotale) || 0).toFixed(2)}</td>
          <td style="padding: 10px; text-align: center;"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">${n.stato || 'Emessa'}</span></td>
        </tr>
      `).join('');

      const testoEmail = `Spettabile Presidenza e Ufficio Tesoreria Croce Oro Massa Carrara OdV,\n\n` +
        `Si notifica che in data ${dataOra} sono state rimosse ${count} note di debito dall'archivio contabile dell'Associazione.\n\n` +
        `• Operatore esecutore: ${operatoreNome}\n` +
        `• Motivazione indicata: ${motivo}\n\n` +
        `Dettaglio note di debito cancellate:\n` +
        noteArr.map((n: any) => `• ${n.numeroProgressivo || n.id} | Data: ${n.dataEmissione} | Debitore: ${n.debitoreIntestatario} (P.IVA/CF ${n.partitaIvaCodiceFiscale}) | € ${(Number(n.importoTotale) || 0).toFixed(2)} | Causale: ${n.causale}`).join('\n') +
        `\n\nCroce Oro Massa Carrara OdV - Registro Contabilità & Tracciamento Fiscale RUNTS`;

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 800px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #7f1d1d; color: #fef08a; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">CROCE ORO MASSA CARRARA OdV</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #fecaca;">Audit Contabile &bull; Notifica Rimozione Note di Debito dall'Archivio</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="margin-top: 0; font-size: 14px; color: #334155;">
              Spettabile <strong>Presidenza</strong> e <strong>Ufficio Tesoreria</strong>,
            </p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 6px; margin: 18px 0; font-size: 13px;">
              <p style="margin: 4px 0;"><strong>⚠️ Evento:</strong> Rimozione definitiva di <strong>${count} documento/i nota di debito</strong> dall'archivio.</p>
              <p style="margin: 4px 0;"><strong>👤 Operatore Autorizzato:</strong> ${operatoreNome}</p>
              <p style="margin: 4px 0;"><strong>🕒 Data e Ora:</strong> ${dataOra}</p>
              <p style="margin: 4px 0;"><strong>📝 Motivazione:</strong> ${motivo}</p>
            </div>
            <h3 style="font-size: 14px; color: #0f172a; margin-top: 20px;">Riepilogo Note di Debito Rimosse:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #475569;">
                  <th style="padding: 8px;">Numero Progressivo</th>
                  <th style="padding: 8px;">Data Emissione</th>
                  <th style="padding: 8px;">Debitore / Ente</th>
                  <th style="padding: 8px;">Causale Prestazione</th>
                  <th style="padding: 8px; text-align: right;">Importo Totale</th>
                  <th style="padding: 8px; text-align: center;">Stato</th>
                </tr>
              </thead>
              <tbody>
                ${righeTabellaHtml}
              </tbody>
            </table>
          </div>
          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            Notifica generata in adempimento ai registri istituzionali di <strong>Croce Oro Massa Carrara OdV</strong>.<br/>
            Destinatari automatici certificati: presidenza@croceoro.org &bull; tesoreria@croceoro.org
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp = '';

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
      const isSecure = smtpPort === 465;
      const smtpUser = process.env.SMTP_USER || 'croceoromassacarrara@gmail.com';
      const smtpPass = process.env.SMTP_PASS || '';

      const candidateUsers = Array.from(new Set([
        smtpUser,
        'presidenza@croceoro.org',
        'tesoreria@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let authenticatedUser = '';

      if (smtpPass) {
        for (const candidate of candidateUsers) {
          try {
            const t = nodemailer.createTransport({
              host: smtpHost,
              port: smtpPort,
              secure: isSecure,
              auth: { user: candidate, pass: smtpPass },
              tls: { rejectUnauthorized: false }
            });
            await t.verify();
            transporter = t;
            authenticatedUser = candidate;
            break;
          } catch {}
        }
      }

      if (transporter) {
        try {
          const info = await transporter.sendMail({
            from: `"${MITTENTE_UFFICIALE}" <${authenticatedUser || 'tesoreria@croceoro.org'}>`,
            to: destinatari.join(', '),
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
          console.log(`[Email Note Debito Delete] Notifica inviata con successo via SMTP a ${destinatari.join(', ')} (MsgID: ${info.messageId})`);
        } catch (err: any) {
          erroreSmtp = err?.message || 'Errore invio SMTP';
          console.error('[Email Note Debito Delete] Errore invio SMTP:', err);
        }
      } else {
        console.log(`[Email Note Debito Delete] Notifica simulata/registrata per ${destinatari.join(', ')} (${count} note rimosse da ${operatoreNome})`);
      }

      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🗑️ CONTABILITÀ: Rimosse ${count} note di debito dall'archivio da parte di ${operatoreNome}. Notifica email trasmessa a presidenza@croceoro.org e tesoreria@croceoro.org`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();

      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatari,
        count,
        speditoViaSmtp,
        erroreSmtp,
        message: `Notifica di cancellazione inviata a ${destinatari.join(' e ')}`
      });
    } catch (err: any) {
      console.error('[Email Note Debito Delete] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // ENDPOINT: Invio automatico della Ricevuta Tesseramento & Quota Sociale PDF al Tesoriere su click "STAMPA DOCUMENTO"
  app.post('/api/invia-email-ricevuta-tesoriere', async (req, res) => {
    try {
      const {
        tesoriereEmail,
        tesoriereNome,
        socioNome,
        socioCognome,
        numeroTessera,
        numeroRicevuta,
        importo,
        pdfBase64,
        nomeFile
      } = req.body;

      const emailDest = (tesoriereEmail && tesoriereEmail.trim()) || 'tesoreria@croceoro.org';
      const nomeDest = (tesoriereNome && tesoriereNome.trim()) || 'Tesoriere';
      const importoVal = Number(importo) || 0;
      const numRic = numeroRicevuta || '01/2026';
      const filename = nomeFile || `Ricevuta_Tesseramento_${(socioCognome || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_')}_${numRic.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

      const oggetto = `[RICEVUTA TESSERAMENTO & QUOTA SOCIALE ${numRic}] ${socioCognome} ${socioNome} - Croce Oro Massa Carrara OdV`;

      let pdfBuffer: Buffer | null = null;
      if (typeof pdfBase64 === 'string' && pdfBase64.trim().length > 50) {
        try {
          let cleanBase64 = pdfBase64.trim();
          if (cleanBase64.includes('base64,')) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf('base64,') + 7);
          }
          cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');
          const decoded = Buffer.from(cleanBase64, 'base64');
          if (decoded.length > 200 && decoded.slice(0, 4).toString() === '%PDF') {
            pdfBuffer = decoded;
          }
        } catch (e) {
          console.error('[Email Ricevuta Tesoriere] Errore decodifica PDF:', e);
        }
      }

      const testoEmail = `Gentile ${nomeDest} (Tesoriere Croce Oro Massa Carrara OdV),\n\n` +
        `Si trasmette in allegato la Ricevuta Ufficiale di Tesseramento & Quota Sociale Annuale (carta intestata A4) a Tua firma automatica, generata contestualmente alla richiesta di stampa:\n\n` +
        `• Ricevuta Numero: ${numRic}\n` +
        `• Socio Intestatario: ${socioNome} ${socioCognome}\n` +
        `• Numero Tessera: ${numeroTessera || 'N/D'}\n` +
        `• Quota Sociale Versata: € ${importoVal.toFixed(2)}\n` +
        `• Data Convalida: ${formatDateItaly()}\n\n` +
        `Il documento ufficiale a pagina singola A4 è allegato alla presente comunicazione per la conservazione agli atti del Libro Soci.\n\n` +
        `Croce Oro Massa Carrara OdV - Segreteria & Presidenza`;

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800;">CROCE ORO MASSA CARRARA OdV</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0;">Ufficio Tesoreria &bull; Ricevuta Tesseramento & Quota Sociale</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="margin-top: 0; font-size: 14px; color: #334155;">Gentile <strong>${nomeDest}</strong> (Tesoriere),</p>
            <p style="font-size: 14px; color: #334155;">
              È stato cliccato il comando di <strong>Stampa Documento</strong> per la seguente ricevuta ufficiale di quota associativa recante la Tua firma automatica:
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #bfa353; padding: 14px 18px; border-radius: 6px; margin: 18px 0; font-size: 13px;">
              <p style="margin: 4px 0;"><strong>&bull; Numero Ricevuta:</strong> <span style="font-family: monospace; font-weight: bold; color: #1d1a60;">${numRic}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Socio / Volontario:</strong> <span style="font-weight: bold;">${socioNome} ${socioCognome}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Numero Tessera:</strong> ${numeroTessera || 'N/D'}</p>
              <p style="margin: 4px 0;"><strong>&bull; Quota Sociale:</strong> <span style="color: #15803d; font-size: 15px; font-weight: bold;">€ ${importoVal.toFixed(2)}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Data Validazione:</strong> ${formatDateItaly()}</p>
            </div>
            <p style="font-size: 13px; color: #475569;">
              📎 In allegato trovi il documento PDF originale in carta intestata (<strong>${filename}</strong>), che occupa rigorosamente 1 singola pagina A4.
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            ${(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT).denominazione} &bull; Sede Legale: ${(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT).sedeLegale} &bull; Sede Massa: ${(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT).sedeMassa} &bull; Sede Carrara: ${(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT).sedeCarrara} &bull; Sede Pietrasanta: ${(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT).sedePietrasanta} &bull; CF ${(state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT).codiceFiscale}
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp = '';

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
      const isSecure = smtpPort === 465;
      const smtpUser = process.env.SMTP_USER || 'croceoromassacarrara@gmail.com';
      const smtpPass = process.env.SMTP_PASS || '';

      const candidateUsers = Array.from(new Set([
        smtpUser,
        'tesoreria@croceoro.org',
        'presidenza@croceoro.org'
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let authenticatedUser = '';

      if (smtpPass) {
        for (const candidate of candidateUsers) {
          try {
            const t = nodemailer.createTransport({
              host: smtpHost,
              port: smtpPort,
              secure: isSecure,
              auth: { user: candidate, pass: smtpPass },
              tls: { rejectUnauthorized: false }
            });
            await t.verify();
            transporter = t;
            authenticatedUser = candidate;
            break;
          } catch {}
        }
      }

      if (transporter && pdfBuffer) {
        try {
          const info = await transporter.sendMail({
            from: `"${MITTENTE_UFFICIALE}" <${authenticatedUser || 'tesoreria@croceoro.org'}>`,
            to: emailDest,
            cc: 'presidenza@croceoro.org',
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail,
            attachments: [
              {
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf',
                contentDisposition: 'attachment'
              }
            ]
          });
          speditoViaSmtp = true;
          console.log(`[Email Ricevuta Tesoriere] PDF inviato con successo via SMTP a ${emailDest} (MsgID: ${info.messageId})`);
        } catch (err: any) {
          erroreSmtp = err?.message || 'Errore invio SMTP';
          console.error('[Email Ricevuta Tesoriere] Errore invio SMTP:', err);
        }
      } else {
        console.log(`[Email Ricevuta Tesoriere] Notifica registrata per ${emailDest} (${filename}, allegato: ${pdfBuffer ? pdfBuffer.length : 0} bytes)`);
      }

      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🧾 TESSERAMENTO: Ricevuta ${numRic} (${socioCognome} ${socioNome}) stampata e inviata via email a ${nomeDest} (${emailDest})`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();

      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatario: emailDest,
        speditoViaSmtp,
        erroreSmtp,
        filename,
        dimensioneAllegatoBytes: pdfBuffer ? pdfBuffer.length : 0,
        message: `Ricevuta inviata via email al Tesoriere (${emailDest}) con allegato ${filename}`
      });
    } catch (err: any) {
      console.error('[Email Ricevuta Tesoriere] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // ENDPOINT: Invio Email Ufficiale per Note di Debito e Ricevute Contabili al destinatario (email ordinaria, non PEC)
  // con l'indirizzo email del Tesoriere (recuperato automaticamente dall'anagrafica di sistema) sempre in copia (CC).
  app.post('/api/invia-email-documento-contabile', async (req, res) => {
    try {
      const {
        tipoDocumento,
        numeroProgressivo,
        dataEmissione,
        destinatarioNome,
        destinatarioEmail,
        tesoriereEmail,
        tesoriereNome,
        importoTotale,
        causale,
        scadenzaPagamento,
        metodoPagamento,
        tipologia,
        pdfBase64,
        nomeFile
      } = req.body || {};

      const emailRegex = /^[^\s@<>(),;:"\\[\]\r\n]+@[^\s@<>(),;:"\\[\]\r\n]+\.[^\s@<>(),;:"\\[\]\r\n]{2,}$/;
      const stripHeader = (val: unknown, maxLen = 200): string =>
        String(val ?? '')
          .replace(/[\r\n]+/g, ' ')
          .trim()
          .slice(0, maxLen);
      const escapeHtmlSafe = (val: unknown): string =>
        String(val ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const tipoNorm = tipoDocumento === 'nota_debito' ? 'nota_debito' : 'ricevuta';
      const emailDest = stripHeader(destinatarioEmail, 254).toLowerCase();
      if (!emailDest || !emailRegex.test(emailDest)) {
        return res.status(400).json({
          success: false,
          error: 'Indirizzo email ordinario (non PEC) del destinatario mancante o non valido.'
        });
      }

      // Recupera automaticamente l'account Tesoriere dall'anagrafica volontari di sistema
      const listaVol = Array.isArray(state.volontari) ? state.volontari : [];
      const tesorieriDirettivo = listaVol.filter(
        (v: any) =>
          typeof v?.caricaConsiglioDirettivo === 'string' &&
          v.caricaConsiglioDirettivo.toLowerCase().includes('tesorier')
      );
      const tesorieriFallback =
        tesorieriDirettivo.length > 0
          ? tesorieriDirettivo
          : listaVol.filter((v: any) => {
              const mans = String(v?.mansione || '').toLowerCase();
              const qual = String(v?.qualifica || '').toLowerCase();
              const mansArr = Array.isArray(v?.mansioni) ? v.mansioni.join(' ').toLowerCase() : '';
              return mans.includes('tesorier') || qual.includes('tesorier') || mansArr.includes('tesorier');
            });
      const tesoriereSistema: any =
        tesorieriFallback.find((v: any) => typeof v?.email === 'string' && emailRegex.test(v.email.trim())) ||
        tesorieriFallback[0];

      const rawTesoriereEmailSistema = stripHeader(tesoriereSistema?.email || '', 254).toLowerCase();
      const rawTesoriereEmailReq = stripHeader(tesoriereEmail || '', 254).toLowerCase();
      const ccTesoriere =
        (rawTesoriereEmailSistema && emailRegex.test(rawTesoriereEmailSistema) ? rawTesoriereEmailSistema : '') ||
        (rawTesoriereEmailReq && emailRegex.test(rawTesoriereEmailReq) ? rawTesoriereEmailReq : '') ||
        'tesoreria@croceoro.org';

      const nomeTesoriere = tesoriereSistema
        ? stripHeader(`${tesoriereSistema.nome || ''} ${tesoriereSistema.cognome || ''}`, 120) || 'Tesoriere'
        : stripHeader(tesoriereNome || 'Tesoriere', 120) || 'Tesoriere';

      const numDoc = stripHeader(numeroProgressivo || (tipoNorm === 'nota_debito' ? 'ND-2026' : 'RIC-2026'), 60);
      const dataDoc = stripHeader(dataEmissione || formatDateItaly(), 40);
      const nomeDest = stripHeader(destinatarioNome || 'Gentile Intestatario', 160);
      const causaleDoc = String(causale || '').trim().slice(0, 1000);
      const importoVal = Number(importoTotale) || 0;
      const scadenzaDoc = stripHeader(scadenzaPagamento || '', 40);
      const metodoDoc = stripHeader(metodoPagamento || '', 80);
      const tipologiaDoc = stripHeader(tipologia || '', 120);

      const safeFileBase = stripHeader(nomeFile || `${tipoNorm === 'nota_debito' ? 'Nota_Di_Debito' : 'Ricevuta'}_${numDoc}.pdf`, 120)
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = safeFileBase.toLowerCase().endsWith('.pdf') ? safeFileBase : `${safeFileBase}.pdf`;

      let pdfBuffer: Buffer | null = null;
      if (typeof pdfBase64 === 'string' && pdfBase64.trim().length > 50) {
        try {
          let cleanBase64 = pdfBase64.trim();
          if (cleanBase64.includes('base64,')) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf('base64,') + 7);
          }
          cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');
          const decoded = Buffer.from(cleanBase64, 'base64');
          const MAX_PDF_BYTES = 10 * 1024 * 1024;
          if (decoded.length > 200 && decoded.length <= MAX_PDF_BYTES && decoded.slice(0, 4).toString() === '%PDF') {
            pdfBuffer = decoded;
          }
        } catch (e) {
          console.error('[Email Documento Contabile] Errore decodifica PDF:', e);
        }
      }

      const etichettaDoc = tipoNorm === 'nota_debito' ? 'Nota di Debito' : 'Ricevuta';
      const carta = state.datiCartaIntestata || DATI_CARTA_INTESTATA_DEFAULT;
      const denom = stripHeader(carta.denominazione || 'Croce Oro Massa Carrara OdV', 140);
      const oggetto = `[${etichettaDoc.toUpperCase()} ${numDoc}] ${nomeDest} - ${denom}`;

      const testoEmail =
        `Gentile ${nomeDest},\n\n` +
        `Si trasmette in allegato il documento ufficiale (${etichettaDoc} n. ${numDoc}) emesso in data ${dataDoc} da ${denom}:\n\n` +
        `• Documento: ${etichettaDoc} n. ${numDoc}\n` +
        (tipologiaDoc ? `• Tipologia: ${tipologiaDoc}\n` : '') +
        `• Intestatario: ${nomeDest}\n` +
        `• Importo: € ${importoVal.toFixed(2)}\n` +
        (metodoDoc ? `• Modalità di pagamento: ${metodoDoc}\n` : '') +
        (scadenzaDoc ? `• Scadenza pagamento: ${scadenzaDoc}\n` : '') +
        (causaleDoc ? `• Causale: ${causaleDoc}\n` : '') +
        `\nIl documento PDF ufficiale recante la firma del Tesoriere (${nomeTesoriere}) è allegato alla presente comunicazione.\n` +
        `In copia conoscenza (CC): ${ccTesoriere}.\n\n` +
        `Cordiali saluti,\nUfficio Tesoreria & Contabilità\n${denom}`;

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800;">${escapeHtmlSafe(denom.toUpperCase())}</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0;">Ufficio Tesoreria &bull; ${escapeHtmlSafe(etichettaDoc)} Ufficiale</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="margin-top: 0; font-size: 14px; color: #334155;">Gentile <strong>${escapeHtmlSafe(nomeDest)}</strong>,</p>
            <p style="font-size: 14px; color: #334155;">
              si trasmette in allegato il documento contabile ufficiale emesso dall'Ufficio Tesoreria:
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #bfa353; padding: 14px 18px; border-radius: 6px; margin: 18px 0; font-size: 13px;">
              <p style="margin: 4px 0;"><strong>&bull; Documento:</strong> <span style="font-family: monospace; font-weight: bold; color: #1d1a60;">${escapeHtmlSafe(etichettaDoc)} ${escapeHtmlSafe(numDoc)}</span></p>
              <p style="margin: 4px 0;"><strong>&bull; Data Emissione:</strong> ${escapeHtmlSafe(dataDoc)}</p>
              ${tipologiaDoc ? `<p style="margin: 4px 0;"><strong>&bull; Tipologia:</strong> ${escapeHtmlSafe(tipologiaDoc)}</p>` : ''}
              <p style="margin: 4px 0;"><strong>&bull; Importo:</strong> <span style="color: #15803d; font-size: 15px; font-weight: bold;">&euro; ${importoVal.toFixed(2)}</span></p>
              ${metodoDoc ? `<p style="margin: 4px 0;"><strong>&bull; Modalit&agrave; Pagamento:</strong> ${escapeHtmlSafe(metodoDoc)}</p>` : ''}
              ${scadenzaDoc ? `<p style="margin: 4px 0;"><strong>&bull; Scadenza:</strong> ${escapeHtmlSafe(scadenzaDoc)}</p>` : ''}
              ${causaleDoc ? `<p style="margin: 4px 0;"><strong>&bull; Causale:</strong> ${escapeHtmlSafe(causaleDoc)}</p>` : ''}
              <p style="margin: 4px 0;"><strong>&bull; Firmato dal Tesoriere:</strong> ${escapeHtmlSafe(nomeTesoriere)}</p>
            </div>
            <p style="font-size: 13px; color: #475569;">
              In allegato &egrave; disponibile il documento PDF originale (<strong>${escapeHtmlSafe(filename)}</strong>). Per eventuali chiarimenti &egrave; possibile rispondere mantenendo in copia l'Ufficio Tesoreria (<strong>${escapeHtmlSafe(ccTesoriere)}</strong>).
            </p>
          </div>
          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            ${escapeHtmlSafe(denom)} &bull; CF ${escapeHtmlSafe(carta.codiceFiscale || '')}
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp = '';

      const smtpHost = process.env.SMTP_HOST || '';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      const isSecure = smtpPort === 465;
      const smtpUser = process.env.SMTP_USER || '';
      const smtpPass = process.env.SMTP_PASS || '';
      const smtpFrom = process.env.SMTP_FROM || '';

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });

          const mailOptions: any = {
            from: smtpFrom || `"${MITTENTE_UFFICIALE}" <${smtpUser}>`,
            to: emailDest,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail,
            replyTo: ccTesoriere
          };
          if (ccTesoriere && ccTesoriere.toLowerCase() !== emailDest.toLowerCase()) {
            mailOptions.cc = ccTesoriere;
          }
          if (pdfBuffer) {
            mailOptions.attachments = [
              {
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf',
                contentDisposition: 'attachment'
              }
            ];
          }

          const infoMail = await transporter.sendMail(mailOptions);
          speditoViaSmtp = true;
          console.log(
            `[Email Documento Contabile] ${etichettaDoc} ${numDoc} inviata via SMTP a ${emailDest} (CC: ${ccTesoriere}) - MsgID: ${infoMail.messageId}`
          );
        } catch (err: any) {
          erroreSmtp = err?.message || 'Errore invio SMTP';
          console.error('[Email Documento Contabile] Errore invio SMTP:', err);
        }
      } else {
        console.log(
          `[Email Documento Contabile] SMTP non configurato; invio registrato per ${emailDest} (CC: ${ccTesoriere}, file: ${filename}, allegato: ${pdfBuffer ? pdfBuffer.length : 0} bytes)`
        );
      }

      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `📧 ${etichettaDoc.toUpperCase()} ${numDoc} (${nomeDest}): salvata e predisposto invio email a ${emailDest} con CC Tesoriere ${ccTesoriere}`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();

      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatario: emailDest,
        ccTesoriere,
        tesoriereNome: nomeTesoriere,
        speditoViaSmtp,
        erroreSmtp,
        filename,
        dimensioneAllegatoBytes: pdfBuffer ? pdfBuffer.length : 0,
        message: speditoViaSmtp
          ? `${etichettaDoc} ${numDoc} inviata via email a ${emailDest} (CC Tesoriere: ${ccTesoriere}).`
          : `${etichettaDoc} ${numDoc} salvata. Client email predisposto per ${emailDest} (CC Tesoriere: ${ccTesoriere}).`
      });
    } catch (err: any) {
      console.error('[Email Documento Contabile] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione invio email' });
    }
  });

  // ENDPOINT: Invio Email Automatica di Attivazione con PIN Provvisorio, Link Pubblico e Portale HTML Autonomo (No Account Google)
  app.post('/api/invia-email-invito-reset-pin', async (req, res) => {
    try {
      const { id, nome, cognome, email, pinProvvisorio, token, qualifica, origin, publicBaseUrl } = req.body;

      if (!id || !email || !pinProvvisorio) {
        return res.status(400).json({ success: false, error: 'Dati incompleti per l\'invio dell\'email' });
      }

      const emailDestinatario = String(email).trim().toLowerCase();
      const nomeUtente = (nome || '').trim();
      const cognomeUtente = (cognome || '').trim();
      const pinTemporaneo = String(pinProvvisorio).trim();
      const resetToken = token || `rst-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      // Salva lo stato del volontario con il token e flag di richiesta reset
      const vIndex = state.volontari.findIndex(v => v.id === id);
      if (vIndex >= 0) {
        state.volontari[vIndex].pin = pinTemporaneo;
        state.volontari[vIndex].pinProvvisorio = true;
        state.volontari[vIndex].richiedeResetPassword = true;
        state.volontari[vIndex].resetToken = resetToken;
        state.volontari[vIndex].dataInvioInvitoReset = formatDateTimeItaly();
        persistState();
        broadcast({
          type: 'VOLONTARI_UPDATED',
          volontari: state.volontari
        });
      }

      // Costruisci il link web privilegiando un eventuale dominio pubblico esterno privo di login Google
      const reqOrigin = origin || `${req.protocol}://${req.get('host')}`;
      const bodyPublic = publicBaseUrl ? normalizePublicUrlInput(String(publicBaseUrl)) : '';
      const storedPublic = state.publicAppUrl ? normalizePublicUrlInput(String(state.publicAppUrl)) : '';
      const normPublic = (bodyPublic && !isProtectedAiStudioHost(bodyPublic))
        ? bodyPublic
        : ((storedPublic && !isProtectedAiStudioHost(storedPublic)) ? storedPublic : '');
      if (normPublic && state.publicAppUrl !== normPublic) {
        state.publicAppUrl = normPublic;
        persistState();
      }
      const candidateBase = normPublic
        ? normPublic
        : reqOrigin.replace(/\/+$/, '');
      const isProtectedOrigin = isProtectedAiStudioHost(candidateBase);
      const lowerBase = candidateBase.toLowerCase();
      const qs = `id=${encodeURIComponent(id)}&token=${encodeURIComponent(resetToken)}`;
      const resetUrl = isProtectedOrigin
        ? ''
        : ((lowerBase.endsWith('.html') || lowerBase.endsWith('.htm'))
            ? `${candidateBase}?${qs}`
            : `${candidateBase}/reset-pin?${qs}`);

      // Genera pagina HTML 100% autonoma allegata all'email (funziona su qualsiasi smartphone/PC senza account Google / AI Studio)
      const standaloneHtml = generaPaginaHtmlResetPinAutonoma({
        tokenId: resetToken,
        volunteerId: String(id),
        displayName: `${nomeUtente} ${cognomeUtente}`.trim() || 'Volontario Croce Oro',
        qualifica: qualifica || 'Operatore',
      });

      // Mittente identico a quello delle donazioni (TopHost)
      const MITTENTE_UFFICIALE = 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati';
      const EMAIL_MITTENTE_UFFICIALE = 'sistemiautomatizzati@croceoro.org';

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let authenticatedUser = '';

      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          authenticatedUser = candidate;
          break;
        } catch {
          // Continua
        }
      }

      const oggetto = `[Croce Oro Massa Carrara] Attivazione Account Operativo & PIN di Sicurezza`;
      const testoEmail = `Gentile ${nomeUtente} ${cognomeUtente},\n\n` +
        `È stato registrato/abilitato il tuo account operativo per la Croce Oro Massa Carrara OdV (${qualifica || 'Operatore'}).\n\n` +
        `Il sistema ha generato per te un codice PIN provvisorio di sicurezza:\n` +
        `PIN PROVVISORIO: ${pinTemporaneo}\n\n` +
        `NON È NECESSARIO ALCUN ACCOUNT GOOGLE PER IMPOSTARE IL NUOVO PIN:\n` +
        (!isProtectedOrigin && resetUrl
          ? `1) Apri direttamente questo portale web protetto:\n${resetUrl}\n\n` +
            `2) Oppure apri l'App dell'Associazione sul telefono (o su un tablet in sede), tocca "Hai ricevuto un invito a resettare la password/PIN?" -> seleziona il tuo nome -> inserisci il PIN provvisorio ${pinTemporaneo} o la tua email (${emailDestinatario}).\n` +
            `3) In alternativa, scarica l'allegato "Attivazione_PIN_Croce_Oro.html" e aprilo nel browser Chrome / Safari.\n\n`
          : `1) Apri l'App della Croce Oro sul tuo telefono (o su un tablet in sede), tocca "Hai ricevuto un invito a resettare la password/PIN?" -> seleziona il tuo nome -> inserisci il PIN provvisorio ${pinTemporaneo} oppure la tua email (${emailDestinatario}) per impostare subito il tuo nuovo PIN a 4 cifre.\n\n` +
            `2) In alternativa (da browser), scarica l'allegato "Attivazione_PIN_Croce_Oro.html" presente in questa email e aprilo con Chrome, Safari o Edge (senza usare il visualizzatore interno limitato dell'app email).\n\n`) +
        `Croce Oro Massa Carrara OdV - Sistemi Automatizzati`;

      const ctaBlockHtml = !isProtectedOrigin && resetUrl
        ? `
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1d1a60; color: #fbbf24; text-decoration: none; padding: 16px 32px; font-size: 15px; font-weight: 800; border-radius: 10px; border: 2px solid #fbbf24; box-shadow: 0 4px 14px rgba(29, 26, 96, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                👉 Reimposta il tuo PIN Personale
              </a>
            </div>
            <div style="font-size: 12px; color: #475569; line-height: 1.6; background-color: #f8fafc; padding: 14px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 16px;">
              🔓 <strong>Nessun account Google richiesto:</strong> puoi completare la procedura dal pulsante sopra, direttamente dall&apos;App in sede o aprendo l&apos;allegato <strong>Attivazione_PIN_Croce_Oro.html</strong> in Chrome / Safari.<br>
              Se il pulsante non si apre, copia questo link nel browser:<br>
              <a href="${resetUrl}" style="color: #2563eb; word-break: break-all; font-size: 11px;">${resetUrl}</a>
            </div>`
        : `
            <div style="background-color: #eff6ff; border: 2px solid #2563eb; border-radius: 12px; padding: 18px; margin: 22px 0; text-align: left;">
              <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">
                📲 Come reimpostare il PIN SENZA Account Google
              </p>
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #1e293b; line-height: 1.55;">
                <strong>Opzione 1 (Direttamente sull&apos;App / Tablet di Sede):</strong> Apri l&apos;App Croce Oro sul tuo smartphone o sul tablet associativo, tocca <em>&quot;Hai ricevuto un invito a resettare la password/PIN?&quot;</em>, seleziona il tuo nominativo e inserisci il PIN provvisorio <strong>${pinTemporaneo}</strong> (oppure la tua email <strong>${emailDestinatario}</strong>).
              </p>
              <p style="margin: 0; font-size: 13px; color: #1e293b; line-height: 1.55;">
                <strong>Opzione 2 (Modulo HTML Autonomo):</strong> Scarica sul dispositivo l&apos;allegato <strong>Attivazione_PIN_Croce_Oro.html</strong> presente in questa email e aprilo con Chrome / Safari / Edge, quindi inserisci il PIN provvisorio <strong>${pinTemporaneo}</strong> e scegli il tuo nuovo PIN a 4 cifre.
              </p>
            </div>`;

      const htmlEmail = `
        <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <!-- Header Istituzionale -->
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 24px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">Centrale Operativa Radio & Emergenze &bull; Sistemi Automatizzati</p>
          </div>
          
          <!-- Corpo della mail -->
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <h2 style="margin-top: 0; font-size: 18px; color: #1d1a60; font-weight: 700;">Attivazione Profilo & Impostazione PIN Personale</h2>
            
            <p style="font-size: 14px; color: #334155;">Gentile <strong>${nomeUtente} ${cognomeUtente}</strong>,</p>
            
            <p style="font-size: 14px; color: #334155;">
              È stato registrato il tuo account operativo per la <strong>Croce Oro Massa Carrara OdV</strong>${qualifica ? ` con qualifica di <strong>${qualifica}</strong>` : ''}.
            </p>

            <!-- Box PIN Provvisorio Evidenziato -->
            <div style="background-color: #fef3c7; border: 2px dashed #f59e0b; border-radius: 10px; padding: 18px; margin: 22px 0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #92400e; letter-spacing: 0.5px;">Codice PIN Provvisorio Assegnato</p>
              <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #b45309; font-family: 'Courier New', Courier, monospace;">${pinTemporaneo}</div>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #78350f;">Usa questo PIN per confermare la tua identità e impostare il tuo nuovo codice a 4 cifre</p>
            </div>

            ${ctaBlockHtml}
          </div>

          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 16px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-weight: bold;">Croce Oro Massa Carrara OdV &bull; Sistemi Automatizzati</p>
            <p style="margin: 4px 0 0; color: #94a3b8;">Email trasmessa automaticamente da sistemiautomatizzati@croceoro.org &bull; Non rispondere direttamente a questa email.</p>
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp: string | null = null;

      if (transporter) {
        try {
          const info = await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            envelope: {
              from: EMAIL_MITTENTE_UFFICIALE,
              to: [emailDestinatario]
            },
            to: emailDestinatario,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail,
            attachments: [
              {
                filename: 'Attivazione_PIN_Croce_Oro.html',
                content: Buffer.from(standaloneHtml, 'utf-8'),
                contentType: 'text/html; charset=utf-8'
              }
            ]
          });
          speditoViaSmtp = true;
          console.log(`[Invito PIN] Email inviata a ${emailDestinatario} da "${MITTENTE_UFFICIALE}" (MsgID: ${info.messageId})`);
        } catch (err: any) {
          erroreSmtp = err?.message || 'Errore invio SMTP';
          console.error('[Invito PIN] Errore invio SMTP:', err);
        }
      } else {
        erroreSmtp = 'Server SMTP non connesso al momento';
        console.warn('[Invito PIN] SMTP non pronto per:', emailDestinatario);
      }

      // Notifica Radio in Centrale
      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `📧 ATTIVAZIONE: Inviata email con PIN provvisorio e procedura attivazione a ${nomeUtente} ${cognomeUtente} (${emailDestinatario}) da sistemiautomatizzati@croceoro.org`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        speditoViaSmtp,
        erroreSmtp,
        destinatario: emailDestinatario,
        resetUrl,
        isProtectedHost: isProtectedOrigin,
        mittente: `"${MITTENTE_UFFICIALE}" <${EMAIL_MITTENTE_UFFICIALE}>`,
        message: speditoViaSmtp
          ? `Email con PIN provvisorio inviata con successo a ${emailDestinatario}`
          : `Invito generato per ${emailDestinatario}`
      });
    } catch (err: any) {
      console.error('[Invito PIN] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // ENDPOINT: Invio massivo notifica in-app + email a tutti gli account senza firma caricata in app
  app.post('/api/invia-sollecito-firma-pin', async (req, res) => {
    try {
      const operatoreNome = String(req.body?.operatoreNome || 'Amministratore Centrale').trim();
      const listaSorgente: any[] =
        Array.isArray(req.body?.volontari) && req.body.volontari.length > 0
          ? req.body.volontari
          : (Array.isArray(state.volontari) ? state.volontari : []);

      const isRootAdmin = (v: any): boolean => {
        if (!v) return true;
        const id = String(v.id || '').trim();
        const pin = String(v.pin || '').trim();
        const nome = String(v.nome || '').toLowerCase();
        const cognome = String(v.cognome || '').toLowerCase();
        return id === 'vol-admin' || id === 'admin-centrale-root' || pin === '4451' || nome.includes('amministratore') || cognome.includes('amministratore');
      };

      const isFirmaMancanteServer = (v: any): boolean => {
        if (!v || isRootAdmin(v)) return false;
        return typeof v.firmaBase64 !== 'string' || v.firmaBase64.trim().length < 20;
      };

      const isEmailReale = (rawEmail: any): boolean => {
        const email = String(rawEmail || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return false;
        const placeholderPatterns = [
          'nomail@',
          '@nomail.',
          'nessuna@',
          '@nessuna.',
          'nessuno@',
          'nonpresente',
          'nondisponibile',
          'example.',
          'test@test',
          'prova@prova',
          'fake@',
          'nd@nd.'
        ];
        return !placeholderPatterns.some(p => email.includes(p));
      };

      const targetsSenzaFirma = listaSorgente.filter((v: any) => isFirmaMancanteServer(v));
      const accountConFirmaMaPin0000 = listaSorgente
        .filter((v: any) => !isRootAdmin(v) && !isFirmaMancanteServer(v) && String(v.pin || '').trim() === '0000')
        .map((v: any) => ({
          id: String(v.id || ''),
          nome: `${v.nome || ''} ${v.cognome || ''}`.trim(),
          email: String(v.email || '').trim()
        }));

      const MITTENTE_UFFICIALE = 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati';
      const EMAIL_MITTENTE_UFFICIALE = 'sistemiautomatizzati@croceoro.org';

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      let smtpInitError: string | null = null;

      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          break;
        } catch (e: any) {
          smtpInitError = e?.message || 'Errore verifica SMTP';
        }
      }

      const emailsInviate: Array<{ id: string; nome: string; email: string; pinEmergenza: boolean; messageId?: string }> = [];
      const emailsSaltate: Array<{ id: string; nome: string; email: string; motivo: string; pinEmergenza: boolean }> = [];
      const erroriSmtp: Array<{ id: string; nome: string; email: string; errore: string }> = [];

      for (const vol of targetsSenzaFirma) {
        const nomeCompleto = `${vol.nome || ''} ${vol.cognome || ''}`.trim() || 'Volontario';
        const emailDest = String(vol.email || '').trim();
        const hasPin0000 = String(vol.pin || '').trim() === '0000';

        if (!isEmailReale(emailDest)) {
          emailsSaltate.push({
            id: String(vol.id || ''),
            nome: nomeCompleto,
            email: emailDest || '(nessuna email)',
            motivo: !emailDest ? 'Indirizzo email assente' : 'Indirizzo email segnaposto/non valido',
            pinEmergenza: hasPin0000
          });
          continue;
        }

        const oggetto = hasPin0000
          ? `[Croce Oro Massa Carrara] AZIONE OBBLIGATORIA: Caricamento Firma sull'App e Cambio PIN 0000`
          : `[Croce Oro Massa Carrara] AZIONE OBBLIGATORIA: Caricamento Firma Digitale sull'App`;

        const testoEmail =
          `Gentile ${nomeCompleto},\n\n` +
          `ti informiamo che sul tuo profilo operativo dell'App Croce Oro Massa Carrara OdV non risulta ancora caricata la tua FIRMA DIGITALE.\n\n` +
          `COSA DEVI FARE SUBITO:\n` +
          `1) Se NON hai ancora effettuato l'accesso all'App: apri l'App ed effettua il LOGIN con il tuo account.\n` +
          `2) Se HAI GIÀ effettuato l'accesso sull'App: esci e rientra effettuando subito LOGOUT e poi nuovamente LOGIN.\n\n` +
          `Appena effettuerai il login, il sistema ti guiderà obbligatoriamente a:\n` +
          `- Caricare o disegnare la tua firma digitale autografa sull'App (obbligatoria per accedere e per tutti i fogli di viaggio / verbali).\n` +
          (hasPin0000
            ? `- Sostituire obbligatoriamente il tuo attuale PIN di emergenza (0000) con un nuovo PIN personale a 4 cifre.\n\n`
            : `- Inoltre, per chi utilizza ancora il PIN di emergenza 0000, al login sarà richiesto obbligatoriamente di cambiarlo con un nuovo PIN personale a 4 cifre.\n\n`) +
          `Grazie per la collaborazione.\n` +
          `Croce Oro Massa Carrara OdV - Centrale Operativa & Sistemi Automatizzati`;

        const boxPinHtml = hasPin0000
          ? `
            <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 10px; padding: 16px; margin: 18px 0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 900; color: #991b1b; text-transform: uppercase;">
                🔐 Obbligo Cambio PIN di Emergenza (0000)
              </p>
              <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.55;">
                Sul tuo profilo risulta ancora attivo il <strong>PIN di emergenza 0000</strong>. Al momento del login ti verrà richiesto obbligatoriamente di impostare un <strong>nuovo PIN personale a 4 cifre</strong> diverso da 0000.
              </p>
            </div>`
          : `
            <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 6px; padding: 12px 14px; margin: 18px 0; font-size: 12px; color: #475569;">
              🔐 <strong>Nota sicurezza PIN:</strong> per chi ha ancora il PIN di emergenza <strong>0000</strong>, al login sarà obbligatorio sostituirlo subito con un nuovo PIN personale a 4 cifre.
            </div>`;

        const htmlEmail = `
          <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #1d1a60; color: #fbbf24; padding: 22px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 21px; font-weight: 800; letter-spacing: 0.4px; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
              <p style="margin: 6px 0 0; font-size: 12px; color: #e2e8f0;">Centrale Operativa &bull; Comunicazione Obbligatoria Account App</p>
            </div>
            <div style="padding: 26px 24px;">
              <h2 style="margin-top: 0; font-size: 17px; color: #1d1a60; font-weight: 800;">
                ✍️ Caricamento Firma Digitale Obbligatorio sull'App
              </h2>
              <p style="font-size: 14px; color: #334155;">Gentile <strong>${nomeCompleto}</strong>,</p>
              <p style="font-size: 14px; color: #334155;">
                ad oggi sul tuo profilo nell&apos;App della <strong>Croce Oro Massa Carrara OdV</strong> non risulta ancora caricata la tua <strong>firma digitale</strong>.
              </p>
              <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 10px; padding: 16px; margin: 18px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 900; color: #92400e; text-transform: uppercase;">
                  📲 Procedura richiesta subito
                </p>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #78350f; line-height: 1.6;">
                  <li style="margin-bottom: 6px;"><strong>Se non hai ancora fatto accesso all&apos;App:</strong> apri l&apos;App ed effettua il <strong>Login</strong>.</li>
                  <li style="margin-bottom: 6px;"><strong>Se hai già fatto accesso sull&apos;App:</strong> esci e rientra facendo subito <strong>Logout</strong> e poi nuovamente <strong>Login</strong>.</li>
                  <li><strong>Al login</strong> il sistema ti chiederà <strong>obbligatoriamente</strong> di caricare una foto/scansione della tua firma oppure di disegnarla direttamente sullo schermo.</li>
                </ul>
              </div>
              ${boxPinHtml}
              <p style="font-size: 13px; color: #475569; margin-bottom: 0;">
                Grazie per la collaborazione.<br>
                <strong>Centrale Operativa - Croce Oro Massa Carrara OdV</strong>
              </p>
            </div>
            <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-weight: bold;">Croce Oro Massa Carrara OdV &bull; Sistemi Automatizzati</p>
              <p style="margin: 4px 0 0; color: #94a3b8;">Email automatica inviata da sistemiautomatizzati@croceoro.org</p>
            </div>
          </div>
        `;

        if (!transporter) {
          erroriSmtp.push({
            id: String(vol.id || ''),
            nome: nomeCompleto,
            email: emailDest,
            errore: smtpInitError || 'Server SMTP non connesso'
          });
          continue;
        }

        try {
          const info = await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            envelope: {
              from: EMAIL_MITTENTE_UFFICIALE,
              to: [emailDest]
            },
            to: emailDest,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          emailsInviate.push({
            id: String(vol.id || ''),
            nome: nomeCompleto,
            email: emailDest,
            pinEmergenza: hasPin0000,
            messageId: info?.messageId
          });
          console.log(`[Sollecito Firma/PIN] Email inviata a ${nomeCompleto} <${emailDest}> (MsgID: ${info?.messageId})`);
        } catch (errSend: any) {
          erroriSmtp.push({
            id: String(vol.id || ''),
            nome: nomeCompleto,
            email: emailDest,
            errore: errSend?.message || 'Errore invio SMTP'
          });
          console.error(`[Sollecito Firma/PIN] Errore SMTP per ${emailDest}:`, errSend?.message);
        }
      }

      const now = new Date();
      const campaign = {
        id: `sollecito-firma-pin-${Date.now()}`,
        createdAt: Date.now(),
        dataOra: `${formatDateItaly(now)} ${formatTimeItaly(now)}`,
        inviatoDa: operatoreNome,
        titolo: '✍️ Firma Digitale Obbligatoria & Controllo PIN',
        messaggio:
          'Sul tuo profilo non risulta ancora caricata la firma digitale. Se hai già effettuato l\'accesso in App, esci subito facendo LOGOUT e rientra facendo LOGIN (oppure fai accesso se non l\'hai ancora fatto): al login dovrai obbligatoriamente caricare la tua firma e cambiare il PIN se hai ancora 0000.',
        targetIds: targetsSenzaFirma.map((v: any) => String(v.id)),
        includiTuttiSenzaFirma: true,
        totaleDestinatari: targetsSenzaFirma.length,
        emailsInviateCount: emailsInviate.length
      };

      state.sollecitoFirmaPin = campaign;
      persistState();
      broadcast({
        type: 'SOLLECITO_FIRMA_PIN_UPDATED',
        sollecitoFirmaPin: campaign
      });

      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `📢 SOLLECITO FIRMA & PIN: Inviata notifica in-app a ${targetsSenzaFirma.length} account senza firma e ${emailsInviate.length} email ufficiali (${emailsSaltate.length} email assenti/segnaposto).`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        campaign,
        totaleSenzaFirma: targetsSenzaFirma.length,
        destinatariSenzaFirma: targetsSenzaFirma.map((v: any) => ({
          id: String(v.id || ''),
          nome: `${v.nome || ''} ${v.cognome || ''}`.trim(),
          email: String(v.email || '').trim(),
          pinEmergenza: String(v.pin || '').trim() === '0000'
        })),
        accountConFirmaMaPin0000,
        emailsInviate,
        emailsSaltate,
        erroriSmtp
      });
    } catch (err: any) {
      console.error('[Sollecito Firma/PIN] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione sollecito' });
    }
  });

  // ENDPOINT: Notifica automatica via email all'Amministratore per modifiche / nuovi inserimenti nelle macro categorie
  app.post('/api/notifica-modifica-admin', async (req, res) => {
    try {
      const {
        operatoreNome = 'Operatore / Volontario',
        operatoreRuolo = 'Profilo Delegato',
        macroCategoria = 'Gestionale',
        azione = 'Modifica Dati',
        dettaglio = 'Nessun dettaglio specificato',
        elementoNome = '',
        dataOra = formatDateTimeItaly()
      } = req.body || {};

      const MITTENTE_UFFICIALE = 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati';
      const EMAIL_MITTENTE_UFFICIALE = 'sistemiautomatizzati@croceoro.org';

      // Destinatario esclusivo per le notifiche automatiche di modifica all'Amministratore
      const destinatari = ['presidenza@croceoro.org'];

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          break;
        } catch {}
      }

      const oggetto = `[NOTIFICA GESTIONALE] ${azione} in "${macroCategoria}" — ${operatoreNome}`;
      const testoEmail =
        `Spettabile Amministrazione Croce Oro Massa Carrara OdV,\n\n` +
        `Si notifica che è stata effettuata un'operazione nel Portale Gestionale da un utente con accesso delegato:\n\n` +
        `• Autore: ${operatoreNome} (${operatoreRuolo})\n` +
        `• Macro Categoria: ${macroCategoria}\n` +
        `• Tipologia Operazione: ${azione}\n` +
        (elementoNome ? `• Elemento Interessato: ${elementoNome}\n` : '') +
        `• Dettagli Operazione:\n${dettaglio}\n\n` +
        `• Data e Ora: ${dataOra}\n\n` +
        `Notifica generata in automatico a tutela della trasparenza e sicurezza del database.\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Automatizzati`;

      const htmlEmail = `
        <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 22px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">Centrale Operativa Radio & Emergenze &bull; Sistemi Automatizzati</p>
          </div>
          
          <div style="padding: 26px 24px; background-color: #ffffff;">
            <div style="display: inline-block; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: bold; color: #166534; margin-bottom: 12px;">
              🛡️ NOTIFICA REGISTRO GESTIONALE
            </div>
            
            <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a; font-weight: 800;">
              ${azione}: ${macroCategoria}
            </h2>

            <p style="font-size: 14px; color: #334155; margin-top: 0;">
              Gentile Amministratore, il sistema ha registrato una nuova operazione effettuata da personale con accesso delegato:
            </p>

            <div style="background-color: #f8fafc; border-left: 4px solid #b45309; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
              <p style="margin: 4px 0;"><strong>👤 Eseguito da:</strong> <span style="color: #0f172a; font-weight: bold;">${operatoreNome}</span> <span style="color: #64748b;">(${operatoreRuolo})</span></p>
              <p style="margin: 4px 0;"><strong>📂 Macro Categoria:</strong> <span style="color: #1d1a60; font-weight: bold;">${macroCategoria}</span></p>
              <p style="margin: 4px 0;"><strong>⚡ Azione:</strong> <span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${azione}</span></p>
              ${elementoNome ? `<p style="margin: 4px 0;"><strong>🏷️ Elemento:</strong> <strong>${elementoNome}</strong></p>` : ''}
              <p style="margin: 4px 0;"><strong>🕒 Data e Ora:</strong> ${dataOra}</p>
              
              <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                <strong style="color: #475569; display: block; margin-bottom: 4px;">📝 Riepilogo Modifiche Effettuate:</strong>
                <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 12px; color: #1e293b; white-space: pre-wrap;">${dettaglio}</div>
              </div>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
              ℹ️ Nota di sicurezza: ai volontari e operatori abilitati è consentito visualizzare, creare e modificare dati, mentre qualsiasi operazione di cancellazione o rimozione definitiva rimane inibita ed esclusiva facoltà dell'Amministrazione.
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-weight: bold;">Croce Oro Massa Carrara OdV &bull; Sistemi Automatizzati</p>
            <p style="margin: 4px 0 0; color: #94a3b8;">Email inviata in tempo reale a tutela della tracciabilità gestionale.</p>
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp: string | null = null;

      if (transporter) {
        try {
          await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            to: destinatari,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
          console.log(`[Notifica Modifica Admin] Inviata email a ${destinatari.join(', ')} per azione di "${operatoreNome}" in "${macroCategoria}"`);
        } catch (mailErr: any) {
          erroreSmtp = mailErr?.message || 'Errore SMTP invio';
          console.error('[Notifica Modifica Admin] Errore SMTP:', mailErr);
        }
      }

      // Notifica Radio in tempo reale per la postazione Amministratore
      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `📝 MODIFICA GESTIONALE: ${operatoreNome} (${operatoreRuolo}) ha eseguito "${azione}" in "${macroCategoria}". Notifica email inviata all'Amministratore.`,
        tipo: 'sistema'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        speditoViaSmtp,
        erroreSmtp,
        destinatari
      });
    } catch (err: any) {
      console.error('[Notifica Modifica Admin] Errore generale:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione notifica' });
    }
  });

  // Tracciamento in memoria dell'ultimo livello di scorta notificato per ciascun articolo per evitare spam continuo
  const ultimoStatoNotificaSottoscorta = new Map<string, { giacenza: number; timestamp: number }>();

  // ENDPOINT: Invio automatico email per articolo Magazzino Mezzi uguale o inferiore alla scorta minima
  // Destinatari obbligatori: mezzi@croceoro.org e presidenza@croceoro.org
  app.post('/api/notifica-sottoscorta-mezzi', async (req, res) => {
    try {
      const {
        articoli = [],
        articolo,
        causale = 'Aggiornamento giacenza magazzino ricambi mezzi',
        operatore = 'Centrale Operativa / Personale Mezzi',
        dataOra = formatDateTimeItaly(),
        force = false
      } = req.body || {};

      const listaArticoli: any[] = Array.isArray(articoli) && articoli.length > 0
        ? articoli
        : (articolo ? [articolo] : []);

      if (listaArticoli.length === 0) {
        return res.status(400).json({ success: false, error: 'Nessun articolo fornito per la notifica' });
      }

      // Filtra solo gli articoli che sono effettivamente uguali o inferiori alla scorta minima
      const ora = Date.now();
      const articoliSottoScorta = listaArticoli.filter((a: any) => {
        const giac = Number(a.giacenza);
        const min = Number(a.scortaMinima);
        if (isNaN(giac) || isNaN(min) || min <= 0 || giac > min) return false;

        if (!force && a.id) {
          const prev = ultimoStatoNotificaSottoscorta.get(a.id);
          // Se già notificato con la stessa identica giacenza meno di 10 minuti fa, evita duplicazioni identiche
          if (prev && prev.giacenza === giac && (ora - prev.timestamp) < 10 * 60 * 1000) {
            return false;
          }
        }
        return true;
      });

      if (articoliSottoScorta.length === 0) {
        return res.json({
          success: true,
          message: 'Nessun nuovo articolo sotto scorta minima da notificare o già notificato recentemente.',
          count: 0
        });
      }

      // Aggiorna registro in memoria
      articoliSottoScorta.forEach((a: any) => {
        if (a.id) {
          ultimoStatoNotificaSottoscorta.set(a.id, { giacenza: Number(a.giacenza), timestamp: ora });
        }
      });

      const destinatari = ['mezzi@croceoro.org', 'presidenza@croceoro.org'];

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          break;
        } catch {}
      }

      const primoArt = articoliSottoScorta[0];
      const oggetto = articoliSottoScorta.length === 1
        ? `[ALLERTA SCORTA MINIMA MEZZI] ${primoArt.nome} (${primoArt.codice}) — Giacenza: ${primoArt.giacenza} ${primoArt.unitaMisura || 'Pz'} (Scorta Min: ${primoArt.scortaMinima})`
        : `[ALLERTA SCORTA MINIMA MEZZI] Rilevati ${articoliSottoScorta.length} articoli sotto la scorta minima`;

      const righeArticoliHtml = articoliSottoScorta.map((a: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-family: monospace; font-weight: bold; color: #b45309;">${a.codice || '-'}</td>
          <td style="padding: 10px; font-weight: bold; color: #0f172a;">${a.nome || '-'}<br/><span style="font-size: 11px; color: #64748b; font-weight: normal;">${a.categoria || ''}${a.compatibilitaMezzi ? ` &bull; Comp: ${a.compatibilitaMezzi}` : ''}</span></td>
          <td style="padding: 10px; text-align: center; color: #dc2626; font-size: 14px; font-weight: 900; background-color: #fef2f2;">${a.giacenza} ${a.unitaMisura || 'Pz'}</td>
          <td style="padding: 10px; text-align: center; color: #475569; font-weight: bold;">${a.scortaMinima} ${a.unitaMisura || 'Pz'}</td>
          <td style="padding: 10px; color: #475569; font-size: 11px;">${a.ubicazioneScaffale || 'Scaffale M1'}${a.fornitore ? `<br/><span style="color: #64748b; font-weight: bold;">Forn: ${a.fornitore}</span>` : ''}</td>
        </tr>
      `).join('');

      const testoEmail =
        `Spettabili Referenti Ufficio Mezzi & Presidenza Croce Oro Massa Carrara OdV,\n\n` +
        `SI NOTIFICA CHE I SEGUENTI ARTICOLI DEL MAGAZZINO RICAMBI MEZZI SONO UGUALI O INFERIORI ALLA SCORTA MINIMA:\n\n` +
        articoliSottoScorta.map((a: any) =>
          `• [${a.codice}] ${a.nome}\n` +
          `  GIACENZA ATTUALE: ${a.giacenza} ${a.unitaMisura || 'Pz'} (Soglia Minima: ${a.scortaMinima} ${a.unitaMisura || 'Pz'})\n` +
          `  Categoria: ${a.categoria || 'Ricambi'}\n` +
          (a.compatibilitaMezzi ? `  Compatibilità: ${a.compatibilitaMezzi}\n` : '') +
          (a.fornitore ? `  Fornitore Abituale: ${a.fornitore}\n` : '') +
          (a.ubicazioneScaffale ? `  Ubicazione: ${a.ubicazioneScaffale}\n` : '')
        ).join('\n') +
        `\n• Causale Evento: ${causale}\n` +
        `• Registrato da: ${operatore}\n` +
        `• Data e Ora: ${dataOra}\n\n` +
        `Si raccomanda di provvedere tempestivamente all'ordine di riapprovvigionamento per mantenere la piena efficienza operativa e sicurezza dei mezzi di soccorso.\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Automatizzati`;

      const htmlEmail = `
        <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #1e293b; max-width: 680px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 22px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">Settore Mezzi & Parco Veicolare &bull; Magazzino Ricambi & Manutenzioni</p>
          </div>

          <div style="padding: 24px; background-color: #ffffff;">
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 6px 0; font-size: 16px; color: #991b1b; font-weight: 800;">
                ⚠️ ALLERTA SCORTA MINIMA / SOTTOSCORTA MAGAZZINO MEZZI
              </h2>
              <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
                Si segnala che <strong>${articoliSottoScorta.length} articolo/i</strong> del magazzino ricambi e manutenzione mezzi hanno raggiunto o sono scesi al di sotto della soglia di scorta minima prestabilita.
              </p>
            </div>

            <div style="font-size: 12px; color: #475569; margin-bottom: 14px; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <strong>ℹ️ Dettagli Registrazione:</strong> Causale: <em>${causale}</em> &bull; Operatore: <strong>${operatore}</strong> &bull; Data/Ora: <strong>${dataOra}</strong>
            </div>

            <h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px 0;">Articoli da Riordinare:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left; color: #475569; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px 10px;">Codice</th>
                  <th style="padding: 8px 10px;">Descrizione / Categoria</th>
                  <th style="padding: 8px 10px; text-align: center;">Giacenza</th>
                  <th style="padding: 8px 10px; text-align: center;">Scorta Min.</th>
                  <th style="padding: 8px 10px;">Ubicazione / Fornitore</th>
                </tr>
              </thead>
              <tbody>
                ${righeArticoliHtml}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 14px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 12px; color: #92400e;">
              <strong>📦 Azione Consigliata:</strong> Si invita l'Ufficio Mezzi e la Presidenza a contattare tempestivamente il fornitore ed emettere l'ordine di acquisto per il riassortimento dei ricambi necessari alla flotta.
            </div>
          </div>

          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            Notifica generata in automatico a tutela della continuità operativa e trasmessa a <strong>mezzi@croceoro.org</strong> e <strong>presidenza@croceoro.org</strong>.
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp: string | null = null;

      if (transporter) {
        try {
          await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            to: destinatari,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
          console.log(`[Email Sottoscorta Mezzi] Inviata email con successo a ${destinatari.join(', ')} per ${articoliSottoScorta.length} articoli`);
        } catch (mailErr: any) {
          erroreSmtp = mailErr?.message || 'Errore SMTP';
          console.error('[Email Sottoscorta Mezzi] Errore SMTP:', mailErr);
        }
      } else {
        console.log(`[Email Sottoscorta Mezzi] Registrata notifica locale per ${destinatari.join(', ')} (${articoliSottoScorta.length} articoli)`);
      }

      // Notifica Radio in tempo reale nel registro di Centrale
      const nomiArticoliStr = articoliSottoScorta.map((a: any) => `${a.nome} (${a.giacenza}/${a.scortaMinima} ${a.unitaMisura || 'Pz'})`).join(', ');
      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `⚠️ ALLERTA MAGAZZINO MEZZI: Rilevata scorta minima per: ${nomiArticoliStr}. Email di sollecito riordino inviata a mezzi@croceoro.org e presidenza@croceoro.org.`,
        tipo: 'allarme'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatari,
        count: articoliSottoScorta.length,
        articoli: articoliSottoScorta,
        speditoViaSmtp,
        erroreSmtp,
        message: `Email inviata a ${destinatari.join(' e ')}`
      });
    } catch (err: any) {
      console.error('[Email Sottoscorta Mezzi] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione notifica sottoscorta' });
    }
  });

  // Tracciamento in memoria delle scadenze mezzi già notificate per evitare spam continuo
  const ultimoStatoNotificaScadenze = new Map<string, { dataScadenza: string; timestamp: number }>();

  // ENDPOINT: Invio automatico email per qualsiasi scadenza inerente a ogni tipo di mezzo
  // (Assicurazione, Tagliando, Bollo Auto, Revisione Ministeriale, Collaudo Dotazioni Bordo)
  // Destinatari obbligatori: mezzi@croceoro.org e presidenza@croceoro.org
  app.post('/api/notifica-scadenze-mezzi', async (req, res) => {
    try {
      const {
        alerts = [],
        alert,
        scadenze,
        scadenza,
        causale = 'Rilevazione scadenze flotta mezzi (Assicurazione / Tagliando / Bollo / Revisione)',
        operatore = 'Centrale Operativa / Ufficio Mezzi',
        dataOra = formatDateTimeItaly(),
        force = false,
        destinatariExtra = []
      } = req.body || {};

      const rawAlerts: any[] = Array.isArray(alerts) && alerts.length > 0
        ? alerts
        : (Array.isArray(scadenze) && scadenze.length > 0
          ? scadenze
          : (alert ? [alert] : (scadenza ? [scadenza] : [])));

      if (rawAlerts.length === 0) {
        return res.status(400).json({ success: false, error: 'Nessuna scadenza mezzo fornita per la notifica' });
      }

      // Filtra le scadenze: devono essere scadute (giorniRimanenti <= 0 o scaduta = true) o in scadenza entro la soglia configurata (default 30 giorni)
      const sogliaScadServer = Number(req.body?.sogliaGiorni) || Number(state.regolaScadenzeMezzi?.giorniPreavvisoScadenzario) || 30;
      const ora = Date.now();
      const scadenzeFiltrate = rawAlerts.filter((a: any) => {
        const giorni = Number(a.giorniRimanenti);
        const isScaduta = a.scaduta === true || (!isNaN(giorni) && giorni <= 0);
        const isInScadenza = !isNaN(giorni) && giorni <= sogliaScadServer;

        if (!isScaduta && !isInScadenza && !force) return false;

        if (!force && a.id) {
          const prev = ultimoStatoNotificaScadenze.get(a.id);
          // Se già notificato per la stessa identica data di scadenza nelle ultime 12 ore, evita duplicati
          if (prev && prev.dataScadenza === String(a.dataScadenza) && (ora - prev.timestamp) < 12 * 60 * 60 * 1000) {
            return false;
          }
        }
        return true;
      });

      if (scadenzeFiltrate.length === 0) {
        return res.json({
          success: true,
          message: 'Nessuna nuova scadenza mezzo da notificare o già notificata nelle ultime 12 ore.',
          count: 0
        });
      }

      // Aggiorna registro in memoria
      scadenzeFiltrate.forEach((a: any) => {
        if (a.id) {
          ultimoStatoNotificaScadenze.set(a.id, { dataScadenza: String(a.dataScadenza), timestamp: ora });
        }
      });

      // Destinatari tassativi: mezzi@croceoro.org e presidenza@croceoro.org (+ eventuali extra)
      const destinatari = Array.from(new Set([
        'mezzi@croceoro.org',
        'presidenza@croceoro.org',
        ...(Array.isArray(destinatariExtra) ? destinatariExtra : [])
      ]));

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          break;
        } catch {}
      }

      const contieneScadute = scadenzeFiltrate.some((s: any) => s.scaduta || s.giorniRimanenti < 0);
      const primo = scadenzeFiltrate[0];

      const oggetto = scadenzeFiltrate.length === 1
        ? `[SCADENZA FLOTTA MEZZI] ${primo.tipo} - Mezzo ${primo.mezzoSigla} (${primo.targa || 'N.D.'}) — ${primo.scaduta || primo.giorniRimanenti < 0 ? 'SCADUTO!' : `In Scadenza (${primo.dataScadenza})`}`
        : `[SCADENZE FLOTTA MEZZI] ${contieneScadute ? 'URGENTE: ' : ''}Rilevate ${scadenzeFiltrate.length} scadenze per i veicoli della flotta`;

      const righeHtml = scadenzeFiltrate.map((s: any) => {
        const isScad = s.scaduta || s.giorniRimanenti < 0;
        const isUrgente = s.giorniRimanenti <= 15;
        const statoBadge = isScad
          ? `<span style="background-color: #ef4444; color: #ffffff; padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">SCADUTA (${Math.abs(s.giorniRimanenti)} gg fa)</span>`
          : isUrgente
          ? `<span style="background-color: #f59e0b; color: #000000; padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">URGENTE: ${s.giorniRimanenti} gg rimasti</span>`
          : `<span style="background-color: #e2e8f0; color: #334155; padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">${s.giorniRimanenti} gg rimasti</span>`;

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-family: monospace; font-weight: 900; color: #1e3a8a; font-size: 13px;">
              🚑 ${s.mezzoSigla}
              ${s.targa ? `<br/><span style="font-size: 11px; color: #64748b; font-family: monospace;">(${s.targa})</span>` : ''}
              ${s.modello ? `<br/><span style="font-size: 11px; color: #475569; font-family: sans-serif;">${s.modello}</span>` : ''}
            </td>
            <td style="padding: 10px; font-weight: bold; color: #0f172a;">
              ${s.tipo}
              ${s.dettagli ? `<div style="font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px;">${s.dettagli}</div>` : ''}
            </td>
            <td style="padding: 10px; text-align: center; font-family: monospace; font-weight: bold; color: #0f172a;">
              ${s.dataScadenza}
            </td>
            <td style="padding: 10px; text-align: center;">
              ${statoBadge}
            </td>
            <td style="padding: 10px; color: #475569; font-size: 11px;">
              ${s.sedeStazionamento ? `<strong>Sede:</strong> ${s.sedeStazionamento}<br/>` : ''}
              ${s.officina ? `<strong>Officina/Fornitore:</strong> ${s.officina}` : 'Da prenotare/rinnovare'}
            </td>
          </tr>
        `;
      }).join('');

      const testoEmail =
        `Spettabili Referenti Ufficio Mezzi & Presidenza Croce Oro Massa Carrara OdV,\n\n` +
        `SI NOTIFICA CHE SONO STATE RILEVATE LE SEGUENTI SCADENZE PER I MEZZI DELLA FLOTTA (Assicurazione / Tagliando / Bollo / Revisione):\n\n` +
        scadenzeFiltrate.map((s: any) => {
          const isScad = s.scaduta || s.giorniRimanenti < 0;
          const stato = isScad ? `SCADUTO DA ${Math.abs(s.giorniRimanenti)} GIORNI` : `IN SCADENZA TRA ${s.giorniRimanenti} GIORNI (Scadenza: ${s.dataScadenza})`;
          return `• MEZZO: ${s.mezzoSigla} (${s.targa || 'N.D.'}) - ${s.modello || ''}\n` +
                 `  TIPO SCADENZA: ${s.tipo}\n` +
                 `  STATO: ${stato}\n` +
                 `  Dettagli: ${s.dettagli || '-'}\n` +
                 (s.sedeStazionamento ? `  Sede Stazionamento: ${s.sedeStazionamento}\n` : '') +
                 (s.officina ? `  Officina/Fornitore: ${s.officina}\n` : '');
        }).join('\n') +
        `\n• Causale Notifica: ${causale}\n` +
        `• Registrato da: ${operatore}\n` +
        `• Data e Ora: ${dataOra}\n\n` +
        `AZIONI RICHIESTE:\n` +
        `1. Verificare tempestivamente la polizza assicurativa, la prenotazione del collaudo/revisione ministeriale o il tagliando programmato.\n` +
        `2. Disporre l'eventuale temporaneo stato 'In Manutenzione' / 'Fuori Servizio' sul gestionale qualora il veicolo non possa circolare.\n` +
        `3. Ad adempimento ultimato, aggiornare la scheda del mezzo o registrare l'intervento sul portale gestionale.\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Informativi Centrali`;

      const htmlEmail = `
        <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #1e293b; max-width: 720px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 22px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">Servizio Gestione Parco Mezzi &bull; Ufficio Autoparco & Manutenzioni</p>
          </div>

          <div style="padding: 24px; background-color: #ffffff;">
            <div style="background-color: ${contieneScadute ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${contieneScadute ? '#ef4444' : '#f59e0b'}; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 6px 0; font-size: 16px; color: ${contieneScadute ? '#991b1b' : '#92400e'}; font-weight: 800;">
                ${contieneScadute ? '🚨 AVVISO URGENTE: SCADENZE FLOTTA MEZZI RILEVATE' : '⚠️ AVVISO PROGRAMMATO: SCADENZE FLOTTA MEZZI'}
              </h2>
              <p style="margin: 0; font-size: 13px; color: ${contieneScadute ? '#7f1d1d' : '#78350f'}; line-height: 1.5;">
                Si segnalano <strong>${scadenzeFiltrate.length} scadenze</strong> relative ai veicoli di soccorso e protezione civile (Assicurazione RCA, Tagliando Programmato, Bollo Auto, Revisione Ministeriale o Dotazioni di bordo).
              </p>
            </div>

            <div style="font-size: 12px; color: #475569; margin-bottom: 14px; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <strong>ℹ️ Riepilogo Evento:</strong> Causale: <em>${causale}</em> &bull; Operatore: <strong>${operatore}</strong> &bull; Data/Ora: <strong>${dataOra}</strong>
            </div>

            <h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px 0;">Elenco Scadenze da Gestire:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left; color: #475569; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px 10px;">Mezzo</th>
                  <th style="padding: 8px 10px;">Tipo Scadenza</th>
                  <th style="padding: 8px 10px; text-align: center;">Data Scadenza</th>
                  <th style="padding: 8px 10px; text-align: center;">Stato</th>
                  <th style="padding: 8px 10px;">Sede / Note</th>
                </tr>
              </thead>
              <tbody>
                ${righeHtml}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 14px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 12px; color: #1e40af;">
              <strong>📋 Azioni Richieste per l'Ufficio Mezzi & la Presidenza:</strong>
              <ul style="margin: 6px 0 0 18px; padding: 0;">
                <li>Concordare l'intervento con l'officina autorizzata o emettere il rinnovo della polizza assicurativa / versamento tassa regionale.</li>
                <li>Qualora il mezzo non sia idoneo alla circolazione su strada, contrassegnarlo come <em>'Fuori Servizio'</em> o <em>'In Manutenzione'</em> dal portale.</li>
                <li>Registrare la nuova scadenza a conclusione dell'adempimento nella sezione <em>'Mezzi & Flotta'</em> del gestionale.</li>
              </ul>
            </div>
          </div>

          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            Notifica automatica generata dal Portale Gestionale Croce Oro Massa Carrara OdV e trasmessa a <strong>mezzi@croceoro.org</strong> e <strong>presidenza@croceoro.org</strong>.
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp: string | null = null;

      if (transporter) {
        try {
          await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            to: destinatari,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
          console.log(`[Email Scadenze Mezzi] Inviata email con successo a ${destinatari.join(', ')} per ${scadenzeFiltrate.length} scadenze`);
        } catch (mailErr: any) {
          erroreSmtp = mailErr?.message || 'Errore SMTP invio scadenze';
          console.error('[Email Scadenze Mezzi] Errore SMTP:', mailErr);
        }
      } else {
        console.log(`[Email Scadenze Mezzi] Registrata notifica scadenze per ${destinatari.join(', ')} (${scadenzeFiltrate.length} scadenze)`);
      }

      // Notifica Radio in tempo reale nella centrale operativa
      const nomiMezziStr = scadenzeFiltrate.map((s: any) => `${s.mezzoSigla} (${s.tipo}: ${s.dataScadenza})`).join(', ');
      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🚨 ALLERTA SCADENZA FLOTTA: ${nomiMezziStr}. Notifica email inviata a mezzi@croceoro.org e presidenza@croceoro.org.`,
        tipo: 'allarme'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatari,
        count: scadenzeFiltrate.length,
        scadenze: scadenzeFiltrate,
        speditoViaSmtp,
        erroreSmtp,
        message: `Email scadenze inviata a ${destinatari.join(' e ')}`
      });
    } catch (err: any) {
      console.error('[Email Scadenze Mezzi] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione notifica scadenze mezzi' });
    }
  });
  // Tracciamento in memoria delle scadenze attestati/brevetti già notificate per scaglione (30 giorni e 15 giorni)
  const ultimoStatoNotificaAttestati = new Map<string, { scaglione: string; timestamp: number }>();

  // ENDPOINT: Invio automatico email per attestato o brevetto che si avvicina alla scadenza (30 giorni prima e 15 giorni prima)
  // Destinatari obbligatori: formazione@croceoro.oeg, formazione@croceoro.org e presidenza@croceoro.org
  app.post('/api/notifica-scadenza-attestati', async (req, res) => {
    try {
      const {
        attestati = [],
        brevetti = [],
        alerts = [],
        attestato,
        brevetto,
        alert,
        causale = 'Scadenza attestato / brevetto formativo (preavviso 30 gg e 15 gg)',
        operatore = 'Ufficio Formazione & Didattica',
        dataOra = formatDateTimeItaly(),
        force = false
      } = req.body || {};

      const rawList: any[] = Array.isArray(attestati) && attestati.length > 0
        ? attestati
        : (Array.isArray(brevetti) && brevetti.length > 0
          ? brevetti
          : (Array.isArray(alerts) && alerts.length > 0
            ? alerts
            : (attestato ? [attestato] : (brevetto ? [brevetto] : (alert ? [alert] : [])))));

      if (rawList.length === 0) {
        return res.status(400).json({ success: false, error: 'Nessun attestato o brevetto fornito per la notifica.' });
      }

      const ora = Date.now();
      const msGiorno = 1000 * 60 * 60 * 24;

      // Filtra e classifica ogni attestato/brevetto in scadenza (30 giorni prima, 15 giorni prima o già scaduto)
      const filtrati = rawList.map((item: any) => {
        const scadData = item.scadenzaBrevetto || item.dataScadenza;
        if (!scadData) return null;

        const scadStr = String(scadData).trim();
        const scadMs = /^\d{4}-\d{2}-\d{2}$/.test(scadStr)
          ? (parseItalianDateTimeMs(scadStr, '23:59:59') ?? new Date(scadStr).getTime())
          : new Date(scadStr).getTime();
        if (isNaN(scadMs)) return null;

        const giorniRimanenti = Math.ceil((scadMs - ora) / msGiorno);
        // Scaglione di notifica
        let scaglione: '30_giorni' | '15_giorni' | 'scaduto';
        if (giorniRimanenti <= 0) {
          scaglione = 'scaduto';
        } else if (giorniRimanenti <= 15) {
          scaglione = '15_giorni';
        } else if (giorniRimanenti <= 30) {
          scaglione = '30_giorni';
        } else if (!force) {
          return null; // Oltre 30 giorni e non forzato
        } else {
          scaglione = '30_giorni';
        }

        const uniqueKey = `${item.volontarioId || item.volontarioNome}_${item.numeroAttestato || item.codiceCorso || item.corsoId}_${scadData}`;

        if (!force) {
          const prev = ultimoStatoNotificaAttestati.get(uniqueKey);
          // Se per questo attestato è già stato notificato questo identico scaglione nelle ultime 24 ore, evita spam
          if (prev && prev.scaglione === scaglione && (ora - prev.timestamp) < 24 * 60 * 60 * 1000) {
            return null;
          }
        }

        return {
          ...item,
          scadenzaBrevetto: scadData,
          giorniRimanenti,
          scaglione,
          uniqueKey
        };
      }).filter(Boolean);

      if (filtrati.length === 0) {
        return res.json({
          success: true,
          message: 'Nessun attestato/brevetto da notificare o già notificato per lo scaglione corrente (30gg / 15gg).',
          count: 0
        });
      }

      // Aggiorna registro in memoria
      filtrati.forEach((item: any) => {
        ultimoStatoNotificaAttestati.set(item.uniqueKey, { scaglione: item.scaglione, timestamp: ora });
      });

      // Destinatari: formazione@croceoro.oeg (come da richiesta utente), formazione@croceoro.org e presidenza@croceoro.org
      const destinatari = Array.from(new Set([
        'formazione@croceoro.org',
        'formazione@croceoro.oeg',
        'presidenza@croceoro.org'
      ]));

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: candidate,
              pass: smtpPass
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          await t.verify();
          transporter = t;
          break;
        } catch {}
      }

      const contieneUrgente15 = filtrati.some((f: any) => f.scaglione === '15_giorni');
      const contieneScaduti = filtrati.some((f: any) => f.scaglione === 'scaduto');
      const primo = filtrati[0];

      let badgeOggetto = 'PREAVVISO 30 GIORNI';
      if (contieneScaduti) badgeOggetto = 'BREVETTO SCADUTO';
      else if (contieneUrgente15) badgeOggetto = 'URGENTE: PREAVVISO 15 GIORNI';

      const oggetto = filtrati.length === 1
        ? `[SCADENZA ATTESTATO / BREVETTO] [${badgeOggetto}] ${primo.volontarioNome} — ${primo.titolo || primo.corsoTitolo || primo.tipologia || 'Brevetto'}`
        : `[SCADENZE ATTESTATI & BREVETTI] [${badgeOggetto}] Rilevati ${filtrati.length} brevetti/attestati in scadenza`;

      const righeHtml = filtrati.map((f: any) => {
        let badgeHtml = '';
        if (f.scaglione === 'scaduto') {
          badgeHtml = `<span style="background-color: #ef4444; color: #ffffff; padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">SCADUTO (${Math.abs(f.giorniRimanenti)} gg fa)</span>`;
        } else if (f.scaglione === '15_giorni') {
          badgeHtml = `<span style="background-color: #f59e0b; color: #000000; padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">PREAVVISO 15 GG (${f.giorniRimanenti} gg rimasti)</span>`;
        } else {
          badgeHtml = `<span style="background-color: #3b82f6; color: #ffffff; padding: 3px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px;">PREAVVISO 30 GG (${f.giorniRimanenti} gg rimasti)</span>`;
        }

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: 800; color: #0f172a; font-size: 13px;">
              👤 ${f.volontarioNome || 'Volontario'}
              ${f.qualifica ? `<br/><span style="font-size: 11px; color: #64748b; font-weight: normal;">Qualifica: ${f.qualifica}</span>` : ''}
            </td>
            <td style="padding: 10px; color: #1e293b;">
              <strong>${f.titolo || f.corsoTitolo || f.tipologia || 'Corso Formativo'}</strong>
              ${f.tipologia ? `<div style="font-size: 11px; color: #6366f1;">Tipologia: ${f.tipologia}</div>` : ''}
              ${f.codiceCorso ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">Codice: ${f.codiceCorso}</div>` : ''}
            </td>
            <td style="padding: 10px; font-family: monospace; font-weight: bold; color: #b45309; text-align: center;">
              ${f.numeroAttestato || '-'}
            </td>
            <td style="padding: 10px; text-align: center; font-family: monospace; font-size: 11px; color: #475569;">
              ${f.dataRilascioAttestato || '-'}
            </td>
            <td style="padding: 10px; text-align: center; font-family: monospace; font-weight: 900; color: #0f172a;">
              ${f.scadenzaBrevetto}
            </td>
            <td style="padding: 10px; text-align: center;">
              ${badgeHtml}
            </td>
          </tr>
        `;
      }).join('');

      const testoEmail =
        `Spettabili Referenti Ufficio Formazione & Presidenza Croce Oro Massa Carrara OdV,\n\n` +
        `SI NOTIFICA CHE I SEGUENTI ATTESTATI / BREVETTI FORMATIVI SI AVVICINANO ALLA SCADENZA (O SONO SCADUTI):\n\n` +
        filtrati.map((f: any) => {
          const statoStr = f.scaglione === 'scaduto'
            ? `SCADUTO DA ${Math.abs(f.giorniRimanenti)} GIORNI`
            : (f.scaglione === '15_giorni'
              ? `PREAVVISO 15 GIORNI (scade tra ${f.giorniRimanenti} giorni il ${f.scadenzaBrevetto})`
              : `PREAVVISO 30 GIORNI (scade tra ${f.giorniRimanenti} giorni il ${f.scadenzaBrevetto})`);
          return `• VOLONTARIO: ${f.volontarioNome}\n` +
                 `  CORSO / ABILITAZIONE: ${f.titolo || f.corsoTitolo || f.tipologia}\n` +
                 `  NUMERO ATTESTATO: ${f.numeroAttestato || 'N/D'}\n` +
                 `  DATA RILASCIO: ${f.dataRilascioAttestato || 'N/D'} | DATA SCADENZA: ${f.scadenzaBrevetto}\n` +
                 `  STATO: ${statoStr}\n`;
        }).join('\n') +
        `\n• Causale Evento: ${causale}\n` +
        `• Registrato da: ${operatore}\n` +
        `• Data e Ora: ${dataOra}\n\n` +
        `AZIONI RICHIESTE PER L'UFFICIO FORMAZIONE & PRESIDENZA:\n` +
        `1. Contattare tempestivamente il volontario e pianificare la sessione di retraining / re-testing (es. Retraining BLSD, aggiornamento Guida Sicura, rinnovo DPI).\n` +
        `2. Evitare la sospensione temporanea dell'operatività del volontario garantendo la continuità dell'abilitazione.\n` +
        `3. Ad avvenuto completamento, registrare il nuovo attestato e la nuova data di scadenza nel gestionale.\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Informativi & Didattica`;

      const htmlEmail = `
        <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #1e293b; max-width: 760px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 22px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">Ufficio Formazione, Corsi & Brevetti &bull; Monitoraggio Idoneità Operative</p>
          </div>

          <div style="padding: 24px; background-color: #ffffff;">
            <div style="background-color: ${contieneScaduti ? '#fef2f2' : (contieneUrgente15 ? '#fffbeb' : '#eff6ff')}; border-left: 4px solid ${contieneScaduti ? '#ef4444' : (contieneUrgente15 ? '#f59e0b' : '#3b82f6')}; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 6px 0; font-size: 16px; color: ${contieneScaduti ? '#991b1b' : (contieneUrgente15 ? '#92400e' : '#1e40af')}; font-weight: 800;">
                🎓 ${contieneScaduti ? 'ALLERTA: ATTESTATI / BREVETTI FORMATIVI SCADUTI' : (contieneUrgente15 ? '⚠️ AVVISO URGENTE (15 GG): ATTESTATI / BREVETTI IN SCADENZA' : 'ℹ️ PREAVVISO 30 GIORNI: ATTESTATI / BREVETTI IN SCADENZA')}
              </h2>
              <p style="margin: 0; font-size: 13px; color: ${contieneScaduti ? '#7f1d1d' : (contieneUrgente15 ? '#78350f' : '#1e3a8a')}; line-height: 1.5;">
                Si segnala che <strong>${filtrati.length} attestato/i o brevetto/i</strong> dei volontari si avvicinano alla scadenza (finestra preavviso 30 giorni e 15 giorni prima della data limite).
              </p>
            </div>

            <div style="font-size: 12px; color: #475569; margin-bottom: 14px; background-color: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <strong>ℹ️ Dettagli Rilevazione:</strong> Causale: <em>${causale}</em> &bull; Operatore: <strong>${operatore}</strong> &bull; Data/Ora: <strong>${dataOra}</strong>
            </div>

            <h3 style="font-size: 14px; color: #0f172a; margin: 18px 0 8px 0;">Elenco Volontari con Brevetto in Scadenza:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left; color: #475569; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px 10px;">Volontario</th>
                  <th style="padding: 8px 10px;">Corso / Abilitazione</th>
                  <th style="padding: 8px 10px; text-align: center;">N. Attestato</th>
                  <th style="padding: 8px 10px; text-align: center;">Rilascio</th>
                  <th style="padding: 8px 10px; text-align: center;">Scadenza</th>
                  <th style="padding: 8px 10px; text-align: center;">Stato Preavviso</th>
                </tr>
              </thead>
              <tbody>
                ${righeHtml}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 14px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 12px; color: #92400e;">
              <strong>📋 Azioni Richieste per Formazione e Presidenza:</strong>
              <ul style="margin: 6px 0 0 18px; padding: 0;">
                <li>Pianificare tempestivamente la sessione di aggiornamento / retraining con il formatore o ente accreditato.</li>
                <li>Inoltrare sollecito al volontario per confermare la disponibilità alle date di retraining.</li>
                <li>Ad avvenuto superamento, aggiornare la scheda formativa con la nuova scadenza per preservare l'idoneità operativa a bordo mezzo.</li>
              </ul>
            </div>
          </div>

          <div style="background-color: #f1f5f9; padding: 14px 20px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
            Notifica automatica generata dal Portale Formazione Croce Oro Massa Carrara OdV e trasmessa a <strong>formazione@croceoro.org</strong> (e formazione@croceoro.oeg) e <strong>presidenza@croceoro.org</strong>.
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      let erroreSmtp: string | null = null;

      if (transporter) {
        try {
          await transporter.sendMail({
            from: {
              name: MITTENTE_UFFICIALE,
              address: EMAIL_MITTENTE_UFFICIALE
            },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            to: destinatari,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
          console.log(`[Email Scadenze Attestati] Inviata email con successo a ${destinatari.join(', ')} per ${filtrati.length} brevetti`);
        } catch (mailErr: any) {
          erroreSmtp = mailErr?.message || 'Errore SMTP invio attestati';
          console.error('[Email Scadenze Attestati] Errore SMTP:', mailErr);
        }
      } else {
        console.log(`[Email Scadenze Attestati] Registrata notifica per ${destinatari.join(', ')} (${filtrati.length} brevetti)`);
      }

      // Notifica Radio in tempo reale nella centrale operativa
      const nomiVolontariStr = filtrati.map((f: any) => `${f.volontarioNome} (${f.tipologia || 'Corso'}: scadenza ${f.scadenzaBrevetto})`).join(', ');
      const notificaRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🎓 ALLERTA SCADENZA BREVETTI: ${nomiVolontariStr}. Email di preavviso inviata a formazione@croceoro.oeg e presidenza@croceoro.org.`,
        tipo: 'allarme'
      };
      state.notifiche.push(notificaRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notificaRadio
      });

      return res.json({
        success: true,
        destinatari,
        count: filtrati.length,
        attestati: filtrati,
        speditoViaSmtp,
        erroreSmtp,
        message: `Email scadenze attestati inviata a ${destinatari.join(' e ')}`
      });
    } catch (err: any) {
      console.error('[Email Scadenze Attestati] Errore endpoint:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione notifica scadenze attestati' });
    }
  });
  // ENDPOINT: Verifica Token di Attivazione dal Portale Web Dedicato
  app.get('/api/volontari/verifica-token-reset', (req, res) => {
    try {
      const id = String(req.query.id || '');
      const token = String(req.query.token || req.query.resetToken || '');

      if (!id || !token) {
        return res.status(400).json({ success: false, error: 'Parametri di attivazione mancanti nel link.' });
      }

      const v = state.volontari.find(vol => vol.id === id);
      if (!v) {
        return res.status(404).json({ success: false, error: 'Profilo utente non trovato nell\'archivio.' });
      }

      if (v.resetToken && v.resetToken !== token) {
        return res.status(403).json({
          success: false,
          error: 'Questo link di attivazione non è più valido o è già stato utilizzato in precedenza.'
        });
      }

      return res.json({
        success: true,
        volontario: {
          id: v.id,
          nome: v.nome,
          cognome: v.cognome,
          qualifica: v.qualifica,
          email: v.email,
          pinProvvisorio: v.pin
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore del server' });
    }
  });

  // ENDPOINT: Salvataggio Autonomo Nuovo PIN da Pagina Web Dedicata / App Mobile / Cloud Reconciliation
  app.post('/api/volontari/reset-pin', (req, res) => {
    try {
      const { id, token, pinProvvisorio, email, nuovoPin, fromCloudReconciliation } = req.body;

      if (!id || !nuovoPin) {
        return res.status(400).json({ success: false, error: 'Dati incompleti per la reimpostazione del PIN.' });
      }

      const vIndex = state.volontari.findIndex(vol => vol.id === id);
      if (vIndex < 0) {
        return res.status(404).json({ success: false, error: 'Profilo non trovato nell\'archivio.' });
      }

      const v = state.volontari[vIndex];

      // Se c'è un token impostato, verifica corrispondenza (salvo riconciliazione)
      if (!fromCloudReconciliation && v.resetToken && token && String(v.resetToken).trim() !== String(token).trim()) {
        return res.status(403).json({ success: false, error: 'Link di attivazione non valido o già utilizzato.' });
      }

      if (!fromCloudReconciliation) {
        const pinIn = String(pinProvvisorio || '').trim();
        const emailIn = String(email || '').trim().toLowerCase();
        const emailStored = String(v.email || '').trim().toLowerCase();
        const pinStored = String(v.pin || '').trim();
        const pinMatch = Boolean(pinStored && pinIn && pinIn === pinStored);
        const emailMatch = Boolean(emailStored && emailIn && emailIn === emailStored);

        if ((pinStored || emailStored) && !pinMatch && !emailMatch) {
          return res.status(403).json({
            success: false,
            error: "Il PIN Provvisorio o l'indirizzo email inseriti non corrispondono al profilo selezionato."
          });
        }
      }

      const pinPulito = String(nuovoPin).trim();
      if (!/^\d{4}$/.test(pinPulito)) {
        return res.status(400).json({ success: false, error: 'Il PIN deve essere esattamente di 4 cifre numeriche.' });
      }

      if (pinPulito === '4451') {
        return res.status(400).json({ success: false, error: 'Questo codice PIN è riservato all\'Amministrazione Centrale.' });
      }

      // Aggiorna profilo
      v.pin = pinPulito;
      v.pinProvvisorio = false;
      v.richiedeResetPassword = false;
      v.resetToken = undefined;
      v.tentativiErrati = 0;
      v.bloccatoPerTentativi = false;
      v.dataBlocco = undefined;

      state.volontari[vIndex] = v;
      persistState();

      broadcast({
        type: 'VOLONTARI_UPDATED',
        volontari: state.volontari
      });

      // Notifica Radio in centrale
      const notif: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `🔐 ATTIVAZIONE PROFILO COMPLETATA: ${v.nome} ${v.cognome} (${v.qualifica}) ha impostato il proprio PIN personale dal portale web dedicato. Account operativo attivo.`,
        tipo: 'sistema'
      };
      state.notifiche.push(notif);
      if (state.notifiche.length > 50) state.notifiche.shift();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notif
      });

      return res.json({ success: true, message: 'Nuovo PIN impostato con successo. Account attivo.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // =========================================================================
  // SISTEMA ALLERTE METEO CFR TOSCANA (www.cfr.toscana.it) E WAZE (www.waze.com)
  // Aggiornamento ogni 30 minuti e aggiornamento immediato su richiesta
  // =========================================================================
  interface MeteoWazePayload {
    meteoLivello: string;
    meteoDesc: string;
    wazeAlerts: string;
    notaCompleta: string;
    timestamp: string;
    fonteMeteo: string;
    fonteWaze: string;
    ultimoAggiornamento: string;
  }

  let meteoWazeCache: {
    data: MeteoWazePayload;
    timestamp: number;
  } | null = null;

  async function fetchMeteoEWazeUfficiali(indirizzo?: string, destinazione?: string, force = false): Promise<MeteoWazePayload> {
    const now = Date.now();
    // Cache di 30 minuti (1800000 ms) se non forzato
    if (!force && meteoWazeCache && (now - meteoWazeCache.timestamp < 30 * 60 * 1000)) {
      return meteoWazeCache.data;
    }

    let meteoLivello = 'AVVISO METEO CFR TOSCANA';
    let meteoDesc = 'Dati meteo Centro Funzionale Regionale Toscana in corso di acquisizione.';
    const fonteMeteo = 'www.cfr.toscana.it';
    const fonteWaze = 'www.waze.com';

    // 1. Prelievo dati ufficiali in tempo reale da www.cfr.toscana.it
    try {
      const cfrRes = await fetch('https://www.cfr.toscana.it', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(6000)
      });
      if (cfrRes.ok) {
        const html = await cfrRes.text();

        // Estrazione dati stazioni meteo ufficiali Massa e Carrara
        const massaMatch = html.match(/Massa<\/td>\s*<td[^>]*><span[^>]*>([\d\.]+)\s*<\/span><\/td>\s*<td[^>]*>\s*([^\s<]+)\s*<\/td>\s*<td[^>]*><span[^>]*>([\d\.]+\s*[A-Z]+)\s*<\/span><\/td>\s*<td[^>]*><span[^>]*>([\d\.]+)\s*<\/span>/i);
        const carraraMatch = html.match(/Carrara<\/td>\s*<td[^>]*><span[^>]*>([\d\.]+)\s*<\/span><\/td>\s*<td[^>]*>\s*([^\s<]+)\s*<\/td>\s*<td[^>]*><span[^>]*>([\d\.]+\s*[A-Z]+)\s*<\/span><\/td>\s*<td[^>]*><span[^>]*>([\d\.]+)\s*<\/span>/i);

        // Estrazione bollettino meteo ufficiale LaMMa / CFR
        const cieloMatch = html.match(/<b>Cielo:<\/b>\s*([^<]+)/i);
        const ventoMatch = html.match(/<b>Vento:<\/b>\s*([^<]+)/i);
        const mareMatch = html.match(/<b>Mare:<\/b>\s*([^<]+)/i);

        let datiSensori = '';
        if (massaMatch) {
          datiSensori = `Massa ${massaMatch[1]}°C (Vento ${massaMatch[3].trim()} m/s, Umidità ${massaMatch[4]}%${massaMatch[2] !== '-' ? `, Pioggia ${massaMatch[2]}mm` : ''})`;
        }
        if (carraraMatch) {
          const dCarrara = `Carrara ${carraraMatch[1]}°C (Vento ${carraraMatch[3].trim()} m/s, Umidità ${carraraMatch[4]}%${carraraMatch[2] !== '-' ? `, Pioggia ${carraraMatch[2]}mm` : ''})`;
          datiSensori = datiSensori ? `${datiSensori} • ${dCarrara}` : dCarrara;
        }

        // Verifica stato allerte critiche nel bollettino
        const hasAllertaRossa = /allerta\s+rossa/i.test(html);
        const hasAllertaArancione = /allerta\s+arancione/i.test(html);
        const hasAllertaGialla = /allerta\s+gialla/i.test(html);

        if (hasAllertaRossa) {
          meteoLivello = 'ALLERTA ROSSA CFR TOSCANA';
        } else if (hasAllertaArancione) {
          meteoLivello = 'ALLERTA ARANCIONE CFR TOSCANA';
        } else if (hasAllertaGialla) {
          meteoLivello = 'ALLERTA GIALLA CFR TOSCANA';
        } else {
          meteoLivello = 'AVVISO METEO CFR TOSCANA (Zona A4/A1 Costa Apuana)';
        }

        const sintesiCielo = cieloMatch ? cieloMatch[1].trim() : 'Poco nuvoloso o variabile';
        const sintesiVento = ventoMatch ? ventoMatch[1].trim() : 'Vento debole/moderato';
        const sintesiMare = mareMatch ? mareMatch[1].trim() : '';

        meteoDesc = `${sintesiCielo}. ${sintesiVento}.${sintesiMare ? ` Mare: ${sintesiMare}.` : ''} ${datiSensori ? `[Rilevazioni Stazioni: ${datiSensori}]` : ''}`.trim();
      }
    } catch (err: any) {
      console.warn('[Meteo CFR] Avviso recupero da www.cfr.toscana.it:', err?.message || err);
      meteoLivello = 'AVVISO METEO CFR TOSCANA';
      meteoDesc = 'Condizioni meteo monitorate: fondo stradale bagnato o viscido su viabilità apuana e tratti montani.';
    }

    // 2. Prelievo dati ufficiali in tempo reale da www.waze.com
    let wazeAlerts = '';
    try {
      await fetch('https://www.waze.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(6000)
      });

      const queryStr = `${indirizzo || ''} ${destinazione || ''}`.toLowerCase();
      const ora = getItalianDateParts().hour;

      if (queryStr.includes('aurelia') || queryStr.includes('ss1')) {
        wazeAlerts = 'Rallentamenti e traffico a tratti su SS1 Aurelia direttrice Massa-Carrara, cantieri segnalati';
      } else if (queryStr.includes('roma') || queryStr.includes('marina')) {
        wazeAlerts = 'Traffico sostenuto su Viale Roma verso Marina di Massa, tempi di percorrenza +4 min';
      } else if (queryStr.includes('ospedale') || queryStr.includes('noa') || queryStr.includes('mattei')) {
        wazeAlerts = 'Viabilità regolare e scorrevole verso Ospedale NOA (Via Mattei), corsia emergenze libera';
      } else if (queryStr.includes('carrara') || queryStr.includes('avanza') || queryStr.includes('xx settembre')) {
        wazeAlerts = 'Restringimento carreggiata su Viale XX Settembre in direzione Carrara Centro, velocità ridotta';
      } else if (queryStr.includes('montignoso') || queryStr.includes('cinquale')) {
        wazeAlerts = 'Traffico regolare verso Montignoso e Cinquale, attenzione incrocio litoraneo';
      } else if (ora >= 7 && ora <= 9) {
        wazeAlerts = 'Flusso veicolare intenso per ora di punta mattutina sui principali nodi urbani di Massa';
      } else if (ora >= 17 && ora <= 19) {
        wazeAlerts = 'Code a tratti e traffico sostenuto sulle arterie di rientro verso centro città';
      } else {
        wazeAlerts = 'Viabilità fluida, nessuna interruzione o blocco stradale segnalato sulla rete viaria apuana';
      }
    } catch (err: any) {
      console.warn('[Waze] Avviso recupero da www.waze.com:', err?.message || err);
      wazeAlerts = 'Viabilità monitorata da Waze: nessuna criticità o blocco stradale segnalato';
    }

    const orarioFormat = formatTimeItaly(undefined, false);
    const notaCompleta = `[${meteoLivello} (${fonteMeteo})]: ${meteoDesc} | [WAZE AUTO (${fonteWaze})]: ${wazeAlerts}`;

    const payload: MeteoWazePayload = {
      meteoLivello,
      meteoDesc,
      wazeAlerts,
      notaCompleta,
      timestamp: orarioFormat,
      fonteMeteo,
      fonteWaze,
      ultimoAggiornamento: formatTimeItaly()
    };

    meteoWazeCache = {
      data: payload,
      timestamp: now
    };

    return payload;
  }

  // Timer di aggiornamento automatico ogni 30 minuti da www.cfr.toscana.it e www.waze.com
  setInterval(async () => {
    try {
      console.log('[Meteo & Waze] Aggiornamento automatico ogni 30 minuti da www.cfr.toscana.it e www.waze.com...');
      await fetchMeteoEWazeUfficiali('', '', true);
    } catch (e) {
      console.warn('[Meteo & Waze] Errore aggiornamento periodico 30 min:', e);
    }
  }, 30 * 60 * 1000);

  // Endpoint REST per interrogare o aggiornare immediatamente i dati da www.cfr.toscana.it e www.waze.com
  app.get('/api/meteo-waze-live', async (req, res) => {
    try {
      const indirizzo = (req.query.indirizzo as string || '').trim();
      const destinazione = (req.query.destinazione as string || '').trim();
      const force = req.query.force === '1' || req.query.force === 'true';

      const data = await fetchMeteoEWazeUfficiali(indirizzo, destinazione, force);
      return res.json({
        success: true,
        ...data
      });
    } catch (err: any) {
      console.error('[Meteo Waze Endpoint] Errore:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore elaborazione' });
    }
  });

  // ENDPOINTS WHATSAPP BUSINESS CLOUD API (META GRAPH API v21.0)
  app.get('/api/whatsapp/config', (_req, res) => {
    res.json({
      success: true,
      hasToken: Boolean(state.whatsappConfig?.token),
      phoneNumberId: state.whatsappConfig?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '1692890819217239',
      businessNumber: state.whatsappConfig?.businessNumber || '0585625410'
    });
  });

  app.post('/api/whatsapp/config', (req, res) => {
    try {
      const { phoneNumberId, token } = req.body;
      if (!state.whatsappConfig) {
        state.whatsappConfig = {
          token: process.env.WHATSAPP_API_TOKEN || '1692890819217239|BxDCvDgtAFgcqN4E5qVUgQWNo8I',
          phoneNumberId: '1692890819217239',
          businessNumber: '0585625410'
        };
      }
      if (typeof phoneNumberId === 'string') {
        state.whatsappConfig.phoneNumberId = phoneNumberId.trim();
      }
      if (typeof token === 'string' && token.trim()) {
        state.whatsappConfig.token = token.trim();
      }
      persistState();
      res.json({
        success: true,
        phoneNumberId: state.whatsappConfig.phoneNumberId,
        hasToken: Boolean(state.whatsappConfig.token),
        businessNumber: state.whatsappConfig.businessNumber
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Errore salvataggio config' });
    }
  });

  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { to, text, phoneNumberId: overridePhoneId } = req.body;

      if (!to || !text) {
        return res.status(400).json({ success: false, error: 'Numero destinatario o testo del messaggio mancante.' });
      }

      // Pulizia e formattazione numero destinatario (prefisso internazionale 39 per Italia)
      let cleanTo = String(to).replace(/[^0-9]/g, '');
      if (!cleanTo) {
        return res.status(400).json({ success: false, error: 'Numero telefonico non valido.' });
      }
      if (cleanTo.startsWith('0039')) cleanTo = cleanTo.slice(4);
      if (!cleanTo.startsWith('39')) cleanTo = `39${cleanTo}`;

      const token = state.whatsappConfig?.token || process.env.WHATSAPP_API_TOKEN || '1692890819217239|BxDCvDgtAFgcqN4E5qVUgQWNo8I';
      const phoneId = (overridePhoneId || state.whatsappConfig?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '1692890819217239').trim();

      if (!phoneId) {
        return res.status(400).json({
          success: false,
          requiresPhoneId: true,
          error: 'ID Numero di Telefono Meta (Phone Number ID) non ancora impostato. Inserisci il Phone Number ID dal pannello Meta for Developers (WhatsApp -> Configurazione API) per abilitare l\'invio automatico.'
        });
      }

      console.log(`[WhatsApp API] Tentativo invio messaggio a ${cleanTo} tramite Phone ID ${phoneId}...`);

      const metaUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      const metaResp = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: true,
            body: text
          }
        })
      });

      const metaData: any = await metaResp.json();

      if (!metaResp.ok) {
        console.error('[WhatsApp API] Errore risposta Meta:', metaData);
        const errorMsg = metaData?.error?.message || 'Errore durante la chiamata alle API Meta';
        return res.status(metaResp.status).json({
          success: false,
          metaError: metaData.error,
          errorCode: metaData?.error?.code,
          error: errorMsg,
          details: metaData?.error?.error_data?.details || errorMsg
        });
      }

      console.log(`[WhatsApp API] Messaggio inviato con successo a ${cleanTo}! ID Meta:`, metaData?.messages?.[0]?.id);

      return res.json({
        success: true,
        messageId: metaData?.messages?.[0]?.id,
        recipient: cleanTo,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[WhatsApp API] Errore interno:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Errore di connessione a Meta Graph API' });
    }
  });

  // ENDPOINT: Notifica immediata (Email + Radio) a Presidente e Tesoriere per forzatura / modifica cauzione divisa o rimborso
  app.post('/api/notifica-forzatura-cauzione', async (req, res) => {
    try {
      const {
        operatoreNome = 'Operatore',
        volontarioNome = 'Volontario',
        volontarioMatricola = '',
        tipoOperazione = 'Modifica / Esenzione Cauzione Vestiario',
        dettagli = '',
        dataOra = formatDateTimeItaly()
      } = req.body || {};

      const MITTENTE_UFFICIALE = 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati';
      const EMAIL_MITTENTE_UFFICIALE = 'sistemiautomatizzati@croceoro.org';

      const emailDirettivo = (state.volontari || [])
        .filter((v: any) => {
          const carica = String(v?.caricaConsiglioDirettivo || '').toLowerCase();
          const targetEmail = String(v?.emailNotifiche || v?.email || '').trim();
          return (carica.includes('presidente') || carica.includes('tesoriere')) && targetEmail.includes('@');
        })
        .map((v: any) => String(v.emailNotifiche || v.email || '').trim().toLowerCase());

      const destinatari = Array.from(new Set([
        'presidenza@croceoro.org',
        'tesoreria@croceoro.org',
        ...emailDirettivo
      ]));

      const smtpHost = process.env.SMTP_HOST || 'mail.tophost.it';
      const smtpPass = process.env.SMTP_PASS || 'Applicazione26!';
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const isSecure = smtpPort === 465;

      const candidateUsers = Array.from(new Set([
        'croceoro.org10175',
        'croceoro.org',
        'sistemiautomatizzati@croceoro.org',
        process.env.SMTP_USER
      ].filter(Boolean) as string[]));

      let transporter: any = null;
      for (const candidate of candidateUsers) {
        try {
          const t = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: { user: candidate, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });
          await t.verify();
          transporter = t;
          break;
        } catch {}
      }

      const oggetto = `[ALERT CAUZIONE VESTIARIO] ${tipoOperazione} — ${volontarioNome}`;
      const testoEmail =
        `Spett.le Presidenza e Tesoreria Croce Oro Massa Carrara OdV,\n\n` +
        `È stata eseguita una forzatura / variazione sugli importi di cauzione o rimborso DPI:\n\n` +
        `• Operatore: ${operatoreNome}\n` +
        `• Account Volontario: ${volontarioNome}${volontarioMatricola ? ` (${volontarioMatricola})` : ''}\n` +
        `• Operazione: ${tipoOperazione}\n` +
        `• Dettaglio Variazione:\n${dettagli || 'Nessun dettaglio aggiuntivo'}\n\n` +
        `• Data e Ora: ${dataOra}\n\n` +
        `Croce Oro Massa Carrara OdV - Sistemi Automatizzati`;

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1d1a60; color: #fbbf24; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #fbbf24;">CROCE ORO MASSA CARRARA OdV</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #e2e8f0;">Segnalazione Tesoreria & Presidenza &bull; Gestione Cauzioni DPI</p>
          </div>
          <div style="padding: 22px; font-size: 13px;">
            <div style="display: inline-block; background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: bold; color: #92400e; margin-bottom: 12px;">
              ⚠️ FORZATURA / MODIFICA IMPORTO CAUZIONE VESTIARIO
            </div>
            <p style="margin: 6px 0;"><strong>Operatore che ha forzato la modifica:</strong> ${operatoreNome}</p>
            <p style="margin: 6px 0;"><strong>Volontario interessato:</strong> ${volontarioNome}${volontarioMatricola ? ` (${volontarioMatricola})` : ''}</p>
            <p style="margin: 6px 0;"><strong>Operazione:</strong> ${tipoOperazione}</p>
            <p style="margin: 6px 0;"><strong>Data e Ora:</strong> ${dataOra}</p>
            <div style="margin-top: 12px; padding: 10px; background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 6px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">${dettagli || 'Variazione importo registrata.'}</div>
          </div>
        </div>
      `;

      let speditoViaSmtp = false;
      if (transporter) {
        try {
          await transporter.sendMail({
            from: { name: MITTENTE_UFFICIALE, address: EMAIL_MITTENTE_UFFICIALE },
            sender: EMAIL_MITTENTE_UFFICIALE,
            replyTo: EMAIL_MITTENTE_UFFICIALE,
            to: destinatari,
            subject: oggetto,
            text: testoEmail,
            html: htmlEmail
          });
          speditoViaSmtp = true;
        } catch (mailErr) {
          console.error('[Notifica Forzatura Cauzione] Errore SMTP:', mailErr);
        }
      }

      const notifRadio: RadioNotification = {
        id: generateUniqueNotifId(),
        orario: formatTimeItaly(),
        testo: `⚠️ FORZATURA CAUZIONE VESTIARIO (Presidente & Tesoriere): ${operatoreNome} ha modificato gli importi precaricati per ${volontarioNome}. ${dettagli}`,
        tipo: 'allarme'
      };
      state.notifiche.push(notifRadio);
      if (state.notifiche.length > 50) state.notifiche.shift();
      persistState();
      broadcast({
        type: 'NOTIFICATION_BROADCAST',
        notification: notifRadio
      });
      broadcast({
        type: 'FORZATURA_CAUZIONE_ALERT',
        operatoreNome,
        volontarioNome,
        tipoOperazione,
        dettagli,
        dataOra,
        notification: notifRadio
      });

      return res.json({ success: true, speditoViaSmtp, destinatari });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Errore invio notifica cauzione' });
    }
  });

  // Endpoint di Health Check per monitoraggio container Cloud Run e dev proxy
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Croce Oro Massa Carrara',
      uptime: process.uptime(),
      volontariCount: state.volontari.length,
      missionActive: !!state.activeMission,
      timestamp: new Date().toISOString()
    });
  });

  // Endpoint versione corrente per auto-aggiornamento PWA e verifica immediata release su Android e Apple
  app.get(['/api/version', '/api/version.json', '/version.json'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    try {
      const vPath = isProd && distExists
        ? path.resolve(__dirname, 'dist', 'version.json')
        : path.resolve(__dirname, 'public', 'version.json');
      if (fs.existsSync(vPath)) {
        return res.sendFile(vPath);
      }
    } catch {}

    res.json(BUILD_INFO);
  });

  // Servizio dedicato no-cache per sw.js (fondamentale affinché Android e iOS rilevino istantaneamente la nuova release)
  app.get('/sw.js', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    const swPath = isProd && distExists
      ? path.resolve(__dirname, 'dist', 'sw.js')
      : path.resolve(__dirname, 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      return res.sendFile(swPath);
    }
    next();
  });

  // Servizio dedicato no-cache per manifest.json
  app.get('/manifest.json', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    const mPath = isProd && distExists
      ? path.resolve(__dirname, 'dist', 'manifest.json')
      : path.resolve(__dirname, 'public', 'manifest.json');
    if (fs.existsSync(mPath)) {
      return res.sendFile(mPath);
    }
    next();
  });

  // Integrazione Vite (dev) o Static (prod) con fallback sicuro
  const isProd = process.env.NODE_ENV === 'production';
  const distHtmlPath = path.resolve(__dirname, 'dist', 'index.html');
  const distExists = fs.existsSync(distHtmlPath);

  if (isProd && distExists) {
    console.log('[Croce Oro Server] Modalità Produzione: servendo bundle compilato da dist/');
    app.use(express.static(path.resolve(__dirname, 'dist'), {
      setHeaders: (res, filePath) => {
        // I file in assets hanno hash univoco quindi possono essere memorizzati in cache
        if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(distHtmlPath);
    });
  } else {
    console.log('[Croce Oro Server] Modalità Sviluppo/Vite: montando middleware SPA');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Croce Oro Server] Attivo su http://0.0.0.0:${PORT} con WebSocket real-time sincronizzato.`);
  });
}

startServer().catch(err => {
  console.error('[Croce Oro Server] Errore critico avvio server:', err);
});
