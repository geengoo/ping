'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ConvidarModal() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nomeContato, setNomeContato] = useState('')
  const [email, setEmail] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  function abrir() { setAberto(true); setSucesso(false); setErro('') }
  function fechar() {
    setAberto(false)
    setNomeContato(''); setEmail(''); setNomeFantasia('')
    setErro(''); setSucesso(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/admin/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nomeContato, nomeFantasia }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErro(data.erro || 'Erro ao enviar convite')
        return
      }
      setSucesso(true)
      setTimeout(() => { fechar(); router.refresh() }, 1500)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
      >
        + Convidar parceiro
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={fechar} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Convidar parceiro</h2>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-500">O convidado receberá um email com link para completar o cadastro.</p>

            {sucesso ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                Convite enviado com sucesso.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome do contato *</label>
                  <input
                    required
                    value={nomeContato}
                    onChange={e => setNomeContato(e.target.value)}
                    placeholder="João Silva"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="joao@empresa.com"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome fantasia da empresa *</label>
                  <input
                    required
                    value={nomeFantasia}
                    onChange={e => setNomeFantasia(e.target.value)}
                    placeholder="Acme"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                {erro && <p className="text-red-500 text-sm">{erro}</p>}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={fechar}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="flex-1 bg-[#374151] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {enviando ? 'Enviando...' : 'Enviar convite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
