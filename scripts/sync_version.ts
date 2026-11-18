import fs from 'fs';
import path from 'path';
import { generateBuildInfo } from './generate_build_info';

/**
 * Script per la sincronizzazione e l'incremento automatico della versione dell'applicazione.
 * Mantiene perfettamente allineati:
 * - src/version.ts
 * - package.json
 * - public/sw.js
 * - public/manifest.json
 * - index.html
 */

const ROOT = process.cwd();

const FILES = {
  versionTs: path.join(ROOT, 'src/version.ts'),
  packageJson: path.join(ROOT, 'package.json'),
  swJs: path.join(ROOT, 'public/sw.js'),
  manifestJson: path.join(ROOT, 'public/manifest.json'),
  indexHtml: path.join(ROOT, 'index.html'),
};

function readCurrentVersion(): string {
  const content = fs.readFileSync(FILES.versionTs, 'utf-8');
  const match = content.match(/export const APP_VERSION = '([^']+)';/);
  if (!match) throw new Error('Impossibile estrarre APP_VERSION da src/version.ts');
  return match[1];
}

export function syncAllFilesToVersion(targetVersion: string) {
  console.log(`\n🚀 Sincronizzazione versione di progetto -> v${targetVersion}`);

  // 1. src/version.ts
  const versionTsContent = `/**
 * REGOLA TASSATIVA DI PROGETTO:
 * Ad ogni nuova modifica, fix, rilascio o richiesta implementata,
 * incrementare SEMPRE il numero di versione qui in src/version.ts,
 * in package.json, in public/sw.js, in public/manifest.json e index.html.
 * Usa 'npm run bump' per incrementare automaticamente.
 */
export const APP_VERSION = '${targetVersion}';
export const APP_VERSION_LABEL = \`v \${APP_VERSION}\`;
`;
  fs.writeFileSync(FILES.versionTs, versionTsContent, 'utf-8');
  console.log(`  ✓ src/version.ts aggiornato a ${targetVersion}`);

  // 2. package.json
  const pkg = JSON.parse(fs.readFileSync(FILES.packageJson, 'utf-8'));
  pkg.version = targetVersion;
  fs.writeFileSync(FILES.packageJson, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ package.json aggiornato a ${targetVersion}`);

  // 3. public/sw.js
  let swContent = fs.readFileSync(FILES.swJs, 'utf-8');
  swContent = swContent.replace(
    /const CACHE_NAME = 'croce-oro-cache-[^']+';/,
    `const CACHE_NAME = 'croce-oro-cache-v${targetVersion}';`
  );
  fs.writeFileSync(FILES.swJs, swContent, 'utf-8');
  console.log(`  ✓ public/sw.js CACHE_NAME aggiornato a croce-oro-cache-v${targetVersion}`);

  // 4. public/manifest.json
  const manifest = JSON.parse(fs.readFileSync(FILES.manifestJson, 'utf-8'));
  manifest.version = targetVersion;
  fs.writeFileSync(FILES.manifestJson, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ public/manifest.json aggiornato a ${targetVersion}`);

  // 5. index.html
  let indexHtml = fs.readFileSync(FILES.indexHtml, 'utf-8');
  indexHtml = indexHtml.replace(
    /<!-- Icone e Favicon Ufficiali con Cache Busting [^>]+ -->/,
    `<!-- Icone e Favicon Ufficiali con Cache Busting v${targetVersion} -->`
  );
  indexHtml = indexHtml.replace(/\?v=[0-9]+\.[0-9]+\.[0-9]+/g, `?v=${targetVersion}`);
  fs.writeFileSync(FILES.indexHtml, indexHtml, 'utf-8');
  console.log(`  ✓ index.html cache-busting aggiornato a ${targetVersion}`);

  // 6. Generazione Build Info & Endpoint di versione (/api/version, version.json, buildInfo.ts)
  generateBuildInfo(targetVersion);

  console.log(`✨ Allineamento versione v${targetVersion} completato con successo!\n`);
}

// Se invocato direttamente da riga di comando
const isDirectRun = Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('sync_version.ts'));
if (isDirectRun) {
  const arg = process.argv[2];
  if (arg) {
    syncAllFilesToVersion(arg);
  } else {
    const current = readCurrentVersion();
    syncAllFilesToVersion(current);
  }
}
