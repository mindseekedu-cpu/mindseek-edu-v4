import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const tokenValue = useMemo(() => {
    if (Array.isArray(token)) return token[0] || '';
    return token || '';
  }, [token]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isTokenReady = router.isReady;
  const isTokenInvalid = isTokenReady && !tokenValue;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!tokenValue) {
      setError('Token tidak valid.');
      return;
    }

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/parent/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenValue,
          newPassword: password,
        }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setMessage(data.message || 'Password berhasil direset. Silakan login.');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(data?.message || 'Gagal mereset password.');
      }
    } catch (err) {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password</title>
      </Head>

      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
          <div className="w-full rounded-2xl bg-white p-8 shadow-md ring-1 ring-slate-200">
            <div className="text-center">
              <p className="text-sm font-medium text-sky-600">MindSeek Edu</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Reset Password
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Masukkan password baru untuk akun parent Anda.
              </p>
            </div>

            {!isTokenReady ? (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                Memuat token reset...
              </div>
            ) : isTokenInvalid ? (
              <div className="mt-6 text-center">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Token tidak valid.
                </div>
                <Link
                  href="/login"
                  className="mt-4 inline-block text-sm font-medium text-sky-600 transition hover:text-sky-700 hover:underline"
                >
                  Kembali ke Login
                </Link>
              </div>
            ) : message ? (
              <div className="mt-6 text-center">
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
                <Link
                  href="/login"
                  className="mt-4 inline-block text-sm font-medium text-sky-600 transition hover:text-sky-700 hover:underline"
                >
                  Kembali ke Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password Baru
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="Minimal 8 karakter"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Konfirmasi Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="Ulangi password baru"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Menyimpan...' : 'Reset Password'}
                </button>

                <div className="text-center text-sm">
                  <Link
                    href="/login"
                    className="font-medium text-sky-600 transition hover:text-sky-700 hover:underline"
                  >
                    Kembali ke Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}