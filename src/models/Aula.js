import mongoose from 'mongoose';

const AulaSchema = new mongoose.Schema({
  turmaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turma',
    required: true,
  },
  dataHora: {
    type: Date,
    required: true,
  },
  nome: {
    type: String,
    default: null,
  },
  posicao: {
    type: String,
    default: null,
  },
  observacoes: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['agendada', 'cancelada', 'aguardando chamada', 'finalizada'],
    default: 'agendada',
  },
  chamadaFeita: {
    type: Boolean,
    default: false,
  },
  confirmados: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
}, { timestamps: true });

// Evitar duplicidade de agendamento por turma/dataHora
AulaSchema.index({ turmaId: 1, dataHora: 1 }, { unique: true });

export default mongoose.model('Aula', AulaSchema);