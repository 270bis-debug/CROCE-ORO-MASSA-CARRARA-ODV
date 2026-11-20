import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Download,
  Printer,
  ShieldCheck,
  Heart,
  UserCheck,
  Camera,
  Building,
  CheckCircle2,
  AlertTriangle,
  User,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Lock,
  Unlock,
  Sparkles,
  Save,
  Upload,
  FileCheck,
  Trash2
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';
import { DocumentoFirmatoArchiviato } from '../data/vestiarioDocumenti';
import {
  DatiDomandaIscrizione,
  GruppoSanguigno,
  GRUPPI_SANGUIGNI,
  creaDatiDomandaIscrizionePredefiniti
} from '../data/domandaIscrizione';
import {
  isPeriodoInserimentoManualeTessere,
  calcolaProssimoNumeroTessera,
  DATA_LIMITE_MANUALE_TESSERE
} from '../data/tesseramento';
import { generaPDFDomandaIscrizione, recuperaFirmaPresidente } from '../utils/pdfDomandaIscrizione';
import { PdfAnteprimaWorkflowModal } from './admin/PdfAnteprimaWorkflowModal';
import { generaBytesDaJsPDF } from '../utils/pdfWorkflowUtils';
import { formatDateItaly, formatISODateItaly, formatTimeItaly, getCurrentYearItaly } from '../utils/italianTime';

interface ModalCompilaDomandaIscrizioneProps {
  isOpen: boolean;
  onClose: () => void;
  volontario: Volontario | null;
  volontari?: Volontario[];
  onSalvaVolontario?: (volontarioAggiornato: Volontario) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  embedded?: boolean;
  onDatiChange?: (dati: DatiDomandaIscrizione) => void;
}

