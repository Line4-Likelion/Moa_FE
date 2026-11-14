import { useSyncExternalStore } from 'react';

/* ───────── 타입 ───────── */

export type PracticeStep = { title: string; done: boolean };

/**
 * 실천 상태
 * - active: 진행 (마감이 지난 것도 여기에 포함, 화면에서만 맨 위로 올려 강조)
 * - hold: 보류
 * - done: 완료
 * 제외한 실천은 목록에서 아예 지워요.
 */
export type PracticeStatus = 'active' | 'hold' | 'done';

export type Practice = {
  id: string;
  title: string;
  category: string;
  /** 마감일 YYYY-MM-DD. 없으면 null */
  deadline: string | null;
  /** 실천함에 담긴 시각 (ISO) */
  addedAt: string;
  /** 완료한 시각 (ISO). 완료 전이면 null */
  completedAt: string | null;
  status: PracticeStatus;
  /** AI가 정리한 실천 단계. null 이면 아직 분석 중 */
  steps: PracticeStep[] | null;
  /** 캡처 썸네일 (갤러리 연동 전에는 비어 있음) */
  thumbnailUri?: string;
};

/** 기본 카테고리. '기타'는 항상 맨 끝 */
export const BASE_CATEGORIES = ['맛집', '카페', '쇼핑', '공모전', '레시피', '여행', '공부'];
export const ETC_CATEGORY = '기타';

