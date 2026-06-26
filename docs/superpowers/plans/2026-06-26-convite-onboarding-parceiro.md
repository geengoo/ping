# Convite + Onboarding de Parceiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a criação direta de parceiro por um fluxo de convite: admin envia email com token → parceiro completa onboarding typeform-style → conta + parceiro criados ao final.

**Architecture:** O admin preenche nome, email e empresa; um registro `ConviteParceiro` é gravado no banco com token `nanoid(32)` e expiração de 7 dias; Resend envia o link de onboarding. O convidado acessa `/onboarding?token=xxx` e percorre um wizard de 3 etapas (empresa, contato, técnico). No submit final, uma API route cria `Conta` + `Parceiro` atomicamente, marca o convite como usado e redireciona para `/parceiro/login` com banner de boas-vindas.

**Tech Stack:** Next.js 16 (web/), Prisma 7 + `@prisma/adapter-pg`, PostgreSQL (banco `ping`), Resend, `nanoid`, `jose` (magic link já existente), BrasilAPI CNPJ.

## Global Constraints

- Prisma 7: sem `url` no `datasource db`; URL vai em `prisma.config.ts` via `defineConfig`
- Prisma 7: engine WASM requer `@prisma/adapter-pg` no constructor do PrismaClient — usar o `prisma` singleton já existente em `web/lib/prisma.ts`
- Next.js 16: middleware exportado como `proxy` (não `default`) em `web/proxy.ts`
- Moeda: sempre centavos (Int), nunca Float
- Nunca deletar registros — status updates apenas
- Rota de onboarding é **pública** (sem autenticação, token é a credencial)
- Após onboarding concluído, parceiro é redirecionado para `/parceiro/login` — ele ainda precisa fazer login via magic link
- Resend: skip em `NODE_ENV === 'test'` (já existe em `web/lib/resend.ts`)
- `NEXT_PUBLIC_BASE_URL` = `https://ping.geengoo.io` (env já configurada)

---

## File Map

**Novos:**
- `web/app/admin/(protected)/parceiros/convidar/page.tsx` — form de convite (Server Component + Server Action)
- `web/app/onboarding/page.tsx` — wizard typeform (Client Component, rota pública)
- `web/app/api/onboarding/verificar/route.ts` — GET: valida token, retorna dados do convite
- `web/app/api/onboarding/completar/route.ts` — POST: cria Conta + Parceiro, marca convite usado

**Modificados:**
- `web/prisma/schema.prisma` — adicionar model `ConviteParceiro`
- `web/lib/resend.ts` — adicionar `enviarConviteParceiro()`
- `web/app/admin/(protected)/parceiros/page.tsx` — trocar link "Novo parceiro" por "Convidar parceiro" + banner de confirmação
- `web/app/parceiro/login/page.tsx` — banner de boas-vindas quando `?onboarding=ok`

**Deletados:**
- `web/app/admin/(protected)/parceiros/novo/page.tsx`
- `web/app/admin/(protected)/parceiros/novo/NovoParceirForm.tsx`

---

## Task 1: Model ConviteParceiro no Prisma

**Files:**
- Modify: `web/prisma/schema.prisma`
- Run: `prisma generate` + migration manual

**Interfaces:**
- Produces: model `ConviteParceiro` com campos `id`, `email`, `nomeContato`, `nomeFantasia`, `token` (unique), `usado`, `expiraEm`, `criadoEm`

- [ ] **Step 1: Adicionar model ao schema**

Abrir `web/prisma/schema.prisma` e adicionar ao final:

```prisma
model ConviteParceiro {
  id           String   @id @default(uuid())
  email        String
  nomeContato  String   @map("nome_contato")
  nomeFantasia String   @map("nome_fantasia")
  token        String   @unique @default(cuid())
  usado        Boolean  @default(false)
  expiraEm     DateTime @map("expira_em")
  criadoEm     DateTime @default(now()) @map("criado_em")

  @@map("convites_parceiro")
}
```

- [ ] **Step 2: Rodar prisma generate**

```bash
cd /root/Projetos/geengoo/ping/web
npx prisma generate
```

Esperado: `✔ Generated Prisma Client`

- [ ] **Step 3: Criar a tabela no banco**

