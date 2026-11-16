import { useEffect, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as api from '../services/api';

/* ═════════ API 명세서와 같은 모양의 데이터 (Capture 객체) ═════════
 * 서버 응답(snake_case)을 그대로 앱에서 써요. 화면은 아래 훅·함수만 쓰면 되고,
 * 서버 통신(조회·낙관적 업데이트·실패 시 되돌림)은 이 파일이 맡아요.
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

/** 서버가 모든 사용자에게 기본으로 만들어 주는 카테고리 (백엔드 DefaultCategory 와 같아야 해요) */
export const BASE_CATEGORIES = ['패션', '맛집', '여행', '레시피', '정보', '생활'];
export const ETC_CATEGORY = '기타';

/** 서버에서 불러오기 전(또는 오프라인)에 보여줄 기본 목록 */
const FALLBACK_CATEGORIES: Category[] = [...BASE_CATEGORIES, ETC_CATEGORY].map((name) => ({
  id: `default:${name}`,
  name,
  is_custom: false,
}));

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

/* ═════════ 서버 응답 → 앱 데이터 ═════════ */

const NO_DEADLINE: Deadline = { status: 'NONE', date: null, label: null, box: null };

function toCategory(c: { id: number; name: string; is_custom: boolean } | null): Category | null {
  return c ? { id: String(c.id), name: c.name, is_custom: c.is_custom } : null;
}

/**
 * 목록(요약형) 응답에는 핵심 정보·가이드·체크리스트가 없어요.
 * 이미 상세를 받아 둔 항목이면 그 값을 지우지 않고 이어 써요.
 */
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
  };
}

/* ═════════ 상태 저장소 ═════════ */

type State = { captures: Capture[]; categories: Category[] };

let state: State = { captures: [], categories: FALLBACK_CATEGORIES };
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(captures: Capture[]) {
  setState({ ...state, captures });
}
function patch(ids: string[], fn: (c: Capture) => Capture) {
  const set = new Set(ids);
  commit(state.captures.map((c) => (set.has(c.id) ? fn(c) : c)));
}
function upsert(capture: Capture) {
  const exists = state.captures.some((c) => c.id === capture.id);
  commit(exists ? state.captures.map((c) => (c.id === capture.id ? capture : c)) : [capture, ...state.captures]);
}
const now = () => new Date().toISOString();

/** 앱 안에서만 들고 있던 항목을 지워요 (분류 취소 · 참고로 변경 등) */
export function dropCapture(id: string) {
  detailLoaded.delete(id);
  commit(state.captures.filter((c) => c.id !== id));
}

/** 로그아웃 시 앱 안의 데이터를 비워요 */
export function resetStore() {
  detailLoaded.clear();
  undoState = null;
  setState({ captures: [], categories: FALLBACK_CATEGORIES });
}

/* ───────── 오류 알림 (짧은 시간에 여러 번 뜨지 않게) ───────── */

let lastAlertAt = 0;
function notifyError(error: unknown) {
  console.warn('[moa] 요청 실패', error);
  if (Date.now() - lastAlertAt < 3000) return;
  lastAlertAt = Date.now();
  Alert.alert('요청하지 못했어요', api.errorMessage(error));
}

/* ═════════ 서버에서 불러오기 ═════════ */

/** 기기 사진 주소 찾기 (file_key = 기기 사진 ID) */
const uriCache = new Map<string, string | null>();
async function resolveUri(fileKey: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (uriCache.has(fileKey)) return uriCache.get(fileKey) ?? null;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(fileKey);
    const uri = info?.localUri ?? info?.uri ?? null;
    uriCache.set(fileKey, uri);
    return uri;
  } catch {
    uriCache.set(fileKey, null);
    return null;
  }
}
let resolving = false;
async function fillUris() {
  if (resolving) return;
  resolving = true;
  try {
    for (const c of state.captures.filter((x) => !x.uri)) {
      const uri = await resolveUri(c.file_key);
      if (uri) patch([c.id], (x) => ({ ...x, uri }));
    }
  } finally {
    resolving = false;
  }
}

let refreshing: Promise<void> | null = null;

