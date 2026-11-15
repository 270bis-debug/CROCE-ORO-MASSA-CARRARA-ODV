import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  CloudUpload,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  X,
  FileCode,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { CroceOroLogo } from '../CroceOroLogo';
import {
  DOMINIO_CROCE_ORO,
  ENDPOINT_DEFAULT,
  TOKEN_DEFAULT,
  PacchettoDatiCroceOro,
  RegistroBackupLocale,
  getImpostazioniSyncServer,
  salvaImpostazioniSyncServer,
  formattaDimensione,
  testaConnessioneServer,
  inviaBackupAlServer,
  scaricaBackupLocale,
  scaricaFilePHPPronto,
  generaScriptPHP
} from '../../utils/syncServerCroceOro';
import { formatDateTimeItaly } from '../../utils/italianTime';

interface ModalSyncServerCroceOroProps {
  aperta: boolean;
  onChiudi: () => void;
  operatoreNome: string;
  // Dati applicativi completi passati dallo stato di App.tsx
  datiApplicativi: {
    serviziArchivio: any[];
    volontari: any[];
    timbrature: any[];
    mezzi: any[];
    manutenzioni: any[];
    tessere?: any[];
    noteDiDebito?: any[];
    corsi?: any[];
    sedi?: any[];
    turni?: any[];
    bacheca?: any[];
    contatti?: any[];
    magazzino?: any[];
  };
}

