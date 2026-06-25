# ping — Worker (Parte 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 3 jobs do worker (confirmar conversões, disparar webhooks, alertar saques) + 2 páginas de ação no web para os botões do email D+5.

**Architecture:** Jobs isolados em `api/src/jobs/`, cada um com seu próprio teste. Worker orquestra via `setInterval` de 1h. Páginas de ação no `web/` usam Server Actions com token JWT de uso único (assinado com `jsonwebtoken` na api, verificado com `jose` no web) — sem login.

**Tech Stack:** Express + TypeScript (api), Next.js 16 + Tailwind v4 (web), Prisma 7, `jsonwebtoken` (assinatura), `jose` (verificação), Resend (email), PostgreSQL

## Global Constraints

- Prisma 7: sem `url` no `datasource db`; URL vai em `prisma.config.ts` via `defineConfig`
- Prisma 7: engine WASM requer `@prisma/adapter-pg` no constructor do PrismaClient
- Next.js 16: `proxy.ts` (não `middleware.ts`); `params` é `Promise<{...}>` — usar `await params`; ler `node_modules/next/dist/docs/` antes de escrever qualquer código Next.js
- Moeda: sempre centavos (Int), nunca Float
- Nunca deletar registros — updates de status com motivo
- `DATABASE_URL_TEST` obrigatório para testes (`api/src/__tests__/setup.ts` lança erro se ausente)
- `NODE_ENV=test` pula envio de emails (Resend retorna early em ambos api e web)
- Tests rodam com `--runInBand` (serial) — não paralelizar

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `api/prisma/schema.prisma` | Modify | +3 campos no model Reward |
| `web/prisma/schema.prisma` | Modify | Cópia idêntica (sync manual) |
| `api/src/__tests__/setup.ts` | Modify | +WORKER_SECRET, WEB_BASE_URL, SUPERADMIN_EMAIL |
| `api/src/lib/resend.ts` | Modify | +3 funções de email (D+3, D+5 parceiro, D+5 superadmin) |
| `web/lib/resend.ts` | Modify | +3 funções de email (confirmado, previsão, superadmin previsão) |
| `api/src/jobs/confirmarConversoes.ts` | Create | Job 1 |
| `api/src/__tests__/confirmarConversoes.test.ts` | Create | Testes do Job 1 |
| `api/src/jobs/dispararWebhooks.ts` | Create | Job 2 |
| `api/src/__tests__/dispararWebhooks.test.ts` | Create | Testes do Job 2 |
| `api/src/jobs/alertarSaques.ts` | Create | Job 3 |
| `api/src/__tests__/alertarSaques.test.ts` | Create | Testes do Job 3 |
| `api/src/worker.ts` | Modify | Orquestra os 3 jobs |
| `api/.env.example` | Modify | +SUPERADMIN_EMAIL, WORKER_SECRET, WEB_BASE_URL |
| `web/lib/payoutToken.ts` | Create | Verifica JWT dos botões de email |
| `web/app/payout/[token]/confirm/page.tsx` | Create | "Sim, já paguei" |
| `web/app/payout/[token]/dispute/page.tsx` | Create | "Ainda não paguei" — form |

---

### Task 1: Migration — 3 novos campos no Reward

**Files:**
- Modify: `api/prisma/schema.prisma`
- Modify: `web/prisma/schema.prisma`

**Interfaces:**
- Produces: `Reward.alertaD3EnviadoEm DateTime?`, `Reward.alertaD5EnviadoEm DateTime?`, `Reward.previsaoPagamentoEm DateTime?` disponíveis no Prisma client

- [ ] **Step 1: Adicionar campos ao schema da api**

Em `api/prisma/schema.prisma`, dentro do model `Reward`, adicionar após o campo `revertidoEm`:

```prisma
  alertaD3EnviadoEm   DateTime? @map("alerta_d3_enviado_em")
  alertaD5EnviadoEm   DateTime? @map("alerta_d5_enviado_em")
  previsaoPagamentoEm DateTime? @map("previsao_pagamento_em")
```

- [ ] **Step 2: Espelhar no schema da web**

Fazer a mesma alteração em `web/prisma/schema.prisma` (cópia idêntica ao da api).

- [ ] **Step 3: Rodar migration**

```bash
cd /root/Projetos/geengoo/ping/api && npx prisma migrate dev --name worker_reward_fields
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 4: Regenerar client da web**

```bash
cd /root/Projetos/geengoo/ping/web && npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/prisma/ web/prisma/
git commit -m "feat: migration — campos de alerta e previsão no Reward"
```

---

### Task 2: Novas funções de email

**Files:**
- Modify: `api/src/lib/resend.ts`
- Modify: `web/lib/resend.ts`

**Interfaces:**
- Produces em `api/src/lib/resend.ts`:
  - `alertarParceiroLembrete(email: string, nomeAfiliado: string, valorCentavos: number): Promise<void>`
  - `alertarParceiroVencido(email: string, nomeAfiliado: string, valorCentavos: number, linkConfirm: string, linkDispute: string): Promise<void>`
  - `alertarSuperadminSaqueVencido(email: string, nomeAfiliado: string, valorCentavos: number, rewardId: string): Promise<void>`
- Produces em `web/lib/resend.ts`:
  - `notificarAfiliadoConfirmadoParceiro(email: string, valorCentavos: number): Promise<void>`
  - `notificarAfiliadoPrevisaoPagamento(email: string, valorCentavos: number, previsao: Date, observacao?: string): Promise<void>`
  - `notificarSuperadminPrevisao(email: string, nomeAfiliado: string, valorCentavos: number, previsao: Date): Promise<void>`

- [ ] **Step 1: Adicionar 3 funções no final de `api/src/lib/resend.ts`**

```typescript
export async function alertarParceiroLembrete(email: string, nomeAfiliado: string, valorCentavos: number) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `Lembrete: saque de ${valor} vence em 2 dias`,
    `<p><strong>${nomeAfiliado}</strong> solicitou um saque de <strong>${valor}</strong> há 3 dias.</p>
    <p>O prazo vence em 2 dias. Confirme o pagamento via API quando realizar o PIX.</p>`
  )
}

