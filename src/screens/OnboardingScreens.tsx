import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Images, ListChecks, ShieldCheck } from 'lucide-react-native';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/types';
import { applyOnboardingRange, countAllScreenshots, finishOnboarding, type OnboardingRange } from '../store/home';
import { colors, fonts, radius } from '../theme';

type Nav<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

/* ═════════ ① 사진 접근 안내 (A-01) ═════════ */

export function OnboardingPhotoScreen({ navigation }: Nav<'OnboardingPhoto'>) {
  const insets = useSafeAreaInsets();

  const allow = async () => {
    // TODO(기기 연동): MediaLibrary.requestPermissionsAsync(false, ['photo'])
    // 거부하면 navigation.navigate('PhotoPermission') (S04A)
    const granted = true;
    if (granted) navigation.replace('OnboardingRange');
    else navigation.navigate('PhotoPermission');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Images size={34} color={colors.primary} strokeWidth={1.7} />
        </View>
        <Text style={styles.title}>{'스크린샷을 정리하려면\n사진 접근이 필요해요'}</Text>
        <Text style={styles.desc}>쌓여 있는 스크린샷을 불러와서{'\n'}실천할 것과 참고할 것으로 나눠드려요.</Text>

        <View style={styles.points}>
          <Point icon={<ListChecks size={18} color={colors.primary} strokeWidth={2} />} text="스크린샷만 골라서 보여드려요" />
          <Point
            icon={<ShieldCheck size={18} color={colors.primary} strokeWidth={2} />}
            text="실천으로 고른 사진만 분석에 쓰고, 분석이 끝나면 서버에서 바로 지워요"
          />
        </View>
      </View>

      <Button label="사진 접근 허용하기" onPress={allow} />
    </View>
  );
}

function Point({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.point}>
      {icon}
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

/* ═════════ ② 범위 고르기 ═════════ */

const rangesFor = (total: number): { key: OnboardingRange; label: string; desc: string; recommended?: boolean }[] => [
  { key: 'RECENT_30', label: '최근 30장', desc: '가볍게 시작하기 좋아요', recommended: true },
  { key: 'LAST_MONTH', label: '최근 한 달', desc: '지난 30일 동안 찍은 스크린샷' },
  { key: 'ALL', label: '전부', desc: `${total}장 모두 차근차근` },
];

export function OnboardingRangeScreen({ navigation }: Nav<'OnboardingRange'>) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<OnboardingRange>('RECENT_30');
  /** 전체 스크린샷 장수 (서버 모드면 기기에서 세요). null 이면 세는 중 */
  const [total, setTotal] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    countAllScreenshots().then(setTotal);
  }, []);

  const start = async () => {
    // PUT /users/me/onboarding { range, baseline_at }
    setStarting(true);
    await applyOnboardingRange(range);
    navigation.replace('Sort', { mode: 'new', limit: 10, onboarding: true });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.body}>
        <Text style={styles.title}>
          {total === null ? '스크린샷을 세고 있어요' : `스크린샷이 ${total}장 있어요.\n어디부터 정리할까요?`}
        </Text>
        <Text style={styles.desc}>고르지 않은 예전 스크린샷은 '지난 캡처'로 따로 두고,{'\n'}원할 때 정리할 수 있어요.</Text>

        <View style={styles.options}>
          {rangesFor(total ?? 0).map((r) => {
            const on = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.option, on && styles.optionOn]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.optionLabel, on && { color: colors.primary }]}>{r.label}</Text>
                    {r.recommended && (
                      <View style={styles.recommend}>
                        <Text style={styles.recommendText}>추천</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.optionDesc}>{r.desc}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <Check size={13} color="#fff" strokeWidth={3} />}</View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button label={starting ? '준비하고 있어요...' : '첫 10장 나누기'} onPress={start} disabled={total === null || starting} />
    </View>
  );
}

/* ═════════ ③ 첫 결과 ═════════ */

export function OnboardingResultScreen({ navigation, route }: Nav<'OnboardingResult'>) {
  const insets = useSafeAreaInsets();
  const { practice, reference } = route.params;

  const finish = (to: 'Practice' | 'Home') => {
    // PATCH /users/me/onboarding { done: true }
    finishOnboarding();
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: to } }] });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.body, { alignItems: 'center' }]}>
        <View style={styles.icon}>
          <Check size={34} color={colors.primary} strokeWidth={2.4} />
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>
          {practice > 0 ? `첫 할 일 ${practice}개가 생겼어요` : '첫 정리를 마쳤어요'}
        </Text>
        <Text style={[styles.desc, { textAlign: 'center' }]}>
          {practice > 0
            ? 'AI가 실천할 방법을 정리하고 있어요.\n고른 범위의 남은 사진은 홈에서 이어서 나눌 수 있어요.'
            : `참고 ${reference}장을 보관함에 모아뒀어요.\n남은 사진은 홈에서 이어서 나눌 수 있어요.`}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {practice > 0 && <Button label="할 일 보기" onPress={() => finish('Practice')} />}
        <Button label="홈으로" variant={practice > 0 ? 'secondary' : 'primary'} onPress={() => finish('Home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  body: { flex: 1, gap: 12 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, letterSpacing: -0.6, color: colors.text },
  desc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSub },

  points: { gap: 12, marginTop: 20, backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.text },

  options: { gap: 10, marginTop: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionOn: { borderColor: colors.primary, backgroundColor: '#f8fbf6' },
  optionLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  optionDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSub },
  recommend: { backgroundColor: colors.tint, borderRadius: radius.chip, paddingHorizontal: 6, paddingVertical: 2 },
  recommendText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: '#c4c2bb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
