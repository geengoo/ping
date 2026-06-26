'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ParceiroLoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const onboardingOk = searchParams.get('onboarding') === 'ok'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const res = await fetch('/api/parceiro-auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (!res.ok) {
      setErro('Email não encontrado. Verifique com o suporte ping.')
      return
    }
    router.push(`/parceiro/login/verificar?email=${encodeURIComponent(email)}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">Acessar painel</h1>
        <p className="text-gray-500 mb-6 text-sm">Você receberá um código de 6 dígitos por email.</p>
        {onboardingOk && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-6">
            Cadastro concluído! Informe seu email para acessar o painel.
          </div>
        )}
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

export default function ParceiroLoginPage() {
  return (
    <Suspense>
      <ParceiroLoginForm />
    </Suspense>
  )
}
