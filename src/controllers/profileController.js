import mongoose from "mongoose";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
import Academia from "../models/Academia.js";
import Nivel from "../models/Nivel.js";
import { getWeightCategory, getIbjjfAdultGiCategory } from "../utils/ibjjfCategorias.js";
import Modalidade from "../models/Modalidade.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const profilePhotosDir = path.join(publicDir, "profile-photos");
 

// Helper: calcula tempo restante para próximo grau e próximo nível
const calcularTempoRestante = async (perfil) => {
  try {
    if (!perfil?.faixaId) {
      return { proximoGrau: null, proximoNivel: null };
    }

    const nivel = await Nivel.findById(perfil.faixaId).lean();
    if (!nivel) {
      return { proximoGrau: null, proximoNivel: null };
    }

    // Próximo Grau
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
        const porGrau = (() => {
          const g1 = (nivel.graus || []).find(g => g.numero === 1);
          return g1?.tempoPadraoAulas || Math.floor((nivel.tempoPadraoAulas || 0) / 4);
        })();
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

    // Próximo Nível (tempo restante dentro do nível atual)
    let proximoNivel = null;
    const totalNivelAulas = Number(nivel.tempoPadraoAulas) || 0;
    const aulasNoNivelAtual = Number(perfil.aulasNoNivelAtual) || 0;
    if (totalNivelAulas > 0) {
      const restanteNivel = Math.max(totalNivelAulas - aulasNoNivelAtual, 0);
      // localizar o próximo nível por ordem (se existir)
      const prox = await Nivel.findOne({ modalidadeId: nivel.modalidadeId, ordem: { $gt: nivel.ordem } }).sort({ ordem: 1 }).lean();
      proximoNivel = {
        unidade: "aulas",
        valor: restanteNivel,
        total: totalNivelAulas,
        nivelAtual: nivel.nome,
        proximoNivel: prox?.nome || null,
      };

      // Requisitos mínimos de tempo por faixa (dias)
      const requisitosTempoDias = {
        Azul: 365 * 2,
        Roxa: 365 * 2,
        Marrom: Math.round(365 * 1.5),
      };
      const inicioFaixa = perfil.dataInicioFaixa || perfil.dataInicioTreino || perfil.criadoEm || null;
      const agora = new Date();
      const elapsedDiasFaixa = inicioFaixa ? Math.floor((agora - new Date(inicioFaixa)) / (1000 * 60 * 60 * 24)) : null;
      const requerDias = requisitosTempoDias[nivel.nome] || null;
      const atendeTempoMinimo = requerDias ? (elapsedDiasFaixa !== null && elapsedDiasFaixa >= requerDias) : true;

      // Requisito mínimo de aulas: terminar total do nível
      const atendeAulasMinimo = restanteNivel <= 0;

      // Status especial: graduando somente se grau >=4, há próximo nível e atende aulas e tempo
      const grauAtualGlobal = Number(perfil.graus) || 0;
      if (nivel.possuiGraus && grauAtualGlobal >= 4 && proximoNivel.proximoNivel && atendeAulasMinimo && atendeTempoMinimo) {
        proximoNivel.status = "graduando";
      }
    }

    return { proximoGrau, proximoNivel };
  } catch (e) {
    console.warn("Falha ao calcular tempo restante:", e.message);
    return { proximoGrau: null, proximoNivel: null };
  }
};

/**
 * Controller de criação de perfis
 */


