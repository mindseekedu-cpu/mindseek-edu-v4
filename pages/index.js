import Head from 'next/head'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <Head>
        <title>MindSeek Edu – Pendamping Belajar AI dengan Metode Sokratik</title>
        <meta name="description" content="..." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-white flex flex-col">
        {/* Navbar (tanpa tombol Login Siswa) */}
        <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-sm">
          <span className="text-xl font-bold text-blue-600 tracking-tight">
            MindSeek Edu
          </span>
          {/* Hanya dua tombol di navbar untuk parent */}
          <div className="flex gap-3">
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

            {/* Tombol di hero section: disusun vertikal di HP, horizontal di desktop */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md"
              >
                Daftar Sekarang
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-blue-600 bg-white border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                Login (Parent)
              </Link>
              <Link
                href="/student/login"
                className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-green-600 bg-white border border-green-600 rounded-lg hover:bg-green-50"
              >
                Login (Siswa)
              </Link>
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
