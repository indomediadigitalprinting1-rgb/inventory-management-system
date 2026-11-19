import React, { useMemo, useState } from 'react';
import { Download, Plus, ShieldCheck, SlidersHorizontal, UserPlus, X } from 'lucide-react';
import type { AdjustmentType, UserAccount, UserRole } from '../domain/types';
import { useInventory } from '../services/inventoryContext';

export function UsersPage() {
  const {
    users,
    invites,
    adminSlot,
    saveUserInvite,
    updateUserAccountRoleOrStatus,
  } = useInventory();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'PRODUKSI'>('PRODUKSI');
  const [department, setDepartment] = useState('Produksi');
  const [active, setActive] = useState(true);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSaveInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await saveUserInvite({ name, email, role, department, active });
      setShowInviteModal(false);
      setName('');
      setEmail('');
      setFeedback({ type: 'ok', text: `Otorisasi akun ${email} (${role}) berhasil disimpan.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan pengguna.' });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setBusy(true);
    setFeedback(null);
    try {
      await updateUserAccountRoleOrStatus(editingUser, {
        name,
        role: role as UserRole,
        department,
        active,
      });
      setEditingUser(null);
      setFeedback({ type: 'ok', text: `Akun ${editingUser.email} berhasil diperbarui.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memperbarui akun.' });
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

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Kebijakan Multi-User Terkunci di Database</span>
          </div>
          <p className="text-xs text-slate-600">
            Slot Admin Gudang (Maksimal 1):{' '}
            <span className="font-semibold text-slate-900">
              {adminSlot?.occupied ? `Terisi (${adminSlot.adminEmail})` : 'Tersedia (0/1)'}
            </span>{' '}
            · Akun Produksi dapat dibuat lebih dari satu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setName('');
            setEmail('');
            setRole('PRODUKSI');
            setDepartment('Produksi');
            setActive(true);
            setFeedback(null);
            setShowInviteModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Akun Admin / Produksi
        </button>
      </div>

      {/* Active Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-semibold text-slate-900">
          Pengguna Aktif Terdaftar ({users.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Departemen</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{u.role}</td>
                  <td className="px-4 py-3 text-slate-600">{u.department}</td>
                  <td className="px-4 py-3 text-xs">{u.active ? 'Aktif' : 'Nonaktif'}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u);
                          setName(u.name);
                          setRole(u.role === 'ADMIN' ? 'ADMIN' : 'PRODUKSI');
                          setDepartment(u.department);
                          setActive(u.active);
                        }}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Ubah
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioned Invites */}
      {invites.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-semibold text-slate-900">
            Daftar Otorisasi / Undangan ({invites.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Email Diizinkan</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status Klaim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.name}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.email}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.role}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {inv.claimedUid ? 'Sudah Aktivasi' : 'Menunggu Login Pertama'} · {inv.active ? 'Aktif' : 'Nonaktif'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Otorisasi Akun Pengguna Baru
              </h2>
              <button type="button" aria-label="Tutup modal pengguna" onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}
            <form onSubmit={handleSaveInvite} className="space-y-3">
              <div>
                <label htmlFor="usr-name" className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input id="usr-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label htmlFor="usr-email" className="block text-xs font-medium text-slate-700 mb-1">Email Google / Akun</label>
                <input id="usr-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="usr-role" className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    id="usr-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'ADMIN' | 'PRODUKSI')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PRODUKSI">PRODUKSI</option>
                    <option value="ADMIN">ADMIN (Maks 1)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="usr-dept" className="block text-xs font-medium text-slate-700 mb-1">Departemen</label>
                  <input id="usr-dept" required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">
                  Simpan Otorisasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Existing User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Ubah Pengguna: {editingUser.email}
              </h2>
              <button type="button" aria-label="Tutup modal edit pengguna" onClick={() => setEditingUser(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            {feedback?.type === 'err' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{feedback.text}</div>
            )}
            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div>
                <label htmlFor="eu-name" className="block text-xs font-medium text-slate-700 mb-1">Nama</label>
                <input id="eu-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="eu-role" className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select id="eu-role" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'PRODUKSI')} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    <option value="PRODUKSI">PRODUKSI</option>
                    <option value="ADMIN">ADMIN (Maks 1)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="eu-dept" className="block text-xs font-medium text-slate-700 mb-1">Departemen</label>
                  <input id="eu-dept" required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Akun Aktif
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditLogsPage() {
  const { auditLogs } = useInventory();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...auditLogs]
      .filter(
        (l) =>
          !q ||
          l.actorName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [auditLogs, search]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          aria-label="Cari catatan audit log"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pelaku, aksi, atau deskripsi aktivitas..."
          className="w-full max-w-sm px-3 py-2 text-sm border border-slate-300 rounded-lg"
        />
        <span className="text-xs text-slate-500">Jejak Audit Permanen ({filtered.length} entri)</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Belum ada catatan audit log.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Pengguna</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                  <th className="px-4 py-3 font-medium">Entitas</th>
                  <th className="px-4 py-3 font-medium">Deskripsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {l.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{l.actorName}</span>{' '}
                      <span className="text-xs text-slate-500">· {l.actorRole}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{l.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{l.entityType}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{l.description}</td>
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

export function SettingsPage() {
  const {
    systemConfig,
    items,
    adjustments,
    updateSystemSettings,
    submitStockAdjustment,
    exportBackupJson,
  } = useInventory();

  const [companyName, setCompanyName] = useState(systemConfig?.companyName || 'PT Manufaktur Nusantara');
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(
    systemConfig?.lowStockAlertEnabled ?? true
  );

  // Stock Adjustment state (Owner only)
  const [adjItemId, setAdjItemId] = useState(items[0]?.id ?? '');
  const [adjType, setAdjType] = useState<AdjustmentType>('OPNAME');
  const [adjValue, setAdjValue] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await updateSystemSettings({ companyName, lowStockAlertEnabled });
      setFeedback({ type: 'ok', text: 'Pengaturan sistem berhasil disimpan.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.' });
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = items.find((i) => i.id === (adjItemId || items[0]?.id));
    if (!target) return;
    setBusy(true);
    setFeedback(null);
    try {
      await submitStockAdjustment({
        item: target,
        type: adjType,
        value: adjValue,
        reason: adjReason,
      });
      setAdjReason('');
      setFeedback({ type: 'ok', text: `Penyesuaian stok untuk ${target.name} berhasil dicatat ke kartu stok.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyesuaikan stok.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ims-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
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

      <div className="grid lg:grid-cols-12 gap-6">
        {/* General Settings & Backup */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <h2 className="font-display text-base font-bold text-slate-900">
            Pengaturan Sistem &amp; Backup Database
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label htmlFor="set-company" className="block text-xs font-medium text-slate-700 mb-1">
                Nama Perusahaan (Kop Laporan &amp; Bukti PDF)
              </label>
              <input
                id="set-company"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lowStockAlertEnabled}
                onChange={(e) => setLowStockAlertEnabled(e.target.checked)}
              />
              Aktifkan notifikasi otomatis stok minimum
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
            >
              Simpan Pengaturan
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <h3 className="text-xs font-semibold text-slate-800">Backup Data Operasional</h3>
            <p className="text-xs text-slate-500">
              Unduh salinan lengkap master data, transaksi, kartu stok, dan audit log dalam format JSON terstruktur.
            </p>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              Unduh Backup Database (.json)
            </button>
          </div>
        </div>

        {/* Owner Stock Adjustment / Opname */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-red-800" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Penyesuaian Stok &amp; Stock Opname (Khusus Owner)
            </h2>
          </div>

          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="adj-item" className="block text-xs font-medium text-slate-700 mb-1">Barang</label>
                <select
                  id="adj-item"
                  value={adjItemId || items[0]?.id || ''}
                  onChange={(e) => setAdjItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} - {i.name} (Saat ini: {i.currentStock} {i.unitName})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="adj-type" className="block text-xs font-medium text-slate-700 mb-1">Metode</label>
                  <select
                    id="adj-type"
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as AdjustmentType)}
                    className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="OPNAME">Opname (Set Saldo)</option>
                    <option value="INCREASE">Tambah (+)</option>
                    <option value="DECREASE">Kurangi (-)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="adj-val" className="block text-xs font-medium text-slate-700 mb-1">Nilai</label>
                  <input
                    id="adj-val"
                    type="number"
                    min={0}
                    required
                    value={adjValue}
                    onChange={(e) => setAdjValue(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="adj-reason" className="block text-xs font-medium text-slate-700 mb-1">
                Alasan Penyesuaian (Wajib)
              </label>
              <input
                id="adj-reason"
                required
                minLength={3}
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Contoh: Hasil stock opname fisik Gudang Utama"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={busy || items.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Catat Penyesuaian Stok
            </button>
          </form>

          {adjustments.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">Riwayat Penyesuaian Terbaru</h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
                {adjustments.slice(0, 5).map((a) => (
                  <div key={a.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-semibold">{a.txNumber}</span> · {a.itemName} ({a.reason})
                    </div>
                    <span className="font-mono font-semibold whitespace-nowrap">
                      {a.previousStock} → {a.newStock}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
