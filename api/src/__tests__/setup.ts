process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod'
if (!process.env.DATABASE_URL_TEST) throw new Error('DATABASE_URL_TEST obrigatório para testes')
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