export const criarPerfil = async (req, res) => {
  try {
    const { criadorPerfilId } = req.params;
    const { nome, tipo, nascimento, academiaId, modalidadeId, faixaId, graus, telefone, contatoResponsavel, fotoUrl, fotoBase64 } = req.body;

    console.log("🚀 Iniciando criação de perfil...");
    console.log("📋 Parâmetros URL:", criadorPerfilId);
    console.log("👤 Usuário logado:", req.user);
    console.log("🔑 Profile ID do usuário:", req.user?.profileId);

    const criadorId = criadorPerfilId || req.user?.profileId;

    console.log("PARAMS:", req.params);
    console.log("BODY:", req.body);
    
    // Fallback: tentar resolver automaticamente o perfil criador pelo usuário logado
    let criadorPerfilIdResolvido = criadorId;
    if (!criadorPerfilIdResolvido && req.user?.id) {
      try {
        // Primeiro tenta pelo mesmo tipo do usuário logado
        const perfilDoMesmoTipo = await Profile.findOne({ userId: req.user.id, tipo: req.user.tipo }).select("_id");
        if (perfilDoMesmoTipo) {
          criadorPerfilIdResolvido = perfilDoMesmoTipo._id.toString();
          console.log("🔧 Fallback: perfil criador resolvido pelo mesmo tipo:", criadorPerfilIdResolvido);
        } else {
          // Senão, pega qualquer perfil do usuário
          const qualquerPerfil = await Profile.findOne({ userId: req.user.id }).select("_id tipo");
          if (qualquerPerfil) {
            criadorPerfilIdResolvido = qualquerPerfil._id.toString();
            console.log("🔧 Fallback: perfil criador resolvido pelo primeiro perfil:", criadorPerfilIdResolvido, "tipo:", qualquerPerfil.tipo);
}

 
        }
      } catch (e) {
        console.warn("⚠️ Falha ao resolver perfil criador automaticamente:", e.message);
      }
    }

    // Se ainda não foi possível resolver, e o usuário é gestor, criar perfil gestor automaticamente
    if (!criadorPerfilIdResolvido && req.user?.tipo === "gestor") {
      try {
        const perfilGestorAuto = await Profile.create({
          userId: req.user.id,
          nome: req.user.nome,
          tipo: "gestor",
          academiaId: req.user.academiaId || null,
        });
        // Vincular ao usuário
        await User.findByIdAndUpdate(req.user.id, { $push: { perfis: perfilGestorAuto._id } });
        criadorPerfilIdResolvido = perfilGestorAuto._id.toString();
        console.log("🆕 Perfil gestor criado automaticamente para o criador:", criadorPerfilIdResolvido);
      } catch (e) {
        console.warn("⚠️ Falha ao criar perfil gestor automaticamente:", e.message);
      }
    }

    if (!criadorPerfilIdResolvido) {
      return res.status(400).json({
        message: "É necessário informar o ID do perfil criador (criadorPerfilId) ou estar logado com um perfil válido.",
      });
    }

    const criador = await Profile.findById(criadorPerfilIdResolvido);
    if (!criador) {
      return res.status(404).json({ message: "Criador do perfil não encontrado." });
    }

    // 🔒 Regras de permissão de criação
    const permissoes = {
      gestor: ["professor", "dependente", "aluno"],
      professor: ["dependente", "aluno"],
      aluno: ["dependente"],
      dependente: [],
    };

    if (!permissoes[criador.tipo].includes(tipo)) {
      return res.status(403).json({
        message: `Perfis do tipo "${criador.tipo}" não podem criar perfis do tipo "${tipo}".`,
      });
    }

    // 🏫 Validações e resolução de academia para criações vinculadas a gestor/professor
    let academiaResolvida = null;
    if (["gestor", "professor"].includes(criador.tipo) && ["professor", "aluno"].includes(tipo)) {
      academiaResolvida = criador.academiaId || req.user?.academiaId || null;

      // Se criador é gestor e não tem academia, tentar resolver automaticamente
      if (!academiaResolvida && criador.tipo === "gestor") {
        try {
          const academiaDoGestor = await Academia.findOne({ gestor: criador.userId }).select("_id");
          if (academiaDoGestor) {
            academiaResolvida = academiaDoGestor._id.toString();
            await Profile.findByIdAndUpdate(criador._id, { academiaId: academiaDoGestor._id });
            await User.findByIdAndUpdate(criador.userId, { academiaId: academiaDoGestor._id });
            console.log("🏫 Academia do gestor resolvida e persistida:", academiaResolvida);
          }
        } catch (e) {
          console.warn("⚠️ Falha ao resolver academia do gestor automaticamente:", e.message);
        }
      }

      // Se ainda não houver academia, aceitar do body e persistir
      if (!academiaResolvida) {
        if (academiaId) {
          academiaResolvida = academiaId.toString();
          try {
            await Profile.findByIdAndUpdate(criador._id, { academiaId: academiaId });
            await User.findByIdAndUpdate(criador.userId, { academiaId: academiaId });
            console.log("✅ Academia vinculada ao criador por fallback:", academiaId);
          } catch (e) {
            console.warn("⚠️ Falha ao persistir academia no criador:", e.message);
          }
        } else {
          return res.status(400).json({
            message: `${criador.tipo === "gestor" ? "Gestor" : "Professor"} deve ter uma academia associada para criar ${tipo === "professor" ? "professores" : "alunos"}.`,
          });
        }
      }

      // Se veio academiaId diferente no body, bloquear para evitar inconsistências
      if (academiaId && academiaId.toString() !== academiaResolvida.toString()) {
        return res.status(400).json({
          message: `${criador.tipo === "gestor" ? "Gestores" : "Professores"} devem usar sua própria academia ao criar ${tipo === "professor" ? "professores" : "alunos"}.`,
        });
      }
    }

    // ⚠️ Verifica duplicidade (exceto dependentes)
    let perfilExistente = null;
    if (tipo !== "dependente") {
      perfilExistente = await Profile.findOne({
        userId: criador.userId,
        tipo,
      });
    }

    if (perfilExistente) {
      return res.status(409).json({
        message: `Já existe um perfil do tipo "${tipo}" para este usuário.`,
      });
    }

    // 📋 Define nome
    let nomeFinal = nome;
    if ((criador.tipo === "gestor" && tipo === "professor") || (["gestor", "professor"].includes(criador.tipo) && tipo === "aluno")) {
      nomeFinal = criador.nome;
    } else if (!nomeFinal) {
      return res.status(400).json({
        message: "O campo 'nome' é obrigatório para este tipo de criação.",
      });
    }

    let fotoUrlFinal = fotoUrl || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(",") ? base.split(",").pop() : base;
        const buf = globalThis.Buffer.from(payload, "base64");
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${criador.userId?.toString() || "u"}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        fotoUrlFinal = `/profile-photos/${name}`;
      } catch (e) {
        console.warn("Falha ao salvar foto do perfil", e?.message);
      }
    }

    // 📝 Monta o novo perfil
    const dadosPerfil = {
      nome: nomeFinal,
      tipo,
      userId: criador.userId,
      modalidadeId,
      faixaId,
      graus,
      telefone,
      fotoUrl: fotoUrlFinal,
      sexo: req.body?.sexo || null,
      ...(req.body?.peso !== undefined && Number.isFinite(Number(req.body.peso))
        ? { peso: Number(req.body.peso) }
        : {}),
      responsavelId: tipo === "dependente" ? criador._id : null,
    };

    if (nascimento) dadosPerfil.nascimento = new Date(nascimento);
    if (["professor", "aluno"].includes(tipo) && academiaResolvida) {
      dadosPerfil.academiaId = academiaResolvida;
    } else if (academiaId) {
      dadosPerfil.academiaId = academiaId;
    }

    // Faixa preta: exigir data de referência e calcular graus conforme IBJJF
    if (faixaId) {
      try {
        const faixa = await Nivel.findById(faixaId).select("nome graus");
        if (faixa && (faixa.nome || "").toLowerCase() === "preta") {
          const refStr = req.body?.pretaDataReferencia;
          if (!refStr) {
            return res.status(400).json({ message: "Para faixa preta, informe 'pretaDataReferencia' (data da preta ou último grau)." });
          }
          const refDate = new Date(refStr);
          if (isNaN(refDate.getTime())) {
            return res.status(400).json({ message: "'pretaDataReferencia' inválida. Use formato YYYY-MM-DD." });
          }
          const grausDuracoesDias = (faixa.graus || [])
            .sort((a, b) => Number(a.numero) - Number(b.numero))
            .map(g => Number(g.tempoPadraoDias || 0));
          let g = Number.isFinite(Number(dadosPerfil.graus)) ? Number(dadosPerfil.graus) : 0;
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
          dadosPerfil.graus = g;
          dadosPerfil.pretaDataReferencia = ref;
        }
      } catch (e) {
        console.warn("Falha ao processar faixa preta durante criação:", e.message);
      }
    }

    // 👶 Herança automática de contato do responsável ao criar dependentes
    if (tipo === "dependente") {
      const contatoBody = contatoResponsavel || {};
      const hasBodyContato = !!contatoBody.nome && !!contatoBody.telefone;

      if (hasBodyContato) {
        dadosPerfil.contatoResponsavel = {
          nome: contatoBody.nome.trim(),
          telefone: contatoBody.telefone.trim(),
          email: contatoBody.email?.trim().toLowerCase() || null,
          parentesco: contatoBody.parentesco || "outro",
        };
      } else {
        // Regras de herança: criador deve ser gestor/professor/aluno e estar com treino ativo
        const podeHerdar = ["gestor", "professor", "aluno"].includes(criador.tipo) && criador.statusTreino === "ativo";

        if (podeHerdar) {
          // Busca email a partir do usuário base
          const baseUser = await User.findById(criador.userId).select("email");

          // Se o criador não possuir telefone, não herda e exige envio explícito
          if (!criador.telefone) {
            return res.status(400).json({
              message: "Para dependentes, nome e telefone do responsável são obrigatórios.",
            });
          }

          dadosPerfil.contatoResponsavel = {
            nome: criador.nome,
            telefone: (criador.telefone || "").trim(),
            email: baseUser?.email || null,
            parentesco: "outro",
          };
        } else {
          // Criador não treina ou não é um perfil elegível; requer dados explícitos
          return res.status(400).json({
            message: "Para dependentes, nome e telefone do responsável são obrigatórios.",
          });
        }
      }
    }

    // Determina categoria IBJJF (Adult Gi) se houver sexo e peso válidos
    if (dadosPerfil.sexo && typeof dadosPerfil.peso === "number") {
      const categoriaPeso = getIbjjfAdultGiCategory(dadosPerfil.sexo, dadosPerfil.peso);
      if (categoriaPeso) dadosPerfil.categoriaPeso = categoriaPeso;
    }

    const novoPerfil = await Profile.create(dadosPerfil);
    try {
      await User.findByIdAndUpdate(novoPerfil.userId, { $addToSet: { perfis: novoPerfil._id } });
    } catch (e) {
      console.warn("Falha ao vincular perfil ao usuário:", e.message);
    }
    try {
      const sync = {};
      if (novoPerfil.nome) sync.nome = novoPerfil.nome;
      if (telefone !== undefined) sync.telefone = (telefone || "").trim() || null;
      if (nascimento !== undefined) sync.nascimento = novoPerfil.nascimento || null;
      if (novoPerfil.sexo !== undefined) sync.sexo = novoPerfil.sexo || null;
      if (novoPerfil.peso !== undefined) sync.peso = novoPerfil.peso === null ? null : Number(novoPerfil.peso);
      if (novoPerfil.categoriaPeso !== undefined) sync.categoriaPeso = novoPerfil.categoriaPeso || null;
      if (novoPerfil.faixaId !== undefined) sync.faixaId = novoPerfil.faixaId || null;
      if (novoPerfil.graus !== undefined) {
        const g = Number(novoPerfil.graus);
        sync.graus = Number.isFinite(g) && g >= 0 ? g : 0;
      }
      if (novoPerfil.pretaDataReferencia !== undefined) sync.pretaDataReferencia = novoPerfil.pretaDataReferencia || null;
      if (novoPerfil.fotoUrl !== undefined) sync.fotoUrl = novoPerfil.fotoUrl || null;
      if (Object.keys(sync).length > 0) {
        await Profile.updateMany({ userId: novoPerfil.userId, _id: { $ne: novoPerfil._id }, tipo: { $ne: "dependente" } }, { $set: sync });
      }
    } catch (e) {
      void e;
    }
    if (tipo === "professor" && telefone && (!criador.telefone || String(criador.telefone).trim() === "")) {
      try {
        await Profile.findByIdAndUpdate(criador._id, { telefone: String(telefone).trim() });
      } catch (e) {
        void e;
      }
    }
    // Enriquecer com tempo restante
    const calcCriado = await calcularTempoRestante(novoPerfil);
    const perfilCriadoObj = novoPerfil.toObject();
    perfilCriadoObj.tempoRestanteProximoGrau = calcCriado.proximoGrau;
    perfilCriadoObj.tempoRestanteProximoNivel = calcCriado.proximoNivel;

    return res.status(201).json({
      message: "Perfil criado com sucesso.",
      perfil: perfilCriadoObj,
    });
  } catch (error) {
    console.error("Erro ao criar perfil:", error);
    return res.status(500).json({
      message: "Erro ao criar perfil.",
      error: error.message,
    });
  }
};

