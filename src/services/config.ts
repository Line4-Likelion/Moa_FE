/**
 * 서버 연결 스위치
 * .env.local 에 EXPO_PUBLIC_API_URL 이 있으면 실제 서버·기기 사진을 쓰고,
 * 없으면 목업 데이터로 동작해요 (서버 없이 Expo Go 로 화면 확인할 때).
 */
export const USE_SERVER = !!process.env.EXPO_PUBLIC_API_URL;
