import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function extractTopicFromSession(session) {
  const candidates = [
    session?.topic,
    session?.topic_name,
    session?.subject_topic,
    session?.session_topic,
    session?.title,
    session?.subject,
  ];
  for (const candidate of candidates) {
    const text = normalizeText(candidate);
    if (text) return text;
  }
  return null;
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

    // Ambil semua learning_sessions untuk siswa ini
    const { data: sessions, error: sessionsError } = await supabase
      .from('learning_sessions')
      .select('topic, topic_name, subject_topic, session_topic, title, subject')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false });

    if (sessionsError) {
      throw new Error(`Gagal mengambil data topik: ${sessionsError.message}`);
    }

    // Ekstrak topik unik (case-insensitive, pakai lowercase untuk uniqueness)
    const topicSet = new Map(); // key lowercase -> display as original
    for (const session of sessions || []) {
      const topic = extractTopicFromSession(session);
      if (topic) {
        const key = topic.toLowerCase();
        if (!topicSet.has(key)) {
          topicSet.set(key, topic);
        }
      }
    }

    // Konversi ke array sorted
    const topics = Array.from(topicSet.values()).sort((a, b) => a.localeCompare(b, 'id'));

    // Tambahkan opsi "Semua Topik" untuk frontend (bisa ditambahkan di frontend)
    return res.status(200).json({
      success: true,
      data: topics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';
    console.error('[topik-list] Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
