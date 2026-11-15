/**
 * Utility centralizzata per l'ordinamento naturale dei mezzi (alfanumerico A-Z e numerico crescente).
 * Garantisce che sigle come T4606 vengano sempre prima di T4607, T4608, T4609, T4611, ecc.
 */

export function confrontaMezziAlfanumerico(
  a: string | { sigla?: string; label?: string; nome?: string; codice?: string; etichettaVolontario?: string },
  b: string | { sigla?: string; label?: string; nome?: string; codice?: string; etichettaVolontario?: string }
): number {
  const strA = typeof a === 'string'
    ? a
    : (a.sigla || a.codice || a.etichettaVolontario || a.label || a.nome || '');
  const strB = typeof b === 'string'
    ? b
    : (b.sigla || b.codice || b.etichettaVolontario || b.label || b.nome || '');

  return strA.localeCompare(strB, 'it', { numeric: true, sensitivity: 'base' });
}

export function ordinaListaMezzi<T extends string | { sigla?: string; label?: string; nome?: string; codice?: string; etichettaVolontario?: string }>(
  lista: T[]
): T[] {
  return [...lista].sort(confrontaMezziAlfanumerico);
}
