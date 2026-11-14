import { useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Hand,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react-native';
import { Button } from '../components/Button';
import { BATCH_SIZE, UNSORTED_SCREENSHOTS, type Screenshot } from '../mock/screenshots';
import { colors, fonts, radius } from '../theme';

type Decision = 'practice' | 'reference' | 'delete';

type BatchResult = {
  practice: number;
  reference: number;
  deleted: number;
  /** 안드로이드 삭제 팝업에서 거부해 미분류로 돌아간 장수 */
  canceled: number;
  /** 아직 분류하지 않고 남은 장수 */
  remaining: number;
};

/** 이만큼 끌고 놓으면 분류돼요 */
const SWIPE_THRESHOLD = 110;
/** 카드 가로:세로 비율 (폰 스크린샷 비율) */
const CARD_RATIO = 0.47;

const DECISION_STYLE: Record<Decision, { label: string; color: string; tint: string; blob: string }> = {
  practice: { label: '실천', color: colors.primary, tint: colors.tint, blob: colors.practiceBlob },
  reference: { label: '참고', color: colors.reference, tint: colors.referenceTint, blob: colors.referenceBlob },
  delete: { label: '삭제', color: colors.error, tint: colors.errorBg, blob: colors.deleteBlob },
};

/** 첫 사용 안내를 이미 봤는지. TODO: 앱을 껐다 켜도 유지되게 기기 저장소에 저장 */
let coachSeen = false;

export function SortScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const [queue, setQueue] = useState<Screenshot[]>(UNSORTED_SCREENSHOTS);
  const [batch, setBatch] = useState<Screenshot[]>(() => UNSORTED_SCREENSHOTS.slice(0, BATCH_SIZE));
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [showCoach, setShowCoach] = useState(!coachSeen);

  const decidedCount = Object.keys(decisions).length;
  const current = batch[index];
  const next = batch[index + 1];
  /** 이미 분류한 사진을 다시 보고 있는지 (‹ 로 돌아온 상태) */
  const isRevisit = index < decidedCount;
  const previousDecision = current ? decisions[current.id] : undefined;

  const finishBatch = (finalDecisions: Record<string, Decision>) => {
    const deleteIds = batch.filter((s) => finalDecisions[s.id] === 'delete').map((s) => s.id);

    const complete = (deleteAllowed: boolean) => {
      // TODO: practice → AI 분석 요청(팀원 B), reference → 참고함 저장, 허용된 delete → 기기에서 삭제
      const handled = new Set(
        batch.filter((s) => finalDecisions[s.id] !== 'delete' || deleteAllowed).map((s) => s.id),
      );
      const rest = queue.filter((s) => !handled.has(s.id));
      const count = (d: Decision) => batch.filter((s) => finalDecisions[s.id] === d).length;
      setQueue(rest);
      setResult({
        practice: count('practice'),
        reference: count('reference'),
        deleted: deleteAllowed ? deleteIds.length : 0,
        canceled: deleteAllowed ? 0 : deleteIds.length,
        remaining: rest.length,
      });
    };

    if (deleteIds.length === 0) {
      complete(true);
      return;
    }
    // 실제 앱에서는 이 자리에서 안드로이드 시스템 삭제 팝업이 떠요. (expo-media-library 연동 시 교체)
    // TODO: 명세의 임계치 규칙(삭제 예정이 n장을 넘으면 분류 도중에도 팝업)은 아직 미구현
    Alert.alert(
      `사진 ${deleteIds.length}장을 삭제할까요?`,
      '기기에서 완전히 삭제돼요.',
      [
        { text: '거부', style: 'cancel', onPress: () => complete(false) },
        { text: '허용', style: 'destructive', onPress: () => complete(true) },
      ],
      { cancelable: false },
    );
  };

  const decide = (decision: Decision) => {
    if (!current) return;
    const nextDecisions = { ...decisions, [current.id]: decision };
    setDecisions(nextDecisions);
    const nextIndex = index + 1;
    if (nextIndex >= batch.length && Object.keys(nextDecisions).length === batch.length) {
      finishBatch(nextDecisions);
    } else {
      setIndex(nextIndex);
    }
  };

  const startNextBatch = () => {
    setBatch(queue.slice(0, BATCH_SIZE));
    setDecisions({});
    setIndex(0);
    setResult(null);
  };

  const swipe = useSwipe(decide);

  if (result) {
    return <DoneView result={result} onNext={startNextBatch} onHome={() => nav.goBack()} />;
  }

  return (
    <View style={styles.root}>
      <SwipeBlobs swipe={swipe} />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerSide} />
        <View style={styles.pager}>
          <Pressable
            onPress={() => setIndex((i) => i - 1)}
            disabled={index === 0}
            accessibilityLabel="이전 사진"
            style={styles.pagerButton}
          >
            <ChevronLeft size={20} color={index === 0 ? colors.disabled : colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.pagerText}>
            {index + 1}
            <Text style={styles.pagerTotal}> / {batch.length}</Text>
          </Text>
          <Pressable
            onPress={() => setIndex((i) => i + 1)}
            disabled={!isRevisit}
            accessibilityLabel="다음 사진"
            style={styles.pagerButton}
          >
            <ChevronRight size={20} color={isRevisit ? colors.text : colors.disabled} strokeWidth={2} />
          </Pressable>
        </View>
        {/* TODO: 나갈 때 지금까지 분류한 사진은 저장 */}
        <Pressable onPress={() => nav.goBack()} accessibilityLabel="분류 그만하기" style={styles.headerSide}>
          <X size={22} color={colors.text} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.progress}>
        {batch.map((s, i) => (
          <View key={s.id} style={[styles.progressSeg, i < decidedCount && styles.progressSegDone]} />
        ))}
      </View>

      <DeleteHint swipe={swipe} />

      {isRevisit && (
        <View style={styles.revisitHint}>
          <Text style={styles.revisitHintText}>이미 분류한 사진이에요 · 다른 쪽으로 밀면 바뀌어요</Text>
        </View>
      )}

      {current && (
        <Deck
          current={current}
          next={next}
          previousDecision={isRevisit ? previousDecision : undefined}
          swipe={swipe}
        />
      )}

      <View style={{ height: insets.bottom + 20 }} />

      {showCoach && (
        <CoachOverlay
          onStart={() => {
            coachSeen = true;
            setShowCoach(false);
          }}
        />
      )}
    </View>
  );
}

