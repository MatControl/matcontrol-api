import { request, setStatus } from '/test/gestor/assets/api.js'
window.addEventListener('DOMContentLoaded',()=>{
  const wrap=document.querySelector('.wrap'); if(!wrap) return;
  const card=document.createElement('div'); card.className='card';
card.innerHTML='<h2 class="title">Chamada por Foto</h2><div class="row"><div><label>Turma<select id="ch-turma"></select></label><label>Aula<select id="ch-aula"></select></label><label>Foto do treino<input id="ch-foto" type="file" accept="image/*"></label></div><div><div class="muted">Selecione a turma e a aula e envie a foto do treino para chamada.</div></div></div><div class="nav"><button class="btn" id="ch-submit">Fazer Chamada</button></div><div id="ch-status" class="status muted"></div>';
  wrap.appendChild(card);
  (async()=>{
    const acad=await request('GET','/api/gestor/academia'); const acadId=(acad?.data?._id)||acad?.data?.id||null;
    const r=acadId?await request('GET','/api/turmas/academia/'+acadId):{data:[]}; const list=Array.isArray(r.data)?r.data:[];
    const sel=document.getElementById('ch-turma'); if(sel){ sel.innerHTML=''; list.forEach(t=>{ const o=document.createElement('option'); o.value=String(t._id||''); o.textContent=String(t.nome||''); sel.appendChild(o) }); sel.addEventListener('change', async()=>{ const tid=sel.value; const aSel=document.getElementById('ch-aula'); if(aSel){ aSel.innerHTML=''; if(!tid){ const o=document.createElement('option'); o.value=''; o.textContent='Selecione a turma'; aSel.appendChild(o); return } const ar=await request('GET','/api/aulas/turmas/'+tid+'/semana'); const aulas=Array.isArray(ar.data)?ar.data:[]; if(aulas.length===0){ const o=document.createElement('option'); o.value=''; o.textContent='Sem aulas na semana'; aSel.appendChild(o) } else { aulas.forEach(a=>{ const o=document.createElement('option'); o.value=String(a._id||''); const dt=new Date(a.dataHora); o.textContent=dt.toLocaleString('pt-BR'); aSel.appendChild(o) }) } } }); if(sel.value){ sel.dispatchEvent(new Event('change')) } }
  })();
  const btn=document.getElementById('ch-submit');
  if(btn){ btn.onclick=async()=>{
    const aulaId=document.getElementById('ch-aula')?.value||''; const file=document.getElementById('ch-foto')?.files?.[0]||null;
    if(!aulaId){ alert('Selecione a aula'); return } if(!file){ alert('Selecione a foto do treino'); return }
    const b64=await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(String(fr.result)); fr.readAsDataURL(file) });
    const r=await request('POST','/api/aulas/'+aulaId+'/chamada-automatica',{ imageBase64: b64 }); setStatus(r.res.ok,'Chamada: '+r.res.status);
    const st=document.getElementById('ch-status'); if(st) st.textContent=r.res.ok?'Chamada realizada':'Falha na chamada';
  } }
});