import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 'test')
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

export async function alertarParceiroLembrete(email: string, nomeAfiliado: string, valorCentavos: number) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `Lembrete: saque de ${valor} vence em 2 dias`,
    `<p><strong>${nomeAfiliado}</strong> solicitou um saque de <strong>${valor}</strong> há 3 dias.</p>
    <p>O prazo vence em 2 dias. Confirme o pagamento via API quando realizar o PIX.</p>`
  )
}

export async function alertarParceiroVencido(
  email: string,
  nomeAfiliado: string,
  valorCentavos: number,
  linkConfirm: string,
  linkDispute: string
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `[URGENTE] Saque de ${valor} vencido — você já pagou?`,
    `<p>O prazo de 5 dias para o saque de <strong>${valor}</strong> solicitado por <strong>${nomeAfiliado}</strong> venceu.</p>
    <p>Você já realizou o pagamento via PIX?</p>
    <p style="margin-top:24px">
      <a href="${linkConfirm}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Sim, já paguei</a>
      &nbsp;&nbsp;
      <a href="${linkDispute}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Ainda não paguei</a>
    </p>`
  )
}

export async function alertarSuperadminSaqueVencido(
  email: string,
  nomeAfiliado: string,
  valorCentavos: number,
  rewardId: string
) {
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await enviarEmail(
    email,
    `[ALERTA] Saque de ${valor} para ${nomeAfiliado} está vencido`,
    `<p>O saque de <strong>${valor}</strong> solicitado por <strong>${nomeAfiliado}</strong> está com mais de 5 dias sem confirmação.</p>
    <p>O parceiro foi notificado com os botões de ação.</p>
    <p>ID do reward: <code>${rewardId}</code></p>`
  )
}
