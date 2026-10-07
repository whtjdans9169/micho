'use strict';

// ============================================================
// Firebase 설정 (콘솔 → 프로젝트 설정 → 내 앱)
// ============================================================
const FIREBASE = {
  apiKey: 'AIzaSyC5scbJ2Bp3K63YKV5OCoxCneKLWeDHEj8',
  authDomain: 'micho-e90ca.firebaseapp.com',
  projectId: 'micho-e90ca',
  storageBucket: 'micho-e90ca.firebasestorage.app',
  messagingSenderId: '433492736438',
  appId: '1:433492736438:web:bca75ba32d8b3659912917',
};
const SDK = 'https://www.gstatic.com/firebasejs/12.9.0/';

// ============================================================
// 상수
// ============================================================
const TITLE = '정림24 건축사 스터디앱'; // 브라우저 탭 이름
// 모두가 함께 쓰는 설정 (board/settings). 통계 · 시험일 화면에서 누구나 바꿀 수 있다
const DEFAULT_SETTINGS = {
  examDate: '2027-03-13', // 시험일 (토)
  fine: 2000,             // 할 일을 안 적었거나 · 다 못 끝냈거나 · 인증샷이 없는 날의 벌금
  fineStart: '2026-10-10', // 벌금 계산 시작일
  banned: {},             // 관리자가 내보낸 멤버 { id: 닉네임 }
};
const ADMIN_NICK = 'MICHO'; // 관리자 (멤버 내보내기 · 되돌리기)
const BANNED_MSG = '관리자가 이 계정을 내보냈어요. 관리자에게 문의해주세요.';
const FEED_PAGE = 24; // 홈 인증샷을 한 번에 불러오는 개수
const DEFAULT_COLORS = ['#D97471', '#8E7CC3', '#EBC04A'];
const PALETTE = [
  '#D97471', '#E8896B', '#F08A5D', '#EBC04A', '#C9B458', '#8BC34A', '#6CC08B', '#1F9D66',
  '#4DB6AC', '#5DA9E9', '#3F7FD6', '#8E7CC3', '#B07CC6', '#E48AB4', '#B56576', '#4A5568',
];

// 출석: 1분 이상 공부한 날 / 달성: 그날 할 일을 100% 끝낸 날
const GRADES = [
  { name: '수련생', att: 0, ach: 0 },
  { name: 'D등급', att: 3, ach: 1 },
  { name: 'C등급', att: 7, ach: 3 },
  { name: 'B등급', att: 14, ach: 7 },
  { name: 'A등급', att: 30, ach: 15 },
  { name: 'S등급', att: 60, ach: 30 },
];

const SEED_QUOTES = [
  { text: '오늘 걷지 않으면 내일은 뛰어야 한다.', by: '' },
  { text: '합격은 매일 쌓은 시간의 합이다.', by: '' },
  { text: '천천히 가도 멈추지만 않으면 된다.', by: '' },
];

// 잔디 색 단계 [최소 시간(h), 배경, 글자]
const LEVELS = [
  [7, '#14532D', '#fff'],
  [5, '#1E7A4C', '#fff'],
  [3, '#3FA46F', '#fff'],
  [1, '#8FD3AC', '#14532D'],
  [0, '#D5F0E0', '#14532D'],
];

const NAV = [['home', 'fa-house', '홈'], ['todo', 'fa-square-check', '할 일'], ['stats', 'fa-chart-simple', '통계'], ['files', 'fa-folder-open', '자료'], ['me', 'fa-user', '나']];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const DAY = 86400000;
const AUTO_STOP = 10 * 3600000; // 타이머를 켜놓고 잊었을 때 자동으로 멈추는 시간
// 자료: Firebase Storage는 유료라서 파일을 900KB 조각으로 나눠 Firestore에 저장한다
const CHUNK = 900 * 1024;
const MAX_FILE = 10 * 1024 * 1024;
const INPUT = 'field w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-brand/50';

// ============================================================
// 유틸
// ============================================================
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 10);
const dkey = (d = logicalNow()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 하루의 시작: 새벽 4시. 늦게까지 공부해도 새벽 4시 전까지는 전날로 친다 (할 일 · 인증샷 · 공부 시간 · 벌금 모두)
const DAY_START_H = 4;
function logicalNow() { return new Date(Date.now() - DAY_START_H * 3600000); }
const dayKeyOf = (ts) => dkey(new Date(ts - DAY_START_H * 3600000));
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const monthOf = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

function fmtHMS(ms) {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 3600)}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}
function fmtHM(ms) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}
function fmtKo(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}시간 ${m}분` : `${m}분 ${s}초`;
}
function fmtClock(ts) {
  const d = new Date(ts), h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}
const fmtDate = (d) => `${d.getMonth() + 1}. ${d.getDate()} (${WD[d.getDay()]})`;
const fmtDateKo = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 사진을 줄인다: ratio(가로÷세로)를 주면 가운데를 그 비율로 자르고, 긴 쪽을 max에 맞춘다
function shrinkImage(file, max, ratio = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let [sw, sh] = [img.width, img.height];
      if (ratio) sw / sh > ratio ? (sw = sh * ratio) : (sh = sw / ratio);
      const [sx, sy] = [(img.width - sw) / 2, (img.height - sh) / 2];
      const scale = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement('canvas');
      c.width = Math.round(sw * scale);
      c.height = Math.round(sh * scale);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; // 투명한 PNG가 JPEG로 바뀔 때 검게 되지 않도록
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이 사진은 읽을 수 없어요. 다른 사진을 골라주세요.')); };
    img.src = url;
  });
}
// 저장소(무료 1GB)를 아끼려고 해상도는 두고 JPEG 압축을 높인다 (휴대폰 화면에서는 차이가 거의 없는 정도)
const QUALITY = 0.6;
const toJpeg = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));

function fmtSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
const fmtWhen = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${fmtClock(ts)}`; };

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'glass-strong fixed left-1/2 -translate-x-1/2 bottom-28 md:bottom-8 z-[60] px-5 py-3 rounded-full text-sm font-medium max-w-[90vw] text-center';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ============================================================
// Firebase
// ============================================================
let fb = null; // { a: auth SDK, f: firestore SDK, auth, db }

async function initFirebase() {
  const [appSdk, a, f] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js'),
  ]);
  const app = appSdk.initializeApp(FIREBASE);
  fb = { a, f, auth: a.getAuth(app), db: f.getFirestore(app) };
}

const docRef = (col, id) => fb.f.doc(fb.db, col, id);
// Firebase 로그인은 이메일이 필요해서, 닉네임으로 내부용 주소를 만든다 (메일은 보내지 않음)
const emailOf = async (nick) => (await sha256('micho:' + nick)).slice(0, 32) + '@micho.app';

function friendly(e) {
  return {
    'auth/email-already-in-use': '이미 있는 닉네임이에요.',
    'auth/invalid-credential': '닉네임 또는 비밀번호가 맞지 않아요.',
    'auth/invalid-login-credentials': '닉네임 또는 비밀번호가 맞지 않아요.',
    'auth/wrong-password': '닉네임 또는 비밀번호가 맞지 않아요.',
    'auth/user-not-found': '없는 닉네임이에요. "처음이에요"에서 가입해주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요.',
    'auth/network-request-failed': '인터넷 연결을 확인해주세요.',
    'permission-denied': 'Firebase 보안 규칙 때문에 막혔어요.',
    unavailable: '인터넷 연결을 확인해주세요.',
  }[e?.code] || '문제가 생겼어요: ' + (e?.code || e?.message || e);
}

async function loadProfiles() {
  const m = {};
  (await fb.f.getDocs(fb.f.collection(fb.db, 'users'))).forEach((d) => { m[d.id] = d.data(); });
  return m;
}
async function loadData(id) {
  const snap = await fb.f.getDoc(docRef('data', id));
  return snap.exists() ? snap.data() : null;
}
async function loadQuotes() {
  const snap = await fb.f.getDocs(fb.f.collection(fb.db, 'quotes'));
  return snap.docs.map((d) => d.data()).sort((a, b) => (a.at || 0) - (b.at || 0));
}

// ---------- 자료 (파일을 조각내서 files/{id}/chunks/{번호} 에 저장) ----------
const chunkRef = (id, i) => fb.f.doc(fb.db, 'files', id, 'chunks', String(i));

async function uploadFile(blob, meta, onProgress) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const id = fb.f.doc(fb.f.collection(fb.db, 'files')).id;
  const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK));
  for (let i = 0; i < chunks; i++) {
    await fb.f.setDoc(chunkRef(id, i), { data: fb.f.Bytes.fromUint8Array(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)) });
    onProgress((i + 1) / chunks);
  }
  // 조각을 다 올린 뒤에 목록에 보이도록 정보는 마지막에 저장
  await fb.f.setDoc(fb.f.doc(fb.db, 'files', id), { ...meta, size: bytes.length, chunks });
}
async function downloadFile(file) {
  const parts = await Promise.all([...Array(file.chunks)].map((_, i) => fb.f.getDoc(chunkRef(file.id, i))));
  return new Blob(parts.map((p) => p.data().data.toUint8Array()), { type: file.type });
}
async function deleteFile(file) {
  await fb.f.deleteDoc(fb.f.doc(fb.db, 'files', file.id));
  await Promise.all([...Array(file.chunks)].map((_, i) => fb.f.deleteDoc(chunkRef(file.id, i))));
}

// ---------- 인증샷 (하루에 한 장, id = 사용자_날짜) ----------
// 목록용 작은 사진은 proofs에, 크게 볼 사진은 proofPhotos에 따로 저장해서 목록을 가볍게 불러온다
// 인증한 날짜는 내 기록(D.proofDays)에도 적어서, 벌금 계산 때 모두의 인증샷 목록을 읽지 않아도 되게 한다
const photoCache = {};
async function saveProof(file) {
  const photo = (await shrinkImage(file, 1000, 0.8)).toDataURL('image/jpeg', QUALITY); // 인스타그램 4:5
  const thumb = (await shrinkImage(file, 300, 0.8)).toDataURL('image/jpeg', QUALITY);
  const id = `${me}_${today}`;
  await fb.f.setDoc(docRef('proofPhotos', id), { photo });
  await fb.f.setDoc(docRef('proofs', id), { uid: me, nick: myProfile().nick, date: today, at: Date.now(), thumb });
  photoCache[id] = Promise.resolve(photo);
  markProofDay(today, true);
}
async function deleteProof(id) {
  await fb.f.deleteDoc(docRef('proofs', id));
  await fb.f.deleteDoc(docRef('proofPhotos', id));
  delete photoCache[id];
  if (id.startsWith(me + '_')) markProofDay(id.slice(me.length + 1), false);
}
// 관리자가 다른 멤버의 인증샷을 지우면 그 멤버의 인증 날짜 기록에서도 뺀다
// (저장 순번을 올려서 그 멤버의 기기에도 바로 반영되게)
async function removeProofDay(uid, date) {
  const ref = docRef('data', uid), snap = await fb.f.getDoc(ref);
  const data = snap.data();
  if (!data?.proofDays?.includes(date)) return;
  await fb.f.updateDoc(ref, {
    proofDays: data.proofDays.filter((d) => d !== date),
    savedAt: Math.max(Date.now(), (data.savedAt || 0) + 1),
  });
}
function markProofDay(date, on) {
  const days = new Set(D.proofDays || []);
  if (days.has(date) === on) return;
  on ? days.add(date) : days.delete(date);
  D.proofDays = [...days].sort();
  save();
}
function proofPhoto(id) {
  return (photoCache[id] ||= fb.f.getDoc(docRef('proofPhotos', id)).then((s) => s.data()?.photo || ''));
}
// 화면의 작은 사진을 큰 사진으로 바꿔 끼운다
function hydrateProofs() {
  document.querySelectorAll('img[data-proof]').forEach((img) => {
    proofPhoto(img.dataset.proof).then((src) => { if (src) img.src = src; }).catch(() => {});
  });
}

// ---------- 모두의 기록 (벌금 현황 · 멤버 등급 계산용, 통계 · 나 화면을 열 때마다 새로 불러옴) ----------
async function loadEveryone(retry = true) {
  if (!me) return;
  try {
    const [p, snap] = await Promise.all([loadProfiles(), fb.f.getDocs(fb.f.collection(fb.db, 'data'))]);
    profiles = { ...p, [me]: { ...p[me], ...myProfile() } };
    allData = {};
    snap.forEach((d) => { allData[d.id] = d.data(); });
  } catch (e) {
    // 앱을 오래 켜뒀다가 다시 열면 로그인 확인이 갱신되기 전 잠깐 막힐 수 있어서, 한 번 더 시도한다
    if (retry) { setTimeout(() => loadEveryone(false), 1500); return; }
    if (me) toast('모두의 기록을 불러오지 못했어요 · ' + friendly(e));
    return;
  }
  // 실명은 관리자만 불러온다 (보안 규칙으로도 관리자만 읽기 허용). 실패해도 나머지 화면은 그대로 보여준다
  if (isAdmin()) {
    try {
      const rn = await fb.f.getDocs(fb.f.collection(fb.db, 'realnames'));
      realNames = Object.fromEntries(rn.docs.map((d) => [d.id, d.data().name]));
    } catch (e) {
      console.warn('실명 목록을 불러오지 못했어요', e);
    }
  }
  if (['home', 'stats', 'me'].includes(ui.view)) refreshView();
}

// ============================================================
// 상태
// ============================================================
let ready = false;     // Firebase 준비 완료
let me = null;         // 로그인한 사용자 id
let D = null;          // 내 공부 기록 · 할 일
let profiles = {};     // id → { nick, goal, motto, photo }
let quoteList = [];    // 사용자들이 등록한 명언
let settings = { ...DEFAULT_SETTINGS }; // 시험일 · 벌금 (모두 공유)
let notice = null;     // 홈 공지 { text, by, at }
let files = [];        // 자료 목록 (최신순)
let pending = [];      // 게시하려고 고른 파일들
let proofs = [];       // 홈 인증샷 피드 (최신순)
let myProofs = [];     // 내 인증샷 (최신순)
let allData = null;    // 벌금 계산용 모두의 기록 (통계 화면을 열 때 불러옴)
let realNames = {};    // id → 실명 (관리자에게만 채워짐)
let todayProofs = [];  // 오늘 올라온 인증샷 (오늘의 인증 현황)
let todayOff = null;   // 오늘 인증샷 구독 해제 (자정이 지나면 새 날짜로 다시 구독)
let unwatch = [];      // 실시간 구독 해제 함수들
let feedOff = null;    // 인증샷 피드 구독 해제 (더 보기로 개수가 바뀌면 다시 구독)
let today = dkey();
const ui = {
  view: 'home',
  todoDate: today,
  statMode: 'day',
  statMonth: monthOf(logicalNow()),
  statDay: today,
  statWeek: mondayOf(logicalNow()),
  fileFilter: 'all',
  teamView: 'all', // 관리자가 고른 팀 보기 (all · JUNG · LIM)
  feedLimit: FEED_PAGE,
  quote: null,
  paletteFor: null,
  authMode: 'login',
  authError: '',
  lastNick: '',
  fatal: '',
};

const myProfile = () => profiles[me] || { nick: ui.lastNick, goal: '', motto: '', photo: '' };
const isAdmin = () => myProfile().nick === ADMIN_NICK;
// 내보낸 멤버(banned)와 완전 삭제한 멤버(removed)는 들어올 수 없다
const isBanned = (id) => !!settings.banned?.[id] || !!settings.removed?.[id];
// 내보낸 멤버를 뺀 명단 (멤버 목록 · 벌금 현황에 쓰임. 인증샷 피드와 오늘 이미 한 인증은 남긴다)
const activeMembers = () => Object.entries(profiles).filter(([id]) => !isBanned(id));

