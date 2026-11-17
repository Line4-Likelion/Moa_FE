import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, Check, ChevronDown, Image as ImageIcon, Plus, Search, Sparkles } from 'lucide-react-native';
import { Button } from '../components/Button';
import { MOCK_FAIL } from '../mock/failures';
import { ExcludeDialog } from '../components/ExcludeDialog';
import { UndoToast, type ToastState } from '../components/UndoToast';
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
  useCompletionStats,
  usePractices,
  fillMissingUris,
  type Practice,
} from '../store/practices';
import { colors, fonts, radius } from '../theme';

type Tab = 'active' | 'done';
/** 명세서 GET /captures 의 sort: deadline / recent. 완료함은 recent 고정 */
type ActiveSort = 'due' | 'recent';
type DoneSort = 'recentDone';

const ACTIVE_SORTS: { key: ActiveSort; label: string }[] = [
  { key: 'due', label: '마감 가까운 순' },
  { key: 'recent', label: '최근 담은 순' },
];
const DONE_SORTS: { key: DoneSort; label: string }[] = [{ key: 'recentDone', label: '최근 완료 순' }];

/**
 * 검색창 표시 여부
 * TODO(백엔드 확인): 명세서에 검색 API가 없어서 꺼둠. API가 생기면 true
 */
const SHOW_SEARCH = false;

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
    return time(b) - time(a);
  });
}

function sortDone(list: Practice[], key: DoneSort) {
  const time = (p: Practice) => new Date(p.completedAt ?? p.addedAt).getTime();
  void key;
  return [...list].sort((a, b) => time(b) - time(a));
}

function dueLabel(p: Practice): { text: string; color: string; bold: boolean } {
  if (p.status === 'done' && p.completedAt) {
    const d = new Date(p.completedAt);
    return { text: `${d.getMonth() + 1}.${d.getDate()} 완료`, color: colors.textSub, bold: false };
  }
  if (p.status === 'hold') {
    const d = p.snoozeUntil ? new Date(p.snoozeUntil + 'T00:00:00') : null;
    return { text: d ? `${d.getMonth() + 1}.${d.getDate()}까지 보류` : '보류', color: colors.textSub, bold: false };
  }
  if (p.deadlineUnclear) return { text: '기한 확인 필요', color: colors.warn, bold: true };
  const left = daysLeft(p);
  if (left === null) return { text: '마감 없음', color: colors.textSub, bold: false };
  if (left === 0) return { text: 'D-Day', color: colors.error, bold: true };
  if (left < 0) return { text: `D+${-left}`, color: colors.error, bold: true };
  return { text: `D-${left}`, color: colors.primary, bold: true };
}

function matchesQuery(p: Practice, q: string) {
  if (!q) return true;
  const text = [p.title, p.category, p.summary ?? '', p.nextStep ?? ''].join(' ').toLowerCase();
  return text.includes(q.toLowerCase());
}

/* ───────── 화면 ───────── */

