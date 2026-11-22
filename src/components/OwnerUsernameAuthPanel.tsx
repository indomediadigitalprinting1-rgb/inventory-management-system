import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  internalAuthEmailToUsername,
  isInternalStaffAuthEmail,
} from '../domain/rules';
import type { UserAccount } from '../domain/types';
import { useInventory } from '../services/inventoryContext';

export function OwnerUsernameAuthPanel() {
  const {
    currentUser,
    users,
    createStaffUsernameAccount,
    resetStaffUsernamePassword,
    updateUserAccountRoleOrStatus,
    deleteUserAccount,
  } = useInventory();

  const usernameAccounts = useMemo(() => {
    return users
      .filter(
        (u) =>
          u.role !== 'OWNER' &&
          (u.authProvider === 'USERNAME_PASSWORD' || isInternalStaffAuthEmail(u.email) || Boolean(u.username))
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [users]);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'PRODUKSI'>('ADMIN');
  const [department, setDepartment] = useState('Gudang');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [active, setActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionUid, setActionUid] = useState<string | null>(null);

  const [resetTargetUid, setResetTargetUid] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  if (!currentUser || currentUser.role !== 'OWNER') {
    return null;
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const created = await createStaffUsernameAccount({
        name,
        username,
        password,
        confirmPassword,
        role,
        department,
        active,
      });
      const uname = created.username ?? internalAuthEmailToUsername(created.email) ?? username.trim().toLowerCase();
      setName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'ok',
        text: `Akun staf @${uname} (${created.role}) berhasil dibuat! Staf dapat langsung masuk melalui tab Username & Password tanpa email atau pengaturan tambahan.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membuat akun Username & Password staf.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u: UserAccount) => {
    setActionUid(u.uid);
    setFeedback(null);
    try {
      await updateUserAccountRoleOrStatus(u, {
        name: u.name,
        role: u.role,
        department: u.department,
        active: !u.active,
      });
      const uname = u.username ?? internalAuthEmailToUsername(u.email) ?? u.name;
      setFeedback({
        type: 'ok',
        text: !u.active
          ? `Akun @${uname} kembali diaktifkan.`
          : `Akun @${uname} dinonaktifkan. Pengguna tersebut langsung tidak bisa mengakses sistem.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah status akun.',
      });
    } finally {
      setActionUid(null);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent, u: UserAccount) => {
    e.preventDefault();
    setActionUid(u.uid);
    setFeedback(null);
    try {
      await resetStaffUsernamePassword(u, resetNewPassword);
      const uname = u.username ?? internalAuthEmailToUsername(u.email) ?? u.name;
      setResetTargetUid(null);
      setResetNewPassword('');
      setFeedback({
        type: 'ok',
        text: `Kata sandi untuk @${uname} berhasil diperbarui. Staf dapat langsung login menggunakan kata sandi baru.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui kata sandi staf.',
      });
    } finally {
      setActionUid(null);
    }
  };

  const handleDeleteStaff = async (u: UserAccount) => {
    setActionUid(u.uid);
    setFeedback(null);
    try {
      const uname = u.username ?? internalAuthEmailToUsername(u.email) ?? u.name;
      await deleteUserAccount(u);
      if (resetTargetUid === u.uid) {
        setResetTargetUid(null);
        setResetNewPassword('');
      }
      setFeedback({
        type: 'ok',
        text: `Akun @${uname} (${u.role}) berhasil dihapus dari sistem dan aksesnya langsung dicabut.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus akun staf.',
      });
    } finally {
      setActionUid(null);
    }
  };

  return (
    <section
      aria-labelledby="owner-username-pass-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
    >
      <div className="border-b border-slate-200 pb-4 space-y-1 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <KeyRound className="w-4 h-4 text-red-800 shrink-0" />
          <h2 id="owner-username-pass-heading" className="font-display text-base font-bold text-slate-900">
            Kelola Akun Staf (Username &amp; Password)
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Owner cukup membuatkan username dan kata sandi di sini, lalu Admin atau Produksi dapat langsung masuk ke rolenya di komputer toko tanpa memerlukan email atau pengaturan tambahan.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-start justify-between gap-2.5 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            aria-label="Tutup notifikasi akun staf"
            onClick={() => setFeedback(null)}
            className="text-current/70 hover:text-current shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Form Create Username & Password Account */}
        <form onSubmit={handleCreateAccount} className="lg:col-span-6 space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">Buat Akun Staf (Username &amp; Password)</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="up-name" className="block text-xs font-medium text-slate-700 mb-1">
                Nama Lengkap Staf
              </label>
              <input
                id="up-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Rina Kusuma"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label htmlFor="up-username" className="block text-xs font-medium text-slate-700 mb-1">
                Username Login
              </label>
              <input
                id="up-username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="contoh: admin_gudang"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="up-role" className="block text-xs font-medium text-slate-700 mb-1">
                Role Akses
              </label>
              <select
                id="up-role"
                value={role}
                onChange={(e) => {
                  const next = e.target.value as 'ADMIN' | 'PRODUKSI';
                  setRole(next);
                  if (next === 'ADMIN' && department === 'Produksi') setDepartment('Gudang');
                  if (next === 'PRODUKSI' && department === 'Gudang') setDepartment('Produksi');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="ADMIN">ADMIN (Maks 1 akun aktif)</option>
                <option value="PRODUKSI">PRODUKSI</option>
              </select>
            </div>
            <div>
              <label htmlFor="up-dept" className="block text-xs font-medium text-slate-700 mb-1">
                Departemen / Bagian
              </label>
              <input
                id="up-dept"
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Gudang / Produksi"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="up-password" className="block text-xs font-medium text-slate-700 mb-1">
                Kata Sandi (Min. 6 karakter)
              </label>
              <div className="relative">
                <input
                  id="up-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-3 pr-9 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="up-confirm-password" className="block text-xs font-medium text-slate-700 mb-1">
                Ulangi Kata Sandi
              </label>
              <input
                id="up-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Langsung aktifkan akun untuk login di komputer toko
          </label>

          <div className="pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-medium rounded-lg hover:bg-red-900 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {busy ? 'Membuat Akun...' : 'Buat Akun Username & Password'}
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Kata sandi diamankan dengan verifikasi terenkripsi dan tidak pernah disimpan dalam teks biasa. Format username: 3–32 karakter (a–z, 0–9, titik, garis bawah, atau hubung).
          </p>
        </form>

        {/* Registered Username & Password Staff Accounts */}
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Akun Username &amp; Password Terdaftar ({usernameAccounts.length})
          </h3>

          {usernameAccounts.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 leading-relaxed">
              Belum ada akun Username &amp; Password staf. Gunakan form di sebelah kiri untuk membuatkan akun Admin atau Produksi untuk komputer toko.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {usernameAccounts.map((u) => {
                const uname = u.username ?? internalAuthEmailToUsername(u.email) ?? u.email;
                const isRowBusy = actionUid === u.uid;
                const isResetting = resetTargetUid === u.uid;
                return (
                  <div key={u.uid} className="px-3.5 py-3 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 truncate">{u.name}</span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                            {u.role}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              u.active ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <div className="text-slate-600 font-mono text-[11px] mt-0.5">
                          Username: <span className="font-semibold text-slate-900">{uname}</span> · {u.department}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isRowBusy}
                          aria-label={`Reset kata sandi ${uname}`}
                          onClick={() => {
                            if (isResetting) {
                              setResetTargetUid(null);
                              setResetNewPassword('');
                            } else {
                              setResetTargetUid(u.uid);
                              setResetNewPassword('');
                              setShowResetPassword(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50"
                        >
                          <LockKeyhole className="w-3 h-3" />
                          Reset Sandi
                        </button>
                        <button
                          type="button"
                          disabled={isRowBusy}
                          aria-label={`${u.active ? 'Nonaktifkan' : 'Aktifkan'} akun ${uname}`}
                          onClick={() => void handleToggleActive(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50"
                        >
                          {u.active ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          disabled={isRowBusy}
                          aria-label={`Hapus akun ${uname}`}
                          onClick={() => void handleDeleteStaff(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 bg-red-50 text-red-800 rounded hover:bg-red-100 font-medium disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus
                        </button>
                      </div>
                    </div>

                    {isResetting && (
                      <form
                        onSubmit={(e) => void handleResetPasswordSubmit(e, u)}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2"
                      >
                        <div className="relative flex-1 min-w-[180px]">
                          <input
                            type={showResetPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            aria-label={`Kata sandi baru untuk ${uname}`}
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            placeholder={`Kata sandi baru untuk @${uname} (min. 6)`}
                            className="w-full pl-2.5 pr-8 py-1.5 text-xs border border-slate-300 rounded bg-white"
                          />
                          <button
                            type="button"
                            aria-label={showResetPassword ? 'Sembunyikan kata sandi baru' : 'Lihat kata sandi baru'}
                            onClick={() => setShowResetPassword((prev) => !prev)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                          >
                            {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={isRowBusy}
                          className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50"
                        >
                          {isRowBusy ? 'Menyimpan...' : 'Simpan Sandi'}
                        </button>
                        <button
                          type="button"
                          disabled={isRowBusy}
                          onClick={() => {
                            setResetTargetUid(null);
                            setResetNewPassword('');
                          }}
                          className="px-2.5 py-1.5 border border-slate-300 text-slate-700 text-xs rounded hover:bg-white"
                        >
                          Batal
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1 leading-relaxed">
            <div className="font-semibold text-slate-800">Catatan Pengelolaan Oleh Owner:</div>
            <p>
              • Staf tidak dapat membuat atau mengubah akun sendiri; seluruh akses dikendalikan penuh oleh Owner.
              <br />• Jika staf lupa kata sandi, klik <span className="font-semibold text-slate-800">Reset Sandi</span> pada akun terkait atau nonaktifkan/hapus akun lama kapan saja.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
