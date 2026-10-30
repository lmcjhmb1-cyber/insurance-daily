# 콘텐츠 작성 안내

"오늘의 보험 이슈"에 이슈, 기초 다지기, 주간 큰 그림을 올릴 때 따르는 규칙이에요.
매일 이슈를 올리는 예약 작업과 과거 이슈를 채우는 예약 작업이 모두 이 파일을 읽고 그대로 따라요.
형식이 바뀌면 이 파일만 고치면 돼요.

## 1. 사실 확인
- 이슈마다 원문 기사를 실제로 열어서(WebFetch) 읽고, 기사에 나온 사실과 숫자만 써요. 기억이나 추측으로 숫자를 만들지 않아요.
- 해석이나 전망은 "~할 수 있어요"처럼 사실과 구분해서 써요.
- 기사 문장을 그대로 옮기지 않고, 새로 쓴 학습용 설명으로 써요.
- 원문 기사를 찾거나 열 수 없는 사건은 넣지 않아요.
- 이미 issues.js에 있는 사건과 겹치면, 새 소식이 없는 한 다시 만들지 않아요.

## 2. 이슈 하나의 형식
모든 이슈는 가볍게 보기와 깊게 보기 두 방식을 다 지원해야 해요. 기존 이슈들에 실제 예시가 있어요.

| 항목 | 내용 |
|---|---|
| id | "YYYY-MM-DD-번호"(1부터). 기초 이슈는 "YYYY-MM-DD-b번호" |
| date | "YYYY-MM-DD". 기사 날짜 |
| tag | 짧은 분야 이름(예: "실손보험", "감독·계리", "보험사 실적"). 같은 분야는 기존 이슈와 같은 이름 |
| title | 핵심을 담은 제목. 궁금증을 일으키면 좋아요 |
| predict | { q, options(2~3개), answer(정답 인덱스), reveal } 읽기 전에 예측해보는 질문과 정답 설명 |
| comic | 네컷만화(선택, 아래 3번) |
| figs | 그림 1~2개(아래 4번) |
| numbers | [{ label, value, note }] 3~4개. 큰 숫자 타일로 보여요. value는 짧게(예: "−43.2%", "6,811억 원"). 숫자가 별로 없으면 생략 |
| points | 핵심 정리 2~3문장. terms의 단어가 문장에 그대로 들어가면 밑줄이 쳐져서 뜻이 보여요 |
| why | "왜 중요할까" 한 문단. 계리·상품개발·업계 관점의 의미와 뉴스를 볼 때의 생각 습관 |
| chain | 원인→결과 인과 사슬 5~7개 고리. 화살표 흐름도로 그려지니 고리 하나는 한 줄로 짧게 |
| role | { q, model } "내가 담당자라면" 질문(계리사, 상품개발자, 언더라이터 등 구체적 역할과 상황)과 모범 해설 |
| summary | 보험 모르는 친구에게 말하듯 쓴 한 줄 요약 예시(반말) |
| interview | { q, guide } 보험사 면접 질문과 답변 뼈대. guide는 "결론부터: ...\n근거: ...(기사 숫자)\n관점: ...(직무 관점)\n마무리: ..." 네 줄 |
| quiz | [{ q, o, a, e }] 2~3개. 깊게 보기에서만 낼 개념 심화 문제는 "deep": true. 복습과 주간 퀴즈에 재사용되니 이슈 내용만으로 풀 수 있게 |
| terms | [{ t, d }] 3~6개. 기존 이슈에 같은 용어가 있으면 같은 이름과 같은 뜻 |
| thread | { id, name } 이어보기 묶음. 아래 5번 |
| frames | frames.js의 생각의 틀 id 1~3개. 꼭 필요할 때만 frames.js에 새 틀 추가 |
| jobs | frames.js의 window.JOBS 중 1~3개 |
| companies | 기사에서 중요하게 다룬 국내 보험사의 정식 이름 목록(companies.js의 name 그대로). 업계 전체 이야기면 생략. 아래 2-1 참고 |
| sources | [{ name: 언론사 이름, url: 실제로 읽은 기사 주소 }] |
| basic | 기초 다지기 이슈만 true |

