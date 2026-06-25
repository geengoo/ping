import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export default async function EditarCampanhaPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>
}) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const { id, cid } = await params

  const campanha = await prisma.campanha.findFirst({ where: { id: cid, parceiroId: id } })
  if (!campanha) notFound()

  async function salvar(formData: FormData) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return
    await prisma.campanha.update({
      where: { id: cid },
      data: {
        nome: formData.get('nome') as string,
        status: formData.get('status') as string,
        recompensaTipo: formData.get('recompensaTipo') as string,
        recompensaValorCentavos: parseInt(formData.get('recompensaValorCentavos') as string, 10),
        janelaCancelamentoDias: parseInt(formData.get('janelaCancelamentoDias') as string, 10),
        diaPagamento: parseInt(formData.get('diaPagamento') as string, 10),
        atribuicao: formData.get('atribuicao') as string,
      },
    })
    revalidatePath(`/admin/parceiros/${id}`)
    redirect(`/admin/parceiros/${id}`)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/parceiros/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Parceiro</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Editar campanha</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <form action={salvar} className="space-y-4">
          {[
            { label: 'Nome', name: 'nome', value: campanha.nome },
          ].map(({ label, name, value }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <input type="text" name={name} defaultValue={value} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]" />
            </div>
          ))}
          {[
            { label: 'Status', name: 'status', value: campanha.status, opts: ['ativa', 'inativa'] },
            { label: 'Tipo de recompensa', name: 'recompensaTipo', value: campanha.recompensaTipo, opts: ['fixo', 'percentual'] },
            { label: 'Atribuição', name: 'atribuicao', value: campanha.atribuicao, opts: ['last-touch', 'first-touch'] },
          ].map(({ label, name, value, opts }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <select name={name} defaultValue={value} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]">
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {[
            { label: 'Valor da recompensa (centavos)', name: 'recompensaValorCentavos', value: campanha.recompensaValorCentavos },
            { label: 'Janela de cancelamento (dias)', name: 'janelaCancelamentoDias', value: campanha.janelaCancelamentoDias },
            { label: 'Dia de pagamento', name: 'diaPagamento', value: campanha.diaPagamento },
          ].map(({ label, name, value }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <input type="number" name={name} defaultValue={value} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]" />
            </div>
          ))}
          <button type="submit" className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
            Salvar campanha
          </button>
        </form>
      </div>
    </div>
  )
}
