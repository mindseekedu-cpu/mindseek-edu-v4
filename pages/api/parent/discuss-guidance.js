import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' });
  }

  try {
    // 1. Autentikasi parent
    const parentAuth = await getAuthenticatedParent(req);
    const parentId = String(parentAuth?.parentId || '').trim();
    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 2. Ambil parameter dari body
    const { guidanceQuestionId, isDiscussed } = req.body || {};
    if (!guidanceQuestionId) {
      return res.status(400).json({ success: false, message: 'guidanceQuestionId wajib diisi' });
    }

    // 3. Ambil data guidance_questions beserta relasi ke question_logs
    const { data: guidance, error: fetchError } = await supabase
      .from('guidance_questions')
      .select(`
        id,
        question_log_id,
        status,
        question_log:question_logs (
          student_id
        )
      `)
      .eq('id', guidanceQuestionId)
      .single();

    if (fetchError || !guidance) {
      return res.status(404).json({ success: false, message: 'Data guidance question tidak ditemukan' });
    }

    // 4. Verifikasi bahwa siswa yang terkait adalah milik parent yang login
    const studentId = guidance.question_log?.student_id;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Data tidak valid: missing student_id' });
    }

    const { data: student, error: studentError } = await supabase
      .from('students_profile')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (studentError || !student) {
      return res.status(403).json({ success: false, message: 'Siswa tidak terdaftar pada parent yang login' });
    }

    // 5. Tentukan status baru
    const newStatus = isDiscussed === true ? 'discussed' : 'pending';
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // 6. Lakukan update
    const { data: updated, error: updateError } = await supabase
      .from('guidance_questions')
      .update(updateData)
      .eq('id', guidanceQuestionId)
      .select('id, status, updated_at')
      .single();

    if (updateError) {
      throw new Error(`Gagal update status: ${updateError.message}`);
    }

    return res.status(200).json({
      success: true,
      message: `Status berhasil diubah menjadi ${newStatus === 'discussed' ? 'sudah didiskusikan' : 'pending'}`,
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';
    console.error('[discuss-guidance] Error:', error);
    return res.status(500).json({ success: false, message });
  }
}
