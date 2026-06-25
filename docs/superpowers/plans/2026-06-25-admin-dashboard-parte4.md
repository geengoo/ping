# Painel Superadmin — Implementação (Parte 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o painel web do superadmin — login dedicado, sidebar, e 5 seções (dashboard, parceiros CRUD + API key, conversões, saques, webhooks) com visão cross-partner.

**Architecture:** Server Components lendo Prisma direto, Server Actions para mutações. Auth reutiliza `web/lib/auth.ts` (`getSessao()`, cookie `ping_token`) e as rotas `/api/auth/request` e `/api/auth/verify` já existentes. Sem novo backend.

**Tech Stack:** Next.js 16, Tailwind v4, Prisma 7, nanoid, Lucide React

## Global Constraints

- Next.js 16: `params` e `searchParams` são `Promise<{...}>` — sempre `await`
- Next.js 16: middleware entry point é `proxy.ts` (não `middleware.ts`)
- Tailwind v4: tokens via `@theme` no `globals.css` — já configurado
- Cookie do admin: `ping_token` (mesmo do afiliado — reutiliza `web/lib/auth.ts`)
- `getSessao()` retorna `Sessao { contaId, email, papeis }` — verificar `papeis.includes('superadmin')`
- Sidebar item ativo: `bg-[#374151] text-white`, inativo: `text-gray-500 hover:bg-gray-50`
- Cards: `bg-white border border-gray-200 rounded-xl shadow-sm`
- Fundo: `bg-[#f8f9fa]`
- Projeto em `/root/Projetos/geengoo/ping/web`
- `nanoid` já instalado em `web/package.json`
- Sem testes automatizados para UI — verificar com `npx tsc --noEmit`

---

## Estrutura de Arquivos

```
web/
  app/
    admin/
      login/page.tsx                           CREATE — formulário email
      login/verificar/page.tsx                 CREATE — código 6 dígitos
      (protected)/
        layout.tsx                             CREATE — verifica sessão superadmin + sidebar
        dashboard/page.tsx                     CREATE — 4 cards globais
        parceiros/
          page.tsx                             CREATE — lista parceiros
          novo/page.tsx                        CREATE — criar parceiro + campanha
          [id]/page.tsx                        CREATE — detalhe + editar + API key
          [id]/campanha/[cid]/page.tsx         CREATE — editar campanha
        conversoes/
          page.tsx                             CREATE — cross-partner paginada
          [id]/page.tsx                        CREATE — detalhe
        saques/page.tsx                        CREATE — cross-partner + confirmar
        webhooks/page.tsx                      CREATE — cross-partner + reenviar
    api/
      auth/
        verify/route.ts                        MODIFY — redirecionar superadmin para /admin/dashboard
        logout/route.ts                        CREATE — limpar cookie ping_token
  components/
    admin/
      Sidebar.tsx                              CREATE — sidebar admin
```

---

## Task 1: Auth — Login Dedicado para Admin

**Files:**
- Create: `web/app/admin/login/page.tsx`
- Create: `web/app/admin/login/verificar/page.tsx`
- Create: `web/app/api/auth/logout/route.ts`
- Modify: `web/app/api/auth/verify/route.ts`

**Interfaces:**
- Produz: páginas de login que usam as rotas `/api/auth/request` e `/api/auth/verify` existentes
- Produz: `POST /api/auth/logout` — limpa cookie `ping_token`

- [ ] **Step 1: Criar `web/app/admin/login/page.tsx`**

```typescript
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
```

- [ ] **Step 2: Criar `web/app/admin/login/verificar/page.tsx`**

```typescript
'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function VerificarForm() {
  const params = useSearchParams()
  const email = params.get('email') || ''
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo }),
    })
    if (!res.ok) {
      setErro('Código inválido ou expirado.')
      setLoading(false)
    }
    // redirect handled server-side
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ping admin</p>
        <h1 className="text-2xl font-bold mb-2">Confirme seu código</h1>
        <p className="text-gray-500 mb-8 text-sm">Enviamos para <strong>{email}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-[#374151]"
          />
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={loading || codigo.length < 6}
            className="w-full bg-[#374151] text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function VerificarPage() {
  return <Suspense><VerificarForm /></Suspense>
}
```

- [ ] **Step 3: Modificar `web/app/api/auth/verify/route.ts` — redirecionar superadmin para `/admin/dashboard`**

