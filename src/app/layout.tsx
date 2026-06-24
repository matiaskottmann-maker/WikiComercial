import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import './globals.css'
import { getAdminEmail } from '@/lib/admin'
import AdminBanner from '@/components/admin/AdminBanner'

export const metadata: Metadata = {
  title: 'WikiComercial — Evalua a tus profesores',
  description: 'Plataforma comunitaria de evaluacion de profesores de Ingenieria Comercial UC',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminEmail = await getAdminEmail()

  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {adminEmail && <AdminBanner adminEmail={adminEmail} />}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center" aria-label="WikiComercial — inicio">
              <Image
                src="/logo.png"
                alt="WikiComercial"
                width={1271}
                height={226}
                priority
                className="h-7 w-auto sm:h-8"
              />
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/profesores"
                className="text-sm font-medium text-gray-600 hover:text-uc-blue px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
              >
                Profesores
              </Link>
              <Link
                href="/admin"
                className="text-sm font-medium text-gray-400 hover:text-uc-blue px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
              >
                Vista admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-gray-100 mt-8">
          <div className="max-w-5xl mx-auto px-4 py-8 text-center">
            <p className="text-sm text-gray-400">
              WikiComercial — Elaborado por{' '}
              <a
                href="https://homeroai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-uc-blue hover:underline cursor-pointer"
              >
                Homero AI
              </a>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
