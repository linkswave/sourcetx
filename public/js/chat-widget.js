(function(){
  if(window.__sourcetxChatLoaded)return;window.__sourcetxChatLoaded=true;

  const SVG_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/></svg>';
  const SVG_SEND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>';
  const SVG_CLOSE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const GREETING="Hi! I'm the SourceTX virtual assistant. Ask me about our services, open jobs, how to apply, or how to get in touch.";
  const STARTERS=["What services do you offer?","Are there open jobs?","How do I apply?","How can I contact SourceTX?"];
  const UNAVAILABLE="Chat is temporarily unavailable. Please try again shortly or use the contact page.";
  const STORAGE_KEY="sourcetx-chat-hidden";

  function isHiddenPref(){try{return localStorage.getItem(STORAGE_KEY)==='1';}catch(e){return false;}}
  function setHiddenPref(v){try{localStorage.setItem(STORAGE_KEY,v?'1':'0');}catch(e){}}

  function build(){
    const root=document.createElement('div');
    root.id='sourcetx-chat';root.className='chat-root';

    const fab=document.createElement('button');
    fab.className='chat-fab';fab.type='button';fab.setAttribute('aria-label','Open SourceTX chat assistant');fab.setAttribute('aria-expanded','false');
    fab.innerHTML=SVG_ICON;

    const dismiss=document.createElement('span');
    dismiss.className='chat-fab-dismiss';dismiss.setAttribute('role','button');dismiss.setAttribute('tabindex','0');dismiss.setAttribute('aria-label','Hide chat bubble');dismiss.textContent='×';

    const fabWrap=document.createElement('div');fabWrap.className='chat-fab-wrap';
    fabWrap.append(fab,dismiss);

    const panel=document.createElement('div');
    panel.className='chat-panel';panel.hidden=true;

    const head=document.createElement('div');head.className='chat-head';
    const avatar=document.createElement('span');avatar.className='chat-avatar';avatar.innerHTML=SVG_ICON;
    const headTitle=document.createElement('span');headTitle.className='chat-head-title';
    const strong=document.createElement('strong');strong.textContent='Ask SourceTX';
    const sub=document.createElement('span');sub.textContent='Virtual assistant — replies instantly';
    headTitle.append(strong,sub);
    const close=document.createElement('button');
    close.className='chat-close';close.type='button';close.setAttribute('aria-label','Close chat');close.innerHTML=SVG_CLOSE;
    head.append(avatar,headTitle,close);

    const msgs=document.createElement('div');msgs.className='chat-msgs';msgs.setAttribute('role','log');msgs.setAttribute('aria-live','polite');

    const chips=document.createElement('div');chips.className='chat-chips';chips.hidden=true;

    const emailWrap=document.createElement('div');emailWrap.className='chat-email';
    const email=document.createElement('input');email.type='email';email.placeholder='Share your email (optional)';email.setAttribute('autocomplete','email');email.setAttribute('aria-label','Your email (optional)');
    emailWrap.appendChild(email);

    const inputRow=document.createElement('div');inputRow.className='chat-input';
    const input=document.createElement('input');input.type='text';input.placeholder='Ask a question…';input.setAttribute('aria-label','Your question');
    const send=document.createElement('button');send.className='chat-send';send.type='button';send.setAttribute('aria-label','Send message');send.innerHTML=SVG_SEND;
    inputRow.append(input,send);

    const foot=document.createElement('div');foot.className='chat-foot';
    const link=document.createElement('a');link.href='contact.html';link.textContent='Talk to a person';
    foot.append('Need a human? ',link);

    const pill=document.createElement('button');
    pill.className='chat-restore';pill.type='button';pill.setAttribute('aria-label','Open SourceTX chat assistant');pill.hidden=true;
    pill.innerHTML=SVG_ICON+'<span>Chat</span>';

    panel.append(head,msgs,chips,emailWrap,inputRow,foot);
    root.append(fabWrap,panel);
    document.body.appendChild(root);
    document.body.appendChild(pill);
    return {root,fab,dismiss,panel,msgs,chips,email,input,send,close,pill};
  }

  function ui(){
    const u=build();
    let opened=false,busy=false;
    const scrollBottom=()=>{u.msgs.scrollTop=u.msgs.scrollHeight;};
    function setFabIcon(open){
      u.fab.innerHTML=open?SVG_CLOSE:SVG_ICON;
      u.fab.setAttribute('aria-label',open?'Close SourceTX chat assistant':'Open SourceTX chat assistant');
      u.fab.classList.toggle('chat-fab-open',open);
    }
    function addMsg(text,who){
      const m=document.createElement('div');m.className='chat-msg '+who;m.textContent=text;
      u.msgs.appendChild(m);scrollBottom();
      return m;
    }
    function addTyping(){
      const t=document.createElement('div');t.className='chat-typing';t.setAttribute('aria-label','Assistant is typing');
      t.innerHTML='<span></span><span></span><span></span>';
      u.msgs.appendChild(t);scrollBottom();return t;
    }
    function setChips(list){
      u.chips.innerHTML='';
      (list||[]).slice(0,4).forEach(text=>{
        const b=document.createElement('button');b.type='button';b.className='chat-chip';b.textContent=text;
        b.addEventListener('click',()=>{u.input.value=text;send();});
        u.chips.appendChild(b);
      });
      u.chips.hidden=!(list&&list.length);
    }
    function setBusy(v){busy=v;u.send.disabled=v;u.input.disabled=v;}
    async function send(){
      const text=u.input.value.trim();
      if(!text||busy)return;
      addMsg(text,'user');
      u.input.value='';setChips([]);
      setBusy(true);
      const typing=addTyping();
      const emailVal=u.email.value.trim();
      try{
        const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,email:emailVal||undefined})});
        const json=await res.json();
        typing.remove();
        if(!res.ok)throw new Error(json.message||'Chat unavailable');
        addMsg(json.reply,'bot');
        setChips(json.followups||[]);
      }catch(e){
        typing.remove();
        addMsg(UNAVAILABLE,'bot');
      }
      setBusy(false);
      u.input.focus();
    }
    function open(){
      if(opened)return;opened=true;
      u.panel.hidden=false;u.fab.setAttribute('aria-expanded','true');setFabIcon(true);
      addMsg(GREETING,'bot');
      setChips(STARTERS);
      u.input.focus();
    }
    function close(){
      opened=false;u.panel.hidden=true;u.fab.setAttribute('aria-expanded','false');setFabIcon(false);
    }
    function hideAll(){
      opened=false;u.panel.hidden=true;
      u.root.hidden=true;u.pill.hidden=false;
      u.fab.setAttribute('aria-expanded','false');setFabIcon(false);
      setHiddenPref(true);
    }
    function restore(){
      setHiddenPref(false);
      u.pill.hidden=true;u.root.hidden=false;
      open();
    }
    u.fab.addEventListener('click',()=>opened?close():open());
    u.close.addEventListener('click',close);
    u.send.addEventListener('click',send);
    u.input.addEventListener('keydown',e=>{if(e.key==='Enter')send();});
    u.dismiss.addEventListener('click',e=>{e.stopPropagation();hideAll();});
    u.dismiss.addEventListener('keydown',e=>{if(e.key==='Enter'){e.stopPropagation();hideAll();}});
    u.pill.addEventListener('click',restore);
    if(isHiddenPref()){u.root.hidden=true;u.pill.hidden=false;}
    return {open,close,hideAll,restore};
  }

  if(document.body){ui();}
  else{document.addEventListener('DOMContentLoaded',ui);}
})();
