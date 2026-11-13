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
  CategoryChange: { label: string };
  ReminderSettings: undefined;
  SettingsSaveFailed: undefined;
  PhotoPermission: undefined;
  LocationPermission: undefined;
  NotificationPermission: undefined;
  /** 스와이프 분류 */
  Sort: undefined;
  /** 개발용 화면 목차 (홈 MoA 로고 길게 누르기) */
  DevIndex: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
