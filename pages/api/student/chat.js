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
  const cluePenalty = Math.max(0, Number(clueUsedCount) || 0) * 3
  const attemptPenalty = Math.max(0, (Number(attempts) || 1) - 1) * 2
  return Math.max(5, baseXp - cluePenalty - attemptPenalty)
}

// ============================================================
// PROMPT MASTER RINGKAS – AI MI SOKRATIK (Target ~1000 token)
// ============================================================
function buildSystemPrompt({ student, subject, topic, grade, mode, curriculum, interests, learningStyle, additionalNotes }) {
  const studentName = student?.student_name || 'Siswa'
  const studentGrade = student?.grade || grade || '-'
  const studentCurriculum = curriculum || student?.curriculum || 'Kurikulum Merdeka'
  const studentInterests = interests || student?.interests || ''
  const studentLearningStyle = learningStyle || student?.learning_style || 'Campuran'
  const studentAdditionalNotes = additionalNotes || student?.additional_notes || ''

  // Suhu mode
  let modeDesc = ''
  if (mode === 'exam') {
    modeDesc = `[MODE EXAM] Temperature 0.1 – Beku, langsung, tanpa clue. Validasi: "✔ Benar" atau "✘ Salah. Jawaban: X".`
  } else if (mode === 'homework') {
    modeDesc = `[MODE HOMEWORK] Temperature 0.4 – Hangat, step-by-step, maks 3 clue progresif.`
  } else {
    modeDesc = `[MODE PRACTICE] Temperature 0.5 – Ekspresif, ramah, analogi sederhana, maks 3 clue.`
  }

  return `
Anda Ai Mi, guru privat SOKRATIK MindSeek.

Siswa: ${studentName} (Grade ${studentGrade}, Kurikulum ${studentCurriculum})
Minat: ${studentInterests || '-'}
Gaya belajar: ${studentLearningStyle}
Mapel: ${subject} | Topik: ${topic}

${modeDesc}

ATURAN EMAS (WAJIB):
1. JANGAN pernah beri jawaban final di awal.
2. SETIAP respons AKHIRI dengan pertanyaan.
3. Jika siswa minta soal latihan → TANYAKAN dulu materi dan tingkat kesulitan.

LARANGAN:
- Jangan bilang "salah" → ganti "Hampir, coba periksa lagi".
- Grade 1-3: analogi BENDA NYATA (permen, kelereng). Jangan abstrak.
- Grade 4-6: uang, waktu, pecahan.
- Grade 7-9: diskon, kecepatan, persen.
- Grade 10-12: investasi, probabilitas.

DIMENSI SOAL (variasi): Pemahaman Angka | Logika Dasar | Aplikasi (cerita)
LEVEL: Mudah (1 langkah) | Sedang (2 langkah) | Sulit (3+ langkah)

FORMAT RESPONS:
[1] Sapa (Hai! / Wah semangat!)
[2] Inti + pujian/clue (✔/✘ jika exam)
[3] Pertanyaan penutup

CONTOH (Practice, grade 4):
Siswa: "Buat soal perkalian"
Ai Mi: "Hai! Seru. Materi perkalian level mudah? Coba: 4 × 3 = ? Tulis jawabanmu."

Mode saat ini: ${mode}
`.trim()
}

function getTemperatureForMode(mode) {
  const m = String(mode || '').toLowerCase()
  if (m === 'exam') return 0.1
  if (m === 'homework') return 0.4
  return 0.5
}

function buildMockResponse({ subject, topic, mode, questionText, grade }) {
  return `Hai! Ai Mi di sini. Untuk "${questionText}", mari kita bahas bersama. Sebelum lanjut, boleh ceritakan dulu: apakah kamu sudah pernah belajar topik ${topic}?`
}

