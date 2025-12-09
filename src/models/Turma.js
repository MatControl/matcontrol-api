import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const TurmaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
  },
  modalidade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Modalidade',
    required: true,
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  diasDaSemana: {
    type: [String],
    required: true,
  },
  horario: {
    type: String,
    required: true,
  },
  academia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Academia',
    required: true,
  },
  alunos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  codigoConvite: {
    type: String,
    default: uuidv4, // gera automaticamente um código único
  },
}, { timestamps: true })

export default mongoose.model('Turma', TurmaSchema)
