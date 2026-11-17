import type { NavigatorScreenParams } from '@react-navigation/native';

export type MyVariant = 'default' | 'error' | 'saved';

export type TabParamList = {
  Home: undefined;
  Practice: undefined;
  Archive: { empty?: boolean } | undefined;
  My: { variant?: MyVariant; logout?: boolean } | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  /** 회원가입 1단계: 약관·개인정보 동의 */
  SignupTerms: undefined;
  Signup: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  CategoryAdd: undefined;
  /** label: 카테고리를 바꿀 항목 이름 (예: "연남 소바실", "3개 항목") */
  CategoryChange: { label: string; ids?: string[] };
  ReminderSettings: undefined;
  SettingsSaveFailed: undefined;
  PhotoPermission: undefined;
  LocationPermission: undefined;
  NotificationPermission: undefined;
  /** 실천 상세 (알림 딥링크 moa://captures/{id} 도 여기로) */
  PracticeDetail: { id: string };
  /** 원본 전체 보기. focus: 처음에 강조할 정보 key (deadline, place …) */
  OriginalView: { id: string; focus?: string };
  /** 참고함 상세 (사진 확대 · 실천으로 바꾸기 · 삭제) */
  ReferenceDetail: { id: string };
  /** 추출 정보 수정 */
  FactsEdit: { id: string };
  /** 스와이프 분류 */
  /**
   * mode: new 새 캡처 / past 지난 캡처, limit: 이번에 분류할 장수 (12장 이하면 전부, 많으면 10장)
   * onboarding: 처음 세팅의 첫 분류면 끝나고 첫 결과 화면으로
   */
  Sort: { mode?: 'new' | 'past'; limit?: number; onboarding?: boolean } | undefined;
  /** 처음 세팅 ① 사진 접근 안내 ② 범위 고르기 ③ 첫 결과 */
  OnboardingPhoto: undefined;
  OnboardingRange: undefined;
  OnboardingResult: { practice: number; reference: number };
  /** 개발용 화면 목차 (홈 MoA 로고 길게 누르기) */
  DevIndex: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
