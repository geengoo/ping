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
      .then(d => { if (d.erro) setErro(d.erro); else setDados(d) })
      .catch(() => setErro('Erro ao carregar'))
  }, [slug, token])

  function copiar() {
    if (!dados) return
    navigator.clipboard.writeText(dados.linkIndicacao)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function compartilharWhatsApp() {
    if (!dados) return
    const texto = encodeURIComponent(`Você foi indicado! Acesse: ${dados.linkIndicacao}`)
    window.open(`https://wa.me/?text=${texto}`, '_blank')
  }

  if (erro) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">{erro}</div>
  if (!dados) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Carregando...</div>

  const premio = fmt(dados.campanha.recompensaValorCentavos)
  const tipo = dados.campanha.recompensaTipo === 'pix' ? 'PIX' : 'crédito'

  return (
    <div className="p-5 space-y-5 font-sans">

      {/* LINK — destaque principal */}
      <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Seu link de indicação</p>
      <div className="bg-gray-900 rounded-2xl p-5 text-white">
        <p className="text-sm font-semibold mb-1">Seu link de indicação</p>
        <p className="text-xs text-gray-400 mb-4">
          Indique e ganhe <span className="text-white font-bold">{premio}</span> via {tipo} por cada indicação confirmada.
        </p>

        <div className="bg-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-gray-200 truncate mb-3">
          {dados.linkIndicacao}
        </div>

        <div className="flex gap-2">
          <button
            onClick={copiar}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-900 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            {copiado ? (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Copiado!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copiar link
              </>
            )}
          </button>
          <button
            onClick={compartilharWhatsApp}
            className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-green-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>
      </div>

      {/* Saldo */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Seu saldo</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pendente',   valor: dados.saldo.pendente,   cor: 'text-yellow-600' },
            { label: 'Disponível', valor: dados.saldo.disponivel, cor: 'text-green-600' },
            { label: 'Pago',       valor: dados.saldo.pago,       cor: 'text-gray-600' },
          ].map(({ label, valor, cor }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-base font-bold ${cor}`}>{fmt(valor)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Extrato */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Suas indicações</p>
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
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABEL[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
