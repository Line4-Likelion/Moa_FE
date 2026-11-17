import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Archive, CircleCheck } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { EmptyState } from '../components/ui';
import type { TabParamList } from '../navigation/types';
import { ETC_CATEGORY, useCaptures, useCategories } from '../store/practices';
import { referenceLabel } from './ReferenceDetailScreen';
import { colors, fonts } from '../theme';

const GAP = 12;

export function ArchiveScreen({ route }: BottomTabScreenProps<TabParamList, 'Archive'>) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const captures = useCaptures();
  const categoryNames = useCategories();
  const [filter, setFilter] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  // 참고함 = 서버의 REFERENCE 항목 (사진 주소는 기기에서 file_key 로 찾아와요)
  const items = captures.filter((c) => c.status === 'REFERENCE');
  const isEmpty = route.params?.empty || items.length === 0;
  const nameOf = (c: (typeof items)[number]) => c.category?.name ?? ETC_CATEGORY;
  // 칩 순서: 전체 → 미분류(서버의 '기타') → 나머지 카테고리
  const orderedNames = [ETC_CATEGORY, ...categoryNames.filter((name) => name !== ETC_CATEGORY)];
  const filters = [
    { id: 'all', label: '전체', count: items.length },
    ...orderedNames.map((name) => ({
      id: name,
      label: referenceLabel(name),
      count: items.filter((c) => nameOf(c) === name).length,
    })),
  ];
  const visible = filter === 'all' ? items : items.filter((c) => nameOf(c) === filter);
  const cardWidth = (width - 40 - GAP * 2) / 3;

  if (isEmpty) {
    return (
      <Screen title="참고함" hasTabBar>
        <EmptyState icon={Archive} title="참고할 사진이 없어요" lines={['당신의 상상력을 뽐내보아요~!']} />
      </Screen>
    );
  }

  const startSelect = (id?: string) => {
    setSelectMode(true);
    if (id) setSelected([id]);
  };
  const cancelSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const goChange = () => {
    const picked = items.filter((i) => selected.includes(i.id));
    const label = picked.length === 1 ? (picked[0].title ?? '이 항목') : `${picked.length}개 항목`;
    cancelSelect();
    navigation.navigate('CategoryChange', { label, ids: picked.map((i) => i.id) });
  };

  return (
    <Screen
      title="참고함"
      hasTabBar
      footer={
        selectMode ? (
          <Button
            label={selected.length ? `카테고리 변경 (${selected.length})` : '카테고리를 바꿀 사진을 선택해 주세요'}
            disabled={selected.length === 0}
            onPress={goChange}
          />
        ) : undefined
      }
      header={
        <View style={{ gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {filters.map((f) => {
              const active = f.id === filter;
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(f.id)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : colors.textSub }]}>
                    {f.label} {f.count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.controls}>
            {selectMode ? (
              <>
                <Text style={[styles.controlText, { fontFamily: fonts.bold, color: colors.primary }]}>
                  {selected.length}개 선택
                </Text>
                <Pressable onPress={cancelSelect} hitSlop={8}>
                  <Text style={styles.controlText}>취소</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => navigation.navigate('CategoryAdd')} hitSlop={8}>
                  <Text style={[styles.controlText, { fontFamily: fonts.bold, color: colors.primary }]}>
                    ＋ 카테고리 추가
                  </Text>
                </Pressable>
                <Pressable onPress={() => startSelect()} hitSlop={8}>
                  <Text style={styles.controlText}>카테고리 변경</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      }
      contentStyle={styles.grid}
    >
      {visible.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <Pressable
            key={item.id}
            accessibilityLabel={item.title ?? '참고 사진'}
            accessibilityState={{ selected: isSelected }}
            onPress={selectMode ? () => toggle(item.id) : () => navigation.navigate('ReferenceDetail', { id: item.id })}
            onLongPress={selectMode ? undefined : () => startSelect(item.id)}
            style={[styles.thumb, { width: cardWidth }, isSelected && styles.thumbSelected]}
          >
            {item.uri && <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            {selectMode && (
              <View style={styles.badge}>
                <CircleCheck
                  size={22}
                  color={isSelected ? '#fff' : colors.border}
                  fill={isSelected ? colors.primary : 'rgba(255,255,255,0.6)'}
                  strokeWidth={1.5}
                />
              </View>
            )}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 20, gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipText: { fontFamily: fonts.regular, fontSize: 11 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  controlText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 16 },
  thumb: {
    height: 142,
    borderRadius: 4,
    backgroundColor: colors.skeleton,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbSelected: { borderColor: colors.primary },
  badge: { position: 'absolute', top: 6, right: 6 },
});