// ---------- 팀 (관리자가 board/settings.teams 에 배정, 예: { uid: 'JUNG' }) ----------
// 인증샷 · 벌금 · 저금통은 같은 팀끼리만, 자료 · 멤버 명단 · 오늘의 인증 · 공지 · 명언은 모두에게
// 미배정 멤버는 모두를 보고 모두에게 보인다 (팀을 나누기 전에는 지금처럼 다 함께)
const TEAMS = ['JUNG', 'LIM'];
const teamOf = (id) => settings.teams?.[id] || '';
const myTeam = () => teamOf(me);
function inMyScope(id) {
  if (isAdmin()) return ui.teamView === 'all' || teamOf(id) === ui.teamView; // 관리자는 골라서 본다
  return !myTeam() || !teamOf(id) || teamOf(id) === myTeam();
}
const teamLabel = (t) => (t ? `${t}팀` : '미배정');
function teamBadge(id) {
  const t = teamOf(id);
  return t ? `<span class="px-1.5 py-px rounded-md text-[10px] font-bold ${t === 'JUNG' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}">${t}</span>` : '';
}
// 관리자용 팀 보기 선택 (전체 · 정 팀 · 림 팀)
function teamPicker() {
  if (!isAdmin()) return myTeam() ? `<span class="text-xs text-gray-500">${teamLabel(myTeam())} 기준</span>` : '';
  return `<div class="glass rounded-full p-0.5 inline-flex text-xs">${[['all', '전체'], ...TEAMS.map((t) => [t, teamLabel(t)])].map(([k, l]) => `
    <button data-action="teamview" data-team="${k}" class="px-3 py-1 rounded-full font-semibold ${ui.teamView === k ? 'btn' : 'text-gray-600'}">${l}</button>`).join('')}</div>`;
}
function allQuotes() {
  const seen = new Set();
  return [...SEED_QUOTES, ...quoteList].filter((q) => q?.text && !seen.has(q.text) && seen.add(q.text));
}
function pickQuote(prev) {
  const q = allQuotes();
  if (q.length < 2) return q[0] || null;
  let x;
  do { x = q[Math.floor(Math.random() * q.length)]; } while (prev && x.text === prev.text);
  return x;
}
function newData() {
  return {
    subjects: DEFAULT_COLORS.map((color, i) => ({ id: uid(), name: `${i + 1}교시`, color })),
    sessions: [], // { sid, s, e, d } — 날짜(d)별로 잘라서 저장
    todos: {},    // { 'YYYY-MM-DD': [{ id, text, done }] }
    running: null, // { sid, s }
    proofDays: [], // 인증샷을 올린 날짜들
    passes: [],    // 패스권을 쓴 날짜들 (일주일에 PASS_PER_WEEK번)
    goalHours: 0,  // 하루 목표 공부 시간 (0이면 설정 안 함)
  };
}
function save() {
  // 저장 순번: 지금까지 본 것보다 항상 크게 (기기마다 시계가 조금 달라도 순서가 꼬이지 않게)
  D.savedAt = Math.max(Date.now(), (D.savedAt || 0) + 1);
  return fb.f.setDoc(docRef('data', me), JSON.parse(JSON.stringify(D))).catch((e) => toast('저장하지 못했어요 · ' + friendly(e)));
}
async function updateProfile(patch, doneMsg) {
  profiles[me] = { ...myProfile(), ...patch };
  render();
  try {
    await fb.f.setDoc(docRef('users', me), patch, { merge: true });
    if (doneMsg) toast(doneMsg);
  } catch (e) {
    toast('저장하지 못했어요 · ' + friendly(e));
  }
}

// ============================================================
// 공부 기록 계산
// ============================================================
// 하루가 바뀌는 시각(새벽 4시)을 넘는 구간을 날짜별로 나눈다
function splitRange(s, e) {
  const out = [];
  while (s < e) {
    const d = dayKeyOf(s);
    const end = Math.min(e, addDays(parseKey(d), 1).getTime() + DAY_START_H * 3600000);
    out.push({ s, e: end, d });
    s = end;
  }
  return out;
}
function commitRunning(end = Date.now()) {
  if (!D.running) return;
  const { sid, s } = D.running;
  for (const p of splitRange(s, end)) if (p.e - p.s >= 1000) D.sessions.push({ sid, ...p });
  D.running = null;
}
function allSessions() {
  if (!D.running) return D.sessions;
  return D.sessions.concat(splitRange(D.running.s, Date.now()).map((p) => ({ sid: D.running.sid, ...p })));
}
const sessionsOn = (key) => allSessions().filter((x) => x.d === key);
const sumMs = (list) => list.reduce((a, x) => a + x.e - x.s, 0);
function totalsByDay() {
  const m = {};
  for (const x of allSessions()) m[x.d] = (m[x.d] || 0) + x.e - x.s;
  return m;
}
function bySubject(list) {
  const m = {};
  for (const x of list) m[x.sid] = (m[x.sid] || 0) + x.e - x.s;
  return m;
}

const todosOn = (key) => D.todos[key] || [];
function todoStats(key) {
  const t = todosOn(key), done = t.filter((x) => x.done).length;
  return { done, total: t.length, pct: t.length ? Math.round((done / t.length) * 100) : 0 };
}
const isAchieved = (key, todos = D.todos) => { const t = todos[key] || []; return t.length > 0 && t.every((x) => x.done); };

// 등급: 내 것은 지금 켜진 타이머까지, 다른 멤버는 저장된 기록으로 계산
function gradeInfo(data = D) {
  const totals = data === D ? totalsByDay() : (data.sessions || []).reduce((m, x) => { m[x.d] = (m[x.d] || 0) + x.e - x.s; return m; }, {});
  const todos = data.todos || {};
  const att = Object.values(totals).filter((v) => v >= 60000).length;
  const ach = Object.keys(todos).filter((k) => isAchieved(k, todos)).length;
  let i = 0;
  GRADES.forEach((g, j) => { if (att >= g.att && ach >= g.ach) i = j; });
  return { att, ach, grade: GRADES[i], next: GRADES[i + 1] || null };
}

// D-Day 목록 (각자 따로). 공유 시험일은 id 'exam' 자리표시로 들어 있고, 날짜는 모두의 설정에서 가져온다
// 맨 윗줄이 홈 화면 D-Day
const EXAM_ID = 'exam';
function ddayList() {
  const list = D.ddays?.length ? D.ddays : [{ id: EXAM_ID }];
  const withExam = list.some((x) => x.id === EXAM_ID) ? list : [...list, { id: EXAM_ID }];
  return withExam.map((x) => (x.id === EXAM_ID ? { id: EXAM_ID, name: '건축사 시험', date: settings.examDate, shared: true } : x));
}
// 저장할 때는 공유 시험일의 이름 · 날짜는 빼고 자리만 남긴다
const saveDdays = (list) => { D.ddays = list.map((x) => (x.shared ? { id: EXAM_ID } : { id: x.id, name: x.name, date: x.date })); save(); };
function ddayText(date) {
  const diff = Math.round((parseKey(date) - parseKey(today)) / DAY);
  return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${-diff}`;
}
const ddayLabel = () => ddayText(ddayList()[0].date);

// 벌금: 시작일(또는 가입일)부터 어제까지, 할 일을 안 적었거나 · 다 못 끝냈거나 · 인증샷이 없는 날마다 부과
// 본인이 금액을 고치면 그 차이(fineAdjust)를 프로필에 저장해서, 이후 벌금은 그 위에 계속 더해진다
// from ~ to(그날은 빼고) 사이만 센다. 기본은 처음부터 어제까지 (주간 결산은 지난주 월~일)
function fineBase(id, from = '', to = today) {
  const p = profiles[id] || {};
  const data = (id === me ? D : allData[id]) || {};
  const todos = data.todos || {}, proofDays = new Set(data.proofDays || []);
  const joined = p.createdAt ? dayKeyOf(p.createdAt) : settings.fineStart;
  const start = [joined, settings.fineStart, from].sort().pop(); // 셋 중 가장 늦은 날부터
  let missed = 0;
  for (let d = parseKey(start); dkey(d) < to; d = addDays(d, 1)) {
    const key = dkey(d), list = todos[key] || [];
    if (isExempt(id, key)) continue; // 관리자가 정한 면제일
    if ((data.passes || []).includes(key)) continue; // 본인이 쓴 패스권
    if (!list.length || list.some((t) => !t.done) || !proofDays.has(key)) missed++;
  }
  return { missed, base: missed * settings.fine };
}

// 벌금 면제일: settings.exempt = { 'YYYY-MM-DD': { all: true, uids: { uid: true }, reason } } (관리자가 지정)
const isExempt = (id, key) => { const x = settings.exempt?.[key]; return !!x && (x.all || !!x.uids?.[id]); };
function exemptList() {
  return Object.entries(settings.exempt || {}).sort(([a], [b]) => b.localeCompare(a)).map(([date, x]) => ({
    date, reason: x.reason || '',
    who: x.all ? '전체' : Object.keys(x.uids || {}).map((u) => profiles[u]?.nick || '탈퇴한 멤버').join(', '),
  }));
}
function fineBoard() {
  if (!allData) return null;
  return activeMembers().filter(([id]) => inMyScope(id)).map(([id, p]) => {
    const { missed, base } = fineBase(id);
    const adjust = p.fineAdjust || 0;
    return { id, nick: p.nick || '이름 없음', photo: p.photo, missed, edited: !!adjust, amount: Math.max(0, base + adjust) };
  }).sort((a, b) => b.amount - a.amount || a.nick.localeCompare(b.nick));
}
const won = (n) => n.toLocaleString('ko-KR') + '원';

// 팀별 벌금 합계 (모두에게 공개: 팀끼리 자극이 되도록). week 면 지난주 월~일 결산만
const thisMonday = () => dkey(mondayOf(parseKey(today)));
const lastMonday = () => dkey(addDays(mondayOf(parseKey(today)), -7));
function teamFines(week = false) {
  if (!allData) return null;
  const groups = [...TEAMS, ''].map((t) => ({ team: t, total: 0, people: [] }));
  for (const [id, p] of activeMembers()) {
    const g = groups.find((x) => x.team === teamOf(id));
    const { missed, base } = week ? fineBase(id, lastMonday(), thisMonday()) : fineBase(id);
    const amount = week ? base : Math.max(0, base + (p.fineAdjust || 0));
    g.total += amount;
    g.people.push({ id, nick: p.nick || '', missed, amount });
  }
  return groups.filter((g) => g.team || g.people.length); // 미배정은 사람이 있을 때만
}

// ============================================================
// 로그인 흐름
// ============================================================
async function enter(id) {
  const [p, data, q, s] = await Promise.all([loadProfiles(), loadData(id), loadQuotes(), fb.f.getDoc(docRef('board', 'settings'))]);
  settings = { ...DEFAULT_SETTINGS, ...s.data() };
  // 관리자가 내보낸 계정은 들어올 수 없다
  if (isBanned(id)) {
    await fb.a.signOut(fb.auth);
    return authFail(BANNED_MSG);
  }
  me = id;
  profiles = p;
  quoteList = q;
  allData = null;
  D = Object.assign(newData(), data);
  if (!data) save();
  // 가입 중 프로필 저장이 실패했던 계정도 닉네임이 남도록
  if (!profiles[me]) updateProfile({ nick: ui.lastNick || '나', goal: '', motto: '', photo: '', createdAt: Date.now() });
  stopWatching();
  const { f } = fb;
  const ignore = () => {}; // 읽기가 막혀도 앱은 계속 동작
  unwatch = [
    // 다른 기기(폰 ↔ PC)에서 바꾼 내용을 바로 반영
    f.onSnapshot(docRef('data', id), (snap) => {
      const remote = snap.data();
      // 내가 이미 가진 것보다 새로운 저장(다른 기기)만 반영. 늦게 도착한 옛날 데이터나 내 저장의 메아리는 무시
      if (!remote || (remote.savedAt || 0) <= (D.savedAt || 0)) return;
      D = Object.assign(newData(), remote);
      refreshView();
    }),
    // 누가 공지 · 시험일 · 자료 · 인증샷을 바꾸면 모두의 화면에 바로 반영
    f.onSnapshot(docRef('board', 'notice'), (snap) => { notice = snap.data() || null; refreshView(); }, ignore),
    f.onSnapshot(docRef('board', 'settings'), (snap) => {
      settings = { ...DEFAULT_SETTINGS, ...snap.data() };
      if (isBanned(me)) return kickedOut(); // 쓰는 중에 내보내지면 바로 로그아웃
      refreshView();
    }, ignore),
    f.onSnapshot(f.collection(fb.db, 'files'), (snap) => {
      files = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at);
      refreshView();
    }, ignore),
    f.onSnapshot(f.query(f.collection(fb.db, 'proofs'), f.where('uid', '==', id)), (snap) => {
      myProofs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at);
      // 내 인증 날짜 기록을 실제 인증샷과 맞춘다 (예전에 올린 것 채우기 · 관리자가 지운 것 빼기)
      // 기기에 저장된 옛 목록(fromCache)으로는 판단하지 않는다
      if (!snap.metadata.fromCache) {
        const want = [...new Set(myProofs.map((x) => x.date))].sort();
        if (want.join() !== (D.proofDays || []).join()) {
          D.proofDays = want;
          save();
        }
      }
      refreshView();
    }, ignore),
  ];
  ui.feedLimit = FEED_PAGE;
  watchFeed();
  watchToday();
  Object.assign(ui, { authError: '', authMode: 'login', view: 'home', paletteFor: null, quote: pickQuote() });
  render();
  loadEveryone(); // 홈 저금통에 쓸 모두의 벌금
  askRealName();
}

// 실명이 아직 없으면 (예전에 가입한 멤버 · 관리자 포함) 한 번 적어달라고 한다
async function askRealName() {
  try {
    const snap = await fb.f.getDoc(docRef('realnames', me));
    if (!snap.exists()) realNameModal();
  } catch {}
}
const saveRealName = (name) => fb.f.setDoc(docRef('realnames', me), { name, nick: myProfile().nick, at: Date.now() });

function watchFeed() {
  feedOff?.();
  const { f } = fb;
  feedOff = f.onSnapshot(f.query(f.collection(fb.db, 'proofs'), f.orderBy('at', 'desc'), f.limit(ui.feedLimit)), (snap) => {
    proofs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshView();
  }, () => {});
}
// 오늘 올라온 인증샷만 (오늘의 인증 현황). 날짜가 바뀌면 다시 부른다
function watchToday() {
  todayOff?.();
  const { f } = fb;
  todayOff = f.onSnapshot(f.query(f.collection(fb.db, 'proofs'), f.where('date', '==', today)), (snap) => {
    todayProofs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshView();
  }, () => {});
}
async function kickedOut() {
  stopWatching();
  await fb.a.signOut(fb.auth);
  me = D = null;
  profiles = {};
  $('#modal').innerHTML = '';
  authFail(BANNED_MSG);
}
function stopWatching() {
  unwatch.forEach((off) => off());
  unwatch = [];
  feedOff?.();
  feedOff = null;
  todayOff?.();
  todayOff = null;
}
// 실시간 변경이 들어오면 화면을 다시 그린다 (입력 중이거나 창이 열려 있으면 나중에)
function refreshView() {
  const typing = document.activeElement?.matches('input, textarea');
  if (me && D && !$('#modal').innerHTML && !typing) render();
}

async function onAuth(form) {
  const f = new FormData(form);
  const nick = String(f.get('nick') || '').trim();
  const pw = String(f.get('pw') || '');
  const signup = ui.authMode === 'signup';
  ui.lastNick = nick;
  if (!nick) return authFail('닉네임을 입력해주세요.');
  const realName = String(f.get('real') || '').trim();
  if (signup && !realName) return authFail('실명을 입력해주세요. 관리자만 볼 수 있어요.');
  const btn = form.querySelector('[data-submit]');
  btn.disabled = true;
  btn.textContent = '잠시만요…';
  try {
    const { a, f: fs, auth } = fb;
    await a.setPersistence(auth, f.get('remember') ? a.browserLocalPersistence : a.browserSessionPersistence);
    const email = await emailOf(nick);
    let user;
    if (signup) {
      user = (await a.createUserWithEmailAndPassword(auth, email, pw)).user;
      const goal = String(f.get('goal') || '').trim();
      const motto = String(f.get('motto') || '').trim();
      await fs.setDoc(docRef('users', user.uid), { nick, goal, motto, photo: '', createdAt: Date.now() });
      // 실명은 닉네임과 따로, 관리자만 읽을 수 있는 곳에 저장
      if (realName) await fs.setDoc(docRef('realnames', user.uid), { name: realName, nick, at: Date.now() });
      // 첫 로그인 시 좌우명을 모두의 명언에 등록
      if (motto) await fs.addDoc(fs.collection(fb.db, 'quotes'), { text: motto, by: nick, uid: user.uid, at: Date.now() });
    } else {
      user = (await a.signInWithEmailAndPassword(auth, email, pw)).user;
    }
    await enter(user.uid);
  } catch (e) {
    authFail(friendly(e));
  }
}
function authFail(msg) { ui.authError = msg; render(); }

async function logout() {
  if (!confirm('로그아웃할까요?')) return;
  commitRunning();
  await save();
  stopWatching();
  await fb.a.signOut(fb.auth);
  me = D = null;
  profiles = {};
  ui.lastNick = '';
  render();
}

// ============================================================
// 화면
// ============================================================
function render() {
  const app = $('#app');
  if (ui.fatal) app.innerHTML = fatalView();
  else if (!ready) app.innerHTML = loadingView();
  else if (!me) app.innerHTML = loginView();
  else {
    const views = { home: homeView, todo: todoView, stats: statsView, files: filesView, me: profileView };
    app.innerHTML = `
      ${navView()}
      <main class="md:pl-64">
        <div class="mx-auto max-w-6xl px-4 md:px-8 pt-5 md:pt-8 pb-32 md:pb-12">${views[ui.view]()}</div>
      </main>`;
    updateLive();
    hydrateProofs();
    mountSortables();
  }
}

function go(view) {
  if (view === 'todo') ui.todoDate = today;
  if (['home', 'stats', 'me'].includes(view)) loadEveryone(); // 저금통 · 벌금 · 멤버 등급을 최신 기록으로 다시 계산
  ui.view = view;
  render();
  window.scrollTo(0, 0);
}

const pageTitle = (title, right = '') => `
  <div class="mb-5 flex items-center justify-between gap-3">
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight">${title}</h1>${right}
  </div>`;

// 사진 위에 올리는 프로필 (프로필이 아직 없으면 인증샷에 적힌 닉네임으로)
const whoOf = (item) => profiles[item.uid] || { nick: item.nick };

function avatar(p, size) {
  return p?.photo
    ? `<img src="${esc(p.photo)}" alt="" class="${size} rounded-full object-cover shrink-0">`
    : `<div class="${size} btn rounded-full grid place-items-center font-bold shrink-0">${esc((p?.nick || '?')[0])}</div>`;
}

const loadingView = () => `
  <div class="min-h-screen grid place-items-center text-brand"><i class="fa-solid fa-spinner fa-spin text-3xl"></i></div>`;

const fatalView = () => `
  <div class="min-h-screen grid place-items-center px-6">
    <div class="glass rounded-[2rem] p-8 max-w-sm text-center">
      <i class="fa-solid fa-triangle-exclamation text-3xl text-brand"></i>
      <p class="mt-4 font-semibold">서버에 연결하지 못했어요</p>
      <p class="mt-2 text-sm text-gray-600">${esc(ui.fatal)}</p>
      <button onclick="location.reload()" class="btn mt-6 px-5 py-2.5 rounded-2xl font-semibold">다시 시도</button>
    </div>
  </div>`;

// ---------- 하단 탭 (모바일) · 사이드바 (아이패드 · 데스크탑) ----------
function navView() {
  const u = myProfile();
  const item = ([v, icon, label]) => {
    const on = ui.view === v;
    const photo = v === 'me' && u.photo;
    return `
      <button data-action="go" data-view="${v}" class="flex-1 md:flex-none flex flex-col md:flex-row items-center gap-0.5 md:gap-3 py-2 md:py-3 md:px-4 rounded-full md:rounded-2xl transition ${on ? 'bg-white/85 text-brand-dark shadow-sm' : 'text-gray-500 hover:bg-white/40'}">
        ${photo ? `<img src="${esc(u.photo)}" alt="" class="w-5 h-5 rounded-full object-cover">` : `<i class="fa-solid ${icon} text-lg md:w-5"></i>`}
        <span class="text-[11px] md:text-[15px] font-medium">${label}</span>
      </button>`;
  };
  return `
  <nav class="nav fixed z-30 inset-x-4 md:inset-x-auto md:left-4 md:top-4 md:w-56">
    <div class="glass rounded-full md:rounded-[1.75rem] p-1.5 md:p-3 flex md:flex-col gap-1 md:h-full">
      <div class="hidden md:flex items-center gap-2.5 px-3 pt-2 pb-5">
        <img src="logo.png" alt="" class="w-10 h-10 drop-shadow-md">
        <span class="text-lg font-bold">동기들과스터디</span>
      </div>
      ${NAV.map(item).join('')}
      <div class="hidden md:flex mt-auto items-center gap-3 p-2">
        ${avatar(u, 'w-10 h-10')}
        <div class="min-w-0">
          <div class="font-semibold truncate">${esc(u.nick)}</div>
          <div class="text-xs text-brand-dark">${gradeInfo().grade.name}</div>
        </div>
      </div>
      <button data-action="logout" class="hidden md:flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm text-gray-500 hover:bg-white/40">
        <i class="fa-solid fa-right-from-bracket md:w-5"></i>로그아웃
      </button>
    </div>
  </nav>`;
}

// ---------- 로그인 ----------
function loginView() {
  const signup = ui.authMode === 'signup';
  const tab = (m, l) => `<button type="button" data-action="authmode" data-mode="${m}" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${ui.authMode === m ? 'bg-white shadow-sm' : 'text-gray-500'}">${l}</button>`;
  const field = (name, label, type, ph, extra = '') => `
    <label class="block">
      <span class="text-sm font-medium text-gray-600">${label}</span>
      <input name="${name}" type="${type}" placeholder="${ph}" ${extra} class="mt-1.5 ${INPUT}">
    </label>`;
  return `
  <div class="min-h-screen grid place-items-center px-4 py-10">
    <div class="w-full max-w-md">
      <div class="text-center mb-7">
        <img src="logo.png" alt="동기들과스터디" class="mx-auto w-20 h-20 drop-shadow-xl">
        <h1 class="mt-5 text-3xl font-bold tracking-tight">건축사 시험 스터디 플래너</h1>
        <p class="mt-2 text-gray-600">매일의 공부 시간을 기록하고 합격까지 함께 달려요</p>
      </div>
      <form data-form="auth" class="glass rounded-[2rem] p-6 md:p-8 space-y-4">
        <div class="flex p-1 rounded-2xl bg-white/40">${tab('login', '로그인')}${tab('signup', '처음이에요')}</div>
        ${field('nick', '닉네임', 'text', '닉네임', `required maxlength="20" autocomplete="username" value="${esc(ui.lastNick)}"`)}
        ${field('pw', '비밀번호', 'password', signup ? '6자 이상' : '비밀번호', `required ${signup ? 'minlength="6"' : ''} autocomplete="${signup ? 'new-password' : 'current-password'}"`)}
        ${signup ? field('real', '실명 <span class="text-red-500">*</span> <span class="text-xs font-normal text-gray-500">· 필수</span>', 'text', '예) 홍길동', 'required maxlength="20" autocomplete="name"') + `
          <p class="-mt-1 px-3 py-2.5 rounded-xl bg-white/50 text-xs text-gray-600 leading-relaxed">
            <i class="fa-solid fa-lock text-brand mr-1"></i>멤버들의 이름은 <b>닉네임으로만</b> 보여져요!<br>실명은 <b>관리자만</b> 알 수 있습니다!
          </p>` : ''}
        ${signup ? field('goal', '시험 전 나의 목표', 'text', '예) 올해 3과목 모두 합격!', 'maxlength="60"') + field('motto', '나의 명언 / 좌우명', 'text', '예) 오늘 걷지 않으면 내일은 뛰어야 한다', 'maxlength="80"') : ''}
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="remember" checked class="w-4 h-4 accent-[#1F9D66]">계정 기억하기
        </label>
        ${ui.authError ? `<p class="text-sm text-red-500">${esc(ui.authError)}</p>` : ''}
        <button data-submit class="btn w-full py-3.5 rounded-2xl font-semibold text-lg">${signup ? '시작하기' : '로그인'}</button>
      </form>
    </div>
  </div>`;
}