export async function alertarParceiroVencido(
  email: string,
  nomeAfiliado: string,
  valorCentavos: number,
  linkConfirm: string,
  linkDispute: string
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `[URGENTE] Saque de ${valor} vencido — você já pagou?`,
    `<p>O prazo de 5 dias para o saque de <strong>${valor}</strong> solicitado por <strong>${nomeAfiliado}</strong> venceu.</p>
    <p>Você já realizou o pagamento via PIX?</p>
    <p style="margin-top:24px">
      <a href="${linkConfirm}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Sim, já paguei</a>
      &nbsp;&nbsp;
      <a href="${linkDispute}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Ainda não paguei</a>
    </p>`
  )
}

export async function alertarSuperadminSaqueVencido(
  email: string,
  nomeAfiliado: string,
  valorCentavos: number,
  rewardId: string
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `[ALERTA] Saque de ${valor} para ${nomeAfiliado} está vencido`,
    `<p>O saque de <strong>${valor}</strong> solicitado por <strong>${nomeAfiliado}</strong> está com mais de 5 dias sem confirmação.</p>
    <p>O parceiro foi notificado com os botões de ação.</p>
    <p>ID do reward: <code>${rewardId}</code></p>`
  )
}
```

- [ ] **Step 2: Adicionar 3 funções no final de `web/lib/resend.ts`**

Primeiro verificar o conteúdo atual do arquivo para não duplicar `enviarEmail`. Depois adicionar ao final:

```typescript
export async function notificarAfiliadoConfirmadoParceiro(email: string, valorCentavos: number) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `Saque de ${valor} confirmado — confira seu PIX`,
    `<p>O parceiro confirmou o pagamento do seu saque de <strong>${valor}</strong>.</p>
    <p>Verifique se o PIX chegou na sua conta.</p>`
  )
}

export async function notificarAfiliadoPrevisaoPagamento(
  email: string,
  valorCentavos: number,
  previsao: Date,
  observacao?: string
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dataPrevisao = previsao.toLocaleDateString('pt-BR')
  await enviarEmail(
    email,
    `Seu saque de ${valor} está sendo processado`,
    `<p>Seu saque de <strong>${valor}</strong> está em andamento.</p>
    <p>Previsão de pagamento: <strong>${dataPrevisao}</strong></p>
    ${observacao ? `<p>Observação do parceiro: ${observacao}</p>` : ''}`
  )
}

export async function notificarSuperadminPrevisao(
  email: string,
  nomeAfiliado: string,
  valorCentavos: number,
  previsao: Date
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dataPrevisao = previsao.toLocaleDateString('pt-BR')
  await enviarEmail(
    email,
    `Parceiro informou previsão de pagamento para saque de ${valor}`,
    `<p>Parceiro informou que pagará o saque de <strong>${nomeAfiliado}</strong> (${valor}) até <strong>${dataPrevisao}</strong>.</p>`
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/lib/resend.ts web/lib/resend.ts
git commit -m "feat: funções de email para alertas de saque D+3/D+5 e confirmação"
```

---

### Task 3: Job 1 — confirmarConversoes (TDD)

**Files:**
- Create: `api/src/jobs/confirmarConversoes.ts`
- Create: `api/src/__tests__/confirmarConversoes.test.ts`

**Interfaces:**
- Consumes: `prisma` de `../lib/prisma`, `notificarAfiliadoRewardDisponivel` de `../lib/resend`
- Produces: `confirmarConversoes(): Promise<void>`

- [ ] **Step 1: Criar `api/src/__tests__/confirmarConversoes.test.ts`**

```typescript
import { prisma } from '../lib/prisma'
import { confirmarConversoes } from '../jobs/confirmarConversoes'

let parceiroId: string
let campanhaId: string
let participacaoId: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Worker', email: 'parceiro-worker@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: {
      contaId: contaParceiro.id,
      nomeFantasia: 'Worker Parceiro',
      apiKey: 'worker-key-001',
      webhookUrl: 'https://example.com/webhook',
      contatoEmail: 'parceiro-worker@ping.test',
    },
  })
  parceiroId = parceiro.id

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Worker',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 5000,
      janelaCancelamentoDias: 30,
    },
  })
  campanhaId = campanha.id

  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Worker', email: 'afil-worker@ping.test', papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'WORKERTEST',
      linkIndicacao: 'https://ping.geengoo.io/a/WORKERTEST',
    },
  })
  participacaoId = participacao.id
})

