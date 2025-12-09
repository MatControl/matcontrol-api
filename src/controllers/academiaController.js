import Academia from '../models/Academia.js'
import { gerarCodigo } from '../utils/gerarCodigo.js';
import { resolveIanaTimezoneFromAcademia } from '../utils/timezone.js';



// Cadastrar Academia
export const registrarAcademia = async (req, res) => {

  try {
    const { nome, endereco, telefone, email, modalidadesAtivas, timezone, planoTier, referralCode: referralInput } = req.body;
    const referralQuery = String(req.query?.referral || '').trim();
    const codigoAcademia = gerarCodigo();

    // Verifica se usuário é autenticado
    if (!req.user || !req.user.id) {
        return res.status(401).json({ mensagem: 'Gestor não autenticado ou token inválido.' });
    }

    // Verifica se já existe academia com o mesmo código ou e-mail
    const academiaExistente = await Academia.findOne({
      $or: [{ email }, { codigoAcademia }]
    });

    if (academiaExistente) {
      return res.status(400).json({ mensagem: 'Academia com e-mail ou código já existe.' });
    }

    // Normaliza endereço global mantendo compatibilidade Brasil
    const normalized = normalizeEndereco(endereco);
    const resolvedTz = timezone || resolveIanaTimezoneFromAcademia({ timezone: null, endereco: normalized });

    // Cria a Academia
    // Gerar referral próprio único
    let myReferral = gerarCodigo(8);
    for (let i = 0; i < 5; i++) {
      const exists = await Academia.findOne({ referralCode: myReferral }).select('_id');
      if (!exists) break;
      myReferral = gerarCodigo(8);
    }

    const novaAcademia = new Academia({
      nome,
      endereco: normalized,
      telefone,
      email,
      codigoAcademia,
      modalidadesAtivas,
      gestor: req.user.id,
      timezone: resolvedTz,
      planoTier: planoTier && ['free','basico','intermediario','avancado','teste'].includes(String(planoTier)) ? planoTier : 'basico',
      alunosMax: (planoTier === 'free' ? 15 : (planoTier === 'intermediario' ? 100 : (planoTier === 'avancado' ? 999999 : (planoTier === 'teste' ? 999999 : 30)))),
      referralCode: myReferral
    });

    await novaAcademia.save();

    // Aplicar referência se houver
    const refRaw = String(referralInput || referralQuery || '').trim();
    if (refRaw) {
      const referrer = await Academia.findOne({ referralCode: refRaw }).select('_id referralDiscountPercent referredCount');
      if (referrer) {
        const inc = 10;
        const next = Math.min(90, Number(referrer.referralDiscountPercent || 0) + inc);
        referrer.referralDiscountPercent = next;
        referrer.referredCount = Number(referrer.referredCount || 0) + 1;
        await referrer.save();
        novaAcademia.referredByAcademiaId = referrer._id;
        await novaAcademia.save();
      }
    }

    res.status(201).json({ message: 'Academia cadastrada com sucesso', academia: novaAcademia });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao cadastrar Academia', error });
  }
};



// 🔍 Buscar academia por código
export const pesquisaAcademia = async (req, res) => {
  try {
    const { codigo } = req.params;

    const academia = await Academia.findOne({ codigoAcademia: codigo });

    if (!academia) {
      return res.status(404).json({ mensagem: 'Academia não encontrada.' });
    }

    res.json(academia);
  } catch (erro) {
    console.error('Erro ao buscar academia:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao buscar academia.', erro: erro.message });
  }
};


// 📍 Listar todas academias (opcional, para testes)
export const listarAcademias = async (req, res) => {
  try {
    const academias = await Academia.find();
    res.json(academias);
  } catch (erro) {
    console.error('Erro ao listar academias:', erro.message);
    res.status(500).json({ mensagem: 'Erro ao listar academias.', erro: erro.message });
  }
};