Substitua a linha:
```typescript
const redirectTo = isSuperadmin ? '/admin' : `/a/${await getCodigoAfiliado(conta.id)}`
```
Por:
```typescript
const redirectTo = isSuperadmin ? '/admin/dashboard' : `/a/${await getCodigoAfiliado(conta.id)}`
```

- [ ] **Step 4: Criar `web/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('ping_token', '', { maxAge: 0, path: '/' })
  return res
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

Expected: vazio (sem erros).

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/login/ web/app/api/auth/logout/ web/app/api/auth/verify/route.ts
git commit -m "feat: login dedicado para admin e logout route"
```

---

## Task 2: Layout + Sidebar Admin

**Files:**
- Create: `web/components/admin/Sidebar.tsx`
- Create: `web/app/admin/(protected)/layout.tsx`

**Interfaces:**
- Consome: `getSessao()` de `@/lib/auth`
- Produz: `<AdminLayout>` — wrapper que verifica `papeis.includes('superadmin')` e renderiza sidebar

- [ ] **Step 1: Criar `web/components/admin/Sidebar.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, ArrowLeftRight, Wallet, Webhook, LogOut } from 'lucide-react'

const NAV = [
  { label: 'Dashboard',  href: '/admin/dashboard',   icon: <LayoutDashboard size={16} /> },
  { label: 'Parceiros',  href: '/admin/parceiros',    icon: <Building2 size={16} /> },
  { label: 'Conversões', href: '/admin/conversoes',   icon: <ArrowLeftRight size={16} /> },
  { label: 'Saques',     href: '/admin/saques',       icon: <Wallet size={16} /> },
  { label: 'Webhooks',   href: '/admin/webhooks',     icon: <Webhook size={16} /> },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white px-3 py-4">
      <div className="px-2 mb-6">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ping</span>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">admin</p>
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ label, href, icon }) => {
          const ativo = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                ativo ? 'bg-[#374151] text-white font-medium' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors w-full"
      >
        <LogOut size={16} />
        Sair
      </button>
    </aside>
  )
}
```

- [ ] **Step 2: Criar `web/app/admin/(protected)/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { getSessao } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/components/admin/ web/app/admin/'(protected)'/layout.tsx
git commit -m "feat: sidebar e layout protegido do admin"
```

---

## Task 3: Dashboard

**Files:**
- Create: `web/app/admin/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Criar `web/app/admin/(protected)/dashboard/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AdminDashboardPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const [parceirosAtivos, conversoesMes, saquesSolicitados] = await Promise.all([
    prisma.parceiro.count({ where: { status: 'ativo' } }),
    prisma.conversao.count({ where: { criadoEm: { gte: inicioMes } } }),
    prisma.reward.findMany({
      where: { status: 'solicitado' },
      select: { valorCentavos: true, solicitadoEm: true },
    }),
  ])

  const totalPagar = saquesSolicitados.reduce((s, r) => s + r.valorCentavos, 0)
  const saquesAtrasados = saquesSolicitados.filter(r => r.solicitadoEm && diasDesde(r.solicitadoEm) > 5).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card titulo="Parceiros ativos" valor={String(parceirosAtivos)} />
        <Card titulo="Conversões este mês" valor={String(conversoesMes)} />
        <Card titulo="Total a pagar" valor={fmt(totalPagar)} />
        <Card titulo="Saques atrasados" valor={String(saquesAtrasados)} destaque={saquesAtrasados > 0} />
      </div>
    </div>
  )
}

