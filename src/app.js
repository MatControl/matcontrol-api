import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { mercadoPagoWebhook } from './controllers/paymentsMpController.js';
import { webhook as stripeWebhook } from './controllers/billingController.js';

// Rotas (vamos criar os arquivos depois)
import profileRoutes from './routes/profiles.js';
import academiaRoutes from './routes/academias.js';
import turmasRoutes from './routes/turmas.js'
import niveisRoutes from './routes/niveis.js';
import planosRoutes from './routes/planos.js';
import authRoutes from './routes/authRoutes.js'
import dependenteRoutes from './routes/dependentes.js'
import aulasRoutes from './routes/aulas.js'
import modalidades from './routes/modalidades.js';
import pagamentosRoutes from './routes/pagamentos.js';
import billingRoutes from './routes/billing.js';
import gestorRoutes from './routes/gestor.js';



dotenv.config();
connectDB();

const app = express();

app.post('/api/pagamentos/mercadopago/webhook', express.json(), mercadoPagoWebhook);
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  try {
    console.log('HTTP', req.method, req.url);
  } catch (e) {}
  next();
});

// CORS configurável para receber frontend
const NODE_ENV = process.env.NODE_ENV || 'development';
const allowedOriginsEnv = (process.env.CORS_ORIGINS || process.env.APP_FRONTEND_ORIGIN || '').trim();
const allowedOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean) : [];

if (NODE_ENV === 'production' && allowedOrigins.length > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir requests sem origin (ex.: curl/Postman)
        if (!origin) return callback(null, true);
        // Verificar lista permitida
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
} else {
  // Em desenvolvimento, permitir qualquer origem para facilitar testes
  app.use(cors());
}

// Endpoint de saúde
app.get('/api/healthz', (req, res) => {
  res.json({ ok: true, env: NODE_ENV });
});

