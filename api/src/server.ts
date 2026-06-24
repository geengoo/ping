import 'dotenv/config'
import express from 'express'
import cors from 'cors'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// routes montadas nas tasks seguintes

if (require.main === module) {
  const port = process.env.PORT || 3040
  app.listen(port, () => console.log(`ping-api porta ${port}`))
}
