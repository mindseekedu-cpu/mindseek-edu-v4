import { jwtVerify } from 'jose'
import supabase from '@/lib/supabaseClient'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

const MODE_XP = {
  homework: 10,
  practice: 15,
  exam: 20,
}

function calculateXP(mode, clueUsedCount = 0, attempts = 1) {
  const normalizedMode = String(mode || '').toLowerCase()
  const baseXp = MODE_XP[normalizedMode] || 10
  const cluePenalty = Math.max(0, Number(clueUsedCount) || 0) * 2
  const attemptPenalty = Math.max(0, (Number(attempts) || 1) - 1) * 1

  return Math.max(2, baseXp - cluePenalty - attemptPenalty)
}

function buildSystemPrompt({ student, subject, topic, grade, mode }) {
  const studentName = student?.student_name || 'Siswa'
  const studentGrade = student?.grade || grade || '-'
  const questionSettings = student?.question_settings
    ? JSON.stringify(student.question_settings)
    : '{}'

  return `
Kamu adalah AI tutor pendamping belajar untuk siswa Indonesia.

Informasi siswa:
- Nama: ${studentName}
- Kelas/Grade: ${studentGrade}
- Mata pelajaran: ${subject}
- Topik: ${topic}
- Mode belajar: ${mode}
- Pengaturan soal siswa: ${questionSettings}

Aturan penting:
- Jelaskan dengan bahasa yang sesuai usia dan level siswa.
- Jangan langsung memberi jawaban final tanpa proses berpikir.
- Bimbing siswa langkah demi langkah.
- Jika siswa kesulitan, berikan clue/petunjuk bertahap.
- Maksimal berikan 3 clue.
- Dorong siswa untuk mencoba dulu sebelum diberi arahan berikutnya.
- Jika soal meminta perhitungan, fokus pada metode dan langkah.
- Jika siswa meminta jawaban langsung, tolak dengan halus dan tetap bantu lewat penjelasan.
- Gunakan gaya yang ramah, singkat, jelas, dan suportif.
- Jika konteks soal kurang lengkap, minta klarifikasi seperlunya.
`.trim()
}

function buildMockResponse({ subject, topic, mode, questionText }) {
  return `Baik, aku akan bantu kamu belajar ${subject} untuk topik **${topic}** dalam mode **${mode}**.

Dari pertanyaanmu: "${questionText}", kita jangan langsung loncat ke jawaban akhir ya. Kita pecah dulu langkahnya supaya kamu paham konsepnya.

Petunjuk awal:
1. Identifikasi apa yang diketahui dari soal.
2. Tentukan apa yang sebenarnya ditanya.
3. Pilih rumus atau konsep yang paling relevan.
4. Coba kerjakan satu langkah pertama, lalu kirim hasilnya agar bisa kita lanjutkan bersama.

Kalau kamu mau, aku juga bisa kasih **clue 1** tanpa membocorkan jawaban akhirnya.`
}

