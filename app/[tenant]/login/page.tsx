'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function LoginTenant() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const router = useRouter()
  const { tenant } = useParams() as { tenant: string }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const res = await fetch(`/api/${tenant}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    if (res.ok) {
      router.push(`/${tenant}/admin`)
    } else {
      const data = await res.json()
      setErro(data.erro || 'Credenciais inválidas')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-xl font-bold text-zinc-900 mb-2">Área do cliente</h1>
        <p className="text-sm text-zinc-400 mb-6">{tenant}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <button
            type="submit"
            className="bg-zinc-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-zinc-700 transition"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
