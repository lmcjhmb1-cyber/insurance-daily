// 시험 도우미: 저장소 복사본 만들기, 후보 파일 만들기
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../run.mjs';

export function makeRepoCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idaily-test-'));
  fs.cpSync(REPO_ROOT, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(REPO_ROOT, src).split(path.sep);
      return !(rel.includes('.git') || rel.includes('node_modules') || (rel[0] === 'pipeline' && rel[1] === 'out'));
    },
  });
  return dir;
}

export function candidate(i, o) {
  return {
    id: `c-${o.date}-${String(i).padStart(3, '0')}`, source: o.source || '보험저널', type: o.type || 'press', title: o.title,
    url: o.url, date: o.date, companies: o.companies || [], score: o.score ?? 5, group: o.group, used: !!o.used, ...(o.dept ? { dept: o.dept } : {}),
  };
}

export function writeCandidates(root, date, items) {
  fs.mkdirSync(path.join(root, 'candidates'), { recursive: true });
  fs.writeFileSync(path.join(root, 'candidates', `${date}.json`), JSON.stringify({ date, collectedAt: '', sources: [], errors: [], items }, null, 2));
}

// 현실적인 후보 묶음: 보도자료+기사, 회사 기사, 얇은 보도자료만 있는 묶음, 이미 쓴 기사
export function sampleCandidates(date) {
  const c = (i, o) => candidate(i, { date, ...o });
  return [
    c(1, { title: '모의 기준 개정안 금융위원회 의결', source: '금융위원회', type: 'regulator', url: 'https://www.fsc.go.kr/no010101/99001', group: 1, score: 9 }),
    c(2, { title: '모의 보험사 기준 강화 정기 보고 의무화', source: '한국보험신문', url: 'https://www.insnews.co.kr/news/articleView.html?idxno=99002', group: 1, score: 6 }),
    c(3, { title: '모의 삼성화재 새 상품 출시 소식입니다', url: 'https://www.insjournal.co.kr/news/articleView.html?idxno=99003', group: 2, score: 5, companies: ['삼성화재'] }),
    c(4, { title: '모의 한화생명 종신보험 개편 소식입니다', source: '보험매일', url: 'https://www.insweek.co.kr/news/articleView.html?idxno=99004', group: 3, score: 5, companies: ['한화생명'] }),
    c(5, { title: '모의 세미나 개최 안내', source: '금감원', type: 'regulator', url: 'https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=99005&menuNo=200218', group: 4, score: 5 }),
    c(6, { title: '모의 이미 쓴 기사입니다 여러분', url: 'https://www.insjournal.co.kr/news/articleView.html?idxno=99006', group: 5, score: 4, used: true }),
  ];
}
