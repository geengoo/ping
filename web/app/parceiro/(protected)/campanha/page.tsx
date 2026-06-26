import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CampanhaForm } from './CampanhaForm'

export default async function CampanhaPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const campanha = await prisma.campanha.findFirst({
    where: { parceiroId: sessao.parceiroId, status: 'ativa' },
  })

  if (!campanha) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">Campanha</h1>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
          Nenhuma campanha ativa.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Campanha</h1>
          <p className="text-sm text-gray-400 mt-0.5">Status: <span className="text-green-600 font-medium">{campanha.status}</span></p>
        </div>
      </div>
      <CampanhaForm campanha={campanha} />
    </div>
  )
}
