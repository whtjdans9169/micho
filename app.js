'use strict';

// ============================================================
// 저장소 (LocalStorage)
// ============================================================
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};
const sessionStore = {
  get() { try { return sessionStorage.getItem('micho:session'); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem('micho:session', v) : sessionStorage.removeItem('micho:session'); } catch {} },
};
const KEY = {
  users: 'micho:users',
  quotes: 'micho:quotes',
  remember: 'micho:remember',
  data: (nick) => 'micho:data:' + nick,
};

// ============================================================
// 상수
// ============================================================
const COLORS = ['#D97471', '#8E7CC3', '#EBC04A', '#5DA9E9', '#6CC08B', '#F08A5D', '#B56576', '#4A5568'];

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
  [12, '#6B2A0A', '#fff'],
  [10, '#B4501A', '#fff'],
  [7, '#E8702F', '#fff'],
  [4, '#F59A6B', '#fff'],
  [0, '#FDE3D2', '#7C2D12'],
];

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const DAY = 86400000;

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

// 브라우저에만 저장하므로 보안용이 아니라 비밀번호를 그대로 남기지 않기 위한 해시
async function hash(text) {
  if (!window.crypto?.subtle) return 'plain:' + text;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// 상태
// ============================================================
let me = null; // 로그인한 닉네임
let D = null;  // 로그인한 사용자 데이터
let calendar = null;
const ui = {
  view: 'home',
  todoDate: dkey(),
  statMode: 'day',
  statMonth: monthOf(new Date()),
  statDay: dkey(),
  statWeek: mondayOf(new Date()),
  calDate: null,
  mates: false,
  quote: null,
  authMode: 'login',
  authError: '',
  lastNick: '',
};

const users = () => store.get(KEY.users, {});
function quotes() {
  let q = store.get(KEY.quotes, null);
  if (!Array.isArray(q)) { q = SEED_QUOTES.slice(); store.set(KEY.quotes, q); }
  return q;
}
function pickQuote(prev) {
  const q = quotes();
  if (q.length < 2) return q[0] || null;
  let x;
  do { x = q[Math.floor(Math.random() * q.length)]; } while (prev && x.text === prev.text);
  return x;
}
function newData() {
  return {
    subjects: [
      { id: uid(), name: '1교시', color: COLORS[0] },
      { id: uid(), name: '2교시', color: COLORS[1] },
      { id: uid(), name: '3교시', color: COLORS[2] },
    ],
    sessions: [], // { sid, s, e, d } — 날짜(d)별로 잘라서 저장
    todos: {},    // { 'YYYY-MM-DD': [{ id, text, done }] }
    running: null, // { sid, s }
    examDate: '',
  };
}
const loadData = (nick) => Object.assign(newData(), store.get(KEY.data(nick), {}));
const save = () => store.set(KEY.data(me), D);

// ============================================================
// 공부 기록 계산
// ============================================================
// 자정을 넘는 구간을 날짜별로 나눈다
function splitRange(s, e) {
  const out = [];
  while (s < e) {
    const d = new Date(s);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const end = Math.min(e, next);
    out.push({ s, e: end, d: dkey(d) });
    s = end;
  }
  return out;
}
function commitRunning() {
  if (!D.running) return;
  const { sid, s } = D.running;
  for (const p of splitRange(s, Date.now())) if (p.e - p.s >= 1000) D.sessions.push({ sid, ...p });
  D.running = null;
}
function allSessions() {
  if (!D.running) return D.sessions;
  const live = splitRange(D.running.s, Date.now()).map((p) => ({ sid: D.running.sid, ...p }));
  return D.sessions.concat(live);
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
  const t = D.todos[key] || [];
  const done = t.filter((x) => x.done).length;
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
  const diff = Math.round((parseKey(D.examDate) - parseKey(dkey())) / DAY);
  return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${-diff}`;
}

// ============================================================
// 화면
// ============================================================
function render() {
  if (calendar) { ui.calDate = calendar.getDate(); calendar.destroy(); calendar = null; }
  const app = $('#app');
  if (!me) { app.innerHTML = loginView(); return; }
  const views = { home: homeView, todo: todoView, calendar: calendarView, stats: statsView, me: profileView };
  app.innerHTML = views[ui.view]() + navView();
  if (ui.view === 'calendar') mountCalendar();
  updateLive();
}

function go(view) {
  if (view === 'todo') ui.todoDate = dkey();
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

// ---------- 로그인 ----------
function loginView() {
  const signup = ui.authMode === 'signup';
  const tab = (m, l) => `<button type="button" data-action="authmode" data-mode="${m}" class="flex-1 py-2.5 rounded-xl text-sm font-semibold ${ui.authMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500'}">${l}</button>`;
  const field = (name, label, type, ph, extra = '') => `
    <label class="block">
      <span class="text-sm font-medium text-gray-600">${label}</span>
      <input name="${name}" type="${type}" placeholder="${ph}" ${extra} class="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand">
    </label>`;
  return `
  <div class="min-h-screen flex flex-col">
    <div class="bg-brand text-white px-6 pt-16 pb-12">
      <div class="w-14 h-14 rounded-2xl bg-white/20 grid place-items-center text-2xl"><i class="fa-solid fa-compass-drafting"></i></div>
      <h1 class="mt-5 text-3xl font-bold leading-tight">건축사 시험<br>스터디 플래너</h1>
      <p class="mt-2 text-white/80">매일의 공부 시간을 기록하고 합격까지 달려가요</p>
    </div>
    <form data-form="auth" class="flex-1 px-6 py-8 space-y-4">
      <div class="flex p-1 rounded-2xl bg-gray-100">${tab('login', '로그인')}${tab('signup', '처음이에요')}</div>
      ${field('nick', '닉네임', 'text', '닉네임', `required maxlength="20" autocomplete="username" value="${esc(ui.lastNick)}"`)}
      ${field('pw', '비밀번호', 'password', '4자 이상', `required minlength="4" autocomplete="${signup ? 'new-password' : 'current-password'}"`)}
      ${signup ? field('goal', '시험 전 나의 목표', 'text', '예) 올해 3과목 모두 합격!', 'maxlength="60"') + field('motto', '나의 명언 / 좌우명', 'text', '예) 오늘 걷지 않으면 내일은 뛰어야 한다', 'maxlength="80"') : ''}
      <label class="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" name="remember" checked class="w-4 h-4 accent-[#EE7F3E]">계정 기억하기
      </label>
      ${ui.authError ? `<p class="text-sm text-red-500">${esc(ui.authError)}</p>` : ''}
      <button class="w-full py-3.5 rounded-xl bg-brand text-white font-semibold text-lg">${signup ? '시작하기' : '로그인'}</button>
      <p class="text-xs text-gray-400 text-center leading-relaxed">계정과 기록은 이 기기의 브라우저에만 저장돼요.</p>
    </form>
  </div>`;
}

async function onAuth(form) {
  const f = new FormData(form);
  const nick = String(f.get('nick') || '').trim();
  const pw = String(f.get('pw') || '');
  ui.lastNick = nick;
  if (!nick) return authFail('닉네임을 입력해주세요.');
  const all = users();
  const h = await hash(nick + '\n' + pw);
  if (ui.authMode === 'login') {
    if (!all[nick]) return authFail('없는 닉네임이에요. "처음이에요"에서 가입해주세요.');
    if (all[nick].hash !== h) return authFail('비밀번호가 맞지 않아요.');
  } else {
    if (all[nick]) return authFail('이미 있는 닉네임이에요.');
    const goal = String(f.get('goal') || '').trim();
    const motto = String(f.get('motto') || '').trim();
    all[nick] = { hash: h, goal, motto, createdAt: Date.now() };
    store.set(KEY.users, all);
    // 첫 로그인 시 좌우명을 모두의 명언에 등록
    if (motto) { const q = quotes(); q.push({ text: motto, by: nick }); store.set(KEY.quotes, q); }
  }
  if (f.get('remember')) store.set(KEY.remember, nick); else store.remove(KEY.remember);
  sessionStore.set(nick);
  signIn(nick);
}
function authFail(msg) { ui.authError = msg; render(); }
function signIn(nick) {
  me = nick;
  D = loadData(nick);
  ui.authError = '';
  ui.authMode = 'login';
  ui.view = 'home';
  ui.quote = pickQuote();
  render();
}

// ---------- 홈 (타이머) ----------
function homeView() {
  const today = new Date(), ts = todoStats(dkey(today)), q = ui.quote;
  return `
  <header class="bg-brand text-white px-5 pt-6 pb-7">
    <div class="flex items-center justify-between">
      <button data-action="dday" class="px-3 py-1.5 rounded-full bg-black/10 text-sm font-medium">${ddayLabel()}</button>
      <div class="text-lg font-medium">${fmtDate(today)}</div>
      <button data-action="subjects" class="w-9 h-9 grid place-items-center text-xl" aria-label="과목 편집"><i class="fa-solid fa-table-cells-large"></i></button>
    </div>
    <div class="mt-8 text-center text-6xl font-semibold tabular-nums tracking-tight" data-live="total">0:00:00</div>
    <div class="mt-3 text-center text-sm text-white/75" data-live="current"></div>
    ${q ? `<button data-action="quote" class="mt-5 block w-full text-center text-sm text-white/90 leading-relaxed">“${esc(q.text)}”${q.by ? `<span class="text-white/60"> · ${esc(q.by)}</span>` : ''}</button>` : ''}
  </header>
  <main class="px-5 pb-36">
    <button data-action="go" data-view="todo" class="w-full mt-5 p-4 rounded-2xl bg-gray-50 text-left">
      <div class="flex justify-between text-sm">
        <span class="font-semibold">오늘의 할 일</span>
        <span class="text-gray-500">${ts.done}/${ts.total} · <b class="text-brand">${ts.pct}%</b></span>
      </div>
      <div class="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden"><div class="h-full bg-brand rounded-full transition-all" style="width:${ts.pct}%"></div></div>
    </button>
    <ul class="mt-2">${D.subjects.map(subjectRow).join('')}</ul>
    ${D.subjects.length ? '' : '<p class="py-10 text-center text-gray-400">과목을 추가해주세요</p>'}
    <button data-action="subjects" class="mt-4 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600"><i class="fa-solid fa-pen mr-1.5"></i>과목 편집</button>
  </main>`;
}

function subjectRow(s) {
  const on = D.running?.sid === s.id;
  return `
  <li class="flex items-center gap-4 py-3.5 ${on ? '-mx-3 px-3 rounded-2xl bg-brand-soft' : ''}">
    <button data-action="toggle" data-id="${s.id}" class="w-12 h-12 shrink-0 rounded-full grid place-items-center text-white text-lg shadow-sm" style="background:${s.color}" aria-label="${on ? '일시정지' : '시작'}">
      <i class="fa-solid ${on ? 'fa-pause' : 'fa-play ml-0.5'}"></i>
    </button>
    <span class="flex-1 text-lg font-medium truncate">${esc(s.name)}</span>
    <span class="text-lg tabular-nums" data-live="sub" data-id="${s.id}">0:00:00</span>
    <button data-action="subjects" class="w-6 text-gray-400" aria-label="과목 편집"><i class="fa-solid fa-ellipsis-vertical"></i></button>
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
  const today = sessionsOn(dkey());
  document.querySelectorAll('[data-live]').forEach((el) => {
    const t = el.dataset.live;
    if (t === 'total') el.textContent = fmtHMS(sumMs(today));
    else if (t === 'sub') el.textContent = fmtHMS(sumMs(today.filter((x) => x.sid === el.dataset.id)));
    else if (t === 'current') {
      if (D.running) {
        const s = D.subjects.find((x) => x.id === D.running.sid);
        el.textContent = `${s ? s.name : ''} 집중 중 · ${fmtKo(Date.now() - D.running.s)}`;
      } else el.textContent = '과목의 ▶ 버튼을 눌러 공부를 시작하세요';
    }
  });
  document.title = D.running ? `${fmtHMS(sumMs(today))} · micho` : 'micho 스터디 플래너';
}

// ---------- 할 일 ----------
function todoView() {
  const key = ui.todoDate, list = todosOn(key), s = todoStats(key), isToday = key === dkey();
  return `
  <header class="px-5 pt-6 pb-4 flex items-center justify-between">
    <button data-action="tododay" data-delta="-1" class="w-10 h-10 grid place-items-center text-gray-500" aria-label="이전 날"><i class="fa-solid fa-chevron-left"></i></button>
    <div class="text-center">
      <div class="text-lg font-bold">${fmtDateKo(parseKey(key))}</div>
      ${isToday ? '<div class="text-xs text-brand font-medium">오늘</div>' : '<button data-action="todotoday" class="text-xs text-gray-400 underline">오늘로</button>'}
    </div>
    <button data-action="tododay" data-delta="1" class="w-10 h-10 grid place-items-center text-gray-500" aria-label="다음 날"><i class="fa-solid fa-chevron-right"></i></button>
  </header>
  <main class="px-5 pb-36">
    <section class="p-5 rounded-3xl bg-brand text-white">
      <div class="flex items-end justify-between">
        <div><div class="text-sm text-white/80">달성률</div><div class="text-4xl font-bold tabular-nums">${s.pct}%</div></div>
        <div class="text-sm text-white/80">${s.done} / ${s.total} 완료</div>
      </div>
      <div class="mt-4 h-2.5 rounded-full bg-white/30 overflow-hidden"><div class="h-full rounded-full bg-white transition-all duration-500" style="width:${s.pct}%"></div></div>
    </section>
    <form data-form="todoadd" class="mt-5 flex gap-2">
      <input name="text" required maxlength="100" autocomplete="off" placeholder="할 일을 입력하세요" class="flex-1 min-w-0 px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand">
      <button class="px-4 rounded-xl bg-gray-900 text-white" aria-label="추가"><i class="fa-solid fa-plus"></i></button>
    </form>
    <ul class="mt-4 divide-y divide-gray-100">${list.map((t) => `
      <li class="flex items-center gap-3 py-3.5">
        <button data-action="todotoggle" data-id="${t.id}" class="w-6 h-6 shrink-0 rounded-md border-2 grid place-items-center ${t.done ? 'bg-brand border-brand text-white' : 'border-gray-300'}" aria-label="완료 체크">${t.done ? '<i class="fa-solid fa-check text-xs"></i>' : ''}</button>
        <span class="flex-1 break-all ${t.done ? 'line-through text-gray-400' : ''}">${esc(t.text)}</span>
        <button data-action="tododel" data-id="${t.id}" class="w-6 text-gray-300 hover:text-red-400" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>
      </li>`).join('')}
    </ul>
    ${list.length ? '' : '<p class="py-12 text-center text-gray-400">아직 할 일이 없어요</p>'}
  </main>`;
}

// ---------- 달력 ----------
function calendarView() {
  return `
  <header class="px-5 pt-6 pb-2 flex items-center justify-between">
    <h1 class="text-xl font-bold">달력</h1>
    <label class="flex items-center gap-2 text-sm text-gray-600">
      <input type="checkbox" data-action="mates" ${ui.mates ? 'checked' : ''} class="w-4 h-4 accent-[#EE7F3E]">스터디원 체크리스트
    </label>
  </header>
  <main class="px-3 pb-36">
    <div id="fc"></div>
    <p class="mt-4 px-2 text-xs text-gray-400 leading-relaxed">
      날짜를 누르면 그날의 할 일로 이동해요.
      ${ui.mates ? '<br>스터디원 체크리스트는 지금은 이 기기에 가입한 계정끼리만 보여요.' : ''}
    </p>
  </main>`;
}

function mountCalendar() {
  const events = [];
  for (const [d, ms] of Object.entries(totalsByDay())) {
    if (ms >= 60000) events.push({ title: '⏱ ' + fmtHM(ms), start: d, allDay: true, color: '#1F2937', order: 0 });
  }
  const addTodos = (todos, who, color) => {
    for (const [d, list] of Object.entries(todos || {})) {
      for (const t of list) {
        events.push({
          title: (who ? `[${who}] ` : '') + (t.done ? '✓ ' : '') + t.text,
          start: d, allDay: true, order: who ? 2 : 1,
          color: t.done ? '#E5E7EB' : color,
          textColor: t.done ? '#6B7280' : '#fff',
        });
      }
    }
  };
  addTodos(D.todos, '', '#EE7F3E');
  if (ui.mates) for (const n of Object.keys(users())) if (n !== me) addTodos(loadData(n).todos, n, '#8E7CC3');

  calendar = new FullCalendar.Calendar(document.getElementById('fc'), {
    initialView: 'dayGridMonth',
    initialDate: ui.calDate || undefined,
    locale: 'ko',
    firstDay: 1,
    height: 'auto',
    fixedWeekCount: false,
    dayMaxEvents: 3,
    headerToolbar: { left: 'prev', center: 'title', right: 'today next' },
    eventOrder: 'order,title',
    events,
    dateClick: (info) => openTodo(info.dateStr),
    eventClick: (info) => openTodo(info.event.startStr.slice(0, 10)),
  });
  calendar.render();
}

// ---------- 통계 ----------
const summ = (label, value) => `<div><div class="text-xs text-gray-500">${label}</div><div class="mt-1 text-lg font-bold tabular-nums">${value}</div></div>`;

function statsView() {
  const chips = [['day', '일간'], ['week', '주간'], ['month', '월간']].map(([k, l]) => `
    <button data-action="statmode" data-mode="${k}" class="px-5 py-2 rounded-full border ${ui.statMode === k ? 'bg-brand border-brand text-white font-semibold' : 'bg-white border-gray-200 text-gray-600'}">${l}</button>`).join('');
  const totals = totalsByDay();
  const body = ui.statMode === 'week'
    ? weekStats(totals)
    : monthGrid(totals) + (ui.statMode === 'day' ? dayStats() : monthStats(totals));
  return `
  <div class="bg-gray-100 min-h-screen">
    <header class="px-5 pt-6 pb-3">
      <h1 class="text-xl font-bold text-center">통계</h1>
      <div class="mt-4 flex gap-2">${chips}</div>
    </header>
    <main class="px-4 pb-36 space-y-3">${body}</main>
  </div>`;
}

function levelOf(ms) {
  if (!ms || ms < 60000) return null;
  const h = ms / 3600000;
  return LEVELS.find(([min]) => h >= min);
}

function monthGrid(totals) {
  const m = ui.statMonth, y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), start = mondayOf(first);
  const days = new Date(y, mo + 1, 0).getDate();
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + days) / 7);
  const today = dkey();
  let cells = '', monthMs = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), k = dkey(d), inMonth = d.getMonth() === mo, ms = totals[k] || 0;
    if (inMonth) monthMs += ms;
    const lv = inMonth ? levelOf(ms) : null;
    const selected = ui.statMode === 'day' && k === ui.statDay;
    cells += `
      <button data-action="statday" data-key="${k}" class="h-14 rounded-lg flex flex-col items-center pt-1.5 gap-0.5 ${selected ? 'ring-2 ring-gray-700' : ''}" style="${lv ? `background:${lv[1]};color:${lv[2]}` : ''}">
        <span class="text-sm w-7 h-6 grid place-items-center rounded-md ${k === today ? 'bg-gray-900 text-white' : ''} ${inMonth ? '' : 'text-gray-300'}">${d.getDate()}</span>
        ${lv ? `<span class="text-[11px] tabular-nums">${fmtHM(ms)}</span>` : ''}
      </button>`;
  }
  const legend = [...LEVELS].reverse().map(([h, bg, fg]) => `<span class="px-1.5 py-0.5" style="background:${bg};color:${fg}">${h}+</span>`).join('');
  return `
  <section class="bg-white rounded-2xl p-4">
    <div class="flex items-center gap-4 px-1">
      <button data-action="statmonth" data-delta="-1" class="w-6 text-gray-400" aria-label="이전 달"><i class="fa-solid fa-caret-left"></i></button>
      <span class="text-xl font-bold">${y === new Date().getFullYear() ? '' : y + '년 '}${mo + 1}월</span>
      <button data-action="statmonth" data-delta="1" class="w-6 text-gray-400" aria-label="다음 달"><i class="fa-solid fa-caret-right"></i></button>
    </div>
    <div class="mt-3 grid grid-cols-7 text-center text-sm text-gray-400">${['월', '화', '수', '목', '금', '토', '일'].map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="mt-1 grid grid-cols-7 gap-1">${cells}</div>
    <div class="mt-3 flex items-center justify-between text-xs">
      <div class="flex rounded overflow-hidden">${legend}</div>
      <span class="text-gray-500">${mo + 1}월: ${fmtHM(monthMs)}</span>
    </div>
  </section>`;
}

