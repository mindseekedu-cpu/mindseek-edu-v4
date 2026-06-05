import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'
import supabase from '@/lib/supabaseClient'

// ─────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '7d'
const COOKIE_NAME = 'token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 hari dalam detik
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Rate limiting configuration
const MAX_LOGIN_ATTEMPTS = 5
const BLOCK_MINUTES = 15
// In-memory store for failed attempts (will reset on server restart)
// For production, consider using Redis or database
const failedAttempts = new Map() // key: email, value: { count, blockedUntil }

// ─────────────────────────────────────────────
// Helper: Validasi input login
// ─────────────────────────────────────────────
function validateInput({ email, password }) {
  const errors = []

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email wajib diisi.')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push('Format email tidak valid.')
  }

  if (!password || typeof password !== 'string' || !password) {
    errors.push('Password wajib diisi.')
  }

  return errors
}

// ─────────────────────────────────────────────
// Helper: Verifikasi reCAPTCHA v3 token
// ─────────────────────────────────────────────
async function verifyRecaptcha(token, action = 'login') {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  if (!secretKey) {
    console.warn('[recaptcha] RECAPTCHA_SECRET_KEY tidak diset, verifikasi dilewati.')
    return true // skip if not configured (dev mode)
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
// Helper: Rate limiting
// ─────────────────────────────────────────────
function getAttemptState(email) {
  const normalized = email.toLowerCase()
  const record = failedAttempts.get(normalized)
  if (!record) return { count: 0, blockedUntil: null }

  if (record.blockedUntil && record.blockedUntil <= Date.now()) {
    failedAttempts.delete(normalized)
    return { count: 0, blockedUntil: null }
  }
  return record
}

function recordFailedAttempt(email) {
  const normalized = email.toLowerCase()
  const current = getAttemptState(normalized)
  const nextCount = current.count + 1

  if (nextCount >= MAX_LOGIN_ATTEMPTS) {
    const blockedUntil = Date.now() + BLOCK_MINUTES * 60 * 1000
    failedAttempts.set(normalized, { count: nextCount, blockedUntil })
    return { blockedUntil, isBlocked: true }
  }

  failedAttempts.set(normalized, { count: nextCount, blockedUntil: null })
  return { blockedUntil: null, isBlocked: false }
}

function clearFailedAttempts(email) {
  failedAttempts.delete(email.toLowerCase())
}

function formatBlockMinutes(blockedUntil) {
  const diffMs = Math.max(0, blockedUntil - Date.now())
  return Math.ceil(diffMs / (60 * 1000))
}

// ─────────────────────────────────────────────
// Helper: Set httpOnly cookie
// ─────────────────────────────────────────────
function setTokenCookie(res, token) {
  const cookieOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  }
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, cookieOptions))
}

// ─────────────────────────────────────────────
// API Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' })
  }

  // 1. Pastikan JWT_SECRET tersedia
  if (!JWT_SECRET) {
    console.error('[login] JWT_SECRET tidak ditemukan di environment variables.')
    return res.status(500).json({ success: false, message: 'Konfigurasi server tidak lengkap.' })
  }

  const { email, password, recaptcha_token } = req.body

  // 2. Validasi input
  const validationErrors = validateInput({ email, password })
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, message: validationErrors[0] })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // 3. Verifikasi reCAPTCHA (jika diaktifkan)
  const isCaptchaValid = await verifyRecaptcha(recaptcha_token, 'login')
  if (!isCaptchaValid && process.env.RECAPTCHA_SECRET_KEY) {
    return res.status(400).json({ success: false, message: 'Verifikasi keamanan gagal. Silakan coba lagi.' })
  }

  // 4. Rate limiting check
  const attemptState = getAttemptState(normalizedEmail)
  if (attemptState.blockedUntil && attemptState.blockedUntil > Date.now()) {
    const remainingMinutes = formatBlockMinutes(attemptState.blockedUntil)
    return res.status(429).json({
      success: false,
      message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${remainingMinutes} menit.`
    })
  }

  try {
    // 5. Ambil parent dari Supabase (termasuk field yang diperlukan)
    const { data: parent, error: fetchError } = await supabase
      .from('parent_profile')
      .select('id, name, email, password_hash, is_email_verified, is_active, subscription_tier')
      .eq('email', normalizedEmail)
      .maybeSingle() // use maybeSingle to avoid PGRST116 error

    if (fetchError) {
      console.error('[login] Supabase fetch error:', fetchError)
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' })
    }

    // 6. Gunakan pesan error generik untuk mencegah user enumeration
    if (!parent) {
      recordFailedAttempt(normalizedEmail)
      return res.status(401).json({ success: false, message: 'Email atau password salah.' })
    }

    // 7. Cek apakah akun dibekukan admin
    if (parent.is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dibekukan. Hubungi support untuk bantuan.'
      })
    }

    // 8. Cek apakah email sudah diverifikasi
    if (!parent.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email belum diverifikasi. Silakan cek inbox atau folder spam Anda untuk link verifikasi.'
      })
    }

    // 9. Bandingkan password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, parent.password_hash)
    if (!isPasswordValid) {
      recordFailedAttempt(normalizedEmail)
      return res.status(401).json({ success: false, message: 'Email atau password salah.' })
    }

    // 10. Login berhasil → clear failed attempts
    clearFailedAttempts(normalizedEmail)

    // 11. Generate JWT token
    const tokenPayload = {
      id: parent.id,
      email: parent.email,
      subscription_tier: parent.subscription_tier,
      name: parent.name
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'mindseek-edu',
      audience: 'mindseek-edu-client'
    })

    // 12. Set httpOnly cookie
    setTokenCookie(res, token)

    // 13. Update last_login_at di Supabase (non-blocking)
    supabase
      .from('parent_profile')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', parent.id)
      .then(({ error }) => {
        if (error) console.error('[login] last_login_at update error:', error)
      })

    return res.status(200).json({
      success: true,
      message: `Selamat datang kembali, ${parent.name}!`,
      redirect: '/dashboard'
    })
  } catch (err) {
    console.error('[login] Unexpected error:', err)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba beberapa saat lagi.' })
  }
}
