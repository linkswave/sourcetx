require('dotenv').config();
const express=require('express');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const multer=require('multer');
const nodemailer=require('nodemailer');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {getStore,JsonJobs}=require('./storage');
const {answer:chatAnswer}=require('./chatbot');

const app=express();
let store;
const PORT=process.env.PORT||3000;
const ROOT=__dirname;
const PUBLIC=path.join(ROOT,'public');
const DATA=process.env.STORAGE_PATH?path.join(process.env.STORAGE_PATH,'data'):path.join(ROOT,'data');
const UPLOADS=process.env.STORAGE_PATH?path.join(process.env.STORAGE_PATH,'uploads'):path.join(ROOT,'uploads');
fs.mkdirSync(DATA,{recursive:true}); fs.mkdirSync(UPLOADS,{recursive:true});
for(const f of ['applications.json','messages.json','talent_requests.json','chat_captures.json']){const p=path.join(DATA,f);if(!fs.existsSync(p))fs.writeFileSync(p,'[]');}
const bundledJobs=path.join(ROOT,'data','jobs.json'); const storedJobs=path.join(DATA,'jobs.json');
if(!fs.existsSync(storedJobs)&&fs.existsSync(bundledJobs)&&storedJobs!==bundledJobs)fs.copyFileSync(bundledJobs,storedJobs);
const jobsStore=new JsonJobs(storedJobs);

app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],imgSrc:["'self'",'data:'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com','data:'],scriptSrc:["'self'"],formAction:["'self'"],baseUri:["'self'"]}}}));
app.use(rateLimit({windowMs:15*60*1000,limit:250,standardHeaders:true,legacyHeaders:false}));
app.use(express.urlencoded({extended:false,limit:'1mb'}));
app.use(express.json({limit:'1mb'}));
app.use('/css',express.static(path.join(PUBLIC,'css'),{maxAge:'0'}));
app.use('/js',express.static(path.join(PUBLIC,'js'),{maxAge:'0'}));
app.use('/pictures',express.static(path.join(PUBLIC,'pictures'),{maxAge:'30d'}));
app.use('/uploads',express.static(UPLOADS,{dotfiles:'deny',index:false}));

const read=(file)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return []}};
const jobs=()=>jobsStore.list().filter(j=>j.active!==false);
const uid=()=>crypto.randomUUID();
const safe=(s)=>String(s||'').replace(/[\r\n]/g,' ').trim();
const page=(name)=>path.join(PUBLIC,name);
const send=(name)=>(req,res)=>res.sendFile(page(name));

// Human-readable routes plus direct .html access.
app.get('/',send('index.html'));
for(const [route,file] of Object.entries({
  '/about':'about.html','/services':'services.html','/job-seekers':'job-seekers.html','/jobs':'jobs.html',
  '/employers':'employers.html','/contact':'contact.html','/general-application':'general-application.html',
  '/privacy':'privacy.html','/terms':'terms.html','/talent-workforce':'talent-workforce.html','/cloud-infrastructure':'cloud-infrastructure.html','/data-ai-analytics':'data-ai-analytics.html','/application-engineering':'application-engineering.html','/cybersecurity-quality':'cybersecurity-quality.html','/managed-services':'managed-services.html'
})) app.get(route,send(file));
app.get('/jobs/:id',(req,res)=>{
  const f=`job-${req.params.id}.html`;
  if(fs.existsSync(page(f)))return res.sendFile(page(f));
  if(jobs().some(j=>j.id===req.params.id))return res.sendFile(page('job-detail.html'));
  res.status(404).sendFile(page('404.html'));
});
app.get('/apply/:id',(req,res)=>{
  const f=`apply-${req.params.id}.html`;
  if(fs.existsSync(page(f)))return res.sendFile(page(f));
  if(jobs().some(j=>j.id===req.params.id))return res.sendFile(page('apply-detail.html'));
  res.status(404).sendFile(page('404.html'));
});
app.use(express.static(PUBLIC,{extensions:['html'],index:false,maxAge:'0'}));

const allowedExt=new Set(['.pdf','.doc','.docx']);
const upload=multer({storage:multer.diskStorage({destination:UPLOADS,filename:(req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)}),limits:{fileSize:8*1024*1024,files:1},fileFilter:(req,file,cb)=>allowedExt.has(path.extname(file.originalname).toLowerCase())?cb(null,true):cb(new Error('Résumé must be PDF, DOC, or DOCX.'))});

async function notify(subject,body,replyTo){
  if(!process.env.SMTP_HOST||!process.env.NOTIFY_EMAIL)return;
  await sendMail({to:process.env.NOTIFY_EMAIL,subject,text:body,replyTo});
}
async function sendMail({to,subject,text,replyTo}){
  const t=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
  await t.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,replyTo,subject,text});
}

