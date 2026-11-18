import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Card, FormField, Lines, OptionRow, SettingItem, StatusChip } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { errorMessage } from '../services/api';
import { requestLocationAccess, stopGeofences, syncGeofences, useLocationAccess } from '../services/location';
import { DEFAULT_ALARM_SETTINGS, loadAccount, saveAlarmSettings, useAccount } from '../store/account';
import { isValidTime, saveQuietHours, useQuietHours } from '../store/quietHours';
import { colors, fonts } from '../theme';

const INTERVALS = [
  { hours: 12, label: '12시간 뒤' },
  { hours: 24, label: '24시간 뒤 · 기본' },
  { hours: 48, label: '48시간 뒤' },
];

type ReminderProps = NativeStackScreenProps<RootStackParamList, 'ReminderSettings'>;

/** 19 리마인드 주기 · 방해금지 설정 */
export function ReminderSettingsScreen({ navigation }: ReminderProps) {
  const account = useAccount();
  const settings = account.settings ?? DEFAULT_ALARM_SETTINGS;
  const [hours, setHours] = useState(settings.intervalHours);
  const [dnd, setDnd] = useState(settings.dnd);
  // 방해금지 시간은 서버에 필드가 없어서 이 기기에만 저장해요 (프론트 전용)
  const quiet = useQuietHours();
  const [start, setStart] = useState(quiet.start);
  const [end, setEnd] = useState(quiet.end);
  const [saving, setSaving] = useState(false);
  /** ⓘ 눌렀을 때 '다시 알려드릴 간격' 설명 */
  const [infoOpen, setInfoOpen] = useState(false);
  // 위치 기반 알림: 마이 화면과 같은 기준 (서버 설정 + 기기 위치 권한 '항상 허용')
  const { access, refresh: refreshAccess } = useLocationAccess();
  const hasAccess = access === 'granted';
  const [loc, setLoc] = useState(settings.locationAlarmEnabled);

  // 서버 값이 늦게 도착하면 화면 값도 맞춰요
  useEffect(() => {
    if (!account.settings) void loadAccount();
  }, [account.settings]);
  useEffect(() => {
    if (account.settings) {
      setHours(account.settings.intervalHours);
      setDnd(account.settings.dnd);
      setLoc(account.settings.locationAlarmEnabled);
    }
  }, [account.settings]);

  const locOn = loc && hasAccess;

  // 켤 때 권한이 없으면 먼저 요청하고, 그래도 안 되면 권한 안내 화면으로 보내요 (저장은 [저장] 버튼에서)
  const toggleLocation = async (value: boolean) => {
    if (value && !hasAccess) {
      const result = await requestLocationAccess();
      refreshAccess();
      if (result !== 'granted') {
        navigation.navigate('LocationPermission');
        return;
      }
    }
    setLoc(value);
  };

  const next = `${hours}시간 뒤 · 방해금지 ${dnd ? '켜짐' : '꺼짐'}`;

  const save = async () => {
    if (saving) return;
    if (dnd && (!isValidTime(start) || !isValidTime(end))) {
      Alert.alert('시간을 확인해 주세요', '시작·종료 시간은 22:00처럼 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (dnd) await saveQuietHours({ start, end });
      await saveAlarmSettings({ ...settings, intervalHours: hours, dnd, locationAlarmEnabled: locOn });
      // 위치 알림을 바꿨으면 기기의 장소 등록도 맞춰요
      if (locOn !== (settings.locationAlarmEnabled && hasAccess)) {
        if (locOn) await syncGeofences(true);
        else await stopGeofences();
      }
      navigation.navigate('Tabs', { screen: 'My', params: { variant: 'saved' } });
    } catch (error) {
      Alert.alert('설정을 저장하지 못했어요', errorMessage(error));
      navigation.navigate('SettingsSaveFailed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="리마인드 설정"
      onBack={navigation.goBack}
      contentStyle={{ gap: 14 }}
      footer={
        <View style={styles.actions}>
          <Button label="취소" variant="secondary" onPress={navigation.goBack} style={styles.flex} />
          <Button label="저장" onPress={save} disabled={saving} style={styles.flex} />
        </View>
      }
    >
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>다시 알려드릴 간격</Text>
        <Pressable
          onPress={() => setInfoOpen((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="다시 알려드릴 간격 설명 보기"
          accessibilityState={{ expanded: infoOpen }}
        >
          <Info size={16} color={infoOpen ? colors.primary : colors.textSub} strokeWidth={2} />
        </Pressable>
      </View>
      {infoOpen && (
        <View style={styles.infoBox} accessibilityLiveRegion="polite">
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.infoText}>
              마감 없는 실천을 하나씩 골라 이 간격마다 알려드려요.
            </Text>
            <Text style={styles.infoSub}>마감 있는 실천은 전날과 당일에 알려드릴게요.</Text>
          </View>
          <Pressable onPress={() => setInfoOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="설명 닫기">
            <X size={16} color={colors.textSub} strokeWidth={2} />
          </Pressable>
        </View>
      )}
      <View style={{ gap: 8 }}>
        {INTERVALS.map((o) => (
          <OptionRow
            key={o.hours}
            size="sm"
            label={o.label}
            selected={hours === o.hours}
            onPress={() => setHours(o.hours)}
          />
        ))}
      </View>

      <Card>
        <SettingItem
          label="방해금지"
          value={dnd}
          onValueChange={setDnd}
          description="이 시간에는 리마인드를 보내지 않아요."
          status={dnd ? '켜짐' : '꺼짐'}
        />
        {dnd && (
          <View style={styles.quietHours}>
            <FormField
              label="시작"
              value={start}
              onChangeText={setStart}
              style={styles.flex}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <FormField
              label="종료"
              value={end}
              onChangeText={setEnd}
              style={styles.flex}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        )}
      </Card>

      <Card>
        <SettingItem
          label="위치 기반 알림"
          value={locOn}
          onValueChange={toggleLocation}
          disabled={!hasAccess}
          onDisabledPress={() => void toggleLocation(true)}
          description={hasAccess ? '저장한 장소 근처에 가면 알려드려요.' : '위치 권한을 허용해야 켤 수 있어요.'}
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

      <Lines lines={[`저장하면 ${next}으로 변경돼요.`, `취소하면 ${settings.intervalHours}시간 뒤 · 방해금지 ${settings.dnd ? '켜짐' : '꺼짐'}을 유지해요.`]} size={11} />
    </Screen>
  );
}

/** S12B 설정 저장 실패 */
export function SettingsSaveFailedScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SettingsSaveFailed'>) {
  const goMy = () => navigation.navigate('Tabs', { screen: 'My' });

  return (
    <Screen
      title="리마인드 설정"
      onBack={navigation.goBack}
      contentStyle={{ gap: 16 }}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="12시간 · 방해금지 켜짐 저장 재시도"
            onPress={() => navigation.navigate('Tabs', { screen: 'My', params: { variant: 'saved' } })}
          />
          <Button label="취소" variant="secondary" onPress={goMy} />
        </View>
      }
    >
      <Card tone="error">
        <Text style={styles.errorTitle}>설정을 저장하지 못했어요</Text>
        <Text style={styles.errorBody}>
          12시간 뒤 · 방해금지 켜짐 변경이 반영되지 않았어요. 기존 24시간 뒤 · 꺼짐이 적용 중이에요.
        </Text>
      </Card>

      <Card>
        <StatusChip label="현재 적용 중 · 이전 값 보존" />
        <Text style={styles.current}>24시간 뒤</Text>
        <SettingItem label="방해금지" value={false} description="꺼짐 · 22:00 – 08:00 적용 안 함" status="꺼짐" />
        <SettingItem
          label="위치 기반 알림"
          value={false}
          disabled
          description="OS 권한 없음 · 꺼짐 유지"
          warning="권한 없음 · 사용 불가"
        />
      </Card>

      <Lines lines={['재시도할 입력: 12시간 뒤 / 켜짐 / 22:00–08:00', '취소하면 입력을 버리고 마이로 돌아가요.']} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  sectionTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 15, lineHeight: 22.5, color: colors.text },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.tint,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  infoText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.text },
  infoSub: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
  quietHours: { flexDirection: 'row', gap: 12 },
  errorTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.error },
  errorBody: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
  current: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.text },
});
