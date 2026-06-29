import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CopyButton } from '@/components/parceiro/CopyButton'
import { SlugForm } from './SlugForm'
import { UrlDestinoForm } from './UrlDestinoForm'

export default async function ConfiguracoesPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const parceiro = await prisma.parceiro.findUnique({
    where: { id: sessao.parceiroId },
    select: { apiKey: true, webhookUrl: true, slug: true, urlDestino: true },
  })

  if (!parceiro) redirect('/parceiro/login')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ping.geengoo.io'

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold text-gray-900">Configurações</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">URL do programa de indicações</h2>
        </div>
        <div className="p-6">
          <SlugForm slugAtual={parceiro.slug || ''} baseUrl={baseUrl} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">URL de destino das indicações</h2>
        </div>
        <div className="p-6">
          <UrlDestinoForm urlAtual={parceiro.urlDestino || ''} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Integração via API</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1">API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 truncate">
                {parceiro.apiKey}
              </code>
              <CopyButton valor={parceiro.apiKey} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1">Webhook URL</label>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {parceiro.webhookUrl || <span className="text-gray-400">Não configurado</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
