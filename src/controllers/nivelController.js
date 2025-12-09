import Nivel from '../models/Nivel.js';

// 🔹 Listar todos os níveis de uma modalidade
export const listarNiveisPorModalidade = async (req, res) => {
  try {
    const { modalidadeId } = req.params;
    const niveis = await Nivel.find({ modalidadeId }).sort({ ordem: 1 });
    return res.status(200).json(niveis);
  } catch (erro) {
    console.error('Erro ao listar níveis:', erro);
    return res.status(500).json({ mensagem: 'Erro ao listar níveis.' });
  }
};



// Atualizar nível
export const atualizarNivel = async (req, res) => {
  try {
    const { id } = req.params;
    const dados = req.body;

    const nivelExistente = await Nivel.findById(id);
    if (!nivelExistente) {
      return res.status(404).json({ mensagem: 'Nível não encontrado.' });
    }

    // Padrão IBJJF para faixa Preta: usar dias por grau
    if (nivelExistente.possuiGraus && nivelExistente.nome === 'Preta' && dados.graus === undefined) {
    const anosPorGrau = [3, 3, 3, 5, 7, 10];
      dados.graus = anosPorGrau.map((anos, i) => ({
        numero: i + 1,
        tempoPadraoDias: anos * 365,
        tempoPadraoAulas: 0,
      }));
    }
    // Demais faixas: recalcular graus com base em aulas se o tempo mudou
    else if (
      dados.tempoPadraoAulas &&
      dados.tempoPadraoAulas !== nivelExistente.tempoPadraoAulas &&
      nivelExistente.possuiGraus
    ) {
      const totalAulas = Number(dados.tempoPadraoAulas) || 0;
      const porGrau = Math.floor(totalAulas / 4);
      dados.graus = [
        { numero: 0, tempoPadraoAulas: 0 },
        { numero: 1, tempoPadraoAulas: porGrau },
        { numero: 2, tempoPadraoAulas: porGrau },
        { numero: 3, tempoPadraoAulas: porGrau },
        { numero: 4, tempoPadraoAulas: porGrau },
      ];
    }

    const nivelAtualizado = await Nivel.findByIdAndUpdate(id, dados, {
      new: true,
    });

    return res.status(200).json({
      mensagem: 'Nível atualizado com sucesso!',
      nivel: nivelAtualizado,
    });
  } catch (erro) {
    console.error(erro);
    return res
      .status(500)
      .json({ mensagem: 'Erro ao atualizar nível.', erro: erro.message });
  }
};
