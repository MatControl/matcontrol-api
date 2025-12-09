import Profile from "../models/Profile.js";
import User from "../models/User.js";
import Academia from "../models/Academia.js";
import Modalidade from "../models/Modalidade.js"; // garante registro do modelo e permite validar modalidade
import Nivel from "../models/Nivel.js";
import { getIbjjfAdultGiCategory } from "../utils/ibjjfCategorias.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const profilePhotosDir = path.join(publicDir, "profile-photos");

// Utilitário simples para escape de regex ao comparar nomes com case-insensitive
const escapeRegex = (str) => (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Criar perfil de dependente (filho)
export const criarDependente = async (req, res) => {
  try {
    let responsavelId = req.user.profileId; // ID do perfil do responsável logado
    const { 
      nome, 
      nascimento, 
      academiaId, 
      modalidadeId, 
      contatoResponsavel,
      sexo,
      peso,
      fotoUrl,
      fotoBase64,
    } = req.body;

    // Fallback: se não houver profileId, tentar resolver ou criar perfil responsável
    if (!responsavelId && req.user?.id) {
      try {
        // Tenta resolver perfil do mesmo usuário que seja gestor/professor/aluno/responsavel
        const perfilElegivel = await Profile.findOne({
          userId: req.user.id,
          tipo: { $in: ["gestor", "professor", "aluno", "responsavel"] },
        }).select("_id tipo academiaId nome");
        if (perfilElegivel) {
          responsavelId = perfilElegivel._id.toString();
          console.log("🔧 Fallback dependente: usando perfil responsável", perfilElegivel.tipo, responsavelId);
        } else if (["gestor", "professor", "aluno", "responsavel"].includes(req.user.tipo)) {
          // Nenhum perfil encontrado, criar um perfil básico para o usuário
          let academiaParaPerfil = req.user.academiaId || null;
          if (!academiaParaPerfil && req.user.tipo === "gestor") {
            const academiaDoGestor = await Academia.findOne({ gestor: req.user.id }).select("_id");
            academiaParaPerfil = academiaDoGestor?._id || null;
          }

          const perfilNovo = await Profile.create({
            userId: req.user.id,
            nome: req.user.nome,
            tipo: req.user.tipo,
            academiaId: academiaParaPerfil,
          });
          await User.findByIdAndUpdate(req.user.id, { $push: { perfis: perfilNovo._id } });
          responsavelId = perfilNovo._id.toString();
          console.log("🆕 Perfil responsável criado automaticamente:", responsavelId, "tipo:", req.user.tipo);
        }
      } catch (e) {
        console.warn("⚠️ Falha ao resolver/criar perfil responsável automaticamente:", e.message);
      }
    }

    // Verificar se o responsável existe e tem tipo válido
    const responsavel = await Profile.findById(responsavelId);
    if (!responsavel) {
      return res.status(404).json({ 
        success: false, 
        message: "Perfil do responsável não encontrado" 
      });
    }

    // Validar se o responsável pode criar dependentes
    const tiposPermitidos = ["gestor", "professor", "aluno", "responsavel"];
    if (!tiposPermitidos.includes(responsavel.tipo)) {
      return res.status(403).json({ 
        success: false, 
        message: `Perfis do tipo "${responsavel.tipo}" não podem criar dependentes` 
      });
    }

    // Validar campos obrigatórios mínimos
    if (!nome || !nascimento) {
      return res.status(400).json({ 
        success: false, 
        message: "Nome e data de nascimento são obrigatórios" 
      });
    }

    // Resolver academia automaticamente (herdar do responsável)
    let academiaResolvida = academiaId || responsavel.academiaId || req.user?.academiaId || null;
    if (!academiaResolvida && responsavel.tipo === "gestor") {
      const academiaDoGestor = await Academia.findOne({ gestor: responsavel.userId }).select("_id");
      if (academiaDoGestor) {
        academiaResolvida = academiaDoGestor._id;
      }
    }
    if (!academiaResolvida) {
      return res.status(400).json({ 
        success: false, 
        message: "Academia não encontrada para o responsável. Informe o academiaId." 
      });
    }

    // Validar modalidade (se fornecida) e garantir que o modelo esteja registrado
    let modalidadeResolvida = null;
    if (modalidadeId) {
      try {
        const modalidade = await Modalidade.findById(modalidadeId).select("_id nome");
        if (!modalidade) {
          return res.status(400).json({
            success: false,
            message: "Modalidade informada não encontrada",
          });
        }
        modalidadeResolvida = modalidade._id;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Modalidade inválida",
          error: e.message,
        });
      }
    }

    // Validar/herdar informações de contato do responsável: preencher automaticamente e solicitar faltas via body
    const baseUser = await User.findById(responsavel.userId).select("email");
    const contatoBody = contatoResponsavel || {};

    const nomeContato = (contatoBody.nome?.trim()) || (responsavel.nome?.trim());
    let telefoneContato = (contatoBody.telefone?.trim()) || (responsavel.telefone?.trim());
    if (!telefoneContato) {
      try {
        const perfilComTelefone = await Profile.findOne({ userId: responsavel.userId, telefone: { $exists: true, $ne: null } }).select("telefone");
        if (perfilComTelefone?.telefone) telefoneContato = String(perfilComTelefone.telefone).trim();
      } catch (e) {
        void e;
      }
    }
    const emailContato = (contatoBody.email?.trim()?.toLowerCase()) || baseUser?.email || null;
    const parentescoContato = contatoBody.parentesco || "outro";

    if (!nomeContato) {
      return res.status(400).json({
        success: false,
        message: "Nome do responsável não encontrado. Informe-o em contatoResponsavel.",
      });
    }

    const contatoFinal = {
      nome: nomeContato,
      telefone: telefoneContato || null,
      email: emailContato,
      parentesco: parentescoContato,
    };

    // Verificar duplicidade de dependente (mesmo responsável, mesmo nome e mesma data de nascimento)
    const nascimentoDate = new Date(nascimento);
    const startOfDay = new Date(nascimentoDate.getFullYear(), nascimentoDate.getMonth(), nascimentoDate.getDate());
    const endOfDay = new Date(nascimentoDate.getFullYear(), nascimentoDate.getMonth(), nascimentoDate.getDate() + 1);

    const nomeRegex = new RegExp(`^${escapeRegex(nome.trim())}$`, "i");
    const dependenteDuplicado = await Profile.findOne({
      responsavelId: responsavelId,
      tipo: "dependente",
      nome: nomeRegex,
      nascimento: { $gte: startOfDay, $lt: endOfDay },
    }).select("_id nome nascimento");

    if (dependenteDuplicado) {
      return res.status(409).json({
        success: false,
        message: "Já existe um dependente com o mesmo nome e data de nascimento para este responsável.",
        dependenteId: dependenteDuplicado._id,
      });
    }

    // Criar o perfil do dependente
    const categoriaPeso = getIbjjfAdultGiCategory(sexo, peso);
    let fotoUrlFinal = fotoUrl || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(",") ? base.split(",").pop() : base;
        const buf = globalThis.Buffer.from(payload, "base64");
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${responsavel.userId?.toString() || "u"}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        fotoUrlFinal = `/profile-photos/${name}`;
      } catch (e) {
        console.warn("Falha ao salvar foto do perfil", e?.message);
      }
    }

    const dependente = new Profile({
      userId: responsavel.userId, // Usa o mesmo userId do responsável
      nome: nome.trim(),
      tipo: "dependente",
      responsavelId: responsavelId,
      academiaId: academiaResolvida,
      modalidadeId: modalidadeResolvida || null,
      nascimento: new Date(nascimento),
      contatoResponsavel: contatoFinal,
      fotoUrl: fotoUrlFinal,
      sexo: sexo || null,
      statusTreino: "ativo",
      dataInicioTreino: new Date(),
      ...(peso !== undefined && Number.isFinite(Number(peso)) && Number(peso) >= 0
        ? { peso: Number(peso) }
        : {}),
      ...(categoriaPeso ? { categoriaPeso } : {}),
    });

    await dependente.save();

    // Popular os campos de referência para retorno completo
    const dependentePopulado = await Profile.findById(dependente._id)
      .populate("academiaId", "nome endereco")
      .populate("modalidadeId", "nome descricao")
      .populate("responsavelId", "nome telefone");

    // Enriquecer com tempo restante
    const calc = await calcularTempoRestanteDependente(dependentePopulado);
    const obj = dependentePopulado.toObject();
    obj.tempoRestanteProximoGrau = calc.proximoGrau;
    obj.tempoRestanteProximoNivel = calc.proximoNivel;

    res.status(201).json({
      success: true,
      message: "Dependente criado com sucesso",
      data: obj
    });

  } catch (error) {
    console.error("Erro ao criar dependente:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao criar dependente",
      error: error.message
    });
  }
};