export const criarPerfilProfessorParaGestor = async (req, res) => {
  try {
    if (req.user?.tipo !== 'gestor') {
      return res.status(403).json({ mensagem: 'Apenas gestor pode criar seu perfil de professor.' });
    }

    const existente = await Profile.findOne({ userId: req.user.id, tipo: 'professor' }).select('_id academiaId');
    if (existente) {
      return res.status(200).json({ mensagem: 'Perfil de professor já existe para este gestor.', perfilProfessorId: existente._id, academiaId: existente.academiaId || null });
    }

    let academiaResolvida = req.user?.academiaId || null;
    if (!academiaResolvida) {
      const acad = await Academia.findOne({ gestor: req.user.id }).select('_id');
      academiaResolvida = acad?._id || null;
    }
    if (!academiaResolvida) {
      return res.status(400).json({ mensagem: 'Nenhuma academia vinculada ao gestor. Cadastre a academia antes.' });
    }

    const userDoc = await User.findById(req.user.id).select('nome');
    const novo = await Profile.create({
      userId: req.user.id,
      nome: userDoc?.nome || req.user.nome,
      tipo: 'professor',
      academiaId: academiaResolvida,
    });
    await User.findByIdAndUpdate(req.user.id, { $push: { perfis: novo._id } });

    return res.status(201).json({ mensagem: 'Perfil de professor criado para o gestor.', perfil: novo });
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao criar perfil de professor para gestor.', erro: erro.message });
  }
};

// Listar professores vinculados a uma academia
export const listarProfessoresPorAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params;
    if (!academiaId) return res.status(400).json({ mensagem: 'academiaId obrigatório' });
    const perfis = await Profile.find({ academiaId, tipo: 'professor' })
      .select('_id nome userId modalidadeId faixaId graus')
      .lean();
    return res.json(perfis);
  } catch (e) {
    return res.status(500).json({ mensagem: 'Erro ao listar professores da academia', erro: e.message });
  }
}

/**
 * Listar todos os perfis de um usuário (mesmo login)
 */
export const listarPerfisPorUsuario = async (req, res) => {
  try {
    const userIdParam = req.params.userId;
    const userId = userIdParam && userIdParam !== "me" ? userIdParam : req.user?.id;

    if (!userId) {
      return res.status(400).json({
        mensagem: "userId não fornecido e usuário não identificado pelo token."
      });
    }

  const perfis = await Profile.find({ userId })
      .populate("responsavelId", "nome tipo")
      .populate("faixaId", "nome")
      .populate("academiaId", "nome");

    // Anexa cálculo de tempo restante
    const enriquecidos = await Promise.all(perfis.map(async (p) => {
      const calc = await calcularTempoRestante(p);
      const obj = p.toObject();
      obj.tempoRestanteProximoGrau = calc.proximoGrau;
      obj.tempoRestanteProximoNivel = calc.proximoNivel;
      return obj;
    }));

    return res.status(200).json(enriquecidos);
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro ao listar perfis do usuário.",
      erro: erro.message,
    });
  }
};

/**
 * Listar perfis criados por um perfil específico
 */
export const listarPerfisCriadosPorPerfil = async (req, res) => {
  try {
    const { criadorPerfilId } = req.params;

  const perfis = await Profile.find({ responsavelId: criadorPerfilId })
      .populate("faixaId", "nome")
      .populate("academiaId", "nome");

    const enriquecidos = await Promise.all(perfis.map(async (p) => {
      const calc = await calcularTempoRestante(p);
      const obj = p.toObject();
      obj.tempoRestanteProximoGrau = calc.proximoGrau;
      obj.tempoRestanteProximoNivel = calc.proximoNivel;
      return obj;
    }));

    return res.status(200).json(enriquecidos);
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro ao listar perfis criados por este perfil.",
      erro: erro.message,
    });
  }
};

