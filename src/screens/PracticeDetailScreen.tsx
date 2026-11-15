import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  Archive,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
  MoreHorizontal,
  PauseCircle,
  RefreshCw,
} from 'lucide-react-native';
import { Button } from '../components/Button';
import { DateSheet } from '../components/DateSheet';
import { ExcludeDialog } from '../components/ExcludeDialog';
import { UndoToast, type ToastState } from '../components/UndoToast';
import type { RootStackParamList } from '../navigation/types';
import {
  completePractices,
  dayKey,
  daysLeftOf,
  excludePractices,
  isCaptureOverdue,
  isSnoozed,
  nextWeekSameDay,
  parseDay,
  ANALYSIS_STEP_LABEL,
  reanalyze,
  type AnalysisStep,
  redoPractices,
  snoozeCaptures,
  toggleChecklist,
  updateFacts,
  useCapture,
  type Capture,
} from '../store/practices';
import { colors, fonts, radius } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeDetail'>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ANALYSIS_STEPS: AnalysisStep[] = ['OCR', 'DEADLINE', 'CATEGORIZE', 'GUIDE'];
const md = (key: string) => {
  const d = parseDay(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const mdIso = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** 마감 표시 */
function deadlineText(c: Capture): { text: string; tone: 'red' | 'green' | 'warn' | 'sub' } {
  if (c.deadline.status === 'UNCLEAR') return { text: '기한 확인 필요', tone: 'warn' };
  const left = daysLeftOf(c);
  if (left === null) return { text: '마감 없음', tone: 'sub' };
  const date = `${md(c.deadline.date!)}까지`;
  if (left < 0) return { text: `${date} · D+${-left}`, tone: 'red' };
  if (left === 0) return { text: `${date} · D-Day`, tone: 'red' };
  return { text: `${date} · D-${left}`, tone: 'green' };
}
const TONE = { red: colors.error, green: colors.primary, warn: colors.warn, sub: colors.textSub };

export function PracticeDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const capture = useCapture(route.params.id);

  const [toast, setToast] = useState<ToastState>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [factsOpen, setFactsOpen] = useState(false);

  const show = (text: string, undo = false) => setToast({ text, undo, key: Date.now() });
  const hideToast = useCallback(() => setToast(null), []);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" hitSlop={10} style={styles.headerBtn}>
        <ChevronLeft size={22} color={colors.text} strokeWidth={1.8} />
      </Pressable>
      <Text style={styles.headerTitle}>실천 상세</Text>
      {capture?.status === 'TODO' ? (
        <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="더보기" hitSlop={10} style={styles.headerBtn}>
          <MoreHorizontal size={22} color={colors.text} strokeWidth={1.8} />
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
    </View>
  );

  // 알림으로 들어왔는데 항목을 찾을 수 없으면 실천 목록으로 이동 (명세서: 푸시 딥링크 예외처리)
  useEffect(() => {
    if (!capture) navigation.navigate('Tabs', { screen: 'Practice' });
  }, [capture, navigation]);

  /* 보관함으로 옮겨진 경우 (알림 딥링크로 들어왔을 때도 여기로) */
  if (!capture || capture.status === 'REFERENCE') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.gone}>
          <View style={styles.goneIcon}>
            <Archive size={28} color={colors.primary} strokeWidth={1.7} />
          </View>
          <Text style={styles.goneTitle}>{capture ? '보관함으로 옮겨진 항목이에요' : '찾을 수 없는 항목이에요'}</Text>
          <Text style={styles.goneDesc}>
            {capture ? '실천에서 제외해서 AI 분석 내용이 지워졌어요' : '이미 정리됐거나 삭제된 항목이에요'}
          </Text>
          <Button label="실천함으로" onPress={navigation.goBack} style={{ marginTop: 16, paddingHorizontal: 24 }} />
        </View>
        <UndoToast toast={toast} onHide={hideToast} onUndone={() => show('되돌렸어요')} bottom={insets.bottom + 24} />
      </View>
    );
  }

  const c = capture;
  const done = c.status === 'DONE';
  const analyzing = c.status === 'ANALYZING';
  const snoozed = isSnoozed(c);
  const overdue = isCaptureOverdue(c);
  const left = daysLeftOf(c);
  const due = deadlineText(c);
  const checked = c.checklist.filter((i) => i.checked).length;
  const total = c.checklist.length;
  const noGuide = c.guide === null && total === 0;

  // 원본 정보 목록: 마감을 맨 앞에
  const factRows = [
    {
      key: 'deadline',
      label: c.deadline.label ?? '마감',
      value:
        c.deadline.status === 'FOUND' && c.deadline.date
          ? `${md(c.deadline.date)} (${WEEKDAYS[parseDay(c.deadline.date).getDay()]})`
          : c.deadline.status === 'UNCLEAR'
            ? null
            : '없음',
      edited: false,
      hasBox: !!c.deadline.box,
    },
    ...c.facts.map((f) => ({ key: f.key, label: f.label, value: f.value, edited: f.edited, hasBox: !!f.box })),
  ];
  const warnCount = factRows.filter((f) => f.value === null).length;

  const onToggle = (itemId: string) => {
    if (toggleChecklist(c.id, itemId)) show('모든 단계를 끝내서 완료로 옮겼어요', true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 14 }}>
        {/* 상단: 원본 썸네일 + 제목 */}
        <View style={styles.hero}>
          <Pressable
            onPress={() => navigation.navigate('OriginalView', { id: c.id })}
            accessibilityLabel="원본 전체 보기"
            style={styles.thumb}
          >
            <ImageIcon size={22} color={colors.placeholder} strokeWidth={1.5} />
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText}>원본</Text>
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.catTag}>
              <Text style={styles.catTagText}>{c.category?.name ?? '기타'}</Text>
            </View>
            <Text style={styles.title}>{c.title ?? '제목 없음'}</Text>
            {!!c.summary && <Text style={styles.summary}>{c.summary}</Text>}
            {!done && <Text style={[styles.dueText, { color: TONE[due.tone] }]}>{due.text}</Text>}
          </View>
        </View>

        {/* 상태 안내 띠 */}
        {done && (
          <Banner tone="green" icon={<Check size={16} color={colors.primary} strokeWidth={2.4} />}>
            {`${mdIso(c.status_changed_at)}에 완료했어요`}
          </Banner>
        )}
        {snoozed && (
          <Banner
            tone="sub"
            icon={<PauseCircle size={16} color={colors.textSub} strokeWidth={2} />}
          >
            {`${md(c.snooze_until!)}에 다시 알려드릴게요`}
          </Banner>
        )}
        {overdue && (
          <Banner
            tone="red"
            icon={<AlertCircle size={16} color={colors.error} strokeWidth={2.2} />}
            action={{ label: '기한 변경', onPress: () => setDeadlineOpen(true) }}
          >
            {`마감이 ${-left!}일 지났어요`}
          </Banner>
        )}
        {!done && !snoozed && c.deadline.status === 'UNCLEAR' && (
          <Banner
            tone="warn"
            icon={<AlertCircle size={16} color={colors.warn} strokeWidth={2.2} />}
            action={{ label: '기한 정하기', onPress: () => setDeadlineOpen(true) }}
          >
            날짜는 있지만 마감인지 확실하지 않아요
          </Banner>
        )}
        {!done && !snoozed && !overdue && !!c.next_alarm_at && (
          <View style={styles.alarm}>
            <Bell size={14} color={colors.textSub} strokeWidth={2} />
            <Text style={styles.alarmText}>{mdIso(c.next_alarm_at)}에 알려드릴게요</Text>
          </View>
        )}

        {/* 원본에서 찾은 정보 — 리마인드 정확도에 직접 영향 (마감 → 알림 날짜, 장소 → 위치 알림) */}
        <View style={styles.section}>
          <Pressable
            onPress={() => setFactsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: factsOpen }}
            style={styles.sectionHead}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitleInline}>원본에서 찾은 정보</Text>
                {warnCount > 0 && (
                  <View style={styles.warnBadge}>
                    <Text style={styles.warnBadgeText}>확인 필요 {warnCount}</Text>
                  </View>
                )}
              </View>
              {!factsOpen && (
                <Text style={styles.factsSummary} numberOfLines={1}>
                  {factRows
                    .slice(0, 2)
                    .map((f) => `${f.label} ${f.value ?? '직접 확인 필요'}`)
                    .join(' · ')}
                </Text>
              )}
            </View>
            {factsOpen ? (
              <ChevronUp size={18} color={colors.textSub} />
            ) : (
              <ChevronDown size={18} color={colors.textSub} />
            )}
          </Pressable>
          {factsOpen && (
            <>
              {factRows.map((f) => (
                <FactRow
                  key={f.key}
                  label={f.label}
                  value={f.value}
                  edited={f.edited}
                  onSource={f.hasBox ? () => navigation.navigate('OriginalView', { id: c.id, focus: f.key }) : undefined}
                />
              ))}
              <View style={styles.factsActions}>
                <Pressable
                  onPress={() => navigation.navigate('OriginalView', { id: c.id })}
                  accessibilityRole="button"
                  style={[styles.factsBtn, { backgroundColor: '#f6f5f1' }]}
                >
                  <Text style={[styles.factsBtnText, { color: colors.text }]}>원본 전체 보기</Text>
                </Pressable>
                {!done && (
                  <Pressable
                    onPress={() => navigation.navigate('FactsEdit', { id: c.id })}
                    accessibilityRole="button"
                    style={[styles.factsBtn, { backgroundColor: colors.tint }]}
                  >
                    <Text style={[styles.factsBtnText, { color: colors.primary, fontFamily: fonts.bold }]}>정보 수정</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </View>

        {/* 실천 단계 */}
        <Section
          title="실천 단계"
          right={total > 0 ? `${checked} / ${total}` : undefined}
        >
          {analyzing ? (
            <View style={styles.noGuide}>
              <RefreshCw size={18} color={colors.primary} strokeWidth={2} />
              <Text style={styles.noGuideTitle}>실천 방법을 정리하고 있어요</Text>
              {c.job_step && (
                <Text style={styles.noGuideDesc}>
                  {ANALYSIS_STEPS.indexOf(c.job_step) + 1} / {ANALYSIS_STEPS.length} · {ANALYSIS_STEP_LABEL[c.job_step]}
                </Text>
              )}
            </View>
          ) : c.status === 'FAILED' ? (
            <View style={styles.noGuide}>
              <Text style={styles.noGuideTitle}>사진을 끝까지 분석하지 못했어요</Text>
              <Text style={styles.noGuideDesc}>{c.error?.message ?? '잠시 후 다시 시도해주세요'}</Text>
              <Button
                label="다시 분석"
                variant="secondary"
                onPress={() => reanalyze(c.id)}
                style={{ marginTop: 8, alignSelf: 'stretch' }}
              />
            </View>
          ) : noGuide ? (
            <View style={styles.noGuide}>
              <Text style={styles.noGuideTitle}>실천 방법을 만들지 못했어요</Text>
              <Text style={styles.noGuideDesc}>원본을 다시 분석하면 실천 단계를 만들어 드려요</Text>
              <Button
                label="다시 분석"
                variant="secondary"
                onPress={() => reanalyze(c.id)}
                style={{ marginTop: 8, alignSelf: 'stretch' }}
              />
            </View>
          ) : (
            <>
              {total > 1 && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round((checked / total) * 100)}%` }]} />
                </View>
              )}
              {c.checklist.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => onToggle(item.id)}
                  disabled={done}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked, disabled: done }}
                  style={styles.checkRow}
                >
                  <View style={[styles.checkBox, item.checked && styles.checkBoxOn]}>
                    {item.checked && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.checkText, item.checked && styles.checkTextDone]}>{item.text}</Text>
                </Pressable>
              ))}
            </>
          )}
        </Section>

        {/* AI 실천 가이드 */}
        {c.guide && (
          <Section
            title={c.guide.title}
            onHeaderPress={() => setGuideOpen((v) => !v)}
            rightIcon={guideOpen ? <ChevronUp size={18} color={colors.textSub} /> : <ChevronDown size={18} color={colors.textSub} />}
          >
            {guideOpen && (
              <View style={{ gap: 10 }}>
                {c.guide.lines.map((line, i) => (
                  <View key={i} style={styles.guideLine}>
                    <Text style={styles.guideNum}>{i + 1}</Text>
                    <Text style={styles.guideText}>{line}</Text>
                  </View>
                ))}
                {c.guide.preparations.length > 0 && (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <Text style={styles.subLabel}>준비물</Text>
                    <View style={styles.prepRow}>
                      {c.guide.preparations.map((p) => (
                        <View key={p} style={styles.prepChip}>
                          <Text style={styles.prepText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {c.links.map((l) => (
                  <Pressable key={l.url} onPress={() => Linking.openURL(l.url)} accessibilityRole="link" style={styles.linkBtn}>
                    <ExternalLink size={15} color={colors.primary} strokeWidth={2} />
                    <Text style={styles.linkText}>{l.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
        )}

      </ScrollView>

      {/* 하단 버튼 */}
      {(c.status === 'TODO' || done) && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
          {done ? (
            <Button
              label="다시 하기"
              onPress={() => {
                const [newId] = redoPractices([c.id]);
                if (newId) navigation.replace('PracticeDetail', { id: newId });
              }}
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setExcludeOpen(true)}
                accessibilityRole="button"
                style={styles.excludeBtn}
              >
                <Text style={styles.excludeBtnText}>제외</Text>
              </Pressable>
              <Button
                label={snoozed ? '날짜 변경' : '보류'}
                variant="secondary"
                onPress={() => setSnoozeOpen(true)}
                style={{ flex: 1 }}
              />
              <Button
                label="완료"
                onPress={() => {
                  completePractices([c.id]);
                  show('완료로 표시했어요', true);
                }}
                style={{ flex: 1 }}
              />
            </>
          )}
        </View>
      )}

      <UndoToast
        toast={toast}
        onHide={hideToast}
        onUndone={() => show('되돌렸어요')}
        bottom={insets.bottom + 80}
      />

      {/* 더보기 메뉴 */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setMenuOpen(false)} accessibilityLabel="닫기" />
        <View style={[styles.menu, { paddingBottom: insets.bottom + 12 }]}>
          <MenuRow
            label="카테고리 변경"
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate('CategoryChange', { label: c.title ?? '이 실천', ids: [c.id] });
            }}
          />
          <MenuRow
            label="정보 수정"
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate('FactsEdit', { id: c.id });
            }}
          />
        </View>
      </Modal>

      <DateSheet
        visible={snoozeOpen}
        title="언제 다시 볼까요?"
        description="고른 날에 알림을 보내드려요. 그때까진 실천함 아래 보류에 있어요."
        presets={[
          { label: '내일', value: plusDays(1) },
          { label: '다음 주', value: nextWeekSameDay() },
        ]}
        initial={c.snooze_until}
        defaultPreset={nextWeekSameDay()}
        minDate={plusDays(1)}
        onCancel={() => setSnoozeOpen(false)}
        onConfirm={(value) => {
          setSnoozeOpen(false);
          snoozeCaptures([c.id], value ?? undefined);
          show(`${md(value ?? nextWeekSameDay())}에 다시 알려드릴게요`, true);
        }}
      />

      <DateSheet
        visible={deadlineOpen}
        title="마감 날짜"
        description="원본은 바뀌지 않고, 알림 날짜만 다시 정해져요."
        initial={c.deadline.date}
        allowNone
        noneLabel="마감 없음"
        minDate={dayKey(new Date())}
        confirmLabel="저장"
        onCancel={() => setDeadlineOpen(false)}
        onConfirm={(value) => {
          setDeadlineOpen(false);
          updateFacts(c.id, {}, value);
          show(value ? `마감을 ${md(value)}로 바꿨어요` : '마감 없음으로 바꿨어요');
        }}
      />

      <ExcludeDialog
        count={1}
        visible={excludeOpen}
        onCancel={() => setExcludeOpen(false)}
        onConfirm={() => {
          setExcludeOpen(false);
          excludePractices([c.id]);
          show('보관함으로 옮겼어요', true);
        }}
      />
    </View>
  );
}

/* ───────── 작은 조각들 ───────── */

function Section({
  title,
  right,
  rightIcon,
  action,
  onHeaderPress,
  children,
}: {
  title: string;
  right?: string;
  rightIcon?: ReactNode;
  action?: { label: string; onPress: () => void };
  onHeaderPress?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onHeaderPress} disabled={!onHeaderPress} style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right && <Text style={styles.sectionRight}>{right}</Text>}
        {rightIcon}
        {action && (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </Pressable>
      {children}
    </View>
  );
}

function Banner({
  tone,
  icon,
  action,
  children,
}: {
  tone: 'red' | 'green' | 'warn' | 'sub';
  icon: ReactNode;
  action?: { label: string; onPress: () => void };
  children: string;
}) {
  const bg = tone === 'red' ? '#fdf2ef' : tone === 'green' ? colors.tint : tone === 'warn' ? colors.warnBg : '#efeee9';
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.bannerText, { color: TONE[tone] }]}>{children}</Text>
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={styles.bannerBtn}>
          <Text style={[styles.bannerBtnText, { color: TONE[tone] }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function FactRow({
  label,
  value,
  edited,
  onSource,
}: {
  label: string;
  value: string | null;
  edited?: boolean;
  onSource?: () => void;
}) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.factValue, value === null && { color: colors.warn }]}>{value ?? '직접 확인 필요'}</Text>
        {edited && <Text style={styles.factEdited}>직접 수정함</Text>}
      </View>
      {onSource && (
        <Pressable onPress={onSource} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} 원본에서 보기`}>
          <Text style={styles.factSource}>원본에서 보기</Text>
        </Pressable>
      )}
    </View>
  );
}

function MenuRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.menuRow}>
      <Text style={[styles.menuText, danger && { color: colors.error }]}>{label}</Text>
    </Pressable>
  );
}

