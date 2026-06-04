import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

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

  useEffect(() => {
    let mounted = true

    async function loadPackageInfo() {
      try {
        const res = await fetch('/api/parent/package-info', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
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

  return (
    <>
      <Head>
        <title>Paket & Harga</title>
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

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Starter */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Starter</h2>
                  <p className="mt-1 text-sm text-slate-600">Untuk coba-coba, fitur terbatas.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Gratis
                </span>
              </div>

              <div className="mt-5">
                <p className="text-3xl font-bold text-slate-900">Rp0</p>
                <p className="mt-1 text-sm text-slate-600">Selamanya</p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <p>Termasuk akses dasar untuk mencoba alur belajar.</p>
                <p>Leaderboard dan gamifikasi dasar tetap tersedia.</p>
                <p>Laporan parent & pengaturan lanjutan terbatas.</p>
              </div>

              <div className="mt-6">
                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Mulai Gratis
                </Link>
              </div>
            </div>

            {/* Smart Parent */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-sky-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Smart Parent</h2>
                  <p className="mt-1 text-sm text-slate-600">Paket bulanan untuk 1 siswa.</p>
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
                  <Link
                    href="/dashboard"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Coba 7 Hari Gratis (Bulanan)
                  </Link>
                ) : (
                  <div className="w-full rounded-xl bg-slate-100 px-5 py-3 text-center text-sm font-semibold text-slate-600">
                    Trial tidak tersedia
                  </div>
                )}

                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Beli Sekarang (Tahunan)
                </Link>
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
                  <Link
                    href="/dashboard"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Coba 7 Hari Gratis (Bulanan)
                  </Link>
                ) : (
                  <div className="w-full rounded-xl bg-slate-100 px-5 py-3 text-center text-sm font-semibold text-slate-600">
                    Trial tidak tersedia
                  </div>
                )}

                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Beli Sekarang (Tahunan)
                </Link>
              </div>
            </div>
          </div>

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

          <div className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-bold text-slate-900">FAQ singkat</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-semibold text-slate-900">Bagaimana trial 7 hari bekerja?</p>
                <p className="mt-1 text-sm text-slate-600">
                  Trial tersedia untuk paket bulanan, maksimal sekali per akun parent. Setelah trial, Anda bisa lanjut
                  berlangganan.
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