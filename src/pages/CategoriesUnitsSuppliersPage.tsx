import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import {
  canDeleteCategory,
  canDeleteSupplier,
  canDeleteUnit,
  generateNextSequentialCode,
  partitionDeletableCategories,
  partitionDeletableSuppliers,
  partitionDeletableUnits,
  sortItemsByCode,
} from '../domain/rules';
import { useInventory } from '../services/inventoryContext';

interface FeedbackState {
  type: 'ok' | 'err';
  text: string;
}

interface BulkDeleteRecord {
  id: string;
  code: string;
  name: string;
}

function BulkDeleteConfirmModal({
  entityLabel,
  deletable,
  locked,
  lockedReason,
  deleting,
  onClose,
  onConfirm,
}: {
  entityLabel: string;
  deletable: BulkDeleteRecord[];
  locked: BulkDeleteRecord[];
  lockedReason: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Konfirmasi Hapus {entityLabel} Terpilih
          </h2>
          <button type="button" aria-label={`Tutup konfirmasi hapus ${entityLabel.toLowerCase()}`} onClick={onClose}>
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {deletable.length > 0 ? (
          <p className="text-sm text-slate-700">
            Sebanyak <span className="font-semibold text-red-700">{deletable.length} {entityLabel.toLowerCase()}</span>{' '}
            berikut belum digunakan dan akan dihapus permanen dari master database:
          </p>
        ) : (
          <p className="text-sm text-red-700">
            Semua {entityLabel.toLowerCase()} yang Anda seleksi {lockedReason} sehingga tidak dapat dihapus.
          </p>
        )}

        {deletable.length > 0 && (
          <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {deletable.map((row) => (
              <div key={row.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-slate-900 mr-2">{row.code}</span>
                  <span className="text-slate-700 truncate">{row.name}</span>
                </div>
                <span className="text-red-700 font-medium shrink-0">Akan dihapus</span>
              </div>
            ))}
          </div>
        )}

        {locked.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
            <p className="text-xs font-semibold text-amber-900">
              {locked.length} {entityLabel.toLowerCase()} dilewati ({lockedReason}):
            </p>
            <ul className="text-xs text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
              {locked.map((row) => (
                <li key={row.id}>
                  <span className="font-mono font-semibold">{row.code}</span> — {row.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={deleting || deletable.length === 0}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Menghapus...' : `Hapus Permanen (${deletable.length} ${entityLabel})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { currentUser, categories, items, saveCategory, deleteCategory, deleteCategoriesBatch } = useInventory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const validIds = new Set(categories.map((c) => c.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [categories]);

  const role = currentUser?.role ?? 'PRODUKSI';
  const canDelete = role === 'OWNER';

  const selectedCategories = useMemo(
    () => sortItemsByCode(categories.filter((c) => selectedIds.includes(c.id))),
    [categories, selectedIds]
  );

  const { deletable: deletableCategories, locked: lockedCategories } = useMemo(
    () => partitionDeletableCategories(role, selectedCategories, items),
    [items, role, selectedCategories]
  );

  const openNew = () => {
    setEditingId(null);
    setCode(generateNextSequentialCode('KAT', categories.map((c) => c.code), 2));
    setName('');
    setDescription('');
    setActive(true);
    setFeedback(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCategory({ id: editingId ?? undefined, code, name, description, active });
      setShowForm(false);
      setFeedback({ type: 'ok', text: `Kategori "${name}" berhasil disimpan.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan kategori.' });
    }
  };

  const handleSingleDelete = async (categoryId: string) => {
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return;
    setFeedback(null);
    try {
      await deleteCategory(target);
      setSelectedIds((prev) => prev.filter((id) => id !== target.id));
      setFeedback({ type: 'ok', text: `Kategori ${target.code} (${target.name}) berhasil dihapus permanen.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus kategori.' });
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedCategories.length === 0) {
      setShowBulkDeleteModal(false);
      return;
    }
    setBulkDeleting(true);
    setFeedback(null);
    try {
      const res = await deleteCategoriesBatch(selectedCategories);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      if (res.deletedCount > 0) {
        const skipNote =
          res.skipped.length > 0
            ? ` ${res.skipped.length} kategori dilewati karena masih digunakan oleh data barang.`
            : '';
        setFeedback({
          type: 'ok',
          text: `${res.deletedCount} kategori terpilih berhasil dihapus permanen.${skipNote}`,
        });
      } else {
        setFeedback({
          type: 'err',
          text: 'Tidak ada kategori terpilih yang dapat dihapus karena semua masih digunakan oleh data barang.',
        });
      }
    } catch (err) {
      setShowBulkDeleteModal(false);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus kategori terpilih.',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Kelola pengelompokan master barang inventaris.</p>
        <div className="flex flex-wrap items-center gap-2">
          {canDelete && selectedCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Terpilih ({selectedCategories.length})
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </button>
        </div>
      </div>

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Belum ada data kategori.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  {canDelete && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua kategori"
                        checked={categories.length > 0 && categories.every((c) => selectedIds.includes(c.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(categories.map((c) => c.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Nama Kategori</th>
                  <th className="px-4 py-3 font-medium">Deskripsi</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    {canDelete && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih kategori ${c.name}`}
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{c.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.description || '-'}</td>
                    <td className="px-4 py-3 text-xs">{c.active ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit kategori ${c.name}`}
                          onClick={() => {
                            setEditingId(c.id);
                            setCode(c.code);
                            setName(c.name);
                            setDescription(c.description);
                            setActive(c.active);
                            setShowForm(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {canDeleteCategory(role, c.id, items) && (
                          <button
                            type="button"
                            aria-label={`Hapus kategori ${c.name}`}
                            onClick={() => void handleSingleDelete(c.id)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
              </h2>
              <button type="button" aria-label="Tutup form" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="cat-code" className="block text-xs font-medium text-slate-700 mb-1">Kode</label>
                <input id="cat-code" required value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label htmlFor="cat-name" className="block text-xs font-medium text-slate-700 mb-1">Nama Kategori</label>
                <input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label htmlFor="cat-desc" className="block text-xs font-medium text-slate-700 mb-1">Deskripsi</label>
                <input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Aktif
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <BulkDeleteConfirmModal
          entityLabel="Kategori"
          deletable={deletableCategories}
          locked={lockedCategories}
          lockedReason="masih digunakan oleh data barang"
          deleting={bulkDeleting}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={() => void handleConfirmBulkDelete()}
        />
      )}
    </div>
  );
}

export function UnitsPage() {
  const { currentUser, units, items, saveUnit, deleteUnit, deleteUnitsBatch } = useInventory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const validIds = new Set(units.map((u) => u.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [units]);

  const role = currentUser?.role ?? 'PRODUKSI';
  const canDelete = role === 'OWNER';

  const selectedUnits = useMemo(
    () => sortItemsByCode(units.filter((u) => selectedIds.includes(u.id))),
    [selectedIds, units]
  );

  const { deletable: deletableUnits, locked: lockedUnits } = useMemo(
    () => partitionDeletableUnits(role, selectedUnits, items),
    [items, role, selectedUnits]
  );

  const openNew = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDescription('');
    setActive(true);
    setFeedback(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveUnit({ id: editingId ?? undefined, code, name, description, active });
      setShowForm(false);
      setFeedback({ type: 'ok', text: `Satuan "${name}" berhasil disimpan.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan satuan.' });
    }
  };

  const handleSingleDelete = async (unitId: string) => {
    const target = units.find((u) => u.id === unitId);
    if (!target) return;
    setFeedback(null);
    try {
      await deleteUnit(target);
      setSelectedIds((prev) => prev.filter((id) => id !== target.id));
      setFeedback({ type: 'ok', text: `Satuan ${target.code} (${target.name}) berhasil dihapus permanen.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus satuan.' });
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedUnits.length === 0) {
      setShowBulkDeleteModal(false);
      return;
    }
    setBulkDeleting(true);
    setFeedback(null);
    try {
      const res = await deleteUnitsBatch(selectedUnits);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      if (res.deletedCount > 0) {
        const skipNote =
          res.skipped.length > 0
            ? ` ${res.skipped.length} satuan dilewati karena masih digunakan oleh data barang.`
            : '';
        setFeedback({
          type: 'ok',
          text: `${res.deletedCount} satuan terpilih berhasil dihapus permanen.${skipNote}`,
        });
      } else {
        setFeedback({
          type: 'err',
          text: 'Tidak ada satuan terpilih yang dapat dihapus karena semua masih digunakan oleh data barang.',
        });
      }
    } catch (err) {
      setShowBulkDeleteModal(false);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus satuan terpilih.',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Kelola satuan pengukuran barang (Pcs, Lembar, Box, Roll, Kg).</p>
        <div className="flex flex-wrap items-center gap-2">
          {canDelete && selectedUnits.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Terpilih ({selectedUnits.length})
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Satuan
          </button>
        </div>
      </div>

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {units.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Belum ada data satuan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  {canDelete && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua satuan"
                        checked={units.length > 0 && units.every((u) => selectedIds.includes(u.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(units.map((u) => u.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Nama Satuan</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    {canDelete && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih satuan ${u.name}`}
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleSelect(u.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{u.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.description || '-'}</td>
                    <td className="px-4 py-3 text-xs">{u.active ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit satuan ${u.name}`}
                          onClick={() => {
                            setEditingId(u.id);
                            setCode(u.code);
                            setName(u.name);
                            setDescription(u.description);
                            setActive(u.active);
                            setShowForm(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {canDeleteUnit(role, u.id, items) && (
                          <button
                            type="button"
                            aria-label={`Hapus satuan ${u.name}`}
                            onClick={() => void handleSingleDelete(u.id)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingId ? 'Edit Satuan' : 'Tambah Satuan'}
              </h2>
              <button type="button" aria-label="Tutup modal satuan" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="unit-code" className="block text-xs font-medium text-slate-700 mb-1">Kode</label>
                <input id="unit-code" required value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label htmlFor="unit-name" className="block text-xs font-medium text-slate-700 mb-1">Nama Satuan</label>
                <input id="unit-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label htmlFor="unit-desc" className="block text-xs font-medium text-slate-700 mb-1">Keterangan</label>
                <input id="unit-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Aktif
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <BulkDeleteConfirmModal
          entityLabel="Satuan"
          deletable={deletableUnits}
          locked={lockedUnits}
          lockedReason="masih digunakan oleh data barang"
          deleting={bulkDeleting}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={() => void handleConfirmBulkDelete()}
        />
      )}
    </div>
  );
}

export function SuppliersPage() {
  const {
    currentUser,
    suppliers,
    items,
    incoming,
    saveSupplier,
    deleteSupplier,
    deleteSuppliersBatch,
  } = useInventory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [active, setActive] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const validIds = new Set(suppliers.map((s) => s.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [suppliers]);

  const role = currentUser?.role ?? 'PRODUKSI';
  const canDelete = role === 'OWNER';

  const selectedSuppliers = useMemo(
    () => sortItemsByCode(suppliers.filter((s) => selectedIds.includes(s.id))),
    [selectedIds, suppliers]
  );

  const { deletable: deletableSuppliers, locked: lockedSuppliers } = useMemo(
    () => partitionDeletableSuppliers(role, selectedSuppliers, items, incoming),
    [incoming, items, role, selectedSuppliers]
  );

  const openNew = () => {
    setEditingId(null);
    setCode(generateNextSequentialCode('SUP', suppliers.map((s) => s.code), 2));
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setActive(true);
    setFeedback(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSupplier({ id: editingId ?? undefined, code, name, contactPerson, phone, email, address, active });
      setShowForm(false);
      setFeedback({ type: 'ok', text: `Supplier "${name}" berhasil disimpan.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan supplier.' });
    }
  };

  const handleSingleDelete = async (supplierId: string) => {
    const target = suppliers.find((s) => s.id === supplierId);
    if (!target) return;
    setFeedback(null);
    try {
      await deleteSupplier(target);
      setSelectedIds((prev) => prev.filter((id) => id !== target.id));
      setFeedback({ type: 'ok', text: `Supplier ${target.code} (${target.name}) berhasil dihapus permanen.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus supplier.' });
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedSuppliers.length === 0) {
      setShowBulkDeleteModal(false);
      return;
    }
    setBulkDeleting(true);
    setFeedback(null);
    try {
      const res = await deleteSuppliersBatch(selectedSuppliers);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
      if (res.deletedCount > 0) {
        const skipNote =
          res.skipped.length > 0
            ? ` ${res.skipped.length} supplier dilewati karena masih digunakan oleh data barang atau transaksi.`
            : '';
        setFeedback({
          type: 'ok',
          text: `${res.deletedCount} supplier terpilih berhasil dihapus permanen.${skipNote}`,
        });
      } else {
        setFeedback({
          type: 'err',
          text: 'Tidak ada supplier terpilih yang dapat dihapus karena semua masih digunakan oleh data barang atau transaksi.',
        });
      }
    } catch (err) {
      setShowBulkDeleteModal(false);
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus supplier terpilih.',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Daftar pemasok resmi untuk pengadaan dan transaksi barang masuk.</p>
        <div className="flex flex-wrap items-center gap-2">
          {canDelete && selectedSuppliers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Terpilih ({selectedSuppliers.length})
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tambah Supplier
          </button>
        </div>
      </div>

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Belum ada data supplier.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  {canDelete && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua supplier"
                        checked={suppliers.length > 0 && suppliers.every((s) => selectedIds.includes(s.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(suppliers.map((s) => s.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Nama Supplier</th>
                  <th className="px-4 py-3 font-medium">Kontak / PIC</th>
                  <th className="px-4 py-3 font-medium">Telepon / Email</th>
                  <th className="px-4 py-3 font-medium">Alamat</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    {canDelete && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih supplier ${s.name}`}
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelect(s.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{s.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-slate-700">{s.contactPerson || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{s.phone || '-'}</div>
                      <div>{s.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">{s.address || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit supplier ${s.name}`}
                          onClick={() => {
                            setEditingId(s.id);
                            setCode(s.code);
                            setName(s.name);
                            setContactPerson(s.contactPerson);
                            setPhone(s.phone);
                            setEmail(s.email);
                            setAddress(s.address);
                            setActive(s.active);
                            setShowForm(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {canDeleteSupplier(role, s.id, items, incoming) && (
                          <button
                            type="button"
                            aria-label={`Hapus supplier ${s.name}`}
                            onClick={() => void handleSingleDelete(s.id)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingId ? 'Edit Supplier' : 'Tambah Supplier'}
              </h2>
              <button type="button" aria-label="Tutup modal supplier" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-code" className="block text-xs font-medium text-slate-700 mb-1">Kode</label>
                  <input id="sup-code" required value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label htmlFor="sup-name" className="block text-xs font-medium text-slate-700 mb-1">Nama Supplier</label>
                  <input id="sup-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-pic" className="block text-xs font-medium text-slate-700 mb-1">Kontak PIC</label>
                  <input id="sup-pic" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label htmlFor="sup-phone" className="block text-xs font-medium text-slate-700 mb-1">Telepon</label>
                  <input id="sup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label htmlFor="sup-email" className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label htmlFor="sup-addr" className="block text-xs font-medium text-slate-700 mb-1">Alamat</label>
                <input id="sup-addr" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Aktif
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <BulkDeleteConfirmModal
          entityLabel="Supplier"
          deletable={deletableSuppliers}
          locked={lockedSuppliers}
          lockedReason="masih digunakan oleh data barang atau transaksi"
          deleting={bulkDeleting}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={() => void handleConfirmBulkDelete()}
        />
      )}
    </div>
  );
}
