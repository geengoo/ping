import dotenv from 'dotenv'

process.env.NODE_ENV = 'test'
dotenv.config({ path: '.env.test' })

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod'
if (!process.env.DATABASE_URL_TEST) throw new Error('DATABASE_URL_TEST obrigatório para testes')
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
process.env.WORKER_SECRET = 'test-worker-secret-do-not-use-in-prod'
process.env.WEB_BASE_URL = 'https://ping.geengoo.test'
process.env.SUPERADMIN_EMAIL = 'superadmin@ping.test'
