import Turma from '../models/Turma.js';
import Aula from '../models/Aula.js';
import Academia from '../models/Academia.js';
import Profile from '../models/Profile.js';
import Pagamento from '../models/Pagamento.js';
import { resolveIanaTimezoneFromAcademia, resolveTimezoneOrDefault } from '../utils/timezone.js';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const daysMap = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function getDayIndex(label) {
  const s = String(label || '').toLowerCase().trim();
  const variants = new Set([
    s,
    s.replace('-feira', ''),
    s.replace(' feira', ''),
    s.replace(/[^a-zçáàãâéêíóôõúü]/g, ''),
  ]);
  for (const v of variants) {
    if (v in daysMap) return daysMap[v];
  }
  const en = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const maybe = s.replace(/[^a-z]/g, '');
  if (maybe in en) return en[maybe];
  return undefined;
}

async function resolveTimezoneForTurma(turma, req) {
  const override = req.query?.timezone;
  if (override) return override;
  try {
    const academia = await Academia.findById(turma.academia).select('timezone endereco.estado endereco.region endereco.country');
    if (academia) return resolveIanaTimezoneFromAcademia(academia);
  } catch {
    // fallback abaixo
  }
  return resolveTimezoneOrDefault();
}

async function resolveTimezoneForAcademiaId(academiaId, req) {
  const override = req.query?.timezone;
  if (override) return override;
  try {
    const academia = await Academia.findById(academiaId).select('timezone endereco.estado endereco.region endereco.country');
    if (academia) return resolveIanaTimezoneFromAcademia(academia);
  } catch {
    // fallback abaixo
  }
  return resolveTimezoneOrDefault();
}

function getWeekStartUtc(timezone, referenceDateUTC = new Date()) {
  // Encontra o domingo 00:00 na timezone e converte para UTC
  let d = new Date(referenceDateUTC);
  // Retrocede até encontrar domingo na timezone
  for (let i = 0; i < 7; i++) {
    const label = formatInTimeZone(d, timezone, 'EEE');
    if (label === 'Sun') break;
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  }
  const dayStr = formatInTimeZone(d, timezone, 'yyyy-MM-dd');
  const sundayMidnightUtc = fromZonedTime(`${dayStr}T00:00:00`, timezone);
  return sundayMidnightUtc;
}

function dataHoraFromWeekDayAndHorario(weekStartUtc, dayIndex, horario, timezone) {
  const targetUtc = new Date(weekStartUtc.getTime() + dayIndex * 24 * 60 * 60 * 1000);
  const dayStr = formatInTimeZone(targetUtc, timezone, 'yyyy-MM-dd');
  const [hh, mm] = String(horario).split(':');
  return fromZonedTime(`${dayStr}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`, timezone);
}

