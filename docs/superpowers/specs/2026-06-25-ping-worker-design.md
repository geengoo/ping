# ping — Worker (Parte 2)
**Data:** 2026-06-25
**Status:** Aprovado

---

## 1. Visão Geral

O worker é um processo PM2 (`ping-worker`) que roda em loop contínuo (tick a cada hora). Ele é responsável por três jobs assíncronos que a API síncrona não pode executar: confirmar conversões após a janela de cancelamento, disparar webhooks com retry, e gerenciar a cadência de alertas de saques pendentes.

Complementando o worker, duas páginas de ação no `web/` processam os botões do email D+5 (parceiro confirma ou informa previsão de pagamento) via token JWT de uso único.

---

## 2. Estrutura de Arquivos

```
api/src/
  worker.ts                    # orquestrador — chama jobs a cada tick
  jobs/
    confirmarConversoes.ts     # job 1: confirma conversões com janela expirada
    dispararWebhooks.ts        # job 2: retry de webhooks falhos
    alertarSaques.ts           # job 3: cadência de alertas de saques
```

```
web/app/
  payout/
    [token]/
      confirm/page.tsx         # "sim, já paguei"
      dispute/page.tsx         # "ainda não paguei" — formulário + submit
```

---

## 3. Jobs

### 3.1 Job 1 — Confirmar Conversões

**Trigger:** a cada tick (1h)

**Query:** conversões com `status = 'pendente'` onde:
```
criado_em + campanha.janela_cancelamento_dias (em dias) <= agora
```

**Para cada conversão, em transação:**
1. `Conversao.status` → `confirmada`, `confirmado_em` = agora
2. `Reward.status` → `disponivel`, `disponivel_em` = agora
3. Insere `WebhookLog` com evento `conversion.confirmed` (será disparado pelo Job 2)
4. Envia email ao afiliado: "R$ X disponível para saque" (via `notificarAfiliadoRewardDisponivel`)

**Idempotência:** a query filtra por `status = 'pendente'`, então conversões já confirmadas nunca são reprocessadas.

---

### 3.2 Job 2 — Disparar Webhooks

**Trigger:** a cada tick (1h)

**Query:** `WebhookLog` com `sucesso = false` e `tentativas < 4`, onde a janela de backoff foi respeitada:
- `tentativas = 0`: `criado_em <= agora` (primeira tentativa imediata)
- `tentativas = 1`: `tentado_em + 1h <= agora`
- `tentativas = 2`: `tentado_em + 4h <= agora`
- `tentativas = 3`: `tentado_em + 24h <= agora`

**Para cada log:**
1. Faz `POST` para `parceiro.webhook_url` com o `payload` JSON
2. Atualiza `WebhookLog`: `statusCode`, `sucesso`, `tentativas + 1`, `tentado_em` = agora, `erro` (se falhou)

**Após 4 tentativas falhas:** `sucesso = false` permanente. Superadmin pode reenviar manualmente pelo painel.

**Eventos possíveis:** `conversion.created`, `conversion.confirmed`, `conversion.cancelled`, `payout.requested`, `payout.overdue`.

**Nota:** quem cria os `WebhookLog` são os endpoints da API (`conversion.created`, `conversion.cancelled`, `payout.requested`), o Job 1 (`conversion.confirmed`) e o Job 3 (`payout.overdue`). O Job 2 só dispara — nunca cria logs.

---

### 3.3 Job 3 — Alertar Saques

**Trigger:** a cada tick (1h)

**Query:** rewards com `status = 'solicitado'`

**Cadência de alertas (por dias desde `solicitado_em`):**

| Janela | Alerta | Controle de spam |
|--------|--------|-----------------|
| >= 3 dias | Email ao parceiro: "saque vence em 2 dias" | `alertaD3EnviadoEm` null |
| >= 5 dias | Email ao parceiro com 2 botões + alerta superadmin + `WebhookLog payout.overdue` | `alertaD5EnviadoEm` null |

**Controle de spam:** cada alerta é disparado uma única vez por reward, controlado pelos campos `alertaD3EnviadoEm` e `alertaD5EnviadoEm` (novos campos na migration).

**Email D+3 ao parceiro:**
> "Lembrete: [nome do afiliado] solicitou um saque de R$ X há 3 dias. O prazo vence em 2 dias. Confirme o pagamento via API quando realizar o PIX."

