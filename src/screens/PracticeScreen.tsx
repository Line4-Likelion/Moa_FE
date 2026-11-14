import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, Check, ChevronDown, Image as ImageIcon, Plus, Search, Sparkles } from 'lucide-react-native';
import { Button } from '../components/Button';
import type { TabParamList } from '../navigation/types';
import {
  BASE_CATEGORIES,
  ETC_CATEGORY,
  changeCategory,
  completePractices,
  daysLeft,
  excludePractices,
  isOverdue,
  redoPractices,
  useCategories,
  usePractices,
  type Practice,
} from '../store/practices';
import { colors, fonts, radius } from '../theme';

type Tab = 'active' | 'done';
type ActiveSort = 'due' | 'recent' | 'old';
type DoneSort = 'recentDone' | 'oldDone';

const ACTIVE_SORTS: { key: ActiveSort; label: string }[] = [
  { key: 'due', label: '마감 가까운 순' },
  { key: 'recent', label: '최근 담은 순' },
  { key: 'old', label: '오래 담아둔 순' },
];
const DONE_SORTS: { key: DoneSort; label: string }[] = [
  { key: 'recentDone', label: '최근 완료 순' },
  { key: 'oldDone', label: '오래된 완료 순' },
];

const ALL = '전체';

/* ───────── 정렬 · 표시 유틸 ───────── */

function sortActive(list: Practice[], key: ActiveSort) {
  const time = (p: Practice) => new Date(p.addedAt).getTime();
  return [...list].sort((a, b) => {
    if (key === 'due') {
      // 마감 없는 실천은 맨 아래
      const x = daysLeft(a) ?? Number.POSITIVE_INFINITY;
      const y = daysLeft(b) ?? Number.POSITIVE_INFINITY;
      if (x !== y) return x - y;
      return time(b) - time(a);
    }
    return key === 'recent' ? time(b) - time(a) : time(a) - time(b);
  });
}

function sortDone(list: Practice[], key: DoneSort) {
  const time = (p: Practice) => new Date(p.completedAt ?? p.addedAt).getTime();
  return [...list].sort((a, b) => (key === 'recentDone' ? time(b) - time(a) : time(a) - time(b)));
}

function dueLabel(p: Practice): { text: string; color: string; bold: boolean } {
  if (p.status === 'done' && p.completedAt) {
    const d = new Date(p.completedAt);
    return { text: `${d.getMonth() + 1}.${d.getDate()} 완료`, color: colors.textSub, bold: false };
  }
  if (p.status === 'hold') return { text: '보류', color: colors.textSub, bold: false };
  const left = daysLeft(p);
  if (left === null) return { text: '마감 없음', color: colors.textSub, bold: false };
  if (left === 0) return { text: 'D-Day', color: colors.error, bold: true };
  if (left < 0) return { text: `D+${-left}`, color: colors.error, bold: true };
  return { text: `D-${left}`, color: colors.primary, bold: true };
}

function matchesQuery(p: Practice, q: string) {
  if (!q) return true;
  const text = [p.title, p.category, ...(p.steps ?? []).map((s) => s.title)].join(' ').toLowerCase();
  return text.includes(q.toLowerCase());
}

/* ───────── 화면 ───────── */

