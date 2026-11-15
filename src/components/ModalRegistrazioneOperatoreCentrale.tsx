import React, { useState } from 'react';
import { UserPlus, Radio, KeyRound, Phone, User, ShieldAlert, X, AlertTriangle, CheckCircle2, Mail, PenTool } from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import { CroceOroLogo } from './CroceOroLogo';
import { SignaturePad } from './SignaturePad';
import { UploadFirmaTrasparente } from './UploadFirmaTrasparente';
import { formatDateItaly, formatDateTimeItaly } from '../utils/italianTime';

interface ModalRegistrazioneOperatoreCentraleProps {
  isOpen: boolean;
  onClose: () => void;
  volontariEsistenti: Volontario[];
  onRegistra: (nuovo: Volontario) => void;
}

export const ModalRegistrazioneOperatoreCentrale: React.FC<ModalRegistrazioneOperatoreCentraleProps> = ({
  isOpen,
  onClose,
  volontariEsistenti,
  onRegistra
}) => {
  // Calcolo slot operatori centrale (massimo 10 slot oltre all'account amministratore)
  const operatoriCentrale = volontariEsistenti.filter(
    v => v.profiloCentrale || v.qualifica === 'Operatore Centrale'
  );
  const slotLiberi = Math.max(0, 10 - operatoriCentrale.length);

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const nextNum = Math.min(10, operatoriCentrale.length + 1);
  const [matricola, setMatricola] = useState(nextNum < 10 ? `OP-0${nextNum}` : `OP-${nextNum}`);
  const [pin, setPin] = useState('');
  const [confermaPin, setConfermaPin] = useState('');
  const [firmaDigitale, setFirmaDigitale] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);

    if (slotLiberi <= 0) {
      setErrore("Tutti i 10 slot per Operatori Centrale sono già occupati. Contatta l'Amministratore per liberare uno slot.");
      return;
    }

    if (!nome.trim() || !cognome.trim()) {
      setErrore("Inserisci nome e cognome completi.");
      return;
    }

    if (!telefono.trim() || telefono.trim().length < 6) {
      setErrore("Il numero di telefono cellulare è obbligatorio.");
      return;
    }

    const emailPulita = email.trim().toLowerCase();
    if (!emailPulita || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPulita)) {
      setErrore("L'indirizzo email è obbligatorio e deve essere valido (es. nome@dominio.it).");
      return;
    }

    const pinPulito = pin.trim();
    if (!/^\d{4}$/.test(pinPulito)) {
      setErrore("Il codice PIN deve essere composto esattamente da 4 cifre numeriche.");
      return;
    }

    if (pinPulito === '4451') {
      setErrore("Questo codice PIN è riservato all'Amministrazione della Centrale. Scegli un codice diverso.");
      return;
    }

    if (pinPulito !== confermaPin.trim()) {
      setErrore("I due codici PIN inseriti non coincidono. Verifica e riprova.");
      return;
    }

    // Verifica collisione PIN con altri volontari o operatori
    const pinGiaUsato = volontariEsistenti.some(v => v.pin === pinPulito);
    if (pinGiaUsato) {
      setErrore("Questo codice PIN è già stato assegnato a un altro profilo o volontario. Scegline uno differente.");
      return;
    }

    // Verifica obbligatorietà firma digitale sullo schermo del device
    if (!firmaDigitale || !firmaDigitale.trim()) {
      setErrore("Firma obbligatoria sullo schermo del dispositivo: per completare la registrazione devi apporre la tua firma autografa. Finché non completi la firma non puoi entrare.");
      return;
    }

    const dataOraStr = formatDateTimeItaly(undefined, false);

    const nuovoOperatore: Volontario = {
      id: `op-centrale-${Date.now()}`,
      nome: nome.trim(),
      cognome: cognome.trim(),
      matricola: matricola.trim() || `OP-0${operatoriCentrale.length + 1}`,
      qualifica: 'Operatore Centrale',
      telefono: telefono.trim(),
      email: emailPulita,
      pin: pinPulito,
      dataRegistrazione: formatDateItaly(),
      inTurno: false,
      profiloCentrale: true,
      approvato: false, // In attesa di approvazione dell'amministratore
      dataRichiestaApprovazione: dataOraStr,
      firmaBase64: firmaDigitale
    };

    onRegistra(nuovoOperatore);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 sm:p-7 max-w-lg w-full text-white shadow-2xl relative my-auto">
        {/* Pulsante Chiusura */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Intestazione */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
            <Radio className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                Nuovo Profilo Centrale
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                slotLiberi > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}>
                {slotLiberi > 0 ? `${slotLiberi} di 10 slot disponibili` : 'Tutti i 10 slot occupati'}
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-1">
              Registrazione Operatore Centrale
            </h3>
            <p className="text-xs text-slate-400">
              Registra un nuovo profilo operatore direttamente da questo dispositivo.
            </p>
          </div>
        </div>

        {/* Box informativo sulla procedura di approvazione */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-5 text-xs text-amber-200/90 flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-amber-300 block mb-0.5">Procedura di sicurezza con approvazione:</strong>
            Una volta completata la registrazione dal device, verrà inviata una notifica all'<strong>Account Amministratore</strong>.
            Fino alla convalida dell'amministratore, l'account rimarrà nella schermata <em>"account in attivazione"</em>.
          </div>
        </div>

        {slotLiberi <= 0 ? (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 text-center space-y-3">
            <p className="text-sm font-bold text-red-300">
              Non ci sono ulteriori slot liberi per nuovi Operatori Centrale (limite massimo: 10 operatori).
            </p>
            <p className="text-xs text-slate-400">
              L'Account Amministratore deve prima liberare o eliminare un operatore esistente dal Database Volontari.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
            >
              Chiudi
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                  Nome <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Es. Marco"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                  Cognome <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={cognome}
                    onChange={(e) => setCognome(e.target.value)}
                    placeholder="Es. Rossi"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                  Telefono Cellulare <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Es. 333 1234567"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                  Email Personale <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Es. operatore@email.it"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">
                Sigla Operatore / Matricola
              </label>
              <input
                type="text"
                value={matricola}
                onChange={(e) => setMatricola(e.target.value)}
                placeholder="Es. OP-01"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Configurazione PIN */}
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                <KeyRound className="w-4 h-4 text-amber-400" /> Scegli il tuo codice PIN personale (4 cifre)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    PIN (4 cifre numeriche)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-base tracking-widest font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1">
                    Conferma PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={confermaPin}
                    onChange={(e) => setConfermaPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full text-center py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-base tracking-widest font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                * Questo codice ti permetterà di accedere come Operatore Centrale una volta approvato.
              </p>
            </div>

            {/* Sezione Firma Digitale Autografa Obbligatoria (Upload File con rimozione bianco o Disegno) */}
            <div className="pt-1">
              <UploadFirmaTrasparente
                label="Firma Digitale Autografa (Carica Immagine o Disegna)"
                sottotitolo="Carica una foto/scansione della firma (lo sfondo bianco verrà rimosso automaticamente rendendola trasparente) oppure disegnala sul display."
                valoreIniziale={firmaDigitale}
                onFirmaCambiata={(dataUrl) => {
                  setFirmaDigitale(dataUrl);
                  if (dataUrl) setErrore(null);
                }}
              />
            </div>

            {errore && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs font-bold text-center">
                {errore}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-all"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-slate-950" />
                <span>Invia Richiesta Iscrizione</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
