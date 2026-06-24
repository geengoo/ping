# ping — Parte 1: Foundation + API Pública

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold completo de `api/` (Express) e `web/` (Next.js 16), schema Prisma com migration, auth por magic link, e todos os endpoints v1 que o ecoa precisa para integrar — testável via curl ao final.

**Architecture:** Dois contextos no mesmo repositório: `api/` (Express 4, porta 3040) expõe a API pública autenticada por `X-API-Key`; `web/` (Next.js 16, porta 3041) servirá os dashboards com auth por JWT cookie. Prisma 7 como ORM em ambos; migrations rodam exclusivamente de `api/prisma/`. O `web/prisma/schema.prisma` é cópia idêntica — apenas para `prisma generate` gerar os tipos.

**Tech Stack:** Express 4 + TypeScript 5, Next.js 16 + Tailwind v4, Prisma 7.8, PostgreSQL VPS2 (banco `ping`), Resend, Jest 29 + ts-jest + supertest, jose (JWT no Next.js), jsonwebtoken (JWT no Express)

## Global Constraints

- Node.js >= 18
- TypeScript strict mode nos dois contextos
- Moeda sempre em centavos (`Int`), nunca `Float`
- IDs: UUID v4 via `@default(uuid())` no Prisma
- Migrations rodam **somente** de `api/prisma/` — nunca de `web/prisma/`
- Banco produção: `ping` | banco de testes: `ping_test` (mesmo VPS2)
- `NEXT_PUBLIC_BASE_URL` = `https://ping.geengoo.io` em produção
- Emails nunca são enviados em `NODE_ENV=test` — verificar `process.env.NODE_ENV === 'test'` antes de chamar Resend
- `conecta food` — sempre minúsculo se aparecer em copy (padrão geengoo)

---

## File Map

### api/

| Arquivo | Responsabilidade |
|---|---|
| `api/src/server.ts` | Express app exportável + entry point |
| `api/src/routes/affiliates.ts` | `POST /v1/affiliates`, `GET /v1/affiliates/:id/balance` |
| `api/src/routes/conversions.ts` | `POST /v1/conversions`, `POST /v1/conversions/:id/cancel` |
| `api/src/routes/payouts.ts` | `POST /v1/payouts/:id/confirm` |
| `api/src/middleware/apiKey.ts` | Valida `X-API-Key`, injeta `req.parceiro` |
| `api/src/lib/prisma.ts` | Prisma client singleton |
| `api/src/lib/resend.ts` | Envio de emails transacionais |
| `api/src/lib/validate.ts` | Regras: self-referral, duplicata, campanha ativa |
| `api/src/lib/reward.ts` | Calcular valor do reward (fixo ou percentual) |
| `api/prisma/schema.prisma` | Schema fonte da verdade — migrations rodam daqui |

### web/

| Arquivo | Responsabilidade |
|---|---|
| `web/app/api/auth/request/route.ts` | `POST` — cria token e envia email |
| `web/app/api/auth/verify/route.ts` | `POST` — verifica código, seta cookie JWT |
| `web/app/api/auth/logout/route.ts` | `POST` — limpa cookie |
| `web/lib/auth.ts` | `getSessao()`, `setTokenCookie()`, helpers JWT |
| `web/lib/prisma.ts` | Prisma client singleton |
| `web/lib/resend.ts` | Envio de magic link |
| `web/middleware.ts` | Proteção de rotas `/a/*` e `/admin/*` |
| `web/app/a/login/page.tsx` | Form: email → solicita magic link |
| `web/app/a/login/verificar/page.tsx` | Form: código 6 dígitos → login |
| `web/prisma/schema.prisma` | Cópia idêntica do api/prisma — só para `prisma generate` |

---

### Task 1: Scaffold — api/ e web/

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/src/server.ts`
- Create: `api/.env.example`
- Create: `web/` (Next.js 16 inicializado manualmente)
- Modify: `ecosystem.config.js`

**Interfaces:**
- Produces: `GET /health` → `{ ok: true }`; `web/` compilando sem erros

- [ ] **Step 1: Criar estrutura de diretórios**

```bash
cd /root/Projetos/geengoo/ping
mkdir -p api/src/{routes,middleware,jobs,lib} api/prisma api/src/__tests__
mkdir -p web/app/{a,admin} web/lib web/prisma web/public
```

- [ ] **Step 2: Criar api/package.json**

```json
{
  "name": "ping-api",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "worker:start": "node dist/worker.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@prisma/client": "^7.8.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "nanoid": "^3.3.7",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.14",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.17.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^7.8.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.3"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.ts"],
    "setupFiles": ["<rootDir>/src/__tests__/setup.ts"]
  }
}
```

- [ ] **Step 3: Criar api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Criar api/src/__tests__/setup.ts**

```typescript
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod'
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://ping:ping_2026@187.77.56.138:5432/ping_test'
```

- [ ] **Step 5: Criar api/src/server.ts**

```typescript
import 'dotenv/config'
import express from 'express'
import cors from 'cors'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// routes montadas nas tasks seguintes

if (require.main === module) {
  const port = process.env.PORT || 3040
  app.listen(port, () => console.log(`ping-api porta ${port}`))
}
```

- [ ] **Step 6: Escrever e rodar primeiro teste**

Criar `api/src/__tests__/health.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../server'

