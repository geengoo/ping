import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarConviteParceiro } from '@/lib/resend'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'

export default async function ConvidarParceiro() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  async function convidar(formData: FormData) {
    'use server'
    const sessaoAtual = await getSessao()
    if (!sessaoAtual?.papeis.includes('superadmin')) redirect('/admin/login')

    const email = formData.get('email') as string
    const nomeContato = formData.get('nomeContato') as string
    const nomeFantasia = formData.get('nomeFantasia') as string

    if (!email || !nomeContato || !nomeFantasia) return

    const token = nanoid(32)
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.conviteParceiro.create({
      data: { email, nomeContato, nomeFantasia, token, expiraEm },
    })

    await enviarConviteParceiro({ para: email, nomeContato, nomeFantasia, token })

    redirect('/admin/parceiros?convite=enviado')
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Convidar parceiro</h1>
        <p className="text-sm text-gray-500 mt-1">
          O convidado receberá um email com link para completar o cadastro.
        </p>
      </div>
      <form action={convidar} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nome do contato *</label>
          <input
            name="nomeContato"
            required
            placeholder="João Silva"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Email *</label>
          <input
            name="email"
            type="email"
            required
            placeholder="joao@empresa.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nome fantasia da empresa *</label>
          <input
            name="nomeFantasia"
            required
            placeholder="Acme"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-[#374151] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Enviar convite
        </button>
      </form>
    </div>
  )
}
