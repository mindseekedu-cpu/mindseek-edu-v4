import { getAuthenticatedParent } from '@/lib/auth'
import supabase from '@/lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' })
  }

  try {
    const parentAuth = await getAuthenticatedParent(req, res)
    const parentId = String(parentAuth?.parentId || '').trim()

    if (!parentAuth || !parentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const autoRenewal = req.body?.auto_renewal

    if (typeof autoRenewal !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'auto_renewal harus boolean',
      })
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('parent_profile')
      .update({
        auto_renewal: autoRenewal,
        updated_at: now,
      })
      .eq('id', parentId)

    if (error) {
      throw new Error(`Gagal memperbarui auto_renewal: ${error.message}`)
    }

    return res.status(200).json({
      success: true,
      data: {
        auto_renewal: autoRenewal,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server'
    return res.status(500).json({ success: false, message })
  }
}