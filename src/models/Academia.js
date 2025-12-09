import mongoose from 'mongoose';

const academiaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  endereco: {
    // Globais
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, default: null, trim: true },
    city: { type: String, required: true, trim: true },
    region: { type: String, default: null, trim: true }, // estado/província/região
    postalCode: { type: String, default: null, trim: true },
    country: { type: String, required: true, default: 'BR', trim: true },

    // Campos legados/BR (opcionais para compatibilidade)
    rua: { type: String, default: null, trim: true },
    numero: { type: String, default: null, trim: true },
    cidade: { type: String, default: null, trim: true },
    estado: { type: String, default: null, trim: true }, // UF
    cep: { type: String, default: null, trim: true },
    bairro: { type: String, default: null, trim: true },
  },
  telefone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  cnpj: { type: String, default: null, trim: true },
  banco: { type: String, default: null, trim: true },
  agencia: { type: String, default: null, trim: true },
  conta: { type: String, default: null, trim: true },
  timezone: {
    type: String,
    default: null // IANA tz opcional, derivado do endereço se ausente
  },
  codigoAcademia: { // código que alunos usam pra se matricular
    type: String,
    required: true,
    unique: true
  },
  
  mercadoPagoAccessToken: {
    type: String,
    default: null,
    trim: true
  },
  mpCollectorId: { type: String, default: null, trim: true },
  stripeCustomerId: { type: String, default: null, trim: true },
  stripeSubscriptionId: { type: String, default: null, trim: true },
  statusPagamento: { type: String, default: null, trim: true },
  couponCodeUsed: { type: String, default: null, trim: true },
  referralCode: { type: String, default: null, unique: true, sparse: true, trim: true },
  referralDiscountPercent: { type: Number, default: 0 },
  referredCount: { type: Number, default: 0 },
  referredByAcademiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academia', default: null },
  stripeReferralCouponId: { type: String, default: null, trim: true },
  modalidadesAtivas: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Modalidade'
  }],
  planoTier: { type: String, enum: ['free','basico','intermediario','avancado','teste'], default: 'basico' },
  alunosMax: { type: Number, default: 30 },
  gestor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
  dataCriacao: {
    type: Date,
    default: Date.now
  }
});

const Academia = mongoose.model('Academia', academiaSchema);

export default Academia;
