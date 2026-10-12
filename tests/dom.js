// Minimal DOM emulator: enough of the browser API to run Swedent's page script headlessly.
"use strict";
const VOID=new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const ENT={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",middot:"·",rsquo:"’",lsquo:"‘",ldquo:"“",rdquo:"”",hellip:"…",ndash:"–",mdash:"—",copy:"©"};
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(m,e)=>e[0]==="#"?String.fromCodePoint(e[1]==="x"||e[1]==="X"?parseInt(e.slice(2),16):parseInt(e.slice(1),10)):(ENT[e]!==undefined?ENT[e]:m));

class Ev{constructor(type,o={}){this.type=type;this.bubbles=!!o.bubbles;this.cancelable=o.cancelable!==false;this.defaultPrevented=false;this._stop=false;Object.assign(this,o);}
  preventDefault(){this.defaultPrevented=true}stopPropagation(){this._stop=true}stopImmediatePropagation(){this._stop=true}}

class Node{
  constructor(doc){this.ownerDocument=doc;this.parentNode=null;this.childNodes=[];this._ls={};}
  get parentElement(){return this.parentNode&&this.parentNode.nodeType===1?this.parentNode:null}
  get firstChild(){return this.childNodes[0]||null}
  get lastChild(){return this.childNodes[this.childNodes.length-1]||null}
  get children(){return this.childNodes.filter(n=>n.nodeType===1)}
  get firstElementChild(){return this.children[0]||null}
  get nextSibling(){if(!this.parentNode)return null;const c=this.parentNode.childNodes;return c[c.indexOf(this)+1]||null}
  _adopt(n){if(n.nodeType===11){const k=n.childNodes.slice();k.forEach(x=>this._adopt(x));return k;}if(n.parentNode)n.parentNode._detach(n);n.parentNode=this;this.childNodes.push(n);return [n];}
  _detach(n){const i=this.childNodes.indexOf(n);if(i>=0)this.childNodes.splice(i,1);n.parentNode=null;}
  _toNode(x){return (x&&x.nodeType)?x:this.ownerDocument.createTextNode(String(x))}
  append(...xs){const added=[];xs.forEach(x=>added.push(...this._adopt(this._toNode(x))));this.ownerDocument._mut(this,added);}
  appendChild(n){this.append(n);return n}
  prepend(...xs){const nodes=xs.map(x=>this._toNode(x));const keep=this.childNodes.slice();this.childNodes=[];const added=[];nodes.forEach(n=>added.push(...this._adopt(n)));keep.forEach(n=>this.childNodes.push(n));this.ownerDocument._mut(this,added);}
  insertBefore(n,ref){if(!ref)return this.appendChild(n);const nodes=n.nodeType===11?n.childNodes.slice():[n];nodes.forEach(x=>{if(x.parentNode)x.parentNode._detach(x);x.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(ref),0,x);});this.ownerDocument._mut(this,nodes);return n;}
  replaceChildren(...xs){this.childNodes.slice().forEach(c=>this._detach(c));this.append(...xs);}
  removeChild(n){this._detach(n);return n}
  remove(){if(this.parentNode)this.parentNode._detach(this)}
  contains(n){while(n){if(n===this)return true;n=n.parentNode}return false}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(c=>c.textContent).join("")}
  set textContent(v){if(this.nodeType===3){this.nodeValue=String(v);return}this.childNodes.slice().forEach(c=>this._detach(c));if(v!==""&&v!=null)this.append(String(v));else this.ownerDocument._mut(this,[]);}
  addEventListener(t,f){if(!f)return;(this._ls[t]=this._ls[t]||[]).push(f)}
  removeEventListener(t,f){if(this._ls[t])this._ls[t]=this._ls[t].filter(x=>x!==f)}
  dispatchEvent(ev){ev.target=ev.target||this;const path=[];let n=this;while(n){path.push(n);n=n.parentNode}if(this.ownerDocument&&path[path.length-1]===this.ownerDocument)path.push(this.ownerDocument.defaultView);
    for(const node of path){if(!node||!node._ls)continue;const ls=(node._ls[ev.type]||[]).slice();ev.currentTarget=node;for(const f of ls){try{f.call(node,ev)}catch(e){this.ownerDocument._error(e,"listener:"+ev.type)}if(ev._stop)break;}if(ev._stop||!ev.bubbles)break;}
    return !ev.defaultPrevented;}
}
class Text extends Node{constructor(doc,v){super(doc);this.nodeType=3;this.nodeName="#text";this.nodeValue=v}get data(){return this.nodeValue}cloneNode(){return new Text(this.ownerDocument,this.nodeValue)}}
class Fragment extends Node{constructor(doc){super(doc);this.nodeType=11}cloneNode(deep){const f=new Fragment(this.ownerDocument);if(deep)this.childNodes.forEach(c=>f.appendChild(c.cloneNode(true)));return f}querySelector(s){return qs(this,s)}querySelectorAll(s){return qsa(this,s)}}

