import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import type { Parceiro } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      parceiro: Parceiro
    }
  }
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string | undefined
  if (!key) return void res.status(401).json({ error: 'X-API-Key obrigatória' })

  const parceiro = await prisma.parceiro.findUnique({ where: { apiKey: key } })
  if (!parceiro || parceiro.status !== 'ativo') {
    return void res.status(401).json({ error: 'chave inválida ou parceiro inativo' })
  }

  req.parceiro = parceiro
  next()
}
