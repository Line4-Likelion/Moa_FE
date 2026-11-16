import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { deletePushToken, registerPushToken } from './api';

/**
 * 푸시 알림 (D-01 ~ D-03)
 * - 서버는 Firebase(FCM)로 보내요 → Expo 토큰이 아니라 기기의 FCM 토큰을 등록해요.
 * - 서버가 보내는 data: { type, capture_id, deeplink: "moa://captures/{id}" }
 * - 필요한 설정: Firebase 프로젝트의 google-services.json (app.json 의 android.googleServicesFile)
 *   이 없으면 토큰을 못 받아요. 그래도 앱은 정상 동작해요.
 */

// 앱이 켜져 있을 때도 알림을 보여줘요
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/** 알림 권한을 받고 FCM 토큰을 서버에 등록해요. 성공하면 true */
export async function registerForPush(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '모아 알림',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;

    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = typeof data === 'string' ? data : null;
    if (!token) return false;
    if (token === registeredToken) return true;

    await registerPushToken(token, Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
    registeredToken = token;
    return true;
  } catch (error) {
    // google-services.json 이 없거나 서버에 닿지 못한 경우 등
    console.warn('[moa] 푸시 등록을 하지 못했어요', error);
    return false;
  }
}

/** 로그아웃할 때 이 기기로는 알림이 가지 않게 토큰을 지워요 */
export async function unregisterPush() {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await deletePushToken(token);
  } catch {
    // 이미 로그아웃된 상태일 수 있어요
  }
}

/** 알림 data 에서 열어야 할 캡처 id 를 꺼내요 (capture_id 우선, 없으면 deeplink) */
function captureIdOf(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.capture_id === 'string' && data.capture_id) return data.capture_id;
  if (typeof data.deeplink === 'string') {
    const match = data.deeplink.match(/captures\/(\w+)/);
    if (match) return match[1];
  }
  return null;
}

/** 알림을 눌렀을 때(앱이 꺼져 있었던 경우 포함) 실천 상세로 이동해요 */
export function usePushNavigation(navigation: NavigationContainerRefWithCurrent<RootStackParamList>) {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const id = captureIdOf(response?.notification.request.content.data);
      if (!id) return;
      // 로그인 정보가 복원되기 전에 눌렀어도 잠깐 기다렸다 이동해요
      const go = (tries: number) => {
        if (navigation.isReady()) navigation.navigate('PracticeDetail', { id });
        else if (tries > 0) setTimeout(() => go(tries - 1), 300);
      };
      go(20);
    };

    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [navigation]);
}
