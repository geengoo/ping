import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function formatarValor(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_OPTS = ['todos', 'pendente', 'confirmada', 'cancelada']
const PERIODO_OPTS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default async function ConversoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; pagina?: string }>
}) {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const params = await searchParams
  const status = params.status || 'todos'
  const periodo = params.periodo || '30d'
  const pagina = Number(params.pagina || '1')
  const POR_PAGINA = 20

  const diasAtras = PERIODO_OPTS[periodo] || 30
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)

  const where = {
    participacao: { campanha: { parceiroId: sessao.parceiroId } },
    criadoEm: { gte: desde },
    ...(status !== 'todos' ? { status } : {}),
  }

  const [total, conversoes] = await Promise.all([
    prisma.conversao.count({ where }),
    prisma.conversao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        participacao: { include: { afiliado: { select: { nome: true } } } },
      },
    }),
  ])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  function url(p: Record<string, string>) {
    const q = new URLSearchParams({ status, periodo, pagina: String(pagina), ...p })
    return `/parceiro/conversoes?${q}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Conversões</h1>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTS.map(s => (
          <Link key={s} href={url({ status: s, pagina: '1' })}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${status === s ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {s === 'todos' ? 'Todos' : s}
          </Link>
        ))}
        <div className="ml-auto flex gap-2">
          {Object.keys(PERIODO_OPTS).map(p => (
            <Link key={p} href={url({ periodo: p, pagina: '1' })}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${periodo === p ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {p}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Produto</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {conversoes.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-500">{c.criadoEm.toLocaleDateString('pt-BR')}</Link></td>
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-700">{c.participacao.afiliado.nome}</Link></td>
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-700">{c.produtoNome}</Link></td>
                <td className="px-6 py-3 text-right"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-700">{formatarValor(c.valorCentavos)}</Link></td>
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block"><StatusBadge status={c.status} /></Link></td>
              </tr>
            ))}
            {conversoes.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma conversão encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} resultados</span>
          <div className="flex gap-2">
            {pagina > 1 && <Link href={url({ pagina: String(pagina - 1) })} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">← Anterior</Link>}
            <span className="px-3 py-1.5 text-gray-700">{pagina} / {totalPaginas}</span>
            {pagina < totalPaginas && <Link href={url({ pagina: String(pagina + 1) })} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Próxima →</Link>}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    pendente: 'bg-yellow-50 text-yellow-700',
    confirmada: 'bg-green-50 text-green-700',
    cancelada: 'bg-red-50 text-red-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}
