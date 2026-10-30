// 네컷만화를 그리는 파일이에요. 인물, 표정, 손짓, 배경, 효과를 모두 직접 그려요.
// 이슈의 comic 데이터: { title, panels:[ { caption, bg, sign, board, chars:[ { who, mood, pose, fx, say, bubble, name } ] } ] }
(function(){
const OL="#2B2B33",SK="#FFE1CC",SKD="#F5C7A9";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CAST={
  customer:{name:"가입자",top:"#F59E0B",top2:"#D97706",hair:"bob",hc:"#4A2E22",cloth:"tee"},
  customer2:{name:"가입자 2",top:"#8B5CF6",top2:"#6D28D9",hair:"short",hc:"#22223A",cloth:"sweater"},
  insurer:{name:"보험사",top:"#24366B",top2:"#1A2850",hair:"side",hc:"#1E1E28",cloth:"suit",tie:"#E0483E"},
  actuary:{name:"계리사",top:"#10A37A",top2:"#0B7F5F",hair:"pony",hc:"#5A3524",cloth:"cardigan",glasses:1},
  regulator:{name:"금융당국",top:"#4B5563",top2:"#374151",hair:"gray",hc:"#B8BCC6",cloth:"suit",tie:"#1F3A8A",glasses:1},
  doctor:{name:"병원",top:"#FFFFFF",top2:"#E5E7EB",hair:"short",hc:"#3A3A48",cloth:"coat"},
  driver:{name:"운전자",top:"#2E8BDB",top2:"#1F6FB5",hair:"cap",hc:"#E0483E",cloth:"jacket"}
};

/* 배경 */
function bgSVG(bg,board,sign){
  const W=320,H=300;
  const focus=`<g opacity=".55">${Array.from({length:28},(_,i)=>{const a=i/28*Math.PI*2;return `<path d="M160 170 L${160+Math.cos(a)*420} ${170+Math.sin(a)*420} L${160+Math.cos(a+.06)*420} ${170+Math.sin(a+.06)*420}Z" fill="#FFD7A3"/>`}).join("")}</g>`;
  const chart=(x,y,w,h,dir)=>{const pts=dir==="up"?[[0,.8],[.25,.65],[.5,.7],[.75,.35],[1,.15]]:dir==="down"?[[0,.2],[.25,.35],[.5,.3],[.75,.65],[1,.85]]:[[0,.5],[.25,.4],[.5,.6],[.75,.45],[1,.5]];
    const col=dir==="up"?"#10A37A":dir==="down"?"#E0483E":"#6B7280";
    return `<polyline points="${pts.map(([a,b])=>`${x+a*w},${y+b*h}`).join(" ")}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${dir?`<path d="${dir==="up"?`M${x+w-8} ${y+h*.15-2}l8 -2 -1 8`:`M${x+w-8} ${y+h*.85+2}l8 2 -1 -8`}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`:""}`};
  const sgn=sign?`<text x="124" y="50" text-anchor="middle" font-size="15" font-weight="800" fill="${OL}" font-family="Pretendard Variable,Pretendard,sans-serif">${esc(sign)}</text>`:"";
  switch(bg){
    case "office": return `<rect width="${W}" height="${H}" fill="#E8EEF6"/><rect y="230" width="${W}" height="70" fill="#D9E1EC"/>
      <rect x="196" y="34" width="100" height="92" rx="4" fill="#BFE0F7" stroke="#9FB4CC" stroke-width="3"/>${[0,1,2,3,4,5].map(i=>`<line x1="198" x2="294" y1="${44+i*14}" y2="${44+i*14}" stroke="#9FB4CC" stroke-width="2"/>`).join("")}
      ${board?`<rect x="26" y="40" width="130" height="88" rx="4" fill="#fff" stroke="#9FB4CC" stroke-width="3"/>${chart(40,58,100,56,board)}`:""}
      <rect x="282" y="200" width="22" height="30" rx="3" fill="#C97B4A"/><circle cx="293" cy="186" r="18" fill="#4CAF7A"/><circle cx="282" cy="196" r="11" fill="#3E9A68"/>`;
    case "meeting": return `<rect width="${W}" height="${H}" fill="#EEF0F4"/><rect y="236" width="${W}" height="64" fill="#DADFE7"/>
      <rect x="24" y="22" width="200" height="110" rx="6" fill="#fff" stroke="#A3ADBD" stroke-width="3"/>${chart(44,44,160,72,board||"down")}
      <rect x="236" y="40" width="64" height="80" rx="4" fill="#F7E3B5" stroke="#D8B969" stroke-width="2"/><line x1="246" x2="290" y1="62" y2="62" stroke="#C9A24E" stroke-width="3"/><line x1="246" x2="282" y1="78" y2="78" stroke="#C9A24E" stroke-width="3"/><line x1="246" x2="286" y1="94" y2="94" stroke="#C9A24E" stroke-width="3"/>`;
    case "home": return `<rect width="${W}" height="${H}" fill="#FBEBDA"/><rect y="244" width="${W}" height="56" fill="#E9CDB0"/>
      <rect x="28" y="34" width="104" height="96" rx="4" fill="#CFE9FB" stroke="#D9A980" stroke-width="4"/><line x1="80" x2="80" y1="36" y2="128" stroke="#D9A980" stroke-width="3"/><line x1="30" x2="130" y1="82" y2="82" stroke="#D9A980" stroke-width="3"/>
      <path d="M22 28h18v110c-12-8-16-50-18-110z" fill="#F2A1A1"/><path d="M138 28h-18v110c12-8 16-50 18-110z" fill="#F2A1A1"/>
      <rect x="196" y="48" width="70" height="52" rx="3" fill="#fff" stroke="#D9A980" stroke-width="3"/><path d="M204 92l18-22 14 14 10-10 14 18z" fill="#9AD0A8"/><circle cx="250" cy="62" r="6" fill="#F7C948"/>
      <rect x="0" y="196" width="${W}" height="60" rx="22" fill="#E58E73"/><rect x="0" y="230" width="${W}" height="30" fill="#D97A60"/>`;
    case "hospital": return `<rect width="${W}" height="${H}" fill="#E4F4EF"/><rect y="240" width="${W}" height="60" fill="#CFE6DF"/>
      <circle cx="58" cy="62" r="30" fill="#fff" stroke="#9CCFC0" stroke-width="3"/><rect x="51" y="44" width="14" height="36" rx="2" fill="#2EAD86"/><rect x="40" y="55" width="36" height="14" rx="2" fill="#2EAD86"/>
      <line x1="180" x2="320" y1="24" y2="24" stroke="#9CCFC0" stroke-width="4"/>${[0,1,2,3,4,5,6].map(i=>`<path d="M${186+i*20} 26q10 70 0 200" stroke="#BFE3D7" stroke-width="18" fill="none"/>`).join("")}`;
    case "road": return `<rect width="${W}" height="${H}" fill="#CDE8FA"/><circle cx="270" cy="50" r="22" fill="#FFD66B"/>
      <path d="M0 170 L70 110 L130 160 L200 100 L320 170 V200 H0Z" fill="#B7D7A8"/>
      ${[[30,150,"#E8743B"],[80,140,"#F2B13B"],[240,145,"#D9473A"],[292,150,"#F08A3B"]].map(([x,y,c])=>`<rect x="${x-3}" y="${y}" width="6" height="40" fill="#8A5A3B"/><circle cx="${x}" cy="${y-6}" r="22" fill="${c}"/>`).join("")}
      <rect y="196" width="${W}" height="104" fill="#8E96A3"/>${[0,1,2,3,4,5].map(i=>`<rect x="${10+i*60}" y="246" width="34" height="6" rx="3" fill="#F7F7F7"/>`).join("")}
      <g transform="translate(206 186)"><rect x="0" y="16" width="96" height="30" rx="10" fill="#E0483E" stroke="${OL}" stroke-width="2"/><path d="M14 18 l14 -16 h36 l16 16z" fill="#F26B5E" stroke="${OL}" stroke-width="2"/><path d="M32 4h14v13H22zM52 4h10l12 13H52z" fill="#CFE9FB"/><circle cx="22" cy="48" r="9" fill="${OL}"/><circle cx="76" cy="48" r="9" fill="${OL}"/></g>`;
    case "focus": return `<rect width="${W}" height="${H}" fill="#FFF3DF"/>${focus}`;
    case "night": return `<rect width="${W}" height="${H}" fill="#2D3557"/>${[[30,30],[90,60],[150,25],[220,50],[290,30],[260,90]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" fill="#FFF6C8"/>`).join("")}<circle cx="60" cy="70" r="20" fill="#FFF1A8"/><circle cx="68" cy="64" r="18" fill="#2D3557"/><rect y="240" width="${W}" height="60" fill="#3B4470"/>`;
    default: return `<rect width="${W}" height="${H}" fill="#F1F5FA"/>${Array.from({length:40},(_,i)=>`<circle cx="${(i*53)%320+8}" cy="${Math.floor(i*53/320)*44+20}" r="2.2" fill="#DCE4EF"/>`).join("")}`;
  }
}

/* 인물 */
function sleeve(d,c){return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>`}
const hand=(x,y)=>`<circle cx="${x}" cy="${y}" r="8.5" fill="${SK}" stroke="${OL}" stroke-width="2"/>`;
function arms(pose,c){
  const L=-40,R=40,S=-70,col=c.cloth==="coat"?"#FFFFFF":c.top;
  const down=x=>sleeve(`M${x} ${S} Q${x*1.15} -30 ${x*1.12} 4`,col);
  switch(pose){
    case "point": return down(L)+sleeve(`M${R} ${S} Q66 -86 86 -116`,col)+hand(90,-120)+`<path d="M92 -126 l10 -10" stroke="${OL}" stroke-width="5" stroke-linecap="round"/><path d="M92 -126 l10 -10" stroke="${SK}" stroke-width="3" stroke-linecap="round"/>`;
    case "cheer": return sleeve(`M${L} ${S} Q-66 -100 -62 -148`,col)+sleeve(`M${R} ${S} Q66 -100 62 -148`,col)+hand(-62,-154)+hand(62,-154);
    case "think": return down(L)+sleeve(`M${R} ${S} Q52 -26 22 -48 Q10 -62 12 -86`,col)+hand(12,-92);
    case "phone": return down(L)+sleeve(`M${R} ${S} Q46 -30 22 -40`,col)+`<rect x="-4" y="-78" width="30" height="48" rx="5" fill="#2B2B33" stroke="${OL}" stroke-width="2"/><rect x="-1" y="-74" width="24" height="38" rx="3" fill="#8FD3FF"/><path d="M3 -52 h16 M3 -60 h12 M3 -44 h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`+hand(22,-40);
    case "doc": return sleeve(`M${L} ${S} Q-44 -30 -26 -44`,col)+sleeve(`M${R} ${S} Q44 -30 26 -44`,col)+`<g transform="rotate(-4)"><rect x="-30" y="-92" width="58" height="66" rx="3" fill="#fff" stroke="${OL}" stroke-width="2"/><path d="M-22 -80h40M-22 -70h34M-22 -60h40M-22 -50h26" stroke="#A3ADBD" stroke-width="3" stroke-linecap="round"/></g>`+hand(-26,-44)+hand(26,-44);
    case "worry": return sleeve(`M${L} ${S} Q-56 -84 -36 -104`,col)+sleeve(`M${R} ${S} Q56 -84 36 -104`,col)+hand(-34,-108)+hand(34,-108);
    case "shrug": return sleeve(`M${L} ${S} Q-70 -56 -70 -92`,col)+sleeve(`M${R} ${S} Q70 -56 70 -92`,col)+hand(-70,-98)+hand(70,-98);
    default: return down(L)+down(R);
  }
}
function torso(c){
  const body=`<path d="M-48 6 C-50 -40 -44 -70 -16 -80 L16 -80 C44 -70 50 -40 48 6Z" fill="${c.cloth==="coat"?"#FFFFFF":c.top}" stroke="${OL}" stroke-width="2.5"/>`;
  let det="";
  if(c.cloth==="suit")det=`<path d="M-16 -80 L0 -46 L16 -80Z" fill="#fff" stroke="${OL}" stroke-width="2"/><path d="M0 -74 l-5 6 5 34 5 -34z" fill="${c.tie}" stroke="${OL}" stroke-width="1.5"/><path d="M-16 -80 L-4 -40 M16 -80 L4 -40" stroke="${c.top2}" stroke-width="5"/>`;
  else if(c.cloth==="coat")det=`<path d="M-16 -80 L0 -50 L16 -80Z" fill="#9CC8F0" stroke="${OL}" stroke-width="2"/><path d="M-16 -80 L-4 -36 V6 M16 -80 L4 -36 V6" fill="none" stroke="${OL}" stroke-width="2"/><path d="M-24 -74 q-6 34 14 44 q12 4 14 -10" fill="none" stroke="#4B5563" stroke-width="3"/><circle cx="4" cy="-40" r="5" fill="#9CA3AF" stroke="${OL}" stroke-width="1.5"/>`;
  else if(c.cloth==="cardigan")det=`<path d="M-14 -80 L0 -60 L14 -80Z" fill="#fff" stroke="${OL}" stroke-width="2"/><path d="M0 -60 V6" stroke="${c.top2}" stroke-width="3"/>${[-46,-30,-14].map(y=>`<circle cx="6" cy="${y}" r="2.5" fill="#fff" stroke="${OL}" stroke-width="1"/>`).join("")}`;
  else if(c.cloth==="sweater")det=`<path d="M-18 -80 Q0 -64 18 -80" fill="none" stroke="${c.top2}" stroke-width="6"/><path d="M-30 -20 h60" stroke="${c.top2}" stroke-width="3" opacity=".6"/>`;
  else if(c.cloth==="jacket")det=`<path d="M0 -76 V6" stroke="${c.top2}" stroke-width="3"/><path d="M-16 -80 L-6 -66 M16 -80 L6 -66" stroke="${c.top2}" stroke-width="4"/><rect x="-36" y="-40" width="16" height="12" rx="2" fill="${c.top2}"/>`;
  else det=`<path d="M-16 -80 Q0 -66 16 -80" fill="none" stroke="${c.top2}" stroke-width="4"/>`;
  return body+det+`<rect x="-9" y="-92" width="18" height="16" fill="${SK}" stroke="${OL}" stroke-width="2"/>`;
}
function hairBack(c){
  if(c.hair==="pony")return `<path d="M24 -150 q30 6 28 40 q-2 22 -14 34 q4 -26 -14 -50z" fill="${c.hc}" stroke="${OL}" stroke-width="2"/>`;
  if(c.hair==="bob")return `<path d="M-36 -126 q-4 30 2 46 q10 6 22 2 l28 0 q12 4 22 -2 q6 -16 2 -46z" fill="${c.hc}" stroke="${OL}" stroke-width="2"/>`;
  return "";
}
function hairFront(c){
  const s=`fill="${c.hc}" stroke="${OL}" stroke-width="2" stroke-linejoin="round"`;
  switch(c.hair){
    case "bob": return `<path d="M-34 -118 C-38 -160 -6 -164 6 -160 C34 -158 40 -138 34 -116 C26 -130 14 -136 -2 -134 C-14 -128 -24 -124 -34 -118Z" ${s}/>`;
    case "short": return `<path d="M-32 -124 C-34 -150 -18 -162 0 -162 C22 -162 34 -150 32 -124 L26 -132 L20 -140 L12 -134 L4 -144 L-4 -134 L-14 -142 L-20 -132 L-26 -136Z" ${s}/>`;
    case "side": return `<path d="M-32 -120 C-36 -152 -14 -164 4 -162 C26 -160 36 -146 32 -122 C24 -138 6 -146 -12 -142 C-20 -136 -26 -128 -32 -120Z" ${s}/><path d="M-12 -142 q8 -10 26 -12" fill="none" stroke="${OL}" stroke-width="1.5" opacity=".5"/>`;
    case "gray": return `<path d="M-32 -120 C-36 -150 -14 -162 2 -160 C24 -158 36 -146 32 -122 C26 -134 10 -142 -10 -140 C-20 -134 -26 -128 -32 -120Z" ${s}/>`;
    case "pony": return `<path d="M-33 -118 C-36 -156 -8 -164 4 -162 C30 -160 38 -142 32 -120 C24 -134 8 -140 -6 -138 C-18 -132 -26 -126 -33 -118Z" ${s}/><circle cx="30" cy="-142" r="6" fill="#F472B6" stroke="${OL}" stroke-width="1.5"/>`;
    case "cap": return `<path d="M-32 -128 C-32 -160 32 -160 32 -128Z" ${s}/><path d="M-6 -128 h52 q4 0 2 6 h-54z" ${s}/><circle cx="0" cy="-158" r="3.5" fill="${c.hc}" stroke="${OL}" stroke-width="1.5"/><path d="M-30 -124 q-2 8 0 12 M30 -124 q2 8 0 12" stroke="#3A3A48" stroke-width="6" stroke-linecap="round"/>`;
  }
  return "";
}
function faceSVG(mood,c){
  const eye=(x,dy=0,big)=>`<ellipse cx="${x}" cy="${-120+dy}" rx="${big?6:5}" ry="${big?7.5:6.2}" fill="#fff" stroke="${OL}" stroke-width="1.6"/><circle cx="${x}" cy="${-119+dy}" r="${big?3:3.6}" fill="${OL}"/><circle cx="${x+1.4}" cy="${-121+dy}" r="1.3" fill="#fff"/>`;
  let e,b="",m;
  switch(mood){
    case "happy": e=`<path d="M-16 -118 q5 -7 10 0 M6 -118 q5 -7 10 0" fill="none" stroke="${OL}" stroke-width="2.6" stroke-linecap="round"/>`;m=`<path d="M-9 -104 q9 10 18 0 q-9 4 -18 0z" fill="#E86A6A" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/>`;b=`<path d="M-17 -130 q5 -3 10 -1 M7 -131 q5 -2 10 1" fill="none" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>`;break;
    case "surprised": e=eye(-11,0,1)+eye(11,0,1);b=`<path d="M-18 -134 q6 -5 12 -2 M6 -136 q6 -3 12 2" fill="none" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>`;m=`<ellipse cx="0" cy="-102" rx="5" ry="6" fill="#B33A3A" stroke="${OL}" stroke-width="2"/>`;break;
    case "worried": e=eye(-11)+eye(11);b=`<path d="M-17 -128 l10 -4 M17 -128 l-10 -4" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;m=`<path d="M-8 -102 q4 -4 8 0 t8 0" fill="none" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;break;
    case "thinking": e=eye(-11,-1)+eye(11,-1);b=`<path d="M-17 -131 q5 -2 10 0 M7 -134 q5 -3 10 0" fill="none" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;m=`<path d="M-2 -103 h9" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;break;
    case "angry": e=eye(-11,1)+eye(11,1);b=`<path d="M-18 -132 l11 5 M18 -132 l-11 5" stroke="${OL}" stroke-width="2.8" stroke-linecap="round"/>`;m=`<path d="M-8 -101 q8 -7 16 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;break;
    case "sad": e=`<path d="M-16 -120 q5 4 10 0 M6 -120 q5 4 10 0" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`;b=`<path d="M-17 -127 l10 -3 M17 -127 l-10 -3" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>`;m=`<path d="M-7 -101 q7 -6 14 0" fill="none" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/><path d="M-12 -114 q-2 6 1 8 q3 -2 -1 -8z" fill="#7CC4F2"/>`;break;
    default: e=eye(-11)+eye(11);b=`<path d="M-17 -130 q5 -2 10 0 M7 -130 q5 -2 10 0" fill="none" stroke="${OL}" stroke-width="2" stroke-linecap="round"/>`;m=`<path d="M-6 -104 q6 5 12 0" fill="none" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  const glasses=c.glasses?`<g fill="none" stroke="${OL}" stroke-width="1.8"><rect x="-19" y="-128" width="16" height="14" rx="5"/><rect x="3" y="-128" width="16" height="14" rx="5"/><path d="M-3 -122 h6"/></g>`:"";
  return `<ellipse cx="-31" cy="-116" rx="5" ry="7" fill="${SK}" stroke="${OL}" stroke-width="2"/><ellipse cx="31" cy="-116" rx="5" ry="7" fill="${SK}" stroke="${OL}" stroke-width="2"/>
    <ellipse cx="0" cy="-120" rx="31" ry="32" fill="${SK}" stroke="${OL}" stroke-width="2.5"/>
    <ellipse cx="-19" cy="-107" rx="6" ry="3.5" fill="#FF9AA2" opacity=".55"/><ellipse cx="19" cy="-107" rx="6" ry="3.5" fill="#FF9AA2" opacity=".55"/>
    ${e}${b}<path d="M-1 -112 q2 3 4 0" fill="none" stroke="${SKD}" stroke-width="2" stroke-linecap="round"/>${m}${glasses}`;
}
function fxSVG(fx){
  switch(fx){
    case "sweat": return `<path d="M40 -146 q-7 12 0 16 q7 -4 0 -16z" fill="#7CC4F2" stroke="${OL}" stroke-width="1.5"/>`;
    case "sparkle": return [[-48,-150,9],[46,-140,7],[38,-170,5]].map(([x,y,r])=>`<path d="M${x} ${y-r}q2 ${r-2} ${r} ${r}q${-r+2} 2 ${-r} ${r}q-2 ${-r+2} ${-r} ${-r}q${r-2} -2 ${r} ${-r}z" fill="#FFD23F" stroke="${OL}" stroke-width="1.2"/>`).join("");
    case "question": return `<text x="40" y="-150" font-size="34" font-weight="900" fill="#5B6CF0" stroke="${OL}" stroke-width="1.2" font-family="sans-serif">?</text>`;
    case "exclaim": return `<text x="38" y="-148" font-size="36" font-weight="900" fill="#E0483E" stroke="${OL}" stroke-width="1.2" font-family="sans-serif">!</text>`;
    case "gloom": return `<g stroke="#6B7AA8" stroke-width="2.5" stroke-linecap="round">${[-20,-8,4,16].map(x=>`<path d="M${x} -168 v14"/>`).join("")}</g>`;
    case "heart": return `<path d="M44 -150 c-6 -10 -18 -2 -10 8 l10 10 l10 -10 c8 -10 -4 -18 -10 -8z" fill="#F472B6" stroke="${OL}" stroke-width="1.5"/>`;
    case "idea": return `<g transform="translate(40 -166)"><circle r="10" fill="#FFE066" stroke="${OL}" stroke-width="1.6"/><rect x="-5" y="9" width="10" height="7" rx="2" fill="#B8BCC6" stroke="${OL}" stroke-width="1.4"/><path d="M-18 -10 l-6 -4 M18 -10 l6 -4 M0 -16 v-7" stroke="#FFB020" stroke-width="2.5" stroke-linecap="round"/></g>`;
  }
  return "";
}
function charSVG(ch,flip){
  const c=CAST[ch.who]||CAST.customer;
  const fx=fxSVG(ch.fx||(ch.mood==="worried"?"sweat":""));
  return `<g>${hairBack(c)}${torso(c)}${faceSVG(ch.mood,c)}${hairFront(c)}${arms(ch.pose,c)}${fx?(flip?`<g transform="scale(-1 1)">${fx}</g>`:fx):""}</g>`;
}
/* 칸 하나 */
function panelHTML(p,i){
  const chars=(p.chars||[]).slice(0,2),n=chars.length;
    const bg=p.bg||(chars.some(c=>c.who==="driver")?"road":chars.some(c=>c.who==="doctor")?"hospital":chars.some(c=>["insurer","actuary","regulator"].includes(c.who))?"office":"home");
  const side=n===1&&p.board&&(bg==="office"||bg==="meeting");
  const xs=n===2?[92,228]:[side?222:160];
  const people=chars.map((ch,k)=>{const flip=(n===2&&k===1)||side;const sc=n===2?.92:1.05;return `<g transform="translate(${xs[k]} 300) scale(${flip?-sc:sc} ${sc})">${charSVG(ch,flip)}</g>`}).join("");
  const desk=bg==="office"?`<rect y="276" width="320" height="24" fill="#C9A47E"/><rect y="272" width="320" height="6" fill="#B38C66"/>`:"";
  const svg=`<svg class="cp-svg" viewBox="0 0 320 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${bgSVG(bg,p.board,p.sign)}${people}${desk}</svg>`;
  const signHTML=p.sign?`<div class="cp-sign">${esc(p.sign)}</div>`:"";
  const bubbles=chars.map((ch,k)=>ch.say?`<div class="cp-b ${ch.bubble||"talk"} ${n===2?(k===0?"l":"r"):side?"r":"c"}"><span>${esc(ch.say)}</span></div>`:"").join("");
  const names=chars.map((ch,k)=>`<span class="cp-n ${n===2?(k===0?"l":"r"):side?"s":"c"}">${esc(ch.name||(CAST[ch.who]||CAST.customer).name)}</span>`).join("");
  return `<div class="cp">${svg}<div class="cp-o">${p.caption?`<div class="cp-cap"><b>${i+1}</b>${esc(p.caption)}</div>`:`<div class="cp-cap only"><b>${i+1}</b></div>`}${signHTML}<div class="cp-bs n${n}${side?" sd":""}">${bubbles}</div>${names}</div></div>`;
}
window.comicHTML=function(c){
  const panels=(c.panels||[]).slice(0,4).map(panelHTML).join("");
  return `<figure class="comic">${c.title?`<figcaption><b>${esc(c.title)}</b></figcaption>`:""}<div class="cgrid">${panels}</div></figure>`;
};
})();