export function PracticeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<TabParamList, 'Practice'>>();
  const rootNav = useNavigation();
  // 들어올 때마다 비어 있는 사진 주소를 다시 찾아요 (사진 권한을 나중에 준 경우 등)
  useFocusEffect(
    useCallback(() => {
      fillMissingUris();
    }, []),
  );
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
  const [toast, setToastState] = useState<ToastState>(null);
  const setToast = (text: string, undo = false) => setToastState({ text, undo, key: Date.now() });
  /** 저장 실패: 이전 상태 그대로 두고 재시도 안내 (명세서) */
  const failed = (retry: () => void) =>
    setToastState({ text: '저장하지 못했어요', key: Date.now(), action: { label: '다시 시도', onPress: retry } });
  const [reloadKey, setReloadKey] = useState(0);
  const hideToast = useCallback(() => setToastState(null), []);

  // 선택 모드에서는 하단 탭바 대신 선택 버튼을 보여줘요
  useEffect(() => {
    nav.setOptions({ tabBarStyle: selecting ? { display: 'none' } : undefined });
  }, [nav, selecting]);

  // 다른 탭으로 나가면 선택 모드 해제
  useEffect(() => nav.addListener('blur', () => exitSelect()), [nav]);

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
      else rootNav.navigate('PracticeDetail', { id: p.id });
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
          {SHOW_SEARCH && (
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
          )}

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

        {MOCK_FAIL.practiceListLoad && reloadKey >= 0 ? (
          /* 목록을 못 불러옴 (GET /captures 실패) */
          <View style={styles.loadError}>
            <Text style={styles.loadErrorTitle}>실천 목록을 불러오지 못했어요</Text>
            <Text style={styles.loadErrorDesc}>잠시 후 다시 시도해주세요</Text>
            <Button label="다시 시도" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={{ marginTop: 12, paddingHorizontal: 24 }} />
          </View>
        ) : isEmptyTab ? (
          <EmptyState tab={tab} onSort={() => rootNav.navigate('Sort')} />
        ) : (
          <>
            {tab === 'done' && <CompletionCard />}
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
              {tab === 'active' ? (
                <Pressable onPress={() => setSortOpen(true)} style={styles.sortButton} hitSlop={8}>
                  <Text style={styles.sortText}>{sortLabel}</Text>
                  <ChevronDown size={14} color={colors.textSub} strokeWidth={2} />
                </Pressable>
              ) : (
                <Text style={styles.sortText}>{sortLabel}</Text>
              )}
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
                            const save = () => {
                              if (completePractices([p.id])) setToast('완료로 옮겼어요', true);
                              else failed(save);
                            };
                            save();
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

              {!noResults && <Text style={styles.footNote}>AI가 카테고리를 자동 분류했어요.</Text>}
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
                const save = () => {
                  if (!redoPractices(picked)) return failed(save);
                  exitSelect();
                  setToast('진행에 다시 담았어요');
                };
                save();
              }}
            />
          )}
        </View>
      )}

      <UndoToast
        toast={toast}
        onHide={hideToast}
        onUndone={() => setToast('되돌렸어요')}
        bottom={selecting ? insets.bottom + 80 : 16}
      />

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
          setCategorySheet(false);
          const save = () => {
            if (!changeCategory(picked, c)) return failed(save);
            exitSelect();
            setToast(`'${c}'(으)로 옮겼어요`);
          };
          save();
        }}
      />

      <ExcludeDialog
        count={excludeIds?.length ?? 0}
        visible={!!excludeIds}
        onCancel={() => setExcludeIds(null)}
        onConfirm={() => {
          if (!excludeIds) return;
          const ids = excludeIds;
          setExcludeIds(null);
          const save = () => {
            if (!excludePractices(ids)) return failed(save);
            exitSelect();
            setToast('참고함으로 옮겼어요', true);
          };
          save();
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
  const { done: stepsDone, total } = p.progress;
  const faded = variant === 'hold';

  // 카드 부제목: 다음 단계가 있으면 다음 단계, 없으면 요약 (요약형에 next_step 이 오기 전까지)
  let subtitle: string | null = null;
  if (variant !== 'done') subtitle = p.nextStep ? `다음 단계 · ${p.nextStep}` : p.summary;

  const showProgress = !p.guideMissing && total > 1 && !(variant === 'overdue' && !selecting);

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
        {p.uri ? (
          <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <ImageIcon size={20} color={colors.placeholder} strokeWidth={1.5} />
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.catTag, faded && styles.catTagFaded]}>
            <Text style={[styles.catTagText, faded && { color: colors.textSub }]}>{p.category}</Text>
          </View>
          <Text style={[styles.due, { color: due.color, includeFontPadding: false, fontFamily: due.bold ? fonts.bold : fonts.medium }]}>
            {due.text}
          </Text>
        </View>

        <Text style={[styles.cardTitle, faded && { color: colors.textSub }]} numberOfLines={1}>
          {p.title}
        </Text>

        {p.guideMissing ? (
          <View style={styles.analyzing}>
            <AlertCircle size={13} color={colors.warn} strokeWidth={2} />
            <Text style={[styles.analyzingText, { color: colors.warn }]}>실천 방법을 만들지 못했어요 · 눌러서 다시 분석</Text>
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
              <Text style={[styles.smallBtnText, { color: '#fff', includeFontPadding: false, fontFamily: fonts.bold }]}>완료</Text>
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

/* ───────── 완료율 (완료 탭 위) ───────── */

function CompletionCard() {
  const stats = useCompletionStats();
  if (stats.rate === null) {
    return (
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>실천 완료율</Text>
        <Text style={styles.statEmpty}>아직 실천한 항목이 없어요</Text>
      </View>
    );
  }
  const pct = (r: number | null) => (r === null ? 0 : Math.round(r * 100));
  return (
    <View style={styles.statCard}>
      <View style={styles.statHead}>
        <View style={{ gap: 2 }}>
          <Text style={styles.statLabel}>실천 완료율</Text>
          <Text style={styles.statSub}>
            완료 {stats.done_count} · 실천 대기 {stats.todo_count}
          </Text>
        </View>
        <Text style={styles.statRate}>
          {pct(stats.rate)}
          <Text style={styles.statRateUnit}>%</Text>
        </Text>
      </View>
      <View style={styles.bars} accessibilityLabel="최근 6주 완료율">
        {stats.weekly.map((w, i) => {
          const last = i === stats.weekly.length - 1;
          const d = new Date(w.week_start + 'T00:00:00');
          return (
            <View key={w.week_start} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.max(pct(w.rate), w.rate ? 4 : 0)}%` },
                    !last && { backgroundColor: '#b9d0b2' },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, last && { color: colors.primary, includeFontPadding: false, fontFamily: fonts.bold }]}>
                {last ? '이번 주' : `${d.getMonth() + 1}/${d.getDate()}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── 빈 화면 ───────── */

function EmptyState({ tab, onSort }: { tab: Tab; onSort: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Sparkles size={30} color={colors.primary} strokeWidth={1.7} />
      </View>
      <Text style={styles.emptyTitle}>{tab === 'active' ? '실천함이 비어 있어요' : '완료함이 비어 있어요'}</Text>
      <Text style={styles.emptyDesc}>
        {tab === 'active'
          ? '스크린샷을 분류해 채워보세요'
          : '실천을 완료하면 여기 모여요'}
      </Text>
      {tab === 'active' && <Button label="스크린샷 분류하기" onPress={onSort} style={{ marginTop: 14, paddingHorizontal: 22 }} />}
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
              <Text style={[styles.sheetRowText, on && { includeFontPadding: false, fontFamily: fonts.bold, color: colors.primary }]}>{o.label}</Text>
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
                <Text style={[styles.sheetRowText, on && { includeFontPadding: false, fontFamily: fonts.bold, color: colors.primary }]}>{c}</Text>
                <View style={[styles.radio, on && styles.radioOn]} />
              </Pressable>
            );
          })}
          <Pressable onPress={onAddNew} accessibilityRole="button" style={[styles.sheetRow, { justifyContent: 'flex-start', gap: 6 }]}>
            <Plus size={16} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.sheetRowText, { color: colors.primary, includeFontPadding: false, fontFamily: fonts.medium }]}>새 카테고리</Text>
          </Pressable>
        </ScrollView>
        <Button label="변경하기" disabled={!selected} onPress={() => selected && onApply(selected)} style={{ marginTop: 14 }} />
      </View>
    </Modal>
  );
}

/* ───────── 스타일 ───────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadError: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 6 },
  loadErrorTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  loadErrorDesc: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: colors.textSub },

  statCard: { marginHorizontal: 20, marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14 },
  statHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  statLabel: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  statSub: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  statEmpty: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: colors.textSub, marginTop: 4 },
  statRate: { includeFontPadding: false, fontFamily: fonts.serif, fontSize: 30, color: colors.primary },
  statRateUnit: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 15, color: colors.primary },
  bars: { flexDirection: 'row', gap: 8, height: 92 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', maxWidth: 28, borderRadius: 6, backgroundColor: '#f1f0ec', justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6, backgroundColor: colors.primary },
  barLabel: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 10, color: colors.textSub },

  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  headerAction: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 14, color: colors.primary },

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
  searchInput: { flex: 1, includeFontPadding: false, fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingVertical: 0 },

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
  segmentText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 14, color: colors.textSub },
  segmentTextOn: { includeFontPadding: false, fontFamily: fonts.bold, color: colors.text },

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
  chipText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, color: '#3b443e' },
  chipTextOn: { includeFontPadding: false, fontFamily: fonts.bold, color: '#fff' },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  listTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sortText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },

  list: { paddingHorizontal: 20, gap: 10 },
  inlineEmpty: { alignItems: 'center', gap: 4, paddingVertical: 28, borderRadius: radius.card, backgroundColor: colors.surface },
  inlineEmptyTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  inlineEmptyDesc: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: colors.textSub },
  noResults: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 14, color: colors.textSub, textAlign: 'center', paddingVertical: 40 },
  overdueHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overdueHeadText: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 13, color: colors.error },
  holdHead: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 13, color: colors.textSub, marginTop: 10 },
  footNote: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, color: colors.textSub, marginTop: 6 },

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
    overflow: 'hidden',
  },
  cardBody: { flex: 1, gap: 4, alignSelf: 'stretch' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  catTag: { backgroundColor: '#eef3ec', borderRadius: radius.chip, paddingHorizontal: 7, paddingVertical: 2 },
  catTagFaded: { backgroundColor: '#f1f0ec' },
  catTagText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 11, color: '#4e6b57' },
  due: { fontSize: 12 },
  cardTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3, color: colors.text, marginTop: 2 },
  subtitle: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: '#5f665e' },
  analyzing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  analyzingText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: colors.primary },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#eceae4', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  progressText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 11, color: colors.textSub },

  overdueActions: { flexDirection: 'row', gap: 6, marginTop: 'auto', paddingTop: 6 },
  smallBtn: { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  smallBtnLine: { borderWidth: 1, borderColor: '#e2e1db', backgroundColor: colors.surface },
  smallBtnPrimary: { backgroundColor: colors.primary },
  smallBtnText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13 },

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
  emptyTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  emptyDesc: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#5f665e', textAlign: 'center' },

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
  actionBtnText: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 15 },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, color: '#fff' },

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
  sheetTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginBottom: 4 },
  sheetDesc: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: '#5f665e', marginBottom: 8 },
  sheetRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f0ec',
  },
  sheetRowText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8, borderColor: '#c4c2bb' },
  radioOn: { borderWidth: 6, borderColor: colors.primary },

  dialogWrap: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  dialog: { width: '100%', backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  dialogTitle: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  dialogBody: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#3b443e', textAlign: 'center', marginTop: 10 },
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
  dialogInfoText: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  dialogActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  dialogBtn: { flex: 1, height: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  dialogBtnText: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 15 },
});
