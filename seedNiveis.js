import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Modalidade from './src/models/Modalidade.js';
import Nivel from './src/models/Nivel.js';

dotenv.config();

const seedNiveis = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Nivel.deleteMany({});

    const modalidades = await Modalidade.find();

    for (const modalidade of modalidades) {
      // 🥋 JIU-JITSU
      if (modalidade.nome === 'Jiu-Jitsu') {
        const faixasInfantis = [
          { nome: 'Branca', ordem: 1, idadeMinima: 4, idadeMaxima: 5, tempoPadraoAulas: 180 },
          { nome: 'Cinza', ordem: 2, idadeMinima: 6, idadeMaxima: 7, tempoPadraoAulas: 180 },
          { nome: 'Amarela', ordem: 3, idadeMinima: 8, idadeMaxima: 9, tempoPadraoAulas: 180 },
          { nome: 'Laranja', ordem: 4, idadeMinima: 10, idadeMaxima: 11, tempoPadraoAulas: 180 },
          { nome: 'Verde', ordem: 5, idadeMinima: 12, idadeMaxima: 15, tempoPadraoAulas: 180 },
        ];

        const faixasAdulto = [
          { nome: 'Branca', ordem: 6, idadeMinima: 16, tempoPadraoAulas: 120 },
          { nome: 'Azul', ordem: 7, idadeMinima: 16, tempoPadraoAulas: 180 },
          { nome: 'Roxa', ordem: 8, idadeMinima: 18, tempoPadraoAulas: 180 },
          { nome: 'Marrom', ordem: 9, idadeMinima: 20, tempoPadraoAulas: 180 },
          { nome: 'Preta', ordem: 10, idadeMinima: 19, tempoPadraoAulas: 120 },
        ];

        const todos = [...faixasInfantis, ...faixasAdulto];

        for (const item of todos) {
          // ⚙️ Cálculo de graus: IBJJF em dias para Preta, aulas para demais
          let graus = [];
          if (item.nome === 'Preta') {
  const anosPorGrau = [3, 3, 3, 5, 7, 10];
            graus = anosPorGrau.map((anos, i) => ({
              numero: i + 1,
              tempoPadraoDias: anos * 365,
              tempoPadraoAulas: 0,
            }));
          } else {
            const totalAulas = Number(item.tempoPadraoAulas) || 0;
            const porGrau = Math.floor(totalAulas / 4);
            graus = [
              { numero: 0, tempoPadraoAulas: 0 },
              { numero: 1, tempoPadraoAulas: porGrau },
              { numero: 2, tempoPadraoAulas: porGrau },
              { numero: 3, tempoPadraoAulas: porGrau },
              { numero: 4, tempoPadraoAulas: porGrau },
            ];
          }

          await Nivel.findOneAndUpdate(
            { nome: item.nome, modalidadeId: modalidade._id },
            {
              nome: item.nome,
              ordem: item.ordem,
              modalidadeId: modalidade._id,
              idadeMinima: item.idadeMinima,
              idadeMaxima: item.idadeMaxima,
              tempoPadraoAulas: item.tempoPadraoAulas,
              possuiGraus: true,
              graus,
            },
            { upsert: true, new: true }
          );
        }

        console.log('🥋 Níveis de Jiu-Jitsu criados.');
      }

      // 🥊 MUAY THAI
      else if (modalidade.nome === 'Muay Thai') {
        const khans = [
          '1º Khan (Branca)',
          '2º Khan (Amarela)',
          '3º Khan (Laranja)',
          '4º Khan (Verde)',
          '5º Khan (Azul)',
          '6º Khan (Roxa)',
          '7º Khan (Marrom)',
          '8º Khan (Preta)',
          'Instrutor',
          'Mestre',
        ];

        for (let i = 0; i < khans.length; i++) {
          await Nivel.create({
            nome: khans[i],
            ordem: i + 1,
            modalidadeId: modalidade._id,
            idadeMinima: 10,
            tempoPadraoAulas: 180,
            possuiGraus: false,
            graus: [],
          });
        }

        console.log('🥊 Níveis de Muay Thai criados.');
      }

      // 🥋 JUDÔ
      else if (modalidade.nome === 'Judô') {
        const faixas = [
          'Branca', 'Cinza', 'Azul-Clara', 'Amarela', 'Laranja', 'Verde',
          'Roxa', 'Marrom', 'Preta', 'Coral', 'Vermelha',
        ];

        const idades = [
          { min: 4, max: 6 },
          { min: 7, max: 8 },
          { min: 9, max: 10 },
          { min: 11, max: 12 },
          { min: 13, max: 14 },
          { min: 15, max: 16 },
          { min: 17, max: 18 },
          { min: 19, max: 20 },
          { min: 21, max: 40 },
          { min: 41, max: 59 },
          { min: 60, max: 120 },
        ];

        for (let i = 0; i < faixas.length; i++) {
          await Nivel.create({
            nome: faixas[i],
            ordem: i + 1,
            modalidadeId: modalidade._id,
            idadeMinima: idades[i].min,
            idadeMaxima: idades[i].max,
            tempoPadraoAulas: 365,
            possuiGraus: true,
            graus: [1, 2, 3, 4].map((n) => ({
              numero: n,
              tempoPadraoAulas: 90,
            })),
          });
        }

        console.log('🥋 Níveis de Judô criados.');
      }

      // 🥊 BOXE
      else if (modalidade.nome === 'Boxe') {
        const niveis = [
          { nome: 'Iniciante', tempo: 180 },
          { nome: 'Intermediário', tempo: 365 },
          { nome: 'Avançado', tempo: 365 },
          { nome: 'Competidor', tempo: 730 },
          { nome: 'Instrutor', tempo: 1095 },
        ];

        for (let i = 0; i < niveis.length; i++) {
          await Nivel.create({
            nome: niveis[i].nome,
            ordem: i + 1,
            modalidadeId: modalidade._id,
            idadeMinima: 14,
            tempoPadraoAulas: niveis[i].tempo,
            possuiGraus: false,
            graus: [],
          });
        }

        console.log('🥊 Níveis de Boxe criados.');
      }

      // 🥋 KARATÊ
      else if (modalidade.nome === 'Karatê') {
        const kyus = [
          '10º Kyu (Branca)',
          '9º Kyu (Amarela)',
          '8º Kyu (Laranja)',
          '7º Kyu (Verde)',
          '6º Kyu (Azul)',
          '5º Kyu (Roxa)',
          '4º Kyu (Marrom 3)',
          '3º Kyu (Marrom 2)',
          '2º Kyu (Marrom 1)',
          '1º Kyu (Pré-Preta)',
        ];

        const dans = [
          '1º Dan (Preta)',
          '2º Dan',
          '3º Dan',
          '4º Dan',
          '5º Dan',
          '6º Dan',
          '7º Dan',
          '8º Dan',
          '9º Dan',
          '10º Dan',
        ];

        const todos = [...kyus, ...dans];

        for (let i = 0; i < todos.length; i++) {
          await Nivel.create({
            nome: todos[i],
            ordem: i + 1,
            modalidadeId: modalidade._id,
            idadeMinima: i < 10 ? 6 : 16,
            tempoPadraoAulas: i < 10 ? 180 : 365,
            possuiGraus: i < 10,
            graus: i < 10 ? [1, 2, 3, 4].map((n) => ({
              numero: n,
              tempoPadraoAulas: 45,
            })) : [],
          });
        }

        console.log('🥋 Níveis de Karatê criados.');
      }

      // 🤼‍♂️ WRESTLING
      else if (modalidade.nome === 'Wrestling') {
        const niveis = [
          { nome: 'Iniciante', tempo: 180 },
          { nome: 'Intermediário', tempo: 365 },
          { nome: 'Avançado', tempo: 730 },
          { nome: 'Competidor', tempo: 1095 },
          { nome: 'Técnico / Treinador', tempo: 1460 },
        ];

        for (let i = 0; i < niveis.length; i++) {
          await Nivel.create({
            nome: niveis[i].nome,
            ordem: i + 1,
            modalidadeId: modalidade._id,
            idadeMinima: 10,
            tempoPadraoAulas: niveis[i].tempo,
            possuiGraus: false,
            graus: [],
          });
        }

        console.log('🤼‍♂️ Níveis de Wrestling criados.');
      }

      else {
        console.log(`⚙️ Nenhuma lógica específica para ${modalidade.nome}, ignorando.`);
      }
    }

    console.log('✅ Todos os níveis foram cadastrados com sucesso.');
    mongoose.connection.close();
  } catch (erro) {
    console.error('❌ Erro ao cadastrar níveis:', erro);
    mongoose.connection.close();
  }
};

seedNiveis();
