import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  KeyRound,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  getNonOwnerUsers,
  internalAuthEmailToUsername,
  isInternalStaffAuthEmail,
} from '../domain/rules';
import type { AdjustmentType, UserAccount, UserRole } from '../domain/types';
import { OwnerUsernameAuthPanel } from '../components/OwnerUsernameAuthPanel';
import { OwnerQuotaIndicator } from '../components/OwnerQuotaIndicator';
import { useInventory } from '../services/inventoryContext';

export function UsersPage() {
  const {
    currentUser,
    systemConfig,
    users,
    invites,
    adminSlot,
    setActiveRoute,
    saveUserInvite,
    createStaffUsernameAccount,
    updateUserAccountRoleOrStatus,
    deleteUserAccount,
    deleteUserInvite,
    deleteAllNonOwnerUsers,
  } = useInventory();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [accountMethod, setAccountMethod] = useState<'USERNAME_PASSWORD' | 'GOOGLE_EMAIL'>('USERNAME_PASSWORD');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'PRODUKSI'>('PRODUKSI');
  const [department, setDepartment] = useState('Produksi');
  const [active, setActive] = useState(true);
  const [initialPassword, setInitialPassword] = useState('');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nonOwnerUsers = useMemo(() => getNonOwnerUsers(users), [users]);
  const hasCleanupTargets =
    nonOwnerUsers.length > 0 || invites.length > 0 || Boolean(adminSlot?.occupied);

  const handleCreateUserOrInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setModalError(null);
    setFeedback(null);
    try {
      if (accountMethod === 'USERNAME_PASSWORD') {
        const created = await createStaffUsernameAccount({
          name,
          username,
          password: initialPassword,
          role,
          department,
          active,
        });
        const uname = created.username ?? internalAuthEmailToUsername(created.email) ?? username.trim().toLowerCase();
        setShowInviteModal(false);
        setName('');
        setUsername('');
        setInitialPassword('');
        setFeedback({
          type: 'ok',
          text: `Akun Username & Password "@${uname}" (${role}) berhasil dibuat oleh Owner. Staf dapat langsung login di komputer toko lewat tab Username & Password.`,
        });
      } else {
        await saveUserInvite({ name, email, role, department, active });
        const savedEmail = email.trim().toLowerCase();
        setShowInviteModal(false);
        setName('');
        setEmail('');
        setFeedback({
          type: 'ok',
          text: `Otorisasi akun Google untuk ${savedEmail} (${role}) berhasil disimpan. Pengguna dapat masuk melalui tab Akun Google.`,
        });
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Gagal menyimpan akun pengguna.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setBusy(true);
    setModalError(null);
    setFeedback(null);
    try {
      await updateUserAccountRoleOrStatus(editingUser, {
        name,
        role: role as UserRole,
        department,
        active,
      });
      const label = editingUser.email;
      setEditingUser(null);
      setFeedback({ type: 'ok', text: `Akun ${label} berhasil diperbarui.` });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Gagal memperbarui akun.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setBusy(true);
    setFeedback(null);
    try {
      const label = deletingUser.email;
      await deleteUserAccount(deletingUser);
      setDeletingUser(null);
      setFeedback({ type: 'ok', text: `Akun ${label} berhasil dihapus dari daftar pengguna.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus akun.' });
      setDeletingUser(null);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCleanupNonOwners = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await deleteAllNonOwnerUsers();
      setConfirmCleanupOpen(false);
      setFeedback({
        type: 'ok',
        text: `Pembersihan selesai: ${res.deletedUsers} pengguna lain dan ${res.deletedInvites} undangan dihapus. Kini hanya akun Owner yang tersisa.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membersihkan data pengguna.',
      });
      setConfirmCleanupOpen(false);
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
            <span>Otorisasi &amp; Kebijakan Slot Admin</span>
          </div>
          <p className="text-xs text-slate-600">
            Slot Admin Gudang (Maksimal 1):{' '}
            <span className="font-semibold text-slate-900">
              {adminSlot?.occupied
                ? `Terisi (${
                    internalAuthEmailToUsername(adminSlot.adminEmail)
                      ? `@${internalAuthEmailToUsername(adminSlot.adminEmail)}`
                      : adminSlot.adminEmail
                  })`
                : 'Tersedia (0/1)'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveRoute('settings')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4 text-slate-600" />
            Kelola Username &amp; Password
          </button>
          {hasCleanupTargets && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFeedback(null);
                setConfirmCleanupOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-300 bg-red-50 text-red-800 text-xs font-medium rounded-lg hover:bg-red-100 whitespace-nowrap disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Pengguna Lain (Sisakan Owner)
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAccountMethod('USERNAME_PASSWORD');
              setName('');
              setUsername('');
              setEmail('');
              setRole('PRODUKSI');
              setDepartment('Produksi');
              setActive(true);
              setInitialPassword('');
              setModalError(null);
              setFeedback(null);
              setShowInviteModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            Tambah / Otorisasi Pengguna
          </button>
        </div>
      </div>

      {/* Active Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">
            Pengguna Aktif / Terdaftar ({users.length})
          </span>
          {nonOwnerUsers.length === 0 && (
            <span className="text-xs text-slate-500">Hanya akun Owner aktif</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Username / Email Login</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Departemen</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const staffUsername =
                  u.username ??
                  (isInternalStaffAuthEmail(u.email) ? internalAuthEmailToUsername(u.email) : null);
                return (
                <tr key={u.uid} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {staffUsername ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900">@{staffUsername}</span>
                        <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          Username &amp; Password
                        </span>
                      </div>
                    ) : (
                      u.email
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{u.role}</td>
                  <td className="px-4 py-3 text-slate-600">{u.department}</td>
                  <td className="px-4 py-3 text-xs">{u.active ? 'Aktif' : 'Nonaktif'}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'OWNER' ? (
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setName(u.name);
                            setRole(u.role === 'ADMIN' ? 'ADMIN' : 'PRODUKSI');
                            setDepartment(u.department);
                            setActive(u.active);
                            setModalError(null);
                          }}
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingUser(u)}
                          className="text-xs font-medium text-red-700 hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : systemConfig?.ownerUid &&
                      systemConfig.ownerUid === currentUser?.uid &&
                      u.uid !== currentUser.uid ? (
                      <button
                        type="button"
                        onClick={() => setDeletingUser(u)}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Hapus Owner Ganda
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Owner Utama</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioned Invites */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-semibold text-slate-900">
          Daftar Otorisasi / Undangan ({invites.length})
        </div>
        {invites.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Belum ada undangan otorisasi pengguna baru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Email Diizinkan</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status Klaim</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setFeedback(null);
                          try {
                            await deleteUserInvite(inv);
                            setFeedback({ type: 'ok', text: `Undangan ${inv.email} berhasil dihapus.` });
                          } catch (err) {
                            setFeedback({
                              type: 'err',
                              text: err instanceof Error ? err.message : 'Gagal menghapus undangan.',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">Tambah Akun Pengguna Baru</h2>
              <button type="button" aria-label="Tutup modal tambah pengguna" onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAccountMethod('USERNAME_PASSWORD');
                  setModalError(null);
                }}
                className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  accountMethod === 'USERNAME_PASSWORD'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Username &amp; Password (Toko)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountMethod('GOOGLE_EMAIL');
                  setModalError(null);
                }}
                className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  accountMethod === 'GOOGLE_EMAIL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Email Google
              </button>
            </div>
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{modalError}</div>
            )}
            <form onSubmit={handleCreateUserOrInvite} className="space-y-3">
              <div>
                <label htmlFor="inv-name" className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input id="inv-name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              {accountMethod === 'USERNAME_PASSWORD' ? (
                <>
                  <div>
                    <label htmlFor="inv-username" className="block text-xs font-medium text-slate-700 mb-1">
                      Username Login (Dibuat oleh Owner)
                    </label>
                    <input
                      id="inv-username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={32}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="contoh: admin_gudang"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-init-pass" className="block text-xs font-medium text-slate-700 mb-1">
                      Kata Sandi Awal (Min. 6 karakter)
                    </label>
                    <input
                      id="inv-init-pass"
                      type="password"
                      required
                      minLength={6}
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="inv-email" className="block text-xs font-medium text-slate-700 mb-1">Email Akun Google</label>
                  <input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inv-role" className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    id="inv-role"
                    value={role}
                    onChange={(e) => {
                      const nextRole = e.target.value as 'ADMIN' | 'PRODUKSI';
                      setRole(nextRole);
                      if (department === 'Produksi' && nextRole === 'ADMIN') {
                        setDepartment('Gudang');
                      } else if (department === 'Gudang' && nextRole === 'PRODUKSI') {
                        setDepartment('Produksi');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PRODUKSI">PRODUKSI</option>
                    <option value="ADMIN">ADMIN (Maks 1)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="inv-dept" className="block text-xs font-medium text-slate-700 mb-1">Departemen</label>
                  <input id="inv-dept" required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Langsung Aktifkan Akun
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 border border-slate-300 text-sm rounded-lg">Batal</button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg">
                  {busy
                    ? 'Menyimpan...'
                    : accountMethod === 'USERNAME_PASSWORD'
                    ? 'Buat Akun Username'
                    : 'Simpan Otorisasi Google'}
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
              <h2 className="font-display text-base font-bold text-slate-900">Ubah Pengguna: {editingUser.email}</h2>
              <button type="button" aria-label="Tutup modal edit pengguna" onClick={() => setEditingUser(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{modalError}</div>
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

      {/* Delete Single Non-Owner User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="font-display text-base font-bold text-slate-900">Hapus Akun Pengguna</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hapus akun <span className="font-semibold text-slate-900">{deletingUser.name}</span> ({deletingUser.email}, role {deletingUser.role})? Akses pengguna ini akan langsung dicabut.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 border border-slate-300 text-sm rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmDeleteUser()}
                className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 disabled:opacity-60"
              >
                {busy ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup All Non-Owner Users Confirmation Modal */}
      {confirmCleanupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Hapus Semua Pengguna Lain?
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tindakan ini akan menghapus <span className="font-semibold text-slate-900">{nonOwnerUsers.length} akun pengguna lain</span> dan <span className="font-semibold text-slate-900">{invites.length} undangan</span> dari database, mengosongkan slot Admin (0/1), serta menyisakan <span className="font-semibold text-slate-900">data Owner saja</span>. Riwayat transaksi &amp; stok barang tetap aman.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCleanupOpen(false)}
                className="px-4 py-2 border border-slate-300 text-sm rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmCleanupNonOwners()}
                className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 disabled:opacity-60"
              >
                {busy ? 'Membersihkan...' : 'Ya, Sisakan Owner Saja'}
              </button>
            </div>
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

      <OwnerQuotaIndicator variant="detailed" />

      <OwnerUsernameAuthPanel />

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
            <h3 className="text-xs font-semibold text-slate-800">Keamanan Sesi Otomatis</h3>
            <p className="text-xs text-slate-500">
              Demi keamanan internal, sesi akun otomatis logout apabila seluruh tab browser aplikasi ditutup lebih dari <span className="font-semibold text-slate-700">5 menit</span>.
            </p>
          </div>

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
