import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'

export default async function NovoParceiro() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  async function criar(formData: FormData) {
    'use server'
    const sessaoAtual = await getSessao()
    if (!sessaoAtual?.papeis.includes('superadmin')) return

    const email = formData.get('email') as string
    const nomeFantasia = formData.get('nomeFantasia') as string
    const razaoSocial = formData.get('razaoSocial') as string || null
    const cnpj = formData.get('cnpj') as string || null
    const webhookUrl = formData.get('webhookUrl') as string || null
    const nomeCampanha = formData.get('nomeCampanha') as string
    const recompensaTipo = formData.get('recompensaTipo') as string
    const recompensaValorCentavos = parseInt(formData.get('recompensaValorCentavos') as string, 10)
    const janelaCancelamentoDias = parseInt(formData.get('janelaCancelamentoDias') as string, 10) || 30
    const diaPagamento = parseInt(formData.get('diaPagamento') as string, 10) || 5

    let conta = await prisma.conta.findUnique({ where: { email } })
    if (!conta) {
      conta = await prisma.conta.create({ data: { email, nome: nomeFantasia, papeis: [] } })
    }

    const existente = await prisma.parceiro.findUnique({ where: { contaId: conta.id } })
    if (existente) redirect(`/admin/parceiros/${existente.id}?erro=ja-existe`)

    const apiKey = nanoid(32)

    const parceiro = await prisma.parceiro.create({
      data: {
        contaId: conta.id,
        nomeFantasia,
        razaoSocial,
        cnpj,
        webhookUrl,
        apiKey,
        campanhas: {
          create: {
            nome: nomeCampanha,
            recompensaTipo,
            recompensaValorCentavos,
            janelaCancelamentoDias,
            diaPagamento,
            tiposCompraElegiveis: [],
            atribuicao: 'last-touch',
          },
        },
      },
    })

    redirect(`/admin/parceiros/${parceiro.id}?apikey=${apiKey}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Novo parceiro</h1>

      <form action={criar} className="space-y-6">
        <Section titulo="Dados do parceiro">
          <Field label="Email da conta *" name="email" type="email" required placeholder="parceiro@empresa.com" />
          <Field label="Nome fantasia *" name="nomeFantasia" required placeholder="Acme" />
          <Field label="Razão social" name="razaoSocial" placeholder="Acme Ltda." />
          <Field label="CNPJ" name="cnpj" placeholder="00.000.000/0001-00" />
          <Field label="Webhook URL" name="webhookUrl" placeholder="https://app.empresa.com/webhooks/ping" />
        </Section>

        <Section titulo="Campanha inicial">
          <Field label="Nome da campanha *" name="nomeCampanha" required placeholder="Programa de indicações" />
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Tipo de recompensa *</label>
            <select name="recompensaTipo" required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]">
              <option value="fixo">Fixo (valor em centavos)</option>
              <option value="percentual">Percentual</option>
            </select>
          </div>
          <Field label="Valor da recompensa (centavos) *" name="recompensaValorCentavos" type="number" required placeholder="5000 = R$50,00" />
          <Field label="Janela de cancelamento (dias)" name="janelaCancelamentoDias" type="number" placeholder="30" />
          <Field label="Dia de pagamento" name="diaPagamento" type="number" placeholder="5" />
        </Section>

        <button type="submit" className="px-6 py-3 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
          Criar parceiro
        </button>
      </form>
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">{titulo}</h2>
      {children}
    </div>
  )
}

function Field({ label, name, type = 'text', required, placeholder }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
      />
    </div>
  )
}
