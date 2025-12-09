import mongoose from 'mongoose';

const modalidadeSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    unique: true,
  },
  descricao: {
    type: String,
  },
});

const Modalidade = mongoose.model('Modalidade', modalidadeSchema);

export default Modalidade;

