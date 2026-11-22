import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Database, ExternalLink, Info } from 'lucide-react';
import { computeDatabaseCapacityReport } from '../domain/rules';
import { FIREBASE_DATABASE_ID, FIREBASE_PROJECT_ID } from '../firebase/config';
import { useInventory } from '../services/inventoryContext';

interface OwnerQuotaIndicatorProps {
  variant: 'compact' | 'detailed';
}

export function OwnerQuotaIndicator({ variant }: OwnerQuotaIndicatorProps) {
  const {
    currentUser,
    categories,
    units,
    suppliers,
    items,
    incoming,
    requests,
    deliveries,
    adjustments,
    ledger,
    notifications,
    auditLogs,
    users,
    invites,
    systemConfig,
    adminSlot,
    setActiveRoute,
  } = useInventory();

  const report = useMemo(() => {
    const masterCount = categories.length + units.length + suppliers.length + items.length;
    const transactionCount =
      incoming.length +
      requests.length +
      deliveries.length +
      adjustments.length +
      ledger.length;
    const logAndNotifCount = auditLogs.length + notifications.length;
    const accountCount =
      users.length + invites.length + (systemConfig ? 1 : 0) + (adminSlot ? 1 : 0);

    const payloadJson = JSON.stringify({
      categories,
      units,
      suppliers,
      items,
      incoming,
      requests,
      deliveries,
      adjustments,
      ledger,
      notifications,
      auditLogs,
      users,
      invites,
    });
    const estimatedBytes = new TextEncoder().encode(payloadJson).length;

    return computeDatabaseCapacityReport({
      masterCount,
      transactionCount,
      logAndNotifCount,
      accountCount,
      estimatedBytes,
      projectId: FIREBASE_PROJECT_ID,
      firestoreDatabaseId: FIREBASE_DATABASE_ID,
    });
  }, [
    adjustments,
    adminSlot,
    auditLogs,
    categories,
    deliveries,
    incoming,
    invites,
    items,
    ledger,
    notifications,
    requests,
    suppliers,
    systemConfig,
    units,
    users,
  ]);

  if (!currentUser || currentUser.role !== 'OWNER') {
    return null;
  }

  const statusStyles =
    report.status === 'PADAT'
      ? {
          badge: 'bg-red-50 text-red-800 border-red-200',
          bar: 'bg-red-700',
          icon: AlertTriangle,
          iconColor: 'text-red-700',
        }
      : report.status === 'PERHATIAN'
        ? {
            badge: 'bg-amber-50 text-amber-800 border-amber-200',
            bar: 'bg-amber-600',
            icon: AlertTriangle,
            iconColor: 'text-amber-700',
          }
        : {
            badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            bar: 'bg-emerald-600',
            icon: CheckCircle2,
            iconColor: 'text-emerald-700',
          };

  const StatusIcon = statusStyles.icon;

  if (variant === 'compact') {
    return (
      <section
        aria-label="Indikator Kapasitas Database dan Kuota Firebase"
        className="bg-white border border-slate-200 rounded-xl p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Database className="w-4 h-4 text-slate-700 shrink-0" />
              <span>Kapasitas Database &amp; Referensi Kuota Firebase</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-md ${statusStyles.badge}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              {report.statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div>
              <span className="text-slate-500">Dokumen Aktif:</span>{' '}
              <span className="font-semibold text-slate-900 tabular-nums">
                {report.totalDocs.toLocaleString('id-ID')}
              </span>{' '}
              <span className="text-slate-400 tabular-nums">
                / {report.comfortableDocLimit.toLocaleString('id-ID')} ({report.browserLoadPercent}%)
              </span>
            </div>
            <div>
              <span className="text-slate-500">Estimasi Ukuran:</span>{' '}
              <span className="font-semibold text-slate-900 tabular-nums">
                {report.estimatedSizeLabel}
              </span>{' '}
              <span className="text-slate-400">/ 1 GB (Spark)</span>
            </div>
            <div>
              <span className="text-slate-500">Estimasi Buka/Refresh Harian:</span>{' '}
              <span className="font-semibold text-slate-900 tabular-nums">
                ±{report.estimatedMaxLoginsPerDaySpark.toLocaleString('id-ID')}×/hari
              </span>{' '}
              <span className="text-slate-400">(batas 50 rb read)</span>
            </div>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${statusStyles.bar}`}
              style={{ width: `${Math.max(report.totalDocs > 0 ? 2 : 0, report.browserLoadPercent)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveRoute('settings')}
            className="px-3 py-2 border border-slate-300 bg-white text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            Detail Kapasitas
          </button>
          {report.firebaseUsageUrl && (
            <a
              href={report.firebaseUsageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              Cek Kuota Firebase Console
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Monitor Kapasitas Database dan Kuota Firebase"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Database className="w-4 h-4 text-slate-800" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Monitor Kapasitas Database &amp; Referensi Kuota Firebase
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-md ${statusStyles.badge}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              {report.statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-600">{report.statusDescription}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {report.firebaseUsageUrl && (
            <a
              href={report.firebaseUsageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              Buka Grafik Kuota Resmi
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {report.firebaseUpgradeUrl && (
            <a
              href={report.firebaseUpgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Kelola Paket Firebase
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Browser & Active Document Load Bar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-700">
            Beban Dokumen Aktif di Aplikasi (Ambang Nyaman Browser)
          </span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {report.totalDocs.toLocaleString('id-ID')} / {report.comfortableDocLimit.toLocaleString('id-ID')} dokumen ({report.browserLoadPercent}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${statusStyles.bar}`}
            style={{ width: `${Math.max(report.totalDocs > 0 ? 2 : 0, report.browserLoadPercent)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          Ambang perhatian: {report.warningDocThreshold.toLocaleString('id-ID')} dokumen · Batas nyaman sinkronisasi langsung: {report.comfortableDocLimit.toLocaleString('id-ID')} dokumen.
        </p>
      </div>

      {/* Breakdown by Collection Group */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
          <div className="text-xs text-slate-500">Master Data</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {report.masterCount.toLocaleString('id-ID')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Barang, kategori, satuan, supplier</div>
        </div>
        <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
          <div className="text-xs text-slate-500">Transaksi &amp; Buku Stok</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {report.transactionCount.toLocaleString('id-ID')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Masuk, permintaan, keluar, opname, kartu stok</div>
        </div>
        <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
          <div className="text-xs text-slate-500">Audit Log &amp; Notifikasi</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {report.logAndNotifCount.toLocaleString('id-ID')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Jejak audit dan notifikasi aktif</div>
        </div>
        <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
          <div className="text-xs text-slate-500">Akun &amp; Konfigurasi</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {report.accountCount.toLocaleString('id-ID')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Pengguna, undangan, pengaturan</div>
        </div>
      </div>

      {/* Spark Tier Reference Estimates */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
          <div className="text-xs font-semibold text-slate-800">
            Estimasi Penyimpanan Database (Paket Gratis Spark: {report.sparkStorageLimitLabel})
          </div>
          <div className="text-lg font-display font-bold text-slate-900 tabular-nums">
            {report.estimatedSizeLabel}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({report.storagePercentOfSparkLimit}% dari 1 GB)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Dihitung dari total data JSON dokumen aktif yang tersimpan di Firestore saat ini.
          </p>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
          <div className="text-xs font-semibold text-slate-800">
            Estimasi Beban Baca Harian Tim (Spark: {report.sparkDailyReadLimit.toLocaleString('id-ID')} Read · {report.sparkDailyWriteLimit.toLocaleString('id-ID')} Write/hari)
          </div>
          <div className="text-lg font-display font-bold text-slate-900 tabular-nums">
            ±{report.estimatedReadsPerFullLogin.toLocaleString('id-ID')} read / login{' '}
            <span className="text-xs font-normal text-slate-500">
              (±{report.estimatedMaxLoginsPerDaySpark.toLocaleString('id-ID')}× buka/refresh per hari)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Setiap kali seluruh dokumen dimuat ulang (login baru atau refresh browser), sekitar {report.estimatedReadsPerFullLogin.toLocaleString('id-ID')} pembacaan terpakai.
          </p>
        </div>
      </div>

      {/* Honest Client-SDK Limitation Note */}
      <div className="flex items-start gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-slate-800">Catatan Transparansi:</span>{' '}
          Jumlah dokumen dan ukuran data di atas dihitung secara real-time dari database Anda. Namun Google Firebase tidak menyediakan akses dari browser untuk membaca penghitung kuota harian resmi gabungan seluruh perangkat (Owner, Admin, dan Produksi) — gunakan tombol{' '}
          <span className="font-medium text-slate-800">Buka Grafik Kuota Resmi</span> di atas untuk memantau penggunaan server harian di Firebase Console.
        </p>
      </div>
    </section>
  );
}
