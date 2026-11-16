import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import { getCurrentYearItaly } from '../utils/italianTime';
import {
  verificaTicketResetPinFirestore,
  completaTicketResetPinFirestore,
  isValidPinResetTokenFormat,
} from '../services/firebase';

interface VolontarioInfo {
  id: string;
  nome: string;
  cognome: string;
  qualifica: string;
  email?: string;
  pinProvvisorio?: string;
}

function estraiParametriReset(): { id: string; token: string } {
  const urlParams = new URLSearchParams(window.location.search || '');
  let id = (urlParams.get('id') || '').trim();
  let token = (urlParams.get('token') || urlParams.get('resetToken') || urlParams.get('token_reset') || '').trim();

  if ((!id || !token) && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1];
    const hashParams = new URLSearchParams(hashQuery);
    id = id || (hashParams.get('id') || '').trim();
    token = token || (hashParams.get('token') || hashParams.get('resetToken') || hashParams.get('token_reset') || '').trim();
  }

  return { id, token };
}

export const PaginaWebResetPinStandalone: React.FC = () => {
  const [caricamento, setCaricamento] = useState(true);
  const [volontario, setVolontario] = useState<VolontarioInfo | null>(null);
  const [erroreToken, setErroreToken] = useState<string | null>(null);
  const [hasFirestoreTicket, setHasFirestoreTicket] = useState(false);
  const [hasExpressMatch, setHasExpressMatch] = useState(false);

  // Form states
  const [pinProvvisorioInput, setPinProvvisorioInput] = useState('');
  const [nuovoPin, setNuovoPin] = useState('');
  const [confermaPin, setConfermaPin] = useState('');
  const [mostraPin, setMostraPin] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);
  const [successo, setSuccesso] = useState(false);

  // Estrai parametri da URL e verifica su Cloud Firestore + Express
  useEffect(() => {
    let attivo = true;

    async function verificaLink() {
      try {
        const { id, token } = estraiParametriReset();
        if (!token) {
          if (attivo) {
            setErroreToken('Link di attivazione non valido o incompleto. Assicurati di aver aperto il link completo ricevuto via email.');
            setCaricamento(false);
          }
          return;
        }

        // 1. Verifica prioritaria su Cloud Firestore (funziona anche su Vercel e senza account Google / AI Studio)
        let fsFoundPending = false;
        let fsAlreadyCompleted = false;
        let fsVol: VolontarioInfo | null = null;

        if (isValidPinResetTokenFormat(token)) {
          try {
            const fsRes = await verificaTicketResetPinFirestore(token);
            if (fsRes.found && fsRes.ticket) {
              const t = fsRes.ticket;
              if (t.status === 'completed' || t.status === 'applied') {
                fsAlreadyCompleted = true;
                fsVol = {
                  id: t.volunteerId || id,
                  nome: t.displayName || 'Volontario',
                  cognome: '',
                  qualifica: t.qualifica || 'Operatore',
                };
              } else {
                fsFoundPending = true;
                fsVol = {
                  id: t.volunteerId || id,
                  nome: t.displayName || 'Volontario',
                  cognome: '',
                  qualifica: t.qualifica || 'Operatore',
                };
              }
            }
          } catch {
            // Prosegue verificando eventuale backend Express locale
          }
        }

        // 2. Verifica opzionale su backend Express (ignora catch-all Vercel mode === 'cloud-firestore')
        let expVol: VolontarioInfo | null = null;
        let expErrorMsg: string | null = null;
        if (id) {
          try {
            const res = await fetch(`/api/volontari/verifica-token-reset?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, {
              cache: 'no-store',
            });
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const data = await res.json();
              if (data?.mode !== 'cloud-firestore') {
                if (res.ok && data.success && data.volontario) {
                  expVol = data.volontario;
                } else if (data?.error) {
                  expErrorMsg = data.error;
                }
              }
            }
          } catch {
            // Nessun backend Express attivo (es. hosting statico / Vercel)
          }
        }

        if (!attivo) return;

        if (fsAlreadyCompleted && !expVol) {
          setVolontario(fsVol);
          setSuccesso(true);
          setCaricamento(false);
          return;
        }

        if (fsFoundPending || expVol) {
          setHasFirestoreTicket(fsFoundPending);
          setHasExpressMatch(Boolean(expVol));
          const scelto = expVol || fsVol!;
          setVolontario(scelto);
          if (expVol?.pinProvvisorio) {
            setPinProvvisorioInput(expVol.pinProvvisorio);
          }
        } else {
          setErroreToken(
            expErrorMsg ||
              'Il link di attivazione utilizzato non è più valido, è scaduto oppure il PIN personale è già stato impostato.'
          );
        }
      } catch {
        if (attivo) {
          setErroreToken('Errore durante la lettura del link di attivazione.');
        }
      } finally {
        if (attivo) {
          setCaricamento(false);
        }
      }
    }

    verificaLink();
    return () => {
      attivo = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroreForm(null);

    if (!volontario) {
      setErroreForm('Profilo non identificato.');
      return;
    }

    const pinProvv = pinProvvisorioInput.trim();
    const pinNuovo = nuovoPin.trim();
    const pinConf = confermaPin.trim();

    if (!/^\d{4}$/.test(pinProvv)) {
      setErroreForm('Inserisci il PIN provvisorio a 4 cifre ricevuto nella email.');
      return;
    }

    if (!/^\d{4}$/.test(pinNuovo)) {
      setErroreForm('Il nuovo PIN deve essere composto da esattamente 4 cifre numeriche (es. 2849).');
      return;
    }

    if (pinNuovo === '4451') {
      setErroreForm('Questo codice PIN è riservato al sistema. Scegli un codice a 4 cifre differente.');
      return;
    }

    if (pinNuovo !== pinConf) {
      setErroreForm('I due campi del nuovo PIN non coincidono. Verifica e ridigita.');
      return;
    }

    if (pinProvv === pinNuovo) {
      setErroreForm('Il nuovo PIN deve essere diverso dal PIN provvisorio assegnato.');
      return;
    }

    setInviando(true);
    try {
      const { token } = estraiParametriReset();
      let savedInFirestore = false;
      let savedInExpress = false;
      let firestoreErrMsg: string | null = null;
      let expressErrMsg: string | null = null;

      if (hasFirestoreTicket && isValidPinResetTokenFormat(token)) {
        try {
          await completaTicketResetPinFirestore(token, pinProvv, pinNuovo);
          savedInFirestore = true;
        } catch (fsErr: any) {
          const msg = String(fsErr?.message || '');
          if (msg.includes('Missing or insufficient permissions') || msg.includes('PERMISSION_DENIED')) {
            firestoreErrMsg = 'Il PIN Provvisorio inserito non corrisponde a quello ricevuto nella email oppure il link è già stato utilizzato.';
          } else {
            firestoreErrMsg = fsErr?.message || 'Errore salvataggio Cloud.';
          }
        }
      }

      if (hasExpressMatch || !savedInFirestore) {
        try {
          const res = await fetch('/api/volontari/reset-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: volontario.id,
              token,
              pinProvvisorio: pinProvv,
              nuovoPin: pinNuovo
            })
          });
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const data = await res.json();
            if (data?.mode !== 'cloud-firestore') {
              if (res.ok && data.success) {
                savedInExpress = true;
              } else if (data?.error) {
                expressErrMsg = data.error;
              }
            }
          }
        } catch {
          // Express non raggiungibile su hosting statico
        }
      }

      if (savedInFirestore || savedInExpress) {
        setSuccesso(true);
      } else {
        setErroreForm(firestoreErrMsg || expressErrMsg || 'Errore durante il salvataggio del nuovo PIN. Riprova tra poco.');
      }
    } catch {
      setErroreForm('Errore di connessione con il server. Verifica la connessione e riprova.');
    } finally {
      setInviando(false);
    }
  };

  return (
    // Sfondo rigorosamente BIANCO per compatibilità totale con browser web desktop e versioni meno recenti di Chrome / Firefox
    <div
      style={{
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header Istituzionale ad Alto Contrasto */}
      <header style={{ maxWidth: '520px', margin: '0 auto', width: '100%', textAlign: 'center', paddingTop: '16px', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '2px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
            <CroceOroLogo size="xl" className="w-20 h-20 sm:w-24 sm:h-24" />
          </div>
          <div>
            <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '900', color: '#1d1a60', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Croce Oro Massa Carrara
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#b45309', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Organizzazione di Volontariato &bull; OdV
            </p>
            <div
              style={{
                display: 'inline-block',
                marginTop: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#334155',
                fontWeight: '700'
              }}
            >
              Portale Riservato &bull; Attivazione Credenziali Operative
            </div>
          </div>
        </div>
      </header>

      {/* Corpo Principale in Scheda Bianca Protetta */}
      <main style={{ maxWidth: '480px', margin: 'auto', width: '100%' }}>
        {caricamento ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #e2e8f0',
              borderRadius: '24px',
              padding: '36px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.08)'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '4px solid #f59e0b',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                margin: '0 auto 16px auto',
                animation: 'spin 1s linear infinite'
              }}
            />
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: '700' }}>
              Verifica del link di attivazione in corso...
            </p>
          </div>
        ) : erroreToken ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #ef4444',
              borderRadius: '24px',
              padding: '28px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(239, 68, 68, 0.12)'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                border: '2px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#dc2626'
              }}
            >
              <AlertTriangle style={{ width: '32px', height: '32px' }} />
            </div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '900', color: '#991b1b', textTransform: 'uppercase' }}>
              Accesso Non Disponibile
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
              {erroreToken}
            </p>
            <div
              style={{
                padding: '14px',
                backgroundColor: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#475569',
                lineHeight: '1.5'
              }}
            >
              Se hai bisogno di un nuovo link o credenziali, contatta la <strong>Centrale Operativa</strong> o la <strong>Segreteria</strong> della Croce Oro Massa Carrara.
            </div>
          </div>
        ) : successo ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #16a34a',
              borderRadius: '24px',
              padding: '32px 24px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(22, 163, 74, 0.15)'
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                border: '3px solid #16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#15803d'
              }}
            >
              <CheckCircle2 style={{ width: '44px', height: '44px' }} />
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: '11px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Attivazione Completata
              </span>
              <h2 style={{ margin: '10px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#14532d', textTransform: 'uppercase' }}>
                Nuovo PIN Personale Impostato!
              </h2>
            </div>
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '18px',
                borderRadius: '16px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#1e293b',
                marginTop: '20px',
                textAlign: 'left',
                lineHeight: '1.6'
              }}
            >
              <p style={{ margin: '0 0 8px 0' }}>
                Gentile <strong>{volontario?.nome} {volontario?.cognome}</strong>, il tuo account operativo è stato attivato con successo e il tuo nuovo PIN a 4 cifre è stato salvato nel database protetto.
              </p>
              <p style={{ margin: 0, color: '#1d1a60', fontWeight: '800', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                📲 Da adesso potrai utilizzare questo codice PIN personale direttamente sui tablet e dispositivi operativi dell'Associazione.
              </p>
            </div>
            <p style={{ margin: '18px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Puoi chiudere questa scheda del browser in tutta sicurezza.
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #1d1a60',
              borderRadius: '24px',
              padding: '24px 20px',
              boxShadow: '0 12px 30px rgba(29, 26, 96, 0.12)'
            }}
          >
            {/* Profilo Info */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '14px 16px',
                borderRadius: '16px',
                border: '1px solid #cbd5e1',
                marginBottom: '16px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.5px' }}>
                Account in Attivazione
              </span>
              <h2 style={{ margin: '4px 0', fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                {volontario?.nome} {volontario?.cognome}
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                <span>Qualifica: <strong style={{ color: '#0f172a' }}>{volontario?.qualifica}</strong></span>
              </p>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
              Per garantire riservatezza e sicurezza operativa, definisci ora il tuo <strong>PIN Personale a 4 cifre</strong> che utilizzerai per accedere ai terminali dell'Associazione.
            </p>

            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* PIN Provvisorio (pre-compilato o da confermare) */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#334155', marginBottom: '6px' }}>
                  <span>1. PIN Provvisorio (dalla mail)</span>
                  <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '700' }}>Verifica Identità</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="off"
                  name="pin_provvisorio_input"
                  id="pin_provvisorio_input"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={pinProvvisorioInput}
                  onChange={(e) => {
                    setPinProvvisorioInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setErroreForm(null);
                  }}
                  placeholder="••••"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '2px solid #64748b',
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '20px',
                    fontWeight: '800',
                    textAlign: 'center',
                    letterSpacing: '6px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    WebkitTextSecurity: 'disc',
                    MozTextSecurity: 'disc'
                  } as React.CSSProperties}
                  required
                />
              </div>

              {/* Nuovo PIN */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#1d1a60', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <KeyRound style={{ width: '14px', height: '14px', color: '#d97706' }} />
                    <span>2. Nuovo PIN Personale (4 cifre)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostraPin(!mostraPin)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#475569',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {mostraPin ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                    <span>{mostraPin ? 'Nascondi' : 'Mostra'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="off"
                  name="nuovo_codice_pin"
                  id="nuovo_codice_pin"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={nuovoPin}
                  onChange={(e) => {
                    setNuovoPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setErroreForm(null);
                  }}
                  placeholder="••••"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '2px solid #1d1a60',
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '22px',
                    fontWeight: '900',
                    textAlign: 'center',
                    letterSpacing: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    ...(mostraPin ? {} : { WebkitTextSecurity: 'disc', MozTextSecurity: 'disc' })
                  } as React.CSSProperties}
                  required
                />
              </div>

              {/* Conferma Nuovo PIN */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#1d1a60', marginBottom: '6px' }}>
                  3. Conferma Nuovo PIN Personale
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="off"
                  name="conferma_nuovo_codice_pin"
                  id="conferma_nuovo_codice_pin"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={confermaPin}
                  onChange={(e) => {
                    setConfermaPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setErroreForm(null);
                  }}
                  placeholder="••••"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '2px solid #1d1a60',
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    fontSize: '22px',
                    fontWeight: '900',
                    textAlign: 'center',
                    letterSpacing: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    ...(mostraPin ? {} : { WebkitTextSecurity: 'disc', MozTextSecurity: 'disc' })
                  } as React.CSSProperties}
                  required
                />
              </div>

              {erroreForm && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#fef2f2',
                    border: '2px solid #ef4444',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#b91c1c',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertTriangle style={{ width: '18px', height: '18px', color: '#dc2626', flexShrink: 0 }} />
                  <span>{erroreForm}</span>
                </div>
              )}

              {/* Pulsante Principale di Salvataggio ad Alto Contrasto e Massima Visibilità */}
              <button
                type="submit"
                disabled={inviando || nuovoPin.length !== 4 || confermaPin.length !== 4}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: (inviando || nuovoPin.length !== 4 || confermaPin.length !== 4) ? '#94a3b8' : '#1d1a60',
                  color: (inviando || nuovoPin.length !== 4 || confermaPin.length !== 4) ? '#ffffff' : '#fbbf24',
                  border: '2px solid #fbbf24',
                  fontSize: '14px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 6px 16px rgba(29, 26, 96, 0.25)',
                  cursor: (inviando || nuovoPin.length !== 4 || confermaPin.length !== 4) ? 'not-allowed' : 'pointer',
                  marginTop: '8px'
                }}
              >
                {inviando ? (
                  <span>Salvataggio PIN in corso...</span>
                ) : (
                  <>
                    <ShieldCheck style={{ width: '20px', height: '20px', color: '#fbbf24' }} />
                    <span>Salva Nuovo PIN ed Attiva Profilo</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer Istituzionale */}
      <footer style={{ maxWidth: '520px', margin: '0 auto', width: '100%', textAlign: 'center', paddingTop: '24px', paddingBottom: '8px', fontSize: '11px', color: '#64748b' }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: '700' }}>
          &copy; {getCurrentYearItaly()} Croce Oro Massa Carrara OdV &bull; Centrale Operativa Radio & Emergenze
        </p>
        <p style={{ margin: 0, color: '#94a3b8' }}>
          Comunicazione istituzionale cifrata &bull; Portale Attivazione Credenziali
        </p>
      </footer>
    </div>
  );
};
