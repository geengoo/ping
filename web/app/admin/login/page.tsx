'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const res = await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (!res.ok) {
      setErro('Email não encontrado.')
      return
    }
    router.push(`/admin/login/verificar?email=${encodeURIComponent(email)}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ping admin</p>
        <h1 className="text-2xl font-bold mb-2">Acessar painel</h1>
        <p className="text-gray-500 mb-8 text-sm">Código de acesso por email.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#374151] text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </main>
  )
}
