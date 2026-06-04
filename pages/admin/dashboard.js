import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("id-ID", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function smallId(v) {
  const s = String(v || "");
  if (!s) return "-";
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return {};
  }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ withdrawalClaims: [], redemptionClaims: [], parents: [], admin: null });
  const [busyKey, setBusyKey] = useState("");
  const [toast, setToast] = useState("");

  const withdrawalPending = useMemo(() => data.withdrawalClaims || [], [data.withdrawalClaims]);
  const redemptionPending = useMemo(() => data.redemptionClaims || [], [data.redemptionClaims]);
  const parents = useMemo(() => data.parents || [], [data.parents]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/data", { method: "GET", credentials: "include" });
      const json = await safeJson(res);
      if (!res.ok || !json?.success) {
        setError(json?.message || "Gagal memuat data admin.");
        return;
      }
      setData(json.data);
    } catch (e) {
      setError("Terjadi kesalahan jaringan saat memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function postProcessClaim(payload, key) {
    setBusyKey(key);
    setToast("");
    setError("");
    try {
      const res = await fetch("/api/admin/process-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await safeJson(res);
      if (!res.ok || !json?.success) {
        setError(json?.message || "Proses gagal.");
        return;
      }
      setToast("Berhasil diproses.");
      await load();
    } catch (_) {
      setError("Terjadi kesalahan jaringan saat memproses.");
    } finally {
      setBusyKey("");
      window.setTimeout(() => setToast(""), 2500);
    }
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Panel minimal untuk memproses klaim dan mengelola status parent.
              </p>
              {data?.admin?.email ? (
                <p className="mt-1 text-xs text-gray-500">
                  Login sebagai: <span className="font-mono">{data.admin.email}</span>
                </p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                onClick={load}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
                disabled={loading}
              >
                {loading ? "Memuat..." : "Refresh"}
              </button>
            </div>
          </div>

          {toast ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {toast}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Withdrawal Claims (Pending)</h2>
                <p className="mt-1 text-sm text-gray-600">Tarik cuan yang menunggu keputusan admin.</p>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-sm text-gray-600">Memuat...</div>
                ) : withdrawalPending.length === 0 ? (
                  <div className="text-sm text-gray-600">Tidak ada klaim pending.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="py-2 pr-3">ID</th>
                          <th className="py-2 pr-3">Parent</th>
                          <th className="py-2 pr-3">Poin</th>
                          <th className="py-2 pr-3">Dibuat</th>
                          <th className="py-2">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {withdrawalPending.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2 pr-3 font-mono text-xs text-gray-700">{smallId(c.id)}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-gray-700">{smallId(c.parent_id || c.parentId)}</td>
                            <td className="py-2 pr-3 text-gray-800">{c.points ?? c.amount_points ?? c.points_amount ?? "-"}</td>
                            <td className="py-2 pr-3 text-gray-700">{formatDate(c.created_at)}</td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    postProcessClaim(
                                      { type: "withdrawal", claimId: c.id, action: "approve" },
                                      `w-${c.id}-a`
                                    )
                                  }
                                  disabled={busyKey === `w-${c.id}-a` || busyKey === `w-${c.id}-r`}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  Setujui
                                </button>
                                <button
                                  onClick={() =>
                                    postProcessClaim(
                                      { type: "withdrawal", claimId: c.id, action: "reject" },
                                      `w-${c.id}-r`
                                    )
                                  }
                                  disabled={busyKey === `w-${c.id}-a` || busyKey === `w-${c.id}-r`}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  Tolak
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Redemption Claims (Pending)</h2>
                <p className="mt-1 text-sm text-gray-600">Tukar paket yang menunggu keputusan admin.</p>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-sm text-gray-600">Memuat...</div>
                ) : redemptionPending.length === 0 ? (
                  <div className="text-sm text-gray-600">Tidak ada klaim pending.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="py-2 pr-3">ID</th>
                          <th className="py-2 pr-3">Parent</th>
                          <th className="py-2 pr-3">Poin</th>
                          <th className="py-2 pr-3">Dibuat</th>
                          <th className="py-2">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {redemptionPending.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2 pr-3 font-mono text-xs text-gray-700">{smallId(c.id)}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-gray-700">{smallId(c.parent_id || c.parentId)}</td>
                            <td className="py-2 pr-3 text-gray-800">{c.points ?? c.amount_points ?? c.points_amount ?? "-"}</td>
                            <td className="py-2 pr-3 text-gray-700">{formatDate(c.created_at)}</td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    postProcessClaim(
                                      { type: "redemption", claimId: c.id, action: "approve" },
                                      `r-${c.id}-a`
                                    )
                                  }
                                  disabled={busyKey === `r-${c.id}-a` || busyKey === `r-${c.id}-r`}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  Setujui
                                </button>
                                <button
                                  onClick={() =>
                                    postProcessClaim(
                                      { type: "redemption", claimId: c.id, action: "reject" },
                                      `r-${c.id}-r`
                                    )
                                  }
                                  disabled={busyKey === `r-${c.id}-a` || busyKey === `r-${c.id}-r`}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  Tolak
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900">Parent List</h2>
              <p className="mt-1 text-sm text-gray-600">
                Daftar parent (read-only) + aksi Bekukan/Pulihkan.
              </p>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="text-sm text-gray-600">Memuat...</div>
              ) : parents.length === 0 ? (
                <div className="text-sm text-gray-600">Data parent kosong.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2 pr-3">ID</th>
                        <th className="py-2 pr-3">Nama</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Poin</th>
                        <th className="py-2 pr-3">Aktif</th>
                        <th className="py-2 pr-3">Paket</th>
                        <th className="py-2 pr-3">Expire</th>
                        <th className="py-2">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parents.map((p) => {
                        const active = p.is_active !== false;
                        const key = `p-${p.id}`;
                        return (
                          <tr key={p.id}>
                            <td className="py-2 pr-3 font-mono text-xs text-gray-700">{smallId(p.id)}</td>
                            <td className="py-2 pr-3 text-gray-900">{p.name || "-"}</td>
                            <td className="py-2 pr-3 text-gray-700">{p.email || "-"}</td>
                            <td className="py-2 pr-3 text-gray-800">{p.reward_points ?? "-"}</td>
                            <td className="py-2 pr-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                {active ? "Aktif" : "Bekukan"}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-gray-700">{p.subscription_tier || "-"}</td>
                            <td className="py-2 pr-3 text-gray-700">{formatDate(p.subscription_expires_at)}</td>
                            <td className="py-2">
                              <button
                                onClick={() =>
                                  postProcessClaim(
                                    {
                                      type: "parent",
                                      parentId: p.id,
                                      action: active ? "freeze" : "unfreeze",
                                    },
                                    key
                                  )
                                }
                                disabled={busyKey === key}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                                  active ? "bg-gray-800 hover:bg-gray-900" : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                              >
                                {busyKey === key ? "Memproses..." : active ? "Bekukan" : "Pulihkan"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-xs text-gray-500">
                Catatan: Tombol aksi memanggil <span className="font-mono">/api/admin/process-claim</span> (Tugas 65).
                Halaman ini memakai <span className="font-mono">/api/admin/data</span> untuk fetch data.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}