import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { SecureStore } from '../services/native';

/**
 * 방해금지 시간 (시작 ~ 종료)
 * 서버에는 켜짐/꺼짐만 있어서, 시간은 이 기기에만 저장해요 (프론트 전용).
 */
export type QuietHours = { start: string; end: string };

const KEY = 'moa.quiet_hours';
const DEFAULT: QuietHours = { start: '22:00', end: '08:00' };

let state: QuietHours = DEFAULT;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useQuietHours() {
  return useSyncExternalStore(subscribe, () => state);
}

/** HH:MM 형식(00:00~23:59)인지 */
export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function saveQuietHours(next: QuietHours) {
  state = next;
  listeners.forEach((l) => l());
  if (Platform.OS === 'web' || !SecureStore) return;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[moa] 방해금지 시간을 저장하지 못했어요', error);
  }
}

/** 앱을 켤 때 저장된 값을 불러와요 */
export async function loadQuietHours() {
  if (Platform.OS === 'web' || !SecureStore) return;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as QuietHours;
    if (isValidTime(parsed.start) && isValidTime(parsed.end)) {
      state = parsed;
      listeners.forEach((l) => l());
    }
  } catch {
    // 저장된 값이 깨졌으면 기본값을 써요
  }
}
