const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtPosted=d=>{if(!d)return '';const dt=new Date(String(d).slice(0,10)+'T00:00:00Z');return isNaN(dt)?d:`${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`};
const cardHTML=j=>{
  const search=(j.title+' '+j.department+' '+j.summary+' '+(j.skills||[]).join(' ')).toLowerCase();
  const loc=(j.location||'').toLowerCase();
  const type=(j.type||'').toLowerCase();
  const meta=`<span>${esc(j.location)}</span><span>${esc(j.type)}</span><span>Posted ${fmtPosted(j.posted)}</span>`;
  const tags=(j.skills||[]).map(s=>`<span class="tag">${esc(s)}</span>`).join('');
  const url='/jobs/'+encodeURIComponent(j.id);
  return `<article class="job-card" data-job-card data-search="${esc(search)}" data-location="${esc(loc)}" data-type="${esc(type)}">
    <div>
      <span class="eyebrow dark">${esc(j.department)}</span>
      <h3><a href="${url}">${esc(j.title)}</a></h3>
      <div class="meta">${meta}</div>
      <p>${esc(j.summary)}</p>
      <div class="tags">${tags}</div>
    </div>
    <div class="job-actions">
      <a class="btn btn-gradient" href="${url}">View Role</a>
    </div>
  </article>`;
};
function filterJobs(){
  const cards=[...document.querySelectorAll('#job-list [data-job-card]')];
  const count=document.getElementById('job-count');
  const q=(document.getElementById('job-q')?.value||'').toLowerCase();
  const location=(document.getElementById('job-location')?.value||'').toLowerCase();
  const jobType=(document.getElementById('job-type')?.value||'').toLowerCase();
  let n=0;
  cards.forEach(card=>{
    const ok=(!q||card.dataset.search.includes(q))&&(!location||card.dataset.location.includes(location))&&(!jobType||card.dataset.type===jobType);
    card.classList.toggle('hidden',!ok);
    if(ok)n++;
  });
  if(count)count.textContent=`${n} role${n===1?'':'s'} found`;
}
function renderJobs(data){
  const wrap=document.getElementById('job-list');
  const count=document.getElementById('job-count');
  if(!data.length){
    wrap.innerHTML='<p class="notice">No open positions right now. Submit your résumé and we will reach out when a matching opportunity becomes available.</p>';
    if(count)count.textContent='0 roles found';
    return;
  }
  data=data.slice().sort((a,b)=>String(b.posted||'').localeCompare(String(a.posted||'')));
  wrap.innerHTML=data.map(cardHTML).join('');
  filterJobs();
}
async function loadJobs(){
  const wrap=document.getElementById('job-list');
  const count=document.getElementById('job-count');
  let data=[];
  try{
    const res=await fetch('/api/jobs');
    if(!res.ok)throw new Error('bad response');
    data=await res.json();
  }catch(e){
    wrap.innerHTML='<p class="notice">Jobs could not be loaded right now. Please try again shortly.</p>';
    if(count)count.textContent='';
    return;
  }
  renderJobs(Array.isArray(data)?data:[]);
}
document.addEventListener('DOMContentLoaded',()=>{
  for(const id of ['job-q','job-location','job-type']){
    const el=document.getElementById(id);
    if(!el)continue;
    el.addEventListener(el.tagName==='SELECT'?'change':'input',filterJobs);
  }
  loadJobs();
});
