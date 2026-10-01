/* Ninho da Águia · Suplementos SkyFit Campo Limpo Paulista
   App de estoque e vendas (PWA) com Supabase. */
(function(){
"use strict";
const NOME='Ninho da Águia', SUB='Suplementos · SkyFit Campo Limpo Paulista';
const CATS=['Whey','Creatina','Pré-treino','Gel de carboidrato','Barra de proteína','Bebidas','Outros'];
const PREF={'Whey':'WHEY','Creatina':'CREA','Pré-treino':'PRE','Gel de carboidrato':'GEL','Barra de proteína':'BAR','Bebidas':'BEB','Outros':'OUT'};
const PAGS=['Pix','Dinheiro','Débito','Crédito'];
const PAGS_PDV=[...PAGS,'Conta'];const PAG_LABEL={Conta:'Pendurar'};const TIPOS=['Funcionário','Aluno','Outro'];
const LOGO='icons/brasao.png';
const S={sb:null,clientes:[],saldos:{},pagHoje:[],cliente:'',descFunc:10,sessao:null,perfil:null,nomeLoja:NOME,produtos:[],prodLoaded:false,hoje:[],view:'pdv',cart:[],pag:'Pix',cat:'Todos',busca:'',rel:{p:'hoje',de:'',ate:''},relData:null,estBusca:'',estCat:'Todos',editId:null,entPid:null};

const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const hoje=()=>iso(new Date());
const fmtDia=s=>{const [y,m,d]=String(s).slice(0,10).split('-');return d+'/'+m+'/'+y};
const hora=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())};
const num=v=>{if(typeof v==='number')return v;v=String(v||'').trim().replace(/\s/g,'').replace(/^R\$/,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');const n=parseFloat(v);return isNaN(n)?0:n};
const crest=()=>`<img alt="Brasão SkyFit" src="${LOGO}">`;
const isG=()=>S.perfil&&S.perfil.papel==='gerente';

function toast(msg,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),bad?5500:2800)}
function modal(html,onMount){const bg=document.createElement('div');bg.className='modal-bg';bg.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;document.body.appendChild(bg);const close=()=>bg.remove();bg.addEventListener('click',e=>{if(e.target===bg)close()});onMount&&onMount(bg.firstChild,close);return close}
function confirmBox(msg,okLabel,cb){modal(`<h2>Confirmar</h2><p style="margin:0">${msg}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-x>Voltar</button><button class="btn p" data-ok>${esc(okLabel)}</button></div>`,(m,close)=>{m.querySelector('[data-x]').onclick=close;m.querySelector('[data-ok]').onclick=()=>{close();cb()}})}
function erroMsg(e){
  if(!e)return 'Algo deu errado. Tente de novo.';
  const m=String(e.message||e.error_description||e);
  if(/Failed to fetch|NetworkError|network/i.test(m))return 'Sem conexão com a internet. Confira o Wi-Fi e tente de novo.';
  if(/Invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';
  if(/Email not confirmed/i.test(m))return 'Este e-mail ainda não foi confirmado. Veja a caixa de entrada ou peça para a gerente desligar a confirmação de e-mail no Supabase.';
  if(/already registered|already been registered/i.test(m))return 'Já existe uma conta com esse e-mail.';
  if(/Password should be at least/i.test(m))return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/duplicate key.*codigo/i.test(m))return 'Já existe um produto com esse código.';
  if(/row-level security/i.test(m))return 'Você não tem permissão para fazer isso.';
  return m.replace(/^.*?ERROR:\s*/,'');
}
function fatal(html){$('#app').innerHTML=`<div class="login-wrap"><div class="login"><div class="crest">${crest()}</div><h1>${esc(NOME)}</h1>${html}</div></div>`}

/* ---------- BOOT ---------- */
async function boot(){
  const cfg=window.NINHO_CONFIG||{};
  if(!cfg.SUPABASE_URL||/COLE_AQUI/.test(cfg.SUPABASE_URL+cfg.SUPABASE_ANON_KEY)){
    fatal(`<div class="banner warn">Falta ligar o app ao Supabase. Abra o arquivo <b>config.js</b> e cole a Project URL e a chave anon public do seu projeto (passo 2 do GUIA).</div>`);return}
  if(!window.supabase||!window.supabase.createClient){fatal('<div class="banner bad">Não foi possível carregar o app. Confira a internet e recarregue.</div>');return}
  S.sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'ninho-auth'}});
  S.sb.from('config').select('*').eq('id',1).maybeSingle().then(({data})=>{if(data&&data.desconto_funcionario!=null)S.descFunc=Number(data.desconto_funcionario);if(data&&data.nome){S.nomeLoja=data.nome;const b=$('.brand b');if(b)b.textContent=data.nome}});
  const {data:{session}}=await S.sb.auth.getSession();
  S.sb.auth.onAuthStateChange((ev,sess)=>{if(ev==='SIGNED_OUT'){S.sessao=null;S.perfil=null;stopRealtime();loginScreen()}else if(sess)S.sessao=sess});
  if(session){S.sessao=session;await entrar()}else loginScreen();
}
window.addEventListener('online',()=>{$('#offline')&&$('#offline').remove();if(S.perfil)recarregarTudo()});
window.addEventListener('offline',()=>{if(!$('#offline')){const d=document.createElement('div');d.id='offline';d.className='offline';d.textContent='Sem internet. As vendas não podem ser registradas até a conexão voltar.';document.body.prepend(d)}});

async function entrar(){
  const uid=S.sessao.user.id;
  const {data,error}=await S.sb.from('perfis').select('*').eq('id',uid).maybeSingle();
  if(error){fatal(`<div class="banner bad">${esc(erroMsg(error))}</div><button class="btn" id="sair0">Sair</button>`);$('#sair0').onclick=()=>S.sb.auth.signOut();return}
  S.perfil=data;
  if(!data||!['gerente','recepcao'].includes(data.papel)){
    fatal(`<div class="banner ${data&&data.papel==='bloqueado'?'bad':'info'}">${data&&data.papel==='bloqueado'?'Seu acesso foi bloqueado pela gerente.':`Olá${data&&data.nome?', '+esc(data.nome):''}! Sua conta foi criada e está aguardando a gerente liberar o acesso na aba Equipe.`}</div><div class="row" style="justify-content:center"><button class="btn p" id="rechk">Verificar de novo</button><button class="btn" id="sair0">Sair</button></div>`);
    $('#rechk').onclick=()=>entrar();$('#sair0').onclick=()=>S.sb.auth.signOut();return}
  S.view='pdv';shell();await recarregarTudo();startRealtime();
}

/* ---------- LOGIN / CADASTRO ---------- */
function loginScreen(modo){
  modo=modo||'entrar';
  const criar=modo==='criar';
  $('#app').innerHTML=`<div class="login-wrap"><form class="login" id="lg"><div class="crest">${crest()}</div><h1>${esc(S.nomeLoja)}</h1><p class="muted" style="text-align:center;margin:-8px 0 0">${SUB}</p>
  ${criar?`<div class="banner info">A primeira conta criada vira a <b>gerente</b>. As próximas ficam aguardando a gerente liberar.</div><label class="f">Seu nome<input class="i" id="lg-n" autocomplete="name" required></label>`:''}
  <label class="f">E-mail<input class="i" id="lg-e" type="email" autocomplete="email" required inputmode="email"></label>
  <label class="f">Senha<input class="i" id="lg-s" type="password" required minlength="6" autocomplete="${criar?'new-password':'current-password'}"></label>
  <div id="lg-msg"></div><button class="btn p finish" type="submit">${criar?'Criar conta':'Entrar'}</button>
  <p style="text-align:center;margin:0">${criar?'Já tem conta? <button type="button" class="linkbtn" id="alt">Entrar</button>':'Primeiro acesso? <button type="button" class="linkbtn" id="alt">Criar conta</button>'}</p></form></div>`;
  $('#alt').onclick=()=>loginScreen(criar?'entrar':'criar');
  (criar?$('#lg-n'):$('#lg-e')).focus();
  $('#lg').onsubmit=async e=>{e.preventDefault();const btn=$('#lg .finish');btn.disabled=true;const msg=t=>{$('#lg-msg').innerHTML=`<div class="banner bad">${esc(t)}</div>`;btn.disabled=false};
    const email=$('#lg-e').value.trim(),senha=$('#lg-s').value;
    try{
      if(criar){const nome=$('#lg-n').value.trim();if(!nome)return msg('Digite seu nome.');if(senha.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
        const {data,error}=await S.sb.auth.signUp({email,password:senha,options:{data:{nome}}});if(error)return msg(erroMsg(error));
        if(!data.session){$('#lg-msg').innerHTML='<div class="banner info">Conta criada. Confirme o e-mail pelo link que chegou na sua caixa de entrada e depois entre.</div>';btn.disabled=false;return}
        S.sessao=data.session;await entrar();
      }else{const {data,error}=await S.sb.auth.signInWithPassword({email,password:senha});if(error)return msg(erroMsg(error));S.sessao=data.session;await entrar()}
    }catch(err){msg(erroMsg(err))}};
}

/* ---------- DADOS ---------- */
async function loadProdutos(){const {data,error}=await S.sb.from('produtos').select('*').order('nome');if(error)throw error;S.produtos=data;S.prodLoaded=true}
async function loadHoje(){const {data,error}=await S.sb.from('vendas').select('*, venda_itens(*)').eq('dia',hoje()).order('criado_em',{ascending:false});if(error)throw error;S.hoje=data}
async function loadClientes(){const [c,s,p]=await Promise.all([S.sb.from('clientes').select('*').order('nome'),S.sb.rpc('saldos_clientes'),S.sb.from('pagamentos_conta').select('*').eq('dia',hoje()).order('criado_em',{ascending:false})]);if(c.error)return;S.clientes=c.data||[];S.saldos={};(s.data||[]).forEach(r=>S.saldos[r.cliente_id]=r);S.pagHoje=p.data||[]}
async function recarregarTudo(){try{await Promise.all([loadProdutos(),loadHoje(),loadClientes()]);refreshView()}catch(e){toast(erroMsg(e),true)}}
let canal=null,tProd=null,tVend=null,tCli=null;
function startRealtime(){stopRealtime();
  canal=S.sb.channel('ninho-tempo-real')
   .on('postgres_changes',{event:'*',schema:'public',table:'produtos'},()=>{clearTimeout(tProd);tProd=setTimeout(async()=>{try{await loadProdutos();refreshView()}catch(e){}},250)})
   .on('postgres_changes',{event:'*',schema:'public',table:'vendas'},()=>{clearTimeout(tVend);tVend=setTimeout(async()=>{try{await Promise.all([loadHoje(),loadClientes()]);refreshView()}catch(e){}},400)})
   .on('postgres_changes',{event:'*',schema:'public',table:'clientes'},()=>{clearTimeout(tCli);tCli=setTimeout(async()=>{try{await loadClientes();refreshView()}catch(e){}},400)})
   .on('postgres_changes',{event:'*',schema:'public',table:'pagamentos_conta'},()=>{clearTimeout(tCli);tCli=setTimeout(async()=>{try{await loadClientes();refreshView()}catch(e){}},400)})
   .subscribe();}
function stopRealtime(){if(canal){S.sb.removeChannel(canal);canal=null}}
// Rede de segurança: atualiza a cada 60 s e ao voltar para o app (virada do dia, conexão instável)
setInterval(()=>{if(S.perfil&&navigator.onLine)recarregarTudo()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.perfil)recarregarTudo()});

