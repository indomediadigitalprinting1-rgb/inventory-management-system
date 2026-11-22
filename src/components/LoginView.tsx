import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  User,
  Warehouse,
} from 'lucide-react';
import { useInventory } from '../services/inventoryContext';
import { Logo } from './Logo';

export function LoginView() {
  const {
    authStage,
    firebaseUser,
    authError,
    loginWithGoogle,
    loginWithUsername,
    resendVerificationEmail,
    initializeFirstOwner,
    logout,
  } = useInventory();

  const [mode, setMode] = useState<'google' | 'username'>('google');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState('PT Manufaktur Nusantara');
  const [ownerName, setOwnerName] = useState(firebaseUser?.displayName ?? 'Owner Utama');
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setLocalMsg(null);
    try {
      await loginWithUsername(username, password);
    } finally {
      setBusy(false);
    }
  };

  const handleInitOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !ownerName.trim()) return;
    setBusy(true);
    setLocalMsg(null);
    try {
      await initializeFirstOwner(companyName, ownerName);
    } catch (err) {
      setLocalMsg(err instanceof Error ? err.message : 'Gagal menginisialisasi Owner.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    try {
      await resendVerificationEmail();
      setLocalMsg('Email verifikasi telah dikirim ulang. Periksa kotak masuk Anda lalu muat ulang halaman.');
    } catch (err) {
      setLocalMsg(err instanceof Error ? err.message : 'Gagal mengirim email verifikasi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12">
      {/* Left Architectural Panel */}
      <div className="hidden lg:flex lg:col-span-5 relative bg-slate-900 overflow-hidden flex-col justify-between p-10 text-white">
        {!imgError ? (
          <img
            src="/src/assets/images/login_warehouse_hero_1795008687459.jpg"
            alt="Fasilitas Gudang Industri Modern"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 flex items-center justify-center">
            <Warehouse className="w-24 h-24 text-slate-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-slate-950/75" />

        <div className="relative z-10">
          <Logo light />
        </div>

        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="font-display text-3xl font-bold leading-tight text-white [text-wrap:balance]">
            Kendali Stok Real-Time untuk Gudang &amp; Lini Produksi
          </h1>
          <p className="text-sm text-slate-200 leading-relaxed">
            Satu platform terpadu untuk master barang Code 128, penerimaan supplier, permintaan produksi bertahap, kartu stok permanen, dan audit log berbasis peran.
          </p>
          <div className="pt-4 border-t border-white/15 flex items-center gap-4 text-xs text-slate-300">
            <span>Owner · Admin Gudang · Staf Produksi</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="lg:hidden pb-2">
            <Logo />
          </div>

          {authStage === 'LOADING' && (
            <div className="py-10 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-red-800 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-600">Memverifikasi sesi dan hak akses...</p>
            </div>
          )}

          {authStage === 'UNAUTHENTICATED' && (
            <>
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl font-bold text-slate-900">Masuk ke Sistem</h2>
                <p className="text-sm text-slate-600">
                  Owner menggunakan Akun Google, sedangkan staf komputer toko masuk memakai Username &amp; Password dari Owner.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode('google');
                    setLocalMsg(null);
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    mode === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Akun Google
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('username');
                    setLocalMsg(null);
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    mode === 'username' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Username &amp; Password
                </button>
              </div>

              {(authError || localMsg) && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError || localMsg}</span>
                </div>
              )}

              {mode === 'google' ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loginWithGoogle()}
                    className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Masuk dengan Google
                  </button>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Login pertama kali pada sistem baru akan membuka proses inisialisasi akun Owner utama secara aman. Pengguna Admin &amp; Produksi wajib dibuatkan akun oleh Owner.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUsernameLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-username" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-username"
                        type="text"
                        required
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="contoh: admin_gudang"
                        className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 transition-colors disabled:opacity-60"
                  >
                    Masuk dengan Username
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Akun username &amp; kata sandi wajib dibuatkan dan dikelola langsung oleh Owner melalui menu <span className="font-semibold text-slate-700">Pengguna</span> atau <span className="font-semibold text-slate-700">Pengaturan</span>.
                  </p>
                </form>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Keamanan sesi: akun otomatis keluar jika seluruh tab browser aplikasi ditutup lebih dari 5 menit.
                </span>
              </div>
            </>
          )}

          {authStage === 'NEEDS_OWNER_INIT' && (
            <form onSubmit={handleInitOwner} className="space-y-5">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-slate-900">Inisialisasi Owner Utama</h2>
                <p className="text-xs text-slate-600">
                  Sistem belum memiliki Owner terdaftar. Akun <span className="font-medium text-slate-900">{firebaseUser?.email}</span> akan ditetapkan sebagai Owner utama.
                </p>
              </div>
              {localMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">{localMsg}</div>
              )}
              <div>
                <label htmlFor="init-company" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nama Perusahaan / Pabrik
                </label>
                <input
                  id="init-company"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-800"
                />
              </div>
              <div>
                <label htmlFor="init-owner" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nama Lengkap Owner
                </label>
                <input
                  id="init-owner"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-800"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 px-4 py-2.5 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 transition-colors"
                >
                  Simpan &amp; Masuk sebagai Owner
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  Keluar
                </button>
              </div>
            </form>
          )}

          {authStage === 'EMAIL_UNVERIFIED' && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-slate-900">Verifikasi Email Diperlukan</h2>
              <p className="text-sm text-slate-600">
                Untuk keamanan transaksi dan kontrol akses, alamat email <span className="font-medium text-slate-900">{firebaseUser?.email}</span> harus terverifikasi terlebih dahulu.
              </p>
              {localMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{localMsg}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={busy}
                  className="px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800"
                >
                  Kirim Ulang Verifikasi
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  Saya Sudah Verifikasi
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="px-4 py-2.5 text-slate-600 text-sm hover:text-slate-900"
                >
                  Keluar
                </button>
              </div>
            </div>
          )}

          {(authStage === 'UNAUTHORIZED_NO_INVITE' || authStage === 'INACTIVE_ACCOUNT') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-red-800">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {authStage === 'INACTIVE_ACCOUNT' ? 'Akun Dinonaktifkan' : 'Akses Belum Diotorisasi'}
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                {authStage === 'INACTIVE_ACCOUNT'
                  ? 'Akun Anda berstatus nonaktif. Hubungi Owner perusahaan untuk mengaktifkan kembali.'
                  : 'Akun Anda belum terdaftar atau belum dibuatkan akses oleh Owner. Hubungi Owner perusahaan melalui menu Pengguna.'}
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
              >
                Ganti Akun / Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
