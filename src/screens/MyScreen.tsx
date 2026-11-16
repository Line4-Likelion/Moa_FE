import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Clock3, Sprout } from 'lucide-react-native';
import { Button } from '../components/Button';
import { LogoutSheet } from '../components/LogoutSheet';
import { errorMessage, logout, type AlarmSettings, type AuthUser } from '../services/api';
import { Screen } from '../components/Screen';
import { Card, Caption, Divider, Lines, SettingItem, StatusChip } from '../components/ui';
import type { TabParamList } from '../navigation/types';
import { DEFAULT_ALARM_SETTINGS, loadAccount, resetAccount, saveAlarmSettings, useAccount } from '../store/account';
import { unregisterPush } from '../services/push';
import { requestLocationAccess, stopGeofences, syncGeofences, useLocationAccess } from '../services/location';
import { useQuietHours } from '../store/quietHours';
import { resetStore } from '../store/practices';
import { colors, fonts } from '../theme';

type Props = BottomTabScreenProps<TabParamList, 'My'>;

const openSystemSettings = () => Linking.openSettings();

/** 08 마이 · 알림 설정 / S12A 프로필 조회 오류 / 19B 변경된 설정 저장 상태 / 17 로그아웃 확인 */
export function MyScreen({ route }: Props) {
  const navigation = useNavigation();
  const account = useAccount();
  const [logoutOpen, setLogoutOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadAccount();
    }, []),
  );

  useEffect(() => {
    if (route.params?.logout) setLogoutOpen(true);
  }, [route.params?.logout]);

  const settings = account.settings ?? DEFAULT_ALARM_SETTINGS;
  // 서버에서 프로필을 못 받았거나(오류) 개발용 목차에서 error 를 고른 경우
  const variant = route.params?.variant === 'error' || account.profileFailed ? 'error' : (route.params?.variant ?? 'default');

  const onConfirmLogout = async () => {
    setLogoutOpen(false);
    await stopGeofences();
    await unregisterPush(); // 로그아웃 전에 이 기기의 푸시 토큰을 지워요 (토큰이 필요해서 순서가 중요해요)
    await logout();
    resetStore();
    resetAccount();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <>
      <Screen title="마이" hasTabBar contentStyle={{ gap: variant === 'default' ? 12 : 16 }}>
        {variant === 'default' && (
          <DefaultView profile={account.profile} settings={settings} onLogout={() => setLogoutOpen(true)} />
        )}
        {variant === 'error' && <ErrorView settings={settings} onRetry={() => void loadAccount()} />}
        {variant === 'saved' && <SavedView profile={account.profile} settings={settings} />}
      </Screen>
      <LogoutSheet visible={logoutOpen} onCancel={() => setLogoutOpen(false)} onConfirm={onConfirmLogout} />
    </>
  );
}

/* ───────── 08 기본 ───────── */
function DefaultView({
  profile,
  settings,
  onLogout,
}: {
  profile: AuthUser | null;
  settings: AlarmSettings;
  onLogout: () => void;
}) {
  const navigation = useNavigation();
  const quiet = useQuietHours();
  const range = `${quiet.start} – ${quiet.end}`;
  const goReminder = () => navigation.navigate('ReminderSettings');
  const [pendingDnd, setPendingDnd] = useState<boolean | null>(null);
  const dnd = pendingDnd ?? settings.dnd;
  const { access, refresh: refreshAccess } = useLocationAccess();
  const [pendingLoc, setPendingLoc] = useState<boolean | null>(null);
  const hasAccess = access === 'granted';
  const locOn = pendingLoc ?? (settings.locationAlarmEnabled && hasAccess);

  // 위치 기반 알림: 권한이 없으면 먼저 요청하고, 그래도 안 되면 권한 안내 화면으로 보내요.
  // 켜면 서버에 저장하고 장소를 기기에 등록해요. 끄면 등록을 해제해요
  const toggleLocation = async (value: boolean) => {
    if (value && !hasAccess) {
      const result = await requestLocationAccess();
      refreshAccess();
      if (result !== 'granted') {
        navigation.navigate('LocationPermission');
        return;
      }
    }
    setPendingLoc(value);
    try {
      await saveAlarmSettings({ ...settings, locationAlarmEnabled: value });
      if (value) await syncGeofences(true);
      else await stopGeofences();
    } catch (error) {
      Alert.alert('설정을 저장하지 못했어요', errorMessage(error));
    } finally {
      setPendingLoc(null);
    }
  };

  // 방해금지는 바로 저장해요. 실패하면 원래 값으로 돌아가요
  const toggleDnd = async (value: boolean) => {
    setPendingDnd(value);
    try {
      await saveAlarmSettings({ ...settings, dnd: value });
    } catch (error) {
      Alert.alert('설정을 저장하지 못했어요', errorMessage(error));
    } finally {
      setPendingDnd(null);
    }
  };

  return (
    <>
      <Card>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Sprout size={22} color={colors.primary} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.name}>{profile?.nickname ?? ' '}</Text>
            <Caption>{profile?.email ?? ' '}</Caption>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.settingsHeading}>
          <Text style={styles.cardTitle}>리마인드 설정</Text>
          <Pressable onPress={goReminder} hitSlop={8} accessibilityRole="button" accessibilityLabel="리마인드 설정 변경">
            <StatusChip label="변경" />
          </Pressable>
        </View>
        <Pressable onPress={goReminder} style={styles.infoRow}>
          <Clock3 size={18} color={colors.textSub} strokeWidth={1.5} />
          <Text style={styles.infoLabel}>주기</Text>
          <Text style={styles.infoValue}>{`${settings.intervalHours}시간 뒤  ›`}</Text>
        </Pressable>
        <Divider />
        <SettingItem
          label="방해금지"
          value={dnd}
          onValueChange={toggleDnd}
          description={dnd ? `${range} 적용 중` : `시간 설정 ${range} · 현재 적용 안 함`}
          status={dnd ? '켜짐' : '꺼짐'}
        />
        <Divider />
        <SettingItem
          label="위치 기반 알림"
          value={locOn}
          onValueChange={toggleLocation}
          disabled={!hasAccess}
          onDisabledPress={() => void toggleLocation(true)}
          description={
            hasAccess ? '저장한 장소 근처에 가면 알려드려요.' : '위치 권한을 허용해야 켤 수 있어요.'
          }
          status={hasAccess ? (locOn ? '켜짐' : '꺼짐') : undefined}
          warning={
            hasAccess
              ? undefined
              : access === 'foreground'
                ? '앱 사용 중에만 허용 · 항상 허용이 필요해요'
                : '권한 없음 · 사용 불가'
          }
        />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { fontSize: 14 }]}>알림과 위치 권한</Text>
        <Lines
          size={11}
          lines={[
            '알림: 허용됨 · 대기 중인 실천만 알려드려요.',
            hasAccess
              ? '위치: 항상 허용됨 · 저장한 장소 근처에서 알려드려요.'
              : access === 'foreground'
                ? '위치: 앱 사용 중에만 허용 · 알림을 받으려면 항상 허용이 필요해요.'
                : '위치: 허용 안 함 · 방문할 장소 근처에서 알림을 받으려면 권한이 필요해요.',
          ]}
        />
        <Pressable onPress={openSystemSettings}>
          <Text style={styles.link}>{'시스템 설정 열기  ↗'}</Text>
        </Pressable>
      </Card>

      <Lines size={11} lines={['다시 실천하기를 하면 대기 알림이 재개돼요.', '참고 항목에는 알림을 보내지 않아요.']} />
      <Pressable onPress={onLogout} hitSlop={8} accessibilityRole="button">
        <Caption>로그아웃</Caption>
      </Pressable>
    </>
  );
}

