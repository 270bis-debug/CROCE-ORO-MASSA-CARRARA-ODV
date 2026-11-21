import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Send,
  ShieldAlert,
  Square,
  Trash2,
  Volume2,
  Power,
  Lock,
  Users,
  Plus,
  Check,
  X,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { vhfRadioEngine } from '../services/vhfRadioEngine';

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

export interface RadioMemberOption {
  id: string;
  nome: string;
  cognome: string;
  qualifica?: string;
  profiloCentrale?: boolean;
}

interface RadioPttPanelProps {
  ruoloContext: 'admin' | 'volontario';
  speakerName: string;
  localSpeakerId: string;
  currentVolontarioId?: string;
  radioPttState: RadioPttState;
  radioGroups: RadioGroup[];
  radioEmergency: RadioEmergencyState;
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
  volontariList?: RadioMemberOption[];
  isLocalTransmitting: boolean;
  isLocalEmergencyTransmitting?: boolean;
  emergencyPhase?: 'idle' | 'announcing' | 'live';
  emergencyCountdownSec?: number;
  isEmergencyLatched?: boolean;
  txModulationLevel?: number;
  pttStatusMsg: string | null;
  onToggleLiveEnabled: (nextEnabled: boolean) => void;
  onToggleGroupLive?: (groupId: string, nextEnabled: boolean) => void;
  onCreateGroup?: (name: string, memberIds: string[]) => void;
  onUpdateGroupMembers?: (groupId: string, memberIds: string[], name?: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onPttStart: () => void;
  onPttStop: () => void;
  onEmergencyPttStart?: () => void;
  onEmergencyPttStop?: () => void;
  onCancelEmergencyTx?: () => void;
  onClearEmergency?: () => void;
  messaggioInput: string;
  onChangeMessaggioInput: (val: string) => void;
  onSendText: () => void;
  onSendAudioMessage: (audio: { dataUrl: string; durationSec: number; mimeType: string }) => void;
  bgRadioArmed?: boolean;
  bgPushSubscribed?: boolean;
  bgPermission?: NotificationPermission;
  bgInIframe?: boolean;
  onToggleBgRadio?: () => void;
  onTestPushRadio?: () => void;
  compact?: boolean;
}

export const RadioPttPanel: React.FC<RadioPttPanelProps> = ({
  ruoloContext,
  speakerName,
  localSpeakerId,
  currentVolontarioId,
  radioPttState,
  radioGroups,
  radioEmergency,
  selectedChannelId,
  onSelectChannel,
  volontariList = [],
  isLocalTransmitting,
  isLocalEmergencyTransmitting = false,
  emergencyPhase = 'idle',
  emergencyCountdownSec = 0,
  isEmergencyLatched = false,
  pttStatusMsg,
  onToggleLiveEnabled,
  onToggleGroupLive,
  onCreateGroup,
  onUpdateGroupMembers,
  onDeleteGroup,
  onPttStart,
  onPttStop,
  onEmergencyPttStart,
  onEmergencyPttStop,
  onCancelEmergencyTx,
  onClearEmergency,
  messaggioInput,
  onChangeMessaggioInput,
  onSendText,
  onSendAudioMessage,
  bgRadioArmed = false,
  bgPushSubscribed = false,
  bgPermission = 'default',
  bgInIframe = false,
  onToggleBgRadio,
  onTestPushRadio,
  compact = false,
}) => {
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isSendingClip, setIsSendingClip] = useState(false);

