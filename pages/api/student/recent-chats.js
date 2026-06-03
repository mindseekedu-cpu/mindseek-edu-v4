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
      .from('learning_sessions')
      .select('id, mode, topic, started_at, is_completed, total_xp_earned')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(10)
    if (error) {
      console.error('Recent chats query error:', error)
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil recent chats',
      })
    }
    return res.status(200).json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    console.error('Student recent chats error:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}