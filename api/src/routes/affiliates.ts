import { Router } from 'express'
export const affiliatesRouter = Router()
affiliatesRouter.post('/', (_req, res) => res.status(501).json({ error: 'not implemented' }))
affiliatesRouter.get('/:id/balance', (_req, res) => res.status(501).json({ error: 'not implemented' }))
