import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Edit3,
  Eye,
  Plus,
  Printer,
  RotateCcw,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  findMasterItemByBarcodeOrCode,
  searchMasterItemsForPicker,
  upsertIncomingLineItem,
} from '../domain/rules';
import type { IncomingLineItem, IncomingTransaction, InventoryItem } from '../domain/types';
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

  // Barcode scanner & live master lookup state
  const [scanQuery, setScanQuery] = useState('');
  const [autoAddOnScan, setAutoAddOnScan] = useState(true);
  const [scanStatus, setScanStatus] = useState<{
    type: 'ok' | 'info' | 'err';
    text: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCameraScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const autoAddRef = useRef(autoAddOnScan);
  autoAddRef.current = autoAddOnScan;
  const pickerQtyRef = useRef(pickerQty);
  pickerQtyRef.current = pickerQty;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (modalMode !== 'form') {
      stopCamera();
    }
  }, [modalMode, stopCamera]);

  const filtered = useMemo(() => {
    return incoming
      .filter((tx) => statusFilter === 'ALL' || tx.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [incoming, statusFilter]);

  const scanSuggestions = useMemo(
    () => searchMasterItemsForPicker(items, scanQuery, 5),
    [items, scanQuery]
  );

  const resetScannerState = () => {
    stopCamera();
    setScanQuery('');
    setScanStatus(null);
    setCameraError(null);
    lastCameraScanRef.current = { code: '', ts: 0 };
  };

  const openNewDraft = () => {
    setEditingId(undefined);
    setDate(new Date().toISOString().slice(0, 10));
    setSupplierId(suppliers[0]?.id ?? '');
    setNotes('');
    setLines([]);
    setPickerItemId(items[0]?.id ?? '');
    setPickerQty(1);
    setFeedback(null);
    resetScannerState();
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
    resetScannerState();
    setModalMode('form');
  };

  const addMasterItemToLines = useCallback((master: InventoryItem, qty: number) => {
    const validQty = Math.max(1, Math.floor(qty));
    setLines((prev) => upsertIncomingLineItem(prev, master, validQty));
  }, []);

  const applyMatchedMasterItem = useCallback(
    (found: InventoryItem, viaCamera = false) => {
      setPickerItemId(found.id);
      if (autoAddRef.current) {
        const addCount = Math.max(1, Math.floor(pickerQtyRef.current || 1));
        addMasterItemToLines(found, addCount);
        setScanQuery('');
        setScanStatus({
          type: 'ok',
          text: `${viaCamera ? 'Kamera scan' : 'Barcode ditemukan'}: ${found.name} (${found.code} · ${found.barcode}) — +${addCount} ${found.unitName} ditambahkan ke daftar.`,
        });
      } else {
        setScanQuery('');
        setScanStatus({
          type: 'info',
          text: `Ditemukan di Master Barang: ${found.name} (${found.code} · ${found.barcode}, stok saat ini ${found.currentStock} ${found.unitName}). Atur jumlah lalu klik Tambah.`,
        });
        setTimeout(() => qtyInputRef.current?.focus(), 40);
      }
    },
    [addMasterItemToLines]
  );

  const handleScanLookup = useCallback(
    (rawOverride?: string) => {
      const targetCode = (rawOverride ?? scanQuery).trim();
      if (!targetCode) return;

      const found = findMasterItemByBarcodeOrCode(items, targetCode);
      if (found) {
        applyMatchedMasterItem(found, false);
      } else {
        setScanStatus({
          type: 'err',
          text: `Barcode atau kode "${targetCode}" tidak ditemukan di Master Data Barang.`,
        });
      }
    },
    [applyMatchedMasterItem, items, scanQuery]
  );

  const applyMatchedRef = useRef(applyMatchedMasterItem);
  applyMatchedRef.current = applyMatchedMasterItem;

  useEffect(() => {
    if (!cameraActive || modalMode !== 'form') {
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    const startStream = async () => {
      const videoEl = videoRef.current;
      if (!videoEl) {
        setCameraActive(false);
        setCameraError('Elemen video kamera belum siap. Silakan coba klik Buka Kamera kembali.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false);
        setCameraError(
          'Kamera tidak tersedia pada browser ini atau halaman belum diakses melalui HTTPS. Gunakan input Scanner USB / ketik barcode.'
        );
        return;
      }

      const handleDecode = (result: { getText: () => string } | undefined) => {
        if (!result || cancelled) return;
        const text = result.getText().trim();
        if (!text) return;

        const now = Date.now();
        if (
          lastCameraScanRef.current.code === text.toUpperCase() &&
          now - lastCameraScanRef.current.ts < 1500
        ) {
          return;
        }
        lastCameraScanRef.current = { code: text.toUpperCase(), ts: now };

        const found = findMasterItemByBarcodeOrCode(itemsRef.current, text);
        if (found) {
          applyMatchedRef.current(found, true);
        } else {
          setScanStatus({
            type: 'err',
            text: `Hasil scan kamera "${text}" belum terdaftar di Master Data Barang.`,
          });
        }
      };

      try {
        let controls: IScannerControls;
        try {
          controls = await reader.decodeFromConstraints(
            { audio: false, video: { facingMode: { ideal: 'environment' } } },
            videoEl,
            (result) => handleDecode(result)
          );
        } catch {
          controls = await reader.decodeFromConstraints(
            { audio: false, video: true },
            videoEl,
            (result) => handleDecode(result)
          );
        }

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraReady(true);
      } catch (err) {
        if (cancelled) return;
        setCameraReady(false);
        setCameraActive(false);
        setCameraError(
          err instanceof Error
            ? `Izin kamera ditolak atau kamera tidak dapat dibuka (${err.message}). Gunakan input Scanner USB / ketik barcode.`
            : 'Gagal membuka kamera perangkat. Gunakan input Scanner USB / ketik barcode.'
        );
      }
    };

    void startStream();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setCameraReady(false);
    };
  }, [cameraActive, modalMode]);

  const startCamera = () => {
    setCameraError(null);
    setScanStatus(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Kamera tidak tersedia pada peramban ini atau halaman belum diakses melalui HTTPS. Gunakan input Scanner USB / ketik barcode di atas.'
      );
      return;
    }

    setCameraReady(false);
    setCameraActive(true);
  };

  const addLineItem = () => {
    const master = items.find((i) => i.id === pickerItemId);
    if (!master || pickerQty <= 0) return;
    addMasterItemToLines(master, pickerQty);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await saveIncomingDraft({ id: editingId, date, supplierId, items: lines, notes });
      stopCamera();
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

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <ScanBarcode className="w-4 h-4 text-red-800" />
                    <span>Scan Barcode / Tambah Barang Masuk</span>
                  </div>
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-100"
                    >
                      <Camera className="w-3.5 h-3.5 text-red-800" />
                      Buka Kamera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      Tutup Kamera
                    </button>
                  )}
                </div>

                {/* Barcode / USB Scanner Input */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={scanInputRef}
                        id="incoming-barcode-input"
                        type="text"
                        aria-label="Scan barcode atau ketik kode barang"
                        value={scanQuery}
                        onChange={(e) => {
                          setScanQuery(e.target.value);
                          if (scanStatus?.type === 'err') setScanStatus(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleScanLookup();
                          }
                        }}
                        placeholder="Scan barcode / ketik kode / cari nama (Enter)..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleScanLookup()}
                      className="px-3.5 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
                    >
                      {autoAddOnScan ? 'Scan & Tambah' : 'Cari Barcode'}
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={autoAddOnScan}
                      onChange={(e) => setAutoAddOnScan(e.target.checked)}
                    />
                    Langsung masukkan ke daftar saat barcode cocok
                  </label>

                  {scanSuggestions.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-44 overflow-y-auto">
                      {scanSuggestions.map((s) => (
                        <div
                          key={s.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setPickerItemId(s.id);
                              setScanQuery('');
                              setScanStatus({
                                type: 'info',
                                text: `Dipilih: ${s.name} (${s.code} · ${s.barcode}, stok saat ini ${s.currentStock} ${s.unitName}).`,
                              });
                              setTimeout(() => qtyInputRef.current?.focus(), 40);
                            }}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="font-medium text-slate-900 truncate">{s.name}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {s.code} · {s.barcode} · Stok: {s.currentStock} {s.unitName}
                            </div>
                          </button>
                          <button
                            type="button"
                            aria-label={`Tambah cepat ${s.name}`}
                            onClick={() => {
                              setPickerItemId(s.id);
                              addMasterItemToLines(s, pickerQty);
                              setScanQuery('');
                              setScanStatus({
                                type: 'ok',
                                text: `Ditambahkan: ${s.name} (${s.code}) — +${pickerQty} ${s.unitName}.`,
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded hover:bg-slate-800 shrink-0"
                          >
                            + Tambah
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {cameraActive && (
                    <div className="relative w-full h-56 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onPlaying={() => setCameraReady(true)}
                        className="w-full h-full object-cover"
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-white text-xs">
                          Menghubungkan kamera perangkat...
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
                        <span className="inline-block px-2.5 py-1 bg-slate-950/75 text-white text-[11px] rounded">
                          Arahkan kamera ke label barcode barang
                        </span>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      {cameraError}
                    </div>
                  )}

                  {scanStatus && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs ${
                        scanStatus.type === 'ok'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : scanStatus.type === 'info'
                          ? 'bg-blue-50 border-blue-200 text-blue-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      {scanStatus.text}
                    </div>
                  )}
                </div>

                {/* Fallback Manual Picker & Qty */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-2">
                  <select
                    aria-label="Pilih barang masuk"
                    value={pickerItemId}
                    onChange={(e) => setPickerItemId(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} · {i.barcode} - {i.name} ({i.unitName})
                      </option>
                    ))}
                  </select>
                  <input
                    ref={qtyInputRef}
                    id="incoming-picker-qty"
                    type="number"
                    aria-label="Jumlah barang masuk"
                    min={1}
                    value={pickerQty}
                    onChange={(e) => setPickerQty(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono bg-white"
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
                      <div key={line.itemId} className="p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{line.itemName}</div>
                          <div className="font-mono text-slate-500">
                            {line.itemCode} · Rp {line.price.toLocaleString('id-ID')} / {line.unitName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              aria-label={`Jumlah ${line.itemName}`}
                              value={line.qty}
                              onChange={(e) => {
                                const nextQty = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.itemId === line.itemId
                                      ? { ...l, qty: nextQty, subtotal: nextQty * l.price }
                                      : l
                                  )
                                );
                              }}
                              className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-right"
                            />
                            <span className="text-slate-500">{line.unitName}</span>
                          </div>
                          <span className="font-mono font-semibold whitespace-nowrap">
                            Rp {line.subtotal.toLocaleString('id-ID')}
                          </span>
                          <button
                            type="button"
                            aria-label={`Hapus ${line.itemName}`}
                            onClick={() => setLines((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                            className="text-red-700 p-1"
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