afterAll(async () => {
  await prisma.webhookLog.deleteMany({ where: { parceiroId } })
  await prisma.reward.deleteMany({ where: { participacaoId } })
  await prisma.conversao.deleteMany({ where: { participacaoId } })
  await prisma.participacao.deleteMany({ where: { id: participacaoId } })
  await prisma.campanha.deleteMany({ where: { id: campanhaId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { email: { in: ['parceiro-worker@ping.test', 'afil-worker@ping.test'] } } })
  await prisma.$disconnect()
})

describe('confirmarConversoes', () => {
  it('confirma conversão cuja janela de cancelamento expirou', async () => {
    const passado = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    const conversao = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'order-worker-001',
        emailConvidado: 'cliente-worker@ping.test',
        valorCentavos: 14900,
        tipoCompra: 'subscription',
        produtoNome: 'Plano Mensal',
        criadoEm: passado,
        reward: {
          create: { participacaoId, tipo: 'fixo', valorCentavos: 5000, status: 'pendente' },
        },
      },
      include: { reward: true },
    })

    await confirmarConversoes()

    const conv = await prisma.conversao.findUnique({ where: { id: conversao.id } })
    expect(conv!.status).toBe('confirmada')
    expect(conv!.confirmadoEm).not.toBeNull()

    const rew = await prisma.reward.findUnique({ where: { id: conversao.reward!.id } })
    expect(rew!.status).toBe('disponivel')
    expect(rew!.disponivelEm).not.toBeNull()

    const log = await prisma.webhookLog.findFirst({
      where: { parceiroId, evento: 'conversion.confirmed' },
    })
    expect(log).not.toBeNull()
    expect(log!.sucesso).toBe(false)
    expect(log!.tentativas).toBe(0)
  })

  it('não toca conversão dentro da janela de cancelamento', async () => {
    const recente = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    const conversao = await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'order-worker-002',
        emailConvidado: 'cliente-worker2@ping.test',
        valorCentavos: 9900,
        tipoCompra: 'subscription',
        produtoNome: 'Plano Mensal',
        criadoEm: recente,
        reward: {
          create: { participacaoId, tipo: 'fixo', valorCentavos: 5000, status: 'pendente' },
        },
      },
    })

    await confirmarConversoes()

    const conv = await prisma.conversao.findUnique({ where: { id: conversao.id } })
    expect(conv!.status).toBe('pendente')
  })

  it('é idempotente — não reprocessa conversão já confirmada', async () => {
    const passado = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    await prisma.conversao.create({
      data: {
        participacaoId,
        pedidoIdExterno: 'order-worker-003',
        emailConvidado: 'cliente-worker3@ping.test',
        valorCentavos: 9900,
        tipoCompra: 'subscription',
        produtoNome: 'Plano Mensal',
        status: 'confirmada',
        confirmadoEm: new Date(),
        criadoEm: passado,
        reward: {
          create: { participacaoId, tipo: 'fixo', valorCentavos: 5000, status: 'disponivel' },
        },
      },
    })

    const logsBefore = await prisma.webhookLog.count({ where: { parceiroId, evento: 'conversion.confirmed' } })
    await confirmarConversoes()
    const logsAfter = await prisma.webhookLog.count({ where: { parceiroId, evento: 'conversion.confirmed' } })

    expect(logsAfter).toBe(logsBefore)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest confirmarConversoes --no-coverage
```

Expected: FAIL — `Cannot find module '../jobs/confirmarConversoes'`

- [ ] **Step 3: Criar `api/src/jobs/confirmarConversoes.ts`**

```typescript
import { prisma } from '../lib/prisma'
import { notificarAfiliadoRewardDisponivel } from '../lib/resend'

export async function confirmarConversoes() {
  const agora = new Date()

  const conversoes = await prisma.conversao.findMany({
    where: { status: 'pendente' },
    include: {
      participacao: {
        include: {
          campanha: { include: { parceiro: true } },
          afiliado: true,
        },
      },
      reward: true,
    },
  })

  let confirmadas = 0

  for (const conversao of conversoes) {
    const janelaDias = conversao.participacao.campanha.janelaCancelamentoDias
    const expiraEm = new Date(conversao.criadoEm)
    expiraEm.setDate(expiraEm.getDate() + janelaDias)
    if (expiraEm > agora) continue

    await prisma.$transaction(async (tx) => {
      await tx.conversao.update({
        where: { id: conversao.id },
        data: { status: 'confirmada', confirmadoEm: agora },
      })

      if (conversao.reward) {
        await tx.reward.update({
          where: { id: conversao.reward!.id },
          data: { status: 'disponivel', disponivelEm: agora },
        })
      }

      const webhookUrl = conversao.participacao.campanha.parceiro.webhookUrl
      if (webhookUrl) {
        await tx.webhookLog.create({
          data: {
            parceiroId: conversao.participacao.campanha.parceiroId,
            evento: 'conversion.confirmed',
            payload: {
              conversaoId: conversao.id,
              participacaoId: conversao.participacaoId,
              rewardId: conversao.reward?.id ?? null,
            },
            url: webhookUrl,
            tentativas: 0,
            sucesso: false,
          },
        })
      }
    })

    await notificarAfiliadoRewardDisponivel(
      conversao.participacao.afiliado.email,
      conversao.reward?.valorCentavos ?? 0,
      process.env.WEB_BASE_URL ?? ''
    )

    confirmadas++
  }

  console.log(`[confirmarConversoes] ${confirmadas} conversão(ões) confirmada(s)`)
}
```

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest confirmarConversoes --no-coverage
```

Expected: PASS — 3 testes

- [ ] **Step 5: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/jobs/confirmarConversoes.ts api/src/__tests__/confirmarConversoes.test.ts
git commit -m "feat: job confirmarConversoes com testes"
```

---

### Task 4: Job 2 — dispararWebhooks (TDD)

**Files:**
- Create: `api/src/jobs/dispararWebhooks.ts`
- Create: `api/src/__tests__/dispararWebhooks.test.ts`

**Interfaces:**
- Consumes: `prisma` de `../lib/prisma`, `global.fetch` (Node 18+)
- Produces: `dispararWebhooks(): Promise<void>`

- [ ] **Step 1: Criar `api/src/__tests__/dispararWebhooks.test.ts`**

```typescript
import { prisma } from '../lib/prisma'
import { dispararWebhooks } from '../jobs/dispararWebhooks'

let parceiroId: string

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Parceiro Webhook', email: 'parceiro-webhook@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: {
      contaId: conta.id,
      nomeFantasia: 'Webhook Parceiro',
      apiKey: 'webhook-key-001',
      webhookUrl: 'https://example.com/webhook',
    },
  })
  parceiroId = parceiro.id
})