/** 카테고리 + 실천 대기 · 완료 · 참고 캡처를 모두 새로 받아와요 */
export function refreshAll(): Promise<void> {
  if (!api.isLoggedIn()) return Promise.resolve();
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
        categories: cats.map((c) => ({ id: String(c.id), name: c.name, is_custom: c.isCustom })),
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
  if (!api.isLoggedIn() || (!force && detailLoaded.has(id))) return;
  detailLoaded.add(id);
  try {
    const detail = await api.getCaptureDetail(id);
    const prev = state.captures.find((c) => c.id === id);
    const next = fromServer(detail, prev);
    upsert(next);
    if (!next.uri) {
      const uri = await resolveUri(next.file_key);
      if (uri) patch([id], (c) => ({ ...c, uri }));
    }
  } catch (error) {
    detailLoaded.delete(id);
    console.warn('[moa] 상세를 불러오지 못했어요', error);
  }
}

/* ───────── 읽기 ───────── */

export function useCaptures() {
  return useSyncExternalStore(subscribe, () => state.captures);
}
export function useCapture(id: string) {
  const capture = useSyncExternalStore(subscribe, () => state.captures.find((c) => c.id === id));
  useEffect(() => {
    if (id) void ensureDetail(id);
  }, [id]);
  return capture;
}
export function useCategoryList(): Category[] {
  return useSyncExternalStore(subscribe, () => state.categories);
}
/** 카테고리 이름 목록 (실천함 칩·시트용) */
export function useCategories() {
  return useCategoryList().map((c) => c.name);
}

/* ───────── 실천함 목록용 요약 (명세서 목록 API 요약형에 해당) ───────── */

export type PracticeStep = { title: string; done: boolean };
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
  /** 실천 방법을 못 만들었으면 null */
  steps: PracticeStep[] | null;
  snoozeUntil: string | null;
};

function toPractice(c: Capture): Practice {
  return {
    id: c.id,
    title: c.title ?? '제목 없음',
    category: c.category?.name ?? ETC_CATEGORY,
    deadline: c.deadline.status === 'FOUND' ? c.deadline.date : null,
    deadlineUnclear: c.deadline.status === 'UNCLEAR',
    addedAt: c.created_at,
    completedAt: c.status === 'DONE' ? c.status_changed_at : null,
    status: c.status === 'DONE' ? 'done' : isSnoozed(c) ? 'hold' : 'active',
    steps: c.guide === null && c.checklist.length === 0 ? null : c.checklist.map((i) => ({ title: i.text, done: i.checked })),
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

/* ═════════ 쓰기 (화면에는 바로 반영하고, 서버에 보낸 뒤 실패하면 되돌려요) ═════════ */

/** 완료 · 보류 · 제외 직후 5초 동안 되돌리기 (명세서 UNDO) */
const UNDO_MS = 5000;
type UndoState = {
  snapshot: Capture[];
  expiresAt: number;
  /** 서버가 내려준 undo.token (응답이 오면 채워져요) */
  tokens: Promise<{ id: string; token: string }[]>;
};
let undoState: UndoState | null = null;

/**
 * 상태 변경 (POST /captures/{id}/actions)
 * 화면은 optimistic 으로 먼저 바꾸고, 서버 응답으로 덮어써요. 하나라도 실패하면 전체를 다시 받아와요.
 */
function runAction(
  ids: string[],
  action: api.CaptureActionName,
  optimistic: (c: Capture) => Capture,
  extra: { snooze_until?: string } = {},
  undoable = false,
) {
  const snapshot = state.captures;
  patch(ids, optimistic);

  const requests = Promise.allSettled(ids.map((id) => api.actOnCapture(id, action, extra)));
  const tokens = requests.then((results) => {
    const list: { id: string; token: string }[] = [];
    let failed: unknown = null;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        failed = r.reason;
        return;
      }
      upsert(fromServer(r.value.capture, state.captures.find((c) => c.id === ids[i])));
      if (r.value.undo) list.push({ id: ids[i], token: r.value.undo.token });
    });
    if (failed) {
      notifyError(failed);
      void refreshAll();
    }
    return list;
  });

  if (undoable) undoState = { snapshot, expiresAt: Date.now() + UNDO_MS, tokens };
}

/** 완료 (COMPLETE). 체크리스트도 모두 체크된 상태로 보여줘요 */
export function completePractices(ids: string[]) {
  runAction(
    ids,
    'COMPLETE',
    (c) => ({
      ...c,
      status: 'DONE',
      status_changed_at: now(),
      next_alarm_at: null,
      snooze_until: null,
      checklist: c.checklist.map((i) => ({ ...i, checked: true })),
    }),
    {},
    true,
  );
}

