import { useCallback, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Flame, RefreshCw } from 'lucide-react-native';
import { Button } from '../components/Button';
import { UndoToast, type ToastState } from '../components/UndoToast';
import {
  batchSizeFor,
  collapseNewCapturesToday,
  completedOn,
  expandNewCaptures,
  moveOldToPast,
  tierOf,
  useHomeData,
  useNewCaptures,
  type ActivityDay,
  type TodayReminder,
} from '../store/home';
import { ANALYSIS_STEP_LABEL, completePractices, parseDay, reanalyze, useCaptures, type Capture } from '../store/practices';
import { colors, fonts, radius } from '../theme';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function HomeScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const home = useHomeData();
  const nc = useNewCaptures();

  const [toast, setToastState] = useState<ToastState>(null);
  const show = (text: string, undo = false) => setToastState({ text, undo, key: Date.now() });
  const hideToast = useCallback(() => setToastState(null), []);

  const startSort = (limit: number) => nav.navigate('Sort', { mode: 'new', limit });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.appBar}>
          <Pressable onLongPress={() => nav.navigate('DevIndex')} accessibilityRole="header" accessibilityLabel="MoA" hitSlop={8}>
            <Text style={styles.logo}>MoA</Text>
          </Pressable>
        </View>

        <NewCaptureCard
          {...nc}
          onSort={startSort}
          onLater={collapseNewCapturesToday}
          onExpand={expandNewCaptures}
          onMoveOld={() => {
            moveOldToPast();
            show('오래된 캡처를 지난 캡처로 넘겼어요');
          }}
        />

        {home.processing.length > 0 && (
          <ProcessingCard items={home.processing} onRetry={(id) => reanalyze(id)} />
        )}

        <ReminderCard
          reminders={home.todayReminders}
          todoCount={home.todoCount}
          onOpen={(id) => nav.navigate('PracticeDetail', { id })}
          onComplete={(r) => {
            completePractices([r.capture_id]);
            show(`'${r.title}' 완료했어요`, true);
          }}
          onSeeAll={() => nav.navigate('Tabs', { screen: 'Practice' })}
        />

        <ActivityCard activity={home.activity} />

        {nc.pastCount > 0 && (
          <Pressable
            onPress={() => nav.navigate('Sort', { mode: 'past', limit: 10 })}
            accessibilityRole="button"
            style={styles.pastLink}
          >
            <Text style={styles.pastText}>
              지난 캡처 {nc.pastCount.toLocaleString()}장 · <Text style={{ fontFamily: fonts.bold, color: colors.text }}>정리하기</Text>
            </Text>
            <ChevronRight size={16} color={colors.textSub} strokeWidth={2} />
          </Pressable>
        )}
      </ScrollView>

      <UndoToast toast={toast} onHide={hideToast} onUndone={() => show('되돌렸어요')} bottom={16} />
    </View>
  );
}

/* ═════════ 새 캡처 안내 카드 (개수 구간별 4종) ═════════ */