/* ---------- SHELL ---------- */
function views(){return isG()?[['pdv','Vender'],['estoque','Estoque'],['produtos','Produtos'],['entradas','Entradas'],['relatorios','Relatórios'],['contas','Contas'],['equipe','Equipe']]:[['pdv','Vender'],['estoque','Estoque'],['caixa','Vendas de hoje'],['contas','Contas']]}
function shell(){
  if(!views().some(v=>v[0]===S.view))S.view='pdv';
  $('#app').innerHTML=`<header class="band"><div class="band-in"><div class="crest">${crest()}</div><div class="brand"><b>${esc(S.nomeLoja)}</b><span>${SUB}</span></div>
  <div class="who"><span class="chip ${isG()?'g':'r'}">${isG()?'Gerente':'Recepção'}</span><span>${esc(S.perfil.nome)}</span><button class="btn-ghost-band" id="sair">Sair</button></div></div>
  <nav class="tabs" role="tablist">${views().map(v=>`<button class="tab" role="tab" data-v="${v[0]}" aria-selected="${S.view===v[0]}">${v[1]}</button>`).join('')}</nav></header><main id="main"></main>`;
  $('#sair').onclick=()=>{S.cart=[];S.sb.auth.signOut()};
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>irPara(t.dataset.v));
  mountView();
}
function irPara(v){S.view=v;document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x.dataset.v===v));mountView();window.scrollTo(0,0)}
const V={};
function mountView(){const m=$('#main');if(!m)return;m.innerHTML='';(V[S.view]||V.pdv).mount(m)}
function refreshView(){if(!$('#main'))return;const v=V[S.view];v&&v.refresh&&v.refresh()}
function stPill(p){const e=Number(p.estoque)||0,m=Number(p.minimo)||0;if(p.ativo===false)return '<span class="pill off">Inativo</span>';if(e<=0)return '<span class="pill bad">Zerado</span>';if(e<=m)return '<span class="pill warn">Baixo</span>';return '<span class="pill ok">OK</span>'}
const ativos=()=>S.produtos.filter(p=>p.ativo!==false);
const porCodigo=c=>S.produtos.find(p=>(p.codigo||'').toUpperCase()===c.toUpperCase());
const itensDe=v=>v.venda_itens||[];

