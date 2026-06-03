import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { getFrequentTopics } from '@/lib/statistics';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan',
    });
  }

  try {
    const parentAuth = await getAuthenticatedParent(req, res);

    if (!parentAuth) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const parentId = String(parentAuth?.parentId || '').trim();

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const studentId = String(req.query.studentId || '').trim();

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId wajib diisi',
      });
    }

    const { data: student, error: studentError } = await supabase
      .from('students_profile')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (studentError) {
      throw new Error(`Gagal memverifikasi siswa: ${studentError.message}`);
    }

    if (!student) {
      return res.status(403).json({
        success: false,
        message: 'Siswa tidak terdaftar pada parent yang login',
      });
    }

    const topics = await getFrequentTopics(studentId, 5);

    return res.status(200).json({
      success: true,
      data: topics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';

    return res.status(500).json({
      success: false,
      message,
    });
  }
}