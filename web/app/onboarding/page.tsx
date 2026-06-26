'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface DadosConvite {
  email: string
  nomeContato: string
  nomeFantasia: string
}

function OnboardingWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [convite, setConvite] = useState<DadosConvite | null>(null)
  const [tokenInvalido, setTokenInvalido] = useState(false)
  const [etapa, setEtapa] = useState(1)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Etapa 1 — empresa
  const [cnpj, setCnpj] = useState('')
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')

  // Etapa 2 — contato
  const [contatoNome, setContatoNome] = useState('')
  const [contatoCargo, setContatoCargo] = useState('')
  const [contatoTelefone, setContatoTelefone] = useState('')

  // Etapa 3 — técnico
  const [webhookUrl, setWebhookUrl] = useState('')

  // Etapa 4 — campanha
  const [nomeCampanha, setNomeCampanha] = useState('')
  const [recompensaTipo, setRecompensaTipo] = useState<'pix' | 'credito'>('pix')
  const [recompensaValor, setRecompensaValor] = useState('')
  const [janelaCancelamentoDias, setJanelaCancelamentoDias] = useState('30')
  const [diaPagamento, setDiaPagamento] = useState('5')

  useEffect(() => {
    if (!token) { setTokenInvalido(true); return }
    fetch(`/api/onboarding/verificar?token=${token}`)
      .then(r => r.json())
      .then((data: DadosConvite | null) => {
        if (!data) { setTokenInvalido(true); return }
        setConvite(data)
        setNomeFantasia(data.nomeFantasia)
        setContatoNome(data.nomeContato)
      })
      .catch(() => setTokenInvalido(true))
  }, [token])

  async function buscarCnpj(valor: string) {
    const limpo = valor.replace(/\D/g, '')
    if (limpo.length !== 14) return
    setCnpjStatus('loading')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`)
      if (!res.ok) { setCnpjStatus('error'); return }
      const data = await res.json()
      setRazaoSocial(data.razao_social || '')
      setNomeFantasia(data.nome_fantasia || data.razao_social || nomeFantasia)
      setCnpjStatus('ok')
    } catch {
      setCnpjStatus('error')
    }
  }

  async function handleSubmit() {
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/onboarding/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          cnpj: cnpj.replace(/\D/g, '') || undefined,
          nomeFantasia,
          razaoSocial: razaoSocial || undefined,
          contatoNome,
          contatoCargo: contatoCargo || undefined,
          contatoTelefone: contatoTelefone || undefined,
          webhookUrl: webhookUrl || undefined,
          nomeCampanha,
          recompensaTipo,
          recompensaValorCentavos: Math.round(parseFloat(recompensaValor.replace(/\./g, '').replace(',', '.')) * 100),
          janelaCancelamentoDias: parseInt(janelaCancelamentoDias),
          diaPagamento: parseInt(diaPagamento),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErro(data.erro || 'Erro ao completar cadastro')
        return
      }
      router.push('/parceiro/login?onboarding=ok')
    } finally {
      setEnviando(false)
    }
  }

  if (tokenInvalido) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
        <div className="max-w-sm text-center">
          <p className="text-gray-800 font-semibold mb-2">Link inválido ou expirado</p>
          <p className="text-gray-500 text-sm">Entre em contato com quem te convidou para receber um novo link.</p>
        </div>
      </main>
    )
  }

  if (!convite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </main>
    )
  }

  const totalEtapas = 4

  return (
    <main className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalEtapas }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i < etapa ? 'bg-[#374151]' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
          {etapa === 1 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 1 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Dados da empresa</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">CNPJ</label>
                  <input
                    value={cnpj}
                    onChange={e => { setCnpj(e.target.value); buscarCnpj(e.target.value) }}
                    placeholder="00.000.000/0001-00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                  {cnpjStatus === 'loading' && <p className="text-xs text-gray-400 mt-1">Consultando Receita Federal...</p>}
                  {cnpjStatus === 'error' && <p className="text-xs text-red-500 mt-1">CNPJ não encontrado</p>}
                  {cnpjStatus === 'ok' && <p className="text-xs text-green-600 mt-1">Dados preenchidos automaticamente</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome fantasia *</label>
                  <input
                    required
                    value={nomeFantasia}
                    onChange={e => setNomeFantasia(e.target.value)}
                    placeholder="Acme"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Razão social</label>
                  <input
                    value={razaoSocial}
                    onChange={e => setRazaoSocial(e.target.value)}
                    placeholder="Acme Ltda."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
              </div>
              <button
                onClick={() => nomeFantasia && setEtapa(2)}
                disabled={!nomeFantasia}
                className="w-full bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Continuar
              </button>
            </>
          )}

          {etapa === 2 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 2 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Dados de contato</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome *</label>
                  <input
                    required
                    value={contatoNome}
                    onChange={e => setContatoNome(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Cargo</label>
                  <input
                    value={contatoCargo}
                    onChange={e => setContatoCargo(e.target.value)}
                    placeholder="CTO, Head de Marketing..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">WhatsApp</label>
                  <input
                    value={contatoTelefone}
                    onChange={e => setContatoTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEtapa(1)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => contatoNome && setEtapa(3)}
                  disabled={!contatoNome}
                  className="flex-1 bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {etapa === 3 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 3 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Configuração técnica</h1>
                <p className="text-sm text-gray-500 mt-1">Opcional — você pode configurar isso depois no painel.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Webhook URL</label>
                  <input
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://app.suaempresa.com/webhooks/ping"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Notificações de novas conversões e saques confirmados.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEtapa(2)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => setEtapa(4)}
                  className="flex-1 bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {etapa === 4 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 4 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Campanha de indicações</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome da campanha *</label>
                  <input
                    required
                    value={nomeCampanha}
                    onChange={e => setNomeCampanha(e.target.value)}
                    placeholder="Programa de Indicações"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Tipo de recompensa *</label>
                  <select
                    required
                    value={recompensaTipo}
                    onChange={e => setRecompensaTipo(e.target.value as 'pix' | 'credito')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151] bg-white"
                  >
                    <option value="pix">PIX</option>
                    <option value="credito">Crédito em conta</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Valor da recompensa (R$) *</label>
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={recompensaValor}
                    onChange={e => setRecompensaValor(e.target.value)}
                    placeholder="50,00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Janela de cancelamento (dias)</label>
                  <input
                    type="number"
                    min={1}
                    value={janelaCancelamentoDias}
                    onChange={e => setJanelaCancelamentoDias(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Dia de pagamento (1–28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={diaPagamento}
                    onChange={e => setDiaPagamento(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
              </div>
              {erro && <p className="text-red-500 text-sm">{erro}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setEtapa(3)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={enviando || !nomeCampanha || !recompensaValor}
                  className="flex-1 bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  {enviando ? 'Criando conta...' : 'Concluir cadastro'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Convite enviado para <strong>{convite.email}</strong>
        </p>
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f8f9fa]" />}>
      <OnboardingWizard />
    </Suspense>
  )
}