/* ───────── S12A 프로필 조회 오류 ───────── */
function ErrorView({ settings, onRetry }: { settings: AlarmSettings; onRetry: () => void }) {
  return (
    <>
      <Card tone="error">
        <Text style={styles.errorTitle}>프로필을 불러오지 못했어요</Text>
        <Lines size={12} lines={['닉네임과 이메일을 확인할 수 없어요.', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.']} />
      </Card>
      <Button label="프로필 다시 불러오기" variant="secondary" onPress={onRetry} />
      <Card>
        <Text style={styles.cardTitle}>저장된 알림 설정</Text>
        <Text style={styles.body}>{`리마인드 · ${settings.intervalHours}시간 뒤`}</Text>
        <SettingItem label="방해금지" value={settings.dnd} status={settings.dnd ? '켜짐' : '꺼짐'} />
        <SettingItem
          label="위치 기반 알림"
          value={false}
          disabled
          description="OS 위치 권한 없음 · 꺼짐"
          warning="권한 없음 · 사용 불가"
        />
      </Card>
      <Lines size={12} lines={['프로필 오류로 기존 설정이 바뀌지는 않아요.', '권한 변경은 시스템 설정에서 할 수 있어요.']} />
      <Pressable onPress={openSystemSettings}>
        <Text style={[styles.link, { fontFamily: fonts.regular }]}>시스템 설정 열기 ↗</Text>
      </Pressable>
    </>
  );
}

/* ───────── 19B 변경된 설정 저장 상태 ───────── */
function SavedView({ profile, settings }: { profile: AuthUser | null; settings: AlarmSettings }) {
  return (
    <>
      <Card>
        <Text style={[styles.name, { lineHeight: 25.5 }]}>{profile?.nickname ?? ' '}</Text>
        <Caption>{profile?.email ?? ' '}</Caption>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>리마인드 설정 · 변경</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>주기</Text>
          <Text style={styles.infoValue}>{`${settings.intervalHours}시간 뒤`}</Text>
        </View>
        <Divider />
        <SettingItem
          label="방해금지"
          value={settings.dnd}
          description={settings.dnd ? '22:00 – 08:00 적용 중' : '현재 적용 안 함'}
          status={settings.dnd ? '켜짐' : '꺼짐'}
        />
        <Divider />
        <SettingItem
          label="위치 기반 알림"
          value={false}
          disabled
          description="권한이 없어 꺼진 상태를 유지해요."
          warning="권한 없음 · 사용 불가"
        />
      </Card>
      <Pressable onPress={openSystemSettings}>
        <Text style={[styles.link, { fontFamily: fonts.regular }]}>시스템 설정 열기 ↗</Text>
      </Pressable>
      <View style={styles.toast}>
        <Text style={styles.toastText}>설정을 저장했어요</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 25.5, color: colors.text },
  settingsHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.text },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { width: 60, fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  infoValue: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19.5, color: colors.text },
  link: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.primary },
  errorTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.error },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  toast: { backgroundColor: colors.text, borderRadius: 12, padding: 14 },
  toastText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#fff' },
});
