import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  tipo: { type: String, enum: ['gestor', 'professor', 'aluno', 'responsavel'], default: 'aluno' },
  academiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academia' },
  perfis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }], // relação com Perfis
  
  mpPreapprovalId: { type: String, default: null, trim: true },
  referralCode: { type: String, default: null, trim: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralCount: { type: Number, default: 0 },
  referralRewardApplied: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
