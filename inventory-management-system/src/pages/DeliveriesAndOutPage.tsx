import React, { useMemo, useState } from 'react';
import { PackageCheck, Printer, X } from 'lucide-react';
import type { DeliveryRecord, StockRequest } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { exportDeliveryProofPdf } from '../utils/exports';
import { RequestStatusLabel } from '../components/StatusText';

export function DeliveriesPage() {
  const { items, requests, confirmStockDelivery, systemConfig } = useInventory();
  const [selectedReq, setSelectedReq] = useState<StockRequest | null>(null);
  const [deliverMap, setDeliverMap] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lastDelivery, setLastDelivery] = useState<DeliveryRecord | null>(null);

  const actionableRequests = useMemo(() => {
    return requests
      .filter((r) => ['DISETUJUI', 'SIAP_DIAMBIL', 'DALAM_PROSES_PENGAMBILAN'].includes(r.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [requests]);

  const openDeliverModal = (req: StockRequest) => {
    setSelectedReq(req);
    const map: Record<string, number> = {};
    req.items.forEach((l) => {
      const remaining = Math.max(0, l.approvedQty - l.deliveredQty);
      const stock = items.find((i) => i.id === l.itemId)?.currentStock ?? 0;
      map[l.itemId] = Math.min(remaining, stock);
    });
    setDeliverMap(map);
    setNotes('');
    setFeedback(null);
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setBusy(true);
    setFeedback(null);
    try {
      const del = await confirmStockDelivery({
        request: selectedReq,
        deliverQuantities: deliverMap,
        notes,
      });
      setLastDelivery(del);
      setSelectedReq(null);
      setFeedback({
        type: 'ok',
        text: `Penyerahan ${del.deliveryNumber} (${del.stockOutNumber}) berhasil dikonfirmasi. Stok gudang berkurang sesuai jumlah aktual.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memproses penyerahan.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg border text-sm flex flex-wrap items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.text}</span>
          <div className="flex items-center gap-2">
            {lastDelivery && feedback.type === 'ok' && (
              <button
                type="button"
                onClick={() =>
                  exportDeliveryProofPdf(lastDelivery, systemConfig?.companyName || 'INVENTORY MANAGEMENT SYSTEM')
                }
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-800 text-white text-xs font-medium rounded"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Bukti
              </button>
            )}
            <button type="button" aria-label="Tutup pesan" onClick={() => setFeedback(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-sm text-slate-600">
          Daftar permintaan yang sudah disetujui dan siap diserahkan (mendukung penyerahan sebagian / bertahap maupun penuh).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {actionableRequests.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada permintaan yang menunggu penyerahan barang saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">No. Permintaan</th>
                  <th className="px-4 py-3 font-medium">Pemohon</th>
                  <th className="px-4 py-3 font-medium">Progres Penyerahan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actionableRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {req.requestNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{req.requesterName}</div>
                      <div className="text-xs text-slate-500">{req.department}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 space-y-1">
                      {req.items.map((l) => {
                        const rem = Math.max(0, l.approvedQty - l.deliveredQty);
                        return (
                          <div key={l.itemId}>
                            {l.itemName}: Sudah diambil <span className="font-mono font-semibold">{l.deliveredQty}/{l.approvedQty}</span> {l.unitName} (Sisa: <span className="font-mono font-semibold">{rem}</span>)
                          </div>
                        );
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RequestStatusLabel status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openDeliverModal(req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900"
                      >
                        <PackageCheck className="w-4 h-4" />
                        Serahkan Barang
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Konfirmasi Penyerahan Aktual · {selectedReq.requestNumber}
              </h2>
              <button type="button" aria-label="Tutup modal penyerahan" onClick={() => setSelectedReq(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}

            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-left">Barang</th>
                    <th className="p-2.5 text-right">Stok Saat Ini</th>
                    <th className="p-2.5 text-right">Sisa Disetujui</th>
                    <th className="p-2.5 text-right">Serahkan Sekarang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReq.items.map((l) => {
                    const remaining = Math.max(0, l.approvedQty - l.deliveredQty);
                    const stock = items.find((i) => i.id === l.itemId)?.currentStock ?? 0;
                    return (
                      <tr key={l.itemId}>
                        <td className="p-2.5">
                          <div className="font-medium text-slate-900">{l.itemName}</div>
                          <div className="font-mono text-slate-500">{l.itemCode}</div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold">
                          {stock} {l.unitName}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {remaining} {l.unitName}
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            aria-label={`Jumlah diserahkan untuk ${l.itemName}`}
                            min={0}
                            value={deliverMap[l.itemId] ?? 0}
                            onChange={(e) =>
                              setDeliverMap((prev) => ({
                                ...prev,
                                [l.itemId]: Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-24 px-2 py-1.5 border border-slate-300 rounded font-mono text-right"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div>
                <label htmlFor="del-notes" className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Penyerahan / Surat Jalan
                </label>
                <input
                  id="del-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Penyerahan tahap 1 ke Line A"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setSelectedReq(null)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 disabled:opacity-50"
                >
                  {busy ? 'Memproses...' : 'Konfirmasi Penyerahan & Kurangi Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function OutgoingTransactionsPage() {
  const { deliveries, systemConfig } = useInventory();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...deliveries]
      .filter(
        (d) =>
          !q ||
          d.stockOutNumber.toLowerCase().includes(q) ||
          d.deliveryNumber.toLowerCase().includes(q) ||
          d.requestNumber.toLowerCase().includes(q) ||
          d.requesterName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [deliveries, search]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          aria-label="Cari transaksi barang keluar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari No. Keluar, Surat Jalan, atau Pemohon..."
          className="w-full max-w-sm px-3 py-2 text-sm border border-slate-300 rounded-lg"
        />
        <span className="text-xs text-slate-500 tabular-nums">
          Total {filtered.length} transaksi keluar
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada transaksi barang keluar tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">No. Barang Keluar</th>
                  <th className="px-4 py-3 font-medium">No. Penyerahan / Ref</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Penerima</th>
                  <th className="px-4 py-3 font-medium">Item Keluar</th>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium text-right">Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {d.stockOutNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {d.deliveryNumber} · {d.requestNumber}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 whitespace-nowrap">
                      {d.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{d.requesterName}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {d.items.map((l) => `${l.itemName} (${l.deliveredQty} ${l.unitName})`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{d.deliveredByName}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Cetak bukti ${d.stockOutNumber}`}
                        onClick={() =>
                          exportDeliveryProofPdf(d, systemConfig?.companyName || 'INVENTORY MANAGEMENT SYSTEM')
                        }
                        className="p-1.5 text-slate-600 hover:text-blue-700"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
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
