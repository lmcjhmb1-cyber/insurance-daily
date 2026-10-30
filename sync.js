// 구글 로그인과 학습 기록 저장 (파이어베이스)
// 기록 위치: users/{로그인 고유번호}/months/{YYYY-MM} 문서의 r 안에 이슈별 기록
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, reauthenticateWithPopup, deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABEyX9keVUAUGK3eFjr4-D-Xm3vn9KH3U",
  authDomain: "insurance-daily-34b00.firebaseapp.com",
  projectId: "insurance-daily-34b00",
  storageBucket: "insurance-daily-34b00.firebasestorage.app",
  messagingSenderId: "823868780973",
  appId: "1:823868780973:web:4bc6002960db89a66db124"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

let user = null;
let pending = {};
let timer = null;
let syncState = "";
const bar = document.getElementById("authbar");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function localAll() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bi:")) { try { out[k.slice(3)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
    }
  } catch (e) {}
  return out;
}
function setLocal(id, rec) { try { localStorage.setItem("bi:" + id, JSON.stringify(rec)); } catch (e) {} }
function clearLocal() { try { Object.keys(localAll()).forEach(id => localStorage.removeItem("bi:" + id)); } catch (e) {} }
const monthOf = id => id.slice(0, 7);
const months = () => collection(db, "users", user.uid, "months");

async function flush() {
  if (!user) return;
  const batch = pending; pending = {};
  clearTimeout(timer); timer = null;
  const byMonth = {};
  for (const [id, rec] of Object.entries(batch)) (byMonth[monthOf(id)] ||= {})[id] = rec;
  try {
    for (const [m, recs] of Object.entries(byMonth)) await setDoc(doc(db, "users", user.uid, "months", m), { r: recs }, { merge: true });
    if (syncState === "error") { syncState = ""; render(); }
  } catch (e) {
    console.warn("기록 저장 실패", e);
    Object.assign(pending, batch, pending);
    syncState = "error"; render();
  }
}
function queue(id, rec) {
  pending[id] = rec;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

async function pull() {
  syncState = "loading"; render();
  try {
    const snap = await getDocs(months());
    const remote = {};
    snap.forEach(d => Object.assign(remote, (d.data() || {}).r || {}));
    const local = localAll();
    for (const id of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const r = remote[id], l = local[id];
      if (r && (!l || (r.t || 0) >= (l.t || 0))) setLocal(id, r);
      else if (l) queue(id, l);
    }
    await flush();
    syncState = "";
  } catch (e) {
    console.warn("기록 불러오기 실패", e);
    syncState = "error";
  }
  render();
  window.App && window.App.rerender();
}

async function login() {
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") { await signInWithRedirect(auth, provider); return; }
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") { syncState = "loginError"; render(); }
  }
}
async function logout() {
  await flush();
  await signOut(auth);
  clearLocal();
  window.App && window.App.rerender();
}
async function removeAll() {
  syncState = "deleting"; render();
  try {
    pending = {}; clearTimeout(timer);
    const snap = await getDocs(months());
    for (const d of snap.docs) await deleteDoc(d.ref);
    clearLocal();
    const u = user;
    try { await deleteUser(u); }
    catch (e) {
      if (e.code === "auth/requires-recent-login") {
        try { await reauthenticateWithPopup(u, provider); await deleteUser(u); }
        catch (e2) { syncState = "partial"; render(); window.App && window.App.rerender(); return; }
      } else throw e;
    }
    syncState = "deleted";
  } catch (e) {
    console.warn("삭제 실패", e);
    syncState = "deleteError";
  }
  render();
  window.App && window.App.rerender();
}

const NOTICE = `<details class="notice"><summary>무엇을 저장하나요?</summary>
  <ul>
    <li><b>저장하는 것:</b> 구글 계정의 고유 번호와 학습 기록(예측 답, 퀴즈 답, 완료 여부, 고른 방식, 직접 쓴 답)이에요. 로그인할 때 구글이 알려주는 이름과 이메일은 로그인 정보로만 남고, 학습 기록에는 넣지 않아요.</li>
    <li><b>목적:</b> 다른 기기에서 들어와도 공부한 기록을 이어 보기 위해서예요. 다른 용도로는 쓰지 않아요.</li>
    <li><b>보관 위치:</b> 서울에 있는 구글 서버(파이어베이스)예요. 다른 사용자는 내 기록을 볼 수 없어요.</li>
    <li><b>알아둘 점:</b> 사이트 운영자는 관리 화면에서 로그인한 사람의 이메일과 저장된 기록을 볼 수 있어요. 직접 쓰는 답에는 개인적인 내용을 적지 마세요.</li>
    <li><b>지우는 법:</b> 로그인한 뒤 "내 기록 지우기"를 누르면 저장된 기록과 로그인 정보가 모두 지워져요.</li>
  </ul></details>`;

function render() {
  if (!bar) return;
  if (!user) {
    const msg = syncState === "deleted" ? `<span class="ok">기록과 로그인 정보를 모두 지웠어요.</span>`
      : syncState === "loginError" ? `<span class="no">로그인하지 못했어요. 잠시 뒤 다시 눌러주세요.</span>`
      : `<span>로그인하면 어느 기기에서나 기록이 이어져요.</span>`;
    bar.innerHTML = `<div class="authrow">${msg}<button id="loginBtn" class="pri">구글로 로그인</button></div>${NOTICE}`;
    document.getElementById("loginBtn").onclick = login;
    return;
  }
  const name = esc(user.displayName || "로그인한 사용자");
  const stateMsg = syncState === "loading" ? "기록을 불러오는 중이에요"
    : syncState === "error" ? `<span class="no">기록을 저장하지 못했어요. 인터넷 연결을 확인해주세요.</span>`
    : syncState === "deleting" ? "기록을 지우는 중이에요"
    : syncState === "deleteError" ? `<span class="no">지우지 못했어요. 다시 시도해주세요.</span>`
    : syncState === "partial" ? `<span class="ok">학습 기록은 모두 지웠어요.</span> 로그인 정보까지 지우려면 "내 기록 지우기"를 한 번 더 눌러주세요`
    : "기록이 계정에 저장되고 있어요";
  bar.innerHTML = `<div class="authrow"><span><b>${name}</b>님 · ${stateMsg}</span>
    <span class="row"><button id="logoutBtn">로그아웃</button><button id="delBtn">내 기록 지우기</button></span></div>
    <div id="delAsk" hidden class="ask"><p>정말 지울까요? 이 계정에 저장된 학습 기록과 로그인 정보가 모두 지워지고, 되돌릴 수 없어요.</p>
    <span class="row"><button id="delYes" class="danger">모두 지우기</button><button id="delNo">취소</button></span></div>${NOTICE}`;
  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("delBtn").onclick = () => { document.getElementById("delAsk").hidden = false; };
  document.getElementById("delNo").onclick = () => { document.getElementById("delAsk").hidden = true; };
  document.getElementById("delYes").onclick = removeAll;
}

window.Sync = { push(id, rec) { if (user) queue(id, rec); } };
onAuthStateChanged(auth, u => {
  const was = user;
  user = u;
  if (u && (!was || was.uid !== u.uid)) { syncState = ""; pull(); }
  else render();
});
render();
