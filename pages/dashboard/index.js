import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ParentReport from '../../components/ParentReport';

const REWARD_METRICS = [
  { value: 'xp', label: 'XP' },
  { value: 'streak', label: 'Streak' },
  { value: 'questions_answered', label: 'Jumlah Soal' },
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.message || payload?.error || 'Terjadi kesalahan pada server.'
    );
  }

  return payload;
}

function formatSubscriptionTier(tier) {
  const value = String(tier || 'free').toLowerCase();

  if (value === 'smart_parent') return 'Smart Parent';
  if (value === 'smart_family') return 'Smart Family';
  if (value === 'free') return 'Gratis';

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function calculateRemainingDays(expiresAt) {
  if (!expiresAt) return null;

  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatMetricLabel(metric) {
  const found = REWARD_METRICS.find((item) => item.value === metric);
  return found ? found.label : metric || '-';
}

export default function ParentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parent, setParent] = useState(null);
  const [students, setStudents] = useState([]);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [rewardStudentId, setRewardStudentId] = useState('');
  const [rewardTargetMetric, setRewardTargetMetric] = useState('xp');
  const [rewardTargetValue, setRewardTargetValue] = useState('');
  const [rewardText, setRewardText] = useState('');
  const [rewards, setRewards] = useState([]);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [rewardDeletingId, setRewardDeletingId] = useState(null);
  const [rewardError, setRewardError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedActiveStudentId = window.localStorage.getItem('activeStudentId');
    if (savedActiveStudentId) {
      setActiveStudentId(savedActiveStudentId);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const result = await fetchJson('/api/parent/dashboard');

        if (!isMounted) return;

        const nextParent =
          result?.parent || result?.data?.parent || result?.data || null;
        const nextStudents = Array.isArray(result?.students)
          ? result.students
          : Array.isArray(result?.data?.students)
            ? result.data.students
            : [];

        setParent(nextParent);
        setStudents(nextStudents);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat memuat data dashboard.'
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPackageInfo() {
      try {
        const result = await fetchJson('/api/parent/referral-info');
        if (!isMounted) return;

        const nextParent =
          result?.parent || result?.data?.parent || result?.data || null;

        if (nextParent) {
          setParent((prev) => ({
            ...(prev || {}),
            ...nextParent,
          }));
        }
      } catch (err) {
        // sengaja diabaikan agar dashboard utama tetap tampil walaupun endpoint tambahan gagal
      }
    }

    loadPackageInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeStudentId) return;
    if (students.length === 0) return;

    const exists = students.some(
      (student) => String(student.id) === String(activeStudentId)
    );

    if (!exists) {
      setActiveStudentId(null);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('activeStudentId');
      }
    }
  }, [students, activeStudentId]);

  const activeStudent = useMemo(() => {
    return (
      students.find(
        (student) => String(student.id) === String(activeStudentId)
      ) || null
    );
  }, [students, activeStudentId]);

  const remainingDays = useMemo(() => {
    return calculateRemainingDays(parent?.subscription_expires_at);
  }, [parent?.subscription_expires_at]);

  useEffect(() => {
    const hasRewardSelection =
      rewardStudentId &&
      students.some((student) => String(student.id) === String(rewardStudentId));

    if (hasRewardSelection) return;

    if (
      activeStudentId &&
      students.some((student) => String(student.id) === String(activeStudentId))
    ) {
      setRewardStudentId(String(activeStudentId));
      return;
    }

    if (students.length > 0) {
      setRewardStudentId(String(students[0].id));
      return;
    }

    setRewardStudentId('');
  }, [students, activeStudentId, rewardStudentId]);

  useEffect(() => {
    let isMounted = true;

    async function loadRewards(studentId) {
      if (!studentId) {
        if (isMounted) {
          setRewards([]);
          setRewardError('');
          setRewardLoading(false);
        }
        return;
      }

      setRewardLoading(true);
      setRewardError('');

      try {
        const result = await fetchJson(
          `/api/parent/reward-settings?studentId=${encodeURIComponent(studentId)}`
        );

        if (!isMounted) return;

        const nextRewards = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.rewards)
            ? result.rewards
            : Array.isArray(result)
              ? result
              : [];

        setRewards(nextRewards);
      } catch (err) {
        if (!isMounted) return;
        setRewards([]);
        setRewardError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat memuat reward.'
        );
      } finally {
        if (isMounted) {
          setRewardLoading(false);
        }
      }
    }

    loadRewards(rewardStudentId);

    return () => {
      isMounted = false;
    };
  }, [rewardStudentId]);

  async function handleSelectStudent(student) {
    const nextId = String(student.id);

    if (String(activeStudentId) === nextId) {
      setActiveStudentId(null);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('activeStudentId');
      }

      return;
    }

    setActiveStudentId(nextId);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('activeStudentId', nextId);
    }
  }

  async function handleDeleteStudent(student) {
    const confirmed = window.confirm(
      `Hapus siswa ${student.student_name}? Data tidak akan tampil lagi di dashboard.`
    );
    if (!confirmed) return;

    setDeletingId(student.id);
    setError('');

    try {
      await fetchJson(`/api/parent/students/${student.id}`, {
        method: 'DELETE',
      });

      const nextStudents = students.filter(
        (item) => String(item.id) !== String(student.id)
      );
      setStudents(nextStudents);

      if (String(activeStudentId) === String(student.id)) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('activeStudentId');
        }
        setActiveStudentId(null);
      }

      if (String(rewardStudentId) === String(student.id)) {
        setRewardStudentId(nextStudents[0] ? String(nextStudents[0].id) : '');
        setRewards([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menghapus siswa.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateReward(event) {
    event.preventDefault();

    if (!rewardStudentId) {
      setRewardError('Pilih siswa terlebih dahulu.');
      return;
    }

    const targetValueNumber = Number(rewardTargetValue);
    if (!Number.isFinite(targetValueNumber) || targetValueNumber <= 0) {
      setRewardError('Target reward harus lebih besar dari 0.');
      return;
    }

    if (!rewardText.trim()) {
      setRewardError('Reward tidak boleh kosong.');
      return;
    }

    setRewardSaving(true);
    setRewardError('');

    try {
      await fetchJson('/api/parent/reward-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: rewardStudentId,
          targetMetric: rewardTargetMetric,
          targetValue: targetValueNumber,
          rewardText: rewardText.trim(),
        }),
      });

      setRewardTargetMetric('xp');
      setRewardTargetValue('');
      setRewardText('');

      const refreshed = await fetchJson(
        `/api/parent/reward-settings?studentId=${encodeURIComponent(
          rewardStudentId
        )}`
      );

      setRewards(
        Array.isArray(refreshed?.data)
          ? refreshed.data
          : Array.isArray(refreshed?.rewards)
            ? refreshed.rewards
            : []
      );
    } catch (err) {
      setRewardError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menyimpan reward.'
      );
    } finally {
      setRewardSaving(false);
    }
  }

  async function handleDeleteReward(rewardId) {
    if (!rewardId) return;

    const confirmed = window.confirm('Hapus reward ini?');
    if (!confirmed) return;

    setRewardDeletingId(String(rewardId));
    setRewardError('');

    try {
      await fetchJson('/api/parent/reward-settings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: rewardId }),
      });

      if (!rewardStudentId) {
        setRewards((prev) =>
          prev.filter((item) => String(item.id) !== String(rewardId))
        );
        return;
      }

      const refreshed = await fetchJson(
        `/api/parent/reward-settings?studentId=${encodeURIComponent(
          rewardStudentId
        )}`
      );

      setRewards(
        Array.isArray(refreshed?.data)
          ? refreshed.data
          : Array.isArray(refreshed?.rewards)
            ? refreshed.rewards
            : []
      );
    } catch (err) {
      setRewardError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menghapus reward.'
      );
    } finally {
      setRewardDeletingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Dashboard Parent</title>
      </Head>

      <div className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-sky-600">Dashboard Parent</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Halo, {parent?.name || 'Parent'}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Kelola data siswa Anda, pilih siswa aktif, lalu pantau laporan
                belajar dan Auto-Pilot.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/parent/students/add"
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Tambah Siswa Baru
              </Link>

              <Link
                href="/parent/affiliate"
                className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
              >
                Kemitraan & Poin
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Jumlah siswa aktif</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {students.length}
              </p>
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
                {parent?.subscription_tier &&
                parent.subscription_tier !== 'free' &&
                remainingDays !== null
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
                  const isActive =
                    String(activeStudentId) === String(student.id);

                  return (
                    <div
                      key={student.id}
                      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition ${
                        isActive ? 'ring-sky-500' : 'ring-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">
                            {student.student_name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            Kelas {student.grade}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Student ID: {student.student_id}
                          </p>
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
                          className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                            isActive
                              ? 'bg-slate-700 hover:bg-slate-800'
                              : 'bg-sky-600 hover:bg-sky-700'
                          }`}
                        >
                          {isActive ? 'Batal Pilih' : 'Pilih'}
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
                <h2 className="text-xl font-bold text-slate-900">
                  Laporan & Auto-Pilot
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Ringkasan belajar, konsistensi, topik terulang, catatan Ai Mi,
                  dan kontrol Auto-Pilot untuk siswa aktif.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                {activeStudent ? (
                  <>
                    Siswa aktif:{' '}
                    <span className="font-semibold text-slate-900">
                      {activeStudent.student_name}
                    </span>
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
            ) : (
              <ParentReport studentId={activeStudentId} />
            )}
          </div>

          <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Reward untuk Siswa
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Buat target reward (maksimal 3) untuk memotivasi anak. Untuk
                  MVP, status tercapai belum dihitung otomatis.
                </p>
              </div>

              <div className="w-full md:w-80">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Pilih Siswa
                </label>
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

            <form
              onSubmit={handleCreateReward}
              className="grid gap-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 md:grid-cols-12"
            >
              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Target Metric
                </label>
                <select
                  value={rewardTargetMetric}
                  onChange={(e) => setRewardTargetMetric(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                >
                  {REWARD_METRICS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Target Value
                </label>
                <input
                  type="number"
                  min="1"
                  value={rewardTargetValue}
                  onChange={(e) => setRewardTargetValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                  placeholder="Contoh: 100"
                />
              </div>

              <div className="md:col-span-4">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reward
                </label>
                <input
                  type="text"
                  value={rewardText}
                  onChange={(e) => setRewardText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                  placeholder="Contoh: Nonton film favorit"
                />
              </div>

              <div className="md:col-span-2 md:self-end">
                <button
                  type="submit"
                  disabled={rewardSaving || !rewardStudentId}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rewardSaving ? 'Menyimpan...' : 'Simpan Reward'}
                </button>
              </div>
            </form>

            {rewardError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {rewardError}
              </div>
            ) : null}

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
                  <div
                    key={r.id}
                    className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Target {formatMetricLabel(r.target_metric)}:{' '}
                          {r.target_value}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {r.reward_text}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteReward(r.id)}
                        disabled={rewardDeletingId === String(r.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {rewardDeletingId === String(r.id)
                          ? 'Menghapus...'
                          : 'Hapus'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}