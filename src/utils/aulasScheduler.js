import cron from 'node-cron';
import Turma from '../models/Turma.js';
import Aula from '../models/Aula.js';
import Academia from '../models/Academia.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import { resolveIanaTimezoneFromAcademia } from './timezone.js';
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

const APP_TZ = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

function getWeekStartUtc(timezone, referenceDateUTC = new Date()) {
  let d = new Date(referenceDateUTC);
  for (let i = 0; i < 7; i++) {
    const label = formatInTimeZone(d, timezone, 'EEE');
    if (label === 'Sun') break;
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  }
  const dayStr = formatInTimeZone(d, timezone, 'yyyy-MM-dd');
  return fromZonedTime(`${dayStr}T00:00:00`, timezone);
}

function dataHoraFromWeekDayAndHorario(weekStartUtc, dayIndex, horario, timezone) {
  const targetUtc = new Date(weekStartUtc.getTime() + dayIndex * 24 * 60 * 60 * 1000);
  const dayStr = formatInTimeZone(targetUtc, timezone, 'yyyy-MM-dd');
  const [hh, mm] = String(horario).split(':');
  return fromZonedTime(`${dayStr}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`, timezone);
}

async function gerarSemanaParaTodasTurmas() {
  const turmas = await Turma.find({}).select('_id nome diasDaSemana horario academia');
  // Pré-carregar academias para reduzir I/O
  const academiaIds = [...new Set(turmas.map(t => String(t.academia)))];
  const academias = await Academia.find({ _id: { $in: academiaIds } }).select('_id timezone endereco.estado endereco.region endereco.country');
  const academiaMap = new Map(academias.map(a => [String(a._id), a]));

  for (const turma of turmas) {
    const academia = academiaMap.get(String(turma.academia));
    const ianaTz = resolveIanaTimezoneFromAcademia(academia);
    const semanaInicio = getWeekStartUtc(ianaTz);
    const dias = (turma.diasDaSemana || []).map(d => (d || '').toLowerCase());
    for (const diaLabel of dias) {
      const diaNum = getDayIndex(diaLabel);
      if (diaNum === undefined) continue;
      const dataHora = dataHoraFromWeekDayAndHorario(semanaInicio, diaNum, turma.horario, ianaTz);
      try {
        await Aula.findOneAndUpdate(
          { turmaId: turma._id, dataHora },
          { turmaId: turma._id, dataHora, nome: `Aula - ${turma.nome}`, status: 'agendada' },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }
  }
}

export function startAulasWeeklyScheduler() {
  // Rodar todo domingo às 00:05 (minuto 5, hora 0, dia da semana 0)
  cron.schedule('5 0 * * 0', async () => {
    try {
      console.log('🗓️ Iniciando geração automática de aulas da semana...');
      await gerarSemanaParaTodasTurmas();
      console.log('✅ Geração automática de aulas concluída.');
    } catch (erro) {
      console.error('❌ Erro no scheduler de aulas:', erro);
    }
  }, { timezone: APP_TZ });
}

async function verificarInatividadeEPararCobranca() {
  const agora = new Date();
  const limiteMs = 30 * 24 * 60 * 60 * 1000;
  const perfis = await Profile.find({ tipo: 'aluno', isentoVitalicio: false, statusTreino: 'ativo' }).select('_id userId academiaId ultimaPresencaEm');
  for (const p of perfis) {
    let ultima = p.ultimaPresencaEm || null;
    if (!ultima) {
      const a = await Aula.findOne({ confirmados: p.userId }).sort({ dataHora: -1 }).select('dataHora');
      ultima = a?.dataHora || null;
      if (ultima) await Profile.updateOne({ _id: p._id }, { $set: { ultimaPresencaEm: ultima } });
    }
    const inativo = !ultima || (agora.getTime() - new Date(ultima).getTime() > limiteMs);
    if (inativo) {
      await Profile.updateOne({ _id: p._id }, { $set: { statusTreino: 'inativo', cobrancaPausada: true, motivoCobrancaPausada: 'inatividade', cobrancaPausadaEm: new Date() } });
      try { void (await User.findById(p.userId).select('mpPreapprovalId')) } catch (e) { void e }
    }
  }
}

export function startDailyInatividadeScheduler() {
  cron.schedule('0 2 * * *', async () => {
    try {
      await verificarInatividadeEPararCobranca();
    } catch (e) { void e; }
  }, { timezone: APP_TZ });
}
