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

function render() { window.App && window.App.authChanged && window.App.authChanged(); }

window.Auth = {
  get user() { return user; },
  get state() { return syncState; },
  login, logout, removeAll
};
window.Sync = { push(id, rec) { if (user) queue(id, rec); } };
onAuthStateChanged(auth, u => {
  const was = user;
  user = u;
  if (u && (!was || was.uid !== u.uid)) { syncState = ""; pull(); }
  else render();
});
render();
