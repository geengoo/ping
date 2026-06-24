import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@geengoo.com.br'

export async function enviarEmail(para: string, assunto: string, html: string) {
  if (process.env.NODE_ENV === 'test') return
  await resend.emails.send({ from: FROM, to: para, subject: assunto, html })
}

export async function notificarAfiliadoRewardDisponivel(email: string, valorCentavos: number, baseUrl: string) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `${valor} disponível para saque no ping`,
    `<p>Sua indicação foi confirmada. <strong>${valor}</strong> está disponível para saque.</p><p><a href="${baseUrl}">Acessar ping</a></p>`
  )
}

export async function notificarParceiroPagamento(email: string, afiliadoNome: string, valorCentavos: number, payoutId: string) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `Solicitação de saque — ${valor} — prazo 5 dias`,
    `<p><strong>${afiliadoNome}</strong> solicitou saque de <strong>${valor}</strong>.</p><p>Prazo: 5 dias úteis. Após pagar, confirme em seu painel ping.</p><p>ID do saque: <code>${payoutId}</code></p>`
  )
}

export async function notificarAfiliadoPago(email: string, valorCentavos: number) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(email, `Saque de ${valor} confirmado`, `<p>Seu saque de <strong>${valor}</strong> foi confirmado pelo parceiro.</p>`)
}

export async function alertarSuperadminSaqueAtrasado(superadminEmail: string, afiliadoNome: string, valorCentavos: number, payoutId: string) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    superadminEmail,
    `[ALERTA] Saque atrasado — ${valor}`,
    `<p>Saque de <strong>${afiliadoNome}</strong> (${valor}) está com mais de 5 dias sem confirmação.</p><p>ID: <code>${payoutId}</code></p>`
  )
}