// Listar dependentes do responsável logado
export const listarMeusDependentes = async (req, res) => {
  try {
    const responsavelId = req.user.profileId;

    const dependentes = await Profile.find({ 
      responsavelId: responsavelId,
      tipo: "dependente"
    })
    .populate("academiaId", "nome endereco")
    .populate("modalidadeId", "nome descricao")
    .populate("faixaId", "nome cor graduacao")
    .sort({ nome: 1 });

    const enriquecidos = await Promise.all(dependentes.map(async (d) => {
      const calc = await calcularTempoRestanteDependente(d);
      const obj = d.toObject();
      obj.tempoRestanteProximoGrau = calc.proximoGrau;
      obj.tempoRestanteProximoNivel = calc.proximoNivel;
      return obj;
    }));

    res.status(200).json({
      success: true,
      message: "Dependentes listados com sucesso",
      data: enriquecidos,
      total: enriquecidos.length
    });

  } catch (error) {
    console.error("Erro ao listar dependentes:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao listar dependentes",
      error: error.message
    });
  }
};

// Atualizar dependente
export const atualizarDependente = async (req, res) => {
  try {
    const responsavelId = req.user.profileId;
    const { dependenteId } = req.params;
    const body = req.body || {};
    const {
      nome,
      nascimento,
      academiaId,
      modalidadeId,
      contatoResponsavel,
      faixaId,
      graus,
      aulasNoNivelAtual,
      pretaDataReferencia,
      statusTreino,
      jaTreina,
      dataInicioTreino,
      sexo,
      peso,
      fotoUrl,
      fotoBase64,
    } = body;

    // Se o corpo não foi enviado ou não há nenhum campo atualizável, retornar 400
    const algumCampoEnviado = [
      nome,
      nascimento,
      academiaId,
      modalidadeId,
      contatoResponsavel,
      faixaId,
      graus,
      aulasNoNivelAtual,
      pretaDataReferencia,
      statusTreino,
      jaTreina,
      dataInicioTreino,
      peso,
      fotoUrl,
      fotoBase64,
    ].some((v) => v !== undefined);
    if (!algumCampoEnviado) {
      return res.status(400).json({
        success: false,
        message: "Nenhum dado para atualizar foi enviado. Verifique o corpo da requisição e o header Content-Type: application/json.",
      });
    }

    // Verificar se o dependente existe
    const dependente = await Profile.findOne({
      _id: dependenteId,
      tipo: "dependente",
    });

    if (!dependente) {
      return res.status(404).json({
        success: false,
        message: "Dependente não encontrado ou você não tem permissão para editá-lo"
      });
    }

    // Validar permissão: o responsável do dependente deve pertencer ao usuário autenticado
    if (!dependente.responsavelId) {
      return res.status(403).json({
        success: false,
        message: "Dependente não possui responsável vinculado. Não é possível editar.",
      });
    }

    // Permitir se o perfil responsável é o perfil selecionado do usuário OU pertence ao mesmo usuário
    if (dependente.responsavelId?.toString() !== responsavelId?.toString()) {
      const perfilResponsavel = await Profile.findById(dependente.responsavelId).select("userId tipo");
      if (!perfilResponsavel || perfilResponsavel.userId?.toString() !== req.user.id?.toString()) {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para editar este dependente.",
        });
      }
    }

    // Atualizar campos permitidos
    if (nome) dependente.nome = nome.trim();
    if (nascimento) dependente.nascimento = new Date(nascimento);
    if (academiaId) dependente.academiaId = academiaId;
    if (modalidadeId !== undefined) dependente.modalidadeId = modalidadeId;
    if (sexo !== undefined) dependente.sexo = sexo || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(",") ? base.split(",").pop() : base;
        const buf = globalThis.Buffer.from(payload, "base64");
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${dependente._id}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        dependente.fotoUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn("Falha ao salvar foto do perfil", e?.message);
      }
    }
    if (fotoUrl !== undefined) dependente.fotoUrl = fotoUrl || null;
    if (faixaId !== undefined) dependente.faixaId = faixaId;
    if (graus !== undefined && Number.isFinite(Number(graus))) dependente.graus = Number(graus);
    if (aulasNoNivelAtual !== undefined) {
      if (aulasNoNivelAtual === null || aulasNoNivelAtual === "") {
        dependente.aulasNoNivelAtual = 0;
      } else if (Number.isFinite(Number(aulasNoNivelAtual)) && Number(aulasNoNivelAtual) >= 0) {
        dependente.aulasNoNivelAtual = Number(aulasNoNivelAtual);
      }
    }
    // Atualização de referência da faixa preta e possível recálculo de graus
    try {
      const faixaIdFinal = faixaId !== undefined ? faixaId : dependente.faixaId;
      if (pretaDataReferencia !== undefined || faixaId !== undefined) {
        if (faixaIdFinal) {
          const faixa = await Nivel.findById(faixaIdFinal).select("nome graus");
          if (faixa && (faixa.nome || "").toLowerCase() === "preta") {
            const refCandidate = pretaDataReferencia !== undefined ? pretaDataReferencia : dependente.pretaDataReferencia;
            if (refCandidate) {
              const refDate = new Date(refCandidate);
              if (!isNaN(refDate.getTime())) {
                const grausDuracoesDias = (faixa.graus || [])
                  .sort((a, b) => Number(a.numero) - Number(b.numero))
                  .map(g => Number(g.tempoPadraoDias || 0));
                let g = graus !== undefined ? Number(graus) : Number(dependente.graus || 0);
                g = Number.isFinite(g) ? g : 0;
                let ref = refDate;
                const now = new Date();
                let elapsedDays = Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
                while (g < 6) {
                  const needed = grausDuracoesDias[g] || 0;
                  if (!needed || elapsedDays < needed) break;
                  elapsedDays -= needed;
                  g += 1;
                  ref = new Date(ref.getTime() + needed * 24 * 60 * 60 * 1000);
                }
                dependente.graus = g;
                dependente.pretaDataReferencia = ref;
              }
            } else if (pretaDataReferencia === null) {
              // permitir limpar a referência se solicitado explicitamente
              dependente.pretaDataReferencia = null;
            }
        } else if (pretaDataReferencia !== undefined) {
          // Se não for faixa preta, apenas persistir a referência como está (se válida)
          if (pretaDataReferencia === null) {
            dependente.pretaDataReferencia = null;
          } else {
            const refDate = new Date(pretaDataReferencia);
            if (!isNaN(refDate.getTime())) {
              dependente.pretaDataReferencia = refDate;
            }
          }
        }
        } else if (pretaDataReferencia !== undefined) {
          // Sem faixa definida: apenas persistir se válido/solicitado
          if (pretaDataReferencia === null) {
            dependente.pretaDataReferencia = null;
          } else {
            const refDate = new Date(pretaDataReferencia);
            if (!isNaN(refDate.getTime())) {
              dependente.pretaDataReferencia = refDate;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Falha ao atualizar referência/graduação da faixa preta:", e.message);
    }
    if (peso !== undefined) {
      if (peso === null || peso === "") {
        dependente.peso = null;
      } else if (Number.isFinite(Number(peso)) && Number(peso) >= 0) {
        dependente.peso = Number(peso);
      }
    }

    // Recalcular categoria de peso se houver dados
    const categoriaAtualizada = getIbjjfAdultGiCategory(dependente.sexo, dependente.peso);
    dependente.categoriaPeso = categoriaAtualizada || null;
    if (statusTreino !== undefined) {
      const permitidos = ["ativo", "inativo", "suspenso"];
      if (!permitidos.includes(statusTreino)) {
        return res.status(400).json({
          success: false,
          message: "statusTreino inválido. Use 'ativo', 'inativo' ou 'suspenso'.",
        });
      }
      dependente.statusTreino = statusTreino;
    }

    // 📅 Lógica de início de treino semelhante a professor/aluno
    if (jaTreina !== undefined) {
      let dataInicioFinal;
      if (jaTreina === true) {
        dataInicioFinal = dataInicioTreino ? new Date(dataInicioTreino) : dependente.dataInicioTreino;
      } else if (jaTreina === false) {
        dataInicioFinal = new Date();
      }
      if (dataInicioFinal) dependente.dataInicioTreino = dataInicioFinal;
    }
    
    // Atualizar contato do responsável se fornecido
    if (contatoResponsavel) {
      dependente.contatoResponsavel = {
        nome: contatoResponsavel.nome?.trim() || dependente.contatoResponsavel.nome,
        telefone: contatoResponsavel.telefone?.trim() || dependente.contatoResponsavel.telefone,
        email: contatoResponsavel.email?.trim().toLowerCase() || dependente.contatoResponsavel.email,
        parentesco: contatoResponsavel.parentesco || dependente.contatoResponsavel.parentesco
      };
    }

    await dependente.save();

    const dependenteAtualizado = await Profile.findById(dependenteId)
      .populate("academiaId", "nome endereco")
      .populate("modalidadeId", "nome descricao")
      .populate("faixaId", "nome cor graduacao");
    // Enriquecer com tempo restante
    const calc = await calcularTempoRestanteDependente(dependenteAtualizado);
    const obj = dependenteAtualizado.toObject();
    obj.tempoRestanteProximoGrau = calc.proximoGrau;
    obj.tempoRestanteProximoNivel = calc.proximoNivel;

    res.status(200).json({
      success: true,
      message: "Dependente atualizado com sucesso",
      data: obj
    });

  } catch (error) {
    console.error("Erro ao atualizar dependente:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar dependente",
      error: error.message
    });
  }
};

// Excluir dependente
export const excluirDependente = async (req, res) => {
  try {
    const responsavelId = req.user.profileId;
    const { dependenteId } = req.params;

    // Verificar se o dependente existe e pertence ao responsável
    const dependente = await Profile.findOne({
      _id: dependenteId,
      responsavelId: responsavelId,
      tipo: "dependente"
    });

    if (!dependente) {
      return res.status(404).json({
        success: false,
        message: "Dependente não encontrado ou você não tem permissão para excluí-lo"
      });
    }

    await Profile.findByIdAndDelete(dependenteId);

    res.status(200).json({
      success: true,
      message: "Dependente excluído com sucesso"
    });

  } catch (error) {
    console.error("Erro ao excluir dependente:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao excluir dependente",
      error: error.message
    });
  }
};

