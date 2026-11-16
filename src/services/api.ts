type ApiResponse<T> = { success: boolean; message: string; data: T };
type AuthResponse = { access_token: string; refresh_token: string };
export type Classification = 'PRACTICE' | 'REFERENCE';
export type ClassificationRecord = { id: number; fileKey: string; classification: Classification | 'DELETE' };

let accessToken: string | null = null;
let refreshToken: string | null = null;
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  if (!baseUrl) throw new Error('서버 주소가 설정되지 않았어요.');
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  if (response.status === 401 && retry && refreshToken && !path.startsWith('/auth/')) {
    const refreshResponse = await fetch(`${baseUrl}/auth/reissue`, {
      method: 'POST', headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json() as ApiResponse<AuthResponse>;
      accessToken = refreshed.data.access_token;
      refreshToken = refreshed.data.refresh_token;
      return request<T>(path, options, false);
    }
  }
  const body = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!response.ok || !body?.success) throw new Error(body?.message || '서버에 연결하지 못했어요. 다시 시도해 주세요.');
  return body.data;
}

export async function authenticate(path: '/auth/login' | '/auth/signup', payload: object) {
  const data = await request<AuthResponse>(path, { method: 'POST', body: JSON.stringify(payload) });
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
}
export function clearSession() { accessToken = null; refreshToken = null; }
export function getClassifications() { return request<ClassificationRecord[]>('/screenshot-classifications'); }
export async function saveClassification(fileKey: string, classification: Classification) {
  try {
    const records = await request<ClassificationRecord[]>('/screenshot-classifications', {
      method: 'POST', body: JSON.stringify({ items: [{ fileKey, classification }] }),
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
    method: 'PATCH', body: JSON.stringify({ classification }),
  });
}
export function cancelClassification(id: number) {
  return request<void>(`/screenshot-classifications/${id}`, { method: 'DELETE' });
}
