'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UrlDestinoForm({ urlAtual }: { urlAtual: string }) {
  const router = useRouter()
  const [url, setUrl] = useState(urlAtual)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleSave() {
    setSalvando(true)
    setErro('')
    setSucesso(false)
    try {
      const res = await fetch('/api/parceiro/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlDestino: url }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Erro ao salvar'); return }
      setSucesso(true)
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  const preview = url ? `${url}?ref=CODIGO_DO_AFILIADO` : ''

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setSucesso(false) }}
          placeholder="https://seusite.com.br/cadastro"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
        />
        <button
          onClick={handleSave}
          disabled={salvando || !url}
          className="px-4 py-2 bg-[#374151] text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      {preview && (
        <p className="text-xs text-gray-400 font-mono truncate">{preview}</p>
      )}
      {erro && <p className="text-red-500 text-sm">{erro}</p>}
      {sucesso && <p className="text-green-600 text-sm font-medium">URL salva.</p>}
      <p className="text-xs text-gray-400">
        Quando alguém clicar no link do afiliado, será redirecionado para esta URL com o código de rastreamento.
      </p>
    </div>
  )
}
