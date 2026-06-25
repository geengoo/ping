import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'
import Link from 'next/link'

export default async function ParceiroDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ apikey?: string; erro?: string }>
}) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const { id } = await params
  const { apikey, erro } = await searchParams

  const parceiro = await prisma.parceiro.findUnique({
    where: { id },
    include: { campanhas: { orderBy: { criadoEm: 'desc' } } },
  })
  if (!parceiro) notFound()

  async function salvar(formData: FormData) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) redirect('/admin/login')
    await prisma.parceiro.update({
      where: { id },
      data: {
        nomeFantasia: (formData.get('nomeFantasia') as string) || null,
        razaoSocial: (formData.get('razaoSocial') as string) || null,
        cnpj: (formData.get('cnpj') as string) || null,
        webhookUrl: (formData.get('webhookUrl') as string) || null,
        status: formData.get('status') as string,
      },
    })
    revalidatePath(`/admin/parceiros/${id}`)
  }

  async function revogarApiKey() {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) redirect('/admin/login')
    const novaChave = nanoid(32)
    await prisma.parceiro.update({ where: { id }, data: { apiKey: novaChave } })
    redirect(`/admin/parceiros/${id}?apikey=${novaChave}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/parceiros" className="text-gray-400 hover:text-gray-600 text-sm">← Parceiros</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">
          {parceiro.nomeFantasia || parceiro.razaoSocial || 'Parceiro'}
        </h1>
      </div>

      {erro === 'ja-existe' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Este email já tem um parceiro associado.
        </div>
      )}

      {erro === 'cnpj-duplicado' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Este CNPJ já está cadastrado em outro parceiro.
        </div>
      )}

      {apikey && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <p className="font-semibold mb-1">API Key gerada — salve agora, não será exibida novamente:</p>
          <code className="font-mono break-all">{apikey}</code>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 mb-4">Dados</h2>
        <form action={salvar} className="space-y-4">
          {[
            { label: 'Nome fantasia', name: 'nomeFantasia', value: parceiro.nomeFantasia || '' },
            { label: 'Razão social', name: 'razaoSocial', value: parceiro.razaoSocial || '' },
            { label: 'CNPJ', name: 'cnpj', value: parceiro.cnpj || '' },
            { label: 'Webhook URL', name: 'webhookUrl', value: parceiro.webhookUrl || '' },
          ].map(({ label, name, value }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <input
                type="text"
                name={name}
                defaultValue={value}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
            <select name="status" defaultValue={parceiro.status} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]">
              <option value="ativo">ativo</option>
              <option value="inativo">inativo</option>
              <option value="suspenso">suspenso</option>
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
            Salvar
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 mb-4">API Key</h2>
        <p className="text-sm text-gray-500 mb-3">
          Atual: <code className="font-mono text-gray-700">{'••••••••' + parceiro.apiKey.slice(-4)}</code>
        </p>
        <form action={revogarApiKey}>
          <button type="submit" className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
            Revogar e gerar nova API key
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Campanhas</h2>
          <Link href={`/admin/parceiros/${id}/campanha/nova`} className="text-xs text-[#374151] hover:underline">+ nova campanha</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Nome</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Recompensa</th>
            </tr>
          </thead>
          <tbody>
            {parceiro.campanhas.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/admin/parceiros/${id}/campanha/${c.id}`} className="text-gray-700 hover:text-[#374151]">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-6 py-3 text-gray-500">{c.status}</td>
                <td className="px-6 py-3 text-right text-gray-700">
                  {c.recompensaTipo} — {(c.recompensaValorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}
            {parceiro.campanhas.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma campanha ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
