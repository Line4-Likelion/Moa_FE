import { useEffect, useState } from 'react';
import { Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Archive, CircleCheck } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { EmptyState } from '../components/ui';
import type { TabParamList } from '../navigation/types';
import { errorMessage } from '../services/api';
import { ETC_CATEGORY, deleteReferences, referencesToPractice, useCaptures, useCategories } from '../store/practices';
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
  const [busy, setBusy] = useState<'practice' | 'delete' | null>(null);
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

  // 선택 모드에서는 하단 탭바 대신 선택 버튼을 보여줘요 (실천함과 같은 방식)
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: selectMode ? { display: 'none' } : undefined });
  }, [navigation, selectMode]);
  // 안드로이드 뒤로가기: 선택 모드면 홈으로 가지 말고 선택만 풀어요
  useEffect(() => {
    if (!selectMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectMode(false);
      setSelected([]);
      return true;
    });
    return () => sub.remove();
  }, [selectMode]);
  // 다른 탭으로 나가거나, 항목이 모두 사라지면 선택 모드를 해제해요
  useEffect(
    () =>
      navigation.addListener('blur', () => {
        setSelectMode(false);
        setSelected([]);
      }),
    [navigation],
  );
  useEffect(() => {
    if (items.length === 0) {
      setSelectMode(false);
      setSelected([]);
    }
  }, [items.length]);

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

  // 선택한 사진을 실천으로 바꾸기: 한 장마다 AI 분석이 시작되니 먼저 확인받아요
  const runPractice = () => {
    const ids = selected;
    Alert.alert(`${ids.length}장을 실천으로 바꿀까요?`, 'AI가 사진을 분석하고, 진행 상황은 실천함에서 볼 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '바꾸기',
        onPress: async () => {
          setBusy('practice');
          try {
            const result = await referencesToPractice(ids);
            if (result.failed.length) {
              setSelected(result.failed);
              Alert.alert(
                `${result.ok.length}장을 옮겼어요`,
                `${result.failed.length}장은 옮기지 못했어요. 선택된 채로 두었으니 다시 시도해 주세요.\n${errorMessage(result.error)}`,
              );
            } else cancelSelect();
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  // 선택한 사진을 기기에서 삭제: 시스템 팝업에서 허용하면 서버 기록도 지워요. 거부하면 아무 일도 없어요
  const runDelete = async () => {
    setBusy('delete');
    try {
      const result = await deleteReferences(selected);
      if (result.status === 'cancelled') return;
      if (result.failed.length) {
        setSelected(result.failed);
        Alert.alert(
          `${result.deleted.length}장을 삭제했어요`,
          `${result.failed.length}장은 서버 기록을 지우지 못했어요. 선택된 채로 두었으니 다시 눌러 주세요.\n${errorMessage(result.error)}`,
        );
      } else cancelSelect();
    } catch (error) {
      Alert.alert('사진을 삭제하지 못했어요', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title="참고함"
      hasTabBar={!selectMode}
      footer={
        selectMode ? (
          <View style={{ gap: 8 }}>
            <Button
              label={selected.length ? `카테고리 변경 (${selected.length})` : '바꿀 사진을 선택해 주세요'}
              variant="secondary"
              disabled={selected.length === 0 || !!busy}
              onPress={goChange}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={busy === 'delete' ? '삭제 중...' : selected.length ? `삭제 (${selected.length})` : '삭제'}
                variant="danger"
                disabled={selected.length === 0 || !!busy}
                onPress={runDelete}
                style={{ flex: 1 }}
              />
              <Button
                label={busy === 'practice' ? '옮기는 중...' : '실천으로 바꾸기'}
                disabled={selected.length === 0 || !!busy}
                onPress={runPractice}
                style={{ flex: 1 }}
              />
            </View>
          </View>
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
