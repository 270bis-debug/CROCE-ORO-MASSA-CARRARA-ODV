import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  Smartphone,
  Globe,
  Info,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { usePWAInstall } from '../services/pwaUpdater';
import {
  GUIDA_APP_OFFICIAL_URL,
  scaricaGuidaInstallazionePdf
} from '../utils/pdfGuidaInstallazioneApp';

export const OFFICIAL_APP_URL = GUIDA_APP_OFFICIAL_URL;

type GuidePlatform = 'apple' | 'android';
type GuideBrowser = 'chrome' | 'safari';

interface ModalGuidaInstallazioneAppProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: GuidePlatform;
  initialBrowser?: GuideBrowser;
}

export const ModalGuidaInstallazioneApp: React.FC<ModalGuidaInstallazioneAppProps> = ({
  isOpen,
  onClose,
  initialPlatform,
  initialBrowser
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isChromeIOS, install } = usePWAInstall();

  const [selectedPlatform, setSelectedPlatform] = useState<GuidePlatform>('apple');
  const [selectedBrowser, setSelectedBrowser] = useState<GuideBrowser>('safari');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installingNow, setInstallingNow] = useState(false);

  // Pre-seleziona automaticamente piattaforma e browser correnti (o simulati) all'apertura
  useEffect(() => {
    if (!isOpen) return;

    if (initialPlatform) {
      setSelectedPlatform(initialPlatform);
    } else if (isIOS) {
      setSelectedPlatform('apple');
    } else if (isAndroid) {
      setSelectedPlatform('android');
    } else {
      setSelectedPlatform('apple');
    }

    if (initialBrowser) {
      setSelectedBrowser(initialBrowser);
    } else if (isIOS) {
      setSelectedBrowser(isChromeIOS ? 'chrome' : 'safari');
    } else {
      setSelectedBrowser('chrome');
    }
  }, [isOpen, initialPlatform, initialBrowser, isIOS, isAndroid, isChromeIOS]);

  if (!isOpen) return null;

  const detectedPlatform: GuidePlatform | null = isIOS ? 'apple' : isAndroid ? 'android' : null;
  const detectedBrowser: GuideBrowser | null = isIOS
    ? isChromeIOS
      ? 'chrome'
      : 'safari'
    : isAndroid
    ? 'chrome'
    : null;

  const isCurrentDetectedCombo =
    detectedPlatform === selectedPlatform && detectedBrowser === selectedBrowser;

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(OFFICIAL_APP_URL);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = OFFICIAL_APP_URL;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2600);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleDirectInstall = async () => {
    if (!isInstallable || installingNow) return;
    setInstallingNow(true);
    try {
      const ok = await install();
      if (ok) {
        onClose();
      }
    } finally {
      setInstallingNow(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Guida installazione applicazione Croce Oro"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92vh] rounded-3xl bg-slate-900 border-2 border-amber-500/80 shadow-2xl text-slate-100 flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-gradient-to-r from-[#1a1c4e] via-[#13173a] to-slate-900 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight leading-tight">
                Guida Installazione App
              </h2>
              <p className="text-[11px] text-amber-300 font-semibold leading-snug mt-0.5">
                Apple iPhone / iPad &amp; Android • Google Chrome e Safari
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            aria-label="Chiudi guida installazione"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Box Indirizzo Ufficiale + Copia Link */}
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/35 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                Sito Ufficiale da Aprire sul Telefono
              </span>
              {isInstalled && (
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 rounded-md">
                  Già installata qui
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={OFFICIAL_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sky-300 hover:text-sky-200 font-mono text-[11px] sm:text-xs font-bold truncate transition-colors"
                title={OFFICIAL_APP_URL}
              >
                {OFFICIAL_APP_URL}
              </a>
              <button
                type="button"
                onClick={handleCopyUrl}
                className={`px-3 py-2 rounded-xl font-black text-[11px] uppercase flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                  copiedUrl
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                }`}
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiato</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copia Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Pulsante Installazione Diretta se disponibile sul dispositivo Android/Chrome */}
          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={handleDirectInstall}
              disabled={installingNow}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg border border-emerald-400/50 cursor-pointer active:scale-[0.99] transition-all disabled:opacity-60"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{installingNow ? 'Installazione in corso...' : 'Installa Subito su Questo Dispositivo'}</span>
            </button>
          )}

          {/* Selettore Dispositivo + Browser */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Scelta Dispositivo */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                1. Dispositivo
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('apple')}
                  className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPlatform === 'apple'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span></span>
                  <span>Apple</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform('android')}
                  className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPlatform === 'android'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span>🤖</span>
                  <span>Android</span>
                </button>
              </div>
            </div>

            {/* Scelta Browser */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                2. Browser Usato
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedBrowser('chrome')}
                  className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedBrowser === 'chrome'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>Chrome</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBrowser('safari')}
                  className={`py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedBrowser === 'safari'
                      ? 'bg-indigo-500 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>Safari</span>
                </button>
              </div>
            </div>
          </div>

          {/* Intestazione Procedura Selezionata */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/90">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                <span>
                  {selectedPlatform === 'apple' ? ' Apple iPhone / iPad' : '🤖 Smartphone Android'}
                </span>
                <span className="text-slate-500">•</span>
                <span className={selectedBrowser === 'chrome' ? 'text-amber-300' : 'text-sky-300'}>
                  {selectedBrowser === 'chrome' ? 'Google Chrome' : 'Safari'}
                </span>
              </h3>
              {isCurrentDetectedCombo && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/40 shrink-0">
                  Questo dispositivo
                </span>
              )}
            </div>

            {/* 1. APPLE + SAFARI */}
            {selectedPlatform === 'apple' && selectedBrowser === 'safari' && (
              <ol className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-sky-600/30 text-sky-300 border border-sky-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    1
                  </span>
                  <div>
                    <strong className="text-white block">Apri il sito con Safari</strong>
                    <span className="text-[11px] text-slate-400">
                      Avvia <strong>Safari</strong> su iPhone o iPad e incolla l&apos;indirizzo{' '}
                      <span className="font-mono text-sky-300">croce-oro-massa-carrarra.vercel.app</span>.
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                  <span className="w-6 h-6 rounded-lg bg-sky-600/30 text-sky-300 border border-sky-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    2
                  </span>
                  <div>
                    <strong className="text-white block">Tocca l&apos;icona Condividi in basso</strong>
                    <span className="text-[11px] text-slate-400">
                      Nella barra inferiore di Safari tocca{' '}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                        <Share className="w-3 h-3" /> Condividi
                      </span>{' '}
                      (quadrato con freccia verso l&apos;alto).
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    3
                  </span>
                  <div>
                    <strong className="text-white block">Scegli &quot;Aggiungi alla schermata Home&quot;</strong>
                    <span className="text-[11px] text-slate-400">
                      Scorri le opzioni verso il basso e tocca{' '}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                        <PlusSquare className="w-3 h-3" /> Aggiungi alla schermata Home
                      </span>.
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    4
                  </span>
                  <div>
                    <strong className="text-white block">Conferma con &quot;Aggiungi&quot;</strong>
                    <span className="text-[11px] text-slate-400">
                      Tocca <strong>Aggiungi</strong> in alto a destra: l&apos;icona <strong>Croce Oro</strong> comparirà tra le tue app sulla Home.
                    </span>
                  </div>
                </li>
              </ol>
            )}

            {/* 2. APPLE + GOOGLE CHROME */}
            {selectedPlatform === 'apple' && selectedBrowser === 'chrome' && (
              <div className="space-y-3">
                <ol className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                      1
                    </span>
                    <div>
                      <strong className="text-white block">Apri il sito in Google Chrome su iPhone / iPad</strong>
                      <span className="text-[11px] text-slate-400">
                        Apri <strong>Chrome</strong> e visita{' '}
                        <span className="font-mono text-amber-300">croce-oro-massa-carrarra.vercel.app</span>.
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                      2
                    </span>
                    <div>
                      <strong className="text-white block">Tocca Condividi nella barra indirizzi in alto</strong>
                      <span className="text-[11px] text-slate-400">
                        Tocca l&apos;icona{' '}
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                          <Share className="w-3 h-3" /> Condividi
                        </span>{' '}
                        a destra dell&apos;indirizzo web in alto (o nel menu <strong>•••</strong> in basso a destra su alcuni modelli).
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                      3
                    </span>
                    <div>
                      <strong className="text-white block">Tocca &quot;Aggiungi alla schermata Home&quot;</strong>
                      <span className="text-[11px] text-slate-400">
                        Scorri il menu di condivisione iOS e seleziona{' '}
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                          <PlusSquare className="w-3 h-3" /> Aggiungi alla schermata Home
                        </span>.
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                      4
                    </span>
                    <div>
                      <strong className="text-white block">Conferma con &quot;Aggiungi&quot;</strong>
                      <span className="text-[11px] text-slate-400">
                        Tocca <strong>Aggiungi</strong> in alto a destra. Da questo momento apri l&apos;app sempre dall&apos;icona sulla Home.
                      </span>
                    </div>
                  </li>
                </ol>

                <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/35 flex items-start gap-2 text-[11px] text-sky-200">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>iPhone con iOS meno recente?</strong> Se in Chrome non vedi la voce &quot;Aggiungi alla schermata Home&quot; (richiede iOS 16.4+), copia il link sopra e aprilo con{' '}
                    <button
                      type="button"
                      onClick={() => setSelectedBrowser('safari')}
                      className="underline font-black text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      Safari
                    </button>
                    .
                  </div>
                </div>
              </div>
            )}

            {/* 3. ANDROID + GOOGLE CHROME */}
            {selectedPlatform === 'android' && selectedBrowser === 'chrome' && (
              <ol className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    1
                  </span>
                  <div>
                    <strong className="text-white block">Apri il sito con Google Chrome</strong>
                    <span className="text-[11px] text-slate-400">
                      Avvia <strong>Google Chrome</strong> sul tuo smartphone Android e apri{' '}
                      <span className="font-mono text-emerald-300">croce-oro-massa-carrarra.vercel.app</span>.
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    2
                  </span>
                  <div>
                    <strong className="text-white block">Tocca &quot;Installa App&quot; oppure il menu ⋮</strong>
                    <span className="text-[11px] text-slate-400">
                      Se compare il tasto verde <strong>Installa App</strong> in alto (o il banner in basso), toccalo. Altrimenti tocca i 3 puntini{' '}
                      <span className="inline-flex items-center px-1 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                        <MoreVertical className="w-3 h-3" />
                      </span>{' '}
                      in alto a destra di Chrome.
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    3
                  </span>
                  <div>
                    <strong className="text-white block">Seleziona &quot;Aggiungi a schermata Home&quot; → &quot;Installa&quot;</strong>
                    <span className="text-[11px] text-slate-400">
                      Nel menu di Chrome tocca <strong>&quot;Installa app&quot;</strong> oppure <strong>&quot;Aggiungi a schermata Home&quot;</strong> e scegli <strong>Installa</strong> (non &quot;Crea scorciatoia&quot;).
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5 pt-2 border-t border-slate-900">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 font-black text-[11px]">
                    4
                  </span>
                  <div>
                    <strong className="text-white block">App installata!</strong>
                    <span className="text-[11px] text-slate-400">
                      Attendi qualche secondo: l&apos;icona <strong>Croce Oro</strong> verrà installata tra le tue app Android come un&apos;app nativa.
                    </span>
                  </div>
                </li>
              </ol>
            )}

            {/* 4. ANDROID + SAFARI (Nota chiara + istruzioni alternative) */}
            {selectedPlatform === 'android' && selectedBrowser === 'safari' && (
              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 flex items-start gap-2.5 text-amber-200">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-[11.5px] leading-relaxed">
                    <strong className="text-white block">Safari è disponibile solo su dispositivi Apple</strong>
                    <span>
                      Su smartphone e tablet <strong>Android</strong> il browser Safari non esiste: per installare l&apos;app Croce Oro usa <strong>Google Chrome</strong> (consigliato e già presente su Android) oppure Samsung Internet / Edge.
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-[11.5px] text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-600/30 text-emerald-300 flex items-center justify-center shrink-0 font-black text-[10px]">
                      1
                    </span>
                    <span>
                      Apri <span className="font-mono text-emerald-300">croce-oro-massa-carrarra.vercel.app</span> con <strong>Google Chrome</strong> (o Samsung Internet).
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-600/30 text-emerald-300 flex items-center justify-center shrink-0 font-black text-[10px]">
                      2
                    </span>
                    <span>
                      Apri il menu del browser (<strong>⋮</strong> su Chrome o <strong>☰</strong> su Samsung Internet) e tocca <strong>&quot;Installa app&quot;</strong> o <strong>&quot;Aggiungi a schermata Home&quot;</strong>.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBrowser('chrome')}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Vai alla Guida Android + Google Chrome</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Note finali importanti per tutti gli account */}
          <div className="p-3 rounded-2xl bg-emerald-950/45 border border-emerald-500/35 space-y-2 text-[11px] text-emerald-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Aggiornamenti automatici:</strong> apri sempre l&apos;app dall&apos;icona sulla Home. Non serve scaricarla da App Store o Play Store e si aggiorna da sola ad ogni nuova versione.
              </span>
            </div>
            <div className="flex items-start gap-2 pt-1.5 border-t border-emerald-900/60">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Primo accesso dall&apos;icona:</strong> accedi con il tuo <strong>PIN personale</strong> e consenti <strong>Notifiche</strong>, <strong>Posizione GPS</strong> e <strong>Microfono</strong> per ricevere turni, bacheca e radio senza interruzioni.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scaricaGuidaInstallazionePdf()}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] uppercase inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Scarica la guida completa in formato PDF A4"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Scarica PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wide transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