afterAll(async () => {
  await prisma.webhookLog.deleteMany({ where: { parceiroId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { email: 'parceiro-webhook@ping.test' } })
  await prisma.$disconnect()
})

beforeEach(() => mockFetch.mockReset())

describe('dispararWebhooks', () => {
  it('dispara webhook pendente com sucesso e marca sucesso=true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'conversion.confirmed',
        payload: { conversaoId: 'abc-123' },
        url: 'https://example.com/webhook',
        tentativas: 0,
        sucesso: false,
      },
    })

    await dispararWebhooks()

    const atualizado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(atualizado!.sucesso).toBe(true)
    expect(atualizado!.tentativas).toBe(1)
    expect(atualizado!.statusCode).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('incrementa tentativas e registra erro quando webhook retorna 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'payout.overdue',
        payload: { rewardId: 'xyz-456' },
        url: 'https://example.com/webhook',
        tentativas: 0,
        sucesso: false,
      },
    })

    await dispararWebhooks()

    const atualizado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(atualizado!.sucesso).toBe(false)
    expect(atualizado!.tentativas).toBe(1)
    expect(atualizado!.statusCode).toBe(500)
    expect(atualizado!.erro).toBe('HTTP 500')
  })

  it('não reprocessa webhook com tentativas >= 4', async () => {
    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'conversion.created',
        payload: { conversaoId: 'esgotado' },
        url: 'https://example.com/webhook',
        tentativas: 4,
        sucesso: false,
        tentadoEm: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    })

    await dispararWebhooks()

    expect(mockFetch).not.toHaveBeenCalled()
    const naoAlterado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(naoAlterado!.tentativas).toBe(4)
  })

  it('respeita backoff — não dispara na 2ª tentativa antes de 1h', async () => {
    const log = await prisma.webhookLog.create({
      data: {
        parceiroId,
        evento: 'payout.requested',
        payload: { rewardId: 'backoff-abc' },
        url: 'https://example.com/webhook',
        tentativas: 1,
        sucesso: false,
        tentadoEm: new Date(Date.now() - 30 * 60 * 1000), // 30min atrás < 1h
      },
    })

    await dispararWebhooks()

    expect(mockFetch).not.toHaveBeenCalled()
    const naoAlterado = await prisma.webhookLog.findUnique({ where: { id: log.id } })
    expect(naoAlterado!.tentativas).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest dispararWebhooks --no-coverage
```

Expected: FAIL — `Cannot find module '../jobs/dispararWebhooks'`

- [ ] **Step 3: Criar `api/src/jobs/dispararWebhooks.ts`**

```typescript
import { prisma } from '../lib/prisma'
import type { WebhookLog } from '@prisma/client'

const BACKOFF_MS = [0, 60 * 60 * 1000, 4 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]

function backoffExpirou(log: WebhookLog): boolean {
  if (log.tentativas === 0) return true
  if (!log.tentadoEm) return true
  const delay = BACKOFF_MS[log.tentativas] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
  return Date.now() >= log.tentadoEm.getTime() + delay
}

export async function dispararWebhooks() {
  const logs = await prisma.webhookLog.findMany({
    where: { sucesso: false, tentativas: { lt: 4 } },
  })

  let disparados = 0

  for (const log of logs) {
    if (!backoffExpirou(log)) continue
    if (!log.url) continue

    const agora = new Date()

    try {
      const res = await fetch(log.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log.payload),
        signal: AbortSignal.timeout(10_000),
      })

      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          statusCode: res.status,
          sucesso: res.ok,
          tentativas: log.tentativas + 1,
          tentadoEm: agora,
          erro: res.ok ? null : `HTTP ${res.status}`,
        },
      })

      if (res.ok) disparados++
    } catch (err) {
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          tentativas: log.tentativas + 1,
          tentadoEm: agora,
          erro: err instanceof Error ? err.message : String(err),
        },
      })
    }
  }

  console.log(`[dispararWebhooks] ${disparados} webhook(s) disparado(s)`)
}
```

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest dispararWebhooks --no-coverage
```

