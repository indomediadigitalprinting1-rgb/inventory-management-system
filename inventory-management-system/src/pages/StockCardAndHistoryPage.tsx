import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { LedgerTxType } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { exportTableToExcel, exportTableToPdf } from '../utils/exports';
import { RequestStatusLabel } from '../components/StatusText';

export function StockCardPage() {
  const { items, ledger, systemConfig } = useInventory();
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? 'ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [txType, setTxType] = useState<LedgerTxType | 'ALL'>('ALL');

  const activeItem = items.find((i) => i.id === selectedItemId) ?? items[0];

  const rows = useMemo(() => {
    const targetId = selectedItemId === 'ALL' ? undefined : activeItem?.id;
    return [...ledger]
      .filter((l) => {
        if (targetId && l.itemId !== targetId) return false;
        if (startDate && l.date < startDate) return false;
        if (endDate && l.date > endDate) return false;
        if (txType !== 'ALL' && l.txType !== txType) return false;
        return true;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [activeItem?.id, endDate, ledger, selectedItemId, startDate, txType]);

  const handleExport = (kind: 'excel' | 'pdf') => {
    const cols = ['Tanggal', 'No. Transaksi', 'Jenis', 'Kode', 'Barang', 'Masuk', 'Keluar', 'Saldo', 'Keterangan', 'Pengguna'];
    const dataRows = rows.map((r) => [
      r.date,
      r.txNumber,
      r.txType,
      r.itemCode,
      r.itemName,
      r.qtyIn,
      r.qtyOut,
      r.balanceAfter,
      r.notes,
      r.userName,
    ]);
    if (kind === 'excel') {
      exportTableToExcel(`kartu-stok-${activeItem?.code || 'semua'}`, 'Kartu Stok', cols, dataRows);
    } else {
      exportTableToPdf(
        `kartu-stok-${activeItem?.code || 'semua'}`,
        `Kartu Stok: ${selectedItemId === 'ALL' ? 'Semua Barang' : activeItem?.name || ''}`,
        `${rows.length} mutasi tercatat`,
        cols,
        dataRows,
        systemConfig?.companyName
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label htmlFor="sc-item" className="block text-xs font-medium text-slate-600 mb-1">Barang</label>
            <select
              id="sc-item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Semua Barang</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} - {i.name} (Saldo: {i.currentStock} {i.unitName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sc-start" className="block text-xs font-medium text-slate-600 mb-1">Dari Tanggal</label>
            <input id="sc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label htmlFor="sc-end" className="block text-xs font-medium text-slate-600 mb-1">Sampai Tanggal</label>
            <input id="sc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label htmlFor="sc-type" className="block text-xs font-medium text-slate-600 mb-1">Jenis Transaksi</label>
            <select
              id="sc-type"
              value={txType}
              onChange={(e) => setTxType(e.target.value as LedgerTxType | 'ALL')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="MASUK">MASUK</option>
              <option value="KELUAR">KELUAR</option>
              <option value="PENYESUAIAN">PENYESUAIAN</option>
              <option value="PEMBALIK">PEMBALIK</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {selectedItemId !== 'ALL' && activeItem ? (
            <div className="text-xs text-slate-600">
              Stok Awal: <span className="font-mono font-semibold text-slate-900">{activeItem.initialStock}</span> · Stok Saat Ini:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {activeItem.currentStock} {activeItem.unitName}
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-600">Menampilkan kartu stok gabungan ({rows.length} baris)</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada catatan mutasi kartu stok untuk filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">No. Transaksi</th>
                  <th className="px-4 py-3 font-medium">Jenis</th>
                  <th className="px-4 py-3 font-medium">Barang</th>
                  <th className="px-4 py-3 font-medium text-right">Masuk</th>
                  <th className="px-4 py-3 font-medium text-right">Keluar</th>
                  <th className="px-4 py-3 font-medium text-right">Saldo</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium">Pengguna</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 tabular-nums text-slate-600 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{r.txNumber}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{r.txType}</td>
                    <td className="px-4 py-3 text-slate-800">{r.itemName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                      {r.qtyIn > 0 ? `+${r.qtyIn}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-red-700">
                      {r.qtyOut > 0 ? `-${r.qtyOut}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {r.balanceAfter} {r.unitName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{r.notes}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{r.userName}</td>
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

export function HistoryPage() {
  const { currentUser, ledger, requests, deliveries } = useInventory();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<LedgerTxType | 'ALL'>('ALL');

  if (!currentUser) return null;

  // PRODUKSI sees personal request & pickup history
  if (currentUser.role === 'PRODUKSI') {
    const myRequests = [...requests]
      .filter(
        (r) =>
          !search.trim() ||
          r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
          r.items.some((i) => i.itemName.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <input
            type="search"
            aria-label="Cari riwayat permintaan"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari No. Permintaan atau Nama Barang..."
            className="w-full max-w-sm px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <span className="text-xs text-slate-500">Riwayat Permintaan &amp; Pengambilan Saya</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {myRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Belum ada riwayat permintaan.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myRequests.map((req) => {
                const reqDeliveries = deliveries.filter((d) => d.requestId === req.id);
                return (
                  <div key={req.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="font-mono text-sm font-bold text-slate-900">{req.requestNumber}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="text-xs text-slate-500 tabular-nums">{req.createdAt.slice(0, 10)}</span>
                      </div>
                      <RequestStatusLabel status={req.status} />
                    </div>
                    <p className="text-xs text-slate-600">{req.notes}</p>
                    <div className="text-xs text-slate-700 space-y-1">
                      {req.items.map((l) => (
                        <div key={l.itemId}>
                          {l.itemName}: Diminta <span className="font-mono">{l.requestedQty}</span> · Disetujui{' '}
                          <span className="font-mono">{l.approvedQty}</span> · Diambil{' '}
                          <span className="font-mono font-semibold">{l.deliveredQty} {l.unitName}</span>
                        </div>
                      ))}
                    </div>
                    {reqDeliveries.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                        <div className="font-semibold text-slate-700">Catatan Pengambilan:</div>
                        {reqDeliveries.map((d) => (
                          <div key={d.id}>
                            <span className="font-mono">{d.deliveryNumber}</span> ({d.createdAt.slice(0, 10)}):{' '}
                            {d.items.map((x) => `${x.itemName} ${x.deliveredQty} ${x.unitName}`).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // OWNER & ADMIN see permanent immutable transaction history
  const rows = [...ledger]
    .filter((l) => {
      if (typeFilter !== 'ALL' && l.txType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          l.txNumber.toLowerCase().includes(q) ||
          l.itemName.toLowerCase().includes(q) ||
          l.itemCode.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <input
            type="search"
            aria-label="Cari riwayat transaksi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari No. Transaksi, Barang, atau Pengguna..."
            className="w-full max-w-sm px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <select
            aria-label="Filter jenis transaksi"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as LedgerTxType | 'ALL')}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">Semua Jenis</option>
            <option value="MASUK">MASUK</option>
            <option value="KELUAR">KELUAR</option>
            <option value="PENYESUAIAN">PENYESUAIAN</option>
            <option value="PEMBALIK">PEMBALIK</option>
          </select>
        </div>
        <span className="text-xs text-slate-500">Histori Permanen (Tidak Dapat Dihapus)</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Belum ada histori transaksi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">No. Transaksi</th>
                  <th className="px-4 py-3 font-medium">Jenis</th>
                  <th className="px-4 py-3 font-medium">Barang</th>
                  <th className="px-4 py-3 font-medium text-right">Masuk</th>
                  <th className="px-4 py-3 font-medium text-right">Keluar</th>
                  <th className="px-4 py-3 font-medium text-right">Saldo Akhir</th>
                  <th className="px-4 py-3 font-medium">Pengguna</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {r.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{r.txNumber}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{r.txType}</td>
                    <td className="px-4 py-3 text-slate-800">{r.itemName}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                      {r.qtyIn > 0 ? `+${r.qtyIn}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-red-700">
                      {r.qtyOut > 0 ? `-${r.qtyOut}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {r.balanceAfter} {r.unitName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{r.userName}</td>
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
