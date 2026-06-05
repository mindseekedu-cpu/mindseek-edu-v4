import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'
import supabase from '@/lib/supabaseClient'

// ─────────────────────────────────────────────
// Konfigurasi SendGrid (hanya jika API key tersedia)
// ─────────────────────────────────────────────
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

// ─────────────────────────────────────────────
// Helper: Validasi input (dengan aturan PRD)
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

  if (!phone || typeof phone !== 'string') {
    errors.push('Nomor kontak wajib diisi.')
  } else {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10 || cleaned.length > 13) {
      errors.push('Nomor kontak harus 10-13 digit angka.')
    }
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
// Helper: Verifikasi reCAPTCHA v3 token
// ─────────────────────────────────────────────
async function verifyRecaptcha(token, action = 'register') {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  if (!secretKey) {
    console.warn('[recaptcha] RECAPTCHA_SECRET_KEY tidak diset, verifikasi dilewati.')
    return true // skip verification if not configured (dev mode)
  }

  if (!token) {
    console.warn('[recaptcha] Token tidak diberikan.')
    return false
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    })
    const data = await response.json()
    if (data.success && data.score >= 0.5 && data.action === action) {
      return true
    }
    console.warn('[recaptcha] Verifikasi gagal:', data)
    return false
  } catch (err) {
    console.error('[recaptcha] Error verifikasi:', err)
    return false
  }
}

// ─────────────────────────────────────────────
// Helper: Buat konten email
// ─────────────────────────────────────────────
function buildEmailContent({ toEmail, toName, verificationLink }) {
  const from = process.env.FROM_EMAIL || 'no-reply@mindseekedu.com'

  const subject = 'Verifikasi Email Akun MindSeek Edu Anda'

  const text =
    `Halo ${toName},\n\n` +
    `Terima kasih telah mendaftar di MindSeek Edu.\n\n` +
    `Silakan verifikasi email Anda dengan mengklik link berikut:\n${verificationLink}\n\n` +
    `Link ini akan kadaluarsa dalam 24 jam.\n\n` +
    `Jika Anda tidak mendaftar, abaikan email ini.\n\n` +
    `Salam,\nTim MindSeek Edu`

  const html = `
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

  return { from, subject, text, html }
}

// ─────────────────────────────────────────────
// Helper: Kirim email via SendGrid atau fallback Ethereal
// ─────────────────────────────────────────────
async function sendViaSendGrid({ toEmail, toName, verificationLink }) {
  const { from, subject, text, html } = buildEmailContent({ toEmail, toName, verificationLink })

  await sgMail.send({
    to: toEmail,
    from,
    subject,
    text,
    html,
  })
}

async function sendViaEthereal({ toEmail, toName, verificationLink }) {
  const { from, subject, text, html } = buildEmailContent({ toEmail, toName, verificationLink })

  const testAccount = await nodemailer.createTestAccount()
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  })

  console.log('[DEV] Ethereal email account:', testAccount.user)

  const info = await transporter.sendMail({
    from,
    to: `"${toName}" <${toEmail}>`,
    subject,
    text,
    html,
  })

  console.log('[DEV] Preview email URL:', nodemailer.getTestMessageUrl(info))
}

async function sendVerificationEmail({ toEmail, toName, verificationToken }) {
  const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`

  if (process.env.SENDGRID_API_KEY) {
    await sendViaSendGrid({ toEmail, toName, verificationLink })
  } else {
    await sendViaEthereal({ toEmail, toName, verificationLink })
  }
}

