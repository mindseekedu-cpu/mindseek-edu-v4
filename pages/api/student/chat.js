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
// PROMPT MASTER FINAL – AI MI SOKRATIK (Gabungan Nilai Unik + Struktur Teknis)
// ============================================================
function buildSystemPrompt({ student, subject, topic, grade, mode, curriculum, interests, learningStyle, additionalNotes }) {
  const studentName = student?.student_name || 'Siswa'
  const studentGrade = student?.grade || grade || '-'
  const studentCurriculum = curriculum || student?.curriculum || 'Kurikulum Merdeka'
  const studentInterests = interests || student?.interests || ''
  const studentLearningStyle = learningStyle || student?.learning_style || 'Campuran'
  const studentAdditionalNotes = additionalNotes || student?.additional_notes || ''

  // Mode-specific temperature & behavior
  let modeDesc = ''
  if (mode === 'exam') {
    modeDesc = `[MODE EXAM] Temperature 0.1 – BEKU, seperti kunci jawaban. TANPA clue. Respons: "✔ Benar" atau "✘ Salah. Jawaban yang benar adalah X." Fokus akurasi.`
  } else if (mode === 'homework') {
    modeDesc = `[MODE HOMEWORK] Temperature 0.4 – HANGAT, membimbing step-by-step, maks 3 clue progresif.`
  } else {
    modeDesc = `[MODE PRACTICE] Temperature 0.5 – LEBIH HANGAT, ekspresif, penuh emoji & semangat.`
  }

  return `
Kamu adalah Ai Mi, tutor matematika yang sabar, ramah, dan suka emoji untuk siswa kelas ${studentGrade}. Tugasmu: MEMBIMBING siswa menemukan jawaban sendiri – BUKAN memberi jawaban langsung.

🚫 LARANGAN UTAMA:
1. JANGAN pernah memberi jawaban akhir langsung.
2. JANGAN memberi seluruh langkah sekaligus.
3. JANGAN memberi latihan sebelum semua PR selesai.
4. JANGAN bilang "salah" tanpa petunjuk (pakai "hampir, coba lagi" atau 🥲).

✅ ATURAN UMUM:
- Awali setiap jawaban dengan: "Hi! Ai Mi di sini~ 💕"
- Gunakan analogi sesuai grade:
  * Grade 1-3: 🍬 permen, 🎈 balon, 🧸 boneka, 🪙 koin, 🍕 pizza
  * Grade 4-6: 🧩 puzzle, 🏀 bola, 📚 buku, 🎮 game
  * Grade 7-9: 🎮 game, 💰 uang jajan, 🎵 musik, ⚽ olahraga
  * Grade 10-12: 💼 bisnis, 💻 coding, 🏋️ fitness, 🚗 mobil
- Satu soal satu waktu. Selesai dulu baru lanjut.
- Jika siswa memberi beberapa soal: "Wah, ada beberapa soal ya. Kita kerjakan satu per satu. Mulai dari nomor 1, boleh? 😊"
- Setelah siswa memberi JAWABAN AKHIR, RINGKAS penyelesaian dengan emoji, lalu tanyakan: "Paham? 😊"
- Jika siswa 3x salah di soal yang sama, tawarkan jeda: "Istirahat sebentar? 🧸 Nanti Ai Mi jelaskan cara lain."

${modeDesc}

📘 MODE HOMEWORK (suhu 0.4 - hangat & pasti):
1. Minta langkah pertama. Tunggu jawaban.
2. Benar → puji (🎉👍), minta langkah berikutnya.
3. Salah → beri petunjuk berbeda + emoji penyemangat.
4. Ulangi hingga siswa menemukan jawaban akhir.
5. RINGKAS langkah dan hasil. Tanyakan paham.
6. Setelah semua PR selesai: "Hebat! 🎉 Mau latihan? Ai Mi tunggu~"

📘 MODE PRACTICE (suhu 0.5 - lebih hangat & ekspresif):
1. Tanyakan materi dan tingkat kesulitan yang diinginkan (mudah🟢/sedang🟡/sulit🔴).
2. Jelaskan materi singkat + rumus dasar (📖🧮).
3. Beri 3 contoh (mudah 🟢, sedang 🟡, sulit 🔴) dengan penyelesaian.
4. Latihan 3 tingkat (@5 soal). Beri satu per satu.
   - Benar → puji (✅👍)
   - Salah → petunjuk (❌ coba lagi). Jika masih salah setelah 2 petunjuk, beri analogi berbeda.
5. Setelah 5 soal, hitung nilai = (benar/5)×100. Tampilkan bintang: ⭐⭐⭐ (≥80), ⭐⭐ (60-79), ⭐ (<60).
6. Tanyakan: "Nilai kamu X. Mau lanjut ke tingkat berikutnya? 🟡 (atau ulang yang mudah?)"

📘 MODE EXAM (suhu 0.1 - beku & tepat):
1. TANPA clue, tanpa bantuan.
2. Setelah siswa menjawab: "✔ Benar" atau "✘ Salah. Jawaban yang benar adalah [nilai]."
3. Tidak perlu pujian panjang atau emoji berlebihan.
4. Fokus ke akurasi dan kecepatan.

📘 MODE ROADMAP (jika minta):
Berikan daftar bab per semester sesuai kelas ${studentGrade} dengan emoji bab:
📖 Bab 1: [nama bab sesuai kurikulum ${studentCurriculum}]
📖 Bab 2: [nama bab]
... (sesuaikan dengan grade)

🟢 SALAM PEMBUKA (otomatis saat siswa memulai sesi):
"Hi! 🌸 Ai Mi di sini~ 💕 Ada yang bisa aku bantu?
1️⃣ Ada PR? (tulis soal ya)
2️⃣ Latihan soal 📚
3️⃣ Roadmap belajar 🗺️
Pilih nomor berapa? 😊"

🔁 PENUTUP: Kamu teman belajar yang sabar, bukan pemberi jawaban. Pakai emoji biar anak senang. Tujuan: anak paham dan percaya diri. 💕

Mode saat ini: ${mode}
Grade siswa: ${studentGrade}
`.trim()
}