/* ---------- PDV ---------- */
V.pdv={
 mount(m){
  m.innerHTML=`<div class="pdv">
  <section class="panel stack" aria-label="Produtos">
    <div class="row" style="justify-content:space-between;align-items:center"><h2>Nova venda</h2><span class="muted small">Digite o código e aperte Enter</span></div>
    <form class="scan" id="scan"><input id="code" class="code-in" placeholder="CÓDIGO" autocomplete="off" autocapitalize="characters" aria-label="Código do produto"><input id="qty" class="qty-in num" type="number" min="1" value="1" inputmode="numeric" aria-label="Quantidade"><button class="btn p" type="submit">Adicionar</button></form>
    <div id="scan-msg"></div>
    <input id="busca" class="i" placeholder="Ou procure pelo nome…" aria-label="Buscar produto">
    <div class="catbar" id="cats"></div>
    <div id="pgrid"></div>
  </section>
  <aside class="panel stack cart" aria-label="Carrinho">
    <div class="row" style="justify-content:space-between;align-items:center"><h2>Carrinho</h2><button class="btn sm" id="limpar">Limpar</button></div>
    <div id="clines"></div>
    <div class="stack" style="gap:6px"><label class="f" for="cli">Cliente <span style="text-transform:none;letter-spacing:0;font-weight:500">(opcional · funcionário tem desconto)</span></label><div class="row" style="flex-wrap:nowrap;align-items:center"><select class="i grow" id="cli"></select><button class="btn sm" type="button" id="novocli">+ Novo</button></div><div id="cli-info"></div></div>
    <div id="cdesc" class="stack" style="gap:4px"></div>
    <div class="total"><span class="muted">Total</span><b class="money" id="ctotal">R$ 0,00</b></div>
    <div><h3 style="margin-bottom:6px">Pagamento</h3><div class="pays" id="pays" style="grid-template-columns:repeat(auto-fit,minmax(84px,1fr))"></div></div>
    <div id="troco-wrap" hidden><div class="row"><label class="f grow">Valor recebido<input class="i num" id="recebido" inputmode="decimal" placeholder="0,00"></label><div class="grow"><span class="muted small">Troco</span><div id="troco" class="money" style="font-family:var(--f-display);font-size:1.6rem">R$ 0,00</div></div></div></div>
    <button class="btn p finish" id="finalizar">Finalizar venda</button>
  </aside></div><button class="gocart" id="gocart" hidden></button>`;
  $('#scan').onsubmit=e=>{e.preventDefault();const c=$('#code').value.trim();if(!c)return;const p=porCodigo(c);const q=Math.max(1,parseInt($('#qty').value)||1);
    if(!p||p.ativo===false){$('#scan-msg').innerHTML=`<div class="banner bad">Nenhum produto ativo com o código <b>${esc(c.toUpperCase())}</b>. Confira o código ou procure pelo nome.</div>`;$('#code').select();return}
    if(this.add(p,q)){$('#code').value='';$('#qty').value=1;$('#scan-msg').innerHTML=''}$('#code').focus()};
  $('#busca').oninput=e=>{S.busca=e.target.value;this.grid()};
  $('#limpar').onclick=()=>{S.cart=[];this.cartR()};
  $('#pays').innerHTML=PAGS_PDV.map(p=>`<button class="pay" data-p="${p}" aria-pressed="${S.pag===p}">${PAG_LABEL[p]||p}</button>`).join('');
  $('#pays').onclick=e=>{const b=e.target.closest('.pay');if(!b)return;S.pag=b.dataset.p;document.querySelectorAll('.pay').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#troco-wrap').hidden=S.pag!=='Dinheiro';this.cartR()};
  $('#troco-wrap').hidden=S.pag!=='Dinheiro';
  $('#recebido').oninput=()=>this.troco();
  $('#finalizar').onclick=()=>this.finalizar();
  $('#gocart').onclick=()=>$('.cart').scrollIntoView({behavior:'smooth'});
  $('#cli').onchange=e=>{S.cliente=e.target.value;this.cartR()};
  $('#novocli').onclick=()=>novoCliente(c=>{S.cliente=c.id;this.cliSel();this.cartR()});
  this.refresh();
  if(window.matchMedia('(pointer:fine)').matches)$('#code').focus();
 },
 refresh(){this.cats();this.grid();this.cliSel();this.cartR()},
 cliSel(){const el=$('#cli');if(!el)return;const at=S.clientes.filter(c=>c.ativo!==false);if(S.cliente&&!at.some(c=>c.id===S.cliente))S.cliente='';el.innerHTML='<option value="">— Sem cliente —</option>'+at.map(c=>`<option value="${c.id}" ${S.cliente===c.id?'selected':''}>${esc(c.nome)} · ${esc(c.tipo)}</option>`).join('')},
 pct(){const c=S.clientes.find(x=>x.id===S.cliente);return c&&c.tipo==='Funcionário'?S.descFunc:0},
 unit(p){return Math.round(Number(p.preco)*(1-this.pct()/100)*100)/100},
 sub(){return S.cart.reduce((s,c)=>{const p=S.produtos.find(x=>x.id===c.id);return s+(p?Number(p.preco)*c.qtd:0)},0)},
 info(){const pct=this.pct(),sub=this.sub(),tot=this.total();const d=$('#cdesc');if(d)d.innerHTML=pct&&S.cart.length?`<div class="row" style="justify-content:space-between"><span class="muted">Subtotal</span><span class="money">${brl(sub)}</span></div><div class="row" style="justify-content:space-between;color:var(--ok);font-weight:600"><span>Desconto funcionário ${pct}%</span><span class="money">− ${brl(sub-tot)}</span></div>`:'';
  const c=S.clientes.find(x=>x.id===S.cliente);const s=c&&S.saldos[c.id];const sal=s?Number(s.saldo):0;const ci=$('#cli-info');if(!ci)return;
  ci.innerHTML=c?`<div class="small muted">${c.tipo==='Funcionário'?`<span class="pill ok">${S.descFunc}% de desconto</span> `:''}${sal>0.004?`Conta em aberto: <b style="color:var(--bad)">${brl(sal)}</b>`:'Nada em aberto'}${c.limite!=null?` · limite ${brl(c.limite)}`:''}</div>`:(S.pag==='Conta'?'<div class="small" style="color:var(--bad);font-weight:600">Para pendurar, escolha o cliente acima.</div>':'')},
 cats(){const el=$('#cats');if(!el)return;const cs=['Todos',...CATS.filter(c=>ativos().some(p=>p.categoria===c))];el.innerHTML=cs.map(c=>`<button class="catbtn" data-c="${esc(c)}" aria-pressed="${S.cat===c}">${esc(c)}</button>`).join('');el.onclick=e=>{const b=e.target.closest('.catbtn');if(!b)return;S.cat=b.dataset.c;this.cats();this.grid()}},
 grid(){const el=$('#pgrid');if(!el)return;
  if(!S.prodLoaded){el.innerHTML='<div class="empty">Carregando produtos…</div>';return}
  if(!ativos().length){el.innerHTML=`<div class="empty"><b>Nenhum produto cadastrado</b>${isG()?'Cadastre os produtos na aba Produtos. Cada um ganha um código para a baixa automática.':'A gerente precisa cadastrar os produtos antes das vendas.'}</div>`;return}
  const q=S.busca.trim().toLowerCase();const ps=ativos().filter(p=>(S.cat==='Todos'||p.categoria===S.cat)&&(!q||p.nome.toLowerCase().includes(q)||(p.codigo||'').toLowerCase().includes(q)));
  el.innerHTML=ps.length?`<div class="pgrid">${ps.map(p=>`<button class="pcard${(p.estoque||0)<=0?' zero':''}" data-id="${p.id}"><span class="code">${esc(p.codigo)}</span><span class="nm">${esc(p.nome)}</span><span class="ft"><b class="money">${brl(p.preco)}</b><span class="muted num">${Number(p.estoque)||0} un</span></span></button>`).join('')}</div>`:'<div class="empty">Nenhum produto encontrado com essa busca.</div>';
  el.onclick=e=>{const b=e.target.closest('.pcard');if(!b)return;const p=S.produtos.find(x=>x.id===b.dataset.id);p&&this.add(p,1)}},
 add(p,q){const noCart=S.cart.filter(c=>c.id===p.id).reduce((s,c)=>s+c.qtd,0);const est=Number(p.estoque)||0;
  if(noCart+q>est){toast(est<=0?`${p.nome} está sem estoque.`:`Só há ${est} un de ${p.nome} no estoque.`,true);return false}
  const l=S.cart.find(c=>c.id===p.id);if(l)l.qtd+=q;else S.cart.push({id:p.id,qtd:q});this.cartR();return true},
 cartR(){const el=$('#clines');if(!el)return;S.cart=S.cart.filter(c=>S.produtos.some(p=>p.id===c.id));
  if(!S.cart.length)el.innerHTML='<div class="empty" style="padding:18px">Carrinho vazio. Digite um código ou toque num produto.</div>';
  else el.innerHTML=S.cart.map((c,i)=>{const p=S.produtos.find(x=>x.id===c.id);return `<div class="cline"><div><div class="nm">${esc(p.nome)}</div><span class="muted small"><span class="code" style="font-size:.78rem">${esc(p.codigo)}</span> ${brl(this.unit(p))} un</span></div><div class="stepper"><button data-a="-" data-i="${i}" aria-label="Diminuir">−</button><span class="num">${c.qtd}</span><button data-a="+" data-i="${i}" aria-label="Aumentar">+</button></div><b class="money">${brl(this.unit(p)*c.qtd)}</b></div>`}).join('');
  el.onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const c=S.cart[+b.dataset.i];const p=S.produtos.find(x=>x.id===c.id);if(b.dataset.a==='+'){if(c.qtd+1>(Number(p.estoque)||0)){toast(`Só há ${p.estoque} un de ${p.nome} no estoque.`,true);return}c.qtd++}else{c.qtd--;if(c.qtd<=0)S.cart.splice(+b.dataset.i,1)}this.cartR()};
  $('#ctotal').textContent=brl(this.total());this.info();const gc=$('#gocart');if(gc){const n=S.cart.reduce((a,c)=>a+c.qtd,0);gc.hidden=!n;gc.textContent=`Ver carrinho · ${n} ${n===1?'item':'itens'} · ${brl(this.total())}`}$('#finalizar').disabled=!S.cart.length||(S.pag==='Conta'&&!S.cliente);this.troco()},
 total(){return Math.round(S.cart.reduce((s,c)=>{const p=S.produtos.find(x=>x.id===c.id);return s+(p?this.unit(p)*c.qtd:0)},0)*100)/100},
 troco(){const el=$('#troco');if(!el)return;const r=num($('#recebido').value);const t=r-this.total();el.textContent=r?brl(Math.max(0,t)):'R$ 0,00';el.style.color=r&&t<0?'var(--bad)':''},
 async finalizar(){if(!S.cart.length)return;const btn=$('#finalizar');
  const rec=S.pag==='Dinheiro'?num($('#recebido').value):0;
  if(rec&&rec<this.total()){toast('O valor recebido é menor que o total.',true);return}
  btn.disabled=true;btn.textContent='Registrando…';const total=this.total();
  const {error}=await S.sb.rpc('registrar_venda',{p_itens:S.cart.map(c=>({produto_id:c.id,qtd:c.qtd})),p_pagamento:S.pag,p_recebido:rec||null,p_cliente:S.cliente||null});
  if(error){toast(erroMsg(error),true);await loadProdutos().catch(()=>{});}
  else{const cn=(S.clientes.find(x=>x.id===S.cliente)||{}).nome;S.cart=[];const rc=$('#recebido');if(rc)rc.value='';toast(S.pag==='Conta'?`Pendurado na conta de ${cn}: ${brl(total)}. Estoque atualizado.`:`Venda registrada: ${brl(total)} no ${S.pag}. Estoque atualizado.`);S.cliente='';if(S.pag==='Conta'){S.pag='Pix';document.querySelectorAll('.pay').forEach(x=>x.setAttribute('aria-pressed',x.dataset.p==='Pix'))}await Promise.all([loadProdutos(),loadHoje(),loadClientes()]).catch(()=>{})}
  btn.textContent='Finalizar venda';this.refresh();$('#code')&&window.matchMedia('(pointer:fine)').matches&&$('#code').focus()}
};

/* ---------- CONTAS (clientes, pendura e recebimentos) ---------- */
const saldoDe=id=>{const s=S.saldos[id];return s?Number(s.saldo):0};
const foneDig=t=>{let d=String(t||'').replace(/\D/g,'');if(d.length>=10&&d.length<=11)d='55'+d;return d.length>=12?d:''};
function formCliente(c){return `<label class="f">Nome<input class="i" id="cn" required value="${esc(c?c.nome:'')}" placeholder="Ex.: Jorge Silveira"></label>
 <div class="row"><label class="f grow">Celular (WhatsApp)<input class="i" id="ct" inputmode="tel" value="${esc(c?c.telefone:'')}" placeholder="11 99999-9999"></label><label class="f grow">Tipo<select class="i" id="cty">${TIPOS.map(t=>`<option ${(c?c.tipo:'Funcionário')===t?'selected':''}>${t}</option>`).join('')}</select></label></div>
 <label class="f">Limite da conta (R$) <span style="text-transform:none;letter-spacing:0;font-weight:500">deixe vazio para sem limite</span><input class="i num" id="cl" inputmode="decimal" value="${c&&c.limite!=null?String(c.limite).replace('.',','):''}" placeholder="sem limite"></label>
 <p class="muted small" style="margin:0" id="cdica"></p>`}
function dadosForm(m){const nome=m.querySelector('#cn').value.trim();const lim=m.querySelector('#cl').value.trim();return {nome,telefone:m.querySelector('#ct').value.trim(),tipo:m.querySelector('#cty').value,limite:lim?Math.round(num(lim)*100)/100:null}}
function dicaTipo(m){const t=m.querySelector('#cty').value;m.querySelector('#cdica').textContent=t==='Funcionário'?`Funcionário ganha ${S.descFunc}% de desconto em todos os produtos.`:'Sem desconto. Pode comprar e pendurar na conta.'}
function novoCliente(cb){modal(`<h2>Novo cliente</h2><form class="stack" id="ncf">${formCliente(null)}<div id="ncm"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-x>Voltar</button><button class="btn p" type="submit">Cadastrar</button></div></form>`,(m,close)=>{
  dicaTipo(m);m.querySelector('#cty').onchange=()=>dicaTipo(m);m.querySelector('[data-x]').onclick=close;m.querySelector('#cn').focus();
  m.querySelector('#ncf').onsubmit=async e=>{e.preventDefault();const d=dadosForm(m);if(!d.nome){m.querySelector('#ncm').innerHTML='<div class="banner bad">Digite o nome.</div>';return}
   const {data,error}=await S.sb.from('clientes').insert(d).select().single();if(error){m.querySelector('#ncm').innerHTML=`<div class="banner bad">${esc(erroMsg(error))}</div>`;return}
   await loadClientes();close();toast(`${d.nome} cadastrado.`);cb&&cb(data);refreshView()}})}
