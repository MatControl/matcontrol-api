import mongoose from "mongoose";

const PagamentoSchema = new mongoose.Schema({
  valor: { type: Number, required: false, default: null },
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
  academiaId: { type: mongoose.Schema.Types.ObjectId, ref: "Academia", required: true },
  descricao: { type: String, default: null, trim: true },
  status: { type: String, enum: ["pendente", "pago", "falhou", "isento"], default: "pendente" },
  dataPagamento: { type: Date, default: null },
  mesReferencia: { type: String, default: null, trim: true },
  
  mpPaymentId: { type: String, default: null },
  mpPreapprovalId: { type: String, default: null },
  // Campos anteriores mantidos para compatibilidade e relatórios
  tipo: { type: String, enum: ["gestor_plataforma", "aluno_academia"], default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  planoId: { type: mongoose.Schema.Types.ObjectId, ref: "Plano", default: null },
  amount: { type: Number, default: null },
  currency: { type: String, default: "brl" },
  
}, { timestamps: true });

export default mongoose.model("Pagamento", PagamentoSchema);
