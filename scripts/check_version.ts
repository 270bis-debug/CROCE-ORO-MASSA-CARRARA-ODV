import fs from 'fs';
import path from 'path';
import { generateBuildInfo } from './generate_build_info';

const ROOT = process.cwd();

const versionTsPath = path.join(ROOT, 'src/version.ts');
const packageJsonPath = path.join(ROOT, 'package.json');
const swJsPath = path.join(ROOT, 'public/sw.js');
const manifestPath = path.join(ROOT, 'public/manifest.json');

const versionTs = fs.readFileSync(versionTsPath, 'utf-8');
const versionMatch = versionTs.match(/export const APP_VERSION = '([^']+)';/);
if (!versionMatch) {
  console.error('❌ ERRORE: Impossibile trovare APP_VERSION in src/version.ts');
  process.exit(1);
}
const version = versionMatch[1];

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const sw = fs.readFileSync(swJsPath, 'utf-8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

let errors: string[] = [];

// Verifica regola utente: penultima e ultima cifra devono essere singole cifre da 0 a 9
const parts = version.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  errors.push(`Formato versione non valido: ${version} (atteso X.Y.Z)`);
} else {
  if (parts[1] > 9) {
    errors.push(`La penultima cifra (${parts[1]}) non può superare 9: deve incrementare la prima cifra e ripartire da 0.`);
  }
  if (parts[2] > 9) {
    errors.push(`L'ultima cifra (${parts[2]}) non può superare 9: deve incrementare la penultima cifra e ripartire da 0.`);
  }
}

if (pkg.version !== version) {
  errors.push(`package.json (${pkg.version}) !== src/version.ts (${version})`);
}

if (!sw.includes(`croce-oro-cache-v${version}`)) {
  errors.push(`public/sw.js cache non allineato con v${version}`);
}

if (manifest.version !== version) {
  errors.push(`public/manifest.json (${manifest.version}) !== src/version.ts (${version})`);
}

if (errors.length > 0) {
  console.error('❌ DISALLINEAMENTO VERSIONE RILEVATO:');
  errors.forEach((e) => console.error(`  - ${e}`));
  console.error("Esegui 'npm run sync-version' per sincronizzare automaticamente tutti i file.");
  process.exit(1);
} else {
  generateBuildInfo(version);
  console.log(`✅ Controllo integrità versione superato: v${version} sincronizzata in tutti i file.`);
}
