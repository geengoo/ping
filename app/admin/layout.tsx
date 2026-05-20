import { getSessao } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao()
  if (!sessao || sessao.role !== 'superadmin') {
    redirect('/admin/login')
  }
  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">Geengoo Ping — Super Admin</span>
        <a href="/admin/clientes" className="text-sm text-zinc-300 hover:text-white">Clientes</a>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  )
}