function editarCliente(c){modal(`<h2>Editar cliente</h2><form class="stack" id="ecf">${formCliente(c)}<label class="row" style="align-items:center;gap:8px"><input type="checkbox" id="cat" ${c.ativo!==false?'checked':''}> Cliente ativo (aparece na tela de vendas)</label><div id="ecm"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-x>Voltar</button><button class="btn p" type="submit">Salvar</button></div></form>`,(m,close)=>{
  dicaTipo(m);m.querySelector('#cty').onchange=()=>dicaTipo(m);m.querySelector('[data-x]').onclick=close;
  m.querySelector('#ecf').onsubmit=async e=>{e.preventDefault();const d=dadosForm(m);d.ativo=m.querySelector('#cat').checked;if(!d.nome)return;
   const {error}=await S.sb.from('clientes').update(d).eq('id',c.id);if(error){m.querySelector('#ecm').innerHTML=`<div class="banner bad">${esc(erroMsg(error))}</div>`;return}
   await loadClientes();close();toast('Cliente atualizado.');refreshView()}})}
function receberConta(c,after){const sal=saldoDe(c.id);modal(`<h2>Receber de ${esc(c.nome)}</h2><p style="margin:0">Em aberto: <b class="money">${brl(sal)}</b></p><form class="stack" id="rcf">
 <div class="row"><label class="f grow">Valor recebido (R$)<input class="i num" id="rv" inputmode="decimal" value="${sal>0?sal.toFixed(2).replace('.',','):''}" required></label><label class="f grow">Forma<select class="i" id="rf">${PAGS.map(p=>`<option>${p}</option>`).join('')}</select></label></div>
 <label class="f">Observação<input class="i" id="ro" placeholder="Ex.: acerto do mês, desconto em folha"></label><div id="rcm"></div>
 <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-x>Voltar</button><button class="btn p" type="submit">Registrar pagamento</button></div></form>`,(m,close)=>{
  m.querySelector('[data-x]').onclick=close;const v=m.querySelector('#rv');v.focus();v.select();
  m.querySelector('#rcf').onsubmit=async e=>{e.preventDefault();const val=Math.round(num(v.value)*100)/100;if(val<=0){m.querySelector('#rcm').innerHTML='<div class="banner bad">Informe um valor maior que zero.</div>';return}
   const {error}=await S.sb.rpc('receber_conta',{p_cliente:c.id,p_valor:val,p_forma:m.querySelector('#rf').value,p_obs:m.querySelector('#ro').value.trim()});
   if(error){m.querySelector('#rcm').innerHTML=`<div class="banner bad">${esc(erroMsg(error))}</div>`;return}
   await loadClientes();close();const rest=saldoDe(c.id);toast(rest>0.004?`Recebido ${brl(val)}. Ainda faltam ${brl(rest)}.`:`Recebido ${brl(val)}. Conta de ${c.nome} quitada.`);after&&after();refreshView()}})}
