import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// 쓰는 굵기만 개별 import (전체 import 시 안 쓰는 폰트까지 앱 용량에 포함됨)
import { NotoSansKR_400Regular } from '@expo-google-fonts/noto-sans-kr/400Regular';
import { NotoSansKR_500Medium } from '@expo-google-fonts/noto-sans-kr/500Medium';
import { NotoSansKR_700Bold } from '@expo-google-fonts/noto-sans-kr/700Bold';
import { NotoSerifKR_600SemiBold } from '@expo-google-fonts/noto-serif-kr/600SemiBold';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
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
import { HomeScreen } from './src/screens/HomeScreen';
import { SortScreen } from './src/screens/SortScreen';
import { MyScreen } from './src/screens/MyScreen';
import {
  LocationPermissionScreen,
  NotificationPermissionScreen,
  PhotoPermissionScreen,
} from './src/screens/PermissionScreens';
import { ReminderSettingsScreen, SettingsSaveFailedScreen } from './src/screens/ReminderScreens';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border },
};

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
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

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName="Login"
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
          <Stack.Screen name="Sort" component={SortScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
