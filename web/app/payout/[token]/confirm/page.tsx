import { redirect } from 'next/navigation'
import { verificarPayoutToken } from '@/lib/payoutToken'
import { prisma } from '@/lib/prisma'
import { notificarAfiliadoConfirmadoParceiro } from '@/lib/resend'

type Props = { params: Promise<{ token: string }> }

export default async function ConfirmPage({ params }: Props) {
  const { token } = await params

  let rewardId: string
  let nomeAfiliado: string
  let valorCentavos: number
  let jaProcessado = false

  try {
    const payload = await verificarPayoutToken(token, 'confirm')
    rewardId = payload.rewardId

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
      include: { participacao: { include: { afiliado: true } } },
    })

    if (!reward) return <Pagina titulo="Não encontrado" mensagem="Saque não encontrado." cor="vermelho" />

    nomeAfiliado = reward.participacao.afiliado.nome
    valorCentavos = reward.valorCentavos

    if (reward.status !== 'solicitado') jaProcessado = true
  } catch {
    return <Pagina titulo="Link inválido" mensagem="Este link é inválido ou expirou." cor="vermelho" />
  }

  if (jaProcessado) {
    return <Pagina titulo="Já confirmado" mensagem="Este pagamento já foi registrado anteriormente." cor="verde" />
  }

  const valor = (valorCentavos! / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function confirmar() {
    'use server'
    try {
      const payload = await verificarPayoutToken(token, 'confirm')

      const reward = await prisma.reward.findUnique({
        where: { id: payload.rewardId },
        include: { participacao: { include: { afiliado: true } } },
      })
      if (!reward) return

      // Fix 2: update atômico — evita race condition
      const result = await prisma.reward.updateMany({
        where: { id: payload.rewardId, status: 'solicitado' },
        data: { status: 'pago', pagoEm: new Date() },
      })

      if (result.count === 0) {
        // já foi processado por outra requisição
        redirect('/payout/confirm-ok?nome=' + encodeURIComponent(reward.participacao.afiliado.nome))
      }

      await notificarAfiliadoConfirmadoParceiro(
        reward.participacao.afiliado.email,
        reward.valorCentavos
      )

      // Fix 1: redirecionar para página de sucesso
      redirect('/payout/confirm-ok?nome=' + encodeURIComponent(reward.participacao.afiliado.nome))
    } catch (err) {
      // Fix 3: logging no catch
      console.error('[confirm] erro:', err)
      throw err
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2">Confirmar pagamento</h1>
        <p className="text-gray-600 mb-6">
          Você confirma que realizou o pagamento de <strong>{valor}</strong> para{' '}
          <strong>{nomeAfiliado!}</strong>?
        </p>
        <form action={confirmar}>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 w-full"
          >
            Sim, confirmar pagamento
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
