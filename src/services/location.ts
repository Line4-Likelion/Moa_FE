import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type * as LocationTypes from 'expo-location';
import { getGeofences, isLoggedIn, notifyArrival, restoreSession } from './api';
import { Location, TaskManager } from './native';

/**
 * 위치 기반 알림 (D-04)
 * 1) 서버의 /geofences 에서 알림을 받을 장소 목록을 가져와 기기에 지오펜스로 등록해요.
 * 2) 장소 근처(반경 300m)에 들어가면 기기가 백그라운드 작업을 깨워서 /geofences/{cap_id}/arrived 를 호출해요.
 * 3) 서버가 푸시를 보내요 (장소별 하루 한 번, 방해금지면 보내지 않아요).
 * 항상 허용(백그라운드 위치) 권한이 있어야 앱이 꺼져 있어도 동작해요.
 */

export const GEOFENCE_TASK = 'moa-geofence-task';

/** 백그라운드 작업은 앱 시작 시점에 등록돼 있어야 해서, 이 파일을 App 에서 가져오는 것만으로 등록돼요 */
if (Location && TaskManager) {
  const enterEvent = Location.GeofencingEventType.Enter;
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[moa] 지오펜스 작업 오류', error);
      return;
    }
    const { eventType, region } = data as { eventType: LocationTypes.GeofencingEventType; region: LocationTypes.LocationRegion };
    if (eventType !== enterEvent || !region?.identifier) return;
    try {
      // 앱이 꺼진 채 깨어난 경우 로그인 정보가 메모리에 없어서, 저장된 로그인을 먼저 복원해요
      if (!isLoggedIn()) await restoreSession();
      const result = await notifyArrival(region.identifier);
      console.log('[moa] 장소 도착', region.identifier, result?.message);
    } catch (e) {
      console.warn('[moa] 장소 도착 알림 요청 실패', e);
    }
  });
}

/** granted = 항상 허용 · foreground = 앱 사용 중에만 허용 · denied = 허용 안 함 · unavailable = 이 빌드/기기에서 사용 불가 */
export type LocationAccess = 'granted' | 'foreground' | 'denied' | 'unavailable';

export async function getLocationAccess(): Promise<LocationAccess> {
  if (Platform.OS === 'web' || !Location) return 'unavailable';
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return 'denied';
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.granted ? 'granted' : 'foreground';
  } catch {
    return 'unavailable';
  }
}

/** 권한 요청 (앱 사용 중 → 항상 허용 순서). 결과를 돌려줘요 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  if (Platform.OS === 'web' || !Location) return 'unavailable';
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return 'denied';
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.granted ? 'granted' : 'foreground';
  } catch {
    return 'unavailable';
  }
}

let lastSyncAt = 0;

/**
 * 서버의 장소 목록과 기기의 지오펜스를 맞춰요.
 * 위치 알림이 꺼져 있거나 권한이 없으면 서버 목록이 비어 있거나 권한이 없어서 등록을 모두 해제해요.
 */
export async function syncGeofences(force = false) {
  if (Platform.OS === 'web' || !Location || !TaskManager || !isLoggedIn()) return;
  if (!force && Date.now() - lastSyncAt < 30_000) return;
  lastSyncAt = Date.now();
  try {
    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    const access = await getLocationAccess();
    if (access !== 'granted') {
      if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
      return;
    }
    const places = await getGeofences();
    if (places.length === 0) {
      if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
      return;
    }
    await Location.startGeofencingAsync(
      GEOFENCE_TASK,
      places.map((p) => ({
        identifier: p.capture_id,
        latitude: p.lat,
        longitude: p.lng,
        radius: p.radius_m,
        notifyOnEnter: true,
        notifyOnExit: false,
      })),
    );
    console.log(`[moa] 위치 알림 장소 ${places.length}곳 등록`);
  } catch (error) {
    console.warn('[moa] 지오펜스 동기화 실패', error);
  }
}

/** 위치 알림을 끄거나 로그아웃할 때 기기의 지오펜스를 모두 해제해요 */
export async function stopGeofences() {
  if (Platform.OS === 'web' || !Location) return;
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  } catch (error) {
    console.warn('[moa] 지오펜스 해제 실패', error);
  }
}

/** 화면에서 위치 권한 상태를 보여줘요. 화면에 돌아오거나(시스템 설정에서 바꾸고 온 경우 포함) 앱이 다시 켜질 때 새로 확인해요 */
export function useLocationAccess() {
  const [access, setAccess] = useState<LocationAccess>('denied');
  const refresh = useCallback(() => {
    void getLocationAccess().then(setAccess);
  }, []);

  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { access, refresh };
}
