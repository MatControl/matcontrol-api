import Academia from "../models/Academia.js"
import Plano from "../models/Plano.js"
import User from "../models/User.js"
import Pagamento from "../models/Pagamento.js"
import { URL } from "url"

const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase()

function resolveFrontendOrigin() {
  const cand = (process.env.FRONTEND_URL || process.env.APP_FRONTEND_ORIGIN || "").trim()
  const list = (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)
  const origin = cand || list[0] || "http://localhost:3000"
  return origin
}

function resolveBackUrl(kind) {
  const envKey = `MP_BACK_URL_${String(kind || '').toUpperCase()}`
  let url = (process.env[envKey] || `${resolveFrontendOrigin()}/pagamento/${kind}`).trim()
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) throw new Error('bad')
    if (['localhost','127.0.0.1'].includes(u.hostname)) {
      u.protocol = 'https:'
      u.hostname = 'example.com'
      url = u.toString()
    } else {
      url = u.toString()
    }
  } catch {
    url = `https://example.com/pagamento/${kind}`
  }
  return url
}

function getAcademiaToken(academia) {
  const acad = academia?.mercadoPagoAccessToken || ''
  if (acad) return acad
  if (NODE_ENV !== 'production') {
    const envTok = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim()
    if (envTok) return envTok
  }
  return ''
}

async function mpFetch(token, path, method = "GET", body = null) {
  const url = `https://api.mercadopago.com${path}`
  const res = await globalThis.fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.message || res.statusText)
  return json
}

function tierConfig(tier) {
  const t = String(tier || "basico").toLowerCase()
  if (t === "basico") return { name: "Plano Básico MatControl", amount: 99 }
  if (t === "intermediario") return { name: "Plano Intermediário MatControl", amount: 150 }
  if (t === "avancado") return { name: "Plano Avançado MatControl", amount: 250 }
  return { name: "Plano Básico MatControl", amount: 99 }
}

export const criarCheckoutGestor = async (req, res) => {
  try {
    if (req.user?.tipo !== "gestor") return res.status(403).json({ mensagem: "Apenas gestor pode iniciar pagamento da plataforma." })
    const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim()
    if (!token) return res.status(400).json({ mensagem: "Configure MERCADO_PAGO_ACCESS_TOKEN." })
    const academia = await Academia.findOne({ gestor: req.user.id }).select("_id nome")
    if (!academia) return res.status(404).json({ mensagem: "Academia do gestor não encontrada." })
    const { tier } = req.body || {}
    const cfg = tierConfig(tier)
    const userDoc = await User.findById(req.user.id).select("email nome")
  const data = {
      payer_email: userDoc?.email || undefined,
      back_url: resolveBackUrl('sucesso'),
      reason: cfg.name,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(cfg.amount), currency_id: "BRL" },
      external_reference: String(academia._id),
    }
    const created = await mpFetch(token, "/preapproval", "POST", data)
    await User.updateOne({ _id: req.user.id }, { $set: { mpPreapprovalId: created?.id || null } })
    return res.status(200).json({ preapprovalId: created?.id || null, url: created?.init_point || null })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao criar checkout do gestor.", erro: erro.message })
  }
}

export const criarCheckoutAluno = async (req, res) => {
  try {
    if (req.user?.tipo !== "aluno") return res.status(403).json({ mensagem: "Apenas aluno pode iniciar pagamento de plano." })
    const { planoId } = req.body || {}
    if (!planoId) return res.status(400).json({ mensagem: "Informe planoId." })
    const plano = await Plano.findById(planoId).select("academiaId nome valor")
    if (!plano) return res.status(404).json({ mensagem: "Plano não encontrado." })
    const academia = await Academia.findById(plano.academiaId).select("mercadoPagoAccessToken nome")
    if (!academia) return res.status(400).json({ mensagem: "Academia não encontrada." })
    const tokenAcademia = getAcademiaToken(academia)
    if (!tokenAcademia) return res.status(400).json({ mensagem: "Academia sem Mercado Pago configurado." })
    const userDoc = await User.findById(req.user.id).select("email nome")
  const data = {
      payer_email: userDoc?.email || undefined,
      back_url: resolveBackUrl('sucesso'),
      reason: `Plano ${plano.nome}`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(plano.valor), currency_id: "BRL" },
      external_reference: String(plano._id),
    }
    const created = await mpFetch(tokenAcademia, "/preapproval", "POST", data)
    await User.updateOne({ _id: req.user.id }, { $set: { mpPreapprovalId: created?.id || null } })
    return res.status(200).json({ preapprovalId: created?.id || null, url: created?.init_point || null })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao criar checkout do aluno.", erro: erro.message })
  }
}