class Element extends Node{
  constructor(doc,tag){super(doc);this.nodeType=1;this.tagName=tag.toUpperCase();this.localName=tag.toLowerCase();this.attrs={};this.style={setProperty(k,v){this[k]=v}};this._value=undefined;this._checked=undefined;
    const self=this;this.dataset=new Proxy({},{get:(o,k)=>typeof k==="string"?self.getAttribute("data-"+k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())) ?? undefined:undefined,set:(o,k,v)=>{self.setAttribute("data-"+k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase()),String(v));return true},deleteProperty:(o,k)=>{self.removeAttribute("data-"+k);return true}});
    this.classList={add:(...c)=>{const s=this._cls();c.forEach(x=>s.add(x));this._setCls(s)},remove:(...c)=>{const s=this._cls();c.forEach(x=>s.delete(x));this._setCls(s)},toggle:(c,f)=>{const s=this._cls();const on=f===undefined?!s.has(c):f;on?s.add(c):s.delete(c);this._setCls(s);return on},contains:c=>this._cls().has(c)};
    if(this.localName==="template")this.content=new Fragment(doc);
    this.scrollLeft=0;this.scrollWidth=1000;this.clientWidth=300;this.scrollTop=0;
  }
  _cls(){return new Set((this.attrs.class||"").split(/\s+/).filter(Boolean))}
  _setCls(s){this.attrs.class=[...s].join(" ")}
  get nodeName(){return this.tagName}
  get id(){return this.attrs.id||""}set id(v){this.attrs.id=v}
  get className(){return this.attrs.class||""}set className(v){this.attrs.class=v}
  getAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k)?this.attrs[k]:null}
  setAttribute(k,v){this.attrs[k]=String(v)}
  hasAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k)}
  removeAttribute(k){delete this.attrs[k]}
  toggleAttribute(k,f){const on=f===undefined?!this.hasAttribute(k):!!f;on?this.setAttribute(k,""):this.removeAttribute(k);return on}
  get hidden(){return this.hasAttribute("hidden")}set hidden(v){v?this.setAttribute("hidden",""):this.removeAttribute("hidden")}
  get disabled(){return this.hasAttribute("disabled")}set disabled(v){v?this.setAttribute("disabled",""):this.removeAttribute("disabled")}
  get open(){return this.hasAttribute("open")}set open(v){v?this.setAttribute("open",""):this.removeAttribute("open")}
  get tabIndex(){return +(this.attrs.tabindex||-1)}set tabIndex(v){this.attrs.tabindex=String(v)}
  get href(){return this.attrs.href||""}
  get lang(){return this.attrs.lang||""}set lang(v){this.attrs.lang=String(v)}
  get title(){return this.attrs.title||""}set title(v){this.attrs.title=String(v)}
  get type(){return this.attrs.type||(this.localName==="button"?"submit":"text")}
  get value(){
    if(this.localName==="select"){const o=this._opts().find(o=>o.selected)||this._opts()[0];return o?o.value:""}
    if(this.localName==="option")return this.hasAttribute("value")?this.attrs.value:this.textContent.trim();
    if(this._value!==undefined)return this._value;
    if(this.localName==="textarea")return this.textContent;
    return this.attrs.value||"";}
  set value(v){v=String(v);if(this.localName==="select"){const os=this._opts();os.forEach(o=>o.selected=false);const m=os.find(o=>o.value===v);if(m)m.selected=true;else this._noSel=true;return}this._value=v}
  _opts(){return qsa(this,"option")}
  get selected(){return !!this._sel}set selected(v){this._sel=!!v}
  get options(){return this._opts()}
  get checked(){return this._checked!==undefined?this._checked:this.hasAttribute("checked")}set checked(v){this._checked=!!v}
  get files(){return []}
  get elements(){return qsa(this,"input,select,textarea,button")}
  reset(){qsa(this,"input,textarea,select").forEach(e=>{e._value=undefined;e._checked=undefined;if(e.localName==="select")e._opts().forEach((o,i)=>o.selected=false)})}
  requestSubmit(){this.dispatchEvent(new Ev("submit",{bubbles:true}))}
  submit(){this.requestSubmit()}
  click(){
    if(this.disabled)return;
    const ok=this.dispatchEvent(new Ev("click",{bubbles:true}));
    if(!ok)return;
    if(this.localName==="summary"&&this.parentNode&&this.parentNode.localName==="details"){const d=this.parentNode;d.open=!d.open;d.dispatchEvent(new Ev("toggle",{bubbles:false}));}
    if(this.localName==="button"&&this.type==="submit"){const f=this.closest("form");if(f)f.requestSubmit();}
    if(this.localName==="input"&&this.attrs.type==="checkbox"){this.checked=!this.checked;this.dispatchEvent(new Ev("change",{bubbles:true}))}
  }
  focus(){this.ownerDocument.activeElement=this}blur(){}select(){}
  scrollIntoView(){}scrollBy(){}scrollTo(){}
  getBoundingClientRect(){return {width:300,height:120,top:0,left:0,right:300,bottom:120}}
  matches(sel){return matchSel(this,sel)}
  closest(sel){let n=this;while(n&&n.nodeType===1){if(matchSel(n,sel))return n;n=n.parentNode}return null}
  querySelector(s){return qs(this,s)}querySelectorAll(s){return qsa(this,s)}
  getElementsByTagName(t){return qsa(this,t)}
  set innerHTML(h){const nodes=parseHTML(h,this.ownerDocument);if(this.localName==="template"){this.content.replaceChildren(...nodes);return}this.replaceChildren(...nodes)}
  get innerHTML(){return this.childNodes.map(serialize).join("")}
  get outerHTML(){return serialize(this)}
  cloneNode(deep){const e=new Element(this.ownerDocument,this.localName);e.attrs={...this.attrs};if(deep)this.childNodes.forEach(c=>e.appendChild(c.cloneNode(true)));return e}
}
function serialize(n){if(n.nodeType===3)return n.nodeValue;if(n.nodeType!==1)return "";const a=Object.entries(n.attrs).map(([k,v])=>` ${k}="${String(v).replace(/"/g,"&quot;")}"`).join("");return `<${n.localName}${a}>${n.childNodes.map(serialize).join("")}</${n.localName}>`}

