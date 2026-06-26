'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CampanhaFormProps {
  campanha: {
    id: string
    nome: string
    recompensaTipo: string
    recompensaValorCentavos: number
    janelaCancelamentoDias: number
    diaPagamento: number
    status: string
    atribuicao: string
  }
}

function centavosParaReais(centavos: number) {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

function reaisParaCentavos(valor: string) {
  return Math.round(parseFloat(valor.replace(/\./g, '').replace(',', '.')) * 100)
}

export function CampanhaForm({ campanha }: CampanhaFormProps) {
  const router = useRouter()
  const [nome, setNome] = useState(campanha.nome)
  const [recompensaTipo, setRecompensaTipo] = useState(campanha.recompensaTipo)
  const [recompensaValor, setRecompensaValor] = useState(centavosParaReais(campanha.recompensaValorCentavos))
  const [janelaDias, setJanelaDias] = useState(String(campanha.janelaCancelamentoDias))
  const [diaPagamento, setDiaPagamento] = useState(String(campanha.diaPagamento))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    setSucesso(false)

    const recompensaValorCentavos = reaisParaCentavos(recompensaValor)
    if (!recompensaValorCentavos || recompensaValorCentavos <= 0) {
      setErro('Valor da recompensa inválido')
      setSalvando(false)
      return
    }

    try {
      const res = await fetch('/api/parceiro/campanha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campanhaId: campanha.id,
          nome,
          recompensaTipo,
          recompensaValorCentavos,
          janelaCancelamentoDias: parseInt(janelaDias) || 30,
          diaPagamento: parseInt(diaPagamento) || 5,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErro(data.erro || 'Erro ao salvar')
        return
      }
      setSucesso(true)
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Dados da campanha</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nome da campanha *</label>
            <input
              required
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Tipo de recompensa *</label>
            <select
              value={recompensaTipo}
              onChange={e => setRecompensaTipo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151] bg-white"
            >
              <option value="pix">PIX</option>
              <option value="credito">Crédito</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Valor da recompensa (R$) *</label>
            <input
              required
              value={recompensaValor}
              onChange={e => setRecompensaValor(e.target.value)}
              placeholder="0,00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Regras de pagamento</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Janela de cancelamento (dias)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={janelaDias}
              onChange={e => setJanelaDias(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
            />
            <p className="text-xs text-gray-400 mt-1">Período de espera antes de liberar o pagamento ao afiliado.</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Dia de pagamento</label>
            <input
              type="number"
              min={1}
              max={28}
              value={diaPagamento}
              onChange={e => setDiaPagamento(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
            />
            <p className="text-xs text-gray-400 mt-1">Dia do mês em que os pagamentos são processados.</p>
          </div>
        </div>
      </div>

      {erro && <p className="text-red-500 text-sm">{erro}</p>}
      {sucesso && <p className="text-green-600 text-sm font-medium">Campanha salva com sucesso.</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={salvando}
          className="px-6 py-2.5 bg-[#374151] text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
