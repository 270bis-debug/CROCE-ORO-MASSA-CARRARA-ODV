// Serverless Function per Vercel Edge / Node runtime
// Risponde su https://croce-oro-massa-carrara.vercel.app/api/version
import type { IncomingMessage, ServerResponse } from 'http';

export const BUILD_INFO = {
  "version": "5.0.4",
  "buildId": "croce-oro-v5.0.4-1795215121477",
  "buildTimestamp": 1795215121477,
  "builtAt": "2026-11-20T22:52:01.477Z"
};

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
