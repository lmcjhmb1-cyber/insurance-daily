const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function load(k){try{return JSON.parse(localStorage.getItem("bi:"+k))||{}}catch(e){return{}}}
function save(k,v){v.t=Date.now();try{localStorage.setItem("bi:"+k,JSON.stringify(v))}catch(e){}if(window.Sync)window.Sync.push(k,v)}
function fmtDate(d){const [y,m,dd]=d.split("-");return `${+y}년 ${+m}월 ${+dd}일`}
function shortDate(d){const [,m,dd]=d.split("-");return `${+m}월 ${+dd}일`}
const MODE={light:{label:"가볍게",time:"약 5분",desc:"예측, 핵심 정리, 퀴즈"},deep:{label:"깊게",time:"약 15분",desc:"인과 사슬, 담당자 질문, 요약까지"}};

const issues=(window.ISSUES||[]).map((x,i)=>({id:x.date+"-"+(i+1),...x}));
const dates=[...new Set(issues.map(i=>i.date))].sort().reverse();
const byDate=d=>issues.filter(i=>i.date===d).sort((a,b)=>a.id<b.id?-1:1);
const lightQuiz=it=>(it.quiz||[]).map((q,k)=>({...q,k})).filter(q=>!q.deep);
function status(it){const s=load(it.id);if(s.done)return"done";if(s.pred!=null||(s.qa&&Object.keys(s.qa).length)||s.role||s.sum)return"doing";return""}

function route(){
  const h=decodeURIComponent(location.hash.slice(1));
  if(!issues.length){$("#head").innerHTML=brand()+`<p class="empty">첫 이슈가 아직 올라오지 않았어요.</p>`;$("#main").innerHTML="";return}
  if(h==="me")return showMe();
  if(h.startsWith("i-")){
    let rest=h.slice(2),mode=null;
    for(const m of ["light","deep"])if(rest.endsWith("-"+m)){mode=m;rest=rest.slice(0,-m.length-1)}
    const it=issues.find(i=>i.id===rest);
    if(it){const st=load(it.id);if(mode&&st.mode!==mode){st.mode=mode;save(it.id,st)}return showIssue(it,mode||st.mode||"light")}
  }
  const d=h.startsWith("d-")&&dates.includes(h.slice(2))?h.slice(2):dates[0];
  showList(d);
}
window.addEventListener("hashchange",()=>{route();window.scrollTo(0,0)});

function brand(){const on=location.hash==="#me";return `<div class="brand"><a class="home" href="#">오늘의 보험 이슈</a><a class="melink${on?" on":""}" href="#me">${meLabel()}</a></div>`}
function meLabel(){const u=window.Auth&&window.Auth.user;return u?`<span class="dot" aria-hidden="true"></span>마이페이지`:"마이페이지"}
function modeLinks(it,cur){return `<div class="modes">${["light","deep"].map(m=>`<a href="#i-${esc(it.id)}-${m}" class="${m}${cur===m?" on":""}">${MODE[m].label} · ${MODE[m].time}<span>${MODE[m].desc}</span></a>`).join("")}</div>`}

