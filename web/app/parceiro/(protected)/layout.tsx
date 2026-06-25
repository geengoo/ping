import { redirect } from 'next/navigation'
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/parceiro/Sidebar'

export default async function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const parceiro = await prisma.parceiro.findUnique({
    where: { id: sessao.parceiroId },
    select: { nomeFantasia: true, razaoSocial: true },
  })

  const nomeParceiro = parceiro?.nomeFantasia || parceiro?.razaoSocial || 'Parceiro'

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <Sidebar nomeParceiro={nomeParceiro} />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
