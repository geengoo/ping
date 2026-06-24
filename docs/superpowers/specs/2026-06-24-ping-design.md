# ping — Motor de Programas de Indicação
**Data:** 2026-06-24
**Status:** Aprovado
**Piloto:** ecoa (ecoa.geengoo.io)

---

## 1. Visão Geral

Ping é um motor de programas de indicação como serviço, subproduto da geengoo. API-first, integrável em qualquer SaaS. O parceiro configura uma campanha, afiliados indicam, conversões chegam via API, recompensas são registradas com transparência total.

**Princípio inegociável:** transparência total para o afiliado. Nenhuma movimentação some — reversões são escritas contábeis, extrato é auditável.

**Responsabilidade financeira:** ping é ferramenta de registro. O parceiro é responsável pelo pagamento. Ping não movimenta nem intermedia dinheiro.

---

## 2. Escopo do Piloto

O piloto valida o modelo com ecoa como único parceiro. É o produto real — não um protótipo descartável. O que fica para a fase 2 é o que não é necessário para ecoa funcionar.

**No piloto:**
- Motor de indicação completo (link, conversão, reward, extrato)
- Auth por magic link (código 6 dígitos por email)
- Afiliados criados via API (caminho 1: cliente do parceiro)
- Extrato do afiliado com transparência total
- Confirmação automática por janela de cancelamento (worker)
- Reversão contábil (nunca apaga)
- Fluxo de saque: solicitação → confirmação manual pelo parceiro
- API pública para integração do ecoa
- Painel superadmin mínimo (criar parceiro/campanha, ver conversões, ver saques atrasados)

**Fase 2 (fora do piloto):**
- Onboarding self-service do parceiro (formulário, pagamento, CNPJ automático, assinatura digital)
- Painel completo do parceiro
- Caminhos 2 e 3 de onboarding do afiliado (orgânico externo, influenciador)
- Convites para influenciadores
- Múltiplas campanhas por parceiro via interface
- QR code exibido no dashboard

---

## 3. Personagens

| Papel | Descrição |
|---|---|
| **superadmin** | Operação e suporte — acesso total |
| **parceiro** | Empresa que contrata o ping (no piloto: ecoa) |
| **afiliado** | Quem indica — pode ser cliente do parceiro |
| **convidado** | Quem foi indicado — não tem conta no ping |

Uma conta pode acumular papéis (ex: parceiro + afiliado).

---

## 4. Arquitetura

### 4.1 Estrutura de Repositório

```
/root/Projetos/geengoo/ping/
├── api/                        # Express — API pública + worker
│   ├── src/
│   │   ├── routes/             # v1: conversions, affiliates, payouts, webhooks
│   │   ├── middleware/         # apiKey auth, rate limit
│   │   ├── jobs/               # confirmar conversões expiradas, disparar webhooks
│   │   └── lib/                # prisma client, resend, utils
│   ├── prisma/
│   │   └── schema.prisma       # fonte da verdade — migrations rodam daqui
│   └── package.json
└── web/                        # Next.js 16 — dashboards
    ├── app/
    │   ├── admin/              # superadmin
    │   ├── painel/             # parceiro (fase 2)
    │   └── a/[codigo]/         # afiliado — extrato público
    ├── prisma/
    │   └── schema.prisma       # cópia idêntica — só para prisma generate
    └── package.json
```

### 4.2 Processos PM2

| Nome | Porta | Entrada |
|---|---|---|
| `ping-api` | 3040 | `api/src/server.ts` |
| `ping-web` | 3041 | Next.js start |
| `ping-worker` | — | `api/src/worker.ts` |

### 4.3 NGINX

- `ping.geengoo.io` → 3041
- `ping-api.geengoo.io` → 3040

### 4.4 Stack

| Camada | Tecnologia |
|---|---|
| API | Express + TypeScript |
| Web | Next.js 16 + Tailwind v4 |
| ORM | Prisma 7 |
| Banco | PostgreSQL VPS2, banco `ping` |
| Email | Resend |
| Auth | JWT (cookie httpOnly) + magic link |

---

## 5. Entidades (Schema)

