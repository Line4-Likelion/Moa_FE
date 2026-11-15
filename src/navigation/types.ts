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
  /** 추출 정보 수정 */
  FactsEdit: { id: string };
  /** 스와이프 분류 */
  /**
   * mode: new 새 캡처 / past 지난 캡처, limit: 이번에 분류할 장수 (12장 이하면 전부, 많으면 10장)
   * TODO: 분류 화면이 아직 이 값을 쓰지 않아요 (분류 화면 수정 때 반영)
   */
  Sort: { mode?: 'new' | 'past'; limit?: number } | undefined;
  /** 개발용 화면 목차 (홈 MoA 로고 길게 누르기) */
  DevIndex: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
