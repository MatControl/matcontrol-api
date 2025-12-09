import Modalidade from '../models/Modalidade.js';
import Academia from '../models/Academia.js';

// 🟢 Listar todas as modalidades fixas disponíveis
export const listarModalidades = async (req, res) => {
  try {
    let modalidades = await Modalidade.find();
    if (!modalidades || modalidades.length === 0) {
      const defaults = [
        { nome: 'Jiu-Jitsu', descricao: 'Arte suave' },
        { nome: 'Judô', descricao: 'Caminho suave' },
        { nome: 'Muay Thai', descricao: 'Boxe tailandês' },
        { nome: 'Boxe', descricao: 'Nobre arte' },
        { nome: 'Jiu-Jitsu Kids', descricao: 'Treino infantil' },
      ];
      try {
        await Modalidade.insertMany(defaults, { ordered: false });
      } catch (e) { void e; }
      modalidades = await Modalidade.find();
    }
    res.json(modalidades);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: 'Erro ao listar modalidades.' });
  }
};

// 🔵 Ativar modalidades na academia do gestor
export const ativarModalidadesNaAcademia = async (req, res) => {
  try {
    if (req.user.tipo !== 'gestor') {
      return res.status(403).json({ mensagem: 'Apenas gestores podem configurar modalidades.' });
    }

    const { academiaId, modalidades } = req.body; // array de IDs das modalidades

    let academia = null;
    if (academiaId) {
      academia = await Academia.findById(academiaId);
    } else {
      academia = await Academia.findOne({ gestor: req.user.id });
    }
    if (!academia) {
      return res.status(404).json({ mensagem: 'Academia não encontrada.' });
    }

    academia.modalidadesAtivas = modalidades;
    await academia.save();

    res.json({
      mensagem: 'Modalidades atualizadas com sucesso!',
      modalidadesAtivas: academia.modalidadesAtivas
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ mensagem: 'Erro ao atualizar modalidades.' });
  }
};

// 🟢 Listar modalidades ativas da minha academia (qualquer usuário autenticado)
export const listarModalidadesDaMinhaAcademia = async (req, res) => {
  try {
    let academiaId = req.user?.academiaId || null;
    let academia;

    // Fallback para gestor sem academiaId resolvido no token
    if (!academiaId && req.user?.tipo === 'gestor') {
      academia = await Academia.findOne({ gestor: req.user.id }).populate('modalidadesAtivas');
    } else if (academiaId) {
      academia = await Academia.findById(academiaId).populate('modalidadesAtivas');
    }

    if (!academia) {
      return res.status(404).json({ mensagem: 'Academia não encontrada para o usuário.' });
    }

    return res.json(academia.modalidadesAtivas || []);
  } catch (erro) {
    console.error('Erro ao listar modalidades da academia:', erro);
    return res.status(500).json({ mensagem: 'Erro ao listar modalidades da academia.' });
  }
};

// 🔴 Remover uma modalidade ativa da minha academia (somente gestor)
export const removerModalidadeDaMinhaAcademia = async (req, res) => {
  try {
    if (req.user?.tipo !== 'gestor') {
      return res.status(403).json({ mensagem: 'Apenas gestores podem remover modalidades da academia.' });
    }

    const { modalidadeId } = req.params;
    if (!modalidadeId) {
      return res.status(400).json({ mensagem: 'Informe o modalidadeId para remover.' });
    }

    const academia = await Academia.findOne({ gestor: req.user.id }).select('_id modalidadesAtivas');
    if (!academia) {
      return res.status(404).json({ mensagem: 'Academia do gestor não encontrada.' });
    }

    const estavaAtiva = (academia.modalidadesAtivas || []).some(id => String(id) === String(modalidadeId));

    await Academia.findByIdAndUpdate(academia._id, { $pull: { modalidadesAtivas: modalidadeId } });
    const atualizada = await Academia.findById(academia._id).populate('modalidadesAtivas');

    return res.json({
      mensagem: estavaAtiva ? 'Modalidade removida da academia.' : 'Modalidade não estava ativa; nenhuma alteração realizada.',
      removida: estavaAtiva,
      modalidadesAtivas: atualizada?.modalidadesAtivas || []
    });
  } catch (erro) {
    console.error('Erro ao remover modalidade da academia:', erro);
    return res.status(500).json({ mensagem: 'Erro ao remover modalidade da academia.' });
  }
};
