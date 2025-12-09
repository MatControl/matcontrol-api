import { request, setStatus } from '/test/gestor/assets/api.js'
window.addEventListener('DOMContentLoaded',()=>{
  const wrap=document.querySelector('.wrap');
  if(!wrap) return;
  const card=document.createElement('div');
  card.className='card';
  card.innerHTML='<h2 class="title">Foto de Perfil</h2><div class="row"><div><label>Enviar Foto<input id="al-foto" type="file" accept="image/*"></label></div><div><div class="muted">Envie sua foto para melhorar o reconhecimento facial.</div></div></div><div class="nav"><button class="btn" id="al-upload">Enviar</button></div><div id="al-status" class="status muted"></div>';
  wrap.appendChild(card);
  const btn=document.getElementById('al-upload');
  if(btn){
    btn.onclick=async()=>{
      const f=document.getElementById('al-foto')?.files?.[0]||null;
      if(!f){alert('Selecione uma foto');return}
      const perf=await request('GET','/api/perfis/user');
      const aluno=(Array.isArray(perf.data)?perf.data.find(p=>String(p.tipo||'').toLowerCase()==='aluno'):null);
      if(!aluno){alert('Perfil de aluno não encontrado');return}
      const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result));fr.readAsDataURL(f)});
      const r=await request('PATCH','/api/perfis/'+aluno._id,{fotoBase64:b64});
      setStatus(r.res.ok,'Foto: '+r.res.status);
      const el=document.getElementById('al-status'); if(el) el.textContent=r.res.ok?'Foto atualizada':'Falha ao atualizar';
    }
  }
});