import React, { useState } from 'react';
import { Radio, Car, Lock, ChevronRight, KeyRound, UserPlus, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Users, Globe } from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import { realtime, ConnectionInfo } from '../services/realtime';
import { APP_VERSION_LABEL } from '../version';
import { Volontario } from './DatabaseVolontariModal';
import { ModalRegistrazioneOperatoreCentrale } from './ModalRegistrazioneOperatoreCentrale';
import { ModalResetPassword } from './ModalResetPassword';
import { isAccessoDaWeb, setPreferenzaAccessoWeb } from '../utils/accessoWeb';
import { PWAInstallButton } from './PWAInstallButton';
import { formatDateTimeItaly } from '../utils/italianTime';

interface SchermataSceltaRuoloProps {
  onSelectVolontario: () => void;
  onSelectAdmin: (pin: string) => boolean | { status: 'approved' | 'pending' | 'invalid'; operatore?: Volontario };
  volontari?: Volontario[];
  onRegistraOperatoreCentrale?: (nuovo: Volontario) => void;
  onMostraAccountInAttivazione?: (op: Volontario) => void;
  onAggiornaVolontari?: (nuoviVolontari: Volontario[]) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onApriDatabase?: () => void;
  infoConnessione?: ConnectionInfo;
  onApriConnessione?: () => void;
}