async function extrato(c){
  const [v,p]=await Promise.all([S.sb.from('vendas').select('*, venda_itens(*)').eq('cliente_id',c.id).eq('pagamento','Conta').order('criado_em',{ascending:false}).limit(200),S.sb.from('pagamentos_conta').select('*').eq('cliente_id',c.id).order('criado_em',{ascending:false}).limit(200)]);
  if(v.error||p.error)return toast(erroMsg(v.error||p.error),true);
  const mov=[...v.data.map(x=>({t:x.criado_em,tipo:'compra',x})),...p.data.map(x=>({t:x.criado_em,tipo:'pag',x}))].sort((a,b)=>a.t<b.t?1:-1);
  const sal=saldoDe(c.id);const fone=foneDig(c.telefone);const prim=(c.nome||'').split(' ')[0];
  const msgW=`Oi ${prim}, tudo bem? Aqui é da lojinha da SkyFit Campo Limpo Paulista. Sua conta no Ninho da Águia está com ${brl(sal)} em aberto. Você pode acertar na recepção no Pix, dinheiro ou cartão. Obrigado!`;
  modal(`<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>${esc(c.nome)}</h2><span class="muted small">${esc(c.tipo)}${c.telefone?' · '+esc(c.telefone):''}${c.limite!=null?' · limite '+brl(c.limite):''}</span></div><button class="btn sm" data-x>Fechar</button></div>
  <div class="kpis"><div class="kpi"><small>Em aberto</small><b class="money" style="color:${sal>0.004?'var(--bad)':'var(--ok)'}">${brl(sal)}</b></div></div>
  <div class="row"><button class="btn p" data-rec>Receber pagamento</button>${fone?`<a class="btn" style="text-decoration:none;color:inherit" href="https://wa.me/${fone}?text=${encodeURIComponent(msgW)}" target="_blank" rel="noopener">Cobrar no WhatsApp</a>`:''}${isG()?'<button class="btn" data-ed>Editar cliente</button>':''}</div>
  <h3>Movimentação</h3>${mov.length?`<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th class="n">Valor</th>${isG()?'<th></th>':''}</tr></thead><tbody>${mov.map(m=>m.tipo==='compra'?`<tr class="${m.x.cancelada?'cancel':''}"><td class="num">${fmtDia(m.x.dia)} ${hora(m.x.criado_em)}</td><td>${itensDe(m.x).map(i=>`${i.qtd}× ${esc(i.nome)}`).join(', ')}${Number(m.x.desconto)>0?` <span class="muted small">(desc. ${brl(m.x.desconto)})</span>`:''}${m.x.cancelada?' <span class="pill off">Cancelada</span>':''}</td><td class="n money" style="color:var(--bad)">+ ${brl(m.x.total)}</td>${isG()?'<td></td>':''}</tr>`:`<tr class="${m.x.estornado?'cancel':''}"><td class="num">${fmtDia(m.x.dia)} ${hora(m.x.criado_em)}</td><td>Pagamento · ${esc(m.x.forma)}${m.x.obs?` <span class="muted small">${esc(m.x.obs)}</span>`:''}<div class="muted small">recebido por ${esc(m.x.operador_nome)}</div></td><td class="n money" style="color:var(--ok)">− ${brl(m.x.valor)}</td>${isG()?`<td class="n">${m.x.estornado?'<span class="pill off">Estornado</span>':`<button class="btn sm d" data-est="${m.x.id}">Estornar</button>`}</td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma compra pendurada ainda.</div>'}`,(m,close)=>{
   m.querySelector('[data-x]').onclick=close;
   m.querySelector('[data-rec]').onclick=()=>{close();receberConta(c,()=>extrato(c))};
   const ed=m.querySelector('[data-ed]');if(ed)ed.onclick=()=>{close();editarCliente(c)};
   m.addEventListener('click',e=>{const b=e.target.closest('[data-est]');if(!b)return;close();confirmBox('Estornar este pagamento? O valor volta a ficar em aberto na conta.','Estornar',async()=>{const {error}=await S.sb.rpc('estornar_pagamento',{p_pagamento:b.dataset.est});if(error)return toast(erroMsg(error),true);await loadClientes();toast('Pagamento estornado.');refreshView();extrato(c)})});
  });
  const md=document.querySelector('.modal');if(md)md.style.maxWidth='760px';
}
V.contas={f:'abertas',q:'',
 mount(m){m.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between;align-items:center"><h2>Contas em aberto</h2><button class="btn p" id="ncli">+ Novo cliente</button></div>
  <div class="kpis" id="ck"></div>
  <section class="panel stack"><div class="row"><input class="i grow" id="cq" placeholder="Buscar cliente" value="${esc(this.q)}"><div class="seg" id="cf"><button data-f="abertas" aria-pressed="${this.f==='abertas'}">Com saldo</button><button data-f="func" aria-pressed="${this.f==='func'}">Funcionários</button><button data-f="todos" aria-pressed="${this.f==='todos'}">Todos</button></div></div><div id="ct"></div></section>
  <p class="muted small" style="margin:0">Para pendurar: na tela Vender, escolha o cliente e a forma <b>Pendurar</b>. Funcionário ganha ${S.descFunc}% de desconto automático em qualquer forma de pagamento.</p></div>`;
  $('#ncli').onclick=()=>novoCliente();$('#cq').oninput=e=>{this.q=e.target.value;this.refresh()};
  $('#cf').onclick=e=>{const b=e.target.closest('button');if(!b)return;this.f=b.dataset.f;document.querySelectorAll('#cf button').forEach(x=>x.setAttribute('aria-pressed',x===b));this.refresh()};
  this.refresh()},
 refresh(){const el=$('#ct');if(!el)return;
  const tot=S.clientes.reduce((s,c)=>s+Math.max(0,saldoDe(c.id)),0),dev=S.clientes.filter(c=>saldoDe(c.id)>0.004).length,rec=S.pagHoje.filter(p=>!p.estornado).reduce((s,p)=>s+Number(p.valor),0);
  $('#ck').innerHTML=`<div class="kpi"><small>Total a receber</small><b class="money" style="color:${tot>0?'var(--warn)':''}">${brl(tot)}</b></div><div class="kpi"><small>Clientes devendo</small><b>${dev}</b></div><div class="kpi"><small>Recebido hoje</small><b class="money" style="color:var(--ok)">${brl(rec)}</b></div><div class="kpi"><small>Clientes cadastrados</small><b>${S.clientes.length}</b></div>`;
  const q=this.q.trim().toLowerCase();let cs=S.clientes.filter(c=>(!q||c.nome.toLowerCase().includes(q)||(c.telefone||'').includes(q)));
  if(this.f==='abertas')cs=cs.filter(c=>saldoDe(c.id)>0.004);if(this.f==='func')cs=cs.filter(c=>c.tipo==='Funcionário');
  cs.sort((a,b)=>saldoDe(b.id)-saldoDe(a.id)||a.nome.localeCompare(b.nome,'pt-BR'));
  if(!S.clientes.length){el.innerHTML='<div class="empty"><b>Nenhum cliente cadastrado</b>Cadastre funcionários e alunos que compram para acertar depois. Toque em "+ Novo cliente".</div>';return}
  if(!cs.length){el.innerHTML=`<div class="empty">${this.f==='abertas'?'Ninguém está devendo agora.':'Nenhum cliente encontrado.'}</div>`;return}
  el.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th>Tipo</th><th class="n">Em aberto</th><th class="n">Limite</th><th>Última compra</th><th></th></tr></thead><tbody>${cs.map(c=>{const s=S.saldos[c.id]||{};const sal=saldoDe(c.id);const pct=c.limite?sal/Number(c.limite):0;return `<tr${c.ativo===false?' style="opacity:.55"':''}><td><b>${esc(c.nome)}</b>${c.telefone?`<div class="muted small">${esc(c.telefone)}</div>`:''}</td><td>${c.tipo==='Funcionário'?`<span class="pill ok">Funcionário · ${S.descFunc}%</span>`:esc(c.tipo)}</td><td class="n money" style="color:${sal>0.004?'var(--bad)':'var(--muted)'}"><b>${brl(sal)}</b></td><td class="n">${c.limite!=null?`<span class="money">${brl(c.limite)}</span>${pct>=.8?' <span class="pill warn">perto</span>':''}`:'<span class="muted">—</span>'}</td><td class="num">${s.ultima_compra?fmtDia(String(s.ultima_compra).slice(0,10)):'<span class="muted">—</span>'}</td><td class="n" style="white-space:nowrap"><button class="btn sm" data-ver="${c.id}">Extrato</button> <button class="btn sm p" data-rec="${c.id}" ${sal>0.004?'':'disabled'}>Receber</button></td></tr>`}).join('')}</tbody></table></div>`;
  el.onclick=e=>{const v=e.target.closest('[data-ver]'),r=e.target.closest('[data-rec]');if(v)extrato(S.clientes.find(x=>x.id===v.dataset.ver));if(r&&!r.disabled)receberConta(S.clientes.find(x=>x.id===r.dataset.rec))}}};

/* ---------- VENDAS DE HOJE ---------- */
function resumoPag(vs){const r={};PAGS_PDV.forEach(p=>r[p]=0);vs.forEach(v=>r[v.pagamento]=(r[v.pagamento]||0)+Number(v.total));return r}
function listaVendas(vs,podeCancelar){if(!vs.length)return '<div class="empty"><b>Nenhuma venda</b>As vendas aparecem aqui assim que são finalizadas.</div>';
 return `<div class="tbl-wrap"><table><thead><tr><th>Hora</th>${podeCancelar?'<th>Dia</th>':''}<th>Itens</th><th>Pagamento</th><th>Vendido por</th><th class="n">Total</th>${podeCancelar?'<th></th>':''}</tr></thead><tbody>${vs.map(v=>`<tr class="${v.cancelada?'cancel':''}"><td class="num">${hora(v.criado_em)}</td>${podeCancelar?`<td class="num">${fmtDia(v.dia)}</td>`:''}<td>${itensDe(v).map(i=>`${i.qtd}× ${esc(i.nome)}`).join('<br>')}</td><td>${esc(v.pagamento==='Conta'?'Pendurado':v.pagamento)}${v.cliente_nome?`<div class="muted small">${esc(v.cliente_nome)}${Number(v.desconto)>0?` · desconto ${brl(v.desconto)}`:''}</div>`:''}</td><td>${esc(v.operador_nome)}</td><td class="n money">${brl(v.total)}</td>${podeCancelar?`<td class="n">${v.cancelada?'<span class="pill off">Cancelada</span>':`<button class="btn sm d" data-cancel="${v.id}">Cancelar</button>`}</td>`:''}</tr>`).join('')}</tbody></table></div>`}
V.caixa={mount(m){m.innerHTML='<div class="stack" id="cx"></div>';this.refresh()},refresh(){const el=$('#cx');if(!el)return;const vs=S.hoje.filter(v=>!v.cancelada);const t=vs.reduce((s,v)=>s+Number(v.total),0);const rp=resumoPag(vs);
 const pg=S.pagHoje.filter(p=>!p.estornado);const rc={};PAGS.forEach(p=>rc[p]=0);pg.forEach(p=>rc[p.forma]=(rc[p.forma]||0)+Number(p.valor));const totRec=pg.reduce((s,p)=>s+Number(p.valor),0);
 el.innerHTML=`<h2>Vendas de hoje · ${fmtDia(hoje())}</h2>
 <div class="kpis"><div class="kpi"><small>Total vendido</small><b class="money">${brl(t)}</b></div><div class="kpi"><small>Vendas</small><b>${vs.length}</b></div><div class="kpi"><small>Pendurado hoje</small><b class="money" style="color:var(--warn)">${brl(rp.Conta)}</b></div><div class="kpi"><small>Contas recebidas</small><b class="money" style="color:var(--ok)">${brl(totRec)}</b></div></div>
 <section class="panel stack"><h3>Fechamento do caixa</h3><div class="tbl-wrap"><table><thead><tr><th>Forma</th><th class="n">Vendas</th><th class="n">Contas recebidas</th><th class="n">Total no caixa</th></tr></thead><tbody>${PAGS.map(p=>`<tr><td>${p}</td><td class="n money">${brl(rp[p])}</td><td class="n money">${brl(rc[p])}</td><td class="n money"><b>${brl(rp[p]+rc[p])}</b></td></tr>`).join('')}<tr><td><b>Total</b></td><td class="n money">${brl(t-rp.Conta)}</td><td class="n money">${brl(totRec)}</td><td class="n money"><b>${brl(t-rp.Conta+totRec)}</b></td></tr></tbody></table></div><p class="muted small" style="margin:0">Vendas penduradas não entram no caixa; entram quando o cliente paga.</p></section>
 <section class="panel stack"><h3>Lançamentos</h3>${listaVendas(S.hoje,false)}</section>`}};

/* ---------- ESTOQUE ---------- */
V.estoque={mount(m){m.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between;align-items:center"><h2>Estoque</h2><span class="muted small">Atualiza sozinho a cada venda</span></div><div id="est-k" class="kpis"></div><section class="panel stack"><div class="row"><input class="i grow" id="eb" placeholder="Buscar por nome ou código" value="${esc(S.estBusca)}"><select class="i" id="ec" style="width:auto">${['Todos',...CATS].map(c=>`<option ${S.estCat===c?'selected':''}>${c}</option>`).join('')}</select></div><div id="et"></div></section></div>`;
 $('#eb').oninput=e=>{S.estBusca=e.target.value;this.refresh()};$('#ec').onchange=e=>{S.estCat=e.target.value;this.refresh()};this.refresh()},
 refresh(){const el=$('#et');if(!el)return;const at=ativos();const ps=isG()?S.produtos:at;
  const baixo=at.filter(p=>(Number(p.estoque)||0)>0&&(Number(p.estoque)||0)<=(Number(p.minimo)||0)).length,zero=at.filter(p=>(Number(p.estoque)||0)<=0).length;
  const valor=at.reduce((s,p)=>s+(Number(p.estoque)||0)*(Number(p.custo)||0),0),un=at.reduce((s,p)=>s+(Number(p.estoque)||0),0);
  $('#est-k').innerHTML=`<div class="kpi"><small>Produtos ativos</small><b>${at.length}</b></div><div class="kpi"><small>Unidades em estoque</small><b class="num">${un}</b></div><div class="kpi"><small>Estoque baixo</small><b style="color:${baixo?'var(--warn)':''}">${baixo}</b></div><div class="kpi"><small>Zerados</small><b style="color:${zero?'var(--bad)':''}">${zero}</b></div>${isG()?`<div class="kpi"><small>Valor em estoque (custo)</small><b class="money">${brl(valor)}</b></div>`:''}`;
  if(!S.prodLoaded){el.innerHTML='<div class="empty">Carregando…</div>';return}
  if(!S.produtos.length){el.innerHTML=`<div class="empty"><b>Estoque vazio</b>${isG()?'Cadastre o primeiro produto na aba Produtos.':'A gerente ainda não cadastrou produtos.'}</div>`;return}
  const q=S.estBusca.trim().toLowerCase();const f=ps.filter(p=>(S.estCat==='Todos'||p.categoria===S.estCat)&&(!q||p.nome.toLowerCase().includes(q)||(p.codigo||'').toLowerCase().includes(q)));
  el.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th class="n">Preço</th><th class="n">Estoque</th><th class="n">Mínimo</th><th>Situação</th>${isG()?'<th></th>':''}</tr></thead><tbody>${f.map(p=>`<tr><td><span class="code">${esc(p.codigo)}</span></td><td>${esc(p.nome)}</td><td>${esc(p.categoria)}</td><td class="n money">${brl(p.preco)}</td><td class="n num"><b>${Number(p.estoque)||0}</b></td><td class="n num">${Number(p.minimo)||0}</td><td>${stPill(p)}</td>${isG()?`<td class="n"><button class="btn sm" data-ent="${p.id}">Entrada</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
  el.onclick=e=>{const b=e.target.closest('[data-ent]');if(b){S.entPid=b.dataset.ent;irPara('entradas')}}}};

/* ---------- PRODUTOS (gerente) ---------- */
function sugereCodigo(cat){const pre=PREF[cat]||'PRD';let n=1;const usados=new Set(S.produtos.map(p=>(p.codigo||'').toUpperCase()));while(usados.has(pre+pad(n)))n++;return pre+pad(n)}
V.produtos={mount(m){m.innerHTML=`<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)"><section class="panel stack" id="pf"></section><section class="panel stack"><div class="row" style="justify-content:space-between;align-items:center"><h2>Produtos cadastrados</h2><span class="muted small" id="pcount"></span></div><div id="pl"></div></section></div>`;this.form();this.refresh()},
 form(){const p=S.editId?S.produtos.find(x=>x.id===S.editId):null;const cat=p?p.categoria:'Whey';
  $('#pf').innerHTML=`<h2>${p?'Editar produto':'Novo produto'}</h2><form class="stack" id="pform">
  <label class="f">Nome do produto<input class="i" id="pn" required placeholder="Ex.: Whey Protein Baunilha 900g" value="${esc(p?p.nome:'')}"></label>
  <div class="row"><label class="f grow">Categoria<select class="i" id="pc">${CATS.map(c=>`<option ${c===cat?'selected':''}>${c}</option>`).join('')}</select></label><label class="f grow">Código<input class="i" id="pcod" required autocapitalize="characters" style="text-transform:uppercase;font-family:var(--f-display);letter-spacing:.06em" value="${esc(p?p.codigo:sugereCodigo(cat))}"></label></div>
  <div class="row"><label class="f grow">Preço de venda (R$)<input class="i num" id="pp" inputmode="decimal" required placeholder="0,00" value="${p?String(p.preco).replace('.',','):''}"></label><label class="f grow">Custo (R$)<input class="i num" id="pcu" inputmode="decimal" placeholder="0,00" value="${p&&Number(p.custo)?String(p.custo).replace('.',','):''}"></label></div>
  <div class="row">${p?'':`<label class="f grow">Estoque inicial<input class="i num" id="pe" type="number" min="0" value="0" inputmode="numeric"></label>`}<label class="f grow">Avisar quando tiver até<input class="i num" id="pm" type="number" min="0" inputmode="numeric" value="${p?Number(p.minimo)||0:3}"></label></div>
  ${p?'<p class="muted small" style="margin:0">Para mudar a quantidade em estoque, use a aba Entradas.</p>':''}
  <div id="pmsg"></div><div class="row"><button class="btn p" type="submit">${p?'Salvar alterações':'Cadastrar produto'}</button>${p?'<button class="btn" type="button" id="pcancel">Cancelar edição</button>':''}</div></form>`;
  $('#pc').onchange=e=>{if(!p)$('#pcod').value=sugereCodigo(e.target.value)};
  if(p)$('#pcancel').onclick=()=>{S.editId=null;this.form()};
  $('#pform').onsubmit=async e=>{e.preventDefault();const cod=$('#pcod').value.trim().toUpperCase().replace(/\s+/g,'');const nome=$('#pn').value.trim();const preco=num($('#pp').value);
   const msg=t=>$('#pmsg').innerHTML=`<div class="banner bad">${esc(t)}</div>`;
   if(!nome)return msg('Digite o nome do produto.');if(!/^[A-Z0-9-]{2,12}$/.test(cod))return msg('O código deve ter de 2 a 12 letras ou números, sem espaços nem acentos.');if(preco<=0)return msg('Informe o preço de venda.');
   const dup=S.produtos.find(x=>(x.codigo||'').toUpperCase()===cod&&x.id!==(p&&p.id));if(dup)return msg(`O código ${cod} já é usado por ${dup.nome}.`);
   const base={nome,categoria:$('#pc').value,codigo:cod,preco:Math.round(preco*100)/100,custo:Math.round(num($('#pcu').value)*100)/100,minimo:Math.max(0,parseInt($('#pm').value)||0),atualizado_em:new Date().toISOString()};
   try{
     if(p){const {error}=await S.sb.from('produtos').update(base).eq('id',p.id);if(error)throw error;toast('Produto atualizado.');S.editId=null}
     else{const est=Math.max(0,parseInt($('#pe').value)||0);const {data,error}=await S.sb.from('produtos').insert({...base,estoque:0}).select().single();if(error)throw error;
       if(est>0){const r=await S.sb.rpc('lancar_estoque',{p_produto:data.id,p_tipo:'Estoque inicial',p_qtd:est,p_custo:base.custo||null,p_obs:''});if(r.error)throw r.error}
       toast(`${nome} cadastrado com o código ${cod}.`)}
     await loadProdutos();this.form();this.refresh()}catch(err){msg(erroMsg(err))}};
 },
 refresh(){const el=$('#pl');if(!el)return;$('#pcount').textContent=S.produtos.length?`${S.produtos.length} no total`:'';
  if(!S.produtos.length){el.innerHTML='<div class="empty"><b>Nenhum produto ainda</b>Use o formulário. Sugestão de códigos: WHEY01, CREA01, PRE01, GEL01, BAR01, BEB01.</div>';return}
  el.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th class="n">Preço</th><th class="n">Custo</th><th class="n">Margem</th><th></th></tr></thead><tbody>${S.produtos.map(p=>{const mg=Number(p.preco)&&Number(p.custo)?Math.round((1-p.custo/p.preco)*100)+'%':'–';return `<tr${p.ativo===false?' style="opacity:.55"':''}><td><span class="code">${esc(p.codigo)}</span></td><td>${esc(p.nome)}<div class="muted small">${esc(p.categoria)}${p.ativo===false?' · inativo':''}</div></td><td class="n money">${brl(p.preco)}</td><td class="n money">${Number(p.custo)?brl(p.custo):'–'}</td><td class="n num">${mg}</td><td class="n" style="white-space:nowrap"><button class="btn sm" data-ed="${p.id}">Editar</button> <button class="btn sm" data-tg="${p.id}">${p.ativo===false?'Ativar':'Desativar'}</button></td></tr>`}).join('')}</tbody></table></div>`;
  el.onclick=async e=>{const ed=e.target.closest('[data-ed]'),tg=e.target.closest('[data-tg]');if(ed){S.editId=ed.dataset.ed;this.form();window.scrollTo({top:0,behavior:'smooth'})}
   if(tg){const p=S.produtos.find(x=>x.id===tg.dataset.tg);const {error}=await S.sb.from('produtos').update({ativo:p.ativo===false}).eq('id',p.id);if(error)return toast(erroMsg(error),true);toast(p.ativo===false?'Produto ativado.':'Produto desativado. Ele some da tela de vendas, mas fica no histórico.');await loadProdutos();this.refresh()}}}};

/* ---------- ENTRADAS (gerente) ---------- */
V.entradas={mount(m){const opts=S.produtos.map(p=>`<option value="${p.id}" ${S.entPid===p.id?'selected':''}>${esc(p.codigo)} · ${esc(p.nome)} (${Number(p.estoque)||0} un)</option>`).join('');
 m.innerHTML=`<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)"><section class="panel stack"><h2>Lançar no estoque</h2>
 ${S.produtos.length?`<form class="stack" id="ef"><div class="seg" id="etipo"><button type="button" data-t="Entrada" aria-pressed="true">Entrada de mercadoria</button><button type="button" data-t="Contagem" aria-pressed="false">Contagem (inventário)</button></div>
 <label class="f">Produto<select class="i" id="ep">${opts}</select></label>
 <div class="row"><label class="f grow" id="eql"><span id="eqt">Quantidade recebida</span><input class="i num" id="eq" type="number" min="0" required inputmode="numeric"></label><label class="f grow" id="ecl">Custo unitário (R$)<input class="i num" id="ecu" inputmode="decimal" placeholder="opcional"></label></div>
 <label class="f">Observação<input class="i" id="eo" placeholder="Ex.: NF 1234, fornecedor"></label><div id="emsg"></div><button class="btn p" type="submit">Lançar</button></form>`:'<div class="empty"><b>Sem produtos</b>Cadastre produtos na aba Produtos primeiro.</div>'}
 </section><section class="panel stack"><h2>Últimos lançamentos</h2><div id="el"></div></section></div>`;
 S.entPid=null;let tipo='Entrada';
 if($('#ef')){$('#etipo').onclick=e=>{const b=e.target.closest('button');if(!b)return;tipo=b.dataset.t;document.querySelectorAll('#etipo button').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#eqt').textContent=tipo==='Entrada'?'Quantidade recebida':'Quantidade contada na prateleira';$('#ecl').hidden=tipo!=='Entrada'};
  $('#ef').onsubmit=async e=>{e.preventDefault();const p=S.produtos.find(x=>x.id===$('#ep').value);const q=parseInt($('#eq').value);
   if(!p||isNaN(q)||q<0||(tipo==='Entrada'&&q===0)){$('#emsg').innerHTML='<div class="banner bad">Informe uma quantidade válida (maior que zero para entrada).</div>';return}
   const {data,error}=await S.sb.rpc('lancar_estoque',{p_produto:p.id,p_tipo:tipo,p_qtd:q,p_custo:tipo==='Entrada'?(num($('#ecu').value)||null):null,p_obs:$('#eo').value.trim()});
   if(error){$('#emsg').innerHTML=`<div class="banner bad">${esc(erroMsg(error))}</div>`;return}
   toast(`${p.nome}: estoque agora é ${data} un.`);$('#eq').value='';$('#eo').value='';$('#ecu').value='';$('#emsg').innerHTML='';await loadProdutos();this.refresh();this.hist()}}
 this.hist()},
 refresh(){const sel=$('#ep');if(sel){const v=sel.value;sel.innerHTML=S.produtos.map(p=>`<option value="${p.id}">${esc(p.codigo)} · ${esc(p.nome)} (${Number(p.estoque)||0} un)</option>`).join('');sel.value=v}},
 async hist(){const el=$('#el');if(!el)return;const {data,error}=await S.sb.from('entradas').select('*').order('criado_em',{ascending:false}).limit(40);
  if(error){el.innerHTML='<div class="empty">Não foi possível carregar o histórico agora.</div>';return}
  el.innerHTML=data.length?`<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="n">Qtd</th><th>Por</th></tr></thead><tbody>${data.map(x=>`<tr><td class="num">${fmtDia(x.dia)} ${hora(x.criado_em)}</td><td><span class="code">${esc(x.codigo)}</span> ${esc(x.nome)}${x.obs?`<div class="muted small">${esc(x.obs)}</div>`:''}</td><td>${esc(x.tipo)}</td><td class="n num" style="color:${x.qtd<0?'var(--bad)':'var(--ok)'}">${x.qtd>0?'+':''}${x.qtd}</td><td>${esc(x.operador_nome)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>Nenhum lançamento</b>Entradas de mercadoria e contagens aparecem aqui.</div>'}};

/* ---------- RELATÓRIOS (gerente) ---------- */
function periodo(){const d=new Date();const t=hoje();const p=S.rel.p;
 if(p==='hoje')return [t,t,'Hoje, '+fmtDia(t)];
 if(p==='semana'){const w=new Date(d);const dw=(w.getDay()+6)%7;w.setDate(w.getDate()-dw);return [iso(w),t,`Semana: ${fmtDia(iso(w))} a ${fmtDia(t)}`]}
 if(p==='mes'){const a=iso(new Date(d.getFullYear(),d.getMonth(),1));return [a,t,d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())]}
 let de=S.rel.de||t,ate=S.rel.ate||t;if(de>ate)[de,ate]=[ate,de];return [de,ate,`${fmtDia(de)} a ${fmtDia(ate)}`]}
async function vendasPeriodo(de,ate){let out=[],from=0;const step=1000;
 while(true){const {data,error}=await S.sb.from('vendas').select('*, venda_itens(*)').gte('dia',de).lte('dia',ate).order('criado_em',{ascending:false}).range(from,from+step-1);if(error)throw error;out=out.concat(data);if(data.length<step)break;from+=step}
 return out}
V.relatorios={mount(m){m.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between;align-items:center"><h2>Relatórios</h2><div class="row"><button class="btn" id="csv">Baixar planilha (CSV)</button><button class="btn" id="imp">Imprimir</button></div></div>
 <div class="row"><div class="seg" id="rp">${[['hoje','Diário'],['semana','Semanal'],['mes','Mensal'],['custom','Escolher datas']].map(x=>`<button data-p="${x[0]}" aria-pressed="${S.rel.p===x[0]}">${x[1]}</button>`).join('')}</div>
 <div class="row" id="rcustom" ${S.rel.p==='custom'?'':'hidden'}><label class="f">De<input class="i" type="date" id="rde" value="${S.rel.de||hoje()}"></label><label class="f">Até<input class="i" type="date" id="rate" value="${S.rel.ate||hoje()}"></label></div></div>
 <div id="rout"><div class="empty">Carregando…</div></div></div>`;
 $('#rp').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.rel.p=b.dataset.p;document.querySelectorAll('#rp button').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#rcustom').hidden=S.rel.p!=='custom';this.load()};
 $('#rde').onchange=e=>{S.rel.de=e.target.value;this.load()};$('#rate').onchange=e=>{S.rel.ate=e.target.value;this.load()};
 $('#csv').onclick=()=>this.csv();$('#imp').onclick=()=>window.print();this.load()},
 refresh(){if(periodo()[1]===hoje()){clearTimeout(this._t);this._t=setTimeout(()=>this.load(true),600)}},
 async load(quiet){const [de,ate,label]=periodo();const out=$('#rout');if(!out)return;if(!quiet)out.innerHTML='<div class="empty">Carregando…</div>';
  try{const vs=await vendasPeriodo(de,ate);const pr=await S.sb.from('pagamentos_conta').select('*').gte('dia',de).lte('dia',ate).order('criado_em',{ascending:false});S.relData={de,ate,label,vs,pg:(pr.data||[]).filter(p=>!p.estornado)};this.render()}catch(e){out.innerHTML=`<div class="banner bad">${esc(erroMsg(e))}</div>`}},
 render(){const out=$('#rout');if(!out||!S.relData)return;const {de,ate,label,vs:all}=S.relData;const vs=all.filter(v=>!v.cancelada);
  const fat=vs.reduce((s,v)=>s+Number(v.total),0),itens=vs.reduce((s,v)=>s+itensDe(v).reduce((a,i)=>a+i.qtd,0),0),custo=vs.reduce((s,v)=>s+itensDe(v).reduce((a,i)=>a+Number(i.custo||0)*i.qtd,0),0);
  const semCusto=vs.some(v=>itensDe(v).some(i=>!Number(i.custo)));
  const porProd={},porCat={},porOp={};vs.forEach(v=>{itensDe(v).forEach(i=>{const k=i.codigo+'|'+i.nome;const pr=Number(i.preco),cu=Number(i.custo||0);porProd[k]=porProd[k]||{codigo:i.codigo,nome:i.nome,qtd:0,fat:0,luc:0};porProd[k].qtd+=i.qtd;porProd[k].fat+=pr*i.qtd;porProd[k].luc+=(pr-cu)*i.qtd;porCat[i.categoria]=(porCat[i.categoria]||0)+pr*i.qtd});const o=v.operador_nome||'—';porOp[o]=porOp[o]||{n:0,t:0};porOp[o].n++;porOp[o].t+=Number(v.total)});
  const prods=Object.values(porProd).sort((a,b)=>b.fat-a.fat);const rp=resumoPag(vs);
  const dias=[];for(let d=new Date(de+'T12:00');iso(d)<=ate;d.setDate(d.getDate()+1))dias.push(iso(d));
  let chart='';
  if(dias.length>1&&dias.length<=62){const vd={};vs.forEach(v=>vd[v.dia]=(vd[v.dia]||0)+Number(v.total));const mx=Math.max(0,...dias.map(d=>vd[d]||0));const step=Math.ceil(dias.length/12);
   chart=`<section class="panel stack"><div class="row" style="justify-content:space-between"><h3>Faturamento por dia</h3><span class="muted small">maior dia: ${brl(mx)}</span></div><div class="bars">${dias.map(d=>`<div class="bar" style="height:${mx?Math.max(vd[d]?3:0,(vd[d]||0)/mx*100):0}%" title="${fmtDia(d)}: ${brl(vd[d]||0)}"></div>`).join('')}</div><div class="barlbl">${dias.map((d,i)=>`<span>${i%step===0?d.slice(8)+'/'+d.slice(5,7):''}</span>`).join('')}</div></section>`}
  if(dias.length===1&&vs.length){const vh={};vs.forEach(v=>{const h=new Date(v.criado_em).getHours();vh[h]=(vh[h]||0)+Number(v.total)});const hs=[];for(let h=6;h<=22;h++)hs.push(h);const mx=Math.max(1,...hs.map(h=>vh[h]||0));
   chart=`<section class="panel stack"><h3>Faturamento por horário</h3><div class="bars">${hs.map(h=>`<div class="bar" style="height:${(vh[h]||0)/mx*100}%" title="${h}h: ${brl(vh[h]||0)}"></div>`).join('')}</div><div class="barlbl">${hs.map(h=>`<span>${h%2===0?h+'h':''}</span>`).join('')}</div></section>`}
  const maxCat=Math.max(1,...Object.values(porCat));
  const low=S.produtos.filter(p=>p.ativo!==false&&(Number(p.estoque)||0)<=(Number(p.minimo)||0));
  const canc=all.length-vs.length;
  out.innerHTML=`<div class="stack"><p class="muted" style="margin:0">${esc(label)} · ${canc?`${canc} venda(s) cancelada(s) fora da conta`:'sem cancelamentos'}</p>
  <div class="kpis"><div class="kpi"><small>Faturamento</small><b class="money">${brl(fat)}</b></div><div class="kpi"><small>Vendas</small><b>${vs.length}</b></div><div class="kpi"><small>Itens vendidos</small><b>${itens}</b></div><div class="kpi"><small>Ticket médio</small><b class="money">${brl(vs.length?fat/vs.length:0)}</b></div><div class="kpi"><small>Lucro bruto${semCusto?' *':''}</small><b class="money" style="color:var(--ok)">${brl(fat-custo)}</b></div></div>
  ${semCusto?'<p class="muted small" style="margin:-4px 0 0">* Alguns produtos vendidos estão sem custo cadastrado, então o lucro desses itens aparece igual ao preço.</p>':''}
  ${chart}
  <div class="grid2"><section class="panel stack"><h3>Mais vendidos</h3>${prods.length?`<div class="tbl-wrap"><table><thead><tr><th>Produto</th><th class="n">Qtd</th><th class="n">Faturamento</th><th class="n">Lucro</th></tr></thead><tbody>${prods.map(p=>`<tr><td><span class="code">${esc(p.codigo)}</span> ${esc(p.nome)}</td><td class="n num">${p.qtd}</td><td class="n money">${brl(p.fat)}</td><td class="n money">${brl(p.luc)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma venda no período.</div>'}</section>
  <div class="stack"><section class="panel stack"><h3>Por forma de pagamento</h3><table><tbody>${PAGS_PDV.map(p=>`<tr><td>${p==='Conta'?'Pendurado (a receber)':p}</td><td class="n money">${brl(rp[p])}</td></tr>`).join('')}</tbody></table>${(()=>{const des=vs.reduce((s,v)=>s+Number(v.desconto||0),0);const pg=S.relData.pg||[];const rec=pg.reduce((s,p)=>s+Number(p.valor),0);const aRec=Object.values(S.saldos).reduce((s,x)=>s+Math.max(0,Number(x.saldo)),0);return `<table><tbody><tr><td>Descontos de funcionário</td><td class="n money">${brl(des)}</td></tr><tr><td>Contas recebidas no período</td><td class="n money" style="color:var(--ok)">${brl(rec)}</td></tr><tr><td>Total em aberto hoje</td><td class="n money" style="color:var(--warn)">${brl(aRec)}</td></tr></tbody></table>`})()}</section>
  <section class="panel stack"><h3>Por categoria</h3>${Object.keys(porCat).length?`<table><tbody>${Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<tr><td>${esc(c)}</td><td style="width:40%"><div class="hbar"><i style="width:${v/maxCat*100}%"></i></div></td><td class="n money">${brl(v)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Sem vendas.</div>'}</section>
  <section class="panel stack"><h3>Por atendente</h3>${Object.keys(porOp).length?`<table><tbody>${Object.entries(porOp).sort((a,b)=>b[1].t-a[1].t).map(([o,v])=>`<tr><td>${esc(o)}</td><td class="n num">${v.n} ${v.n===1?'venda':'vendas'}</td><td class="n money">${brl(v.t)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Sem vendas.</div>'}</section></div></div>
  <section class="panel stack"><div class="row" style="justify-content:space-between"><h3>Repor estoque</h3><span class="muted small">produtos no mínimo ou zerados agora</span></div>${low.length?`<div class="tbl-wrap"><table><thead><tr><th>Produto</th><th class="n">Estoque</th><th class="n">Mínimo</th><th>Situação</th></tr></thead><tbody>${low.map(p=>`<tr><td><span class="code">${esc(p.codigo)}</span> ${esc(p.nome)}</td><td class="n num">${Number(p.estoque)||0}</td><td class="n num">${Number(p.minimo)||0}</td><td>${stPill(p)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhum produto precisando de reposição.</div>'}</section>
  <section class="panel stack"><h3>Vendas do período</h3>${listaVendas(all,true)}</section></div>`;
  out.onclick=e=>{const b=e.target.closest('[data-cancel]');if(!b)return;const v=all.find(x=>x.id===b.dataset.cancel);
   confirmBox(`Cancelar a venda de ${brl(v.total)} das ${hora(v.criado_em)} de ${fmtDia(v.dia)}? Os itens voltam para o estoque.`,'Cancelar venda',async()=>{const {error}=await S.sb.rpc('cancelar_venda',{p_venda:v.id});if(error)return toast(erroMsg(error),true);toast('Venda cancelada e estoque devolvido.');await loadProdutos().catch(()=>{});this.load(true)})}},
 csv(){if(!S.relData||!S.relData.vs.length){toast('Não há vendas no período para exportar.',true);return}
  const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const nf=n=>(Math.round(Number(n)*100)/100).toFixed(2).replace('.',',');
  const rows=[['Data','Hora','Código','Produto','Categoria','Quantidade','Preço de tabela','Preço cobrado','Total do item','Custo unitário','Lucro do item','Pagamento','Cliente','Vendido por','Situação'].map(q).join(';')];
  S.relData.vs.slice().sort((a,b)=>a.criado_em<b.criado_em?-1:1).forEach(v=>itensDe(v).forEach(i=>rows.push([fmtDia(v.dia),hora(v.criado_em),i.codigo,i.nome,i.categoria,i.qtd,nf(i.preco_tabela||i.preco),nf(i.preco),nf(i.preco*i.qtd),nf(i.custo||0),nf((i.preco-(i.custo||0))*i.qtd),v.pagamento==='Conta'?'Pendurado':v.pagamento,v.cliente_nome||'',v.operador_nome,v.cancelada?'Cancelada':'OK'].map(q).join(';'))));
  const blob=new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`vendas-ninho-da-aguia_${S.relData.de}_a_${S.relData.ate}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}};

/* ---------- EQUIPE (gerente) ---------- */
V.equipe={mount(m){m.innerHTML=`<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)"><div class="stack"><section class="panel stack"><h2>Cadastrar pessoa</h2><form class="stack" id="nf">
 <label class="f">Nome<input class="i" id="nn" required placeholder="Ex.: Camilly"></label>
 <label class="f">E-mail<input class="i" id="ne" type="email" required inputmode="email"></label>
 <label class="f">Senha provisória<input class="i" id="ns" type="text" required minlength="6" autocomplete="off"></label>
 <label class="f">Acesso<select class="i" id="np"><option value="recepcao">Recepção</option><option value="gerente">Gerente</option></select></label>
 <div id="nmsg"></div><button class="btn p" type="submit">Cadastrar</button></form>
 <p class="muted small" style="margin:0">A pessoa entra com esse e-mail e senha em qualquer aparelho. Quem criar a conta sozinha pela tela de login aparece aqui como <b>Aguardando</b> até você liberar.</p></section>
 <section class="panel stack"><h2>Loja</h2><form class="stack" id="lf"><label class="f">Nome exibido<input class="i" id="ln" value="${esc(S.nomeLoja)}"></label><label class="f">Desconto de funcionário (%)<input class="i num" id="ldf" type="number" min="0" max="100" step="0.5" value="${S.descFunc}"></label><button class="btn p" style="align-self:flex-start">Salvar</button></form></section></div>
 <section class="panel stack"><h2>Equipe</h2><div id="eq"></div></section></div>`;
 $('#nf').onsubmit=async e=>{e.preventDefault();const nome=$('#nn').value.trim(),email=$('#ne').value.trim(),senha=$('#ns').value,papel=$('#np').value;const msg=(t,ok)=>$('#nmsg').innerHTML=`<div class="banner ${ok?'info':'bad'}">${esc(t)}</div>`;
  if(senha.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
  try{const cfg=window.NINHO_CONFIG;const tmp=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'ninho-tmp'}});
   const {data,error}=await tmp.auth.signUp({email,password:senha,options:{data:{nome}}});if(error)throw error;
   const uid=data.user&&data.user.id;if(!uid)throw new Error('Não foi possível criar a conta.');
   if(data.user.identities&&data.user.identities.length===0)throw new Error('Já existe uma conta com esse e-mail.');
   const r=await S.sb.from('perfis').update({papel,nome}).eq('id',uid);if(r.error)throw r.error;
   msg(data.session?`${nome} cadastrada. Passe o e-mail e a senha provisória para ela.`:`${nome} cadastrada, mas o Supabase pediu confirmação de e-mail: ela precisa clicar no link que chegou antes de entrar (ou desligue "Confirm email" no Supabase).`,true);
   $('#nf').reset();this.load()}catch(err){msg(erroMsg(err))}};
 $('#lf').onsubmit=async e=>{e.preventDefault();const n=$('#ln').value.trim()||NOME;const df=Math.min(100,Math.max(0,num($('#ldf').value)));const {error}=await S.sb.from('config').update({nome:n,desconto_funcionario:df}).eq('id',1);if(error)return toast(erroMsg(error),true);S.nomeLoja=n;S.descFunc=df;$('.brand b').textContent=n;toast('Configurações salvas.')};
 this.load()},
 async load(){const el=$('#eq');if(!el)return;const {data,error}=await S.sb.from('perfis').select('*').order('criado_em');if(error){el.innerHTML=`<div class="banner bad">${esc(erroMsg(error))}</div>`;return}
  const rot={gerente:'Gerente',recepcao:'Recepção',pendente:'Aguardando',bloqueado:'Bloqueado'};
  el.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Acesso</th></tr></thead><tbody>${data.map(p=>`<tr><td>${esc(p.nome)}${p.id===S.perfil.id?' <span class="muted small">(você)</span>':''}</td><td class="small">${esc(p.email)}</td><td>${p.id===S.perfil.id?'<span class="pill ok">Gerente</span>':`<select class="i papel" data-id="${p.id}">${Object.entries(rot).map(([k,v])=>`<option value="${k}" ${p.papel===k?'selected':''}>${v}</option>`).join('')}</select>${p.papel==='pendente'?' <span class="pill warn">Novo</span>':''}`}</td></tr>`).join('')}</tbody></table></div>`;
  el.onchange=async e=>{const s=e.target.closest('select.papel');if(!s)return;const {error}=await S.sb.from('perfis').update({papel:s.value}).eq('id',s.dataset.id);if(error){toast(erroMsg(error),true);this.load();return}toast('Acesso atualizado.')}}};

boot().catch(e=>fatal(`<div class="banner bad">${esc(erroMsg(e))}</div>`));
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