/** 보류 (SNOOZE). 날짜를 안 주면 다음 주 같은 요일 */
export function snoozeCaptures(ids: string[], until: string = nextWeekSameDay()) {
  runAction(ids, 'SNOOZE', (c) => ({ ...c, snooze_until: until }), { snooze_until: until }, true);
}

/** 보류 풀기: 지금 다시 하기 (서버에는 오늘 날짜로 보류해서 풀어요 — 보류는 '오늘 이후'일 때만 적용돼요) */
export function resumeCaptures(ids: string[]) {
  const today = dayKey(new Date());
  runAction(ids, 'SNOOZE', (c) => ({ ...c, snooze_until: null }), { snooze_until: today });
}

/** 제외 (DISMISS = 명세서의 '안함'). 참고함으로 옮겨요 */
export function excludePractices(ids: string[]) {
  runAction(
    ids,
    'DISMISS',
    (c) => ({
      ...c,
      status: 'REFERENCE',
      status_changed_at: now(),
      snooze_until: null,
      next_alarm_at: null,
    }),
    {},
    true,
  );
}

/** 되돌리기 (UNDO). 5초가 지났으면 false */
export function undoLast() {
  if (!undoState || Date.now() > undoState.expiresAt) return false;
  const { snapshot, tokens } = undoState;
  undoState = null;
  commit(snapshot);
  void tokens
    .then((list) => Promise.allSettled(list.map((t) => api.actOnCapture(t.id, 'UNDO', { token: t.token }))))
    .then(() => refreshAll());
  return true;
}

/**
 * 체크리스트 체크 (PATCH /captures/{id}/checklist/{item_id})
 * 서버는 전부 체크해도 자동으로 완료하지 않아서, 앱에서 모두 체크되면 COMPLETE 도 보내요. 완료됐으면 true
 */
export function toggleChecklist(id: string, itemId: string) {
  const target = state.captures.find((c) => c.id === id);
  if (!target) return false;
  const nextChecked = !target.checklist.find((i) => i.id === itemId)?.checked;
  const checklistNext = target.checklist.map((i) => (i.id === itemId ? { ...i, checked: nextChecked } : i));
  const allDone = checklistNext.length > 0 && checklistNext.every((i) => i.checked);

  patch([id], (c) => ({ ...c, checklist: checklistNext }));
  api.checkChecklistItem(id, itemId, nextChecked).catch((error) => {
    notifyError(error);
    void ensureDetail(id, true);
  });

  if (allDone && target.status === 'TODO') {
    completePractices([id]);
    return true;
  }
  return false;
}

/** 카테고리 변경 (PATCH /captures/{id}/category) */
export function changeCategory(ids: string[], categoryName: string) {
  const next = state.categories.find((c) => c.name === categoryName);
  if (!next) return;
  patch(ids, (c) => ({ ...c, category: next, category_source: 'USER' }));

  const categoryId = Number(next.id);
  if (Number.isNaN(categoryId)) return; // 아직 서버에서 카테고리를 받아오기 전
  Promise.all(ids.map((id) => api.changeCaptureCategory(id, categoryId))).catch((error) => {
    notifyError(error);
    void refreshAll();
  });
}

/** 추출 정보 수정 (PATCH /captures/{id}/facts). deadline 을 넘기면 마감도 바꿔요 (null = 마감 없음) */
export function updateFacts(id: string, values: Record<string, string>, deadline?: string | null) {
  const facts = Object.entries(values).map(([key, value]) => ({ key, value: value.trim() || null }));
  if (deadline !== undefined) facts.push({ key: 'deadline', value: deadline });

  patch([id], (c) => {
    const nextFacts = c.facts.map((f) =>
      f.key in values ? { ...f, value: values[f.key].trim() || null, edited: true } : f,
    );
    let nextDeadline = c.deadline;
    if (deadline !== undefined) {
      nextDeadline = deadline
        ? { ...c.deadline, status: 'FOUND', date: deadline, label: c.deadline.label ?? '마감' }
        : { status: 'NONE', date: null, label: null, box: null };
    }
    return { ...c, facts: nextFacts, deadline: nextDeadline };
  });

  if (!facts.length) return;
  api
    .patchFacts(id, facts)
    .then((detail) => upsert(fromServer(detail, state.captures.find((c) => c.id === id))))
    .catch((error) => {
      notifyError(error);
      void ensureDetail(id, true);
    });
}

/**
 * 링크 수정
 * TODO(백엔드 확인): 서버의 링크는 '조회만' 가능해서 저장 API 가 없어요. 지금은 앱 화면에서만 바뀌어요.
 */
