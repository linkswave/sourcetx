const http=require('http');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
const p=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3499',ADMIN_PASSWORD:'test-password-123',STORAGE_PATH:path.join(os.tmpdir(),'sourcetx-check')},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=path=>new Promise((resolve,reject)=>{const req=http.get('http://127.0.0.1:3499'+path,r=>{let body='';r.on('data',d=>body+=d);r.on('end',()=>resolve({status:r.statusCode,body,headers:r.headers}))});req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('request timeout')))});
const post=(path,body)=>new Promise((resolve,reject)=>{const data=JSON.stringify(body||{});const req=http.request({host:'127.0.0.1',port:3499,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>resolve({status:r.statusCode,body:b,headers:r.headers}))});req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('request timeout')));req.write(data);req.end()});
async function waitForServer(){let last;for(let i=0;i<30;i++){try{const r=await get('/health');if(r.status===200)return}catch(e){last=e}await sleep(200)}throw last||new Error('Server did not start')}
(async()=>{
  let checks=0;
  const ok=()=>checks++;
  try{
    await waitForServer();
    const urls=['/','/about','/services','/talent-workforce','/cloud-infrastructure','/data-ai-analytics','/application-engineering','/cybersecurity-quality','/managed-services','/jobs','/pictures/animated-services-ecosystem.svg','/pictures/animated-cloud-transformation.svg','/pictures/hero-technology-professional.jpg','/api/jobs','/sitemap.xml','/health'];
    for(const u of urls){const r=await get(u);if(r.status!==200)throw new Error(`${u} returned ${r.status}`);if(!r.body)throw new Error(`${u} returned an empty body`);ok()}
    const chat=await post('/api/chat',{message:'Do you have open jobs?'});
    if(chat.status!==200)throw new Error(`/api/chat known returned ${chat.status}`);
    const chatJson=JSON.parse(chat.body);
    if(!chatJson.ok||!chatJson.reply||chatJson.fallback)throw new Error('/api/chat known intent returned unexpected payload');
    ok();
    const fallback=await post('/api/chat',{message:'please explain zorbafax'});
    if(fallback.status!==200)throw new Error(`/api/chat unknown returned ${fallback.status}`);
    const fbJson=JSON.parse(fallback.body);
    if(!fbJson.ok||!fbJson.fallback)throw new Error('/api/chat unknown intent should return fallback');
    ok();
    const bad=await post('/api/chat',{message:''});
    if(bad.status!==400)throw new Error(`/api/chat empty returned ${bad.status}`);
    ok();
    console.log(`All ${checks} website checks passed.`);
  }catch(e){console.error(e);process.exitCode=1}finally{p.kill('SIGTERM')}
})();
