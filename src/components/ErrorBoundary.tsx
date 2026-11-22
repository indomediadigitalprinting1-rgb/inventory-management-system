import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { getFirebaseConsoleUrls, isFirestoreQuotaError } from '../firebase/config';

interface State {
  hasError: boolean;
  errorMessage: string;
  quotaExceeded: boolean;
}

function parseFriendlyError(raw: string): { message: string; quotaExceeded: boolean } {
  const fallbackQuota = isFirestoreQuotaError(raw);
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; quotaExceeded?: unknown };
    if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
      return {
        message: parsed.error,
        quotaExceeded: Boolean(parsed.quotaExceeded) || isFirestoreQuotaError(parsed.error),
      };
    }
  } catch {
    // Plain error string
  }
  return {
    message: raw || 'Terjadi kesalahan sistem yang tidak terduga.',
    quotaExceeded: fallbackQuota,
  };
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '', quotaExceeded: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const parsed = parseFriendlyError(error.message || '');
    return {
      hasError: true,
      errorMessage: parsed.message,
      quotaExceeded: parsed.quotaExceeded,
    };
  }

  render() {
    if (this.state.hasError) {
      const { upgradeUrl } = getFirebaseConsoleUrls();
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">
                {this.state.quotaExceeded ? 'Kuota Harian Firebase Tercapai' : 'Terjadi Gangguan Sistem'}
              </h1>
            </div>
            <p className="text-sm text-slate-600 break-words leading-relaxed">
              {this.state.errorMessage}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang Aplikasi
              </button>
              {this.state.quotaExceeded && (
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Buka Firebase Console
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
