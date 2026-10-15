import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { levelLabel } from '@/lib/format';
import { colors, controlHeight, fonts, radius, shadow, space, type } from '@/lib/theme';
import type { Level } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Mise en page
// ---------------------------------------------------------------------------
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.green} colors={[colors.green]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Heading({ children, level = 2, style }: { children: ReactNode; level?: 1 | 2 | 3 | 4; style?: StyleProp<TextStyle> }) {
  const variant = level === 1 ? type.h1 : level === 2 ? type.h2 : level === 3 ? type.h3 : type.h4;
  return (
    <Text accessibilityRole="header" style={[variant, { color: colors.green }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, small, style, numberOfLines }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[small ? type.small : type.body, { color: muted ? colors.muted : colors.charcoal }, style]}>
      {children}
    </Text>
  );
}

export function Eyebrow({ children, color = colors.terracottaDark }: { children: ReactNode; color?: string }) {
  return <Text style={[type.label, { color }]}>{children}</Text>;
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.sand }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Heading level={4} style={{ flex: 1 }}>
        {title}
      </Heading>
      {action}
    </View>
  );
}

export function Row({ children, style, gap = space[3] }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.sand2, marginVertical: space[3] }} />;
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------
export function Logo({ size = 40, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <Row gap={size * 0.3}>
      <Image
        source={require('../../assets/images/logo-symbol.png')}
        style={{ width: size * 1.48, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.title, fontSize: size * 0.5, letterSpacing: size * 0.04, color: inverse ? colors.white : colors.green }}
      >
        TERRA-LINK
      </Text>
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'whatsapp' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const palette = buttonPalette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        compact && { minHeight: 44, paddingHorizontal: space[4] },
        { backgroundColor: pressed ? palette.pressedBg : palette.bg, borderColor: palette.border },
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={palette.fg} /> : null}
          <Text style={[type.button, { color: palette.fg, textAlign: 'center', flexShrink: 1 }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonPalette: Record<ButtonVariant, { bg: string; pressedBg: string; fg: string; border: string }> = {
  primary: { bg: colors.terracotta, pressedBg: colors.terracottaDark, fg: colors.white, border: colors.terracotta },
  secondary: { bg: 'transparent', pressedBg: colors.greenTint, fg: colors.green, border: colors.green },
  whatsapp: { bg: colors.green, pressedBg: colors.greenDark, fg: colors.white, border: colors.green },
  ghost: { bg: 'transparent', pressedBg: colors.sand2, fg: colors.green, border: 'transparent' },
  danger: { bg: 'transparent', pressedBg: colors.dangerTint, fg: colors.danger, border: colors.danger },
};

export function IconButton({ icon, label, onPress, color = colors.green }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.sand2 }]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Formulaires — libellé toujours au-dessus du champ
// ---------------------------------------------------------------------------
type FieldProps = TextInputProps & { label: string; error?: string | null; hint?: string; optional?: boolean };

export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, error, hint, optional, multiline, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <Text style={[type.small, { fontFamily: fonts.bodyMedium, color: colors.charcoal }]}>
        {label}
        {optional ? <Text style={{ color: colors.muted, fontFamily: fonts.body }}> (facultatif)</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && { minHeight: 112, paddingTop: space[3], textAlignVertical: 'top' },
          focused && { borderColor: colors.green, ...styles.focusRing },
          error ? { borderColor: colors.danger } : null,
          style,
        ]}
        {...props}
      />
      {error ? (
        <Row gap={space[1]}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[type.small, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </Row>
      ) : hint ? (
        <Text style={[type.small, { color: colors.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: space[2] }}>
      {label ? <Text style={[type.small, { fontFamily: fonts.bodyMedium, color: colors.charcoal }]}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }} accessibilityRole="radiogroup" accessibilityLabel={label || undefined}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {selected ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
              <Text style={[type.small, { fontFamily: fonts.bodyMedium, color: selected ? colors.white : colors.green }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// États et badges
// ---------------------------------------------------------------------------
const levelStyle: Record<Level, { bg: string; fg: string; icon: IconName }> = {
  normal: { bg: colors.greenTint, fg: colors.greenDark, icon: 'checkmark-circle' },
  attention: { bg: '#F7EBCF', fg: '#6E4E12', icon: 'eye' },
  urgent: { bg: colors.dangerTint, fg: colors.danger, icon: 'warning' },
};

export function LevelBadge({ level, label }: { level: Level; label?: string }) {
  const s = levelStyle[level];
  return <Badge label={label ?? levelLabel[level]} bg={s.bg} fg={s.fg} icon={s.icon} />;
}

export function Badge({ label, bg = colors.sand2, fg = colors.charcoal, icon }: { label: string; bg?: string; fg?: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[type.small, { fontSize: 13, lineHeight: 18, fontFamily: fonts.bodySemi, color: fg }]}>{label}</Text>
    </View>
  );
}

export function levelColor(level: Level) {
  return levelStyle[level];
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.green} />
      <Body muted small>
        {label}
      </Body>
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space[7] }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.green} />
      </View>
      <Heading level={4} style={{ textAlign: 'center' }}>
        {title}
      </Heading>
      {text ? (
        <Body muted style={{ textAlign: 'center', maxWidth: 320 }}>
          {text}
        </Body>
      ) : null}
      {action ? <View style={{ marginTop: space[3], alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Notice({ text, tone = 'error', onRetry }: { text: string; tone?: 'error' | 'success' | 'info'; onRetry?: () => void }) {
  const palette = {
    error: { bg: colors.dangerTint, fg: colors.danger, icon: 'alert-circle' as IconName },
    success: { bg: colors.greenTint, fg: colors.greenDark, icon: 'checkmark-circle' as IconName },
    info: { bg: colors.sand2, fg: colors.charcoal, icon: 'information-circle' as IconName },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]} accessibilityLiveRegion="polite" accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Ionicons name={palette.icon} size={20} color={palette.fg} />
      <Text style={[type.small, { color: palette.fg, flex: 1 }]}>{text}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.small, { color: palette.fg, fontFamily: fonts.bodySemi, textDecorationLine: 'underline' }]}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InfoLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <Row gap={space[2]} style={{ alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 2 }} />
      <Body small muted style={{ flex: 1 }}>
        {children}
      </Body>
    </Row>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  // Largeur de lecture limitée et centrée sur tablette et ordinateur ; sans effet sur téléphone.
  screenContent: { padding: 20, paddingBottom: space[7], gap: space[4], width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.m,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.sand2,
    ...shadow.s,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: space[3] },
  button: {
    minHeight: controlHeight,
    paddingHorizontal: space[5],
    borderRadius: radius.s,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  focusRing: { outlineColor: colors.gold, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 },
  input: {
    minHeight: controlHeight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.s,
    backgroundColor: colors.white,
    paddingHorizontal: space[4],
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.charcoal,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.green },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[5] },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.greenTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[3], borderRadius: radius.s },
});
