'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Wallet, Users, Webhook, Settings, LogOut, Megaphone } from 'lucide-react'

const NAV = [
  { label: 'Dashboard',     href: '/parceiro/dashboard',      icon: <LayoutDashboard size={16} /> },
  { label: 'Campanha',      href: '/parceiro/campanha',       icon: <Megaphone size={16} /> },
  { label: 'Conversões',    href: '/parceiro/conversoes',     icon: <ArrowLeftRight size={16} /> },
  { label: 'Saques',        href: '/parceiro/saques',         icon: <Wallet size={16} /> },
  { label: 'Afiliados',     href: '/parceiro/afiliados',      icon: <Users size={16} /> },
  { label: 'Webhooks',      href: '/parceiro/webhooks',       icon: <Webhook size={16} /> },
  { label: 'Configurações', href: '/parceiro/configuracoes',  icon: <Settings size={16} /> },
]

interface SidebarProps { nomeParceiro?: string }

export function Sidebar({ nomeParceiro }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/parceiro-auth/logout', { method: 'POST' })
    router.push('/parceiro/login')
  }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white px-3 py-4">
      <div className="px-2 mb-6">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ping</span>
        {nomeParceiro && <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{nomeParceiro}</p>}
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ label, href, icon }) => {
          const ativo = pathname === href || (href !== '/parceiro/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                ativo ? 'bg-[#374151] text-white font-medium' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors w-full"
      >
        <LogOut size={16} />
        Sair
      </button>
    </aside>
  )
}