describe('GET /health', () => {
  it('retorna ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
```

```bash
cd /root/Projetos/geengoo/ping/api
npm install
npm test
```

Expected: `PASS src/__tests__/health.test.ts` — 1 passing

- [ ] **Step 7: Inicializar web/**

Copiar configs do Next.js existente na raiz:

```bash
cd /root/Projetos/geengoo/ping
cp next.config.ts web/
cp tsconfig.json web/
cp next-env.d.ts web/
cp postcss.config.mjs web/
cp eslint.config.mjs web/
cp -r public/* web/public/ 2>/dev/null || true
```

Criar `web/package.json`:

```json
{
  "name": "ping-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3041",
    "build": "prisma generate && next build",
    "start": "next start -p 3041",
    "lint": "eslint"
  },
  "dependencies": {
    "@prisma/client": "^7.8.0",
    "jose": "^6.0.11",
    "lucide-react": "^0.523.0",
    "nanoid": "^5.1.11",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "prisma": "^7.8.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

Criar `web/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}
```

Criar `web/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ping',
  description: 'Motor de indicações',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

Criar `web/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/a/login')
}
```

```bash
cd /root/Projetos/geengoo/ping/web
npm install
npm run build
```

Expected: build sem erros (algumas páginas com `generateStaticParams` podem dar warning — ignorar por ora)

- [ ] **Step 8: Atualizar ecosystem.config.js**

```javascript
module.exports = {
  apps: [
    {
      name: 'ping-api',
      script: 'node',
      args: 'dist/server.js',
      cwd: '/root/Projetos/geengoo/ping/api',
      env: {
        NODE_ENV: 'production',
        PORT: '3040',
        DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/ping',
        JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: 'noreply@geengoo.com.br',
        BASE_URL: 'https://ping.geengoo.io',
      },
    },
    {
      name: 'ping-worker',
      script: 'node',
      args: 'dist/worker.js',
      cwd: '/root/Projetos/geengoo/ping/api',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/ping',
        JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: 'noreply@geengoo.com.br',
        BASE_URL: 'https://ping.geengoo.io',
      },
    },
    {
      name: 'ping-web',
      script: 'npm',
      args: 'start',
      cwd: '/root/Projetos/geengoo/ping/web',
      env: {
        NODE_ENV: 'production',
        PORT: '3041',
        DATABASE_URL: 'postgresql://ping:ping_2026@187.77.56.138:5432/ping',
        JWT_SECRET: 'ping_jwt_prod_6214d827508d02f29cbc3508f420c2d8',
        SUPERADMIN_EMAIL: 'fabio@geengoo.com.br',
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: 'noreply@geengoo.com.br',
        NEXT_PUBLIC_BASE_URL: 'https://ping.geengoo.io',
      },
    },
  ],
}
```

- [ ] **Step 9: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/ web/ ecosystem.config.js
git commit -m "feat: scaffold api/ e web/ — Express + Next.js 16"
```

---

### Task 2: Prisma Schema + Migration

**Files:**
- Create: `api/prisma/schema.prisma`
- Create: `api/src/lib/prisma.ts`
- Create: `web/prisma/schema.prisma` (cópia)
- Create: `web/lib/prisma.ts`

**Interfaces:**
- Produces: banco `ping` e `ping_test` criados no VPS2; Prisma Client gerado nos dois contextos com tipos completos

- [ ] **Step 1: Criar banco ping e ping_test no VPS2**

```bash
psql postgresql://geengoo:UzOe5J1sp9SYak7T4pNezWSyghFfL9F@187.77.56.138:5432/postgres -c "
CREATE USER ping WITH PASSWORD 'ping_2026';
CREATE DATABASE ping OWNER ping;
CREATE DATABASE ping_test OWNER ping;
GRANT ALL PRIVILEGES ON DATABASE ping TO ping;
GRANT ALL PRIVILEGES ON DATABASE ping_test TO ping;
"
```

Expected: `CREATE ROLE`, `CREATE DATABASE` (x2), `GRANT` (x2)

- [ ] **Step 2: Criar api/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Conta {
  id             String    @id @default(uuid())
  nome           String
  email          String    @unique
  papeis         String[]
  status         String    @default("ativo")
  tipoAcesso     String    @default("pago") @map("tipo_acesso")
  convidadoPorId String?   @map("convidado_por_id")
  convidadoEm    DateTime? @map("convidado_em")
  criadoEm       DateTime  @default(now()) @map("criado_em")

  tokens        TokenAcesso[]
  parceiro      Parceiro?
  participacoes Participacao[]

  @@map("contas")
}

model TokenAcesso {
  id       String   @id @default(uuid())
  contaId  String   @map("conta_id")
  codigo   String
  expiraEm DateTime @map("expira_em")
  usado    Boolean  @default(false)
  criadoEm DateTime @default(now()) @map("criado_em")

  conta Conta @relation(fields: [contaId], references: [id], onDelete: Cascade)

  @@map("tokens_acesso")
}

model Parceiro {
  id           String  @id @default(uuid())
  contaId      String  @unique @map("conta_id")
  razaoSocial  String? @map("razao_social")
  nomeFantasia String? @map("nome_fantasia")
  cnpj         String? @unique
  segmento     String?
  site         String?
  status       String  @default("ativo")

  contatoNome     String? @map("contato_nome")
  contatoEmail    String? @map("contato_email")
  contatoTelefone String? @map("contato_telefone")
  contatoCargo    String? @map("contato_cargo")

  termosVersao   String?   @map("termos_versao")
  termosAceitoEm DateTime? @map("termos_aceito_em")
  termosIpAceite String?   @map("termos_ip_aceite")
  termosHashDoc  String?   @map("termos_hash_doc")

  plano            String?   @default("basico")
  inicioAssinatura DateTime? @map("inicio_assinatura")
  webhookUrl       String?   @map("webhook_url")
  apiKey           String    @unique @map("api_key")

  criadoEm DateTime @default(now()) @map("criado_em")

  conta       Conta        @relation(fields: [contaId], references: [id])
  campanhas   Campanha[]
  webhookLogs WebhookLog[]

  @@map("parceiros")
}

model Campanha {
  id         String @id @default(uuid())
  parceiroId String @map("parceiro_id")
  nome       String
  status     String @default("ativa")

  inicioEm     DateTime? @map("inicio_em")
  fimEm        DateTime? @map("fim_em")
  fechamentoEm DateTime? @map("fechamento_em")

  tiposCompraElegiveis   String[] @map("tipos_compra_elegiveis")
  janelaCancelamentoDias Int      @default(30) @map("janela_cancelamento_dias")
  atribuicao             String   @default("last-touch")

  recompensaTipo          String @map("recompensa_tipo")
  recompensaValorCentavos Int    @map("recompensa_valor_centavos")
  diaPagamento            Int    @default(5) @map("dia_pagamento")

  criadoEm DateTime @default(now()) @map("criado_em")

  parceiro      Parceiro       @relation(fields: [parceiroId], references: [id])
  participacoes Participacao[]

  @@map("campanhas")
}

model Participacao {
  id              String    @id @default(uuid())
  campanhaId      String    @map("campanha_id")
  afiliadoId      String    @map("afiliado_id")
  linkIndicacao   String    @unique @map("link_indicacao")
  codigoIndicacao String    @unique @map("codigo_indicacao")
  chavePix        String?   @map("chave_pix")
  status          String    @default("ativo")
  entrouEm        DateTime  @default(now()) @map("entrou_em")
  ultimoSaqueEm   DateTime? @map("ultimo_saque_em")

  campanha   Campanha    @relation(fields: [campanhaId], references: [id])
  afiliado   Conta       @relation(fields: [afiliadoId], references: [id])
  conversoes Conversao[]
  rewards    Reward[]

  @@unique([campanhaId, afiliadoId])
  @@map("participacoes")
}

model Conversao {
  id                 String    @id @default(uuid())
  participacaoId     String    @map("participacao_id")
  pedidoIdExterno    String    @map("pedido_id_externo")
  emailConvidado     String    @map("email_convidado")
  convidadoIdExterno String?   @map("convidado_id_externo")
  valorCentavos      Int       @map("valor_centavos")
  tipoCompra         String    @map("tipo_compra")

  produtoNome      String  @map("produto_nome")
  produtoIdExterno String? @map("produto_id_externo")
  produtoDescricao String? @map("produto_descricao")

  status             String    @default("pendente")
  motivoCancelamento String?   @map("motivo_cancelamento")
  canceladoEm        DateTime? @map("cancelado_em")
  canceladoPorId     String?   @map("cancelado_por_id")

  criadoEm     DateTime  @default(now()) @map("criado_em")
  confirmadoEm DateTime? @map("confirmado_em")

  participacao Participacao @relation(fields: [participacaoId], references: [id])
  reward       Reward?

  @@unique([participacaoId, pedidoIdExterno])
  @@map("conversoes")
}

model Reward {
  id             String @id @default(uuid())
  conversaoId    String @unique @map("conversao_id")
  participacaoId String @map("participacao_id")

  tipo          String
  valorCentavos Int    @map("valor_centavos")

  status         String  @default("pendente")
  motivoReversao String? @map("motivo_reversao")

  criadoEm     DateTime  @default(now()) @map("criado_em")
  confirmadoEm DateTime? @map("confirmado_em")
  disponivelEm DateTime? @map("disponivel_em")
  solicitadoEm DateTime? @map("solicitado_em")
  pagoEm       DateTime? @map("pago_em")
  revertidoEm  DateTime? @map("revertido_em")

  conversao    Conversao    @relation(fields: [conversaoId], references: [id])
  participacao Participacao @relation(fields: [participacaoId], references: [id])

  @@map("rewards")
}

model WebhookLog {
  id         String    @id @default(uuid())
  parceiroId String    @map("parceiro_id")
  evento     String
  payload    Json
  url        String
  statusCode Int?      @map("status_code")
  tentativas Int       @default(0)
  sucesso    Boolean   @default(false)
  erro       String?
  criadoEm   DateTime  @default(now()) @map("criado_em")
  tentadoEm  DateTime? @map("tentado_em")

  parceiro Parceiro @relation(fields: [parceiroId], references: [id])

  @@map("webhook_logs")
}
```

- [ ] **Step 3: Criar api/src/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Rodar migration**

```bash
cd /root/Projetos/geengoo/ping/api
DATABASE_URL="postgresql://ping:ping_2026@187.77.56.138:5432/ping" npx prisma migrate dev --name init
DATABASE_URL="postgresql://ping:ping_2026@187.77.56.138:5432/ping" npx prisma generate
```

Expected: `Your database is now in sync with your schema.` + arquivo de migration criado em `api/prisma/migrations/`.

- [ ] **Step 5: Aplicar migration no banco de teste**

```bash
cd /root/Projetos/geengoo/ping/api
DATABASE_URL="postgresql://ping:ping_2026@187.77.56.138:5432/ping_test" npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 6: Copiar schema para web/ e gerar client**

```bash
cp /root/Projetos/geengoo/ping/api/prisma/schema.prisma /root/Projetos/geengoo/ping/web/prisma/schema.prisma

cat > /root/Projetos/geengoo/ping/web/lib/prisma.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
EOF

cd /root/Projetos/geengoo/ping/web
DATABASE_URL="postgresql://ping:ping_2026@187.77.56.138:5432/ping" npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 7: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/prisma/ api/src/lib/prisma.ts web/prisma/ web/lib/prisma.ts
git commit -m "feat: schema Prisma completo e migration inicial"
```

---

### Task 3: Auth — Magic Link

**Files:**
- Create: `web/app/api/auth/request/route.ts`
- Create: `web/app/api/auth/verify/route.ts`
- Create: `web/app/api/auth/logout/route.ts`
- Create: `web/lib/auth.ts`
- Create: `web/lib/resend.ts`
- Create: `web/middleware.ts`
- Create: `web/app/a/login/page.tsx`
- Create: `web/app/a/login/verificar/page.tsx`

**Interfaces:**
- Produces:
  - `POST /api/auth/request` `{ email }` → `{ message: "código enviado" }`
  - `POST /api/auth/verify` `{ email, codigo }` → seta cookie `ping_token`, redireciona
  - `getSessao()` → `{ contaId: string, email: string, papeis: string[] } | null`

- [ ] **Step 1: Criar web/lib/resend.ts**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function enviarCodigoLogin(para: string, codigo: string, baseUrl: string) {
  if (process.env.NODE_ENV === 'test') return

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@geengoo.com.br',
    to: para,
    subject: `${codigo} — seu código de acesso ao ping`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <p style="color:#666;margin-bottom:24px">Use o código abaixo para acessar o ping:</p>
        <div style="font-size:40px;font-weight:700;letter-spacing:12px;color:#111;margin-bottom:24px">${codigo}</div>
        <p style="color:#999;font-size:14px">Válido por 15 minutos. Uso único.</p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Criar web/lib/auth.ts**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = 'ping_token'

export interface Sessao {
  contaId: string
  email: string
  papeis: string[]
}

export async function criarToken(payload: Sessao): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verificarToken(token: string): Promise<Sessao | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as Sessao
  } catch {
    return null
  }
}

export async function getSessao(): Promise<Sessao | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  return verificarToken(token)
}
```

- [ ] **Step 3: Criar web/app/api/auth/request/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarCodigoLogin } from '@/lib/resend'

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const { email, nome } = await req.json() as { email?: string; nome?: string }
  if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 })

  let conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email, nome: nome || email, papeis: [] },
    })
  }

  await prisma.tokenAcesso.updateMany({
    where: { contaId: conta.id, usado: false },
    data: { usado: true },
  })

  const codigo = gerarCodigo()
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.tokenAcesso.create({
    data: { contaId: conta.id, codigo, expiraEm },
  })

  await enviarCodigoLogin(email, codigo, process.env.NEXT_PUBLIC_BASE_URL || '')

  return NextResponse.json({ message: 'código enviado' })
}
```

- [ ] **Step 4: Criar web/app/api/auth/verify/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, codigo } = await req.json() as { email?: string; codigo?: string }
  if (!email || !codigo) {
    return NextResponse.json({ error: 'email e código obrigatórios' }, { status: 400 })
  }

  const conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) return NextResponse.json({ error: 'conta não encontrada' }, { status: 401 })

  const token = await prisma.tokenAcesso.findFirst({
    where: {
      contaId: conta.id,
      codigo,
      usado: false,
      expiraEm: { gt: new Date() },
    },
  })

  if (!token) return NextResponse.json({ error: 'código inválido ou expirado' }, { status: 401 })

  await prisma.tokenAcesso.update({ where: { id: token.id }, data: { usado: true } })

  const jwt = await criarToken({ contaId: conta.id, email: conta.email, papeis: conta.papeis })

  const isSuperadmin = conta.papeis.includes('superadmin')
  const redirectTo = isSuperadmin ? '/admin' : `/a/${await getCodigoAfiliado(conta.id)}`

  const res = NextResponse.redirect(new URL(redirectTo, req.url))
  res.cookies.set('ping_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return res
}

async function getCodigoAfiliado(contaId: string): Promise<string> {
  const participacao = await prisma.participacao.findFirst({
    where: { afiliadoId: contaId },
    orderBy: { entrouEm: 'desc' },
  })
  return participacao?.codigoIndicacao ?? 'login'
}
```

- [ ] **Step 5: Criar web/app/api/auth/logout/route.ts**

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.redirect(new URL('/a/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3041'))
  res.cookies.delete('ping_token')
  return res
}
```

- [ ] **Step 6: Criar web/middleware.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verificarToken } from './lib/auth'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('ping_token')?.value

  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
  const isAfiliadoRoute =
    req.nextUrl.pathname.startsWith('/a/') &&
    !req.nextUrl.pathname.startsWith('/a/login')

  if (!isAdminRoute && !isAfiliadoRoute) return NextResponse.next()

  if (!token) return NextResponse.redirect(new URL('/a/login', req.url))

  const sessao = await verificarToken(token)
  if (!sessao) return NextResponse.redirect(new URL('/a/login', req.url))

  if (isAdminRoute && !sessao.papeis.includes('superadmin')) {
    return NextResponse.redirect(new URL('/a/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/a/:path*'],
}
```

- [ ] **Step 7: Criar web/app/a/login/page.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setEnviado(true)
    router.push(`/a/login/verificar?email=${encodeURIComponent(email)}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">Acessar ping</h1>
        <p className="text-gray-500 mb-8 text-sm">Você receberá um código de 6 dígitos por email.</p>
        {!enviado && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Continuar'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Criar web/app/a/login/verificar/page.tsx**

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
      setErro('Código inválido ou expirado. Tente novamente.')
      setLoading(false)
    }
    // redirect is handled server-side
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
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
            className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-black"
          />
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={loading || codigo.length < 6}
            className="w-full bg-black text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
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

- [ ] **Step 9: Build web/ para verificar**

```bash
cd /root/Projetos/geengoo/ping/web
DATABASE_URL="postgresql://ping:ping_2026@187.77.56.138:5432/ping" npm run build
```

Expected: build sem erros de TypeScript

- [ ] **Step 10: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add web/
git commit -m "feat: auth magic link — request/verify/logout + páginas de login"
```

---

### Task 4: API Key Middleware + Prisma lib no api/

**Files:**
- Create: `api/src/middleware/apiKey.ts`
- Create: `api/src/lib/resend.ts`
- Modify: `api/src/server.ts` (montar rotas v1)
- Create: `api/src/__tests__/apiKey.test.ts`

**Interfaces:**
- Produces: rotas protegidas por `X-API-Key`; `req.parceiro` disponível nas rotas
- Consumes: `Parceiro` do Prisma com campo `apiKey`

- [ ] **Step 1: Escrever teste falhando**

Criar `api/src/__tests__/apiKey.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let parceiroId: string
let contaId: string

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Teste Parceiro', email: 'parceiro-test@ping.test', papeis: ['parceiro'] },
  })
  contaId = conta.id
  const parceiro = await prisma.parceiro.create({
    data: { contaId: conta.id, nomeFantasia: 'Teste', apiKey: 'test-key-123' },
  })
  parceiroId = parceiro.id
})

afterAll(async () => {
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { id: contaId } })
  await prisma.$disconnect()
})

describe('API Key middleware', () => {
  it('rejeita request sem X-API-Key', async () => {
    const res = await request(app).post('/v1/affiliates').send({})
    expect(res.status).toBe(401)
  })

  it('rejeita X-API-Key inválida', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', 'chave-errada')
      .send({})
    expect(res.status).toBe(401)
  })

  it('aceita X-API-Key válida', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', 'test-key-123')
      .send({ email: 'afil@test.com', nome: 'Afiliado' })
    expect(res.status).not.toBe(401)
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- apiKey
```

Expected: FAIL — routes not mounted

- [ ] **Step 3: Criar api/src/middleware/apiKey.ts**

```typescript
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import type { Parceiro } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      parceiro: Parceiro
    }
  }
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string | undefined
  if (!key) return void res.status(401).json({ error: 'X-API-Key obrigatória' })

  const parceiro = await prisma.parceiro.findUnique({ where: { apiKey: key } })
  if (!parceiro || parceiro.status !== 'ativo') {
    return void res.status(401).json({ error: 'chave inválida ou parceiro inativo' })
  }

  req.parceiro = parceiro
  next()
}
```

- [ ] **Step 4: Criar api/src/lib/resend.ts**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@geengoo.com.br'

export async function enviarEmail(para: string, assunto: string, html: string) {
  if (process.env.NODE_ENV === 'test') return
  await resend.emails.send({ from: FROM, to: para, subject: assunto, html })
}

export async function notificarAfiliadoRewardDisponivel(email: string, valorCentavos: number, baseUrl: string) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `${valor} disponível para saque no ping`,
    `<p>Sua indicação foi confirmada. <strong>${valor}</strong> está disponível para saque.</p><p><a href="${baseUrl}">Acessar ping</a></p>`
  )
}

export async function notificarParceiroPagamento(email: string, afiliadoNome: string, valorCentavos: number, payoutId: string) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `Solicitação de saque — ${valor} — prazo 5 dias`,
    `<p><strong>${afiliadoNome}</strong> solicitou saque de <strong>${valor}</strong>.</p><p>Prazo: 5 dias úteis. Após pagar, confirme em seu painel ping.</p><p>ID do saque: <code>${payoutId}</code></p>`
  )
}

export async function notificarAfiliadoPago(email: string, valorCentavos: number) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(email, `Saque de ${valor} confirmado`, `<p>Seu saque de <strong>${valor}</strong> foi confirmado pelo parceiro.</p>`)
}

export async function alertarSuperadminSaqueAtrasado(superadminEmail: string, afiliadoNome: string, valorCentavos: number, payoutId: string) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    superadminEmail,
    `[ALERTA] Saque atrasado — ${valor}`,
    `<p>Saque de <strong>${afiliadoNome}</strong> (${valor}) está com mais de 5 dias sem confirmação.</p><p>ID: <code>${payoutId}</code></p>`
  )
}
```

- [ ] **Step 5: Atualizar api/src/server.ts para montar rotas v1**

```typescript
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { apiKeyAuth } from './middleware/apiKey'
import { affiliatesRouter } from './routes/affiliates'
import { conversionsRouter } from './routes/conversions'
import { payoutsRouter } from './routes/payouts'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/v1/affiliates', apiKeyAuth, affiliatesRouter)
app.use('/v1/conversions', apiKeyAuth, conversionsRouter)
app.use('/v1/payouts', apiKeyAuth, payoutsRouter)

if (require.main === module) {
  const port = process.env.PORT || 3040
  app.listen(port, () => console.log(`ping-api porta ${port}`))
}
```

Criar stubs para os routers que ainda não existem (para o teste compilar):

`api/src/routes/affiliates.ts`:
```typescript
import { Router } from 'express'
export const affiliatesRouter = Router()
affiliatesRouter.post('/', (_req, res) => res.status(501).json({ error: 'not implemented' }))
affiliatesRouter.get('/:id/balance', (_req, res) => res.status(501).json({ error: 'not implemented' }))
```

`api/src/routes/conversions.ts`:
```typescript
import { Router } from 'express'
export const conversionsRouter = Router()
conversionsRouter.post('/', (_req, res) => res.status(501).json({ error: 'not implemented' }))
conversionsRouter.post('/:id/cancel', (_req, res) => res.status(501).json({ error: 'not implemented' }))
```

`api/src/routes/payouts.ts`:
```typescript
import { Router } from 'express'
export const payoutsRouter = Router()
payoutsRouter.post('/:id/confirm', (_req, res) => res.status(501).json({ error: 'not implemented' }))
```

- [ ] **Step 6: Rodar testes**

```bash
cd /root/Projetos/geengoo/ping/api
npm test
```

Expected: `PASS` — health + apiKey tests passing

- [ ] **Step 7: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/
git commit -m "feat: API key middleware + stubs de rotas v1"
```

---

### Task 5: POST /v1/affiliates

**Files:**
- Create: `api/src/lib/validate.ts`
- Modify: `api/src/routes/affiliates.ts` (implementação completa)
- Create: `api/src/__tests__/affiliates.test.ts`

**Interfaces:**
- Consumes: `req.parceiro` (Parceiro), Prisma `Campanha`, `Conta`, `Participacao`
- Produces:
  - `POST /v1/affiliates` → `201 { participacao_id, link, codigo }`
  - `GET /v1/affiliates/:id/balance` → `200 { pendente, disponivel, solicitado, pago }`

- [ ] **Step 1: Escrever testes**

Criar `api/src/__tests__/affiliates.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let apiKey: string
let campanhaId: string
let parceiroContaId: string
let parceiroId: string

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Parceiro Afiliados', email: 'parceiro-afiliados@ping.test', papeis: ['parceiro'] },
  })
  parceiroContaId = conta.id
  const parceiro = await prisma.parceiro.create({
    data: { contaId: conta.id, nomeFantasia: 'Teste Afiliados', apiKey: 'aff-key-456' },
  })
  parceiroId = parceiro.id
  apiKey = 'aff-key-456'

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Teste',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 5000,
    },
  })
  campanhaId = campanha.id
})

afterAll(async () => {
  await prisma.participacao.deleteMany({ where: { campanhaId } })
  await prisma.conta.deleteMany({ where: { email: { contains: '@aff-test.com' } } })
  await prisma.campanha.deleteMany({ where: { id: campanhaId } })
  await prisma.parceiro.deleteMany({ where: { id: parceiroId } })
  await prisma.conta.deleteMany({ where: { id: parceiroContaId } })
  await prisma.$disconnect()
})

describe('POST /v1/affiliates', () => {
  it('cria afiliado e participação, retorna link e código', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado1@aff-test.com', nome: 'Afiliado Um' })

    expect(res.status).toBe(201)
    expect(res.body.participacao_id).toBeDefined()
    expect(res.body.link).toMatch(/\/a\//)
    expect(res.body.codigo).toMatch(/^[A-Z0-9]{8}$/)
  })

  it('retorna participação existente se afiliado já existe', async () => {
    const res1 = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado2@aff-test.com', nome: 'Afiliado Dois' })

    const res2 = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado2@aff-test.com', nome: 'Afiliado Dois' })

    expect(res1.body.participacao_id).toBe(res2.body.participacao_id)
  })

  it('rejeita sem email', async () => {
    const res = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ nome: 'Sem Email' })
    expect(res.status).toBe(400)
  })
})

describe('GET /v1/affiliates/:id/balance', () => {
  it('retorna saldo zerado para afiliado sem conversões', async () => {
    const criacaoRes = await request(app)
      .post('/v1/affiliates')
      .set('X-API-Key', apiKey)
      .send({ email: 'afiliado3@aff-test.com', nome: 'Afiliado Três' })

    const res = await request(app)
      .get(`/v1/affiliates/${criacaoRes.body.participacao_id}/balance`)
      .set('X-API-Key', apiKey)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ pendente: 0, disponivel: 0, solicitado: 0, pago: 0 })
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- affiliates
```

Expected: FAIL — 501 not implemented

- [ ] **Step 3: Criar api/src/lib/validate.ts**

```typescript
import { prisma } from './prisma'

export function gerarCodigoIndicacao(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function codigoUnico(): Promise<string> {
  let codigo: string
  let tentativas = 0
  do {
    codigo = gerarCodigoIndicacao()
    tentativas++
    if (tentativas > 20) throw new Error('não foi possível gerar código único')
  } while (await prisma.participacao.findUnique({ where: { codigoIndicacao: codigo } }))
  return codigo
}

export function validarSelfReferral(afiliadoEmail: string, convidadoEmail: string): boolean {
  return afiliadoEmail.toLowerCase() === convidadoEmail.toLowerCase()
}
```

- [ ] **Step 4: Implementar api/src/routes/affiliates.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { codigoUnico } from '../lib/validate'

export const affiliatesRouter = Router()

affiliatesRouter.post('/', async (req, res) => {
  const { email, nome } = req.body as { email?: string; nome?: string }
  if (!email) return void res.status(400).json({ error: 'email obrigatório' })

  const parceiro = req.parceiro

  const campanha = await prisma.campanha.findFirst({
    where: { parceiroId: parceiro.id, status: 'ativa' },
  })
  if (!campanha) return void res.status(422).json({ error: 'nenhuma campanha ativa para este parceiro' })

  let conta = await prisma.conta.findUnique({ where: { email } })
  if (!conta) {
    conta = await prisma.conta.create({
      data: { email, nome: nome || email, papeis: ['afiliado'] },
    })
  } else if (!conta.papeis.includes('afiliado')) {
    await prisma.conta.update({
      where: { id: conta.id },
      data: { papeis: { push: 'afiliado' } },
    })
  }

  const existente = await prisma.participacao.findUnique({
    where: { campanhaId_afiliadoId: { campanhaId: campanha.id, afiliadoId: conta.id } },
  })
  if (existente) {
    return void res.status(200).json({
      participacao_id: existente.id,
      link: existente.linkIndicacao,
      codigo: existente.codigoIndicacao,
    })
  }

  const codigo = await codigoUnico()
  const baseUrl = process.env.BASE_URL || 'https://ping.geengoo.io'
  const link = `${baseUrl}/a/${codigo}`

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: conta.id,
      codigoIndicacao: codigo,
      linkIndicacao: link,
    },
  })

  res.status(201).json({ participacao_id: participacao.id, link, codigo })
})

affiliatesRouter.get('/:id/balance', async (req, res) => {
  const { id } = req.params

  const rewards = await prisma.reward.findMany({
    where: { participacaoId: id },
  })

  const somar = (status: string) =>
    rewards.filter((r) => r.status === status).reduce((acc, r) => acc + r.valorCentavos, 0)

  res.json({
    pendente: somar('pendente'),
    disponivel: somar('disponivel'),
    solicitado: somar('solicitado'),
    pago: somar('pago'),
  })
})
```

- [ ] **Step 5: Rodar testes**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- affiliates
```

Expected: `PASS` — todos os testes de affiliates passando

- [ ] **Step 6: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/
git commit -m "feat: POST /v1/affiliates + GET /v1/affiliates/:id/balance"
```

---

### Task 6: POST /v1/conversions

**Files:**
- Create: `api/src/lib/reward.ts`
- Modify: `api/src/routes/conversions.ts`
- Create: `api/src/__tests__/conversions.test.ts`

**Interfaces:**
- Consumes:
  - `req.parceiro` (Parceiro)
  - `Participacao` com `campanhaId` → `Campanha.recompensaTipo`, `Campanha.recompensaValorCentavos`
- Produces: `POST /v1/conversions` → `201 { conversao_id, reward_id, status: "pendente" }`

- [ ] **Step 1: Criar api/src/lib/reward.ts**

```typescript
import type { Campanha } from '@prisma/client'

export function calcularReward(campanha: Campanha, valorConversaoCentavos: number): number {
  if (campanha.recompensaTipo === 'fixo') {
    return campanha.recompensaValorCentavos
  }
  return Math.floor((campanha.recompensaValorCentavos / 100) * valorConversaoCentavos)
}
```

- [ ] **Step 2: Escrever testes**

Criar `api/src/__tests__/conversions.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let apiKey: string
let participacaoId: string
let afiliadoEmail: string

beforeAll(async () => {
  const contaParceiro = await prisma.conta.create({
    data: { nome: 'Parceiro Conv', email: 'parceiro-conv@ping.test', papeis: ['parceiro'] },
  })
  const parceiro = await prisma.parceiro.create({
    data: { contaId: contaParceiro.id, nomeFantasia: 'Conv Parceiro', apiKey: 'conv-key-789' },
  })
  apiKey = 'conv-key-789'

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Conv',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 4000,
      janelaCancelamentoDias: 30,
    },
  })

  afiliadoEmail = 'afil-conv@ping.test'
  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Conv', email: afiliadoEmail, papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'CONVTEST',
      linkIndicacao: 'https://ping.geengoo.io/a/CONVTEST',
    },
  })
  participacaoId = participacao.id
})

afterAll(async () => {
  await prisma.reward.deleteMany({ where: { participacaoId } })
  await prisma.conversao.deleteMany({ where: { participacaoId } })
  await prisma.participacao.deleteMany({ where: { id: participacaoId } })
  await prisma.conta.deleteMany({ where: { email: { in: [afiliadoEmail, 'parceiro-conv@ping.test'] } } })
  await prisma.$disconnect()
})

describe('POST /v1/conversions', () => {
  it('cria conversão e reward com status pendente', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-001',
        customer_email: 'cliente@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pendente')
    expect(res.body.conversao_id).toBeDefined()
    expect(res.body.reward_id).toBeDefined()
    expect(res.body.reward_valor_centavos).toBe(4000)
  })

  it('rejeita self-referral', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-self',
        customer_email: afiliadoEmail,
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/self-referral/)
  })

  it('rejeita pedido duplicado', async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: 'order-001',
        customer_email: 'outro@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })

    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 3: Rodar para confirmar falha**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- conversions
```

Expected: FAIL — 501

- [ ] **Step 4: Implementar api/src/routes/conversions.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { calcularReward } from '../lib/reward'
import { validarSelfReferral } from '../lib/validate'

export const conversionsRouter = Router()

conversionsRouter.post('/', async (req, res) => {
  const {
    affiliate_id,
    order_id,
    customer_email,
    customer_id,
    amount_cents,
    purchase_type,
    product,
  } = req.body as {
    affiliate_id?: string
    order_id?: string
    customer_email?: string
    customer_id?: string
    amount_cents?: number
    purchase_type?: string
    product?: { name?: string; id?: string; description?: string }
  }

  if (!affiliate_id || !order_id || !customer_email || !amount_cents || !purchase_type || !product?.name) {
    return void res.status(400).json({ error: 'campos obrigatórios: affiliate_id, order_id, customer_email, amount_cents, purchase_type, product.name' })
  }

  const participacao = await prisma.participacao.findUnique({
    where: { id: affiliate_id },
    include: { campanha: true, afiliado: true },
  })
  if (!participacao) return void res.status(404).json({ error: 'participação não encontrada' })

  if (participacao.campanha.parceiroId !== req.parceiro.id) {
    return void res.status(403).json({ error: 'participação não pertence a este parceiro' })
  }

  if (participacao.campanha.status !== 'ativa') {
    return void res.status(422).json({ error: 'campanha não está ativa' })
  }

  if (validarSelfReferral(participacao.afiliado.email, customer_email)) {
    return void res.status(422).json({ error: 'self-referral não permitido' })
  }

  const existente = await prisma.conversao.findUnique({
    where: { participacaoId_pedidoIdExterno: { participacaoId: affiliate_id, pedidoIdExterno: order_id } },
  })
  if (existente) return void res.status(409).json({ error: 'pedido já registrado' })

  const rewardValor = calcularReward(participacao.campanha, amount_cents)

  const conversao = await prisma.conversao.create({
    data: {
      participacaoId: affiliate_id,
      pedidoIdExterno: order_id,
      emailConvidado: customer_email,
      convidadoIdExterno: customer_id,
      valorCentavos: amount_cents,
      tipoCompra: purchase_type,
      produtoNome: product.name,
      produtoIdExterno: product.id,
      produtoDescricao: product.description,
      reward: {
        create: {
          participacaoId: affiliate_id,
          tipo: participacao.campanha.recompensaTipo,
          valorCentavos: rewardValor,
        },
      },
    },
    include: { reward: true },
  })

  res.status(201).json({
    conversao_id: conversao.id,
    reward_id: conversao.reward!.id,
    reward_valor_centavos: conversao.reward!.valorCentavos,
    status: 'pendente',
  })
})

conversionsRouter.post('/:id/cancel', async (req, res) => {
  // implementado na Task 7
  res.status(501).json({ error: 'not implemented' })
})

- [ ] **Step 5: Rodar testes**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- conversions
```

Expected: `PASS` — todos os testes de conversions passando

- [ ] **Step 6: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/
git commit -m "feat: POST /v1/conversions — cria conversão + reward com validações"
```

---

### Task 7: POST /v1/conversions/:id/cancel

**Files:**
- Modify: `api/src/routes/conversions.ts` (implementar cancel)
- Modify: `api/src/__tests__/conversions.test.ts` (adicionar testes de cancel)

**Interfaces:**
- Consumes: `conversao_id` (path), `motivo` no body, `req.parceiro`
- Produces: `200 { conversao_id, status: "cancelada", reward_id, reward_status: "revertido" }`
- Invariante: a linha da conversão original NUNCA é deletada; o reward vai para `revertido`

- [ ] **Step 1: Adicionar testes ao arquivo de conversions**

Adicionar no `api/src/__tests__/conversions.test.ts` após os testes existentes:

```typescript
describe('POST /v1/conversions/:id/cancel', () => {
  let conversaoId: string
  let rewardId: string

  beforeEach(async () => {
    const res = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: `order-cancel-${Date.now()}`,
        customer_email: 'cancelar@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano Mensal', id: 'mensal' },
      })
    conversaoId = res.body.conversao_id
    rewardId = res.body.reward_id
  })

  it('cancela conversão e reverte reward — nunca deleta', async () => {
    const res = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'cancelamento' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelada')
    expect(res.body.reward_status).toBe('revertido')

    const conversao = await prisma.conversao.findUnique({ where: { id: conversaoId } })
    expect(conversao).not.toBeNull()
    expect(conversao!.status).toBe('cancelada')
    expect(conversao!.motivoCancelamento).toBe('cancelamento')

    const reward = await prisma.reward.findUnique({ where: { id: rewardId } })
    expect(reward).not.toBeNull()
    expect(reward!.status).toBe('revertido')
  })

  it('rejeita motivo inválido', async () => {
    const outroRes = await request(app)
      .post('/v1/conversions')
      .set('X-API-Key', apiKey)
      .send({
        affiliate_id: participacaoId,
        order_id: `order-motivo-${Date.now()}`,
        customer_email: 'motivo@exemplo.com',
        amount_cents: 14900,
        purchase_type: 'subscription',
        product: { name: 'Plano', id: 'p' },
      })

    const res = await request(app)
      .post(`/v1/conversions/${outroRes.body.conversao_id}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'motivo-invalido' })

    expect(res.status).toBe(400)
  })

  it('não cancela conversão já cancelada', async () => {
    await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'cancelamento' })

    const res = await request(app)
      .post(`/v1/conversions/${conversaoId}/cancel`)
      .set('X-API-Key', apiKey)
      .send({ motivo: 'cancelamento' })

    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- conversions
```

Expected: FAIL — cancel tests failing (501)

- [ ] **Step 3: Implementar cancel em conversions.ts**

Substituir o stub `conversionsRouter.post('/:id/cancel', ...)` por:

```typescript
const MOTIVOS_VALIDOS = ['cancelamento', 'chargeback', 'fraude', 'expirado']

conversionsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body as { motivo?: string }

  if (!motivo || !MOTIVOS_VALIDOS.includes(motivo)) {
    return void res.status(400).json({ error: `motivo deve ser um de: ${MOTIVOS_VALIDOS.join(', ')}` })
  }

  const conversao = await prisma.conversao.findUnique({
    where: { id },
    include: { participacao: { include: { campanha: true } }, reward: true },
  })

  if (!conversao) return void res.status(404).json({ error: 'conversão não encontrada' })

  if (conversao.participacao.campanha.parceiroId !== req.parceiro.id) {
    return void res.status(403).json({ error: 'conversão não pertence a este parceiro' })
  }

  if (conversao.status === 'cancelada') {
    return void res.status(409).json({ error: 'conversão já cancelada' })
  }

  const agora = new Date()

  await prisma.$transaction([
    prisma.conversao.update({
      where: { id },
      data: {
        status: 'cancelada',
        motivoCancelamento: motivo,
        canceladoEm: agora,
        canceladoPorId: req.parceiro.id,
      },
    }),
    ...(conversao.reward
      ? [
          prisma.reward.update({
            where: { id: conversao.reward.id },
            data: { status: 'revertido', motivoReversao: motivo, revertidoEm: agora },
          }),
        ]
      : []),
  ])

  res.json({
    conversao_id: id,
    status: 'cancelada',
    motivo,
    reward_id: conversao.reward?.id,
    reward_status: 'revertido',
  })
})
```

- [ ] **Step 4: Rodar todos os testes**

```bash
cd /root/Projetos/geengoo/ping/api
npm test
```

Expected: `PASS` — todos os testes passando

- [ ] **Step 5: Commit**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/routes/conversions.ts api/src/__tests__/conversions.test.ts
git commit -m "feat: POST /v1/conversions/:id/cancel — reversão contábil"
```

---

### Task 8: POST /v1/payouts/:id/confirm + NGINX

**Files:**
- Modify: `api/src/routes/payouts.ts` (implementação completa)
- Create: `api/src/__tests__/payouts.test.ts`
- Create: `api/src/worker.ts` (stub para PM2)
- Create: `deploy.sh`

**Interfaces:**
- Consumes: `reward.id` (path), `req.parceiro`
- Produces: `POST /v1/payouts/:id/confirm` → `200 { reward_id, status: "pago", pago_em }`

- [ ] **Step 1: Escrever testes**

Criar `api/src/__tests__/payouts.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'

let apiKey: string
let rewardSolicitadoId: string
let parceiroContaId: string
let parceiroId: string

beforeAll(async () => {
  const conta = await prisma.conta.create({
    data: { nome: 'Parceiro Payout', email: 'parceiro-payout@ping.test', papeis: ['parceiro'] },
  })
  parceiroContaId = conta.id
  const parceiro = await prisma.parceiro.create({
    data: { contaId: conta.id, nomeFantasia: 'Payout Parceiro', apiKey: 'payout-key-000' },
  })
  parceiroId = parceiro.id
  apiKey = 'payout-key-000'

  const campanha = await prisma.campanha.create({
    data: {
      parceiroId: parceiro.id,
      nome: 'Campanha Payout',
      status: 'ativa',
      tiposCompraElegiveis: ['subscription'],
      recompensaTipo: 'fixo',
      recompensaValorCentavos: 3000,
    },
  })

  const contaAfil = await prisma.conta.create({
    data: { nome: 'Afiliado Payout', email: 'afil-payout@ping.test', papeis: ['afiliado'] },
  })

  const participacao = await prisma.participacao.create({
    data: {
      campanhaId: campanha.id,
      afiliadoId: contaAfil.id,
      codigoIndicacao: 'PAYTEST1',
      linkIndicacao: 'https://ping.geengoo.io/a/PAYTEST1',
    },
  })

  const conversao = await prisma.conversao.create({
    data: {
      participacaoId: participacao.id,
      pedidoIdExterno: 'payout-order-001',
      emailConvidado: 'conv@payout.test',
      valorCentavos: 14900,
      tipoCompra: 'subscription',
      produtoNome: 'Plano',
    },
  })

  const reward = await prisma.reward.create({
    data: {
      conversaoId: conversao.id,
      participacaoId: participacao.id,
      tipo: 'fixo',
      valorCentavos: 3000,
      status: 'solicitado',
      solicitadoEm: new Date(),
    },
  })
  rewardSolicitadoId = reward.id
})

afterAll(async () => {
  await prisma.reward.deleteMany({ where: { participacao: { campanha: { parceiroId } } } })
  await prisma.conversao.deleteMany({ where: { participacao: { campanha: { parceiroId } } } })
  await prisma.participacao.deleteMany({ where: { campanha: { parceiroId } } })
  await prisma.campanha.deleteMany({ where: { parceiroId } })
  await prisma.conta.deleteMany({ where: { email: { in: ['parceiro-payout@ping.test', 'afil-payout@ping.test'] } } })
  await prisma.$disconnect()
})

describe('POST /v1/payouts/:id/confirm', () => {
  it('confirma pagamento e atualiza reward para pago', async () => {
    const res = await request(app)
      .post(`/v1/payouts/${rewardSolicitadoId}/confirm`)
      .set('X-API-Key', apiKey)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pago')
    expect(res.body.pago_em).toBeDefined()

    const reward = await prisma.reward.findUnique({ where: { id: rewardSolicitadoId } })
    expect(reward!.status).toBe('pago')
    expect(reward!.pagoEm).not.toBeNull()
  })

  it('rejeita se reward não está solicitado', async () => {
    const res = await request(app)
      .post(`/v1/payouts/${rewardSolicitadoId}/confirm`)
      .set('X-API-Key', apiKey)
      .send({})

    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd /root/Projetos/geengoo/ping/api
npm test -- payouts
```

Expected: FAIL — 501

- [ ] **Step 3: Implementar api/src/routes/payouts.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { notificarAfiliadoPago } from '../lib/resend'

export const payoutsRouter = Router()

payoutsRouter.post('/:id/confirm', async (req, res) => {
  const { id } = req.params

  const reward = await prisma.reward.findUnique({
    where: { id },
    include: {
      participacao: {
        include: {
          afiliado: true,
          campanha: true,
        },
      },
    },
  })

  if (!reward) return void res.status(404).json({ error: 'reward não encontrado' })

  if (reward.participacao.campanha.parceiroId !== req.parceiro.id) {
    return void res.status(403).json({ error: 'reward não pertence a este parceiro' })
  }

  if (reward.status !== 'solicitado') {
    return void res.status(409).json({ error: `reward está ${reward.status} — só é possível confirmar rewards com status 'solicitado'` })
  }

  const pagoEm = new Date()

  await prisma.reward.update({
    where: { id },
    data: { status: 'pago', pagoEm },
  })

  await notificarAfiliadoPago(reward.participacao.afiliado.email, reward.valorCentavos)

  res.json({ reward_id: id, status: 'pago', pago_em: pagoEm.toISOString() })
})
```

- [ ] **Step 4: Criar api/src/worker.ts (stub)**

```typescript
import 'dotenv/config'
import { prisma } from './lib/prisma'

async function tick() {
  console.log('[worker] tick —', new Date().toISOString())
  // Jobs implementados na Parte 2
}

async function main() {
  console.log('[worker] iniciando')
  await tick()
  setInterval(tick, 60 * 60 * 1000) // a cada 1h
}

main().catch((err) => {
  console.error('[worker] erro fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 5: Rodar todos os testes**

```bash
cd /root/Projetos/geengoo/ping/api
npm test
```

Expected: `PASS` — todos os testes passando (health, apiKey, affiliates, conversions, payouts)

- [ ] **Step 6: Build da api/**

```bash
cd /root/Projetos/geengoo/ping/api
npm run build
```

Expected: `dist/` gerado sem erros de TypeScript

- [ ] **Step 7: Criar deploy.sh**

```bash
#!/bin/bash
set -e

echo "=== ping deploy ==="

cd /root/Projetos/geengoo/ping

echo "--- api: install + build ---"
cd api && npm ci && npm run build && cd ..

echo "--- api: prisma migrate ---"
cd api && DATABASE_URL=$(grep DATABASE_URL ecosystem.config.js | head -1 | awk -F"'" '{print $2}') npx prisma migrate deploy && cd ..

echo "--- web: install + build ---"
cd web && npm ci && npm run build && cd ..

echo "--- pm2 reload ---"
pm2 reload ping-api ping-web ping-worker 2>/dev/null || pm2 start ecosystem.config.js

echo "=== deploy concluído ==="
```

```bash
chmod +x /root/Projetos/geengoo/ping/deploy.sh
```

- [ ] **Step 8: Configurar NGINX**

```bash
cat > /etc/nginx/sites-available/ping << 'EOF'
server {
    listen 80;
    server_name ping.geengoo.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ping.geengoo.io;

    ssl_certificate /etc/letsencrypt/live/geengoo.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/geengoo.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3041;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ping-api.geengoo.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ping-api.geengoo.io;

    ssl_certificate /etc/letsencrypt/live/geengoo.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/geengoo.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3040;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ping /etc/nginx/sites-enabled/ping
nginx -t && nginx -s reload
```

- [ ] **Step 9: Commit final**

```bash
cd /root/Projetos/geengoo/ping
git add api/src/ deploy.sh
git commit -m "feat: POST /v1/payouts/:id/confirm + worker stub + deploy.sh + NGINX"
```

---

### Verificação final — Parte 1

Após o deploy, testar manualmente via curl para confirmar que a API está funcionando em produção.

- [ ] **Criar parceiro ecoa e campanha via psql**

```sql
-- Rodar em: psql postgresql://ping:ping_2026@187.77.56.138:5432/ping

-- Criar conta do ecoa
INSERT INTO contas (id, nome, email, papeis, status, tipo_acesso)
VALUES (gen_random_uuid(), 'ecoa', 'fabio@geengoo.com.br', ARRAY['parceiro', 'superadmin'], 'ativo', 'pago')
RETURNING id;

-- Usar o id retornado acima como <CONTA_ID>
INSERT INTO parceiros (id, conta_id, nome_fantasia, status, api_key)
VALUES (gen_random_uuid(), '<CONTA_ID>', 'ecoa', 'ativo', 'pk_live_ecoa_' || encode(gen_random_bytes(16), 'hex'))
RETURNING id, api_key;

-- Usar o id do parceiro como <PARCEIRO_ID>
INSERT INTO campanhas (id, parceiro_id, nome, status, tipos_compra_elegiveis, janela_cancelamento_dias, recompensa_tipo, recompensa_valor_centavos, dia_pagamento)
VALUES (gen_random_uuid(), '<PARCEIRO_ID>', 'Indique o ecoa', 'ativa', ARRAY['subscription'], 30, 'fixo', 5000, 5)
RETURNING id;
```

- [ ] **Testar endpoints via curl**

```bash
# Health check
curl https://ping-api.geengoo.io/health
# Expected: {"ok":true}

# Criar afiliado (substitua API_KEY pelo valor gerado acima)
curl -X POST https://ping-api.geengoo.io/v1/affiliates \
  -H "X-API-Key: pk_live_ecoa_..." \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","nome":"Teste Afiliado"}'
# Expected: {"participacao_id":"...","link":"https://ping.geengoo.io/a/XXXXXXXX","codigo":"XXXXXXXX"}

# Criar conversão
curl -X POST https://ping-api.geengoo.io/v1/conversions \
  -H "X-API-Key: pk_live_ecoa_..." \
  -H "Content-Type: application/json" \
  -d '{"affiliate_id":"<PARTICIPACAO_ID>","order_id":"order-test-001","customer_email":"novo@exemplo.com","amount_cents":14900,"purchase_type":"subscription","product":{"name":"ecoa Mensal","id":"ecoa-mensal"}}'
# Expected: {"conversao_id":"...","reward_id":"...","reward_valor_centavos":5000,"status":"pendente"}
```

- [ ] **Commit de verificação**

```bash
cd /root/Projetos/geengoo/ping
git add -A
git commit -m "chore: ping parte 1 completa — API pública funcionando em produção"
```

---

**Parte 1 concluída.** A seguir:
- **Parte 2** — Worker: confirmação automática de conversões + dispatch de webhooks
- **Parte 3** — Dashboards: afiliado (extrato + saque) + superadmin