export const SchermataSceltaRuolo: React.FC<SchermataSceltaRuoloProps> = ({
  onSelectVolontario,
  onSelectAdmin,
  volontari = [],
  onRegistraOperatoreCentrale,
  onMostraAccountInAttivazione,
  onAggiornaVolontari,
  onNotificaRadio,
  onApriDatabase,
  infoConnessione,
  onApriConnessione
}) => {
  const [modalitaCentrale, setModalitaCentrale] = useState<'chiuso' | 'admin' | 'operatore'>('chiuso');
  const [adminTentativiErrati, setAdminTentativiErrati] = useState<number>(0);
  const [pinInput, setPinInput] = useState('');
  const [errorePin, setErrorePin] = useState<string | null>(null);
  const [connInfo, setConnInfo] = useState<ConnectionInfo>(() => infoConnessione || realtime.getConnectionInfo());
  const [modaleRegistraCentraleAperta, setModaleRegistraCentraleAperta] = useState(false);
  const [modaleResetAperta, setModaleResetAperta] = useState(false);
  const [isWeb, setIsWeb] = useState<boolean>(() => isAccessoDaWeb());

  // Profilo Amministratore / Presidente predefinito con pieni privilegi
  const profiloAmministratoreCentrale: Volontario = {
    id: 'admin-centrale-root',
    nome: 'Amministratore',
    cognome: 'Centrale (Presidente / Amministrazione)',
    matricola: 'ADMIN-01',
    qualifica: 'Operatore Centrale',
    caricaConsiglioDirettivo: 'Presidente / Legale Rappresentante',
    telefono: '0585625410',
    email: 'croceoromassacarrara@gmail.com',
    pin: '4451',
    inTurno: false,
    profiloCentrale: true,
    approvato: true,
    dataRegistrazione: '2026-01-01'
  };

  // Calcolo operatori centrale e volontari con accesso delegato alle macro categorie (include Amministratore in cima)
  const operatoriCentrale = [
    profiloAmministratoreCentrale,
    ...volontari.filter(
      v => (v.profiloCentrale || v.qualifica === 'Operatore Centrale' || (v.macroCategorieAbilitate && v.macroCategorieAbilitate.length > 0)) && v.id !== 'admin-centrale-root'
    ).sort((a, b) => {
      const cogA = (a.cognome || '').trim();
      const cogB = (b.cognome || '').trim();
      const cmp = cogA.localeCompare(cogB, 'it', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return (a.nome || '').trim().localeCompare((b.nome || '').trim(), 'it', { sensitivity: 'base' });
    })
  ];
  const operatoriSlotCentrale = volontari.filter(v => v.profiloCentrale || v.qualifica === 'Operatore Centrale');
  const slotLiberiCentrale = Math.max(0, 10 - operatoriSlotCentrale.length);
  const [operatoreSelezionatoId, setOperatoreSelezionatoId] = useState<string>(operatoriCentrale[0]?.id || 'admin-centrale-root');

  // Mantiene aggiornato l'operatore selezionato
  React.useEffect(() => {
    if ((!operatoreSelezionatoId || !operatoriCentrale.some(o => o.id === operatoreSelezionatoId)) && operatoriCentrale.length > 0) {
      setOperatoreSelezionatoId(operatoriCentrale[0].id);
    }
  }, [operatoriCentrale, operatoreSelezionatoId]);

  // Controllo se questo dispositivo ha una richiesta in attivazione salvata in locale
  const [operatoreInAttesaLocale] = useState<Volontario | null>(() => {
    try {
      const saved = localStorage.getItem('CROCE_ORO_OPERATORE_IN_ATTIVAZIONE');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  React.useEffect(() => {
    if (infoConnessione) setConnInfo(infoConnessione);
  }, [infoConnessione]);

  React.useEffect(() => {
    return realtime.on('connection_change', (info) => setConnInfo(info));
  }, []);

  // 1. Submit PIN per Amministratore e Presidente (stessi identici privilegi ed autorizzazioni)
  const handleCentraleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorePin(null);
    const pin = pinInput.trim();

    if (!pin) {
      setErrorePin('Inserisci il PIN riservato.');
      return;
    }

    const presidenteVolontario = volontari.find(
      v => (v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
           (v.qualifica && v.qualifica.toLowerCase().includes('presidente'))
    );
    const isPinPresidente = Boolean(presidenteVolontario && presidenteVolontario.pin === pin);

    if (pin === '4451' || isPinPresidente) {
      setAdminTentativiErrati(0);
      const res = onSelectAdmin(pin);
      if (!res) {
        setErrorePin('Errore durante l\'accesso.');
      }
      return;
    }

    const nuovi = adminTentativiErrati + 1;
    setAdminTentativiErrati(nuovi);
    setPinInput('');
    const rimasti = Math.max(0, 3 - nuovi);

    if (nuovi < 3) {
      setErrorePin(`❌ PIN errato! Ti rimangon${rimasti === 1 ? 'e' : 'o'} ${rimasti} tentativ${rimasti === 1 ? 'o' : 'i'} su 3 prima del blocco.`);
    } else {
      setErrorePin('🚨 3 TENTATIVI ERRATI! Accesso temporaneamente bloccato per motivi di sicurezza.');
      if (onNotificaRadio) {
        onNotificaRadio('🚨 ALLARME SICUREZZA: Rilevati 3 tentativi consecutivi errati di inserimento PIN! Accesso bloccato.', 'allarme');
      }
    }
  };

  // 2. Submit PIN per Operatore di Centrale (incluso Amministratore / Presidente con pieni privilegi)
  const handleCentraleOperatoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorePin(null);
    const pin = pinInput.trim();

    const op = operatoriCentrale.find(v => v.id === operatoreSelezionatoId) || operatoriCentrale[0];
    if (!op) {
      setErrorePin('Nessun operatore centrale selezionato. Clicca su "+ Registrati come Operatore Centrale".');
      return;
    }

    if (!pin) {
      setErrorePin(`Inserisci il PIN per ${op.nome} ${op.cognome}.`);
      return;
    }

    // 1. Riconoscimento Amministratore / Presidente: PIN master 4451 o profilo Amministrazione
    const presidenteVolontario = volontari.find(
      v => (v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
           (v.qualifica && v.qualifica.toLowerCase().includes('presidente'))
    );
    const isPinPresidente = Boolean(presidenteVolontario && presidenteVolontario.pin === pin);
    const isAdminTarget = op.id === 'admin-centrale-root' || isPinPresidente || (op.caricaConsiglioDirettivo && op.caricaConsiglioDirettivo.toLowerCase().includes('presidente'));

    if (pin === '4451' || (isAdminTarget && (pin === '4451' || isPinPresidente || pin === op.pin))) {
      onSelectAdmin(pin);
      return;
    }

    if (op.bloccatoPerTentativi || (op.tentativiErrati && op.tentativiErrati >= 3)) {
      setErrorePin(`🚨 Account di ${op.nome} ${op.cognome} bloccato per motivi di sicurezza dopo 3 tentativi errati (${op.dataBlocco || 'Data non reg.'}). È stata inviata una notifica all'Amministratore.`);
      setPinInput('');
      return;
    }

    if (pin !== op.pin) {
      const nuoviSbagli = (op.tentativiErrati || 0) + 1;
      const rimasti = Math.max(0, 3 - nuoviSbagli);
      setPinInput('');

      if (nuoviSbagli < 3) {
        setErrorePin(`❌ PIN errato per ${op.nome} ${op.cognome}! Ti rimangon${rimasti === 1 ? 'e' : 'o'} ${rimasti} tentativ${rimasti === 1 ? 'o' : 'i'} su 3 prima del blocco.`);
        if (onAggiornaVolontari) {
          const aggiornati = volontari.map(v => v.id === op.id ? { ...v, tentativiErrati: nuoviSbagli } : v);
          onAggiornaVolontari(aggiornati);
        }
      } else {
        const dataOra = formatDateTimeItaly(undefined, false);
        setErrorePin(`🚨 ACCOUNT OPERATORE BLOCCATO! Hai inserito 3 volte il PIN errato. È stata inviata una notifica immediata all'Amministratore della Centrale per decidere se azzerare gli sbagli o inviarti l'invito per il reset della password/PIN.`);
        if (onAggiornaVolontari) {
          const aggiornati = volontari.map(v => v.id === op.id ? {
            ...v,
            tentativiErrati: 3,
            bloccatoPerTentativi: true,
            dataBlocco: dataOra
          } : v);
          onAggiornaVolontari(aggiornati);
        }
        if (onNotificaRadio) {
          onNotificaRadio(
            `🚨 ALLARME SICUREZZA: L'Operatore Centrale ${op.nome} ${op.cognome} ha inserito 3 volte il PIN errato! Account BLOCCATO. Inviata notifica all'Amministratore per sblocco o invito al reset password/PIN.`,
            'allarme'
          );
        }
      }
      return;
    }

    // Successo PIN corretto: resetta eventuali errori pregressi
    if (op.tentativiErrati && op.tentativiErrati > 0 && onAggiornaVolontari) {
      const aggiornati = volontari.map(v => v.id === op.id ? { ...v, tentativiErrati: 0 } : v);
      onAggiornaVolontari(aggiornati);
    }

    const haMacroAbilitate = Boolean(op.macroCategorieAbilitate && op.macroCategorieAbilitate.length > 0);
    if (op.approvato || haMacroAbilitate) {
      onSelectAdmin(pin);
    } else {
      if (onMostraAccountInAttivazione) {
        onMostraAccountInAttivazione(op);
      } else {
        setErrorePin('Questo profilo è in attesa di approvazione dall\'Amministratore (Account in Attivazione).');
      }
    }
  };

  return (
    <div
      className={isWeb ? "min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden font-sans" : "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden font-sans"}
      style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a' } : undefined}
    >
      {/* Elementi grafici di sfondo (solo in modalità scura, disattivati su web per massima visibilità) */}
      {!isWeb && (
        <>
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#1d1a60]/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Header con Logo e Titolo Associazione */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center pt-2 sm:pt-4">
        <div className="flex flex-col items-center justify-center gap-3 mb-3">
          <div className={isWeb ? "p-2 rounded-2xl bg-white border-2 border-slate-200 shadow-md" : ""}>
            <CroceOroLogo size="xl" className="w-24 h-24 sm:w-28 sm:h-28 shadow-2xl shadow-amber-500/20" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-wider uppercase ${
                isWeb ? 'text-[#1d1a60]' : 'text-amber-400'
              }`}>
                Croce Oro Massa Carrara OdV
              </h1>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isWeb ? 'bg-amber-100 text-amber-900 border-amber-300 font-black' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {APP_VERSION_LABEL}
              </span>
            </div>
            <p className={`text-xs sm:text-sm font-bold tracking-wide mt-1 ${
              isWeb ? 'text-slate-700' : 'text-white font-medium'
            }`}>
              Associazione Volontari del Soccorso & Protezione Civile
            </p>

            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => onApriConnessione?.()}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm border transition-all cursor-pointer active:scale-95 ${
                  connInfo.firestoreActive
                    ? (isWeb ? 'bg-emerald-50 border-emerald-400 text-emerald-900 hover:bg-emerald-100' : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80')
                    : connInfo.firebaseStatus === 'pending_approval' || connInfo.firebaseStatus === 'signed_out' || connInfo.status === 'auth_required'
                    ? (isWeb ? 'bg-amber-50 border-amber-400 text-amber-900 hover:bg-amber-100' : 'bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/80')
                    : connInfo.connected
                    ? (isWeb ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100' : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300 hover:bg-slate-800')
                    : (isWeb ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200' : 'bg-slate-900/90 border-slate-700 text-amber-300 hover:bg-slate-800')
                }`}
                title="Clicca per aprire lo stato sincronizzazione Cloud multi-dispositivo"
              >
                <span className={`w-2 h-2 rounded-full ${
                  connInfo.firestoreActive || connInfo.connected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500'
                }`} />
                <span>
                  {connInfo.firestoreActive
                    ? `Cloud Multi-Device Attivo (${volontari.length} profili)`
                    : connInfo.firebaseStatus === 'pending_approval'
                    ? 'Cloud in attesa approvazione Admin • Clicca qui'
                    : connInfo.status === 'auth_required' || connInfo.firebaseStatus === 'signed_out'
                    ? 'Attiva Cloud Google Sync (PC/Tel) • Clicca qui'
                    : connInfo.connected
                    ? `Server Connesso & Sincronizzato (${volontari.length} profili)`
                    : 'Verifica Connessione Cloud • Clicca qui'}
                </span>
              </button>
              <PWAInstallButton />
            </div>
          </div>
        </div>

        {/* Avviso Account in Attivazione salvato su questo device */}
        {operatoreInAttesaLocale && onMostraAccountInAttivazione && (
          <div className={`max-w-2xl mx-auto mt-3 p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-lg ${
            isWeb ? 'bg-amber-50 border-2 border-amber-400 text-amber-950 font-medium' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5 text-left">
              <Clock className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
              <div>
                <strong className={`block ${isWeb ? 'text-amber-900 font-black' : 'text-amber-300'}`}>Richiesta Operatore Centrale registrata su questo device:</strong>
                <span>{operatoreInAttesaLocale.nome} {operatoreInAttesaLocale.cognome} (PIN: {operatoreInAttesaLocale.pin})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onMostraAccountInAttivazione(operatoreInAttesaLocale)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase shrink-0 transition-all cursor-pointer shadow border border-amber-600"
            >
              Vedi Stato
            </button>
          </div>
        )}

        <div className={`mt-4 sm:mt-5 rounded-2xl p-4 sm:p-5 shadow-md max-w-2xl mx-auto border-2 ${
          isWeb ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/80 border-slate-800 text-white'
        }`}>
          <h2 className={`text-base sm:text-lg font-black ${isWeb ? 'text-[#1d1a60]' : 'text-white'}`}>
            Seleziona la modalità di accesso per questo dispositivo
          </h2>
          <p className={`text-xs sm:text-sm mt-1 ${isWeb ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
            Scegli il tuo ruolo per caricare esclusivamente l'interfaccia adatta alle tue mansioni:
          </p>
        </div>
      </div>

      {/* Griglia delle due scelte: Volontario vs Centrale */}
      <div className="relative z-10 max-w-4xl mx-auto w-full my-6 sm:my-8 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* OPZIONE 1: VOLONTARIO / TERMINALE BORDO MEZZO */}
        <div
          className={isWeb ? "bg-white border-2 border-emerald-600 rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden" : "bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-emerald-500/40 hover:border-emerald-400 rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-2xl transition-all hover:scale-[1.01] relative overflow-hidden group"}
          style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#059669' } : undefined}
        >
          <div
            className={isWeb ? "absolute top-0 right-0 bg-emerald-100 border-b-2 border-l-2 border-emerald-500 text-emerald-900 text-[11px] font-black uppercase px-3 py-1 rounded-bl-2xl" : "absolute top-0 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase px-3 py-1 rounded-bl-2xl"}
            style={isWeb ? { backgroundColor: '#d1fae5', color: '#064e3b', borderColor: '#10b981' } : undefined}
          >
            Consigliato su Smartphone
          </div>

          <div>
            <div
              className={isWeb ? "w-14 h-14 rounded-2xl bg-emerald-600 border-2 border-emerald-700 flex items-center justify-center text-white mb-4 shadow-md" : "w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-lg group-hover:scale-110 transition-transform"}
              style={isWeb ? { backgroundColor: '#059669', color: '#ffffff', borderColor: '#047857' } : undefined}
            >
              <Car className="w-8 h-8 text-white" />
            </div>

            <h3 className={`text-xl font-black flex items-center gap-2 ${isWeb ? 'text-slate-950' : 'text-white'}`}>
              <span>Volontario / Soccorritore</span>
            </h3>
            <p className={`text-xs font-black uppercase tracking-wide mt-0.5 ${isWeb ? 'text-emerald-800' : 'text-emerald-400'}`}>
              Terminale di Bordo Mezzo
            </p>

            <p className={`text-xs mt-3 leading-relaxed font-medium ${isWeb ? 'text-slate-700' : 'text-slate-300'}`}>
              Interfaccia dedicata per chi opera a bordo delle ambulanze e veicoli di protezione civile.
            </p>
          </div>

          <div className={`mt-6 pt-4 border-t ${isWeb ? 'border-slate-300' : 'border-slate-800'}`}>
            <button
              type="button"
              onClick={onSelectVolontario}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg border-2 border-emerald-800 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#047857' }}
            >
              <Car className="w-5 h-5 text-white" />
              <span>Entra come Volontario</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* OPZIONE 2: CENTRALE (AMMINISTRATORE + OPERATORI CENTRALE) */}
        <div
          className={isWeb ? "bg-white border-2 border-amber-600 rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden" : "bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 sm:p-7 flex flex-col justify-between shadow-2xl transition-all hover:scale-[1.01] relative overflow-hidden group"}
          style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d97706' } : undefined}
        >
          <div
            className={isWeb ? "absolute top-0 right-0 bg-amber-100 border-b-2 border-l-2 border-amber-500 text-amber-950 text-[11px] font-black uppercase px-3 py-1 rounded-bl-2xl" : "absolute top-0 right-0 bg-amber-500/10 border-b border-l border-amber-500/30 text-amber-400 text-[11px] font-black uppercase px-3 py-1 rounded-bl-2xl"}
            style={isWeb ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#f59e0b' } : undefined}
          >
            Accesso con PIN
          </div>

          <div>
            <div
              className={isWeb ? "w-14 h-14 rounded-2xl bg-amber-500 border-2 border-amber-600 flex items-center justify-center text-slate-950 mb-4 shadow-md" : "w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-lg group-hover:scale-110 transition-transform"}
              style={isWeb ? { backgroundColor: '#f59e0b', color: '#020617', borderColor: '#d97706' } : undefined}
            >
              <Radio className="w-8 h-8 text-slate-950" />
            </div>

            <h3 className={`text-xl font-black flex items-center gap-2 ${isWeb ? 'text-slate-950' : 'text-white'}`}>
              <span>Centrale</span>
            </h3>
            <p className={`text-xs font-black uppercase tracking-wide mt-0.5 ${isWeb ? 'text-amber-800' : 'text-amber-400'}`}>
              Centrale Operativa & Coordinamento
            </p>

            <p className={`text-xs mt-3 leading-relaxed font-medium ${isWeb ? 'text-slate-700' : 'text-slate-300'}`}>
              Postazione per gestione chiamate, assegnazione mezzi, mappa GPS e coordinamento operativo.
            </p>
          </div>

          {/* Form o Pulsanti Accesso Centrale */}
          <div className={`mt-6 pt-4 border-t space-y-3 ${isWeb ? 'border-slate-300' : 'border-slate-800'}`}>
            {modalitaCentrale === 'chiuso' && (
              <div className="space-y-2.5">
                {/* Tasto Unificato: Entra come Operatore di Centrale */}
                <button
                  type="button"
                  onClick={() => {
                    setModalitaCentrale('operatore');
                    setErrorePin(null);
                    setPinInput('');
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg border-2 border-amber-700 active:scale-95 transition-all cursor-pointer"
                  style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
                >
                  <Radio className="w-5 h-5 text-slate-950" />
                  <span>Entra come Operatore di Centrale</span>
                  <ChevronRight className="w-4 h-4 text-slate-950" />
                </button>
              </div>
            )}

            {/* Form Accesso 1: AMMINISTRATORE E PRESIDENTE */}
            {modalitaCentrale === 'admin' && (
              <form
                onSubmit={handleCentraleAdminSubmit}
                autoComplete="off"
                className={isWeb ? "space-y-3 bg-slate-50 p-4 rounded-2xl border-2 border-amber-600 shadow-xl" : "space-y-3 bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/60 shadow-xl"}
                style={isWeb ? { backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#d97706' } : undefined}
              >
                <div className={`flex items-center justify-between pb-1 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800'}`}>
                  <div>
                    <span className={`text-xs font-bold flex items-center gap-1.5 uppercase ${isWeb ? 'text-amber-800 font-black' : 'text-amber-400'}`}>
                      <Lock className="w-4 h-4 text-amber-500" /> Accesso Amministratore e Presidente
                    </span>
                    <span className={`text-[10px] block font-normal ${isWeb ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                      Amministratore e Presidente condividono gli stessi privilegi ed autorizzazioni
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModalitaCentrale('chiuso');
                      setErrorePin(null);
                      setPinInput('');
                    }}
                    className={`text-xs font-bold cursor-pointer px-2.5 py-1 rounded-lg border ${
                      isWeb ? 'text-slate-800 bg-slate-200 border-slate-300 hover:bg-slate-300' : 'text-slate-400 hover:text-white bg-slate-900 border-slate-800'
                    }`}
                  >
                    Annulla
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
                    <span className={`flex items-center gap-1 ${isWeb ? 'text-amber-900 font-black' : 'text-amber-400'}`}>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      Digita PIN Riservato (Hai 3 tentativi)
                    </span>
                    {adminTentativiErrati > 0 ? (
                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-400 font-black animate-pulse text-[10px]">
                        ⚠️ Rimangon{3 - adminTentativiErrati === 1 ? 'e' : 'o'} {3 - adminTentativiErrati} tentativ{3 - adminTentativiErrati === 1 ? 'o' : 'i'}
                      </span>
                    ) : (
                      <span className={isWeb ? 'text-emerald-700 font-bold text-[10px]' : 'text-emerald-400 text-[10px]'}>
                        3 tentativi disponibili
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      autoFocus
                      autoComplete="one-time-code"
                      name="codice_sicurezza_centrale_entry"
                      id="codice_sicurezza_centrale_entry"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        setErrorePin(null);
                      }}
                      placeholder="••••"
                      style={{
                        WebkitTextSecurity: 'disc',
                        MozTextSecurity: 'disc',
                        backgroundColor: isWeb ? '#ffffff' : undefined,
                        color: isWeb ? '#0f172a' : undefined,
                        borderColor: isWeb ? '#94a3b8' : undefined
                      } as React.CSSProperties}
                      className={`flex-1 p-2.5 rounded-xl text-base text-center tracking-widest font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                        isWeb ? 'bg-white border-2 border-slate-400 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                      }`}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-md active:scale-95 transition-all shrink-0 cursor-pointer border-2 border-amber-700"
                      style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
                    >
                      Sblocca
                    </button>
                  </div>
                </div>

                {errorePin && (
                  <p className="text-xs font-bold text-red-700 bg-red-100 p-2.5 rounded-xl border border-red-400">
                    {errorePin}
                  </p>
                )}
              </form>
            )}

            {/* Form Accesso 2: OPERATORE DI CENTRALE */}
            {modalitaCentrale === 'operatore' && (
              <form
                onSubmit={handleCentraleOperatoreSubmit}
                className={isWeb ? "space-y-3 bg-slate-50 p-4 rounded-2xl border-2 border-purple-600 shadow-xl" : "space-y-3 bg-slate-950 p-4 rounded-2xl border-2 border-purple-500/60 shadow-xl"}
                style={isWeb ? { backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#7e22ce' } : undefined}
              >
                <div className={`flex items-center justify-between pb-1 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800'}`}>
                  <span className={`text-xs font-black flex items-center gap-1.5 uppercase ${isWeb ? 'text-purple-900' : 'text-purple-300'}`}>
                    <Radio className="w-4 h-4 text-purple-600" /> Accesso Operatore di Centrale
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setModalitaCentrale('chiuso');
                      setErrorePin(null);
                      setPinInput('');
                    }}
                    className={`text-xs font-bold cursor-pointer px-2.5 py-1 rounded-lg border ${
                      isWeb ? 'text-slate-800 bg-slate-200 border-slate-300 hover:bg-slate-300' : 'text-slate-400 hover:text-white bg-slate-900 border-slate-800'
                    }`}
                  >
                    Annulla
                  </button>
                </div>

                {/* 1. Selezione Operatore */}
                <div>
                  <label className={`block text-[11px] font-black uppercase mb-1 ${isWeb ? 'text-slate-800' : 'text-slate-300'}`}>
                    1. Seleziona il tuo Nominativo Operatore
                  </label>
                  {operatoriCentrale.length === 0 ? (
                    <div className={`p-2.5 rounded-xl text-xs ${isWeb ? 'bg-slate-100 border border-slate-300 text-slate-700' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>
                      Nessun operatore registrato al momento.
                    </div>
                  ) : (
                    <select
                      value={operatoreSelezionatoId}
                      onChange={(e) => {
                        setOperatoreSelezionatoId(e.target.value);
                        setPinInput('');
                        setErrorePin(null);
                      }}
                      style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' } : undefined}
                      className={`w-full p-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none ${
                        isWeb ? 'bg-white border-2 border-slate-400 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                      }`}
                    >
                      {operatoriCentrale.map((op) => {
                        const isDelegato = Boolean(op.macroCategorieAbilitate && op.macroCategorieAbilitate.length > 0 && !op.profiloCentrale && op.qualifica !== 'Operatore Centrale');
                        const etichettaRuolo = isDelegato
                          ? `${op.qualifica} - ${op.macroCategorieAbilitate?.length} Categorie Abilitate`
                          : (op.matricola || 'Op. Centrale');
                        const icona = isDelegato ? '🎖️' : '🎧';
                        return (
                          <option key={op.id} value={op.id}>
                            {icona} {op.cognome} {op.nome} ({etichettaRuolo}) {op.bloccatoPerTentativi ? '🚨 BLOCCATO' : (!op.approvato && !isDelegato ? '⏳ In Attivazione' : '')}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  {/* Opzione Registrazione */}
                  <div className="text-right pt-1">
                    <button
                      type="button"
                      onClick={() => setModaleRegistraCentraleAperta(true)}
                      className={`text-xs font-black underline inline-flex items-center gap-1 cursor-pointer ${
                        isWeb ? 'text-purple-800 hover:text-purple-950 decoration-purple-600' : 'text-amber-400 hover:text-amber-300 decoration-amber-500/60'
                      }`}
                    >
                      <span>➕ Non sei in elenco? Registrati come Operatore Centrale</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        slotLiberiCentrale > 0 ? (isWeb ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-amber-500/20 text-amber-300') : 'bg-red-500/20 text-red-500'
                      }`}>
                        ({slotLiberiCentrale > 0 ? `${slotLiberiCentrale} liberi` : 'Completo'})
                      </span>
                    </button>
                  </div>
                </div>

                {(() => {
                  const op = operatoriCentrale.find(o => o.id === operatoreSelezionatoId) || operatoriCentrale[0];
                  if (!op) return null;

                  const isBloccato = !!(op.bloccatoPerTentativi || (op.tentativiErrati && op.tentativiErrati >= 3));
                  const tentativiErrati = op.tentativiErrati || 0;
                  const tentativiRimasti = Math.max(0, 3 - tentativiErrati);

                  if (isBloccato) {
                    return (
                      <div className="p-3 rounded-2xl bg-red-100 border-2 border-red-500 text-xs text-red-950 space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 animate-bounce" />
                          <div>
                            <strong className="block text-red-900 font-black uppercase text-xs">Account Operatore Bloccato</strong>
                            <span className="text-[11px] text-red-800">3 tentativi PIN esauriti {op.dataBlocco ? `(${op.dataBlocco})` : ''}.</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-800 leading-tight">
                          È stata inviata una notifica all'Amministratore, che deciderà se azzerare gli sbagli e sbloccarti o farti pervenire l'invito per reimpostare la tua password/PIN.
                        </p>
                        <button
                          type="button"
                          onClick={() => setModaleResetAperta(true)}
                          className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow border-2 border-amber-700 transition-all cursor-pointer active:scale-95"
                          style={{ backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' }}
                        >
                          Hai ricevuto l'invito? Reimposta PIN
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
                        <span className={`flex items-center gap-1 ${isWeb ? 'text-purple-950 font-black' : 'text-purple-300'}`}>
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          2. Digita PIN Personale (Hai 3 tentativi)
                        </span>
                        {tentativiErrati > 0 ? (
                          <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-400 font-black animate-pulse text-[10px]">
                            ⚠️ Rimangon{tentativiRimasti === 1 ? 'e' : 'o'} {tentativiRimasti} tentativ{tentativiRimasti === 1 ? 'o' : 'i'} su 3
                          </span>
                        ) : (
                          <span className={isWeb ? 'text-purple-800 font-bold text-[10px]' : 'text-purple-300 text-[10px]'}>
                            3 tentativi rimanenti
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={8}
                          autoFocus
                          autoComplete="one-time-code"
                          name="codice_operatore_centrale_token"
                          id="codice_operatore_centrale_token"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value);
                            setErrorePin(null);
                          }}
                          placeholder={`••••`}
                          style={{
                            WebkitTextSecurity: 'disc',
                            MozTextSecurity: 'disc',
                            backgroundColor: isWeb ? '#ffffff' : undefined,
                            color: isWeb ? '#0f172a' : undefined,
                            borderColor: isWeb ? '#94a3b8' : undefined
                          } as React.CSSProperties}
                          className={`flex-1 p-2.5 rounded-xl text-base text-center tracking-widest font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none ${
                            isWeb ? 'bg-white border-2 border-slate-400 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                          }`}
                        />
                        <button
                          type="submit"
                          className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs uppercase shadow-md active:scale-95 transition-all shrink-0 cursor-pointer border-2 border-purple-900"
                          style={{ backgroundColor: '#7e22ce', color: '#ffffff', borderColor: '#581c87' }}
                        >
                          Sblocca
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {errorePin && (
                  <p className="text-xs font-bold text-red-700 bg-red-100 p-2.5 rounded-xl border border-red-400">
                    {errorePin}
                  </p>
                )}
              </form>
            )}



            {/* Pulsante Reset Password / PIN per chi ha ricevuto invito */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setModaleResetAperta(true)}
                className={`text-xs font-bold underline flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer ${
                  isWeb
                    ? 'p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-900'
                    : 'text-slate-400 hover:text-amber-400'
                }`}
                style={isWeb ? { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' } : undefined}
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>Hai ricevuto un invito a resettare la password/PIN?</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modale Registrazione Operatore Centrale dal Device */}
      <ModalRegistrazioneOperatoreCentrale
        isOpen={modaleRegistraCentraleAperta}
        onClose={() => setModaleRegistraCentraleAperta(false)}
        volontariEsistenti={volontari}
        onRegistra={(nuovo) => {
          setModaleRegistraCentraleAperta(false);
          if (onRegistraOperatoreCentrale) {
            onRegistraOperatoreCentrale(nuovo);
          }
        }}
      />

      {/* Modale Reset Password / PIN */}
      <ModalResetPassword
        isOpen={modaleResetAperta}
        onClose={() => setModaleResetAperta(false)}
        volontari={volontari}
        onAggiornaVolontari={onAggiornaVolontari || (() => {})}
        onNotificaRadio={onNotificaRadio || (() => {})}
      />

      {/* Footer informativo */}
      <div className="relative z-10 max-w-2xl mx-auto w-full text-center pb-2">
        <p className="text-xs text-slate-400">
          💡 Potrai cambiare profilo o passare dall'una all'altra modalità in qualsiasi momento tramite il pulsante <strong>"Cambia Profilo"</strong> presente nella barra superiore.
        </p>
        <p className="text-[11px] text-slate-300 font-mono mt-2">
          Croce Oro Massa Carrara OdV • Centrale Operativa {APP_VERSION_LABEL}
        </p>
      </div>
    </div>
  );
};
