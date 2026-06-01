/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  experimental: {
    serverComponentsExternalPackages: [
      'bcryptjs',
      'jsonwebtoken',
      'nodemailer',
      'midtrans-client'
    ]
  },

  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    OCR_SPACE_API_KEY: process.env.OCR_SPACE_API_KEY,
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  },

  images: {
    domains: []
  }
}

module.exports = nextConfig