app.get('/api/jobs',(req,res)=>res.json(jobs()));
app.post('/api/apply',upload.single('resume'),async(req,res,next)=>{try{
  const required=['name','email','phone','consent'];
  if(!req.file||!required.every(k=>safe(req.body[k])))throw new Error('Complete all required fields, provide consent, and attach your résumé.');
  const job=req.body.jobId==='general'?{id:'general',title:'General Talent Network'}:jobs().find(j=>j.id===safe(req.body.jobId));
  if(!job)throw new Error('That opportunity is no longer available.');
  const item={id:uid(),submittedAt:new Date().toISOString(),status:'new',jobId:job.id,jobTitle:job.title,name:safe(req.body.name),email:safe(req.body.email),phone:safe(req.body.phone),location:safe(req.body.location),linkedin:safe(req.body.linkedin),workAuthorization:safe(req.body.workAuthorization),message:safe(req.body.message),resume:req.file.filename,originalResumeName:path.basename(req.file.originalname)};
  await store.insertApplication(item);
  notify(`New application: ${job.title}`,`${item.name}\n${item.email}\n${item.phone}\n${item.location}\n${item.workAuthorization}\n\n${item.message}`,item.email).catch(console.error);
  res.json({ok:true,message:'Thank you. Your application was received and will be reviewed by the SourceTX recruiting team.'});
}catch(e){next(e)}});
app.post('/api/contact',upload.none(),async(req,res,next)=>{try{
  if(!['name','email','message','consent'].every(k=>safe(req.body[k])))throw new Error('Please complete all required fields and provide consent.');
  const item={id:uid(),submittedAt:new Date().toISOString(),status:'new',name:safe(req.body.name),email:safe(req.body.email),phone:safe(req.body.phone),topic:safe(req.body.topic),message:safe(req.body.message)};
  await store.insertMessage(item);
  notify(`Website message: ${item.topic}`,`${item.name}\n${item.email}\n${item.phone}\n\n${item.message}`,item.email).catch(console.error);
  res.json({ok:true,message:'Thank you. Your message has been sent to SourceTX.'});
}catch(e){next(e)}});
app.post('/api/talent-request',upload.none(),async(req,res,next)=>{try{
  if(!['name','company','email','needs','consent'].every(k=>safe(req.body[k])))throw new Error('Please complete all required fields and provide consent.');
  const item={id:uid(),submittedAt:new Date().toISOString(),status:'new',name:safe(req.body.name),company:safe(req.body.company),email:safe(req.body.email),phone:safe(req.body.phone),service:safe(req.body.service),targetDate:safe(req.body.targetDate),needs:safe(req.body.needs)};
  await store.insertTalentRequest(item);
  notify(`Talent request: ${item.company}`,`${item.name}\n${item.email}\n${item.phone}\n${item.service}\n${item.targetDate}\n\n${item.needs}`,item.email).catch(console.error);
  res.json({ok:true,message:'Thank you. A SourceTX specialist will contact you about your request.'});
}catch(e){next(e)}});
app.post('/api/chat',async(req,res,next)=>{try{
  const message=safe(req.body.message);
  if(!message)return res.status(400).json({ok:false,message:'Please enter a question.'});
  if(message.length>500)return res.status(400).json({ok:false,message:'That question is too long (500 character limit).'});
  const email=safe(req.body.email);
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({ok:false,message:'Please provide a valid email address.'});
  const r=chatAnswer(message);
  if(r.fallback){
    const item={id:uid(),submittedAt:new Date().toISOString(),status:'new',email:email||'',question:message,intent:r.intent||'none',read:false};
    await store.insertChatCapture(item).catch(console.error);
    notify(`Chat: unanswered question`,`${item.question}\n\n${item.email||'No email provided'}`,item.email||undefined).catch(console.error);
  }
  res.json({ok:true,reply:r.reply,followups:r.followups||[],fallback:r.fallback});
}catch(e){next(e)}});

