const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtPosted=d=>{if(!d)return '';const dt=new Date(String(d).slice(0,10)+'T00:00:00Z');return isNaN(dt)?d:`${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`};
const jobIdFromPath=()=>decodeURIComponent((location.pathname.split('/').filter(Boolean).pop()||'').replace(/\.html$/,''));
async function init(){
  const id=jobIdFromPath();
  if(!id){location.replace('/jobs');return;}
  let data=[];
  try{const res=await fetch('/api/jobs');if(res.ok)data=await res.json();}catch(e){}
  const j=(Array.isArray(data)?data:[]).find(x=>x.id===id);
  if(!j){location.replace('/jobs');return;}
  document.title=`${j.title} | SourceTX Jobs`;
  const apply='/apply/'+encodeURIComponent(j.id);
  document.getElementById('jd-department').textContent=j.department;
  document.getElementById('jd-title').textContent=j.title;
  document.getElementById('jd-meta').textContent=`${j.location} · ${j.type}`;
  document.getElementById('jd-summary').textContent=j.summary;
  document.getElementById('jd-description').textContent=j.description;
  document.getElementById('jd-responsibilities').innerHTML=(j.responsibilities||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  document.getElementById('jd-requirements').innerHTML=(j.requirements||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  document.getElementById('jd-skills').innerHTML=(j.skills||[]).map(s=>`<span class="tag">${esc(s)}</span>`).join('');
  document.getElementById('jd-apply').setAttribute('href',apply);
  document.getElementById('jd-sidebar-apply').setAttribute('href',apply);
  document.getElementById('jd-sidebar-title').textContent=j.title;
  document.getElementById('jd-sidebar-meta').innerHTML=`${esc(j.location)}<br>${esc(j.type)} · Posted ${fmtPosted(j.posted)}`;
}
document.addEventListener('DOMContentLoaded',init);