// ---------- 홈 (공지 · 저금통 · 타이머) ----------
// 저금통: 1명당 금액으로 먹을 수 있는 메뉴 [최소 금액, 이모지, 메뉴, 동사(기본 '먹을')]
const MENUS = [
  [80000, '🍾', '호텔 뷔페'],
  [50000, '🦞', '랍스터'],
  [35000, '🥩', '소고기'],
  [25000, '🥓', '삼겹살'],
  [20000, '🍣', '초밥'],
  [16000, '🍗', '치킨'],
  [13000, '🍕', '피자'],
  [10000, '🍔', '수제버거'],
  [8000, '🍜', '라멘'],
  [5000, '🍢', '떡볶이'],
  [3000, '☕', '커피', '마실'],
  [1, '🍦', '아이스크림'],
];
// 받침이 있으면 '을', 없으면 '를'
const eulReul = (word) => { const c = word.charCodeAt(word.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 ? '을' : '를'; };

function piggyBank() {
  const rows = fineBoard();
  const body = (() => {
    if (!rows) return '<p class="mt-2 text-sm text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i>불러오는 중…</p>';
    const total = rows.reduce((a, r) => a + r.amount, 0), per = rows.length ? Math.floor(total / rows.length) : 0;
    const menu = MENUS.find(([min]) => per >= min);
    return `
      <div class="mt-1 flex items-baseline gap-2 flex-wrap">
        <span class="text-3xl font-bold tabular-nums">${won(total)}</span>
        <span class="text-sm text-gray-500">${rows.length}명 · 1명당 ${won(per)}</span>
      </div>
      <p class="mt-2 font-medium">${menu
        ? `${menu[1]} 축하해요! <b class="text-brand">${menu[2]}</b>${eulReul(menu[2])} ${menu[3] || '먹을'} 수 있어요!`
        : '아직 저금통이 비어 있어요. 모두 열심히 하고 있다는 뜻! 💪'}</p>`;
  })();
  return `
  <section class="glass rounded-3xl p-4 md:p-5 mb-4 lg:mb-6 flex gap-3">
    <div class="w-10 h-10 shrink-0 rounded-2xl bg-pink-100 grid place-items-center text-xl">🐷</div>
    <div class="flex-1 min-w-0">
      <h2 class="text-sm font-semibold text-gray-600 flex items-center gap-2 flex-wrap"><span>${!isAdmin() && myTeam() ? `${teamLabel(myTeam())} ` : ''}저금통 <span class="font-normal text-gray-500">· 모인 벌금</span></span> ${isAdmin() ? teamPicker() : ''}</h2>
      ${body}
      ${teamRace()}
    </div>
  </section>`;
}
// 저금통 아래: JUNG팀 vs LIM팀 전체 벌금 비교 (팀이 배정된 뒤에만)
function teamRace() {
  const groups = teamFines();
  if (!groups || !Object.keys(settings.teams || {}).length) return '';
  const teams = groups.filter((g) => g.team);
  const max = Math.max(1, ...teams.map((g) => g.total));
  const color = (t) => (t === 'JUNG' ? 'bg-emerald-500' : 'bg-sky-500');
  return `
  <div class="mt-3 pt-3 border-t border-white/80 space-y-2">
    <p class="text-xs font-semibold text-gray-600">팀별 저금통 <span class="font-normal text-gray-500">· 적을수록 잘하고 있어요!</span></p>
    ${teams.map((g) => `
    <div class="flex items-center gap-2 text-sm">
      <span class="w-14 shrink-0 font-semibold">${teamLabel(g.team)}</span>
      <div class="flex-1 h-2.5 rounded-full bg-white/70 overflow-hidden"><div class="h-full rounded-full ${color(g.team)}" style="width:${Math.round((g.total / max) * 100)}%"></div></div>
      <span class="w-20 shrink-0 text-right font-bold tabular-nums">${won(g.total)}</span>
    </div>`).join('')}
  </div>`;
}
function noticeBanner() {
  return `
  <button data-action="notice" class="glass w-full rounded-3xl p-4 md:p-5 mb-4 lg:mb-6 flex items-start gap-3 text-left">
    <div class="btn w-10 h-10 shrink-0 rounded-2xl grid place-items-center"><i class="fa-solid fa-bullhorn"></i></div>
    <div class="flex-1 min-w-0 ${notice ? '' : 'self-center'}">
      ${notice
        ? `<p class="font-medium whitespace-pre-line break-words line-clamp-3">${esc(notice.text)}</p>
           <p class="mt-1 text-xs text-gray-500">${esc(notice.by)} · ${fmtWhen(notice.at)}</p>`
        : '<p class="text-gray-500">공지가 없어요. 눌러서 스터디원들에게 공지를 남겨보세요.</p>'}
    </div>
    <i class="fa-solid fa-pen text-gray-400 self-center"></i>
  </button>`;
}

function homeView() {
  const ts = todoStats(today), q = ui.quote;
  return `
  ${eveningReminder()}
  ${noticeBanner()}
  ${piggyBank()}
  <div class="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-5">
    <section class="glass-hero rounded-[2rem] p-6 md:p-8 lg:col-span-3 flex flex-col lg:min-h-[440px]">
      <div class="flex items-center justify-between">
        <button data-action="ddaylist" class="chip px-3.5 py-1 rounded-2xl text-left leading-tight max-w-[40%]" aria-label="D-Day 목록">
          <span class="block text-[10px] text-white/80 truncate">${esc(ddayList()[0].name)}</span>
          <span class="block text-sm font-semibold">${ddayLabel()}</span>
        </button>
        <div class="text-lg font-medium">${fmtDate(parseKey(today))}</div>
        <button data-action="subjects" class="chip w-10 h-10 rounded-full grid place-items-center" aria-label="과목 편집"><i class="fa-solid fa-palette"></i></button>
      </div>
      <div class="flex-1 flex flex-col justify-center py-10 text-center">
        <div class="text-sm text-white/80">오늘 공부한 시간</div>
        <div class="mt-1 text-6xl md:text-7xl font-semibold tabular-nums tracking-tight" data-live="total">0:00:00</div>
        <div class="mt-3 text-sm text-white/85" data-live="current"></div>
        <button data-action="goal" class="chip mt-5 self-center inline-flex items-center gap-2.5 pl-2 pr-4 py-1.5 rounded-full text-sm font-medium" aria-label="하루 목표 공부 시간">
          <svg viewBox="0 0 36 36" class="w-7 h-7 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="4"></circle>
            <circle data-live="goalring" cx="18" cy="18" r="15" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="94.25"></circle>
          </svg>
          <span data-live="goaltext">하루 목표 정하기</span>
        </button>
      </div>
      ${q ? `<button data-action="quote" class="chip rounded-2xl px-4 py-3 text-sm leading-relaxed">“${esc(q.text)}”${q.by ? `<span class="text-white/70"> · ${esc(q.by)}</span>` : ''}</button>` : ''}
    </section>
    <div class="lg:col-span-2 space-y-4">
      <button data-action="go" data-view="todo" class="glass w-full rounded-3xl p-5 text-left">
        <div class="flex justify-between text-sm">
          <span class="font-semibold">오늘의 할 일</span>
          <span class="text-gray-500">${ts.done}/${ts.total} · <b class="text-brand">${ts.pct}%</b></span>
        </div>
        <div class="mt-3 h-2.5 rounded-full bg-white/70 overflow-hidden"><div class="btn h-full rounded-full transition-all" style="width:${ts.pct}%"></div></div>
      </button>
      <section class="glass rounded-3xl p-2">
        <ul>${D.subjects.map(subjectRow).join('')}</ul>
        ${D.subjects.length ? '' : '<p class="py-8 text-center text-gray-500">과목을 추가해주세요</p>'}
        <button data-action="subjects" class="w-full mt-1 py-3 rounded-2xl text-sm text-gray-600 hover:bg-white/50"><i class="fa-solid fa-pen mr-1.5"></i>과목 편집</button>
      </section>
    </div>
  </div>
  ${todayStatus()}
  ${weeklyReport()}
  ${proofFeed()}`;
}

// 저녁 알림: 밤 9시부터 하루가 끝나는 새벽 4시까지, 오늘 빠진 것이 있으면 홈 맨 위에 알려준다
function missingToday() {
  const list = todosOn(today), out = [];
  if (!list.length) out.push('할 일 적기');
  else if (list.some((t) => !t.done)) out.push(`남은 할 일 ${list.filter((t) => !t.done).length}개`);
  if (!myProofs.some((p) => p.date === today)) out.push('인증샷');
  return isExempt(me, today) || usedPass(today) ? [] : out;
}
function eveningReminder() {
  const h = new Date().getHours();
  const missing = missingToday();
  if (!(h >= 21 || h < DAY_START_H) || !missing.length || today < settings.fineStart) return '';
  return `
  <button data-action="go" data-view="todo" class="w-full mb-4 lg:mb-6 p-4 rounded-3xl text-left flex items-center gap-3 bg-amber-100/90 text-amber-900 shadow-sm">
    <span class="text-2xl">⏰</span>
    <span class="flex-1 min-w-0">
      <span class="block font-bold">오늘이 ${h < DAY_START_H ? '곧' : `${24 - h + DAY_START_H}시간 안에`} 끝나요!</span>
      <span class="block text-sm">아직 ${missing.join(' · ')}이 남았어요 · 새벽 ${DAY_START_H}시가 지나면 벌금 ${won(settings.fine)}</span>
    </span>
    <i class="fa-solid fa-chevron-right"></i>
  </button>`;
}

// 팀 주간 리포트: 지난주(월~일) 우리 팀의 인증률과 최다 인증 멤버. 개인 공부 시간은 보여주지 않는다
function weeklyReport() {
  if (!allData) return '';
  const start = addDays(mondayOf(parseKey(today)), -7);
  const days = [...Array(7)].map((_, i) => dkey(addDays(start, i)));
  const members = activeMembers().filter(([id]) => inMyScope(id));
  if (!members.length) return '';
  const counts = members.map(([id, p]) => {
    const pd = new Set(((id === me ? D : allData[id]) || {}).proofDays || []);
    return { id, nick: p.nick || '', n: days.filter((d) => pd.has(d)).length };
  });
  const total = counts.reduce((a, c) => a + c.n, 0);
  const rate = Math.round((total / (members.length * 7)) * 100);
  const best = Math.max(...counts.map((c) => c.n));
  const top = best ? counts.filter((c) => c.n === best).map((c) => c.nick) : [];
  const scope = isAdmin() ? (ui.teamView === 'all' ? '전체' : teamLabel(ui.teamView)) : (myTeam() ? teamLabel(myTeam()) : '우리 스터디');
  const end = parseKey(days[6]);
  return `
  <section class="glass rounded-3xl p-4 md:p-5 mt-4 lg:mt-6">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h2 class="font-bold">📈 지난주 ${esc(scope)} 리포트</h2>
      <span class="text-xs text-gray-500">${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}</span>
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2 text-center">
      <div class="rounded-2xl bg-white/50 p-3"><div class="text-xs text-gray-500">인증률</div><div class="mt-1 text-2xl font-bold text-brand tabular-nums">${rate}%</div></div>
      <div class="rounded-2xl bg-white/50 p-3"><div class="text-xs text-gray-500">인증샷</div><div class="mt-1 text-2xl font-bold tabular-nums">${total}<span class="text-sm font-medium text-gray-500">장</span></div></div>
      <div class="rounded-2xl bg-white/50 p-3"><div class="text-xs text-gray-500">인원</div><div class="mt-1 text-2xl font-bold tabular-nums">${members.length}<span class="text-sm font-medium text-gray-500">명</span></div></div>
    </div>
    <p class="mt-3 text-sm">${top.length ? `🏆 최다 인증 <b>${top.map(esc).join(', ')}</b> · ${best}일` : '지난주에는 인증샷이 없었어요. 이번 주는 함께 달려봐요!'}</p>
  </section>`;
}

// 오늘의 인증 현황: 인증한 멤버는 초록 테두리, 아직인 멤버는 흐리게
// 내보낸 멤버는 빼되, 오늘 이미 인증했다면 그 기록은 남긴다
function todayStatus() {
  const done = new Set(todayProofs.map((p) => p.uid));
  const members = Object.entries(profiles)
    .filter(([id]) => !isBanned(id) || done.has(id))
    .sort(([a], [b]) => done.has(b) - done.has(a));
  const count = members.filter(([id]) => done.has(id)).length;
  return `
  <section class="glass rounded-3xl p-4 md:p-5 mt-4 lg:mt-6">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-bold">오늘의 인증 <span class="text-brand">${count}</span><span class="text-gray-500 font-medium">/${members.length}명</span></h2>
      <span class="text-xs text-gray-500">${count && count === members.length ? '모두 인증 완료! 🎉' : '아직인 멤버도 화이팅!'}</span>
    </div>
    <div class="mt-3 flex flex-wrap gap-x-3 gap-y-3 pb-1">${members.map(([id, p]) => {
      const ok = done.has(id);
      const pass = !ok && ((id === me ? D : allData?.[id])?.passes || []).includes(today); // 오늘 패스권을 쓴 멤버
      // 닉네임은 줄이지 않고 전부 보여준다 (칸 너비가 닉네임에 맞춰 늘어나고, 넘치면 다음 줄로)
      return `
      <div class="min-w-[3.5rem] flex flex-col items-center">
        <div class="relative">
          ${avatar(p, `w-12 h-12 text-sm ${ok ? 'ring-2 ring-brand ring-offset-2 ring-offset-transparent' : pass ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent' : 'opacity-40 grayscale'}`)}
          ${ok ? '<span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full btn grid place-items-center text-[10px]"><i class="fa-solid fa-check"></i></span>' : ''}
          ${pass ? '<span class="absolute -bottom-1 -right-1 text-base" title="오늘 패스">🎫</span>' : ''}
        </div>
        <span class="mt-1.5 text-center text-[11px] whitespace-nowrap ${ok ? 'font-semibold' : 'text-gray-500'}">${esc(p.nick || '')}</span>
        ${teamOf(id) ? `<span class="mt-0.5">${teamBadge(id)}</span>` : ''}
      </div>`;
    }).join('')}
    </div>
  </section>`;
}

// 인증샷 응원 반응 (누가 눌렀는지 reacts.{종류}.{id} 에 기록)
const REACTS = [['fire', '🔥'], ['clap', '👏'], ['heart', '❤️']];
function reactBar(p, onPhoto) {
  return REACTS.map(([key, emoji]) => {
    const who = p.reacts?.[key] || {}, n = Object.keys(who).length, mine = !!who[me];
    const tone = onPhoto
      ? (mine ? 'bg-white text-gray-900' : 'bg-black/30 text-white')
      : (mine ? 'btn' : 'bg-white/70');
    return `<button data-action="react" data-id="${p.id}" data-r="${key}" class="px-2 h-8 rounded-full text-sm backdrop-blur ${tone}" aria-label="${emoji} 반응">${emoji}${n ? ` <span class="text-xs font-semibold">${n}</span>` : ''}</button>`;
  }).join('');
}

// 모두의 인증샷: 인스타그램 게시물 비율(4:5), 왼쪽 아래에 올린 사람, 오른쪽 아래에 응원 반응
function proofFeed() {
  const shown = proofs.filter((p) => inMyScope(p.uid)); // 같은 팀 것만 (내보낸 멤버의 인증샷도 기록으로 남긴다)
  const card = (p) => {
    const who = whoOf(p);
    return `
    <div class="glass relative rounded-3xl overflow-hidden">
      <button data-action="openproof" data-id="${p.id}" class="block w-full"><img data-proof="${p.id}" src="${p.thumb}" alt="" loading="lazy" class="w-full aspect-[4/5] object-cover"></button>
      <div class="absolute inset-x-0 bottom-0 p-3 pt-12 flex items-end gap-2.5 text-white bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
        ${avatar(who, 'w-9 h-9 text-sm ring-2 ring-white/80')}
        <div class="min-w-0 flex-1">
          <div class="font-semibold truncate">${esc(who.nick)}</div>
          <div class="text-xs text-white/80">${fmtDateKo(parseKey(p.date))}</div>
        </div>
        <div class="flex gap-1 pointer-events-auto">${reactBar(p, true)}</div>
      </div>
    </div>`;
  };
  return `
  <section class="mt-6 lg:mt-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold flex items-center gap-2 flex-wrap">📸 인증샷 ${teamPicker()}</h2>
      <button data-action="go" data-view="todo" class="text-sm font-semibold text-brand">나도 인증하기 <i class="fa-solid fa-chevron-right text-xs"></i></button>
    </div>
    ${shown.length
      ? `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${shown.map(card).join('')}</div>
         ${proofs.length >= ui.feedLimit ? '<button data-action="feedmore" class="glass mt-4 w-full py-3 rounded-2xl text-gray-600">더 보기</button>' : ''}`
      : '<div class="glass rounded-3xl p-8 text-center text-gray-500">아직 인증샷이 없어요. 할 일을 끝내고 첫 인증샷을 올려보세요!</div>'}
  </section>`;
}

function subjectRow(s) {
  const on = D.running?.sid === s.id;
  return `
  <li class="flex items-center gap-4 p-3 rounded-2xl transition ${on ? 'bg-white/75 shadow-sm' : ''}">
    <button data-action="toggle" data-id="${s.id}" class="orb ${on ? 'on' : ''} w-12 h-12 shrink-0 rounded-full grid place-items-center text-white text-lg" style="background-color:${s.color};--c:${s.color}" aria-label="${on ? '일시정지' : '시작'}">
      <i class="fa-solid ${on ? 'fa-pause' : 'fa-play ml-0.5'}"></i>
    </button>
    <span class="flex-1 text-lg font-medium truncate">${esc(s.name)}</span>
    <span class="text-lg tabular-nums" data-live="sub" data-id="${s.id}">0:00:00</span>
    <button data-action="subjects" data-id="${s.id}" class="w-7 text-gray-400" aria-label="과목 편집 · 색 바꾸기"><i class="fa-solid fa-ellipsis-vertical"></i></button>
  </li>`;
}

function toggleSubject(id) {
  const wasOn = D.running?.sid === id;
  commitRunning();
  if (!wasOn) D.running = { sid: id, s: Date.now() };
  save();
  render();
}

function updateLive() {
  if (!me || !D) return;
  // 자정이 지나면 '오늘' 기준을 새 날짜로 바꾼다
  if (dkey() !== today) {
    if (ui.todoDate === today) ui.todoDate = dkey();
    if (ui.statDay === today) ui.statDay = dkey();
    today = dkey();
    watchToday();
    render();
    return;
  }
  // 한 번에 AUTO_STOP을 넘기면 켜놓고 잊은 것으로 보고 거기까지만 기록한다
  if (D.running && Date.now() - D.running.s > AUTO_STOP) {
    commitRunning(D.running.s + AUTO_STOP);
    save();
    render();
    toast(`${AUTO_STOP / 3600000}시간 넘게 켜져 있어서 타이머를 자동으로 멈췄어요`);
    return;
  }
  const list = sessionsOn(today);
  const goal = (D.goalHours || 0) * 3600000, pct = goal ? Math.min(1, sumMs(list) / goal) : 0;
  document.querySelectorAll('[data-live]').forEach((el) => {
    const t = el.dataset.live;
    if (t === 'total') el.textContent = fmtHMS(sumMs(list));
    else if (t === 'goalring') el.setAttribute('stroke-dashoffset', String(94.25 * (1 - pct)));
    else if (t === 'goaltext') el.textContent = !goal ? '하루 목표 정하기' : pct >= 1 ? `목표 ${D.goalHours}시간 달성! 🎉` : `목표 ${D.goalHours}시간 · ${Math.floor(pct * 100)}%`;
    else if (t === 'sub') el.textContent = fmtHMS(sumMs(list.filter((x) => x.sid === el.dataset.id)));
    else if (t === 'current') {
      const s = D.running && D.subjects.find((x) => x.id === D.running.sid);
      el.textContent = D.running ? `${s ? s.name : ''} 집중 중 · ${fmtKo(Date.now() - D.running.s)}` : '과목의 ▶ 버튼을 눌러 공부를 시작하세요';
    }
  });
  document.title = D.running ? `${fmtHMS(sumMs(list))} · ${TITLE}` : TITLE;
}

// ---------- 할 일 ----------
const isLocked = (key) => key < today; // 지난 날의 할 일은 고칠 수 없다 (벌금을 공정하게)

// ---------- 패스권: 한 주(월~일)에 PASS_PER_WEEK번, 그날은 벌금 없음 ----------
const PASS_PER_WEEK = 2;
const usedPass = (key) => (D.passes || []).includes(key);
// 그 날짜가 속한 주에 쓴 패스 날짜들
function passesInWeek(key) {
  const mon = dkey(mondayOf(parseKey(key))), sun = dkey(addDays(mondayOf(parseKey(key)), 6));
  return (D.passes || []).filter((d) => d >= mon && d <= sun).sort();
}
function passBanner(key) {
  const used = passesInWeek(key), left = PASS_PER_WEEK - used.length, on = usedPass(key), locked = isLocked(key);
  const dots = [...Array(PASS_PER_WEEK)].map((_, i) => `<span class="w-2.5 h-2.5 rounded-full ${i < used.length ? 'bg-amber-400' : 'bg-white/80 ring-1 ring-gray-300'}"></span>`).join('');
  if (on) {
    return `
    <div class="mt-4 rounded-3xl p-5 text-center bg-amber-100/90 text-amber-900">
      <div class="text-3xl">🎫</div>
      <div class="mt-1 text-lg font-bold">${key === today ? '오늘은' : '이날은'} 패스!</div>
      <div class="text-sm">할 일 · 인증샷이 없어도 벌금이 붙지 않아요 · 이번 주 ${used.length}/${PASS_PER_WEEK}</div>
      ${locked ? '' : '<button data-action="passoff" class="mt-3 px-4 py-2 rounded-full bg-white/80 text-sm font-semibold">패스 취소</button>'}
    </div>`;
  }
  if (locked) return '';
  return `
  <div class="glass mt-4 rounded-3xl p-3 pl-4 flex items-center gap-3">
    <span class="text-2xl">🎫</span>
    <div class="flex-1 min-w-0">
      <div class="font-semibold">패스권 <span class="text-sm font-normal text-gray-500">이번 주 ${left}장 남음</span></div>
      <div class="mt-1 flex gap-1.5">${dots}</div>
      <p class="mt-1.5 text-xs text-gray-500 leading-relaxed">야근하거나, 오늘 너무 피곤할 때 쓰는 카드<br>일주일(월~일)에 ${PASS_PER_WEEK}번만 쓸 수 있어요</p>
    </div>
    <button data-action="passon" ${left ? '' : 'disabled'} class="px-4 py-2 rounded-full text-sm font-semibold ${left ? 'btn' : 'bg-white/60 text-gray-400'}">${key === today ? '오늘' : '이날'} 패스 쓰기</button>
  </div>`;
}

function todoView() {
  const key = ui.todoDate, list = todosOn(key), s = todoStats(key), locked = isLocked(key);
  const arrow = (delta, icon, label) => `<button data-action="tododay" data-delta="${delta}" class="glass w-11 h-11 rounded-full grid place-items-center text-gray-600" aria-label="${label}"><i class="fa-solid ${icon}"></i></button>`;
  return `
  <div class="mx-auto max-w-2xl">
    <div class="mb-5 flex items-center justify-between">
      ${arrow(-1, 'fa-chevron-left', '이전 날')}
      <div class="text-center">
        <div class="text-xl md:text-2xl font-bold">${fmtDateKo(parseKey(key))}</div>
        ${key === today ? '<div class="text-xs text-brand font-semibold">오늘</div>' : '<button data-action="todotoday" class="text-xs text-gray-500 underline">오늘로</button>'}
      </div>
      ${arrow(1, 'fa-chevron-right', '다음 날')}
    </div>
    <section class="glass-hero rounded-[2rem] p-6">
      <div class="flex items-end justify-between">
        <div><div class="text-sm text-white/80">달성률</div><div class="text-5xl font-bold tabular-nums">${s.pct}%</div></div>
        <div class="text-sm text-white/85">${s.done} / ${s.total} 완료</div>
      </div>
      <div class="mt-5 h-3 rounded-full bg-white/25 overflow-hidden"><div class="h-full rounded-full bg-white transition-all duration-500" style="width:${s.pct}%"></div></div>
    </section>
    ${passBanner(key)}
    ${usedPass(key) ? '' : proofBanner(key)}
    ${locked
      ? '<p class="mt-4 px-4 py-3 rounded-2xl bg-white/50 text-sm text-gray-500"><i class="fa-solid fa-lock mr-1.5"></i>지난 날의 할 일은 고칠 수 없어요</p>'
      : `<form data-form="todoadd" class="mt-4 flex gap-2">
          <input name="text" required maxlength="100" autocomplete="off" placeholder="할 일을 입력하세요" class="${INPUT} flex-1 min-w-0">
          <button class="btn px-5 rounded-2xl" aria-label="추가"><i class="fa-solid fa-plus"></i></button>
        </form>`}
    <section class="glass rounded-3xl mt-4 px-4 ${list.length ? '' : 'hidden'}">
      <ul class="divide-y divide-white/70">${list.map((t) => `
        <li class="flex items-center gap-3 py-4">
          <button data-action="todotoggle" data-id="${t.id}" ${locked ? 'disabled' : ''} class="w-6 h-6 shrink-0 rounded-lg border-2 grid place-items-center ${t.done ? 'btn border-transparent' : 'border-gray-300 bg-white/60'}" aria-label="완료 체크">${t.done ? '<i class="fa-solid fa-check text-xs"></i>' : ''}</button>
          <span class="flex-1 break-all ${t.done ? 'line-through text-gray-400' : ''}">${esc(t.text)}</span>
          ${locked ? '' : `<button data-action="tododel" data-id="${t.id}" class="w-7 text-gray-400 hover:text-red-500" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>`}
        </li>`).join('')}
      </ul>
    </section>
    ${list.length ? '' : '<p class="py-12 text-center text-gray-500">아직 할 일이 없어요</p>'}
    ${myProofs.length ? `
    <section class="mt-8">
      <h3 class="mb-3 text-lg font-bold">나의 인증샷 <span class="text-sm font-normal text-gray-500">${myProofs.length}</span></h3>
      <div class="grid grid-cols-3 gap-2">${myProofs.map((p) => `
        <button data-action="openproof" data-id="${p.id}" class="relative rounded-xl overflow-hidden">
          <img src="${p.thumb}" alt="" loading="lazy" class="w-full aspect-[4/5] object-cover">
          <span class="absolute left-1.5 bottom-1.5 px-1.5 rounded-md bg-black/45 text-white text-[11px]">${parseKey(p.date).getMonth() + 1}/${parseKey(p.date).getDate()}</span>
        </button>`).join('')}
      </div>
    </section>` : ''}
  </div>`;
}

// 가운데 카메라 배너: 오늘은 찍고, 지난 날은 그날 올린 인증샷을 보여준다
function proofBanner(key) {
  const mine = myProofs.find((p) => p.date === key);
  // 카메라로 바로 찍기(capture) 또는 사진 보관함에서 고르기
  const pick = (camera, cls, label) => `
    <label class="${cls} cursor-pointer">
      <input type="file" accept="image/*" ${camera ? 'capture="environment"' : ''} data-input="proof" class="hidden">${label}
    </label>`;
  if (mine) {
    const small = 'px-3.5 py-2 rounded-full bg-white/80 text-sm font-semibold text-center whitespace-nowrap';
    return `
    <div class="glass mt-4 rounded-3xl p-3 flex items-center gap-4">
      <button data-action="openproof" data-id="${mine.id}" class="shrink-0"><img src="${mine.thumb}" alt="" class="w-20 aspect-[4/5] rounded-2xl object-cover"></button>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-brand"><i class="fa-solid fa-circle-check mr-1"></i>인증 완료</div>
        <div class="mt-0.5 text-sm text-gray-500 whitespace-nowrap">${fmtClock(mine.at)}</div>
      </div>
      ${key === today ? `
      <div class="flex flex-col gap-1.5">
        ${pick(true, small, '<i class="fa-solid fa-camera mr-1"></i>다시 찍기')}
        ${pick(false, small, '<i class="fa-regular fa-image mr-1"></i>앨범')}
      </div>` : ''}
    </div>`;
  }
  if (key !== today) return `<div class="glass mt-4 rounded-3xl p-4 text-center text-sm text-gray-500"><i class="fa-solid fa-camera mr-1.5"></i>${key > today ? '그날이 되면 인증샷을 올릴 수 있어요' : '이날은 인증샷이 없어요'}</div>`;
  const big = 'flex-1 py-3 rounded-2xl font-semibold text-center';
  return `
  <div class="glass mt-4 rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
    <span class="btn w-16 h-16 rounded-full grid place-items-center text-2xl"><i class="fa-solid fa-camera"></i></span>
    <span>
      <span class="block text-lg font-bold">오늘의 인증샷</span>
      <span class="block mt-0.5 text-sm text-gray-500">할 일을 다 끝냈다면 사진으로 인증해요</span>
    </span>
    <div class="mt-1 w-full flex gap-2">
      ${pick(true, `btn ${big}`, '<i class="fa-solid fa-camera mr-1.5"></i>사진 찍기')}
      ${pick(false, `bg-white/80 ${big}`, '<i class="fa-regular fa-image mr-1.5"></i>앨범에서 고르기')}
    </div>
  </div>`;
}

// ---------- 통계 ----------
const CARD = 'glass rounded-3xl p-5 md:p-6 min-w-0';
const summ = (label, value) => `<div><div class="text-xs text-gray-500">${label}</div><div class="mt-1 text-lg font-bold tabular-nums">${value}</div></div>`;

function statsView() {
  const tabs = [['day', '일간'], ['week', '주간'], ['month', '월간']].map(([k, l]) => `
    <button data-action="statmode" data-mode="${k}" class="px-5 py-2 rounded-full text-sm font-semibold transition ${ui.statMode === k ? 'btn' : 'text-gray-600'}">${l}</button>`).join('');
  const totals = totalsByDay();
  const [left, right] = ui.statMode === 'week'
    ? weekStats(totals)
    : [monthGrid(totals), ui.statMode === 'day' ? dayStats() : monthStats(totals)];
  return `
    ${pageTitle('통계', `<div class="glass rounded-full p-1 flex">${tabs}</div>`)}
    <div class="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-2 lg:items-start">
      <div>${left}</div>
      <div class="space-y-4">${right}</div>
    </div>
    ${fineCard()}
    ${weekFineCard()}`;
}

// 지난주(월~일) 벌금 결산 → 이번 주 월요일에 일괄로 걷는다. 팀별 합계는 모두에게, 사람별 금액은 볼 수 있는 팀만
function weekFineCard() {
  const groups = teamFines(true);
  if (!groups) return '';
  const mon = parseKey(lastMonday()), sun = addDays(mon, 6), pay = parseKey(thisMonday());
  const total = groups.reduce((a, g) => a + g.total, 0);
  return `
  <section class="${CARD} mt-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h2 class="text-lg font-bold"><i class="fa-solid fa-wallet text-brand mr-1.5"></i>이번 주에 걷을 벌금</h2>
      <span class="text-xs text-gray-500">지난주 결산 · ${mon.getMonth() + 1}/${mon.getDate()}(월) – ${sun.getMonth() + 1}/${sun.getDate()}(일)</span>
    </div>
    <p class="mt-1 text-xs text-gray-500">지난주 벌금을 결산했어요 · <b>${pay.getMonth() + 1}/${pay.getDate()}(월)</b>에 일괄로 걷어요</p>
    <div class="mt-4 grid gap-3 ${groups.length > 1 ? 'sm:grid-cols-2' : ''}">${groups.map((g) => {
      const visible = g.people.filter((x) => inMyScope(x.id) && x.amount);
      return `
      <div class="rounded-2xl bg-white/50 p-4">
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-semibold">${teamLabel(g.team)} <span class="text-xs font-normal text-gray-500">${g.people.length}명</span></span>
          <span class="text-xl font-bold tabular-nums ${g.total ? '' : 'text-brand'}">${won(g.total)}</span>
        </div>
        ${visible.length ? `<ul class="mt-2 space-y-1 text-sm">${visible.map((x) => `
          <li class="flex justify-between gap-2"><span class="truncate">${esc(x.nick)}${x.id === me ? ' <span class="text-xs text-gray-500">나</span>' : ''}</span><span class="tabular-nums text-gray-600 whitespace-nowrap">${x.missed}일 · ${won(x.amount)}</span></li>`).join('')}
        </ul>` : `<p class="mt-2 text-xs text-gray-500">${g.total ? '다른 팀의 사람별 금액은 볼 수 없어요' : '지난주에는 벌금이 없었어요 👏'}</p>`}
      </div>`;
    }).join('')}
    </div>
    <p class="mt-3 text-right text-sm text-gray-600">걷을 금액 합계 <b class="text-brand">${won(total)}</b></p>
  </section>`;
}

// 모두에게 보이는 벌금 순위 (공부 시간 같은 통계는 위쪽에 나만 보인다)
function fineCard() {
  const rows = fineBoard();
  const total = rows ? rows.reduce((a, r) => a + r.amount, 0) : 0;
  return `
  <section class="${CARD} mt-4 lg:mt-6">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-bold flex items-center gap-2 flex-wrap"><span><i class="fa-solid fa-coins text-brand mr-1.5"></i>벌금 현황</span> ${teamPicker()}</h2>
      ${isAdmin() ? `
      <div class="flex gap-3 shrink-0">
        <button data-action="exempt" class="text-sm text-gray-500"><i class="fa-solid fa-umbrella-beach mr-1"></i>면제일</button>
        <button data-action="finesettings" class="text-sm text-gray-500"><i class="fa-solid fa-gear mr-1"></i>설정</button>
      </div>` : ''}
    </div>
    <p class="mt-1 text-xs text-gray-500 leading-relaxed">
      할 일을 안 적었거나, 다 끝내지 못했거나, 인증샷이 없는 날마다 ${won(settings.fine)} · ${fmtDateKo(parseKey(settings.fineStart))}부터 · 하루는 새벽 ${DAY_START_H}시에 끝나요 (그 전까지는 전날)
    </p>
    ${exemptList().length ? `<p class="mt-1.5 text-xs text-gray-600"><i class="fa-solid fa-umbrella-beach text-brand mr-1"></i>면제일: ${exemptList().slice(0, 4).map((x) => `${parseKey(x.date).getMonth() + 1}/${parseKey(x.date).getDate()}${x.reason ? ` ${esc(x.reason)}` : ''}${x.who === '전체' ? '' : ` (${esc(x.who)})`}`).join(' · ')}${exemptList().length > 4 ? ' 외' : ''}</p>` : ''}
    ${rows ? `
      <ol class="mt-4 space-y-2">${rows.map((r, i) => `
        <li class="flex items-center gap-3 p-2.5 rounded-2xl ${r.id === me ? 'bg-white/85 shadow-sm' : 'bg-white/40'}">
          <span class="w-6 text-center font-bold ${r.amount && i < 3 ? 'text-brand' : 'text-gray-400'}">${i + 1}</span>
          ${avatar(r, 'w-9 h-9 text-sm')}
          <span class="flex-1 min-w-0">
            <span class="block font-medium truncate">${esc(r.nick)}${r.id === me ? ' <span class="text-xs text-gray-500">나</span>' : ''}</span>
            <span class="block text-xs text-gray-500">벌금 ${r.missed}일${r.edited ? ' · 수정됨' : ''}</span>
          </span>
          <span class="text-right font-bold tabular-nums whitespace-nowrap">${won(r.amount)}</span>
          ${r.id === me
            ? `<button data-action="myfine" class="w-7 text-gray-400" aria-label="내 벌금 수정"><i class="fa-solid fa-pen text-sm"></i></button>`
            : '<span class="w-7"></span>'}
        </li>`).join('')}
      </ol>
      <p class="mt-3 text-right text-sm text-gray-600">총 벌금 <b class="text-brand">${won(total)}</b></p>`
    : '<p class="mt-4 py-4 text-center text-sm text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i>불러오는 중…</p>'}
  </section>`;
}

function levelOf(ms) {
  if (!ms || ms < 60000) return null;
  return LEVELS.find(([min]) => ms / 3600000 >= min);
}

function monthGrid(totals) {
  const m = ui.statMonth, y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), start = mondayOf(first);
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + new Date(y, mo + 1, 0).getDate()) / 7);
  let cells = '', monthMs = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), k = dkey(d), inMonth = d.getMonth() === mo, ms = totals[k] || 0;
    if (inMonth) monthMs += ms;
    const lv = inMonth ? levelOf(ms) : null;
    const selected = ui.statMode === 'day' && k === ui.statDay;
    cells += `
      <button data-action="statday" data-key="${k}" class="h-14 md:h-16 rounded-xl flex flex-col items-center pt-1.5 gap-0.5 transition hover:bg-white/60 ${selected ? 'ring-2 ring-brand-dark' : ''}" style="${lv ? `background:${lv[1]};color:${lv[2]}` : ''}">
        <span class="text-sm w-7 h-6 grid place-items-center rounded-lg ${k === today ? 'bg-gray-900 text-white' : ''} ${inMonth ? '' : 'text-gray-300'}">${d.getDate()}</span>
        ${lv ? `<span class="text-[11px] tabular-nums">${fmtHM(ms)}</span>` : ''}
      </button>`;
  }
  const legend = [...LEVELS].reverse().map(([h, bg, fg]) => `<span class="px-1.5 py-0.5" style="background:${bg};color:${fg}">${h}+</span>`).join('');
  return `
  <section class="${CARD}">
    <div class="flex items-center gap-4 px-1">
      <button data-action="statmonth" data-delta="-1" class="w-7 text-gray-500" aria-label="이전 달"><i class="fa-solid fa-caret-left"></i></button>
      <span class="text-xl font-bold">${y === new Date().getFullYear() ? '' : y + '년 '}${mo + 1}월</span>
      <button data-action="statmonth" data-delta="1" class="w-7 text-gray-500" aria-label="다음 달"><i class="fa-solid fa-caret-right"></i></button>
    </div>
    <div class="mt-3 grid grid-cols-7 text-center text-sm text-gray-500">${['월', '화', '수', '목', '금', '토', '일'].map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="mt-1 grid grid-cols-7 gap-1">${cells}</div>
    <div class="mt-4 flex items-center justify-between text-xs">
      <div class="flex rounded-md overflow-hidden">${legend}</div>
      <span class="text-gray-600">${mo + 1}월: ${fmtHM(monthMs)}</span>
    </div>
  </section>`;
}

