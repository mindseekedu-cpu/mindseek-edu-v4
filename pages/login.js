import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'

const initialForm = {
  email: '',
  password: ''
}

const initialErrors = {
  email: '',
  password: '',
  form: ''
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateForm(values) {
  const errors = { ...initialErrors }
  let isValid = true

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
  }

  return { errors, isValid }
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState(initialErrors)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '', form: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const { errors: validationErrors, isValid } = validateForm(form)
    if (!isValid) {
      setErrors(validationErrors)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/parent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          form: data.message || 'Email atau password salah. Silakan coba lagi.'
        }))
        return
      }

      if (data.redirect) {
        router.push(data.redirect)
      } else {
        router.push('/dashboard')
      }
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
        <title>Login – MindSeek Edu</title>
        <meta name="description" content="Login ke akun MindSeek Edu Anda." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">

          {/* Header */}
          <div className="mb-6 text-center">
            <Link href="/" className="text-2xl font-bold text-blue-600 tracking-tight">
              MindSeek Edu
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-gray-800">Masuk ke Akun Anda</h1>
            <p className="mt-1 text-sm text-gray-500">
              Selamat datang kembali! Silakan login untuk melanjutkan.
            </p>
          </div>

          {/* Form Error */}
          {errors.form && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Lupa Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Masukkan password Anda"
                  className={`input-base pr-10 ${errors.password ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? 'Memproses...' : 'Login'}
            </button>

          </form>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Belum punya akun?{' '}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">
              Daftar di sini
            </Link>
          </p>

        </div>
      </main>
    </>
  )
}
