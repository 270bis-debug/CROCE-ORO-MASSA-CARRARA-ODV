import React, { useState } from 'react';
import { PenTool, KeyRound, ShieldAlert, CheckCircle2, LogOut, Eye, EyeOff, Lock } from 'lucide-react';
import { UploadFirmaTrasparente } from './UploadFirmaTrasparente';
import { Volontario } from './DatabaseVolontariModal';

export interface RisultatoObbligoFirmaEPin {
  firmaBase64?: string;
  nuovoPin?: string;
}

interface ModalObbligoFirmaEPinProps {
  volontario: Volontario;
  contesto?: 'volontario' | 'centrale';
  onCompleta: (risultato: RisultatoObbligoFirmaEPin) => void;
  onAnnullaEdEsci: () => void;
}

export const isFirmaMancante = (v?: { firmaBase64?: string; hasFirma?: boolean } | null): boolean => {
  if (v?.hasFirma === true) return false;
  return !v?.firmaBase64 || v.firmaBase64.trim().length < 20;
};

export const isPinEmergenza = (v?: { pin?: string; pinIsEmergency?: boolean } | null): boolean =>
  String(v?.pin || '').trim() === '0000' || v?.pinIsEmergency === true;

export const richiedeAdeguamentoLogin = (
  v?: { id?: string; firmaBase64?: string; hasFirma?: boolean; pin?: string; pinIsEmergency?: boolean } | null
): boolean => {
  if (!v) return false;
  if (v.id === 'vol-admin' || v.id === 'admin-centrale-root' || String(v.pin || '').trim() === '4451') {
    return false;
  }
  return isFirmaMancante(v) || isPinEmergenza(v);
};

export const ModalObbligoFirmaEPin: React.FC<ModalObbligoFirmaEPinProps> = ({
  volontario,
  contesto = 'volontario',
  onCompleta,
  onAnnullaEdEsci
}) => {
  const mancaFirma = isFirmaMancante(volontario);
  const deveCambiarePin = isPinEmergenza(volontario);

  const [firmaTemp, setFirmaTemp] = useState<string | null>(volontario.firmaBase64 || null);
  const [nuovoPin, setNuovoPin] = useState<string>('');
  const [confermaPin, setConfermaPin] = useState<string>('');
  const [mostraPin, setMostraPin] = useState<boolean>(false);
  const [errore, setErrore] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore('');

    if (mancaFirma) {
      if (!firmaTemp || firmaTemp.trim().length < 20) {
        setErrore(
          "Firma digitale obbligatoria: carica una foto/scansione della tua firma oppure disegnala direttamente sullo schermo prima di procedere."
        );
        return;
      }
    }

    if (deveCambiarePin) {
      const p1 = nuovoPin.trim();
      const p2 = confermaPin.trim();
      if (!/^\d{4}$/.test(p1)) {
        setErrore('Il nuovo PIN personale deve essere composto esattamente da 4 cifre numeriche.');
        return;
      }
      if (p1 === '0000') {
        setErrore('Non puoi mantenere il PIN di emergenza 0000. Scegli un nuovo PIN personale a 4 cifre.');
        return;
      }
      if (p1 === '4451') {
        setErrore('Questo codice PIN è riservato all’amministrazione. Scegli un PIN diverso.');
        return;
      }
      if (p1 !== p2) {
        setErrore('I due PIN inseriti non coincidono. Verifica e reinseriscili.');
        return;
      }
    }

    onCompleta({
      ...(mancaFirma && firmaTemp ? { firmaBase64: firmaTemp } : {}),
      ...(deveCambiarePin ? { nuovoPin: nuovoPin.trim() } : {})
    });
  };

  const titolo =
    mancaFirma && deveCambiarePin
      ? 'Adeguamento Obbligatorio: Firma & Nuovo PIN'
      : mancaFirma
      ? 'Caricamento Obbligatorio Firma Digitale'
      : 'Cambio Obbligatorio PIN di Emergenza (0000)';

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl text-white my-auto max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3 border-b border-slate-800 pb-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
            {mancaFirma ? <PenTool className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              Azione Obbligatoria al Login • {contesto === 'centrale' ? 'Accesso Avanzato / Centrale' : 'App Volontario'}
            </div>
            <h3 className="text-sm sm:text-base font-black text-white uppercase leading-snug mt-0.5">
              {titolo}
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Account: <strong className="text-amber-300">{volontario.nome} {volontario.cognome}</strong>
              {volontario.qualifica ? ` (${volontario.qualifica})` : ''}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-100 text-xs leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            Per accedere ed utilizzare l&apos;app è necessario completare obbligatoriamente{' '}
            {mancaFirma && deveCambiarePin ? (
              <strong>sia il caricamento della propria firma digitale sia la sostituzione del PIN di emergenza (0000)</strong>
            ) : mancaFirma ? (
              <strong>il caricamento della propria firma digitale autografa</strong>
            ) : (
              <strong>la sostituzione del PIN di emergenza (0000) con un nuovo PIN personale a 4 cifre</strong>
            )}
            . Non è possibile proseguire senza aver completato questa operazione.
          </div>
        </div>

        {errore && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-bold text-center">
            {errore}
          </div>
        )}

        {mancaFirma && (
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-300">
              <PenTool className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{deveCambiarePin ? '1. Carica o Disegna la tua Firma Digitale (Obbligatorio)' : 'Carica o Disegna la tua Firma Digitale (Obbligatorio)'}</span>
            </div>
            <UploadFirmaTrasparente
              label="Firma Digitale Autografa"
              sottotitolo="Carica una foto/scansione della firma (lo sfondo bianco verrà rimosso automaticamente) oppure disegnala direttamente sullo schermo."
              valoreIniziale={firmaTemp}
              onFirmaCambiata={(dataUrl) => {
                setFirmaTemp(dataUrl);
                if (dataUrl) setErrore('');
              }}
            />
          </div>
        )}

        {deveCambiarePin && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-red-950/25 border border-red-500/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-red-300">
                <Lock className="w-4 h-4 text-red-400 shrink-0" />
                <span>{mancaFirma ? '2. Sostituisci il PIN di Emergenza 0000 (Obbligatorio)' : 'Sostituisci il PIN di Emergenza 0000 (Obbligatorio)'}</span>
              </div>
              <button
                type="button"
                onClick={() => setMostraPin((v) => !v)}
                className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 cursor-pointer"
              >
                {mostraPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{mostraPin ? 'Nascondi' : 'Mostra'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Il tuo account usa ancora il codice temporaneo di emergenza <strong className="font-mono text-red-300">0000</strong>. Scegli subito un tuo PIN personale segreto di 4 cifre (diverso da 0000).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Nuovo PIN Personale (4 cifre) *
                </label>
                <input
                  type={mostraPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  value={nuovoPin}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNuovoPin(onlyDigits);
                    setErrore('');
                  }}
                  placeholder="Es. 5829"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center text-base tracking-[0.4em] font-black focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Conferma Nuovo PIN *
                </label>
                <input
                  type={mostraPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  value={confermaPin}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfermaPin(onlyDigits);
                    setErrore('');
                  }}
                  placeholder="Ripeti 4 cifre"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center text-base tracking-[0.4em] font-black focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={onAnnullaEdEsci}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Annulla ed Esci</span>
          </button>
          <button
            type="submit"
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {mancaFirma && deveCambiarePin
                ? 'Salva Firma & Nuovo PIN e Accedi'
                : mancaFirma
                ? 'Salva Firma e Accedi'
                : 'Salva Nuovo PIN e Accedi'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
