/**
 * 백엔드(Moa_BE) API 클라이언트
 *
 * - 모든 응답은 { success, code, message, data } 로 감싸져 있어요 → data 만 꺼내 돌려줘요.
 * - 실패하면 ApiError(status, code, message) 를 던져요. code 는 서버의 에러 코드(예: DUPLICATE_NAME)
 * - Access Token 이 만료되면(401) Refresh Token 으로 한 번만 재발급해서 다시 시도해요.
 * - 서버 주소: .env.local 의 EXPO_PUBLIC_API_URL
 */

type BaseResponse<T> = { success: boolean; code: number | string; message: string; data: T };

export type AuthUser = { id: string; email: string; nickname: string };
type AuthResponse = { access_token: string; refresh_token: string; expires_in?: number; user?: AuthUser };

export type Classification = 'PRACTICE' | 'REFERENCE';
export type ClassificationRecord = { id: number; fileKey: string; classification: Classification | 'DELETE' };

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

/* ═════════ 에러 ═════════ */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | number | undefined,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown, fallback = '잠시 후 다시 시도해 주세요.') {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ═════════ 세션 (앱 실행 중에만 보관) ═════════ */

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: AuthUser | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function getSessionUser() {
  return currentUser;
}
export function isLoggedIn() {
  return !!accessToken;
}
export function clearSession() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
}
/** 로그인이 만료돼 다시 발급도 못 받았을 때 (로그인 화면으로 보내는 용도) */
export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

/* ═════════ 공통 요청 ═════════ */

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number };

let refreshing: Promise<boolean> | null = null;

