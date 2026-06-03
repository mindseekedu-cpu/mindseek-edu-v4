import { jwtVerify } from 'jose'
import supabase from '@/lib/supabaseClient'
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    })
  }
  try {
    const token = req.cookies?.student_token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      })
    }
    let payload
    try {
      const verified = await jwtVerify(token, JWT_SECRET)
      payload = verified.payload
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau sudah kedaluwarsa',
      })
    }
    const studentId = payload?.id
    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: 'Payload token tidak valid',
      })
    }
    const { data, error } = await supabase
      .from('students_profile')
      .select(
        'id, name:student_name, grade, total_xp, current_streak, longest_streak, question_settings'
      )
      .eq('id', studentId)
      .single()
    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Profil siswa tidak ditemukan',
      })
    }
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Student profile error:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}