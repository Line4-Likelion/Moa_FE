import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImageOff } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { StatusChip } from '../components/ui';
import { errorMessage } from '../services/api';
import type { RootStackParamList } from '../navigation/types';
import { ETC_CATEGORY, deleteReference, referenceToPractice, useCapture } from '../store/practices';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ReferenceDetail'>;

/** 참고함에서는 '기타' 대신 '미분류'로 보여줘요 */
export const referenceLabel = (name: string) => (name === ETC_CATEGORY ? '미분류' : name);

/**
 * 참고함 상세 (사진 확대)
 * - 실천으로 바꾸기: 서버 분류를 PRACTICE 로 바꾸고 AI 분석을 시작해요
 * - 삭제: 기기에서 사진을 지우고(시스템 팝업), 허용하면 서버 기록도 지워요. 거부하면 아무 일도 없어요
 */
export function ReferenceDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const capture = useCapture(id);
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState<'practice' | 'delete' | null>(null);

  const categoryName = referenceLabel(capture?.category?.name ?? ETC_CATEGORY);
  // 스크린샷 비율(9:19.5)을 유지하면서 화면 높이를 넘지 않게
  const maxH = height * 0.58;
  const imgW = Math.min(width - 40, maxH * (9 / 19.5));
  const imgH = imgW / (9 / 19.5);

  const toPractice = async () => {
    if (busy) return;
    setBusy('practice');
    try {
      await referenceToPractice(id);
      Alert.alert('실천으로 옮겼어요', '실천함에서 AI 분석 진행 상황을 볼 수 있어요.', [
        { text: '확인', onPress: navigation.goBack },
      ]);
    } catch (error) {
      Alert.alert('실천으로 바꾸지 못했어요', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('delete');
    try {
      // 기기 삭제 팝업에서 거부하면 'cancelled' → 아무것도 하지 않아요
      if ((await deleteReference(id)) === 'deleted') navigation.goBack();
    } catch (error) {
      Alert.alert('사진을 삭제하지 못했어요', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title="참고함"
      onBack={navigation.goBack}
      contentStyle={{ gap: 16, alignItems: 'center' }}
      footer={
        <View style={styles.actions}>
          <Button
            label={busy === 'delete' ? '삭제 중...' : '삭제'}
            variant="danger"
            onPress={remove}
            disabled={!!busy || !capture}
            style={styles.flex}
          />
          <Button
            label={busy === 'practice' ? '옮기는 중...' : '실천으로 바꾸기'}
            onPress={toPractice}
            disabled={!!busy || !capture}
            style={styles.flex}
          />
        </View>
      }
    >
      <View style={[styles.image, { width: imgW, height: imgH }]}>
        {capture?.uri ? (
          <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <View style={styles.missing}>
            <ImageOff size={26} color={colors.placeholder} strokeWidth={1.5} />
            <Text style={styles.missingText}>사진을 찾을 수 없어요</Text>
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Pressable
          onPress={() =>
            navigation.navigate('CategoryChange', { label: capture?.title ?? '이 사진', ids: [id] })
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="카테고리 변경"
        >
          <StatusChip label={`${categoryName} · 변경`} />
        </Pressable>
        {capture?.title ? <Text style={styles.title}>{capture.title}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  image: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: { alignItems: 'center', gap: 8 },
  missingText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  meta: { alignSelf: 'stretch', gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.text },
});
