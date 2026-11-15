import { useSyncExternalStore } from 'react';

/* ═════════ API 명세서와 같은 모양의 데이터 (Capture 객체) ═════════
 * 서버 연동 시 이 타입 그대로 응답을 받아 넣으면 돼요.
 * 필드 이름도 명세서와 같게 snake_case 로 맞췄어요.
 */

export type CaptureStatus = 'ANALYZING' | 'FAILED' | 'TODO' | 'DONE' | 'REFERENCE';
/** 원본 속 위치 [x, y, w, h] (0~1 비율) */
export type Box = [number, number, number, number];
export type Category = { id: string; name: string; is_custom: boolean };
export type Fact = { key: string; label: string; value: string | null; box: Box | null; edited: boolean };
export type Deadline = {
  /** FOUND 기한 있음 · UNCLEAR 날짜는 있지만 기한인지 불명확 · NONE 기한 없음 */
  status: 'FOUND' | 'UNCLEAR' | 'NONE';
  date: string | null;
  label: string | null;
  box: Box | null;
};
export type Link = { type: string; label: string; url: string };
export type Guide = { title: string; lines: string[]; preparations: string[] };
export type ChecklistItem = { id: string; text: string; checked: boolean };

export type Capture = {
  id: string;
  file_key: string;
  status: CaptureStatus;
  category: Category | null;
  category_source: 'AI' | 'USER';
  title: string | null;
  summary: string | null;
  facts: Fact[];
  deadline: Deadline;
  links: Link[];
  /** 실천 방법을 만들지 못했으면 null */
  guide: Guide | null;
  checklist: ChecklistItem[];
  /** 보류: TODO 이면서 이 날짜가 있으면 보류 중 (YYYY-MM-DD) */
  snooze_until: string | null;
  next_alarm_at: string | null;
  folder_id: string | null;
  error: { code: string; message: string } | null;
  created_at: string;
  /** DONE 이면 완료한 시각 */
  status_changed_at: string;
  /** 앱 전용: 기기에서 불러온 사진 주소 (서버 필드 아님) */
  uri?: string;
};

/* ═════════ 카테고리 ═════════ */

// TODO(백엔드 확인): AI에게 주는 카테고리 목록과 맞춰야 해요
const BASE: Category[] = [
  { id: 'cat_food', name: '맛집', is_custom: false },
  { id: 'cat_cafe', name: '카페', is_custom: false },
  { id: 'cat_shop', name: '쇼핑', is_custom: false },
  { id: 'cat_contest', name: '공모전', is_custom: false },
  { id: 'cat_recipe', name: '레시피', is_custom: false },
  { id: 'cat_travel', name: '여행', is_custom: false },
  { id: 'cat_study', name: '공부', is_custom: false },
];
const ETC: Category = { id: 'cat_etc', name: '기타', is_custom: false };

export const BASE_CATEGORIES = BASE.map((c) => c.name);
export const ETC_CATEGORY = ETC.name;

