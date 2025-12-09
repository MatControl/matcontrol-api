import Turma from '../models/Turma.js'
import Academia from '../models/Academia.js'
import Aula from '../models/Aula.js'
import Profile from '../models/Profile.js'
import { resolveIanaTimezoneFromAcademia } from '../utils/timezone.js'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { URL } from 'url'


// Criar turma (somente gestor)
export const criarTurma = async (req, res) => {
try {
    const { nome, modalidade, professor, diasDaSemana, horario, academiaId } = req.body

    let academiaIdResolvido = academiaId || req.user?.academiaId || null
    if (!academiaIdResolvido && req.user?.tipo === 'gestor') {
      try {
        const acad = await Academia.findOne({ gestor: req.user.id }).select('_id')
        academiaIdResolvido = acad?._id || null
      } catch (e) { void e }
    }
    if (!academiaIdResolvido) {
      try {
        const perfilComAcad = await Profile.findOne({ userId: req.user.id, academiaId: { $exists: true, $ne: null } }).select('academiaId')
        academiaIdResolvido = perfilComAcad?.academiaId || null
      } catch (e) { void e }
    }
    if (!academiaIdResolvido) {
      return res.status(400).json({ message: 'Academia não informada e não resolvida pelo token do usuário.' })
    }
    const academia = await Academia.findById(academiaIdResolvido)
    if (!academia) {
      return res.status(404).json({ message: 'Academia não encontrada' })
    }

    let professorId = professor
    try {
      const profProfile = await Profile.findById(professorId).select('userId tipo')
      if (profProfile && profProfile.tipo === 'professor' && profProfile.userId) {
        professorId = profProfile.userId
      }
    } catch (e) {
      void e
    }

    const turma = new Turma({
      nome,
      modalidade,
      professor: professorId,
      diasDaSemana,
      horario,
      academia: academia._id,
    })

    await turma.save()

    // 🔄 Ao criar a turma, gerar aulas da PRÓXIMA semana imediatamente
    try {
      const timezone = resolveIanaTimezoneFromAcademia(academia);

      // Encontrar domingo 00:00 da semana atual na timezone
      function getWeekStartUtc(timezone) {
        let d = new Date();
        for (let i = 0; i < 7; i++) {
          const label = formatInTimeZone(d, timezone, 'EEE');
          if (label === 'Sun') break;
          d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
        }
        const dayStr = formatInTimeZone(d, timezone, 'yyyy-MM-dd');
        return fromZonedTime(`${dayStr}T00:00:00`, timezone);
      }

      // Próxima semana começa 7 dias após o domingo corrente
      const semanaAtualInicioUtc = getWeekStartUtc(timezone);
      const proximaSemanaInicioUtc = new Date(semanaAtualInicioUtc.getTime() + 7 * 24 * 60 * 60 * 1000);

      const daysMap = { domingo: 0, segunda: 1, terca: 2, terça: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, sábado: 6 };
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
      const dias = (turma.diasDaSemana || []).map(d => (d || '').toLowerCase());

      function dataHoraFromWeekDayAndHorario(weekStartUtc, dayIndex, horario, timezone) {
        const targetUtc = new Date(weekStartUtc.getTime() + dayIndex * 24 * 60 * 60 * 1000);
        const dayStr = formatInTimeZone(targetUtc, timezone, 'yyyy-MM-dd');
        const [hh, mm] = String(horario).split(':');
        return fromZonedTime(`${dayStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`, timezone);
      }

      const aulasCriadas = [];
      for (const diaLabel of dias) {
        const diaNum = getDayIndex(diaLabel);
        if (diaNum === undefined) continue;
        const dataHora = dataHoraFromWeekDayAndHorario(proximaSemanaInicioUtc, diaNum, turma.horario, timezone);
        try {
          const aula = await Aula.findOneAndUpdate(
            { turmaId: turma._id, dataHora },
            { turmaId: turma._id, dataHora, nome: `Aula - ${turma.nome}`, status: 'agendada' },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          aulasCriadas.push(aula);
        } catch (e) {
          if (e.code !== 11000) throw e;
        }
      }

      // IDs das aulas criadas para retorno
      var aulasProximaSemanaCriadas = aulasCriadas.map(a => a?._id).filter(Boolean);
    } catch (e) {
      // Se falhar geração inicial, não bloquear criação da turma
      console.warn('⚠️ Falha ao gerar aulas iniciais da próxima semana:', e.message);
    }

    res.status(201).json({
      message: 'Turma criada com sucesso!',
      turma,
      aulasProximaSemanaCriadas,
      linkConvite: `${process.env.FRONTEND_URL}/entrar-turma/${turma.codigoConvite}`
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar turma', error })
  }
}

// Aluno entra na turma via link de convite (também aceita código diretamente)
export const codigoConvite = async (req, res) => {
try {
    let { codigoConvite, linkConvite, alunoId } = req.body

    // Se veio link, extrair o código do link
    if (!codigoConvite && linkConvite) {
      try {
        // Tentar interpretar como URL e pegar o último segmento do path
        // Ex.: https://frontend/entrar-turma/ABC123 -> ABC123
        const u = new URL(linkConvite);
        const path = (u.pathname || '').split('/').filter(Boolean);
        if (path.length > 0) {
          codigoConvite = path[path.length - 1];
        }
        // Fallback: tentar query string ?codigo=ABC123
        const codigoQs = u.searchParams.get('codigo');
        if (!codigoConvite && codigoQs) codigoConvite = codigoQs;
      } catch {
        // Não é uma URL válida; se for uma string com barras, pegar último token
        const parts = String(linkConvite).split('/').filter(Boolean);
        if (parts.length > 0) {
          codigoConvite = parts[parts.length - 1];
        }
      }
    }

    // Usar aluno logado quando não fornecido explicitamente
    if (!alunoId && req.user?.id) alunoId = req.user.id;

    // Normalizar: aceitar URL completa no campo codigoConvite também
    function extractCodigo(str) {
      const s = String(str || '').trim();
      if (!s) return '';
      try {
        const u = new URL(s);
        const qs = u.searchParams.get('codigo');
        if (qs) return qs.trim();
        const parts = (u.pathname || '').split('/').filter(Boolean);
        if (parts.length) return parts[parts.length - 1].trim();
      } catch {}
      const m = s.match(/codigo=([^&\s]+)/i);
      if (m && m[1]) return String(m[1]).trim();
      const toks = s.split('/').filter(Boolean);
      if (toks.length) return toks[toks.length - 1].trim();
      return s;
    }

    let codigo = String(codigoConvite || '').trim();
    if (!codigo && linkConvite) codigo = extractCodigo(linkConvite);
    if (codigo && /https?:/i.test(codigo)) codigo = extractCodigo(codigo);

    const turma = await Turma.findOne({ codigoConvite: codigo })
    if (!turma) {
      return res.status(404).json({ message: 'Turma não encontrada ou código inválido' })
    }

    // Verifica se já está na turma
    if (turma.alunos.includes(alunoId)) {
      return res.status(400).json({ message: 'Aluno já está nesta turma' })
    }

    if (alunoId) turma.alunos.push(alunoId)
    await turma.save()

    res.status(200).json({ message: 'Aluno adicionado à turma com sucesso!', turma })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao entrar na turma', error })
  }
}

// Listar turmas da academia (gestor)
export const listarTurmasPorAcademia = async (req, res) => {
  try {
    let { academiaId } = req.params || {};
    academiaId = academiaId || req.user?.academiaId || null;
    if (!academiaId && req.user?.tipo === 'gestor') {
      const acad = await Academia.findOne({ gestor: req.user.id }).select('_id');
      academiaId = acad?._id || null;
    }
    if (!academiaId) return res.status(400).json([]);
    const turmas = await Turma.find({ academia: academiaId }).select('_id nome diasDaSemana horario codigoConvite modalidade professor');
    return res.json(turmas);
  } catch (e) {
    return res.status(500).json({ mensagem: 'Erro ao listar turmas da academia', erro: e.message });
  }
}

// Listar turmas do professor
export const listarMinhasTurmasProfessor = async (req, res) => {
  try {
    if (req.user?.tipo !== 'professor') {
      return res.status(403).json([]);
    }
    const turmas = await Turma.find({ professor: req.user.id }).select('_id nome diasDaSemana horario codigoConvite modalidade academia');
    return res.json(turmas);
  } catch (e) {
    return res.status(500).json({ mensagem: 'Erro ao listar turmas do professor', erro: e.message });
  }
}