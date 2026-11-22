import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  KeyRound,
  Fingerprint,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Lock,
  Smartphone,
  Save,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import {
  PasskeyRecord,
  detectDeviceHint,
  getPasskeysForAccount,
  isPlatformAuthenticatorAvailable,
  isWebAuthnSupported,
  registerAccountPasskey,
  removeLocalPasskey,
  saveCredentialsToPasswordManager,
} from '../utils/passkeyAuth';

interface ModalProfiloAccountProps {
  isOpen: boolean;
  onClose: () => void;
  volontario?: Volontario | null;
  isAdminRoot?: boolean;
  ruoloCorrente: 'admin' | 'volontario';
  isSimulazione?: boolean;
  onAggiornaEmailNotifiche: (volId: string, nuovaEmailNotifiche: string) => void;
  onCambiaPinPersonale: (
    volId: string,
    pinAttuale: string,
    nuovoPin: string
  ) => { ok: boolean; error?: string };
  onAggiornaPasskeysAccount: (accountId: string, passkeys: PasskeyRecord[]) => void;
}

type TabProfilo = 'dati' | 'notifiche' | 'pin' | 'passkey';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ModalProfiloAccount: React.FC<ModalProfiloAccountProps> = ({
  isOpen,
  onClose,
  volontario,
  isAdminRoot = false,
  ruoloCorrente,
  isSimulazione = false,
  onAggiornaEmailNotifiche,
  onCambiaPinPersonale,
  onAggiornaPasskeysAccount,
}) => {
  const [activeTab, setActiveTab] = useState<TabProfilo>('dati');

  // Email notifiche
  const [emailNotificheInput, setEmailNotificheInput] = useState('');
  const [msgEmail, setMsgEmail] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);

  // Cambio PIN
  const [pinAttuale, setPinAttuale] = useState('');
  const [nuovoPin, setNuovoPin] = useState('');
  const [confermaPin, setConfermaPin] = useState('');
  const [mostraPin, setMostraPin] = useState(false);
  const [msgPin, setMsgPin] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);

  // Salva Password nel Browser
  const [pinPerSalvataggio, setPinPerSalvataggio] = useState('');
  const [msgSalvaPwd, setMsgSalvaPwd] = useState<{ tipo: 'ok' | 'info' | 'err'; testo: string } | null>(null);

  // Passkey
  const [webAuthnReady, setWebAuthnReady] = useState(false);
  const [platformBiometricReady, setPlatformBiometricReady] = useState(false);
  const [etichettaPasskey, setEtichettaPasskey] = useState('');
  const [passkeysAccount, setPasskeysAccount] = useState<PasskeyRecord[]>([]);
  const [loadingPasskey, setLoadingPasskey] = useState(false);
  const [msgPasskey, setMsgPasskey] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);

  const accountId = isAdminRoot ? 'admin-centrale-root' : volontario?.id || '';
  const accountDisplayName = isAdminRoot
    ? 'Amministratore Centrale'
    : `${volontario?.nome || ''} ${volontario?.cognome || ''}`.trim() || 'Account Utente';
  const accountUsername = isAdminRoot
    ? 'Amministratore Centrale'
    : `${volontario?.nome || ''} ${volontario?.cognome || ''}`.trim() || volontario?.email || accountId;

  useEffect(() => {
    if (!isOpen) return;
    setMsgEmail(null);
    setMsgPin(null);
    setMsgPasskey(null);
    setMsgSalvaPwd(null);
    setPinAttuale('');
    setNuovoPin('');
    setConfermaPin('');
    setPinPerSalvataggio('');
    setEmailNotificheInput(volontario?.emailNotifiche || '');
    setEtichettaPasskey(detectDeviceHint());

    const supported = isWebAuthnSupported();
    setWebAuthnReady(supported);
    if (supported) {
      isPlatformAuthenticatorAvailable()
        .then((avail) => setPlatformBiometricReady(avail))
        .catch(() => setPlatformBiometricReady(false));
    } else {
      setPlatformBiometricReady(false);
    }

    if (accountId) {
      setPasskeysAccount(getPasskeysForAccount(accountId, volontario?.passkeys));
    } else {
      setPasskeysAccount([]);
    }
  }, [isOpen, accountId, volontario?.emailNotifiche, volontario?.passkeys]);

  if (!isOpen) return null;

  const handleSalvaEmailNotifiche = (e: React.FormEvent) => {
    e.preventDefault();
    if (!volontario || isSimulazione) return;
    const cleaned = emailNotificheInput.trim().toLowerCase();
    if (cleaned && !EMAIL_REGEX.test(cleaned)) {
      setMsgEmail({
        tipo: 'err',
        testo: 'Inserisci un indirizzo email valido (es. nome@esempio.it) oppure lascia vuoto per usare l\'email anagrafica.',
      });
      return;
    }
    onAggiornaEmailNotifiche(volontario.id, cleaned);
    setMsgEmail({
      tipo: 'ok',
      testo: cleaned
        ? `Email notifiche aggiornata a ${cleaned}. L'email anagrafica in Gestione Volontari non è stata modificata.`
        : 'Ripristinata l\'email anagrafica come destinatario predefinito delle notifiche.',
    });
  };

  const handleRipristinaEmailAnagrafica = () => {
    if (!volontario || isSimulazione) return;
    setEmailNotificheInput('');
    onAggiornaEmailNotifiche(volontario.id, '');
    setMsgEmail({
      tipo: 'ok',
      testo: 'Le notifiche email verranno inviate all\'indirizzo anagrafico predefinito.',
    });
  };

  const handleSalvaNuovoPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volontario || isSimulazione) return;
    setMsgPin(null);

    const pAtt = pinAttuale.trim();
    const pNew = nuovoPin.trim();
    const pConf = confermaPin.trim();

    if (!pAtt) {
      setMsgPin({ tipo: 'err', testo: 'Inserisci il tuo PIN attuale per confermare l\'identità.' });
      return;
    }
    if (!/^\d{4}$/.test(pNew)) {
      setMsgPin({ tipo: 'err', testo: 'Il nuovo PIN deve essere composto esattamente da 4 cifre numeriche.' });
      return;
    }
    if (pNew === '0000' || pNew === '4451') {
      setMsgPin({ tipo: 'err', testo: 'Questo codice PIN è riservato o non consentito. Scegli un altro codice.' });
      return;
    }
    if (pNew !== pConf) {
      setMsgPin({ tipo: 'err', testo: 'Il nuovo PIN e la conferma non coincidono.' });
      return;
    }

    const res = onCambiaPinPersonale(volontario.id, pAtt, pNew);
    if (!res.ok) {
      setMsgPin({ tipo: 'err', testo: res.error || 'Impossibile aggiornare il PIN.' });
      return;
    }

    const savedPwd = await saveCredentialsToPasswordManager(accountUsername, pNew, accountDisplayName);
    setPinAttuale('');
    setNuovoPin('');
    setConfermaPin('');
    setMsgPin({
      tipo: 'ok',
      testo:
        savedPwd === 'saved'
          ? 'PIN personale aggiornato con successo e proposto al Gestore Password del dispositivo!'
          : 'PIN personale aggiornato con successo! Conferma il salvataggio se il browser lo propone.',
    });
  };

  const handleSalvaNelGestorePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSimulazione) return;
    const pwd = pinPerSalvataggio.trim();
    if (!/^\d{4,8}$/.test(pwd)) {
      setMsgSalvaPwd({
        tipo: 'err',
        testo: 'Inserisci il tuo PIN attuale (4 cifre) per salvarlo nel gestore password del browser.',
      });
      return;
    }
    const res = await saveCredentialsToPasswordManager(accountUsername, pwd, accountDisplayName);
    if (res === 'saved') {
      setMsgSalvaPwd({
        tipo: 'ok',
        testo: 'Credenziali inviate al Gestore Password del dispositivo (Google Password Manager / Chrome / Edge).',
      });
    } else {
      setMsgSalvaPwd({
        tipo: 'info',
        testo:
          'Il browser ha registrato il modulo credenziali: conferma il popup "Salva password" se visualizzato da Safari / iCloud Keychain o Firefox.',
      });
    }
    setPinPerSalvataggio('');
  };

  const handleCreaPasskey = async () => {
    if (!accountId || isSimulazione || loadingPasskey) return;
    setLoadingPasskey(true);
    setMsgPasskey(null);
    try {
      const roleScope: 'volontario' | 'centrale' | 'admin' = isAdminRoot
        ? 'admin'
        : ruoloCorrente === 'admin'
        ? 'centrale'
        : 'volontario';

      const result = await registerAccountPasskey({
        accountId,
        accountName: accountDisplayName,
        roleScope,
        label: etichettaPasskey.trim() || detectDeviceHint(),
        existingCredentialIds: passkeysAccount.map((p) => p.credentialIdB64),
      });

      if (!result.ok) {
        setMsgPasskey({ tipo: 'err', testo: result.error });
        return;
      }

      const nextList = [
        result.record,
        ...passkeysAccount.filter((p) => p.credentialIdB64 !== result.record.credentialIdB64),
      ];
      setPasskeysAccount(nextList);
      onAggiornaPasskeysAccount(accountId, nextList);
      setEtichettaPasskey(detectDeviceHint());
      setMsgPasskey({
        tipo: 'ok',
        testo: `Passkey "${result.record.label}" creata! Ora puoi accedere direttamente con Impronta Digitale o Face ID.`,
      });
    } finally {
      setLoadingPasskey(false);
    }
  };

  const handleEliminaPasskey = (credentialIdB64: string) => {
    if (!accountId || isSimulazione) return;
    removeLocalPasskey(credentialIdB64);
    const nextList = passkeysAccount.filter((p) => p.credentialIdB64 !== credentialIdB64);
    setPasskeysAccount(nextList);
    onAggiornaPasskeysAccount(accountId, nextList);
    setMsgPasskey({
      tipo: 'ok',
      testo: 'Passkey rimossa dall\'account.',
    });
  };

  const emailNotificheAttiva =
    (volontario?.emailNotifiche || '').trim() || (volontario?.email || '').trim() || 'Nessuna email configurata';

  const datiSolaLettura: Array<{ label: string; value?: string; badge?: string }> = isAdminRoot
    ? [
        { label: 'Account', value: 'Amministratore Centrale' },
        { label: 'Livello Accesso', value: 'Amministratore Completo di Sistema' },
        { label: 'Modalità Attiva', value: 'Centrale Operativa & Amministrazione' },
      ]
    : [
        { label: 'Nome e Cognome', value: `${volontario?.nome || ''} ${volontario?.cognome || ''}`.trim() },
        { label: 'Matricola', value: volontario?.matricola || 'Non assegnata' },
        { label: 'Qualifica', value: volontario?.qualifica || 'Volontario' },
        { label: 'Carica Consiglio Direttivo', value: volontario?.caricaConsiglioDirettivo || 'Nessuna carica' },
        { label: 'Sezione Territoriale', value: volontario?.sezioneAppartenenzaNome || 'Non specificata' },
        { label: 'Codice Fiscale', value: volontario?.codiceFiscale || 'Non registrato' },
        { label: 'Data di Nascita', value: volontario?.dataNascita || 'Non registrata' },
        {
          label: 'Luogo di Nascita',
          value:
            [volontario?.comuneNascita, volontario?.provinciaNascita ? `(${volontario.provinciaNascita})` : '']
              .filter(Boolean)
              .join(' ') || 'Non registrato',
        },
        {
          label: 'Residenza / Indirizzo',
          value: volontario?.indirizzoResidenza || 'Non registrata',
        },
        { label: 'Telefono / Cellulare', value: volontario?.telefono || 'Non registrato' },
        {
          label: 'Email Anagrafica (Gestione Volontari)',
          value: volontario?.email || 'Non registrata',
          badge: 'Sola Lettura',
        },
        {
          label: 'Email Notifiche Attiva',
          value: emailNotificheAttiva,
          badge: volontario?.emailNotifiche ? 'Personalizzata' : 'Come Anagrafica',
        },
        {
          label: 'Patente di Guida',
          value: volontario?.patente?.inPossesso
            ? `${volontario.patente.categoria || 'Cat. B'}${volontario.patente.numero ? ` • N. ${volontario.patente.numero}` : ''}${volontario.patente.dataScadenza ? ` • Scad. ${volontario.patente.dataScadenza}` : ''}`
            : 'Non registrata',
        },
        {
          label: 'Mansioni Abilitate',
          value:
            Array.isArray(volontario?.mansioni) && volontario.mansioni.length > 0
              ? volontario.mansioni.join(', ')
              : volontario?.mansione || 'Standard da qualifica',
        },
        { label: 'Data Iscrizione / Registrazione', value: volontario?.dataRegistrazione || 'Non registrata' },
      ];

  return (
    <div
      className="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#1d1a60] via-slate-900 to-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                Profilo Account — {accountDisplayName}
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Dati anagrafici in sola lettura, Email Notifiche, Cambio PIN e Passkey (Impronta / Face ID)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Chiudi Profilo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avviso se modalità simulazione */}
        {isSimulazione && (
          <div className="px-4 py-2 bg-fuchsia-950/80 border-b border-fuchsia-500/40 text-fuchsia-200 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-fuchsia-400 shrink-0" />
            <span>
              Modalità Simulazione Account attiva: puoi consultare il profilo in sola lettura, ma le modifiche a PIN, Email Notifiche e Passkey sono disabilitate per sicurezza.
            </span>
          </div>
        )}

        {/* Tab Bar */}
        <div className="px-3 sm:px-5 pt-2.5 pb-2 bg-slate-950/70 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dati')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'dati'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dati Profilo</span>
          </button>

          {!isAdminRoot && (
            <button
              type="button"
              onClick={() => setActiveTab('notifiche')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'notifiche'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Notifiche</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'pin'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>PIN & Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('passkey')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'passkey'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Passkey ({passkeysAccount.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: DATI PERSONALI (SOLA LETTURA) */}
          {activeTab === 'dati' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Scheda Anagrafica in Sola Lettura</strong>
                  I dati riportati qui sotto sono quelli caricati a sistema nella Gestione Volontari e non possono essere modificati da questa schermata. Puoi invece gestire autonomamente l&apos;email per le notifiche, il tuo PIN e le Passkey nelle schede accanto.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {datiSolaLettura.map((item) => (
                  <div
                    key={item.label}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-[13px] font-semibold text-white break-words">
                      {item.value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL NOTIFICHE (SEPARATA DALL'ANAGRAFICA) */}
          {activeTab === 'notifiche' && volontario && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-950/50 border border-sky-500/40 text-xs text-sky-100 space-y-1.5">
                <div className="font-black text-sky-300 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>Email Dedicata alle Notifiche (Indipendente dall&apos;Anagrafica)</span>
                </div>
                <p className="text-sky-100/90 leading-relaxed">
                  L&apos;indirizzo impostato qui verrà utilizzato per inviarti le notifiche via mail dal sistema, <strong>senza modificare in alcun modo</strong> l&apos;email salvata nella tua anagrafica in <em>Gestione Volontari</em>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Email Anagrafica (Gestione Volontari — non modificabile)
                  </div>
                  <div className="text-sm font-bold text-slate-200 truncate">
                    {volontario.email || 'Nessuna email in anagrafica'}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-black text-slate-300 shrink-0">
                  INVARIATA
                </span>
              </div>

              <form onSubmit={handleSalvaEmailNotifiche} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Indirizzo Email per Ricevere Notifiche
                  </label>
                  <input
                    type="email"
                    disabled={isSimulazione}
                    value={emailNotificheInput}
                    onChange={(e) => setEmailNotificheInput(e.target.value)}
                    placeholder={volontario.email || 'es. notifiche.nome@dominio.it'}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400 disabled:opacity-60"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se lasciato vuoto, il sistema continuerà a usare l&apos;email anagrafica ({volontario.email || 'non presente'}).
                  </p>
                </div>

                {msgEmail && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                      msgEmail.tipo === 'ok'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/60 border-red-500/40 text-red-200'
                    }`}
                  >
                    {msgEmail.tipo === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <span>{msgEmail.testo}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSimulazione}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salva Email Notifiche</span>
                  </button>

                  {Boolean(volontario.emailNotifiche) && (
                    <button
                      type="button"
                      disabled={isSimulazione}
                      onClick={handleRipristinaEmailAnagrafica}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Usa Email Anagrafica</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CAMBIO PIN & SALVA PASSWORD */}
          {activeTab === 'pin' && (
            <div className="space-y-5">
              {!isAdminRoot && volontario ? (
                <form
                  onSubmit={handleSalvaNuovoPin}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" />
                      <span>Cambia il tuo PIN Personale (4 cifre)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setMostraPin((p) => !p)}
                      className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {mostraPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{mostraPin ? 'Nascondi' : 'Mostra'}</span>
                    </button>
                  </div>

                  {/* Campo username semantico per consentire al browser / iCloud / Google di aggiornare la password salvata */}
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={accountUsername}
                    readOnly
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        PIN Attuale *
                      </label>
                      <input
                        type={mostraPin ? 'text' : 'password'}
                        name="current-password"
                        autoComplete="current-password"
                        inputMode="numeric"
                        maxLength={4}
                        disabled={isSimulazione}
                        value={pinAttuale}
                        onChange={(e) => setPinAttuale(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center tracking-[0.35em] text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nuovo PIN (4 cifre) *
                      </label>
                      <input
                        type={mostraPin ? 'text' : 'password'}
                        name="new-password"
                        autoComplete="new-password"
                        inputMode="numeric"
                        maxLength={4}
                        disabled={isSimulazione}
                        value={nuovoPin}
                        onChange={(e) => setNuovoPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center tracking-[0.35em] text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Conferma Nuovo PIN *
                      </label>
                      <input
                        type={mostraPin ? 'text' : 'password'}
                        name="confirm-password"
                        autoComplete="new-password"
                        inputMode="numeric"
                        maxLength={4}
                        disabled={isSimulazione}
                        value={confermaPin}
                        onChange={(e) => setConfermaPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center tracking-[0.35em] text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {msgPin && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                        msgPin.tipo === 'ok'
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                          : 'bg-red-950/60 border-red-500/40 text-red-200'
                      }`}
                    >
                      {msgPin.tipo === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <span>{msgPin.testo}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSimulazione}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>Aggiorna PIN Personale</span>
                  </button>
                </form>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
                  Il PIN fisso dell&apos;account <strong>Amministratore Centrale</strong> è gestito a livello di sistema. Puoi comunque salvare la password nel browser qui sotto o creare una o più <strong>Passkey (Impronta / Face ID)</strong> nella scheda Passkey.
                </div>
              )}

              {/* Sezione Salva Password nel Gestore Password del dispositivo */}
              <form
                onSubmit={handleSalvaNelGestorePassword}
                className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-3"
              >
                <div>
                  <h3 className="text-sm font-black text-indigo-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Salva Password / PIN nel Gestore Password del Dispositivo</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Consente a Chrome, Google Password Manager, Safari / Portachiavi iCloud o Edge di memorizzare le tue credenziali per il riempimento automatico al login.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Nome Account</label>
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={accountUsername}
                      readOnly
                      className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Inserisci il tuo PIN da salvare
                    </label>
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      inputMode="numeric"
                      maxLength={8}
                      disabled={isSimulazione}
                      value={pinPerSalvataggio}
                      onChange={(e) => setPinPerSalvataggio(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="Digita il tuo PIN"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-center tracking-[0.3em] text-sm focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {msgSalvaPwd && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold border ${
                      msgSalvaPwd.tipo === 'ok'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : msgSalvaPwd.tipo === 'info'
                        ? 'bg-sky-950/60 border-sky-500/40 text-sky-200'
                        : 'bg-red-950/60 border-red-500/40 text-red-200'
                    }`}
                  >
                    {msgSalvaPwd.testo}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSimulazione}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva nel Gestore Password</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: PASSKEY (IMPRONTA DIGITALE / FACE ID) */}
          {activeTab === 'passkey' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-black text-emerald-300 flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 shrink-0" />
                    <span>Accesso Diretto con Impronta Digitale / Face ID</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                      webAuthnReady
                        ? platformBiometricReady
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {webAuthnReady
                      ? platformBiometricReady
                        ? 'Biometria Dispositivo Pronta'
                        : 'Passkey Supportate'
                      : 'Non Supportato su questo Browser'}
                  </span>
                </div>
                <p className="text-emerald-100/90 leading-relaxed">
                  Puoi creare <strong>una o più Passkey</strong> (ad esempio una sul tuo smartphone con Impronta / Face ID e una sul PC o tablet). Le chiavi biometriche restano protette nel chip di sicurezza del dispositivo e ti permettono di entrare direttamente nel tuo account senza digitare il PIN.
                </p>
              </div>

              {/* Form crea nuova Passkey */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  Nome del Dispositivo / Passkey (es. &quot;iPhone Face ID&quot;, &quot;Android Impronta&quot;, &quot;PC Ufficio&quot;)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    disabled={isSimulazione || loadingPasskey || !webAuthnReady}
                    value={etichettaPasskey}
                    onChange={(e) => setEtichettaPasskey(e.target.value)}
                    placeholder="Es. Smartphone Personale (Impronta)"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isSimulazione || loadingPasskey || !webAuthnReady}
                    onClick={handleCreaPasskey}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{loadingPasskey ? 'Conferma sul dispositivo...' : 'Crea Passkey'}</span>
                  </button>
                </div>

                {msgPasskey && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 border ${
                      msgPasskey.tipo === 'ok'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/60 border-red-500/40 text-red-200'
                    }`}
                  >
                    {msgPasskey.tipo === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <span>{msgPasskey.testo}</span>
                  </div>
                )}
              </div>

              {/* Elenco Passkey registrate */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Passkey Attive su questo Account ({passkeysAccount.length})
                </div>

                {passkeysAccount.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-dashed border-slate-700 text-center text-xs text-slate-400">
                    Nessuna Passkey ancora creata. Premi &quot;Crea Passkey&quot; qui sopra per abilitare l&apos;accesso rapido con Impronta Digitale o Face ID.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {passkeysAccount.map((pk) => (
                      <div
                        key={pk.credentialIdB64}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate">{pk.label}</div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              Creata il {pk.createdAt}
                              {pk.lastUsedAt ? ` • Ultimo accesso: ${pk.lastUsedAt}` : ''}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSimulazione}
                          onClick={() => handleEliminaPasskey(pk.credentialIdB64)}
                          className="p-2 rounded-lg bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                          title="Rimuovi questa Passkey"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
