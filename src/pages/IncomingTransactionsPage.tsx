import React, { useMemo, useState } from 'react';
import { CheckCircle2, Edit3, Eye, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import type { IncomingLineItem, IncomingTransaction } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { exportIncomingProofPdf } from '../utils/exports';
import { IncomingStatusLabel } from '../components/StatusText';

export function IncomingTransactionsPage() {
  const {
    items,
    suppliers,
    incoming,
    saveIncomingDraft,
    confirmIncomingTransaction,
    reverseIncomingTransaction,
    systemConfig,
  } = useInventory();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'CONFIRMED' | 'REVERSED'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalMode, setModalMode] = useState<'form' | 'detail' | 'reverse' | null>(null);
  const [selectedTx, setSelectedTx] = useState<IncomingTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Draft form state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<IncomingLineItem[]>([]);
  const [pickerItemId, setPickerItemId] = useState('');
  const [pickerQty, setPickerQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return incoming
      .filter((tx) => statusFilter === 'ALL' || tx.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [incoming, statusFilter]);

  const openNewDraft = () => {
    setEditingId(undefined);
    setDate(new Date().toISOString().slice(0, 10));
    setSupplierId(suppliers[0]?.id ?? '');
    setNotes('');
    setLines([]);
    setPickerItemId(items[0]?.id ?? '');
    setPickerQty(1);
    setFeedback(null);
    setModalMode('form');
  };

  const openEditDraft = (tx: IncomingTransaction) => {
    setEditingId(tx.id);
    setDate(tx.date);
    setSupplierId(tx.supplierId);
    setNotes(tx.notes);
    setLines(tx.items);
    setPickerItemId(items[0]?.id ?? '');
    setPickerQty(1);
    setFeedback(null);
    setModalMode('form');
  };

  const addLineItem = () => {
    const master = items.find((i) => i.id === pickerItemId);
    if (!master || pickerQty <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === master.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === master.id
            ? { ...l, qty: l.qty + pickerQty, subtotal: (l.qty + pickerQty) * l.price }
            : l
        );
      }
      return [
        ...prev,
        {
          itemId: master.id,
          itemCode: master.code,
          itemName: master.name,
          unitName: master.unitName,
          qty: pickerQty,
          price: master.purchasePrice,
          subtotal: pickerQty * master.purchasePrice,
        },
      ];
    });
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await saveIncomingDraft({ id: editingId, date, supplierId, items: lines, notes });
      setModalMode(null);
      setFeedback({ type: 'ok', text: `Draft ${saved.txNumber} tersimpan. Konfirmasikan untuk menambah stok.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan draft.' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (tx: IncomingTransaction) => {
    setBusy(true);
    setFeedback(null);
    try {
      await confirmIncomingTransaction(tx);
      setFeedback({ type: 'ok', text: `Transaksi ${tx.txNumber} dikonfirmasi dan stok otomatis bertambah.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mengonfirmasi transaksi.' });
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;
    setBusy(true);
    setFeedback(null);
    try {
      await reverseIncomingTransaction(selectedTx, reversalReason);
      setModalMode(null);
      setReversalReason('');
      setFeedback({ type: 'ok', text: `Transaksi pembalik untuk ${selectedTx.txNumber} berhasil dicatat.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membalik transaksi.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" aria-label="Tutup pesan" onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['ALL', 'DRAFT', 'CONFIRMED', 'REVERSED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {s === 'ALL' ? 'Semua' : s === 'DRAFT' ? 'Draft' : s === 'CONFIRMED' ? 'Dikonfirmasi' : 'Dibalik'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openNewDraft}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Buat Barang Masuk
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada transaksi barang masuk.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">No. Transaksi</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Daftar Barang</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {tx.txNumber}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3 text-slate-700">{tx.supplierName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {tx.items.map((l) => `${l.itemName} (${l.qty} ${l.unitName})`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-900">
                      Rp {tx.totalAmount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <IncomingStatusLabel status={tx.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Detail ${tx.txNumber}`}
                          onClick={() => {
                            setSelectedTx(tx);
                            setModalMode('detail');
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Cetak bukti ${tx.txNumber}`}
                          onClick={() => exportIncomingProofPdf(tx, systemConfig?.companyName || 'INVENTORY MANAGEMENT SYSTEM')}
                          className="p-1.5 text-slate-600 hover:text-blue-700 rounded"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {tx.status === 'DRAFT' && (
                          <>
                            <button
                              type="button"
                              aria-label={`Edit draft ${tx.txNumber}`}
                              onClick={() => openEditDraft(tx)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleConfirm(tx)}
                              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white text-xs font-medium rounded hover:bg-emerald-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Konfirmasi
                            </button>
                          </>
                        )}
                        {tx.status === 'CONFIRMED' && !tx.reversalOfId && (
                          <button
                            type="button"
                            aria-label={`Balik transaksi ${tx.txNumber}`}
                            onClick={() => {
                              setSelectedTx(tx);
                              setReversalReason('');
                              setModalMode('reverse');
                            }}
                            className="p-1.5 text-slate-600 hover:text-red-700 rounded"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Draft Modal */}
      {modalMode === 'form' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingId ? 'Edit Draft Barang Masuk' : 'Transaksi Barang Masuk Baru'}
              </h2>
              <button type="button" aria-label="Tutup form" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}

            <form onSubmit={handleSaveDraft} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="in-date" className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                  <input id="in-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label htmlFor="in-sup" className="block text-xs font-medium text-slate-700 mb-1">Supplier</label>
                  <select id="in-sup" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="text-xs font-semibold text-slate-700">Tambah Barang ke Daftar</div>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Pilih barang masuk"
                    value={pickerItemId}
                    onChange={(e) => setPickerItemId(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} - {i.name} ({i.unitName})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    aria-label="Jumlah barang masuk"
                    min={1}
                    value={pickerQty}
                    onChange={(e) => setPickerQty(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800"
                  >
                    Tambah
                  </button>
                </div>

                {lines.length > 0 && (
                  <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
                    {lines.map((line) => (
                      <div key={line.itemId} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-medium text-slate-900">{line.itemName}</div>
                          <div className="font-mono text-slate-500">
                            {line.qty} {line.unitName} × Rp {line.price.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold">Rp {line.subtotal.toLocaleString('id-ID')}</span>
                          <button
                            type="button"
                            aria-label={`Hapus ${line.itemName}`}
                            onClick={() => setLines((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                            className="text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="in-notes" className="block text-xs font-medium text-slate-700 mb-1">Keterangan / No. PO</label>
                <input id="in-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" disabled={busy || lines.length === 0} className="px-5 py-2 bg-red-800 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  Simpan Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modalMode === 'detail' && selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Detail {selectedTx.txNumber}
              </h2>
              <button type="button" aria-label="Tutup detail" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Tanggal:</span> {selectedTx.date}</div>
              <div><span className="text-slate-500">Supplier:</span> {selectedTx.supplierName}</div>
              <div><span className="text-slate-500">Dibuat oleh:</span> {selectedTx.createdByName}</div>
              <div><span className="text-slate-500">Dikonfirmasi:</span> {selectedTx.confirmedByName || '-'}</div>
              <div className="col-span-2"><span className="text-slate-500">Keterangan:</span> {selectedTx.notes || '-'}</div>
            </div>
            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-2 text-left">Barang</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Harga</th>
                  <th className="p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedTx.items.map((l) => (
                  <tr key={l.itemId}>
                    <td className="p-2">{l.itemName}</td>
                    <td className="p-2 text-right font-mono">{l.qty} {l.unitName}</td>
                    <td className="p-2 text-right font-mono">Rp {l.price.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right font-mono">Rp {l.subtotal.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm font-bold font-mono">
                Total: Rp {selectedTx.totalAmount.toLocaleString('id-ID')}
              </div>
              <button
                type="button"
                onClick={() => exportIncomingProofPdf(selectedTx, systemConfig?.companyName || 'INVENTORY MANAGEMENT SYSTEM')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-lg"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Bukti PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {modalMode === 'reverse' && selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Transaksi Pembalik ({selectedTx.txNumber})
              </h2>
              <button type="button" aria-label="Tutup modal pembalik" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Transaksi yang sudah dikonfirmasi tidak dapat diubah langsung. Sistem akan membuat transaksi pembalik permanen dan mengurangi stok sebesar jumlah transaksi asal.
            </p>
            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}
            <form onSubmit={handleReverse} className="space-y-3">
              <div>
                <label htmlFor="rev-reason" className="block text-xs font-medium text-slate-700 mb-1">
                  Alasan Pembalikan
                </label>
                <input
                  id="rev-reason"
                  required
                  minLength={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Contoh: Kesalahan surat jalan supplier"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">
                  Proses Pembalik
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
