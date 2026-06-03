import supabase from '@/lib/supabaseClient'

function anonymizeName(name) {
  const text = String(name || '').trim()
  if (!text) return 'Student*'
  const first = text.split(/\s+/)[0]
  return first ? `${first}*` : 'Student*'
}

function clampLimit(value, fallback = 10) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), 100)
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getLast7DaysStartISO() {
  const now = new Date()
  const start = startOfDay(now)
  start.setDate(start.getDate() - 6) // termasuk hari ini = 7 hari (hari ini + 6 hari sebelumnya)
  return start.toISOString()
}

function safeNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan',
    })
  }

  try {
    const grade = String(req.query?.grade || '').trim()
    if (!grade) {
      return res.status(400).json({
        success: false,
        message: 'grade wajib diisi',
      })
    }

    const limit = clampLimit(req.query?.limit, 10)
    const sinceISO = getLast7DaysStartISO()

    // 1) Ambil daftar siswa per grade (untuk filter + mapping nama)
    const { data: students, error: studentsError } = await supabase
      .from('students_profile')
      .select('id, student_id, student_name')
      .eq('grade', grade)
      .is('deleted_at', null)

    if (studentsError) {
      throw new Error(`Gagal mengambil data siswa: ${studentsError.message}`)
    }

    const studentRows = Array.isArray(students) ? students : []
    if (studentRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      })
    }

    const internalStudentIds = studentRows.map((s) => s.id)
    const studentMap = new Map(studentRows.map((s) => [String(s.id), s]))

    // 2) Ambil question_logs 7 hari terakhir untuk siswa-siswa tsb (tanpa aggregate di SQL)
    // NOTE: untuk MVP, asumsi jumlah rows masih aman. Jika besar, nanti bisa dipaginasi.
    const { data: logs, error: logsError } = await supabase
      .from('question_logs')
      .select('student_id, xp_earned')
      .in('student_id', internalStudentIds)
      .gte('answered_at', sinceISO)

    if (logsError) {
      throw new Error(`Gagal mengambil question logs: ${logsError.message}`)
    }

    const logRows = Array.isArray(logs) ? logs : []

    // 3) Hitung total XP mingguan + jumlah soal per studentId di JS
    const statsByStudentId = new Map()
    for (const row of logRows) {
      const sid = String(row.student_id || '')
      if (!sid) continue

      const prev = statsByStudentId.get(sid) || { totalXp: 0, questionCount: 0 }
      prev.totalXp += safeNumber(row.xp_earned)
      prev.questionCount += 1
      statsByStudentId.set(sid, prev)
    }

    // 4) Build leaderboard rows, filter minimal 5 soal, sort desc totalXp
    const leaderboard = []
    for (const [sid, stat] of statsByStudentId.entries()) {
      if (stat.questionCount < 5) continue

      const profile = studentMap.get(sid)
      if (!profile) continue

      leaderboard.push({
        student_internal_id: sid,
        student_id: profile.student_id,
        name: anonymizeName(profile.student_name),
        total_xp: stat.totalXp,
        question_count: stat.questionCount,
      })
    }

    leaderboard.sort((a, b) => {
      if (b.total_xp !== a.total_xp) return b.total_xp - a.total_xp
      return b.question_count - a.question_count
    })

    const trimmed = leaderboard.slice(0, limit).map((row, index) => ({
      rank: index + 1,
      name: row.name,
      total_xp: row.total_xp,
      student_id: row.student_id,
    }))

    return res.status(200).json({
      success: true,
      data: trimmed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server'
    return res.status(500).json({
      success: false,
      message,
    })
  }
}