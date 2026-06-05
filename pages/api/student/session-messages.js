import { jwtVerify } from 'jose';
import supabase from '@/lib/supabaseClient';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // 1. Autentikasi siswa dari cookie
    const token = req.cookies?.student_token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let payload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload;
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa' });
    }

    const studentId = payload?.id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Payload token tidak valid' });
    }

    // 2. Ambil sessionId dari query string
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, message: 'sessionId wajib diisi' });
    }

    // 3. Verifikasi bahwa session milik student yang login
    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, student_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
    }

    if (session.student_id !== studentId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    // 4. Ambil riwayat pesan dari tabel `chat_messages` (jika ada)
    //    Jika tabel belum ada, kita bisa fallback dengan mengambil dari question_logs
    //    dan response AI dari table lain? Sementara kita asumsikan `chat_messages` sudah ada.

    // Cek apakah tabel chat_messages ada (opsional, jika error, fallback)
    let messages = [];
    try {
      const { data: chatMessages, error: chatError } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (chatError) throw chatError;
      messages = chatMessages || [];
    } catch (err) {
      // Fallback: jika tabel chat_messages belum ada, ambil dari question_logs + response dummy?
      console.warn('Tabel chat_messages belum ada, fallback ke question_logs. Silakan buat tabel chat_messages.');
      // Sebagai fallback sederhana, kita ambil question_logs dan buat pesan user saja (tanpa AI)
      const { data: logs, error: logsError } = await supabase
        .from('question_logs')
        .select('question_text, answered_at, xp_earned')
        .eq('session_id', sessionId)
        .order('answered_at', { ascending: true });

      if (!logsError && logs) {
        messages = logs.map(log => ({
          role: 'user',
          content: log.question_text,
          created_at: log.answered_at,
        }));
        // Tidak ada pesan assistant karena tidak tersimpan di question_logs
        // Bisa ditambahkan dummy atau kosong
      }
    }

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('[session-messages] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
