import { formatISODateItaly } from './italianTime';

export type CategoriaDocumentoSop =
  | 'Statuto & Regolamenti'
  | 'Procedure Operative (SOP)'
  | 'Polizze Assicurative'
  | 'Modulistica'
  | 'Sicurezza & Protezione Civile'
  | 'Altro';

export interface ConfermaLetturaDocumento {
  volontarioId: string;
  volontarioNome: string;
  dataOra: string;
}

export interface DocumentoAssociativoSop {
  id: string;
  titolo: string;
  categoria: CategoriaDocumentoSop;
  versione: string;
  descrizione: string;
  contenutoTesto?: string;
  allegatoNome?: string;
  allegatoDataUrl?: string;
  allegatoMime?: string;
  allegatoDimensione?: number;
  urlEsterno?: string;
  obbligatorio?: boolean;
  sezioneTargetId?: string; // 'tutte' o id sede
  sezioneTargetNome?: string;
  caricatoDa: string;
  dataPubblicazione: string;
  confermeLettura?: ConfermaLetturaDocumento[];
  updatedAt: number;
}

export const CATEGORIE_DOCUMENTI_SOP: CategoriaDocumentoSop[] = [
  'Statuto & Regolamenti',
  'Procedure Operative (SOP)',
  'Polizze Assicurative',
  'Modulistica',
  'Sicurezza & Protezione Civile',
  'Altro',
];

const STORAGE_KEY = 'CROCE_ORO_DOCUMENTI_SOP_V1';
const UPDATED_AT_KEY = 'CROCE_ORO_DOCUMENTI_SOP_UPDATED_AT';
export const DOCUMENTI_SOP_UPDATED_EVENT = 'croce_oro_documenti_sop_updated';

export const DOC_ID_GUIDA_INSTALLAZIONE_APP = 'doc-sop-guida-installazione-app';

const GUIDA_INSTALLAZIONE_APP_SOP: DocumentoAssociativoSop = {
  id: DOC_ID_GUIDA_INSTALLAZIONE_APP,
  titolo: 'SOP-00 — Guida Installazione App Croce Oro (Apple & Android • Chrome & Safari)',
  categoria: 'Procedure Operative (SOP)',
  versione: 'Rev. 2026 (v5.4)',
  descrizione:
    'Guida passo-passo per scaricare e installare l\'applicazione da https://croce-oro-massa-carrarra.vercel.app/ su Apple (Safari e Google Chrome) e Android (Google Chrome e altri browser).',
  contenutoTesto:
    'GUIDA UFFICIALE INSTALLAZIONE APP — CROCE ORO MASSA CARRARA OdV\n' +
    'Indirizzo ufficiale: https://croce-oro-massa-carrarra.vercel.app/\n\n' +
    'Non serve scaricare l\'app da App Store o Google Play Store: si installa direttamente dal browser del telefono e si aggiorna da sola ad ogni nuova versione.\n\n' +
    '1. APPLE (iPhone / iPad) — SAFARI (Consigliato)\n' +
    '• Apri Safari e visita https://croce-oro-massa-carrarra.vercel.app/\n' +
    '• Tocca l\'icona Condividi (quadrato con freccia verso l\'alto) nella barra in basso.\n' +
    '• Scorri il menu e tocca "Aggiungi alla schermata Home".\n' +
    '• Tocca "Aggiungi" in alto a destra: troverai l\'icona Croce Oro sulla Home.\n\n' +
    '2. APPLE (iPhone / iPad) — GOOGLE CHROME\n' +
    '• Apri Google Chrome su iPhone/iPad e vai su https://croce-oro-massa-carrarra.vercel.app/\n' +
    '• Tocca l\'icona Condividi (quadrato con freccia in alto) nella barra indirizzi in alto a destra (o nel menu "•••" in basso a destra su alcuni modelli).\n' +
    '• Scorri l\'elenco e seleziona "Aggiungi alla schermata Home".\n' +
    '• Conferma toccando "Aggiungi" in alto a destra.\n' +
    '• Nota iOS: se usi un iOS anteriore alla versione 16.4 e la voce non appare in Chrome, apri il link con Safari.\n\n' +
    '3. ANDROID (Smartphone / Tablet) — GOOGLE CHROME (Consigliato)\n' +
    '• Apri Google Chrome e visita https://croce-oro-massa-carrarra.vercel.app/\n' +
    '• Se compare il tasto verde "Installa App" in alto (o il banner in basso), toccalo direttamente.\n' +
    '• In alternativa tocca i 3 puntini verticali (⋮) in alto a destra di Chrome.\n' +
    '• Seleziona "Installa app" (oppure "Aggiungi a schermata Home" -> "Installa") e conferma.\n\n' +
    '4. ANDROID — NOTA SU SAFARI E ALTRI BROWSER\n' +
    '• Safari è un browser esclusivo Apple e non è disponibile su Android.\n' +
    '• Su Android usa Google Chrome (consigliato). Se usi Samsung Internet o Microsoft Edge, apri il menu (☰ o ⋮) e scegli "Aggiungi pagina a -> Schermata Home" o "Installa app".\n\n' +
    '5. PRIMO AVVIO E AUTORIZZAZIONI\n' +
    '• Apri sempre l\'app dall\'icona Croce Oro sulla schermata Home.\n' +
    '• Accedi con il tuo PIN personale e consenti Notifiche Push, Posizione GPS e Microfono/Audio per ricevere avvisi bacheca, turni e comunicazioni radio.',
  urlEsterno: 'https://croce-oro-massa-carrarra.vercel.app/',
  allegatoNome: 'Guida_Installazione_App_Croce_Oro.pdf',
  obbligatorio: false,
  sezioneTargetId: 'tutte',
  sezioneTargetNome: 'Tutte le Sezioni',
  caricatoDa: 'Presidenza & Sistemi Informativi',
  dataPubblicazione: '2026-11-28',
  confermeLettura: [],
  updatedAt: 1795824000000,
};

