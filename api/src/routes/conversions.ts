import { Router } from 'express'
export const conversionsRouter = Router()
conversionsRouter.post('/', (_req, res) => res.status(501).json({ error: 'not implemented' }))
conversionsRouter.post('/:id/cancel', (_req, res) => res.status(501).json({ error: 'not implemented' }))
