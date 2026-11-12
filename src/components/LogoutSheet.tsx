import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Lines } from './ui';

type Props = { visible: boolean; onCancel: () => void; onConfirm: () => void };

export function LogoutSheet({ visible, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>로그아웃할까요?</Text>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <X size={22} color={colors.text} strokeWidth={1.5} />
            </Pressable>
          </View>
          <Lines
            size={14}
            lines={['저장한 항목은 계정에 남아 있어요.', '로그아웃하면 기존 서비스 로그인 화면으로 이동해요.']}
          />
          <View style={styles.actions}>
            <Button label="취소" variant="secondary" onPress={onCancel} style={styles.flex} />
            <Button label="로그아웃" onPress={onConfirm} style={styles.flex} />
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
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 22, lineHeight: 33, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
