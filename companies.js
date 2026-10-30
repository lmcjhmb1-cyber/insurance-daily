// 회사별 보기에 쓰는 주요 보험사 목록이에요.
// name: 정식 이름(이슈의 companies에 이 이름을 그대로 써요), kind: 생명·손해·재보험, group: 소속 금융그룹(없으면 비워요), aka: 기사에서 자주 쓰는 다른 이름
// color: 회사 대표색(대략), ink: 그 색 위 글자색, mono: 로고를 못 불러올 때 대신 보여줄 짧은 이름
// site: 회사 공식 홈페이지 주소. 방문자 브라우저가 그 홈페이지의 아이콘(로고)을 불러와 보여줘요. 저장소에 로고 파일을 넣지는 않아요
// 이슈 본문(제목, 핵심 정리, 왜 중요할까)에 이름이나 다른 이름이 나오면 사이트가 자동으로 그 회사 이슈로 묶어요.
window.COMPANIES = [
  { name: "삼성생명", kind: "생명", group: "삼성", color: "#1428A0", ink: "#fff", mono: "삼성", site: "samsunglife.com", aka: [] },
  { name: "한화생명", kind: "생명", group: "한화", color: "#F37321", ink: "#fff", mono: "한화", site: "hanwhalife.com", aka: [] },
  { name: "교보생명", kind: "생명", group: "교보", color: "#22427A", ink: "#fff", mono: "교보", site: "kyobo.com", aka: [] },
  { name: "신한라이프", kind: "생명", group: "신한금융", color: "#0046FF", ink: "#fff", mono: "신한", site: "shinhanlife.co.kr", aka: [] },
  { name: "NH농협생명", kind: "생명", group: "농협금융", color: "#0072BC", ink: "#fff", mono: "NH", site: "nhlife.co.kr", aka: ["농협생명"] },
  { name: "KB라이프", kind: "생명", group: "KB금융", color: "#FFBC00", ink: "#3E3A39", mono: "KB", site: "kblife.co.kr", aka: ["KB라이프생명"] },
  { name: "미래에셋생명", kind: "생명", group: "미래에셋", color: "#F58220", ink: "#fff", mono: "미래", site: "life.miraeasset.com", aka: [] },
  { name: "동양생명", kind: "생명", group: "", color: "#D7282F", ink: "#fff", mono: "동양", site: "myangel.co.kr", aka: [] },
  { name: "ABL생명", kind: "생명", group: "", color: "#C8102E", ink: "#fff", mono: "ABL", site: "abllife.co.kr", aka: [] },
  { name: "흥국생명", kind: "생명", group: "태광", color: "#E6007E", ink: "#fff", mono: "흥국", site: "heungkuklife.co.kr", aka: [] },
  { name: "하나생명", kind: "생명", group: "하나금융", color: "#008485", ink: "#fff", mono: "하나", site: "hanalife.co.kr", aka: [] },
  { name: "DB생명", kind: "생명", group: "DB", color: "#00854A", ink: "#fff", mono: "DB", site: "idblife.com", aka: [] },
  { name: "삼성화재", kind: "손해", group: "삼성", color: "#1428A0", ink: "#fff", mono: "삼성", site: "samsungfire.com", aka: [] },
  { name: "DB손해보험", kind: "손해", group: "DB", color: "#00854A", ink: "#fff", mono: "DB", site: "idbins.com", aka: ["DB손보"] },
  { name: "현대해상", kind: "손해", group: "", color: "#F47920", ink: "#fff", mono: "현대", site: "hi.co.kr", aka: [] },
  { name: "KB손해보험", kind: "손해", group: "KB금융", color: "#FFBC00", ink: "#3E3A39", mono: "KB", site: "kbinsure.co.kr", aka: ["KB손보"] },
  { name: "메리츠화재", kind: "손해", group: "메리츠금융", color: "#E3001B", ink: "#fff", mono: "메리츠", site: "meritzfire.com", aka: [] },
  { name: "한화손해보험", kind: "손해", group: "한화", color: "#F37321", ink: "#fff", mono: "한화", site: "hwgeneralins.com", aka: ["한화손보"] },
  { name: "롯데손해보험", kind: "손해", group: "", color: "#DA291C", ink: "#fff", mono: "롯데", site: "lotteins.co.kr", aka: ["롯데손보"] },
  { name: "흥국화재", kind: "손해", group: "태광", color: "#E6007E", ink: "#fff", mono: "흥국", site: "heungkukfire.co.kr", aka: [] },
  { name: "NH농협손해보험", kind: "손해", group: "농협금융", color: "#0072BC", ink: "#fff", mono: "NH", site: "nhfire.co.kr", aka: ["농협손해보험", "농협손보"] },
  { name: "하나손해보험", kind: "손해", group: "하나금융", color: "#008485", ink: "#fff", mono: "하나", site: "hanainsure.co.kr", aka: ["하나손보"] },
  { name: "코리안리", kind: "재보험", group: "", color: "#003B71", ink: "#fff", mono: "코리안", site: "koreanre.co.kr", aka: ["코리안리재보험"] }
];