/* ───────── 스와이프 제스처 ───────── */

type Swipe = ReturnType<typeof useSwipe>;

function useSwipe(onDecide: (d: Decision) => void) {
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false);
  const onDecideRef = useRef(onDecide);
  onDecideRef.current = onDecide;

  const fly = (decision: Decision) => {
    if (busy.current) return;
    busy.current = true;
    const toValue =
      decision === 'practice'
        ? { x: -width * 1.5, y: 60 }
        : decision === 'reference'
          ? { x: width * 1.5, y: 60 }
          : { x: 0, y: -height };
    Animated.timing(pan, { toValue, duration: 220, useNativeDriver: false }).start(() => {
      onDecideRef.current(decision);
      pan.setValue({ x: 0, y: 0 });
      busy.current = false;
    });
  };
  const flyRef = useRef(fly);
  flyRef.current = fly;

  const reset = () => Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !busy.current && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -SWIPE_THRESHOLD && Math.abs(g.dy) > Math.abs(g.dx)) flyRef.current('delete');
        else if (g.dx < -SWIPE_THRESHOLD) flyRef.current('practice');
        else if (g.dx > SWIPE_THRESHOLD) flyRef.current('reference');
        else reset();
      },
      onPanResponderTerminate: reset,
    }),
  ).current;

  const progress: Record<Decision, Animated.AnimatedInterpolation<number>> = {
    practice: pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
    reference: pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' }),
    delete: pan.y.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
  };
  const rotate = pan.x.interpolate({ inputRange: [-width, 0, width], outputRange: ['-14deg', '0deg', '14deg'] });

  return { pan, responder, fly, progress, rotate };
}

/* ───────── 미는 방향 쪽 배경 원 ───────── */