function dayStats() {
  const k = ui.statDay, list = sessionsOn(k), ts = todoStats(k);
  const max = list.reduce((a, x) => Math.max(a, x.e - x.s), 0);
  const start = list.length ? Math.min(...list.map((x) => x.s)) : null;
  const end = list.length ? Math.max(...list.map((x) => x.e)) : null;
  const cell = (label, value) => `<div><div class="text-brand font-semibold text-sm">${label}</div><div class="mt-1 text-2xl font-semibold tabular-nums">${value}</div></div>`;
  return `
  <section class="${CARD}">
    <h2 class="text-center text-lg font-semibold">${fmtDateKo(parseKey(k))}</h2>
    <div class="mt-5 grid grid-cols-2 gap-y-6 text-center">
      ${cell('총 공부 시간', fmtHMS(sumMs(list)))}
      ${cell('최대 집중 시간', fmtHMS(max))}
      ${cell('시작시간', start ? fmtClock(start) : '-')}
      ${cell('종료시간', end ? (D.running && k === today ? '진행 중' : fmtClock(end)) : '-')}
    </div>
    <div class="mt-6 pt-5 border-t border-white/80 flex justify-between text-sm">
      <span class="text-gray-500">할 일 달성률</span>
      <span class="font-semibold">${ts.done}/${ts.total} · ${ts.pct}%</span>
    </div>
  </section>
  ${subjectBreakdown(list)}`;
}

