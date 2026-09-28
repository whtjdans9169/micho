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
const BRAND = '#1F9D66';
const MATE_COLOR = '#8E7CC3';
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
  [12, '#14532D', '#fff'],
  [10, '#1E7A4C', '#fff'],
  [7, '#3FA46F', '#fff'],
  [4, '#8FD3AC', '#14532D'],
  [0, '#D5F0E0', '#14532D'],
];

const NAV = [['home', 'fa-house', '홈'], ['todo', 'fa-square-check', '할 일'], ['calendar', 'fa-calendar-days', '달력'], ['stats', 'fa-chart-simple', '통계'], ['me', 'fa-user', '나']];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const DAY = 86400000;
const AUTO_STOP = 6 * 3600000; // 타이머를 켜놓고 잊었을 때 자동으로 멈추는 시간
const INPUT = 'field w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-brand/50';

// ============================================================
// 유틸
// ============================================================
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 10);
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

// 갤러리에서 고른 사진을 256px 정사각형으로 줄인다
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const S = 256, c = document.createElement('canvas'), m = Math.min(img.width, img.height);
      c.width = c.height = S;
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이 사진은 읽을 수 없어요. 다른 사진을 골라주세요.')); };
    img.src = url;
  });
}

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

// ============================================================
// 상태
// ============================================================
let ready = false;     // Firebase 준비 완료
let me = null;         // 로그인한 사용자 id
let D = null;          // 내 공부 기록 · 할 일
let profiles = {};     // id → { nick, goal, motto, photo }
let quoteList = [];    // 사용자들이 등록한 명언
let mateData = null;   // 스터디원 id → 데이터
let unwatch = null;
let lastRev = null;    // 내가 마지막으로 저장한 버전 (내 저장이 되돌아온 것은 무시)
let calendar = null;
let today = dkey();
const ui = {
  view: 'home',
  todoDate: today,
  statMode: 'day',
  statMonth: monthOf(new Date()),
  statDay: today,
  statWeek: mondayOf(new Date()),
  calDate: null,
  mates: false,
  quote: null,
  paletteFor: null,
  authMode: 'login',
  authError: '',
  lastNick: '',
  fatal: '',
};

