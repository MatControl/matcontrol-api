import cron from 'node-cron'
import Profile from '../models/Profile.js'
import User from '../models/User.js'
import { formatInTimeZone } from 'date-fns-tz'
import { sendEmail } from './emailSender.js'
import Modalidade from '../models/Modalidade.js'

function calcularIdade(nascimento, agora) {
  const d = new Date(nascimento)
  let idade = agora.getFullYear() - d.getFullYear()
  const m1 = agora.getMonth(), m2 = d.getMonth()
  if (m1 < m2 || (m1 === m2 && agora.getDate() < d.getDate())) idade -= 1
  return Math.max(idade, 0)
}

function gerarMensagem(nome, idade, modalidadeNome) {
  const assunto = `Feliz aniversário, ${nome}! 🥳`
  const base = `Oi, ${nome}! Hoje você completa ${idade} ${idade === 1 ? 'ano' : 'anos'}!`
  const porModalidade = (m) => {
    const s = String(m || '').toLowerCase()
    if (s.includes('jiu') || s.includes('bjj')) return 'Que seu dia seja tão afiado quanto seu jogo de chão. Oss! 🥋'
    if (s.includes('jud')) return 'Que seu dia tenha mais ippons que velas no bolo! 🥇'
    if (s.includes('muay') || s.includes('thai')) return 'Que seu dia tenha combos perfeitos e muita energia! 🥊'
    if (s.includes('box')) return 'Que seus jabs e ganchos de felicidade acertem o alvo! 🥊'
    if (s.includes('karat')) return 'Que seu kiai traga foco e alegria hoje! 🥋'
    return 'Que seu dia seja tão incrível quanto um armlock perfeito. Muitas conquistas nos treinos e fora deles! 🎉'
  }
  const texto = `${base} ${porModalidade(modalidadeNome)}`
  const html = `<div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6">
    <p>Oi, <strong>${nome}</strong>! 🎈</p>
    <p>Hoje você completa <strong>${idade}</strong> ${idade === 1 ? 'ano' : 'anos'}!</p>
    <p>${porModalidade(modalidadeNome)}</p>
    <p>Um abraço da equipe MatControl! 🥋🎉</p>
  </div>`
  return { assunto, texto, html }
}

export function startBirthdayScheduler() {
  const tz = process.env.APP_TIMEZONE || 'America/Sao_Paulo'
  cron.schedule('0 8 * * *', async () => {
    try {
      const agora = new Date()
      const todayStr = formatInTimeZone(agora, tz, 'MM-dd')
      const perfis = await Profile.find({ nascimento: { $ne: null } }).select('userId nome nascimento modalidadeId tipo')
      const aniversariantes = perfis.filter(p => formatInTimeZone(new Date(p.nascimento), tz, 'MM-dd') === todayStr)
      if (aniversariantes.length === 0) return
      // Agrupar por usuário e enviar apenas um email por usuário
      const porUsuario = new Map()
      for (const p of aniversariantes) {
        const key = String(p.userId)
        const arr = porUsuario.get(key) || []
        arr.push(p)
        porUsuario.set(key, arr)
      }
      const userIds = Array.from(porUsuario.keys())
      const users = await User.find({ _id: { $in: userIds } }).select('_id email nome')
      const mapUser = new Map(users.map(u => [String(u._id), u]))
      // Coletar modalidades preferidas por usuário (prioriza perfil de aluno)
      const preferidas = []
      for (const arr of porUsuario.values()) {
        const preferred = arr.find(x => x.modalidadeId && x.tipo === 'aluno') || arr.find(x => x.modalidadeId) || arr[0]
        if (preferred?.modalidadeId) preferidas.push(preferred.modalidadeId)
      }
      const modalidades = preferidas.length > 0 ? await Modalidade.find({ _id: { $in: preferidas } }).select('_id nome') : []
      const mapMod = new Map(modalidades.map(m => [String(m._id), m.nome]))
      for (const [uid, arr] of porUsuario.entries()) {
        const u = mapUser.get(uid)
        const email = u?.email || null
        if (!email) continue
        const preferred = arr.find(x => x.modalidadeId && x.tipo === 'aluno') || arr.find(x => x.modalidadeId) || arr[0]
        const modNome = preferred?.modalidadeId ? (mapMod.get(String(preferred.modalidadeId)) || null) : null
        const idade = calcularIdade(preferred.nascimento, agora)
        const nome = preferred.nome || u?.nome || 'Aluno'
        const msg = gerarMensagem(nome, idade, modNome)
        await sendEmail(email, msg.assunto, msg.texto, msg.html)
      }
    } catch (e) {
      console.warn('Erro no birthday scheduler', e?.message)
    }
  }, { timezone: tz })
}
