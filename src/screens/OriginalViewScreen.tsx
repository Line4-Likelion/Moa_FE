import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageOff, X } from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/types';
import { parseDay, useCapture, type Box } from '../store/practices';
import { colors, fonts, radius } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OriginalView'>;

/** 스크린샷 비율 (가로:세로) */
const SHOT_RATIO = 9 / 19.5;

type Evidence = { key: string; label: string; value: string; box: Box };

/**
 * 원본 전체 보기
 * AI가 정보를 찾은 위치(box)를 원본 위에 표시해요. 아래 칩을 누르면 그 근거로 이동해요.
 * 원본 사진은 서버에 없어서 기기에서 file_key 로 열어요. 못 찾으면 안내를 보여줘요.
 */
export function OriginalViewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const capture = useCapture(route.params.id);

  const evidence: Evidence[] = [];
  if (capture?.deadline.box) {
    const d = capture.deadline;
    evidence.push({
      key: 'deadline',
      label: d.label ?? '마감',
      value: d.date ? `${parseDay(d.date).getMonth() + 1}월 ${parseDay(d.date).getDate()}일` : '날짜 확인 필요',
      box: d.box!,
    });
  }
  capture?.facts.forEach((f) => {
    if (f.box) evidence.push({ key: f.key, label: f.label, value: f.value ?? '직접 확인 필요', box: f.box });
  });

  const [focus, setFocus] = useState<string | undefined>(route.params.focus ?? evidence[0]?.key);
  const focused = evidence.find((e) => e.key === focus);

  // 화면에 맞는 원본 크기
  const maxH = height - insets.top - insets.bottom - 230;
  const imgW = Math.min(width - 48, maxH * SHOT_RATIO);
  const imgH = imgW / SHOT_RATIO;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>원본 전체 보기</Text>
        <Pressable onPress={navigation.goBack} accessibilityLabel="닫기" hitSlop={10} style={styles.close}>
          <X size={22} color={colors.text} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}>
        <View style={[styles.image, { width: imgW, height: imgH }]}>
          {capture?.uri ? (
            <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.missing}>
              <ImageOff size={26} color={colors.placeholder} strokeWidth={1.5} />
              <Text style={styles.missingText}>{'원본을 찾을 수 없어요\n(기기 사진 연동 전 예시 화면)'}</Text>
            </View>
          )}
          {evidence.map((e) => {
            const on = e.key === focus;
            const [x, y, w, h] = e.box;
            return (
              <Pressable
                key={e.key}
                onPress={() => setFocus(e.key)}
                accessibilityLabel={`${e.label} 근거`}
                style={[
                  styles.box,
                  { left: x * imgW, top: y * imgH, width: w * imgW, height: Math.max(h * imgH, 18) },
                  on ? styles.boxOn : styles.boxOff,
                ]}
              />
            );
          })}
        </View>
      </ScrollView>

      {evidence.length > 0 ? (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {evidence.map((e) => {
              const on = e.key === focus;
              return (
                <Pressable
                  key={e.key}
                  onPress={() => setFocus(e.key)}
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{e.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {focused && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {focused.label} 근거 · {focused.value}
              </Text>
              <Text style={styles.cardDesc}>원본에서 이 부분을 보고 정리했어요. 다르면 상세에서 직접 수정할 수 있어요.</Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.cardDesc, { textAlign: 'center', paddingHorizontal: 20 }]}>
          원본에서 위치를 표시할 수 있는 정보가 없어요
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efede7' },
  header: { height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  close: { position: 'absolute', right: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  image: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#222e28',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  missing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f2ee',
  },
  missingText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub, textAlign: 'center' },
  box: { position: 'absolute', borderRadius: 4, borderWidth: 2 },
  boxOn: { borderColor: '#d98b2b', backgroundColor: 'rgba(217,139,43,0.18)' },
  boxOff: { borderColor: 'rgba(40,90,67,0.35)', backgroundColor: 'rgba(40,90,67,0.06)', borderStyle: 'dashed' },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e1db',
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, color: '#3b443e' },
  chipTextOn: { includeFontPadding: false, fontFamily: fonts.bold, color: '#fff' },
  card: { backgroundColor: colors.tint, borderRadius: radius.card, padding: 14, gap: 4 },
  cardTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  cardDesc: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#4f5a52' },
});
