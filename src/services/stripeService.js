import Stripe from 'stripe'
import { Buffer } from 'node:buffer'
import dotenv from 'dotenv'
dotenv.config()

const secret = (process.env.STRIPE_SECRET_KEY || '').trim()
const stripe = secret ? new Stripe(secret) : null

export async function getOrCreateCustomer(academia, email) {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY ausente')
  if (academia.stripeCustomerId) return academia.stripeCustomerId
  const customer = await stripe.customers.create({ email, metadata: { academiaId: String(academia._id) } })
  return customer.id
}

export async function createCheckoutSession(academia, priceId, successUrl, cancelUrl, discountCouponId) {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY ausente')
  const customerId = await getOrCreateCustomer(academia, academia.email)
  const payload = {
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { academiaId: String(academia._id) }
  }
  if (discountCouponId) {
    payload.discounts = [{ coupon: discountCouponId }]
  }
  const session = await stripe.checkout.sessions.create(payload)
  return session
}

export async function parseStripeEvent(req) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  const sig = req.headers['stripe-signature']
  if (secret && sig && stripe) {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    return stripe.webhooks.constructEvent(buf, sig, secret)
  }
  return req.body
}