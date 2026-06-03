import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

function clampLimit(value, fallback = 10) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), 100)
}

function formatXp(value) {
  const n = Number(value || 0)
  return n.toLocaleString('id-ID')
}

function rankIcon(rank) {
  if (rank === 1) return '⭐ 👑'
  if (rank === 2) return '👑'
  if (rank === 3) return '👑'
  return ''
}

export default function StudentLeaderboardPage() {
  const [profile, setProfile] = useState(null)
  const [grade, setGrade] = useState('')
  const [limit, setLimit] = useState(10)

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [error, setError] = useState('')
  const [leaderboard, setLeaderboard] = useState([])

  const gradeOptions = useMemo(
    () => [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      'Grade 1',
      'Grade 2',
      'Grade 3',
      'Grade 4',
      'Grade 5',
      'Grade 6',
    ],
    [],
  )

  const effectiveGrade = useMemo(() => String(grade || '').trim(), [grade])
  const effectiveLimit = useMemo(() => clampLimit(limit, 10), [limit])

  async function loadProfile() {
    try {
      setLoadingProfile(true)
      setError('')

      const response = await fetch('/api/student/profile', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Gagal memuat profil siswa.')
      }

      setProfile(result.data || null)

      const g = String(result?.data?.grade ?? '').trim()
      if (g) {
        setGrade(g)
      }
    } catch (err) {
      setError(err?.message || 'Terjadi kesalahan saat memuat profil siswa.')
    } finally {
      setLoadingProfile(false)
    }
  }

  async function loadLeaderboard(selectedGrade, selectedLimit) {
    const g = String(selectedGrade || '').trim()
    if (!g) {
      setLeaderboard([])
      return
    }

    try {
      setLoadingLeaderboard(true)
      setError('')

      const response = await fetch(
        `/api/student/leaderboard?grade=${encodeURIComponent(g)}&limit=${encodeURIComponent(
          String(selectedLimit),
        )}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Gagal memuat leaderboard.')
      }

      setLeaderboard(Array.isArray(result.data) ? result.data : [])
    } catch (err) {
      setLeaderboard([])
      setError(err?.message || 'Terjadi kesalahan saat memuat leaderboard.')
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (!effectiveGrade) return
    loadLeaderboard(effectiveGrade, effectiveLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveGrade, effectiveLimit])

  return (
    <>
      <Head>
        <title>Leaderboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-300">Leaderboard Mingguan</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Top XP 7 Hari Terakhir</h1>
              <p className="mt-2 text-sm text-slate-300">
                Ditampilkan untuk satu grade, minimal 5 soal terjawab per siswa.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {loadingProfile ? 'Memuat profil...' : `Kamu login sebagai: ${profile?.name || 'Siswa'}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                ← Dashboard
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-1">
              <h2 className="text-base font-semibold text-white">Filter</h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Grade</label>
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400"
                    inputMode="text"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gradeOptions.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          String(grade).trim() === g
                            ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30'
                            : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Jumlah tampil</label>
                  <select
                    value={String(limit)}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400"
                  >
                    <option value="10" className="text-slate-900">
                      Top 10
                    </option>
                    <option value="25" className="text-slate-900">
                      Top 25
                    </option>
                    <option value="50" className="text-slate-900">
                      Top 50
                    </option>
                    <option value="100" className="text-slate-900">
                      Top 100
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => loadLeaderboard(effectiveGrade, effectiveLimit)}
                  disabled={loadingLeaderboard || !effectiveGrade}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingLeaderboard ? 'Memuat...' : 'Refresh Leaderboard'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Hasil</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Grade: <span className="font-semibold text-slate-200">{effectiveGrade || '-'}</span>
                  </p>
                </div>
                <div className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                  7 hari
                </div>
              </div>

              <div className="mt-4">
                {loadingLeaderboard ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                    Memuat leaderboard...
                  </div>
                ) : !effectiveGrade ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                    Pilih grade terlebih dahulu.
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                    Belum ada data leaderboard untuk grade ini (atau belum ada yang mencapai minimal 5 soal).
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <div className="grid grid-cols-[72px_1fr_120px] gap-0 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-200">
                      <div>Rank</div>
                      <div>Nama</div>
                      <div className="text-right">XP (7 hari)</div>
                    </div>

                    {leaderboard.map((row) => (
                      <div
                        key={`${row.rank}-${row.student_id}`}
                        className="grid grid-cols-[72px_1fr_120px] items-center gap-0 border-b border-white/10 bg-slate-950/20 px-4 py-4 last:border-b-0"
                      >
                        <div className="text-sm font-bold text-slate-200">
                          #{row.rank}{' '}
                          <span className="ml-1 text-xs font-semibold text-slate-400">{rankIcon(row.rank)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{row.name}</p>
                          <p className="mt-1 text-xs text-slate-400">ID: {row.student_id}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center justify-center rounded-full bg-indigo-500/15 px-3 py-1 text-sm font-bold text-indigo-200 ring-1 ring-indigo-400/20">
                            {formatXp(row.total_xp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Catatan: nama ditampilkan anonim (nama depan + *). Leaderboard dihitung dari total XP pada question logs 7
                hari terakhir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}