import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText,
  Download,
  Upload,
  History,
  Database,
  Send,
  Plus,
  Users,
  Calendar,
  Truck,
  Package,
  Award,
  Search,
  ChevronRight,
  RefreshCw,
  Trash2,
  BarChart3,
  ClipboardCheck,
  Vote,
  Library,
} from 'lucide-react';
import { Volontario } from '../DatabaseVolontariModal';
import {
  CorsoFormazione,
  InterventoManutenzione,
  MezzoFlotta,
  TesseraAssociativa,
  TurnoSedeOperativa,
} from '../../types/adminTypes';
import { RifornimentoCarburante } from '../../types/consumiTypes';
import { calcolaManutenzioniInScadenza } from '../../utils/avvisiManutenzioneMezzi';
import {
  calcolaGiorniAllaScadenza,
  useScadenzeFiscaliOdv,
} from '../../utils/scadenzeFiscaliOdv';
import {
  analizzaTurniScopertiProssime48h,
  TurnoScopertoAlert,
} from '../../utils/turniScopertiNotifier';
import {
  AUDIT_LOG_UPDATED_EVENT,
  AreaAuditLog,
  AuditLogEntry,
  esportaAuditLogCsv,
  esportaAuditLogPdf,
  getAuditLogEntries,
} from '../../utils/auditLogStore';
import {
  DeliberaSocioOdv,
  LIBRI_SOCIALI_UPDATED_EVENT,
  PresenzaVerbaleOdv,
  StatoVerbaleOdv,
  TipoDeliberaSocio,
  TipoOrganoSociale,
  VerbaleOrganoSociale,
  esportaRegistroVolontariRuntsCsv,
  generaNumeroProgressivoVerbale,
  generaPdfRegistroVolontariRunts,
  generaPdfVerbaleOrganoSociale,
  getDelibereSociOdv,
  getVerbaliOrganiSociali,
  salvaLibriSocialiOdv,
} from '../../utils/libriSocialiOdv';
import {
  TipoCertificatoServizio,
  calcolaRiepilogoOreVolontari,
  esportaRiepilogoOreCsv,
  generaPdfCertificatoServizio,
} from '../../utils/reportOreVolontari';
import {
  REINTEGRO_MAGAZZINO_EVENT,
  getRichiesteReintegroMagazzino,
} from '../../utils/reintegroMagazzinoStore';
import { formatDateTimeItaly, formatISODateItaly } from '../../utils/italianTime';
import { realtime } from '../../services/realtime';
import {
  esportaVerificaRuntsCsv,
  generaPdfVerificaRunts,
  verificaCompletezzaAnagraficheRunts,
} from '../../utils/verificaRuntsAnagrafiche';
import {
  GUASTI_MEZZI_UPDATED_EVENT,
  getSegnalazioniGuastiMezzi,
} from '../../utils/guastiMezziStore';
import {
  RIFORNIMENTI_UPDATED_EVENT,
  getRifornimentiMezzi,
} from '../../utils/rifornimentiStore';
import { PannelloStatisticheDirettivo } from './PannelloStatisticheDirettivo';

export type TabCentroDirettivo =
  | 'scadenze'
  | 'libri_sociali'
  | 'report_ore'
  | 'statistiche'
  | 'audit_log'
  | 'backup';

export interface BackupPreviewInfo {
  fileName: string;
  exportedAt: string;
  appVersion: string;
  exportedBy: string;
  checksumOk: boolean;
  counts: {
    volontari: number;
    turni: number;
    timbrature: number;
    mezzi: number;
    corsi: number;
    serviziArchivio: number;
    bacheca: number;
    noteDiDebito: number;
    tessere: number;
    verbali: number;
    delibere: number;
  };
  rawPayload: any;
}

interface ModalCentroDirettivoOdvProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabCentroDirettivo;
  operatoreCorrente: string;
  canAccessAdminOrPresident: boolean;
  isDirettivoOAdmin?: boolean;
  volontari: Volontario[];
  mezziFlotta: MezzoFlotta[];
  manutenzioni?: InterventoManutenzione[];
  rifornimenti?: RifornimentoCarburante[];
  turni: TurnoSedeOperativa[];
  timbrature: any[];
  corsi: CorsoFormazione[];
  serviziArchivio: any[];
  tessereAssociative: TesseraAssociativa[];
  onVaiADatabase: (dbKey: 'mezzi' | 'contabilita' | 'formazione' | 'turni' | 'magazzino' | 'volontari') => void;
  onApriAssembleeSondaggi?: () => void;
  onApriArchivioSop?: () => void;
  onInviaAvvisoTurniScoperti: (alerts: TurnoScopertoAlert[], forzaInvio: boolean) => Promise<{ ok: boolean; msg: string }>;
  onEsportaBackupCompleto: () => { fileName: string; totalRecords: number };
  onAnalizzaFileBackup: (jsonText: string, fileName: string) => { ok: boolean; error?: string; preview?: BackupPreviewInfo };
  onRipristinaBackupCompleto: (rawPayload: any) => { ok: boolean; message: string };
  onRegistraAudit?: (area: AreaAuditLog, azione: string, dettaglio: string, criticita?: 'info' | 'importante' | 'critico') => void;
}

interface VoceCruscottoScadenza {
  id: string;
  area: 'Mezzi' | 'Fiscale ODV' | 'Tesseramento' | 'Formazione' | 'Magazzino' | 'Anagrafiche RUNTS';
  titolo: string;
  dettaglio: string;
  dataScadenza: string;
  giorni: number; // <0 scaduta, 0..30 attenzione, >30 regolare
  semaforo: 'rosso' | 'giallo' | 'verde';
  targetDb: 'mezzi' | 'contabilita' | 'formazione' | 'magazzino' | 'volontari';
}

