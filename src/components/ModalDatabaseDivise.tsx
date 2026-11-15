import React, { useState } from 'react';
import {
  X,
  Shirt,
  Search,
  Download,
  RotateCcw,
  FileDown,
  Check,
  AlertTriangle,
  Banknote,
  Users,
  ShieldCheck,
  Filter,
  CreditCard,
  Upload,
  FileCheck
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import { CAUZIONE_PANTALONI, CAUZIONE_GIUBBETTO, calcolaCauzioneTotale } from '../data/vestiarioDocumenti';
import { scaricaSchedaVestiarioPDF } from '../utils/pdfSchedaVestiario';
import { ModalRestituzioneDivisa } from './ModalRestituzioneDivisa';
import { formatDateItaly, formatTimeItaly } from '../utils/italianTime';

interface ModalDatabaseDiviseProps {
  isOpen: boolean;
  onClose: () => void;
  volontari: Volontario[];
  onAggiornaVolontari: (volontariAggiornati: Volontario[]) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  isAdmin?: boolean;
}

export const ModalDatabaseDivise: React.FC<ModalDatabaseDiviseProps> = ({
  isOpen,
  onClose,
  volontari,
  onAggiornaVolontari,
  onNotificaRadio,
  isAdmin = true
}) => {
  const [ricerca, setRicerca] = useState('');
  const [filtroCauzione, setFiltroCauzione] = useState<'tutti' | 'con_cauzione' | 'senza_cauzione'>('tutti');
  const [volontarioPerRestituzione, setVolontarioPerRestituzione] = useState<Volontario | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtra solo chi ha almeno un capo consegnato o tutto l'archivio
  const personeConVestiario = volontari.map((v) => {
    const vest = v.vestiario;
    let countCapi = 0;
    if (vest?.tshirt?.some(t => t.consegnato)) countCapi += vest.tshirt.filter(t => t.consegnato).length;
    if (vest?.felpa?.consegnato) countCapi++;
    if (vest?.pile?.consegnato) countCapi++;
    if (vest?.pantaloni?.consegnato) countCapi++;
    if (vest?.giubbetto?.consegnato) countCapi++;
    if (vest?.giubbottoInvernale?.consegnato) countCapi++;

    const cauzioni = calcolaCauzioneTotale(vest);
    return {
      volontario: v,
      countCapi,
      cauzioni
    };
  });

  // Filtro
  const listaFiltrata = personeConVestiario.filter(({ volontario: v, countCapi, cauzioni }) => {
    const q = ricerca.toLowerCase().trim();
    const matchText =
      !q ||
      v.nome.toLowerCase().includes(q) ||
      v.cognome.toLowerCase().includes(q) ||
      (v.matricola && v.matricola.toLowerCase().includes(q)) ||
      (v.qualifica && v.qualifica.toLowerCase().includes(q));

    if (!matchText) return false;

    if (filtroCauzione === 'con_cauzione') {
      return cauzioni.totale > 0;
    }
    if (filtroCauzione === 'senza_cauzione') {
      return countCapi > 0 && cauzioni.totale === 0;
    }

    return true;
  });

  // Statistiche globali
  const totalePersoneConDotazione = personeConVestiario.filter(p => p.countCapi > 0).length;
  const totaleCapiAssegnati = personeConVestiario.reduce((acc, p) => acc + p.countCapi, 0);
  const totaleCauzioniCustodite = personeConVestiario.reduce((acc, p) => acc + p.cauzioni.totale, 0);
  const totalePantaloniAssegnati = volontari.filter(v => v.vestiario?.pantaloni?.consegnato).length;
  const totaleGiubbettiAssegnati = volontari.filter(v => v.vestiario?.giubbetto?.consegnato).length;

  const handleScaricaScheda = (v: Volontario) => {
    try {
      const nomeFile = scaricaSchedaVestiarioPDF(v);
      if (onNotificaRadio) {
        onNotificaRadio(`📄 PDF Scheda Vestiario scaricata per ${v.nome} ${v.cognome}`, 'centrale');
      }
      setAvviso(`✅ Scheda Vestiario di ${v.nome} ${v.cognome} scaricata (${nomeFile})!`);
      setTimeout(() => setAvviso(null), 4000);
    } catch {
      setAvviso('Errore durante la generazione della scheda vestiario.');
    }
  };

  const handleConfermaRestituzioneEseguita = (volontarioAggiornato: Volontario) => {
    const aggiornati = volontari.map(v => v.id === volontarioAggiornato.id ? volontarioAggiornato : v);
    onAggiornaVolontari(aggiornati);
    setVolontarioPerRestituzione(null);
    setAvviso(`✅ Restituzione registrata e dotazione aggiornata per ${volontarioAggiornato.nome} ${volontarioAggiornato.cognome}!`);
    setTimeout(() => setAvviso(null), 4000);
  };

  const handleUploadDocFirmatoRow = (v: Volontario, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Il file selezionato supera i 15MB. Carica un file più leggero.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const dimensioneStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      const vest = v.vestiario ? JSON.parse(JSON.stringify(v.vestiario)) : {
        tshirt: [{ id: 1, consegnato: false }, { id: 2, consegnato: false }, { id: 3, consegnato: false }],
        felpa: { consegnato: false },
        pile: { consegnato: false },
        pantaloni: { consegnato: false },
        giubbetto: { consegnato: false },
        giubbottoInvernale: { consegnato: false }
      };

      vest.documentoFirmato = {
        fileBase64: base64,
        nomeFile: file.name,
        dataUpload: `${formatDateItaly()} ore ${formatTimeItaly(undefined, false)}`,
        dimensione: dimensioneStr
      };

      const aggiornati = volontari.map(item => item.id === v.id ? { ...item, vestiario: vest } : item);
      onAggiornaVolontari(aggiornati);

      if (onNotificaRadio) {
        onNotificaRadio(`📎 DOCUMENTO FIRMATO: Archiviata Scheda Vestiario firmata per ${v.nome} ${v.cognome} (${file.name})`, 'centrale');
      }
      setAvviso(`✅ Scheda Vestiario firmata di ${v.nome} ${v.cognome} archiviata agli atti!`);
      setTimeout(() => setAvviso(null), 5000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const scaricaDocFirmato = (base64: string, nomeFile: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = nomeFile || 'Scheda_Vestiario_Firmata.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-6xl w-full my-auto max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        
        {/* Intestazione Fissa */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
              <Shirt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  Database Divise Consegnate & Gestione Cauzioni
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Riservato Amministratore
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Registro D.P.I., dotazioni individuali, cauzioni custodite e verbali di restituzione con bonifico
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifica Avviso */}
        {avviso && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-2 text-xs text-emerald-300 flex items-center justify-between">
            <span>{avviso}</span>
            <button onClick={() => setAvviso(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}

        {/* Barra Statistiche Rapide */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-950/60 border-b border-slate-800 shrink-0 text-xs">
          {/* Card 1: Persone con divisa */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-sky-400" /> Dotazioni Assegnate
            </span>
            <div className="text-lg font-black text-white mt-1">
              {totalePersoneConDotazione} <span className="text-xs text-slate-500 font-normal">/ {volontari.length} soci</span>
            </div>
          </div>

          {/* Card 2: Capi Consegnati */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Shirt className="w-3.5 h-3.5 text-amber-400" /> Capi in Circolazione
            </span>
            <div className="text-lg font-black text-amber-300 mt-1">
              {totaleCapiAssegnati} <span className="text-xs text-slate-500 font-normal">pezzi D.P.I.</span>
            </div>
          </div>

          {/* Card 3: Pantaloni & Giubbetti con Cauzione */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Capi con Cauzione
            </span>
            <div className="text-xs font-bold text-slate-200 mt-1">
              Pantaloni: <strong className="text-white">{totalePantaloniAssegnati}</strong> (€ 30 cad.)<br />
              Giubbetti: <strong className="text-white">{totaleGiubbettiAssegnati}</strong> (€ 45 cad.)
            </div>
          </div>

          {/* Card 4: Totale Cauzioni Custodite */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border-2 border-amber-500/50">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wide flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-amber-400" /> Cauzioni in Custodia
            </span>
            <div className="text-lg sm:text-xl font-black text-amber-300 font-mono mt-1">
              € {totaleCauzioniCustodite.toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>

        {/* Barra Ricerca & Filtri */}
        <div className="p-3 sm:px-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca per nome, cognome o matricola..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500">Filtra:</span>
            <button
              type="button"
              onClick={() => setFiltroCauzione('tutti')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                filtroCauzione === 'tutti' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Tutti ({personeConVestiario.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroCauzione('con_cauzione')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all flex items-center gap-1 ${
                filtroCauzione === 'con_cauzione' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <Banknote className="w-3 h-3 text-amber-400" />
              <span>Con Cauzione Attiva ({personeConVestiario.filter(p => p.cauzioni.totale > 0).length})</span>
            </button>
          </div>
        </div>

        {/* Tabella Elenco Assegnazioni Divise */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {listaFiltrata.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nessun profilo trovato con i criteri selezionati.
            </div>
          ) : (
            <div className="space-y-3">
              {listaFiltrata.map(({ volontario: v, countCapi, cauzioni }) => {
                const vest = v.vestiario;
                return (
                  <div
                    key={v.id}
                    className="p-3 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs"
                  >
                    {/* Anagrafica & Matricola */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        {v.fotoBase64 ? (
                          <img src={v.fotoBase64} alt={v.nome} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-amber-400 text-xs">
                            {v.nome[0]}{v.cognome[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          {v.nome} {v.cognome}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
                          <span>{v.matricola || 'VOL'}</span>
                          <span>• {v.qualifica}</span>
                          {v.codiceFiscale && <span className="text-amber-300">({v.codiceFiscale})</span>}
                        </div>
                      </div>
                    </div>

                    {/* Dettaglio Capi Assegnati e Taglie */}
                    <div className="flex-1 flex flex-wrap items-center gap-1.5">
                      {/* T-Shirt */}
                      {vest?.tshirt?.filter(t => t.consegnato).map((t, idx) => (
                        <span key={`tshirt-${idx}`} className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-semibold border border-slate-700">
                          👕 T-Shirt ({t.taglia || 'L'})
                        </span>
                      ))}

                      {/* Felpa */}
                      {vest?.felpa?.consegnato && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-semibold border border-slate-700">
                          🧥 Felpa ({vest.felpa.taglia || 'L'})
                        </span>
                      )}

                      {/* Pile */}
                      {vest?.pile?.consegnato && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-semibold border border-slate-700">
                          🧣 Pile ({vest.pile.taglia || 'L'})
                        </span>
                      )}

                      {/* Pantaloni con Cauzione € 30 */}
                      {vest?.pantaloni?.consegnato ? (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                          👖 Pantaloni ({vest.pantaloni.taglia || 'L'}) • € 30
                        </span>
                      ) : null}

                      {/* Giubbetto con Cauzione € 45 */}
                      {vest?.giubbetto?.consegnato ? (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                          🦺 Giubbetto ({vest.giubbetto.taglia || 'L'}) • € 45
                        </span>
                      ) : null}

                      {/* Giubbotto Invernale */}
                      {vest?.giubbottoInvernale?.consegnato && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-semibold border border-slate-700">
                          ❄️ Giubb. Invernale ({vest.giubbottoInvernale.taglia || 'L'})
                        </span>
                      )}

                      {countCapi === 0 && (
                        <span className="text-[11px] text-slate-500 italic">
                          Nessun capo di abbigliamento assegnato
                        </span>
                      )}
                    </div>

                    {/* Riepilogo Cauzione Versata & IBAN */}
                    <div className="shrink-0 text-left lg:text-right min-w-[140px]">
                      <span className="text-[10px] text-slate-400 block font-mono">Cauzione Custodita:</span>
                      <span className={`text-sm font-black font-mono ${cauzioni.totale > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        € {cauzioni.totale.toFixed(2).replace('.', ',')}
                      </span>
                      {vest?.ibanRestituzioneCauzione ? (
                        <div className="text-[10px] text-amber-300 font-mono mt-0.5 tracking-tight truncate max-w-[170px]" title={`IBAN rimborso: ${vest.ibanRestituzioneCauzione}`}>
                          IBAN: {vest.ibanRestituzioneCauzione.slice(0, 10)}...
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                          IBAN non inserito
                        </div>
                      )}
                    </div>

                    {/* Azioni PDF, Documento Firmato & Restituzione Divisa */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleScaricaScheda(v)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Scarica Scheda Vestiario & DPI (PDF)"
                      >
                        <FileDown className="w-3.5 h-3.5 text-amber-400" />
                        <span>Scheda PDF</span>
                      </button>

                      {/* Documento Stampato e Firmato */}
                      {vest?.documentoFirmato ? (
                        <button
                          type="button"
                          onClick={() => scaricaDocFirmato(vest.documentoFirmato!.fileBase64, vest.documentoFirmato!.nomeFile)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                          title={`Scarica Scheda Stampata & Firmata (${vest.documentoFirmato.nomeFile} - archiviato il ${vest.documentoFirmato.dataUpload})`}
                        >
                          <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Doc Firmato ✓</span>
                        </button>
                      ) : (
                        <label
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Carica la scansione o il PDF firmato di questo volontario"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span>Carica Firmato</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => handleUploadDocFirmatoRow(v, e)}
                            className="hidden"
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        onClick={() => setVolontarioPerRestituzione(v)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Registra restituzione divisa e genera verbale rimborso cauzione con bonifico"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-950" />
                        <span>Restituzione Divisa</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Croce Oro Massa Carrara ETS • Gestione Capi in Comodato e Cauzioni</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Chiudi Registro
          </button>
        </div>

      </div>

      {/* Modale Restituzione Divisa */}
      {volontarioPerRestituzione && (
        <ModalRestituzioneDivisa
          isOpen={!!volontarioPerRestituzione}
          onClose={() => setVolontarioPerRestituzione(null)}
          volontario={volontarioPerRestituzione}
          onConfermaRestituzione={handleConfermaRestituzioneEseguita}
          onNotificaRadio={onNotificaRadio}
        />
      )}
    </div>
  );
};