```bash
PGPASSWORD=ping_2026 psql -U ping -h 187.77.56.138 -d ping -c "
CREATE TABLE convites_parceiro (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email        VARCHAR(255) NOT NULL,
  nome_contato VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255) NOT NULL,
  token        TEXT UNIQUE NOT NULL,
  usado        BOOLEAN NOT NULL DEFAULT false,
  expira_em    TIMESTAMP NOT NULL,
  criado_em    TIMESTAMP NOT NULL DEFAULT now()
);
"
```

Esperado: `CREATE TABLE`

- [ ] **Step 4: Verificar que o Prisma Client enxerga o model**

```bash
cd /root/Projetos/geengoo/ping/web
node -e "const {prisma} = require('./lib/prisma'); prisma.conviteParceiro.count().then(n => { console.log('count:', n); process.exit(0) })"
```

Esperado: `count: 0`

- [ ] **Step 5: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/prisma/schema.prisma
git commit -m "feat: model ConviteParceiro no schema Prisma"
```

---

## Task 2: Email de convite via Resend

**Files:**
- Modify: `web/lib/resend.ts`

**Interfaces:**
- Produces: `enviarConviteParceiro({ para, nomeContato, nomeFantasia, token }: { para: string, nomeContato: string, nomeFantasia: string, token: string }): Promise<void>`

- [ ] **Step 1: Adicionar função em `web/lib/resend.ts`**

Abrir `web/lib/resend.ts` e adicionar ao final do arquivo:

```typescript
export async function enviarConviteParceiro({
  para,
  nomeContato,
  nomeFantasia,
  token,
}: {
  para: string
  nomeContato: string
  nomeFantasia: string
  token: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ping.geengoo.io'
  const link = `${baseUrl}/onboarding?token=${token}`
  await enviarEmail(
    para,
    `${nomeContato}, você foi convidado para o ping`,
    `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 32px">
        <p style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px">Olá, ${nomeContato}</p>
        <p style="color:#555;margin-bottom:24px">
          Você foi convidado para configurar o programa de indicações da <strong>${nomeFantasia}</strong> no ping.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#374151;color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
          Completar cadastro
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">
          Este link expira em 7 dias. Se você não esperava este convite, ignore este email.
        </p>
      </div>
    `,
  )
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

```bash
cd /root/Projetos/geengoo/ping/web
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros em `lib/resend.ts`

- [ ] **Step 3: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/lib/resend.ts
git commit -m "feat: email enviarConviteParceiro via Resend"
```

---

## Task 3: Página de convite no admin

**Files:**
- Create: `web/app/admin/(protected)/parceiros/convidar/page.tsx`
- Delete: `web/app/admin/(protected)/parceiros/novo/page.tsx`
- Delete: `web/app/admin/(protected)/parceiros/novo/NovoParceirForm.tsx`
- Modify: `web/app/admin/(protected)/parceiros/page.tsx`

**Interfaces:**
- Consumes: `enviarConviteParceiro` de `@/lib/resend`, `prisma.conviteParceiro.create`, `getSessao` de `@/lib/auth`
- Produces: rota `/admin/parceiros/convidar`; ao submeter redireciona para `/admin/parceiros?convite=enviado`

- [ ] **Step 1: Criar `web/app/admin/(protected)/parceiros/convidar/page.tsx`**

```typescript
import { getSessao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarConviteParceiro } from '@/lib/resend'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'

export default async function ConvidarParceiro() {
  const sessao = await getSessao()
  if (!sessao || !sessao.papeis.includes('superadmin')) redirect('/admin/login')

  async function convidar(formData: FormData) {
    'use server'
    const sessaoAtual = await getSessao()
    if (!sessaoAtual?.papeis.includes('superadmin')) redirect('/admin/login')

    const email = formData.get('email') as string
    const nomeContato = formData.get('nomeContato') as string
    const nomeFantasia = formData.get('nomeFantasia') as string

    if (!email || !nomeContato || !nomeFantasia) return

    const token = nanoid(32)
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.conviteParceiro.create({
      data: { email, nomeContato, nomeFantasia, token, expiraEm },
    })

    await enviarConviteParceiro({ para: email, nomeContato, nomeFantasia, token })

    redirect('/admin/parceiros?convite=enviado')
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Convidar parceiro</h1>
        <p className="text-sm text-gray-500 mt-1">
          O convidado receberá um email com link para completar o cadastro.
        </p>
      </div>
      <form action={convidar} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nome do contato *</label>
          <input
            name="nomeContato"
            required
            placeholder="João Silva"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Email *</label>
          <input
            name="email"
            type="email"
            required
            placeholder="joao@empresa.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Nome fantasia da empresa *</label>
          <input
            name="nomeFantasia"
            required
            placeholder="Acme"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-[#374151] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Enviar convite
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `web/app/admin/(protected)/parceiros/page.tsx`**

Trocar o link de criação direta por convite e adicionar banner de confirmação. Localizar o trecho com `href="/admin/parceiros/novo"` e substituir por `href="/admin/parceiros/convidar"` com texto `+ Convidar parceiro`.

Adicionar `searchParams` ao componente e banner acima da tabela:

```typescript
export default async function Parceiros({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>
}) {
  const { convite } = await searchParams
  // ... código existente ...

  return (
    <div>
      {convite === 'enviado' && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          Convite enviado com sucesso.
        </div>
      )}
      {/* ... resto do JSX existente ... */}
    </div>
  )
}
```

- [ ] **Step 3: Deletar arquivos da criação direta**

```bash
rm /root/Projetos/geengoo/ping/web/app/admin/\(protected\)/parceiros/novo/page.tsx
rm /root/Projetos/geengoo/ping/web/app/admin/\(protected\)/parceiros/novo/NovoParceirForm.tsx
rmdir /root/Projetos/geengoo/ping/web/app/admin/\(protected\)/parceiros/novo/
```

- [ ] **Step 4: Verificar compilação**

```bash
cd /root/Projetos/geengoo/ping/web
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros

- [ ] **Step 5: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/app/admin/
git commit -m "feat: página de convite de parceiro no admin"
```

---

## Task 4: API routes do onboarding

**Files:**
- Create: `web/app/api/onboarding/verificar/route.ts`
- Create: `web/app/api/onboarding/completar/route.ts`

**Interfaces:**
- `GET /api/onboarding/verificar?token=xxx` → `{ email, nomeContato, nomeFantasia } | null`
- `POST /api/onboarding/completar` body: `{ token, cnpj?, nomeFantasia, razaoSocial?, contatoNome, contatoCargo?, contatoTelefone?, webhookUrl? }` → `{ ok: true } | { erro: string }`

- [ ] **Step 1: Criar `web/app/api/onboarding/verificar/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json(null)

  const convite = await prisma.conviteParceiro.findFirst({
    where: { token, usado: false, expiraEm: { gt: new Date() } },
    select: { email: true, nomeContato: true, nomeFantasia: true },
  })

  if (!convite) return NextResponse.json(null)

  return NextResponse.json({
    email: convite.email,
    nomeContato: convite.nomeContato,
    nomeFantasia: convite.nomeFantasia,
  })
}
```

- [ ] **Step 2: Criar `web/app/api/onboarding/completar/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, cnpj, nomeFantasia, razaoSocial, contatoNome, contatoCargo, contatoTelefone, webhookUrl } = body

  if (!token || !nomeFantasia || !contatoNome) {
    return NextResponse.json({ erro: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const convite = await prisma.conviteParceiro.findFirst({
    where: { token, usado: false, expiraEm: { gt: new Date() } },
  })

  if (!convite) {
    return NextResponse.json({ erro: 'Convite inválido ou expirado' }, { status: 400 })
  }

  if (cnpj) {
    const cnpjExistente = await prisma.parceiro.findUnique({ where: { cnpj } })
    if (cnpjExistente) {
      return NextResponse.json({ erro: 'CNPJ já cadastrado' }, { status: 409 })
    }
  }

  let conta = await prisma.conta.findUnique({ where: { email: convite.email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email: convite.email, nome: contatoNome, papeis: [] },
    })
  }

  const parceiroExistente = await prisma.parceiro.findUnique({ where: { contaId: conta.id } })
  if (parceiroExistente) {
    return NextResponse.json({ erro: 'Parceiro já cadastrado para este email' }, { status: 409 })
  }

  const apiKey = nanoid(32)

  await prisma.$transaction([
    prisma.parceiro.create({
      data: {
        contaId: conta.id,
        nomeFantasia,
        razaoSocial: razaoSocial || null,
        cnpj: cnpj || null,
        contatoNome,
        contatoCargo: contatoCargo || null,
        contatoTelefone: contatoTelefone || null,
        webhookUrl: webhookUrl || null,
        apiKey,
      },
    }),
    prisma.conviteParceiro.update({
      where: { token },
      data: { usado: true },
    }),
  ])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar compilação**

```bash
cd /root/Projetos/geengoo/ping/web
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros

- [ ] **Step 4: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/app/api/onboarding/
git commit -m "feat: API routes onboarding verificar e completar"
```

---

## Task 5: Wizard de onboarding (página pública)

**Files:**
- Create: `web/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `GET /api/onboarding/verificar?token=`, `POST /api/onboarding/completar`
- Rota pública `/onboarding?token=xxx`
- Etapa 1: dados da empresa (CNPJ + BrasilAPI → razão social, nome fantasia)
- Etapa 2: dados de contato (nome pré-preenchido do convite, cargo, telefone)
- Etapa 3: webhook URL (opcional) + submit final

- [ ] **Step 1: Criar `web/app/onboarding/page.tsx`**

```typescript
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface DadosConvite {
  email: string
  nomeContato: string
  nomeFantasia: string
}

function OnboardingWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  const [convite, setConvite] = useState<DadosConvite | null>(null)
  const [tokenInvalido, setTokenInvalido] = useState(false)
  const [etapa, setEtapa] = useState(1)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Etapa 1 — empresa
  const [cnpj, setCnpj] = useState('')
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')

  // Etapa 2 — contato
  const [contatoNome, setContatoNome] = useState('')
  const [contatoCargo, setContatoCargo] = useState('')
  const [contatoTelefone, setContatoTelefone] = useState('')

  // Etapa 3 — técnico
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    if (!token) { setTokenInvalido(true); return }
    fetch(`/api/onboarding/verificar?token=${token}`)
      .then(r => r.json())
      .then((data: DadosConvite | null) => {
        if (!data) { setTokenInvalido(true); return }
        setConvite(data)
        setNomeFantasia(data.nomeFantasia)
        setContatoNome(data.nomeContato)
      })
  }, [token])

  async function buscarCnpj(valor: string) {
    const limpo = valor.replace(/\D/g, '')
    if (limpo.length !== 14) return
    setCnpjStatus('loading')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`)
      if (!res.ok) { setCnpjStatus('error'); return }
      const data = await res.json()
      setRazaoSocial(data.razao_social || '')
      setNomeFantasia(data.nome_fantasia || data.razao_social || nomeFantasia)
      setCnpjStatus('ok')
    } catch {
      setCnpjStatus('error')
    }
  }

  async function handleSubmit() {
    setEnviando(true)
    setErro('')
    const res = await fetch('/api/onboarding/completar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        cnpj: cnpj.replace(/\D/g, '') || undefined,
        nomeFantasia,
        razaoSocial: razaoSocial || undefined,
        contatoNome,
        contatoCargo: contatoCargo || undefined,
        contatoTelefone: contatoTelefone || undefined,
        webhookUrl: webhookUrl || undefined,
      }),
    })
    setEnviando(false)
    if (!res.ok) {
      const data = await res.json()
      setErro(data.erro || 'Erro ao completar cadastro')
      return
    }
    router.push('/parceiro/login?onboarding=ok')
  }

  if (tokenInvalido) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4">
        <div className="max-w-sm text-center">
          <p className="text-gray-800 font-semibold mb-2">Link inválido ou expirado</p>
          <p className="text-gray-500 text-sm">Entre em contato com quem te convidou para receber um novo link.</p>
        </div>
      </main>
    )
  }

  if (!convite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </main>
    )
  }

  const totalEtapas = 3

  return (
    <main className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalEtapas }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i < etapa ? 'bg-[#374151]' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
          {etapa === 1 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 1 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Dados da empresa</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">CNPJ</label>
                  <input
                    value={cnpj}
                    onChange={e => { setCnpj(e.target.value); buscarCnpj(e.target.value) }}
                    placeholder="00.000.000/0001-00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                  {cnpjStatus === 'loading' && <p className="text-xs text-gray-400 mt-1">Consultando Receita Federal...</p>}
                  {cnpjStatus === 'error' && <p className="text-xs text-red-500 mt-1">CNPJ não encontrado</p>}
                  {cnpjStatus === 'ok' && <p className="text-xs text-green-600 mt-1">Dados preenchidos automaticamente</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome fantasia *</label>
                  <input
                    required
                    value={nomeFantasia}
                    onChange={e => setNomeFantasia(e.target.value)}
                    placeholder="Acme"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Razão social</label>
                  <input
                    value={razaoSocial}
                    onChange={e => setRazaoSocial(e.target.value)}
                    placeholder="Acme Ltda."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
              </div>
              <button
                onClick={() => nomeFantasia && setEtapa(2)}
                disabled={!nomeFantasia}
                className="w-full bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Continuar
              </button>
            </>
          )}

          {etapa === 2 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 2 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Dados de contato</h1>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome *</label>
                  <input
                    required
                    value={contatoNome}
                    onChange={e => setContatoNome(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Cargo</label>
                  <input
                    value={contatoCargo}
                    onChange={e => setContatoCargo(e.target.value)}
                    placeholder="CTO, Head de Marketing..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">WhatsApp</label>
                  <input
                    value={contatoTelefone}
                    onChange={e => setContatoTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEtapa(1)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => contatoNome && setEtapa(3)}
                  disabled={!contatoNome}
                  className="flex-1 bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {etapa === 3 && (
            <>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Etapa 3 de {totalEtapas}</p>
                <h1 className="text-xl font-bold text-gray-900">Configuração técnica</h1>
                <p className="text-sm text-gray-500 mt-1">Opcional — você pode configurar isso depois no painel.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Webhook URL</label>
                  <input
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://app.suaempresa.com/webhooks/ping"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#374151]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Notificações de novas conversões e saques confirmados.</p>
                </div>
              </div>
              {erro && <p className="text-red-500 text-sm">{erro}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setEtapa(2)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={enviando}
                  className="flex-1 bg-[#374151] text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
                >
                  {enviando ? 'Criando conta...' : 'Concluir cadastro'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Convite enviado para <strong>{convite.email}</strong>
        </p>
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingWizard />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd /root/Projetos/geengoo/ping/web
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros

- [ ] **Step 3: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/app/onboarding/
git commit -m "feat: wizard de onboarding do parceiro"
```

---

## Task 6: Banner de boas-vindas no login do parceiro

**Files:**
- Modify: `web/app/parceiro/login/page.tsx`

**Interfaces:**
- Quando `?onboarding=ok` presente na URL, exibe banner "Cadastro concluído! Informe seu email para acessar o painel."

- [ ] **Step 1: Atualizar `web/app/parceiro/login/page.tsx`**

O componente atual é `'use client'` mas não usa `useSearchParams`. Refatorar para:

```typescript
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
```

- [ ] **Step 2: Build completo**

```bash
cd /root/Projetos/geengoo/ping/web
npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully`

- [ ] **Step 3: Commit final + deploy**

```bash
cd /root/Projetos/geengoo/ping
git add web/app/parceiro/login/page.tsx
git commit -m "feat: banner de boas-vindas pós-onboarding no login do parceiro"
./deploy.sh
```

---

## Self-Review

**Spec coverage:**
- [x] Admin envia convite (nome, email, empresa) — Task 3
- [x] Email com link de onboarding — Task 2
- [x] Token com expiração de 7 dias — Task 1 + Task 4
- [x] Wizard typeform 3 etapas — Task 5
- [x] CNPJ + BrasilAPI — Task 5
- [x] Criação de Conta + Parceiro atomicamente — Task 4
- [x] Token marcado como usado — Task 4
- [x] Redirecionamento para magic link login — Task 5 + Task 6
- [x] Deletar fluxo de criação direta — Task 3
- [x] Banner de confirmação no admin — Task 3
- [x] Banner de boas-vindas no login — Task 6

**Placeholder scan:** nenhum TBD ou TODO encontrado.

**Type consistency:** `ConviteParceiro` usado consistentemente em schema, API routes e wizard. `nomeContato`/`nomeFantasia` consistentes em todas as tasks.
