import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = String(email || "").trim().toLowerCase();
    if (!trimmedEmail) return setError("Email wajib diisi.");
    if (!password) return setError("Password wajib diisi.");

    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.message || "Login gagal. Silakan coba lagi.");
        return;
      }

      await router.replace("/admin/dashboard");
    } catch (err) {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Admin Login</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Admin Login</h1>
              <p className="mt-1 text-sm text-gray-600">
                Masuk untuk mengakses dashboard admin.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mindseek.edu"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>

              <p className="text-xs text-gray-500">
                Setelah login berhasil, cookie <span className="font-mono">admin_token</span> akan
                diset oleh API dan Anda akan diarahkan ke <span className="font-mono">/admin/dashboard</span>.
              </p>
            </form>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            MindSeek Edu • Admin Panel
          </div>
        </div>
      </div>
    </>
  );
}