import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors, fonts } from '../theme';

type Props = {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  /** 하단 고정 버튼 영역 (Fixed actions) */
  footer?: ReactNode;
  /** 하단 탭바가 있는 화면은 true → 하단 safe area를 직접 처리하지 않음 */
  hasTabBar?: boolean;
  /** 헤더 바로 아래에 붙는 고정 영역 (필터 칩 등) */
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
};

export function Screen({
  title,
  onBack,
  children,
  footer,
  hasTabBar,
  header,
  contentStyle,
  scrollable = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const Body = scrollable ? ScrollView : View;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack && (
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} hitSlop={10}>
            <ChevronLeft size={20} color={colors.text} strokeWidth={1.5} />
          </Pressable>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {header}
      <Body
        style={styles.flex}
        {...(scrollable
          ? { contentContainerStyle: [styles.content, contentStyle], keyboardShouldPersistTaps: 'handled' as const }
          : {})}
      >
        {scrollable ? children : <View style={[styles.content, contentStyle]}>{children}</View>}
      </Body>
      {footer && (
        <View style={[styles.footer, { paddingBottom: 8 + (hasTabBar ? 0 : insets.bottom) }]}>{footer}</View>
      )}
      {!footer && !hasTabBar && <View style={{ height: insets.bottom }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.7,
    color: colors.text,
  },
  content: { padding: 20, gap: 12 },
  footer: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
});
