import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

function formatAnonRankIcon(rank) {
  if (rank === 1) return '⭐ 👑'
  if (rank === 2) return '👑'
  if (rank === 3) return '👑'
  return ''
}

export default function StudentDashboardPage() {
  const router = useRouter()

  const [profile, setProfile] = useState(null)
  const [recentChats, setRecentChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [subject, setSubject] = useState('Mathematics')
  const [grade, setGrade] = useState('Grade 5')
  const [mode, setMode] = useState('Practice')
  const [selectedTopic, setSelectedTopic] = useState('Fractions')
  const [questionText, setQuestionText] = useState('')

  const [chatLoading, setChatLoading] = useState(false)
  const [chatResponse, setChatResponse] = useState('')

  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState('')

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/student/profile')
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memuat profil')
      }

      setProfile(result.data)
    } catch (err) {
      setError(err.message || 'Gagal memuat profil')
    }
  }

  const loadRecentChats = async () => {
    try {
      const response = await fetch('/api/student/recent-chats')
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memuat recent chats')
      }

      setRecentChats(result.data || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat recent chats')
    }
  }

  const loadLeaderboard = async (studentGrade) => {
    const g = String(studentGrade || '').trim()
    if (!g) return

    setLeaderboardLoading(true)
    setLeaderboardError('')

    try {
      const response = await fetch(`/api/student/leaderboard?grade=${encodeURIComponent(g)}&limit=5`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memuat leaderboard')
      }

      setLeaderboard(Array.isArray(result.data) ? result.data : [])
    } catch (err) {
      setLeaderboard([])
      setLeaderboardError(err.message || 'Gagal memuat leaderboard')
    } finally {
      setLeaderboardLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError('')

      try {
        await Promise.all([loadProfile(), loadRecentChats()])
      } catch (err) {
        setError(err.message || 'Gagal memuat dashboard')
      } finally {
        setLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!profile?.grade && profile?.grade !== 0) return
    const g = String(profile.grade).trim()
    if (!g) return

    loadLeaderboard(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.grade])

  const handleLogout = async () => {
    try {
      await fetch('/api/student/logout', {
        method: 'POST',
      })
    } finally {
      router.push('/student/login')
    }
  }

  const handleSendChat = async (e) => {
    e.preventDefault()

    if (!questionText.trim()) {
      setError('Pertanyaan tidak boleh kosong')
      return
    }

    setChatLoading(true)
    setError('')

    try {
      const response = await fetch('/api/student/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          topic: selectedTopic || 'Fractions',
          grade,
          mode,
          questionText: questionText.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal mengirim pertanyaan')
      }

      setChatResponse(result.data?.response || '')
      setQuestionText('')

      await Promise.all([loadProfile(), loadRecentChats()])
      if (profile?.grade || profile?.grade === 0) {
        await loadLeaderboard(String(profile.grade))
      }
    } catch (err) {
      setError(err.message || 'Gagal mengirim pertanyaan')
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 shadow">
          <p className="text-sm text-gray-600">Memuat dashboard siswa...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Siswa</h1>
            <p className="mt-1 text-sm text-gray-600">Selamat datang, {profile?.name || 'Siswa'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-500">Nama</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{profile?.name || '-'}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-500">Grade</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{profile?.grade || '-'}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-500">Total XP</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{profile?.total_xp ?? 0}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900">AI Study Chat</h2>
            <p className="mt-1 text-sm text-gray-600">
              Tanyakan soalmu dan dapatkan bantuan langkah demi langkah.
            </p>

            {chatResponse ? (
              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-sm font-medium text-blue-700">Respons AI</p>
                <div className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{chatResponse}</div>
              </div>
            ) : null}

            <form onSubmit={handleSendChat} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="Contoh: Mathematics"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Topic</label>
                  <input
                    type="text"
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="Contoh: Fractions"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Grade (untuk konteks)</label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="Contoh: Grade 5"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Homework">Homework</option>
                    <option value="Practice">Practice</option>
                    <option value="Exam">Exam</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Pertanyaan</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="Tulis soal atau pertanyaanmu di sini..."
                />
              </div>

              <button
                type="submit"
                disabled={chatLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatLoading ? 'Mengirim...' : 'Kirim ke AI Tutor'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-xl font-semibold text-gray-900">Recent Chats</h2>
              <div className="mt-4 space-y-3">
                {recentChats.length > 0 ? (
                  recentChats.map((chat) => (
                    <div key={chat.id} className="rounded-lg border border-gray-200 p-4">
                      <p className="text-sm font-medium text-gray-900">{chat.topic || '-'}</p>
                      <p className="mt-1 text-xs text-gray-500">{chat.mode || '-'}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {chat.started_at ? new Date(chat.started_at).toLocaleString('id-ID') : '-'}
                      </p>
                      <p className="mt-2 text-xs text-gray-600">
                        XP: {chat.total_xp_earned ?? 0} · {chat.is_completed ? 'Selesai' : 'Berlangsung'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Belum ada sesi chat.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Leaderboard Mingguan</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Top 5 grade: <span className="font-semibold">{profile?.grade ?? '-'}</span> (min 5 soal)
                  </p>
                </div>
                <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  7 hari
                </div>
              </div>

              {leaderboardError ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {leaderboardError}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {leaderboardLoading ? (
                  <p className="text-sm text-gray-500">Memuat leaderboard...</p>
                ) : leaderboard.length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada leaderboard untuk grade ini.</p>
                ) : (
                  leaderboard.map((row) => (
                    <div
                      key={`${row.rank}-${row.student_id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          <span className="mr-2 text-xs font-bold text-gray-500">#{row.rank}</span>
                          {row.name}
                          <span className="ml-2 text-xs">{formatAnonRankIcon(row.rank)}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">XP minggu ini</p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          {Number(row.total_xp || 0)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => router.push('/student/leaderboard')}
                  className="w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Lihat Leaderboard Lengkap
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => router.push('/student/leaderboard')}
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Buka halaman Leaderboard →
          </button>
        </div>
      </div>
    </div>
  )
}