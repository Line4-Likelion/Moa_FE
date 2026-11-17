/**
 * 네이티브 모듈을 '있으면 쓰는' 방식으로 불러와요.
 * 설치된 개발용 앱(APK)에 모듈이 빠져 있어도 앱이 꺼지지 않고, 그 기능만 비활성화돼요.
 * (예: 로그인 유지·푸시 알림·사진 접근은 모듈이 있는 새 빌드에서만 동작)
 */
export function optionalModule<T>(load: () => T, name: string): T | null {
  try {
    return load();
  } catch (error) {
    console.warn(`[moa] 네이티브 모듈 '${name}' 을(를) 쓸 수 없어요. 앱을 새로 빌드하면 활성화돼요.`, error);
    return null;
  }
}

export const SecureStore = optionalModule(() => require('expo-secure-store') as typeof import('expo-secure-store'), 'expo-secure-store');
export const Notifications = optionalModule(() => require('expo-notifications') as typeof import('expo-notifications'), 'expo-notifications');
export const MediaLibrary = optionalModule(
  () => require('expo-media-library/legacy') as typeof import('expo-media-library/legacy'),
  'expo-media-library',
);

export const Location = optionalModule(() => require('expo-location') as typeof import('expo-location'), 'expo-location');
export const TaskManager = optionalModule(
  () => require('expo-task-manager') as typeof import('expo-task-manager'),
  'expo-task-manager',
);
export const ImageManipulator = optionalModule(
  () => require('expo-image-manipulator') as typeof import('expo-image-manipulator'),
  'expo-image-manipulator',
);

type KeyValueStore = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
/** 앱 로컬 저장 (명세서: 분류 기록·기준 시각 등은 기기에 저장) */
export const AsyncStorage = optionalModule(
  () => (require('@react-native-async-storage/async-storage') as { default: KeyValueStore }).default,
  '@react-native-async-storage/async-storage',
);