function adminAuth(req,res,next){const user=process.env.ADMIN_USER||'admin',pass=process.env.ADMIN_PASSWORD||'change-me-before-publishing';const h=req.headers.authorization||'';if(h.startsWith('Basic ')){const [u,p]=Buffer.from(h.slice(6),'base64').toString().split(':');if((u||'').length===user.length&&(p||'').length===pass.length&&crypto.timingSafeEqual(Buffer.from(u||''),Buffer.from(user))&&crypto.timingSafeEqual(Buffer.from(p||''),Buffer.from(pass)))return next()}res.set('WWW-Authenticate','Basic realm="SourceTX Admin"').status(401).send('Authentication required.');}
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]).filter(k=>k!=='resume');const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return [keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\n')}
app.get('/admin',adminAuth,(req,res)=>res.sendFile(path.join(ROOT,'admin','admin.html')));
app.get('/admin/admin.js',adminAuth,(req,res)=>res.type('application/javascript').sendFile(path.join(ROOT,'admin','admin.js')));
app.get('/api/admin/jobs',adminAuth,(req,res)=>res.json({ok:true,data:jobsStore.list()}));
app.post('/api/admin/jobs',adminAuth,(req,res,next)=>{try{
  const {title,location,type,department,posted,summary,description,responsibilities,requirements,skills}=req.body||{};
  if(!safe(title))return res.status(400).json({ok:false,message:'Title is required.'});
  const job=jobsStore.upsert({title:safe(title),location:safe(location),type:safe(type),department:safe(department),posted:safe(posted)||new Date().toISOString().slice(0,10),summary:safe(summary),description:safe(description),responsibilities:Array.isArray(responsibilities)?responsibilities.map(safe):[],requirements:Array.isArray(requirements)?requirements.map(safe):[],skills:Array.isArray(skills)?skills.map(safe):[],active:true});
  notify(`New job posted: ${job.title}`,`Title: ${job.title}\nLocation: ${job.location||'—'}\nType: ${job.type||'—'}\nDepartment: ${job.department||'—'}\n\n${job.summary||''}`).catch(console.error);
  res.json({ok:true,data:job});
}catch(e){next(e)}});
app.put('/api/admin/jobs/:id',adminAuth,(req,res,next)=>{try{
  const {id}=req.params;const existing=jobsStore.find(id);if(!existing)return res.status(404).json({ok:false,message:'Job not found'});
  const b=req.body||{};
  if(b.active===false||b.active===true){const job=jobsStore.setActive(id,b.active);return res.json({ok:true,data:job})}
  if(b.title!==undefined&&!safe(b.title))return res.status(400).json({ok:false,message:'Title is required.'});
  const patch={};
  for(const k of ['title','location','type','department','posted','summary','description']){if(b[k]!==undefined)patch[k]=safe(b[k])}
  for(const k of ['responsibilities','requirements']){if(Array.isArray(b[k]))patch[k]=b[k].map(safe)}
  if(Array.isArray(b.skills))patch.skills=b.skills.map(safe);
  const job=jobsStore.upsert({...existing,...patch});
  res.json({ok:true,data:job});
}catch(e){next(e)}});
app.get('/api/admin/:kind',adminAuth,async(req,res,next)=>{try{
  const list={'applications':()=>store.listApplications(),'messages':()=>store.listMessages(),'talent-requests':()=>store.listTalentRequests(),'chat-captures':()=>store.listChatCaptures()};
  const fn=list[req.params.kind];if(!fn)return res.status(404).json({ok:false,message:'Unknown kind'});res.json({ok:true,data:await fn()});
}catch(e){next(e)}});
app.post('/api/admin/:kind/:id/read',adminAuth,async(req,res,next)=>{try{
  const kind=req.params.kind;if(!['applications','messages','talent-requests','chat-captures'].includes(kind))return res.status(404).json({ok:false,message:'Unknown kind'});
  await store.markRead(kind,req.params.id,req.body.read!==false);res.json({ok:true});
}catch(e){next(e)}});
app.post('/api/admin/:kind/:id/reply',adminAuth,async(req,res,next)=>{try{
  const kind=req.params.kind;if(!['applications','messages','talent-requests'].includes(kind))return res.status(404).json({ok:false,message:'Unknown kind'});
  const to=safe(req.body.to),subject=safe(req.body.subject),body=safe(req.body.body);
  if(!to||!subject||!body)return res.status(400).json({ok:false,message:'to, subject, and body are required.'});
  if(!process.env.SMTP_HOST)return res.status(503).json({ok:false,message:'SMTP is not configured on this server.'});
  await sendMail({to,subject,text:body});await store.addReply(kind,req.params.id,{to,subject,body,at:new Date().toISOString()});
  res.json({ok:true,message:'Reply sent.'});
}catch(e){next(e)}});
app.get('/admin/export/:kind.csv',adminAuth,async(req,res,next)=>{try{
  const map={'applications':()=>store.listApplications(),'messages':()=>store.listMessages(),'talent-requests':()=>store.listTalentRequests(),'chat-captures':()=>store.listChatCaptures()},fn=map[req.params.kind];if(!fn)return res.sendStatus(404);const rows=await fn();
  res.type('text/csv').attachment(`${req.params.kind}.csv`).send(csv(rows));
}catch(e){next(e)}});
app.get('/health',(req,res)=>res.json({ok:true,service:'sourcetx',time:new Date().toISOString()}));
app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /uploads\nSitemap: ${(process.env.SITE_URL||'https://www.sourcetx.com')}/sitemap.xml\n`));
app.get('/sitemap.xml',(req,res)=>{const base=process.env.SITE_URL||'https://www.sourcetx.com';const urls=['','/about','/services','/job-seekers','/jobs','/employers','/contact','/general-application','/privacy','/terms','/talent-workforce','/cloud-infrastructure','/data-ai-analytics','/application-engineering','/cybersecurity-quality','/managed-services',...jobs().map(j=>'/jobs/'+j.id)];res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`)});
app.use((req,res)=>res.status(404).sendFile(page('404.html')));
app.use((err,req,res,next)=>{console.error(err);if(req.file)fs.unlink(req.file.path,()=>{});res.status(400).json({ok:false,message:err.message||'Unable to process the request.'})});
getStore({env:process.env,dataDir:DATA}).then(s=>{store=s;app.listen(PORT,()=>console.log(`SourceTX is running at http://localhost:${PORT}`));}).catch(e=>{console.error('Failed to initialize storage:',e);process.exit(1)});
