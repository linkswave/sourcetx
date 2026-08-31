(()=>{
  const KINDS=[
    {key:'applications',label:'Applications'},
    {key:'messages',label:'Messages'},
    {key:'talent-requests',label:'Talent Requests'},
    {key:'chat-captures',label:'Chat Captures'},
    {key:'jobs',label:'Jobs'}
  ];
  let state={tab:'applications',data:[],filter:'all',query:''};
  const tabs=document.getElementById('tabs'),view=document.getElementById('view'),modal=document.getElementById('modal'),modalCard=document.getElementById('modalCard');

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=s=>{if(!s)return'';const d=new Date(s);return isNaN(d)?s:d.toLocaleString()};
  const api=async(path,opts)=>{const res=await fetch(path,{headers:{'Content-Type':'application/json'},...opts});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.message||`Request failed (${res.status})`);return json};

  function renderTabs(){
    tabs.innerHTML=KINDS.map(k=>`<button class="tab${state.tab===k.key?' active':''}" data-tab="${k.key}">${k.label}</button>`).join('');
    tabs.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  }

  function switchTab(tab){
    state.tab=tab;state.query='';state.filter='all';state.data=[];
    renderTabs();load();
  }

  async function load(){
    view.innerHTML='<p class="empty">Loading…</p>';
    try{
      const res=await api(`/api/admin/${state.tab}`);
      state.data=res.data||[];
      render();
    }catch(e){
      view.innerHTML=`<p class="empty" style="color:var(--danger)">${esc(e.message)}</p>`;
    }
  }

  function render(){
    if(state.tab==='jobs')return renderJobs();
    const rows=filterRows();
    const q=esc(state.query);
    const csvLink=`/admin/export/${state.tab}.csv`;
    view.innerHTML=`
      <div class="toolbar">
        <input type="search" id="search" placeholder="Search name, email, or message…" value="${q}">
        <select id="filter">
          <option value="all"${state.filter==='all'?' selected':''}>All</option>
          <option value="unread"${state.filter==='unread'?' selected':''}>Unread</option>
          <option value="read"${state.filter==='read'?' selected':''}>Read</option>
        </select>
        <a class="btn" href="${csvLink}">Export CSV</a>
      </div>
      <div id="list">${rows.length?rows.map(cardFor()).join(''):'<p class="empty">No records found.</p>'}</div>`;
    document.getElementById('search').addEventListener('input',e=>{state.query=e.target.value;rerenderList()});
    document.getElementById('filter').addEventListener('change',e=>{state.filter=e.target.value;rerenderList()});
  }

  function cardFor(){return state.tab==='applications'?cardApplication:state.tab==='chat-captures'?cardChat:cardGeneric;}

  function rerenderList(){
    const rows=filterRows();
    document.getElementById('list').innerHTML=rows.length?rows.map(cardFor()).join(''):'<p class="empty">No records found.</p>';
  }

  function filterRows(){
    const q=state.query.toLowerCase();
    return state.data.filter(r=>{
      if(state.filter==='unread'&&r.read)return false;
      if(state.filter==='read'&&!r.read)return false;
      if(!q)return true;
      return JSON.stringify(r).toLowerCase().includes(q);
    });
  }

  function repliesHtml(r){
    if(!r.replies||!r.replies.length)return'';
    return `<div class="replies">${r.replies.map(p=>`<div class="reply"><div class="rhead">Replied to ${esc(p.to)} · ${esc(fmtDate(p.at))} · ${esc(p.subject)}</div>${esc(p.body)}</div>`).join('')}</div>`;
  }

  function actionsHtml(r){
    const reply=state.tab==='chat-captures'?'':`<button class="btn small" data-action="reply">Reply</button>`;
    return `<div class="actions">${reply}
      <button class="btn small" data-action="read">Mark ${r.read?'Unread':'Read'}</button>
    </div>`;
  }

  function cardChat(r){
    const who=r.email?esc(r.email):'<span class="muted">No email</span>';
    return `<article class="panel${r.read?'':' unread'}">
      <div class="head"><div><span class="dot ${r.read?'read':'unread'}"></span><span class="who">Unanswered chat question</span>
        <div class="meta">${who} · ${esc(fmtDate(r.submittedAt))}${r.intent&&r.intent!=='none'?' · intent: '+esc(r.intent):''}</div></div></div>
      <div class="body">${esc(r.question||'—')}</div>${actionsHtml(r)}
    </article>`;
  }

  function cardGeneric(r){
    const title=r.company?`${esc(r.company)}`:(r.topic?esc(r.topic):esc(r.name));
    const who=r.company?`${esc(r.name)} (${esc(r.email)})`:esc(r.email);
    const extra=r.service||r.targetDate?`<div class="kv">${[r.service,r.targetDate].filter(Boolean).map(esc).join(' · ')}</div>`:'';
    const body=r.needs||r.message;
    return `<article class="panel${r.read?'':' unread'}">
      <div class="head"><div><span class="dot ${r.read?'read':'unread'}"></span><span class="who">${title}</span><div class="meta">${who} · ${esc(fmtDate(r.submittedAt))}</div>${extra}</div></div>
      <div class="body">${esc(body)}</div>${repliesHtml(r)}${actionsHtml(r)}
    </article>`;
  }

  function cardApplication(r){
    return `<article class="panel${r.read?'':' unread'}">
      <div class="head">
        <div><span class="dot ${r.read?'read':'unread'}"></span><span class="who">${esc(r.name)}</span>
          <div class="meta">${esc(r.jobTitle)} · ${esc(r.email)} · ${esc(r.phone||'—')}${r.location?' · '+esc(r.location):''} · ${esc(fmtDate(r.submittedAt))}</div>
          ${r.workAuthorization?`<span class="chip">Auth: ${esc(r.workAuthorization)}</span>`:''}${r.linkedin?`<span class="chip">${esc(r.linkedin)}</span>`:''}</div>
        <a class="btn small" href="/uploads/${encodeURIComponent(r.resume)}" target="_blank">${esc(r.originalResumeName||'CV')}</a>
      </div>
      <div class="body">${esc(r.message||'—')}</div>${repliesHtml(r)}${actionsHtml(r)}
    </article>`;
  }

  function renderJobs(){
    const jobs=state.data;
    view.innerHTML=`
      <div class="toolbar">
        <button class="btn primary" id="addJob">+ Add Job</button>
        <a class="btn" href="/">View Jobs Page</a>
      </div>
      <div class="panel"><table class="jobs"><thead><tr><th>Title</th><th>Location</th><th>Type</th><th>Department</th><th>Posted</th><th>Status</th><th></th></tr></thead>
      <tbody>${jobs.length?jobs.map(j=>`<tr>
        <td><strong>${esc(j.title)}</strong></td><td>${esc(j.location)}</td><td>${esc(j.type)}</td><td>${esc(j.department)}</td><td>${esc(j.posted)}</td>
        <td><span class="tag ${j.active!==false?'on':'off'}">${j.active!==false?'Active':'Inactive'}</span></td>
        <td style="white-space:nowrap">
          <button class="btn small" data-job-edit="${esc(j.id)}">Edit</button>
          <button class="btn small" data-job-toggle="${esc(j.id)}">${j.active!==false?'Deactivate':'Activate'}</button>
        </td></tr>`).join(''):'<tr><td colspan="7" class="empty">No jobs yet.</td></tr>'}</tbody></table></div>`;
    document.getElementById('addJob').addEventListener('click',()=>openJobModal(null));
    view.querySelectorAll('[data-job-edit]').forEach(b=>b.addEventListener('click',()=>openJobModal(jobs.find(j=>j.id===b.dataset.jobEdit))));
    view.querySelectorAll('[data-job-toggle]').forEach(b=>b.addEventListener('click',async()=>{
      const j=jobs.find(x=>x.id===b.dataset.jobToggle);
      try{await api(`/api/admin/jobs/${encodeURIComponent(j.id)}`,{method:'PUT',body:JSON.stringify({active:j.active!==false?false:true})});await load();}
      catch(e){toast(e.message,true)}
    }));
  }

  function openJobModal(job){
    const j=job||{title:'',location:'',type:'',department:'',posted:new Date().toISOString().slice(0,10),summary:'',description:'',responsibilities:[],requirements:[],skills:[],active:true};
    const arr=(v)=>v&&v.length?v.join('\n'):'';
    modalCard.innerHTML=`
      <h2>${job?'Edit Job':'Add Job'}</h2>
      <label>Title *</label><input id="jb-title" type="text" value="${esc(j.title)}">
      <div class="row"><div><label>Location</label><input id="jb-location" type="text" value="${esc(j.location)}"></div>
      <div><label>Type</label><input id="jb-type" type="text" value="${esc(j.type)}"></div></div>
      <div class="row"><div><label>Department</label><input id="jb-dept" type="text" value="${esc(j.department)}"></div>
      <div><label>Posted</label><input id="jb-posted" type="date" value="${esc(j.posted)}"></div></div>
      <label>Summary</label><input id="jb-summary" type="text" value="${esc(j.summary)}">
      <label>Description</label><textarea id="jb-desc" rows="3">${esc(j.description)}</textarea>
      <label>Responsibilities (one per line)</label><textarea id="jb-resp" rows="3">${esc(arr(j.responsibilities))}</textarea>
      <label>Requirements (one per line)</label><textarea id="jb-req" rows="3">${esc(arr(j.requirements))}</textarea>
      <label>Skills (comma separated)</label><input id="jb-skills" type="text" value="${esc(j.skills&&j.skills.join(', '))}">
      <div class="actions">
        <button class="btn" id="jb-cancel">Cancel</button>
        <button class="btn primary" id="jb-save">${job?'Save':'Create'}</button>
      </div>
      <p class="status" id="jb-status"></p>`;
    modal.classList.add('open');
    const split=v=>v.split(/\n/).map(s=>s.trim()).filter(Boolean);
    const collect=()=>({
      title:document.getElementById('jb-title').value.trim(),
      location:document.getElementById('jb-location').value.trim(),
      type:document.getElementById('jb-type').value.trim(),
      department:document.getElementById('jb-dept').value.trim(),
      posted:document.getElementById('jb-posted').value,
      summary:document.getElementById('jb-summary').value.trim(),
      description:document.getElementById('jb-desc').value.trim(),
      responsibilities:split(document.getElementById('jb-resp').value),
      requirements:split(document.getElementById('jb-req').value),
      skills:document.getElementById('jb-skills').value.split(',').map(s=>s.trim()).filter(Boolean)
    });
    document.getElementById('jb-cancel').addEventListener('click',()=>modal.classList.remove('open'));
    document.getElementById('jb-save').addEventListener('click',async()=>{
      const body=collect();const st=document.getElementById('jb-status');
      if(!body.title){st.className='status err';st.textContent='Title is required.';return}
      try{
        if(job)await api(`/api/admin/jobs/${encodeURIComponent(job.id)}`,{method:'PUT',body:JSON.stringify(body)});
        else await api('/api/admin/jobs',{method:'POST',body:JSON.stringify(body)});
        modal.classList.remove('open');await load();
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  function openReplyModal(kind,rec){
    modalCard.innerHTML=`
      <h2>Reply to ${esc(rec.name||rec.company||'sender')}</h2>
      <label>To</label><input id="rp-to" type="email" value="${esc(rec.email)}">
      <label>Subject</label><input id="rp-subject" type="text" value="Re: ${esc(rec.jobTitle||rec.topic||rec.service||'your submission')}">
      <label>Message</label><textarea id="rp-body" rows="6"></textarea>
      <div class="actions">
        <button class="btn" id="rp-cancel">Cancel</button>
        <button class="btn primary" id="rp-send">Send</button>
      </div>
      <p class="status" id="rp-status"></p>`;
    modal.classList.add('open');
    document.getElementById('rp-cancel').addEventListener('click',()=>modal.classList.remove('open'));
    document.getElementById('rp-send').addEventListener('click',async()=>{
      const st=document.getElementById('rp-status');
      const body={to:document.getElementById('rp-to').value.trim(),subject:document.getElementById('rp-subject').value.trim(),body:document.getElementById('rp-body').value.trim()};
      if(!body.to||!body.subject||!body.body){st.className='status err';st.textContent='All fields are required.';return}
      try{
        const res=await api(`/api/admin/${kind}/${encodeURIComponent(rec.id)}/reply`,{method:'POST',body:JSON.stringify(body)});
        st.className='status ok';st.textContent=res.message||'Reply sent.';
        setTimeout(()=>{modal.classList.remove('open');load()},800);
      }catch(e){st.className='status err';st.textContent=e.message}
    });
  }

  view.addEventListener('click',async(e)=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const panel=btn.closest('.panel');const idx=[...view.querySelectorAll('.panel')].indexOf(panel);
    const rec=filterRows()[idx];
    if(btn.dataset.action==='reply')return openReplyModal(state.tab,rec);
    if(btn.dataset.action==='read'){
      try{await api(`/api/admin/${state.tab}/${encodeURIComponent(rec.id)}/read`,{method:'POST',body:JSON.stringify({read:!rec.read})});await load();}
      catch(e){alert(e.message)}
    }
  });

  renderTabs();load();
})();