function SwipeBlobs({ swipe }: { swipe: Swipe }) {
  const { width, height } = useWindowDimensions();
  const size = height;
  const base = { position: 'absolute' as const, width: size, height: size, borderRadius: size / 2 };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[base, { backgroundColor: colors.practiceBlob, left: -size * 0.62, top: (height - size) / 2, opacity: swipe.progress.practice }]}
      />
      <Animated.View
        style={[base, { backgroundColor: colors.referenceBlob, right: -size * 0.62, top: (height - size) / 2, opacity: swipe.progress.reference }]}
      />
      <Animated.View
        style={[base, { backgroundColor: colors.deleteBlob, left: (width - size) / 2, top: -size * 0.75, opacity: swipe.progress.delete }]}
      />
    </View>
  );
}

/* ───────── 위쪽 "기기에서 삭제" 안내 (밀면 빨간 알약으로 바뀜) ───────── */

function DeleteHint({ swipe }: { swipe: Swipe }) {
  const p = swipe.progress.delete;
  const lightOpacity = p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Pressable onPress={() => swipe.fly('delete')} accessibilityLabel="기기에서 삭제" style={styles.deleteHint}>
      <Animated.View style={[styles.deleteHintInner, { opacity: lightOpacity }]}>
        <ChevronUp size={14} color={colors.error} strokeWidth={2.2} />
        <Text style={[styles.deleteHintText, { color: colors.error }]}>기기에서 삭제</Text>
      </Animated.View>
      <Animated.View style={[styles.deleteHintInner, styles.deleteHintFilled, { opacity: p }]}>
        <ChevronUp size={14} color="#fff" strokeWidth={2.2} />
        <Text style={[styles.deleteHintText, { color: '#fff' }]}>기기에서 삭제</Text>
      </Animated.View>
    </Pressable>
  );
}

/* ───────── 카드 더미 + 양옆 탭 ───────── */

function Deck({
  current,
  next,
  previousDecision,
  swipe,
}: {
  current: Screenshot;
  next?: Screenshot;
  previousDecision?: Decision;
  swipe: Swipe;
}) {
  const { width } = useWindowDimensions();
  const [areaHeight, setAreaHeight] = useState(0);
  const cardHeight = Math.min(areaHeight - 24, (width * 0.64) / CARD_RATIO);
  const cardWidth = cardHeight * CARD_RATIO;
  const cardPos = { left: (width - cardWidth) / 2, top: (areaHeight - cardHeight) / 2 - 8 };

  const onLayout = (e: LayoutChangeEvent) => setAreaHeight(e.nativeEvent.layout.height);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {areaHeight > 0 && (
        <>
          {next && (
            <View style={[styles.card, styles.cardBehind, cardPos, { width: cardWidth, height: cardHeight }]}>
              <CardImage shot={next} />
            </View>
          )}

          <Animated.View
            key={current.id}
            {...swipe.responder.panHandlers}
            accessible
            accessibilityLabel={`${current.capturedAt} 캡처`}
            accessibilityActions={[
              { name: 'practice', label: '실천으로 분류' },
              { name: 'reference', label: '참고로 분류' },
              { name: 'delete', label: '기기에서 삭제' },
            ]}
            onAccessibilityAction={(e) => swipe.fly(e.nativeEvent.actionName as Decision)}
            style={[
              styles.card,
              cardPos,
              {
                width: cardWidth,
                height: cardHeight,
                transform: [{ translateX: swipe.pan.x }, { translateY: swipe.pan.y }, { rotate: swipe.rotate }],
              },
            ]}
          >
            <CardImage shot={current}>
              {previousDecision && (
                <View style={[styles.decidedChip, { backgroundColor: DECISION_STYLE[previousDecision].color }]}>
                  <Check size={12} color="#fff" strokeWidth={3} />
                  <Text style={styles.decidedChipText}>{DECISION_STYLE[previousDecision].label}</Text>
                </View>
              )}
            </CardImage>
          </Animated.View>

          <SideTab side="left" decision="practice" top={cardPos.top + cardHeight / 2 - 28} swipe={swipe} />
          <SideTab side="right" decision="reference" top={cardPos.top + cardHeight / 2 - 28} swipe={swipe} />
        </>
      )}
    </View>
  );
}