/**
 * Atualizar perfil
 */
export const atualizarPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    // Validar ID antes de consultar o banco para evitar CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensagem: "ID de perfil inválido." });
    }
    const body = req.body || {};
    const atualizacoes = { ...body };

    if (body.fotoBase64) {
      try {
        const base = String(body.fotoBase64);
        const payload = base.includes(",") ? base.split(",").pop() : base;
        const buf = globalThis.Buffer.from(payload, "base64");
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${id}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        atualizacoes.fotoUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn("Falha ao salvar foto do perfil", e?.message);
      }
    }

    if (body.fotoUrl !== undefined) {
      atualizacoes.fotoUrl = body.fotoUrl || null;
    }

    // Normaliza peso e calcula categoria IBJJF quando peso/sexo forem informados
    let recomputarCategoria = false;
    if (body.peso !== undefined) {
      recomputarCategoria = true;
      if (body.peso === null || body.peso === "") {
        atualizacoes.peso = null;
      } else if (Number.isFinite(Number(body.peso)) && Number(body.peso) >= 0) {
        atualizacoes.peso = Number(body.peso);
      } else {
        // peso inválido: manter como está, não definir
        delete atualizacoes.peso;
      }
    }
    if (body.sexo !== undefined) {
      recomputarCategoria = true;
      atualizacoes.sexo = body.sexo || null;
    }
    if (recomputarCategoria) {
      const perfilPre = await Profile.findById(id).select("peso sexo modalidadeId");
      const sexoFinal = body.sexo !== undefined ? (body.sexo || null) : perfilPre?.sexo;
      const pesoFinal = body.peso !== undefined ? (
        body.peso === null || body.peso === "" ? null : Number(body.peso)
      ) : perfilPre?.peso;
      let modalidadeNome = null;
      try {
        const mid = body.modalidadeId !== undefined ? body.modalidadeId : perfilPre?.modalidadeId;
        if (mid) {
          const mod = await Modalidade.findById(mid).select("nome");
          modalidadeNome = mod?.nome || null;
        }
      } catch (e) { void e; }
      const categoriaPeso = getWeightCategory(modalidadeNome, sexoFinal, pesoFinal);
      atualizacoes.categoriaPeso = categoriaPeso || null;
    }

    // Faixa preta: recalcular graus se aplicável
    let perfilPre;
    try {
      perfilPre = await Profile.findById(id).select("faixaId graus pretaDataReferencia");
      const faixaIdFinal = body.faixaId ? body.faixaId : perfilPre?.faixaId;
      if (faixaIdFinal) {
        const faixa = await Nivel.findById(faixaIdFinal).select("nome graus");
        if (faixa && (faixa.nome || "").toLowerCase() === "preta") {
          const refCandidate = body.pretaDataReferencia || perfilPre?.pretaDataReferencia;
          if (refCandidate) {
            const refDate = new Date(refCandidate);
            if (!isNaN(refDate.getTime())) {
              const grausDuracoesDias = (faixa.graus || [])
                .sort((a, b) => Number(a.numero) - Number(b.numero))
                .map(g => Number(g.tempoPadraoDias || 0));
              let g = body.graus !== undefined ? Number(body.graus) : Number(perfilPre?.graus || 0);
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
              atualizacoes.graus = g;
              atualizacoes.pretaDataReferencia = ref;
            }
          }
        }
      }

      // Se a faixa foi alterada, resetar aulas e setar início da faixa
      if (body.faixaId && perfilPre?.faixaId && String(body.faixaId) !== String(perfilPre.faixaId)) {
        atualizacoes.aulasNoNivelAtual = 0;
        if (atualizacoes.dataInicioFaixa === undefined || atualizacoes.dataInicioFaixa === null) {
          atualizacoes.dataInicioFaixa = new Date();
        }
      }
    } catch (e) {
      console.warn("Falha ao recalcular faixa preta no update:", e.message);
    }

    const perfilAtualizado = await Profile.findByIdAndUpdate(id, atualizacoes, { new: true });

    if (!perfilAtualizado) {
      return res.status(404).json({ mensagem: "Perfil não encontrado." });
    }

    // Registrar eventos no histórico quando houver mudanças relevantes
    try {
      // Graduacao de faixa
      if (body.faixaId && perfilPre?.faixaId && String(body.faixaId) !== String(perfilPre.faixaId)) {
        const eventoGraduacao = {
          tipo: "graduacao",
          data: atualizacoes.dataInicioFaixa || new Date(),
          faixaId: body.faixaId,
          origem: "auto",
        };
        await Profile.findByIdAndUpdate(id, { $push: { historicoProgresso: eventoGraduacao } });
      }
      // Recebimento de grau (apenas quando aumenta)
      if (body.graus !== undefined) {
        const gNovo = Number(body.graus);
        const gAntigo = Number(perfilPre?.graus || 0);
        if (Number.isFinite(gNovo) && gNovo > gAntigo) {
          let dataGrau = body.dataUltimoGrau ? new Date(body.dataUltimoGrau) : new Date();
          if (isNaN(dataGrau.getTime())) dataGrau = new Date();
          const eventoGrau = {
            tipo: "grau",
            data: dataGrau,
            grauNumero: gNovo,
            origem: "auto",
          };
          await Profile.findByIdAndUpdate(id, { $push: { historicoProgresso: eventoGrau } });
        }
      }
    } catch (e) {
      console.warn("Falha ao registrar histórico do perfil:", e.message);
    }

    // Enriquecer com tempo restante
    const calcAtualizado = await calcularTempoRestante(perfilAtualizado);
    const perfilAtualizadoObj = perfilAtualizado.toObject();
    perfilAtualizadoObj.tempoRestanteProximoGrau = calcAtualizado.proximoGrau;
    perfilAtualizadoObj.tempoRestanteProximoNivel = calcAtualizado.proximoNivel;

    res.status(200).json({
      mensagem: "Perfil atualizado com sucesso.",
      perfil: perfilAtualizadoObj,
    });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro ao atualizar perfil.",
      erro: erro.message,
    });
  }
};

/**
 * Inicializar perfil principal do usuário logado (simula criação de professor/aluno)
 * Atualiza dados do perfil existente sem exigir academiaId no body.
 */
