import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Edit3, Layers, RotateCcw, Save, X } from 'lucide-react';
import {
  LISTA_MACRO_CATEGORIE,
  SOTTOSEZIONI_PER_DATABASE,
  getNomiDatabaseCustom,
  getNomiDatabaseSyncPayload,
  getNomiSottosezioniCustom,
  getTitoloDatabase,
  salvaNomiDatabaseCustom,
  salvaNomiSottosezioniCustom,
} from '../../constants/macroCategorie';
import { realtime } from '../../services/realtime';

interface ModalRinominaDbSubProps {
  mode: 'db' | 'sub' | null;
  onChangeMode: (next: 'db' | 'sub') => void;
  onClose: () => void;
  operatoreCorrente: string;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const ModalRinominaDbSub: React.FC<ModalRinominaDbSubProps> = ({
  mode,
  onChangeMode,
  onClose,
  operatoreCorrente,
  onNotificaRadio,
}) => {
  const [draftNomiDb, setDraftNomiDb] = useState<Record<string, string>>(() => getNomiDatabaseCustom());
  const [draftNomiSub, setDraftNomiSub] = useState<Record<string, string>>(() => getNomiSottosezioniCustom());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [messaggioConferma, setMessaggioConferma] = useState<string | null>(null);

  const dirtyNomiDbKeysRef = useRef<Set<string>>(new Set());
  const dirtyNomiSubKeysRef = useRef<Set<string>>(new Set());
  const feedbackTimerRef = useRef<number | null>(null);

  const mostraAvviso = (testo: string) => {
    setMessaggioConferma(testo);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setMessaggioConferma(null);
    }, 4500);
  };

  // Riallinea gli stati quando la modale viene aperta
  useEffect(() => {
    if (!mode) return;
    dirtyNomiDbKeysRef.current.clear();
    dirtyNomiSubKeysRef.current.clear();
    setDraftNomiDb(getNomiDatabaseCustom());
    setDraftNomiSub(getNomiSottosezioniCustom());
    setHasUnsavedChanges(false);
    setMessaggioConferma(null);
  }, [mode]);

  // Ascolta aggiornamenti remoti preservando eventuali campi attualmente in modifica
  useEffect(() => {
    const onNomiDbSync = () => {
      const agg = getNomiDatabaseCustom();
      const aggSub = getNomiSottosezioniCustom();
      setDraftNomiDb((prev) => {
        if (dirtyNomiDbKeysRef.current.size === 0) return agg;
        const merged: Record<string, string> = { ...agg };
        dirtyNomiDbKeysRef.current.forEach((k) => {
          if (prev[k] !== undefined) merged[k] = prev[k];
        });
        return merged;
      });
      setDraftNomiSub((prev) => {
        if (dirtyNomiSubKeysRef.current.size === 0) return aggSub;
        const merged: Record<string, string> = { ...aggSub };
        dirtyNomiSubKeysRef.current.forEach((k) => {
          if (prev[k] !== undefined) merged[k] = prev[k];
        });
        return merged;
      });
    };

    window.addEventListener('croceoro_nomi_db_updated', onNomiDbSync);
    return () => {
      window.removeEventListener('croceoro_nomi_db_updated', onNomiDbSync);
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  if (!mode) return null;

  const isDbMode = mode === 'db';

  const handleSalvaNomi = () => {
    const nowTs = Date.now();
    dirtyNomiDbKeysRef.current.clear();
    dirtyNomiSubKeysRef.current.clear();
    setHasUnsavedChanges(false);

    const savedDb = salvaNomiDatabaseCustom(draftNomiDb, false, nowTs);
    const savedSub = salvaNomiSottosezioniCustom(draftNomiSub, true, nowTs);
    setDraftNomiDb(savedDb);
    setDraftNomiSub(savedSub);

    realtime.syncNomiDatabase(getNomiDatabaseSyncPayload());
    onNotificaRadio?.(
      isDbMode
        ? `🏷️ NOMI DATABASE AGGIORNATI: ${operatoreCorrente} ha personalizzato i nomi dei Database (effetto immediato su tutti i dispositivi).`
        : `🏷️ NOMI SOTTOSEZIONI AGGIORNATI: ${operatoreCorrente} ha personalizzato i nomi delle Sottosezioni (effetto immediato su tutti i dispositivi).`,
      'sistema'
    );
    mostraAvviso(
      isDbMode
        ? '✓ Nomi dei Database salvati e propagati immediatamente a tutti i dispositivi!'
        : '✓ Nomi delle Sottosezioni salvati e propagati immediatamente a tutti i dispositivi!'
    );
  };

  const handleRipristinaStandard = () => {
    const nowTs = Date.now();
    if (isDbMode) {
      dirtyNomiDbKeysRef.current.clear();
      const savedDb = salvaNomiDatabaseCustom({}, true, nowTs);
      setDraftNomiDb(savedDb);
      setHasUnsavedChanges(dirtyNomiSubKeysRef.current.size > 0);
      realtime.syncNomiDatabase(getNomiDatabaseSyncPayload());
      onNotificaRadio?.(
        `🏷️ NOMI DATABASE RIPRISTINATI: ${operatoreCorrente} ha ripristinato i nomi standard dei Database.`,
        'sistema'
      );
      mostraAvviso('✓ Nomi dei Database ripristinati ai valori predefiniti su tutti i dispositivi.');
    } else {
      dirtyNomiSubKeysRef.current.clear();
      const savedSub = salvaNomiSottosezioniCustom({}, true, nowTs);
      setDraftNomiSub(savedSub);
      setHasUnsavedChanges(dirtyNomiDbKeysRef.current.size > 0);
      realtime.syncNomiDatabase(getNomiDatabaseSyncPayload());
      onNotificaRadio?.(
        `🏷️ NOMI SOTTOSEZIONI RIPRISTINATI: ${operatoreCorrente} ha ripristinato i nomi standard delle Sottosezioni.`,
        'sistema'
      );
      mostraAvviso('✓ Nomi delle Sottosezioni ripristinati ai valori predefiniti su tutti i dispositivi.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isDbMode ? 'Rinomina DB' : 'Rinomina SUB'}
    >
      <div className="w-full max-w-5xl max-h-[92dvh] bg-slate-900 border-2 border-indigo-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Intestazione Fissa */}
        <div className="p-3.5 sm:p-5 bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-950 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                isDbMode
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40'
                  : 'bg-purple-500/20 text-purple-300 border-purple-400/40'
              }`}
            >
              {isDbMode ? <Edit3 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  {isDbMode
                    ? 'Rinomina DB — Nomi dei Database'
                    : 'Rinomina SUB — Nomi delle Sottosezioni'}
                </h3>
                <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => onChangeMode('db')}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-black uppercase transition-colors cursor-pointer ${
                      isDbMode
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Rinomina DB
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMode('sub')}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-black uppercase transition-colors cursor-pointer ${
                      !isDbMode
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Rinomina SUB
                  </button>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
                {isDbMode
                  ? 'Personalizza il titolo di qualsiasi Database con effetto immediato su tutti i dispositivi, mantenendo invariati permessi, comandi e collegamenti operativi.'
                  : 'Personalizza il titolo di ogni Sottosezione all’interno dei Database con effetto immediato su tutti i dispositivi, senza alterare permessi o collegamenti operativi.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 shrink-0 cursor-pointer"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Avviso di conferma salvataggio/ripristino */}
        {messaggioConferma && (
          <div className="mx-3.5 sm:mx-5 mt-3 bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{messaggioConferma}</span>
          </div>
        )}

        {/* Contenuto Scorrevole */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {isDbMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {LISTA_MACRO_CATEGORIE.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <label className="block text-[10.5px] font-bold text-slate-400 uppercase truncate">
                    {cat.icona} DB {cat.numero} (Predef.: {cat.titolo})
                  </label>
                  <input
                    type="text"
                    value={draftNomiDb[cat.id] !== undefined ? draftNomiDb[cat.id] : cat.titolo}
                    onChange={(e) => {
                      const val = e.target.value;
                      dirtyNomiDbKeysRef.current.add(cat.id);
                      setHasUnsavedChanges(true);
                      setDraftNomiDb((prev) => ({ ...prev, [cat.id]: val }));
                    }}
                    placeholder={cat.titolo}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LISTA_MACRO_CATEGORIE.map((cat) => {
                const subs = SOTTOSEZIONI_PER_DATABASE[cat.id] || [];
                return (
                  <div
                    key={`rsub-${cat.id}`}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="text-xs font-black text-amber-300 uppercase border-b border-slate-800 pb-1.5">
                      {cat.icona} {cat.numero}. {getTitoloDatabase(cat.id, cat.titolo, draftNomiDb)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {subs.map((sub) => {
                        const key = `${cat.id}.${sub.id}`;
                        return (
                          <div key={key} className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-400 truncate">
                              {sub.numero}. {sub.titoloDefault}
                            </label>
                            <input
                              type="text"
                              value={draftNomiSub[key] !== undefined ? draftNomiSub[key] : sub.titoloDefault}
                              onChange={(e) => {
                                const val = e.target.value;
                                dirtyNomiSubKeysRef.current.add(key);
                                setHasUnsavedChanges(true);
                                setDraftNomiSub((prev) => ({ ...prev, [key]: val }));
                              }}
                              placeholder={sub.titoloDefault}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11.5px] font-medium focus:outline-none focus:border-purple-400"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Azioni Fisso */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRipristinaStandard}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>{isDbMode ? 'Ripristina Standard DB' : 'Ripristina Standard SUB'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
            >
              Chiudi
            </button>
            <button
              type="button"
              onClick={handleSalvaNomi}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all ${
                hasUnsavedChanges
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 ring-2 ring-emerald-300/70'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Salva Modifiche Ora' : 'Salva & Applica Subito'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
