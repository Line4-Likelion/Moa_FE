import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { undoLast } from '../store/practices';
import { colors, fonts } from '../theme';

export type ToastState = { text: string; undo?: boolean; key: number } | null;

/** 화면 아래에 잠깐 뜨는 안내. undo 가 true 면 5초 동안 [되돌리기] 버튼을 보여줘요 */
export function UndoToast({
  toast,
  onHide,
  onUndone,
  bottom,
}: {
  toast: ToastState;
  onHide: () => void;
  /** 되돌리기에 성공했을 때 */
  onUndone?: () => void;
  bottom: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onHide, toast.undo ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toast, onHide]);

  if (!toast) return null;
  return (
    <View style={[styles.toast, { bottom }]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{toast.text}</Text>
      {toast.undo && (
        <Pressable
          onPress={() => {
            if (undoLast()) onUndone?.();
            onHide();
          }}
          accessibilityRole="button"
          hitSlop={10}
        >
          <Text style={styles.undo}>되돌리기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: '#fff' },
  undo: { fontFamily: fonts.bold, fontSize: 13, color: '#b9ddb0' },
});
