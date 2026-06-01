import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import supabase from '../../../lib/supabaseClient'

// ─────────────────────────────────────────────
// Helper: Validasi input
// ─────────────────────────────────────────────
function validateInput({ name, email, password, phone }) {
  const errors = []

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Nama wajib diisi dan minimal 2 karakter.')
  }

  if (!email || typeof email !== 'string') {
    errors.push('Email wajib diisi.')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push('Format email tidak valid.')
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password wajib diisi.')
  } else if (password.length < 8) {
    errors.push('Password minimal 8 karakter.')
  }

  if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
    errors.push('Nomor kontak wajib diisi dan minimal 8 digit.')
  }

  return errors
}

// ─────────────────────────────────────────────
// Helper: Generate referral code unik (8 karakter alfanumerik uppercase)
// ─────────────────────────────────────────────
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  const bytes = crypto.randomBytes(8)
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

// ─────────────────────────────────────────────
// Helper: Pastikan referral code benar-benar unik di DB
// ─────────────────────────────────────────────
async function generateUniqueReferralCode() {
  let code = generateReferralCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase
      .from('parent_profile')
      .select('id')
      .eq('referral_code', code)
      .single()
    if (!data) return code
    code = generateReferralCode()
    attempts++
  }
  throw new Error('Gagal menghasilkan referral code unik setelah 10 percobaan.')
}

// ─────────────────────────────────────────────
// Helper: Buat Nodemailer transporter
// Gunakan SendGrid jika SENDGRID_API_KEY ada,
// fallback ke Ethereal untuk development.
// ─────────────────────────────────────────────
async function createTransporter() {
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    })
  }

  // Fallback: Ethereal (development only)
  const testAccount = await nodemailer.createTestAccount()
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  })
  console.log('[DEV] Ethereal email account:', testAccount.user)
  return { transporter, previewUrl: true }
}

// ─────────────────────────────────────────────
// Helper: Kirim email verifikasi
// ─────────────────────────────────────────────
async function sendVerificationEmail({ toEmail, toName, verificationToken }) {
  const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`

  const result = await createTransporter()
  const transporter = result.transporter || result

  const fromAddress = process.env.SENDGRID_API_KEY
    ? `"MindSeek Edu" <no-reply@mindseekedu.com>`
    : `"MindSeek Edu" <no-reply@ethereal.email>`

  const info = await transporter.sendMail({
    from: fromAddress,
    to: `"${toName}" <${toEmail}>`,
    subject: 'Verifikasi Email Akun MindSeek Edu Anda',
    text: `Halo ${toName},\n\nTerima kasih telah mendaftar di MindSeek Edu.\n\nSilakan verifikasi email Anda dengan mengklik link berikut:\n${verificationLink}\n\nLink ini akan kadaluarsa dalam 24 jam.\n\nJika Anda tidak mendaftar, abaikan email ini.\n\nSalam,\nTim MindSeek Edu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2563eb; margin-bottom: 8px;">MindSeek Edu</h2>
        <p style="color: #374151;">Halo <strong>${toName}</strong>,</p>
        <p style="color: #374151;">Terima kasih telah mendaftar di <strong>MindSeek Edu</strong>. Silakan verifikasi alamat email Anda dengan mengklik tombol di bawah ini.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationLink}"
             style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
            Verifikasi Email Saya
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">Atau salin link berikut ke browser Anda:</p>
        <p style="color: #2563eb; font-size: 13px; word-break: break-all;">${verificationLink}</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #9ca3af; font-size: 12px;">Link ini akan kadaluarsa dalam <strong>24 jam</strong>. Jika Anda tidak mendaftar, abaikan email ini.</p>
        <p style="color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} MindSeek Edu. All rights reserved.</p>
      </div>
    `
  })

  // Log preview URL jika menggunakan Ethereal
  if (result.previewUrl) {
    console.log('[DEV] Preview email URL:', nodemailer.getTestMessageUrl(info))
  }

  return info
}

// ─────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' })
  }

  const { name, email, password, phone, referral_code } = req.body

  // 1. Validasi input
  const validationErrors = validateInput({ name, email, password, phone })
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, message: validationErrors[0] })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()

  try {
    // 2. Cek apakah email sudah terdaftar
    const { data: existingParent, error: checkError } = await supabase
      .from('parent_profile')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = row not found (bukan error sesungguhnya)
      console.error('[register] Supabase check error:', checkError)
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memeriksa email.' })
    }

    if (existingParent) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar. Silakan login atau gunakan email lain.' })
    }

    // 3. Validasi referral code yang dimasukkan (jika ada)
    let referredById = null
    if (referral_code && typeof referral_code === 'string' && referral_code.trim().length > 0) {
      const { data: referrer } = await supabase
        .from('parent_profile')
        .select('id')
        .eq('referral_code', referral_code.trim().toUpperCase())
        .single()

      if (!referrer) {
        return res.status(400).json({ success: false, message: 'Kode referral tidak valid.' })
      }
      referredById = referrer.id
    }

    // 4. Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 5. Generate referral code unik untuk parent baru
    const newReferralCode = await generateUniqueReferralCode()

    // 6. Simpan parent ke Supabase
    const { data: newParent, error: insertError } = await supabase
      .from('parent_profile')
      .insert([
        {
          name: trimmedName,
          email: normalizedEmail,
          password_hash: passwordHash,
          phone: trimmedPhone,
          referral_code: newReferralCode,
          referred_by: referredById,
          is_email_verified: false,
          is_phone_verified: false,
          subscription_tier: 'starter',
          created_at: new Date().toISOString()
        }
      ])
      .select('id')
      .single()

    if (insertError) {
      console.error('[register] Supabase insert error:', insertError)
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat menyimpan data. Silakan coba lagi.' })
    }

    // 7. Generate token verifikasi email (64 karakter hex)
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 jam

    const { error: tokenInsertError } = await supabase
      .from('email_verifications')
      .insert([
        {
          parent_id: newParent.id,
          token: verificationToken,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        }
      ])

    if (tokenInsertError) {
      console.error('[register] Token insert error:', tokenInsertError)
      // Parent sudah tersimpan, tapi token gagal — tetap lanjut, log error
      return res.status(500).json({ success: false, message: 'Akun dibuat namun gagal mengirim email verifikasi. Hubungi support.' })
    }

    // 8. Kirim email verifikasi
    try {
      await sendVerificationEmail({
        toEmail: normalizedEmail,
        toName: trimmedName,
        verificationToken
      })
    } catch (emailError) {
      console.error('[register] Email send error:', emailError)
      // Jangan gagalkan registrasi hanya karena email error
      // Parent tetap bisa request ulang verifikasi nanti
    }

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi akun (cek folder spam jika tidak ada di inbox).'
    })
  } catch (err) {
    console.error('[register] Unexpected error:', err)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba beberapa saat lagi.' })
  }
}
