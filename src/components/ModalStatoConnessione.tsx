import React, { useEffect, useState } from 'react';
import {
  Wifi,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Smartphone,
  Globe,
  Cloud,
  LogIn,
  LogOut,
  UploadCloud,
  UserCheck,
  UserX,
  Clock,
  DownloadCloud
} from 'lucide-react';
import { realtime, ConnectionInfo } from '../services/realtime';
import type { ApprovedOperatorRecord, OperatorRequestRecord } from '../services/firebase';
import { getConfiguredPublicUrl, scaricaPaginaHtmlResetPinPubblica } from '../utils/publicUrl';

interface ModalStatoConnessioneProps {
  isOpen: boolean;
  onClose: () => void;
  info: ConnectionInfo;
  volontariCount: number;
  onSyncLocalToCloud?: () => Promise<void>;
}

export const ModalStatoConnessione: React.FC<ModalStatoConnessioneProps> = ({
  isOpen,
  onClose,
  info,
  volontariCount,
  onSyncLocalToCloud
}) => {
  const [testando, setTestando] = useState(false);
  const [esitoTest, setEsitoTest] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('CROCE_ORO_SERVER_URL') || '');
  const [publicUrl, setPublicUrl] = useState(() => realtime.getPublicAppUrl() || getConfiguredPublicUrl());
  const [salvato, setSalvato] = useState(false);
  const [publicUrlSalvato, setPublicUrlSalvato] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [pushingCloud, setPushingCloud] = useState(false);
  const [pullingCloud, setPullingCloud] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<OperatorRequestRecord[]>([]);
  const [approvedOps, setApprovedOps] = useState<ApprovedOperatorRecord[]>([]);
  const [loadingAdminOps, setLoadingAdminOps] = useState(false);
  const [publicRosterStatus, setPublicRosterStatus] = useState<{
    checked: boolean;
    exists: boolean;
    count: number;
    version?: number;
  }>({ checked: false, exists: false, count: 0 });
  const [publishingRoster, setPublishingRoster] = useState(false);

  const loadPublicRosterStatus = async () => {
    try {
      const st = await realtime.checkPublicRosterStatus();
      setPublicRosterStatus({
        checked: true,
        exists: st.exists,
        count: st.count,
        version: st.version,
      });
    } catch {
      setPublicRosterStatus((prev) => ({ ...prev, checked: true }));
    }
  };

  const handlePubblicaRubricaIphone = async () => {
    setPublishingRoster(true);
    setAuthMsg(null);
    try {
      let localVols: any[] | undefined;
      let localDeleted: string[] | undefined;
      try {
        const rawV = localStorage.getItem('CROCE_ORO_VOLONTARI_DB');
        if (rawV) {
          const parsed = JSON.parse(rawV);
          if (Array.isArray(parsed) && parsed.length > 0) localVols = parsed;
        }
        const rawD = localStorage.getItem('CROCE_ORO_VOLONTARI_ELIMINATI');
        if (rawD) {
          const parsedD = JSON.parse(rawD);
          if (Array.isArray(parsedD)) localDeleted = parsedD;
        }
      } catch {}

      const res = await realtime.publishPublicVolunteerRosterForAdmin(localVols, localDeleted);
      if (res.ok) {
        setAuthMsg(
          `✅ Rubrica Login iPhone/Android pubblicata su Cloud Firestore (${res.count} volontari visibili subito sui nuovi dispositivi)!`
        );
        await loadPublicRosterStatus();
      } else {
        setAuthMsg(`❌ Pubblicazione rubrica iPhone non riuscita: ${res.error || 'errore sconosciuto'}`);
      }
    } catch (err: any) {
      setAuthMsg(`❌ Errore pubblicazione rubrica iPhone: ${err?.message || 'imprevisto'}`);
    } finally {
      setPublishingRoster(false);
    }
  };

  const loadAdminOperators = async () => {
    if (!info.firebaseIsAdmin) return;
    setLoadingAdminOps(true);
    try {
      const [reqs, ops] = await Promise.all([
        realtime.fetchOperatorRequests(),
        realtime.fetchApprovedOperators()
      ]);
      setPendingRequests(reqs.filter((r) => r.status === 'pending'));
      setApprovedOps(ops.filter((o) => o.active));
    } catch (err: any) {
      setAuthMsg(`Errore caricamento operatori: ${err?.message || 'imprevisto'}`);
    } finally {
      setLoadingAdminOps(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPublicRosterStatus();
      if (info.firebaseIsAdmin) {
        loadAdminOperators();
      }
    }
  }, [isOpen, info.firebaseIsAdmin]);

  if (!isOpen) return null;

  const isFirestore = info.transport === 'firestore';
  const isWs = info.transport === 'websocket';
  const isPolling = info.status === 'polling' && info.transport === 'http';
  const isAuthRequired = info.status === 'auth_required';
  const isDisconnected = !info.connected && !isPolling;

  const handleTestConnessione = async () => {
    setTestando(true);
    setEsitoTest(null);
    const parti: string[] = [];

    try {
      const cloudRes = await realtime.testCloudHealth();
      if (cloudRes.firestoreReachable) {
        if (info.firestoreActive) {
          try {
            const refreshed = await realtime.forceRefreshFromCloud();
            parti.push(
              `✅ Cloud Firestore Realtime: CONNESSO (${info.firebaseEmail || 'Operatore abilitato'}) • ${refreshed.loadedCount} sezioni sincronizzate dal server`
            );
          } catch (refreshErr: any) {
            parti.push(`⚠️ Cloud Firestore: ${refreshErr?.message || 'Errore lettura sezioni'}`);
          }
        } else if (info.firebaseStatus === 'pending_approval') {
          parti.push('⏳ Cloud Firestore raggiungibile: account Google in attesa di approvazione Admin');
        } else {
          parti.push('🔐 Cloud Firestore raggiungibile: accedi con Google per attivare il sync multi-dispositivo');
        }
      } else {
        parti.push(`❌ Cloud Firestore non raggiungibile (${cloudRes.error || 'offline'})`);
      }

      const baseUrl = realtime.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.mode === 'vercel-serverless') {
          parti.push(`✅ API Endpoint (${baseUrl}): HTTP 200 (Vercel v${data.version || 'live'})`);
        } else {
          parti.push(`✅ Backend Server: HTTP 200 (Uptime ${Math.round(data.uptime || 0)}s • Volontari: ${data.volontariCount ?? volontariCount})`);
        }
        realtime.connect();
      } else {
        parti.push(`⚠️ API HTTP (${baseUrl}/api/health): codice ${res.status}`);
      }
    } catch (err: any) {
      parti.push(`⚠️ API HTTP non raggiungibile: ${err?.message || 'Server offline'}`);
    } finally {
      setEsitoTest(parti.join('\n'));
      setTestando(false);
    }
  };

  const handleScaricaDaCloud = async () => {
    setPullingCloud(true);
    setAuthMsg(null);
    try {
      const res = await realtime.forceRefreshFromCloud();
      setAuthMsg(`✅ Dati scaricati e riallineati da Cloud Firestore (${res.loadedCount} blocchi aggiornati)!`);
    } catch (err: any) {
      setAuthMsg(`❌ Errore scaricamento cloud: ${err?.message || 'imprevisto'}`);
    } finally {
      setPullingCloud(false);
    }
  };

  const handleConnectGoogle = async () => {
    setAuthLoading(true);
    setAuthMsg(null);
    try {
      await realtime.connectGoogleCloudSync();
      setAuthMsg('✅ Accesso Google completato! Verifica permessi cloud in corso...');
    } catch (err: any) {
      setAuthMsg(`❌ Accesso non riuscito: ${err?.message || 'Finestra chiusa o bloccata'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setAuthLoading(true);
    setAuthMsg(null);
    try {
      await realtime.disconnectGoogleCloudSync();
      setAuthMsg('Disconnesso dal Sync Cloud Google.');
    } catch (err: any) {
      setAuthMsg(`Errore disconnessione: ${err?.message || 'imprevisto'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRichiediAbilitazione = async () => {
    setAuthLoading(true);
    setAuthMsg(null);
    try {
      await realtime.requestOperatorCloudAccess();
      setAuthMsg('✅ Richiesta inviata! Un Amministratore (270bis@live.it) può abilitare questo dispositivo dalla sezione qui sotto.');
    } catch (err: any) {
      setAuthMsg(`❌ Errore invio richiesta: ${err?.message || 'imprevisto'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleApprova = async (req: OperatorRequestRecord) => {
    try {
      await realtime.approvaOperatore(req.uid, req.email, req.displayName);
      setAuthMsg(`✅ Operatore ${req.email} abilitato al Sync Cloud!`);
      await loadAdminOperators();
    } catch (err: any) {
      setAuthMsg(`❌ Errore approvazione: ${err?.message || 'imprevisto'}`);
    }
  };

  const handleRevoca = async (op: ApprovedOperatorRecord) => {
    try {
      await realtime.revocaOperatore(op.uid);
      setAuthMsg(`Accesso revocato per ${op.email}.`);
      await loadAdminOperators();
    } catch (err: any) {
      setAuthMsg(`❌ Errore revoca: ${err?.message || 'imprevisto'}`);
    }
  };

  const handlePushLocaleSuCloud = async () => {
    setPushingCloud(true);
    setAuthMsg(null);
    try {
      if (onSyncLocalToCloud) {
        await onSyncLocalToCloud();
      } else {
        const readJson = (k: string, fallback: any = []) => {
          try {
            const raw = localStorage.getItem(k);
            return raw ? JSON.parse(raw) : fallback;
          } catch {
            return fallback;
          }
        };
        await realtime.pushAllLocalStateToCloud({
          volontari: readJson('CROCE_ORO_VOLONTARI_DB'),
          volontariEliminatiIds: readJson('CROCE_ORO_VOLONTARI_ELIMINATI', []),
          turni: readJson('CROCE_ORO_TURNI_SEDI'),
          serviziArchivio: readJson('CROCE_ORO_ARCHIVIO_PDF'),
          bacheca: readJson('CROCE_ORO_BACHECA_COMUNICAZIONI'),
          giornaleBordo: readJson('CROCE_ORO_GIORNALE_BORDO'),
          magazzinoParti: readJson('CROCE_ORO_MAGAZZINO_PARTI_MEZZI'),
          magazzinoMezzi: readJson('CROCE_ORO_MAGAZZINO_MEZZI'),
          timbrature: readJson('CROCE_ORO_TIMBRATURE'),
          luoghiTimbratura: readJson('CROCE_ORO_LUOGHI_TIMBRATURA'),
          indirizziCollezionati: readJson('CROCE_ORO_INDIRIZZI_COLLEZIONATI'),
          contatti: readJson('CROCE_ORO_CONTATTI_ESTERNI'),
          checklistsTemplates: readJson('CROCE_ORO_CHECKLISTS_TEMPLATES'),
          checklistsCompilate: readJson('CROCE_ORO_CHECKLISTS_COMPILATE'),
          tipologieMezzo: readJson('CROCE_ORO_TIPOLOGIE_MEZZO'),
          sedi: readJson('CROCE_ORO_SEDI_COMPLETE'),
        });
      }
      setAuthMsg('✅ Tutti i dati locali di questo dispositivo sono stati pubblicati e sincronizzati sul Cloud Firestore!');
    } catch (err: any) {
      setAuthMsg(`❌ Errore allineamento cloud: ${err?.message || 'imprevisto'}`);
    } finally {
      setPushingCloud(false);
    }
  };

  const handleSalvaUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const pulito = customUrl.trim().replace(/\/$/, '');
    if (pulito) {
      localStorage.setItem('CROCE_ORO_SERVER_URL', pulito);
    } else {
      localStorage.removeItem('CROCE_ORO_SERVER_URL');
    }
    setSalvato(true);
    setTimeout(() => setSalvato(false), 2500);
    realtime.connect();
  };

  const handleRipristinaDefault = () => {
    localStorage.removeItem('CROCE_ORO_SERVER_URL');
    setCustomUrl('');
    setSalvato(true);
    setTimeout(() => setSalvato(false), 2500);
    realtime.connect();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[92vh]">
        {/* Intestazione */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                info.connected
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isPolling || isAuthRequired
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {isFirestore ? <Cloud className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                Stato Sincronizzazione Cloud
              </h3>
              <p className="text-[11px] text-slate-400">
                Centrale Operativa • Terminali Bordo Mezzo • Vercel &amp; PWA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenuto Diagnostico */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          {/* Card Stato Corrente */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              info.connected
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : isPolling || isAuthRequired
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                : 'bg-red-950/40 border-red-500/30 text-red-200'
            }`}
          >
            {info.connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : isPolling ? (
              <RefreshCw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-spin" />
            ) : (
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isAuthRequired ? 'text-amber-400' : 'text-red-400'}`} />
            )}
            <div className="flex-1 space-y-1">
              <div className="font-black text-sm uppercase">
                {isFirestore
                  ? 'Sincronizzazione Cloud Live Attiva (Firestore)'
                  : isWs
                  ? 'Sincronizzazione Live Attiva (WebSocket)'
                  : isPolling
                  ? 'Sincronizzazione HTTP Polling Attiva'
                  : isAuthRequired
                  ? 'Accesso Google Richiesto per Sync Cloud'
                  : 'Sincronizzazione Cloud Non Attiva'}
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                {isFirestore
                  ? 'Tutti i dati (missioni, volontari, turni, archivio, magazzino mezzi e radio) sono sincronizzati in tempo reale via Firebase Cloud Firestore su Vercel, PC e smartphone.'
                  : isWs
                  ? 'Tutti i dati sono sincronizzati istantaneamente tramite server WebSocket dedicato.'
                  : isPolling
                  ? 'I dati vengono scambiati con il server Express locale tramite polling HTTP verificato.'
                  : isAuthRequired
                  ? 'Su Vercel / browser remoti la sincronizzazione in tempo reale utilizza Firebase Cloud Firestore. Accedi con Google qui sotto per collegare subito questo dispositivo.'
                  : `Connessione al server di sincronizzazione assente${info.lastError ? ` (${info.lastError})` : ''}. Attiva Firebase Cloud Sync con Google qui sotto per sincronizzare comunque tra tutti i dispositivi.`}
              </p>
            </div>
          </div>

          {/* Sezione Firebase Cloud Firestore Auth & Multi-Device */}
          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-black text-cyan-300 uppercase text-[11px]">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span>Sincronizzazione Cloud Multi-Dispositivo (Firebase)</span>
              </div>
              {info.firebaseEmail && (
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono text-emerald-300 truncate max-w-[170px]">
                  {info.firebaseEmail}
                </span>
              )}
            </div>

            {info.firebaseStatus === 'signed_out' || !info.firebaseStatus ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Accedi con l&apos;account Google autorizzato (es. Amministratore Centrale) per attivare il database cloud condiviso tra Centrale, PC e smartphone anche su Vercel.
                </p>
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={authLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{authLoading ? 'Accesso in corso...' : 'Connetti con Google (Attiva Sync Cloud)'}</span>
                </button>
              </div>
            ) : info.firebaseStatus === 'pending_approval' ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-[11px] flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Sei autenticato come <strong>{info.firebaseEmail}</strong>, ma questo account non è ancora abilitato al database associativo.
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRichiediAbilitazione}
                    disabled={authLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase cursor-pointer"
                  >
                    Richiedi Abilitazione ad Admin
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={authLoading}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Esci</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    {info.firebaseIsAdmin ? 'Amministratore Cloud Verificato' : 'Operatore Cloud Abilitato'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={authLoading}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Disconnetti</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePushLocaleSuCloud}
                    disabled={pushingCloud || pullingCloud}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-200 font-bold text-[11px] uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <UploadCloud className={`w-4 h-4 shrink-0 ${pushingCloud ? 'animate-bounce' : ''}`} />
                    <span>{pushingCloud ? 'Pubblicazione...' : 'Pubblica su Cloud'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleScaricaDaCloud}
                    disabled={pullingCloud || pushingCloud}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-200 font-bold text-[11px] uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <DownloadCloud className={`w-4 h-4 shrink-0 ${pullingCloud ? 'animate-bounce' : ''}`} />
                    <span>{pullingCloud ? 'Scaricamento...' : 'Scarica dal Cloud'}</span>
                  </button>
                </div>

                {/* Stato e Pubblicazione 1-Tap Rubrica Login iPhone / Nuovi Dispositivi (Zero-PII) */}
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Elenco Login iPhone / Nuovi Smartphone</span>
                    </div>
                    <div className={`text-[10.5px] font-semibold mt-0.5 ${publicRosterStatus.exists && publicRosterStatus.count > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {!publicRosterStatus.checked
                        ? 'Verifica rubrica Cloud in corso...'
                        : publicRosterStatus.exists && publicRosterStatus.count > 0
                        ? `✅ Attiva sul Cloud: ${publicRosterStatus.count} volontari (rev. ${publicRosterStatus.version || 1})`
                        : '⚠️ Non ancora pubblicata sul Cloud: clicca "Pubblica"'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePubblicaRubricaIphone}
                    disabled={publishingRoster || pushingCloud}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase shrink-0 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {publishingRoster ? 'Invio...' : 'Pubblica'}
                  </button>
                </div>
              </div>
            )}

            {(authMsg || info.lastError) && (
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-200 whitespace-pre-line">
                {authMsg || `⚠️ ${info.lastError}`}
              </div>
            )}

            {/* Pannello Gestione Operatori (Solo Admin Cloud) */}
            {info.firebaseIsAdmin && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Terminali &amp; Operatori Cloud ({approvedOps.length} attivi, {pendingRequests.length} in attesa)
                  </span>
                  <button
                    type="button"
                    onClick={loadAdminOperators}
                    className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    {loadingAdminOps ? 'Aggiornamento...' : 'Aggiorna'}
                  </button>
                </div>

                {pendingRequests.map((req) => (
                  <div
                    key={req.uid}
                    className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{req.displayName}</div>
                      <div className="text-[10px] text-amber-300 truncate">{req.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApprova(req)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Approva</span>
                    </button>
                  </div>
                ))}

                {approvedOps.map((op) => (
                  <div
                    key={op.uid}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate">{op.displayName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{op.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoca(op)}
                      className="px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <UserX className="w-3 h-3" />
                      <span>Revoca</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dati di Sistema */}
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                Trasporto Attivo / Endpoint:
              </span>
              <span className="font-mono text-amber-300 font-semibold truncate max-w-[220px]" title={info.serverUrl}>
                {isFirestore ? 'Firebase Cloud Firestore' : info.serverUrl || 'Predefinito'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                Volontari Sincronizzati nel DB:
              </span>
              <span className="font-mono text-white font-bold bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                {volontariCount} Profili
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sicurezza &amp; Regole Cloud:
              </span>
              <span className={info.connected ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {info.connected ? 'Attivo & Protetto' : 'In Attesa di Connessione'}
              </span>
            </div>
          </div>

          {/* Test Connessione */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnessione}
              disabled={testando}
              className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testando ? 'animate-spin' : ''}`} />
              <span>{testando ? 'Verifica in corso...' : 'Testa Connessione Ora'}</span>
            </button>
          </div>

          {esitoTest && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 whitespace-pre-line">
              {esitoTest}
            </div>
          )}

          {/* Configurazione Manuale Avanzata URL Server (opzionale per server Node dedicato) */}
          <form onSubmit={handleSalvaUrl} className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Configurazione Avanzata Server Dedicato (Opzionale)
            </label>
            <p className="text-[10px] text-slate-400">
              Opzionale: imposta un URL Node/WebSocket dedicato se non usi Firebase Cloud Sync:
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://tuo-server-dedicato.example.com"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Salva
              </button>
            </div>
            {customUrl && (
              <button
                type="button"
                onClick={handleRipristinaDefault}
                className="text-[10px] text-amber-400 hover:underline cursor-pointer"
              >
                Ripristina Rilevamento Automatico
              </button>
            )}
            {salvato && (
              <span className="text-[10px] text-emerald-400 block font-semibold">
                ✓ Impostazione aggiornata con successo! Riconnessione in corso...
              </span>
            )}
          </form>

          {/* Configurazione URL Pubblico per Email Invito Reset PIN senza Google */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="text-[11px] font-bold text-amber-300 uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              URL Pubblico Email Reset PIN (Senza Account Google / AI Studio)
            </label>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Imposta l&apos;indirizzo pubblico esterno (es. Vercel oppure <span className="font-mono text-slate-300">https://www.croceoro.org/reset-pin.html</span>) usato nei link email dei volontari, così non vedranno mai pagine di login Google:
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="https://www.croceoro.org/reset-pin.html"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const saved = realtime.syncPublicAppUrl(publicUrl);
                  setPublicUrl(saved);
                  setPublicUrlSalvato(true);
                  setTimeout(() => setPublicUrlSalvato(false), 3000);
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Salva
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => scaricaPaginaHtmlResetPinPubblica()}
                className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
              >
                ⬇ Scarica file statico reset-pin.html da caricare su www.croceoro.org
              </button>
              {publicUrlSalvato && (
                <span className="text-[10px] text-emerald-400 font-semibold">
                  ✓ URL Pubblico sincronizzato sul Cloud!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-3 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
