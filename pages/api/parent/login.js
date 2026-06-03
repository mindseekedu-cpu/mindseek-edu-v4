import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'
import supabase from '@/lib/supabaseClient';

// ─────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '7d'
const COOKIE_NAME = 'token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 hari dalam detik
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

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

  const { email, password } = req.body

  // 2. Validasi input
  const validationErrors = validateInput({ email, password })
  if (validationErrors.length > 0) {
    return res.status(400).json({ success: false, message: validationErrors[0] })
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    // 3. Ambil parent dari Supabase berdasarkan email
    const { data: parent, error: fetchError } = await supabase
      .from('parent_profile')
      .select('id, name, email, password_hash, is_email_verified, subscription_tier')
      .eq('email', normalizedEmail)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[login] Supabase fetch error:', fetchError)
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Silakan coba lagi.' })
    }

    // 4. Gunakan pesan error generik untuk mencegah user enumeration
    if (!parent) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' })
    }

    // 5. Cek apakah email sudah diverifikasi
    if (!parent.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email belum diverifikasi. Silakan cek inbox atau folder spam Anda untuk link verifikasi.'
      })
    }

    // 6. Bandingkan password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, parent.password_hash)
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' })
    }

    // 7. Generate JWT token (7 hari)
    const tokenPayload = {
      id: parent.id,
      email: parent.email,
      subscription_tier: parent.subscription_tier
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'mindseek-edu',
      audience: 'mindseek-edu-client'
    })

    // 8. Set httpOnly cookie
    setTokenCookie(res, token)

    // 9. Update last_login_at di Supabase (non-blocking)
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