const myProfile = () => profiles[me] || { nick: ui.lastNick, goal: '', motto: '', photo: '' };
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
    examDate: '',
  };
}
function save() {
  D.rev = lastRev = uid();
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
// 자정을 넘는 구간을 날짜별로 나눈다
function splitRange(s, e) {
  const out = [];
  while (s < e) {
    const d = new Date(s);
    const end = Math.min(e, addDays(d, 1).getTime());
    out.push({ s, e: end, d: dkey(d) });
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
const isAchieved = (key) => { const s = todoStats(key); return s.total > 0 && s.done === s.total; };

function gradeInfo() {
  const att = Object.values(totalsByDay()).filter((v) => v >= 60000).length;
  const ach = Object.keys(D.todos).filter(isAchieved).length;
  let i = 0;
  GRADES.forEach((g, j) => { if (att >= g.att && ach >= g.ach) i = j; });
  return { att, ach, grade: GRADES[i], next: GRADES[i + 1] || null };
}

function ddayLabel() {
  if (!D.examDate) return 'D-Day';
  const diff = Math.round((parseKey(D.examDate) - parseKey(today)) / DAY);
  return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${-diff}`;
}

// ============================================================
// 로그인 흐름
// ============================================================
async function enter(id) {
  const [p, data, q] = await Promise.all([loadProfiles(), loadData(id), loadQuotes()]);
  me = id;
  profiles = p;
  quoteList = q;
  mateData = null;
  D = Object.assign(newData(), data);
  if (!data) save();
  // 가입 중 프로필 저장이 실패했던 계정도 닉네임이 남도록
  if (!profiles[me]) updateProfile({ nick: ui.lastNick || '나', goal: '', motto: '', photo: '' });
  unwatch?.();
  // 다른 기기(폰 ↔ PC)에서 바꾼 내용을 바로 반영
  unwatch = fb.f.onSnapshot(docRef('data', id), (snap) => {
    const remote = snap.data();
    if (!remote || remote.rev === lastRev) return;
    D = Object.assign(newData(), remote);
    const typing = document.activeElement?.matches('input, textarea');
    if (!$('#modal').innerHTML && !typing) render();
  });
  Object.assign(ui, { authError: '', authMode: 'login', view: 'home', mates: false, paletteFor: null, quote: pickQuote() });
  render();
}

async function onAuth(form) {
  const f = new FormData(form);
  const nick = String(f.get('nick') || '').trim();
  const pw = String(f.get('pw') || '');
  const signup = ui.authMode === 'signup';
  ui.lastNick = nick;
  if (!nick) return authFail('닉네임을 입력해주세요.');
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
  unwatch?.();
  unwatch = null;
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
  if (calendar) { ui.calDate = calendar.getDate(); calendar.destroy(); calendar = null; }
  const app = $('#app');
  if (ui.fatal) app.innerHTML = fatalView();
  else if (!ready) app.innerHTML = loadingView();
  else if (!me) app.innerHTML = loginView();
  else {
    const views = { home: homeView, todo: todoView, calendar: calendarView, stats: statsView, me: profileView };
    app.innerHTML = `
      ${navView()}
      <main class="md:pl-64">
        <div class="mx-auto max-w-6xl px-4 md:px-8 pt-5 md:pt-8 pb-32 md:pb-12">${views[ui.view]()}</div>
      </main>`;
    if (ui.view === 'calendar') mountCalendar();
    updateLive();
  }
}

function go(view) {
  if (view === 'todo') ui.todoDate = today;
  ui.view = view;
  render();
  window.scrollTo(0, 0);
}
function openTodo(key) {
  ui.todoDate = key;
  ui.view = 'todo';
  render();
  window.scrollTo(0, 0);
}

const pageTitle = (title, right = '') => `
  <div class="mb-5 flex items-center justify-between gap-3">
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight">${title}</h1>${right}
  </div>`;

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
        <div class="btn w-9 h-9 rounded-xl grid place-items-center"><i class="fa-solid fa-compass-drafting"></i></div>
        <span class="text-lg font-bold">micho</span>
      </div>
      ${NAV.map(item).join('')}
      <div class="hidden md:flex mt-auto items-center gap-3 p-2">
        ${avatar(u, 'w-10 h-10')}
        <div class="min-w-0">
          <div class="font-semibold truncate">${esc(u.nick)}</div>
          <div class="text-xs text-brand-dark">${gradeInfo().grade.name}</div>
        </div>
      </div>
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
        <div class="btn mx-auto w-16 h-16 rounded-3xl grid place-items-center text-2xl"><i class="fa-solid fa-compass-drafting"></i></div>
        <h1 class="mt-5 text-3xl font-bold tracking-tight">건축사 시험 스터디 플래너</h1>
        <p class="mt-2 text-gray-600">매일의 공부 시간을 기록하고 합격까지 함께 달려요</p>
      </div>
      <form data-form="auth" class="glass rounded-[2rem] p-6 md:p-8 space-y-4">
        <div class="flex p-1 rounded-2xl bg-white/40">${tab('login', '로그인')}${tab('signup', '처음이에요')}</div>
        ${field('nick', '닉네임', 'text', '닉네임', `required maxlength="20" autocomplete="username" value="${esc(ui.lastNick)}"`)}
        ${field('pw', '비밀번호', 'password', signup ? '6자 이상' : '비밀번호', `required ${signup ? 'minlength="6"' : ''} autocomplete="${signup ? 'new-password' : 'current-password'}"`)}
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

// ---------- 홈 (타이머) ----------
function homeView() {
  const ts = todoStats(today), q = ui.quote;
  return `
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-5">
    <section class="glass-hero rounded-[2rem] p-6 md:p-8 lg:col-span-3 flex flex-col lg:min-h-[440px]">
      <div class="flex items-center justify-between">
        <button data-action="dday" class="chip px-3.5 py-1.5 rounded-full text-sm font-semibold">${ddayLabel()}</button>
        <div class="text-lg font-medium">${fmtDate(new Date())}</div>
        <button data-action="subjects" class="chip w-10 h-10 rounded-full grid place-items-center" aria-label="과목 편집"><i class="fa-solid fa-palette"></i></button>
      </div>
      <div class="flex-1 flex flex-col justify-center py-10 text-center">
        <div class="text-sm text-white/80">오늘 공부한 시간</div>
        <div class="mt-1 text-6xl md:text-7xl font-semibold tabular-nums tracking-tight" data-live="total">0:00:00</div>
        <div class="mt-3 text-sm text-white/85" data-live="current"></div>
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
  </div>`;
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
    render();
    return;
  }
  // 한 번에 6시간을 넘기면 켜놓고 잊은 것으로 보고 6시간까지만 기록한다
  if (D.running && Date.now() - D.running.s > AUTO_STOP) {
    commitRunning(D.running.s + AUTO_STOP);
    save();
    render();
    toast('6시간 넘게 켜져 있어서 타이머를 자동으로 멈췄어요');
    return;
  }
  const list = sessionsOn(today);
  document.querySelectorAll('[data-live]').forEach((el) => {
    const t = el.dataset.live;
    if (t === 'total') el.textContent = fmtHMS(sumMs(list));
    else if (t === 'sub') el.textContent = fmtHMS(sumMs(list.filter((x) => x.sid === el.dataset.id)));
    else if (t === 'current') {
      const s = D.running && D.subjects.find((x) => x.id === D.running.sid);
      el.textContent = D.running ? `${s ? s.name : ''} 집중 중 · ${fmtKo(Date.now() - D.running.s)}` : '과목의 ▶ 버튼을 눌러 공부를 시작하세요';
    }
  });
  document.title = D.running ? `${fmtHMS(sumMs(list))} · micho` : 'micho 스터디 플래너';
}

// ---------- 할 일 ----------
function todoView() {
  const key = ui.todoDate, list = todosOn(key), s = todoStats(key);
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
    <form data-form="todoadd" class="mt-4 flex gap-2">
      <input name="text" required maxlength="100" autocomplete="off" placeholder="할 일을 입력하세요" class="${INPUT} flex-1 min-w-0">
      <button class="btn px-5 rounded-2xl" aria-label="추가"><i class="fa-solid fa-plus"></i></button>
    </form>
    <section class="glass rounded-3xl mt-4 px-4 ${list.length ? '' : 'hidden'}">
      <ul class="divide-y divide-white/70">${list.map((t) => `
        <li class="flex items-center gap-3 py-4">
          <button data-action="todotoggle" data-id="${t.id}" class="w-6 h-6 shrink-0 rounded-lg border-2 grid place-items-center ${t.done ? 'btn border-transparent' : 'border-gray-300 bg-white/60'}" aria-label="완료 체크">${t.done ? '<i class="fa-solid fa-check text-xs"></i>' : ''}</button>
          <span class="flex-1 break-all ${t.done ? 'line-through text-gray-400' : ''}">${esc(t.text)}</span>
          <button data-action="tododel" data-id="${t.id}" class="w-7 text-gray-400 hover:text-red-500" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>
        </li>`).join('')}
      </ul>
    </section>
    ${list.length ? '' : '<p class="py-12 text-center text-gray-500">아직 할 일이 없어요</p>'}
  </div>`;
}

// ---------- 달력 ----------
function calendarView() {
  const toggle = `
    <label class="glass flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium cursor-pointer">
      <input type="checkbox" data-action="mates" ${ui.mates ? 'checked' : ''} class="w-4 h-4 accent-[#1F9D66]">스터디원 체크리스트
    </label>`;
  return `
    ${pageTitle('달력', toggle)}
    <section class="glass rounded-3xl p-3 md:p-6"><div id="fc"></div></section>
    <p class="mt-4 px-2 text-sm text-gray-500">날짜를 누르면 그날의 할 일로 이동해요.</p>`;
}

function mountCalendar() {
  const events = [];
  for (const [d, ms] of Object.entries(totalsByDay())) {
    if (ms >= 60000) events.push({ title: '⏱ ' + fmtHM(ms), start: d, color: '#12724A', order: 0 });
  }
  const addTodos = (todos, who, color) => {
    for (const [d, list] of Object.entries(todos || {})) {
      for (const t of list || []) {
        events.push({
          title: (who ? `[${who}] ` : '') + (t.done ? '✓ ' : '') + t.text,
          start: d, order: who ? 2 : 1,
          color: t.done ? 'rgba(255,255,255,.8)' : color,
          textColor: t.done ? '#6B7280' : '#fff',
        });
      }
    }
  };
  addTodos(D.todos, '', BRAND);
  if (ui.mates && mateData) {
    for (const [id, data] of Object.entries(mateData)) addTodos(data.todos, profiles[id]?.nick || '스터디원', MATE_COLOR);
  }
  calendar = new FullCalendar.Calendar($('#fc'), {
    initialView: 'dayGridMonth',
    initialDate: ui.calDate || undefined,
    locale: 'ko',
    firstDay: 1,
    height: 'auto',
    fixedWeekCount: false,
    dayMaxEvents: 3,
    headerToolbar: { left: 'prev', center: 'title', right: 'today next' },
    dayCellContent: (arg) => String(arg.date.getDate()),
    eventOrder: 'order,title',
    events,
    dateClick: (info) => openTodo(info.dateStr),
    eventClick: (info) => openTodo(info.event.startStr.slice(0, 10)),
  });
  calendar.render();
  // 사이드바 · 화면 회전 등으로 영역 크기가 바뀌면 달력 너비를 다시 맞춘다
  new ResizeObserver(() => calendar?.updateSize()).observe($('#fc'));
}

// 켤 때마다 새로 불러와서 스터디원의 최신 체크리스트를 보여준다
async function loadMates() {
  profiles = { ...(await loadProfiles()), [me]: myProfile() };
  const ids = Object.keys(profiles).filter((id) => id !== me);
  const list = await Promise.all(ids.map(loadData));
  mateData = Object.fromEntries(ids.map((id, i) => [id, list[i] || {}]));
}

// ---------- 통계 ----------
const CARD = 'glass rounded-3xl p-5 md:p-6';
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
    <div class="grid gap-4 lg:gap-6 lg:grid-cols-2 lg:items-start">
      <div>${left}</div>
      <div class="space-y-4">${right}</div>
    </div>`;
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

// ---------- 나 (프로필 · 등급) ----------
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
  <div class="mt-4 grid gap-4 md:grid-cols-2">
    <section class="${CARD}">
      <div class="flex justify-between items-center">
        <h3 class="font-semibold">시험 전 나의 목표</h3>
        <button data-action="editprofile" class="text-sm text-gray-500"><i class="fa-solid fa-pen mr-1"></i>수정</button>
      </div>
      <p class="mt-2 text-gray-700">${u.goal ? esc(u.goal) : '<span class="text-gray-400">목표를 적어보세요</span>'}</p>
      <h3 class="mt-5 font-semibold">나의 좌우명</h3>
      <p class="mt-2 text-gray-700">${u.motto ? `“${esc(u.motto)}”` : '<span class="text-gray-400">좌우명을 적어보세요</span>'}</p>
    </section>
    <section class="${CARD} flex justify-between items-center">
      <div>
        <h3 class="font-semibold">시험일</h3>
        <p class="mt-1 text-sm text-gray-600">${D.examDate ? fmtDateKo(parseKey(D.examDate)) : '설정 안 됨'}</p>
      </div>
      <button data-action="dday" class="btn px-4 py-2 rounded-full text-sm font-semibold">${ddayLabel()}</button>
    </section>
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
  </div>
  <button data-action="logout" class="glass mt-4 w-full md:w-auto md:px-10 py-3 rounded-2xl text-gray-600">로그아웃</button>`;
}

// ============================================================
// 모달
// ============================================================
function openModal(html) {
  $('#modal').innerHTML = `
  <div class="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6" data-action="backdrop">
    <div class="glass-strong w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-8 max-h-[85vh] overflow-y-auto">${html}</div>
  </div>`;
}
function closeModal() {
  $('#modal').innerHTML = '';
  ui.paletteFor = null;
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
    <p class="mt-1 text-sm text-gray-500">홈 화면 왼쪽 위에 D-Day가 표시돼요.</p>
    <form data-form="dday" class="mt-5 space-y-4">
      <input type="date" name="date" value="${esc(D.examDate)}" class="${INPUT}">
      <div class="flex gap-2">
        <button type="button" data-action="ddayclear" class="flex-1 py-3 rounded-2xl bg-white/70 text-gray-600">지우기</button>
        <button class="btn flex-1 py-3 rounded-2xl font-semibold">저장</button>
      </div>
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

const actions = {
  go: (el) => go(el.dataset.view),
  toggle: (el) => toggleSubject(el.dataset.id),
  subjects: (el) => { ui.paletteFor = el.dataset.id || null; subjectModal(); },
  dday: () => ddayModal(),
  ddayclear: () => { D.examDate = ''; save(); closeModal(); },
  quote: () => { ui.quote = pickQuote(ui.quote); render(); },
  editprofile: () => profileModal(),
  photodel: () => { if (confirm('프로필 사진을 삭제할까요?')) updateProfile({ photo: '' }, '사진을 삭제했어요'); },
  closemodal: () => closeModal(),
  backdrop: (el, e) => { if (e.target === el) closeModal(); },

  tododay: (el) => { ui.todoDate = dkey(addDays(parseKey(ui.todoDate), Number(el.dataset.delta))); render(); },
  todotoday: () => { ui.todoDate = today; render(); },
  todotoggle: (el) => {
    const t = todosOn(ui.todoDate).find((x) => x.id === el.dataset.id);
    if (t) { t.done = !t.done; save(); render(); }
  },
  tododel: (el) => {
    const k = ui.todoDate;
    D.todos[k] = todosOn(k).filter((x) => x.id !== el.dataset.id);
    if (!D.todos[k].length) delete D.todos[k];
    save();
    render();
  },

  mates: async (el) => {
    ui.mates = el.checked;
    if (ui.mates) {
      try { await loadMates(); } catch (e) { toast('스터디원 기록을 불러오지 못했어요 · ' + friendly(e)); }
    }
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
};

const forms = {
  auth: (f) => onAuth(f),
  todoadd: (f) => {
    const text = f.elements.text.value.trim();
    if (!text) return;
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
  dday: (f) => { D.examDate = f.elements.date.value; save(); closeModal(); },
  profile: (f) => {
    $('#modal').innerHTML = '';
    updateProfile({ goal: f.elements.goal.value.trim(), motto: f.elements.motto.value.trim() });
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
      await updateProfile({ photo: await readPhoto(t.files[0]) }, '프로필 사진을 바꿨어요');
    } catch (err) {
      toast(err.message);
    }
  }
});

setInterval(updateLive, 1000);

// ============================================================
// 시작
// ============================================================
(async function boot() {
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
