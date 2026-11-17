import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Button } from './Button';
import { dayKey, parseDay } from '../store/practices';
import { colors, fonts, radius } from '../theme';

export type DatePreset = { label: string; value: string };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDay(key: string) {
  const d = parseDay(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/**
 * 날짜 고르기 시트
 * - presets 가 있으면 먼저 빠른 선택(내일, 다음 주…)을 보여주고, [날짜 직접 고르기]로 달력을 열어요
 * - allowNone 이면 '없음' 선택지를 함께 보여줘요 (마감 없음)
 */
export function DateSheet({
  visible,
  title,
  description,
  presets,
  initial,
  defaultPreset,
  allowNone,
  noneLabel = '없음',
  minDate,
  confirmLabel = '확인',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  description?: string;
  presets?: DatePreset[];
  initial?: string | null;
  defaultPreset?: string;
  allowNone?: boolean;
  noneLabel?: string;
  /** 이 날짜 이전은 고를 수 없어요 (YYYY-MM-DD) */
  minDate?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'presets' | 'calendar'>('presets');
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    if (!visible) return;
    const start = initial ?? defaultPreset ?? null;
    setSelected(start);
    setMode(presets?.length ? 'presets' : 'calendar');
    setMonth(start ? parseDay(start) : new Date());
  }, [visible, initial, defaultPreset, presets?.length]);

  const weeks = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [month]);

  const today = dayKey(new Date());
  const isPresetSelected = presets?.some((p) => p.value === selected);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onCancel} accessibilityLabel="닫기" hitSlop={10}>
            <X size={20} color={colors.textSub} strokeWidth={2} />
          </Pressable>
        </View>
        {description && <Text style={styles.desc}>{description}</Text>}

        {mode === 'presets' && presets ? (
          <View style={{ marginTop: 8 }}>
            {presets.map((p) => {
              const on = selected === p.value;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => setSelected(p.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.row, on && styles.rowOn]}
                >
                  <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>{p.label}</Text>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowSub}>{formatDay(p.value)}</Text>
                    {on && <Check size={16} color={colors.primary} strokeWidth={2.4} />}
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setMode('calendar')}
              accessibilityRole="button"
              style={[styles.row, selected && !isPresetSelected && styles.rowOn]}
            >
              <Text style={[styles.rowLabel, selected && !isPresetSelected && styles.rowLabelOn]}>날짜 직접 고르기</Text>
              <View style={styles.rowRight}>
                {selected && !isPresetSelected && <Text style={styles.rowSub}>{formatDay(selected)}</Text>}
                <ChevronRight size={16} color={colors.textSub} strokeWidth={2} />
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                accessibilityLabel="이전 달"
                hitSlop={12}
              >
                <ChevronLeft size={18} color={colors.text} strokeWidth={2} />
              </Pressable>
              <Text style={styles.monthText}>
                {month.getFullYear()}년 {month.getMonth() + 1}월
              </Text>
              <Pressable
                onPress={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                accessibilityLabel="다음 달"
                hitSlop={12}
              >
                <ChevronRight size={18} color={colors.text} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={styles.week}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.week}>
                {week.map((d, di) => {
                  if (!d) return <View key={di} style={styles.cell} />;
                  const key = dayKey(new Date(month.getFullYear(), month.getMonth(), d));
                  const disabled = !!minDate && key < minDate;
                  const on = key === selected;
                  return (
                    <Pressable
                      key={di}
                      disabled={disabled}
                      onPress={() => setSelected(key)}
                      accessibilityLabel={formatDay(key)}
                      accessibilityState={{ selected: on, disabled }}
                      style={[styles.cell, on && styles.cellOn]}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          key === today && styles.cellToday,
                          disabled && { color: colors.disabled },
                          on && { color: '#fff', includeFontPadding: false, fontFamily: fonts.bold },
                        ]}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {presets && (
              <Pressable onPress={() => setMode('presets')} style={{ alignSelf: 'flex-start', marginTop: 6 }} hitSlop={8}>
                <Text style={styles.back}>‹ 빠른 선택으로</Text>
              </Pressable>
            )}
          </View>
        )}

        {allowNone && (
          <Pressable
            onPress={() => setSelected(null)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === null }}
            style={[styles.row, selected === null && styles.rowOn, { marginTop: 4 }]}
          >
            <Text style={[styles.rowLabel, selected === null && styles.rowLabelOn]}>{noneLabel}</Text>
            {selected === null && <Check size={16} color={colors.primary} strokeWidth={2.4} />}
          </Pressable>
        )}

        <Text style={styles.summary}>
          {selected ? `선택: ${formatDay(selected)}` : allowNone ? `선택: ${noneLabel}` : '날짜를 골라주세요'}
        </Text>

        <View style={styles.actions}>
          <Button label="취소" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          <Button
            label={confirmLabel}
            onPress={() => onConfirm(selected)}
            disabled={!selected && !allowNone}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#dad9d3', alignSelf: 'center', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  desc: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 13, color: colors.textSub, marginTop: 4 },
  row: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: radius.input,
    marginBottom: 6,
    backgroundColor: '#f6f5f1',
  },
  rowOn: { backgroundColor: colors.tint },
  rowLabel: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  rowLabelOn: { includeFontPadding: false, fontFamily: fonts.bold, color: colors.primary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowSub: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 8 },
  monthText: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', includeFontPadding: false, fontFamily: fonts.medium, fontSize: 11, color: colors.textSub, paddingVertical: 4 },
  cell: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  cellOn: { backgroundColor: colors.primary },
  cellText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  cellToday: { includeFontPadding: false, fontFamily: fonts.bold, color: colors.primary },
  back: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, color: colors.textSub },
  summary: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 12, color: colors.primary, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
