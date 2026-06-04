import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || process.env.MIDTRANS_CLIENT_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const snapUrl = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  return (
    <Html lang="id">
      <Head>
        {clientKey && (
          <script src={snapUrl} data-client-key={clientKey} async />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
