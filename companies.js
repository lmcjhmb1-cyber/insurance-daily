// 회사별 보기에 쓰는 주요 보험사 목록이에요.
// name: 정식 이름(이슈의 companies에 이 이름을 그대로 써요), kind: 생명·손해·재보험, group: 소속 금융그룹(없으면 비워요), aka: 기사에서 자주 쓰는 다른 이름
// 이슈 본문(제목, 핵심 정리, 왜 중요할까)에 이름이나 다른 이름이 나오면 사이트가 자동으로 그 회사 이슈로 묶어요.
window.COMPANIES = [
  { name: "삼성생명", kind: "생명", group: "삼성", aka: [] },
  { name: "한화생명", kind: "생명", group: "한화", aka: [] },
  { name: "교보생명", kind: "생명", group: "교보", aka: [] },
  { name: "신한라이프", kind: "생명", group: "신한금융", aka: [] },
  { name: "NH농협생명", kind: "생명", group: "농협금융", aka: ["농협생명"] },
  { name: "KB라이프", kind: "생명", group: "KB금융", aka: ["KB라이프생명"] },
  { name: "미래에셋생명", kind: "생명", group: "미래에셋", aka: [] },
  { name: "동양생명", kind: "생명", group: "", aka: [] },
  { name: "ABL생명", kind: "생명", group: "", aka: [] },
  { name: "흥국생명", kind: "생명", group: "태광", aka: [] },
  { name: "하나생명", kind: "생명", group: "하나금융", aka: [] },
  { name: "DB생명", kind: "생명", group: "DB", aka: [] },
  { name: "삼성화재", kind: "손해", group: "삼성", aka: [] },
  { name: "DB손해보험", kind: "손해", group: "DB", aka: ["DB손보"] },
  { name: "현대해상", kind: "손해", group: "", aka: [] },
  { name: "KB손해보험", kind: "손해", group: "KB금융", aka: ["KB손보"] },
  { name: "메리츠화재", kind: "손해", group: "메리츠금융", aka: [] },
  { name: "한화손해보험", kind: "손해", group: "한화", aka: ["한화손보"] },
  { name: "롯데손해보험", kind: "손해", group: "", aka: ["롯데손보"] },
  { name: "흥국화재", kind: "손해", group: "태광", aka: [] },
  { name: "NH농협손해보험", kind: "손해", group: "농협금융", aka: ["농협손해보험", "농협손보"] },
  { name: "하나손해보험", kind: "손해", group: "하나금융", aka: ["하나손보"] },
  { name: "코리안리", kind: "재보험", group: "", aka: ["코리안리재보험"] }
];
