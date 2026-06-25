import { verificarPayoutToken } from '@/lib/payoutToken'
import { prisma } from '@/lib/prisma'
import { notificarAfiliadoPrevisaoPagamento, notificarSuperadminPrevisao } from '@/lib/resend'

type Props = { params: Promise<{ token: string }> }

export default async function DisputePage({ params }: Props) {
  const { token } = await params

  let nomeAfiliado: string
  let valorCentavos: number
  let jaRegistrado = false

  try {
    const payload = await verificarPayoutToken(token, 'dispute')

    const reward = await prisma.reward.findUnique({
      where: { id: payload.rewardId },
      include: { participacao: { include: { afiliado: true } } },
    })

    if (!reward) return <Pagina titulo="Não encontrado" mensagem="Saque não encontrado." cor="vermelho" />

    nomeAfiliado = reward.participacao.afiliado.nome
    valorCentavos = reward.valorCentavos

    if (reward.previsaoPagamentoEm) jaRegistrado = true
  } catch {
    return <Pagina titulo="Link inválido" mensagem="Este link é inválido ou expirou." cor="vermelho" />
  }

  if (jaRegistrado) {
    return <Pagina titulo="Já registrado" mensagem="Uma previsão de pagamento já foi informada para este saque." cor="verde" />
  }

  const valor = (valorCentavos! / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function registrarPrevisao(formData: FormData) {
    'use server'
    const dataStr = formData.get('data') as string
    const observacao = (formData.get('observacao') as string) || undefined
    if (!dataStr) return

    try {
      const payload = await verificarPayoutToken(token, 'dispute')
      const reward = await prisma.reward.findUnique({
        where: { id: payload.rewardId },
        include: { participacao: { include: { afiliado: true } } },
      })
      if (!reward || reward.previsaoPagamentoEm) return

      const previsao = new Date(dataStr)
      await prisma.reward.update({
        where: { id: payload.rewardId },
        data: { previsaoPagamentoEm: previsao },
      })

      await notificarAfiliadoPrevisaoPagamento(
        reward.participacao.afiliado.email,
        reward.valorCentavos,
        previsao,
        observacao
      )

      const superadmin = process.env.SUPERADMIN_EMAIL
      if (superadmin) {
        await notificarSuperadminPrevisao(
          superadmin,
          reward.participacao.afiliado.nome,
          reward.valorCentavos,
          previsao
        )
      }
    } catch {
      // token inválido — não faz nada
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full">
        <h1 className="text-xl font-semibold mb-2">Informe a previsão de pagamento</h1>
        <p className="text-gray-600 mb-6">
          Saque de <strong>{valor}</strong> para <strong>{nomeAfiliado!}</strong>.
          Quando você irá realizar o pagamento?
        </p>
        <form action={registrarPrevisao} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data prevista de pagamento
            </label>
            <input
              type="date"
              name="data"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação para o afiliado (opcional)
            </label>
            <textarea
              name="observacao"
              rows={3}
              placeholder="Ex: aguardando aprovação financeira"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 w-full"
          >
            Confirmar previsão
          </button>
        </form>
      </div>
    </main>
  )
}

function Pagina({ titulo, mensagem, cor }: { titulo: string; mensagem: string; cor: 'verde' | 'vermelho' }) {
  const corClasse = cor === 'verde' ? 'text-green-600' : 'text-red-600'
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className={`text-xl font-semibold mb-2 ${corClasse}`}>{titulo}</h1>
        <p className="text-gray-600">{mensagem}</p>
      </div>
    </main>
  )
}