export const inicializarPerfilPrincipal = async (req, res) => {
  try {
    let profileId = req.user?.profileId;

    // Fallback: se não houver profileId, tentar resolver professor/aluno do usuário logado
    if (!profileId && req.user?.id) {
      try {
        const perfilPA = await Profile.findOne({
          userId: req.user.id,
          tipo: { $in: ["professor", "aluno"] },
        }).select("_id tipo");
        if (perfilPA) {
          profileId = perfilPA._id.toString();
          console.log("🔧 Fallback inicialização: usando perfil", perfilPA.tipo, profileId);
        }
      } catch (e) {
        console.warn("⚠️ Falha ao resolver perfil professor/aluno para inicialização:", e.message);
      }
    }

    if (!profileId) {
      return res.status(400).json({
        mensagem: "Perfil do usuário não identificado. Crie ou selecione um perfil de professor/aluno.",
      });
    }

    const perfil = await Profile.findById(profileId);
    if (!perfil) {
      return res.status(404).json({ mensagem: "Perfil não encontrado." });
    }

    if (!["professor", "aluno"].includes(perfil.tipo)) {
      // Se o profileId veio de um perfil gestor/dependente, tentar achar professor/aluno do mesmo usuário
      try {
        const perfilPA = await Profile.findOne({
          userId: perfil.userId,
          tipo: { $in: ["professor", "aluno"] },
        }).select("_id tipo");
        if (perfilPA) {
          profileId = perfilPA._id.toString();
          console.log("🔧 Redirecionando inicialização para perfil", perfilPA.tipo, profileId);
        } else {
          return res.status(400).json({
            mensagem: "Apenas perfis de professor ou aluno podem ser inicializados.",
          });
        }
      } catch {
        return res.status(400).json({
          mensagem: "Apenas perfis de professor ou aluno podem ser inicializados.",
        });
      }
    }

    const {
      telefone,
      nascimento,
      modalidadeId,
      faixaId,
      graus,
      grau, // alias suportado
      aulasNoNivelAtual,
      aulasDesdeUltimoGrau, // alias suportado
      statusTreino,
      academiaId,
      jaTreina,
      dataInicioTreino,
      dataInicioFaixa,
      dataUltimoGrau,
      pretaDataReferencia,
      peso,
      sexo,
      fotoUrl,
      fotoBase64,
    } = req.body;

    // Resolver academia automaticamente se não fornecida
    let academiaResolvida = academiaId || perfil.academiaId || req.user?.academiaId || null;
    if (!academiaResolvida && req.user?.tipo === "gestor") {
      // Em caso raro de perfil professor/aluno pertencente ao user gestor
      const academiaDoGestor = await Academia.findOne({ gestor: req.user.id }).select("_id");
      if (academiaDoGestor) academiaResolvida = academiaDoGestor._id;
    }

    // 📅 Lógica para início do treino
    let dataInicioFinal;
    if (jaTreina === true) {
      if (!dataInicioTreino) {
        return res.status(400).json({
          mensagem: "Se 'jaTreina' é verdadeiro, informe 'dataInicioTreino' (YYYY-MM-DD).",
        });
      }
      const d = new Date(dataInicioTreino);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ mensagem: "'dataInicioTreino' inválida. Use formato YYYY-MM-DD." });
      }
      dataInicioFinal = d;
    } else if (jaTreina === false) {
      dataInicioFinal = new Date();
    } else {
      // Não informado: mantém existente
      dataInicioFinal = perfil.dataInicioTreino;
    }

    // 🔢 Normalização de graus e aulas
    const grausBody = graus !== undefined ? graus : grau;
    const aulasDesdeGrauBody = aulasDesdeUltimoGrau !== undefined ? aulasDesdeUltimoGrau : aulasNoNivelAtual;

    // Montar atualizações
    const atualizacoes = {};
    if (telefone !== undefined) atualizacoes.telefone = (telefone || "").trim();
    if (nascimento !== undefined) atualizacoes.nascimento = nascimento ? new Date(nascimento) : null;
    if (modalidadeId !== undefined) atualizacoes.modalidadeId = modalidadeId || null;
    if (faixaId !== undefined) atualizacoes.faixaId = faixaId || null;
    if (fotoBase64) {
      try {
        const base = String(fotoBase64);
        const payload = base.includes(",") ? base.split(",").pop() : base;
        const buf = globalThis.Buffer.from(payload, "base64");
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        const name = `pf_${profileId}_${Date.now()}.jpg`;
        fs.writeFileSync(path.join(profilePhotosDir, name), buf);
        atualizacoes.fotoUrl = `/profile-photos/${name}`;
      } catch (e) {
        console.warn("Falha ao salvar foto do perfil", e?.message);
      }
    }
    if (fotoUrl !== undefined) atualizacoes.fotoUrl = fotoUrl || null;
    if (grausBody !== undefined) {
      const gnum = Number(grausBody);
      if (Number.isFinite(gnum) && gnum >= 0) atualizacoes.graus = gnum;
    }
    if (aulasDesdeGrauBody !== undefined) {
      const anum = Number(aulasDesdeGrauBody);
      if (Number.isFinite(anum) && anum >= 0) atualizacoes.aulasNoNivelAtual = anum;
    }
    if (statusTreino !== undefined) atualizacoes.statusTreino = statusTreino || perfil.statusTreino;
    if (academiaResolvida) atualizacoes.academiaId = academiaResolvida;
    if (dataInicioFinal) {
      atualizacoes.dataInicioTreino = dataInicioFinal;
      // Início da faixa atual: por padrão, igual à data de início do treino quando inicializando
      atualizacoes.dataInicioFaixa = dataInicioFinal;
    }
    // Se o cliente informar dataInicioFaixa explicitamente, validar e usar
    if (dataInicioFaixa !== undefined) {
      const dif = dataInicioFaixa ? new Date(dataInicioFaixa) : null;
      if (dif && isNaN(dif.getTime())) {
        return res.status(400).json({ mensagem: "'dataInicioFaixa' inválida. Use formato YYYY-MM-DD." });
      }
      atualizacoes.dataInicioFaixa = dif;
    }
    if (dataUltimoGrau !== undefined) {
      const dug = dataUltimoGrau ? new Date(dataUltimoGrau) : null;
      if (dug && isNaN(dug.getTime())) {
        return res.status(400).json({ mensagem: "'dataUltimoGrau' inválida. Use formato YYYY-MM-DD." });
      }
      atualizacoes.dataUltimoGrau = dug;
    }
    if (sexo !== undefined) atualizacoes.sexo = sexo || null;
    if (peso !== undefined) {
      if (peso === null || peso === "") {
        atualizacoes.peso = null;
      } else if (Number.isFinite(Number(peso)) && Number(peso) >= 0) {
        atualizacoes.peso = Number(peso);
      }
    }

    // Calcula categoria IBJJF com base em sexo/peso informados ou valores existentes
    const sexoFinal = sexo !== undefined ? (sexo || null) : perfil.sexo;
    const pesoFinal = peso !== undefined ? (
      peso === null || peso === "" ? null : Number(peso)
    ) : perfil.peso;
    let modalidadeNome = null;
    try {
      const mid = (modalidadeId !== undefined ? modalidadeId : perfil.modalidadeId) || atualizacoes.modalidadeId;
      if (mid) {
        const mod = await Modalidade.findById(mid).select("nome");
        modalidadeNome = mod?.nome || null;
      }
    } catch (e) { void e; }
    const categoriaPeso = getWeightCategory(modalidadeNome, sexoFinal, pesoFinal);
    atualizacoes.categoriaPeso = categoriaPeso || null;

    // 🥋 Fluxo quando vai começar a treinar: selecionar primeiro nível da modalidade e zerar contagens
    if (jaTreina === false) {
      const modalidadeFinal = atualizacoes.modalidadeId || perfil.modalidadeId;
      if (!modalidadeFinal) {
        return res.status(400).json({ mensagem: "Informe 'modalidadeId' para iniciar o treino." });
      }
      const primeiroNivel = await Nivel.findOne({ modalidadeId: modalidadeFinal }).sort({ ordem: 1 }).select("_id nome ordem");
      if (!primeiroNivel) {
        return res.status(400).json({ mensagem: "Não há níveis cadastrados para a modalidade informada." });
      }
      atualizacoes.faixaId = primeiroNivel._id;
      atualizacoes.graus = 0;
      atualizacoes.aulasNoNivelAtual = 0;
      atualizacoes.pretaDataReferencia = null;
      atualizacoes.statusTreino = "ativo";
      // Início da faixa: agora
      atualizacoes.dataInicioFaixa = new Date();
    }

    // Se a faixa foi alterada explicitamente na inicialização, resetar aulas e setar início da faixa
    if (faixaId !== undefined && String(faixaId || '') !== String(perfil.faixaId || '')) {
      atualizacoes.aulasNoNivelAtual = 0;
      if (!atualizacoes.dataInicioFaixa) atualizacoes.dataInicioFaixa = new Date();
    }

    // 🥋 Faixa preta: recalcular graus se aplicável durante inicialização
    try {
      const faixaIdFinal = (faixaId !== undefined ? faixaId : atualizacoes.faixaId) || perfil.faixaId;
      if (faixaIdFinal) {
        const faixa = await Nivel.findById(faixaIdFinal).select("nome graus");
        if (faixa && (faixa.nome || "").toLowerCase() === "preta") {
          const refStr = pretaDataReferencia !== undefined ? pretaDataReferencia : perfil.pretaDataReferencia;
          if (!refStr) {
            return res.status(400).json({ mensagem: "Para faixa preta, informe 'pretaDataReferencia' (data da preta ou último grau)." });
          }
          const refDate = new Date(refStr);
          if (isNaN(refDate.getTime())) {
            return res.status(400).json({ mensagem: "'pretaDataReferencia' inválida. Use formato YYYY-MM-DD." });
          }
          const grausDuracoesDias = (faixa.graus || [])
            .sort((a, b) => Number(a.numero) - Number(b.numero))
            .map(g => Number(g.tempoPadraoDias || 0));
          let g = atualizacoes.graus !== undefined ? Number(atualizacoes.graus) : Number(perfil.graus || 0);
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
          atualizacoes.graus = g;
          atualizacoes.pretaDataReferencia = ref;
        }
      }
    } catch (e) {
      console.warn("Falha ao recalcular faixa preta na inicialização:", e.message);
    }

    const perfilAtualizado = await Profile.findByIdAndUpdate(profileId, atualizacoes, { new: true });
    try {
      const sync = {};
      if (perfilAtualizado.nome) sync.nome = perfilAtualizado.nome;
      if (perfilAtualizado.telefone !== undefined) sync.telefone = (perfilAtualizado.telefone || "").trim() || null;
      if (perfilAtualizado.nascimento !== undefined) sync.nascimento = perfilAtualizado.nascimento || null;
      if (perfilAtualizado.sexo !== undefined) sync.sexo = perfilAtualizado.sexo || null;
      if (perfilAtualizado.peso !== undefined) sync.peso = perfilAtualizado.peso === null ? null : Number(perfilAtualizado.peso);
      if (perfilAtualizado.categoriaPeso !== undefined) sync.categoriaPeso = perfilAtualizado.categoriaPeso || null;
      if (perfilAtualizado.faixaId !== undefined) sync.faixaId = perfilAtualizado.faixaId || null;
      if (perfilAtualizado.graus !== undefined) {
        const g = Number(perfilAtualizado.graus);
        sync.graus = Number.isFinite(g) && g >= 0 ? g : 0;
      }
      if (perfilAtualizado.pretaDataReferencia !== undefined) sync.pretaDataReferencia = perfilAtualizado.pretaDataReferencia || null;
      if (perfilAtualizado.fotoUrl !== undefined) sync.fotoUrl = perfilAtualizado.fotoUrl || null;
      if (Object.keys(sync).length > 0) {
        await Profile.updateMany({ userId: perfilAtualizado.userId, _id: { $ne: perfilAtualizado._id }, tipo: { $ne: "dependente" } }, { $set: sync });
      }
    } catch (e) {
      void e;
    }

    // Registrar histórico básico conforme fluxos
    try {
      // Início do treino
      if (dataInicioFinal) {
        await Profile.findByIdAndUpdate(profileId, {
          $push: { historicoProgresso: { tipo: "inicio_treino", data: dataInicioFinal, origem: jaTreina === true ? "manual" : "auto" } }
        });
      }
      // Início de faixa (atribuição ou primeira faixa ao começar)
      const faixaDef = (faixaId !== undefined ? faixaId : atualizacoes.faixaId) || perfil.faixaId;
      const dataFaixa = atualizacoes.dataInicioFaixa || null;
      if (faixaDef && dataFaixa) {
        await Profile.findByIdAndUpdate(profileId, {
          $push: { historicoProgresso: { tipo: "inicio_faixa", data: dataFaixa, faixaId: faixaDef, origem: jaTreina === true ? "manual" : "auto" } }
        });
      }
      // Grau informado na inicialização (se aplicável)
      const gInformado = grausBody !== undefined ? Number(grausBody) : null;
      if (gInformado && Number.isFinite(gInformado) && gInformado > 0) {
        let dataGrauIni = dataUltimoGrau ? new Date(dataUltimoGrau) : null;
        if (dataGrauIni && isNaN(dataGrauIni.getTime())) dataGrauIni = null;
        await Profile.findByIdAndUpdate(profileId, {
          $push: { historicoProgresso: { tipo: "grau", data: dataGrauIni || new Date(), grauNumero: gInformado, origem: "manual" } }
        });
      }
    } catch (e) {
      console.warn("Falha ao registrar histórico básico na inicialização:", e.message);
    }

    return res.status(200).json({
      mensagem: "Perfil principal inicializado/atualizado com sucesso.",
      perfil: perfilAtualizado,
    });
  } catch (erro) {
    console.error("Erro ao inicializar perfil principal:", erro);
    return res.status(500).json({ mensagem: "Erro ao inicializar perfil principal.", erro: erro.message });
  }
};

