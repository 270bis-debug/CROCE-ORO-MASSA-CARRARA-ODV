import React, { useEffect, useMemo, useState } from 'react';
import {
  Smartphone,
  Monitor,
  RefreshCw,
  RotateCw,
  Wifi,
  Signal,
  BatteryFull,
  Globe,
  AppWindow,
  Lock,
  ChevronLeft,
  ChevronRight,
  Circle,
  Square,
  Share,
  MoreHorizontal,
  MoreVertical,
  Plus
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import {
  SimulatedBrowserType,
  SimulatedDevicePlatform,
  SimulatedDisplayMode,
  buildDeviceSimulationIframeUrl
} from '../utils/deviceSimulation';
import { formatTimeItaly } from '../utils/italianTime';

interface SimulatoreDispositivoMobileProps {
  account: Volontario;
  device: 'android' | 'apple';
  ruoloSimulato: 'admin' | 'volontario';
  displayMode: SimulatedDisplayMode;
  onChangeDevice: (device: SimulatedDevicePlatform) => void;
  onChangeDisplayMode: (mode: SimulatedDisplayMode) => void;
  onExitFromIframe: () => void;
}

const SIMULATED_DISPLAY_HOST = 'croce-oro-massa-carrarra.vercel.app';

const DEVICE_SPECS = {
  android: {
    label: 'Android Smartphone',
    shortLabel: 'Android',
    width: 412,
    height: 860,
    borderRadius: 'rounded-[36px]',
    screenRadius: 'rounded-[24px]',
    bezelBg: 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-slate-600/80',
    accentBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  apple: {
    label: 'Apple iPhone',
    shortLabel: 'Apple iOS',
    width: 393,
    height: 852,
    borderRadius: 'rounded-[50px]',
    screenRadius: 'rounded-[38px]',
    bezelBg: 'bg-gradient-to-b from-zinc-700 via-zinc-900 to-zinc-950 border-zinc-500/80',
    accentBadge: 'bg-sky-500/20 text-sky-200 border-sky-400/40'
  }
} as const;

export const SimulatoreDispositivoMobile: React.FC<SimulatoreDispositivoMobileProps> = ({
  account,
  device,
  ruoloSimulato,
  displayMode,
  onChangeDevice,
  onChangeDisplayMode,
  onExitFromIframe
}) => {
  const [appleBrowser, setAppleBrowser] = useState<SimulatedBrowserType>('safari');
  const [landscape, setLandscape] = useState(false);
  const [autoFit, setAutoFit] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [clockStr, setClockStr] = useState(() => formatTimeItaly().slice(0, 5));
  const [viewportSize, setViewportSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  }));

  useEffect(() => {
    const t = setInterval(() => {
      setClockStr(formatTimeItaly().slice(0, 5));
    }, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ascolta eventuale richiesta di uscita dalla simulazione proveniente dall'iframe (es. tap su "Esci")
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'CROCE_ORO_EXIT_DEVICE_SIMULATION') {
        onExitFromIframe();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onExitFromIframe]);

  const spec = DEVICE_SPECS[device];
  const activeBrowser: SimulatedBrowserType = device === 'apple' ? appleBrowser : 'chrome';
  const isAppleChrome = device === 'apple' && displayMode === 'browser' && activeBrowser === 'chrome';
  const isAppleSafari = device === 'apple' && displayMode === 'browser' && activeBrowser === 'safari';

  const osLabel = useMemo(() => {
    if (device === 'apple') {
      if (displayMode === 'pwa') return 'iOS 18 • App Schermata Home (PWA)';
      return activeBrowser === 'chrome' ? 'iOS 18 • Google Chrome' : 'iOS 18 • Safari';
    }
    return displayMode === 'pwa' ? 'Android 15 • App Installata (PWA)' : 'Android 15 • Google Chrome';
  }, [device, displayMode, activeBrowser]);

  const screenW = landscape ? spec.height : spec.width;
  const screenH = landscape ? spec.width : spec.height;

  // Dimensioni esterne cornice hardware (inclusi status bar / address bar / browser bottom bar / nav bar / bordi)
  const appleBrowserBottomBarH = device === 'apple' && displayMode === 'browser' ? 36 : 0;
  const chromeOverheadH =
    (device === 'apple' ? 42 : 34) +
    (displayMode === 'browser' ? 42 : 0) +
    appleBrowserBottomBarH +
    (device === 'apple' ? 24 : 36) +
    28;
  const totalFrameW = screenW + 24;
  const totalFrameH = screenH + chromeOverheadH;

  // Scala automatica per far rientrare interamente lo smartphone sullo schermo del PC/laptop
  const scale = useMemo(() => {
    if (!autoFit) return 1;
    const availW = Math.max(320, viewportSize.w - 40);
    const availH = Math.max(420, viewportSize.h - 175);
    const scaleW = availW / totalFrameW;
    const scaleH = availH / totalFrameH;
    return Math.min(1, Math.max(0.52, Number(Math.min(scaleW, scaleH).toFixed(3))));
  }, [autoFit, viewportSize.w, viewportSize.h, totalFrameW, totalFrameH]);

  const iframeUrl = useMemo(() => {
    const base = buildDeviceSimulationIframeUrl({
      accountId: account.id,
      device,
      ruolo: ruoloSimulato,
      displayMode,
      browser: activeBrowser
    });
    return reloadNonce > 0 ? `${base}&_r=${reloadNonce}` : base;
  }, [account.id, device, ruoloSimulato, displayMode, activeBrowser, reloadNonce]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [iframeUrl]);

  return (
    <div className="flex-1 w-full bg-gradient-to-b from-slate-950 via-[#0d1025] to-slate-950 text-slate-100 flex flex-col items-center px-3 py-3 sm:py-4 overflow-x-hidden">
      {/* Barra Controlli Dispositivo Simulato */}
      <div className="w-full max-w-5xl mb-3 p-2.5 rounded-2xl bg-slate-900/90 border border-indigo-500/35 shadow-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black ${spec.accentBadge}`}>
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>{spec.label}</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-300">
            {osLabel} • <span className="font-mono text-amber-300">{screenW}×{screenH}px</span>
          </span>
          <span className="hidden md:inline text-[10.5px] text-slate-400">
            • Account: <strong className="text-white">{account.nome} {account.cognome}</strong> ({ruoloSimulato === 'admin' ? 'Vista Centrale / DB' : 'Vista Volontario'})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Cambio rapido OS: Android / Apple / PC */}
          <div className="flex items-center bg-slate-950/90 rounded-lg p-0.5 border border-slate-700/80">
            <button
              type="button"
              onClick={() => onChangeDevice('android')}
              className={`px-2 py-1 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                device === 'android'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Simula smartphone Android"
            >
              <span>🤖</span>
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeDevice('apple')}
              className={`px-2 py-1 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                device === 'apple'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Simula Apple iPhone (iOS)"
            >
              <span></span>
              <span>Apple</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeDevice('desktop')}
              className="px-2 py-1 rounded-md text-[10.5px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
              title="Torna alla visualizzazione a schermo pieno"
            >
              <Monitor className="w-3 h-3" />
              <span>PC / Reale</span>
            </button>
          </div>

          {/* Modalità App Installata (PWA) vs Browser Web Mobile (su Apple: Safari e Google Chrome) */}
          <div className="flex items-center bg-slate-950/90 rounded-lg p-0.5 border border-slate-700/80">
            <button
              type="button"
              onClick={() => onChangeDisplayMode('pwa')}
              className={`px-2 py-1 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                displayMode === 'pwa'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Simula apertura da icona App installata su telefono (tema scuro operativo)"
            >
              <AppWindow className="w-3 h-3" />
              <span>App PWA</span>
            </button>

            {device === 'apple' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAppleBrowser('safari');
                    onChangeDisplayMode('browser');
                  }}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                    isAppleSafari
                      ? 'bg-white text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Simula apertura su iPhone tramite browser Safari iOS"
                >
                  <Globe className="w-3 h-3" />
                  <span>Safari</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAppleBrowser('chrome');
                    onChangeDisplayMode('browser');
                  }}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                    isAppleChrome
                      ? 'bg-sky-100 text-slate-950 shadow ring-1 ring-sky-400/70'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Simula apertura su iPhone tramite Google Chrome iOS"
                >
                  <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-emerald-500 via-amber-400 to-blue-500 shrink-0" />
                  <span>Chrome</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onChangeDisplayMode('browser')}
                className={`px-2 py-1 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === 'browser'
                    ? 'bg-white text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Simula apertura da browser Google Chrome Android (sfondo bianco)"
              >
                <Globe className="w-3 h-3" />
                <span>Chrome</span>
              </button>
            )}
          </div>

          {/* Ruota schermo */}
          <button
            type="button"
            onClick={() => setLandscape((prev) => !prev)}
            className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
              landscape
                ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="Ruota orientamento verticale / orizzontale"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden sm:inline">{landscape ? 'Orizzontale' : 'Verticale'}</span>
          </button>

          {/* Scala Auto / 100% */}
          <button
            type="button"
            onClick={() => setAutoFit((prev) => !prev)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10.5px] font-bold text-slate-200 cursor-pointer"
            title="Alterna adattamento automatico allo schermo e dimensioni reali 1:1"
          >
            {autoFit ? `Scala ${Math.round(scale * 100)}%` : '100%'}
          </button>

          {/* Ricarica preview */}
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
            title="Ricarica anteprima dispositivo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!iframeLoaded ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stage con Cornice Smartphone Realistica scalata esattamente */}
      <div
        className="flex items-start justify-center w-full"
        style={{
          height: `${Math.ceil(totalFrameH * scale) + 12}px`
        }}
      >
        <div
          style={{
            width: `${totalFrameW}px`,
            height: `${totalFrameH}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center'
          }}
          className={`relative p-3 border-[3px] shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col select-none transition-colors ${spec.borderRadius} ${spec.bezelBg}`}
        >
          {/* Tasti laterali decorativi hardware */}
          <div className="hidden sm:block absolute -left-[5px] top-24 w-[3px] h-10 rounded-l bg-slate-500/70" />
          <div className="hidden sm:block absolute -left-[5px] top-38 w-[3px] h-14 rounded-l bg-slate-500/70" />
          <div className="hidden sm:block absolute -right-[5px] top-32 w-[3px] h-16 rounded-r bg-slate-500/70" />

          {/* Display Interno */}
          <div
            className={`relative flex-1 flex flex-col overflow-hidden border border-black/80 ${spec.screenRadius} ${
              displayMode === 'browser' ? 'bg-white' : 'bg-slate-950'
            }`}
          >
            {/* Status Bar Specifica per Apple iOS o Android */}
            {device === 'apple' ? (
              <div
                className={`h-[42px] px-6 flex items-center justify-between text-[12px] font-bold shrink-0 relative ${
                  displayMode === 'browser' ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'
                }`}
              >
                <span className="font-semibold tracking-tight">{clockStr}</span>
                {/* Apple Dynamic Island */}
                <div className="w-[104px] h-[26px] rounded-full bg-black border border-zinc-800 flex items-center justify-end pr-2.5 shadow-inner">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-950 border border-indigo-400/30" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Signal className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black">5G</span>
                  <BatteryFull className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div
                className={`h-[34px] px-4 flex items-center justify-between text-[11px] font-bold shrink-0 relative ${
                  displayMode === 'browser' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{clockStr}</span>
                  <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 font-black">
                    Croce Oro
                  </span>
                </div>
                {/* Punch-hole camera Android */}
                <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-700 shadow-inner" />
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black opacity-80">VoLTE</span>
                  <Wifi className="w-3 h-3" />
                  <Signal className="w-3 h-3" />
                  <span className="text-[10px]">100%</span>
                </div>
              </div>
            )}

            {/* Barra Indirizzo Browser (Safari iOS / Google Chrome iOS / Chrome Android) */}
            {displayMode === 'browser' && (
              isAppleChrome ? (
                /* Barra Omnibox Google Chrome su iOS (con icona Condividi integrata in alto a destra) */
                <div className="h-[42px] px-2.5 bg-white border-b border-slate-200 flex items-center gap-1.5 shrink-0">
                  <div className="flex-1 min-w-0 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-medium flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate flex-1">{SIMULATED_DISPLAY_HOST}</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-emerald-500 via-amber-400 to-blue-500" />
                      Chrome
                    </span>
                    <Share className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  </div>
                </div>
              ) : device === 'apple' ? (
                /* Barra Safari iOS */
                <div className="h-[42px] px-3 bg-slate-100 border-b border-slate-200 flex items-center justify-center shrink-0">
                  <div className="w-full px-3 py-1 rounded-full bg-white border border-slate-300 text-[11px] text-slate-700 font-medium flex items-center justify-center gap-1.5 shadow-inner truncate">
                    <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{SIMULATED_DISPLAY_HOST}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                      Safari
                    </span>
                  </div>
                </div>
              ) : (
                /* Barra Chrome Android */
                <div className="h-[42px] px-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 shrink-0">
                  <div className="flex-1 min-w-0 px-2.5 py-1 rounded-full bg-white border border-slate-300 text-[11px] text-slate-700 font-medium flex items-center gap-1.5 shadow-inner">
                    <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate flex-1">{SIMULATED_DISPLAY_HOST}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                      Chrome
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-slate-600 shrink-0" />
                </div>
              )
            )}

            {/* Iframe Live Interattivo con reale Viewport Mobile */}
            <div className="relative flex-1 w-full bg-slate-950 overflow-hidden">
              {!iframeLoaded && (
                <div className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center gap-2 text-slate-200">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  <span className="text-xs font-bold">
                    Caricamento vista {spec.shortLabel}
                    {displayMode === 'browser'
                      ? activeBrowser === 'chrome'
                        ? ' (Google Chrome)'
                        : ' (Safari)'
                      : ' (App PWA)'}{' '}
                    per {account.nome}...
                  </span>
                </div>
              )}
              <iframe
                key={iframeUrl}
                src={iframeUrl}
                title={`Simulazione ${spec.label} - ${account.nome} ${account.cognome}`}
                onLoad={() => setIframeLoaded(true)}
                className="w-full h-full border-0 block bg-slate-950"
                allow="geolocation; microphone; camera; autoplay"
              />
            </div>

            {/* Barra Inferiore Browser iOS (Safari vs Google Chrome iOS) */}
            {device === 'apple' && displayMode === 'browser' && (
              isAppleChrome ? (
                <div className="h-[36px] px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-600 shrink-0">
                  <ChevronLeft className="w-4 h-4 opacity-50" />
                  <ChevronRight className="w-4 h-4 opacity-40" />
                  <div className="w-6 h-6 rounded-full bg-slate-200/90 flex items-center justify-center text-slate-700">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <div className="w-4 h-4 rounded-[4px] border-[1.5px] border-slate-600 flex items-center justify-center text-[9px] font-black leading-none">
                    1
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-slate-700" />
                </div>
              ) : (
                <div className="h-[36px] px-7 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-blue-600 shrink-0">
                  <ChevronLeft className="w-4 h-4 opacity-45" />
                  <ChevronRight className="w-4 h-4 opacity-35" />
                  <Share className="w-4 h-4 text-blue-600" />
                  <div className="w-4 h-4 rounded-[4px] border-[1.5px] border-blue-600/80 flex items-center justify-center text-[9px] font-bold leading-none">
                    1
                  </div>
                </div>
              )
            )}

            {/* Barra Inferiore OS (Apple Home Indicator vs Android 3-Button Nav) */}
            {device === 'apple' ? (
              <div
                className={`h-[24px] flex items-center justify-center shrink-0 ${
                  displayMode === 'browser' ? 'bg-slate-50' : 'bg-slate-950'
                }`}
              >
                <div
                  className={`w-[130px] h-[5px] rounded-full ${
                    displayMode === 'browser' ? 'bg-slate-900/80' : 'bg-white/80'
                  }`}
                />
              </div>
            ) : (
              <div
                className={`h-[36px] px-12 flex items-center justify-between shrink-0 border-t ${
                  displayMode === 'browser'
                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400'
                }`}
              >
                <ChevronLeft className="w-4 h-4 opacity-80" />
                <Circle className="w-3.5 h-3.5 opacity-80" />
                <Square className="w-3 h-3 opacity-80" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