## 2-1. 회사별 보기 companies
- 사이트의 "회사별 보기"는 지원할 회사의 면접을 준비하는 용도예요. 그래서 특정 보험사가 주인공인 이슈(실적, 신상품, 제재, 인수합병, 경영 전략, 사고 대응 등)는 그 회사를 companies에 꼭 넣어요.
- 업계 여러 회사를 비교한 기사(예: 대형 손보사 4곳 손해율)도 기사에 회사 이름과 숫자가 나오면 그 회사들을 넣어요. 회사 이름이 안 나오면 넣지 않아요.
- 이름은 companies.js의 name과 똑같이 써요(예: "KB손해보험", "DB손해보험"). 본문에 회사 이름이 나오면 사이트가 자동으로도 묶지만, 줄임말이나 다른 표현일 수 있으니 companies에 정확히 적어요.
- companies.js에 없는 국내 보험사가 중요하게 나오면 companies.js의 window.COMPANIES 배열에 { name, kind("생명"·"손해"·"재보험"), group(소속 금융그룹, 없으면 ""), aka(다른 이름 배열) } 형식으로 추가해요. 확실하지 않은 그룹 정보는 비워둬요.
- 특정 회사가 주인공인 이슈는 interview 질문도 "그 회사 입장이라면"으로 생각해볼 수 있게 쓰면 좋아요(회사 이름을 넣어도 돼요).

## 3. 네컷만화 comic (어울리는 이슈에만)
- 모든 이슈에 넣지 않아요. 사람들의 선택과 행동이 이야기의 핵심인 이슈(역선택, 도덕적 해이, 보험사기, 갈아타기, 절판 마케팅 등)나, 소비자에게 직접 와닿는 변화, "반짝 좋아 보이지만 사실은…" 같은 반전이 있는 이슈에 넣어요. 하루 이슈 가운데 1~2개 정도가 알맞아요.
- 형식: { title, panels: [4칸] }
  - 칸: { caption(노란 해설 상자, 짧게), bg(배경), sign(선택, 안내판에 들어갈 핵심 숫자나 문구), board(선택, 화이트보드 그래프 방향), chars: [1~2명] }
  - bg: office(사무실), meeting(회의실 화이트보드), home(집 거실), hospital(병원), road(도로), focus(강조 집중선), night(밤), plain(빈 배경). 배경은 시선을 뺏지 않게 연한 색으로만 그려져요.
  - board: up(오르는 그래프), down(내리는 그래프), flat(제자리). office나 meeting에서만 보여요. 인물이 1명이면 보드가 보이도록 인물이 오른쪽으로 비켜서요.
  - 인물: { who, mood, pose, fx, say(말풍선), bubble }
  - 등장인물은 사람이 아니라 마스코트예요. 이름표는 who에 따라 "이름 직업"으로 자동으로 붙어요(예: 망고 계리사, 감자 가입자, 배불뚝이 보험사). name은 적지 않아요. 말풍선이나 해설에서 인물을 부를 때도 "망고 계리사"처럼 이름 뒤에 직업을 붙여요.
  - who와 이름:
    - 가입자(채소): potato(감자), sweetpotato(고구마), onion(양파), carrot(당근이)
    - 계리사(과일): mango(망고), strawberry(딸기), watermelon(수박이)
    - 보험사: insurer(배불뚝이 보험사). 보험사는 언제나 이것 하나만 써요.
    - 그 밖의 역할은 역할 이름 그대로예요: driver(운전자), regulator(금융당국), doctor(의사), planner(설계사), fraudster(보험사기범)
  - 한 만화 안에서는 같은 인물을 같은 who로 계속 써요. 가입자가 둘이면 서로 다른 채소를 골라요. 만화마다 채소는 골고루 바꿔 써요.
  - 계리사는 mango(망고 계리사)를 늘 먼저 써요. 한 칸이나 한 만화에 계리사가 둘 필요할 때만 두 번째 계리사로 strawberry(딸기 계리사)나 watermelon(수박이 계리사)를 써요.
  - mood: happy, worried, surprised, thinking, angry, sad
  - pose: stand(기본), point(가리키기), cheer(만세), think(턱 괴기), phone(휴대폰 보기), doc(서류 들기), worry(머리 감싸기), shrug(어깨 으쓱)
  - fx(선택): sweat(땀방울), sparkle(반짝), question(물음표), exclaim(느낌표), gloom(우울한 그늘), heart(하트), idea(전구). worried는 따로 안 적어도 땀방울이 나와요.
  - bubble(선택): talk(기본 말풍선), think(속마음 구름), shout(외침, 노란 상자)
