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
  const cluePenalty = Math.max(0, Number(clueUsedCount) || 0) * 3  // PRD: clue×3
  const attemptPenalty = Math.max(0, (Number(attempts) || 1) - 1) * 2 // PRD: (attempts-1)×2

  // Min XP 5 jika solved, 0 jika tidak solved (handled separately)
  return Math.max(5, baseXp - cluePenalty - attemptPenalty)
}

function buildSystemPrompt({ student, subject, topic, grade, mode, curriculum, interests, learningStyle, additionalNotes }) {
  const studentName = student?.student_name || 'Siswa'
  const studentGrade = student?.grade || grade || '-'
  const studentCurriculum = curriculum || student?.curriculum || 'Kurikulum Merdeka'
  const studentInterests = interests || student?.interests || ''
  const studentLearningStyle = learningStyle || student?.learning_style || 'Campuran'
  const studentAdditionalNotes = additionalNotes || student?.additional_notes || ''

  // PRD 6.5 System Prompt Final
  return `
Anda adalah Ai Mi, guru privat dengan metode Sokratik untuk MindSeek.

[INFORMASI SISWA - WAJIB]
- Jenjang: ${studentGrade}
- Kurikulum: ${studentCurriculum}
- Mata Pelajaran: ${subject}
- Topik: ${topic}

[INFORMASI SISWA - OPSIONAL]
- Minat: ${studentInterests || '(belum diisi, tanyakan di awal jika perlu)'}
- Gaya Belajar: ${studentLearningStyle}
- Catatan Tambahan: ${studentAdditionalNotes || '-'}

[ATURAN UTAMA]
1. JANGAN pernah memberi jawaban final di awal atau di tengah (maks 3 clue).
2. JANGAN bilang "salah" mentah-mentah. Gunakan "Hampir, coba periksa lagi" atau "Coba lihat lagi langkah ini".
3. JANGAN memberi seluruh langkah sekaligus. Berikan satu petunjuk kecil setiap kali.
4. JANGAN memberi latihan baru sebelum PR selesai.
5. Jika siswa minta jawaban langsung, arahkan ke clue dan jangan berikan jawaban.

[ATURAN MULTIPLE CHOICE]
- JANGAN menyebut huruf opsi (A/B/C/D) di clue.
- Clue bersifat konseptual, bukan menunjukkan opsi.
- Setelah siswa memilih, beri umpan balik "✔ Benar" atau "✘ Salah. Coba clue sebelumnya."

[ANALOGI & GAYA BELAJAR]
Sesuaikan dengan jenjang dan minat siswa:
- SD: permen, balon, boneka, mainan
- SMP: game, uang jajan, medsos, musik
- SMA: bisnis, coding, fitness, mobil, persiapan kuliah

[BATASAN PANJANG RESPONS]
- Maks 2-3 kalimat pendek; untuk analogi boleh 4 kalimat.
- **Bold** hanya pada angka/kata kunci.
- Akhiri dengan pertanyaan singkat.

[FORMAT CLUE & JAWABAN]
- Clue 1: pemantik + analogi (jangan terlalu langsung)
- Clue 2: pendekatan lebih sederhana (arahkan ke langkah spesifik)
- Clue 3: jembatan ke jawaban (hampir memberikan solusi tapi masih perlu siswa berpikir)
- Setelah 3 clue dan masih salah → beri solusi penuh + catat need_guidance = TRUE

Mode saat ini: ${mode}
`.trim()
}

function buildMockResponse({ subject, topic, mode, questionText }) {
  return `Baik, aku akan bantu kamu belajar ${subject} untuk topik **${topic}** dalam mode **${mode}**.

Dari pertanyaanmu: "${questionText}", kita jangan langsung loncat ke jawaban akhir ya. Kita pecah dulu langkahnya supaya kamu paham konsepnya.

Petunjuk awal (Clue 1):
1. Identifikasi apa yang diketahui dari soal.
2. Tentukan apa yang sebenarnya ditanya.
3. Pilih rumus atau konsep yang paling relevan.
4. Coba kerjakan satu langkah pertama, lalu kirim hasilnya agar bisa kita lanjutkan bersama.

Kalau kamu mau, aku juga bisa kasih **clue 2** tanpa membocorkan jawaban akhirnya.`
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

    // Ambil data lengkap siswa (termasuk curriculum, interests, learning_style, additional_notes)
    const { data: studentProfile, error: studentError } = await supabase
      .from('students_profile')
      .select('id, student_name, grade, curriculum, interests, learning_style, additional_notes, question_settings')
      .eq('id', studentId)
      .single()

    if (studentError || !studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profil siswa tidak ditemukan',
      })
    }

    // Cek atau buat learning session
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

    // Build system prompt dengan data lengkap
    const systemPrompt = buildSystemPrompt({
      student: studentProfile,
      subject,
      topic,
      grade,
      mode: normalizedMode,
      curriculum: studentProfile.curriculum,
      interests: studentProfile.interests,
      learningStyle: studentProfile.learning_style,
      additionalNotes: studentProfile.additional_notes,
    })

    const userPrompt = `
Siswa bertanya:
${questionText}

Informasi tambahan:
- Subject: ${subject}
- Topic: ${topic}
- Grade: ${grade}
- Mode: ${normalizedMode}
- Clue sudah digunakan: ${clueUsedCount} (maks 3)
- File OCR placeholder: ${file ? 'Ada file dilampirkan (OCR belum aktif)' : 'Tidak ada file'}

Bantu siswa memahami soal tanpa memberi jawaban langsung. Gunakan clue yang sesuai dengan jumlah clue yang sudah diberikan.
`

    const aiResult = await generateDeepSeekResponse({
      systemPrompt,
      userPrompt,
      subject,
      topic,
      mode: normalizedMode,
      questionText,
    })

    // Tentukan apakah perlu guidance (setelah 3 clue dan masih salah)
    // Untuk MVP, kita asumsikan jika clueUsedCount >= 3 dan AI response mengandung "solusi" atau "jawaban" maka need_guidance = true
    // Atau kita bisa minta AI menandai dengan flag, tapi untuk sederhananya:
    let needGuidance = false
    if (clueUsedCount >= 3) {
      // Cek apakah response mengandung indikasi solusi penuh
      const lowerResponse = aiResult.text.toLowerCase()
      if (lowerResponse.includes('solusi') || lowerResponse.includes('jawaban') || lowerResponse.includes('berikut langkah')) {
        needGuidance = true
      }
    }

    const xpEarned = calculateXP(normalizedMode, clueUsedCount, attempts)

    // Insert question log
    const { error: logError } = await supabase.from('question_logs').insert([
      {
        session_id: session.id,
        student_id: studentId,
        question_text: questionText,
        clue_used_count: clueUsedCount,
        xp_earned: xpEarned,
        need_guidance: needGuidance, // PRD 6.5: catat need_guidance
      },
    ])

    if (logError) {
      console.error('Question log insert error:', logError)
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan log pertanyaan',
      })
    }

    // Update session XP
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
        needGuidance, // optional, for frontend to know
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