/* ───────── 스타일 ───────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },

  hero: { flexDirection: 'row', gap: 14, backgroundColor: colors.surface, borderRadius: radius.card, padding: 14 },
  thumb: {
    width: 76,
    height: 136,
    borderRadius: 10,
    backgroundColor: '#e4e2dc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(34,46,40,0.7)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  thumbBadgeText: { fontFamily: fonts.medium, fontSize: 10, color: '#fff' },
  catTag: { alignSelf: 'flex-start', backgroundColor: '#eef3ec', borderRadius: radius.chip, paddingHorizontal: 7, paddingVertical: 2 },
  catTagText: { fontFamily: fonts.medium, fontSize: 11, color: '#4e6b57' },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 27, letterSpacing: -0.4, color: colors.text },
  summary: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#5f665e' },
  dueText: { fontFamily: fonts.bold, fontSize: 13, marginTop: 'auto' },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 13 },
  bannerBtn: { paddingHorizontal: 4 },
  bannerBtnText: { fontFamily: fonts.bold, fontSize: 13, textDecorationLine: 'underline' },
  alarm: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  alarmText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },

  section: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 10 },
  sectionTitleInline: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  warnBadge: { backgroundColor: colors.warnBg, borderRadius: radius.chip, paddingHorizontal: 6, paddingVertical: 2 },
  warnBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.warn },
  factsSummary: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },
  factsActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f0ec', paddingTop: 12, marginTop: 2 },
  factsBtn: { flex: 1, height: 40, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' },
  factsBtnText: { fontFamily: fonts.medium, fontSize: 13 },
  excludeBtn: {
    flex: 1,
    height: 50,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  excludeBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.error },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sectionRight: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  sectionAction: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },

  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#eceae4', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: '#c4c2bb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  checkTextDone: { color: colors.textSub, textDecorationLine: 'line-through' },

  noGuide: { alignItems: 'center', gap: 4, paddingVertical: 10 },
  noGuideTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  noGuideDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub, textAlign: 'center' },

  guideLine: { flexDirection: 'row', gap: 10 },
  guideNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.tint,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    overflow: 'hidden',
  },
  guideText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: '#3b443e' },
  subLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSub },
  prepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prepChip: { backgroundColor: '#f3f2ee', borderRadius: radius.chip, paddingHorizontal: 9, paddingVertical: 4 },
  prepText: { fontFamily: fonts.regular, fontSize: 12, color: '#3b443e' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  linkText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },

  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  factLabel: { width: 64, fontFamily: fonts.regular, fontSize: 13, color: colors.textSub, paddingTop: 1 },
  factValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  factEdited: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSub },
  factSource: { fontFamily: fonts.medium, fontSize: 12, color: colors.primary, paddingTop: 1 },
  originalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f0ec',
    paddingTop: 12,
    marginTop: 2,
  },
  originalLinkText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  bottom: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  scrim: { flex: 1, backgroundColor: colors.scrim },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  menuRow: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  menuText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },

  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8, paddingBottom: 80 },
  goneIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  goneTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  goneDesc: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSub, textAlign: 'center' },
});
