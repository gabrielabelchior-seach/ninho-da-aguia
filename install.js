// Botão "Instalar app" (Windows, Android) e dica para iPhone/iPad
(function(){
  var ev=null, btn=null;
  function standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
  function mk(txt){
    if(btn)return btn;
    btn=document.createElement('button');btn.id='btn-instalar';btn.type='button';btn.textContent=txt;
    btn.style.cssText='position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;background:#e2303f;color:#fff;border:0;border-radius:999px;padding:12px 18px;font:700 15px Barlow,Arial,sans-serif;letter-spacing:.03em;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:pointer';
    document.body.appendChild(btn);return btn;
  }
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();ev=e;if(standalone())return;
    mk('⬇ Instalar app').onclick=function(){ev.prompt();ev.userChoice.then(function(r){if(r.outcome==='accepted'&&btn){btn.remove();btn=null}})};
  });
  window.addEventListener('appinstalled',function(){if(btn){btn.remove();btn=null}});
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&!standalone())window.addEventListener('load',function(){
    mk('Instalar no iPhone').onclick=function(){alert('No Safari: toque em Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início".')};
  });
})();
