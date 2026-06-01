import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
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

function validateForm(values) {
  const errors = { ...initialErrors }
  let isValid = true

  if (!values.parentName.trim()) {
    errors.parentName = 'Nama orang tua wajib diisi.'
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
  }

  return { errors, isValid }
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState(initialErrors)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '', form: '' }))
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
    try {
      const res = await fetch('/api/parent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.parentName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.contactNumber.trim(),
          referral_code: form.referralCode.trim() || null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          form: data.message || 'Terjadi kesalahan. Silakan coba lagi.'
        }))
        return
      }

      setSuccessMessage(data.message || 'Registrasi berhasil. Silakan cek email Anda.')
      setForm(initialForm)
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        form: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'
      }))
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
                placeholder="Minimal 8 karakter"
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
                placeholder="Contoh: 08123456789"
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