export const criarCheckoutAssinaturaAluno = async (req, res) => {
  try {
    if (req.user?.tipo !== "aluno") return res.status(403).json({ mensagem: "Apenas aluno pode iniciar assinatura de plano." })
    const { planoId, couponCode } = req.body || {}
    if (!planoId) return res.status(400).json({ mensagem: "Informe planoId." })
    const plano = await Plano.findById(planoId).select("academiaId nome valor")
    if (!plano) return res.status(404).json({ mensagem: "Plano não encontrado." })
    const academia = await Academia.findById(plano.academiaId).select("mercadoPagoAccessToken nome")
    if (!academia) return res.status(400).json({ mensagem: "Academia não encontrada." })
    const tokenAcademia = getAcademiaToken(academia)
    if (!tokenAcademia) return res.status(400).json({ mensagem: "Academia sem Mercado Pago configurado." })
    const userDoc = await User.findById(req.user.id).select("email nome")
    let amount = Number(plano.valor)
    let autoRecurring = { frequency: 1, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" }
    if (couponCode === "TRIAL7") autoRecurring = { ...autoRecurring, free_trial: { frequency: 7, frequency_type: "days" } }
    if (couponCode === "BETA100_3M") autoRecurring = { ...autoRecurring, free_trial: { frequency: 3, frequency_type: "months" } }
    if (couponCode === "VITALICIO50") amount = Math.max(Math.round(amount * 0.5), 1)
    autoRecurring.transaction_amount = amount
  const data = {
      payer_email: userDoc?.email || undefined,
      back_url: resolveBackUrl('sucesso'),
      reason: `Plano ${plano.nome}`,
      auto_recurring: autoRecurring,
      external_reference: String(plano._id),
    }
    const created = await mpFetch(tokenAcademia, "/preapproval", "POST", data)
    await User.updateOne({ _id: req.user.id }, { $set: { mpPreapprovalId: created?.id || null } })
    return res.status(200).json({ preapprovalId: created?.id || null, url: created?.init_point || null })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao criar assinatura.", erro: erro.message })
  }
}

export const configurarStripeAcademia = async (req, res) => {
  try {
    if (req.user?.tipo !== "gestor") return res.status(403).json({ mensagem: "Apenas gestor pode configurar Mercado Pago da academia." })
    const { academiaId } = req.params
    const { mercadoPagoAccessToken } = req.body || {}
    if (!mercadoPagoAccessToken) return res.status(400).json({ mensagem: "Informe mercadoPagoAccessToken." })
    const academia = await Academia.findById(academiaId).select("gestor mercadoPagoAccessToken planoTier")
    if (!academia) return res.status(404).json({ mensagem: "Academia não encontrada." })
    if (String(academia.gestor) !== String(req.user.id)) return res.status(403).json({ mensagem: "Gestor não vinculado à academia." })
    if (String(academia.planoTier) === 'free') return res.status(403).json({ mensagem: 'Plano Free não permite configurar conta de pagamentos.' })
    academia.mercadoPagoAccessToken = mercadoPagoAccessToken
    await academia.save()
    return res.status(200).json({ mensagem: "Mercado Pago configurado para academia." })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao configurar Mercado Pago da academia.", erro: erro.message })
  }
}

export const conectarStripeAcademia = async (req, res) => {
  try {
    if (req.user?.tipo !== "gestor") return res.status(403).json({ mensagem: "Apenas gestor pode conectar Mercado Pago para a academia." })
    const origin = resolveFrontendOrigin()
    return res.status(200).json({ mensagem: "Use PATCH /api/pagamentos/academias/:academiaId/stripe com mercadoPagoAccessToken obtido via OAuth do Mercado Pago.", doc: "https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing/" , return_url: `${origin}/mercadopago/onboarding/return` })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao conectar Mercado Pago.", erro: erro.message })
  }
}

export const criarPagamento = async (req, res) => {
  try {
    const { valor, alunoId, academiaId, descricao } = req.body || {}
    if (!valor || !academiaId) return res.status(400).json({ mensagem: "Informe valor e academiaId." })
    const academia = await Academia.findById(academiaId).select("mercadoPagoAccessToken")
    if (!academia) return res.status(400).json({ mensagem: "Academia não encontrada." })
    const tokenAcademia = getAcademiaToken(academia)
    if (!tokenAcademia) return res.status(400).json({ mensagem: "Academia sem Mercado Pago configurado." })
    const pagamento = new Pagamento({ valor: Number(valor), alunoId: alunoId || req.user?.id || null, academiaId, descricao: descricao || null, status: "pendente", tipo: "aluno_academia", userId: alunoId || req.user?.id || null, amount: Number(valor), currency: "BRL" })
    await pagamento.save()
    const origin = resolveFrontendOrigin()
    const userDoc = await User.findById(alunoId || req.user?.id).select("email nome")
    const baseWebhook = (process.env.MP_NOTIFICATION_URL || `${origin.replace(/\/$/, "")}/api/pagamentos/mercadopago/webhook`).trim()
    const notificationUrl = `${baseWebhook}?academiaId=${encodeURIComponent(String(academiaId))}`
    const pref = {
      items: [{ title: descricao || "Pagamento Academia", unit_price: Number(valor), quantity: 1 }],
      payer: { email: userDoc?.email || undefined },
      back_urls: { success: resolveBackUrl('sucesso'), failure: resolveBackUrl('cancelado'), pending: resolveBackUrl('pendente') },
      auto_return: "approved",
      external_reference: String(pagamento._id),
      notification_url: notificationUrl,
    }
    const created = await mpFetch(tokenAcademia, "/checkout/preferences", "POST", pref)
    return res.status(200).json({ preferenceId: created?.id || null, url: created?.init_point || created?.sandbox_init_point || null })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao criar pagamento.", erro: erro.message })
  }
}

export const mercadoPagoWebhook = async (req, res) => {
  try {
    const id = req.query?.id || req.body?.data?.id || null
    const topic = req.query?.topic || req.body?.type || null
    const academiaId = req.query?.academiaId || null
    if (!id || !academiaId) return res.status(200).json({ ok: true })
    const academia = await Academia.findById(academiaId).select("mercadoPagoAccessToken")
    if (!academia) return res.status(200).json({ ok: true })
    const tokenAcademia = getAcademiaToken(academia)
    if (!tokenAcademia) return res.status(200).json({ ok: true })
    if (String(topic).toLowerCase().includes("payment")) {
      const payment = await mpFetch(tokenAcademia, `/v1/payments/${id}`, "GET")
      const ext = payment?.external_reference || null
      if (ext) {
        const status = payment?.status || ""
        if (status === "approved") {
          await Pagamento.updateOne({ _id: ext }, { $set: { status: "pago", dataPagamento: new Date(), mpPaymentId: String(id) } })
        } else if (status === "rejected" || status === "cancelled") {
          await Pagamento.updateOne({ _id: ext }, { $set: { status: "falhou", mpPaymentId: String(id) } })
        }
      }
    }
    return res.json({ received: true })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro no webhook.", erro: erro.message })
  }
}

export const listarPagamentosPorAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params
    const academia = await Academia.findById(academiaId).select("gestor")
    if (!academia) return res.status(404).json({ mensagem: "Academia não encontrada." })
    if (String(academia.gestor) !== String(req.user?.id)) return res.status(403).json({ mensagem: "Sem permissão." })
    const pagamentos = await Pagamento.find({ academiaId }).sort({ createdAt: -1 })
    return res.json(pagamentos)
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao listar pagamentos da academia.", erro: erro.message })
  }
}