/* ───────── 날짜 유틸 ───────── */

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysFromToday(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dayKey(d);
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** 마감까지 남은 날 수. 오늘 마감 = 0, 지났으면 음수, 마감 없으면 null */
export function daysLeft(p: Practice): number | null {
  if (!p.deadline) return null;
  const [y, m, d] = p.deadline.split('-').map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((due - today) / 86400000);
}

export function isOverdue(p: Practice) {
  const left = daysLeft(p);
  return p.status === 'active' && left !== null && left < 0;
}

/* ───────── 목업 데이터 (서버 연동 시 교체) ───────── */

const steps = (titles: string[], doneCount: number): PracticeStep[] =>
  titles.map((title, i) => ({ title, done: i < doneCount }));

const SEED: Practice[] = [
  {
    id: 'p1',
    title: 'AI 공모전 접수',
    category: '공모전',
    deadline: daysFromToday(-1),
    addedAt: isoDaysAgo(9),
    completedAt: null,
    status: 'active',
    steps: steps(['팀원 모으기', '서류 준비하기', '지원서 제출하기'], 1),
  },
  {
    id: 'p2',
    title: '연남 소바실',
    category: '맛집',
    deadline: daysFromToday(0),
    addedAt: isoDaysAgo(6),
    completedAt: null,
    status: 'active',
    steps: steps(['메뉴 확인하기', '친구랑 날짜 정하기', '예약하기', '방문하기'], 2),
  },
  {
    id: 'p3',
    title: '가을 밤잼 만들기',
    category: '레시피',
    deadline: daysFromToday(2),
    addedAt: isoDaysAgo(3),
    completedAt: null,
    status: 'active',
    steps: steps(['재료 사기', '밤 손질하기', '잼 끓이기'], 0),
  },
  {
    id: 'p4',
    title: '기억해 둘 화면',
    category: '기타',
    deadline: null,
    addedAt: isoDaysAgo(12),
    completedAt: null,
    status: 'active',
    steps: steps(['휴대폰 알림 설정 바꾸기'], 0),
  },
  {
    id: 'p5',
    title: '성수 팝업스토어 가기',
    category: '쇼핑',
    deadline: null,
    addedAt: isoDaysAgo(0),
    completedAt: null,
    status: 'active',
    steps: null,
  },
  {
    id: 'p6',
    title: '4호선톤 지원',
    category: '공모전',
    deadline: daysFromToday(5),
    addedAt: isoDaysAgo(8),
    completedAt: null,
    status: 'hold',
    steps: steps(['팀원 모으기', '서류 준비하기', '지원하기'], 1),
  },
  {
    id: 'p7',
    title: '성신여대 카페 찾기',
    category: '카페',
    deadline: null,
    addedAt: isoDaysAgo(15),
    completedAt: isoDaysAgo(3),
    status: 'done',
    steps: steps(['후보 카페 고르기', '직접 가보기'], 2),
  },
  {
    id: 'p8',
    title: '겨울 머플러 사기',
    category: '쇼핑',
    deadline: null,
    addedAt: isoDaysAgo(20),
    completedAt: isoDaysAgo(6),
    status: 'done',
    steps: steps(['색 고르기', '사이즈 비교하기', '주문하기'], 3),
  },
];

/* ───────── 스토어 ───────── */

type State = { practices: Practice[]; customCategories: string[] };

let state: State = { practices: SEED, customCategories: [] };
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 단계를 모두 끝냈으면 완료 버튼을 누르지 않아도 자동으로 완료 처리 */
function normalize(p: Practice): Practice {
  if (p.status !== 'done' && p.steps && p.steps.length > 0 && p.steps.every((s) => s.done)) {
    return { ...p, status: 'done', completedAt: new Date().toISOString() };
  }
  return p;
}

function update(ids: string[], fn: (p: Practice) => Practice) {
  const set = new Set(ids);
  setState({ ...state, practices: state.practices.map((p) => (set.has(p.id) ? normalize(fn(p)) : p)) });
}

export function usePractices() {
  return useSyncExternalStore(subscribe, () => state.practices);
}

export function useCategories() {
  const custom = useSyncExternalStore(subscribe, () => state.customCategories);
  return [...BASE_CATEGORIES, ...custom, ETC_CATEGORY];
}

/** 완료: 남은 단계도 모두 체크해요 */
export function completePractices(ids: string[]) {
  update(ids, (p) => ({
    ...p,
    status: 'done',
    completedAt: new Date().toISOString(),
    steps: p.steps?.map((s) => ({ ...s, done: true })) ?? p.steps,
  }));
}

export function holdPractices(ids: string[]) {
  update(ids, (p) => ({ ...p, status: 'hold' }));
}

export function resumePractices(ids: string[]) {
  update(ids, (p) => ({ ...p, status: 'active' }));
}

/** 제외: AI 분석 내용과 함께 실천함에서 빠져요. 캡처 사진은 기기에 그대로 남아요. */
export function excludePractices(ids: string[]) {
  const set = new Set(ids);
  setState({ ...state, practices: state.practices.filter((p) => !set.has(p.id)) });
}

export function changeCategory(ids: string[], category: string) {
  update(ids, (p) => ({ ...p, category }));
}

/** 단계 하나 체크/해제 (실천 상세에서 사용). 마지막 단계까지 끝내면 자동 완료 */
export function toggleStep(id: string, index: number) {
  update([id], (p) => ({
    ...p,
    steps: p.steps?.map((s, i) => (i === index ? { ...s, done: !s.done } : s)) ?? p.steps,
  }));
}

/** 다시 하기: 완료 기록은 그대로 두고, 같은 실천을 복제해 진행에 새로 담아요 */
export function redoPractices(ids: string[]) {
  const set = new Set(ids);
  const now = Date.now();
  const copies: Practice[] = state.practices
    .filter((p) => set.has(p.id))
    .map((p, i) => ({
      ...p,
      id: `${p.id}-again-${now}-${i}`,
      status: 'active',
      addedAt: new Date(now).toISOString(),
      completedAt: null,
      deadline: null,
      steps: p.steps?.map((s) => ({ ...s, done: false })) ?? null,
    }));
  setState({ ...state, practices: [...copies, ...state.practices] });
}

export function addCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const all = [...BASE_CATEGORIES, ETC_CATEGORY, ...state.customCategories];
  if (all.includes(trimmed)) return;
  setState({ ...state, customCategories: [...state.customCategories, trimmed] });
}