function CardImage({ shot, children }: { shot: Screenshot; children?: ReactNode }) {
  return (
    <View style={styles.cardImage}>
      {shot.uri ? (
        <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <ImageIcon size={26} color={colors.textSub} strokeWidth={1.5} />
      )}
      {children}
    </View>
  );
}

function SideTab({
  side,
  decision,
  top,
  swipe,
}: {
  side: 'left' | 'right';
  decision: Decision;
  top: number;
  swipe: Swipe;
}) {
  const s = DECISION_STYLE[decision];
  const Arrow = side === 'left' ? ArrowLeft : ArrowRight;
  const shape = side === 'left' ? styles.tabLeft : styles.tabRight;
  const p = swipe.progress[decision];
  return (
    <Pressable
      onPress={() => swipe.fly(decision)}
      accessibilityLabel={`${s.label}으로 분류`}
      style={[styles.tab, shape, { top, [side]: 0, backgroundColor: s.tint }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shape, { backgroundColor: s.color, opacity: p }]} />
      <View style={styles.tabContent}>
        <Animated.View style={{ opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
          <Arrow size={15} color={s.color} strokeWidth={2.2} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: p }]}>
          <Arrow size={15} color="#fff" strokeWidth={2.2} />
        </Animated.View>
      </View>
      <View>
        <Animated.Text style={[styles.tabText, { color: s.color, opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
          {s.label}
        </Animated.Text>
        <Animated.Text style={[styles.tabText, StyleSheet.absoluteFill, { color: '#fff', opacity: p }]}>{s.label}</Animated.Text>
      </View>
    </Pressable>
  );
}

/* ───────── 첫 사용 안내 ───────── */

function CoachOverlay({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.coach, { paddingTop: insets.top + 96, paddingBottom: insets.bottom + 20 }]}>
      <Text style={styles.coachTitle}>{'스와이프로\n캡처를 분류해보세요'}</Text>

      <View style={[styles.coachItem, { alignItems: 'center', marginTop: 40 }]}>
        <ArrowUp size={22} color={colors.error} strokeWidth={2.2} />
        <Text style={[styles.coachLabel, { color: colors.error }]}>위로 · 삭제</Text>
        <Text style={styles.coachDesc}>필요 없는 캡처를 기기에서 지워요</Text>
      </View>

      <View style={styles.coachRow}>
        <View style={[styles.coachItem, { alignItems: 'flex-start' }]}>
          <ArrowLeft size={22} color={colors.primary} strokeWidth={2.2} />
          <Text style={[styles.coachLabel, { color: colors.primary }]}>왼쪽 · 실천</Text>
          <Text style={styles.coachDesc}>{'해볼 일이에요\nAI가 방법을 정리해줘요'}</Text>
        </View>
        <View style={styles.coachHand}>
          <Hand size={30} color={colors.primary} strokeWidth={1.8} />
        </View>
        <View style={[styles.coachItem, { alignItems: 'flex-end' }]}>
          <ArrowRight size={22} color={colors.reference} strokeWidth={2.2} />
          <Text style={[styles.coachLabel, { color: colors.reference }]}>오른쪽 · 참고</Text>
          <Text style={[styles.coachDesc, { textAlign: 'right' }]}>{'볼거리예요\n참고함에 모아둬요'}</Text>
        </View>
      </View>

      <Text style={styles.coachFoot}>양옆의 실천 · 참고 탭을 눌러도 분류돼요</Text>

      <Button label="시작하기" onPress={onStart} style={{ marginTop: 'auto', alignSelf: 'stretch' }} />
    </View>
  );
}

/* ───────── 한 묶음 완료 ───────── */