// Rotas principais
app.use('/api/perfis', profileRoutes);
app.use('/api/academias', academiaRoutes);
app.use('/api/turmas', turmasRoutes)
app.use('/api/niveis', niveisRoutes);
app.use('/api/planos', planosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dependentes', dependenteRoutes);
app.use('/api/aulas', aulasRoutes);
app.use('/api/modalidades', modalidades);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/gestor', gestorRoutes);

const __dirnameStatic = path.dirname(fileURLToPath(import.meta.url));
const publicDirStatic = path.resolve(__dirnameStatic, '../public');
// Inject enhancements into dashboard before static middleware to ensure precedence
app.get('/test/gestor/dashboard.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'gestor', 'dashboard.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(
    "<div class=\"nav\"><button class=\"btn\" onclick=\"location.href='/test/gestor/academia'\">Academia</button><button class=\"btn\" onclick=\"location.href='/test/gestor/planos'\">Planos</button><button class=\"btn\" onclick=\"location.href='/test/gestor/modalidades'\">Modalidades</button><button class=\"btn\" onclick=\"location.href='/test/gestor/professor'\">Professor</button></div>",
    "<div class=\"nav\"><button class=\"btn\" onclick=\"location.href='/test/gestor/academia'\">Academia</button><button class=\"btn\" onclick=\"location.href='/test/gestor/planos'\">Planos</button><button class=\"btn\" onclick=\"location.href='/test/gestor/modalidades'\">Modalidades</button><button class=\"btn\" onclick=\"location.href='/test/gestor/professor'\">Professor</button><button class=\"btn\" onclick=\"location.href='/test/gestor/turmas/modalidade.html'\">Criar Turma</button></div>"
  );
  html = html.replace('</div></div><div id=\"toast\" class=\"toast\" style=\"display:none\"></div>', '<div class=\"card\"><h2 class=\"title\">Turmas da Academia</h2><div id=\"turmas\"></div></div></div><div id=\"toast\" class=\"toast\" style=\"display:none\"></div>');
  html = html.replace('</script></body></html>', `
  const turmasEl = document.getElementById('turmas');
  async function carregarTurmas(){
    const acad=await request('GET','/api/gestor/academia');
    const acadId=(acad?.data?._id)||acad?.data?.id||null;
    const r=acadId?await request('GET','/api/turmas/academia/'+acadId):{data:[]};
    const list=Array.isArray(r.data)?r.data:[];
    if(list.length===0){turmasEl.innerHTML='<div class="muted">Sem turmas cadastradas.</div>';return}
    const makeLink=(cod)=>location.origin+'/test/aluno/turma.html?codigo='+encodeURIComponent(cod||'');
    turmasEl.innerHTML='';
    list.forEach(t=>{
      const row=document.createElement('div');row.className='row';
      const dias=Array.isArray(t.diasDaSemana)?t.diasDaSemana.join(', '):'';
      const link = makeLink(t.codigoConvite||'');
      var left=document.createElement('div');
      left.innerHTML='<strong>'+String(t.nome||'')+'</strong> • '+dias+' • '+String(t.horario||'');
      var right=document.createElement('div');
      var inp=document.createElement('input'); inp.value=link; inp.readOnly=true; inp.className='input'; inp.style.maxWidth='380px';
      var btn=document.createElement('button'); btn.className='btn small secondary'; btn.textContent='Copiar';
      btn.onclick=function(){ var old=btn.textContent; function done(){ btn.textContent='Copiado!'; setTimeout(function(){ btn.textContent=old },1500) };
        if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(done).catch(done) } else { try{ inp.focus(); inp.select(); document.execCommand('copy'); done() } catch(e){ done() } }
      };
      right.appendChild(inp); right.appendChild(btn);
      row.appendChild(left); row.appendChild(right);
      turmasEl.appendChild(row);
    })
  }
  carregarTurmas();
  setTimeout(function(){
    const wrap=document.getElementById('turmas');
    if(!wrap) return;
    const nodes=wrap.querySelectorAll('a.btn.small');
    nodes.forEach(function(a){
      var link=a.getAttribute('href')||'';
      var parent=a.parentNode; if(!parent) return;
      var inp=document.createElement('input'); inp.value=link; inp.readOnly=true; inp.className='input'; inp.style.maxWidth='380px';
      var btn=document.createElement('button'); btn.className='btn small secondary'; btn.textContent='Copiar';
      btn.onclick=function(){ var old=btn.textContent; function done(){ btn.textContent='Copiado!'; setTimeout(function(){ btn.textContent=old },1500) };
        if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(done).catch(done) } else { try{ inp.focus(); inp.select(); document.execCommand('copy'); done() } catch(e){ done() } }
      };
      parent.innerHTML=''; parent.appendChild(inp); parent.appendChild(btn);
    })
  }, 50);
  </script></body></html>`);
  res.send(html);
});
app.get('/test/gestor/turmas/detalhes.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'gestor', 'turmas', 'detalhes.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('<label>ID do Perfil do Professor (opcional)<input id="tur-prof-perfil"></label>', '<label>Professor (da academia)<select id="tur-prof-perfil"><option value="">Selecione o professor</option></select></label>');
  html = html.replace('Se você marcou "Usar meu perfil de professor", não precisa preencher o ID. Caso contrário, informe o ID do perfil de professor da academia.', 'Selecione o professor vinculado à academia ou marque "Usar meu perfil de professor".');
  html = html.replace('</script></body></html>', `</script><script type="module">import{request,set,get}from'/test/gestor/assets/api.js';async function loadProfessores(){const acad=await request('GET','/api/gestor/academia');const acadId=(acad?.data?._id)||acad?.data?.id||null;const sel=document.getElementById('tur-prof-perfil');if(!sel)return;sel.innerHTML='';const pl=document.createElement('option');pl.value='';pl.textContent='Selecione o professor';sel.appendChild(pl);if(!acadId){sel.disabled=true;return}const r=await request('GET','/api/perfis/professores/academia/'+acadId);let list=Array.isArray(r.data)?r.data:[];const modId=get('tur_mod')||'';if(modId){list=list.filter(pf=>!pf.modalidadeId||String(pf.modalidadeId||'')===String(modId))}list.forEach(pf=>{const o=document.createElement('option');o.value=pf._id;o.textContent=pf.nome;sel.appendChild(o)});const prev=get('tur_prof_perfil')||'';if(prev)sel.value=prev}window.addEventListener('DOMContentLoaded',loadProfessores);document.getElementById('next').onclick=async()=>{const nome=(document.getElementById('tur-nome').value||'').trim();if(!nome){alert('Informe o nome da turma');return}set('tur_nome',nome);const usarMeu=document.getElementById('usar-meu-prof').checked;if(usarMeu){const perf=await request('GET','/api/perfis/user');const pro=Array.isArray(perf.data)?perf.data.find(p=>String(p.tipo).toLowerCase()==='professor'):null;if(pro&&pro._id){set('tur_prof_perfil',pro._id)}else{alert('Seu usuário não possui perfil de professor');return}}else{const id=(document.getElementById('tur-prof-perfil').value||'').trim();if(!id){alert('Selecione o professor');return}set('tur_prof_perfil',id)}location.href='/test/gestor/turmas/agendamento.html'};</script></body></html>`);
  res.send(html);
});
app.get('/test/gestor/turmas/detalhes.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'gestor', 'turmas', 'detalhes.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('<label>ID do Perfil do Professor (opcional)<input id="tur-prof-perfil"></label>', '<label>Professor (da academia)<select id="tur-prof-perfil"><option value="">Selecione o professor</option></select></label>');
  html = html.replace('Se você marcou "Usar meu perfil de professor", não precisa preencher o ID. Caso contrário, informe o ID do perfil de professor da academia.', 'Selecione o professor vinculado à academia ou marque "Usar meu perfil de professor".');
  html = html.replace('</script></body></html>', `</script><script type="module">import{request,set,get}from'/test/gestor/assets/api.js';async function loadProfessores(){const acad=await request('GET','/api/gestor/academia');const acadId=(acad?.data?._id)||acad?.data?.id||null;const sel=document.getElementById('tur-prof-perfil');if(!sel)return;sel.innerHTML='';const pl=document.createElement('option');pl.value='';pl.textContent='Selecione o professor';sel.appendChild(pl);if(!acadId){sel.disabled=true;return}const r=await request('GET','/api/perfis/professores/academia/'+acadId);let list=Array.isArray(r.data)?r.data:[];const modId=get('tur_mod')||'';if(modId){list=list.filter(pf=>String(pf.modalidadeId||'')===String(modId))}list.forEach(pf=>{const o=document.createElement('option');o.value=pf._id;o.textContent=pf.nome;sel.appendChild(o)});const prev=get('tur_prof_perfil')||'';if(prev)sel.value=prev}window.addEventListener('DOMContentLoaded',loadProfessores);document.getElementById('next').onclick=async()=>{const nome=(document.getElementById('tur-nome').value||'').trim();if(!nome){alert('Informe o nome da turma');return}set('tur_nome',nome);const usarMeu=document.getElementById('usar-meu-prof').checked;if(usarMeu){const perf=await request('GET','/api/perfis/user');const pro=Array.isArray(perf.data)?perf.data.find(p=>String(p.tipo).toLowerCase()==='professor'):null;if(pro&&pro._id){set('tur_prof_perfil',pro._id)}else{alert('Seu usuário não possui perfil de professor');return}}else{const id=(document.getElementById('tur-prof-perfil').value||'').trim();if(!id){alert('Selecione o professor');return}set('tur_prof_perfil',id)}location.href='/test/gestor/turmas/agendamento.html'};</script></body></html>`);
  res.send(html);
});
app.use('/profile-photos', express.static(path.join(publicDirStatic, 'profile-photos')));
app.use('/figma', express.static(path.resolve(__dirnameStatic, '../.figma')));
app.use('/test', express.static(path.join(publicDirStatic, 'test')));
app.get('/test/gestor', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'gestor-test.html'));
});
app.get('/test/gestor/cadastro', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'cadastro.html'));
});
app.get('/test/gestor/cadastro.html', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'cadastro.html'));
});
app.get('/test/gestor/login', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'login.html'));
});
app.get('/test/gestor/academia', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'academia.html'));
});
app.get('/test/gestor/modalidades', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'modalidades.html'));
});
app.get('/test/gestor/planos', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'planos.html'));
});
app.get('/test/gestor/turmas/modalidade.html', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'turmas', 'modalidade.html'));
});
app.get('/test/gestor/turmas/agendamento.html', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'turmas', 'agendamento.html'));
});
app.get('/test/gestor/turmas/confirmar.html', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'turmas', 'confirmar.html'));
});
app.get('/test/gestor/turmas/detalhes.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'gestor', 'turmas', 'detalhes.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('<label>ID do Perfil do Professor (opcional)<input id="tur-prof-perfil"></label>', '<label>Professor (da academia)<select id="tur-prof-perfil"></select></label>');
  html = html.replace('</script></body></html>', `</script><script type="module">import{request,set,get}from'/test/gestor/assets/api.js';async function loadProfessores(){const acad=await request('GET','/api/gestor/academia');const acadId=(acad?.data?._id)||acad?.data?.id||null;const sel=document.getElementById('tur-prof-perfil');if(!sel)return;sel.innerHTML='';if(!acadId){const o=document.createElement('option');o.value='';o.textContent='Academia não encontrada';sel.appendChild(o);sel.disabled=true;return}const r=await request('GET','/api/perfis/professores/academia/'+acadId);let list=Array.isArray(r.data)?r.data:[];const modId=get('tur_mod')||'';if(modId){list=list.filter(pf=>String(pf.modalidadeId||'')===String(modId))}if(list.length===0){const o=document.createElement('option');o.value='';o.textContent='Sem professores cadastrados';sel.appendChild(o)}else{const p=document.createElement('option');p.value='';p.textContent='Selecione o professor';sel.appendChild(p);list.forEach(pf=>{const o=document.createElement('option');o.value=pf._id;o.textContent=pf.nome;sel.appendChild(o)})}const prev=get('tur_prof_perfil')||'';if(prev)sel.value=prev}window.addEventListener('DOMContentLoaded',loadProfessores);document.getElementById('next').onclick=async()=>{const nome=(document.getElementById('tur-nome').value||'').trim();if(!nome){alert('Informe o nome da turma');return}set('tur_nome',nome);const usarMeu=document.getElementById('usar-meu-prof').checked;if(usarMeu){const perf=await request('GET','/api/perfis/user');const pro=Array.isArray(perf.data)?perf.data.find(p=>String(p.tipo).toLowerCase()==='professor'):null;if(pro&&pro._id){set('tur_prof_perfil',pro._id)}else{alert('Seu usuário não possui perfil de professor');return}}else{const id=(document.getElementById('tur-prof-perfil').value||'').trim();if(!id){alert('Selecione um professor');return}set('tur_prof_perfil',id)}location.href='/test/gestor/turmas/agendamento.html'};</script></body></html>`);
  res.send(html);
});
app.get('/test/gestor/professor', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'gestor', 'professor.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('<label>Faixa<select id="pf-faixa"></select></label>', '<label>Faixa<select id="pf-faixa"></select></label><label>Grau<select id="pf-grau"></select></label>');
  html = html.replace('</body></html>', '<script type="module" src="/test/gestor/assets/professor-enhancements.js"></script></body></html>');
  res.send(html);
});
app.get('/test/professor', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'professor', 'index.html'));
});
app.get('/test/professor/login.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'professor', 'login.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace("get('gestor_email')","get('prof_email')");
  html = html.replace("get('gestor_senha')","get('prof_senha')");
  res.send(html);
});
app.get('/test/professor/cadastro.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'professor', 'cadastro.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('<div class="nav"><button class="btn secondary" id="back">Voltar</button><button class="btn" id="next">Cadastrar</button></div>', '<div class="nav"><button class="btn" id="next">Cadastrar</button><button class="btn secondary" id="goto-login">Ir para Login</button></div>');
  html = html.replace("document.getElementById('back').onclick=()=>{location.href='/test/gestor/login'};", "document.getElementById('goto-login').onclick=()=>{location.href='/test/professor/login.html'};");
  res.send(html);
});
app.get('/test/professor/dados.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'professor', 'dados.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace("location.href='/test/professor/dashboard.html'", "location.href='/test/professor/luta.html'");
  res.send(html);
});
app.get('/test/professor/luta.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'professor', 'luta.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace("document.getElementById('back').onclick=()=>{location.href='/test/professor/login.html'}", "document.getElementById('back').onclick=()=>{location.href='/test/professor/dados.html'}");
  html = html.replace("location.href='/test/professor/dados.html'", "location.href='/test/professor/dashboard.html'");
  res.send(html);
});
app.get('/test/gestor/checkout', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'gestor', 'checkout.html'));
});
// Aluno fluxo
app.get('/test/aluno', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'aluno', 'cadastro.html'));
});
app.get('/test/aluno/cadastro.html', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'aluno', 'cadastro.html'));
});
app.get('/test/aluno/login.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'aluno', 'login.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace("get('gestor_email')","get('aluno_email')");
  html = html.replace("get('gestor_senha')","get('aluno_senha')");
  res.send(html);
});
app.get('/test/aluno/dados.html', (req, res) => {
  res.sendFile(path.join(publicDirStatic, 'test', 'aluno', 'dados.html'));
});
app.get('/test/aluno/turma.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'aluno', 'turma.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('</script></body></html>', `</script><script>try{var u=new URL(location.href);var c=u.searchParams.get('codigo')||'';if(!c){c=localStorage.getItem('aluno_codigo')||''}if(c){var el=document.getElementById('codigo');if(el)el.value=c}}catch(e){}</script></body></html>`);
  res.send(html);
});
app.get('/test/aluno/dashboard.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'aluno', 'dashboard.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('</body></html>', '<script type="module" src="/test/aluno/assets/enhancements.js"></script></body></html>');
  res.send(html);
});
app.get('/test/aluno/dashboard', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'aluno', 'dashboard.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('</body></html>', '<script type="module" src="/test/aluno/assets/enhancements.js"></script></body></html>');
  res.send(html);
});
app.get('/test/professor/dashboard.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'professor', 'dashboard.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace('</div></div><div id=\"toast\" class=\"toast\" style=\"display:none\"></div>', '<div class=\"card\"><h2 class=\"title\">Minhas Turmas</h2><div id=\"turmas-pro\"></div></div></div><div id=\"toast\" class=\"toast\" style=\"display:none\"></div>');
  html = html.replace('</script></body></html>', `
  (async()=>{const el=document.getElementById('turmas-pro');if(!el)return;const r=await request('GET','/api/turmas/minhas');const list=Array.isArray(r.data)?r.data:[];if(list.length===0){el.innerHTML='<div class="muted">Sem turmas vinculadas.</div>';return}const makeLink=(cod)=>location.origin+'/test/aluno/turma.html?codigo='+encodeURIComponent(cod||'');el.innerHTML='';list.forEach(t=>{var row=document.createElement('div');row.className='row';var dias=Array.isArray(t.diasDaSemana)?t.diasDaSemana.join(', '):'';var link=makeLink(t.codigoConvite||'');var left=document.createElement('div');left.innerHTML='<strong>'+String(t.nome||'')+'</strong> • '+dias+' • '+String(t.horario||'');var right=document.createElement('div');var inp=document.createElement('input');inp.value=link;inp.readOnly=true;inp.className='input';inp.style.maxWidth='380px';var btn=document.createElement('button');btn.className='btn small secondary';btn.textContent='Copiar';btn.onclick=function(){var old=btn.textContent;function done(){btn.textContent='Copiado!';setTimeout(function(){btn.textContent=old},1500)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(link).then(done).catch(done)}else{try{inp.focus();inp.select();document.execCommand('copy');done()}catch(e){done()}}};right.appendChild(inp);right.appendChild(btn);row.appendChild(left);row.appendChild(right);el.appendChild(row)})})();
  </script></body></html>`);
  res.send(html);
});
app.get('/test/gestor/dashboard', (req, res) => {
  res.send(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard Gestor</title><link rel="stylesheet" href="/test/gestor/assets/styles.css"></head><body><div id="toast" class="toast" style="display:none"></div><script type="module">import{request,ensureTokenOrRedirect}from'/test/gestor/assets/api.js';ensureTokenOrRedirect();(async()=>{let d='/test/gestor/academia';const acad=await request('GET','/api/gestor/academia');if(!acad.res.ok){location.href=d;return}const a=acad.data||{};if(!Array.isArray(a.modalidadesAtivas)||a.modalidadesAtivas.length===0){location.href='/test/gestor/modalidades';return}const pl=await request('GET','/api/gestor/planos');let temPlanos=false;if(pl.data&&Array.isArray(pl.data.planos)){temPlanos=pl.data.planos.length>0}else if(Array.isArray(pl.data)){temPlanos=pl.data.length>0}if(!temPlanos){location.href='/test/gestor/planos';return}const perf=await request('GET','/api/perfis/user');const temProfessor=Array.isArray(perf.data)&&perf.data.some(p=>String(p.tipo).toLowerCase()==='professor');if(!temProfessor){location.href='/test/gestor/professor';return}location.href='/test/gestor/dashboard.html'})();</script></body></html>`);
});
app.get('/test/gestor/dashboard.html', (req, res) => {
  const p = path.join(publicDirStatic, 'test', 'gestor', 'dashboard.html');
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(
    "<div class=\"nav\"><button class=\"btn\" onclick=\"location.href='/test/gestor/academia'\">Academia</button><button class=\"btn\" onclick=\"location.href='/test/gestor/planos'\">Planos</button><button class=\"btn\" onclick=\"location.href='/test/gestor/modalidades'\">Modalidades</button><button class=\"btn\" onclick=\"location.href='/test/gestor/professor'\">Professor</button></div>",
    "<div class=\"nav\"><button class=\"btn\" onclick=\"location.href='/test/gestor/academia'\">Academia</button><button class=\"btn\" onclick=\"location.href='/test/gestor/planos'\">Planos</button><button class=\"btn\" onclick=\"location.href='/test/gestor/modalidades'\">Modalidades</button><button class=\"btn\" onclick=\"location.href='/test/gestor/professor'\">Professor</button><button class=\"btn\" onclick=\"location.href='/test/gestor/turmas/modalidade.html'\">Criar Turma</button></div>"
  );
  html = html.replace('</body></html>','<script type=\"module\" src=\"/test/gestor/assets/dashboard-enhancements.js\"></script></body></html>');
  res.send(html);
});

// Fallback de desenvolvimento: ajuda a diagnosticar rotas não atendidas
app.use((req, res) => {
  res.status(404).send(`fallback ${req.method} ${req.url}`);
});

export default app;