function dayStats() {
  const k = ui.statDay, list = sessionsOn(k), total = sumMs(list), ts = todoStats(k);
  const max = list.reduce((a, x) => Math.max(a, x.e - x.s), 0);
  const start = list.length ? Math.min(...list.map((x) => x.s)) : null;
  const end = list.length ? Math.max(...list.map((x) => x.e)) : null;
  const running = D.running && k === dkey();
  const cell = (label, value) => `<div><div class="text-brand font-semibold">${label}</div><div class="mt-1 text-2xl font-medium tabular-nums">${value}</div></div>`;
  return `
  <section class="bg-white rounded-2xl p-5">
    <h2 class="text-center text-lg font-semibold">${fmtDateKo(parseKey(k))}</h2>
    <div class="mt-5 grid grid-cols-2 gap-y-6 text-center">
      ${cell('총 공부 시간', fmtHMS(total))}
      ${cell('최대 집중 시간', fmtHMS(max))}
      ${cell('시작시간', start ? fmtClock(start) : '-')}
      ${cell('종료시간', end ? (running ? '진행 중' : fmtClock(end)) : '-')}
    </div>
    <div class="mt-6 pt-5 border-t border-gray-100 flex justify-between text-sm">
      <span class="text-gray-500">할 일 달성률</span>
      <span class="font-semibold">${ts.done}/${ts.total} · ${ts.pct}%</span>
    </div>
  </section>
  ${subjectBreakdown(list)}`;
}

