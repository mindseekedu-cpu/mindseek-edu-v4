import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { getStudentLearningSummary } from '@/lib/statistics';

function getTodayRange(days = 30) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
}

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

    const { startDate, endDate } = getTodayRange(30);
    const summary = await getStudentLearningSummary(studentId, startDate, endDate);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';

    return res.status(500).json({
      success: false,
      message,
    });
  }
}