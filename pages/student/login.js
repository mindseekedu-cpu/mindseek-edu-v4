import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function StudentLoginPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function sanitizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function validateForm() {
    const nextErrors = {};
    const normalizedStudentId = sanitizeDigits(studentId);
    const normalizedPin = sanitizeDigits(pin);

    if (!normalizedStudentId) {
      nextErrors.studentId = 'Student ID wajib diisi';
    } else if (!/^\d{6}$/.test(normalizedStudentId)) {
      nextErrors.studentId = 'Student ID harus 6 digit angka';
    }

    if (!normalizedPin) {
      nextErrors.pin = 'PIN wajib diisi';
    } else if (!/^\d{6}$/.test(normalizedPin)) {
      nextErrors.pin = 'PIN harus 6 digit angka';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        studentId: sanitizeDigits(studentId),
        pin: sanitizeDigits(pin),
      };

      const response = await fetch('/api/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setServerError(result?.message || 'Login gagal. Silakan coba lagi.');
        return;
      }

      const redirectTo = result?.redirect || '/student/dashboard';
      await router.push(redirectTo);
    } catch (error) {
      setServerError('Terjadi kesalahan koneksi. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Login Siswa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur md:grid-cols-2">
            <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 md:flex">
              <div>
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90">
                  Student Portal
                </div>
                <h1 className="mt-6 text-4xl font-bold leading-tight">
                  Belajar lebih fokus, masuk dengan akun siswa.
                </h1>
                <p className="mt-4 max-w-md text-base leading-7 text-white/85">
                  Gunakan Student ID dan PIN untuk membuka dashboard belajar, melihat chat
                  terakhir, serta melanjutkan latihan harianmu.
                </p>
              </div>

              <div className="space-y-4 text-sm text-white/85">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="font-semibold">Akses cepat</p>
                  <p className="mt-1">
                    Login siswa dirancang sederhana: cukup 6 digit Student ID dan 6 digit PIN.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="font-semibold">Aman</p>
                  <p className="mt-1">
                    Setelah login berhasil, kamu akan diarahkan langsung ke dashboard siswa.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 text-slate-900 sm:p-8 md:p-10">
              <div className="mx-auto w-full max-w-md">
                <div className="mb-8">
                  <div className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                    Login Siswa
                  </div>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
                    Masuk ke dashboard
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Masukkan Student ID dan PIN untuk melanjutkan belajar.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="studentId"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Student ID
                    </label>
                    <input
                      id="studentId"
                      name="studentId"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={studentId}
                      onChange={(event) => {
                        setStudentId(sanitizeDigits(event.target.value).slice(0, 6));
                        if (errors.studentId) {
                          setErrors((prev) => ({ ...prev, studentId: '' }));
                        }
                      }}
                      className={`block w-full rounded-2xl border px-4 py-3 text-base outline-none transition ${
                        errors.studentId
                          ? 'border-red-400 bg-red-50 focus:border-red-500'
                          : 'border-slate-200 bg-white focus:border-indigo-500'
                      }`}
                      placeholder="Contoh: 123456"
                    />
                    {errors.studentId ? (
                      <p className="mt-2 text-sm text-red-600">{errors.studentId}</p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">Student ID harus 6 digit angka.</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="pin" className="mb-2 block text-sm font-semibold text-slate-700">
                      PIN
                    </label>
                    <input
                      id="pin"
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={pin}
                      onChange={(event) => {
                        setPin(sanitizeDigits(event.target.value).slice(0, 6));
                        if (errors.pin) {
                          setErrors((prev) => ({ ...prev, pin: '' }));
                        }
                      }}
                      className={`block w-full rounded-2xl border px-4 py-3 text-base outline-none transition ${
                        errors.pin
                          ? 'border-red-400 bg-red-50 focus:border-red-500'
                          : 'border-slate-200 bg-white focus:border-indigo-500'
                      }`}
                      placeholder="Masukkan 6 digit PIN"
                    />
                    {errors.pin ? (
                      <p className="mt-2 text-sm text-red-600">{errors.pin}</p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">PIN harus berupa 6 digit angka.</p>
                    )}
                  </div>

                  {serverError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {serverError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Memproses...' : 'Login'}
                  </button>
                </form>

                <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href="#"
                    className="font-medium text-indigo-600 transition hover:text-indigo-700"
                  >
                    Lupa PIN
                  </Link>

                  <Link
                    href="/login"
                    className="font-medium text-slate-700 transition hover:text-slate-900"
                  >
                    Login sebagai Parent
                  </Link>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Tips</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Pastikan Student ID dan PIN diisi lengkap 6 digit angka sebelum menekan tombol
                    login.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}