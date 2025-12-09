import mongoose from 'mongoose';

const GrauSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  tempoPadraoAulas: { type: Number, default: 0 },
  tempoPadraoDias: { type: Number, default: 0 }
});

const NivelSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  ordem: { type: Number, required: true },
  modalidadeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Modalidade',
    required: true
  },
  idadeMinima: { type: Number, default: 0 },     // idade mínima para esse nível
  idadeMaxima: { type: Number },                 // idade máxima para esse nível (opcional)
  tempoPadraoAulas: { type: Number, required: true },
  possuiGraus: { type: Boolean, default: false },
  graus: [GrauSchema]
}, { timestamps: true });

const Nivel = mongoose.model('Nivel', NivelSchema);
export default Nivel;