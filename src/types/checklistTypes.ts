// Definizione tipi per la Checklist Inizio Turno Guidata dei Mezzi
// Croce Oro Massa Carrara OdV

export type CategoriaVoceChecklist =
  | 'Documenti & Dotazioni Bordo'
  | 'Stato Meccanico & Livelli'
  | 'Dispositivi Emergenza & Luci'
  | 'Vano Sanitario & Elettromedicali'
  | 'Attrezzatura Protezione Civile'
  | 'Pulizia, Sanificazione & DPI';

export interface VoceChecklistTemplate {
  id: string;
  categoria: CategoriaVoceChecklist;
  titolo: string;
  descrizione?: string;
  critica?: boolean; // Se non conforme, genera alert prioritario per la centrale
  obbligatoria?: boolean;
}

export interface ChecklistTemplate {
  id: string;
  titolo: string;
  descrizione: string;
  tipologiaMezzo: string; // 'Tutte' | 'Ambulanza Emergenza' | 'Ambulanza Trasporto' | 'Fuoristrada 4x4' | 'Pulmino Disabili' | 'Furgone Logistico' | 'Automedica'
  mezziAssegnati?: string[]; // Sigle specifiche se limitata (es. ['T4606', 'T4609'])
  attiva: boolean;
  dataCreazione: string;
  dataUltimaModifica: string;
  autore?: string;
  voci: VoceChecklistTemplate[];
}

export interface RisultatoVoceChecklist {
  voceId: string;
  titolo: string;
  categoria: CategoriaVoceChecklist;
  conforme: boolean; // true = Conforme (✓), false = Non Conforme (✗)
  noteKo?: string;
  critica?: boolean;
}

export interface ChecklistCompilataTurno {
  id: string;
  templateId: string;
  templateTitolo: string;
  tipologiaMezzo: string;
  mezzoSigla: string;
  mezzoModello?: string;
  volontarioId: string;
  volontarioNome: string;
  qualificaTurno: string;
  dataOraCompilazione: string;
  tuttoConforme: boolean;
  totaleVoci: number;
  vociConformi: number;
  vociNonConformi: number;
  anomalieRilevate: string[];
  noteGenerali?: string;
  kmInizialiDichiarati?: number;
  risultati: RisultatoVoceChecklist[];
  firmaVolontarioBase64?: string;
  statoCentrale?: 'Presa in Carico' | 'In Attesa' | 'Anomalia Risolta';
}

export function deduciTipoMezzoDaNome(mezzo: string): string {
  if (!mezzo) return 'Ambulanza Emergenza';
  const m = mezzo.toLowerCase();
  if (m.includes('fuoristrada') || m.includes('4x4') || m.includes('protezione civile') || m.includes('t4608')) {
    return 'Fuoristrada 4x4';
  }
  if (m.includes('disabili') || m.includes('pulmino') || m.includes('trasporto') || m.includes('t4610')) {
    return 'Pulmino Disabili';
  }
  if (m.includes('automedica') || m.includes('medica') || m.includes('t4614')) {
    return 'Automedica';
  }
  return 'Ambulanza Emergenza';
}
