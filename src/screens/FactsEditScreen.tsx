import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarDays } from 'lucide-react-native';
import { Button } from '../components/Button';
import { DateSheet } from '../components/DateSheet';
import { Screen } from '../components/Screen';
import { FormField } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { dayKey, parseDay, revertFact, updateFacts, useCapture } from '../store/practices';
import { colors, fonts, radius } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FactsEdit'>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 추출 정보 수정 (PATCH /captures/{id}/facts). 원본은 바뀌지 않아요 */
export function FactsEditScreen({ navigation, route }: Props) {
  const capture = useCapture(route.params.id);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((capture?.facts ?? []).map((f) => [f.key, f.value ?? ''])),
  );
  const [deadline, setDeadline] = useState<string | null>(capture?.deadline.date ?? null);
  const [dateOpen, setDateOpen] = useState(false);

  if (!capture) {
    return (
      <Screen title="정보 수정" onBack={navigation.goBack}>
        <Text style={styles.note}>찾을 수 없는 항목이에요</Text>
      </Screen>
    );
  }

  const deadlineChanged = deadline !== (capture.deadline.date ?? null);
  const changedFacts = Object.fromEntries(
    Object.entries(values).filter(([k, v]) => v !== (capture.facts.find((f) => f.key === k)?.value ?? '')),
  );
  const dirty = deadlineChanged || Object.keys(changedFacts).length > 0;

  const save = () => {
    updateFacts(capture.id, changedFacts, deadlineChanged ? deadline : undefined);
    navigation.goBack();
  };

  const deadlineLabel = deadline
    ? `${parseDay(deadline).getFullYear()}.${parseDay(deadline).getMonth() + 1}.${parseDay(deadline).getDate()} (${WEEKDAYS[parseDay(deadline).getDay()]})`
    : capture.deadline.status === 'UNCLEAR' && !deadlineChanged
      ? '날짜 확인 필요'
      : '마감 없음';

  return (
    <Screen
      title="정보 수정"
      onBack={navigation.goBack}
      contentStyle={{ gap: 16 }}
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="취소" variant="secondary" onPress={navigation.goBack} style={{ flex: 1 }} />
          <Button label="저장" onPress={save} disabled={!dirty} style={{ flex: 1 }} />
        </View>
      }
    >
      <Text style={styles.intro}>{`${capture.title ?? '이 실천'} · 원본과 비교해서 고쳐주세요.\n취소하면 이전 정보를 그대로 둬요.`}</Text>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>{capture.deadline.label ?? '마감'}</Text>
        <Pressable
          onPress={() => setDateOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`마감 날짜, ${deadlineLabel}`}
          style={styles.dateField}
        >
          <Text style={[styles.dateText, !deadline && { color: colors.textSub }]}>{deadlineLabel}</Text>
          <CalendarDays size={18} color={colors.textSub} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.hint}>마감을 바꾸면 알림 날짜도 다시 정해져요</Text>
      </View>

      {capture.facts.map((f) => (
        <View key={f.key} style={{ gap: 4 }}>
          <FormField
            label={f.label}
            value={values[f.key] ?? ''}
            onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            placeholder="직접 확인 필요"
            hint={f.value === null && !f.edited ? '원본에서 찾지 못한 정보예요' : undefined}
          />
          {f.edited && (
            <Pressable
              onPress={() => {
                revertFact(capture.id, f.key);
                navigation.goBack();
              }}
              accessibilityRole="button"
              hitSlop={6}
              style={{ alignSelf: 'flex-start' }}
            >
              <Text style={styles.revert}>직접 고친 값이에요 · AI가 읽은 값으로 되돌리기</Text>
            </Pressable>
          )}
        </View>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteTitle}>원본은 수정되지 않아요</Text>
        <Text style={styles.noteDesc}>고친 내용은 앱 안의 정보에만 반영돼요.</Text>
      </View>

      <DateSheet
        visible={dateOpen}
        title="마감 날짜"
        initial={deadline}
        allowNone
        noneLabel="마감 없음"
        minDate={dayKey(new Date())}
        onCancel={() => setDateOpen(false)}
        onConfirm={(v) => {
          setDeadline(v);
          setDateOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSub },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSub },
  dateField: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSub },
  revert: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary, textDecorationLine: 'underline' },
  note: { backgroundColor: colors.tint, borderRadius: radius.card, padding: 14, gap: 4 },
  noteTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  noteDesc: { fontFamily: fonts.regular, fontSize: 12, color: '#4f5a52' },
});
