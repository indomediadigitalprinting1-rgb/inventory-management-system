import { AlertCircle, CheckCircle2, Clock, PackageCheck, XCircle } from 'lucide-react';
import type { IncomingStatus, RequestStatus } from '../domain/types';
import { REQUEST_STATUS_LABELS } from '../domain/types';

export function RequestStatusLabel({ status }: { status: RequestStatus }) {
  switch (status) {
    case 'MENUNGGU_PERSETUJUAN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {REQUEST_STATUS_LABELS[status]}
        </span>
      );
    case 'DISETUJUI':
    case 'SIAP_DIAMBIL':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <PackageCheck className="w-3.5 h-3.5 shrink-0" />
          {REQUEST_STATUS_LABELS[status]}
        </span>
      );
    case 'DALAM_PROSES_PENGAMBILAN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {REQUEST_STATUS_LABELS[status]}
        </span>
      );
    case 'SELESAI':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          {REQUEST_STATUS_LABELS[status]}
        </span>
      );
    case 'DITOLAK':
    case 'DIBATALKAN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          {REQUEST_STATUS_LABELS[status]}
        </span>
      );
  }
}

export function IncomingStatusLabel({ status }: { status: IncomingStatus }) {
  if (status === 'CONFIRMED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Dikonfirmasi
      </span>
    );
  }
  if (status === 'REVERSED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Dibalik (Reversal)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      Draft
    </span>
  );
}

export function StockHealthLabel({ current, min }: { current: number; min: number }) {
  if (current <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        Stok Habis
      </span>
    );
  }
  if (current <= min) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Minimum
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      Aman
    </span>
  );
}
