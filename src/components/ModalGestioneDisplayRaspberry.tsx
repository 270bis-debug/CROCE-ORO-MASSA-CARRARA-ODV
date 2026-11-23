import React, { useEffect, useMemo, useState } from 'react';
import {
  Monitor,
  Tv,
  X,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Megaphone,
  Building2,
  SlidersHorizontal,
  PlusCircle,
  Pin,
  PinOff,
  Trash2,
  EyeOff,
  Save,
  CheckCircle2,
  Users,
  Terminal,
  RefreshCw,
  Wifi,
  Download,
  FileCode2,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import {
  ComunicazioneBacheca,
  SedeAssociativaCompleta,
  TimbraturaVolontario,
} from '../types/adminTypes';
import {
  RaspberryDisplayConfig,
  buildRaspberryKioskUrl,
  generaContenutoNmConnection,
  generaContenutoWpaSupplicant,
  generaScriptSetupWifiRaspberry,
  isComunicazioneAssociativaCentrale,
  isTimbraturaAttualmentePresente,
  isTimbraturaConUscitaValida,
  matchesComunicazioneSezione,
  matchesSedeTimbratura,
  scaricaFileTestoLinux,
  slugifyNomeSedeFile,
} from '../utils/raspberryDisplayConfig';
import { formatISODateItaly, formatTimeItaly } from '../utils/italianTime';
import { getConfiguredPublicUrl } from '../utils/publicUrl';
import { VistaDisplayRaspberrySezione } from './VistaDisplayRaspberrySezione';

interface ModalGestioneDisplayRaspberryProps {
  isOpen: boolean;
  onClose: () => void;
  sedi: SedeAssociativaCompleta[];
  onAggiornaSedi?: (nuoveSedi: SedeAssociativaCompleta[]) => void;
  comunicazioni: ComunicazioneBacheca[];
  onAggiornaComunicazioni: (
    nuove: ComunicazioneBacheca[],
    opts?: { notifica?: any; deletedId?: string }
  ) => void;
  timbrature: TimbraturaVolontario[];
  config: RaspberryDisplayConfig;
  onSalvaConfig: (nuovaConfig: RaspberryDisplayConfig) => void;
  operatoreCorrente: string;
  operatoreId?: string;
  onRefreshSync?: () => void;
}

type TabGestioneRaspberry = 'schermi' | 'wifi' | 'bacheche' | 'impostazioni';

export const ModalGestioneDisplayRaspberry: React.FC<ModalGestioneDisplayRaspberryProps> = ({
  isOpen,
  onClose,
  sedi,
  onAggiornaSedi,
  comunicazioni,
  onAggiornaComunicazioni,
  timbrature,
  config,
  onSalvaConfig,
  operatoreCorrente,
  operatoreId,
  onRefreshSync,
}) => {
  const [activeTab, setActiveTab] = useState<TabGestioneRaspberry>('schermi');
  const [sezioneAttivaId, setSezioneAttivaId] = useState<string>(
    () => config.sezionePredefinitaId || sedi[0]?.id || ''
  );
  const [anteprimaFullscreenAperta, setAnteprimaFullscreenAperta] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [avvisoOk, setAvvisoOk] = useState<string | null>(null);

  // Stato bozza configurazione display
  const [draftConfig, setDraftConfig] = useState<RaspberryDisplayConfig>(config);

  // Stato form Wi-Fi associativo per la singola sezione selezionata
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSicurezza, setWifiSicurezza] = useState<'WPA-PSK' | 'SAE' | 'NONE'>('WPA-PSK');
  const [wifiCountry, setWifiCountry] = useState('IT');
  const [mostraPasswordWifi, setMostraPasswordWifi] = useState(false);
  const [mostraAnteprimaFileWifi, setMostraAnteprimaFileWifi] = useState(false);

  // Stato form pubblicazione rapida bacheca (Associativa Centrale o Singola Sezione)
  const [destinazionePost, setDestinazionePost] = useState<'tutte' | string>('tutte');
  const [titoloPost, setTitoloPost] = useState('');
  const [contenutoPost, setContenutoPost] = useState('');
  const [prioritaPost, setPrioritaPost] = useState<ComunicazioneBacheca['priorita']>('Importante');
  const [categoriaPost, setCategoriaPost] = useState<ComunicazioneBacheca['categoria']>('Comunicazione Generale');
  const [evidenziataPost, setEvidenziataPost] = useState(true);
  const [confermaEliminaId, setConfermaEliminaId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftConfig(config);
      if (!sezioneAttivaId && sedi.length > 0) {
        setSezioneAttivaId(config.sezionePredefinitaId || sedi[0].id);
      }
    }
  }, [isOpen, config, sedi]);

  const sedeSelezionata = useMemo<SedeAssociativaCompleta | null>(() => {
    return sedi.find((s) => s.id === sezioneAttivaId) || sedi[0] || null;
  }, [sedi, sezioneAttivaId]);

  // Carica credenziali Wi-Fi salvate quando cambia la sezione selezionata
  useEffect(() => {
    if (!sedeSelezionata) return;
    setWifiSsid(sedeSelezionata.wifiSsid || '');
    setWifiPassword(sedeSelezionata.wifiPassword || '');
    setWifiSicurezza(sedeSelezionata.wifiSicurezza || 'WPA-PSK');
    setWifiCountry(sedeSelezionata.wifiCountry || 'IT');
    setMostraPasswordWifi(false);
  }, [sedeSelezionata?.id, sedeSelezionata?.wifiSsid, sedeSelezionata?.wifiPassword, sedeSelezionata?.wifiSicurezza, sedeSelezionata?.wifiCountry]);

  const basePublicUrl = useMemo(() => getConfiguredPublicUrl(), []);

  const statsPerSede = useMemo(() => {
    const now = new Date();
    const comCentrale = (comunicazioni || []).filter(
      (c) => c.attiva !== false && isComunicazioneAssociativaCentrale(c)
    ).length;

    return sedi.map((s) => {
      const comSez = (comunicazioni || []).filter(
        (c) => c.attiva !== false && matchesComunicazioneSezione(c, s)
      ).length;
      const presenti = (timbrature || []).filter(
        (t) => isTimbraturaAttualmentePresente(t, now) && matchesSedeTimbratura(t, s)
      ).length;
      const usciti = Math.min(
        10,
        (timbrature || []).filter(
          (t) => isTimbraturaConUscitaValida(t) && matchesSedeTimbratura(t, s)
        ).length
      );
      return {
        sede: s,
        comCentrale,
        comSez,
        presenti,
        usciti,
        hasWifi: Boolean(s.wifiSsid && s.wifiSsid.trim()),
        url: buildRaspberryKioskUrl(basePublicUrl, s.id),
      };
    });
  }, [sedi, comunicazioni, timbrature, basePublicUrl]);

  const comunicazioniCentraleLista = useMemo(
    () =>
      (comunicazioni || [])
        .filter((c) => isComunicazioneAssociativaCentrale(c))
        .sort((a, b) =>
          `${b.dataPubblicazione} ${b.oraPubblicazione}`.localeCompare(
            `${a.dataPubblicazione} ${a.oraPubblicazione}`
          )
        ),
    [comunicazioni]
  );

  const comunicazioniSezioneLista = useMemo(
    () =>
      (comunicazioni || [])
        .filter((c) => matchesComunicazioneSezione(c, sedeSelezionata))
        .sort((a, b) =>
          `${b.dataPubblicazione} ${b.oraPubblicazione}`.localeCompare(
            `${a.dataPubblicazione} ${a.oraPubblicazione}`
          )
        ),
    [comunicazioni, sedeSelezionata]
  );

  if (!isOpen) return null;

  const mostraConferma = (msg: string) => {
    setAvvisoOk(msg);
    window.setTimeout(() => setAvvisoOk(null), 4000);
  };

  const copiaTesto = (key: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const urlSezioneAttiva = buildRaspberryKioskUrl(basePublicUrl, sedeSelezionata?.id);
  const comandoChromiumKiosk = `chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 "${urlSezioneAttiva}"`;

  const salvaCredenzialiWifiSezione = (mostraFeedback = true): boolean => {
    if (!sedeSelezionata) return false;
    const ssidTrim = wifiSsid.trim();
    if (!ssidTrim) return false;

    if (onAggiornaSedi) {
      const aggiornate = sedi.map((s) =>
        s.id === sedeSelezionata.id
          ? {
              ...s,
              wifiSsid: ssidTrim,
              wifiPassword: wifiSicurezza === 'NONE' ? '' : wifiPassword,
              wifiSicurezza,
              wifiCountry: (wifiCountry || 'IT').trim().toUpperCase().slice(0, 2) || 'IT',
            }
          : s
      );
      onAggiornaSedi(aggiornate);
    }
    if (mostraFeedback) {
      mostraConferma(
        `Credenziali Wi-Fi salvate in modo riservato per "${sedeSelezionata.nome}" (mai pubblicate sui link pubblici).`
      );
    }
    return true;
  };

  const handleSalvaWifiForm = (e: React.FormEvent) => {
    e.preventDefault();
    salvaCredenzialiWifiSezione(true);
  };

  const handleScaricaWifiFile = (formato: 'wpa' | 'nmconnection' | 'script') => {
    if (!sedeSelezionata || !wifiSsid.trim()) return;
    // Salva anche le credenziali nella scheda della sezione così restano pronte per rigenerazioni future
    salvaCredenzialiWifiSezione(false);

    const params = {
      ssid: wifiSsid.trim(),
      password: wifiSicurezza === 'NONE' ? '' : wifiPassword,
      sicurezza: wifiSicurezza,
      country: (wifiCountry || 'IT').trim().toUpperCase().slice(0, 2) || 'IT',
      sedeNome: sedeSelezionata.nome,
      kioskUrl: urlSezioneAttiva,
    };
    const slug = slugifyNomeSedeFile(sedeSelezionata.nome);

    if (formato === 'wpa') {
      scaricaFileTestoLinux('wpa_supplicant.conf', generaContenutoWpaSupplicant(params));
      mostraConferma(`File "wpa_supplicant.conf" generato per ${sedeSelezionata.nome}! Copialo nella partizione /boot della microSD del Raspberry.`);
    } else if (formato === 'nmconnection') {
      const fname = `CroceOro-WiFi-${slug}.nmconnection`;
      scaricaFileTestoLinux(fname, generaContenutoNmConnection(params));
      mostraConferma(`Profilo NetworkManager "${fname}" generato per Raspberry Pi OS Bookworm/Trixie!`);
    } else {
      const fname = `setup-wifi-raspberry-${slug}.sh`;
      scaricaFileTestoLinux(fname, generaScriptSetupWifiRaspberry(params));
      mostraConferma(`Script automatico "${fname}" generato! Eseguilo sul Raspberry con: sudo bash ${fname}`);
    }
  };

  const handlePubblicaRapida = (e: React.FormEvent) => {
    e.preventDefault();
    const tit = titoloPost.trim();
    const cont = contenutoPost.trim();
    if (!tit || !cont) return;

    const now = new Date();
    const targetSede =
      destinazionePost === 'tutte' ? null : sedi.find((s) => s.id === destinazionePost) || null;

    const nuova: ComunicazioneBacheca = {
      id: `com-rasp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titolo: tit,
      contenuto: cont,
      sezioneTargetId: targetSede ? targetSede.id : 'tutte',
      sezioneTargetNome: targetSede ? targetSede.nome : 'Tutte le Sezioni (Sede Centrale)',
      priorita: prioritaPost,
      categoria: categoriaPost,
      dataPubblicazione: formatISODateItaly(now),
      oraPubblicazione: formatTimeItaly(now, false),
      autore: operatoreCorrente || 'Direzione Associativa',
      autoreId: operatoreId,
      attiva: true,
      evidenziata: evidenziataPost,
      updatedAt: Date.now(),
    };

    const aggiornata = [nuova, ...comunicazioni];
    onAggiornaComunicazioni(aggiornata, {
      notifica: {
        id: `notif-bacheca-${nuova.id}`,
        tipo: 'nuovo_post',
        postId: nuova.id,
        postTitolo: nuova.titolo,
        messaggio: `📢 Nuova comunicazione (${nuova.sezioneTargetNome}): ${nuova.titolo}`,
        autore: nuova.autore,
        timestamp: Date.now(),
      },
    });
    setTitoloPost('');
    setContenutoPost('');
    mostraConferma(
      targetSede
        ? `Comunicazione pubblicata nella Bacheca di Sezione (${targetSede.nome}) e sincronizzata sul Raspberry!`
        : 'Comunicazione pubblicata nella Bacheca Associativa (Sede Centrale) e sincronizzata su tutti i Raspberry!'
    );
  };

  const handleToggleAttiva = (com: ComunicazioneBacheca) => {
    const aggiornata = comunicazioni.map((c) =>
      c.id === com.id ? { ...c, attiva: !c.attiva, updatedAt: Date.now() } : c
    );
    onAggiornaComunicazioni(aggiornata);
  };

  const handleTogglePin = (com: ComunicazioneBacheca) => {
    const aggiornata = comunicazioni.map((c) =>
      c.id === com.id ? { ...c, evidenziata: !c.evidenziata, updatedAt: Date.now() } : c
    );
    onAggiornaComunicazioni(aggiornata);
  };

  const handleCiclaPriorita = (com: ComunicazioneBacheca) => {
    const next: ComunicazioneBacheca['priorita'] =
      com.priorita === 'Ordinaria'
        ? 'Importante'
        : com.priorita === 'Importante'
        ? 'Urgente'
        : 'Ordinaria';
    const aggiornata = comunicazioni.map((c) =>
      c.id === com.id ? { ...c, priorita: next, updatedAt: Date.now() } : c
    );
    onAggiornaComunicazioni(aggiornata);
  };

  const handleEliminaCom = (id: string) => {
    const aggiornata = comunicazioni.filter((c) => c.id !== id);
    onAggiornaComunicazioni(aggiornata, { deletedId: id });
    setConfermaEliminaId(null);
    mostraConferma('Comunicazione rimossa dai display Raspberry.');
  };

  const handleSalvaImpostazioni = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: RaspberryDisplayConfig = {
      ...draftConfig,
      updatedBy: operatoreCorrente,
      updatedAtIso: new Date().toISOString(),
    };
    onSalvaConfig(payload);
    mostraConferma('Impostazioni Display Raspberry salvate e sincronizzate in tempo reale!');
  };

  if (anteprimaFullscreenAperta) {
    return (
      <div className="fixed inset-0 z-[150] bg-slate-950">
        <VistaDisplayRaspberrySezione
          sedi={sedi}
          sezioneSelezionataId={sedeSelezionata?.id || ''}
          onCambiaSezione={(id) => setSezioneAttivaId(id)}
          comunicazioni={comunicazioni}
          timbrature={timbrature}
          config={draftConfig}
          isPreview={true}
          onChiudiPreview={() => setAnteprimaFullscreenAperta(false)}
          onRefreshManuale={onRefreshSync}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-1.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-slate-900 border-2 border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superiore ultra-compatta (solo titolo breve + chiusura, così su Android scorre tutta la schermata) */}
        <div className="shrink-0 px-3.5 py-2.5 bg-gradient-to-r from-[#14124a] via-slate-900 to-emerald-950/80 border-b border-emerald-500/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Tv className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="text-xs sm:text-sm font-black text-white truncate">
              Display Raspberry di Sezione
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-[10px] font-black uppercase text-amber-300 shrink-0">
              Admin • Presidente • Segretario
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Chiudi Gestione Display Raspberry"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* UNICO CONTENITORE SCORREVOLE (Intestazione + Menù stile Database + Contenuto + Footer) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* Header descrittivo stile Database (scorre con la pagina su Android/iOS) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                <Tv className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[9.5px] font-black uppercase text-amber-300">
                    Admin • Presidente • Segretario
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mt-1 leading-snug">
                  Gestione Display &amp; Wi-Fi Raspberry di Sezione
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Bacheca Associativa Centrale, Bacheca di Sezione, Presenze (NFC + App) / Ultimi 10 Usciti e file Wi-Fi per ogni singola sezione.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onRefreshSync?.();
                setAnteprimaFullscreenAperta(true);
              }}
              className="w-full sm:w-auto shrink-0 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Eye className="w-4 h-4" />
              <span>Anteprima Live</span>
            </button>
          </div>

          {/* Barra Navigazione Sotto-Categorie identica ai Menù dei Database */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('schermi')}
              className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
                activeTab === 'schermi'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span className="break-words">1. Anteprima &amp; Link ({sedi.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wifi')}
              className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
                activeTab === 'wifi'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 border border-sky-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Wifi className="w-4 h-4 shrink-0" />
              <span className="break-words">2. File Wi-Fi Raspberry</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bacheche')}
              className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
                activeTab === 'bacheche'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 border border-amber-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Megaphone className="w-4 h-4 shrink-0" />
              <span className="break-words">3. Bacheche Centrale &amp; Sez.</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('impostazioni')}
              className={`w-full min-w-0 px-2.5 sm:px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
                activeTab === 'impostazioni'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="break-words">4. Impostazioni Schermo</span>
            </button>
          </div>

          {/* Avviso feedback */}
          {avvisoOk && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-400/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{avvisoOk}</span>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 1: ANTEPRIMA LIVE & LINK KIOSK PER I RASPBERRY DELLE SEZIONI */}
          {/* =============================================================== */}
          {activeTab === 'schermi' && (
            <div className="space-y-4">
              {/* Controllo Sezione + Link Kiosk */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/40 space-y-3.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wide flex items-center gap-2">
                    <Tv className="w-4 h-4 shrink-0" />
                    <span>Seleziona Sezione per Anteprima &amp; Link Raspberry</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Le 3 sezioni tematiche sono sempre visibili contestualmente e distintamente sullo schermo del Raspberry: <strong className="text-amber-300">Bacheca Associativa</strong>, <strong className="text-cyan-300">Bacheca di Sezione</strong> e <strong className="text-emerald-300">Presenti (NFC+App) / Ultimi 10 Usciti</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Sezione / Sede sul Raspberry
                    </label>
                    <select
                      value={sedeSelezionata?.id || ''}
                      onChange={(e) => setSezioneAttivaId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      {sedi.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-7">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Link Kiosk Diretto (senza login — da aprire sul Raspberry Pi)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={urlSezioneAttiva}
                        className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-[11px] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copiaTesto('url-main', urlSezioneAttiva)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          copiedKey === 'url-main'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                        }`}
                      >
                        {copiedKey === 'url-main' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'url-main' ? 'Copiato' : 'Copia'}</span>
                      </button>
                      <a
                        href={urlSezioneAttiva}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center gap-1 shrink-0"
                        title="Apri Link Raspberry in nuova scheda"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Apri</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Comando rapido avvio Chromium Kiosk sul Raspberry Pi */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Comando avvio Schermo Intero (Chromium Kiosk)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copiaTesto('cmd-kiosk', comandoChromiumKiosk)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10.5px] font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd-kiosk' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'cmd-kiosk' ? 'Copiato' : 'Copia Comando'}</span>
                    </button>
                  </div>
                  <code className="block text-[10.5px] font-mono text-sky-300 bg-slate-950 px-2.5 py-2 rounded-lg border border-slate-800 break-all">
                    {comandoChromiumKiosk}
                  </code>
                </div>
              </div>

              {/* Riepilogo LIVE di tutte le Sezioni dell'Associazione */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Tutte le Sezioni Associative ({sedi.length})</span>
                  </h3>
                  {onRefreshSync && (
                    <button
                      type="button"
                      onClick={() => {
                        onRefreshSync();
                        mostraConferma('Dati sincronizzati con i display Raspberry!');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Forza Sync Cloud</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {statsPerSede.map((item) => (
                    <div
                      key={item.sede.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                        item.sede.id === sedeSelezionata?.id
                          ? 'bg-emerald-950/25 border-emerald-400/60'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white leading-snug">
                            {item.sede.nome}
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            {item.sede.comune} • {item.sede.codice || item.sede.id}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase shrink-0 flex items-center gap-1 ${
                            item.hasWifi
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <Wifi className="w-2.5 h-2.5" />
                          {item.hasWifi ? 'Wi-Fi OK' : 'Wi-Fi N/D'}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30">
                          <div className="text-[9px] font-bold uppercase text-amber-300">Centrale</div>
                          <div className="text-xs font-black font-mono text-white">{item.comCentrale}</div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/30">
                          <div className="text-[9px] font-bold uppercase text-cyan-300">Sezione</div>
                          <div className="text-xs font-black font-mono text-white">{item.comSez}</div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/30">
                          <div className="text-[9px] font-bold uppercase text-emerald-300">Presenti</div>
                          <div className="text-xs font-black font-mono text-emerald-300">{item.presenti}</div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-400/30">
                          <div className="text-[9px] font-bold uppercase text-orange-300">Usciti</div>
                          <div className="text-xs font-black font-mono text-orange-200">{item.usciti}/10</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSezioneAttivaId(item.sede.id);
                            setAnteprimaFullscreenAperta(true);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-black flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Anteprima</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => copiaTesto(`url-${item.sede.id}`, item.url)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `url-${item.sede.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{copiedKey === `url-${item.sede.id}` ? 'Copiato' : 'Link'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSezioneAttivaId(item.sede.id);
                            setActiveTab('wifi');
                          }}
                          className="px-2 py-1.5 rounded-lg bg-sky-700/80 hover:bg-sky-600 text-white border border-sky-400/40 text-[10.5px] font-black flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Wifi className="w-3.5 h-3.5 shrink-0" />
                          <span>Wi-Fi</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: CONFIGURAZIONE WI-FI & FILE RASPBERRY PER SINGOLA SEZIONE */}
          {/* =============================================================== */}
          {activeTab === 'wifi' && (
            <div className="space-y-4">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/85 border border-sky-500/45 space-y-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-sky-300 uppercase tracking-wide flex items-center gap-2">
                      <Wifi className="w-4 h-4 shrink-0" />
                      <span>Configurazione Wi-Fi Associativo Raspberry Pi (Per Singola Sezione)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Seleziona una sezione associativa, inserisci il nome della rete Wi-Fi (SSID) e la password della sede, quindi genera il file pronto per il Raspberry Pi. Accessibile ad <strong className="text-amber-300">Amministratore, Presidente e Segretario</strong> (anche dalla scheda di ogni singola sede nel Database Sedi).
                    </p>
                  </div>
                </div>

                {/* Selettore Rapido Sezione */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sedi.map((s) => {
                    const selected = s.id === sedeSelezionata?.id;
                    const configured = Boolean(s.wifiSsid && s.wifiSsid.trim());
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSezioneAttivaId(s.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? 'bg-sky-950/70 border-sky-400 text-white shadow-md shadow-sky-500/20'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-black truncate">{s.nome}</span>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              configured ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                          {configured ? `SSID: ${s.wifiSsid}` : 'Wi-Fi non ancora configurato'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Schermata credenziali Wi-Fi della singola sezione selezionata */}
                {sedeSelezionata && (
                  <form onSubmit={handleSalvaWifiForm} className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase text-sky-400">
                          Schermata Wi-Fi Sezione Selezionata
                        </div>
                        <div className="text-sm font-black text-white truncate">
                          {sedeSelezionata.nome}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                        <Lock className="w-3 h-3" />
                        Salvato solo in area riservata
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Nome Rete Wi-Fi Associativa (SSID) *
                        </label>
                        <input
                          type="text"
                          required
                          value={wifiSsid}
                          onChange={(e) => setWifiSsid(e.target.value)}
                          placeholder="Es. CroceOro_Fossone_5G"
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Password Wi-Fi {wifiSicurezza === 'NONE' ? '(Non richiesta)' : '*'}
                        </label>
                        <div className="relative">
                          <input
                            type={mostraPasswordWifi ? 'text' : 'password'}
                            required={wifiSicurezza !== 'NONE'}
                            disabled={wifiSicurezza === 'NONE'}
                            value={wifiSicurezza === 'NONE' ? '' : wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            placeholder={wifiSicurezza === 'NONE' ? 'Rete aperta senza password' : 'Inserisci password Wi-Fi della sezione'}
                            className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-sky-400 disabled:opacity-50"
                          />
                          {wifiSicurezza !== 'NONE' && (
                            <button
                              type="button"
                              onClick={() => setMostraPasswordWifi((v) => !v)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                              title={mostraPasswordWifi ? 'Nascondi password' : 'Mostra password'}
                            >
                              {mostraPasswordWifi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Sicurezza Rete Wi-Fi
                        </label>
                        <select
                          value={wifiSicurezza}
                          onChange={(e) => setWifiSicurezza(e.target.value as 'WPA-PSK' | 'SAE' | 'NONE')}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-sky-400 cursor-pointer"
                        >
                          <option value="WPA-PSK">WPA / WPA2-PSK (Standard Router — Consigliato)</option>
                          <option value="SAE">WPA3-Personal (SAE)</option>
                          <option value="NONE">Rete Aperta (Senza Password)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Codice Paese Wi-Fi (Raspberry Pi)
                        </label>
                        <input
                          type="text"
                          maxLength={2}
                          value={wifiCountry}
                          onChange={(e) => setWifiCountry(e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold uppercase focus:outline-none focus:border-sky-400"
                          placeholder="IT"
                        />
                      </div>
                    </div>

                    {/* Salva + Download File Wi-Fi Raspberry */}
                    <div className="pt-2 border-t border-slate-800 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="submit"
                          disabled={!wifiSsid.trim()}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Salva Wi-Fi per questa Sezione</span>
                        </button>

                        <button
                          type="button"
                          disabled={!wifiSsid.trim()}
                          onClick={() => setMostraAnteprimaFileWifi((v) => !v)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                          <span>{mostraAnteprimaFileWifi ? 'Nascondi Anteprima File' : 'Anteprima Contenuto File'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={!wifiSsid.trim()}
                          onClick={() => handleScaricaWifiFile('wpa')}
                          className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-left flex items-center gap-2 cursor-pointer shadow"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[11px] font-black leading-tight">wpa_supplicant.conf</div>
                            <div className="text-[9.5px] text-sky-100 leading-tight">Copia su /boot microSD (Pi OS Legacy/Standard)</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={!wifiSsid.trim()}
                          onClick={() => handleScaricaWifiFile('nmconnection')}
                          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-left flex items-center gap-2 cursor-pointer shadow"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[11px] font-black leading-tight">Profilo .nmconnection</div>
                            <div className="text-[9.5px] text-indigo-100 leading-tight">NetworkManager (Raspberry Pi OS Bookworm+)</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={!wifiSsid.trim()}
                          onClick={() => handleScaricaWifiFile('script')}
                          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-left flex items-center gap-2 cursor-pointer shadow"
                        >
                          <Terminal className="w-4 h-4 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[11px] font-black leading-tight">Script Automatico .sh</div>
                            <div className="text-[9.5px] text-slate-900 leading-tight">Configura qualsiasi Raspberry in 1 comando</div>
                          </div>
                        </button>
                      </div>

                      {mostraAnteprimaFileWifi && wifiSsid.trim() && (
                        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                          {generaContenutoWpaSupplicant({
                            ssid: wifiSsid.trim(),
                            password: wifiSicurezza === 'NONE' ? '' : wifiPassword,
                            sicurezza: wifiSicurezza,
                            country: wifiCountry || 'IT',
                            sedeNome: sedeSelezionata.nome,
                          })}
                        </pre>
                      )}

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[10.5px] text-slate-300 space-y-1">
                        <div className="font-black text-sky-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Istruzioni rapide per il Raspberry Pi:</span>
                        </div>
                        <p>• <strong>Metodo MicroSD (più semplice):</strong> scarica <code>wpa_supplicant.conf</code> e copialo nella partizione <code>boot</code> della microSD del Raspberry prima di accenderlo.</p>
                        <p>• <strong>Raspberry Pi OS recente (Bookworm / Pi 4 / Pi 5):</strong> scarica lo <strong>Script Automatico .sh</strong> oppure il profilo <code>.nmconnection</code> ed eseguilo con <code>sudo bash setup-wifi-raspberry-*.sh</code>.</p>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: GESTIONE RAPIDA BACHECHE (SEDE CENTRALE & SEZIONE)       */}
          {/* =============================================================== */}
          {activeTab === 'bacheche' && (
            <div className="space-y-4">
              {/* Form pubblicazione rapida direttamente sui Raspberry */}
              <form
                onSubmit={handlePubblicaRapida}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-amber-400/40 space-y-3"
              >
                <h3 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span>Pubblica Nuova Comunicazione sui Display Raspberry</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Destinazione Bacheca *
                    </label>
                    <select
                      value={destinazionePost}
                      onChange={(e) => setDestinazionePost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="tutte">🏛️ Bacheca Associativa (Sede Centrale — Tutti i Raspberry)</option>
                      {sedi.map((s) => (
                        <option key={s.id} value={s.id}>
                          🏢 Bacheca Sezione: {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Priorità
                    </label>
                    <select
                      value={prioritaPost}
                      onChange={(e) => setPrioritaPost(e.target.value as ComunicazioneBacheca['priorita'])}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Urgente">🔴 Urgente (Evidenza Rossa)</option>
                      <option value="Importante">🟠 Importante (Evidenza Ambra)</option>
                      <option value="Ordinaria">🔵 Ordinaria</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Categoria
                    </label>
                    <select
                      value={categoriaPost}
                      onChange={(e) => setCategoriaPost(e.target.value as ComunicazioneBacheca['categoria'])}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Comunicazione Generale">Comunicazione Generale</option>
                      <option value="Disposizioni Operative">Disposizioni Operative</option>
                      <option value="Turni & Reperibilità">Turni &amp; Reperibilità</option>
                      <option value="Formazione & Eventi">Formazione &amp; Eventi</option>
                      <option value="Mezzi & Dotazioni">Mezzi &amp; Dotazioni</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Titolo Comunicazione *
                  </label>
                  <input
                    type="text"
                    required
                    value={titoloPost}
                    onChange={(e) => setTitoloPost(e.target.value)}
                    placeholder="Es. Riunione Operativa Straordinaria / Disposizione Turni Weekend..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Testo Comunicazione (visibile sul monitor della sede) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={contenutoPost}
                    onChange={(e) => setContenutoPost(e.target.value)}
                    placeholder="Scrivi il messaggio completo ben leggibile sul display della sezione..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evidenziataPost}
                      onChange={(e) => setEvidenziataPost(e.target.checked)}
                      className="rounded accent-amber-400 w-4 h-4"
                    />
                    <span>Contrassegna &quot;In Evidenza&quot;</span>
                  </label>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Pubblica Ora sui Display</span>
                  </button>
                </div>
              </form>

              {/* Due colonne di gestione: Bacheca Associativa (Centrale) vs Bacheca Sezione Selezionata */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Colonna Centrale */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-400/40 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                      <Megaphone className="w-4 h-4 shrink-0" />
                      <span>Bacheca Associativa • Sede Centrale ({comunicazioniCentraleLista.length})</span>
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {comunicazioniCentraleLista.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-4 text-center">
                        Nessuna comunicazione della Sede Centrale.
                      </div>
                    ) : (
                      comunicazioniCentraleLista.map((com) => (
                        <div
                          key={com.id}
                          className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                            com.attiva === false
                              ? 'bg-slate-900/40 border-slate-800 opacity-60'
                              : 'bg-slate-900 border-amber-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-black text-white leading-snug">{com.titolo}</div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {com.dataPubblicazione}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 line-clamp-2">{com.contenuto}</p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleCiclaPriorita(com)}
                              className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                                com.priorita === 'Urgente'
                                  ? 'bg-rose-600 text-white'
                                  : com.priorita === 'Importante'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-700 text-slate-200'
                              }`}
                              title="Clicca per cambiare priorità"
                            >
                              {com.priorita}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePin(com)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                com.evidenziata
                                  ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {com.evidenziata ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                              <span>{com.evidenziata ? 'Evidenza' : 'Evidenzia'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttiva(com)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                com.attiva !== false
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {com.attiva !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              <span>{com.attiva !== false ? 'Visibile' : 'Nascosta'}</span>
                            </button>
                            {confermaEliminaId === com.id ? (
                              <span className="ml-auto flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEliminaCom(com.id)}
                                  className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                >
                                  Conferma
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfermaEliminaId(null)}
                                  className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfermaEliminaId(com.id)}
                                className="ml-auto p-1 rounded bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white cursor-pointer"
                                title="Elimina comunicazione"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Colonna Singola Sezione */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-cyan-400/40 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase text-cyan-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>Bacheca di Sezione ({comunicazioniSezioneLista.length})</span>
                    </span>
                    <select
                      value={sedeSelezionata?.id || ''}
                      onChange={(e) => setSezioneAttivaId(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-cyan-500/40 text-[11px] font-bold text-white max-w-[210px] cursor-pointer"
                    >
                      {sedi.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {comunicazioniSezioneLista.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-4 text-center">
                        Nessuna comunicazione specifica per {sedeSelezionata?.nome}.
                      </div>
                    ) : (
                      comunicazioniSezioneLista.map((com) => (
                        <div
                          key={com.id}
                          className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                            com.attiva === false
                              ? 'bg-slate-900/40 border-slate-800 opacity-60'
                              : 'bg-slate-900 border-cyan-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-black text-white leading-snug">{com.titolo}</div>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {com.dataPubblicazione}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 line-clamp-2">{com.contenuto}</p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleCiclaPriorita(com)}
                              className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                                com.priorita === 'Urgente'
                                  ? 'bg-rose-600 text-white'
                                  : com.priorita === 'Importante'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-700 text-slate-200'
                              }`}
                            >
                              {com.priorita}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePin(com)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                com.evidenziata
                                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {com.evidenziata ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                              <span>{com.evidenziata ? 'Evidenza' : 'Evidenzia'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAttiva(com)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                com.attiva !== false
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {com.attiva !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              <span>{com.attiva !== false ? 'Visibile' : 'Nascosta'}</span>
                            </button>
                            {confermaEliminaId === com.id ? (
                              <span className="ml-auto flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEliminaCom(com.id)}
                                  className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                >
                                  Conferma
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfermaEliminaId(null)}
                                  className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfermaEliminaId(com.id)}
                                className="ml-auto p-1 rounded bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white cursor-pointer"
                                title="Elimina comunicazione"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: IMPOSTAZIONI SCHERMO & REGOLE PRESENZE RASPBERRY          */}
          {/* =============================================================== */}
          {activeTab === 'impostazioni' && (
            <form onSubmit={handleSalvaImpostazioni} className="space-y-4">
              {/* Regole attive di visualizzazione e NFC 24h */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 text-xs text-slate-200 space-y-1.5">
                <div className="font-black text-emerald-300 uppercase text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Regole Automatiche Attive sul Display Raspberry</span>
                </div>
                <p>• <strong>3 Sezioni Contestuali:</strong> Bacheca Associativa, Bacheca di Sezione e Presenze di Turno sempre affiancate e distinte sullo schermo, con scorrimento interno e <strong>messaggi più recenti in alto</strong>.</p>
                <p>• <strong>Presenti in Sede:</strong> mostra tutti i volontari attualmente presenti nella sezione che hanno badgiato l&apos;entrata tramite <strong>lettore NFC</strong> o <strong>App</strong>.</p>
                <p>• <strong>Ultimi 10 Usciti:</strong> mostra gli <strong>ultimi 10 volontari</strong> usciti dalla sezione con <strong>giorno, data e ora di ingresso e di uscita</strong>.</p>
                <p>• <strong>Auto-uscita NFC dopo 24h:</strong> se un ingresso NFC resta aperto oltre 24 ore senza uscita, il volontario viene rimosso automaticamente dai presenti, ma l&apos;uscita <strong>non compare sul file timbrature</strong> e ha <strong>validità zero</strong> in tutti i conteggi presenze/ore.</p>
              </div>

              {/* Visibilità 3 Sezioni */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  Sezioni Tematiche Visibili sullo Schermo
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="p-3 rounded-xl bg-slate-900 border border-amber-400/40 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.mostraBachecaAssociativa}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, mostraBachecaAssociativa: e.target.checked }))
                      }
                      className="mt-0.5 rounded accent-amber-400 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-black text-amber-300">1. Bacheca Associativa</div>
                      <div className="text-[11px] text-slate-400">Comunicazioni dalla Sede Centrale</div>
                    </div>
                  </label>

                  <label className="p-3 rounded-xl bg-slate-900 border border-cyan-400/40 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.mostraBachecaSezione}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, mostraBachecaSezione: e.target.checked }))
                      }
                      className="mt-0.5 rounded accent-cyan-400 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-black text-cyan-300">2. Bacheca di Sezione</div>
                      <div className="text-[11px] text-slate-400">Comunicazioni della singola sezione</div>
                    </div>
                  </label>

                  <label className="p-3 rounded-xl bg-slate-900 border border-emerald-400/40 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.mostraPresenzeSezione}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, mostraPresenzeSezione: e.target.checked }))
                      }
                      className="mt-0.5 rounded accent-emerald-400 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-black text-emerald-300">3. Presenze &amp; Usciti</div>
                      <div className="text-[11px] text-slate-400">Presenti (NFC+App) e Ultimi 10 Usciti</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Filtri Bacheche & Scorrimento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Filtri Comunicazioni
                  </h3>

                  <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-white">Solo Importanti/Urgenti — Sede Centrale</div>
                      <div className="text-[10.5px] text-slate-400">Nasconde comunicazioni ordinarie sul monitor</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={draftConfig.soloImportantiAssociativa}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, soloImportantiAssociativa: e.target.checked }))
                      }
                      className="rounded accent-amber-400 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-white">Solo Importanti/Urgenti — Singola Sezione</div>
                      <div className="text-[10.5px] text-slate-400">Filtra per priorità nella bacheca locale</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={draftConfig.soloImportantiSezione}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, soloImportantiSezione: e.target.checked }))
                      }
                      className="rounded accent-cyan-400 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                    Scorrimento Automatico &amp; Aggiornamento
                  </h3>

                  <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-white">Auto-Scroll Verticale Colonne</div>
                      <div className="text-[10.5px] text-slate-400">Scorre automaticamente se i contenuti superano lo schermo</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={draftConfig.autoScrollAttivo}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, autoScrollAttivo: e.target.checked }))
                      }
                      className="rounded accent-emerald-400 w-4 h-4"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Velocità Scorrimento
                      </label>
                      <select
                        value={draftConfig.velocitaScroll}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            velocitaScroll: e.target.value as RaspberryDisplayConfig['velocitaScroll'],
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold cursor-pointer"
                      >
                        <option value="lento">Lento (Consigliato TV)</option>
                        <option value="medio">Medio</option>
                        <option value="veloce">Veloce</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Sync Automatico
                      </label>
                      <select
                        value={draftConfig.refreshSecondi}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({ ...prev, refreshSecondi: Number(e.target.value) || 30 }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold cursor-pointer"
                      >
                        <option value={30}>Ogni 30 secondi</option>
                        <option value={60}>Ogni 60 secondi</option>
                        <option value={120}>Ogni 2 minuti</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sezione predefinita + Ticker footer */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Sezione Predefinita (se il link non specifica ?sede=...)
                  </label>
                  <select
                    value={draftConfig.sezionePredefinitaId}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({ ...prev, sezionePredefinitaId: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Avviso Fisso Barra Inferiore (Opzionale)
                  </label>
                  <input
                    type="text"
                    maxLength={280}
                    value={draftConfig.tickerAvvisoCentrale}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({ ...prev, tickerAvvisoCentrale: e.target.value }))
                    }
                    placeholder="Es. Ricordati di badgiare ingresso e uscita ad ogni turno..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva &amp; Sincronizza sui Raspberry</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer informativo dentro il flusso scorrevole (non blocca spazio fisso su Android!) */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Gestione riservata a Amministratore, Presidente e Segretario</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
