import React, { useState } from 'react';
import { KeyRound, Mail, X, CheckCircle2, AlertTriangle, User, Loader2 } from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import { CroceOroLogo } from './CroceOroLogo';
import { isAccessoDaWeb } from '../utils/accessoWeb';
import {
  completaTicketResetPinFirestore,
  completaResetPinProfiloFirestore,
  isValidPinResetTokenFormat
} from '../services/firebase';
import { buildEmailResetHash, buildPinResetHash } from '../utils/hashReset';
import { realtime } from '../services/realtime';

interface ModalResetPasswordProps {
  isOpen: boolean;
  onClose: () => void;
  volontari: Volontario[];
  volontarioPreselezionato?: Volontario | null;
  onAggiornaVolontari: (nuoviVolontari: Volontario[]) => void;
  onNotificaRadio: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const ModalResetPassword: React.FC<ModalResetPasswordProps> = ({
  isOpen,
  onClose,
  volontari,
  volontarioPreselezionato = null,
  onAggiornaVolontari,
  onNotificaRadio
}) => {
  const [selezionatoId, setSelezionatoId] = useState<string>(
    volontarioPreselezionato ? volontarioPreselezionato.id : (volontari[0]?.id || '')
  );
  const [nuovoPin, setNuovoPin] = useState('');
  const [confermaPin, setConfermaPin] = useState('');
  const [confermaEmail, setConfermaEmail] = useState('');
  const [pinProvvisorioInput, setPinProvvisorioInput] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [salvaInCorso, setSalvaInCorso] = useState(false);
  const [successo, setSuccesso] = useState(false);

  // Aggiorna la selezione se viene passato un volontario specifico
  React.useEffect(() => {
    if (volontarioPreselezionato) {
      setSelezionatoId(volontarioPreselezionato.id);
    }
  }, [volontarioPreselezionato]);

  if (!isOpen) return null;

  const volontarioAttuale = volontari.find(v => v.id === selezionatoId) || volontari[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvaInCorso) return;
    setErrore(null);

    if (!volontarioAttuale) {
      setErrore('Seleziona il tuo profilo.');
      return;
    }

    const emailRegistrata = (volontarioAttuale.email || '').trim().toLowerCase();
    const emailInput = confermaEmail.trim().toLowerCase();
    const pinProvvInputPulito = pinProvvisorioInput.trim();

    if (!emailInput && !pinProvvInputPulito) {
      setErrore("Inserisci il PIN Provvisorio ricevuto nell'email oppure il tuo indirizzo email registrato.");
      return;
    }

    const pinPulito = nuovoPin.trim();
    if (!/^\d{4}$/.test(pinPulito)) {
      setErrore('Il nuovo PIN deve essere esattamente di 4 cifre numeriche (es. 1234).');
      return;
    }

    if (pinPulito === '4451') {
      setErrore('Questo codice PIN è riservato. Scegli un codice diverso.');
      return;
    }

    if (pinPulito !== confermaPin.trim()) {
      setErrore('I due codici PIN digitati non coincidono.');
      return;
    }

    setSalvaInCorso(true);

    try {
      const oldToken = volontarioAttuale.resetToken;
      const emailMatch = Boolean(emailRegistrata && emailInput && emailInput === emailRegistrata);
      const pinProvvMatch = Boolean(
        volontarioAttuale.pin && pinProvvInputPulito && pinProvvInputPulito === String(volontarioAttuale.pin).trim()
      );
      const localMatch = emailMatch || pinProvvMatch;

      let verifiedByFirestoreProfile = false;
      let emailVerifiedByCloud = false;
      let verifiedByFirestoreTicket = false;
      let verifiedByExpress = false;

      // 1. Verifica crittografica zero-PII su Cloud Firestore (funziona anche senza account Google e anche con cache telefono non aggiornata)
      const candidateProofs: Array<{ hash: string; kind: 'pin' | 'email' }> = [];
      if (/^\d{4}$/.test(pinProvvInputPulito)) {
        const pHash = buildPinResetHash(volontarioAttuale.id, pinProvvInputPulito);
        if (pHash) candidateProofs.push({ hash: pHash, kind: 'pin' });
      }
      if (emailInput && emailInput.includes('@')) {
        const eHash = buildEmailResetHash(emailInput);
        if (eHash) candidateProofs.push({ hash: eHash, kind: 'email' });
      }

      for (const candidate of candidateProofs) {
        const res = await completaResetPinProfiloFirestore(volontarioAttuale.id, candidate.hash, pinPulito);
        if (res.ok) {
          verifiedByFirestoreProfile = true;
          if (candidate.kind === 'email') emailVerifiedByCloud = true;
          break;
        }
      }

      // 2. Se è presente un ticket token e il PIN provvisorio a 4 cifre, completa anche il ticket one-time
      if (
        oldToken &&
        isValidPinResetTokenFormat(oldToken) &&
        /^\d{4}$/.test(pinProvvInputPulito) &&
        pinProvvInputPulito !== pinPulito
      ) {
        try {
          await completaTicketResetPinFirestore(oldToken, pinProvvInputPulito, pinPulito);
          verifiedByFirestoreTicket = true;
        } catch {
          // Ignora se già applicato/scaduto o non combaciante
        }
      }

      // 3. Verifica/aggiorna anche su server Express (se non su host statico serverless Vercel)
      if (!realtime.isServerlessStatic()) {
        try {
          const baseUrl = realtime.getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/volontari/reset-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: volontarioAttuale.id,
              token: oldToken || '',
              pinProvvisorio: pinProvvInputPulito,
              email: emailInput,
              nuovoPin: pinPulito,
              fromCloudReconciliation: verifiedByFirestoreProfile || verifiedByFirestoreTicket
            }),
            cache: 'no-store'
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data?.success === true && data?.mode !== 'cloud-firestore') {
            verifiedByExpress = true;
          }
        } catch {
          // Rete non disponibile o solo Cloud Firestore
        }
      }

      const isVerified = localMatch || verifiedByFirestoreProfile || verifiedByFirestoreTicket || verifiedByExpress;
      if (!isVerified) {
        setErrore("Il PIN Provvisorio o l'indirizzo email inseriti non corrispondono al profilo selezionato.");
        return;
      }

      // Aggiorna il volontario rimuovendo flag di richiesta reset e provvisorio
      const aggiornati = volontari.map(v => {
        if (v.id === volontarioAttuale.id) {
          return {
            ...v,
            pin: pinPulito,
            ...(emailVerifiedByCloud && emailInput ? { email: emailInput } : {}),
            pinProvvisorio: false,
            richiedeResetPassword: false,
            resetToken: undefined,
            dataRichiestaResetPassword: undefined,
            tentativiErrati: 0,
            bloccatoPerTentativi: false,
            dataBlocco: undefined
          };
        }
        return v;
      });

      onAggiornaVolontari(aggiornati);

      onNotificaRadio(
        `🔐 RESET PIN COMPLETATO: Il profilo ${volontarioAttuale.nome} ${volontarioAttuale.cognome} (${volontarioAttuale.qualifica}) ha aggiornato con successo il proprio PIN di accesso.`,
        'sistema'
      );

      setSuccesso(true);
    } finally {
      setSalvaInCorso(false);
    }
  };

  const handleChiudi = () => {
    if (salvaInCorso) return;
    setNuovoPin('');
    setConfermaPin('');
    setConfermaEmail('');
    setPinProvvisorioInput('');
    setErrore(null);
    setSuccesso(false);
    onClose();
  };

  const isWeb = isAccessoDaWeb();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div
        className={isWeb ? "bg-white border-2 border-amber-600 rounded-3xl p-5 sm:p-7 max-w-md w-full text-slate-900 shadow-2xl relative my-auto" : "bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 sm:p-7 max-w-md w-full text-white shadow-2xl relative my-auto"}
        style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d97706' } : undefined}
      >
        <button
          type="button"
          onClick={handleChiudi}
          aria-label="Chiudi finestra reset"
          className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border z-10 ${
            isWeb ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Intestazione */}
        <div className="flex items-center gap-3 mb-4 pr-10 min-w-0">
          <div className="shrink-0">
            <CroceOroLogo size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`text-sm sm:text-base font-black uppercase tracking-wide flex items-start gap-1.5 leading-tight ${isWeb ? 'text-[#1d1a60]' : 'text-white'}`}>
              <KeyRound className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Reimposta Password / PIN</span>
            </h3>
            <p className={`text-xs mt-0.5 leading-snug ${isWeb ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              Aggiornamento codice di accesso personale
            </p>
          </div>
        </div>

        {successo ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className={`text-base font-black uppercase ${isWeb ? 'text-slate-950' : 'text-white'}`}>PIN Aggiornato con Successo!</h4>
              <p className={`text-xs mt-2 leading-relaxed ${isWeb ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                Il tuo nuovo codice PIN personale a 4 cifre è stato salvato nel database.<br />
                Puoi accedere immediatamente utilizzando il nuovo PIN.
              </p>
            </div>
            <button
              type="button"
              onClick={handleChiudi}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-md active:scale-95 transition-all cursor-pointer border-2 border-amber-700"
              style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
            >
              Chiudi e Torna al Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Profilo */}
            <div>
              <label className={`block text-[11px] font-black uppercase mb-1 flex items-center gap-1.5 ${isWeb ? 'text-slate-800' : 'text-slate-300'}`}>
                <User className="w-3.5 h-3.5 text-amber-500" />
                Seleziona il Tuo Profilo
              </label>
              <select
                value={selezionatoId}
                onChange={(e) => {
                  setSelezionatoId(e.target.value);
                  setErrore(null);
                }}
                style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' } : undefined}
                className={`w-full p-2.5 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                  isWeb ? 'bg-white border-2 border-slate-400 text-slate-900' : 'bg-slate-950 border border-slate-700 text-white'
                }`}
              >
                {volontari.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome} {v.cognome} ({v.qualifica}) {v.richiedeResetPassword ? '⚠️ Reset Richiesto' : ''}
                  </option>
                ))}
              </select>
            </div>

            {volontarioAttuale?.richiedeResetPassword && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                isWeb ? 'bg-amber-100 border-2 border-amber-500 text-amber-950' : 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
              }`}>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black">Invito Reset Ricevuto dall'Amministratore</div>
                  <div className={`text-[11px] mt-0.5 ${isWeb ? 'text-amber-900 font-medium' : 'text-amber-200/80'}`}>
                    L'Amministratore ha autorizzato il reset del tuo codice PIN. Inserisci la tua email e imposta il nuovo PIN.
                  </div>
                </div>
              </div>
            )}

            {/* Verifica Identità (PIN Provvisorio dalla mail oppure Email Registrata) */}
            <div className="space-y-3">
              <div>
                <label className={`block text-[11px] font-black uppercase mb-1 flex items-center gap-1.5 ${isWeb ? 'text-slate-800' : 'text-slate-300'}`}>
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  PIN Provvisorio / Attuale (4 cifre)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinProvvisorioInput}
                  onChange={(e) => setPinProvvisorioInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••• (oppure usa Email sotto)"
                  style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' } : undefined}
                  className={`w-full p-2.5 rounded-xl font-mono text-sm tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                    isWeb ? 'bg-white border-2 border-slate-400 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border border-slate-700 text-white placeholder-slate-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-black uppercase mb-1 flex items-center gap-1.5 ${isWeb ? 'text-slate-800' : 'text-slate-300'}`}>
                  <Mail className="w-3.5 h-3.5 text-amber-500" />
                  Oppure Indirizzo Email Registrato
                </label>
                <input
                  type="email"
                  value={confermaEmail}
                  onChange={(e) => setConfermaEmail(e.target.value)}
                  placeholder="Inserisci la tua email registrata..."
                  style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' } : undefined}
                  className={`w-full p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                    isWeb ? 'bg-white border-2 border-slate-400 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border border-slate-700 text-white placeholder-slate-500'
                  }`}
                />
                <span className={`text-[10px] mt-1 block font-medium ${isWeb ? 'text-slate-600' : 'text-slate-400'}`}>
                  Nessun account Google richiesto: verifica con il PIN provvisorio oppure con la tua email.
                </span>
              </div>
            </div>

            {/* Nuovo PIN */}
            <div className={`grid grid-cols-2 gap-3 pt-1 border-t ${isWeb ? 'border-slate-300' : 'border-slate-800'}`}>
              <div>
                <label className={`block text-[11px] font-black uppercase mb-1 ${isWeb ? 'text-amber-900' : 'text-amber-300'}`}>
                  Nuovo PIN (4 cifre)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={nuovoPin}
                  onChange={(e) => setNuovoPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  style={isWeb ? { backgroundColor: '#ffffff', color: '#78350f', borderColor: '#d97706' } : undefined}
                  className={`w-full p-2.5 rounded-xl font-mono text-center font-black text-base tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                    isWeb ? 'bg-white border-2 border-amber-600 text-amber-950' : 'bg-slate-950 border border-amber-500/50 text-amber-300'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-black uppercase mb-1 ${isWeb ? 'text-amber-900' : 'text-amber-300'}`}>
                  Conferma PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confermaPin}
                  onChange={(e) => setConfermaPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  style={isWeb ? { backgroundColor: '#ffffff', color: '#78350f', borderColor: '#d97706' } : undefined}
                  className={`w-full p-2.5 rounded-xl font-mono text-center font-black text-base tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                    isWeb ? 'bg-white border-2 border-amber-600 text-amber-950' : 'bg-slate-950 border border-amber-500/50 text-amber-300'
                  }`}
                />
              </div>
            </div>

            {errore && (
              <div className="p-2.5 rounded-xl bg-red-100 border-2 border-red-400 text-red-900 text-xs flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errore}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={salvaInCorso}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black text-xs uppercase shadow-md active:scale-95 transition-all cursor-pointer border-2 border-amber-700 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
              >
                {salvaInCorso ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifica...</span>
                  </>
                ) : (
                  <span>Conferma Nuovo PIN</span>
                )}
              </button>
              <button
                type="button"
                disabled={salvaInCorso}
                onClick={handleChiudi}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  isWeb ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Annulla
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
