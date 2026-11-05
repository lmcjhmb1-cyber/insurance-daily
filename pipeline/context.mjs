// 저장소의 기존 데이터(이슈, 회사, 용어, 이어보기)를 읽어 프롬프트와 검사에 쓸 정보로 만들어요.
import fs from 'node:fs';
import path from 'node:path';
import { loadWindow, addDays } from '../scripts/_lib.mjs';

export function loadContext(root, date) {
  const issues = loadWindow('issues.js', root).ISSUES || [];
  const news = loadWindow('news.js', root).NEWS || [];
  const basics = loadWindow('basics.js', root).BASICS || [];
  const companies = (loadWindow('companies.js', root).COMPANIES || []).map((c) => c.name);
  const jobs = loadWindow('frames.js', root).JOBS || [];

  const threads = new Map(); // id -> name
  for (const b of basics) if (b.id && b.name) threads.set(b.id, b.name);
  for (const i of issues) if (i.thread?.id) threads.set(i.thread.id, i.thread.name);

  const since = addDays(date, -14);
  const recentTitles = issues.filter((i) => i.date >= since && i.date <= date).map((i) => `${i.date} [${i.tag}] ${i.title}`);
  const terms = new Set();
  for (const i of issues) for (const t of i.terms || []) terms.add(t.t);

  const maxN = (list, re) => list.reduce((m, x) => { const k = String(x.id).match(re); return k ? Math.max(m, Number(k[1])) : m; }, 0);
  return {
    issues,
    threads,
    tags: [...new Set(issues.map((i) => i.tag))],
    companies,
    jobs,
    terms: [...terms],
    lessonKeys: new Set(Object.keys(loadWindow('lessons.js', root).LESSONS || {})),
    recentTitles,
    lastIssueN: maxN(issues.filter((i) => i.date === date), new RegExp(`^${date}-(\\d+)$`)),
    lastNewsN: maxN(news.filter((n) => n.date === date), new RegExp(`^n-${date}-(\\d+)$`)),
    newsUrls: new Set(news.map((n) => n.source?.url).filter(Boolean)),
    weeklyIds: new Set((loadWindow('weekly.js', root).WEEKLY || []).map((w) => w.id)),
  };
}

export function readGuide(root) {
  return fs.readFileSync(path.join(root, 'GUIDE.md'), 'utf8');
}
