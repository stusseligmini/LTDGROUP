import './globals.css'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ProvidersWrapper } from '@/providers/ProvidersWrapper'
import { TelegramProvider } from '@/providers/TelegramProvider'

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Celora',
  description: 'Mobile-first wallet and notification hub for Celora users',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Celora'
  },
}

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathHeader = await headers();
  const path =
    pathHeader.get('x-invoke-path') ||
    pathHeader.get('x-pathname') ||
    pathHeader.get('next-url') ||
    '';
  const isTelegram = path.startsWith('/telegram');
  
  return (
    <html lang="en" className="dark">
      <head>
        {/* In dev, nonce is omitted to keep layout static */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, user-scalable=yes" />
        {/* iOS: prevent phone/email auto-link styling and improve mobile experience */}
        <meta name="format-detection" content="telephone=no, email=no, address=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-touch-fullscreen" content="yes" />
        {/* Browser UI colors */}
        <meta name="theme-color" content="#0a0e17" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: light)" />
        {/* AGGRESSIVE mobile cache busting */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* PWA icons for iOS/Android */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-128x128.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-96x96.png" />
      </head>
      <body className="min-h-screen bg-slate-900 antialiased">
        <TelegramProvider>
          <ProvidersWrapper isTelegram={isTelegram}>
            {children}
          </ProvidersWrapper>
        </TelegramProvider>
      </body>
    </html>
  )
}
