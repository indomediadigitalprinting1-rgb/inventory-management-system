import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Camera, CameraOff, CheckCircle2, Plus, Search } from 'lucide-react';
import type { InventoryItem } from '../domain/types';
import { useInventory } from '../services/inventoryContext';

export function BarcodeScannerPage() {
  const { items, currentUser, addToScannerDraftCart, scannerDraftCart, setActiveRoute } = useInventory();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [addQty, setAddQty] = useState(1);

  const lookupByCode = (rawCode: string) => {
    const q = rawCode.trim().toUpperCase();
    if (!q) return;
    const found = items.find(
      (i) => i.barcode.trim().toUpperCase() === q || i.code.trim().toUpperCase() === q
    );
    if (found) {
      setMatchedItem(found);
      setNotFoundCode(null);
    } else {
      setMatchedItem(null);
      setNotFoundCode(rawCode.trim());
    }
  };

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setNotFoundCode(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Kamera tidak tersedia pada peramban ini atau halaman belum diakses melalui HTTPS. Gunakan pencarian manual di bawah.'
      );
      return;
    }

    try {
      // Explicitly request rear camera first (Android & iOS)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      stream.getTracks().forEach((t) => t.stop());

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const rearCamera =
        devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];

      const reader = new BrowserMultiFormatReader();
      setScanning(true);

      if (!videoRef.current) return;
      const controls = await reader.decodeFromVideoDevice(
        rearCamera?.deviceId,
        videoRef.current,
        (result) => {
          if (result) {
            const text = result.getText();
            lookupByCode(text);
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      setScanning(false);
      setCameraError(
        err instanceof Error
          ? `Izin kamera ditolak atau perangkat kamera tidak ditemukan (${err.message}). Silakan gunakan pencarian manual.`
          : 'Gagal mengakses kamera. Gunakan pencarian manual.'
      );
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    lookupByCode(manualQuery);
  };

  const manualSuggestions = manualQuery.trim()
    ? items
        .filter(
          (i) =>
            i.name.toLowerCase().includes(manualQuery.toLowerCase()) ||
            i.code.toLowerCase().includes(manualQuery.toLowerCase()) ||
            i.barcode.toLowerCase().includes(manualQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Camera Scanner Column */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Pemindai Kamera Barcode
            </h2>
            <p className="text-xs text-slate-500">
              Mendukung kamera belakang Android, iOS, dan Webcam (HTTPS).
            </p>
          </div>
          {!scanning ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              Aktifkan Kamera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap"
            >
              <CameraOff className="w-4 h-4" />
              Hentikan Kamera
            </button>
          )}
        </div>

        <div className="relative aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-6 text-center space-y-2">
              <Camera className="w-10 h-10 text-slate-500" />
              <p className="text-xs">
                Tekan &ldquo;Aktifkan Kamera&rdquo; lalu arahkan ke label barcode Code 128 barang.
              </p>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {cameraError}
          </div>
        )}
      </div>

      {/* Manual Search & Result Column */}
      <div className="lg:col-span-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Pencarian Manual / Input Scanner USB
          </h2>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Masukkan kode barcode atau SKU barang"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Ketik atau scan barcode (contoh: IMS-100001)..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              Cari Barang
            </button>
          </form>

          {manualSuggestions.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {manualSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setMatchedItem(s);
                    setNotFoundCode(null);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="font-mono text-slate-500">
                    {s.code} · {s.barcode}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {notFoundCode && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            Barcode atau kode <span className="font-mono font-semibold">{notFoundCode}</span> tidak ditemukan di master barang.
          </div>
        )}

        {matchedItem && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {matchedItem.code} · {matchedItem.barcode}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {matchedItem.name}
                </h3>
                <p className="text-xs text-slate-600">{matchedItem.specification}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Stok Tersedia</div>
                <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                  {matchedItem.currentStock} {matchedItem.unitName}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="scan-add-qty" className="text-xs text-slate-600">Jumlah:</label>
                <input
                  id="scan-add-qty"
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                  className="w-20 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => addToScannerDraftCart(matchedItem.id, addQty)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-800"
              >
                <Plus className="w-4 h-4" />
                Masukkan ke Daftar Permintaan
              </button>
            </div>
          </div>
        )}

        {scannerDraftCart.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>{scannerDraftCart.length} barang siap diajukan ({currentUser?.role})</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveRoute('requests')}
                className="px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900"
              >
                Lanjut ke Permintaan Barang
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
