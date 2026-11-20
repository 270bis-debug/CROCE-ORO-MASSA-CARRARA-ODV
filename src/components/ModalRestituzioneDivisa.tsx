import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  CreditCard,
  FileDown,
  Building,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Banknote
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import { CAUZIONE_PANTALONI, CAUZIONE_GIUBBETTO } from '../data/vestiarioDocumenti';
import { generaPDFRestituzioneDivisa, DatiRestituzioneDivisa } from '../utils/pdfRestituzioneDivisa';
import { PdfAnteprimaWorkflowModal } from './admin/PdfAnteprimaWorkflowModal';
import { generaBytesDaJsPDF } from '../utils/pdfWorkflowUtils';
import { formatISODateItaly } from '../utils/italianTime';

interface ModalRestituzioneDivisaProps {
  isOpen: boolean;
  onClose: () => void;
  volontario: Volontario | null;
  onConfermaRestituzione?: (volontarioAggiornato: Volontario) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const ModalRestituzioneDivisa: React.FC<ModalRestituzioneDivisaProps> = ({
  isOpen,
  onClose,
  volontario,
  onConfermaRestituzione,
  onNotificaRadio
}) => {
  if (!isOpen || !volontario) return null;

  const vest = volontario.vestiario;
  const haPantaloni = !!vest?.pantaloni?.consegnato;
  const haGiubbetto = !!vest?.giubbetto?.consegnato;

  // Stato Capi Restituiti
  const [restituisciPantaloni, setRestituisciPantaloni] = useState(haPantaloni);
  const [restituisciGiubbetto, setRestituisciGiubbetto] = useState(haGiubbetto);
  const [restituisciFelpa, setRestituisciFelpa] = useState(false);
  const [restituisciPile, setRestituisciPile] = useState(false);
  const [restituisciGiubbotto, setRestituisciGiubbotto] = useState(false);
  const [restituisciTshirt, setRestituisciTshirt] = useState(false);

  // Coordinate Bancarie e Note
  const [iban, setIban] = useState(volontario.vestiario?.ibanRestituzioneCauzione || '');
  const [intestatario, setIntestatario] = useState(`${volontario.nome} ${volontario.cognome}`);
  const [dataRestituzione, setDataRestituzione] = useState(formatISODateItaly());
  const [annotazioni, setAnnotazioni] = useState(
    'I capi di vestiario sono stati riconsegnati lavati e in buone condizioni d\'uso. Si dispone il rimborso integrale della cauzione versata a mezzo bonifico bancario sulle coordinate IBAN indicate.'
  );
  const [scaricato, setScaricato] = useState(false);
  const [aggiornaDatabase, setAggiornaDatabase] = useState(true);
  const [erroreValidazione, setErroreValidazione] = useState<string | null>(null);
  const [bozzaRestituzione, setBozzaRestituzione] = useState<{ dati: DatiRestituzioneDivisa; salvato: boolean } | null>(null);

  // Calcolo automatico della cauzione da restituire
  const rimborsoPantaloni = restituisciPantaloni ? CAUZIONE_PANTALONI : 0;
  const rimborsoGiubbetto = restituisciGiubbetto ? CAUZIONE_GIUBBETTO : 0;
  const cifraTotaleRimborso = rimborsoPantaloni + rimborsoGiubbetto;

  const salvaRestituzioneInArchivio = () => {
    if (onNotificaRadio) {
      onNotificaRadio(
        `📄 Generato Verbale Restituzione Divisa per ${volontario.nome} ${volontario.cognome}: rimborso cauzione € ${cifraTotaleRimborso.toFixed(2)} con bonifico`,
        'centrale'
      );
    }

    if (aggiornaDatabase && onConfermaRestituzione && vest) {
      const vestAggiornato = JSON.parse(JSON.stringify(vest));
      if (restituisciPantaloni && vestAggiornato.pantaloni) {
        vestAggiornato.pantaloni.consegnato = false;
      }
      if (restituisciGiubbetto && vestAggiornato.giubbetto) {
        vestAggiornato.giubbetto.consegnato = false;
      }
      if (restituisciFelpa && vestAggiornato.felpa) {
        vestAggiornato.felpa.consegnato = false;
      }
      if (restituisciPile && vestAggiornato.pile) {
        vestAggiornato.pile.consegnato = false;
      }
      if (restituisciGiubbotto && vestAggiornato.giubbottoInvernale) {
        vestAggiornato.giubbottoInvernale.consegnato = false;
      }

      onConfermaRestituzione({
        ...volontario,
        vestiario: vestAggiornato
      });
    }
    setScaricato(true);
  };

  const handleApriAnteprimaPDF = () => {
    if (!iban.trim()) {
      setErroreValidazione('Inserisci l\'IBAN per il bonifico di restituzione della cauzione.');
      return;
    }
    setErroreValidazione(null);

    const altri: string[] = [];
    if (restituisciFelpa) altri.push('Felpa con loghi');
    if (restituisciPile) altri.push('Pile Tecnico');
    if (restituisciGiubbotto) altri.push('Giubbotto Invernale D.P.I.');
    if (restituisciTshirt) altri.push('T-shirt Istituzionali');

    const dati: DatiRestituzioneDivisa = {
      dataRestituzione,
      ibanBonifico: iban.trim().toUpperCase(),
      intestatarioBonifico: intestatario.trim(),
      restituitoPantaloni: restituisciPantaloni,
      restituitoGiubbetto: restituisciGiubbetto,
      altriCapiRestituiti: altri,
      cifraRimborsoTotale: cifraTotaleRimborso,
      annotazioniAdmin: annotazioni.trim()
    };

    setBozzaRestituzione({ dati, salvato: false });
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-60 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Intestazione */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wide flex items-center gap-2">
                Restituzione Divisa & Rimborso Cauzione
              </h3>
              <p className="text-xs text-slate-400">
                Socio: <strong className="text-amber-300">{volontario.nome} {volontario.cognome}</strong> ({volontario.matricola || 'VOL'}) • CF: <span className="font-mono">{volontario.codiceFiscale || 'N/D'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Selezione Capi Restituiti con Cauzione */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-amber-300 uppercase tracking-wide">
            1. Capi di Vestiario Riconsegnati
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Pantaloni */}
            <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
              restituisciPantaloni ? 'bg-amber-500/15 border-amber-500/60 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={restituisciPantaloni}
                  onChange={(e) => setRestituisciPantaloni(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold block">Pantaloni Operativi</span>
                  <span className="text-[10px] text-slate-400">Cauzione: € 30,00</span>
                </div>
              </div>
              <span className="font-mono font-bold text-amber-400 text-xs">
                {restituisciPantaloni ? '+ € 30,00' : '€ 0,00'}
              </span>
            </label>

            {/* Giubbetto */}
            <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
              restituisciGiubbetto ? 'bg-amber-500/15 border-amber-500/60 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={restituisciGiubbetto}
                  onChange={(e) => setRestituisciGiubbetto(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold block">Giubbetto Operativo</span>
                  <span className="text-[10px] text-slate-400">Cauzione: € 45,00</span>
                </div>
              </div>
              <span className="font-mono font-bold text-amber-400 text-xs">
                {restituisciGiubbetto ? '+ € 45,00' : '€ 0,00'}
              </span>
            </label>
          </div>

          {/* Altri capi restituiti senza cauzione */}
          <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] space-y-1">
            <span className="text-slate-400 font-semibold block">Altri capi riconsegnati (comodato gratuito):</span>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restituisciFelpa}
                  onChange={(e) => setRestituisciFelpa(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <span>Felpa</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restituisciPile}
                  onChange={(e) => setRestituisciPile(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <span>Pile</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restituisciGiubbotto}
                  onChange={(e) => setRestituisciGiubbotto(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <span>Giubbotto Invernale</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restituisciTshirt}
                  onChange={(e) => setRestituisciTshirt(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 accent-amber-500"
                />
                <span>T-shirt</span>
              </label>
            </div>
          </div>
        </div>

        {/* Box Totale Rimborso Automatico */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-500/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-black text-amber-300 uppercase tracking-wide block">
                Cifra da Restituire con Bonifico (Recuperata in Automatico):
              </span>
              <span className="text-[11px] text-slate-300">
                Pantaloni: € {rimborsoPantaloni.toFixed(2)} • Giubbetto: € {rimborsoGiubbetto.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">
              € {cifraTotaleRimborso.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* 2. Coordinate Bancarie (IBAN per Bonifico) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-amber-300 uppercase tracking-wide">
            2. Coordinate Bancarie per il Bonifico di Rimborso
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>IBAN del Volontario * (Obbligatorio)</span>
              </label>
              <input
                type="text"
                required
                maxLength={34}
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="IT60X0542811101000000123456"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/50 text-amber-300 font-mono text-xs uppercase tracking-wider focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Intestatario del Conto</span>
              </label>
              <input
                type="text"
                value={intestatario}
                onChange={(e) => setIntestatario(e.target.value)}
                placeholder="Nome e Cognome Intestatario"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Annotazioni dell'Amministratore (Editabili da PC prima della Stampa) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center justify-between">
            <span>3. Annotazioni dell'Amministratore (Editabile da PC prima della stampa)</span>
            <span className="text-[10px] text-slate-400 font-normal">Stampate nel PDF</span>
          </label>
          <textarea
            rows={2}
            value={annotazioni}
            onChange={(e) => setAnnotazioni(e.target.value)}
            placeholder="Scrivi qui eventuali note sullo stato dei capi o estremi del bonifico..."
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Opzione aggiorna database */}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 p-2 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={aggiornaDatabase}
            onChange={(e) => setAggiornaDatabase(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
          />
          <span>Aggiorna automaticamente il database rimuovendo i capi restituiti dalla dotazione del volontario</span>
        </label>

        {erroreValidazione && (
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{erroreValidazione}</span>
          </div>
        )}

        {/* Pulsanti Azione */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Annulla
          </button>

          <button
            type="button"
            onClick={handleApriAnteprimaPDF}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Anteprima, Stampa o Salva PDF Restituzione</span>
          </button>
        </div>

        {scaricato && (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Verbale di Restituzione salvato in archivio! Il bonifico di € {cifraTotaleRimborso.toFixed(2)} verrà liquidato sull'IBAN indicato.</span>
          </div>
        )}
      </div>

      {bozzaRestituzione && (
        <PdfAnteprimaWorkflowModal
          aperto={true}
          titoloDocumento={`Verbale Restituzione Divisa - ${volontario.nome} ${volontario.cognome}`}
          sottotitolo={`Rimborso Cauzione € ${bozzaRestituzione.dati.cifraRimborsoTotale.toFixed(2)} • IBAN ${bozzaRestituzione.dati.ibanBonifico}`}
          nomeFile={`Verbale_Restituzione_Divisa_${(volontario.cognome || 'Volontario').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
          giaSalvatoInArchivio={bozzaRestituzione.salvato}
          generaPdfBytes={() => generaBytesDaJsPDF(generaPDFRestituzioneDivisa(volontario, bozzaRestituzione.dati))}
          riepilogoContenuto={
            <div className="space-y-2 text-xs">
              <div>Volontario: <strong>{volontario.nome} {volontario.cognome}</strong> ({volontario.matricola || 'VOL'})</div>
              <div>Data Restituzione: <strong className="font-mono">{bozzaRestituzione.dati.dataRestituzione}</strong></div>
              <div>IBAN Rimborso: <strong className="font-mono">{bozzaRestituzione.dati.ibanBonifico}</strong></div>
              <div>Intestatario: <strong>{bozzaRestituzione.dati.intestatarioBonifico}</strong></div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-emerald-700 text-sm">
                <span>Totale Cauzione da Rimborsare:</span>
                <span>€ {bozzaRestituzione.dati.cifraRimborsoTotale.toFixed(2)}</span>
              </div>
            </div>
          }
          onSalvaInArchivio={() => {
            salvaRestituzioneInArchivio();
            setBozzaRestituzione((prev) => (prev ? { ...prev, salvato: true } : null));
          }}
          onTornaAllaModifica={() => setBozzaRestituzione(null)}
          onChiudi={() => setBozzaRestituzione(null)}
        />
      )}
    </div>
  );
};
