// Serverless Function per Vercel Edge / Node runtime
// Risponde su https://croce-oro-massa-carrara.vercel.app/api/version
import type { IncomingMessage, ServerResponse } from 'http';

export const BUILD_INFO = {
  "version": "4.4.1",
  "buildId": "croce-oro-v4.4.1-1794836121895",
  "buildTimestamp": 1794836121895,
  "builtAt": "2026-11-16T13:35:21.895Z"
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