/* ═════════ 날짜 유틸 ═════════ */

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function dayOffset(offset: number) {
  const d = todayStart();
  d.setDate(d.getDate() + offset);
  return dayKey(d);
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
/** YYYY-MM-DD 오전 9시 (알림 기본 시각) */
function at9(day: string) {
  return `${day}T09:00:00+09:00`;
}

/** 마감까지 남은 날. 오늘 0, 지났으면 음수. 기한이 확정되지 않았으면 null */
export function daysLeftOf(c: Capture): number | null {
  if (c.deadline.status !== 'FOUND' || !c.deadline.date) return null;
  return Math.round((parseDay(c.deadline.date).getTime() - todayStart().getTime()) / 86400000);
}
/** 보류 중: 다시 볼 날짜가 아직 오지 않음 */
export function isSnoozed(c: Capture) {
  return c.status === 'TODO' && !!c.snooze_until && parseDay(c.snooze_until) > todayStart();
}
export function isCaptureOverdue(c: Capture) {
  const left = daysLeftOf(c);
  return c.status === 'TODO' && !isSnoozed(c) && left !== null && left < 0;
}
/** 다음 주 같은 요일 (보류 기본값) */
export function nextWeekSameDay() {
  return dayOffset(7);
}

/* ═════════ 목업 데이터 (서버 연동 시 교체) ═════════ */

const cat = (name: string) => [...BASE, ETC].find((c) => c.name === name) ?? ETC;
const fact = (key: string, label: string, value: string | null, box: Box | null = null): Fact => ({
  key,
  label,
  value,
  box,
  edited: false,
});
const checklist = (id: string, texts: string[], done: number): ChecklistItem[] =>
  texts.map((text, i) => ({ id: `chk_${id}_${i + 1}`, text, checked: i < done }));

function capture(partial: Partial<Capture> & Pick<Capture, 'id' | 'title'>): Capture {
  return {
    file_key: `media:${partial.id}|Screenshot.jpg`,
    status: 'TODO',
    category: ETC,
    category_source: 'AI',
    summary: null,
    facts: [],
    deadline: { status: 'NONE', date: null, label: null, box: null },
    links: [],
    guide: null,
    checklist: [],
    snooze_until: null,
    next_alarm_at: null,
    folder_id: null,
    error: null,
    created_at: isoDaysAgo(1),
    status_changed_at: isoDaysAgo(1),
    ...partial,
  };
}

const SEED: Capture[] = [
  capture({
    id: 'cap_contest',
    title: 'AI 공모전 접수',
    summary: '대학생 AI 서비스 공모전',
    category: cat('공모전'),
    facts: [
      fact('host', '주최', '한국AI협회', [0.08, 0.2, 0.6, 0.04]),
      fact('target', '대상', '대학생 3~5인 팀', [0.08, 0.3, 0.7, 0.04]),
      fact('prize', '상금', '대상 300만 원', [0.08, 0.36, 0.5, 0.04]),
    ],
    deadline: { status: 'FOUND', date: dayOffset(-1), label: '접수 마감', box: [0.08, 0.44, 0.8, 0.05] },
    links: [{ type: 'WEB', label: '공모전 페이지 열기', url: 'https://example.com/ai-contest' }],
    guide: {
      title: '공모전 지원 가이드',
      lines: ['팀원을 먼저 모으고 역할을 나눠요.', '지원서 양식을 내려받아 미리 채워봐요.', '마감 하루 전까지 제출해요.'],
      preparations: ['팀원 명단', '지원서 양식', '포트폴리오'],
    },
    checklist: checklist('contest', ['팀원 모으기', '서류 준비하기', '지원서 제출하기'], 1),
    created_at: isoDaysAgo(9),
  }),
  capture({
    id: 'cap_soba',
    title: '연남 소바실',
    summary: '친구와 가을 한정 메뉴 먹기',
    category: cat('맛집'),
    facts: [
      fact('place', '장소', '서울 마포구 연남로 24', [0.06, 0.42, 0.88, 0.05]),
      fact('price', '가격', '메밀 소바 12,000원', [0.06, 0.55, 0.88, 0.05]),
      fact('hours', '영업시간', null),
    ],
    deadline: { status: 'FOUND', date: dayOffset(0), label: '행사 기한', box: [0.06, 0.48, 0.88, 0.05] },
    links: [{ type: 'WEB', label: '원문 링크 열기', url: 'https://example.com/soba' }],
    guide: {
      title: '맛집 방문 가이드',
      lines: ['행사 기한 안에 방문해요.', '주말에는 웨이팅이 있으니 예약을 먼저 해요.'],
      preparations: ['결제 수단', '이동 경로'],
    },
    checklist: checklist('soba', ['메뉴와 가격 확인하기', '친구랑 날짜 정하기', '예약하기', '방문하기'], 2),
    next_alarm_at: at9(dayOffset(0)),
    created_at: isoDaysAgo(6),
  }),
  capture({
    id: 'cap_jam',
    title: '가을 밤잼 만들기',
    summary: '주말에 재료 사서 만들어보기',
    category: cat('레시피'),
    facts: [fact('ingredients', '재료', '밤 500g, 설탕 200g', [0.1, 0.32, 0.8, 0.05]), fact('time', '소요 시간', '약 1시간', null)],
    deadline: { status: 'FOUND', date: dayOffset(2), label: '재료 할인 마감', box: [0.1, 0.6, 0.6, 0.04] },
    guide: { title: '레시피 따라 하기', lines: ['밤은 삶은 뒤 바로 껍질을 까야 잘 벗겨져요.'], preparations: ['냄비', '유리병'] },
    checklist: checklist('jam', ['재료 사기', '밤 손질하기', '잼 끓이기'], 0),
    next_alarm_at: at9(dayOffset(1)),
    created_at: isoDaysAgo(3),
  }),
  capture({
    id: 'cap_craft',
    title: '겨울 공예전',
    summary: '성수 갤러리 공예 전시',
    category: cat('여행'),
    facts: [fact('place', '장소', '성수동 갤러리 오브', [0.08, 0.5, 0.7, 0.05]), fact('price', '가격', null)],
    // 날짜는 있는데 전시 기간인지 마감인지 불명확한 경우
    deadline: { status: 'UNCLEAR', date: null, label: '날짜 확인 필요', box: [0.08, 0.58, 0.7, 0.05] },
    guide: { title: '전시 관람 가이드', lines: ['전시 기간을 원본에서 다시 확인해요.'], preparations: [] },
    checklist: checklist('craft', ['전시 기간 확인하기', '같이 갈 사람 정하기', '방문하기'], 0),
    created_at: isoDaysAgo(4),
  }),
  capture({
    id: 'cap_setting',
    title: '기억해 둘 화면',
    summary: '휴대폰 알림 설정 바꾸는 방법',
    category: ETC,
    guide: { title: '따라 하기', lines: ['설정 › 알림 › 앱별 알림에서 바꿀 수 있어요.'], preparations: [] },
    checklist: checklist('setting', ['알림 설정 바꾸기'], 0),
    created_at: isoDaysAgo(12),
  }),
  capture({
    id: 'cap_popup',
    title: '성수 팝업스토어',
    summary: null,
    category: cat('쇼핑'),
    // 실천 방법을 만들지 못한 경우 (guide null)
    guide: null,
    checklist: [],
    created_at: isoDaysAgo(0),
  }),
  capture({
    id: 'cap_line4',
    title: '4호선톤 지원',
    summary: '팀원 모이면 지원서 같이 쓰기',
    category: cat('공모전'),
    deadline: { status: 'FOUND', date: dayOffset(10), label: '지원 마감', box: null },
    guide: { title: '해커톤 지원 가이드', lines: ['팀 구성 후 아이디어를 한 줄로 정리해요.'], preparations: ['팀원 명단'] },
    checklist: checklist('line4', ['팀원 모으기', '서류 준비하기', '지원하기'], 1),
    snooze_until: dayOffset(5),
    next_alarm_at: at9(dayOffset(5)),
    created_at: isoDaysAgo(8),
  }),
  capture({
    id: 'cap_cafe',
    title: '성신여대 카페 찾기',
    category: cat('카페'),
    status: 'DONE',
    guide: { title: '카페 탐방', lines: ['조용히 작업하기 좋은 곳을 찾아요.'], preparations: [] },
    checklist: checklist('cafe', ['후보 카페 고르기', '직접 가보기'], 2),
    created_at: isoDaysAgo(15),
    status_changed_at: isoDaysAgo(3),
  }),
  capture({
    id: 'cap_muffler',
    title: '겨울 머플러 사기',
    category: cat('쇼핑'),
    status: 'DONE',
    guide: { title: '쇼핑 가이드', lines: ['세일 기간 안에 주문해요.'], preparations: [] },
    checklist: checklist('muffler', ['색 고르기', '사이즈 비교하기', '주문하기'], 3),
    created_at: isoDaysAgo(20),
    status_changed_at: isoDaysAgo(6),
  }),
];

/* ═════════ 스토어 ═════════ */

/**
 * 빈 화면 테스트용 스위치
 * - 'full': 예시 데이터 전부
 * - 'empty': 진행 · 완료 모두 비어 있음
 * - 'holdOnly': 진행은 비고 보류만 있음
 */
type MockMode = 'full' | 'empty' | 'holdOnly';
const MOCK_MODE = 'full' as MockMode;

const INITIAL: Capture[] =
  MOCK_MODE === 'empty' ? [] : MOCK_MODE === 'holdOnly' ? SEED.filter((c) => isSnoozed(c)) : SEED;

type State = { captures: Capture[]; customCategories: Category[] };

let state: State = { captures: INITIAL, customCategories: [] };
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 완료 · 보류 · 제외 직후 5초 동안 되돌리기 (명세서 UNDO) */
const UNDO_MS = 5000;
let undoSnapshot: { captures: Capture[]; expiresAt: number } | null = null;

function commit(captures: Capture[], undoable = false) {
  if (undoable) undoSnapshot = { captures: state.captures, expiresAt: Date.now() + UNDO_MS };
  setState({ ...state, captures });
}
function patch(ids: string[], fn: (c: Capture) => Capture, undoable = false) {
  const set = new Set(ids);
  commit(
    state.captures.map((c) => (set.has(c.id) ? fn(c) : c)),
    undoable,
  );
}
const now = () => new Date().toISOString();

/* ───────── 읽기 ───────── */

export function useCaptures() {
  return useSyncExternalStore(subscribe, () => state.captures);
}
export function useCapture(id: string) {
  return useSyncExternalStore(subscribe, () => state.captures.find((c) => c.id === id));
}
export function useCategoryList(): Category[] {
  const custom = useSyncExternalStore(subscribe, () => state.customCategories);
  return [...BASE, ...custom, ETC];
}
/** 카테고리 이름 목록 (실천함 칩·시트용) */
export function useCategories() {
  return useCategoryList().map((c) => c.name);
}

/* ───────── 실천함 목록용 요약 (명세서 목록 API 요약형에 해당) ───────── */

/**
 * 실천함 목록 한 줄 (명세서 GET /captures 의 '요약형'에 해당)
 * 요약형에는 facts · guide · checklist 가 없고 checklist_progress 만 와요.
 */
export type Practice = {
  id: string;
  title: string;
  category: string;
  /** 확정된 마감일 (FOUND 일 때만) */
  deadline: string | null;
  /** 마감 날짜가 불명확 (UNCLEAR) */
  deadlineUnclear: boolean;
  addedAt: string;
  completedAt: string | null;
  status: 'active' | 'hold' | 'done';
  summary: string | null;
  /** checklist_progress */
  progress: { done: number; total: number };
  /**
   * 다음에 할 단계 이름
   * TODO(백엔드 확인): 요약형에 next_step 필드 추가 요청. 오기 전까지는 summary 를 대신 보여줘요
   */
  nextStep: string | null;
  /** 실천 방법을 못 만듦 (체크리스트 0개) */
  guideMissing: boolean;
  snoozeUntil: string | null;
};

function toPractice(c: Capture): Practice {
  return {
    id: c.id,
    title: c.title ?? '제목 없음',
    category: c.category?.name ?? ETC.name,
    deadline: c.deadline.status === 'FOUND' ? c.deadline.date : null,
    deadlineUnclear: c.deadline.status === 'UNCLEAR',
    addedAt: c.created_at,
    completedAt: c.status === 'DONE' ? c.status_changed_at : null,
    status: c.status === 'DONE' ? 'done' : isSnoozed(c) ? 'hold' : 'active',
    summary: c.summary,
    progress: { done: c.checklist.filter((i) => i.checked).length, total: c.checklist.length },
    // 목업에서는 체크리스트가 있어서 계산할 수 있지만, 실제 목록 API에는 아직 없어요
    nextStep: c.checklist.find((i) => !i.checked)?.text ?? null,
    guideMissing: c.guide === null && c.checklist.length === 0,
    snoozeUntil: c.snooze_until,
  };
}

let practiceCache: { from: Capture[]; list: Practice[] } | null = null;
function selectPractices() {
  if (practiceCache?.from !== state.captures) {
    practiceCache = {
      from: state.captures,
      list: state.captures.filter((c) => c.status === 'TODO' || c.status === 'DONE').map(toPractice),
    };
  }
  return practiceCache.list;
}
export function usePractices() {
  return useSyncExternalStore(subscribe, selectPractices);
}

export function daysLeft(p: Practice): number | null {
  if (!p.deadline) return null;
  return Math.round((parseDay(p.deadline).getTime() - todayStart().getTime()) / 86400000);
}
export function isOverdue(p: Practice) {
  const left = daysLeft(p);
  return p.status === 'active' && left !== null && left < 0;
}

/* ───────── 쓰기 (명세서 POST /captures/{id}/actions 등) ───────── */

/** 완료 (COMPLETE). 체크리스트도 모두 체크된 상태로 보여줘요 */
export function completePractices(ids: string[]) {
  patch(
    ids,
    (c) => ({
      ...c,
      status: 'DONE',
      status_changed_at: now(),
      next_alarm_at: null,
      snooze_until: null,
      checklist: c.checklist.map((i) => ({ ...i, checked: true })),
    }),
    true,
  );
}

/** 보류 (SNOOZE). 날짜를 안 주면 다음 주 같은 요일 */
export function snoozeCaptures(ids: string[], until: string = nextWeekSameDay()) {
  patch(ids, (c) => ({ ...c, snooze_until: until, next_alarm_at: at9(until) }), true);
}

/** 보류 풀기: 지금 다시 하기 */
export function resumeCaptures(ids: string[]) {
  patch(ids, (c) => ({ ...c, snooze_until: null }));
}

/** 제외 (DISMISS = 명세서의 '안함'). 분석 내용을 지우고 보관함(참고)으로 옮겨요 */
export function excludePractices(ids: string[]) {
  patch(
    ids,
    (c) => ({
      ...c,
      status: 'REFERENCE',
      status_changed_at: now(),
      title: null,
      summary: null,
      category: null,
      facts: [],
      guide: null,
      checklist: [],
      links: [],
      deadline: { status: 'NONE', date: null, label: null, box: null },
      snooze_until: null,
      next_alarm_at: null,
    }),
    true,
  );
}

/** 되돌리기 (UNDO). 5초가 지났으면 false */
export function undoLast() {
  if (!undoSnapshot || Date.now() > undoSnapshot.expiresAt) return false;
  const prev = undoSnapshot.captures;
  undoSnapshot = null;
  setState({ ...state, captures: prev });
  return true;
}

/**
 * 체크리스트 체크 (PATCH /captures/{id}/checklist/{item_id})
 * 모두 체크되면 자동으로 완료해요. 완료됐으면 true
 */
export function toggleChecklist(id: string, itemId: string) {
  const target = state.captures.find((c) => c.id === id);
  if (!target) return false;
  const checklistNext = target.checklist.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
  const allDone = checklistNext.length > 0 && checklistNext.every((i) => i.checked);
  if (allDone && target.status === 'TODO') {
    patch(
      [id],
      (c) => ({ ...c, checklist: checklistNext, status: 'DONE', status_changed_at: now(), next_alarm_at: null, snooze_until: null }),
      true,
    );
    return true;
  }
  patch([id], (c) => ({ ...c, checklist: checklistNext }));
  return false;
}

/** 카테고리 변경 (PATCH /captures/{id}/category) */
export function changeCategory(ids: string[], categoryName: string) {
  const all = [...BASE, ...state.customCategories, ETC];
  const next = all.find((c) => c.name === categoryName);
  if (!next) return;
  patch(ids, (c) => ({ ...c, category: next, category_source: 'USER' }));
}

/** 추출 정보 수정 (PATCH /captures/{id}/facts). deadline 을 넘기면 마감도 바꿔요 (null = 마감 없음) */
export function updateFacts(id: string, values: Record<string, string>, deadline?: string | null) {
  patch([id], (c) => {
    const facts = c.facts.map((f) =>
      f.key in values ? { ...f, value: values[f.key].trim() || null, edited: true } : f,
    );
    let nextDeadline = c.deadline;
    if (deadline !== undefined) {
      nextDeadline = deadline
        ? { ...c.deadline, status: 'FOUND', date: deadline, label: c.deadline.label ?? '마감' }
        : { status: 'NONE', date: null, label: null, box: null };
    }
    return { ...c, facts, deadline: nextDeadline };
  });
}

/** 링크 수정 */
export function updateLink(id: string, url: string) {
  patch([id], (c) => {
    const trimmed = url.trim();
    if (!trimmed) return { ...c, links: [] };
    const first = c.links[0] ?? { type: 'WEB', label: '원문 링크 열기', url: '' };
    return { ...c, links: [{ ...first, url: trimmed }, ...c.links.slice(1)] };
  });
}

/**
 * 다시 하기
 * TODO(백엔드 확인): 명세서 REOPEN 은 완료 항목을 진행으로 '옮기는' 방식이에요.
 * 지금은 팀 결정대로 완료 기록은 두고 복제해서 진행에 새로 담아요.
 */
export function redoPractices(ids: string[]) {
  const set = new Set(ids);
  const stamp = Date.now();
  const copies = state.captures
    .filter((c) => set.has(c.id))
    .map<Capture>((c, i) => ({
      ...c,
      id: `${c.id}_again_${stamp}_${i}`,
      status: 'TODO',
      created_at: new Date(stamp).toISOString(),
      status_changed_at: new Date(stamp).toISOString(),
      deadline: { status: 'NONE', date: null, label: null, box: null },
      snooze_until: null,
      next_alarm_at: null,
      checklist: c.checklist.map((item) => ({ ...item, checked: false })),
    }));
  commit([...copies, ...state.captures]);
  return copies.map((c) => c.id);
}

/** 다시 분석 (POST /captures/{id}/analysis). 목업이라 잠깐 뒤 기본 가이드를 채워요 */
export function reanalyze(id: string) {
  patch([id], (c) => ({ ...c, status: 'ANALYZING' }));
  setTimeout(() => {
    patch([id], (c) => ({
      ...c,
      status: 'TODO',
      summary: c.summary ?? '원본 내용을 다시 정리했어요',
      guide: { title: '실천 가이드', lines: ['원본을 다시 확인하고 필요한 일을 정리해요.'], preparations: [] },
      checklist: checklist(c.id, ['원본 내용 확인하기', '실천하기'], 0),
    }));
  }, 1500);
}

/** 카테고리 추가 (POST /categories). 이미 있으면 false */
export function addCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const all = [...BASE, ETC, ...state.customCategories];
  if (all.some((c) => c.name === trimmed)) return false;
  setState({
    ...state,
    customCategories: [...state.customCategories, { id: `cat_custom_${Date.now()}`, name: trimmed, is_custom: true }],
  });
  return true;
}

