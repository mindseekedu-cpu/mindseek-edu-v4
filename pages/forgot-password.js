import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Email tidak valid.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/parent/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await res.json();

      setMessage(
        data?.message ||
          'Jika email terdaftar, link reset akan dikirim. Cek inbox/spam Anda.'
      );
      setEmail('');
    } catch (err) {
      setError('Gagal terhubung ke server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Lupa Password</title>
      </Head>

      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
          <div className="w-full rounded-2xl bg-white p-8 shadow-md ring-1 ring-slate-200">
            <div className="text-center">
              <p className="text-sm font-medium text-sky-600">MindSeek Edu</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Lupa Password
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Masukkan email parent Anda, kami akan mengirimkan link untuk
                reset password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="contoh@email.com"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {message ? (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              ) : null}

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
                {loading ? 'Mengirim...' : 'Kirim Link Reset'}
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
          </div>
        </div>
      </main>
    </>
  );
}