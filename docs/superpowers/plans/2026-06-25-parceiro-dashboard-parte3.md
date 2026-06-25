# Painel do Parceiro — Implementação (Parte 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o painel web do parceiro — login por magic link, sidebar, e 6 telas (dashboard, conversões, saques, afiliados, webhooks, configurações).

**Architecture:** Server Components lendo Prisma direto (sem API intermediária), exceto para ações de mutation (confirmar saque, reenviar webhook) que usam Server Actions chamando a ping-api. Auth via cookie httpOnly `ping_parceiro_token` com JWT, separado do cookie do afiliado.

**Tech Stack:** Next.js 16, Tailwind v4, Prisma 7 (`@prisma/adapter-pg`), jose (JWT), Lucide React (ícones)

## Global Constraints

- Next.js 16: `params` é `Promise<{...}>` — sempre `await params`
- Next.js 16: arquivo de middleware se chama `proxy.ts`, não `middleware.ts`
- Tailwind v4: usar `@theme` no globals.css para tokens, não `tailwind.config.js`
- Cookie do parceiro: `ping_parceiro_token` (separado do `ping_token` do afiliado)
- Accent color: `#374151` — definido em `@theme` como `--color-accent`
- Fontes: DM Sans (corpo) + Plus Jakarta Sans (títulos) via Google Fonts
- Cards: `bg-white border border-gray-200 rounded-xl shadow-sm`
- Sidebar item ativo: `bg-[#374151] text-white`, inativo: `text-gray-500 hover:bg-gray-50`
- Todas as queries Prisma filtram por `parceiroId` da sessão
- Projeto em `/root/Projetos/geengoo/ping/web`
- Não há testes automatizados para páginas UI — validar no browser com `npm run dev`

---

## Estrutura de Arquivos

```
web/
  app/
    globals.css                              MODIFY — adicionar @theme com fontes e accent
    parceiro/
      login/
        page.tsx                             CREATE — formulário de email
        verificar/page.tsx                   CREATE — código 6 dígitos
      (protected)/
        layout.tsx                           CREATE — verifica sessão + renderiza sidebar
        dashboard/page.tsx                   CREATE — 4 cards + últimas 10 conversões
        conversoes/
          page.tsx                           CREATE — lista paginada + filtros
          [id]/page.tsx                      CREATE — detalhe da conversão
        saques/page.tsx                      CREATE — lista + confirmar pagamento
        afiliados/page.tsx                   CREATE — lista de participações
        webhooks/page.tsx                    CREATE — log + reenviar
        configuracoes/page.tsx               CREATE — API key + campanha (leitura)
  components/
    parceiro/
      Sidebar.tsx                            CREATE — sidebar com 6 itens
  lib/
    parceiroAuth.ts                          CREATE — JWT + cookie helpers
  app/api/
    parceiro-auth/
      request/route.ts                       CREATE — solicitar código
      verify/route.ts                        CREATE — verificar código + setar cookie
  proxy.ts                                   MODIFY — adicionar rota /parceiro/*
```

---

## Task 1: Auth — Login por Magic Link

**Files:**
- Create: `web/lib/parceiroAuth.ts`
- Create: `web/app/api/parceiro-auth/request/route.ts`
- Create: `web/app/api/parceiro-auth/verify/route.ts`
- Create: `web/app/parceiro/login/page.tsx`
- Create: `web/app/parceiro/login/verificar/page.tsx`
- Modify: `web/proxy.ts`

**Interfaces:**
- Produz: `getSessaoParceiro(): Promise<SessaoParceiro | null>` — usado por todas as páginas protegidas

- [ ] **Step 1: Criar `web/lib/parceiroAuth.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
export const COOKIE_NAME = 'ping_parceiro_token'

export interface SessaoParceiro {
  parceiroId: string
  contaId: string
  email: string
}

export async function criarTokenParceiro(payload: SessaoParceiro): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verificarTokenParceiro(token: string): Promise<SessaoParceiro | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessaoParceiro
  } catch {
    return null
  }
}

export async function getSessaoParceiro(): Promise<SessaoParceiro | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  return verificarTokenParceiro(token)
}
```

