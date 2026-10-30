// 네컷만화를 그리는 파일이에요. 채소·과일·저금통 마스코트와 차분한 배경을 직접 그려요.
// 이슈의 comic 데이터: { title, panels:[ { caption, bg, sign, board, chars:[ { who, mood, pose, fx, say, bubble, name } ] } ] }
(function(){
const OL="#2B2B33";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* 등장인물: 이름, 무리, 색, 얼굴 위치, 어깨 위치, 머리 꼭대기 */
const CAST={
  potato:{name:"감자",group:"가입자",c:"#DDB077",d:"#B98A52",face:[0,-84],sh:[42,-66],top:-140},
  sweetpotato:{name:"고구마",group:"가입자",c:"#B9507F",d:"#8E365F",face:[0,-88],sh:[34,-70],top:-154},
  onion:{name:"양파",group:"가입자",c:"#EEDDF0",d:"#C9A6CF",face:[0,-64],sh:[44,-52],top:-140},
  carrot:{name:"당근이",group:"가입자",c:"#F28C28",d:"#C9681A",face:[0,-112],sh:[34,-96],top:-170},
  mango:{name:"망고",group:"계리사",c:"#FFB82E",d:"#E08E12",face:[0,-84],sh:[42,-66],top:-160,glasses:1},
  strawberry:{name:"딸기",group:"계리사",c:"#EC4A5A",d:"#C22F40",face:[0,-104],sh:[40,-90],top:-162,glasses:1},
  watermelon:{name:"수박이",group:"계리사",c:"#49B25E",d:"#2D8443",face:[0,-70],sh:[52,-58],top:-134,glasses:1},
  insurer:{name:"배불뚝이 보험사",group:"보험사",c:"#F7B6C2",d:"#DE8C9D",face:[0,-96],sh:[54,-66],top:-150},
  driver:{name:"운전자",group:"운전자",c:"#FFD54A",d:"#E0B21E",face:[0,-70],sh:[44,-56],top:-140},
  regulator:{name:"금융당국",group:"금융당국",c:"#B9B2A6",d:"#8F8779",face:[0,-94],sh:[46,-66],top:-150,glasses:1},
  doctor:{name:"의사",group:"의사",c:"#FFFFFF",d:"#C9CDD4",face:[0,-82],sh:[42,-62],top:-170},
  planner:{name:"설계사",group:"설계사",c:"#7FB3F0",d:"#4F86C6",face:[0,-82],sh:[42,-62],top:-140},
  fraudster:{name:"보험사기범",group:"보험사기범",c:"#9AA0AA",d:"#6E747E",face:[0,-82],sh:[42,-62],top:-150,mask:1}
};
const ALIAS={customer:"potato",customer2:"sweetpotato",actuary:"mango",fraud:"fraudster"};
const keyOf=w=>CAST[ALIAS[w]||w]?(ALIAS[w]||w):"potato";
const castOf=w=>CAST[keyOf(w)];
const label=c=>c.name.endsWith(c.group)?c.name:c.name+" "+c.group;

/* 배경: 시선을 뺏지 않게 연하고 단순하게 */
function bgSVG(bg,board){
  const W=320,H=300,line="#E3E6E2";
  const chart=(x,y,w,h,dir)=>{
    const pts=dir==="up"?[[0,.8],[.25,.65],[.5,.7],[.75,.35],[1,.15]]:dir==="down"?[[0,.2],[.25,.35],[.5,.3],[.75,.65],[1,.85]]:[[0,.5],[.25,.42],[.5,.58],[.75,.45],[1,.5]];
    const col=dir==="up"?"#10A37A":dir==="down"?"#E0483E":"#7B8190";
    const P=pts.map(([a,b])=>`${x+a*w},${y+b*h}`).join(" ");
    const ex=x+w,ey=y+pts[4][1]*h;
    const head=dir==="up"?`<path d="M${ex-10} ${ey} L${ex} ${ey} L${ex} ${ey+10}" />`:dir==="down"?`<path d="M${ex-10} ${ey} L${ex} ${ey} L${ex} ${ey-10}"/>`:"";
    return `<g fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="${P}"/>${head}</g>`};
  const brd=(x,w)=>`<rect x="${x}" y="34" width="${w}" height="92" rx="6" fill="#FFFFFF" stroke="#D5D9DE" stroke-width="2.5"/>${board?chart(x+18,50,w-36,60,board):""}`;
  const floor=c=>`<rect y="248" width="${W}" height="52" fill="${c}"/>`;
  switch(bg){
    case "office": return `<rect width="${W}" height="${H}" fill="#F3F4F2"/>${floor("#ECEDEA")}<rect x="214" y="40" width="80" height="78" rx="4" fill="none" stroke="${line}" stroke-width="3"/><path d="M254 40v78M214 79h80" stroke="${line}" stroke-width="2"/>${board?brd(24,140):""}`;
    case "meeting": return `<rect width="${W}" height="${H}" fill="#F3F4F2"/>${floor("#ECEDEA")}${brd(24,190)}`;
    case "home": return `<rect width="${W}" height="${H}" fill="#F7F4EF"/>${floor("#F0EAE2")}<rect x="30" y="40" width="96" height="84" rx="4" fill="none" stroke="#E8E0D5" stroke-width="3"/><path d="M78 40v84M30 82h96" stroke="#E8E0D5" stroke-width="2"/>`;
    case "hospital": return `<rect width="${W}" height="${H}" fill="#F1F6F3"/>${floor("#E9F0EC")}<rect x="52" y="44" width="12" height="34" rx="2" fill="#D9E8DF"/><rect x="41" y="55" width="34" height="12" rx="2" fill="#D9E8DF"/>`;
    case "road": return `<rect width="${W}" height="${H}" fill="#F2F5F7"/><path d="M0 180 L80 150 L150 172 L230 140 L320 178 V206 H0Z" fill="#E9EEE9"/><rect y="204" width="${W}" height="96" fill="#E7E9EB"/>${[0,1,2,3,4,5].map(i=>`<rect x="${10+i*60}" y="252" width="30" height="5" rx="2.5" fill="#F8F8F8"/>`).join("")}`;
    case "focus": return `<rect width="${W}" height="${H}" fill="#FBF9F4"/><g fill="#F3EDE0">${Array.from({length:20},(_,i)=>{const a=i/20*Math.PI*2;return `<path d="M160 150 L${160+Math.cos(a)*420} ${150+Math.sin(a)*420} L${160+Math.cos(a+.06)*420} ${150+Math.sin(a+.06)*420}Z"/>`}).join("")}</g>`;
    case "night": return `<rect width="${W}" height="${H}" fill="#EBEDF3"/>${floor("#E3E6ED")}<circle cx="62" cy="64" r="16" fill="#F5F1DE"/>`;
    default: return `<rect width="${W}" height="${H}" fill="#F4F5F3"/>${floor("#EEEFEC")}`;
  }
}

/* 몸통 (발끝이 y=0) */
function bodySVG(k,c){
  const st=`stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"`;
  switch(k){
    case "potato": return `<path d="M-6 -142 C30 -146 50 -116 48 -78 C48 -40 32 -10 -2 -8 C-36 -8 -50 -36 -48 -74 C-46 -112 -34 -140 -6 -142Z" fill="${c.c}" ${st}/>${[[-28,-120,4],[26,-40,5],[-32,-38,3.5],[32,-112,3]].map(([x,y,r])=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.7}" fill="${c.d}" opacity=".7"/>`).join("")}`;
    case "sweetpotato": return `<path d="M4 -156 C28 -140 40 -110 38 -74 C36 -36 24 -12 0 -8 C-24 -10 -38 -36 -38 -72 C-38 -112 -22 -142 4 -156Z" fill="${c.c}" ${st}/><path d="M4 -156 q8 -8 6 -16" fill="none" stroke="${OL}" stroke-width="2.5" stroke-linecap="round"/><path d="M-22 -40 q6 2 10 0 M14 -132 q6 2 10 0 M18 -30 q6 2 10 -1" stroke="${c.d}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case "onion": return `<path d="M-8 -128 C-38 -112 -52 -82 -48 -50 C-44 -18 -20 -8 0 -8 C20 -8 44 -18 48 -50 C52 -82 38 -112 8 -128Z" fill="${c.c}" ${st}/><path d="M-22 -110 q-18 40 -8 96 M22 -110 q18 40 8 96" fill="none" stroke="${c.d}" stroke-width="2"/><path d="M-4 -128 q-8 -16 -18 -22 q14 2 20 14 q2 -14 12 -22 q-2 16 -4 30z" fill="#7BC67E" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>`;
    case "carrot": return `<path d="M-42 -146 C-42 -158 42 -158 42 -146 C42 -104 16 -40 4 -10 Q0 -4 -4 -10 C-16 -40 -42 -104 -42 -146Z" fill="${c.c}" ${st}/><path d="M-30 -80 h10 M20 -64 h10 M-14 -42 h8" stroke="${c.d}" stroke-width="2.4" stroke-linecap="round"/><path d="M-2 -154 q-22 -10 -22 -26 q14 8 20 20 q-2 -18 8 -30 q6 16 0 32 q12 -12 24 -12 q-6 12 -26 20z" fill="#58B368" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>`;
    case "mango": return `<path d="M10 -150 C42 -146 52 -108 48 -72 C44 -32 20 -8 -6 -8 C-36 -10 -50 -40 -46 -78 C-42 -118 -20 -152 10 -150Z" fill="${c.c}" ${st}/><path d="M-32 -104 C-28 -126 -12 -140 6 -144" fill="none" stroke="#FFDA7E" stroke-width="5" stroke-linecap="round"/><path d="M8 -150 v-10" stroke="${OL}" stroke-width="3" stroke-linecap="round"/><path d="M8 -158 q20 -14 36 -6 q-16 14 -36 6z" fill="#5CB85C" stroke="${OL}" stroke-width="2"/>`;
    case "strawberry": return `<path d="M-50 -136 C-52 -154 52 -154 50 -136 C48 -96 26 -40 4 -12 Q0 -6 -4 -12 C-26 -40 -48 -96 -50 -136Z" fill="${c.c}" ${st}/>${[[-30,-124],[30,-124],[-36,-100],[36,-100],[-22,-64],[22,-64],[0,-40],[-10,-80],[10,-80],[0,-138]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="2.2" ry="3" fill="#FFE27A"/>`).join("")}<path d="M-32 -146 l10 10 6 -14 8 12 8 -14 8 14 6 -12 10 8 -4 -14 h-52z" fill="#4CAF50" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><path d="M0 -152 v-10" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`;
    case "watermelon": return `<circle cx="0" cy="-68" r="60" fill="${c.c}" ${st}/>${[-36,-12,12,36].map(x=>`<path d="M${x} -122 q${x/3} 54 0 108" fill="none" stroke="${c.d}" stroke-width="6" stroke-linecap="round"/>`).join("")}<path d="M0 -128 q2 -10 8 -14" stroke="${OL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "insurer": return `<path d="M-44 -122 l-10 -24 24 12z M44 -122 l10 -24 -24 12z" fill="${c.d}" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="0" cy="-72" rx="62" ry="64" fill="${c.c}" ${st}/><rect x="-14" y="-132" width="28" height="7" rx="3.5" fill="#6B4E57"/>
      <path d="M-60 -64 C-58 -32 -36 -10 0 -8 C36 -10 58 -32 60 -64 L28 -58 L0 -26 L-28 -58Z" fill="#283A70" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-28 -58 L0 -26 L28 -58Z" fill="#FFFFFF" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><path d="M0 -56 l-6 6 6 22 6 -22z" fill="#E0483E" stroke="${OL}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="-6" cy="-18" r="3" fill="#F7D46B" stroke="${OL}" stroke-width="1.2"/><circle cx="6" cy="-18" r="3" fill="#F7D46B" stroke="${OL}" stroke-width="1.2"/>`;
    case "driver": return `<ellipse cx="0" cy="-66" rx="50" ry="58" fill="${c.c}" ${st}/><path d="M-42 -100 C-42 -140 42 -140 42 -100Z" fill="#E0483E" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-4 -102 h54 q4 0 2 7 h-56z" fill="#E0483E" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="0" cy="-134" r="4" fill="#E0483E" stroke="${OL}" stroke-width="1.5"/>`;
    case "regulator": return `<path d="M-38 -118 l-8 -28 24 16z M38 -118 l8 -28 -24 16z" fill="${c.d}" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="0" cy="-72" rx="52" ry="64" fill="${c.c}" ${st}/><ellipse cx="0" cy="-42" rx="30" ry="30" fill="#E8E3DA"/><path d="M-12 -40 l-5 -5 M12 -40 l5 -5 M-6 -26 l-4 -5 M6 -26 l4 -5" stroke="${c.d}" stroke-width="2" stroke-linecap="round"/>`;
    case "doctor": return `<path d="M-22 -116 q-12 -44 2 -50 q12 4 8 48z M22 -116 q12 -44 -2 -50 q-12 4 -8 48z" fill="#FFFFFF" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-15 -122 q-5 -28 1 -36 M15 -122 q5 -28 -1 -36" stroke="#F7B6C2" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse cx="0" cy="-66" rx="48" ry="58" fill="${c.c}" ${st}/><path d="M-26 -46 q-2 22 14 26 q14 0 16 -12" fill="none" stroke="#4B5563" stroke-width="3" stroke-linecap="round"/><circle cx="4" cy="-32" r="5" fill="#9CA3AF" stroke="${OL}" stroke-width="1.5"/>`;
    case "planner": return `<path d="M0 -140 C34 -140 50 -110 48 -72 C46 -34 30 -8 0 -8 C-30 -8 -46 -34 -48 -72 C-50 -110 -34 -140 0 -140Z" fill="${c.c}" ${st}/><path d="M-30 -126 q30 -20 60 0" fill="none" stroke="#B8D6F7" stroke-width="5" stroke-linecap="round"/><path d="M-12 -52 l12 8 12 -8 -4 22 -8 4 -8 -4z" fill="#F7D46B" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round"/>`;
    case "fraudster": return `<path d="M0 -140 C34 -140 50 -110 48 -72 C46 -34 30 -8 0 -8 C-30 -8 -46 -34 -48 -72 C-50 -110 -34 -140 0 -140Z" fill="${c.c}" ${st}/><path d="M-36 -132 C-30 -156 30 -156 36 -132 C20 -126 -20 -126 -36 -132Z" fill="#3B3F48" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><path d="M-40 -130 h80" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return "";
}

/* 팔과 손 */
const limb=(d,col)=>`<path d="${d}" fill="none" stroke="${OL}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const hnd=(x,y,col)=>`<circle cx="${x}" cy="${y}" r="7" fill="${col}" stroke="${OL}" stroke-width="2.2"/>`;
function armsSVG(pose,c){
  const [sx,sy]=c.sh,fy=c.face[1],col=c.d;
  const arm=(d,h)=>limb(d,col)+h;
  const down=s=>arm(`M${s*sx} ${sy} Q${s*(sx+16)} ${sy+16} ${s*(sx+12)} ${sy+36}`,hnd(s*(sx+12),sy+38,col));
  switch(pose){
    case "point": return down(-1)+arm(`M${sx} ${sy} Q${sx+26} ${sy-4} ${sx+38} ${sy-40}`,hnd(sx+39,sy-44,col));
    case "cheer": return [-1,1].map(s=>arm(`M${s*sx} ${sy} Q${s*(sx+22)} ${sy-20} ${s*(sx+18)} ${sy-56}`,hnd(s*(sx+18),sy-60,col))).join("");
    case "think": return down(-1)+arm(`M${sx} ${sy} Q${sx+14} ${sy+22} 22 ${fy+30}`,hnd(18,fy+28,col));
    case "phone": return down(-1)+`<rect x="-4" y="${sy-6}" width="26" height="40" rx="5" fill="#2B2B33"/><rect x="-1" y="${sy-2}" width="20" height="31" rx="3" fill="#9ED8FF"/><path d="M3 ${sy+8}h12M3 ${sy+15}h9M3 ${sy+22}h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`+arm(`M${sx} ${sy} Q${sx+8} ${sy+30} 22 ${sy+26}`,hnd(20,sy+26,col));
    case "doc": return `<g transform="rotate(-4 0 ${sy})"><rect x="-26" y="${sy-14}" width="52" height="58" rx="3" fill="#fff" stroke="${OL}" stroke-width="2"/><path d="M-18 ${sy-2}h36M-18 ${sy+8}h30M-18 ${sy+18}h36M-18 ${sy+28}h22" stroke="#A3ADBD" stroke-width="2.6" stroke-linecap="round"/></g>`+[-1,1].map(s=>arm(`M${s*sx} ${sy} Q${s*(sx+6)} ${sy+26} ${s*26} ${sy+22}`,hnd(s*26,sy+22,col))).join("");
    case "worry": return [-1,1].map(s=>arm(`M${s*sx} ${sy} Q${s*(sx+22)} ${sy-20} ${s*(sx-2)} ${fy-24}`,hnd(s*(sx-4),fy-26,col))).join("");
    case "shrug": return [-1,1].map(s=>arm(`M${s*sx} ${sy} Q${s*(sx+30)} ${sy+6} ${s*(sx+30)} ${sy-22}`,hnd(s*(sx+30),sy-26,col))).join("");
    default: return down(-1)+down(1);
  }
}
const feet=c=>`<ellipse cx="-17" cy="-4" rx="12" ry="6" fill="${c.d}" stroke="${OL}" stroke-width="2.2"/><ellipse cx="17" cy="-4" rx="12" ry="6" fill="${c.d}" stroke="${OL}" stroke-width="2.2"/>`;

