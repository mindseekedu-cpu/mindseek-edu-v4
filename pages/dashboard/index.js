import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ParentReport from '../../components/ParentReport';

function formatSubscriptionTier(tier) {
  if (!tier) return 'Gratis';
  return tier
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRemainingDays(expiresAt) {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  if (Number.isNaN(expiry.getTime())) return null;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatMetricLabel(metric) {
  const value = String(metric || '').toLowerCase();
  if (value === 'xp') return 'XP';
  if (value === 'kemandirian') return 'Kemandirian';
  if (value === 'streak') return 'Streak';
  if (value === 'nilai_rapor') return 'Nilai Rapor';
  return metric || '-';
}

export default function ParentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parent, setParent] = useState(null);
  const [students, setStudents] = useState([]);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Reward settings state
  const [rewardStudentId, setRewardStudentId] = useState('');
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState('');
  const [rewards, setRewards] = useState([]);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardDeletingId, setRewardDeletingId] = useState(null);

  const [rewardMetric, setRewardMetric] = useState('xp');
  const [rewardTargetValue, setRewardTargetValue] = useState('');
  const [rewardText, setRewardText] = useState('');

  useEffect(() => {
    const savedActiveStudentId = window.localStorage.getItem('activeStudentId');
    if (savedActiveStudentId) {
      setActiveStudentId(savedActiveStudentId);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch('/api/parent/dashboard', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Gagal memuat dashboard parent.');
        }

        if (!isMounted) return;

        setParent(result.parent || null);
        const nextStudents = Array.isArray(result.students) ? result.students : [];
        setStudents(nextStudents);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Terjadi kesalahan saat memuat data dashboard.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!parent?.subscription_tier) return;
    const subscriptionTier = String(parent.subscription_tier).toLowerCase();
    window.localStorage.setItem('package', subscriptionTier);
    window.localStorage.setItem('packageType', subscriptionTier);
    window.localStorage.setItem('package_type', subscriptionTier);
    window.localStorage.setItem('plan', subscriptionTier);
    window.localStorage.setItem('planType', subscriptionTier);
    window.localStorage.setItem('plan_type', subscriptionTier);
  }, [parent]);

  const remainingDays = useMemo(() => {
    return getRemainingDays(parent?.subscription_expires_at);
  }, [parent]);

  const activeStudent = useMemo(() => {
    return students.find((student) => String(student.id) === String(activeStudentId)) || null;
  }, [students, activeStudentId]);

  useEffect(() => {
    // defaultkan dropdown reward ke siswa aktif (jika ada) atau siswa pertama
    if (rewardStudentId) return;
    if (activeStudentId) {
      setRewardStudentId(String(activeStudentId));
      return;
    }
    if (students.length > 0) {
      setRewardStudentId(String(students[0].id));
    }
  }, [students, activeStudentId, rewardStudentId]);

  async function handleSelectStudent(student) {
    const value = String(student.id);
    window.localStorage.setItem('activeStudentId', value);
    setActiveStudentId(value);
  }

  async function handleDeleteStudent(student) {
    const confirmed = window.confirm(
      `Hapus siswa ${student.student_name}? Data tidak akan tampil lagi di dashboard.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(student.id);
      setError('');

      const response = await fetch(`/api/parent/students/${student.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal menghapus siswa.');
      }

      const nextStudents = students.filter((item) => item.id !== student.id);
      setStudents(nextStudents);

      if (String(activeStudentId) === String(student.id)) {
        window.localStorage.removeItem('activeStudentId');
        setActiveStudentId(null);
      }

      if (String(rewardStudentId) === String(student.id)) {
        setRewardStudentId(nextStudents[0] ? String(nextStudents[0].id) : '');
        setRewards([]);
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat menghapus siswa.');
    } finally {
      setDeletingId(null);
    }
  }

  async function loadRewards(studentId) {
    const sid = String(studentId || '').trim();
    if (!sid) {
      setRewards([]);
      return;
    }

    try {
      setRewardLoading(true);
      setRewardError('');

      const response = await fetch(`/api/parent/reward-settings?studentId=${encodeURIComponent(sid)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memuat reward.');
      }

      setRewards(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setRewards([]);
      setRewardError(err.message || 'Terjadi kesalahan saat memuat reward.');
    } finally {
      setRewardLoading(false);
    }
  }

  useEffect(() => {
    if (!rewardStudentId) return;
    loadRewards(rewardStudentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardStudentId]);

  async function handleCreateReward(e) {
    e.preventDefault();

    const sid = String(rewardStudentId || '').trim();
    const metric = String(rewardMetric || '').trim().toLowerCase();
    const targetValue = Number(String(rewardTargetValue || '').trim());
    const text = String(rewardText || '').trim();

    if (!sid) {
      setRewardError('Pilih siswa terlebih dahulu.');
      return;
    }
    if (!metric) {
      setRewardError('Metrik wajib dipilih.');
      return;
    }
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setRewardError('Nilai target harus angka > 0.');
      return;
    }
    if (!text) {
      setRewardError('Teks hadiah wajib diisi.');
      return;
    }

    try {
      setRewardSaving(true);
      setRewardError('');

      const response = await fetch('/api/parent/reward-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: sid,
          target_metric: metric,
          target_value: targetValue,
          reward_text: text,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal menyimpan reward.');
      }

      setRewardTargetValue('');
      setRewardText('');
      await loadRewards(sid);
    } catch (err) {
      setRewardError(err.message || 'Terjadi kesalahan saat menyimpan reward.');
    } finally {
      setRewardSaving(false);
    }
  }

  async function handleDeleteReward(rewardId) {
    const rid = String(rewardId || '').trim();
    if (!rid) return;

    const confirmed = window.confirm('Hapus reward ini?');
    if (!confirmed) return;

    try {
      setRewardDeletingId(rid);
      setRewardError('');

      const response = await fetch(`/api/parent/reward-settings?id=${encodeURIComponent(rid)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal menghapus reward.');
      }

      await loadRewards(rewardStudentId);
    } catch (err) {
      setRewardError(err.message || 'Terjadi kesalahan saat menghapus reward.');
    } finally {
      setRewardDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-600">Dashboard Parent</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Halo, {parent?.name || 'Parent'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Kelola data siswa Anda, pilih siswa aktif, lalu pantau laporan belajar dan Auto-Pilot.
            </p>
          </div>
          <Link
            href="/parent/students/add"
            className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Tambah Siswa Baru
          </Link>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Jumlah siswa aktif</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{students.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Paket berlangganan</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatSubscriptionTier(parent?.subscription_tier)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Sisa masa aktif</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {parent?.subscription_tier && parent.subscription_tier !== 'free' && remainingDays !== null
                ? remainingDays === 0
                  ? 'Berakhir hari ini'
                  : `${remainingDays} hari`
                : 'Gratis'}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Daftar Siswa</h2>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
              Memuat data dashboard...
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <p className="text-base font-medium text-slate-800">
                Belum ada siswa. Klik Tambah Siswa Baru.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {students.map((student) => {
                const isActive = String(activeStudentId) === String(student.id);
                return (
                  <div
                    key={student.id}
                    className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition ${
                      isActive ? 'ring-sky-500' : 'ring-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{student.student_name}</h3>
                        <p className="mt-1 text-sm text-slate-600">Kelas {student.grade}</p>
                        <p className="mt-1 text-sm text-slate-500">Student ID: {student.student_id}</p>
                      </div>
                      {isActive ? (
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                          Aktif
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                      >
                        Pilih
                      </button>
                      <Link
                        href={`/parent/students/edit/${student.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student)}
                        disabled={deletingId === student.id}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === student.id ? 'Menghapus...' : 'Hapus'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Laporan & Auto-Pilot</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ringkasan belajar, konsistensi, topik terulang, catatan Ai Mi, dan kontrol Auto-Pilot untuk siswa aktif.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
              {activeStudent ? (
                <>
                  Siswa aktif: <span className="font-semibold text-slate-900">{activeStudent.student_name}</span>
                </>
              ) : (
                'Belum ada siswa aktif dipilih'
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-600 ring-1 ring-slate-200">
              Menyiapkan laporan siswa...
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-base font-medium text-slate-800">
                Tambahkan siswa terlebih dahulu untuk melihat laporan belajar.
              </p>
            </div>
          ) : !activeStudentId ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
              Pilih salah satu siswa sebagai siswa aktif untuk membuka laporan Parent Report.
            </div>
          ) : (
            <ParentReport studentId={activeStudentId} />
          )}
        </div>

        {/* Reward section */}
        <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Reward untuk Siswa</h2>
              <p className="mt-1 text-sm text-slate-600">
                Buat target reward (maksimal 3) untuk memotivasi anak. Untuk MVP, status tercapai belum dihitung otomatis.
              </p>
            </div>
            <div className="w-full md:w-80">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Pilih Siswa</label>
              <select
                value={rewardStudentId}
                onChange={(e) => setRewardStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                disabled={students.length === 0}
              >
                {students.length === 0 ? (
                  <option value="">Belum ada siswa</option>
                ) : (
                  students.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.student_name} (Kelas {s.grade})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {rewardError ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {rewardError}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <h3 className="text-base font-bold text-slate-900">Daftar Reward</h3>
              <p className="mt-1 text-sm text-slate-600">Maksimal 3 reward per siswa.</p>

              <div className="mt-4 space-y-3">
                {rewardLoading ? (
                  <div className="rounded-xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                    Memuat reward...
                  </div>
                ) : rewards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                    Belum ada reward untuk siswa ini.
                  </div>
                ) : (
                  rewards.map((r) => (
                    <div key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Target {formatMetricLabel(r.target_metric)}: {r.target_value}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{r.reward_text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReward(r.id)}
                          disabled={rewardDeletingId === String(r.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rewardDeletingId === String(r.id) ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <h3 className="text-base font-bold text-slate-900">Tambah Reward</h3>
              <p className="mt-1 text-sm text-slate-600">
                Contoh: target XP 500 → “Beli mainan”.
              </p>

              <form onSubmit={handleCreateReward} className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Metrik</label>
                  <select
                    value={rewardMetric}
                    onChange={(e) => setRewardMetric(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                  >
                    <option value="xp">xp</option>
                    <option value="kemandirian">kemandirian</option>
                    <option value="streak">streak</option>
                    <option value="nilai_rapor">nilai_rapor</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nilai Target</label>
                  <input
                    value={rewardTargetValue}
                    onChange={(e) => setRewardTargetValue(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                    inputMode="numeric"
                    placeholder="Contoh: 500"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Teks Hadiah</label>
                  <input
                    value={rewardText}
                    onChange={(e) => setRewardText(e.target.value)}
                    placeholder="Contoh: Beli mainan"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={rewardSaving || !rewardStudentId}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rewardSaving ? 'Menyimpan...' : 'Simpan Reward'}
                </button>

                <p className="text-xs text-slate-500">
                  Setelah disimpan, daftar reward akan otomatis diperbarui.
                </p>
              </form>
            </div>
          </div>
        </div>
        {/* End Reward section */}
      </div>
    </div>
  );
}