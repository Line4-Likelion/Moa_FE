import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
// 쓰는 굵기만 개별 import (전체 import 시 안 쓰는 폰트까지 앱 용량에 포함됨)
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { NotoSansKR_500Medium } from '@expo-google-fonts/noto-sans-kr/500Medium';
import { NotoSansKR_700Bold } from '@expo-google-fonts/noto-sans-kr/700Bold';
import { NotoSerifKR_600SemiBold } from '@expo-google-fonts/noto-serif-kr/600SemiBold';
import { DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBar } from './src/components/TabBar';
import type { RootStackParamList, TabParamList } from './src/navigation/types';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { LoginScreen, SignupScreen } from './src/screens/AuthScreens';
import { CategoryAddScreen, CategoryChangeScreen } from './src/screens/CategoryScreens';
import { DevHomeScreen } from './src/screens/DevHomeScreen';
import { PracticeScreen } from './src/screens/PracticeScreen';
import { PracticeDetailScreen } from './src/screens/PracticeDetailScreen';
import { OriginalViewScreen } from './src/screens/OriginalViewScreen';
import { FactsEditScreen } from './src/screens/FactsEditScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SortScreen } from './src/screens/SortScreen';
import { MyScreen } from './src/screens/MyScreen';
import {
  LocationPermissionScreen,
  NotificationPermissionScreen,
  PhotoPermissionScreen,
} from './src/screens/PermissionScreens';
import { ReminderSettingsScreen, SettingsSaveFailedScreen } from './src/screens/ReminderScreens';
import { onSessionExpired, restoreSession } from './src/services/api';
import { registerForPush, usePushNavigation } from './src/services/push';
import { refreshAll, resetStore } from './src/store/practices';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border },
};

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function Tabs() {
  // 로그인한 뒤 알림 권한을 받고 푸시 토큰을 서버에 등록해요
  useEffect(() => {
    void registerForPush();
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      // 탭을 열 때마다 서버의 최신 목록을 받아와요 (로그인 직후 첫 화면 포함)
      screenListeners={{ focus: () => void refreshAll() }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Practice" component={PracticeScreen} />
      <Tab.Screen name="Archive" component={ArchiveScreen} />
      <Tab.Screen name="My" component={MyScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
    NotoSerifKR_600SemiBold,
  });

  // 저장된 로그인이 있으면 로그인 화면을 건너뛰어요
  const [startRoute, setStartRoute] = useState<'Login' | 'Tabs' | null>(null);
  useEffect(() => {
    void restoreSession().then((ok) => setStartRoute(ok ? 'Tabs' : 'Login'));
  }, []);
  usePushNavigation(navigationRef);

  useEffect(() => {
    // 로그인이 만료돼 다시 받지도 못하면 로그인 화면으로 보내요
    onSessionExpired(() => {
      resetStore();
      if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
    return () => onSessionExpired(null);
  }, []);

  if (!fontsLoaded || !startRoute) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} ref={navigationRef}>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName={startRoute}
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="CategoryAdd" component={CategoryAddScreen} />
          <Stack.Screen name="CategoryChange" component={CategoryChangeScreen} />
          <Stack.Screen name="ReminderSettings" component={ReminderSettingsScreen} />
          <Stack.Screen name="SettingsSaveFailed" component={SettingsSaveFailedScreen} />
          <Stack.Screen name="PhotoPermission" component={PhotoPermissionScreen} />
          <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
          <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
          <Stack.Screen name="DevIndex" component={DevHomeScreen} />
          <Stack.Screen name="PracticeDetail" component={PracticeDetailScreen} />
          <Stack.Screen name="OriginalView" component={OriginalViewScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="FactsEdit" component={FactsEditScreen} />
          <Stack.Screen name="Sort" component={SortScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