- [ ] **Step 2: Criar `web/app/api/parceiro-auth/request/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarCodigoLogin } from '@/lib/resend'

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }
  if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 })

  const conta = await prisma.conta.findUnique({
    where: { email },
    include: { parceiro: true },
  })

  if (!conta?.parceiro) {
    return NextResponse.json({ error: 'nenhum parceiro associado a este email' }, { status: 404 })
  }

  await prisma.tokenAcesso.updateMany({
    where: { contaId: conta.id, usado: false },
    data: { usado: true },
  })

  const codigo = gerarCodigo()
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000)
  await prisma.tokenAcesso.create({ data: { contaId: conta.id, codigo, expiraEm } })

  await enviarCodigoLogin(email, codigo, process.env.NEXT_PUBLIC_BASE_URL || '')

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Criar `web/app/api/parceiro-auth/verify/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarTokenParceiro, COOKIE_NAME } from '@/lib/parceiroAuth'

export async function POST(req: NextRequest) {
  const { email, codigo } = await req.json() as { email?: string; codigo?: string }
  if (!email || !codigo) {
    return NextResponse.json({ error: 'email e código obrigatórios' }, { status: 400 })
  }

  const conta = await prisma.conta.findUnique({
    where: { email },
    include: { parceiro: true },
  })

  if (!conta?.parceiro) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 401 })
  }

  const token = await prisma.tokenAcesso.findFirst({
    where: { contaId: conta.id, codigo, usado: false, expiraEm: { gt: new Date() } },
  })

  if (!token) return NextResponse.json({ error: 'código inválido ou expirado' }, { status: 401 })

  await prisma.tokenAcesso.update({ where: { id: token.id }, data: { usado: true } })

  const jwt = await criarTokenParceiro({
    parceiroId: conta.parceiro.id,
    contaId: conta.id,
    email: conta.email,
  })

  const res = NextResponse.redirect(new URL('/parceiro/dashboard', req.url))
  res.cookies.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
```

- [ ] **Step 4: Criar `web/app/parceiro/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ParceiroLoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

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
        <p className="text-gray-500 mb-8 text-sm">Você receberá um código de 6 dígitos por email.</p>
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

- [ ] **Step 5: Criar `web/app/parceiro/login/verificar/page.tsx`**

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
    const res = await fetch('/api/parceiro-auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo }),
    })
    if (!res.ok) {
      setErro('Código inválido ou expirado. Tente novamente.')
      setLoading(false)
    }
    // redirect handled server-side
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
      <div className="w-full max-w-sm">
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

- [ ] **Step 6: Atualizar `web/proxy.ts` — adicionar rota `/parceiro/*`**

Substituir o conteúdo completo de `web/proxy.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verificarToken } from './lib/auth'
import { verificarTokenParceiro } from './lib/parceiroAuth'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAfiliadoRoute = pathname.startsWith('/a/') && !pathname.startsWith('/a/login')
  const isAdminRoute = pathname.startsWith('/admin')
  const isParceiroRoute = pathname.startsWith('/parceiro/') && !pathname.startsWith('/parceiro/login')

  if (isAfiliadoRoute || isAdminRoute) {
    const token = req.cookies.get('ping_token')?.value
    if (!token) return NextResponse.redirect(new URL('/a/login', req.url))
    const sessao = await verificarToken(token)
    if (!sessao) return NextResponse.redirect(new URL('/a/login', req.url))
    if (isAdminRoute && !sessao.papeis.includes('superadmin')) {
      return NextResponse.redirect(new URL('/a/login', req.url))
    }
    return NextResponse.next()
  }

  if (isParceiroRoute) {
    const token = req.cookies.get('ping_parceiro_token')?.value
    if (!token) return NextResponse.redirect(new URL('/parceiro/login', req.url))
    const sessao = await verificarTokenParceiro(token)
    if (!sessao) return NextResponse.redirect(new URL('/parceiro/login', req.url))
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/a/:path*', '/parceiro/:path*'],
}
```

- [ ] **Step 7: Verificar que o TypeScript compila**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add web/lib/parceiroAuth.ts web/app/api/parceiro-auth/ web/app/parceiro/login/ web/proxy.ts
git commit -m "feat: auth magic link para parceiro — routes + cookie + proxy"
```

---

## Task 2: Layout + Sidebar + Design Tokens

**Files:**
- Modify: `web/app/globals.css`
- Create: `web/components/parceiro/Sidebar.tsx`
- Create: `web/app/parceiro/(protected)/layout.tsx`

**Interfaces:**
- Produz: `<ParceirosLayout>` — wrapper que verifica sessão e renderiza sidebar
- Produz: CSS tokens `--color-accent`, `font-sans`, `font-display` disponíveis em todas as páginas

- [ ] **Step 1: Atualizar `web/app/globals.css` com design tokens**

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

@theme {
  --color-accent: #374151;
  --color-accent-light: #f3f4f6;
  --font-sans: 'DM Sans', sans-serif;
  --font-display: 'Plus Jakarta Sans', sans-serif;
  --radius-card: 12px;
  --radius-input: 8px;
}

:root {
  --background: #f8f9fa;
  --foreground: #111827;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Criar `web/components/parceiro/Sidebar.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Wallet, Users, Webhook, Settings, LogOut } from 'lucide-react'