### Conta
```
id, nome, email, papel[], status, criado_em
tipo_acesso: pago | convidado
convite_id?, convidado_por_id?, convidado_em?
```
Login sem senha — código de 6 dígitos por email, expira em 15 min, uso único.

### Token de Acesso
```
id, conta_id, codigo (6 dígitos), expira_em, usado, criado_em
```

### Parceiro
```
id, conta_id
razao_social, nome_fantasia, cnpj, segmento, site, status
contato: nome, email, telefone, cargo
termos: versao, aceito_em, ip_aceite, hash_documento
plano, inicio_assinatura
webhook_url, api_key
```

### Campanha
```
id, parceiro_id, nome, status
vigencia: inicio_em, fim_em, fechamento_em
regras: tipos_compra_elegiveis[], janela_cancelamento_dias, atribuicao (last-touch)
recompensa: tipo (fixo | percentual), valor_centavos
dia_pagamento (padrão: 5)
```

### Participação
```
id, campanha_id, afiliado_id
link_indicacao (único), codigo_indicacao (único, editável uma vez)
chave_pix (tipo: cpf | cnpj | email | telefone | aleatoria), chave_pix_valor
status, entrou_em, ultimo_saque_em
```
QR code: gerado automaticamente a partir do link.

### Conversão
```
id, participacao_id
pedido_id_externo, email_convidado, convidado_id_externo
valor_centavos, tipo_compra
produto: nome, id_externo, descricao
status: pendente | confirmada | cancelada
motivo_cancelamento: cancelamento | chargeback | fraude | expirado
criado_em, confirmado_em, cancelado_em, cancelado_por_id
```
Reversões nunca deletam — registram como escrita contábil.

### Reward
```
id, conversao_id, participacao_id
tipo: fixo | percentual
valor_centavos
status: pendente | confirmado | disponivel | solicitado | pago | revertido
motivo_reversao: cancelamento | chargeback | fraude | expirado
criado_em, confirmado_em, disponivel_em, solicitado_em, pago_em, revertido_em
```
Transições de status:
- `pendente` → `confirmado`: conversão confirmada (janela expirou)
- `confirmado` → `disponivel`: dia de pagamento da campanha atingido (no piloto: imediato junto com confirmado)
- `disponivel` → `solicitado`: afiliado solicitou saque
- `solicitado` → `pago`: parceiro confirmou pagamento
- qualquer → `revertido`: conversão cancelada

---

## 6. API Pública (`ping-api.geengoo.io/v1`)

Autenticação: header `X-API-Key`. Cada parceiro tem uma chave gerada no setup.

```
POST   /v1/affiliates                     # criar afiliado (caminho 1: cliente do parceiro)
GET    /v1/affiliates/:id/balance         # consultar saldo do afiliado
POST   /v1/conversions                    # notificar nova compra/conversão
POST   /v1/conversions/:id/cancel         # cancelar / chargeback / fraude
POST   /v1/payouts/:id/confirm            # confirmar pagamento do saque
```

### POST /v1/conversions — body
```json
{
  "affiliate_id": "uuid ou codigo",
  "order_id": "id externo do pedido",
  "customer_email": "email do convidado",
  "customer_id": "id externo do convidado",
  "amount_cents": 14900,
  "purchase_type": "subscription",
  "product": {
    "name": "ecoa Mensal",
    "id": "ecoa-mensal",
    "description": "Plano mensal ecoa"
  }
}
```

### Webhooks disparados pelo ping

| Evento | Quando |
|---|---|
| `conversion.created` | Conversão registrada (pendente) |
| `conversion.confirmed` | Janela de cancelamento expirou |
| `conversion.cancelled` | Parceiro cancelou |
| `payout.requested` | Afiliado solicitou saque |
| `payout.overdue` | Saque não pago em 5 dias |

---

## 7. Fluxos de Negócio

### 7.1 Indicação (fim a fim)

1. Afiliado compartilha `ping.geengoo.io/a/[codigo]`
2. Visitante clica — ping registra: IP, device, timestamp, cookie 30 dias
3. Visitante assina o ecoa
4. Ecoa chama `POST /v1/conversions`
5. Ping valida: self-referral, campanha ativa, duplicata por pedido_id_externo
6. Conversão criada (pendente) + reward criado (pendente)
7. Webhook `conversion.created` para ecoa
8. Afiliado vê imediatamente: indicação pendente com valor

