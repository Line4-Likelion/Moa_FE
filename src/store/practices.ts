import { useEffect, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';
import { MOCK_FAIL } from '../mock/failures';
import * as api from '../services/api';
import { USE_SERVER } from '../services/config';
import { ImageManipulator, MediaLibrary } from '../services/native';

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
  /** 앱 전용: 분석 중일 때 진행 단계 (GET /analysis-jobs 의 step) */
  job_step?: AnalysisStep;
  /** 앱 전용(서버): 목록 응답의 체크리스트 진행도. 상세를 받기 전에 진행 막대를 그리는 데 써요 */
  progress?: { done: number; total: number };
  /** 앱 전용(서버): 상세(핵심 정보·가이드·체크리스트)를 받아왔는지 */
  detail_loaded?: boolean;
};

/**
 * 분석 단계 (서버 GET /analysis-jobs 의 step: OCR → CATEGORIZE → DONE)
 * DONE 은 앱에서 GUIDE(마무리)로 보여줘요
 */
export type AnalysisStep = 'OCR' | 'CATEGORIZE' | 'GUIDE';
export const ANALYSIS_STEPS: AnalysisStep[] = ['OCR', 'CATEGORIZE', 'GUIDE'];
export const ANALYSIS_STEP_LABEL: Record<AnalysisStep, string> = {
  OCR: '원문 정보 확인',
  CATEGORIZE: '카테고리·실천 방법 정리',
  GUIDE: '마무리',
};

/* ═════════ 카테고리 ═════════ */

// TODO(백엔드 확인): AI에게 주는 카테고리 목록과 맞춰야 해요
const MOCK_BASE: Category[] = [
  { id: 'cat_food', name: '맛집', is_custom: false },
  { id: 'cat_cafe', name: '카페', is_custom: false },
  { id: 'cat_shop', name: '쇼핑', is_custom: false },
  { id: 'cat_contest', name: '공모전', is_custom: false },
  { id: 'cat_recipe', name: '레시피', is_custom: false },
  { id: 'cat_travel', name: '여행', is_custom: false },
  { id: 'cat_study', name: '공부', is_custom: false },
];
/** 서버가 모든 사용자에게 기본으로 만들어 주는 카테고리 (백엔드 DefaultCategory 와 같아야 해요) */
const SERVER_BASE: Category[] = ['패션', '맛집', '여행', '레시피', '정보', '생활'].map((name) => ({
  id: `default:${name}`,
  name,
  is_custom: false,
}));
const BASE: Category[] = USE_SERVER ? SERVER_BASE : MOCK_BASE;
const ETC: Category = { id: USE_SERVER ? 'default:기타' : 'cat_etc', name: '기타', is_custom: false };

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

