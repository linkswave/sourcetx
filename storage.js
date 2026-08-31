const fs=require('fs');
const path=require('path');

const TABLES={
  applications:`
    CREATE TABLE IF NOT EXISTS applications (
      id VARCHAR(36) PRIMARY KEY,
      submittedAt DATETIME,
      status VARCHAR(16),
      jobId VARCHAR(64),
      jobTitle VARCHAR(200),
      name VARCHAR(200),
      email VARCHAR(200),
      phone VARCHAR(64),
      location VARCHAR(200),
      linkedin VARCHAR(255),
      workAuthorization VARCHAR(64),
      message TEXT,
      resume VARCHAR(255),
      originalResumeName VARCHAR(255),
      isRead TINYINT(1) DEFAULT 0,
      replies TEXT
    )`,
  messages:`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(36) PRIMARY KEY,
      submittedAt DATETIME,
      status VARCHAR(16),
      name VARCHAR(200),
      email VARCHAR(200),
      phone VARCHAR(64),
      topic VARCHAR(200),
      message TEXT,
      isRead TINYINT(1) DEFAULT 0,
      replies TEXT
    )`,
  talent_requests:`
    CREATE TABLE IF NOT EXISTS talent_requests (
      id VARCHAR(36) PRIMARY KEY,
      submittedAt DATETIME,
      status VARCHAR(16),
      name VARCHAR(200),
      company VARCHAR(200),
      email VARCHAR(200),
      phone VARCHAR(64),
      service VARCHAR(200),
      targetDate VARCHAR(64),
      needs TEXT,
      isRead TINYINT(1) DEFAULT 0,
      replies TEXT
    )`,
  chat_captures:`
    CREATE TABLE IF NOT EXISTS chat_captures (
      id VARCHAR(36) PRIMARY KEY,
      submittedAt DATETIME,
      status VARCHAR(16),
      email VARCHAR(200),
      question TEXT,
      intent VARCHAR(64),
      isRead TINYINT(1) DEFAULT 0,
      replies TEXT
    )`
};

const toMysql=(iso)=>new Date(iso).toISOString().slice(0,19).replace('T',' ');
const row=(r)=>({...r,submittedAt:r.submittedAt instanceof Date?r.submittedAt.toISOString():r.submittedAt,read:!!r.isRead,replies:typeof r.replies==='string'?(safeJson(r.replies)):[]});

const safeJson=(s)=>{try{const v=JSON.parse(s);return Array.isArray(v)?v:[]}catch{return []}};
const norm=(item)=>({...item,read:!!item.read,replies:Array.isArray(item.replies)?item.replies:[]});

class JsonStore {
  constructor(dataDir){
    this.dir=dataDir;
    this.files={applications:'applications.json',messages:'messages.json',talent_requests:'talent_requests.json',chat_captures:'chat_captures.json'};
  }
  read(file){const p=path.join(this.dir,this.files[file]);try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return []}}
  write(file,data){const p=path.join(this.dir,this.files[file]);const tmp=p+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,p)}
  async insertApplication(item){const f='applications',a=this.read(f);a.unshift(norm(item));this.write(f,a)}
  async insertMessage(item){const f='messages',a=this.read(f);a.unshift(norm(item));this.write(f,a)}
  async insertTalentRequest(item){const f='talent_requests',a=this.read(f);a.unshift(norm(item));this.write(f,a)}
  async insertChatCapture(item){const f='chat_captures',a=this.read(f);a.unshift(norm(item));this.write(f,a)}
  async listApplications(){return this.read('applications').map(norm)}
  async listMessages(){return this.read('messages').map(norm)}
  async listTalentRequests(){return this.read('talent_requests').map(norm)}
  async listChatCaptures(){return this.read('chat_captures').map(norm)}
  async updateRecord(file,id,fn){const a=this.read(file).map(r=>r.id===id?fn(norm(r)):r);this.write(file,a);return a.find(r=>r.id===id)}
  async markRead(kind,id,read){const f=this.fileKey(kind);await this.updateRecord(f,id,r=>({...r,read}));return {ok:true}}
  async addReply(kind,id,reply){const f=this.fileKey(kind);const rec=await this.updateRecord(f,id,r=>({...r,read:true,replies:[...(r.replies||[]),reply]}));return {ok:true,record:rec}}
  fileKey(kind){return ({applications:'applications',messages:'messages','talent-requests':'talent_requests','chat-captures':'chat_captures'})[kind]||'talent_requests'}
}

