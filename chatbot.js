const fs=require('fs');
const path=require('path');

const KNOWLEDGE=path.join(__dirname,'data','chatbot.json');
const CONFIDENCE_THRESHOLD=0.6;

const STOPWORDS=new Set('what is the a an are how do does you your i me to of for and or in on with can tell about my we our have any there it that this as at be by please just like need want would could should'.split(' '));

const ALIASES=[
  ['résumé','resume'],
  ['resumes','resume'],
  ['cvs','resume'],
  ['cv','resume'],
  ['ai','artificial intelligence'],
  ['ml','machine learning'],
  ['sre','site reliability'],
  ['msp','managed services'],
  ['devops','devops'],
  ['info@sourcetx.com','contact email']
];

function normPhrase(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9@.\s-]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function expandAliases(s){
  for(const [alias,canonical] of ALIASES){
    const re=new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9]|$)`,'g');
    s=s.replace(re,(m,a,b)=>a+canonical+b);
  }
  return s;
}

function tokenize(s){
  const expanded=expandAliases(s);
  return expanded.split(' ').filter(t=>t&&!STOPWORDS.has(t));
}

function loadKnowledge(){
  try{
    const d=JSON.parse(fs.readFileSync(KNOWLEDGE,'utf8'));
    return Array.isArray(d)?d:[];
  }catch(e){
    console.error('chatbot: failed to load knowledge base',e);
    return [];
  }
}

function normalizeKeyword(k){
  return normPhrase(expandAliases(k));
}

function matchIntent(intent,normalizedMsg,compact){
  let score=0;
  for(const [phrase,weight] of Object.entries(intent.keywords||{})){
    const norm=normalizeKeyword(phrase);
    if(!norm)continue;
    if(norm.includes(' ')){
      if(compact.includes(norm))score+=weight;
    }else{
      if(compact.includes(' '+norm+' ')||compact===norm||compact.startsWith(norm+' ')||compact.endsWith(' '+norm))score+=weight;
    }
  }
  return score;
}

const FALLBACK="I'm not sure I understood that. Try asking about our services, open jobs, how to apply, or how to contact us — or use the contact page and a SourceTX specialist will follow up with you.";

function answer(message){
  const normalized=normPhrase(message);
  const compact=tokenize(normalized).join(' ');
  const intents=loadKnowledge();
  let best=null,bestScore=0;
  for(const intent of intents){
    const s=matchIntent(intent,normalized,compact);
    if(s>bestScore){bestScore=s;best=intent;}
  }
  if(best&&bestScore>0){
    const confidence=bestScore/(bestScore+2);
    if(confidence>=CONFIDENCE_THRESHOLD){
      return {reply:best.answer,followups:best.followups||[],confidence,fallback:false,intent:best.id};
    }
  }
  return {reply:FALLBACK,followups:['What services do you offer?','Are there open jobs?','How can I contact SourceTX?'],confidence:0,fallback:true,intent:best?best.id:'none'};
}

module.exports={answer,CONFIDENCE_THRESHOLD};