export const atualizarPlanoAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params;
    const { planoTier } = req.body || {};
    if (!['free','basico','intermediario','avancado','teste'].includes(String(planoTier))) {
      return res.status(400).json({ mensagem: 'planoTier inválido. Use: basico, intermediario, avancado.' });
    }
    const academia = await Academia.findById(academiaId).select('gestor alunosMax planoTier');
    if (!academia) return res.status(404).json({ mensagem: 'Academia não encontrada.' });
    if (String(academia.gestor) !== String(req.user?.id)) {
      return res.status(403).json({ mensagem: 'Somente o gestor da academia pode atualizar o plano.' });
    }
    const max = (planoTier === 'free' ? 15 : (planoTier === 'intermediario' ? 100 : (planoTier === 'avancado' ? 999999 : (planoTier === 'teste' ? 999999 : 30))));
    academia.planoTier = planoTier;
    academia.alunosMax = max;
    await academia.save();
    return res.status(200).json({ mensagem: 'Plano da academia atualizado.', planoTier, alunosMax: max });
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao atualizar plano da academia.', erro: erro.message });
  }
};

export const obterMinhaAcademia = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ mensagem: 'Gestor não autenticado.' });
    }

    let academia = null;
    if (req.user.academiaId) {
      academia = await Academia.findById(req.user.academiaId);
    }
    if (!academia) {
      academia = await Academia.findOne({ gestor: req.user.id });
    }

    if (!academia) {
      return res.status(404).json({ mensagem: 'Nenhuma academia vinculada ao gestor.' });
    }

    return res.status(200).json(academia);
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao obter academia do gestor.', erro: erro.message });
  }
};

export const obterStatusCapacidadeGestor = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ mensagem: 'Gestor não autenticado.' });
    let academia = null;
    if (req.user.academiaId) academia = await Academia.findById(req.user.academiaId).select('_id alunosMax nome');
    if (!academia) academia = await Academia.findOne({ gestor: req.user.id }).select('_id alunosMax nome');
    if (!academia) return res.status(404).json({ mensagem: 'Academia não encontrada.' });
    const totalAlunos = await (await import('../models/User.js')).default.countDocuments({ tipo: 'aluno', academiaId: academia._id });
    const max = Number(academia.alunosMax || 0) || 30;
    const bloqueado = totalAlunos >= max;
    return res.status(200).json({ academiaId: academia._id, nome: academia.nome, totalAlunos, alunosMax: max, bloqueado });
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao obter status de capacidade.', erro: erro.message });
  }
}
// Link de indicação do gestor
export const obterReferralLinkGestor = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ mensagem: 'Gestor não autenticado.' });
    const academia = await Academia.findOne({ gestor: req.user.id }).select('_id referralCode nome');
    if (!academia || !academia.referralCode) return res.status(404).json({ mensagem: 'Academia não encontrada ou sem referralCode.' });
    const origin = (process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/$/,'');
    const link = `${origin}/test/gestor/cadastro?referral=${academia.referralCode}`;
    return res.status(200).json({ codigo: academia.referralCode, link, academiaId: academia._id, nome: academia.nome });
  } catch (erro) {
    return res.status(500).json({ mensagem: 'Erro ao obter referral do gestor.', erro: erro.message });
  }
}

// Helpers
function normalizeEndereco(endereco = {}) {
  const e = endereco || {};
  // Global
  const addressLine1 = e.addressLine1 || [e.rua, e.numero].filter(Boolean).join(', ').trim();
  const addressLine2 = e.addressLine2 ?? (e.bairro ?? null);
  const city = e.city || e.cidade || '';
  const region = e.region || e.estado || null; // UF, província ou região
  const postalCode = e.postalCode || e.cep || null;
  const country = (e.country || 'BR').toUpperCase();

  // Legados (preencher se vierem apenas globais)
  const rua = e.rua ?? null;
  const numero = e.numero ?? null;
  const cidade = e.cidade ?? (city || null);
  const estado = e.estado ?? (region || null);
  const cep = e.cep ?? (postalCode || null);
  const bairro = e.bairro ?? (addressLine2 || null);

  return {
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    rua,
    numero,
    cidade,
    estado,
    cep,
    bairro,
  };
}