function DoneView({ result, onNext, onHome }: { result: BatchResult; onNext: () => void; onHome: () => void }) {
  const insets = useSafeAreaInsets();
  const sortedCount = result.practice + result.reference + result.deleted + result.canceled;
  const nextLabel = result.remaining > BATCH_SIZE ? `다음 ${BATCH_SIZE}장 분류하기` : `남은 ${result.remaining}장 분류하기`;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }]}>
      <View style={styles.doneHeader}>
        <Pressable onPress={onHome} accessibilityLabel="닫기" style={styles.headerSide}>
          <X size={22} color={colors.text} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.doneBody}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View style={styles.doneIcon}>
            <Check size={34} color={colors.primary} strokeWidth={2.2} />
          </View>
          <Text style={styles.doneTitle}>
            {result.remaining === 0 ? '모든 캡처를 정리했어요' : `${sortedCount}장을 정리했어요!`}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Stat value={result.practice} label="실천" color={colors.primary} />
          <Stat value={result.reference} label="참고" color={colors.reference} />
          <Stat value={result.deleted} label="삭제" color={colors.error} />
        </View>

        {result.practice > 0 && (
          <View style={styles.aiCard}>
            <View style={styles.aiIcon}>
              <Sparkles size={20} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.aiTitle}>실천할 방법을 정리하고 있어요</Text>
              <Text style={styles.aiDesc}>{result.practice}장 분석이 끝나면 알림으로 알려드릴게요</Text>
            </View>
          </View>
        )}
      </View>

      {result.canceled > 0 && (
        <View accessibilityRole="alert" style={styles.snackbar}>
          <RotateCcw size={18} color={colors.primary} strokeWidth={2} />
          <Text style={styles.snackbarText}>
            {`삭제를 취소한 ${result.canceled}장은\n다시 분류할 수 있게 돌려놨어요`}
          </Text>
        </View>
      )}

      <View style={{ gap: 4 }}>
        {result.remaining > 0 && <Button label={nextLabel} onPress={onNext} />}
        <Pressable onPress={onHome} accessibilityRole="button" style={styles.homeLink}>
          <Text style={styles.homeLinkText}>홈으로 가기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

/* ───────── 스타일 ───────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center' },
  pagerButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  pagerText: { minWidth: 52, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  pagerTotal: { fontFamily: fonts.regular, color: colors.textSub },

  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingTop: 6 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.disabled },
  progressSegDone: { backgroundColor: colors.primary },

  deleteHint: { alignSelf: 'center', marginTop: 18, minHeight: 44, justifyContent: 'center' },
  deleteHintInner: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill },
  deleteHintFilled: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.error, justifyContent: 'center' },
  deleteHintText: { fontFamily: fonts.medium, fontSize: 12 },

  revisitHint: { alignSelf: 'center', marginTop: 4, backgroundColor: colors.tint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  revisitHintText: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },

  card: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 22,
    shadowColor: '#222e28',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardBehind: { shadowOpacity: 0.06, elevation: 2 },
  cardImage: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#e4e2dc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  decidedChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  decidedChipText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },

  tab: { position: 'absolute', width: 50, height: 56, alignItems: 'center', justifyContent: 'center', gap: 1, overflow: 'hidden' },
  tabLeft: { borderTopRightRadius: 28, borderBottomRightRadius: 28, paddingRight: 4 },
  tabRight: { borderTopLeftRadius: 28, borderBottomLeftRadius: 28, paddingLeft: 4 },
  tabContent: { width: 15, height: 15 },
  tabText: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },

  coach: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(248, 247, 243, 0.94)',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  coachTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, letterSpacing: -0.4, color: colors.text, textAlign: 'center' },
  coachRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 44 },
  coachItem: { width: 110, gap: 4 },
  coachLabel: { fontFamily: fonts.bold, fontSize: 15 },
  coachDesc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
  coachHand: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachFoot: { marginTop: 44, fontFamily: fonts.regular, fontSize: 12, color: colors.textSub, textAlign: 'center' },

  doneHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -12 },
  doneBody: { flex: 1, justifyContent: 'center', gap: 28 },
  doneIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.bold, fontSize: 23, letterSpacing: -0.5, color: colors.text, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, paddingVertical: 16, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fonts.serif, fontSize: 30 },
  statLabel: { fontFamily: fonts.medium, fontSize: 13 },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.tint, borderRadius: radius.card, padding: 16 },
  aiIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  aiTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  aiDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSub },

  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.tint,
    borderWidth: 1,
    borderColor: '#d4e2ce',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  snackbarText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },

  homeLink: { height: 48, alignItems: 'center', justifyContent: 'center' },
  homeLinkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSub },
});