- 칸마다 장면, 손짓, 표정을 바꿔서 단조롭지 않게 해요. 예를 들어 1칸은 소식을 접하는 장면(phone, surprised), 2칸은 갈등이나 고민, 3칸은 보험사나 당국의 반응, 4칸은 계리사의 정리(doc나 point, idea)처럼 흐름을 만들어요.
- 말풍선이 없는 사람(표정과 효과만)도 괜찮아요. 한 칸에 말풍선은 2개까지예요.
- 말풍선은 30자 안쪽으로 짧게 써요. 휴대폰에서는 칸이 작아요.
- 기사에 나온 사실과 숫자만 쓰고, 마지막 칸은 계리·상품개발 관점의 깨달음이나 다음에 지켜볼 점으로 마무리하면 좋아요.
- 실존 인물이나 회사 이름을 등장인물 이름으로 쓰지 않아요. 말풍선에서도 보험사는 "우리"나 "배불뚝이 보험사"로 불러요.

## 4. 그림 figs
글만 이어지지 않게 핵심 숫자나 흐름을 그림으로 보여줘요. 사이트가 아래 데이터로 직접 그려요. 기사 숫자만 쓰고, 계산한 값이면 note에 "어림값"이라고 밝혀요.
- bars(막대 비교): { type:"bars", title, unit(선택), items:[{ label, value(숫자), text(선택), hi(강조, 선택) }], ref:{ value, label }(기준선, 선택), note(선택) }. 음수가 있으면 0을 가운데 두고 그려요.
- compare(전후 비교표): { type:"compare", title, left, right, rows:[{ label, left, right }], note }
- timeline(타임라인): { type:"timeline", title, items:[{ when, label, now(이 기사 시점이면 true) }] }
- split(구성 막대): { type:"split", title, items:[{ label, value, text }], total(선택), note }
- 실적·손해율은 bars, 제도 개편은 compare나 timeline, 비용 구성은 split이 잘 맞아요. 그릴 것이 정말 없으면 생략해요. 기초 이슈에는 흐름의 큰 줄기를 보여주는 timeline을 꼭 넣어요.

## 5. 이어보기 thread
- basics.js의 흐름 id(ifrs17, kics, actuarial-supervision, rates, silson-reform, auto-loss, sales-channel, fraud, aging)나 issues.js에 이미 있는 thread id와 같은 사건 흐름이면 그 id와 name을 그대로 써요.
- 새 흐름이면 영어 소문자와 하이픈으로 된 새 id와 한국어 name을 만들어요. 몇 주에서 몇 달 이어질 큰 흐름 단위로 묶고 너무 잘게 쪼개지 않아요.

## 6. 주간 큰 그림
- weekly.js의 window.WEEKLY 배열에 추가하고, id 기준 최신순으로 유지해요. 같은 id가 있으면 만들지 않아요.
- { id: 일요일 날짜, start: 월요일 날짜, end: 일요일 날짜, title, big: [2~4문단], flows: [{ thread, note }], takeaway, next }
- big에는 그 주 이슈들이 어떻게 이어지는지, 계리·상품개발 관점에서 배울 점을 써요. 이슈 내용에 없는 새 사실이나 숫자는 넣지 않아요.
- 그 주 basic이 아닌 이슈가 3개 미만이면 만들지 않아요. 주간 퀴즈는 사이트가 자동으로 골라요.

