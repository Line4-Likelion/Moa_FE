import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Lines } from './ui';

type Props = { visible: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void };

/** 회원 탈퇴 확인 (로그아웃 시트와 같은 모양, 되돌릴 수 없다는 안내 포함) */
export function DeleteAccountSheet({ visible, busy, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>탈퇴할까요?</Text>
            <Pressable onPress={onCancel} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <X size={22} color={colors.text} strokeWidth={1.5} />
            </Pressable>
          </View>
          <Lines
            size={14}
            lines={[
              '실천 기록, 분석 결과, 카테고리, 알림 설정이 모두 지워지고 되돌릴 수 없어요.',
              '휴대폰의 사진은 지우지 않아요.',
            ]}
          />
          <View style={styles.actions}>
            <Button label="취소" variant="secondary" onPress={onCancel} disabled={busy} style={styles.flex} />
            <Button label={busy ? '탈퇴하는 중...' : '탈퇴'} variant="danger" onPress={onConfirm} disabled={busy} style={styles.flex} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    gap: 16,
  },
  handleWrap: { alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 4, backgroundColor: colors.disabled },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, includeFontPadding: false, fontFamily: fonts.bold, fontSize: 22, lineHeight: 33, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