Expected: PASS — 4 testes

- [ ] **Step 5: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/jobs/dispararWebhooks.ts api/src/__tests__/dispararWebhooks.test.ts
git commit -m "feat: job dispararWebhooks com retry backoff e testes"
```

---

### Task 5: Job 3 — alertarSaques (TDD)

**Files:**
- Modify: `api/src/__tests__/setup.ts`
- Create: `api/src/jobs/alertarSaques.ts`
- Create: `api/src/__tests__/alertarSaques.test.ts`

**Interfaces:**
- Consumes: `prisma`, `alertarParceiroLembrete`, `alertarParceiroVencido`, `alertarSuperadminSaqueVencido` de `../lib/resend`, `jwt.sign` de `jsonwebtoken`
- Produces: `alertarSaques(): Promise<void>`

- [ ] **Step 1: Adicionar variáveis de teste em `api/src/__tests__/setup.ts`**

Adicionar ao final do arquivo:

```typescript
process.env.WORKER_SECRET = 'test-worker-secret-do-not-use-in-prod'
process.env.WEB_BASE_URL = 'https://ping.geengoo.test'
process.env.SUPERADMIN_EMAIL = 'superadmin@ping.test'
```

- [ ] **Step 2: Criar `api/src/__tests__/alertarSaques.test.ts`**

```typescript
import { prisma } from '../lib/prisma'
import { alertarSaques } from '../jobs/alertarSaques'

let parceiroId: string
let campanhaId: string
let participacaoId: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Alertas', email: 'parceiro-alertas@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: {
      contaId: contaParceiro.id,
      nomeFantasia: 'Alertas Parceiro',
      apiKey: 'alertas-key-001',
      webhookUrl: 'https://example.com/webhook',
      contatoEmail: 'parceiro-alertas@ping.test',
    },
  })
  parceiroId = parceiro.id

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Alertas',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 5000,
      janelaCancelamentoDias: 30,
    },
  })
  campanhaId = campanha.id

  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Alertas', email: 'afil-alertas@ping.test', papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'ALERTATEST',
      linkIndicacao: 'https://ping.geengoo.io/a/ALERTATEST',
    },
  })
  participacaoId = participacao.id
})

