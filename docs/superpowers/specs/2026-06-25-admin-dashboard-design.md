# ping — Painel Superadmin (Parte 4)
**Data:** 2026-06-25
**Status:** Aprovado

---

## 1. Visão Geral

Painel web interno para o operador geengoo (superadmin) gerenciar parceiros, campanhas, conversões, saques e webhooks do ping. Login por magic link em página dedicada. Visão cross-partner — todas as queries retornam dados de todos os parceiros.

---

## 2. Autenticação

- Página própria: `/admin/login` (visual idêntico ao `/parceiro/login`)
- Chama as rotas existentes: `POST /api/auth/request` e `POST /api/auth/verify`
- Após verify: cookie `ping_token` (JWT `{ contaId, email, papeis: ['superadmin'] }`) já setado, redirect para `/admin/dashboard`
- `proxy.ts` já protege `/admin/*` — verifica `ping_token` + `papeis.includes('superadmin')`
- Nenhuma rota de backend nova necessária para auth

---

## 3. Estrutura de Rotas

```
web/app/admin/
  login/page.tsx                         — formulário de email + redirect
  login/verificar/page.tsx               — código 6 dígitos
  (protected)/
    layout.tsx                            — verifica sessão + sidebar
    dashboard/page.tsx                    — 4 cards globais
    parceiros/
      page.tsx                            — lista de parceiros
      novo/page.tsx                       — formulário criar parceiro + campanha
      [id]/page.tsx                       — detalhes + editar + API key
      [id]/campanha/[cid]/page.tsx        — editar campanha
    conversoes/
      page.tsx                            — todas, filtros parceiro/status/período
      [id]/page.tsx                       — detalhe
    saques/page.tsx                       — todos solicitados, confirmar
    webhooks/page.tsx                     — log geral, reenviar
```

---

## 4. Layout

Idêntico ao painel do parceiro:
- **Fonte:** DM Sans + Plus Jakarta Sans
- **Fundo:** `#f8f9fa`
- **Cards:** `bg-white border border-gray-200 rounded-xl shadow-sm`
- **Sidebar:** item ativo `bg-[#374151] text-white`, inativo `text-gray-500 hover:bg-gray-50`
- **Accent:** `#374151`
- Sidebar label: `"ping admin"` (sem nome de parceiro)

Sidebar itens (Lucide):
- Dashboard
- Parceiros
- Conversões
- Saques
- Webhooks

---

## 5. Telas

### 5.1 Login

`/admin/login` — campo email, botão "Continuar". POST `/api/auth/request`.
`/admin/login/verificar` — campo 6 dígitos. POST `/api/auth/verify` → redirect para `/admin/dashboard`.

Visualmente idêntico ao `/parceiro/login`.

### 5.2 Dashboard

4 cards:
| Card | Dado |
|------|------|
| Parceiros ativos | `Parceiro` com `status = 'ativo'` |
| Conversões este mês | total desde dia 1 do mês corrente |
| Total a pagar | soma `Reward.valorCentavos` onde `status = 'solicitado'` |
| Saques atrasados | rewards `solicitado` há >5 dias — vermelho se >0 |

### 5.3 Parceiros

**Lista** (`/admin/parceiros`): tabela com nome fantasia, status, API key mascarada (`••••••••` + últimos 4 chars), campanhas ativas (count), data criação. Botão "Novo parceiro".

**Criar** (`/admin/parceiros/novo`): formulário em página única com duas seções:

*Dados do parceiro:*
- Email da conta (obrigatório) — cria `Conta` se não existir, associa `Parceiro`
- Nome fantasia (obrigatório)
- Razão social (opcional)
- CNPJ (opcional)
- Webhook URL (opcional)

*Campanha inicial:*
- Nome da campanha (obrigatório)
- Tipo de recompensa: `fixo` ou `percentual`
- Valor da recompensa em centavos (obrigatório)
- Janela de cancelamento em dias (default: 30)
- Dia de pagamento (default: 5)

Submissão (Server Action): cria `Conta` (se não existe) → `Parceiro` com `apiKey` gerado via `nanoid()` → `Campanha`. Redireciona para `/admin/parceiros/[id]` com banner "API key gerada: `<chave completa>`" (única vez visível).

**Detalhe/Editar** (`/admin/parceiros/[id]`):
- Campos editáveis: nome fantasia, razão social, CNPJ, webhook URL, status (`ativo`/`inativo`/`suspenso`)
- API key mascarada + botão "Revogar e gerar nova" (Server Action: gera novo `nanoid()`, exibe nova chave uma vez)
- Lista de campanhas do parceiro com link para editar cada uma

**Editar campanha** (`/admin/parceiros/[id]/campanha/[cid]`):
- Campos: nome, status (`ativa`/`inativa`), tipo recompensa, valor, janela cancelamento, dia pagamento, atribuição

### 5.4 Conversões

`/admin/conversoes` — igual à tela do parceiro mais:
- Coluna "Parceiro" adicionada
- Filtro adicional de parceiro (select com lista de parceiros)
- Paginação 20/página

`/admin/conversoes/[id]` — igual ao detalhe do parceiro.

### 5.5 Saques

`/admin/saques` — igual à tela do parceiro, mas cross-partner:
- Coluna "Parceiro" adicionada
- Linha vermelha para >5 dias
- Botão "Confirmar pagamento": Server Action busca `apiKey` do parceiro dono do reward → `POST /v1/payouts/:id/confirm` com `X-API-Key`
- Ownership check: valida `reward.participacao.campanha.parceiroId` antes do fetch

### 5.6 Webhooks

`/admin/webhooks` — igual à tela do parceiro, mas cross-partner:
- Coluna "Parceiro" adicionada
- 200 registros mais recentes (vs. 100 no parceiro)
- Botão "Reenviar": Server Action zera `tentativas` e `tentadoEm` (sem ownership check — superadmin pode reenviar qualquer log)

---

## 6. Dados

Server Components lendo Prisma direto. Server Actions para mutações. Nenhuma query filtra por `parceiroId` — o superadmin vê tudo.

---

## 7. Decisões Explícitas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Auth | Reutiliza `/api/auth/*` existente | Sem duplicação de backend |
| Login | Página `/admin/login` dedicada | Consistência com parceiro, sem confundir com afiliado |
| API key | `nanoid()` gerado na criação | Consistente com schema atual |
| Exibição API key | Somente na criação e ao revogar | Segurança básica |
| Saques | Busca `apiKey` do parceiro para confirmar | Reutiliza endpoint existente da API |
| Webhooks | Sem ownership check no reenvio | Superadmin tem acesso total |
| Cross-partner | Sem filtro por padrão — vê tudo | Função do admin é visibilidade global |