**Atribuição:** last-touch — vale o último link clicado antes da compra (janela de 30 dias via cookie).

### 7.2 Confirmação Automática

Worker roda a cada hora. Para cada conversão pendente onde `criado_em + janela_cancelamento_dias <= agora`:

1. Conversão → confirmada
2. Reward → disponível
3. Webhook `conversion.confirmed`
4. Email para afiliado: "R$ X disponível para saque"

### 7.3 Reversão (nunca apaga)

1. Parceiro chama `POST /v1/conversions/:id/cancel` com motivo
2. Conversão original: status → cancelada, motivo registrado
3. Novo registro de reversão no extrato (débito contábil) com motivo e data
4. Reward → revertido
5. Webhook `conversion.cancelled`
6. Afiliado vê: conversão original + linha de débito com motivo explicado

### 7.4 Saque

1. Afiliado clica "solicitar saque" (só com saldo disponível)
2. Se sem chave PIX: ping pede para cadastrar primeiro
3. Afiliado confirma valor e chave PIX
4. Reward(s) → solicitado, `solicitado_em` registrado
5. Email para parceiro: "afiliado X solicitou saque de R$ Y — prazo 5 dias"
6. Webhook `payout.requested`
7. Parceiro paga PIX no próprio sistema e chama `POST /v1/payouts/:id/confirm`
8. Reward → pago, `pago_em` registrado
9. Email para afiliado: "saque de R$ X confirmado"
10. Se 5 dias sem confirmação: email para superadmin, webhook `payout.overdue`

**Regra:** um saque por mês por participação. Apenas rewards com status `disponível`.

---

## 8. Dashboard do Afiliado

URL: `ping.geengoo.io/a/[codigo]` — acessível após login por magic link.

**Saldo:**
- Pendente (aguardando janela de cancelamento)
- Disponível (confirmado, pronto para saque)
- Solicitado (saque em andamento)
- Pago (histórico)

**Extrato (ordem cronológica reversa):**
Cada linha: data | produto indicado | valor | status

Reversões aparecem como linha separada: `↩ Reversão — [motivo] — -R$ X`

**Botão "solicitar saque":** visível e ativo somente quando saldo disponível > 0.

**Histórico de saques:** data solicitado | data pago | valor | status.

---

## 9. Painel Superadmin (piloto)

- Criar e editar parceiro (manual — sem self-service)
- Criar e editar campanha
- Gerar e revogar API key do parceiro
- Ver todas as conversões com filtros (status, parceiro, período)
- Ver saques pendentes e atrasados (destacar os > 5 dias)
- Ver log de webhooks (enviados, falhos, reenviar)

---

## 10. Integração ecoa (piloto)

No setup:
1. Superadmin cria parceiro `ecoa` no painel ping
2. Cria campanha com as regras do programa de indicação ecoa
3. Gera API key para ecoa
4. Ecoa armazena a chave e configura o webhook URL

No código do ecoa:
- Quando restaurante assina: `POST /v1/affiliates` (cria participação silenciosa)
- Quando restaurante converte via indicação: `POST /v1/conversions`
- Quando cancelamento/chargeback: `POST /v1/conversions/:id/cancel`
- Quando confirma pagamento de saque: `POST /v1/payouts/:id/confirm`

Afiliados do ecoa descobrem o ping pela primeira vez ao receber o email "você ganhou R$ X".

---

## 11. Decisões Explícitas

| Decisão | Escolha | Motivo |
|---|---|---|
| Arquitetura | Split api + web + worker | API pública isolada; worker confiável para jobs assíncronos |
| ORM | Prisma | Schema complexo, migrations contínuas, type safety |
| Auth | Magic link (código 6 dígitos) | Sem senha, fricção mínima, spec original |
| Atribuição | Last-touch via cookie 30 dias | Spec original; evita disputas complexas |
| Reversão | Escrita contábil (nunca deleta) | Transparência total — princípio inegociável |
| Pagamento | Responsabilidade do parceiro | Ping é ferramenta de registro, não intermediário |
| Piloto | ecoa como único tenant | Validar modelo sem overhead de self-service |
