// src/controllers/planoController.js
import Plano from "../models/Plano.js";
import Academia from "../models/Academia.js";
import Profile from "../models/Profile.js";

// 🟢 Criar um novo plano
export const criarPlano = async (req, res) => {
  try {
    const { nome, descricao, valor, modalidadesDisponiveis, academiaId } = req.body;

    let academiaIdResolvido = academiaId || req.user?.academiaId || null;
    if (!academiaIdResolvido && req.user?.tipo === 'gestor') {
      try {
        const acad = await Academia.findOne({ gestor: req.user.id }).select('_id');
        academiaIdResolvido = acad?._id || null;
      } catch (e) { void e; }
    }
    if (!academiaIdResolvido) {
      try {
        const perfil = await Profile.findOne({ userId: req.user.id, academiaId: { $exists: true, $ne: null } }).select('academiaId');
        academiaIdResolvido = perfil?.academiaId || null;
      } catch (e) { void e; }
    }

    const academia = await Academia.findById(academiaIdResolvido);
    if (!academia) {
      return res.status(404).json({ mensagem: "Academia não encontrada." });
    }
    if (String(academia.planoTier) === 'free') {
      return res.status(403).json({ mensagem: 'Plano Free não permite criar planos pagos na academia.' });
    }

    const novoPlano = new Plano({
      nome,
      descricao,
      valor,
      modalidadesDisponiveis,
      academiaId: academia._id,
    });

    await novoPlano.save();

    res.status(201).json({
      mensagem: "Plano criado com sucesso!",
      plano: novoPlano,
    });
  } catch (erro) {
    console.error("Erro ao criar plano:", erro);
    res.status(500).json({ mensagem: "Erro ao criar plano." });
  }
};

// 🟡 Listar planos por academia
export const listarPlanosPorAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params;

    // Garantir que a academia existe e obter modalidades ativas
    const academia = await Academia.findById(academiaId).select('modalidadesAtivas');
    if (!academia) {
      return res.status(404).json({ mensagem: "Academia não encontrada." });
    }

    // Popular apenas modalidades que estão ativas na academia
    const planos = await Plano.find({ academiaId }).populate({
      path: 'modalidadesDisponiveis',
      match: { _id: { $in: academia.modalidadesAtivas || [] } },
    });

    // Opcionalmente, incluir referência às modalidades ativas na resposta
    res.json({
      modalidadesAtivasAcademia: academia.modalidadesAtivas,
      planos,
    });
  } catch (erro) {
    console.error("Erro ao listar planos:", erro);
    res.status(500).json({ mensagem: "Erro ao listar planos." });
  }
};

export const listarMeusPlanosGestor = async (req, res) => {
  try {
    let academiaId = req.user?.academiaId || null;
    let academia = null;
    if (academiaId) {
      academia = await Academia.findById(academiaId).select('modalidadesAtivas');
    }
    if (!academia) {
      academia = await Academia.findOne({ gestor: req.user.id }).select('modalidadesAtivas _id');
    }
    if (!academia) {
      return res.status(404).json({ mensagem: 'Academia do gestor não encontrada.' });
    }
    const planos = await Plano.find({ academiaId: academia._id }).populate({
      path: 'modalidadesDisponiveis',
      match: { _id: { $in: academia.modalidadesAtivas || [] } },
    });
    return res.status(200).json({ modalidadesAtivasAcademia: academia.modalidadesAtivas, planos });
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao listar meus planos.', erro: erro.message });
  }
};

// 🔵 Atualizar plano
export const atualizarPlano = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["nome","descricao","valor","modalidadesDisponiveis","ativo"]; 
    const body = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const planoAtualizado = await Plano.findByIdAndUpdate(id, body, { new: true });

    if (!planoAtualizado) {
      return res.status(404).json({ mensagem: "Plano não encontrado." });
    }

    res.json({
      mensagem: "Plano atualizado com sucesso!",
      plano: planoAtualizado,
    });
  } catch (erro) {
    console.error("Erro ao atualizar plano:", erro);
    res.status(500).json({ mensagem: "Erro ao atualizar plano." });
  }
};

// 🔴 Deletar plano
export const deletarPlano = async (req, res) => {
  try {
    const { id } = req.params;
    const plano = await Plano.findByIdAndDelete(id);

    if (!plano) {
      return res.status(404).json({ mensagem: "Plano não encontrado." });
    }

    res.json({ mensagem: "Plano deletado com sucesso!" });
  } catch (erro) {
    console.error("Erro ao deletar plano:", erro);
    res.status(500).json({ mensagem: "Erro ao deletar plano." });
  }
};
