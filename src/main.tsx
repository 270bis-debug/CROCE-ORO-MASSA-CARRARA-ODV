import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPWAUpdater } from './services/pwaUpdater';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { installApiAuthFetchInterceptor } from './utils/apiAuthFetch';

// Inizializza autenticazione automatica per tutte le chiamate /api/* (Firebase Bearer o PIN Volontario)
installApiAuthFetchInterceptor();

// Inizializza Service Worker e controllo aggiornamenti automatici su Android e Apple
initPWAUpdater();

// Rilevamento automatico superamento quota Google Maps Platform (Tier 1)
if (typeof window !== 'undefined') {
  (window as any).__CROCE_ORO_APP_MOUNTED__ = true;
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