function NewCaptureCard({
  loading,
  error,
  items,
  count,
  collapsedToday,
  retry,
  onSort,
  onLater,
  onExpand,
  onMoveOld,
}: ReturnType<typeof useNewCaptures> & {
  onSort: (limit: number) => void;
  onLater: () => void;
  onExpand: () => void;
  onMoveOld: () => void;
}) {
  // 불러오는 중 · 실패 (이화님 브랜치 문구 유지)
  if (loading) return <Text style={styles.headline}>스크린샷을 불러오고 있어요</Text>;
  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>스크린샷을 불러오지 못했어요</Text>
        <Text style={styles.cardDesc}>{error}</Text>
        <Button label="다시 시도" variant="secondary" onPress={retry} />
        {error.includes('권한') && <Button label="기기 설정 열기" variant="secondary" onPress={() => Linking.openSettings()} />}
      </View>
    );
  }

  const tier = tierOf(count);
  if (tier === 'none') return null;

  // [나중에] 누른 날: 한 줄로 접기
  if (collapsedToday) {
    return (
      <View style={styles.collapsed}>
        <Text style={styles.collapsedText}>새 캡처 {count}장 · 오늘은 접어뒀어요</Text>
        <Pressable onPress={onExpand} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.collapsedBtn}>펼치기</Text>
        </Pressable>
      </View>
    );
  }

  // 1~3장: 작은 한 줄
  if (tier === 'few') {
    return (
      <View style={styles.fewRow}>
        <Thumbs items={items} max={3} small />
        <Text style={styles.fewText}>새로 찍은 캡처 {count}장, 금방 끝나요</Text>
        <Pressable onPress={() => onSort(count)} accessibilityRole="button" style={styles.fewBtn}>
          <Text style={styles.fewBtnText}>바로 나누기</Text>
        </Pressable>
      </View>
    );
  }

  const copy = {
    normal: {
      badge: '새 캡처',
      title: `새 캡처 ${count}장이 있어요.\n분류할까요?`,
      desc: '한 번에 끝낼 수 있는 양이에요.',
    },
    piling: {
      badge: '쌓이는 중',
      title: `새 캡처 ${count}장이 쌓였어요.\n10장씩 나눠볼까요?`,
      desc: `10장을 끝내면 남은 ${count - 10}장을 이어서 할 수 있어요.`,
    },
    many: {
      badge: '많이 쌓였어요',
      title: `새 캡처가 ${count}장 쌓였어요.\n최근 것부터 정리해요`,
      desc: '최근 10장만 먼저 나누고, 나머지는 지난 캡처로 넘길 수 있어요.',
    },
  }[tier];
  const batch = batchSizeFor(count);

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.badge, tier === 'many' && { backgroundColor: colors.warnBg }]}>
        <Text style={[styles.badgeText, tier === 'many' && { color: colors.warn }]}>{copy.badge}</Text>
      </View>
      <Text style={styles.headline}>{copy.title}</Text>
      <Text style={styles.headlineDesc}>{copy.desc}</Text>
      <Thumbs items={items} max={5} />
      {tier === 'many' ? (
        <View style={{ gap: 8 }}>
          <Button label="최근 10장 분류하기" onPress={() => onSort(10)} />
          <Button label={`오래된 ${count - 10}장은 지난 캡처로 넘기기`} variant="secondary" onPress={onMoveOld} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="나중에" variant="secondary" onPress={onLater} style={{ flex: 1 }} />
          <Button label={`${batch}장 분류하기`} onPress={() => onSort(batch)} style={{ flex: 2 }} />
        </View>
      )}
    </View>
  );
}

