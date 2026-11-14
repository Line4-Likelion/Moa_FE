import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Archive, House, LayoutGrid, UserRound, type LucideIcon } from 'lucide-react-native';
import { colors, fonts } from '../theme';

const TABS: Record<string, { label: string; Icon: LucideIcon }> = {
  Home: { label: '홈', Icon: House },
  Practice: { label: '실천함', Icon: LayoutGrid },
  Archive: { label: '보관함', Icon: Archive },
  My: { label: '마이', Icon: UserRound },
};

export function TabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // 화면이 tabBarStyle: { display: 'none' } 을 주면 탭바를 숨겨요 (예: 실천함 선택 모드)
  const focusedStyle = descriptors[state.routes[state.index].key]?.options.tabBarStyle;
  if (StyleSheet.flatten(focusedStyle)?.display === 'none') return null;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? colors.primary : colors.textSub;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.item}
            >
              <tab.Icon size={21} color={color} strokeWidth={1.5} />
              <Text style={[styles.label, { color, fontFamily: focused ? fonts.bold : fonts.regular }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  row: { height: 62, flexDirection: 'row', paddingHorizontal: 12 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10 },
});
