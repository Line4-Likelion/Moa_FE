import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Button } from '../components/Button';
import { colors, fonts, radius } from '../theme';

/* ───────── 목업 데이터 (갤러리 / API 연동 시 이 부분만 교체) ───────── */

/** 아직 분류하지 않은 스크린샷 개수 */
const UNSORTED_COUNT = 12;
/** 홈에 미리보기로 보여줄 썸네일 칸 수 (마지막 칸은 +n 표시) */
const PREVIEW_SLOTS = 5;

type Reminder = { id: string; title: string };
const REMINDERS: Reminder[] = [
  { id: 'r1', title: '연남 소바실 예약' },
  { id: 'r2', title: '4호선톤 지원' },
  { id: 'r3', title: '자격증 시험 접수' },
];

/** 하루 기록. done = 그날 실천 완료한 개수, sorted = 분류만 한 날 */
type DayRecord = { done?: number; sorted?: boolean };

/** 이번 달 1일~오늘까지 예시 기록을 만들어요. (실제로는 서버에서 받아온 값) */
function buildMockRecords(today: Date): Record<string, DayRecord> {
  const pattern: DayRecord[] = [
    { sorted: true }, { done: 1 }, { sorted: true }, {}, { done: 2 }, { sorted: true }, { done: 1 },
    { sorted: true }, { sorted: true }, { done: 2 }, { sorted: true }, { done: 1 }, { sorted: true },
  ];
  const records: Record<string, DayRecord> = {};
  for (let d = 1; d < today.getDate(); d++) {
    records[dateKey(today.getFullYear(), today.getMonth(), d)] = pattern[(d - 1) % pattern.length];
  }
  return records;
}

/* ───────── 달력 유틸 ───────── */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 해당 달을 주 단위로 나눠요. 1일 앞, 말일 뒤 빈 칸은 null */
function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ───────── 화면 ───────── */

export function HomeScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const today = useMemo(() => new Date(), []);
  const records = useMemo(() => buildMockRecords(today), [today]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const toggleReminder = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.appBar}>
        <Pressable
          onLongPress={() => nav.navigate('DevIndex')}
          accessibilityRole="header"
          accessibilityLabel="MoA"
          hitSlop={8}
        >
          <Text style={styles.logo}>MoA</Text>
        </Pressable>
      </View>

      <SortSection
        count={UNSORTED_COUNT}
        onSort={() => {
          /* TODO: 스와이프 분류 화면으로 이동 (팀원 A 담당 화면) */
        }}
      />

      <ReminderCard
        reminders={REMINDERS}
        checked={checked}
        onToggle={toggleReminder}
        onSeeAll={() => nav.navigate('Tabs', { screen: 'Practice' })}
      />

      <PracticeCalendar
        year={viewMonth.year}
        month={viewMonth.month}
        today={today}
        records={records}
        onChangeMonth={(delta) =>
          setViewMonth(({ year, month }) => {
            const d = new Date(year, month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
          })
        }
      />
    </ScrollView>
  );
}

/* ───────── 분류 영역 ───────── */

function SortSection({ count, onSort }: { count: number; onSort: () => void }) {
  const isEmpty = count === 0;
  const shown = Math.min(count, PREVIEW_SLOTS);
  const rest = count - shown;

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.headline}>
        {isEmpty ? '모든 캡처를 정리했어요' : `새로 모인 캡처 ${count}장,\n실천할 것만 골라볼까요?`}
      </Text>

      {!isEmpty && (
        <View style={styles.thumbRow}>
          {Array.from({ length: PREVIEW_SLOTS }, (_, i) => {
            if (i >= shown) return <View key={i} style={styles.thumbSlot} />;
            const isLast = i === shown - 1 && rest > 0;
            return (
              /* TODO: 실제 썸네일은 <Image source={{ uri }} /> 로 교체 */
              <View key={i} style={[styles.thumbSlot, styles.thumb, isLast && styles.thumbMore]}>
                {isLast && <Text style={styles.thumbMoreText}>+{rest + 1}</Text>}
              </View>
            );
          })}
        </View>
      )}

      <Button label="분류하기" onPress={onSort} disabled={isEmpty} />
    </View>
  );
}

/* ───────── 오늘의 리마인드 ───────── */