class MySqlStore {
  constructor(pool){
    this.pool=pool;
  }
  async init(){
    for(const [table,sql] of Object.entries(TABLES))await this.pool.query(sql);
    for(const table of Object.keys(TABLES)){
      const [cols]=await this.pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`,[table]);
      const names=new Set(cols.map(c=>c.COLUMN_NAME));
      if(!names.has('isRead'))await this.pool.query(`ALTER TABLE ${table} ADD COLUMN isRead TINYINT(1) DEFAULT 0`);
      if(!names.has('replies'))await this.pool.query(`ALTER TABLE ${table} ADD COLUMN replies TEXT`);
    }
  }
  async insertApplication(item){
    item=norm(item);
    await this.pool.query(
      `INSERT INTO applications (id,submittedAt,status,jobId,jobTitle,name,email,phone,location,linkedin,workAuthorization,message,resume,originalResumeName,isRead,replies)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [item.id,toMysql(item.submittedAt),item.status,item.jobId,item.jobTitle,item.name,item.email,item.phone,item.location,item.linkedin,item.workAuthorization,item.message,item.resume,item.originalResumeName,item.read?1:0,JSON.stringify(item.replies||[])]
    );
  }
  async insertMessage(item){
    item=norm(item);
    await this.pool.query(
      `INSERT INTO messages (id,submittedAt,status,name,email,phone,topic,message,isRead,replies)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [item.id,toMysql(item.submittedAt),item.status,item.name,item.email,item.phone,item.topic,item.message,item.read?1:0,JSON.stringify(item.replies||[])]
    );
  }
  async insertTalentRequest(item){
    item=norm(item);
    await this.pool.query(
      `INSERT INTO talent_requests (id,submittedAt,status,name,company,email,phone,service,targetDate,needs,isRead,replies)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [item.id,toMysql(item.submittedAt),item.status,item.name,item.company,item.email,item.phone,item.service,item.targetDate,item.needs,item.read?1:0,JSON.stringify(item.replies||[])]
    );
  }
  async insertChatCapture(item){
    item=norm(item);
    await this.pool.query(
      `INSERT INTO chat_captures (id,submittedAt,status,email,question,intent,isRead,replies)
       VALUES (?,?,?,?,?,?,?,?)`,
      [item.id,toMysql(item.submittedAt),item.status,item.email,item.question,item.intent,item.read?1:0,JSON.stringify(item.replies||[])]
    );
  }
  async listApplications(){
    const [rows]=await this.pool.query('SELECT * FROM applications ORDER BY submittedAt DESC');
    return rows.map(row);
  }
  async listMessages(){
    const [rows]=await this.pool.query('SELECT * FROM messages ORDER BY submittedAt DESC');
    return rows.map(row);
  }
  async listTalentRequests(){
    const [rows]=await this.pool.query('SELECT * FROM talent_requests ORDER BY submittedAt DESC');
    return rows.map(row);
  }
  async listChatCaptures(){
    const [rows]=await this.pool.query('SELECT * FROM chat_captures ORDER BY submittedAt DESC');
    return rows.map(row);
  }
  async table(kind){return ({applications:'applications',messages:'messages','talent-requests':'talent_requests','chat-captures':'chat_captures'})[kind]||'talent_requests'}
  async markRead(kind,id,read){await this.pool.query(`UPDATE ${await this.table(kind)} SET isRead=? WHERE id=?`,[read?1:0,id]);return {ok:true}}
  async addReply(kind,id,reply){
    const t=await this.table(kind);
    const [rows]=await this.pool.query(`SELECT replies FROM ${t} WHERE id=?`,[id]);
    const replies=safeJson(rows[0]?.replies);
    replies.push(reply);
    await this.pool.query(`UPDATE ${t} SET replies=?, isRead=1 WHERE id=?`,[JSON.stringify(replies),id]);
    return {ok:true};
  }
}

const slugify=(s)=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||('job-'+Date.now());

class JsonJobs {
  constructor(file){this.file=file}
  read(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'))}catch{return []}}
  write(data){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,this.file)}
  list(){return this.read()}
  find(id){return this.read().find(j=>j.id===id)}
  upsert(job){
    const a=this.read();
    if(!job.id){job={...job,id:slugify(job.title)};}
    const i=a.findIndex(j=>j.id===job.id);
    if(i>=0){a[i]={...a[i],...job}}else{a.unshift(job)}
    this.write(a);
    return job;
  }
  setActive(id,active){const a=this.read().map(j=>j.id===id?{...j,active:active!==false}:j);this.write(a);return a.find(j=>j.id===id)}
}

async function getStore({env,dataDir}){
  const {DB_HOST,DB_PORT,DB_USER,DB_PASSWORD,DB_NAME}=env;
  if(!(DB_HOST&&DB_USER&&DB_PASSWORD&&DB_NAME))return new JsonStore(dataDir);
  try{
    const mysql=require('mysql2/promise');
    const pool=mysql.createPool({
      host:DB_HOST,port:Number(DB_PORT||3306),user:DB_USER,password:DB_PASSWORD,database:DB_NAME,
      waitForConnections:true,connectionLimit:5,queueLimit:0
    });
    await pool.query('SELECT 1');
    const store=new MySqlStore(pool);
    await store.init();
    console.log('MySQL storage active');
    return store;
  }catch(e){
    console.warn(`MySQL unavailable (${e.message}); falling back to JSON storage`);
    return new JsonStore(dataDir);
  }
}

module.exports={getStore,JsonStore,MySqlStore,JsonJobs};