**Email D+5 ao parceiro** (com 2 botões):
> "O prazo de 5 dias para o saque de R$ X solicitado por [nome do afiliado] venceu. Você já realizou o pagamento?"
>
> [Sim, já paguei] → link para `/payout/[token]/confirm`
> [Ainda não paguei] → link para `/payout/[token]/dispute`

**Email D+5 ao superadmin:**
> "[ALERTA] Saque de R$ X para [afiliado] está vencido. Parceiro notificado. ID: [rewardId]"

---

## 4. Páginas de Ação

### 4.1 Token JWT
- Assinado com `WORKER_SECRET` (nova env var em `web/.env`)
- Payload: `{ rewardId: string, action: 'confirm' | 'dispute', exp: D+5 + 7 dias }`
- Gerado no Job 3 no momento do envio do email D+5
- Token de uso único: após uso, o status do reward já não é mais `solicitado`, o que impede reprocessamento

### 4.2 GET /payout/[token]/confirm — "Sim, já paguei"

1. Valida e decodifica JWT
2. Verifica `reward.status === 'solicitado'` (idempotência: se já `pago`, exibe "já confirmado")
3. Em transação: `Reward.status` → `pago`, `pago_em` = agora
4. Envia email ao afiliado: "Seu saque foi confirmado. Confira se o PIX chegou."
5. Exibe página: "Confirmado. [nome do afiliado] foi notificado."

### 4.3 GET + POST /payout/[token]/dispute — "Ainda não paguei"

**GET:** exibe formulário com:
- Campo de data: "Quando você irá realizar o pagamento?"
- Campo de texto opcional: "Alguma observação para o afiliado?"
- Botão confirmar

**POST:**
1. Valida JWT e `reward.status === 'solicitado'`
2. Salva `previsaoPagamentoEm` no reward
3. Envia email ao afiliado: "Seu saque está sendo processado. Previsão de pagamento: [data]. [observação se houver]"
4. Envia email ao superadmin: "Parceiro informou previsão de [data] para saque de R$ X."
5. Exibe página: "Entendido. [nome do afiliado] foi notificado."

---

## 5. Migration

Novos campos em `Reward`:

```prisma
alertaD3EnviadoEm    DateTime? @map("alerta_d3_enviado_em")
alertaD5EnviadoEm    DateTime? @map("alerta_d5_enviado_em")
previsaoPagamentoEm  DateTime? @map("previsao_pagamento_em")
```

---

## 6. Novas Variáveis de Ambiente

| Variável | Onde | Uso |
|----------|------|-----|
| `SUPERADMIN_EMAIL` | `api/.env` | Destinatário dos alertas de saque vencido |
| `WORKER_SECRET` | `api/.env` e `web/.env` | Assinar/validar JWT dos botões de email |
| `WEB_BASE_URL` | `api/.env` | Base dos links nos emails (ex: `https://ping.geengoo.io`) |

---

## 7. Testes

Cada job terá seu próprio arquivo de teste em `api/src/__tests__/`:

- `confirmarConversoes.test.ts` — conversão pendente com janela expirada vira confirmada; conversão dentro da janela não é tocada; reward vai para disponivel
- `dispararWebhooks.test.ts` — webhook disparado com sucesso; webhook falho incrementa tentativas; não reprocessa após 4 tentativas
- `alertarSaques.test.ts` — D+3 envia email e seta `alertaD3EnviadoEm`; D+5 envia email + superadmin + webhook; não reenvia se campo já preenchido

---

## 8. Decisões Explícitas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Estrutura | Jobs em `jobs/` separados | Isolamento para testes + extensível para Parte 3/4 (gestão de pagamentos) |
| Retry webhooks | Backoff 1h → 4h → 24h, máx 4 tentativas | Confiável sem Redis; WebhookLog.tentativas foi desenhado para isso |
| Controle de spam | Campos `alertaD3/D5EnviadoEm` no Reward | Simples, auditável, sem tabela extra |
| Botões email | Token JWT com exp 7 dias | Sem login; token de uso único por estado do reward |
| `SUPERADMIN_EMAIL` | Variável de ambiente | Sem nada fixo no banco; fácil de mudar sem deploy |
