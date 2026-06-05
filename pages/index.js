import Head from 'next/head'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>MindSeek Edu – Pendamping Belajar AI dengan Metode Sokratik</title>
        <meta name="description" content="Pendamping belajar AI untuk siswa SD-SMA. Metode Sokratik, laporan orang tua, gamifikasi, dan paket berlangganan fleksibel." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-white flex flex-col">
        {/* Navbar dengan link ke Paket & Harga */}
        <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
          <span className="text-xl font-bold text-blue-600 tracking-tight">
            MindSeek Edu
          </span>
          <div className="flex gap-3">
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition"
            >
              Paket & Harga
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Daftar
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <span className="inline-block mb-4 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full">
              Platform Edukasi AI
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
              MindSeek Edu
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 mb-8 leading-relaxed">
              Pendamping Belajar AI dengan Metode Sokratik — membimbing anak berpikir kritis,
              bukan sekadar memberi jawaban.
            </p>

            {/* Tombol aksi utama */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md"
              >
                Daftar Sekarang
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-blue-600 bg-white border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                Lihat Paket & Harga
              </Link>
              <Link
                href="/student/login"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-green-600 bg-white border border-green-600 rounded-lg hover:bg-green-50"
              >
                Login Siswa
              </Link>
            </div>

            {/* Info trial 7 hari */}
            <div className="mt-8 p-4 bg-slate-50 rounded-xl text-sm text-slate-600 border border-slate-200">
              <p className="font-semibold text-slate-800">✨ Coba 7 hari gratis</p>
              <p className="mt-1">
                Untuk paket Smart Parent atau Smart Family bulanan. 
                <Link href="/pricing" className="text-blue-600 hover:underline ml-1">
                  Lihat detail →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* Fitur singkat (opsional, sesuai PRD) */}
        <section className="w-full bg-slate-50 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center text-slate-900 mb-10">
              Mengapa MindSeek Edu?
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Metode Sokratik</h3>
                <p className="mt-2 text-sm text-slate-600">Membimbing dengan petunjuk, bukan jawaban langsung.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Laporan Orang Tua</h3>
                <p className="mt-2 text-sm text-slate-600">Pantau kemandirian dan konsistensi belajar anak.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Gamifikasi & Reward</h3>
                <p className="mt-2 text-sm text-slate-600">XP, streak, leaderboard, dan reward dari orang tua.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="w-full px-6 py-4 border-t text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} MindSeek Edu. All rights reserved.
        </footer>
      </main>
    </>
  )
}
