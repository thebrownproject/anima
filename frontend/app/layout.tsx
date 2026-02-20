import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/themes'
import NextTopLoader from 'nextjs-toploader'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// SPIKE: card redesign font candidates
const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
})

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Stackdocs',
  description: 'Document data extraction with AI',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn,
        elements: {
          userButtonPopoverRootBox: {
            pointerEvents: 'auto',
          },
        },
      }}
      signInFallbackRedirectUrl="/desktop"
      signUpFallbackRedirectUrl="/desktop"
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preload" href="/persona/obsidian.riv" as="fetch" crossOrigin="anonymous" />
          {/* SPIKE: General Sans from Fontshare */}
          <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700,800,900&display=swap" rel="stylesheet" />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${plusJakarta.variable} antialiased`}>
          {/* SVG filter for glass blur — different Chrome rendering path than CSS blur() */}
          <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
            <filter id="glass-blur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="24" />
            </filter>
          </svg>
          <NextTopLoader
            color="var(--primary)"
            height={2}
            showSpinner={false}
            shadow={false}
            zIndex={9999}
          />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
