import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GuardiX — Sua corretora segura. Seu cliente protegido.',
  description: 'Plataforma SaaS multi-tenant para corretoras de seguros e consórcio',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
