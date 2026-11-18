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
  tipologiaMezzo: string; // Tipologia principale o etichetta riepilogativa per retrocompatibilità
  tipologieMezzo?: string[]; // Una o più Tipologie Mezzo associate a questa checklist
  mezziAssegnati?: string[]; // Sigle specifiche se limitata (es. ['T4606', 'T4609'])
  attiva: boolean;
  dataCreazione: string;
  dataUltimaModifica: string;
  autore?: string;
  voci: VoceChecklistTemplate[];
}

export function getTipologieAssociateTemplate(
  tmpl: Pick<ChecklistTemplate, 'tipologiaMezzo' | 'tipologieMezzo'>
): string[] {
  if (Array.isArray(tmpl.tipologieMezzo)) {
    const pulite = Array.from(
      new Set(tmpl.tipologieMezzo.map((s) => String(s || '').trim()).filter(Boolean))
    );
    return pulite;
  }
  const single = String(tmpl.tipologiaMezzo || '').trim();
  return single ? [single] : [];
}

export function templateCopreTipologia(
  tmpl: Pick<ChecklistTemplate, 'tipologiaMezzo' | 'tipologieMezzo'>,
  tipologiaNome: string
): boolean {
  const target = String(tipologiaNome || '').trim().toLowerCase();
  if (!target) return false;
  const associate = getTipologieAssociateTemplate(tmpl);
  return associate.some((t) => {
    const norm = t.toLowerCase();
    return norm === target || norm === 'tutte' || norm === 'tutte le tipologie';
  });
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
  if (m.includes('fuoristrada') || m.includes('4x4') || m.includes('protezione civile') || m.includes('t4607') || m.includes('t4613')) {
    return 'Fuoristrada 4x4';
  }
  if (m.includes('disabili') || m.includes('pulmino') || m.includes('t4611') || m.includes('t4610')) {
    return 'Pulmino Disabili';
  }
  if (m.includes('furgone') || m.includes('logistico') || m.includes('t4615')) {
    return 'Furgone Logistico';
  }
  if (m.includes('trasporto') || m.includes('t4614')) {
    return 'Ambulanza Trasporto';
  }
  if (m.includes('automedica') || m.includes('medica') || m.includes('t4608')) {
    return 'Automedica';
  }
  return 'Ambulanza Emergenza';
}
