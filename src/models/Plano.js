import mongoose from "mongoose";

const planoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
  },
  descricao: {
    type: String,
  },
  valor: {
    type: Number,
    required: true,
  },
  academiaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Academia",
    required: true,
  },
  modalidadesDisponiveis: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Modalidade",
    },
  ],
  ativo: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

export default mongoose.model("Plano", planoSchema);
