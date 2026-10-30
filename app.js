const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let issues=[],cur=null;
function load(k){try{return JSON.parse(localStorage.getItem("bi:"+k))||{}}catch(e){return{}}}
function save(k,v){try{localStorage.setItem("bi:"+k,JSON.stringify(v))}catch(e){}}
function fmtDate(d){const [y,m,dd]=d.split("-");return `${+y}년 ${+m}월 ${+dd}일`}

function renderPicker(){
  $("#pick").innerHTML=issues.map(i=>`<option value="${esc(i.date)}">${fmtDate(i.date)}</option>`).join("");
  if(cur)$("#pick").value=cur.date;
}
$("#pick").onchange=e=>{const i=issues.find(x=>x.date===e.target.value);if(i){show(i);location.hash=i.date}};

function show(it){
  cur=it;const st=load(it.date);
  $("#head").innerHTML=`<span class="tag">${esc(it.tag||"보험 이슈")}</span><h1>${esc(it.title)}</h1><div class="meta">${fmtDate(it.date)} · 약 10분</div>`;
  let h="";let n=0;const N=()=>String(++n).padStart(2,"0");
  if(it.predict)h+=`<section class="step predict"><div class="sh"><span class="n">${N()}</span><h2>읽기 전에 예측하기</h2></div>
    <p class="q">${esc(it.predict.q)}</p><div class="row" id="pOpts">${it.predict.options.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="pOut"></div></section>`;
  if(it.gauge)h+=`<section class="step"><div class="sh"><span class="n">${N()}</span><h2>숫자 감각 잡기</h2></div>
    <p class="q">${esc(it.gauge.q)}</p>
    <label class="small" for="gR">${esc(it.gauge.label)} <b id="gV" style="font-family:var(--f-num)"></b></label>
    <input type="range" id="gR" min="${it.gauge.min}" max="${it.gauge.max}" step="1" value="${it.gauge.value}">
    <div class="gauge"><div><span>보험금으로 나감</span><em id="g1"></em></div><div><span>운영비 (가정)</span><em>${it.gauge.cost}원</em></div><div><span>보험사에 남는 돈</span><em id="g3"></em></div></div>
    <p class="small" id="gN"></p></section>`;
  if(it.chain)h+=`<section class="step"><div class="sh"><span class="n">${N()}</span><h2>인과 사슬 따라가기</h2></div>
    <p class="q">다음 고리를 보기 전에 무엇이 올지 먼저 떠올려보세요.</p><div class="chain" id="chain"></div><div><button id="cBtn">다음 고리 보기</button></div></section>`;
  if(it.role)h+=`<section class="step"><div class="sh"><span class="n">${N()}</span><h2>내가 담당자라면</h2></div>
    <p class="q">${esc(it.role.q)}</p><textarea id="rT" placeholder="생각나는 대로 적어보세요">${esc(st.role||"")}</textarea><div class="err" id="rE"></div>
    <div class="row"><button class="pri" id="rM">모범 해설과 비교하기</button></div><div id="rO"></div></section>`;
  h+=`<section class="step"><div class="sh"><span class="n">${N()}</span><h2>내 말로 한 줄 요약</h2></div>
    <p class="q">보험을 모르는 친구에게 이 이슈를 한 줄로 설명한다면?</p><textarea id="sT" placeholder="친구한테 말하듯이 한 줄로" style="min-height:64px">${esc(st.sum||"")}</textarea><div class="err" id="sE"></div>
    <div class="row"><button class="pri" id="sM">예시 요약과 비교하기</button></div><div id="sO"></div></section>`;
  const qs=(it.quiz||[]).map(q=>({...q,from:null}));
  const older=issues.filter(x=>x.date<it.date&&x.quiz&&x.quiz.length);
  const rev=older.slice(0,3).map(x=>({...x.quiz[Math.floor(Math.random()*x.quiz.length)],from:x.date}));
  const all=[...qs,...rev];
  if(all.length)h+=`<section class="step"><div class="sh"><span class="n">${N()}</span><h2>확인 퀴즈${rev.length?" · 지난 이슈 복습 포함":""}</h2></div>
    ${all.map((q,i)=>`<div><p class="q" style="font-size:16px">${q.from?`<span class="small">${fmtDate(q.from)} 복습 · </span>`:""}${esc(q.q)}</p><div class="row" data-q="${i}">${q.o.map((o,j)=>`<button data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="qO${i}"></div></div>`).join("")}
    ${!rev.length?`<p class="small">이슈가 쌓이면 며칠 전 이슈 문제가 여기 섞여서 나와요.</p>`:""}</section>`;
  if(it.sources)h+=`<section class="src small">원문 기사: ${it.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(" · ")}<br>이 페이지의 해설은 원문을 바탕으로 새로 쓴 학습용 정리예요.</section>`;
  $("#main").innerHTML=h;renderPicker();wire(it,st,all);window.scrollTo(0,0);
}

function needText(tId,eId){if(!$(tId).value.trim()){$(eId).textContent="먼저 내 답을 적어보세요";return false}return true}

function wire(it,st,all){
  const P=$("#pOpts");
  const pReveal=j=>{P.querySelectorAll("button").forEach(b=>b.classList.toggle("picked",+b.dataset.j===j));
    const right=j===it.predict.answer;$("#pOut").innerHTML=`<div class="reveal"><span class="${right?"ok":"no"}">${right?"예측이 맞았어요. ":"예측과 달라요. "}</span>${esc(it.predict.reveal)}</div>`};
  if(P){P.onclick=e=>{const b=e.target.closest("button");if(!b)return;st.pred=+b.dataset.j;save(it.date,st);pReveal(st.pred)};if(st.pred!=null)pReveal(st.pred)}
  if(it.gauge){const g=it.gauge,r=$("#gR");const f=()=>{const v=+r.value,left=100-v-g.cost;$("#gV").textContent=v+"%";$("#g1").textContent=v+"원";
      const e=$("#g3");e.textContent=(left>0?"+":"")+left+"원";e.style.color=left<0?"var(--bad)":"var(--good)";
      $("#gN").textContent=`보험료 100원 기준이에요. ${g.label}과 운영비 비율을 더한 합산비율은 지금 ${v+g.cost}%이고, 100%를 넘으면 보험 영업만으로는 적자예요. ${g.note||""}`};r.oninput=f;f()}
  if(it.chain){let i=0;const B=$("#cBtn"),C=$("#chain");B.onclick=()=>{if(i>=it.chain.length)return;const d=document.createElement("div");d.className="link";d.textContent=it.chain[i++];C.appendChild(d);if(i>=it.chain.length){B.textContent="끝까지 왔어요";B.disabled=true}}}
  const persist=(id,key,eid)=>{const t=$(id);if(t)t.oninput=()=>{st[key]=t.value;save(it.date,st);$(eid).textContent=""}};
  persist("#rT","role","#rE");persist("#sT","sum","#sE");
  const check=`<p class="small" style="margin:8px 0 0">스스로 점검해보세요. 이 현상이 일시적인지 구조적인지 짚었나요? 무엇과 비교한 숫자인지 따져봤나요? 한 시점이 아니라 추세를 봤나요?</p>`;
  if(it.role)$("#rM").onclick=()=>{if(!needText("#rT","#rE"))return;$("#rO").innerHTML=`<div class="reveal"><strong>모범 해설</strong>\n${esc(it.role.model)}</div>${check}`};
  $("#sM").onclick=()=>{if(!needText("#sT","#sE"))return;$("#sO").innerHTML=`<div class="reveal"><strong>예시 요약</strong>\n${esc(it.summary||"예시 요약이 아직 없어요.")}</div><p class="small" style="margin:8px 0 0">내 요약에 핵심 숫자나 원인이 빠지진 않았는지, 보험을 모르는 사람도 알아들을 말인지 비교해보세요.</p>`};
  document.querySelectorAll("[data-q]").forEach(row=>{row.onclick=e=>{const b=e.target.closest("button");if(!b)return;const i=+row.dataset.q,q=all[i],j=+b.dataset.j;
    row.querySelectorAll("button").forEach(x=>x.classList.toggle("picked",x===b));
    $("#qO"+i).innerHTML=`<div class="reveal"><span class="${j===q.a?"ok":"no"}">${j===q.a?"정답이에요. ":"아쉬워요. 정답은 "+esc(q.o[q.a])+". "}</span>${esc(q.e)}</div>`}});
}

issues=(window.ISSUES||[]).slice().sort((a,b)=>a.date<b.date?1:-1);
if(!issues.length){$("#head").innerHTML=`<p class="empty">첫 이슈가 아직 올라오지 않았어요.</p>`}
else{const h=decodeURIComponent(location.hash.slice(1));show(issues.find(i=>i.date===h)||issues[0])}
