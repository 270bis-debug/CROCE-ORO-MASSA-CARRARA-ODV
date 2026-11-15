import fs from 'fs';
import path from 'path';
import { syncAllFilesToVersion } from './sync_version';

/**
 * REGOLA UFFICIALE DI VERSIONE (fornita dall'utente):
 * Formato: PRIMA.PENULTIMA.ULTIMA (es. X.Y.Z)
 * 
 * 1. Modifiche di poca importanza (minori):
 *    - Incrementa l'ULTIMA cifra di 1.
 *    - Quando l'ULTIMA cifra arriva al numero 9 e avanza:
 *      incrementa la PENULTIMA di 1 e l'ULTIMA riparte da 0 (es. 2.2.9 -> 2.3.0).
 *    - Quando la PENULTIMA cifra arriva al numero 9 e avanza:
 *      incrementa la PRIMA di 1 e la PENULTIMA riparte da 0 (es. 2.9.9 -> 3.0.0).
 * 
 * 2. Modifiche importanti e profonde:
 *    - Incrementa direttamente la PENULTIMA cifra di 1 e l'ULTIMA riparte da 0 (es. 2.3.4 -> 2.4.0).
 *    - Quando la PENULTIMA cifra arriva a 9 e avanza:
 *      incrementa la PRIMA di 1, e la PENULTIMA riparte da 0 (es. 2.9.x -> 3.0.0).
 */

const ROOT = process.cwd();
const versionTsPath = path.join(ROOT, 'src/version.ts');

const content = fs.readFileSync(versionTsPath, 'utf-8');
const match = content.match(/export const APP_VERSION = '([^']+)';/);
if (!match) {
  console.error('ERRORE: Impossibile trovare APP_VERSION in src/version.ts');
  process.exit(1);
}

const currentVersion = match[1];
const parts = currentVersion.split('.').map(Number);

if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`ERRORE: Versione '${currentVersion}' non valida. Atteso formato X.Y.Z`);
  process.exit(1);
}

let [prima, penultima, ultima] = parts;

const arg = (process.argv[2] || '').toLowerCase();
const isImportante = arg === 'importante' || arg === 'major' || arg === 'deep';

if (isImportante) {
  // Modifica importante e profonda: incrementa penultima, resetta ultima a 0
  penultima += 1;
  ultima = 0;
  if (penultima > 9) {
    prima += 1;
    penultima = 0;
  }
} else {
  // Modifica di poca importanza: incrementa ultima cifra
  ultima += 1;
  if (ultima > 9) {
    ultima = 0;
    penultima += 1;
    if (penultima > 9) {
      prima += 1;
      penultima = 0;
    }
  }
}

const newVersion = `${prima}.${penultima}.${ultima}`;
console.log(`\n📦 Incremento versione: ${currentVersion} -> ${newVersion} (${isImportante ? 'IMPORTANTE/PROFONDA' : 'DI POCA IMPORTANZA'})`);
syncAllFilesToVersion(newVersion);
