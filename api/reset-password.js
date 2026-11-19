// 비밀번호 초기화 (Vercel 서버 기능)
// 관리자(MICHO)가 앱의 '비밀번호 초기화 요청'에서 [초기화]를 누르면 불린다
// → 그 멤버의 비밀번호를 000000 으로 바꾼다. 멤버가 000000 으로 로그인하면 새 비밀번호를 정하는 창이 뜬다
// 필요한 설정: Vercel 환경 변수 FIREBASE_SERVICE_ACCOUNT = Firebase 서비스 계정 키(JSON 파일 내용 전체)
const ADMIN_UID = 'JmFNoGhEQlW9MTrwkLOb6TCcGsg2'; // firestore.rules 의 관리자와 같은 계정
const TEMP_PW = '000000';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 만 돼요' });
  try {
    // 불러오다 실패해도 서버가 멈추지 않고 이유를 알려주도록 여기서 불러온다
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ error: 'Vercel에 FIREBASE_SERVICE_ACCOUNT 환경 변수가 없어요' });
    if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    const auth = getAuth();

    // 부른 사람이 정말 관리자인지 로그인 표(ID 토큰)로 확인
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const caller = await auth.verifyIdToken(token).catch(() => null);
    if (!caller || caller.uid !== ADMIN_UID) return res.status(403).json({ error: '관리자만 초기화할 수 있어요' });

    const { uid } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!uid || uid === ADMIN_UID) return res.status(400).json({ error: '초기화할 멤버를 찾지 못했어요' });
    await auth.updateUser(uid, { password: TEMP_PW });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
};
