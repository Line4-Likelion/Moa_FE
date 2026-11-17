import { useMemo, useSyncExternalStore } from 'react';
import { UNSORTED_SCREENSHOTS, type Screenshot } from '../mock/screenshots';
import { USE_SERVER } from '../services/config';
import { loadUnsortedScreenshots } from '../services/screenshots';
import { daysLeftOf, dayKey, isSnoozed, parseDay, useCaptures, type Capture } from './practices';

/* ═════════ 새 캡처 안내 카드 (명세서: 앱이 계산, 서버 API 없음) ═════════
 * 기기 스크린샷 중 baseline_at 이후 + 아직 분류 안 한 것 = 새 캡처
 * baseline_at 이전 + 분류 안 한 것 = 지난 캡처
 *
 * 서버 모드(USE_SERVER)면 기기 스크린샷에서 분류 안 한 것을 불러오고, 아니면 목업이에요.
 * TODO(API 명세): baseline_at 으로 새 캡처 / 지난 캡처 나누기 — 지금 서버 모드는 전부 새 캡처
 */

/** 테스트용: 새 캡처 개수를 바꿔 카드 4종을 확인해보세요 (0 / 2 / 9 / 20 / 42) */
const MOCK_NEW_COUNT = UNSORTED_SCREENSHOTS.length;
const MOCK_PAST_COUNT = 452;

type NewCaptureState = {
  loading: boolean;
  error: string | null;
  items: Screenshot[];
  /** 지난 캡처 (baseline_at 이전, 분류 안 한 것) */
  pastItems: Screenshot[];
  /** [나중에]를 누른 날 (YYYY-MM-DD). 앱에 날짜만 저장 */
  collapsedOn: string | null;
};

const makeItems = (n: number): Screenshot[] =>
  Array.from({ length: n }, (_, i) => UNSORTED_SCREENSHOTS[i] ?? { id: `shot-extra-${i}`, capturedAt: '' });

let ncState: NewCaptureState = {
  loading: USE_SERVER,
  error: null,
  items: USE_SERVER ? [] : makeItems(MOCK_NEW_COUNT),
  pastItems: USE_SERVER ? [] : Array.from({ length: MOCK_PAST_COUNT }, (_, i) => ({ id: `past-${i + 1}`, capturedAt: '' })),
  collapsedOn: null,
};
const ncListeners = new Set<() => void>();
function setNc(next: Partial<NewCaptureState>) {
  ncState = { ...ncState, ...next };
  ncListeners.forEach((l) => l());
}

export function useNewCaptures() {
  const s = useSyncExternalStore(
    (l) => {
      ncListeners.add(l);
      return () => ncListeners.delete(l);
    },
    () => ncState,
  );
  return {
    ...s,
    count: s.items.length,
    pastCount: s.pastItems.length,
    collapsedToday: s.collapsedOn === dayKey(new Date()),
    retry: refreshNewCaptures,
  };
}

/** 기기 스크린샷 다시 불러오기 (서버 모드). 홈에 들어올 때마다 불러요 */
export async function refreshNewCaptures() {
  if (!USE_SERVER) return;
  setNc({ loading: ncState.items.length === 0, error: null });
  try {
    const items = await loadUnsortedScreenshots();
    setNc({ items, loading: false });
  } catch (e) {
    setNc({ loading: false, error: e instanceof Error ? e.message : '사진을 불러오지 못했어요.' });
  }
}

/** [나중에]: 오늘은 한 줄로 접기 */
export function collapseNewCapturesToday() {
  setNc({ collapsedOn: dayKey(new Date()) });
}
export function expandNewCaptures() {
  setNc({ collapsedOn: null });
}
/**
 * 오래된 것은 지난 캡처로 넘기기 (PATCH /users/me/baseline)
 * 최근 10장만 새 캡처로 남기고 나머지는 지난 캡처로
 */
export function moveOldToPast() {
  setNc({ items: ncState.items.slice(0, 10), pastItems: [...ncState.items.slice(10), ...ncState.pastItems] });
}

