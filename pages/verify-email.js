import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import supabase from '../lib/supabaseClient'

// ─────────────────────────────────────────────
// Status constants
// ─────────────────────────────────────────────
const STATUS = {
  LOADING: 'loading',
  SUCCESS: 'success',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  ERROR: 'error'
}

// ─────────────────────────────────────────────
// UI Sub-components
// ─────────────────────────────────────────────
function IconSuccess() {
  return (
    <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
      <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  )
}

function IconError() {
  return (
    <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
      <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
}

function IconLoading() {
  return (
    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4">
      <svg className="animate-spin w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function VerifyEmailPage() {
  const router = useRouter()
  const { token } = router.query
  const [status, setStatus] = useState(STATUS.LOADING)
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // Tunggu hingga router.query siap
    if (!router.isReady) return
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      setStatus(STATUS.INVALID)
      setMessage('Token verifikasi tidak ditemukan atau tidak valid.')
      return
    }
    verifyToken(token.trim())
  }, [router.isReady, token])

  // Countdown redirect ke /login setelah sukses
  useEffect(() => {
    if (status !== STATUS.SUCCESS) return
    if (countdown <= 0) {
      router.push('/login')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [status, countdown, router])

  async function verifyToken(rawToken) {
    try {
      setStatus(STATUS.LOADING)

      // 1. Cari token di tabel email_verifications
      const { data: record, error: fetchError } = await supabase
        .from('email_verifications')
        .select('id, parent_id, expires_at')
        .eq('token', rawToken)
        .single()

      if (fetchError || !record) {
        setStatus(STATUS.INVALID)
        setMessage('Token verifikasi tidak valid atau sudah digunakan.')
        return
      }

      // 2. Cek apakah token sudah kadaluarsa
      const now = new Date()
      const expiresAt = new Date(record.expires_at)
      if (now > expiresAt) {
        // Hapus token kadaluarsa
        await supabase
          .from('email_verifications')
          .delete()
          .eq('id', record.id)

        setStatus(STATUS.EXPIRED)
        setMessage('Link verifikasi sudah kadaluarsa. Silakan daftar ulang atau hubungi support.')
        return
      }

      // 3. Update is_email_verified = true pada parent_profile
      const { error: updateError } = await supabase
        .from('parent_profile')
        .update({
          is_email_verified: true,
          email_verified_at: new Date().toISOString()
        })
        .eq('id', record.parent_id)

      if (updateError) {
        console.error('[verify-email] Update error:', updateError)
        setStatus(STATUS.ERROR)
        setMessage('Terjadi kesalahan saat memverifikasi akun. Silakan coba lagi.')
        return
      }

      // 4. Hapus token dari tabel email_verifications
      const { error: deleteError } = await supabase
        .from('email_verifications')
        .delete()
        .eq('id', record.id)

      if (deleteError) {
        console.error('[verify-email] Delete token error:', deleteError)
        // Tidak fatal — verifikasi tetap berhasil
      }

      setStatus(STATUS.SUCCESS)
      setMessage('Email Anda berhasil diverifikasi! Anda akan diarahkan ke halaman login.')
    } catch (err) {
      console.error('[verify-email] Unexpected error:', err)
      setStatus(STATUS.ERROR)
      setMessage('Terjadi kesalahan tidak terduga. Silakan coba beberapa saat lagi.')
    }
  }

  // ─────────────────────────────────────────────
  // Render konten berdasarkan status
  // ─────────────────────────────────────────────
  function renderContent() {
    switch (status) {
      case STATUS.LOADING:
        return (
          <>
            <IconLoading />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Memverifikasi Email...</h1>
            <p className="text-sm text-gray-500">Mohon tunggu sebentar.</p>
          </>
        )

      case STATUS.SUCCESS:
        return (
          <>
            <IconSuccess />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Verifikasi Berhasil!</h1>
            <p className="text-sm text-gray-600 mb-4">{message}</p>
            <p className="text-xs text-gray-400 mb-6">
              Mengarahkan ke halaman login dalam <span className="font-bold text-blue-600">{countdown}</span> detik...
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Login Sekarang
            </Link>
          </>
        )

      case STATUS.EXPIRED:
        return (
          <>
            <IconError />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Link Kadaluarsa</h1>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <Link
              href="/register"
              className="inline-block px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Daftar Ulang
            </Link>
          </>
        )

      case STATUS.INVALID:
        return (
          <>
            <IconError />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Token Tidak Valid</h1>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <Link
              href="/register"
              className="inline-block px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Kembali ke Daftar
            </Link>
          </>
        )

      case STATUS.ERROR:
      default:
        return (
          <>
            <IconError />
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Terjadi Kesalahan</h1>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <Link
              href="/"
              className="inline-block px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Kembali ke Beranda
            </Link>
          </>
        )
    }
  }

  return (
    <>
      <Head>
        <title>Verifikasi Email – MindSeek Edu</title>
        <meta name="description" content="Verifikasi alamat email akun MindSeek Edu Anda." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-10 text-center">
          <Link href="/" className="text-xl font-bold text-blue-600 tracking-tight block mb-8">
            MindSeek Edu
          </Link>
          {renderContent()}
        </div>
      </main>
    </>
  )
}