export function PracticeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<TabParamList, 'Practice'>>();
  const rootNav = useNavigation();
  const insets = useSafeAreaInsets();
  const practices = usePractices();
  const categories = useCategories();

  const [tab, setTab] = useState<Tab>('active');
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [activeSort, setActiveSort] = useState<ActiveSort>('due');
  const [doneSort, setDoneSort] = useState<DoneSort>('recentDone');
  const [sortOpen, setSortOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [categorySheet, setCategorySheet] = useState(false);
  const [excludeIds, setExcludeIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 선택 모드에서는 하단 탭바 대신 선택 버튼을 보여줘요
  useEffect(() => {
    nav.setOptions({ tabBarStyle: selecting ? { display: 'none' } : undefined });
  }, [nav, selecting]);

  // 다른 탭으로 나가면 선택 모드 해제
  useEffect(() => nav.addListener('blur', () => exitSelect()), [nav]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const exitSelect = () => {
    setSelecting(false);
    setPicked([]);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setCategory(ALL);
    exitSelect();
  };

  const togglePick = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /* 목록 계산 */
  const activeAll = practices.filter((p) => p.status === 'active');
  const holdAll = practices.filter((p) => p.status === 'hold');
  const doneAll = practices.filter((p) => p.status === 'done');
  // 칩 숫자: 진행 탭은 보류를 빼고 셈
  const chipBase = tab === 'active' ? activeAll : doneAll;

  const customCategories = categories.filter((c) => !BASE_CATEGORIES.includes(c) && c !== ETC_CATEGORY);
  const chips = useMemo(() => {
    const list = categories
      .map((c) => ({ label: c, count: chipBase.filter((p) => p.category === c).length }))
      .filter((c) => c.count > 0 || customCategories.includes(c.label));
    return [{ label: ALL, count: chipBase.length }, ...list];
  }, [categories, chipBase, customCategories]);

  const inView = (p: Practice) => (category === ALL || p.category === category) && matchesQuery(p, query.trim());

  const activeVisible = activeAll.filter(inView);
  const overdue = activeVisible.filter(isOverdue).sort((a, b) => (daysLeft(a) ?? 0) - (daysLeft(b) ?? 0));
  const ongoing = sortActive(activeVisible.filter((p) => !isOverdue(p)), activeSort);
  const hold = sortActive(holdAll.filter(inView), activeSort);
  const done = sortDone(doneAll.filter(inView), doneSort);

  const sortLabel =
    tab === 'active'
      ? ACTIVE_SORTS.find((s) => s.key === activeSort)!.label
      : DONE_SORTS.find((s) => s.key === doneSort)!.label;

  const isEmptyTab = tab === 'active' ? activeAll.length + holdAll.length === 0 : doneAll.length === 0;
  const noResults =
    !isEmptyTab && (tab === 'active' ? activeVisible.length + hold.length === 0 : done.length === 0);

  /* 카드 공통 props */
  const cardProps = (p: Practice) => ({
    practice: p,
    selecting,
    picked: picked.includes(p.id),
    onPress: () => {
      if (selecting) togglePick(p.id);
      // TODO: 실천 상세 화면으로 이동 (팀원 C) — 단계 체크, 보류, 마감 변경은 상세에서
    },
    onLongPress: () => {
      if (!selecting) {
        setSelecting(true);
        setPicked([p.id]);
      }
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {selecting ? (picked.length ? `${picked.length}개 선택` : '실천 선택') : '실천함'}
        </Text>
        {!isEmptyTab && (
          <Pressable
            onPress={() => (selecting ? exitSelect() : setSelecting(true))}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={styles.headerAction}>{selecting ? '취소' : '선택'}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          <View style={styles.search}>
            <Search size={17} color={colors.textSub} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="찾고 싶은 실천을 검색해보세요"
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="실천 검색"
            />
          </View>

          <View style={styles.segment} accessibilityRole="tablist">
            {(['active', 'done'] as Tab[]).map((t) => {
              const on = tab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => switchTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.segmentItem, on && styles.segmentItemOn]}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t === 'active' ? '진행' : '완료'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isEmptyTab ? (
          <EmptyState tab={tab} onSort={() => rootNav.navigate('Sort')} />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chips.map((c) => {
                const on = category === c.label;
                return (
                  <Pressable
                    key={c.label}
                    onPress={() => setCategory(c.label)}
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {c.label} {c.count}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => rootNav.navigate('CategoryAdd')}
                accessibilityLabel="카테고리 추가"
                style={[styles.chip, styles.chipAdd]}
              >
                <Plus size={13} color={colors.textSub} strokeWidth={2.2} />
                <Text style={[styles.chipText, { color: colors.textSub }]}>추가</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {tab === 'active' ? `진행 ${activeVisible.length}` : `완료 ${done.length}`}
              </Text>
              <Pressable onPress={() => setSortOpen(true)} style={styles.sortButton} hitSlop={8}>
                <Text style={styles.sortText}>{sortLabel}</Text>
                <ChevronDown size={14} color={colors.textSub} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.list}>
              {noResults && (
                <Text style={styles.noResults}>
                  {query.trim() ? `'${query.trim()}'에 맞는 실천이 없어요` : '이 카테고리에는 실천이 없어요'}
                </Text>
              )}

              {tab === 'active' && (
                <>
                  {overdue.length > 0 && (
                    <>
                      <View style={styles.overdueHead}>
                        <AlertCircle size={15} color={colors.error} strokeWidth={2.2} />
                        <Text style={styles.overdueHeadText}>마감이 지난 실천 {overdue.length}</Text>
                      </View>
                      {overdue.map((p) => (
                        <PracticeCard
                          key={p.id}
                          {...cardProps(p)}
                          variant="overdue"
                          onExclude={() => setExcludeIds([p.id])}
                          onComplete={() => {
                            completePractices([p.id]);
                            setToast('완료로 옮겼어요');
                          }}
                        />
                      ))}
                      <View style={{ height: 8 }} />
                    </>
                  )}

                  {ongoing.map((p) => (
                    <PracticeCard key={p.id} {...cardProps(p)} variant="normal" />
                  ))}

                  {/* 진행은 비었고 보류만 남은 경우 */}
                  {activeVisible.length === 0 && hold.length > 0 && (
                    <View style={styles.inlineEmpty}>
                      <Text style={styles.inlineEmptyTitle}>진행 중인 실천이 없어요</Text>
                      <Text style={styles.inlineEmptyDesc}>보류한 실천을 다시 꺼내거나, 새 캡처를 분류해보세요</Text>
                    </View>
                  )}

                  {hold.length > 0 && (
                    <>
                      <Text style={styles.holdHead}>보류 {hold.length}</Text>
                      {hold.map((p) => (
                        <PracticeCard key={p.id} {...cardProps(p)} variant="hold" />
                      ))}
                    </>
                  )}
                </>
              )}

              {tab === 'done' && done.map((p) => <PracticeCard key={p.id} {...cardProps(p)} variant="done" />)}

              {!noResults && <Text style={styles.footNote}>AI가 캡처를 보고 카테고리를 정해줬어요.</Text>}
            </View>
          </>
        )}
      </ScrollView>

      {/* 선택 모드 하단 버튼 */}
      {selecting && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 10 }]}>
          {tab === 'active' ? (
            <>
              <ActionButton
                label="카테고리 변경"
                tone="tint"
                disabled={!picked.length}
                onPress={() => setCategorySheet(true)}
              />
              <ActionButton label="제외" tone="danger" disabled={!picked.length} onPress={() => setExcludeIds(picked)} />
            </>
          ) : (
            <ActionButton
              label="다시 하기"
              tone="primary"
              disabled={!picked.length}
              onPress={() => {
                redoPractices(picked);
                exitSelect();
                setToast('진행에 다시 담았어요');
              }}
            />
          )}
        </View>
      )}

      {toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { bottom: (selecting ? insets.bottom + 80 : 16) }]}
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <SortSheet
        visible={sortOpen}
        options={tab === 'active' ? ACTIVE_SORTS : DONE_SORTS}
        current={tab === 'active' ? activeSort : doneSort}
        onSelect={(key) => {
          if (tab === 'active') setActiveSort(key as ActiveSort);
          else setDoneSort(key as DoneSort);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />

      <CategorySheet
        visible={categorySheet}
        count={picked.length}
        categories={categories}
        onClose={() => setCategorySheet(false)}
        onAddNew={() => {
          setCategorySheet(false);
          rootNav.navigate('CategoryAdd');
        }}
        onApply={(c) => {
          changeCategory(picked, c);
          setCategorySheet(false);
          exitSelect();
          setToast(`'${c}'(으)로 옮겼어요`);
        }}
      />

      <ExcludeDialog
        ids={excludeIds}
        onCancel={() => setExcludeIds(null)}
        onConfirm={() => {
          if (!excludeIds) return;
          excludePractices(excludeIds);
          setExcludeIds(null);
          exitSelect();
          setToast('실천에서 제외했어요');
        }}
      />
    </View>
  );
}

/* ───────── 카드 ───────── */

function PracticeCard({
  practice: p,
  variant,
  selecting,
  picked,
  onPress,
  onLongPress,
  onExclude,
  onComplete,
}: {
  practice: Practice;
  variant: 'normal' | 'overdue' | 'hold' | 'done';
  selecting: boolean;
  picked: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onExclude?: () => void;
  onComplete?: () => void;
}) {
  const due = dueLabel(p);
  const stepsDone = p.steps?.filter((s) => s.done).length ?? 0;
  const total = p.steps?.length ?? 0;
  const next = p.steps?.find((s) => !s.done);
  const faded = variant === 'hold';

  // 카드 부제목: 다음 단계
  let subtitle: string | null = null;
  if (variant !== 'done') {
    if (p.steps === null) subtitle = null;
    else if (total === 1) subtitle = p.steps[0].title;
    else if (next) subtitle = `다음 단계 · ${next.title}`;
  }

  const showProgress = p.steps !== null && total > 1 && !(variant === 'overdue' && !selecting);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: picked } : undefined}
      style={[
        styles.card,
        variant === 'overdue' && styles.cardOverdue,
        faded && styles.cardHold,
        picked && styles.cardPicked,
      ]}
    >
      {selecting && (
        <View style={[styles.pickCircle, picked && styles.pickCircleOn]}>
          {picked && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>
      )}

      <View style={[styles.thumb, faded && { opacity: 0.6 }]}>
        <ImageIcon size={20} color={colors.placeholder} strokeWidth={1.5} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.catTag, faded && styles.catTagFaded]}>
            <Text style={[styles.catTagText, faded && { color: colors.textSub }]}>{p.category}</Text>
          </View>
          <Text style={[styles.due, { color: due.color, fontFamily: due.bold ? fonts.bold : fonts.medium }]}>
            {due.text}
          </Text>
        </View>

        <Text style={[styles.cardTitle, faded && { color: colors.textSub }]} numberOfLines={1}>
          {p.title}
        </Text>

        {p.steps === null ? (
          <View style={styles.analyzing}>
            <Sparkles size={13} color={colors.primary} strokeWidth={2} />
            <Text style={styles.analyzingText}>실천 방법을 정리하고 있어요</Text>
          </View>
        ) : (
          subtitle && (
            <Text style={[styles.subtitle, faded && { color: colors.placeholder }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )
        )}

        {variant === 'overdue' && !selecting && (
          <View style={styles.overdueActions}>
            <Pressable onPress={onExclude} accessibilityRole="button" style={[styles.smallBtn, styles.smallBtnLine]}>
              <Text style={[styles.smallBtnText, { color: colors.text }]}>제외</Text>
            </Pressable>
            <Pressable onPress={onComplete} accessibilityRole="button" style={[styles.smallBtn, styles.smallBtnPrimary]}>
              <Text style={[styles.smallBtnText, { color: '#fff', fontFamily: fonts.bold }]}>완료</Text>
            </Pressable>
          </View>
        )}

        {showProgress && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((stepsDone / total) * 100)}%` },
                  faded && { backgroundColor: colors.placeholder },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {stepsDone} / {total} 단계
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ───────── 빈 화면 ───────── */

function EmptyState({ tab, onSort }: { tab: Tab; onSort: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Sparkles size={30} color={colors.primary} strokeWidth={1.7} />
      </View>
      <Text style={styles.emptyTitle}>{tab === 'active' ? '아직 모아둔 실천이 없어요' : '아직 완료한 실천이 없어요'}</Text>
      <Text style={styles.emptyDesc}>
        {tab === 'active'
          ? '캡처를 왼쪽으로 밀어 분류하면\n여기에 실천할 방법과 함께 모여요'
          : '진행 중인 실천을 끝내면\n여기에 차곡차곡 쌓여요'}
      </Text>
      {tab === 'active' && <Button label="캡처 분류하러 가기" onPress={onSort} style={{ marginTop: 14, paddingHorizontal: 22 }} />}
    </View>
  );
}

/* ───────── 하단 버튼 ───────── */

function ActionButton({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'tint' | 'danger' | 'primary';
  disabled: boolean;
  onPress: () => void;
}) {
  const bg = tone === 'primary' ? colors.primary : tone === 'tint' ? colors.tint : colors.surface;
  const fg = tone === 'primary' ? '#fff' : tone === 'tint' ? colors.primary : colors.error;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.actionBtn,
        { backgroundColor: bg },
        tone === 'danger' && { borderWidth: 1, borderColor: '#e8d3cc' },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[styles.actionBtnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ───────── 정렬 시트 ───────── */

function SortSheet({
  visible,
  options,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: { key: string; label: string }[];
  current: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>정렬</Text>
        {options.map((o) => {
          const on = o.key === current;
          return (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={styles.sheetRow}
            >
              <Text style={[styles.sheetRowText, on && { fontFamily: fonts.bold, color: colors.primary }]}>{o.label}</Text>
              {on && <Check size={18} color={colors.primary} strokeWidth={2.4} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

/* ───────── 카테고리 변경 시트 ───────── */

function CategorySheet({
  visible,
  count,
  categories,
  onClose,
  onAddNew,
  onApply,
}: {
  visible: boolean;
  count: number;
  categories: string[];
  onClose: () => void;
  onAddNew: () => void;
  onApply: (category: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setSelected(null);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: '80%' }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>카테고리 변경</Text>
        <Text style={styles.sheetDesc}>선택한 실천 {count}개를 옮길 카테고리를 골라주세요</Text>
        <ScrollView style={{ flexGrow: 0 }}>
          {categories.map((c) => {
            const on = selected === c;
            return (
              <Pressable
                key={c}
                onPress={() => setSelected(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={styles.sheetRow}
              >
                <Text style={[styles.sheetRowText, on && { fontFamily: fonts.bold, color: colors.primary }]}>{c}</Text>
                <View style={[styles.radio, on && styles.radioOn]} />
              </Pressable>
            );
          })}
          <Pressable onPress={onAddNew} accessibilityRole="button" style={[styles.sheetRow, { justifyContent: 'flex-start', gap: 6 }]}>
            <Plus size={16} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.sheetRowText, { color: colors.primary, fontFamily: fonts.medium }]}>새 카테고리</Text>
          </Pressable>
        </ScrollView>
        <Button label="변경하기" disabled={!selected} onPress={() => selected && onApply(selected)} style={{ marginTop: 14 }} />
      </View>
    </Modal>
  );
}

/* ───────── 제외 확인 ───────── */

function ExcludeDialog({ ids, onCancel, onConfirm }: { ids: string[] | null; onCancel: () => void; onConfirm: () => void }) {
  const count = ids?.length ?? 0;
  return (
    <Modal visible={!!ids} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogWrap}>
        <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.dialogTitle}>{count > 1 ? `실천 ${count}개를 제외할까요?` : '이 실천을 제외할까요?'}</Text>
          <Text style={styles.dialogBody}>{'AI가 정리한 실천 방법이 함께 사라지고\n실천함에서 빠져요.'}</Text>
          <View style={styles.dialogInfo}>
            <ImageIcon size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.dialogInfoText}>캡처 사진은 갤러리에 그대로 남아요</Text>
          </View>
          <View style={styles.dialogActions}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.dialogBtn, { backgroundColor: '#f1f0ec' }]}>
              <Text style={[styles.dialogBtnText, { color: colors.text }]}>취소</Text>
            </Pressable>
            <Pressable onPress={onConfirm} accessibilityRole="button" style={[styles.dialogBtn, { backgroundColor: colors.error }]}>
              <Text style={[styles.dialogBtnText, { color: '#fff' }]}>제외</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ───────── 스타일 ───────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  headerAction: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },

  top: { paddingHorizontal: 20, gap: 12 },
  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingVertical: 0 },

  segment: { flexDirection: 'row', padding: 4, gap: 4, backgroundColor: '#eceae4', borderRadius: radius.button },
  segmentItem: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: {
    backgroundColor: colors.surface,
    shadowColor: '#222e28',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSub },
  segmentTextOn: { fontFamily: fonts.bold, color: colors.text },

  chips: { gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e1db',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipAdd: { borderStyle: 'dashed', borderColor: '#c9cbc4', backgroundColor: 'transparent' },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: '#3b443e' },
  chipTextOn: { fontFamily: fonts.bold, color: '#fff' },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  listTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sortText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },

  list: { paddingHorizontal: 20, gap: 10 },
  inlineEmpty: { alignItems: 'center', gap: 4, paddingVertical: 28, borderRadius: radius.card, backgroundColor: colors.surface },
  inlineEmptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  inlineEmptyDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSub },
  noResults: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSub, textAlign: 'center', paddingVertical: 40 },
  overdueHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overdueHeadText: { fontFamily: fonts.bold, fontSize: 13, color: colors.error },
  holdHead: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSub, marginTop: 10 },
  footNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub, marginTop: 6 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardOverdue: { backgroundColor: '#fdf7f5', borderColor: '#ebcbc4' },
  cardHold: { backgroundColor: '#fbfaf7', borderColor: '#eceae4' },
  cardPicked: { borderColor: colors.primary },
  pickCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: '#c4c2bb',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCircleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  thumb: {
    width: 62,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#e4e2dc',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cardBody: { flex: 1, gap: 4, alignSelf: 'stretch' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  catTag: { backgroundColor: '#eef3ec', borderRadius: radius.chip, paddingHorizontal: 7, paddingVertical: 2 },
  catTagFaded: { backgroundColor: '#f1f0ec' },
  catTagText: { fontFamily: fonts.medium, fontSize: 11, color: '#4e6b57' },
  due: { fontSize: 12 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3, color: colors.text, marginTop: 2 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: '#5f665e' },
  analyzing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  analyzingText: { fontFamily: fonts.regular, fontSize: 13, color: colors.primary },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#eceae4', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  progressText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSub },

  overdueActions: { flexDirection: 'row', gap: 6, marginTop: 'auto', paddingTop: 6 },
  smallBtn: { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  smallBtnLine: { borderWidth: 1, borderColor: '#e2e1db', backgroundColor: colors.surface },
  smallBtnPrimary: { backgroundColor: colors.primary },
  smallBtnText: { fontFamily: fonts.medium, fontSize: 13 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  emptyDesc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#5f665e', textAlign: 'center' },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flex: 1, height: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontFamily: fonts.bold, fontSize: 15 },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: { fontFamily: fonts.medium, fontSize: 13, color: '#fff' },

  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#dad9d3', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: 4 },
  sheetDesc: { fontFamily: fonts.regular, fontSize: 13, color: '#5f665e', marginBottom: 8 },
  sheetRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
  },
  sheetRowText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8, borderColor: '#c4c2bb' },
  radioOn: { borderWidth: 6, borderColor: colors.primary },

  dialogWrap: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  dialog: { width: '100%', backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  dialogTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  dialogBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#3b443e', textAlign: 'center', marginTop: 10 },
  dialogInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#f3f6f1',
  },
  dialogInfoText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  dialogActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  dialogBtn: { flex: 1, height: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  dialogBtnText: { fontFamily: fonts.bold, fontSize: 15 },
});