export const azureSincronizarAlunos = async (req, res) => {
  try {
    try {
      let academia = null;
      if (req.user?.academiaId) academia = await Academia.findById(req.user.academiaId).select('planoTier');
      if (!academia && req.user?.tipo === 'gestor') academia = await Academia.findOne({ gestor: req.user.id }).select('planoTier');
      if (academia && String(academia.planoTier) === 'free') return res.status(403).json({ mensagem: 'Plano Free não permite reconhecimento facial.' });
    } catch (e) { /* ignore */ }
    const endpoint = process.env.AZURE_FACE_ENDPOINT;
    const key = process.env.AZURE_FACE_KEY || process.env.AZURE_FACE_KEY_2;
    const personGroupId = process.env.AZURE_FACE_PERSON_GROUP_ID;
    if (!endpoint || !key || !personGroupId || typeof globalThis.fetch !== "function") {
      return res.status(400).json({
        mensagem: "Configure AZURE_FACE_ENDPOINT, AZURE_FACE_KEY (ou AZURE_FACE_KEY_2) e AZURE_FACE_PERSON_GROUP_ID.",
      });
    }

    const isGestor = req.user?.tipo === "gestor";
    const isProfessor = req.user?.tipo === "professor";
    if (!isGestor && !isProfessor) {
      return res.status(403).json({ mensagem: "Sem permissão para sincronizar alunos na Azure." });
    }

    const alunos = await Profile.find({ tipo: "aluno", fotoUrl: { $ne: null } }).select("_id nome fotoUrl azurePersonId userId");
    const criados = [];
    const facesAdicionadas = [];
    const erros = [];

    for (const aluno of alunos) {
      let personId = aluno.azurePersonId;
      if (!personId) {
        try {
          const resp = await globalThis.fetch(`${endpoint}/face/v1.0/persongroups/${personGroupId}/persons`, {
            method: "POST",
            headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" },
            body: JSON.stringify({ name: aluno.nome || String(aluno._id), userData: String(aluno._id) }),
          });
          const data = await resp.json();
          if (data?.personId) {
            personId = data.personId;
            await Profile.updateOne({ _id: aluno._id }, { $set: { azurePersonId: personId } });
            criados.push({ perfilId: String(aluno._id), personId });
          } else {
            erros.push({ perfilId: String(aluno._id), etapa: "createPerson", erro: data });
            continue;
          }
        } catch (e) {
          erros.push({ perfilId: String(aluno._id), etapa: "createPerson", erro: e?.message });
          continue;
        }
      }

      try {
        let persistedFaceId = null;
        if (/^https?:\/\//i.test(aluno.fotoUrl)) {
          const addResp = await globalThis.fetch(`${endpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personId}/persistedFaces`, {
            method: "POST",
            headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" },
            body: JSON.stringify({ url: aluno.fotoUrl }),
          });
          const addData = await addResp.json();
          persistedFaceId = addData?.persistedFaceId || null;
        } else {
          try {
            const rel = String(aluno.fotoUrl || "").replace(/^\/+/, "");
            const filePath = path.join(publicDir, rel);
            const buf = fs.readFileSync(filePath);
            const addResp = await globalThis.fetch(`${endpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personId}/persistedFaces`, {
              method: "POST",
              headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/octet-stream" },
              body: buf,
            });
            const addData = await addResp.json();
            persistedFaceId = addData?.persistedFaceId || null;
          } catch (e) {
            erros.push({ perfilId: String(aluno._id), etapa: "readLocalFoto", erro: e?.message });
          }
        }

        if (persistedFaceId) {
          await Profile.updateOne({ _id: aluno._id }, { $addToSet: { azurePersistedFaces: persistedFaceId } });
          facesAdicionadas.push({ perfilId: String(aluno._id), personId, persistedFaceId });
        } else {
          erros.push({ perfilId: String(aluno._id), etapa: "addFace", erro: "persistedFaceId ausente" });
        }
      } catch (e) {
        erros.push({ perfilId: String(aluno._id), etapa: "addFace", erro: e?.message });
      }
    }

    let treinado = false;
    try {
      const resp = await globalThis.fetch(`${endpoint}/face/v1.0/persongroups/${personGroupId}/train`, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key },
      });
      treinado = resp.status === 202 || resp.status === 200;
    } catch (e) {
      erros.push({ etapa: "train", erro: e?.message });
    }

    return res.status(200).json({
      mensagem: "Sincronização concluída",
      alunosProcessados: alunos.length,
      pessoasCriadas: criados.length,
      facesAdicionadas: facesAdicionadas.length,
      treinado,
      detalhesCriados: criados,
      detalhesFaces: facesAdicionadas,
      erros,
    });
  } catch (erro) {
    console.error("Erro em azureSincronizarAlunos:", erro);
    return res.status(500).json({ mensagem: "Erro ao sincronizar alunos na Azure.", erro: erro.message });
  }
};