export const listarPagamentosPorAluno = async (req, res) => {
  try {
    const { alunoId } = req.params
    if (String(alunoId) !== String(req.user?.id) && req.user?.tipo !== "gestor") return res.status(403).json({ mensagem: "Sem permissão." })
    const pagamentos = await Pagamento.find({ alunoId }).sort({ createdAt: -1 })
    return res.json(pagamentos)
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao listar pagamentos do aluno.", erro: erro.message })
  }
}

export const isentarMensalidadeAluno = async (req, res) => {
  try {
    if (req.user?.tipo !== "gestor") return res.status(403).json({ mensagem: "Somente gestor pode isentar mensalidade." })
    const { academiaId } = req.params
    const { alunoId, motivo, mesReferencia } = req.body || {}
    const academia = await Academia.findById(academiaId).select("gestor")
    if (!academia) return res.status(404).json({ mensagem: "Academia não encontrada." })
    if (String(academia.gestor) !== String(req.user.id)) return res.status(403).json({ mensagem: "Sem permissão." })
    const pagamento = new Pagamento({ valor: 0, alunoId, academiaId, descricao: motivo || null, status: "isento", mesReferencia: mesReferencia || null })
    await pagamento.save()
    return res.status(201).json({ mensagem: "Mensalidade isenta registrada.", pagamento })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao isentar mensalidade.", erro: erro.message })
  }
}

export const listarPrecosPlataforma = async (req, res) => {
  try {
    const prices = {
      basico: { name: "Plano Básico MatControl", amount: 99, currency: "BRL" },
      intermediario: { name: "Plano Intermediário MatControl", amount: 150, currency: "BRL" },
      avancado: { name: "Plano Avançado MatControl", amount: 250, currency: "BRL" },
    }
    return res.json(prices)
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao listar preços.", erro: erro.message })
  }
}