// ─────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' })
  }

  const { name, email, password, phone, referral_code, recaptcha_token } = req.body

  // 1. Validasi input
  const validationErrors = validateInput({ name, email, password, phone })
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, message: validationErrors[0] })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim()
  const cleanedPhone = phone.replace(/\D/g, '') // store as numeric only

  // 2. Verifikasi reCAPTCHA (jika diaktifkan)
  const isCaptchaValid = await verifyRecaptcha(recaptcha_token, 'register')
  if (!isCaptchaValid && process.env.RECAPTCHA_SECRET_KEY) {
    return res.status(400).json({ success: false, message: 'Verifikasi keamanan gagal. Silakan coba lagi.' })
  }

  try {
    // 3. Cek apakah email atau phone sudah terdaftar (UNIQUE constraint)
    const { data: existing, error: checkError } = await supabase
      .from('parent_profile')
      .select('id, email, phone')
      .or(`email.eq.${normalizedEmail},phone.eq.${cleanedPhone}`)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[register] Supabase check error:', checkError)
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memeriksa data.' })
    }

    if (existing) {
      if (existing.email === normalizedEmail) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar. Silakan login.' })
      }
      if (existing.phone === cleanedPhone) {
        return res.status(400).json({ success: false, message: 'Nomor kontak sudah terdaftar.' })
      }
    }

    // 4. Validasi referral code (jika ada) dan anti self-referral
    let referredById = null
    if (referral_code && typeof referral_code === 'string' && referral_code.trim().length > 0) {
      const upperCode = referral_code.trim().toUpperCase()
      const { data: referrer, error: refError } = await supabase
        .from('parent_profile')
        .select('id')
        .eq('referral_code', upperCode)
        .single()

      if (refError || !referrer) {
        return res.status(400).json({ success: false, message: 'Kode referral tidak valid.' })
      }
      referredById = referrer.id
      // Anti self-referral akan dicek setelah parent dibuat? Sebenarnya sebelum dibuat kita belum tahu ID sendiri.
      // Tapi kita bisa cek apakah referrer adalah dirinya sendiri? Belum ada ID. Jadi aman.
    }

    // 5. Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 6. Generate referral code unik untuk parent baru
    const newReferralCode = await generateUniqueReferralCode()

    // 7. Simpan parent ke Supabase
    const { data: newParent, error: insertError } = await supabase
      .from('parent_profile')
      .insert([
        {
          name: trimmedName,
          email: normalizedEmail,
          password_hash: passwordHash,
          phone: cleanedPhone,
          referral_code: newReferralCode,
          referred_by: referredById,
          is_email_verified: false,
          is_phone_verified: false,
          subscription_tier: 'starter',
          created_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single()

    if (insertError) {
      console.error('[register] Supabase insert error:', insertError)
      // Cek kemungkinan conflict (misal phone duplicate karena race condition)
      if (insertError.code === '23505') {
        const constraint = insertError.message || ''
        if (constraint.includes('email')) {
          return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' })
        }
        if (constraint.includes('phone')) {
          return res.status(400).json({ success: false, message: 'Nomor kontak sudah terdaftar.' })
        }
      }
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat menyimpan data. Silakan coba lagi.' })
    }

    // 8. Generate token verifikasi email (64 karakter hex)
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 jam

    const { error: tokenInsertError } = await supabase
      .from('email_verifications')
      .insert([
        {
          parent_id: newParent.id,
          token: verificationToken,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        },
      ])

    if (tokenInsertError) {
      console.error('[register] Token insert error:', tokenInsertError)
      // Parent sudah tersimpan, tapi token gagal — tetap lanjut, log error
      return res.status(500).json({ success: false, message: 'Akun dibuat namun gagal mengirim email verifikasi. Hubungi support.' })
    }

    // 9. Kirim email verifikasi
    try {
      await sendVerificationEmail({
        toEmail: normalizedEmail,
        toName: trimmedName,
        verificationToken,
      })
    } catch (emailError) {
      console.error('[register] Email send error:', emailError)
      // Jangan gagalkan registrasi hanya karena email error.
    }

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi akun (cek folder spam jika tidak ada di inbox).',
    })
  } catch (err) {
    console.error('[register] Unexpected error:', err)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba beberapa saat lagi.' })
  }
}
