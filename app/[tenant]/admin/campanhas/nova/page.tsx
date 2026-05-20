'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function NovaCampanha() {
  const { tenant } = useParams() as { tenant: string }
  const router = useRouter()
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    imagem_url: '',
    inicio_em: '',
    fim_em: '',
  })
  const [recompensas, setRecompensas] = useState([
    { min_indicacoes: 5, titulo: '', descricao: '' },
  ])
  const [erro, setErro] = useState('')

  function setField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function setRecompensa(i: number, field: string, value: string | number) {
    setRecompensas(r => r.map((x, idx) => idx === i ? { ...x, [field]: value } : x))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const res = await fetch(`/api/${tenant}/campanhas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, recompensas }),
    })

    if (res.ok) {
      router.push(`/${tenant}/admin/campanhas`)
    } else {
      const data = await res.json()
      setErro(data.erro || 'Erro ao criar campanha')
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Nova campanha</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-zinc-100 p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-zinc-900">Informações</h2>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">Título</label>
            <input
              value={form.titulo}
              onChange={e => setField('titulo', e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              required
            />
          </div>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={e => setField('descricao', e.target.value)}
              rows={3}
              className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-500 mb-1 block">URL da imagem (opcional)</label>
            <input
              value={form.imagem_url}
              onChange={e => setField('imagem_url', e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              type="url"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-500 mb-1 block">Início</label>
              <input
                type="datetime-local"
                value={form.inicio_em}
                onChange={e => setField('inicio_em', e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-500 mb-1 block">Fim</label>
              <input
                type="datetime-local"
                value={form.fim_em}
                onChange={e => setField('fim_em', e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-100 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Recompensas</h2>
            <button
              type="button"
              onClick={() => setRecompensas(r => [...r, { min_indicacoes: 0, titulo: '', descricao: '' }])}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              + Adicionar faixa
            </button>
          </div>
          {recompensas.map((r, i) => (
            <div key={i} className="flex gap-3 items-start border-t border-zinc-50 pt-4">
              <div className="w-24 shrink-0">
                <label className="text-xs text-zinc-400 mb-1 block">Mín. indicações</label>
                <input
                  type="number"
                  value={r.min_indicacoes}
                  onChange={e => setRecompensa(i, 'min_indicacoes', parseInt(e.target.value))}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  min={1}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-400 mb-1 block">Título da recompensa</label>
                <input
                  value={r.titulo}
                  onChange={e => setRecompensa(i, 'titulo', e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  placeholder="Ex: E-book grátis"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setRecompensas(r => r.filter((_, idx) => idx !== i))}
                className="mt-5 text-zinc-300 hover:text-red-400 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {erro && <p className="text-red-500 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-zinc-900 text-white rounded-lg py-2.5 px-5 text-sm font-medium hover:bg-zinc-700 transition"
          >
            Criar campanha
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-zinc-200 text-zinc-600 rounded-lg py-2.5 px-5 text-sm hover:bg-zinc-50 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
