import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Archive } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';

/**
 * 제외 확인 (명세서의 '안함', DISMISS)
 * AI 분석 내용이 지워지고 캡처는 참고함으로 옮겨져요. 5초 안에 되돌릴 수 있어요.
 */
export function ExcludeDialog({
  count,
  visible,
  onCancel,
  onConfirm,
}: {
  count: number;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.title}>{count > 1 ? `실천 ${count}개를 제외할까요?` : '이 실천을 제외할까요?'}</Text>
          <Text style={styles.body}>{'AI가 정리한 실천 방법이 사라지고\n실천함에서 빠져요.'}</Text>
          <View style={styles.info}>
            <Archive size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.infoText}>캡처는 참고함으로 옮겨져요</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.btn, { backgroundColor: '#f1f0ec' }]}>
              <Text style={[styles.btnText, { color: colors.text }]}>취소</Text>
            </Pressable>
            <Pressable onPress={onConfirm} accessibilityRole="button" style={[styles.btn, { backgroundColor: colors.error }]}>
              <Text style={[styles.btnText, { color: '#fff' }]}>제외</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  dialog: { width: '100%', backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#3b443e', textAlign: 'center', marginTop: 10 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#f3f6f1',
  },
  infoText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  btn: { flex: 1, height: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.bold, fontSize: 15 },
});
