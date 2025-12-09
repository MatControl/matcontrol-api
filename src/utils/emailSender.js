import nodemailer from 'nodemailer'

export async function sendEmail(to, subject, text, html) {
  const host = process.env.SMTP_HOST || ''
  const port = Number(process.env.SMTP_PORT || '0')
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || user || ''
  if (!host || !port || !user || !pass || !from) {
    console.warn('SMTP config ausente, email não enviado', { to, subject })
    return false
  }
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  const opts = { from, to, subject, text: text || undefined, html: html || undefined }
  try {
    await transporter.sendMail(opts)
    return true
  } catch (e) {
    console.warn('Falha ao enviar email', e?.message)
    return false
  }
}
