import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  }
  return _resend
}

export async function enviarEmail(para: string, assunto: string, html: string) {
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

export async function enviarConviteParceiro({
  para,
  nomeContato,
  nomeFantasia,
  token,
}: {
  para: string
  nomeContato: string
  nomeFantasia: string
  token: string
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ping.geengoo.io'
  const link = `${baseUrl}/onboarding?token=${token}`
  await enviarEmail(
    para,
    `${nomeContato}, você foi convidado para o ping`,
    `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 32px">
        <p style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px">Olá, ${nomeContato}</p>
        <p style="color:#555;margin-bottom:24px">
          Você foi convidado para configurar o programa de indicações da <strong>${nomeFantasia}</strong> no ping.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#374151;color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
          Completar cadastro
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">
          Este link expira em 7 dias. Se você não esperava este convite, ignore este email.
        </p>
      </div>
    `,
  )
}
