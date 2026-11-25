import { RifornimentoCarburante } from '../types/consumiTypes';
import { VoceCostoGestione } from '../types/adminTypes';
import { RIFORNIMENTI_INIZIALI } from '../data/rifornimentiMockData';

const STORAGE_KEY = 'CROCE_ORO_RIFORNIMENTI_MEZZI';
const UPDATED_AT_KEY = 'CROCE_ORO_RIFORNIMENTI_UPDATED_AT';
export const RIFORNIMENTI_UPDATED_EVENT = 'croce_oro_rifornimenti_updated';
const MAX_RIFORNIMENTI = 350;

export function getRifornimentiMezzi(): RifornimentoCarburante[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return RIFORNIMENTI_INIZIALI;
}

export function getRifornimentiUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(UPDATED_AT_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function salvaRifornimentiMezzi(
  lista: RifornimentoCarburante[],
  updatedAt: number = Date.now()
): { lista: RifornimentoCarburante[]; updatedAt: number } {
  const ordered = [...(lista || [])]
    .sort((a, b) => `${b.data} ${b.orario || ''}`.localeCompare(`${a.data} ${a.orario || ''}`))
    .slice(0, MAX_RIFORNIMENTI);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
    localStorage.setItem(UPDATED_AT_KEY, String(updatedAt));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(RIFORNIMENTI_UPDATED_EVENT, { detail: { lista: ordered, updatedAt } }));
  } catch {}
  return { lista: ordered, updatedAt };
}

export function mergeRifornimentiCloud(
  remoti: RifornimentoCarburante[],
  remoteUpdatedAt: number = 0
): { lista: RifornimentoCarburante[]; updatedAt: number } {
  const locali = getRifornimentiMezzi();
  const byId = new Map<string, RifornimentoCarburante>();
  for (const r of locali) {
    if (r?.id) byId.set(r.id, r);
  }
  for (const r of remoti || []) {
    if (!r?.id) continue;
    const prev = byId.get(r.id);
    if (!prev || Number(r.updatedAt || 0) >= Number(prev.updatedAt || 0)) {
      byId.set(r.id, r);
    }
  }
  const merged = Array.from(byId.values());
  const nextTs = Math.max(getRifornimentiUpdatedAt(), remoteUpdatedAt || Date.now());
  return salvaRifornimentiMezzi(merged, nextTs);
}

/**
 * Controllo automatico anomalie di rifornimento/consumo rispetto allo storico del mezzo:
 * - Chilometraggio inferiore all'ultimo rifornimento registrato
 * - Litri eccessivi in un singolo pieno (> 115 L)
 * - Consumo calcolato molto peggiore (> 35% sopra la media storica o > 26 L/100km)
 * - Prezzo al litro anomalo (> 2.50 €/L o < 0.80 €/L)
 */
export function analizzaAnomaliaRifornimento(
  nuovo: RifornimentoCarburante,
  storico: RifornimentoCarburante[]
): { anomalo: boolean; nota?: string } {
  const motivi: string[] = [];
  const delMezzo = (storico || [])
    .filter((r) => r.mezzoSigla === nuovo.mezzoSigla && r.tipoCarburante !== 'AdBlue')
    .sort((a, b) => `${b.data} ${b.orario || ''}`.localeCompare(`${a.data} ${a.orario || ''}`));

  const prezzoL = nuovo.litri > 0 ? nuovo.costoTotale / nuovo.litri : 0;
  if (nuovo.tipoCarburante !== 'AdBlue' && (prezzoL > 2.5 || prezzoL < 0.8)) {
    motivi.push(`Prezzo al litro fuori range (${prezzoL.toFixed(3)} €/L)`);
  }
  if (nuovo.litri > 115) {
    motivi.push(`Quantità molto elevata in un unico rifornimento (${nuovo.litri} L)`);
  }

  const precedente = delMezzo[0];
  if (precedente && nuovo.tipoCarburante !== 'AdBlue') {
    const deltaKm = nuovo.chilometraggio - precedente.chilometraggio;
    if (deltaKm < 0) {
      motivi.push(`Km inferiori al rifornimento precedente (${nuovo.chilometraggio} vs ${precedente.chilometraggio} km)`);
    } else if (deltaKm > 25) {
      const lPer100 = (nuovo.litri / deltaKm) * 100;
      // Calcola media storica del mezzo se disponibili almeno 2 rifornimenti precedenti
      let mediaStoricaL100 = 0;
      if (delMezzo.length >= 2) {
        const kmSpan = delMezzo[0].chilometraggio - delMezzo[delMezzo.length - 1].chilometraggio;
        const litriSum = delMezzo.slice(0, -1).reduce((s, r) => s + r.litri, 0);
        if (kmSpan > 50 && litriSum > 0) {
          mediaStoricaL100 = (litriSum / kmSpan) * 100;
        }
      }
      if (lPer100 > 26) {
        motivi.push(`Consumo elevato: ${lPer100.toFixed(1)} L/100km (${deltaKm} km con ${nuovo.litri} L)`);
      } else if (mediaStoricaL100 > 0 && lPer100 > mediaStoricaL100 * 1.35) {
        motivi.push(`Consumo +${Math.round(((lPer100 / mediaStoricaL100) - 1) * 100)}% sopra la media del mezzo (${lPer100.toFixed(1)} vs ${mediaStoricaL100.toFixed(1)} L/100km)`);
      }
    }
  }

  return {
    anomalo: motivi.length > 0,
    nota: motivi.length > 0 ? motivi.join(' • ') : undefined,
  };
}

/**
 * Converte un rifornimento carburante in una voce di Costi di Gestione (Database Contabilità)
 * con ID deterministico e collegamento `rifornimentoId` per evitare duplicazioni nel Prospetto Commercialista.
 */
export function creaVoceCostoGestioneDaRifornimento(r: RifornimentoCarburante): VoceCostoGestione {
  const litriFmt = Number(r.litri || 0).toFixed(1).replace('.', ',');
  const kmFmt = Number(r.chilometraggio || 0).toLocaleString('it-IT');
  const tipoCarb = r.tipoCarburante || 'Carburante';
  const noteParts = [
    r.creatoDaTurno ? 'Registrato da Turno' : 'Registrato da Consumi Mezzi',
    r.orario ? `Ore ${r.orario}` : '',
    r.note || '',
  ].filter(Boolean);

  return {
    id: `cgest-rif-${r.id}`,
    rifornimentoId: r.id,
    origineAutomatica: 'rifornimento_carburante',
    data: r.data,
    tipo: 'uscita',
    categoria: 'Carburante Flotta',
    descrizione: `Rifornimento Mezzo ${r.mezzoSigla} (${litriFmt} L ${tipoCarb} • Km ${kmFmt})`,
    importo: Math.round((Number(r.costoTotale) || 0) * 100) / 100,
    metodoPagamento: r.metodoPagamento || 'Carta Carburante',
    fornitore: r.distributore || undefined,
    operatoreRegistrazione: r.volontarioNome || 'Operatore',
    note: noteParts.join(' • ') || undefined,
    createdAt: r.updatedAt || Date.now(),
  };
}

