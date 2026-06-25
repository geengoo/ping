import { redirect } from 'next/navigation'
import { getSessao } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
