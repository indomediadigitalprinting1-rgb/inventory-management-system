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
  canManageUnits,
  generateCode128Value,
  generateNextSequentialCode,
  partitionDeletableItems,
  sortItemsByCode,
} from '../domain/rules';
import type { InventoryItem } from '../domain/types';
import { useInventory } from '../services/inventoryContext';
import { exportBarcodeLabelsPdf, renderCode128ToSvg } from '../utils/barcode';
import {
  exportItemsMasterExcel,
  exportTableToPdf,
  parseMasterDatabaseFromExcel,
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
    saveCategory,
    saveUnit,
    saveSupplier,
    saveItem,
    importItemsBatch,
    deleteItemPermanently,
    deleteItemsBatch,
    systemConfig,
  } = useInventory();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOW' | 'OUT'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | 'barcode' | 'bulk-delete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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

  // Inline quick-add state for Category, Unit, Supplier inside item modal
  const [quickAddType, setQuickAddType] = useState<'category' | 'unit' | 'supplier' | null>(null);
  const [quickCode, setQuickCode] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickExtra, setQuickExtra] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const validIds = new Set(items.map((i) => i.id));
    setBulkSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [items]);

  if (!currentUser) return null;
  const canEdit = canEditMasterItems(currentUser.role);
  const canAddUnits = canManageUnits(currentUser.role);
  const canBulkDelete = currentUser.role === 'OWNER';
  const showPrice = currentUser.role !== 'PRODUKSI';

  const selectedBulkItems = sortItemsByCode(
    items.filter((item) => bulkSelectedIds.includes(item.id))
  );
  const { deletable: deletableBulkItems, locked: lockedBulkItems } = partitionDeletableItems(
    currentUser.role,
    selectedBulkItems
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortItemsByCode(
      items.filter((item) => {
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
      })
    );
  }, [categoryFilter, items, search, statusFilter]);

  const openCreateModal = () => {
    setSelectedItem(null);
    setCode(generateNextSequentialCode('BRG', items.map((i) => i.code), 3));
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
    setQuickAddType(null);
    setQuickError(null);
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
    setQuickAddType(null);
    setQuickError(null);
    setModalMode('edit');
  };

  const openQuickAdd = (type: 'category' | 'unit' | 'supplier') => {
    if (quickAddType === type) {
      setQuickAddType(null);
      setQuickError(null);
      return;
    }
    setQuickError(null);
    setQuickName('');
    setQuickExtra('');
    setQuickPhone('');
    if (type === 'category') {
      setQuickCode(generateNextSequentialCode('KAT', categories.map((c) => c.code), 2));
    } else if (type === 'unit') {
      setQuickCode(generateNextSequentialCode('SAT', units.map((u) => u.code), 2));
    } else {
      setQuickCode(generateNextSequentialCode('SUP', suppliers.map((s) => s.code), 2));
    }
    setQuickAddType(type);
  };

  const handleSaveQuickAdd = async () => {
    if (!quickAddType) return;
    if (!quickCode.trim() || !quickName.trim()) {
      setQuickError('Kode dan Nama wajib diisi.');
      return;
    }
    setQuickSaving(true);
    setQuickError(null);
    try {
      if (quickAddType === 'category') {
        const created = await saveCategory({
          code: quickCode.trim().toUpperCase(),
          name: quickName.trim(),
          description: quickExtra.trim(),
          active: true,
        });
        setCategoryId(created.id);
      } else if (quickAddType === 'unit') {
        const created = await saveUnit({
          code: quickCode.trim().toUpperCase(),
          name: quickName.trim(),
          description: quickExtra.trim(),
          active: true,
        });
        setUnitId(created.id);
      } else {
        const created = await saveSupplier({
          code: quickCode.trim().toUpperCase(),
          name: quickName.trim(),
          contactPerson: quickExtra.trim(),
          phone: quickPhone.trim(),
          email: '',
          address: '',
          active: true,
        });
        setSupplierId(created.id);
      }
      setQuickAddType(null);
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Gagal menambahkan data master.');
    } finally {
      setQuickSaving(false);
    }
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
      setBulkSelectedIds((prev) => prev.filter((id) => id !== item.id));
      setFeedback({ type: 'ok', text: `Barang ${item.code} berhasil dihapus permanen.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus barang.' });
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedBulkItems.length === 0) {
      setModalMode(null);
      return;
    }
    setBulkDeleting(true);
    setFeedback(null);
    try {
      const res = await deleteItemsBatch(selectedBulkItems);
      setBulkSelectedIds([]);
      setModalMode(null);
      if (res.deletedCount > 0) {
        const skipNote =
          res.skipped.length > 0
            ? ` ${res.skipped.length} barang dilewati karena memiliki riwayat transaksi.`
            : '';
        setFeedback({
          type: 'ok',
          text: `${res.deletedCount} barang terpilih berhasil dihapus permanen.${skipNote}`,
        });
      } else {
        setFeedback({
          type: 'err',
          text: 'Tidak ada barang terpilih yang dapat dihapus karena semua memiliki riwayat transaksi.',
        });
      }
    } catch (err) {
      setModalMode(null);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus barang terpilih.',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const parsed = await parseMasterDatabaseFromExcel(file);
      const totalRows =
        parsed.items.length +
        parsed.categories.length +
        parsed.units.length +
        parsed.suppliers.length;
      if (totalRows === 0) {
        setFeedback({
          type: 'err',
          text: 'File Excel kosong atau format sheet/kolom Master Barang, Kategori, Satuan, dan Supplier tidak dikenali.',
        });
        return;
      }
      const res = await importItemsBatch(parsed);
      const parts: string[] = [];
      if (res.itemsCreated > 0) parts.push(`${res.itemsCreated} barang baru`);
      if (res.itemsUpdated > 0) parts.push(`${res.itemsUpdated} barang diperbarui`);
      if (res.categoriesCreated > 0) parts.push(`${res.categoriesCreated} kategori baru`);
      if (res.categoriesUpdated > 0) parts.push(`${res.categoriesUpdated} kategori diperbarui`);
      if (res.unitsCreated > 0) parts.push(`${res.unitsCreated} satuan baru`);
      if (res.unitsUpdated > 0) parts.push(`${res.unitsUpdated} satuan diperbarui`);
      if (res.suppliersCreated > 0) parts.push(`${res.suppliersCreated} supplier baru`);
      if (res.suppliersUpdated > 0) parts.push(`${res.suppliersUpdated} supplier diperbarui`);

      const totalChanges =
        res.itemsCreated +
        res.itemsUpdated +
        res.categoriesCreated +
        res.categoriesUpdated +
        res.unitsCreated +
        res.unitsUpdated +
        res.suppliersCreated +
        res.suppliersUpdated;

      const summaryText =
        parts.length > 0
          ? `Sinkronisasi Excel selesai: ${parts.join(', ')}.`
          : 'Data Excel sudah sinkron dengan database (tidak ada perubahan baru).';

      setFeedback({
        type: totalChanges > 0 || res.skipped.length === 0 ? 'ok' : 'err',
        text: `${summaryText}${res.skipped.length ? ` ${res.skipped.length} baris dilewati (${res.skipped[0]}).` : ''}`,
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
                  <Download className="w-3.5 h-3.5" />
                  Impor Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportItemsMasterExcel(filteredItems, categories, units, suppliers, showPrice)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
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
                {canBulkDelete && selectedBulkItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setModalMode('bulk-delete')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Terpilih ({selectedBulkItems.length})
                  </button>
                )}
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
                        checked={
                          filteredItems.length > 0 &&
                          filteredItems.every((i) => bulkSelectedIds.includes(i.id))
                        }
                        onChange={(e) => {
                          const filteredIds = filteredItems.map((i) => i.id);
                          if (e.target.checked) {
                            setBulkSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
                          } else {
                            const filteredSet = new Set(filteredIds);
                            setBulkSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                          }
                        }}
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
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {modalMode === 'create' ? 'Tambah Master Barang Baru' : `Edit Barang: ${selectedItem?.code}`}
              </h2>
              <button
                type="button"
                aria-label="Tutup modal"
                onClick={() => {
                  if (feedback?.type === 'err') setFeedback(null);
                  setModalMode(null);
                }}
              >
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
                    Kode Barang (Otomatis)
                  </label>
                  <input
                    id="item-code"
                    required
                    readOnly
                    disabled
                    value={code}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono bg-slate-100 text-slate-600 cursor-not-allowed"
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
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="item-cat" className="block text-xs font-medium text-slate-700">
                      Kategori
                    </label>
                    <button
                      type="button"
                      onClick={() => openQuickAdd('category')}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-red-800 hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      {quickAddType === 'category' ? 'Tutup' : 'Tambah Kategori'}
                    </button>
                  </div>
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

              {quickAddType === 'category' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Tambah Kategori Baru</span>
                    <button
                      type="button"
                      onClick={() => setQuickAddType(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Batal
                    </button>
                  </div>
                  {quickError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      {quickError}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <div>
                      <label htmlFor="quick-cat-code" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Kode Kategori (Otomatis)
                      </label>
                      <input
                        id="quick-cat-code"
                        maxLength={32}
                        readOnly
                        disabled
                        value={quickCode}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-100 text-slate-600 font-mono cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-cat-name" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Nama Kategori
                      </label>
                      <input
                        id="quick-cat-name"
                        maxLength={100}
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Contoh: Bahan Baku"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-cat-desc" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Deskripsi (Opsional)
                      </label>
                      <input
                        id="quick-cat-desc"
                        maxLength={300}
                        value={quickExtra}
                        onChange={(e) => setQuickExtra(e.target.value)}
                        placeholder="Keterangan singkat"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={quickSaving}
                      onClick={() => void handleSaveQuickAdd()}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:opacity-60"
                    >
                      {quickSaving ? 'Menyimpan...' : 'Simpan & Pilih Kategori'}
                    </button>
                  </div>
                </div>
              )}

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
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label htmlFor="item-unit" className="block text-xs font-medium text-slate-700">
                      Satuan
                    </label>
                    {canAddUnits && (
                      <button
                        type="button"
                        onClick={() => openQuickAdd('unit')}
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-800 hover:underline whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        {quickAddType === 'unit' ? 'Tutup' : 'Tambah'}
                      </button>
                    )}
                  </div>
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

              {quickAddType === 'unit' && canAddUnits && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Tambah Satuan Baru</span>
                    <button
                      type="button"
                      onClick={() => setQuickAddType(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Batal
                    </button>
                  </div>
                  {quickError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      {quickError}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <div>
                      <label htmlFor="quick-unit-code" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Kode Satuan (Otomatis)
                      </label>
                      <input
                        id="quick-unit-code"
                        maxLength={24}
                        readOnly
                        disabled
                        value={quickCode}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-100 text-slate-600 font-mono cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-unit-name" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Nama Satuan
                      </label>
                      <input
                        id="quick-unit-name"
                        maxLength={80}
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Contoh: Pcs"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-unit-desc" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Deskripsi (Opsional)
                      </label>
                      <input
                        id="quick-unit-desc"
                        maxLength={300}
                        value={quickExtra}
                        onChange={(e) => setQuickExtra(e.target.value)}
                        placeholder="Keterangan singkat"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={quickSaving}
                      onClick={() => void handleSaveQuickAdd()}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:opacity-60"
                    >
                      {quickSaving ? 'Menyimpan...' : 'Simpan & Pilih Satuan'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="item-supplier" className="block text-xs font-medium text-slate-700">
                      Supplier Utama
                    </label>
                    <button
                      type="button"
                      onClick={() => openQuickAdd('supplier')}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-red-800 hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      {quickAddType === 'supplier' ? 'Tutup' : 'Tambah Supplier'}
                    </button>
                  </div>
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

              {quickAddType === 'supplier' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Tambah Supplier Baru</span>
                    <button
                      type="button"
                      onClick={() => setQuickAddType(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Batal
                    </button>
                  </div>
                  {quickError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      {quickError}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="quick-sup-code" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Kode Supplier (Otomatis)
                      </label>
                      <input
                        id="quick-sup-code"
                        maxLength={32}
                        readOnly
                        disabled
                        value={quickCode}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-100 text-slate-600 font-mono cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-sup-name" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Nama Supplier
                      </label>
                      <input
                        id="quick-sup-name"
                        maxLength={140}
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Contoh: PT Maju Jaya"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-sup-pic" className="block text-[11px] font-medium text-slate-600 mb-1">
                        Kontak PIC (Opsional)
                      </label>
                      <input
                        id="quick-sup-pic"
                        maxLength={100}
                        value={quickExtra}
                        onChange={(e) => setQuickExtra(e.target.value)}
                        placeholder="Nama kontak"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-sup-phone" className="block text-[11px] font-medium text-slate-600 mb-1">
                        No. Telepon (Opsional)
                      </label>
                      <input
                        id="quick-sup-phone"
                        maxLength={40}
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        placeholder="08xx / 021-xxx"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={quickSaving}
                      onClick={() => void handleSaveQuickAdd()}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:opacity-60"
                    >
                      {quickSaving ? 'Menyimpan...' : 'Simpan & Pilih Supplier'}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (feedback?.type === 'err') setFeedback(null);
                    setModalMode(null);
                  }}
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

      {/* Bulk Delete Confirmation Modal */}
      {modalMode === 'bulk-delete' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Konfirmasi Hapus Barang Terpilih
              </h2>
              <button type="button" aria-label="Tutup konfirmasi hapus" onClick={() => setModalMode(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {deletableBulkItems.length > 0 ? (
              <p className="text-sm text-slate-700">
                Sebanyak <span className="font-semibold text-red-700">{deletableBulkItems.length} barang</span>{' '}
                berikut belum memiliki riwayat transaksi dan akan dihapus permanen dari master database:
              </p>
            ) : (
              <p className="text-sm text-red-700">
                Semua barang yang Anda seleksi memiliki riwayat transaksi sehingga tidak dapat dihapus permanen.
              </p>
            )}

            {deletableBulkItems.length > 0 && (
              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {deletableBulkItems.map((item) => (
                  <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono font-semibold text-slate-900 mr-2">{item.code}</span>
                      <span className="text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="text-red-700 font-medium shrink-0">Akan dihapus</span>
                  </div>
                ))}
              </div>
            )}

            {lockedBulkItems.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <p className="text-xs font-semibold text-amber-900">
                  {lockedBulkItems.length} barang dilewati (memiliki riwayat transaksi):
                </p>
                <ul className="text-xs text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
                  {lockedBulkItems.map((item) => (
                    <li key={item.id}>
                      <span className="font-mono font-semibold">{item.code}</span> — {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => setModalMode(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={bulkDeleting || deletableBulkItems.length === 0}
                onClick={() => void handleConfirmBulkDelete()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {bulkDeleting
                  ? 'Menghapus...'
                  : `Hapus Permanen (${deletableBulkItems.length} Barang)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