async function generateDeepSeekResponse({
  systemPrompt,
  userPrompt,
  subject,
  topic,
  mode,
  questionText,
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return {
      text: buildMockResponse({ subject, topic, mode, questionText }),
      source: 'mock',
    }
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API error:', errorText)
      return {
        text: buildMockResponse({ subject, topic, mode, questionText }),
        source: 'mock',
      }
    }

    const result = await response.json()
    const text =
      result?.choices?.[0]?.message?.content ||
      buildMockResponse({ subject, topic, mode, questionText })

    return { text, source: 'deepseek' }
  } catch (error) {
    console.error('DeepSeek request failed:', error)
    return {
      text: buildMockResponse({ subject, topic, mode, questionText }),
      source: 'mock',
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    })
  }

  try {
    const token = req.cookies?.student_token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      })
    }

    let payload
    try {
      const verified = await jwtVerify(token, JWT_SECRET)
      payload = verified.payload
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau sudah kedaluwarsa',
      })
    }

    const studentId = payload?.id
    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Payload token tidak valid',
      })
    }

    const {
      subject,
      topic,
      grade,
      mode,
      questionText,
      file = null,
      clueUsedCount = 0,
      attempts = 1,
    } = req.body || {}

    const normalizedMode = String(mode || '').toLowerCase()

    if (!subject || !topic || !grade || !normalizedMode || !questionText) {
      return res.status(400).json({
        success: false,
        message: 'subject, topic, grade, mode, dan questionText wajib diisi',
      })
    }

    if (!['homework', 'practice', 'exam'].includes(normalizedMode)) {
      return res.status(400).json({
        success: false,
        message: 'Mode harus salah satu dari homework, practice, atau exam',
      })
    }

    const { data: studentProfile, error: studentError } = await supabase
      .from('students_profile')
      .select('id, student_name, grade, question_settings')
      .eq('id', studentId)
      .single()

    if (studentError || !studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profil siswa tidak ditemukan',
      })
    }

    const { data: existingSession, error: sessionFindError } = await supabase
      .from('learning_sessions')
      .select('id, total_xp_earned')
      .eq('student_id', studentId)
      .eq('subject', subject)
      .eq('topic', topic)
      .eq('mode', normalizedMode)
      .eq('is_completed', false)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionFindError) {
      console.error('Find session error:', sessionFindError)
      return res.status(500).json({
        success: false,
        message: 'Gagal memeriksa session belajar',
      })
    }

    let session = existingSession

    if (!session) {
      const { data: newSession, error: createSessionError } = await supabase
        .from('learning_sessions')
        .insert([
          {
            student_id: studentId,
            subject,
            topic,
            mode: normalizedMode,
            started_at: new Date().toISOString(),
            is_completed: false,
            total_xp_earned: 0,
          },
        ])
        .select('id, total_xp_earned')
        .single()

      if (createSessionError || !newSession) {
        console.error('Create session error:', createSessionError)
        return res.status(500).json({
          success: false,
          message: 'Gagal membuat session belajar',
        })
      }

      session = newSession
    }

    const systemPrompt = buildSystemPrompt({
      student: studentProfile,
      subject,
      topic,
      grade,
      mode: normalizedMode,
    })

    const userPrompt = `
Siswa bertanya:
${questionText}

Informasi tambahan:
- Subject: ${subject}
- Topic: ${topic}
- Grade: ${grade}
- Mode: ${normalizedMode}
- File OCR placeholder: ${file ? 'Ada file dilampirkan (OCR belum aktif)' : 'Tidak ada file'}

Bantu siswa memahami soal tanpa memberi jawaban langsung.
`.trim()

    const aiResult = await generateDeepSeekResponse({
      systemPrompt,
      userPrompt,
      subject,
      topic,
      mode: normalizedMode,
      questionText,
    })

    const xpEarned = calculateXP(normalizedMode, clueUsedCount, attempts)

    const { error: logError } = await supabase.from('question_logs').insert([
      {
        session_id: session.id,
        student_id: studentId,
        question_text: questionText,
        clue_used_count: clueUsedCount,
        xp_earned: xpEarned,
      },
    ])

    if (logError) {
      console.error('Question log insert error:', logError)
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan log pertanyaan',
      })
    }

    const updatedSessionXp = (session?.total_xp_earned || 0) + xpEarned

    const { error: updateSessionError } = await supabase
      .from('learning_sessions')
      .update({
        total_xp_earned: updatedSessionXp,
      })
      .eq('id', session.id)

    if (updateSessionError) {
      console.error('Session XP update error:', updateSessionError)
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui XP session',
      })
    }

    // Update total_xp di students_profile
    const { data: xpRow, error: xpFetchError } = await supabase
      .from('students_profile')
      .select('total_xp')
      .eq('id', studentId)
      .maybeSingle()

    if (xpFetchError) {
      console.error('Fetch student total_xp error:', xpFetchError)
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil total_xp siswa',
      })
    }

    const currentTotalXp = Number(xpRow?.total_xp || 0)
    const newTotalXp = currentTotalXp + Number(xpEarned || 0)

    const { error: xpUpdateError } = await supabase
      .from('students_profile')
      .update({ total_xp: newTotalXp })
      .eq('id', studentId)

    if (xpUpdateError) {
      console.error('Update student total_xp error:', xpUpdateError)
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui total_xp siswa',
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        response: aiResult.text,
        xpEarned,
        aiSource: aiResult.source,
      },
    })
  } catch (error) {
    console.error('Student chat error:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}