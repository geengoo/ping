-- Clientes da Geengoo (multi-tenant)
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  logo_url TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Usuários admin dos tenants
CREATE TABLE IF NOT EXISTS tenant_users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Campanhas de indicação
CREATE TABLE IF NOT EXISTS campanhas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  slug VARCHAR(100) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  imagem_url TEXT,
  ativa BOOLEAN DEFAULT true,
  inicio_em TIMESTAMP,
  fim_em TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- Faixas de recompensa por campanha
CREATE TABLE IF NOT EXISTS recompensas (
  id SERIAL PRIMARY KEY,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE CASCADE,
  min_indicacoes INTEGER NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0
);

-- Participantes (quem se cadastrou numa campanha)
CREATE TABLE IF NOT EXISTS participantes (
  id SERIAL PRIMARY KEY,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  indicado_por INTEGER REFERENCES participantes(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(campanha_id, email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_participantes_codigo ON participantes(codigo);
CREATE INDEX IF NOT EXISTS idx_participantes_campanha ON participantes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_tenant ON campanhas(tenant_id);
