// Servizio di comunicazione in tempo reale Multi-Trasporto:
// 1. Firebase Cloud Firestore Live (onSnapshot) -> Sincronizzazione globale reale su Vercel, Mobile PWA e Desktop
// 2. WebSocket & HTTP Polling -> Sincronizzazione locale/Express (tsx server.ts / Cloud Server dedicato)

import {
  subscribeToFirebaseAuth,
  signInWithGoogleCloudSync,
  signOutCloudSync,
  richiediAbilitazioneOperatore,
  listenShardDoc,
  readShardDocFromServer,
  writeShardDoc,
  testFirestoreConnection,
  getLastFirebaseAuthError,
  FirebaseSessionState,
  fetchOperatorRequestsForAdmin,
  fetchApprovedOperatorsForAdmin,
  approvaOperatoreCloud,
  revocaOperatoreCloud,
  OperatorRequestRecord,
  ApprovedOperatorRecord,
  verificaTicketResetPinFirestore,
  segnaTicketResetApplicatoFirestore,
  syncPinResetProfilesFirestore,
  fetchCompletedPinResetProfilesFirestore,
  listenCompletedPinResetProfilesFirestore,
  segnaProfiloResetApplicatoFirestore,
  PinResetProfileRecord,
  ShiftSignupRecord,
  salvaCandidaturaTurnoFirestore,
  listenPendingShiftSignupsFirestore,
  segnaCandidaturaTurnoApplicataFirestore,
} from './firebase';
import { formatDateTimeItaly, formatTimeItaly } from '../utils/italianTime';
import { mergeVolontariListsSafe, normalizeDeletedIds } from '../utils/volontariMerge';
import {
  normalizzaListaSediAssociative,
  normalizzaListaLuoghiTimbratura,
  normalizzaTurniSedi,
  normalizzaComunicazioniBacheca,
} from '../utils/sediNormalize';
import {
  capturePublicUrlIfApplicable,
  getConfiguredPublicUrl,
  isProtectedAiStudioHost,
  saveConfiguredPublicUrlLocal,
} from '../utils/publicUrl';

type MessageHandler = (data: any) => void;

export type SyncShardId =
  | 'mission'
  | 'volontari'
  | 'servizi'
  | 'turni'
  | 'bacheca'
  | 'magazzino'
  | 'timbrature'
  | 'indirizzi'
  | 'checklists'
  | 'config';

const ALL_SHARD_IDS: SyncShardId[] = [
  'mission',
  'volontari',
  'servizi',
  'turni',
  'bacheca',
  'magazzino',
  'timbrature',
  'indirizzi',
  'checklists',
  'config',
];

export interface ConnectionInfo {
  connected: boolean;
  status: 'connected' | 'connecting' | 'polling' | 'disconnected' | 'auth_required';
  transport: 'firestore' | 'websocket' | 'http' | 'none';
  serverUrl: string;
  firestoreActive?: boolean;
  websocketActive?: boolean;
  httpActive?: boolean;
  firebaseStatus?: FirebaseSessionState['status'];
  firebaseEmail?: string | null;
  firebaseUid?: string | null;
  firebaseIsAdmin?: boolean;
  lastError?: string | null;
}

class RealtimeService {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pollTimer: any = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  public isConnected: boolean = false;
  public connectionStatus: ConnectionInfo['status'] = 'connecting';
  public currentTransport: ConnectionInfo['transport'] = 'none';

  private wsConnected: boolean = false;
  private httpPollingOk: boolean = false;
  private firestoreActive: boolean = false;
  private lastError: string | null = null;

  private firebaseSession: FirebaseSessionState = {
    ready: false,
    user: null,
    email: null,
    uid: null,
    displayName: null,
    isAdmin: false,
    isAuthorized: false,
    status: 'signed_out',
    requestStatus: null,
  };

  private shardUnsubscribers: Array<() => void> = [];
  private shardVersions: Record<SyncShardId, number> = {
    mission: 0,
    volontari: 0,
    servizi: 0,
    turni: 0,
    bacheca: 0,
    magazzino: 0,
    timbrature: 0,
    indirizzi: 0,
    checklists: 0,
    config: 0,
  };
  private shardExists: Record<SyncShardId, boolean> = {
    mission: false,
    volontari: false,
    servizi: false,
    turni: false,
    bacheca: false,
    magazzino: false,
    timbrature: false,
    indirizzi: false,
    checklists: false,
    config: false,
  };
  private shardDirtyTimers: Partial<Record<SyncShardId, any>> = {};
  private shardLoadedFromCloud: Record<SyncShardId, boolean> = {
    mission: false,
    volontari: false,
    servizi: false,
    turni: false,
    bacheca: false,
    magazzino: false,
    timbrature: false,
    indirizzi: false,
    checklists: false,
    config: false,
  };
  private pendingInitialWrites: Set<SyncShardId> = new Set();
  private cloudShardsReadyEmitted: boolean = false;
  private shardRetryTimers: Partial<Record<SyncShardId, any>> = {};
  private shardRetryCounts: Partial<Record<SyncShardId, number>> = {};
  private lastVolontariRefreshAt: number = 0;
  private lastExpressVolontariSig: string = '';
  private pinResetCheckInFlight: Set<string> = new Set();
  private pinResetProfilesReconciling: Set<string> = new Set();
  private pinResetProfileUnsub: (() => void) | null = null;
  private lastPinResetSweepAt: number = 0;
  private shiftSignupsUnsub: (() => void) | null = null;
  private shiftSignupsReconciling: Set<string> = new Set();
  private pendingShiftSignupsQueue: ShiftSignupRecord[] = [];

  // Cache unificata dello stato cloud tra tutti gli shard / server
  private cloudState: Record<string, any> = {};
  private localRadioClientMeta: {
    opus: boolean;
    volontarioId: string;
    role: 'admin' | 'volontario';
    activeChannelId: string;
  } = {
    opus: false,
    volontarioId: '',
    role: 'volontario',
    activeChannelId: 'general',
  };

  // URL Cloud Run predefinito per app Android / Play Store (TWA / WebView / Capacitor)
  private readonly DEFAULT_CLOUD_URL = 'https://ais-pre-hbtv34atqqzbpmvu75qbfi-778684122016.europe-west2.run.app';

  constructor() {
    capturePublicUrlIfApplicable();
    this.initFirebaseRealtime();
    this.connect();
    this.startFallbackPolling();
    this.setupLifecycleSyncHooks();
  }