## 7. 글쓰기 규칙
- 모든 내용은 한국어로만 써요. 영어 단어와 영어 약어를 섞지 않아요. 영어 약어가 있는 개념은 한국어로 풀어 써요(예: 보험계약마진, 지급여력비율(킥스), 새 국제회계기준). thread.id, figs의 type, comic의 bg·board·who·mood·pose·fx·bubble 값만 예외로 영어 소문자를 써요.
- 말투는 친근한 존댓말("~해요"), summary만 반말이에요.
- 대학생이 이해할 수 있게 쉽게 쓰되 보험 용어는 정확하게 써요. 한 문단이 너무 길지 않게 짧게 끊어요.
- 퀴즈 오답 보기는 그럴듯하게, 해설(e)은 왜 정답인지 짧게 써요.

## 7-1. 강조 표시
- 문장 안에서 꼭 기억할 부분을 `**강조할 말**`처럼 별표 두 개로 감싸면 형광펜으로 칠해져요.
- predict.reveal, points, why, role.model, summary, interview.guide, 퀴즈 해설(e), 기초 이슈, 주간 정리 big·takeaway에 쓸 수 있어요. title, tag, terms, chain, numbers, figs, comic에는 쓰지 않아요.
- 핵심 숫자, 결론, 헷갈리기 쉬운 개념 정도만 칠해요. 한 문장에 1~2곳, 한 항목에 2~3곳을 넘지 않게 해요. 많이 칠하면 아무것도 눈에 안 들어와요.
- 용어 사전 단어(terms)를 통째로 감싸지 말고, 그 단어가 들어간 짧은 구절을 감싸요.

## 8. 올리는 방법 (두 예약 작업이 동시에 고칠 수 있어서 꼭 이 순서로)
1. 새로 만든 내용은 작업 중에 저장소 밖의 임시 JSON 파일에 모아둬요.
2. 올리기 직전에 `git fetch origin main` 후 `git reset --hard origin/main`으로 최신 상태를 받아요.
3. node 스크립트로 최신 파일에 합쳐 넣어요. issues.js의 window.ISSUES는 date 기준 최신순(같은 날은 번호순)으로 정렬해서 다시 쓰고, 같은 id가 있으면 건너뛰어요. 파일 맨 위 주석은 그대로 둬요.
4. index.html 안의 모든 "?v=숫자"를 현재 시각(YYYYMMDDHHmm)으로 바꿔요. 안 바꾸면 방문자 브라우저가 예전 파일을 써서 화면이 멈춰요.
5. 확인: node로 issues.js, frames.js, weekly.js, basics.js, companies.js를 불러와(global.window={} 뒤 require) 정상인지 검사해요. 새 이슈마다 필수 항목, 퀴즈 a와 predict.answer의 범위, figs type(bars·compare·timeline·split)과 bars value가 숫자인지, comic의 bg·board·who·mood·pose·fx·bubble이 위 목록 안의 값이고 칸이 4개인지, frames id와 jobs가 frames.js에 있는 값인지, companies의 이름이 companies.js의 name에 있는지, 주간 정리의 flows.thread가 실제 thread id인지, basics.js order의 id가 issues.js에 있는지 검사해요. node --check app.js도 실행해요.
6. 커밋 작성자는 user.name "lmcjhmb1-cyber", user.email "lmcjhmb1@gmail.com", 커밋 메시지는 한국어로 써요. main에 푸시하고, 거절되면 2번부터 다시 해요(최대 3번).
7. `gh run list -R lmcjhmb1-cyber/insurance-daily -L 1`로 "pages build and deployment"가 성공으로 끝났는지 확인하고, 실패하면 원인을 고쳐 다시 올려요.

## 9. 건드리지 않는 파일
app.js, sync.js, index.html의 화면과 디자인(버전 숫자만 바꿔요), worker 폴더.
