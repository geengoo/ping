-- CreateTable
CREATE TABLE "contas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papeis" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "tipo_acesso" TEXT NOT NULL DEFAULT 'pago',
    "convidado_por_id" TEXT,
    "convidado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_acesso" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parceiros" (
    "id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "razao_social" TEXT,
    "nome_fantasia" TEXT,
    "cnpj" TEXT,
    "segmento" TEXT,
    "site" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "contato_nome" TEXT,
    "contato_email" TEXT,
    "contato_telefone" TEXT,
    "contato_cargo" TEXT,
    "termos_versao" TEXT,
    "termos_aceito_em" TIMESTAMP(3),
    "termos_ip_aceite" TEXT,
    "termos_hash_doc" TEXT,
    "plano" TEXT DEFAULT 'basico',
    "inicio_assinatura" TIMESTAMP(3),
    "webhook_url" TEXT,
    "api_key" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parceiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "parceiro_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "inicio_em" TIMESTAMP(3),
    "fim_em" TIMESTAMP(3),
    "fechamento_em" TIMESTAMP(3),
    "tipos_compra_elegiveis" TEXT[],
    "janela_cancelamento_dias" INTEGER NOT NULL DEFAULT 30,
    "atribuicao" TEXT NOT NULL DEFAULT 'last-touch',
    "recompensa_tipo" TEXT NOT NULL,
    "recompensa_valor_centavos" INTEGER NOT NULL,
    "dia_pagamento" INTEGER NOT NULL DEFAULT 5,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacoes" (
    "id" TEXT NOT NULL,
    "campanha_id" TEXT NOT NULL,
    "afiliado_id" TEXT NOT NULL,
    "link_indicacao" TEXT NOT NULL,
    "codigo_indicacao" TEXT NOT NULL,
    "chave_pix" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "entrou_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_saque_em" TIMESTAMP(3),

    CONSTRAINT "participacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversoes" (
    "id" TEXT NOT NULL,
    "participacao_id" TEXT NOT NULL,
    "pedido_id_externo" TEXT NOT NULL,
    "email_convidado" TEXT NOT NULL,
    "convidado_id_externo" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "tipo_compra" TEXT NOT NULL,
    "produto_nome" TEXT NOT NULL,
    "produto_id_externo" TEXT,
    "produto_descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "motivo_cancelamento" TEXT,
    "cancelado_em" TIMESTAMP(3),
    "cancelado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmado_em" TIMESTAMP(3),

    CONSTRAINT "conversoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "conversao_id" TEXT NOT NULL,
    "participacao_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "motivo_reversao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmado_em" TIMESTAMP(3),
    "disponivel_em" TIMESTAMP(3),
    "solicitado_em" TIMESTAMP(3),
    "pago_em" TIMESTAMP(3),
    "revertido_em" TIMESTAMP(3),

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "parceiro_id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "status_code" INTEGER,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentado_em" TIMESTAMP(3),

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_email_key" ON "contas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parceiros_conta_id_key" ON "parceiros"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "parceiros_cnpj_key" ON "parceiros"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "parceiros_api_key_key" ON "parceiros"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "participacoes_link_indicacao_key" ON "participacoes"("link_indicacao");

-- CreateIndex
CREATE UNIQUE INDEX "participacoes_codigo_indicacao_key" ON "participacoes"("codigo_indicacao");

-- CreateIndex
CREATE UNIQUE INDEX "participacoes_campanha_id_afiliado_id_key" ON "participacoes"("campanha_id", "afiliado_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversoes_participacao_id_pedido_id_externo_key" ON "conversoes"("participacao_id", "pedido_id_externo");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_conversao_id_key" ON "rewards"("conversao_id");

-- AddForeignKey
ALTER TABLE "tokens_acesso" ADD CONSTRAINT "tokens_acesso_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parceiros" ADD CONSTRAINT "parceiros_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "parceiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes" ADD CONSTRAINT "participacoes_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes" ADD CONSTRAINT "participacoes_afiliado_id_fkey" FOREIGN KEY ("afiliado_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversoes" ADD CONSTRAINT "conversoes_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_conversao_id_fkey" FOREIGN KEY ("conversao_id") REFERENCES "conversoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "parceiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