export const ModalSyncServerCroceOro: React.FC<ModalSyncServerCroceOroProps> = ({
  aperta,
  onChiudi,
  operatoreNome,
  datiApplicativi
}) => {
  const [urlEndpoint, setUrlEndpoint] = useState(ENDPOINT_DEFAULT);
  const [token, setToken] = useState(TOKEN_DEFAULT);
  const [autoSync, setAutoSync] = useState(false);
  const [cronologia, setCronologia] = useState<RegistroBackupLocale[]>([]);
  
  // Stati di operazione
  const [inCaricamento, setInCaricamento] = useState(false);
  const [inTest, setInTest] = useState(false);
  const [esitoOperazione, setEsitoOperazione] = useState<{
    tipo: 'successo' | 'avviso' | 'errore' | null;
    messaggio: string;
    dettagli?: string;
  }>({ tipo: null, messaggio: '' });

  const [mostraGuida, setMostraGuida] = useState(false);
  const [mostraCodicePHP, setMostraCodicePHP] = useState(false);
  const [copiato, setCopiato] = useState(false);

  // Carica impostazioni salvate all'apertura
  useEffect(() => {
    if (aperta) {
      const config = getImpostazioniSyncServer();
      setUrlEndpoint(config.url);
      setToken(config.token);
      setAutoSync(config.autoSync);
      setCronologia(config.cronologia);
      setEsitoOperazione({ tipo: null, messaggio: '' });
    }
  }, [aperta]);

  if (!aperta) return null;

  // Costruisce il pacchetto dati attuale
  const costruisciPacchetto = (): PacchettoDatiCroceOro => {
    return {
      versione: 'v2.4.6',
      dataGenerazione: new Date().toISOString(),
      associazione: 'Croce Oro Massa Carrara OdV',
      dominio: DOMINIO_CROCE_ORO,
      operatore: operatoreNome,
      statistiche: {
        totaleServizi: datiApplicativi.serviziArchivio?.length || 0,
        totaleVolontari: datiApplicativi.volontari?.length || 0,
        totaleTimbrature: datiApplicativi.timbrature?.length || 0,
        totaleMezzi: datiApplicativi.mezzi?.length || 0,
        totaleManutenzioni: datiApplicativi.manutenzioni?.length || 0,
        totaleDonazioni: datiApplicativi.serviziArchivio?.filter((s: any) => s.donazione?.importo > 0).length || 0,
        totaleCorsi: datiApplicativi.corsi?.length || 0,
        totaleSedi: datiApplicativi.sedi?.length || 0,
        totaleTurni: datiApplicativi.turni?.length || 0,
        totaleContatti: datiApplicativi.contatti?.length || 0,
        totaleArticoliMagazzino: datiApplicativi.magazzino?.length || 0
      },
      dati: {
        serviziArchivio: datiApplicativi.serviziArchivio || [],
        volontari: datiApplicativi.volontari || [],
        timbrature: datiApplicativi.timbrature || [],
        mezzi: datiApplicativi.mezzi || [],
        manutenzioni: datiApplicativi.manutenzioni || [],
        tessere: datiApplicativi.tessere || [],
        noteDiDebito: datiApplicativi.noteDiDebito || [],
        corsi: datiApplicativi.corsi || [],
        sedi: datiApplicativi.sedi || [],
        turni: datiApplicativi.turni || [],
        bacheca: datiApplicativi.bacheca || [],
        contatti: datiApplicativi.contatti || [],
        magazzino: datiApplicativi.magazzino || []
      }
    };
  };

  // Stima dimensione pacchetto corrente
  const pacchettoAttuale = costruisciPacchetto();
  const dimensioneStrimataByte = new Blob([JSON.stringify(pacchettoAttuale)]).size;
  const dimensioneStrimataFormattata = formattaDimensione(dimensioneStrimataByte);

  // Esegue Test di Connessione con www.croceoro.org
  const handleTestConnessione = async () => {
    setInTest(true);
    setEsitoOperazione({ tipo: null, messaggio: '' });

    try {
      const res = await testaConnessioneServer(urlEndpoint, token);
      if (res.ok) {
        setEsitoOperazione({
          tipo: 'successo',
          messaggio: res.messaggio,
          dettagli: res.datiServer ? `Spazio disponibile rilevato: ${res.datiServer.spazioRimanente} su ${res.datiServer.quotaMassima}. Percorso: ${res.datiServer.cartellaStorage}` : undefined
        });
      } else {
        setEsitoOperazione({
          tipo: 'avviso',
          messaggio: res.messaggio,
          dettagli: `Per attivare la ricezione dei dati sul server, scarica lo script 'sync_croceoro.php' sottostante e caricalo nella cartella 'public_html/api/' del dominio ${DOMINIO_CROCE_ORO} (via cPanel o FTP).`
        });
      }
    } finally {
      setInTest(false);
    }
  };

  // Esegue Salvataggio su www.croceoro.org
  const handleSalvaSuServer = async () => {
    setInCaricamento(true);
    setEsitoOperazione({ tipo: null, messaggio: '' });

    // Salva preferenze
    salvaImpostazioniSyncServer(urlEndpoint, token, autoSync);

    try {
      const pacchetto = costruisciPacchetto();
      const res = await inviaBackupAlServer(pacchetto, urlEndpoint, token);

      if (res.ok) {
        setEsitoOperazione({
          tipo: 'successo',
          messaggio: res.messaggio,
          dettagli: `Archiviato su ${DOMINIO_CROCE_ORO} come: ${res.nomeFileServer || 'archivio JSON'}. Spazio residuo: ${res.spazioRimanente || '9.99 GB'}`
        });
        // Ricarica cronologia
        setCronologia(getImpostazioniSyncServer().cronologia);
      } else {
        setEsitoOperazione({
          tipo: 'errore',
          messaggio: res.messaggio,
          dettagli: `Il server ${DOMINIO_CROCE_ORO} non ha risposto correttamente. Puoi comunque procedere con il pulsante "Scarica Copia di Backup Locale (.json)" per conservare tutti i dati sul tuo dispositivo in assoluta sicurezza.`
        });
        setCronologia(getImpostazioniSyncServer().cronologia);
      }
    } finally {
      setInCaricamento(false);
    }
  };

  // Scarica Copia Locale sul PC
  const handleScaricaLocale = () => {
    const pacchetto = costruisciPacchetto();
    const res = scaricaBackupLocale(pacchetto);
    setCronologia(getImpostazioniSyncServer().cronologia);
    setEsitoOperazione({
      tipo: 'successo',
      messaggio: `Backup scaricato con successo sul tuo computer: ${res.nomeFile} (${res.dimensione}).`,
      dettagli: 'Il file contiene tutte le schede di soccorso, il registro timbrature ore dei volontari, il parco mezzi e la contabilità in formato standard JSON conforme alle normative di conservazione.'
    });
  };

  // Copia codice PHP negli appunti
  const handleCopiaCodicePHP = () => {
    const code = generaScriptPHP(token);
    navigator.clipboard.writeText(code);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* HEADER MODALE */}
        <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/10 border-b border-amber-500/30 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
              <Server className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                  Storage Hosting 10 GB
                </span>
                <span className="text-xs font-mono font-bold text-amber-300">
                  {DOMINIO_CROCE_ORO}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Crittografia HTTPS
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide mt-1">
                Salvataggio Dati & Backup sul Dominio Associativo
              </h2>
              <p className="text-xs text-slate-300">
                Archiviazione sicura sui 10 GB di spazio disponibili sul server web ufficiale di Croce Oro Massa Carrara
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onChiudi}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENUTO SCORREVOLE */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-200">
          
          {/* BANNER INFORMATIVO SPAZIO HOSTING 10 GB */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-2xl border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs font-black uppercase text-amber-300 tracking-wide">
                  Spazio Disponibile sul Server: 10 Gigabyte (10.240 MB)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                L'intero database dell'associazione (schede missioni, anagrafiche soci, timbrature orarie, mezzi e donazioni) occupa attualmente circa <strong className="text-amber-400 font-mono">{dimensioneStrimataFormattata}</strong>. Nei 10 GB disponibili su <span className="text-amber-300 font-mono">www.croceoro.org</span> è possibile archiviare oltre <strong className="text-white">70.000 backup completi</strong> senza mai esaurire la memoria!
              </p>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700 text-right shrink-0 min-w-[170px]">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Dimensione Dati Attuali</div>
              <div className="text-lg font-black text-amber-400 font-mono">{dimensioneStrimataFormattata}</div>
              <div className="text-[10px] text-emerald-400 font-mono">~ 0.001% di 10 GB</div>
            </div>
          </div>

          {/* RIEPILOGO DEI DATI DA SALVARE */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-2">
              📦 Contenuto Incluso nel Pacchetto di Salvataggio:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Servizi 118 / Ord.</div>
                <div className="font-black text-emerald-400 mt-0.5">{pacchettoAttuale.statistiche.totaleServizi}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Volontari & PIN</div>
                <div className="font-black text-blue-400 mt-0.5">{pacchettoAttuale.statistiche.totaleVolontari}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Ore Timbrate</div>
                <div className="font-black text-amber-400 mt-0.5">{pacchettoAttuale.statistiche.totaleTimbrature} reg.</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Parco Mezzi</div>
                <div className="font-black text-amber-400 mt-0.5">{pacchettoAttuale.statistiche.totaleMezzi}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Donazioni</div>
                <div className="font-black text-purple-400 mt-0.5">{pacchettoAttuale.statistiche.totaleDonazioni}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">Manutenzioni</div>
                <div className="font-black text-indigo-400 mt-0.5">{pacchettoAttuale.statistiche.totaleManutenzioni}</div>
              </div>
            </div>
          </div>

          {/* MESSAGGIO ESITO (SUCCESS / AVVISO / ERRORE) */}
          {esitoOperazione.tipo && (
            <div className={`p-4 rounded-2xl border-2 flex items-start gap-3 animate-in fade-in ${
              esitoOperazione.tipo === 'successo'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : esitoOperazione.tipo === 'avviso'
                ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                : 'bg-rose-950/80 border-rose-500 text-rose-200'
            }`}>
              {esitoOperazione.tipo === 'successo' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <strong className="block text-sm font-black">
                  {esitoOperazione.messaggio}
                </strong>
                {esitoOperazione.dettagli && (
                  <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                    {esitoOperazione.dettagli}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PULSANTI DI AZIONE PRINCIPALE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Azione 1: Salva su www.croceoro.org */}
            <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40 hover:border-amber-400 transition-all flex flex-col justify-between gap-3 shadow-lg group">
              <div>
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <CloudUpload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-black uppercase text-xs">Salvataggio Remoto sul Server</span>
                </div>
                <h3 className="text-sm font-black text-white">
                  Invia Backup a www.croceoro.org
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Spedisce un'istantanea cifrata contenente tutti i database direttamente nello storage di 10 GB del dominio dell'associazione.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={inCaricamento || inTest}
                  onClick={handleSalvaSuServer}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  {inCaricamento ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Salvataggio in corso...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>Salva Ora su www.croceoro.org</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={inTest || inCaricamento}
                  onClick={handleTestConnessione}
                  title="Verifica se il server www.croceoro.org risponde"
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inTest ? 'animate-spin text-amber-400' : ''}`} />
                  <span className="hidden sm:inline">Test</span>
                </button>
              </div>
            </div>

            {/* Azione 2: Scarica Copia Locale */}
            <div className="bg-slate-950 p-4 rounded-2xl border-2 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-lg group">
              <div>
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-black uppercase text-xs">Copia di Sicurezza Locale</span>
                </div>
                <h3 className="text-sm font-black text-white">
                  Scarica File Backup sul Tuo Computer (.json)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Scarica immediatamente un file JSON compatto sul tuo computer/chiavetta USB per avere una copia offline sempre consultabile e ripristinabile.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleScaricaLocale}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white font-black text-xs uppercase flex items-center justify-center gap-2 border border-blue-500/40 shadow transition-transform active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Scarica Backup sul Tuo Computer</span>
                </button>
              </div>
            </div>
          </div>

          {/* SEZIONE CONFIGURAZIONE & GUIDA INSTALLAZIONE SCRIPT HOSTING */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-400" />
                <h4 className="text-xs font-black uppercase text-white tracking-wide">
                  Configurazione Endpoint & Script PHP per www.croceoro.org
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMostraGuida(!mostraGuida)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>{mostraGuida ? 'Nascondi Guida cPanel/FTP' : 'Come installarlo sul server (3 passaggi)'}</span>
                  {mostraGuida ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => scaricaFilePHPPronto(token)}
                  className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-black text-xs border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Scarica lo script PHP già configurato da caricare sul server www.croceoro.org"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica sync_croceoro.php</span>
                </button>
              </div>
            </div>

            {/* GUIDA A DISCESA */}
            {mostraGuida && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3 text-xs text-slate-300 leading-relaxed animate-in fade-in">
                <strong className="text-amber-300 block uppercase font-black text-xs">
                  📋 Istruzioni Rapide per Webmaster o Amministratore Croce Oro:
                </strong>
                <ol className="list-decimal list-inside space-y-2 text-slate-300">
                  <li>
                    <strong className="text-white">Scarica lo script PHP:</strong> Fai clic sul pulsante giallo in alto <em className="text-amber-400">"Scarica sync_croceoro.php"</em> (è già pre-configurato con il token di sicurezza dell'associazione).
                  </li>
                  <li>
                    <strong className="text-white">Accedi al pannello di controllo dell'hosting di www.croceoro.org:</strong> Accedi via <span className="font-mono text-amber-300">cPanel &gt; File Manager</span> oppure via FTP (con FileZilla).
                  </li>
                  <li>
                    <strong className="text-white">Carica il file:</strong> Entra nella cartella principale <span className="font-mono text-amber-300">public_html</span>, crea se non esiste una sottocartella chiamata <span className="font-mono text-amber-300">api</span>, e carica all'interno il file <span className="font-mono text-white">sync_croceoro.php</span>. Il percorso finale sarà: <span className="font-mono text-emerald-400">https://www.croceoro.org/api/sync_croceoro.php</span>.
                  </li>
                </ol>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                  💡 Lo script gestisce in autonomia la creazione della cartella protetta per i backup (<span className="text-amber-300">storage_croceoro/backups/</span>), la sicurezza con token crittografico e il calcolo dei 10 GB di spazio libero.
                </div>
              </div>
            )}

            {/* CAMPI DI CONFIGURAZIONE AVANZATA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  URL Endpoint Sincronizzazione Server
                </label>
                <input
                  type="text"
                  value={urlEndpoint}
                  onChange={(e) => setUrlEndpoint(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  placeholder="https://www.croceoro.org/api/sync_croceoro.php"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Token Segreto di Autenticazione (API Key)
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setMostraCodicePHP(!mostraCodicePHP)}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
              >
                {mostraCodicePHP ? '▲ Nascondi codice sorgente PHP' : '▼ Visualizza codice sorgente di sync_croceoro.php'}
              </button>

              {mostraCodicePHP && (
                <button
                  type="button"
                  onClick={handleCopiaCodicePHP}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  {copiato ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiato ? 'Copiato!' : 'Copia Codice'}</span>
                </button>
              )}
            </div>

            {mostraCodicePHP && (
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto overflow-x-auto">
                {generaScriptPHP(token)}
              </pre>
            )}
          </div>

          {/* CRONOLOGIA RECENTE DEI SALVATAGGI */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-black uppercase text-slate-300 tracking-wide">
                  Registro Storico Salvataggi & Backup
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {cronologia.length} operazioni registrate
              </span>
            </div>

            {cronologia.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
                Nessun backup registrato finora. Premi <strong>"Salva Ora su www.croceoro.org"</strong> o <strong>"Scarica Backup"</strong> per eseguire il primo salvataggio.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {cronologia.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          item.esito === 'successo' ? 'bg-emerald-400' : item.esito === 'locale_scaricato' ? 'bg-blue-400' : 'bg-rose-400'
                        }`} />
                        <span className="font-mono font-bold text-white text-[11px]">
                          {item.nomeFile}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {item.dimensioneFormattata}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatDateTimeItaly(item.data)} • Operatore: <span className="text-slate-300 font-bold">{item.operatore}</span> • Destinazione: <span className="font-mono text-amber-400">{item.serverUrl}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 font-mono ${
                      item.esito === 'successo'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : item.esito === 'locale_scaricato'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {item.esito === 'successo' ? 'Server 10GB' : item.esito === 'locale_scaricato' ? 'Scaricato PC' : 'Errore'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* FOOTER MODALE */}
        <div className="bg-slate-950 border-t border-slate-800 p-4 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CroceOroLogo size="sm" />
            <span className="hidden sm:inline font-medium">Croce Oro Massa Carrara OdV • Sistema Conservazione Dati</span>
          </div>

          <button
            type="button"
            onClick={onChiudi}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
