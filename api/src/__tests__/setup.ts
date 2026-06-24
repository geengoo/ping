process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod'
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://ping:ping_2026@187.77.56.138:5432/ping_test'
