import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, AlertCircle, Check, Sparkles } from 'lucide-react';
import {
  CustomEmojiIcon,
  EMOJI_ARCHIVE_GROUPS,
  aggiungiCustomEmojiIcon,
  getCustomEmojiIcons,
  isCustomIconValue,
  processIcoFileToCustomIcon,
  rimuoviCustomEmojiIcon,
  toCustomIconToken,
} from '../utils/emojiIconsArchive';
import { IconaEmoji } from './IconaEmoji';

interface EmojiIconPickerProps {
  value: string;
  onChange: (nextVal: string) => void;
  fallback?: string;
  accent?: 'blue' | 'amber' | 'purple' | 'indigo';
  /** Abilita il caricamento di nuovi file .ico e la rimozione manuale dall'archivio (per chi può inserire Nuova Categoria Mansioni) */
  allowIcoUpload?: boolean;
  /** Callback invocata quando l'archivio icone .ico cambia (per sincronizzare immediatamente su server/Firestore) */
  onCustomIconsChanged?: (icons: CustomEmojiIcon[]) => void;
  operatoreCorrente?: string;
  compact?: boolean;
}

export const EmojiIconPicker: React.FC<EmojiIconPickerProps> = ({
  value,
  onChange,
  fallback = '📁',
  accent = 'amber',
  allowIcoUpload = false,
  onCustomIconsChanged,
  operatoreCorrente,
  compact = false,
}) => {
  const [customIcons, setCustomIcons] = useState<CustomEmojiIcon[]>(() => getCustomEmojiIcons());
  const [gruppoAttivo, setGruppoAttivo] = useState<string>('tutti');
  const [caricamento, setCaricamento] = useState(false);
  const [erroreUpload, setErroreUpload] = useState<string | null>(null);
  const [confermaRimozioneId, setConfermaRimozioneId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const refresh = () => setCustomIcons(getCustomEmojiIcons());
    window.addEventListener('croceoro_custom_icons_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('croceoro_custom_icons_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const ringClass =
    accent === 'blue'
      ? 'bg-blue-600/35 border-blue-400 ring-1 ring-blue-400'
      : accent === 'purple'
      ? 'bg-purple-600/35 border-purple-400 ring-1 ring-purple-400'
      : accent === 'indigo'
      ? 'bg-indigo-600/35 border-indigo-400 ring-1 ring-indigo-400'
      : 'bg-amber-500/25 border-amber-400 ring-1 ring-amber-400';

  const borderFocusClass =
    accent === 'blue'
      ? 'focus:border-blue-500'
      : accent === 'purple'
      ? 'focus:border-purple-500'
      : accent === 'indigo'
      ? 'focus:border-indigo-500'
      : 'focus:border-amber-400';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErroreUpload(null);
    setCaricamento(true);
    try {
      const nuovaIcona = await processIcoFileToCustomIcon(file, operatoreCorrente);
      const aggiornate = aggiungiCustomEmojiIcon(nuovaIcona);
      setCustomIcons(aggiornate);
      onCustomIconsChanged?.(aggiornate);
      onChange(toCustomIconToken(nuovaIcona.id));
    } catch (err: any) {
      setErroreUpload(err?.message || 'Errore durante il caricamento del file .ico.');
    } finally {
      setCaricamento(false);
    }
  };

  const handleRimuoviIcona = (id: string) => {
    const token = toCustomIconToken(id);
    const aggiornate = rimuoviCustomEmojiIcon(id);
    setCustomIcons(aggiornate);
    onCustomIconsChanged?.(aggiornate);
    if (value === token) {
      onChange(fallback);
    }
    setConfermaRimozioneId(null);
  };

  const isCustomSelected = isCustomIconValue(value);

  const visibleEmojis =
    gruppoAttivo === 'tutti'
      ? Array.from(new Set(EMOJI_ARCHIVE_GROUPS.flatMap((g) => g.emojis)))
      : EMOJI_ARCHIVE_GROUPS.find((g) => g.id === gruppoAttivo)?.emojis || [];

  return (
    <div className="space-y-2">
      {/* Anteprima + Input manuale Emoji + Upload .ico */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="w-11 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-xl shrink-0"
          title="Icona selezionata"
        >
          <IconaEmoji value={value} fallback={fallback} />
        </div>

        <input
          type="text"
          value={isCustomSelected ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isCustomSelected ? 'Icona .ico attiva' : 'Emoji...'}
          maxLength={8}
          className={`flex-1 min-w-[110px] px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none ${borderFocusClass}`}
        />

        {allowIcoUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ico,image/x-icon,image/vnd.microsoft.icon"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={caricamento}
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shrink-0"
              title="Carica un file formato .ico nell'archivio Emoji permanente (sfondo allineato automaticamente)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{caricamento ? 'Carico...' : 'Carica .ico'}</span>
            </button>
          </>
        )}
      </div>

      {erroreUpload && (
        <div className="p-2 rounded-lg bg-red-950/70 border border-red-500/50 text-red-200 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>{erroreUpload}</span>
        </div>
      )}

      {/* Archivio Icone .ico Personalizzate (Permanenti finché non rimosse manualmente) */}
      {(customIcons.length > 0 || allowIcoUpload) && (
        <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Archivio Icone .ico ({customIcons.length})</span>
            </span>
            {allowIcoUpload && (
              <span className="text-[9.5px] text-slate-400">
                Sfondo allineato in automatico · Permanenti
              </span>
            )}
          </div>

          {customIcons.length === 0 ? (
            <div className="text-[10.5px] text-slate-500 italic py-0.5">
              Nessun file .ico caricato. Usa &ldquo;Carica .ico&rdquo; per aggiungerlo permanentemente all&apos;archivio.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {customIcons.map((ico) => {
                const token = toCustomIconToken(ico.id);
                const selected = value === token;
                const confirmingDelete = confermaRimozioneId === ico.id;
                return (
                  <div
                    key={ico.id}
                    className={`relative group inline-flex items-center rounded-lg border transition-all ${
                      selected
                        ? ringClass
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700/80'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onChange(token)}
                      title={`${ico.nome} (icona .ico salvata nell'archivio)`}
                      className="w-8 h-8 flex items-center justify-center cursor-pointer bg-transparent rounded-lg"
                    >
                      <img
                        src={ico.dataUrl}
                        alt={ico.nome}
                        className="w-5 h-5 object-contain bg-transparent select-none"
                        draggable={false}
                      />
                    </button>

                    {allowIcoUpload && (
                      confirmingDelete ? (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleRimuoviIcona(ico.id);
                          }}
                          title="Conferma rimozione definitiva dall'archivio"
                          className="px-1.5 h-8 rounded-r-lg bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase flex items-center gap-0.5 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Sì</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setConfermaRimozioneId(ico.id);
                          }}
                          title="Rimuovi icona .ico dall'archivio"
                          className="pr-1 pl-0.5 h-8 text-slate-400 hover:text-red-400 cursor-pointer flex items-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selettore Gruppi + Griglia Emoji Unicode Ampliata */}
      <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setGruppoAttivo('tutti')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
              gruppoAttivo === 'tutti'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tutte ({EMOJI_ARCHIVE_GROUPS.reduce((acc, g) => acc + g.emojis.length, 0)})
          </button>
          {EMOJI_ARCHIVE_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGruppoAttivo(g.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                gruppoAttivo === g.id
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div
          className={`flex flex-wrap gap-1 overflow-y-auto pr-0.5 ${
            compact ? 'max-h-24' : 'max-h-32'
          }`}
        >
          {visibleEmojis.map((em) => {
            const selected = value === em;
            return (
              <button
                key={em}
                type="button"
                onClick={() => onChange(em)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all cursor-pointer ${
                  selected
                    ? ringClass
                    : 'bg-slate-800 hover:bg-slate-700 border-transparent'
                }`}
              >
                {em}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
