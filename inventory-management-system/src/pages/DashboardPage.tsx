import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, DatabaseZap } from 'lucide-react';
import { computeDashboardMetrics, computeStockFlowSeries } from '../domain/rules';
import { useInventory } from '../services/inventoryContext';
import { RequestStatusLabel, StockHealthLabel } from '../components/StatusText';

export function DashboardPage() {
  const {
    currentUser,
    items,
    categories,
    ledger,
    requests,
    deliveries,
    auditLogs,
    setActiveRoute,
    seedStarterMasters,
    isSandbox,
  } = useInventory();

  if (!currentUser) return null;

  const today = new Date().toISOString().slice(0, 10);
  const metrics = computeDashboardMetrics({
    items,
    ledger,
    requests,
    deliveries,
    currentUid: currentUser.uid,
    todayDate: today,
  });

  const flowSeries = computeStockFlowSeries(ledger, 14);
  const lowOrOutItems = items
    .filter((i) => i.active && i.currentStock <= i.minStock)
    .slice(0, 6);
  const latestLedger = [...ledger]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7);

  if (currentUser.role === 'PRODUKSI') {
    const myRequests = requests
      .filter((r) => r.requesterUid === currentUser.uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const kpis = [
      { label: 'Total Permintaan', value: metrics.myTotalRequests },
      { label: 'Menunggu Persetujuan', value: metrics.myPendingRequests },
      { label: 'Disetujui / Selesai', value: metrics.myApprovedRequests },
      { label: 'Ditolak', value: metrics.myRejectedRequests },
      { label: 'Dalam Proses Pengambilan', value: metrics.myInProgressRequests },
      { label: 'Total Barang Diambil', value: metrics.myTotalPickedUpUnits },
    ];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Ringkasan Operasional Produksi
            </h2>
            <p className="text-sm text-slate-600">
              Pantau pengajuan material dan status penyerahan dari gudang.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveRoute('scanner')}
              className="px-4 py-2 border border-slate-300 bg-white text-slate-800 text-sm font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Scan Barcode
            </button>
            <button
              type="button"
              onClick={() => setActiveRoute('requests')}
              className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
            >
              Buat Permintaan Baru
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">{k.label}</div>
              <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {k.value.toLocaleString('id-ID')}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Riwayat Permintaan Saya
            </h3>
            <button
              type="button"
              onClick={() => setActiveRoute('history')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-800 hover:underline whitespace-nowrap"
            >
              Lihat Semua
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {myRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada permintaan pengambilan barang. Klik &ldquo;Buat Permintaan Baru&rdquo; untuk memulai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">No. Permintaan</th>
                    <th className="px-4 py-3 font-medium">Tanggal</th>
                    <th className="px-4 py-3 font-medium">Item Diminta</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRequests.slice(0, 8).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                        {r.requestNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                        {r.createdAt.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.items
                          .map((l) => `${l.itemName} (${l.deliveredQty}/${l.approvedQty || l.requestedQty} ${l.unitName})`)
                          .join(' · ')}
                      </td>
                      <td className="px-4 py-3">
                        <RequestStatusLabel status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // OWNER & ADMIN Dashboards
  const ownerAdminCards =
    currentUser.role === 'OWNER'
      ? [
          { label: 'Total Barang', value: metrics.totalItems },
          { label: 'Total Unit Stok', value: metrics.totalStockUnits },
          { label: 'Stok Minimum', value: metrics.lowStockCount },
          { label: 'Stok Habis', value: metrics.outOfStockCount },
          { label: 'Total Barang Masuk', value: metrics.totalIncomingQty },
          { label: 'Total Barang Keluar', value: metrics.totalOutgoingQty },
          { label: 'Permintaan Menunggu', value: metrics.pendingRequestsCount },
        ]
      : [
          { label: 'Total Barang', value: metrics.totalItems },
          { label: 'Total Unit Stok', value: metrics.totalStockUnits },
          { label: 'Permintaan Baru', value: metrics.pendingRequestsCount },
          { label: 'Harus Diproses', value: metrics.readyOrInProgressRequestsCount },
          { label: 'Masuk Hari Ini', value: metrics.todayIncomingCount },
          { label: 'Keluar Hari Ini', value: metrics.todayOutgoingCount },
          { label: 'Stok Minimum/Habis', value: metrics.lowStockCount + metrics.outOfStockCount },
        ];

  return (
    <div className="space-y-6">
      {currentUser.role === 'OWNER' && !isSandbox && categories.length === 0 && items.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Siapkan Data Master Awal
            </h2>
            <p className="text-sm text-slate-600">
              Database masih kosong. Anda dapat langsung mengisi kategori, satuan, dan supplier standar atau menambahkannya secara manual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void seedStarterMasters()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
          >
            <DatabaseZap className="w-4 h-4" />
            Isi Master Awal
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {ownerAdminCards.map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {card.value.toLocaleString('id-ID')}
            </div>
          </div>
        ))}
      </div>

      {/* Main Analytics Row */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Grafik Barang Masuk &amp; Keluar
              </h2>
              <p className="text-xs text-slate-500">
                Pergerakan kuantitas unit berdasarkan tanggal transaksi tercatat
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRoute('reports')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              Buka Laporan Lengkap
            </button>
          </div>
          <div className="h-72 w-full">
            {flowSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Belum ada mutasi stok untuk ditampilkan.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flowSeries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="masuk" name="Barang Masuk" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="keluar" name="Barang Keluar" fill="#991b1b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Low Stock Alert List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Peringatan Stok Minimum
            </h2>
            <button
              type="button"
              onClick={() => setActiveRoute('items')}
              className="text-xs font-medium text-red-800 hover:underline whitespace-nowrap"
            >
              Master Barang
            </button>
          </div>
          <div className="flex-1 divide-y divide-slate-100 mt-1">
            {lowOrOutItems.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Semua stok barang berada di atas batas minimum.
              </div>
            ) : (
              lowOrOutItems.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {item.code} · Min {item.minStock} {item.unitName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {item.currentStock} {item.unitName}
                    </div>
                    <StockHealthLabel current={item.currentStock} min={item.minStock} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tables: Recent Transactions & (Owner) User Activity */}
      <div className={`grid gap-6 ${currentUser.role === 'OWNER' ? 'lg:grid-cols-12' : ''}`}>
        <div className={`${currentUser.role === 'OWNER' ? 'lg:col-span-7' : ''} bg-white border border-slate-200 rounded-xl overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Transaksi Stok Terbaru
            </h2>
            <button
              type="button"
              onClick={() => setActiveRoute('history')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Riwayat Lengkap
            </button>
          </div>
          {latestLedger.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Belum ada transaksi tercatat.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">No. Transaksi</th>
                    <th className="px-4 py-2.5 font-medium">Barang</th>
                    <th className="px-4 py-2.5 font-medium">Jenis</th>
                    <th className="px-4 py-2.5 font-medium text-right">Mutasi</th>
                    <th className="px-4 py-2.5 font-medium text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {latestLedger.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-900 whitespace-nowrap">{l.txNumber}</td>
                      <td className="px-4 py-2.5 text-slate-700">{l.itemName}</td>
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{l.txType}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {l.qtyIn > 0 ? (
                          <span className="text-emerald-700">+{l.qtyIn}</span>
                        ) : (
                          <span className="text-red-700">-{l.qtyOut}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {l.balanceAfter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {currentUser.role === 'OWNER' && (
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Aktivitas Pengguna Terbaru
              </h2>
              <button
                type="button"
                onClick={() => setActiveRoute('audit-logs')}
                className="text-xs font-medium text-red-800 hover:underline"
              >
                Audit Log
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">Belum ada catatan aktivitas.</div>
              ) : (
                auditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="px-5 py-3 space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {log.actorName} · {log.actorRole}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {log.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{log.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