async function gerarAulasParaTurmasNaSemana(turmas, req) {
  const criadas = [];
  for (const turma of turmas) {
    const timezone = await resolveTimezoneForTurma(turma, req);
    const semanaInicio = getWeekStartUtc(timezone);
    const dias = (turma.diasDaSemana || []).map(d => (d || '').toLowerCase());
    for (const diaLabel of dias) {
      const diaNum = getDayIndex(diaLabel);
      if (diaNum === undefined) continue;
      const dataHora = dataHoraFromWeekDayAndHorario(semanaInicio, diaNum, turma.horario, timezone);
      try {
        const aula = await Aula.findOneAndUpdate(
          { turmaId: turma._id, dataHora },
          { turmaId: turma._id, dataHora, nome: `Aula - ${turma.nome}`, status: 'agendada' },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        criadas.push(aula);
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }
  }
  return criadas;
}

// POST /api/aulas/turmas/:turmaId/gerar-semana
export const gerarAulasSemanaPorTurma = async (req, res) => {
  try {
    const { turmaId } = req.params;
    const turma = await Turma.findById(turmaId);
    if (!turma) {
      return res.status(404).json({ mensagem: 'Turma não encontrada.' });
    }

    // Permissões: gestor ou professor da turma
    const isProfessorDaTurma = req.user?.tipo === 'professor' && String(turma.professor) === String(req.user.id);
    let professorAtivo = true;
    if (isProfessorDaTurma) {
      try {
        const profPerf = await Profile.findOne({ userId: req.user.id, tipo: 'professor' }).select('statusTreino');
        professorAtivo = (profPerf?.statusTreino || 'ativo') === 'ativo';
      } catch (e) { void e; }
    }
    const isGestor = req.user?.tipo === 'gestor';
    if (!isGestor && (!isProfessorDaTurma || !professorAtivo)) {
      return res.status(403).json({ mensagem: 'Sem permissão para gerar aulas desta turma.' });
    }

    const timezone = await resolveTimezoneForTurma(turma, req);
    const semanaInicio = getWeekStartUtc(timezone);

    // Cria aulas para todos os dias configurados na turma dentro da semana
    const dias = (turma.diasDaSemana || []).map(d => (d || '').toLowerCase());
    const criadas = [];
    for (const diaLabel of dias) {
      const diaNum = getDayIndex(diaLabel);
      if (diaNum === undefined) continue;
      const dataHora = dataHoraFromWeekDayAndHorario(semanaInicio, diaNum, turma.horario, timezone);

      try {
        const aula = await Aula.findOneAndUpdate(
          { turmaId, dataHora },
          {
            turmaId,
            dataHora,
            nome: `Aula - ${turma.nome}`,
            status: 'agendada',
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        criadas.push(aula);
      } catch (e) {
        // Se erro de duplicidade, apenas ignora
        if (e.code !== 11000) throw e;
      }
    }

    return res.status(200).json({ mensagem: 'Aulas da semana geradas/atualizadas.', aulas: criadas });
  } catch (erro) {
    console.error('Erro ao gerar aulas da semana:', erro);
    return res.status(500).json({ mensagem: 'Erro ao gerar aulas da semana.', erro: erro.message });
  }
};

// GET /api/aulas/turmas/:turmaId/semana
export const listarAulasSemanaPorTurma = async (req, res) => {
  try {
    const { turmaId } = req.params;
    const turma = await Turma.findById(turmaId).select('alunos professor nome');
    if (!turma) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

    // Permissão: professor da turma, gestor, ou aluno da turma
    const isProfessorDaTurma = req.user?.tipo === 'professor' && String(turma.professor) === String(req.user.id);
    const isGestor = req.user?.tipo === 'gestor';
    const isAlunoDaTurma = req.user?.tipo === 'aluno' && turma.alunos.some(a => String(a) === String(req.user.id));
    if (!isProfessorDaTurma && !isGestor && !isAlunoDaTurma) {
      return res.status(403).json({ mensagem: 'Sem permissão para visualizar aulas desta turma.' });
    }

    const timezone = await resolveTimezoneForTurma(turma, req);
    const semanaInicio = getWeekStartUtc(timezone);
    const semanaFim = new Date(semanaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);

    const aulas = await Aula.find({ turmaId, dataHora: { $gte: semanaInicio, $lt: semanaFim } })
      .sort({ dataHora: 1 });

    return res.json(aulas);
  } catch (erro) {
    console.error('Erro ao listar aulas da semana:', erro);
    return res.status(500).json({ mensagem: 'Erro ao listar aulas da semana.', erro: erro.message });
  }
};

// PATCH /api/aulas/:aulaId
export const atualizarAula = async (req, res) => {
  try {
    const { aulaId } = req.params;
    const aula = await Aula.findById(aulaId);
    if (!aula) return res.status(404).json({ mensagem: 'Aula não encontrada.' });
    const turma = await Turma.findById(aula.turmaId).select('professor');
    if (!turma) return res.status(404).json({ mensagem: 'Turma da aula não encontrada.' });

    const isProfessorDaTurma = req.user?.tipo === 'professor' && String(turma.professor) === String(req.user.id);
    let professorAtivo = true;
    if (isProfessorDaTurma) {
      try {
        const profPerf = await Profile.findOne({ userId: req.user.id, tipo: 'professor' }).select('statusTreino');
        professorAtivo = (profPerf?.statusTreino || 'ativo') === 'ativo';
      } catch (e) { void e; }
    }
    const isGestor = req.user?.tipo === 'gestor';
    if (!isGestor && (!isProfessorDaTurma || !professorAtivo)) {
      return res.status(403).json({ mensagem: 'Sem permissão para editar/cancelar aula.' });
    }

    const { nome, posicao, status, observacoes } = req.body || {};
    const update = {};
    if (nome !== undefined) update.nome = (nome || '').trim();
    if (posicao !== undefined) update.posicao = (posicao || '').trim();
    if (observacoes !== undefined) update.observacoes = (observacoes || '').trim();
    if (status !== undefined) {
      update.status = status === 'cancelada' ? 'cancelada' : 'agendada';
    }

    const aulaAtualizada = await Aula.findByIdAndUpdate(aulaId, update, { new: true });
    return res.json({ mensagem: 'Aula atualizada.', aula: aulaAtualizada });
  } catch (erro) {
    console.error('Erro ao atualizar aula:', erro);
    return res.status(500).json({ mensagem: 'Erro ao atualizar aula.', erro: erro.message });
  }
};

// GET /api/aulas/minhas/semana
export const listarMinhasAulasSemana = async (req, res) => {
  try {
    console.log('🟦 [aulas/minhas/semana] user', { tipo: req.user?.tipo, id: String(req.user?.id || ''), academiaId: String(req.user?.academiaId || ''), profileId: String(req.user?.profileId || '') });
    let timezone = resolveTimezoneOrDefault(req.query?.timezone);
    console.log('🟦 [aulas/minhas/semana] timezone inicial', timezone);
    let semanaInicio = getWeekStartUtc(timezone);
    let semanaFim = new Date(semanaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);
    console.log('🟦 [aulas/minhas/semana] semana inicial', { inicioUTC: semanaInicio.toISOString(), fimUTC: semanaFim.toISOString(), timezone });

    // Turmas do usuário (professor ou aluno)
    let turmasIds = [];
    if (req.user?.tipo === 'professor') {
      const professorIds = [req.user.id].concat(req.user?.profileId ? [req.user.profileId] : []);
      const turmas = await Turma.find({ professor: { $in: professorIds } }).select('_id');
      turmasIds = turmas.map(t => t._id);
      console.log('🟦 [aulas/minhas/semana] turmas do professor', { count: turmasIds.length, ids: turmasIds.map(String), usandoIds: professorIds.map(String) });
    } else if (req.user?.tipo === 'aluno') {
      const turmas = await Turma.find({ alunos: req.user.id }).select('_id');
      turmasIds = turmas.map(t => t._id);
      console.log('🟦 [aulas/minhas/semana] turmas do aluno', { count: turmasIds.length, ids: turmasIds.map(String) });
    } else if (req.user?.tipo === 'gestor') {
      let professorProfile = null;
      try {
        professorProfile = await Profile.findOne({ userId: req.user.id, tipo: 'professor' }).select('academiaId userId');
      } catch (e) {
        console.warn('Falha ao verificar perfil professor:', e?.message);
      }
      console.log('🟦 [aulas/minhas/semana] perfil professor encontrado?', Boolean(professorProfile));
      if (professorProfile) {
        const academiaIdProf = professorProfile.academiaId || req.user?.academiaId || null;
        console.log('🟦 [aulas/minhas/semana] academia do perfil professor', String(academiaIdProf || ''));
        const tzProfessorAcademia = academiaIdProf ? await resolveTimezoneForAcademiaId(academiaIdProf, req) : timezone;
        timezone = tzProfessorAcademia;
        semanaInicio = getWeekStartUtc(timezone);
        semanaFim = new Date(semanaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);
        console.log('🟦 [aulas/minhas/semana] semana ajustada pelo perfil professor', { inicioUTC: semanaInicio.toISOString(), fimUTC: semanaFim.toISOString(), timezone });
        const professorIds = [req.user.id].concat([String(professorProfile._id)]).concat(professorProfile.userId ? [String(professorProfile.userId)] : []);
        const turmas = academiaIdProf
          ? await Turma.find({ professor: { $in: professorIds }, academia: academiaIdProf }).select('_id')
          : await Turma.find({ professor: { $in: professorIds } }).select('_id');
        turmasIds = turmas.map(t => t._id);
        console.log('🟦 [aulas/minhas/semana] turmas do professor (por academia)', { count: turmasIds.length, ids: turmasIds.map(String), usandoIds: professorIds });
      } else {
        const academiaId = req.query?.academiaId || req.user?.academiaId;
        if (!academiaId) {
          console.log('🟦 [aulas/minhas/semana] sem academia vinculada ao gestor');
          return res.json([]);
        }
        const tzAcademia = await resolveTimezoneForAcademiaId(academiaId, req);
        timezone = tzAcademia;
        semanaInicio = getWeekStartUtc(timezone);
        semanaFim = new Date(semanaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);
        console.log('🟦 [aulas/minhas/semana] semana ajustada pela academia do gestor', { inicioUTC: semanaInicio.toISOString(), fimUTC: semanaFim.toISOString(), timezone });
        const turmas = await Turma.find({ academia: academiaId }).select('_id');
        turmasIds = turmas.map(t => t._id);
        console.log('🟦 [aulas/minhas/semana] turmas da academia do gestor', { count: turmasIds.length, ids: turmasIds.map(String) });
      }
    }

    if (turmasIds.length === 0) {
      console.log('🟦 [aulas/minhas/semana] nenhuma turma encontrada para o usuário');
      return res.json([]);
    }

    const aulas = await Aula.find({ turmaId: { $in: turmasIds }, dataHora: { $gte: semanaInicio, $lt: semanaFim } })
      .sort({ dataHora: 1 });
    console.log('🟦 [aulas/minhas/semana] aulas encontradas', { count: aulas?.length || 0 });

    const existentesPorTurma = new Set((aulas || []).map(a => String(a.turmaId)));
    const faltantesTurmaIds = turmasIds.filter(id => !existentesPorTurma.has(String(id)));
    if (faltantesTurmaIds.length > 0) {
      const turmasDocsFaltantes = await Turma.find({ _id: { $in: faltantesTurmaIds } }).select('_id nome diasDaSemana horario academia');
      const reqTimezone = { query: { timezone } };
      console.log('🟦 [aulas/minhas/semana] gerando aulas faltantes on-demand', { turmas: turmasDocsFaltantes.length, timezone });
      await gerarAulasParaTurmasNaSemana(turmasDocsFaltantes, reqTimezone);
    }

    const aulasFinal = await Aula.find({ turmaId: { $in: turmasIds }, dataHora: { $gte: semanaInicio, $lt: semanaFim } })
      .sort({ dataHora: 1 });
    console.log('🟦 [aulas/minhas/semana] aulas após complementar geração', { count: aulasFinal.length });

    const now = new Date();
    const enriched = [];
    for (const a of aulasFinal) {
      if (a.status !== 'cancelada') {
        const passed = now.getTime() >= new Date(a.dataHora).getTime();
        let desired = a.status;
        if (passed) {
          desired = a.chamadaFeita ? 'finalizada' : 'aguardando chamada';
        } else {
          desired = 'agendada';
        }
        if (desired !== a.status) {
          await Aula.updateOne({ _id: a._id }, { $set: { status: desired } });
          a.status = desired;
        }
      }
      let tempoRestante = null;
      const diff = new Date(a.dataHora).getTime() - now.getTime();
      if (diff > 0) {
        const total = Math.floor(diff / 60000);
        const d = Math.floor(total / 1440);
        const h = Math.floor((total % 1440) / 60);
        const m = total % 60;
        const parts = [];
        if (d) parts.push(`${d}d`);
        if (h) parts.push(`${h}h`);
        parts.push(`${m}m`);
        tempoRestante = parts.join(' ');
      }
      enriched.push({ ...a.toObject(), tempoRestante });
    }
    return res.json(enriched);
  } catch (erro) {
    console.error('Erro ao listar minhas aulas da semana:', erro);
    return res.status(500).json({ mensagem: 'Erro ao listar minhas aulas da semana.', erro: erro.message });
  }
};

// POST /api/aulas/academias/:academiaId/gerar-semana
export const gerarAulasSemanaPorAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params;
    if (req.user?.tipo !== 'gestor') {
      return res.status(403).json({ mensagem: 'Apenas gestores podem gerar aulas por academia.' });
    }

    const turmas = await Turma.find({ academia: academiaId });
    const criadas = [];
    const timezone = await resolveTimezoneForAcademiaId(academiaId, req);
    const semanaInicio = getWeekStartUtc(timezone);

    for (const turma of turmas) {
      const dias = (turma.diasDaSemana || []).map(d => (d || '').toLowerCase());
      for (const diaLabel of dias) {
        const diaNum = getDayIndex(diaLabel);
        if (diaNum === undefined) continue;
        const dataHora = dataHoraFromWeekDayAndHorario(semanaInicio, diaNum, turma.horario, timezone);
        try {
          const aula = await Aula.findOneAndUpdate(
            { turmaId: turma._id, dataHora },
            { turmaId: turma._id, dataHora, nome: `Aula - ${turma.nome}`, status: 'agendada' },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          criadas.push(aula);
        } catch (e) {
          if (e.code !== 11000) throw e;
        }
      }
    }

    return res.status(200).json({ mensagem: 'Aulas da semana geradas para academia.', aulas: criadas });
  } catch (erro) {
    console.error('Erro ao gerar aulas da semana por academia:', erro);
    return res.status(500).json({ mensagem: 'Erro ao gerar aulas por academia.', erro: erro.message });
  }
};

export const listarAulasSemanaPorAcademia = async (req, res) => {
  try {
    const { academiaId } = req.params;
    if (req.user?.tipo !== 'gestor') {
      return res.status(403).json({ mensagem: 'Apenas gestores podem listar aulas por academia.' });
    }
    const academia = await Academia.findOne({ _id: academiaId, gestor: req.user.id }).select('_id');
    if (!academia) {
      return res.status(403).json({ mensagem: 'Sem permissão para visualizar aulas desta academia.' });
    }
    const tzAcademia = await resolveTimezoneForAcademiaId(academiaId, req);
    const semanaInicio = getWeekStartUtc(tzAcademia);
    const semanaFim = new Date(semanaInicio.getTime() + 7 * 24 * 60 * 60 * 1000);
    const turmas = await Turma.find({ academia: academiaId }).select('_id');
    const turmasIds = turmas.map(t => t._id);
    if (turmasIds.length === 0) return res.json([]);
    const aulas = await Aula.find({ turmaId: { $in: turmasIds }, dataHora: { $gte: semanaInicio, $lt: semanaFim } }).sort({ dataHora: 1 });
    return res.json(aulas);
  } catch (erro) {
    console.error('Erro ao listar aulas da semana por academia:', erro);
    return res.status(500).json({ mensagem: 'Erro ao listar aulas por academia.', erro: erro.message });
  }
};

// POST /api/aulas/:aulaId/confirmar
export const confirmarPresenca = async (req, res) => {
  try {
    const { aulaId } = req.params;
    const aula = await Aula.findById(aulaId);
    if (!aula) return res.status(404).json({ mensagem: 'Aula não encontrada.' });

    const turma = await Turma.findById(aula.turmaId).select('alunos');
    if (!turma) return res.status(404).json({ mensagem: 'Turma da aula não encontrada.' });

    if (req.user?.tipo !== 'aluno') {
      return res.status(403).json({ mensagem: 'Apenas alunos podem confirmar presença.' });
    }
    const isAlunoDaTurma = turma.alunos.some(a => String(a) === String(req.user.id));
    if (!isAlunoDaTurma) {
      return res.status(403).json({ mensagem: 'Você não pertence a esta turma.' });
    }

  await Aula.findByIdAndUpdate(aulaId, { $addToSet: { confirmados: req.user.id } });
    const atualizado = await Aula.findById(aulaId).select('confirmados dataHora');
    try {
      const perfilAluno = await Profile.findOne({ userId: req.user.id, tipo: 'aluno' }).select('_id academiaId statusTreino ultimaPresencaEm');
      if (perfilAluno) {
        const novaUltima = (!perfilAluno.ultimaPresencaEm || new Date(atualizado.dataHora).getTime() > new Date(perfilAluno.ultimaPresencaEm).getTime()) ? atualizado.dataHora : perfilAluno.ultimaPresencaEm;
        await Profile.updateOne({ _id: perfilAluno._id }, { $set: { ultimaPresencaEm: novaUltima } });
        if (perfilAluno.statusTreino === 'inativo') {
          const pendencias = await Pagamento.find({ alunoId: req.user.id, academiaId: perfilAluno.academiaId, status: { $in: ['pendente', 'falhou'] } }).limit(1).select('_id');
          if (!pendencias || pendencias.length === 0) {
            await Profile.updateOne({ _id: perfilAluno._id }, { $set: { statusTreino: 'ativo', cobrancaPausada: false, motivoCobrancaPausada: null, cobrancaPausadaEm: null } });
          }
        }
      }
    } catch (e) { void e; }
    return res.json({ mensagem: 'Presença confirmada.', confirmados: atualizado.confirmados });
  } catch (erro) {
    console.error('Erro ao confirmar presença:', erro);
    return res.status(500).json({ mensagem: 'Erro ao confirmar presença.', erro: erro.message });
  }
};

// DELETE /api/aulas/:aulaId/confirmar
export const removerConfirmacao = async (req, res) => {
  try {
    const { aulaId } = req.params;
    const aula = await Aula.findById(aulaId);
    if (!aula) return res.status(404).json({ mensagem: 'Aula não encontrada.' });

    const turma = await Turma.findById(aula.turmaId).select('alunos');
    if (!turma) return res.status(404).json({ mensagem: 'Turma da aula não encontrada.' });

    if (req.user?.tipo !== 'aluno') {
      return res.status(403).json({ mensagem: 'Apenas alunos podem retirar confirmação.' });
    }
    const isAlunoDaTurma = turma.alunos.some(a => String(a) === String(req.user.id));
    if (!isAlunoDaTurma) {
      return res.status(403).json({ mensagem: 'Você não pertence a esta turma.' });
    }

    await Aula.findByIdAndUpdate(aulaId, { $pull: { confirmados: req.user.id } });
    const atualizado = await Aula.findById(aulaId).select('confirmados');
    return res.json({ mensagem: 'Confirmação removida.', confirmados: atualizado.confirmados });
  } catch (erro) {
    console.error('Erro ao remover confirmação:', erro);
    return res.status(500).json({ mensagem: 'Erro ao remover confirmação.', erro: erro.message });
  }
};

export const chamadaAutomaticaPorFoto = async (req, res) => {
  try {
    const { aulaId } = req.params;
    const aula = await Aula.findById(aulaId);
    if (!aula) return res.status(404).json({ mensagem: 'Aula não encontrada.' });
    const turma = await Turma.findById(aula.turmaId).select('alunos professor nome');
    if (!turma) return res.status(404).json({ mensagem: 'Turma da aula não encontrada.' });

    const isProfessorDaTurma = req.user?.tipo === 'professor' && String(turma.professor) === String(req.user.id);
    let professorAtivo = true;
    if (isProfessorDaTurma) {
      try {
        const profPerf = await Profile.findOne({ userId: req.user.id, tipo: 'professor' }).select('statusTreino');
        professorAtivo = (profPerf?.statusTreino || 'ativo') === 'ativo';
      } catch (e) { void e; }
    }
    const isGestor = req.user?.tipo === 'gestor';
    if (!isGestor && (!isProfessorDaTurma || !professorAtivo)) {
      return res.status(403).json({ mensagem: 'Sem permissão para fazer chamada automática desta turma.' });
    }

    const { imageUrl, imageBase64, recognizedUserIds, azureMappings, threshold } = req.body || {};
    const turmaAlunoIds = (turma.alunos || []).map(a => String(a));
    let reconhecidosIds = [];

    if (Array.isArray(recognizedUserIds) && recognizedUserIds.length > 0) {
      reconhecidosIds = recognizedUserIds.map(String).filter(id => turmaAlunoIds.includes(id));
    } else if (Array.isArray(azureMappings) && azureMappings.length > 0) {
      const userIds = azureMappings.map(m => String(m.userId)).filter(id => turmaAlunoIds.includes(id));
      reconhecidosIds = userIds;
    } else {
      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ mensagem: 'Envie imageUrl ou imageBase64.' });
      }
      const endpoint = process.env.AZURE_FACE_ENDPOINT;
      const key = process.env.AZURE_FACE_KEY || process.env.AZURE_FACE_KEY_2;
      const personGroupId = process.env.AZURE_FACE_PERSON_GROUP_ID;
      if (!endpoint || !key || !personGroupId || typeof globalThis.fetch !== 'function') {
        return res.status(202).json({ mensagem: 'Função preparada. Configure Azure Face e envie recognizedUserIds ou azureMappings.', pendenteIntegracao: true, requisitos: ['AZURE_FACE_ENDPOINT','AZURE_FACE_KEY (ou AZURE_FACE_KEY_2)','AZURE_FACE_PERSON_GROUP_ID'] });
      }
      let faceIds = [];
      try {
        if (imageUrl) {
          const resp = await globalThis.fetch(`${endpoint}/face/v1.0/detect?returnFaceId=true`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: imageUrl }) });
          const det = await resp.json();
          faceIds = Array.isArray(det) ? det.map(f => f.faceId).filter(Boolean) : [];
        } else if (imageBase64) {
          const base = String(imageBase64);
          const payload = base.includes(',') ? base.split(',').pop() : base;
          const buf = globalThis.Buffer.from(payload, 'base64');
          const resp = await globalThis.fetch(`${endpoint}/face/v1.0/detect?returnFaceId=true`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/octet-stream' }, body: buf });
          const det = await resp.json();
          faceIds = Array.isArray(det) ? det.map(f => f.faceId).filter(Boolean) : [];
        }
      } catch (e) { console.warn('Falha no reconhecimento facial: detect', e?.message); }
      let idResults = [];
      try {
        if (faceIds.length > 0) {
          const resp = await globalThis.fetch(`${endpoint}/face/v1.0/identify`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ personGroupId, faceIds, confidenceThreshold: typeof threshold === 'number' ? threshold : 0.5 }) });
          const idRes = await resp.json();
          idResults = Array.isArray(idRes) ? idRes : [];
        }
      } catch (e) { console.warn('Falha no reconhecimento facial: identify', e?.message); }

      const perfisAlunos = await Profile.find({ tipo: 'aluno', userId: { $in: turma.alunos } }).select('userId nome azurePersonId').lean();
      const mapByPerson = new Map(perfisAlunos.map(p => [String(p.azurePersonId || ''), p]).filter(([k]) => !!k));
      const thr = typeof threshold === 'number' ? threshold : 0.5;
      const pendentes = [];
      for (const r of idResults) {
        const opts = (r.candidates || []).map(c => {
          const prof = mapByPerson.get(String(c.personId));
          if (!prof) return null;
          const uid = String(prof.userId);
          if (!turmaAlunoIds.includes(uid)) return null;
          return { userId: uid, nome: prof.nome, confidence: c.confidence, personId: c.personId };
        }).filter(Boolean).sort((a, b) => b.confidence - a.confidence);
        const top = opts[0] || null;
        if (top && top.confidence >= thr) {
          reconhecidosIds.push(top.userId);
        } else if (opts.length > 0) {
          pendentes.push({ faceId: r.faceId, opcoes: opts });
        }
      }

      if (reconhecidosIds.length > 0) {
        const setDone = pendentes.length === 0;
        await Aula.updateOne({ _id: aulaId }, { $set: setDone ? { chamadaFeita: true } : {}, $addToSet: { confirmados: { $each: reconhecidosIds } } });
      }
      const atualizado = await Aula.findById(aulaId).select('confirmados chamadaFeita');
      const msg = pendentes.length > 0 ? 'Reconhecimento parcial. Confirme os alunos sugeridos.' : (reconhecidosIds.length > 0 ? 'Chamada automática registrada.' : 'Nenhum aluno reconhecido.');
      return res.status(200).json({ mensagem: msg, confirmados: atualizado.confirmados, chamadaFeita: atualizado.chamadaFeita, pendenteConfirmacao: pendentes.length > 0, pendentes, reconhecidosCount: reconhecidosIds.length, thresholdUsado: thr });
    }

    if (reconhecidosIds.length === 0) {
      const atual = await Aula.findById(aulaId).select('confirmados chamadaFeita');
      return res.status(200).json({ mensagem: 'Nenhum aluno reconhecido.', confirmados: atual?.confirmados || [], chamadaFeita: atual?.chamadaFeita || false });
    }

    await Aula.updateOne({ _id: aulaId }, { $set: { chamadaFeita: true }, $addToSet: { confirmados: { $each: reconhecidosIds } } });
    const atualizado = await Aula.findById(aulaId).select('confirmados chamadaFeita');
    return res.status(200).json({ mensagem: 'Chamada automática registrada.', confirmados: atualizado.confirmados, chamadaFeita: atualizado.chamadaFeita, reconhecidosCount: reconhecidosIds.length });
  } catch (erro) {
    console.error('Erro na chamada automática:', erro);
    return res.status(500).json({ mensagem: 'Erro ao processar chamada automática.', erro: erro.message });
  }
};
