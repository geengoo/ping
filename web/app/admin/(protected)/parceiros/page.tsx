import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function mascaraApiKey(key: string) {
  return '••••••••' + key.slice(-4)
}

export default async function ParceirosPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const parceiros = await prisma.parceiro.findMany({
    orderBy: { criadoEm: 'desc' },
    include: {
      campanhas: { where: { status: 'ativa' }, select: { id: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-gray-900">Parceiros</h1>
        <Link href="/admin/parceiros/novo" className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
          Novo parceiro
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Nome</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">API Key</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Campanhas ativas</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {parceiros.map(p => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/admin/parceiros/${p.id}`} className="text-gray-700 hover:text-[#374151] font-medium">
                    {p.nomeFantasia || p.razaoSocial || '—'}
                  </Link>
                </td>
                <td className="px-6 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-6 py-3 font-mono text-xs text-gray-500">{mascaraApiKey(p.apiKey)}</td>
                <td className="px-6 py-3 text-right text-gray-700">{p.campanhas.length}</td>
                <td className="px-6 py-3 text-gray-500">{p.criadoEm.toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {parceiros.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum parceiro ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    ativo: 'bg-green-50 text-green-700',
    inativo: 'bg-gray-100 text-gray-500',
    suspenso: 'bg-red-50 text-red-600',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}