async function reissue(): Promise<boolean> {
  if (!refreshToken || !baseUrl) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${baseUrl}/auth/reissue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshToken}` },
      });
      if (!response.ok) return false;
      const body = (await response.json()) as BaseResponse<AuthResponse>;
      accessToken = body.data.access_token;
      refreshToken = body.data.refresh_token;
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  if (!baseUrl) throw new ApiError(0, 'NO_BASE_URL', '서버 주소가 설정되지 않았어요. (.env.local 의 EXPO_PUBLIC_API_URL)');

  const { body, timeoutMs = 15000, headers, ...rest } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 && retry && refreshToken && !path.startsWith('/auth/')) {
    if (await reissue()) return request<T>(path, options, false);
    clearSession();
    sessionExpiredHandler?.();
  }

  if (response.status === 204) return undefined as T;
  const json = (await response.json().catch(() => null)) as BaseResponse<T> | null;
  if (!response.ok || (json && json.success === false)) {
    throw new ApiError(
      response.status,
      json?.code,
      json?.message || '서버에 연결하지 못했어요. 다시 시도해 주세요.',
      json?.data,
    );
  }
  return (json?.data ?? undefined) as T;
}

/* ═════════ 인증 · 내 정보 ═════════ */

export async function authenticate(path: '/auth/login' | '/auth/signup', payload: object) {
  const data = await request<AuthResponse>(path, { method: 'POST', body: payload });
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  currentUser = data.user ?? null;
  return currentUser;
}

export async function logout() {
  try {
    await request<void>('/auth/logout', { method: 'POST' });
  } catch {
    // 서버 응답과 상관없이 기기의 로그인 정보는 지워요
  } finally {
    clearSession();
  }
}

export async function getMe() {
  const user = await request<AuthUser>('/users/me');
  currentUser = user;
  return user;
}

/* ═════════ 사진 분류 (스와이프) ═════════ */

export function getClassifications() {
  return request<ClassificationRecord[]>('/screenshot-classifications');
}
export async function saveClassification(fileKey: string, classification: Classification) {
  try {
    const records = await request<ClassificationRecord[]>('/screenshot-classifications', {
      method: 'POST',
      body: { items: [{ fileKey, classification }] },
    });
    return records[0];
  } catch (error) {
    // 응답만 유실된 경우 저장된 동일 결과를 확인해 안전하게 재시도합니다.
    const existing = await getClassifications().catch(() => [] as ClassificationRecord[]);
    const record = existing.find((item) => item.fileKey === fileKey && item.classification === classification);
    if (record) return record;
    throw error;
  }
}
export function changeClassification(id: number, classification: Classification) {
  return request<ClassificationRecord>(`/screenshot-classifications/${id}`, {
    method: 'PATCH',
    body: { classification },
  });
}
export function cancelClassification(id: number) {
  return request<void>(`/screenshot-classifications/${id}`, { method: 'DELETE' });
}

/* ═════════ 카테고리 ═════════ */

export type ServerCategory = { id: number; name: string; isCustom: boolean; todoCount: number };

export async function getCategories() {
  const data = await request<{ categories: ServerCategory[] }>('/categories');
  return data.categories;
}
export function createCategory(name: string) {
  return request<ServerCategory>('/categories', { method: 'POST', body: { name } });
}

/* ═════════ 캡처 (실천함 · 참고함) ═════════ */

export type ServerCaptureStatus = 'ANALYZING' | 'FAILED' | 'TODO' | 'DONE' | 'REFERENCE';
export type ServerBox = [number, number, number, number];
export type ServerCapture = {
  id: number;
  file_key: string;
  status: ServerCaptureStatus;
  category: { id: number; name: string; is_custom: boolean; todo_count: number } | null;
  title: string | null;
  summary: string | null;
  deadline: { status: 'FOUND' | 'UNCLEAR' | 'NONE'; date: string | null; label: string | null; box: ServerBox | null } | null;
  snooze_until: string | null;
  dismissed: boolean;
  created_at: string;
  status_changed_at: string;
  // 상세 응답에만 있어요
  category_source?: 'AI' | 'USER' | null;
  facts?: { key: string; label: string; value: string | null; box: ServerBox | null; edited: boolean }[];
  links?: { type: string; label: string; url: string }[];
  guide?: { title: string; lines: string[]; preparations: string[] } | null;
  checklist?: { id: string; text: string; checked: boolean }[];
  next_alarm_at?: string | null;
  error?: { code: string; message: string } | null;
};
type CaptureList = { items: ServerCapture[]; next_cursor: string | null };
export type CaptureActionName = 'COMPLETE' | 'SNOOZE' | 'DISMISS' | 'UNDO' | 'REOPEN';
export type CaptureActionResult = { capture: ServerCapture; undo: { token: string; expires_at: string } | null };

/** 한 상태의 캡처를 끝까지(페이지 넘겨가며) 가져와요 */
export async function getAllCaptures(status: 'TODO' | 'DONE' | 'REFERENCE') {
  const all: ServerCapture[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ status, limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page: CaptureList = await request<CaptureList>(`/captures?${query.toString()}`);
    all.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return all;
}
export function getCaptureDetail(id: string) {
  return request<ServerCapture>(`/captures/${id}`);
}
export function actOnCapture(id: string, action: CaptureActionName, extra: { snooze_until?: string; token?: string } = {}) {
  return request<CaptureActionResult>(`/captures/${id}/actions`, { method: 'POST', body: { action, ...extra } });
}
export function checkChecklistItem(id: string, itemId: string, checked: boolean) {
  return request<{ all_done: boolean }>(`/captures/${id}/checklist/${itemId}`, { method: 'PATCH', body: { checked } });
}
export function patchFacts(id: string, facts: { key: string; value: string | null }[]) {
  return request<ServerCapture>(`/captures/${id}/facts`, { method: 'PATCH', body: { facts } });
}
export function changeCaptureCategory(id: string, categoryId: number) {
  return request<unknown>(`/captures/${id}/category`, { method: 'PATCH', body: { categoryId } });
}
export function deleteCapture(id: string) {
  return request<void>(`/captures/${id}`, { method: 'DELETE' });
}
export type CompletionStats = {
  rate: number | null;
  done_count: number;
  todo_count: number;
  weekly: { week_start: string; rate: number }[];
};
export function getCompletionStats() {
  return request<CompletionStats>('/stats/completion');
}

/* ═════════ AI 분석 (사진 업로드) ═════════ */

export type AnalysisJob = {
  jobId: number;
  captureId: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  step?: 'OCR' | 'CATEGORIZE' | 'DONE';
  error?: { code: string; message: string } | null;
};

function mimeOf(uri: string) {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** 실천으로 분류한 사진을 올려 AI 분석을 시작해요. (이미지는 분석 후 서버에서 버려요) */
export function requestAnalysis(captureId: number | string, imageUri: string) {
  const type = mimeOf(imageUri);
  const form = new FormData();
  form.append('image', { uri: imageUri, name: `capture.${type.split('/')[1]}`, type } as unknown as Blob);
  return request<{ jobId: number; captureId: number; status: AnalysisJob['status']; pollAfterMs: number }>(
    `/captures/${captureId}/analysis`,
    { method: 'POST', body: form, timeoutMs: 60000 },
  );
}
export async function getAnalysisJobs(jobIds: number[]) {
  const data = await request<{ jobs: AnalysisJob[] }>(`/analysis-jobs?ids=${jobIds.join(',')}`);
  return data.jobs;
}

/* ═════════ 알림 설정 · 푸시 토큰 ═════════ */

export type AlarmSettings = {
  intervalHours: number;
  deadlineAlarmEnabled: boolean;
  dnd: boolean;
  locationAlarmEnabled: boolean;
};
export function getAlarmSettings() {
  return request<AlarmSettings>('/settings/alarm');
}
export function updateAlarmSettings(settings: AlarmSettings) {
  return request<AlarmSettings>('/settings/alarm', { method: 'PUT', body: settings });
}
export function registerPushToken(token: string, platform: 'ANDROID' | 'IOS') {
  return request<unknown>('/push-tokens', { method: 'POST', body: { token, platform } });
}
export function deletePushToken(token: string) {
  return request<void>(`/push-tokens/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
