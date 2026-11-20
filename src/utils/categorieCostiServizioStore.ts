import { useState, useEffect } from 'react';
import { CategoriaCostoServizio } from '../types/adminTypes';
import { formatISODateItaly } from './italianTime';

export const CATEGORIE_COSTI_SERVIZIO_STORAGE_KEY = 'croce_oro_categorie_costi_servizio_v1';
export const CATEGORIE_COSTI_SERVIZIO_UPDATED_AT_KEY = 'croce_oro_categorie_costi_servizio_updated_at';
export const CATEGORIE_COSTI_SERVIZIO_EVENT_NAME = 'croceoro_categorie_costi_servizio_updated';

export const CATEGORIE_COSTI_SERVIZIO_DEFAULT: CategoriaCostoServizio[] = [
  {
    id: 'mezzo_km',
    nome: 'Costo Mezzo al KM',
    unitaDefault: 'km',
    descrizione: 'Tariffe chilometriche percorrenza mezzi',
    predefinita: true,
  },
  {
    id: 'uscita_mezzo',
    nome: 'Costo Uscita Mezzo',
    unitaDefault: 'uscita',
    descrizione: 'Diritto fisso uscita o impiego mezzo',
    predefinita: true,
  },
  {
    id: 'operatore',
    nome: 'Costo Operatori / Equipaggio',
    unitaDefault: 'ora',
    descrizione: 'Tariffe orarie o a turno per volontari/operatori',
    predefinita: true,
  },
  {
    id: 'editabile',
    nome: 'Voce Editabile / Personalizzata',
    unitaDefault: 'servizio',
    descrizione: 'Voci libere o personalizzate in nota di debito',
    predefinita: true,
  },
];

function emettiAggiornamentoLocale(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CATEGORIE_COSTI_SERVIZIO_EVENT_NAME));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === CATEGORIE_COSTI_SERVIZIO_STORAGE_KEY) {
        emettiAggiornamentoLocale();
      }
    });
  } catch {}
}

export function getCategorieCostiServizioUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(CATEGORIE_COSTI_SERVIZIO_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function normalizzaCategorieCostiServizio(rawList: any[]): CategoriaCostoServizio[] {
  if (!Array.isArray(rawList)) return [...CATEGORIE_COSTI_SERVIZIO_DEFAULT];
  const seen = new Set<string>();
  const out: CategoriaCostoServizio[] = [];
  rawList.forEach((item, idx) => {
    const nome = String(item?.nome || '').trim();
    if (!nome) return;
    const rawId = String(item?.id || '').trim();
    const id = rawId || `cat-costo-${Date.now()}-${idx}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      nome,
      unitaDefault: item?.unitaDefault ? String(item.unitaDefault).trim() : 'servizio',
      descrizione: item?.descrizione ? String(item.descrizione).trim() : undefined,
      predefinita: Boolean(item?.predefinita),
      dataCreazione: item?.dataCreazione ? String(item.dataCreazione) : formatISODateItaly(),
    });
  });
  return out.length > 0 ? out : [...CATEGORIE_COSTI_SERVIZIO_DEFAULT];
}

export function getCategorieCostiServizio(): CategoriaCostoServizio[] {
  if (typeof window === 'undefined') return [...CATEGORIE_COSTI_SERVIZIO_DEFAULT];
  try {
    const raw = localStorage.getItem(CATEGORIE_COSTI_SERVIZIO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizzaCategorieCostiServizio(parsed);
      }
    }
  } catch {}
  return [...CATEGORIE_COSTI_SERVIZIO_DEFAULT];
}

export function salvaCategorieCostiServizio(
  lista: CategoriaCostoServizio[],
  updatedAt?: number,
  skipServerPost: boolean = false
): CategoriaCostoServizio[] {
  const norm = normalizzaCategorieCostiServizio(lista);
  const ts = typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CATEGORIE_COSTI_SERVIZIO_STORAGE_KEY, JSON.stringify(norm));
      localStorage.setItem(CATEGORIE_COSTI_SERVIZIO_UPDATED_AT_KEY, String(ts));
    } catch {}
    emettiAggiornamentoLocale();
    if (!skipServerPost) {
      fetch('/api/categorie-costi-servizio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorie: norm, updatedAt: ts }),
      }).catch(() => {});
    }
  }
  return norm;
}

export function applicaCategorieCostiServizioDaSync(categorie?: any[], updatedAt?: number): boolean {
  if (!Array.isArray(categorie) || categorie.length === 0) return false;
  const localTs = getCategorieCostiServizioUpdatedAt();
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaCategorieCostiServizio(categorie, updatedAt || Date.now(), true);
  return true;
}

export async function sincronizzaCategorieCostiServizioDaServer(): Promise<CategoriaCostoServizio[]> {
  if (typeof window === 'undefined') return [...CATEGORIE_COSTI_SERVIZIO_DEFAULT];
  try {
    const res = await fetch('/api/categorie-costi-servizio', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.categorie) && json.categorie.length > 0) {
        applicaCategorieCostiServizioDaSync(json.categorie, json.updatedAt);
        return getCategorieCostiServizio();
      }
    }
  } catch {}
  return getCategorieCostiServizio();
}

export function getNomeCategoriaCosto(catId: string | undefined, categorie: CategoriaCostoServizio[]): string {
  const target = String(catId || '').trim();
  if (!target) return 'Generale';
  const found = categorie.find((c) => c.id === target);
  if (found) return found.nome;
  const def = CATEGORIE_COSTI_SERVIZIO_DEFAULT.find((c) => c.id === target);
  if (def) return def.nome;
  return target;
}

export function useCategorieCostiServizio(): CategoriaCostoServizio[] {
  const [categorie, setCategorie] = useState<CategoriaCostoServizio[]>(() => getCategorieCostiServizio());

  useEffect(() => {
    const refresh = () => {
      setCategorie(getCategorieCostiServizio());
    };
    window.addEventListener(CATEGORIE_COSTI_SERVIZIO_EVENT_NAME, refresh);
    sincronizzaCategorieCostiServizioDaServer().catch(() => {});
    return () => {
      window.removeEventListener(CATEGORIE_COSTI_SERVIZIO_EVENT_NAME, refresh);
    };
  }, []);

  return categorie;
}
