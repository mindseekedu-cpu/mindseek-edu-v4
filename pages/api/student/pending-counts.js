import { jwtVerify } from 'jose';
import supabase from '@/lib/supabaseClient';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const token = req.cookies?.student_token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let payload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload;
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Token tidak valid' });
    }

    const studentId = payload?.id;
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    // 1. Hitung remedial_tasks pending
    const { count: pendingRemedial, error: remedialError } = await supabase
      .from('remedial_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'pending');

    if (remedialError) {
      console.error('Error fetching remedial tasks:', remedialError);
    }

    // 2. Hitung pending discussions (guidance_questions dengan status pending)
    // Kita perlu join dengan question_logs untuk mendapatkan student_id
    const { data: questionLogs, error: qlError } = await supabase
      .from('question_logs')
      .select('id')
      .eq('student_id', studentId);

    let discussionCount = 0;
    if (!qlError && questionLogs && questionLogs.length > 0) {
      const questionLogIds = questionLogs.map(log => log.id);
      const { count, error: gqError } = await supabase
        .from('guidance_questions')
        .select('id', { count: 'exact', head: true })
        .in('question_log_id', questionLogIds)
        .eq('status', 'pending');
      if (!gqError) discussionCount = count || 0;
    }

    const total = (pendingRemedial || 0) + discussionCount;

    return res.status(200).json({
      success: true,
      data: {
        pendingDiscussions: discussionCount,
        pendingRemedial: pendingRemedial || 0,
        total,
      },
    });
  } catch (error) {
    console.error('[pending-counts] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