function capture(partial: Partial<Capture> & Pick<Capture, 'id'> & { title: string | null }): Capture {
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
  // 홈 '분석 중 · 실패' 영역용 (명세서: 분석 중·실패 항목은 홈에만 보여요)
  capture({
    id: 'cap_analyzing',
    title: null,
    status: 'ANALYZING',
    job_step: 'CATEGORIZE',
    created_at: isoDaysAgo(0),
  }),
  capture({
    id: 'cap_failed',
    title: null,
    status: 'FAILED',
    error: { code: 'ANALYSIS_FAILED', message: '사진을 끝까지 분석하지 못했어요' },
    created_at: isoDaysAgo(0),
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

type State = { captures: Capture[]; customCategories: Category[]; serverCategories: Category[] | null };

/** 서버가 보관하는 AI 원래 값 (facts 를 value: null 로 PATCH 하면 이 값으로 되돌아가요). 목업용 */
const aiOriginal = new Map<string, string | null>(
  INITIAL.flatMap((c) => c.facts.map((f) => [`${c.id}:${f.key}`, f.value] as [string, string | null])),
);

let state: State = { captures: USE_SERVER ? [] : INITIAL, customCategories: [], serverCategories: null };
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

/** 저장 실패 흉내 (목업). 실제로는 서버 응답이 실패면 false — 화면은 이전 상태를 그대로 둬요 */
const saveFails = () => MOCK_FAIL.actionSave;

/* ───────── 읽기 ───────── */

export function useCaptures() {
  return useSyncExternalStore(subscribe, () => state.captures);
}
export function useCapture(id: string) {
  const capture = useSyncExternalStore(subscribe, () => state.captures.find((c) => c.id === id));
  // 서버 모드: 상세는 화면을 열 때 한 번 받아와요
  useEffect(() => {
    if (USE_SERVER && id) void ensureDetail(id);
    // 사진 주소가 비어 있으면 다시 찾아요 (처음 열 때 실패했던 경우)
    fillMissingUris();
  }, [id]);
  return capture;
}
/** 지금 쓰는 카테고리 목록 (서버에서 받았으면 그 목록, 아니면 기본 목록) */
function categoryListNow(): Category[] {
  return state.serverCategories ?? [...BASE, ...state.customCategories, ETC];
}
export function useCategoryList(): Category[] {
  useSyncExternalStore(subscribe, () => state.serverCategories);
  const custom = useSyncExternalStore(subscribe, () => state.customCategories);
  return state.serverCategories ?? [...BASE, ...custom, ETC];
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
  /** 기기 사진 주소 (있으면 썸네일로) */
  uri?: string;
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
    uri: c.uri,
    category: c.category?.name ?? ETC.name,
    deadline: c.deadline.status === 'FOUND' ? c.deadline.date : null,
    deadlineUnclear: c.deadline.status === 'UNCLEAR',
    addedAt: c.created_at,
    completedAt: c.status === 'DONE' ? c.status_changed_at : null,
    status: c.status === 'DONE' ? 'done' : isSnoozed(c) ? 'hold' : 'active',
    summary: c.summary,
    progress: c.checklist.length
      ? { done: c.checklist.filter((i) => i.checked).length, total: c.checklist.length }
      : (c.progress ?? { done: 0, total: 0 }),
    // 목업에서는 체크리스트가 있어서 계산할 수 있지만, 실제 목록 API에는 아직 없어요
    nextStep: c.checklist.find((i) => !i.checked)?.text ?? null,
    // 서버 모드: 상세를 받기 전에는 가이드가 없는 건지 알 수 없어서 '없음'으로 보지 않아요
    guideMissing:
      c.guide === null && c.checklist.length === 0 && !(c.progress && c.progress.total > 0) && (!USE_SERVER || !!c.detail_loaded),
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
  if (saveFails()) return false;
  if (USE_SERVER) serverAction(ids, 'COMPLETE', {}, true);
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
  return true;
}

/** 보류 (SNOOZE). 날짜를 안 주면 다음 주 같은 요일 */
export function snoozeCaptures(ids: string[], until: string = nextWeekSameDay()) {
  if (saveFails()) return false;
  if (USE_SERVER) serverAction(ids, 'SNOOZE', { snooze_until: until }, true);
  patch(ids, (c) => ({ ...c, snooze_until: until, next_alarm_at: at9(until) }), true);
  return true;
}

/** 보류 풀기: 지금 다시 하기 */
export function resumeCaptures(ids: string[]) {
  // 서버는 보류 해제 API 가 없어서 '오늘 날짜로 보류'해서 풀어요 (보류는 오늘 이후일 때만 적용돼요)
  if (USE_SERVER) serverAction(ids, 'SNOOZE', { snooze_until: dayKey(new Date()) });
  patch(ids, (c) => ({ ...c, snooze_until: null }));
}

/** 제외 (DISMISS = 명세서의 '안함'). 분석 내용을 지우고 참고함(참고)으로 옮겨요 */
export function excludePractices(ids: string[]) {
  if (saveFails()) return false;
  if (USE_SERVER) serverAction(ids, 'DISMISS', {}, true);
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
  return true;
}

/** 되돌리기 (UNDO). 5초가 지났으면 false */
export function undoLast() {
  if (!undoSnapshot || Date.now() > undoSnapshot.expiresAt) return false;
  const prev = undoSnapshot.captures;
  undoSnapshot = null;
  setState({ ...state, captures: prev });
  if (USE_SERVER) serverUndo();
  return true;
}

/**
 * 체크리스트 체크 (PATCH /captures/{id}/checklist/{item_id})
 * 모두 체크되면 자동으로 완료해요
 */
export function toggleChecklist(id: string, itemId: string): 'toggled' | 'completed' | 'failed' {
  // 실패하면 이전 체크 상태 그대로 (명세서)
  if (saveFails()) return 'failed';
  const target = state.captures.find((c) => c.id === id);
  if (!target) return 'failed';
  const checklistNext = target.checklist.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
  const allDone = checklistNext.length > 0 && checklistNext.every((i) => i.checked);
  if (USE_SERVER) {
    const item = checklistNext.find((i) => i.id === itemId);
    api.checkChecklistItem(id, itemId, !!item?.checked).catch((error) => {
      notifyError(error);
      void ensureDetail(id, true);
    });
    // 서버는 전부 체크해도 자동 완료하지 않아서, 앱이 완료도 같이 보내요
    if (allDone && target.status === 'TODO') serverAction([id], 'COMPLETE', {}, true);
  }
  if (allDone && target.status === 'TODO') {
    patch(
      [id],
      (c) => ({ ...c, checklist: checklistNext, status: 'DONE', status_changed_at: now(), next_alarm_at: null, snooze_until: null }),
      true,
    );
    return 'completed';
  }
  patch([id], (c) => ({ ...c, checklist: checklistNext }));
  return 'toggled';
}

/** 카테고리 변경 (PATCH /captures/{id}/category) */
export function changeCategory(ids: string[], categoryName: string) {
  if (saveFails()) return false;
  const all = categoryListNow();
  const next = all.find((c) => c.name === categoryName);
  if (!next) return false;
  if (USE_SERVER) {
    const categoryId = Number(next.id);
    if (!Number.isNaN(categoryId)) {
      Promise.all(ids.map((cid) => api.changeCaptureCategory(cid, categoryId))).catch((error) => {
        notifyError(error);
        void refreshAll();
      });
    }
  }
  patch(ids, (c) => ({ ...c, category: next, category_source: 'USER' }));
  return true;
}

/** 추출 정보 수정 (PATCH /captures/{id}/facts). deadline 을 넘기면 마감도 바꿔요 (null = 마감 없음) */
export function updateFacts(id: string, values: Record<string, string>, deadline?: string | null) {
  if (saveFails()) return false;
  if (USE_SERVER) {
    const facts = Object.entries(values).map(([key, value]) => ({ key, value: value.trim() || null }));
    // 서버는 value: null 을 'AI 값으로 되돌리기'로 받아요. 그래서 '마감 없음'은 빈 문자열로 보내요
    // TODO(백엔드 확인): 빈 문자열("")을 '마감 없음'으로 처리하는지
    if (deadline !== undefined) facts.push({ key: 'deadline', value: deadline ?? '' });
    if (facts.length) {
      api
        .patchFacts(id, facts)
        .then((detail) => upsert(fromServer(detail, state.captures.find((c) => c.id === id))))
        .catch((error) => {
          notifyError(error);
          void ensureDetail(id, true);
        });
    }
  }
  patch([id], (c) => {
    const facts = c.facts.map((f) =>
      f.key in values || (f.key === 'deadline' && deadline !== undefined)
        ? { ...f, value: f.key === 'deadline' ? (deadline ?? null) : values[f.key].trim() || null, edited: true }
        : f,
    );
    let nextDeadline = c.deadline;
    if (deadline !== undefined) {
      nextDeadline = deadline
        ? { ...c.deadline, status: 'FOUND', date: deadline, label: c.deadline.label ?? '마감' }
        : { status: 'NONE', date: null, label: null, box: null };
    }
    return { ...c, facts, deadline: nextDeadline };
  });
  return true;
}

/** AI가 읽은 값으로 되돌리기 (PATCH /captures/{id}/facts 에 value: null) */
export function revertFact(id: string, key: string) {
  if (saveFails()) return false;
  if (USE_SERVER) {
    // 서버가 AI 가 읽은 값으로 되돌려서 돌려줘요
    api
      .patchFacts(id, [{ key, value: null }])
      .then((detail) => upsert(fromServer(detail, state.captures.find((c) => c.id === id))))
      .catch((error) => {
        notifyError(error);
        void ensureDetail(id, true);
      });
    patch([id], (c) => ({ ...c, facts: c.facts.map((f) => (f.key === key ? { ...f, edited: false } : f)) }));
    return true;
  }
  patch([id], (c) => ({
    ...c,
    facts: c.facts.map((f) => (f.key === key ? { ...f, value: aiOriginal.get(`${id}:${key}`) ?? null, edited: false } : f)),
  }));
  return true;
}

/**
 * 다시 하기
 * TODO(백엔드 확인): 명세서 REOPEN 은 완료 항목을 진행으로 '옮기는' 방식이에요.
 * 지금은 팀 결정대로 완료 기록은 두고 복제해서 진행에 새로 담아요.
 */
export function redoPractices(ids: string[]) {
  if (saveFails()) return null;
  if (USE_SERVER) {
    // 서버는 완료 항목을 진행으로 '옮겨요' (REOPEN). 같은 id 를 그대로 써요
    serverAction(ids, 'REOPEN');
    patch(ids, (c) => ({
      ...c,
      status: 'TODO',
      status_changed_at: now(),
      snooze_until: null,
      checklist: c.checklist.map((i) => ({ ...i, checked: false })),
    }));
    return ids;
  }
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

/**
 * 다시 분석 (POST /captures/{id}/analysis → GET /analysis-jobs 로 진행 확인)
 * 목업이라 단계를 0.8초씩 넘기고 기본 가이드를 채워요. 실패 테스트는 fail = true
 */
export function reanalyze(id: string, fail = false) {
  if (USE_SERVER) {
    const c = state.captures.find((x) => x.id === id);
    if (c) void startAnalysis(id, c.file_key, c.uri);
    return;
  }
  const steps: AnalysisStep[] = ANALYSIS_STEPS;
  patch([id], (c) => ({ ...c, status: 'ANALYZING', error: null, job_step: 'OCR' }));
  steps.forEach((step, i) => {
    setTimeout(() => patch([id], (c) => ({ ...c, job_step: step })), i * 800);
  });
  setTimeout(() => {
    if (fail) {
      patch([id], (c) => ({
        ...c,
        status: 'FAILED',
        job_step: undefined,
        error: { code: 'ANALYSIS_TIMEOUT', message: '요청은 접수됐지만 분석이 중단됐어요' },
      }));
      return;
    }
    patch([id], (c) => ({
      ...c,
      status: 'TODO',
      job_step: undefined,
      summary: c.summary ?? '원본 내용을 다시 정리했어요',
      guide: { title: '실천 가이드', lines: ['원본을 다시 확인하고 필요한 일을 정리해요.'], preparations: [] },
      checklist: checklist(c.id, ['원본 내용 확인하기', '실천하기'], 0),
    }));
  }, steps.length * 800);
}

/** 카테고리 추가 (POST /categories). 이미 있으면 false */
export function addCategory(name: string): boolean | Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const all = categoryListNow();
  if (all.some((c) => c.name === trimmed)) return false;
  if (USE_SERVER) return addServerCategory(trimmed);
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

/* ───────── 분류 (명세서 POST /captures/classify, PATCH /captures/{id}/sort) ───────── */

/** 목업 분석 결과 (서버 연결 전 예시). 차례대로 돌려 써요 */
const MOCK_RESULTS: { title: string; summary: string; category: string; steps: string[]; deadlineIn: number | null }[] = [
  { title: '홍대 파티룸 예약', summary: '연말 모임 장소 잡기', category: '여행', steps: ['날짜 정하기', '인원 확인하기', '예약하기'], deadlineIn: 6 },
  { title: '토익 스피킹 접수', summary: '12월 정기시험', category: '공부', steps: ['시험 날짜 고르기', '접수하기'], deadlineIn: 3 },
  { title: '을지로 카페 가보기', summary: '조용한 작업 카페', category: '카페', steps: ['위치 확인하기', '방문하기'], deadlineIn: null },
  { title: '겨울 코트 사기', summary: '블랙프라이데이 할인', category: '쇼핑', steps: ['사이즈 비교하기', '주문하기'], deadlineIn: 4 },
];
let mockResultIndex = 0;

/**
 * 스와이프로 분류 (좌 ACT / 우 REF). 만든 캡처 id 를 돌려줘요
 * ACT 는 바로 이미지 업로드 → 분석 (needs_upload: true)
 */
export function classifyShot(shot: { id: string; capturedAt: string; uri?: string }, sort: 'ACT' | 'REF') {
  // 저장 실패 (500): 화면은 선택을 그대로 두고 재시도를 안내해요
  if (MOCK_FAIL.classifySave) throw new Error('분류를 저장하지 못했어요');
  const id = `cap_${shot.id}_${Date.now()}`;
  const base = capture({
    id,
    title: null,
    file_key: `media:${shot.id}|Screenshot.jpg`,
    uri: shot.uri,
    status: sort === 'ACT' ? 'ANALYZING' : 'REFERENCE',
    category: null,
    job_step: sort === 'ACT' ? 'OCR' : undefined,
    created_at: now(),
    status_changed_at: now(),
  });
  commit([base, ...state.captures]);
  if (sort === 'ACT') {
    // 분석 한도 초과 (429): 분류는 저장됐지만 분석은 못 해서 홈에 '실패'로 보여요
    if (MOCK_FAIL.analysisLimit) {
      patch([id], (c) => ({
        ...c,
        status: 'FAILED',
        job_step: undefined,
        error: { code: 'RATE_LIMITED', message: '오늘 분석할 수 있는 장수를 다 썼어요' },
      }));
    } else runMockAnalysis(id);
  }
  return id;
}

/** 분류 바꾸기 · 취소 (PATCH /captures/{id}/sort). NONE 이면 서버 기록 삭제 → 다시 미분류 */
export function changeSort(captureId: string, sort: 'ACT' | 'REF' | 'NONE') {
  if (sort === 'NONE') {
    commit(state.captures.filter((c) => c.id !== captureId));
    return;
  }
  if (sort === 'REF') {
    patch([captureId], (c) => ({
      ...c,
      status: 'REFERENCE',
      job_step: undefined,
      title: null,
      summary: null,
      category: null,
      facts: [],
      guide: null,
      checklist: [],
      deadline: { status: 'NONE', date: null, label: null, box: null },
      next_alarm_at: null,
    }));
    return;
  }
  patch([captureId], (c) => ({ ...c, status: 'ANALYZING', job_step: 'OCR' }));
  if (USE_SERVER) {
    // 서버 분류는 이미 바뀌었어요. 실천으로 바꿨으니 사진을 다시 올려 분석해요
    const c = state.captures.find((x) => x.id === captureId);
    if (c) void startAnalysis(captureId, c.file_key, c.uri);
    return;
  }
  runMockAnalysis(captureId);
}

/** 목업 분석: 단계를 넘기다가 예시 결과를 채워요 */
function runMockAnalysis(id: string) {
  const steps: AnalysisStep[] = ANALYSIS_STEPS;
  steps.forEach((step, i) => setTimeout(() => patch([id], (c) => (c.status === 'ANALYZING' ? { ...c, job_step: step } : c)), i * 900));
  setTimeout(() => {
    const r = MOCK_RESULTS[mockResultIndex++ % MOCK_RESULTS.length];
    patch([id], (c) =>
      c.status !== 'ANALYZING'
        ? c
        : {
            ...c,
            status: 'TODO',
            job_step: undefined,
            title: r.title,
            summary: r.summary,
            category: cat(r.category),
            deadline:
              r.deadlineIn === null
                ? { status: 'NONE', date: null, label: null, box: null }
                : { status: 'FOUND', date: dayOffset(r.deadlineIn), label: '마감', box: null },
            guide: { title: '실천 가이드', lines: ['원본 내용을 보고 필요한 일을 정리했어요.'], preparations: [] },
            checklist: checklist(id, r.steps, 0),
            next_alarm_at: r.deadlineIn === null ? null : at9(dayOffset(Math.max(r.deadlineIn - 1, 0))),
          },
    );
  }, steps.length * 900);
}


/* ═════════════════════════════════════════════════════════════════════
 * 서버 연동 (USE_SERVER = .env.local 에 EXPO_PUBLIC_API_URL 이 있을 때)
 * 화면에는 바로 반영(낙관적 업데이트)하고, 서버에 보낸 뒤 실패하면 알리고 다시 받아와요.
 * ═════════════════════════════════════════════════════════════════════ */

const NO_DEADLINE: Deadline = { status: 'NONE', date: null, label: null, box: null };

/** 오류 알림 (짧은 시간에 여러 번 뜨지 않게) */
let lastAlertAt = 0;
function notifyError(error: unknown) {
  console.warn('[moa] 요청 실패', error);
  if (Date.now() - lastAlertAt < 3000) return;
  lastAlertAt = Date.now();
  Alert.alert('요청하지 못했어요', api.errorMessage(error));
}

function toCategory(c: { id: number; name: string; is_custom: boolean } | null): Category | null {
  return c ? { id: String(c.id), name: c.name, is_custom: c.is_custom } : null;
}

/** 서버 응답 → 앱 데이터. 목록(요약형)에는 상세가 없어서, 이미 받아 둔 상세는 지우지 않고 이어 써요 */
function fromServer(s: api.ServerCapture, prev?: Capture): Capture {
  return {
    id: String(s.id),
    file_key: s.file_key,
    status: s.status,
    category: toCategory(s.category),
    category_source: s.category_source ?? prev?.category_source ?? 'AI',
    title: s.title,
    summary: s.summary,
    facts: s.facts ?? prev?.facts ?? [],
    deadline: s.deadline ?? NO_DEADLINE,
    links: s.links ?? prev?.links ?? [],
    guide: s.guide !== undefined ? s.guide : (prev?.guide ?? null),
    checklist: s.checklist ?? prev?.checklist ?? [],
    snooze_until: s.snooze_until,
    next_alarm_at: s.next_alarm_at !== undefined ? s.next_alarm_at : (prev?.next_alarm_at ?? null),
    folder_id: null,
    error: s.error !== undefined ? s.error : (prev?.error ?? null),
    created_at: s.created_at,
    status_changed_at: s.status_changed_at,
    uri: prev?.uri,
    job_step: prev?.job_step,
    progress: s.checklist_progress ?? prev?.progress,
    detail_loaded: s.checklist !== undefined ? true : prev?.detail_loaded,
  };
}

function upsert(capture: Capture) {
  const exists = state.captures.some((c) => c.id === capture.id);
  commit(exists ? state.captures.map((c) => (c.id === capture.id ? capture : c)) : [capture, ...state.captures]);
}

/** 앱 안에서만 들고 있던 항목을 지워요 (분류 취소 · 참고로 변경 등) */
export function dropCapture(id: string) {
  detailLoaded.delete(id);
  commit(state.captures.filter((c) => c.id !== id));
}

/** 로그아웃 시 앱 안의 데이터를 비워요 */
export function resetStore() {
  detailLoaded.clear();
  undoTokens = null;
  setState({ captures: USE_SERVER ? [] : INITIAL, customCategories: [], serverCategories: null });
}

/* ───────── 기기 사진 주소 (file_key = 기기 사진 ID) ───────── */

const uriCache = new Map<string, string | null>();
async function resolveUri(fileKey: string): Promise<string | null> {
  if (Platform.OS === 'web' || !MediaLibrary) return null;
  if (uriCache.has(fileKey)) return uriCache.get(fileKey) ?? null;
  // 안드로이드: 사진 ID(숫자)로 주소를 바로 만들어요.
  // getAssetInfoAsync 는 사진 위치(EXIF)까지 읽으려다 ACCESS_MEDIA_LOCATION 권한이 없으면 실패해서 쓰지 않아요
  if (Platform.OS === 'android' && /^\d+$/.test(fileKey)) {
    const uri = `content://media/external/images/media/${fileKey}`;
    uriCache.set(fileKey, uri);
    return uri;
  }
  try {
    const info = await MediaLibrary.getAssetInfoAsync(fileKey);
    const uri = info?.localUri ?? info?.uri ?? null;
    // 찾은 주소만 기억해요. 실패(권한 받기 전 등)는 기억하지 않아서 다음에 다시 찾아요
    if (uri) uriCache.set(fileKey, uri);
    return uri;
  } catch (error) {
    console.warn('[moa] 기기 사진 주소를 찾지 못했어요', fileKey, error);
    return null;
  }
}
/** 화면에 바로 못 그리는 주소 (없음, 아이폰 ph://) */
const needsUri = (uri?: string) => !uri || uri.startsWith('ph://');
let resolving = false;
async function fillUris() {
  if (resolving) return;
  resolving = true;
  try {
    for (const c of state.captures.filter((x) => needsUri(x.uri))) {
      const uri = await resolveUri(c.file_key);
      if (uri) patch([c.id], (x) => ({ ...x, uri }));
    }
  } finally {
    resolving = false;
  }
}

/** 사진이 비어 있는 항목의 주소를 다시 찾아요. 실천함·홈 화면에 들어올 때 불러요 */
export function fillMissingUris() {
  if (state.captures.some((c) => needsUri(c.uri))) void fillUris();
}

/* ───────── 불러오기 ───────── */

let refreshing: Promise<void> | null = null;

/** 카테고리 + 실천 대기 · 완료 · 참고 캡처를 모두 새로 받아와요 */
export function refreshAll(): Promise<void> {
  if (!USE_SERVER || !api.isLoggedIn()) return Promise.resolve();
  refreshing ??= (async () => {
    try {
      const [cats, todo, done, reference] = await Promise.all([
        api.getCategories(),
        api.getAllCaptures('TODO'),
        api.getAllCaptures('DONE'),
        api.getAllCaptures('REFERENCE'),
      ]);
      const prevById = new Map(state.captures.map((c) => [c.id, c]));
      const fromApi = [...todo, ...done, ...reference].map((s) => fromServer(s, prevById.get(String(s.id))));
      const ids = new Set(fromApi.map((c) => c.id));
      // 목록 API 에는 분석 중·실패 항목이 없어서, 앱이 추적 중인 것은 남겨 둬요
      const pending = state.captures.filter((c) => (c.status === 'ANALYZING' || c.status === 'FAILED') && !ids.has(c.id));
      setState({
        ...state,
        serverCategories: cats.map((c) => ({ id: String(c.id), name: c.name, is_custom: c.is_custom })),
        captures: [...pending, ...fromApi],
      });
      void fillUris();
    } catch (error) {
      console.warn('[moa] 목록을 불러오지 못했어요', error);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** 상세(핵심 정보·링크·가이드·체크리스트)는 열 때 한 번 받아와요 */
const detailLoaded = new Set<string>();
async function ensureDetail(id: string, force = false) {
  if (!USE_SERVER || !api.isLoggedIn() || (!force && detailLoaded.has(id))) return;
  detailLoaded.add(id);
  try {
    const detail = await api.getCaptureDetail(id);
    const prev = state.captures.find((c) => c.id === id);
    const next = fromServer(detail, prev);
    upsert({ ...next, detail_loaded: true });
    if (needsUri(next.uri)) {
      const uri = await resolveUri(next.file_key);
      if (uri) patch([id], (c) => ({ ...c, uri }));
    }
  } catch (error) {
    detailLoaded.delete(id);
    console.warn('[moa] 상세를 불러오지 못했어요', error);
  }
}

/* ───────── 상태 변경 (POST /captures/{id}/actions) ───────── */

let undoTokens: Promise<{ id: string; token: string }[]> | null = null;

function serverAction(
  ids: string[],
  action: api.CaptureActionName,
  extra: { snooze_until?: string } = {},
  undoable = false,
) {
  const requests = Promise.allSettled(ids.map((id) => api.actOnCapture(id, action, extra)));
  const tokens = requests.then((results) => {
    const list: { id: string; token: string }[] = [];
    let failed: unknown = null;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        failed = r.reason;
        return;
      }
      if (r.value.undo) list.push({ id: ids[i], token: r.value.undo.token });
    });
    if (failed) {
      notifyError(failed);
    }
    // 성공이든 실패든 서버 기준으로 다시 맞춰요 (실패하면 화면이 원래대로 돌아와요)
    void refreshAll();
    return list;
  });
  if (undoable) undoTokens = tokens;
}

/** 되돌리기 (UNDO). 화면은 이미 되돌렸고, 서버에도 알려요 */
function serverUndo() {
  const tokens = undoTokens;
  undoTokens = null;
  if (!tokens) return;
  void tokens
    .then((list) => Promise.allSettled(list.map((t) => api.actOnCapture(t.id, 'UNDO', { token: t.token }))))
    .then(() => refreshAll());
}

/* ───────── 카테고리 추가 (POST /categories) ───────── */

async function addServerCategory(name: string): Promise<boolean> {
  try {
    const created = await api.createCategory(name);
    const category: Category = { id: String(created.id), name: created.name, is_custom: created.is_custom ?? true };
    // 서버 순서: 기본 → 내가 만든 것 → 기타
    const list = state.serverCategories ?? [...BASE, ...state.customCategories, ETC];
    const etc = list.filter((c) => c.name === ETC.name);
    const rest = list.filter((c) => c.name !== ETC.name);
    setState({ ...state, serverCategories: [...rest, category, ...etc] });
    return true;
  } catch (error) {
    if (error instanceof api.ApiError && error.code === 'DUPLICATE_NAME') return false;
    throw error;
  }
}

/* ───────── 분류 · AI 분석 ───────── */

/**
 * 서버에 분류를 저장한 사진을 앱 목록에 넣어요. recordId 는 서버가 돌려준 분류 id 이고, 캡처 id 와 같아요.
 * 실천(ACT)이면 사진을 올려 AI 분석을 시작해요.
 */
export function registerClassified(
  recordId: number,
  shot: { id: string; capturedAt: string; uri?: string },
  sort: 'ACT' | 'REF',
) {
  const id = String(recordId);
  const stamp = now();
  upsert({
    id,
    file_key: shot.id,
    status: sort === 'ACT' ? 'ANALYZING' : 'REFERENCE',
    category: null,
    category_source: 'AI',
    title: null,
    summary: null,
    facts: [],
    deadline: NO_DEADLINE,
    links: [],
    guide: null,
    checklist: [],
    snooze_until: null,
    next_alarm_at: null,
    folder_id: null,
    error: null,
    created_at: stamp,
    status_changed_at: stamp,
    uri: shot.uri,
    job_step: sort === 'ACT' ? 'OCR' : undefined,
  });
  if (sort === 'ACT') void startAnalysis(id, shot.id, shot.uri);
  return id;
}

const analyzing = new Set<string>();

async function pollAnalysis(captureId: string, jobId: number, firstDelay: number) {
  let delay = firstDelay;
  for (let i = 0; i < 90; i++) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = 2000;
    try {
      const [job] = await api.getAnalysisJobs([jobId]);
      if (job?.status === 'SUCCEEDED') {
        detailLoaded.delete(captureId);
        await refreshAll();
        await ensureDetail(captureId, true);
        patch([captureId], (c) => ({ ...c, job_step: undefined }));
        return;
      }
      if (job?.status === 'FAILED') {
        patch([captureId], (c) => ({
          ...c,
          status: 'FAILED',
          job_step: undefined,
          error: job.error ?? { code: 'ANALYSIS_FAILED', message: 'AI 분석에 실패했어요.' },
        }));
        return;
      }
      // 진행 단계 표시 (서버 step: OCR → CATEGORIZE → DONE)
      if (job?.step) {
        const step: AnalysisStep = job.step === 'DONE' ? 'GUIDE' : job.step;
        patch([captureId], (c) => (c.status === 'ANALYZING' ? { ...c, job_step: step } : c));
      }
    } catch {
      // 일시적인 네트워크 오류는 다음 주기에 다시 확인해요
    }
  }
  patch([captureId], (c) => ({
    ...c,
    status: 'FAILED',
    job_step: undefined,
    error: { code: 'ANALYSIS_TIMEOUT', message: '분석 시간이 너무 오래 걸려요. 다시 시도해 주세요.' },
  }));
}

/**
 * 업로드용 파일 만들기: 기기 앨범 경로(file:// · content://)를 그대로 올리면 기기에 따라 읽기에 실패해서
 * 요청이 나가지 못해요. 앱 캐시에 JPEG 로 다시 저장해서(용량도 줄어요) 올려요. 실패하면 원본으로 시도해요.
 */
async function prepareUpload(uri: string): Promise<string> {
  if (!ImageManipulator) return uri;
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.warn('[moa] 업로드용 사진 변환에 실패해서 원본으로 시도해요', uri, error);
    return uri;
  }
}

const MAX_UPLOADS = 2;
let activeUploads = 0;
const uploadWaiters: (() => void)[] = [];
async function withUploadSlot<T>(task: () => Promise<T>): Promise<T> {
  while (activeUploads >= MAX_UPLOADS) await new Promise<void>((resolve) => uploadWaiters.push(resolve));
  activeUploads++;
  try {
    return await task();
  } finally {
    activeUploads--;
    uploadWaiters.shift()?.();
  }
}

/** 실천으로 분류한 사진을 올려 AI 분석을 요청하고, 끝날 때까지 진행 상태를 확인해요 */
export async function startAnalysis(captureId: string | number, fileKey: string, imageUri?: string | null) {
  const id = String(captureId);
  if (!USE_SERVER || analyzing.has(id)) return;
  analyzing.add(id);
  patch([id], (c) => ({ ...c, status: 'ANALYZING', error: null, job_step: 'OCR' }));

  try {
    // 아이폰의 ph:// 같은 주소는 업로드가 안 돼서, 기기에서 읽을 수 있는 파일 주소로 바꿔서 올려요
    const uri = (await resolveUri(fileKey)) ?? imageUri ?? state.captures.find((c) => c.id === id)?.uri;
    if (!uri) throw new Error('기기에서 사진을 찾지 못했어요. 사진 접근 권한을 확인해 주세요.');
    // 한꺼번에 여러 장을 보내면 서버의 분석 요청 제한(429)에 걸려서, 업로드는 동시에 2장까지만 해요
    const job = await withUploadSlot(async () => {
      const upload = await prepareUpload(uri);
      console.log(`[moa] 분석 요청 POST ${api.apiBaseUrl}/captures/${id}/analysis (image=${upload})`);
      const accepted = await api.requestAnalysis(id, upload);
      console.log(`[moa] 분석 접수 job_id=${accepted.job_id} status=${accepted.status}`);
      return accepted;
    });
    await pollAnalysis(id, job.job_id, job.poll_after_ms);
  } catch (error) {
    patch([id], (c) => ({
      ...c,
      status: 'FAILED',
      job_step: undefined,
      error: {
        code: error instanceof api.ApiError ? String(error.code ?? 'ERROR') : 'ERROR',
        message: api.errorMessage(error),
      },
    }));
  } finally {
    analyzing.delete(id);
  }
}

/* ───────── 참고함: 실천으로 바꾸기 · 삭제 (한 장 · 여러 장) ───────── */

export type BatchResult = { ok: string[]; failed: string[]; error?: unknown };

/**
 * 참고 → 실천으로 바꾸기 (여러 장)
 * 서버 분류를 PRACTICE 로 바꾸고(PATCH /screenshot-classifications/{id}), 바뀐 항목마다 AI 분석을 시작해요 (changeSort 'ACT').
 * 서버 분류 id 는 캡처 id 와 같아요. 일부만 실패해도 성공한 것은 옮겨요.
 */
export async function referencesToPractice(ids: string[]): Promise<BatchResult> {
  const ok: string[] = [];
  const failed: string[] = [];
  let error: unknown;
  await Promise.all(
    ids.map(async (id) => {
      try {
        if (USE_SERVER) await api.changeClassification(Number(id), 'PRACTICE');
        ok.push(id);
      } catch (e) {
        console.warn('[moa] 실천으로 바꾸기 실패', id, e);
        error ??= e;
        failed.push(id);
      }
    }),
  );
  ok.forEach((id) => changeSort(id, 'ACT'));
  return { ok, failed, error };
}

/** 한 장 버전. 실패하면 던져요(화면은 그대로) */
export async function referenceToPractice(id: string) {
  const result = await referencesToPractice([id]);
  if (result.failed.length) throw result.error ?? new Error('실천으로 바꾸지 못했어요.');
}

export type DeleteResult = { status: 'done' | 'cancelled'; deleted: string[]; failed: string[]; error?: unknown };

/**
 * 참고 항목 삭제 (여러 장): 기기에서 사진을 먼저 지우고(안드로이드 시스템 삭제 팝업 — 여러 장도 한 번에),
 * 허용했을 때만 서버 기록(DELETE /captures/{id})을 지워요. 거부하면 아무것도 하지 않고 'cancelled'.
 */
export async function deleteReferences(ids: string[]): Promise<DeleteResult> {
  const targets = state.captures.filter((c) => ids.includes(c.id));
  if (!targets.length) return { status: 'cancelled', deleted: [], failed: [] };

  if (!USE_SERVER) {
    targets.forEach((t) => dropCapture(t.id));
    return { status: 'done', deleted: targets.map((t) => t.id), failed: [] };
  }

  if (!MediaLibrary) throw new Error('이 앱 빌드에서는 사진 삭제를 쓸 수 없어요.');
  // 이미 기기에서 지워진 사진이면(예전에 지우고 서버 삭제만 실패한 경우) 팝업 대상에서 빼고 서버 기록만 지워요
  // 안드로이드는 getAssetInfoAsync 가 위치 권한(ACCESS_MEDIA_LOCATION) 없이 항상 실패해서
  // "이미 지워진 사진"으로 착각하고 팝업 없이 지워버렸어요. 안드로이드는 확인 없이 바로 시스템 팝업을 띄워요
  const onDevice: string[] = [];
  if (Platform.OS === 'android') {
    onDevice.push(...targets.map((t) => t.file_key));
  } else {
    for (const t of targets) {
      const exists = await MediaLibrary.getAssetInfoAsync(t.file_key)
        .then((info) => !!info)
        .catch(() => false);
      if (exists) onDevice.push(t.file_key);
    }
  }
  if (onDevice.length) {
    let allowed: boolean;
    try {
      allowed = await MediaLibrary.deleteAssetsAsync(onDevice);
    } catch (error) {
      // 기기에서 이미 지워진 사진이면 팝업 없이 실패해요 → 서버 기록만 지워요
      console.warn('[moa] 기기 사진 삭제 실패 (이미 지워졌을 수 있어요)', error);
      allowed = true;
    }
    if (!allowed) return { status: 'cancelled', deleted: [], failed: [] };
  }

  const results = await Promise.allSettled(targets.map((t) => api.deleteCapture(t.id)));
  const deleted: string[] = [];
  const failed: string[] = [];
  let error: unknown;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      deleted.push(targets[i].id);
      dropCapture(targets[i].id);
    } else {
      console.warn('[moa] 서버 기록 삭제 실패', targets[i].id, r.reason);
      error ??= r.reason;
      failed.push(targets[i].id);
    }
  });
  return { status: 'done', deleted, failed, error };
}

/** 한 장 버전: 'deleted' 또는 'cancelled'(팝업 거부) */
export async function deleteReference(id: string): Promise<'deleted' | 'cancelled'> {
  const result = await deleteReferences([id]);
  if (result.status === 'cancelled') return 'cancelled';
  if (result.failed.length) throw result.error ?? new Error('서버 기록을 삭제하지 못했어요.');
  return 'deleted';
}
