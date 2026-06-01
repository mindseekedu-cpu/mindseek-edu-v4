import Head from 'next/head'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>MindSeek Edu – Pendamping Belajar AI dengan Metode Sokratik</title>
        <meta name="description" content="MindSeek Edu adalah platform pendamping belajar berbasis AI dengan metode Sokratik untuk anak-anak." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-white flex flex-col">

        {/* Navbar */}
        <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
          <span className="text-xl font-bold text-blue-600 tracking-tight">
            MindSeek Edu
          </span>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors duration-200"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              Daftar Sekarang
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="max-w-2xl mx-auto">

            {/* Badge */}
            <span className="inline-block mb-4 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full uppercase tracking-wide">
              Platform Edukasi AI
            </span>

            {/* Judul */}
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
              MindSeek Edu
            </h1>

            {/* Subjudul */}
            <p className="text-lg sm:text-xl text-gray-500 mb-8 leading-relaxed">
              Pendamping Belajar AI dengan Metode Sokratik — membimbing anak berpikir kritis,
              bukan sekadar memberi jawaban.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"
              >
                Daftar Sekarang
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-blue-600 bg-white border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
              >
                Login
              </Link>
            </div>

          </div>
        </section>

        {/* Footer */}
        <footer className="w-full px-6 py-4 border-t border-gray-100 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} MindSeek Edu. All rights reserved.
        </footer>

      </main>
    </>
  )
}
