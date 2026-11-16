import { useSyncExternalStore } from 'react';
import * as api from '../services/api';

/** 내 프로필(GET /users/me)과 알림 설정(GET·PUT /settings/alarm) — 마이 · 리마인드 설정 화면이 같이 써요 */

export type AccountState = {
  profile: api.AuthUser | null;
  settings: api.AlarmSettings | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** 프로필만 못 받았는지 (설정은 받았어도 프로필 오류 화면을 보여주기 위해) */
  profileFailed: boolean;
};

const INITIAL: AccountState = { profile: null, settings: null, status: 'idle', profileFailed: false };
let state: AccountState = INITIAL;
const listeners = new Set<() => void>();

function setState(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccount() {
  return useSyncExternalStore(subscribe, () => state);
}

export function resetAccount() {
  setState(INITIAL);
}

/** 프로필과 알림 설정을 새로 받아와요. 둘 중 하나가 실패해도 받은 것은 보여줘요 */
export async function loadAccount() {
  if (!api.isLoggedIn()) return;
  setState({ ...state, status: state.profile || state.settings ? state.status : 'loading' });
  const [profile, settings] = await Promise.allSettled([api.getMe(), api.getAlarmSettings()]);
  setState({
    profile: profile.status === 'fulfilled' ? profile.value : state.profile,
    settings: settings.status === 'fulfilled' ? settings.value : state.settings,
    profileFailed: profile.status === 'rejected',
    status: profile.status === 'rejected' && settings.status === 'rejected' ? 'error' : 'ready',
  });
}

/** 알림 설정 저장. 실패하면 이전 값을 그대로 두고 던져요 */
export async function saveAlarmSettings(next: api.AlarmSettings) {
  const saved = await api.updateAlarmSettings(next);
  setState({ ...state, settings: saved });
  return saved;
}

/** 서버에 설정이 아직 없을 때(처음 로그인 직후) 화면에 보여줄 기본값 */
export const DEFAULT_ALARM_SETTINGS: api.AlarmSettings = {
  intervalHours: 24,
  deadlineAlarmEnabled: true,
  dnd: false,
  locationAlarmEnabled: false,
};