function Card({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <p className="text-xs text-gray-400 font-medium mb-1">{titulo}</p>
      <p className={`text-2xl font-display font-bold ${destaque ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/'(protected)'/dashboard/
git commit -m "feat: dashboard admin — 4 cards globais"
```

---

## Task 4: Parceiros — Lista + Criar

**Files:**
- Create: `web/app/admin/(protected)/parceiros/page.tsx`
- Create: `web/app/admin/(protected)/parceiros/novo/page.tsx`

- [ ] **Step 1: Criar `web/app/admin/(protected)/parceiros/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function mascaraApiKey(key: string) {
  return '••••••••' + key.slice(-4)
}

export default async function ParceirosPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const parceiros = await prisma.parceiro.findMany({
    orderBy: { criadoEm: 'desc' },
    include: {
      campanhas: { where: { status: 'ativa' }, select: { id: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-gray-900">Parceiros</h1>
        <Link href="/admin/parceiros/novo" className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
          Novo parceiro
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Nome</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">API Key</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Campanhas ativas</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {parceiros.map(p => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/admin/parceiros/${p.id}`} className="text-gray-700 hover:text-[#374151] font-medium">
                    {p.nomeFantasia || p.razaoSocial || '—'}
                  </Link>
                </td>
                <td className="px-6 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-6 py-3 font-mono text-xs text-gray-500">{mascaraApiKey(p.apiKey)}</td>
                <td className="px-6 py-3 text-right text-gray-700">{p.campanhas.length}</td>
                <td className="px-6 py-3 text-gray-500">{p.criadoEm.toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {parceiros.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum parceiro ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    ativo: 'bg-green-50 text-green-700',
    inativo: 'bg-gray-100 text-gray-500',
    suspenso: 'bg-red-50 text-red-600',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}
```

- [ ] **Step 2: Criar `web/app/admin/(protected)/parceiros/novo/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'

export default async function NovoParceiro() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  async function criar(formData: FormData) {
    'use server'
    const sessaoAtual = await getSessao()
    if (!sessaoAtual?.papeis.includes('superadmin')) return

    const email = formData.get('email') as string
    const nomeFantasia = formData.get('nomeFantasia') as string
    const razaoSocial = formData.get('razaoSocial') as string || null
    const cnpj = formData.get('cnpj') as string || null
    const webhookUrl = formData.get('webhookUrl') as string || null
    const nomeCampanha = formData.get('nomeCampanha') as string
    const recompensaTipo = formData.get('recompensaTipo') as string
    const recompensaValorCentavos = parseInt(formData.get('recompensaValorCentavos') as string, 10)
    const janelaCancelamentoDias = parseInt(formData.get('janelaCancelamentoDias') as string, 10) || 30
    const diaPagamento = parseInt(formData.get('diaPagamento') as string, 10) || 5

    let conta = await prisma.conta.findUnique({ where: { email } })
    if (!conta) {
      conta = await prisma.conta.create({ data: { email, nome: nomeFantasia, papeis: [] } })
    }

    const existente = await prisma.parceiro.findUnique({ where: { contaId: conta.id } })
    if (existente) redirect(`/admin/parceiros/${existente.id}?erro=ja-existe`)

    const apiKey = nanoid(32)

    const parceiro = await prisma.parceiro.create({
      data: {
        contaId: conta.id,
        nomeFantasia,
        razaoSocial,
        cnpj,
        webhookUrl,
        apiKey,
        campanhas: {
          create: {
            nome: nomeCampanha,
            recompensaTipo,
            recompensaValorCentavos,
            janelaCancelamentoDias,
            diaPagamento,
            tiposCompraElegiveis: [],
            atribuicao: 'last-touch',
          },
        },
      },
    })

    redirect(`/admin/parceiros/${parceiro.id}?apikey=${apiKey}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Novo parceiro</h1>

      <form action={criar} className="space-y-6">
        <Section titulo="Dados do parceiro">
          <Field label="Email da conta *" name="email" type="email" required placeholder="parceiro@empresa.com" />
          <Field label="Nome fantasia *" name="nomeFantasia" required placeholder="Acme" />
          <Field label="Razão social" name="razaoSocial" placeholder="Acme Ltda." />
          <Field label="CNPJ" name="cnpj" placeholder="00.000.000/0001-00" />
          <Field label="Webhook URL" name="webhookUrl" placeholder="https://app.empresa.com/webhooks/ping" />
        </Section>

        <Section titulo="Campanha inicial">
          <Field label="Nome da campanha *" name="nomeCampanha" required placeholder="Programa de indicações" />
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Tipo de recompensa *</label>
            <select name="recompensaTipo" required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]">
              <option value="fixo">Fixo (valor em centavos)</option>
              <option value="percentual">Percentual</option>
            </select>
          </div>
          <Field label="Valor da recompensa (centavos) *" name="recompensaValorCentavos" type="number" required placeholder="5000 = R$50,00" />
          <Field label="Janela de cancelamento (dias)" name="janelaCancelamentoDias" type="number" placeholder="30" />
          <Field label="Dia de pagamento" name="diaPagamento" type="number" placeholder="5" />
        </Section>

        <button type="submit" className="px-6 py-3 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
          Criar parceiro
        </button>
      </form>
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">{titulo}</h2>
      {children}
    </div>
  )
}

function Field({ label, name, type = 'text', required, placeholder }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
      />
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/'(protected)'/parceiros/
git commit -m "feat: lista de parceiros e formulário de criação"
```

---

## Task 5: Parceiros — Detalhe + Editar + API Key + Campanha

**Files:**
- Create: `web/app/admin/(protected)/parceiros/[id]/page.tsx`
- Create: `web/app/admin/(protected)/parceiros/[id]/campanha/[cid]/page.tsx`

- [ ] **Step 1: Criar `web/app/admin/(protected)/parceiros/[id]/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'nanoid'
import Link from 'next/link'

export default async function ParceiroDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ apikey?: string; erro?: string }>
}) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const { id } = await params
  const { apikey, erro } = await searchParams

  const parceiro = await prisma.parceiro.findUnique({
    where: { id },
    include: { campanhas: { orderBy: { criadoEm: 'desc' } } },
  })
  if (!parceiro) notFound()

  async function salvar(formData: FormData) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return
    await prisma.parceiro.update({
      where: { id },
      data: {
        nomeFantasia: formData.get('nomeFantasia') as string || null,
        razaoSocial: formData.get('razaoSocial') as string || null,
        cnpj: formData.get('cnpj') as string || null,
        webhookUrl: formData.get('webhookUrl') as string || null,
        status: formData.get('status') as string,
      },
    })
    revalidatePath(`/admin/parceiros/${id}`)
  }

  async function revogarApiKey() {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return
    const novaChave = nanoid(32)
    await prisma.parceiro.update({ where: { id }, data: { apiKey: novaChave } })
    redirect(`/admin/parceiros/${id}?apikey=${novaChave}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/parceiros" className="text-gray-400 hover:text-gray-600 text-sm">← Parceiros</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">
          {parceiro.nomeFantasia || parceiro.razaoSocial || 'Parceiro'}
        </h1>
      </div>

      {erro === 'ja-existe' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Este email já tem um parceiro associado.
        </div>
      )}

      {apikey && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <p className="font-semibold mb-1">API Key gerada — salve agora, não será exibida novamente:</p>
          <code className="font-mono break-all">{apikey}</code>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 mb-4">Dados</h2>
        <form action={salvar} className="space-y-4">
          {[
            { label: 'Nome fantasia', name: 'nomeFantasia', value: parceiro.nomeFantasia || '' },
            { label: 'Razão social', name: 'razaoSocial', value: parceiro.razaoSocial || '' },
            { label: 'CNPJ', name: 'cnpj', value: parceiro.cnpj || '' },
            { label: 'Webhook URL', name: 'webhookUrl', value: parceiro.webhookUrl || '' },
          ].map(({ label, name, value }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <input
                type="text"
                name={name}
                defaultValue={value}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
            <select name="status" defaultValue={parceiro.status} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]">
              <option value="ativo">ativo</option>
              <option value="inativo">inativo</option>
              <option value="suspenso">suspenso</option>
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
            Salvar
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 mb-4">API Key</h2>
        <p className="text-sm text-gray-500 mb-3">
          Atual: <code className="font-mono text-gray-700">{'••••••••' + parceiro.apiKey.slice(-4)}</code>
        </p>
        <form action={revogarApiKey}>
          <button type="submit" className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
            Revogar e gerar nova API key
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Campanhas</h2>
          <Link href={`/admin/parceiros/${id}/campanha/nova`} className="text-xs text-[#374151] hover:underline">+ nova campanha</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Nome</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Recompensa</th>
            </tr>
          </thead>
          <tbody>
            {parceiro.campanhas.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <Link href={`/admin/parceiros/${id}/campanha/${c.id}`} className="text-gray-700 hover:text-[#374151]">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-6 py-3 text-gray-500">{c.status}</td>
                <td className="px-6 py-3 text-right text-gray-700">
                  {c.recompensaTipo} — {(c.recompensaValorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `web/app/admin/(protected)/parceiros/[id]/campanha/[cid]/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export default async function EditarCampanhaPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>
}) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const { id, cid } = await params

  const campanha = await prisma.campanha.findFirst({ where: { id: cid, parceiroId: id } })
  if (!campanha) notFound()

  async function salvar(formData: FormData) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return
    await prisma.campanha.update({
      where: { id: cid },
      data: {
        nome: formData.get('nome') as string,
        status: formData.get('status') as string,
        recompensaTipo: formData.get('recompensaTipo') as string,
        recompensaValorCentavos: parseInt(formData.get('recompensaValorCentavos') as string, 10),
        janelaCancelamentoDias: parseInt(formData.get('janelaCancelamentoDias') as string, 10),
        diaPagamento: parseInt(formData.get('diaPagamento') as string, 10),
        atribuicao: formData.get('atribuicao') as string,
      },
    })
    revalidatePath(`/admin/parceiros/${id}`)
    redirect(`/admin/parceiros/${id}`)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/parceiros/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Parceiro</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Editar campanha</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <form action={salvar} className="space-y-4">
          {[
            { label: 'Nome', name: 'nome', value: campanha.nome },
          ].map(({ label, name, value }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <input type="text" name={name} defaultValue={value} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]" />
            </div>
          ))}
          {[
            { label: 'Status', name: 'status', value: campanha.status, opts: ['ativa', 'inativa'] },
            { label: 'Tipo de recompensa', name: 'recompensaTipo', value: campanha.recompensaTipo, opts: ['fixo', 'percentual'] },
            { label: 'Atribuição', name: 'atribuicao', value: campanha.atribuicao, opts: ['last-touch', 'first-touch'] },
          ].map(({ label, name, value, opts }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <select name={name} defaultValue={value} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]">
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {[
            { label: 'Valor da recompensa (centavos)', name: 'recompensaValorCentavos', value: campanha.recompensaValorCentavos },
            { label: 'Janela de cancelamento (dias)', name: 'janelaCancelamentoDias', value: campanha.janelaCancelamentoDias },
            { label: 'Dia de pagamento', name: 'diaPagamento', value: campanha.diaPagamento },
          ].map(({ label, name, value }) => (
            <div key={name}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
              <input type="number" name={name} defaultValue={value} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]" />
            </div>
          ))}
          <button type="submit" className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
            Salvar campanha
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/'(protected)'/parceiros/
git commit -m "feat: detalhe/editar parceiro, revogar API key, editar campanha"
```

---

## Task 6: Conversões

**Files:**
- Create: `web/app/admin/(protected)/conversoes/page.tsx`
- Create: `web/app/admin/(protected)/conversoes/[id]/page.tsx`

- [ ] **Step 1: Criar `web/app/admin/(protected)/conversoes/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_OPTS = ['todos', 'pendente', 'confirmada', 'cancelada']
const PERIODO_OPTS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminConversoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; parceiro?: string; pagina?: string }>
}) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const p = await searchParams
  const status = p.status || 'todos'
  const periodo = p.periodo || '30d'
  const parceiroId = p.parceiro || ''
  const pagina = Math.max(1, Number(p.pagina || '1') || 1)
  const POR_PAGINA = 20

  const diasAtras = PERIODO_OPTS[periodo] || 30
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)

  const where = {
    criadoEm: { gte: desde },
    ...(status !== 'todos' ? { status } : {}),
    ...(parceiroId ? { participacao: { campanha: { parceiroId } } } : {}),
  }

  const [total, conversoes, parceiros] = await Promise.all([
    prisma.conversao.count({ where }),
    prisma.conversao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        participacao: {
          include: {
            afiliado: { select: { nome: true } },
            campanha: { include: { parceiro: { select: { nomeFantasia: true, razaoSocial: true } } } },
          },
        },
      },
    }),
    prisma.parceiro.findMany({ select: { id: true, nomeFantasia: true, razaoSocial: true }, orderBy: { criadoEm: 'desc' } }),
  ])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  function url(extra: Record<string, string>) {
    const q = new URLSearchParams({ status, periodo, parceiro: parceiroId, pagina: String(pagina), ...extra })
    return `/admin/conversoes?${q}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Conversões</h1>

      <div className="flex gap-2 flex-wrap items-center">
        {STATUS_OPTS.map(s => (
          <Link key={s} href={url({ status: s, pagina: '1' })}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${status === s ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {s === 'todos' ? 'Todos' : s}
          </Link>
        ))}
        <select
          value={parceiroId}
          onChange={() => {}}
          className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 outline-none"
          aria-label="Filtrar por parceiro"
        >
          <option value="">Todos os parceiros</option>
          {parceiros.map(p => (
            <option key={p.id} value={p.id}>{p.nomeFantasia || p.razaoSocial}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {Object.keys(PERIODO_OPTS).map(per => (
            <Link key={per} href={url({ periodo: per, pagina: '1' })}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${periodo === per ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {per}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Parceiro</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Produto</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {conversoes.map(c => {
              const nomeParceiro = c.participacao.campanha.parceiro.nomeFantasia || c.participacao.campanha.parceiro.razaoSocial || '—'
              return (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-500">{c.criadoEm.toLocaleDateString('pt-BR')}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-600 text-xs">{nomeParceiro}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-700">{c.participacao.afiliado.nome}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-700">{c.produtoNome}</Link></td>
                  <td className="px-6 py-3 text-right"><Link href={`/admin/conversoes/${c.id}`} className="block text-gray-700">{fmt(c.valorCentavos)}</Link></td>
                  <td className="px-6 py-3"><Link href={`/admin/conversoes/${c.id}`} className="block"><StatusBadge status={c.status} /></Link></td>
                </tr>
              )
            })}
            {conversoes.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma conversão encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} resultados</span>
          <div className="flex gap-2">
            {pagina > 1 && <Link href={url({ pagina: String(pagina - 1) })} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">← Anterior</Link>}
            <span className="px-3 py-1.5 text-gray-700">{pagina} / {totalPaginas}</span>
            {pagina < totalPaginas && <Link href={url({ pagina: String(pagina + 1) })} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Próxima →</Link>}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    pendente: 'bg-yellow-50 text-yellow-700',
    confirmada: 'bg-green-50 text-green-700',
    cancelada: 'bg-red-50 text-red-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}
```

- [ ] **Step 2: Criar `web/app/admin/(protected)/conversoes/[id]/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminConversaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const { id } = await params

  const conversao = await prisma.conversao.findUnique({
    where: { id },
    include: {
      participacao: {
        include: {
          afiliado: { select: { nome: true, email: true } },
          campanha: { include: { parceiro: { select: { nomeFantasia: true, razaoSocial: true } } } },
        },
      },
      reward: true,
    },
  })

  if (!conversao) notFound()

  const nomeParceiro = conversao.participacao.campanha.parceiro.nomeFantasia || conversao.participacao.campanha.parceiro.razaoSocial || '—'

  const linhas = [
    ['ID', conversao.id],
    ['Parceiro', nomeParceiro],
    ['Pedido externo', conversao.pedidoIdExterno],
    ['Email convidado', conversao.emailConvidado],
    ['Produto', conversao.produtoNome],
    ['Valor', fmt(conversao.valorCentavos)],
    ['Tipo compra', conversao.tipoCompra],
    ['Status', conversao.status],
    ['Motivo cancelamento', conversao.motivoCancelamento || '—'],
    ['Criado em', conversao.criadoEm.toLocaleString('pt-BR')],
    ['Confirmado em', conversao.confirmadoEm?.toLocaleString('pt-BR') || '—'],
    ['Afiliado', conversao.participacao.afiliado.nome],
    ['Email afiliado', conversao.participacao.afiliado.email],
  ]

  const rewardLinhas = conversao.reward ? [
    ['Reward ID', conversao.reward.id],
    ['Valor reward', fmt(conversao.reward.valorCentavos)],
    ['Status reward', conversao.reward.status],
    ['Disponível em', conversao.reward.disponivelEm?.toLocaleString('pt-BR') || '—'],
    ['Solicitado em', conversao.reward.solicitadoEm?.toLocaleString('pt-BR') || '—'],
    ['Pago em', conversao.reward.pagoEm?.toLocaleString('pt-BR') || '—'],
  ] : []

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/conversoes" className="text-gray-400 hover:text-gray-600 text-sm">← Conversões</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Detalhe da conversão</h1>
      </div>
      <Section titulo="Conversão" linhas={linhas} />
      {conversao.reward && <Section titulo="Reward" linhas={rewardLinhas} />}
    </div>
  )
}

function Section({ titulo, linhas }: { titulo: string; linhas: string[][] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">{titulo}</h2>
      </div>
      <dl className="divide-y divide-gray-100">
        {linhas.map(([k, v]) => (
          <div key={k} className="px-6 py-3 flex gap-4">
            <dt className="text-xs text-gray-400 w-36 shrink-0 pt-0.5">{k}</dt>
            <dd className="text-sm text-gray-700 break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/'(protected)'/conversoes/
git commit -m "feat: conversões cross-partner com filtros e detalhe"
```

---

## Task 7: Saques

**Files:**
- Create: `web/app/admin/(protected)/saques/page.tsx`

- [ ] **Step 1: Criar `web/app/admin/(protected)/saques/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AdminSaquesPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const rewards = await prisma.reward.findMany({
    where: { status: 'solicitado' },
    orderBy: { solicitadoEm: 'asc' },
    include: {
      participacao: {
        include: {
          afiliado: { select: { nome: true } },
          campanha: {
            include: { parceiro: { select: { id: true, nomeFantasia: true, razaoSocial: true, apiKey: true } } },
          },
        },
      },
    },
  })

  async function confirmarPagamento(rewardId: string) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId, status: 'solicitado' },
      include: { participacao: { include: { campanha: { include: { parceiro: { select: { apiKey: true } } } } } } },
    })
    if (!reward) return

    await fetch(`${process.env.API_BASE_URL}/v1/payouts/${rewardId}/confirm`, {
      method: 'POST',
      headers: { 'X-API-Key': reward.participacao.campanha.parceiro.apiKey },
    })

    revalidatePath('/admin/saques')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Saques pendentes</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Parceiro</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Chave PIX</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Aguardando</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rewards.map(r => {
              const dias = r.solicitadoEm ? diasDesde(r.solicitadoEm) : 0
              const atrasado = dias > 5
              const nomeParceiro = r.participacao.campanha.parceiro.nomeFantasia || r.participacao.campanha.parceiro.razaoSocial || '—'
              return (
                <tr key={r.id} className={`border-b border-gray-50 last:border-0 ${atrasado ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-3 text-gray-600 text-xs">{nomeParceiro}</td>
                  <td className="px-6 py-3 text-gray-700">{r.participacao.afiliado.nome}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{r.participacao.chavePix || '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-700 font-medium">{fmt(r.valorCentavos)}</td>
                  <td className={`px-6 py-3 text-sm ${atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {dias === 0 ? 'hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}{atrasado && ' ⚠️'}
                  </td>
                  <td className="px-6 py-3">
                    <form action={confirmarPagamento.bind(null, r.id)}>
                      <button type="submit" className="px-3 py-1.5 bg-[#374151] text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors">
                        Confirmar
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {rewards.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum saque pendente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/'(protected)'/saques/
git commit -m "feat: saques cross-partner com confirmar pagamento"
```

---

## Task 8: Webhooks + Deploy

**Files:**
- Create: `web/app/admin/(protected)/webhooks/page.tsx`

- [ ] **Step 1: Criar `web/app/admin/(protected)/webhooks/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export default async function AdminWebhooksPage() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  const logs = await prisma.webhookLog.findMany({
    orderBy: { criadoEm: 'desc' },
    take: 200,
    include: { parceiro: { select: { nomeFantasia: true, razaoSocial: true } } },
  })

  async function reenviar(logId: string) {
    'use server'
    const s = await getSessao()
    if (!s?.papeis.includes('superadmin')) return
    await prisma.webhookLog.update({
      where: { id: logId },
      data: { tentativas: 0, tentadoEm: null },
    })
    revalidatePath('/admin/webhooks')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Webhooks</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Parceiro</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Evento</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Tentativas</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const nomeParceiro = log.parceiro.nomeFantasia || log.parceiro.razaoSocial || '—'
              return (
                <tr key={log.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{log.criadoEm.toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-3 text-gray-600 text-xs">{nomeParceiro}</td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{log.evento}</span>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">{log.tentativas}</td>
                  <td className="px-6 py-3">
                    {log.sucesso
                      ? <span className="text-green-600 font-medium">✓ Sucesso</span>
                      : <span className="text-red-500">✗ Falhou</span>
                    }
                  </td>
                  <td className="px-6 py-3">
                    {!log.sucesso && log.tentativas < 4 && (
                      <form action={reenviar.bind(null, log.id)}>
                        <button type="submit" className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                          Reenviar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum webhook ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 3: Rodar deploy**

```bash
cd /root/Projetos/geengoo/ping && ./deploy.sh
```

Expected: build sem erros, 21+ rotas geradas, PM2 reload.

- [ ] **Step 4: Verificar PM2**

```bash
pm2 logs ping-web --lines 10 --nostream
```

Expected: `✓ Ready in Xms`

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/'(protected)'/webhooks/
git commit -m "feat: webhooks cross-partner com reenviar"
```

- [ ] **Step 6: Push**

```bash
cd /root/Projetos/geengoo/ping && git push origin main
```
