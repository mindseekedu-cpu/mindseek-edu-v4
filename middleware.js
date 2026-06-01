import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// ─────────────────────────────────────────────
// Konfigurasi route
// ─────────────────────────────────────────────

// Route yang memerlukan autentikasi (harus login)
const PROTECTED_PREFIXES = ['/dashboard', '/parent', '/student']

// Route yang tidak boleh diakses jika sudah login
const AUTH_ONLY_PATHS = ['/login', '/register']

// ─────────────────────────────────────────────
// Helper: Cek apakah path cocok dengan prefix
// ─────────────────────────────────────────────
function matchesPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

// ─────────────────────────────────────────────
// Helper: Verifikasi JWT menggunakan jose
// (jose mendukung Edge Runtime; jsonwebtoken tidak)
// ─────────────────────────────────────────────
async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'mindseek-edu',
      audience: 'mindseek-edu-client'
    })
    return { valid: true, payload }
  } catch (err) {
    return { valid: false, payload: null }
  }
}

// ─────────────────────────────────────────────
// Middleware Handler
// ─────────────────────────────────────────────
export async function middleware(request) {
  const { pathname } = request.nextUrl
  const tokenCookie = request.cookies.get('token')
  const token = tokenCookie?.value || null

  // ── 1. Cek route yang dilindungi ──────────────
  if (matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    if (!token) {
      // Tidak ada token → redirect ke /login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { valid } = await verifyToken(token)
    if (!valid) {
      // Token tidak valid atau expired → hapus cookie & redirect ke /login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('token')
      return response
    }

    // Token valid → lanjutkan request
    return NextResponse.next()
  }

  // ── 2. Cek route auth-only (/login, /register) ─
  if (matchesPrefix(pathname, AUTH_ONLY_PATHS)) {
    if (token) {
      const { valid } = await verifyToken(token)
      if (valid) {
        // Sudah login → redirect ke /dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // Token tidak valid → biarkan akses halaman login/register
      // tapi hapus cookie yang rusak
      const response = NextResponse.next()
      response.cookies.delete('token')
      return response
    }
  }

  // ── 3. Semua route lain → lanjutkan ───────────
  return NextResponse.next()
}

// ─────────────────────────────────────────────
// Konfigurasi matcher:
// Jalankan middleware hanya pada route yang relevan.
// Exclude: _next/static, _next/image, favicon.ico, api routes.
// ─────────────────────────────────────────────
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/parent/:path*',
    '/student/:path*',
    '/login',
    '/register'
  ]
}
