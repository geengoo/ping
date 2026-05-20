'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface Recompensa {
  min_indicacoes: number
  titulo: string
  descricao: string
}

interface Campanha {
  id: number
  titulo: string
  descricao: string
  imagem_url: string
  recompensas: Recompensa[]
}

export default function LandingCampanha() {
  const { tenant, campanha } = useParams() as { tenant: string; campanha: string }
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')

  const [data, setData] = useState<Campanha | null>(null)
  const [form, setForm] = useState({ nome: '', email: '' })
  const [sucesso, setSucesso] = useState<{ codigo: string } | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/${tenant}/campanhas/${campanha}`)
      .then(r => r.json())
      .then(setData)
  }, [tenant, campanha])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const res = await fetch('/api/participantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        email: form.email,
        campanha_id: data?.id,
        codigo_indicador: ref,
      }),
    })

    setLoading(false)

    if (res.ok) {
      const d = await res.json()
      setSucesso(d)
    } else {
      const d = await res.json()
      setErro(d.erro || 'Erro ao cadastrar')
    }
  }

  if (!data) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Carregando...</div>

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''

  if (sucesso) {
    const link = `${baseUrl}/p/${sucesso.codigo}`
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Você está dentro!</h2>
          <p className="text-zinc-500 text-sm mb-6">Compartilhe seu link e acumule indicações.</p>
          <div className="bg-zinc-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-zinc-400 mb-1">Seu link de indicação</p>
            <p className="font-mono text-sm text-zinc-900 break-all">{link}</p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="w-full bg-zinc-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 transition"
          >
            Copiar link
          </button>
          <a
            href={`/p/${sucesso.codigo}`}
            className="block mt-3 text-sm text-zinc-400 hover:text-zinc-900"
          >
            Ver meu dashboard →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {data.imagem_url && (
        <div className="h-56 bg-zinc-200 overflow-hidden">
          <img src={data.imagem_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">{data.titulo}</h1>
        {data.descricao && <p className="text-zinc-500 mb-8">{data.descricao}</p>}

        {data.recompensas?.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3 uppercase tracking-wide">Recompensas</h3>
            <div className="flex flex-col gap-2">
              {data.recompensas.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-zinc-100">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-900 shrink-0">
                    {r.min_indicacoes}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 text-sm">{r.titulo}</p>
                    {r.descricao && <p className="text-xs text-zinc-400">{r.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-zinc-100 p-6">
          <h2 className="font-semibold text-zinc-900 mb-4">Quero participar</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Seu nome"
              className="border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              required
            />
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Seu email"
              className="border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              required
            />
            {erro && <p className="text-red-500 text-sm">{erro}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-zinc-700 transition disabled:opacity-50"
            >
              {loading ? 'Cadastrando...' : 'Entrar na lista'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
