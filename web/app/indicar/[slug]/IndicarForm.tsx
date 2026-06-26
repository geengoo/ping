'use client'

import { useState } from 'react'

interface IndicarFormProps {
  slug: string
  nomeParceiro: string
  descricao: string
  recompensaLabel: string
}

export function IndicarForm({ slug, nomeParceiro, descricao, recompensaLabel }: IndicarFormProps) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch(`/api/indicar/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, chavePix }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro || 'Erro ao cadastrar')
        return
      }
      setLink(data.linkIndicacao)
    } finally {
      setEnviando(false)
    }
  }

  function copiar() {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (link) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tudo certo!</h2>
          <p className="text-sm text-gray-500 mt-1">Seu link chegará também no seu email.</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left">
          <p className="text-xs text-gray-400 font-medium mb-2">Seu link de indicação</p>
          <p className="font-mono text-sm text-gray-800 break-all">{link}</p>
        </div>
        <button
          onClick={copiar}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          {copiado ? 'Copiado!' : 'Copiar link'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Seu nome *</label>
        <input
          required
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="João Silva"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Email *</label>
        <input
          required
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="joao@email.com"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium block mb-1">Chave PIX para receber *</label>
        <input
          required
          value={chavePix}
          onChange={e => setChavePix(e.target.value)}
          placeholder="CPF, email ou telefone"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      {erro && <p className="text-red-500 text-sm">{erro}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {enviando ? 'Gerando seu link...' : 'Quero participar'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Ao participar, você concorda em receber seu prêmio em {recompensaLabel}.
      </p>
    </form>
  )
}
