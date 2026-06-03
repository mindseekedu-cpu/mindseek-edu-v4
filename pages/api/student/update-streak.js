import supabase from '@/lib/supabaseClient'

function startOfTodayISO() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
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

    const todayStartISO = startOfTodayISO()

    const { data: students, error: studentsError } = await supabase
      .from('students_profile')
      .select('id, current_streak, longest_streak')
      .is('deleted_at', null)

    if (studentsError) {
      throw new Error(`Gagal mengambil data siswa: ${studentsError.message}`)
    }

    const studentRows = Array.isArray(students) ? students : []
    let updatedCount = 0

    for (const student of studentRows) {
      const studentId = student.id

      const { data: logs, error: logsError } = await supabase
        .from('question_logs')
        .select('id')
        .eq('student_id', studentId)
        .gte('answered_at', todayStartISO)
        .limit(1)

      if (logsError) {
        throw new Error(`Gagal memeriksa aktivitas siswa (${studentId}): ${logsError.message}`)
      }

      const isActiveToday = Array.isArray(logs) && logs.length > 0
      const currentStreak = Number(student.current_streak || 0)
      const longestStreak = Number(student.longest_streak || 0)

      const nextCurrentStreak = isActiveToday ? currentStreak + 1 : 0
      const nextLongestStreak = nextCurrentStreak > longestStreak ? nextCurrentStreak : longestStreak

      const { error: updateError } = await supabase
        .from('students_profile')
        .update({
          current_streak: nextCurrentStreak,
          longest_streak: nextLongestStreak,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)

      if (updateError) {
        throw new Error(`Gagal update streak siswa (${studentId}): ${updateError.message}`)
      }

      updatedCount += 1
    }

    return res.status(200).json({
      success: true,
      updated: updatedCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server'
    return res.status(500).json({
      success: false,
      message,
    })
  }
}