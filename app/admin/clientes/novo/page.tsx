'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NovoCliente() {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', slug: '' })
  const [erro, setErro] = useState('')
  const router = useRouter()

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      router.push('/admin/clientes')
    } else {
      const data = await res.json()
      setErro(data.erro || 'Erro ao criar cliente')
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Novo cliente</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-100 p-6 flex flex-col gap-4">
        <div>
          <label className="text-sm text-zinc-500 mb-1 block">Nome da empresa</label>
          <input
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>
        <div>
          <label className="text-sm text-zinc-500 mb-1 block">Slug (ex: minhaempresa)</label>
          <input
            value={form.slug}
            onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="minhaempresa"
            required
          />
        </div>
        <div>
          <label className="text-sm text-zinc-500 mb-1 block">Email do admin</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>
        <div>
          <label className="text-sm text-zinc-500 mb-1 block">Senha inicial</label>
          <input
            type="password"
            value={form.senha}
            onChange={e => set('senha', e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>
        {erro && <p className="text-red-500 text-sm">{erro}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="bg-zinc-900 text-white rounded-lg py-2.5 px-5 text-sm font-medium hover:bg-zinc-700 transition"
          >
            Criar cliente
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
