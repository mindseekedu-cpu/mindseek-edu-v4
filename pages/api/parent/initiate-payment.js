import { getAuthenticatedParent } from '@/lib/auth'
import supabase from '@/lib/supabaseClient'
import midtransClient from 'midtrans-client'

const BASE_MONTHLY = 169000
const ALLOWED_PACKAGE_TYPES = [
  'monthly_smart_parent',
  'yearly_smart_parent',
  'monthly_smart_family',
  'yearly_smart_family',
]

function clampStudentsCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(5, Math.floor(n)))
}

function sumSmartFamilyMonthly(studentsCount) {
  const discounts = [0, 25, 50, 50, 50]
  let total = 0
  for (let i = 0; i < studentsCount; i += 1) {
    const pct = discounts[i] ?? 0
    total += Math.round(BASE_MONTHLY * (1 - pct / 100))
  }
  return total
}

function computeGrossAmount(packageType, studentsCount) {
  if (packageType === 'monthly_smart_parent') return BASE_MONTHLY
  if (packageType === 'yearly_smart_parent') return BASE_MONTHLY * 11

  if (packageType === 'monthly_smart_family') return sumSmartFamilyMonthly(studentsCount)
  if (packageType === 'yearly_smart_family') return sumSmartFamilyMonthly(studentsCount) * 11

  return null
}

function packageLabel(packageType) {
  if (packageType === 'monthly_smart_parent') return 'Smart Parent (Bulanan)'
  if (packageType === 'yearly_smart_parent') return 'Smart Parent (Tahunan)'
  if (packageType === 'monthly_smart_family') return 'Smart Family (Bulanan)'
  if (packageType === 'yearly_smart_family') return 'Smart Family (Tahunan)'
  return 'Paket'
}

function makeOrderId(parentId, packageType) {
  const pid = String(parentId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'PARENT'
  const p = String(packageType || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18) || 'PKG'
  return `ORD-${pid}-${p}-${Date.now()}`
}

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

    const packageType = String(req.body?.package_type || '').trim()
    const studentsCount = clampStudentsCount(req.body?.students_count)

    if (!ALLOWED_PACKAGE_TYPES.includes(packageType)) {
      return res.status(400).json({
        success: false,
        message:
          'package_type tidak valid. Gunakan: monthly_smart_parent, yearly_smart_parent, monthly_smart_family, yearly_smart_family',
      })
    }

    const grossAmount = computeGrossAmount(packageType, studentsCount)

    if (!grossAmount || grossAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Harga paket tidak valid' })
    }

    const { data: parentRow, error: parentError } = await supabase
      .from('parent_profile')
      .select('id, name, email, phone, trial_used')
      .eq('id', parentId)
      .maybeSingle()

    if (parentError) {
      throw new Error(`Gagal mengambil data parent: ${parentError.message}`)
    }

    if (!parentRow) {
      return res.status(404).json({ success: false, message: 'Parent tidak ditemukan' })
    }

    const trialEligible =
      !Boolean(parentRow.trial_used) &&
      (packageType === 'monthly_smart_parent' || packageType === 'monthly_smart_family')

    const orderId = makeOrderId(parentId, packageType)

    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const clientKey = process.env.MIDTRANS_CLIENT_KEY

    if (!serverKey || !clientKey) {
      return res.status(500).json({
        success: false,
        message: 'MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY belum dikonfigurasi',
      })
    }

    const snap = new midtransClient.Snap({
      isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true',
      serverKey,
      clientKey,
    })

    const itemName = packageLabel(packageType)
    const itemDetails = [
      {
        id: packageType,
        price: grossAmount,
        quantity: 1,
        name: itemName,
      },
    ]

    const transactionPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: parentRow.name || 'Parent',
        email: parentRow.email || undefined,
        phone: parentRow.phone || undefined,
      },
      custom_field1: trialEligible ? 'trial_eligible' : 'paid',
      custom_field2: String(studentsCount),
      custom_field3: packageType,
    }

    const midtransResult = await snap.createTransaction(transactionPayload)

    const snapToken = midtransResult?.token
    const redirectUrl = midtransResult?.redirect_url

    if (!snapToken || !redirectUrl) {
      throw new Error('Gagal membuat snap token Midtrans')
    }

    const now = new Date().toISOString()

    const { error: insertError } = await supabase.from('transactions').insert({
      parent_id: parentId,
      order_id: orderId,
      snap_token: snapToken,
      transaction_status: 'pending',
      gross_amount: grossAmount,
      payment_type: null,
      package_type: packageType,
      created_at: now,
      updated_at: now,
    })

    if (insertError) {
      throw new Error(`Gagal menyimpan transaksi: ${insertError.message}`)
    }

    return res.status(200).json({
      success: true,
      snap_token: snapToken,
      snap_redirect_url: redirectUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server'
    return res.status(500).json({ success: false, message })
  }
}