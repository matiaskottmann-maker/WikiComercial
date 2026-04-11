import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'WikiComercial — Evalua a tus profesores',
  description: 'Plataforma comunitaria de evaluacion de profesores de Ingenieria Comercial UC',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-uc-blue to-uc-blue-light rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">W</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                Wiki<span className="text-uc-blue">Comercial</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/profesores"
                className="text-sm font-medium text-gray-600 hover:text-uc-blue px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
              >
                Profesores
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-gray-100 mt-16">
          <div className="max-w-5xl mx-auto px-4 py-8 text-center">
            <p className="text-sm text-gray-400">
              WikiComercial — Hecho por estudiantes, para estudiantes.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