const DOCUMENTI_SOP_PREDEFINITI: DocumentoAssociativoSop[] = [
  GUIDA_INSTALLAZIONE_APP_SOP,
  {
    id: 'doc-sop-statuto-odv',
    titolo: 'Statuto Sociale Croce Oro Massa Carrara OdV (Adeguato CTS)',
    categoria: 'Statuto & Regolamenti',
    versione: 'Rev. 2026',
    descrizione: 'Statuto vigente dell\'Organizzazione di Volontariato iscritto al RUNTS ai sensi del D.Lgs. 117/2017.',
    contenutoTesto:
      'STATUTO SOCIALE — CROCE ORO MASSA CARRARA OdV\n\n' +
      'Art. 1 — Denominazione e Sede: È costituita l\'Organizzazione di Volontariato denominata Croce Oro Massa Carrara OdV, con sede centrale a Massa.\n' +
      'Art. 2 — Finalità: L\'Associazione persegue finalità civiche, solidaristiche e di utilità sociale nel campo del soccorso sanitario, veterinario, tutela animale e Protezione Civile.\n' +
      'Art. 3 — Volontari (Art. 17-18 CTS): L\'attività di volontariato è prestata in modo personale, spontaneo e gratuito. I volontari iscritti nel Registro ufficiale sono coperti da assicurazione obbligatoria contro infortuni, malattie connesse all\'attività e responsabilità civile verso terzi.\n\n' +
      'Nota: Il Direttivo può sostituire o allegare in qualsiasi momento il file PDF ufficiale firmato e registrato.',
    obbligatorio: true,
    sezioneTargetId: 'tutte',
    sezioneTargetNome: 'Tutte le Sezioni',
    caricatoDa: 'Segreteria Generale',
    dataPubblicazione: '2026-01-10',
    confermeLettura: [],
    updatedAt: 1736467200000,
  },
  {
    id: 'doc-sop-regolamento-volontari',
    titolo: 'Regolamento Interno Volontari, Turni & Divise',
    categoria: 'Statuto & Regolamenti',
    versione: 'Rev. 2.1',
    descrizione: 'Norme di comportamento in servizio, uso della divisa sociale, puntualità ai turni, timbratura GPS/NFC e riservatezza dati.',
    contenutoTesto:
      'REGOLAMENTO INTERNO DI SERVIZIO\n\n' +
      '1. Puntualità e Timbratura: Ogni volontario è tenuto a timbrare l\'ingresso e l\'uscita tramite lettore NFC di sede o App certificata GPS.\n' +
      '2. Checklist Mezzo: Prima di iniziare l\'operatività su un veicolo è obbligatoria la compilazione della checklist di bordo e la segnalazione immediata di eventuali guasti o materiali mancanti.\n' +
      '3. Divisa e DPI: Durante tutti i servizi è obbligatorio indossare la divisa associativa completa e i DPI previsti.\n' +
      '4. Riservatezza (GDPR): È severamente vietato diffondere foto, nomi o dati sensibili dei pazienti, cittadini o interventi svolti.',
    obbligatorio: true,
    sezioneTargetId: 'tutte',
    sezioneTargetNome: 'Tutte le Sezioni',
    caricatoDa: 'Consiglio Direttivo',
    dataPubblicazione: '2026-01-15',
    confermeLettura: [],
    updatedAt: 1736899200000,
  },
  {
    id: 'doc-sop-protocollo-radio-mezzi',
    titolo: 'SOP-01 — Protocollo Comunicazioni Radio, Emergenze & Guida Sicura',
    categoria: 'Procedure Operative (SOP)',
    versione: 'SOP-01 v3',
    descrizione: 'Procedure standard per chiamate radio PTT con la Centrale Operativa, uso dispositivi di emergenza acustico/visivi e rifornimenti.',
    contenutoTesto:
      'PROCEDURA OPERATIVA STANDARD SOP-01\n\n' +
      '• Comunicazioni Radio: Premere PTT, attendere 1 secondo, identificare sempre la sigla del mezzo e la sede (es. "T4606 a Centrale, in partenza su intervento").\n' +
      '• Rifornimento Carburante: Effettuare rifornimento quando il serbatoio scende sotto 1/4 e registrare immediatamente litri, km, importo e foto scontrino dalla funzione "Rifornimento Rapido".\n' +
      '• Guasti o Sinistri: In caso di urto o guasto compilare subito la "Segnalazione Guasto/Sinistro" allegando almeno 2 fotografie e avvisare la Centrale.',
    obbligatorio: true,
    sezioneTargetId: 'tutte',
    sezioneTargetNome: 'Tutte le Sezioni',
    caricatoDa: 'Direzione Operativa',
    dataPubblicazione: '2026-02-01',
    confermeLettura: [],
    updatedAt: 1738368000000,
  },
  {
    id: 'doc-sop-polizza-art18',
    titolo: 'Riepilogo Copertura Assicurativa Volontari (Art. 18 CTS) & RCA Flotta',
    categoria: 'Polizze Assicurative',
    versione: 'Annualità 2026',
    descrizione: 'Estremi delle coperture Infortuni, Malattia, Responsabilità Civile Terzi e procedura in caso di sinistro.',
    contenutoTesto:
      'COPERTURE ASSICURATIVE ASSOCIATIVE (ART. 18 D.LGS. 117/2017)\n\n' +
      'Tutti i volontari regolarmente iscritti nel Registro Volontari RUNTS e presenti in turno/attività autorizzate sono assicurati contro:\n' +
      '1. Infortuni e malattie connessi allo svolgimento dell\'attività di volontariato;\n' +
      '2. Responsabilità civile verso terzi (RCT).\n\n' +
      'In caso di infortunio o sinistro avvisare immediatamente la Presidenza/Segreteria entro 24 ore per l\'apertura della denuncia assicurativa.',
    obbligatorio: false,
    sezioneTargetId: 'tutte',
    sezioneTargetNome: 'Tutte le Sezioni',
    caricatoDa: 'Segreteria & Tesoreria',
    dataPubblicazione: formatISODateItaly(),
    confermeLettura: [],
    updatedAt: 1738800000000,
  },
];

