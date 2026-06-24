import { Router } from 'express'
export const payoutsRouter = Router()
payoutsRouter.post('/:id/confirm', (_req, res) => res.status(501).json({ error: 'not implemented' }))