export const obterReferralLinkGestor = async (req, res) => {
  try {
    if (req.user?.tipo !== "gestor") return res.status(403).json({ mensagem: "Apenas gestor pode obter link de indicação." })
    const userDoc = await User.findById(req.user.id).select("referralCode nome")
    const origin = resolveFrontendOrigin()
    const code = userDoc?.referralCode || ""
    const link = `${origin}/cadastro?ref=${encodeURIComponent(code)}`
    return res.status(200).json({ link, referralCode: code })
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao obter link de indicação.", erro: erro.message })
  }
}

export const statusConfigAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params
    const academia = await Academia.findById(academiaId).select('mercadoPagoAccessToken gestor')
    if (!academia) return res.status(404).json({ mensagem: 'Academia não encontrada.' })
    const isGestor = String(academia.gestor) === String(req.user?.id)
    const hasAcademiaToken = Boolean(academia.mercadoPagoAccessToken)
    const envTok = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim()
    const usingFallback = !hasAcademiaToken && NODE_ENV !== 'production' && !!envTok
    return res.status(200).json({ node_env: NODE_ENV, isGestor, hasAcademiaToken, usingFallback })
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao verificar configuração da academia.', erro: erro.message })
  }
}

export const obterMpPublicKey = async (req, res) => {
  try {
    const key = (process.env.MP_PUBLIC_KEY || '').trim()
    if (!key) return res.status(404).json({ mensagem: 'MP_PUBLIC_KEY não configurada.' })
    return res.status(200).json({ publicKey: key })
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao obter chave pública.', erro: erro.message })
  }
}

export const criarPagamentoGestorCheckoutApi = async (req, res) => {
  try {
    if (req.user?.tipo !== 'gestor') return res.status(403).json({ mensagem: 'Apenas gestor pode realizar pagamento da plataforma.' })
    const academia = await Academia.findOne({ gestor: req.user.id }).select('_id nome mercadoPagoAccessToken')
    if (!academia) return res.status(404).json({ mensagem: 'Academia do gestor não encontrada.' })
    const token = getAcademiaToken(academia)
    if (!token) return res.status(400).json({ mensagem: 'Configure MERCADO_PAGO_ACCESS_TOKEN ou o token da academia.' })
    const tier = String(req.body?.tier || 'basico').toLowerCase()
    const cfg = tierConfig(tier)
    const form = req.body?.formData || {}
    const body = {
      transaction_amount: Number(cfg.amount),
      token: form.token,
      payment_method_id: form.payment_method_id,
      installments: Number(form.installments || 1),
      issuer_id: form.issuer_id,
      payer: {
        email: form.payer?.email || req.user?.email,
        identification: form.payer?.identification || undefined,
      },
      description: cfg.name,
      external_reference: String(academia._id),
    }
    if (!body.token || !body.payment_method_id) return res.status(400).json({ mensagem: 'Dados do cartão ausentes.' })
    const created = await mpFetch(token, '/v1/payments', 'POST', body)
    return res.status(200).json({ id: created?.id || null, status: created?.status || null, status_detail: created?.status_detail || null })
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao criar pagamento via Checkout API.', erro: erro.message })
  }
}

export const criarAssinaturaGestorCartao = async (req, res) => {
  try {
    if (req.user?.tipo !== 'gestor') return res.status(403).json({ mensagem: 'Apenas gestor pode assinar a plataforma.' })
    const academia = await Academia.findOne({ gestor: req.user.id }).select('_id nome mercadoPagoAccessToken')
    if (!academia) return res.status(404).json({ mensagem: 'Academia do gestor não encontrada.' })
    const token = getAcademiaToken(academia)
    if (!token) return res.status(400).json({ mensagem: 'Configure MERCADO_PAGO_ACCESS_TOKEN ou o token da academia.' })
    const tier = String(req.body?.tier || 'basico').toLowerCase()
    const cfg = tierConfig(tier)
    const form = req.body?.formData || {}
    const cardToken = form?.token || ''
    if (!cardToken) return res.status(400).json({ mensagem: 'Token do cartão ausente.' })
    const userDoc = await User.findById(req.user.id).select('email nome')
    const data = {
      payer_email: userDoc?.email || undefined,
      card_token_id: cardToken,
      reason: cfg.name,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: Number(cfg.amount), currency_id: 'BRL' },
    }
    try {
      const created = await mpFetch(token, '/preapproval', 'POST', data)
      await User.updateOne({ _id: req.user.id }, { $set: { mpPreapprovalId: created?.id || null } })
      return res.status(200).json({ preapprovalId: created?.id || null, status: created?.status || null })
    } catch (e) {
      return res.status(400).json({ mensagem: 'Falha na assinatura transparente', erro: String(e?.message || e) })
    }
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao criar assinatura por cartão.', erro: erro.message })
  }
}