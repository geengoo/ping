import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_OPTS = ['todos', 'pendente', 'confirmada', 'cancelada']
const PERIODO_OPTS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminConversoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; parceiro?: string; pagina?: string }>
}) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const p = await searchParams
  const status = p.status || 'todos'
  const periodo = p.periodo || '30d'
  const parceiroId = p.parceiro || ''
  const pagina = Math.max(1, Number(p.pagina || '1') || 1)
  const POR_PAGINA = 20

  const diasAtras = PERIODO_OPTS[periodo] || 30
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)

  const where = {
    criadoEm: { gte: desde },
    ...(status !== 'todos' ? { status } : {}),
    ...(parceiroId ? { participacao: { campanha: { parceiroId } } } : {}),
  }

  const [total, conversoes, parceiros] = await Promise.all([
    prisma.conversao.count({ where }),
    prisma.conversao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        participacao: {
          include: {
            afiliado: { select: { nome: true } },
            campanha: { include: { parceiro: { select: { nomeFantasia: true, razaoSocial: true } } } },
          },
        },
      },
    }),
    prisma.parceiro.findMany({ select: { id: true, nomeFantasia: true, razaoSocial: true }, orderBy: { criadoEm: 'desc' } }),
  ])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  function url(extra: Record<string, string>) {
    const q = new URLSearchParams({ status, periodo, parceiro: parceiroId, pagina: String(pagina), ...extra })
    return `/admin/conversoes?${q}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Conversões</h1>

      <div className="flex gap-2 flex-wrap items-center">
        {STATUS_OPTS.map(s => (
          <Link key={s} href={url({ status: s, pagina: '1' })}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${status === s ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {s === 'todos' ? 'Todos' : s}
          </Link>
        ))}

        <form method="GET" action="/admin/conversoes" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="periodo" value={periodo} />
          <input type="hidden" name="pagina" value="1" />
          <select
            name="parceiro"
            defaultValue={parceiroId}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 outline-none"
            aria-label="Filtrar por parceiro"
          >
            <option value="">Todos os parceiros</option>
            {parceiros.map(par => (
              <option key={par.id} value={par.id}>{par.nomeFantasia || par.razaoSocial}</option>
            ))}
          </select>
          <button type="submit" className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Filtrar
          </button>
        </form>

        <div className="flex gap-2">
          {Object.keys(PERIODO_OPTS).map(per => (
            <Link key={per} href={url({ periodo: per, pagina: '1' })}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${periodo === per ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {per}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Parceiro</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Produto</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {conversoes.map(c => {
              const nomeParceiro = c.participacao.campanha.parceiro.nomeFantasia || c.participacao.campanha.parceiro.razaoSocial || '—'
              return (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-500">{c.criadoEm.toLocaleDateString('pt-BR')}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-600 text-xs">{nomeParceiro}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-700">{c.participacao.afiliado.nome}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-700">{c.produtoNome}</Link></td>
                  <td className="px-6 py-3 text-right"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-700">{fmt(c.valorCentavos)}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block"><StatusBadge status={c.status} /></Link></td>
                </tr>
              )
            })}
            {conversoes.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma conversão encontrada.</td></tr>
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
