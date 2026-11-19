import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode,
  Download,
  Edit3,
  Eye,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  canDeleteItemPermanently,
  canEditMasterItems,
  generateCode128Value,
} from '../domain/rules';
import type { InventoryItem } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { exportBarcodeLabelsPdf, renderCode128ToSvg } from '../utils/barcode';
import {
  exportItemsMasterExcel,
  exportTableToPdf,
  parseItemsFromExcel,
} from '../utils/exports';
import { StockHealthLabel } from '../components/StatusText';

function BarcodePreview({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (svgRef.current && value.trim()) {
      try {
        renderCode128ToSvg(svgRef.current, value);
      } catch {
        // Ignore invalid characters during typing
      }
    }
  }, [value]);
  return <svg ref={svgRef} className="max-w-full h-auto mx-auto" />;
}

export function MasterItemsPage() {
  const {
    currentUser,
    items,
    categories,
    units,
    suppliers,
    saveItem,
    importItemsBatch,
    deleteItemPermanently,
    systemConfig,
  } = useInventory();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOW' | 'OUT'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | 'barcode' | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [labelQtyMap, setLabelQtyMap] = useState<Record<string, number>>({});
  const [labelLayout, setLabelLayout] = useState<'A4_GRID' | 'THERMAL_50X30'>('A4_GRID');

  // Form fields
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [specification, setSpecification] = useState('');
  const [unitId, setUnitId] = useState('');
  const [initialStock, setInitialStock] = useState(0);
  const [minStock, setMinStock] = useState(5);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [supplierId, setSupplierId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!currentUser) return null;
  const canEdit = canEditMasterItems(currentUser.role);
  const showPrice = currentUser.role !== 'PRODUKSI';

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.categoryId !== categoryFilter) return false;
      if (statusFilter === 'ACTIVE' && !item.active) return false;
      if (statusFilter === 'LOW' && !(item.currentStock > 0 && item.currentStock <= item.minStock)) return false;
      if (statusFilter === 'OUT' && item.currentStock > 0) return false;
      if (q) {
        return (
          item.code.toLowerCase().includes(q) ||
          item.barcode.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.categoryName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoryFilter, items, search, statusFilter]);

  const openCreateModal = () => {
    setSelectedItem(null);
    setCode(`BRG-${String(items.length + 1).padStart(3, '0')}`);
    setBarcode(generateCode128Value('IMS'));
    setName('');
    setCategoryId(categories[0]?.id ?? '');
    setSpecification('');
    setUnitId(units[0]?.id ?? '');
    setInitialStock(0);
    setMinStock(5);
    setPurchasePrice(0);
    setSupplierId(suppliers[0]?.id ?? '');
    setActive(true);
    setFeedback(null);
    setModalMode('create');
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setCode(item.code);
    setBarcode(item.barcode);
    setName(item.name);
    setCategoryId(item.categoryId);
    setSpecification(item.specification);
    setUnitId(item.unitId);
    setInitialStock(item.initialStock);
    setMinStock(item.minStock);
    setPurchasePrice(item.purchasePrice);
    setSupplierId(item.supplierId);
    setActive(item.active);
    setFeedback(null);
    setModalMode('edit');
  };

  const openBarcodeModal = (singleItem?: InventoryItem) => {
    if (singleItem) {
      setBulkSelectedIds([singleItem.id]);
      setLabelQtyMap({ [singleItem.id]: 1 });
    } else {
      const targetIds = bulkSelectedIds.length > 0 ? bulkSelectedIds : filteredItems.slice(0, 6).map((i) => i.id);
      setBulkSelectedIds(targetIds);
      const qMap: Record<string, number> = {};
      targetIds.forEach((id) => {
        qMap[id] = labelQtyMap[id] ?? 1;
      });
      setLabelQtyMap(qMap);
    }
    setModalMode('barcode');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await saveItem({
        id: modalMode === 'edit' ? selectedItem?.id : undefined,
        code,
        barcode,
        name,
        categoryId,
        specification,
        unitId,
        initialStock,
        minStock,
        purchasePrice,
        supplierId,
        active,
      });
      setModalMode(null);
      setFeedback({ type: 'ok', text: `Barang ${name} berhasil disimpan.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan barang.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    setFeedback(null);
    try {
      await deleteItemPermanently(item);
      setFeedback({ type: 'ok', text: `Barang ${item.code} berhasil dihapus permanen.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus barang.' });
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const rows = await parseItemsFromExcel(file);
      if (rows.length === 0) {
        setFeedback({ type: 'err', text: 'File Excel kosong atau kolom Kode/Nama Barang tidak ditemukan.' });
        return;
      }
      const res = await importItemsBatch(rows);
      setFeedback({
        type: res.imported > 0 ? 'ok' : 'err',
        text: `Impor selesai: ${res.imported} barang berhasil ditambahkan${res.skipped.length ? `, ${res.skipped.length} dilewati (${res.skipped[0]})` : '.'}`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membaca file Excel.' });
    } finally {
      e.target.value = '';
    }
  };

  const handlePrintPdfList = () => {
    exportTableToPdf(
      `daftar-barang-${new Date().toISOString().slice(0, 10)}`,
      'Daftar Master Data Barang',
      `Total ${filteredItems.length} barang`,
      ['Kode', 'Barcode', 'Nama Barang', 'Kategori', 'Stok', 'Min', 'Satuan', 'Status'],
      filteredItems.map((i) => [
        i.code,
        i.barcode,
        i.name,
        i.categoryName,
        i.currentStock,
        i.minStock,
        i.unitName,
        i.active ? 'Aktif' : 'Nonaktif',
      ]),
      systemConfig?.companyName
    );
  };

  const toggleSelect = (id: string) => {
    setBulkSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

      {/* Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Cari barang berdasarkan kode, barcode, atau nama"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode, barcode, nama barang..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-800"
              />
            </div>

            <select
              aria-label="Filter kategori"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter status stok"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Hanya Aktif</option>
              <option value="LOW">Stok Minimum</option>
              <option value="OUT">Stok Habis</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void handleExcelImport(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Impor Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportItemsMasterExcel(filteredItems, showPrice)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => openBarcodeModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  Cetak Barcode ({bulkSelectedIds.length || 'Massal'})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handlePrintPdfList}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Daftar
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah Barang
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">Tidak ada barang yang cocok dengan filter.</p>
            <p className="text-xs text-slate-500">
              {canEdit ? 'Tambahkan barang baru atau ubah kata kunci pencarian.' : 'Coba ubah filter pencarian Anda.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  {canEdit && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua barang"
                        checked={bulkSelectedIds.length > 0 && bulkSelectedIds.length === filteredItems.length}
                        onChange={(e) =>
                          setBulkSelectedIds(e.target.checked ? filteredItems.map((i) => i.id) : [])
                        }
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Kode / Barcode</th>
                  <th className="px-4 py-3 font-medium">Nama Barang</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium text-right">Stok</th>
                  <th className="px-4 py-3 font-medium text-right">Min</th>
                  {showPrice && <th className="px-4 py-3 font-medium text-right">Harga Beli</th>}
                  <th className="px-4 py-3 font-medium">Kondisi</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    {canEdit && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${item.name}`}
                          checked={bulkSelectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-900">{item.code}</div>
                      <div className="font-mono text-[11px] text-slate-500">{item.barcode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">
                        {item.specification || '-'} · {item.supplierName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.categoryName}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap text-slate-900">
                      {item.currentStock} {item.unitName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-500">
                      {item.minStock}
                    </td>
                    {showPrice && (
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                        Rp {item.purchasePrice.toLocaleString('id-ID')}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StockHealthLabel current={item.currentStock} min={item.minStock} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Detail ${item.name}`}
                          onClick={() => {
                            setSelectedItem(item);
                            setModalMode('detail');
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              aria-label={`Barcode ${item.name}`}
                              onClick={() => openBarcodeModal(item)}
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            >
                              <Barcode className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Edit ${item.name}`}
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {canDeleteItemPermanently(currentUser.role, item) && (
                              <button
                                type="button"
                                aria-label={`Hapus ${item.name}`}
                                onClick={() => void handleDelete(item)}
                                className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
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

      {/* Create / Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {modalMode === 'create' ? 'Tambah Master Barang Baru' : `Edit Barang: ${selectedItem?.code}`}
              </h2>
              <button type="button" aria-label="Tutup modal" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="item-code" className="block text-xs font-medium text-slate-700 mb-1">
                    Kode Barang (Unik)
                  </label>
                  <input
                    id="item-code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="item-barcode" className="block text-xs font-medium text-slate-700 mb-1">
                    Barcode Code 128 (Unik)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="item-barcode"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setBarcode(generateCode128Value('IMS'))}
                      className="px-3 py-2 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      Auto
                    </button>
                  </div>
                </div>
              </div>

              {barcode.trim() && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <BarcodePreview value={barcode} />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="item-name" className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Barang
                  </label>
                  <input
                    id="item-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="item-cat" className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    id="item-cat"
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="item-spec" className="block text-xs font-medium text-slate-700 mb-1">
                  Spesifikasi
                </label>
                <input
                  id="item-spec"
                  value={specification}
                  onChange={(e) => setSpecification(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="item-unit" className="block text-xs font-medium text-slate-700 mb-1">
                    Satuan
                  </label>
                  <select
                    id="item-unit"
                    required
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Pilih Satuan</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="item-init-stock" className="block text-xs font-medium text-slate-700 mb-1">
                    Stok Awal
                  </label>
                  <input
                    id="item-init-stock"
                    type="number"
                    min={0}
                    disabled={modalMode === 'edit'}
                    value={initialStock}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="item-min-stock" className="block text-xs font-medium text-slate-700 mb-1">
                    Stok Minimum
                  </label>
                  <input
                    id="item-min-stock"
                    type="number"
                    min={0}
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="item-price" className="block text-xs font-medium text-slate-700 mb-1">
                    Harga Beli (Rp)
                  </label>
                  <input
                    id="item-price"
                    type="number"
                    min={0}
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label htmlFor="item-supplier" className="block text-xs font-medium text-slate-700 mb-1">
                    Supplier Utama
                  </label>
                  <select
                    id="item-supplier"
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 pb-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Status Barang Aktif
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modalMode === 'detail' && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">Detail Barang</h2>
              <button type="button" aria-label="Tutup detail" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <BarcodePreview value={selectedItem.barcode} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Kode Barang</dt>
                <dd className="font-mono font-semibold">{selectedItem.code}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Nama Barang</dt>
                <dd className="font-semibold">{selectedItem.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Kategori / Satuan</dt>
                <dd>
                  {selectedItem.categoryName} · {selectedItem.unitName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Stok Saat Ini / Minimum</dt>
                <dd className="font-mono font-semibold">
                  {selectedItem.currentStock} / {selectedItem.minStock} {selectedItem.unitName}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Spesifikasi</dt>
                <dd>{selectedItem.specification || '-'}</dd>
              </div>
              {showPrice && (
                <>
                  <div>
                    <dt className="text-xs text-slate-500">Harga Pembelian</dt>
                    <dd className="font-mono">Rp {selectedItem.purchasePrice.toLocaleString('id-ID')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Supplier Utama</dt>
                    <dd>{selectedItem.supplierName}</dd>
                  </div>
                </>
              )}
            </dl>
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Print Modal (Single & Bulk) */}
      {modalMode === 'barcode' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Cetak Label Barcode Code 128
              </h2>
              <button type="button" aria-label="Tutup modal barcode" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Pilih format printer yang digunakan:
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLabelLayout('A4_GRID')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    labelLayout === 'A4_GRID' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Printer Biasa (A4 Grid 3x8)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelLayout('THERMAL_50X30')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    labelLayout === 'THERMAL_50X30' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Printer Label (50x30mm)
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {bulkSelectedIds.map((id) => {
                const it = items.find((x) => x.id === id);
                if (!it) return null;
                return (
                  <div key={id} className="p-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{it.name}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {it.code} · {it.barcode}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label htmlFor={`lbl-qty-${id}`} className="text-xs text-slate-600">
                        Jumlah Label:
                      </label>
                      <input
                        id={`lbl-qty-${id}`}
                        type="number"
                        min={1}
                        max={200}
                        value={labelQtyMap[id] ?? 1}
                        onChange={(e) =>
                          setLabelQtyMap((prev) => ({
                            ...prev,
                            [id]: Math.max(1, Number(e.target.value)),
                          }))
                        }
                        className="w-20 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg font-mono text-right"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const labels = bulkSelectedIds
                    .map((id) => {
                      const item = items.find((i) => i.id === id);
                      return item ? { item, qty: labelQtyMap[id] ?? 1 } : null;
                    })
                    .filter((x): x is { item: InventoryItem; qty: number } => x !== null);
                  exportBarcodeLabelsPdf(labels, labelLayout);
                }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800"
              >
                <Printer className="w-4 h-4" />
                Unduh PDF Label Barcode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
