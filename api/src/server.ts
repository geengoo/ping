import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { apiKeyAuth } from './middleware/apiKey'
import { affiliatesRouter } from './routes/affiliates'
import { conversionsRouter } from './routes/conversions'
import { payoutsRouter } from './routes/payouts'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/v1/affiliates', apiKeyAuth, affiliatesRouter)
app.use('/v1/conversions', apiKeyAuth, conversionsRouter)
app.use('/v1/payouts', apiKeyAuth, payoutsRouter)

if (require.main === module) {
  const port = process.env.PORT || 3040
  app.listen(port, () => console.log(`ping-api porta ${port}`))
}