function ensureBuiltInSopDocs(lista: DocumentoAssociativoSop[]): DocumentoAssociativoSop[] {
  const hasGuida = lista.some((d) => d?.id === DOC_ID_GUIDA_INSTALLAZIONE_APP);
  if (hasGuida) return lista;
  return [GUIDA_INSTALLAZIONE_APP_SOP, ...lista];
}

export function getDocumentiSop(): DocumentoAssociativoSop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return ensureBuiltInSopDocs(parsed);
    }
  } catch {}
  return DOCUMENTI_SOP_PREDEFINITI;
}

export function getDocumentiSopUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(UPDATED_AT_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function salvaDocumentiSop(
  lista: DocumentoAssociativoSop[],
  updatedAt: number = Date.now()
): { lista: DocumentoAssociativoSop[]; updatedAt: number } {
  const ordered = [...(lista || [])]
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 80);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
    localStorage.setItem(UPDATED_AT_KEY, String(updatedAt));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(DOCUMENTI_SOP_UPDATED_EVENT, { detail: { lista: ordered, updatedAt } }));
  } catch {}
  return { lista: ordered, updatedAt };
}

export function mergeDocumentiSopCloud(
  remoti: DocumentoAssociativoSop[],
  remoteUpdatedAt: number = 0
): { lista: DocumentoAssociativoSop[]; updatedAt: number } {
  const locali = getDocumentiSop();
  const byId = new Map<string, DocumentoAssociativoSop>();
  for (const d of locali) {
    if (d?.id) byId.set(d.id, d);
  }
  for (const d of remoti || []) {
    if (!d?.id) continue;
    const prev = byId.get(d.id);
    if (!prev) {
      byId.set(d.id, d);
    } else {
      // Unisce anche le conferme di lettura da entrambi i lati
      const mapConf = new Map<string, ConfermaLetturaDocumento>();
      for (const c of prev.confermeLettura || []) mapConf.set(c.volontarioId, c);
      for (const c of d.confermeLettura || []) mapConf.set(c.volontarioId, c);
      const base = Number(d.updatedAt || 0) >= Number(prev.updatedAt || 0) ? d : prev;
      byId.set(d.id, { ...base, confermeLettura: Array.from(mapConf.values()) });
    }
  }
  const merged = ensureBuiltInSopDocs(Array.from(byId.values()));
  const nextTs = Math.max(getDocumentiSopUpdatedAt(), remoteUpdatedAt || Date.now());
  return salvaDocumentiSop(merged, nextTs);
}