function weekStats(totals) {
  const ws = ui.statWeek, days = [...Array(7)].map((_, i) => addDays(ws, i)), today = dkey();
  const vals = days.map((d) => totals[dkey(d)] || 0);
  const sum = vals.reduce((a, b) => a + b, 0), max = Math.max(3600000, ...vals);
  const att = vals.filter((v) => v >= 60000).length;
  const keys = new Set(days.map(dkey));
  const list = allSessions().filter((x) => keys.has(x.d));
  const bars = days.map((d, i) => {
    const k = dkey(d), h = Math.round((vals[i] / max) * 100);
    return `
      <button data-action="statday" data-key="${k}" class="flex-1 flex flex-col items-center gap-1.5">
        <span class="text-[11px] text-gray-500 tabular-nums h-4">${vals[i] >= 60000 ? fmtHM(vals[i]) : ''}</span>
        <div class="w-full max-w-[28px] h-36 bg-gray-100 rounded-lg flex items-end overflow-hidden"><div class="w-full bg-brand rounded-lg" style="height:${h}%"></div></div>
        <span class="text-xs ${k === today ? 'font-bold text-brand' : 'text-gray-500'}">${WD[d.getDay()]}</span>
      </button>`;
  }).join('');
  const end = days[6];
  return `
  <section class="bg-white rounded-2xl p-5">
    <div class="flex items-center justify-between">
      <button data-action="statweek" data-delta="-1" class="w-8 text-gray-400" aria-label="이전 주"><i class="fa-solid fa-caret-left"></i></button>
      <span class="font-bold">${ws.getMonth() + 1}.${ws.getDate()} – ${end.getMonth() + 1}.${end.getDate()}</span>
      <button data-action="statweek" data-delta="1" class="w-8 text-gray-400" aria-label="다음 주"><i class="fa-solid fa-caret-right"></i></button>
    </div>
    <div class="mt-5 flex gap-2 items-end">${bars}</div>
    <div class="mt-6 grid grid-cols-3 text-center">${summ('주간 합계', fmtHM(sum))}${summ('일 평균', fmtHM(sum / 7))}${summ('출석', att + '/7일')}</div>
  </section>
  ${subjectBreakdown(list)}`;
}

