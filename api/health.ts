// Vercel Serverless Function: GET /api/health
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

function readBuildVersion(): string {
  try {
    const versionFile = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(versionFile)) {
      const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
      if (parsed?.version) return String(parsed.version);
    }
  } catch {
    // Fallback below
  }
  return '4.2.1';
}

export default function handler(
  req: IncomingMessage & { method?: string },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('X-Sync-Mode', 'cloud-firestore');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const payload = {
    ok: true,
    status: 'online',
    mode: 'vercel-serverless',
    firestoreConfigured: true,
    uptime: Math.round(process.uptime()),
    version: readBuildVersion(),
    volontariCount: 0,
    timestamp: new Date().toISOString(),
  };

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
