import supabase from '@/lib/supabaseClient'

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getLast7DaysStartISO() {
  const now = new Date()
  const start = startOfDay(now)
  start.setDate(start.getDate() - 6)
  return start.toISOString()
}

function getWeekStartISO(date = new Date()) {
  const d = startOfDay(date)
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diffToMonday = (day + 6) % 7
  d.setDate(d.getDate() - diffToMonday)
  return d.toISOString()
}

function safeNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan',
    })
  }

  try {
    const providedSecret = String(req.headers['x-cron-secret'] || req.body?.secret || '').trim()
    const expectedSecret = String(process.env.CRON_SECRET || '').trim()

    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      })
    }

    const sinceISO = getLast7DaysStartISO()
    const weekStartISO = getWeekStartISO(new Date())
    const createdAt = new Date().toISOString()

    // Cek apakah snapshot untuk minggu ini sudah ada (cegah duplikasi)
    const { data: existingSnapshot, error: checkError } = await supabase
      .from('weekly_leaderboard')
      .select('id')
      .eq('week_start', weekStartISO)
      .limit(1)

    if (checkError) {
      throw new Error(`Gagal memeriksa snapshot existing: ${checkError.message}`)
    }

    if (existingSnapshot && existingSnapshot.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Snapshot untuk minggu ini sudah ada, lewati.',
        inserted: 0,
      })
    }

    // Ambil daftar grade dari siswa aktif (belum dihapus dan parent aktif)
    const { data: gradesData, error: gradesError } = await supabase
      .from('students_profile')
      .select(`
        grade,
        parent:parent_profile (
          is_active
        )
      `)
      .is('deleted_at', null)

    if (gradesError) {
      throw new Error(`Gagal mengambil daftar grade: ${gradesError.message}`)
    }

    // Filter grade hanya dari siswa dengan parent aktif
    const gradeSet = new Set()
    ;(gradesData || []).forEach((row) => {
      const isParentActive = row.parent?.is_active !== false
      const g = String(row.grade || '').trim()
      if (g && isParentActive) gradeSet.add(g)
    })

    const grades = Array.from(gradeSet.values())
    let insertedRows = 0

    for (const grade of grades) {
      // Ambil siswa aktif (belum dihapus, parent aktif)
      const { data: students, error: studentsError } = await supabase
        .from('students_profile')
        .select(`
          id,
          student_id,
          student_name,
          parent:parent_profile (
            is_active
          )
        `)
        .eq('grade', grade)
        .is('deleted_at', null)

      if (studentsError) {
        throw new Error(`Gagal mengambil siswa grade ${grade}: ${studentsError.message}`)
      }

      // Filter hanya yang parent aktif
      const activeStudents = (students || []).filter((s) => s.parent?.is_active !== false)

      if (activeStudents.length === 0) {
        continue
      }

      const studentIdList = activeStudents.map((s) => s.id)
      const studentMap = new Map(activeStudents.map((s) => [String(s.id), s]))

      // Ambil aggregate XP dan jumlah soal 7 hari terakhir
      const { data: aggregates, error: aggError } = await supabase
        .from('question_logs')
        .select('student_id, total_xp:xp_earned.sum(), question_count:id.count()')
        .in('student_id', studentIdList)
        .gte('answered_at', sinceISO)

      if (aggError) {
        throw new Error(`Gagal mengambil agregat leaderboard grade ${grade}: ${aggError.message}`)
      }

      const aggRows = Array.isArray(aggregates) ? aggregates : []

      const ranked = aggRows
        .map((row) => {
          const sid = String(row.student_id || '')
          const profile = studentMap.get(sid)
          return {
            profile,
            student_id: profile?.student_id || null,
            student_name: profile?.student_name || null,
            total_xp: safeNumber(row.total_xp),
            question_count: safeNumber(row.question_count),
          }
        })
        .filter((row) => row.profile && row.question_count >= 5)
        .sort((a, b) => {
          if (b.total_xp !== a.total_xp) return b.total_xp - a.total_xp
          return b.question_count - a.question_count
        })
        .map((row, index) => ({
          week_start: weekStartISO,
          grade,
          rank: index + 1,
          student_id: row.student_id,
          student_name: row.student_name,
          total_xp: row.total_xp,
          question_count: row.question_count,
          created_at: createdAt,
        }))

      if (ranked.length === 0) {
        continue
      }

      // Insert snapshot (tanpa conflict karena sudah dicek sebelumnya)
      const { error: insertError } = await supabase.from('weekly_leaderboard').insert(ranked)

      if (insertError) {
        throw new Error(`Gagal menyimpan snapshot leaderboard grade ${grade}: ${insertError.message}`)
      }

      insertedRows += ranked.length
    }

    return res.status(200).json({
      success: true,
      inserted: insertedRows,
      week_start: weekStartISO,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server'
    console.error('[save-weekly-leaderboard] Error:', error)
    return res.status(500).json({
      success: false,
      message,
    })
  }
}