let calMonth=null;
function ymd(ts){const d=new Date(ts);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function doneByDay(){const m={};for(const it of issues){const s=load(it.id);if(!s.done)continue;const ts=s.doneAt||s.t;if(!ts)continue;const k=ymd(ts);m[k]=(m[k]||0)+1}return m}
function streak(m){let n=0;const d=new Date();if(!m[ymd(d)])d.setDate(d.getDate()-1);while(m[ymd(d)]){n++;d.setDate(d.getDate()-1)}return n}
function renderCal(sel){
  const box=$("#cal");if(!box)return;
  const m=doneByDay();const [y,mo]=calMonth.split("-").map(Number);
  const first=new Date(y,mo-1,1).getDay(),days=new Date(y,mo,0).getDate(),today=ymd(Date.now()),pub=new Set(dates);
  let cells="",total=0;
  for(let i=0;i<first;i++)cells+=`<span class="cd blank" aria-hidden="true"></span>`;
  for(let d=1;d<=days;d++){
    const k=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`,c=m[k]||0;total+=c;
    const lv=c===0?0:c===1?1:c<=3?2:c<=5?3:4;
    const cls=`cd lv${lv}${k===today?" today":""}${k===sel?" sel":""}`;
    const inner=`<b>${d}</b><i>${c?c+"개":""}</i>${pub.has(k)?`<u aria-hidden="true"></u>`:""}`;
    const label=`${mo}월 ${d}일, ${c}개 완료${pub.has(k)?", 이슈 보기":""}`;
    cells+=pub.has(k)?`<a class="${cls}" href="#d-${k}" aria-label="${label}" title="${label}">${inner}</a>`:`<span class="${cls}" title="${label}">${inner}</span>`;
  }
  const wk=["일","월","화","수","목","금","토"].map(w=>`<span class="wk">${w}</span>`).join("");
  box.innerHTML=`<div class="calhead"><button id="calPrev" aria-label="이전 달">‹</button><b>${y}년 ${mo}월</b><button id="calNext" aria-label="다음 달">›</button></div>
    <div class="calgrid">${wk}${cells}</div>
    <div class="calfoot"><span>${mo}월에 <b>${total}개</b> 완료 · 연속 <b>${streak(m)}일</b></span><span class="legend">적음<i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i>많음</span></div>
    <p class="small" style="margin:0">숫자는 그날 내가 끝낸 이슈 개수예요. 점이 찍힌 날은 이슈가 올라온 날이라, 누르면 그날 이슈 목록으로 가요.</p>`;
  const shift=n=>{const dt=new Date(y,mo-1+n,1);calMonth=dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0");renderCal(sel)};
  $("#calPrev").onclick=()=>shift(-1);$("#calNext").onclick=()=>shift(1);
}

const NOTICE=`<details class="notice"><summary>무엇을 저장하나요?</summary><ul>
  <li><b>저장하는 것:</b> 구글 계정의 고유 번호와 학습 기록(예측 답, 퀴즈 답, 완료 여부와 시각, 고른 방식, 직접 쓴 답)이에요. 로그인할 때 구글이 알려주는 이름과 이메일은 로그인 정보로만 남고, 학습 기록에는 넣지 않아요.</li>
  <li><b>목적:</b> 다른 기기에서 들어와도 공부한 기록을 이어 보기 위해서예요. 다른 용도로는 쓰지 않아요.</li>
  <li><b>보관 위치:</b> 서울에 있는 구글 서버(파이어베이스)예요. 다른 사용자는 내 기록을 볼 수 없어요.</li>
  <li><b>알아둘 점:</b> 사이트 운영자는 관리 화면에서 로그인한 사람의 이메일과 저장된 기록을 볼 수 있어요. 직접 쓰는 답에는 개인적인 내용을 적지 마세요.</li>
  <li><b>지우는 법:</b> 로그인한 뒤 "내 기록 지우기"를 누르면 저장된 기록과 로그인 정보가 모두 지워져요.</li></ul></details>`;

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
function longest(m){const ks=Object.keys(m).sort();let best=0,cur=0,prev=null;for(const k of ks){const d=new Date(k+"T00:00:00");if(prev&&(d-prev)/864e5===1)cur++;else cur=1;best=Math.max(best,cur);prev=d}return best}

function showMe(){
  $("#head").innerHTML=brand()+`<a class="back" href="#">← 오늘의 이슈로</a><h1>마이페이지</h1>`;
  let done=0,qN=0,qOK=0;const tags={},wrong=[],doing=[],notes=[];
  for(const it of issues){const s=load(it.id);const tag=it.tag||"보험 이슈";const T=tags[tag]||(tags[tag]={done:0,all:0,qN:0,qOK:0});T.all++;
    if(s.done){done++;T.done++}else if(status(it)==="doing")doing.push(it);
    for(const [k,j] of Object.entries(s.qa||{})){const q=(it.quiz||[])[k];if(!q)continue;qN++;T.qN++;if(+j===q.a){qOK++;T.qOK++}else wrong.push({it,q,j:+j,t:s.t||0})}
    if(s.role&&s.role.trim()&&it.role)notes.push({it,kind:"내가 담당자라면",q:it.role.q,a:s.role,t:s.t||0});
    if(s.sum&&s.sum.trim())notes.push({it,kind:"한 줄 요약",q:"보험을 모르는 친구에게 한 줄로 설명한다면?",a:s.sum,t:s.t||0});}
  const m=doneByDay();const pct=qN?Math.round(qOK/qN*100):null;
  const stat=(label,val,sub)=>`<div class="stat"><span>${label}</span><b>${val}</b>${sub?`<em>${sub}</em>`:""}</div>`;
  let h=`<section class="step"><div class="sh"><h2>내 계정</h2></div><div id="account">${accountHTML()}</div></section>
  <div class="stats">${stat("끝낸 이슈",done+"개",`올라온 이슈 ${issues.length}개 중`)}${stat("연속 학습",streak(m)+"일","오늘이나 어제까지 이어진 날")}${stat("최장 연속",longest(m)+"일","지금까지 가장 길게 이어간 기록")}${stat("퀴즈 정답률",pct==null?"–":pct+"%",qN?`${qN}문제 중 ${qOK}문제 정답`:"아직 푼 퀴즈가 없어요")}</div>
  <section class="cal" id="cal" aria-label="학습 달력"></section>`;
  if(doing.length)h+=`<section class="step"><div class="sh"><h2>이어서 풀기</h2></div><ul class="links">${doing.map(it=>`<li><a href="#i-${esc(it.id)}">${esc(it.title)}</a><span class="small">${shortDate(it.date)} · ${esc(it.tag||"")}</span></li>`).join("")}</ul></section>`;
  h+=`<section class="step"><div class="sh"><h2>오답 노트</h2><span class="small">${wrong.length}문제</span></div>${wrong.length?wrong.sort((x,y)=>y.t-x.t).map(w=>`<div class="wn"><p class="small" style="margin:0">${shortDate(w.it.date)} · ${esc(w.it.tag||"")}</p><p class="q" style="font-size:16px">${esc(w.q.q)}</p>
    <p class="mine"><span class="no">내 답</span> ${esc(w.q.o[w.j])}</p><p class="right"><span class="ok">정답</span> ${esc(w.q.o[w.q.a])}</p><p class="small" style="margin:0">${esc(w.q.e)}</p><a class="more" href="#i-${esc(w.it.id)}">이슈 다시 보기 →</a></div>`).join(""):`<p class="small" style="margin:0">틀린 문제가 생기면 여기에 모여요. 해설과 함께 다시 보면 오래 기억에 남아요.</p>`}</section>`;
  const tagRows=Object.entries(tags).filter(([,T])=>T.done||T.qN).sort((x,y)=>y[1].done-x[1].done);
  h+=`<section class="step"><div class="sh"><h2>분야별 기록</h2></div>${tagRows.length?`<div class="tags">${tagRows.map(([tag,T])=>{const p=T.qN?Math.round(T.qOK/T.qN*100):0;return `<div class="tg"><div class="tgh"><b>${esc(tag)}</b><span>${T.done}/${T.all}개 끝냄 · 정답률 ${T.qN?p+"%":"–"}</span></div><div class="bar"><i style="width:${T.all?T.done/T.all*100:0}%"></i></div></div>`}).join("")}</div><p class="small" style="margin:0">막대는 그 분야에 올라온 이슈 중 끝낸 비율이에요. 정답률이 낮은 분야부터 다시 보면 좋아요.</p>`:`<p class="small" style="margin:0">이슈를 풀기 시작하면 분야마다 얼마나 공부했는지 보여줘요.</p>`}</section>`;
  h+=`<section class="step"><div class="sh"><h2>내가 쓴 답</h2><span class="small">${notes.length}개</span></div>${notes.length?notes.sort((x,y)=>y.t-x.t).map(n=>`<details class="note"><summary><span class="small">${shortDate(n.it.date)} · ${n.kind}</span><br>${esc(n.it.title)}</summary><p class="small" style="margin:8px 0 4px">${esc(n.q)}</p><p class="ans">${esc(n.a)}</p><a class="more" href="#i-${esc(n.it.id)}-deep">이슈에서 모범 해설과 비교하기 →</a></details>`).join(""):`<p class="small" style="margin:0">깊게 보기에서 담당자 질문이나 한 줄 요약에 답을 쓰면 여기에 모여요. 나중에 다시 읽으면 생각이 얼마나 자랐는지 보여요.</p>`}</section>`;
  $("#main").innerHTML=h;
  if(!calMonth)calMonth=ymd(Date.now()).slice(0,7);
  renderCal(null);wireAccount();
}

function showList(d){
  const list=byDate(d);const done=list.filter(i=>status(i)==="done").length;
  const sel=`<select id="pick" aria-label="날짜 고르기">${dates.map(x=>`<option value="${x}"${x===d?" selected":""}>${fmtDate(x)}</option>`).join("")}</select>`;
  const sk=streak(doneByDay());
  $("#head").innerHTML=brand()+`<div class="daterow">${sel}<a class="chip" href="#me">${sk?`연속 ${sk}일째 공부 중`:"내 기록 보기"} →</a></div><h1>${fmtDate(d)}의 이슈 ${list.length}개</h1>
    <div class="prog"><div class="bar"><i style="width:${list.length?done/list.length*100:0}%"></i></div><span>${list.length}개 중 ${done}개 완료</span></div>`;
  $("#pick").onchange=e=>{location.hash="d-"+e.target.value};
  $("#main").innerHTML=`<div class="cards">${list.map(it=>{const s=status(it),st=load(it.id);
    const stat=s==="done"?`완료${st.doneMode?" · "+MODE[st.doneMode].label:""}`:s==="doing"?"진행 중":"";
    return `<div class="card">
      <div class="top"><span class="tag">${esc(it.tag||"보험 이슈")}</span><span class="stat ${s==="done"?"done":""}">${stat}</span></div>
      <div class="ttl"><a href="#i-${esc(it.id)}">${esc(it.title)}</a></div>
      ${modeLinks(it,st.mode)}</div>`}).join("")}</div>
    <p class="small">이슈마다 가볍게 볼지 깊게 볼지 골라서 들어가세요. 보는 중에도 위에서 바꿀 수 있어요. 퀴즈를 모두 풀면 완료로 표시돼요. 로그인하면 기록이 계정에 저장되고, 로그인하지 않으면 이 기기에만 남아요.</p>`;
}

function showIssue(it,mode){
  const st=load(it.id);const deep=mode==="deep";
  $("#head").innerHTML=brand()+`<a class="back" href="#d-${it.date}">← ${shortDate(it.date)} 이슈 목록</a>
    <span class="tag">${esc(it.tag||"보험 이슈")}</span><h1>${esc(it.title)}</h1><div class="meta">${fmtDate(it.date)}</div>${modeLinks(it,mode)}`;
  let h="";let n=0;const N=()=>String(++n).padStart(2,"0");
  const sec=(title,body,cls)=>`<section class="step${cls?" "+cls:""}"><div class="sh"><span class="n">${N()}</span><h2>${title}</h2></div>${body}</section>`;
  if(it.predict)h+=sec("읽기 전에 예측하기",`<p class="q">${esc(it.predict.q)}</p><div class="row" id="pOpts">${it.predict.options.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="pOut"></div>`,"predict");
  if(it.gauge)h+=sec("숫자 감각 잡기",`<p class="q">${esc(it.gauge.q)}</p>
    <label class="small" for="gR">${esc(it.gauge.label)} <b id="gV" style="font-family:var(--f-num)"></b></label>
    <input type="range" id="gR" min="${it.gauge.min}" max="${it.gauge.max}" step="1" value="${it.gauge.value}">
    <div class="gauge"><div><span>보험금으로 나감</span><em id="g1"></em></div><div><span>운영비 (가정)</span><em>${it.gauge.cost}원</em></div><div><span>보험사에 남는 돈</span><em id="g3"></em></div></div>
    <p class="small" id="gN"></p>`);
  if(it.numbers)h+=sec("숫자 감각 잡기",`<div class="nums">${it.numbers.map(x=>`<div><b>${esc(x.label)}</b><em>${esc(x.value)}</em>${x.note?`<span>${esc(x.note)}</span>`:""}</div>`).join("")}</div>`);
  if(it.points)h+=sec("핵심 정리",`<ul class="points">${it.points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`);
  if(deep&&it.chain)h+=sec("인과 사슬 따라가기",`<p class="q">다음 고리를 보기 전에 무엇이 올지 먼저 떠올려보세요.</p><div class="chain" id="chain"></div><div><button id="cBtn">다음 고리 보기</button></div>`);
  if(it.why)h+=sec("왜 중요할까",`<p style="margin:0;font-size:15.5px">${esc(it.why)}</p>`);
  if(deep&&it.role)h+=sec("내가 담당자라면",`<p class="q">${esc(it.role.q)}</p><textarea id="rT" placeholder="생각나는 대로 적어보세요">${esc(st.role||"")}</textarea><div class="err" id="rE"></div>
    <div class="row"><button class="pri" id="rM">모범 해설과 비교하기</button></div><div id="rO"></div>`);
  if(deep&&it.summary)h+=sec("내 말로 한 줄 요약",`<p class="q">보험을 모르는 친구에게 이 이슈를 한 줄로 설명한다면?</p><textarea id="sT" placeholder="친구한테 말하듯이 한 줄로" style="min-height:64px">${esc(st.sum||"")}</textarea><div class="err" id="sE"></div>
    <div class="row"><button class="pri" id="sM">예시 요약과 비교하기</button></div><div id="sO"></div>`);
  const own=(deep?(it.quiz||[]).map((q,k)=>({...q,k})):lightQuiz(it)).map(q=>({...q,from:null}));
  const rev=[];
  if(deep){const pool=issues.filter(x=>x.date<it.date&&x.quiz&&x.quiz.length);
    while(rev.length<2&&pool.length){const x=pool.splice(Math.floor(Math.random()*pool.length),1)[0];rev.push({...x.quiz[Math.floor(Math.random()*x.quiz.length)],from:x.date,k:null})}}
  const all=[...own,...rev];
  if(all.length)h+=sec(`확인 퀴즈${rev.length?" · 지난 이슈 복습 포함":""}`,
    all.map((q,i)=>`<div><p class="q" style="font-size:16px">${q.from?`<span class="small">${shortDate(q.from)} 복습 · </span>`:""}${esc(q.q)}</p><div class="row" data-q="${i}">${q.o.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="qO${i}"></div></div>`).join(""));
  if(!deep&&(it.chain||it.role))h+=`<p class="small" style="margin:0">더 파고들고 싶으면 위에서 <a href="#i-${esc(it.id)}-deep" style="color:var(--accent)">깊게 보기</a>로 바꿔보세요. 인과 사슬과 담당자 질문이 더해져요.</p>`;
  if(it.sources)h+=`<section class="src small">원문 기사: ${it.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(" · ")}<br>이 페이지의 해설은 원문을 바탕으로 새로 쓴 학습용 정리예요.</section>`;
  const sib=byDate(it.date);const k=sib.findIndex(x=>x.id===it.id);const nx=sib[k+1];
  h+=`<nav class="next"><a href="#d-${it.date}">← 목록으로</a>${nx?`<a href="#i-${esc(nx.id)}">다음 이슈: ${esc(nx.title.length>22?nx.title.slice(0,22)+"…":nx.title)} →</a>`:""}</nav>`;
  $("#main").innerHTML=h;wire(it,st,mode,all);
}

function needText(tId,eId){if(!$(tId).value.trim()){$(eId).textContent="먼저 내 답을 적어보세요";return false}return true}

function wire(it,st,mode,all){
  const P=$("#pOpts");
  const pReveal=j=>{P.querySelectorAll("button").forEach(b=>b.classList.toggle("picked",+b.dataset.j===j));
    const right=j===it.predict.answer;$("#pOut").innerHTML=`<div class="reveal"><span class="${right?"ok":"no"}">${right?"예측이 맞았어요. ":"예측과 달라요. "}</span>${esc(it.predict.reveal)}</div>`};
  if(P){P.onclick=e=>{const b=e.target.closest("button");if(!b)return;st.pred=+b.dataset.j;save(it.id,st);pReveal(st.pred)};if(st.pred!=null)pReveal(st.pred)}
  if(it.gauge){const g=it.gauge,r=$("#gR");const f=()=>{const v=+r.value,left=100-v-g.cost;$("#gV").textContent=v+"%";$("#g1").textContent=v+"원";
      const e=$("#g3");e.textContent=(left>0?"+":"")+left+"원";e.style.color=left<0?"var(--bad)":"var(--good)";
      $("#gN").textContent=`보험료 100원 기준이에요. ${g.label}과 운영비 비율을 더한 합산비율은 지금 ${v+g.cost}%이고, 100%를 넘으면 보험 영업만으로는 적자예요. ${g.note||""}`};r.oninput=f;f()}
  const B=$("#cBtn");if(B){let i=0;const C=$("#chain");B.onclick=()=>{if(i>=it.chain.length)return;const d=document.createElement("div");d.className="link";d.textContent=it.chain[i++];C.appendChild(d);if(i>=it.chain.length){B.textContent="끝까지 왔어요";B.disabled=true}}}
  const persist=(id,key,eid)=>{const t=$(id);if(t)t.oninput=()=>{st[key]=t.value;save(it.id,st);$(eid).textContent=""}};
  persist("#rT","role","#rE");persist("#sT","sum","#sE");
  const check=`<p class="small" style="margin:8px 0 0">스스로 점검해보세요. 일시적인 현상인지 구조적인 변화인지 짚었나요? 무엇과 비교한 숫자인지 따져봤나요? 한 시점이 아니라 추세를 봤나요?</p>`;
  if($("#rM"))$("#rM").onclick=()=>{if(!needText("#rT","#rE"))return;$("#rO").innerHTML=`<div class="reveal"><strong>모범 해설</strong>\n${esc(it.role.model)}</div>${check}`};
  if($("#sM"))$("#sM").onclick=()=>{if(!needText("#sT","#sE"))return;$("#sO").innerHTML=`<div class="reveal"><strong>예시 요약</strong>\n${esc(it.summary)}</div><p class="small" style="margin:8px 0 0">내 요약에 핵심 숫자나 원인이 빠지진 않았는지, 보험을 모르는 사람도 알아들을 말인지 비교해보세요.</p>`};
  st.qa=st.qa||{};
  const need=all.filter(q=>q.k!=null).map(q=>q.k);
  const answer=(i,j,row)=>{const q=all[i];row.querySelectorAll("button").forEach(x=>x.classList.toggle("picked",+x.dataset.j===j));
    $("#qO"+i).innerHTML=`<div class="reveal"><span class="${j===q.a?"ok":"no"}">${j===q.a?"정답이에요. ":"아쉬워요. 정답은 "+esc(q.o[q.a])+". "}</span>${esc(q.e)}</div>`};
  document.querySelectorAll("[data-q]").forEach(row=>{const i=+row.dataset.q,q=all[i];
    if(q.k!=null&&st.qa[q.k]!=null)answer(i,st.qa[q.k],row);
    row.onclick=e=>{const b=e.target.closest("button");if(!b)return;const j=+b.dataset.j;answer(i,j,row);
      if(q.k!=null){st.qa[q.k]=j;
        if(need.every(k=>st.qa[k]!=null)){if(!st.done)st.doneAt=Date.now();st.done=true;if(st.doneMode!=="deep")st.doneMode=mode}
        save(it.id,st)}}});
}

window.App={rerender:()=>route(),authChanged(){const l=document.querySelector(".melink");if(l)l.innerHTML=meLabel();if(location.hash==="#me"){const box=$("#account");if(box){box.innerHTML=accountHTML();wireAccount()}}}};
route();
