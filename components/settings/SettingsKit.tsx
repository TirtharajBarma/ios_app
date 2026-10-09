import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';

// Matches the Expense Settings tab: same surfaces, soft tinted icons, peach accent.
export const kit = {
  bg: expenseColors.bgPrimary,
  card: expenseColors.bgCard,
  border: expenseColors.borderCard,
  divider: 'rgba(255,255,255,0.05)',
  text: expenseColors.textPrimary,
  textSub: expenseColors.textSubtle,
  textMuted: expenseColors.textMuted,
  accent: expenseColors.accentPeach,
  blue: expenseColors.accentBlue,
  green: expenseColors.accentGreen,
  amber: '#F4B860',
  red: expenseColors.accentRed,
  indigo: '#A8B8E8',
  purple: expenseColors.accentPurple,
  gray: '#A2AEBB',
  // left inset so nested rows line up under their parent's title
  indent: 64,
};

const tintBg = (hex: string) => `${hex}26`;

export function SettingsScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 48 }]}
      >
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); router.back(); }}
            style={s.backBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={20} color={kit.text} strokeWidth={2.4} />
          </TouchableOpacity>
          <AppText style={s.title}>{title}</AppText>
          {subtitle ? <AppText style={s.subtitle}>{subtitle}</AppText> : null}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

export function Group({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={s.group}>
      {title ? <AppText style={s.groupTitle}>{title.toUpperCase()}</AppText> : null}
      <View style={s.card}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={[s.divider, { marginLeft: kit.indent }]} />}
            {child}
          </React.Fragment>
        ))}
      </View>
      {footer ? <AppText style={s.groupFooter}>{footer}</AppText> : null}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  /** Lucide icon element; recoloured to `tint` automatically. */
  icon?: React.ReactElement<{ color?: string }>;
  tint?: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Row({ title, subtitle, icon, tint = kit.gray, right, chevron, onPress, style }: RowProps) {
  const body = (
    <View style={[s.row, style]}>
      <View style={s.rowLeft}>
        {icon ? (
          <View style={[s.iconCircle, { backgroundColor: tintBg(tint) }]}>
            {React.cloneElement(icon, { color: tint })}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText style={s.rowTitle}>{title}</AppText>
          {subtitle ? <AppText style={s.rowSub}>{subtitle}</AppText> : null}
        </View>
      </View>
      <View style={s.rowRight}>
        {right}
        {chevron ? <ChevronRight size={18} color={kit.textSub} /> : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); onPress(); }}>
      {body}
    </TouchableOpacity>
  );
}

export function SwitchRow({
  value,
  onValueChange,
  disabled,
  ...rest
}: Omit<RowProps, 'right' | 'chevron' | 'onPress'> & {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row
      {...rest}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: '#34C759', false: 'rgba(255,255,255,0.14)' }}
        />
      }
    />
  );
}

export function ValuePill({ label }: { label: string }) {
  return (
    <View style={s.pill}>
      <AppText style={s.pillText}>{label}</AppText>
      <ChevronRight size={12} color={kit.textSub} style={{ transform: [{ rotate: '90deg' }] }} />
    </View>
  );
}

/** Large summary card: state at a glance, with an optional primary action. */
export function Hero({
  icon,
  tint,
  title,
  body,
  status,
  actionLabel,
  onAction,
}: {
  icon: React.ReactElement<{ color?: string }>;
  tint: string;
  title: string;
  body: string;
  status: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.hero}>
      <View style={s.heroTop}>
        <View style={[s.heroIcon, { backgroundColor: tintBg(tint) }]}>
          {React.cloneElement(icon, { color: tint })}
        </View>
        <View style={[s.status, { backgroundColor: tintBg(tint) }]}>
          <View style={[s.statusDot, { backgroundColor: tint }]} />
          <AppText style={[s.statusText, { color: tint }]}>{status.toUpperCase()}</AppText>
        </View>
      </View>
      <AppText style={s.heroTitle}>{title}</AppText>
      <AppText style={s.heroBody}>{body}</AppText>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={s.heroBtn}
          activeOpacity={0.85}
          onPress={() => { Haptics.selectionAsync(); onAction(); }}
        >
          <AppText style={s.heroBtnText}>{actionLabel}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Numbered explainer list ("how it works"). */
export function Steps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <View>
      {steps.map((st, i) => (
        <React.Fragment key={st.title}>
          {i > 0 && <View style={[s.divider, { marginLeft: kit.indent }]} />}
          <View style={s.row}>
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: tintBg(kit.accent) }]}>
                <AppText style={s.stepNum}>{i + 1}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.rowTitle}>{st.title}</AppText>
                <AppText style={s.rowSub}>{st.body}</AppText>
              </View>
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: kit.bg },
  content: { paddingHorizontal: 16 },
  header: { paddingTop: 8, paddingBottom: 20 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: expenseColors.circleBtnBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { color: kit.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: kit.textSub, fontSize: 14, lineHeight: 20, marginTop: 4 },

  group: { marginBottom: 22 },
  groupTitle: {
    color: '#6F7485',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 6,
    marginBottom: 8,
  },
  groupFooter: { color: kit.textMuted, fontSize: 12, lineHeight: 17, marginLeft: 6, marginRight: 6, marginTop: 8 },
  card: {
    backgroundColor: kit.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: kit.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: kit.divider },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: kit.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowSub: { color: kit.textMuted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  stepNum: { color: kit.accent, fontSize: 14, fontWeight: '800' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: expenseColors.circleBtnBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: { color: kit.text, fontSize: 13, fontWeight: '700' },

  hero: {
    backgroundColor: kit.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: kit.border,
    padding: 20,
    marginBottom: 22,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: kit.text, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.2 },
  heroBody: { color: kit.textSub, fontSize: 14, lineHeight: 20, marginTop: 6 },
  heroBtn: {
    marginTop: 18,
    backgroundColor: kit.accent,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  heroBtnText: { color: '#16171E', fontSize: 15, fontWeight: '800' },
});