function ReminderCard({
  reminders,
  checked,
  onToggle,
  onSeeAll,
}: {
  reminders: Reminder[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
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

      <View>
        {reminders.map((r) => {
          const done = !!checked[r.id];
          return (
            <Pressable
              key={r.id}
              onPress={() => onToggle(r.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={r.title}
              style={styles.reminderRow}
            >
              <View style={[styles.check, done && styles.checkDone]}>
                {done && <Check size={13} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={[styles.reminderText, done && styles.reminderTextDone]}>{r.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── 실천 달력 (잔디) ───────── */

function PracticeCalendar({
  year,
  month,
  today,
  records,
  onChangeMonth,
}: {
  year: number;
  month: number;
  today: Date;
  records: Record<string, DayRecord>;
  onChangeMonth: (delta: number) => void;
}) {
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const canGoNext = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

  const monthTotal = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    return Object.entries(records).reduce((sum, [key, r]) => (key.startsWith(prefix) ? sum + (r.done ?? 0) : sum), 0);
  }, [records, year, month]);

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return (
    <View style={styles.card}>
      <View style={styles.calHeader}>
        <View style={styles.monthNav}>
          <Pressable onPress={() => onChangeMonth(-1)} accessibilityLabel="이전 달" hitSlop={12}>
            <ChevronLeft size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.monthText}>{month + 1}월</Text>
          <Pressable
            onPress={() => onChangeMonth(1)}
            disabled={!canGoNext}
            accessibilityLabel="다음 달"
            accessibilityState={{ disabled: !canGoNext }}
            hitSlop={12}
          >
            <ChevronRight size={18} color={canGoNext ? colors.text : colors.disabled} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.totalLabel}>실천한 일</Text>
          <Text style={styles.totalNumber}>
            {monthTotal}
            <Text style={styles.totalUnit}>개</Text>
          </Text>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={{ gap: CELL_GAP }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={styles.cellSlot} />;
              const record = records[dateKey(year, month, day)];
              const time = new Date(year, month, day).getTime();
              const isToday = isCurrentMonth && day === today.getDate();
              const isFuture = time > todayStart;
              const doneCount = record?.done ?? 0;

              const bg = doneCount > 0
                ? colors.primary
                : record?.sorted
                  ? colors.grassSorted
                  : isFuture
                    ? colors.grassFuture
                    : colors.grassEmpty;

              const label = `${month + 1}월 ${day}일${doneCount ? `, 실천 ${doneCount}개` : record?.sorted ? ', 분류함' : ''}${isToday ? ', 오늘' : ''}`;

              return (
                <View key={di} style={styles.cellSlot} accessible accessibilityLabel={label}>
                  <View style={[styles.cell, { backgroundColor: bg }]}>
                    {doneCount > 1 && <Text style={styles.cellBadge}>{doneCount}</Text>}
                  </View>
                  {isToday && <View pointerEvents="none" style={styles.todayRing} />}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.grassSorted} label="분류한 날" />
        <LegendItem color={colors.primary} label="실천한 날" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/* ───────── 스타일 ───────── */

const CELL_GAP = 6;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },

  appBar: { height: 32, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  logo: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3, color: colors.text },

  headline: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 31, letterSpacing: -0.6, color: colors.text },

  thumbRow: { flexDirection: 'row', gap: 4 },
  thumbSlot: { flex: 1, aspectRatio: 0.85 },
  thumb: { backgroundColor: colors.skeleton, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  thumbMore: { backgroundColor: '#b5b5b2' },
  thumbMoreText: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.4, color: colors.text },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.tint,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  seeAllText: { fontFamily: fonts.medium, fontSize: 11, color: colors.primary },

  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.primary },
  reminderText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  reminderTextDone: { color: colors.textSub, textDecorationLine: 'line-through' },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  totalWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  totalLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSub },
  totalNumber: { fontFamily: fonts.serif, fontSize: 32, color: colors.primary },
  totalUnit: { fontFamily: fonts.medium, fontSize: 15, color: colors.primary },

  weekRow: { flexDirection: 'row', gap: CELL_GAP },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 10, color: colors.textSub },

  cellSlot: { flex: 1, aspectRatio: 1 },
  cell: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellBadge: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  todayRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },

  legend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSub },
});
