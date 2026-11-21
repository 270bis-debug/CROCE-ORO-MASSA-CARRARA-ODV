import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message || error.name
        : typeof error === 'string'
        ? error
        : 'Errore imprevisto durante il caricamento dell’interfaccia.';
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Errore intercettato:', error, info?.componentStack);
  }

  private handleResetAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
    } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('ripristino', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-white">
              Ripristino Centrale Operativa
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Si è verificato un problema di caricamento sul browser del dispositivo.
              Tocca il pulsante qui sotto per pulire la cache locale e riavviare l’applicazione in sicurezza.
            </p>
          </div>

          {this.state.errorMessage && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-left text-[11px] font-mono text-amber-300 break-words">
              {this.state.errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={this.handleResetAndReload}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm px-4 py-3 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ripristina Cache e Ricarica</span>
          </button>
        </div>
      </div>
    );
  }
}
