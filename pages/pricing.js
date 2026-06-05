import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

function formatIDR(amount) {
  const n = Number(amount || 0)
  return n.toLocaleString('id-ID')
}

function calcDiscounted(base, pct) {
  const p = Number(pct || 0)
  const b = Number(base || 0)
  return Math.round(b * (1 - p / 100))
}

export default function PricingPage() {
  const router = useRouter()
  const BASE_MONTHLY = 169000

  const familyDiscounts = useMemo(
    () => [
      { child: 1, discountPct: 0 },
      { child: 2, discountPct: 25 },
      { child: 3, discountPct: 50 },
      { child: 4, discountPct: 50 },
      { child: 5, discountPct: 50 },
    ],
    []
  )

  const [packageInfo, setPackageInfo] = useState(null)
  const [packageInfoLoaded, setPackageInfoLoaded] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // Load package info (trial status)
  useEffect(() => {
    let mounted = true

    async function loadPackageInfo() {
      try {
        const res = await fetch('/api/parent/package-info', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })

        if (!res.ok) {
          if (mounted) {
            setPackageInfo(null)
            setPackageInfoLoaded(true)
          }
          return
        }

        const json = await res.json().catch(() => null)
        if (!mounted) return

        if (json?.success) {
          setPackageInfo(json.data || json)
        } else {
          setPackageInfo(null)
        }
        setPackageInfoLoaded(true)
      } catch (_err) {
        if (!mounted) return
        setPackageInfo(null)
        setPackageInfoLoaded(true)
      }
    }

    loadPackageInfo()

    return () => {
      mounted = false
    }
  }, [])

  const trialUsed = Boolean(packageInfo?.trial_used)
  const showTrialCTA = !packageInfoLoaded ? true : !trialUsed

  const smartParentYearly = BASE_MONTHLY * 11

  const familyMonthlyRows = useMemo(() => {
    return familyDiscounts.map((row) => {
      const perChild = calcDiscounted(BASE_MONTHLY, row.discountPct)
      return {
        ...row,
        perChild,
      }
    })
  }, [familyDiscounts])

  const familyYearlyRows = useMemo(() => {
    return familyMonthlyRows.map((row) => ({
      ...row,
      perChildYearly: row.perChild * 11,
    }))
  }, [familyMonthlyRows])

  // Handle payment / trial with Midtrans
  const handlePackageAction = async (packageType, isTrial = false) => {
    setPaymentError('')
    setPaymentLoading(true)

    // For trial, we only allow monthly packages
    if (isTrial && !packageType.includes('monthly')) {
      setPaymentError('Trial hanya tersedia untuk paket bulanan.')
      setPaymentLoading(false)
      return
    }

    // For Smart Family, we need to know number of students
    let studentsCount = 1
    if (packageType === 'monthly_smart_family' || packageType === 'yearly_smart_family') {
      // Fetch current students count from parent dashboard
      try {
        const dashboardRes = await fetch('/api/parent/dashboard', {
          credentials: 'include',
        })
        const dashboardJson = await dashboardRes.json()
        if (dashboardJson.success && Array.isArray(dashboardJson.students)) {
          studentsCount = Math.min(dashboardJson.students.length, 5) || 1
        }
      } catch (err) {
        console.error('Failed to fetch students count', err)
        studentsCount = 1
      }
    }

    try {
      const response = await fetch('/api/parent/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          package_type: packageType,
          students_count: studentsCount,
          is_trial: isTrial, // Add flag for trial
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memproses pembayaran.')
      }

      // Use Midtrans Snap
      if (typeof window !== 'undefined' && window.snap) {
        window.snap.pay(result.snap_token, {
          onSuccess: function (result) {
            console.log('Payment success:', result)
            // Redirect to dashboard after success
            router.push('/dashboard')
          },
          onPending: function (result) {
            console.log('Payment pending:', result)
            router.push('/dashboard')
          },
          onError: function (result) {
            console.error('Payment error:', result)
            setPaymentError('Pembayaran gagal. Silakan coba lagi.')
            setPaymentLoading(false)
          },
          onClose: function () {
            console.log('Customer closed popup')
            setPaymentLoading(false)
          },
        })
      } else {
        // Fallback: redirect to Snap URL
        if (result.snap_redirect_url) {
          window.location.href = result.snap_redirect_url
        } else {
          throw new Error('Midtrans Snap tidak tersedia.')
        }
      }
    } catch (err) {
      setPaymentError(err.message || 'Terjadi kesalahan.')
      setPaymentLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Paket & Harga – MindSeek Edu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-600">Paket & Harga</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Pilih paket yang sesuai keluarga Anda
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Semua paket berfokus pada pendampingan belajar yang konsisten: XP, streak, laporan parent, dan
                gamifikasi.
              </p>
              {!showTrialCTA ? (
                <p className="mt-2 text-xs text-slate-500">
                  Trial 7 hari sudah pernah digunakan untuk akun ini.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ke Dashboard Parent
              </Link>
            </div>
          </div>

          {/* Paket Starter - hanya informasi kecil (bukan kartu besar) */}
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Paket Starter (Gratis)</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Maks 1 siswa, 5 soal/hari, laporan 7 hari, tanpa Auto-Pilot. Cocok untuk mencoba.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Gunakan Gratis
              </Link>
            </div>
          </div>

          {/* Smart Parent & Smart Family cards */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Smart Parent */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-sky-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Smart Parent</h2>
                  <p className="mt-1 text-sm text-slate-600">Paket untuk 1 siswa.</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  Populer
                </span>
              </div>

              <div className="mt-5">
                <p className="text-3xl font-bold text-slate-900">Rp{formatIDR(BASE_MONTHLY)}</p>
                <p className="mt-1 text-sm text-slate-600">per bulan · 1 siswa</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tahunan (11 bulan): <span className="font-semibold">Rp{formatIDR(smartParentYearly)}</span>
                </p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <p>1 siswa aktif, laporan belajar & ringkasan perkembangan.</p>
                <p>Auto-Pilot & kontrol orang tua (sesuai fitur yang tersedia).</p>
                <p>Gamifikasi penuh: XP, streak, leaderboard mingguan.</p>
              </div>

              <div className="mt-6 space-y-3">
                {showTrialCTA ? (
                  <button
                    onClick={() => handlePackageAction('monthly_smart_parent', true)}
                    disabled={paymentLoading}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paymentLoading ? 'Memproses...' : 'Coba 7 Hari Gratis (Bulanan)'}
                  </button>
                ) : (
                  <div className="w-full rounded-xl bg-slate-100 px-5 py-3 text-center text-sm font-semibold text-slate-600">
                    Trial tidak tersedia
                  </div>
                )}

                <button
                  onClick={() => handlePackageAction('yearly_smart_parent', false)}
                  disabled={paymentLoading}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentLoading ? 'Memproses...' : 'Beli Sekarang (Tahunan)'}
                </button>
              </div>
            </div>

            {/* Smart Family */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Smart Family</h2>
                  <p className="mt-1 text-sm text-slate-600">Diskon bertingkat, hingga 5 siswa.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Hemat
                </span>
              </div>

              <div className="mt-5">
                <p className="text-3xl font-bold text-slate-900">Mulai Rp{formatIDR(BASE_MONTHLY)}</p>
                <p className="mt-1 text-sm text-slate-600">per anak per bulan (sesuai diskon)</p>
                <p className="mt-1 text-xs text-slate-500">Tahunan = 11 bulan per anak.</p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <p>Ideal untuk keluarga dengan lebih dari 1 anak.</p>
                <p>Setiap anak punya progress, XP, streak, dan chat session masing-masing.</p>
                <p>Diskon otomatis per anak (maks 5 siswa).</p>
              </div>

              <div className="mt-6 space-y-3">
                {showTrialCTA ? (
                  <button
                    onClick={() => handlePackageAction('monthly_smart_family', true)}
                    disabled={paymentLoading}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paymentLoading ? 'Memproses...' : 'Coba 7 Hari Gratis (Bulanan)'}
                  </button>
                ) : (
                  <div className="w-full rounded-xl bg-slate-100 px-5 py-3 text-center text-sm font-semibold text-slate-600">
                    Trial tidak tersedia
                  </div>
                )}

                <button
                  onClick={() => handlePackageAction('yearly_smart_family', false)}
                  disabled={paymentLoading}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentLoading ? 'Memproses...' : 'Beli Sekarang (Tahunan)'}
                </button>
              </div>
            </div>
          </div>

          {paymentError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {paymentError}
            </div>
          )}

          {/* Tabel diskon Smart Family */}
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Smart Family — Tabel Diskon Bulanan</h3>
              <p className="mt-2 text-sm text-slate-600">
                Harga dasar per anak: Rp{formatIDR(BASE_MONTHLY)}/bulan. Diskon diterapkan per urutan anak.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
                  <div>Anak ke-</div>
                  <div>Diskon</div>
                  <div className="text-right">Harga/anak/bulan</div>
                </div>
                {familyMonthlyRows.map((row) => (
                  <div
                    key={row.child}
                    className="grid grid-cols-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="font-semibold text-slate-900">{row.child}</div>
                    <div>{row.discountPct}%</div>
                    <div className="text-right font-semibold text-slate-900">Rp{formatIDR(row.perChild)}</div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Catatan: Total tagihan Smart Family = penjumlahan harga per anak sesuai urutan anak yang didaftarkan.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Smart Family — Estimasi Tahunan (11 bulan)</h3>
              <p className="mt-2 text-sm text-slate-600">
                Paket tahunan dihitung 11 bulan per anak. Berikut harga per anak untuk 1 tahun.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
                  <div>Anak ke-</div>
                  <div>Diskon</div>
                  <div className="text-right">Harga/anak/tahun</div>
                </div>
                {familyYearlyRows.map((row) => (
                  <div
                    key={row.child}
                    className="grid grid-cols-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="font-semibold text-slate-900">{row.child}</div>
                    <div>{row.discountPct}%</div>
                    <div className="text-right font-semibold text-slate-900">Rp{formatIDR(row.perChildYearly)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">Contoh cepat</p>
                <p className="mt-1 text-sm text-slate-600">
                  Jika mendaftarkan 2 anak: total bulanan = anak-1 + anak-2, total tahunan = (anak-1×11) +
                  (anak-2×11).
                </p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-900">FAQ singkat</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">Bagaimana trial 7 hari bekerja?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Trial tersedia untuk paket bulanan, maksimal sekali per akun parent. Anda akan diminta memasukkan
                  metode pembayaran (kartu kredit/debit) untuk verifikasi. Setelah trial berakhir, langganan akan
                  otomatis diperpanjang kecuali dibatalkan.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">Apakah paket tahunan lebih hemat?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Ya, paket tahunan dihitung 11 bulan (hemat 1 bulan) dibanding bayar bulanan selama 12 bulan.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">Bisa tambah siswa setelah beli?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Bisa. Untuk Smart Family, diskon mengikuti urutan anak yang aktif sampai maksimal 5 siswa.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">Dari mana tombol trial muncul/hilang?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Jika akun parent terdeteksi sudah pernah trial, tombol trial akan disembunyikan.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:flex-row sm:text-left">
            <div>
              <p className="text-sm font-semibold text-slate-900">Siap mulai?</p>
              <p className="mt-1 text-sm text-slate-600">
                Anda bisa akses halaman ini dari landing page dan dashboard parent.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ke Dashboard
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Kembali ke Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