afterAll(async () => {
  await prisma.webhookLog.deleteMany({ where: { parceiroId } })
  await prisma.reward.deleteMany({ where: { participacaoId } })
  await prisma.conversao.deleteMany({ where: { participacaoId } })
  await prisma.participacao.deleteMany({ where: { id: participacaoId } })
  await prisma.campanha.deleteMany({ where: { id: campanhaId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { email: { in: ['parceiro-alertas@ping.test', 'afil-alertas@ping.test'] } } })
  await prisma.$disconnect()
})

async function criarRewardSolicitado(diasAtras: number, sufixo: string) {
  const solicitadoEm = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
  const conv = await prisma.conversao.create({
    data: {
      participacaoId,
      pedidoIdExterno: `order-alerta-${sufixo}`,
      emailConvidado: `cliente-${sufixo}@ping.test`,
      valorCentavos: 14900,
      tipoCompra: 'subscription',
      produtoNome: 'Plano Mensal',
      status: 'confirmada',
      confirmadoEm: new Date(),
    },
  })
  return prisma.reward.create({
    data: {
      conversaoId: conv.id,
      participacaoId,
      tipo: 'fixo',
      valorCentavos: 5000,
      status: 'solicitado',
      solicitadoEm,
    },
  })
}

describe('alertarSaques', () => {
  it('seta alertaD3EnviadoEm para reward com 3+ dias solicitado', async () => {
    const reward = await criarRewardSolicitado(3, 'd3')

    await alertarSaques()

    const atualizado = await prisma.reward.findUnique({ where: { id: reward.id } })
    expect(atualizado!.alertaD3EnviadoEm).not.toBeNull()
    expect(atualizado!.alertaD5EnviadoEm).toBeNull()
  })

  it('não reenvia D+3 se alertaD3EnviadoEm já preenchido', async () => {
    const reward = await criarRewardSolicitado(3, 'd3-dup')
    const timestampOriginal = new Date(Date.now() - 1000)
    await prisma.reward.update({
      where: { id: reward.id },
      data: { alertaD3EnviadoEm: timestampOriginal },
    })

    await alertarSaques()

    const atualizado = await prisma.reward.findUnique({ where: { id: reward.id } })
    expect(atualizado!.alertaD3EnviadoEm!.getTime()).toBe(timestampOriginal.getTime())
  })

  it('seta alertaD5EnviadoEm e cria webhookLog payout.overdue para reward com 5+ dias', async () => {
    const reward = await criarRewardSolicitado(5, 'd5')

    await alertarSaques()

    const atualizado = await prisma.reward.findUnique({ where: { id: reward.id } })
    expect(atualizado!.alertaD5EnviadoEm).not.toBeNull()

    const log = await prisma.webhookLog.findFirst({
      where: { parceiroId, evento: 'payout.overdue' },
      orderBy: { criadoEm: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(log!.sucesso).toBe(false)
    expect(log!.tentativas).toBe(0)
  })

  it('não reenvia D+5 se alertaD5EnviadoEm já preenchido', async () => {
    const reward = await criarRewardSolicitado(5, 'd5-dup')
    await prisma.reward.update({
      where: { id: reward.id },
      data: { alertaD5EnviadoEm: new Date() },
    })

    const logsAntes = await prisma.webhookLog.count({ where: { parceiroId, evento: 'payout.overdue' } })
    await alertarSaques()
    const logsDepois = await prisma.webhookLog.count({ where: { parceiroId, evento: 'payout.overdue' } })

    expect(logsDepois).toBe(logsAntes)
  })
})
```

- [ ] **Step 3: Rodar teste para confirmar que falha**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest alertarSaques --no-coverage
```

Expected: FAIL — `Cannot find module '../jobs/alertarSaques'`

- [ ] **Step 4: Criar `api/src/jobs/alertarSaques.ts`**

```typescript
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import {
  alertarParceiroLembrete,
  alertarParceiroVencido,
  alertarSuperadminSaqueVencido,
} from '../lib/resend'

const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret'
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3041'
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || ''

function gerarToken(rewardId: string, action: 'confirm' | 'dispute'): string {
  return jwt.sign({ rewardId, action }, WORKER_SECRET, { algorithm: 'HS256', expiresIn: '7d' })
}

export async function alertarSaques() {
  const agora = new Date()

  const rewards = await prisma.reward.findMany({
    where: { status: 'solicitado' },
    include: {
      participacao: {
        include: {
          campanha: { include: { parceiro: true } },
          afiliado: true,
        },
      },
    },
  })

  for (const reward of rewards) {
    if (!reward.solicitadoEm) continue

    const diasDecorridos = Math.floor(
      (agora.getTime() - reward.solicitadoEm.getTime()) / (1000 * 60 * 60 * 24)
    )

    const parceiro = reward.participacao.campanha.parceiro
    const afiliado = reward.participacao.afiliado
    const emailParceiro = parceiro.contatoEmail
    if (!emailParceiro) continue

    if (diasDecorridos >= 3 && !reward.alertaD3EnviadoEm) {
      await alertarParceiroLembrete(emailParceiro, afiliado.nome, reward.valorCentavos)
      await prisma.reward.update({
        where: { id: reward.id },
        data: { alertaD3EnviadoEm: agora },
      })
    }

    if (diasDecorridos >= 5 && !reward.alertaD5EnviadoEm) {
      const tokenConfirm = gerarToken(reward.id, 'confirm')
      const tokenDispute = gerarToken(reward.id, 'dispute')

      await alertarParceiroVencido(
        emailParceiro,
        afiliado.nome,
        reward.valorCentavos,
        `${WEB_BASE_URL}/payout/${tokenConfirm}/confirm`,
        `${WEB_BASE_URL}/payout/${tokenDispute}/dispute`
      )

      if (SUPERADMIN_EMAIL) {
        await alertarSuperadminSaqueVencido(SUPERADMIN_EMAIL, afiliado.nome, reward.valorCentavos, reward.id)
      }

      if (parceiro.webhookUrl) {
        await prisma.webhookLog.create({
          data: {
            parceiroId: parceiro.id,
            evento: 'payout.overdue',
            payload: {
              rewardId: reward.id,
              participacaoId: reward.participacaoId,
              valorCentavos: reward.valorCentavos,
            },
            url: parceiro.webhookUrl,
            tentativas: 0,
            sucesso: false,
          },
        })
      }

      await prisma.reward.update({
        where: { id: reward.id },
        data: { alertaD5EnviadoEm: agora },
      })
    }
  }
}
```

- [ ] **Step 5: Rodar testes e confirmar que passam**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest alertarSaques --no-coverage
```

Expected: PASS — 4 testes

- [ ] **Step 6: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/jobs/alertarSaques.ts api/src/__tests__/alertarSaques.test.ts api/src/__tests__/setup.ts
git commit -m "feat: job alertarSaques com cadência D+3/D+5 e testes"
```

---

### Task 6: Worker orchestrador

**Files:**
- Modify: `api/src/worker.ts`
- Modify: `api/.env.example`

**Interfaces:**
- Consumes: `confirmarConversoes`, `dispararWebhooks`, `alertarSaques`

- [ ] **Step 1: Substituir `api/src/worker.ts`**

```typescript
import 'dotenv/config'
import { confirmarConversoes } from './jobs/confirmarConversoes'
import { dispararWebhooks } from './jobs/dispararWebhooks'
import { alertarSaques } from './jobs/alertarSaques'

async function tick() {
  console.log('[worker] tick —', new Date().toISOString())
  try {
    await confirmarConversoes()
  } catch (err) {
    console.error('[worker] confirmarConversoes erro:', err)
  }
  try {
    await dispararWebhooks()
  } catch (err) {
    console.error('[worker] dispararWebhooks erro:', err)
  }
  try {
    await alertarSaques()
  } catch (err) {
    console.error('[worker] alertarSaques erro:', err)
  }
}

async function main() {
  console.log('[worker] iniciando')
  await tick()
  setInterval(tick, 60 * 60 * 1000)
}

main().catch((err) => {
  console.error('[worker] erro fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Adicionar vars em `api/.env.example`**

```
SUPERADMIN_EMAIL=admin@geengoo.com.br
WORKER_SECRET=gere-com-openssl-rand-base64-32
WEB_BASE_URL=https://ping.geengoo.io
```

- [ ] **Step 3: Rodar todos os testes da api**

```bash
cd /root/Projetos/geengoo/ping/api && npx jest --no-coverage
```

Expected: PASS — todos os testes (23 existentes + 11 novos = 34+)

- [ ] **Step 4: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/worker.ts api/.env.example
git commit -m "feat: worker orquestra 3 jobs — confirmar conversões, webhooks, alertas"
```

---

### Task 7: Web — páginas de ação confirm e dispute

**Files:**
- Create: `web/lib/payoutToken.ts`
- Create: `web/app/payout/[token]/confirm/page.tsx`
- Create: `web/app/payout/[token]/dispute/page.tsx`

**Interfaces:**
- Consumes: `jwtVerify` de `jose`, `prisma` de `@/lib/prisma`, funções de `@/lib/resend`
- Produces: rotas `/payout/[token]/confirm` e `/payout/[token]/dispute` acessíveis sem login

**Nota:** O token é assinado com `HS256` usando `WORKER_SECRET` pelo job alertarSaques (`jsonwebtoken`) e verificado aqui com `jose`. São compatíveis desde que o mesmo `WORKER_SECRET` seja usado em ambos.

- [ ] **Step 1: Verificar docs do Next.js 16**

```bash
ls /root/Projetos/geengoo/ping/node_modules/next/dist/docs/ 2>/dev/null | head -20
```

Ler os arquivos relevantes sobre server actions, params como Promise, e redirect pós-action antes de continuar.

- [ ] **Step 2: Criar `web/lib/payoutToken.ts`**

```typescript
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.WORKER_SECRET || 'dev-secret')

export type PayoutTokenPayload = {
  rewardId: string
  action: 'confirm' | 'dispute'
}

export async function verificarPayoutToken(
  token: string,
  actionEsperada: 'confirm' | 'dispute'
): Promise<PayoutTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  if (typeof payload.rewardId !== 'string' || payload.action !== actionEsperada) {
    throw new Error('token inválido ou ação incorreta')
  }
  return { rewardId: payload.rewardId, action: payload.action }
}
```

- [ ] **Step 3: Criar `web/app/payout/[token]/confirm/page.tsx`**

Lógica: GET renderiza a página com os dados do reward. Se o reward não está mais `solicitado` (já foi processado), mostra mensagem "já confirmado". Caso contrário, exibe botão de confirmação que dispara server action.

```tsx
import { verificarPayoutToken } from '@/lib/payoutToken'
import { prisma } from '@/lib/prisma'
import { notificarAfiliadoConfirmadoParceiro } from '@/lib/resend'

type Props = { params: Promise<{ token: string }> }

export default async function ConfirmPage({ params }: Props) {
  const { token } = await params

  let rewardId: string
  let nomeAfiliado: string
  let valorCentavos: number
  let jaProcessado = false

  try {
    const payload = await verificarPayoutToken(token, 'confirm')
    rewardId = payload.rewardId

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
      include: { participacao: { include: { afiliado: true } } },
    })

    if (!reward) return <Pagina titulo="Não encontrado" mensagem="Saque não encontrado." cor="vermelho" />

    nomeAfiliado = reward.participacao.afiliado.nome
    valorCentavos = reward.valorCentavos

    if (reward.status !== 'solicitado') jaProcessado = true
  } catch {
    return <Pagina titulo="Link inválido" mensagem="Este link é inválido ou expirou." cor="vermelho" />
  }

  if (jaProcessado) {
    return <Pagina titulo="Já confirmado" mensagem="Este pagamento já foi registrado anteriormente." cor="verde" />
  }

  const valor = (valorCentavos! / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function confirmar() {
    'use server'
    try {
      const payload = await verificarPayoutToken(token, 'confirm')
      const reward = await prisma.reward.findUnique({
        where: { id: payload.rewardId },
        include: { participacao: { include: { afiliado: true } } },
      })
      if (!reward || reward.status !== 'solicitado') return
      await prisma.reward.update({
        where: { id: payload.rewardId },
        data: { status: 'pago', pagoEm: new Date() },
      })
      await notificarAfiliadoConfirmadoParceiro(
        reward.participacao.afiliado.email,
        reward.valorCentavos
      )
    } catch {
      // token inválido — não faz nada
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2">Confirmar pagamento</h1>
        <p className="text-gray-600 mb-6">
          Você confirma que realizou o pagamento de <strong>{valor}</strong> para{' '}
          <strong>{nomeAfiliado!}</strong>?
        </p>
        <form action={confirmar}>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 w-full"
          >
            Sim, confirmar pagamento
          </button>
        </form>
      </div>
    </main>
  )
}

function Pagina({ titulo, mensagem, cor }: { titulo: string; mensagem: string; cor: 'verde' | 'vermelho' }) {
  const corClasse = cor === 'verde' ? 'text-green-600' : 'text-red-600'
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className={`text-xl font-semibold mb-2 ${corClasse}`}>{titulo}</h1>
        <p className="text-gray-600">{mensagem}</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Criar `web/app/payout/[token]/dispute/page.tsx`**

Lógica: GET renderiza o formulário de data/observação. Se `previsaoPagamentoEm` já está preenchido, mostra "já registrado". Server action salva a data e envia emails.

```tsx
import { verificarPayoutToken } from '@/lib/payoutToken'
import { prisma } from '@/lib/prisma'
import { notificarAfiliadoPrevisaoPagamento, notificarSuperadminPrevisao } from '@/lib/resend'

type Props = { params: Promise<{ token: string }> }

export default async function DisputePage({ params }: Props) {
  const { token } = await params

  let nomeAfiliado: string
  let valorCentavos: number
  let jaRegistrado = false

  try {
    const payload = await verificarPayoutToken(token, 'dispute')

    const reward = await prisma.reward.findUnique({
      where: { id: payload.rewardId },
      include: { participacao: { include: { afiliado: true } } },
    })

    if (!reward) return <Pagina titulo="Não encontrado" mensagem="Saque não encontrado." cor="vermelho" />

    nomeAfiliado = reward.participacao.afiliado.nome
    valorCentavos = reward.valorCentavos

    if (reward.previsaoPagamentoEm) jaRegistrado = true
  } catch {
    return <Pagina titulo="Link inválido" mensagem="Este link é inválido ou expirou." cor="vermelho" />
  }

  if (jaRegistrado) {
    return <Pagina titulo="Já registrado" mensagem="Uma previsão de pagamento já foi informada para este saque." cor="verde" />
  }

  const valor = (valorCentavos! / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function registrarPrevisao(formData: FormData) {
    'use server'
    const dataStr = formData.get('data') as string
    const observacao = (formData.get('observacao') as string) || undefined
    if (!dataStr) return

    try {
      const payload = await verificarPayoutToken(token, 'dispute')
      const reward = await prisma.reward.findUnique({
        where: { id: payload.rewardId },
        include: { participacao: { include: { afiliado: true } } },
      })
      if (!reward || reward.previsaoPagamentoEm) return

      const previsao = new Date(dataStr)
      await prisma.reward.update({
        where: { id: payload.rewardId },
        data: { previsaoPagamentoEm: previsao },
      })

      await notificarAfiliadoPrevisaoPagamento(
        reward.participacao.afiliado.email,
        reward.valorCentavos,
        previsao,
        observacao
      )

      const superadmin = process.env.SUPERADMIN_EMAIL
      if (superadmin) {
        await notificarSuperadminPrevisao(
          superadmin,
          reward.participacao.afiliado.nome,
          reward.valorCentavos,
          previsao
        )
      }
    } catch {
      // token inválido — não faz nada
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full">
        <h1 className="text-xl font-semibold mb-2">Informe a previsão de pagamento</h1>
        <p className="text-gray-600 mb-6">
          Saque de <strong>{valor}</strong> para <strong>{nomeAfiliado!}</strong>.
          Quando você irá realizar o pagamento?
        </p>
        <form action={registrarPrevisao} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data prevista de pagamento
            </label>
            <input
              type="date"
              name="data"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação para o afiliado (opcional)
            </label>
            <textarea
              name="observacao"
              rows={3}
              placeholder="Ex: aguardando aprovação financeira"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 w-full"
          >
            Confirmar previsão
          </button>
        </form>
      </div>
    </main>
  )
}

function Pagina({ titulo, mensagem, cor }: { titulo: string; mensagem: string; cor: 'verde' | 'vermelho' }) {
  const corClasse = cor === 'verde' ? 'text-green-600' : 'text-red-600'
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <h1 className={`text-xl font-semibold mb-2 ${corClasse}`}>{titulo}</h1>
        <p className="text-gray-600">{mensagem}</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Verificar TypeScript do web**

```bash
cd /root/Projetos/geengoo/ping/web && npx tsc --noEmit
```

Expected: sem erros. Se houver erros de tipagem relativos a `params` ou server actions no Next.js 16, consultar `node_modules/next/dist/docs/` e ajustar.

- [ ] **Step 6: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/lib/payoutToken.ts web/app/payout/ web/lib/resend.ts
git commit -m "feat: páginas de ação confirm/dispute para botões do email D+5"
```

---

### Task 8: Deploy e verificação

**Files:**
- `.env` do api no servidor (valores reais)
- `.env.local` do web no servidor (valores reais)

- [ ] **Step 1: Adicionar variáveis reais ao `.env` da api no servidor**

```
SUPERADMIN_EMAIL=f@biocosta.com.br
WORKER_SECRET=$(openssl rand -base64 32)
WEB_BASE_URL=https://ping.geengoo.io
```

- [ ] **Step 2: Adicionar `WORKER_SECRET` e `SUPERADMIN_EMAIL` ao `.env.local` da web**

```
WORKER_SECRET=<mesmo valor gerado no Step 1>
SUPERADMIN_EMAIL=f@biocosta.com.br
```

- [ ] **Step 3: Rodar deploy**

```bash
cd /root/Projetos/geengoo/ping && ./deploy.sh
```

- [ ] **Step 4: Verificar worker no PM2**

```bash
pm2 logs ping-worker --lines 30 --nostream
```

Expected: `[worker] iniciando`, `[confirmarConversoes] 0 conversão(ões) confirmada(s)`, `[dispararWebhooks] 0 webhook(s) disparado(s)` — sem erros.

- [ ] **Step 5: Push para GitHub**

```bash
cd /root/Projetos/geengoo/ping && git push origin main
```