/** 분류 화면에서 쓰는 목록 (새 캡처 / 지난 캡처) */
export function getSortSource(mode: 'new' | 'past') {
  return mode === 'past' ? ncState.pastItems : ncState.items;
}
/** 분류했거나 기기에서 지운 사진을 미분류 목록에서 빼요 (기기 목록 - 분류된 키) */
export function removeFromUnsorted(ids: string[]) {
  const set = new Set(ids);
  setNc({ items: ncState.items.filter((s) => !set.has(s.id)), pastItems: ncState.pastItems.filter((s) => !set.has(s.id)) });
}

/* ═════════ 처음 세팅 (명세서 GET/PUT/PATCH /users/me/onboarding) ═════════ */

export type OnboardingRange = 'RECENT_30' | 'LAST_MONTH' | 'ALL';

/** 기기의 스크린샷 전체 장수 (목업). 실제로는 기기 사진 목록에서 세요 */
export const MOCK_TOTAL_SCREENSHOTS = 482;
/** 범위별로 새 캡처가 되는 장수 (목업). 최근 한 달은 실제로는 찍은 날짜로 계산 */
const RANGE_COUNT: Record<OnboardingRange, number> = { RECENT_30: 30, LAST_MONTH: 64, ALL: MOCK_TOTAL_SCREENSHOTS };

/**
 * 처음 세팅을 마쳤는지 (서버 onboarding.done)
 * 테스트용: false 로 바꾸면 로그인할 때마다 처음 세팅부터 보여요
 */
let onboardingDone = true;
export function isOnboardingDone() {
  return onboardingDone;
}

/**
 * 범위 고르기 → [첫 10장 나누기] (PUT /users/me/onboarding)
 * 고른 범위만 새 캡처, 나머지는 지난 캡처로 나눠요 (baseline_at)
 */
export function applyOnboardingRange(range: OnboardingRange) {
  const all = Array.from({ length: MOCK_TOTAL_SCREENSHOTS }, (_, i) =>
    i < UNSORTED_SCREENSHOTS.length ? UNSORTED_SCREENSHOTS[i] : { id: `shot-all-${i}`, capturedAt: '' },
  );
  const n = RANGE_COUNT[range];
  setNc({ items: all.slice(0, n), pastItems: all.slice(n), collapsedOn: null });
}

/** 첫 결과 화면에서 세팅 완료 (PATCH /users/me/onboarding { done: true }) */
export function finishOnboarding() {
  onboardingDone = true;
}
/** 개발용: 처음 세팅 다시 보기 */
export function resetOnboarding() {
  onboardingDone = false;
}

/** 개수 구간 (명세서 표) */
export type NewCaptureTier = 'none' | 'few' | 'normal' | 'piling' | 'many';
export function tierOf(count: number): NewCaptureTier {
  if (count === 0) return 'none';
  if (count <= 3) return 'few';
  if (count <= 12) return 'normal';
  if (count <= 30) return 'piling';
  return 'many';
}
/** 한 번에 분류할 장수: 12장 이하는 전부, 그보다 많으면 10장 */
export function batchSizeFor(count: number) {
  return count <= 12 ? count : 10;
}

/* ═════════ GET /home 의 processing · today_reminders · activity ═════════
 * 지금은 실천 데이터에서 계산해요. 서버 연결 후에는 GET /home 응답을 그대로 쓰면 돼요.
 */

export type ReminderReason = 'DEADLINE' | 'SNOOZE_DUE' | 'RANDOM_PICK';
export type TodayReminder = {
  capture_id: string;
  title: string;
  reason: ReminderReason;
  deadline: string | null;
};

function todayStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 오늘의 리마인드 최대 5개: 마감 임박(7일 이내) → 보류 날짜가 된 것 → 오늘의 랜덤 */
function buildReminders(captures: Capture[]): TodayReminder[] {
  const todo = captures.filter((c) => c.status === 'TODO' && !isSnoozed(c));

  const deadline = todo
    .filter((c) => {
      const left = daysLeftOf(c);
      return left !== null && left <= 7;
    })
    .sort((a, b) => (daysLeftOf(a) ?? 0) - (daysLeftOf(b) ?? 0))
    .map<TodayReminder>((c) => ({ capture_id: c.id, title: c.title ?? '제목 없음', reason: 'DEADLINE', deadline: c.deadline.date }));

  const snoozeDue = todo
    .filter((c) => !!c.snooze_until && parseDay(c.snooze_until) <= todayStart())
    .map<TodayReminder>((c) => ({ capture_id: c.id, title: c.title ?? '제목 없음', reason: 'SNOOZE_DUE', deadline: null }));

  // 마감 없는 것 중 오늘의 랜덤 하나 (날짜로 고정해서 하루 동안은 같은 항목)
  const noDeadline = todo.filter((c) => c.deadline.status !== 'FOUND' && !snoozeDue.some((r) => r.capture_id === c.id));
  const random: TodayReminder[] = [];
  if (noDeadline.length) {
    const pick = noDeadline[todayStart().getDate() % noDeadline.length];
    random.push({ capture_id: pick.id, title: pick.title ?? '제목 없음', reason: 'RANDOM_PICK', deadline: null });
  }

  return [...deadline, ...snoozeDue, ...random].slice(0, 5);
}

export type ActivityDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type Activity = {
  start: string;
  end: string;
  /** 16주 × 7일, 월요일 시작. 빈 날도 level 0 으로 채움 */
  weeks: ActivityDay[][];
  total: number;
  current_streak: number;
};

/** 색 진하기: 0 없음 · 1 1개 · 2 2개 · 3 3~4개 · 4 5개 이상 */
function levelOf(count: number): ActivityDay['level'] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/** 예시 기록 (서버 연결 전까지). 날짜로 고정된 값이라 새로고침해도 같아요 */
function mockHistory(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const r = h % 10;
  return r < 5 ? 0 : r < 7 ? 1 : r < 8 ? 2 : r < 9 ? 3 : 5;
}

function buildActivity(captures: Capture[]): Activity {
  const today = todayStart();
  // 이번 주 월요일 → 15주 전 월요일이 시작
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(start.getDate() - 15 * 7);

  const doneByDay = new Map<string, number>();
  captures
    .filter((c) => c.status === 'DONE')
    .forEach((c) => {
      const k = dayKey(new Date(c.status_changed_at));
      doneByDay.set(k, (doneByDay.get(k) ?? 0) + 1);
    });

  const weeks: ActivityDay[][] = [];
  let total = 0;
  for (let w = 0; w < 16; w++) {
    const week: ActivityDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(date);
      const future = date > today;
      const isToday = key === dayKey(today);
      // 오늘은 실제 기록만, 지난날은 예시 기록 + 실제 기록
      const count = future ? 0 : (doneByDay.get(key) ?? 0) + (isToday || USE_SERVER ? 0 : mockHistory(key));
      total += count;
      week.push({ date: key, count, level: future ? 0 : levelOf(count) });
    }
    weeks.push(week);
  }

  // 오늘(또는 어제)까지 하루도 안 빠지고 완료한 날 수
  const flat = weeks.flat().filter((d) => parseDay(d.date) <= today);
  let i = flat.length - 1;
  if (flat[i]?.count === 0) i -= 1; // 오늘 아직 안 했으면 어제부터
  let streak = 0;
  while (i >= 0 && flat[i].count > 0) {
    streak += 1;
    i -= 1;
  }

  return { start: dayKey(start), end: dayKey(today), weeks, total, current_streak: streak };
}

export function useHomeData() {
  const captures = useCaptures();
  return useMemo(
    () => ({
      processing: captures.filter((c) => c.status === 'ANALYZING' || c.status === 'FAILED'),
      todayReminders: buildReminders(captures),
      todoCount: captures.filter((c) => c.status === 'TODO').length,
      activity: buildActivity(captures),
    }),
    [captures],
  );
}

/** 잔디 칸을 눌렀을 때 그날 완료한 항목 (GET /captures?status=DONE&completed_on=) */
export function completedOn(captures: Capture[], date: string) {
  return captures.filter((c) => c.status === 'DONE' && dayKey(new Date(c.status_changed_at)) === date);
}
