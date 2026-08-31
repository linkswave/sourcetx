const jobIdFromPath=()=>decodeURIComponent((location.pathname.split('/').filter(Boolean).pop()||'').replace(/\.html$/,''));
async function init(){
  const id=jobIdFromPath();
  if(!id){location.replace('/jobs');return;}
  let data=[];
  try{const res=await fetch('/api/jobs');if(res.ok)data=await res.json();}catch(e){}
  const j=(Array.isArray(data)?data:[]).find(x=>x.id===id);
  if(!j){location.replace('/jobs');return;}
  document.title=`Apply — ${j.title} | SourceTX`;
  document.getElementById('apply-title').textContent=j.title;
  document.getElementById('apply-meta').textContent=`${j.location} · ${j.type}`;
  document.getElementById('apply-job-id').value=j.id;
}
document.addEventListener('DOMContentLoaded',init);
