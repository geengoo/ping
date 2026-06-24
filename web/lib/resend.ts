import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  }
  return _resend
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