const NAV = [
  { label: 'Dashboard',     href: '/parceiro/dashboard',      icon: <LayoutDashboard size={16} /> },
  { label: 'Conversões',    href: '/parceiro/conversoes',     icon: <ArrowLeftRight size={16} /> },
  { label: 'Saques',        href: '/parceiro/saques',         icon: <Wallet size={16} /> },
  { label: 'Afiliados',     href: '/parceiro/afiliados',      icon: <Users size={16} /> },
  { label: 'Webhooks',      href: '/parceiro/webhooks',       icon: <Webhook size={16} /> },
  { label: 'Configurações', href: '/parceiro/configuracoes',  icon: <Settings size={16} /> },
]

interface SidebarProps { nomeParceiro?: string }

export function Sidebar({ nomeParceiro }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/parceiro-auth/logout', { method: 'POST' })
    router.push('/parceiro/login')
  }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white px-3 py-4">
      <div className="px-2 mb-6">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ping</span>
        {nomeParceiro && <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{nomeParceiro}</p>}
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ label, href, icon }) => {
          const ativo = pathname === href || (href !== '/parceiro/dashboard' && pathname.startsWith(href))
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

- [ ] **Step 3: Criar route de logout `web/app/api/parceiro-auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/parceiroAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return res
}
```

- [ ] **Step 4: Criar `web/app/parceiro/(protected)/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/parceiro/Sidebar'

export default async function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const parceiro = await prisma.parceiro.findUnique({
    where: { id: sessao.parceiroId },
    select: { nomeFantasia: true, razaoSocial: true },
  })

  const nomeParceiro = parceiro?.nomeFantasia || parceiro?.razaoSocial || 'Parceiro'

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <Sidebar nomeParceiro={nomeParceiro} />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add web/app/globals.css web/components/parceiro/ web/app/parceiro/'(protected)'/layout.tsx web/app/api/parceiro-auth/logout/
git commit -m "feat: sidebar + layout protegido + tokens de design para painel do parceiro"
```

---

## Task 3: Dashboard

**Files:**
- Create: `web/app/parceiro/(protected)/dashboard/page.tsx`

**Interfaces:**
- Consome: `getSessaoParceiro()` de `@/lib/parceiroAuth`

- [ ] **Step 1: Criar `web/app/parceiro/(protected)/dashboard/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function formatarValor(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)

  const [conversoesMes, saquesSolicitados, ultimasConversoes] = await Promise.all([
    prisma.conversao.count({
      where: {
        participacao: { campanha: { parceiroId: sessao.parceiroId } },
        criadoEm: { gte: inicioMes },
      },
    }),
    prisma.reward.findMany({
      where: {
        participacao: { campanha: { parceiroId: sessao.parceiroId } },
        status: 'solicitado',
      },
      select: { id: true, valorCentavos: true, solicitadoEm: true },
    }),
    prisma.conversao.findMany({
      where: { participacao: { campanha: { parceiroId: sessao.parceiroId } } },
      orderBy: { criadoEm: 'desc' },
      take: 10,
      include: {
        participacao: { include: { afiliado: { select: { nome: true } } } },
      },
    }),
  ])

  const afiliadosAtivos = await prisma.participacao.count({
    where: {
      campanha: { parceiroId: sessao.parceiroId },
      conversoes: { some: {} },
    },
  })

  const saldoPagar = saquesSolicitados.reduce((s, r) => s + r.valorCentavos, 0)
  const saquesAtrasados = saquesSolicitados.filter(r => r.solicitadoEm && diasDesde(r.solicitadoEm) > 5).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card titulo="Conversões este mês" valor={String(conversoesMes)} />
        <Card titulo="Afiliados ativos" valor={String(afiliadosAtivos)} />
        <Card titulo="Saldo a pagar" valor={formatarValor(saldoPagar)} />
        <Card titulo="Saques atrasados" valor={String(saquesAtrasados)} destaque={saquesAtrasados > 0} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Últimas conversões</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Produto</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ultimasConversoes.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-6 py-3 text-gray-500">{c.criadoEm.toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-3 text-gray-700">{c.participacao.afiliado.nome}</td>
                <td className="px-6 py-3 text-gray-700">{c.produtoNome}</td>
                <td className="px-6 py-3 text-right text-gray-700">{formatarValor(c.valorCentavos)}</td>
                <td className="px-6 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {ultimasConversoes.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma conversão ainda.</td></tr>
            )}
          </tbody>
        </table>
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

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    pendente: 'bg-yellow-50 text-yellow-700',
    confirmada: 'bg-green-50 text-green-700',
    cancelada: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cores[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/parceiro/'(protected)'/dashboard/
git commit -m "feat: dashboard do parceiro — 4 cards + últimas conversões"
```

---

## Task 4: Conversões

**Files:**
- Create: `web/app/parceiro/(protected)/conversoes/page.tsx`
- Create: `web/app/parceiro/(protected)/conversoes/[id]/page.tsx`

- [ ] **Step 1: Criar `web/app/parceiro/(protected)/conversoes/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function formatarValor(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_OPTS = ['todos', 'pendente', 'confirmada', 'cancelada']
const PERIODO_OPTS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default async function ConversoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; pagina?: string }>
}) {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const params = await searchParams
  const status = params.status || 'todos'
  const periodo = params.periodo || '30d'
  const pagina = Number(params.pagina || '1')
  const POR_PAGINA = 20

  const diasAtras = PERIODO_OPTS[periodo] || 30
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)

  const where = {
    participacao: { campanha: { parceiroId: sessao.parceiroId } },
    criadoEm: { gte: desde },
    ...(status !== 'todos' ? { status } : {}),
  }

  const [total, conversoes] = await Promise.all([
    prisma.conversao.count({ where }),
    prisma.conversao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        participacao: { include: { afiliado: { select: { nome: true } } } },
      },
    }),
  ])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  function url(p: Record<string, string>) {
    const q = new URLSearchParams({ status, periodo, pagina: String(pagina), ...p })
    return `/parceiro/conversoes?${q}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Conversões</h1>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTS.map(s => (
          <Link key={s} href={url({ status: s, pagina: '1' })}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${status === s ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {s === 'todos' ? 'Todos' : s}
          </Link>
        ))}
        <div className="ml-auto flex gap-2">
          {Object.keys(PERIODO_OPTS).map(p => (
            <Link key={p} href={url({ periodo: p, pagina: '1' })}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${periodo === p ? 'bg-[#374151] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {p}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Afiliado</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Produto</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Valor</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {conversoes.map(c => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-500">{c.criadoEm.toLocaleDateString('pt-BR')}</Link></td>
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-700">{c.participacao.afiliado.nome}</Link></td>
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-700">{c.produtoNome}</Link></td>
                <td className="px-6 py-3 text-right"><Link href={`/parceiro/conversoes/${c.id}`} className="block text-gray-700">{formatarValor(c.valorCentavos)}</Link></td>
                <td className="px-6 py-3"><Link href={`/parceiro/conversoes/${c.id}`} className="block"><StatusBadge status={c.status} /></Link></td>
              </tr>
            ))}
            {conversoes.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma conversão encontrada.</td></tr>
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

- [ ] **Step 2: Criar `web/app/parceiro/(protected)/conversoes/[id]/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ConversaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const { id } = await params

  const conversao = await prisma.conversao.findFirst({
    where: {
      id,
      participacao: { campanha: { parceiroId: sessao.parceiroId } },
    },
    include: {
      participacao: { include: { afiliado: { select: { nome: true, email: true } } } },
      reward: true,
    },
  })

  if (!conversao) notFound()

  const linhas = [
    ['ID', conversao.id],
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
    ['Motivo reversão', conversao.reward.motivoReversao || '—'],
    ['Disponível em', conversao.reward.disponivelEm?.toLocaleString('pt-BR') || '—'],
    ['Solicitado em', conversao.reward.solicitadoEm?.toLocaleString('pt-BR') || '—'],
    ['Pago em', conversao.reward.pagoEm?.toLocaleString('pt-BR') || '—'],
  ] : []

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/parceiro/conversoes" className="text-gray-400 hover:text-gray-600 text-sm">← Conversões</Link>
        <h1 className="text-2xl font-display font-bold text-gray-900">Detalhes da conversão</h1>
      </div>

      <Section titulo="Conversão" linhas={linhas} />
      {conversao.reward && <Section titulo="Reward associado" linhas={rewardLinhas} />}
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
git add web/app/parceiro/'(protected)'/conversoes/
git commit -m "feat: tela de conversões com filtros, paginação e detalhe"
```

---

## Task 5: Saques

**Files:**
- Create: `web/app/parceiro/(protected)/saques/page.tsx`

- [ ] **Step 1: Criar `web/app/parceiro/(protected)/saques/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diasDesde(data: Date) {
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function SaquesPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const rewards = await prisma.reward.findMany({
    where: {
      participacao: { campanha: { parceiroId: sessao.parceiroId } },
      status: 'solicitado',
    },
    orderBy: { solicitadoEm: 'asc' },
    include: {
      participacao: {
        include: { afiliado: { select: { nome: true } } },
      },
    },
  })

  async function confirmarPagamento(rewardId: string) {
    'use server'
    const sessaoAtual = await getSessaoParceiro()
    if (!sessaoAtual) return

    const parceiro = await prisma.parceiro.findUnique({
      where: { id: sessaoAtual.parceiroId },
      select: { apiKey: true },
    })
    if (!parceiro) return

    await fetch(`${process.env.API_BASE_URL}/v1/payouts/${rewardId}/confirm`, {
      method: 'POST',
      headers: { 'X-API-Key': parceiro.apiKey },
    })

    revalidatePath('/parceiro/saques')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Saques pendentes</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
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
              return (
                <tr key={r.id} className={`border-b border-gray-50 last:border-0 ${atrasado ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-3 text-gray-700">{r.participacao.afiliado.nome}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{r.participacao.chavePix || '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-700 font-medium">{fmt(r.valorCentavos)}</td>
                  <td className={`px-6 py-3 text-sm ${atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {dias === 0 ? 'hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}
                    {atrasado && ' ⚠️'}
                  </td>
                  <td className="px-6 py-3">
                    <form action={confirmarPagamento.bind(null, r.id)}>
                      <button type="submit" className="px-3 py-1.5 bg-[#374151] text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors">
                        Confirmar pagamento
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {rewards.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum saque pendente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar `API_BASE_URL` ao `web/.env.local`**

```
API_BASE_URL=https://ping-api.geengoo.io
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/app/parceiro/'(protected)'/saques/ web/.env.local
git commit -m "feat: tela de saques com destaque de atrasados e confirmar pagamento"
```

---

## Task 6: Afiliados

**Files:**
- Create: `web/app/parceiro/(protected)/afiliados/page.tsx`

- [ ] **Step 1: Criar `web/app/parceiro/(protected)/afiliados/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AfiliadosPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const participacoes = await prisma.participacao.findMany({
    where: { campanha: { parceiroId: sessao.parceiroId } },
    orderBy: { entrouEm: 'desc' },
    include: {
      afiliado: { select: { nome: true, email: true } },
      rewards: { select: { status: true, valorCentavos: true } },
      conversoes: { select: { id: true } },
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Afiliados</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Nome</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Email</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Conversões</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Saldo disponível</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Entrou em</th>
            </tr>
          </thead>
          <tbody>
            {participacoes.map(p => {
              const saldoDisponivel = p.rewards
                .filter(r => r.status === 'disponivel')
                .reduce((s, r) => s + r.valorCentavos, 0)
              return (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-6 py-3 text-gray-700">{p.afiliado.nome}</td>
                  <td className="px-6 py-3 text-gray-500">{p.afiliado.email}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{p.conversoes.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{fmt(saldoDisponivel)}</td>
                  <td className="px-6 py-3 text-gray-500">{p.entrouEm.toLocaleDateString('pt-BR')}</td>
                </tr>
              )
            })}
            {participacoes.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum afiliado ainda.</td></tr>
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
git add web/app/parceiro/'(protected)'/afiliados/
git commit -m "feat: tela de afiliados com conversões e saldo disponível"
```

---

## Task 7: Webhooks

**Files:**
- Create: `web/app/parceiro/(protected)/webhooks/page.tsx`

- [ ] **Step 1: Criar `web/app/parceiro/(protected)/webhooks/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export default async function WebhooksPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const logs = await prisma.webhookLog.findMany({
    where: { parceiroId: sessao.parceiroId },
    orderBy: { criadoEm: 'desc' },
    take: 100,
  })

  async function reenviar(logId: string) {
    'use server'
    const sessaoAtual = await getSessaoParceiro()
    if (!sessaoAtual) return

    await prisma.webhookLog.update({
      where: { id: logId, parceiroId: sessaoAtual.parceiroId },
      data: { tentativas: 0, tentadoEm: null },
    })

    revalidatePath('/parceiro/webhooks')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-gray-900">Webhooks</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Data</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Evento</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">URL</th>
              <th className="text-right px-6 py-3 text-xs text-gray-400 font-medium">Tentativas</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-gray-50 last:border-0">
                <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{log.criadoEm.toLocaleString('pt-BR')}</td>
                <td className="px-6 py-3">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{log.evento}</span>
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs truncate max-w-[200px]">{log.url}</td>
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
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum webhook disparado ainda.</td></tr>
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
git add web/app/parceiro/'(protected)'/webhooks/
git commit -m "feat: tela de webhooks com log e botão reenviar"
```

---

## Task 8: Configurações + Deploy

**Files:**
- Create: `web/app/parceiro/(protected)/configuracoes/page.tsx`

- [ ] **Step 1: Criar `web/app/parceiro/(protected)/configuracoes/page.tsx`**

```typescript
import { getSessaoParceiro } from '@/lib/parceiroAuth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ConfiguracoesPage() {
  const sessao = await getSessaoParceiro()
  if (!sessao) redirect('/parceiro/login')

  const parceiro = await prisma.parceiro.findUnique({
    where: { id: sessao.parceiroId },
    include: { campanhas: { where: { status: 'ativa' }, take: 1 } },
  })

  if (!parceiro) redirect('/parceiro/login')

  const campanha = parceiro.campanhas[0]

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold text-gray-900">Configurações</h1>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Integração</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1">API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 truncate">
                {parceiro.apiKey}
              </code>
              <CopyButton valor={parceiro.apiKey} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1">Webhook URL</label>
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {parceiro.webhookUrl || <span className="text-gray-400">Não configurado</span>}
            </p>
          </div>
        </div>
      </div>

      {campanha && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Campanha ativa — {campanha.nome}</h2>
          </div>
          <dl className="divide-y divide-gray-100">
            {[
              ['Status', campanha.status],
              ['Janela de cancelamento', `${campanha.janelaCancelamentoDias} dias`],
              ['Tipo de recompensa', campanha.recompensaTipo],
              ['Valor da recompensa', fmt(campanha.recompensaValorCentavos)],
              ['Dia de pagamento', `Dia ${campanha.diaPagamento}`],
              ['Atribuição', campanha.atribuicao],
            ].map(([k, v]) => (
              <div key={k} className="px-6 py-3 flex gap-4">
                <dt className="text-xs text-gray-400 w-44 shrink-0 pt-0.5">{k}</dt>
                <dd className="text-sm text-gray-700">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function CopyButton({ valor }: { valor: string }) {
  return (
    <button
      onClick={`(() => { navigator.clipboard.writeText('${valor}'); })()` as unknown as React.MouseEventHandler}
      className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
    >
      Copiar
    </button>
  )
}
```

**Nota:** o `CopyButton` precisa ser um Client Component separado. Crie `web/components/parceiro/CopyButton.tsx`:

```typescript
'use client'
export function CopyButton({ valor }: { valor: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(valor)}
      className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
    >
      Copiar
    </button>
  )
}
```

E importe em `configuracoes/page.tsx`:
```typescript
import { CopyButton } from '@/components/parceiro/CopyButton'
```
(Remova a definição inline de `CopyButton` da page.)

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

- [ ] **Step 3: Rodar deploy**

```bash
cd /root/Projetos/geengoo/ping && ./deploy.sh
```

Expected: build sem erros, PM2 reload.

- [ ] **Step 4: Verificar PM2**

```bash
pm2 logs ping-web --lines 10 --nostream
```

Expected: `✓ Ready in Xms`

- [ ] **Step 5: Commit**

```bash
git add web/app/parceiro/'(protected)'/configuracoes/ web/components/parceiro/CopyButton.tsx
git commit -m "feat: tela de configurações — API key + campanha (leitura)"
```

- [ ] **Step 6: Push**

```bash
cd /root/Projetos/geengoo/ping && git push origin main
```