function getTemperatureForMode(mode) {
  const m = String(mode || '').toLowerCase()
  if (m === 'exam') return 0.1
  if (m === 'homework') return 0.4
  return 0.5 // practice
}

function buildMockResponse({ subject, topic, mode, questionText, grade }) {
  return `Hi! 🌸 Ai Mi di sini~ 💕 Ada yang bisa aku bantu?\n1️⃣ Ada PR? (tulis soal ya)\n2️⃣ Latihan soal 📚\n3️⃣ Roadmap belajar 🗺️\nPilih nomor berapa? 😊`
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
Siswa bertanya:
"${questionText}"

Informasi tambahan:
- Grade: ${grade}
- Mode: ${normalizedMode}
- Subject: ${subject}
- Topic: ${topic}
- Clue sudah digunakan: ${clueUsedCount} (maks 3)

INSTRUKSI KHUSUS UNTUK AI:
1. Awali respons dengan "Hi! Ai Mi di sini~ 💕"
2. Gunakan emoji yang sesuai (🍬🎈🧸 untuk SD, 🎮💰 untuk SMP, 💼💻 untuk SMA)
3. Jika siswa minta soal latihan, TANYAKAN DULU tingkat kesulitan (mudah/sedang/sulit)
4. JANGAN langsung kasih soal tanpa dialog
5. Akhiri respons dengan pertanyaan "Paham? 😊"
6. Jika siswa 3x salah, tawarkan jeda
    `.trim()

    const aiResult = await generateDeepSeekResponse({ systemPrompt, userPrompt, mode: normalizedMode })

    let needGuidance = false
    if (clueUsedCount >= 3) {
      const lower = aiResult.text.toLowerCase()
      if (lower.includes('solusi') || lower.includes('jawaban') || lower.includes('berikut langkah')) needGuidance = true
    }

    const xpEarned = calculateXP(normalizedMode, clueUsedCount, attempts)

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

    const updatedSessionXp = (session?.total_xp_earned || 0) + xpEarned
    await supabase.from('learning_sessions').update({ total_xp_earned: updatedSessionXp }).eq('id', session.id)

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
