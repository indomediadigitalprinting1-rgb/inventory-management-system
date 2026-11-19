import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { buildReportData } from '../domain/reports';
import type { LedgerTxType, ReportType } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { exportTableToExcel, exportTableToPdf } from '../utils/exports';

const REPORT_OPTIONS: Array<{ id: ReportType; label: string }> = [
  { id: 'STOK', label: '1. Laporan Stok' },
  { id: 'STOK_MINIMUM', label: '2. Laporan Stok Minimum' },
  { id: 'STOK_HABIS', label: '3. Laporan Stok Habis' },
  { id: 'BARANG_MASUK', label: '4. Laporan Barang Masuk' },
  { id: 'BARANG_KELUAR', label: '5. Laporan Barang Keluar' },
  { id: 'PENGGUNAAN_PRODUKSI', label: '6. Penggunaan Bahan Produksi' },
  { id: 'TRANSAKSI_PENGGUNA', label: '7. Transaksi Per Pengguna' },
  { id: 'PERIODE', label: '8. Laporan Per Periode' },
  { id: 'KARTU_STOK', label: '9. Kartu Stok Setiap Barang' },
  { id: 'PERMINTAAN_BARANG', label: '10. Laporan Permintaan Barang' },
];

export function ReportsPage() {
  const { items, categories, users, incoming, deliveries, requests, ledger, systemConfig } =
    useInventory();

  const [reportType, setReportType] = useState<ReportType>('STOK');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemId, setItemId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [userId, setUserId] = useState('');
  const [txType, setTxType] = useState<LedgerTxType | 'ALL'>('ALL');

  const reportData = useMemo(() => {
    return buildReportData({
      filter: {
        reportType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        itemId: itemId || undefined,
        categoryName: categoryName || undefined,
        userId: userId || undefined,
        txType,
      },
      items,
      incoming,
      deliveries,
      requests,
      ledger,
    });
  }, [categoryName, deliveries, endDate, incoming, itemId, ledger, reportType, requests, startDate, txType, userId]);

  return (
    <div className="space-y-5">
      {/* Report Type Selector & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="rep-type" className="block text-xs font-medium text-slate-600 mb-1">
              Jenis Laporan
            </label>
            <select
              id="rep-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg bg-white"
            >
              {REPORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rep-start" className="block text-xs font-medium text-slate-600 mb-1">
              Tanggal Mulai
            </label>
            <input
              id="rep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="rep-end" className="block text-xs font-medium text-slate-600 mb-1">
              Tanggal Akhir
            </label>
            <input
              id="rep-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="rep-item" className="block text-xs font-medium text-slate-600 mb-1">
              Filter Barang
            </label>
            <select
              id="rep-item"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Semua Barang</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rep-cat" className="block text-xs font-medium text-slate-600 mb-1">
              Filter Kategori
            </label>
            <select
              id="rep-cat"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rep-user" className="block text-xs font-medium text-slate-600 mb-1">
                Pengguna
              </label>
              <select
                id="rep-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Semua</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rep-tx" className="block text-xs font-medium text-slate-600 mb-1">
                Jenis Mutasi
              </label>
              <select
                id="rep-tx"
                value={txType}
                onChange={(e) => setTxType(e.target.value as LedgerTxType | 'ALL')}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">Semua</option>
                <option value="MASUK">MASUK</option>
                <option value="KELUAR">KELUAR</option>
                <option value="PENYESUAIAN">PENYESUAIAN</option>
                <option value="PEMBALIK">PEMBALIK</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">{reportData.title}</h2>
            <p className="text-xs text-slate-500">{reportData.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportTableToExcel(
                  `laporan-${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
                  reportData.title,
                  reportData.columns,
                  reportData.rows
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() =>
                exportTableToPdf(
                  `laporan-${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
                  reportData.title,
                  reportData.subtitle,
                  reportData.columns,
                  reportData.rows,
                  systemConfig?.companyName
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Report Output Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {reportData.rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada data laporan yang sesuai dengan filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  {reportData.columns.map((col) => (
                    <th key={col} className="px-4 py-3 font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-4 py-3 text-slate-700 ${
                          typeof cell === 'number' ? 'font-mono tabular-nums' : ''
                        }`}
                      >
                        {typeof cell === 'number' ? cell.toLocaleString('id-ID') : cell}
                      </td>
                    ))}
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