function monthStats(totals) {
  const y = ui.statMonth.getFullYear(), mo = ui.statMonth.getMonth(), prefix = `${y}-${pad(mo + 1)}-`;
  const entries = Object.entries(totals).filter(([k, v]) => k.startsWith(prefix) && v >= 60000);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  const best = entries.slice().sort((a, b) => b[1] - a[1])[0];
  const achieved = Object.keys(D.todos).filter((k) => k.startsWith(prefix) && isAchieved(k)).length;
  const list = allSessions().filter((x) => x.d.startsWith(prefix));
  return `
  <section class="bg-white rounded-2xl p-5">
    <h2 class="text-center text-lg font-semibold">${mo + 1}월 요약</h2>
    <div class="mt-5 grid grid-cols-2 gap-y-5 text-center">
      ${summ('총 공부 시간', fmtHM(sum))}
      ${summ('공부한 날', entries.length + '일')}
      ${summ('하루 평균', entries.length ? fmtHM(sum / entries.length) : '0:00')}
      ${summ('할 일 100% 달성', achieved + '일')}
    </div>
    ${best ? `<p class="mt-5 text-center text-sm text-gray-500">최고 기록 ${fmtDateKo(parseKey(best[0]))} · <b class="text-brand">${fmtHM(best[1])}</b></p>` : ''}
  </section>
  ${subjectBreakdown(list)}`;
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
        <div class="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full rounded-full" style="width:${p}%;background:${s.color}"></div></div>
      </li>`;
  }).join('');
  return `<section class="bg-white rounded-2xl p-5"><h3 class="font-semibold">과목별 공부 시간</h3><ul class="mt-4 space-y-4">${rows}</ul></section>`;
}

// ---------- 나 (프로필 · 등급) ----------
function profileView() {
  const u = users()[me] || {}, g = gradeInfo(), q = quotes();
  const bar = (label, v, max) => `
    <div class="mt-2">
      <div class="flex justify-between text-xs text-white/80"><span>${label}</span><span>${Math.min(v, max)} / ${max}일</span></div>
      <div class="mt-1 h-1.5 rounded-full bg-white/25 overflow-hidden"><div class="h-full bg-white rounded-full" style="width:${Math.min(100, (v / max) * 100)}%"></div></div>
    </div>`;
  const progress = g.next
    ? `<div class="mt-5 text-sm text-white/85">다음 등급 <b>${g.next.name}</b>까지</div>${bar('출석', g.att, g.next.att)}${bar('목표 달성', g.ach, g.next.ach)}`
    : '<p class="mt-5 text-sm">최고 등급이에요! 🎉</p>';
  return `
  <header class="bg-brand text-white px-5 pt-8 pb-6">
    <div class="flex items-center gap-4">
      <div class="w-16 h-16 rounded-full bg-white/20 grid place-items-center text-2xl"><i class="fa-solid fa-compass-drafting"></i></div>
      <div>
        <div class="text-2xl font-bold">${esc(me)}</div>
        <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-brand">${g.grade.name}</span>
      </div>
    </div>
    ${progress}
  </header>
  <main class="px-5 pb-36 mt-5 space-y-4">
    <section class="p-4 rounded-2xl bg-gray-50">
      <div class="flex justify-between items-center">
        <h3 class="font-semibold">시험 전 나의 목표</h3>
        <button data-action="editprofile" class="text-sm text-gray-400"><i class="fa-solid fa-pen mr-1"></i>수정</button>
      </div>
      <p class="mt-2 text-gray-700">${u.goal ? esc(u.goal) : '<span class="text-gray-400">목표를 적어보세요</span>'}</p>
      <h3 class="mt-4 font-semibold">나의 좌우명</h3>
      <p class="mt-2 text-gray-700">${u.motto ? `“${esc(u.motto)}”` : '<span class="text-gray-400">좌우명을 적어보세요</span>'}</p>
    </section>
    <section class="p-4 rounded-2xl bg-gray-50 flex justify-between items-center">
      <div>
        <h3 class="font-semibold">시험일</h3>
        <p class="mt-1 text-sm text-gray-500">${D.examDate ? fmtDateKo(parseKey(D.examDate)) : '설정 안 됨'}</p>
      </div>
      <button data-action="dday" class="px-3 py-1.5 rounded-full bg-brand text-white text-sm font-semibold">${ddayLabel()}</button>
    </section>
    <section class="p-4 rounded-2xl bg-gray-50">
      <h3 class="font-semibold">등급 기준</h3>
      <ul class="mt-3 space-y-1.5 text-sm">${GRADES.map((x) => `
        <li class="flex justify-between ${x === g.grade ? 'font-bold text-brand' : 'text-gray-600'}">
          <span>${x.name}</span><span>${x.att ? `출석 ${x.att}일 · 달성 ${x.ach}일` : '가입하면 시작'}</span>
        </li>`).join('')}
      </ul>
      <p class="mt-3 text-xs text-gray-400">출석: 1분 이상 공부한 날 · 달성: 할 일을 100% 끝낸 날<br>현재 출석 ${g.att}일 · 달성 ${g.ach}일</p>
    </section>
    <section class="p-4 rounded-2xl bg-gray-50">
      <h3 class="font-semibold">모두의 명언 <span class="text-sm font-normal text-gray-400">${q.length}</span></h3>
      <ul class="mt-3 space-y-2 text-sm text-gray-700">${q.map((x) => `<li>“${esc(x.text)}”${x.by ? ` <span class="text-gray-400">— ${esc(x.by)}</span>` : ''}</li>`).join('')}</ul>
    </section>
    <button data-action="logout" class="w-full py-3 rounded-xl border border-gray-200 text-gray-500">로그아웃</button>
  </main>`;
}

// ---------- 하단 탭 ----------
function navView() {
  const items = [['home', 'fa-house', '홈'], ['todo', 'fa-square-check', '할 일'], ['calendar', 'fa-calendar-days', '달력'], ['stats', 'fa-chart-simple', '통계'], ['me', 'fa-user', '나']];
  return `
  <nav class="fixed bottom-4 inset-x-0 z-30 px-4">
    <div class="max-w-md mx-auto flex bg-white/95 backdrop-blur rounded-full shadow-lg ring-1 ring-black/5 p-1.5">
      ${items.map(([v, icon, label]) => `
        <button data-action="go" data-view="${v}" class="flex-1 py-2 rounded-full flex flex-col items-center gap-0.5 ${ui.view === v ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}">
          <i class="fa-solid ${icon} text-lg"></i><span class="text-[11px] font-medium">${label}</span>
        </button>`).join('')}
    </div>
  </nav>`;
}

// ============================================================
// 모달
// ============================================================
function openModal(html) {
  $('#modal').innerHTML = `
  <div class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" data-action="backdrop">
    <div class="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto">${html}</div>
  </div>`;
}
function closeModal() { $('#modal').innerHTML = ''; render(); }

function subjectModal() {
  openModal(`
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold">과목 편집</h3>
      <button data-action="closemodal" class="w-8 h-8 text-gray-400" aria-label="닫기"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <p class="mt-1 text-sm text-gray-500">색 동그라미를 누르면 색이 바뀌어요.</p>
    <div class="mt-5 space-y-3">${D.subjects.map((s) => `
      <div class="flex items-center gap-2">
        <button data-action="subcolor" data-id="${s.id}" class="w-9 h-9 shrink-0 rounded-full" style="background:${s.color}" aria-label="색 바꾸기"></button>
        <input data-input="subname" data-id="${s.id}" value="${esc(s.name)}" maxlength="20" class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand">
        <button data-action="subdel" data-id="${s.id}" class="w-8 text-gray-400 hover:text-red-400" aria-label="삭제"><i class="fa-regular fa-trash-can"></i></button>
      </div>`).join('')}
    </div>
    <form data-form="subadd" class="mt-4 flex gap-2">
      <input name="name" required maxlength="20" autocomplete="off" placeholder="새 과목 이름" class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand">
      <button class="px-4 rounded-xl bg-gray-900 text-white text-sm font-semibold">추가</button>
    </form>
    <button data-action="closemodal" class="mt-6 w-full py-3 rounded-xl bg-brand text-white font-semibold">완료</button>`);
}

function ddayModal() {
  openModal(`
    <h3 class="text-lg font-bold">시험일 설정</h3>
    <p class="mt-1 text-sm text-gray-500">홈 화면 왼쪽 위에 D-Day가 표시돼요.</p>
    <form data-form="dday" class="mt-5 space-y-4">
      <input type="date" name="date" value="${esc(D.examDate)}" class="w-full px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand">
      <div class="flex gap-2">
        <button type="button" data-action="ddayclear" class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600">지우기</button>
        <button class="flex-1 py-3 rounded-xl bg-brand text-white font-semibold">저장</button>
      </div>
    </form>`);
}

function profileModal() {
  const u = users()[me] || {};
  openModal(`
    <h3 class="text-lg font-bold">프로필 수정</h3>
    <form data-form="profile" class="mt-5 space-y-4">
      <label class="block"><span class="text-sm font-medium text-gray-600">시험 전 나의 목표</span>
        <input name="goal" value="${esc(u.goal)}" maxlength="60" class="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand"></label>
      <label class="block"><span class="text-sm font-medium text-gray-600">나의 좌우명</span>
        <input name="motto" value="${esc(u.motto)}" maxlength="80" class="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-100 outline-none focus:ring-2 focus:ring-brand"></label>
      <div class="flex gap-2">
        <button type="button" data-action="closemodal" class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600">취소</button>
        <button class="flex-1 py-3 rounded-xl bg-brand text-white font-semibold">저장</button>
      </div>
    </form>`);
}

// ============================================================
// 이벤트
// ============================================================
const actions = {
  go: (el) => go(el.dataset.view),
  toggle: (el) => toggleSubject(el.dataset.id),
  subjects: () => subjectModal(),
  dday: () => ddayModal(),
  ddayclear: () => { D.examDate = ''; save(); closeModal(); },
  quote: () => { ui.quote = pickQuote(ui.quote); render(); },
  editprofile: () => profileModal(),
  closemodal: () => closeModal(),
  backdrop: (el, e) => { if (e.target === el) closeModal(); },

  tododay: (el) => { ui.todoDate = dkey(addDays(parseKey(ui.todoDate), Number(el.dataset.delta))); render(); },
  todotoday: () => { ui.todoDate = dkey(); render(); },
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

  mates: (el) => { ui.mates = el.checked; render(); },

  statmode: (el) => { ui.statMode = el.dataset.mode; render(); },
  statmonth: (el) => { const m = ui.statMonth; ui.statMonth = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.delta), 1); render(); },
  statweek: (el) => { ui.statWeek = addDays(ui.statWeek, 7 * Number(el.dataset.delta)); render(); },
  statday: (el) => {
    const d = parseKey(el.dataset.key);
    ui.statDay = el.dataset.key;
    ui.statMonth = monthOf(d);
    ui.statWeek = mondayOf(d);
    ui.statMode = 'day';
    render();
  },

  subcolor: (el) => {
    const s = D.subjects.find((x) => x.id === el.dataset.id);
    if (!s) return;
    s.color = COLORS[(COLORS.indexOf(s.color) + 1) % COLORS.length];
    save();
    subjectModal();
  },
  subdel: (el) => {
    const s = D.subjects.find((x) => x.id === el.dataset.id);
    if (!s || !confirm(`'${s.name}' 과목을 삭제할까요?\n지금까지의 공부 기록은 통계에 남아요.`)) return;
    if (D.running?.sid === s.id) commitRunning();
    D.subjects = D.subjects.filter((x) => x.id !== s.id);
    save();
    subjectModal();
  },

  authmode: (el) => {
    ui.lastNick = document.querySelector('[name="nick"]')?.value || ui.lastNick;
    ui.authMode = el.dataset.mode;
    ui.authError = '';
    render();
  },
  logout: () => {
    if (!confirm('로그아웃할까요?')) return;
    commitRunning();
    save();
    store.remove(KEY.remember);
    sessionStore.set(null);
    me = null;
    D = null;
    ui.lastNick = '';
    render();
  },
};

const forms = {
  auth: (f) => onAuth(f),
  todoadd: (f) => {
    const text = f.elements.text.value.trim();
    if (!text) return;
    (D.todos[ui.todoDate] ||= []).push({ id: uid(), text, done: false });
    save();
    render();
    $('[data-form="todoadd"] input')?.focus();
  },
  subadd: (f) => {
    const name = f.elements.name.value.trim();
    if (!name) return;
    D.subjects.push({ id: uid(), name, color: COLORS[D.subjects.length % COLORS.length] });
    save();
    subjectModal();
    $('[data-form="subadd"] input')?.focus();
  },
  dday: (f) => { D.examDate = f.elements.date.value; save(); closeModal(); },
  profile: (f) => {
    const all = users();
    if (all[me]) {
      all[me].goal = f.elements.goal.value.trim();
      all[me].motto = f.elements.motto.value.trim();
      store.set(KEY.users, all);
    }
    closeModal();
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
document.addEventListener('input', (e) => {
  if (e.target.dataset.input !== 'subname') return;
  const s = D.subjects.find((x) => x.id === e.target.dataset.id);
  const name = e.target.value.trim();
  if (s && name) { s.name = name; save(); }
});

setInterval(updateLive, 1000);

// ============================================================
// 시작
// ============================================================
(function boot() {
  const nick = store.get(KEY.remember, null) || sessionStore.get();
  if (nick && users()[nick]) signIn(nick);
  else render();
})();
