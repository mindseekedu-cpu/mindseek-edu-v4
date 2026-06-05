import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Helper untuk pagination
function getPagination(page, limit) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, offset };
}

// Helper untuk filter tanggal
function applyDateFilter(query, startDate, endDate, column = 'created_at') {
  if (startDate) {
    query = query.gte(column, startOfDay(startDate).toISOString());
  }
  if (endDate) {
    query = query.lte(column, endOfDay(endDate).toISOString());
  }
  return query;
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

    const tab = String(req.query.tab || 'all').toLowerCase(); // 'pending', 'all', 'discussed'
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { page: currentPage, limit: limitNum, offset } = getPagination(page, limit);
    const startDate = req.query.start_date ? String(req.query.start_date).trim() : null;
    const endDate = req.query.end_date ? String(req.query.end_date).trim() : null;
    const topic = req.query.topic ? String(req.query.topic).trim() : null;
    const level = req.query.level ? String(req.query.level).trim() : null;

    // --- TAB 1: Soal Belum Didiskusikan (guidance_questions dengan status pending) ---
    if (tab === 'pending') {
      let query = supabase
        .from('guidance_questions')
        .select(`
          id,
          question_log_id,
          expected_answer,
          teaching_steps,
          status,
          created_at,
          updated_at,
          question_log:question_logs (
            id,
            question_text,
            clue_used_count,
            xp_earned,
            answered_at,
            need_guidance,
            learning_sessions (
              topic,
              mode,
              subject
            )
          )
        `)
        .eq('status', 'pending')
        .eq('question_logs.student_id', studentId);

      if (topic) {
        query = query.ilike('question_logs.learning_sessions.topic', `%${topic}%`);
      }
      if (level) {
        // level mungkin ada di question_logs atau learning_sessions
        query = query.eq('question_logs.difficulty_level', level);
      }
      query = applyDateFilter(query, startDate, endDate, 'guidance_questions.created_at');
      query = query.range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Gagal mengambil data: ${error.message}`);

      return res.status(200).json({
        success: true,
        data: data || [],
        pagination: {
          page: currentPage,
          limit: limitNum,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limitNum),
        },
      });
    }

    // --- TAB 3: Soal Sudah Didiskusikan (guidance_questions dengan status discussed) ---
    if (tab === 'discussed') {
      let query = supabase
        .from('guidance_questions')
        .select(`
          id,
          question_log_id,
          expected_answer,
          teaching_steps,
          status,
          created_at,
          updated_at,
          question_log:question_logs (
            id,
            question_text,
            clue_used_count,
            xp_earned,
            answered_at,
            need_guidance,
            learning_sessions (
              topic,
              mode,
              subject
            )
          )
        `)
        .eq('status', 'discussed')
        .eq('question_logs.student_id', studentId);

      if (topic) {
        query = query.ilike('question_logs.learning_sessions.topic', `%${topic}%`);
      }
      if (level) {
        query = query.eq('question_logs.difficulty_level', level);
      }
      query = applyDateFilter(query, startDate, endDate, 'guidance_questions.created_at');
      query = query.range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Gagal mengambil data: ${error.message}`);

      return res.status(200).json({
        success: true,
        data: data || [],
        pagination: {
          page: currentPage,
          limit: limitNum,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limitNum),
        },
      });
    }

    // --- TAB 2: Seluruh Soal (question_logs) ---
    // Default tab = 'all'
    let query = supabase
      .from('question_logs')
      .select(`
        id,
        session_id,
        question_text,
        clue_used_count,
        xp_earned,
        answered_at,
        need_guidance,
        learning_sessions!inner (
          topic,
          mode,
          subject
        )
      `)
      .eq('student_id', studentId)
      .not('answered_at', 'is', null);

    if (topic) {
      query = query.ilike('learning_sessions.topic', `%${topic}%`);
    }
    if (level) {
      query = query.eq('difficulty_level', level);
    }
    query = applyDateFilter(query, startDate, endDate, 'answered_at');
    query = query.order('answered_at', { ascending: false });
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Gagal mengambil data: ${error.message}`);

    // Tambahkan status mandiri/dibantu/perlu_dampingan
    const enrichedData = (data || []).map(log => {
      // Tentukan status berdasarkan clue_used_count dan need_guidance
      let status = 'mandiri';
      if (log.need_guidance) {
        status = 'perlu_dampingan';
      } else if (log.clue_used_count > 0) {
        status = 'dibantu';
      }
      return {
        id: log.id,
        tanggal: log.answered_at,
        topik: log.learning_sessions?.topic || '-',
        mode: log.learning_sessions?.mode || '-',
        subject: log.learning_sessions?.subject || '-',
        soal: log.question_text,
        jawaban_siswa: null, // Tidak tersimpan di question_logs, bisa diambil dari tabel lain jika ada
        status: status,
        xp: log.xp_earned,
        clue_used: log.clue_used_count,
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedData,
      pagination: {
        page: currentPage,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';
    console.error('[daftar-soal] Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
