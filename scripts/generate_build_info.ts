import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

export function generateBuildInfo(targetVersion?: string) {
  let version = targetVersion;

  if (!version) {
    const versionTsPath = path.join(ROOT, 'src/version.ts');
    const versionContent = fs.readFileSync(versionTsPath, 'utf-8');
    const match = versionContent.match(/export const APP_VERSION = '([^']+)';/);
    if (!match) {
      throw new Error('Impossibile estrarre APP_VERSION da src/version.ts');
    }
    version = match[1];
  }

  const buildTimestamp = Date.now();
  const buildId = `croce-oro-v${version}-${buildTimestamp}`;
  const builtAt = new Date().toISOString();

  const buildInfo = {
    version,
    buildId,
    buildTimestamp,
    builtAt
  };

  const jsonContent = JSON.stringify(buildInfo, null, 2) + '\n';

  // 1. src/buildInfo.ts
  const buildInfoTs = `/**
 * File generato automaticamente durante il processo di build.
 * NON modificare a mano.
 */
export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)} as const;
`;
  fs.writeFileSync(path.join(ROOT, 'src/buildInfo.ts'), buildInfoTs, 'utf-8');
  console.log(`  ✓ src/buildInfo.ts generato (v${version}, buildId: ${buildId})`);

  // 2. public/version.json
  const publicDir = path.join(ROOT, 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'version.json'), jsonContent, 'utf-8');

  // 3. public/api/version.json e public/api/version
  const publicApiDir = path.join(publicDir, 'api');
  if (!fs.existsSync(publicApiDir)) fs.mkdirSync(publicApiDir, { recursive: true });
  fs.writeFileSync(path.join(publicApiDir, 'version.json'), jsonContent, 'utf-8');
  fs.writeFileSync(path.join(publicApiDir, 'version'), jsonContent, 'utf-8');
  console.log(`  ✓ public/version.json e public/api/version generati per hosting statico e CDN Vercel`);

  // 4. api/version.ts (Serverless Function compatibile con Vercel)
  const apiDir = path.join(ROOT, 'api');
  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

  const vercelApiCode = `// Serverless Function per Vercel Edge / Node runtime
// Risponde su https://croce-oro-massa-carrara.vercel.app/api/version
import type { IncomingMessage, ServerResponse } from 'http';

export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};

export default function handler(req: IncomingMessage & { method?: string }, res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(BUILD_INFO);
  }

  res.statusCode = 200;
  return res.end(JSON.stringify(BUILD_INFO));
}
`;
  fs.writeFileSync(path.join(apiDir, 'version.ts'), vercelApiCode, 'utf-8');
  console.log(`  ✓ api/version.ts (Vercel Serverless Function) generato con successo`);

  // 5. Se esiste già dist/, sincronizza anche dist/
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'version.json'), jsonContent, 'utf-8');
    const distApiDir = path.join(distDir, 'api');
    if (!fs.existsSync(distApiDir)) fs.mkdirSync(distApiDir, { recursive: true });
    fs.writeFileSync(path.join(distApiDir, 'version.json'), jsonContent, 'utf-8');
    fs.writeFileSync(path.join(distApiDir, 'version'), jsonContent, 'utf-8');
    console.log(`  ✓ dist/api/version e dist/version.json aggiornati`);
  }

  return buildInfo;
}

// Esegui se invocato da riga di comando
if (process.argv[1] && process.argv[1].endsWith('generate_build_info.ts')) {
  generateBuildInfo();
}
