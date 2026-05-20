import { getSessao } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const sessao = await getSessao()

  if (!sessao || (sessao.role !== 'superadmin' && sessao.slug !== tenant)) {
    redirect(`/${tenant}/login`)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-zinc-900">{tenant}</span>
          <a href={`/${tenant}/admin`} className="text-sm text-zinc-500 hover:text-zinc-900">Dashboard</a>
          <a href={`/${tenant}/admin/campanhas`} className="text-sm text-zinc-500 hover:text-zinc-900">Campanhas</a>
        </div>
        <span className="text-xs text-zinc-400">Geengoo Ping</span>
      </nav>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  )
}