export const azureTreinarPersonGroup = async (req, res) => {
  try {
    try {
      let academia = null;
      if (req.user?.academiaId) academia = await Academia.findById(req.user.academiaId).select('planoTier');
      if (!academia && req.user?.tipo === 'gestor') academia = await Academia.findOne({ gestor: req.user.id }).select('planoTier');
      if (academia && String(academia.planoTier) === 'free') return res.status(403).json({ mensagem: 'Plano Free não permite reconhecimento facial.' });
    } catch (e) { /* ignore */ }
    const endpoint = process.env.AZURE_FACE_ENDPOINT;
    const key = process.env.AZURE_FACE_KEY || process.env.AZURE_FACE_KEY_2;
    const personGroupId = process.env.AZURE_FACE_PERSON_GROUP_ID;
    if (!endpoint || !key || !personGroupId || typeof globalThis.fetch !== "function") {
      return res.status(400).json({ mensagem: "Configure AZURE_FACE_ENDPOINT, AZURE_FACE_KEY (ou AZURE_FACE_KEY_2) e AZURE_FACE_PERSON_GROUP_ID." });
    }
    const isGestor = req.user?.tipo === "gestor";
    const isProfessor = req.user?.tipo === "professor";
    if (!isGestor && !isProfessor) {
      return res.status(403).json({ mensagem: "Sem permissão para treinar Person Group." });
    }
    const resp = await globalThis.fetch(`${endpoint}/face/v1.0/persongroups/${personGroupId}/train`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    return res.status(200).json({ mensagem: "Treino iniciado", statusCode: resp.status });
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao iniciar treino.", erro: erro.message });
  }
};

export const azureStatusTreinamento = async (req, res) => {
  try {
    try {
      let academia = null;
      if (req.user?.academiaId) academia = await Academia.findById(req.user.academiaId).select('planoTier');
      if (!academia && req.user?.tipo === 'gestor') academia = await Academia.findOne({ gestor: req.user.id }).select('planoTier');
      if (academia && String(academia.planoTier) === 'free') return res.status(403).json({ mensagem: 'Plano Free não permite reconhecimento facial.' });
    } catch (e) { /* ignore */ }
    const endpoint = process.env.AZURE_FACE_ENDPOINT;
    const key = process.env.AZURE_FACE_KEY || process.env.AZURE_FACE_KEY_2;
    const personGroupId = process.env.AZURE_FACE_PERSON_GROUP_ID;
    if (!endpoint || !key || !personGroupId || typeof globalThis.fetch !== "function") {
      return res.status(400).json({ mensagem: "Configure AZURE_FACE_ENDPOINT, AZURE_FACE_KEY (ou AZURE_FACE_KEY_2) e AZURE_FACE_PERSON_GROUP_ID." });
    }
    const isGestor = req.user?.tipo === "gestor";
    const isProfessor = req.user?.tipo === "professor";
    if (!isGestor && !isProfessor) {
      return res.status(403).json({ mensagem: "Sem permissão para consultar status de treino." });
    }
    const resp = await globalThis.fetch(`${endpoint}/face/v1.0/persongroups/${personGroupId}/training`, {
      method: "GET",
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    const data = await resp.json();
    return res.status(200).json({ status: data?.status, details: data });
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao consultar status de treino.", erro: erro.message });
  }
};

/**
 * Deletar perfil
 */
export const deletarPerfil = async (req, res) => {
  try {
    const { id } = req.params;

    const perfil = await Profile.findByIdAndDelete(id);
    if (!perfil) {
      return res.status(404).json({ mensagem: "Perfil não encontrado." });
    }

    res.status(200).json({ mensagem: "Perfil deletado com sucesso." });
  } catch (erro) {
    res.status(500).json({
      mensagem: "Erro ao deletar perfil.",
      erro: erro.message,
    });
  }
};

/**
 * Listar histórico de progressão de um perfil
 */
export const listarHistoricoPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensagem: "ID de perfil inválido." });
    }
    const perfil = await Profile.findById(id)
      .select("historicoProgresso nome faixaId modalidadeId")
      .populate("historicoProgresso.faixaId", "nome ordem")
      .populate("faixaId", "nome ordem");
    if (!perfil) {
      return res.status(404).json({ mensagem: "Perfil não encontrado." });
    }
    const historicoOrdenado = (perfil.historicoProgresso || []).sort((a, b) => new Date(a.data) - new Date(b.data));
    return res.status(200).json({ perfilId: perfil._id, historico: historicoOrdenado });
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao listar histórico do perfil.", erro: erro.message });
  }
};