/** 최근 썸네일 + 나머지 개수 */
function Thumbs({ items, max, small }: { items: ReturnType<typeof useNewCaptures>['items']; max: number; small?: boolean }) {
  const shown = Math.min(items.length, max);
  const rest = items.length - shown;
  return (
    <View style={[styles.thumbRow, small && { flex: 0 }]}>
      {items.slice(0, shown).map((s, i) => {
        const last = i === shown - 1 && rest > 0;
        return (
          <View key={s.id} style={[small ? styles.thumbSmall : styles.thumb]}>
            {!!s.uri && <Image source={{ uri: s.uri }} style={[StyleSheet.absoluteFill, { borderRadius: 6 }]} />}
            {last && (
              <View style={styles.thumbMore}>
                <Text style={styles.thumbMoreText}>+{rest + 1}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ═════════ 분석 중 · 실패 ═════════ */

function ProcessingCard({ items, onRetry }: { items: Capture[]; onRetry: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>실천 방법 정리 중</Text>
      {items.map((c) => {
        const failed = c.status === 'FAILED';
        return (
          <View key={c.id} style={styles.procRow}>
            <View style={styles.procThumb} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.procTitle, failed && { color: colors.error }]}>
                {failed ? c.error?.message ?? '분석하지 못했어요' : '사진을 분석하고 있어요'}
              </Text>
              {!failed && c.job_step && <Text style={styles.procSub}>{ANALYSIS_STEP_LABEL[c.job_step]} 중</Text>}
            </View>
            {failed ? (
              <Pressable onPress={() => onRetry(c.id)} accessibilityRole="button" style={styles.retryBtn}>
                <RefreshCw size={13} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            ) : (
              <RefreshCw size={16} color={colors.textSub} strokeWidth={2} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ═════════ 오늘의 리마인드 ═════════ */

function reasonTag(r: TodayReminder): { text: string; color: string } {
  if (r.reason === 'SNOOZE_DUE') return { text: '다시 볼 날', color: colors.textSub };
  if (r.reason === 'RANDOM_PICK') return { text: '오늘의 추천', color: colors.textSub };
  const d = parseDay(r.deadline!);
  const now = new Date();
  const left = Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (left < 0) return { text: `D+${-left}`, color: colors.error };
  if (left === 0) return { text: 'D-Day', color: colors.error };
  return { text: `D-${left}`, color: colors.primary };
}

function ReminderCard({
  reminders,
  todoCount,
  onOpen,
  onComplete,
  onSeeAll,
}: {
  reminders: TodayReminder[];
  todoCount: number;
  onOpen: (id: string) => void;
  onComplete: (r: TodayReminder) => void;
  onSeeAll: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>오늘의 리마인드</Text>
        <Pressable onPress={onSeeAll} accessibilityRole="button" hitSlop={8} style={styles.seeAll}>
          <Text style={styles.seeAllText}>전체 보기</Text>
          <ChevronRight size={12} color={colors.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {reminders.length === 0 ? (
        <Text style={styles.emptyText}>{todoCount === 0 ? '아직 모아둔 실천이 없어요' : '오늘 챙길 실천이 없어요'}</Text>
      ) : (
        reminders.map((r) => {
          const tag = reasonTag(r);
          return (
            <View key={r.capture_id} style={styles.reminderRow}>
              <Pressable
                onPress={() => onComplete(r)}
                accessibilityRole="button"
                accessibilityLabel={`${r.title} 완료하기`}
                hitSlop={10}
                style={styles.check}
              />
              <Pressable onPress={() => onOpen(r.capture_id)} accessibilityRole="button" style={styles.reminderBody}>
                <Text style={styles.reminderText} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={[styles.reasonTag, { color: tag.color }]}>{tag.text}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

/* ═════════ 실천 잔디 (16주 × 7일, 월요일 시작) ═════════ */

const LEVEL_COLORS = ['#ebebe8', '#c9dcc2', '#97bc8c', '#5a8c62', colors.primary];
const CELL_GAP = 3;

function ActivityCard({ activity }: { activity: ReturnType<typeof useHomeData>['activity'] }) {
  const captures = useCaptures();
  const [picked, setPicked] = useState<ActivityDay | null>(null);
  const today = activity.end;
  const empty = activity.total === 0;

  // 달이 바뀌는 주에만 월 표시
  const monthLabels = activity.weeks.map((w, i) => {
    const m = parseDay(w[0].date).getMonth();
    const prev = i > 0 ? parseDay(activity.weeks[i - 1][0].date).getMonth() : -1;
    return m !== prev ? `${m + 1}월` : '';
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>실천 잔디</Text>
        {activity.current_streak > 0 && (
          <View style={styles.streak}>
            <Flame size={13} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.streakText}>{activity.current_streak}일째 실천 중</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardDesc}>최근 16주 동안 {activity.total}개를 실천했어요</Text>

      <View>
        <View style={styles.grassRow}>
          {monthLabels.map((m, i) => (
            <Text key={i} style={styles.monthLabel} numberOfLines={1}>
              {m}
            </Text>
          ))}
        </View>
        <View style={styles.grassRow}>
          {activity.weeks.map((week, wi) => (
            <View key={wi} style={styles.grassCol}>
              {week.map((d) => {
                const future = d.date > today;
                return (
                  <Pressable
                    key={d.date}
                    disabled={future}
                    onPress={() => setPicked(d)}
                    accessibilityLabel={`${d.date}, ${d.count}개 완료`}
                    style={[
                      styles.grassCell,
                      { backgroundColor: future ? 'transparent' : LEVEL_COLORS[d.level] },
                      d.date === today && styles.grassToday,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        {empty ? (
          <Text style={styles.cardDesc}>첫 실천을 완료하면 잔디가 생겨요</Text>
        ) : (
          <>
            <Text style={styles.legendText}>적게</Text>
            {LEVEL_COLORS.map((c) => (
              <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />
            ))}
            <Text style={styles.legendText}>많이</Text>
          </>
        )}
      </View>

      <DaySheet day={picked} items={picked ? completedOn(captures, picked.date) : []} onClose={() => setPicked(null)} />
    </View>
  );
}

function DaySheet({ day, items, onClose }: { day: ActivityDay | null; items: Capture[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!day) return null;
  const d = parseDay(day.date);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>
          {d.getMonth() + 1}월 {d.getDate()}일 ({WEEKDAYS[d.getDay()]})
        </Text>
        <Text style={styles.cardDesc}>{day.count ? `실천 ${day.count}개를 완료했어요` : '이날은 완료한 실천이 없어요'}</Text>
        {items.map((c) => (
          <View key={c.id} style={styles.dayRow}>
            <Check size={15} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.dayText}>{c.title}</Text>
          </View>
        ))}
        {day.count > items.length && items.length === 0 && (
          <Text style={[styles.cardDesc, { marginTop: 6 }]}>(예시 기록이라 항목 목록은 서버 연결 후 보여요)</Text>
        )}
      </View>
    </Modal>
  );
}

/* ═════════ 스타일 ═════════ */

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  appBar: { height: 32, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  logo: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3, color: colors.text },

  badge: { alignSelf: 'flex-start', backgroundColor: colors.tint, borderRadius: radius.chip, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  headline: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 31, letterSpacing: -0.6, color: colors.text },
  headlineDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSub, marginTop: -6 },

  thumbRow: { flexDirection: 'row', gap: 4 },
  thumb: { flex: 1, aspectRatio: 0.85, backgroundColor: colors.skeleton, borderRadius: 6, overflow: 'hidden' },
  thumbSmall: { width: 28, height: 36, backgroundColor: colors.skeleton, borderRadius: 5, overflow: 'hidden' },
  thumbMore: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(34,46,40,0.45)', alignItems: 'center', justifyContent: 'center' },
  thumbMoreText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },

  fewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fewText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  fewBtn: { backgroundColor: colors.primary, borderRadius: radius.button, paddingHorizontal: 12, height: 34, justifyContent: 'center' },
  fewBtnText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },

  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    height: 48,
  },
  collapsedText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSub },
  collapsedBtn: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },

  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.4, color: colors.text },
  cardDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.tint, borderRadius: radius.chip, paddingHorizontal: 8, paddingVertical: 4 },
  seeAllText: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary },

  procRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  procThumb: { width: 32, height: 44, borderRadius: 6, backgroundColor: colors.skeleton },
  procTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  procSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.tint, borderRadius: radius.chip, paddingHorizontal: 10, height: 30 },
  retryText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },

  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSub, paddingVertical: 8 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8, borderColor: '#c4c2bb' },
  reminderBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  reminderText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  reasonTag: { fontFamily: fonts.bold, fontSize: 12 },

  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.tint, borderRadius: radius.chip, paddingHorizontal: 8, paddingVertical: 3 },
  streakText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  grassRow: { flexDirection: 'row', gap: CELL_GAP },
  grassCol: { flex: 1, gap: CELL_GAP },
  grassCell: { aspectRatio: 1, borderRadius: 3 },
  grassToday: { borderWidth: 1.5, borderColor: colors.primary },
  monthLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 9, color: colors.textSub, marginBottom: 4, overflow: 'visible' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSub, marginHorizontal: 2 },

  pastLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  pastText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSub },

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
    gap: 6,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#dad9d3', alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dayText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
});
