import crypto from 'crypto'
import supabase from '@/lib/supabaseClient'

function sha512Hex(input) {
  return crypto.createHash('sha512').update(input).digest('hex')
}

function addDaysISO(days) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days || 0))
  return d.toISOString()
}

function packageToTier(packageType) {
  if (packageType === 'monthly_smart_parent' || packageType === 'yearly_smart_parent') return 'smart_parent'
  if (packageType === 'monthly_smart_family' || packageType === 'yearly_smart_family') return 'smart_family'
  return 'free'
}

function packageToDurationDays(packageType) {
  if (packageType === 'monthly_smart_parent' || packageType === 'monthly_smart_family') return 30
  if (packageType === 'yearly_smart_parent' || packageType === 'yearly_smart_family') return 365
  return 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' })
  }

  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      return res.status(500).json({ success: false, message: 'MIDTRANS_SERVER_KEY belum dikonfigurasi' })
    }

    const notification = req.body || {}

    const orderId = String(notification.order_id || '').trim()
    const statusCode = String(notification.status_code || '').trim()
    const grossAmount = String(notification.gross_amount || '').trim()
    const transactionStatus = String(notification.transaction_status || '').trim()
    const paymentType = notification.payment_type ? String(notification.payment_type).trim() : null
    const signatureKey = String(notification.signature_key || '').trim()

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return res.status(400).json({ success: false, message: 'Payload Midtrans tidak lengkap' })
    }

    const expectedSignature = sha512Hex(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    if (expectedSignature !== signatureKey) {
      return res.status(401).json({ success: false, message: 'Signature tidak valid' })
    }

    // Cari transaksi lokal
    const { data: trx, error: trxError } = await supabase
      .from('transactions')
      .select('id, parent_id, order_id, package_type, snap_token')
      .eq('order_id', orderId)
      .maybeSingle()

    if (trxError) {
      throw new Error(`Gagal mengambil transaksi: ${trxError.message}`)
    }

    if (!trx) {
      // Tetap return 200 agar Midtrans tidak retry terus-menerus, tapi catat error agar terlihat di logs
      console.warn('Midtrans webhook: order_id tidak ditemukan di transactions:', orderId)
      return res.status(200).json({ success: true })
    }

    const now = new Date().toISOString()

    // Update transaksi (selalu)
    const { error: updTrxError } = await supabase
      .from('transactions')
      .update({
        transaction_status: transactionStatus || 'unknown',
        gross_amount: Number(grossAmount),
        payment_type: paymentType,
        updated_at: now,
      })
      .eq('id', trx.id)

    if (updTrxError) {
      throw new Error(`Gagal update transaksi: ${updTrxError.message}`)
    }

    // Jika settlement / capture sukses → aktifkan subscription
    // Midtrans: kartu kredit bisa 'capture' lalu dianggap paid jika fraud_status accept.
    const fraudStatus = notification.fraud_status ? String(notification.fraud_status).trim() : null
    const isCaptureAccept = transactionStatus === 'capture' && (!fraudStatus || fraudStatus === 'accept')
    const isPaid = transactionStatus === 'settlement' || isCaptureAccept

    if (isPaid) {
      const pkg = String(trx.package_type || '').trim()
      const tier = packageToTier(pkg)
      const days = packageToDurationDays(pkg)

      if (!days || tier === 'free') {
        console.warn('Midtrans webhook: package_type tidak dikenali:', pkg)
        return res.status(200).json({ success: true })
      }

      const newExpiresAt = addDaysISO(days)

      // Ambil parent saat ini (untuk trial_used)
      const { data: parentRow, error: parentError } = await supabase
        .from('parent_profile')
        .select('id, trial_used')
        .eq('id', trx.parent_id)
        .maybeSingle()

      if (parentError) {
        throw new Error(`Gagal mengambil parent_profile: ${parentError.message}`)
      }

      const shouldSetTrialUsed = parentRow ? !Boolean(parentRow.trial_used) : true

      const { error: updParentError } = await supabase
        .from('parent_profile')
        .update({
          subscription_tier: tier,
          subscription_expires_at: newExpiresAt,
          auto_renewal: true,
          trial_ends_at: null,
          trial_used: shouldSetTrialUsed ? true : Boolean(parentRow?.trial_used),
          updated_at: now,
        })
        .eq('id', trx.parent_id)

      if (updParentError) {
        throw new Error(`Gagal update subscription parent: ${updParentError.message}`)
      }
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    // Midtrans akan retry jika bukan 200; untuk mencegah retry loop, tetap 200 tapi laporkan di payload
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server'
    console.error('Midtrans webhook error:', message)
    return res.status(200).json({ success: false, message })
  }
}