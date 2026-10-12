// Swedent automated trial runner. Loads the real page script into an emulated DOM and drives every flow.
"use strict";
const fs=require("fs"),vm=require("vm");
const {Document,Ev,parseHTML}=require("./dom");
const {makePersonas,rng,FIELDS}=require("./personas");
const SITE=require("path").resolve(__dirname,"..");
const HTML=fs.readFileSync(SITE+"/index.html","utf8");
const SCRIPT=HTML.slice(HTML.indexOf("<script>")+8,HTML.lastIndexOf("</script>"));
const MARKUP=HTML.slice(0,HTML.indexOf("<script>"));
const DATA={labs:JSON.parse(fs.readFileSync(SITE+"/data/labs.json")),jobs:JSON.parse(fs.readFileSync(SITE+"/data/jobs.json")),meta:JSON.parse(fs.readFileSync(SITE+"/data/meta.json"))};
const N=+(process.argv[2]||100);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let CURRENT=null;
process.on("unhandledRejection",e=>{if(CURRENT)CURRENT.errors.push({where:"unhandledRejection",msg:String(e&&(e.stack||e.message||JSON.stringify(e))||e)})});

/* ---------------- Claude mock ---------------- */
const STOP=new Set("and the of in for with a an to on at by from or as is are was be this that your you i my our de och i en ett".split(" "));
const words=s=>new Set(String(s).toLowerCase().split(/[^a-z0-9åäöé+#]+/).filter(w=>w.length>2&&!STOP.has(w)));
function matchAnswer(text,mode){
  const data=JSON.parse(text.slice(text.lastIndexOf("DATA:\n")+6));
  const cvStart=text.indexOf("STUDENT CV:\n")+12,cvEnd=text.indexOf("\n\nDATA:");
  const cv=words(text.slice(cvStart,cvEnd)+" "+(text.match(/STUDENT GOAL: (.*)/)||["",""])[1]);
  const items=data.labs.map(l=>({kind:"lab",id:l.id,w:words([l.name,l.topics.join(" "),l.fields.join(" "),l.summary].join(" ")),topics:l.topics})).concat(data.jobs.map(j=>({kind:"job",id:j.id,w:words([j.title,(j.fields||[]).join(" "),j.summary,j.kind].join(" ")),topics:j.fields||[]})));
  const scored=items.map(it=>{const hit=[...cv].filter(w=>it.w.has(w));return {...it,hit,s:hit.length}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,8);
  let matches=scored.map(x=>({kind:x.kind,id:x.id,band:x.s>=4?"strong":x.s>=2?"good":"possible",reasons:x.hit.slice(0,3).map((h,i)=>({you:h,them:x.topics[i%Math.max(1,x.topics.length)]||h})),gap:x.s<2?"Limited direct experience":""}));
  if(mode==="empty")matches=[];
  if(mode==="badids")matches=[{kind:"lab",id:"does-not-exist",band:"strong",reasons:[]},{kind:"job",id:"nope-1",band:"good"}].concat(matches.slice(0,2));
  if(mode==="weird")matches=matches.map((m,i)=>i%2?{...m,band:undefined,reasons:"not an array",gap:null}:{...m,kind:"LAB",reasons:[{you:null,them:undefined}]});
  if(mode==="nulljson")return "null";
  if(mode==="noprofile")return JSON.stringify({matches});
  return JSON.stringify({profile:"Student with a background in "+[...cv].slice(0,3).join(", "),matches});
}
function chatAnswer(text,mode){
  const data=JSON.parse(text.slice(text.lastIndexOf("DATA: ")+6).split("\n")[0]||"{}");
  const l=data.labs||[],j=data.jobs||[];
  if(mode==="chatlong")return ("Here are some options. ".repeat(80))+` [lab:${l[0]&&l[0].id}]`;
  return `Here are labs that fit:\n\n- [lab:${l[0]&&l[0].id}] works on related topics\n- [lab:${l[1]&&l[1].id}] also relevant\n- [lab:fake-lab-id] (should be ignored)\n\nOpen role: [job:${j[0]&&j[0].id}] **closes soon**.`;
}
function makeClaude(mode,log){
  const sample=async(input,opts={})=>{
    log.sampleCalls++;
    const text=typeof input==="string"?input:input.map(m=>m.content).join("\n");
    if(typeof input!=="string"){if(!input.length||input[0].role!=="user"||input[input.length-1].role!=="user")throw {code:"invalid_request",message:"turns must start and end with user"};}
    if(new TextEncoder().encode(text).length>262144)throw {code:"prompt_too_large",message:"too big"};
    await delay(3);
    if(opts.signal&&opts.signal.aborted)throw {code:"cancelled"};
    if(mode==="not_granted")throw {code:"not_granted",message:"no"};
    if(mode==="rate_limited")throw {code:"rate_limited",message:"slow down"};
    if(mode==="upstream")throw {code:"upstream_error",message:"boom",text:"partial"};
    let out;
    if(text.includes("You match a university student"))out=matchAnswer(text,mode);
    else if(text.includes("Write a short first email"))out=mode==="weird"?JSON.stringify({subject:null}):JSON.stringify({subject:"Question about thesis opportunities",body:"Dear Professor,\n\nI am writing about ...\n\nBest regards,\n[Your name]"});
    else out=chatAnswer(text,mode);
    if(opts.onText){for(let k=1;k<=3;k++){opts.onText({text:out.slice(0,Math.ceil(out.length*k/3)),delta:"x"});await delay(1);}}
    return {text:out,truncated:false,modelTierApplied:"default"};
  };
  sample.json=async(i,o)=>{const r=await sample(i,o);if(mode==="invalid_json")throw {code:"invalid_json",message:"bad",text:r.text};try{return JSON.parse(r.text)}catch(e){throw {code:"invalid_json",message:"x",text:r.text}}};
  sample.limits=async()=>({maxPromptBytes:262144});
  return sample;
}
function makeDb(store,mode){
  return {doc:p=>({get:async()=>{if(mode==="dbfail")throw {code:"unavailable"};return {exists:store.has(p),data:()=>store.get(p)}},set:async o=>{if(mode==="dbfail")throw {code:"invalid_argument"};store.set(p,JSON.parse(JSON.stringify(o)))},delete:async()=>{store.delete(p)},update:async o=>{store.set(p,{...store.get(p),...o})}}),collection:()=>({})};
}

/* ---------------- page loader ---------------- */
function loadPage(opt){
  const doc=new Document();doc.body.append(...parseHTML(MARKUP,doc));
  const timers=new Set(),intervals=new Set();
  const storage=opt.storage;
  const win={document:doc,console:{log(){},warn(){},error:(...a)=>doc._error(a.join(" "),"console.error"),info(){}}};
  win.window=win;win.self=win;win.globalThis=win;doc.defaultView=win;win._ls={};win.addEventListener=(t,f)=>{(win._ls[t]=win._ls[t]||[]).push(f)};win.removeEventListener=()=>{};
  win.localStorage={getItem:k=>{if(opt.storageThrows)throw new Error("SecurityError");return storage.has(k)?storage.get(k):null},setItem:(k,v)=>{if(opt.storageThrows)throw new Error("SecurityError");storage.set(k,String(v))},removeItem:k=>storage.delete(k)};
  win.matchMedia=q=>({matches:/reduce/.test(q)?!!opt.reduce:(/hover/.test(q)?!!opt.hover:false),addEventListener(){}});
  win.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(e){win.setTimeout(()=>this.cb([{isIntersecting:true,target:e}]),0)}unobserve(){}disconnect(){}};
  win.MutationObserver=class{constructor(cb){this.cb=cb}observe(t){doc._observers.push({target:t,cb:this.cb,q:[]})}disconnect(){}};
  win.requestAnimationFrame=cb=>win.setTimeout(()=>cb(Date.now()),0);
  win.performance={now:()=>performance.now()};
  win.navigator={clipboard:{writeText:t=>{win._clip=t;return opt.clipFail?Promise.reject(new Error("NotAllowed")):Promise.resolve()}}};
  win.location={hash:opt.hash||""};
  win.fetch=async p=>{await delay(2);if(opt.fetchFail)return {ok:false,json:async()=>({})};const f=SITE+"/"+p;return {ok:true,json:async()=>JSON.parse(fs.readFileSync(f,"utf8"))}};
  const scale=ms=>opt.fast?Math.min(ms||0,4):ms;
  win.setTimeout=(f,ms,...a)=>{const id=setTimeout(()=>{timers.delete(id);try{f(...a)}catch(e){doc._error(e,"setTimeout")}},scale(ms));timers.add(id);return id};
  win.clearTimeout=id=>{clearTimeout(id);timers.delete(id)};
  win.setInterval=(f,ms,...a)=>{const id=setInterval(()=>{try{f(...a)}catch(e){doc._error(e,"setInterval")}},Math.max(scale(ms),opt.fast?20:ms));intervals.add(id);return id};
  win.clearInterval=id=>{clearInterval(id);intervals.delete(id)};
  win.scrollTo=()=>{};win.getComputedStyle=()=>({});
  win.AbortController=AbortController;win.queueMicrotask=queueMicrotask;win.TextEncoder=TextEncoder;win.URL=URL;win.Event=Ev;
  win.FileReader=class{};
  const log=opt.log;
  if(opt.claude){const mocks={sample:opt.sampleMode==="absent"?null:makeClaude(opt.sampleMode,log),db:opt.account?makeDb(opt.dbStore,opt.dbMode):null,user:opt.account?{me:async()=>({id:"u_test",name:"Test Student",avatarUrl:"data:image/png;base64,AA==",color:"#123",email:null,isOwner:false,canEdit:false}),id:async()=>"u_test"}:null,downloads:{save:async()=>{log.downloads++}}};
    win.claude={use:async n=>{await delay(1);return mocks[n]??null}};}
  const ctx=vm.createContext(win);
  const t0=performance.now();
  try{vm.runInContext(SCRIPT,ctx,{filename:"page.js"})}catch(e){doc._error(e,"script-eval")}
  return {doc,win,t0,teardown(){timers.forEach(clearTimeout);intervals.forEach(clearInterval)}};
}

/* ---------------- helpers ---------------- */
function isVisible(el){let n=el;while(n&&n.nodeType===1){if(n.hasAttribute("hidden"))return false;n=n.parentNode}return true}
function visibleText(root){let out="";const rec=n=>{if(n.nodeType===3){out+=n.nodeValue+" ";return}if(n.nodeType!==1)return;if(n.hasAttribute("hidden"))return;if(["script","style","template","svg"].includes(n.localName))return;n.childNodes.forEach(rec)};rec(root);return out.replace(/\s+/g," ")}
function currentView(doc){const v=doc.querySelectorAll(".view").filter(isVisible);return v.map(x=>x.id)}
async function waitFor(fn,ms=3000,step=5){const t=performance.now();while(performance.now()-t<ms){try{const r=fn();if(r)return r}catch(e){}await delay(step)}return null}
function setVal(win,el,v){el.value=v;el.dispatchEvent(new Ev("input",{bubbles:true}));el.dispatchEvent(new Ev("change",{bubbles:true}))}

/* ---------------- one trial ---------------- */
async function trial(p,idx){
  const r=rng(1000+idx);
  const modes=["ok","ok","ok","ok","ok","ok","badids","weird","empty","invalid_json","rate_limited","not_granted","upstream","absent","noprofile","nulljson","chatlong"];
  const sampleMode=modes[idx%modes.length];
  const account=r()<.5,dbMode=r()<.15?"dbfail":"ok";
  const lang=r()<.3?"sv":"en";
  const storage=new Map();if(lang==="sv")storage.set("sw.lang","sv");
  const res={idx,persona:p.key,mode:sampleMode,account,dbMode,lang,steps:[],errors:[],textIssues:[],timing:{},match:null,i18nLeft:[],log:{sampleCalls:0,downloads:0}};
  CURRENT=res;
  const dbStore=new Map();
  const opts={storage,claude:sampleMode!=="noclaude",sampleMode,account,dbMode,dbStore,log:res.log,fast:true,reduce:idx%5!==0,hover:idx%3===0,clipFail:idx%7===0,storageThrows:idx%23===11};
  let pg=loadPage(opts);let {doc,win}=pg;
  const $=s=>doc.querySelector(s),$$=s=>doc.querySelectorAll(s);
  const step=async(name,fn)=>{const before=doc.errors.length;const t=performance.now();let ok=true,msg="";try{const out=await fn();if(out===false){ok=false;msg="check failed"}else if(typeof out==="string"){ok=false;msg=out}}catch(e){ok=false;msg=String(e&&e.stack||e).split("\n").slice(0,2).join(" | ")}
    const newErr=doc.errors.slice(before);if(newErr.length){ok=false;msg=(msg?msg+" ; ":"")+newErr.map(e=>e.where+": "+e.msg.split("\n").slice(0,2).join(" | ")).join(" ; ")}
    const vt=visibleText(doc.body);const bad=(vt.match(/\b(undefined|NaN|\[object Object\])\b/g)||[]);if(bad.length)res.textIssues.push({step:name,found:[...new Set(bad)],ctx:vt.slice(Math.max(0,vt.search(/\b(undefined|NaN|\[object Object\])\b/)-80),vt.search(/\b(undefined|NaN|\[object Object\])\b/)+60)});
    res.steps.push({name,ok,msg,ms:+(performance.now()-t).toFixed(1)});};
  const click=el=>{if(!el)throw new Error("element missing");el.click()};
  const goNav=v=>{const b=doc.querySelectorAll("[data-go]").find(b=>b.dataset.go===v);click(b)};

  await step("boot",async()=>{const ok=await waitFor(()=>$("#labcar").children.length>0&&$("#jobs").children.length>0,4000);res.timing.boot=+(performance.now()-pg.t0).toFixed(1);if(!ok)return "listings did not render";
    if(currentView(doc).join()!=="v-home")return "home not the only visible view: "+currentView(doc);
    await waitFor(()=>+$("#s-jobs").textContent>0,2000);const n=+$("#s-jobs").textContent;if(!(n>0))return "job counter is "+$("#s-jobs").textContent;
    if(lang==="sv"&&!opts.storageThrows&&doc.documentElement.getAttribute("lang")!=="sv")return "Swedish preference not applied on load";});
  await step("cookie-banner",async()=>{const ck=$("#cookie");if(opts.storageThrows)return;if(!isVisible(ck))return "cookie banner not shown on first visit";const c=r();click(c<.6?$("#ck-all"):c<.85?$("#ck-ess"):$("#ck-set"));if(isVisible(ck))return "banner still visible after choice";});
  await step("nav-dropdowns",async()=>{for(const dd of $$(".dd")){click(dd.querySelector(".dd-btn"));if(!isVisible(dd.querySelector(".dd-panel")))return "dropdown did not open";const items=dd.querySelectorAll(".dd-item");if(!items.length)return "dropdown empty: "+dd.querySelector(".dd-btn").textContent.trim();
      const it=items[Math.floor(r()*items.length)];click(it);await delay(2);const v=currentView(doc)[0];if(!["v-openings","v-labs","v-directory"].includes(v))return "dropdown item led to "+v;if(dd.querySelector(".dd-panel")&&isVisible(dd.querySelector(".dd-panel")))return "dropdown stayed open after navigation";}
    // empty results after preset?
    const v=currentView(doc)[0];if(v==="v-openings"&&$("#jobs").querySelector(".empty"))res.textIssues.push({step:"nav-dropdowns",found:["empty result from menu preset"],ctx:$("#jcount").textContent});});
  await step("hero-search",async()=>{goNav("home");const q=p.skills[0];setVal(win,$("#hs-q"),q);const sel=$("#hs-uni");const os=sel.options;sel.value=os[Math.floor(r()*os.length)].value;$("#herosearch").requestSubmit();await delay(2);
    if(currentView(doc)[0]!=="v-openings")return "search did not open jobs";const m=$("#jcount").textContent.match(/^(\d+) (of|av) (\d+)/);if(!m)return "count text odd: "+$("#jcount").textContent;const cards=$("#jobs").querySelectorAll("article").length;if(+m[1]!==cards)return `count says ${m[1]} but ${cards} cards`;res.heroHits=+m[1];});
  await step("job-filters",async()=>{for(let k=0;k<4;k++){const f=$("#jfield"),kd=$("#jkind"),o=$("#jorg");setVal(win,$("#jq"),r()<.5?"":p.skills[Math.floor(r()*p.skills.length)]);[f,kd,o].forEach(s=>{const os=s.options;s.value=os[Math.floor(r()*os.length)].value;s.dispatchEvent(new Ev("change",{bubbles:true}))});["#jstudent","#jsoon","#jsaved"].forEach(id=>{if(r()<.3)click($(id))});
      const m=$("#jcount").textContent.match(/^(\d+)/);const cards=$("#jobs").querySelectorAll("article").length;if(!m||+m[1]!==cards)return "count mismatch "+$("#jcount").textContent+" vs "+cards;}
    ["#jstudent","#jsoon","#jsaved"].forEach(id=>{if($(id).getAttribute("aria-pressed")==="true")click($(id))});setVal(win,$("#jq"),"");["#jfield","#jkind","#jorg"].forEach(id=>{$(id).value="";$(id).dispatchEvent(new Ev("change",{bubbles:true}))});});
  await step("job-detail",async()=>{goNav("openings");const cards=$("#jobs").querySelectorAll("article");if(!cards.length)return "no job cards";const c=cards[Math.floor(r()*cards.length)];const title=c.querySelector("h3").textContent;c.click();await delay(2);
    if(currentView(doc)[0]!=="v-job")return "card click did not open job page";const h1=$("#v-job h1").textContent;if(h1!==title&&lang==="en")return "job page title mismatch";
    const save=$("#v-job").querySelectorAll("button").find(b=>/Save job|Saved|Spara jobb|Sparad/.test(b.textContent));click(save);
    const copy=$("#v-job").querySelectorAll("button").find(b=>/Copy details|Kopiera/.test(b.textContent));click(copy);await delay(2);
    const apply=$("#v-job").querySelector("a.btn.primary");if(!apply||!/^https?:\/\//.test(apply.getAttribute("href")))return "apply link missing/invalid";
    const sim=$("#v-job").querySelectorAll("article");if(sim.length){sim[0].click();await delay(2);if(currentView(doc)[0]!=="v-job"&&currentView(doc)[0]!=="v-lab")return "similar card click failed";}
    goNav("openings");click($("#jsaved"));const savedCount=$("#jobs").querySelectorAll("article").length;click($("#jsaved"));if(savedCount<1)return "saved job not listed under Saved jobs";});
  await step("lab-browse-detail",async()=>{goNav("labs");setVal(win,$("#lq"),p.skills[Math.floor(r()*p.skills.length)]);res.labSearchHits=$("#labs").querySelectorAll("article").length;setVal(win,$("#lq"),"");
    const cards=$("#labs").querySelectorAll("article");const c=cards[Math.floor(r()*cards.length)];const name=c.querySelector("h3").textContent;
    // star in list
    click(c.querySelector(".star"));c.click();await delay(2);if(currentView(doc)[0]!=="v-lab")return "lab card click did not open lab page";if(lang==="en"&&$("#v-lab h1").textContent!==name)return "lab page title mismatch";
    const srcs=$("#v-lab").querySelectorAll("a.src-row");if(!srcs.length)return "lab page has no sources";if(srcs.some(a=>!/^https?:\/\//.test(a.getAttribute("href"))))return "bad source href";});
  await step("email-draft",async()=>{const w=$("#v-lab").querySelectorAll("button").find(b=>/Write to this lab|Skriv till/.test(b.textContent));click(w);if(!isVisible($("#sheetbg")))return "email sheet did not open";
    setVal(win,$("#aboutme"),idx%10===9?"short":p.cv.slice(0,600));click(r()<.5?$("#tf"):$("#tw"));click($("#draft"));await waitFor(()=>!$("#draft").disabled,2000);await delay(10);
    const okMode=["ok","badids","empty","noprofile","nulljson","chatlong"].includes(sampleMode);
    if(idx%10===9){if(!$("#estatus").textContent)return "no feedback for too-short About you";}
    else if(okMode){if(!isVisible($("#emailout"))||!$("#esubj").value)return "draft not shown (mode "+sampleMode+")";click($("#copy"));await delay(3);}
    else if(!$("#estatus").textContent&&sampleMode!=="weird")return "no error shown for mode "+sampleMode;
    click($("#closesheet"));if(isVisible($("#sheetbg")))return "sheet did not close";});
  await step("directory",async()=>{goNav("directory");const rows=$("#dir").querySelectorAll("tr").length;if(rows<5)return "directory has "+rows+" rows";setVal(win,$("#dq"),p.skills[0]);const link=$("#dir").querySelector("td.lab a");if(link){link.click();await delay(2);if(currentView(doc)[0]!=="v-lab")return "directory link failed";}});
  await step("alerts",async()=>{goNav("alerts");setVal(win,$("#aname"),p.goal.slice(0,40));setVal(win,$("#akw"),p.skills.slice(0,2).join(", "));const f=$("#afield");const want=p.expect[0];if(want&&f.options.some(o=>o.value===want))f.value=want;if(r()<.4)click($("#astudent"));
    $("#alertform").requestSubmit();await delay(2);const cards=$("#alertlist").querySelectorAll(".alert-card");if(!cards.length)return "alert not created";res.alertMatches=cards[0].querySelectorAll(".alert-item").length;});
  await step("profile",async()=>{goNav("profile");setVal(win,$("#pf-name"),p.name);const u=$("#pf-uni");u.value=p.uni;if(u.value!==p.uni)u.value="Other";setVal(win,$("#pf-prog"),p.prog);$("#pf-level").value=p.level;$("#pf-year").value=p.year;setVal(win,$("#pf-int"),p.interests);
    setVal(win,$("#pf-li"),"linkedin.com/in/bad");$("#profform").requestSubmit();if(!$("#pfstatus").textContent)return "invalid LinkedIn accepted silently";
    setVal(win,$("#pf-li"),"https://www.linkedin.com/in/"+p.name.toLowerCase().replace(/[^a-z]+/g,"-"));if(r()<.5)click($("#pf-savecv"));$("#profform").requestSubmit();await delay(5);
    if($("#profname").textContent!==p.name)return "profile name not shown after save";});
  await step("cv-match",async()=>{goNav("match");setVal(win,$("#cv"),p.cv);setVal(win,$("#goal"),p.goal);const t=performance.now();click($("#go"));
    const shortCv=p.cv.length<60;
    const done=await waitFor(()=>{const res_=$("#results");return (res_.children.length&&!$("#go").disabled)||($("#mstatus").textContent&&!$("#go").disabled)||(isVisible($("#noai")))},6000);
    await delay(30);res.timing.match=+(performance.now()-t).toFixed(1);
    if(shortCv){if(!$("#mstatus").textContent)return "short CV gave no feedback";return}
    if(!done)return "CV Match never finished (mode "+sampleMode+")";
    const cards=$("#results").querySelectorAll("article");
    if(["ok","noprofile"].includes(sampleMode)){if(!cards.length&&!$("#results").querySelector(".empty"))return "no results and no empty message";
      // relevance benchmark: share of returned items whose fields overlap the persona's expected fields
      const ids=cards.map(c=>c.querySelector("h3").textContent);
      const items=ids.map(t=>DATA.labs.find(l=>l.name===t)||DATA.jobs.find(j=>j.title===t)).filter(Boolean);
      const rel=items.filter(it=>(it.fields||[]).some(f=>p.expect.includes(f))).length;
      res.match={returned:items.length,relevant:rel};
      const save=$("#results").querySelectorAll("button").find(b=>/Save results|Spara resultat/.test(b.textContent));if(save)click(save);
      const copy=$("#results").querySelectorAll("button").find(b=>/Copy results|Kopiera resultat/.test(b.textContent));if(copy){click(copy);await delay(3)}}
    else if(sampleMode==="badids"){if(cards.some(c=>!c.querySelector("h3").textContent))return "ghost card rendered"}
    else if(["invalid_json","rate_limited","upstream","nulljson"].includes(sampleMode)){if(!$("#mstatus").textContent&&!$("#results").querySelector(".empty"))return "no error shown for "+sampleMode;if(isVisible($("#thinkwrap"))&&sampleMode!=="nulljson")return "thinking animation left on screen after error"}
    else if(sampleMode==="not_granted"||sampleMode==="absent"){if(!isVisible($("#noai"))&&!$("#mstatus").textContent)return "no sign-in notice for "+sampleMode}
  });
  await step("chat",async()=>{click($("#mt-ask"));const sug=$("#suggest").querySelector("button");click(sug);await waitFor(()=>{const b=$("#chat").querySelectorAll(".msg.bot");return b.length&&!/Thinking|Tänker/.test(b[b.length-1].textContent)},3000);
    const bots=$("#chat").querySelectorAll(".msg.bot");if(["ok","badids","empty","noprofile","nulljson","weird"].includes(sampleMode)){if(!bots.length)return "no reply bubble";const refs=bots[bots.length-1].querySelectorAll(".ref");if(!refs.length)return "reply has no clickable lab/job links";if(refs.some(x=>/fake-lab-id/.test(x.textContent)))return "fake id rendered as link";refs[0].click();await delay(2);if(!["v-lab","v-job"].includes(currentView(doc)[0]))return "chat link did not open detail";}
    goNav("match");click($("#mt-cv"));});
  await step("language-switch",async()=>{const before=LANGNOW(doc);const btn=doc.querySelector("[data-langbtn]");click(btn);await delay(5);const now=doc.documentElement.getAttribute("lang");if(now===before)return "language did not change";
    if(now==="sv"){for(const v of ["home","openings","labs","alerts","match","profile"]){goNav(v);await delay(3);res.i18nLeft.push(...untranslated(doc,win))}}
    click(btn);await delay(5);if(doc.documentElement.getAttribute("lang")!==before)return "could not switch back";
    if(before==="en"&&!/Positions closing soon|Research jobs/.test(visibleText(doc.body))){goNav("home");if(!/Positions closing soon/.test(visibleText(doc.body)))return "English not restored"}});
  await step("recommendations",async()=>{goNav("home");await delay(5);res.foryou=isVisible($("#foryou"))?$("#forcar").children.length:0;});
  await step("reload-persistence",async()=>{const consent=storage.get("sw.consent");pg.teardown();pg=loadPage(opts);doc=pg.doc;win=pg.win;await waitFor(()=>doc.querySelector("#labcar").children.length>0,3000);await delay(account?20:5);
    const name=doc.querySelector("#pf-name").value;const shouldKeep=consent==="all"||(account&&dbMode==="ok");
    if(shouldKeep&&name!==p.name)return `profile lost after reload (consent=${consent}, account=${account})`;
    if(!shouldKeep&&!opts.storageThrows&&name===p.name&&!account)return "profile kept despite 'necessary only'";
    if(isVisible(doc.querySelector("#cookie"))&&consent)return "cookie banner shown again after choosing";});
  await step("delete-data",async()=>{if(idx%4)return;goNav("profile");const b=doc.querySelector("#pf-delete");click(b);click(b);await delay(10);if(doc.querySelector("#pf-name").value)return "data not cleared";});
  pg.teardown();CURRENT=null;
  res.errors.push(...doc.errors.map(e=>({where:e.where,msg:e.msg.split("\n").slice(0,3).join(" | ")})));
  return res;
}
function LANGNOW(doc){return doc.documentElement.getAttribute("lang")||"en"}
function untranslated(doc,win){
  // UI text nodes (outside listing content) that are known English UI strings but still shown in English
  return leftovers(doc);
}
let UIKEYS=null;
function leftovers(doc){
  if(!UIKEYS){const m=SCRIPT.match(/const SV=\{([\s\S]*?)\n\};/);UIKEYS=new Set();const re=/"((?:[^"\\]|\\.)*)":"/g;let x;while((x=re.exec(m[1])))UIKEYS.add(x[1].replace(/\\'/g,"'"));}
  const out=[];const rec=n=>{if(n.nodeType===3){const t=n.nodeValue.trim();if(t&&UIKEYS.has(t))out.push(t);return}if(n.nodeType!==1||n.hasAttribute("hidden")||n.hasAttribute("data-noi18n")||["script","style","svg"].includes(n.localName))return;n.childNodes.forEach(rec)};
  doc.querySelectorAll(".view").filter(isVisible).forEach(rec);rec(doc.querySelector(".navbar"));return out;
}

/* ---------------- coverage benchmark (data only) ---------------- */
function coverage(){
  const today=new Date().toISOString().slice(0,10);
  const live=DATA.jobs.filter(j=>j.rolling||j.deadline>=today);
  return FIELDS.map(f=>({field:f.key,prog:f.prog,labs:DATA.labs.filter(l=>l.fields.some(x=>f.expect.includes(x))).length,jobs:live.filter(j=>(j.fields||[]).some(x=>f.expect.includes(x))).length,studentJobs:live.filter(j=>(j.fields||[]).some(x=>f.expect.includes(x))&&(j.studentFriendly||/assistant/i.test(j.kind))).length}));
}

(async()=>{
  const personas=makePersonas(N);
  const results=[];const T=performance.now();
  for(let i=0;i<personas.length;i++){results.push(await trial(personas[i],i));if((i+1)%20===0)process.stderr.write(`ran ${i+1}/${personas.length}\n`);}
  const total=+(performance.now()-T).toFixed(0);
  fs.writeFileSync(__dirname+"/results.json",JSON.stringify({total,results,coverage:coverage()},null,1));
  // summary
  const byStep={};results.forEach(r=>r.steps.forEach(s=>{const b=byStep[s.name]=byStep[s.name]||{runs:0,fail:0,ms:[],msgs:{}};b.runs++;b.ms.push(s.ms);if(!s.ok){b.fail++;const key=s.msg.replace(/\d+/g,"#").slice(0,180)+" [mode "+r.mode+"]";b.msgs[key]=(b.msgs[key]||0)+1}}));
  console.log(`TRIALS ${results.length}  total ${total} ms`);
  for(const [k,b] of Object.entries(byStep)){const ms=b.ms.sort((a,c)=>a-c);console.log(`${k.padEnd(20)} pass ${b.runs-b.fail}/${b.runs}  median ${ms[Math.floor(ms.length/2)]}ms  p95 ${ms[Math.floor(ms.length*.95)]}ms`);Object.entries(b.msgs).sort((a,c)=>c[1]-a[1]).slice(0,6).forEach(([m,n])=>console.log(`    x${n}  ${m}`));}
  const errs={};results.forEach(r=>r.errors.forEach(e=>{const k=(e.where+": "+e.msg).replace(/\d+/g,"#").slice(0,200);errs[k]=(errs[k]||0)+1}));console.log("\nUNCAUGHT ERRORS:",Object.keys(errs).length?"":"none");Object.entries(errs).sort((a,c)=>c[1]-a[1]).slice(0,15).forEach(([k,n])=>console.log(`  x${n} ${k}`));
  const ti={};results.forEach(r=>r.textIssues.forEach(t=>{const k=t.step+": "+t.found.join(",")+" … "+t.ctx.slice(0,140);ti[k]=(ti[k]||0)+1}));console.log("\nTEXT ISSUES:",Object.keys(ti).length?"":"none");Object.entries(ti).slice(0,12).forEach(([k,n])=>console.log(`  x${n} ${k}`));
  const left={};results.forEach(r=>r.i18nLeft.forEach(s=>left[s]=(left[s]||0)+1));console.log("\nUNTRANSLATED IN SWEDISH MODE:",Object.keys(left).length);Object.entries(left).sort((a,c)=>c[1]-a[1]).slice(0,25).forEach(([k,n])=>console.log(`  x${n} "${k}"`));
  const ms=results.filter(r=>r.match);const ret=ms.reduce((s,r)=>s+r.match.returned,0),rel=ms.reduce((s,r)=>s+r.match.relevant,0);
  console.log(`\nMATCH (mock model): ${ms.length} runs, ${ret} results, ${rel} in persona's field = ${(100*rel/Math.max(1,ret)).toFixed(0)}% precision; zero-result runs: ${ms.filter(r=>!r.match.returned).length}`);
  const byField={};ms.forEach(r=>{const b=byField[r.persona]=byField[r.persona]||{ret:0,rel:0,n:0};b.n++;b.ret+=r.match.returned;b.rel+=r.match.relevant});Object.entries(byField).forEach(([k,b])=>console.log(`  ${k.padEnd(10)} runs ${b.n}  avg results ${(b.ret/b.n).toFixed(1)}  in-field ${(100*b.rel/Math.max(1,b.ret)).toFixed(0)}%`));
  const boot=results.map(r=>r.timing.boot).filter(Boolean).sort((a,b)=>a-b);console.log(`\nBOOT (emulated, ms): median ${boot[Math.floor(boot.length/2)]} p95 ${boot[Math.floor(boot.length*.95)]}`);
  console.log(`Recommendations shown after activity: ${results.filter(r=>r.foryou>=3).length}/${results.length}`);
  console.log("\nCOVERAGE BY FIELD (labs / open jobs / student-friendly jobs):");coverage().forEach(c=>console.log(`  ${c.field.padEnd(10)} ${String(c.labs).padStart(3)} / ${String(c.jobs).padStart(3)} / ${String(c.studentJobs).padStart(3)}   ${c.prog}`));
  process.exit(0);
})();
