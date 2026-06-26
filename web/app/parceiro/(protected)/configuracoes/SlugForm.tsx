'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SlugFormProps {
  slugAtual: string
  baseUrl: string
}

export function SlugForm({ slugAtual, baseUrl }: SlugFormProps) {
  const router = useRouter()
  const [slug, setSlug] = useState(slugAtual)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const slugNormalizado = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-|-$/g, '')

  const urlPublica = slugNormalizado ? `${baseUrl}/indicar/${slugNormalizado}` : ''

  async function handleSave() {
    setSalvando(true)
    setErro('')
    setSucesso(false)
    try {
      const res = await fetch('/api/parceiro/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.erro || 'Erro ao salvar')
        return
      }
      setSlug(data.slug)
      setSucesso(true)
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  function copiar() {
    if (!urlPublica) return
    navigator.clipboard.writeText(urlPublica)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <span className="text-sm text-gray-400 shrink-0">{baseUrl}/indicar/</span>
        <input
          value={slug}
          onChange={e => { setSlug(e.target.value); setSucesso(false) }}
          placeholder="minha-empresa"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
        />
        <button
          onClick={handleSave}
          disabled={salvando || !slug}
          className="px-4 py-2 bg-[#374151] text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {urlPublica && (
        <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <span className="flex-1 text-sm text-gray-600 truncate">{urlPublica}</span>
          <button
            onClick={copiar}
            className="text-xs text-gray-500 hover:text-gray-800 shrink-0 font-medium"
          >
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      )}

      {erro && <p className="text-red-500 text-sm">{erro}</p>}
      {sucesso && <p className="text-green-600 text-sm font-medium">URL salva com sucesso.</p>}
      <p className="text-xs text-gray-400">
        Esta é a página pública onde seus clientes se cadastram como afiliados.
      </p>
    </div>
  )
}
