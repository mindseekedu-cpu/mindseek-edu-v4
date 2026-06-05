import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { getTopicCategory } from '@/lib/statistics';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeTopic(log, session) {
  const candidates = [
    log?.topic,
    log?.topic_name,
    log?.subtopic,
    log?.material_topic,
    session?.topic,
    session?.topic_name,
    session?.subject_topic,
    session?.title,
    session?.session_topic,
    session?.subject,
  ];
  for (const candidate of candidates) {
    const text = normalizeText(candidate);
    if (text) return text;
  }
  return 'Tanpa Topik';
}

function normalizeBucket(log) {
  const textCandidates = [
    log?.support_level,
    log?.assistance_level,
    log?.help_level,
    log?.answer_support,
    log?.answer_mode,
    log?.completion_type,
    log?.result_category,
    log?.status,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);
  if (log?.needs_assistance === true || log?.requires_guidance === true) return 'perlu_dampingan';
  if (log?.is_assisted === true || log?.used_hint === true || log?.was_helped === true) return 'dibantu';
  if (log?.is_independent === true || log?.self_solved === true) return 'mandiri';
  for (const text of textCandidates) {
    if (text.includes('perlu_dampingan') || text.includes('perlu dampingan') || text.includes('butuh bantuan')) return 'perlu_dampingan';
    if (text.includes('dibantu') || text.includes('assisted') || text.includes('with help') || text.includes('hint')) return 'dibantu';
    if (text.includes('mandiri') || text.includes('independent') || text.includes('self')) return 'mandiri';
  }
  return 'perlu_dampingan';
}

function getDifficultyLevels(logsForTopic) {
  let easy = 0, medium = 0, hard = 0;
  logsForTopic.forEach(log => {
    const level = (log.difficulty_level || '').toLowerCase();
    if (level === 'easy' || level === 'mudah') easy++;
    else if (level === 'hard' || level === 'sulit') hard++;
    else medium++;
  });
  return { easy, medium, hard };
}

function formatTerakhirLatihan(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' });
  }

  try {
    const parentAuth = await getAuthenticatedParent(req);
    const parentId = String(parentAuth?.parentId || '').trim();
    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const studentId = String(req.query.studentId || '').trim();
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId wajib diisi' });
    }

    // Verifikasi siswa milik parent
    const { data: student, error: studentError } = await supabase
      .from('students_profile')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(403).json({ success: false, message: 'Siswa tidak terdaftar pada parent yang login' });
    }

    // Ambil semua question_logs + learning_sessions
    const { data: logs, error: logsError } = await supabase
      .from('question_logs')
      .select('*, learning_sessions!inner(*)')
      .eq('student_id', studentId)
      .not('answered_at', 'is', null)
      .order('answered_at', { ascending: false });

    if (logsError) {
      throw new Error(`Gagal mengambil data soal: ${logsError.message}`);
    }

    // Kelompokkan per topik
    const topicMap = new Map();

    for (const log of logs) {
      const session = log.learning_sessions;
      const topic = normalizeTopic(log, session);
      const bucket = normalizeBucket(log);
      const lastDate = log.answered_at;

      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          total_questions: 0,
          mandiri: 0,
          dibantu: 0,
          perlu_dampingan: 0,
          last_latihan: null,
          logs: [],
        });
      }

      const entry = topicMap.get(topic);
      entry.total_questions += 1;
      if (bucket === 'mandiri') entry.mandiri += 1;
      else if (bucket === 'dibantu') entry.dibantu += 1;
      else entry.perlu_dampingan += 1;

      if (!entry.last_latihan || new Date(lastDate) > new Date(entry.last_latihan)) {
        entry.last_latihan = lastDate;
      }
      entry.logs.push(log);
    }

    // Hitung kemandirian, tingkat kesulitan, status data, evaluasi
    const result = [];
    for (const [_, topicData] of topicMap.entries()) {
      const total = topicData.total_questions;
      const mandiri = topicData.mandiri;
      const kemandirianPercent = total > 0 ? parseFloat(((mandiri / total) * 100).toFixed(2)) : 0;

      const difficulty = getDifficultyLevels(topicData.logs);
      const cukupData = total >= 10;
      let evaluasi = null;
      if (cukupData) {
        const kategori = getTopicCategory({
          total_questions: total,
          mandiri: topicData.mandiri,
          dibantu: topicData.dibantu,
        });
        evaluasi = kategori;
      }

      result.push({
        topic: topicData.topic,
        total_questions: total,
        mandiri: topicData.mandiri,
        kemandirian_percent: kemandirianPercent,
        difficulty_easy: difficulty.easy,
        difficulty_medium: difficulty.medium,
        difficulty_hard: difficulty.hard,
        cukup_data: cukupData,
        evaluasi: evaluasi,
        terakhir_latihan: formatTerakhirLatihan(topicData.last_latihan),
      });
    }

    // Urutkan berdasarkan total soal terbanyak
    result.sort((a, b) => b.total_questions - a.total_questions);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';
    console.error('[progress-per-topik] Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