// ---- selectors: #id .cls tag [a] [a=v] [a='v'] :not(x) , and descendant combinator ----
const selCache=new Map();
function splitTop(s,ch){const out=[];let d=0,q=null,cur="";for(const c of s){if(q){cur+=c;if(c===q)q=null;continue}if(c==="'"||c==='"'){q=c;cur+=c;continue}if(c==="["||c==="(")d++;if(c==="]"||c===")")d--;if(c===ch&&d===0){out.push(cur);cur="";continue}cur+=c}out.push(cur);return out.map(x=>x.trim()).filter(Boolean)}
function parseCompound(s){const c={tag:null,id:null,cls:[],attrs:[],not:[]};let i=0;const m=s.match(/^[a-zA-Z*][a-zA-Z0-9-]*/);if(m){if(m[0]!=="*")c.tag=m[0].toLowerCase();i=m[0].length}
  while(i<s.length){const ch=s[i];
    if(ch==="#"){const mm=s.slice(i+1).match(/^[\w-]+/);c.id=mm[0];i+=1+mm[0].length}
    else if(ch==="."){const mm=s.slice(i+1).match(/^[\w-]+/);c.cls.push(mm[0]);i+=1+mm[0].length}
    else if(ch==="["){const j=s.indexOf("]",i);const body=s.slice(i+1,j);const mm=body.match(/^([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/);c.attrs.push({k:mm[1],v:mm[2]??mm[3]??(mm[4]!==undefined?mm[4].trim():undefined)});i=j+1}
    else if(s.startsWith(":not(",i)){let d=0,j=i+4;for(;j<s.length;j++){if(s[j]==="(")d++;if(s[j]===")"){d--;if(d===0)break}}c.not.push(parseCompound(s.slice(i+5,j)));i=j+1}
    else throw new Error("Unsupported selector: "+s);}
  return c}
function parseSel(sel){if(selCache.has(sel))return selCache.get(sel);const r=splitTop(sel,",").map(cx=>cx.split(/\s+/).map(parseCompound));selCache.set(sel,r);return r}
function matchCompound(e,c){if(e.nodeType!==1)return false;if(c.tag&&e.localName!==c.tag)return false;if(c.id&&e.attrs.id!==c.id)return false;if(c.cls.length){const s=e._cls();if(!c.cls.every(x=>s.has(x)))return false}
  for(const a of c.attrs){if(!e.hasAttribute(a.k))return false;if(a.v!==undefined&&e.attrs[a.k]!==a.v)return false}for(const n of c.not)if(matchCompound(e,n))return false;return true}
function matchComplex(e,parts){if(!matchCompound(e,parts[parts.length-1]))return false;let i=parts.length-2,n=e.parentNode;while(i>=0&&n){if(n.nodeType===1&&matchCompound(n,parts[i]))i--;n=n.parentNode}return i<0}
function matchSel(e,sel){return parseSel(sel).some(p=>matchComplex(e,p))}
function walk(root,f){for(const c of root.childNodes){if(c.nodeType===1){if(f(c))return true;if(walk(c,f))return true}}return false}
function qs(root,sel){let r=null;const ps=parseSel(sel);walk(root,e=>{if(ps.some(p=>matchComplex(e,p))){r=e;return true}return false});return r}
function qsa(root,sel){const r=[];const ps=parseSel(sel);walk(root,e=>{if(ps.some(p=>matchComplex(e,p)))r.push(e);return false});return r}

// ---- HTML parser (well-formed markup) ----
function parseHTML(html,doc){
  const root=new Fragment(doc);const stack=[root];let i=0;const top=()=>stack[stack.length-1];
  const re=/<!--[\s\S]*?-->|<\/([a-zA-Z0-9:-]+)\s*>|<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
  let m,last=0;
  const pushText=t=>{if(t)top().childNodes.push(Object.assign(new Text(doc,decode(t)),{parentNode:top()}))};
  while((m=re.exec(html))){
    pushText(html.slice(last,m.index));last=re.lastIndex;
    if(m[0].startsWith("<!--"))continue;
    if(m[1]){const tag=m[1].toLowerCase();for(let k=stack.length-1;k>0;k--){if(stack[k].localName===tag){stack.length=k;break}}continue}
    const tag=m[2].toLowerCase();const el=new Element(doc,tag);
    const ar=/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;let a;while((a=ar.exec(m[3]||""))){el.attrs[a[1]]=decode(a[2]??a[3]??a[4]??"")}
    el.parentNode=top();top().childNodes.push(el);
    if(tag==="script"||tag==="style"){const end=html.toLowerCase().indexOf("</"+tag,re.lastIndex);const raw=html.slice(re.lastIndex,end);el.childNodes.push(Object.assign(new Text(doc,raw),{parentNode:el}));const close=html.indexOf(">",end);re.lastIndex=close+1;last=re.lastIndex;continue}
    if(tag==="option"&&el.hasAttribute("selected"))el.selected=true;
    if(!VOID.has(tag)&&!m[4])stack.push(el);
  }
  pushText(html.slice(last));
  const out=root.childNodes.slice();out.forEach(n=>n.parentNode=null);
  // template content
  const fixTpl=n=>{if(n.nodeType===1){if(n.localName==="template"){n.content.childNodes=n.childNodes;n.childNodes=[];n.content.childNodes.forEach(c=>c.parentNode=n.content)}n.childNodes.forEach(fixTpl)}};out.forEach(fixTpl);
  return out;
}

class Document extends Node{
  constructor(){super(null);this.ownerDocument=this;this.nodeType=9;this.documentElement=new Element(this,"html");this.documentElement.parentNode=this;this.childNodes=[this.documentElement];
    this.head=new Element(this,"head");this.body=new Element(this,"body");this.documentElement.childNodes=[this.head,this.body];this.head.parentNode=this.documentElement;this.body.parentNode=this.documentElement;
    this._observers=[];this.errors=[];this.hidden=false;this.activeElement=null;}
  createElement(t){return new Element(this,t)}createElementNS(ns,t){return new Element(this,t)}createTextNode(v){return new Text(this,String(v))}createDocumentFragment(){return new Fragment(this)}
  getElementById(id){return qs(this,"#"+id)}querySelector(s){return qs(this,s)}querySelectorAll(s){return qsa(this,s)}
  _mut(target,added){if(!this._observers.length)return;const rec={type:"childList",target,addedNodes:added};this._observers.forEach(o=>{if(o.target.contains(target)){o.q.push(rec);if(!o.sched){o.sched=true;queueMicrotask(()=>{o.sched=false;const q=o.q;o.q=[];try{o.cb(q)}catch(e){this._error(e,"MutationObserver")}})}}})}
  _error(e,where){this.errors.push({where,msg:String(e&&e.stack||e)})}
}
module.exports={Document,Element,Text,Fragment,Ev,parseHTML};