/* ───────── 완료율 (명세서 GET /stats/completion) ───────── */

export type CompletionStats = {
  done_count: number;
  todo_count: number;
  /** 완료 ÷ (완료 + 실천 대기). 실천 대상이 없으면 null */
  rate: number | null;
  /** 최근 6주, 완료함 그래프용 */
  weekly: { week_start: string; rate: number | null }[];
};

let statsCache: { from: Capture[]; stats: CompletionStats } | null = null;
function selectStats(): CompletionStats {
  if (statsCache?.from === state.captures) return statsCache.stats;
  const list = state.captures.filter((c) => c.status === 'TODO' || c.status === 'DONE');
  const done = list.filter((c) => c.status === 'DONE');
  const total = list.length;

  // 이번 주 월요일
  const monday = todayStart();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekly = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(monday);
    start.setDate(start.getDate() - (5 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    // 그 주가 끝날 때까지 담긴 것 중 완료한 비율 (목업 계산)
    const added = list.filter((c) => new Date(c.created_at) < end);
    const doneBy = added.filter((c) => c.status === 'DONE' && new Date(c.status_changed_at) < end);
    return { week_start: dayKey(start), rate: added.length ? doneBy.length / added.length : null };
  });

  statsCache = {
    from: state.captures,
    stats: { done_count: done.length, todo_count: total - done.length, rate: total ? done.length / total : null, weekly },
  };
  return statsCache.stats;
}
export function useCompletionStats() {
  return useSyncExternalStore(subscribe, selectStats);
}
