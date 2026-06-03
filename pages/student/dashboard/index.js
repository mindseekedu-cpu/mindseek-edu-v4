import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

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
  }, [])

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
            <p className="mt-1 text-sm text-gray-600">
              Selamat datang, {profile?.name || 'Siswa'}
            </p>
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
          <div className="lg:col-span-2 rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">AI Study Chat</h2>
            <p className="mt-1 text-sm text-gray-600">
              Tanyakan soalmu dan dapatkan bantuan langkah demi langkah.
            </p>

            {chatResponse ? (
              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-sm font-medium text-blue-700">Respons AI</p>
                <div className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
                  {chatResponse}
                </div>
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Grade</label>
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

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">Recent Chats</h2>
            <div className="mt-4 space-y-3">
              {recentChats.length > 0 ? (
                recentChats.map((chat) => (
                  <div key={chat.id} className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-900">{chat.topic || '-'}</p>
                    <p className="mt-1 text-xs text-gray-500">{chat.mode || '-'}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {chat.started_at
                        ? new Date(chat.started_at).toLocaleString('id-ID')
                        : '-'}
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                      XP: {chat.total_xp_earned ?? 0} ·{' '}
                      {chat.is_completed ? 'Selesai' : 'Berlangsung'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Belum ada sesi chat.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
