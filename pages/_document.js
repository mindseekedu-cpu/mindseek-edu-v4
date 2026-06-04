import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return {
      ...initialProps,
      midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || '',
      midtransSnapUrl:
        String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true'
          ? 'https://app.midtrans.com/snap/snap.js'
          : 'https://app.sandbox.midtrans.com/snap/snap.js',
    }
  }

  render() {
    const clientKey = this.props.midtransClientKey
    const snapUrl = this.props.midtransSnapUrl

    return (
      <Html lang="id">
        <Head>
          {clientKey ? (
            <script src={snapUrl} data-client-key={clientKey} async></script>
          ) : null}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}