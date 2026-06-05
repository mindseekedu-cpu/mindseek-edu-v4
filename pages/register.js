import Head from 'next/head'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { useRouter } from 'next/router'

const initialForm = {
  parentName: '',
  email: '',
  password: '',
  contactNumber: '',
  referralCode: ''
}

const initialErrors = {
  parentName: '',
  email: '',
  password: '',
  contactNumber: '',
  form: ''
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePhone(phone) {
  // Minimal 10 digit, maksimal 13 digit, hanya angka
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 13
}

function validateForm(values) {
  const errors = { ...initialErrors }
  let isValid = true

  if (!values.parentName.trim()) {
    errors.parentName = 'Nama orang tua wajib diisi.'
    isValid = false
  } else if (values.parentName.trim().length < 2) {
    errors.parentName = 'Nama minimal 2 karakter.'
    isValid = false
  }

  if (!values.email.trim()) {
    errors.email = 'Email wajib diisi.'
    isValid = false
  } else if (!validateEmail(values.email)) {
    errors.email = 'Format email tidak valid.'
    isValid = false
  }

  if (!values.password) {
    errors.password = 'Password wajib diisi.'
    isValid = false
  } else if (values.password.length < 8) {
    errors.password = 'Password minimal 8 karakter.'
    isValid = false
  }

  if (!values.contactNumber.trim()) {
    errors.contactNumber = 'Nomor kontak wajib diisi.'
    isValid = false
  } else if (!validatePhone(values.contactNumber)) {
    errors.contactNumber = 'Nomor kontak harus 10-13 digit angka.'
    isValid = false
  }

  return { errors, isValid }
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState(initialErrors)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [captchaToken, setCaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)

  // Load reCAPTCHA script jika diperlukan (opsional, bisa pakai package)
  // Untuk keperluan MVP, kita asumsikan captcha token didapat dari external script

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '', form: '' }))
  }

  // Simulasi get reCAPTCHA token (implementasi nyata perlu load script)
  const getRecaptchaToken = async () => {
    // Jika tidak ada konfigurasi reCAPTCHA, lewati
    if (typeof window === 'undefined') return null
    if (window.grecaptcha && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      try {
        return await window.grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'register' })
      } catch (err) {
        console.error('reCAPTCHA error:', err)
        return null
      }
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccessMessage('')

    const { errors: validationErrors, isValid } = validateForm(form)
    if (!isValid) {
      setErrors(validationErrors)
      return
    }

    setIsLoading(true)
    // Dapatkan token reCAPTCHA (opsional, jika gagal tetap lanjut tapi log)
    let captcha = null
    try {
      captcha = await getRecaptchaToken()
    } catch (err) {
      console.warn('reCAPTCHA unavailable, proceeding without')
    }

    try {
      const res = await fetch('/api/parent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.parentName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.contactNumber.trim(),
          referral_code: form.referralCode.trim() || null,
          recaptcha_token: captcha
        })
      })

      const data = await res.json()

      if (!res.ok) {
        // Tangani error spesifik dari API
        let errorMsg = data.message || 'Terjadi kesalahan. Silakan coba lagi.'
        if (errorMsg.toLowerCase().includes('email already registered') || errorMsg.toLowerCase().includes('email sudah terdaftar')) {
          setErrors((prev) => ({ ...prev, email: 'Email sudah terdaftar. Silakan login.' }))
        } else if (errorMsg.toLowerCase().includes('phone already registered') || errorMsg.toLowerCase().includes('nomor sudah terdaftar')) {
          setErrors((prev) => ({ ...prev, contactNumber: 'Nomor kontak sudah terdaftar.' }))
        } else {
          setErrors((prev) => ({ ...prev, form: errorMsg }))
        }
        return
      }

      setSuccessMessage(data.message || 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi.')
      setForm(initialForm)
      // Reset captcha jika perlu
      if (window.grecaptcha) window.grecaptcha.reset()
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Daftar – MindSeek Edu</title>
        <meta name="description" content="Daftarkan akun orang tua di MindSeek Edu." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Load reCAPTCHA script jika ada site key */}
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <script src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`} async defer />
        )}
      </Head>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">

          {/* Header */}
          <div className="mb-6 text-center">
            <Link href="/" className="text-2xl font-bold text-blue-600 tracking-tight">
              MindSeek Edu
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-gray-800">Buat Akun Orang Tua</h1>
            <p className="mt-1 text-sm text-gray-500">Mulai perjalanan belajar anak Anda hari ini.</p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Form Error */}
          {errors.form && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Parent Name */}
            <div>
              <label htmlFor="parentName" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Orang Tua <span className="text-red-500">*</span>
              </label>
              <input
                id="parentName"
                name="parentName"
                type="text"
                autoComplete="name"
                value={form.parentName}
                onChange={handleChange}
                placeholder="Contoh: Budi Santoso"
                className={`input-base ${errors.parentName ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
              />
              {errors.parentName && (
                <p className="mt-1 text-xs text-red-500">{errors.parentName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="contoh@email.com"
                className={`input-base ${errors.email ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimal 8 karakter (huruf + angka)"
                className={`input-base ${errors.password ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Nomor Kontak <span className="text-red-500">*</span>
              </label>
              <input
                id="contactNumber"
                name="contactNumber"
                type="tel"
                autoComplete="tel"
                value={form.contactNumber}
                onChange={handleChange}
                placeholder="Contoh: 08123456789 (10-13 digit)"
                className={`input-base ${errors.contactNumber ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
              />
              {errors.contactNumber && (
                <p className="mt-1 text-xs text-red-500">{errors.contactNumber}</p>
              )}
            </div>

            {/* Referral Code (Optional) */}
            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">
                Kode Referral <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <input
                id="referralCode"
                name="referralCode"
                type="text"
                value={form.referralCode}
                onChange={handleChange}
                placeholder="Masukkan kode referral jika ada"
                className="input-base"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? 'Memproses...' : 'Daftar'}
            </button>

          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Login di sini
            </Link>
          </p>

        </div>
      </main>
    </>
  )
}