  private setupLifecycleSyncHooks() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const flushPending = () => {
      (Object.keys(this.shardDirtyTimers) as SyncShardId[]).forEach((shardId) => {
        if (this.shardDirtyTimers[shardId]) {
          clearTimeout(this.shardDirtyTimers[shardId]);
          delete this.shardDirtyTimers[shardId];
          this.flushShardToFirestore(shardId).catch(() => {});
        }
      });
    };

    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushPending();
      } else if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (this.firebaseSession.isAuthorized && now - this.lastVolontariRefreshAt > 15000) {
          this.lastVolontariRefreshAt = now;
          this.refreshShardFromServer('volontari').catch(() => {});
          this.reconcileCompletedPinResets().catch(() => {});
        }
      }
    });
  }

  private async refreshShardFromServer(shardId: SyncShardId) {
    if (!this.firebaseSession.isAuthorized) return;
    const res = await readShardDocFromServer(shardId);
    this.shardLoadedFromCloud[shardId] = true;
    this.shardExists[shardId] = res.exists;
    if (res.exists && res.data) {
      const incomingVer = typeof res.data.version === 'number' ? res.data.version : 1;
      if (incomingVer > this.shardVersions[shardId]) {
        this.shardVersions[shardId] = incomingVer;
      }
      if (res.data.payload && typeof res.data.payload === 'object') {
        this.applyCloudShardPayload(shardId, res.data.payload, true);
      }
    }
  }

  public isServerlessStatic(): boolean {
    return this.isServerlessStaticHost();
  }

  private isServerlessStaticHost(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    const hasCustomUrl = Boolean(localStorage.getItem('CROCE_ORO_SERVER_URL')?.trim());
    if (hasCustomUrl) return false;
    return host.endsWith('.vercel.app') || host === 'www.croceoro.org' || host === 'croceoro.org';
  }

  private recomputeConnectionStatus() {
    if (this.firestoreActive && this.wsConnected) {
      this.isConnected = true;
      this.connectionStatus = 'connected';
      this.currentTransport = 'firestore';
      this.lastError = null;
    } else if (this.firestoreActive) {
      this.isConnected = true;
      this.connectionStatus = 'connected';
      this.currentTransport = 'firestore';
      this.lastError = null;
    } else if (this.wsConnected) {
      this.isConnected = true;
      this.connectionStatus = 'connected';
      this.currentTransport = 'websocket';
      this.lastError = null;
    } else if (this.httpPollingOk) {
      this.isConnected = false;
      this.connectionStatus = 'polling';
      this.currentTransport = 'http';
      this.lastError = null;
    } else if (
      this.firebaseSession.ready &&
      !this.firebaseSession.isAuthorized &&
      this.isServerlessStaticHost()
    ) {
      this.isConnected = false;
      this.connectionStatus = 'auth_required';
      this.currentTransport = 'none';
    } else {
      this.isConnected = false;
      this.connectionStatus = 'disconnected';
      this.currentTransport = 'none';
    }
    this.emitConnectionChange();
  }

  private initFirebaseRealtime() {
    if (typeof window === 'undefined') return;
    try {
      subscribeToFirebaseAuth((session) => {
        this.firebaseSession = session;
        this.emit('firebase_auth_change', session);

        if (session.isAuthorized) {
          this.attachFirestoreShardListeners();
        } else {
          this.detachFirestoreShardListeners();
        }
        this.recomputeConnectionStatus();
      });
    } catch (err) {
      console.error('[Realtime] Errore inizializzazione Firebase:', err);
    }
  }

  private detachFirestoreShardListeners() {
    this.shardUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    this.shardUnsubscribers = [];
    if (this.pinResetProfileUnsub) {
      try {
        this.pinResetProfileUnsub();
      } catch {}
      this.pinResetProfileUnsub = null;
    }
    if (this.shiftSignupsUnsub) {
      try {
        this.shiftSignupsUnsub();
      } catch {}
      this.shiftSignupsUnsub = null;
    }
    this.firestoreActive = false;
    this.cloudShardsReadyEmitted = false;
    this.pendingInitialWrites.clear();
    ALL_SHARD_IDS.forEach((id) => {
      this.shardLoadedFromCloud[id] = false;
    });
  }

  private attachFirestoreShardListeners() {
    this.detachFirestoreShardListeners();

    ALL_SHARD_IDS.forEach((shardId) => {
      const wasLoadedBefore = { done: false };
      const unsub = listenShardDoc(
        shardId,
        (exists, docData, fromLocalPendingWrite) => {
          const isFirstSnapshot = !wasLoadedBefore.done;
          wasLoadedBefore.done = true;

          if (!this.firestoreActive) {
            this.firestoreActive = true;
            this.lastError = null;
            this.recomputeConnectionStatus();
          }
          this.shardLoadedFromCloud[shardId] = true;
          this.shardExists[shardId] = exists;

          if (exists && docData) {
            const incomingVer = typeof docData.version === 'number' ? docData.version : 1;
            const payload = docData.payload && typeof docData.payload === 'object' ? docData.payload : {};
            const hadPendingWrite = isFirstSnapshot && this.pendingInitialWrites.has(shardId);
            if (hadPendingWrite) {
              this.pendingInitialWrites.delete(shardId);
            }

            if (incomingVer > this.shardVersions[shardId]) {
              this.shardVersions[shardId] = incomingVer;
            }

            if (hadPendingWrite) {
              // Se l'utente aveva già creato/modificato un record prima del primo snapshot Firestore,
              // fonde in modo non distruttivo invece di scartare la modifica locale e pubblica su cloud
              if (shardId === 'volontari' && Array.isArray(payload.volontari)) {
                const deletedIds = normalizeDeletedIds([
                  ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
                  ...(Array.isArray(payload.volontariEliminatiIds) ? payload.volontariEliminatiIds : []),
                ]);
                const localVols = Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [];
                const merged = mergeVolontariListsSafe(payload.volontari, localVols, deletedIds);
                this.cloudState.volontariEliminatiIds = deletedIds;
                this.applyCloudShardPayload('volontari', { ...payload, volontari: merged, volontariEliminatiIds: deletedIds }, false);
              } else {
                const localBefore = { ...this.cloudState };
                this.applyCloudShardPayload(shardId, { ...payload, ...localBefore }, false);
              }
              this.flushShardToFirestore(shardId).catch((err) => {
                this.lastError = err?.message || `Errore sync ${shardId}`;
              });
            } else if (!fromLocalPendingWrite || isFirstSnapshot) {
              this.applyCloudShardPayload(shardId, payload, !isFirstSnapshot && !fromLocalPendingWrite);
            }
          } else if (!exists && isFirstSnapshot && this.pendingInitialWrites.has(shardId)) {
            // Shard ancora vuoto su Firestore e scrittura locale in attesa: ora si può inizializzare
            this.pendingInitialWrites.delete(shardId);
            this.flushShardToFirestore(shardId).catch((err) => {
              this.lastError = err?.message || `Errore sync ${shardId}`;
            });
          }

          if (!this.cloudShardsReadyEmitted && ALL_SHARD_IDS.every((id) => this.shardLoadedFromCloud[id])) {
            this.cloudShardsReadyEmitted = true;
            if (typeof window !== 'undefined' && !isProtectedAiStudioHost(window.location.origin) && !this.cloudState.publicAppUrl) {
              const pubOrigin = saveConfiguredPublicUrlLocal(window.location.origin);
              if (pubOrigin) {
                this.scheduleShardWrite('config', { publicAppUrl: pubOrigin });
              }
            }
            this.emit('cloud_shards_ready', { shardExists: { ...this.shardExists } });
          }
        },
        (err) => {
          console.warn(`[Realtime] Errore listener Firestore (${shardId}):`, err?.message);
          this.lastError = err?.message || 'Errore lettura Cloud Firestore';
          this.recomputeConnectionStatus();
        }
      );
      this.shardUnsubscribers.push(unsub);
    });

    this.pinResetProfileUnsub = listenCompletedPinResetProfilesFirestore(
      (completedProfiles) => {
        if (Array.isArray(completedProfiles) && completedProfiles.length > 0) {
          this.applyCompletedPinResetProfiles(completedProfiles).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Realtime] Errore listener pin_reset_profiles:', err?.message);
      }
    );

    this.shiftSignupsUnsub = listenPendingShiftSignupsFirestore(
      (pendingSignups) => {
        if (Array.isArray(pendingSignups) && pendingSignups.length > 0) {
          this.applyPendingShiftSignups(pendingSignups).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Realtime] Errore listener shift_signups:', err?.message);
      }
    );

    this.firestoreActive = true;
    this.recomputeConnectionStatus();
  }

  private computeVolontariSig(list: any[]): string {
    if (!Array.isArray(list)) return '';
    return list
      .map((v) => `${v?.id || ''}:${v?.pin || ''}:${v?.approvato ? 1 : 0}:${v?.profiloCentrale ? 1 : 0}:${(v?.macroCategorieAbilitate || []).join(',')}`)
      .sort()
      .join('|');
  }

  private pushVolontariToExpressIfNeeded(list: any[], deletedIds?: string[]) {
    const cleanDeleted = normalizeDeletedIds(deletedIds);
    if (this.isServerlessStaticHost() || !Array.isArray(list)) return;
    if (list.length === 0 && cleanDeleted.length === 0) return;
    const sig = `${this.computeVolontariSig(list)}#${cleanDeleted.join(',')}`;
    if (sig === this.lastExpressVolontariSig) return;
    this.lastExpressVolontariSig = sig;
    try {
      const baseUrl = this.getApiBaseUrl();
      fetch(`${baseUrl}/api/volontari`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volontari: list,
          volontariEliminatiIds: normalizeDeletedIds(deletedIds),
        }),
        cache: 'no-store',
      }).catch(() => {});
    } catch {}
  }

  private applyCloudShardPayload(shardId: SyncShardId, payload: Record<string, any>, isRemoteLiveDelta = false) {
    if (!payload || typeof payload !== 'object') return;

    const prevMission = this.cloudState.activeMission || null;
    const prevLettura = Boolean(this.cloudState.letturaConfermata);
    const prevRinging = this.cloudState.ringing || null;
    const prevPttEnabled = Boolean(this.cloudState.radioPtt?.enabled ?? this.cloudState.radioPttEnabled);

    if (shardId === 'volontari') {
      const deletedIds = normalizeDeletedIds([
        ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
        ...(Array.isArray(payload.volontariEliminatiIds) ? payload.volontariEliminatiIds : []),
      ]);
      const cloudVols = Array.isArray(payload.volontari) ? payload.volontari : [];
      const currentVols = Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [];
      const mergedVols = mergeVolontariListsSafe(currentVols, cloudVols, deletedIds);
      this.cloudState.volontariEliminatiIds = deletedIds;
      this.cloudState.volontari = mergedVols;
      this.lastVolontariRefreshAt = Date.now();
      this.pushVolontariToExpressIfNeeded(mergedVols, deletedIds);
      this.emit('VOLONTARI_UPDATED', {
        volontari: mergedVols,
        volontariEliminatiIds: deletedIds,
      });
      if (this.firebaseSession.isAuthorized) {
        this.reconcileCompletedPinResets()
          .then(() => syncPinResetProfilesFirestore(mergedVols, this.pinResetProfilesReconciling))
          .catch(() => {});
      }
    } else {
      Object.assign(this.cloudState, payload);
    }
    if (shardId === 'turni' && Array.isArray(payload.turni)) {
      const turniNorm = normalizzaTurniSedi(payload.turni);
      this.cloudState.turni = turniNorm;
      this.emit('TURNI_UPDATED', { turni: turniNorm });
      if (this.firebaseSession.isAuthorized && this.pendingShiftSignupsQueue.length > 0) {
        const queued = [...this.pendingShiftSignupsQueue];
        this.pendingShiftSignupsQueue = [];
        this.applyPendingShiftSignups(queued).catch(() => {});
      }
    }
    if (shardId === 'bacheca') {
      if (Array.isArray(payload.bacheca)) {
        const bachecaNorm = normalizzaComunicazioniBacheca(payload.bacheca);
        this.cloudState.bacheca = bachecaNorm;
        this.emit('BACHECA_UPDATED', { bacheca: bachecaNorm });
      }
      if (Array.isArray(payload.giornaleBordo)) {
        this.emit('GIORNALE_BORDO_UPDATED', { giornaleBordo: payload.giornaleBordo });
      }
    }
    if (shardId === 'magazzino') {
      if (Array.isArray(payload.magazzinoParti)) {
        this.emit('MAGAZZINO_PARTI_UPDATED', { magazzinoParti: payload.magazzinoParti });
      }
      if (Array.isArray(payload.magazzinoMezzi)) {
        this.emit('MAGAZZINO_MEZZI_UPDATED', { magazzinoMezzi: payload.magazzinoMezzi });
      }
    }
    if (shardId === 'indirizzi') {
      if (Array.isArray(payload.indirizziCollezionati)) {
        this.emit('INDIRIZZI_COLLEZIONATI_UPDATED', { indirizziCollezionati: payload.indirizziCollezionati });
      }
      if (Array.isArray(payload.contatti)) {
        this.emit('CONTATTI_UPDATED', { contatti: payload.contatti });
      }
    }
    if (shardId === 'timbrature') {
      if (Array.isArray(payload.timbrature)) {
        this.emit('TIMBRATURE_UPDATED', { timbrature: payload.timbrature });
      }
      if (Array.isArray(payload.luoghiTimbratura)) {
        const sediCurr = Array.isArray(this.cloudState.sedi)
          ? normalizzaListaSediAssociative(this.cloudState.sedi)
          : undefined;
        const luoghiNorm = normalizzaListaLuoghiTimbratura(payload.luoghiTimbratura, sediCurr);
        this.cloudState.luoghiTimbratura = luoghiNorm;
        this.emit('LUOGHI_TIMBRATURA_UPDATED', { luoghi: luoghiNorm });
      }
    }
    if (shardId === 'checklists') {
      if (Array.isArray(payload.checklistsTemplates)) {
        this.emit('CHECKLISTS_TEMPLATES_UPDATED', { templates: payload.checklistsTemplates });
      }
      if (Array.isArray(payload.checklistsCompilate)) {
        try {
          localStorage.setItem('CROCE_ORO_CHECKLISTS_COMPILATE', JSON.stringify(payload.checklistsCompilate));
        } catch {}
      }
    }
    if (shardId === 'config') {
      if (Array.isArray(payload.sedi)) {
        const sediNorm = normalizzaListaSediAssociative(payload.sedi);
        this.cloudState.sedi = sediNorm;
        this.emit('SEDI_UPDATED', { sedi: sediNorm });
        try {
          localStorage.setItem('CROCE_ORO_SEDI_COMPLETE', JSON.stringify(sediNorm));
        } catch {}
        if (Array.isArray(this.cloudState.luoghiTimbratura)) {
          const luoghiNorm = normalizzaListaLuoghiTimbratura(this.cloudState.luoghiTimbratura, sediNorm);
          this.cloudState.luoghiTimbratura = luoghiNorm;
          this.emit('LUOGHI_TIMBRATURA_UPDATED', { luoghi: luoghiNorm });
        }
      }
      if (Array.isArray(payload.radioGroups)) {
        this.emit('RADIO_GROUPS_UPDATED', { radioGroups: payload.radioGroups });
      }
      if (payload.datiCartaIntestata && typeof payload.datiCartaIntestata === 'object') {
        this.emit('CARTA_INTESTATA_UPDATED', { dati: payload.datiCartaIntestata });
      }
      if (typeof payload.publicAppUrl === 'string' && payload.publicAppUrl.trim() && !isProtectedAiStudioHost(payload.publicAppUrl)) {
        const saved = saveConfiguredPublicUrlLocal(payload.publicAppUrl);
        this.cloudState.publicAppUrl = saved;
        if (!this.isServerlessStaticHost() && saved) {
          fetch(`${this.getApiBaseUrl()}/api/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'UPDATE_PUBLIC_APP_URL', data: { publicAppUrl: saved } }),
            cache: 'no-store',
          }).catch(() => {});
        }
        this.emit('PUBLIC_APP_URL_UPDATED', { publicAppUrl: saved });
      }
    }
    if (shardId === 'servizi') {
      if (Array.isArray(payload.serviziArchivio)) {
        this.emit('SERVIZI_ARCHIVIO_UPDATED', {
          serviziArchivio: payload.serviziArchivio,
          codiciEliminati: payload.codiciEliminati || [],
        });
      }
    }
    if (shardId === 'mission') {
      if (isRemoteLiveDelta) {
        if (payload.activeMission && (!prevMission || payload.activeMission.codice !== prevMission.codice)) {
          this.emit('MISSION_DISPATCHED', {
            mission: payload.activeMission,
            ringing: payload.ringing,
          });
        } else if (!payload.activeMission && prevMission) {
          this.emit('MISSION_CLEARED', { forceClear: true });
        }
        if (payload.letturaConfermata === true && !prevLettura) {
          this.emit('MISSION_READ_CONFIRMED', { codice: payload.activeMission?.codice });
        }
        if (
          payload.ringing?.active &&
          (!prevRinging?.active || payload.ringing.timestamp !== prevRinging.timestamp)
        ) {
          this.emit('RING_TRIGGERED', { ringing: payload.ringing });
        } else if (payload.ringing && !payload.ringing.active && prevRinging?.active) {
          this.emit('RING_STOPPED', {});
        }
      }
      if (payload.activeShift) {
        this.emit('SHIFT_UPDATED', { shift: payload.activeShift });
      }
      if (payload.gpsPosition) {
        this.emit('GPS_UPDATED', { position: payload.gpsPosition });
      }
      if ('radioPttEnabled' in payload) {
        const nextEnabled = Boolean(payload.radioPttEnabled);
        this.cloudState.radioPtt = {
          ...(this.cloudState.radioPtt || { enabled: false, activeSpeaker: null }),
          enabled: nextEnabled,
          toggledBy: payload.radioPttToggledBy,
          toggledAt: payload.radioPttToggledAt,
          activeSpeaker: nextEnabled ? (this.cloudState.radioPtt?.activeSpeaker || null) : null,
        };
        if (isRemoteLiveDelta && nextEnabled !== prevPttEnabled) {
          this.emit('RADIO_PTT_STATE', { radioPtt: this.cloudState.radioPtt });
        }
      }
      if (payload.radioEmergency && isRemoteLiveDelta) {
        this.emit('RADIO_EMERGENCY_STATE', { radioEmergency: payload.radioEmergency });
      }
    }

    this.emit('POLL_SYNC', { ...this.cloudState });
  }

  private scheduleShardWrite(shardId: SyncShardId, patch: Record<string, any>) {
    Object.assign(this.cloudState, patch);
    if (!this.firebaseSession.isAuthorized) return;

    // Se il primo snapshot di questo shard non è ancora arrivato da Firestore, accoda con sicurezza
    if (!this.shardLoadedFromCloud[shardId]) {
      this.pendingInitialWrites.add(shardId);
      return;
    }

    if (this.shardDirtyTimers[shardId]) {
      clearTimeout(this.shardDirtyTimers[shardId]);
    }
    if (this.shardRetryTimers[shardId]) {
      clearTimeout(this.shardRetryTimers[shardId]);
      delete this.shardRetryTimers[shardId];
    }

    const delayMs = shardId === 'volontari' || shardId === 'mission' || shardId === 'servizi' ? 30 : 120;
    this.shardDirtyTimers[shardId] = setTimeout(() => {
      delete this.shardDirtyTimers[shardId];
      this.flushShardToFirestoreWithRetry(shardId);
    }, delayMs);
  }

  private flushShardToFirestoreWithRetry(shardId: SyncShardId, attempt = 0) {
    this.flushShardToFirestore(shardId)
      .then(() => {
        this.shardRetryCounts[shardId] = 0;
        if (this.lastError && this.lastError.includes(shardId)) {
          this.lastError = null;
          this.recomputeConnectionStatus();
        }
      })
      .catch((err) => {
        console.warn(`[Realtime] Scrittura Firestore shard ${shardId} non riuscita (tentativo ${attempt + 1}):`, err?.message);
        this.lastError = err?.message || `Errore scrittura cloud (${shardId})`;
        this.recomputeConnectionStatus();
        if (attempt < 2 && this.firebaseSession.isAuthorized) {
          const backoffMs = attempt === 0 ? 1500 : 4500;
          if (this.shardRetryTimers[shardId]) {
            clearTimeout(this.shardRetryTimers[shardId]);
          }
          this.shardRetryTimers[shardId] = setTimeout(() => {
            delete this.shardRetryTimers[shardId];
            this.flushShardToFirestoreWithRetry(shardId, attempt + 1);
          }, backoffMs);
        }
      });
  }

  private getShardPayloadFromCache(shardId: SyncShardId): Record<string, any> {
    switch (shardId) {
      case 'mission': {
        const rawNotifiche = Array.isArray(this.cloudState.notifiche) ? this.cloudState.notifiche.slice(-40) : [];
        let audioKept = 0;
        let audioBytes = 0;
        const sanitizedNotifiche = new Array(rawNotifiche.length);
        for (let i = rawNotifiche.length - 1; i >= 0; i--) {
          const item = rawNotifiche[i];
          if (item && typeof item === 'object' && item.audioDataUrl) {
            const len = String(item.audioDataUrl).length;
            if (audioKept < 4 && audioBytes + len < 350000) {
              audioKept++;
              audioBytes += len;
              sanitizedNotifiche[i] = item;
            } else {
              const { audioDataUrl: _dropped, ...rest } = item;
              sanitizedNotifiche[i] = rest;
            }
          } else {
            sanitizedNotifiche[i] = item;
          }
        }
        return {
          activeMission: this.cloudState.activeMission ?? null,
          letturaConfermata: Boolean(this.cloudState.letturaConfermata),
          operativeTimes: this.cloudState.operativeTimes || {},
          datiDestinazione: this.cloudState.datiDestinazione ?? null,
          kmInizio: this.cloudState.kmInizio || '',
          kmFine: this.cloudState.kmFine || '',
          ringing: this.cloudState.ringing || { active: false, source: '', soundType: 'telefono', timestamp: 0 },
          gpsPosition: this.cloudState.gpsPosition || null,
          activeShift: this.cloudState.activeShift || { attivo: false },
          notifiche: sanitizedNotifiche.filter(Boolean),
          radioPttEnabled: Boolean(this.cloudState.radioPtt?.enabled ?? this.cloudState.radioPttEnabled),
          radioPttToggledBy: this.cloudState.radioPtt?.toggledBy || this.cloudState.radioPttToggledBy || null,
          radioPttToggledAt: this.cloudState.radioPtt?.toggledAt || this.cloudState.radioPttToggledAt || 0,
        };
      }
      case 'volontari':
        return {
          volontari: Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [],
          volontariEliminatiIds: normalizeDeletedIds(this.cloudState.volontariEliminatiIds),
        };
      case 'servizi':
        return {
          serviziArchivio: Array.isArray(this.cloudState.serviziArchivio) ? this.cloudState.serviziArchivio : [],
          codiciEliminati: Array.isArray(this.cloudState.codiciEliminati) ? this.cloudState.codiciEliminati : [],
        };
      case 'turni':
        return {
          turni: Array.isArray(this.cloudState.turni) ? normalizzaTurniSedi(this.cloudState.turni) : [],
        };
      case 'bacheca':
        return {
          bacheca: Array.isArray(this.cloudState.bacheca) ? normalizzaComunicazioniBacheca(this.cloudState.bacheca) : [],
          giornaleBordo: Array.isArray(this.cloudState.giornaleBordo) ? this.cloudState.giornaleBordo : [],
        };
      case 'magazzino':
        return {
          magazzinoParti: Array.isArray(this.cloudState.magazzinoParti) ? this.cloudState.magazzinoParti : [],
          magazzinoMezzi: Array.isArray(this.cloudState.magazzinoMezzi) ? this.cloudState.magazzinoMezzi : [],
        };
      case 'timbrature': {
        const sediCurr = Array.isArray(this.cloudState.sedi)
          ? normalizzaListaSediAssociative(this.cloudState.sedi)
          : undefined;
        return {
          timbrature: Array.isArray(this.cloudState.timbrature) ? this.cloudState.timbrature : [],
          luoghiTimbratura: Array.isArray(this.cloudState.luoghiTimbratura)
            ? normalizzaListaLuoghiTimbratura(this.cloudState.luoghiTimbratura, sediCurr)
            : [],
        };
      }
      case 'indirizzi':
        return {
          indirizziCollezionati: Array.isArray(this.cloudState.indirizziCollezionati) ? this.cloudState.indirizziCollezionati : [],
          contatti: Array.isArray(this.cloudState.contatti) ? this.cloudState.contatti : [],
        };
      case 'checklists':
        return {
          checklistsTemplates: Array.isArray(this.cloudState.checklistsTemplates) ? this.cloudState.checklistsTemplates : [],
          checklistsCompilate: Array.isArray(this.cloudState.checklistsCompilate) ? this.cloudState.checklistsCompilate : [],
        };
      case 'config':
        return {
          sedi: Array.isArray(this.cloudState.sedi) ? normalizzaListaSediAssociative(this.cloudState.sedi) : [],
          datiCartaIntestata: this.cloudState.datiCartaIntestata || null,
          radioGroups: Array.isArray(this.cloudState.radioGroups) ? this.cloudState.radioGroups : [],
          publicAppUrl: this.cloudState.publicAppUrl || getConfiguredPublicUrl() || '',
        };
    }
  }

  private async flushShardToFirestore(shardId: SyncShardId) {
    if (!this.firebaseSession.isAuthorized) return;
    const payload = this.getShardPayloadFromCache(shardId);
    const newVer = await writeShardDoc(
      shardId,
      payload,
      this.shardVersions[shardId] || 0,
      this.shardExists[shardId]
    );
    this.shardExists[shardId] = true;
    this.shardVersions[shardId] = newVer;
    if (shardId === 'volontari' && Array.isArray(payload?.volontari)) {
      syncPinResetProfilesFirestore(payload.volontari, this.pinResetProfilesReconciling).catch(() => {});
    }
  }

  /**
   * Riconcilia automaticamente eventuali nuovi account creati localmente (prima del login Google, offline o su altro host)
   * con lo shard `volontari` su Cloud Firestore ed Express, evitando che restino confinati sul solo dispositivo locale.
   */
  public async reconcileLocalVolontariWithCloud(localVolontari: any[], localDeletedIds: string[] = []): Promise<boolean> {
    if (!Array.isArray(localVolontari) || localVolontari.length === 0) return false;
    const deletedIds = normalizeDeletedIds([
      ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
      ...localDeletedIds,
    ]);
    const cloudList = Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [];
    const cloudIds = new Set(cloudList.map((v: any) => v?.id).filter(Boolean));
    const missingInCloud = localVolontari.filter(
      (v: any) => v && v.id && !deletedIds.includes(v.id) && !cloudIds.has(v.id)
    );

    if (missingInCloud.length === 0) return false;

    const merged = mergeVolontariListsSafe(cloudList, localVolontari, deletedIds);
    this.cloudState.volontari = merged;
    this.cloudState.volontariEliminatiIds = deletedIds;

    if (this.firebaseSession.isAuthorized) {
      await this.flushShardToFirestore('volontari');
    }
    this.pushVolontariToExpressIfNeeded(merged, deletedIds);
    this.emit('VOLONTARI_UPDATED', { volontari: merged, volontariEliminatiIds: deletedIds });
    return true;
  }

  // Metodi pubblici gestione Firebase Cloud Sync
  public getFirebaseSession(): FirebaseSessionState {
    return this.firebaseSession;
  }

  public async connectGoogleCloudSync(): Promise<FirebaseSessionState> {
    await signInWithGoogleCloudSync();
    // onAuthStateChanged aggiornerà session & listener automaticamente
    return this.firebaseSession;
  }

  public async disconnectGoogleCloudSync(): Promise<void> {
    this.detachFirestoreShardListeners();
    await signOutCloudSync();
    this.recomputeConnectionStatus();
  }

  public async requestOperatorCloudAccess(): Promise<void> {
    await richiediAbilitazioneOperatore();
  }

  public async fetchOperatorRequests(): Promise<OperatorRequestRecord[]> {
    return fetchOperatorRequestsForAdmin();
  }

  public async fetchApprovedOperators(): Promise<ApprovedOperatorRecord[]> {
    return fetchApprovedOperatorsForAdmin();
  }

  public async approvaOperatore(uid: string, email: string, displayName: string): Promise<void> {
    await approvaOperatoreCloud(uid, email, displayName);
  }

  public async revocaOperatore(uid: string): Promise<void> {
    await revocaOperatoreCloud(uid);
  }

  public async testCloudHealth(): Promise<{ firestoreReachable: boolean; error?: string }> {
    const res = await testFirestoreConnection();
    return { firestoreReachable: res.reachable, error: res.error };
  }

  public async forceRefreshFromCloud(): Promise<{ loadedCount: number; shardsRead: SyncShardId[] }> {
    if (!this.firebaseSession.isAuthorized) {
      throw new Error('Devi accedere ed essere abilitato su Cloud Firestore prima di scaricare i dati.');
    }
    const shardsRead: SyncShardId[] = [];
    const results = await Promise.allSettled(
      ALL_SHARD_IDS.map(async (shardId) => {
        const res = await readShardDocFromServer(shardId);
        this.shardLoadedFromCloud[shardId] = true;
        this.shardExists[shardId] = res.exists;
        if (res.exists && res.data) {
          const incomingVer = typeof res.data.version === 'number' ? res.data.version : 1;
          if (incomingVer > this.shardVersions[shardId]) {
            this.shardVersions[shardId] = incomingVer;
          }
          if (res.data.payload && typeof res.data.payload === 'object') {
            this.applyCloudShardPayload(shardId, res.data.payload, false);
            shardsRead.push(shardId);
          }
        }
      })
    );
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) {
      this.lastError = failed.reason?.message || 'Errore lettura dal cloud';
    } else {
      this.lastError = null;
    }
    this.recomputeConnectionStatus();
    return { loadedCount: shardsRead.length, shardsRead };
  }

  // Popola automaticamente SOLO gli shard completamente assenti su Firestore (!shardExists)
  // senza mai sovrascrivere dati cloud già presenti creati da altri dispositivi.
  public async seedMissingShardsFromLocal(snapshot: Partial<Record<string, any>>): Promise<string[]> {
    if (!this.firebaseSession.isAuthorized) return [];
    const seeded: string[] = [];

    const candidates: Array<{ id: SyncShardId; hasData: boolean; patch: Record<string, any> }> = [
      {
        id: 'volontari',
        hasData: Array.isArray(snapshot.volontari) && snapshot.volontari.length > 0,
        patch: {
          volontari: snapshot.volontari || [],
          volontariEliminatiIds: normalizeDeletedIds(
            snapshot.volontariEliminatiIds ?? this.cloudState.volontariEliminatiIds
          ),
        },
      },
      {
        id: 'servizi',
        hasData: Array.isArray(snapshot.serviziArchivio) && snapshot.serviziArchivio.length > 0,
        patch: {
          serviziArchivio: snapshot.serviziArchivio || [],
          codiciEliminati: snapshot.codiciEliminati || [],
        },
      },
      {
        id: 'turni',
        hasData: Array.isArray(snapshot.turni) && snapshot.turni.length > 0,
        patch: { turni: snapshot.turni || [] },
      },
      {
        id: 'bacheca',
        hasData:
          (Array.isArray(snapshot.bacheca) && snapshot.bacheca.length > 0) ||
          (Array.isArray(snapshot.giornaleBordo) && snapshot.giornaleBordo.length > 0),
        patch: {
          bacheca: snapshot.bacheca || [],
          giornaleBordo: snapshot.giornaleBordo || [],
        },
      },
      {
        id: 'magazzino',
        hasData:
          (Array.isArray(snapshot.magazzinoParti) && snapshot.magazzinoParti.length > 0) ||
          (Array.isArray(snapshot.magazzinoMezzi) && snapshot.magazzinoMezzi.length > 0),
        patch: {
          magazzinoParti: snapshot.magazzinoParti || [],
          magazzinoMezzi: snapshot.magazzinoMezzi || [],
        },
      },
      {
        id: 'timbrature',
        hasData:
          (Array.isArray(snapshot.timbrature) && snapshot.timbrature.length > 0) ||
          (Array.isArray(snapshot.luoghiTimbratura) && snapshot.luoghiTimbratura.length > 0),
        patch: {
          timbrature: snapshot.timbrature || [],
          luoghiTimbratura: snapshot.luoghiTimbratura || [],
        },
      },
      {
        id: 'indirizzi',
        hasData:
          (Array.isArray(snapshot.indirizziCollezionati) && snapshot.indirizziCollezionati.length > 0) ||
          (Array.isArray(snapshot.contatti) && snapshot.contatti.length > 0),
        patch: {
          indirizziCollezionati: snapshot.indirizziCollezionati || [],
          contatti: snapshot.contatti || [],
        },
      },
      {
        id: 'checklists',
        hasData:
          (Array.isArray(snapshot.checklistsTemplates) && snapshot.checklistsTemplates.length > 0) ||
          (Array.isArray(snapshot.checklistsCompilate) && snapshot.checklistsCompilate.length > 0),
        patch: {
          checklistsTemplates: snapshot.checklistsTemplates || [],
          checklistsCompilate: snapshot.checklistsCompilate || [],
        },
      },
      {
        id: 'config',
        hasData: (Array.isArray(snapshot.sedi) && snapshot.sedi.length > 0) || Boolean(getConfiguredPublicUrl()),
        patch: {
          sedi: snapshot.sedi || [],
          publicAppUrl: this.cloudState.publicAppUrl || getConfiguredPublicUrl() || '',
        },
      },
    ];

    for (const c of candidates) {
      if (this.shardLoadedFromCloud[c.id] && !this.shardExists[c.id] && c.hasData) {
        try {
          Object.assign(this.cloudState, c.patch);
          await this.flushShardToFirestore(c.id);
          seeded.push(c.id);
        } catch (err: any) {
          console.warn(`[Realtime] Auto-seed shard ${c.id} non riuscito:`, err?.message);
        }
      }
    }

    return seeded;
  }

  // Consente di allineare manualmente o all'avvio i dati locali verso Cloud Firestore se gli shard cloud sono vuoti
  public async pushAllLocalStateToCloud(snapshot: Partial<Record<string, any>>): Promise<{ updatedShards: string[] }> {
    if (!this.firebaseSession.isAuthorized) {
      throw new Error('Devi accedere ed essere abilitato su Cloud Firestore prima di inviare i dati.');
    }
    const updatedShards: string[] = [];

    const mapShardData: Array<{ id: SyncShardId; patch: Record<string, any> }> = [
      {
        id: 'mission',
        patch: {
          activeMission: snapshot.activeMission ?? this.cloudState.activeMission ?? null,
          letturaConfermata: snapshot.letturaConfermata ?? this.cloudState.letturaConfermata ?? false,
          operativeTimes: snapshot.operativeTimes ?? this.cloudState.operativeTimes ?? {},
          datiDestinazione: snapshot.datiDestinazione ?? this.cloudState.datiDestinazione ?? null,
          kmInizio: snapshot.kmInizio ?? this.cloudState.kmInizio ?? '',
          kmFine: snapshot.kmFine ?? this.cloudState.kmFine ?? '',
          activeShift: snapshot.activeShift ?? this.cloudState.activeShift ?? { attivo: false },
          gpsPosition: snapshot.gpsPosition ?? this.cloudState.gpsPosition ?? null,
        },
      },
      {
        id: 'volontari',
        patch: (() => {
          const deletedIds = normalizeDeletedIds([
            ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
            ...(Array.isArray(snapshot.volontariEliminatiIds) ? snapshot.volontariEliminatiIds : []),
          ]);
          const deletedSet = new Set(deletedIds);
          const rawList = Array.isArray(snapshot.volontari)
            ? snapshot.volontari
            : (Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : []);
          return {
            volontari: rawList.filter((v: any) => !v?.id || !deletedSet.has(String(v.id).trim())),
            volontariEliminatiIds: deletedIds,
          };
        })(),
      },
      {
        id: 'servizi',
        patch: {
          serviziArchivio: snapshot.serviziArchivio || this.cloudState.serviziArchivio || [],
          codiciEliminati: snapshot.codiciEliminati || this.cloudState.codiciEliminati || [],
        },
      },
      { id: 'turni', patch: { turni: normalizzaTurniSedi(snapshot.turni || this.cloudState.turni || []) } },
      {
        id: 'bacheca',
        patch: {
          bacheca: normalizzaComunicazioniBacheca(snapshot.bacheca || this.cloudState.bacheca || []),
          giornaleBordo: snapshot.giornaleBordo || this.cloudState.giornaleBordo || [],
        },
      },
      {
        id: 'magazzino',
        patch: {
          magazzinoParti: snapshot.magazzinoParti || this.cloudState.magazzinoParti || [],
          magazzinoMezzi: snapshot.magazzinoMezzi || this.cloudState.magazzinoMezzi || [],
        },
      },
      {
        id: 'timbrature',
        patch: {
          timbrature: snapshot.timbrature || this.cloudState.timbrature || [],
          luoghiTimbratura: normalizzaListaLuoghiTimbratura(
            snapshot.luoghiTimbratura || this.cloudState.luoghiTimbratura || [],
            normalizzaListaSediAssociative(snapshot.sedi || this.cloudState.sedi || [])
          ),
        },
      },
      {
        id: 'indirizzi',
        patch: {
          indirizziCollezionati: snapshot.indirizziCollezionati || this.cloudState.indirizziCollezionati || [],
          contatti: snapshot.contatti || this.cloudState.contatti || [],
        },
      },
      {
        id: 'checklists',
        patch: {
          checklistsTemplates: snapshot.checklistsTemplates || this.cloudState.checklistsTemplates || [],
          checklistsCompilate: snapshot.checklistsCompilate || this.cloudState.checklistsCompilate || [],
        },
      },
      {
        id: 'config',
        patch: {
          sedi: normalizzaListaSediAssociative(snapshot.sedi || this.cloudState.sedi || []),
          publicAppUrl: this.cloudState.publicAppUrl || getConfiguredPublicUrl() || '',
        },
      },
    ];

    for (const item of mapShardData) {
      Object.assign(this.cloudState, item.patch);
      await this.flushShardToFirestore(item.id);
      updatedShards.push(item.id);
    }

    return { updatedShards };
  }

  // Risolve l'URL base dell'API sia su browser web che all'interno dell'app APK scaricata dal Play Store
  public getApiBaseUrl(): string {
    if (typeof window === 'undefined') return '';

    // 1. Controllo override manuale impostato dall'utente
    const customUrl = localStorage.getItem('CROCE_ORO_SERVER_URL');
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/$/, '');
    }

    // 2. Controllo se ci troviamo già su un dominio Cloud Run valido
    const origin = window.location.origin;
    if (origin && origin.includes('.run.app')) {
      return origin;
    }

    // 3. Se l'app è installata su Android (file://, capacitor://, o localhost dell'emulatore)
    if (
      window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      (window.location.hostname === 'localhost' && window.location.port !== '3000') ||
      window.location.hostname === '127.0.0.1'
    ) {
      return this.DEFAULT_CLOUD_URL;
    }

    // 4. Hosting web standard (Vercel, dominio associativo o localhost:3000)
    return origin;
  }

  public getWebSocketUrl(): string {
    const baseUrl = this.getApiBaseUrl();
    if (!baseUrl) return '';
    if (baseUrl.startsWith('https:')) {
      return baseUrl.replace(/^https:/, 'wss:');
    }
    if (baseUrl.startsWith('http:')) {
      return baseUrl.replace(/^http:/, 'ws:');
    }
    return `wss://${window.location.host}`;
  }

  public getConnectionInfo(): ConnectionInfo {
    return {
      connected: this.isConnected,
      status: this.connectionStatus,
      transport: this.currentTransport,
      serverUrl: this.getApiBaseUrl(),
      firestoreActive: this.firestoreActive,
      websocketActive: this.wsConnected,
      httpActive: this.httpPollingOk,
      firebaseStatus: this.firebaseSession.status,
      firebaseEmail: this.firebaseSession.email,
      firebaseUid: this.firebaseSession.uid,
      firebaseIsAdmin: this.firebaseSession.isAdmin,
      lastError: this.lastError || getLastFirebaseAuthError(),
    };
  }

  public connect() {
    if (typeof window === 'undefined') return;

    // Su Vercel / hosting statici senza server WebSocket configurato manualmente, evita loop WS inutili
    if (this.isServerlessStaticHost()) {
      this.wsConnected = false;
      this.recomputeConnectionStatus();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!this.firestoreActive) {
      this.connectionStatus = 'connecting';
      this.emitConnectionChange();
    }

    try {
      const url = this.getWebSocketUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.wsConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.recomputeConnectionStatus();
        this.reportOpusCapability();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type) {
            if (payload.type === 'INIT_SYNC' && payload.state) {
              const mergedState = this.mergeIncomingExpressState(payload.state);
              this.emit('INIT_SYNC', { ...payload, state: mergedState });
              return;
            }
            if (payload.type === 'VOLONTARI_UPDATED' && Array.isArray(payload.volontari)) {
              const deletedIds = normalizeDeletedIds([
                ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
                ...(Array.isArray(payload.volontariEliminatiIds) ? payload.volontariEliminatiIds : []),
              ]);
              const currentVols = Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [];
              const mergedVols = mergeVolontariListsSafe(currentVols, payload.volontari, deletedIds);
              this.cloudState.volontariEliminatiIds = deletedIds;
              this.cloudState.volontari = mergedVols;
              if (this.firebaseSession.isAuthorized && this.shardLoadedFromCloud['volontari']) {
                const cloudIdSet = new Set(currentVols.map((v: any) => v?.id).filter(Boolean));
                if (mergedVols.some((v: any) => v?.id && !cloudIdSet.has(v.id))) {
                  this.scheduleShardWrite('volontari', { volontari: mergedVols, volontariEliminatiIds: deletedIds });
                }
              }
              this.emit('VOLONTARI_UPDATED', { ...payload, volontari: mergedVols, volontariEliminatiIds: deletedIds });
              return;
            }
            this.emit(payload.type, payload);
          }
        } catch (err) {
          console.error('[Realtime] Errore parsing messaggio:', err);
        }
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onerror = () => {
        this.handleDisconnect();
        if (this.ws) {
          try {
            this.ws.close();
          } catch {}
        }
      };
    } catch (err) {
      console.error('[Realtime] Errore connessione WS:', err);
      this.handleDisconnect();
    }
  }

  private mergeIncomingExpressState(incomingState: Record<string, any>): Record<string, any> {
    if (!incomingState || typeof incomingState !== 'object') return this.cloudState;
    const prevVols = Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [];
    const incomingVols = Array.isArray(incomingState.volontari) ? incomingState.volontari : [];
    const deletedIds = normalizeDeletedIds([
      ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
      ...(Array.isArray(incomingState.volontariEliminatiIds) ? incomingState.volontariEliminatiIds : []),
    ]);

    const mergedVols = mergeVolontariListsSafe(prevVols, incomingVols, deletedIds);

    // Se Firestore è già attivo, non lasciare che Express (più vecchio) sovrascriva le liste cloud più aggiornate
    if (this.firestoreActive) {
      for (const [k, v] of Object.entries(incomingState)) {
        if (k === 'volontari' || k === 'volontariEliminatiIds') continue;
        if (this.cloudState[k] === undefined || (Array.isArray(this.cloudState[k]) && this.cloudState[k].length === 0)) {
          this.cloudState[k] = v;
        }
      }
    } else {
      Object.assign(this.cloudState, incomingState);
    }

    this.cloudState.volontariEliminatiIds = deletedIds;
    this.cloudState.volontari = mergedVols;

    // Ponte bidirezionale: se Express ha nuovi account non ancora presenti su Firestore, sincronizza verso Firestore
    if (this.firebaseSession.isAuthorized && this.shardLoadedFromCloud['volontari']) {
      const prevIds = new Set(prevVols.map((v: any) => v?.id).filter(Boolean));
      const hasNewFromExpress = incomingVols.some((v: any) => v?.id && !deletedIds.includes(v.id) && !prevIds.has(v.id));
      if (hasNewFromExpress) {
        this.scheduleShardWrite('volontari', { volontari: mergedVols, volontariEliminatiIds: deletedIds });
      }
    }

    // E viceversa: se Firestore aveva account assenti su Express, o se Express contiene ancora account eliminati
    // o non ha ancora tutte le tombstone di eliminazione, riallinea immediatamente Express
    const incIds = new Set(incomingVols.map((v: any) => v?.id).filter(Boolean));
    const incDeletedSet = new Set(normalizeDeletedIds(incomingState.volontariEliminatiIds));
    const expressHasDeletedZombie = incomingVols.some(
      (v: any) => v?.id && deletedIds.includes(String(v.id).trim())
    );
    const expressMissingTombstones = deletedIds.some((id) => !incDeletedSet.has(id));
    if (
      expressHasDeletedZombie ||
      expressMissingTombstones ||
      prevVols.some((v: any) => v?.id && !deletedIds.includes(v.id) && !incIds.has(v.id))
    ) {
      this.pushVolontariToExpressIfNeeded(mergedVols, deletedIds);
    }

    return {
      ...incomingState,
      ...this.cloudState,
      volontari: mergedVols,
      volontariEliminatiIds: deletedIds,
    };
  }

  private handleDisconnect() {
    this.wsConnected = false;
    this.recomputeConnectionStatus();
    if (!this.isServerlessStaticHost()) {
      this.scheduleReconnect();
    }
  }

  private emitConnectionChange() {
    this.emit('connection_change', this.getConnectionInfo());
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 4000);
    }
  }

  // Polling automatico di sicurezza su backend Express (NON dichiara più polling attivo in caso di 404/errore!)
  private startFallbackPolling() {
    if (typeof window === 'undefined') return;
    let pollCount = 0;

    const runPoll = async () => {
      pollCount++;
      if (this.firebaseSession.isAuthorized && pollCount % 8 === 0) {
        this.reconcileCompletedPinResets().catch(() => {});
      }
      // Se Firestore Live è attivo ed è su hosting serverless Vercel, non serve polling aggressivo HTTP
      if (this.isServerlessStaticHost() && this.firestoreActive) {
        return;
      }

      if (!this.wsConnected || pollCount % 4 === 0) {
        try {
          const baseUrl = this.getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/sync`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          });
          if (!res.ok) {
            this.httpPollingOk = false;
            this.lastError = `Server HTTP ${res.status}`;
            this.recomputeConnectionStatus();
            return;
          }
          const data = await res.json();
          if (data && data.state) {
            this.httpPollingOk = true;
            this.lastError = null;
            const mergedState = this.mergeIncomingExpressState(data.state);
            this.recomputeConnectionStatus();
            this.emit('POLL_SYNC', mergedState);
          } else {
            // Backend serverless privo di stato in-memory (es. Vercel senza Firebase Auth attiva)
            this.httpPollingOk = false;
            this.recomputeConnectionStatus();
          }
        } catch (err: any) {
          this.httpPollingOk = false;
          this.lastError = err?.message || 'Errore di rete';
          this.recomputeConnectionStatus();
        }
      }
    };

    runPoll();
    this.pollTimer = setInterval(runPoll, 2500);
  }

  public on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      const set = this.handlers.get(event);
      if (set) {
        set.delete(handler);
      }
    };
  }

  private emit(event: string, data: any) {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[Realtime] Errore nel gestore ${event}:`, err);
        }
      });
    }
  }

  private applyLocalEventToShards(type: string, data: any) {
    const nowTime = formatTimeItaly(undefined, false);

    switch (type) {
      case 'DISPATCH_MISSION':
        this.scheduleShardWrite('mission', {
          activeMission: data,
          letturaConfermata: false,
          operativeTimes: {},
          datiDestinazione: null,
          kmInizio: '',
          kmFine: '',
          ringing: {
            active: true,
            source: `Centrale Operativa (${data?.codice || 'Nuova Scheda'})`,
            soundType: data?.urgenza === 'ROSSO' ? 'sirena' : 'telefono',
            timestamp: Date.now(),
          },
        });
        break;
      case 'CONFIRM_MISSION_READ':
        this.scheduleShardWrite('mission', {
          letturaConfermata: true,
          ringing: { active: false, source: '', soundType: 'telefono', timestamp: Date.now() },
        });
        break;
      case 'TRIGGER_RING':
        this.scheduleShardWrite('mission', {
          ringing: {
            active: true,
            source: data?.source || 'Centrale',
            soundType: data?.soundType || 'telefono',
            timestamp: Date.now(),
          },
        });
        break;
      case 'STOP_RING':
        this.scheduleShardWrite('mission', {
          ringing: { active: false, source: '', soundType: 'telefono', timestamp: Date.now() },
        });
        break;
      case 'UPDATE_OPERATIVE_TIMES':
        this.scheduleShardWrite('mission', {
          operativeTimes: data?.times || {},
        });
        break;
      case 'UPDATE_KM':
        this.scheduleShardWrite('mission', {
          kmInizio: data?.kmInizio ?? this.cloudState.kmInizio ?? '',
          kmFine: data?.kmFine ?? this.cloudState.kmFine ?? '',
        });
        break;
      case 'SEND_RADIO_MESSAGE': {
        const list = Array.isArray(this.cloudState.notifiche) ? [...this.cloudState.notifiche] : [];
        const hasAudio = Boolean(data?.audioDataUrl && typeof data.audioDataUrl === 'string');
        const label = data?.testo || (hasAudio ? `🎙️ Messaggio Audio (${Number(data.audioDurationSec) || 1}s)` : '');
        const nomeSuffix = data?.mittenteNome ? ` (${data.mittenteNome})` : '';
        const groupSuffix = data?.groupName ? ` • GRUPPO: ${data.groupName}` : '';
        list.push({
          id: data?.clientMsgId ? String(data.clientMsgId) : `rad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orario: nowTime,
          testo: `RADIO [${data?.mittente || 'RADIO'}${nomeSuffix}${groupSuffix}]: ${label}`,
          tipo: data?.mittente === 'CENTRALE' ? 'centrale' : 'mezzo',
          ...(data?.groupId ? { groupId: data.groupId, groupName: data.groupName } : {}),
          ...(hasAudio
            ? {
                audioDataUrl: data.audioDataUrl,
                audioDurationSec: Number(data.audioDurationSec) || 1,
                audioMimeType: data.audioMimeType || 'audio/webm',
                mittenteNome: data.mittenteNome,
              }
            : {}),
        });
        this.scheduleShardWrite('mission', { notifiche: list.slice(-40) });
        break;
      }
      case 'TOGGLE_RADIO_PTT_LIVE': {
        if (data?.role === 'admin') {
          const nextEnabled = Boolean(data?.enabled);
          const toggledBy = String(data?.operatorName || 'Operatore Centrale');
          const toggledAt = Date.now();
          this.cloudState.radioPtt = {
            enabled: nextEnabled,
            toggledBy,
            toggledAt,
            activeSpeaker: nextEnabled ? (this.cloudState.radioPtt?.activeSpeaker || null) : null,
          };
          this.scheduleShardWrite('mission', {
            radioPttEnabled: nextEnabled,
            radioPttToggledBy: toggledBy,
            radioPttToggledAt: toggledAt,
          });
        }
        break;
      }
      case 'CREATE_RADIO_GROUP': {
        if (data?.role === 'admin' && data?.name) {
          const cleanName = String(data.name).trim();
          const reqId = String(data.id || `grp-${Date.now()}`);
          const current = Array.isArray(this.cloudState.radioGroups) ? [...this.cloudState.radioGroups] : [];
          const exists = current.some(
            (g: any) =>
              g.id === reqId ||
              String(g.name || '').trim().toLowerCase() === cleanName.toLowerCase()
          );
          if (!exists && cleanName) {
            current.push({
              id: reqId,
              name: cleanName,
              enabled: Boolean(data.enabled),
              memberIds: Array.isArray(data.memberIds) ? data.memberIds.map(String) : [],
              createdBy: String(data.operatorName || 'Operatore Centrale'),
              createdAt: Date.now(),
              activeSpeaker: null,
            });
            this.scheduleShardWrite('config', { radioGroups: current });
          }
        }
        break;
      }
      case 'UPDATE_RADIO_GROUP_MEMBERS': {
        if (data?.role === 'admin' && data?.groupId) {
          const current = (Array.isArray(this.cloudState.radioGroups) ? this.cloudState.radioGroups : []).map((g: any) =>
            g.id === data.groupId
              ? {
                  ...g,
                  name: data.name ? String(data.name).trim() : g.name,
                  memberIds: Array.isArray(data.memberIds) ? data.memberIds.map(String) : g.memberIds,
                }
              : g
          );
          this.scheduleShardWrite('config', { radioGroups: current });
        }
        break;
      }
      case 'TOGGLE_RADIO_GROUP_LIVE': {
        if (data?.role === 'admin' && data?.groupId) {
          const current = (Array.isArray(this.cloudState.radioGroups) ? this.cloudState.radioGroups : []).map((g: any) =>
            g.id === data.groupId
              ? {
                  ...g,
                  enabled: Boolean(data.enabled),
                  toggledBy: String(data.operatorName || 'Operatore Centrale'),
                  toggledAt: Date.now(),
                  activeSpeaker: Boolean(data.enabled) ? g.activeSpeaker : null,
                }
              : g
          );
          this.scheduleShardWrite('config', { radioGroups: current });
        }
        break;
      }
      case 'DELETE_RADIO_GROUP': {
        if (data?.role === 'admin' && data?.groupId) {
          const current = (Array.isArray(this.cloudState.radioGroups) ? this.cloudState.radioGroups : []).filter(
            (g: any) => g.id !== data.groupId
          );
          this.scheduleShardWrite('config', { radioGroups: current });
        }
        break;
      }
      case 'TRIGGER_RADIO_EMERGENCY': {
        if (data?.role === 'admin') {
          const nextActive = data?.active !== false;
          this.scheduleShardWrite('mission', {
            radioEmergency: {
              active: nextActive,
              triggeredBy: String(data?.operatorName || 'Operatore Centrale'),
              triggeredAt: Date.now(),
              message: nextActive ? String(data?.message || 'ALLERTA EMERGENZA RADIO CENTRALE') : '',
            },
          });
        }
        break;
      }
      case 'UPDATE_GPS':
        this.scheduleShardWrite('mission', { gpsPosition: data });
        break;
      case 'UPDATE_SHIFT':
        this.scheduleShardWrite('mission', { activeShift: data });
        break;
      case 'ATTESA_DESTINAZIONE_ARRIVO_SUL_POSTO':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: { ...this.cloudState.activeMission, inAttesaDestinazione: true },
          });
        }
        break;
      case 'UPDATE_DESTINATION_RETURN_CODE':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: {
              ...this.cloudState.activeMission,
              destinazione: data?.destinazione,
              codiceRientro: data?.codiceRientro,
              datiProprietarioCentrale: data?.datiProprietarioCentrale ?? this.cloudState.activeMission.datiProprietarioCentrale,
              isStrutturaVeterinaria: data?.isStrutturaVeterinaria ?? this.cloudState.activeMission.isStrutturaVeterinaria,
              decisioneCentraleNonVet: data?.decisioneCentraleNonVet ?? this.cloudState.activeMission.decisioneCentraleNonVet,
              inAttesaDestinazione: false,
            },
          });
        }
        break;
      case 'UPDATE_DECISIONE_NON_VET':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: { ...this.cloudState.activeMission, decisioneCentraleNonVet: data?.decisione },
          });
        }
        break;
      case 'UPDATE_MISSION_OBIETTIVO':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: {
              ...this.cloudState.activeMission,
              indirizzo: data?.indirizzo,
              isStrutturaVeterinariaPartenza: data?.isStrutturaVeterinariaPartenza,
            },
          });
        }
        break;
      case 'UPDATE_PROTEZIONE_CIVILE_INFO':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: {
              ...this.cloudState.activeMission,
              numeroSegreteriaSoupRt: data?.numeroSegreteriaSoupRt,
              allertaMeteo: data?.allertaMeteo,
            },
          });
        }
        break;
      case 'UPDATE_PROPRIETARIO_CENTRALE':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: {
              ...this.cloudState.activeMission,
              datiProprietarioCentrale: data?.datiProprietarioCentrale,
            },
          });
        }
        break;
      case 'UPDATE_MICROCHIP_INFO':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: {
              ...this.cloudState.activeMission,
              microchip: data?.microchip,
              noMicrochip: data?.noMicrochip,
              tipoAnimale: data?.tipo ?? this.cloudState.activeMission.tipoAnimale,
              tipoAnimaleAltro: data?.tipoAltro ?? this.cloudState.activeMission.tipoAnimaleAltro,
            },
          });
        }
        break;
      case 'UPDATE_DATI_DESTINAZIONE':
        this.scheduleShardWrite('mission', { datiDestinazione: data?.dati });
        break;
      case 'UPDATE_FOTO_DOCUMENTO':
        if (this.cloudState.activeMission) {
          this.scheduleShardWrite('mission', {
            activeMission: { ...this.cloudState.activeMission, fotoDocumento: data?.fotoDocumento },
          });
        }
        break;
      case 'CLEAR_MISSION':
        this.scheduleShardWrite('mission', {
          activeMission: null,
          letturaConfermata: false,
          operativeTimes: {},
          datiDestinazione: null,
          kmInizio: '',
          kmFine: '',
          ringing: { active: false, source: '', soundType: 'telefono', timestamp: Date.now() },
        });
        break;
      case 'ANNULLA_INTERVENTO': {
        const list = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const codiciElim = new Set(Array.isArray(this.cloudState.codiciEliminati) ? this.cloudState.codiciEliminati : []);
        if (data?.codice && !data?.schedaAperta) {
          codiciElim.add(data.codice);
        }
        this.scheduleShardWrite('mission', {
          activeMission: null,
          letturaConfermata: false,
          operativeTimes: {},
          kmInizio: '',
          kmFine: '',
          ringing: { active: false, source: '', soundType: 'telefono', timestamp: Date.now() },
        });
        this.scheduleShardWrite('servizi', {
          serviziArchivio: list,
          codiciEliminati: Array.from(codiciElim),
        });
        break;
      }
      case 'ARCHIVE_SERVICE': {
        const current = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const filtered = current.filter((x: any) => x.codice !== data?.codice && x.id !== data?.id);
        filtered.unshift(data);
        this.scheduleShardWrite('servizi', { serviziArchivio: filtered });
        break;
      }
      case 'CENTRALE_UPDATE_KM': {
        const current = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const updated = current.map((s: any) =>
          s.id === data?.id || (data?.codice && s.codice === data.codice)
            ? {
                ...s,
                kmInizio: data.kmInizio,
                kmFine: data.kmFine,
                kmTotali: Math.max(0, Math.round((data.kmFine - data.kmInizio) * 10) / 10),
                inAttesaKm: false,
              }
            : s
        );
        this.scheduleShardWrite('servizi', { serviziArchivio: updated });
        break;
      }
      case 'CENTRALE_SIGN_SERVICES': {
        const current = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const idSet = new Set(Array.isArray(data?.ids) ? data.ids : []);
        const updated = current.map((s: any) =>
          idSet.has(s.id) || idSet.has(s.codice)
            ? {
                ...s,
                firmaOperatoreCentrale: data.firmaBase64,
                operatoreCentraleNome: data.operatoreNome,
                dataFirmaCentrale: formatDateTimeItaly(),
                visionatoDaCentrale: true,
              }
            : s
        );
        this.scheduleShardWrite('servizi', { serviziArchivio: updated });
        break;
      }
      case 'CENTRALE_UPDATE_ARCHIVED_SERVICE': {
        const current = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const updated = current.map((s: any) =>
          s.id === data?.id || s.codice === data?.codice ? data : s
        );
        this.scheduleShardWrite('servizi', { serviziArchivio: updated });
        break;
      }
      case 'DELETE_SERVICE': {
        const current = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const codiciElim = new Set(Array.isArray(this.cloudState.codiciEliminati) ? this.cloudState.codiciEliminati : []);
        if (data?.codice) codiciElim.add(data.codice);
        const updated = current.filter((s: any) => s.id !== data?.id && s.codice !== data?.codice);
        const clearActive =
          this.cloudState.activeMission &&
          (this.cloudState.activeMission.codice === data?.codice || this.cloudState.activeMission.id === data?.id);
        this.scheduleShardWrite('servizi', {
          serviziArchivio: updated,
          codiciEliminati: Array.from(codiciElim),
        });
        if (clearActive) {
          this.scheduleShardWrite('mission', { activeMission: null, letturaConfermata: false, operativeTimes: {} });
        }
        break;
      }
      case 'DELETE_SERVICES_BATCH': {
        const current = Array.isArray(this.cloudState.serviziArchivio) ? [...this.cloudState.serviziArchivio] : [];
        const idSet = new Set(Array.isArray(data?.ids) ? data.ids : []);
        const codSet = new Set(Array.isArray(data?.codici) ? data.codici : []);
        const codiciElim = new Set(Array.isArray(this.cloudState.codiciEliminati) ? this.cloudState.codiciEliminati : []);
        codSet.forEach((c: any) => codiciElim.add(c));
        const updated = current.filter((s: any) => !idSet.has(s.id) && !codSet.has(s.codice));
        this.scheduleShardWrite('servizi', {
          serviziArchivio: updated,
          codiciEliminati: Array.from(codiciElim),
        });
        break;
      }
      case 'UPDATE_TURNI':
        if (Array.isArray(data?.turni)) {
          this.scheduleShardWrite('turni', { turni: data.turni });
        }
        break;
      case 'SUBMIT_CANDIDATURA_TURNO': {
        if (data?.turnoId && data?.candidatura?.id) {
          const baseTurni = Array.isArray(this.cloudState.turni) ? [...this.cloudState.turni] : [];
          let found = false;
          const updatedTurni = baseTurni.map((t: any) => {
            if (t?.id === data.turnoId) {
              found = true;
              const esistenti = Array.isArray(t.richiesteIscrizione) ? t.richiesteIscrizione : [];
              const already = esistenti.some((r: any) => r?.id === data.candidatura.id);
              return already
                ? t
                : { ...t, richiesteIscrizione: [...esistenti, data.candidatura] };
            }
            return t;
          });
          if (found) {
            this.scheduleShardWrite('turni', { turni: updatedTurni });
            this.emit('TURNI_UPDATED', { turni: updatedTurni });
          }
        }
        break;
      }
      case 'UPDATE_VOLONTARI_LIST':
        if (Array.isArray(data?.volontari)) {
          const deletedIds = normalizeDeletedIds([
            ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
            ...(Array.isArray(data.volontariEliminatiIds) ? data.volontariEliminatiIds : []),
          ]);
          const merged = mergeVolontariListsSafe(
            Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : [],
            data.volontari,
            deletedIds
          );
          this.scheduleShardWrite('volontari', {
            volontari: merged,
            volontariEliminatiIds: deletedIds,
          });
        }
        break;
      case 'CREATE_VOLONTARIO': {
        const current = Array.isArray(this.cloudState.volontari) ? [...this.cloudState.volontari] : [];
        if (data) {
          const deletedIds = normalizeDeletedIds(this.cloudState.volontariEliminatiIds).filter((d) => d !== data.id);
          const merged = mergeVolontariListsSafe(current, [data], deletedIds);
          this.scheduleShardWrite('volontari', {
            volontari: merged,
            volontariEliminatiIds: deletedIds,
          });
        }
        break;
      }
      case 'UPDATE_VOLONTARIO': {
        const current = Array.isArray(this.cloudState.volontari) ? [...this.cloudState.volontari] : [];
        if (data?.id) {
          const deletedIds = normalizeDeletedIds(this.cloudState.volontariEliminatiIds);
          const merged = mergeVolontariListsSafe(current, [data], deletedIds);
          this.scheduleShardWrite('volontari', {
            volontari: merged,
            volontariEliminatiIds: deletedIds,
          });
        }
        break;
      }
      case 'DELETE_VOLONTARIO': {
        if (data?.id || Array.isArray(data?.volontariEliminatiIds)) {
          const deletedIds = normalizeDeletedIds([
            ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
            ...(Array.isArray(data?.volontariEliminatiIds) ? data.volontariEliminatiIds : []),
            ...(data?.id ? [data.id] : []),
          ]);
          const deletedSet = new Set(deletedIds);
          const baseList = Array.isArray(data.volontari)
            ? data.volontari
            : (Array.isArray(this.cloudState.volontari) ? this.cloudState.volontari : []);
          const filtered = baseList.filter((v: any) => !v?.id || !deletedSet.has(String(v.id).trim()));
          Object.assign(this.cloudState, {
            volontari: filtered,
            volontariEliminatiIds: deletedIds,
          });
          if (this.firebaseSession.isAuthorized) {
            if (!this.shardLoadedFromCloud['volontari']) {
              this.pendingInitialWrites.add('volontari');
            } else {
              if (this.shardDirtyTimers['volontari']) {
                clearTimeout(this.shardDirtyTimers['volontari']);
                delete this.shardDirtyTimers['volontari'];
              }
              void this.flushShardToFirestoreWithRetry('volontari');
            }
          }
        }
        break;
      }
      case 'UPDATE_CHECKLISTS_TEMPLATES':
        if (Array.isArray(data?.templates)) {
          this.scheduleShardWrite('checklists', { checklistsTemplates: data.templates });
        }
        break;
      case 'SUBMIT_CHECKLIST_COMPILATA': {
        const current = Array.isArray(this.cloudState.checklistsCompilate) ? [...this.cloudState.checklistsCompilate] : [];
        if (data?.checklist) {
          current.unshift(data.checklist);
          this.scheduleShardWrite('checklists', { checklistsCompilate: current.slice(0, 200) });
        }
        break;
      }
      case 'UPDATE_LUOGHI_TIMBRATURA':
        if (Array.isArray(data?.luoghi)) {
          this.scheduleShardWrite('timbrature', { luoghiTimbratura: data.luoghi });
        }
        break;
      case 'UPDATE_TIMBRATURE':
        if (Array.isArray(data?.timbrature)) {
          this.scheduleShardWrite('timbrature', { timbrature: data.timbrature });
        }
        break;
      case 'UPDATE_BACHECA':
        if (Array.isArray(data?.bacheca)) {
          this.scheduleShardWrite('bacheca', { bacheca: data.bacheca });
        }
        break;
      case 'UPDATE_GIORNALE_BORDO':
        if (Array.isArray(data?.giornaleBordo)) {
          this.scheduleShardWrite('bacheca', { giornaleBordo: data.giornaleBordo });
        }
        break;
      case 'ADD_GIORNALE_BORDO_VOCE': {
        const current = Array.isArray(this.cloudState.giornaleBordo) ? [...this.cloudState.giornaleBordo] : [];
        if (data?.voce) {
          const filtered = current.filter((v: any) => v.id !== data.voce.id);
          filtered.unshift(data.voce);
          this.scheduleShardWrite('bacheca', { giornaleBordo: filtered });
        }
        break;
      }
      case 'PRESA_VISIONE_GIORNALE_BORDO': {
        const current = Array.isArray(this.cloudState.giornaleBordo) ? [...this.cloudState.giornaleBordo] : [];
        const updated = current.map((v: any) =>
          v.id === data?.voceId
            ? {
                ...v,
                preseVisione: [
                  ...(Array.isArray(v.preseVisione) ? v.preseVisione : []),
                  { operatore: data.operatoreNome, orario: formatDateTimeItaly() },
                ],
              }
            : v
        );
        this.scheduleShardWrite('bacheca', { giornaleBordo: updated });
        break;
      }
      case 'UPDATE_MAGAZZINO_PARTI':
        if (Array.isArray(data?.magazzinoParti)) {
          this.scheduleShardWrite('magazzino', { magazzinoParti: data.magazzinoParti });
        }
        break;
      case 'UPDATE_MAGAZZINO_MEZZI':
        if (Array.isArray(data?.magazzinoMezzi)) {
          this.scheduleShardWrite('magazzino', { magazzinoMezzi: data.magazzinoMezzi });
        }
        break;
      case 'UPDATE_INDIRIZZI_COLLEZIONATI':
        if (Array.isArray(data?.indirizziCollezionati)) {
          this.scheduleShardWrite('indirizzi', { indirizziCollezionati: data.indirizziCollezionati });
        }
        break;
      case 'ADD_INDIRIZZO_COLLEZIONATO': {
        const current = Array.isArray(this.cloudState.indirizziCollezionati) ? [...this.cloudState.indirizziCollezionati] : [];
        if (data?.entry) {
          const idx = current.findIndex((i: any) => i.id === data.entry.id || i.indirizzo?.toLowerCase() === data.entry.indirizzo?.toLowerCase());
          if (idx >= 0) current[idx] = data.entry;
          else current.unshift(data.entry);
          this.scheduleShardWrite('indirizzi', { indirizziCollezionati: current });
        }
        break;
      }
      case 'UPDATE_CONTATTI':
        if (Array.isArray(data?.contatti)) {
          this.scheduleShardWrite('indirizzi', { contatti: data.contatti });
        }
        break;
    }
  }

  public send(type: string, data: any = {}) {
    const payload = JSON.stringify({ type, data });

    // Streaming audio PCM in diretta ad alta frequenza: solo WebSocket, nessun salvataggio Firestore o polling HTTP
    if (type === 'PTT_AUDIO_CHUNK') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(payload);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    let sentWs = false;

    // 1. Persiste sullo shard Firestore corrispondente in tempo reale
    this.applyLocalEventToShards(type, data);

    // 2. Invio via WebSocket locale/Cloud Run se attivo
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(payload);
        sentWs = true;
      } catch (err) {
        console.error('[Realtime] Errore invio WS:', err);
      }
    }

    // 3. Invio HTTP ridondante verso Express se non su host puramente serverless statico
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }

    return sentWs || this.firestoreActive;
  }

  public syncSedi(sedi: any[]) {
    this.scheduleShardWrite('config', { sedi });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/sedi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sedi }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public syncCartaIntestata(datiCartaIntestata: any) {
    this.scheduleShardWrite('config', { datiCartaIntestata });
  }

  public syncPublicAppUrl(url: string): string {
    const saved = saveConfiguredPublicUrlLocal(url);
    this.cloudState.publicAppUrl = saved;
    this.scheduleShardWrite('config', { publicAppUrl: saved });
    if (!this.isServerlessStaticHost()) {
      fetch(`${this.getApiBaseUrl()}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'UPDATE_PUBLIC_APP_URL', data: { publicAppUrl: saved } }),
        cache: 'no-store',
      }).catch(() => {});
    }
    this.emit('PUBLIC_APP_URL_UPDATED', { publicAppUrl: saved });
    return saved;
  }

  public getPublicAppUrl(): string {
    const candidate = this.cloudState.publicAppUrl || getConfiguredPublicUrl() || '';
    return candidate && !isProtectedAiStudioHost(candidate) ? candidate : '';
  }

  private async applyCompletedPinResetProfiles(profiles: PinResetProfileRecord[]): Promise<number> {
    if (!this.firebaseSession.isAuthorized || !Array.isArray(profiles) || profiles.length === 0) return 0;
    const currentList = Array.isArray(this.cloudState.volontari) ? [...this.cloudState.volontari] : [];
    if (currentList.length === 0) return 0;

    let appliedCount = 0;
    const nextList = [...currentList];

    for (const prof of profiles) {
      const volId = String(prof?.volunteerId || '').trim();
      const nuovoPin = String(prof?.nuovoPin || '').trim();
      if (!volId || prof.status !== 'completed' || !/^\d{4}$/.test(nuovoPin) || nuovoPin === '4451') continue;
      if (this.pinResetProfilesReconciling.has(volId)) continue;
      this.pinResetProfilesReconciling.add(volId);

      try {
        const idx = nextList.findIndex((item: any) => item && item.id === volId);
        if (idx >= 0) {
          const oldToken = nextList[idx].resetToken || prof.tokenId || '';
          nextList[idx] = {
            ...nextList[idx],
            pin: nuovoPin,
            pinProvvisorio: false,
            richiedeResetPassword: false,
            resetToken: undefined,
            tentativiErrati: 0,
            bloccatoPerTentativi: false,
            dataBlocco: undefined,
          };
          appliedCount++;

          if (!this.isServerlessStaticHost()) {
            const baseUrl = this.getApiBaseUrl();
            fetch(`${baseUrl}/api/volontari/reset-pin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: volId,
                token: oldToken,
                nuovoPin,
                fromCloudReconciliation: true,
              }),
              cache: 'no-store',
            }).catch(() => {});
          }

          await segnaProfiloResetApplicatoFirestore(volId, nuovoPin, nextList[idx].email).catch(() => {});
          if (oldToken && oldToken.startsWith('rst-') && oldToken.length >= 12) {
            await segnaTicketResetApplicatoFirestore(oldToken).catch(() => {});
          }
        }
      } finally {
        this.pinResetProfilesReconciling.delete(volId);
      }
    }

    if (appliedCount > 0) {
      const deletedIds = normalizeDeletedIds(this.cloudState.volontariEliminatiIds);
      this.syncVolontariList(nextList, deletedIds);
      this.emit('VOLONTARI_UPDATED', {
        volontari: nextList,
        volontariEliminatiIds: deletedIds,
      });
    }

    return appliedCount;
  }

  /**
   * Verifica sia i ticket /pin_resets/{tokenId} sia i profili /pin_reset_profiles completati
   * da terminali o browser senza account Google: applica subito il nuovo PIN nell'archivio condiviso.
   */
  public async reconcileCompletedPinResets(): Promise<number> {
    if (!this.firebaseSession.isAuthorized) return 0;
    const now = Date.now();
    if (now - this.lastPinResetSweepAt < 5000) return 0;
    this.lastPinResetSweepAt = now;

    let appliedCount = 0;

    // 1. Profili completati via app in-app (ModalResetPassword su telefono senza Google Auth)
    try {
      const completedProfiles = await fetchCompletedPinResetProfilesFirestore();
      if (completedProfiles.length > 0) {
        appliedCount += await this.applyCompletedPinResetProfiles(completedProfiles);
      }
    } catch {
      // Ignora errori transitori
    }

    // 2. Ticket one-time completati via link email / allegato HTML
    const currentList = Array.isArray(this.cloudState.volontari) ? [...this.cloudState.volontari] : [];
    const pendingVols = currentList.filter(
      (v: any) => v && typeof v.resetToken === 'string' && v.resetToken.startsWith('rst-') && v.resetToken.length >= 12
    );
    if (pendingVols.length === 0) return appliedCount;

    let ticketAppliedCount = 0;
    const nextList = [...currentList];

    for (const vol of pendingVols) {
      const tokenId = String(vol.resetToken).trim();
      if (this.pinResetCheckInFlight.has(tokenId)) continue;
      this.pinResetCheckInFlight.add(tokenId);
      try {
        const res = await verificaTicketResetPinFirestore(tokenId);
        const ticket = res.ticket;
        if (
          res.found &&
          ticket &&
          ticket.status === 'completed' &&
          /^\d{4}$/.test(String(ticket.nuovoPin || '')) &&
          ticket.nuovoPin !== '4451'
        ) {
          const idx = nextList.findIndex(
            (item: any) => item && (item.id === vol.id || item.id === ticket.volunteerId)
          );
          if (idx >= 0) {
            nextList[idx] = {
              ...nextList[idx],
              pin: ticket.nuovoPin,
              pinProvvisorio: false,
              richiedeResetPassword: false,
              resetToken: undefined,
              tentativiErrati: 0,
              bloccatoPerTentativi: false,
              dataBlocco: undefined,
            };
            ticketAppliedCount++;

            if (!this.isServerlessStaticHost()) {
              const baseUrl = this.getApiBaseUrl();
              fetch(`${baseUrl}/api/volontari/reset-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: nextList[idx].id,
                  token: tokenId,
                  nuovoPin: ticket.nuovoPin,
                  fromCloudReconciliation: true,
                }),
                cache: 'no-store',
              }).catch(() => {});
            }

            await segnaTicketResetApplicatoFirestore(tokenId).catch(() => {});
            await segnaProfiloResetApplicatoFirestore(nextList[idx].id, ticket.nuovoPin, nextList[idx].email).catch(() => {});
          }
        }
      } catch {
        // Ignora errori transitori sul singolo ticket
      } finally {
        this.pinResetCheckInFlight.delete(tokenId);
      }
    }

    if (ticketAppliedCount > 0) {
      const deletedIds = normalizeDeletedIds(this.cloudState.volontariEliminatiIds);
      this.syncVolontariList(nextList, deletedIds);
      this.emit('VOLONTARI_UPDATED', {
        volontari: nextList,
        volontariEliminatiIds: deletedIds,
      });
    }

    return appliedCount + ticketAppliedCount;
  }

  // --- METODI SPECIFICI PER SINCRONIZZAZIONE VOLONTARI & PIN ---
  public getVolontariEliminatiIds(): string[] {
    return normalizeDeletedIds(this.cloudState.volontariEliminatiIds);
  }

  public async fetchVolontari(): Promise<any[]> {
    if (Array.isArray(this.cloudState.volontari) && this.cloudState.volontari.length > 0) {
      return this.cloudState.volontari;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/volontari`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.volontariEliminatiIds)) {
          this.cloudState.volontariEliminatiIds = normalizeDeletedIds([
            ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
            ...json.volontariEliminatiIds,
          ]);
        }
        if (json.volontari && Array.isArray(json.volontari)) {
          return json.volontari;
        }
      }
    } catch (err) {
      console.error('[Realtime] Errore fetchVolontari:', err);
    }
    return [];
  }

  public async fetchSyncState(): Promise<any | null> {
    if (Object.keys(this.cloudState).length > 0 && this.firestoreActive) {
      return { ...this.cloudState };
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/sync`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        return json.state || null;
      }
    } catch (err) {
      console.error('[Realtime] Errore fetchSyncState:', err);
    }
    return null;
  }

  // --- SINCRONIZZAZIONE CALENDARIO TURNI IN TEMPO REALE MULTI-CLIENT & WEB LINK ---
  public async fetchTurni(): Promise<any[]> {
    if (Array.isArray(this.cloudState.turni) && this.cloudState.turni.length > 0) {
      return this.cloudState.turni;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/turni`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.turni && Array.isArray(json.turni)) {
          return json.turni;
        }
      }
    } catch (err) {
      console.error('[Realtime] Errore fetchTurni:', err);
    }
    return [];
  }

  public syncTurni(turni: any[]) {
    this.send('UPDATE_TURNI', { turni });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/turni`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turni }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public async submitCandidaturaTurno(
    turno: { id: string; sedeNome?: string; data?: string; orarioInizio?: string; orarioFine?: string },
    candidatura: {
      id: string;
      volontarioId: string;
      volontarioNome: string;
      qualificaVolontario?: string;
      ruoloRichiesto: string;
      stato: string;
      dataRichiesta: string;
      note?: string;
    }
  ): Promise<{ firestoreOk: boolean }> {
    this.send('SUBMIT_CANDIDATURA_TURNO', {
      turnoId: turno.id,
      candidatura,
      data: turno.data || '',
      sede: turno.sedeNome || 'Sede Operativa',
      fascia: turno.orarioInizio && turno.orarioFine ? `${turno.orarioInizio}-${turno.orarioFine}` : '',
    });

    const res = await salvaCandidaturaTurnoFirestore({
      signupId: candidatura.id,
      turnoId: turno.id,
      sedeNome: turno.sedeNome || 'Sede Operativa',
      turnoData: turno.data || '2026-01-01',
      turnoOrario:
        turno.orarioInizio && turno.orarioFine
          ? `${turno.orarioInizio}-${turno.orarioFine}`
          : '08:00-14:00',
      volontarioId: candidatura.volontarioId,
      volontarioNome: candidatura.volontarioNome,
      qualificaVolontario: candidatura.qualificaVolontario || 'Volontario',
      ruoloRichiesto: candidatura.ruoloRichiesto,
      note: candidatura.note || '',
      dataRichiesta: candidatura.dataRichiesta,
    });

    return { firestoreOk: res.ok };
  }

  private async applyPendingShiftSignups(signups: ShiftSignupRecord[]): Promise<number> {
    if (!this.firebaseSession.isAuthorized || !Array.isArray(signups) || signups.length === 0) return 0;

    if (!this.shardLoadedFromCloud['turni']) {
      this.pendingShiftSignupsQueue = signups;
      return 0;
    }

    const currentTurni = Array.isArray(this.cloudState.turni) ? [...this.cloudState.turni] : [];
    let updated = [...currentTurni];
    let appliedCount = 0;

    for (const s of signups) {
      const signupId = String(s?.signupId || '').trim();
      const turnoId = String(s?.turnoId || '').trim();
      if (!signupId || !turnoId || s.status !== 'pending') continue;
      if (this.shiftSignupsReconciling.has(signupId)) continue;
      this.shiftSignupsReconciling.add(signupId);

      try {
        const candObj = {
          id: signupId,
          volontarioId: s.volontarioId,
          volontarioNome: s.volontarioNome,
          qualificaVolontario: s.qualificaVolontario || 'Volontario',
          ruoloRichiesto: s.ruoloRichiesto,
          stato: 'In Attesa' as const,
          dataRichiesta: s.dataRichiesta,
          ...(s.note ? { note: s.note } : {}),
        };

        let matched = false;
        updated = updated.map((t: any) => {
          if (t && t.id === turnoId) {
            matched = true;
            const esistenti = Array.isArray(t.richiesteIscrizione) ? t.richiesteIscrizione : [];
            if (esistenti.some((r: any) => r?.id === signupId)) return t;
            appliedCount++;
            return {
              ...t,
              richiesteIscrizione: [...esistenti, candObj],
            };
          }
          return t;
        });

        await segnaCandidaturaTurnoApplicataFirestore(signupId).catch(() => {});

        if (matched) {
          this.emit('NOTIFICA_DISPONIBILITA_TURNO', {
            tipo: 'disponibilita_turno',
            turnoId,
            volontarioNome: s.volontarioNome,
            ruolo: s.ruoloRichiesto,
            data: s.turnoData,
            fascia: s.turnoOrario,
            sede: s.sedeNome,
            timestamp: Date.now(),
          });
        }
      } finally {
        this.shiftSignupsReconciling.delete(signupId);
      }
    }

    if (appliedCount > 0) {
      const turniNorm = normalizzaTurniSedi(updated);
      this.scheduleShardWrite('turni', { turni: turniNorm });
      this.emit('TURNI_UPDATED', { turni: turniNorm });
      if (!this.isServerlessStaticHost()) {
        try {
          const baseUrl = this.getApiBaseUrl();
          fetch(`${baseUrl}/api/turni`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turni: turniNorm }),
            cache: 'no-store',
          }).catch(() => {});
        } catch {}
      }
    }

    return appliedCount;
  }

  public createVolontario(volontario: any) {
    this.send('CREATE_VOLONTARIO', volontario);
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/volontari`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(volontario),
          cache: 'no-store',
        }).catch((err) => console.error('[Realtime] Errore POST volontario:', err));
      } catch {}
    }
  }

  public updateVolontario(volontario: any) {
    this.send('UPDATE_VOLONTARIO', volontario);
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/volontari/${volontario.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(volontario),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public syncVolontariList(volontari: any[], volontariEliminatiIds?: string[]) {
    const deletedIds = normalizeDeletedIds(volontariEliminatiIds);
    this.send('UPDATE_VOLONTARI_LIST', { volontari, volontariEliminatiIds: deletedIds });
    this.lastExpressVolontariSig = `${this.computeVolontariSig(volontari)}#${deletedIds.join(',')}`;
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/volontari`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volontari, volontariEliminatiIds: deletedIds }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public deleteVolontario(id: string, remainingVolontari?: any[], volontariEliminatiIds?: string[]) {
    const deletedIds = normalizeDeletedIds([
      ...(Array.isArray(this.cloudState.volontariEliminatiIds) ? this.cloudState.volontariEliminatiIds : []),
      ...(volontariEliminatiIds || []),
      id,
    ]);
    const deletedSet = new Set(deletedIds);
    const filteredRemaining = Array.isArray(remainingVolontari)
      ? remainingVolontari.filter((v: any) => !v?.id || !deletedSet.has(String(v.id).trim()))
      : (Array.isArray(this.cloudState.volontari)
          ? this.cloudState.volontari.filter((v: any) => !v?.id || !deletedSet.has(String(v.id).trim()))
          : []);
    this.lastExpressVolontariSig = `${this.computeVolontariSig(filteredRemaining)}#${deletedIds.join(',')}`;
    this.send('DELETE_VOLONTARIO', { id, volontari: filteredRemaining, volontariEliminatiIds: deletedIds });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/volontari/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  // Metodi operativi missioni e radio
  public dispatchMission(mission: any, isManual: boolean = false) {
    const payload = isManual && mission ? { ...mission, _manualDispatch: true } : mission;
    return this.send('DISPATCH_MISSION', payload);
  }

  public confirmMissionRead(codice?: string) {
    return this.send('CONFIRM_MISSION_READ', { codice });
  }

  public triggerRing(source: string, soundType: 'telefono' | 'sirena' | 'chiamata' = 'telefono') {
    return this.send('TRIGGER_RING', { source, soundType });
  }

  public stopRing() {
    return this.send('STOP_RING', {});
  }

  public updateOperativeTimes(times: any, label: string, timeStr: string, isRientro: boolean, codice?: string) {
    return this.send('UPDATE_OPERATIVE_TIMES', { times, label, timeStr, isRientro, codice });
  }

  public updateKm(kmInizio?: string, kmFine?: string, messaggio?: string) {
    return this.send('UPDATE_KM', { kmInizio, kmFine, messaggio });
  }

  public sendRadioMessage(
    mittente: 'CENTRALE' | 'BORDO MEZZO',
    testo: string,
    extra?: {
      audioDataUrl?: string;
      audioDurationSec?: number;
      audioMimeType?: string;
      mittenteNome?: string;
      clientMsgId?: string;
      groupId?: string;
      groupName?: string;
    }
  ) {
    return this.send('SEND_RADIO_MESSAGE', {
      mittente,
      testo,
      ...(extra || {}),
    });
  }

  public toggleRadioPttLive(enabled: boolean, role: 'admin' | 'volontario', operatorName: string) {
    return this.send('TOGGLE_RADIO_PTT_LIVE', {
      enabled,
      role,
      operatorName,
    });
  }

  public createRadioGroup(
    name: string,
    memberIds: string[],
    operatorName: string,
    role: 'admin' | 'volontario'
  ) {
    const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return this.send('CREATE_RADIO_GROUP', {
      id,
      name,
      memberIds,
      operatorName,
      role,
      enabled: false,
    });
  }

  public updateRadioGroupMembers(
    groupId: string,
    memberIds: string[],
    operatorName: string,
    role: 'admin' | 'volontario',
    name?: string
  ) {
    return this.send('UPDATE_RADIO_GROUP_MEMBERS', {
      groupId,
      memberIds,
      operatorName,
      role,
      ...(name ? { name } : {}),
    });
  }

  public toggleRadioGroupLive(
    groupId: string,
    enabled: boolean,
    operatorName: string,
    role: 'admin' | 'volontario'
  ) {
    return this.send('TOGGLE_RADIO_GROUP_LIVE', {
      groupId,
      enabled,
      operatorName,
      role,
    });
  }

  public deleteRadioGroup(groupId: string, role: 'admin' | 'volontario') {
    return this.send('DELETE_RADIO_GROUP', {
      groupId,
      role,
    });
  }

  public triggerRadioEmergency(
    active: boolean,
    operatorName: string,
    role: 'admin' | 'volontario',
    message?: string
  ) {
    return this.send('TRIGGER_RADIO_EMERGENCY', {
      active,
      operatorName,
      role,
      message,
    });
  }

  public updateRadioClientIdentity(meta: {
    volontarioId?: string;
    role?: 'admin' | 'volontario';
    activeChannelId?: string;
  }) {
    if (meta.volontarioId !== undefined) this.localRadioClientMeta.volontarioId = meta.volontarioId;
    if (meta.role !== undefined) this.localRadioClientMeta.role = meta.role;
    if (meta.activeChannelId !== undefined) this.localRadioClientMeta.activeChannelId = meta.activeChannelId;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'PTT_CLIENT_CAPS', data: { ...this.localRadioClientMeta } }));
      } catch {}
    }
  }

  private async reportOpusCapability() {
    let opus = false;
    try {
      const Enc = typeof window !== 'undefined' ? (window as any).AudioEncoder : null;
      const Dec = typeof window !== 'undefined' ? (window as any).AudioDecoder : null;
      if (typeof Enc === 'function' && typeof Dec === 'function') {
        const [encSup, decSup] = await Promise.all([
          Enc.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 48000 }),
          Dec.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1 }),
        ]);
        opus = Boolean(encSup?.supported && decSup?.supported);
      }
    } catch {
      opus = false;
    }
    this.localRadioClientMeta.opus = opus;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'PTT_CLIENT_CAPS', data: { ...this.localRadioClientMeta } }));
      } catch {}
    }
  }

  public startPtt(
    speakerId: string,
    speakerName: string,
    role: 'admin' | 'volontario',
    options?: { channelId?: string; volontarioId?: string; isEmergency?: boolean }
  ) {
    return this.send('PTT_START', {
      speakerId,
      speakerName,
      role,
      channelId: options?.channelId || 'general',
      volontarioId: options?.volontarioId || this.localRadioClientMeta.volontarioId,
      isEmergency: Boolean(options?.isEmergency),
    });
  }

  public sendPttAudioChunk(
    speakerId: string,
    payloadBase64: string,
    sampleRate: number = 24000,
    seq: number = 0,
    codec: 'opus' | 'adpcm24' | 'pcm16' = 'adpcm24',
    channelId: string = 'general'
  ) {
    return this.send('PTT_AUDIO_CHUNK', {
      speakerId,
      codec,
      payloadBase64,
      sampleRate,
      seq,
      channelId,
    });
  }

  public stopPtt(speakerId: string, channelId?: string) {
    return this.send('PTT_STOP', {
      speakerId,
      channelId,
    });
  }

  public updateGps(position: any) {
    return this.send('UPDATE_GPS', position);
  }

  public updateShift(shift: any) {
    return this.send('UPDATE_SHIFT', shift);
  }

  public alertCentraleAttesaDestinazione(codice?: string, mezzo?: string) {
    return this.send('ATTESA_DESTINAZIONE_ARRIVO_SUL_POSTO', { codice, mezzo });
  }

  public updateDestinationAndReturnCode(
    destinazione: string,
    codiceRientro: string,
    codiceMissione?: string,
    datiProprietarioCentrale?: any,
    isStrutturaVeterinaria?: boolean,
    decisioneCentraleNonVet?: 'rientro_sede' | 'nuovo_obiettivo' | null
  ) {
    return this.send('UPDATE_DESTINATION_RETURN_CODE', {
      destinazione,
      codiceRientro,
      codiceMissione,
      datiProprietarioCentrale,
      isStrutturaVeterinaria,
      decisioneCentraleNonVet,
    });
  }

  public updateDecisioneNonVet(decisione: 'rientro_sede' | 'nuovo_obiettivo', codice?: string) {
    return this.send('UPDATE_DECISIONE_NON_VET', { decisione, codice });
  }

  public updateMissionObiettivo(indirizzo: string, codiceMissione?: string, isStrutturaVeterinariaPartenza?: boolean) {
    return this.send('UPDATE_MISSION_OBIETTIVO', { indirizzo, codiceMissione, isStrutturaVeterinariaPartenza });
  }

  public updateProtezioneCivileInfo(numeroSegreteriaSoupRt?: string, allertaMeteo?: string, codice?: string) {
    return this.send('UPDATE_PROTEZIONE_CIVILE_INFO', { numeroSegreteriaSoupRt, allertaMeteo, codice });
  }

  public updateProprietarioCentrale(datiProprietarioCentrale: any, codice?: string) {
    return this.send('UPDATE_PROPRIETARIO_CENTRALE', { datiProprietarioCentrale, codice });
  }

  public updateMicrochipInfo(codice: string, microchip: string, noMicrochip: boolean, tipo?: string, tipoAltro?: string) {
    return this.send('UPDATE_MICROCHIP_INFO', { codice, microchip, noMicrochip, tipo, tipoAltro });
  }

  public updateDatiDestinazione(dati: any, codice?: string) {
    return this.send('UPDATE_DATI_DESTINAZIONE', { dati, codice });
  }

  public updateFotoDocumento(codice: string, fotoDocumento: { fronte?: string; retro?: string; dataAcquisizione?: string }) {
    return this.send('UPDATE_FOTO_DOCUMENTO', { codice, fotoDocumento });
  }

  public clearMission() {
    return this.send('CLEAR_MISSION', {});
  }

  public archiveService(servizio: any) {
    this.send('ARCHIVE_SERVICE', servizio);
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/servizi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(servizio),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public centraleUpdateKm(id: string, kmInizio: number, kmFine: number, codice?: string) {
    this.send('CENTRALE_UPDATE_KM', { id, kmInizio, kmFine, codice });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/servizi/${id}/km`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kmInizio, kmFine }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public segnalaKmScadutiSenzaInserimento(data: { codice: string; mezzo: string; volontarioNome: string; volontarioTelefono: string }) {
    return this.send('VOLONTARIO_SCADENZA_KM_ALLARME', data);
  }

  public centraleSignServices(ids: string[], firmaBase64: string, operatoreNome?: string) {
    this.send('CENTRALE_SIGN_SERVICES', { ids, firmaBase64, operatoreNome });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/servizi/firma-centrale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, firmaBase64, operatoreNome }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public centraleUpdateArchivedService(servizio: any) {
    this.send('CENTRALE_UPDATE_ARCHIVED_SERVICE', servizio);
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/servizi/${servizio.id || servizio.codice}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(servizio),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public annullaIntervento(data: { codice: string; motivo: string; richiedente: string; dettagli?: string; orario?: string; schedaAperta?: boolean }) {
    this.send('ANNULLA_INTERVENTO', data);
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/missione/annulla`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public updateChecklistsTemplates(templates: any[]) {
    this.send('UPDATE_CHECKLISTS_TEMPLATES', { templates });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/checklists/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templates }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public submitChecklistCompilata(checklist: any) {
    this.send('SUBMIT_CHECKLIST_COMPILATA', { checklist });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/checklists/compilate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklist }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public syncLuoghiTimbratura(luoghi: any[], messaggio?: string) {
    this.send('UPDATE_LUOGHI_TIMBRATURA', { luoghi, messaggio });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/luoghi-timbratura`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ luoghi }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public async fetchLuoghiTimbratura(): Promise<any[] | null> {
    if (Array.isArray(this.cloudState.luoghiTimbratura) && this.cloudState.luoghiTimbratura.length > 0) {
      return this.cloudState.luoghiTimbratura;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/luoghi-timbratura`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {}
    return null;
  }

  public syncTimbrature(timbrature: any[], messaggio?: string) {
    this.send('UPDATE_TIMBRATURE', { timbrature, messaggio });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/timbrature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timbrature }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public async fetchTimbrature(): Promise<any[] | null> {
    if (Array.isArray(this.cloudState.timbrature) && this.cloudState.timbrature.length > 0) {
      return this.cloudState.timbrature;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/timbrature`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.timbrature)) return data.timbrature;
      }
    } catch {}
    return null;
  }

  public syncBacheca(bacheca: any[], notifica?: any) {
    this.send('UPDATE_BACHECA', { bacheca, notifica });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/bacheca`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bacheca, notifica }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public async fetchBacheca(): Promise<any[] | null> {
    if (Array.isArray(this.cloudState.bacheca) && this.cloudState.bacheca.length > 0) {
      return this.cloudState.bacheca;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/bacheca`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bacheca)) return data.bacheca;
      }
    } catch {}
    return null;
  }

  public sendNotificaBacheca(notifica: any) {
    this.send('NOTIFICA_BACHECA', { notifica });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/bacheca/notifica`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifica }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  // --- METODI PER GIORNALE DI BORDO & BROGLIACCIO DI CENTRALE ---
  public syncGiornaleBordo(giornaleBordo: any[]) {
    this.send('UPDATE_GIORNALE_BORDO', { giornaleBordo });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/giornale-bordo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ giornaleBordo }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public addVoceGiornaleBordo(voce: any) {
    this.send('ADD_GIORNALE_BORDO_VOCE', { voce });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/giornale-bordo/voce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voce }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public segnaPresaVisioneGiornaleBordo(voceId: string, operatoreNome: string) {
    this.send('PRESA_VISIONE_GIORNALE_BORDO', { voceId, operatoreNome });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/giornale-bordo/presa-visione`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voceId, operatoreNome }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public async fetchGiornaleBordo(): Promise<any[] | null> {
    if (Array.isArray(this.cloudState.giornaleBordo) && this.cloudState.giornaleBordo.length > 0) {
      return this.cloudState.giornaleBordo;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/giornale-bordo`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.giornaleBordo)) return data.giornaleBordo;
      }
    } catch {}
    return null;
  }

  // --- SINCRONIZZAZIONE MAGAZZINO MEZZI & DOTAZIONI DI BORDO SU SERVER ---
  public syncMagazzinoParti(magazzinoParti: any[]) {
    this.send('UPDATE_MAGAZZINO_PARTI', { magazzinoParti });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/magazzino-mezzi/parti`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ magazzinoParti }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public syncMagazzinoMezzi(magazzinoMezzi: any[]) {
    this.send('UPDATE_MAGAZZINO_MEZZI', { magazzinoMezzi });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/magazzino-mezzi/dotazioni`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ magazzinoMezzi }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public async fetchMagazzinoMezzi(): Promise<{ magazzinoParti: any[]; magazzinoMezzi: any[] } | null> {
    if (Array.isArray(this.cloudState.magazzinoParti) || Array.isArray(this.cloudState.magazzinoMezzi)) {
      return {
        magazzinoParti: Array.isArray(this.cloudState.magazzinoParti) ? this.cloudState.magazzinoParti : [],
        magazzinoMezzi: Array.isArray(this.cloudState.magazzinoMezzi) ? this.cloudState.magazzinoMezzi : [],
      };
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/magazzino-mezzi`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          return {
            magazzinoParti: Array.isArray(data.magazzinoParti) ? data.magazzinoParti : [],
            magazzinoMezzi: Array.isArray(data.magazzinoMezzi) ? data.magazzinoMezzi : [],
          };
        }
      }
    } catch {}
    return null;
  }

  // --- SINCRONIZZAZIONE INDIRIZZI COLLEZIONATI & CONTATTI ---
  public syncIndirizziCollezionati(indirizziCollezionati: any[]) {
    this.send('UPDATE_INDIRIZZI_COLLEZIONATI', { indirizziCollezionati });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/indirizzi-collezionati`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ indirizziCollezionati }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }

  public addIndirizzoCollezionato(entry: any) {
    return this.send('ADD_INDIRIZZO_COLLEZIONATO', { entry });
  }

  public async fetchIndirizziCollezionati(): Promise<any[] | null> {
    if (Array.isArray(this.cloudState.indirizziCollezionati) && this.cloudState.indirizziCollezionati.length > 0) {
      return this.cloudState.indirizziCollezionati;
    }
    try {
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/indirizzi-collezionati`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.indirizziCollezionati)) {
          return data.indirizziCollezionati;
        }
      }
    } catch {}
    return null;
  }

  public syncContatti(contatti: any[]) {
    this.send('UPDATE_CONTATTI', { contatti });
    if (!this.isServerlessStaticHost()) {
      try {
        const baseUrl = this.getApiBaseUrl();
        fetch(`${baseUrl}/api/contatti`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contatti }),
          cache: 'no-store',
        }).catch(() => {});
      } catch {}
    }
  }
}

export const realtime = new RealtimeService();
