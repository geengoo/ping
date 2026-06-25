import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  }
  return _resend
}

async function enviarEmail(para: string, assunto: string, html: string) {
  if (process.env.NODE_ENV === 'test') return
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@geengoo.com.br',
    to: para,
    subject: assunto,
    html,
  })
}

export async function enviarCodigoLogin(para: string, codigo: string, _baseUrl: string) {
  if (process.env.NODE_ENV === 'test') return

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@geengoo.com.br',
    to: para,
    subject: `${codigo} — seu código de acesso ao ping`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <p style="color:#666;margin-bottom:24px">Use o código abaixo para acessar o ping:</p>
        <div style="font-size:40px;font-weight:700;letter-spacing:12px;color:#111;margin-bottom:24px">${codigo}</div>
        <p style="color:#999;font-size:14px">Válido por 15 minutos. Uso único.</p>
      </div>
    `,
  })
}

export async function notificarAfiliadoConfirmadoParceiro(email: string, valorCentavos: number) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `Saque de ${valor} confirmado — confira seu PIX`,
    `<p>O parceiro confirmou o pagamento do seu saque de <strong>${valor}</strong>.</p>
    <p>Verifique se o PIX chegou na sua conta.</p>`
  )
}

export async function notificarAfiliadoPrevisaoPagamento(
  email: string,
  valorCentavos: number,
  previsao: Date,
  observacao?: string
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dataPrevisao = previsao.toLocaleDateString('pt-BR')
  await enviarEmail(
    email,
    `Seu saque de ${valor} está sendo processado`,
    `<p>Seu saque de <strong>${valor}</strong> está em andamento.</p>
    <p>Previsão de pagamento: <strong>${dataPrevisao}</strong></p>
    ${observacao ? `<p>Observação do parceiro: ${observacao}</p>` : ''}`
  )
}

export async function notificarSuperadminPrevisao(
  email: string,
  nomeAfiliado: string,
  valorCentavos: number,
  previsao: Date
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dataPrevisao = previsao.toLocaleDateString('pt-BR')
  await enviarEmail(
    email,
    `Parceiro informou previsão de pagamento para saque de ${valor}`,
    `<p>Parceiro informou que pagará o saque de <strong>${nomeAfiliado}</strong> (${valor}) até <strong>${dataPrevisao}</strong>.</p>`
  )
}