/**
 * Adicionar eventos ao histórico de um perfil (manual ou bulk)
 */
export const adicionarHistoricoPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensagem: "ID de perfil inválido." });
    }
    const perfil = await Profile.findById(id).select("_id");
    if (!perfil) {
      return res.status(404).json({ mensagem: "Perfil não encontrado." });
    }

    const body = req.body || {};
    const entrada = Array.isArray(body) ? body : (body.eventos || [body]);
    if (!Array.isArray(entrada) || entrada.length === 0) {
      return res.status(400).json({ mensagem: "Envie um evento ou uma lista de eventos em 'eventos'." });
    }

    const eventosNormalizados = [];
    for (const ev of entrada) {
      const tipo = ev?.tipo;
      const data = ev?.data ? new Date(ev.data) : null;
      const origem = ev?.origem || "manual";
      const observacao = ev?.observacao || null;
      const grauNumero = ev?.grauNumero !== undefined ? Number(ev.grauNumero) : null;
      const faixaId = ev?.faixaId || null;

      if (!tipo || !["inicio_treino", "inicio_faixa", "grau", "graduacao"].includes(tipo)) {
        return res.status(400).json({ mensagem: "Tipo de evento inválido. Use: inicio_treino, inicio_faixa, grau, graduacao." });
      }
      if (!data || isNaN(data.getTime())) {
        return res.status(400).json({ mensagem: "'data' inválida no evento. Use formato YYYY-MM-DD." });
      }
      if (tipo === "grau") {
        if (!Number.isFinite(grauNumero) || grauNumero <= 0) {
          return res.status(400).json({ mensagem: "Para evento 'grau', informe 'grauNumero' > 0." });
        }
      }
      if (tipo === "inicio_faixa" || tipo === "graduacao") {
        if (!faixaId || !mongoose.Types.ObjectId.isValid(faixaId)) {
          return res.status(400).json({ mensagem: "Para eventos de faixa, informe 'faixaId' válido." });
        }
      }

      eventosNormalizados.push({ tipo, data, origem, observacao, grauNumero: tipo === "grau" ? grauNumero : null, faixaId: faixaId || null });
    }

    await Profile.findByIdAndUpdate(id, { $push: { historicoProgresso: { $each: eventosNormalizados } } });

    const atualizado = await Profile.findById(id).select("historicoProgresso").populate("historicoProgresso.faixaId", "nome ordem");
    const historicoOrdenado = (atualizado.historicoProgresso || []).sort((a, b) => new Date(a.data) - new Date(b.data));
    return res.status(200).json({ mensagem: "Eventos adicionados com sucesso.", historico: historicoOrdenado });
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao adicionar eventos ao histórico.", erro: erro.message });
  }
};

export const isentarVitalicioPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ mensagem: "ID de perfil inválido." });
    }
    const perfil = await Profile.findById(id).select("userId tipo academiaId isentoVitalicio");
    if (!perfil) {
      return res.status(404).json({ mensagem: "Perfil não encontrado." });
    }
    if (req.user?.tipo !== "gestor") {
      return res.status(403).json({ mensagem: "Apenas gestores podem isentar vitalício." });
    }
    const academiaDoGestor = await Academia.findOne({ gestor: req.user.id }).select("_id");
    if (!academiaDoGestor || String(academiaDoGestor._id) !== String(perfil.academiaId)) {
      return res.status(403).json({ mensagem: "Gestor não vinculado à academia do perfil." });
    }
    await Profile.updateOne({ _id: id }, { $set: { isentoVitalicio: true, cobrancaPausada: true, motivoCobrancaPausada: "isencao_vitalicia", cobrancaPausadaEm: new Date() } });
    try {
      const userDoc = await User.findById(perfil.userId).select("mpPreapprovalId");
      const preId = userDoc?.mpPreapprovalId || null;
      const academia = await Academia.findById(perfil.academiaId).select("mercadoPagoAccessToken");
      const token = academia?.mercadoPagoAccessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
      if (preId && token) {
        try {
          await globalThis.fetch(`https://api.mercadopago.com/preapproval/${preId}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "paused" }) });
        } catch (e) { void e; }
      }
    } catch (e) { void e; }
    return res.status(200).json({ mensagem: "Aluno isento vitalício." });
  } catch (erro) {
    return res.status(500).json({ mensagem: "Erro ao isentar vitalício.", erro: erro.message });
  }
};
