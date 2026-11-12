import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Circle, CircleCheck, type LucideIcon } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';

/* ───────── Card ───────── */
export function Card({
  children,
  tone = 'default',
  style,
}: {
  children: ReactNode;
  tone?: 'default' | 'warn' | 'error';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'warn' ? colors.warnBg : tone === 'error' ? colors.errorBg : colors.surface;
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

/* ───────── Text helpers ───────── */
export function Caption({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.caption, style]}>{children}</Text>;
}

/** 여러 줄을 그대로 줄바꿈해 보여주는 안내문 */
export function Lines({
  lines,
  size = 12,
  align,
  lineHeight,
}: {
  lines: string[];
  size?: number;
  align?: 'center';
  lineHeight?: number;
}) {
  return (
    <View>
      {lines.map((line) => (
        <Text
          key={line}
          style={{
            fontFamily: fonts.regular,
            fontSize: size,
            lineHeight: lineHeight ?? size * 1.5,
            color: colors.textSub,
            textAlign: align,
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

/* ───────── Status chip ───────── */
export function StatusChip({ label, tone = 'green' }: { label: string; tone?: 'green' | 'warn' }) {
  return (
    <View style={[styles.chip, { backgroundColor: tone === 'warn' ? colors.warnBg : colors.tint }]}>
      <Text style={[styles.chipText, { color: tone === 'warn' ? colors.warn : colors.primary }]}>{label}</Text>
    </View>
  );
}

/* ───────── Toggle ───────── */
export function Toggle({
  value,
  onValueChange,
  disabled,
  onDisabledPress,
}: {
  value: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
  /** 잠긴 상태에서 눌렀을 때 (예: 권한 안내 화면으로 이동) */
  onDisabledPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onPress={() => (disabled ? onDisabledPress?.() : onValueChange?.(!value))}
      style={[
        styles.toggle,
        { backgroundColor: value ? colors.primary : colors.disabled, justifyContent: value ? 'flex-end' : 'flex-start' },
        { flexDirection: 'row' },
      ]}
    >
      <View style={styles.thumb} />
    </Pressable>
  );
}

/* ───────── Setting row (toggle + 설명) ───────── */
export function SettingItem({
  label,
  value,
  onValueChange,
  disabled,
  onDisabledPress,
  description,
  status,
  warning,
}: {
  label: string;
  value: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
  onDisabledPress?: () => void;
  description?: string;
  status?: string;
  warning?: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View style={styles.settingControl}>
        <Text style={[styles.settingLabel, { color: disabled ? colors.textSub : colors.text }]}>{label}</Text>
        <Toggle value={value} onValueChange={onValueChange} disabled={disabled} onDisabledPress={onDisabledPress} />
      </View>
      {description && <Text style={styles.settingDesc}>{description}</Text>}
      {status && <Text style={[styles.settingDesc, { fontSize: 10 }]}>{status}</Text>}
      {warning && <Text style={[styles.settingDesc, { fontSize: 10, color: colors.warn }]}>{warning}</Text>}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, alignSelf: 'stretch' }} />;
}

/* ───────── Form field ───────── */
export function FormField({
  label,
  style,
  error,
  hint,
  ...inputProps
}: { label: string; style?: StyleProp<ViewStyle>; error?: string; hint?: string } & TextInputProps) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        {...inputProps}
        style={[styles.input, error ? { borderColor: colors.error } : null]}
      />
      {error ? (
        <Text style={[styles.fieldLabel, { fontFamily: fonts.regular, color: colors.error }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.fieldLabel, { fontFamily: fonts.regular, fontSize: 11 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ───────── Option row (라디오) ───────── */
export function OptionRow({
  label,
  selected,
  onPress,
  size = 'lg',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'lg' | 'sm';
}) {
  const lg = size === 'lg';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.option,
        {
          height: lg ? 56 : 46,
          padding: lg ? 16 : 12,
          borderRadius: lg ? radius.button : radius.input,
          backgroundColor: selected ? colors.tint : colors.surface,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: selected && lg ? fonts.bold : fonts.regular,
          fontSize: lg ? 15 : 14,
          color: colors.text,
        }}
      >
        {label}
      </Text>
      {selected ? (
        <CircleCheck size={20} color={colors.primary} strokeWidth={1.5} />
      ) : (
        <Circle size={20} color={colors.border} strokeWidth={1.5} />
      )}
    </Pressable>
  );
}

/* ───────── Empty state ───────── */
export function EmptyState({
  icon: Icon,
  title,
  lines,
}: {
  icon: LucideIcon;
  title: string;
  lines: string[];
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyTile}>
        <Icon size={36} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Lines lines={lines} size={13} align="center" lineHeight={13 * 1.7} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: 16, gap: 10 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.chip },
  chipText: { fontFamily: fonts.bold, fontSize: 10 },
  toggle: { width: 44, height: 26, borderRadius: radius.pill, padding: 3 },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  settingControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  settingDesc: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16.5, color: colors.textSub },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.textSub },
  input: {
    minHeight: 48,
    padding: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 48 },
  emptyTile: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 23, color: colors.text, textAlign: 'center' },
});
