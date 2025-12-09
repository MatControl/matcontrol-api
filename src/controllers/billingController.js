import Academia from '../models/Academia.js'
import { createCheckoutSession, parseStripeEvent, getOrCreateCustomer } from '../services/stripeService.js'

export const subscribe = async (req, res) => {
  try {
    if (req.user?.tipo !== 'gestor') return res.status(403).json({ mensagem: 'Apenas gestor' })
    const academia = await Academia.findOne({ gestor: req.user.id }).select('_id email stripeCustomerId stripeSubscriptionId')
    if (!academia) return res.status(404).json({ mensagem: 'Academia do gestor não encontrada' })
    const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim()
    if (!secretKey || secretKey.includes('replace_with_your_key')) return res.status(400).json({ mensagem: 'STRIPE_SECRET_KEY ausente ou inválida' })
    const tierReq = String(req.body?.tier || '').toLowerCase()
    const map = {
      basico: (process.env.STRIPE_PRICE_BASICO || '').trim(),
      intermediario: (process.env.STRIPE_PRICE_INTERMEDIARIO || '').trim(),
      avancado: (process.env.STRIPE_PRICE_AVANCADO || '').trim()
    }
    let priceId = (process.env.STRIPE_PLATFORM_PRICE_ID || '').trim()
    if (tierReq && map[tierReq]) priceId = map[tierReq]
    if (!priceId || priceId.includes('replace_with_your_id')) return res.status(400).json({ mensagem: 'priceId ausente ou inválido para o tier selecionado' })
    const origin = (process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/$/,'')
    const successUrl = `${origin}/test/gestor/dashboard?success=stripe`
    const cancelUrl = `${origin}/test/gestor/checkout?cancel=stripe`
    // Aplicar desconto de indicação acumulado, criando/reatribuindo cupom Stripe
    let couponId = null
    try {
      const pct = Math.max(0, Math.min(100, Number((await Academia.findById(academia._id).select('referralDiscountPercent stripeReferralCouponId'))?.referralDiscountPercent || 0)))
      const stripeCouponSaved = (await Academia.findById(academia._id).select('stripeReferralCouponId'))?.stripeReferralCouponId || null
      if (pct > 0) {
        const StripeLib = (await import('stripe')).default
        const sec = (process.env.STRIPE_SECRET_KEY||'').trim()
        if (sec) {
          const s = new StripeLib(sec)
          if (stripeCouponSaved) {
            couponId = stripeCouponSaved
          } else {
            const c = await s.coupons.create({ percent_off: pct, duration: 'forever', name: `Referral ${pct}% - ${String(academia._id)}` })
            couponId = c.id
            await Academia.updateOne({ _id: academia._id }, { $set: { stripeReferralCouponId: couponId } })
          }
        }
      }
    } catch {
      couponId = null
    }
    const session = await createCheckoutSession(academia, priceId, successUrl, cancelUrl, couponId)
    const customerId = await getOrCreateCustomer(academia, academia.email)
    await Academia.updateOne({ _id: academia._id }, { $set: { stripeCustomerId: customerId } })
    return res.status(200).json({ url: session.url })
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao iniciar assinatura Stripe', erro: erro.message, detalhes: erro?.raw?.message || null })
  }
}

export const webhook = async (req, res) => {
  try {
    const event = await parseStripeEvent(req)
    const type = event?.type || null
    if (!type) return res.status(200).json({ ok: true })
    if (type === 'checkout.session.completed') {
      const sess = event.data?.object || {}
      const academiaId = sess?.metadata?.academiaId || null
      const subId = sess?.subscription || null
      if (academiaId) await Academia.updateOne({ _id: academiaId }, { $set: { stripeSubscriptionId: subId, statusPagamento: 'ativo' } })
    } else if (type === 'invoice.payment_failed') {
      const custId = event.data?.object?.customer || null
      if (custId) await Academia.updateOne({ stripeCustomerId: custId }, { $set: { statusPagamento: 'inativo' } })
    }
    return res.json({ received: true })
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro no webhook Stripe', erro: erro.message })
  }
}

export const health = async (req, res) => {
  try {
    const hasSecret = !!(process.env.STRIPE_SECRET_KEY||'').trim()
    const hasPrice = !!(process.env.STRIPE_PLATFORM_PRICE_ID||'').trim()
    const hasWebhook = !!(process.env.STRIPE_WEBHOOK_SECRET||'').trim()
    return res.status(200).json({ ok: hasSecret && hasPrice, hasSecret, hasPrice, hasWebhook })
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao verificar saúde do Stripe', erro: erro.message })
  }
}