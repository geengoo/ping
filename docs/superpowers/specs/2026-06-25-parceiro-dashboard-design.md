# ping — Painel do Parceiro (Parte 3)
**Data:** 2026-06-25
**Status:** Aprovado

---

## 1. Visão Geral

Painel web para o parceiro (ex: ecoa) operar o próprio programa de indicação. Login por magic link, sidebar lateral, leitura direta do banco via Prisma (Server Components). Multitenante desde o início — todas as queries filtram por `parceiroId` da sessão.

---

## 2. Autenticação

- Magic link — código 6 dígitos por email, expira 15min, uso único
- Cookie httpOnly `ping_parceiro_token` com JWT `{ parceiroId, contaId }`, secret `JWT_SECRET`
- Middleware `web/proxy.ts` protege todas as rotas `/parceiro/*` — redireciona para login se sem cookie válido
- Rotas de auth reutilizam a infra existente (`web/lib/auth.ts`, `web/api/auth/`)
- Email de login: o parceiro usa o email cadastrado no `Conta` vinculado ao `Parceiro`

---

## 3. Estrutura de Rotas

```
web/app/parceiro/
  login/
    page.tsx                  — formulário de email
    verificar/page.tsx        — formulário de código 6 dígitos
  (protected)/
    layout.tsx                — sidebar + verificação de sessão
    dashboard/page.tsx        — home com cards + últimas conversões
    conversoes/page.tsx       — lista paginada com filtros
    saques/page.tsx           — rewards solicitados
    afiliados/page.tsx        — participações da campanha
    webhooks/page.tsx         — log de disparos
    configuracoes/page.tsx    — API key + campanha (só leitura)
```

---

## 4. Layout

Idêntico ao ecoa:
- **Fonte:** DM Sans (corpo) + Plus Jakarta Sans (títulos)
- **Fundo:** `#f8f9fa`
- **Cards:** brancos, `border border-gray-200`, `shadow-card` (`0 1px 4px rgba(0,0,0,0.06)`)
- **Sidebar:** item ativo com `bg-[#374151] text-white`, inativo com `text-gray-500 hover:bg-gray-50`
- **Accent:** `#374151`
- **Border radius:** cards `12px`, inputs `8px`

Sidebar itens (com ícones Lucide):
- Dashboard
- Conversões
- Saques
- Afiliados
- Webhooks
- Configurações

---

## 5. Telas

### 5.1 Dashboard

4 cards no topo:
| Card | Dado |
|------|------|
| Conversões este mês | total (pendentes + confirmadas) |
| Afiliados ativos | com ≥ 1 conversão |
| Saldo a pagar | soma rewards `solicitado` |
| Saques atrasados | rewards `solicitado` há > 5 dias — vermelho se > 0 |

Abaixo: tabela das últimas 10 conversões (data, afiliado, produto, valor, status).

### 5.2 Conversões

Lista paginada (20 por página).

Filtros:
- Status: todos / pendente / confirmada / cancelada
- Período: 7 dias / 30 dias / 90 dias

Colunas: data | afiliado | produto | valor | status

Clique na linha → página de detalhe com todos os campos da conversão + reward associado.

### 5.3 Saques

Lista de rewards com `status = 'solicitado'`, ordenada por `solicitado_em` ASC (mais antigo primeiro).

Linha vermelha para saques com `solicitado_em` > 5 dias atrás.

Colunas: afiliado | chave PIX | valor | há X dias | ação

Ação: botão **"Confirmar pagamento"** → `POST /v1/payouts/:id/confirm` na ping-api com `X-API-Key` do parceiro → reward vira `pago`, email ao afiliado, linha some.

### 5.4 Afiliados

Lista de participações da campanha do parceiro.

Colunas: nome | email | conversões | saldo disponível | último saque

Sem ações — só visualização.

### 5.5 Webhooks

Log de `WebhookLog` do parceiro, ordenado por `criado_em` DESC.

Colunas: data | evento | URL | tentativas | status (✓ sucesso / ✗ falhou)

Ação: botão **"Reenviar"** disponível para logs com `sucesso = false` e `tentativas < 4` → zera `tentativas` e `tentado_em` para o worker reprocessar no próximo tick.

### 5.6 Configurações

Só leitura. Exibe:
- **API Key** — com botão copiar (clipboard)
- **Webhook URL** configurado
- **Campanha:** nome, status, janela de cancelamento, valor da recompensa, dia de pagamento

---

## 6. Dados

Server Components lendo direto do banco via Prisma (`web/lib/prisma.ts`). Todas as queries filtram por `parceiroId` extraído do cookie JWT.

Exceção: botão "Confirmar pagamento" e "Reenviar webhook" são Server Actions que chamam a ping-api via fetch interno (`process.env.API_BASE_URL`).

---

## 7. Variáveis de Ambiente

| Variável | Onde | Uso |
|----------|------|-----|
| `API_BASE_URL` | `web/.env.local` | Base para Server Actions chamarem a ping-api (`https://ping-api.geengoo.io`) |

---

## 8. Decisões Explícitas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Auth | Magic link igual ao afiliado | Consistência; parceiro não vai logar com frequência suficiente para senha valer |
| Dados | Prisma direto no Server Component | Sem API intermediária; mais simples, mesmo padrão do ecoa |
| Confirmar pagamento | Server Action → ping-api | Reutiliza a lógica já existente na API; não duplica código |
| Reenviar webhook | Zera tentativas no banco | Worker reprocessa no próximo tick; sem fila extra |
| Multitenante | `parceiroId` em todas as queries | Custo zero agora, evita retrabalho quando chegar o 2º parceiro |
| Visual | Idêntico ao ecoa | Consistência entre produtos geengoo |
