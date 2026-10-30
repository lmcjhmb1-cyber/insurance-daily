// 회사별 보기에 쓰는 주요 보험사 목록이에요.
// name: 정식 이름(이슈의 companies에 이 이름을 그대로 써요), kind: 생명·손해·재보험, group: 소속 금융그룹(없으면 비워요), aka: 기사에서 자주 쓰는 다른 이름
// color: 회사 대표색(대략), ink: 그 색 위 글자색, mono: 동그라미 안에 넣을 짧은 이름. 로고 그림은 쓰지 않아요(상표권)
// 이슈 본문(제목, 핵심 정리, 왜 중요할까)에 이름이나 다른 이름이 나오면 사이트가 자동으로 그 회사 이슈로 묶어요.
window.COMPANIES = [
  { name: "삼성생명", kind: "생명", group: "삼성", color: "#1428A0", ink: "#fff", mono: "삼성", aka: [] },
  { name: "한화생명", kind: "생명", group: "한화", color: "#F37321", ink: "#fff", mono: "한화", aka: [] },
  { name: "교보생명", kind: "생명", group: "교보", color: "#22427A", ink: "#fff", mono: "교보", aka: [] },
  { name: "신한라이프", kind: "생명", group: "신한금융", color: "#0046FF", ink: "#fff", mono: "신한", aka: [] },
  { name: "NH농협생명", kind: "생명", group: "농협금융", color: "#0072BC", ink: "#fff", mono: "NH", aka: ["농협생명"] },
  { name: "KB라이프", kind: "생명", group: "KB금융", color: "#FFBC00", ink: "#3E3A39", mono: "KB", aka: ["KB라이프생명"] },
  { name: "미래에셋생명", kind: "생명", group: "미래에셋", color: "#F58220", ink: "#fff", mono: "미래", aka: [] },
  { name: "동양생명", kind: "생명", group: "", color: "#D7282F", ink: "#fff", mono: "동양", aka: [] },
  { name: "ABL생명", kind: "생명", group: "", color: "#C8102E", ink: "#fff", mono: "ABL", aka: [] },
  { name: "흥국생명", kind: "생명", group: "태광", color: "#E6007E", ink: "#fff", mono: "흥국", aka: [] },
  { name: "하나생명", kind: "생명", group: "하나금융", color: "#008485", ink: "#fff", mono: "하나", aka: [] },
  { name: "DB생명", kind: "생명", group: "DB", color: "#00854A", ink: "#fff", mono: "DB", aka: [] },
  { name: "삼성화재", kind: "손해", group: "삼성", color: "#1428A0", ink: "#fff", mono: "삼성", aka: [] },
  { name: "DB손해보험", kind: "손해", group: "DB", color: "#00854A", ink: "#fff", mono: "DB", aka: ["DB손보"] },
  { name: "현대해상", kind: "손해", group: "", color: "#F47920", ink: "#fff", mono: "현대", aka: [] },
  { name: "KB손해보험", kind: "손해", group: "KB금융", color: "#FFBC00", ink: "#3E3A39", mono: "KB", aka: ["KB손보"] },
  { name: "메리츠화재", kind: "손해", group: "메리츠금융", color: "#E3001B", ink: "#fff", mono: "메리츠", aka: [] },
  { name: "한화손해보험", kind: "손해", group: "한화", color: "#F37321", ink: "#fff", mono: "한화", aka: ["한화손보"] },
  { name: "롯데손해보험", kind: "손해", group: "", color: "#DA291C", ink: "#fff", mono: "롯데", aka: ["롯데손보"] },
  { name: "흥국화재", kind: "손해", group: "태광", color: "#E6007E", ink: "#fff", mono: "흥국", aka: [] },
  { name: "NH농협손해보험", kind: "손해", group: "농협금융", color: "#0072BC", ink: "#fff", mono: "NH", aka: ["농협손해보험", "농협손보"] },
  { name: "하나손해보험", kind: "손해", group: "하나금융", color: "#008485", ink: "#fff", mono: "하나", aka: ["하나손보"] },
  { name: "코리안리", kind: "재보험", group: "", color: "#003B71", ink: "#fff", mono: "코리안", aka: ["코리안리재보험"] }
];