export const ModalCompilaDomandaIscrizione: React.FC<ModalCompilaDomandaIscrizioneProps> = ({
  isOpen,
  onClose,
  volontario,
  volontari = [],
  onSalvaVolontario,
  onNotificaRadio,
  embedded = false,
  onDatiChange
}) => {
  const [dati, setDatiState] = useState<DatiDomandaIscrizione>(creaDatiDomandaIscrizionePredefiniti());
  const [tabAttiva, setTabAttiva] = useState<'sanitari' | 'dichiarazioni' | 'tutore' | 'privacy' | 'foto' | 'associazione'>('sanitari');
  const [messaggioConferma, setMessaggioConferma] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);
  const [confermaRimuoviFirmata, setConfermaRimuoviFirmata] = useState(false);
  const [anteprimaWorkflowAperta, setAnteprimaWorkflowAperta] = useState(false);
  const [salvatoWorkflow, setSalvatoWorkflow] = useState(false);
  const fileInputDomandaFirmataRef = useRef<HTMLInputElement>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const setDati = (next: DatiDomandaIscrizione) => {
    setDatiState(next);
    if (onDatiChange) {
      onDatiChange(next);
    }
  };

  const isManualeAttivo = isPeriodoInserimentoManualeTessere();
  const isOperatore = !!(volontario?.profiloCentrale || volontario?.qualifica === 'Operatore Centrale');
  const infoTessera = calcolaProssimoNumeroTessera(volontari.length > 0 ? volontari : (volontario ? [volontario] : []), isOperatore);

  useEffect(() => {
    if (!isOpen || !volontario) {
      loadedKeyRef.current = null;
      return;
    }

    const keyCorrente = `${volontario.id}:${embedded ? 'embedded' : 'modal'}:${isManualeAttivo ? '1' : '0'}`;
    if (loadedKeyRef.current === keyCorrente) {
      return;
    }
    loadedKeyRef.current = keyCorrente;

    const def = creaDatiDomandaIscrizionePredefiniti();
    const salvati = (volontario as any).domandaIscrizioneDati;
    const isEsente = salvati?.esenteQuota !== undefined
      ? Boolean(salvati.esenteQuota)
      : Boolean(volontario.esenteQuotaAssociativa);
    const motivoEs = salvati?.motivoEsenzione || volontario.motivoEsenzioneQuota || 'Benemerito';
    const quotaSuggerita = isOperatore ? 10.0 : 5.0;
    const numEsistente = volontario.tesseramento?.numeroTessera || '';

    // Fino al 31/10/2026: l'amministratore può digitare liberamente qualsiasi numero.
    // Dopo il 31/10/2026: assegnazione automatica del progressivo (+1 dall'ultima emessa),
    // a meno che non ci sia già un numero registrato o forzatura manuale.
    let numTesseraIniziale = numEsistente;
    if (!numTesseraIniziale) {
      if (isManualeAttivo) {
        numTesseraIniziale = volontario.matricola || infoTessera.prossimoNumeroTessera;
      } else {
        numTesseraIniziale = infoTessera.prossimoNumeroTessera;
      }
    }

    setDatiState({
      ...def,
      ...(salvati || {}),
      esenteQuota: isEsente,
      motivoEsenzione: motivoEs,
      quotaVersata: isEsente ? 0 : (salvati?.quotaVersata !== undefined ? salvati.quotaVersata : quotaSuggerita),
      numeroTessera: salvati?.numeroTessera || numTesseraIniziale,
      forzaturaNumeroTessera: salvati?.forzaturaNumeroTessera || false,
      numeroIscrizioneLibroSoci: salvati?.numeroIscrizioneLibroSoci || `LS-2026/${(salvati?.numeroTessera || numTesseraIniziale).replace(/\D/g, '') || '01'}`,
      richiedenteMinorenne: salvati?.richiedenteMinorenne !== undefined ? salvati.richiedenteMinorenne : false,
      genitoreNomeCognome: salvati?.genitoreNomeCognome || '',
      genitoreRecapiti: salvati?.genitoreRecapiti || '',
      genitoreLuogoData: salvati?.genitoreLuogoData || ''
    });
    setConfermaRimuoviFirmata(false);
  }, [volontario, isOpen, isManualeAttivo, embedded, isOperatore, infoTessera.prossimoNumeroTessera]);

  if (!isOpen || !volontario) return null;

  const sincronizzaVolontario = () => {
    if (onSalvaVolontario && volontario && dati.numeroTessera) {
      const volAgg: Volontario = {
        ...volontario,
        esenteQuotaAssociativa: Boolean(dati.esenteQuota),
        motivoEsenzioneQuota: dati.esenteQuota ? (dati.motivoEsenzione || 'Benemerito') : undefined,
        domandaIscrizioneDati: {
          ...dati,
          esenteQuota: Boolean(dati.esenteQuota),
          motivoEsenzione: dati.esenteQuota ? (dati.motivoEsenzione || 'Benemerito') : undefined,
          richiedenteMinorenne: Boolean(dati.richiedenteMinorenne),
          genitoreNomeCognome: dati.genitoreNomeCognome || '',
          genitoreRecapiti: dati.genitoreRecapiti || '',
          genitoreLuogoData: dati.genitoreLuogoData || ''
        },
        tesseramento: {
          ...(volontario.tesseramento || {
            annoRiferimento: getCurrentYearItaly(),
            rinnovata: true
          }),
          numeroTessera: dati.numeroTessera.trim(),
          importoVersato: dati.esenteQuota ? 0 : dati.quotaVersata,
          dataPrimaIscrizione: volontario.tesseramento?.dataPrimaIscrizione || dati.deliberaData || formatISODateItaly()
        }
      };
      onSalvaVolontario(volAgg);
    }
  };

  const handleApriWorkflowPDF = () => {
    setSalvatoWorkflow(false);
    setAnteprimaWorkflowAperta(true);
  };

  const handleSalvaSoloDati = () => {
    sincronizzaVolontario();
    setMessaggioConferma({
      tipo: 'ok',
      testo: `💾 Dati Domanda e tessera ${dati.numeroTessera} allineati nel database per ${volontario.nome} ${volontario.cognome}!`
    });
    if (onNotificaRadio) {
      onNotificaRadio(`💾 Delibera e tessera N. ${dati.numeroTessera} salvate nel database per ${volontario.nome} ${volontario.cognome}`, 'centrale');
    }
    setTimeout(() => setMessaggioConferma(null), 4000);
  };

  const handleUploadDomandaFirmata = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !volontario) return;

    if (file.size > 25 * 1024 * 1024) {
      setMessaggioConferma({
        tipo: 'err',
        testo: 'Il file selezionato supera i 25 MB consentiti. Carica una scansione PDF o immagine più leggera.'
      });
      setTimeout(() => setMessaggioConferma(null), 5000);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const oraUpload = `${formatDateItaly()} ore ${formatTimeItaly(undefined, false)}`;
      const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(file.size / 1024)} KB`;

      const docFirmato: DocumentoFirmatoArchiviato = {
        fileBase64: base64,
        nomeFile: file.name,
        dataUpload: oraUpload,
        dimensione: sizeStr
      };

      const volAggiornato: Volontario = {
        ...volontario,
        domandaIscrizioneDati: { ...dati },
        domandaIscrizioneFirmata: docFirmato,
        tesseramento: {
          ...(volontario.tesseramento || {
            annoRiferimento: getCurrentYearItaly(),
            rinnovata: true
          }),
          numeroTessera: dati.numeroTessera ? dati.numeroTessera.trim() : (volontario.tesseramento?.numeroTessera || volontario.matricola || 'TV-101'),
          importoVersato: dati.esenteQuota ? 0 : (dati.quotaVersata !== undefined ? dati.quotaVersata : 5.0),
          dataPrimaIscrizione: volontario.tesseramento?.dataPrimaIscrizione || dati.deliberaData || formatISODateItaly()
        }
      };

      if (onSalvaVolontario) {
        onSalvaVolontario(volAggiornato);
      }

      setMessaggioConferma({
        tipo: 'ok',
        testo: `✅ Domanda di Iscrizione stampata e firmata archiviata con successo nella scheda di ${volontario.nome} ${volontario.cognome}!`
      });
      if (onNotificaRadio) {
        onNotificaRadio(`📁 ARCHIVIAZIONE: Domanda di iscrizione firmata archiviata per ${volontario.nome} ${volontario.cognome} (${file.name})`, 'centrale');
      }
      setTimeout(() => setMessaggioConferma(null), 5000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleScaricaDomandaFirmata = () => {
    if (!volontario?.domandaIscrizioneFirmata) return;
    const { fileBase64, nomeFile } = volontario.domandaIscrizioneFirmata;
    const a = document.createElement('a');
    a.href = fileBase64;
    a.download = nomeFile || `Domanda_Iscrizione_Firmata_${volontario.cognome}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const confermaRimozioneDomandaFirmata = () => {
    if (!volontario?.domandaIscrizioneFirmata) return;

    const volAggiornato: Volontario = {
      ...volontario,
      domandaIscrizioneDati: { ...dati },
      domandaIscrizioneFirmata: undefined
    };

    if (onSalvaVolontario) {
      onSalvaVolontario(volAggiornato);
    }
    setConfermaRimuoviFirmata(false);
    setMessaggioConferma({
      tipo: 'ok',
      testo: `Documento firmato rimosso dalla scheda di ${volontario.nome} ${volontario.cognome}.`
    });
    setTimeout(() => setMessaggioConferma(null), 4000);
  };

  const renderNotificaBanner = () =>
    messaggioConferma ? (
      <div
        className={`px-4 py-2 text-xs font-bold flex items-center justify-between ${
          messaggioConferma.tipo === 'err'
            ? 'bg-red-500/20 border-b border-red-500/40 text-red-200 rounded-xl'
            : 'bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 rounded-xl'
        }`}
      >
        <span>{messaggioConferma.testo}</span>
        <button
          type="button"
          onClick={() => setMessaggioConferma(null)}
          className={messaggioConferma.tipo === 'err' ? 'text-red-300 hover:text-white cursor-pointer' : 'text-emerald-400 hover:text-white cursor-pointer'}
        >
          ✕
        </button>
      </div>
    ) : null;

  const renderCorpoCompilazione = () => (
    <div className="space-y-4 text-xs">
      {/* Box Dati Recuperati in Automatico da Sezione 1 e Sezione 2 */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                Dati Automatici da Sez. 1 (Anagrafica) & Sez. 2 (Documenti & Patente)
              </span>
              <span className="text-[10px] text-slate-400">
                Matricola: <span className="text-white font-mono font-bold">{volontario.matricola || 'VOL'}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-white">{volontario.cognome.toUpperCase()} {volontario.nome}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{volontario.qualifica}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>CF: {volontario.codiceFiscale || 'Non specificato'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Residenza: {volontario.indirizzoResidenza || 'Non specificata'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{volontario.telefono || 'Nessun telefono'}</span>
                  <Mail className="w-3.5 h-3.5 text-slate-500 ml-2" />
                  <span>{volontario.email || 'Nessuna email'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Doc: {volontario.documentoIdentita?.tipo || 'C.I.'} N. {volontario.documentoIdentita?.numero || 'N/D'} (Scad: {volontario.documentoIdentita?.dataScadenza || 'N/D'})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Patente: {volontario.patente?.inPossesso ? `Cat. ${volontario.patente.categoria || 'B'} N. ${volontario.patente.numero || 'N/D'}` : 'Non in possesso'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selector per Sezioni Compilabili (a griglia adattiva, senza scroll orizzontale) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pb-2 border-b border-slate-800 text-[10px] sm:text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setTabAttiva('sanitari')}
              className={`w-full px-2.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer ${
                tabAttiva === 'sanitari'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Heart className="w-3.5 h-3.5 shrink-0" />
              <span>1. Informazioni Sanitarie</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAttiva('dichiarazioni')}
              className={`w-full px-2.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer ${
                tabAttiva === 'dichiarazioni'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>2. Dichiarazioni</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAttiva('tutore')}
              className={`w-full px-2.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer ${
                tabAttiva === 'tutore'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>3. Genitore / Tutore</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAttiva('privacy')}
              className={`w-full px-2.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer ${
                tabAttiva === 'privacy'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>4-5. Privacy & Dati Sanitari</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAttiva('foto')}
              className={`w-full px-2.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer ${
                tabAttiva === 'foto'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>6. Consenso Foto / Video</span>
            </button>
            <button
              type="button"
              onClick={() => setTabAttiva('associazione')}
              className={`w-full px-2.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer ${
                tabAttiva === 'associazione'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Building className="w-3.5 h-3.5 shrink-0" />
              <span>7. Riservato Associazione</span>
            </button>
          </div>

          {/* TAB 1: INFORMAZIONI SANITARIE PER EVENTUALI ATTIVITÀ OPERATIVE */}
          {tabAttiva === 'sanitari' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  1. Informazioni Sanitarie per Attività Operative (Sicurezza dei Servizi)
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Compilazione riservata e limitata alle informazioni effettivamente necessarie per la sicurezza e l’organizzazione dei servizi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Gruppo Sanguigno (se conosciuto)
                  </label>
                  <select
                    value={dati.gruppoSanguigno || 'Non noto'}
                    onChange={(e) => setDati({ ...dati, gruppoSanguigno: e.target.value as GruppoSanguigno })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {GRUPPI_SANGUIGNI.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Antitetanica (Ultima dose)
                    </label>
                    <input
                      type="date"
                      value={dati.antitetanicaUltimaDose || ''}
                      onChange={(e) => setDati({ ...dati, antitetanicaUltimaDose: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Scadenza / Richiamo
                    </label>
                    <input
                      type="date"
                      value={dati.antitetanicaScadenza || ''}
                      onChange={(e) => setDati({ ...dati, antitetanicaScadenza: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Eventuali informazioni o limitazioni rilevanti per la sicurezza durante le attività:
                </label>
                <textarea
                  rows={3}
                  value={dati.limitazioniSicurezza || ''}
                  onChange={(e) => setDati({ ...dati, limitazioniSicurezza: e.target.value })}
                  placeholder="Facoltativo; non indicare diagnosi non necessarie. Es. allergia a farmaci, intolleranze, limitazioni a carichi pesanti..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: DICHIARAZIONI DEL RICHIEDENTE */}
          {tabAttiva === 'dichiarazioni' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  2. Dichiarazioni del Richiedente & Impegno Statutario
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-2">
                  <p>
                    «Chiedo di essere ammesso/a secondo le procedure previste dallo Statuto e mi impegno, in caso di ammissione, a rispettare Statuto, regolamenti, disposizioni degli organi associativi e procedure di sicurezza e riservatezza.»
                  </p>
                  <p>
                    «Sono consapevole che la domanda non comporta l’automatica ammissione a socio/a né l’autorizzazione a svolgere attività operative. L’eventuale quota associativa sarà quella stabilita dall’associazione e comunicata al richiedente.»
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Luogo della richiesta
                    </label>
                    <input
                      type="text"
                      value={dati.luogoRichiesta || ''}
                      onChange={(e) => setDati({ ...dati, luogoRichiesta: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Data della richiesta
                    </label>
                    <input
                      type="date"
                      value={dati.dataRichiesta || ''}
                      onChange={(e) => setDati({ ...dati, dataRichiesta: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs">Firma del richiedente:</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {volontario.firmaBase64
                        ? '✅ Firma digitale già presente in archivio (verrà apposta automaticamente sul PDF).'
                        : '⚠️ Firma non presente: il socio la apporrà sul foglio cartaceo o direttamente al primo accesso sul device.'}
                    </p>
                  </div>
                  {volontario.firmaBase64 && (
                    <div className="h-10 w-24 bg-white/10 rounded-lg p-1 border border-slate-700 flex items-center justify-center">
                      <img src={volontario.firmaBase64} alt="Firma" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DICHIARAZIONE DEL GENITORE / TUTORE (SOLO PER MINORENNI) */}
          {tabAttiva === 'tutore' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <User className="w-4 h-4 text-sky-400" />
                    3. Dichiarazione del Genitore / Tutore (Solo per Minorenni)
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dati.richiedenteMinorenne || false}
                      onChange={(e) => setDati({ ...dati, richiedenteMinorenne: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-[11px] font-bold text-amber-300">Richiedente Minorenne</span>
                  </label>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  «Il/La sottoscritto/a, in qualità di genitore o esercente la responsabilità genitoriale, dichiara di essere informato/a della domanda presentata dal/dalla minore e autorizza la presentazione della domanda nei limiti previsti dallo Statuto e dalle norme applicabili.»
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nome e Cognome Genitore / Tutore:
                    </label>
                    <input
                      type="text"
                      value={dati.genitoreNomeCognome || ''}
                      onChange={(e) => setDati({ ...dati, genitoreNomeCognome: e.target.value })}
                      placeholder="Scrivi nome e cognome genitore o esercente potestà"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Telefono / E-mail Genitore / Tutore:
                    </label>
                    <input
                      type="text"
                      value={dati.genitoreRecapiti || ''}
                      onChange={(e) => setDati({ ...dati, genitoreRecapiti: e.target.value })}
                      placeholder="Es. Tel: 333 1234567 • Email: genitore@email.it"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Luogo e data dichiarazione genitore:
                  </label>
                  <input
                    type="text"
                    value={dati.genitoreLuogoData || ''}
                    onChange={(e) => setDati({ ...dati, genitoreLuogoData: e.target.value })}
                    placeholder="Massa Carrara, GG/MM/AAAA"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INFORMATIVA PRIVACY & CONSENSO DATI SANITARI */}
          {tabAttiva === 'privacy' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Sezione 4: Informativa Privacy */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  4. Informativa Privacy — Trattamento Dati Personali (Regolamento UE 2016/679)
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                  <p>
                    CROCE ORO MASSA CARRARA OdV tratterà i dati forniti per gestire la domanda, valutare l’ammissione e, se accolta, amministrare il rapporto associativo e l’eventuale attività di volontariato. I dati saranno trattati secondo il Regolamento (UE) 2016/679 e la normativa applicabile.
                  </p>
                  <p>
                    I dati saranno accessibili soltanto a persone autorizzate e conservati per il tempo necessario alle finalità e agli obblighi di legge. L’interessato può esercitare i diritti previsti dalla normativa contattando l’associazione ai recapiti ufficiali. Informativa completa su <span className="text-amber-400 underline font-bold">www.croceoro.org</span>.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={dati.presaVisionePrivacy !== false}
                    onChange={(e) => setDati({ ...dati, presaVisionePrivacy: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
                  />
                  <span className="text-xs font-bold text-emerald-300">
                    [ X ] Dichiaro di aver ricevuto o di aver avuto accesso all’informativa privacy completa.
                  </span>
                </label>
              </div>

              {/* Sezione 5: Consenso Esplicito Dati Sanitari */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3">
                <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Heart className="w-4 h-4 text-amber-400" />
                  5. Consenso Esplicito al Trattamento dei Dati Sanitari
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  I dati sanitari eventualmente forniti (ad esempio gruppo sanguigno, informazioni sulla vaccinazione antitetanica o limitazioni rilevanti per la sicurezza) costituiscono dati particolari. Il loro conferimento è facoltativo e devono essere raccolti solo se necessari, con accesso limitato e adeguate misure di protezione.
                </p>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-emerald-500/50">
                    <input
                      type="radio"
                      name="consensoDatiSanitari"
                      value="acconsento"
                      checked={dati.consensoDatiSanitari === 'acconsento'}
                      onChange={() => setDati({ ...dati, consensoDatiSanitari: 'acconsento' })}
                      className="w-4 h-4 text-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      [ X ] Acconsento al trattamento delle informazioni sanitarie sopra indicate esclusivamente per le finalità di sicurezza e organizzazione delle attività associative descritte nell’informativa.
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-rose-500/50">
                    <input
                      type="radio"
                      name="consensoDatiSanitari"
                      value="non_acconsento"
                      checked={dati.consensoDatiSanitari === 'non_acconsento'}
                      onChange={() => setDati({ ...dati, consensoDatiSanitari: 'non_acconsento' })}
                      className="w-4 h-4 text-rose-500"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      [   ] NON acconsento al trattamento di informazioni sanitarie. Comprendo che, se tali informazioni fossero necessarie per specifiche attività, l’associazione potrà non assegnarmi a quelle attività fino alle verifiche richieste.
                    </span>
                  </label>
                </div>

                {/* Visualizzazione e conferma firma per Informativa Privacy (Riquadro 4) e Dati Sanitari (Riquadro 5) */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Firma del richiedente per Privacy (Riquadro 4) e Dati Sanitari (Riquadro 5):
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {volontario.firmaBase64
                        ? '✅ Firma digitale già presente in archivio: verrà apposta automaticamente nel Riquadro 4 e nel Riquadro 5 (Pagina 2).'
                        : '⚠️ Nessuna firma caricata per questo volontario: il socio la apporrà in calce sul foglio stampato.'}
                    </p>
                  </div>
                  {volontario.firmaBase64 && (
                    <div className="h-9 w-24 bg-white/10 rounded-lg p-1 border border-slate-700 flex items-center justify-center shrink-0">
                      <img src={volontario.firmaBase64} alt="Firma" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CONSENSO FACOLTATIVO PER FOTO E VIDEO */}
          {tabAttiva === 'foto' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Camera className="w-4 h-4 text-sky-400" />
                  6. Consenso Facoltativo per Foto e Video
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                  <p>
                    Durante attività, eventi, esercitazioni e servizi possono essere realizzate immagini e riprese video in cui il/la richiedente sia riconoscibile. Il consenso è facoltativo e distinto dalla domanda associativa.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Il consenso può essere revocato per il futuro contattando l’associazione. La revoca non pregiudica la liceità degli utilizzi precedenti; per contenuti già pubblicati l’associazione valuterà le richieste nei limiti tecnici e giuridici applicabili.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <input
                      type="checkbox"
                      checked={dati.consensoFotoSito || false}
                      onChange={(e) => setDati({ ...dati, consensoFotoSito: e.target.checked, consensoFotoNessuno: false })}
                      className="w-4 h-4 rounded text-sky-500"
                    />
                    <span className="text-xs text-slate-200 font-medium">
                      Pubblicazione sul sito ufficiale <strong className="text-white">www.croceoro.org</strong>.
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <input
                      type="checkbox"
                      checked={dati.consensoFotoSocial || false}
                      onChange={(e) => setDati({ ...dati, consensoFotoSocial: e.target.checked, consensoFotoNessuno: false })}
                      className="w-4 h-4 rounded text-sky-500"
                    />
                    <span className="text-xs text-slate-200 font-medium">
                      Pubblicazione sui profili social ufficiali, inclusi Facebook e Instagram.
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <input
                      type="checkbox"
                      checked={dati.consensoFotoVolantini || false}
                      onChange={(e) => setDati({ ...dati, consensoFotoVolantini: e.target.checked, consensoFotoNessuno: false })}
                      className="w-4 h-4 rounded text-sky-500"
                    />
                    <span className="text-xs text-slate-200 font-medium">
                      Utilizzo in volantini, manifesti, brochure e materiali informativi dell’associazione.
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <input
                      type="checkbox"
                      checked={dati.consensoFotoComunicazioniInterne || false}
                      onChange={(e) => setDati({ ...dati, consensoFotoComunicazioniInterne: e.target.checked, consensoFotoNessuno: false })}
                      className="w-4 h-4 rounded text-sky-500"
                    />
                    <span className="text-xs text-slate-200 font-medium">
                      Utilizzo in comunicazioni e documentazione interna riservata a soci e volontari.
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-rose-950/40 border border-rose-500/30">
                    <input
                      type="checkbox"
                      checked={dati.consensoFotoNessuno || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDati({
                          ...dati,
                          consensoFotoNessuno: checked,
                          consensoFotoSito: checked ? false : dati.consensoFotoSito,
                          consensoFotoSocial: checked ? false : dati.consensoFotoSocial,
                          consensoFotoVolantini: checked ? false : dati.consensoFotoVolantini,
                          consensoFotoComunicazioniInterne: checked ? false : dati.consensoFotoComunicazioniInterne
                        });
                      }}
                      className="w-4 h-4 rounded text-rose-500"
                    />
                    <span className="text-xs text-rose-300 font-bold">
                      NON acconsento ad alcuno degli utilizzi sopra indicati.
                    </span>
                  </label>
                </div>

                {/* Visualizzazione e conferma firma per Foto e Video (Riquadro 6) */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Firma del richiedente per Consenso Foto e Materiali Promozionali (Riquadro 6):
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {volontario.firmaBase64
                        ? '✅ Firma digitale già presente in archivio: verrà apposta automaticamente nel Riquadro 6 (Pagina 2).'
                        : '⚠️ Nessuna firma caricata per questo volontario: il socio la apporrà in calce sul foglio stampato.'}
                    </p>
                  </div>
                  {volontario.firmaBase64 && (
                    <div className="h-9 w-24 bg-white/10 rounded-lg p-1 border border-slate-700 flex items-center justify-center shrink-0">
                      <img src={volontario.firmaBase64} alt="Firma" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PARTE RISERVATA ALL'ASSOCIAZIONE */}
          {tabAttiva === 'associazione' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3">
                <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Building className="w-4 h-4 text-amber-400" />
                  7. Parte Riservata all’Associazione (Delibera Organi Statutari)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Domanda Ricevuta il
                    </label>
                    <input
                      type="date"
                      value={dati.domandaRicevutaIl || ''}
                      onChange={(e) => setDati({ ...dati, domandaRicevutaIl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Esito Delibera
                    </label>
                    <select
                      value={dati.esitoDomanda || 'Accolta'}
                      onChange={(e) => setDati({ ...dati, esitoDomanda: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="Accolta">Accolta</option>
                      <option value="In attesa">In attesa</option>
                      <option value="Non accolta">Non accolta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Quota Associativa Versata (€)</span>
                      {dati.esenteQuota && (
                        <span className="text-[10px] text-amber-400 font-bold uppercase">(Esonero attivo)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={!!dati.esenteQuota}
                      value={dati.esenteQuota ? 0 : (dati.quotaVersata ?? 5.0)}
                      onChange={(e) => setDati({ ...dati, quotaVersata: parseFloat(e.target.value) || 0 })}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                        dati.esenteQuota
                          ? 'bg-slate-900 border border-slate-800 text-amber-400 cursor-not-allowed opacity-85'
                          : 'bg-slate-950 border border-slate-700 text-emerald-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Casella Esenzione Quota Associativa con Menu a Tendina */}
                <div className="p-3 rounded-xl bg-slate-900/95 border border-amber-500/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!dati.esenteQuota}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDati({
                            ...dati,
                            esenteQuota: checked,
                            quotaVersata: checked ? 0 : (isOperatore ? 10.0 : 5.0),
                            motivoEsenzione: checked ? (dati.motivoEsenzione || 'Benemerito') : dati.motivoEsenzione
                          });
                        }}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-500 cursor-pointer accent-amber-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Esenzione Quota Associativa (Non riceve quota associativa)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Se flaggata, il socio è esonerato dal versamento della quota annuale (€ 0,00)
                        </span>
                      </div>
                    </label>

                    {dati.esenteQuota && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-black uppercase text-amber-300">Motivo:</span>
                        <select
                          value={dati.motivoEsenzione || 'Benemerito'}
                          onChange={(e) => setDati({ ...dati, motivoEsenzione: e.target.value as any })}
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/50 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none cursor-pointer"
                        >
                          <option value="Benemerito">Benemerito</option>
                          <option value="Giovane">Giovane</option>
                          <option value="LPU / MAP">LPU / MAP</option>
                          <option value="Onorario">Onorario</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Organo Competente
                    </label>
                    <input
                      type="text"
                      value={dati.organoCompetente || ''}
                      onChange={(e) => setDati({ ...dati, organoCompetente: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Delibera N.
                    </label>
                    <input
                      type="text"
                      value={dati.deliberaNumero || ''}
                      onChange={(e) => setDati({ ...dati, deliberaNumero: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Data Delibera
                    </label>
                    <input
                      type="date"
                      value={dati.deliberaData || ''}
                      onChange={(e) => setDati({ ...dati, deliberaData: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* BLOCCO DEDICATO: NUMERO TESSERA SOCIO / VOLONTARIO / OPERATORE (DELIBERA STATUTARIA) */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/40 border border-amber-500/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                        Numero di Tessera del Volontario / Operatore di Centrale
                      </span>
                    </div>

                    {isManualeAttivo ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 w-fit">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Inserimento Manuale Libero (Attivo fino al 31/10/2026)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-500/40 flex items-center gap-1.5 w-fit">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span>Progressivo Automatico (+1)</span>
                      </span>
                    )}
                  </div>

                  {isManualeAttivo ? (
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      L’amministratore può inserire a sistema il numero di tessera del volontario o operatore di centrale in quanto i volontari inseriti sono già soci approvati dagli organi statutari. Questa opzione è attiva fino al <strong>31/10/2026</strong>.
                    </p>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span>Ultima tessera registrata nel database: <strong className="text-amber-300 font-mono">{infoTessera.ultimaTesseraEmessa}</strong></span>
                        <span>Nuovo progressivo aumentato di 1: <strong className="text-emerald-400 font-mono">{infoTessera.prossimoNumeroTessera}</strong></span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        Superata la data del 31/10/2026 la numerazione viene incrementata automaticamente di 1 dall'ultima tessera emessa manualmente. Per inserire forzatamente un numero differente, spunta la casella sottostante.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                        <span>Numero Tessera Assegnato *</span>
                        {!isManualeAttivo && !dati.forzaturaNumeroTessera && (
                          <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Automatico (+1)
                          </span>
                        )}
                        {dati.forzaturaNumeroTessera && (
                          <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> Forzatura manuale
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        disabled={!isManualeAttivo && !dati.forzaturaNumeroTessera}
                        value={dati.numeroTessera || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setDati({
                            ...dati,
                            numeroTessera: val,
                            numeroIscrizioneLibroSoci: dati.numeroIscrizioneLibroSoci || `LS-2026/${val.replace(/\D/g, '') || '01'}`
                          });
                        }}
                        placeholder={isOperatore ? "Es. TO-01" : "Es. TV-101"}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                          !isManualeAttivo && !dati.forzaturaNumeroTessera
                            ? 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed opacity-80'
                            : 'bg-slate-950 border border-amber-500/60 text-amber-300'
                        }`}
                      />
                    </div>

                    {/* Casella per forzare manualmente l'inserimento del numero di tessera */}
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="checkForzaturaTessera"
                        checked={!!dati.forzaturaNumeroTessera}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDati({
                            ...dati,
                            forzaturaNumeroTessera: checked,
                            numeroTessera: checked
                              ? (dati.numeroTessera || infoTessera.prossimoNumeroTessera)
                              : (!isManualeAttivo ? infoTessera.prossimoNumeroTessera : dati.numeroTessera)
                          });
                        }}
                        className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="checkForzaturaTessera" className="text-[11px] text-slate-300 cursor-pointer select-none leading-tight">
                        <span className="font-bold text-white block">Forza inserimento manuale numero tessera</span>
                        <span className="text-[10px] text-slate-400">
                          {isManualeAttivo
                            ? "Opzione per indicare esplicitamente un numero di tessera straordinario/personalizzato."
                            : "Sblocca l'input per digitare forzatamente un numero di tessera differente dal progressivo automatico."}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Numero iscrizione libro soci
                    </label>
                    <input
                      type="text"
                      value={dati.numeroIscrizioneLibroSoci || ''}
                      onChange={(e) => setDati({ ...dati, numeroIscrizioneLibroSoci: e.target.value })}
                      placeholder="Es. LS-2026/04"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Firma del Responsabile
                    </label>
                    <input
                      type="text"
                      value={dati.responsabileNome || 'Presidente / Legale Rappresentante'}
                      onChange={(e) => setDati({ ...dati, responsabileNome: e.target.value })}
                      placeholder="Presidente / Legale Rappresentante"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Visualizzazione e conferma firma autografa Presidente nel Riquadro 7 */}
                {(() => {
                  const fPres = recuperaFirmaPresidente(volontari);
                  return (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <span>✍️</span> Firma Autografa del Presidente (Riquadro 7 - Pagina 2)
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {fPres
                            ? '✅ Firma del Presidente in carica caricata regolarmente (verrà apposta automaticamente nel riquadro 7).'
                            : '⚠️ Nessuna firma caricata per il Presidente.'}
                        </p>
                      </div>
                      {fPres && (
                        <div className="h-10 w-28 bg-white/10 rounded-lg p-1 border border-slate-700 flex items-center justify-center shrink-0">
                          <img src={fPres} alt="Firma Presidente" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Annotazioni (Editabili dal PC/Device prima della stampa)
                  </label>
                  <textarea
                    rows={2}
                    value={dati.annotazioniAssociazione || ''}
                    onChange={(e) => setDati({ ...dati, annotazioniAssociazione: e.target.value })}
                    placeholder="Note su documentazione allegata, casellario giudiziale, verifiche RUNTS..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* ARCHIVIAZIONE SCANSIONE DOMANDA FIRMATA DALL'AMMINISTRATORE E DAL SOCIO */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-teal-950/40 border border-teal-500/40 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-teal-400" />
                      <span className="text-xs font-black text-teal-300 uppercase tracking-wide">
                        Archiviazione Domanda di Iscrizione Stampata & Firmata
                      </span>
                    </div>
                    {volontario.domandaIscrizioneFirmata ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1.5 w-fit">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Documento Firmato Archiviato ✓</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1.5 w-fit">
                        <span>In attesa di stampa, firme cartacee e upload</span>
                      </span>
                    )}
                  </div>

                  {volontario.domandaIscrizioneFirmata ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-400" />
                          <span>{volontario.domandaIscrizioneFirmata.nomeFile}</span>
                          <span className="text-[10px] font-mono text-slate-400">({volontario.domandaIscrizioneFirmata.dimensione || 'File allegato'})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Archiviato il: <strong className="text-emerald-300">{volontario.domandaIscrizioneFirmata.dataUpload}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleScaricaDomandaFirmata}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Scarica Scansione</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputDomandaFirmataRef.current?.click()}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="Sostituisci documento con una nuova scansione"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Sostituisci</span>
                        </button>
                        {!confermaRimuoviFirmata ? (
                          <button
                            type="button"
                            onClick={() => setConfermaRimuoviFirmata(true)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 text-xs transition-colors cursor-pointer"
                            title="Rimuovi file firmato archiviato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-red-950/60 border border-red-500/50 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-red-200 font-bold">Rimuovere?</span>
                            <button
                              type="button"
                              onClick={confermaRimozioneDomandaFirmata}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Sì
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfermaRimuoviFirmata(false)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Una volta stampato il PDF e raccolte le firme autografe del richiedente e del responsabile, carica qui la scansione o foto del documento firmato per conservarlo nella scheda anagrafica del volontario.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputDomandaFirmataRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carica File Firmato</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
    </div>
  );

  const renderAzioniDomanda = (mostraChiudi: boolean) => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="text-[11px] text-slate-400">
        Documento ufficiale <span className="text-white font-bold">Domanda di Iscrizione</span> pronto per esportazione PDF ad alta risoluzione.
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
        {mostraChiudi && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        )}

        <button
          type="button"
          onClick={handleSalvaSoloDati}
          className="px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Salva Tessera nel DB</span>
        </button>

        <button
          type="button"
          onClick={handleApriWorkflowPDF}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Anteprima & Stampa</span>
        </button>

        {/* Input file nascosto per upload scansione domanda firmata */}
        <input
          ref={fileInputDomandaFirmataRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={handleUploadDomandaFirmata}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleApriWorkflowPDF}
          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Genera PDF (Anteprima / Salva)</span>
        </button>

        {/* PULSANTE UPLOAD DOCUMENTO STAMPATO E FIRMATO ACCANTO A SCARICA PDF */}
        {volontario.domandaIscrizioneFirmata ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleScaricaDomandaFirmata}
              className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              title={`Visualizza/Scarica file firmato archiviato: ${volontario.domandaIscrizioneFirmata.nomeFile} (${volontario.domandaIscrizioneFirmata.dataUpload})`}
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>Domanda Firmata ✓</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputDomandaFirmataRef.current?.click()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs transition-all cursor-pointer"
              title="Sostituisci scansione documento firmato"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputDomandaFirmataRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-teal-500/20 active:scale-95 cursor-pointer"
            title="Carica la scansione o foto della Domanda di Iscrizione stampata e firmata per archiviarla nella scheda del volontario"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Carica Domanda Firmata</span>
          </button>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                  Domanda di Iscrizione Socio / Volontario
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Compilabile dal Device
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dati anagrafici e documenti caricati dalle sezioni 1 e 2 • Compila i consensi, salva o esporta il PDF
              </p>
            </div>
          </div>
        </div>

        {renderNotificaBanner()}
        {renderCorpoCompilazione()}

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          {renderAzioniDomanda(false)}
        </div>

        <PdfAnteprimaWorkflowModal
          aperto={anteprimaWorkflowAperta}
          titoloDocumento={`Domanda di Iscrizione - ${volontario.nome} ${volontario.cognome}`}
          sottotitolo={`Tessera N. ${dati.numeroTessera || 'N/D'} • Quota: ${dati.esenteQuota ? 'Esente' : `€ ${Number(dati.quotaVersata || 0).toFixed(2)}`}`}
          nomeFile={`Domanda_Iscrizione_${(volontario.cognome || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_')}_${(volontario.nome || '').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
          giaSalvatoInArchivio={salvatoWorkflow}
          generaPdfBytes={() => generaBytesDaJsPDF(generaPDFDomandaIscrizione(volontario, dati, { volontari }))}
          riepilogoContenuto={
            <div className="space-y-2 text-xs">
              <div>Richiedente: <strong>{volontario.cognome.toUpperCase()} {volontario.nome}</strong></div>
              <div>Codice Fiscale: <strong className="font-mono">{volontario.codiceFiscale || 'N/D'}</strong></div>
              <div>Numero Tessera: <strong className="font-mono">{dati.numeroTessera || 'N/D'}</strong></div>
              <div>Libro Soci: <strong className="font-mono">{dati.numeroIscrizioneLibroSoci || 'N/D'}</strong></div>
              <div>Quota Sociale: <strong>{dati.esenteQuota ? `Esente (${dati.motivoEsenzione || 'Benemerito'})` : `€ ${Number(dati.quotaVersata || 0).toFixed(2)}`}</strong></div>
            </div>
          }
          onSalvaInArchivio={() => {
            sincronizzaVolontario();
            setSalvatoWorkflow(true);
            setMessaggioConferma({
              tipo: 'ok',
              testo: `💾 Domanda di Iscrizione e tessera ${dati.numeroTessera} salvate in archivio per ${volontario.nome} ${volontario.cognome}!`
            });
            if (onNotificaRadio) {
              onNotificaRadio(`📄 Domanda di Iscrizione salvata in archivio per ${volontario.nome} ${volontario.cognome} (Tessera N. ${dati.numeroTessera || 'N/D'})`, 'centrale');
            }
          }}
          onTornaAllaModifica={() => setAnteprimaWorkflowAperta(false)}
          onChiudi={() => setAnteprimaWorkflowAperta(false)}
          onFeedback={(msg) => setMessaggioConferma({ tipo: 'ok', testo: msg })}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Modale */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  Domanda di Iscrizione Socio / Volontario
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Compilabile dal Device
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Dati anagrafici e documenti recuperati in automatico • Modifica i consensi e le clausole prima della stampa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifica Temporanea */}
        {renderNotificaBanner()}

        {/* Corpo Modale Scrollabile */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {renderCorpoCompilazione()}
        </div>

        {/* Footer con Azioni Download e Stampa */}
        <div className="bg-slate-950 p-4 border-t border-slate-800">
          {renderAzioniDomanda(true)}
        </div>
      </div>

      <PdfAnteprimaWorkflowModal
        aperto={anteprimaWorkflowAperta}
        titoloDocumento={`Domanda di Iscrizione - ${volontario.nome} ${volontario.cognome}`}
        sottotitolo={`Tessera N. ${dati.numeroTessera || 'N/D'} • Quota: ${dati.esenteQuota ? 'Esente' : `€ ${Number(dati.quotaVersata || 0).toFixed(2)}`}`}
        nomeFile={`Domanda_Iscrizione_${(volontario.cognome || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_')}_${(volontario.nome || '').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
        giaSalvatoInArchivio={salvatoWorkflow}
        generaPdfBytes={() => generaBytesDaJsPDF(generaPDFDomandaIscrizione(volontario, dati, { volontari }))}
        riepilogoContenuto={
          <div className="space-y-2 text-xs">
            <div>Richiedente: <strong>{volontario.cognome.toUpperCase()} {volontario.nome}</strong></div>
            <div>Codice Fiscale: <strong className="font-mono">{volontario.codiceFiscale || 'N/D'}</strong></div>
            <div>Numero Tessera: <strong className="font-mono">{dati.numeroTessera || 'N/D'}</strong></div>
            <div>Libro Soci: <strong className="font-mono">{dati.numeroIscrizioneLibroSoci || 'N/D'}</strong></div>
            <div>Quota Sociale: <strong>{dati.esenteQuota ? `Esente (${dati.motivoEsenzione || 'Benemerito'})` : `€ ${Number(dati.quotaVersata || 0).toFixed(2)}`}</strong></div>
          </div>
        }
        onSalvaInArchivio={() => {
          sincronizzaVolontario();
          setSalvatoWorkflow(true);
          setMessaggioConferma({
            tipo: 'ok',
            testo: `💾 Domanda di Iscrizione e tessera ${dati.numeroTessera} salvate in archivio per ${volontario.nome} ${volontario.cognome}!`
          });
          if (onNotificaRadio) {
            onNotificaRadio(`📄 Domanda di Iscrizione salvata in archivio per ${volontario.nome} ${volontario.cognome} (Tessera N. ${dati.numeroTessera || 'N/D'})`, 'centrale');
          }
        }}
        onTornaAllaModifica={() => setAnteprimaWorkflowAperta(false)}
        onChiudi={() => setAnteprimaWorkflowAperta(false)}
        onFeedback={(msg) => setMessaggioConferma({ tipo: 'ok', testo: msg })}
      />
    </div>
  );
};
