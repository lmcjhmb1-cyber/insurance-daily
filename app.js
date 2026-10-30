const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])).replace(/\*\*(.+?)\*\*/g,'<mark class="em">$1</mark>');
function load(k){try{return JSON.parse(localStorage.getItem("bi:"+k))||{}}catch(e){return{}}}
function save(k,v){v.t=Date.now();try{localStorage.setItem("bi:"+k,JSON.stringify(v))}catch(e){}if(window.Sync)window.Sync.push(k,v)}
function fmtDate(d){const [y,m,dd]=d.split("-");return `${+y}년 ${+m}월 ${+dd}일`}
function shortDate(d){const [,m,dd]=d.split("-");return `${+m}월 ${+dd}일`}
const DAY=864e5;
function ymd(ts){const d=new Date(ts);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function sod(ts){const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime()}
const MODE={light:{label:"가볍게",time:"약 5분",desc:"예측, 핵심 정리, 퀴즈"},deep:{label:"깊게",time:"약 15분",desc:"인과 사슬, 담당자 질문, 면접 질문까지"}};
const GAP=[1,3,7,14,30];
// 인공지능 피드백 서버 주소 (클라우드플레어 워커). 비어 있으면 피드백 버튼이 숨겨져요.
const FEEDBACK_URL="";

const issues=(window.ISSUES||[]).map((x,i)=>({id:x.date+"-"+(i+1),...x}));
const FRAMES=window.FRAMES||[];const JOBS=window.JOBS||[];const WEEKLY=(window.WEEKLY||[]).slice().sort((a,b)=>a.id<b.id?1:-1);
const BASICS=window.BASICS||[];
const COMPANIES=window.COMPANIES||[];
const NEWS=(window.NEWS||[]).slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(a.id<b.id?1:-1));
const coVars=c=>`--cc:${c.color||"var(--accent)"};--ci:${c.ink||"#fff"}`;
/* 회사 로고: 회사 홈페이지 아이콘을 여러 곳에서 차례로 시도하고, 모두 실패하면 짧은 이름을 보여줘요 */
const logoSrcs=site=>{const host=site.replace(/\.(co\.kr|or\.kr|com|net|kr)$/,"").includes(".")?site:"www."+site,e=encodeURIComponent(site);
  return [[`https://${host}/apple-touch-icon.png`,40],[`https://www.google.com/s2/favicons?domain=${e}&sz=128`,17],[`https://${host}/favicon.ico?s=1`,16],[`https://${site}/favicon.ico?s=1`,16],[`https://icons.duckduckgo.com/ip3/${e}.ico`,17],[`https://www.google.com/s2/favicons?domain=${host}&sz=64`,17]]};
window.coLogoNext=img=>{if(!img.parentNode||img.dataset.dead)return;img.dataset.dead=1;const list=JSON.parse(img.dataset.srcs);const i=+img.dataset.i+1;if(i>=list.length){img.remove();return}
  const n=img.cloneNode();delete n.dataset.dead;n.removeAttribute("data-dead");n.dataset.i=i;n.src=list[i][0];img.replaceWith(n)};
window.coLogoLoad=img=>{if(img.dataset.dead)return;const list=JSON.parse(img.dataset.srcs),min=list[+img.dataset.i][1];if(img.naturalWidth<min)return coLogoNext(img);const box=img.parentNode;box.classList.add("haslogo");if(img.naturalWidth<48)box.classList.add("small")};
const coMono=(c,cls)=>{const srcs=c.site?logoSrcs(c.site):[];return `<span class="comono${cls?" "+cls:""}" style="${coVars(c)}" aria-hidden="true">${esc(c.mono||c.name.slice(0,2))}${srcs.length?`<img src="${srcs[0][0]}" data-srcs='${JSON.stringify(srcs)}' data-i="0" alt="" loading="lazy" referrerpolicy="no-referrer" onload="coLogoLoad(this)" onerror="coLogoNext(this)">`:""}</span>`};
const PROFILES=window.PROFILES||{};
const coNews=name=>NEWS.filter(n=>(n.companies||[]).includes(name));
/* 회사별 묶기: 이슈의 companies와 본문에 나온 회사 이름으로 찾아요 */
const coOf=(()=>{const cache=new Map();return it=>{if(cache.has(it.id))return cache.get(it.id);const set=new Set(it.companies||[]);
  const txt=[it.title,...(it.points||[]),it.why,it.summary].join(" ").replace(/\*\*/g,"");
  for(const c of COMPANIES)if([c.name,...(c.aka||[])].some(n=>txt.includes(n)))set.add(c.name);
  const out=COMPANIES.map(c=>c.name).filter(n=>set.has(n));cache.set(it.id,out);return out}})();
const coIssues=name=>issues.filter(it=>coOf(it).includes(name)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(a.id<b.id?1:-1));
const daily=issues.filter(i=>!i.basic);
const dates=[...new Set(daily.map(i=>i.date))].sort().reverse();
const byDate=d=>daily.filter(i=>i.date===d).sort((a,b)=>a.id<b.id?-1:1);
const basicIssues=b=>(b.order||[]).map(id=>issues.find(i=>i.id===id)).filter(Boolean);
const basicOf=it=>it.basic&&it.thread?BASICS.find(b=>b.id===it.thread.id):null;
const lightQuiz=it=>(it.quiz||[]).map((q,k)=>({...q,k})).filter(q=>!q.deep);
function status(it){const s=load(it.id);if(s.done)return"done";if(s.pred!=null||(s.qa&&Object.keys(s.qa).length)||s.role||s.sum||s.iv)return"doing";return""}
const cfg=()=>load("cfg");
const goal=()=>+cfg().goal||3;

const GLOSS=(()=>{const m=new Map();for(const it of issues)for(const x of it.terms||[]){if(!m.has(x.t))m.set(x.t,{t:x.t,d:x.d,issues:[]});m.get(x.t).issues.push(it)}return [...m.values()].sort((a,b)=>a.t.localeCompare(b.t,"ko"))})();
const THREADS=(()=>{const m=new Map();for(const it of issues){if(!it.thread)continue;const k=it.thread.id;if(!m.has(k))m.set(k,{id:k,name:it.thread.name,issues:[]});m.get(k).issues.push(it)}
  for(const t of m.values())t.issues.sort((a,b)=>a.id<b.id?-1:1);return [...m.values()].sort((a,b)=>{const la=a.issues[a.issues.length-1].id,lb=b.issues[b.issues.length-1].id;return la<lb?1:-1})})();

/* 기록 집계 */
function doneByDay(){const m={};for(const it of issues){const s=load(it.id);if(!s.done)continue;const ts=s.doneAt||s.t;if(!ts)continue;const k=ymd(ts);m[k]=(m[k]||0)+1}return m}
function streak(m){let n=0;const d=new Date();if(!m[ymd(d)])d.setDate(d.getDate()-1);while(m[ymd(d)]){n++;d.setDate(d.getDate()-1)}return n}
function longest(m){const ks=Object.keys(m).sort();let best=0,cur=0,prev=null;for(const k of ks){const d=new Date(k+"T00:00:00");if(prev&&Math.round((d-prev)/DAY)===1)cur++;else cur=1;best=Math.max(best,cur);prev=d}return best}
function rvNext(s){return (s.rv&&s.rv.n)||sod(s.doneAt||s.t||Date.now())+DAY}
function dueList(){const now=Date.now();return issues.filter(it=>{const s=load(it.id);return s.done&&rvNext(s)<=now})}
function nextReview(){let best=null;for(const it of issues){const s=load(it.id);if(!s.done)continue;const n=rvNext(s);if(n>Date.now()&&(!best||n<best))best=n}return best}