  // Gestione gruppi permanenti (solo Operatore Centrale)
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingMembers, setEditingMembers] = useState<string[]>([]);
  const [editingGroupName, setEditingGroupName] = useState('');

  const timerRef = useRef<any>(null);
  const isHoldingPttRef = useRef(false);
  const isHoldingEmergRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activeEmergPointerIdRef = useRef<number | null>(null);
  const pttButtonRef = useRef<HTMLButtonElement | null>(null);
  const emergButtonRef = useRef<HTMLButtonElement | null>(null);
  const vuBarRef = useRef<HTMLDivElement | null>(null);

  const onPttStartRef = useRef(onPttStart);
  const onPttStopRef = useRef(onPttStop);
  const onEmergencyPttStartRef = useRef(onEmergencyPttStart);
  const onEmergencyPttStopRef = useRef(onEmergencyPttStop);
  const onCancelEmergencyTxRef = useRef(onCancelEmergencyTx);
  const emergencyPhaseRef = useRef(emergencyPhase);
  onPttStartRef.current = onPttStart;
  onPttStopRef.current = onPttStop;
  onEmergencyPttStartRef.current = onEmergencyPttStart;
  onEmergencyPttStopRef.current = onEmergencyPttStop;
  onCancelEmergencyTxRef.current = onCancelEmergencyTx;
  emergencyPhaseRef.current = emergencyPhase;

  const [codecInfo, setCodecInfo] = useState<{ txCodec: string; rxCodec: string | null }>({
    txCodec: vhfRadioEngine.getActiveTxCodec(),
    rxCodec: vhfRadioEngine.getLastRxCodec(),
  });

  const isAdmin = ruoloContext === 'admin';

  // Gruppi visibili a questo utente (Centrale vede tutti, Volontario SOLO i gruppi in cui è membro permanente)
  const visibleGroups = useMemo(() => {
    if (!Array.isArray(radioGroups)) return [];
    if (isAdmin) return radioGroups;
    if (!currentVolontarioId) return [];
    return radioGroups.filter((g) => Array.isArray(g.memberIds) && g.memberIds.includes(currentVolontarioId));
  }, [radioGroups, isAdmin, currentVolontarioId]);

  // Volontari selezionabili come membri nei gruppi
  const selectableVolunteers = useMemo(() => {
    return (volontariList || []).filter((v) => v && v.id && v.id !== 'vol-admin');
  }, [volontariList]);

  const activeGroup = useMemo(
    () => (selectedChannelId !== 'general' ? visibleGroups.find((g) => g.id === selectedChannelId) || null : null),
    [visibleGroups, selectedChannelId]
  );

  // Se il gruppo selezionato è stato eliminato o l'utente rimosso, torna al canale generale
  useEffect(() => {
    if (selectedChannelId !== 'general' && !activeGroup) {
      onSelectChannel('general');
    }
  }, [selectedChannelId, activeGroup, onSelectChannel]);

  const channelEnabled = activeGroup ? Boolean(activeGroup.enabled) : Boolean(radioPttState.enabled);
  const activeSpeaker =
    radioPttState.activeSpeaker?.isEmergency
      ? radioPttState.activeSpeaker
      : activeGroup
      ? activeGroup.activeSpeaker
      : radioPttState.activeSpeaker;

  const isRemoteSpeaking = Boolean(activeSpeaker && activeSpeaker.speakerId !== localSpeakerId);
  const canPreemptRemote = isAdmin && isRemoteSpeaking && !isLocalEmergencyTransmitting;
  const pttBlockedForUser = !channelEnabled || (isRemoteSpeaking && !isAdmin);

  const stopHoldingPtt = (notifyStop: boolean = true) => {
    const pointerId = activePointerIdRef.current;
    activePointerIdRef.current = null;
    if (pointerId !== null && pttButtonRef.current) {
      try {
        if (pttButtonRef.current.hasPointerCapture(pointerId)) {
          pttButtonRef.current.releasePointerCapture(pointerId);
        }
      } catch {}
    }
    if (isHoldingPttRef.current) {
      isHoldingPttRef.current = false;
      if (notifyStop) {
        onPttStopRef.current();
      }
    }
  };

  const stopHoldingEmergencyPtt = (notifyStop: boolean = true) => {
    const pointerId = activeEmergPointerIdRef.current;
    activeEmergPointerIdRef.current = null;
    if (pointerId !== null && emergButtonRef.current) {
      try {
        if (emergButtonRef.current.hasPointerCapture(pointerId)) {
          emergButtonRef.current.releasePointerCapture(pointerId);
        }
      } catch {}
    }
    if (isHoldingEmergRef.current) {
      isHoldingEmergRef.current = false;
      if (notifyStop) {
        onEmergencyPttStopRef.current?.();
      }
    }
  };

  useEffect(() => {
    const handleWindowPointerUp = (ev: PointerEvent) => {
      if (isHoldingPttRef.current && (activePointerIdRef.current === null || ev.pointerId === activePointerIdRef.current)) {
        stopHoldingPtt(true);
      }
      if (
        isHoldingEmergRef.current &&
        (activeEmergPointerIdRef.current === null || ev.pointerId === activeEmergPointerIdRef.current)
      ) {
        stopHoldingEmergencyPtt(true);
      }
    };

    const handleWindowTouchEnd = (ev: TouchEvent) => {
      if (ev.touches && ev.touches.length > 0) return;
      if (isHoldingPttRef.current) stopHoldingPtt(true);
      if (isHoldingEmergRef.current) stopHoldingEmergencyPtt(true);
    };

    const handleWindowBlur = () => {
      if (isHoldingPttRef.current) stopHoldingPtt(true);
      if (isHoldingEmergRef.current) stopHoldingEmergencyPtt(true);
    };

    window.addEventListener('pointerup', handleWindowPointerUp, true);
    window.addEventListener('pointercancel', handleWindowPointerUp, true);
    window.addEventListener('touchend', handleWindowTouchEnd, true);
    window.addEventListener('touchcancel', handleWindowTouchEnd, true);
    window.addEventListener('blur', handleWindowBlur);

    const unsubVu = vhfRadioEngine.subscribeTxLevel((lvl) => {
      if (vuBarRef.current) {
        vuBarRef.current.style.width = `${Math.max(10, lvl)}%`;
      }
    });
    const unsubCodec = vhfRadioEngine.subscribeCodecInfo((info) => {
      setCodecInfo(info);
    });

    return () => {
      unsubVu();
      unsubCodec();
      window.removeEventListener('pointerup', handleWindowPointerUp, true);
      window.removeEventListener('pointercancel', handleWindowPointerUp, true);
      window.removeEventListener('touchend', handleWindowTouchEnd, true);
      window.removeEventListener('touchcancel', handleWindowTouchEnd, true);
      window.removeEventListener('blur', handleWindowBlur);
      if (timerRef.current) clearInterval(timerRef.current);
      vhfRadioEngine.cancelAudioMessageRecording();
      if (isHoldingPttRef.current) {
        isHoldingPttRef.current = false;
        activePointerIdRef.current = null;
        onPttStopRef.current();
      }
      if (isHoldingEmergRef.current) {
        isHoldingEmergRef.current = false;
        activeEmergPointerIdRef.current = null;
        onEmergencyPttStopRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    if (pttBlockedForUser && isHoldingPttRef.current) {
      stopHoldingPtt(true);
    }
  }, [pttBlockedForUser]);

  useEffect(() => {
    if (!isRecordingClip) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRecordingSec((prev) => {
        const next = prev + 1;
        if (next >= 45) {
          handleStopAndSendRecording();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecordingClip]);

  const handleStartRecording = async () => {
    setRecordingError(null);
    await vhfRadioEngine.unlockAudio();
    const ok = await vhfRadioEngine.startAudioMessageRecording((msg) => {
      setRecordingError(msg);
    });
    if (ok) {
      setRecordingSec(0);
      setIsRecordingClip(true);
    }
  };

  const handleCancelRecording = () => {
    vhfRadioEngine.cancelAudioMessageRecording();
    setIsRecordingClip(false);
    setRecordingSec(0);
  };

  const handleStopAndSendRecording = async () => {
    if (isSendingClip) return;
    setIsSendingClip(true);
    setIsRecordingClip(false);
    const clip = await vhfRadioEngine.stopAndExportAudioMessage();
    setRecordingSec(0);
    setIsSendingClip(false);
    if (clip && clip.dataUrl) {
      onSendAudioMessage(clip);
    } else {
      setRecordingError('Registrazione troppo breve o non valida.');
    }
  };

  const handlePointerDownPtt = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (pttBlockedForUser) return;
    if (isHoldingPttRef.current) return;

    activePointerIdRef.current = e.pointerId;
    isHoldingPttRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    onPttStartRef.current();
  };

  const handlePointerEndPtt = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }
    stopHoldingPtt(true);
  };

  const handlePointerDownEmerg = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isAdmin) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Se è già in corso un'emergenza locale (es. click in vivavoce), un secondo tocco termina TX
    if (emergencyPhaseRef.current !== 'idle') {
      isHoldingEmergRef.current = false;
      activeEmergPointerIdRef.current = null;
      onCancelEmergencyTxRef.current?.();
      return;
    }

    if (isHoldingEmergRef.current) return;

    activeEmergPointerIdRef.current = e.pointerId;
    isHoldingEmergRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    onEmergencyPttStartRef.current?.();
  };

  const handlePointerEndEmerg = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeEmergPointerIdRef.current !== null && e.pointerId !== activeEmergPointerIdRef.current) {
      return;
    }
    stopHoldingEmergencyPtt(true);
  };

  const formatTimer = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const toggleMemberInList = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleCreateGroupSubmit = () => {
    const clean = newGroupName.trim();
    if (!clean || !onCreateGroup) return;
    if (radioGroups.some((g) => g.name.trim().toLowerCase() === clean.toLowerCase())) {
      setRecordingError(`Esiste già un gruppo radio con il nome "${clean}".`);
      return;
    }
    setRecordingError(null);
    onCreateGroup(clean, newGroupMembers);
    setNewGroupName('');
    setNewGroupMembers([]);
  };

  const handleSaveGroupMembers = (groupId: string) => {
    if (!onUpdateGroupMembers) return;
    onUpdateGroupMembers(groupId, editingMembers, editingGroupName.trim() || undefined);
    setEditingGroupId(null);
  };

  return (
    <div className="mt-2.5 space-y-2.5">
      {/* Banner Allerta EMERGENZA Radio Attiva */}
      {radioEmergency.active && (
        <div className="rounded-xl border-2 border-red-400 bg-gradient-to-r from-red-900 via-red-800 to-red-900 p-2.5 shadow-lg flex items-center justify-between gap-2 animate-pulse">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wider text-white">
                🚨 EMERGENZA RADIO CENTRALE • PRIORITÀ ASSOLUTA TUTTI I CANALI
              </div>
              <div className="text-[10px] font-bold text-red-100 truncate">
                {radioEmergency.message || `Attivata da ${radioEmergency.triggeredBy || 'Operatore Centrale'}`}
              </div>
            </div>
          </div>
          {isAdmin && onClearEmergency && (
            <button
              type="button"
              onClick={onClearEmergency}
              className="px-2.5 py-1 rounded-lg bg-black/50 hover:bg-black/70 text-white text-[10px] font-black uppercase border border-red-300/40 shrink-0 cursor-pointer"
            >
              Termina Emergenza
            </button>
          )}
        </div>
      )}

      {/* Selettore Canale: Generale (Tutti) + Gruppi Radio Permanenti Isolati */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onSelectChannel('general')}
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 border transition-all cursor-pointer ${
            selectedChannelId === 'general'
              ? 'bg-emerald-600/90 text-white border-emerald-400 shadow-md'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              radioPttState.activeSpeaker
                ? 'bg-red-400 animate-ping'
                : radioPttState.enabled
                ? 'bg-emerald-300'
                : 'bg-slate-500'
            }`}
          />
          <span>📡 Generale (Tutti)</span>
        </button>

        {visibleGroups.map((grp) => {
          const isSelected = selectedChannelId === grp.id;
          return (
            <button
              key={grp.id}
              type="button"
              onClick={() => onSelectChannel(grp.id)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-300 shadow-md'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
              title={`Gruppo privato isolato "${grp.name}" (${grp.memberIds.length} membri)`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  grp.activeSpeaker
                    ? 'bg-red-400 animate-ping'
                    : grp.enabled
                    ? 'bg-emerald-400'
                    : 'bg-slate-500'
                }`}
              />
              <Lock className="w-3 h-3 opacity-80" />
              <span className="truncate max-w-[130px]">{grp.name}</span>
              <span className="text-[9px] px-1 rounded bg-black/30 font-mono">
                {grp.memberIds.length}
              </span>
            </button>
          );
        })}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowGroupManager((v) => !v)}
            className={`ml-auto px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 border transition-all cursor-pointer ${
              showGroupManager
                ? 'bg-indigo-700 text-white border-indigo-400'
                : 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-indigo-500/40'
            }`}
            title="Crea e gestisci gruppi radio permanenti con isolamento audio"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gruppi ({radioGroups.length})</span>
          </button>
        )}
      </div>

      {/* Pannello Gestione Gruppi Radio Permanenti (SOLO Operatore Centrale) */}
      {isAdmin && showGroupManager && (
        <div className="rounded-2xl border border-indigo-500/40 bg-slate-950/95 p-3 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-300">
              <Settings2 className="w-4 h-4" />
              <span>Gestione Gruppi Radio Permanenti (Isolamento Canale)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowGroupManager(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Crea nuovo gruppo permanente */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="text-[10px] font-bold uppercase text-slate-300">
              Nuovo Gruppo Radio Permanente
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nome gruppo (es. Squadra Alfa, Antincendio, Eventi)..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleCreateGroupSubmit}
                disabled={!newGroupName.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black uppercase flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crea</span>
              </button>
            </div>
            <div className="text-[10px] text-slate-400">
              Seleziona i membri permanenti ({newGroupMembers.length} selezionati):
            </div>
            <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              {selectableVolunteers.map((v) => {
                const picked = newGroupMembers.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setNewGroupMembers((prev) => toggleMemberInList(prev, v.id))}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer ${
                      picked
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {picked && <Check className="w-3 h-3" />}
                    <span>
                      {v.nome} {v.cognome}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista gruppi permanenti esistenti */}
          {radioGroups.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {radioGroups.map((grp) => {
                const isEditing = editingGroupId === grp.id;
                return (
                  <div
                    key={grp.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{grp.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                              grp.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {grp.enabled ? 'ACCESO' : 'SPENTO'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Membri permanenti ({grp.memberIds.length}):{' '}
                          {grp.memberIds.length === 0
                            ? 'Nessuno (aggiungi membri)'
                            : grp.memberIds
                                .map((id) => {
                                  const v = selectableVolunteers.find((x) => x.id === id);
                                  return v ? `${v.nome} ${v.cognome}` : id;
                                })
                                .join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onToggleGroupLive && (
                          <button
                            type="button"
                            onClick={() => onToggleGroupLive(grp.id, !grp.enabled)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 border cursor-pointer ${
                              grp.enabled
                                ? 'bg-red-600 hover:bg-red-500 text-white border-red-400/50'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{grp.enabled ? 'Spegni' : 'Accendi'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) {
                              setEditingGroupId(null);
                            } else {
                              setEditingGroupId(grp.id);
                              setEditingMembers([...(grp.memberIds || [])]);
                              setEditingGroupName(grp.name);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          {isEditing ? 'Chiudi' : 'Membri'}
                        </button>
                        {onDeleteGroup && (
                          <button
                            type="button"
                            onClick={() => onDeleteGroup(grp.id)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-red-700 text-red-400 hover:text-white cursor-pointer"
                            title="Elimina gruppo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <input
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                          placeholder="Nome gruppo"
                        />
                        <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                          {selectableVolunteers.map((v) => {
                            const picked = editingMembers.includes(v.id);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setEditingMembers((prev) => toggleMemberInList(prev, v.id))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer ${
                                  picked
                                    ? 'bg-emerald-600 text-white border-emerald-400'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {picked && <Check className="w-3 h-3" />}
                                <span>
                                  {v.nome} {v.cognome}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingGroupId(null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveGroupMembers(grp.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase cursor-pointer"
                          >
                            Salva Membri Permanenti
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ricetrasmittente VHF/UHF Push-To-Talk Diretta */}
      <div
        className={`rounded-2xl border p-2.5 sm:p-3 shadow-inner transition-all ${
          isLocalEmergencyTransmitting || activeSpeaker?.isEmergency
            ? 'bg-red-950/85 border-red-400 ring-2 ring-red-500/60'
            : isLocalTransmitting
            ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500/40'
            : isRemoteSpeaking
            ? activeSpeaker?.isCentralePriority
              ? 'bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/40'
              : 'bg-emerald-950/40 border-emerald-500/70'
            : channelEnabled
            ? activeGroup
              ? 'bg-indigo-950/40 border-indigo-500/60'
              : 'bg-slate-950/90 border-slate-700'
            : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        {/* Header Frequenza VHF/UHF + Pulsante Attivazione Centrale (Generale o Gruppo) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isLocalTransmitting || isLocalEmergencyTransmitting
                  ? 'bg-red-500 animate-ping'
                  : isRemoteSpeaking
                  ? 'bg-emerald-400 animate-ping'
                  : channelEnabled
                  ? 'bg-emerald-500'
                  : 'bg-slate-600'
              }`}
            />
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5 flex-wrap">
                <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {activeGroup
                    ? `GRUPPO ISOLATO: ${activeGroup.name}`
                    : 'RADIO PORTATILE VHF/UHF • DIRETTA LIVE'}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                    channelEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {channelEnabled ? 'CANALE APERTO' : 'DISATTIVATA'}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border bg-sky-500/15 text-sky-300 border-sky-500/40"
                  title="Codec audio HD attivo per la trasmissione e ricezione radio"
                >
                  {(isLocalTransmitting || isLocalEmergencyTransmitting
                    ? codecInfo.txCodec === 'opus'
                    : isRemoteSpeaking
                    ? codecInfo.rxCodec === 'opus'
                    : false)
                    ? 'OPUS 48kHz HD'
                    : 'HD-ADPCM 24kHz'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {activeSpeaker ? (
                  isLocalEmergencyTransmitting ? (
                    emergencyPhase === 'announcing' ? (
                      <span className="text-amber-200 font-black">
                        ⏳ ATTENDI ANNUNCIO VOCALE ({Math.max(0, emergencyCountdownSec).toFixed(1)}s) — NON PARLARE ANCORA
                      </span>
                    ) : (
                      <span className="text-emerald-300 font-black">
                        🟢 ORA PUOI PARLARE! ({isEmergencyLatched ? 'Clicca TERMINA TX quando hai finito' : 'Rilascia per terminare'})
                      </span>
                    )
                  ) : isLocalTransmitting ? (
                    <span className="text-red-300 font-bold">
                      TX IN CORSO ({speakerName})
                      {activeGroup ? ` • Solo membri "${activeGroup.name}"` : ''} • Rilascia per terminare
                    </span>
                  ) : (
                    <span
                      className={
                        activeSpeaker.isEmergency
                          ? 'text-red-300 font-black'
                          : activeSpeaker.isCentralePriority
                          ? 'text-amber-300 font-bold'
                          : 'text-emerald-300 font-bold'
                      }
                    >
                      {activeSpeaker.isEmergency
                        ? '🚨 EMERGENZA CENTRALE: '
                        : activeSpeaker.isCentralePriority
                        ? '⚡ PRIORITÀ CENTRALE: '
                        : '🔊 IN ASCOLTO RX: '}
                      {activeSpeaker.speakerName}
                      {activeGroup && !activeSpeaker.isEmergency ? ` (Gruppo ${activeGroup.name})` : ''} sta parlando
                    </span>
                  )
                ) : channelEnabled ? (
                  <span className="text-emerald-400/90">
                    {activeGroup
                      ? `Canale privato aperto (${activeGroup.memberIds.length} membri autorizzati • isolamento attivo)`
                      : `Canale libero • Attivato da ${radioPttState.toggledBy || 'Centrale Operativa'}`}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    {activeGroup
                      ? `Canale "${activeGroup.name}" spento (attivazione esclusiva Operatore Centrale)`
                      : 'Funzione parlante diretta disattivata (attivazione esclusiva Operatore Centrale)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                if (activeGroup && onToggleGroupLive) {
                  onToggleGroupLive(activeGroup.id, !activeGroup.enabled);
                } else {
                  onToggleLiveEnabled(!radioPttState.enabled);
                }
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border ${
                channelEnabled
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-400/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {activeGroup
                  ? activeGroup.enabled
                    ? 'Spegni Gruppo'
                    : 'Accendi Gruppo'
                  : radioPttState.enabled
                  ? 'Disattiva Radio Live'
                  : 'Attiva Radio Live'}
              </span>
            </button>
          ) : (
            <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Gestione Centrale</span>
            </span>
          )}
        </div>

        {/* Barra VU Meter modulazione durante TX / RX */}
        <div className="mt-2 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          {(isLocalTransmitting || isLocalEmergencyTransmitting || isRemoteSpeaking) && (
            <div
              ref={vuBarRef}
              className={`h-full transition-all duration-75 ${
                isLocalTransmitting || isLocalEmergencyTransmitting
                  ? 'w-[14%] bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500'
                  : activeSpeaker?.isEmergency
                  ? 'w-full bg-red-500 animate-pulse'
                  : activeSpeaker?.isCentralePriority
                  ? 'w-full bg-amber-400 animate-pulse'
                  : 'w-full bg-emerald-400 animate-pulse'
              }`}
            />
          )}
        </div>

        {/* Controllo Walkie-Talkie Background (stile Zello / BTtalk: schermo spento + Push) */}
        {onToggleBgRadio && (
          <div className="mt-2.5 rounded-xl bg-slate-900/90 border border-slate-800 px-2.5 py-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    bgRadioArmed && bgPushSubscribed
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]'
                      : bgRadioArmed
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-wide text-slate-100 truncate">
                    {bgRadioArmed && bgPushSubscribed
                      ? 'Walkie-Talkie Background: ATTIVO'
                      : bgRadioArmed
                      ? 'Audio Schermo Spento ATTIVO • Abilita Push'
                      : 'Walkie-Talkie Background: NON ATTIVO'}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {bgRadioArmed && bgPushSubscribed
                      ? 'Ascolto live a schermo spento/app ridotta; se chiudi l’app ricevi Push ad alta priorità con replay immediato.'
                      : 'Tocca ATTIVA ORA per ricevere Emergenza, Tutti e Gruppi anche a schermo spento o app in background.'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {bgPushSubscribed && onTestPushRadio && (
                  <button
                    type="button"
                    onClick={onTestPushRadio}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 cursor-pointer"
                  >
                    Test Push
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleBgRadio}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer border transition-colors ${
                    bgRadioArmed && bgPushSubscribed
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  }`}
                >
                  {bgRadioArmed && bgPushSubscribed ? '✓ Attivo' : 'Attiva Ora'}
                </button>
              </div>
            </div>
            {bgInIframe && !bgPushSubscribed && (
              <div className="text-[10px] text-amber-300/90 leading-snug">
                Per la ricezione a schermo spento su smartphone apri l&apos;app dal link diretto (www.croceoro.org) o installata su Home.
              </div>
            )}
            {!bgInIframe && bgPermission === 'denied' && (
              <div className="text-[10px] text-red-300 leading-snug">
                Notifiche bloccate sul browser: sbloccale dalle impostazioni del sito per ricevere Push quando l&apos;app è chiusa.
              </div>
            )}
          </div>
        )}

        {/* Banner Guida Operatore Emergenza: ATTENDI annuncio vs ORA PUOI PARLARE */}
        {isAdmin && emergencyPhase !== 'idle' && (
          <div
            className={`mt-2.5 rounded-xl border-2 p-2.5 shadow-lg flex items-center justify-between gap-2 transition-all ${
              emergencyPhase === 'announcing'
                ? 'bg-amber-950/90 border-amber-400 text-amber-100 animate-pulse'
                : 'bg-emerald-950/95 border-emerald-400 text-emerald-50 ring-2 ring-emerald-400/50'
            }`}
          >
            <div className="min-w-0">
              {emergencyPhase === 'announcing' ? (
                <>
                  <div className="text-xs font-black uppercase tracking-wide text-amber-300">
                    ⏳ ATTENDI FINE MESSAGGIO ({Math.max(0, emergencyCountdownSec).toFixed(1)}s) — NON PARLARE ANCORA
                  </div>
                  <div className="text-[11px] font-bold text-amber-100/95 mt-0.5">
                    In riproduzione a tutti i terminali: &laquo;ATTENZIONE CHIAMATA EMERGENZA IN ARRIVO&raquo;. Attendi il segnale acustico verde...
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wide text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>🟢 VIA LIBERA! ORA PUOI PARLARE IN EMERGENZA!</span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-100 mt-0.5">
                    {isEmergencyLatched
                      ? 'Microfono aperto verso tutti i canali e gruppi. Premi TERMINA TX o EMERGENZA al termine.'
                      : 'Microfono aperto verso tutti i canali e gruppi. Rilascia il pulsante quando hai terminato.'}
                  </div>
                </>
              )}
            </div>
            {(isEmergencyLatched || emergencyPhase === 'announcing') && onCancelEmergencyTx && (
              <button
                type="button"
                onClick={onCancelEmergencyTx}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase shrink-0 border shadow cursor-pointer ${
                  emergencyPhase === 'announcing'
                    ? 'bg-slate-900 hover:bg-slate-800 text-amber-200 border-amber-400/60'
                    : 'bg-red-600 hover:bg-red-500 text-white border-red-300 animate-pulse'
                }`}
              >
                {emergencyPhase === 'announcing' ? 'Annulla' : '⏹️ Termina TX'}
              </button>
            )}
          </div>
        )}

        {/* Pulsante PTT Hold-To-Talk + Pulsante EMERGENZA (solo Operatore di Centrale) */}
        <div className="mt-2.5 flex items-stretch gap-2">
          <button
            ref={pttButtonRef}
            type="button"
            disabled={pttBlockedForUser || emergencyPhase !== 'idle'}
            draggable={false}
            onPointerDown={handlePointerDownPtt}
            onPointerUp={handlePointerEndPtt}
            onPointerCancel={handlePointerEndPtt}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`flex-1 select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none] [&>*]:pointer-events-none ${
              compact ? 'py-2.5 px-3' : 'py-3 px-4'
            } rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg transition-colors border-2 ${
              isLocalTransmitting && !isLocalEmergencyTransmitting
                ? 'bg-red-600 text-white border-red-300 ring-4 ring-red-500/40'
                : pttBlockedForUser || emergencyPhase !== 'idle'
                ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-75'
                : canPreemptRemote
                ? 'bg-gradient-to-r from-amber-500 via-red-600 to-amber-500 hover:brightness-110 text-white border-amber-300 cursor-pointer'
                : activeGroup
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-indigo-300/60 cursor-pointer'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-300/60 cursor-pointer'
            }`}
          >
            {isLocalTransmitting && !isLocalEmergencyTransmitting ? (
              <>
                <Mic className="w-4 h-4 animate-pulse" />
                <span>🔴 TX ATTIVA — RILASCIA PER TERMINARE</span>
              </>
            ) : !channelEnabled ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>PTT BLOCCATO • IN ATTESA CENTRALE</span>
              </>
            ) : isRemoteSpeaking && !isAdmin ? (
              <>
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span>OCCUPATO DA {activeSpeaker?.speakerName?.toUpperCase()}</span>
              </>
            ) : canPreemptRemote ? (
              <>
                <ShieldAlert className="w-4 h-4 animate-bounce" />
                <span>⚡ TIENI PREMUTO PTT • PRIORITÀ CENTRALE</span>
              </>
            ) : activeGroup ? (
              <>
                <Lock className="w-4 h-4" />
                <span>🎙️ TIENI PREMUTO PTT • GRUPPO "{activeGroup.name}"</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                <span>🎙️ TIENI PREMUTO PTT PER PARLARE IN DIRETTA</span>
              </>
            )}
          </button>

          {/* Pulsante EMERGENZA utilizzabile ESCLUSIVAMENTE dagli Operatori di Centrale */}
          {isAdmin && onEmergencyPttStart && (
            <button
              ref={emergButtonRef}
              type="button"
              draggable={false}
              onPointerDown={handlePointerDownEmerg}
              onPointerUp={handlePointerEndEmerg}
              onPointerCancel={handlePointerEndEmerg}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="Pulsante EMERGENZA (solo Operatori di Centrale): clicca o tieni premuto per inviare l'annuncio vocale «ATTENZIONE CHIAMATA EMERGENZA IN ARRIVO» su tutti i canali e poi parlare al segnale acustico verde"
              className={`select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none] [&>*]:pointer-events-none px-3 sm:px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xl border-2 cursor-pointer transition-all shrink-0 ${
                emergencyPhase === 'announcing'
                  ? 'bg-gradient-to-b from-amber-500 to-red-700 text-white border-amber-300 ring-4 ring-amber-400/60 animate-pulse'
                  : emergencyPhase === 'live'
                  ? 'bg-gradient-to-b from-emerald-600 to-red-700 text-white border-emerald-300 ring-4 ring-emerald-400/70'
                  : 'bg-gradient-to-b from-red-600 to-rose-800 hover:from-red-500 hover:to-rose-700 text-white border-red-300/70'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  emergencyPhase === 'live' ? 'text-emerald-300 animate-ping' : 'text-amber-300'
                }`}
              />
              <span>
                {emergencyPhase === 'announcing'
                  ? `ATTENDI (${Math.max(0, emergencyCountdownSec).toFixed(1)}s)`
                  : emergencyPhase === 'live'
                  ? isEmergencyLatched
                    ? 'PARLA ORA • TERMINA TX'
                    : 'PARLA ORA (TX)'
                  : 'EMERGENZA'}
              </span>
            </button>
          )}
        </div>

        {(pttStatusMsg || recordingError) && (
          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-200 text-[11px] font-semibold">
            {recordingError || pttStatusMsg}
          </div>
        )}
      </div>

      {/* Riga Messaggio Testuale + Messaggio Audio Vocale */}
      {isRecordingClip ? (
        <div className="flex items-center justify-between gap-2 bg-red-950/70 border border-red-500/60 rounded-xl p-2 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-xs font-black text-red-200 font-mono">
              REGISTRAZIONE VOCALE {formatTimer(recordingSec)} / 00:45
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCancelRecording}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Annulla registrazione vocale"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Annulla</span>
            </button>
            <button
              type="button"
              onClick={handleStopAndSendRecording}
              disabled={isSendingClip}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-md"
              title="Termina e invia il messaggio audio nelle notifiche radio"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Invia Audio</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={messaggioInput}
            onChange={(e) => onChangeMessaggioInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSendText()}
            placeholder={
              activeGroup
                ? `Scrivi al gruppo "${activeGroup.name}" (isolato)...`
                : compact
                ? 'Scrivi comunicazione radio o registra vocale...'
                : `Scrivi messaggio radio (${isAdmin ? 'Come Centrale' : 'Come Bordo Mezzo'})...`
            }
            className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500 min-w-0"
          />
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={isSendingClip}
            className="px-3 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
            title="Registra e invia un messaggio audio asincrono nelle notifiche radio"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Vocale</span>
          </button>
          <button
            type="button"
            onClick={onSendText}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Trasmetti</span>
          </button>
        </div>
      )}
    </div>
  );
};
