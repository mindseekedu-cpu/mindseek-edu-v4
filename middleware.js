import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// ─────────────────────────────────────────────
// Konfigurasi route
// ─────────────────────────────────────────────
// Route yang memerlukan autentikasi
const PROTECTED_PREFIXES = ['/dashboard', '/parent', '/student']

// Route auth parent: tidak boleh diakses jika parent sudah login
const AUTH_ONLY_PATHS = ['/login', '/register']

// Route auth siswa: tidak boleh diakses jika siswa sudah login
const STUDENT_AUTH_ONLY_PATHS = ['/student/login']

// ─────────────────────────────────────────────
// Helper: Cek apakah path cocok dengan prefix
// ─────────────────────────────────────────────
function matchesPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

function isStudentLoginPath(pathname) {
  return pathname === '/student/login'
}

function isStudentProtectedPath(pathname) {
  return matchesPrefix(pathname, ['/student']) && !isStudentLoginPath(pathname)
}

function isParentProtectedPath(pathname) {
  return matchesPrefix(pathname, ['/dashboard', '/parent'])
}

// ─────────────────────────────────────────────
// Helper: Verifikasi JWT menggunakan jose
// ─────────────────────────────────────────────
async function verifyToken(token) {
  try {
    const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || process.env.NEXTAUTH_SECRET

    if (!secret) {
      return { valid: false, payload: null }
    }

    const encodedSecret = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, encodedSecret)

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

  // ── 1. Route auth siswa (/student/login) ─────
  if (matchesPrefix(pathname, STUDENT_AUTH_ONLY_PATHS)) {
    const studentTokenCookie = request.cookies.get('student_token')
    const studentToken = studentTokenCookie?.value || null

    if (studentToken) {
      const { valid } = await verifyToken(studentToken)

      if (valid) {
        return NextResponse.redirect(new URL('/student/dashboard', request.url))
      }

      const response = NextResponse.next()
      response.cookies.delete('student_token')
      return response
    }

    return NextResponse.next()
  }

  // ── 2. Route protected siswa (/student/* selain /student/login)
  if (isStudentProtectedPath(pathname)) {
    const studentTokenCookie = request.cookies.get('student_token')
    const studentToken = studentTokenCookie?.value || null

    if (!studentToken) {
      const loginUrl = new URL('/student/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { valid } = await verifyToken(studentToken)

    if (!valid) {
      const loginUrl = new URL('/student/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('student_token')
      return response
    }

    return NextResponse.next()
  }

  // ── 3. Route protected parent (/dashboard, /parent)
  if (isParentProtectedPath(pathname)) {
    const tokenCookie = request.cookies.get('token')
    const token = tokenCookie?.value || null

    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { valid } = await verifyToken(token)

    if (!valid) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('token')
      return response
    }

    return NextResponse.next()
  }

  // ── 4. Route auth-only parent (/login, /register)
  if (matchesPrefix(pathname, AUTH_ONLY_PATHS)) {
    const tokenCookie = request.cookies.get('token')
    const token = tokenCookie?.value || null

    if (token) {
      const { valid } = await verifyToken(token)

      if (valid) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      const response = NextResponse.next()
      response.cookies.delete('token')
      return response
    }
  }

  // ── 5. Semua route lain → lanjutkan
  return NextResponse.next()
}

// ─────────────────────────────────────────────
// Konfigurasi matcher
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