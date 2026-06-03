import { getAuthenticatedParent } from '@/lib/auth'
import supabase from '@/lib/supabaseClient'

const ALLOWED_METRICS = ['xp', 'kemandirian', 'streak', 'nilai_rapor']
const MAX_REWARDS_PER_STUDENT = 3

async function requireParent(req, res) {
  const parentAuth = await getAuthenticatedParent(req, res)
  if (!parentAuth) {
    return { parentAuth: null, parentId: null, errorResponse: res.status(401).json({ success: false, message: 'Unauthorized' }) }
  }

  const parentId = String(parentAuth?.parentId || '').trim()
  if (!parentId) {
    return { parentAuth, parentId: null, errorResponse: res.status(401).json({ success: false, message: 'Unauthorized' }) }
  }

  return { parentAuth, parentId, errorResponse: null }
}

async function verifyStudentOwnedByParent(studentId, parentId) {
  const { data: student, error } = await supabase
    .from('students_profile')
    .select('id')
    .eq('id', studentId)
    .eq('parent_id', parentId)
    .maybeSingle()

  if (error) {
    throw new Error(`Gagal memverifikasi siswa: ${error.message}`)
  }

  return Boolean(student)
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' })
  }

  try {
    const { parentId, errorResponse } = await requireParent(req, res)
    if (errorResponse) return errorResponse

    if (req.method === 'GET') {
      const studentId = String(req.query?.studentId || '').trim()
      if (!studentId) {
        return res.status(400).json({ success: false, message: 'studentId wajib diisi' })
      }

      const owned = await verifyStudentOwnedByParent(studentId, parentId)
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Siswa tidak terdaftar pada parent yang login' })
      }

      const { data, error } = await supabase
        .from('parent_reward_settings')
        .select('id, student_id, target_metric, target_value, reward_text, created_at, updated_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true })
        .limit(MAX_REWARDS_PER_STUDENT)

      if (error) {
        throw new Error(`Gagal mengambil reward: ${error.message}`)
      }

      return res.status(200).json({
        success: true,
        data: Array.isArray(data) ? data : [],
      })
    }

    if (req.method === 'POST') {
      const studentId = String(req.body?.studentId || '').trim()
      const targetMetric = String(req.body?.target_metric || '').trim().toLowerCase()
      const targetValueRaw = req.body?.target_value
      const rewardText = String(req.body?.reward_text || '').trim()

      if (!studentId) {
        return res.status(400).json({ success: false, message: 'studentId wajib diisi' })
      }
      if (!targetMetric) {
        return res.status(400).json({ success: false, message: 'target_metric wajib diisi' })
      }
      if (!ALLOWED_METRICS.includes(targetMetric)) {
        return res.status(400).json({ success: false, message: 'target_metric tidak valid' })
      }

      const targetValue = Number(targetValueRaw)
      if (!Number.isFinite(targetValue) || targetValue <= 0) {
        return res.status(400).json({ success: false, message: 'target_value harus angka > 0' })
      }

      if (!rewardText) {
        return res.status(400).json({ success: false, message: 'reward_text wajib diisi' })
      }

      const owned = await verifyStudentOwnedByParent(studentId, parentId)
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Siswa tidak terdaftar pada parent yang login' })
      }

      const { count, error: countError } = await supabase
        .from('parent_reward_settings')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)

      if (countError) {
        throw new Error(`Gagal memeriksa jumlah reward: ${countError.message}`)
      }

      if ((count || 0) >= MAX_REWARDS_PER_STUDENT) {
        return res.status(400).json({
          success: false,
          message: `Maksimal ${MAX_REWARDS_PER_STUDENT} reward per siswa`,
        })
      }

      const now = new Date().toISOString()

      const { data: inserted, error: insertError } = await supabase
        .from('parent_reward_settings')
        .insert({
          student_id: studentId,
          target_metric: targetMetric,
          target_value: Math.floor(targetValue),
          reward_text: rewardText,
          created_at: now,
          updated_at: now,
        })
        .select('id, student_id, target_metric, target_value, reward_text, created_at, updated_at')
        .single()

      if (insertError) {
        throw new Error(`Gagal menyimpan reward: ${insertError.message}`)
      }

      return res.status(200).json({
        success: true,
        data: inserted,
      })
    }

    if (req.method === 'DELETE') {
      const rewardId = String(req.query?.id || req.body?.id || '').trim()
      if (!rewardId) {
        return res.status(400).json({ success: false, message: 'id reward wajib diisi' })
      }

      const { data: reward, error: rewardError } = await supabase
        .from('parent_reward_settings')
        .select('id, student_id')
        .eq('id', rewardId)
        .maybeSingle()

      if (rewardError) {
        throw new Error(`Gagal mengambil reward: ${rewardError.message}`)
      }

      if (!reward) {
        return res.status(404).json({ success: false, message: 'Reward tidak ditemukan' })
      }

      const owned = await verifyStudentOwnedByParent(String(reward.student_id), parentId)
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Reward bukan milik parent yang login' })
      }

      const { error: deleteError } = await supabase.from('parent_reward_settings').delete().eq('id', rewardId)

      if (deleteError) {
        throw new Error(`Gagal menghapus reward: ${deleteError.message}`)
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server'
    return res.status(500).json({ success: false, message })
  }
}