/* 길찾기 */
const SECS=[
  {k:"issue",label:"이슈",icon:'<path d="M4 5h12v14H6a2 2 0 0 1-2-2z"/><path d="M16 9h4v8a2 2 0 0 1-2 2"/><path d="M8 9h4M8 13h4"/>',tabs:[["","오늘 이슈"],["threads","이어보기"],["weekly","주간 큰 그림"],["search","찾기"]]},
  {k:"basics",label:"기초",icon:'<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',tabs:[["basics","기초 다지기"]]},
  {k:"review",label:"복습",icon:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',tabs:[["review","오늘의 복습"]]},
  {k:"study",label:"사전",icon:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',tabs:[["terms","용어 사전"],["frames","생각의 틀"]]},
  {k:"interview",label:"면접",icon:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',tabs:[["interview","면접 연습"],["mock","모의 면접"],["companies","회사별 보기"]]},
  {k:"me",label:"마이",icon:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',tabs:[["me","마이페이지"],["league","친구 리그"]]}];
function navKey(){const h=decodeURIComponent(location.hash.slice(1));if(!h||h.startsWith("d-")||h.startsWith("i-"))return"";if(h.startsWith("g-"))return"terms";if(h.startsWith("f-"))return"frames";if(h.startsWith("t-"))return"threads";if(h.startsWith("w-"))return"weekly";if(h.startsWith("b-"))return"basics";if(h.startsWith("c-"))return"companies";return h}
function secOf(k){return SECS.find(s=>s.tabs.some(t=>t[0]===k))||SECS[0]}
function renderShell(){
  const k=navKey(),sec=secOf(k),due=dueList().length,u=window.Auth&&window.Auth.user;
  const item=s=>`<a class="si${s.k===sec.k?" on":""}${s.k==="me"?" me":""}" href="#${s.tabs[0][0]}"${s.k===sec.k?' aria-current="page"':""}><svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg>${s.label}${s.k==="review"&&due?`<span class="cnt">${due}</span>`:""}${s.k==="me"&&u?'<span class="dot" aria-hidden="true"></span>':""}</a>`;
  $("#side").innerHTML=`<a class="logo" href="#" aria-label="오늘의 보험 이슈 처음으로"><svg aria-hidden="true" viewBox="0 0 40 40"><defs><linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7366E6"/><stop offset="1" stop-color="#4537B8"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#logoG)"/><path d="M8 20.5C8 13.6 13.4 9 20 9s12 4.6 12 11.5c-1.4-1.3-2.7-1.9-4-1.9-1.5 0-2.8.8-4 2.2-1.2-1.4-2.5-2.2-4-2.2s-2.8.8-4 2.2c-1.2-1.4-2.5-2.2-4-2.2-1.3 0-2.6.6-4 1.9z" fill="#fff"/><path d="M20 20v9.2a2.6 2.6 0 0 1-5.2 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="31" cy="9.5" r="3.8" fill="#FFC83D"/></svg></a>${SECS.slice(0,5).map(item).join("")}<span class="grow"></span>${item(SECS[5])}`;
  $("#tline").innerHTML=`<a class="bt" href="#">오늘의 <em>보험</em> 이슈 <span>· ${sec.k==="me"?"마이페이지":sec.label}</span></a><a class="who" href="#me">${u?esc(u.displayName||"로그인됨")+"님":"로그인"}</a>`;
  $("#tabs").innerHTML=sec.tabs.length>1?sec.tabs.map(([h,l])=>`<a href="#${h}" class="${k===h?"on":""}">${l}</a>`).join(""):"";
  $("#topbar").classList.toggle("single",sec.tabs.length<2);
  const h=decodeURIComponent(location.hash.slice(1));
  document.querySelector(".page").classList.toggle("read",/^(i-|g-|f-|t-|w-|b-|c-|review$|interview$|mock$)/.test(h));
}
function meLabel(){return ""}
function brand(){return ""}
/* 지나온 화면 기억: 뒤로 링크는 방금 보던 화면과 보던 위치로 돌아가요 */
const trail=[];let goingBack=false;
function backLabel(t){t=(t||"").trim();return t?(t.length>24?t.slice(0,24)+"…":t):"이전 화면"}
function back(href,label){
  if(trail.length>=2){const p=trail[trail.length-2];return `<a class="back" href="${p.h||"#"}" data-back="1">← ${esc(backLabel(p.t))}</a>`}
  return `<a class="back" href="${href}">← ${label}</a>`}
document.addEventListener("click",e=>{const a=e.target.closest("a[data-back]");if(a&&trail.length>=2){e.preventDefault();history.back()}});

function route(){
  hidePop();renderShell();
  const h=decodeURIComponent(location.hash.slice(1));
  if(!issues.length){$("#head").innerHTML=brand()+`<p class="empty">첫 이슈가 아직 올라오지 않았어요.</p>`;$("#main").innerHTML="";return}
  if(h==="me")return showMe();
  if(h==="review")return showReview();
  if(h==="basics")return showBasics();
  if(h.startsWith("b-"))return showBasic(h.slice(2));
  if(h==="terms")return showTerms();
  if(h.startsWith("g-"))return showTerm(h.slice(2));
  if(h==="frames")return showFrames();
  if(h.startsWith("f-"))return showFrame(h.slice(2));
  if(h==="threads")return showThreads();
  if(h.startsWith("t-"))return showThread(h.slice(2));
  if(h==="weekly")return showWeeklyList();
  if(h.startsWith("w-"))return showWeek(h.slice(2));
  if(h==="interview")return showInterview();
  if(h==="companies")return showCompanies();
  if(h==="mock")return showMock();
  if(h.startsWith("c-"))return showCompany(h.slice(2));
  if(h==="search")return showSearch();
  if(h==="league")return showLeague();
  if(h.startsWith("i-")){
    let rest=h.slice(2),mode=null;
    for(const m of ["light","deep"])if(rest.endsWith("-"+m)){mode=m;rest=rest.slice(0,-m.length-1)}
    const it=issues.find(i=>i.id===rest);
    if(it){const st=load(it.id);if(mode&&st.mode!==mode){st.mode=mode;save(it.id,st)}return showIssue(it,mode||st.mode||"light")}
  }
  const d=h.startsWith("d-")&&dates.includes(h.slice(2))?h.slice(2):dates[0];
  showList(d);
}
function track(){
  const h=location.hash||"#";
  if(trail.length&&trail[trail.length-1].h===h)return null;
  if(trail.length>=2&&trail[trail.length-2].h===h){trail.pop();return trail[trail.length-1]}
  trail.push({h,t:"",y:0});if(trail.length>50)trail.shift();return null;
}
function afterRender(){const top=trail[trail.length-1];const t=document.querySelector("#head h1");if(top&&t)top.t=t.textContent}
window.addEventListener("hashchange",()=>{
  const prevTop=trail[trail.length-1];if(prevTop)prevTop.y=window.scrollY;
  const back=track();route();afterRender();
  window.scrollTo(0,back?back.y:0);
});

/* 용어 풍선 */
let pop=null;
function hidePop(){if(pop){pop.remove();pop=null}}
function hl(text,it,used){
  let h=esc(text);const ts=(it.terms||[]).map(x=>x.t).filter(t=>!used.has(t)).sort((a,b)=>b.length-a.length);if(!ts.length)return h;
  const re=new RegExp(ts.map(t=>esc(t).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"g");
  return h.replace(re,m=>{if(used.has(m))return m;used.add(m);return `<button type="button" class="term" data-t="${m}">${m}</button>`});
}
document.addEventListener("click",e=>{
  const b=e.target.closest(".term");
  if(b){e.preventDefault();hidePop();const t=b.dataset.t;const g=GLOSS.find(x=>x.t===t);if(!g)return;
    pop=document.createElement("div");pop.id="pop";pop.setAttribute("role","dialog");
    pop.innerHTML=`<b>${esc(g.t)}</b><p>${esc(g.d)}</p><a href="#g-${encodeURIComponent(g.t)}">용어 사전에서 보기 →</a>`;
    document.body.appendChild(pop);const r=b.getBoundingClientRect();const w=Math.min(320,innerWidth-32);pop.style.width=w+"px";
    pop.style.top=(r.bottom+scrollY+6)+"px";pop.style.left=Math.max(16,Math.min(r.left+scrollX,innerWidth-16-w))+"px";return}
  if(pop&&!e.target.closest("#pop"))hidePop();
});

/* 달력 */
let calMonth=null;
function renderCal(sel){
  const box=$("#cal");if(!box)return;
  const m=doneByDay(),G=goal();const [y,mo]=calMonth.split("-").map(Number);
  const first=new Date(y,mo-1,1).getDay(),days=new Date(y,mo,0).getDate(),today=ymd(Date.now()),pub=new Set(dates);
  let cells="",total=0,met=0;
  for(let i=0;i<first;i++)cells+=`<span class="cd blank" aria-hidden="true"></span>`;
  for(let d=1;d<=days;d++){
    const k=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`,c=m[k]||0;total+=c;if(c>=G)met++;
    const lv=c===0?0:c===1?1:c<=3?2:c<=5?3:4;
    const cls=`cd lv${lv}${k===today?" today":""}${k===sel?" sel":""}${c>=G?" met":""}`;
    const inner=`<b>${d}</b><i>${c?c+"개":""}</i>${pub.has(k)?`<u aria-hidden="true"></u>`:""}`;
    const label=`${mo}월 ${d}일, ${c}개 완료${c>=G?", 목표 달성":""}${pub.has(k)?", 이슈 보기":""}`;
    cells+=pub.has(k)?`<a class="${cls}" href="#d-${k}" aria-label="${label}" title="${label}">${inner}</a>`:`<span class="${cls}" title="${label}">${inner}</span>`;
  }
  const wk=["일","월","화","수","목","금","토"].map(w=>`<span class="wk">${w}</span>`).join("");
  box.innerHTML=`<div class="calhead"><button id="calPrev" aria-label="이전 달">‹</button><b>${y}년 ${mo}월</b><button id="calNext" aria-label="다음 달">›</button></div>
    <div class="calgrid">${wk}${cells}</div>
    <div class="calfoot"><span>${mo}월에 <b>${total}개</b> 완료 · 목표 달성 <b>${met}일</b></span><span class="legend">적음<i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i>많음</span></div>
    <p class="small" style="margin:0">숫자는 그날 끝낸 이슈 개수, 왼쪽 위 체크는 하루 목표(${G}개)를 채운 날이에요. 점이 찍힌 날은 이슈가 올라온 날이라 누르면 그날 목록으로 가요.</p>`;
  const shift=n=>{const dt=new Date(y,mo-1+n,1);calMonth=dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0");renderCal(sel)};
  $("#calPrev").onclick=()=>shift(-1);$("#calNext").onclick=()=>shift(1);
}

/* 배지 */
function badges(){
  const m=doneByDay(),G=goal();let done=0,deep=0,rv=0,iv=0;const tags=new Set();
  for(const it of issues){const s=load(it.id);if(s.done){done++;tags.add(it.tag);if(s.doneMode==="deep")deep++}rv+=(s.rv&&s.rv.c)||0;if(s.iv&&s.iv.trim())iv++}
  const L=longest(m),met=Object.values(m).filter(c=>c>=G).length;
  return [
    ["첫 걸음","이슈 1개 끝내기",done>=1],["사흘 연속","3일 연속 공부하기",L>=3],["일주일 연속","7일 연속 공부하기",L>=7],["한 달 연속","30일 연속 공부하기",L>=30],
    ["이슈 10개","이슈 10개 끝내기",done>=10],["이슈 50개","이슈 50개 끝내기",done>=50],["이슈 100개","이슈 100개 끝내기",done>=100],
    ["깊이 파기","깊게 보기로 5개 끝내기",deep>=5],["복습 장인","복습 10번 하기",rv>=10],["분야 탐험가","5개 분야에서 이슈 끝내기",tags.size>=5],
    ["목표 달인","하루 목표 7번 채우기",met>=7],["면접 준비생","면접 질문 5개에 답 쓰기",iv>=5]];
}

/* 개인정보 안내와 계정 */
const NOTICE=`<details class="notice"><summary>무엇을 저장하나요?</summary><ul>
  <li><b>저장하는 것:</b> 구글 계정의 고유 번호와 학습 기록(예측 답, 퀴즈 답, 완료 여부와 시각, 복습 일정, 고른 방식, 하루 목표, 직접 쓴 답)이에요. 로그인할 때 구글이 알려주는 이름과 이메일은 로그인 정보로만 남고, 학습 기록에는 넣지 않아요.</li>
  <li><b>목적:</b> 다른 기기에서 들어와도 공부한 기록을 이어 보기 위해서예요. 다른 용도로는 쓰지 않아요.</li>
  <li><b>친구들 정답률:</b> 로그인한 사람이 퀴즈에서 처음 고른 답은 누가 골랐는지 없이 숫자로만 합쳐져서, "친구들 몇 %가 맞혔어요"를 보여주는 데 쓰여요.</li>
  <li><b>친구 리그:</b> 참가하면 직접 정한 별명과 이번 주에 끝낸 이슈 개수만 순위표에 올라가고, 로그인한 사람은 순위표를 볼 수 있어요. 나가면 순위표에서 빠져요.</li>
  <li><b>오류 신고:</b> 신고한 내용은 누가 보냈는지 없이 운영자에게만 전달돼요.</li>
  <li><b>보관 위치:</b> 서울에 있는 구글 서버(파이어베이스)예요. 다른 사용자는 내 기록을 볼 수 없어요.</li>
  <li><b>알아둘 점:</b> 사이트 운영자는 관리 화면에서 로그인한 사람의 이메일과 저장된 기록을 볼 수 있어요. 직접 쓰는 답에는 개인적인 내용을 적지 마세요.</li>
  <li><b>지우는 법:</b> 로그인한 뒤 "내 기록 지우기"를 누르면 저장된 기록과 로그인 정보가 모두 지워져요. 이미 숫자로 합쳐진 정답률 집계는 누구 것인지 알 수 없어서 따로 빠지지 않아요.</li></ul></details>`;
function accountHTML(){
  const A=window.Auth;
  if(!A)return `<p class="small" style="margin:0">로그인 기능을 불러오는 중이에요. 인터넷 연결이 불안정하면 로그인 없이 이 기기에만 기록이 남아요.</p>${NOTICE}`;
  const st=A.state;
  if(!A.user){
    const msg=st==="deleted"?`<span class="ok">기록과 로그인 정보를 모두 지웠어요.</span>`:st==="loginError"?`<span class="no">로그인하지 못했어요. 잠시 뒤 다시 눌러주세요.</span>`:`지금 기록은 이 기기에만 있어요. 로그인하면 어느 기기에서나 이어져요.`;
    return `<div class="authrow"><span>${msg}</span><button id="loginBtn" class="pri">구글로 로그인</button></div>${NOTICE}`;
  }
  const name=esc(A.user.displayName||"로그인한 사용자");
  const m=st==="loading"?"기록을 불러오는 중이에요":st==="error"?`<span class="no">기록을 저장하지 못했어요. 인터넷 연결을 확인해주세요.</span>`:st==="deleting"?"기록을 지우는 중이에요":st==="deleteError"?`<span class="no">지우지 못했어요. 다시 시도해주세요.</span>`:st==="partial"?`<span class="ok">학습 기록은 모두 지웠어요.</span> 로그인 정보까지 지우려면 한 번 더 눌러주세요`:"기록이 계정에 저장되고 있어요";
  return `<div class="authrow"><span><b>${name}</b>님 · ${m}</span><span class="row"><button id="logoutBtn">로그아웃</button><button id="delBtn">내 기록 지우기</button></span></div>
    <div id="delAsk" hidden class="ask"><p>정말 지울까요? 이 계정에 저장된 학습 기록과 로그인 정보가 모두 지워지고, 되돌릴 수 없어요.</p><span class="row"><button id="delYes" class="danger">모두 지우기</button><button id="delNo">취소</button></span></div>${NOTICE}`;
}
function wireAccount(){
  const A=window.Auth;if(!A)return;
  const on=(id,f)=>{const e=document.getElementById(id);if(e)e.onclick=f};
  on("loginBtn",()=>A.login());on("logoutBtn",()=>A.logout());on("delYes",()=>A.removeAll());
  on("delBtn",()=>{$("#delAsk").hidden=false});on("delNo",()=>{$("#delAsk").hidden=true});
}

/* 내 생각 노트 */
function collectNotes(){
  const out=[];
  for(const it of issues){const s=load(it.id);
    if(s.role&&s.role.trim()&&it.role)out.push({it,kind:"내가 담당자라면",q:it.role.q,a:s.role,model:it.role.model,t:s.t||0});
    if(s.sum&&s.sum.trim())out.push({it,kind:"한 줄 요약",q:"보험을 모르는 친구에게 한 줄로 설명한다면?",a:s.sum,model:it.summary,t:s.t||0});
    if(s.iv&&s.iv.trim()&&it.interview)out.push({it,kind:"면접 질문",q:it.interview.q,a:s.iv,model:it.interview.guide,t:s.t||0});}
  return out.sort((x,y)=>x.it.id<y.it.id?1:x.it.id>y.it.id?-1:0);
}
function notesText(){
  const ns=collectNotes();const lines=[`내 생각 노트 · 오늘의 보험 이슈`,`내보낸 날: ${fmtDate(ymd(Date.now()))}`,`쓴 답 ${ns.length}개`,""];
  let cur=null;
  for(const n of ns){
    if(cur!==n.it.id){cur=n.it.id;lines.push("━━━━━━━━━━━━━━━━━━━━",`[${fmtDate(n.it.date)}] ${n.it.title}`,`분야: ${n.it.tag||""}${n.it.jobs?" · 관련 직무: "+n.it.jobs.join(", "):""}`,"")}
    lines.push(`▶ ${n.kind}`,`질문: ${n.q}`,`내 답: ${n.a}`,`${n.kind==="면접 질문"?"답변 뼈대":n.kind==="한 줄 요약"?"예시 요약":"모범 해설"}: ${n.model||""}`,"");
  }
  return lines.join("\n").replace(/\*\*/g,"");
}

/* 마이페이지 */
function showMe(){
  $("#head").innerHTML=`<h1>마이페이지</h1><p class="meta">공부 기록과 계정을 한곳에서 관리해요.</p>`;
  let done=0,qN=0,qOK=0;const tags={},wrong=[],doing=[];
  for(const it of issues){const s=load(it.id);const tag=it.tag||"보험 이슈";const T=tags[tag]||(tags[tag]={done:0,all:0,qN:0,qOK:0});T.all++;
    if(s.done){done++;T.done++}else if(status(it)==="doing")doing.push(it);
    for(const [k,j] of Object.entries(s.qa||{})){const q=(it.quiz||[])[k];if(!q)continue;qN++;T.qN++;if(+j===q.a){qOK++;T.qOK++}else wrong.push({it,q,j:+j,t:s.t||0})}}
  const m=doneByDay(),G=goal(),todayN=m[ymd(Date.now())]||0;const pct=qN?Math.round(qOK/qN*100):null;const notes=collectNotes();const bs=badges();
  const stat=(label,val,sub)=>`<div class="stat"><span>${label}</span><b>${val}</b>${sub?`<em>${sub}</em>`:""}</div>`;
  const P={};
  P.account=`<section class="step"><div class="sh"><h2>내 계정</h2></div><div id="account">${accountHTML()}</div></section>`;
  P.stats=`<div class="stats">${stat("끝낸 이슈",done+"개",`올라온 이슈 ${issues.length}개 중`)}${stat("연속 학습",streak(m)+"일","오늘이나 어제까지 이어진 날")}${stat("최장 연속",longest(m)+"일","지금까지 가장 길게 이어간 기록")}${stat("퀴즈 정답률",pct==null?"–":pct+"%",qN?`${qN}문제 중 ${qOK}문제 정답`:"아직 푼 퀴즈가 없어요")}</div>`;
  P.goal=`<section class="step"><div class="sh"><h2>하루 목표</h2><span class="small">오늘 ${todayN}/${G}개</span></div>
    <div class="goalrow"><label for="goalSel">하루에</label><select id="goalSel">${[1,2,3,4,5,6,7,8,10].map(n=>`<option value="${n}"${n===G?" selected":""}>${n}개</option>`).join("")}</select><span>끝내기</span></div>
    <div class="bar"><i style="width:${Math.min(100,todayN/G*100)}%"></i></div>
    <p class="small" style="margin:0">${todayN>=G?"오늘 목표를 채웠어요. 달력에 체크가 붙어요.":`오늘 ${G-todayN}개 더 끝내면 목표 달성이에요.`}</p></section>`;
  P.cal=`<section class="cal" id="cal" aria-label="학습 달력"></section>`;
  P.badges=`<section class="step"><div class="sh"><h2>배지</h2><span class="small">${bs.filter(b=>b[2]).length}/${bs.length}개</span></div>
    <div class="badges">${bs.map(([n,d,ok])=>`<div class="bdg${ok?"":" off"}"><b>${n}</b><span>${d}</span></div>`).join("")}</div></section>`;
  P.doing=doing.length?`<section class="step"><div class="sh"><h2>이어서 풀기</h2></div><ul class="links">${doing.map(it=>`<li><a href="#i-${esc(it.id)}">${esc(it.title)}</a><span class="small">${shortDate(it.date)} · ${esc(it.tag||"")}</span></li>`).join("")}</ul></section>`:"";
  P.wrong=`<section class="step"><div class="sh"><h2>오답 노트</h2><span class="small">${wrong.length}문제</span></div>${wrong.length?wrong.sort((x,y)=>y.t-x.t).map(w=>`<div class="wn"><p class="small" style="margin:0">${shortDate(w.it.date)} · ${esc(w.it.tag||"")}</p><p class="q" style="font-size:16px">${esc(w.q.q)}</p>
    <p class="mine"><span class="no">내 답</span> ${esc(w.q.o[w.j])}</p><p class="right"><span class="ok">정답</span> ${esc(w.q.o[w.q.a])}</p><p class="small" style="margin:0">${esc(w.q.e)}</p><a class="more" href="#i-${esc(w.it.id)}">이슈 다시 보기 →</a></div>`).join("")+`<p class="small" style="margin:0">복습에서 다시 맞히면 오답 노트에서 빠져요.</p>`:`<p class="small" style="margin:0">틀린 문제가 생기면 여기에 모여요. 복습에서 다시 맞히면 빠져요.</p>`}</section>`;
  const tagRows=Object.entries(tags).filter(([,T])=>T.done||T.qN).sort((x,y)=>y[1].done-x[1].done);
  P.tags=`<section class="step"><div class="sh"><h2>분야별 기록</h2></div>${tagRows.length?`<div class="tags">${tagRows.map(([tag,T])=>{const p=T.qN?Math.round(T.qOK/T.qN*100):0;return `<div class="tg"><div class="tgh"><b>${esc(tag)}</b><span>${T.done}/${T.all}개 끝냄 · 정답률 ${T.qN?p+"%":"–"}</span></div><div class="bar"><i style="width:${T.all?T.done/T.all*100:0}%"></i></div></div>`}).join("")}</div><p class="small" style="margin:0">막대는 그 분야에 올라온 이슈 중 끝낸 비율이에요. 정답률이 낮은 분야부터 다시 보면 좋아요.</p>`:`<p class="small" style="margin:0">이슈를 풀기 시작하면 분야마다 얼마나 공부했는지 보여줘요.</p>`}</section>`;
  P.notes=`<section class="step"><div class="sh"><h2>내가 쓴 답</h2><span class="small">${notes.length}개</span></div>${notes.length?notes.map(n=>`<details class="note"><summary><span class="small">${shortDate(n.it.date)} · ${n.kind}</span><br>${esc(n.it.title)}</summary><p class="small" style="margin:8px 0 4px">${esc(n.q)}</p><p class="ans">${esc(n.a)}</p><a class="more" href="#i-${esc(n.it.id)}-deep">이슈에서 모범 해설과 비교하기 →</a></details>`).join("")+`<div class="row"><button class="pri" id="expBtn">노트 파일로 받기</button><button id="cpyBtn">전체 복사</button></div><p class="small" id="expMsg" style="margin:0">담당자 질문, 한 줄 요약, 면접 질문에 쓴 답을 모범 해설과 함께 한 파일로 정리해줘요. 면접 직전 복습 노트로 쓰기 좋아요.</p>`:`<p class="small" style="margin:0">깊게 보기에서 담당자 질문, 한 줄 요약, 면접 질문에 답을 쓰면 여기에 모여요. 모은 답은 파일로 내보낼 수 있어요.</p>`}</section>`;
  $("#main").innerHTML=P.stats+`<div class="mepane"><div>${P.cal}${P.wrong}${P.notes}</div><div>${P.account}${P.goal}${P.doing}${P.badges}${P.tags}</div></div>`;
  if(!calMonth)calMonth=ymd(Date.now()).slice(0,7);
  renderCal(null);wireAccount();
  $("#goalSel").onchange=e=>{const c=cfg();c.goal=+e.target.value;save("cfg",c);showMe()};
  if($("#expBtn")){
    $("#expBtn").onclick=()=>{const blob=new Blob(["﻿"+notesText()],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`보험이슈_생각노트_${ymd(Date.now())}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);$("#expMsg").textContent="파일을 내려받았어요."};
    $("#cpyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(notesText());$("#expMsg").textContent="노트 전체를 복사했어요. 메모장이나 문서에 붙여넣으세요."}catch(e){$("#expMsg").textContent="복사하지 못했어요. 노트 파일로 받기를 이용해주세요."}};
  }
}

/* 오늘 이슈 목록 */
function showList(d){
  const c=cfg();const job=c.job||"";
  const all=byDate(d);const list=job?all.filter(i=>(i.jobs||[]).includes(job)):all;const done=all.filter(i=>status(i)==="done").length;
  const m=doneByDay(),G=goal(),todayN=m[ymd(Date.now())]||0,sk=streak(m),due=dueList().length;
  const asc=[...dates].reverse(),di=asc.indexOf(d),prev=asc[di-1],next=asc[di+1];
  const WD="일월화수목금토";
  const strip=asc.map((x,k)=>{const [,mm,dd]=x.split("-");const n=byDate(x).length,dn=byDate(x).filter(i=>status(i)==="done").length;const newM=k===0||asc[k-1].slice(0,7)!==x.slice(0,7);
    return `${newM?`<span class="dmon">${+mm}월</span>`:""}<a href="#d-${x}" class="dchip${x===d?" on":""}${n&&dn===n?" all":""}" aria-label="${fmtDate(x)} 이슈 ${n}개"${x===d?' aria-current="date"':""}><span class="dw">${WD[new Date(x+"T00:00:00").getDay()]}</span><b>${+dd}</b><span class="dn">${dn===n&&n?"✓":n+"개"}</span></a>`}).join("");
  const sel=`<div class="dnav"><a class="darr${prev?"":" off"}" ${prev?`href="#d-${prev}"`:'aria-disabled="true"'} aria-label="이전 날짜">‹</a><div class="dstrip" id="dstrip">${strip}</div><a class="darr${next?"":" off"}" ${next?`href="#d-${next}"`:'aria-disabled="true"'} aria-label="다음 날짜">›</a></div>`;
  $("#head").innerHTML=`<div class="hrow"><div class="hl"><h1>${fmtDate(d)}</h1><p class="meta">이날 올라온 이슈 ${all.length}개</p></div></div>${sel}
    <div class="statline"><span>이 날 <b>${done}/${all.length}</b>개 완료</span><span>오늘 목표 <b>${todayN}/${G}</b>개</span><span>연속 <b>${sk}</b>일</span><a class="chip" href="#me">내 기록 보기 →</a></div>`;
  {const st=$("#dstrip"),on=st.querySelector(".on");if(on)st.scrollLeft=on.offsetLeft-st.clientWidth/2+on.offsetWidth/2;}
  document.onkeydown=e=>{if(!/^#?(d-.*)?$/.test(location.hash)||e.target.closest("input,textarea,select"))return;if(e.key==="ArrowLeft"&&prev)location.hash="d-"+prev;if(e.key==="ArrowRight"&&next)location.hash="d-"+next};
  let h="";
  if(due)h+=`<a class="banner" href="#review"><b>오늘 복습할 이슈 ${due}개</b><span>잊기 전에 다시 꺼내볼 때예요 →</span></a>`;
  h+=favNewsHTML();
  const wk=WEEKLY[0];if(wk&&Date.now()-new Date(wk.end+"T00:00:00").getTime()<7*DAY)h+=`<a class="banner warm" href="#w-${esc(wk.id)}"><b>주간 큰 그림 · ${shortDate(wk.start)}~${shortDate(wk.end)}</b><span>${esc(wk.title)} →</span></a>`;
  h+=`<div class="areaf"><button type="button" class="areab${job?" on":""}" id="areaB" aria-expanded="false" aria-haspopup="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>영역별 보기${job?` · <b>${esc(job)}</b>`:""}<span class="caret">▾</span></button><div class="aream" id="areaM" hidden role="menu">${["",...JOBS].map(j=>`<button role="menuitemradio" aria-checked="${j===job}" data-job="${esc(j)}" class="${j===job?"on":""}">${j||"전체"}</button>`).join("")}</div></div>`;
  h+=list.length?`<div class="cards">${list.map(cardHTML).join("")}</div>`:`<p class="empty">이날은 "${esc(job)}" 영역의 이슈가 없어요. 다른 영역이나 전체를 골라보세요.</p>`;
  h+=`<p class="small">퀴즈를 모두 풀면 완료로 표시되고, 1일·3일·7일·14일·30일 뒤에 복습으로 다시 나와요. 로그인하면 기록이 계정에 저장돼요.</p>`;
  $("#main").innerHTML=h;
  {const B=$("#areaB"),M=$("#areaM");const close=()=>{M.hidden=true;B.setAttribute("aria-expanded","false")};
    B.onclick=e=>{e.stopPropagation();const o=M.hidden;M.hidden=!o;B.setAttribute("aria-expanded",String(o))};
    document.addEventListener("click",function f(e){if(!document.body.contains(M)){document.removeEventListener("click",f);return}if(!e.target.closest(".areaf"))close()});
    document.addEventListener("keydown",function k(e){if(!document.body.contains(M)){document.removeEventListener("keydown",k);return}if(e.key==="Escape")close()});}
  document.querySelectorAll("[data-job]").forEach(b=>b.onclick=()=>{const c=cfg();c.job=b.dataset.job;save("cfg",c);showList(d)});
}
function cardHTML(it){const s=status(it),st=load(it.id);
  const stat=s==="done"?`완료${st.doneMode?" · "+MODE[st.doneMode].label:""}`:s==="doing"?"진행 중":"";
  return `<div class="card">
    <div class="top"><span class="tag">${esc(it.tag||"보험 이슈")}</span><span class="stat ${s==="done"?"done":""}">${stat}</span></div>
    <div class="ttl"><a href="#i-${esc(it.id)}">${esc(it.title)}</a></div>
    <div class="cfoot">${it.jobs?`<div class="jobs">${it.jobs.map(j=>`<span>${esc(j)}</span>`).join("")}</div>`:"<span></span>"}
    <div class="mini-modes">${["light","deep"].map(m=>`<a href="#i-${esc(it.id)}-${m}" class="${st.mode===m?"on":""}" title="${MODE[m].desc}">${MODE[m].label} ${MODE[m].time.replace("약 ","")}</a>`).join("")}</div></div></div>`}
function modeLinks(it,cur){return `<div class="mini-modes left">${["light","deep"].map(m=>`<a href="#i-${esc(it.id)}-${m}" class="${cur===m?"on":""}" title="${MODE[m].desc}">${MODE[m].label} ${MODE[m].time.replace("약 ","")}</a>`).join("")}</div>`}
function miniList(list){return `<ul class="links">${list.map(it=>{const s=status(it);return `<li><a href="#i-${esc(it.id)}">${esc(it.title)}</a><span class="small">${shortDate(it.date)} · ${esc(it.tag||"")}${s==="done"?' · <span class="ok">완료</span>':""}</span></li>`}).join("")}</ul>`}

/* 그림: 기사 숫자로 사이트가 직접 그려요 */
function fnum(v){return Math.abs(v)>=1000?v.toLocaleString("ko-KR"):String(v)}
function figHTML(f){
  const cap=`${f.title?`<figcaption><b>${esc(f.title)}</b>${f.note?`<span>${esc(f.note)}</span>`:""}</figcaption>`:""}`;
  if(f.type==="bars"){
    const items=f.items||[],vals=items.map(x=>+x.value||0),neg=vals.some(v=>v<0),ref=f.ref&&+f.ref.value;
    const max=Math.max(...vals.map(Math.abs),ref?Math.abs(ref):0)*1.08||1;
    const pos=v=>neg?50+v/max*50:v/max*100;
    const rows=items.map(x=>{const v=+x.value||0;const left=neg?Math.min(50,pos(v)):0,w=neg?Math.abs(pos(v)-50):pos(v);
      return `<div class="fb-row${x.hi?" hi":""}"><span class="fb-l">${esc(x.label)}</span><span class="fb-t">${neg?'<i class="fb-zero"></i>':""}<i class="fb-b${v<0?" neg":""}" style="left:${left}%;width:${Math.max(w,.8)}%"></i>${ref&&!neg?`<i class="fb-ref" style="left:${pos(ref)}%"></i>`:""}</span><span class="fb-v${v<0?" neg":""}">${esc(x.text||(v>0&&neg?"+":"")+fnum(v)+(f.unit||""))}</span></div>`}).join("");
    return `<figure class="fig">${cap}<div class="fbars">${rows}</div>${ref&&!neg?`<p class="fig-ref"><i></i>${esc(f.ref.label||"기준")} ${fnum(ref)}${f.unit||""}</p>`:""}</figure>`}
  if(f.type==="compare"){
    return `<figure class="fig">${cap}<div class="fcmp"><div class="fcmp-h"><span></span><span>${esc(f.left)}</span><span></span><span>${esc(f.right)}</span></div>${(f.rows||[]).map(r=>`<div class="fcmp-r"><span class="fcmp-l">${esc(r.label)}</span><span class="fcmp-a">${esc(r.left)}</span><span class="fcmp-x" aria-hidden="true">→</span><span class="fcmp-b">${esc(r.right)}</span></div>`).join("")}</div></figure>`}
  if(f.type==="timeline"){
    return `<figure class="fig">${cap}<ol class="ftl">${(f.items||[]).map(x=>`<li class="${x.now?"now":""}"><span class="ftl-w">${esc(x.when)}</span><span class="ftl-l">${esc(x.label)}</span></li>`).join("")}</ol></figure>`}
  if(f.type==="split"){
    const items=f.items||[],tot=+f.total||items.reduce((s,x)=>s+(+x.value||0),0)||1;
    return `<figure class="fig">${cap}<div class="fsplit">${items.map((x,i)=>`<i class="c${i%5}" style="width:${(+x.value||0)/tot*100}%"></i>`).join("")}</div><ul class="fsplit-k">${items.map((x,i)=>`<li><i class="c${i%5}"></i>${esc(x.label)} <b>${esc(x.text||fnum(+x.value))}</b></li>`).join("")}</ul></figure>`}
  return "";
}

/* 한 번만 일어나야 하는 일(깊게 보기 첫 완료 등)을 기억해요 */
function xpData(){const x=load("xp");x.log=x.log||{};x.ev=x.ev||{};x.total=x.total||0;return x}
function weekStart(ts){const d=new Date(sod(ts));d.setDate(d.getDate()-(d.getDay()+6)%7);return ymd(d.getTime())}
function weekDone(){const m=doneByDay(),ws=weekStart(Date.now());let n=0;for(const [k,v] of Object.entries(m))if(k>=ws)n+=v;return n}
function weekXP(x){x=x||xpData();const ws=weekStart(Date.now());let n=0;for(const [k,v] of Object.entries(x.log))if(k>=ws)n+=v;return n}
function todayXP(x){return (x||xpData()).log[ymd(Date.now())]||0}
function issueXP(id){const x=xpData();let n=0;for(const [k,v] of Object.entries(x.ev))if(k.split(":")[1]===id)n+=+v||0;return n}
function addXP(key){const x=xpData();if(key&&x.ev[key]!=null)return 0;if(key){x.ev[key]=1;save("xp",x)}leagueBump();return 1}


/* 안내 상자 */
function mascot(o){return window.mascotSVG?window.mascotSVG(o):""}
function mascotSay(text,o,extra){return `<div class="mnote"><p>${text}</p>${extra||""}</div>`}
const CHEERS=["숫자 뒤의 이유까지 봤어요.","이런 게 쌓이면 면접에서 바로 나와요.","오늘도 한 걸음 나아갔어요.","깔끔하게 끝냈어요.","이 흐름, 다음 뉴스에서 또 만날 거예요."];

/* 완료 축하 화면 */
function celebrate(o){
  const old=document.getElementById("cele");if(old)old.remove();
  const m=doneByDay(),G=goal(),todayN=m[ymd(Date.now())]||0,sk=streak(m);
  const box=document.createElement("div");box.id="cele";box.className="cele";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label",o.title);
  const conf=Array.from({length:36},(_,i)=>`<i style="left:${(i*97)%100}%;background:${["#FFB82E","#10A37A","#EC4A5A","#5B6CF0","#F472B6"][i%5]};animation-delay:${(i%9)*.08}s;animation-duration:${1.6+(i%5)*.25}s"></i>`).join("");
  box.innerHTML=`<div class="conf" aria-hidden="true">${conf}</div><div class="cele-card">
    <div class="cele-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h2>${esc(o.title)}</h2><p class="cele-say">${esc(o.say||CHEERS[Math.floor(Math.random()*CHEERS.length)])}</p>
    
    <div class="cele-stats"><div><b>${weekDone()}개</b><span>이번 주 끝낸 이슈</span></div><div><b>${sk}일</b><span>연속 학습</span></div><div><b>${todayN}/${G}</b><span>오늘 목표</span></div></div>
    <div class="cele-btns">${o.next?`<a class="pri" href="${o.next.href}">${esc(o.next.label)}</a>`:""}<button id="celeX">${o.next?"여기 더 볼래요":"닫기"}</button></div></div>`;
  document.body.appendChild(box);
  const close=()=>box.remove();
  box.querySelector("#celeX").onclick=close;box.onclick=e=>{if(e.target===box)close()};
  box.querySelectorAll("a").forEach(a=>a.addEventListener("click",close));
  document.addEventListener("keydown",function k(e){if(e.key==="Escape"){close();document.removeEventListener("keydown",k)}});
  (box.querySelector(".cele-btns .pri")||box.querySelector("#celeX")).focus();
}
function nextOf(it){const bs=basicOf(it);if(bs){const path=basicPath();const k=path.findIndex(x=>x.it&&x.it.id===it.id);const nx=path.slice(k+1).find(x=>x.it);return nx?{href:"#i-"+nx.it.id,label:"다음 단계로"}:{href:"#basics",label:"기초 다지기 길로"}}
  const sib=byDate(it.date);const nx=sib.slice(sib.findIndex(x=>x.id===it.id)+1).find(x=>status(x)!=="done");return nx?{href:"#i-"+nx.id,label:"다음 이슈 풀기"}:{href:"#d-"+it.date,label:"목록으로"}}
function goalBonus(){const m=doneByDay(),G=goal();if((m[ymd(Date.now())]||0)>=G)addXP("goal:"+ymd(Date.now()),30,"하루 목표 달성")}

/* 친구 리그 */
let lgTimer=null;
function leagueBump(){const c=cfg();if(!c.nick||!window.LeagueDB||!window.Auth||!window.Auth.user)return;clearTimeout(lgTimer);lgTimer=setTimeout(()=>{window.LeagueDB.push(weekStart(Date.now()),c.nick,weekDone()).catch(e=>console.warn("리그 저장 실패",e))},2500)}
function showLeague(){
  const ws=weekStart(Date.now()),we=ymd(new Date(ws+"T00:00:00").getTime()+6*DAY),c=cfg(),A=window.Auth,x=xpData();
  $("#head").innerHTML=`<h1>친구 리그</h1><p class="meta">${shortDate(ws)}~${shortDate(we)} · 이번 주에 끝낸 이슈 개수로 순위를 매겨요. 매주 월요일에 새로 시작해요.</p>`;
  const dm=doneByDay();const days=Array.from({length:7},(_,i)=>{const d=ymd(new Date(ws+"T00:00:00").getTime()+i*DAY);return {d,n:dm[d]||0}});const mx=Math.max(3,...days.map(v=>v.n));
  const mine=`<section class="step"><div class="sh"><h2>이번 주 내 기록</h2></div><div class="lg-me"><b>${weekDone()}</b><span>개 끝냄</span></div>
    <div class="wkbars">${days.map((v,i)=>`<div class="${v.d===ymd(Date.now())?"on":""}"><i style="height:${Math.round(v.n/mx*100)}%"></i><em>${v.n||""}</em><span>${"월화수목금토일"[i]}</span></div>`).join("")}</div>
    <p class="small" style="margin:0">이슈의 확인 퀴즈를 모두 풀면 끝낸 이슈로 세요.</p></section>`;
  let body="";
  if(!A)body=`<section class="step"><p class="small" style="margin:0">로그인 기능을 불러오는 중이에요.</p></section>`;
  else if(!A.user)body=`<section class="step">${mascotSay("리그는 로그인한 친구들끼리 겨뤄요. 로그인하면 별명으로 참가할 수 있어요.",{mood:"happy",pose:"point"})}<div class="row" style="margin-top:12px"><button class="pri" id="lgLogin">구글로 로그인</button></div></section>`;
  else if(!c.nick)body=`<section class="step"><div class="sh"><h2>리그 참가하기</h2></div>${mascotSay("별명을 정하면 이번 주에 끝낸 이슈 개수와 함께 순위표에 올라가요. 실명 말고 별명을 써주세요.",{mood:"happy",pose:"point"})}
    <div class="row" style="margin-top:12px"><input id="nick" maxlength="10" placeholder="별명 (2~10자)" aria-label="별명" style="flex:1;min-width:160px"><button class="pri" id="nickB">참가하기</button></div><div class="err" id="nickE"></div>
    <p class="small" style="margin:0">순위표에는 별명과 이번 주에 끝낸 이슈 개수만 보여요. 로그인한 사람은 누구나 순위표를 볼 수 있어요. 언제든 나갈 수 있어요.</p></section>`;
  else body=`<section class="step"><div class="sh"><h2>이번 주 순위</h2><span class="small">${esc(c.nick)}(으)로 참가 중</span></div><div id="lgList"><p class="small" style="margin:0">순위를 불러오는 중이에요.</p></div>
    <div class="row" style="margin-top:6px"><button id="lgRe">새로고침</button><button id="lgOut">리그에서 나가기</button></div></section>`;
  $("#main").innerHTML=body+mine;
  const on=(id,f)=>{const e=document.getElementById(id);if(e)e.onclick=f};
  on("lgLogin",()=>A.login());
  on("nickB",async()=>{const v=$("#nick").value.trim();if(v.length<2){$("#nickE").textContent="별명을 2자 이상 적어주세요";return}
    try{await window.LeagueDB.push(ws,v,weekDone());const c2=cfg();c2.nick=v;save("cfg",c2);showLeague()}catch(e){$("#nickE").textContent="참가하지 못했어요. 운영자가 리그 저장 규칙을 아직 열지 않았을 수 있어요."}});
  on("lgOut",async()=>{try{await window.LeagueDB.leave(ws)}catch(e){}const c2=cfg();delete c2.nick;save("cfg",c2);showLeague()});
  on("lgRe",()=>showLeague());
  if(c.nick&&A&&A.user&&window.LeagueDB){
    window.LeagueDB.push(ws,c.nick,weekDone()).catch(()=>{}).finally(()=>window.LeagueDB.top(ws).then(list=>{
      if(!list.some(r=>r.me))list.push({me:true,name:c.nick,xp:weekDone()});list.sort((a,b)=>b.xp-a.xp);
      const myRank=list.findIndex(r=>r.me)+1;
      const say=list.length<2?"아직 참가한 친구가 없어요. 링크를 친구들에게 보내서 같이 겨뤄봐요!":myRank===1?"이번 주 1등이에요! 이대로 지켜봐요.":`지금 ${myRank}등이에요. 이슈 ${list[myRank-2].xp-list[myRank-1].xp+1}개만 더 끝내면 한 계단 올라가요!`;
      $("#lgList").innerHTML=mascotSay(say,{mood:myRank===1?"happy":"thinking",pose:myRank===1?"cheer":"think"})+`<ol class="lg">${list.map((r,i)=>`<li class="${r.me?"me":""}"><span class="rk${i<3?" t"+(i+1):""}">${i+1}</span><b>${esc(r.name)}${r.me?" (나)":""}</b><em>${r.xp}개</em></li>`).join("")}</ol>`;
    }).catch(()=>{$("#lgList").innerHTML=`<p class="small no" style="margin:0">순위를 불러오지 못했어요. 운영자가 리그 저장 규칙을 아직 열지 않았거나 인터넷이 불안정할 수 있어요.</p>`}));
  }
}

/* 순서 맞추기·짝 맞추기 */
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function shuffledIdx(n){let o;do{o=shuffle([...Array(n).keys()])}while(n>2&&o.every((v,i)=>v===i));return o}
function flowStep(C,i,text,last){if(i>0){const ar=document.createElement("div");ar.className="flow-ar";ar.setAttribute("aria-hidden","true");C.appendChild(ar)}const d=document.createElement("div");d.className="flow-b"+(last?" last":"");d.innerHTML=`<span class="flow-n">${i+1}</span><span>${esc(text)}</span>`;C.appendChild(d)}
function wireOrder(it,st){
  const box=$("#ordBox");if(!box)return;const ch=it.chain;
  const start=()=>{let next=1,miss=0;const C=$("#chain");C.innerHTML="";flowStep(C,0,ch[0],ch.length===1);
    const rest=shuffledIdx(ch.length-1).map(i=>i+1);
    box.innerHTML=`<p class="ord-msg" id="ordMsg">1번 고리는 알려드릴게요. <b>그다음에 이어지는 2번 고리</b>를 아래에서 골라 눌러보세요.</p><div class="ord">${rest.map(i=>`<button data-c="${i}">${esc(ch[i])}</button>`).join("")}</div>`;
    box.querySelector(".ord").onclick=e=>{const b=e.target.closest("button");if(!b||b.disabled)return;const c=+b.dataset.c;
      if(c===next){b.remove();flowStep(C,next,ch[next],next===ch.length-1);next++;
        if(next===ch.length){box.innerHTML=`<p class="small" style="margin:0"><span class="ok">${miss?`완성했어요. 헷갈린 고리가 ${miss}번 있었어요.`:"한 번에 맞혔어요!"}</span> <button class="lnk" id="ordRe">다시 해보기</button></p>`;
          st.ch=1;save(it.id,st);addXP(`c:${it.id}`,miss?8:15,"순서 맞추기");$("#ordRe").onclick=start}
        else $("#ordMsg").innerHTML=`좋아요! <b>${next+1}번 고리</b>는 무엇일까요?`}
      else{miss++;b.classList.remove("shake");void b.offsetWidth;b.classList.add("shake");b.addEventListener("animationend",()=>b.classList.remove("shake"),{once:true});$("#ordMsg").innerHTML=`<span class="no">그 고리는 아직이에요.</span> 바로 앞 고리의 결과로 이어지는 걸 찾아보세요.`}}};
  if(st.ch){const C=$("#chain");ch.forEach((t,i)=>flowStep(C,i,t,i===ch.length-1));box.innerHTML=`<p class="small" style="margin:0"><span class="ok">순서 맞추기를 끝냈어요.</span> <button class="lnk" id="ordRe">다시 해보기</button></p>`;$("#ordRe").onclick=start}
  else start();
}
function matchTerms(it){return (it.terms||[]).slice(0,4)}
function wireMatch(it,st){
  const box=$("#mBox");if(!box)return;const ts=matchTerms(it);
  const done=()=>`<p class="small" style="margin:0"><span class="ok">용어 짝 맞추기를 끝냈어요.</span> <button class="lnk" id="mRe">다시 해보기</button></p>`;
  const start=()=>{const order=shuffle(ts.map((x,i)=>i)),opts=shuffle(ts.map((x,i)=>i));let k=0,miss=0;const got=[];
    const draw=()=>{const cur=order[k];
      box.innerHTML=`<div class="mq-top"><span>이 뜻에 맞는 용어를 골라요</span><span class="mq-dots">${order.map((x,i)=>`<i class="${i<k?"ok":i===k?"on":""}"></i>`).join("")}</span></div>
        <div class="mq-def"><span class="mq-n">${k+1} / ${ts.length}</span><p>${esc(ts[cur].d)}</p></div>
        <div class="mq-opts">${opts.map(i=>`<button data-o="${i}"${got.includes(i)?" disabled class=\"used\"":""}>${esc(ts[i].t)}</button>`).join("")}</div>
        <p class="small" id="mMsg" style="margin:0;min-height:1.4em"></p>
        ${got.length?`<ul class="mq-got">${got.map(i=>`<li><b>${esc(ts[i].t)}</b><span>${esc(ts[i].d)}</span></li>`).join("")}</ul>`:""}`;
      box.querySelector(".mq-opts").onclick=e=>{const b=e.target.closest("button");if(!b||b.disabled)return;const o=+b.dataset.o;
        if(o===cur){b.classList.add("ok-m");got.push(o);k++;
          if(k>=ts.length){setTimeout(()=>{box.innerHTML=`<p class="small" style="margin:0 0 10px"><span class="ok">${miss?`다 맞췄어요. ${miss}번 헷갈렸어요.`:"한 번에 다 맞췄어요!"}</span> <button class="lnk" id="mRe">다시 해보기</button></p><ul class="mq-got">${ts.map(x=>`<li><b>${esc(x.t)}</b><span>${esc(x.d)}</span></li>`).join("")}</ul>`;st.mt=1;save(it.id,st);addXP(`m:${it.id}`,miss?8:15);$("#mRe").onclick=start},350)}
          else setTimeout(draw,350)}
        else{miss++;b.classList.remove("shake");void b.offsetWidth;b.classList.add("shake");b.addEventListener("animationend",()=>b.classList.remove("shake"),{once:true});$("#mMsg").innerHTML=`<span class="no">아니에요.</span> "${esc(ts[o].t)}"은(는) 다른 뜻이에요. 다시 골라보세요.`}}};
    draw()};
  if(st.mt){box.innerHTML=done();$("#mRe").onclick=start}else start();
}
/* 복습용 숫자 빈칸 문제: 이슈의 숫자 타일로 만들어요 */
function numberQ(it){const ns=(it.numbers||[]).filter(x=>x.value&&x.label);if(ns.length<3)return null;const seed=Math.floor(sod(Date.now())/DAY);const pick=ns[seed%ns.length];
  const opts=shuffle(ns.map(x=>x.value).filter((v,i,a)=>a.indexOf(v)===i)).slice(0,4);if(!opts.includes(pick.value))opts[0]=pick.value;
  const o=shuffle(opts);return {q:`빈칸 채우기: "${pick.label}"은(는) [ ? ]였어요.`,o,a:o.indexOf(pick.value),e:pick.note?`${pick.label}: ${pick.value}. ${pick.note}`:`${pick.label}: ${pick.value}`,k:null,num:1}}

/* 기초 다지기 길 */
function basicPath(){const out=[];BASICS.forEach((b,u)=>{const list=basicIssues(b);out.push({unit:b,u});if(!list.length)out.push({unit:b,u,empty:1});list.forEach(it=>out.push({unit:b,u,it}))});
  let open=true;for(const x of out){if(!x.it)continue;const d=status(x.it)==="done";x.done=d;x.state=d?"done":open?"cur":"lock";if(!d&&open)open=false}return out}

/* 이슈 화면 */
let statsCache={};
/* 담당자 질문: 상황, 말풍선(인용한 말), 할 일로 나눠 보여줘요 */
function roleQ(q){
  const m=q.match(/^([\s\S]*?)["“]([\s\S]+?)["”]([\s\S]*)$/);
  if(!m){const ss=q.split(/(?<=[.?!])\s+/);let k=ss.length;while(k>0&&/\?$/.test(ss[k-1].trim()))k--;
    if(k>0&&k<ss.length)return `<p class="rq-sit">${esc(ss.slice(0,k).join(" "))}</p><div class="rq-ask"><span>미션</span><p>${esc(ss.slice(k).join(" "))}</p></div>`;
    return `<div class="rq-ask"><span>미션</span><p>${esc(q)}</p></div>`}
  const sit=m[1].trim(),said=m[2].trim(),ask=m[3].trim();
  const w=(sit.match(/([가-힣]+님|면접관|고객|선배|상사|동료)(?:이|가|께서)?\s*(?:묻|말|물어|질문)/)||[])[1]||"질문";
  return `${sit?`<p class="rq-sit">${esc(sit)}</p>`:""}<div class="rq-bub"><span class="rq-who">${esc(w)}</span><p>${esc(said)}</p></div>${ask?`<div class="rq-ask"><span>미션</span><p>${esc(ask)}</p></div>`:""}`}
function showIssue(it,mode){
  const st=load(it.id);const deep=mode==="deep";const used=new Set();
  const bs=basicOf(it);
  $("#head").innerHTML=(bs?back(`#b-${bs.id}`,`기초 다지기 · ${esc(bs.name)}`):back(`#d-${it.date}`,`${shortDate(it.date)} 이슈 목록`))+`
    <span class="tag${bs?" light":""}">${bs?"기초 다지기 · ":""}${esc(it.tag||"보험 이슈")}</span><h1>${esc(it.title)}</h1><div class="meta">${fmtDate(it.date)}${it.jobs?" · "+it.jobs.map(esc).join(", "):""}</div>${coOf(it).length?`<div class="cochips">${coOf(it).map(n=>{const c=COMPANIES.find(x=>x.name===n)||{};return `<a href="#c-${encodeURIComponent(n)}" style="${coVars(c)}"><i class="codot"></i>${esc(n)} 이슈 모아보기</a>`}).join("")}</div>`:""}${modeLinks(it,mode)}`;
  let h="";let n=0;const N=()=>String(++n).padStart(2,"0");
  const sec=(title,body,cls)=>`<section class="step${cls?" "+cls:""}"><div class="sh"><span class="n">${N()}</span><h2>${title}</h2></div>${body}</section>`;
  if(it.predict)h+=sec("읽기 전에 예측하기",`<p class="q">${esc(it.predict.q)}</p><div class="row" id="pOpts">${it.predict.options.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="pOut"></div>`,"predict");
  if(it.comic&&it.comic.panels&&window.comicHTML)h+=sec("네 컷으로 보기",comicHTML(it.comic));
  if(it.figs&&it.figs.length)h+=sec("한눈에 보기",it.figs.map(figHTML).join(""));
  if(it.gauge)h+=sec("숫자 감각 잡기",`<p class="q">${esc(it.gauge.q)}</p>
    <label class="small" for="gR">${esc(it.gauge.label)} <b id="gV" style="font-family:var(--f-num)"></b></label>
    <input type="range" id="gR" min="${it.gauge.min}" max="${it.gauge.max}" step="1" value="${it.gauge.value}">
    <div class="gauge"><div><span>보험금으로 나감</span><em id="g1"></em></div><div><span>운영비 (가정)</span><em>${it.gauge.cost}원</em></div><div><span>보험사에 남는 돈</span><em id="g3"></em></div></div>
    <p class="small" id="gN"></p>`);
  if(it.numbers)h+=sec("숫자 감각 잡기",`<div class="ntiles">${it.numbers.map(x=>`<div class="nt"><span>${esc(x.label)}</span><b>${esc(x.value)}</b>${x.note?`<em>${esc(x.note)}</em>`:""}</div>`).join("")}</div>`);
  if(it.points)h+=sec("핵심 정리",`<ul class="points">${it.points.map(p=>`<li>${hl(p,it,used)}</li>`).join("")}</ul>${it.terms?`<p class="small" style="margin:0">밑줄 친 용어를 누르면 뜻이 나와요.</p>`:""}`);
  if(deep&&it.chain)h+=sec("인과 사슬 순서 맞추기",`<p class="q">뒤섞인 고리를 원인에서 결과 순서로 눌러서 사슬을 완성해보세요.</p><div class="flow" id="chain"></div><div id="ordBox"></div>`);
  if(it.why)h+=sec("왜 중요할까",`<p style="margin:0;font-size:15.5px">${hl(it.why,it,used)}</p>`);
  const fr=(it.frames||[]).map(id=>FRAMES.find(f=>f.id===id)).filter(Boolean);
  if(fr.length)h+=sec("이 이슈에 쓰인 생각의 틀",`<div class="frs">${fr.map(f=>`<a href="#f-${f.id}"><b>${esc(f.name)}</b><span>${esc(f.ask[0])}</span></a>`).join("")}</div>`);
  if(deep&&it.role)h+=sec("내가 담당자라면",`${roleQ(it.role.q)}<textarea id="rT" placeholder="생각나는 대로 적어보세요">${esc(st.role||"")}</textarea><div class="err" id="rE"></div>
    <div class="row"><button class="pri" id="rM">모범 해설과 비교하기</button>${fbBtn("r")}</div><div id="rO"></div><div id="rFO"></div>`);
  if(deep&&it.interview)h+=sec("면접에서 이렇게 묻는다면",`<p class="q">${esc(it.interview.q)}</p><textarea id="vT" placeholder="면접관에게 말하듯 2~4문장으로">${esc(st.iv||"")}</textarea><div class="err" id="vE"></div>
    <div class="row"><button class="pri" id="vM">답변 뼈대 보기</button>${fbBtn("v")}</div><div id="vO"></div><div id="vFO"></div>`);
  const own=(deep?(it.quiz||[]).map((q,k)=>({...q,k})):lightQuiz(it)).map(q=>({...q,from:null}));
  const rev=[];
  if(deep){const pool=issues.filter(x=>x.date<it.date&&x.quiz&&x.quiz.length);
    while(rev.length<2&&pool.length){const x=pool.splice(Math.floor(Math.random()*pool.length),1)[0];rev.push({...x.quiz[Math.floor(Math.random()*x.quiz.length)],from:x.date,k:null})}}
  const all=[...own,...rev];
  if(matchTerms(it).length>=3)h+=sec("용어 짝 맞추기",`<div id="mBox"></div>`);
  if(all.length)h+=sec(`확인 퀴즈${rev.length?" · 지난 이슈 복습 포함":""}`,
    all.map((q,i)=>`<div><p class="q" style="font-size:16px">${q.from?`<span class="small">${shortDate(q.from)} 복습 · </span>`:""}${esc(q.q)}</p><div class="row" data-q="${i}">${q.o.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="qO${i}"></div></div>`).join(""));
  if(it.terms)h+=sec("이 이슈의 용어",`<div class="termlist">${it.terms.map(x=>`<details><summary>${esc(x.t)}</summary><p>${esc(x.d)}</p></details>`).join("")}</div><a class="more" href="#terms">용어 사전 전체 보기 →</a>`);
  if(it.thread){const th=THREADS.find(t=>t.id===it.thread.id);const others=th?th.issues.filter(x=>x.id!==it.id):[];
    h+=sec("이어보기 · "+esc(it.thread.name),others.length?miniList(others)+`<a class="more" href="#t-${esc(it.thread.id)}">흐름 전체를 시간 순서로 보기 →</a>`:`<p class="small" style="margin:0">이 흐름의 첫 이슈예요. 이어지는 소식이 올라오면 여기에 연결돼요.</p>`)}
  if(!deep&&(it.chain||it.role))h+=`<p class="small" style="margin:0">더 파고들고 싶으면 위에서 <a href="#i-${esc(it.id)}-deep" style="color:var(--accent)">깊게 보기</a>로 바꿔보세요. 인과 사슬, 담당자 질문, 면접 질문이 더해져요.</p>`;
  if(it.sources)h+=`<section class="src small">원문 기사: ${it.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(" · ")}<br>이 페이지의 해설은 원문을 바탕으로 새로 쓴 학습용 정리예요.</section>`;
  h+=`<details class="report"><summary>내용이 틀렸나요? 알려주세요</summary><textarea id="repT" placeholder="어느 부분이 어떻게 틀렸는지 적어주세요. 개인정보는 적지 마세요." maxlength="1000"></textarea><div class="err" id="repE"></div><div class="row"><button id="repB">보내기</button></div></details>`;
  const sib=bs?basicIssues(bs):byDate(it.date);const k=sib.findIndex(x=>x.id===it.id);const nx=sib[k+1];
  h+=`<nav class="next"><a href="${bs?"#b-"+bs.id:"#d-"+it.date}">← 목록으로</a>${nx?`<a href="#i-${esc(nx.id)}">다음 이슈: ${esc(nx.title.length>22?nx.title.slice(0,22)+"…":nx.title)} →</a>`:""}</nav>`;
  $("#main").innerHTML=h;wire(it,st,mode,all);
}

function fbBtn(p){return FEEDBACK_URL?`<button id="${p}F">인공지능 피드백 받기</button>`:""}
async function askFeedback(it,kind,p){
  const t=$("#"+p+"T"),e=$("#"+p+"E"),out=$("#"+p+"FO"),btn=$("#"+p+"F");
  if(!t.value.trim()){e.textContent="먼저 내 답을 적어보세요";return}
  const A=window.Auth;
  if(!A||!A.user){out.innerHTML=`<p class="small" style="margin:8px 0 0">인공지능 피드백은 로그인한 사람만 받을 수 있어요. <a href="#me">마이페이지</a>에서 로그인해주세요.</p>`;return}
  btn.disabled=true;out.innerHTML=`<div class="fb">답을 읽고 생각하는 중이에요. 10초쯤 걸려요.</div>`;
  try{
    const token=await A.token();
    const r=await fetch(FEEDBACK_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({issueId:it.id,kind,answer:t.value})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){out.innerHTML=`<p class="small no" style="margin:8px 0 0">${esc(d.error||"피드백을 받아오지 못했어요. 잠시 뒤 다시 시도해주세요.")}</p>`;return}
    out.innerHTML=`<div class="fb"><strong>인공지능 피드백</strong>\n${esc(d.text)}</div><p class="small" style="margin:6px 0 0">오늘 남은 피드백 ${d.left}회 · 인공지능 피드백은 틀릴 수 있으니 모범 해설과 함께 보세요.</p>`;
  }catch(err){out.innerHTML=`<p class="small no" style="margin:8px 0 0">피드백 서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.</p>`}
  finally{btn.disabled=false}
}
function needText(tId,eId){if(!$(tId).value.trim()){$(eId).textContent="먼저 내 답을 적어보세요";return false}return true}
function friendLine(it,k,q){
  const s=statsCache[it.id];if(!s)return"";const c=s["q"+k]||{};const tot=Object.values(c).reduce((a,b)=>a+(+b||0),0);
  if(tot<3)return `<p class="small fr">친구들 답이 모이는 중이에요 (${tot}명). 3명 넘게 풀면 정답률이 보여요.</p>`;
  const ok=+(c[q.a]||0);return `<p class="small fr">친구들 ${tot}명 중 <b>${Math.round(ok/tot*100)}%</b>가 정답을 골랐어요.</p>`;
}
function wire(it,st,mode,all){
  const P=$("#pOpts");
  const pReveal=j=>{P.querySelectorAll("button").forEach(b=>b.classList.toggle("picked",+b.dataset.j===j));
    const right=j===it.predict.answer;$("#pOut").innerHTML=`<div class="reveal"><span class="${right?"ok":"no"}">${right?"예측이 맞았어요. ":"예측과 달라요. "}</span>${esc(it.predict.reveal)}</div>`};
  if(P){P.onclick=e=>{const b=e.target.closest("button");if(!b)return;const first=st.pred==null;st.pred=+b.dataset.j;save(it.id,st);pReveal(st.pred);if(first)addXP(`p:${it.id}`,st.pred===it.predict.answer?5:2,st.pred===it.predict.answer?"예측 적중":"예측 참여")};if(st.pred!=null)pReveal(st.pred)}
  if(it.gauge){const g=it.gauge,r=$("#gR");const f=()=>{const v=+r.value,left=100-v-g.cost;$("#gV").textContent=v+"%";$("#g1").textContent=v+"원";
      const e=$("#g3");e.textContent=(left>0?"+":"")+left+"원";e.style.color=left<0?"var(--bad)":"var(--good)";
      $("#gN").textContent=`보험료 100원 기준이에요. ${g.label}과 운영비 비율을 더한 합산비율은 지금 ${v+g.cost}%이고, 100%를 넘으면 보험 영업만으로는 적자예요. ${g.note||""}`};r.oninput=f;f()}
  wireOrder(it,st);wireMatch(it,st);
  const B=$("#cBtn");if(B){let i=0;const C=$("#chain");B.onclick=()=>{if(i>=it.chain.length)return;if(i>0){const ar=document.createElement("div");ar.className="flow-ar";ar.setAttribute("aria-hidden","true");C.appendChild(ar)}const d=document.createElement("div");d.className="flow-b"+(i===it.chain.length-1?" last":"");d.innerHTML=`<span class="flow-n">${i+1}</span><span>${esc(it.chain[i])}</span>`;C.appendChild(d);i++;if(i>=it.chain.length){B.textContent="끝까지 왔어요";B.disabled=true}else B.textContent=`다음 고리 보기 (${i}/${it.chain.length})`}}
  const persist=(id,key,eid)=>{const t=$(id);if(!t)return;let tm;t.oninput=()=>{$(eid).textContent="";clearTimeout(tm);tm=setTimeout(()=>{st[key]=t.value;save(it.id,st)},400)}};
  persist("#rT","role","#rE");persist("#sT","sum","#sE");persist("#vT","iv","#vE");
  const check=`<p class="small" style="margin:8px 0 0">스스로 점검해보세요. 일시적인 현상인지 구조적인 변화인지 짚었나요? 무엇과 비교한 숫자인지 따져봤나요? 한 시점이 아니라 추세를 봤나요?</p>`;
  if($("#rM"))$("#rM").onclick=()=>{if(!needText("#rT","#rE"))return;st.role=$("#rT").value;save(it.id,st);addXP(`r:${it.id}`,10,"담당자 답 쓰기");$("#rO").innerHTML=`<div class="reveal"><strong>모범 해설</strong>\n${esc(it.role.model)}</div>${check}`};
  if($("#sM"))$("#sM").onclick=()=>{if(!needText("#sT","#sE"))return;st.sum=$("#sT").value;save(it.id,st);addXP(`s:${it.id}`,10,"한 줄 요약 쓰기");$("#sO").innerHTML=`<div class="reveal"><strong>예시 요약</strong>\n${esc(it.summary)}</div><p class="small" style="margin:8px 0 0">내 요약에 핵심 숫자나 원인이 빠지진 않았는지, 보험을 모르는 사람도 알아들을 말인지 비교해보세요.</p>`};
  if($("#vM"))$("#vM").onclick=()=>{if(!needText("#vT","#vE"))return;st.iv=$("#vT").value;save(it.id,st);addXP(`v:${it.id}`,10,"면접 답 쓰기");$("#vO").innerHTML=`<div class="reveal"><strong>답변 뼈대</strong>\n${esc(it.interview.guide)}</div><p class="small" style="margin:8px 0 0">결론 → 근거(숫자) → 내 직무 관점 → 마무리 순서로 말했는지 비교해보세요. 면접 연습 메뉴에서 다른 질문도 모아볼 수 있어요.</p>`};
  if($("#rF"))$("#rF").onclick=()=>{st.role=$("#rT").value;save(it.id,st);askFeedback(it,"role","r")};
  if($("#sF"))$("#sF").onclick=()=>{st.sum=$("#sT").value;save(it.id,st);askFeedback(it,"sum","s")};
  if($("#vF"))$("#vF").onclick=()=>{st.iv=$("#vT").value;save(it.id,st);askFeedback(it,"iv","v")};
  st.qa=st.qa||{};
  const need=all.filter(q=>q.k!=null).map(q=>q.k);
  const answer=(i,j,row)=>{const q=all[i];row.querySelectorAll("button").forEach(x=>x.classList.toggle("picked",+x.dataset.j===j));
    $("#qO"+i).innerHTML=`<div class="reveal"><span class="${j===q.a?"ok":"no"}">${j===q.a?"정답이에요. ":"아쉬워요. 정답은 "+esc(q.o[q.a])+". "}</span>${esc(q.e)}</div>${q.k!=null?friendLine(it,q.k,q):""}`};
  document.querySelectorAll("[data-q]").forEach(row=>{const i=+row.dataset.q,q=all[i];
    if(q.k!=null&&st.qa[q.k]!=null)answer(i,st.qa[q.k],row);
    row.onclick=e=>{const b=e.target.closest("button");if(!b)return;const j=+b.dataset.j;
      let fresh=false;
      if(q.k!=null){const first=st.qa[q.k]==null;st.qa[q.k]=j;if(first)addXP(`q:${it.id}:${q.k}`,j===q.a?10:2,j===q.a?"정답":"도전");
        if(first&&window.Stats&&window.Stats.record(it.id,q.k,j)){const s=statsCache[it.id];if(s){const c=s["q"+q.k]||(s["q"+q.k]={});c[j]=(+c[j]||0)+1}}
        if(need.every(k=>st.qa[k]!=null)){if(!st.done){st.doneAt=Date.now();st.rv={s:0,n:sod(Date.now())+DAY,c:0};fresh=true}st.done=true;if(st.doneMode!=="deep")st.doneMode=mode}
        save(it.id,st)}
      else if(q.from)addXP(`x:${it.id}:${q.q.slice(0,24)}`,j===q.a?5:1,"지난 이슈 복습");
      answer(i,j,row);
      if(q.k!=null&&need.every(k=>st.qa[k]!=null)){
        if(fresh)addXP(`d:${it.id}`,20,"이슈 완료");
        const deepNew=mode==="deep"&&addXP(`dd:${it.id}`,20,"깊게 보기 완료");
        if(fresh||deepNew){goalBonus();renderShell();setTimeout(()=>celebrate({title:mode==="deep"?"깊게 보기 완료!":"이슈 완료!",next:nextOf(it)}),500)}}}});
  if(window.Stats&&!statsCache[it.id])window.Stats.get(it.id).then(s=>{statsCache[it.id]=s||{};document.querySelectorAll("[data-q]").forEach(row=>{const i=+row.dataset.q,q=all[i];if(q.k!=null&&st.qa[q.k]!=null)answer(i,st.qa[q.k],row)})}).catch(()=>{});
  $("#repB").onclick=async()=>{const t=$("#repT").value.trim();if(!t){$("#repE").textContent="어떤 부분이 틀렸는지 적어주세요";return}
    if(!window.Stats){$("#repE").textContent="지금은 보낼 수 없어요. 잠시 뒤 다시 시도해주세요.";return}
    $("#repB").disabled=true;try{await window.Stats.report(it.id,t);$("#repT").value="";$("#repE").innerHTML=`<span class="ok">보냈어요. 확인해서 고칠게요. 고마워요.</span>`}catch(e){$("#repE").textContent="보내지 못했어요. 잠시 뒤 다시 시도해주세요."}finally{$("#repB").disabled=false}};
  $("#repT").oninput=()=>{$("#repE").textContent=""};
}

/* 기초 다지기 */
const UCOL=["#5B4DDB","#3B82F6","#10A37A","#F59E0B","#EC4899","#14B8A6","#EF4444","#8B5CF6","#65A30D"];
function showBasics(){
  const path=basicPath(),nodes=path.filter(x=>x.it),done=nodes.filter(x=>x.done).length,cur=nodes.find(x=>x.state==="cur");
  $("#head").innerHTML=`<h1>기초 다지기</h1><p class="meta">오늘 뉴스의 배경이 되는 큰 흐름을 한 칸씩 익혀요. 앞 칸을 끝내면 다음 칸이 열려요.</p>`;
  const pct=nodes.length?Math.round(done/nodes.length*100):0;
  let side=`<div class="bsum"><h2>내 진도</h2>${mascotSay(cur?(done?`<b>${done}칸</b> 끝냈어요. 이어서 해볼까요?`:"첫 칸부터 시작해 보세요."):nodes.length?"열린 칸을 모두 끝냈어요. 새 칸은 채워지는 대로 열려요.":"기초 칸을 채우는 중이에요. 곧 첫 칸이 열려요.",{mood:"happy",pose:cur?"point":"cheer"},
    `<div class="bsum-bar"><i style="width:${pct}%"></i></div><div class="bsum-row"><span class="small">${done}/${nodes.length}칸 · 흐름 ${BASICS.length}개</span>${cur?`<a class="bgo" href="#i-${esc(cur.it.id)}">${done?"이어서 하기":"시작하기"}</a>`:""}</div>`)}</div>`;
  side+=`<ol class="bidx">${BASICS.map((b,u)=>{const it=path.filter(x=>x.it&&x.u===u),d=it.filter(x=>x.done).length;return `<li><a href="#bu-${u}" style="--u:${UCOL[u%UCOL.length]}"><i></i><span>${esc(b.name)}</span><em>${it.length?`${d}/${it.length}`:"준비 중"}</em></a></li>`}).join("")}</ol>`;
  let h="";
  const units=BASICS.map((b,u)=>({b,u,items:path.filter(x=>x.it&&x.u===u)}));
  for(const {b,u,items} of units){const col=UCOL[u%UCOL.length],d=items.filter(x=>x.done).length;
    const ust=!items.length?"wait":d===items.length?"done":items.some(x=>x.state==="cur")?"cur":"lock";
    const badge=ust==="done"?"완료":ust==="cur"?"지금 단계":ust==="lock"?"잠김":"준비 중";
    const sub=items.length?`<ol class="ss">${items.map((x,k)=>{const it=x.it,st=x.state;
        const inner=`<span class="ss-d">${st==="done"?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':st==="lock"?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11"/></svg>':k+1}</span><span class="ss-t">${esc(it.title)}</span>${st==="cur"?`<span class="ss-go">${done?"이어서 하기":"시작하기"} →</span>`:""}`;
        return `<li class="${st}">${st==="lock"?`<button type="button" data-lock="1">${inner}</button>`:`<a href="#i-${esc(it.id)}">${inner}</a>`}</li>`}).join("")}</ol>`:"";
    h+=`<li class="st ${ust}" id="bu-${u}" style="--u:${col}"><span class="st-m">${ust==="done"?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':u+1}</span>
      <div class="st-c"><a class="st-h" href="#b-${esc(b.id)}"><span class="st-k">${u+1}단계</span><b>${esc(b.name)}</b><span class="st-b">${badge}${items.length?` · ${d}/${items.length}`:""}</span></a><p class="st-p">${esc(b.desc)}</p>${sub}</div></li>`;
  }
  h=`<ol class="stp">${h}</ol>`;
  $("#main").innerHTML=`<div class="bwrap"><aside class="bside">${side}</aside><div class="bmain">${h}<p class="small" id="pathMsg" role="status"></p></div></div>`;
  document.querySelectorAll('.bidx a').forEach(a=>a.onclick=e=>{e.preventDefault();const t=document.getElementById(a.getAttribute("href").slice(1));if(t)t.scrollIntoView({behavior:"smooth",block:"start"})});
  document.querySelectorAll("[data-lock]").forEach(b=>b.onclick=()=>{$("#pathMsg").innerHTML=`🔒 앞 칸을 먼저 끝내면 열려요.${cur?` <a href="#i-${esc(cur.it.id)}">지금 할 칸으로 가기 →</a>`:""}`;$("#pathMsg").scrollIntoView({block:"nearest",behavior:"smooth"})});
}
function showBasic(id){
  const b=BASICS.find(x=>x.id===id);if(!b)return showBasics();
  const list=basicIssues(b),idx=BASICS.indexOf(b),nx=BASICS[idx+1];
  const recent=daily.filter(i=>i.thread&&i.thread.id===b.id).sort((x,y)=>x.id<y.id?1:-1).slice(0,5);
  $("#head").innerHTML=back("#basics","기초 다지기")+`<span class="tag light">기초 ${idx+1} / ${BASICS.length}</span><h1>${esc(b.name)}</h1><p class="meta">${esc(b.desc)}</p>`;
  let h=`<section class="step"><div class="sh"><h2>왜 먼저 알아야 할까</h2></div><p style="margin:0">${esc(b.why)}</p></section>`;
  h+=`<section class="step"><div class="sh"><h2>순서대로 보기</h2><span class="small">${list.length}개</span></div>${list.length?`<ol class="steps">${list.map((it,n)=>{const s=status(it);return `<li><span class="sn${s==="done"?" done":""}">${s==="done"?"✓":n+1}</span><div><a href="#i-${esc(it.id)}">${esc(it.title)}</a><span class="small">${fmtDate(it.date)}${s==="doing"?" · 진행 중":""}</span></div></li>`}).join("")}</ol>`:`<p class="small" style="margin:0">이 흐름의 기초 이슈를 준비하고 있어요. 원문 기사를 확인해가며 곧 채워져요.</p>`}</section>`;
  if(recent.length)h+=`<section class="step"><div class="sh"><h2>이 흐름의 최근 소식</h2></div>${miniList(recent)}<a class="more" href="#t-${esc(b.id)}">처음부터 지금까지 시간 순서로 보기 →</a></section>`;
  if(nx)h+=`<nav class="next"><a href="#basics">← 기초 다지기</a><a href="#b-${esc(nx.id)}">다음 흐름: ${esc(nx.name)} →</a></nav>`;
  $("#main").innerHTML=h;
}

/* 오늘의 복습 */
function pickQs(it,s){const qs=(it.quiz||[]).map((q,k)=>({...q,k}));const wrong=qs.filter(q=>s.qa&&s.qa[q.k]!=null&&+s.qa[q.k]!==q.a);
  const rest=qs.filter(q=>!wrong.includes(q));const seed=sod(Date.now())/DAY;rest.sort((a,b)=>((a.k*7+seed)%5)-((b.k*7+seed)%5));return [...wrong,...rest].slice(0,2)}
function showReview(){
  $("#head").innerHTML=brand()+`<h1>오늘의 복습</h1><p class="meta" style="margin:0">끝낸 이슈를 1일, 3일, 7일, 14일, 30일 뒤에 다시 꺼내요. 다 맞히면 다음 복습이 뒤로 미뤄지고, 틀리면 내일 다시 나와요.</p>`;
  const due=dueList().slice(0,10);
  if(!due.length){const nx=nextReview();$("#main").innerHTML=`<section class="step"><p style="margin:0">오늘 복습할 이슈가 없어요.</p><p class="small" style="margin:0">${nx?`다음 복습은 ${shortDate(ymd(nx))}에 있어요.`:"이슈를 끝내면 다음 날부터 복습이 시작돼요."} 그동안 <a href="#">오늘 이슈</a>를 풀거나 <a href="#terms">용어 사전</a>을 훑어보세요.</p></section>`;return}
  const sets=due.map(it=>{const s=load(it.id);const qs=pickQs(it,s);const nq=numberQ(it);if(nq)qs.push(nq);return {it,s,qs,ans:{}}});
  $("#main").innerHTML=sets.map((x,n)=>`<section class="step" id="rv${n}"><div class="sh"><span class="n">${String(n+1).padStart(2,"0")}</span><h2>${esc(x.it.tag||"")}</h2><span class="small">${(x.s.rv&&x.s.rv.c)?x.s.rv.c+1+"번째 복습":"첫 복습"}</span></div>
    <a class="rvt" href="#i-${esc(x.it.id)}">${esc(x.it.title)}</a>
    ${x.it.points?`<details class="small"><summary>핵심 정리 다시 보기</summary><ul class="points">${x.it.points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></details>`:""}
    ${x.qs.map((q,i)=>`<div><p class="q" style="font-size:16px">${esc(q.q)}${x.s.qa&&x.s.qa[q.k]!=null&&+x.s.qa[q.k]!==q.a?' <span class="small no">지난번에 틀린 문제</span>':""}</p><div class="row" data-r="${n}" data-i="${i}">${q.o.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="rO${n}_${i}"></div></div>`).join("")}
    <div id="rR${n}"></div></section>`).join("");
  document.querySelectorAll("[data-r]").forEach(row=>{row.onclick=e=>{const b=e.target.closest("button");if(!b)return;const n=+row.dataset.r,i=+row.dataset.i,x=sets[n],q=x.qs[i],j=+b.dataset.j;
    if(x.ans[i]!=null)return;x.ans[i]=j;row.querySelectorAll("button").forEach(y=>{y.classList.toggle("picked",+y.dataset.j===j);y.disabled=true});
    $(`#rO${n}_${i}`).innerHTML=`<div class="reveal"><span class="${j===q.a?"ok":"no"}">${j===q.a?"정답이에요. ":"아쉬워요. 정답은 "+esc(q.o[q.a])+". "}</span>${esc(q.e)}</div>`;
    if(Object.keys(x.ans).length===x.qs.length){const s=load(x.it.id);const ok=x.qs.every((q,i)=>x.ans[i]===q.a);const rv=s.rv||{s:0,c:0};
      rv.c=(rv.c||0)+1;rv.s=ok?Math.min((rv.s||0)+1,GAP.length-1):0;rv.n=sod(Date.now())+GAP[rv.s]*DAY;s.rv=rv;
      let fixed=0;x.qs.forEach((q,i)=>{if(x.ans[i]===q.a&&s.qa&&s.qa[q.k]!=null&&+s.qa[q.k]!==q.a){s.qa[q.k]=q.a;fixed++}});save(x.it.id,s);
      addXP(`rv:${x.it.id}:${rv.c}`,ok?20:10,"복습");
      if(sets.every(y=>Object.keys(y.ans).length===y.qs.length)){goalBonus();setTimeout(()=>celebrate({title:"오늘 복습 끝!",say:"잊을 때쯤 다시 꺼내는 게 제일 오래 남아요.",next:{href:"#",label:"오늘 이슈 보러 가기"}}),600)}
      $(`#rR${n}`).innerHTML=`<p class="small" style="margin:0">${ok?'<span class="ok">다 맞혔어요.</span>':'<span class="no">틀린 문제가 있어요.</span>'} 다음 복습은 ${shortDate(ymd(rv.n))}이에요.${fixed?` 다시 맞힌 ${fixed}문제는 오답 노트에서 뺐어요.`:""}</p>`;
      renderShell();}}});
}

/* 용어 사전 */
function showTerms(){
  $("#head").innerHTML=brand()+`<h1>용어 사전</h1><p class="meta" style="margin:0">이슈에 나온 보험 용어 ${GLOSS.length}개가 모여 있어요. 이슈가 쌓일수록 나만의 용어집이 돼요.</p>`;
  $("#main").innerHTML=`<input type="search" id="tq" placeholder="용어 찾기" aria-label="용어 찾기"><div id="tres" class="glist"></div>`;
  const render=()=>{const q=$("#tq").value.trim();const list=GLOSS.filter(g=>!q||g.t.includes(q)||g.d.includes(q));
    $("#tres").innerHTML=list.length?list.map(g=>`<a class="gitem" href="#g-${encodeURIComponent(g.t)}"><b>${esc(g.t)}</b><span>${esc(g.d)}</span><em>이슈 ${g.issues.length}개</em></a>`).join(""):`<p class="empty">"${esc(q)}"에 맞는 용어가 없어요.</p>`};
  $("#tq").oninput=render;render();
}
function showTerm(t){
  const g=GLOSS.find(x=>x.t===t);if(!g)return showTerms();
  $("#head").innerHTML=brand()+back("#terms","용어 사전")+`<h1>${esc(g.t)}</h1>`;
  $("#main").innerHTML=`<section class="step"><p style="margin:0;font-size:16.5px">${esc(g.d)}</p></section><section class="step"><div class="sh"><h2>이 용어가 나온 이슈</h2><span class="small">${g.issues.length}개</span></div>${miniList(g.issues)}</section>`;
}

/* 생각의 틀 */
function framesUse(id){return issues.filter(i=>(i.frames||[]).includes(id))}
function showFrames(){
  $("#head").innerHTML=brand()+`<h1>생각의 틀 모음</h1><p class="meta" style="margin:0">뉴스를 볼 때마다 꺼내 쓸 질문 도구예요. 이슈가 쌓일수록 어떤 틀을 자주 쓰는지 보여요.</p>`;
  $("#main").innerHTML=`<div class="cards">${FRAMES.map(f=>`<a class="fcard" href="#f-${f.id}"><div class="top"><b>${esc(f.name)}</b><span class="small">이슈 ${framesUse(f.id).length}개</span></div><p>${esc(f.desc)}</p><ul>${f.ask.map(a=>`<li>${esc(a)}</li>`).join("")}</ul></a>`).join("")}</div>`;
}
function showFrame(id){
  const f=FRAMES.find(x=>x.id===id);if(!f)return showFrames();const list=framesUse(id);
  $("#head").innerHTML=brand()+back("#frames","생각의 틀 모음")+`<h1>${esc(f.name)}</h1>`;
  $("#main").innerHTML=`<section class="step"><p style="margin:0">${esc(f.desc)}</p><div class="sh" style="margin-top:4px"><h2>스스로 던질 질문</h2></div><ul class="points">${f.ask.map(a=>`<li>${esc(a)}</li>`).join("")}</ul></section>
    <section class="step"><div class="sh"><h2>이 틀로 읽어볼 이슈</h2><span class="small">${list.length}개</span></div>${list.length?miniList(list):`<p class="small" style="margin:0">아직 이 틀을 쓴 이슈가 없어요.</p>`}</section>`;
}

/* 이어보기 */
function showThreads(){
  $("#head").innerHTML=brand()+`<h1>이슈 이어보기</h1><p class="meta" style="margin:0">계속 이어지는 사건을 묶었어요. 개별 뉴스가 아니라 흐름으로 보면 다음 소식이 어떻게 나올지 감이 와요.</p>`;
  $("#main").innerHTML=THREADS.length?`<div class="cards">${THREADS.map(t=>{const last=t.issues[t.issues.length-1];return `<a class="fcard" href="#t-${esc(t.id)}"><div class="top"><b>${esc(t.name)}</b><span class="small">이슈 ${t.issues.length}개</span></div><p class="small" style="margin:0">최근: ${shortDate(last.date)} · ${esc(last.title)}</p></a>`}).join("")}</div>`:`<p class="empty">아직 묶인 흐름이 없어요.</p>`;
}
function showThread(id){
  const t=THREADS.find(x=>x.id===id);if(!t)return showThreads();
  $("#head").innerHTML=brand()+back("#threads","이슈 이어보기")+`<h1>${esc(t.name)}</h1><p class="meta" style="margin:0">이슈 ${t.issues.length}개 · ${shortDate(t.issues[0].date)}부터</p>`;
  $("#main").innerHTML=`<ol class="tl">${t.issues.map(it=>{const s=status(it);return `<li><span class="tld">${fmtDate(it.date)}</span><a href="#i-${esc(it.id)}">${esc(it.title)}</a>${it.points?`<p>${esc(it.points[0])}</p>`:""}${s==="done"?'<span class="small ok">완료</span>':""}</li>`}).join("")}</ol>
    <p class="small">위에서 아래로 시간 순서예요. 새 소식이 올라오면 아래에 이어 붙어요.</p>`;
}

/* 주간 큰 그림 */
function nextSunday(){const d=new Date();d.setDate(d.getDate()+((7-d.getDay())%7));return ymd(d.getTime())}
function showWeeklyList(){
  $("#head").innerHTML=brand()+`<h1>주간 큰 그림</h1><p class="meta" style="margin:0">매주 일요일 아침, 한 주 이슈를 엮은 정리와 주간 퀴즈가 올라와요.</p>`;
  $("#main").innerHTML=WEEKLY.length?`<div class="cards">${WEEKLY.map(w=>{const s=load("wk-"+w.id);return `<a class="fcard" href="#w-${esc(w.id)}"><div class="top"><b>${shortDate(w.start)} ~ ${shortDate(w.end)}</b><span class="small">${s.done?'<span class="ok">퀴즈 완료</span>':""}</span></div><p style="margin:0">${esc(w.title)}</p></a>`}).join("")}</div>`
    :`<section class="step"><p style="margin:0">첫 주간 큰 그림은 ${shortDate(nextSunday())} 일요일 아침에 올라와요.</p><p class="small" style="margin:0">한 주 동안 올라온 이슈들이 서로 어떻게 이어지는지 정리하고, 그 주 이슈에서 뽑은 퀴즈 10문제로 마무리해요.</p></section>`;
}
function showWeek(id){
  const w=WEEKLY.find(x=>x.id===id);if(!w)return showWeeklyList();
  const wi=issues.filter(i=>i.date>=w.start&&i.date<=w.end).sort((a,b)=>a.id<b.id?-1:1);
  const qs=[];wi.forEach(it=>(it.quiz||[]).forEach((q,k)=>{if(!q.deep)qs.push({...q,it})}));const quiz=qs.filter((_,i)=>i%Math.max(1,Math.ceil(qs.length/10))===0).slice(0,10);
  const st=load("wk-"+w.id);st.qa=st.qa||{};
  $("#head").innerHTML=brand()+back("#weekly","주간 큰 그림")+`<span class="tag light">${shortDate(w.start)} ~ ${shortDate(w.end)}</span><h1>${esc(w.title)}</h1>`;
  let h=`<section class="step"><div class="sh"><h2>이번 주 큰 그림</h2></div>${(w.big||[]).map(p=>`<p style="margin:0">${esc(p)}</p>`).join("")}</section>`;
  if(w.flows&&w.flows.length)h+=`<section class="step"><div class="sh"><h2>이어지는 흐름</h2></div><ul class="links">${w.flows.map(f=>{const t=THREADS.find(x=>x.id===f.thread);return `<li>${t?`<a href="#t-${esc(t.id)}">${esc(t.name)}</a>`:""}<span class="small">${esc(f.note)}</span></li>`}).join("")}</ul></section>`;
  if(w.takeaway)h+=`<section class="step"><div class="sh"><h2>한 줄 정리</h2></div><p style="margin:0;font-family:var(--f-disp);font-size:18px">${esc(w.takeaway)}</p>${w.next?`<p class="small" style="margin:0">다음 주에 지켜볼 것: ${esc(w.next)}</p>`:""}</section>`;
  if(wi.length)h+=`<section class="step"><div class="sh"><h2>이번 주 이슈</h2><span class="small">${wi.length}개</span></div>${miniList(wi)}</section>`;
  if(quiz.length)h+=`<section class="step"><div class="sh"><h2>주간 퀴즈</h2><span class="small" id="wkScore"></span></div>${quiz.map((q,i)=>`<div><p class="q" style="font-size:16px"><span class="small">${shortDate(q.it.date)} · </span>${esc(q.q)}</p><div class="row" data-w="${i}">${q.o.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="wO${i}"></div></div>`).join("")}</section>`;
  $("#main").innerHTML=h;
  const score=()=>{const n=Object.keys(st.qa).length,ok=quiz.filter((q,i)=>st.qa[i]===q.a).length;$("#wkScore").textContent=n?`${quiz.length}문제 중 ${ok}개 정답`:""};
  const show=(i,j,row)=>{const q=quiz[i];row.querySelectorAll("button").forEach(x=>x.classList.toggle("picked",+x.dataset.j===j));$("#wO"+i).innerHTML=`<div class="reveal"><span class="${j===q.a?"ok":"no"}">${j===q.a?"정답이에요. ":"아쉬워요. 정답은 "+esc(q.o[q.a])+". "}</span>${esc(q.e)}</div>`};
  document.querySelectorAll("[data-w]").forEach(row=>{const i=+row.dataset.w;if(st.qa[i]!=null)show(i,st.qa[i],row);
    row.onclick=e=>{const b=e.target.closest("button");if(!b)return;const j=+b.dataset.j;st.qa[i]=j;if(Object.keys(st.qa).length>=quiz.length)st.done=true;save("wk-"+w.id,st);show(i,j,row);score()}});
  if(quiz.length)score();
}

/* 면접 연습 */
let ivJob="";
function showInterview(){
  $("#head").innerHTML=brand()+`<h1>면접 연습</h1><p class="meta" style="margin:0">이슈마다 나올 법한 면접 질문을 모았어요. 말하듯 적어보고 답변 뼈대와 비교해보세요. 쓴 답은 이슈 화면과 마이페이지에도 함께 저장돼요.</p>`;
  const list=issues.filter(i=>i.interview&&(!ivJob||(i.jobs||[]).includes(ivJob)));
  $("#main").innerHTML=`<div class="chips" role="group" aria-label="영역별 보기"><span class="small">영역별 보기</span>${["",...JOBS].map(j=>`<button data-ivj="${esc(j)}" class="${j===ivJob?"on":""}">${j||"전체"}</button>`).join("")}</div>
    ${list.length?list.map(it=>{const s=load(it.id);return `<section class="step"><div class="sh"><h2>${shortDate(it.date)} · ${esc(it.tag||"")}</h2>${s.iv&&s.iv.trim()?'<span class="small ok">답 씀</span>':""}</div>
    <p class="q">${esc(it.interview.q)}</p><a class="more" href="#i-${esc(it.id)}-deep">관련 이슈: ${esc(it.title)} →</a>
    <textarea data-iv="${esc(it.id)}" placeholder="면접관에게 말하듯 2~4문장으로">${esc(s.iv||"")}</textarea>
    <details><summary class="small" style="cursor:pointer;color:var(--accent)">답변 뼈대 보기</summary><div class="reveal" style="margin-top:8px">${esc(it.interview.guide)}</div></details></section>`}).join(""):`<p class="empty">이 직무 관점의 면접 질문이 아직 없어요.</p>`}`;
  document.querySelectorAll("[data-ivj]").forEach(b=>b.onclick=()=>{ivJob=b.dataset.ivj;showInterview()});
  document.querySelectorAll("[data-iv]").forEach(t=>{let tm;t.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{const s=load(t.dataset.iv);s.iv=t.value;save(t.dataset.iv,s)},400)}});
}

/* 내 지원 회사 고정 (최대 3곳) */
const favs=()=>(cfg().fav||[]).filter(n=>COMPANIES.some(c=>c.name===n));
function toggleFav(name){const c=cfg();let f=favs();if(f.includes(name))f=f.filter(x=>x!==name);else{if(f.length>=3){alertBox("지원 회사는 3곳까지 고정할 수 있어요. 다른 회사를 먼저 풀어주세요.");return false}f.push(name)}c.fav=f;save("cfg",c);return true}
function alertBox(t){let b=document.getElementById("toast1");if(!b){b=document.createElement("div");b.id="toast1";b.className="toast1";b.setAttribute("role","status");document.body.appendChild(b)}b.textContent=t;b.classList.add("on");clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove("on"),2600)}
const STAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>';
function favBtn(name,big){const on=favs().includes(name);return `<button type="button" class="favb${on?" on":""}${big?" big":""}" data-fav="${esc(name)}" aria-pressed="${on}" aria-label="${esc(name)} ${on?"지원 회사 고정 풀기":"지원 회사로 고정"}">${STAR}${big?`<span>${on?"지원 회사로 고정됨":"지원 회사로 고정"}</span>`:""}</button>`}
function wireFav(after){document.querySelectorAll("[data-fav]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();if(toggleFav(b.dataset.fav))after()})}
function favNewsHTML(){const f=favs();
  if(!f.length)return `<a class="favhint" href="#companies">${STAR}<span><b>지원할 회사를 고정해보세요</b> 회사별 보기에서 별을 누르면 그 회사 새 소식이 여기에 먼저 떠요.</span></a>`;
  const since=ymd(Date.now()-14*DAY);
  return `<section class="favbox"><div class="sh"><h2>내 지원 회사 소식</h2><a class="chip" href="#mock">모의 면접 보기 →</a></div><div class="favgrid">${f.map(n=>{const c=COMPANIES.find(x=>x.name===n);const nw=coNews(n).filter(x=>x.date>=since).slice(0,3);const is=coIssues(n).filter(x=>x.date>=since);
    return `<div class="favc" style="${coVars(c)}"><a class="favc-h" href="#c-${encodeURIComponent(n)}">${coMono(c)}<b>${esc(n)}</b><em>${nw.length||is.length?`최근 2주 소식 ${coNews(n).filter(x=>x.date>=since).length}개${is.length?` · 이슈 ${is.length}개`:""}`:"최근 2주 새 소식 없음"}</em></a>${nw.length?`<ul>${nw.map(x=>`<li><span>${shortDate(x.date)}</span>${esc(x.title)}</li>`).join("")}</ul>`:""}</div>`}).join("")}</div></section>`}

/* 회사 기본 정보 아이콘 */
const ICO=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
function prodIcon(n){
  if(/자동차/.test(n))return ICO('<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>');
  if(/장기|건강|보장/.test(n))return ICO('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>');
  if(/일반|화재|기업/.test(n))return ICO('<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>');
  if(/다이렉트|온라인|디지털/.test(n))return ICO('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>');
  if(/연금|저축|변액|투자/.test(n))return ICO('<path d="M4 18l5-5 4 3 7-8"/><path d="M15 8h5v5"/>');
  if(/설계사|대면|채널|방카/.test(n))return ICO('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11l2 2 4-4"/>');
  if(/재보험|해외/.test(n))return ICO('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>');
  return ICO('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>');}
function cultIcon(t){
  if(/근무|시간|출퇴근|재택/.test(t))return ICO('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>');
  if(/교육|멘토|학습|성장/.test(t))return ICO('<path d="M3 9l9-4 9 4-9 4z"/><path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4"/>');
  if(/채용|직무|계리|상품개발/.test(t))return ICO('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2"/>');
  if(/상|격려|도전|문화/.test(t))return ICO('<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.3 7 19l1.2-5.6L4 9.6 9.6 9z"/>');
  return ICO('<path d="M5 12.5l4.5 4.5L19 7.5"/>');}
/* 회사별 보기 */
let coQ="";
function showCompanies(){
  $("#head").innerHTML=`<h1>회사별 보기</h1><p class="meta" style="margin:0">지원할 회사에 관한 이슈를 한곳에 모아 봐요. 면접 전에 그 회사가 최근 어떤 일을 겪었는지 훑고, 업계 전체 흐름과 함께 연결해서 말할 준비를 해요.</p>`;
  const kinds=[["생명","생명보험사"],["손해","손해보험사"],["재보험","재보험사"]];
  const card0=c=>{const list=coIssues(c.name),nw=coNews(c.name),dates=[...list,...nw].map(x=>x.date).sort().reverse(),n=list.length+nw.length;return `<a class="cocard${n||PROFILES[c.name]?"":" off"}" style="${coVars(c)}" href="#c-${encodeURIComponent(c.name)}">${coMono(c)}<b>${esc(c.name)}</b><span>${c.group?esc(c.group)+" 계열":"독립 보험사"}</span><em>${n?`${nw.length?`소식 ${nw.length}개`:""}${nw.length&&list.length?" · ":""}${list.length?`이슈 ${list.length}개`:""} · 최근 ${shortDate(dates[0])}`:PROFILES[c.name]?"기본 정보 있음 · 소식 모으는 중":"아직 소식 없음"}</em></a>`};
  const card=c=>`<div class="cowrap">${card0(c)}${favBtn(c.name)}</div>`;
  $("#main").innerHTML=`<input type="search" id="coq" placeholder="회사 이름 찾기" aria-label="회사 이름 찾기" value="${esc(coQ)}"><div id="cores"></div>`;
  const render=()=>{const q=coQ.trim();let h="";
    for(const [k,label] of kinds){const cs=COMPANIES.filter(c=>c.kind===k&&(!q||[c.name,c.group,...(c.aka||[])].some(x=>x&&x.includes(q)))).sort((a,b)=>(coIssues(b.name).length+coNews(b.name).length)-(coIssues(a.name).length+coNews(a.name).length));
      if(cs.length)h+=`<section class="cosec"><h2>${label}</h2><div class="cogrid">${cs.map(card).join("")}</div></section>`}
    const fv=favs().map(n=>COMPANIES.find(c=>c.name===n));
    if(!q)h=(fv.length?`<section class="cosec"><h2>내 지원 회사</h2><div class="cogrid">${fv.map(card).join("")}</div></section>`:`<p class="small favtip">${STAR} 카드 오른쪽 위 별을 누르면 지원 회사로 고정돼요(최대 3곳). 오늘 이슈 화면에 그 회사 새 소식이 먼저 뜨고, 모의 면접도 그 회사로 볼 수 있어요.</p>`)+h;
    if(!q&&NEWS.length)h=`<section class="step"><div class="sh"><h2>최근 회사 소식</h2><span class="small">전체 ${NEWS.length}개</span></div><ul class="nwl">${NEWS.slice(0,8).map(n=>newsLi(n)).join("")}</ul></section>`+h;
    $("#cores").innerHTML=h||`<p class="empty">"${esc(q)}"에 맞는 회사가 없어요.</p>`;wireFav(render)};
  $("#coq").oninput=e=>{coQ=e.target.value;render()};render();
}
function showCompany(name){
  const c=COMPANIES.find(x=>x.name===name);if(!c)return showCompanies();
  const list=coIssues(name),done=list.filter(i=>status(i)==="done").length,nw=coNews(name);
  const kindLabel={"생명":"생명보험사","손해":"손해보험사","재보험":"재보험사"}[c.kind];
  const pf0=PROFILES[name],lastR=pf0&&pf0.results&&pf0.results.items[pf0.results.items.length-1],found=pf0&&pf0.facts&&pf0.facts.find(f=>f.label==="설립");
  const kpi=[lastR&&[lastR.label+" 순이익",lastR.text],found&&["설립",(found.value.match(/\d{4}년/)||[found.value])[0]],["회사 소식",nw.length+"개"],["공부할 이슈",list.length+"개"]].filter(Boolean);
  $("#head").innerHTML=back("#companies","회사별 보기")+`<div class="cohero" style="${coVars(c)}"><div class="cohero-top">${coMono(c,"big")}<div class="cohero-t"><div class="cohero-tags"><span>${kindLabel}</span>${c.group?`<span>${esc(c.group)} 계열</span>`:""}</div><h1>${esc(c.name)}</h1></div>${favBtn(c.name,true)}</div>
    ${pf0&&pf0.summary?`<p class="cohero-sum">${esc(pf0.summary)}</p>`:""}<div class="cohero-kpi">${kpi.map(([l,v])=>`<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join("")}</div></div>`;
  let h="";const pf=PROFILES[name];
  if(pf){const tabs=[["about","한눈에"],pf.products&&["products","주력 상품"],pf.talent&&["talent","인재상·문화"],pf.results&&["results","실적"],pf.history&&["history","걸어온 길"],pf.tips&&["tips","면접 팁"]].filter(Boolean);
    const P={};
    P.about=`${pf.facts?`<dl class="pf-facts">${pf.facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}</dl>`:""}${pf.strengths?`<h3 class="pf-h">이 회사의 특징</h3><ol class="pf-str">${pf.strengths.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`:""}`;
    if(pf.products)P.products=`<div class="pf-prod">${pf.products.map(x=>`<div class="pp"><span class="pp-ic">${prodIcon(x.name)}</span><div><b>${esc(x.name)}</b><p>${esc(x.d)}</p></div></div>`).join("")}</div>`;
    if(pf.talent)P.talent=`<div class="pf-talent">${pf.talent.map((t,i)=>`<div class="tl"><span class="tl-n">${String(i+1).padStart(2,"0")}</span><b>${esc(t.k)}</b><p>${esc(t.d)}</p></div>`).join("")}</div>${pf.culture?`<h3 class="pf-h">일하는 방식과 분위기</h3><ul class="pf-cul">${pf.culture.map(x=>`<li><span class="cu-ic">${cultIcon(x)}</span><p>${esc(x)}</p></li>`).join("")}</ul>`:""}`;
    if(pf.results)P.results=figHTML({type:"bars",title:pf.results.title,unit:pf.results.unit,items:pf.results.items.map((x,i,a)=>({label:x.label,value:x.value,text:x.text,hi:i===a.length-1}))})+`<ul class="pf-rn">${pf.results.items.filter(x=>x.note).map(x=>`<li><b>${esc(x.label)}</b> ${esc(x.note)}</li>`).join("")}</ul>${pf.results.note?`<p class="small" style="margin:0">${esc(pf.results.note)}</p>`:""}`;
    if(pf.history)P.history=figHTML({type:"timeline",title:"",items:pf.history.map(x=>({when:x.when,label:x.label}))});
    if(pf.tips)P.tips=`<ol class="pf-tips">${pf.tips.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`;
    h+=`<section class="step pf" style="${coVars(c)}"><div class="pf-head"><h2>회사 기본 정보</h2><span>${esc(pf.updated||"")} 기준</span></div>
      <div class="pf-tabs" role="tablist">${tabs.map(([k,l],i)=>`<button role="tab" data-pt="${k}" aria-selected="${i===0}" class="${i===0?"on":""}">${l}</button>`).join("")}</div>
      ${tabs.map(([k],i)=>`<div class="pf-p" data-pp="${k}"${i?" hidden":""}>${P[k]}</div>`).join("")}
      ${pf.sources?`<details class="pf-src small"><summary>출처 ${pf.sources.length}곳</summary><ul>${pf.sources.map(x=>`<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a></li>`).join("")}</ul></details>`:""}</section>`}
  else h+=`<section class="step pf-empty"><p class="small" style="margin:0">이 회사의 특징, 인재상, 분위기, 실적 요약을 출처를 확인해가며 채우는 중이에요.</p></section>`;
  if(nw.length){const kinds=[...new Set(nw.map(n=>n.kind).filter(Boolean))];
    h+=`<section class="step"><div class="sh"><h2>회사 소식 모아보기</h2><span class="small">최신순 · ${nw.length}개</span></div>
      ${kinds.length>1?`<div class="chips" role="group" aria-label="소식 종류"><button class="on" data-nk="">전체</button>${kinds.map(k=>`<button data-nk="${esc(k)}">${esc(k)}</button>`).join("")}</div>`:""}
      <ul class="nwl" id="nwl">${nw.map(n=>newsLi(n,name)).join("")}</ul></section>`}
  if(list.length){
    h+=`<section class="step"><div class="sh"><h2>깊게 공부할 이슈</h2><span class="small">최신순</span></div><ol class="cotl">${list.map(it=>{const s=status(it);return `<li class="${s}"><span class="cotl-d">${fmtDate(it.date)}</span><a href="#i-${esc(it.id)}">${esc(it.title)}</a><span class="small">${esc(it.tag||"")}${s==="done"?' · <span class="ok">끝냄</span>':s==="doing"?" · 진행 중":""}</span></li>`}).join("")}</ol></section>`;
    const ivs=list.filter(it=>it.interview);
    if(ivs.length)h+=`<section class="step"><div class="sh"><h2>${esc(c.name)} 면접에서 나올 수 있는 질문</h2><span class="small">${ivs.length}개</span></div>
      <p class="small" style="margin:0">이 회사가 나온 이슈의 면접 질문이에요. "우리 회사의 이 일을 어떻게 보나요?"처럼 회사 이름을 넣어 물어본다고 생각하고 답해보세요.</p>
      ${ivs.map(it=>{const s=load(it.id);return `<div class="coq"><p class="q" style="font-size:16px;margin:0">${esc(it.interview.q)}</p><span class="small">${shortDate(it.date)} · ${esc(it.title)}${s.iv&&s.iv.trim()?' · <span class="ok">답 씀</span>':""}</span>
        <details><summary class="small" style="cursor:pointer;color:var(--accent)">답변 뼈대 보기</summary><div class="reveal" style="margin-top:8px">${esc(it.interview.guide)}</div></details>
        <a class="more" href="#i-${esc(it.id)}-deep">이슈에서 내 답 써보기 →</a></div>`}).join("")}</section>`;
    const terms=[...new Map(list.flatMap(it=>it.terms||[]).map(x=>[x.t,x])).values()].slice(0,10);
    if(terms.length)h+=`<section class="step"><div class="sh"><h2>이 회사 이슈에 나온 용어</h2></div><div class="termlist">${terms.map(x=>`<details><summary>${esc(x.t)}</summary><p>${esc(x.d)}</p></details>`).join("")}</div></section>`;
  }
  const common=issues.filter(it=>!coOf(it).length&&!it.basic).sort((a,b)=>a.date<b.date?1:-1).slice(0,5);
  if(common.length)h+=`<section class="step"><div class="sh"><h2>업계 전체 흐름도 함께</h2></div><p class="small" style="margin:0">특정 회사가 아니라 업계 모두에 영향을 주는 최근 이슈예요. 면접에서 "업계 흐름 속에서 우리 회사는?"으로 이어지기 좋아요.</p>${miniList(common)}</section>`;
  const sib=COMPANIES.filter(x=>x.name!==c.name&&((c.group&&x.group===c.group)||x.kind===c.kind)).sort((a,b)=>((b.group&&b.group===c.group)?1:0)-((a.group&&a.group===c.group)?1:0)).slice(0,8);
  h+=`<section class="step"><div class="sh"><h2>함께 비교해볼 회사</h2></div><div class="cochips">${sib.map(x=>`<a href="#c-${encodeURIComponent(x.name)}" style="${coVars(x)}"><i class="codot"></i>${esc(x.name)}${x.group&&x.group===c.group?" · 같은 그룹":""}</a>`).join("")}</div></section>`;
  $("#main").innerHTML=h;
  wireFav(()=>showCompany(name));
  document.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-pt]").forEach(x=>{x.classList.toggle("on",x===b);x.setAttribute("aria-selected",x===b)});document.querySelectorAll("[data-pp]").forEach(p=>p.hidden=p.dataset.pp!==b.dataset.pt)});
  document.querySelectorAll("[data-nk]").forEach(b=>b.onclick=()=>{const k=b.dataset.nk;document.querySelectorAll("[data-nk]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll("#nwl li").forEach(li=>li.hidden=!!k&&li.dataset.k!==k)});
}
function newsLi(n,cur){const others=(n.companies||[]).filter(x=>x!==cur);
  return `<li data-k="${esc(n.kind||"")}"><div class="nw-top"><span class="nw-d">${shortDate(n.date)}</span>${n.kind?`<span class="nw-k">${esc(n.kind)}</span>`:""}${!cur?(n.companies||[]).map(c=>`<a class="nw-c" href="#c-${encodeURIComponent(c)}">${esc(c)}</a>`).join(""):""}</div>
    <b class="nw-t">${esc(n.title)}</b>${n.text?`<p class="nw-x">${esc(n.text)}</p>`:""}${n.point?`<p class="nw-p"><span>면접 포인트</span>${esc(n.point)}</p>`:""}
    <div class="nw-f">${n.source&&n.source.url?`<a href="${esc(n.source.url)}" target="_blank" rel="noopener">${esc(n.source.name||"원문 기사")} ↗</a>`:""}${n.issue&&issues.find(i=>i.id===n.issue)?`<a href="#i-${esc(n.issue)}">이슈로 깊게 공부하기 →</a>`:""}${cur&&others.length?others.map(c=>`<a href="#c-${encodeURIComponent(c)}">${esc(c)}</a>`).join(""):""}</div></li>`}

/* 모의 면접 */
let MK=null;const MKSET={co:"",n:5,sec:120};
function mockPool(name){
  const out=[],c=name&&COMPANIES.find(x=>x.name===name),pf=name&&PROFILES[name],job=(cfg().job||"계리·상품개발");
  if(c){
    out.push({kind:"지원 동기",q:`왜 ${name}인가요? 경쟁사와 비교해서 ${name}을(를) 고른 이유를 말해보세요.`,
      guide:pf?`결론부터: ${name}을(를) 고른 이유 한 문장\n근거: ${(pf.strengths||[]).slice(0,2).join(" / ")}\n관점: 이 강점이 내가 하고 싶은 일(${job})과 어떻게 이어지는지\n마무리: 입사해서 해보고 싶은 일`:"결론부터: 지원 이유 한 문장\n근거: 회사의 강점이나 최근 소식 하나를 숫자와 함께\n관점: 내 직무와의 연결\n마무리: 입사 후 하고 싶은 일",w:3});
    if(pf&&pf.results)out.push({kind:"회사 이해",q:`${name}의 최근 실적을 아는 대로 설명해보세요. 좋아진 점과 걱정되는 점을 나눠서요.`,guide:`최근 3년 순이익: ${pf.results.items.map(x=>x.label+" "+x.text).join(" → ")}\n${pf.results.note||""}\n좋은 점과 걱정되는 점을 하나씩, 숫자와 함께 말하면 좋아요.`,w:2});
    if(pf&&pf.talent)out.push({kind:"인재상",q:`${name}의 인재상 가운데 본인과 가장 잘 맞는 것은 무엇이고, 그걸 보여준 경험은 무엇인가요?`,guide:`인재상: ${pf.talent.map(t=>t.k+"("+t.d+")").join(", ")}\n하나를 골라 → 내 경험(상황, 내가 한 일, 결과) → 입사 후 어떻게 이어갈지 순서로 말해요.`,w:2});
    if(pf&&pf.products)out.push({kind:"상품 이해",q:`${name}의 주력 상품 하나를 골라, 계리·상품개발 관점에서 앞으로 어떤 점을 관리해야 할지 말해보세요.`,guide:pf.products.map(x=>x.name+": "+x.d).join("\n")+"\n손해율, 보험료, 경쟁 상품, 제도 변화 중 하나와 연결해서 말하면 좋아요.",w:2});
    for(const n of coNews(name).slice(0,8))out.push({kind:"최근 소식",q:`${name}의 최근 소식 "${n.title}"을(를) 어떻게 보나요?`,guide:`${n.text||""}${n.point?"\n면접 포인트: "+n.point:""}\n결론 → 근거(숫자) → 직무 관점 → 회사에 주는 의미 순서로 말해요.`,w:1,link:n.issue?"#i-"+n.issue:null});
    for(const it of coIssues(name).filter(i=>i.interview).slice(0,6))out.push({kind:"관련 이슈",q:it.interview.q.replace(/^/,"")+` (${name} 입장에서)`,guide:it.interview.guide,w:2,link:"#i-"+it.id+"-deep"});
  }
  const recent=issues.filter(i=>i.interview&&!i.basic).sort((a,b)=>a.date<b.date?1:-1).slice(0,12);
  for(const it of recent)if(!out.some(o=>o.link==="#i-"+it.id+"-deep"))out.push({kind:"업계 이슈",q:it.interview.q,guide:it.interview.guide,w:c?0.6:1,link:"#i-"+it.id+"-deep"});
  return out}
function mockPick(pool,n){const a=pool.slice(),out=[];const first=a.findIndex(x=>x.kind==="지원 동기");if(first>=0)out.push(a.splice(first,1)[0]);
  while(out.length<n&&a.length){const tot=a.reduce((s,x)=>s+x.w,0);let r=Math.random()*tot,k=0;for(;k<a.length;k++){r-=a[k].w;if(r<=0)break}out.push(a.splice(Math.min(k,a.length-1),1)[0])}return out}
function showMock(){
  if(MK&&MK.i<MK.qs.length)return mockQ();
  if(MK&&MK.i>=MK.qs.length)return mockEnd();
  const f=favs();if(!MKSET.co&&f.length)MKSET.co=f[0];
  $("#head").innerHTML=`<h1>모의 면접</h1><p class="meta" style="margin:0">지원할 회사를 고르면 그 회사 소식과 기본 정보, 이슈로 면접 질문이 연달아 나와요. 시간 안에 말하듯 적고, 끝나면 답변 뼈대와 한꺼번에 비교해요.</p>`;
  const opt=(arr,key,lab)=>`<div class="mk-row"><span class="mk-l">${lab}</span><div class="mk-opts">${arr.map(([v,t])=>`<button data-mk="${key}" data-v="${esc(v)}" class="${String(MKSET[key])===String(v)?"on":""}">${t}</button>`).join("")}</div></div>`;
  const cos=[...f,...COMPANIES.map(c=>c.name).filter(n=>!f.includes(n))];
  const hist=(load("mock").list||[]);
  $("#main").innerHTML=`<section class="step mk-set"><div class="sh"><h2>면접 준비</h2></div>
    <div class="mk-row"><span class="mk-l">지원 회사</span><select id="mkCo" aria-label="지원 회사"><option value="">업계 전반 (회사 없이)</option>${cos.map(n=>`<option value="${esc(n)}"${n===MKSET.co?" selected":""}>${f.includes(n)?"★ ":""}${esc(n)}</option>`).join("")}</select></div>
    ${opt([[3,"3개"],[5,"5개"],[7,"7개"]],"n","질문 수")}${opt([[60,"1분"],[120,"2분"],[180,"3분"],[0,"제한 없음"]],"sec","답변 시간")}
    <p class="small" id="mkInfo" style="margin:0"></p>
    <div class="row"><button class="pri mk-go" id="mkGo">면접 시작하기</button></div></section>
    ${hist.length?`<section class="step"><div class="sh"><h2>지난 모의 면접</h2><span class="small">${hist.length}번</span></div><ul class="links">${hist.slice().reverse().map((x,i)=>`<li><a href="#" data-mh="${hist.length-1-i}">${fmtDate(x.date)} · ${esc(x.co||"업계 전반")} · 질문 ${x.qs.length}개</a><span class="small">${x.qs.filter((q,k)=>(x.a[k]||"").trim()).length}개 답함</span></li>`).join("")}</ul></section>`:""}`;
  const info=()=>{const pool=mockPool(MKSET.co);$("#mkInfo").textContent=`${MKSET.co||"업계 전반"} 질문 후보 ${pool.length}개 가운데 ${Math.min(MKSET.n,pool.length)}개를 골라요.${MKSET.co&&!PROFILES[MKSET.co]?" 이 회사 기본 정보가 아직 채워지는 중이라 질문이 적을 수 있어요.":""}`};info();
  $("#mkCo").onchange=e=>{MKSET.co=e.target.value;info()};
  document.querySelectorAll("[data-mk]").forEach(b=>b.onclick=()=>{MKSET[b.dataset.mk]=+b.dataset.v;showMock()});
  $("#mkGo").onclick=()=>{const qs=mockPick(mockPool(MKSET.co),MKSET.n);if(!qs.length)return alertBox("질문을 만들 자료가 아직 없어요.");MK={co:MKSET.co,sec:MKSET.sec,qs,a:[],i:0,date:ymd(Date.now())};showMock()};
  document.querySelectorAll("[data-mh]").forEach(a=>a.onclick=e=>{e.preventDefault();const x=hist[+a.dataset.mh];MK={...x,i:x.qs.length,old:true};showMock()});
}
let mkTimer=null;
function mockQ(){
  clearInterval(mkTimer);const q=MK.qs[MK.i],c=MK.co&&COMPANIES.find(x=>x.name===MK.co);
  $("#head").innerHTML=`<div class="mk-top"${c?` style="${coVars(c)}"`:""}><span class="mk-co">${c?coMono(c):""}${esc(MK.co||"업계 전반")} 모의 면접</span><span class="mk-prog">${MK.i+1} / ${MK.qs.length}</span></div><div class="mk-bar"><i style="width:${MK.i/MK.qs.length*100}%"></i></div>`;
  $("#main").innerHTML=`<section class="step mk-q"><span class="mk-kind">${esc(q.kind)}</span><p class="mk-text">${esc(q.q)}</p>
    ${MK.sec?`<div class="mk-time"><div class="mk-tb"><i id="mkT"></i></div><span id="mkS"></span></div>`:""}
    <textarea id="mkA" placeholder="면접관 앞에서 말하듯 적어보세요. 결론부터, 근거는 숫자로.">${esc(MK.a[MK.i]||"")}</textarea>
    <div class="row mk-btns"><button id="mkSkip">건너뛰기</button><button class="pri" id="mkNext">${MK.i===MK.qs.length-1?"면접 끝내기":"다음 질문"}</button></div></section>
    <p class="small"><a href="#" id="mkQuit">그만두기</a> · 답은 끝난 뒤 답변 뼈대와 함께 다시 볼 수 있어요.</p>`;
  const ta=$("#mkA");ta.focus();
  if(MK.sec){let left=MK.sec;const T=$("#mkT"),S=$("#mkS");const tick=()=>{if(!document.body.contains(T)){clearInterval(mkTimer);return}T.style.width=(left/MK.sec*100)+"%";S.textContent=left>0?`${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`:"시간 끝! 마무리하고 넘어가요";T.parentNode.classList.toggle("low",left<=15);S.classList.toggle("low",left<=15);if(left<=0)clearInterval(mkTimer);left--};tick();mkTimer=setInterval(tick,1000)}
  const go=skip=>{clearInterval(mkTimer);MK.a[MK.i]=skip?"":ta.value;MK.i++;window.scrollTo(0,0);showMock()};
  $("#mkNext").onclick=()=>go(false);$("#mkSkip").onclick=()=>go(true);
  $("#mkQuit").onclick=e=>{e.preventDefault();clearInterval(mkTimer);MK=null;showMock()};
}
function mockEnd(){
  clearInterval(mkTimer);
  if(!MK.old){const h=load("mock");h.list=(h.list||[]).concat([{co:MK.co,date:MK.date,qs:MK.qs,a:MK.a}]).slice(-20);save("mock",h);MK.old=true}
  const answered=MK.qs.filter((q,k)=>(MK.a[k]||"").trim()).length;
  $("#head").innerHTML=`<h1>모의 면접 돌아보기</h1><p class="meta" style="margin:0">${esc(MK.co||"업계 전반")} · ${fmtDate(MK.date)} · ${MK.qs.length}개 중 ${answered}개 답함</p>`;
  $("#main").innerHTML=MK.qs.map((q,k)=>`<section class="step mk-rv"><div class="sh"><span class="n">${String(k+1).padStart(2,"0")}</span><h2>${esc(q.kind)}</h2></div><p class="q" style="margin:0">${esc(q.q)}</p>
    <div class="mk-mine"><span>내 답</span><p>${(MK.a[k]||"").trim()?esc(MK.a[k]):'<em>건너뛴 질문이에요</em>'}</p></div>
    <div class="reveal"><strong>답변 뼈대</strong>\n${esc(q.guide)}</div>
    <p class="small" style="margin:0">결론부터 말했는지, 숫자 근거가 있는지, 내 직무와 회사로 이어졌는지 비교해보세요.${q.link?` <a href="${q.link}">관련 이슈 보기 →</a>`:""}</p></section>`).join("")+
    `<div class="row"><button class="pri" id="mkAgain">같은 회사로 다시 보기</button><button id="mkHome">처음으로</button></div>`;
  $("#mkAgain").onclick=()=>{MKSET.co=MK.co||"";const qs=mockPick(mockPool(MKSET.co),MKSET.n);MK={co:MKSET.co,sec:MKSET.sec,qs,a:[],i:0,date:ymd(Date.now())};window.scrollTo(0,0);showMock()};
  $("#mkHome").onclick=()=>{MK=null;window.scrollTo(0,0);showMock()};
}

/* 찾기 */
const SQ={q:"",tag:"",job:""};
function showSearch(){
  $("#head").innerHTML=brand()+`<h1>지난 이슈 찾기</h1>`;
  const tags=[...new Set(issues.map(i=>i.tag).filter(Boolean))];
  $("#main").innerHTML=`<input type="search" id="sq" placeholder="제목, 내용, 용어로 찾기" aria-label="이슈 찾기" value="${esc(SQ.q)}">
    <div class="chips" role="group" aria-label="분야"><span class="small">분야</span>${["",...tags].map(t=>`<button data-st="${esc(t)}" class="${t===SQ.tag?"on":""}">${t||"전체"}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="영역"><span class="small">영역</span>${["",...JOBS].map(j=>`<button data-sj="${esc(j)}" class="${j===SQ.job?"on":""}">${j||"전체"}</button>`).join("")}</div>
    <p class="small" id="scount" style="margin:0"></p><div id="sres" class="cards"></div>`;
  const render=()=>{const q=SQ.q.trim();
    const list=issues.filter(it=>(!SQ.tag||it.tag===SQ.tag)&&(!SQ.job||(it.jobs||[]).includes(SQ.job))&&(!q||[it.title,it.tag,...(it.points||[]),it.why,...(it.terms||[]).map(x=>x.t)].join(" ").replace(/\*\*/g,"").includes(q)));
    $("#scount").textContent=`${list.length}개 이슈`;
    $("#sres").innerHTML=list.length?list.map(it=>`<div class="card"><div class="top"><span class="tag">${esc(it.tag||"")}</span><span class="stat">${shortDate(it.date)}${status(it)==="done"?' · <span class="ok">완료</span>':""}</span></div><div class="ttl"><a href="#i-${esc(it.id)}">${esc(it.title)}</a></div></div>`).join(""):`<p class="empty">조건에 맞는 이슈가 없어요.</p>`};
  $("#sq").oninput=e=>{SQ.q=e.target.value;render()};
  document.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{SQ.tag=b.dataset.st;showSearch()});
  document.querySelectorAll("[data-sj]").forEach(b=>b.onclick=()=>{SQ.job=b.dataset.sj;showSearch()});
  render();
}

window.App={rerender:()=>route(),authChanged(){renderShell();if(location.hash==="#league")return showLeague();if(location.hash==="#me"){const box=$("#account");if(box){box.innerHTML=accountHTML();wireAccount()}}}};
track();route();afterRender();
