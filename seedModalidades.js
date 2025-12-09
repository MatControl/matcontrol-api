import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Modalidade from './src/models/Modalidade.js';

dotenv.config();

const modalidades = [
  { nome: 'Jiu-Jitsu', descricao: 'Arte suave focada em técnicas de alavanca e solo' },
  { nome: 'Muay Thai', descricao: 'Arte marcial tailandesa com golpes de punho, cotovelo e joelho' },
  { nome: 'Boxe', descricao: 'Modalidade focada em socos e movimentação de pés' },
  { nome: 'Karatê', descricao: 'Arte marcial japonesa de golpes retos e disciplina' },
  { nome: 'Judô', descricao: 'Arte marcial japonesa com projeções e imobilizações' },
  { nome: 'Wrestling', descricao: 'Luta olímpica baseada em quedas e domínio corporal' },
];

const seedModalidades = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado ao MongoDB');

    await Modalidade.deleteMany();
    console.log('Modalidades antigas removidas');

    await Modalidade.insertMany(modalidades);
    console.log('Modalidades cadastradas com sucesso!');

    process.exit();
  } catch (erro) {
    console.error('Erro ao cadastrar modalidades:', erro);
    process.exit(1);
  }
};

seedModalidades();
