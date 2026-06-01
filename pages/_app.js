import '../styles/globals.css'

/**
 * Komponen App utama Next.js.
 * Semua halaman dibungkus oleh komponen ini.
 * @param {{ Component: React.ComponentType, pageProps: object }} props
 */
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
