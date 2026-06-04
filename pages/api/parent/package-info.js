import { getAuthenticatedParent } from '@/lib/auth'
import supabase from '@/lib/supabaseClient'

function calcRemainingDays(expiresAt) {
  if (!expiresAt) return null
  const now = new Date()
  const expiry = new Date(expiresAt)
  if (Number.isNaN(expiry.getTime())) return null
  const diffMs = expiry.getTime() - now.getTime()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' })
  }

  try {
    const parentAuth = await getAuthenticatedParent(req, res)
    const parentId = String(parentAuth?.parentId || '').trim()

    if (!parentAuth || !parentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { data, error } = await supabase
      .from('parent_profile')
      .select('id, subscription_tier, subscription_expires_at, auto_renewal, trial_ends_at, trial_used')
      .eq('id', parentId)
      .maybeSingle()

    if (error) {
      throw new Error(`Gagal mengambil info paket: ${error.message}`)
    }

    if (!data) {
      return res.status(404).json({ success: false, message: 'Parent tidak ditemukan' })
    }

    const trialRemainingDays = data?.trial_ends_at ? calcRemainingDays(data.trial_ends_at) : null

    return res.status(200).json({
      success: true,
      data: {
        subscription_tier: data.subscription_tier || 'free',
        subscription_expires_at: data.subscription_expires_at || null,
        auto_renewal: Boolean(data.auto_renewal),
        trial_ends_at: data.trial_ends_at || null,
        trial_used: Boolean(data.trial_used),
        trial_remaining_days: trialRemainingDays,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server'
    return res.status(500).json({ success: false, message })
  }
}