function weekStats(totals) {
  const ws = ui.statWeek, days = [...Array(7)].map((_, i) => addDays(ws, i));
  const vals = days.map((d) => totals[dkey(d)] || 0);
  const sum = vals.reduce((a, b) => a + b, 0), max = Math.max(3600000, ...vals);
  const keys = new Set(days.map(dkey));
  const bars = days.map((d, i) => {
    const k = dkey(d);
    return `
      <button data-action="statday" data-key="${k}" class="flex-1 flex flex-col items-center gap-1.5">
        <span class="text-[11px] text-gray-500 tabular-nums h-4">${vals[i] >= 60000 ? fmtHM(vals[i]) : ''}</span>
        <div class="w-full max-w-[32px] h-40 bg-white/60 rounded-xl flex items-end overflow-hidden"><div class="btn w-full rounded-xl" style="height:${Math.round((vals[i] / max) * 100)}%"></div></div>
        <span class="text-xs ${k === today ? 'font-bold text-brand' : 'text-gray-500'}">${WD[d.getDay()]}</span>
      </button>`;
  }).join('');
  const end = days[6];
  const left = `
  <section class="${CARD}">
    <div class="flex items-center justify-between">
      <button data-action="statweek" data-delta="-1" class="w-8 text-gray-500" aria-label="이전 주"><i class="fa-solid fa-caret-left"></i></button>
      <span class="font-bold">${ws.getMonth() + 1}.${ws.getDate()} – ${end.getMonth() + 1}.${end.getDate()}</span>
      <button data-action="statweek" data-delta="1" class="w-8 text-gray-500" aria-label="다음 주"><i class="fa-solid fa-caret-right"></i></button>
    </div>
    <div class="mt-5 flex gap-2 items-end">${bars}</div>
    <div class="mt-6 grid grid-cols-3 text-center">${summ('주간 합계', fmtHM(sum))}${summ('일 평균', fmtHM(sum / 7))}${summ('출석', vals.filter((v) => v >= 60000).length + '/7일')}</div>
  </section>`;
  const right = subjectBreakdown(allSessions().filter((x) => keys.has(x.d))) || `<section class="${CARD} text-center text-gray-500">이 주에는 기록이 없어요</section>`;
  return [left, right];
}

function monthStats(totals) {
  const y = ui.statMonth.getFullYear(), mo = ui.statMonth.getMonth(), prefix = `${y}-${pad(mo + 1)}-`;
  const entries = Object.entries(totals).filter(([k, v]) => k.startsWith(prefix) && v >= 60000);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  const best = entries.slice().sort((a, b) => b[1] - a[1])[0];
  const achieved = Object.keys(D.todos).filter((k) => k.startsWith(prefix) && isAchieved(k)).length;
  return `
  <section class="${CARD}">
    <h2 class="text-center text-lg font-semibold">${mo + 1}월 요약</h2>
    <div class="mt-5 grid grid-cols-2 gap-y-5 text-center">
      ${summ('총 공부 시간', fmtHM(sum))}
      ${summ('공부한 날', entries.length + '일')}
      ${summ('하루 평균', entries.length ? fmtHM(sum / entries.length) : '0:00')}
      ${summ('할 일 100% 달성', achieved + '일')}
    </div>
    ${best ? `<p class="mt-5 text-center text-sm text-gray-600">최고 기록 ${fmtDateKo(parseKey(best[0]))} · <b class="text-brand">${fmtHM(best[1])}</b></p>` : ''}
  </section>
  ${subjectBreakdown(allSessions().filter((x) => x.d.startsWith(prefix)))}`;
}

function subjectBreakdown(list) {
  const total = sumMs(list);
  if (!total) return '';
  const rows = Object.entries(bySubject(list)).sort((a, b) => b[1] - a[1]).map(([sid, ms]) => {
    const s = D.subjects.find((x) => x.id === sid) || { name: '삭제된 과목', color: '#CBD5E1' };
    const p = Math.round((ms / total) * 100);
    return `
      <li>
        <div class="flex justify-between text-sm">
          <span class="flex items-center gap-2"><i class="w-2.5 h-2.5 rounded-full inline-block" style="background:${s.color}"></i>${esc(s.name)}</span>
          <span class="tabular-nums text-gray-600">${fmtHM(ms)} · ${p}%</span>
        </div>
        <div class="mt-1.5 h-2 rounded-full bg-white/70 overflow-hidden"><div class="h-full rounded-full" style="width:${p}%;background:${s.color}"></div></div>
      </li>`;
  }).join('');
  return `<section class="${CARD}"><h3 class="font-semibold">과목별 공부 시간</h3><ul class="mt-4 space-y-4">${rows}</ul></section>`;
}

// ---------- 자료 ----------
const isImage = (f) => (f.type || '').startsWith('image/');
function fileIcon(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (isImage(f)) return 'fa-file-image';
  if (ext === 'pdf') return 'fa-file-pdf';
  if (['zip', 'rar', '7z'].includes(ext)) return 'fa-file-zipper';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel';
  if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
  if (['doc', 'docx', 'hwp', 'hwpx', 'txt'].includes(ext)) return 'fa-file-lines';
  if (['dwg', 'dxf'].includes(ext)) return 'fa-compass-drafting';
  if ((f.type || '').startsWith('video/')) return 'fa-file-video';
  return 'fa-file';
}

