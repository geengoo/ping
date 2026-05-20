'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Participante {
  nome: string
  codigo: string
  total_indicacoes: number
  campanha_titulo: string
  tenant_slug: string
  campanha_slug: string
}

interface Recompensa {
  min_indicacoes: number
  titulo: string
  descricao: string
}

export default function DashboardIndicador() {
  const { codigo } = useParams() as { codigo: string }
  const [data, setData] = useState<{ participante: Participante; recompensas: Recompensa[] } | null>(null)

  useEffect(() => {
    fetch(`/api/participantes/${codigo}`)
      .then(r => r.json())
      .then(setData)
  }, [codigo])

  if (!data) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Carregando...</div>

  const { participante, recompensas } = data
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const link = `${baseUrl}/${participante.tenant_slug}/${participante.campanha_slug}?ref=${participante.codigo}`
  const total = participante.total_indicacoes

  const proxima = recompensas.find(r => r.min_indicacoes > total)
  const desbloqueadas = recompensas.filter(r => r.min_indicacoes <= total)

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Olá, {participante.nome}!</h1>
        <p className="text-zinc-400 text-sm mb-8">{participante.campanha_titulo}</p>

        <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
          <p className="text-sm text-zinc-500 mb-1">Suas indicações</p>
          <p className="text-5xl font-bold text-zinc-900">{total}</p>
          {proxima && (
            <p className="text-sm text-zinc-400 mt-2">
              Faltam <strong className="text-zinc-700">{proxima.min_indicacoes - total}</strong> para: {proxima.titulo}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
          <p className="text-xs text-zinc-400 mb-2">Seu link de indicação</p>
          <p className="font-mono text-sm text-zinc-900 break-all mb-3">{link}</p>
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="w-full bg-zinc-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-zinc-700 transition"
          >
            Copiar link
          </button>
        </div>

        {recompensas.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-6">
            <h3 className="text-sm font-semibold text-zinc-700 mb-4">Recompensas</h3>
            <div className="flex flex-col gap-3">
              {recompensas.map((r, i) => {
                const desbloqueada = r.min_indicacoes <= total
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${desbloqueada ? 'bg-green-50 border border-green-100' : 'bg-zinc-50'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${desbloqueada ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                      {desbloqueada ? '✓' : r.min_indicacoes}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${desbloqueada ? 'text-green-800' : 'text-zinc-500'}`}>{r.titulo}</p>
                      {r.descricao && <p className="text-xs text-zinc-400">{r.descricao}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