async function generateDeepSeekResponse({ systemPrompt, userPrompt, mode }) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const temperature = getTemperatureForMode(mode)

  if (!apiKey) {
    return { text: buildMockResponse({ mode, questionText: userPrompt }), source: 'mock' }
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      console.error('DeepSeek API error:', await response.text())
      return { text: buildMockResponse({ mode, questionText: userPrompt }), source: 'mock' }
    }

    const result = await response.json()
    const text = result?.choices?.[0]?.message?.content || buildMockResponse({ mode, questionText: userPrompt })
    return { text, source: 'deepseek' }
  } catch (error) {
    console.error('DeepSeek request failed:', error)
    return { text: buildMockResponse({ mode, questionText: userPrompt }), source: 'mock' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  try {
    const token = req.cookies?.student_token
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })

    let payload
    try {
      const verified = await jwtVerify(token, JWT_SECRET)
      payload = verified.payload
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa' })
    }

    const studentId = payload?.id
    if (!studentId) return res.status(401).json({ success: false, message: 'Payload token tidak valid' })

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
      return res.status(400).json({ success: false, message: 'subject, topic, grade, mode, dan questionText wajib diisi' })
    }
    if (!['homework', 'practice', 'exam'].includes(normalizedMode)) {
      return res.status(400).json({ success: false, message: 'Mode harus homework, practice, atau exam' })
    }

    const { data: studentProfile, error: studentError } = await supabase
      .from('students_profile')
      .select('id, student_name, grade, curriculum, interests, learning_style, additional_notes, question_settings')
      .eq('id', studentId)
      .single()

    if (studentError || !studentProfile) {
      return res.status(404).json({ success: false, message: 'Profil siswa tidak ditemukan' })
    }

    // Cari atau buat learning session
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
      return res.status(500).json({ success: false, message: 'Gagal memeriksa session belajar' })
    }

    let session = existingSession
    if (!session) {
      const { data: newSession, error: createSessionError } = await supabase
        .from('learning_sessions')
        .insert([{
          student_id: studentId,
          subject,
          topic,
          mode: normalizedMode,
          started_at: new Date().toISOString(),
          is_completed: false,
          total_xp_earned: 0,
        }])
        .select('id, total_xp_earned')
        .single()

      if (createSessionError || !newSession) {
        console.error('Create session error:', createSessionError)
        return res.status(500).json({ success: false, message: 'Gagal membuat session belajar' })
      }
      session = newSession
    }

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
Siswa bertanya: "${questionText}"

Grade: ${grade} | Mode: ${normalizedMode} | Topik: ${topic}
Clue sudah digunakan: ${clueUsedCount} (maks 3)

Instruksi AI:
- Ikuti karakteristik mode ${normalizedMode}
- Jika minta soal latihan, tanyakan materi & tingkat kesulitan dulu
- Akhiri dengan pertanyaan
- Grade 1-3: analogi benda nyata (permen, kelereng)
    `.trim()

    const aiResult = await generateDeepSeekResponse({ systemPrompt, userPrompt, mode: normalizedMode })

    // Need guidance setelah 3 clue dan respons mengandung kata solusi/jawaban
    let needGuidance = false
    if (clueUsedCount >= 3) {
      const lower = aiResult.text.toLowerCase()
      if (lower.includes('solusi') || lower.includes('jawaban') || lower.includes('berikut langkah')) needGuidance = true
    }

    const xpEarned = calculateXP(normalizedMode, clueUsedCount, attempts)

    // Simpan log pertanyaan
    const { error: logError } = await supabase.from('question_logs').insert([{
      session_id: session.id,
      student_id: studentId,
      question_text: questionText,
      clue_used_count: clueUsedCount,
      xp_earned: xpEarned,
      need_guidance: needGuidance,
    }])

    if (logError) {
      console.error('Question log insert error:', logError)
      return res.status(500).json({ success: false, message: 'Gagal menyimpan log pertanyaan' })
    }

    // Update session XP
    const updatedSessionXp = (session?.total_xp_earned || 0) + xpEarned
    await supabase.from('learning_sessions').update({ total_xp_earned: updatedSessionXp }).eq('id', session.id)

    // Update total_xp siswa
    const { data: xpRow } = await supabase.from('students_profile').select('total_xp').eq('id', studentId).maybeSingle()
    const newTotalXp = (xpRow?.total_xp || 0) + xpEarned
    await supabase.from('students_profile').update({ total_xp: newTotalXp }).eq('id', studentId)

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        response: aiResult.text,
        xpEarned,
        aiSource: aiResult.source,
        needGuidance,
      },
    })
  } catch (error) {
    console.error('Student chat error:', error)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}