function filesView() {
  const shown = files.filter((f) => ui.fileFilter === 'all' || (ui.fileFilter === 'photo') === isImage(f));
  const tabs = [['all', '전체'], ['photo', '사진'], ['doc', '파일']].map(([k, l]) => `
    <button data-action="filefilter" data-mode="${k}" class="px-5 py-2 rounded-full text-sm font-semibold transition ${ui.fileFilter === k ? 'btn' : 'text-gray-600'}">${l}</button>`).join('');
  const upload = `
    <label class="btn px-4 py-2.5 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap">
      <i class="fa-solid fa-arrow-up-from-bracket mr-1.5"></i>올리기
      <input type="file" multiple data-input="files" class="hidden">
    </label>`;
  return `
    ${pageTitle('자료', upload)}
    <div class="glass rounded-full p-1 inline-flex mb-4">${tabs}</div>
    ${shown.length
      ? `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">${shown.map(fileCard).join('')}</div>`
      : `<div class="glass rounded-3xl p-10 text-center text-gray-500">
           <i class="fa-regular fa-folder-open text-4xl text-brand"></i>
           <p class="mt-3">아직 올라온 자료가 없어요.<br>시험 자료나 사진을 올려 스터디원들과 나눠보세요.</p>
         </div>`}`;
}

function fileCard(f) {
  return `
  <button data-action="openfile" data-id="${f.id}" class="glass rounded-3xl p-2 text-left flex flex-col min-w-0">
    <div class="relative w-full aspect-square rounded-2xl overflow-hidden grid place-items-center bg-white/60">
      ${f.thumb
        ? `<img src="${f.thumb}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-contain">` // 사진 전체가 보이게 (자르지 않음)
        : `<i class="fa-solid ${fileIcon(f)} text-4xl text-brand"></i>`}
    </div>
    <div class="w-full min-w-0 px-1.5 pt-2 pb-1">
      <p class="text-sm font-semibold truncate">${esc(f.caption || f.name)}</p>
      ${f.caption ? `<p class="text-xs text-gray-600 truncate">${esc(f.name)}</p>` : ''}
      <p class="text-xs text-gray-500 truncate">${esc(f.by)} · ${fmtWhen(f.at)}</p>
    </div>
  </button>`;
}

// 파일 조각을 합친 결과는 다시 받지 않도록 기억해둔다
const blobUrls = {};
async function fileUrl(f) {
  return (blobUrls[f.id] ||= URL.createObjectURL(await downloadFile(f)));
}

// ---------- 나 (프로필 · 등급) ----------
// D-Day 목록: 꾹 눌러서 끌어 옮기고, 맨 윗줄이 홈 D-Day. '나' 화면 카드와 홈 D-Day 버튼 창에서 함께 쓴다
function ddayManager() {
  const list = ddayList();
  return `
    <div class="flex items-center justify-between gap-x-2 flex-wrap">
      <h3 class="font-semibold">D-Day</h3>
      <span class="text-xs text-gray-500">꾹 눌러 옮기기 · 맨 윗줄이 홈에 보여요</span>
    </div>
    <ul data-sortable="dday" class="sortable mt-3 space-y-2">${list.map((x, i) => `
      <li data-id="${x.id}" class="flex items-center gap-2.5 p-2.5 rounded-2xl cursor-grab ${i === 0 ? 'bg-white/85 shadow-sm' : 'bg-white/40'}">
        <span class="w-16 shrink-0 text-center font-bold tabular-nums ${i === 0 ? 'text-brand' : ''}">${ddayText(x.date)}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">${esc(x.name)}${x.shared ? ' <span class="text-[11px] font-normal text-gray-500">모두 함께</span>' : ''}</div>
          <div class="text-xs text-gray-500">${fmtDateKo(parseKey(x.date))}${i === 0 ? ' · <b class="text-brand">홈에 표시</b>' : ''}</div>
        </div>
        ${x.shared
          ? (isAdmin() ? '<button data-action="dday" class="w-8 h-8 shrink-0 rounded-full text-gray-500" aria-label="시험일 바꾸기"><i class="fa-solid fa-pen text-sm"></i></button>' : '<span class="w-8 shrink-0"></span>')
          : `<button data-action="ddaydel" data-id="${x.id}" class="w-8 h-8 shrink-0 rounded-full text-gray-400 hover:text-red-500" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>`}
        <i class="fa-solid fa-grip-lines w-6 text-center text-gray-400" aria-hidden="true"></i>
      </li>`).join('')}
    </ul>
    <form data-form="ddayadd" class="mt-3 space-y-2">
      <input name="name" required maxlength="20" autocomplete="off" placeholder="새 D-Day 이름 (예: 모의고사)" class="${INPUT} !py-2.5">
      <div class="flex gap-2">
        <input type="date" name="date" required class="${INPUT} flex-1 min-w-0 !py-2.5">
        <button class="btn px-4 rounded-2xl text-sm font-semibold whitespace-nowrap"><i class="fa-solid fa-plus mr-1"></i>추가</button>
      </div>
    </form>`;
}
// 목록이 바뀌면: 창으로 열려 있으면 창을 다시 그리고, 아니면 화면을 다시 그린다
function refreshDdays() {
  if (ui.ddayModal && $('#modal').innerHTML) { openModal(ddayModalHtml()); mountSortables(); }
  else render();
}
// 화면에 있는 D-Day 목록에 '꾹 눌러서 옮기기'를 붙인다 (휴대폰은 꾹 누르기, PC는 바로 끌기)
function mountSortables() {
  if (!window.Sortable) return;
  document.querySelectorAll('[data-sortable="dday"]').forEach((ul) => {
    Sortable.create(ul, {
      animation: 180,
      delay: 300,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      forceFallback: true, // 브라우저 기본 끌어놓기 대신 모든 기기에서 같은 방식으로 끌기
      fallbackClass: 'sort-chosen',
      filter: 'button',
      preventOnFilter: false,
      chosenClass: 'sort-chosen',
      ghostClass: 'sort-ghost',
      onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        const byId = Object.fromEntries(ddayList().map((x) => [x.id, x]));
        saveDdays([...ul.children].map((li) => byId[li.dataset.id]));
        if (navigator.vibrate) navigator.vibrate(10);
        refreshDdays();
      },
    });
  });
}
const ddayModalHtml = () => `
  <div class="flex justify-end -mt-2 -mr-2"><button data-action="closemodal" class="w-8 h-8 text-gray-500" aria-label="닫기"><i class="fa-solid fa-xmark text-lg"></i></button></div>
  ${ddayManager()}`;

// 가입한 멤버 명단: 등급이 높은 순 → 닉네임 순. 관리자에게는 내보내기 · 되돌리기 버튼이 보인다
function membersCard() {
  const rank = (g) => GRADES.indexOf(g);
  const admin = isAdmin();
  const rows = activeMembers().map(([id, p]) => ({
    id, nick: p.nick || '이름 없음', photo: p.photo,
    grade: id === me ? gradeInfo().grade : allData ? gradeInfo(allData[id] || {}).grade : null,
  })).sort((a, b) => (b.grade ? rank(b.grade) : -1) - (a.grade ? rank(a.grade) : -1) || a.nick.localeCompare(b.nick));
  const banned = Object.entries(settings.banned || {});
  return `
  <section class="${CARD}">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">멤버 <span class="text-sm font-normal text-gray-500">${rows.length}명</span></h3>
      ${admin ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-900 text-white"><i class="fa-solid fa-shield-halved mr-1"></i>관리자</span>' : ''}
    </div>
    <p class="mt-1 text-xs text-gray-500">${[...TEAMS, ''].map((t) => `${teamLabel(t)} ${rows.filter((r) => teamOf(r.id) === t).length}명`).join(' · ')}${admin ? ' · 오른쪽에서 팀을 배정해요' : ''}</p>
    <ul class="mt-3 space-y-2 max-h-80 overflow-y-auto">${rows.map((r) => `
      <li class="flex items-center gap-3 p-2 rounded-2xl ${r.id === me ? 'bg-white/85 shadow-sm' : 'bg-white/40'}">
        ${avatar(r, 'w-9 h-9 text-sm')}
        <span class="flex-1 min-w-0 font-medium truncate">
          ${esc(r.nick)}${r.id === me ? ' <span class="text-xs text-gray-500">나</span>' : ''}${r.nick === ADMIN_NICK ? ' <i class="fa-solid fa-shield-halved text-xs text-gray-500" title="관리자"></i>' : ''}${admin ? '' : ` ${teamBadge(r.id)}`}
          ${admin ? `<span class="block text-xs font-normal ${realNames[r.id] ? 'text-gray-500' : 'text-red-500'}">${realNames[r.id] ? esc(realNames[r.id]) : '실명 미입력'}</span>` : ''}
        </span>
        ${admin ? `
        <select data-input="team" data-id="${r.id}" class="field shrink-0 rounded-xl px-2 py-1 text-xs font-semibold outline-none" aria-label="${esc(r.nick)} 팀 배정">
          ${['', ...TEAMS].map((t) => `<option value="${t}" ${teamOf(r.id) === t ? 'selected' : ''}>${teamLabel(t)}</option>`).join('')}
        </select>` : ''}
        ${r.grade
          ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${rank(r.grade) ? 'btn' : 'bg-white/80 text-gray-600'}">${r.grade.name}</span>`
          : '<i class="fa-solid fa-spinner fa-spin text-gray-400 text-xs"></i>'}
        ${admin && r.id !== me ? `<button data-action="kick" data-id="${r.id}" class="w-8 h-8 rounded-full text-red-500 hover:bg-red-50" aria-label="${esc(r.nick)} 내보내기"><i class="fa-solid fa-user-slash text-sm"></i></button>` : ''}
      </li>`).join('')}
    </ul>
    ${admin && banned.length ? `
    <h4 class="mt-5 text-sm font-semibold text-gray-600">내보낸 멤버 <span class="font-normal text-gray-500">${banned.length}명</span></h4>
    <ul class="mt-2 space-y-2">${banned.map(([id, nick]) => `
      <li class="flex items-center gap-3 p-2 rounded-2xl bg-white/30 text-gray-500">
        <i class="fa-solid fa-user-slash w-9 text-center"></i>
        <span class="flex-1 min-w-0 truncate"><span class="line-through">${esc(nick)}</span>${realNames[id] ? ` <span class="text-xs">(${esc(realNames[id])})</span>` : ''}</span>
        <button data-action="unkick" data-id="${id}" class="px-3 py-1.5 rounded-full bg-white/80 text-xs font-semibold text-gray-700 whitespace-nowrap">되돌리기</button>
        <button data-action="purge" data-id="${id}" class="px-3 py-1.5 rounded-full bg-red-500 text-xs font-semibold text-white whitespace-nowrap">완전 삭제</button>
      </li>`).join('')}
    </ul>` : ''}
  </section>`;
}

function profileView() {
  const u = myProfile(), g = gradeInfo(), q = allQuotes();
  const bar = (label, v, max) => `
    <div>
      <div class="flex justify-between text-xs text-white/85"><span>${label}</span><span>${Math.min(v, max)} / ${max}일</span></div>
      <div class="mt-1.5 h-2 rounded-full bg-white/25 overflow-hidden"><div class="h-full bg-white rounded-full" style="width:${Math.min(100, (v / max) * 100)}%"></div></div>
    </div>`;
  const progress = g.next
    ? `<div class="mt-6 text-sm text-white/90">다음 등급 <b>${g.next.name}</b>까지</div>
       <div class="mt-2 grid gap-3 md:grid-cols-2">${bar('출석', g.att, g.next.att)}${bar('목표 달성', g.ach, g.next.ach)}</div>`
    : '<p class="mt-6 text-sm">최고 등급이에요! 🎉</p>';
  return `
  <section class="glass-hero rounded-[2rem] p-6 md:p-8">
    <div class="flex items-center gap-4">
      <label class="relative shrink-0 cursor-pointer" aria-label="프로필 사진 바꾸기">
        ${avatar(u, 'w-20 h-20 text-2xl ring-4 ring-white/40')}
        <span class="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white text-brand grid place-items-center text-xs shadow"><i class="fa-solid fa-camera"></i></span>
        <input type="file" accept="image/*" data-input="photo" class="hidden">
      </label>
      <div class="min-w-0">
        <div class="text-2xl md:text-3xl font-bold truncate">${esc(u.nick)}</div>
        <div class="mt-1.5 flex items-center gap-2">
          <span class="px-3 py-0.5 rounded-full text-xs font-bold bg-white text-brand-dark">${g.grade.name}</span>
          ${u.photo ? '<button data-action="photodel" class="text-xs text-white/80 underline">사진 삭제</button>' : ''}
        </div>
      </div>
    </div>
    ${progress}
  </section>
  <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
    <section class="${CARD}">
      <div class="flex justify-between items-center">
        <h3 class="font-semibold">시험 전 나의 목표</h3>
        <button data-action="editprofile" class="text-sm text-gray-500"><i class="fa-solid fa-pen mr-1"></i>수정</button>
      </div>
      <p class="mt-2 text-gray-700">${u.goal ? esc(u.goal) : '<span class="text-gray-400">목표를 적어보세요</span>'}</p>
      <h3 class="mt-5 font-semibold">나의 좌우명</h3>
      <p class="mt-2 text-gray-700">${u.motto ? `“${esc(u.motto)}”` : '<span class="text-gray-400">좌우명을 적어보세요</span>'}</p>
    </section>
    <section class="${CARD}">${ddayManager()}</section>
    ${membersCard()}
    ${isAdmin() ? `
    <section class="${CARD}">
      <h3 class="font-semibold"><i class="fa-solid fa-shield-halved mr-1.5 text-gray-500"></i>관리자 도구</h3>
      <p class="mt-1 text-xs text-gray-500 leading-relaxed">멤버 · 기록 · 할 일 · 명언 · 공지 · 설정 · 자료 목록 · 인증샷 목록을 파일 하나로 받아요. 큰 사진 원본과 자료 파일 내용은 용량이 커서 빠져요.</p>
      <button data-action="backup" class="btn mt-3 w-full py-3 rounded-2xl font-semibold"><i class="fa-solid fa-download mr-1.5"></i>데이터 백업 받기</button>
    </section>` : ''}
    <section class="${CARD}">
      <h3 class="font-semibold">등급 기준</h3>
      <ul class="mt-3 space-y-1.5 text-sm">${GRADES.map((x) => `
        <li class="flex justify-between ${x === g.grade ? 'font-bold text-brand' : 'text-gray-600'}">
          <span>${x.name}</span><span>${x.att ? `출석 ${x.att}일 · 달성 ${x.ach}일` : '가입하면 시작'}</span>
        </li>`).join('')}
      </ul>
      <p class="mt-3 text-xs text-gray-500">출석: 1분 이상 공부한 날 · 달성: 할 일을 100% 끝낸 날<br>현재 출석 ${g.att}일 · 달성 ${g.ach}일</p>
    </section>
    <section class="${CARD}">
      <h3 class="font-semibold">모두의 명언 <span class="text-sm font-normal text-gray-500">${q.length}</span></h3>
      <ul class="mt-3 space-y-2 text-sm text-gray-700 max-h-72 overflow-y-auto">${q.map((x) => `<li>“${esc(x.text)}”${x.by ? ` <span class="text-gray-500">— ${esc(x.by)}</span>` : ''}</li>`).join('')}</ul>
    </section>
    <section class="${CARD}">
      <h3 class="font-semibold">화면 모드</h3>
      <div class="mt-3 flex p-1 rounded-2xl bg-white/40">${[['system', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([m, l]) => `
        <button data-action="theme" data-mode="${m}" class="flex-1 py-2 rounded-xl text-sm font-semibold ${themeMode() === m ? 'btn' : 'text-gray-600'}">${l}</button>`).join('')}
      </div>
      <p class="mt-2 text-xs text-gray-500">시스템: 휴대폰 설정(다크 모드)을 따라가요. 이 기기에만 저장돼요.</p>
    </section>
  </div>
  <button data-action="logout" class="glass mt-4 w-full md:w-auto md:px-10 py-3 rounded-2xl text-gray-600">로그아웃</button>
  ${isAdmin()
    ? '<p class="mt-4 text-center md:text-left text-xs text-gray-400">관리자 계정은 탈퇴할 수 없어요.</p>'
    : '<button data-action="withdraw" class="mt-4 block mx-auto md:mx-0 text-sm text-gray-400 underline">탈퇴하기</button>'}`;
}

function withdrawModal() {
  openModal(`
    <h3 class="text-lg font-bold text-red-500">탈퇴하기</h3>
    <p class="mt-2 text-sm text-gray-600 leading-relaxed">
      탈퇴하면 <b>프로필 · 공부 기록 · 할 일 · 인증샷 · 내 명언</b>과 로그인 계정이 모두 지워지고 되돌릴 수 없어요.
      자료 메뉴에 올린 파일은 다른 멤버들을 위해 남아요.
    </p>
    <form data-form="withdraw" class="mt-4 space-y-3">
      <label class="block"><span class="text-sm font-medium text-gray-600">확인을 위해 비밀번호를 입력해주세요</span>
        <input type="password" name="pw" required autocomplete="current-password" class="mt-1.5 ${INPUT}"></label>
      <div class="flex gap-2">
        <button type="button" data-action="closemodal" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">취소</button>
        <button data-submit class="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold disabled:opacity-60">탈퇴하기</button>
      </div>
    </form>`);
}

// 비밀번호로 한 번 더 확인한 뒤, 내 데이터를 지우고 로그인 계정까지 삭제한다
// 관리자 백업: 주요 데이터를 JSON 파일 하나로 내려받는다
async function backup() {
  if (!isAdmin()) return;
  toast('백업 파일을 만드는 중…');
  try {
    const out = { app: '동기들과스터디', exportedAt: new Date().toISOString() };
    for (const col of ['users', 'realnames', 'data', 'quotes', 'board', 'files', 'proofs']) {
      const snap = await fb.f.getDocs(fb.f.collection(fb.db, col));
      out[col] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    a.download = `동기들과스터디-백업-${today}.json`;
    a.click();
    toast('백업 파일을 받았어요');
  } catch (e) {
    toast('백업하지 못했어요 · ' + friendly(e));
  }
}

// 화면 모드: 시스템 · 라이트 · 다크 (이 기기에만 저장)
function themeMode() {
  try { return localStorage.getItem('micho:theme') || 'system'; } catch { return 'system'; }
}
function applyTheme() {
  const mode = themeMode();
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B1A13' : '#E9F6EE');
}
function setTheme(mode) {
  try { localStorage.setItem('micho:theme', mode); } catch {}
  applyTheme();
  render();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

async function withdraw(form) {
  const btn = form.querySelector('[data-submit]');
  btn.disabled = true;
  btn.textContent = '탈퇴하는 중…';
  const { a, f, auth, db } = fb;
  try {
    const user = auth.currentUser;
    await a.reauthenticateWithCredential(user, a.EmailAuthProvider.credential(user.email, form.elements.pw.value));
    stopWatching();
    const mine = (col) => f.getDocs(f.query(f.collection(db, col), f.where('uid', '==', me)));
    const [myProofDocs, myQuotes] = await Promise.all([mine('proofs'), mine('quotes')]);
    await Promise.all([
      ...myProofDocs.docs.map((d) => deleteProof(d.id)),
      ...myQuotes.docs.map((d) => f.deleteDoc(d.ref)),
      f.deleteDoc(docRef('data', me)),
      f.deleteDoc(docRef('users', me)),
      f.deleteDoc(docRef('realnames', me)),
    ]);
    await a.deleteUser(user);
    me = D = null;
    profiles = {};
    ui.lastNick = '';
    $('#modal').innerHTML = '';
    render();
    toast('탈퇴했어요. 그동안 함께해서 고마웠어요!');
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '탈퇴하기';
    const wrongPw = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(e.code);
    toast(wrongPw ? '비밀번호가 맞지 않아요.' : '탈퇴하지 못했어요 · ' + friendly(e));
  }
}

// ============================================================
// 모달
// ============================================================
function openModal(html, wide = false) {
  $('#modal').innerHTML = `
  <div class="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6" data-action="backdrop">
    <div class="glass-strong w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-8 max-h-[90vh] overflow-y-auto">${html}</div>
  </div>`;
}
function closeModal() {
  $('#modal').innerHTML = '';
  ui.paletteFor = null;
  ui.openProof = null;
  ui.ddayModal = false;
  render();
}

function paletteView(s) {
  const current = s.color.toLowerCase();
  return `
  <div class="mt-3 mb-1 p-3 rounded-2xl bg-white/60">
    <div class="grid grid-cols-8 gap-2">${PALETTE.map((c) => `
      <button data-action="setcolor" data-id="${s.id}" data-color="${c}" class="orb aspect-square rounded-full grid place-items-center text-white text-[10px]" style="background-color:${c};--c:${c}" aria-label="${c}">
        ${c.toLowerCase() === current ? '<i class="fa-solid fa-check"></i>' : ''}
      </button>`).join('')}
    </div>
    <label class="mt-3 flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
      <input type="color" data-input="subcolor" data-id="${s.id}" value="${current}" class="w-9 h-9 rounded-lg border-0 bg-transparent p-0 cursor-pointer">
      원하는 색 직접 고르기
    </label>
  </div>`;
}

function subjectModal() {
  openModal(`
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold">과목 편집</h3>
      <button data-action="closemodal" class="w-8 h-8 text-gray-500" aria-label="닫기"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <p class="mt-1 text-sm text-gray-500">색 동그라미를 누르면 팔레트가 열려요.</p>
    <div class="mt-5 space-y-3">${D.subjects.map((s) => `
      <div>
        <div class="flex items-center gap-2">
          <button data-action="palette" data-id="${s.id}" class="orb w-10 h-10 shrink-0 rounded-full ${ui.paletteFor === s.id ? 'on' : ''}" style="background-color:${s.color};--c:${s.color}" aria-label="색 고르기"></button>
          <input data-input="subname" data-id="${s.id}" value="${esc(s.name)}" maxlength="20" class="${INPUT} flex-1 min-w-0 !py-2.5">
          <button data-action="subdel" data-id="${s.id}" class="w-8 text-gray-400 hover:text-red-500" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>
        </div>
        ${ui.paletteFor === s.id ? paletteView(s) : ''}
      </div>`).join('')}
    </div>
    <form data-form="subadd" class="mt-4 flex gap-2">
      <input name="name" required maxlength="20" autocomplete="off" placeholder="새 과목 이름" class="${INPUT} flex-1 min-w-0 !py-2.5">
      <button class="px-4 rounded-2xl bg-gray-900 text-white text-sm font-semibold">추가</button>
    </form>
    <button data-action="closemodal" class="btn mt-6 w-full py-3 rounded-2xl font-semibold">완료</button>`);
}

function ddayModal() {
  openModal(`
    <h3 class="text-lg font-bold">시험일 설정</h3>
    <p class="mt-1 text-sm text-gray-500">모두 같은 시험일을 봐요. 바꾸면 스터디원 모두의 D-Day가 함께 바뀌어요.</p>
    <form data-form="dday" class="mt-5 space-y-4">
      <input type="date" name="date" required value="${esc(settings.examDate)}" class="${INPUT}">
      <div class="flex gap-2">
        <button type="button" data-action="closemodal" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">취소</button>
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">저장</button>
      </div>
    </form>`);
}

function fineModal() {
  openModal(`
    <h3 class="text-lg font-bold">벌금 설정</h3>
    <p class="mt-1 text-sm text-gray-500">모두에게 똑같이 적용돼요.</p>
    <form data-form="fine" class="mt-5 space-y-4">
      <label class="block"><span class="text-sm font-medium text-gray-600">하루 벌금 (원)</span>
        <input type="number" name="fine" required min="0" step="100" inputmode="numeric" value="${settings.fine}" class="mt-1.5 ${INPUT}"></label>
      <label class="block"><span class="text-sm font-medium text-gray-600">계산 시작일</span>
        <input type="date" name="start" required value="${esc(settings.fineStart)}" class="mt-1.5 ${INPUT}"></label>
      <div class="flex gap-2">
        <button type="button" data-action="closemodal" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">취소</button>
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">저장</button>
      </div>
    </form>`);
}

// 관리자: 벌금 면제일 (전체 또는 특정 멤버)
function exemptModal() {
  const list = exemptList();
  openModal(`
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold">벌금 면제일</h3>
      <button data-action="closemodal" class="w-8 h-8 text-gray-500" aria-label="닫기"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <p class="mt-1 text-sm text-gray-500">명절 · 아픈 날 · 경조사처럼 벌금을 매기지 않을 날이에요. 지정하면 벌금 현황이 바로 다시 계산돼요.</p>
    <form data-form="exempt" class="mt-4 space-y-2">
      <input type="date" name="date" required class="${INPUT} !py-2.5">
      <select name="who" class="${INPUT} !py-2.5">
        <option value="">전체 멤버</option>
        ${activeMembers().map(([id, p]) => `<option value="${id}">${esc(p.nick || '')}${realNames[id] ? ` (${esc(realNames[id])})` : ''}</option>`).join('')}
      </select>
      <input name="reason" maxlength="20" placeholder="사유 (예: 추석, 병원)" class="${INPUT} !py-2.5">
      <button class="btn w-full py-2.5 rounded-2xl font-semibold"><i class="fa-solid fa-plus mr-1"></i>면제일 추가</button>
    </form>
    <ul class="mt-4 space-y-2">${list.length ? list.map((x) => `
      <li class="flex items-center gap-3 p-2.5 rounded-2xl bg-white/50 text-sm">
        <span class="font-semibold whitespace-nowrap">${fmtDateKo(parseKey(x.date))}</span>
        <span class="flex-1 min-w-0 truncate text-gray-600">${esc(x.who)}${x.reason ? ` · ${esc(x.reason)}` : ''}</span>
        <button data-action="exemptdel" data-date="${x.date}" class="w-7 text-gray-400 hover:text-red-500" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>
      </li>`).join('') : '<li class="py-3 text-center text-sm text-gray-500">아직 면제일이 없어요</li>'}
    </ul>`);
}

function myFineModal() {
  const { missed, base } = fineBase(me);
  const current = Math.max(0, base + (myProfile().fineAdjust || 0));
  openModal(`
    <h3 class="text-lg font-bold">내 벌금 수정</h3>
    <p class="mt-1 text-sm text-gray-500">예) 벌금을 냈다면 0원으로 바꿔주세요. 앞으로 생기는 벌금은 이 금액에 더해져요.</p>
    <p class="mt-3 text-xs text-gray-500">계산된 벌금: ${missed}일 · ${won(base)}</p>
    <form data-form="myfine" class="mt-3 space-y-4">
      <input type="number" name="amount" required min="0" step="100" inputmode="numeric" value="${current}" class="${INPUT}">
      <div class="flex gap-2">
        <button type="button" data-action="myfinereset" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">계산값으로</button>
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">저장</button>
      </div>
    </form>`);
}

function proofModal(p) {
  const who = whoOf(p);
  openModal(`
    <div class="flex items-center gap-3">
      ${avatar(who, 'w-10 h-10 text-sm')}
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">${esc(who.nick)}</div>
        <div class="text-xs text-gray-500">${fmtDateKo(parseKey(p.date))} · ${fmtClock(p.at)}</div>
      </div>
      <button data-action="closemodal" class="w-8 h-8 shrink-0 text-gray-500" aria-label="닫기"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <img data-proof="${p.id}" src="${p.thumb}" alt="" class="mt-4 w-full aspect-[4/5] object-cover rounded-2xl">
    <div class="mt-3 flex gap-1.5">${reactBar(p, false)}</div>
    ${p.uid === me || isAdmin() ? `<button data-action="proofdel" data-id="${p.id}" class="mt-4 w-full py-3 rounded-2xl bg-white/70 text-red-500"><i class="fa-regular fa-trash-can mr-1.5"></i>인증샷 삭제${p.uid === me ? '' : ' (관리자)'}</button>` : ''}`);
  ui.openProof = p.id;
  hydrateProofs();
}

function goalModal() {
  openModal(`
    <h3 class="text-lg font-bold">하루 목표 공부 시간</h3>
    <p class="mt-1 text-sm text-gray-500">홈 타이머에 목표 달성률이 링으로 보여요. 나만 보여요.</p>
    <form data-form="goal" class="mt-5 space-y-4">
      <label class="flex items-center gap-3">
        <input type="number" name="hours" required min="0.5" max="16" step="0.5" inputmode="decimal" value="${D.goalHours || 8}" class="${INPUT}">
        <span class="shrink-0 font-semibold">시간</span>
      </label>
      <div class="flex gap-2">
        ${D.goalHours ? '<button type="button" data-action="goalclear" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">목표 없애기</button>' : ''}
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">저장</button>
      </div>
    </form>`);
}

function noticeModal() {
  openModal(`
    <h3 class="text-lg font-bold"><i class="fa-solid fa-bullhorn text-brand mr-2"></i>공지</h3>
    <p class="mt-1 text-sm text-gray-500">누구나 쓸 수 있고, 게시하면 모두의 홈 화면에 바로 떠요.</p>
    ${notice ? `<p class="mt-3 text-xs text-gray-500">지금 공지: ${esc(notice.by)} · ${fmtWhen(notice.at)}</p>` : ''}
    <form data-form="notice" class="mt-3 space-y-3">
      <textarea name="text" rows="5" maxlength="500" required placeholder="예) 이번 주 토요일 오후 2시 모의고사 같이 풀어요!" class="${INPUT} resize-none">${esc(notice?.text)}</textarea>
      <div class="flex gap-2">
        ${notice ? '<button type="button" data-action="noticedel" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">공지 내리기</button>' : ''}
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">게시</button>
      </div>
    </form>`);
}

function uploadModal() {
  openModal(`
    <h3 class="text-lg font-bold">자료 올리기</h3>
    <ul class="mt-4 space-y-2 max-h-48 overflow-y-auto">${pending.map((f) => `
      <li class="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 text-sm">
        <i class="fa-solid ${fileIcon(f)} text-brand w-5 text-center"></i>
        <span class="flex-1 truncate">${esc(f.name)}</span>
        <span class="text-gray-500">${fmtSize(f.size)}</span>
      </li>`).join('')}
    </ul>
    <form data-form="upload" class="mt-4 space-y-3">
      <textarea name="caption" rows="2" maxlength="200" placeholder="설명 (선택) · 예) 대지계획 기출 풀이" class="${INPUT} resize-none"></textarea>
      <p class="text-xs text-gray-500">사진은 자동으로 줄여서 올려요 · 파일 하나당 최대 10MB</p>
      <div class="flex gap-2">
        <button type="button" data-action="closemodal" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">취소</button>
        <button data-submit class="btn flex-1 py-3 rounded-2xl font-semibold">게시</button>
      </div>
    </form>`);
}

function fileModal(f) {
  openModal(`
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-lg font-bold break-words">${esc(f.caption || f.name)}</h3>
        <p class="mt-1 text-xs text-gray-500 break-all">${esc(f.by)} · ${fmtWhen(f.at)} · ${esc(f.name)} · ${fmtSize(f.size)}</p>
      </div>
      <button data-action="closemodal" class="w-8 h-8 shrink-0 text-gray-500" aria-label="닫기"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    ${isImage(f) && f.thumb
      ? `<div id="preview" class="mt-4 rounded-2xl overflow-hidden bg-white/60"><img src="${f.thumb}" alt="" class="w-full max-h-[60vh] object-contain blur-sm"></div>`
      : `<div class="mt-4 rounded-2xl bg-white/60 py-12 grid place-items-center"><i class="fa-solid ${fileIcon(f)} text-5xl text-brand"></i></div>`}
    <div class="mt-4 flex gap-2">
      ${f.uid === me ? `<button data-action="filedel" data-id="${f.id}" class="px-5 py-3 rounded-2xl bg-white/70 text-red-500" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>` : ''}
      <button data-action="filesave" data-id="${f.id}" class="btn flex-1 py-3 rounded-2xl font-semibold"><i class="fa-solid fa-download mr-1.5"></i>저장</button>
    </div>`, true);
  // 사진이면 흐린 미리보기를 먼저 보여주고, 원본을 받으면 바꾼다
  if (isImage(f) && f.thumb) {
    fileUrl(f).then((url) => {
      const img = $('#preview img');
      if (img) { img.src = url; img.classList.remove('blur-sm'); }
    }).catch((e) => toast('사진을 불러오지 못했어요 · ' + friendly(e)));
  }
}

function realNameModal() {
  ui.mustModal = true; // 실명을 적어야만 닫힌다 (모든 멤버)
  openModal(`
    <h3 class="text-lg font-bold">실명을 알려주세요</h3>
    <p class="mt-1 text-sm text-gray-500 leading-relaxed">스터디 관리를 위해 <b>실명 입력이 필수</b>예요. 입력해야 앱을 쓸 수 있어요.<br>실명은 <b>관리자만</b> 볼 수 있고, 다른 멤버에게는 지금처럼 닉네임만 보여요.</p>
    <form data-form="realname" class="mt-5 space-y-4">
      <input name="real" required maxlength="20" autocomplete="name" placeholder="예) 홍길동" class="${INPUT}">
      <button class="btn w-full py-3 rounded-2xl font-semibold">저장하고 시작하기</button>
    </form>`);
}

function profileModal() {
  const u = myProfile();
  openModal(`
    <h3 class="text-lg font-bold">프로필 수정</h3>
    <form data-form="profile" class="mt-5 space-y-4">
      <label class="block"><span class="text-sm font-medium text-gray-600">시험 전 나의 목표</span>
        <input name="goal" value="${esc(u.goal)}" maxlength="60" class="mt-1.5 ${INPUT}"></label>
      <label class="block"><span class="text-sm font-medium text-gray-600">나의 좌우명</span>
        <input name="motto" value="${esc(u.motto)}" maxlength="80" class="mt-1.5 ${INPUT}"></label>
      <div class="flex gap-2">
        <button type="button" data-action="closemodal" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">취소</button>
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">저장</button>
      </div>
    </form>`);
}

// ============================================================
// 이벤트
// ============================================================
const findSubject = (id) => D.subjects.find((x) => x.id === id);

async function saveSettings(patch, doneMsg) {
  if (!isAdmin()) return toast('관리자만 바꿀 수 있어요');
  try {
    await fb.f.setDoc(docRef('board', 'settings'), patch, { merge: true });
    settings = { ...settings, ...patch };
    closeModal();
    toast(doneMsg);
  } catch (e) {
    toast('저장하지 못했어요 · ' + friendly(e));
  }
}

const actions = {
  go: (el) => go(el.dataset.view),
  toggle: (el) => toggleSubject(el.dataset.id),
  subjects: (el) => { ui.paletteFor = el.dataset.id || null; subjectModal(); },
  dday: () => { if (isAdmin()) ddayModal(); },
  finesettings: () => { if (isAdmin()) fineModal(); },
  exempt: () => { if (isAdmin()) exemptModal(); },
  exemptdel: async (el) => {
    if (!isAdmin() || !confirm(`${fmtDateKo(parseKey(el.dataset.date))} 면제일을 지울까요?`)) return;
    try {
      await fb.f.setDoc(docRef('board', 'settings'), { exempt: { [el.dataset.date]: fb.f.deleteField() } }, { merge: true });
      delete settings.exempt[el.dataset.date];
      exemptModal();
    } catch (e) { toast('지우지 못했어요 · ' + friendly(e)); }
  },
  ddaylist: () => { ui.ddayModal = true; openModal(ddayModalHtml()); mountSortables(); },
  ddaydel: (el) => {
    const x = ddayList().find((d) => d.id === el.dataset.id);
    if (!x || x.shared || !confirm(`'${x.name}' D-Day를 삭제할까요?`)) return;
    saveDdays(ddayList().filter((d) => d.id !== x.id));
    refreshDdays();
  },
  goal: () => goalModal(),
  goalclear: () => { D.goalHours = 0; save(); closeModal(); },
  react: async (el) => {
    const { id, r } = el.dataset;
    const all = [...proofs, ...myProofs, ...todayProofs].filter((x) => x.id === id);
    const on = !!all[0]?.reacts?.[r]?.[me];
    // 먼저 화면에 반영하고 저장
    for (const p of all) {
      const who = { ...(p.reacts?.[r] || {}) };
      on ? delete who[me] : (who[me] = true);
      p.reacts = { ...p.reacts, [r]: who };
    }
    if ($('#modal').innerHTML && ui.openProof === id) proofModal(all[0]); else render();
    try {
      await fb.f.updateDoc(docRef('proofs', id), new fb.f.FieldPath('reacts', r, me), on ? fb.f.deleteField() : true);
    } catch (e) {
      toast('반응을 남기지 못했어요 · ' + friendly(e));
    }
  },
  backup: () => backup(),
  theme: (el) => setTheme(el.dataset.mode),
  kick: async (el) => {
    const id = el.dataset.id, nick = profiles[id]?.nick || '이름 없음';
    if (!isAdmin() || !confirm(`'${nick}' 님을 내보낼까요?\n멤버 명단 · 벌금 · 인증샷에서 빠지고, 다시 로그인할 수 없어요.\n(내보낸 멤버 목록에서 되돌릴 수 있어요)`)) return;
    try {
      await fb.f.setDoc(docRef('board', 'settings'), { banned: { [id]: nick } }, { merge: true });
      toast(`${nick} 님을 내보냈어요`);
    } catch (e) {
      toast('내보내지 못했어요 · ' + friendly(e));
    }
  },
  teamview: (el) => { ui.teamView = el.dataset.team; render(); },
  // 내보낸 멤버의 데이터를 모두 지우고, 다시 들어오지 못하게 removed 에 남긴다 (자료 파일은 남김)
  purge: async (el) => {
    const id = el.dataset.id, nick = settings.banned?.[id] || '';
    if (!isAdmin() || !confirm(`'${nick}' 님의 프로필 · 실명 · 공부 기록 · 인증샷 · 명언을 모두 지울까요?\n되돌릴 수 없어요. (자료 메뉴의 파일은 남아요)`)) return;
    el.disabled = true;
    el.textContent = '지우는 중…';
    const { f, db } = fb;
    try {
      const mine = (col) => f.getDocs(f.query(f.collection(db, col), f.where('uid', '==', id)));
      const [ps, qs] = await Promise.all([mine('proofs'), mine('quotes')]);
      await Promise.all([
        ...ps.docs.map((d) => Promise.all([f.deleteDoc(d.ref), f.deleteDoc(docRef('proofPhotos', d.id))])),
        ...qs.docs.map((d) => f.deleteDoc(d.ref)),
        f.deleteDoc(docRef('data', id)),
        f.deleteDoc(docRef('users', id)),
        f.deleteDoc(docRef('realnames', id)),
      ]);
      await f.setDoc(docRef('board', 'settings'), {
        banned: { [id]: f.deleteField() },
        teams: { [id]: f.deleteField() },
        removed: { [id]: true },
      }, { merge: true });
      delete profiles[id];
      delete realNames[id];
      quoteList = quoteList.filter((q) => q.uid !== id);
      toast(`${nick} 님의 데이터를 모두 지웠어요`);
    } catch (e) {
      el.disabled = false;
      el.textContent = '완전 삭제';
      toast('지우지 못했어요 · ' + friendly(e));
    }
  },
  unkick: async (el) => {
    const id = el.dataset.id, nick = settings.banned?.[id] || '';
    if (!isAdmin() || !confirm(`'${nick}' 님을 다시 멤버로 되돌릴까요?`)) return;
    try {
      await fb.f.setDoc(docRef('board', 'settings'), { banned: { [id]: fb.f.deleteField() } }, { merge: true });
      toast(`${nick} 님을 되돌렸어요`);
    } catch (e) {
      toast('되돌리지 못했어요 · ' + friendly(e));
    }
  },
  myfine: () => myFineModal(),
  myfinereset: () => { closeModal(); updateProfile({ fineAdjust: 0 }, '계산된 벌금으로 되돌렸어요'); },
  openproof: (el) => proofModal([...proofs, ...myProofs].find((p) => p.id === el.dataset.id)),
  proofdel: async (el) => {
    const id = el.dataset.id, p = [...proofs, ...myProofs].find((x) => x.id === id);
    const mine = p?.uid === me;
    if (!mine && !isAdmin()) return;
    const msg = mine
      ? '이 인증샷을 삭제할까요?'
      : `관리자 권한으로 ${whoOf(p).nick} 님의 인증샷(${fmtDateKo(parseKey(p.date))})을 삭제할까요?\n그날 인증이 사라져 벌금이 생길 수 있어요.`;
    if (!confirm(msg)) return;
    try {
      await deleteProof(id);
      if (!mine) await removeProofDay(p.uid, p.date);
      closeModal();
      toast('인증샷을 삭제했어요');
    } catch (e) {
      toast('삭제하지 못했어요 · ' + friendly(e));
    }
  },
  feedmore: () => { ui.feedLimit += FEED_PAGE; watchFeed(); },
  quote: () => { ui.quote = pickQuote(ui.quote); render(); },
  editprofile: () => profileModal(),
  photodel: () => { if (confirm('프로필 사진을 삭제할까요?')) updateProfile({ photo: '' }, '사진을 삭제했어요'); },
  closemodal: () => closeModal(),
  backdrop: (el, e) => { if (e.target === el && !ui.mustModal) closeModal(); },

  notice: () => noticeModal(),
  noticedel: async () => {
    if (!confirm('공지를 내릴까요?')) return;
    try { await fb.f.deleteDoc(docRef('board', 'notice')); closeModal(); } catch (e) { toast('공지를 내리지 못했어요 · ' + friendly(e)); }
  },

  filefilter: (el) => { ui.fileFilter = el.dataset.mode; render(); },
  openfile: (el) => fileModal(files.find((x) => x.id === el.dataset.id)),
  filesave: async (el) => {
    const f = files.find((x) => x.id === el.dataset.id);
    el.disabled = true;
    el.textContent = '불러오는 중…';
    try {
      const a = document.createElement('a');
      a.href = await fileUrl(f);
      a.download = f.name;
      a.click();
    } catch (e) {
      toast('파일을 불러오지 못했어요 · ' + friendly(e));
    }
    el.disabled = false;
    el.innerHTML = '<i class="fa-solid fa-download mr-1.5"></i>저장';
  },
  filedel: async (el) => {
    const f = files.find((x) => x.id === el.dataset.id);
    if (!confirm(`'${f.caption || f.name}' 자료를 삭제할까요?`)) return;
    try { await deleteFile(f); closeModal(); toast('자료를 삭제했어요'); } catch (e) { toast('삭제하지 못했어요 · ' + friendly(e)); }
  },

  tododay: (el) => { ui.todoDate = dkey(addDays(parseKey(ui.todoDate), Number(el.dataset.delta))); render(); },
  todotoday: () => { ui.todoDate = today; render(); },
  passon: () => {
    const k = ui.todoDate;
    if (isLocked(k) || usedPass(k)) return;
    if (passesInWeek(k).length >= PASS_PER_WEEK) return toast(`이번 주 패스권 ${PASS_PER_WEEK}장을 다 썼어요`);
    if (!confirm(`${fmtDateKo(parseKey(k))}에 패스권을 쓸까요?\n이번 주 남은 패스: ${PASS_PER_WEEK - passesInWeek(k).length}장 → ${PASS_PER_WEEK - passesInWeek(k).length - 1}장`)) return;
    D.passes = [...(D.passes || []), k].sort();
    save();
    render();
    toast('🎫 패스! 이날은 벌금이 붙지 않아요');
  },
  passoff: () => {
    const k = ui.todoDate;
    if (isLocked(k) || !confirm('패스를 취소할까요? 패스권이 다시 돌아와요.')) return;
    D.passes = (D.passes || []).filter((d) => d !== k);
    save();
    render();
  },
  todotoggle: (el) => {
    if (isLocked(ui.todoDate)) return;
    const t = todosOn(ui.todoDate).find((x) => x.id === el.dataset.id);
    if (t) { t.done = !t.done; save(); render(); }
  },
  tododel: (el) => {
    const k = ui.todoDate;
    if (isLocked(k)) return;
    D.todos[k] = todosOn(k).filter((x) => x.id !== el.dataset.id);
    if (!D.todos[k].length) delete D.todos[k];
    save();
    render();
  },


  statmode: (el) => { ui.statMode = el.dataset.mode; render(); },
  statmonth: (el) => { const m = ui.statMonth; ui.statMonth = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.delta), 1); render(); },
  statweek: (el) => { ui.statWeek = addDays(ui.statWeek, 7 * Number(el.dataset.delta)); render(); },
  statday: (el) => {
    const d = parseKey(el.dataset.key);
    Object.assign(ui, { statDay: el.dataset.key, statMonth: monthOf(d), statWeek: mondayOf(d), statMode: 'day' });
    render();
  },

  palette: (el) => {
    ui.paletteFor = ui.paletteFor === el.dataset.id ? null : el.dataset.id;
    subjectModal();
  },
  setcolor: (el) => {
    findSubject(el.dataset.id).color = el.dataset.color;
    save();
    subjectModal();
  },
  subdel: (el) => {
    const s = findSubject(el.dataset.id);
    if (!confirm(`'${s.name}' 과목을 삭제할까요?\n지금까지의 공부 기록은 통계에 남아요.`)) return;
    if (D.running?.sid === s.id) commitRunning();
    D.subjects = D.subjects.filter((x) => x.id !== s.id);
    save();
    subjectModal();
  },

  authmode: (el) => {
    ui.lastNick = $('[name="nick"]')?.value || ui.lastNick;
    ui.authMode = el.dataset.mode;
    ui.authError = '';
    render();
  },
  logout: () => logout(),
  withdraw: () => withdrawModal(),
};

const forms = {
  auth: (f) => onAuth(f),
  withdraw: (f) => withdraw(f),
  todoadd: (f) => {
    const text = f.elements.text.value.trim();
    if (!text || isLocked(ui.todoDate)) return;
    (D.todos[ui.todoDate] ||= []).push({ id: uid(), text, done: false });
    save();
    render();
    $('[data-form="todoadd"] input').focus();
  },
  subadd: (f) => {
    const name = f.elements.name.value.trim();
    if (!name) return;
    D.subjects.push({ id: uid(), name, color: PALETTE[(D.subjects.length * 5) % PALETTE.length] });
    save();
    subjectModal();
    $('[data-form="subadd"] input').focus();
  },
  dday: (f) => saveSettings({ examDate: f.elements.date.value }, '시험일을 바꿨어요'),
  ddayadd: (f) => {
    const name = f.elements.name.value.trim(), date = f.elements.date.value;
    if (!name || !date) return;
    saveDdays([...ddayList(), { id: uid(), name, date }]);
    refreshDdays();
    toast(`'${name}' D-Day를 추가했어요. 꾹 눌러 맨 위로 옮기면 홈에 보여요`);
  },
  goal: (f) => {
    D.goalHours = Math.min(16, Math.max(0.5, Number(f.elements.hours.value) || 0));
    save();
    closeModal();
  },
  myfine: (f) => {
    const amount = Math.max(0, Number(f.elements.amount.value) || 0);
    $('#modal').innerHTML = '';
    updateProfile({ fineAdjust: amount - fineBase(me).base }, '내 벌금을 수정했어요');
  },
  exempt: async (f) => {
    const date = f.elements.date.value, who = f.elements.who.value, reason = f.elements.reason.value.trim();
    if (!date || !isAdmin()) return;
    // 같은 날짜에 이미 전체 면제가 있으면 그대로, 특정 멤버면 그 멤버를 추가
    const prev = settings.exempt?.[date] || {};
    const entry = who ? { ...prev, uids: { ...(prev.uids || {}), [who]: true } } : { ...prev, all: true };
    if (reason) entry.reason = reason;
    try {
      await fb.f.setDoc(docRef('board', 'settings'), { exempt: { [date]: entry } }, { merge: true });
      settings.exempt = { ...(settings.exempt || {}), [date]: entry };
      exemptModal();
      toast('면제일을 추가했어요');
    } catch (e) { toast('추가하지 못했어요 · ' + friendly(e)); }
  },
  fine: (f) => saveSettings({ fine: Math.max(0, Number(f.elements.fine.value) || 0), fineStart: f.elements.start.value }, '벌금 설정을 바꿨어요'),
  realname: async (f) => {
    const name = f.elements.real.value.trim();
    if (!name) return;
    try {
      await saveRealName(name);
      realNames[me] = name;
      ui.mustModal = false;
      closeModal();
      toast('실명을 저장했어요. 관리자만 볼 수 있어요');
    } catch (e) {
      toast('저장하지 못했어요 · ' + friendly(e));
    }
  },
  profile: (f) => {
    $('#modal').innerHTML = '';
    updateProfile({ goal: f.elements.goal.value.trim(), motto: f.elements.motto.value.trim() });
  },
  notice: async (f) => {
    const text = f.elements.text.value.trim();
    if (!text) return;
    try {
      await fb.f.setDoc(docRef('board', 'notice'), { text, by: myProfile().nick, uid: me, at: Date.now() });
      closeModal();
      toast('공지를 게시했어요');
    } catch (e) {
      toast('게시하지 못했어요 · ' + friendly(e));
    }
  },
  upload: async (f) => {
    const caption = f.elements.caption.value.trim();
    const btn = f.querySelector('[data-submit]');
    btn.disabled = true;
    let done = 0;
    const failed = [];
    for (const [i, file] of pending.entries()) {
      try {
        let blob = file, type = file.type || 'application/octet-stream', name = file.name, thumb = '';
        // 사진은 줄여서 올리고 목록용 작은 미리보기도 만든다 (브라우저가 못 읽는 사진은 원본 그대로)
        if (type.startsWith('image/') && type !== 'image/gif') {
          try {
            blob = await toJpeg(await shrinkImage(file, 2400));
            thumb = (await shrinkImage(file, 400)).toDataURL('image/jpeg', QUALITY);
            type = 'image/jpeg';
            name = name.replace(/\.[^.]+$/, '') + '.jpg';
          } catch {
            blob = file;
          }
        }
        if (blob.size > MAX_FILE) { failed.push(`${file.name}(10MB 초과)`); continue; }
        await uploadFile(blob, { name, type, caption, thumb, by: myProfile().nick, uid: me, at: Date.now() }, (p) => {
          btn.textContent = `올리는 중 ${i + 1}/${pending.length} · ${Math.round(p * 100)}%`;
        });
        done++;
      } catch (e) {
        failed.push(`${file.name}(${friendly(e)})`);
      }
    }
    pending = [];
    closeModal();
    toast(failed.length ? `${done}개 게시 · 실패: ${failed.join(', ')}` : `자료 ${done}개를 게시했어요`);
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f);
});
// 입력 중에는 화면만 바꾸고, 입력을 마쳤을 때(change) 저장한다
document.addEventListener('input', (e) => {
  const t = e.target, s = t.dataset.id && D ? findSubject(t.dataset.id) : null;
  if (!s) return;
  if (t.dataset.input === 'subname' && t.value.trim()) s.name = t.value.trim();
  if (t.dataset.input === 'subcolor') {
    s.color = t.value;
    const dot = $(`[data-action="palette"][data-id="${s.id}"]`);
    dot.style.backgroundColor = t.value;
    dot.style.setProperty('--c', t.value);
  }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.input === 'subname') save();
  if (t.dataset.input === 'subcolor') { save(); subjectModal(); }
  if (t.dataset.input === 'photo' && t.files?.[0]) {
    try {
      const photo = (await shrinkImage(t.files[0], 256, 1)).toDataURL('image/jpeg', QUALITY);
      await updateProfile({ photo }, '프로필 사진을 바꿨어요');
    } catch (err) {
      toast(err.message);
    }
  }
  if (t.dataset.input === 'team' && isAdmin()) {
    const id = t.dataset.id, team = t.value, nick = profiles[id]?.nick || '';
    try {
      // 미배정으로 돌리면 필드를 지운다
      await fb.f.setDoc(docRef('board', 'settings'), { teams: { [id]: team || fb.f.deleteField() } }, { merge: true });
      toast(`${nick} 님을 ${teamLabel(team)}${team ? '으로 배정했어요' : '으로 돌렸어요'}`);
    } catch (err) {
      toast('팀을 바꾸지 못했어요 · ' + friendly(err));
    }
  }
  if (t.dataset.input === 'proof' && t.files?.[0]) {
    const file = t.files[0];
    t.value = '';
    toast('인증샷을 올리는 중…');
    try {
      await saveProof(file);
      toast('오늘의 인증샷을 올렸어요 📸');
    } catch (err) {
      toast('올리지 못했어요 · ' + friendly(err));
    }
  }
  if (t.dataset.input === 'files' && t.files?.length) {
    pending = [...t.files];
    t.value = '';
    uploadModal();
  }
});

// 아이폰 Safari는 확대 금지 설정을 무시해서, 두 손가락 확대 동작을 직접 막는다
['gesturestart', 'gesturechange'].forEach((type) => document.addEventListener(type, (e) => e.preventDefault()));

setInterval(updateLive, 1000);

// ============================================================
// 시작
// ============================================================
(async function boot() {
  applyTheme();
  render();
  try {
    await initFirebase();
    const user = await new Promise((resolve) => {
      const off = fb.a.onAuthStateChanged(fb.auth, (u) => { off(); resolve(u); });
    });
    ready = true;
    if (user) await enter(user.uid);
    else render();
  } catch (e) {
    console.error(e);
    ui.fatal = friendly(e);
    render();
  }
})();
