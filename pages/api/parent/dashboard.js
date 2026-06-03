import supabase from '@/lib/supabaseClient';
import { getAuthenticatedParent } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan.',
    });
  }

  if (!supabase) {
    return res.status(500).json({
      success: false,
      message: 'Supabase client tidak tersedia.',
    });
  }

  try {
    const { parentId, parent } = await getAuthenticatedParent(req);

    const { data: students, error: studentsError } = await supabase
      .from('students_profile')
      .select('id, student_name, grade, student_id')
      .eq('parent_id', parentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (studentsError) {
      throw new Error(studentsError.message || 'Gagal mengambil data siswa.');
    }

    return res.status(200).json({
      success: true,
      parent: {
        id: parent.id,
        name: parent.name,
        subscription_tier: parent.subscription_tier,
        subscription_expires_at: parent.subscription_expires_at,
      },
      students: Array.isArray(students) ? students : [],
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat memuat dashboard.',
    });
  }
}