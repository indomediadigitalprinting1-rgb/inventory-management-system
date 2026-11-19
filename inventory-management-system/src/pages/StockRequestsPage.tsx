import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardPlus, Eye, Plus, Search, Trash2, X, XCircle } from 'lucide-react';
import { canApproveOrDeliver } from '../domain/rules';
import type { StockRequest } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { RequestStatusLabel } from '../components/StatusText';

export function StockRequestsPage() {
  const {
    currentUser,
    items,
    requests,
    deliveries,
    scannerDraftCart,
    clearScannerDraftCart,
    submitStockRequest,
    reviewRequest,
    cancelRequest,
    setActiveRoute,
  } = useInventory();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'DONE'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'review' | 'detail' | null>(null);
  const [selectedReq, setSelectedReq] = useState<StockRequest | null>(null);

  // Create Request State
  const [department, setDepartment] = useState(currentUser?.department || 'Produksi');
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<Array<{ itemId: string; requestedQty: number }>>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerItemId, setPickerItemId] = useState('');
  const [pickerQty, setPickerQty] = useState(1);

  // Review State
  const [approvedQtyMap, setApprovedQtyMap] = useState<Record<string, number>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-populate from barcode scanner draft cart if present
  useEffect(() => {
    if (scannerDraftCart.length > 0 && modalMode === null) {
      setDraftLines(scannerDraftCart.map((c) => ({ itemId: c.itemId, requestedQty: c.qty })));
      setModalMode('create');
    }
  }, [modalMode, scannerDraftCart]);

  if (!currentUser) return null;
  const isManager = canApproveOrDeliver(currentUser.role);

  const activeItems = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.active &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          i.barcode.toLowerCase().includes(q))
    );
  }, [items, pickerSearch]);

  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
        if (statusFilter === 'PENDING') return r.status === 'MENUNGGU_PERSETUJUAN';
        if (statusFilter === 'ACTIVE') return ['DISETUJUI', 'SIAP_DIAMBIL', 'DALAM_PROSES_PENGAMBILAN'].includes(r.status);
        if (statusFilter === 'DONE') return ['SELESAI', 'DITOLAK', 'DIBATALKAN'].includes(r.status);
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requests, statusFilter]);

  const openCreate = () => {
    setDepartment(currentUser.department || 'Produksi');
    setNotes('');
    if (scannerDraftCart.length > 0) {
      setDraftLines(scannerDraftCart.map((c) => ({ itemId: c.itemId, requestedQty: c.qty })));
    } else {
      setDraftLines([]);
    }
    setPickerItemId(activeItems[0]?.id ?? '');
    setPickerQty(1);
    setFeedback(null);
    setModalMode('create');
  };

  const addDraftLine = () => {
    const targetId = pickerItemId || activeItems[0]?.id;
    if (!targetId || pickerQty <= 0) return;
    setDraftLines((prev) => {
      const existing = prev.find((l) => l.itemId === targetId);
      if (existing) {
        return prev.map((l) => (l.itemId === targetId ? { ...l, requestedQty: l.requestedQty + pickerQty } : l));
      }
      return [...prev, { itemId: targetId, requestedQty: pickerQty }];
    });
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await submitStockRequest({ department, notes, items: draftLines });
      clearScannerDraftCart();
      setModalMode(null);
      setFeedback({ type: 'ok', text: 'Permintaan barang berhasil dikirim ke Admin Gudang.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membuat permintaan.' });
    } finally {
      setBusy(false);
    }
  };

  const openReview = (req: StockRequest) => {
    setSelectedReq(req);
    const map: Record<string, number> = {};
    req.items.forEach((l) => {
      map[l.itemId] = l.requestedQty;
    });
    setApprovedQtyMap(map);
    setRejectionReason('');
    setFeedback(null);
    setModalMode('review');
  };

  const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedReq) return;
    setBusy(true);
    setFeedback(null);
    try {
      await reviewRequest({
        request: selectedReq,
        decision,
        approvedQuantities: decision === 'APPROVE' ? approvedQtyMap : undefined,
        rejectionReason: decision === 'REJECT' ? rejectionReason : undefined,
      });
      setModalMode(null);
      setFeedback({
        type: 'ok',
        text:
          decision === 'APPROVE'
            ? `Permintaan ${selectedReq.requestNumber} disetujui dan masuk daftar penyerahan (stok belum dikurangi).`
            : `Permintaan ${selectedReq.requestNumber} ditolak.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memproses persetujuan.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (req: StockRequest) => {
    setBusy(true);
    try {
      await cancelRequest(req);
      setFeedback({ type: 'ok', text: `Permintaan ${req.requestNumber} dibatalkan.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membatalkan.' });
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
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'PENDING', label: 'Menunggu Persetujuan' },
            { id: 'ACTIVE', label: 'Siap / Proses Ambil' },
            { id: 'DONE', label: 'Selesai / Ditolak' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                statusFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveRoute('scanner')}
            className="px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            Scan Barcode
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
          >
            <ClipboardPlus className="w-4 h-4" />
            Buat Permintaan Barang
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada data permintaan barang pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">No. Permintaan</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Pemohon / Dept</th>
                  <th className="px-4 py-3 font-medium">Item &amp; Progres</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {req.requestNumber}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 whitespace-nowrap">
                      {req.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{req.requesterName}</div>
                      <div className="text-xs text-slate-500">{req.department}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {req.items
                        .map(
                          (l) =>
                            `${l.itemName} (Minta: ${l.requestedQty}, Setuju: ${l.approvedQty}, Ambil: ${l.deliveredQty} ${l.unitName})`
                        )
                        .join(' · ')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RequestStatusLabel status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Detail ${req.requestNumber}`}
                          onClick={() => {
                            setSelectedReq(req);
                            setModalMode('detail');
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isManager && req.status === 'MENUNGGU_PERSETUJUAN' && (
                          <button
                            type="button"
                            onClick={() => openReview(req)}
                            className="px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-800"
                          >
                            Tinjau / Setujui
                          </button>
                        )}
                        {isManager &&
                          ['DISETUJUI', 'SIAP_DIAMBIL', 'DALAM_PROSES_PENGAMBILAN'].includes(req.status) && (
                            <button
                              type="button"
                              onClick={() => setActiveRoute('deliveries')}
                              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800"
                            >
                              Proses Penyerahan
                            </button>
                          )}
                        {req.status === 'MENUNGGU_PERSETUJUAN' &&
                          (isManager || req.requesterUid === currentUser.uid) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleCancel(req)}
                              className="px-2.5 py-1.5 border border-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-50"
                            >
                              Batalkan
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

      {/* Create Request Modal */}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Ajukan Permintaan Pengambilan Barang
              </h2>
              <button
                type="button"
                aria-label="Tutup modal permintaan"
                onClick={() => {
                  clearScannerDraftCart();
                  setModalMode(null);
                }}
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-dept" className="block text-xs font-medium text-slate-700 mb-1">
                    Unit / Line Produksi
                  </label>
                  <input
                    id="req-dept"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="req-notes" className="block text-xs font-medium text-slate-700 mb-1">
                    Keterangan Kebutuhan
                  </label>
                  <input
                    id="req-notes"
                    required
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Perakitan Panel Batch #20"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Pilih Barang (Pencarian Manual)</span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      aria-label="Filter daftar barang"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Filter nama / kode..."
                      className="pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Pilih barang untuk diminta"
                    value={pickerItemId || activeItems[0]?.id || ''}
                    onChange={(e) => setPickerItemId(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {activeItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} - {i.name} (Stok: {i.currentStock} {i.unitName})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    aria-label="Jumlah diminta"
                    min={1}
                    value={pickerQty}
                    onChange={(e) => setPickerQty(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                  <button
                    type="button"
                    onClick={addDraftLine}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah
                  </button>
                </div>

                {draftLines.length > 0 && (
                  <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
                    {draftLines.map((line) => {
                      const master = items.find((i) => i.id === line.itemId);
                      if (!master) return null;
                      return (
                        <div key={line.itemId} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="font-medium text-slate-900">{master.name}</div>
                            <div className="font-mono text-slate-500">
                              {master.code} · Stok tersedia: {master.currentStock} {master.unitName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              aria-label={`Jumlah ${master.name}`}
                              min={1}
                              value={line.requestedQty}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((l) =>
                                    l.itemId === line.itemId
                                      ? { ...l, requestedQty: Math.max(1, Number(e.target.value)) }
                                      : l
                                  )
                                )
                              }
                              className="w-20 px-2 py-1 border border-slate-300 rounded font-mono text-right"
                            />
                            <span className="text-slate-600">{master.unitName}</span>
                            <button
                              type="button"
                              aria-label={`Hapus ${master.name}`}
                              onClick={() => setDraftLines((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                              className="text-red-700 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    clearScannerDraftCart();
                    setModalMode(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-sm rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy || draftLines.length === 0}
                  className="px-5 py-2 bg-red-800 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  Kirim Permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Approval Modal (Admin/Owner) */}
      {modalMode === 'review' && selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Tinjau Permintaan {selectedReq.requestNumber}
              </h2>
              <button type="button" aria-label="Tutup modal tinjauan" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>Pemohon: <span className="font-semibold text-slate-900">{selectedReq.requesterName}</span> ({selectedReq.department})</div>
              <div>Kebutuhan: {selectedReq.notes}</div>
            </div>

            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}

            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-left">Barang</th>
                  <th className="p-2.5 text-right">Stok Gudang</th>
                  <th className="p-2.5 text-right">Diminta</th>
                  <th className="p-2.5 text-right">Jumlah Disetujui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedReq.items.map((l) => {
                  const master = items.find((i) => i.id === l.itemId);
                  return (
                    <tr key={l.itemId}>
                      <td className="p-2.5">
                        <div className="font-medium text-slate-900">{l.itemName}</div>
                        <div className="font-mono text-slate-500">{l.itemCode}</div>
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {master?.currentStock ?? 0} {l.unitName}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {l.requestedQty} {l.unitName}
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          aria-label={`Jumlah disetujui untuk ${l.itemName}`}
                          min={0}
                          max={l.requestedQty}
                          value={approvedQtyMap[l.itemId] ?? l.requestedQty}
                          onChange={(e) =>
                            setApprovedQtyMap((prev) => ({
                              ...prev,
                              [l.itemId]: Math.max(0, Math.min(l.requestedQty, Number(e.target.value))),
                            }))
                          }
                          className="w-20 px-2 py-1 border border-slate-300 rounded font-mono text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="text-xs text-slate-500">
              Catatan: Persetujuan belum mengurangi stok gudang. Stok baru berkurang saat penyerahan aktual dikonfirmasi.
            </p>

            <div>
              <label htmlFor="reject-reason" className="block text-xs font-medium text-slate-700 mb-1">
                Alasan Penolakan (wajib diisi jika menolak)
              </label>
              <input
                id="reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Isi alasan jika permintaan ditolak..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDecision('REJECT')}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-800 text-xs font-medium rounded-lg hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Tolak Permintaan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDecision('APPROVE')}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800"
              >
                <CheckCircle2 className="w-4 h-4" />
                Setujui &amp; Siapkan Penyerahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modalMode === 'detail' && selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Detail Permintaan {selectedReq.requestNumber}
              </h2>
              <button type="button" aria-label="Tutup detail" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-slate-500">Pemohon:</span> {selectedReq.requesterName}</div>
              <div><span className="text-slate-500">Status:</span> <RequestStatusLabel status={selectedReq.status} /></div>
              <div><span className="text-slate-500">Disetujui Oleh:</span> {selectedReq.approvedByName || '-'}</div>
              <div><span className="text-slate-500">Alasan Tolak:</span> {selectedReq.rejectionReason || '-'}</div>
            </div>
            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-2 text-left">Barang</th>
                  <th className="p-2 text-right">Diminta</th>
                  <th className="p-2 text-right">Disetujui</th>
                  <th className="p-2 text-right">Sudah Diambil</th>
                  <th className="p-2 text-right">Sisa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedReq.items.map((l) => (
                  <tr key={l.itemId}>
                    <td className="p-2">{l.itemName}</td>
                    <td className="p-2 text-right font-mono">{l.requestedQty} {l.unitName}</td>
                    <td className="p-2 text-right font-mono">{l.approvedQty}</td>
                    <td className="p-2 text-right font-mono">{l.deliveredQty}</td>
                    <td className="p-2 text-right font-mono font-semibold">{Math.max(0, l.approvedQty - l.deliveredQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Riwayat Penyerahan Bertahap</div>
              {deliveries.filter((d) => d.requestId === selectedReq.id).length === 0 ? (
                <div className="text-xs text-slate-500">Belum ada penyerahan fisik.</div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {deliveries
                    .filter((d) => d.requestId === selectedReq.id)
                    .map((d) => (
                      <div key={d.id} className="p-2.5 text-xs flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono font-semibold">{d.deliveryNumber} · {d.stockOutNumber}</div>
                          <div className="text-slate-600">
                            {d.items.map((x) => `${x.itemName}: ${x.deliveredQty} ${x.unitName}`).join(', ')}
                          </div>
                        </div>
                        <span className="text-slate-500 tabular-nums">{d.createdAt.slice(0, 10)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
