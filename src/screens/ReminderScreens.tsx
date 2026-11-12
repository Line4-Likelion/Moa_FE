import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Card, FormField, Lines, OptionRow, SettingItem, StatusChip } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

const INTERVALS = [
  { hours: 12, label: '12시간 뒤' },
  { hours: 24, label: '24시간 뒤 · 기본' },
  { hours: 48, label: '48시간 뒤' },
];

type ReminderProps = NativeStackScreenProps<RootStackParamList, 'ReminderSettings'>;

/** 19 리마인드 주기 · 방해금지 설정 */
export function ReminderSettingsScreen({ navigation }: ReminderProps) {
  const [hours, setHours] = useState(12);
  const [dnd, setDnd] = useState(true);
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('08:00');

  const next = `${hours}시간 뒤 · 방해금지 ${dnd ? '켜짐' : '꺼짐'}`;

  const save = () => navigation.navigate('Tabs', { screen: 'My', params: { variant: 'saved' } });

  return (
    <Screen
      title="리마인드 설정"
      onBack={navigation.goBack}
      contentStyle={{ gap: 14 }}
      footer={
        <View style={styles.actions}>
          <Button label="취소" variant="secondary" onPress={navigation.goBack} style={styles.flex} />
          <Button label="저장" onPress={save} style={styles.flex} />
        </View>
      }
    >
      <Text style={styles.sectionTitle}>다시 알려드릴 간격</Text>
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
          value={false}
          disabled
          description="위치 권한 없음 · 현재 꺼짐"
          warning="권한 없음 · 사용 불가"
        />
      </Card>

      <Lines lines={[`저장하면 ${next}으로 변경돼요.`, '취소하면 24시간 뒤 · 꺼짐을 유지해요.']} size={11} />
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
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22.5, color: colors.text },
  quietHours: { flexDirection: 'row', gap: 12 },
  errorTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.error },
  errorBody: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
  current: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.text },
});
