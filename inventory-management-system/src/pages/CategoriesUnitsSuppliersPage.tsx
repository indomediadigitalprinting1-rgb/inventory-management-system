import React, { useState } from 'react';
import { Edit3, Plus, X } from 'lucide-react';
import { useInventory } from '../services/inventoryContext';

export function CategoriesPage() {
  const { categories, saveCategory } = useInventory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setCode(`KAT-${String(categories.length + 1).padStart(2, '0')}`);
    setName('');
    setDescription('');
    setActive(true);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCategory({ id: editingId ?? undefined, code, name, description, active });
    setShowForm(false);
    setMsg(`Kategori "${name}" berhasil disimpan.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Kelola pengelompokan master barang inventaris.</p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900"
        >
          <Plus className="w-4 h-4" />
          Tambah Kategori
        </button>
      </div>
      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">{msg}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <tr>
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
                <td className="px-4 py-3 font-mono text-xs font-semibold">{c.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.description || '-'}</td>
                <td className="px-4 py-3 text-xs">{c.active ? 'Aktif' : 'Nonaktif'}</td>
                <td className="px-4 py-3 text-right">
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
                    className="p-1.5 text-slate-600 hover:text-amber-700"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </div>
  );
}

export function UnitsPage() {
  const { units, saveUnit } = useInventory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDescription('');
    setActive(true);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveUnit({ id: editingId ?? undefined, code, name, description, active });
    setShowForm(false);
    setMsg(`Satuan "${name}" berhasil disimpan.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Kelola satuan pengukuran barang (Pcs, Lembar, Box, Roll, Kg).</p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900"
        >
          <Plus className="w-4 h-4" />
          Tambah Satuan
        </button>
      </div>
      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">{msg}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            <tr>
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
                <td className="px-4 py-3 font-mono text-xs font-semibold">{u.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.description || '-'}</td>
                <td className="px-4 py-3 text-xs">{u.active ? 'Aktif' : 'Nonaktif'}</td>
                <td className="px-4 py-3 text-right">
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
                    className="p-1.5 text-slate-600 hover:text-amber-700"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </div>
  );
}

export function SuppliersPage() {
  const { suppliers, saveSupplier } = useInventory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setCode(`SUP-${String(suppliers.length + 1).padStart(2, '0')}`);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setActive(true);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSupplier({ id: editingId ?? undefined, code, name, contactPerson, phone, email, address, active });
    setShowForm(false);
    setMsg(`Supplier "${name}" berhasil disimpan.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Daftar pemasok resmi untuk pengadaan dan transaksi barang masuk.</p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900"
        >
          <Plus className="w-4 h-4" />
          Tambah Supplier
        </button>
      </div>
      {msg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">{msg}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
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
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-700">{s.contactPerson || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>{s.phone || '-'}</div>
                    <div>{s.email || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">{s.address || '-'}</td>
                  <td className="px-4 py-3 text-right">
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
                      className="p-1.5 text-slate-600 hover:text-amber-700"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