export const ModalCentroDirettivoOdv: React.FC<ModalCentroDirettivoOdvProps> = ({
  isOpen,
  onClose,
  initialTab = 'scadenze',
  operatoreCorrente,
  canAccessAdminOrPresident,
  isDirettivoOAdmin = false,
  volontari,
  mezziFlotta,
  manutenzioni = [],
  rifornimenti: rifornimentiProp,
  turni,
  timbrature,
  corsi,
  serviziArchivio,
  tessereAssociative,
  onVaiADatabase,
  onApriAssembleeSondaggi,
  onApriArchivioSop,
  onInviaAvvisoTurniScoperti,
  onEsportaBackupCompleto,
  onAnalizzaFileBackup,
  onRipristinaBackupCompleto,
  onRegistraAudit,
}) => {
  const [tab, setTab] = useState<TabCentroDirettivo>(initialTab);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);
  const canViewStatisticheDirettivo = Boolean(isDirettivoOAdmin || canAccessAdminOrPresident);

  useEffect(() => {
    if (isOpen) {
      if ((initialTab === 'audit_log' || initialTab === 'backup') && !canAccessAdminOrPresident) {
        setTab('scadenze');
      } else if (initialTab === 'statistiche' && !canViewStatisticheDirettivo) {
        setTab('scadenze');
      } else {
        setTab(initialTab);
      }
    }
  }, [isOpen, initialTab, canAccessAdminOrPresident, canViewStatisticheDirettivo]);

  const mostraFeedback = (tipo: 'ok' | 'err', testo: string) => {
    setFeedback({ tipo, testo });
    setTimeout(() => setFeedback(null), 5000);
  };

  // ==================== TAB 1: CRUSCOTTO UNICO SCADENZE ====================
  const { scadenze: scadenzeFiscali } = useScadenzeFiscaliOdv();
  const [filtroSemaforo, setFiltroSemaforo] = useState<'tutti' | 'rosso' | 'giallo' | 'verde'>('tutti');
  const [richiesteReintegro, setRichiesteReintegro] = useState(() => getRichiesteReintegroMagazzino());
  const [guastiMezziLive, setGuastiMezziLive] = useState(() => getSegnalazioniGuastiMezzi());
  const [rifornimentiLive, setRifornimentiLive] = useState(() => rifornimentiProp || getRifornimentiMezzi());
  const [invioTurniScopertiBusy, setInvioTurniScopertiBusy] = useState(false);

  useEffect(() => {
    if (rifornimentiProp) setRifornimentiLive(rifornimentiProp);
  }, [rifornimentiProp]);

  useEffect(() => {
    const refreshReintegri = () => setRichiesteReintegro(getRichiesteReintegroMagazzino());
    const refreshGuasti = () => setGuastiMezziLive(getSegnalazioniGuastiMezzi());
    const refreshRif = () => setRifornimentiLive(getRifornimentiMezzi());
    window.addEventListener(REINTEGRO_MAGAZZINO_EVENT, refreshReintegri);
    window.addEventListener(GUASTI_MEZZI_UPDATED_EVENT, refreshGuasti);
    window.addEventListener(RIFORNIMENTI_UPDATED_EVENT, refreshRif);
    return () => {
      window.removeEventListener(REINTEGRO_MAGAZZINO_EVENT, refreshReintegri);
      window.removeEventListener(GUASTI_MEZZI_UPDATED_EVENT, refreshGuasti);
      window.removeEventListener(RIFORNIMENTI_UPDATED_EVENT, refreshRif);
    };
  }, []);

  const verificaRunts = useMemo(
    () => verificaCompletezzaAnagraficheRunts(volontari),
    [volontari]
  );

  const turniScoperti48h = useMemo(
    () => analizzaTurniScopertiProssime48h(turni, volontari),
    [turni, volontari]
  );

  const vociCruscotto = useMemo<VoceCruscottoScadenza[]>(() => {
    const items: VoceCruscottoScadenza[] = [];
    const oggiIso = formatISODateItaly();
    const annoCorrente = Number(oggiIso.slice(0, 4)) || new Date().getFullYear();

    // 1. Scadenze Flotta Mezzi (entro 60gg + scadute)
    const alertsMezzi = calcolaManutenzioniInScadenza(mezziFlotta || [], [], 60, new Date(), []);
    for (const a of alertsMezzi) {
      const sem: 'rosso' | 'giallo' | 'verde' =
        a.scaduta || a.giorniRimanenti <= 7 ? 'rosso' : a.giorniRimanenti <= 30 ? 'giallo' : 'verde';
      items.push({
        id: `mezzo-${a.id}`,
        area: 'Mezzi',
        titolo: `${a.mezzoSigla} • ${a.tipo}`,
        dettaglio: `${a.targa ? `Targa ${a.targa} • ` : ''}${a.dettagli || 'Adempimento flotta'}`,
        dataScadenza: a.dataScadenza,
        giorni: a.giorniRimanenti,
        semaforo: sem,
        targetDb: 'mezzi',
      });
    }

    // 2. Scadenze Fiscali ODV (aperte e attive)
    for (const sf of scadenzeFiscali || []) {
      if (!sf.attiva || sf.stato !== 'Aperta') continue;
      const gg = calcolaGiorniAllaScadenza(sf.dataScadenza, oggiIso);
      const sem: 'rosso' | 'giallo' | 'verde' = gg <= 15 ? 'rosso' : gg <= 45 ? 'giallo' : 'verde';
      items.push({
        id: `fiscale-${sf.id}`,
        area: 'Fiscale ODV',
        titolo: sf.titolo,
        dettaglio: `${sf.categoria}${sf.riferimentoNormativo ? ` • ${sf.riferimentoNormativo}` : ''}`,
        dataScadenza: sf.dataScadenza,
        giorni: gg,
        semaforo: sem,
        targetDb: 'contabilita',
      });
    }

    // 3. Tesseramento / Quote sociali non saldate o scadute anno corrente
    const tessereAnno = (tessereAssociative || []).filter((t) => Number(t.annoSociale) === annoCorrente);
    const nonPagate = tessereAnno.filter(
      (t) => t.stato === 'Scaduta' || (t.stato !== 'Annullata' && Number(t.quotaVersata || 0) <= 0)
    );
    const volontariSenzaRinnovo = (volontari || []).filter(
      (v) =>
        v &&
        v.approvato !== false &&
        !v.esenteQuotaAssociativa &&
        !(v.tesseramento?.rinnovata && Number(v.tesseramento?.annoRiferimento || 0) >= annoCorrente)
    );
    const totaleScoperti = Math.max(nonPagate.length, volontariSenzaRinnovo.length);
    if (totaleScoperti > 0) {
      const nomiSample =
        nonPagate.length > 0
          ? nonPagate.slice(0, 4).map((t) => `${t.socioCognome || ''} ${t.socioNome || ''}`.trim())
          : volontariSenzaRinnovo.slice(0, 4).map((v) => `${v.cognome || ''} ${v.nome || ''}`.trim());
      items.push({
        id: `tessere-scoperte-${annoCorrente}`,
        area: 'Tesseramento',
        titolo: `${totaleScoperti} quote associative ${annoCorrente} ancora da rinnovare/saldare`,
        dettaglio:
          nomiSample.join(', ') +
          (totaleScoperti > 4 ? ` e altri ${totaleScoperti - 4}` : ''),
        dataScadenza: `${annoCorrente}-12-31`,
        giorni: 10,
        semaforo: totaleScoperti >= 10 ? 'rosso' : 'giallo',
        targetDb: 'contabilita',
      });
    }

    // 4. Scadenze Attestati / Corsi entro 60gg
    for (const c of corsi || []) {
      for (const isc of c.iscritti || []) {
        const scad = (isc as any).dataScadenzaAttestato || (isc as any).scadenzaBrevetto;
        if (!scad || !/^\d{4}-\d{2}-\d{2}$/.test(scad)) continue;
        const gg = calcolaGiorniAllaScadenza(scad, oggiIso);
        if (gg > 60) continue;
        items.push({
          id: `corso-${c.id}-${isc.volontarioId || isc.volontarioNome}`,
          area: 'Formazione',
          titolo: `${c.titolo} — ${isc.volontarioNome}`,
          dettaglio: 'Rinnovo attestato / brevetto formativo',
          dataScadenza: scad,
          giorni: gg,
          semaforo: gg <= 15 ? 'rosso' : gg <= 35 ? 'giallo' : 'verde',
          targetDb: 'formazione',
        });
      }
    }

    // 5. Richieste Reintegro da Checklist Mezzi aperte
    for (const req of richiesteReintegro.filter((r) => r.stato !== 'Reintegrato')) {
      items.push({
        id: `reint-${req.id}`,
        area: 'Magazzino',
        titolo: `Reintegro ${req.mezzoSigla} (${req.vociSegnalate.length} voci KO)`,
        dettaglio: req.vociSegnalate.map((v) => v.titolo).join(', ').slice(0, 120),
        dataScadenza: req.dataOraSegnalazione,
        giorni: req.priorita === 'Urgente' ? 0 : 10,
        semaforo: req.priorita === 'Urgente' ? 'rosso' : 'giallo',
        targetDb: 'magazzino',
      });
    }

    // 6. Segnalazioni Guasti / Danni / Sinistri Mezzi aperte
    for (const g of guastiMezziLive.filter((x) => x.stato !== 'Risolta')) {
      items.push({
        id: `guasto-${g.id}`,
        area: 'Mezzi',
        titolo: `${g.mezzoSigla} • ${g.tipo} (${g.stato})`,
        dettaglio: `${g.gravita} — ${(g.descrizione || '').slice(0, 110)}`,
        dataScadenza: g.dataOra,
        giorni: g.gravita === 'Critico / Fuori Servizio' ? -1 : 5,
        semaforo: g.gravita === 'Critico / Fuori Servizio' ? 'rosso' : 'giallo',
        targetDb: 'mezzi',
      });
    }

    // 7. Anagrafiche RUNTS con campi critici mancanti
    if (verificaRunts.conCritici > 0) {
      items.push({
        id: 'runts-anagrafiche-critiche',
        area: 'Anagrafiche RUNTS',
        titolo: `${verificaRunts.conCritici} schede volontari con dati obbligatori RUNTS mancanti (media ${verificaRunts.percentualeMediaCompletezza}%)`,
        dettaglio: 'Verifica nella tab Libri RUNTS → Verifica Completezza Anagrafiche per esportare l’elenco PDF/CSV.',
        dataScadenza: oggiIso,
        giorni: 3,
        semaforo: verificaRunts.conCritici >= 5 ? 'rosso' : 'giallo',
        targetDb: 'volontari',
      });
    }

    return items.sort((a, b) => a.giorni - b.giorni);
  }, [mezziFlotta, scadenzeFiscali, tessereAssociative, volontari, corsi, richiesteReintegro, guastiMezziLive, verificaRunts]);

  const countRossi = vociCruscotto.filter((v) => v.semaforo === 'rosso').length;
  const countGialli = vociCruscotto.filter((v) => v.semaforo === 'giallo').length;
  const countVerdi = vociCruscotto.filter((v) => v.semaforo === 'verde').length;
  const vociCruscottoFiltrate =
    filtroSemaforo === 'tutti'
      ? vociCruscotto
      : vociCruscotto.filter((v) => v.semaforo === filtroSemaforo);

  // ==================== TAB 2: LIBRI SOCIALI & RUNTS ====================
  const [subLibri, setSubLibri] = useState<'verbali' | 'delibere' | 'runts' | 'verifica_runts'>('verbali');
  const [filtroRunts, setFiltroRunts] = useState<'tutti' | 'critici' | 'avvisi' | 'conformi'>('critici');
  const [ricercaRunts, setRicercaRunts] = useState('');
  const [verbali, setVerbali] = useState<VerbaleOrganoSociale[]>(() => getVerbaliOrganiSociali());
  const [delibere, setDelibere] = useState<DeliberaSocioOdv[]>(() => getDelibereSociOdv());
  const [mostraFormVerbale, setMostraFormVerbale] = useState(false);
  const [mostraFormDelibera, setMostraFormDelibera] = useState(false);

  // Form Verbale
  const [vOrgano, setVOrgano] = useState<TipoOrganoSociale>('Consiglio Direttivo');
  const [vTitolo, setVTitolo] = useState('');
  const [vData, setVData] = useState(() => formatISODateItaly());
  const [vOraInizio, setVOraInizio] = useState('21:00');
  const [vOraFine, setVOraFine] = useState('22:30');
  const [vLuogo, setVLuogo] = useState('Sede Centrale - Via delle Jare, Massa');
  const [vPresidente, setVPresidente] = useState('');
  const [vSegretario, setVSegretario] = useState(operatoreCorrente);
  const [vOdg, setVOdg] = useState('');
  const [vDelib, setVDelib] = useState('');
  const [vStato, setVStato] = useState<StatoVerbaleOdv>('Approvato');
  const [vPresentiIds, setVPresentiIds] = useState<string[]>([]);

  // Form Delibera Socio
  const [dTipo, setDTipo] = useState<TipoDeliberaSocio>('Ammissione');
  const [dVolId, setDVolId] = useState('');
  const [dNomeLibero, setDNomeLibero] = useState('');
  const [dData, setDData] = useState(() => formatISODateItaly());
  const [dNumVerbale, setDNumVerbale] = useState('');
  const [dOrgano, setDOrgano] = useState<TipoOrganoSociale>('Consiglio Direttivo');
  const [dNote, setDNote] = useState('');

  useEffect(() => {
    const refresh = () => {
      setVerbali(getVerbaliOrganiSociali());
      setDelibere(getDelibereSociOdv());
    };
    window.addEventListener(LIBRI_SOCIALI_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(LIBRI_SOCIALI_UPDATED_EVENT, refresh);
  }, []);

  const volontariAttivi = useMemo(
    () =>
      (volontari || [])
        .filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi)
        .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')),
    [volontari]
  );

  const handleSalvaVerbale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vTitolo.trim()) {
      mostraFeedback('err', 'Inserisci un titolo per il verbale.');
      return;
    }
    const nowIso = new Date().toISOString();
    const numeroProgressivo = generaNumeroProgressivoVerbale(verbali, vOrgano, vData);
    const presenze: PresenzaVerbaleOdv[] = volontariAttivi
      .filter((v) => vPresentiIds.includes(v.id))
      .map((v) => ({
        volontarioId: v.id,
        nomeCompleto: `${v.cognome || ''} ${v.nome || ''}`.trim(),
        ruolo: v.caricaConsiglioDirettivo || v.qualifica || 'Socio',
        presente: true,
      }));

    const nuovo: VerbaleOrganoSociale = {
      id: `verb-${Date.now()}`,
      numeroProgressivo,
      organo: vOrgano,
      titolo: vTitolo.trim(),
      dataSeduta: vData,
      oraInizio: vOraInizio,
      oraFine: vOraFine,
      luogo: vLuogo.trim() || 'Sede Centrale',
      presidenteSeduta: vPresidente.trim() || 'Il Presidente',
      segretarioVerbalizzante: vSegretario.trim() || operatoreCorrente,
      ordineDelGiorno: vOdg.trim() || 'Varie ed eventuali',
      testoDeliberazioni: vDelib.trim() || 'Approvato all’unanimità dei presenti.',
      presenze,
      stato: vStato,
      creatoDa: operatoreCorrente,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextVerbali = [nuovo, ...verbali];
    const saved = salvaLibriSocialiOdv(nextVerbali, delibere);
    setVerbali(saved.verbali);
    realtime.syncLibriSociali(saved.verbali, saved.delibere, saved.updatedAt);
    onRegistraAudit?.(
      'libri_sociali',
      `Nuovo Verbale ${numeroProgressivo}`,
      `${vOrgano}: "${nuovo.titolo}" (${presenze.length} presenti)`,
      'importante'
    );
    setMostraFormVerbale(false);
    setVTitolo('');
    setVOdg('');
    setVDelib('');
    setVPresentiIds([]);
    mostraFeedback('ok', `Verbale ${numeroProgressivo} registrato e sincronizzato su cloud.`);
  };

  const handleEliminaVerbale = (id: string) => {
    const target = verbali.find((v) => v.id === id);
    const next = verbali.filter((v) => v.id !== id);
    const saved = salvaLibriSocialiOdv(next, delibere);
    setVerbali(saved.verbali);
    realtime.syncLibriSociali(saved.verbali, saved.delibere, saved.updatedAt);
    if (target) {
      onRegistraAudit?.('libri_sociali', `Eliminato Verbale ${target.numeroProgressivo}`, target.titolo, 'importante');
    }
  };

  const handleSalvaDelibera = (e: React.FormEvent) => {
    e.preventDefault();
    const vol = volontari.find((v) => v.id === dVolId);
    const nome = vol ? `${vol.cognome || ''} ${vol.nome || ''}`.trim() : dNomeLibero.trim();
    if (!nome) {
      mostraFeedback('err', 'Seleziona un volontario o indica il nominativo del socio.');
      return;
    }
    const nuova: DeliberaSocioOdv = {
      id: `del-${Date.now()}`,
      tipo: dTipo,
      volontarioId: vol?.id,
      nomeCompleto: nome,
      codiceFiscale: vol?.codiceFiscale,
      matricola: vol?.matricola,
      dataDelibera: dData,
      numeroVerbale: dNumVerbale.trim() || verbali[0]?.numeroProgressivo || `CD-${dData.slice(0, 4)}/001`,
      organoDeliberante: dOrgano,
      motivazioneNote: dNote.trim() || `Delibera di ${dTipo.toLowerCase()} socio approvata.`,
      operatore: operatoreCorrente,
      createdAt: new Date().toISOString(),
    };
    const nextDel = [nuova, ...delibere];
    const saved = salvaLibriSocialiOdv(verbali, nextDel);
    setDelibere(saved.delibere);
    realtime.syncLibriSociali(saved.verbali, saved.delibere, saved.updatedAt);
    onRegistraAudit?.(
      'libri_sociali',
      `Delibera ${dTipo} Socio`,
      `${nome} (Verbale ${nuova.numeroVerbale})`,
      'importante'
    );
    setMostraFormDelibera(false);
    setDVolId('');
    setDNomeLibero('');
    setDNote('');
    mostraFeedback('ok', `Delibera di ${dTipo} per ${nome} salvata nel Libro Soci.`);
  };

  // ==================== TAB 3: REPORT ORE & CERTIFICATI ====================
  const annoOggi = formatISODateItaly().slice(0, 4);
  const [oreDataDa, setOreDataDa] = useState(`${annoOggi}-01-01`);
  const [oreDataA, setOreDataA] = useState(() => formatISODateItaly());
  const [oreRicerca, setOreRicerca] = useState('');
  const [noteCertificato, setNoteCertificato] = useState('');

  const riepilogoOre = useMemo(() => {
    const tutti = calcolaRiepilogoOreVolontari({
      volontari,
      timbrature,
      turni,
      corsi,
      serviziArchivio,
      dataDa: oreDataDa,
      dataA: oreDataA,
    });
    const q = oreRicerca.trim().toLowerCase();
    if (!q) return tutti;
    return tutti.filter(
      (r) =>
        r.nomeCompleto.toLowerCase().includes(q) ||
        r.matricola.toLowerCase().includes(q) ||
        r.sezione.toLowerCase().includes(q)
    );
  }, [volontari, timbrature, turni, corsi, serviziArchivio, oreDataDa, oreDataA, oreRicerca]);

  const totaleOrePeriodo = useMemo(
    () => Math.round(riepilogoOre.reduce((acc, r) => acc + r.totaleOreComplessive, 0) * 10) / 10,
    [riepilogoOre]
  );

  // ==================== TAB 4: REGISTRO ATTIVITA (AUDIT LOG) ====================
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>(() => getAuditLogEntries());
  const [auditArea, setAuditArea] = useState<string>('tutte');
  const [auditRicerca, setAuditRicerca] = useState('');

  useEffect(() => {
    const refresh = () => setAuditEntries(getAuditLogEntries());
    window.addEventListener(AUDIT_LOG_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(AUDIT_LOG_UPDATED_EVENT, refresh);
  }, []);

  const auditFiltrati = useMemo(() => {
    const q = auditRicerca.trim().toLowerCase();
    return auditEntries.filter((e) => {
      if (auditArea !== 'tutte' && e.area !== auditArea) return false;
      if (
        q &&
        !e.azione.toLowerCase().includes(q) &&
        !e.dettaglio.toLowerCase().includes(q) &&
        !e.operatore.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [auditEntries, auditArea, auditRicerca]);

  // ==================== TAB 5: BACKUP & RIPRISTINO ====================
  const fileBackupInputRef = useRef<HTMLInputElement | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreviewInfo | null>(null);
  const [confermaRestoreFlag, setConfermaRestoreFlag] = useState(false);

  const handleFileBackupChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = onAnalizzaFileBackup(text, file.name);
      if (!res.ok || !res.preview) {
        setBackupPreview(null);
        mostraFeedback('err', res.error || 'File di backup non valido.');
      } else {
        setBackupPreview(res.preview);
        setConfermaRestoreFlag(false);
        mostraFeedback('ok', `Backup "${file.name}" verificato. Controlla i conteggi e conferma per ripristinare.`);
      }
    } catch {
      mostraFeedback('err', 'Impossibile leggere il file selezionato.');
    } finally {
      if (fileBackupInputRef.current) fileBackupInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] overflow-hidden">
        {/* Header compatto e responsive */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#1d1a60] via-slate-900 to-slate-900 border-b border-amber-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-black text-white uppercase tracking-tight truncate">
                Centro Direttivo ODV & RUNTS
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Cruscotto Scadenze, Libri Sociali, Certificati Ore, Registro Attività & Backup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-red-600/80 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Chiudi Centro Direttivo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo interamente scorrevole su Android/mobile (niente meta fissa ingombrante) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* Barra Navigazione stile Database (grid multi-colonna, tutto visibile senza tagli) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 pb-2 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setTab('scadenze')}
              className={`px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer ${
                tab === 'scadenze'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">1. Scadenze ({countRossi + countGialli})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('libri_sociali')}
              className={`px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer ${
                tab === 'libri_sociali'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">2. Libri &amp; RUNTS</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('report_ore')}
              className={`px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer ${
                tab === 'report_ore'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">3. Ore &amp; Certificati</span>
            </button>

            {canViewStatisticheDirettivo && (
              <button
                type="button"
                onClick={() => setTab('statistiche')}
                className={`px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer ${
                  tab === 'statistiche'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                    : 'bg-slate-900 text-amber-300 hover:text-white border border-amber-500/40'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">4. Statistiche</span>
              </button>
            )}

            {canAccessAdminOrPresident && (
              <button
                type="button"
                onClick={() => setTab('audit_log')}
                className={`px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer ${
                  tab === 'audit_log'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">5. Audit ({auditEntries.length})</span>
              </button>
            )}

            {canAccessAdminOrPresident && (
              <button
                type="button"
                onClick={() => setTab('backup')}
                className={`px-2.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 transition-all cursor-pointer ${
                  tab === 'backup'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">6. Backup</span>
              </button>
            )}
          </div>

          {feedback && (
            <div
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                feedback.tipo === 'ok'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-red-950/80 border-red-500/60 text-red-200'
              }`}
            >
              {feedback.tipo === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.testo}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: CRUSCOTTO UNICO DELLE SCADENZE + TURNI SCOPERTI 48H        */}
          {/* ================================================================= */}
          {tab === 'scadenze' && (
            <div className="space-y-4">
              {/* Semaforo Riepilogativo */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setFiltroSemaforo((f) => (f === 'rosso' ? 'tutti' : 'rosso'))}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    filtroSemaforo === 'rosso'
                      ? 'bg-red-950/90 border-red-400 ring-2 ring-red-500/40'
                      : 'bg-red-950/40 border-red-500/40 hover:bg-red-950/60'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase text-red-300">Rosso • Urgenti / Scadute</div>
                  <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">{countRossi}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroSemaforo((f) => (f === 'giallo' ? 'tutti' : 'giallo'))}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    filtroSemaforo === 'giallo'
                      ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-500/40'
                      : 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-950/60'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase text-amber-300">Giallo • In Scadenza</div>
                  <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">{countGialli}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroSemaforo((f) => (f === 'verde' ? 'tutti' : 'verde'))}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    filtroSemaforo === 'verde'
                      ? 'bg-emerald-950/90 border-emerald-400 ring-2 ring-emerald-500/40'
                      : 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-950/60'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase text-emerald-300">Verde • Programmate</div>
                  <div className="text-2xl sm:text-3xl font-black text-white mt-0.5">{countVerdi}</div>
                </button>
              </div>

              {/* Accessi Rapidi Direttivo: Assemblee/Sondaggi, Documenti SOP, Verifica RUNTS */}
              {(onApriAssembleeSondaggi || onApriArchivioSop) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {onApriAssembleeSondaggi && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onApriAssembleeSondaggi();
                      }}
                      className="p-3 rounded-2xl bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-500/40 flex items-center gap-2.5 text-left transition-all cursor-pointer"
                    >
                      <Vote className="w-5 h-5 text-indigo-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white uppercase truncate">Assemblee &amp; Sondaggi</div>
                        <div className="text-[10.5px] text-indigo-200/80 truncate">Convocazioni, Deleghe &amp; Voti</div>
                      </div>
                    </button>
                  )}
                  {onApriArchivioSop && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onApriArchivioSop();
                      }}
                      className="p-3 rounded-2xl bg-teal-950/50 hover:bg-teal-900/60 border border-teal-500/40 flex items-center gap-2.5 text-left transition-all cursor-pointer"
                    >
                      <Library className="w-5 h-5 text-teal-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white uppercase truncate">Archivio Documenti &amp; SOP</div>
                        <div className="text-[10.5px] text-teal-200/80 truncate">Statuto, Procedure &amp; Polizze</div>
                      </div>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('libri_sociali');
                      setSubLibri('verifica_runts');
                    }}
                    className="p-3 rounded-2xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 flex items-center gap-2.5 text-left transition-all cursor-pointer"
                  >
                    <ClipboardCheck className="w-5 h-5 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white uppercase truncate">
                        Verifica RUNTS ({verificaRunts.percentualeMediaCompletezza}%)
                      </div>
                      <div className="text-[10.5px] text-amber-200/80 truncate">
                        {verificaRunts.conCritici} schede con campi critici
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Box Avviso Automatico Turni Scoperti 24-48h */}
              <div className="bg-slate-900 border border-orange-500/40 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span>Turni Scoperti nelle Prossime 48 Ore ({turniScoperti48h.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Il sistema avvisa in automatico i volontari idonei (per mansione e sezione) a 48h e 24h dall&apos;inizio turno.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onVaiADatabase('turni');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase cursor-pointer"
                    >
                      Apri Turni
                    </button>
                    {turniScoperti48h.length > 0 && (
                      <button
                        type="button"
                        disabled={invioTurniScopertiBusy}
                        onClick={async () => {
                          setInvioTurniScopertiBusy(true);
                          try {
                            const res = await onInviaAvvisoTurniScoperti(turniScoperti48h, true);
                            mostraFeedback(res.ok ? 'ok' : 'err', res.msg);
                          } finally {
                            setInvioTurniScopertiBusy(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{invioTurniScopertiBusy ? 'Invio...' : 'Invia Sollecito Ora'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {turniScoperti48h.length === 0 ? (
                  <div className="text-xs text-emerald-300 font-bold bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3">
                    ✓ Tutti i turni delle prossime 48 ore risultano regolarmente coperti!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {turniScoperti48h.map((ts) => (
                      <div
                        key={ts.dedupKey}
                        className={`p-3 rounded-xl border ${
                          ts.finestra === '24h'
                            ? 'bg-red-950/30 border-red-500/40'
                            : 'bg-amber-950/20 border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-white">
                            {ts.dataFormatted} • {ts.fasciaOraria}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              ts.finestra === '24h'
                                ? 'bg-red-600 text-white'
                                : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            Tra ~{ts.oreMancanti}h
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{ts.sedeNome}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {ts.ruoliScoperti.map((r) => (
                            <span
                              key={r.ruoloKey}
                              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-orange-300 font-bold"
                            >
                              Manca {r.ruoloLabel} ({r.volontariIdonei.length} idonei)
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista Unificata Scadenze */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-white uppercase">
                    Elenco Unificato Scadenze ({vociCruscottoFiltrate.length})
                  </h3>
                  {filtroSemaforo !== 'tutti' && (
                    <button
                      type="button"
                      onClick={() => setFiltroSemaforo('tutti')}
                      className="text-[11px] text-amber-400 hover:underline font-bold cursor-pointer"
                    >
                      Mostra tutte
                    </button>
                  )}
                </div>

                {vociCruscottoFiltrate.length === 0 ? (
                  <div className="p-6 text-center text-xs text-emerald-300 font-bold">
                    ✓ Nessuna scadenza critica o in sospeso per il filtro selezionato.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70 max-h-[42vh] overflow-y-auto">
                    {vociCruscottoFiltrate.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/40"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                              v.semaforo === 'rosso'
                                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                                : v.semaforo === 'giallo'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-black uppercase">
                                {v.area}
                              </span>
                              <span className="text-xs font-bold text-white">{v.titolo}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">{v.dettaglio}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 justify-end">
                          <span className="text-[11px] font-mono font-bold text-slate-300">
                            {v.dataScadenza}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onVaiADatabase(v.targetDb);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                          >
                            <span>Apri</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: LIBRI SOCIALI & VERBALI (RUNTS)                            */}
          {/* ================================================================= */}
          {tab === 'libri_sociali' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSubLibri('verbali')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer ${
                      subLibri === 'verbali'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Verbali Assemblee & CD ({verbali.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubLibri('delibere')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer ${
                      subLibri === 'delibere'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Delibere Soci ({delibere.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubLibri('runts')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer ${
                      subLibri === 'runts'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Registro Volontari RUNTS ({volontariAttivi.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubLibri('verifica_runts')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer flex items-center gap-1.5 ${
                      subLibri === 'verifica_runts'
                        ? 'bg-amber-500 text-slate-950'
                        : verificaRunts.conCritici > 0
                        ? 'bg-amber-950/50 text-amber-200 border border-amber-500/50'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Verifica Completezza RUNTS ({verificaRunts.percentualeMediaCompletezza}%)</span>
                  </button>
                </div>

                {subLibri === 'verbali' && (
                  <button
                    type="button"
                    onClick={() => setMostraFormVerbale((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{mostraFormVerbale ? 'Chiudi Modulo' : 'Nuovo Verbale'}</span>
                  </button>
                )}
                {subLibri === 'delibere' && (
                  <button
                    type="button"
                    onClick={() => setMostraFormDelibera((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{mostraFormDelibera ? 'Chiudi Modulo' : 'Nuova Delibera Socio'}</span>
                  </button>
                )}
              </div>

              {subLibri === 'verbali' && (
                <div className="space-y-3">
                  {mostraFormVerbale && (
                    <form
                      onSubmit={handleSalvaVerbale}
                      className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 space-y-3"
                    >
                      <h4 className="text-xs font-black text-indigo-300 uppercase">
                        Nuovo Verbale Organo Sociale (Numerazione automatica RUNTS)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Organo Sociale
                          </label>
                          <select
                            value={vOrgano}
                            onChange={(e) => setVOrgano(e.target.value as TipoOrganoSociale)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          >
                            <option value="Consiglio Direttivo">Consiglio Direttivo</option>
                            <option value="Assemblea Ordinaria dei Soci">Assemblea Ordinaria dei Soci</option>
                            <option value="Assemblea Straordinaria dei Soci">Assemblea Straordinaria dei Soci</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Titolo / Oggetto Seduta *
                          </label>
                          <input
                            type="text"
                            required
                            value={vTitolo}
                            onChange={(e) => setVTitolo(e.target.value)}
                            placeholder="Es. Approvazione Bilancio Consuntivo 2025 e Rinnovo Cariche"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Seduta</label>
                          <input
                            type="date"
                            value={vData}
                            onChange={(e) => setVData(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Inizio</label>
                            <input
                              type="time"
                              value={vOraInizio}
                              onChange={(e) => setVOraInizio(e.target.value)}
                              className="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fine</label>
                            <input
                              type="time"
                              value={vOraFine}
                              onChange={(e) => setVOraFine(e.target.value)}
                              className="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stato</label>
                          <select
                            value={vStato}
                            onChange={(e) => setVStato(e.target.value as StatoVerbaleOdv)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          >
                            <option value="Bozza">Bozza</option>
                            <option value="Approvato">Approvato</option>
                            <option value="Firmato">Firmato</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Luogo</label>
                          <input
                            type="text"
                            value={vLuogo}
                            onChange={(e) => setVLuogo(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Presidente Seduta</label>
                          <input
                            type="text"
                            value={vPresidente}
                            onChange={(e) => setVPresidente(e.target.value)}
                            placeholder="Nome e Cognome"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Segretario Verbalizzante</label>
                          <input
                            type="text"
                            value={vSegretario}
                            onChange={(e) => setVSegretario(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Ordine del Giorno (OdG)
                          </label>
                          <textarea
                            rows={3}
                            value={vOdg}
                            onChange={(e) => setVOdg(e.target.value)}
                            placeholder="1. Lettura verbale precedente&#10;2. Approvazione bilancio..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Discussione e Deliberazioni Approvate
                          </label>
                          <textarea
                            rows={3}
                            value={vDelib}
                            onChange={(e) => setVDelib(e.target.value)}
                            placeholder="Testo completo delle delibere approvate..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                          Foglio Presenze ({vPresentiIds.length} selezionati)
                        </label>
                        <div className="max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
                          {volontariAttivi.map((v) => {
                            const checked = vPresentiIds.includes(v.id);
                            return (
                              <label
                                key={v.id}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] cursor-pointer ${
                                  checked
                                    ? 'bg-indigo-600/30 text-white border border-indigo-500/40'
                                    : 'text-slate-300 hover:bg-slate-900'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setVPresentiIds((prev) =>
                                      prev.includes(v.id)
                                        ? prev.filter((x) => x !== v.id)
                                        : [...prev, v.id]
                                    )
                                  }
                                />
                                <span className="truncate">{v.cognome} {v.nome}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMostraFormVerbale(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase cursor-pointer"
                        >
                          Salva Verbale
                        </button>
                      </div>
                    </form>
                  )}

                  {verbali.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                      Nessun verbale ancora registrato. Clicca su &quot;Nuovo Verbale&quot; per archiviare Assemblee e Consigli Direttivi.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {verbali.map((vb) => (
                        <div
                          key={vb.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono text-[11px] font-black">
                                {vb.numeroProgressivo}
                              </span>
                              <span className="text-xs font-black text-white">{vb.titolo}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                                {vb.organo}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                                {vb.stato}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Data: <strong className="text-slate-200">{vb.dataSeduta}</strong> ({vb.oraInizio}-{vb.oraFine}) • Luogo: {vb.luogo} • Presenti: <strong className="text-white">{vb.presenze.length}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => generaPdfVerbaleOrganoSociale(vb)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Stampa PDF</span>
                            </button>
                            {canAccessAdminOrPresident && (
                              <button
                                type="button"
                                onClick={() => handleEliminaVerbale(vb.id)}
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-600/80 text-slate-400 hover:text-white cursor-pointer"
                                title="Elimina verbale"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {subLibri === 'delibere' && (
                <div className="space-y-3">
                  {mostraFormDelibera && (
                    <form
                      onSubmit={handleSalvaDelibera}
                      className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 space-y-3"
                    >
                      <h4 className="text-xs font-black text-indigo-300 uppercase">
                        Registra Delibera Ammissione / Dimissione Socio
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo Delibera</label>
                          <select
                            value={dTipo}
                            onChange={(e) => setDTipo(e.target.value as TipoDeliberaSocio)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          >
                            <option value="Ammissione">Ammissione Socio</option>
                            <option value="Dimissione">Dimissione Volontaria</option>
                            <option value="Decadenza">Decadenza</option>
                            <option value="Esclusione">Esclusione</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Volontario in Anagrafica</label>
                          <select
                            value={dVolId}
                            onChange={(e) => setDVolId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          >
                            <option value="">-- Oppure digita nominativo --</option>
                            {volontari.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.cognome} {v.nome} ({v.matricola || 'N.D.'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nominativo (se non in lista)</label>
                          <input
                            type="text"
                            value={dNomeLibero}
                            onChange={(e) => setDNomeLibero(e.target.value)}
                            placeholder="Cognome e Nome"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Delibera</label>
                          <input
                            type="date"
                            value={dData}
                            onChange={(e) => setDData(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rif. Numero Verbale</label>
                          <input
                            type="text"
                            value={dNumVerbale}
                            onChange={(e) => setDNumVerbale(e.target.value)}
                            placeholder={verbali[0]?.numeroProgressivo || 'CD-2026/001'}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Organo Deliberante</label>
                          <select
                            value={dOrgano}
                            onChange={(e) => setDOrgano(e.target.value as TipoOrganoSociale)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                          >
                            <option value="Consiglio Direttivo">Consiglio Direttivo</option>
                            <option value="Assemblea Ordinaria dei Soci">Assemblea Ordinaria dei Soci</option>
                            <option value="Assemblea Straordinaria dei Soci">Assemblea Straordinaria dei Soci</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Motivazione / Note</label>
                        <input
                          type="text"
                          value={dNote}
                          onChange={(e) => setDNote(e.target.value)}
                          placeholder="Es. Accolta domanda di adesione con decorrenza immediata"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMostraFormDelibera(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase cursor-pointer"
                        >
                          Registra Delibera
                        </button>
                      </div>
                    </form>
                  )}

                  {delibere.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
                      Nessuna delibera soci registrata. Usa &quot;Nuova Delibera Socio&quot; per tracciare ammissioni e dimissioni.
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-950/70 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-3">Socio / Volontario</th>
                            <th className="py-2.5 px-3">Verbale</th>
                            <th className="py-2.5 px-3">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {delibere.map((d) => (
                            <tr key={d.id}>
                              <td className="py-2.5 px-3 font-mono text-slate-300">{d.dataDelibera}</td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    d.tipo === 'Ammissione'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-red-500/20 text-red-300'
                                  }`}
                                >
                                  {d.tipo}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-white">{d.nomeCompleto}</td>
                              <td className="py-2.5 px-3 font-mono text-indigo-300">{d.numeroVerbale}</td>
                              <td className="py-2.5 px-3 text-slate-300">{d.motivazioneNote}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {subLibri === 'runts' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase">
                        Registro Volontari RUNTS (Art. 17 D.Lgs. 117/2017)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Genera in 1 clic il registro ufficiale vidimabile in PDF o CSV con tutti i volontari attivi ({volontariAttivi.length}).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          generaPdfRegistroVolontariRunts(volontari);
                          onRegistraAudit?.('libri_sociali', 'Esportazione PDF Registro RUNTS', `${volontariAttivi.length} volontari inclusi`, 'info');
                          mostraFeedback('ok', 'PDF Registro Volontari RUNTS generato con successo.');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Scarica PDF RUNTS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          esportaRegistroVolontariRuntsCsv(volontari);
                          mostraFeedback('ok', 'CSV Registro Volontari RUNTS scaricato.');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Esporta CSV</span>
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-72 border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                          <th className="py-2 px-3">Matricola</th>
                          <th className="py-2 px-3">Cognome e Nome</th>
                          <th className="py-2 px-3">Codice Fiscale</th>
                          <th className="py-2 px-3">Sezione</th>
                          <th className="py-2 px-3">Stato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {volontariAttivi.slice(0, 60).map((v) => (
                          <tr key={v.id}>
                            <td className="py-2 px-3 font-mono text-amber-300">{v.matricola || '-'}</td>
                            <td className="py-2 px-3 font-bold text-white">{v.cognome} {v.nome}</td>
                            <td className="py-2 px-3 font-mono text-slate-300">{v.codiceFiscale || '-'}</td>
                            <td className="py-2 px-3 text-slate-300">{v.sezioneAppartenenzaNome || 'Sede Centrale'}</td>
                            <td className="py-2 px-3 text-emerald-300 font-bold">
                              {v.bloccatoPerTentativi ? 'Bloccato' : v.approvato === false ? 'In attesa' : 'Attivo'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {subLibri === 'verifica_runts' && (() => {
                const q = ricercaRunts.trim().toLowerCase();
                const dettagliFiltrati = verificaRunts.dettagli.filter((d) => {
                  if (filtroRunts === 'critici' && d.criticiCount === 0) return false;
                  if (filtroRunts === 'avvisi' && !(d.criticiCount === 0 && d.avvisiCount > 0)) return false;
                  if (filtroRunts === 'conformi' && !d.conformeRunts) return false;
                  if (q && !d.nomeCompleto.toLowerCase().includes(q) && !d.sezione.toLowerCase().includes(q)) {
                    return false;
                  }
                  return true;
                });
                const campiMancantiList = Object.entries(verificaRunts.conteggioPerCampo).sort(
                  (a, b) => b[1].count - a[1].count
                );
                return (
                  <div className="space-y-4">
                    {/* KPI Completezza */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-2xl bg-slate-900 border border-indigo-500/40">
                        <div className="text-[10px] font-black uppercase text-indigo-300">Completezza Media</div>
                        <div className="text-2xl font-black text-white font-mono mt-0.5">
                          {verificaRunts.percentualeMediaCompletezza}%
                        </div>
                        <div className="text-[10px] text-slate-400">{verificaRunts.totaleAnalizzati} volontari attivi</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/40">
                        <div className="text-[10px] font-black uppercase text-emerald-300">Conformi RUNTS</div>
                        <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                          {verificaRunts.conformiTotali}
                        </div>
                        <div className="text-[10px] text-slate-400">Zero campi critici mancanti</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-900 border border-rose-500/40">
                        <div className="text-[10px] font-black uppercase text-rose-300">Con Campi Critici</div>
                        <div className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                          {verificaRunts.conCritici}
                        </div>
                        <div className="text-[10px] text-slate-400">Da integrare per RUNTS/Assic.</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-900 border border-amber-500/40">
                        <div className="text-[10px] font-black uppercase text-amber-300">Solo Avvisi Minori</div>
                        <div className="text-2xl font-black text-amber-300 font-mono mt-0.5">
                          {verificaRunts.soloAvvisi}
                        </div>
                        <div className="text-[10px] text-slate-400">Documenti/firma consigliati</div>
                      </div>
                    </div>

                    {/* Riepilogo Campi Più Carenti */}
                    {campiMancantiList.length > 0 && (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                        <div className="text-[10.5px] font-black uppercase text-slate-300">
                          Riepilogo Anomalie Rilevate per Campo
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {campiMancantiList.map(([key, info]) => (
                            <span
                              key={key}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                                info.gravita === 'critico'
                                  ? 'bg-rose-950/60 text-rose-200 border-rose-500/40'
                                  : 'bg-amber-950/50 text-amber-200 border-amber-500/40'
                              }`}
                            >
                              {info.etichetta}: <strong>{info.count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filtri & Azioni Export */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            ['critici', `Critici (${verificaRunts.conCritici})`],
                            ['avvisi', `Solo Avvisi (${verificaRunts.soloAvvisi})`],
                            ['conformi', `Conformi (${verificaRunts.conformiTotali})`],
                            ['tutti', `Tutti (${verificaRunts.totaleAnalizzati})`],
                          ] as const
                        ).map(([k, lbl]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setFiltroRunts(k)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase cursor-pointer ${
                              filtroRunts === k
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                        <input
                          type="text"
                          value={ricercaRunts}
                          onChange={(e) => setRicercaRunts(e.target.value)}
                          placeholder="Cerca volontario..."
                          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white w-44"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            generaPdfVerificaRunts(verificaRunts);
                            mostraFeedback('ok', 'Report PDF Verifica Completezza RUNTS generato.');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Report PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            esportaVerificaRuntsCsv(verificaRunts);
                            mostraFeedback('ok', 'Elenco verifica anagrafiche RUNTS esportato in CSV.');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-black uppercase inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onVaiADatabase('volontari');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Apri DB Volontari</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tabella Esiti per Volontario */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto max-h-[45vh]">
                      {dettagliFiltrati.length === 0 ? (
                        <div className="p-6 text-center text-xs text-emerald-300 font-bold">
                          ✓ Nessun volontario in questa categoria!
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                              <th className="py-2.5 px-3">Volontario</th>
                              <th className="py-2.5 px-3">Completezza</th>
                              <th className="py-2.5 px-3">Campi Mancanti / Da Integrare</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {dettagliFiltrati.map((d) => (
                              <tr key={d.volontario.id} className="hover:bg-slate-800/30">
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-bold text-white">{d.nomeCompleto}</div>
                                  <div className="text-[10px] text-slate-400">{d.sezione}</div>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded font-mono text-[11px] font-black ${
                                      d.conformeRunts
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : d.punteggioPercentuale >= 70
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    {d.punteggioPercentuale}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {d.anomalie.length === 0 ? (
                                    <span className="text-emerald-300 font-bold text-[11px]">
                                      ✓ Anagrafica 100% conforme RUNTS e copertura assicurativa
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {d.anomalie.map((a) => (
                                        <span
                                          key={a.chiave}
                                          title={a.dettaglio}
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            a.gravita === 'critico'
                                              ? 'bg-rose-950 text-rose-200 border border-rose-500/40'
                                              : 'bg-amber-950 text-amber-200 border border-amber-500/40'
                                          }`}
                                        >
                                          {a.gravita === 'critico' ? '● ' : '○ '}
                                          {a.etichetta}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: REPORT ORE & CERTIFICATI DI SERVIZIO                       */}
          {/* ================================================================= */}
          {tab === 'report_ore' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dal</label>
                    <input
                      type="date"
                      value={oreDataDa}
                      onChange={(e) => setOreDataDa(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Al</label>
                    <input
                      type="date"
                      value={oreDataA}
                      onChange={(e) => setOreDataA(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cerca Volontario / Sezione</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={oreRicerca}
                        onChange={(e) => setOreRicerca(e.target.value)}
                        placeholder="Nome, cognome, matricola..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-xs text-slate-300">
                    Volontari: <strong className="text-white">{riepilogoOre.length}</strong> • Totale ore certificate:{' '}
                    <strong className="text-emerald-400">{totaleOrePeriodo} h</strong>{' '}
                    <span className="text-[10px] text-slate-400">(escluse timbrature NFC auto-chiuse 24h)</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={noteCertificato}
                      onChange={(e) => setNoteCertificato(e.target.value)}
                      placeholder="Nota opzionale per i PDF (es. nome istituto scolastico / ente)..."
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white w-60"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        esportaRiepilogoOreCsv(riepilogoOre, oreDataDa, oreDataA);
                        mostraFeedback('ok', 'Riepilogo ore volontari esportato in CSV.');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Esporta CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3">Volontario</th>
                      <th className="py-2.5 px-3 text-right">Timbrature</th>
                      <th className="py-2.5 px-3 text-right">Turni</th>
                      <th className="py-2.5 px-3 text-right">Corsi</th>
                      <th className="py-2.5 px-3 text-right">Totale</th>
                      <th className="py-2.5 px-3 text-right">Certificati PDF Ufficiali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {riepilogoOre.map((r) => {
                      const vol = volontari.find((v) => v.id === r.volontarioId);
                      const genera = (tipo: TipoCertificatoServizio) => {
                        generaPdfCertificatoServizio({
                          riepilogo: r,
                          volontario: vol,
                          tipo,
                          dataDa: oreDataDa,
                          dataA: oreDataA,
                          noteAggiuntive: noteCertificato.trim() || undefined,
                          firmatario: operatoreCorrente,
                        });
                        onRegistraAudit?.(
                          'volontari',
                          `Emesso Certificato (${tipo})`,
                          `${r.nomeCompleto}: ${r.totaleOreComplessive}h dal ${oreDataDa} al ${oreDataA}`,
                          'info'
                        );
                        mostraFeedback('ok', `Certificato PDF generato per ${r.nomeCompleto}.`);
                      };
                      return (
                        <tr key={r.volontarioId} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white">{r.nomeCompleto}</div>
                            <div className="text-[10px] text-slate-400">
                              {r.matricola} • {r.sezione} • {r.serviziSvolti} servizi
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-cyan-300">{r.oreTimbrature}h</td>
                          <td className="py-2.5 px-3 text-right font-mono text-indigo-300">{r.oreTurni}h</td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-300">{r.oreFormazione}h</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400">
                            {r.totaleOreComplessive}h
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => genera('attestato_servizio')}
                                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-black cursor-pointer"
                              >
                                Servizio
                              </button>
                              <button
                                type="button"
                                onClick={() => genera('crediti_scolastici')}
                                className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-black cursor-pointer"
                              >
                                PCTO
                              </button>
                              <button
                                type="button"
                                onClick={() => genera('protezione_civile')}
                                className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-black cursor-pointer"
                              >
                                Prot. Civile
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: STATISTICHE & REPORT ANNUALE CON GRAFICI (SOLO DIRETTIVO)  */}
          {/* ================================================================= */}
          {tab === 'statistiche' && canViewStatisticheDirettivo && (
            <PannelloStatisticheDirettivo
              volontari={volontari}
              mezziFlotta={mezziFlotta}
              turniSedi={turni}
              timbrature={timbrature}
              serviziArchivio={serviziArchivio}
              rifornimenti={rifornimentiLive}
              manutenzioni={manutenzioni}
              guastiMezzi={guastiMezziLive}
              corsi={corsi}
              operatoreCorrente={operatoreCorrente}
            />
          )}

          {/* ================================================================= */}
          {/* TAB 5: REGISTRO ATTIVITA (AUDIT LOG - SOLO ADMIN & PRESIDENTE)    */}
          {/* ================================================================= */}
          {tab === 'audit_log' && canAccessAdminOrPresident && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={auditRicerca}
                      onChange={(e) => setAuditRicerca(e.target.value)}
                      placeholder="Cerca operatore, azione, dettaglio..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <select
                    value={auditArea}
                    onChange={(e) => setAuditArea(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="tutte">Tutte le Aree</option>
                    <option value="volontari">Volontari</option>
                    <option value="turni">Turni</option>
                    <option value="timbrature">Timbrature</option>
                    <option value="contabilita">Contabilità</option>
                    <option value="mezzi">Mezzi</option>
                    <option value="magazzino">Magazzino</option>
                    <option value="formazione">Formazione</option>
                    <option value="libri_sociali">Libri Sociali</option>
                    <option value="backup">Backup</option>
                    <option value="sistema">Sistema</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => esportaAuditLogCsv(auditFiltrati)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => esportaAuditLogPdf(auditFiltrati)}
                    className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto max-h-[50vh]">
                {auditFiltrati.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Nessun evento registrato nel Registro Attività per il filtro corrente.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3">Data / Ora</th>
                        <th className="py-2.5 px-3">Operatore</th>
                        <th className="py-2.5 px-3">Area</th>
                        <th className="py-2.5 px-3">Azione & Dettaglio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditFiltrati.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">{e.dataOra}</td>
                          <td className="py-2 px-3 font-bold text-white whitespace-nowrap">{e.operatore}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                e.criticita === 'critico'
                                  ? 'bg-red-500/20 text-red-300'
                                  : e.criticita === 'importante'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {e.area}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-100">{e.azione}</span>
                            {e.dettaglio && <span className="text-slate-400"> — {e.dettaglio}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: BACKUP COMPLETO & RIPRISTINO GUIDATO (ADMIN & PRESIDENTE)  */}
          {/* ================================================================= */}
          {tab === 'backup' && canAccessAdminOrPresident && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Esporta Backup */}
              <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40">
                    <Download className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase">1. Esporta Backup Completo</h3>
                    <p className="text-xs text-slate-400">
                      Scarica un unico file JSON protetto da codice di integrità con tutti gli archivi associativi.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div>Volontari: <strong className="text-white">{volontari.length}</strong></div>
                  <div>Turni: <strong className="text-white">{turni.length}</strong></div>
                  <div>Timbrature: <strong className="text-white">{timbrature.length}</strong></div>
                  <div>Mezzi Flotta: <strong className="text-white">{mezziFlotta.length}</strong></div>
                  <div>Corsi Formazione: <strong className="text-white">{corsi.length}</strong></div>
                  <div>Servizi Archivio: <strong className="text-white">{serviziArchivio.length}</strong></div>
                  <div>Verbali & Delibere: <strong className="text-white">{verbali.length + delibere.length}</strong></div>
                  <div>Tessere Sociali: <strong className="text-white">{tessereAssociative.length}</strong></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const esito = onEsportaBackupCompleto();
                    mostraFeedback(
                      'ok',
                      `Backup completo scaricato (${esito.fileName} • ${esito.totalRecords} record inclusi).`
                    );
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Scarica Backup Completo (.JSON)</span>
                </button>
              </div>

              {/* Ripristino Guidato */}
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40">
                    <Upload className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase">2. Ripristino Guidato da File</h3>
                    <p className="text-xs text-slate-400">
                      Carica un file di backup precedente, verifica il contenuto in anteprima e ripristina su dispositivo e cloud.
                    </p>
                  </div>
                </div>

                <input
                  ref={fileBackupInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileBackupChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileBackupInputRef.current?.click()}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Seleziona File di Backup (.JSON)</span>
                </button>

                {backupPreview && (
                  <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-white truncate">{backupPreview.fileName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          backupPreview.checksumOk
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {backupPreview.checksumOk ? 'Integrità OK' : 'Formato Legacy'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Creato il {backupPreview.exportedAt} da {backupPreview.exportedBy} (v{backupPreview.appVersion})
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                      <div>Volontari: <strong className="text-white">{backupPreview.counts.volontari}</strong></div>
                      <div>Turni: <strong className="text-white">{backupPreview.counts.turni}</strong></div>
                      <div>Timbrature: <strong className="text-white">{backupPreview.counts.timbrature}</strong></div>
                      <div>Mezzi: <strong className="text-white">{backupPreview.counts.mezzi}</strong></div>
                      <div>Corsi: <strong className="text-white">{backupPreview.counts.corsi}</strong></div>
                      <div>Servizi: <strong className="text-white">{backupPreview.counts.serviziArchivio}</strong></div>
                      <div>Note Debito: <strong className="text-white">{backupPreview.counts.noteDiDebito}</strong></div>
                      <div>Libri Sociali: <strong className="text-white">{backupPreview.counts.verbali + backupPreview.counts.delibere}</strong></div>
                    </div>

                    <label className="flex items-start gap-2 text-[11px] text-amber-200 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={confermaRestoreFlag}
                        onChange={(e) => setConfermaRestoreFlag(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Confermo di voler sovrascrivere gli archivi correnti con questo backup e sincronizzarli su cloud.
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBackupPreview(null);
                          setConfermaRestoreFlag(false);
                        }}
                        className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={!confermaRestoreFlag}
                        onClick={() => {
                          const res = onRipristinaBackupCompleto(backupPreview.rawPayload);
                          mostraFeedback(res.ok ? 'ok' : 'err', res.message);
                          if (res.ok) {
                            setBackupPreview(null);
                            setConfermaRestoreFlag(false);
                          }
                        }}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ripristina Ora</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