/* 얼굴: 몸통 위에 얹어요 */
function faceSVG(mood,c,k){
  const eye=(x,dy=0,big)=>`<ellipse cx="${x}" cy="${dy}" rx="${big?6.5:5.4}" ry="${big?8:6.6}" fill="#fff" stroke="${OL}" stroke-width="1.8"/><circle cx="${x}" cy="${dy+1}" r="${big?3.2:3.8}" fill="${OL}"/><circle cx="${x+1.5}" cy="${dy-1}" r="1.4" fill="#fff"/>`;
  let e,b="",m;
  switch(mood){
    case "happy": e=`<path d="M-17 2 q5 -8 11 0 M6 2 q5 -8 11 0" fill="none" stroke="${OL}" stroke-width="2.8" stroke-linecap="round"/>`;m=`<path d="M-8 14 q8 11 16 0 q-8 4 -16 0z" fill="#E86A6A" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>`;break;
    case "surprised": e=eye(-12,0,1)+eye(12,0,1);b=`<path d="M-19 -15 q6 -5 12 -2 M7 -17 q6 -3 12 2" fill="none" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;m=`<ellipse cx="0" cy="17" rx="5" ry="6.5" fill="#B33A3A" stroke="${OL}" stroke-width="2"/>`;break;
    case "worried": e=eye(-12)+eye(12);b=`<path d="M-19 -10 l10 -4 M19 -10 l-10 -4" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;m=`<path d="M-8 16 q4 -4 8 0 t8 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;break;
    case "thinking": e=eye(-12,-1)+eye(12,-1);b=`<path d="M-18 -12 q5 -2 10 0 M8 -15 q5 -3 10 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;m=`<path d="M-1 16 h9" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;break;
    case "angry": e=eye(-12,1)+eye(12,1);b=`<path d="M-20 -13 l12 5 M20 -13 l-12 5" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`;m=`<path d="M-8 18 q8 -7 16 0" fill="none" stroke="${OL}" stroke-width="2.6" stroke-linecap="round"/>`;break;
    case "sad": e=`<path d="M-17 0 q5 5 11 0 M6 0 q5 5 11 0" fill="none" stroke="${OL}" stroke-width="2.6" stroke-linecap="round"/>`;b=`<path d="M-18 -8 l10 -3 M18 -8 l-10 -3" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;m=`<path d="M-7 18 q7 -6 14 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/><path d="M-13 6 q-2 7 1 9 q3 -2 -1 -9z" fill="#7CC4F2"/>`;break;
    default: e=eye(-12)+eye(12);m=`<path d="M-6 14 q6 6 12 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  if(c.mask&&(mood==="happy"||mood==="sad"))e=e.split(OL).join("#fff");
  let extra="";
  if(k==="insurer"){extra=`<ellipse cx="0" cy="16" rx="14" ry="9.5" fill="${c.d}" stroke="${OL}" stroke-width="2"/><ellipse cx="-4.5" cy="16" rx="2.2" ry="3.2" fill="${OL}"/><ellipse cx="4.5" cy="16" rx="2.2" ry="3.2" fill="${OL}"/>`;m=`<g transform="translate(0 16)">${m}</g>`;}
  if(k==="regulator"){extra=`<path d="M-6 8 l6 10 6 -10z" fill="#F2B33D" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round"/>`;m=`<g transform="translate(0 10)">${m}</g>`;}
  const glasses=c.glasses?`<g fill="none" stroke="${OL}" stroke-width="2"><rect x="-21" y="-9" width="18" height="16" rx="5"/><rect x="3" y="-9" width="18" height="16" rx="5"/><path d="M-3 -2 h6"/></g>`:"";
  const mask=c.mask?`<path d="M-30 -10 h60 q2 0 2 6 v8 q0 6 -6 6 h-52 q-6 0 -6 -6 v-8 q0 -6 2 -6z" fill="#2B2B33"/>`:"";
  return `<ellipse cx="-24" cy="10" rx="6.5" ry="4" fill="#FF8E9E" opacity=".55"/><ellipse cx="24" cy="10" rx="6.5" ry="4" fill="#FF8E9E" opacity=".55"/>${mask}${e}${b}${extra}${m}${glasses}`;
}
function fxSVG(fx){
  switch(fx){
    case "sweat": return `<path d="M44 -6 q-7 12 0 16 q7 -4 0 -16z" fill="#7CC4F2" stroke="${OL}" stroke-width="1.6"/>`;
    case "sparkle": return [[-52,-4,9],[50,4,7],[42,-24,5]].map(([x,y,r])=>`<path d="M${x} ${y-r}q2 ${r-2} ${r} ${r}q${-r+2} 2 ${-r} ${r}q-2 ${-r+2} ${-r} ${-r}q${r-2} -2 ${r} ${-r}z" fill="#FFD23F" stroke="${OL}" stroke-width="1.3"/>`).join("");
    case "question": return `<text x="40" y="-2" font-size="34" font-weight="900" fill="#5B6CF0" stroke="${OL}" stroke-width="1.2" font-family="sans-serif">?</text>`;
    case "exclaim": return `<text x="40" y="0" font-size="36" font-weight="900" fill="#E0483E" stroke="${OL}" stroke-width="1.2" font-family="sans-serif">!</text>`;
    case "gloom": return `<g stroke="#8A93B8" stroke-width="2.6" stroke-linecap="round">${[-20,-8,4,16].map(x=>`<path d="M${x} -24 v14"/>`).join("")}</g>`;
    case "heart": return `<path d="M46 -4 c-6 -10 -18 -2 -10 8 l10 10 l10 -10 c8 -10 -4 -18 -10 -8z" fill="#F472B6" stroke="${OL}" stroke-width="1.5"/>`;
    case "idea": return `<g transform="translate(44 -20)"><circle r="10" fill="#FFE066" stroke="${OL}" stroke-width="1.6"/><rect x="-5" y="9" width="10" height="7" rx="2" fill="#B8BCC6" stroke="${OL}" stroke-width="1.4"/><path d="M-18 -10 l-6 -4 M18 -10 l6 -4 M0 -16 v-7" stroke="#FFB020" stroke-width="2.5" stroke-linecap="round"/></g>`;
  }
  return "";
}
function charSVG(ch,flip){
  const k=keyOf(ch.who),c=CAST[k];
  const fx=fxSVG(ch.fx||(ch.mood==="worried"?"sweat":""));
  const fxg=fx?`<g transform="translate(0 ${c.top+14})">${flip?`<g transform="scale(-1 1)">${fx}</g>`:fx}</g>`:"";
  const front=["think","worry","phone","doc"].includes(ch.pose);
  const arms=armsSVG(ch.pose,c);
  return `<g>${feet(c)}${front?"":arms}${bodySVG(k,c)}<g transform="translate(${c.face[0]} ${c.face[1]})">${faceSVG(ch.mood,c,k)}</g>${front?arms:""}${fxg}</g>`;
}

/* 칸 하나 */
function panelHTML(p,i){
  const chars=(p.chars||[]).slice(0,2),n=chars.length;
  const has=w=>chars.some(c=>keyOf(c.who)===w);
  const bg=p.bg||(has("driver")?"road":has("doctor")?"hospital":chars.some(c=>["보험사","계리사","금융당국","설계사"].includes(castOf(c.who).group))?"office":"home");
  const side=n===1&&p.board&&(bg==="office"||bg==="meeting");
  const xs=n===2?[90,230]:[side?228:160];
  const people=chars.map((ch,k)=>{const flip=(n===2&&k===1)||side;const sc=n===2?.95:1.08;return `<g transform="translate(${xs[k]} 294) scale(${flip?-sc:sc} ${sc})">${charSVG(ch,flip)}</g>`}).join("");
  const svg=`<svg class="cp-svg" viewBox="0 0 320 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${bgSVG(bg,p.board)}${people}</svg>`;
  const signHTML=p.sign?`<div class="cp-sign">${esc(p.sign)}</div>`:"";
  const pos=k=>n===2?(k===0?"l":"r"):side?"r":"c";
  const bubbles=chars.map((ch,k)=>ch.say?`<div class="cp-b ${ch.bubble||"talk"} ${pos(k)}"><span>${esc(ch.say)}</span></div>`:"").join("");
  const names=chars.map((ch,k)=>`<span class="cp-n ${n===2?(k===0?"l":"r"):side?"s":"c"}">${esc(ch.name||label(castOf(ch.who)))}</span>`).join("");
  return `<div class="cp">${svg}<div class="cp-o">${p.caption?`<div class="cp-cap"><b>${i+1}</b>${esc(p.caption)}</div>`:`<div class="cp-cap only"><b>${i+1}</b></div>`}${signHTML}<div class="cp-bs n${n}${side?" sd":""}">${bubbles}</div>${names}</div></div>`;
}
window.comicHTML=function(c){
  const panels=(c.panels||[]).slice(0,4).map(panelHTML).join("");
  return `<figure class="comic">${c.title?`<figcaption><b>${esc(c.title)}</b></figcaption>`:""}<div class="cgrid">${panels}</div></figure>`;
};
window.COMIC_CAST=Object.fromEntries(Object.entries(CAST).map(([k,v])=>[k,label(v)]));
})();