// Obter detalhes de um dependente específico
export const obterDependente = async (req, res) => {
  try {
    const responsavelId = req.user.profileId;
    const { dependenteId } = req.params;

    const dependente = await Profile.findOne({
      _id: dependenteId,
      responsavelId: responsavelId,
      tipo: "dependente"
    })
    .populate("academiaId", "nome endereco telefone email")
    .populate("modalidadeId", "nome descricao")
    .populate("faixaId", "nome cor graduacao tempoPadraoAulas graus")
    .populate("responsavelId", "nome telefone email");

    if (!dependente) {
      return res.status(404).json({
        success: false,
        message: "Dependente não encontrado"
      });
    }

    const calc = await calcularTempoRestanteDependente(dependente);
    const obj = dependente.toObject();
    obj.tempoRestanteProximoGrau = calc.proximoGrau;
    obj.tempoRestanteProximoNivel = calc.proximoNivel;

    res.status(200).json({
      success: true,
      message: "Dependente encontrado",
      data: obj
    });

  } catch (error) {
    console.error("Erro ao obter dependente:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao obter dependente",
      error: error.message
    });
  }
};

export default {
  criarDependente,
  listarMeusDependentes,
  atualizarDependente,
  excluirDependente,
  obterDependente
};
// Helper: calcula tempo restante de próximo grau e próximo nível para um perfil
const calcularTempoRestanteDependente = async (perfil) => {
  try {
    if (!perfil?.faixaId) return { proximoGrau: null, proximoNivel: null };
    const nivel = await Nivel.findById(perfil.faixaId).lean();
    if (!nivel) return { proximoGrau: null, proximoNivel: null };

    let proximoGrau = null;
    if (nivel.possuiGraus) {
      if (nivel.nome === "Preta") {
        const grausDuracoes = (nivel.graus || []).map(g => g.tempoPadraoDias || 0);
        const grauAtual = Number(perfil.graus) || 0;
        if (grauAtual >= grausDuracoes.length) {
          proximoGrau = { unidade: "dias", valor: 0, total: 0, grauAtual, grauSeguinte: null };
        } else {
          const ref = perfil.pretaDataReferencia ? new Date(perfil.pretaDataReferencia) : null;
          const totalDias = grausDuracoes[grauAtual] || 0;
          if (!ref || !Number.isFinite(totalDias) || totalDias <= 0) {
            proximoGrau = { unidade: "dias", valor: null, total: totalDias || null, grauAtual, grauSeguinte: grauAtual + 1 };
          } else {
            const agora = new Date();
            const elapsedMs = agora - ref;
            const elapsedDias = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
            const restante = Math.max((totalDias || 0) - elapsedDias, 0);
            proximoGrau = { unidade: "dias", valor: restante, total: totalDias, grauAtual, grauSeguinte: grauAtual + 1 };
          }
        }
      } else {
        const g1 = (nivel.graus || []).find(g => g.numero === 1);
        const porGrau = g1?.tempoPadraoAulas || Math.floor((nivel.tempoPadraoAulas || 0) / 4);
        const grauAtual = Number(perfil.graus) || 0;
        const aulasNoNivelAtual = Number(perfil.aulasNoNivelAtual) || 0;
        const aulasCumpridasParaGraus = porGrau * Math.min(grauAtual, 4);
        const aulasDesdeUltimoGrau = Math.max(aulasNoNivelAtual - aulasCumpridasParaGraus, 0);
        const restante = Math.max(porGrau - aulasDesdeUltimoGrau, 0);
        const temProximo = grauAtual < 4;
        proximoGrau = temProximo
          ? { unidade: "aulas", valor: restante, total: porGrau, grauAtual, grauSeguinte: grauAtual + 1 }
          : { unidade: "aulas", valor: 0, total: porGrau, grauAtual, grauSeguinte: null };
      }
    }

    let proximoNivel = null;
    const totalNivelAulas = Number(nivel.tempoPadraoAulas) || 0;
    const aulasNoNivelAtual = Number(perfil.aulasNoNivelAtual) || 0;
    if (totalNivelAulas > 0) {
      const restanteNivel = Math.max(totalNivelAulas - aulasNoNivelAtual, 0);
      const prox = await Nivel.findOne({ modalidadeId: nivel.modalidadeId, ordem: { $gt: nivel.ordem } }).sort({ ordem: 1 }).lean();
      proximoNivel = {
        unidade: "aulas",
        valor: restanteNivel,
        total: totalNivelAulas,
        nivelAtual: nivel.nome,
        proximoNivel: prox?.nome || null,
      };
    }

    return { proximoGrau, proximoNivel };
  } catch (e) {
    console.warn("Falha ao calcular tempo restante (dependente):", e.message);
    return { proximoGrau: null, proximoNivel: null };
  }
};