export function updateLink(id: string, url: string) {
  patch([id], (c) => {
    const trimmed = url.trim();
    if (!trimmed) return { ...c, links: [] };
    const first = c.links[0] ?? { type: 'WEB', label: '원문 링크 열기', url: '' };
    return { ...c, links: [{ ...first, url: trimmed }, ...c.links.slice(1)] };
  });
}

/**
 * 다시 하기 (REOPEN). 서버는 완료 항목을 진행(TODO)으로 '옮겨요'. 같은 id 를 돌려줘요.
 */
export function redoPractices(ids: string[]) {
  runAction(ids, 'REOPEN', (c) => ({ ...c, status: 'TODO', status_changed_at: now(), snooze_until: null }));
  return ids;
}

/* ═════════ AI 분석 (POST /captures/{id}/analysis) ═════════ */

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
        return;
      }
      if (job?.status === 'FAILED') {
        patch([captureId], (c) => ({
          ...c,
          status: 'FAILED',
          error: job.error ?? { code: 'ANALYSIS_FAILED', message: 'AI 분석에 실패했어요.' },
        }));
        return;
      }
    } catch {
      // 일시적인 네트워크 오류는 다음 주기에 다시 확인해요
    }
  }
  patch([captureId], (c) => ({
    ...c,
    status: 'FAILED',
    error: { code: 'ANALYSIS_TIMEOUT', message: '분석 시간이 너무 오래 걸려요. 다시 시도해 주세요.' },
  }));
}

/**
 * 실천으로 분류한 사진의 분석을 시작해요 (사진 분류 직후, 또는 '다시 분석').
 * captureId 는 분류 저장 응답의 id, fileKey 는 기기 사진 ID, imageUri 는 기기 사진 주소
 */
export async function startAnalysis(captureId: string | number, fileKey: string, imageUri?: string | null) {
  const id = String(captureId);
  if (analyzing.has(id)) return;
  analyzing.add(id);

  const existing = state.captures.find((c) => c.id === id);
  const stamp = now();
  upsert({
    id,
    file_key: fileKey,
    status: 'ANALYZING',
    category: existing?.category ?? null,
    category_source: existing?.category_source ?? 'AI',
    title: existing?.title ?? null,
    summary: existing?.summary ?? null,
    facts: existing?.facts ?? [],
    deadline: existing?.deadline ?? NO_DEADLINE,
    links: existing?.links ?? [],
    guide: existing?.guide ?? null,
    checklist: existing?.checklist ?? [],
    snooze_until: null,
    next_alarm_at: null,
    folder_id: null,
    error: null,
    created_at: existing?.created_at ?? stamp,
    status_changed_at: stamp,
    uri: existing?.uri ?? imageUri ?? undefined,
  });

  try {
    const uri = imageUri ?? existing?.uri ?? (await resolveUri(fileKey));
    if (!uri) throw new Error('기기에서 사진을 찾지 못했어요. 사진 접근 권한을 확인해 주세요.');
    const job = await api.requestAnalysis(id, uri);
    await pollAnalysis(id, job.jobId, job.pollAfterMs);
  } catch (error) {
    patch([id], (c) => ({
      ...c,
      status: 'FAILED',
      error: { code: error instanceof api.ApiError ? String(error.code ?? 'ERROR') : 'ERROR', message: api.errorMessage(error) },
    }));
  } finally {
    analyzing.delete(id);
  }
}

/** 다시 분석 */
export function reanalyze(id: string) {
  const c = state.captures.find((x) => x.id === id);
  if (!c) return;
  void startAnalysis(id, c.file_key, c.uri);
}

/* ═════════ 카테고리 추가 (POST /categories) ═════════ */

/** 추가했으면 true, 같은 이름이 이미 있으면 false. 그 밖의 오류는 던져요(ApiError) */
export async function addCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (state.categories.some((c) => c.name === trimmed)) return false;
  try {
    const created = await api.createCategory(trimmed);
    const category: Category = { id: String(created.id), name: created.name, is_custom: created.isCustom ?? true };
    // 서버 순서: 기본 → 내가 만든 것 → 기타
    const etc = state.categories.filter((c) => c.name === ETC_CATEGORY);
    const rest = state.categories.filter((c) => c.name !== ETC_CATEGORY);
    setState({ ...state, categories: [...rest, category, ...etc] });
    return true;
  } catch (error) {
    if (error instanceof api.ApiError && error.code === 'DUPLICATE_NAME') return false;
    throw error;
  }
}
