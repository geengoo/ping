'use client'

import { useEffect, useState } from 'react'

interface Saldo { pendente: number; disponivel: number; pago: number }
interface Conversao { criadoEm: string; produtoNome: string; valorCentavos: number; status: string }
interface Campanha { nome: string; recompensaTipo: string; recompensaValorCentavos: number }

interface Dados {
  linkIndicacao: string
  codigoIndicacao: string
  saldo: Saldo
  conversoes: Conversao[]
  campanha: Campanha
}

function fmt(c: number) {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-yellow-50 text-yellow-700',
  confirmada: 'bg-green-50 text-green-700',
  cancelada: 'bg-red-50 text-red-600',
}

export function EmbedContent({ slug, token }: { slug: string; token: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    fetch(`/api/embed/${slug}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.erro) setErro(d.erro)
        else setDados(d)
      })
      .catch(() => setErro('Erro ao carregar'))
  }, [slug, token])

  function copiar() {
    if (!dados) return
    navigator.clipboard.writeText(dados.linkIndicacao)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">{erro}</div>
    )
  }

  if (!dados) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">Carregando...</div>
    )
  }

  return (
    <div className="p-5 space-y-5 font-sans">
      {/* Saldo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendente', valor: dados.saldo.pendente, cor: 'text-yellow-600' },
          { label: 'Disponível', valor: dados.saldo.disponivel, cor: 'text-green-600' },
          { label: 'Pago', valor: dados.saldo.pago, cor: 'text-gray-600' },
        ].map(({ label, valor, cor }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-base font-bold ${cor}`}>{fmt(valor)}</p>
          </div>
        ))}
      </div>

      {/* Link */}
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2">Seu link de indicação</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-700 truncate">
            {dados.linkIndicacao}
          </div>
          <button
            onClick={copiar}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-700 transition-colors shrink-0"
          >
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Ganhe {fmt(dados.campanha.recompensaValorCentavos)} via {dados.campanha.recompensaTipo === 'pix' ? 'PIX' : 'crédito'} por cada indicação confirmada.
        </p>
      </div>

      {/* Extrato */}
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2">Suas indicações</p>
        {dados.conversoes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma indicação ainda. Compartilhe seu link!</p>
        ) : (
          <div className="space-y-1">
            {dados.conversoes.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{c.produtoNome}</p>
                  <p className="text-xs text-gray-400">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{fmt(c.valorCentavos)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
